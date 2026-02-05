/**
 * Todo Services - Browser-adapted handlers using localStorage
 */

import type { Patch } from "@manifesto-ai/core";
import type { ManifestoHost } from "@manifesto-ai/host";

// =============================================================================
// Types
// =============================================================================

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

const STORAGE_KEY = "manifesto-todos";

// =============================================================================
// Storage
// =============================================================================

function load(): Todo[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : getInitialTodos();
  } catch {
    return getInitialTodos();
  }
}

function save(todos: Todo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // Ignore storage errors
  }
}

function getInitialTodos(): Todo[] {
  return [
    { id: "todo-1", title: "Learn MEL syntax", completed: true, createdAt: Date.now() - 86400000 },
    { id: "todo-2", title: "Build effect handlers", completed: true, createdAt: Date.now() - 3600000 },
    { id: "todo-3", title: "Create React app with Manifesto", completed: false, createdAt: Date.now() },
  ];
}

function generateId(): string {
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// In-memory cache
let cache: Todo[] = load();

// =============================================================================
// Handlers
// =============================================================================

const loadTodos = async (): Promise<Patch[]> => {
  await delay(200); // Simulate API
  cache = load();
  return [{ op: "set", path: "todos", value: cache }];
};

const addTodo = async (params: Record<string, unknown>): Promise<Patch[]> => {
  const title = (params.title as string).trim();
  const todo: Todo = { id: generateId(), title, completed: false, createdAt: Date.now() };
  cache = [...cache, todo];
  save(cache);
  return [{ op: "set", path: "todos", value: cache }];
};

const toggleTodo = async (params: Record<string, unknown>): Promise<Patch[]> => {
  const id = params.id as string;
  cache = cache.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
  save(cache);
  return [{ op: "set", path: "todos", value: cache }];
};

const removeTodo = async (params: Record<string, unknown>): Promise<Patch[]> => {
  const id = params.id as string;
  cache = cache.filter((t) => t.id !== id);
  save(cache);
  return [{ op: "set", path: "todos", value: cache }];
};

const saveTodos = async (params: Record<string, unknown>): Promise<Patch[]> => {
  const todos = params.todos as Todo[] | undefined;
  if (todos) {
    cache = todos;
    save(cache);
  }
  return [{ op: "set", path: "saveResult", value: { success: true, savedAt: Date.now() } }];
};

// =============================================================================
// Exports
// =============================================================================

/**
 * Register effect handlers on the Host (v2 API)
 */
export function registerTodoEffects(host: ManifestoHost): void {
  const register = (type: string, handler: (params: Record<string, unknown>) => Promise<Patch[]>) => {
    host.registerEffect(type, async (_type, params) => handler(params as Record<string, unknown>));
  };

  register("todo.load", loadTodos);
  register("todo.add", addTodo);
  register("todo.toggle", toggleTodo);
  register("todo.remove", removeTodo);
  register("todo.save", saveTodos);
}

export function resetStorage(): void {
  cache = getInitialTodos();
  save(cache);
}

// =============================================================================
// Helpers
// =============================================================================

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
