/**
 * Todo Effect Handlers using @manifesto-ai/effect-utils
 *
 * Demonstrates:
 * - defineEffectSchema for type-safe handlers
 * - createHandler for validated effect handling
 * - Combinators (withRetry, withFallback) for resilience
 */

import { z } from "zod";
import {
  defineEffectSchema,
  createHandler,
  withRetry,
  withFallback,
  toPatch,
  type EffectHandler,
} from "@manifesto-ai/effect-utils";

// =============================================================================
// Types
// =============================================================================

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

// In-memory storage (simulates a database)
let todoStorage: Todo[] = [];

// =============================================================================
// Schemas
// =============================================================================

const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.number(),
});

const todosArraySchema = z.array(todoSchema);

// =============================================================================
// Effect: todo.load
// =============================================================================

const loadSchema = defineEffectSchema({
  type: "todo.load",
  input: z.object({
    into: z.string().optional(), // Path to store result (handled by MEL)
  }),
  output: todosArraySchema,
  outputPath: "todos",  // Path relative to snapshot.data
  description: "Load todos from storage",
});

const loadHandler = createHandler(loadSchema, async () => {
  console.log("[Effect] todo.load - Loading todos...");

  // Simulate API delay
  await new Promise((r) => setTimeout(r, 100));

  console.log(`[Effect] todo.load - Loaded ${todoStorage.length} todos`);
  return [...todoStorage];
});

// =============================================================================
// Effect: todo.add
// =============================================================================

const addSchema = defineEffectSchema({
  type: "todo.add",
  input: z.object({
    title: z.string().min(1),
    into: z.string().optional(),
  }),
  output: todosArraySchema,
  outputPath: "todos",  // Path relative to snapshot.data
  description: "Add a new todo",
});

const addHandler = createHandler(addSchema, async (input) => {
  console.log(`[Effect] todo.add - Adding todo: "${input.title}"`);

  const newTodo: Todo = {
    id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title,
    completed: false,
    createdAt: Date.now(),
  };

  todoStorage = [...todoStorage, newTodo];

  console.log(`[Effect] todo.add - Added todo with id: ${newTodo.id}`);
  return [...todoStorage];
});

// =============================================================================
// Effect: todo.toggle
// =============================================================================

const toggleSchema = defineEffectSchema({
  type: "todo.toggle",
  input: z.object({
    id: z.string(),
    todos: todosArraySchema,
    into: z.string().optional(),
  }),
  output: todosArraySchema,
  outputPath: "todos",  // Path relative to snapshot.data
  description: "Toggle todo completion status",
});

const toggleHandler = createHandler(toggleSchema, async (input) => {
  console.log(`[Effect] todo.toggle - Toggling todo: ${input.id}`);

  todoStorage = todoStorage.map((todo) =>
    todo.id === input.id ? { ...todo, completed: !todo.completed } : todo
  );

  const toggled = todoStorage.find((t) => t.id === input.id);
  console.log(`[Effect] todo.toggle - Todo ${input.id} is now ${toggled?.completed ? "completed" : "active"}`);

  return [...todoStorage];
});

// =============================================================================
// Effect: todo.remove
// =============================================================================

const removeSchema = defineEffectSchema({
  type: "todo.remove",
  input: z.object({
    id: z.string(),
    todos: todosArraySchema,
    into: z.string().optional(),
  }),
  output: todosArraySchema,
  outputPath: "todos",  // Path relative to snapshot.data
  description: "Remove a todo",
});

const removeHandler = createHandler(removeSchema, async (input) => {
  console.log(`[Effect] todo.remove - Removing todo: ${input.id}`);

  const before = todoStorage.length;
  todoStorage = todoStorage.filter((todo) => todo.id !== input.id);

  console.log(`[Effect] todo.remove - Removed ${before - todoStorage.length} todo(s)`);
  return [...todoStorage];
});

// =============================================================================
// Effect: todo.save (with retry + fallback)
// =============================================================================

const saveSchema = defineEffectSchema({
  type: "todo.save",
  input: z.object({
    todos: todosArraySchema,
  }),
  output: z.object({
    success: z.boolean(),
    savedAt: z.number(),
  }),
  outputPath: "saveResult",  // Path relative to snapshot.data
  description: "Save todos to storage",
});

// Simulate occasional failures
let saveAttempts = 0;

const saveHandler = createHandler(saveSchema, async (input) => {
  console.log(`[Effect] todo.save - Saving ${input.todos.length} todos...`);

  // Use withRetry for resilience
  const resilientSave = withFallback(
    withRetry(
      async () => {
        saveAttempts++;

        // Simulate occasional failure (fails first 2 attempts)
        if (saveAttempts <= 2 && Math.random() < 0.5) {
          throw new Error("Network timeout");
        }

        // Update storage
        todoStorage = [...input.todos];

        return {
          success: true,
          savedAt: Date.now(),
        };
      },
      { maxRetries: 3, baseDelay: 100, backoff: "exponential" }
    ),
    // Fallback: save locally anyway
    { success: true, savedAt: Date.now() }
  );

  const result = await resilientSave();
  console.log(`[Effect] todo.save - Save completed at ${new Date(result.savedAt).toISOString()}`);

  return result;
});

// =============================================================================
// Register all handlers
// =============================================================================

export function registerTodoHandlers(host: {
  registerEffect: (type: string, handler: EffectHandler) => void;
}) {
  console.log("[Handlers] Registering todo effect handlers...");

  host.registerEffect("todo.load", loadHandler);
  host.registerEffect("todo.add", addHandler);
  host.registerEffect("todo.toggle", toggleHandler);
  host.registerEffect("todo.remove", removeHandler);
  host.registerEffect("todo.save", saveHandler);

  console.log("[Handlers] Registered 5 effect handlers");
}

// Reset storage (for testing)
export function resetStorage() {
  todoStorage = [];
  saveAttempts = 0;
}

// Seed some initial todos (for demo)
export function seedTodos() {
  todoStorage = [
    { id: "todo-1", title: "Learn MEL syntax", completed: true, createdAt: Date.now() - 86400000 },
    { id: "todo-2", title: "Build effect handlers", completed: true, createdAt: Date.now() - 3600000 },
    { id: "todo-3", title: "Create example app", completed: false, createdAt: Date.now() },
  ];
}
