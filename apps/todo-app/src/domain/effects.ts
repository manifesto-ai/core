/**
 * Todo Effects - v2.3.0 Effects-first API
 *
 * Effects handle external side-effects (localStorage in this case).
 * Each effect returns Patch[] to update state.
 */

import type { Patch } from "@manifesto-ai/core";
import type { Effects } from "@manifesto-ai/app";

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
// Storage Helpers
// =============================================================================

function loadFromStorage(): Todo[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : getInitialTodos();
  } catch {
    return getInitialTodos();
  }
}

function saveToStorage(todos: Todo[]): void {
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
let cache: Todo[] = loadFromStorage();

// =============================================================================
// Effects (v2.3.0 API)
// =============================================================================

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const todoEffects: Effects = {
  /**
   * Load todos from localStorage
   */
  "todo.load": async (): Promise<readonly Patch[]> => {
    await delay(200); // Simulate API latency
    cache = loadFromStorage();
    return [{ op: "set", path: "todos", value: cache }];
  },

  /**
   * Add a new todo
   */
  "todo.add": async (params): Promise<readonly Patch[]> => {
    const title = ((params as { title?: string }).title ?? "").trim();
    if (!title) return [];

    const todo: Todo = {
      id: generateId(),
      title,
      completed: false,
      createdAt: Date.now(),
    };

    cache = [...cache, todo];
    saveToStorage(cache);
    return [{ op: "set", path: "todos", value: cache }];
  },

  /**
   * Toggle todo completion
   */
  "todo.toggle": async (params): Promise<readonly Patch[]> => {
    const id = (params as { id?: string }).id;
    if (!id) return [];

    cache = cache.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    saveToStorage(cache);
    return [{ op: "set", path: "todos", value: cache }];
  },

  /**
   * Remove a todo
   */
  "todo.remove": async (params): Promise<readonly Patch[]> => {
    const id = (params as { id?: string }).id;
    if (!id) return [];

    cache = cache.filter((t) => t.id !== id);
    saveToStorage(cache);
    return [{ op: "set", path: "todos", value: cache }];
  },

  /**
   * Save all todos
   */
  "todo.save": async (params): Promise<readonly Patch[]> => {
    const todos = (params as { todos?: Todo[] }).todos;
    if (todos) {
      cache = todos;
      saveToStorage(cache);
    }
    return [{ op: "set", path: "saveResult", value: { success: true, savedAt: Date.now() } }];
  },
};

// =============================================================================
// Utilities
// =============================================================================

export function resetStorage(): void {
  cache = getInitialTodos();
  saveToStorage(cache);
}
