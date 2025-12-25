/**
 * Patch Types - Patch-first editing operations
 *
 * Patches are the primary mechanism for modifying fragments.
 * They enable incremental updates without full recompilation.
 *
 * AGENT_README Invariant #9: Patch-first editing MUST be preserved end-to-end.
 */

import type { SemanticPath, Expression } from '@manifesto-ai/core';
import type { Provenance, Evidence } from './provenance.js';
import type { FragmentId, Fragment, SchemaField } from './fragment.js';
import type { ConflictId } from './conflict.js';
import type { AliasId, CodebookId, Codebook } from './codebook.js';

/** Unique identifier for a patch */
export type PatchId = string;

/**
 * Patch operations
 *
 * Each operation is atomic and can be applied independently.
 */
export type PatchOp =
  /** Replace an expression in a fragment */
  | {
      op: 'replaceExpr';
      fragmentId: FragmentId;
      newExpr: Expression;
    }
  /** Add a dependency to a derived fragment */
  | {
      op: 'addDep';
      derivedPath: SemanticPath;
      dep: SemanticPath;
    }
  /** Remove a dependency from a derived fragment */
  | {
      op: 'removeDep';
      derivedPath: SemanticPath;
      dep: SemanticPath;
    }
  /** Rename a semantic path */
  | {
      op: 'renamePath';
      from: SemanticPath;
      to: SemanticPath;
    }
  /** Remove a fragment entirely */
  | {
      op: 'removeFragment';
      fragmentId: FragmentId;
    }
  /** Choose a fragment to resolve a conflict */
  | {
      op: 'chooseConflict';
      conflictId: ConflictId;
      chosenFragmentId: FragmentId;
    }
  /** Update a schema field */
  | {
      op: 'updateSchemaField';
      path: SemanticPath;
      update: Partial<SchemaField>;
    }
  /** Add a new fragment */
  | {
      op: 'addFragment';
      fragment: Fragment;
    }
  /** Update fragment metadata */
  | {
      op: 'updateFragmentMeta';
      fragmentId: FragmentId;
      update: Partial<{
        tags: string[];
        confidence: number;
      }>;
    }
  /** Replace fragment evidence */
  | {
      op: 'replaceEvidence';
      fragmentId: FragmentId;
      evidence: Evidence[];
    }
  // ========================================================================
  // Alias Operations (Codebook)
  // ========================================================================
  /** Apply an alias from the codebook (changes status to 'applied' and renames paths) */
  | {
      op: 'applyAlias';
      aliasId: AliasId;
      codebookId: CodebookId;
    }
  /** Reject an alias suggestion (changes status to 'rejected') */
  | {
      op: 'rejectAlias';
      aliasId: AliasId;
      codebookId: CodebookId;
      reason?: string;
    }
  /** Add a user-defined alias to the codebook and apply it immediately */
  | {
      op: 'addAlias';
      aliasPath: SemanticPath;
      canonicalPath: SemanticPath;
      codebookId: CodebookId;
      rationale?: string;
    }
  /** Remove an alias from the codebook */
  | {
      op: 'removeAlias';
      aliasId: AliasId;
      codebookId: CodebookId;
    };

/**
 * A patch containing one or more operations
 *
 * Patches are atomic: all operations succeed or all fail.
 */
export interface Patch {
  /** Unique patch identifier */
  id: PatchId;

  /** Operations to apply */
  ops: PatchOp[];

  /** Provenance: who/what created this patch */
  origin: Provenance;

  /** Evidence: why this patch was created */
  evidence?: Evidence[];

  /** Version constraints for safe application */
  appliesTo?: {
    /** Fragment version this patch targets */
    fragmentVersion?: string;
    /** LinkResult version this patch targets */
    linkResultVersion?: string;
  };

  /** Description of what this patch does */
  description?: string;

  /** Timestamp when patch was created */
  createdAt?: number;
}

/**
 * Origin of a patch hint
 *
 * 헌법 제5조 (결정론 경계): suggestion이 결정론적인지 LLM 기반인지 명확히 구분
 */
export type PatchHintOrigin = 'deterministic' | 'llm';

/**
 * A hint for generating a patch
 *
 * Patch hints are suggestions that can be shown to users
 * or used by LLM to generate actual patches.
 */
export interface PatchHint {
  /** Human-readable description */
  description?: string;

  /** Suggestion text (alternative to description) */
  suggestion?: string;

  /** Partial patch operation (may need completion) */
  patch?: Partial<PatchOp>;

  /** List of fragment IDs affected by this hint */
  fragmentIds?: FragmentId[];

  /** Detailed operations for this hint */
  operations?: Array<{
    type: string;
    fragmentId?: FragmentId;
    path?: string;
    oldPath?: string;
    newPath?: string;
    [key: string]: unknown;
  }>;

  /** Confidence score (0-1) */
  confidence?: number;

  /** Rationale for this suggestion */
  rationale?: string;

  /** Reason for this hint */
  reason?: string;

  /** Is this a recommended fix? */
  recommended?: boolean;

  /**
   * Origin of this hint (헌법 제5조)
   *
   * - 'deterministic': 결정론적 알고리즘으로 생성 (conflict detection, similarity analysis 등)
   * - 'llm': LLM을 통해 생성 (NL pass, AI suggestion 등)
   *
   * Optional for backward compatibility.
   */
  origin?: PatchHintOrigin;

  /**
   * Provenance for LLM-generated hints
   *
   * LLM이 사용된 경우 추적 정보 (model, promptHash 등)
   */
  provenance?: Provenance;
}

/**
 * Result of applying a patch
 */
export interface ApplyPatchResult {
  /** Whether all operations succeeded */
  ok: boolean;

  /** Updated fragments */
  fragments: Fragment[];

  /** Updated codebook (if alias operations were applied) */
  codebook?: Codebook;

  /** Operations that were applied */
  applied: PatchOp[];

  /** Operations that failed */
  failed: Array<{ op: PatchOp; reason: string }>;
}

/**
 * Create a unique patch ID
 */
export function createPatchId(): PatchId {
  return `patch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a patch
 */
export function createPatch(
  ops: PatchOp[],
  origin: Provenance,
  options?: {
    evidence?: Evidence[];
    description?: string;
    appliesTo?: Patch['appliesTo'];
  }
): Patch {
  return {
    id: createPatchId(),
    ops,
    origin,
    evidence: options?.evidence,
    description: options?.description,
    appliesTo: options?.appliesTo,
    createdAt: Date.now(),
  };
}

/**
 * Create a replaceExpr patch operation
 */
export function replaceExprOp(fragmentId: FragmentId, newExpr: Expression): PatchOp {
  return { op: 'replaceExpr', fragmentId, newExpr };
}

/**
 * Create an addDep patch operation
 */
export function addDepOp(derivedPath: SemanticPath, dep: SemanticPath): PatchOp {
  return { op: 'addDep', derivedPath, dep };
}

/**
 * Create a removeFragment patch operation
 */
export function removeFragmentOp(fragmentId: FragmentId): PatchOp {
  return { op: 'removeFragment', fragmentId };
}

/**
 * Create a chooseConflict patch operation
 */
export function chooseConflictOp(
  conflictId: ConflictId,
  chosenFragmentId: FragmentId
): PatchOp {
  return { op: 'chooseConflict', conflictId, chosenFragmentId };
}

/**
 * Create a renamePath patch operation
 */
export function renamePathOp(from: SemanticPath, to: SemanticPath): PatchOp {
  return { op: 'renamePath', from, to };
}

/**
 * Create an addFragment patch operation
 */
export function addFragmentOp(fragment: Fragment): PatchOp {
  return { op: 'addFragment', fragment };
}

/**
 * Create a patch hint
 */
export function createPatchHint(
  description: string,
  patch: Partial<PatchOp>,
  options?: {
    confidence?: number;
    rationale?: string;
    recommended?: boolean;
  }
): PatchHint {
  return {
    description,
    patch,
    confidence: options?.confidence,
    rationale: options?.rationale,
    recommended: options?.recommended,
  };
}

// ============================================================================
// Alias PatchOp Helpers
// ============================================================================

/**
 * Create an applyAlias patch operation
 */
export function applyAliasOp(aliasId: AliasId, codebookId: CodebookId): PatchOp {
  return { op: 'applyAlias', aliasId, codebookId };
}

/**
 * Create a rejectAlias patch operation
 */
export function rejectAliasOp(
  aliasId: AliasId,
  codebookId: CodebookId,
  reason?: string
): PatchOp {
  return { op: 'rejectAlias', aliasId, codebookId, reason };
}

/**
 * Create an addAlias patch operation
 */
export function addAliasOp(
  aliasPath: SemanticPath,
  canonicalPath: SemanticPath,
  codebookId: CodebookId,
  rationale?: string
): PatchOp {
  return { op: 'addAlias', aliasPath, canonicalPath, codebookId, rationale };
}

/**
 * Create a removeAlias patch operation
 */
export function removeAliasOp(aliasId: AliasId, codebookId: CodebookId): PatchOp {
  return { op: 'removeAlias', aliasId, codebookId };
}
