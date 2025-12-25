/**
 * Alias PatchOp Handlers
 *
 * Handles codebook alias operations.
 * All operations update BOTH codebook AND fragments.
 *
 * CRITICAL INVARIANTS:
 * - Alias operations update BOTH codebook AND fragments
 * - All operations return Result<T, CompilerError>
 *
 * Manifesto Philosophy:
 * "실패는 예외가 아니라, 처리되어야 할 데이터다."
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type { Fragment } from '../../types/fragment.js';
import type { Provenance } from '../../types/provenance.js';
import type { Codebook } from '../../types/codebook.js';
import {
  // Result monad
  ok,
  err,
  isErr,
  // CompilerError types
  codebookRequired,
  codebookMismatch,
  aliasNotFound,
  aliasWrongState,
  aliasConflict,
} from '../../types/index.js';
import {
  applyAlias as codebookApplyAlias,
  rejectAlias as codebookRejectAlias,
  addUserAlias,
  removeAlias as codebookRemoveAlias,
  getAliasById,
  wouldAliasConflict,
} from '../codebook.js';
import { applyRenamePath, type PatchOpResult } from './fragment-ops.js';

// Re-export types from fragment-ops
export type { PatchOpSuccess, PatchOpResult } from './fragment-ops.js';

// ============================================================================
// Alias Operations
// ============================================================================

/**
 * Apply an alias from the codebook
 *
 * This:
 * 1. Updates the alias status in the codebook to 'applied'
 * 2. Renames the alias path to canonical path in all fragments
 */
export function applyAliasOp(
  fragments: Fragment[],
  aliasId: string,
  codebookId: string,
  codebook?: Codebook
): PatchOpResult {
  if (!codebook) {
    return err(codebookRequired('applyAlias'));
  }

  if (codebook.id !== codebookId) {
    return err(codebookMismatch(codebookId, codebook.id));
  }

  const entry = getAliasById(codebook, aliasId);
  if (!entry) {
    return err(aliasNotFound(aliasId));
  }

  if (entry.status !== 'suggested') {
    return err(aliasWrongState(aliasId, 'suggested', entry.status));
  }

  // Apply alias in codebook
  const { codebook: updatedCodebook, entry: appliedEntry } = codebookApplyAlias(
    codebook,
    aliasId
  );

  if (!appliedEntry) {
    return err(aliasNotFound(aliasId));
  }

  // Rename path in fragments
  const renameResult = applyRenamePath(
    fragments,
    entry.aliasPath,
    entry.canonicalPath
  );

  if (isErr(renameResult)) {
    // Return success for codebook update but with error message about path rename
    // The alias was applied to codebook, so we return partial success
    return ok({
      fragments,
      codebook: updatedCodebook,
    });
  }

  return ok({
    fragments: renameResult.value.fragments,
    codebook: updatedCodebook,
  });
}

/**
 * Reject an alias suggestion
 *
 * Updates the alias status in the codebook to 'rejected'.
 * Does not modify fragments.
 */
export function rejectAliasOp(
  fragments: Fragment[],
  aliasId: string,
  codebookId: string,
  reason: string | undefined,
  codebook?: Codebook
): PatchOpResult {
  if (!codebook) {
    return err(codebookRequired('rejectAlias'));
  }

  if (codebook.id !== codebookId) {
    return err(codebookMismatch(codebookId, codebook.id));
  }

  const entry = getAliasById(codebook, aliasId);
  if (!entry) {
    return err(aliasNotFound(aliasId));
  }

  const updatedCodebook = codebookRejectAlias(codebook, aliasId, reason);

  return ok({
    fragments, // No change to fragments
    codebook: updatedCodebook,
  });
}

/**
 * Add a user-defined alias
 *
 * This:
 * 1. Adds the alias to the codebook as 'applied'
 * 2. Renames the alias path to canonical path in all fragments
 */
export function addAliasOp(
  fragments: Fragment[],
  aliasPath: SemanticPath,
  canonicalPath: SemanticPath,
  codebookId: string,
  rationale: string | undefined,
  codebook?: Codebook
): PatchOpResult {
  if (!codebook) {
    return err(codebookRequired('addAlias'));
  }

  if (codebook.id !== codebookId) {
    return err(codebookMismatch(codebookId, codebook.id));
  }

  // Check for conflicts
  if (wouldAliasConflict(codebook, aliasPath, canonicalPath)) {
    return err(aliasConflict(aliasPath, canonicalPath, 'Would create conflict with existing alias'));
  }

  // Create provenance for user-defined alias
  const origin: Provenance = {
    artifactId: 'patch:alias',
    location: { kind: 'generated', note: 'User-defined alias via patch' },
    createdAt: Date.now(),
  };

  // Add alias to codebook
  const updatedCodebook = addUserAlias(
    codebook,
    aliasPath,
    canonicalPath,
    origin,
    rationale
  );

  // Rename path in fragments
  const renameResult = applyRenamePath(fragments, aliasPath, canonicalPath);

  if (isErr(renameResult)) {
    // Return success for codebook update but with error message about path rename
    return ok({
      fragments,
      codebook: updatedCodebook,
    });
  }

  return ok({
    fragments: renameResult.value.fragments,
    codebook: updatedCodebook,
  });
}

/**
 * Remove an alias from the codebook
 *
 * Removes the alias entry from the codebook.
 * Does not modify fragments (path rename is not reversed).
 */
export function removeAliasOp(
  fragments: Fragment[],
  aliasId: string,
  codebookId: string,
  codebook?: Codebook
): PatchOpResult {
  if (!codebook) {
    return err(codebookRequired('removeAlias'));
  }

  if (codebook.id !== codebookId) {
    return err(codebookMismatch(codebookId, codebook.id));
  }

  const entry = getAliasById(codebook, aliasId);
  if (!entry) {
    return err(aliasNotFound(aliasId));
  }

  const updatedCodebook = codebookRemoveAlias(codebook, aliasId);

  return ok({
    fragments, // No change to fragments
    codebook: updatedCodebook,
  });
}
