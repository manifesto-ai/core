import type { Snapshot } from "../schema/snapshot.js";
import type { DomainSchema } from "../schema/domain.js";
import type { Context } from "../schema/context.js";
import { type TraceContext, createTraceContext } from "../schema/trace.js";

export type EvalPhase = "flow" | "computed" | "availability" | "dispatchability" | "snapshot";

type RuntimeAllocationState = {
  ordinal: number;
};

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
   * Intent ID for the current intent (for re-entry safety)
   */
  readonly intentId?: string;

  /**
   * Runtime context for bound action flow evaluation.
   */
  readonly context?: Context;

  /**
   * Current evaluation phase. Runtime/context reads are legal only in flow.
   */
  readonly phase: EvalPhase;

  /**
   * Context-local occurrence ordinal for deterministic runtime allocation.
   */
  runtimeOrdinal?: number;

  /**
   * Shared deterministic runtime allocator for cloned nested evaluation contexts.
   */
  runtimeAllocator?: RuntimeAllocationState;

  /**
   * Current expression allocation path for deterministic runtime values.
   */
  expressionPath?: string;

  /**
   * Trace context for deterministic trace ID generation
   */
  readonly trace: TraceContext;

  /**
   * Collection context variables (for filter, map, find, etc.)
   */
  readonly $item?: unknown;
  readonly $index?: number;
  readonly $array?: unknown[];
  readonly collectionStack?: readonly number[];
};

/**
 * Create a new evaluation context
 *
 * @param timestampOrTrace - Required timestamp or TraceContext for deterministic tracing.
 */
export function createContext(
  snapshot: Snapshot,
  schema: DomainSchema,
  currentAction: string | null,
  nodePath: string,
  intentId: string | undefined,
  timestampOrTrace: number | TraceContext,
  options: {
    readonly context?: Context;
    readonly phase?: EvalPhase;
  } = {},
): EvalContext {
  return {
    snapshot,
    schema,
    currentAction,
    nodePath,
    intentId,
    context: options.context,
    phase: options.phase ?? (options.context ? "flow" : "snapshot"),
    runtimeOrdinal: 0,
    runtimeAllocator: { ordinal: 0 },
    trace:
      typeof timestampOrTrace === "object"
        ? timestampOrTrace
        : createTraceContext(timestampOrTrace),
    collectionStack: [],
  };
}

/**
 * Create context with collection variables for filter/map/find/etc.
 */
export function withCollectionContext(
  ctx: EvalContext,
  item: unknown,
  index: number,
  array: unknown[],
): EvalContext {
  return {
    ...ctx,
    $item: item,
    $index: index,
    $array: array,
    collectionStack: [...(ctx.collectionStack ?? []), index],
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
