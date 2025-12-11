/**
 * @manifesto-ai/agent - ACL Validation
 *
 * 영역 권한 (Write ACL):
 * - data.*: LLM 쓰기 가능 (프로젝트 정책에 따라 제한)
 * - state.*: LLM 쓰기 가능 (phase 등)
 * - derived.*: LLM 쓰기 금지 (Runtime managed)
 *
 * "이 규칙 하나가 시스템을 프로덕션급으로 만든다."
 */

import type { Constraints } from '../types/constraints.js';
import type { PatchErrorState } from '../types/errors.js';
import { createPatchError } from '../types/errors.js';

/**
 * Forbidden path prefixes - LLM이 절대 쓸 수 없는 경로
 */
export const FORBIDDEN_PATH_PREFIXES = ['derived.'] as const;

/**
 * ACL 검증 결과
 */
export type AclValidationResult =
  | { ok: true }
  | { ok: false; error: PatchErrorState };

/**
 * 경로가 쓰기 가능한지 검증
 *
 * @param path - 검증할 경로
 * @param constraints - 현재 constraints
 * @param effectId - 원인 effect ID
 * @returns 검증 결과
 */
export function validatePathAcl(
  path: string,
  constraints: Constraints,
  effectId: string
): AclValidationResult {
  // 1. Forbidden paths 체크 (derived.* 절대 금지)
  for (const forbidden of FORBIDDEN_PATH_PREFIXES) {
    if (path.startsWith(forbidden)) {
      return {
        ok: false,
        error: createPatchError(effectId, path, 'Forbidden path', {
          expected: `Path not starting with "${forbidden}"`,
          got: path,
          advice: `The path "${path}" is runtime-managed. LLM cannot write to ${forbidden}* paths. Use log.emit for notes or let the Runtime manage observations.`,
        }),
      };
    }
  }

  // 2. Writable prefix 체크
  const isWritable = constraints.writablePathPrefixes.some((prefix) =>
    path.startsWith(prefix)
  );

  if (!isWritable) {
    return {
      ok: false,
      error: createPatchError(effectId, path, 'Forbidden path', {
        expected: `Path starting with one of: ${constraints.writablePathPrefixes.join(', ')}`,
        got: path,
        advice: `Only paths starting with ${constraints.writablePathPrefixes.join(' or ')} are writable in phase "${constraints.phase}".`,
      }),
    };
  }

  return { ok: true };
}

/**
 * 여러 경로의 ACL 일괄 검증
 *
 * @param paths - 검증할 경로들
 * @param constraints - 현재 constraints
 * @param effectId - 원인 effect ID
 * @returns 첫 번째 실패한 결과 또는 성공
 */
export function validatePathsAcl(
  paths: string[],
  constraints: Constraints,
  effectId: string
): AclValidationResult {
  for (const path of paths) {
    const result = validatePathAcl(path, constraints, effectId);
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
}

/**
 * derived 경로인지 확인
 */
export function isDerivedPath(path: string): boolean {
  return path.startsWith('derived.');
}

/**
 * data 경로인지 확인
 */
export function isDataPath(path: string): boolean {
  return path.startsWith('data.');
}

/**
 * state 경로인지 확인
 */
export function isStatePath(path: string): boolean {
  return path.startsWith('state.');
}
