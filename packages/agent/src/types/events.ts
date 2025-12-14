/**
 * @manifesto-ai/agent - Runtime Events
 *
 * 런타임 실행 중 발생하는 이벤트에 대한 콜백 시스템.
 * Step, LLM 호출, Effect 실행 등의 진행 상황을 실시간으로 파악할 수 있음.
 */

import type { Effect } from './effect.js';
import type { AgentDecision } from './client.js';
import type { StepResult } from './session.js';

/**
 * Step 이벤트 데이터
 */
export interface StepEvent<S> {
  /** 현재 step 번호 (1부터 시작) */
  stepNumber: number;
  /** 이벤트 발생 시간 (ms) */
  timestamp: number;
  /** 현재 스냅샷 */
  snapshot: S;
}

/**
 * Effect 이벤트 데이터
 */
export interface EffectEvent<S> {
  /** 현재 step 번호 */
  stepNumber: number;
  /** Effect 인덱스 (0부터 시작) */
  effectIndex: number;
  /** Effect 객체 */
  effect: Effect;
  /** 이벤트 발생 시간 (ms) */
  timestamp: number;
}

/**
 * LLM 호출 이벤트 데이터
 */
export interface LLMCallEvent<S> {
  /** 현재 step 번호 */
  stepNumber: number;
  /** 이벤트 발생 시간 (ms) */
  timestamp: number;
  /** LLM 응답 (complete 시에만) */
  decision?: AgentDecision;
}

/**
 * Step 완료 이벤트 데이터
 */
export interface StepCompleteEvent<S> extends StepEvent<S>, StepResult {}

/**
 * 런타임 이벤트 콜백
 */
export interface RuntimeEvents<S> {
  /**
   * Step 시작 시 호출
   */
  onStepStart?: (event: StepEvent<S>) => void;

  /**
   * Step 완료 시 호출
   */
  onStepComplete?: (event: StepCompleteEvent<S>) => void;

  /**
   * LLM 호출 시작 시 호출
   */
  onLLMCallStart?: (event: LLMCallEvent<S>) => void;

  /**
   * LLM 호출 완료 시 호출
   */
  onLLMCallComplete?: (event: LLMCallEvent<S>) => void;

  /**
   * Effect 실행 시작 시 호출
   */
  onEffectStart?: (event: EffectEvent<S>) => void;

  /**
   * Effect 실행 완료 시 호출
   */
  onEffectComplete?: (event: EffectEvent<S>) => void;
}
