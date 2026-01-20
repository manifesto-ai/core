/**
 * ApprovedScope Validation
 *
 * Validates proposals and results against ApprovedScope constraints.
 *
 * @see SPEC v2.0.0 §10.1
 * @module
 */

import type {
  ApprovedScope,
  Proposal,
  ValidationResult,
  Snapshot,
  Patch,
} from "../../core/types/index.js";

/**
 * Validate a proposal against an approved scope (pre-execution).
 *
 * @see SPEC v2.0.0 §10.1 POLICY-3
 */
export function validateProposalScope(
  proposal: Proposal,
  scope: ApprovedScope
): ValidationResult {
  const errors: string[] = [];

  // For pre-execution, we can only validate structural constraints
  // Actual path validation happens post-execution

  // Check constraints if provided
  if (scope.constraints) {
    // Validate intent-type specific constraints
    const typeConstraint = scope.constraints[proposal.intentType];
    if (typeConstraint === false) {
      errors.push(`Intent type '${proposal.intentType}' is not allowed`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validate execution result against an approved scope (post-execution).
 *
 * @see SPEC v2.0.0 §10.1 POLICY-4
 */
export function validateResultScope(
  baseSnapshot: Snapshot,
  terminalSnapshot: Snapshot,
  scope: ApprovedScope
): ValidationResult {
  const errors: string[] = [];

  // Extract patches between base and terminal
  const changes = diffSnapshots(baseSnapshot, terminalSnapshot);

  // Check patch count limit
  if (scope.maxPatchCount !== undefined && changes.length > scope.maxPatchCount) {
    errors.push(
      `Patch count ${changes.length} exceeds maximum ${scope.maxPatchCount}`
    );
  }

  // Check allowed paths
  if (scope.allowedPaths.length > 0) {
    for (const change of changes) {
      const isAllowed = scope.allowedPaths.some((allowed) =>
        pathMatches(change.path, allowed)
      );
      if (!isAllowed) {
        errors.push(`Path '${change.path}' is not in allowed paths`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Check if a path matches an allowed path pattern.
 *
 * Supports:
 * - Exact matches: 'data.todos'
 * - Wildcard suffixes: 'data.todos.*'
 * - Wildcard prefixes: '*.completed'
 */
export function pathMatches(path: string, pattern: string): boolean {
  // Exact match
  if (path === pattern) {
    return true;
  }

  // Wildcard suffix: 'data.todos.*' matches 'data.todos.0.title'
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return path.startsWith(prefix + ".") || path === prefix;
  }

  // Wildcard prefix: '*.completed' matches 'data.todos.0.completed'
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(2);
    return path.endsWith("." + suffix) || path === suffix;
  }

  // No match
  return false;
}

/**
 * Diff two snapshots to extract changes.
 *
 * Returns a list of paths that changed.
 */
function diffSnapshots(
  base: Snapshot,
  terminal: Snapshot
): Array<{ path: string; op: "set" | "unset" | "change" }> {
  const changes: Array<{ path: string; op: "set" | "unset" | "change" }> = [];

  // Only World-owned data paths are in scope (exclude $host).
  diffObjects(base.data, terminal.data, "data", changes);

  return changes;
}

/**
 * Recursively diff two objects.
 */
function diffObjects(
  base: unknown,
  terminal: unknown,
  prefix: string,
  changes: Array<{ path: string; op: "set" | "unset" | "change" }>
): void {
  if (prefix === "data.$host" || prefix.startsWith("data.$host.")) {
    return;
  }

  // Handle null/undefined
  if (base === terminal) {
    return;
  }

  if (base === null || base === undefined) {
    if (terminal !== null && terminal !== undefined) {
      changes.push({ path: prefix, op: "set" });
    }
    return;
  }

  if (terminal === null || terminal === undefined) {
    changes.push({ path: prefix, op: "unset" });
    return;
  }

  // Handle primitive types
  if (typeof base !== "object" || typeof terminal !== "object") {
    if (base !== terminal) {
      changes.push({ path: prefix, op: "change" });
    }
    return;
  }

  // Handle arrays
  if (Array.isArray(base) || Array.isArray(terminal)) {
    if (!Array.isArray(base) || !Array.isArray(terminal)) {
      changes.push({ path: prefix, op: "change" });
      return;
    }

    const maxLen = Math.max(base.length, terminal.length);
    for (let i = 0; i < maxLen; i++) {
      diffObjects(base[i], terminal[i], `${prefix}.${i}`, changes);
    }
    return;
  }

  // Handle objects
  const baseObj = base as Record<string, unknown>;
  const termObj = terminal as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(baseObj), ...Object.keys(termObj)]);

  for (const key of allKeys) {
    diffObjects(baseObj[key], termObj[key], `${prefix}.${key}`, changes);
  }
}

/**
 * Create a permissive scope that allows all changes.
 */
export function createPermissiveScope(): ApprovedScope {
  return {
    allowedPaths: ["*"],
    maxPatchCount: undefined,
    constraints: undefined,
  };
}

/**
 * Create a restrictive scope with specific allowed paths.
 */
export function createRestrictedScope(
  allowedPaths: readonly string[],
  opts?: {
    maxPatchCount?: number;
    constraints?: Record<string, unknown>;
  }
): ApprovedScope {
  return {
    allowedPaths,
    maxPatchCount: opts?.maxPatchCount,
    constraints: opts?.constraints,
  };
}
