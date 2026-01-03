/**
 * Transaction Executor
 *
 * ExecutablePlan의 BoundSteps를 순차 실행
 *
 * 핵심 원칙:
 * - 원자성: 하나라도 실패하면 전체 롤백
 * - 결정론: 동일 입력 → 동일 출력
 * - 추적 가능: 각 step의 실행 결과 기록
 */

import type { Snapshot } from './runtime';
import { executeIntent } from './runtime';
import type { Intent } from './intent';
import type { AgentEffect, PatchOp } from './types';
import { generateEffectId } from './types';
import type {
  ExecutablePlan,
  BoundStep,
  BoundIntentStep,
  BoundQueryStep,
  BoundIfStep,
  BoundConfirmStep,
  BoundNoteStep,
} from './preflight';
import type { Condition, VarRef, QuerySpec, FilterSpec } from './plan';

// ============================================
// Types
// ============================================

export interface TransactionContext {
  /** Current snapshot (updated after each step) */
  snapshot: Snapshot;
  /** Variables assigned by query steps */
  variables: Map<string, unknown>;
  /** Effects collected from all steps */
  effects: AgentEffect[];
  /** Step execution trace */
  trace: StepTrace[];
}

export interface StepTrace {
  index: number;
  kind: string;
  startTime: number;
  endTime?: number;
  success: boolean;
  error?: string;
  effectCount: number;
}

export type TransactionResult =
  | TransactionSuccess
  | TransactionFailure;

export interface TransactionSuccess {
  ok: true;
  effects: AgentEffect[];
  finalSnapshot: Snapshot;
  trace: StepTrace[];
  variables: Record<string, unknown>;
}

export interface TransactionFailure {
  ok: false;
  failedAt: number;
  stepKind: string;
  error: string;
  rolledBack: boolean;
  partialEffects: AgentEffect[];
  trace: StepTrace[];
}

export interface ConfirmPending {
  kind: 'confirm_pending';
  message: string;
  onApprove: BoundStep[];
  onReject?: BoundStep[];
  currentContext: TransactionContext;
  remainingSteps: BoundStep[];
}

export type ExecutionOutcome =
  | TransactionResult
  | ConfirmPending;

// ============================================
// Main Executor
// ============================================

/**
 * ExecutablePlan 실행
 *
 * PR3: Intent steps만 실행
 * PR4: Query, If, Confirm 지원 추가
 */
export async function executeTransaction(
  executable: ExecutablePlan,
  initialSnapshot: Snapshot
): Promise<ExecutionOutcome> {
  const context: TransactionContext = {
    snapshot: JSON.parse(JSON.stringify(initialSnapshot)),
    variables: new Map(),
    effects: [],
    trace: [],
  };

  try {
    const result = await executeSteps(executable.boundSteps, context, 0);

    if (isStepConfirmPending(result)) {
      return result;
    }

    if (isStepFailure(result)) {
      // Rollback - discard all effects
      return {
        ok: false,
        failedAt: result.failedAt,
        stepKind: result.stepKind,
        error: result.error,
        rolledBack: true,
        partialEffects: [],
        trace: context.trace,
      };
    }

    return {
      ok: true,
      effects: context.effects,
      finalSnapshot: context.snapshot,
      trace: context.trace,
      variables: Object.fromEntries(context.variables),
    };
  } catch (e) {
    return {
      ok: false,
      failedAt: context.trace.length,
      stepKind: 'unknown',
      error: e instanceof Error ? e.message : 'Unknown error',
      rolledBack: true,
      partialEffects: [],
      trace: context.trace,
    };
  }
}

// ============================================
// Step Execution
// ============================================

interface StepExecutionSuccess {
  kind: 'success';
}

interface StepExecutionFailure {
  kind: 'failure';
  failedAt: number;
  stepKind: string;
  error: string;
}

type StepExecutionResult = StepExecutionSuccess | StepExecutionFailure | ConfirmPending;

function isStepSuccess(result: StepExecutionResult): result is StepExecutionSuccess {
  return result.kind === 'success';
}

function isStepFailure(result: StepExecutionResult): result is StepExecutionFailure {
  return result.kind === 'failure';
}

function isStepConfirmPending(result: StepExecutionResult): result is ConfirmPending {
  return result.kind === 'confirm_pending';
}

async function executeSteps(
  steps: BoundStep[],
  context: TransactionContext,
  startIndex: number
): Promise<StepExecutionResult> {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const globalIndex = startIndex + i;
    const result = await executeStep(step, context, globalIndex);

    if (isStepConfirmPending(result)) {
      // Return confirm pending with remaining steps
      return {
        ...result,
        remainingSteps: steps.slice(i + 1),
      };
    }

    if (isStepFailure(result)) {
      return result;
    }
  }

  return { kind: 'success' };
}

async function executeStep(
  step: BoundStep,
  context: TransactionContext,
  index: number
): Promise<StepExecutionResult> {
  const trace: StepTrace = {
    index,
    kind: step.kind,
    startTime: Date.now(),
    success: false,
    effectCount: 0,
  };

  try {
    switch (step.kind) {
      case 'intent':
        await executeIntentStep(step, context);
        break;

      case 'query':
        await executeQueryStep(step, context);
        break;

      case 'if': {
        const result = await executeIfStep(step, context, index);
        if (!isStepSuccess(result)) {
          trace.endTime = Date.now();
          trace.success = false;
          context.trace.push(trace);
          return result;
        }
        break;
      }

      case 'confirm': {
        const result = await executeConfirmStep(step, context, index);
        if (isStepConfirmPending(result)) {
          trace.endTime = Date.now();
          context.trace.push(trace);
          return result;
        }
        if (isStepFailure(result)) {
          trace.endTime = Date.now();
          trace.success = false;
          context.trace.push(trace);
          return result;
        }
        break;
      }

      case 'note':
        // Notes are no-ops
        break;
    }

    trace.endTime = Date.now();
    trace.success = true;
    trace.effectCount = context.effects.length;
    context.trace.push(trace);

    return { kind: 'success' };
  } catch (e) {
    trace.endTime = Date.now();
    trace.success = false;
    trace.error = e instanceof Error ? e.message : 'Unknown error';
    context.trace.push(trace);

    return {
      kind: 'failure',
      failedAt: index,
      stepKind: step.kind,
      error: trace.error,
    };
  }
}

// ============================================
// Step Type Handlers
// ============================================

async function executeIntentStep(
  step: BoundIntentStep,
  context: TransactionContext
): Promise<void> {
  const result = executeIntent(step.intent, context.snapshot);

  if (!result.success) {
    throw new Error(result.error || 'Intent execution failed');
  }

  // Collect effects
  context.effects.push(...result.effects);

  // Apply effects to snapshot
  context.snapshot = applyEffectsToSnapshot(context.snapshot, result.effects);
}

async function executeQueryStep(
  step: BoundQueryStep,
  context: TransactionContext
): Promise<void> {
  const result = evaluateQuery(step.query, context.snapshot);

  if (step.assign) {
    context.variables.set(step.assign, result);
  }
}

async function executeIfStep(
  step: BoundIfStep,
  context: TransactionContext,
  index: number
): Promise<StepExecutionResult> {
  const conditionResult = evaluateCondition(step.cond, context.variables);

  if (conditionResult) {
    return executeSteps(step.then, context, index + 1);
  } else if (step.else) {
    return executeSteps(step.else, context, index + 1);
  }

  return { kind: 'success' };
}

async function executeConfirmStep(
  step: BoundConfirmStep,
  context: TransactionContext,
  index: number
): Promise<StepExecutionResult | ConfirmPending> {
  // In real execution, this would pause and wait for user confirmation
  // For now, we return a pending state that the caller must handle
  return {
    kind: 'confirm_pending',
    message: step.message,
    onApprove: step.onApprove,
    onReject: step.onReject,
    currentContext: context,
    remainingSteps: [],
  };
}

// ============================================
// Query Evaluation (PR4)
// ============================================

function evaluateQuery(query: QuerySpec, snapshot: Snapshot): unknown {
  const activeTasks = snapshot.data.tasks.filter(t => !t.deletedAt);

  switch (query.kind) {
    case 'countTasks': {
      const filtered = applyFilter(activeTasks, query.filter);
      return filtered.length;
    }

    case 'findTask': {
      const hint = query.hint.toLowerCase();
      const found = activeTasks.find(t =>
        t.title.toLowerCase().includes(hint)
      );
      return found || null;
    }

    case 'listTasks': {
      let filtered = applyFilter(activeTasks, query.filter);
      if (query.limit) {
        filtered = filtered.slice(0, query.limit);
      }
      return filtered;
    }

    default:
      return null;
  }
}

function applyFilter(tasks: Snapshot['data']['tasks'], filter?: FilterSpec): Snapshot['data']['tasks'] {
  if (!filter) return tasks;

  let result = tasks;

  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    result = result.filter(t => statuses.includes(t.status));
  }

  if (filter.priority) {
    const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
    result = result.filter(t => priorities.includes(t.priority));
  }

  if (filter.tags) {
    result = result.filter(t =>
      t.tags?.some(tag => filter.tags!.includes(tag))
    );
  }

  if (filter.deleted !== undefined) {
    result = result.filter(t =>
      filter.deleted ? !!t.deletedAt : !t.deletedAt
    );
  }

  return result;
}

// ============================================
// Condition Evaluation (PR4)
// ============================================

function evaluateCondition(cond: Condition, variables: Map<string, unknown>): boolean {
  switch (cond.op) {
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
    case 'eq':
    case 'neq': {
      const left = resolveValue(cond.left, variables);
      const right = resolveValue(cond.right, variables);
      return compareValues(cond.op, left, right);
    }

    case 'exists':
      return variables.has(cond.var.var) && variables.get(cond.var.var) !== null;

    case 'notExists':
      return !variables.has(cond.var.var) || variables.get(cond.var.var) === null;

    case 'and':
      return cond.items.every(item => evaluateCondition(item, variables));

    case 'or':
      return cond.items.some(item => evaluateCondition(item, variables));

    case 'not':
      return !cond.items[0] || !evaluateCondition(cond.items[0], variables);

    default:
      return false;
  }
}

function resolveValue(value: VarRef | unknown, variables: Map<string, unknown>): unknown {
  if (value && typeof value === 'object' && 'var' in value) {
    return variables.get((value as VarRef).var);
  }
  return value;
}

function compareValues(op: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq', left: unknown, right: unknown): boolean {
  // Handle numeric comparisons
  if (typeof left === 'number' && typeof right === 'number') {
    switch (op) {
      case 'lt': return left < right;
      case 'lte': return left <= right;
      case 'gt': return left > right;
      case 'gte': return left >= right;
      case 'eq': return left === right;
      case 'neq': return left !== right;
    }
  }

  // Handle string comparisons
  if (typeof left === 'string' && typeof right === 'string') {
    switch (op) {
      case 'eq': return left === right;
      case 'neq': return left !== right;
      default: return left.localeCompare(right) < 0;
    }
  }

  // Default equality check
  switch (op) {
    case 'eq': return left === right;
    case 'neq': return left !== right;
    default: return false;
  }
}

// ============================================
// Effect Application
// ============================================

function applyEffectsToSnapshot(snapshot: Snapshot, effects: AgentEffect[]): Snapshot {
  const result: Snapshot = JSON.parse(JSON.stringify(snapshot));

  for (const effect of effects) {
    if (effect.type === 'snapshot.patch' && effect.ops) {
      for (const op of effect.ops) {
        applyPatchOp(result, op);
      }
    }
  }

  return result;
}

function applyPatchOp(snapshot: Snapshot, op: PatchOp): void {
  switch (op.op) {
    case 'set': {
      const idMatch = op.path.match(/data\.tasks\.id:([^.]+)\.(\w+)/);
      if (idMatch) {
        const [, taskId, field] = idMatch;
        const task = snapshot.data.tasks.find(t => t.id === taskId);
        if (task) {
          (task as Record<string, unknown>)[field] = op.value;
        }
      } else {
        setNestedValue(snapshot, op.path, op.value);
      }
      break;
    }

    case 'append':
      if (op.path === 'data.tasks') {
        snapshot.data.tasks.push(op.value);
      }
      break;

    case 'remove':
      if (op.path === 'data.tasks') {
        const task = snapshot.data.tasks.find(t => t.id === op.value);
        if (task) {
          task.deletedAt = new Date().toISOString();
        }
      }
      break;

    case 'restore':
      if (op.path === 'data.tasks') {
        const task = snapshot.data.tasks.find(t => t.id === op.value);
        if (task) {
          task.deletedAt = null;
        }
      }
      break;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setNestedValue(obj: any, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;
}

// ============================================
// Continuation (for confirm handling)
// ============================================

/**
 * Confirm 승인 후 실행 계속
 */
export async function continueAfterConfirm(
  pending: ConfirmPending,
  approved: boolean
): Promise<TransactionResult> {
  const context = pending.currentContext;

  // Execute approved or rejected branch
  const branchSteps = approved ? pending.onApprove : (pending.onReject || []);

  const result = await executeSteps(branchSteps, context, context.trace.length);

  if (isStepConfirmPending(result)) {
    // Nested confirm - not supported in this version
    return {
      ok: false,
      failedAt: context.trace.length,
      stepKind: 'confirm',
      error: 'Nested confirm not supported',
      rolledBack: true,
      partialEffects: [],
      trace: context.trace,
    };
  }

  if (isStepFailure(result)) {
    return {
      ok: false,
      failedAt: result.failedAt,
      stepKind: result.stepKind,
      error: result.error,
      rolledBack: true,
      partialEffects: [],
      trace: context.trace,
    };
  }

  // Execute remaining steps
  if (pending.remainingSteps.length > 0) {
    const remainingResult = await executeSteps(
      pending.remainingSteps,
      context,
      context.trace.length
    );

    if (isStepConfirmPending(remainingResult)) {
      return {
        ok: false,
        failedAt: context.trace.length,
        stepKind: 'confirm',
        error: 'Multiple confirms not supported in this version',
        rolledBack: true,
        partialEffects: [],
        trace: context.trace,
      };
    }

    if (isStepFailure(remainingResult)) {
      return {
        ok: false,
        failedAt: remainingResult.failedAt,
        stepKind: remainingResult.stepKind,
        error: remainingResult.error,
        rolledBack: true,
        partialEffects: [],
        trace: context.trace,
      };
    }
  }

  return {
    ok: true,
    effects: context.effects,
    finalSnapshot: context.snapshot,
    trace: context.trace,
    variables: Object.fromEntries(context.variables),
  };
}

// ============================================
// Type Guards
// ============================================

export function isTransactionSuccess(result: ExecutionOutcome): result is TransactionSuccess {
  return !isConfirmPending(result) && result.ok === true;
}

export function isTransactionFailure(result: ExecutionOutcome): result is TransactionFailure {
  return !isConfirmPending(result) && result.ok === false;
}

export function isConfirmPending(result: ExecutionOutcome): result is ConfirmPending {
  return 'kind' in result && result.kind === 'confirm_pending';
}
