/**
 * @manifesto-ai/agent - Policy Types
 *
 * Session 실행 정책. v0.1에서는 단순화됨.
 * 복잡한 판정 기준(tokenBudget, onStuck, retry)은 v0.2로 이관.
 */

/**
 * Session Policy
 *
 * v0.1에서 제거된 옵션:
 * - tokenBudget: 누적/per-step 토큰 제한
 * - onStuck: 막힘 감지 시 행동
 * - retry: 자동 재시도 정책
 *
 * 이유: 판정 기준 복잡도로 인해 제거
 */
export type Policy = {
  /** 최대 step 수 */
  maxSteps: number;

  /**
   * step당 최대 effect 수
   * @default 16
   */
  maxEffectsPerStep?: number;
};

/**
 * 기본 Policy 생성
 */
export function createDefaultPolicy(): Policy {
  return {
    maxSteps: 100,
    maxEffectsPerStep: 16,
  };
}

/**
 * Policy 병합
 */
export function mergePolicy(base: Policy, override: Partial<Policy>): Policy {
  return {
    maxSteps: override.maxSteps ?? base.maxSteps,
    maxEffectsPerStep: override.maxEffectsPerStep ?? base.maxEffectsPerStep,
  };
}

/**
 * Policy 검증
 */
export function validatePolicy(policy: Policy): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (policy.maxSteps <= 0) {
    errors.push('maxSteps must be positive');
  }

  if (policy.maxEffectsPerStep !== undefined && policy.maxEffectsPerStep <= 0) {
    errors.push('maxEffectsPerStep must be positive');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
