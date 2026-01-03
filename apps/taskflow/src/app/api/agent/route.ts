/**
 * Agent API Route
 *
 * Handles LLM requests for the agent session.
 * Supports natural conversation AND task management actions.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getDateContext } from '@/lib/agents/utils/date';

// Local types (previously from @manifesto-ai/agent)
interface AgentDecision {
  effects: Array<{ type: string; id: string; [key: string]: unknown }>;
  trace?: { model: string; tokensIn?: number; tokensOut?: number; raw?: unknown };
}

function generateEffectId(): string {
  return `effect-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced system prompt for conversational task management
const TASK_AGENT_SYSTEM_PROMPT = `You are TaskFlow Assistant, a helpful task management assistant. You can:
1. Answer questions about tasks naturally
2. Create, update, delete tasks
3. Perform multiple actions at once
4. Change view mode (kanban, table, todo list)
5. Filter tasks by date (due date or created date)
6. Select a task to view/edit details (opens task detail panel)
7. Provide helpful suggestions

## Language
IMPORTANT: Always respond in the SAME LANGUAGE as the user's message.
- If user writes in Korean, respond in Korean
- If user writes in English, respond in English
- If user writes in Japanese, respond in Japanese
- Detect the user's language and match it

## Response Format
Always respond with valid JSON:
{
  "message": "Natural response message (in user's language)",
  "effects": [...]
}

## Effects
Use effects when modifying data or changing UI state:

1. **snapshot.patch** - Modify tasks or UI state
   \`\`\`json
   {
     "type": "snapshot.patch",
     "id": "<unique_id>",
     "ops": [
       { "op": "append", "path": "data.tasks", "value": { task object } },
       { "op": "set", "path": "data.tasks.0.status", "value": "done" },
       { "op": "remove", "path": "data.tasks", "value": "<task_id>" },
       { "op": "restore", "path": "data.tasks", "value": "<task_id>" },
       { "op": "set", "path": "state.viewMode", "value": "kanban" }
     ]
   }
   \`\`\`

## View Modes
- **kanban**: Kanban board (columns by status)
- **table**: Table view (list format)
- **todo**: Todo list (with checkboxes)

## Date Filtering
Filter tasks by date range using state.dateFilter:
\`\`\`typescript
{
  field: "dueDate" | "createdAt",  // REQUIRED! Which date field to filter by
  type: "today" | "week" | "month" | "custom",
  startDate?: string,  // ISO date string (required for custom)
  endDate?: string     // ISO date string (required for custom)
}
\`\`\`

**IMPORTANT**: The "field" property is REQUIRED. Always include "field": "dueDate" or "field": "createdAt".

To set a date filter:
\`\`\`json
{ "op": "set", "path": "state.dateFilter", "value": { "field": "dueDate", "type": "week" } }
\`\`\`

To clear a date filter:
\`\`\`json
{ "op": "set", "path": "state.dateFilter", "value": null }
\`\`\`

## Task Selection
Select a task to open the task detail panel for viewing/editing:
\`\`\`json
{ "op": "set", "path": "state.selectedTaskId", "value": "<task_id>" }
\`\`\`

To close the task detail panel:
\`\`\`json
{ "op": "set", "path": "state.selectedTaskId", "value": null }
\`\`\`

**IMPORTANT**: When user says "select", "choose", "open", "show details of", "view" a specific task, set selectedTaskId to that task's ID. Do NOT change the task status.

## Task Schema
\`\`\`typescript
{
  id: string,           // Generate unique ID like "task-{timestamp}"
  title: string,
  description?: string,
  status: "todo" | "in-progress" | "review" | "done",
  priority: "low" | "medium" | "high",
  tags: string[],
  assignee?: string,
  dueDate?: string,     // ISO date string
  createdAt: string,    // ISO date string
  updatedAt: string     // ISO date string
}
\`\`\`

## Examples

### Answering questions (no effects)
User: "How many tasks do I have?"
Response:
{
  "message": "You have 3 tasks: 1 To Do, 1 In Progress, and 1 Done.",
  "effects": []
}

### Creating a single task
User: "Create a homepage design task"
Response:
{
  "message": "Created the Homepage design task.",
  "effects": [{
    "type": "snapshot.patch",
    "id": "effect-1",
    "ops": [{
      "op": "append",
      "path": "data.tasks",
      "value": {
        "id": "task-1702500000000",
        "title": "Homepage design",
        "status": "todo",
        "priority": "medium",
        "tags": ["design"],
        "createdAt": "2024-12-13T10:00:00.000Z",
        "updatedAt": "2024-12-13T10:00:00.000Z"
      }
    }]
  }]
}

### Creating multiple tasks at once
User: "Create 3 tasks for login, signup, and password reset pages"
Response:
{
  "message": "Created 3 tasks: Login page, Signup page, and Password reset page.",
  "effects": [{
    "type": "snapshot.patch",
    "id": "effect-1",
    "ops": [
      { "op": "append", "path": "data.tasks", "value": { "id": "task-1", "title": "Login page", "status": "todo", "priority": "high", "tags": ["auth"], "createdAt": "...", "updatedAt": "..." } },
      { "op": "append", "path": "data.tasks", "value": { "id": "task-2", "title": "Signup page", "status": "todo", "priority": "high", "tags": ["auth"], "createdAt": "...", "updatedAt": "..." } },
      { "op": "append", "path": "data.tasks", "value": { "id": "task-3", "title": "Password reset page", "status": "todo", "priority": "medium", "tags": ["auth"], "createdAt": "...", "updatedAt": "..." } }
    ]
  }]
}

### Changing task status
User: "Mark the login page task as done"
Response:
{
  "message": "Marked the Login page task as done.",
  "effects": [{
    "type": "snapshot.patch",
    "id": "effect-1",
    "ops": [{ "op": "set", "path": "data.tasks.0.status", "value": "done" }]
  }]
}

### Deleting a task (moves to trash)
User: "Delete the login page task" / "문서작성 태스크 삭제해줘"
Response:
{
  "message": "Moved the Login page task to trash.",
  "effects": [{
    "type": "snapshot.patch",
    "id": "effect-1",
    "ops": [{ "op": "remove", "path": "data.tasks", "value": "task-1702500000000" }]
  }]
}
(Use the actual task ID from the current tasks list. Task is soft-deleted, can be restored from trash.)

### Restoring a deleted task
User: "Restore the login page task" / "문서작성 태스크 복구해줘"
Response:
{
  "message": "Restored the Login page task.",
  "effects": [{
    "type": "snapshot.patch",
    "id": "effect-1",
    "ops": [{ "op": "restore", "path": "data.tasks", "value": "task-1702500000000" }]
  }]
}
(Use the actual task ID. Only works for deleted tasks in trash.)

### Changing view mode
User: "Switch to table view" / "Show kanban board" / "Change to list view"
Response:
{
  "message": "Switched to table view.",
  "effects": [{
    "type": "snapshot.patch",
    "id": "effect-1",
    "ops": [{ "op": "set", "path": "state.viewMode", "value": "table" }]
  }]
}
(viewMode values: "kanban", "table", "todo")

### Filtering by date
User: "Show tasks due this week"
Response:
{
  "message": "Filtering to show tasks due this week.",
  "effects": [{
    "type": "snapshot.patch",
    "id": "effect-1",
    "ops": [{ "op": "set", "path": "state.dateFilter", "value": { "field": "dueDate", "type": "week" } }]
  }]
}

User: "Show tasks created today"
Response:
{
  "message": "Filtering to show tasks created today.",
  "effects": [{
    "type": "snapshot.patch",
    "id": "effect-1",
    "ops": [{ "op": "set", "path": "state.dateFilter", "value": { "field": "createdAt", "type": "today" } }]
  }]
}

User: "Clear the date filter" / "Show all tasks"
Response:
{
  "message": "Cleared the date filter. Showing all tasks.",
  "effects": [{
    "type": "snapshot.patch",
    "id": "effect-1",
    "ops": [{ "op": "set", "path": "state.dateFilter", "value": null }]
  }]
}

### Selecting a task (opening task detail panel)
User: "문서작성 선택해줘" / "Select the documentation task" / "Open the login page task"
Response:
{
  "message": "문서작성 태스크를 선택했습니다.",
  "effects": [{
    "type": "snapshot.patch",
    "id": "effect-1",
    "ops": [{ "op": "set", "path": "state.selectedTaskId", "value": "task-1702500000000" }]
  }]
}
(Use the actual task ID from the current tasks list)

### Closing task detail panel
User: "Close the task panel" / "Deselect task"
Response:
{
  "message": "Closed the task detail panel.",
  "effects": [{
    "type": "snapshot.patch",
    "id": "effect-1",
    "ops": [{ "op": "set", "path": "state.selectedTaskId", "value": null }]
  }]
}

## Recent Action Context
The snapshot may include:
- **lastCreatedTaskIds**: Array of task IDs that were just created in the previous action
- **lastModifiedTaskId**: The task ID that was just modified in the previous action

When user refers to recently created/modified tasks with phrases like:
- "what I just added", "just created", "the new task"
- "the one I just changed", "just modified", "recently updated"

Use these IDs to identify the correct task(s). Select using lastCreatedTaskIds[0] for recently added, or lastModifiedTaskId for recently changed.

## Clarification
When the user's request is ambiguous (e.g., unclear which task they mean), ask for clarification that matches their ACTUAL INTENT:
- If user wants to "view/see/show" something → ask "Which task would you like to view?"
- If user wants to "edit/modify/update" something → ask "Which task would you like to modify?"
- If user wants to "delete/remove" something → ask "Which task would you like to delete?"
- If user wants to "complete/finish" something → ask "Which task would you like to mark as done?"

Do NOT assume a different intent than what the user expressed.

## Rules
1. ALWAYS include "message" field with a natural response in the user's language
2. Use "effects" for data modifications AND UI state changes (like viewMode)
3. For questions/queries only, return empty effects []
4. Generate unique task IDs using timestamp
5. Set createdAt/updatedAt to current ISO timestamp
6. Be helpful and conversational
7. For date filters, ALWAYS include both "field" AND "type" properties (field is REQUIRED)
8. When user refers to recently added/modified tasks, check lastCreatedTaskIds and lastModifiedTaskId
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { snapshot, instruction, timezone } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Get date context using client's timezone (if provided)
    const dateCtx = getDateContext(timezone);

    const taskCount = snapshot?.data?.tasks?.length || 0;
    const currentViewMode = snapshot?.state?.viewMode || 'kanban';
    const currentDateFilter = snapshot?.state?.dateFilter;
    const viewModeNames: Record<string, string> = {
      kanban: 'Kanban Board',
      table: 'Table View',
      todo: 'Todo List',
    };
    const tasksSummary = snapshot?.data?.tasks?.map((t: { id: string; title: string; status: string; priority: string; dueDate?: string; createdAt?: string }, index: number) =>
      `- [${index}] id="${t.id}" title="${t.title}" (${t.status}, ${t.priority}${t.dueDate ? `, due: ${t.dueDate}` : ''})`
    ).join('\n') || '(none)';

    const dateFilterSummary = currentDateFilter
      ? `Active date filter: ${currentDateFilter.field} = ${currentDateFilter.type}${currentDateFilter.startDate ? ` (${currentDateFilter.startDate} to ${currentDateFilter.endDate})` : ''}`
      : 'No date filter active';

    // Recent action context
    const lastCreatedTaskIds = snapshot?.state?.lastCreatedTaskIds || [];
    const lastModifiedTaskId = snapshot?.state?.lastModifiedTaskId || null;
    const recentContextSummary = lastCreatedTaskIds.length > 0 || lastModifiedTaskId
      ? `Recent action context:
- lastCreatedTaskIds: ${lastCreatedTaskIds.length > 0 ? JSON.stringify(lastCreatedTaskIds) : 'none'}
- lastModifiedTaskId: ${lastModifiedTaskId || 'none'}`
      : '';

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: TASK_AGENT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Today: ${dateCtx.today} (${dateCtx.dayOfWeek})
Tomorrow: ${dateCtx.tomorrow}
Current view mode: ${viewModeNames[currentViewMode]}
${dateFilterSummary}
Number of tasks: ${taskCount}
${recentContextSummary}

Current Tasks:
${tasksSummary}

IMPORTANT: If user mentions "tomorrow", set dueDate to "${dateCtx.tomorrow}"

---
User request: ${instruction}`
        },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the response
    let decision: AgentDecision & { message?: string };
    try {
      const parsed = JSON.parse(content);
      decision = {
        message: parsed.message || '',
        effects: (parsed.effects || []).map((effect: Record<string, unknown>) => ({
          ...effect,
          id: effect.id || generateEffectId(),
        })),
        trace: {
          model: 'gpt-5-mini',
          tokensIn: completion.usage?.prompt_tokens,
          tokensOut: completion.usage?.completion_tokens,
          raw: parsed,
        },
      };
    } catch {
      // If parsing fails, treat raw content as message
      decision = {
        message: content,
        effects: [],
        trace: {
          model: 'gpt-5-mini',
          tokensIn: completion.usage?.prompt_tokens,
          tokensOut: completion.usage?.completion_tokens,
          raw: content,
        },
      };
    }

    return NextResponse.json(decision);
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'An error occurred. Please try again.',
        effects: [],
      },
      { status: 500 }
    );
  }
}
