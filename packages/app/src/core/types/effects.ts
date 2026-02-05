/**
 * App-layer Effect Types
 *
 * Simplified effect handler types for the createApp public API.
 * These types adapt Host's internal EffectHandler contract to a user-friendly API.
 *
 * @see APP-SPEC v2.2.0 §6.1
 * @see ADR-APP-002 §3.1
 * @module
 */

import type { Patch, Snapshot } from "@manifesto-ai/core";

// =============================================================================
// App Effect Context
// =============================================================================

/**
 * Context provided to effect handlers at App layer.
 *
 * Simplified from Host's EffectContext (excludes internal Requirement details).
 * Users receive only what they need: the current snapshot for reading state.
 *
 * @see APP-SPEC v2.2.0 §6.1
 */
export type AppEffectContext = {
  /**
   * Current snapshot (read-only).
   * Use this to read current state when computing patches.
   */
  readonly snapshot: Readonly<Snapshot>;
};

// =============================================================================
// Effect Handler
// =============================================================================

/**
 * Effect handler function signature for App layer.
 *
 * Note: Host's EffectHandler takes (type, params, context) but at App layer
 * the type is already determined by the Effects record key, so only params
 * and context are passed.
 *
 * Effect handlers:
 * - MUST return Patch[] (can be empty)
 * - MUST NOT throw exceptions (return error patches instead)
 * - MUST NOT contain domain logic
 *
 * @example
 * ```typescript
 * const saveHandler: EffectHandler = async (params, ctx) => {
 *   try {
 *     await api.save(params);
 *     return [{ op: 'set', path: 'data.saved', value: true }];
 *   } catch (error) {
 *     return [{ op: 'set', path: 'data.error', value: error.message }];
 *   }
 * };
 * ```
 *
 * @see APP-SPEC v2.2.0 §6.1
 * @see Host Contract v2.0.2 §7 "Effect Handler Contract"
 */
export type EffectHandler = (
  params: unknown,
  ctx: AppEffectContext
) => Promise<readonly Patch[]>;

// =============================================================================
// Effects Map
// =============================================================================

/**
 * Effects map - key is effect type, value is handler.
 *
 * The effect type key must match the effect types declared in schema actions.
 * Schema compatibility is validated at app initialization.
 *
 * @example
 * ```typescript
 * const effects: Effects = {
 *   'api.save': async (params, ctx) => [...],
 *   'api.fetch': async (params, ctx) => [...],
 *   'notification.send': async (params, ctx) => [...],
 * };
 * ```
 *
 * @see APP-SPEC v2.2.0 §6.1
 */
export type Effects = Record<string, EffectHandler>;
