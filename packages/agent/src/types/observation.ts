/**
 * @manifesto-ai/agent - Observation Types
 *
 * Observation = Tool 실행 결과.
 * Runtime이 derived.observations에 push.
 * LLM은 직접 수정 불가.
 */

/**
 * Observation - Tool 실행 결과
 *
 * derived.observations에 Runtime이 push하는 구조.
 * LLM은 관측을 "기록"하지 않고, log.emit만 사용.
 */
export type Observation = {
  /** 고유 ID */
  id: string;

  /**
   * 출처
   * 예: "tool:search", "tool:calculator", "system:init"
   */
  source: string;

  /** Tool 실행 결과 */
  content: unknown;

  /** 원인 effect.id (있는 경우) */
  triggeredBy?: string;

  /** 발생 시각 */
  ts: number;
};

/**
 * Observation ID 생성 유틸리티
 */
export function generateObservationId(): string {
  return `obs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Observation 생성 헬퍼
 */
export function createObservation(
  source: string,
  content: unknown,
  triggeredBy?: string
): Observation {
  return {
    id: generateObservationId(),
    source,
    content,
    triggeredBy,
    ts: Date.now(),
  };
}

/**
 * Tool 결과에서 Observation 생성
 */
export function createToolObservation(
  toolName: string,
  result: unknown,
  effectId: string
): Observation {
  return createObservation(`tool:${toolName}`, result, effectId);
}
