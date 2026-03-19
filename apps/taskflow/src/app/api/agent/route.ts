import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import type { AgentRequest, AgentResponse, IntentResult } from '@/types/intent';

const VALID_KINDS = [
  'createTask',
  'updateTask',
  'moveTask',
  'deleteTask',
  'restoreTask',
  'emptyTrash',
  'selectTask',
  'changeView',
  'query',
] as const;

function buildSystemPrompt(
  tasks: AgentRequest['tasks'],
  viewMode: string,
): string {
  const taskList =
    tasks.length === 0
      ? 'No tasks exist yet.'
      : tasks
          .map(
            (t) =>
              `- "${t.title}" (id: ${t.id}, status: ${t.status}, priority: ${t.priority}${t.deletedAt ? ', DELETED' : ''})`,
          )
          .join('\n');

  return `You are the TaskFlow Intent Compiler. Your ONLY job is to convert natural language into a single Intent JSON object.

## Current State
View mode: ${viewMode}
Tasks:
${taskList}

## Available Intent Types

1. createTask — Create a new task
   { "kind": "createTask", "task": { "title": string, "description"?: string, "status"?: "todo"|"in-progress"|"review"|"done", "priority"?: "low"|"medium"|"high", "assignee"?: string, "dueDate"?: string (ISO 8601), "tags"?: string[] } }

2. updateTask — Update an existing task (match by title)
   { "kind": "updateTask", "taskTitle": string, "fields": { "title"?: string, "description"?: string, "status"?: "todo"|"in-progress"|"review"|"done", "priority"?: "low"|"medium"|"high", "assignee"?: string, "dueDate"?: string, "tags"?: string[] } }

3. moveTask — Change a task's status
   { "kind": "moveTask", "taskTitle": string, "newStatus": "todo"|"in-progress"|"review"|"done" }

4. deleteTask — Soft-delete a task
   { "kind": "deleteTask", "taskTitle": string }

5. restoreTask — Restore a deleted task
   { "kind": "restoreTask", "taskTitle": string }

6. emptyTrash — Permanently delete all trashed tasks
   { "kind": "emptyTrash" }

7. selectTask — Select a task for detail view
   { "kind": "selectTask", "taskTitle": string | null }

8. changeView — Switch the view mode
   { "kind": "changeView", "viewMode": "kanban"|"todo"|"table"|"trash" }

9. query — Answer a question about the current tasks (no state change)
   { "kind": "query", "question": string, "answer": string }
   The "answer" field MUST contain your natural language answer to the user's question.

## Rules
- Return EXACTLY ONE JSON object. No markdown, no explanation, no wrapping.
- When referring to existing tasks, use "taskTitle" to match by title (case-insensitive fuzzy match is OK).
- For createTask, default status to "todo" and priority to "medium" if not specified.
- For ambiguous requests, prefer the most likely intent.
- If the user asks a question about tasks (counts, status, etc.) without requesting a change, use "query".
- NEVER return multiple intents. Pick the most important one.
- Your output must be valid JSON parseable by JSON.parse().`;
}

const VALID_STATUSES = ['todo', 'in-progress', 'review', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_VIEW_MODES = ['kanban', 'todo', 'table', 'trash'];

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isStringOrNull(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

function isOptionalStringArray(v: unknown): v is string[] | undefined {
  return v === undefined || (Array.isArray(v) && v.every((x) => typeof x === 'string'));
}

function validateTaskFields(fields: unknown): fields is Record<string, unknown> {
  if (typeof fields !== 'object' || fields === null) return false;
  const f = fields as Record<string, unknown>;
  if (f.status !== undefined && !VALID_STATUSES.includes(f.status as string)) return false;
  if (f.priority !== undefined && !VALID_PRIORITIES.includes(f.priority as string)) return false;
  if (f.title !== undefined && !isString(f.title)) return false;
  if (f.assignee !== undefined && !isStringOrNull(f.assignee)) return false;
  if (f.dueDate !== undefined && !isStringOrNull(f.dueDate)) return false;
  if (!isOptionalStringArray(f.tags)) return false;
  return true;
}

function validateIntent(parsed: Record<string, unknown>): IntentResult | null {
  const kind = parsed.kind;
  if (typeof kind !== 'string' || !VALID_KINDS.includes(kind as (typeof VALID_KINDS)[number])) {
    return null;
  }

  switch (kind) {
    case 'createTask': {
      const task = parsed.task;
      if (typeof task !== 'object' || task === null) return null;
      const t = task as Record<string, unknown>;
      if (!isString(t.title) || t.title.length === 0) return null;
      if (!validateTaskFields(t)) return null;
      return parsed as unknown as IntentResult;
    }
    case 'updateTask': {
      if (!isString(parsed.taskTitle) || parsed.taskTitle.length === 0) return null;
      if (!validateTaskFields(parsed.fields)) return null;
      return parsed as unknown as IntentResult;
    }
    case 'moveTask': {
      if (!isString(parsed.taskTitle)) return null;
      if (!isString(parsed.newStatus) || !VALID_STATUSES.includes(parsed.newStatus)) return null;
      return parsed as unknown as IntentResult;
    }
    case 'deleteTask':
    case 'restoreTask': {
      if (!isString(parsed.taskTitle)) return null;
      return parsed as unknown as IntentResult;
    }
    case 'emptyTrash': {
      return parsed as unknown as IntentResult;
    }
    case 'selectTask': {
      if (!isStringOrNull(parsed.taskTitle)) return null;
      return parsed as unknown as IntentResult;
    }
    case 'changeView': {
      if (!isString(parsed.viewMode) || !VALID_VIEW_MODES.includes(parsed.viewMode)) return null;
      return parsed as unknown as IntentResult;
    }
    case 'query': {
      if (!isString(parsed.question)) return null;
      return parsed as unknown as IntentResult;
    }
    default:
      return null;
  }
}

export async function POST(request: Request): Promise<NextResponse<AgentResponse>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        intent: null,
        message: 'ANTHROPIC_API_KEY is not configured. Set it in your environment to enable the assistant.',
        executed: false,
      },
      { status: 503 },
    );
  }

  let body: AgentRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { intent: null, message: 'Invalid request body.', executed: false },
      { status: 400 },
    );
  }

  const { message, tasks, viewMode } = body;
  if (!message || typeof message !== 'string') {
    return NextResponse.json(
      { intent: null, message: 'Message is required.', executed: false },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: buildSystemPrompt(tasks ?? [], viewMode ?? 'kanban'),
      messages: [{ role: 'user', content: message }],
    });

    const text =
      response.content[0]?.type === 'text' ? response.content[0].text : '';

    // Parse the intent JSON from the LLM response
    let parsed: Record<string, unknown>;
    try {
      // Strip potential markdown code fences
      const cleaned = text.replace(/^```(?:json)?\s*\n?/g, '').replace(/\n?```\s*$/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // LLM returned non-JSON — treat as a query response
      return NextResponse.json({
        intent: { kind: 'query', question: message } as IntentResult,
        message: text,
        executed: false,
      });
    }

    const intent = validateIntent(parsed);
    if (!intent) {
      return NextResponse.json({
        intent: null,
        message: `Could not understand the request. LLM returned: ${text}`,
        executed: false,
      });
    }

    const message = intent.kind === 'query' && 'answer' in intent && typeof intent.answer === 'string'
      ? intent.answer
      : '';

    return NextResponse.json({ intent, message, executed: false });
  } catch (error) {
    const errMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { intent: null, message: `LLM error: ${errMessage}`, executed: false },
      { status: 502 },
    );
  }
}
