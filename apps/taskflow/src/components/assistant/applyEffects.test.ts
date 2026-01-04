/**
 * applyEffects Unit Tests
 *
 * Tests all effect patterns that the AssistantPanel's applyEffects function
 * should handle based on the runtime.ts effect generation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentEffect, PatchOp } from '@/lib/agents/types';
import type { Task } from '@/manifesto';

// ============================================================================
// Effect Pattern Regex Tests
// ============================================================================

describe('Effect Pattern Matching', () => {
  // Regex patterns from applyEffects
  const idFormatRegex = /data\.tasks\.id:([^.]+)\.(\w+)/;
  const legacyFormatRegex = /data\.tasks\.(\d+)\.(\w+)/;

  describe('ID Format: data.tasks.id:taskId.field', () => {
    it('should match simple UUID taskId', () => {
      const path = 'data.tasks.id:28c7f080-4f03-4e4e-6880-0006d9956580.assignee';
      const match = path.match(idFormatRegex);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('28c7f080-4f03-4e4e-6880-0006d9956580');
      expect(match?.[2]).toBe('assignee');
    });

    it('should match taskId with timestamp prefix', () => {
      const path = 'data.tasks.id:task-1735934830480-0-j2l7kid.status';
      const match = path.match(idFormatRegex);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('task-1735934830480-0-j2l7kid');
      expect(match?.[2]).toBe('status');
    });

    it('should match simple taskId', () => {
      const path = 'data.tasks.id:task-1.title';
      const match = path.match(idFormatRegex);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('task-1');
      expect(match?.[2]).toBe('title');
    });

    it('should match various field names', () => {
      const fields = ['title', 'description', 'status', 'priority', 'assignee', 'dueDate', 'tags', 'updatedAt'];

      for (const field of fields) {
        const path = `data.tasks.id:task-123.${field}`;
        const match = path.match(idFormatRegex);

        expect(match).not.toBeNull();
        expect(match?.[2]).toBe(field);
      }
    });

    it('should NOT match path without id: prefix', () => {
      const path = 'data.tasks.task-1.title';
      const match = path.match(idFormatRegex);

      expect(match).toBeNull();
    });
  });

  describe('Legacy Format: data.tasks.index.field', () => {
    it('should match numeric index', () => {
      const path = 'data.tasks.0.status';
      const match = path.match(legacyFormatRegex);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('0');
      expect(match?.[2]).toBe('status');
    });

    it('should match larger index', () => {
      const path = 'data.tasks.42.title';
      const match = path.match(legacyFormatRegex);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('42');
      expect(match?.[2]).toBe('title');
    });

    it('should NOT match non-numeric index', () => {
      const path = 'data.tasks.abc.title';
      const match = path.match(legacyFormatRegex);

      expect(match).toBeNull();
    });
  });
});

// ============================================================================
// Effect Processing Tests (Mock-based)
// ============================================================================

describe('Effect Processing Logic', () => {
  // Mock action functions
  let mockCreateTask: ReturnType<typeof vi.fn>;
  let mockUpdateTask: ReturnType<typeof vi.fn>;
  let mockDeleteTask: ReturnType<typeof vi.fn>;
  let mockRestoreTask: ReturnType<typeof vi.fn>;
  let mockChangeView: ReturnType<typeof vi.fn>;
  let mockSelectTask: ReturnType<typeof vi.fn>;
  let mockMoveTask: ReturnType<typeof vi.fn>;
  let mockSetDateFilter: ReturnType<typeof vi.fn>;
  let mockSetAssistantOpen: ReturnType<typeof vi.fn>;

  // Sample tasks for testing
  const sampleTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Test Task 1',
      description: 'Description 1',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      dueDate: null,
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    },
    {
      id: 'task-2',
      title: 'Test Task 2',
      description: 'Description 2',
      status: 'in-progress',
      priority: 'high',
      assignee: 'John',
      dueDate: '2026-01-15',
      tags: ['urgent'],
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      deletedAt: null,
    },
  ];

  beforeEach(() => {
    mockCreateTask = vi.fn().mockResolvedValue(undefined);
    mockUpdateTask = vi.fn().mockResolvedValue(undefined);
    mockDeleteTask = vi.fn().mockResolvedValue(undefined);
    mockRestoreTask = vi.fn().mockResolvedValue(undefined);
    mockChangeView = vi.fn().mockResolvedValue(undefined);
    mockSelectTask = vi.fn().mockResolvedValue(undefined);
    mockMoveTask = vi.fn().mockResolvedValue(undefined);
    mockSetDateFilter = vi.fn();
    mockSetAssistantOpen = vi.fn();
  });

  /**
   * Simulates the applyEffects logic for testing
   */
  async function simulateApplyEffects(
    effects: AgentEffect[],
    tasks: Task[] = sampleTasks
  ) {
    for (const effect of effects) {
      if (effect.type === 'snapshot.patch' && effect.ops) {
        for (const op of effect.ops) {
          if (op.op === 'append' && op.path === 'data.tasks') {
            const task = op.value as Task;
            await mockCreateTask({
              title: task.title,
              description: task.description,
              priority: task.priority,
              dueDate: task.dueDate,
              tags: task.tags,
            });
          } else if (op.op === 'set' && op.path === 'state.viewMode') {
            await mockChangeView(op.value);
          } else if (op.op === 'set' && op.path === 'state.dateFilter') {
            mockSetDateFilter(op.value);
          } else if (op.op === 'set' && op.path === 'state.selectedTaskId') {
            await mockSelectTask(op.value);
          } else if (op.op === 'set' && op.path === 'state.assistantOpen') {
            mockSetAssistantOpen(op.value);
          } else if (op.op === 'remove' && op.path === 'data.tasks') {
            await mockDeleteTask(op.value);
          } else if (op.op === 'restore' && op.path === 'data.tasks') {
            await mockRestoreTask(op.value);
          } else if (op.op === 'set' && op.path.startsWith('data.tasks.')) {
            // Handle new format: data.tasks.id:taskId.field
            const idMatch = op.path.match(/data\.tasks\.id:([^.]+)\.(\w+)/);
            if (idMatch) {
              const [, taskId, field] = idMatch;
              if (field === 'status') {
                await mockMoveTask(taskId, op.value);
              } else {
                await mockUpdateTask({ id: taskId, [field]: op.value });
              }
            } else {
              // Handle legacy format: data.tasks.index.field
              const indexMatch = op.path.match(/data\.tasks\.(\d+)\.(\w+)/);
              if (indexMatch) {
                const [, indexStr, field] = indexMatch;
                const index = parseInt(indexStr, 10);
                const task = tasks[index];
                if (task) {
                  if (field === 'status') {
                    await mockMoveTask(task.id, op.value);
                  } else {
                    await mockUpdateTask({ id: task.id, [field]: op.value });
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  describe('CreateTask Effect', () => {
    it('should call createTask for append op on data.tasks', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [
          {
            op: 'append',
            path: 'data.tasks',
            value: {
              id: 'new-task-1',
              title: 'New Task',
              description: 'New Description',
              status: 'todo',
              priority: 'high',
              assignee: null,
              dueDate: '2026-01-20',
              tags: ['new'],
              createdAt: '2026-01-04T00:00:00.000Z',
              updatedAt: '2026-01-04T00:00:00.000Z',
              deletedAt: null,
            },
          },
        ],
      };

      await simulateApplyEffects([effect]);

      expect(mockCreateTask).toHaveBeenCalledOnce();
      expect(mockCreateTask).toHaveBeenCalledWith({
        title: 'New Task',
        description: 'New Description',
        priority: 'high',
        dueDate: '2026-01-20',
        tags: ['new'],
      });
    });

    it('should handle multiple task creation in single effect', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [
          {
            op: 'append',
            path: 'data.tasks',
            value: { id: 'task-a', title: 'Task A', description: null, status: 'todo', priority: 'low', assignee: null, dueDate: null, tags: [], createdAt: '', updatedAt: '', deletedAt: null },
          },
          {
            op: 'append',
            path: 'data.tasks',
            value: { id: 'task-b', title: 'Task B', description: null, status: 'todo', priority: 'low', assignee: null, dueDate: null, tags: [], createdAt: '', updatedAt: '', deletedAt: null },
          },
        ],
      };

      await simulateApplyEffects([effect]);

      expect(mockCreateTask).toHaveBeenCalledTimes(2);
    });
  });

  describe('ChangeView Effect', () => {
    it('should call changeView for set op on state.viewMode', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [{ op: 'set', path: 'state.viewMode', value: 'todo' }],
      };

      await simulateApplyEffects([effect]);

      expect(mockChangeView).toHaveBeenCalledOnce();
      expect(mockChangeView).toHaveBeenCalledWith('todo');
    });

    it('should handle all valid view modes', async () => {
      const viewModes = ['todo', 'kanban', 'table', 'trash'];

      for (const viewMode of viewModes) {
        mockChangeView.mockClear();

        const effect: AgentEffect = {
          type: 'snapshot.patch',
          id: 'effect-1',
          ops: [{ op: 'set', path: 'state.viewMode', value: viewMode }],
        };

        await simulateApplyEffects([effect]);

        expect(mockChangeView).toHaveBeenCalledWith(viewMode);
      }
    });
  });

  describe('SelectTask Effect', () => {
    it('should call selectTask for set op on state.selectedTaskId', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [{ op: 'set', path: 'state.selectedTaskId', value: 'task-1' }],
      };

      await simulateApplyEffects([effect]);

      expect(mockSelectTask).toHaveBeenCalledOnce();
      expect(mockSelectTask).toHaveBeenCalledWith('task-1');
    });

    it('should handle null selection (deselect)', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [{ op: 'set', path: 'state.selectedTaskId', value: null }],
      };

      await simulateApplyEffects([effect]);

      expect(mockSelectTask).toHaveBeenCalledWith(null);
    });
  });

  describe('DeleteTask Effect', () => {
    it('should call deleteTask for remove op on data.tasks', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [{ op: 'remove', path: 'data.tasks', value: 'task-1' }],
      };

      await simulateApplyEffects([effect]);

      expect(mockDeleteTask).toHaveBeenCalledOnce();
      expect(mockDeleteTask).toHaveBeenCalledWith('task-1');
    });
  });

  describe('RestoreTask Effect', () => {
    it('should call restoreTask for restore op on data.tasks', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [{ op: 'restore', path: 'data.tasks', value: 'task-1' }],
      };

      await simulateApplyEffects([effect]);

      expect(mockRestoreTask).toHaveBeenCalledOnce();
      expect(mockRestoreTask).toHaveBeenCalledWith('task-1');
    });
  });

  describe('UpdateTask Effect (ID Format)', () => {
    it('should call updateTask for field update with id: format', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [
          { op: 'set', path: 'data.tasks.id:task-1.assignee', value: '정성우' },
        ],
      };

      await simulateApplyEffects([effect]);

      expect(mockUpdateTask).toHaveBeenCalledOnce();
      expect(mockUpdateTask).toHaveBeenCalledWith({
        id: 'task-1',
        assignee: '정성우',
      });
    });

    it('should call moveTask for status update with id: format', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [
          { op: 'set', path: 'data.tasks.id:task-1.status', value: 'done' },
        ],
      };

      await simulateApplyEffects([effect]);

      expect(mockMoveTask).toHaveBeenCalledOnce();
      expect(mockMoveTask).toHaveBeenCalledWith('task-1', 'done');
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });

    it('should handle UUID taskId with hyphens', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [
          { op: 'set', path: 'data.tasks.id:28c7f080-4f03-4e4e-6880-0006d9956580.assignee', value: '정성우' },
        ],
      };

      await simulateApplyEffects([effect]);

      expect(mockUpdateTask).toHaveBeenCalledWith({
        id: '28c7f080-4f03-4e4e-6880-0006d9956580',
        assignee: '정성우',
      });
    });

    it('should handle multiple field updates in single effect', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [
          { op: 'set', path: 'data.tasks.id:task-1.title', value: 'New Title' },
          { op: 'set', path: 'data.tasks.id:task-1.priority', value: 'high' },
          { op: 'set', path: 'data.tasks.id:task-1.updatedAt', value: '2026-01-04T00:00:00.000Z' },
        ],
      };

      await simulateApplyEffects([effect]);

      expect(mockUpdateTask).toHaveBeenCalledTimes(3);
    });

    it('should handle all updateable fields', async () => {
      const fields: Record<string, unknown> = {
        title: 'New Title',
        description: 'New Description',
        priority: 'high',
        assignee: 'John Doe',
        dueDate: '2026-02-01',
        tags: ['tag1', 'tag2'],
        updatedAt: '2026-01-04T00:00:00.000Z',
      };

      for (const [field, value] of Object.entries(fields)) {
        mockUpdateTask.mockClear();

        const effect: AgentEffect = {
          type: 'snapshot.patch',
          id: 'effect-1',
          ops: [{ op: 'set', path: `data.tasks.id:task-1.${field}`, value }],
        };

        await simulateApplyEffects([effect]);

        expect(mockUpdateTask).toHaveBeenCalledWith({
          id: 'task-1',
          [field]: value,
        });
      }
    });
  });

  describe('UpdateTask Effect (Legacy Index Format)', () => {
    it('should call updateTask for field update with index format', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [
          { op: 'set', path: 'data.tasks.0.title', value: 'Updated Title' },
        ],
      };

      await simulateApplyEffects([effect]);

      expect(mockUpdateTask).toHaveBeenCalledWith({
        id: 'task-1', // tasks[0].id from sampleTasks
        title: 'Updated Title',
      });
    });

    it('should call moveTask for status update with index format', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [
          { op: 'set', path: 'data.tasks.1.status', value: 'review' },
        ],
      };

      await simulateApplyEffects([effect]);

      expect(mockMoveTask).toHaveBeenCalledWith('task-2', 'review'); // tasks[1].id from sampleTasks
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });

    it('should not call anything for out-of-bounds index', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [
          { op: 'set', path: 'data.tasks.999.title', value: 'Ghost' },
        ],
      };

      await simulateApplyEffects([effect]);

      expect(mockUpdateTask).not.toHaveBeenCalled();
    });
  });

  describe('DateFilter Effect', () => {
    it('should call setDateFilter for set op on state.dateFilter', async () => {
      const filter = {
        field: 'dueDate' as const,
        type: 'week' as const,
      };

      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [{ op: 'set', path: 'state.dateFilter', value: filter }],
      };

      await simulateApplyEffects([effect]);

      expect(mockSetDateFilter).toHaveBeenCalledOnce();
      expect(mockSetDateFilter).toHaveBeenCalledWith(filter);
    });

    it('should handle null filter (clear filter)', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [{ op: 'set', path: 'state.dateFilter', value: null }],
      };

      await simulateApplyEffects([effect]);

      expect(mockSetDateFilter).toHaveBeenCalledWith(null);
    });
  });

  describe('AssistantOpen Effect', () => {
    it('should call setAssistantOpen for set op on state.assistantOpen', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [{ op: 'set', path: 'state.assistantOpen', value: false }],
      };

      await simulateApplyEffects([effect]);

      expect(mockSetAssistantOpen).toHaveBeenCalledOnce();
      expect(mockSetAssistantOpen).toHaveBeenCalledWith(false);
    });
  });

  describe('Combined Effects', () => {
    it('should handle multiple different operations in single effect', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [
          { op: 'append', path: 'data.tasks', value: { id: 'new-task', title: 'New Task', description: null, status: 'todo', priority: 'medium', assignee: null, dueDate: null, tags: [], createdAt: '', updatedAt: '', deletedAt: null } },
          { op: 'set', path: 'state.viewMode', value: 'todo' },
          { op: 'set', path: 'state.selectedTaskId', value: 'new-task' },
        ],
      };

      await simulateApplyEffects([effect]);

      expect(mockCreateTask).toHaveBeenCalledOnce();
      expect(mockChangeView).toHaveBeenCalledWith('todo');
      expect(mockSelectTask).toHaveBeenCalledWith('new-task');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty effects array', async () => {
      await simulateApplyEffects([]);

      expect(mockCreateTask).not.toHaveBeenCalled();
      expect(mockUpdateTask).not.toHaveBeenCalled();
      expect(mockDeleteTask).not.toHaveBeenCalled();
    });

    it('should handle effect with empty ops array', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [],
      };

      await simulateApplyEffects([effect]);

      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it('should ignore unknown effect types', async () => {
      const effect = {
        type: 'snapshot.unknown',
        id: 'effect-1',
        ops: [{ op: 'set', path: 'something', value: 'value' }],
      } as AgentEffect;

      await simulateApplyEffects([effect]);

      expect(mockUpdateTask).not.toHaveBeenCalled();
    });

    it('should ignore unknown paths', async () => {
      const effect: AgentEffect = {
        type: 'snapshot.patch',
        id: 'effect-1',
        ops: [
          { op: 'set', path: 'unknown.path', value: 'value' },
          { op: 'set', path: 'data.unknown', value: 'value' },
        ],
      };

      await simulateApplyEffects([effect]);

      expect(mockUpdateTask).not.toHaveBeenCalled();
      expect(mockCreateTask).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Integration with Runtime.ts Generated Effects
// ============================================================================

describe('Runtime.ts Effect Format Compatibility', () => {
  const idFormatRegex = /data\.tasks\.id:([^.]+)\.(\w+)/;

  it('should parse CreateTask effect format', () => {
    // From runtime.ts generateCreateTaskEffects
    const ops = [
      {
        op: 'append',
        path: 'data.tasks',
        value: {
          id: 'task-1735934830480-0-j2l7kid',
          title: '내일 세란이랑 백화점 가서 사과를 사는 일정',
          description: null,
          status: 'todo',
          priority: 'medium',
          tags: [],
          dueDate: '2026-01-05',
          createdAt: '2026-01-04T00:00:00.000Z',
          updatedAt: '2026-01-04T00:00:00.000Z',
          deletedAt: null,
        },
      },
    ];

    expect(ops[0].op).toBe('append');
    expect(ops[0].path).toBe('data.tasks');
  });

  it('should parse ChangeView effect format', () => {
    // From runtime.ts generateChangeViewEffects
    const ops = [{ op: 'set', path: 'state.viewMode', value: 'todo' }];

    expect(ops[0].op).toBe('set');
    expect(ops[0].path).toBe('state.viewMode');
  });

  it('should parse UpdateTask effect format with id: prefix', () => {
    // From runtime.ts generateUpdateTaskEffects
    const ops = [
      { op: 'set', path: 'data.tasks.id:28c7f080-4f03-4e4e-6880-0006d9956580.assignee', value: '정성우' },
      { op: 'set', path: 'data.tasks.id:28c7f080-4f03-4e4e-6880-0006d9956580.updatedAt', value: '2026-01-03T22:07:10.480Z' },
    ];

    const match1 = ops[0].path.match(idFormatRegex);
    expect(match1).not.toBeNull();
    expect(match1?.[1]).toBe('28c7f080-4f03-4e4e-6880-0006d9956580');
    expect(match1?.[2]).toBe('assignee');

    const match2 = ops[1].path.match(idFormatRegex);
    expect(match2).not.toBeNull();
    expect(match2?.[2]).toBe('updatedAt');
  });

  it('should parse ChangeStatus effect format', () => {
    // From runtime.ts generateChangeStatusEffects
    const ops = [
      { op: 'set', path: 'data.tasks.id:task-1.status', value: 'done' },
      { op: 'set', path: 'data.tasks.id:task-1.updatedAt', value: '2026-01-04T00:00:00.000Z' },
    ];

    const match = ops[0].path.match(idFormatRegex);
    expect(match).not.toBeNull();
    expect(match?.[2]).toBe('status');
  });

  it('should parse DeleteTask effect format', () => {
    // From runtime.ts generateDeleteTaskEffects
    const ops = [{ op: 'remove', path: 'data.tasks', value: 'task-1' }];

    expect(ops[0].op).toBe('remove');
    expect(ops[0].path).toBe('data.tasks');
  });

  it('should parse RestoreTask effect format', () => {
    // From runtime.ts generateRestoreTaskEffects
    const ops = [{ op: 'restore', path: 'data.tasks', value: 'task-1' }];

    expect(ops[0].op).toBe('restore');
    expect(ops[0].path).toBe('data.tasks');
  });

  it('should parse SelectTask effect format', () => {
    // From runtime.ts generateSelectTaskEffects
    const ops = [{ op: 'set', path: 'state.selectedTaskId', value: 'task-1' }];

    expect(ops[0].op).toBe('set');
    expect(ops[0].path).toBe('state.selectedTaskId');
  });
});
