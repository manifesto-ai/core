# Your First Activated Manifesto

> Create a small counter and learn the current SDK base-runtime surface.

---

## What You'll Learn

- How to write a tiny MEL domain
- How to activate a manifesto runtime
- How to create typed intents from `MEL.actions.*`
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

## 2. Create the Runtime

Create `main.ts`:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

const instance = createManifesto(CounterMel, {}).activate();

instance.subscribe(
  (snapshot) => snapshot.data.count,
  (count) => {
    console.log("Count changed:", count);
  },
);

async function run() {
  console.log("Initial count:", instance.getSnapshot().data.count);

  await instance.dispatchAsync(
    instance.createIntent(instance.MEL.actions.increment),
  );
  await instance.dispatchAsync(
    instance.createIntent(instance.MEL.actions.increment),
  );
  await instance.dispatchAsync(
    instance.createIntent(instance.MEL.actions.decrement),
  );

  const snapshot = instance.getSnapshot();
  console.log("Final count:", snapshot.data.count);
  console.log("Doubled:", snapshot.computed["doubled"]);

  instance.dispose();
}

run().catch((error) => {
  console.error(error);
  instance.dispose();
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
- `createIntent(instance.MEL.actions.*)` gave you a typed, app-facing intent path
- `dispatchAsync()` resolved after each terminal snapshot was published
- `subscribe()` fired after each published change
- `getSnapshot()` let you read the latest terminal state directly

The important shift is this: you do not call a method that "does the action and returns a value." You create an intent, submit it to the runtime, and read the next snapshot.

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

### Calling runtime verbs before activation

`createManifesto()` returns a composable manifesto. Runtime verbs appear only after `activate()`.

### Reaching for raw string action names in app code

The preferred app-facing path is `instance.createIntent(instance.MEL.actions.someAction, ...args)` or `instance.createIntent(instance.MEL.actions.someAction, { ...params })`, not stringly-typed action names.

### Reading stale state without awaiting execution

`dispatchAsync()` resolves after publication. If you skip the `await`, your next read may still be the previous terminal snapshot.

### Mutating the snapshot object

The snapshot is a read model. Dispatch a new intent instead.

---

## Next

Continue to [Actions and State](./02-actions-and-state) to work with arrays, computed values, and selector-based subscriptions.
