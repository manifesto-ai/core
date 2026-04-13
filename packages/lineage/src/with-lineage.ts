import type {
  IntentAdmission,
  ComposableManifesto,
  LineageLaws,
  ManifestoDomainShape,
} from "@manifesto-ai/sdk";
import {
  DisposedError,
  ManifestoError,
} from "@manifesto-ai/sdk";
import { getExtensionKernel } from "@manifesto-ai/sdk/extensions";
import {
  activateComposable,
  assertComposableNotActivated,
  attachExtensionKernel,
  attachRuntimeKernelFactory,
  getActivationState,
  getRuntimeKernelFactory,
  type LineageRuntimeKernel,
  type LineageRuntimeKernelFactory,
} from "@manifesto-ai/sdk/provider";

import { createLineageService } from "./service/lineage-service.js";
import type {
  BaseComposableManifesto,
  CommitReport,
  LineageComposableManifesto,
  LineageComposableLaws,
  LineageConfig,
  LineageInstance,
} from "./runtime-types.js";
import {
  attachLineageDecoration,
  createLineageRuntimeController,
  toLineageSealRuntimeFailure,
  type ResolvedLineageConfig,
} from "./internal.js";

const LINEAGE_LAWS: LineageLaws = Object.freeze({ __lineageLaws: true });

export function withLineage<
  T extends ManifestoDomainShape,
>(
  manifesto: BaseComposableManifesto<T>,
  config: LineageConfig,
): LineageComposableManifesto<T> {
  assertComposableNotActivated(manifesto);

  const resolvedConfig = resolveLineageConfig(config);
  const { service } = resolvedConfig;
  const createKernel = getRuntimeKernelFactory(manifesto);
  const createLineageKernel: LineageRuntimeKernelFactory<T> = createKernel;
  const activationState = getActivationState(manifesto);

  const decorated: LineageComposableManifesto<T> = {
    _laws: Object.freeze({
      ...manifesto._laws,
      ...LINEAGE_LAWS,
    }) as LineageComposableLaws,
    schema: manifesto.schema,
    activate() {
      activateComposable(
        decorated as unknown as ComposableManifesto<T, LineageComposableLaws>,
      );
      return activateLineageRuntime<T>(createLineageKernel(), service, resolvedConfig);
    },
  };

  attachRuntimeKernelFactory(
    decorated as unknown as ComposableManifesto<T, LineageComposableLaws>,
    createKernel,
    activationState,
  );

  return attachLineageDecoration(
    decorated as unknown as ComposableManifesto<T, LineageComposableLaws>,
    {
      service,
      config: resolvedConfig,
    },
  ) as unknown as LineageComposableManifesto<T>;
}

function resolveLineageConfig(config: LineageConfig): ResolvedLineageConfig {
  if (!config || typeof config !== "object") {
    throw new ManifestoError(
      "LINEAGE_CONFIG_REQUIRED",
      "withLineage() requires a config object with either service or store",
    );
  }

  if ("service" in config && config.service) {
    return Object.freeze({
      ...config,
      service: config.service,
    });
  }

  if ("store" in config && config.store) {
    return Object.freeze({
      ...config,
      service: createLineageService(config.store),
    });
  }

  throw new ManifestoError(
    "LINEAGE_CONFIG_REQUIRED",
    "withLineage() requires a config object with either service or store",
  );
}

function activateLineageRuntime<T extends ManifestoDomainShape>(
  kernel: LineageRuntimeKernel<T>,
  service: ResolvedLineageConfig["service"],
  config: ResolvedLineageConfig,
): LineageInstance<T> {
  const controller = createLineageRuntimeController(kernel, service, config);
  let runtime!: LineageInstance<T>;

  function emitRejectedIntent(
    intent: Parameters<LineageInstance<T>["commitAsync"]>[0],
    error: ManifestoError,
  ): {
    readonly intentId: string;
    readonly intent: Parameters<LineageInstance<T>["commitAsync"]>[0];
    readonly code: "ACTION_UNAVAILABLE" | "INTENT_NOT_DISPATCHABLE" | "INVALID_INPUT";
    readonly reason: string;
  } {
    const payload = {
      intentId: intent.intentId ?? "",
      intent,
      code: error.code as "ACTION_UNAVAILABLE" | "INTENT_NOT_DISPATCHABLE" | "INVALID_INPUT",
      reason: error.message,
    } as const;
    kernel.emitEvent("dispatch:rejected", payload);
    return payload;
  }

  function toRejectedCommitError(
    legality: ReturnType<LineageRuntimeKernel<T>["evaluateIntentLegalityFor"]>,
  ): ManifestoError {
    if (legality.kind === "unavailable") {
      return kernel.createUnavailableError(legality.intent);
    }
    if (legality.kind === "invalid-input") {
      return legality.error;
    }
    if (legality.kind === "not-dispatchable") {
      return kernel.createNotDispatchableError(legality.intent);
    }
    throw new ManifestoError(
      "LINEAGE_REPORT_ERROR",
      "Cannot derive a rejected commit error for an admitted intent",
    );
  }

  async function commitAsync(intent: Parameters<LineageInstance<T>["commitAsync"]>[0]) {
    const sealed = await controller
      .sealIntent(intent, { publishOnCompleted: true })
      .catch((error) => {
        const failure = toError(error);
        if (!isRejectedDispatchError(failure)) {
          kernel.emitEvent("dispatch:failed", {
            intentId: intent.intentId ?? "",
            intent,
            error: failure,
          });
        }
        throw failure;
      });

    if (sealed.preparedCommit.branchChange.headAdvanced && sealed.publishedSnapshot) {
      kernel.emitEvent("dispatch:completed", {
        intentId: sealed.intent.intentId ?? "",
        intent: sealed.intent,
        snapshot: sealed.publishedSnapshot,
      });
      return sealed.publishedSnapshot;
    }

    const failure = toCommitFailure(sealed.hostResult.error);
    kernel.emitEvent("dispatch:failed", {
      intentId: sealed.intent.intentId ?? "",
      intent: sealed.intent,
      error: failure,
    });
    throw failure;
  }

  async function processCommitWithReport(
    intent: Parameters<LineageInstance<T>["commitAsyncWithReport"]>[0],
  ): Promise<CommitReport<T>> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    await controller.ensureReady();

    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    const beforeCanonicalSnapshot = kernel.getCanonicalSnapshot();
    const beforeSnapshot = kernel.getSnapshot();
    const legality = kernel.evaluateIntentLegalityFor(beforeCanonicalSnapshot, intent);
    const admission = kernel.deriveIntentAdmission(beforeCanonicalSnapshot, legality);

    if (legality.kind !== "admitted") {
      const blockedAdmission = admission as Extract<
        IntentAdmission<T>,
        { readonly kind: "blocked" }
      >;
      const rejectionError = toRejectedCommitError(legality);
      const rejection = emitRejectedIntent(legality.intent, rejectionError);

      return Object.freeze({
        kind: "rejected",
        intent: legality.intent,
        admission: blockedAdmission,
        beforeSnapshot,
        beforeCanonicalSnapshot,
        rejection,
      }) as CommitReport<T>;
    }

    const admittedAdmission = admission as Extract<
      IntentAdmission<T>,
      { readonly kind: "admitted" }
    >;

    let sealed;
    try {
      sealed = await controller.sealIntent(legality.intent, {
        publishOnCompleted: true,
        assumeEnqueued: true,
      });
    } catch (error) {
      const failure = toError(error);
      const runtimeFailure = toLineageSealRuntimeFailure<T>(failure);
      kernel.emitEvent("dispatch:failed", {
        intentId: legality.intent.intentId ?? "",
        intent: legality.intent,
        error: failure,
      });

      return Object.freeze({
        kind: "failed",
        intent: legality.intent,
        admission: admittedAdmission,
        beforeSnapshot,
        beforeCanonicalSnapshot,
        error: kernel.classifyExecutionFailure(
          failure,
          runtimeFailure?.stage ?? "seal",
        ),
        published: false,
        ...(runtimeFailure?.hostResult
          ? { diagnostics: kernel.createExecutionDiagnostics(runtimeFailure.hostResult) }
          : {}),
      }) as CommitReport<T>;
    }

    const diagnostics = kernel.createExecutionDiagnostics(sealed.hostResult);

    if (sealed.preparedCommit.branchChange.headAdvanced && sealed.publishedSnapshot) {
      const publishedCanonicalSnapshot = kernel.getCanonicalSnapshot();
      kernel.emitEvent("dispatch:completed", {
        intentId: sealed.intent.intentId ?? "",
        intent: sealed.intent,
        snapshot: sealed.publishedSnapshot,
      });

      return Object.freeze({
        kind: "completed",
        intent: sealed.intent,
        admission: admittedAdmission,
        outcome: kernel.deriveExecutionOutcome(
          beforeCanonicalSnapshot,
          publishedCanonicalSnapshot,
        ),
        diagnostics,
        resultWorld: sealed.preparedCommit.worldId,
        branchId: sealed.preparedCommit.branchId,
        headAdvanced: true,
      }) as CommitReport<T>;
    }

    const failure = toCommitFailure(sealed.hostResult.error);
    kernel.emitEvent("dispatch:failed", {
      intentId: sealed.intent.intentId ?? "",
      intent: sealed.intent,
      error: failure,
    });

    return Object.freeze({
      kind: "failed",
      intent: sealed.intent,
      admission: admittedAdmission,
      beforeSnapshot,
      beforeCanonicalSnapshot,
      error: kernel.classifyExecutionFailure(failure, "host"),
      published: false,
      diagnostics,
      resultWorld: sealed.preparedCommit.worldId,
      branchId: sealed.preparedCommit.branchId,
      headAdvanced: false,
      sealedOutcome: kernel.deriveExecutionOutcome(
        beforeCanonicalSnapshot,
        sealed.hostResult.snapshot as ReturnType<typeof kernel.getCanonicalSnapshot>,
      ),
    }) as CommitReport<T>;
  }

  function commitAsyncWithReport(
    intent: Parameters<LineageInstance<T>["commitAsyncWithReport"]>[0],
  ): Promise<CommitReport<T>> {
    if (kernel.isDisposed()) {
      return Promise.reject(new DisposedError());
    }

    const enrichedIntent = kernel.ensureIntentId(intent);
    return kernel.enqueue(() => processCommitWithReport(enrichedIntent));
  }

  function explainIntent(
    intent: Parameters<LineageInstance<T>["explainIntent"]>[0],
  ): ReturnType<LineageInstance<T>["explainIntent"]> {
    return getExtensionKernel<T, LineageComposableLaws>(runtime).explainIntentFor(
      kernel.getCanonicalSnapshot(),
      intent,
    );
  }

  function why(
    intent: Parameters<LineageInstance<T>["why"]>[0],
  ): ReturnType<LineageInstance<T>["why"]> {
    return explainIntent(intent);
  }

  function whyNot(
    intent: Parameters<LineageInstance<T>["whyNot"]>[0],
  ): ReturnType<LineageInstance<T>["whyNot"]> {
    const explanation = explainIntent(intent);
    return explanation.kind === "blocked" ? explanation.blockers : null;
  }

  runtime = attachExtensionKernel({
    createIntent: kernel.createIntent,
    commitAsync,
    commitAsyncWithReport,
    subscribe: kernel.subscribe,
    on: kernel.on,
    getSnapshot: kernel.getSnapshot,
    getCanonicalSnapshot: kernel.getCanonicalSnapshot,
    getSchemaGraph: kernel.getSchemaGraph,
    getAvailableActions: kernel.getAvailableActions,
    isIntentDispatchable: kernel.isIntentDispatchable,
    getIntentBlockers: kernel.getIntentBlockers,
    getActionMetadata: kernel.getActionMetadata,
    isActionAvailable: kernel.isActionAvailable,
    simulate: kernel.simulate,
    explainIntent,
    why,
    whyNot,
    MEL: kernel.MEL,
    schema: kernel.schema,
    dispose: kernel.dispose,
    restore: controller.restore,
    getWorld: controller.getWorld,
    getWorldSnapshot: controller.getWorldSnapshot,
    getLineage: controller.getLineage,
    getLatestHead: controller.getLatestHead,
    getHeads: controller.getHeads,
    getBranches: controller.getBranches,
    getActiveBranch: controller.getActiveBranch,
    switchActiveBranch: controller.switchActiveBranch,
    createBranch: controller.createBranch,
  }, kernel);

  return runtime;
}

function toCommitFailure(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new ManifestoError(
    "LINEAGE_COMMIT_FAILED",
    "Commit did not produce a completed lineage head",
  );
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(String(error));
}

function isRejectedDispatchError(error: Error): boolean {
  return "code" in error
    && typeof error.code === "string"
    && (
      error.code === "ACTION_UNAVAILABLE"
      || error.code === "INTENT_NOT_DISPATCHABLE"
      || error.code === "INVALID_INPUT"
    );
}
