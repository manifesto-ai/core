/**
 * Translation Module for Multi-Language Support
 *
 * 비-한영 언어를 영어로 번역하여 Intent Compiler가 처리할 수 있게 합니다.
 * 응답은 원래 언어로 다시 번역합니다.
 *
 * 전략:
 * - GPT-4o-mini 사용 (가볍고 빠름)
 * - 태스크 제목/태그는 번역하지 않고 보존
 * - 명령어 의도만 영어로 변환
 */

import OpenAI from 'openai';
import type { DetectedLanguage } from './language-detector';
import { getLanguageName } from './language-detector';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 45000, // 45초 타임아웃 (Cold Start 대응)
});

// Retry 유틸리티 (Cold Start 대응)
async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.warn(`⚠️ Retrying Translator LLM call... (${retries} left)`);
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

// ============================================
// Types
// ============================================

export interface TranslationContext {
  /** 원본 텍스트 */
  originalText: string;
  /** 감지된 원본 언어 */
  originalLanguage: DetectedLanguage;
  /** 구조화된 명령어 배열 */
  instructions: string[];
  /** 영어로 번역된 텍스트 (레거시 호환) */
  translatedText: string;
  /** 보존된 용어들 (태스크 제목 등) */
  preservedTerms: string[];
}

export interface TranslationResult {
  context: TranslationContext;
  trace: {
    model: string;
    tokensIn?: number;
    tokensOut?: number;
  };
}

// ============================================
// Translation Prompts
// ============================================

const TRANSLATE_TO_ENGLISH_PROMPT = `PARSE input → JSON { instructions: string[], preservedTerms: string[] }

COMMANDS:
  STATUS <name> TO done        - task completed/finished (highest priority)
  STATUS <name> TO in-progress - task started/working
  SELECT <name>                - view/open task (no action)
  CREATE <title> [DUE date]    - new task
  DELETE <name>                - remove task
  VIEW <mode>                  - switch view (kanban|table|todo)
  UNDO                         - cancel/revert last action
  QUERY <question>             - questions about tasks
  CHAT <message>               - greetings, thanks, casual conversation

COMPLETION_SIGNALS (→ STATUS TO done):
  finished | done | completed | ended | all_done

PROGRESS_SIGNALS (→ STATUS TO in-progress):
  working | doing | started | in_progress

VIEW_SIGNALS (→ SELECT):
  view | open | show | see | look | check (without action verb)

CREATE_SIGNALS (→ CREATE):
  add | new | make | need_to | have_to | should

UNDO_SIGNALS (→ UNDO):
  undo | cancel | revert | rollback | go_back

CHAT_SIGNALS (→ CHAT):
  hello | hi | hey | thanks | thank_you | bye | good_morning | good_night
  help | what_can_you_do | who_are_you

DATE_TASK_SIGNALS (→ QUERY, NOT CHAT):
  "오늘 뭐해야해?" → QUERY "What should I do today?"
  "내일 할 일?" → QUERY "What's due tomorrow?"
  "이번 주 일정?" → QUERY "What's due this week?"
  today | tomorrow | this_week | next_week + task/do/schedule → QUERY

LIST_SIGNALS (→ QUERY):
  show_me | list | what_are | which_are | filter
  "Show me X tasks" → QUERY "Show me X tasks"
  "List urgent tasks" → QUERY "List urgent tasks"

PRIORITY: UNDO > STATUS > CREATE > DELETE > SELECT > VIEW > LIST > DATE_TASK > QUERY > CHAT
(DATE_TASK questions are QUERY, not CHAT - check for date words first)

KEYWORD_PATTERNS:
  If input looks like task creation (title + attributes):
  → CREATE <title> [priority X] [DUE date]
  Example: "Bug fix... 높음" → CREATE "Bug fix" priority high
  Example: "Report urgent tomorrow" → CREATE "Report" priority high DUE tomorrow

  Priority keywords: 높음|high|urgent|важно → high
                     중간|medium|normal → medium
                     낮음|low → low

FALLBACK:
  If input is incomplete, ambiguous, or just a date/time expression:
  → QUERY <original input as question>
  Example: "next Wednesday" → QUERY "What about next Wednesday?"
  Example: "来週の水曜日" → QUERY "What about next Wednesday?"

  If truly unclear what user wants:
  → QUERY "What would you like to do with <topic>?"

OUTPUT: Use actual task name from input in preservedTerms`;

const TRANSLATE_RESPONSE_PROMPT = `You are a translation assistant. Translate the following response to {LANGUAGE}.

## Rules
1. Keep the same tone and meaning
2. Keep it concise (1 sentence)
3. PRESERVE any task names/titles exactly as they appear (these are in the original language)
4. Output only the translated text, no JSON or explanations

## Preserved terms (keep as-is):
{PRESERVED_TERMS}

Response to translate:
{RESPONSE}`;

// ============================================
// Main Translation Functions
// ============================================

/**
 * 사용자 입력을 영어로 번역
 *
 * 모든 비-영어 입력을 영어로 번역하여 Intent Compiler가
 * 영어 단일 언어로 처리할 수 있게 합니다.
 *
 * @param text - 원본 텍스트
 * @param language - 감지된 언어
 * @returns TranslationResult
 */
export async function translateToEnglish(
  text: string,
  language: DetectedLanguage
): Promise<TranslationResult> {
  // 영어만 passthrough - 다른 모든 언어(한국어 포함)는 번역
  if (language === 'en') {
    return {
      context: {
        originalText: text,
        originalLanguage: language,
        instructions: [text],
        translatedText: text,
        preservedTerms: [],
      },
      trace: { model: 'passthrough' },
    };
  }

  const languageName = getLanguageName(language);
  const prompt = TRANSLATE_TO_ENGLISH_PROMPT.replace('{LANGUAGE}', languageName);

  try {
    const completion = await withRetry(() =>
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 300,
      })
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      // Fallback: 원본 반환
      return createFallbackResult(text, language);
    }

    const parsed = JSON.parse(content) as {
      instructions?: string[];
      translation?: string;
      preservedTerms: string[];
    };

    // Handle both new format (instructions) and legacy format (translation)
    const instructions = parsed.instructions || (parsed.translation ? [parsed.translation] : [text]);

    return {
      context: {
        originalText: text,
        originalLanguage: language,
        instructions,
        translatedText: instructions.join('; '),
        preservedTerms: parsed.preservedTerms || [],
      },
      trace: {
        model: 'gpt-4o-mini',
        tokensIn: completion.usage?.prompt_tokens,
        tokensOut: completion.usage?.completion_tokens,
      },
    };
  } catch (e) {
    // 에러 시 원본 반환
    return createFallbackResult(text, language);
  }
}

/**
 * 응답을 원래 언어로 번역
 *
 * @param response - 영어 응답
 * @param context - 번역 컨텍스트
 * @returns 번역된 응답
 */
export async function translateResponse(
  response: string,
  context: TranslationContext
): Promise<{ message: string; trace: { model: string; tokensIn?: number; tokensOut?: number } }> {
  const { originalLanguage, preservedTerms } = context;

  // 영어만 passthrough - 다른 모든 언어(한국어 포함)는 원래 언어로 번역
  if (originalLanguage === 'en') {
    return { message: response, trace: { model: 'passthrough' } };
  }

  const languageName = getLanguageName(originalLanguage);
  const preservedTermsStr = preservedTerms.length > 0
    ? preservedTerms.join(', ')
    : '(none)';

  const prompt = TRANSLATE_RESPONSE_PROMPT
    .replace('{LANGUAGE}', languageName)
    .replace('{PRESERVED_TERMS}', preservedTermsStr)
    .replace('{RESPONSE}', response);

  try {
    const completion = await withRetry(() =>
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 200,
      })
    );

    const content = completion.choices[0]?.message?.content;
    return {
      message: content?.trim() || response,
      trace: {
        model: 'gpt-4o-mini',
        tokensIn: completion.usage?.prompt_tokens,
        tokensOut: completion.usage?.completion_tokens,
      },
    };
  } catch (e) {
    // 에러 시 원본 반환
    return { message: response, trace: { model: 'fallback' } };
  }
}

// ============================================
// Helper Functions
// ============================================

function createFallbackResult(text: string, language: DetectedLanguage): TranslationResult {
  return {
    context: {
      originalText: text,
      originalLanguage: language,
      instructions: [text],
      translatedText: text,
      preservedTerms: [],
    },
    trace: { model: 'fallback' },
  };
}

/**
 * 번역이 필요한지 확인
 * 영어 외의 모든 언어는 번역 필요
 */
export function needsTranslation(language: DetectedLanguage): boolean {
  return language !== 'en';
}
