import { describe, it, expect } from 'vitest';
import {
  executeIntent,
  calculateSnapshotDiff,
  findTask,
  findTaskIndex,
  isTaskDeleted,
  getActiveTasks,
  getDeletedTasks,
  type Snapshot,
} from './runtime';
import { IntentBuilder } from './intent';
import { isPatchEffect, type SnapshotPatchEffect } from './types';

// Helper to safely get ops from patch effect
function getPatchOps(effects: import('./types').AgentEffect[], index = 0) {
  const effect = effects[index];
  if (!effect || !isPatchEffect(effect)) {
    throw new Error(`Effect at index ${index} is not a patch effect`);
  }
  return effect.ops;
}

// Helper to create a test snapshot
function createTestSnapshot(overrides?: Partial<Snapshot>): Snapshot {
  return {
    data: {
      tasks: [
        {
          id: 'task-1',
          title: 'Task 1',
          status: 'todo',
          priority: 'medium',
          tags: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'task-2',
          title: 'Task 2',
          status: 'in-progress',
          priority: 'high',
          tags: ['urgent'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
    },
    state: {
      viewMode: 'kanban',
      dateFilter: null,
      selectedTaskId: null,
    },
    ...overrides,
  };
}

describe('executeIntent', () => {
  describe('ChangeView', () => {
    it('should generate effect to change view mode', () => {
      const snapshot = createTestSnapshot();
      const intent = IntentBuilder.changeView('table');

      const result = executeIntent(intent, snapshot);

      expect(result.success).toBe(true);
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].type).toBe('snapshot.patch');
      expect(getPatchOps(result.effects)).toEqual([
        { op: 'set', path: 'state.viewMode', value: 'table' },
      ]);
    });
  });

  describe('SetDateFilter', () => {
    it('should generate effect to set date filter', () => {
      const snapshot = createTestSnapshot();
      const filter = { field: 'dueDate' as const, type: 'today' as const };
      const intent = IntentBuilder.setDateFilter(filter);

      const result = executeIntent(intent, snapshot);

      expect(result.success).toBe(true);
      expect(getPatchOps(result.effects)).toEqual([
        { op: 'set', path: 'state.dateFilter', value: filter },
      ]);
    });

    it('should generate effect to clear date filter', () => {
      const snapshot = createTestSnapshot({
        state: {
          viewMode: 'kanban',
          dateFilter: { field: 'dueDate', type: 'today' },
          selectedTaskId: null,
        },
      });
      const intent = IntentBuilder.setDateFilter(null);

      const result = executeIntent(intent, snapshot);

      expect(result.success).toBe(true);
      expect(getPatchOps(result.effects)).toEqual([
        { op: 'set', path: 'state.dateFilter', value: null },
      ]);
    });
  });

  describe('CreateTask', () => {
    it('should generate effect to append new task', () => {
      const snapshot = createTestSnapshot();
      const intent = IntentBuilder.createTask({ title: 'New Task', priority: 'high' });

      const result = executeIntent(intent, snapshot);

      expect(result.success).toBe(true);
      expect(result.effects).toHaveLength(1);
      const ops = getPatchOps(result.effects);
      expect(ops).toHaveLength(1);

      const op = ops[0];
      expect(op.op).toBe('append');
      expect(op.path).toBe('data.tasks');
      expect(op.value).toMatchObject({
        title: 'New Task',
        priority: 'high',
        status: 'todo',
      });
    });

    it('should generate effects for multiple tasks', () => {
      const snapshot = createTestSnapshot();
      const intent = IntentBuilder.createTask([
        { title: 'Task A' },
        { title: 'Task B', priority: 'high' },
      ]);

      const result = executeIntent(intent, snapshot);

      expect(result.success).toBe(true);
      expect(result.effects).toHaveLength(1);
      const ops = getPatchOps(result.effects);
      expect(ops).toHaveLength(2);

      expect(ops[0]).toMatchObject({
        op: 'append',
        path: 'data.tasks',
      });
      expect(ops[0].value).toMatchObject({ title: 'Task A' });

      expect(ops[1]).toMatchObject({
        op: 'append',
        path: 'data.tasks',
      });
      expect(ops[1].value).toMatchObject({ title: 'Task B', priority: 'high' });
    });
  });

  describe('UpdateTask', () => {
    it('should generate effect to update task status', () => {
      const snapshot = createTestSnapshot();
      const intent = IntentBuilder.updateTask('task-1', { status: 'done' });

      const result = executeIntent(intent, snapshot);

      expect(result.success).toBe(true);
      const ops = getPatchOps(result.effects);
      // Uses taskId-based path format: data.tasks.id:taskId.field
      expect(ops.some((op: { path: string; value: unknown }) => op.path === 'data.tasks.id:task-1.status' && op.value === 'done')).toBe(true);
    });

    it('should fail if task not found', () => {
      const snapshot = createTestSnapshot();
      const intent = IntentBuilder.updateTask('nonexistent', { status: 'done' });

      const result = executeIntent(intent, snapshot);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task not found');
    });
  });

  describe('DeleteTask', () => {
    it('should generate effect to remove task', () => {
      const snapshot = createTestSnapshot();
      const intent = IntentBuilder.deleteTask('task-1');

      const result = executeIntent(intent, snapshot);

      expect(result.success).toBe(true);
      expect(getPatchOps(result.effects)).toEqual([
        { op: 'remove', path: 'data.tasks', value: 'task-1' },
      ]);
    });
  });

  describe('RestoreTask', () => {
    it('should generate effect to restore task', () => {
      const snapshot = createTestSnapshot();
      const intent = IntentBuilder.restoreTask('task-1');

      const result = executeIntent(intent, snapshot);

      expect(result.success).toBe(true);
      expect(getPatchOps(result.effects)).toEqual([
        { op: 'restore', path: 'data.tasks', value: 'task-1' },
      ]);
    });
  });

  describe('SelectTask', () => {
    it('should generate effect to select task', () => {
      const snapshot = createTestSnapshot();
      const intent = IntentBuilder.selectTask('task-2');

      const result = executeIntent(intent, snapshot);

      expect(result.success).toBe(true);
      expect(getPatchOps(result.effects)).toEqual([
        { op: 'set', path: 'state.selectedTaskId', value: 'task-2' },
      ]);
    });

    it('should generate effect to deselect task', () => {
      const snapshot = createTestSnapshot({
        state: {
          viewMode: 'kanban',
          dateFilter: null,
          selectedTaskId: 'task-1',
        },
      });
      const intent = IntentBuilder.selectTask(null);

      const result = executeIntent(intent, snapshot);

      expect(result.success).toBe(true);
      expect(getPatchOps(result.effects)).toEqual([
        { op: 'set', path: 'state.selectedTaskId', value: null },
      ]);
    });
  });

  describe('QueryTasks (read-only)', () => {
    it('should return empty effects for query intent', () => {
      const snapshot = createTestSnapshot();
      const intent = IntentBuilder.queryTasks('How many tasks?');

      const result = executeIntent(intent, snapshot);

      expect(result.success).toBe(true);
      expect(result.effects).toHaveLength(0);
    });
  });

  describe('Validation', () => {
    it('should fail for invalid intent', () => {
      const snapshot = createTestSnapshot();
      const invalidIntent = { kind: 'InvalidKind' } as any;

      const result = executeIntent(invalidIntent, snapshot);

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });
  });
});

describe('calculateSnapshotDiff', () => {
  it('should detect view mode change', () => {
    const before = createTestSnapshot({ state: { viewMode: 'kanban', dateFilter: null, selectedTaskId: null } });
    const after = createTestSnapshot({ state: { viewMode: 'table', dateFilter: null, selectedTaskId: null } });

    const diff = calculateSnapshotDiff(before, after);

    expect(diff.viewModeChanged).toEqual({ from: 'kanban', to: 'table' });
  });

  it('should detect date filter change', () => {
    const before = createTestSnapshot();
    const after = createTestSnapshot({
      state: { viewMode: 'kanban', dateFilter: { field: 'dueDate', type: 'today' }, selectedTaskId: null },
    });

    const diff = calculateSnapshotDiff(before, after);

    expect(diff.dateFilterChanged).toEqual({
      from: null,
      to: { field: 'dueDate', type: 'today' },
    });
  });

  it('should detect selected task change', () => {
    const before = createTestSnapshot();
    const after = createTestSnapshot({
      state: { viewMode: 'kanban', dateFilter: null, selectedTaskId: 'task-1' },
    });

    const diff = calculateSnapshotDiff(before, after);

    expect(diff.selectedTaskChanged).toEqual({ from: null, to: 'task-1' });
  });

  it('should detect added tasks', () => {
    const before = createTestSnapshot();
    const after = createTestSnapshot();
    after.data.tasks.push({
      id: 'task-3',
      title: 'New Task',
      status: 'todo',
      priority: 'low',
      tags: [],
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    });

    const diff = calculateSnapshotDiff(before, after);

    expect(diff.tasksAdded).toHaveLength(1);
    expect(diff.tasksAdded![0].id).toBe('task-3');
  });

  it('should detect deleted tasks', () => {
    const before = createTestSnapshot();
    const after = createTestSnapshot();
    after.data.tasks[0].deletedAt = '2024-01-02T00:00:00Z';

    const diff = calculateSnapshotDiff(before, after);

    expect(diff.tasksDeleted).toEqual(['task-1']);
  });

  it('should detect restored tasks', () => {
    const before = createTestSnapshot();
    before.data.tasks[0].deletedAt = '2024-01-02T00:00:00Z';
    const after = createTestSnapshot();

    const diff = calculateSnapshotDiff(before, after);

    expect(diff.tasksRestored).toEqual(['task-1']);
  });

  it('should detect updated tasks', () => {
    const before = createTestSnapshot();
    const after = createTestSnapshot();
    after.data.tasks[0].status = 'done';

    const diff = calculateSnapshotDiff(before, after);

    expect(diff.tasksUpdated).toHaveLength(1);
    expect(diff.tasksUpdated![0].taskId).toBe('task-1');
    expect(diff.tasksUpdated![0].changes).toMatchObject({ status: 'done' });
  });
});

describe('Utility Functions', () => {
  describe('findTask', () => {
    it('should find task by id', () => {
      const snapshot = createTestSnapshot();
      const task = findTask(snapshot, 'task-1');
      expect(task?.title).toBe('Task 1');
    });

    it('should return undefined for nonexistent task', () => {
      const snapshot = createTestSnapshot();
      const task = findTask(snapshot, 'nonexistent');
      expect(task).toBeUndefined();
    });
  });

  describe('findTaskIndex', () => {
    it('should return correct index', () => {
      const snapshot = createTestSnapshot();
      expect(findTaskIndex(snapshot, 'task-1')).toBe(0);
      expect(findTaskIndex(snapshot, 'task-2')).toBe(1);
    });

    it('should return -1 for nonexistent task', () => {
      const snapshot = createTestSnapshot();
      expect(findTaskIndex(snapshot, 'nonexistent')).toBe(-1);
    });
  });

  describe('isTaskDeleted', () => {
    it('should return true for deleted task', () => {
      const task = {
        id: 'task-1',
        title: 'Deleted Task',
        status: 'todo' as const,
        priority: 'medium' as const,
        tags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        deletedAt: '2024-01-02T00:00:00Z',
      };
      expect(isTaskDeleted(task)).toBe(true);
    });

    it('should return false for active task', () => {
      const task = {
        id: 'task-1',
        title: 'Active Task',
        status: 'todo' as const,
        priority: 'medium' as const,
        tags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      expect(isTaskDeleted(task)).toBe(false);
    });
  });

  describe('getActiveTasks', () => {
    it('should filter out deleted tasks', () => {
      const snapshot = createTestSnapshot();
      snapshot.data.tasks[0].deletedAt = '2024-01-02T00:00:00Z';

      const activeTasks = getActiveTasks(snapshot);

      expect(activeTasks).toHaveLength(1);
      expect(activeTasks[0].id).toBe('task-2');
    });
  });

  describe('getDeletedTasks', () => {
    it('should return only deleted tasks', () => {
      const snapshot = createTestSnapshot();
      snapshot.data.tasks[0].deletedAt = '2024-01-02T00:00:00Z';

      const deletedTasks = getDeletedTasks(snapshot);

      expect(deletedTasks).toHaveLength(1);
      expect(deletedTasks[0].id).toBe('task-1');
    });
  });
});
