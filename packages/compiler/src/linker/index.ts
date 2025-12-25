/**
 * Linker Module - Main Entry Point
 *
 * Orchestrates the linking pipeline:
 * 1. Normalize paths and separate ActionIds (Principle A)
 * 2. Analyze dependencies (Principle D)
 * 3. Detect conflicts (Principle B: no auto-resolution)
 * 4. Merge fragments
 * 5. Build domain (Principle C: Zod directly)
 *
 * All operations are deterministic (Principle E).
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type { Fragment, FragmentId } from '../types/fragment.js';
import type { Conflict } from '../types/conflict.js';
import type { Issue } from '../types/issue.js';
import type { LinkResult, DomainDraft } from '../types/session.js';
import { generateLinkResultVersion } from '../types/session.js';
import type {
  Codebook,
  AliasSuggestion,
  AliasHintConfig,
} from '../types/codebook.js';
import { resolveToCanonical, getAppliedAliases } from '../patch/codebook.js';
import { analyzeForAliases } from '../patch/hint-generator.js';

// Re-export all sub-modules
export * from './normalizer.js';
export * from './deps-analyzer.js';
export * from './conflict-detector.js';
export * from './merger.js';
export * from './domain-builder.js';

// Import for internal use
import {
  normalizeAllFragments,
  sortFragmentsByStableId,
  type NormalizationBatchResult,
} from './normalizer.js';
import {
  buildFragmentDependencyGraph,
  detectCycles,
  analyzeFragmentDeps,
  type FragmentDependencyGraph,
  type CycleDetectionResult,
} from './deps-analyzer.js';
import {
  detectConflicts,
  sortConflicts,
  type ConflictDetectionResult,
} from './conflict-detector.js';
import {
  mergeFragments,
  type MergeStrategy,
  type MergeResult,
} from './merger.js';
import {
  buildDomainDraft,
  type DomainBuildOptions,
  type DomainBuildResult,
} from './domain-builder.js';

// Internal utilities (TRD 1.5)
import {
  sortIssues as internalSortIssues,
  getBlockingIssues as internalGetBlockingIssues,
  hasBlockingIssues as internalHasBlockingIssues,
  getBlockingConflicts as internalGetBlockingConflicts,
  hasBlockingConflicts as internalHasBlockingConflicts,
} from '../internal/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Link options
 */
export interface LinkOptions {
  /** Merge strategy (default: 'union') */
  mergeStrategy?: MergeStrategy;

  /** Sort fragments by stableId for determinism (Principle E, default: true) */
  sortFragments?: boolean;

  /** Sort issues and conflicts for determinism (Principle E, default: true) */
  sortResults?: boolean;

  /** Build domain draft (default: true) */
  buildDomain?: boolean;

  /** Domain build options */
  domainOptions?: DomainBuildOptions;

  /** Report normalization warnings (default: false) */
  reportNormalizationWarnings?: boolean;

  // ========================================================================
  // Codebook Integration (Phase 4)
  // ========================================================================

  /** Codebook for alias resolution (applied aliases are resolved during linking) */
  codebook?: Codebook;

  /** Generate alias suggestions during linking (default: false) */
  generateAliasSuggestions?: boolean;

  /** Alias suggestion configuration */
  aliasConfig?: AliasHintConfig;
}

/**
 * Extended link result with additional analysis data
 */
export interface ExtendedLinkResult extends LinkResult {
  /** Normalization result */
  normalization?: NormalizationBatchResult;

  /** Dependency graph */
  dependencyGraph?: FragmentDependencyGraph;

  /** Cycle detection result */
  cycleDetection?: CycleDetectionResult;

  /** Conflict detection result */
  conflictDetection?: ConflictDetectionResult;

  /** Merge result */
  mergeResult?: MergeResult;

  /** Domain build result */
  domainBuildResult?: DomainBuildResult;

  /** Alias suggestions (when generateAliasSuggestions=true) */
  aliasSuggestions?: AliasSuggestion[];
}

// ============================================================================
// Main Link Function
// ============================================================================

/**
 * Link fragments into a domain (main entry point)
 *
 * This function orchestrates the entire linking pipeline:
 * 1. Normalize all paths and separate ActionIds (Principle A)
 * 2. Build dependency graph and detect cycles (Principle D)
 * 3. Detect conflicts (Principle B: no auto-resolution)
 * 4. Merge compatible fragments
 * 5. Build domain draft (Principle C: Zod directly)
 *
 * All operations are deterministic - same input yields same output (Principle E).
 *
 * @param fragments - Fragments to link
 * @param options - Link options
 * @returns LinkResult
 */
export function link(
  fragments: Fragment[],
  options: LinkOptions = {}
): LinkResult {
  const {
    mergeStrategy = 'union',
    sortFragments = true,
    sortResults = true,
    buildDomain = true,
    domainOptions = {},
    reportNormalizationWarnings = false,
    codebook,
    generateAliasSuggestions = false,
    aliasConfig,
  } = options;

  const issues: Issue[] = [];
  let workingFragments = [...fragments];

  // Step 1: Normalize paths and separate ActionIds (Principle A)
  const normalization = normalizeAllFragments(workingFragments, {
    reportWarnings: reportNormalizationWarnings,
  });
  workingFragments = normalization.fragments;
  issues.push(...normalization.issues);

  // Step 1.5: Apply codebook aliases (resolve alias paths to canonical paths)
  if (codebook) {
    workingFragments = applyCodebookAliases(workingFragments, codebook);
  }

  // Step 2: Sort for determinism (Principle E)
  if (sortFragments) {
    workingFragments = sortFragmentsByStableId(workingFragments);
  }

  // Step 3: Build dependency graph (Principle D)
  const dependencyGraph = buildFragmentDependencyGraph(workingFragments);

  // Step 4: Detect cycles
  const cycleDetection = detectCycles(dependencyGraph);
  issues.push(...cycleDetection.issues);

  // Step 5: Detect conflicts (Principle B: surface all, no auto-resolution)
  const conflictDetection = detectConflicts(workingFragments);
  let conflicts = conflictDetection.allConflicts;

  // Step 6: Merge fragments
  const mergeResult = mergeFragments(workingFragments, {
    strategy: mergeStrategy,
    sortByStableId: sortFragments,
  });
  workingFragments = mergeResult.merged;
  // Conflicts from merge are already detected above, don't duplicate

  // Step 7: Build domain draft (Principle C)
  let domain: DomainDraft | undefined;
  let domainBuildResult: DomainBuildResult | undefined;

  if (buildDomain && !conflictDetection.hasBlockingConflicts && !cycleDetection.hasCycles) {
    domainBuildResult = buildDomainDraft(workingFragments, {
      sortByStableId: sortFragments,
      ...domainOptions,
    });
    domain = domainBuildResult.domain;
    issues.push(...domainBuildResult.issues);
  }

  // Step 8: Sort results for determinism (Principle E)
  if (sortResults) {
    conflicts = sortConflicts(conflicts);
    issues.sort((a, b) => {
      // Sort by severity, then code, then path
      const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2, suggestion: 3 };
      const sevA = severityOrder[a.severity] ?? 4;
      const sevB = severityOrder[b.severity] ?? 4;
      if (sevA !== sevB) return sevA - sevB;

      if (a.code !== b.code) return a.code.localeCompare(b.code);
      if (a.path && b.path) return a.path.localeCompare(b.path);
      return 0;
    });
  }

  // Step 9: Generate alias suggestions (HINT ONLY, never auto-applied)
  const result: LinkResult & { aliasSuggestions?: AliasSuggestion[] } = {
    fragments: workingFragments,
    domain,
    conflicts,
    issues,
    version: generateLinkResultVersion(),
  };

  if (generateAliasSuggestions) {
    const analysisResult = analyzeForAliases(workingFragments, aliasConfig);
    result.aliasSuggestions = analysisResult.suggestions;
  }

  return result;
}

/**
 * Link fragments with extended results
 *
 * Same as link() but returns additional analysis data for debugging/inspection.
 *
 * @param fragments - Fragments to link
 * @param options - Link options
 * @returns ExtendedLinkResult
 */
export function linkExtended(
  fragments: Fragment[],
  options: LinkOptions = {}
): ExtendedLinkResult {
  const {
    mergeStrategy = 'union',
    sortFragments = true,
    sortResults = true,
    buildDomain = true,
    domainOptions = {},
    reportNormalizationWarnings = false,
    codebook,
    generateAliasSuggestions = false,
    aliasConfig,
  } = options;

  const issues: Issue[] = [];
  let workingFragments = [...fragments];

  // Step 1: Normalize
  const normalization = normalizeAllFragments(workingFragments, {
    reportWarnings: reportNormalizationWarnings,
  });
  workingFragments = normalization.fragments;
  issues.push(...normalization.issues);

  // Step 1.5: Apply codebook aliases
  if (codebook) {
    workingFragments = applyCodebookAliases(workingFragments, codebook);
  }

  // Step 2: Sort
  if (sortFragments) {
    workingFragments = sortFragmentsByStableId(workingFragments);
  }

  // Step 3: Dependency graph
  const dependencyGraph = buildFragmentDependencyGraph(workingFragments);

  // Step 4: Cycle detection
  const cycleDetection = detectCycles(dependencyGraph);
  issues.push(...cycleDetection.issues);

  // Step 5: Conflict detection
  const conflictDetection = detectConflicts(workingFragments);
  let conflicts = conflictDetection.allConflicts;

  // Step 6: Merge
  const mergeResult = mergeFragments(workingFragments, {
    strategy: mergeStrategy,
    sortByStableId: sortFragments,
  });
  workingFragments = mergeResult.merged;

  // Step 7: Domain build
  let domain: DomainDraft | undefined;
  let domainBuildResult: DomainBuildResult | undefined;

  if (buildDomain && !conflictDetection.hasBlockingConflicts && !cycleDetection.hasCycles) {
    domainBuildResult = buildDomainDraft(workingFragments, {
      sortByStableId: sortFragments,
      ...domainOptions,
    });
    domain = domainBuildResult.domain;
    issues.push(...domainBuildResult.issues);
  }

  // Step 8: Sort results
  if (sortResults) {
    conflicts = sortConflicts(conflicts);
    issues.sort((a, b) => {
      const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2, suggestion: 3 };
      const sevA = severityOrder[a.severity] ?? 4;
      const sevB = severityOrder[b.severity] ?? 4;
      if (sevA !== sevB) return sevA - sevB;
      if (a.code !== b.code) return a.code.localeCompare(b.code);
      if (a.path && b.path) return a.path.localeCompare(b.path);
      return 0;
    });
  }

  // Step 9: Generate alias suggestions if requested
  let aliasSuggestions: AliasSuggestion[] | undefined;
  if (generateAliasSuggestions) {
    const analysisResult = analyzeForAliases(workingFragments, aliasConfig);
    aliasSuggestions = analysisResult.suggestions;
  }

  return {
    fragments: workingFragments,
    domain,
    conflicts,
    issues,
    version: generateLinkResultVersion(),
    normalization,
    dependencyGraph,
    cycleDetection,
    conflictDetection,
    mergeResult,
    domainBuildResult,
    aliasSuggestions,
  };
}

// ============================================================================
// Incremental Link
// ============================================================================

/**
 * Incrementally link changed fragments
 *
 * This function allows updating a link result without re-processing all fragments.
 *
 * @param previousResult - Previous link result
 * @param changedFragments - New or modified fragments
 * @param removedFragmentIds - IDs of removed fragments
 * @param options - Link options
 * @returns Updated LinkResult
 */
export function incrementalLink(
  previousResult: LinkResult,
  changedFragments: Fragment[],
  removedFragmentIds: FragmentId[],
  options: LinkOptions = {}
): LinkResult {
  // Get existing fragments excluding removed and changed
  const changedIds = new Set(changedFragments.map((f) => f.id));
  const removedIds = new Set(removedFragmentIds);

  const existingFragments = previousResult.fragments.filter(
    (f) => !changedIds.has(f.id) && !removedIds.has(f.id)
  );

  // Combine with changed fragments
  const allFragments = [...existingFragments, ...changedFragments];

  // Re-link
  return link(allFragments, options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sort issues by severity, code, and path (Principle E)
 *
 * @deprecated Use import from '../internal/index.js' directly for new code
 */
export function sortIssues(issues: Issue[]): Issue[] {
  return internalSortIssues(issues);
}

/**
 * Get blocking issues (errors that prevent domain generation)
 */
export function getBlockingIssues(result: LinkResult): Issue[] {
  return result.issues.filter((i) => i.severity === 'error');
}

/**
 * Check if link result is valid (no blocking issues or conflicts)
 */
export function isLinkResultValid(result: LinkResult): boolean {
  return !internalHasBlockingIssues(result.issues) && !internalHasBlockingConflicts(result.conflicts);
}

/**
 * Get summary of link result
 */
export function getLinkResultSummary(result: LinkResult): string {
  const fragmentCount = result.fragments.length;
  const conflictCount = result.conflicts.length;
  const errorCount = result.issues.filter((i) => i.severity === 'error').length;
  const warningCount = result.issues.filter((i) => i.severity === 'warning').length;
  const hasDomain = !!result.domain;

  if (hasDomain && errorCount === 0 && conflictCount === 0) {
    return `Link successful: ${fragmentCount} fragments → domain ready`;
  } else if (conflictCount > 0 || errorCount > 0) {
    return `Link incomplete: ${conflictCount} conflict(s), ${errorCount} error(s), ${warningCount} warning(s)`;
  } else {
    return `Link complete: ${fragmentCount} fragments, ${warningCount} warning(s)`;
  }
}

/**
 * Get all provided paths from link result
 */
export function getAllProvidedPaths(result: LinkResult): Set<SemanticPath> {
  const paths = new Set<SemanticPath>();
  for (const fragment of result.fragments) {
    for (const provide of fragment.provides) {
      if (!provide.startsWith('action:') && !provide.startsWith('effect:')) {
        paths.add(provide as SemanticPath);
      }
    }
  }
  return paths;
}

/**
 * Get all provided action IDs from link result
 */
export function getAllProvidedActions(result: LinkResult): Set<string> {
  const actions = new Set<string>();
  for (const fragment of result.fragments) {
    for (const provide of fragment.provides) {
      if (provide.startsWith('action:')) {
        actions.add(provide.slice(7));
      }
    }
  }
  return actions;
}

// ============================================================================
// Codebook Integration (Phase 4)
// ============================================================================

/**
 * Apply codebook aliases to fragments
 *
 * Resolves alias paths to their canonical forms using applied aliases from the codebook.
 * This is called during linking to ensure all paths use their canonical forms.
 *
 * IMPORTANT: This only resolves 'applied' aliases. Suggested aliases are NOT applied.
 *
 * @param fragments - Fragments to process
 * @param codebook - Codebook with alias entries
 * @returns Fragments with alias paths resolved to canonical paths
 */
export function applyCodebookAliases(fragments: Fragment[], codebook: Codebook): Fragment[] {
  const appliedAliases = getAppliedAliases(codebook);

  // If no applied aliases, return as-is
  if (appliedAliases.length === 0) {
    return fragments;
  }

  return fragments.map((fragment) => {
    let modified = false;
    let updated = { ...fragment };

    // Resolve requires
    const newRequires = fragment.requires.map((req) => {
      const canonical = resolveToCanonical(codebook, req);
      if (canonical !== req) {
        modified = true;
        return canonical;
      }
      return req;
    });

    // Resolve provides (except action: and effect: prefixes)
    const newProvides = fragment.provides.map((prov) => {
      if (prov.startsWith('action:') || prov.startsWith('effect:')) {
        return prov;
      }
      const canonical = resolveToCanonical(codebook, prov as SemanticPath);
      if (canonical !== prov) {
        modified = true;
        return canonical;
      }
      return prov;
    });

    // Resolve path if fragment has it
    let newPath: SemanticPath | undefined;
    if ('path' in fragment && fragment.path) {
      const canonical = resolveToCanonical(codebook, fragment.path as SemanticPath);
      if (canonical !== fragment.path) {
        modified = true;
        newPath = canonical;
      }
    }

    if (modified) {
      updated = {
        ...updated,
        requires: newRequires,
        provides: newProvides,
        ...(newPath && { path: newPath }),
      };
      return updated;
    }

    return fragment;
  });
}

export default {
  link,
  linkExtended,
  incrementalLink,
  sortIssues,
  getBlockingIssues,
  isLinkResultValid,
  getLinkResultSummary,
  getAllProvidedPaths,
  getAllProvidedActions,
};
