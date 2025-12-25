/**
 * Fragment Merger
 *
 * Implements Principle B: Merger is ASSEMBLY ONLY, NO conflict resolution.
 *
 * This module merges compatible fragments that have different provides.
 * If fragments have overlapping provides, a Conflict is surfaced (NOT auto-resolved).
 *
 * Key invariant: `override` strategy is NOT supported - that would be auto-resolution.
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type {
  Fragment,
  FragmentId,
  SchemaFragment,
  SourceFragment,
  DerivedFragment,
  ActionFragment,
  EffectFragment,
  PolicyFragment,
} from '../types/fragment.js';
import type { Conflict } from '../types/conflict.js';
import type { PatchHint } from '../types/patch.js';
import {
  detectConflicts,
  detectDuplicatePathProvides,
  detectDuplicateActionIds,
  type ConflictDetectionResult,
} from './conflict-detector.js';
import {
  normalizeFragmentProvides,
  sortFragmentsByStableId,
} from './normalizer.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Merge strategy (Principle B: NO 'override' - that's auto-resolution)
 *
 * - 'union': Combine all fragments, surface conflicts for duplicates
 * - 'fail': Fail immediately on any conflict
 * - 'manual': Same as union, but with more detailed hints for manual resolution
 */
export type MergeStrategy = 'union' | 'fail' | 'manual';

/**
 * Merge configuration
 */
export interface MergeConfig {
  /** Merge strategy (default: 'union') */
  strategy?: MergeStrategy;
  /** Whether to sort fragments by stableId (Principle E: determinism) */
  sortByStableId?: boolean;
  /** Whether to merge schema fields into consolidated SchemaFragments */
  consolidateSchemas?: boolean;
}

/**
 * Result of merging fragments (Principle B: conflicts surfaced, NOT resolved)
 */
export interface MergeResult {
  /** Successfully merged fragments */
  merged: Fragment[];
  /** Conflicts detected during merge (NOT auto-resolved) */
  conflicts: Conflict[];
  /** Hints for manual resolution */
  patchHints: PatchHint[];
  /** Whether the merge succeeded (no blocking conflicts) */
  success: boolean;
  /** Statistics about the merge */
  stats: MergeStats;
}

/**
 * Merge statistics
 */
export interface MergeStats {
  /** Total input fragments */
  inputCount: number;
  /** Total output fragments */
  outputCount: number;
  /** Number of conflicts detected */
  conflictCount: number;
  /** Number of schemas consolidated */
  schemasConsolidated: number;
}

// ============================================================================
// Main Merge Functions
// ============================================================================

/**
 * Merge fragments (Principle B: assembly only, NO auto-resolution)
 *
 * This function combines fragments that have different provides.
 * Conflicts are surfaced as Conflict objects, NOT automatically resolved.
 *
 * @param fragments - Fragments to merge
 * @param config - Merge configuration
 * @returns MergeResult with merged fragments and conflicts
 */
export function mergeFragments(
  fragments: Fragment[],
  config: MergeConfig = {}
): MergeResult {
  const {
    strategy = 'union',
    sortByStableId = true,
    consolidateSchemas = false,
  } = config;

  // Sort for determinism (Principle E)
  let workingFragments = sortByStableId
    ? sortFragmentsByStableId(fragments)
    : [...fragments];

  // Detect conflicts
  const conflictResult = detectConflicts(workingFragments);

  // Handle 'fail' strategy
  if (strategy === 'fail' && conflictResult.hasBlockingConflicts) {
    return {
      merged: [],
      conflicts: conflictResult.allConflicts,
      patchHints: [],
      success: false,
      stats: {
        inputCount: fragments.length,
        outputCount: 0,
        conflictCount: conflictResult.allConflicts.length,
        schemasConsolidated: 0,
      },
    };
  }

  // Optionally consolidate schemas
  let schemasConsolidated = 0;
  if (consolidateSchemas && !conflictResult.hasBlockingConflicts) {
    const consolidation = consolidateSchemaFragments(workingFragments);
    workingFragments = consolidation.fragments;
    schemasConsolidated = consolidation.consolidatedCount;
  }

  // Generate patch hints for conflicts
  const patchHints = generateMergeHints(conflictResult, workingFragments, strategy);

  // For 'union' and 'manual' strategies, return all fragments with conflicts
  return {
    merged: workingFragments,
    conflicts: conflictResult.allConflicts,
    patchHints,
    success: !conflictResult.hasBlockingConflicts,
    stats: {
      inputCount: fragments.length,
      outputCount: workingFragments.length,
      conflictCount: conflictResult.allConflicts.length,
      schemasConsolidated,
    },
  };
}

/**
 * Check if two fragments can be merged (have different provides)
 *
 * Per Principle B: Fragments with overlapping provides CANNOT be merged.
 * They must remain separate with a Conflict surfaced.
 *
 * @param a - First fragment
 * @param b - Second fragment
 * @returns true if fragments have no overlapping provides
 */
export function canMerge(a: Fragment, b: Fragment): boolean {
  const normalizedA = normalizeFragmentProvides(a);
  const normalizedB = normalizeFragmentProvides(b);

  // Check for overlapping paths
  const pathsA = new Set(normalizedA.paths);
  for (const path of normalizedB.paths) {
    if (pathsA.has(path)) {
      return false; // Overlapping path
    }
  }

  // Check for overlapping actions
  const actionsA = new Set(normalizedA.actions);
  for (const action of normalizedB.actions) {
    if (actionsA.has(action)) {
      return false; // Overlapping action
    }
  }

  return true;
}

/**
 * Check if a fragment can be merged into a set of fragments
 *
 * @param fragment - Fragment to check
 * @param existing - Existing fragments
 * @returns true if fragment doesn't conflict with any existing fragment
 */
export function canMergeInto(fragment: Fragment, existing: Fragment[]): boolean {
  for (const ex of existing) {
    if (!canMerge(fragment, ex)) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// Schema Consolidation
// ============================================================================

/**
 * Consolidate multiple SchemaFragments into fewer fragments
 *
 * This combines SchemaFragments that define fields in the same namespace.
 * Only consolidates when there are no conflicts.
 *
 * @param fragments - All fragments
 * @returns Consolidated fragments
 */
export function consolidateSchemaFragments(fragments: Fragment[]): {
  fragments: Fragment[];
  consolidatedCount: number;
} {
  const schemaFragments = fragments.filter(
    (f): f is SchemaFragment => f.kind === 'SchemaFragment'
  );
  const otherFragments = fragments.filter((f) => f.kind !== 'SchemaFragment');

  if (schemaFragments.length <= 1) {
    return { fragments, consolidatedCount: 0 };
  }

  // Group schemas by namespace
  const byNamespace = new Map<string, SchemaFragment[]>();
  for (const schema of schemaFragments) {
    const ns = schema.namespace;
    const existing = byNamespace.get(ns) || [];
    existing.push(schema);
    byNamespace.set(ns, existing);
  }

  // Check for conflicts within each namespace
  const consolidatedSchemas: SchemaFragment[] = [];
  let consolidatedCount = 0;

  for (const [namespace, schemas] of byNamespace.entries()) {
    const firstSchema = schemas[0];
    if (!firstSchema) continue;

    if (schemas.length === 1) {
      consolidatedSchemas.push(firstSchema);
      continue;
    }

    // Check for field conflicts
    const fieldPaths = new Map<string, SchemaFragment>();
    let hasConflict = false;

    for (const schema of schemas) {
      for (const field of schema.fields) {
        if (fieldPaths.has(field.path)) {
          hasConflict = true;
          break;
        }
        fieldPaths.set(field.path, schema);
      }
      if (hasConflict) break;
    }

    if (hasConflict) {
      // Can't consolidate - keep separate
      consolidatedSchemas.push(...schemas);
    } else {
      // Consolidate into single schema
      const consolidated = consolidateSchemasInNamespace(schemas, namespace);
      consolidatedSchemas.push(consolidated);
      consolidatedCount += schemas.length - 1;
    }
  }

  return {
    fragments: [...consolidatedSchemas, ...otherFragments],
    consolidatedCount,
  };
}

/**
 * Consolidate schemas within a single namespace
 */
function consolidateSchemasInNamespace(
  schemas: SchemaFragment[],
  namespace: string
): SchemaFragment {
  // Use first schema as base
  const base = schemas[0];
  if (!base) {
    throw new Error('Cannot consolidate empty schema array');
  }

  // Collect all fields
  const allFields = schemas.flatMap((s) => s.fields);

  // Collect all provides
  const allProvides = [...new Set(schemas.flatMap((s) => s.provides))];

  // Collect all evidence
  const allEvidence = schemas.flatMap((s) => s.evidence || []);

  return {
    ...base,
    kind: 'SchemaFragment' as const,
    id: `consolidated-${namespace}-${Date.now()}`,
    fields: allFields,
    provides: allProvides,
    evidence: allEvidence,
  };
}

// ============================================================================
// Merge Hint Generation
// ============================================================================

/**
 * Generate patch hints for conflicts
 */
function generateMergeHints(
  conflictResult: ConflictDetectionResult,
  fragments: Fragment[],
  strategy: MergeStrategy
): PatchHint[] {
  const hints: PatchHint[] = [];

  // For path conflicts
  for (const conflict of conflictResult.pathConflicts) {
    if (conflict.suggestedResolutions) {
      hints.push(...conflict.suggestedResolutions);
    }
  }

  // For action conflicts
  for (const conflict of conflictResult.actionConflicts) {
    if (conflict.suggestedResolutions) {
      hints.push(...conflict.suggestedResolutions);
    }
  }

  // For schema conflicts
  for (const conflict of conflictResult.schemaConflicts) {
    hints.push({
      fragmentIds: conflict.candidates,
      suggestion: `Resolve schema type mismatch for "${conflict.target}"`,
      reason: conflict.message,
      operations: [],
    });
  }

  // For 'manual' strategy, add more detailed hints
  if (strategy === 'manual') {
    for (const conflict of conflictResult.allConflicts) {
      hints.push({
        fragmentIds: conflict.candidates,
        suggestion: `[MANUAL] Review and resolve conflict for "${conflict.target}"`,
        reason: `Conflict type: ${conflict.type}. ${conflict.message}`,
        operations: [],
      });
    }
  }

  return hints;
}

// ============================================================================
// Incremental Merge
// ============================================================================

/**
 * Incrementally merge a new fragment into existing fragments
 *
 * @param existing - Existing merged fragments
 * @param newFragment - New fragment to add
 * @param config - Merge configuration
 * @returns Updated MergeResult
 */
export function incrementalMerge(
  existing: Fragment[],
  newFragment: Fragment,
  config: MergeConfig = {}
): MergeResult {
  // Check if new fragment can be merged
  if (canMergeInto(newFragment, existing)) {
    // No conflicts - add to existing
    return {
      merged: [...existing, newFragment],
      conflicts: [],
      patchHints: [],
      success: true,
      stats: {
        inputCount: existing.length + 1,
        outputCount: existing.length + 1,
        conflictCount: 0,
        schemasConsolidated: 0,
      },
    };
  }

  // Has conflicts - use full merge
  return mergeFragments([...existing, newFragment], config);
}

/**
 * Incrementally remove a fragment from existing fragments
 *
 * @param existing - Existing merged fragments
 * @param fragmentId - ID of fragment to remove
 * @returns Updated fragments
 */
export function removeFragment(
  existing: Fragment[],
  fragmentId: FragmentId
): Fragment[] {
  return existing.filter((f) => f.id !== fragmentId);
}

// ============================================================================
// Fragment Grouping
// ============================================================================

/**
 * Group fragments by their kind
 */
export function groupFragmentsByKind(
  fragments: Fragment[]
): Map<string, Fragment[]> {
  const groups = new Map<string, Fragment[]>();

  for (const fragment of fragments) {
    const existing = groups.get(fragment.kind) || [];
    existing.push(fragment);
    groups.set(fragment.kind, existing);
  }

  return groups;
}

/**
 * Group fragments by the path they provide
 */
export function groupFragmentsByProvides(
  fragments: Fragment[]
): Map<string, Fragment[]> {
  const groups = new Map<string, Fragment[]>();

  for (const fragment of fragments) {
    for (const provide of fragment.provides) {
      const existing = groups.get(provide) || [];
      existing.push(fragment);
      groups.set(provide, existing);
    }
  }

  return groups;
}

/**
 * Get fragments that provide a specific path
 */
export function getProvidersForPath(
  path: SemanticPath,
  fragments: Fragment[]
): Fragment[] {
  return fragments.filter((f) =>
    f.provides.some((p) => p === path || p === `action:${path}`)
  );
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that merge result has no blocking conflicts
 */
export function validateMergeResult(result: MergeResult): boolean {
  return result.success && result.conflicts.length === 0;
}

/**
 * Get summary of merge result
 */
export function getMergeSummary(result: MergeResult): string {
  if (result.success) {
    return `Merge successful: ${result.stats.inputCount} input → ${result.stats.outputCount} output fragments`;
  } else {
    return `Merge has conflicts: ${result.stats.conflictCount} conflict(s) require resolution`;
  }
}

export default {
  mergeFragments,
  canMerge,
  canMergeInto,
  consolidateSchemaFragments,
  incrementalMerge,
  removeFragment,
  groupFragmentsByKind,
  groupFragmentsByProvides,
  getProvidersForPath,
  validateMergeResult,
  getMergeSummary,
};
