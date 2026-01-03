/**
 * Stage 4: Call LLM
 *
 * OpenAI API 호출
 */

import OpenAI from 'openai';
import { Result, Ok, Err } from '../result';
import { Errors, SimpleAgentError, LLMContext, LLMResponseContext } from '../types';

/**
 * OpenAI LLM 호출
 *
 * @param context - LLM 컨텍스트 (시스템 프롬프트, 사용자 메시지)
 * @returns Promise<Result<LLMResponseContext, SimpleAgentError>>
 */
export async function callLLM(
  context: LLMContext
): Promise<Result<LLMResponseContext, SimpleAgentError>> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: context.systemPrompt },
        { role: 'user', content: context.userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return Err(Errors.llm('No response from LLM'));
    }

    return Ok({
      input: context.input,
      rawContent: content,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown LLM error';
    return Err(Errors.llm(message, e));
  }
}
