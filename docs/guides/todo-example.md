# Full-Stack Todo App Example

> **Purpose:** Complete working example demonstrating Manifesto layers
> **Prerequisites:** Understanding of Manifesto architecture basics

---

## What This Demonstrates

Complete integration of Manifesto layers for a deterministic, UI-driven application:

- **App** - Application orchestration and lifecycle management
- **Compiler** - MEL to DomainSchema compilation
- **Core** - Pure computation and flow execution
- **Host** - Effect execution and compute loop orchestration
- **World** - Governance (minimal, with auto-approve for this example)

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
                         │ app.subscribe(), app.act()
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         App                                      │
│  (createApp - handles wiring of all layers)                     │
│     ├─ getState() (state access)                                │
│     ├─ subscribe() (reactive subscriptions)                     │
│     └─ act() (action dispatchers)                               │
└────────────────────────┬────────────────────────────────────────┘
                         │ dispatch(Intent)
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
                    Back to App → React

Data flows in a loop:
  User action → App → World → Host → Core → New Snapshot → App → UI update
```

---

## Complete Implementation

### Domain Definition (MEL)

```mel
// src/todo.mel
domain TodoDomain {
  type TodoItem = {
    id: string,
    title: string,
    completed: boolean,
    createdAt: number
  }

  state {
    todos: Array<TodoItem> = []
    filter: "all" | "active" | "completed" = "all"
    editingId: string | null = null
  }

  computed activeCount = len(filter(todos, not($item.completed)))

  computed filteredTodos = cond(
    eq(filter, "active"),
    filter(todos, not($item.completed)),
    cond(
      eq(filter, "completed"),
      filter(todos, $item.completed),
      todos
    )
  )

  action add(id: string, title: string, createdAt: number) {
    onceIntent {
      patch todos = append(todos, {
        id: id,
        title: title,
        completed: false,
        createdAt: createdAt
      })
    }
  }

  action toggle(id: string) {
    onceIntent {
      patch todos = map(todos, cond(
        eq($item.id, id),
        merge($item, { completed: not($item.completed) }),
        $item
      ))
    }
  }

  action remove(id: string) {
    onceIntent {
      patch todos = filter(todos, neq($item.id, id))
    }
  }

  action setFilter(newFilter: "all" | "active" | "completed") {
    onceIntent {
      patch filter = newFilter
    }
  }
}
```

---

### Application Setup

```typescript
// src/manifesto-app.ts
import { createApp } from "@manifesto-ai/app";
import TodoMel from "./todo.mel";

export const app = createApp({ schema: TodoMel, effects: {} });
```

---

### React Hooks

```typescript
// src/hooks/useManifesto.ts
import { useCallback, useSyncExternalStore } from 'react';
import { app } from '../manifesto-app';

export function useSnapshot<T>(selector: (state: any) => T): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => app.subscribe(() => true, onStoreChange),
    []
  );

  const getSnapshot = useCallback(() => selector(app.getState()), [selector]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useAction(actionName: string) {
  return useCallback(
    (input?: Record<string, unknown>) => app.act(actionName, input),
    [actionName]
  );
}
```

---

### UI Component

```tsx
// src/App.tsx
import { useEffect, useState } from 'react';
import { useSnapshot, useAction } from './hooks/useManifesto';
import { app } from './manifesto-app';

type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
};

function TodoList() {
  // State access
  const filter = useSnapshot((s) => s.data.filter);

  // Computed values
  const activeCount = useSnapshot((s) => s.computed.activeCount) as number;
  const filteredTodos = useSnapshot((s) => s.computed.filteredTodos) as TodoItem[];

  // Actions
  const add = useAction('add');
  const toggle = useAction('toggle');
  const remove = useAction('remove');
  const setFilter = useAction('setFilter');

  const [newTitle, setNewTitle] = useState('');

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await add({
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      createdAt: Date.now(),
    }).done();
    setNewTitle('');
  };

  return (
    <div>
      <h1>Todos ({activeCount} active)</h1>

      {/* Add Form */}
      <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="What needs to be done?"
        />
        <button type="submit">Add</button>
      </form>

      {/* Filter Tabs */}
      <div>
        <button
          onClick={() => setFilter({ newFilter: 'all' })}
          disabled={filter === 'all'}
        >
          All
        </button>
        <button
          onClick={() => setFilter({ newFilter: 'active' })}
          disabled={filter === 'active'}
        >
          Active
        </button>
        <button
          onClick={() => setFilter({ newFilter: 'completed' })}
          disabled={filter === 'completed'}
        >
          Completed
        </button>
      </div>

      {/* Todo List */}
      <ul>
        {filteredTodos.map((todo) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggle({ id: todo.id })}
            />
            <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
              {todo.title}
            </span>
            <button onClick={() => remove({ id: todo.id })}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Root component with app initialization
export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    app.ready().then(() => setReady(true));
    return () => { app.dispose(); };
  }, []);

  if (!ready) return <div>Loading...</div>;

  return <TodoList />;
}
```

---

## Data Flow Example

**User clicks "Add Todo":**

```
1. React Event Handler
   add({ id: "123", title: "Buy milk", createdAt: 1234567890 })

2. App receives IntentBody
   { type: "add", input: { id: "123", title: "Buy milk", createdAt: 1234567890 } }

3. World creates Proposal
   Proposal { actor: "system-actor", intent: Intent { ... } }

4. Authority evaluates (auto-approve in this case)
   Decision: "approved"

5. Host dispatches to Core
   compute(schema, snapshot, intent, context)

6. Core evaluates Flow
   onceIntent { patch todos = append(...) }
   → Generates patches: [{ op: "set", path: "data.todos", value: [...] }]

7. Host applies patches
   apply(schema, snapshot, patches, context)
   → New Snapshot with updated todos array

8. World creates new World state
   WorldId: hash(schemaHash:snapshotHash)

9. App receives Snapshot update
   Notifies all subscribers

10. React re-renders
    useSnapshot((s) => s.computed.filteredTodos) returns new array → UI updates
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
npm install @manifesto-ai/app @manifesto-ai/compiler react react-dom
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
import { melPlugin } from '@manifesto-ai/compiler/vite';

export default defineConfig({
  plugins: [react(), melPlugin()],
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
| **Re-entry unsafe flows** | `patch count = add(count, 1)` without guard runs every compute cycle | Use `onceIntent { ... }` to guard patches |
| **Direct state mutation** | `snapshot.data.todos.push(newTodo)` bypasses Core, breaks determinism | Always use actions: `add({ ... })` |
| **Effect handler throws** | `async function handler() { throw new Error() }` crashes app | Return patches for errors: `return [{ op: "set", path: "data.error", value: error.message }]` |
| **Snapshot isolation** | Passing `snapshot.data` to external code that mutates it | Clone before passing out: `JSON.parse(JSON.stringify(snapshot.data))` |

---

## Extending the Example

### Add Server Sync

```mel
// Add to todo.mel
action sync() {
  onceIntent when eq(syncStatus, "idle") {
    patch syncStatus = "syncing"
    effect "api:sync" { todos: todos }
  }
}
```

```typescript
// Effect handler registered via createApp config
// In your manifesto-app.ts:
import { createApp } from "@manifesto-ai/app";
import TodoMel from "./todo.mel";

export const app = createApp({
  schema: TodoMel,
  effects: {
    'api:sync': async (params, ctx) => {
      try {
        await fetch('/api/todos', {
          method: 'POST',
          body: JSON.stringify(params.todos)
        });

        return [
          { op: 'set', path: 'data.syncStatus', value: 'synced' },
          { op: 'set', path: 'data.lastSyncedAt', value: Date.now() }
        ];
      } catch (error) {
        return [
          { op: 'set', path: 'data.syncStatus', value: 'error' },
          { op: 'set', path: 'data.syncError', value: error.message }
        ];
      }
    },
  },
});
```

---

## Related Guides

- [Getting Started](/quickstart) - Beginner walkthrough
- [Re-entry Safe Flows](./reentry-safe-flows) - Avoiding re-entry pitfalls
- [Effect Handlers](./effect-handlers) - Writing effect handlers
- [React Integration](./react-integration) - React hooks and patterns

---

## See Also

- [Architecture Overview](/architecture/) - Layer responsibilities
- [Core Concepts](/concepts/) - Understanding the mental model
