/**
 * SDK v2.0.0 Public Types
 *
 * Defines ManifestoInstance, ManifestoConfig, event types, and supporting types.
 *
 * @see SDK SPEC v2.0.0
 * @module
 */

import type { DomainSchema, Snapshot as CoreSnapshot, Patch, Intent } from "@manifesto-ai/core";

// =============================================================================
// Snapshot<T> — Generic overlay on Core Snapshot
// =============================================================================

/**
 * Typed Snapshot with generic data shape.
 *
 * Core's Snapshot uses `data: unknown`. This overlay provides type-safe
 * access to domain data via the generic parameter T.
 *
 * @see SDK SPEC v2.0.0
 */
export type Snapshot<T = unknown> = Omit<CoreSnapshot, "data"> & { data: T };

// =============================================================================
// Effect Handler Types (SDK-owned, simplified from Host 3-param contract)
// =============================================================================

/**
 * Context provided to effect handlers.
 *
 * Simplified from Host's EffectContext (2-param contract).
 */
export type EffectContext<T = unknown> = {
  /** Current snapshot (read-only). */
  readonly snapshot: Readonly<Snapshot<T>>;
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
 * @see SDK SPEC v2.0.0
 */
export interface ManifestoConfig<T = unknown> {
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
   * Optional: Guard function for intent validation.
   */
  guard?: (intent: Intent, snapshot: Snapshot<T>) => boolean;

  /**
   * Optional: Restore from persisted snapshot.
   */
  snapshot?: Snapshot<T>;
}

// =============================================================================
// ManifestoInstance (§6)
// =============================================================================

/**
 * Selector function — projects a value from the typed snapshot.
 */
export type Selector<T, R> = (snapshot: Snapshot<T>) => R;

/**
 * Unsubscribe function returned by subscribe() and on().
 */
export type Unsubscribe = () => void;

/**
 * ManifestoInstance — the sole runtime handle returned by createManifesto().
 *
 * 5 methods, no more.
 *
 * @see SDK SPEC v2.0.0
 */
export interface ManifestoInstance<T = unknown> {
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
    selector: Selector<T, R>,
    listener: (value: R) => void,
  ): Unsubscribe;

  /**
   * Listen to intent lifecycle events (telemetry channel).
   *
   * Payload type is narrowed by event name.
   *
   * @see SDK-EVENT-1, SDK-EVENT-2, SDK-EVENT-3
   */
  on<K extends ManifestoEvent>(
    event: K,
    handler: (payload: ManifestoEventMap<T>[K]) => void,
  ): Unsubscribe;

  /**
   * Get the current snapshot synchronously.
   *
   * @see SDK-SNAP-1
   */
  getSnapshot(): Snapshot<T>;

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
 * Typed event map — payload narrowed by event name.
 *
 * @see SDK SPEC v1.0.0 §8
 */
export interface ManifestoEventMap<T = unknown> {
  "dispatch:completed": {
    intentId: string;
    intent: Intent;
    snapshot: Snapshot<T>;
  };
  "dispatch:rejected": {
    intentId: string;
    intent: Intent;
    reason: string;
  };
  "dispatch:failed": {
    intentId: string;
    intent: Intent;
    error: Error;
  };
}

/**
 * Telemetry event types for the `on()` channel.
 *
 * @see SDK SPEC v1.0.0 §8
 */
export type ManifestoEvent = keyof ManifestoEventMap;

/**
 * Union of all event payloads (for backward compatibility).
 *
 * Prefer using `ManifestoEventMap<T>[K]` with typed `on()` instead.
 *
 * @see SDK-INV-6 — intentId is always present
 */
export type ManifestoEventPayload<T = unknown> = ManifestoEventMap<T>[ManifestoEvent];
