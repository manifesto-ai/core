/**
 * @manifesto-ai/agent - AgentClient Types
 *
 * LLM 어댑터 규약.
 * LLM은 snapshot을 받아 effects를 반환하는 순수 함수.
 */

import type { Effect } from './effect.js';
import type { Constraints } from './constraints.js';
import type { PatchErrorState } from './errors.js';
import type { ProjectionMetadata } from '../projection/types.js';

/**
 * AgentDecision - LLM이 반환하는 결정
 *
 * 출력 강제 규칙:
 * - JSON only: 자연어 출력 금지, 오직 JSON
 * - AgentDecision only: 정해진 스키마만 출력
 * - No hallucination: 스냅샷에 없는 데이터 생성 금지
 * - log.emit for notes: 메모/추론 과정은 log.emit 사용
 */
export type AgentDecision = {
  /** 실행할 effect 목록 */
  effects: Effect[];

  /** 추적 정보 (선택) */
  trace?: {
    /** 사용된 모델 */
    model?: string;
    /** 입력 토큰 수 */
    tokensIn?: number;
    /** 출력 토큰 수 */
    tokensOut?: number;
    /** 원본 응답 (디버깅용) */
    raw?: unknown;
  };
};

/**
 * AgentClient 입력
 */
export type AgentClientInput<S = unknown> = {
  /** 현재 스냅샷 (전체 또는 투영된 스냅샷) */
  snapshot: S;
  /** 현재 phase의 Constraints */
  constraints: Constraints;
  /** 최근 에러 목록 (있는 경우) */
  recentErrors?: PatchErrorState[];
  /** 사용자 지시 (선택) */
  instruction?: string;
  /**
   * 투영 메타데이터 (선택, v0.1.x)
   * projectionProvider 사용 시 자동으로 포함됨
   */
  projectionMeta?: ProjectionMetadata;
};

/**
 * AgentClient 인터페이스
 *
 * LLM 어댑터가 구현해야 하는 인터페이스.
 * f(snapshot) → effects[] 순수 함수 패턴 강제.
 */
export interface AgentClient<S = unknown> {
  /**
   * 스냅샷을 받아 결정을 반환
   *
   * @param input - 스냅샷, constraints, 최근 에러, 지시사항
   * @returns AgentDecision - effects 목록
   */
  decide(input: AgentClientInput<S>): Promise<AgentDecision>;
}

/**
 * Mock AgentClient 생성 (테스트용)
 */
export function createMockClient<S>(
  decisions: AgentDecision[]
): AgentClient<S> & { callCount: number } {
  let index = 0;
  return {
    callCount: 0,
    async decide(): Promise<AgentDecision> {
      this.callCount++;
      if (index >= decisions.length) {
        return { effects: [] };
      }
      return decisions[index++]!;
    },
  };
}

/**
 * 고정 effects를 반환하는 Client 생성 (테스트용)
 */
export function createFixedClient<S>(
  effects: Effect[]
): AgentClient<S> {
  return {
    async decide(): Promise<AgentDecision> {
      return { effects };
    },
  };
}
