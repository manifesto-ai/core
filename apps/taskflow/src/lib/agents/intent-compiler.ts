/**
 * LLM Intent Compiler (Skeleton IR)
 *
 * 핵심 원칙: LLM 출력에 ID가 들어가면 설계가 틀린 것이다.
 *
 * LLM은 "의미 파서(Parser)"로만 동작한다:
 * - 자연어를 Skeleton IR로 변환
 * - targetHint만 출력 (taskId 절대 금지)
 * - Symbol Resolver가 바인딩을 수행
 *
 * 금지 사항:
 * ❌ taskId 생성 (targetHint만 허용)
 * ❌ Effect 생성
 * ❌ Clarification 생성 (Resolver가 담당)
 */

import OpenAI from 'openai';
import type { IntentSkeleton, SkeletonKind } from './skeleton';
import { validateSkeleton, SKELETON_KINDS } from './skeleton';
import type { Snapshot } from './runtime';
import { SCHEMA_VERSION, TASK_STATUSES, TASK_PRIORITIES, VIEW_MODES } from './prompts/schema';
import { getDateContext } from './utils/date';

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
      console.warn(`⚠️ Retrying LLM call... (${retries} left)`);
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

// ============================================
// Skeleton Compiler System Prompt
// ============================================

const SKELETON_COMPILER_SYSTEM_PROMPT = `COMPILE instruction → JSON

OUTPUT ::= { kind, confidence: 0.9, source: "human", ...KIND_FIELDS }

KIND_FIELDS ::=
  | ChangeStatus  { targetHint: string, toStatus: STATUS }
  | SelectTask    { targetHint: string }
  | UpdateTask    { targetHint: string, changes: {} }
  | DeleteTask    { targetHint: string }
  | CreateTask    { tasks: [{ title, dueDate? }] }
  | ChangeView    { viewMode: VIEW }
  | QueryTasks    { query: string }
  | Undo          {}

STATUS ::= todo | in-progress | review | done
VIEW ::= kanban | table | todo

RULES:
  /working|doing|started/ → toStatus: in-progress
  /done|finished|completed/ → toStatus: done
  /undo|cancel|revert|rollback/ → kind: Undo

  # Greetings & casual chat → QueryTasks
  /^CHAT\s/ → QueryTasks (use message as query)
  /^QUERY\s/ → QueryTasks (use question as query)
  /hello|hi|hey|thanks|thank you|bye|good morning|good night/ → QueryTasks
  /what can you do|help me/ → QueryTasks

  # Questions → QueryTasks
  /\?$|^what|^how|^which|^when|^where|^who|^why/ → QueryTasks

⚠️ CRITICAL: DO NOT output taskId. Use targetHint with the user's text.
   Example: "보고서 완료" → { targetHint: "보고서" } NOT { taskId: "t_xxx" }`;

// ============================================
// Compiler Input/Output Types
// ============================================

/**
 * Fast Path Hint (from pattern-matcher)
 * Skeleton Compiler의 판단을 돕는 힌트 - 최종 결정권은 Compiler에게 있음
 */
export interface FastPathHint {
  likelyKind: 'view' | 'filter' | 'status';
  confidence: number;
  matchedPatterns: string[];
  slots: {
    viewMode?: 'kanban' | 'table' | 'todo';
    dateFilter?: { field: string; type: string } | 'clear';
    status?: 'todo' | 'in-progress' | 'review' | 'done';
  };
}

export interface CompilerInput {
  instruction: string;
  snapshot: Snapshot;
  /** Optional hint from fast path pattern matching */
  hint?: FastPathHint;
  /** IANA timezone string (e.g., 'Asia/Seoul', 'America/New_York') */
  timezone?: string;
}

export interface CompilerOutput {
  skeleton: IntentSkeleton;
  raw: unknown;
  trace: {
    model: string;
    tokensIn?: number;
    tokensOut?: number;
  };
}

export interface CompilerError {
  type: 'validation' | 'parsing' | 'api' | 'unknown';
  message: string;
  raw?: unknown;
}

// ============================================
// Main Compiler Function
// ============================================

/**
 * 자연어 명령을 Skeleton IR로 컴파일
 *
 * @param input - CompilerInput
 * @returns Promise<CompilerOutput | CompilerError>
 */
export async function compileIntent(
  input: CompilerInput
): Promise<CompilerOutput | CompilerError> {
  const { instruction, snapshot, hint, timezone } = input;

  // Build context message
  let contextMessage = buildContextMessage(snapshot, timezone);

  // Add hint context if available
  if (hint) {
    contextMessage += `

---
Pattern Analysis Hint:
- Likely intent type: ${hint.likelyKind}
- Confidence: ${(hint.confidence * 100).toFixed(0)}%
- Matched patterns: ${hint.matchedPatterns.join(', ')}
${hint.slots.viewMode ? `- Suggested viewMode: ${hint.slots.viewMode}` : ''}
${hint.slots.dateFilter ? `- Suggested dateFilter: ${typeof hint.slots.dateFilter === 'string' ? hint.slots.dateFilter : hint.slots.dateFilter.type}` : ''}
${hint.slots.status ? `- Suggested status: ${hint.slots.status}` : ''}

NOTE: This is a pattern-based hint only. You make the final decision.
If the user seems to be creating a task, ignore the hint.`;
  }

  try {
    const completion = await withRetry(() =>
      openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: SKELETON_COMPILER_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `${contextMessage}

---
User instruction: ${instruction}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 1000,
      })
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return {
        type: 'api',
        message: 'No response from LLM',
      };
    }

    // Parse response
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      return {
        type: 'parsing',
        message: 'Failed to parse LLM response as JSON',
        raw: content,
      };
    }

    // Handle both wrapped { skeleton: {...} } and unwrapped skeleton formats
    const skeleton = (parsed as { skeleton?: unknown }).skeleton || parsed;

    const validation = validateSkeleton(skeleton);
    if (!validation.valid) {
      return {
        type: 'validation',
        message: `Skeleton validation failed: ${validation.errors.join(', ')}`,
        raw: parsed,
      };
    }

    return {
      skeleton: skeleton as IntentSkeleton,
      raw: parsed,
      trace: {
        model: 'gpt-5-mini',
        tokensIn: completion.usage?.prompt_tokens,
        tokensOut: completion.usage?.completion_tokens,
      },
    };
  } catch (e) {
    return {
      type: 'api',
      message: e instanceof Error ? e.message : 'Unknown API error',
    };
  }
}

// ============================================
// Context Builder
// ============================================

function buildContextMessage(snapshot: Snapshot, timezone?: string): string {
  const activeTasks = snapshot.data.tasks.filter(t => !t.deletedAt);
  const deletedTasks = snapshot.data.tasks.filter(t => t.deletedAt);

  // Task list with IDs for LLM to pick from
  const tasksList = activeTasks
    .map(t => `- id:"${t.id}" title:"${t.title}"`)
    .join('\n') || '(no tasks)';

  const deletedList = deletedTasks.length > 0
    ? `\nDeleted: ${deletedTasks.map(t => `id:"${t.id}" "${t.title}"`).join(', ')}`
    : '';

  const dateCtx = getDateContext(timezone);

  return `Tasks:
${tasksList}${deletedList}

Today: ${dateCtx.today}, Tomorrow: ${dateCtx.tomorrow}`;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Compiler 결과가 성공인지 확인
 */
export function isCompilerSuccess(result: CompilerOutput | CompilerError): result is CompilerOutput {
  return 'skeleton' in result;
}

/**
 * Compiler 결과가 에러인지 확인
 */
export function isCompilerError(result: CompilerOutput | CompilerError): result is CompilerError {
  return 'type' in result && 'message' in result;
}

/**
 * Skeleton confidence가 임계값 이상인지 확인
 */
export function meetsConfidenceThreshold(skeleton: IntentSkeleton, threshold: number = 0.7): boolean {
  return skeleton.confidence >= threshold;
}

// ============================================
// Legacy Compatibility (Intent type export)
// ============================================

// For backwards compatibility with existing code that imports Intent
export type { Intent } from './intent';
export { validateIntent, INTENT_KINDS } from './intent';
