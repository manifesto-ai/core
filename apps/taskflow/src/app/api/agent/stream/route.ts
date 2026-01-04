/**
 * Agent Stream API (SSE)
 *
 * 2-LLM Architecture:
 * 1st LLM: Intent parsing (structure user intent)
 * 2nd LLM: Response generation (natural language response based on execution result)
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { Intent } from '@/lib/agents/intent';
import { validateIntent } from '@/lib/agents/intent';
import { executeIntent, type Snapshot } from '@/lib/agents/runtime';
import { parseSemanticFilter, findTasksByFilter } from '@/lib/agents/resolver';
import { ratelimit, getClientId, isRateLimitConfigured } from '@/lib/rate-limit';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  VIEW_MODES,
  DATE_FILTER_TYPES,
  SCHEMA_DSL,
} from '@/lib/agents/prompts/schema';
import type { Task } from '@/manifesto';

// ============================================
// Request Type
// ============================================

interface SimpleIntentRequest {
  instruction: string;
  snapshot: Snapshot;
}

// ============================================
// Semantic Preprocessing
// ============================================

interface SemanticContext {
  matchingTaskIds: string[];
  matchingTasks: { id: string; title: string; status: string; priority: string }[];
  filterDescription: string;
  isBulk: boolean;
}

/**
 * Pre-process instruction to find semantically matching tasks
 * This helps the LLM understand which tasks the user is referring to
 */
function getSemanticContext(instruction: string, tasks: Task[]): SemanticContext | null {
  const activeTasks = tasks.filter(t => !t.deletedAt);
  const filter = parseSemanticFilter(instruction);

  // Only process if it's a bulk semantic filter
  if (!filter.isBulk || filter.titleHint) {
    return null;
  }

  const matchingTasks = findTasksByFilter(filter, activeTasks);

  if (matchingTasks.length === 0) {
    return null;
  }

  // Build filter description
  const descriptions: string[] = [];
  if (filter.priority) descriptions.push(`priority="${filter.priority}"`);
  if (filter.status) descriptions.push(`status="${filter.status}"`);
  if (filter.assignee) descriptions.push(`assignee contains "${filter.assignee}"`);
  if (filter.tags?.length) descriptions.push(`tags include "${filter.tags.join(', ')}"`);
  if (filter.unassigned) descriptions.push('unassigned');

  return {
    matchingTaskIds: matchingTasks.map(t => t.id),
    matchingTasks: matchingTasks.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
    })),
    filterDescription: descriptions.join(' AND '),
    isBulk: true,
  };
}

// ============================================
// Intent Schema Definition (for LLM)
// ============================================

const MEL = `mel
domain Tasks {
  // ===== Type Definitions =====
  type Task = {
    id: string,
    title: string,
    description: string | null,
    status: "todo" | "in-progress" | "review" | "done",
    priority: "low" | "medium" | "high",
    assignee: string | null,
    dueDate: string | null,
    tags: Array<string>,
    createdAt: string,
    updatedAt: string,
    deletedAt: string | null
  }

  type Filter = {
    status: "all" | "todo" | "in-progress" | "review" | "done" | null,
    priority: "all" | "low" | "medium" | "high" | null,
    assignee: string | null
  }

  // ===== State =====
  state {
    // Data
    tasks: Array<Task> = []
    currentFilter: Filter = { status: null, priority: null, assignee: null }

    // UI State
    selectedTaskId: string | null = null
    viewMode: "todo" | "kanban" | "table" | "trash" = "kanban"
    isCreating: boolean = false
    isEditing: boolean = false

    // Intent markers (for re-entry safety)
    createIntent: string | null = null
    updateIntent: string | null = null
    deleteIntent: string | null = null
    moveIntent: string | null = null

    // Filter step markers
    filterStep1: string | null = null
    filterStep2: string | null = null
    filterStep3: string | null = null
    filterStep4: string | null = null
    filterStep5: string | null = null
    filterStep6: string | null = null

    // Derived arrays (populated by effects)
    activeTasks: Array<Task> | null = null
    todoTasks: Array<Task> | null = null
    inProgressTasks: Array<Task> | null = null
    reviewTasks: Array<Task> | null = null
    doneTasks: Array<Task> | null = null
    deletedTasks: Array<Task> | null = null
  }

  // ===== Computed =====

  // Counts
  computed totalCount = len(tasks)
  computed todoCount = isNotNull(todoTasks) ? len(todoTasks) : 0
  computed inProgressCount = isNotNull(inProgressTasks) ? len(inProgressTasks) : 0
  computed reviewCount = isNotNull(reviewTasks) ? len(reviewTasks) : 0
  computed doneCount = isNotNull(doneTasks) ? len(doneTasks) : 0
  computed deletedCount = isNotNull(deletedTasks) ? len(deletedTasks) : 0

  // Selection
  computed hasSelection = isNotNull(selectedTaskId)
  computed canCreate = not(isCreating)
  computed canEdit = and(hasSelection, not(isEditing))
  computed canDelete = hasSelection

  // ===== Actions =====

  // Create Task
  action createTask(
    title: string,
    description: string | null,
    priority: "low" | "medium" | "high",
    dueDate: string | null,
    tags: Array<string>
  ) available when canCreate {
    // Validation
    when eq(trim(title), "") {
      fail "EMPTY_TITLE" with "Task title is required"
    }

    // Create task (once per intent)
    once(createIntent) {
      patch createIntent = $meta.intentId
      patch tasks = concat(tasks, [{
        id: $system.uuid,
        title: trim(title),
        description: description,
        status: "todo",
        priority: priority,
        assignee: null,
        dueDate: dueDate,
        tags: tags,
        createdAt: $system.timestamp,
        updatedAt: $system.timestamp,
        deletedAt: null
      }])
    }
  }

  // Update Task
  action updateTask(
    id: string,
    title: string | null,
    description: string | null,
    priority: "low" | "medium" | "high" | null,
    dueDate: string | null,
    assignee: string | null,
    tags: Array<string> | null
  ) {
    // Update (once per intent)
    once(updateIntent) {
      patch updateIntent = $meta.intentId
      effect array.map({
        source: tasks,
        select: eq($item.id, id)
          ? {
              id: $item.id,
              title: coalesce(title, $item.title),
              description: coalesce(description, $item.description),
              status: $item.status,
              priority: coalesce(priority, $item.priority),
              assignee: coalesce(assignee, $item.assignee),
              dueDate: coalesce(dueDate, $item.dueDate),
              tags: coalesce(tags, $item.tags),
              createdAt: $item.createdAt,
              updatedAt: $system.timestamp,
              deletedAt: $item.deletedAt
            }
          : $item,
        into: tasks
      })
    }
  }

  // Soft Delete Task
  action deleteTask(id: string) available when canDelete {
    once(deleteIntent) {
      patch deleteIntent = $meta.intentId
      effect array.map({
        source: tasks,
        select: eq($item.id, id)
          ? {
              id: $item.id,
              title: $item.title,
              description: $item.description,
              status: $item.status,
              priority: $item.priority,
              assignee: $item.assignee,
              dueDate: $item.dueDate,
              tags: $item.tags,
              createdAt: $item.createdAt,
              updatedAt: $system.timestamp,
              deletedAt: $system.timestamp
            }
          : $item,
        into: tasks
      })
      patch selectedTaskId = null
    }
  }

  // Move Task (change status)
  action moveTask(id: string, newStatus: "todo" | "in-progress" | "review" | "done") {
    once(moveIntent) {
      patch moveIntent = $meta.intentId
      effect array.map({
        source: tasks,
        select: eq($item.id, id)
          ? {
              id: $item.id,
              title: $item.title,
              description: $item.description,
              status: newStatus,
              priority: $item.priority,
              assignee: $item.assignee,
              dueDate: $item.dueDate,
              tags: $item.tags,
              createdAt: $item.createdAt,
              updatedAt: $system.timestamp,
              deletedAt: $item.deletedAt
            }
          : $item,
        into: tasks
      })
    }
  }

  // Select Task
  action selectTask(taskId: string | null) {
    when true {
      patch selectedTaskId = taskId
    }
  }

  // Change View
  action changeView(newViewMode: "todo" | "kanban" | "table" | "trash") {
    when true {
      patch viewMode = newViewMode
    }
  }

  // Restore Task (from trash)
  action restoreTask(id: string) {
    once(updateIntent) {
      patch updateIntent = $meta.intentId
      effect array.map({
        source: tasks,
        select: eq($item.id, id)
          ? {
              id: $item.id,
              title: $item.title,
              description: $item.description,
              status: $item.status,
              priority: $item.priority,
              assignee: $item.assignee,
              dueDate: $item.dueDate,
              tags: $item.tags,
              createdAt: $item.createdAt,
              updatedAt: $system.timestamp,
              deletedAt: null
            }
          : $item,
        into: tasks
      })
    }
  }

  // Filter Tasks by Status (populates derived arrays)
  action refreshFilters() {
    // Filter active tasks (not deleted)
    once(filterStep1) {
      patch filterStep1 = $meta.intentId
      effect array.filter({
        source: tasks,
        where: isNull($item.deletedAt),
        into: activeTasks
      })
    }

    // Filter by status
    once(filterStep2) when isNotNull(activeTasks) {
      patch filterStep2 = $meta.intentId
      effect array.filter({ source: activeTasks, where: eq($item.status, "todo"), into: todoTasks })
    }

    once(filterStep3) when isNotNull(activeTasks) {
      patch filterStep3 = $meta.intentId
      effect array.filter({ source: activeTasks, where: eq($item.status, "in-progress"), into: inProgressTasks })
    }

    once(filterStep4) when isNotNull(activeTasks) {
      patch filterStep4 = $meta.intentId
      effect array.filter({ source: activeTasks, where: eq($item.status, "review"), into: reviewTasks })
    }

    once(filterStep5) when isNotNull(activeTasks) {
      patch filterStep5 = $meta.intentId
      effect array.filter({ source: activeTasks, where: eq($item.status, "done"), into: doneTasks })
    }

    // Filter deleted tasks
    once(filterStep6) {
      patch filterStep6 = $meta.intentId
      effect array.filter({
        source: tasks,
        where: isNotNull($item.deletedAt),
        into: deletedTasks
      })
    }
  }

  // Set Filter
  action setFilter(
    status: "all" | "todo" | "in-progress" | "review" | "done" | null,
    priority: "all" | "low" | "medium" | "high" | null
  ) {
    when true {
      patch currentFilter = { status: status, priority: priority, assignee: null }
    }
  }

  // Clear Filter
  action clearFilter() {
    when true {
      patch currentFilter = { status: null, priority: null, assignee: null }
    }
  }
}
`
// ============================================
// 1st LLM: Intent Parser Prompt
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
${MEL}


## Output Format
Return a FLAT JSON object with "kind" at the root level.

Example for CreateTask:
{"kind":"CreateTask","tasks":[{"title":"buy milk"}],"confidence":0.9,"source":"human"}

Example for ChangeStatus (single):
{"kind":"ChangeStatus","taskId":"task-1","toStatus":"done","confidence":0.9,"source":"human"}

Example for ChangeStatus (bulk - multiple tasks):
{"kind":"ChangeStatus","taskIds":["task-1","task-2"],"toStatus":"done","confidence":0.9,"source":"human"}

Example for UpdateTask (single):
{"kind":"UpdateTask","taskId":"task-1","changes":{"priority":"high"},"confidence":0.9,"source":"human"}

Example for UpdateTask (bulk - multiple tasks):
{"kind":"UpdateTask","taskIds":["task-1","task-2"],"changes":{"priority":"medium"},"confidence":0.9,"source":"human"}

## Bulk Operations
When a Semantic Match section is provided with matching task IDs, use those IDs directly in the taskIds array.
For example, if matching task IDs are ["task-004", "task-005"] and user wants to change priority:
{"kind":"UpdateTask","taskIds":["task-004","task-005"],"changes":{"priority":"medium"},"confidence":0.9,"source":"human"}

## Default Title Generation
If the user wants to create a task but doesn't specify a title, generate a contextually appropriate default title.
Examples:
- "태스크 하나 만들어줘" → {"kind":"CreateTask","tasks":[{"title":"새 태스크"}],...}
- "add a task" → {"kind":"CreateTask","tasks":[{"title":"New Task"}],...}
- "할 일 추가해줘" → {"kind":"CreateTask","tasks":[{"title":"새 할 일"}],...}
NEVER request clarification for missing titles - always generate a default.

DO NOT wrap in another object. Output must start with {"kind":"...`;
}

// ============================================
// 2nd LLM: Response Generator
// ============================================

function getResponseGeneratorPrompt(): string {
  return `You are a friendly Task Assistant. Generate natural responses.

## Rules
1. Respond in the SAME LANGUAGE as the user's original request
2. Be concise (1-2 sentences)
3. For success: confirm what was done
4. For errors: apologize briefly and suggest what user can try
5. For queries: answer based on task data
6. For greetings: respond warmly
7. Be friendly and helpful

## Output Format (JSON)
{ "message": "your response" }`;
}

interface ResponseGeneratorInput {
  instruction: string;
  intent: Intent | null;
  executionResult: { success: boolean; error?: string; effects: unknown[] };
  snapshot: Snapshot;
  errorContext?: string;
}

async function generateResponse(
  openai: OpenAI,
  input: ResponseGeneratorInput
): Promise<string> {
  const { instruction, intent, executionResult, snapshot, errorContext } = input;

  const activeTasks = snapshot.data.tasks.filter(t => !t.deletedAt);
  const tasksSummary = {
    total: activeTasks.length,
    byStatus: {
      todo: activeTasks.filter(t => t.status === 'todo').length,
      'in-progress': activeTasks.filter(t => t.status === 'in-progress').length,
      review: activeTasks.filter(t => t.status === 'review').length,
      done: activeTasks.filter(t => t.status === 'done').length,
    },
  };

  let taskContext = '';
  if (intent?.kind === 'QueryTasks') {
    taskContext = `\n\n## Task List
${activeTasks.map(t => `- "${t.title}" (${t.status}, ${t.priority}${t.dueDate ? `, due: ${t.dueDate}` : ''})`).join('\n')}`;
  }

  let actionInfo = '';
  if (intent) {
    actionInfo = `## Action
- Intent: ${intent.kind}
- Result: ${executionResult.success ? 'SUCCESS' : `FAILED - ${executionResult.error}`}`;

    if (intent.kind === 'CreateTask') {
      actionInfo += `\n- Created: ${(intent as { tasks: { title: string }[] }).tasks.map(t => t.title).join(', ')}`;
    } else if (intent.kind === 'ChangeStatus') {
      actionInfo += `\n- Status: ${(intent as { toStatus: string }).toStatus}`;
    } else if (intent.kind === 'DeleteTask') {
      const delIntent = intent as { taskId?: string; taskIds?: string[] };
      const count = delIntent.taskIds?.length ?? (delIntent.taskId ? 1 : 0);
      actionInfo += `\n- Deleted: ${count} task(s)`;
    }
  } else if (errorContext) {
    actionInfo = `## Error
- Type: Processing error
- Context: ${errorContext}`;
  }

  const userMessage = `## User Request
"${instruction}"

${actionInfo}

## Current State
- Tasks: ${tasksSummary.total} (todo: ${tasksSummary.byStatus.todo}, in-progress: ${tasksSummary.byStatus['in-progress']}, done: ${tasksSummary.byStatus.done})
- View: ${snapshot.state.viewMode}${taskContext}

Generate a natural response.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: getResponseGeneratorPrompt() },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 200,
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content) as { message: string };
      if (parsed.message) {
        return parsed.message;
      }
    }
  } catch (e) {
    console.error('Response generation failed:', e);
  }

  return intent ? getDefaultMessage(intent) : 'Something went wrong. Please try again.';
}

function getDefaultMessage(intent: Intent): string {
  const messages: Record<string, string> = {
    CreateTask: 'Added the task.',
    ChangeStatus: 'Changed the status.',
    UpdateTask: 'Updated the task.',
    DeleteTask: 'Deleted the task.',
    RestoreTask: 'Restored the task.',
    SelectTask: 'Selected the task.',
    QueryTasks: "Here's what I found.",
    ChangeView: 'Changed the view.',
    SetDateFilter: 'Applied the filter.',
    Undo: 'Undid the last action.',
    RequestClarification: (intent as { question?: string }).question || 'Need clarification.',
  };

  return messages[intent.kind] || 'Done.';
}

// ============================================
// SSE Helper
// ============================================

function sendSSE(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

// ============================================
// Main Handler (2-LLM Architecture)
// ============================================

export async function POST(request: NextRequest) {
  // Rate limiting
  if (isRateLimitConfigured()) {
    const clientId = getClientId(request);
    const { success, limit, reset, remaining } = await ratelimit.limit(clientId);

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      );
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      let openai: OpenAI | null = null;
      let instruction = '';
      let snapshot: Snapshot | null = null;

      try {
        const body: SimpleIntentRequest = await request.json();
        instruction = body.instruction;
        snapshot = body.snapshot;

        console.log('[simple/stream] ========== REQUEST START ==========');
        console.log('[simple/stream] Instruction:', instruction);
        console.log('[simple/stream] Snapshot tasks count:', snapshot?.data?.tasks?.length ?? 0);
        console.log('[simple/stream] View mode:', snapshot?.state?.viewMode);

        if (!instruction) {
          console.error('[simple/stream] ERROR: Missing instruction');
          sendSSE(controller, 'error', { error: 'Instruction is required' });
          controller.close();
          return;
        }

        if (!snapshot) {
          console.error('[simple/stream] ERROR: Missing snapshot');
          sendSSE(controller, 'error', { error: 'Snapshot is required' });
          controller.close();
          return;
        }

        if (!process.env.OPENAI_API_KEY) {
          console.error('[simple/stream] ERROR: OPENAI_API_KEY not configured');
          sendSSE(controller, 'error', { error: 'OPENAI_API_KEY not configured' });
          controller.close();
          return;
        }

        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // 1. Start event
        sendSSE(controller, 'start', {});

        // 2. Build user message for Intent Parser
        const activeTasks = snapshot.data.tasks.filter(t => !t.deletedAt);
        const taskListForLLM = activeTasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          assignee: t.assignee,
          tags: t.tags,
          dueDate: t.dueDate,
        }));

        const selectedTaskId = snapshot.state.selectedTaskId;
        const selectedTask = selectedTaskId
          ? activeTasks.find(t => t.id === selectedTaskId)
          : null;

        // Get semantic context for bulk operations
        const semanticContext = getSemanticContext(instruction, snapshot.data.tasks);
        console.log('[simple/stream] Semantic context:', semanticContext);

        // Build semantic hint section if we have matching tasks
        let semanticHint = '';
        if (semanticContext && semanticContext.matchingTaskIds.length > 0) {
          semanticHint = `\n## Semantic Match (IMPORTANT!)
The user's instruction matches ${semanticContext.matchingTaskIds.length} task(s) by filter: ${semanticContext.filterDescription}

**Matching Task IDs**: ${JSON.stringify(semanticContext.matchingTaskIds)}
**Matching Tasks**:
${semanticContext.matchingTasks.map(t => `- ${t.id}: "${t.title}" (${t.status}, ${t.priority})`).join('\n')}

For bulk operations on these tasks, use taskIds array in the intent.
Example: {"kind":"UpdateTask","taskIds":${JSON.stringify(semanticContext.matchingTaskIds)},"changes":{"priority":"medium"},"confidence":0.9,"source":"human"}
`;
        }

        const intentParserMessage = `## Current Tasks
${JSON.stringify(taskListForLLM, null, 2)}

## Currently Selected Task
${selectedTask
  ? `ID: ${selectedTask.id}\nTitle: "${selectedTask.title}"\nStatus: ${selectedTask.status}\nPriority: ${selectedTask.priority}`
  : 'None'}

## View State
- Mode: ${snapshot.state.viewMode}
- Filter: ${snapshot.state.dateFilter ? JSON.stringify(snapshot.state.dateFilter) : 'none'}
${semanticHint}
## User Instruction
${instruction}

Output valid JSON Intent.`;

        // 3. 1st LLM: Intent Parsing
        const intentCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: getIntentParserPrompt() },
            { role: 'user', content: intentParserMessage },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 500,
        });

        const intentContent = intentCompletion.choices[0]?.message?.content;
        console.log('[simple/stream] LLM Intent response:', intentContent);

        if (!intentContent) {
          console.error('[simple/stream] ERROR: Empty intent response from LLM');
          const message = await generateResponse(openai, {
            instruction,
            intent: null,
            executionResult: { success: false, error: 'No response from parser', effects: [] },
            snapshot,
            errorContext: 'Intent parser returned empty response',
          });
          sendSSE(controller, 'done', { effects: [], message });
          controller.close();
          return;
        }

        // 4. Parse Intent JSON
        let intent: Intent;
        try {
          intent = JSON.parse(intentContent);
          console.log('[simple/stream] Parsed intent:', JSON.stringify(intent, null, 2));
        } catch (parseError) {
          console.error('[simple/stream] ERROR: Failed to parse intent JSON:', parseError);
          const message = await generateResponse(openai, {
            instruction,
            intent: null,
            executionResult: { success: false, error: 'Invalid JSON', effects: [] },
            snapshot,
            errorContext: 'Could not parse intent as JSON',
          });
          sendSSE(controller, 'done', { effects: [], message });
          controller.close();
          return;
        }

        // 5. Validate Intent
        const validation = validateIntent(intent);
        console.log('[simple/stream] Validation result:', validation);

        if (!validation.valid) {
          console.error('[simple/stream] ERROR: Intent validation failed:', validation.errors);
          const message = await generateResponse(openai, {
            instruction,
            intent: null,
            executionResult: { success: false, error: validation.errors.join(', '), effects: [] },
            snapshot,
            errorContext: `Validation failed: ${validation.errors.join(', ')}`,
          });
          sendSSE(controller, 'done', { effects: [], message });
          controller.close();
          return;
        }

        // 6. Send intent event
        sendSSE(controller, 'intent', { intent });

        // 7. Execute Intent
        console.log('[simple/stream] Executing intent...');
        const executionResult = executeIntent(intent, snapshot);
        console.log('[simple/stream] Execution result:', {
          success: executionResult.success,
          error: executionResult.error,
          effectsCount: executionResult.effects.length,
        });
        console.log('[simple/stream] Effects detail:', JSON.stringify(executionResult.effects, null, 2));

        // 8. 2nd LLM: Generate Response
        const message = await generateResponse(openai, {
          instruction,
          intent,
          executionResult,
          snapshot,
        });
        console.log('[simple/stream] Generated message:', message);

        // 9. Send done event
        console.log('[simple/stream] Sending done event with effects:', executionResult.effects.length);
        sendSSE(controller, 'done', {
          effects: executionResult.success ? executionResult.effects : [],
          message,
        });

        console.log('[simple/stream] ========== REQUEST END ==========');
        controller.close();
      } catch (error) {
        // Try to generate friendly error message if possible
        if (openai && snapshot) {
          try {
            const message = await generateResponse(openai, {
              instruction,
              intent: null,
              executionResult: { success: false, error: 'Unexpected error', effects: [] },
              snapshot,
              errorContext: error instanceof Error ? error.message : 'Unknown error',
            });
            sendSSE(controller, 'done', { effects: [], message });
          } catch {
            sendSSE(controller, 'error', {
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        } else {
          sendSSE(controller, 'error', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
