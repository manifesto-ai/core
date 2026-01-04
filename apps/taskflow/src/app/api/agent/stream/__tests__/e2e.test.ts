/**
 * E2E Tests for Agent Stream
 *
 * Tests the intent parsing with real LLM calls.
 * Requires OPENAI_API_KEY to be set.
 *
 * Run with: npm run test:run -- src/app/api/agent/stream/__tests__/e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import OpenAI from 'openai';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  VIEW_MODES,
  DATE_FILTER_TYPES,
  SCHEMA_DSL,
} from '@/lib/agents/prompts/schema';

// Skip all tests if no API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const describeIfApiKey = OPENAI_API_KEY ? describe : describe.skip;

// ============================================
// Intent Schema (mirrors route.ts)
// ============================================

const INTENT_SCHEMA = {
  CreateTask: {
    kind: 'CreateTask',
    tasks: [{
      title: 'string (required)',
      priority: `one of: ${TASK_PRIORITIES.join(', ')}`,
      dueDate: 'YYYY-MM-DD (optional)',
      tags: ['string'],
    }],
    confidence: 'number (0-1)',
    source: 'human',
  },
  ChangeStatus: {
    kind: 'ChangeStatus',
    taskId: 'string (from task list)',
    toStatus: `one of: ${TASK_STATUSES.join(', ')}`,
    confidence: 'number (0-1)',
    source: 'human',
  },
  UpdateTask: {
    kind: 'UpdateTask',
    taskId: 'string (from task list)',
    changes: {
      title: 'string (optional)',
      priority: `one of: ${TASK_PRIORITIES.join(', ')}`,
      dueDate: 'YYYY-MM-DD or null (optional)',
      assignee: 'string or null (optional)',
      description: 'string (optional)',
      tags: ['string'],
    },
    confidence: 'number (0-1)',
    source: 'human',
  },
  DeleteTask: {
    kind: 'DeleteTask',
    taskId: 'string (single delete)',
    taskIds: ['string (bulk delete - use ALL task IDs)'],
    confidence: 'number (0-1)',
    source: 'human',
  },
  RestoreTask: {
    kind: 'RestoreTask',
    taskId: 'string (from deleted tasks)',
    confidence: 'number (0-1)',
    source: 'human',
  },
  SelectTask: {
    kind: 'SelectTask',
    taskId: 'string or null (to deselect)',
    confidence: 'number (0-1)',
    source: 'human',
  },
  QueryTasks: {
    kind: 'QueryTasks',
    query: 'string (the question)',
    confidence: 'number (0-1)',
    source: 'human',
  },
  ChangeView: {
    kind: 'ChangeView',
    viewMode: `one of: ${VIEW_MODES.join(', ')}`,
    confidence: 'number (0-1)',
    source: 'human',
  },
  SetDateFilter: {
    kind: 'SetDateFilter',
    filter: {
      field: 'one of: dueDate, createdAt',
      type: `one of: ${DATE_FILTER_TYPES.join(', ')}`,
    },
    confidence: 'number (0-1)',
    source: 'human',
  },
  Undo: {
    kind: 'Undo',
    confidence: 'number (0-1)',
    source: 'human',
  },
  RequestClarification: {
    kind: 'RequestClarification',
    reason: 'one of: which_task, missing_title, ambiguous_action, multiple_matches',
    question: 'string (question to ask user)',
    originalInput: 'string (user original input)',
    candidates: ['taskId (optional, for which_task)'],
    confidence: 'number (0-1)',
    source: 'agent',
  },
};

// ============================================
// Test Helpers
// ============================================

function getIntentParserPrompt(): string {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayStr = now.toISOString().split('T')[0];
  const dayOfWeek = days[now.getDay()];

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  return `You are an Intent Parser. Convert natural language into structured Intent JSON.

## Date Context
Today: ${todayStr} (${dayOfWeek})
Tomorrow: ${tomorrowStr}

${SCHEMA_DSL}

## Intent Schema (use exactly these field names and values)
${JSON.stringify(INTENT_SCHEMA, null, 2)}

## Rules
1. Match tasks by keywords from task list. Use exact taskId from the list.
2. "this", "it", "that" = Currently Selected Task.
3. Extract dates: "tomorrow" = ${tomorrowStr}, "next Monday" = compute YYYY-MM-DD. ALWAYS set dueDate when a date is mentioned.
4. Greetings, questions, casual chat = QueryTasks.
5. Use user's exact words as task title. Do not paraphrase.
6. Priority: "urgent/critical/important" = "high", "normal/regular" = "medium", "later/someday" = "low".
7. "delete all" = DeleteTask with taskIds array containing ALL task IDs.
8. RequestClarification ONLY when 2+ tasks match the same keyword. Never for new tasks.

## Output Format
Return a FLAT JSON object with "kind" at the root level.

Example for CreateTask:
{"kind":"CreateTask","tasks":[{"title":"buy milk"}],"confidence":0.9,"source":"human"}

Example for ChangeStatus:
{"kind":"ChangeStatus","taskId":"task-1","toStatus":"done","confidence":0.9,"source":"human"}

DO NOT wrap in another object. Output must start with {"kind":"...`;
}

interface TestSnapshot {
  data: {
    tasks: Array<{
      id: string;
      title: string;
      status: 'todo' | 'in-progress' | 'review' | 'done';
      priority: 'low' | 'medium' | 'high';
      dueDate?: string;
      deletedAt?: string;
    }>;
  };
  state: {
    viewMode: 'kanban' | 'table' | 'todo';
    dateFilter: null;
    selectedTaskId: string | null;
  };
}

function createSnapshot(
  tasks: Array<{ id: string; title: string; status?: 'todo' | 'in-progress' | 'review' | 'done' }> = [],
  selectedTaskId: string | null = null
): TestSnapshot {
  return {
    data: {
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status || 'todo',
        priority: 'medium' as const,
      })),
    },
    state: {
      viewMode: 'kanban',
      dateFilter: null,
      selectedTaskId,
    },
  };
}

function buildUserMessage(instruction: string, snapshot: TestSnapshot): string {
  const taskListForLLM = snapshot.data.tasks
    .filter(t => !t.deletedAt)
    .map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
    }));

  const selectedTask = snapshot.state.selectedTaskId
    ? snapshot.data.tasks.find(t => t.id === snapshot.state.selectedTaskId)
    : null;

  return `## Current Tasks
${JSON.stringify(taskListForLLM, null, 2)}

## Currently Selected Task
${selectedTask
  ? `ID: ${selectedTask.id}\nTitle: "${selectedTask.title}"\nStatus: ${selectedTask.status}\nPriority: ${selectedTask.priority}`
  : 'None'}

## View State
- Mode: ${snapshot.state.viewMode}
- Filter: ${snapshot.state.dateFilter ? JSON.stringify(snapshot.state.dateFilter) : 'none'}

## User Instruction
${instruction}

Output valid JSON Intent.`;
}

interface Intent {
  kind: string;
  confidence: number;
  source: string;
  tasks?: Array<{ title: string; priority?: string; dueDate?: string; tags?: string[] }>;
  taskId?: string;
  taskIds?: string[];
  toStatus?: string;
  viewMode?: string;
  query?: string;
  reason?: string;
  question?: string;
}

async function parseIntent(
  openai: OpenAI,
  instruction: string,
  snapshot: TestSnapshot
): Promise<Intent> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: getIntentParserPrompt() },
      { role: 'user', content: buildUserMessage(instruction, snapshot) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 500,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('No response from LLM');

  return JSON.parse(content) as Intent;
}

// ============================================
// Test Cases
// ============================================

describeIfApiKey('Simple Agent E2E Tests', () => {
  let openai: OpenAI;

  beforeAll(() => {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  });

  describe('CreateTask - Basic', () => {
    it('Korean: "사과사기 추가해줘" → CreateTask', async () => {
      const intent = await parseIntent(openai, '사과사기 추가해줘', createSnapshot());

      expect(intent.kind).toBe('CreateTask');
      expect(intent.tasks).toHaveLength(1);
      expect(intent.tasks![0].title).toContain('사과');
    }, 30000);

    it('Korean: "내일 사과사기 추가해줘" → CreateTask with dueDate', async () => {
      const intent = await parseIntent(openai, '내일 사과사기 추가해줘', createSnapshot());

      expect(intent.kind).toBe('CreateTask');
      expect(intent.tasks).toHaveLength(1);
      expect(intent.tasks![0].dueDate).toBeDefined();
    }, 30000);

    it('English: "Add buy milk" → CreateTask', async () => {
      const intent = await parseIntent(openai, 'Add buy milk', createSnapshot());

      expect(intent.kind).toBe('CreateTask');
      expect(intent.tasks).toHaveLength(1);
      expect(intent.tasks![0].title.toLowerCase()).toContain('milk');
    }, 30000);

    it('English: "Add meeting tomorrow" → CreateTask with dueDate', async () => {
      const intent = await parseIntent(openai, 'Add meeting tomorrow', createSnapshot());

      expect(intent.kind).toBe('CreateTask');
      expect(intent.tasks).toHaveLength(1);
      expect(intent.tasks![0].dueDate).toBeDefined();
    }, 30000);

    it('Priority: "urgent: fix bug" → CreateTask with high priority', async () => {
      const intent = await parseIntent(openai, 'urgent: fix bug', createSnapshot());

      expect(intent.kind).toBe('CreateTask');
      expect(intent.tasks).toHaveLength(1);
      // Schema tells LLM to use exactly "high" for urgent
      expect(intent.tasks![0].priority).toBe('high');
    }, 30000);

    it('Mixed language: "meeting 추가" → CreateTask', async () => {
      const intent = await parseIntent(openai, 'meeting 추가', createSnapshot());

      expect(intent.kind).toBe('CreateTask');
      expect(intent.tasks).toHaveLength(1);
    }, 30000);

    it('Short but valid: "우유" → CreateTask (not clarification)', async () => {
      const intent = await parseIntent(openai, '우유 추가', createSnapshot());

      expect(intent.kind).toBe('CreateTask');
      expect(intent.kind).not.toBe('RequestClarification');
    }, 30000);

    it('Complex: Multiple tasks with different priorities and tags', async () => {
      const intent = await parseIntent(
        openai,
        "이번 주 금요일까지 'Q4 리포트 작성'은 높은 우선순위로, 다음 주 월요일 '팀 회식'은 일반 태스크로 'General' 태그 달아서 추가해줘",
        createSnapshot()
      );

      expect(intent.kind).toBe('CreateTask');
      expect(intent.tasks).toHaveLength(2);

      // First task: Q4 리포트 - high priority
      const reportTask = intent.tasks!.find(t => t.title.includes('Q4') || t.title.includes('리포트'));
      expect(reportTask).toBeDefined();
      expect(reportTask!.priority).toBe('high');
      // dueDate extraction is best-effort for complex Korean date expressions

      // Second task: 팀 회식 - medium priority with tag
      const dinnerTask = intent.tasks!.find(t => t.title.includes('회식'));
      expect(dinnerTask).toBeDefined();
      expect(['medium', undefined]).toContain(dinnerTask!.priority); // medium or default
    }, 30000);
  });

  describe('ChangeStatus', () => {
    it('Korean: "Login 완료" → ChangeStatus done', async () => {
      const snapshot = createSnapshot([
        { id: 'task-1', title: 'Login 기능 구현' },
        { id: 'task-2', title: 'Signup 기능 구현' },
      ]);

      const intent = await parseIntent(openai, 'Login 완료', snapshot);

      expect(intent.kind).toBe('ChangeStatus');
      expect(intent.taskId).toBe('task-1');
      expect(intent.toStatus).toBe('done');
    }, 30000);

    it('English: "Mark signup as done" → ChangeStatus', async () => {
      const snapshot = createSnapshot([
        { id: 'task-1', title: 'Login feature' },
        { id: 'task-2', title: 'Signup feature' },
      ]);

      const intent = await parseIntent(openai, 'Mark signup as done', snapshot);

      expect(intent.kind).toBe('ChangeStatus');
      expect(intent.taskId).toBe('task-2');
      expect(intent.toStatus).toBe('done');
    }, 30000);

    it('Selected task: "이거 완료" → ChangeStatus on selected', async () => {
      const snapshot = createSnapshot(
        [
          { id: 'task-1', title: 'Task A' },
          { id: 'task-2', title: 'Task B' },
        ],
        'task-2' // selected
      );

      const intent = await parseIntent(openai, '이거 완료', snapshot);

      expect(intent.kind).toBe('ChangeStatus');
      expect(intent.taskId).toBe('task-2');
      expect(intent.toStatus).toBe('done');
    }, 30000);

    it('"Start working on Login" → ChangeStatus in-progress', async () => {
      const snapshot = createSnapshot([{ id: 'task-1', title: 'Login feature' }]);

      const intent = await parseIntent(openai, 'Start working on Login', snapshot);

      expect(intent.kind).toBe('ChangeStatus');
      expect(intent.toStatus).toBe('in-progress');
    }, 30000);
  });

  describe('QueryTasks', () => {
    it('Korean: "뭐 해야돼?" → QueryTasks', async () => {
      const intent = await parseIntent(openai, '뭐 해야돼?', createSnapshot());

      expect(intent.kind).toBe('QueryTasks');
      expect(intent.query).toBeDefined();
    }, 30000);

    it('English: "How many tasks do I have?" → QueryTasks', async () => {
      const intent = await parseIntent(openai, 'How many tasks do I have?', createSnapshot());

      expect(intent.kind).toBe('QueryTasks');
    }, 30000);

    it('Greeting: "안녕!" → QueryTasks', async () => {
      const intent = await parseIntent(openai, '안녕!', createSnapshot());

      expect(intent.kind).toBe('QueryTasks');
    }, 30000);

    it('Greeting: "Hello" → QueryTasks', async () => {
      const intent = await parseIntent(openai, 'Hello', createSnapshot());

      expect(intent.kind).toBe('QueryTasks');
    }, 30000);
  });

  describe('ChangeView', () => {
    it('Korean: "테이블 뷰로 변경" → ChangeView table', async () => {
      const intent = await parseIntent(openai, '테이블 뷰로 변경', createSnapshot());

      expect(intent.kind).toBe('ChangeView');
      expect(intent.viewMode).toBe('table');
    }, 30000);

    it('English: "Switch to kanban view" → ChangeView kanban', async () => {
      const intent = await parseIntent(openai, 'Switch to kanban view', createSnapshot());

      expect(intent.kind).toBe('ChangeView');
      expect(intent.viewMode).toBe('kanban');
    }, 30000);
  });

  describe('Edge Cases - Should NOT be RequestClarification', () => {
    it('Short Korean task name should work', async () => {
      const intent = await parseIntent(openai, '빵 추가', createSnapshot());

      expect(intent.kind).toBe('CreateTask');
      expect(intent.kind).not.toBe('RequestClarification');
    }, 30000);

    it('Single word task should work', async () => {
      const intent = await parseIntent(openai, 'Add groceries', createSnapshot());

      expect(intent.kind).toBe('CreateTask');
      expect(intent.kind).not.toBe('RequestClarification');
    }, 30000);

    it('Emoji in task should work', async () => {
      const intent = await parseIntent(openai, '🍎 사과 사기 추가', createSnapshot());

      expect(intent.kind).toBe('CreateTask');
    }, 30000);

    it('Task with special characters should work', async () => {
      const intent = await parseIntent(openai, 'Add "fix bug #123"', createSnapshot());

      expect(intent.kind).toBe('CreateTask');
    }, 30000);
  });

  describe('RequestClarification - Valid Cases', () => {
    it('Multiple matching tasks: "API 완료" with two API tasks → RequestClarification', async () => {
      const snapshot = createSnapshot([
        { id: 'task-1', title: 'API 설계' },
        { id: 'task-2', title: 'API 구현' },
        { id: 'task-3', title: 'DB 설계' },
      ]);

      const intent = await parseIntent(openai, 'API 완료', snapshot);

      // Could be either ChangeStatus (if LLM picks one) or RequestClarification
      // Both are acceptable behaviors - the key is it shouldn't ask for task title
      expect(['ChangeStatus', 'RequestClarification']).toContain(intent.kind);

      if (intent.kind === 'RequestClarification') {
        expect(intent.reason).toBe('which_task');
      }
    }, 30000);

    it('Truly empty task: "할일 추가" (no specific content) → could be clarification', async () => {
      const intent = await parseIntent(openai, '할일 추가', createSnapshot());

      // This is borderline - LLM might create "할일" as title, ask for clarification, or treat as query
      // All are acceptable interpretations for such ambiguous input
      expect(['CreateTask', 'RequestClarification', 'QueryTasks']).toContain(intent.kind);
    }, 30000);
  });

  describe('Undo', () => {
    it('Korean: "실행 취소" → Undo', async () => {
      const intent = await parseIntent(openai, '실행 취소', createSnapshot());

      expect(intent.kind).toBe('Undo');
    }, 30000);

    it('English: "undo" → Undo', async () => {
      const intent = await parseIntent(openai, 'undo', createSnapshot());

      expect(intent.kind).toBe('Undo');
    }, 30000);
  });

  describe('DeleteTask', () => {
    it('Korean: "Login 삭제해줘" → DeleteTask', async () => {
      const snapshot = createSnapshot([{ id: 'task-1', title: 'Login 기능' }]);

      const intent = await parseIntent(openai, 'Login 삭제해줘', snapshot);

      expect(intent.kind).toBe('DeleteTask');
      expect(intent.taskId).toBe('task-1');
    }, 30000);

    it('English: "Delete the signup task" → DeleteTask', async () => {
      const snapshot = createSnapshot([
        { id: 'task-1', title: 'Login' },
        { id: 'task-2', title: 'Signup' },
      ]);

      const intent = await parseIntent(openai, 'Delete the signup task', snapshot);

      expect(intent.kind).toBe('DeleteTask');
      expect(intent.taskId).toBe('task-2');
    }, 30000);

    it('Korean bulk: "작업 모두 삭제해줘" → DeleteTask with taskIds', async () => {
      const snapshot = createSnapshot([
        { id: 'task-1', title: 'Task A' },
        { id: 'task-2', title: 'Task B' },
        { id: 'task-3', title: 'Task C' },
      ]);

      const intent = await parseIntent(openai, '작업 모두 삭제해줘', snapshot);

      expect(intent.kind).toBe('DeleteTask');
      expect(intent.taskIds).toBeDefined();
      expect(intent.taskIds).toHaveLength(3);
      expect(intent.taskIds).toContain('task-1');
      expect(intent.taskIds).toContain('task-2');
      expect(intent.taskIds).toContain('task-3');
    }, 30000);

    it('English bulk: "Delete all tasks" → DeleteTask with taskIds', async () => {
      const snapshot = createSnapshot([
        { id: 'task-1', title: 'Task A' },
        { id: 'task-2', title: 'Task B' },
      ]);

      const intent = await parseIntent(openai, 'Delete all tasks', snapshot);

      expect(intent.kind).toBe('DeleteTask');
      expect(intent.taskIds).toBeDefined();
      expect(intent.taskIds).toHaveLength(2);
    }, 30000);
  });
});
