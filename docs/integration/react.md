# React Integration

> Keep React focused on Snapshot reads. Activate the runtime once per app mount, then expose typed action helpers from a hook.

---

## What You Build

- one activated SDK runtime held in a ref
- one React state value seeded from `snapshot()`
- one `observe.state(...)` subscription that keeps React in sync with terminal snapshots
- explicit action helpers such as `addTodo(title)` instead of `act("addTodo", input)`

This page stays SDK-first. If your app later needs lineage or governance,
compose those decorators before activation and keep the React layer on snapshot
reads and action helpers.

---

## Prerequisites

- You finished the [Tutorial](/tutorial/)
- You know basic React hooks

---

## 1. Define The Domain Shape

Create `types.ts`:

```typescript
export type Todo = {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
};

export type FilterMode = "all" | "active" | "completed";

export type TodoState = {
  readonly todos: readonly Todo[];
  readonly filterMode: FilterMode;
};

export type TodoComputed = {
  readonly todoCount: number;
  readonly completedCount: number;
  readonly activeCount: number;
  readonly hasCompleted: boolean;
};

export type TodoDomain = {
  readonly actions: {
    readonly addTodo: (title: string) => void;
    readonly toggleTodo: (id: string) => void;
    readonly removeTodo: (id: string) => void;
    readonly setFilter: (newFilter: FilterMode) => void;
    readonly clearCompleted: () => void;
  };
  readonly state: TodoState;
  readonly computed: TodoComputed;
};
```

The hook uses this type to keep `actions.*` aligned with the domain action
signatures.

---

## 2. Build A Hook Around An Activated Runtime

Create `hooks/use-manifesto.ts`:

```typescript
import { useEffect, useRef, useState } from "react";
import {
  createManifesto,
  type ManifestoApp,
  type ProjectedSnapshot,
} from "@manifesto-ai/sdk";
import todoSchema from "../domain/todo.mel";
import type { FilterMode, TodoDomain } from "../types";

type TodoSnapshot = ProjectedSnapshot<TodoDomain>;
type TodoApp = ManifestoApp<TodoDomain, "base">;

type UseManifestoResult = {
  readonly state: TodoSnapshot | null;
  readonly ready: boolean;
  readonly addTodo: (title: string) => Promise<TodoSnapshot>;
  readonly toggleTodo: (id: string) => Promise<TodoSnapshot>;
  readonly removeTodo: (id: string) => Promise<TodoSnapshot>;
  readonly setFilter: (newFilter: FilterMode) => Promise<TodoSnapshot>;
  readonly clearCompleted: () => Promise<TodoSnapshot>;
};

async function submitOrThrow(
  run: (app: TodoApp) => ReturnType<TodoApp["actions"]["clearCompleted"]["submit"]>,
  app: TodoApp,
): Promise<TodoSnapshot> {
  const result = await run(app);
  if (!result.ok) {
    throw new Error(result.admission.message);
  }
  return result.after;
}

export function useManifesto(): UseManifestoResult {
  const appRef = useRef<TodoApp | null>(null);
  const [state, setState] = useState<TodoSnapshot | null>(null);

  useEffect(() => {
    const app = createManifesto<TodoDomain>(todoSchema as string, {}).activate();
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
    withApp((app) => submitOrThrow((runtime) => runtime.actions.addTodo.submit(title), app));

  const toggleTodo = (id: string) =>
    withApp((app) => submitOrThrow((runtime) => runtime.actions.toggleTodo.submit(id), app));

  const removeTodo = (id: string) =>
    withApp((app) => submitOrThrow((runtime) => runtime.actions.removeTodo.submit(id), app));

  const setFilter = (newFilter: FilterMode) =>
    withApp((app) => submitOrThrow((runtime) => runtime.actions.setFilter.submit(newFilter), app));

  const clearCompleted = () =>
    withApp((app) => submitOrThrow((runtime) => runtime.actions.clearCompleted.submit(), app));

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
- `observe.state(...)` pushes only later terminal snapshots
- every action helper submits through `app.actions.*`
- React never calls retired root runtime verbs

---

## 3. Render Snapshot State In Components

```tsx
import { useManifesto } from "./hooks/use-manifesto";

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

---

## 4. Awaitable UI Flows Stay On The Same Helpers

If a form or modal needs to wait for completion, await the helper:

```typescript
await addTodo("Review the UI flow");
```

The helper already uses `app.actions.addTodo.submit(title)`, so you do not need
a second generic dispatch layer.

---

## 5. Treat Availability As Snapshot-Derived UI State

`actions.x.available()` is a point-in-time runtime read. If the UI needs a
reactive boolean, recompute it in the same path that updates React state from
snapshots.

```typescript
const syncAvailability = (app: TodoApp) => {
  setCanClearCompleted(app.actions.clearCompleted.available());
};

useEffect(() => {
  const app = createManifesto<TodoDomain>(todoSchema as string, {}).activate();
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

## 6. If The App Is Governed

Keep the same React shape. The only change is the runtime assembly before
activation:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { createInMemoryGovernanceStore, withGovernance } from "@manifesto-ai/governance";

const governed = withGovernance(
  withLineage(createManifesto(todoSchema as string, effects), {
    store: createInMemoryLineageStore(),
  }),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings: [
      {
        actorId: "actor:auto",
        authorityId: "authority:auto",
        policy: { mode: "auto_approve" },
      },
    ],
    execution: {
      projectionId: "todo-ui",
      deriveActor: () => ({ actorId: "actor:auto", kind: "human" }),
      deriveSource: () => ({ kind: "ui", eventId: crypto.randomUUID() }),
    },
  },
).activate();
```

The component tree can still render snapshots the same way. What changes is the
runtime contract behind the hook: governed `submit()` first returns a pending
proposal result, and settlement is observed through `waitForSettlement()`.

---

## Common Mistakes

### Recreating the runtime on every render

Activate once during mount, then keep the runtime in a ref.

### Reintroducing a generic string dispatcher

Prefer explicit helpers like `addTodo(title)` over `act("addTodo", input)`.
That keeps the app path aligned with typed `actions.*`.

### Waiting for retired SDK APIs

There is no dispatch-first path anymore. Await the action helper, which already
delegates to `submit()`.

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
- Read [When You Need Approval or History](/guides/approval-and-history) when the UI later needs lineage or approvals
- Read [Debugging](/guides/debugging) if a rendered snapshot does not match the action you submitted
