/**
 * @manifesto-ai/agent - Session Types
 *
 * Session = 여러 step으로 구성된 실행 단위.
 * Step = 한 번의 LLM 호출 + effects 실행 사이클.
 */

import type { PatchOp } from './effect.js';
import type { ErrorState, PatchErrorState } from './errors.js';
import type { Observation } from './observation.js';

/**
 * Step 실행 결과
 */
export type StepResult = {
  /** 세션 완료 여부 */
  done: boolean;
  /** 완료/중단 이유 */
  reason?: string;
  /** 실행된 effect 수 */
  effectsExecuted: number;
  /** 발생한 에러 수 */
  errorsEncountered: number;
};

/**
 * Run 실행 결과
 */
export type RunResult = {
  /** 세션 완료 여부 */
  done: boolean;
  /** 완료/중단 이유 */
  reason?: string;
  /** 총 step 수 */
  totalSteps: number;
  /** 총 effect 수 */
  totalEffects: number;
};

/**
 * AgentSession 인터페이스
 */
export interface AgentSession {
  /**
   * 단일 step 실행
   * 1. client.decide() 호출
   * 2. effects 순차 실행
   * 3. 에러 발생 시 즉시 중단
   */
  step(): Promise<StepResult>;

  /**
   * 완료될 때까지 실행
   * maxSteps 또는 done=true까지 step() 반복
   */
  run(): Promise<RunResult>;
}

/**
 * Patch 적용 결과
 */
export type ApplyResult<S> =
  | { ok: true; snapshot: S }
  | { ok: false; error: PatchErrorState };

/**
 * AgentRuntime - Agent 실행을 위한 Runtime 인터페이스
 *
 * @manifesto-ai/core의 DomainRuntime을 래핑하여 Agent 실행에 필요한
 * 추가 기능(에러 상태, observations)을 제공하는 어댑터 인터페이스.
 *
 * Note: DomainRuntime과 직접 호환되지 않음.
 * createAgentRuntime() 어댑터를 사용하여 DomainRuntime을 래핑해야 함.
 */
export interface AgentRuntime<S> {
  /**
   * 현재 스냅샷 조회
   */
  getSnapshot(): S;

  /**
   * Patch 적용
   * @param ops - PatchOp 배열
   * @returns 성공 시 새 스냅샷, 실패 시 에러
   */
  applyPatch(ops: PatchOp[]): ApplyResult<S>;

  /**
   * 에러 상태 추가
   */
  appendError(error: ErrorState): void;

  /**
   * 최근 에러 조회
   * @param limit - 조회할 최대 개수
   */
  getRecentErrors(limit?: number): PatchErrorState[];

  /**
   * 에러 상태 초기화
   */
  clearErrors(): void;

  /**
   * Observation 추가 (Runtime only)
   * LLM은 이 메서드를 직접 호출할 수 없음
   */
  appendObservation(obs: Observation): void;
}

/**
 * @deprecated Use AgentRuntime instead
 * ManifestoCoreLike는 AgentRuntime으로 이름이 변경되었습니다.
 */
export type ManifestoCoreLike<S> = AgentRuntime<S>;

/**
 * Session 생성 완료 여부 판정자
 */
export type DoneChecker<S> = (snapshot: S) => { done: boolean; reason?: string };

/**
 * 기본 DoneChecker - 항상 미완료
 */
export function defaultDoneChecker<S>(): DoneChecker<S> {
  return () => ({ done: false });
}

/**
 * Phase 기반 DoneChecker - 특정 phase에 도달하면 완료
 */
export function phaseDoneChecker<S extends { state?: { phase?: string } }>(
  targetPhase: string
): DoneChecker<S> {
  return (snapshot) => {
    const currentPhase = snapshot.state?.phase;
    if (currentPhase === targetPhase) {
      return { done: true, reason: `Reached target phase: ${targetPhase}` };
    }
    return { done: false };
  };
}
