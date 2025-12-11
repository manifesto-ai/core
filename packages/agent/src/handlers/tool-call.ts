/**
 * @manifesto-ai/agent - Tool Call Handler
 *
 * tool.call Effect 처리:
 * 1. Tool 실행
 * 2. 결과를 derived.observations에 push (Runtime 권한)
 *
 * LLM은 observations를 직접 수정하지 않고, tool.call만 선언.
 */

import type { ToolCallEffect } from '../types/effect.js';
import { createToolObservation } from '../types/observation.js';
import type { EffectHandler, HandlerContext } from './registry.js';

/**
 * Tool call handler 생성
 */
export function createToolCallHandler<S = unknown>(): EffectHandler<ToolCallEffect, S> {
  return {
    type: 'tool.call',

    async handle(effect: ToolCallEffect, ctx: HandlerContext<S>): Promise<void> {
      const tool = ctx.tools.get(effect.tool);

      if (!tool) {
        throw new Error(`Unknown tool: ${effect.tool}`);
      }

      // 1. Tool 실행
      const result = await tool.execute(effect.input);

      // 2. 결과를 derived.observations에 push (Runtime 권한)
      // LLM은 절대 observations를 직접 수정할 수 없음
      const observation = createToolObservation(effect.tool, result, effect.id);
      ctx.core.appendObservation(observation);
    },
  };
}

/**
 * Tool call 결과 타입
 */
export type ToolCallResult = {
  /** Tool 이름 */
  tool: string;
  /** 실행 성공 여부 */
  success: boolean;
  /** 결과 데이터 */
  result?: unknown;
  /** 에러 메시지 */
  error?: string;
  /** 실행 시간 (ms) */
  duration?: number;
};

/**
 * Tool call을 래핑하여 결과와 에러를 표준화
 */
export async function executeToolCall(
  effect: ToolCallEffect,
  ctx: HandlerContext
): Promise<ToolCallResult> {
  const tool = ctx.tools.get(effect.tool);

  if (!tool) {
    return {
      tool: effect.tool,
      success: false,
      error: `Unknown tool: ${effect.tool}`,
    };
  }

  const start = Date.now();

  try {
    const result = await tool.execute(effect.input);
    const duration = Date.now() - start;

    // observations에 push
    const observation = createToolObservation(effect.tool, result, effect.id);
    ctx.core.appendObservation(observation);

    return {
      tool: effect.tool,
      success: true,
      result,
      duration,
    };
  } catch (err) {
    const duration = Date.now() - start;

    // 에러도 observation으로 기록
    const observation = createToolObservation(
      effect.tool,
      {
        error: true,
        message: err instanceof Error ? err.message : String(err),
      },
      effect.id
    );
    ctx.core.appendObservation(observation);

    return {
      tool: effect.tool,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration,
    };
  }
}
