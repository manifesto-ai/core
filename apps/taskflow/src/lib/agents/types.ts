/**
 * Multi-Agent Architecture Types
 *
 * Common type definitions for the orchestrator and specialized agents.
 */

import type { Task } from '@/manifesto';

// ============================================================================
// View & Filter Types
// ============================================================================

export type ViewMode = 'todo' | 'kanban' | 'table';
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

// ============================================================================
// Language Types (Multi-language support)
// ============================================================================

/** 직접 지원하는 언어 (LLM 없이 처리 가능) */
export type SupportedLanguage = 'ko' | 'en';

/** 감지 가능한 모든 언어 */
export type DetectedLanguage =
  | SupportedLanguage
  | 'ja' | 'zh' | 'es' | 'fr' | 'de' | 'pt' | 'ru' | 'ar' | 'th' | 'vi'
  | 'other';

/** 언어 라우팅 정보 */
export interface LanguageTrace {
  /** 감지된 언어 */
  detected: DetectedLanguage;
  /** 번역 여부 */
  translated: boolean;
  /** 번역에 사용된 토큰 수 */
  translationTokens?: number;
}

export interface DateFilter {
  field: 'dueDate' | 'createdAt';
  type: 'today' | 'week' | 'month' | 'custom';
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// Agent Step (for timeline UI)
// ============================================================================

export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentStep {
  id: string;
  agentName: string;
  agentIcon: string;
  status: AgentStepStatus;
  description?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // ms
}

// ============================================================================
// Effect Types (patch operations)
// ============================================================================

export type PatchOp =
  | { op: 'append'; path: 'data.tasks'; value: Task }
  | { op: 'set'; path: string; value: unknown }
  | { op: 'remove'; path: 'data.tasks'; value: string }
  | { op: 'restore'; path: 'data.tasks'; value: string };

export interface SnapshotPatchEffect {
  type: 'snapshot.patch';
  id: string;
  ops: PatchOp[];
}

export interface SnapshotUndoEffect {
  type: 'snapshot.undo';
  id: string;
}

export type AgentEffect = SnapshotPatchEffect | SnapshotUndoEffect;

// Type guards
export function isPatchEffect(effect: AgentEffect): effect is SnapshotPatchEffect {
  return effect.type === 'snapshot.patch';
}

export function isUndoEffect(effect: AgentEffect): effect is SnapshotUndoEffect {
  return effect.type === 'snapshot.undo';
}

// ============================================================================
// Snapshot (current state passed to agents)
// ============================================================================

export interface TasksSummary {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
}

export interface AppSnapshot {
  data: {
    tasks: Task[];
  };
  state: {
    selectedTaskId: string | null;
    viewMode: ViewMode;
    dateFilter: DateFilter | null;
  };
}

// ============================================================================
// Orchestrator Types
// ============================================================================

export type AgentType = 'task-creator' | 'task-mutator' | 'view-control' | 'query';

export interface AgentCall {
  agent: AgentType;
  params: Record<string, unknown>;
  reason: string;
}

export interface OrchestratorDecision {
  intent: 'create' | 'mutate' | 'view' | 'query' | 'multi';
  agents: AgentCall[];
  reasoning: string;
}

export interface OrchestratorInput {
  instruction: string;
  snapshot: AppSnapshot;
}

export interface OrchestratorOutput {
  decision: OrchestratorDecision;
  trace?: AgentTrace;
}

// ============================================================================
// Agent Base Types
// ============================================================================

export interface AgentTrace {
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  raw?: unknown;
}

export interface BaseAgentInput {
  instruction: string;
  /** IANA timezone string (e.g., 'Asia/Seoul', 'America/New_York') */
  timezone?: string;
}

export interface BaseAgentOutput {
  message: string;
  effects: AgentEffect[];
  trace?: AgentTrace;
}

// ============================================================================
// TaskCreator Agent
// ============================================================================

export interface TaskCreatorInput extends BaseAgentInput {
  currentTaskCount: number;
  existingTags: string[];
}

export interface TaskCreatorOutput extends BaseAgentOutput {
  createdTasks: Task[];
}

// ============================================================================
// TaskMutator Agent
// ============================================================================

export interface TaskMutatorInput extends BaseAgentInput {
  targetTasks: Array<{
    index: number;
    task: Task;
  }>;
  allTasksForReference: Array<{
    id: string;
    title: string;
    status: TaskStatus;
  }>;
}

export interface TaskMutatorOutput extends BaseAgentOutput {
  mutatedTaskIds: string[];
  deletedTaskIds: string[];
  restoredTaskIds: string[];
}

// ============================================================================
// ViewControl Agent
// ============================================================================

export interface ViewControlInput extends BaseAgentInput {
  currentViewMode: ViewMode;
  currentDateFilter: DateFilter | null;
  taskList: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    dueDate?: string;
  }>;
}

export interface ViewControlOutput extends BaseAgentOutput {
  viewModeChanged?: ViewMode;
  dateFilterChanged?: DateFilter | null;
  selectedTaskId?: string | null;
}

// ============================================================================
// QueryAgent
// ============================================================================

export interface QueryAgentInput extends BaseAgentInput {
  tasksSummary: TasksSummary;
  tasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate?: string;
    tags: string[];
  }>;
}

export interface QueryAgentOutput extends BaseAgentOutput {
  // Query agent only provides message, no effects
}

// ============================================================================
// Orchestrate API Types
// ============================================================================

export interface OrchestrateRequest {
  instruction: string;
  snapshot: AppSnapshot;
}

export interface OrchestrateResponse {
  message: string;
  effects: AgentEffect[];
  steps: AgentStep[];
  trace?: {
    orchestrator?: AgentTrace;
    agents: Record<string, AgentTrace>;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

export function generateEffectId(): string {
  return `effect-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function generateStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function calculateTasksSummary(tasks: Task[]): TasksSummary {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const activeTasks = tasks.filter(t => !t.deletedAt);

  return {
    total: activeTasks.length,
    byStatus: {
      'todo': activeTasks.filter(t => t.status === 'todo').length,
      'in-progress': activeTasks.filter(t => t.status === 'in-progress').length,
      'review': activeTasks.filter(t => t.status === 'review').length,
      'done': activeTasks.filter(t => t.status === 'done').length,
    },
    byPriority: {
      'low': activeTasks.filter(t => t.priority === 'low').length,
      'medium': activeTasks.filter(t => t.priority === 'medium').length,
      'high': activeTasks.filter(t => t.priority === 'high').length,
    },
    overdue: activeTasks.filter(t => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < today && t.status !== 'done';
    }).length,
    dueToday: activeTasks.filter(t => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due >= today && due < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    }).length,
    dueThisWeek: activeTasks.filter(t => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due >= today && due < weekEnd;
    }).length,
  };
}
