/**
 * Simple Agent - Public API
 *
 * 모듈의 공개 인터페이스
 */

// Result monad
export {
  type Result,
  Ok,
  Err,
  isOk,
  isErr,
  map,
  flatMap,
  flatMapAsync,
  mapError,
  match,
  getOrElse,
  getOrElseW,
  fromNullable,
  tryCatch,
  tryCatchAsync,
  Do,
} from './result';

// Types
export type {
  SimpleAgentError,
  SimpleAgentInput,
  LLMContext,
  LLMResponseContext,
  ParsedIntentContext,
  ExecutedContext,
  FinalContext,
  SimpleAgentResponse,
} from './types';

export { Errors, formatError, toHttpStatus } from './types';

// Service
export { processSimpleIntent, toResponse } from './service';

// Stages (for testing and composition)
export { parseRequest } from './stages/parse-request';
export { validateConfig } from './stages/validate-config';
export { buildContext } from './stages/build-context';
export { callLLM } from './stages/call-llm';
export { parseIntent } from './stages/parse-intent';
export { validateIntentStage } from './stages/validate-intent';
export { executeIntentStage } from './stages/execute-intent';
export { generateMessageStage } from './stages/generate-message';

// Prompts
export { createSystemPrompt } from './prompts';
