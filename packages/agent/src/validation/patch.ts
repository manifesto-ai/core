/**
 * @manifesto-ai/agent - Patch Validation Pipeline
 *
 * PatchOp 수신 → 검증 파이프라인:
 * 1. PatchOp 스키마 검증 (op/path/value 구조)
 * 2. Path ACL 검증 (derived.* 쓰기 금지)
 * 3. Path Bounds 검증 (배열 인덱스 범위)
 * 4. Type Rules 검증 (경로별 기대 타입)
 * 5. Invariant 검증 (phase별 불변 조건)
 */

import type { PatchOp } from '../types/effect.js';
import type { Constraints } from '../types/constraints.js';
import type { PatchErrorState } from '../types/errors.js';
import { createPatchError } from '../types/errors.js';
import { validatePathAcl, type AclValidationResult } from './acl.js';
import { validatePathBounds, validateAppendBounds, type BoundsValidationResult } from './bounds.js';
import { validateTypeRule, type TypeValidationResult } from './type-rules.js';
import { validateInvariants, type InvariantValidationResult } from './invariant.js';

/**
 * Patch 검증 결과
 */
export type PatchValidationResult =
  | { ok: true }
  | { ok: false; error: PatchErrorState };

/**
 * PatchOp 스키마 검증
 *
 * @param op - 검증할 PatchOp
 * @param effectId - 원인 effect ID
 * @returns 검증 결과
 */
export function validatePatchOpSchema(
  op: unknown,
  effectId: string
): PatchValidationResult {
  // null/undefined 체크
  if (op === null || op === undefined) {
    return {
      ok: false,
      error: createPatchError(effectId, '', 'Invalid operation', {
        expected: 'PatchOp object',
        got: op,
        advice: 'PatchOp must be an object with "op", "path", and "value" fields.',
      }),
    };
  }

  // 객체 타입 체크
  if (typeof op !== 'object') {
    return {
      ok: false,
      error: createPatchError(effectId, '', 'Invalid operation', {
        expected: 'object',
        got: typeof op,
        advice: 'PatchOp must be an object.',
      }),
    };
  }

  const patchOp = op as Record<string, unknown>;

  // op 필드 체크
  if (!('op' in patchOp)) {
    return {
      ok: false,
      error: createPatchError(effectId, '', 'Invalid operation', {
        expected: '"op" field',
        got: 'missing',
        advice: 'PatchOp must have an "op" field with value "set" or "append".',
      }),
    };
  }

  if (patchOp.op !== 'set' && patchOp.op !== 'append') {
    return {
      ok: false,
      error: createPatchError(effectId, '', 'Invalid operation', {
        expected: '"set" or "append"',
        got: patchOp.op,
        advice: 'Only "set" and "append" operations are allowed in v0.1. "delete", "move", "replace", "copy" are forbidden.',
      }),
    };
  }

  // path 필드 체크
  if (!('path' in patchOp)) {
    return {
      ok: false,
      error: createPatchError(effectId, '', 'Invalid operation', {
        expected: '"path" field',
        got: 'missing',
        advice: 'PatchOp must have a "path" field.',
      }),
    };
  }

  if (typeof patchOp.path !== 'string') {
    return {
      ok: false,
      error: createPatchError(effectId, '', 'Invalid path format', {
        expected: 'string',
        got: typeof patchOp.path,
        advice: 'Path must be a string.',
      }),
    };
  }

  if (patchOp.path === '') {
    return {
      ok: false,
      error: createPatchError(effectId, '', 'Invalid path format', {
        expected: 'non-empty string',
        got: '""',
        advice: 'Path cannot be empty.',
      }),
    };
  }

  // value 필드 체크
  if (!('value' in patchOp)) {
    return {
      ok: false,
      error: createPatchError(effectId, '', 'Invalid operation', {
        expected: '"value" field',
        got: 'missing',
        advice: 'PatchOp must have a "value" field.',
      }),
    };
  }

  return { ok: true };
}

/**
 * 전체 Patch 검증 파이프라인
 *
 * @param op - 검증할 PatchOp
 * @param snapshot - 현재 스냅샷
 * @param constraints - 현재 constraints
 * @param effectId - 원인 effect ID
 * @returns 검증 결과
 */
export function validatePatchOp(
  op: PatchOp,
  snapshot: unknown,
  constraints: Constraints,
  effectId: string
): PatchValidationResult {
  // 1. PatchOp 스키마 검증
  const schemaResult = validatePatchOpSchema(op, effectId);
  if (!schemaResult.ok) {
    return schemaResult;
  }

  // 2. Path ACL 검증
  const aclResult = validatePathAcl(op.path, constraints, effectId);
  if (!aclResult.ok) {
    return aclResult;
  }

  // 3. Path Bounds 검증
  let boundsResult: BoundsValidationResult;
  if (op.op === 'append') {
    boundsResult = validateAppendBounds(op.path, snapshot, effectId);
  } else {
    boundsResult = validatePathBounds(op.path, snapshot, effectId);
  }
  if (!boundsResult.ok) {
    return boundsResult;
  }

  // 4. Type Rules 검증
  const typeResult = validateTypeRule(op.path, op.value, constraints, effectId);
  if (!typeResult.ok) {
    return typeResult;
  }

  return { ok: true };
}

/**
 * 여러 PatchOp 일괄 검증 (invariant 제외)
 *
 * @param ops - 검증할 PatchOp 배열
 * @param snapshot - 현재 스냅샷
 * @param constraints - 현재 constraints
 * @param effectId - 원인 effect ID
 * @returns 첫 번째 실패한 결과 또는 성공
 */
export function validatePatchOps(
  ops: PatchOp[],
  snapshot: unknown,
  constraints: Constraints,
  effectId: string
): PatchValidationResult {
  for (const op of ops) {
    const result = validatePatchOp(op, snapshot, constraints, effectId);
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
}

/**
 * Patch 적용 후 invariant 검증
 *
 * @param newSnapshot - patch 적용 후 스냅샷
 * @param constraints - 현재 constraints
 * @param effectId - 원인 effect ID
 * @returns 검증 결과
 */
export function validatePostPatchInvariants(
  newSnapshot: unknown,
  constraints: Constraints,
  effectId: string
): PatchValidationResult {
  return validateInvariants(constraints, newSnapshot, effectId);
}

/**
 * 전체 검증 파이프라인 (pre-patch + post-patch)
 *
 * @param ops - 적용할 PatchOp 배열
 * @param currentSnapshot - 현재 스냅샷
 * @param projectedSnapshot - patch 적용 후 예상 스냅샷
 * @param constraints - 현재 constraints
 * @param effectId - 원인 effect ID
 * @returns 검증 결과
 */
export function validatePatchPipeline(
  ops: PatchOp[],
  currentSnapshot: unknown,
  projectedSnapshot: unknown,
  constraints: Constraints,
  effectId: string
): PatchValidationResult {
  // Pre-patch validation
  const preResult = validatePatchOps(ops, currentSnapshot, constraints, effectId);
  if (!preResult.ok) {
    return preResult;
  }

  // Post-patch invariant validation
  const postResult = validatePostPatchInvariants(projectedSnapshot, constraints, effectId);
  if (!postResult.ok) {
    return postResult;
  }

  return { ok: true };
}
