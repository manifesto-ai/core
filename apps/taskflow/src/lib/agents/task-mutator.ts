/**
 * TaskMutator Agent
 *
 * Specialized agent for modifying existing tasks.
 * Handles status changes, property updates, deletion, and restoration.
 */

import OpenAI from 'openai';
import type {
  TaskMutatorInput,
  TaskMutatorOutput,
  AgentEffect,
  PatchOp,
} from './types';
import { generateEffectId } from './types';
import { buildSystemPrompt } from './prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MutatorOperation {
  type: 'update' | 'delete' | 'restore';
  taskIndex?: number;
  taskId: string;
  changes?: {
    status?: 'todo' | 'in-progress' | 'review' | 'done';
    priority?: 'low' | 'medium' | 'high';
    title?: string;
    description?: string;
    dueDate?: string;
    tags?: string[];
  };
}

interface TaskMutatorResponse {
  message: string;
  operations: MutatorOperation[];
}

export async function runTaskMutator(
  input: TaskMutatorInput
): Promise<TaskMutatorOutput> {
  const { instruction, targetTasks, allTasksForReference } = input;
  const now = new Date().toISOString();

  // Build task context
  const targetTasksContext = targetTasks
    .map(({ index, task }) =>
      `- [index=${index}] id="${task.id}" title="${task.title}" (${task.status}, ${task.priority})`
    )
    .join('\n') || '(no target tasks identified)';

  const allTasksContext = allTasksForReference
    .map((t, i) => `- [${i}] id="${t.id}" "${t.title}" (${t.status})`)
    .join('\n') || '(no tasks)';

  // Build system prompt (without examples in production)
  const systemPrompt = buildSystemPrompt('task-mutator', {
    includeExamples: process.env.NODE_ENV === 'development',
  });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Current time: ${now}

Target tasks for this operation:
${targetTasksContext}

All tasks for reference:
${allTasksContext}

---
User request: ${instruction}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
    max_tokens: 1000,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from task mutator');
  }

  const parsed = JSON.parse(content) as TaskMutatorResponse;

  // Convert operations to effects
  const ops: PatchOp[] = [];
  const mutatedTaskIds: string[] = [];
  const deletedTaskIds: string[] = [];
  const restoredTaskIds: string[] = [];

  for (const operation of parsed.operations || []) {
    switch (operation.type) {
      case 'update':
        if (operation.taskIndex !== undefined && operation.changes) {
          // Add updatedAt to changes
          const changesWithTimestamp = {
            ...operation.changes,
            updatedAt: now,
          };

          // Create individual set operations for each change
          for (const [key, value] of Object.entries(changesWithTimestamp)) {
            ops.push({
              op: 'set',
              path: `data.tasks.${operation.taskIndex}.${key}`,
              value,
            });
          }
          mutatedTaskIds.push(operation.taskId);
        }
        break;

      case 'delete':
        ops.push({
          op: 'remove',
          path: 'data.tasks',
          value: operation.taskId,
        });
        deletedTaskIds.push(operation.taskId);
        break;

      case 'restore':
        ops.push({
          op: 'restore',
          path: 'data.tasks',
          value: operation.taskId,
        });
        restoredTaskIds.push(operation.taskId);
        break;
    }
  }

  const effects: AgentEffect[] = ops.length > 0
    ? [{
        type: 'snapshot.patch',
        id: generateEffectId(),
        ops,
      }]
    : [];

  return {
    message: parsed.message || 'Task(s) modified',
    effects,
    mutatedTaskIds,
    deletedTaskIds,
    restoredTaskIds,
    trace: {
      model: 'gpt-4o-mini',
      tokensIn: completion.usage?.prompt_tokens,
      tokensOut: completion.usage?.completion_tokens,
      raw: parsed,
    },
  };
}
