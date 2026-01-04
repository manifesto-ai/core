/**
 * Preflight Tests
 */

import { describe, it, expect } from 'vitest';
import {
  runPreflight,
  isPreflightSuccess,
  isPreflightError,
  type ExecutablePlan,
} from './preflight';
import type { Plan, PlanStep } from './plan';
import type { IntentSkeleton } from './skeleton';
import type { Snapshot } from './runtime';

// Helper to create a snapshot with tasks
function createSnapshot(tasks: Array<{ id: string; title: string; status?: string }>): Snapshot {
  return {
    data: {
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: (t.status || 'todo') as 'todo' | 'in-progress' | 'review' | 'done',
        priority: 'medium' as const,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    },
    state: {
      viewMode: 'kanban' as const,
      dateFilter: null,
      selectedTaskId: null,
    },
  };
}

// Helper to create a plan
function createPlan(steps: PlanStep[]): Plan {
  return {
    version: 1,
    goal: 'Test plan',
    steps,
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

describe('Preflight', () => {
  describe('Simple Plans', () => {
    it('succeeds for view change (no resolution needed)', () => {
      const plan = createPlan([
        intentStep({ kind: 'ChangeView', viewMode: 'kanban' }),
      ]);
      const snapshot = createSnapshot([]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightSuccess(result)).toBe(true);
      if (isPreflightSuccess(result)) {
        expect(result.executable.boundSteps).toHaveLength(1);
        expect(result.executable.boundSteps[0]?.kind).toBe('intent');
      }
    });

    it('succeeds for query (no resolution needed)', () => {
      const plan = createPlan([
        intentStep({ kind: 'QueryTasks', query: 'What tasks are due?' }),
      ]);
      const snapshot = createSnapshot([]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightSuccess(result)).toBe(true);
    });

    it('succeeds for note step', () => {
      const plan = createPlan([
        { kind: 'note', text: 'This is a note' },
      ]);
      const snapshot = createSnapshot([]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightSuccess(result)).toBe(true);
      if (isPreflightSuccess(result)) {
        expect(result.executable.boundSteps[0]?.kind).toBe('note');
      }
    });
  });

  describe('Task Resolution', () => {
    it('resolves targetHint to taskId', () => {
      const plan = createPlan([
        intentStep({
          kind: 'ChangeStatus',
          targetHint: 'Report',
          toStatus: 'done',
        }),
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Report task' },
        { id: 't2', title: 'Other task' },
      ]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightSuccess(result)).toBe(true);
      if (isPreflightSuccess(result)) {
        const boundStep = result.executable.boundSteps[0];
        expect(boundStep?.kind).toBe('intent');
        if (boundStep?.kind === 'intent') {
          expect((boundStep.intent as { taskId?: string }).taskId).toBe('t1');
          expect(boundStep.resolvedTask?.title).toBe('Report task');
        }
      }
    });

    it('fails when task not found', () => {
      const plan = createPlan([
        intentStep({
          kind: 'ChangeStatus',
          targetHint: 'Nonexistent',
          toStatus: 'done',
        }),
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Report task' },
      ]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightError(result)).toBe(true);
      if (isPreflightError(result)) {
        expect(result.needsClarification.reason).toBe('NOT_FOUND');
        expect(result.needsClarification.failedSkeleton).toBeDefined();
      }
    });

    it('fails when multiple tasks match', () => {
      const plan = createPlan([
        intentStep({
          kind: 'ChangeStatus',
          targetHint: 'Report',
          toStatus: 'done',
        }),
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Report A' },
        { id: 't2', title: 'Report B' },
      ]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightError(result)).toBe(true);
      if (isPreflightError(result)) {
        expect(result.needsClarification.reason).toBe('AMBIGUOUS_TARGET');
        expect(result.needsClarification.candidates).toHaveLength(2);
      }
    });
  });

  describe('Multi-Step Plans', () => {
    it('resolves all steps in order', () => {
      const plan = createPlan([
        intentStep({ kind: 'CreateTask', tasks: [{ title: 'New task' }] }),
        intentStep({
          kind: 'ChangeStatus',
          targetHint: 'Report',
          toStatus: 'done',
        }),
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Report task' },
      ]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightSuccess(result)).toBe(true);
      if (isPreflightSuccess(result)) {
        expect(result.executable.boundSteps).toHaveLength(2);
      }
    });

    it('fails on first unresolvable step', () => {
      const plan = createPlan([
        intentStep({ kind: 'CreateTask', tasks: [{ title: 'New task' }] }),
        intentStep({
          kind: 'ChangeStatus',
          targetHint: 'Nonexistent',
          toStatus: 'done',
        }),
        intentStep({
          kind: 'ChangeStatus',
          targetHint: 'Report',
          toStatus: 'done',
        }),
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Report task' },
      ]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightError(result)).toBe(true);
      if (isPreflightError(result)) {
        expect(result.needsClarification.failedStepIndex).toBe(1);
      }
    });
  });

  describe('Nested Steps', () => {
    it('resolves steps inside if branches', () => {
      const plan = createPlan([
        {
          kind: 'if',
          cond: { op: 'eq', left: { var: 'x' }, right: 1 },
          then: [
            intentStep({
              kind: 'ChangeStatus',
              targetHint: 'Report',
              toStatus: 'done',
            }),
          ],
          else: [
            intentStep({ kind: 'ChangeView', viewMode: 'table' }),
          ],
        },
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Report task' },
      ]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightSuccess(result)).toBe(true);
      if (isPreflightSuccess(result)) {
        const ifStep = result.executable.boundSteps[0];
        expect(ifStep?.kind).toBe('if');
        if (ifStep?.kind === 'if') {
          expect(ifStep.then).toHaveLength(1);
          expect(ifStep.else).toHaveLength(1);
        }
      }
    });

    it('resolves steps inside confirm branches', () => {
      const plan = createPlan([
        {
          kind: 'confirm',
          message: 'Proceed?',
          onApprove: [
            intentStep({
              kind: 'ChangeStatus',
              targetHint: 'Report',
              toStatus: 'done',
            }),
          ],
        },
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Report task' },
      ]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightSuccess(result)).toBe(true);
      if (isPreflightSuccess(result)) {
        const confirmStep = result.executable.boundSteps[0];
        expect(confirmStep?.kind).toBe('confirm');
        if (confirmStep?.kind === 'confirm') {
          expect(confirmStep.onApprove).toHaveLength(1);
        }
      }
    });

    it('fails if nested step cannot be resolved', () => {
      const plan = createPlan([
        {
          kind: 'if',
          cond: { op: 'eq', left: { var: 'x' }, right: 1 },
          then: [
            intentStep({
              kind: 'ChangeStatus',
              targetHint: 'Nonexistent',
              toStatus: 'done',
            }),
          ],
        },
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Report task' },
      ]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightError(result)).toBe(true);
    });
  });

  describe('Policy Integration', () => {
    it('fails when plan exceeds step limit', () => {
      const steps = Array.from({ length: 10 }, (_, i) =>
        intentStep({ kind: 'CreateTask', tasks: [{ title: `Task ${i}` }] })
      );
      const plan = createPlan(steps);
      const snapshot = createSnapshot([]);

      const result = runPreflight(plan, snapshot, { maxSteps: 8, maxWriteSteps: 10, requireConfirmForDestructive: true, autoInjectConfirm: true });

      expect(isPreflightError(result)).toBe(true);
      if (isPreflightError(result)) {
        expect(result.needsClarification.reason).toBe('TOO_MANY_STEPS');
      }
    });

    it('auto-injects confirm for destructive operations', () => {
      const plan = createPlan([
        intentStep({ kind: 'DeleteTask', targetHint: 'Report' }),
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Report task' },
      ]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightSuccess(result)).toBe(true);
      if (isPreflightSuccess(result)) {
        // The plan should be normalized with confirm
        expect(result.warnings.some(w => w.code === 'DESTRUCTIVE_WITHOUT_CONFIRM')).toBe(true);
        // BoundSteps should have confirm wrapping the delete
        expect(result.executable.boundSteps[0]?.kind).toBe('confirm');
      }
    });
  });

  describe('ExecutablePlan', () => {
    it('includes snapshot version', () => {
      const plan = createPlan([
        intentStep({ kind: 'ChangeView', viewMode: 'kanban' }),
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Task 1' },
        { id: 't2', title: 'Task 2' },
      ]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightSuccess(result)).toBe(true);
      if (isPreflightSuccess(result)) {
        expect(result.executable.snapshotVersion).toBeGreaterThan(0);
      }
    });

    it('includes risk assessment', () => {
      const plan = createPlan([
        intentStep({ kind: 'DeleteTask', targetHint: 'Report' }),
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Report task' },
      ]);

      const result = runPreflight(plan, snapshot);

      expect(isPreflightSuccess(result)).toBe(true);
      if (isPreflightSuccess(result)) {
        expect(result.executable.risk.level).toBe('high');
        expect(result.executable.risk.hasDestructive).toBe(true);
      }
    });
  });
});
