# React Integration

> Keep React on Snapshot reads and let the runtime assembly live outside the component tree.

---

## What You Build

- one shared `ManifestoInstance`
- a selector hook powered by `useSyncExternalStore`
- a small dispatch helper for event handlers
- an optional governed runtime module that lives outside React

This page stays SDK-first. If your app needs approval or lineage, React should still render snapshots rather than own the governed assembly.

---

## Prerequisites

- You finished the [Tutorial](/tutorial/)
- You know basic React hooks

---

## 1. Create The SDK Instance Outside React

Create `manifesto.ts`:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

export const manifesto = createManifesto({
  schema: CounterMel,
  effects: {},
});
```

Create the instance once. Do not recreate it inside a component render.

---

## 2. Build A Selector Hook

Create `hooks.ts`:

```typescript
import { createIntent, type Snapshot } from "@manifesto-ai/sdk";
import { useSyncExternalStore } from "react";
import { manifesto } from "./manifesto";

export function useManifestoSelector<R>(
  selector: (snapshot: Snapshot) => R,
): R {
  return useSyncExternalStore(
    (onStoreChange) => manifesto.subscribe(selector, () => onStoreChange()),
    () => selector(manifesto.getSnapshot()),
    () => selector(manifesto.getSnapshot()),
  );
}

export function dispatchIntent(type: string, input?: unknown): void {
  const intentId = crypto.randomUUID();
  const intent =
    input === undefined
      ? createIntent(type, intentId)
      : createIntent(type, input, intentId);

  manifesto.dispatch(intent);
}
```

This keeps React focused on rendering. Manifesto still owns state transitions.

---

## 3. Use It In A Component

```tsx
import { dispatchIntent, useManifestoSelector } from "./hooks";

export function CounterPanel() {
  const count = useManifestoSelector((snapshot) => snapshot.data.count as number);
  const doubled = useManifestoSelector(
    (snapshot) => snapshot.computed["doubled"] as number,
  );

  return (
    <section>
      <h1>Counter</h1>
      <p>Count: {count}</p>
      <p>Doubled: {doubled}</p>
      <button onClick={() => dispatchIntent("increment")}>Increment</button>
      <button onClick={() => dispatchIntent("decrement")}>Decrement</button>
    </section>
  );
}
```

---

## 4. If You Need Awaitable UI Flows

Keep `dispatch()` synchronous and use `dispatchAsync()` outside the component when you need to await a completion:

```typescript
import { createIntent, dispatchAsync } from "@manifesto-ai/sdk";

const intent = createIntent(
  "todo.add",
  { title: "Review the UI flow" },
  crypto.randomUUID(),
);

const nextSnapshot = await dispatchAsync(manifesto, intent);
```

Use that for form submissions or flows where the UI should wait for a terminal snapshot.

---

## 5. If The App Is Governed

Keep the governed assembly in a separate runtime module and let React read snapshots from it.

```typescript
// governed-runtime.ts
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { createInMemoryGovernanceStore, withGovernance } from "@manifesto-ai/governance";

export const governed = withGovernance(
  withLineage(createManifesto(todoSchema, effects), {
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

React should still render Snapshot slices. The governed runtime can sit beside React, in a bootstrap module or server-facing controller, while the component tree stays read-focused.

---

## When React Should Stay On Snapshot Reads Only

Keep React read-only when:

- proposals are created elsewhere
- approvals need a separate workflow
- branch and history state are managed by a controller, not the component tree
- you want the UI to stay simple while governance remains explicit

In that setup, React should receive the latest Snapshot and maybe a few derived selectors, but not the proposal or sealing APIs themselves.

---

## Common Mistakes

### Creating the instance inside a component

That resets subscriptions and application state.

### Awaiting `dispatch()`

`dispatch()` returns `void`. Use `dispatchAsync()` when you need an awaitable flow.

### Expecting `subscribe()` to emit immediately

Read `getSnapshot()` for the initial render. `subscribe()` is for later terminal updates.

### Mutating the returned snapshot

React should render it, not edit it.

---

## Next

- Read [AI Agents](./ai-agents) to drive the same instance from an agent workflow
- Read [World](../concepts/world) if the UI participates in a governed runtime
- Read [Debugging](/guides/debugging) if a UI update does not match the snapshot you expected
