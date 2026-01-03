/**
 * Stage 7: Execute Intent
 *
 * Intent를 실행하고 Effects 생성
 */

import { Result, Ok, Err } from '../result';
import { Errors, SimpleAgentError, ParsedIntentContext, ExecutedContext } from '../types';
import { executeIntent } from '@/lib/agents/runtime';

/**
 * Intent 실행
 *
 * RequestClarification은 실행 없이 통과
 *
 * @param context - 검증된 Intent 컨텍스트
 * @returns Result<ExecutedContext, SimpleAgentError>
 */
export function executeIntentStage(
  context: ParsedIntentContext
): Result<ExecutedContext, SimpleAgentError> {
  const { intent, input } = context;

  // RequestClarification은 실행 불필요 (사용자에게 되묻기만 함)
  if (intent.kind === 'RequestClarification') {
    return Ok({
      input,
      intent,
      effects: [],
    });
  }

  const result = executeIntent(intent, input.snapshot);

  if (!result.success) {
    return Err(Errors.execution(result.error || 'Unknown execution error'));
  }

  return Ok({
    input,
    intent,
    effects: result.effects,
  });
}
