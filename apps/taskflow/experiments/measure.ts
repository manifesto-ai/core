/**
 * Metrics Collection and Measurement Utilities
 *
 * Provides utilities for tracking LLM calls, tokens, costs, and state comparison.
 */

import type {
  MetricsCollector,
  MetricsSummary,
  TraceEntry,
  ExperimentState,
  StateDiff,
  Task,
} from './types';

// ============================================
// Pricing Data (as of 2026-01)
// ============================================

const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI (per 1K tokens)
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  // Anthropic (per 1K tokens)
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-5-haiku-20241022': { input: 0.0008, output: 0.004 },
};

// ============================================
// Metrics Collector Factory
// ============================================

export function createMetricsCollector(): MetricsCollector {
  const collector: MetricsCollector = {
    llmCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    toolCalls: 0,
    trace: [],
    startTime: Date.now(),

    recordLLMCall(model: string, tokensIn: number, tokensOut: number): void {
      this.llmCalls++;
      this.inputTokens += tokensIn;
      this.outputTokens += tokensOut;
      this.trace.push({
        timestamp: Date.now(),
        type: 'llm_call',
        model,
        tokensIn,
        tokensOut,
      });
    },

    recordToolCall(name: string, args: unknown, result: unknown): void {
      this.toolCalls++;
      this.trace.push({
        timestamp: Date.now(),
        type: 'tool_call',
        toolName: name,
        toolArgs: args,
        toolResult: result,
      });
    },

    finalize(): MetricsSummary {
      return {
        llmCalls: this.llmCalls,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        totalTokens: this.inputTokens + this.outputTokens,
        toolCalls: this.toolCalls,
        latencyMs: Date.now() - this.startTime,
        trace: [...this.trace],
      };
    },
  };

  return collector;
}

// ============================================
// Cost Calculation
// ============================================

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model];
  if (!pricing) {
    console.warn(`Unknown model for pricing: ${model}, using gpt-4o-mini rates`);
    return calculateCost('gpt-4o-mini', inputTokens, outputTokens);
  }

  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

// ============================================
// State Comparison
// ============================================

/**
 * Compare two experiment states and return the difference
 */
export function compareStates(
  expected: ExperimentState,
  actual: ExperimentState
): StateDiff | null {
  const diff: StateDiff = {
    tasksAdded: [],
    tasksUpdated: [],
    tasksDeleted: [],
    stateChanges: {},
  };

  // Create maps for comparison (by title since IDs are generated)
  const expectedByTitle = new Map<string, Task>();
  const actualByTitle = new Map<string, Task>();

  for (const task of expected.tasks.filter((t) => !t.deletedAt)) {
    expectedByTitle.set(task.title.toLowerCase(), task);
  }

  for (const task of actual.tasks.filter((t) => !t.deletedAt)) {
    actualByTitle.set(task.title.toLowerCase(), task);
  }

  // Find added tasks (in actual but not in expected)
  for (const [title] of actualByTitle) {
    if (!expectedByTitle.has(title)) {
      diff.tasksAdded.push(title);
    }
  }

  // Find deleted tasks (in expected but not in actual)
  for (const [title] of expectedByTitle) {
    if (!actualByTitle.has(title)) {
      diff.tasksDeleted.push(title);
    }
  }

  // Find updated tasks (in both but different)
  for (const [title, expectedTask] of expectedByTitle) {
    const actualTask = actualByTitle.get(title);
    if (actualTask) {
      const changes = compareTaskFields(expectedTask, actualTask);
      if (Object.keys(changes).length > 0) {
        diff.tasksUpdated.push({ id: title, changes });
      }
    }
  }

  // Compare state fields
  if (expected.viewMode !== actual.viewMode) {
    diff.stateChanges['viewMode'] = { from: expected.viewMode, to: actual.viewMode };
  }

  if (
    expected.currentFilter.status !== actual.currentFilter.status ||
    expected.currentFilter.priority !== actual.currentFilter.priority
  ) {
    diff.stateChanges['currentFilter'] = {
      from: expected.currentFilter,
      to: actual.currentFilter,
    };
  }

  // Return null if no differences
  if (
    diff.tasksAdded.length === 0 &&
    diff.tasksUpdated.length === 0 &&
    diff.tasksDeleted.length === 0 &&
    Object.keys(diff.stateChanges).length === 0
  ) {
    return null;
  }

  return diff;
}

/**
 * Compare task fields and return differences
 */
function compareTaskFields(expected: Task, actual: Task): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  const fieldsToCompare: (keyof Task)[] = [
    'status',
    'priority',
    'assignee',
    'dueDate',
    'tags',
    'description',
  ];

  for (const field of fieldsToCompare) {
    const expectedValue = expected[field];
    const actualValue = actual[field];

    if (field === 'tags') {
      const expectedTags = (expectedValue as string[]) || [];
      const actualTags = (actualValue as string[]) || [];
      if (!arraysEqual(expectedTags, actualTags)) {
        changes[field] = { expected: expectedTags, actual: actualTags };
      }
    } else if (expectedValue !== actualValue) {
      changes[field] = { expected: expectedValue, actual: actualValue };
    }
  }

  return changes;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

/**
 * Check if states match (ignoring IDs and timestamps)
 */
export function isStateMatch(expected: ExperimentState, actual: ExperimentState): boolean {
  return compareStates(expected, actual) === null;
}

// ============================================
// Minimum Required Tools Calculation
// ============================================

/**
 * Calculate the minimum number of tool calls required for a task
 */
export function computeMinRequiredTools(taskId: string, category: string): number {
  // Based on task category, estimate minimum tools needed
  switch (category) {
    case 'simple':
      return 1; // Usually single operation
    case 'multi-field':
      return 1; // Single create/update with multiple fields
    case 'contextual':
      return 2; // list_tasks + operation
    case 'bulk':
      return 2; // list_tasks + bulk operation
    case 'exception':
      return 3; // list_tasks + conditional logic + operation(s)
    default:
      return 1;
  }
}

// ============================================
// Result Utilities
// ============================================

/**
 * Generate a unique run ID
 */
export function generateRunId(
  taskId: string,
  method: string,
  model: string,
  iteration: number
): string {
  const timestamp = Date.now().toString(36);
  return `${taskId}-${method}-${model.split('-')[0]}-${iteration}-${timestamp}`;
}

/**
 * Format cost in USD with 4 decimal places
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

/**
 * Format latency in human-readable format
 */
export function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

// ============================================
// Consistency Analysis
// ============================================

/**
 * Calculate consistency rate from multiple runs
 */
export function calculateConsistencyRate(results: boolean[]): number {
  if (results.length === 0) return 0;

  // Count most common outcome
  const successCount = results.filter((r) => r).length;
  const failCount = results.length - successCount;

  // Consistency = proportion of most common outcome
  return Math.max(successCount, failCount) / results.length;
}
