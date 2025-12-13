/**
 * Tasks Domain Definition
 *
 * Based on @manifesto-ai/core README.md documentation.
 * Any issues encountered will be documented in SPEC_ISSUES.md
 */

import {
  defineDomain,
  defineDerived,
  defineAction,
  setValue,
  setState,
  sequence,
  z,
} from '@manifesto-ai/core';

// Task schema
const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in-progress', 'review', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),  // Soft delete: ISO date string when deleted
});

export type Task = z.infer<typeof taskSchema>;

// Filter schema
const filterSchema = z.object({
  status: z.enum(['all', 'todo', 'in-progress', 'review', 'done']).optional(),
  priority: z.enum(['all', 'low', 'medium', 'high']).optional(),
  assignee: z.string().optional(),
});

export type TaskFilter = z.infer<typeof filterSchema>;

// Domain definition following README documentation
export const tasksDomain = defineDomain({
  id: 'tasks',
  name: 'Tasks',
  description: 'Task management domain with filtering and multi-view support',

  dataSchema: z.object({
    tasks: z.array(taskSchema),
    currentFilter: filterSchema,
  }),

  stateSchema: z.object({
    selectedTaskId: z.string().nullable(),
    viewMode: z.enum(['todo', 'kanban', 'table']),
    isCreating: z.boolean(),
    isEditing: z.boolean(),
  }),

  initialState: {
    selectedTaskId: null,
    viewMode: 'kanban' as const,
    isCreating: false,
    isEditing: false,
  },

  paths: {
    derived: {
      // Filtered tasks - filter by status if set
      // Using corrected 'case' format: ['case', [cond, val], [cond, val], default]
      filteredTasks: defineDerived({
        deps: ['data.tasks', 'data.currentFilter'],
        expr: ['case',
          [['any',
            ['==', ['get', 'data.currentFilter.status'], 'all'],
            ['==', ['get', 'data.currentFilter.status'], null]
          ], ['get', 'data.tasks']],
          ['filter', ['get', 'data.tasks'], ['==', '$.status', ['get', 'data.currentFilter.status']]]
        ],
        semantic: { type: 'list', description: 'Tasks filtered by current filter' }
      }),

      // Tasks by status
      todoTasks: defineDerived({
        deps: ['derived.filteredTasks'],
        expr: ['filter', ['get', 'derived.filteredTasks'], ['==', '$.status', 'todo']],
        semantic: { type: 'list', description: 'Tasks with todo status' }
      }),

      inProgressTasks: defineDerived({
        deps: ['derived.filteredTasks'],
        expr: ['filter', ['get', 'derived.filteredTasks'], ['==', '$.status', 'in-progress']],
        semantic: { type: 'list', description: 'Tasks with in-progress status' }
      }),

      reviewTasks: defineDerived({
        deps: ['derived.filteredTasks'],
        expr: ['filter', ['get', 'derived.filteredTasks'], ['==', '$.status', 'review']],
        semantic: { type: 'list', description: 'Tasks with review status' }
      }),

      doneTasks: defineDerived({
        deps: ['derived.filteredTasks'],
        expr: ['filter', ['get', 'derived.filteredTasks'], ['==', '$.status', 'done']],
        semantic: { type: 'list', description: 'Tasks with done status' }
      }),

      // Counts
      totalCount: defineDerived({
        deps: ['data.tasks'],
        expr: ['length', ['get', 'data.tasks']],
        semantic: { type: 'count', description: 'Total number of tasks' }
      }),

      todoCount: defineDerived({
        deps: ['derived.todoTasks'],
        expr: ['length', ['get', 'derived.todoTasks']],
        semantic: { type: 'count', description: 'Number of todo tasks' }
      }),

      inProgressCount: defineDerived({
        deps: ['derived.inProgressTasks'],
        expr: ['length', ['get', 'derived.inProgressTasks']],
        semantic: { type: 'count', description: 'Number of in-progress tasks' }
      }),

      reviewCount: defineDerived({
        deps: ['derived.reviewTasks'],
        expr: ['length', ['get', 'derived.reviewTasks']],
        semantic: { type: 'count', description: 'Number of review tasks' }
      }),

      doneCount: defineDerived({
        deps: ['derived.doneTasks'],
        expr: ['length', ['get', 'derived.doneTasks']],
        semantic: { type: 'count', description: 'Number of done tasks' }
      }),

      // Selected task - using filter + at(0) instead of find
      selectedTask: defineDerived({
        deps: ['data.tasks', 'state.selectedTaskId'],
        expr: ['at', ['filter', ['get', 'data.tasks'], ['==', '$.id', ['get', 'state.selectedTaskId']]], 0],
        semantic: { type: 'entity', description: 'Currently selected task' }
      }),

      // Boolean flags for action availability
      hasSelection: defineDerived({
        deps: ['state.selectedTaskId'],
        expr: ['!=', ['get', 'state.selectedTaskId'], null],
        semantic: { type: 'boolean', description: 'Whether a task is selected' }
      }),

      canCreate: defineDerived({
        deps: ['state.isCreating'],
        expr: ['!', ['get', 'state.isCreating']],
        semantic: { type: 'boolean', description: 'Whether can create a new task' }
      }),

      // canEdit - can edit if a task is selected and not currently editing
      canEdit: defineDerived({
        deps: ['derived.hasSelection', 'state.isEditing'],
        expr: ['all', ['get', 'derived.hasSelection'], ['!', ['get', 'state.isEditing']]],
        semantic: { type: 'boolean', description: 'Whether can edit selected task' }
      }),

      canDelete: defineDerived({
        deps: ['derived.hasSelection'],
        expr: ['get', 'derived.hasSelection'],
        semantic: { type: 'boolean', description: 'Whether can delete selected task' }
      }),
    },
  },

  actions: {
    // Create task - SIMPLIFIED due to object literal expression issues (SPEC Issue)
    // The Quick Start shows: ['concat', ['get', 'data.items'], [{ id: [...], ... }]]
    // But TypeScript rejects object literals inside expressions
    createTask: defineAction({
      deps: ['data.tasks', 'state.isCreating'],
      input: z.object({
        task: taskSchema,  // Accept full task object directly
      }),
      preconditions: [
        { path: 'derived.canCreate', expect: 'true', reason: 'Already creating a task' }
      ],
      effect: setValue('data.tasks', ['get', 'data.tasks'], 'Create new task (placeholder)'),
      semantic: {
        type: 'action',
        verb: 'create',
        description: 'Create a new task',
        risk: 'low',
      }
    }),

    // Update task - SIMPLIFIED due to 'if' operator not being supported (SPEC Issue)
    // README documents $if but types only have case/match/coalesce
    updateTask: defineAction({
      deps: ['data.tasks', 'state.selectedTaskId'],
      input: z.object({
        title: z.string().optional(),
        status: z.enum(['todo', 'in-progress', 'review', 'done']).optional(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
      }),
      preconditions: [
        { path: 'derived.hasSelection', expect: 'true', reason: 'No task selected' }
      ],
      effect: setValue('data.tasks', ['get', 'data.tasks'], 'Update task (placeholder)'),
      semantic: {
        type: 'action',
        verb: 'update',
        description: 'Update the selected task',
        risk: 'low',
      }
    }),

    // Delete task
    deleteTask: defineAction({
      deps: ['data.tasks', 'state.selectedTaskId'],
      preconditions: [
        { path: 'derived.canDelete', expect: 'true', reason: 'No task selected' }
      ],
      effect: sequence([
        setValue('data.tasks',
          ['filter', ['get', 'data.tasks'], ['!=', '$.id', ['get', 'state.selectedTaskId']]],
          'Remove task from list'
        ),
        setState('state.selectedTaskId', null, 'Clear selection'),
      ]),
      semantic: {
        type: 'action',
        verb: 'delete',
        description: 'Delete the selected task',
        risk: 'high',
        reversible: false,
      }
    }),

    // Move task - SIMPLIFIED due to 'if' operator not supported (SPEC Issue)
    moveTask: defineAction({
      deps: ['data.tasks'],
      input: z.object({
        taskId: z.string(),
        newStatus: z.enum(['todo', 'in-progress', 'review', 'done']),
      }),
      effect: setValue('data.tasks', ['get', 'data.tasks'], 'Move task (placeholder)'),
      semantic: {
        type: 'action',
        verb: 'move',
        description: 'Move task to different status column',
        risk: 'low',
      }
    }),

    // Select task
    selectTask: defineAction({
      deps: ['state.selectedTaskId'],
      input: z.object({
        taskId: z.string().nullable(),
      }),
      effect: setState('state.selectedTaskId', ['get', 'input.taskId'], 'Select task'),
      semantic: {
        type: 'action',
        verb: 'select',
        description: 'Select a task',
        risk: 'none',
      }
    }),

    // Change view mode
    changeView: defineAction({
      deps: ['state.viewMode'],
      input: z.object({
        viewMode: z.enum(['todo', 'kanban', 'table']),
      }),
      effect: setState('state.viewMode', ['get', 'input.viewMode'], 'Change view mode'),
      semantic: {
        type: 'action',
        verb: 'navigate',
        description: 'Switch view mode',
        risk: 'none',
      }
    }),

    // Set filter
    setFilter: defineAction({
      deps: ['data.currentFilter'],
      input: filterSchema,
      effect: setValue('data.currentFilter', ['get', 'input'], 'Update filter'),
      semantic: {
        type: 'action',
        verb: 'filter',
        description: 'Update task filter',
        risk: 'none',
      }
    }),

    // Clear filter - SIMPLIFIED due to empty object {} not being valid Expression (SPEC Issue)
    clearFilter: defineAction({
      deps: ['data.currentFilter'],
      effect: setValue('data.currentFilter', ['get', 'data.currentFilter'], 'Clear all filters (placeholder)'),
      semantic: {
        type: 'action',
        verb: 'clear',
        description: 'Clear all filters',
        risk: 'none',
      }
    }),
  },
});

export type TasksDomain = typeof tasksDomain;
