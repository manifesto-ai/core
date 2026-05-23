# React Integration

> Keep React focused on rendering app state. Activate the runtime once per app mount, then expose typed action helpers from a hook.

---

## What You Build

- one activated SDK runtime held in a ref
- one React state value seeded from `snapshot()`
- one `observe.state(...)` subscription that keeps React in sync with published snapshots
- explicit action helpers such as `addTodo(title)` instead of `act("addTodo", input)`

This page stays SDK-first. If your app later needs approval or history, compose
those layers before activation and keep the React layer on snapshot reads and
action helpers.

---

## Prerequisites

- You finished the [Tutorial](/tutorial/)
- You know basic React hooks
- You can import `.mel` files through your bundler
- Your Vite setup emits `src/domain/todo.domain.ts` as shown in [Bundler Setup](/guides/bundler-setup)

The runtime pattern below also works in plain JavaScript. The TypeScript
snippets use the generated domain facade so React props stay aligned with the
same `.mel` file the runtime imports.

---

## Starting Files

After [Building a Todo App](/tutorial/04-todo-app), keep the same domain file
and add the generated facade plus React files:

```text
src/
  domain/
    todo.mel
    todo.domain.ts
  hooks/
    use-manifesto.ts
  app.tsx
```

The tutorial's `src/manifesto-app.ts` can stay for the Node script while you
learn. The React hook below owns a browser-local runtime. When the UI and an
agent must share state, move runtime ownership to the server shape in
[Web App + Agent](./web-app-and-agent).

---

## 1. Import The Generated Domain Types

Create the hook next to the Todo domain from [Building a Todo App](/tutorial/04-todo-app).
The Vite/codegen setup emits `src/domain/todo.domain.ts` from
`src/domain/todo.mel`:

```typescript
import type { TodoDomain } from "../domain/todo.domain";

export type Todo = TodoDomain["state"]["todos"][number];
export type FilterMode = TodoDomain["state"]["filterMode"];
```

The runtime imports `todo.mel`. React imports `todo.domain.ts` for types. Both
come from the same domain source, so renaming an action or state field in MEL
shows up in TypeScript.

For this guide, the aliases live in the hook. If you split components into
separate files, move `Todo` and `FilterMode` into `src/types.ts`; the runnable
example uses that layout.

---

## 2. Build A Hook Around An Activated Runtime

Create `hooks/use-manifesto.ts`:

```typescript
import { useEffect, useRef, useState } from "react";
import {
  createManifesto,
  type ActionName,
  type ManifestoApp,
  type SubmitResultFor,
} from "@manifesto-ai/sdk";
import TodoMel from "../domain/todo.mel";
import type { TodoDomain } from "../domain/todo.domain";

export type Todo = TodoDomain["state"]["todos"][number];
export type FilterMode = TodoDomain["state"]["filterMode"];

type TodoApp = ManifestoApp<TodoDomain, "base">;
type TodoSnapshot = ReturnType<TodoApp["snapshot"]>;
type TodoSubmitResult =
  SubmitResultFor<"base", TodoDomain, ActionName<TodoDomain>>;

type UseManifestoResult = {
  readonly state: TodoSnapshot | null;
  readonly ready: boolean;
  readonly addTodo: (title: string) => Promise<TodoSnapshot>;
  readonly toggleTodo: (id: string) => Promise<TodoSnapshot>;
  readonly removeTodo: (id: string) => Promise<TodoSnapshot>;
  readonly setFilter: (newFilter: FilterMode) => Promise<TodoSnapshot>;
  readonly clearCompleted: () => Promise<TodoSnapshot>;
};

async function submitOrThrow(resultPromise: Promise<TodoSubmitResult>): Promise<TodoSnapshot> {
  const result = await resultPromise;
  if (!result.ok) {
    throw new Error(result.admission.message);
  }
  if (result.outcome.kind === "fail") {
    throw new Error(result.outcome.error.message);
  }
  if (result.outcome.kind === "stop") {
    throw new Error(result.outcome.reason);
  }
  return result.after;
}

export function useManifesto(): UseManifestoResult {
  const appRef = useRef<TodoApp | null>(null);
  const [state, setState] = useState<TodoSnapshot | null>(null);

  useEffect(() => {
    const app = createManifesto<TodoDomain>(TodoMel, {}).activate();
    appRef.current = app;
    setState(app.snapshot());

    const unsubscribe = app.observe.state(
      (snapshot) => snapshot,
      (nextSnapshot) => setState(nextSnapshot),
    );

    return () => {
      unsubscribe();
      appRef.current = null;
      setState(null);
      app.dispose();
    };
  }, []);

  const withApp = (run: (app: TodoApp) => Promise<TodoSnapshot>) => {
    const app = appRef.current;
    if (!app) {
      return Promise.reject(new Error("Manifesto runtime is not ready"));
    }
    return run(app);
  };

  const addTodo = (title: string) =>
    withApp((app) => submitOrThrow(app.action.addTodo.submit(title)));

  const toggleTodo = (id: string) =>
    withApp((app) => submitOrThrow(app.action.toggleTodo.submit(id)));

  const removeTodo = (id: string) =>
    withApp((app) => submitOrThrow(app.action.removeTodo.submit(id)));

  const setFilter = (newFilter: FilterMode) =>
    withApp((app) => submitOrThrow(app.action.setFilter.submit(newFilter)));

  const clearCompleted = () =>
    withApp((app) => submitOrThrow(app.action.clearCompleted.submit()));

  return {
    state,
    ready: state !== null,
    addTodo,
    toggleTodo,
    removeTodo,
    setFilter,
    clearCompleted,
  };
}
```

The important runtime rules are:

- `createManifesto(...).activate()` runs once per mounted hook instance
- `observe.state(...)` pushes only later published snapshots
- every action helper submits through `app.action.*`
- React never calls retired root runtime verbs

`submitOrThrow()` keeps the demo small by turning non-success writes into thrown
errors. In a product UI, you can return a typed response instead, as shown in
[Web App + Agent](./web-app-and-agent).

---

## 3. Render Snapshot State In Components

```tsx
import { useState } from "react";
import {
  useManifesto,
  type FilterMode,
  type Todo,
} from "./hooks/use-manifesto";

export function App() {
  const {
    state,
    ready,
    addTodo,
    toggleTodo,
    removeTodo,
    setFilter,
    clearCompleted,
  } = useManifesto();

  if (!ready || !state) {
    return <div className="loading">Loading...</div>;
  }

  const domainState = state.state;
  const computed = state.computed;
  const todos = domainState.todos;
  const filteredTodos = todos.filter((todo) => {
    if (domainState.filterMode === "active") return !todo.completed;
    if (domainState.filterMode === "completed") return todo.completed;
    return true;
  });

  return (
    <section className="todoapp">
      <header className="header">
        <h1>todos</h1>
        <TodoInput onAdd={(title) => void addTodo(title)} />
      </header>

      {todos.length > 0 && (
        <>
          <TodoList
            todos={filteredTodos}
            onToggle={(id) => void toggleTodo(id)}
            onRemove={(id) => void removeTodo(id)}
          />

          <TodoFooter
            activeCount={computed.activeCount}
            hasCompleted={computed.hasCompleted}
            filterMode={domainState.filterMode}
            onSetFilter={(filter) => void setFilter(filter)}
            onClearCompleted={() => void clearCompleted()}
          />
        </>
      )}
    </section>
  );
}
```

React only reads snapshots and calls typed helpers. The Manifesto runtime still
owns state transitions, queueing, and action availability.

Minimal versions of the child components can stay ordinary React components:

```tsx
function TodoInput(props: { readonly onAdd: (title: string) => void }) {
  const [title, setTitle] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        props.onAdd(title);
        setTitle("");
      }}
    >
      <input value={title} onChange={(event) => setTitle(event.target.value)} />
      <button type="submit">Add</button>
    </form>
  );
}

function TodoList(props: {
  readonly todos: readonly Todo[];
  readonly onToggle: (id: string) => void;
  readonly onRemove: (id: string) => void;
}) {
  return (
    <ul>
      {props.todos.map((todo) => (
        <li key={todo.id}>
          <label>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => props.onToggle(todo.id)}
            />
            {todo.title}
          </label>
          <button type="button" onClick={() => props.onRemove(todo.id)}>
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

function TodoFooter(props: {
  readonly activeCount: number;
  readonly hasCompleted: boolean;
  readonly filterMode: FilterMode;
  readonly onSetFilter: (filter: FilterMode) => void;
  readonly onClearCompleted: () => void;
}) {
  return (
    <footer>
      <span>{props.activeCount} active</span>
      {(["all", "active", "completed"] as const).map((filter) => (
        <button
          key={filter}
          type="button"
          disabled={props.filterMode === filter}
          onClick={() => props.onSetFilter(filter)}
        >
          {filter}
        </button>
      ))}
      {props.hasCompleted && (
        <button type="button" onClick={props.onClearCompleted}>
          Clear completed
        </button>
      )}
    </footer>
  );
}
```

---

## 4. Awaitable UI Flows Stay On The Same Helpers

If a form or modal needs to wait for completion, await the helper:

```typescript
await addTodo("Review the UI flow");
```

The helper already uses `app.action.addTodo.submit(title)` and checks whether
the runtime accepted and settled the write, so you do not need a second generic
dispatch layer.

---

## 5. Treat Availability As Current UI State

`action.x.available()` is a point-in-time runtime read. If the UI needs a
reactive boolean, recompute it in the same path that updates React state from
snapshots.

```typescript
const syncAvailability = (app: TodoApp) => {
  setCanClearCompleted(app.action.clearCompleted.available());
};

useEffect(() => {
  const app = createManifesto<TodoDomain>(TodoMel, {}).activate();
  appRef.current = app;
  setState(app.snapshot());
  syncAvailability(app);

  const unsubscribe = app.observe.state(
    (snapshot) => snapshot,
    (nextSnapshot) => {
      setState(nextSnapshot);
      syncAvailability(app);
    },
  );

  return () => {
    unsubscribe();
    app.dispose();
  };
}, []);
```

Do not treat `available()` itself as a subscription source.

---

## 6. If You Are Not Using Codegen Yet

For a one-file experiment, you can temporarily write a small local domain shape.
Do that only as a fallback. The normal app path is to let [Code Generation](/guides/code-generation)
emit the facade from `todo.mel`:

```typescript
import type { TodoDomain } from "../domain/todo.domain";

export type Todo = TodoDomain["state"]["todos"][number];
export type FilterMode = TodoDomain["state"]["filterMode"];
```

The runtime calls do not change. Code generation removes the hand-written
domain shape and keeps React props aligned with the `.mel` file.

---

## 7. Add Review Later

Keep the same React shape when the product later needs reviewed writes:
activate once, store the runtime in a ref, render from snapshots, and submit
through `app.action.*`.

What changes is the runtime assembled before activation and the result your
action helper returns. Do not add that complexity for a local UI demo. Use
[When You Need Approval or History](/guides/approval-and-history) when writes
need human review or durable history.

---

## Common Mistakes

### Recreating the runtime on every render

Activate once during mount, then keep the runtime in a ref.

### Reintroducing a generic string dispatcher

Prefer explicit helpers like `addTodo(title)` over `act("addTodo", input)`.
That keeps the app path aligned with typed `action.*`.

### Reintroducing an older generic dispatcher

Prefer the typed action helper. It already delegates to `submit()` and keeps
component code out of generic string dispatch.

### Expecting `observe.state()` to emit immediately

Seed the initial React state from `snapshot()`. `observe.state()` is only for
later terminal updates.

### Treating `available()` as reactive by itself

Read it when your observed snapshot changes, then store the result in React
state if the component needs a stable boolean.

### Forgetting subscription cleanup

Always call the returned `unsubscribe()` and dispose the runtime in the effect
cleanup. React owns the view lifecycle, but the runtime still owns its queue and
listeners.

---

## Next

- Read [AI Agents](./ai-agents) to drive the same runtime from an agent workflow
- Read [Web App + Agent](./web-app-and-agent) when the UI and agent must share one server runtime
- Read [When You Need Approval or History](/guides/approval-and-history) when the UI later needs review or durable history
- Read [Debugging](/guides/debugging) if a rendered snapshot does not match the action you submitted
