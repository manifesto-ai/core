import { createManifesto, createIntent } from '@manifesto-ai/sdk';
import type {
  ManifestoInstance,
  Snapshot,
  ManifestoEventPayload,
  Intent,
} from '@manifesto-ai/sdk';

/**
 * Create a TaskFlow ManifestoInstance from MEL source text.
 *
 * Phase 1: accepts MEL string directly.
 * Phase 2: will switch to compiled schema import.
 */
export function createTaskFlowInstance(melSource: string): ManifestoInstance {
  return createManifesto({
    schema: melSource,
    effects: {},
  });
}

/**
 * Dispatch an intent and wait for completion.
 *
 * The SDK's dispatch() is fire-and-forget (SDK-DISPATCH-3).
 * This utility wraps it with the on() telemetry channel to
 * provide an async interface for tests and imperative code.
 *
 * @see SDK SPEC v1.0.0 §14.3
 */
export function dispatchAsync(
  instance: ManifestoInstance,
  type: string,
  input?: Record<string, unknown>,
): Promise<Snapshot> {
  const intent: Intent = createIntent(type, input, crypto.randomUUID());

  return new Promise<Snapshot>((resolve, reject) => {
    const offCompleted = instance.on(
      'dispatch:completed',
      (e: ManifestoEventPayload) => {
        if (e.intentId === intent.intentId) {
          offCompleted();
          offFailed();
          resolve(e.snapshot!);
        }
      },
    );
    const offFailed = instance.on(
      'dispatch:failed',
      (e: ManifestoEventPayload) => {
        if (e.intentId === intent.intentId) {
          offCompleted();
          offFailed();
          reject(e.error);
        }
      },
    );

    instance.dispatch(intent);
  });
}

export type { ManifestoInstance, Snapshot, Intent };
