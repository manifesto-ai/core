/**
 * Codebook Operations - CRUD for alias entries
 *
 * All operations are deterministic (Principle E).
 * No auto-application of aliases (Principle B).
 *
 * CRITICAL INVARIANTS:
 * - All mutations return NEW codebook instances (immutable)
 * - No auto-resolution of conflicts
 * - Suggestions remain suggestions until explicitly applied via PatchOp
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type { FragmentId } from '../types/fragment.js';
import type { Provenance } from '../types/provenance.js';
import type {
  Codebook,
  CodebookId,
  AliasEntry,
  AliasId,
  AliasStatus,
  AliasSuggestion,
} from '../types/codebook.js';
import { createAliasEntry, createAliasId } from '../types/codebook.js';

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Get alias entry by ID
 */
export function getAliasById(codebook: Codebook, aliasId: AliasId): AliasEntry | undefined {
  return codebook.entries.find((e) => e.id === aliasId);
}

/**
 * Get alias for a specific path (only applied aliases)
 */
export function getAliasForPath(
  codebook: Codebook,
  aliasPath: SemanticPath
): AliasEntry | undefined {
  return codebook.entries.find((e) => e.aliasPath === aliasPath && e.status === 'applied');
}

/**
 * Get canonical path for an alias path
 * Returns the alias path itself if no alias exists
 */
export function resolveToCanonical(codebook: Codebook, path: SemanticPath): SemanticPath {
  const alias = getAliasForPath(codebook, path);
  return alias ? alias.canonicalPath : path;
}

/**
 * Resolve all paths in an array to their canonical forms
 */
export function resolveAllToCanonical(
  codebook: Codebook,
  paths: SemanticPath[]
): SemanticPath[] {
  return paths.map((path) => resolveToCanonical(codebook, path));
}

/**
 * Get all aliases that map to a canonical path
 */
export function getAliasesForCanonical(
  codebook: Codebook,
  canonicalPath: SemanticPath
): AliasEntry[] {
  return codebook.entries.filter(
    (e) => e.canonicalPath === canonicalPath && e.status === 'applied'
  );
}

/**
 * Get aliases by status
 */
export function getAliasesByStatus(codebook: Codebook, status: AliasStatus): AliasEntry[] {
  return codebook.entries.filter((e) => e.status === status);
}

/**
 * Get pending (suggested) aliases
 */
export function getPendingAliases(codebook: Codebook): AliasEntry[] {
  return getAliasesByStatus(codebook, 'suggested');
}

/**
 * Get applied aliases
 */
export function getAppliedAliases(codebook: Codebook): AliasEntry[] {
  return getAliasesByStatus(codebook, 'applied');
}

/**
 * Get rejected aliases
 */
export function getRejectedAliases(codebook: Codebook): AliasEntry[] {
  return getAliasesByStatus(codebook, 'rejected');
}

/**
 * Check if an alias exists for a path
 */
export function hasAliasForPath(codebook: Codebook, aliasPath: SemanticPath): boolean {
  return codebook.entries.some((e) => e.aliasPath === aliasPath && e.status === 'applied');
}

/**
 * Get all canonical paths in the codebook
 */
export function getAllCanonicalPaths(codebook: Codebook): SemanticPath[] {
  const canonicalPaths = new Set<SemanticPath>();
  for (const entry of codebook.entries) {
    if (entry.status === 'applied') {
      canonicalPaths.add(entry.canonicalPath);
    }
  }
  return [...canonicalPaths].sort();
}

// ============================================================================
// Mutation Operations (Pure - return new codebook)
// ============================================================================

/**
 * Add an alias suggestion to the codebook
 * Returns new codebook (immutable)
 */
export function addAliasSuggestion(
  codebook: Codebook,
  suggestion: AliasSuggestion,
  origin: Provenance
): Codebook {
  const entry = createAliasEntry(suggestion.aliasPath, suggestion.canonicalPath, origin, {
    confidence: suggestion.confidence,
    rationale: suggestion.rationale,
    affectedFragments: suggestion.affectedFragments,
  });

  return {
    ...codebook,
    entries: [...codebook.entries, entry],
    version: `v_${Date.now()}`,
    updatedAt: Date.now(),
  };
}

/**
 * Add multiple alias suggestions to the codebook
 * Returns new codebook (immutable)
 */
export function addAliasSuggestions(
  codebook: Codebook,
  suggestions: AliasSuggestion[],
  origin: Provenance
): Codebook {
  let result = codebook;
  for (const suggestion of suggestions) {
    result = addAliasSuggestion(result, suggestion, origin);
  }
  return result;
}

/**
 * Apply an alias (change status from suggested to applied)
 * Returns new codebook (immutable)
 *
 * CRITICAL: This does NOT rename paths in fragments. That must be done
 * by the patch applier using the returned entry information.
 */
export function applyAlias(
  codebook: Codebook,
  aliasId: AliasId
): { codebook: Codebook; entry: AliasEntry | undefined } {
  const entryIndex = codebook.entries.findIndex((e) => e.id === aliasId);

  if (entryIndex === -1) {
    return { codebook, entry: undefined };
  }

  const entry = codebook.entries[entryIndex]!;

  if (entry.status !== 'suggested') {
    return { codebook, entry };
  }

  const updatedEntry: AliasEntry = {
    ...entry,
    status: 'applied',
    resolvedAt: Date.now(),
  };

  const newEntries = [...codebook.entries];
  newEntries[entryIndex] = updatedEntry;

  return {
    codebook: {
      ...codebook,
      entries: newEntries,
      version: `v_${Date.now()}`,
      updatedAt: Date.now(),
    },
    entry: updatedEntry,
  };
}

/**
 * Reject an alias suggestion
 * Returns new codebook (immutable)
 */
export function rejectAlias(
  codebook: Codebook,
  aliasId: AliasId,
  reason?: string
): Codebook {
  const entryIndex = codebook.entries.findIndex((e) => e.id === aliasId);

  if (entryIndex === -1) {
    return codebook;
  }

  const entry = codebook.entries[entryIndex]!;

  const updatedEntry: AliasEntry = {
    ...entry,
    status: 'rejected',
    resolvedAt: Date.now(),
    rationale: reason ? `${entry.rationale} | Rejected: ${reason}` : entry.rationale,
  };

  const newEntries = [...codebook.entries];
  newEntries[entryIndex] = updatedEntry;

  return {
    ...codebook,
    entries: newEntries,
    version: `v_${Date.now()}`,
    updatedAt: Date.now(),
  };
}

/**
 * Remove an alias from the codebook entirely
 * Returns new codebook (immutable)
 */
export function removeAlias(codebook: Codebook, aliasId: AliasId): Codebook {
  return {
    ...codebook,
    entries: codebook.entries.filter((e) => e.id !== aliasId),
    version: `v_${Date.now()}`,
    updatedAt: Date.now(),
  };
}

/**
 * Add a user-defined alias (immediately applied)
 * Returns new codebook (immutable)
 *
 * CRITICAL: This does NOT rename paths in fragments. That must be done
 * by the patch applier.
 */
export function addUserAlias(
  codebook: Codebook,
  aliasPath: SemanticPath,
  canonicalPath: SemanticPath,
  origin: Provenance,
  rationale?: string
): Codebook {
  const entry: AliasEntry = {
    id: createAliasId(),
    aliasPath,
    canonicalPath,
    status: 'applied', // User-defined aliases are immediately applied
    confidence: 1.0, // User intent is always confident
    rationale: rationale ?? 'User-defined alias',
    origin,
    affectedFragments: [],
    createdAt: Date.now(),
    resolvedAt: Date.now(),
  };

  return {
    ...codebook,
    entries: [...codebook.entries, entry],
    version: `v_${Date.now()}`,
    updatedAt: Date.now(),
  };
}

/**
 * Clear all rejected aliases from the codebook
 * Returns new codebook (immutable)
 */
export function clearRejectedAliases(codebook: Codebook): Codebook {
  return {
    ...codebook,
    entries: codebook.entries.filter((e) => e.status !== 'rejected'),
    version: `v_${Date.now()}`,
    updatedAt: Date.now(),
  };
}

/**
 * Clear all pending (suggested) aliases from the codebook
 * Returns new codebook (immutable)
 */
export function clearPendingAliases(codebook: Codebook): Codebook {
  return {
    ...codebook,
    entries: codebook.entries.filter((e) => e.status !== 'suggested'),
    version: `v_${Date.now()}`,
    updatedAt: Date.now(),
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if applying an alias would create a conflict
 */
export function wouldAliasConflict(
  codebook: Codebook,
  aliasPath: SemanticPath,
  canonicalPath: SemanticPath
): boolean {
  // Check for existing alias with same source
  const existingAlias = codebook.entries.find(
    (e) => e.aliasPath === aliasPath && e.status === 'applied'
  );

  if (existingAlias && existingAlias.canonicalPath !== canonicalPath) {
    return true;
  }

  // Check for cycles: canonical -> alias (would create aliasPath -> canonicalPath -> aliasPath)
  const reverseAlias = codebook.entries.find(
    (e) => e.aliasPath === canonicalPath && e.status === 'applied'
  );

  if (reverseAlias) {
    return true;
  }

  // Check for self-reference
  if (aliasPath === canonicalPath) {
    return true;
  }

  return false;
}

/**
 * Get conflicts that would arise from applying an alias
 */
export function getAliasConflicts(
  codebook: Codebook,
  aliasPath: SemanticPath,
  canonicalPath: SemanticPath
): string[] {
  const conflicts: string[] = [];

  // Self-reference
  if (aliasPath === canonicalPath) {
    conflicts.push(`Cannot alias "${aliasPath}" to itself`);
  }

  // Existing alias with different target
  const existingAlias = codebook.entries.find(
    (e) => e.aliasPath === aliasPath && e.status === 'applied'
  );

  if (existingAlias && existingAlias.canonicalPath !== canonicalPath) {
    conflicts.push(
      `Path "${aliasPath}" already aliases to "${existingAlias.canonicalPath}"`
    );
  }

  // Reverse alias (would create cycle)
  const reverseAlias = codebook.entries.find(
    (e) => e.aliasPath === canonicalPath && e.status === 'applied'
  );

  if (reverseAlias) {
    conflicts.push(
      `Cannot alias to "${canonicalPath}" - it's already an alias to "${reverseAlias.canonicalPath}"`
    );
  }

  return conflicts;
}

/**
 * Validate a codebook for consistency
 */
export function validateCodebook(
  codebook: Codebook
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for duplicate alias paths
  const appliedAliases = getAppliedAliases(codebook);
  const aliasPathSet = new Set<SemanticPath>();

  for (const entry of appliedAliases) {
    if (aliasPathSet.has(entry.aliasPath)) {
      errors.push(`Duplicate alias for path "${entry.aliasPath}"`);
    }
    aliasPathSet.add(entry.aliasPath);

    // Check for self-reference
    if (entry.aliasPath === entry.canonicalPath) {
      errors.push(`Self-referential alias for path "${entry.aliasPath}"`);
    }

    // Check for cycles
    if (aliasPathSet.has(entry.canonicalPath)) {
      errors.push(
        `Potential cycle: "${entry.aliasPath}" -> "${entry.canonicalPath}" but "${entry.canonicalPath}" is also an alias`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Sorting (Principle E: Determinism)
// ============================================================================

/**
 * Sort codebook entries deterministically
 */
export function sortCodebookEntries(codebook: Codebook): Codebook {
  const sortedEntries = [...codebook.entries].sort((a, b) => {
    // First by status (applied first, then suggested, then rejected)
    const statusOrder = { applied: 0, suggested: 1, rejected: 2 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;

    // Then by confidence (higher first)
    const confDiff = b.confidence - a.confidence;
    if (confDiff !== 0) return confDiff;

    // Then by aliasPath (alphabetical)
    return a.aliasPath.localeCompare(b.aliasPath);
  });

  return {
    ...codebook,
    entries: sortedEntries,
  };
}

/**
 * Sort aliases by confidence (descending)
 */
export function sortAliasesByConfidence(entries: AliasEntry[]): AliasEntry[] {
  return [...entries].sort((a, b) => {
    const confDiff = b.confidence - a.confidence;
    if (confDiff !== 0) return confDiff;
    return a.aliasPath.localeCompare(b.aliasPath);
  });
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get codebook statistics
 */
export function getCodebookStats(codebook: Codebook): {
  total: number;
  applied: number;
  suggested: number;
  rejected: number;
  uniqueCanonicalPaths: number;
} {
  const applied = codebook.entries.filter((e) => e.status === 'applied').length;
  const suggested = codebook.entries.filter((e) => e.status === 'suggested').length;
  const rejected = codebook.entries.filter((e) => e.status === 'rejected').length;
  const uniqueCanonicalPaths = getAllCanonicalPaths(codebook).length;

  return {
    total: codebook.entries.length,
    applied,
    suggested,
    rejected,
    uniqueCanonicalPaths,
  };
}

export default {
  // Query
  getAliasById,
  getAliasForPath,
  resolveToCanonical,
  resolveAllToCanonical,
  getAliasesForCanonical,
  getAliasesByStatus,
  getPendingAliases,
  getAppliedAliases,
  getRejectedAliases,
  hasAliasForPath,
  getAllCanonicalPaths,
  // Mutation
  addAliasSuggestion,
  addAliasSuggestions,
  applyAlias,
  rejectAlias,
  removeAlias,
  addUserAlias,
  clearRejectedAliases,
  clearPendingAliases,
  // Validation
  wouldAliasConflict,
  getAliasConflicts,
  validateCodebook,
  // Sorting
  sortCodebookEntries,
  sortAliasesByConfidence,
  // Statistics
  getCodebookStats,
};
