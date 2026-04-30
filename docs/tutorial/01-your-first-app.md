# Your First Activated Manifesto

> Create a small counter and learn the current SDK base-runtime surface.

---

## What You'll Learn

- How to write a tiny MEL domain
- How to activate a manifesto runtime
- How to submit typed actions from `actions.*`
- How to observe state through `observe.state()` and `snapshot()`
- Why `onceIntent` matters

---

## Prerequisites

- The [Quick Start](/guide/quick-start) works in your environment
- You can import `.mel` files with `@manifesto-ai/compiler`

---

## 1. Define the Domain

Create `counter.mel`:

```mel
domain Counter {
  state {
    count: number = 0
  }

  computed doubled = count * 2

  action increment() {
    onceIntent {
      patch count = count + 1
    }
  }

  action decrement() available when count > 0 {
    onceIntent {
      patch count = count - 1
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

## 2. Create the Runtime

Create `main.ts`:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

const app = createManifesto(CounterMel, {}).activate();

app.observe.state(
  (snapshot) => snapshot.state.count,
  (next, prev) => {
    console.log("Count changed:", prev, next);
  },
);

async function run() {
  console.log("Initial count:", app.snapshot().state.count);

  await app.actions.increment.submit();
  await app.actions.increment.submit();
  await app.actions.decrement.submit();

  const snapshot = app.snapshot();
  console.log("Final count:", snapshot.state.count);
  console.log("Doubled:", snapshot.computed["doubled"]);

  app.dispose();
}

run().catch((error) => {
  console.error(error);
  app.dispose();
});
```

Run it:

```bash
npx tsx main.ts
```

---

## What Just Happened

- `createManifesto()` built a composable manifesto from your domain
- `activate()` opened the runtime surface
- `actions.*.submit()` gave you a typed, app-facing write path
- `submit()` resolved after each terminal snapshot was published
- `observe.state()` fired after each published change
- `snapshot()` let you read the latest terminal state directly

The important shift is this: you do not call a method that "does the action and returns a value." You submit an action candidate to the runtime, and read the next snapshot.

---

## Why `onceIntent` Is in Every Action

The compute loop can revisit an action while processing requirements and patches. Without a guard, the same patch can re-run.

```mel
action increment() {
  patch count = count + 1
}
```

That action is unsafe. It describes an unconditional state change with no marker. `onceIntent` makes the operation idempotent for a single intent.

---

## Common Mistakes

### Calling runtime verbs before activation

`createManifesto()` returns a composable manifesto. Runtime verbs appear only after `activate()`.

### Reaching for raw string action names in app code

The preferred app-facing path is `app.actions.someAction.submit(...args)` or `app.actions.someAction.submit({ ...params })`, not stringly-typed action names.

### Reading stale state without awaiting execution

`submit()` resolves after publication. If you skip the `await`, your next read may still be the previous terminal snapshot.

### Mutating the snapshot object

The snapshot is a read model. Dispatch a new intent instead.

---

## Next

Continue to [Actions and State](./02-actions-and-state) to work with arrays, computed values, and selector-based subscriptions.
