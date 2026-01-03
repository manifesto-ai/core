/**
 * Simple Agent Types
 *
 * 에러 타입, 파이프라인 컨텍스트 타입, API 응답 타입 정의
 */

import type { Snapshot } from '@/lib/agents/runtime';
import type { Intent } from '@/lib/agents/intent';
import type { AgentEffect } from '@/lib/agents/types';

// ============================================
// Error Types (Discriminated Union)
// ============================================

export type SimpleAgentError =
  | { readonly kind: 'validation'; readonly field: string; readonly message: string }
  | { readonly kind: 'config'; readonly message: string }
  | { readonly kind: 'llm'; readonly message: string; readonly raw?: unknown }
  | { readonly kind: 'parse'; readonly message: string; readonly content: string }
  | { readonly kind: 'intent_validation'; readonly errors: string[] }
  | { readonly kind: 'execution'; readonly message: string };

// ============================================
// Error Constructors
// ============================================

export const Errors = {
  validation: (field: string, message: string): SimpleAgentError => ({
    kind: 'validation',
    field,
    message,
  }),

  config: (message: string): SimpleAgentError => ({
    kind: 'config',
    message,
  }),

  llm: (message: string, raw?: unknown): SimpleAgentError => ({
    kind: 'llm',
    message,
    raw,
  }),

  parse: (message: string, content: string): SimpleAgentError => ({
    kind: 'parse',
    message,
    content,
  }),

  intentValidation: (errors: string[]): SimpleAgentError => ({
    kind: 'intent_validation',
    errors,
  }),

  execution: (message: string): SimpleAgentError => ({
    kind: 'execution',
    message,
  }),
} as const;

// ============================================
// Pipeline Context Types
// ============================================

/**
 * 파이프라인 입력
 */
export interface SimpleAgentInput {
  readonly instruction: string;
  readonly snapshot: Snapshot;
}

/**
 * LLM 호출 컨텍스트
 */
export interface LLMContext {
  readonly input: SimpleAgentInput;
  readonly systemPrompt: string;
  readonly userMessage: string;
}

/**
 * LLM 응답 컨텍스트
 */
export interface LLMResponseContext {
  readonly input: SimpleAgentInput;
  readonly rawContent: string;
}

/**
 * Intent 파싱 후 컨텍스트
 */
export interface ParsedIntentContext {
  readonly input: SimpleAgentInput;
  readonly intent: Intent;
}

/**
 * Intent 실행 후 컨텍스트
 */
export interface ExecutedContext {
  readonly input: SimpleAgentInput;
  readonly intent: Intent;
  readonly effects: AgentEffect[];
}

/**
 * 최종 응답 컨텍스트
 */
export interface FinalContext {
  readonly intent: Intent;
  readonly effects: AgentEffect[];
  readonly message: string;
}

// ============================================
// API Response Types
// ============================================

export interface SimpleAgentResponse {
  readonly success: boolean;
  readonly intent: Intent | null;
  readonly effects: AgentEffect[];
  readonly message: string;
  readonly error?: string;
}

// ============================================
// Error Formatting
// ============================================

/**
 * 에러를 사용자 친화적 문자열로 변환
 */
export function formatError(error: SimpleAgentError): string {
  switch (error.kind) {
    case 'validation':
      return `${error.field}: ${error.message}`;
    case 'config':
      return error.message;
    case 'llm':
      return error.message;
    case 'parse':
      return `Invalid JSON from LLM: ${error.content.slice(0, 100)}${error.content.length > 100 ? '...' : ''}`;
    case 'intent_validation':
      return `Intent validation failed: ${error.errors.join(', ')}`;
    case 'execution':
      return error.message;
  }
}

/**
 * 에러 종류에 따른 HTTP 상태 코드
 */
export function toHttpStatus(error: SimpleAgentError): number {
  switch (error.kind) {
    case 'validation':
      return 400;
    case 'config':
      return 500;
    case 'llm':
      return 502;
    case 'parse':
      return 500;
    case 'intent_validation':
      return 400;
    case 'execution':
      return 400;
  }
}
