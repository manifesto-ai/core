import type { DomainSchema } from "../schema/domain.js";
import type { Snapshot } from "../schema/snapshot.js";
import type { SemanticPath } from "../schema/common.js";
import type { ExplainResult } from "../schema/result.js";
import { createTraceContext, createTraceNode } from "../schema/trace.js";
import { getByPath } from "../utils/path.js";
import { createContext } from "../evaluator/context.js";
import { evaluateExpr } from "../evaluator/expr.js";
import { isOk } from "../schema/common.js";

/**
 * Explain why a value is what it is
 *
 * @param schema - The domain schema
 * @param snapshot - Current snapshot state
 * @param path - The path to explain
 * @returns ExplainResult with value, trace, and dependencies
 */
export function explain(
  schema: DomainSchema,
  snapshot: Snapshot,
  path: SemanticPath
): ExplainResult {
  const trace = createTraceContext(snapshot.meta.timestamp);
  return explainWithTrace(schema, snapshot, path, trace);
}

function explainWithTrace(
  schema: DomainSchema,
  snapshot: Snapshot,
  path: SemanticPath,
  trace: ReturnType<typeof createTraceContext>
): ExplainResult {
  // Check if it's a computed path
  if (path.startsWith("computed.")) {
    return explainComputed(schema, snapshot, path, trace);
  }

  // Check if it's a system path
  if (path.startsWith("system.")) {
    const value = getByPath(snapshot.system, path.slice(7));
    return {
      value,
      trace: createTraceNode(trace, "expr", path, { path }, value, []),
      deps: [],
    };
  }

  // Check if it's an input path
  if (path.startsWith("input.") || path === "input") {
    const value = path === "input" ? snapshot.input : getByPath(snapshot.input, path.slice(6));
    return {
      value,
      trace: createTraceNode(trace, "expr", path, { path }, value, []),
      deps: [],
    };
  }

  // Default: it's a data path
  const value = getByPath(snapshot.data, path);
  return {
    value,
    trace: createTraceNode(trace, "expr", path, { path }, value, []),
    deps: [],
  };
}

/**
 * Explain a computed value
 */
function explainComputed(
  schema: DomainSchema,
  snapshot: Snapshot,
  path: SemanticPath,
  trace: ReturnType<typeof createTraceContext>
): ExplainResult {
  const spec = schema.computed.fields[path];

  if (!spec) {
    // Not a computed field, just return the stored value
    const value = snapshot.computed[path];
    return {
      value,
      trace: createTraceNode(trace, "computed", path, { path }, value, []),
      deps: [],
    };
  }

  // Evaluate the expression to get the trace
  const ctx = createContext(snapshot, schema, null, path, trace);
  const result = evaluateExpr(spec.expr, ctx);

  const value = isOk(result) ? result.value : null;

  // Build trace with dependency information
  const childTraces = spec.deps.map((dep) => {
    const depResult = explainWithTrace(schema, snapshot, dep, trace);
    return depResult.trace;
  });

  return {
    value,
    trace: createTraceNode(trace, "computed", path, { expr: spec.expr }, value, childTraces),
    deps: spec.deps,
  };
}
