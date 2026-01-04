/**
 * Policy Tests
 */

import { describe, it, expect } from 'vitest';
import {
  assessRisk,
  validatePolicy,
  isWriteOperation,
  isReadOnlyOperation,
  isPlanReadOnly,
  DEFAULT_POLICY_CONFIG,
  type PolicyConfig,
} from './policy';
import type { Plan, PlanStep } from './plan';
import type { IntentSkeleton } from './skeleton';

// Helper to create a simple plan
function createPlan(steps: PlanStep[], risk?: 'low' | 'medium' | 'high'): Plan {
  return {
    version: 1,
    goal: 'Test plan',
    steps,
    risk,
  };
}

// Helper to create an intent step
function intentStep(skeleton: Partial<IntentSkeleton> & { kind: string }): PlanStep {
  return {
    kind: 'intent',
    skeleton: {
      confidence: 0.9,
      source: 'human',
      ...skeleton,
    } as IntentSkeleton,
  };
}

describe('Risk Assessment', () => {
  it('assesses low risk for view changes', () => {
    const plan = createPlan([
      intentStep({ kind: 'ChangeView', viewMode: 'kanban' }),
    ]);

    const risk = assessRisk(plan);
    expect(risk.level).toBe('low');
    expect(risk.hasDestructive).toBe(false);
  });

  it('assesses low risk for QueryTasks', () => {
    const plan = createPlan([
      intentStep({ kind: 'QueryTasks', query: 'What tasks are due?' }),
    ]);

    const risk = assessRisk(plan);
    expect(risk.level).toBe('low');
  });

  it('assesses medium risk for single create', () => {
    const plan = createPlan([
      intentStep({ kind: 'CreateTask', tasks: [{ title: 'Test' }] }),
    ]);

    const risk = assessRisk(plan);
    expect(risk.level).toBe('medium');
  });

  it('assesses medium risk for status change', () => {
    const plan = createPlan([
      intentStep({ kind: 'ChangeStatus', targetHint: 'task', toStatus: 'done' }),
    ]);

    const risk = assessRisk(plan);
    expect(risk.level).toBe('medium');
  });

  it('assesses high risk for DeleteTask', () => {
    const plan = createPlan([
      intentStep({ kind: 'DeleteTask', targetHint: 'task' }),
    ]);

    const risk = assessRisk(plan);
    expect(risk.level).toBe('high');
    expect(risk.hasDestructive).toBe(true);
  });

  it('assesses high risk for RestoreTask', () => {
    const plan = createPlan([
      intentStep({ kind: 'RestoreTask', targetHint: 'task' }),
    ]);

    const risk = assessRisk(plan);
    expect(risk.level).toBe('high');
    expect(risk.hasDestructive).toBe(true);
  });

  it('assesses medium risk for multiple writes', () => {
    const plan = createPlan([
      intentStep({ kind: 'CreateTask', tasks: [{ title: 'Task 1' }] }),
      intentStep({ kind: 'CreateTask', tasks: [{ title: 'Task 2' }] }),
      intentStep({ kind: 'CreateTask', tasks: [{ title: 'Task 3' }] }),
      intentStep({ kind: 'CreateTask', tasks: [{ title: 'Task 4' }] }),
    ]);

    const risk = assessRisk(plan);
    expect(risk.level).toBe('medium');
    expect(risk.writeStepCount).toBe(4);
  });

  it('counts steps correctly', () => {
    const plan = createPlan([
      { kind: 'note', text: 'Step 1' },
      intentStep({ kind: 'CreateTask', tasks: [{ title: 'Task' }] }),
      {
        kind: 'if',
        cond: { op: 'eq', left: { var: 'x' }, right: 1 },
        then: [
          intentStep({ kind: 'ChangeStatus', targetHint: 'task', toStatus: 'done' }),
        ],
      },
    ]);

    const risk = assessRisk(plan);
    expect(risk.totalStepCount).toBe(4); // note + intent + if + nested intent
    expect(risk.writeStepCount).toBe(2); // CreateTask + ChangeStatus
  });
});

describe('Policy Validation', () => {
  it('validates a simple low-risk plan', () => {
    const plan = createPlan([
      intentStep({ kind: 'ChangeView', viewMode: 'kanban' }),
    ]);

    const result = validatePolicy(plan);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('rejects plan with too many steps', () => {
    const steps: PlanStep[] = Array.from({ length: 10 }, (_, i) =>
      intentStep({ kind: 'CreateTask', tasks: [{ title: `Task ${i}` }] })
    );
    const plan = createPlan(steps);

    const result = validatePolicy(plan, { ...DEFAULT_POLICY_CONFIG, maxSteps: 8 });
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.code === 'TOO_MANY_STEPS')).toBe(true);
  });

  it('rejects plan with too many write steps', () => {
    const steps: PlanStep[] = Array.from({ length: 5 }, (_, i) =>
      intentStep({ kind: 'CreateTask', tasks: [{ title: `Task ${i}` }] })
    );
    const plan = createPlan(steps);

    const result = validatePolicy(plan, { ...DEFAULT_POLICY_CONFIG, maxWriteSteps: 4 });
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.code === 'TOO_MANY_WRITE_STEPS')).toBe(true);
  });

  it('warns about destructive operation without confirm', () => {
    const plan = createPlan([
      intentStep({ kind: 'DeleteTask', targetHint: 'task' }),
    ]);

    const result = validatePolicy(plan, {
      ...DEFAULT_POLICY_CONFIG,
      autoInjectConfirm: true,
    });

    // Should be valid because confirm is auto-injected
    expect(result.valid).toBe(true);
    expect(result.violations.some(v => v.code === 'DESTRUCTIVE_WITHOUT_CONFIRM')).toBe(true);
    expect(result.violations[0]?.severity).toBe('warning');
    expect(result.normalizedPlan).toBeDefined();
  });

  it('rejects destructive operation without confirm when autoInject is off', () => {
    const plan = createPlan([
      intentStep({ kind: 'DeleteTask', targetHint: 'task' }),
    ]);

    const result = validatePolicy(plan, {
      ...DEFAULT_POLICY_CONFIG,
      autoInjectConfirm: false,
    });

    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.code === 'DESTRUCTIVE_WITHOUT_CONFIRM')).toBe(true);
    expect(result.violations[0]?.severity).toBe('error');
  });

  it('accepts destructive operation with existing confirm', () => {
    const plan = createPlan([
      {
        kind: 'confirm',
        message: 'Delete task?',
        onApprove: [
          intentStep({ kind: 'DeleteTask', targetHint: 'task' }),
        ],
      },
    ]);

    const result = validatePolicy(plan);
    expect(result.valid).toBe(true);
    expect(result.violations.filter(v => v.code === 'DESTRUCTIVE_WITHOUT_CONFIRM')).toHaveLength(0);
  });

  it('auto-injects confirm step for destructive operations', () => {
    const plan = createPlan([
      intentStep({ kind: 'DeleteTask', targetHint: 'old task' }),
    ]);

    const result = validatePolicy(plan, {
      ...DEFAULT_POLICY_CONFIG,
      autoInjectConfirm: true,
    });

    expect(result.normalizedPlan).toBeDefined();
    const normalizedSteps = result.normalizedPlan!.steps;
    expect(normalizedSteps[0]?.kind).toBe('confirm');

    const confirmStep = normalizedSteps[0] as { kind: 'confirm'; message: string; onApprove: PlanStep[] };
    expect(confirmStep.message).toContain('old task');
    expect(confirmStep.onApprove[0]?.kind).toBe('intent');
  });
});

describe('Operation Type Guards', () => {
  it('identifies write operations', () => {
    expect(isWriteOperation({ kind: 'CreateTask', tasks: [], confidence: 0.9, source: 'human' } as IntentSkeleton)).toBe(true);
    expect(isWriteOperation({ kind: 'UpdateTask', targetHint: 'x', changes: {}, confidence: 0.9, source: 'human' } as IntentSkeleton)).toBe(true);
    expect(isWriteOperation({ kind: 'ChangeStatus', targetHint: 'x', toStatus: 'done', confidence: 0.9, source: 'human' } as IntentSkeleton)).toBe(true);
    expect(isWriteOperation({ kind: 'DeleteTask', targetHint: 'x', confidence: 0.9, source: 'human' } as IntentSkeleton)).toBe(true);
    expect(isWriteOperation({ kind: 'RestoreTask', targetHint: 'x', confidence: 0.9, source: 'human' } as IntentSkeleton)).toBe(true);
  });

  it('identifies read-only operations', () => {
    expect(isReadOnlyOperation({ kind: 'QueryTasks', query: 'test', confidence: 0.9, source: 'human' } as IntentSkeleton)).toBe(true);
    expect(isReadOnlyOperation({ kind: 'SelectTask', targetHint: 'x', confidence: 0.9, source: 'human' } as IntentSkeleton)).toBe(true);
    expect(isReadOnlyOperation({ kind: 'ChangeView', viewMode: 'kanban', confidence: 0.9, source: 'human' } as IntentSkeleton)).toBe(true);
  });

  it('identifies read-only plan', () => {
    const readOnlyPlan = createPlan([
      intentStep({ kind: 'QueryTasks', query: 'test' }),
      intentStep({ kind: 'ChangeView', viewMode: 'kanban' }),
    ]);

    const writePlan = createPlan([
      intentStep({ kind: 'CreateTask', tasks: [{ title: 'Test' }] }),
    ]);

    expect(isPlanReadOnly(readOnlyPlan)).toBe(true);
    expect(isPlanReadOnly(writePlan)).toBe(false);
  });
});
