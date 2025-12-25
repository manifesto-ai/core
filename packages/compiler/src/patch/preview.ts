/**
 * Patch Preview - Dry-run patch analysis
 *
 * Preview functions analyze patches without applying them.
 * Returns affected fragments and potential errors.
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type { Fragment, FragmentId } from '../types/fragment.js';
import type { Patch, PatchOp } from '../types/patch.js';
import type { Codebook } from '../types/codebook.js';
import { getAliasById } from './codebook.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Preview result
 */
export interface PatchPreviewResult {
  wouldSucceed: boolean;
  affectedFragments: FragmentId[];
  affectedPaths: SemanticPath[];
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Preview Functions
// ============================================================================

/**
 * Preview what a patch would do without applying it
 *
 * Returns affected fragments and potential errors.
 */
export function previewPatch(
  fragments: Fragment[],
  patch: Patch,
  codebook?: Codebook
): PatchPreviewResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const affectedFragmentIds = new Set<FragmentId>();
  const affectedPaths = new Set<SemanticPath>();

  for (const op of patch.ops) {
    const preview = previewOp(fragments, op, codebook);
    preview.errors.forEach((e) => errors.push(e));
    preview.warnings.forEach((w) => warnings.push(w));
    preview.affectedFragments.forEach((id) => affectedFragmentIds.add(id));
    preview.affectedPaths.forEach((p) => affectedPaths.add(p));
  }

  return {
    wouldSucceed: errors.length === 0,
    affectedFragments: [...affectedFragmentIds].sort(),
    affectedPaths: [...affectedPaths].sort(),
    errors,
    warnings,
  };
}

/**
 * Preview a single operation
 */
function previewOp(
  fragments: Fragment[],
  op: PatchOp,
  codebook?: Codebook
): PatchPreviewResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const affectedFragments: FragmentId[] = [];
  const affectedPaths: SemanticPath[] = [];

  switch (op.op) {
    case 'replaceExpr': {
      const fragment = fragments.find((f) => f.id === op.fragmentId);
      if (!fragment) {
        errors.push(`Fragment not found: ${op.fragmentId}`);
      } else if (fragment.kind !== 'DerivedFragment') {
        errors.push(`Cannot replace expression on ${fragment.kind}`);
      } else {
        affectedFragments.push(op.fragmentId);
        if ('path' in fragment) {
          affectedPaths.push(fragment.path);
        }
      }
      break;
    }

    case 'addDep':
    case 'removeDep': {
      const fragment = fragments.find(
        (f) => f.kind === 'DerivedFragment' && f.path === op.derivedPath
      );
      if (!fragment) {
        errors.push(`DerivedFragment not found for path: ${op.derivedPath}`);
      } else {
        affectedFragments.push(fragment.id);
        affectedPaths.push(op.derivedPath);
      }
      break;
    }

    case 'renamePath': {
      if (op.from === op.to) {
        errors.push(`Cannot rename path to itself: ${op.from}`);
      } else {
        for (const fragment of fragments) {
          if (
            fragment.requires.includes(op.from) ||
            fragment.provides.includes(op.from) ||
            ('path' in fragment && fragment.path === op.from)
          ) {
            affectedFragments.push(fragment.id);
          }
        }
        affectedPaths.push(op.from, op.to);
      }
      break;
    }

    case 'removeFragment': {
      const fragment = fragments.find((f) => f.id === op.fragmentId);
      if (!fragment) {
        errors.push(`Fragment not found: ${op.fragmentId}`);
      } else {
        affectedFragments.push(op.fragmentId);
        // Check for dependents
        const dependents = fragments.filter(
          (f) => f.id !== op.fragmentId && f.requires.some((r) => fragment.provides.includes(r))
        );
        if (dependents.length > 0) {
          warnings.push(
            `Removing fragment will break ${dependents.length} dependents: ${dependents.map((d) => d.id).join(', ')}`
          );
        }
      }
      break;
    }

    case 'chooseConflict': {
      const chosen = fragments.find((f) => f.id === op.chosenFragmentId);
      if (!chosen) {
        errors.push(`Chosen fragment not found: ${op.chosenFragmentId}`);
      } else {
        affectedFragments.push(op.chosenFragmentId);
        const chosenProvides = new Set(chosen.provides);
        const conflicting = fragments.filter(
          (f) =>
            f.id !== op.chosenFragmentId && f.provides.some((p) => chosenProvides.has(p))
        );
        conflicting.forEach((f) => affectedFragments.push(f.id));
      }
      break;
    }

    case 'addFragment': {
      if (fragments.some((f) => f.id === op.fragment.id)) {
        errors.push(`Fragment with ID already exists: ${op.fragment.id}`);
      } else {
        affectedFragments.push(op.fragment.id);
      }
      break;
    }

    case 'applyAlias':
    case 'rejectAlias':
    case 'addAlias':
    case 'removeAlias': {
      if (!codebook) {
        errors.push('Codebook required for alias operations');
      } else if (
        'codebookId' in op &&
        codebook.id !== op.codebookId
      ) {
        errors.push(`Codebook ID mismatch`);
      }

      if (op.op === 'applyAlias' || op.op === 'addAlias') {
        let aliasPath: SemanticPath | undefined;
        let canonicalPath: SemanticPath | undefined;

        if (op.op === 'applyAlias' && codebook) {
          const entry = getAliasById(codebook, op.aliasId);
          if (entry) {
            aliasPath = entry.aliasPath;
            canonicalPath = entry.canonicalPath;
          }
        } else if (op.op === 'addAlias') {
          aliasPath = op.aliasPath;
          canonicalPath = op.canonicalPath;
        }

        if (aliasPath && canonicalPath) {
          affectedPaths.push(aliasPath, canonicalPath);
          for (const fragment of fragments) {
            if (
              fragment.requires.includes(aliasPath) ||
              fragment.provides.includes(aliasPath) ||
              ('path' in fragment && fragment.path === aliasPath)
            ) {
              affectedFragments.push(fragment.id);
            }
          }
        }
      }
      break;
    }

    default: {
      const fragment = fragments.find((f) => f.id === (op as { fragmentId?: string }).fragmentId);
      if (fragment) {
        affectedFragments.push(fragment.id);
      }
    }
  }

  return {
    wouldSucceed: errors.length === 0,
    affectedFragments,
    affectedPaths,
    errors,
    warnings,
  };
}
