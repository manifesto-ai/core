/**
 * LLM Planner
 *
 * 자연어 → Plan JSON 변환
 *
 * 핵심 원칙:
 * - LLM은 계획(Plan)만 작성, 실행은 Runtime이 담당
 * - taskId 절대 금지 (targetHint만 사용)
 * - 파괴적 작업은 confirm step 포함 유도
 * - 멀티스텝 가능 (여러 intent를 steps로 구성)
 */

import OpenAI from 'openai';
import type { Plan, RiskLevel } from './plan';
import { validatePlan } from './plan';
import type { Snapshot } from './runtime';
import { getDateContext } from './utils/date';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 45000,
});

// Retry utility
async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.warn(`⚠️ Retrying Planner LLM call... (${retries} left)`);
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

// ============================================
// Planner System Prompt
// ============================================

const PLANNER_SYSTEM_PROMPT = `COMPILE instruction → Plan JSON

OUTPUT ::= {
  version: 1,
  goal: string,        // 1-sentence summary of user intent
  steps: Step[],       // 1+ steps
  risk?: "low"|"medium"|"high"
}

STEP ::=
  | { kind: "intent", skeleton: SKELETON }
  | { kind: "query", query: QUERY, assign?: string }
  | { kind: "if", cond: COND, then: Step[], else?: Step[] }
  | { kind: "confirm", message: string, onApprove: Step[], onReject?: Step[] }
  | { kind: "note", text: string }

SKELETON ::= { kind, confidence: 0.9, source: "human", ...FIELDS }

SKELETON_KINDS:
  ChangeStatus  { targetHint: string, toStatus: STATUS }
  SelectTask    { targetHint: string }
  UpdateTask    { targetHint: string, changes: CHANGES }
  DeleteTask    { targetHint: string }
  CreateTask    { tasks: [{ title, description?, dueDate?, priority? }] }
  ChangeView    { viewMode: VIEW }
  QueryTasks    { query: string }
  Undo          {}

CHANGES ::= { title?, description?, priority?, dueDate?, tags? }

STATUS ::= todo | in-progress | review | done
VIEW ::= kanban | table | todo
PRIORITY ::= low | medium | high

QUERY ::=
  | { kind: "countTasks", filter?: FILTER }
  | { kind: "findTask", hint: string }
  | { kind: "listTasks", filter?: FILTER, limit?: number }

FILTER ::= { status?, priority?, tags?, deleted? }

COND ::=
  | { op: "lt"|"lte"|"gt"|"gte"|"eq"|"neq", left: VAR|VALUE, right: VAR|VALUE }
  | { op: "exists"|"notExists", var: VAR }
  | { op: "and"|"or"|"not", items: COND[] }

VAR ::= { var: string }
VALUE ::= string | number | boolean | null

RULES:
  1. MULTI-STEP: For compound requests, use multiple steps
     "Add report and mark it done" → [CreateTask, ChangeStatus]
     "Delete all done tasks" → [confirm with DeleteTask steps]

  2. DESTRUCTIVE = confirm REQUIRED:
     DeleteTask, RestoreTask, bulk changes → wrap in confirm step
     { kind: "confirm", message: "Delete 3 tasks?", onApprove: [...] }

  3. NO taskId: Use targetHint with user's text
     "보고서 완료" → { targetHint: "보고서" } NOT { taskId: "t_xxx" }

  4. SELECTED TASK CONTEXT:
     If user says "add description", "change priority", "mark done" WITHOUT specifying task name,
     AND there is a selected task in context, use targetHint: "selected" or the selected task's title
     "설명 추가해" (with selected task) → UpdateTask { targetHint: "selected", changes: { description: "..." } }

  6. GREETINGS/CHAT → intent with QueryTasks skeleton
     "hello", "thanks" → { kind: "intent", skeleton: { kind: "QueryTasks", query: "greeting", ... } }

  7. QUESTIONS → intent with QueryTasks skeleton
     "what's due tomorrow?" → { kind: "intent", skeleton: { kind: "QueryTasks", query: "...", ... } }

  8. RISK assessment:
     - low: view changes, single create, select
     - medium: multiple creates, updates
     - high: deletes, bulk operations

  9. UNDO → { kind: "Undo" }

NOTE: "query" step vs "QueryTasks" skeleton are DIFFERENT:
  - "query" step: for internal queries with QuerySpec object (countTasks, findTask, listTasks)
  - "QueryTasks" skeleton: for natural language questions, ALWAYS wrapped in "intent" step

EXAMPLES:

Input: "Add meeting task for tomorrow"
Output:
{
  "version": 1,
  "goal": "Create meeting task due tomorrow",
  "steps": [
    { "kind": "intent", "skeleton": {
      "kind": "CreateTask",
      "tasks": [{ "title": "Meeting", "dueDate": "2024-01-16" }],
      "confidence": 0.9,
      "source": "human"
    }}
  ],
  "risk": "low"
}

Input: "Complete the report and delete old tasks"
Output:
{
  "version": 1,
  "goal": "Complete report and delete old tasks",
  "steps": [
    { "kind": "intent", "skeleton": {
      "kind": "ChangeStatus",
      "targetHint": "report",
      "toStatus": "done",
      "confidence": 0.9,
      "source": "human"
    }},
    { "kind": "confirm", "message": "Delete old tasks?", "onApprove": [
      { "kind": "intent", "skeleton": {
        "kind": "DeleteTask",
        "targetHint": "old tasks",
        "confidence": 0.8,
        "source": "human"
      }}
    ]}
  ],
  "risk": "high"
}

Input: "Hello" or "안녕?"
Output:
{
  "version": 1,
  "goal": "Respond to greeting",
  "steps": [
    { "kind": "intent", "skeleton": {
      "kind": "QueryTasks",
      "query": "greeting",
      "confidence": 0.9,
      "source": "human"
    }}
  ],
  "risk": "low"
}

Input: "지갑 가져가기라고 설명 추가해" (with selected task "백화점 가기")
Output:
{
  "version": 1,
  "goal": "Add description to selected task",
  "steps": [
    { "kind": "intent", "skeleton": {
      "kind": "UpdateTask",
      "targetHint": "백화점 가기",
      "changes": { "description": "지갑 가져가기" },
      "confidence": 0.9,
      "source": "human"
    }}
  ],
  "risk": "low"
}`;

// ============================================
// Planner Input/Output Types
// ============================================

export interface PlannerInput {
  instruction: string;
  snapshot: Snapshot;
  timezone?: string;
  /** Translated instructions (from translator) */
  translatedInstructions?: string[];
}

export interface PlannerOutput {
  plan: Plan;
  raw: unknown;
  trace: {
    model: string;
    tokensIn?: number;
    tokensOut?: number;
  };
}

export interface PlannerError {
  type: 'validation' | 'parsing' | 'api' | 'unknown';
  message: string;
  raw?: unknown;
}

// ============================================
// Main Planner Function
// ============================================

/**
 * 자연어 명령을 Plan으로 컴파일
 */
export async function createPlan(
  input: PlannerInput
): Promise<PlannerOutput | PlannerError> {
  const { instruction, snapshot, timezone, translatedInstructions } = input;

  // Use translated instructions if available
  const effectiveInstruction = translatedInstructions?.length
    ? translatedInstructions.join('; ')
    : instruction;

  const contextMessage = buildContextMessage(snapshot, timezone);

  try {
    const completion = await withRetry(() =>
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: PLANNER_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `${contextMessage}\n\n---\nUser instruction: ${effectiveInstruction}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1500,
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
    } catch {
      return {
        type: 'parsing',
        message: 'Failed to parse LLM response as JSON',
        raw: content,
      };
    }

    // Validate plan
    const validation = validatePlan(parsed);
    if (!validation.valid) {
      return {
        type: 'validation',
        message: `Plan validation failed: ${validation.errors.join(', ')}`,
        raw: parsed,
      };
    }

    return {
      plan: parsed as Plan,
      raw: parsed,
      trace: {
        model: 'gpt-4o-mini',
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

  const tasksList = activeTasks.length > 0
    ? activeTasks
        .map(t => `- "${t.title}" [${t.status}]${t.dueDate ? ` due:${t.dueDate}` : ''}`)
        .join('\n')
    : '(no tasks)';

  const deletedList = deletedTasks.length > 0
    ? `\nDeleted: ${deletedTasks.map(t => `"${t.title}"`).join(', ')}`
    : '';

  // Selected task context
  const selectedTaskId = snapshot.state.selectedTaskId;
  const selectedTask = selectedTaskId
    ? activeTasks.find(t => t.id === selectedTaskId)
    : null;
  const selectedInfo = selectedTask
    ? `\n\n⭐ SELECTED TASK: "${selectedTask.title}" [${selectedTask.status}]`
    : '';

  const dateCtx = getDateContext(timezone);

  return `Tasks:\n${tasksList}${deletedList}${selectedInfo}\n\nToday: ${dateCtx.today}, Tomorrow: ${dateCtx.tomorrow}`;
}

// ============================================
// Helper Functions
// ============================================

export function isPlannerSuccess(result: PlannerOutput | PlannerError): result is PlannerOutput {
  return 'plan' in result;
}

export function isPlannerError(result: PlannerOutput | PlannerError): result is PlannerError {
  return 'type' in result && 'message' in result;
}

// ============================================
// Legacy Adapter (for gradual migration)
// ============================================

/**
 * Plan에서 첫 번째 Intent Skeleton만 추출 (임시 호환용)
 *
 * PR1 단계에서는 기존 파이프라인과 연결하기 위해
 * Plan의 첫 intent만 추출해서 사용
 */
export function extractFirstSkeleton(plan: Plan) {
  for (const step of plan.steps) {
    if (step.kind === 'intent') {
      return step.skeleton;
    }
  }
  return null;
}
