# Your First Manifesto Instance

> Create a small counter and learn the current SDK surface.

---

## What You'll Learn

- How to write a tiny MEL domain
- How to create a `ManifestoInstance`
- How to dispatch intents with `createIntent()`
- How to observe state through `subscribe()` and `getSnapshot()`
- Why `onceIntent` matters

---

## Prerequisites

- The [Quickstart](/quickstart) works in your environment
- You can import `.mel` files with `@manifesto-ai/compiler`

---

## 1. Define the Domain

Create `counter.mel`:

```mel
domain Counter {
  state {
    count: number = 0
  }

  computed doubled = mul(count, 2)

  action increment() {
    onceIntent {
      patch count = add(count, 1)
    }
  }

  action decrement() available when gt(count, 0) {
    onceIntent {
      patch count = sub(count, 1)
    }
  }
}
```

This domain already shows the basic Manifesto shape:

- `state` stores source-of-truth values
- `computed` derives values from state
- `action` describes legal transitions
- `onceIntent` keeps the action safe across the compute loop

---

## 2. Create a Small Async Helper

Create `dispatch-async.ts`:

```typescript
import {
  createIntent,
  type ManifestoInstance,
  type Snapshot,
} from "@manifesto-ai/sdk";

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

`dispatchAsync()` is not a built-in SDK API. It is a small convenience wrapper built from the current public contract.

---

## 3. Create the Instance

Create `main.ts`:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";
import { dispatchAsync } from "./dispatch-async";

const manifesto = createManifesto({
  schema: CounterMel,
  effects: {},
});

manifesto.subscribe(
  (snapshot) => snapshot.data.count,
  (count) => {
    console.log("Count changed:", count);
  },
);

async function run() {
  console.log("Initial count:", manifesto.getSnapshot().data.count);

  await dispatchAsync(manifesto, "increment");
  await dispatchAsync(manifesto, "increment");
  await dispatchAsync(manifesto, "decrement");

  const snapshot = manifesto.getSnapshot();
  console.log("Final count:", snapshot.data.count);
  console.log("Doubled:", snapshot.computed["doubled"]);

  manifesto.dispose();
}

run().catch((error) => {
  console.error(error);
  manifesto.dispose();
});
```

Run it:

```bash
npx tsx main.ts
```

---

## What Just Happened

- `createManifesto()` created a ready-to-use instance. There is no `ready()` phase.
- `dispatchAsync()` created a real `Intent` with `createIntent()` and a stable `intentId`.
- `dispatch()` enqueued that intent for processing.
- `subscribe()` fired after each terminal snapshot.
- `getSnapshot()` returned the latest snapshot whenever you wanted to read it directly.

The important shift is this: you do not call a method that “does the action and returns a result.” You submit an intent, then read the resulting snapshot.

---

## Why `onceIntent` Is in Every Action

The compute loop can revisit an action while processing requirements and patches. Without a guard, the same patch can re-run.

```mel
action increment() {
  patch count = add(count, 1)
}
```

That action is unsafe. It describes an unconditional state change with no marker. `onceIntent` makes the operation idempotent for a single intent.

---

## Common Mistakes

### Calling `dispatch()` and waiting for a return value

`dispatch()` returns `void`. Use `subscribe()`, `on()`, or a helper like `dispatchAsync()`.

### Reading state before the intent finishes

If you call `getSnapshot()` immediately after `dispatch()`, you may still be looking at the previous terminal snapshot.

### Forgetting to provide an `intentId`

The helper in this tutorial handles that for you. If you build intents manually, keep the `intentId` stable for the lifetime of that intent.

### Mutating the snapshot object

The snapshot is a read model. Dispatch a new intent instead.

---

## Next

Continue to [Actions and State](./02-actions-and-state) to work with arrays, computed values, and selector-based subscriptions.
