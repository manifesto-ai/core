/**
 * Internal Host Factory
 *
 * Creates Host instances internally for App layer.
 * Users provide Effects (simplified handlers), App adapts to Host's EffectHandler contract.
 *
 * @see APP-SPEC v2.2.0 §6.1
 * @see ADR-APP-002 §2.1
 * @internal
 * @module
 */

import {
  createHost,
  type ManifestoHost,
  type EffectHandler as HostEffectHandler,
  type EffectContext as HostEffectContext,
} from "@manifesto-ai/host";
import type { DomainSchema, Patch } from "@manifesto-ai/core";
import type { Effects, AppEffectContext } from "@manifesto-ai/shared";
import { RESERVED_EFFECT_TYPE } from "@manifesto-ai/shared";
import { executeSystemGet, type SystemGetParams } from "./system-get.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for creating internal Host.
 */
export interface InternalHostOptions {
  /** Compiled domain schema */
  readonly schema: DomainSchema;

  /** Effect handlers from user */
  readonly effects: Effects;

  /** Initial data for genesis snapshot */
  readonly initialData?: unknown;

  /** Maximum iterations (default: 100) */
  readonly maxIterations?: number;
}

// =============================================================================
// Host Creation
// =============================================================================

/**
 * Create an internal Host with effects registered.
 *
 * Adapts App's EffectHandler (2 params) to Host's EffectHandler (3 params).
 *
 * @param options - Host creation options
 * @returns Configured ManifestoHost instance
 *
 * @internal
 */
export function createInternalHost(options: InternalHostOptions): ManifestoHost {
  const { schema, effects, initialData, maxIterations } = options;

  // Create Host from @manifesto-ai/host
  const host = createHost(schema, {
    initialData: initialData === undefined ? {} : initialData,
    maxIterations,
  });

  // Register built-in system.get handler (compiler-internal)
  host.registerEffect(RESERVED_EFFECT_TYPE, async (_type, params, ctx) => {
    const { patches } = executeSystemGet(
      params as unknown as SystemGetParams,
      ctx.snapshot
    );
    return patches as Patch[];
  });

  // Register all effects, adapting signature from App to Host
  for (const [effectType, appHandler] of Object.entries(effects)) {
    const hostHandler: HostEffectHandler = async (
      _type: string,
      params: Record<string, unknown>,
      ctx: HostEffectContext
    ): Promise<Patch[]> => {
      // Adapt Host context to App context (simplified)
      const appCtx: AppEffectContext = {
        snapshot: ctx.snapshot,
      };

      // Call App-layer handler (2 params)
      const patches = await appHandler(params, appCtx);

      // Return as mutable Patch[] for Host
      return patches as Patch[];
    };

    host.registerEffect(effectType, hostHandler);
  }

  return host;
}

/**
 * Get registered effect types from Effects map.
 *
 * @param effects - Effects map
 * @returns Array of effect type strings
 */
export function getEffectTypes(effects: Effects): readonly string[] {
  return Object.keys(effects);
}
