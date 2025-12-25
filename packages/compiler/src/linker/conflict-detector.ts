/**
 * Conflict Detector
 *
 * Implements Principle A: ActionId vs SemanticPath must be separated.
 * Implements Principle B: All conflicts must be surfaced as Conflict objects.
 *                         NO automatic conflict resolution.
 *
 * This module detects conflicts during linking:
 * - Duplicate path provides (SemanticPath conflicts)
 * - Duplicate action IDs (ActionId conflicts) - separate handling per Principle A
 * - Schema type mismatches
 * - Semantic metadata mismatches
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type {
  Fragment,
  FragmentId,
  SchemaFragment,
  ActionFragment,
} from '../types/fragment.js';
import type { Conflict, ConflictType } from '../types/conflict.js';
import type { PatchHint } from '../types/patch.js';
import {
  createConflictId,
  duplicateProvidesConflict,
  schemaMismatchConflict,
  semanticMismatchConflict,
} from '../types/conflict.js';

// Internal utilities (TRD 1.5)
import {
  getBlockingConflicts as internalGetBlockingConflicts,
} from '../internal/index.js';
import {
  normalizeFragmentProvides,
  type NormalizedProvides,
} from './normalizer.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of conflict detection (Principle A: separate path vs action conflicts)
 */
export interface ConflictDetectionResult {
  /** Conflicts on SemanticPath (data.*, derived.*, state.*, async.*) */
  pathConflicts: Conflict[];
  /** Conflicts on ActionIds (Principle A: separate handling) */
  actionConflicts: Conflict[];
  /** Schema type mismatches */
  schemaConflicts: Conflict[];
  /** Semantic metadata mismatches */
  semanticConflicts: Conflict[];
  /** All conflicts combined */
  allConflicts: Conflict[];
  /** Whether there are blocking conflicts */
  hasBlockingConflicts: boolean;
}

/**
 * Schema field information for comparison
 */
interface SchemaFieldInfo {
  path: SemanticPath;
  type: string;
  fragmentId: FragmentId;
  semantic?: unknown;
}

// ============================================================================
// Main Detection Functions
// ============================================================================

/**
 * Detect all conflicts in a set of fragments (Principle A & B)
 *
 * This is the main entry point for conflict detection.
 *
 * Principle A: Path conflicts and action conflicts are handled separately
 * Principle B: All conflicts are surfaced, NO auto-resolution
 *
 * @param fragments - Fragments to check for conflicts
 * @returns ConflictDetectionResult with categorized conflicts
 */
export function detectConflicts(fragments: Fragment[]): ConflictDetectionResult {
  // Detect different types of conflicts
  const pathConflicts = detectDuplicatePathProvides(fragments);
  const actionConflicts = detectDuplicateActionIds(fragments);
  const schemaConflicts = detectSchemaMismatches(fragments);
  const semanticConflicts = detectSemanticMismatches(fragments);

  // Combine all conflicts
  const allConflicts = [
    ...pathConflicts,
    ...actionConflicts,
    ...schemaConflicts,
    ...semanticConflicts,
  ];

  // Check for blocking conflicts
  const hasBlockingConflicts = allConflicts.some(
    (c) =>
      c.type === 'duplicate_provides' ||
      c.type === 'schema_mismatch' ||
      c.type === 'dependency_conflict'
  );

  return {
    pathConflicts,
    actionConflicts,
    schemaConflicts,
    semanticConflicts,
    allConflicts,
    hasBlockingConflicts,
  };
}

/**
 * Detect duplicate path provides (SemanticPath only, per Principle A)
 *
 * This checks for multiple fragments providing the same SemanticPath.
 * ActionIds are NOT checked here - see detectDuplicateActionIds().
 *
 * @param fragments - Fragments to check
 * @returns Array of duplicate_provides conflicts for paths
 */
export function detectDuplicatePathProvides(fragments: Fragment[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const pathToFragments = new Map<SemanticPath, FragmentId[]>();

  // Collect all path provides
  for (const fragment of fragments) {
    const normalized = normalizeFragmentProvides(fragment);

    for (const path of normalized.paths) {
      const existing = pathToFragments.get(path) || [];
      existing.push(fragment.id);
      pathToFragments.set(path, existing);
    }
  }

  // Find duplicates
  for (const [path, fragmentIds] of pathToFragments.entries()) {
    if (fragmentIds.length > 1) {
      // Principle B: Surface as Conflict, do NOT auto-resolve
      const hints = suggestDuplicatePathResolutions(path, fragmentIds, fragments);
      conflicts.push(duplicateProvidesConflict(path, fragmentIds, hints));
    }
  }

  return conflicts;
}

/**
 * Detect duplicate action IDs (Principle A: ActionId handled separately)
 *
 * This checks for multiple fragments providing the same actionId.
 * SemanticPaths are NOT checked here - see detectDuplicatePathProvides().
 *
 * @param fragments - Fragments to check
 * @returns Array of duplicate_provides conflicts for actionIds
 */
export function detectDuplicateActionIds(fragments: Fragment[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const actionToFragments = new Map<string, FragmentId[]>();

  // Collect all action provides
  for (const fragment of fragments) {
    const normalized = normalizeFragmentProvides(fragment);

    for (const actionId of normalized.actions) {
      const existing = actionToFragments.get(actionId) || [];
      existing.push(fragment.id);
      actionToFragments.set(actionId, existing);
    }
  }

  // Find duplicates
  for (const [actionId, fragmentIds] of actionToFragments.entries()) {
    if (fragmentIds.length > 1) {
      // Principle B: Surface as Conflict, do NOT auto-resolve
      const hints = suggestDuplicateActionResolutions(actionId, fragmentIds, fragments);
      conflicts.push({
        id: createConflictId(),
        target: `action:${actionId}`,
        type: 'duplicate_provides',
        candidates: fragmentIds,
        message: `Multiple fragments provide action "${actionId}": ${fragmentIds.join(', ')}`,
        suggestedResolutions: hints,
      });
    }
  }

  return conflicts;
}

/**
 * Detect schema type mismatches
 *
 * This checks for the same path being defined with different types
 * across SchemaFragments.
 *
 * @param fragments - Fragments to check
 * @returns Array of schema_mismatch conflicts
 */
export function detectSchemaMismatches(fragments: Fragment[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const pathToTypes = new Map<SemanticPath, SchemaFieldInfo[]>();

  // Collect schema field info
  const schemaFragments = fragments.filter(
    (f): f is SchemaFragment => f.kind === 'SchemaFragment'
  );

  for (const fragment of schemaFragments) {
    for (const field of fragment.fields) {
      const existing = pathToTypes.get(field.path as SemanticPath) || [];
      existing.push({
        path: field.path as SemanticPath,
        type: field.type,
        fragmentId: fragment.id,
        semantic: field.semantic,
      });
      pathToTypes.set(field.path as SemanticPath, existing);
    }
  }

  // Check for type mismatches
  for (const [path, fields] of pathToTypes.entries()) {
    if (fields.length > 1) {
      const types = new Set(fields.map((f) => f.type));
      if (types.size > 1) {
        // Multiple different types for same path
        const fragmentIds = fields.map((f) => f.fragmentId);
        const typeList = fields.map((f) => `${f.fragmentId}: ${f.type}`).join(', ');
        conflicts.push({
          id: createConflictId(),
          target: path,
          type: 'schema_mismatch',
          candidates: fragmentIds,
          message: `Schema type mismatch for "${path}": ${typeList}`,
          context: {
            types: Object.fromEntries(fields.map((f) => [f.fragmentId, f.type])),
          },
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detect semantic metadata mismatches
 *
 * This checks for conflicting semantic descriptions or metadata
 * for the same path/action.
 *
 * @param fragments - Fragments to check
 * @returns Array of semantic_mismatch conflicts
 */
export function detectSemanticMismatches(fragments: Fragment[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const pathToSemantics = new Map<string, Array<{ fragmentId: FragmentId; semantic: unknown }>>();

  for (const fragment of fragments) {
    // Check SchemaFragment fields
    if (fragment.kind === 'SchemaFragment') {
      const schemaFrag = fragment as SchemaFragment;
      for (const field of schemaFrag.fields) {
        if (field.semantic) {
          const key = field.path;
          const existing = pathToSemantics.get(key) || [];
          existing.push({ fragmentId: fragment.id, semantic: field.semantic });
          pathToSemantics.set(key, existing);
        }
      }
    }

    // Check ActionFragment semantics
    if (fragment.kind === 'ActionFragment') {
      const actionFrag = fragment as ActionFragment;
      if (actionFrag.semantic) {
        const key = `action:${actionFrag.actionId}`;
        const existing = pathToSemantics.get(key) || [];
        existing.push({ fragmentId: fragment.id, semantic: actionFrag.semantic });
        pathToSemantics.set(key, existing);
      }
    }
  }

  // Check for semantic mismatches
  for (const [target, semantics] of pathToSemantics.entries()) {
    if (semantics.length > 1) {
      // Check if semantics are different
      const descriptions = semantics.map((s) => {
        if (typeof s.semantic === 'object' && s.semantic !== null) {
          return (s.semantic as Record<string, unknown>).description || JSON.stringify(s.semantic);
        }
        return String(s.semantic);
      });

      const uniqueDescriptions = new Set(descriptions);
      if (uniqueDescriptions.size > 1) {
        const fragmentIds = semantics.map((s) => s.fragmentId);
        conflicts.push(
          semanticMismatchConflict(
            target,
            fragmentIds,
            `Semantic description mismatch for "${target}": different descriptions provided by ${fragmentIds.join(', ')}`
          )
        );
      }
    }
  }

  return conflicts;
}

// ============================================================================
// Resolution Suggestion Functions
// ============================================================================

/**
 * Suggest resolutions for duplicate path conflicts
 *
 * 헌법 제5조: 결정론적 알고리즘으로 생성되는 제안
 *
 * @param path - The conflicting path
 * @param fragmentIds - Fragment IDs in conflict
 * @param fragments - All fragments (for context)
 * @returns Array of PatchHint suggestions with origin: 'deterministic'
 */
export function suggestDuplicatePathResolutions(
  path: SemanticPath,
  fragmentIds: FragmentId[],
  fragments: Fragment[]
): PatchHint[] {
  const hints: PatchHint[] = [];

  // Suggest keeping one and removing others
  for (const keepId of fragmentIds) {
    const removeIds = fragmentIds.filter((id) => id !== keepId);
    hints.push({
      fragmentIds: removeIds,
      suggestion: `Remove path "${path}" from fragments: ${removeIds.join(', ')} (keep ${keepId})`,
      reason: `Resolve duplicate provides by keeping only ${keepId}`,
      operations: removeIds.map((id) => ({
        type: 'remove_provides' as const,
        fragmentId: id,
        path,
      })),
      origin: 'deterministic', // 헌법 제5조
    });
  }

  // Suggest renaming to different paths
  fragmentIds.forEach((fragmentId, i) => {
    const newPath = `${path}_${i + 1}`;
    hints.push({
      fragmentIds: [fragmentId],
      suggestion: `Rename "${path}" to "${newPath}" in fragment ${fragmentId}`,
      reason: 'Resolve duplicate by using unique paths',
      operations: [
        {
          type: 'rename_path' as const,
          fragmentId,
          oldPath: path,
          newPath: newPath as SemanticPath,
        },
      ],
      origin: 'deterministic', // 헌법 제5조
    });
  });

  return hints;
}

/**
 * Suggest resolutions for duplicate action ID conflicts
 *
 * 헌법 제5조: 결정론적 알고리즘으로 생성되는 제안
 *
 * @param actionId - The conflicting action ID
 * @param fragmentIds - Fragment IDs in conflict
 * @param fragments - All fragments (for context)
 * @returns Array of PatchHint suggestions with origin: 'deterministic'
 */
export function suggestDuplicateActionResolutions(
  actionId: string,
  fragmentIds: FragmentId[],
  fragments: Fragment[]
): PatchHint[] {
  const hints: PatchHint[] = [];

  // Suggest keeping one and removing others
  for (const keepId of fragmentIds) {
    const removeIds = fragmentIds.filter((id) => id !== keepId);
    hints.push({
      fragmentIds: removeIds,
      suggestion: `Remove action "${actionId}" from fragments: ${removeIds.join(', ')} (keep ${keepId})`,
      reason: `Resolve duplicate action by keeping only ${keepId}`,
      operations: removeIds.map((id) => ({
        type: 'remove_fragment' as const,
        fragmentId: id,
      })),
      origin: 'deterministic', // 헌법 제5조
    });
  }

  // Suggest renaming to different action IDs
  fragmentIds.forEach((fragmentId, i) => {
    const newActionId = `${actionId}_${i + 1}`;
    hints.push({
      fragmentIds: [fragmentId],
      suggestion: `Rename action "${actionId}" to "${newActionId}" in fragment ${fragmentId}`,
      reason: 'Resolve duplicate by using unique action IDs',
      operations: [
        {
          type: 'rename_action' as const,
          fragmentId,
          oldActionId: actionId,
          newActionId,
        },
      ],
      origin: 'deterministic', // 헌법 제5조
    });
  });

  return hints;
}

/**
 * Suggest resolutions for schema mismatch conflicts
 *
 * 헌법 제5조: 결정론적 알고리즘으로 생성되는 제안
 *
 * @param conflict - The schema mismatch conflict
 * @param fragments - All fragments (for context)
 * @returns Array of PatchHint suggestions with origin: 'deterministic'
 */
export function suggestSchemaMismatchResolutions(
  conflict: Conflict,
  fragments: Fragment[]
): PatchHint[] {
  const hints: PatchHint[] = [];
  const types = conflict.context?.types as Record<FragmentId, string> | undefined;

  if (types) {
    // Suggest unifying to each type
    const uniqueTypes = [...new Set(Object.values(types))];
    for (const targetType of uniqueTypes) {
      const fragmentsToChange = Object.entries(types)
        .filter(([_, type]) => type !== targetType)
        .map(([id]) => id);

      if (fragmentsToChange.length > 0) {
        hints.push({
          fragmentIds: fragmentsToChange,
          suggestion: `Change type to "${targetType}" in fragments: ${fragmentsToChange.join(', ')}`,
          reason: `Unify schema type to ${targetType}`,
          operations: fragmentsToChange.map((id) => ({
            type: 'change_type' as const,
            fragmentId: id,
            path: conflict.target as SemanticPath,
            newType: targetType,
          })),
          origin: 'deterministic', // 헌법 제5조
        });
      }
    }
  }

  return hints;
}

/**
 * Suggest resolutions for any conflict
 *
 * 헌법 제5조: 결정론적 알고리즘으로 생성되는 제안
 *
 * @param conflict - The conflict to suggest resolutions for
 * @param fragments - All fragments (for context)
 * @returns Array of PatchHint suggestions with origin: 'deterministic'
 */
export function suggestConflictResolutions(
  conflict: Conflict,
  fragments: Fragment[]
): PatchHint[] {
  switch (conflict.type) {
    case 'duplicate_provides':
      if (conflict.target.startsWith('action:')) {
        return suggestDuplicateActionResolutions(
          conflict.target.slice(7),
          conflict.candidates,
          fragments
        );
      } else {
        return suggestDuplicatePathResolutions(
          conflict.target as SemanticPath,
          conflict.candidates,
          fragments
        );
      }

    case 'schema_mismatch':
      return suggestSchemaMismatchResolutions(conflict, fragments);

    case 'semantic_mismatch':
      // Semantic mismatches are informational - suggest manual review
      return [
        {
          fragmentIds: conflict.candidates,
          suggestion: 'Review and unify semantic descriptions manually',
          reason: 'Semantic descriptions should be consistent',
          operations: [],
          origin: 'deterministic', // 헌법 제5조
        },
      ];

    default:
      return [];
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Filter conflicts by type
 */
export function filterConflictsByType(
  conflicts: Conflict[],
  type: ConflictType
): Conflict[] {
  return conflicts.filter((c) => c.type === type);
}

/**
 * Get all blocking conflicts (those that prevent domain generation)
 *
 * @deprecated Use import from '../internal/index.js' directly for new code
 */
export function getBlockingConflicts(conflicts: Conflict[]): Conflict[] {
  return internalGetBlockingConflicts(conflicts);
}

/**
 * Get all non-blocking conflicts (warnings/info)
 */
export function getNonBlockingConflicts(conflicts: Conflict[]): Conflict[] {
  return conflicts.filter(
    (c) =>
      c.type !== 'duplicate_provides' &&
      c.type !== 'schema_mismatch' &&
      c.type !== 'dependency_conflict'
  );
}

/**
 * Check if a specific path has conflicts
 */
export function hasPathConflict(
  path: SemanticPath,
  result: ConflictDetectionResult
): boolean {
  return result.pathConflicts.some((c) => c.target === path);
}

/**
 * Check if a specific action ID has conflicts
 */
export function hasActionConflict(
  actionId: string,
  result: ConflictDetectionResult
): boolean {
  return result.actionConflicts.some((c) => c.target === `action:${actionId}`);
}

/**
 * Get conflict for a specific target (path or action)
 */
export function getConflictForTarget(
  target: string,
  result: ConflictDetectionResult
): Conflict | undefined {
  return result.allConflicts.find((c) => c.target === target);
}

/**
 * Sort conflicts deterministically (Principle E)
 *
 * Sorts by: (type, target, candidates joined)
 */
export function sortConflicts(conflicts: Conflict[]): Conflict[] {
  return [...conflicts].sort((a, b) => {
    // First by type
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    // Then by target
    if (a.target !== b.target) {
      return a.target.localeCompare(b.target);
    }
    // Finally by candidates
    return a.candidates.join(',').localeCompare(b.candidates.join(','));
  });
}

export default {
  detectConflicts,
  detectDuplicatePathProvides,
  detectDuplicateActionIds,
  detectSchemaMismatches,
  detectSemanticMismatches,
  suggestDuplicatePathResolutions,
  suggestDuplicateActionResolutions,
  suggestSchemaMismatchResolutions,
  suggestConflictResolutions,
  filterConflictsByType,
  getBlockingConflicts,
  getNonBlockingConflicts,
  hasPathConflict,
  hasActionConflict,
  getConflictForTarget,
  sortConflicts,
};
