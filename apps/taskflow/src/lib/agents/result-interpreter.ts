/**
 * LLM Result Interpreter
 *
 * ADR 섹션 6: LLM Result Interpreter 설계
 * - 실행 결과를 자연어로 설명한다
 * - 상태를 변경하지 않는다
 * - 결정을 정당화하지 않는다
 *
 * 입력: Intent + Effects + SnapshotDiff
 * 출력: 자연어 설명
 */

import OpenAI from 'openai';
import type { Intent, TaskToCreate, RequestClarificationIntent } from './intent';
import type { AgentEffect } from './types';
import type { Snapshot, SnapshotDiff } from './runtime';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// Interpreter System Prompt
// ============================================

const RESULT_INTERPRETER_SYSTEM_PROMPT = `You are a Result Interpreter. Your job is to describe what happened in natural, friendly language.

## RULES
1. Describe what was done, not what will be done
2. Be concise - 1 sentence only, no extra context
3. Match the user's language (Korean → Korean, English → English)
4. NEVER add task counts or statistics
5. NEVER suggest next actions unless explicitly asked
6. NEVER make decisions or recommendations

## Input Format
You receive:
- intent: What the user wanted
- effects: What changes were made
- snapshotDiff: Before/after comparison

## Output Format (JSON)
{
  "message": "Your natural language description"
}

## Examples

Korean:
- ChangeView to kanban → "칸반 보드로 전환했어요."
- CreateTask 1개 "로그인" → "로그인 태스크를 추가했어요."
- CreateTask 2개 "바나나 사기", "세탁소 가기" → "바나나 사기, 세탁소 가기 태스크를 추가했어요."
- UpdateTask to done → "태스크를 완료 처리했어요."
- DeleteTask → "태스크를 삭제했어요."
- SetDateFilter today → "오늘 마감인 태스크만 보여드려요."
- QueryTasks → "[Query에 대한 답변]"

English:
- ChangeView to table → "Switched to table view."
- CreateTask 1 "Login" → "Added the Login task."
- CreateTask 2 "Buy milk", "Walk dog" → "Added Buy milk and Walk dog tasks."
- UpdateTask to done → "Marked the task as done."
- DeleteTask → "Deleted the task."
- SetDateFilter week → "Showing tasks due this week."`;

// ============================================
// Interpreter Types
// ============================================

export interface InterpreterInput {
  intent: Intent;
  effects: AgentEffect[];
  /** 스냅샷 변경사항 (LLM 컨텍스트에 직렬화됨) */
  snapshotDiff: SnapshotDiff;
  /** @deprecated Use snapshotDiff instead - snapshot은 더 이상 사용되지 않음 */
  snapshot?: Snapshot;
  language: 'ko' | 'en';
  /** QueryTasks용 선택적 컨텍스트 */
  queryContext?: {
    taskCount: number;
    summary?: TasksSummary;
  };
}

export interface InterpreterOutput {
  message: string;
  trace: {
    model: string;
    tokensIn?: number;
    tokensOut?: number;
  };
}

export interface TasksSummary {
  total: number;
  byStatus: {
    todo: number;
    'in-progress': number;
    review: number;
    done: number;
  };
}

// ============================================
// Main Interpreter Function
// ============================================

/**
 * Intent 실행 결과를 자연어로 해석
 *
 * @param input - InterpreterInput
 * @returns Promise<InterpreterOutput>
 */
export async function interpretResult(input: InterpreterInput): Promise<InterpreterOutput> {
  const { intent, effects, snapshotDiff, language } = input;

  // 간단한 경우는 LLM 없이 직접 생성
  const quickMessage = tryQuickInterpretation(intent, snapshotDiff, language);
  if (quickMessage) {
    return {
      message: quickMessage,
      trace: { model: 'local' },
    };
  }

  // 복잡한 경우 LLM 호출
  const contextMessage = buildInterpreterContext(intent, effects, snapshotDiff, language);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: RESULT_INTERPRETER_SYSTEM_PROMPT },
        { role: 'user', content: contextMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 200,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return {
        message: getDefaultMessage(intent, language),
        trace: { model: 'gpt-4o-mini' },
      };
    }

    const parsed = JSON.parse(content) as { message: string };
    return {
      message: parsed.message || getDefaultMessage(intent, language),
      trace: {
        model: 'gpt-4o-mini',
        tokensIn: completion.usage?.prompt_tokens,
        tokensOut: completion.usage?.completion_tokens,
      },
    };
  } catch (e) {
    // Fallback to default message
    return {
      message: getDefaultMessage(intent, language),
      trace: { model: 'fallback' },
    };
  }
}

// ============================================
// Quick Interpretation (No LLM)
// ============================================

/**
 * 간단한 Intent는 LLM 없이 직접 해석
 */
function tryQuickInterpretation(
  intent: Intent,
  diff: SnapshotDiff,
  lang: 'ko' | 'en'
): string | null {
  switch (intent.kind) {
    case 'ChangeView':
      return getViewChangeMessage(intent.viewMode, lang);

    case 'SetDateFilter':
      return getDateFilterMessage(intent.filter, lang);

    case 'SelectTask':
      return getSelectTaskMessage(intent.taskId, lang);

    case 'CreateTask':
      return getCreateTaskMessage(intent.tasks, lang);

    case 'DeleteTask':
      return lang === 'ko' ? '태스크를 삭제했어요.' : 'Deleted the task.';

    case 'RestoreTask':
      return lang === 'ko' ? '태스크를 복원했어요.' : 'Restored the task.';

    case 'Undo':
      return lang === 'ko' ? '마지막 작업을 취소했어요.' : 'Undid the last action.';

    case 'ToggleAssistant':
      return getToggleAssistantMessage(intent.open, lang);

    case 'RequestClarification':
      // LLM이 생성한 question을 그대로 반환
      return (intent as RequestClarificationIntent).question;

    default:
      return null; // LLM 필요
  }
}

function getToggleAssistantMessage(open: boolean, lang: 'ko' | 'en'): string {
  if (open) {
    return lang === 'ko' ? '채팅창을 열었어요.' : 'Opened the chat.';
  }
  return lang === 'ko' ? '채팅창을 닫을게요.' : 'Closing the chat.';
}

function getViewChangeMessage(viewMode: string, lang: 'ko' | 'en'): string {
  const viewNames = {
    kanban: lang === 'ko' ? '칸반 보드' : 'Kanban board',
    table: lang === 'ko' ? '테이블 뷰' : 'Table view',
    todo: lang === 'ko' ? '투두 리스트' : 'Todo list',
  };
  const name = viewNames[viewMode as keyof typeof viewNames] || viewMode;
  return lang === 'ko' ? `${name}로 전환했어요.` : `Switched to ${name}.`;
}

function getDateFilterMessage(filter: { type: string } | null, lang: 'ko' | 'en'): string {
  if (!filter) {
    return lang === 'ko' ? '필터를 해제했어요. 모든 태스크를 보여드려요.' : 'Cleared filters. Showing all tasks.';
  }

  const filterNames = {
    today: lang === 'ko' ? '오늘 마감인' : 'due today',
    week: lang === 'ko' ? '이번 주 마감인' : 'due this week',
    month: lang === 'ko' ? '이번 달 마감인' : 'due this month',
  };
  const name = filterNames[filter.type as keyof typeof filterNames] || filter.type;

  return lang === 'ko'
    ? `${name} 태스크만 보여드려요.`
    : `Showing tasks ${name}.`;
}

function getSelectTaskMessage(taskId: string | null, lang: 'ko' | 'en'): string {
  if (!taskId) {
    return lang === 'ko' ? '태스크 선택을 해제했어요.' : 'Deselected the task.';
  }
  return lang === 'ko' ? '태스크를 선택했어요.' : 'Selected the task.';
}

function getCreateTaskMessage(tasks: TaskToCreate[], lang: 'ko' | 'en'): string {
  if (tasks.length === 0) {
    return lang === 'ko' ? '태스크가 없어요.' : 'No tasks to add.';
  }

  const titles = tasks.map(t => t.title);

  if (tasks.length === 1) {
    return lang === 'ko'
      ? `${titles[0]} 태스크를 추가했어요.`
      : `Added the ${titles[0]} task.`;
  }

  // Multiple tasks
  if (lang === 'ko') {
    return `${titles.join(', ')} 태스크를 추가했어요.`;
  } else {
    const lastTitle = titles.pop();
    return `Added ${titles.join(', ')} and ${lastTitle} tasks.`;
  }
}

// ============================================
// Context Builder
// ============================================

function buildInterpreterContext(
  intent: Intent,
  effects: AgentEffect[],
  diff: SnapshotDiff,
  language: 'ko' | 'en'
): string {
  return `Language: ${language === 'ko' ? 'Korean' : 'English'}

Intent:
${JSON.stringify(intent, null, 2)}

Changes made:
${JSON.stringify(diff, null, 2)}

Generate a single sentence description. Do NOT include task counts or statistics.`;
}

// ============================================
// Helper Functions
// ============================================

function calculateTasksSummary(snapshot: Snapshot): TasksSummary {
  const activeTasks = snapshot.data.tasks.filter(t => !t.deletedAt);
  return {
    total: activeTasks.length,
    byStatus: {
      todo: activeTasks.filter(t => t.status === 'todo').length,
      'in-progress': activeTasks.filter(t => t.status === 'in-progress').length,
      review: activeTasks.filter(t => t.status === 'review').length,
      done: activeTasks.filter(t => t.status === 'done').length,
    },
  };
}

function getDefaultMessage(intent: Intent, lang: 'ko' | 'en'): string {
  const defaults: Record<string, { ko: string; en: string }> = {
    ChangeView: { ko: '뷰를 변경했어요.', en: 'Changed the view.' },
    SetDateFilter: { ko: '필터를 적용했어요.', en: 'Applied the filter.' },
    CreateTask: { ko: '태스크를 추가했어요.', en: 'Added the tasks.' },
    UpdateTask: { ko: '태스크를 수정했어요.', en: 'Updated the task.' },
    DeleteTask: { ko: '태스크를 삭제했어요.', en: 'Deleted the task.' },
    RestoreTask: { ko: '태스크를 복원했어요.', en: 'Restored the task.' },
    SelectTask: { ko: '태스크를 선택했어요.', en: 'Selected the task.' },
    QueryTasks: { ko: '질문에 답변했어요.', en: 'Answered your question.' },
    ToggleAssistant: { ko: '채팅창을 처리했어요.', en: 'Handled the chat.' },
    Undo: { ko: '마지막 작업을 취소했어요.', en: 'Undid the last action.' },
    RequestClarification: { ko: '확인이 필요해요.', en: 'Need clarification.' },
  };

  const msg = defaults[intent.kind];
  return msg ? msg[lang] : (lang === 'ko' ? '완료되었어요.' : 'Done.');
}

// ============================================
// Language Detection
// ============================================

/**
 * 텍스트의 언어 감지
 */
export function detectLanguage(text: string): 'ko' | 'en' {
  const koreanRegex = /[\uAC00-\uD7AF]/;
  return koreanRegex.test(text) ? 'ko' : 'en';
}
