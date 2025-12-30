import type { Diagnostic } from "./diagnostic-types.js";
import type { ComputedBuilder, ComputedDef } from "../computed/computed-builder.js";

/**
 * Validate that computed dependencies form a DAG (no cycles)
 *
 * Per FDR-B010, circular dependencies MUST be detected and reported.
 */
export function validateComputedDAG(computedBuilder: ComputedBuilder): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const definitions = computedBuilder.getDefinitions();

  // Build dependency graph (computed → computed only)
  const graph = new Map<string, string[]>();

  for (const [name, def] of definitions) {
    const deps = def.expr
      .deps()
      .filter((d) => d.startsWith("computed."))
      .map((d) => d.slice("computed.".length));
    graph.set(name, deps);
  }

  // Detect cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function detectCycle(node: string, path: string[]): string[] | null {
    visited.add(node);
    recursionStack.add(node);

    const deps = graph.get(node) ?? [];
    for (const dep of deps) {
      if (!graph.has(dep)) {
        // Reference to non-existent computed - will be caught by path validator
        continue;
      }

      if (!visited.has(dep)) {
        const cycle = detectCycle(dep, [...path, dep]);
        if (cycle) return cycle;
      } else if (recursionStack.has(dep)) {
        // Found a cycle
        return [...path, dep];
      }
    }

    recursionStack.delete(node);
    return null;
  }

  // Check each node
  const reportedCycles = new Set<string>();

  for (const name of graph.keys()) {
    if (!visited.has(name)) {
      const cycle = detectCycle(name, [name]);
      if (cycle) {
        // Create a normalized cycle key to avoid duplicate reports
        const cycleKey = [...cycle].sort().join(",");
        if (!reportedCycles.has(cycleKey)) {
          reportedCycles.add(cycleKey);
          diagnostics.push({
            code: "CIRCULAR_COMPUTED",
            severity: "error",
            message: `Circular dependency in computed fields: ${cycle.join(" → ")}`,
            path: `computed.${cycle[0]}`,
          });
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Check for forward references (computed referencing not-yet-defined computed)
 *
 * This is a warning, not an error, since definition order may matter
 * in some evaluation strategies.
 */
export function checkForwardReferences(computedBuilder: ComputedBuilder): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const definitions = computedBuilder.getDefinitions();
  const definedNames = new Set<string>();

  for (const [name, def] of definitions) {
    const deps = def.expr
      .deps()
      .filter((d) => d.startsWith("computed."))
      .map((d) => d.slice("computed.".length));

    for (const dep of deps) {
      if (!definedNames.has(dep) && definitions.has(dep)) {
        diagnostics.push({
          code: "MISSING_DEPENDENCY",
          severity: "warning",
          message: `Computed "${name}" references "${dep}" which is defined later. Consider reordering.`,
          path: `computed.${name}`,
        });
      }
    }

    definedNames.add(name);
  }

  return diagnostics;
}
