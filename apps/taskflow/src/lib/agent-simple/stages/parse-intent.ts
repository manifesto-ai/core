/**
 * Stage 5: Parse Intent
 *
 * LLM 응답 JSON을 Intent로 파싱
 */

import { Result, Ok, Err } from '../result';
import { Errors, SimpleAgentError, LLMResponseContext, ParsedIntentContext } from '../types';
import type { Intent } from '@/lib/agents/intent';

/**
 * LLM 응답 JSON을 Intent로 파싱
 *
 * @param context - LLM 응답 컨텍스트
 * @returns Result<ParsedIntentContext, SimpleAgentError>
 */
export function parseIntent(
  context: LLMResponseContext
): Result<ParsedIntentContext, SimpleAgentError> {
  try {
    const intent = JSON.parse(context.rawContent) as Intent;

    return Ok({
      input: context.input,
      intent,
    });
  } catch {
    return Err(Errors.parse('Failed to parse JSON', context.rawContent));
  }
}
