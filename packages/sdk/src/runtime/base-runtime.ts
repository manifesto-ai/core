import {
  DisposedError,
} from "../errors.js";
import type {
  DispatchBlocker,
  IntentExplanation,
  ManifestoBaseInstance,
  ManifestoDomainShape,
  Snapshot,
  TypedIntent,
} from "../types.js";
import {
  EXTENSION_KERNEL,
  attachExtensionKernel,
  type RuntimeKernel,
} from "../compat/internal.js";
import {
  attemptToDispatchAsyncResult,
  attemptToDispatchReport,
  runBaseDispatchAttempt,
} from "./base-dispatch.js";
import {
  createRuntimePublication,
} from "./publication.js";

export function createBaseRuntimeInstance<T extends ManifestoDomainShape>(
  kernel: RuntimeKernel<T>,
): ManifestoBaseInstance<T> {
  const extensionKernel = kernel[EXTENSION_KERNEL];
  const publication = createRuntimePublication({
    setVisibleSnapshot: kernel.setVisibleSnapshot,
    restoreVisibleSnapshot: kernel.restoreVisibleSnapshot,
    getCanonicalSnapshot: kernel.getCanonicalSnapshot,
    emitEvent: kernel.emitEvent,
  });

  function dispatchAsync(intent: TypedIntent<T>): Promise<Snapshot<T["state"]>> {
    if (kernel.isDisposed()) {
      return Promise.reject(new DisposedError());
    }

    const enrichedIntent = kernel.ensureIntentId(intent);
    return kernel.enqueue(async () => {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      return attemptToDispatchAsyncResult(
        await runBaseDispatchAttempt(kernel, extensionKernel, publication, enrichedIntent),
      );
    });
  }

  function dispatchAsyncWithReport(intent: TypedIntent<T>) {
    if (kernel.isDisposed()) {
      return Promise.reject(new DisposedError());
    }

    const enrichedIntent = kernel.ensureIntentId(intent);
    return kernel.enqueue(async () => {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      return attemptToDispatchReport(
        await runBaseDispatchAttempt(kernel, extensionKernel, publication, enrichedIntent),
      );
    });
  }

  function explainIntent(intent: TypedIntent<T>): IntentExplanation<T> {
    return extensionKernel.explainIntentFor(kernel.getCanonicalSnapshot(), intent);
  }

  function why(intent: TypedIntent<T>): IntentExplanation<T> {
    return explainIntent(intent);
  }

  function whyNot(intent: TypedIntent<T>): readonly DispatchBlocker[] | null {
    const explanation = explainIntent(intent);
    return explanation.kind === "blocked" ? explanation.blockers : null;
  }

  return attachExtensionKernel({
    createIntent: kernel.createIntent,
    dispatchAsync,
    dispatchAsyncWithReport,
    subscribe: kernel.subscribe,
    on: kernel.on,
    getSnapshot: kernel.getSnapshot,
    getCanonicalSnapshot: kernel.getCanonicalSnapshot,
    getAvailableActions: kernel.getAvailableActions,
    isIntentDispatchable: kernel.isIntentDispatchable,
    getIntentBlockers: kernel.getIntentBlockers,
    explainIntent,
    why,
    whyNot,
    getActionMetadata: kernel.getActionMetadata,
    isActionAvailable: kernel.isActionAvailable,
    getSchemaGraph: kernel.getSchemaGraph,
    simulate: kernel.simulate,
    simulateIntent: kernel.simulateIntent,
    MEL: kernel.MEL,
    schema: kernel.schema,
    dispose: kernel.dispose,
  }, kernel);
}
