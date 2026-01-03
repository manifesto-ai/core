import type { Snapshot } from "../schema/snapshot.js";
import type { DomainSchema } from "../schema/domain.js";
import type { TraceContext } from "../schema/trace.js";
import { createTraceContext } from "../schema/trace.js";

/**
 * Evaluation context for expressions and flows
 */
export type EvalContext = {
  /**
   * Current snapshot state
   */
  readonly snapshot: Snapshot;

  /**
   * Domain schema
   */
  readonly schema: DomainSchema;

  /**
   * Current action being processed (if any)
   */
  readonly currentAction: string | null;

  /**
   * Current node path in the flow (for tracing)
   */
  readonly nodePath: string;

  /**
   * Trace context (deterministic IDs + timestamp)
   */
  readonly trace: TraceContext;

  /**
   * Computation metadata (derived from intent/host context)
   */
  readonly meta: {
    readonly intentId: string;
    readonly actionName: string | null;
    readonly timestamp: number;
  };

  /**
   * Collection context variables (for filter, map, find, etc.)
   */
  readonly $item?: unknown;
  readonly $index?: number;
  readonly $array?: unknown[];
};

/**
 * Create a new evaluation context
 */
export function createContext(
  snapshot: Snapshot,
  schema: DomainSchema,
  currentAction?: string | null,
  nodePath?: string,
  trace?: TraceContext,
  meta?: { intentId: string; actionName: string | null; timestamp: number }
): EvalContext {
  const resolvedTrace = trace ?? createTraceContext(snapshot.meta.timestamp);
  const resolvedMeta = meta ?? {
    intentId: "",
    actionName: currentAction ?? null,
    timestamp: resolvedTrace.timestamp,
  };
  return {
    snapshot,
    schema,
    currentAction: currentAction ?? null,
    nodePath: nodePath ?? "",
    trace: resolvedTrace,
    meta: resolvedMeta,
  };
}

/**
 * Create context with collection variables for filter/map/find/etc.
 */
export function withCollectionContext(
  ctx: EvalContext,
  item: unknown,
  index: number,
  array: unknown[]
): EvalContext {
  return {
    ...ctx,
    $item: item,
    $index: index,
    $array: array,
  };
}

/**
 * Update context with new snapshot
 */
export function withSnapshot(ctx: EvalContext, snapshot: Snapshot): EvalContext {
  return { ...ctx, snapshot };
}

/**
 * Update context with new node path
 */
export function withNodePath(ctx: EvalContext, nodePath: string): EvalContext {
  return { ...ctx, nodePath };
}
