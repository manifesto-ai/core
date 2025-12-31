/**
 * @manifesto-ai/compiler v1.1 Verifier
 *
 * Verifies DomainDraft structure and integrity.
 * Per SPEC §11.3: Verifier performs structural validation.
 */

import { nanoid } from "nanoid";
import type {
  DomainDraft,
  Issue,
  IssueSeverity,
} from "../domain/types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Verify Context
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for the Verifier
 */
export interface VerifyContext {
  /**
   * Whether to include warnings
   */
  includeWarnings?: boolean;

  /**
   * Whether to check provenance completeness
   */
  checkProvenance?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 Verify Result
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of verification
 */
export interface VerifyResult {
  /**
   * Whether the domain draft is valid
   */
  valid: boolean;

  /**
   * All issues found
   */
  issues: Issue[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 Verification Checks
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create an issue
 */
function createIssue(
  code: string,
  severity: IssueSeverity,
  message: string,
  opts?: {
    fragmentId?: string;
    path?: string;
    suggestion?: string;
  }
): Issue {
  return {
    id: `issue_${nanoid(8)}`,
    code,
    severity,
    message,
    fragmentId: opts?.fragmentId,
    path: opts?.path,
    suggestion: opts?.suggestion,
  };
}

/**
 * Verify path uniqueness
 *
 * Each path should be provided by exactly one fragment.
 */
function verifyPathUniqueness(draft: DomainDraft): Issue[] {
  const issues: Issue[] = [];
  const paths = new Map<string, string[]>();

  for (const fragment of draft.fragments) {
    for (const path of fragment.provides) {
      const providers = paths.get(path) || [];
      providers.push(fragment.id);
      paths.set(path, providers);
    }
  }

  for (const [path, providers] of paths) {
    if (providers.length > 1) {
      issues.push(
        createIssue(
          "DUPLICATE_PATH",
          "error",
          `Path '${path}' is provided by multiple fragments: ${providers.join(", ")}`,
          { path }
        )
      );
    }
  }

  return issues;
}

/**
 * Verify dependency graph integrity
 *
 * All requires should be provided by some fragment.
 */
function verifyDependencyGraph(draft: DomainDraft): Issue[] {
  const issues: Issue[] = [];
  const providedPaths = new Set<string>();

  for (const fragment of draft.fragments) {
    for (const path of fragment.provides) {
      providedPaths.add(path);
    }
  }

  // Check that all requires are satisfied
  for (const fragment of draft.fragments) {
    for (const required of fragment.requires) {
      if (!providedPaths.has(required)) {
        issues.push(
          createIssue(
            "MISSING_DEPENDENCY",
            "error",
            `Fragment '${fragment.content.name}' requires '${required}' which is not provided`,
            { fragmentId: fragment.id, path: required }
          )
        );
      }
    }
  }

  // Verify topological order matches fragment count
  if (draft.dependencyGraph.topologicalOrder.length !== draft.fragments.length) {
    issues.push(
      createIssue(
        "INCOMPLETE_TOPOLOGICAL_ORDER",
        "error",
        `Topological order has ${draft.dependencyGraph.topologicalOrder.length} nodes but there are ${draft.fragments.length} fragments`
      )
    );
  }

  // Verify all fragments are in topological order
  const orderedSet = new Set(draft.dependencyGraph.topologicalOrder);
  for (const fragment of draft.fragments) {
    if (!orderedSet.has(fragment.id)) {
      issues.push(
        createIssue(
          "FRAGMENT_NOT_IN_ORDER",
          "error",
          `Fragment '${fragment.content.name}' (${fragment.id}) is not in topological order`,
          { fragmentId: fragment.id }
        )
      );
    }
  }

  return issues;
}

/**
 * Verify assembled structure
 *
 * The assembled structure should contain all fragment contents.
 */
function verifyAssembledStructure(draft: DomainDraft): Issue[] {
  const issues: Issue[] = [];

  // Count expected entries
  let expectedState = 0;
  let expectedComputed = 0;
  let expectedActions = 0;
  let expectedConstraints = 0;

  for (const fragment of draft.fragments) {
    switch (fragment.content.kind) {
      case "state":
        expectedState++;
        break;
      case "computed":
        expectedComputed++;
        break;
      case "action":
      case "effect":
      case "flow":
        expectedActions++;
        break;
      case "constraint":
        expectedConstraints++;
        break;
    }
  }

  // Verify counts
  const actualState = Object.keys(draft.assembled.state).length;
  const actualComputed = Object.keys(draft.assembled.computed).length;
  const actualActions = Object.keys(draft.assembled.actions).length;
  const actualConstraints = draft.assembled.constraints.length;

  if (actualState !== expectedState) {
    issues.push(
      createIssue(
        "STATE_COUNT_MISMATCH",
        "error",
        `Expected ${expectedState} state entries but found ${actualState}`
      )
    );
  }

  if (actualComputed !== expectedComputed) {
    issues.push(
      createIssue(
        "COMPUTED_COUNT_MISMATCH",
        "error",
        `Expected ${expectedComputed} computed entries but found ${actualComputed}`
      )
    );
  }

  if (actualActions !== expectedActions) {
    issues.push(
      createIssue(
        "ACTIONS_COUNT_MISMATCH",
        "error",
        `Expected ${expectedActions} action entries but found ${actualActions}`
      )
    );
  }

  if (actualConstraints !== expectedConstraints) {
    issues.push(
      createIssue(
        "CONSTRAINTS_COUNT_MISMATCH",
        "error",
        `Expected ${expectedConstraints} constraint entries but found ${actualConstraints}`
      )
    );
  }

  return issues;
}

/**
 * Verify provenance completeness
 *
 * Each fragment should have complete provenance.
 */
function verifyProvenance(draft: DomainDraft): Issue[] {
  const issues: Issue[] = [];

  for (const fragment of draft.fragments) {
    const p = fragment.provenance;

    if (!p.source) {
      issues.push(
        createIssue(
          "MISSING_PROVENANCE_SOURCE",
          "warning",
          `Fragment '${fragment.content.name}' missing provenance.source`,
          { fragmentId: fragment.id }
        )
      );
    }

    if (!p.inputId) {
      issues.push(
        createIssue(
          "MISSING_PROVENANCE_INPUT_ID",
          "warning",
          `Fragment '${fragment.content.name}' missing provenance.inputId`,
          { fragmentId: fragment.id }
        )
      );
    }

    if (!p.planId) {
      issues.push(
        createIssue(
          "MISSING_PROVENANCE_PLAN_ID",
          "warning",
          `Fragment '${fragment.content.name}' missing provenance.planId`,
          { fragmentId: fragment.id }
        )
      );
    }

    if (!p.chunkId) {
      issues.push(
        createIssue(
          "MISSING_PROVENANCE_CHUNK_ID",
          "warning",
          `Fragment '${fragment.content.name}' missing provenance.chunkId`,
          { fragmentId: fragment.id }
        )
      );
    }
  }

  return issues;
}

/**
 * Verify naming conventions
 */
function verifyNamingConventions(draft: DomainDraft): Issue[] {
  const issues: Issue[] = [];
  const camelCaseRegex = /^[a-z][a-zA-Z0-9]*$/;

  for (const fragment of draft.fragments) {
    const name = fragment.content.name;

    if (!camelCaseRegex.test(name)) {
      issues.push(
        createIssue(
          "NAMING_CONVENTION",
          "warning",
          `Fragment name '${name}' does not follow camelCase convention`,
          { fragmentId: fragment.id, suggestion: "Use camelCase for fragment names" }
        )
      );
    }
  }

  return issues;
}

/**
 * Verify fragment IDs are unique
 */
function verifyUniqueIds(draft: DomainDraft): Issue[] {
  const issues: Issue[] = [];
  const ids = new Set<string>();

  for (const fragment of draft.fragments) {
    if (ids.has(fragment.id)) {
      issues.push(
        createIssue(
          "DUPLICATE_FRAGMENT_ID",
          "error",
          `Duplicate fragment ID: ${fragment.id}`,
          { fragmentId: fragment.id }
        )
      );
    }
    ids.add(fragment.id);
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 Verifier Implementation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verifier - validates DomainDraft structure
 *
 * Per SPEC §11.3: Verifier performs structural validation.
 *
 * Responsibilities:
 * - Verify path uniqueness
 * - Verify dependency graph integrity
 * - Verify assembled structure completeness
 * - Verify provenance (optional)
 */
export interface Verifier {
  /**
   * Verify a DomainDraft
   */
  verify(draft: DomainDraft, context?: VerifyContext): VerifyResult;
}

/**
 * Create the Verifier
 */
export function createVerifier(): Verifier {
  return {
    verify(draft: DomainDraft, context: VerifyContext = {}): VerifyResult {
      const allIssues: Issue[] = [];

      // Core checks (always run)
      allIssues.push(...verifyUniqueIds(draft));
      allIssues.push(...verifyPathUniqueness(draft));
      allIssues.push(...verifyDependencyGraph(draft));
      allIssues.push(...verifyAssembledStructure(draft));

      // Optional checks
      if (context.checkProvenance !== false) {
        allIssues.push(...verifyProvenance(draft));
      }

      if (context.includeWarnings !== false) {
        allIssues.push(...verifyNamingConventions(draft));
      }

      // Determine validity (only errors make it invalid)
      const hasErrors = allIssues.some((issue) => issue.severity === "error");

      // Filter issues based on context
      let issues = allIssues;
      if (context.includeWarnings === false) {
        issues = allIssues.filter((issue) => issue.severity === "error");
      }

      return {
        valid: !hasErrors,
        issues,
      };
    },
  };
}

/**
 * Verifier version
 */
export const VERIFIER_VERSION = "1.1.0";
