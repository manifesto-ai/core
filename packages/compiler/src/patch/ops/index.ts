/**
 * PatchOp Handlers - All operation implementations
 *
 * This module re-exports all PatchOp handlers for use by the applier.
 */

// Fragment operations
export {
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
  // Types
  type PatchOpSuccess,
  type PatchOpResult,
} from './fragment-ops.js';

// Alias operations
export {
  applyAliasOp,
  rejectAliasOp,
  addAliasOp,
  removeAliasOp,
} from './alias-ops.js';
