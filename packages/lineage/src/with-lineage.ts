import type {
  BaseLaws,
  ComposableManifesto,
  LineageLaws,
  ManifestoDomainShape,
} from "@manifesto-ai/sdk";
import {
  AlreadyActivatedError,
  ManifestoError,
} from "@manifesto-ai/sdk";
import {
  attachRuntimeKernelFactory,
  getRuntimeKernelFactory,
  type RuntimeKernel,
} from "@manifesto-ai/sdk/internal";

import { createLineageService } from "./service/lineage-service.js";
import { createInMemoryLineageStore } from "./store/in-memory-lineage-store.js";
import type {
  LineageComposableManifesto,
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
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
  config: LineageConfig = {},
): LineageComposableManifesto<T, Laws> {
  const service = config.service
    ?? createLineageService(config.store ?? createInMemoryLineageStore());
  const resolvedConfig: ResolvedLineageConfig = Object.freeze({
    ...config,
    service,
  });
  const createKernel = getRuntimeKernelFactory(manifesto);
  let activated = false;

  const decorated: LineageComposableManifesto<T, Laws> = {
    _laws: Object.freeze({
      ...manifesto._laws,
      ...LINEAGE_LAWS,
    }) as Laws & LineageLaws,
    schema: manifesto.schema,
    activate() {
      if (activated) {
        throw new AlreadyActivatedError();
      }
      activated = true;
      return activateLineageRuntime<T>(createKernel(), service, resolvedConfig);
    },
  };

  attachRuntimeKernelFactory(
    decorated as unknown as ComposableManifesto<T, Laws & LineageLaws>,
    createKernel,
  );

  return attachLineageDecoration(
    decorated as unknown as ComposableManifesto<T, Laws & LineageLaws>,
    {
      service,
      config: resolvedConfig,
    },
  ) as unknown as LineageComposableManifesto<T, Laws>;
}

function activateLineageRuntime<T extends ManifestoDomainShape>(
  kernel: RuntimeKernel<T>,
  service: ResolvedLineageConfig["service"],
  config: ResolvedLineageConfig,
): LineageInstance<T> {
  const controller = createLineageRuntimeController(kernel, service, config);

  async function dispatchAsync(intent: Parameters<LineageInstance<T>["dispatchAsync"]>[0]) {
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

    const failure = toDispatchFailure(sealed.hostResult.error);
    kernel.emitEvent("dispatch:failed", {
      intentId: sealed.intent.intentId ?? "",
      intent: sealed.intent,
      error: failure,
    });
    throw failure;
  }

  return {
    createIntent: kernel.createIntent,
    dispatchAsync,
    subscribe: kernel.subscribe,
    on: kernel.on,
    getSnapshot: kernel.getSnapshot,
    getAvailableActions: kernel.getAvailableActions,
    isActionAvailable: kernel.isActionAvailable,
    MEL: kernel.MEL,
    schema: kernel.schema,
    dispose: kernel.dispose,
    restore: controller.restore,
    getWorld: controller.getWorld,
    getLatestHead: controller.getLatestHead,
    getHeads: controller.getHeads,
    getBranches: controller.getBranches,
    getActiveBranch: controller.getActiveBranch,
    switchActiveBranch: controller.switchActiveBranch,
    createBranch: controller.createBranch,
  };
}

function toDispatchFailure(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new ManifestoError(
    "LINEAGE_DISPATCH_FAILED",
    "Dispatch did not produce a completed lineage head",
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
