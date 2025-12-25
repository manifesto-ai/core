/**
 * Fragment PatchOp Handlers
 *
 * Handles all fragment-modifying operations.
 * All operations return Result<PatchOpSuccess, CompilerError>.
 *
 * CRITICAL INVARIANTS:
 * - All mutations return NEW arrays/objects (immutable)
 * - All operations return Result<T, CompilerError>
 *
 * Manifesto Philosophy:
 * "실패는 예외가 아니라, 처리되어야 할 데이터다."
 */

import type { SemanticPath, Expression } from '@manifesto-ai/core';
import type {
  Fragment,
  FragmentId,
  DerivedFragment,
  SchemaFragment,
  SchemaField,
} from '../../types/fragment.js';
import type { Evidence } from '../../types/provenance.js';
import type { Codebook } from '../../types/codebook.js';
import {
  // Result monad
  type Result,
  ok,
  err,
  // CompilerError types
  type CompilerError,
  fragmentNotFound,
  fragmentAlreadyExists,
  invalidFragmentKind,
  pathNotFound,
  selfReference,
  depNotFound,
  depAlreadyExists,
  conflictNotFound,
  schemaNotFound,
  fieldNotFound,
} from '../../types/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of applying a single PatchOp
 *
 * Uses Result monad for type-safe error handling.
 */
export interface PatchOpSuccess {
  fragments: Fragment[];
  codebook?: Codebook;
}

export type PatchOpResult = Result<PatchOpSuccess, CompilerError>;

// ============================================================================
// Fragment Operations
// ============================================================================

/**
 * Replace expression in a derived fragment
 */
export function applyReplaceExpr(
  fragments: Fragment[],
  fragmentId: FragmentId,
  newExpr: Expression
): PatchOpResult {
  const index = fragments.findIndex((f) => f.id === fragmentId);

  if (index === -1) {
    return err(fragmentNotFound(fragmentId));
  }

  const fragment = fragments[index]!;

  if (fragment.kind !== 'DerivedFragment') {
    return err(invalidFragmentKind(fragmentId, 'DerivedFragment', fragment.kind));
  }

  const updated: DerivedFragment = {
    ...(fragment as DerivedFragment),
    expr: newExpr,
  };

  const newFragments = [...fragments];
  newFragments[index] = updated;

  return ok({ fragments: newFragments });
}

/**
 * Add a dependency to a derived fragment
 */
export function applyAddDep(
  fragments: Fragment[],
  derivedPath: SemanticPath,
  dep: SemanticPath
): PatchOpResult {
  const index = fragments.findIndex(
    (f) => f.kind === 'DerivedFragment' && f.path === derivedPath
  );

  if (index === -1) {
    return err(pathNotFound(derivedPath));
  }

  const fragment = fragments[index] as DerivedFragment;

  if (fragment.requires.includes(dep)) {
    return err(depAlreadyExists(derivedPath, dep));
  }

  const updated: DerivedFragment = {
    ...fragment,
    requires: [...fragment.requires, dep].sort(),
  };

  const newFragments = [...fragments];
  newFragments[index] = updated;

  return ok({ fragments: newFragments });
}

/**
 * Remove a dependency from a derived fragment
 */
export function applyRemoveDep(
  fragments: Fragment[],
  derivedPath: SemanticPath,
  dep: SemanticPath
): PatchOpResult {
  const index = fragments.findIndex(
    (f) => f.kind === 'DerivedFragment' && f.path === derivedPath
  );

  if (index === -1) {
    return err(pathNotFound(derivedPath));
  }

  const fragment = fragments[index] as DerivedFragment;

  if (!fragment.requires.includes(dep)) {
    return err(depNotFound(derivedPath, dep));
  }

  const updated: DerivedFragment = {
    ...fragment,
    requires: fragment.requires.filter((r) => r !== dep),
  };

  const newFragments = [...fragments];
  newFragments[index] = updated;

  return ok({ fragments: newFragments });
}

/**
 * Rename a semantic path across all fragments
 */
export function applyRenamePath(
  fragments: Fragment[],
  from: SemanticPath,
  to: SemanticPath
): PatchOpResult {
  if (from === to) {
    return err(selfReference(from));
  }

  const newFragments = fragments.map((fragment) => {
    let modified = false;
    let updated = { ...fragment };

    // Update requires
    if (fragment.requires.includes(from)) {
      updated = {
        ...updated,
        requires: fragment.requires.map((r) => (r === from ? to : r)),
      };
      modified = true;
    }

    // Update provides
    if (fragment.provides.includes(from)) {
      updated = {
        ...updated,
        provides: fragment.provides.map((p) => (p === from ? to : p)),
      };
      modified = true;
    }

    // Update path for fragments that have it
    if ('path' in fragment && fragment.path === from) {
      updated = {
        ...updated,
        path: to,
      } as Fragment;
      modified = true;
    }

    return modified ? updated : fragment;
  });

  return ok({ fragments: newFragments });
}

/**
 * Remove a fragment
 */
export function applyRemoveFragment(fragments: Fragment[], fragmentId: FragmentId): PatchOpResult {
  const index = fragments.findIndex((f) => f.id === fragmentId);

  if (index === -1) {
    return err(fragmentNotFound(fragmentId));
  }

  const newFragments = fragments.filter((f) => f.id !== fragmentId);

  return ok({ fragments: newFragments });
}

/**
 * Choose a fragment to resolve a conflict
 *
 * This removes all fragments with the same provides except the chosen one.
 */
export function applyChooseConflict(
  fragments: Fragment[],
  conflictId: string,
  chosenFragmentId: FragmentId
): PatchOpResult {
  const chosen = fragments.find((f) => f.id === chosenFragmentId);

  if (!chosen) {
    return err(fragmentNotFound(chosenFragmentId));
  }

  // Find all fragments that provide the same paths
  const chosenProvides = new Set(chosen.provides);
  const conflicting = fragments.filter(
    (f) => f.id !== chosenFragmentId && f.provides.some((p) => chosenProvides.has(p))
  );

  if (conflicting.length === 0) {
    return err(conflictNotFound(conflictId));
  }

  // Remove conflicting fragments
  const conflictingIds = new Set(conflicting.map((f) => f.id));
  const newFragments = fragments.filter((f) => !conflictingIds.has(f.id));

  return ok({ fragments: newFragments });
}

/**
 * Update a schema field
 *
 * SchemaFragment has `fields: SchemaField[]` array.
 * This operation updates a field within a SchemaFragment that provides the given path.
 */
export function applyUpdateSchemaField(
  fragments: Fragment[],
  path: SemanticPath,
  update: Partial<SchemaField>
): PatchOpResult {
  // Find SchemaFragment that provides this path
  const index = fragments.findIndex(
    (f) => f.kind === 'SchemaFragment' && f.provides.includes(path)
  );

  if (index === -1) {
    return err(schemaNotFound(path));
  }

  const fragment = fragments[index] as SchemaFragment;

  // Find the field within the fragment's fields array
  const fieldIndex = fragment.fields.findIndex((field) => field.path === path);
  if (fieldIndex === -1) {
    return err(fieldNotFound(path, fragment.id));
  }

  const updatedFields = [...fragment.fields];
  updatedFields[fieldIndex] = {
    ...fragment.fields[fieldIndex]!,
    ...update,
  };

  const updated: SchemaFragment = {
    ...fragment,
    fields: updatedFields,
  };

  const newFragments = [...fragments];
  newFragments[index] = updated;

  return ok({ fragments: newFragments });
}

/**
 * Add a new fragment
 */
export function applyAddFragment(fragments: Fragment[], fragment: Fragment): PatchOpResult {
  // Check for duplicate ID
  if (fragments.some((f) => f.id === fragment.id)) {
    return err(fragmentAlreadyExists(fragment.id));
  }

  return ok({ fragments: [...fragments, fragment] });
}

/**
 * Update fragment metadata
 */
export function applyUpdateFragmentMeta(
  fragments: Fragment[],
  fragmentId: FragmentId,
  update: Partial<{ tags: string[]; confidence: number }>
): PatchOpResult {
  const index = fragments.findIndex((f) => f.id === fragmentId);

  if (index === -1) {
    return err(fragmentNotFound(fragmentId));
  }

  const fragment = fragments[index]!;
  const updated: Fragment = {
    ...fragment,
    ...(update.tags !== undefined && { tags: update.tags }),
    ...(update.confidence !== undefined && { confidence: update.confidence }),
  } as Fragment;

  const newFragments = [...fragments];
  newFragments[index] = updated;

  return ok({ fragments: newFragments });
}

/**
 * Replace fragment evidence
 *
 * Fragments have `evidence: Evidence[]` directly on the fragment, not nested in provenance.
 */
export function applyReplaceEvidence(
  fragments: Fragment[],
  fragmentId: FragmentId,
  evidence: Evidence[]
): PatchOpResult {
  const index = fragments.findIndex((f) => f.id === fragmentId);

  if (index === -1) {
    return err(fragmentNotFound(fragmentId));
  }

  const fragment = fragments[index]!;
  const updated: Fragment = {
    ...fragment,
    evidence,
  } as Fragment;

  const newFragments = [...fragments];
  newFragments[index] = updated;

  return ok({ fragments: newFragments });
}
