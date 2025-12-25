/**
 * Impact Analysis
 *
 * Pure functions for analyzing dependencies and impact of path changes.
 */

import type { EditorDerived, EditorAction, EditorPolicy } from "@/domain";

// ============================================================================
// Direct Dependents
// ============================================================================

/**
 * Get paths that directly depend on the given path
 * (i.e., have the path in their deps array)
 */
export function getDirectDependents(
  path: string,
  derived: Record<string, EditorDerived> | undefined
): string[] {
  if (!derived) return [];

  const dependents: string[] = [];

  for (const d of Object.values(derived)) {
    if (d.path && d.deps.includes(path)) {
      dependents.push(d.path);
    }
  }

  return dependents;
}

// ============================================================================
// All Dependents (Transitive)
// ============================================================================

/**
 * Get all paths that depend on the given path (direct and transitive)
 */
export function getAllDependents(
  path: string,
  derived: Record<string, EditorDerived> | undefined
): string[] {
  if (!derived) return [];

  const visited = new Set<string>();
  const result: string[] = [];

  function visit(currentPath: string) {
    const directDeps = getDirectDependents(currentPath, derived);

    for (const dep of directDeps) {
      if (!visited.has(dep)) {
        visited.add(dep);
        result.push(dep);
        visit(dep);
      }
    }
  }

  visit(path);
  return result;
}

// ============================================================================
// Related Actions
// ============================================================================

/**
 * Get actions that reference the given path in their preconditions or effects
 * For now, we check if the action's preconditions Expression references the path
 */
export function getRelatedActions(
  path: string,
  actions: Record<string, EditorAction> | undefined
): string[] {
  if (!actions) return [];

  const related: string[] = [];

  for (const action of Object.values(actions)) {
    if (!action.path) continue;

    // Check if preconditions expression references the path
    if (action.preconditions && expressionReferencesPath(action.preconditions, path)) {
      related.push(action.path);
      continue;
    }

    // Check if effect config references the path
    if (action.effectConfig && expressionReferencesPath(action.effectConfig, path)) {
      related.push(action.path);
    }
  }

  return related;
}

// ============================================================================
// Related Policies
// ============================================================================

/**
 * Get policies that govern the given path
 */
export function getRelatedPolicies(
  path: string,
  policies: Record<string, EditorPolicy> | undefined
): string[] {
  if (!policies) return [];

  const related: string[] = [];

  for (const policy of Object.values(policies)) {
    if (!policy.path) continue;

    // Check if this policy's targetPath matches
    if (policy.targetPath === path) {
      related.push(policy.path);
      continue;
    }

    // Check if policy condition references the path
    if (policy.condition && expressionReferencesPath(policy.condition, path)) {
      related.push(policy.path);
    }
  }

  return related;
}

// ============================================================================
// Dependencies (What a path depends on)
// ============================================================================

/**
 * Get the direct dependencies of a path (what it depends on)
 */
export function getDependencies(
  path: string,
  derived: Record<string, EditorDerived> | undefined
): string[] {
  if (!derived) return [];

  for (const d of Object.values(derived)) {
    if (d.path === path) {
      return [...d.deps];
    }
  }

  return [];
}

/**
 * Get all dependencies of a path (direct and transitive)
 */
export function getAllDependencies(
  path: string,
  derived: Record<string, EditorDerived> | undefined,
  sources?: Record<string, { path: string }> | undefined
): string[] {
  if (!derived) return [];

  const visited = new Set<string>();
  const result: string[] = [];
  const sourceSet = new Set(
    sources ? Object.values(sources).map((s) => s.path) : []
  );

  function visit(currentPath: string) {
    const deps = getDependencies(currentPath, derived);

    for (const dep of deps) {
      if (!visited.has(dep)) {
        visited.add(dep);
        result.push(dep);

        // Only recurse if this is a derived path (not a source)
        if (!sourceSet.has(dep)) {
          visit(dep);
        }
      }
    }
  }

  visit(path);
  return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an Expression DSL tree references a specific path
 */
function expressionReferencesPath(expr: unknown, path: string): boolean {
  if (!expr) return false;

  // If it's an array (Expression DSL format)
  if (Array.isArray(expr)) {
    const [op, ...args] = expr;

    // Check for "get" operator
    if (op === "get" && args.length > 0 && args[0] === path) {
      return true;
    }

    // Recursively check all arguments
    for (const arg of args) {
      if (expressionReferencesPath(arg, path)) {
        return true;
      }
    }
  }

  // If it's a string that matches the path
  if (typeof expr === "string" && expr === path) {
    return true;
  }

  // If it's an object, check all values
  if (typeof expr === "object" && expr !== null) {
    for (const value of Object.values(expr)) {
      if (expressionReferencesPath(value, path)) {
        return true;
      }
    }
  }

  return false;
}
