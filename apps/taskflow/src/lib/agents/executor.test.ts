/**
 * Transaction Executor Tests
 */

import { describe, it, expect } from 'vitest';
import {
  executeTransaction,
  continueAfterConfirm,
  isTransactionSuccess,
  isTransactionFailure,
  isConfirmPending,
  type TransactionSuccess,
  type TransactionFailure,
  type ConfirmPending,
} from './executor';
import type { ExecutablePlan, BoundStep, BoundIntentStep } from './preflight';
import type { Intent } from './intent';
import type { Snapshot } from './runtime';
import type { RiskAssessment } from './policy';
import type { Plan } from './plan';

// ============================================
// Helpers
// ============================================

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

function createPlan(steps: BoundStep[]): ExecutablePlan {
  return {
    plan: {
      version: 1,
      goal: 'Test plan',
      steps: [],
    },
    boundSteps: steps,
    snapshotVersion: 1,
    risk: {
      level: 'low',
      reasons: [],
      totalStepCount: steps.length,
      writeStepCount: 0,
      hasDestructive: false,
    },
  };
}

function intentStep(intent: Intent): BoundIntentStep {
  return {
    kind: 'intent',
    intent,
    originalSkeleton: {
      kind: intent.kind,
      confidence: 0.9,
      source: 'human',
    } as BoundIntentStep['originalSkeleton'],
  };
}

// ============================================
// Basic Execution Tests
// ============================================

describe('Transaction Executor', () => {
  describe('Basic Execution', () => {
    it('executes empty plan successfully', async () => {
      const plan = createPlan([]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.effects).toHaveLength(0);
        expect(result.trace).toHaveLength(0);
      }
    });

    it('executes single view change intent', async () => {
      const plan = createPlan([
        intentStep({
          kind: 'ChangeView',
          viewMode: 'table',
          confidence: 0.9,
          source: 'human',
        }),
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.effects.length).toBeGreaterThan(0);
        expect(result.finalSnapshot.state.viewMode).toBe('table');
        expect(result.trace).toHaveLength(1);
        expect(result.trace[0]?.success).toBe(true);
      }
    });

    it('executes single task creation', async () => {
      const plan = createPlan([
        intentStep({
          kind: 'CreateTask',
          tasks: [{ title: 'New Task' }],
          confidence: 0.9,
          source: 'human',
        }),
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.finalSnapshot.data.tasks).toHaveLength(1);
        expect(result.finalSnapshot.data.tasks[0]?.title).toBe('New Task');
      }
    });

    it('executes task status change', async () => {
      const plan = createPlan([
        intentStep({
          kind: 'ChangeStatus',
          taskId: 't1',
          toStatus: 'done',
          confidence: 0.9,
          source: 'human',
        }),
      ]);
      const snapshot = createSnapshot([{ id: 't1', title: 'Task 1', status: 'todo' }]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.finalSnapshot.data.tasks[0]?.status).toBe('done');
      }
    });
  });

  describe('Multi-Step Execution', () => {
    it('executes multiple intents in order', async () => {
      const plan = createPlan([
        intentStep({
          kind: 'CreateTask',
          tasks: [{ title: 'Task A' }],
          confidence: 0.9,
          source: 'human',
        }),
        intentStep({
          kind: 'CreateTask',
          tasks: [{ title: 'Task B' }],
          confidence: 0.9,
          source: 'human',
        }),
        intentStep({
          kind: 'ChangeView',
          viewMode: 'table',
          confidence: 0.9,
          source: 'human',
        }),
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.trace).toHaveLength(3);
        expect(result.finalSnapshot.data.tasks).toHaveLength(2);
        expect(result.finalSnapshot.state.viewMode).toBe('table');
      }
    });

    it('accumulates effects from all steps', async () => {
      const plan = createPlan([
        intentStep({
          kind: 'CreateTask',
          tasks: [{ title: 'Task 1' }],
          confidence: 0.9,
          source: 'human',
        }),
        intentStep({
          kind: 'CreateTask',
          tasks: [{ title: 'Task 2' }],
          confidence: 0.9,
          source: 'human',
        }),
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.effects.length).toBeGreaterThan(1);
      }
    });
  });

  describe('Failure and Rollback', () => {
    it('fails when intent execution fails', async () => {
      const plan = createPlan([
        intentStep({
          kind: 'ChangeStatus',
          taskId: 'nonexistent',
          toStatus: 'done',
          confidence: 0.9,
          source: 'human',
        }),
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionFailure(result)).toBe(true);
      if (isTransactionFailure(result)) {
        expect(result.rolledBack).toBe(true);
        expect(result.partialEffects).toHaveLength(0);
      }
    });

    it('rolls back on mid-plan failure', async () => {
      const plan = createPlan([
        intentStep({
          kind: 'CreateTask',
          tasks: [{ title: 'Task 1' }],
          confidence: 0.9,
          source: 'human',
        }),
        intentStep({
          kind: 'ChangeStatus',
          taskId: 'nonexistent',
          toStatus: 'done',
          confidence: 0.9,
          source: 'human',
        }),
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionFailure(result)).toBe(true);
      if (isTransactionFailure(result)) {
        expect(result.failedAt).toBe(1);
        expect(result.rolledBack).toBe(true);
        // Partial effects are discarded on rollback
        expect(result.partialEffects).toHaveLength(0);
      }
    });

    it('records trace even on failure', async () => {
      const plan = createPlan([
        intentStep({
          kind: 'CreateTask',
          tasks: [{ title: 'Task 1' }],
          confidence: 0.9,
          source: 'human',
        }),
        intentStep({
          kind: 'ChangeStatus',
          taskId: 'nonexistent',
          toStatus: 'done',
          confidence: 0.9,
          source: 'human',
        }),
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionFailure(result)).toBe(true);
      if (isTransactionFailure(result)) {
        expect(result.trace).toHaveLength(2);
        expect(result.trace[0]?.success).toBe(true);
        expect(result.trace[1]?.success).toBe(false);
      }
    });
  });

  describe('Note Steps', () => {
    it('executes note steps as no-ops', async () => {
      const plan = createPlan([
        { kind: 'note', text: 'This is a note' },
        intentStep({
          kind: 'ChangeView',
          viewMode: 'table',
          confidence: 0.9,
          source: 'human',
        }),
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.trace).toHaveLength(2);
        expect(result.trace[0]?.kind).toBe('note');
        expect(result.trace[0]?.success).toBe(true);
      }
    });
  });

  describe('Query Steps', () => {
    it('executes countTasks query', async () => {
      const plan = createPlan([
        {
          kind: 'query',
          query: { kind: 'countTasks' },
          assign: 'count',
        },
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Task 1' },
        { id: 't2', title: 'Task 2' },
      ]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.variables.count).toBe(2);
      }
    });

    it('executes countTasks with filter', async () => {
      const plan = createPlan([
        {
          kind: 'query',
          query: {
            kind: 'countTasks',
            filter: { status: 'done' },
          },
          assign: 'doneCount',
        },
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Task 1', status: 'todo' },
        { id: 't2', title: 'Task 2', status: 'done' },
        { id: 't3', title: 'Task 3', status: 'done' },
      ]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.variables.doneCount).toBe(2);
      }
    });

    it('executes findTask query', async () => {
      const plan = createPlan([
        {
          kind: 'query',
          query: { kind: 'findTask', hint: 'Report' },
          assign: 'found',
        },
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Task 1' },
        { id: 't2', title: 'Weekly Report' },
      ]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.variables.found).toBeDefined();
        expect((result.variables.found as { title: string }).title).toBe('Weekly Report');
      }
    });

    it('executes listTasks query with limit', async () => {
      const plan = createPlan([
        {
          kind: 'query',
          query: { kind: 'listTasks', limit: 2 },
          assign: 'tasks',
        },
      ]);
      const snapshot = createSnapshot([
        { id: 't1', title: 'Task 1' },
        { id: 't2', title: 'Task 2' },
        { id: 't3', title: 'Task 3' },
      ]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.variables.tasks).toHaveLength(2);
      }
    });
  });

  describe('If Steps', () => {
    it('executes then branch when condition is true', async () => {
      const plan = createPlan([
        {
          kind: 'query',
          query: { kind: 'countTasks' },
          assign: 'count',
        },
        {
          kind: 'if',
          cond: { op: 'gte', left: { var: 'count' }, right: 1 },
          then: [
            intentStep({
              kind: 'ChangeView',
              viewMode: 'table',
              confidence: 0.9,
              source: 'human',
            }),
          ],
          else: [
            intentStep({
              kind: 'ChangeView',
              viewMode: 'kanban',
              confidence: 0.9,
              source: 'human',
            }),
          ],
        },
      ]);
      const snapshot = createSnapshot([{ id: 't1', title: 'Task 1' }]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.finalSnapshot.state.viewMode).toBe('table');
      }
    });

    it('executes else branch when condition is false', async () => {
      const plan = createPlan([
        {
          kind: 'query',
          query: { kind: 'countTasks' },
          assign: 'count',
        },
        {
          kind: 'if',
          cond: { op: 'gte', left: { var: 'count' }, right: 5 },
          then: [
            intentStep({
              kind: 'ChangeView',
              viewMode: 'table',
              confidence: 0.9,
              source: 'human',
            }),
          ],
          else: [
            intentStep({
              kind: 'ChangeView',
              viewMode: 'todo',
              confidence: 0.9,
              source: 'human',
            }),
          ],
        },
      ]);
      const snapshot = createSnapshot([{ id: 't1', title: 'Task 1' }]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.finalSnapshot.state.viewMode).toBe('todo');
      }
    });

    it('skips else branch if not provided', async () => {
      const plan = createPlan([
        {
          kind: 'if',
          cond: { op: 'eq', left: { var: 'x' }, right: 1 },
          then: [
            intentStep({
              kind: 'ChangeView',
              viewMode: 'table',
              confidence: 0.9,
              source: 'human',
            }),
          ],
        },
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        // View should remain unchanged
        expect(result.finalSnapshot.state.viewMode).toBe('kanban');
      }
    });
  });

  describe('Confirm Steps', () => {
    it('returns confirm pending for confirm step', async () => {
      const plan = createPlan([
        {
          kind: 'confirm',
          message: 'Delete task?',
          onApprove: [
            intentStep({
              kind: 'DeleteTask',
              taskId: 't1',
              confidence: 0.9,
              source: 'human',
            }),
          ],
        },
      ]);
      const snapshot = createSnapshot([{ id: 't1', title: 'Task 1' }]);

      const result = await executeTransaction(plan, snapshot);

      expect(isConfirmPending(result)).toBe(true);
      if (isConfirmPending(result)) {
        expect(result.message).toBe('Delete task?');
        expect(result.onApprove).toHaveLength(1);
      }
    });

    it('continues execution after confirm approval', async () => {
      const plan = createPlan([
        {
          kind: 'confirm',
          message: 'Proceed?',
          onApprove: [
            intentStep({
              kind: 'ChangeView',
              viewMode: 'table',
              confidence: 0.9,
              source: 'human',
            }),
          ],
        },
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);
      expect(isConfirmPending(result)).toBe(true);

      if (isConfirmPending(result)) {
        const continued = await continueAfterConfirm(result, true);

        expect(isTransactionSuccess(continued)).toBe(true);
        if (isTransactionSuccess(continued)) {
          expect(continued.finalSnapshot.state.viewMode).toBe('table');
        }
      }
    });

    it('executes reject branch on confirmation rejection', async () => {
      const plan = createPlan([
        {
          kind: 'confirm',
          message: 'Switch view?',
          onApprove: [
            intentStep({
              kind: 'ChangeView',
              viewMode: 'table',
              confidence: 0.9,
              source: 'human',
            }),
          ],
          onReject: [
            intentStep({
              kind: 'ChangeView',
              viewMode: 'todo',
              confidence: 0.9,
              source: 'human',
            }),
          ],
        },
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);
      expect(isConfirmPending(result)).toBe(true);

      if (isConfirmPending(result)) {
        const continued = await continueAfterConfirm(result, false);

        expect(isTransactionSuccess(continued)).toBe(true);
        if (isTransactionSuccess(continued)) {
          expect(continued.finalSnapshot.state.viewMode).toBe('todo');
        }
      }
    });

    it('continues with remaining steps after confirm', async () => {
      const plan = createPlan([
        {
          kind: 'confirm',
          message: 'Create task?',
          onApprove: [
            intentStep({
              kind: 'CreateTask',
              tasks: [{ title: 'Confirmed Task' }],
              confidence: 0.9,
              source: 'human',
            }),
          ],
        },
        intentStep({
          kind: 'ChangeView',
          viewMode: 'table',
          confidence: 0.9,
          source: 'human',
        }),
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);
      expect(isConfirmPending(result)).toBe(true);

      if (isConfirmPending(result)) {
        expect(result.remainingSteps).toHaveLength(1);

        const continued = await continueAfterConfirm(result, true);

        expect(isTransactionSuccess(continued)).toBe(true);
        if (isTransactionSuccess(continued)) {
          expect(continued.finalSnapshot.data.tasks).toHaveLength(1);
          expect(continued.finalSnapshot.state.viewMode).toBe('table');
        }
      }
    });
  });

  describe('Condition Evaluation', () => {
    it('evaluates eq condition', async () => {
      const plan = createPlan([
        {
          kind: 'query',
          query: { kind: 'countTasks' },
          assign: 'count',
        },
        {
          kind: 'if',
          cond: { op: 'eq', left: { var: 'count' }, right: 2 },
          then: [intentStep({ kind: 'ChangeView', viewMode: 'table', confidence: 0.9, source: 'human' })],
        },
      ]);
      const snapshot = createSnapshot([{ id: 't1', title: 'Task 1' }, { id: 't2', title: 'Task 2' }]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.finalSnapshot.state.viewMode).toBe('table');
      }
    });

    it('evaluates neq condition', async () => {
      const plan = createPlan([
        {
          kind: 'query',
          query: { kind: 'countTasks' },
          assign: 'count',
        },
        {
          kind: 'if',
          cond: { op: 'neq', left: { var: 'count' }, right: 0 },
          then: [intentStep({ kind: 'ChangeView', viewMode: 'table', confidence: 0.9, source: 'human' })],
        },
      ]);
      const snapshot = createSnapshot([{ id: 't1', title: 'Task 1' }]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.finalSnapshot.state.viewMode).toBe('table');
      }
    });

    it('evaluates exists condition', async () => {
      const plan = createPlan([
        {
          kind: 'query',
          query: { kind: 'findTask', hint: 'Report' },
          assign: 'found',
        },
        {
          kind: 'if',
          cond: { op: 'exists', var: { var: 'found' } },
          then: [intentStep({ kind: 'ChangeView', viewMode: 'table', confidence: 0.9, source: 'human' })],
        },
      ]);
      const snapshot = createSnapshot([{ id: 't1', title: 'Report' }]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.finalSnapshot.state.viewMode).toBe('table');
      }
    });

    it('evaluates notExists condition', async () => {
      const plan = createPlan([
        {
          kind: 'query',
          query: { kind: 'findTask', hint: 'Nonexistent' },
          assign: 'found',
        },
        {
          kind: 'if',
          cond: { op: 'notExists', var: { var: 'found' } },
          then: [intentStep({ kind: 'ChangeView', viewMode: 'table', confidence: 0.9, source: 'human' })],
        },
      ]);
      const snapshot = createSnapshot([{ id: 't1', title: 'Other Task' }]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.finalSnapshot.state.viewMode).toBe('table');
      }
    });

    it('evaluates and condition', async () => {
      const plan = createPlan([
        {
          kind: 'query',
          query: { kind: 'countTasks' },
          assign: 'count',
        },
        {
          kind: 'if',
          cond: {
            op: 'and',
            items: [
              { op: 'gte', left: { var: 'count' }, right: 1 },
              { op: 'lte', left: { var: 'count' }, right: 5 },
            ],
          },
          then: [intentStep({ kind: 'ChangeView', viewMode: 'table', confidence: 0.9, source: 'human' })],
        },
      ]);
      const snapshot = createSnapshot([{ id: 't1', title: 'Task 1' }, { id: 't2', title: 'Task 2' }]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.finalSnapshot.state.viewMode).toBe('table');
      }
    });

    it('evaluates or condition', async () => {
      const plan = createPlan([
        {
          kind: 'query',
          query: { kind: 'countTasks' },
          assign: 'count',
        },
        {
          kind: 'if',
          cond: {
            op: 'or',
            items: [
              { op: 'eq', left: { var: 'count' }, right: 0 },
              { op: 'eq', left: { var: 'count' }, right: 2 },
            ],
          },
          then: [intentStep({ kind: 'ChangeView', viewMode: 'table', confidence: 0.9, source: 'human' })],
        },
      ]);
      const snapshot = createSnapshot([{ id: 't1', title: 'Task 1' }, { id: 't2', title: 'Task 2' }]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.finalSnapshot.state.viewMode).toBe('table');
      }
    });

    it('evaluates not condition', async () => {
      const plan = createPlan([
        {
          kind: 'query',
          query: { kind: 'countTasks' },
          assign: 'count',
        },
        {
          kind: 'if',
          cond: {
            op: 'not',
            items: [{ op: 'eq', left: { var: 'count' }, right: 0 }],
          },
          then: [intentStep({ kind: 'ChangeView', viewMode: 'table', confidence: 0.9, source: 'human' })],
        },
      ]);
      const snapshot = createSnapshot([{ id: 't1', title: 'Task 1' }]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.finalSnapshot.state.viewMode).toBe('table');
      }
    });
  });

  describe('Trace Recording', () => {
    it('records timing for each step', async () => {
      const plan = createPlan([
        intentStep({
          kind: 'ChangeView',
          viewMode: 'table',
          confidence: 0.9,
          source: 'human',
        }),
        intentStep({
          kind: 'CreateTask',
          tasks: [{ title: 'Task 1' }],
          confidence: 0.9,
          source: 'human',
        }),
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.trace).toHaveLength(2);
        for (const entry of result.trace) {
          expect(entry.startTime).toBeDefined();
          expect(entry.endTime).toBeDefined();
          expect(entry.endTime!).toBeGreaterThanOrEqual(entry.startTime);
        }
      }
    });

    it('records step index correctly', async () => {
      const plan = createPlan([
        { kind: 'note', text: 'Note 1' },
        intentStep({ kind: 'ChangeView', viewMode: 'table', confidence: 0.9, source: 'human' }),
        { kind: 'note', text: 'Note 2' },
      ]);
      const snapshot = createSnapshot([]);

      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      if (isTransactionSuccess(result)) {
        expect(result.trace[0]?.index).toBe(0);
        expect(result.trace[1]?.index).toBe(1);
        expect(result.trace[2]?.index).toBe(2);
      }
    });
  });

  describe('Type Guards', () => {
    it('isTransactionSuccess identifies success', async () => {
      const plan = createPlan([]);
      const snapshot = createSnapshot([]);
      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(true);
      expect(isTransactionFailure(result)).toBe(false);
      expect(isConfirmPending(result)).toBe(false);
    });

    it('isTransactionFailure identifies failure', async () => {
      const plan = createPlan([
        intentStep({
          kind: 'ChangeStatus',
          taskId: 'nonexistent',
          toStatus: 'done',
          confidence: 0.9,
          source: 'human',
        }),
      ]);
      const snapshot = createSnapshot([]);
      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(false);
      expect(isTransactionFailure(result)).toBe(true);
      expect(isConfirmPending(result)).toBe(false);
    });

    it('isConfirmPending identifies pending', async () => {
      const plan = createPlan([
        {
          kind: 'confirm',
          message: 'Test?',
          onApprove: [],
        },
      ]);
      const snapshot = createSnapshot([]);
      const result = await executeTransaction(plan, snapshot);

      expect(isTransactionSuccess(result)).toBe(false);
      expect(isTransactionFailure(result)).toBe(false);
      expect(isConfirmPending(result)).toBe(true);
    });
  });
});
