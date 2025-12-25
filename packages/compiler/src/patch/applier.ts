/**
 * Patch Applier - Main Entry Point
 *
 * Orchestrates patch application using specialized handlers from ops/.
 * All operations are deterministic (Principle E).
 *
 * CRITICAL INVARIANTS:
 * - All mutations return NEW arrays/objects (immutable)
 * - Alias operations update BOTH codebook AND fragments
 * - All operations return Result<T, CompilerError>
 *
 * Manifesto Philosophy:
 * "실패는 예외가 아니라, 처리되어야 할 데이터다."
 */

import type { Fragment } from '../types/fragment.js';
import type { Patch, PatchOp, ApplyPatchResult } from '../types/patch.js';
import type { Codebook } from '../types/codebook.js';
import { isOk, getErrorMessage, unknownOperation, err } from '../types/index.js';

// Import all handlers from ops/
import {
  applyReplaceExpr,
  applyAddDep,
  applyRemoveDep,
  applyRenamePath,
  applyRemoveFragment,
  applyChooseConflict,
  applyUpdateSchemaField,
  applyAddFragment,
  applyUpdateFragmentMeta,
  applyReplaceEvidence,
  applyAliasOp,
  rejectAliasOp,
  addAliasOp,
  removeAliasOp,
  type PatchOpSuccess,
  type PatchOpResult,
} from './ops/index.js';

// Import preview
import { previewPatch, type PatchPreviewResult } from './preview.js';

// ============================================================================
// Re-exports for backward compatibility
// ============================================================================

export type { PatchOpSuccess, PatchOpResult } from './ops/index.js';
export type { PatchPreviewResult } from './preview.js';
export { previewPatch } from './preview.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Extended apply result including codebook
 */
export interface ApplyPatchResultWithCodebook extends ApplyPatchResult {
  codebook?: Codebook;
}

// ============================================================================
// Main Apply Functions
// ============================================================================

/**
 * Apply a patch to fragments
 *
 * Applies all operations in order. Failed operations are collected
 * but don't stop subsequent operations.
 *
 * @param fragments - Current fragments
 * @param patch - Patch to apply
 * @param codebook - Optional codebook for alias operations
 * @returns Result with updated fragments, codebook, and status
 */
export function applyPatch(
  fragments: Fragment[],
  patch: Patch,
  codebook?: Codebook
): ApplyPatchResultWithCodebook {
  let currentFragments = [...fragments];
  let currentCodebook = codebook;
  const applied: PatchOp[] = [];
  const failed: Array<{ op: PatchOp; reason: string }> = [];

  for (const op of patch.ops) {
    const result = applyPatchOp(currentFragments, op, currentCodebook);

    if (isOk(result)) {
      currentFragments = result.value.fragments;
      if (result.value.codebook) {
        currentCodebook = result.value.codebook;
      }
      applied.push(op);
    } else {
      failed.push({ op, reason: getErrorMessage(result.error) });
    }
  }

  return {
    ok: failed.length === 0,
    fragments: currentFragments,
    codebook: currentCodebook,
    applied,
    failed,
  };
}

/**
 * Apply a single PatchOp
 *
 * @param fragments - Current fragments
 * @param op - Operation to apply
 * @param codebook - Optional codebook for alias operations
 * @returns Result with updated fragments and/or codebook
 */
export function applyPatchOp(
  fragments: Fragment[],
  op: PatchOp,
  codebook?: Codebook
): PatchOpResult {
  switch (op.op) {
    case 'replaceExpr':
      return applyReplaceExpr(fragments, op.fragmentId, op.newExpr);

    case 'addDep':
      return applyAddDep(fragments, op.derivedPath, op.dep);

    case 'removeDep':
      return applyRemoveDep(fragments, op.derivedPath, op.dep);

    case 'renamePath':
      return applyRenamePath(fragments, op.from, op.to);

    case 'removeFragment':
      return applyRemoveFragment(fragments, op.fragmentId);

    case 'chooseConflict':
      return applyChooseConflict(fragments, op.conflictId, op.chosenFragmentId);

    case 'updateSchemaField':
      return applyUpdateSchemaField(fragments, op.path, op.update);

    case 'addFragment':
      return applyAddFragment(fragments, op.fragment);

    case 'updateFragmentMeta':
      return applyUpdateFragmentMeta(fragments, op.fragmentId, op.update);

    case 'replaceEvidence':
      return applyReplaceEvidence(fragments, op.fragmentId, op.evidence);

    // Alias operations
    case 'applyAlias':
      return applyAliasOp(fragments, op.aliasId, op.codebookId, codebook);

    case 'rejectAlias':
      return rejectAliasOp(fragments, op.aliasId, op.codebookId, op.reason, codebook);

    case 'addAlias':
      return addAliasOp(
        fragments,
        op.aliasPath,
        op.canonicalPath,
        op.codebookId,
        op.rationale,
        codebook
      );

    case 'removeAlias':
      return removeAliasOp(fragments, op.aliasId, op.codebookId, codebook);

    default:
      return err(unknownOperation((op as PatchOp).op));
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Apply multiple patches in sequence
 */
export function applyPatches(
  fragments: Fragment[],
  patches: Patch[],
  codebook?: Codebook
): ApplyPatchResultWithCodebook {
  let currentFragments = fragments;
  let currentCodebook = codebook;
  const applied: PatchOp[] = [];
  const failed: Array<{ op: PatchOp; reason: string }> = [];

  for (const patch of patches) {
    const result = applyPatch(currentFragments, patch, currentCodebook);
    currentFragments = result.fragments;
    currentCodebook = result.codebook;
    applied.push(...result.applied);
    failed.push(...result.failed);
  }

  return {
    ok: failed.length === 0,
    fragments: currentFragments,
    codebook: currentCodebook,
    applied,
    failed,
  };
}
