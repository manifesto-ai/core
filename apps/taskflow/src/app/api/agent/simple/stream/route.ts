/**
 * Simple Intent API Stream Route (SSE)
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
import { ratelimit, getClientId, isRateLimitConfigured } from '@/lib/rate-limit';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  VIEW_MODES,
  DATE_FILTER_TYPES,
  SCHEMA_DSL,
} from '@/lib/agents/prompts/schema';

// ============================================
// Request Type
// ============================================

interface SimpleIntentRequest {
  instruction: string;
  snapshot: Snapshot;
}

// ============================================
// Intent Schema Definition (for LLM)
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
          dueDate: t.dueDate,
        }));

        const selectedTaskId = snapshot.state.selectedTaskId;
        const selectedTask = selectedTaskId
          ? activeTasks.find(t => t.id === selectedTaskId)
          : null;

        const intentParserMessage = `## Current Tasks
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
