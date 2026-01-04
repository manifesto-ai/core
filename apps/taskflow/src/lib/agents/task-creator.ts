/**
 * TaskCreator Agent
 *
 * Specialized agent for creating new tasks.
 * Handles single task and batch task creation.
 */

import OpenAI from 'openai';
import type { Task } from '@/manifesto';
import type {
  TaskCreatorInput,
  TaskCreatorOutput,
  AgentEffect,
  PatchOp,
} from './types';
import { generateEffectId } from './types';
import { buildSystemPrompt } from './prompts';
import { getDateContext } from './utils/date';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TaskCreatorResponse {
  message: string;
  tasks: Array<{
    title: string;
    description?: string;
    status: 'todo';
    priority: 'low' | 'medium' | 'high';
    tags: string[];
    dueDate?: string;
  }>;
}

export async function runTaskCreator(
  input: TaskCreatorInput
): Promise<TaskCreatorOutput> {
  const { instruction, currentTaskCount, existingTags, timezone } = input;
  const now = new Date().toISOString();

  console.log('[task-creator] ========== START ==========');
  console.log('[task-creator] Input:', { instruction, currentTaskCount, existingTags, timezone });

  // Get date context using client's timezone (if provided)
  const dateCtx = getDateContext(timezone);
  console.log('[task-creator] Date context:', dateCtx);

  // Build system prompt (without examples in production)
  const systemPrompt = buildSystemPrompt('task-creator', {
    includeExamples: process.env.NODE_ENV === 'development',
  });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Today: ${dateCtx.today} (${dateCtx.dayOfWeek})
Tomorrow: ${dateCtx.tomorrow}
Current task count: ${currentTaskCount}
Existing tags in system: ${existingTags.join(', ') || 'none'}

IMPORTANT: If user mentions "tomorrow", use dueDate: "${dateCtx.tomorrow}"

---
User request: ${instruction}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 1000,
  });

  const content = completion.choices[0]?.message?.content;
  console.log('[task-creator] LLM response content:', content);

  if (!content) {
    console.error('[task-creator] ERROR: No response from LLM');
    throw new Error('No response from task creator');
  }

  const parsed = JSON.parse(content) as TaskCreatorResponse;
  console.log('[task-creator] Parsed response:', parsed);

  // Convert to full Task objects and build effects
  const createdTasks: Task[] = [];
  const ops: PatchOp[] = [];

  for (const taskData of parsed.tasks || []) {
    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: taskData.title,
      description: taskData.description ?? null,
      status: 'todo',
      priority: taskData.priority || 'medium',
      assignee: null,
      tags: taskData.tags || [],
      dueDate: taskData.dueDate ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    createdTasks.push(task);
    ops.push({
      op: 'append',
      path: 'data.tasks',
      value: task,
    });
  }

  const effects: AgentEffect[] = ops.length > 0
    ? [{
        type: 'snapshot.patch',
        id: generateEffectId(),
        ops,
      }]
    : [];

  console.log('[task-creator] Created tasks:', createdTasks);
  console.log('[task-creator] Effects:', JSON.stringify(effects, null, 2));
  console.log('[task-creator] ========== END ==========');

  return {
    message: parsed.message || `Created ${createdTasks.length} task(s)`,
    effects,
    createdTasks,
    trace: {
      model: 'gpt-4o-mini',
      tokensIn: completion.usage?.prompt_tokens,
      tokensOut: completion.usage?.completion_tokens,
      raw: parsed,
    },
  };
}
