/**
 * Query Agent
 *
 * Handles QueryTasks intent - answers questions about tasks
 * without modifying any state.
 */

import OpenAI from 'openai';
import type { QueryTasksIntent } from './intent';
import type { Snapshot } from './runtime';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// Query Agent System Prompt
// ============================================

const QUERY_AGENT_SYSTEM_PROMPT = `You are a friendly, conversational task management assistant.

## IMPORTANT: Interpret Questions Generously

Always interpret questions in the context of task management. Short or ambiguous questions should be understood as task-related:
- "Tomorrow?" / "What about tomorrow?" → tasks due tomorrow
- "Today?" → tasks due today
- "This week?" → tasks due this week
- "High priority?" → high priority tasks
- "Done?" → completed tasks

## Selected Task Context

If there is a CURRENTLY SELECTED TASK, these questions refer to it:
- "What is this?", "What am I looking at?"
- "this task", "current task", "selected task"
- "What's the status?"

## QUESTION TYPES

### 1. List/Filter Requests (PRIORITY)
"Show me X tasks", "List X", "What are the X tasks?" → List matching tasks
- "Show me urgent/high priority tasks" → List tasks with priority=high
- "Show me 긴급 tasks" → Same as above (긴급=urgent)
- "List done tasks" → List completed tasks
- "What tasks are in progress?" → List in-progress tasks

Always respond with the actual task list or "No matching tasks found."

### 2. Date-Related Questions
Questions mentioning dates should be answered based on task due dates:
- "Tomorrow?" → Check tasks due tomorrow in the data
- "What should I do today?" → List tasks due today or in-progress
- "This week?" → Tasks due within this week

If no tasks match, say "No tasks due [date]" naturally.

### 3. Selected Task Questions
If a task is selected and the question references "this/current/selected", answer about that task.

### 4. Greetings & Casual Conversation
Greetings like "Hello", "Hi", "Thanks" → Respond naturally and friendly.

### 5. Capability Questions
"What can you do?" → Explain: create tasks, change status, delete/restore, set priority, change views, apply filters.

### 6. Truly Unsupported Features
ONLY redirect for things completely unrelated to tasks: weather forecasts, news, etc.
Do NOT say "unsupported" or ask "what do you want?" for list/filter requests - just show the list.

## RULES
1. Respond in the language specified in the context (Language: Korean/English)
2. Be concise - 1-2 sentences max
3. Be conversational, not robotic
4. NEVER say "I cannot provide information about..." for task-related queries
5. If no tasks match a query, just say so naturally (e.g., "No tasks due tomorrow")

## Output Format (JSON)
You must respond with valid JSON:
{ "answer": "Your response here" }`;

// ============================================
// Query Agent Types
// ============================================

export interface QueryAgentInput {
  intent: QueryTasksIntent;
  snapshot: Snapshot;
  language: 'ko' | 'en';
}

export interface QueryAgentOutput {
  answer: string;
  trace: {
    model: string;
    tokensIn?: number;
    tokensOut?: number;
  };
}

// ============================================
// Main Query Function
// ============================================

export async function executeQuery(input: QueryAgentInput): Promise<QueryAgentOutput> {
  const { intent, snapshot, language } = input;

  // Build context about tasks
  const activeTasks = snapshot.data.tasks.filter(t => !t.deletedAt);
  const deletedTasks = snapshot.data.tasks.filter(t => t.deletedAt);

  // Find the currently selected task
  const selectedTask = snapshot.state.selectedTaskId
    ? activeTasks.find(t => t.id === snapshot.state.selectedTaskId)
    : null;

  const tasksByStatus = {
    todo: activeTasks.filter(t => t.status === 'todo'),
    'in-progress': activeTasks.filter(t => t.status === 'in-progress'),
    review: activeTasks.filter(t => t.status === 'review'),
    done: activeTasks.filter(t => t.status === 'done'),
  };

  const taskListText = activeTasks.length === 0
    ? '(No tasks)'
    : activeTasks
        .map(t => `- "${t.title}" [${t.status}] ${t.priority} priority${t.dueDate ? `, due ${t.dueDate}` : ''}`)
        .join('\n');

  // Build selected task info
  const selectedTaskInfo = selectedTask
    ? `
⭐ CURRENTLY SELECTED TASK:
- Title: "${selectedTask.title}"
- Status: ${selectedTask.status}
- Priority: ${selectedTask.priority}
- Description: ${selectedTask.description || '(none)'}
- Due Date: ${selectedTask.dueDate || '(none)'}
- Tags: ${selectedTask.tags?.length ? selectedTask.tags.join(', ') : '(none)'}

If the user asks about "this", "current", "이거", "지금 보고있는", answer about THIS task.
`
    : '\n(No task is currently selected)\n';

  const contextMessage = `Language: ${language === 'ko' ? 'Korean' : 'English'}

User's question: ${intent.query}
${selectedTaskInfo}
All tasks (${activeTasks.length} total):
${taskListText}

Summary:
- Todo: ${tasksByStatus.todo.length}
- In Progress: ${tasksByStatus['in-progress'].length}
- Review: ${tasksByStatus.review.length}
- Done: ${tasksByStatus.done.length}
- Deleted: ${deletedTasks.length}

Answer the user's question directly.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: QUERY_AGENT_SYSTEM_PROMPT },
        { role: 'user', content: contextMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return {
        answer: getDefaultAnswer(language),
        trace: { model: 'gpt-4o-mini' },
      };
    }

    const parsed = JSON.parse(content) as { answer: string };
    return {
      answer: parsed.answer || getDefaultAnswer(language),
      trace: {
        model: 'gpt-4o-mini',
        tokensIn: completion.usage?.prompt_tokens,
        tokensOut: completion.usage?.completion_tokens,
      },
    };
  } catch {
    return {
      answer: getDefaultAnswer(language),
      trace: { model: 'fallback' },
    };
  }
}

function getDefaultAnswer(language: 'ko' | 'en'): string {
  return language === 'ko'
    ? '질문을 이해하지 못했어요.'
    : "I couldn't understand your question.";
}

// ============================================
// Legacy Adapter (for old orchestrate routes)
// ============================================

import type { QueryAgentInput as LegacyQueryAgentInput, QueryAgentOutput as LegacyQueryAgentOutput } from './types';
import { detectLanguage } from './pattern-matcher';

/**
 * @deprecated Use executeQuery with Intent-Native architecture instead
 */
export async function runQueryAgent(input: LegacyQueryAgentInput): Promise<LegacyQueryAgentOutput> {
  const language = detectLanguage(input.instruction);

  // Build a minimal snapshot from legacy input
  const snapshot: Snapshot = {
    data: {
      tasks: input.tasks.map(t => ({
        id: t.id,
        title: t.title,
        description: null,
        status: t.status,
        priority: t.priority,
        assignee: null,
        dueDate: t.dueDate ?? null,
        tags: t.tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      })),
    },
    state: {
      selectedTaskId: null,
      viewMode: 'todo',
      dateFilter: null,
    },
  };

  const result = await executeQuery({
    intent: {
      kind: 'QueryTasks',
      query: input.instruction,
      confidence: 1.0,
      source: 'human',
    },
    snapshot,
    language,
  });

  return {
    message: result.answer,
    effects: [],
    trace: {
      model: result.trace.model,
      tokensIn: result.trace.tokensIn,
      tokensOut: result.trace.tokensOut,
    },
  };
}
