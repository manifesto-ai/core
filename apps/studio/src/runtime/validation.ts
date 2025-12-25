/**
 * Domain Validation Logic
 *
 * Pure validation functions for testing and runtime use.
 */

import type { EditorSource, EditorDerived, EditorAction, EditorPolicy, ValidationIssue, ValidationResult } from "@/domain";
import { detectCycles, type DependencyGraph } from "./dag-validation";

// Re-export types for convenience
export type { ValidationIssue, ValidationResult };

export interface ValidationInput {
  domainId?: string;
  domainName?: string;
  sources?: Record<string, EditorSource>;
  derived?: Record<string, EditorDerived>;
  actions?: Record<string, EditorAction>;
  policies?: Record<string, EditorPolicy>;
}

/**
 * Validate domain definition
 */
export function validateDomain(input: ValidationInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { domainId, domainName, sources, derived, actions, policies } = input;

  // Check domain metadata
  if (!domainId) {
    issues.push({
      code: "DOMAIN_ID_REQUIRED",
      message: "Domain ID is required",
      path: "domain.id",
      severity: "error",
    });
  }

  if (!domainName) {
    issues.push({
      code: "DOMAIN_NAME_REQUIRED",
      message: "Domain name is required",
      path: "domain.name",
      severity: "error",
    });
  }

  // Collect all paths
  const allPaths = new Set<string>();
  for (const source of Object.values(sources ?? {})) {
    if (source.path) allPaths.add(source.path);
  }
  for (const d of Object.values(derived ?? {})) {
    if (d.path) allPaths.add(d.path);
  }
  for (const action of Object.values(actions ?? {})) {
    if (action.path) allPaths.add(action.path);
  }
  for (const policy of Object.values(policies ?? {})) {
    if (policy.path) allPaths.add(policy.path);
  }

  // Check sources
  for (const source of Object.values(sources ?? {})) {
    if (!source.path) {
      issues.push({
        code: "SOURCE_PATH_REQUIRED",
        message: "Source path is required",
        path: source.id,
        severity: "error",
      });
    } else if (!source.path.startsWith("data.")) {
      issues.push({
        code: "INVALID_SOURCE_PATH",
        message: "Source path must start with 'data.'",
        path: source.path,
        severity: "error",
        suggestedFix: {
          description: `Change to data.${source.path}`,
          value: `data.${source.path}`,
        },
      });
    }
  }

  // Check derived
  for (const d of Object.values(derived ?? {})) {
    if (!d.path) {
      issues.push({
        code: "DERIVED_PATH_REQUIRED",
        message: "Derived path is required",
        path: d.id,
        severity: "error",
      });
    } else if (!d.path.startsWith("derived.")) {
      issues.push({
        code: "INVALID_DERIVED_PATH",
        message: "Derived path must start with 'derived.'",
        path: d.path,
        severity: "error",
        suggestedFix: {
          description: `Change to derived.${d.path}`,
          value: `derived.${d.path}`,
        },
      });
    }

    // Check missing dependencies
    for (const dep of d.deps) {
      if (!allPaths.has(dep)) {
        issues.push({
          code: "MISSING_DEPENDENCY",
          message: `Dependency '${dep}' is not defined`,
          path: d.path,
          severity: "error",
        });
      }
    }
  }

  // Check actions
  for (const action of Object.values(actions ?? {})) {
    if (!action.path) {
      issues.push({
        code: "ACTION_PATH_REQUIRED",
        message: "Action path is required",
        path: action.id,
        severity: "error",
      });
    } else if (!action.path.startsWith("action.")) {
      issues.push({
        code: "INVALID_ACTION_PATH",
        message: "Action path must start with 'action.'",
        path: action.path,
        severity: "error",
        suggestedFix: {
          description: `Change to action.${action.path}`,
          value: `action.${action.path}`,
        },
      });
    }
  }

  // Check policies
  for (const policy of Object.values(policies ?? {})) {
    if (!policy.path) {
      issues.push({
        code: "POLICY_PATH_REQUIRED",
        message: "Policy path is required",
        path: policy.id,
        severity: "error",
      });
    } else if (!policy.path.startsWith("policy.")) {
      issues.push({
        code: "INVALID_POLICY_PATH",
        message: "Policy path must start with 'policy.'",
        path: policy.path,
        severity: "error",
        suggestedFix: {
          description: `Change to policy.${policy.path}`,
          value: `policy.${policy.path}`,
        },
      });
    }

    // Check if target path exists
    if (policy.targetPath && !allPaths.has(policy.targetPath)) {
      issues.push({
        code: "POLICY_INVALID_TARGET",
        message: `Policy target '${policy.targetPath}' is not defined`,
        path: policy.path,
        severity: "error",
      });
    }
  }

  // Check for circular dependencies
  if (derived && Object.keys(derived).length > 0) {
    const dependencyGraph: DependencyGraph = {};
    for (const d of Object.values(derived)) {
      if (d.path) {
        dependencyGraph[d.path] = {
          path: d.path,
          deps: d.deps,
        };
      }
    }

    const cycleResult = detectCycles(dependencyGraph);
    if (cycleResult.hasCycle) {
      for (const cycle of cycleResult.cycles) {
        issues.push({
          code: "CIRCULAR_DEPENDENCY",
          message: `Circular dependency detected: ${cycle.join(" → ")}`,
          path: cycle[0],
          severity: "error",
        });
      }
    }
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}
