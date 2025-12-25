/**
 * useFieldPolicy - Hook for getting field policy information
 *
 * P0-2: 전체 스냅샷 대신 정책 의존성만 구독하여 불필요한 리렌더 방지
 */

import { useMemo } from 'react';
import type { SemanticPath } from '@manifesto-ai/core';
import { extractFieldPolicyDependencies } from '@manifesto-ai/core';
import { useRuntime, useDomain } from '../context.js';
import type { UseFieldPolicyResult } from '../types.js';
import { useValues } from './useValues.js';

/**
 * useFieldPolicy - Hook for getting field policy information
 *
 * P0-2: 정책 조건에 필요한 경로만 구독하여 최적화
 *
 * @param path - Semantic path of the field
 * @returns Resolved field policy (relevant, editable, required)
 *
 * @example
 * ```tsx
 * function ConditionalField() {
 *   const policy = useFieldPolicy('data.discountCode');
 *
 *   if (!policy.relevant) return null;
 *
 *   return (
 *     <input
 *       disabled={!policy.editable}
 *       required={policy.required}
 *     />
 *   );
 * }
 * ```
 */
export function useFieldPolicy(path: SemanticPath): UseFieldPolicyResult {
  const runtime = useRuntime();
  const domain = useDomain();

  // P0-2: 정책의 조건 의존성만 추출
  const deps = useMemo(() => {
    const source = domain.paths.sources[path];
    if (!source?.policy) return [];
    return extractFieldPolicyDependencies(source.policy);
  }, [domain, path]);

  // P0-2: 의존성만 구독 - 관련 경로가 변경될 때만 리렌더
  useValues(deps);

  // P0-2: useMemo 제거 - useValues가 리렌더를 트리거하므로 항상 최신 값 계산
  return runtime.getFieldPolicy(path);
}
