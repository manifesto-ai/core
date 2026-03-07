# Intent

> An Intent is a request to move the domain from one snapshot to the next.

---

## What an Intent Is

In Manifesto, you do not call domain methods that mutate state directly. You submit an `Intent` and let the runtime compute the next terminal snapshot.

At the SDK level, an intent is the unit that goes into `dispatch()`.

---

## The Practical SDK Shape

The safest path is to create intents with `createIntent()`:

```typescript
import { createIntent } from "@manifesto-ai/sdk";

const intent = createIntent(
  "addTodo",
  { id: crypto.randomUUID(), title: "Review the docs" },
  crypto.randomUUID(),
);
```

Then dispatch it:

```typescript
manifesto.dispatch(intent);
```

That keeps the `intentId` explicit and stable for the lifetime of that intent.

---

## Why `intentId` Matters

The current SDK uses `intentId` to correlate lifecycle events:

- `dispatch:completed`
- `dispatch:rejected`
- `dispatch:failed`

If you build a `dispatchAsync()` helper on top of `on()`, it usually matches completion or failure by `intentId`.

---

## Intent vs Command

An Intent is not “do this imperative step right now.” It is “this is the requested transition.”

That difference matters because:

- the domain may reject it
- effects may be involved
- the result is observed through Snapshot, not a hidden return channel

---

## A Simple Example

```typescript
import { createManifesto, createIntent } from "@manifesto-ai/sdk";
import TodoMel from "./todo.mel";

const manifesto = createManifesto({
  schema: TodoMel,
  effects: {},
});

manifesto.dispatch(
  createIntent(
    "addTodo",
    { id: crypto.randomUUID(), title: "Ship the rewrite" },
    crypto.randomUUID(),
  ),
);

console.log(manifesto.getSnapshot().data);
```

---

## Common Mistakes

### Treating the intent like the result

The intent is the request. The snapshot is the result.

### Skipping `createIntent()`

You can construct the object yourself, but `createIntent()` is the safer and clearer path for current SDK usage.

### Assuming `dispatch()` completes synchronously

`dispatch()` enqueues work and returns immediately. Use telemetry or read the next terminal snapshot later.

---

## See Also

- [Tutorial](/tutorial/) for the first end-to-end examples
- [Effect](./effect) for what happens when an action declares external work
- [World](./world) for explicit governance and lineage
