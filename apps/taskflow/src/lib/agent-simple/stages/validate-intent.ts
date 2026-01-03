/**
 * Stage 6: Validate Intent
 *
 * Intent 스키마 검증
 */

import { Result, Ok, Err } from '../result';
import { Errors, SimpleAgentError, ParsedIntentContext } from '../types';
import { validateIntent as validateIntentSchema } from '@/lib/agents/intent';

/**
 * Intent 스키마 검증
 *
 * @param context - 파싱된 Intent 컨텍스트
 * @returns Result<ParsedIntentContext, SimpleAgentError>
 */
export function validateIntentStage(
  context: ParsedIntentContext
): Result<ParsedIntentContext, SimpleAgentError> {
  const validation = validateIntentSchema(context.intent);

  if (!validation.valid) {
    return Err(Errors.intentValidation(validation.errors));
  }

  return Ok(context);
}
