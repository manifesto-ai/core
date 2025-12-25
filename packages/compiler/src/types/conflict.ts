/**
 * Conflict Types - Linker conflict detection
 *
 * Conflicts occur when multiple fragments provide the same target.
 * Conflicts are surfaced explicitly and require resolution.
 *
 * AGENT_README Invariant #6: Conflicts MUST NOT be auto-resolved silently.
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type { FragmentId } from './fragment.js';
import type { PatchHint } from './patch.js';

/** Unique identifier for a conflict */
export type ConflictId = string;

/**
 * Types of conflicts that can occur during linking
 */
export type ConflictType =
  /** Multiple fragments provide the same path/ID */
  | 'duplicate_provides'
  /** Schema types don't match between fragments */
  | 'schema_mismatch'
  /** Semantic metadata conflicts */
  | 'semantic_mismatch'
  /** Effects are incompatible (e.g., different risk levels) */
  | 'incompatible_effect'
  /** Dependencies conflict */
  | 'dependency_conflict'
  /** Unknown conflict type */
  | 'unknown';

/**
 * A conflict detected during linking
 *
 * Conflicts block domain generation until resolved.
 */
export interface Conflict {
  /** Unique conflict identifier */
  id: ConflictId;

  /**
   * Target of the conflict
   * Can be a semantic path (e.g., "derived.total")
   * or a symbolic ID (e.g., "action:checkout")
   */
  target: string;

  /** Type of conflict */
  type: ConflictType;

  /** Fragment IDs that are in conflict */
  candidates: FragmentId[];

  /** Human-readable conflict description */
  message: string;

  /** Suggested ways to resolve the conflict */
  suggestedResolutions?: PatchHint[];

  /** Additional context about the conflict */
  context?: Record<string, unknown>;
}

/**
 * Create a unique conflict ID
 */
export function createConflictId(): ConflictId {
  return `conflict_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a duplicate_provides conflict
 */
export function duplicateProvidesConflict(
  target: string,
  candidates: FragmentId[],
  suggestedResolutions?: PatchHint[]
): Conflict {
  return {
    id: createConflictId(),
    target,
    type: 'duplicate_provides',
    candidates,
    message: `Multiple fragments provide "${target}": ${candidates.join(', ')}`,
    suggestedResolutions,
  };
}

/**
 * Create a schema_mismatch conflict
 */
export function schemaMismatchConflict(
  target: SemanticPath,
  candidates: FragmentId[],
  context?: { expected: string; actual: string }
): Conflict {
  return {
    id: createConflictId(),
    target,
    type: 'schema_mismatch',
    candidates,
    message: context
      ? `Schema mismatch for "${target}": expected ${context.expected}, got ${context.actual}`
      : `Schema mismatch for "${target}"`,
    context,
  };
}

/**
 * Create a semantic_mismatch conflict
 */
export function semanticMismatchConflict(
  target: string,
  candidates: FragmentId[],
  message: string
): Conflict {
  return {
    id: createConflictId(),
    target,
    type: 'semantic_mismatch',
    candidates,
    message,
  };
}

/**
 * Check if a conflict is blocking (prevents domain generation)
 */
export function isBlockingConflict(conflict: Conflict): boolean {
  return (
    conflict.type === 'duplicate_provides' ||
    conflict.type === 'schema_mismatch' ||
    conflict.type === 'dependency_conflict'
  );
}
