/**
 * Todo List Domain Definition
 *
 * Demonstrates basic Manifesto patterns:
 * - Array data management
 * - Derived computations (counts)
 * - Actions for state management
 */

import {
  defineDomain,
  z,
  type SemanticPath,
  type Expression,
  type Effect,
} from '@manifesto-ai/core';

// ============================================================================
// Type Definitions
// ============================================================================

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export type FilterType = 'all' | 'active' | 'completed';

export interface TodoData {
  todos: Todo[];
}

export interface TodoState {
  filter: FilterType;
  newTodoText: string;
}

// ============================================================================
// Schema Definitions
// ============================================================================

const todoSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
  createdAt: z.number(),
});

// ============================================================================
// Domain Definition
// ============================================================================

export const todoDomain = defineDomain<TodoData, TodoState>({
  id: 'todo-list',
  name: 'Todo List',
  description: 'A simple todo list domain',

  dataSchema: z.object({
    todos: z.array(todoSchema),
  }),

  stateSchema: z.object({
    filter: z.enum(['all', 'active', 'completed']),
    newTodoText: z.string(),
  }),

  initialState: {
    filter: 'all',
    newTodoText: '',
  },

  paths: {
    sources: {
      'data.todos': {
        schema: z.array(todoSchema),
        semantic: { type: 'collection', description: 'List of todo items' },
      },
      'state.filter': {
        schema: z.enum(['all', 'active', 'completed']),
        semantic: { type: 'filter', description: 'Current filter selection' },
      },
      'state.newTodoText': {
        schema: z.string(),
        semantic: { type: 'input', description: 'Text for new todo' },
      },
    },

    derived: {
      'derived.totalCount': {
        deps: ['data.todos'] as SemanticPath[],
        expr: ['length', ['get', 'data.todos']] as Expression,
        semantic: { type: 'count', description: 'Total number of todos' },
      },
      'derived.hasTodos': {
        deps: ['derived.totalCount'] as SemanticPath[],
        expr: ['>', ['get', 'derived.totalCount'], 0] as Expression,
        semantic: { type: 'status', description: 'Whether there are any todos' },
      },
      'derived.hasNewTodoText': {
        deps: ['state.newTodoText'] as SemanticPath[],
        expr: ['>', ['length', ['get', 'state.newTodoText']], 0] as Expression,
        semantic: { type: 'status', description: 'Whether new todo text is entered' },
      },
    },

    async: {},
  },

  actions: {
    setNewTodoText: {
      deps: [] as SemanticPath[],
      semantic: {
        type: 'action',
        description: 'Set the text for a new todo item',
        verb: 'set',
      },
      effect: {
        _tag: 'SetState',
        path: 'state.newTodoText',
        value: ['get', '$payload'] as Expression,
        description: 'Update new todo text',
      } as Effect,
    },
    setFilter: {
      deps: [] as SemanticPath[],
      semantic: {
        type: 'action',
        description: 'Set the current filter type',
        verb: 'set',
      },
      effect: {
        _tag: 'SetState',
        path: 'state.filter',
        value: ['get', '$payload'] as Expression,
        description: 'Update filter selection',
      } as Effect,
    },
    clearNewTodoText: {
      deps: [] as SemanticPath[],
      semantic: {
        type: 'action',
        description: 'Clear the new todo text input',
        verb: 'clear',
      },
      effect: {
        _tag: 'SetState',
        path: 'state.newTodoText',
        value: '',
        description: 'Clear new todo text',
      } as Effect,
    },
  },
});

// ============================================================================
// Initial Data
// ============================================================================

export function getInitialTodoData(): TodoData {
  return {
    todos: [
      { id: '1', text: 'Learn Manifesto Core', completed: true, createdAt: Date.now() - 86400000 },
      { id: '2', text: 'Build a Todo App', completed: false, createdAt: Date.now() - 3600000 },
      { id: '3', text: 'Explore Derived Paths', completed: false, createdAt: Date.now() },
    ],
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Filter todos based on filter type.
 * Note: Complex array operations should be done at the application level
 * since the Expression DSL focuses on simple computations.
 */
export function filterTodos(todos: Todo[], filter: FilterType): Todo[] {
  switch (filter) {
    case 'active':
      return todos.filter((t) => !t.completed);
    case 'completed':
      return todos.filter((t) => t.completed);
    default:
      return todos;
  }
}

/**
 * Count active todos
 */
export function countActiveTodos(todos: Todo[]): number {
  return todos.filter((t) => !t.completed).length;
}

/**
 * Count completed todos
 */
export function countCompletedTodos(todos: Todo[]): number {
  return todos.filter((t) => t.completed).length;
}
