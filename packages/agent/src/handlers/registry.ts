/**
 * @manifesto-ai/agent - Effect Handler Registry
 *
 * Effect를 실행하는 핸들러들의 레지스트리.
 * LLM이 선언한 의도(Effect)를 Runtime이 실행.
 */

import type { Effect, ToolCallEffect, SnapshotPatchEffect, LogEmitEffect } from '../types/effect.js';
import type { ManifestoCoreLike } from '../types/session.js';
import type { Constraints } from '../types/constraints.js';

/**
 * Handler 실행 컨텍스트
 */
export type HandlerContext<S = unknown> = {
  /** ManifestoCore 인터페이스 */
  core: ManifestoCoreLike<S>;
  /** 현재 constraints */
  constraints: Constraints;
  /** Tool 레지스트리 */
  tools: ToolRegistry;
};

/**
 * Tool 정의
 */
export type Tool<TInput = unknown, TOutput = unknown> = {
  /** Tool 이름 */
  name: string;
  /** Tool 설명 (LLM용) */
  description: string;
  /** Tool 실행 함수 */
  execute: (input: TInput) => Promise<TOutput>;
};

/**
 * Tool 레지스트리
 */
export type ToolRegistry = {
  /** Tool 조회 */
  get(name: string): Tool | undefined;
  /** Tool 목록 */
  list(): Tool[];
  /** Tool 존재 여부 */
  has(name: string): boolean;
};

/**
 * EffectHandler - 단일 Effect 타입 핸들러
 */
export type EffectHandler<E extends Effect = Effect, S = unknown> = {
  /** 핸들러가 처리하는 Effect 타입 */
  type: E['type'];
  /** Effect 처리 함수 */
  handle: (effect: E, ctx: HandlerContext<S>) => Promise<void>;
};

/**
 * EffectHandlerRegistry - 모든 Effect 핸들러 관리
 */
export interface EffectHandlerRegistry<S = unknown> {
  /**
   * 핸들러 등록
   */
  register<E extends Effect>(handler: EffectHandler<E, S>): void;

  /**
   * 핸들러 조회
   */
  get(type: string): EffectHandler<Effect, S> | undefined;

  /**
   * Effect 처리 (적절한 핸들러 찾아 실행)
   */
  handle(effect: Effect, ctx: HandlerContext<S>): Promise<void>;
}

/**
 * EffectHandlerRegistry 구현
 */
export function createEffectHandlerRegistry<S = unknown>(): EffectHandlerRegistry<S> {
  const handlers = new Map<string, EffectHandler<Effect, S>>();

  return {
    register<E extends Effect>(handler: EffectHandler<E, S>): void {
      handlers.set(handler.type, handler as unknown as EffectHandler<Effect, S>);
    },

    get(type: string): EffectHandler<Effect, S> | undefined {
      return handlers.get(type);
    },

    async handle(effect: Effect, ctx: HandlerContext<S>): Promise<void> {
      const handler = handlers.get(effect.type);
      if (!handler) {
        throw new Error(`No handler registered for effect type: ${effect.type}`);
      }
      await handler.handle(effect, ctx);
    },
  };
}

/**
 * ToolRegistry 구현
 */
export function createToolRegistry(tools: Tool[] = []): ToolRegistry {
  const map = new Map<string, Tool>();
  for (const tool of tools) {
    map.set(tool.name, tool);
  }

  return {
    get(name: string): Tool | undefined {
      return map.get(name);
    },

    list(): Tool[] {
      return Array.from(map.values());
    },

    has(name: string): boolean {
      return map.has(name);
    },
  };
}

/**
 * Tool 정의 헬퍼
 */
export function defineTool<TInput = unknown, TOutput = unknown>(
  name: string,
  description: string,
  execute: (input: TInput) => Promise<TOutput>
): Tool<TInput, TOutput> {
  return { name, description, execute };
}
