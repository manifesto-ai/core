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
import type { ManifestoCoreLike, StepResult } from '../types/session.js';
import type { ErrorState } from '../types/errors.js';
import { createEffectError, createHandlerError } from '../types/errors.js';
import type { EffectHandlerRegistry, HandlerContext, ToolRegistry } from '../handlers/registry.js';
import { validateEffectStructure } from './validate-effect.js';

/**
 * Executor 컨텍스트
 */
export type ExecutorContext<S = unknown> = {
  /** ManifestoCore 인터페이스 */
  core: ManifestoCoreLike<S>;
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
};

/**
 * 단일 step 실행
 *
 * @param ctx - Executor 컨텍스트
 * @returns StepResult
 */
export async function executeStep<S>(ctx: ExecutorContext<S>): Promise<StepResult> {
  const { core, client, policy, handlers, tools, compileConstraints, instruction } = ctx;

  // 1. 현재 스냅샷 조회
  const snapshot = core.getSnapshot();

  // 2. Constraints 컴파일
  const constraints = compileConstraints(snapshot);

  // 3. 최근 에러 조회
  const recentErrors = core.getRecentErrors(5);

  // 4. LLM 호출
  let decision: AgentDecision;
  try {
    decision = await client.decide({
      snapshot,
      constraints,
      recentErrors: recentErrors.length > 0 ? recentErrors : undefined,
      instruction,
    });
  } catch (err) {
    // LLM 호출 실패
    core.appendError(createEffectError('llm_call', err instanceof Error ? err.message : String(err)));
    return {
      done: false,
      reason: 'LLM call failed',
      effectsExecuted: 0,
      errorsEncountered: 1,
    };
  }

  // 5. Effects가 비어있으면 완료로 간주
  if (decision.effects.length === 0) {
    return {
      done: true,
      reason: 'No effects emitted',
      effectsExecuted: 0,
      errorsEncountered: 0,
    };
  }

  // 6. Effects 순차 실행 (stop-on-failure)
  const maxEffects = policy.maxEffectsPerStep ?? 16;
  const effectsToExecute = decision.effects.slice(0, maxEffects);

  let effectsExecuted = 0;
  let errorsEncountered = 0;

  // 이전 에러 클리어 (새 step 시작)
  core.clearErrors();

  // Handler 컨텍스트 준비
  const handlerCtx: HandlerContext<S> = {
    core,
    constraints,
    tools,
  };

  for (const effect of effectsToExecute) {
    // 6.1 Effect 구조 검증
    const validation = validateEffectStructure(effect);
    if (!validation.ok) {
      core.appendError(createEffectError(
        effect.id ?? 'unknown',
        validation.issue
      ));
      errorsEncountered++;
      break; // stop-on-failure
    }

    // 6.2 Effect 실행
    try {
      await handlers.handle(effect, handlerCtx);
      effectsExecuted++;
    } catch (err) {
      core.appendError(createHandlerError(
        effect.id,
        err instanceof Error ? err.message : String(err)
      ));
      errorsEncountered++;
      break; // stop-on-failure
    }
  }

  return {
    done: false,
    effectsExecuted,
    errorsEncountered,
  };
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
  const { core, policy } = ctx;
  let totalSteps = 0;
  let totalEffects = 0;

  while (totalSteps < policy.maxSteps) {
    // 완료 조건 체크
    if (isDone) {
      const snapshot = core.getSnapshot();
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

    // Step 실행
    const result = await executeStep(ctx);
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
