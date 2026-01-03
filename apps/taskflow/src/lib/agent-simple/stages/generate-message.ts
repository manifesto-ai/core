/**
 * Stage 8: Generate Message
 *
 * 사용자에게 표시할 응답 메시지 생성
 */

import { Result, Ok } from '../result';
import { SimpleAgentError, ExecutedContext, FinalContext } from '../types';
import type { Intent } from '@/lib/agents/intent';

/**
 * Intent로부터 응답 메시지 추출/생성
 */
function generateMessage(intent: Intent): string {
  // LLM이 생성한 message 필드가 있으면 사용
  const llmMessage = (intent as unknown as { message?: string }).message;
  if (llmMessage) {
    return llmMessage;
  }

  // QueryTasks는 answer 필드 사용
  if (intent.kind === 'QueryTasks') {
    return (intent as unknown as { answer?: string }).answer || 'Done.';
  }

  // RequestClarification은 question 필드 사용
  if (intent.kind === 'RequestClarification') {
    return intent.question;
  }

  // 기본 메시지
  return 'Done.';
}

/**
 * 최종 응답 컨텍스트 생성
 *
 * @param context - 실행된 Intent 컨텍스트
 * @returns Result<FinalContext, SimpleAgentError>
 */
export function generateMessageStage(
  context: ExecutedContext
): Result<FinalContext, SimpleAgentError> {
  return Ok({
    intent: context.intent,
    effects: context.effects,
    message: generateMessage(context.intent),
  });
}
