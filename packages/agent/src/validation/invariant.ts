/**
 * @manifesto-ai/agent - Invariant Validation
 *
 * Phase별 불변 조건 검증.
 * Invariant 위반 시 patch 미적용 + 에러 상태 기록.
 */

import type { Constraints, Invariant } from '../types/constraints.js';
import type { PatchErrorState } from '../types/errors.js';
import { createPatchError } from '../types/errors.js';

/**
 * Invariant 검증 결과
 */
export type InvariantValidationResult =
  | { ok: true }
  | { ok: false; error: PatchErrorState };

/**
 * 단일 invariant 검증
 *
 * @param invariant - 검증할 invariant
 * @param snapshot - patch 적용 후 예상 스냅샷
 * @param effectId - 원인 effect ID
 * @returns 검증 결과
 */
export function validateInvariant(
  invariant: Invariant,
  snapshot: unknown,
  effectId: string
): InvariantValidationResult {
  // check 함수가 없으면 통과 (자연어 설명만 있는 경우)
  if (!invariant.check) {
    return { ok: true };
  }

  try {
    const satisfied = invariant.check(snapshot);

    if (!satisfied) {
      return {
        ok: false,
        error: createPatchError(effectId, `invariant:${invariant.id}`, 'Invariant violated', {
          expected: `Invariant "${invariant.id}" to be satisfied`,
          got: false,
          advice: invariant.description,
        }),
      };
    }

    return { ok: true };
  } catch (err) {
    // check 함수 실행 중 에러 발생
    return {
      ok: false,
      error: createPatchError(effectId, `invariant:${invariant.id}`, 'Invariant violated', {
        expected: `Invariant check to succeed`,
        got: err instanceof Error ? err.message : String(err),
        advice: `Invariant "${invariant.id}" check failed: ${invariant.description}`,
      }),
    };
  }
}

/**
 * 모든 invariants 검증
 *
 * @param constraints - 현재 constraints (invariants 포함)
 * @param snapshot - patch 적용 후 예상 스냅샷
 * @param effectId - 원인 effect ID
 * @returns 첫 번째 실패한 결과 또는 성공
 */
export function validateInvariants(
  constraints: Constraints,
  snapshot: unknown,
  effectId: string
): InvariantValidationResult {
  for (const invariant of constraints.invariants) {
    const result = validateInvariant(invariant, snapshot, effectId);
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
}

/**
 * Invariant 생성 헬퍼들
 */

/**
 * 필드 존재 invariant 생성
 */
export function requiredFieldInvariant(
  id: string,
  path: string,
  description?: string
): Invariant {
  return {
    id,
    description: description ?? `Field "${path}" must exist and not be null/undefined`,
    check: (snapshot) => {
      const value = getNestedValue(snapshot, path);
      return value !== null && value !== undefined;
    },
  };
}

/**
 * 숫자 범위 invariant 생성
 */
export function rangeInvariant(
  id: string,
  path: string,
  min: number,
  max: number,
  description?: string
): Invariant {
  return {
    id,
    description: description ?? `Value at "${path}" must be between ${min} and ${max}`,
    check: (snapshot) => {
      const value = getNestedValue(snapshot, path);
      if (typeof value !== 'number') return false;
      return value >= min && value <= max;
    },
  };
}

/**
 * 배열 길이 invariant 생성
 */
export function arrayLengthInvariant(
  id: string,
  path: string,
  minLength: number,
  maxLength?: number,
  description?: string
): Invariant {
  return {
    id,
    description: description ?? `Array at "${path}" must have ${minLength}${maxLength ? `-${maxLength}` : '+'} items`,
    check: (snapshot) => {
      const value = getNestedValue(snapshot, path);
      if (!Array.isArray(value)) return false;
      if (value.length < minLength) return false;
      if (maxLength !== undefined && value.length > maxLength) return false;
      return true;
    },
  };
}

/**
 * 중첩 값 조회 헬퍼
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return obj;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // 배열 인덱스 처리
    const index = parseInt(part, 10);
    if (!isNaN(index) && Array.isArray(current)) {
      current = current[index];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Custom invariant 생성
 */
export function customInvariant(
  id: string,
  description: string,
  check: (snapshot: unknown) => boolean
): Invariant {
  return { id, description, check };
}
