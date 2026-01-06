/**
 * Service-to-Effect Adapter
 *
 * Adapts ServiceHandler (App) to EffectHandler (Host) signatures.
 *
 * ServiceHandler: (params, ctx: ServiceContext) => ServiceReturn
 * EffectHandler:  (type, params, ctx: EffectContext) => Promise<Patch[]>
 *
 * @see Plan: lucky-splashing-curry.md
 */

import type { Patch, Snapshot } from "@manifesto-ai/core";
import type { EffectHandler, EffectContext } from "@manifesto-ai/host";
import type {
  ServiceHandler,
  ServiceContext,
  ServiceReturn,
  PatchHelpers,
  AppState,
} from "../types/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Context values needed for ServiceContext that aren't in EffectContext
 */
export interface AdapterContextValues {
  actorId: string;
  worldId: string;
  branchId: string;
  signal: AbortSignal;
}

/**
 * Options for creating an adapted handler
 */
export interface AdapterOptions {
  /** Get current context values (called at effect execution time) */
  getContext: () => AdapterContextValues;
}

// =============================================================================
// Patch Helpers Factory
// =============================================================================

/**
 * Create PatchHelpers for ServiceContext
 */
export function createPatchHelpers(): PatchHelpers {
  return {
    set(path: string, value: unknown): Patch {
      return { op: "set", path, value };
    },

    merge(path: string, value: Record<string, unknown>): Patch {
      return { op: "merge", path, value };
    },

    unset(path: string): Patch {
      return { op: "unset", path };
    },

    many(...patches: readonly (Patch | readonly Patch[])[]): Patch[] {
      const result: Patch[] = [];
      for (const p of patches) {
        if (Array.isArray(p)) {
          result.push(...p);
        } else {
          result.push(p as Patch);
        }
      }
      return result;
    },

    from(
      record: Record<string, unknown>,
      opts?: { basePath?: string }
    ): Patch[] {
      const basePath = opts?.basePath ?? "/data";
      return Object.entries(record).map(([key, value]) => ({
        op: "set" as const,
        path: `${basePath}/${key}`,
        value,
      }));
    },
  };
}

// =============================================================================
// Snapshot Conversion
// =============================================================================

/**
 * Convert Host Snapshot to App-compatible snapshot for ServiceContext.
 *
 * Host Snapshot includes `input` field, but we present it as AppState-like
 * for consistency with the rest of App's API.
 */
export function snapshotToServiceSnapshot(snapshot: Snapshot): AppState<unknown> {
  return {
    data: snapshot.data,
    computed: snapshot.computed,
    system: {
      status: snapshot.system.status === "computing" ? "computing" :
              snapshot.system.status === "pending" ? "pending" :
              snapshot.system.status === "error" ? "error" : "idle",
      lastError: snapshot.system.lastError ?? null,
      errors: snapshot.system.errors ?? [],
      pendingRequirements: snapshot.system.pendingRequirements ?? [],
      currentAction: snapshot.system.currentAction ?? null,
    },
    meta: {
      version: snapshot.meta.version,
      timestamp: snapshot.meta.timestamp,
      randomSeed: snapshot.meta.randomSeed,
      schemaHash: snapshot.meta.schemaHash,
    },
  };
}

// =============================================================================
// ServiceReturn Normalization
// =============================================================================

/**
 * Normalize ServiceReturn to Patch[].
 *
 * Handles:
 * - void/undefined → []
 * - Single Patch → [Patch]
 * - Patch[] → Patch[]
 * - { patches: Patch[] } → Patch[]
 */
export function normalizeServiceReturn(result: ServiceReturn): Patch[] {
  if (result === undefined || result === null) {
    return [];
  }

  // Single Patch object
  if (typeof result === "object" && "op" in result && "path" in result) {
    return [result as Patch];
  }

  // Array of patches
  if (Array.isArray(result)) {
    return result as Patch[];
  }

  // Object with patches property
  if (typeof result === "object" && "patches" in result) {
    return (result as { patches: readonly Patch[] }).patches as Patch[];
  }

  // Unknown type - return empty
  return [];
}

// =============================================================================
// Main Adapter
// =============================================================================

/**
 * Adapt a ServiceHandler to an EffectHandler.
 *
 * The adapter:
 * 1. Creates ServiceContext from EffectContext + AdapterContextValues
 * 2. Invokes the ServiceHandler
 * 3. Normalizes the return value to Patch[]
 * 4. Converts any thrown errors to error patches
 *
 * @param serviceHandler - The ServiceHandler to adapt
 * @param options - Adapter options with context getter
 * @returns EffectHandler compatible with ManifestoHost
 */
export function adaptServiceToEffect(
  serviceHandler: ServiceHandler,
  options: AdapterOptions
): EffectHandler {
  const patchHelpers = createPatchHelpers();

  return async (
    type: string,
    params: Record<string, unknown>,
    effectContext: EffectContext
  ): Promise<Patch[]> => {
    // Get current context values
    const ctxValues = options.getContext();

    // Convert snapshot for ServiceContext
    const serviceSnapshot = snapshotToServiceSnapshot(effectContext.snapshot);

    // Build ServiceContext
    const serviceContext: ServiceContext = {
      snapshot: serviceSnapshot,
      actorId: ctxValues.actorId,
      worldId: ctxValues.worldId,
      branchId: ctxValues.branchId,
      patch: patchHelpers,
      signal: ctxValues.signal,
    };

    // Invoke the service handler - let exceptions propagate to Host
    // Host will catch and handle errors appropriately (fail the action)
    const result = await serviceHandler(params, serviceContext);

    // Normalize the return value
    return normalizeServiceReturn(result);
  };
}

// =============================================================================
// Effect Registry Adapter
// =============================================================================

/**
 * Create an EffectHandler registry from ServiceMap.
 *
 * This adapts all ServiceHandlers in a ServiceMap to EffectHandlers
 * that can be registered with ManifestoHost.
 *
 * @param services - ServiceMap to adapt
 * @param getContext - Function to get current context values
 * @returns Map of effect type to adapted EffectHandler
 */
export function adaptServiceMap(
  services: Record<string, ServiceHandler>,
  getContext: () => AdapterContextValues
): Map<string, EffectHandler> {
  const adapted = new Map<string, EffectHandler>();

  for (const [type, handler] of Object.entries(services)) {
    adapted.set(type, adaptServiceToEffect(handler, { getContext }));
  }

  return adapted;
}
