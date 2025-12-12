/**
 * @manifesto-ai/agent - Type Rules Validation
 *
 * 경로별 기대 타입 검증.
 * Constraints에 정의된 typeRules를 기반으로 값 타입 체크.
 */

import type { TypeRule, Constraints } from '../types/constraints.js';
import type { PatchErrorState } from '../types/errors.js';
import { createPatchError } from '../types/errors.js';

/**
 * Type 검증 결과
 */
export type TypeValidationResult =
  | { ok: true }
  | { ok: false; error: PatchErrorState };

/**
 * JavaScript 값의 타입을 TypeRule 타입으로 변환
 */
export function getValueType(value: unknown): TypeRule['type'] | 'unknown' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'object';
  return 'unknown';
}

/**
 * 값이 기대 타입과 일치하는지 검증
 *
 * @param path - 검증할 경로
 * @param value - 설정하려는 값
 * @param expectedType - 기대 타입
 * @param effectId - 원인 effect ID
 * @returns 검증 결과
 */
export function validateType(
  path: string,
  value: unknown,
  expectedType: TypeRule['type'],
  effectId: string
): TypeValidationResult {
  const actualType = getValueType(value);

  // null은 모든 타입에 허용 (v0.1 삭제 의미론: set(path, null))
  if (actualType === 'null') {
    return { ok: true };
  }

  if (actualType !== expectedType) {
    return {
      ok: false,
      error: createPatchError(effectId, path, 'Type mismatch', {
        expected: expectedType,
        got: actualType,
        advice: `Use ${expectedType} instead of ${actualType} for path "${path}".`,
      }),
    };
  }

  return { ok: true };
}

/**
 * Constraints의 typeRules를 기반으로 값 타입 검증
 *
 * @param path - 검증할 경로
 * @param value - 설정하려는 값
 * @param constraints - 현재 constraints
 * @param effectId - 원인 effect ID
 * @returns 검증 결과
 */
export function validateTypeRule(
  path: string,
  value: unknown,
  constraints: Constraints,
  effectId: string
): TypeValidationResult {
  // 해당 경로의 type rule 찾기
  const rule = constraints.typeRules.find((r) => r.path === path);

  // 규칙이 없으면 통과
  if (!rule) {
    return { ok: true };
  }

  return validateType(path, value, rule.type, effectId);
}

/**
 * 경로 패턴 매칭 (와일드카드 지원)
 *
 * @param pattern - 패턴 (예: "data.items.*")
 * @param path - 실제 경로 (예: "data.items.0.name")
 * @returns 매칭 여부
 */
export function matchPathPattern(pattern: string, path: string): boolean {
  const patternParts = pattern.split('.');
  const pathParts = path.split('.');

  if (patternParts.length > pathParts.length) {
    return false;
  }

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]!;
    const pathPart = pathParts[i]!;

    if (patternPart === '*') {
      // 와일드카드는 모든 것과 매치
      continue;
    }

    if (patternPart === '**') {
      // ** 는 나머지 모든 경로와 매치
      return true;
    }

    if (patternPart !== pathPart) {
      return false;
    }
  }

  return patternParts.length === pathParts.length;
}

/**
 * 여러 type rules를 일괄 검증
 *
 * @param updates - 경로-값 쌍
 * @param constraints - 현재 constraints
 * @param effectId - 원인 effect ID
 * @returns 첫 번째 실패한 결과 또는 성공
 */
export function validateTypeRules(
  updates: Array<{ path: string; value: unknown }>,
  constraints: Constraints,
  effectId: string
): TypeValidationResult {
  for (const { path, value } of updates) {
    const result = validateTypeRule(path, value, constraints, effectId);
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
}
