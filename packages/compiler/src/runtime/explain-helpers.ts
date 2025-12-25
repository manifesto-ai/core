/**
 * Explain Helpers - Runtime-aided Verification Helper Functions
 *
 * Helper functions for the CompilerSession's explain and impact analysis methods.
 * These functions transform runtime data into user-friendly explanations.
 *
 * PRD 6.6.2: Runtime-aided 검증
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type { Fragment, FragmentId } from '../types/fragment.js';
import type { Issue } from '../types/issue.js';
import type { Conflict } from '../types/conflict.js';
import type { PatchHint } from '../types/patch.js';
import type {
  ExplainCompilerValueResult,
  CompilerImpactAnalysis,
  CompilerAgentContext,
  IssueExplanation,
  ConflictExplanation,
  CompilerSessionSnapshot,
  NextStep,
  Blocker,
} from '../types/session.js';

// ============================================================================
// Fragment Lookup Helpers
// ============================================================================

/**
 * Find fragments that provide a given path
 */
export function findFragmentsForPath(
  fragments: Fragment[],
  path: SemanticPath
): FragmentId[] {
  return fragments
    .filter((f) => f.provides.includes(path))
    .map((f) => f.id);
}

/**
 * Find fragments that require a given path
 */
export function findFragmentsRequiringPath(
  fragments: Fragment[],
  path: SemanticPath
): FragmentId[] {
  return fragments
    .filter((f) => f.requires.includes(path))
    .map((f) => f.id);
}

/**
 * Get fragment by ID
 */
export function getFragmentById(
  fragments: Fragment[],
  fragmentId: FragmentId
): Fragment | undefined {
  return fragments.find((f) => f.id === fragmentId);
}

// ============================================================================
// Explanation Generation
// ============================================================================

/**
 * Generate a natural language summary for a path explanation
 */
export function generatePathSummary(
  path: SemanticPath,
  value: unknown,
  contributingFragments: FragmentId[],
  hasDependencies: boolean
): string {
  const valueStr =
    value === undefined
      ? 'undefined'
      : typeof value === 'object'
        ? JSON.stringify(value).slice(0, 50) + '...'
        : String(value);

  if (!hasDependencies) {
    if (contributingFragments.length === 0) {
      return `${path} = ${valueStr} (source value, no fragments)`;
    }
    return `${path} = ${valueStr} (source value from ${contributingFragments.join(', ')})`;
  }

  return `${path} = ${valueStr} (derived value from ${contributingFragments.join(', ')})`;
}

/**
 * Generate step explanation for NextStep actions
 */
export function generateStepExplanation(
  step: NextStep,
  fragments: Fragment[],
  issues: Issue[],
  conflicts: Conflict[]
): string {
  switch (step.kind) {
    case 'applyPatch':
      return `Apply patch to resolve ${step.resolves}. ${step.rationale}`;
    case 'resolveConflict': {
      const conflict = conflicts.find((c) => c.id === step.conflictId);
      return conflict
        ? `Choose between ${step.candidates.length} fragments for ${conflict.target}. ${step.rationale}`
        : step.rationale;
    }
    case 'fixIssue': {
      const issue = issues.find((i) => i.id === step.issueId);
      return issue
        ? `Fix ${issue.code}: ${issue.message}. ${step.rationale}`
        : step.rationale;
    }
    case 'addFragment':
      return `Add ${step.suggestedKind} to provide ${step.requiredPath}. ${step.rationale}`;
    case 'recompile':
      return `Recompile artifact ${step.artifactId} due to ${step.reason}. ${step.rationale}`;
    case 'reviewDraft':
      return `Review draft at index ${step.draftIndex} (confidence: ${step.confidence}). ${step.rationale}`;
    case 'confirmDomain':
      return `Confirm domain draft with ${step.warningCount} warnings. ${step.rationale}`;
    default:
      return 'Unknown action';
  }
}

/**
 * Estimate impact of a NextStep action
 */
export function estimateStepImpact(
  step: NextStep,
  fragments: Fragment[]
): string[] {
  switch (step.kind) {
    case 'applyPatch':
      return [`Resolves: ${step.resolves}`];
    case 'resolveConflict':
      return [
        `Selects one of ${step.candidates.length} candidates`,
        'May affect downstream derived values',
      ];
    case 'fixIssue':
      return [`Fixes issue: ${step.issueId}`];
    case 'addFragment':
      return [
        `Adds provider for: ${step.requiredPath}`,
        `Unblocks: ${step.requestedBy}`,
      ];
    case 'recompile':
      return [
        `Affects ${step.affectedFragments.length} fragments`,
        'May produce new issues or conflicts',
      ];
    case 'reviewDraft':
      return ['May accept or reject draft', 'Low confidence requires manual review'];
    case 'confirmDomain':
      return ['Finalizes domain', `${step.warningCount} warnings will be accepted`];
    default:
      return [];
  }
}

/**
 * Generate blocker explanation
 */
export function generateBlockerExplanation(
  blocker: Blocker,
  issues: Issue[],
  conflicts: Conflict[]
): string {
  if (blocker.kind === 'issue') {
    const issue = issues.find((i) => i.id === blocker.id);
    if (issue) {
      return `Issue [${issue.code}]: ${issue.message}${issue.path ? ` at ${issue.path}` : ''}`;
    }
  } else if (blocker.kind === 'conflict') {
    const conflict = conflicts.find((c) => c.id === blocker.id);
    if (conflict) {
      return `Conflict on ${conflict.target}: ${conflict.message} (${conflict.candidates.length} candidates)`;
    }
  }
  return blocker.message;
}

/**
 * Generate suggested resolutions for a blocker
 */
export function generateBlockerResolutions(
  blocker: Blocker,
  issues: Issue[],
  conflicts: Conflict[]
): string[] {
  if (blocker.kind === 'issue') {
    const issue = issues.find((i) => i.id === blocker.id);
    if (issue?.suggestedFix) {
      return [`Apply suggested fix: ${issue.suggestedFix.description || 'Automated fix available'}`];
    }
    return ['Manual fix required'];
  } else if (blocker.kind === 'conflict') {
    const conflict = conflicts.find((c) => c.id === blocker.id);
    if (conflict) {
      return conflict.candidates.map(
        (c) => `Choose fragment: ${c}`
      );
    }
  }
  return [];
}

// ============================================================================
// Impact Analysis
// ============================================================================

/**
 * Compute paths that would be affected by a fragment change
 */
export function computeFragmentImpact(
  fragment: Fragment,
  allFragments: Fragment[]
): { direct: SemanticPath[]; transitive: SemanticPath[] } {
  const direct: Set<SemanticPath> = new Set();
  const transitive: Set<SemanticPath> = new Set();
  const visited: Set<FragmentId> = new Set();

  // Direct impact: paths that depend on this fragment's provides
  for (const providedPath of fragment.provides) {
    direct.add(providedPath as SemanticPath);

    // Find fragments that require this path
    const dependents = findFragmentsRequiringPath(allFragments, providedPath as SemanticPath);
    for (const depId of dependents) {
      if (!visited.has(depId)) {
        visited.add(depId);
        const depFragment = getFragmentById(allFragments, depId);
        if (depFragment) {
          for (const depProvides of depFragment.provides) {
            transitive.add(depProvides as SemanticPath);
          }
        }
      }
    }
  }

  return {
    direct: Array.from(direct),
    transitive: Array.from(transitive).filter((p) => !direct.has(p)),
  };
}

/**
 * Find conflicts affected by a fragment change
 */
export function findAffectedConflicts(
  conflicts: Conflict[],
  provides: string[]
): string[] {
  return conflicts
    .filter((c) => provides.includes(c.target))
    .map((c) => c.id);
}

/**
 * Analyze which issues might change if a fragment is modified
 */
export function analyzeIssueImpact(
  issues: Issue[],
  fragment: Fragment,
  affectedPaths: SemanticPath[]
): Array<{
  issueId?: string;
  change: 'resolved' | 'created' | 'modified';
  reason: string;
}> {
  const result: Array<{
    issueId?: string;
    change: 'resolved' | 'created' | 'modified';
    reason: string;
  }> = [];

  for (const issue of issues) {
    // Check if issue is related to this fragment's paths
    if (issue.path && affectedPaths.includes(issue.path as SemanticPath)) {
      if (issue.code === 'MISSING_DEPENDENCY') {
        result.push({
          issueId: issue.id,
          change: 'resolved',
          reason: `Fragment provides ${issue.path}`,
        });
      } else {
        result.push({
          issueId: issue.id,
          change: 'modified',
          reason: `Path ${issue.path} will be affected`,
        });
      }
    }

    // Check if issue references this fragment
    if (issue.relatedFragments?.includes(fragment.id)) {
      result.push({
        issueId: issue.id,
        change: 'modified',
        reason: `Issue directly references this fragment`,
      });
    }
  }

  return result;
}

// ============================================================================
// Issue Explanation
// ============================================================================

/**
 * Build a detailed explanation for an issue
 */
export function buildIssueExplanation(
  issue: Issue,
  fragments: Fragment[]
): IssueExplanation {
  const relatedFragments: IssueExplanation['relatedFragments'] = [];
  const reasoningChain: IssueExplanation['reasoningChain'] = [];

  // Build reasoning chain based on issue code
  switch (issue.code) {
    case 'MISSING_DEPENDENCY':
      reasoningChain.push({
        step: 'A fragment requires a path that is not provided',
        evidence: `Required path: ${issue.path || 'unknown'}`,
      });
      reasoningChain.push({
        step: 'No fragment in the current set provides this path',
        evidence: issue.message,
      });
      break;

    case 'CYCLIC_DEPENDENCY':
      reasoningChain.push({
        step: 'A circular dependency was detected in the fragment graph',
        evidence: issue.message,
      });
      reasoningChain.push({
        step: 'Circular dependencies prevent deterministic evaluation order',
        evidence: 'DAG validation failed',
      });
      break;

    case 'INVALID_PATH':
      reasoningChain.push({
        step: 'A path does not follow the required naming convention',
        evidence: `Invalid path: ${issue.path || 'unknown'}`,
      });
      reasoningChain.push({
        step: 'Paths must start with a valid namespace (data, state, derived, etc.)',
        evidence: issue.message,
      });
      break;

    default:
      reasoningChain.push({
        step: issue.message,
        evidence: issue.code,
      });
  }

  // Find related fragments
  if (issue.relatedFragments) {
    for (const fragId of issue.relatedFragments) {
      const fragment = getFragmentById(fragments, fragId);
      if (fragment) {
        relatedFragments.push({
          fragmentId: fragId,
          role: 'cause',
          explanation: `Fragment ${fragId} (${fragment.kind}) is involved in this issue`,
        });
      }
    }
  }

  // If issue has a path, find fragments that provide or require it
  if (issue.path) {
    const providers = findFragmentsForPath(fragments, issue.path as SemanticPath);
    const requirers = findFragmentsRequiringPath(fragments, issue.path as SemanticPath);

    for (const id of providers) {
      if (!relatedFragments.some((r) => r.fragmentId === id)) {
        relatedFragments.push({
          fragmentId: id,
          role: 'related',
          explanation: `Provides ${issue.path}`,
        });
      }
    }

    for (const id of requirers) {
      if (!relatedFragments.some((r) => r.fragmentId === id)) {
        relatedFragments.push({
          fragmentId: id,
          role: 'affected',
          explanation: `Requires ${issue.path}`,
        });
      }
    }
  }

  // Generate summary
  const summary = `${issue.severity.toUpperCase()}: ${issue.code} - ${issue.message}`;

  return {
    issue,
    reasoningChain,
    relatedFragments,
    suggestedFix: issue.suggestedFix
      ? {
          patch: issue.suggestedFix,
          explanation: issue.suggestedFix.description || 'Apply suggested fix',
          confidence: 0.8,
        }
      : undefined,
    summary,
  };
}

// ============================================================================
// Conflict Explanation
// ============================================================================

/**
 * Build a detailed explanation for a conflict
 */
export function buildConflictExplanation(
  conflict: Conflict,
  fragments: Fragment[]
): ConflictExplanation {
  const candidates: ConflictExplanation['candidates'] = [];
  const resolutionOptions: ConflictExplanation['resolutionOptions'] = [];

  // Build candidate details
  for (const candidateId of conflict.candidates) {
    const fragment = getFragmentById(fragments, candidateId);
    if (fragment) {
      candidates.push({
        fragmentId: candidateId,
        origin: fragment.origin,
        provides: fragment.provides,
        reasoning: `Fragment ${candidateId} provides ${conflict.target}`,
      });

      // Create resolution option
      resolutionOptions.push({
        resolution: {
          description: `Choose ${candidateId} as the provider for ${conflict.target}`,
          fragmentIds: [candidateId],
          patch: {
            op: 'chooseConflict',
            conflictId: conflict.id,
            chosenFragmentId: candidateId,
          } as any,
          confidence: 0.9,
          recommended: conflict.candidates[0] === candidateId,
        },
        explanation: `Use ${fragment.kind} from ${fragment.origin.artifactId}`,
        tradeoffs: [
          `Other candidates will be ignored for ${conflict.target}`,
          `May affect derived values that depend on this path`,
        ],
      });
    }
  }

  // Generate conflict reason
  let conflictReason: string;
  switch (conflict.type) {
    case 'duplicate_provides':
      conflictReason = `Multiple fragments provide the same path: ${conflict.target}`;
      break;
    case 'schema_mismatch':
      conflictReason = `Fragments have incompatible schemas for: ${conflict.target}`;
      break;
    case 'semantic_mismatch':
      conflictReason = `Fragments have different semantic meanings for: ${conflict.target}`;
      break;
    default:
      conflictReason = conflict.message;
  }

  // Generate summary
  const summary = `Conflict on ${conflict.target}: ${conflict.candidates.length} fragments compete to provide this path`;

  return {
    conflict,
    candidates,
    conflictReason,
    resolutionOptions,
    summary,
  };
}

// ============================================================================
// Agent Context
// ============================================================================

/**
 * Compute fragment summary for agent context
 */
export function computeFragmentSummary(fragments: Fragment[]): CompilerAgentContext['fragmentSummary'] {
  const byKind: Record<string, number> = {};
  const byProvenance: Record<string, number> = {};
  const allPaths = new Set<string>();

  for (const fragment of fragments) {
    // Count by kind
    byKind[fragment.kind] = (byKind[fragment.kind] || 0) + 1;

    // Count by provenance
    const provKey = fragment.origin.location.kind;
    byProvenance[provKey] = (byProvenance[provKey] || 0) + 1;

    // Collect paths
    for (const path of fragment.provides) {
      allPaths.add(path);
    }
  }

  return {
    byKind,
    byProvenance,
    totalPaths: allPaths.size,
  };
}

/**
 * Estimate token count for context (rough approximation)
 */
export function estimateContextTokens(
  snapshot: CompilerSessionSnapshot,
  fragments: Fragment[]
): number {
  // Rough estimate: ~4 chars per token
  const snapshotStr = JSON.stringify(snapshot);
  const fragmentsStr = JSON.stringify(fragments.slice(0, 10)); // Sample first 10

  const totalChars = snapshotStr.length + fragmentsStr.length * (fragments.length / 10);
  return Math.ceil(totalChars / 4);
}
