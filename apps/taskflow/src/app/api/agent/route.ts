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
   { "kind": "query", "question": string }

## Rules
- Return EXACTLY ONE JSON object. No markdown, no explanation, no wrapping.
- When referring to existing tasks, use "taskTitle" to match by title (case-insensitive fuzzy match is OK).
- For createTask, default status to "todo" and priority to "medium" if not specified.
- For ambiguous requests, prefer the most likely intent.
- If the user asks a question about tasks (counts, status, etc.) without requesting a change, use "query".
- NEVER return multiple intents. Pick the most important one.
- Your output must be valid JSON parseable by JSON.parse().`;
}

function validateIntent(parsed: Record<string, unknown>): IntentResult | null {
  const kind = parsed.kind;
  if (typeof kind !== 'string' || !VALID_KINDS.includes(kind as (typeof VALID_KINDS)[number])) {
    return null;
  }
  return parsed as unknown as IntentResult;
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

    return NextResponse.json({ intent, message: '', executed: false });
  } catch (error) {
    const errMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { intent: null, message: `LLM error: ${errMessage}`, executed: false },
      { status: 502 },
    );
  }
}
