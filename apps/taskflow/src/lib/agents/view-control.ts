/**
 * ViewControl Agent
 *
 * Specialized agent for UI state management.
 * Handles view mode changes, date filtering, and task selection.
 */

import OpenAI from 'openai';
import type {
  ViewControlInput,
  ViewControlOutput,
  AgentEffect,
  PatchOp,
  ViewMode,
  DateFilter,
} from './types';
import { generateEffectId } from './types';
import { buildSystemPrompt } from './prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ViewControlResponse {
  message: string;
  actions: {
    viewMode?: ViewMode | null;
    dateFilter?: DateFilter | 'clear' | null;
    selectedTaskId?: string | 'clear' | null;
  };
}

export async function runViewControl(
  input: ViewControlInput
): Promise<ViewControlOutput> {
  const { instruction, currentViewMode, currentDateFilter, taskList } = input;

  const taskListContext = taskList
    .map(t => `- id="${t.id}" "${t.title}" (${t.status}${t.dueDate ? `, due: ${t.dueDate}` : ''})`)
    .join('\n') || '(no tasks)';

  const currentFilterContext = currentDateFilter
    ? `${currentDateFilter.field}=${currentDateFilter.type}`
    : 'none';

  // Build system prompt (without examples in production)
  const systemPrompt = buildSystemPrompt('view-control', {
    includeExamples: process.env.NODE_ENV === 'development',
  });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Current state:
- View mode: ${currentViewMode}
- Date filter: ${currentFilterContext}

Tasks:
${taskListContext}

---
User request: ${instruction}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
    max_tokens: 500,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from view control');
  }

  const parsed = JSON.parse(content) as ViewControlResponse;

  // Convert actions to effects
  const ops: PatchOp[] = [];
  let viewModeChanged: ViewMode | undefined;
  let dateFilterChanged: DateFilter | null | undefined;
  let selectedTaskId: string | null | undefined;

  const actions = parsed.actions || {};

  // Handle view mode change
  if (actions.viewMode && actions.viewMode !== currentViewMode) {
    ops.push({
      op: 'set',
      path: 'state.viewMode',
      value: actions.viewMode,
    });
    viewModeChanged = actions.viewMode;
  }

  // Handle date filter change
  if (actions.dateFilter !== undefined && actions.dateFilter !== null) {
    if (actions.dateFilter === 'clear') {
      ops.push({
        op: 'set',
        path: 'state.dateFilter',
        value: null,
      });
      dateFilterChanged = null;
    } else {
      ops.push({
        op: 'set',
        path: 'state.dateFilter',
        value: actions.dateFilter,
      });
      dateFilterChanged = actions.dateFilter;
    }
  }

  // Handle task selection
  if (actions.selectedTaskId !== undefined && actions.selectedTaskId !== null) {
    if (actions.selectedTaskId === 'clear') {
      ops.push({
        op: 'set',
        path: 'state.selectedTaskId',
        value: null,
      });
      selectedTaskId = null;
    } else {
      ops.push({
        op: 'set',
        path: 'state.selectedTaskId',
        value: actions.selectedTaskId,
      });
      selectedTaskId = actions.selectedTaskId;
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
    message: parsed.message || 'View updated',
    effects,
    viewModeChanged,
    dateFilterChanged,
    selectedTaskId,
    trace: {
      model: 'gpt-4o-mini',
      tokensIn: completion.usage?.prompt_tokens,
      tokensOut: completion.usage?.completion_tokens,
      raw: parsed,
    },
  };
}
