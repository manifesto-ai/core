import { z } from "zod";

/**
 * TraceNodeKind - Types of trace nodes
 */
export const TraceNodeKind = z.enum([
  "expr",     // Expression evaluation
  "computed", // Computed field evaluation
  "flow",     // Flow execution
  "patch",    // State mutation
  "effect",   // Effect declaration
  "branch",   // Conditional branch taken
  "call",     // Flow call
  "halt",     // Normal termination
  "error",    // Error occurred
]);
export type TraceNodeKind = z.infer<typeof TraceNodeKind>;

/**
 * TraceNode - A single node in the execution trace.
 * Enables explainability - every computation produces a trace.
 */
export type TraceNode = {
  /**
   * Unique identifier for this trace node
   */
  id: string;

  /**
   * Type of trace node
   */
  kind: TraceNodeKind;

  /**
   * Path in the schema that produced this trace
   */
  sourcePath: string;

  /**
   * Input values at this point
   */
  inputs: Record<string, unknown>;

  /**
   * Output value produced
   */
  output: unknown;

  /**
   * Child trace nodes
   */
  children: TraceNode[];

  /**
   * Timestamp
   */
  timestamp: number;
};

export const TraceNode: z.ZodType<TraceNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    kind: TraceNodeKind,
    sourcePath: z.string(),
    inputs: z.record(z.string(), z.unknown()),
    output: z.unknown(),
    children: z.array(TraceNode),
    timestamp: z.number(),
  })
);

/**
 * TraceTermination - How the computation ended
 */
export const TraceTermination = z.enum(["complete", "effect", "halt", "error"]);
export type TraceTermination = z.infer<typeof TraceTermination>;

/**
 * TraceGraph - Complete trace of a computation
 */
export const TraceGraph = z.object({
  /**
   * Root trace node
   */
  root: TraceNode,

  /**
   * All nodes indexed by ID for quick lookup
   */
  nodes: z.record(z.string(), TraceNode),

  /**
   * The intent that triggered this computation
   */
  intent: z.object({
    type: z.string(),
    input: z.unknown(),
  }),

  /**
   * Snapshot version at start
   */
  baseVersion: z.number(),

  /**
   * Snapshot version at end
   */
  resultVersion: z.number(),

  /**
   * Total computation time (ms)
   */
  duration: z.number(),

  /**
   * Termination reason
   */
  terminatedBy: TraceTermination,
});
export type TraceGraph = z.infer<typeof TraceGraph>;

/**
 * Create a trace node
 */
export function createTraceNode(
  kind: TraceNodeKind,
  sourcePath: string,
  inputs: Record<string, unknown>,
  output: unknown,
  children: TraceNode[] = []
): TraceNode {
  return {
    id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind,
    sourcePath,
    inputs,
    output,
    children,
    timestamp: Date.now(),
  };
}
