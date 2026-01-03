/**
 * Stage 2: Validate Config
 *
 * 필요한 환경 변수 검증
 */

import { Result, Ok, Err } from '../result';
import { Errors, SimpleAgentError, SimpleAgentInput } from '../types';

/**
 * 필요한 환경 변수가 설정되어 있는지 검증
 *
 * @param input - 파싱된 요청 입력
 * @returns Result<SimpleAgentInput, SimpleAgentError>
 */
export function validateConfig(
  input: SimpleAgentInput
): Result<SimpleAgentInput, SimpleAgentError> {
  if (!process.env.OPENAI_API_KEY) {
    return Err(Errors.config('OPENAI_API_KEY not configured'));
  }

  return Ok(input);
}
