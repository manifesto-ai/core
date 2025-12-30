import type { z } from "zod";
import {
  type Diagnostic,
  type DomainDiagnostics,
  createDomainDiagnostics,
} from "./diagnostic-types.js";
import { validatePaths } from "./path-validator.js";
import { validateComputedDAG, checkForwardReferences } from "./dag-validator.js";
import type { ComputedBuilder } from "../computed/computed-builder.js";
import type { ActionsBuilder } from "../actions/actions-builder.js";

export { type Diagnostic, type DomainDiagnostics, type DiagnosticCode, type DiagnosticSeverity } from "./diagnostic-types.js";

/**
 * Collect all referenced paths from computed and action definitions
 */
function collectReferencedPaths(
  computedBuilder: ComputedBuilder,
  actionsBuilder: ActionsBuilder
): Set<string> {
  const paths = new Set<string>();

  // Collect from computed expressions
  for (const [_name, def] of computedBuilder.getDefinitions()) {
    for (const dep of def.expr.deps()) {
      paths.add(dep);
    }
  }

  // Collect from action flows and availability
  // Note: This would require walking the FlowNode IR to extract paths
  // For now, we rely on the fact that expressions are constructed with
  // proper refs which track their deps

  return paths;
}

/**
 * Create diagnostics for a domain
 */
export function createDiagnostics(
  stateSchema: z.ZodObject<z.ZodRawShape>,
  computedBuilder: ComputedBuilder,
  actionsBuilder: ActionsBuilder
): DomainDiagnostics {
  const allDiagnostics: Diagnostic[] = [];

  // Collect referenced paths
  const referencedPaths = collectReferencedPaths(computedBuilder, actionsBuilder);

  // Get computed names
  const computedNames = new Set(computedBuilder.getDefinitions().keys());

  // 1. Path validation
  allDiagnostics.push(...validatePaths(stateSchema, computedNames, referencedPaths));

  // 2. Computed DAG validation (cycle detection)
  allDiagnostics.push(...validateComputedDAG(computedBuilder));

  // 3. Forward reference warnings
  allDiagnostics.push(...checkForwardReferences(computedBuilder));

  return createDomainDiagnostics(allDiagnostics);
}
