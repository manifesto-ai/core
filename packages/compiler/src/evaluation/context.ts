import { parsePath } from "@manifesto-ai/core";

type RuntimeAllocationState = {
  ordinal: number;
};

const RUNTIME_ALLOCATION_STATE = Symbol("manifesto.compiler.runtimeAllocationState");

/**
 * Evaluation Context Types
 *
 * Defines context for expression evaluation.
 *
 * @see SPEC v0.4.0 §18.3
 */

/**
 * Minimal snapshot shape for evaluation.
 *
 * @see SPEC v0.4.0 §18.7
 */
export interface EvaluationSnapshot {
  /**
   * Domain state (matches StateSpec).
   * Path resolution default target.
   */
  state: unknown;

  /**
   * Computed values (matches ComputedSpec).
   * Accessed via bare key paths (e.g., "total", not "computed.total").
   */
  computed: Record<string, unknown>;
}

/**
 * Legacy evaluator metadata.
 *
 * @see SPEC v0.4.0 §18.3
 */
export interface EvaluationMeta {
  /**
   * Intent identifier.
   */
  intentId: string;

  /**
   * Actor reference (optional).
   */
  actor?: {
    type: string;
    id: string;
  };

  /**
   * Timestamp (optional).
   */
  timestamp?: number;
}

/**
 * Evaluation context.
 *
 * @see SPEC v0.4.0 §18.3
 */
export interface EvaluationContext {
  /**
   * Current snapshot for state lookups.
   * Paths resolve to snapshot.state.* by default.
   */
  snapshot: EvaluationSnapshot;

  /**
   * Legacy metadata retained for older call sites. MEL v5 runtime reads must
   * enter through explicit `$runtime.*` and `$context.*` inputs.
   */
  meta: EvaluationMeta;

  /**
   * Intent input.
   * Paths starting with "input.*" resolve here.
   */
  input: Record<string, unknown>;

  /**
   * Current $item value (for effect.args evaluation).
   * Paths starting with "$item.*" resolve here.
   */
  item?: unknown;

  /**
   * Bound transition runtime facts for `$runtime.*` reads.
   */
  runtime?: {
    intent?: {
      id?: string;
      action?: string;
    };
    time?: {
      timestamp?: number;
      iso?: string;
    };
    random?: {
      seed?: string;
    };
  };

  /**
   * Direct-injected external context for `$context.*` reads.
   */
  context?: Record<string, unknown>;
}

/**
 * Create a minimal evaluation context.
 *
 * @param options - Context options
 * @returns Evaluation context
 */
export function createEvaluationContext(
  options: Partial<EvaluationContext> & { meta: EvaluationMeta }
): EvaluationContext {
  return {
    snapshot: options.snapshot ?? { state: {}, computed: {} },
    meta: options.meta,
    input: options.input ?? {},
    item: options.item,
    ...(options.runtime ? { runtime: options.runtime } : {}),
    ...(options.context ? { context: options.context } : {}),
  };
}

export function getRuntimeAllocationState(ctx: EvaluationContext): RuntimeAllocationState {
  const existing = (ctx as { [RUNTIME_ALLOCATION_STATE]?: RuntimeAllocationState })[
    RUNTIME_ALLOCATION_STATE
  ];
  if (existing) {
    return existing;
  }

  return setRuntimeAllocationState(ctx, { ordinal: 0 });
}

export function inheritRuntimeAllocationState(
  parent: EvaluationContext,
  child: EvaluationContext,
): EvaluationContext {
  setRuntimeAllocationState(child, getRuntimeAllocationState(parent));
  return child;
}

function setRuntimeAllocationState(
  ctx: EvaluationContext,
  state: RuntimeAllocationState,
): RuntimeAllocationState {
  Object.defineProperty(ctx, RUNTIME_ALLOCATION_STATE, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: state,
  });
  return state;
}

/**
 * Create a working snapshot by cloning and applying a patch.
 *
 * Used for sequential evaluation semantics.
 *
 * @see FDR-MEL-070
 */
export function applyPatchToWorkingSnapshot(
  snapshot: EvaluationSnapshot,
  path: string,
  value: unknown
): EvaluationSnapshot {
  const newState = structuredClone(snapshot.state) as Record<string, unknown>;

  setValueAtPath(newState, path, value);

  return {
    state: newState,
    computed: snapshot.computed,
  };
}

/**
 * Set value at a dot-separated path.
 *
 * @param obj - Target object
 * @param path - Dot-separated path (e.g., "user.name")
 * @param value - Value to set
 */
function setValueAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = parsePath(path);
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}
