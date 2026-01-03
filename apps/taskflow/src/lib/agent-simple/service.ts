/**
 * Simple Agent Service
 *
 * Pipeline composition and response transformation
 */

import { Result, isOk, isErr, match } from './result';
import type { SimpleAgentError, SimpleAgentResponse, FinalContext } from './types';
import { formatError, toHttpStatus } from './types';
import { parseRequest } from './stages/parse-request';
import { validateConfig } from './stages/validate-config';
import { buildContext } from './stages/build-context';
import { callLLM } from './stages/call-llm';
import { parseIntent } from './stages/parse-intent';
import { validateIntentStage } from './stages/validate-intent';
import { executeIntentStage } from './stages/execute-intent';
import { generateMessageStage } from './stages/generate-message';

// Re-export for route handler
export { isOk, isErr };
export { toHttpStatus };

// Dev mode logging
const isDev = process.env.NODE_ENV === 'development';

function devLog(stage: string, data: unknown): void {
  if (isDev) {
    console.log(`\n[SimpleAgent] === ${stage} ===`);
    console.log(JSON.stringify(data, null, 2));
  }
}

function devLogError(stage: string, error: SimpleAgentError): void {
  if (isDev) {
    console.error(`\n[SimpleAgent] ❌ ${stage} FAILED`);
    console.error(JSON.stringify(error, null, 2));
  }
}

/**
 * Simple Intent processing pipeline
 *
 * @param body - HTTP request body
 * @returns Promise<Result<FinalContext, SimpleAgentError>>
 */
export async function processSimpleIntent(
  body: unknown
): Promise<Result<FinalContext, SimpleAgentError>> {
  devLog('Input', body);

  // Stage 1: Parse request
  const parsed = parseRequest(body);
  if (isErr(parsed)) {
    devLogError('ParseRequest', parsed.error);
    return parsed;
  }
  devLog('Stage 1: ParseRequest', { instruction: parsed.value.instruction });

  // Stage 2: Validate config
  const configured = validateConfig(parsed.value);
  if (isErr(configured)) {
    devLogError('ValidateConfig', configured.error);
    return configured;
  }

  // Stage 3: Build LLM context
  const context = buildContext(configured.value);
  if (isErr(context)) {
    devLogError('BuildContext', context.error);
    return context;
  }
  devLog('Stage 3: BuildContext', {
    userMessageLength: context.value.userMessage.length,
    systemPromptLength: context.value.systemPrompt.length
  });

  // Stage 4: Call LLM (async)
  const llmResult = await callLLM(context.value);
  if (isErr(llmResult)) {
    devLogError('CallLLM', llmResult.error);
    return llmResult;
  }
  devLog('Stage 4: LLM Raw Response', { rawContent: llmResult.value.rawContent });

  // Stage 5: Parse intent JSON
  const intentParsed = parseIntent(llmResult.value);
  if (isErr(intentParsed)) {
    devLogError('ParseIntent', intentParsed.error);
    return intentParsed;
  }
  devLog('Stage 5: Parsed Intent', intentParsed.value.intent);

  // Stage 6: Validate intent schema
  const validated = validateIntentStage(intentParsed.value);
  if (isErr(validated)) {
    devLogError('ValidateIntent', validated.error);
    return validated;
  }

  // Stage 7: Execute intent
  const executed = executeIntentStage(validated.value);
  if (isErr(executed)) {
    devLogError('ExecuteIntent', executed.error);
    return executed;
  }
  devLog('Stage 7: Executed', {
    intentKind: executed.value.intent.kind,
    effectsCount: executed.value.effects.length
  });

  // Stage 8: Generate message
  const final = generateMessageStage(executed.value);
  if (isOk(final)) {
    devLog('Stage 8: Final Result', {
      intentKind: final.value.intent.kind,
      message: final.value.message,
      effectsCount: final.value.effects.length
    });
  }

  return final;
}

/**
 * Convert Result to API response
 *
 * @param result - Pipeline execution result
 * @returns SimpleAgentResponse
 */
export function toResponse(
  result: Result<FinalContext, SimpleAgentError>
): SimpleAgentResponse {
  return match(
    (error: SimpleAgentError): SimpleAgentResponse => ({
      success: false,
      intent: null,
      effects: [],
      message: '',
      error: formatError(error),
    }),
    (ctx: FinalContext): SimpleAgentResponse => ({
      success: true,
      intent: ctx.intent,
      effects: ctx.effects,
      message: ctx.message,
    })
  )(result);
}
