# Full-Stack Todo App Example

> **Extracted from:** docs-original/INTEGRATION_PATTERNS.md (Pattern 1)
> **Purpose:** Complete working example demonstrating all Manifesto layers
> **Prerequisites:** Understanding of Manifesto architecture basics

---

## What This Demonstrates

Complete integration of all Manifesto layers for a deterministic, UI-driven application:

- **Builder** - Type-safe domain definition with Zod
- **Core** - Pure computation and flow execution
- **Host** - Effect execution and compute loop orchestration
- **World** - Governance (minimal, with auto-approve for this example)
- **Bridge** - Two-way binding between intents and UI events
- **React** - Presentation and user interaction

---

## When to Use This Pattern

Use this full-stack pattern when building interactive applications where users directly manipulate domain state through a UI.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         React UI                                │
│  (TodoApp.tsx - presentation, event capture)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │ useValue, useActions, useComputed
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    createManifestoApp                           │
│  (Zero-config factory - handles wiring)                         │
│     ├─ Provider (React Context)                                 │
│     ├─ useValue (state selectors)                               │
│     ├─ useComputed (derived values)                             │
│     └─ useActions (intent dispatchers)                          │
└────────────────────────┬────────────────────────────────────────┘
                         │ dispatch(IntentBody)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Bridge                                   │
│  (Two-way binding: events ↔ intents, snapshot ↔ subscribers)   │
└────────────────────────┬────────────────────────────────────────┘
                         │ submitProposal(actor, intent)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         World                                    │
│  (Governance: actor registry, authority, lineage)               │
└────────────────────────┬────────────────────────────────────────┘
                         │ dispatch(intent) via Host
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Host                                     │
│  (Orchestration: compute loop, effect execution, patch apply)   │
└────────────────────────┬────────────────────────────────────────┘
                         │ compute(schema, snapshot, intent, context)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Core                                     │
│  (Pure computation: expression eval, flow execution, patches)   │
└────────────────────────┬────────────────────────────────────────┘
                         │ New Snapshot
                         ▼
                    Back to Bridge → React

Data flows in a loop:
  User action → Bridge → World → Host → Core → New Snapshot → Bridge → UI update
```

---

## Complete Implementation

### Layer 1: Domain Definition (Builder)

```typescript
// src/domain/todo-domain.ts
import { z } from "zod";
import { defineDomain } from "@manifesto-ai/builder";

// ============ State Schema ============

const TodoItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.number(),
});

const TodoStateSchema = z.object({
  todos: z.array(TodoItemSchema),
  filter: z.enum(["all", "active", "completed"]),
  editingId: z.string().nullable(),
});

export type TodoState = z.infer<typeof TodoStateSchema>;
export type TodoItem = z.infer<typeof TodoItemSchema>;

// ============ Domain Definition ============

export const TodoDomain = defineDomain(
  TodoStateSchema,
  ({ state, computed, actions, expr, flow }) => {
    // Helper to convert ItemProxy property to Expr
    const itemField = <T>(proxy: unknown) =>
      expr.get(proxy as any);

    // ============ Computed Values ============

    const { activeCount } = computed.define({
      activeCount: expr.len(
        expr.filter(state.todos, (item) =>
          expr.not(itemField(item.completed))
        )
      ),
    });

    const { filteredTodos } = computed.define({
      filteredTodos: expr.cond(
        expr.eq(state.filter, "active"),
        expr.filter(state.todos, (item) =>
          expr.not(itemField(item.completed))
        ),
        expr.cond(
          expr.eq(state.filter, "completed"),
          expr.filter(state.todos, (item) =>
            itemField(item.completed)
          ),
          state.todos
        )
      ),
    });

    // ============ Actions ============

    const { add } = actions.define({
      add: {
        input: z.object({
          id: z.string(),
          title: z.string(),
          createdAt: z.number(),
        }),
        flow: flow.patch(state.todos).set(
          expr.append(state.todos, expr.object({
            id: expr.input("id"),
            title: expr.input("title"),
            completed: expr.lit(false),
            createdAt: expr.input("createdAt"),
          }))
        ),
      },
    });

    const { toggle } = actions.define({
      toggle: {
        input: z.object({ id: z.string() }),
        flow: flow.patch(state.todos).set(
          expr.map(state.todos, (item) =>
            expr.cond(
              expr.eq(itemField(item.id), expr.input("id")),
              expr.merge(
                itemField(item),
                expr.object({ completed: expr.not(itemField(item.completed)) })
              ),
              itemField(item)
            )
          )
        ),
      },
    });

    const { remove } = actions.define({
      remove: {
        input: z.object({ id: z.string() }),
        flow: flow.patch(state.todos).set(
          expr.filter(state.todos, (item) =>
            expr.neq(itemField(item.id), expr.input("id"))
          )
        ),
      },
    });

    return {
      computed: { activeCount, filteredTodos },
      actions: { add, toggle, remove },
    };
  },
  { id: "todo-domain", version: "1.0.0" }
);

export const initialState: TodoState = {
  todos: [],
  filter: "all",
  editingId: null,
};
```

---

### Layer 2-6: Application Wiring (createManifestoApp)

`createManifestoApp` internally creates and wires:
- **Host** (effect execution, compute loop)
- **World** (actor registry, authority, proposals)
- **Bridge** (event routing, snapshot subscriptions)
- **React Context** (Provider, hooks)

```typescript
// src/App.tsx
import { createManifestoApp } from "@manifesto-ai/react";
import { TodoDomain, initialState } from "./domain/todo-domain";

// Single line creates entire infrastructure
const Todo = createManifestoApp(TodoDomain, { initialState });

// Export Provider for root
export const TodoProvider = Todo.Provider;

// UI Component
function TodoList() {
  // Type-safe state access
  const todos = Todo.useValue((s) => s.todos);
  const filter = Todo.useValue((s) => s.filter);

  // Computed values
  const activeCount = Todo.useComputed((c) => c.activeCount) as number;
  const filteredTodos = Todo.useComputed((c) => c.filteredTodos) as TodoItem[];

  // Actions
  const { add, toggle, remove } = Todo.useActions();

  const handleAdd = () => {
    add({
      id: crypto.randomUUID(),
      title: "New todo",
      createdAt: Date.now(),
    });
  };

  return (
    <div>
      <h1>Todos ({activeCount} active)</h1>
      <button onClick={handleAdd}>Add Todo</button>
      <ul>
        {filteredTodos.map((todo) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggle({ id: todo.id })}
            />
            <span>{todo.title}</span>
            <button onClick={() => remove({ id: todo.id })}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Root component
export function App() {
  return (
    <Todo.Provider>
      <TodoList />
    </Todo.Provider>
  );
}
```

---

## Data Flow Example

**User clicks "Add Todo":**

```
1. React Event Handler
   add({ id: "123", title: "Buy milk", createdAt: 1234567890 })

2. Bridge receives IntentBody
   { type: "add", input: { id: "123", title: "Buy milk", createdAt: 1234567890 } }

3. World creates Proposal
   Proposal { actor: "system-actor", intent: Intent { ... } }

4. Authority evaluates (auto-approve in this case)
   Decision: "approved"

5. Host dispatches to Core
   compute(schema, snapshot, intent, context)

6. Core evaluates Flow
   flow.patch(state.todos).set(expr.append(...))
   → Generates patches: [{ op: "set", path: "todos", value: [...] }]

7. Host applies patches
   apply(schema, snapshot, patches, context)
   → New Snapshot with updated todos array

8. World creates new World
   WorldId: hash(schemaHash:snapshotHash)

9. Bridge receives Snapshot update
   Notifies all subscribers

10. React re-renders
    useValue((s) => s.todos) returns new array → UI updates
```

---

## Setup Instructions

### 1. Create Project

```bash
mkdir manifesto-todo-app
cd manifesto-todo-app
npm init -y
```

### 2. Install Dependencies

```bash
npm install @manifesto-ai/builder @manifesto-ai/core @manifesto-ai/host @manifesto-ai/world @manifesto-ai/bridge @manifesto-ai/react zod react react-dom
npm install -D typescript @types/react @types/react-dom vite @vitejs/plugin-react
```

### 3. Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### 4. Configure Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

### 5. Create Entry Point

```typescript
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Manifesto Todo App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 6. Run Development Server

```bash
npx vite
```

---

## Common Pitfalls

| Pitfall | Why It Fails | Solution |
|---------|--------------|----------|
| **Re-entry unsafe flows** | `flow.patch(state.count).set(expr.add(state.count, 1))` runs every compute cycle, incrementing forever | Use `flow.onceNull` to guard: `flow.onceNull(state.submittedAt, ({ patch }) => patch(...))` |
| **Direct state mutation** | `snapshot.data.todos.push(newTodo)` bypasses Core, breaks determinism | Always use actions: `add({ ... })` |
| **Effect handler throws** | `async function handler() { throw new Error() }` crashes app | Return patches for errors: `return [{ op: "set", path: "error", value: error.message }]` |
| **Snapshot isolation** | Passing `snapshot.data` to external code that mutates it | Clone before passing out: `JSON.parse(JSON.stringify(snapshot.data))` |

---

## Extending the Example

### Add Persistence

```typescript
// src/App.tsx
const Todo = createManifestoApp(TodoDomain, {
  initialState,
  persistence: {
    key: 'manifesto-todos',
    storage: localStorage,
    serialize: JSON.stringify,
    deserialize: JSON.parse,
  }
});
```

### Add Server Sync

```typescript
// In domain definition
const { sync } = actions.define({
  sync: {
    flow: flow.seq(
      // Mark as syncing
      flow.patch(state.syncStatus).set(expr.lit('syncing')),

      // Call API
      flow.effect('api:sync', {
        todos: state.todos
      }),

      // Mark as synced (set by effect handler)
      // Effect handler will set syncStatus based on result
    )
  }
});

// Register effect handler
host.registerEffect('api:sync', async (type, params, context) => {
  try {
    await fetch('/api/todos', {
      method: 'POST',
      body: JSON.stringify(params.todos)
    });

    return [
      { op: 'set', path: 'syncStatus', value: 'synced' },
      { op: 'set', path: 'lastSyncedAt', value: context.requirement.createdAt }
    ];
  } catch (error) {
    return [
      { op: 'set', path: 'syncStatus', value: 'error' },
      { op: 'set', path: 'syncError', value: error.message }
    ];
  }
});
```

---

## Related Guides

- [Getting Started](./getting-started.md) - Beginner walkthrough
- [Re-entry Safe Flows](./reentry-safe-flows.md) - Avoiding re-entry pitfalls
- [Effect Handlers](./effect-handlers.md) - Writing effect handlers

---

## See Also

- [Architecture Overview](/architecture/) - Layer responsibilities
- [Getting Started](/guides/getting-started) - Domain definition patterns
- [Core Concepts](/core-concepts/) - Understanding the mental model
