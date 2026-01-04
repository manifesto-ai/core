import { describe, it, expect } from 'vitest';
import {
  validateIntent,
  IntentBuilder,
  INTENT_KINDS,
  isReadOnlyIntent,
  type Intent,
} from './intent';

describe('Intent Validation', () => {
  describe('validateIntent', () => {
    it('should validate a correct ChangeView intent', () => {
      const intent = IntentBuilder.changeView('kanban');
      const result = validateIntent(intent);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a correct CreateTask intent', () => {
      const intent = IntentBuilder.createTask({ title: 'Test Task', priority: 'high' });
      const result = validateIntent(intent);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject intent without kind', () => {
      const intent = { confidence: 0.9, source: 'ui' };
      const result = validateIntent(intent);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Intent must have a "kind" field');
    });

    it('should reject intent with invalid kind', () => {
      const intent = { kind: 'InvalidKind', confidence: 0.9, source: 'ui' };
      const result = validateIntent(intent);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unknown intent kind'))).toBe(true);
    });

    it('should reject intent without confidence', () => {
      const intent = { kind: 'ChangeView', source: 'ui', viewMode: 'kanban' };
      const result = validateIntent(intent);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Intent must have a valid "confidence" field (0-1)');
    });

    it('should reject intent with invalid source', () => {
      const intent = { kind: 'ChangeView', confidence: 0.9, source: 'invalid', viewMode: 'kanban' };
      const result = validateIntent(intent);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Intent must have a valid "source" field');
    });
  });

  describe('Kind-specific validation', () => {
    it('should reject ChangeView without viewMode', () => {
      const intent = { kind: 'ChangeView', confidence: 0.9, source: 'ui' };
      const result = validateIntent(intent);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('viewMode'))).toBe(true);
    });

    it('should reject CreateTask without tasks array', () => {
      const intent = { kind: 'CreateTask', confidence: 0.9, source: 'ui' };
      const result = validateIntent(intent);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tasks'))).toBe(true);
    });

    it('should reject CreateTask with empty tasks array', () => {
      const intent = { kind: 'CreateTask', confidence: 0.9, source: 'ui', tasks: [] };
      const result = validateIntent(intent);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tasks'))).toBe(true);
    });

    it('should reject CreateTask task without title', () => {
      const intent = { kind: 'CreateTask', confidence: 0.9, source: 'ui', tasks: [{ priority: 'high' }] };
      const result = validateIntent(intent);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('title'))).toBe(true);
    });

    it('should reject UpdateTask without taskId', () => {
      const intent = { kind: 'UpdateTask', confidence: 0.9, source: 'ui', changes: {} };
      const result = validateIntent(intent);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('taskId'))).toBe(true);
    });

    it('should reject UpdateTask without changes', () => {
      const intent = { kind: 'UpdateTask', confidence: 0.9, source: 'ui', taskId: 'task-1' };
      const result = validateIntent(intent);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('changes'))).toBe(true);
    });
  });
});

describe('IntentBuilder', () => {
  it('should create ChangeView intent', () => {
    const intent = IntentBuilder.changeView('table');
    expect(intent.kind).toBe('ChangeView');
    expect(intent.viewMode).toBe('table');
    expect(intent.confidence).toBe(1.0);
    expect(intent.source).toBe('ui');
  });

  it('should create SetDateFilter intent', () => {
    const filter = { field: 'dueDate' as const, type: 'today' as const };
    const intent = IntentBuilder.setDateFilter(filter);
    expect(intent.kind).toBe('SetDateFilter');
    expect(intent.filter).toEqual(filter);
  });

  it('should create SetDateFilter with null (clear)', () => {
    const intent = IntentBuilder.setDateFilter(null);
    expect(intent.kind).toBe('SetDateFilter');
    expect(intent.filter).toBeNull();
  });

  it('should create CreateTask intent with single task', () => {
    const intent = IntentBuilder.createTask({
      title: 'My Task',
      description: 'A description',
      priority: 'high',
      tags: ['urgent'],
    });
    expect(intent.kind).toBe('CreateTask');
    expect(intent.tasks).toHaveLength(1);
    expect(intent.tasks[0].title).toBe('My Task');
    expect(intent.tasks[0].description).toBe('A description');
    expect(intent.tasks[0].priority).toBe('high');
    expect(intent.tasks[0].tags).toEqual(['urgent']);
  });

  it('should create CreateTask intent with multiple tasks', () => {
    const intent = IntentBuilder.createTask([
      { title: 'Task 1' },
      { title: 'Task 2', priority: 'high' },
    ]);
    expect(intent.kind).toBe('CreateTask');
    expect(intent.tasks).toHaveLength(2);
    expect(intent.tasks[0].title).toBe('Task 1');
    expect(intent.tasks[1].title).toBe('Task 2');
    expect(intent.tasks[1].priority).toBe('high');
  });

  it('should create UpdateTask intent', () => {
    const intent = IntentBuilder.updateTask('task-123', { status: 'done' });
    expect(intent.kind).toBe('UpdateTask');
    expect(intent.taskId).toBe('task-123');
    expect(intent.changes).toEqual({ status: 'done' });
  });

  it('should create DeleteTask intent', () => {
    const intent = IntentBuilder.deleteTask('task-123');
    expect(intent.kind).toBe('DeleteTask');
    expect(intent.taskId).toBe('task-123');
  });

  it('should create RestoreTask intent', () => {
    const intent = IntentBuilder.restoreTask('task-123');
    expect(intent.kind).toBe('RestoreTask');
    expect(intent.taskId).toBe('task-123');
  });

  it('should create SelectTask intent', () => {
    const intent = IntentBuilder.selectTask('task-123');
    expect(intent.kind).toBe('SelectTask');
    expect(intent.taskId).toBe('task-123');
  });

  it('should create SelectTask with null (deselect)', () => {
    const intent = IntentBuilder.selectTask(null);
    expect(intent.kind).toBe('SelectTask');
    expect(intent.taskId).toBeNull();
  });

  it('should create QueryTasks intent', () => {
    const intent = IntentBuilder.queryTasks('How many tasks are done?');
    expect(intent.kind).toBe('QueryTasks');
    expect(intent.query).toBe('How many tasks are done?');
  });
});

describe('isReadOnlyIntent', () => {
  it('should return true for QueryTasks', () => {
    const intent = IntentBuilder.queryTasks('test');
    expect(isReadOnlyIntent(intent)).toBe(true);
  });

  it('should return false for CreateTask', () => {
    const intent = IntentBuilder.createTask({ title: 'test' });
    expect(isReadOnlyIntent(intent)).toBe(false);
  });

  it('should return false for UpdateTask', () => {
    const intent = IntentBuilder.updateTask('id', { status: 'done' });
    expect(isReadOnlyIntent(intent)).toBe(false);
  });

  it('should return false for DeleteTask', () => {
    const intent = IntentBuilder.deleteTask('id');
    expect(isReadOnlyIntent(intent)).toBe(false);
  });
});

describe('INTENT_KINDS', () => {
  it('should have all 12 intent kinds', () => {
    expect(INTENT_KINDS).toHaveLength(12);
    expect(INTENT_KINDS).toContain('ChangeView');
    expect(INTENT_KINDS).toContain('SetDateFilter');
    expect(INTENT_KINDS).toContain('CreateTask');
    expect(INTENT_KINDS).toContain('UpdateTask');
    expect(INTENT_KINDS).toContain('ChangeStatus');
    expect(INTENT_KINDS).toContain('DeleteTask');
    expect(INTENT_KINDS).toContain('RestoreTask');
    expect(INTENT_KINDS).toContain('SelectTask');
    expect(INTENT_KINDS).toContain('QueryTasks');
    expect(INTENT_KINDS).toContain('ToggleAssistant');
    expect(INTENT_KINDS).toContain('RequestClarification');
    expect(INTENT_KINDS).toContain('Undo');
  });
});
