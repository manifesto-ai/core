# Getting Started

> Build your first Manifesto app in 10 minutes

This guide walks you through creating a simple Todo application using `@manifesto-ai/app`. You'll learn the core patterns that apply to any Manifesto application.

---

## Prerequisites

- Node.js 18+ or Bun
- Basic TypeScript knowledge
- A package manager (npm, pnpm, or bun)

---

## Installation

```bash
# Using npm
npm install @manifesto-ai/app @manifesto-ai/compiler

# Using pnpm
pnpm add @manifesto-ai/app @manifesto-ai/compiler

# Using bun
bun add @manifesto-ai/app @manifesto-ai/compiler
```

---

## Step 1: Define Your Domain (MEL)

Create a file called `todo.mel` that defines your application's state and actions:

```mel
domain TodoApp {
  // State schema
  state {
    todos: Array<{
      id: string,
      title: string,
      completed: boolean
    }> = []
    filter: string = "all"
  }

  // Computed values (derived from state)
  computed activeCount = len(filter(todos, fn(t) => not(t.completed)))
  computed completedCount = len(filter(todos, fn(t) => t.completed))

  // Actions
  action addTodo(title: string) {
    once(addTodoIntent) {
      patch addTodoIntent = $meta.intentId
      patch todos = append(todos, {
        id: $system.uuid,
        title: title,
        completed: false
      })
    }
  }

  action toggleTodo(id: string) {
    once(toggleTodoIntent) {
      patch toggleTodoIntent = $meta.intentId
      patch todos = map(todos, fn(t) =>
        cond(eq(t.id, id),
          merge(t, { completed: not(t.completed) }),
          t
        )
      )
    }
  }

  action removeTodo(id: string) {
    once(removeTodoIntent) {
      patch removeTodoIntent = $meta.intentId
      patch todos = filter(todos, fn(t) => neq(t.id, id))
    }
  }

  action setFilter(newFilter: string) {
    once(setFilterIntent) {
      patch setFilterIntent = $meta.intentId
      patch filter = newFilter
    }
  }
}
```

**Key concepts:**

| Element | Description |
|---------|-------------|
| `state` | The shape of your application data |
| `computed` | Derived values (auto-recalculated) |
| `action` | Named operations that modify state |
| `once(guard)` | Re-entry safety — ensures the action body runs only once |
| `patch` | Declarative state modification |
| `$system.uuid` | System-provided unique identifier |
| `$meta.intentId` | Unique ID for this action invocation |

---

## Step 2: Create the App

Create your main application file:

```typescript
// app.ts
import { createApp } from "@manifesto-ai/app";
import TodoMel from "./todo.mel";

// Create the app instance
export const todoApp = createApp(TodoMel);
```

That's it! The app is created but not yet initialized.

---

## Step 3: Initialize and Use

```typescript
// main.ts
import { todoApp } from "./app";

async function main() {
  // Initialize the app
  await todoApp.ready();
  console.log("App is ready!");

  // Execute an action
  const handle = todoApp.act("addTodo", { title: "Learn Manifesto" });

  // Wait for completion
  await handle.done();
  console.log("Todo added!");

  // Read current state
  const state = todoApp.getState();
  console.log("Todos:", state.data.todos);
  // → Todos: [{ id: "...", title: "Learn Manifesto", completed: false }]

  // Subscribe to changes
  const unsubscribe = todoApp.subscribe(
    (state) => state.data.todos.length,
    (count) => console.log(`Todo count: ${count}`)
  );

  // Add another todo
  await todoApp.act("addTodo", { title: "Build something" }).done();
  // → Todo count: 2

  // Cleanup
  unsubscribe();
  await todoApp.dispose();
}

main().catch(console.error);
```

---

## Step 4: Add Services (Side Effects)

Most applications need to interact with external systems. Define **services** to handle side effects:

```typescript
// app.ts
import { createApp, type ServiceMap } from "@manifesto-ai/app";
import TodoMel from "./todo.mel";

// Define service handlers
const services: ServiceMap = {
  // Handler for 'api.loadTodos' effect
  "api.loadTodos": async (params, ctx) => {
    const response = await fetch("/api/todos");
    const todos = await response.json();

    // Return patches to apply
    return [
      ctx.patch.set("todos", todos),
      ctx.patch.set("status", "idle"),
    ];
  },

  // Handler for 'api.saveTodo' effect
  "api.saveTodo": async (params, ctx) => {
    await fetch("/api/todos", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return []; // No patches needed
  },
};

export const todoApp = createApp(TodoMel, { services });
```

Then trigger effects from your MEL domain:

```mel
action loadTodos() {
  once(loadTodosIntent) {
    patch loadTodosIntent = $meta.intentId
    patch status = "loading"
    effect api.loadTodos({})
  }
}

action addTodo(title: string) {
  once(addTodoIntent) {
    patch addTodoIntent = $meta.intentId
    let newTodo = {
      id: $system.uuid,
      title: title,
      completed: false
    }
    patch todos = append(todos, newTodo)
    effect api.saveTodo(newTodo)
  }
}
```

---

## Step 5: React Integration

For React applications, use the subscribe pattern with hooks:

```tsx
// TodoApp.tsx
import { useEffect, useState, useCallback } from "react";
import { todoApp } from "./app";
import type { AppState } from "@manifesto-ai/app";

interface TodoData {
  todos: Array<{ id: string; title: string; completed: boolean }>;
  filter: string;
}

export function TodoApp() {
  const [state, setState] = useState<AppState<TodoData> | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize app and subscribe
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      await todoApp.ready();
      setIsReady(true);
      setState(todoApp.getState<TodoData>());

      // Subscribe to all state changes
      unsubscribe = todoApp.subscribe(
        (s) => s,
        (s) => setState(s as AppState<TodoData>),
        { batchMode: "immediate" }
      );
    };

    init().catch(console.error);
    return () => unsubscribe?.();
  }, []);

  // Action handlers
  const handleAdd = useCallback(
    (title: string) => todoApp.act("addTodo", { title }).done(),
    []
  );

  const handleToggle = useCallback(
    (id: string) => todoApp.act("toggleTodo", { id }).done(),
    []
  );

  if (!isReady || !state) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Todo App</h1>
      <input
        type="text"
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.currentTarget.value) {
            handleAdd(e.currentTarget.value);
            e.currentTarget.value = "";
          }
        }}
        placeholder="Add todo..."
      />
      <ul>
        {state.data.todos.map((todo) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggle(todo.id)}
            />
            <span style={{ textDecoration: todo.completed ? "line-through" : "none" }}>
              {todo.title}
            </span>
          </li>
        ))}
      </ul>
      <p>Active: {state.computed.activeCount as number}</p>
    </div>
  );
}
```

---

## Understanding the Flow

Here's what happens when you call `app.act("addTodo", { title: "..." })`:

```
1. act() creates an ActionHandle
   ↓
2. Intent is submitted to World Protocol
   ↓
3. Authority evaluates (usually auto-approved)
   ↓
4. Host executes the action:
   a. Core computes the Flow
   b. Patches are generated
   c. Effects are declared (if any)
   ↓
5. Effects are executed by Services
   ↓
6. Service patches are applied
   ↓
7. New World is created (immutable)
   ↓
8. Subscribers are notified
   ↓
9. ActionHandle resolves
```

---

## Common Patterns

### Pattern 1: Loading States

```mel
state {
  status: string = "idle"
  data: Json | null = null
  error: string | null = null
}

action fetchData() {
  once(fetchIntent) {
    patch fetchIntent = $meta.intentId
    patch status = "loading"
    patch error = null
    effect api.fetchData({})
  }
}
```

```typescript
// Service handles success/error
"api.fetchData": async (params, ctx) => {
  try {
    const data = await fetch("/api/data").then((r) => r.json());
    return [
      ctx.patch.set("data", data),
      ctx.patch.set("status", "idle"),
    ];
  } catch (error) {
    return [
      ctx.patch.set("error", error.message),
      ctx.patch.set("status", "error"),
    ];
  }
};
```

### Pattern 2: Optimistic Updates

```mel
action toggleTodo(id: string) {
  once(toggleIntent) {
    patch toggleIntent = $meta.intentId
    // Optimistic update first
    patch todos = map(todos, fn(t) =>
      cond(eq(t.id, id),
        merge(t, { completed: not(t.completed) }),
        t
      )
    )
    // Then sync with server
    effect api.updateTodo({ id: id, completed: not(get(todos, id).completed) })
  }
}
```

### Pattern 3: Action Sequencing

```typescript
async function createAndLoad() {
  // Wait for first action to complete
  await app.act("createItem", { name: "New" }).done();

  // Then execute the next
  await app.act("loadItems").done();
}
```

---

## What's Next?

| Topic | Description |
|-------|-------------|
| [API Reference](./api-reference) | Complete API documentation |
| [Services](./services) | Deep dive into service handlers |
| [Subscriptions](./subscriptions) | Advanced subscription patterns |
| [Actions](./actions) | Action lifecycle and error handling |
| [Examples](./examples) | Full application examples |

---

## Troubleshooting

### "App is not ready"

Always call `await app.ready()` before using other methods:

```typescript
const app = createApp(mel);
await app.ready(); // Required!
app.act("myAction");
```

### "Unknown effect type: xxx"

Register a service handler for the effect type:

```typescript
const app = createApp(mel, {
  services: {
    "xxx": async (params, ctx) => {
      // Handle the effect
      return [];
    },
  },
});
```

### Action never completes

Check if your MEL action has proper re-entry guards:

```mel
// WRONG: No guard, never "completes"
action doSomething() {
  patch count = add(count, 1)
}

// RIGHT: Guarded, runs once
action doSomething() {
  once(doSomethingIntent) {
    patch doSomethingIntent = $meta.intentId
    patch count = add(count, 1)
  }
}
```
