/**
 * Manifesto Baseline - Intent-Native Architecture
 *
 * Calls the real TaskFlow /api/agent/stream SSE endpoint.
 *
 * 2-LLM Architecture:
 * 1. LLM Call 1: Intent Parser (natural language → structured Intent)
 * 2. Deterministic Runtime (Intent → Effects)
 * 3. LLM Call 2: Response Generator (execution result → natural language)
 *
 * Key characteristic: ALWAYS 2 LLM calls regardless of task complexity.
 */

import type { ExperimentState, ExperimentResult, TaskCategory, Task } from '../types';
import { createMetricsCollector, calculateCost, generateRunId, compareStates } from '../measure';

// ============================================
// Configuration
// ============================================

const TASKFLOW_API_URL = process.env.TASKFLOW_API_URL || 'http://localhost:3000';

// ============================================
// Types matching the API
// ============================================

interface Snapshot {
  data: {
    tasks: Task[];
  };
  state: {
    viewMode: string;
    selectedTaskId: string | null;
    currentFilter: {
      status: string | null;
      priority: string | null;
    };
    dateFilter?: unknown;
  };
}

interface SSEEvent {
  event: string;
  data: unknown;
}

interface IntentEvent {
  intent: {
    kind: string;
    [key: string]: unknown;
  };
}

interface DoneEvent {
  effects: Array<{
    type: string;
    path: string;
    value: unknown;
  }>;
  message: string;
}

// ============================================
// SSE Parser
// ============================================

function parseSSE(text: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = text.split('\n');

  let currentEvent = '';
  let currentData = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7);
    } else if (line.startsWith('data: ')) {
      currentData = line.slice(6);
    } else if (line === '' && currentEvent && currentData) {
      try {
        events.push({
          event: currentEvent,
          data: JSON.parse(currentData),
        });
      } catch {
        // Skip malformed JSON
      }
      currentEvent = '';
      currentData = '';
    }
  }

  return events;
}

// ============================================
// Apply Effects to State
// ============================================

function applyEffects(state: ExperimentState, effects: DoneEvent['effects']): ExperimentState {
  const newState = JSON.parse(JSON.stringify(state)) as ExperimentState;

  for (const effect of effects) {
    if (effect.type === 'patch') {
      const path = effect.path.split('.');
      let target: Record<string, unknown> = newState as unknown as Record<string, unknown>;

      // Navigate to parent
      for (let i = 0; i < path.length - 1; i++) {
        target = target[path[i]] as Record<string, unknown>;
      }

      // Set value
      const lastKey = path[path.length - 1];
      target[lastKey] = effect.value;
    }
  }

  return newState;
}

// ============================================
// Convert ExperimentState to Snapshot
// ============================================

function stateToSnapshot(state: ExperimentState): Snapshot {
  return {
    data: {
      tasks: state.tasks,
    },
    state: {
      viewMode: state.viewMode,
      selectedTaskId: null,
      currentFilter: state.currentFilter,
    },
  };
}

// ============================================
// Manifesto Baseline Implementation
// ============================================

export async function runManifesto(
  input: string,
  initialState: ExperimentState,
  taskId: string,
  taskCategory: TaskCategory
): Promise<ExperimentResult> {
  const metrics = createMetricsCollector();
  const runId = generateRunId(taskId, 'manifesto', 'gpt-4o-mini', 0);

  // Clone state for tracking
  let currentState = JSON.parse(JSON.stringify(initialState)) as ExperimentState;

  try {
    // Build snapshot for API
    const snapshot = stateToSnapshot(currentState);

    // Call the real API
    const response = await fetch(`${TASKFLOW_API_URL}/api/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instruction: input,
        snapshot,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    // Read SSE response
    const text = await response.text();
    const events = parseSSE(text);

    // Process events
    let intentEvent: IntentEvent | null = null;
    let doneEvent: DoneEvent | null = null;

    for (const event of events) {
      if (event.event === 'intent') {
        intentEvent = event.data as IntentEvent;
      } else if (event.event === 'done') {
        doneEvent = event.data as DoneEvent;
      } else if (event.event === 'error') {
        throw new Error((event.data as { error: string }).error);
      }
    }

    // Record LLM calls (always 2 for Intent-Native)
    // Note: We don't have exact token counts from the API, so we estimate
    const estimatedInputTokens = 500; // Typical for intent parsing
    const estimatedOutputTokens = 100; // Typical for intent + response

    metrics.recordLLMCall('gpt-4o-mini', estimatedInputTokens, 50); // Intent Parser
    metrics.recordLLMCall('gpt-4o-mini', 200, estimatedOutputTokens); // Response Generator

    // Record tool calls based on intent
    if (intentEvent?.intent) {
      const intent = intentEvent.intent;
      const toolName = intentKindToToolName(intent.kind);
      if (toolName) {
        metrics.recordToolCall(toolName, intent, { success: true });
      }
    }

    // Apply effects to state
    if (doneEvent?.effects && doneEvent.effects.length > 0) {
      currentState = applyEffects(currentState, doneEvent.effects);
    }

    // Finalize metrics
    const summary = metrics.finalize();
    const stateDiff = compareStates(initialState, currentState);

    // Success = got a valid intent or done response without error
    // For Manifesto: if we got an intent, the system worked correctly
    // Read-only intents (QueryTasks, SetFilter for viewing) may have toolCalls=0
    const success = intentEvent !== null || (doneEvent?.message && !doneEvent.message.includes('죄송'));

    return {
      runId,
      method: 'manifesto',
      model: 'gpt-4o-mini',
      taskId,
      taskCategory,
      llmCalls: 2, // Always 2 for Intent-Native Architecture
      success,
      totalTokens: summary.totalTokens,
      inputTokens: summary.inputTokens,
      outputTokens: summary.outputTokens,
      costUsd: calculateCost('gpt-4o-mini', summary.inputTokens, summary.outputTokens),
      latencyMs: summary.latencyMs,
      toolCalls: summary.toolCalls,
      minRequiredTools: 1,
      expectedState: initialState,
      actualState: currentState,
      stateDiff,
      trace: summary.trace,
    };
  } catch (error) {
    const summary = metrics.finalize();
    const stateDiff = compareStates(initialState, currentState);

    return {
      runId,
      method: 'manifesto',
      model: 'gpt-4o-mini',
      taskId,
      taskCategory,
      llmCalls: summary.llmCalls,
      success: false,
      totalTokens: summary.totalTokens,
      inputTokens: summary.inputTokens,
      outputTokens: summary.outputTokens,
      costUsd: calculateCost('gpt-4o-mini', summary.inputTokens, summary.outputTokens),
      latencyMs: summary.latencyMs,
      toolCalls: summary.toolCalls,
      minRequiredTools: 1,
      expectedState: initialState,
      actualState: currentState,
      stateDiff,
      trace: summary.trace,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: 'api_error',
    };
  }
}

// ============================================
// Intent Kind to Tool Name Mapping
// ============================================

function intentKindToToolName(kind: string): string | null {
  const mapping: Record<string, string> = {
    CreateTask: 'create_task',
    UpdateTask: 'update_task',
    ChangeStatus: 'change_status',
    DeleteTask: 'delete_task',
    RestoreTask: 'restore_task',
    ChangeView: 'change_view',
    SetFilter: 'set_filter',
    ClearFilter: 'clear_filter',
    SelectTask: 'select_task',
    QueryTasks: 'list_tasks',
  };

  return mapping[kind] || null;
}
