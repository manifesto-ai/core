import type {
  ComposableManifesto,
  LineageLaws,
  ManifestoDomainShape,
} from "@manifesto-ai/sdk";
import {
  ManifestoError,
} from "@manifesto-ai/sdk";
import {
  activateComposable,
  assertComposableNotActivated,
  attachRuntimeKernelFactory,
  getActivationState,
  getRuntimeKernelFactory,
  type RuntimeKernel,
} from "@manifesto-ai/sdk/provider";

import { createLineageService } from "./service/lineage-service.js";
import type {
  BaseComposableManifesto,
  LineageComposableManifesto,
  LineageComposableLaws,
  LineageConfig,
  LineageInstance,
} from "./runtime-types.js";
import {
  attachLineageDecoration,
  createLineageRuntimeController,
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
      return activateLineageRuntime<T>(createKernel(), service, resolvedConfig);
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
  kernel: RuntimeKernel<T>,
  service: ResolvedLineageConfig["service"],
  config: ResolvedLineageConfig,
): LineageInstance<T> {
  const controller = createLineageRuntimeController(kernel, service, config);

  async function commitAsync(intent: Parameters<LineageInstance<T>["commitAsync"]>[0]) {
    const sealed = await controller
      .sealIntent(intent, { publishOnCompleted: true })
      .catch((error) => {
        const failure = toError(error);
        if (!isActionUnavailable(failure)) {
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

  return {
    createIntent: kernel.createIntent,
    commitAsync,
    subscribe: kernel.subscribe,
    on: kernel.on,
    getSnapshot: kernel.getSnapshot,
    getCanonicalSnapshot: kernel.getCanonicalSnapshot,
    getSchemaGraph: kernel.getSchemaGraph,
    getAvailableActions: kernel.getAvailableActions,
    getActionMetadata: kernel.getActionMetadata,
    isActionAvailable: kernel.isActionAvailable,
    simulate: kernel.simulate,
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
  };
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

function isActionUnavailable(error: Error): boolean {
  return "code" in error
    && typeof error.code === "string"
    && error.code === "ACTION_UNAVAILABLE";
}
