/**
 * useActionAvailability - Hook for checking action availability
 *
 * P0-2: 전체 스냅샷 대신 전제조건 의존성만 구독하여 불필요한 리렌더 방지
 */

import { useMemo } from 'react';
import { useRuntime, useDomain } from '../context.js';
import type { UseActionAvailabilityResult } from '../types.js';
import { useValues } from './useValues.js';

/**
 * useActionAvailability - Hook for checking action availability
 *
 * P0-2: 액션 전제조건에 필요한 경로만 구독하여 최적화
 *
 * @param actionId - ID of the action to check
 * @returns Object with isAvailable, preconditions, and blockedReasons
 *
 * @example
 * ```tsx
 * function ActionStatus() {
 *   const { isAvailable, blockedReasons } = useActionAvailability('submitOrder');
 *
 *   if (isAvailable) {
 *     return <span>Ready to submit</span>;
 *   }
 *
 *   return (
 *     <div>
 *       <span>Cannot submit:</span>
 *       <ul>
 *         {blockedReasons.map((reason, i) => (
 *           <li key={i}>{reason.reason || reason.path}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useActionAvailability(actionId: string): UseActionAvailabilityResult {
  const runtime = useRuntime();
  const domain = useDomain();

  // P0-2: 전제조건의 의존성 경로 추출
  const deps = useMemo(() => {
    const action = domain.actions[actionId];
    if (!action?.preconditions) return [];
    return action.preconditions.map((p) => p.path);
  }, [domain, actionId]);

  // P0-2: 의존성만 구독 - 관련 경로가 변경될 때만 리렌더
  useValues(deps);

  // P0-2: useMemo 제거 - useValues가 리렌더를 트리거하므로 항상 최신 값 계산
  const preconditions = runtime.getPreconditions(actionId);
  const isAvailable = preconditions.every((p) => p.satisfied);
  const blockedReasons = preconditions
    .filter((p) => !p.satisfied)
    .map((p) => ({
      path: p.path,
      expected: p.expect,
      actual: p.actual,
      reason: p.reason,
    }));

  return {
    isAvailable,
    preconditions,
    blockedReasons,
  };
}
