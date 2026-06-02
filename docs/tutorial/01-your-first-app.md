# Your First App

> Create a small counter and submit actions through the SDK.

---

## What You'll Learn

- How to write a tiny MEL domain
- How to activate a Manifesto runtime
- How to submit typed actions from `action.*`
- How to observe state through `observe.state()` and `snapshot()`
- The small MEL pattern for one submitted action

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
- `onceIntent` wraps the patches for one submitted action

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

  await app.action.increment.submit();
  await app.action.increment.submit();
  await app.action.decrement.submit();

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
npx tsx --loader @manifesto-ai/compiler/node-loader main.ts
```

You should see output in this shape:

```text
Initial count: 0
Count changed: 0 1
Count changed: 1 2
Count changed: 2 1
Final count: 1
Doubled: 2
```

---

## What Just Happened

- `createManifesto()` prepared your domain for the app runtime
- `activate()` opened the runtime helpers
- `action.*.submit()` gave you a typed, app-facing write path
- `submit()` resolved after each state change was published
- `observe.state()` fired after each published change
- `snapshot()` let you read the latest terminal state directly

The important shift is this: app code submits an action, then reads the latest
snapshot. The domain owns how state changes.

---

## What To Know About `onceIntent`

For the first app, use `onceIntent` around patches that should happen once for
one submitted action:

```mel
action increment() {
  onceIntent {
    patch count = count + 1
  }
}
```

That is the normal beginner pattern. You do not need the lower-level execution
model to keep going; read the re-entry safety guide later when you are building
custom flows or reviewing advanced domains.

---

## Common Mistakes

### Calling runtime verbs before activation

Runtime verbs appear only after `activate()`. Call `activate()` before using
`action`, `snapshot()`, `observe`, or other app runtime helpers.

### Reaching for raw string action names in app code

The preferred app-facing path is `app.action.someAction.submit(...args)` or `app.action.someAction.submit({ ...params })`, not stringly-typed action names.

### Reading stale state without awaiting execution

`submit()` resolves after publication. If you skip the `await`, your next read may still be the previous Snapshot.

### Mutating the snapshot object

The snapshot is a read model. Submit a new action instead.

---

## Next

Continue to [Actions and State](./02-actions-and-state) to work with arrays, computed values, and selector-based subscriptions.
