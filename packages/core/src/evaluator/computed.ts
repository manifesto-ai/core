import type { DomainSchema } from "../schema/domain.js";
import type { Snapshot } from "../schema/snapshot.js";
import type { SemanticPath, Result } from "../schema/common.js";
import type { ErrorValue } from "../schema/snapshot.js";
import { ok, err, isErr } from "../schema/common.js";
import { createError } from "../errors.js";
import { createContext } from "./context.js";
import { createTraceContext } from "../schema/trace.js";
import { evaluateExpr } from "./expr.js";
import { buildDependencyGraph, topologicalSort } from "./dag.js";

/**
 * Evaluate all computed values for a snapshot
 * Returns the computed values record or an error
 */
export function evaluateComputed(
  schema: DomainSchema,
  snapshot: Snapshot
): Result<Record<SemanticPath, unknown>, ErrorValue> {
  const trace = createTraceContext(snapshot.meta.timestamp);
  // Build dependency graph
  const graph = buildDependencyGraph(schema.computed);

  // Get topological order
  const sortResult = topologicalSort(graph);
  if (!sortResult.ok) {
    return err(createError(
      "CYCLIC_DEPENDENCY",
      sortResult.error.message,
      "",
      sortResult.error.path ?? "",
      trace.timestamp
    ));
  }

  // Evaluate in topological order
  const computed: Record<SemanticPath, unknown> = {};

  // Create a temporary snapshot with computed values being built
  let tempSnapshot: Snapshot = {
    ...snapshot,
    computed,
  };

  for (const path of sortResult.value) {
    const spec = schema.computed.fields[path];
    if (!spec) continue;

    // Create context with current state of computed values
    const ctx = createContext(tempSnapshot, schema, null, path, trace);

    // Evaluate the expression
    const result = evaluateExpr(spec.expr, ctx);

    if (isErr(result)) {
      return result;
    }

    // Store the computed value
    computed[path] = result.value;

    // Update temp snapshot for next iteration
    tempSnapshot = {
      ...tempSnapshot,
      computed: { ...computed },
    };
  }

  return ok(computed);
}

/**
 * Evaluate a single computed value
 */
export function evaluateSingleComputed(
  schema: DomainSchema,
  snapshot: Snapshot,
  path: SemanticPath
): Result<unknown, ErrorValue> {
  const trace = createTraceContext(snapshot.meta.timestamp);
  const spec = schema.computed.fields[path];
  if (!spec) {
    return err(createError(
      "PATH_NOT_FOUND",
      `Computed field not found: ${path}`,
      "",
      path,
      trace.timestamp
    ));
  }

  const ctx = createContext(snapshot, schema, null, path, trace);
  return evaluateExpr(spec.expr, ctx);
}
