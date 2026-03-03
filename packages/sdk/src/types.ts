/**
 * SDK v1.0.0 Public Types
 *
 * Defines ManifestoInstance, ManifestoConfig, event types, and supporting types.
 *
 * @see SDK SPEC v1.0.0 §6–8
 * @module
 */

import type { DomainSchema, Snapshot, Patch, Intent } from "@manifesto-ai/core";
import type { WorldStore } from "@manifesto-ai/world";

// =============================================================================
// Effect Handler Types (SDK-owned, simplified from Host 3-param contract)
// =============================================================================

/**
 * Context provided to effect handlers.
 *
 * Simplified from Host's EffectContext (2-param contract).
 */
export type EffectContext = {
  /** Current snapshot (read-only). */
  readonly snapshot: Readonly<Snapshot>;
};

/**
 * SDK-level effect handler.
 *
 * Users provide this simplified 2-param handler; SDK adapts it
 * to Host's 3-param EffectHandler internally.
 */
export type EffectHandler = (
  params: unknown,
  ctx: EffectContext,
) => Promise<readonly Patch[]>;

// =============================================================================
// ManifestoConfig (§7)
// =============================================================================

/**
 * Configuration for createManifesto().
 *
 * @see SDK SPEC v1.0.0 §7
 */
export interface ManifestoConfig {
  /**
   * Required: Domain schema defining state, computed, actions.
   * Accepts either a compiled DomainSchema or MEL text string.
   *
   * @see SDK-CONFIG-1
   */
  schema: DomainSchema | string;

  /**
   * Required: Effect handlers keyed by effect type.
   *
   * @see SDK-CONFIG-2
   */
  effects: Record<string, EffectHandler>;

  /**
   * Optional: World store implementation (default: in-memory).
   *
   * @see SDK-CONFIG-3
   */
  store?: WorldStore;

  /**
   * Optional: Guard function for intent validation.
   */
  guard?: (intent: Intent, snapshot: Snapshot) => boolean;

  /**
   * Optional: Restore from persisted snapshot.
   */
  snapshot?: Snapshot;
}

// =============================================================================
// ManifestoInstance (§6)
// =============================================================================

/**
 * Selector function — projects a value from the snapshot.
 */
export type Selector<R> = (snapshot: Snapshot) => R;

/**
 * Unsubscribe function returned by subscribe() and on().
 */
export type Unsubscribe = () => void;

/**
 * ManifestoInstance — the sole runtime handle returned by createManifesto().
 *
 * 5 methods, no more.
 *
 * @see SDK SPEC v1.0.0 §6
 */
export interface ManifestoInstance {
  /**
   * Fire-and-forget intent dispatch.
   *
   * Enqueues the intent for serial processing. Returns immediately.
   *
   * @throws DisposedError if instance is disposed (SDK-DISPATCH-4)
   * @see SDK-DISPATCH-1, SDK-DISPATCH-2, SDK-DISPATCH-3
   */
  dispatch(intent: Intent): void;

  /**
   * Subscribe to state changes via selector.
   *
   * Fires only at terminal snapshot, at most once per intent.
   *
   * @see SDK-SUB-1, SDK-SUB-2, SDK-SUB-3, SDK-SUB-4
   */
  subscribe<R>(
    selector: Selector<R>,
    listener: (value: R) => void,
  ): Unsubscribe;

  /**
   * Listen to intent lifecycle events (telemetry channel).
   *
   * @see SDK-EVENT-1, SDK-EVENT-2, SDK-EVENT-3
   */
  on(
    event: ManifestoEvent,
    handler: (payload: ManifestoEventPayload) => void,
  ): Unsubscribe;

  /**
   * Get the current snapshot synchronously.
   *
   * @see SDK-SNAP-1
   */
  getSnapshot(): Snapshot;

  /**
   * Dispose the instance and release resources.
   *
   * @see SDK-DISPOSE-1, SDK-DISPOSE-2, SDK-DISPOSE-3
   */
  dispose(): void;
}

// =============================================================================
// Event Channel Types (§8)
// =============================================================================

/**
 * Telemetry event types for the `on()` channel.
 *
 * @see SDK SPEC v1.0.0 §8
 */
export type ManifestoEvent =
  | "dispatch:completed"
  | "dispatch:rejected"
  | "dispatch:failed";

/**
 * Payload emitted through the event channel.
 *
 * @see SDK-INV-6 — intentId is always present
 */
export type ManifestoEventPayload = {
  /** Always present for correlation (SDK-INV-6). */
  intentId: string;

  /** The original intent. */
  intent: Intent;

  /** Present on 'dispatch:completed'. */
  snapshot?: Snapshot;

  /** Present on 'dispatch:rejected'. */
  reason?: string;

  /** Present on 'dispatch:failed'. */
  error?: Error;
};
