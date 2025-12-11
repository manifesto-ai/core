/**
 * @manifesto-ai/agent - Snapshot Patch Handler
 *
 * snapshot.patch Effect 처리:
 * 1. PatchOps 검증 (ACL, bounds, type, invariant)
 * 2. 검증 통과 시 core.applyPatch() 호출
 * 3. 실패 시 에러 상태 기록 (patch 미적용)
 */

import type { SnapshotPatchEffect, PatchOp } from '../types/effect.js';
import { createPatchError, createHandlerError, type PatchErrorState } from '../types/errors.js';
import type { EffectHandler, HandlerContext } from './registry.js';
import { validatePatchOps } from '../validation/patch.js';

/**
 * Snapshot patch handler 생성
 */
export function createSnapshotPatchHandler<S = unknown>(): EffectHandler<SnapshotPatchEffect, S> {
  return {
    type: 'snapshot.patch',

    async handle(effect: SnapshotPatchEffect, ctx: HandlerContext<S>): Promise<void> {
      const { ops, id: effectId } = effect;

      // 1. 현재 스냅샷 조회
      const currentSnapshot = ctx.core.getSnapshot();

      // 2. Pre-patch 검증 (ACL, bounds, type)
      const validationResult = validatePatchOps(
        ops,
        currentSnapshot,
        ctx.constraints,
        effectId
      );

      if (!validationResult.ok) {
        // 검증 실패: 에러 기록 후 종료
        ctx.core.appendError(validationResult.error);
        throw new PatchValidationError(validationResult.error);
      }

      // 3. Patch 적용
      const applyResult = ctx.core.applyPatch(ops);

      if (!applyResult.ok) {
        // 적용 실패: 에러 기록 후 종료
        ctx.core.appendError(applyResult.error);
        throw new PatchValidationError(applyResult.error);
      }

      // 4. Post-patch invariant 검증은 core.applyPatch 내부에서 처리되어야 함
      // 또는 별도 검증 필요 시 여기서 추가
    },
  };
}

/**
 * Patch 검증 에러
 */
export class PatchValidationError extends Error {
  readonly errorState: PatchErrorState;

  constructor(errorState: PatchErrorState) {
    super(`Patch validation failed: ${errorState.issue} at ${errorState.at}`);
    this.name = 'PatchValidationError';
    this.errorState = errorState;
  }
}

/**
 * Patch 적용 결과 타입
 */
export type PatchResult = {
  /** 적용 성공 여부 */
  success: boolean;
  /** 적용된 ops 수 */
  appliedOps: number;
  /** 에러 정보 */
  error?: PatchErrorState;
};

/**
 * Patch 적용 헬퍼 (에러를 throw하지 않음)
 */
export async function applyPatch<S>(
  effect: SnapshotPatchEffect,
  ctx: HandlerContext<S>
): Promise<PatchResult> {
  const { ops, id: effectId } = effect;

  // 현재 스냅샷 조회
  const currentSnapshot = ctx.core.getSnapshot();

  // Pre-patch 검증
  const validationResult = validatePatchOps(
    ops,
    currentSnapshot,
    ctx.constraints,
    effectId
  );

  if (!validationResult.ok) {
    ctx.core.appendError(validationResult.error);
    return {
      success: false,
      appliedOps: 0,
      error: validationResult.error,
    };
  }

  // Patch 적용
  const applyResult = ctx.core.applyPatch(ops);

  if (!applyResult.ok) {
    ctx.core.appendError(applyResult.error);
    return {
      success: false,
      appliedOps: 0,
      error: applyResult.error,
    };
  }

  return {
    success: true,
    appliedOps: ops.length,
  };
}

/**
 * 단일 PatchOp를 스냅샷에 적용 (순수 함수)
 * Core가 아닌 간단한 적용 로직이 필요할 때 사용
 */
export function applyPatchOpToObject<T>(
  obj: T,
  op: PatchOp
): T {
  const result = deepClone(obj);
  const path = op.path.split('.');

  // 경로 탐색
  let current: unknown = result;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    const index = parseInt(key, 10);

    if (!isNaN(index) && Array.isArray(current)) {
      current = current[index];
    } else if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[key];
    } else {
      // 경로가 존재하지 않으면 생성
      if (typeof current === 'object' && current !== null) {
        (current as Record<string, unknown>)[key] = {};
        current = (current as Record<string, unknown>)[key];
      }
    }
  }

  // 마지막 키에 값 설정
  const lastKey = path[path.length - 1]!;
  const lastIndex = parseInt(lastKey, 10);

  if (typeof current === 'object' && current !== null) {
    if (op.op === 'set') {
      if (!isNaN(lastIndex) && Array.isArray(current)) {
        current[lastIndex] = op.value;
      } else {
        (current as Record<string, unknown>)[lastKey] = op.value;
      }
    } else if (op.op === 'append') {
      const arr = !isNaN(lastIndex) && Array.isArray(current)
        ? current[lastIndex]
        : (current as Record<string, unknown>)[lastKey];

      if (Array.isArray(arr)) {
        arr.push(op.value);
      }
    }
  }

  return result;
}

/**
 * Deep clone 헬퍼
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClone) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = deepClone(value);
  }

  return result as T;
}
