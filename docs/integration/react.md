# React Integration

> Keep React focused on Snapshot reads. Activate the runtime once per app mount, then expose typed action helpers from a hook.

---

## What You Build

- one activated SDK runtime held in a ref
- one React state value seeded from `getSnapshot()`
- one subscription that keeps React in sync with terminal snapshots
- explicit action helpers such as `addTodo(title)` instead of `act("addTodo", input)`

This page stays SDK-first. If your app later needs lineage or governance, compose those decorators before activation and keep the React layer on snapshot reads.

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

export type TodoData = {
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
  readonly state: TodoData;
  readonly computed: TodoComputed;
};
```

The hook uses this type to keep `MEL.actions.*` aligned with the domain action signatures.

---

## 2. Build A Hook Around An Activated Runtime

Create `hooks/use-manifesto.ts`:

```typescript
import { useEffect, useRef, useState } from "react";
import { createManifesto, type ManifestoBaseInstance, type Snapshot } from "@manifesto-ai/sdk";
import todoSchema from "../domain/todo.mel";
import type { FilterMode, TodoData, TodoDomain } from "../types";

type UseManifestoResult = {
  readonly state: Snapshot<TodoData> | null;
  readonly ready: boolean;
  readonly addTodo: (title: string) => Promise<Snapshot<TodoData>>;
  readonly toggleTodo: (id: string) => Promise<Snapshot<TodoData>>;
  readonly removeTodo: (id: string) => Promise<Snapshot<TodoData>>;
  readonly setFilter: (newFilter: FilterMode) => Promise<Snapshot<TodoData>>;
  readonly clearCompleted: () => Promise<Snapshot<TodoData>>;
};

export function useManifesto(): UseManifestoResult {
  const worldRef = useRef<ManifestoBaseInstance<TodoDomain> | null>(null);
  const [state, setState] = useState<Snapshot<TodoData> | null>(null);

  useEffect(() => {
    const world = createManifesto<TodoDomain>(todoSchema as string, {}).activate();
    worldRef.current = world;
    setState(world.getSnapshot());

    const unsubscribe = world.subscribe(
      (snapshot) => snapshot,
      (nextSnapshot) => setState(nextSnapshot),
    );

    return () => {
      unsubscribe();
      worldRef.current = null;
      setState(null);
      world.dispose();
    };
  }, []);

  const dispatchOrReject = (
    run: (world: ManifestoBaseInstance<TodoDomain>) => Promise<Snapshot<TodoData>>,
  ): Promise<Snapshot<TodoData>> => {
    const world = worldRef.current;
    if (!world) {
      return Promise.reject(new Error("Manifesto runtime is not ready"));
    }
    return run(world);
  };

  const addTodo = (title: string) =>
    dispatchOrReject((world) =>
      world.dispatchAsync(
        world.createIntent(world.MEL.actions.addTodo, title),
      ));

  const toggleTodo = (id: string) =>
    dispatchOrReject((world) =>
      world.dispatchAsync(
        world.createIntent(world.MEL.actions.toggleTodo, id),
      ));

  const removeTodo = (id: string) =>
    dispatchOrReject((world) =>
      world.dispatchAsync(
        world.createIntent(world.MEL.actions.removeTodo, id),
      ));

  const setFilter = (newFilter: FilterMode) =>
    dispatchOrReject((world) =>
      world.dispatchAsync(
        world.createIntent(world.MEL.actions.setFilter, newFilter),
      ));

  const clearCompleted = () =>
    dispatchOrReject((world) =>
      world.dispatchAsync(
        world.createIntent(world.MEL.actions.clearCompleted),
      ));

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
- `world.subscribe(...)` pushes only later terminal snapshots
- every action helper creates an intent from `world.MEL.actions.*`
- React never calls removed SDK helper surfaces or synchronous base dispatch

---

## 3. Render Snapshot Data In Components

```tsx
import { useManifesto } from "./hooks/use-manifesto";
import type { TodoComputed } from "./types";

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

  const data = state.data;
  const computed = state.computed as TodoComputed;
  const todos = data.todos;
  const filteredTodos = todos.filter((todo) => {
    if (data.filterMode === "active") return !todo.completed;
    if (data.filterMode === "completed") return todo.completed;
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
            filterMode={data.filterMode}
            onSetFilter={(filter) => void setFilter(filter)}
            onClearCompleted={() => void clearCompleted()}
          />
        </>
      )}
    </section>
  );
}
```

React only reads snapshots and calls typed helpers. The Manifesto runtime still owns state transitions, queueing, and action availability.

---

## 4. Awaitable UI Flows Stay On The Same Helpers

If a form or modal needs to wait for completion, await the helper:

```typescript
await addTodo("Review the UI flow");
```

The helper already uses `world.dispatchAsync(world.createIntent(...))`, so you do not need a second generic dispatch layer.

---

## 5. Treat Availability As Snapshot-Derived UI State

`isActionAvailable()` is a point-in-time runtime read. If the UI needs a reactive boolean, recompute it in the same path that updates React state from snapshots.

```typescript
const syncAvailability = (world: ManifestoBaseInstance<TodoDomain>) => {
  setCanClearCompleted(world.isActionAvailable("clearCompleted"));
};

useEffect(() => {
  const world = createManifesto<TodoDomain>(todoSchema as string, {}).activate();
  worldRef.current = world;
  setState(world.getSnapshot());
  syncAvailability(world);

  const unsubscribe = world.subscribe(
    (snapshot) => snapshot,
    (nextSnapshot) => {
      setState(nextSnapshot);
      syncAvailability(world);
    },
  );

  return () => {
    unsubscribe();
    world.dispose();
  };
}, []);
```

Do not treat `isActionAvailable()` itself as a subscription source.

---

## 6. If The App Is Governed

Keep the same React shape. The only change is the runtime assembly before activation:

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

The component tree can still render snapshots the same way. What changes is the runtime contract behind the hook: proposals and approvals replace direct base dispatch.

---

## Common Mistakes

### Recreating the runtime on every render

Activate once during mount, then keep the runtime in a ref.

### Reintroducing a generic string dispatcher

Prefer explicit helpers like `addTodo(title)` over `act("addTodo", input)`. That keeps the app path aligned with typed `MEL.actions.*`.

### Waiting for removed SDK APIs

There is no `dispatch()`-first path anymore. Await the action helper, which already delegates to `dispatchAsync()`.

### Expecting `subscribe()` to emit immediately

Seed the initial React state from `getSnapshot()`. `subscribe()` is only for later terminal updates.

### Treating `isActionAvailable()` as reactive by itself

Read it when your subscribed snapshot changes, then store the result in React state if the component needs a stable boolean.

### Forgetting subscription cleanup

Always call the returned `unsubscribe()` and `dispose()` the runtime in the effect cleanup. React owns the view lifecycle, but the runtime still owns its queue and listeners.

---

## Next

- Read [AI Agents](./ai-agents) to drive the same runtime from an agent workflow
- Read [When You Need Approval or History](/guides/approval-and-history) when the UI later needs lineage or approvals
- Read [Debugging](/guides/debugging) if a rendered snapshot does not match the intent you dispatched
