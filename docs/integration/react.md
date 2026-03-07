# React Integration

> Build small hooks around `ManifestoInstance` and let React render snapshot slices.

---

## What You'll Build

- One shared `ManifestoInstance`
- A selector hook powered by `useSyncExternalStore`
- A small dispatch helper for React event handlers

This page shows the current SDK surface only. There is no App facade or built-in React package in this repo.

---

## Prerequisites

- You finished the [Tutorial](/tutorial/)
- You know basic React hooks

---

## 1. Create the Instance Outside React

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

## 2. Build a Selector Hook

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

## 3. Use It in a Component

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

Keep `dispatch()` synchronous and wrap it outside the component when you need to await a completion:

```typescript
import { createIntent, type ManifestoInstance, type Snapshot } from "@manifesto-ai/sdk";

export function dispatchAsync(
  manifesto: ManifestoInstance,
  type: string,
  input?: unknown,
): Promise<Snapshot> {
  const intentId = crypto.randomUUID();
  const intent =
    input === undefined
      ? createIntent(type, intentId)
      : createIntent(type, input, intentId);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      offCompleted();
      offRejected();
      offFailed();
    };

    const offCompleted = manifesto.on("dispatch:completed", (event) => {
      if (event.intentId !== intentId) return;
      cleanup();
      resolve(event.snapshot!);
    });
    const offRejected = manifesto.on("dispatch:rejected", (event) => {
      if (event.intentId !== intentId) return;
      cleanup();
      reject(new Error(event.reason ?? "Dispatch rejected"));
    });
    const offFailed = manifesto.on("dispatch:failed", (event) => {
      if (event.intentId !== intentId) return;
      cleanup();
      reject(event.error ?? new Error("Dispatch failed"));
    });

    manifesto.dispatch(intent);
  });
}
```

Use that for form submissions or flows where the UI should wait for a terminal snapshot.

---

## Common Mistakes

### Creating the instance inside a component

That resets subscriptions and application state.

### Awaiting `dispatch()`

`dispatch()` returns `void`. Use telemetry or a wrapper helper if you need an awaitable flow.

### Expecting `subscribe()` to emit immediately

Read `getSnapshot()` for the initial render. `subscribe()` is for later terminal updates.

### Mutating the returned snapshot

React should render it, not edit it.

---

## Next

- Read [AI Agents](./ai-agents) to drive the same instance from an agent workflow
- Read [Debugging](/guides/debugging) if a UI update does not match the snapshot you expected
