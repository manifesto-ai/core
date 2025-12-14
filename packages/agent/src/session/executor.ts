/**
 * @manifesto-ai/agent - Sequential Executor
 *
 * 실행 모델: Sequential + Stop-on-Failure
 * - 한 번의 LLM 호출 + effects 실행 사이클
 * - 오류 발생 시 즉시 중단 (남은 effects 폐기)
 * - 다음 step에서 오류 상태 포함하여 재시도
 */

import type { Effect } from '../types/effect.js';
import type { AgentDecision, AgentClient } from '../types/client.js';
import type { Constraints } from '../types/constraints.js';
import type { Policy } from '../types/policy.js';
import type { AgentRuntime, StepResult } from '../types/session.js';
import type { ErrorState } from '../types/errors.js';
import type { ProjectionProvider } from '../projection/types.js';
import type { RuntimeEvents } from '../types/events.js';
import { createEffectError, createHandlerError } from '../types/errors.js';
import type { EffectHandlerRegistry, HandlerContext, ToolRegistry } from '../handlers/registry.js';
import { validateEffectStructure } from './validate-effect.js';

/**
 * Executor 컨텍스트
 */
export type ExecutorContext<S = unknown> = {
  /** AgentRuntime 인터페이스 */
  runtime: AgentRuntime<S>;
  /** AgentClient */
  client: AgentClient<S>;
  /** 실행 정책 */
  policy: Policy;
  /** Effect 핸들러 레지스트리 */
  handlers: EffectHandlerRegistry<S>;
  /** Tool 레지스트리 */
  tools: ToolRegistry;
  /** Constraints 컴파일러 */
  compileConstraints: (snapshot: S) => Constraints;
  /** 사용자 지시 */
  instruction?: string;
  /**
   * Projection Provider (v0.1.x)
   * LLM에게 전달할 스냅샷을 투영하는 제공자
   */
  projectionProvider?: ProjectionProvider<S>;
  /**
   * 런타임 이벤트 콜백 (v0.1.x)
   * Step, LLM 호출, Effect 실행 등의 진행 상황 알림
   */
  events?: RuntimeEvents<S>;
  /**
   * 현재 step 번호 (executeRun에서 관리)
   */
  stepNumber?: number;
};

/**
 * 단일 step 실행
 *
 * @param ctx - Executor 컨텍스트
 * @returns StepResult
 */
export async function executeStep<S>(ctx: ExecutorContext<S>): Promise<StepResult> {
  const { runtime, client, policy, handlers, tools, compileConstraints, instruction, projectionProvider, events, stepNumber = 1 } = ctx;

  // 1. 현재 스냅샷 조회
  const fullSnapshot = runtime.getSnapshot();

  // Event: onStepStart
  events?.onStepStart?.({
    stepNumber,
    timestamp: Date.now(),
    snapshot: fullSnapshot,
  });

  // 2. Constraints 컴파일
  const constraints = compileConstraints(fullSnapshot);

  // 3. 최근 에러 조회
  const recentErrors = runtime.getRecentErrors(5);

  // 4. Projection 적용 (v0.1.x)
  // projectionProvider가 있으면 투영된 스냅샷 사용, 없으면 전체 스냅샷 사용
  let snapshotForLLM: S = fullSnapshot;
  let projectionMeta = undefined;

  if (projectionProvider) {
    const projectionResult = projectionProvider.project(fullSnapshot);
    // Projection 결과를 S로 타입 단언 (부분 스냅샷이지만 클라이언트는 이를 처리할 수 있음)
    snapshotForLLM = projectionResult.snapshot as S;
    projectionMeta = projectionResult.metadata;
  }

  // Event: onLLMCallStart
  events?.onLLMCallStart?.({
    stepNumber,
    timestamp: Date.now(),
  });

  // 5. LLM 호출
  let decision: AgentDecision;
  try {
    decision = await client.decide({
      snapshot: snapshotForLLM,
      constraints,
      recentErrors: recentErrors.length > 0 ? recentErrors : undefined,
      instruction,
      projectionMeta,
    });
  } catch (err) {
    // LLM 호출 실패
    runtime.appendError(createEffectError('llm_call', err instanceof Error ? err.message : String(err)));
    const result: StepResult = {
      done: false,
      reason: 'LLM call failed',
      effectsExecuted: 0,
      errorsEncountered: 1,
    };
    // Event: onStepComplete (with error)
    events?.onStepComplete?.({
      stepNumber,
      timestamp: Date.now(),
      snapshot: runtime.getSnapshot(),
      ...result,
    });
    return result;
  }

  // Event: onLLMCallComplete
  events?.onLLMCallComplete?.({
    stepNumber,
    timestamp: Date.now(),
    decision,
  });

  // 5. Effects가 비어있으면 완료로 간주
  if (decision.effects.length === 0) {
    const result: StepResult = {
      done: true,
      reason: 'No effects emitted',
      effectsExecuted: 0,
      errorsEncountered: 0,
    };
    // Event: onStepComplete
    events?.onStepComplete?.({
      stepNumber,
      timestamp: Date.now(),
      snapshot: runtime.getSnapshot(),
      ...result,
    });
    return result;
  }

  // 6. Effects 순차 실행 (stop-on-failure)
  const maxEffects = policy.maxEffectsPerStep ?? 16;
  const effectsToExecute = decision.effects.slice(0, maxEffects);

  let effectsExecuted = 0;
  let errorsEncountered = 0;

  // 이전 에러 클리어 (새 step 시작)
  runtime.clearErrors();

  // Handler 컨텍스트 준비
  const handlerCtx: HandlerContext<S> = {
    runtime,
    constraints,
    tools,
  };

  for (let i = 0; i < effectsToExecute.length; i++) {
    const effect = effectsToExecute[i]!;

    // 6.1 Effect 구조 검증
    const validation = validateEffectStructure(effect);
    if (!validation.ok) {
      runtime.appendError(createEffectError(
        effect.id ?? 'unknown',
        validation.issue
      ));
      errorsEncountered++;
      break; // stop-on-failure
    }

    // Event: onEffectStart
    events?.onEffectStart?.({
      stepNumber,
      effectIndex: i,
      effect,
      timestamp: Date.now(),
    });

    // 6.2 Effect 실행
    try {
      await handlers.handle(effect, handlerCtx);
      effectsExecuted++;

      // Event: onEffectComplete
      events?.onEffectComplete?.({
        stepNumber,
        effectIndex: i,
        effect,
        timestamp: Date.now(),
      });
    } catch (err) {
      runtime.appendError(createHandlerError(
        effect.id,
        err instanceof Error ? err.message : String(err)
      ));
      errorsEncountered++;
      break; // stop-on-failure
    }
  }

  const result: StepResult = {
    done: false,
    effectsExecuted,
    errorsEncountered,
  };

  // Event: onStepComplete
  events?.onStepComplete?.({
    stepNumber,
    timestamp: Date.now(),
    snapshot: runtime.getSnapshot(),
    ...result,
  });

  return result;
}

/**
 * run() - 완료될 때까지 step 반복
 *
 * @param ctx - Executor 컨텍스트
 * @param isDone - 완료 판정 함수
 * @returns RunResult
 */
export async function executeRun<S>(
  ctx: ExecutorContext<S>,
  isDone?: (snapshot: S) => { done: boolean; reason?: string }
): Promise<{
  done: boolean;
  reason?: string;
  totalSteps: number;
  totalEffects: number;
}> {
  const { runtime, policy } = ctx;
  let totalSteps = 0;
  let totalEffects = 0;

  while (totalSteps < policy.maxSteps) {
    // 완료 조건 체크
    if (isDone) {
      const snapshot = runtime.getSnapshot();
      const doneCheck = isDone(snapshot);
      if (doneCheck.done) {
        return {
          done: true,
          reason: doneCheck.reason ?? 'Done condition met',
          totalSteps,
          totalEffects,
        };
      }
    }

    // Step 실행 (stepNumber 전달)
    const stepCtx: ExecutorContext<S> = {
      ...ctx,
      stepNumber: totalSteps + 1,
    };
    const result = await executeStep(stepCtx);
    totalSteps++;
    totalEffects += result.effectsExecuted;

    // Step이 done을 반환하면 종료
    if (result.done) {
      return {
        done: true,
        reason: result.reason ?? 'Step completed',
        totalSteps,
        totalEffects,
      };
    }

    // 연속 에러 체크 (옵션)
    // v0.1에서는 단순히 계속 진행
  }

  // maxSteps 도달
  return {
    done: false,
    reason: `Max steps (${policy.maxSteps}) reached`,
    totalSteps,
    totalEffects,
  };
}
