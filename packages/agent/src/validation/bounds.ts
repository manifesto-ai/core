/**
 * @manifesto-ai/agent - Bounds Validation
 *
 * 배열 인덱스 범위 검증:
 * - 0-based indexing
 * - 0 <= idx < length 위반 시 ValidationError
 */

import type { PatchErrorState } from '../types/errors.js';
import { createPatchError } from '../types/errors.js';

/**
 * Bounds 검증 결과
 */
export type BoundsValidationResult =
  | { ok: true }
  | { ok: false; error: PatchErrorState };

/**
 * 경로 파싱 결과
 */
type PathSegment =
  | { type: 'key'; value: string }
  | { type: 'index'; value: number };

/**
 * 경로를 세그먼트로 파싱
 *
 * @param path - 점으로 구분된 경로
 * @returns 세그먼트 배열
 *
 * @example
 * parsePath("data.items.0.name") => [
 *   { type: 'key', value: 'data' },
 *   { type: 'key', value: 'items' },
 *   { type: 'index', value: 0 },
 *   { type: 'key', value: 'name' }
 * ]
 */
export function parsePath(path: string): PathSegment[] {
  const parts = path.split('.');
  return parts.map((part) => {
    const num = parseInt(part, 10);
    if (!isNaN(num) && num.toString() === part) {
      return { type: 'index', value: num };
    }
    return { type: 'key', value: part };
  });
}

/**
 * 경로의 배열 인덱스 범위 검증
 *
 * @param path - 검증할 경로
 * @param snapshot - 현재 스냅샷
 * @param effectId - 원인 effect ID
 * @returns 검증 결과
 */
export function validatePathBounds(
  path: string,
  snapshot: unknown,
  effectId: string
): BoundsValidationResult {
  const segments = parsePath(path);
  let current: unknown = snapshot;
  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    currentPath = currentPath ? `${currentPath}.${segment.type === 'key' ? segment.value : segment.value.toString()}` : (segment.type === 'key' ? segment.value : segment.value.toString());

    if (current === null || current === undefined) {
      // 중간 경로가 null/undefined면 새로 생성될 수 있으므로 통과
      // 단, 배열 인덱스 접근은 불가
      if (segment.type === 'index') {
        return {
          ok: false,
          error: createPatchError(effectId, path, 'Index out of bounds', {
            expected: `Array at "${currentPath}" to exist`,
            got: current,
            advice: `Cannot access index ${segment.value} on ${current === null ? 'null' : 'undefined'}. Ensure the parent array exists first.`,
          }),
        };
      }
      // 객체 키 접근은 새로 생성될 수 있으므로 계속
      break;
    }

    if (segment.type === 'index') {
      // 배열 인덱스 접근
      if (!Array.isArray(current)) {
        return {
          ok: false,
          error: createPatchError(effectId, path, 'Index out of bounds', {
            expected: `Array at parent path`,
            got: typeof current,
            advice: `Path "${currentPath}" expects an array but found ${typeof current}. Use object key access instead.`,
          }),
        };
      }

      const idx = segment.value;
      const isLastSegment = i === segments.length - 1;

      // append의 경우 length까지 허용 (마지막 세그먼트일 때)
      // set의 경우 length - 1까지만 허용
      // 여기서는 일반적인 경우만 검사 (set)
      if (idx < 0) {
        return {
          ok: false,
          error: createPatchError(effectId, path, 'Index out of bounds', {
            expected: `Index >= 0`,
            got: idx,
            advice: `Negative indices are not allowed. Use index 0 to ${current.length - 1}.`,
          }),
        };
      }

      // 마지막 세그먼트가 아닌 경우에만 범위 검사
      // 마지막 세그먼트면 set으로 새 항목 생성 가능
      if (!isLastSegment && idx >= current.length) {
        return {
          ok: false,
          error: createPatchError(effectId, path, 'Index out of bounds', {
            expected: `Index < ${current.length}`,
            got: idx,
            advice: `Array has ${current.length} items (indices 0-${current.length - 1}). Index ${idx} is out of bounds.`,
          }),
        };
      }

      current = (current as unknown[])[idx];
    } else {
      // 객체 키 접근
      if (typeof current !== 'object') {
        return {
          ok: false,
          error: createPatchError(effectId, path, 'Invalid path format', {
            expected: `Object at path segment`,
            got: typeof current,
            advice: `Cannot access property "${segment.value}" on ${typeof current}.`,
          }),
        };
      }

      current = (current as Record<string, unknown>)[segment.value];
    }
  }

  return { ok: true };
}

/**
 * append 연산을 위한 bounds 검증
 * append는 배열의 끝에 추가하므로 현재 길이가 중요
 *
 * @param path - 배열 경로
 * @param snapshot - 현재 스냅샷
 * @param effectId - 원인 effect ID
 * @returns 검증 결과
 */
export function validateAppendBounds(
  path: string,
  snapshot: unknown,
  effectId: string
): BoundsValidationResult {
  const segments = parsePath(path);
  let current: unknown = snapshot;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;

    if (current === null || current === undefined) {
      return {
        ok: false,
        error: createPatchError(effectId, path, 'Index out of bounds', {
          expected: `Path "${path}" to exist`,
          got: current,
          advice: `Cannot append to non-existent path. Ensure the array exists first.`,
        }),
      };
    }

    if (segment.type === 'index') {
      if (!Array.isArray(current)) {
        return {
          ok: false,
          error: createPatchError(effectId, path, 'Index out of bounds', {
            expected: `Array at path`,
            got: typeof current,
            advice: `Cannot use array index on ${typeof current}.`,
          }),
        };
      }

      if (segment.value < 0 || segment.value >= current.length) {
        return {
          ok: false,
          error: createPatchError(effectId, path, 'Index out of bounds', {
            expected: `Index in range 0-${current.length - 1}`,
            got: segment.value,
            advice: `Array index ${segment.value} is out of bounds.`,
          }),
        };
      }

      current = current[segment.value];
    } else {
      if (typeof current !== 'object') {
        return {
          ok: false,
          error: createPatchError(effectId, path, 'Invalid path format', {
            expected: `Object at path`,
            got: typeof current,
            advice: `Cannot access property on ${typeof current}.`,
          }),
        };
      }

      current = (current as Record<string, unknown>)[segment.value];
    }
  }

  // 최종 값이 배열이어야 append 가능
  if (!Array.isArray(current)) {
    return {
      ok: false,
      error: createPatchError(effectId, path, 'Invalid operation', {
        expected: `Array at path "${path}"`,
        got: typeof current,
        advice: `Cannot append to ${typeof current}. Use "set" for non-array values.`,
      }),
    };
  }

  return { ok: true };
}
