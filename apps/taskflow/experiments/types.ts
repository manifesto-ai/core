/**
 * ICML 2026 Experiment Types
 *
 * Shared type definitions for Intent-Native Architecture comparison experiments.
 */

// ============================================
// Domain Types (Task Management)
// ============================================

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type ViewMode = 'kanban' | 'table' | 'todo';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ExperimentState {
  tasks: Task[];
  viewMode: ViewMode;
  currentFilter: {
    status: TaskStatus | null;
    priority: TaskPriority | null;
  };
}

// ============================================
// TaskBench Types
// ============================================

export type TaskCategory = 'simple' | 'multi-field' | 'contextual' | 'bulk' | 'exception';
export type TaskLevel = 1 | 2 | 3 | 4 | 5;

export interface TaskBenchItem {
  /** Task ID: L1-01, L2-05, etc. */
  id: string;
  /** Natural language command */
  input: string;
  /** Complexity category */
  category: TaskCategory;
  /** Complexity level (1-5) */
  level: TaskLevel;
  /** Expected fields to extract (for multi-field) */
  expectedFields?: string[];
  /** Required capability (for contextual) */
  requires?: string;
  /** Operation type (for bulk/exception) */
  operation?: string;
}

// ============================================
// Experiment Methods
// ============================================

export type ExperimentMethod = 'manifesto' | 'react' | 'openai-func' | 'claude-tool';

export type ManifestoModel = 'gpt-4o-mini';
export type OpenAIModel = 'gpt-4o-mini' | 'gpt-4o';
export type ClaudeModel = 'claude-3-5-sonnet-20241022' | 'claude-3-5-haiku-20241022';
export type AnyModel = ManifestoModel | OpenAIModel | ClaudeModel;

// ============================================
// Trace Types
// ============================================

export interface TraceEntry {
  timestamp: number;
  type: 'llm_call' | 'tool_call' | 'response';
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  content?: string;
}

// ============================================
// State Comparison
// ============================================

export interface StateDiff {
  tasksAdded: string[];
  tasksUpdated: Array<{ id: string; changes: Record<string, unknown> }>;
  tasksDeleted: string[];
  stateChanges: Record<string, { from: unknown; to: unknown }>;
}

// ============================================
// Experiment Result
// ============================================

export interface ExperimentResult {
  // Identification
  runId: string;
  method: ExperimentMethod;
  model: string;
  taskId: string;
  taskCategory: TaskCategory;

  // Primary Metrics
  llmCalls: number;
  success: boolean;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;

  // Secondary Metrics
  toolCalls: number;
  minRequiredTools: number;

  // State Comparison
  expectedState: ExperimentState;
  actualState: ExperimentState;
  stateDiff: StateDiff | null;

  // Trace
  trace: TraceEntry[];

  // Error (if failed)
  error?: string;
  errorType?: 'api_error' | 'timeout' | 'validation_error';

  // Consistency (optional, for sampled tasks)
  consistencyRuns?: number;
  consistencyRate?: number;
}

// ============================================
// Metrics Collector Interface
// ============================================

export interface MetricsCollector {
  llmCalls: number;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  trace: TraceEntry[];
  startTime: number;

  recordLLMCall(model: string, tokensIn: number, tokensOut: number): void;
  recordToolCall(name: string, args: unknown, result: unknown): void;
  finalize(): MetricsSummary;
}

export interface MetricsSummary {
  llmCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  toolCalls: number;
  latencyMs: number;
  trace: TraceEntry[];
}

// ============================================
// Baseline Function Signatures
// ============================================

export type ManifestoBaseline = (
  input: string,
  initialState: ExperimentState
) => Promise<ExperimentResult>;

export type OpenAIFunctionsBaseline = (
  input: string,
  initialState: ExperimentState,
  model: OpenAIModel
) => Promise<ExperimentResult>;

export type ClaudeToolsBaseline = (
  input: string,
  initialState: ExperimentState,
  model: ClaudeModel
) => Promise<ExperimentResult>;

export type ReActBaseline = (
  input: string,
  initialState: ExperimentState,
  model: OpenAIModel
) => Promise<ExperimentResult>;

// ============================================
// MCP Tool Interface
// ============================================

export interface MCPToolResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

export interface MCPServerInstance {
  resetState(initialState: ExperimentState): void;
  getState(): ExperimentState;
  executeTool(name: string, args: unknown): Promise<MCPToolResult>;
  getToolsAsOpenAI(): OpenAITool[];
  getToolsAsClaude(): ClaudeTool[];
  getToolNames(): string[];
}

// Provider-specific tool formats
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

// ============================================
// Runner Options
// ============================================

export interface RunnerOptions {
  /** Specific task IDs to run (default: all) */
  subset?: string[];
  /** Specific methods to run (default: all) */
  methods?: ExperimentMethod[];
  /** Number of repetitions for consistency testing */
  repeat?: number;
  /** Output file path */
  output?: string;
  /** Verbose logging */
  verbose?: boolean;
}

// ============================================
// Analysis Types
// ============================================

export interface MethodSummary {
  method: ExperimentMethod;
  model: string;
  avgLLMCalls: number;
  avgTokens: number;
  avgCost: number;
  avgLatency: number;
  successRate: number;
  totalRuns: number;
}

export interface CategoryBreakdown {
  category: TaskCategory;
  results: Record<string, MethodSummary>;
}
