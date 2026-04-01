# Intent

> An Intent is a request to move the domain from one Snapshot to the next.

---

## What An Intent Is

In Manifesto, you do not call domain methods that mutate state directly. You submit an `Intent` and let the runtime compute the next terminal Snapshot.

At the runtime level, an intent is the unit that goes into `dispatchAsync()` or `proposeAsync()`.

---

## Intent vs IntentInstance

The direct-dispatch path and the governed path use related but different inputs:

| Type | Used By | Purpose |
|------|---------|---------|
| `Intent` | `@manifesto-ai/sdk`, governed activated runtimes | Request a typed Snapshot transition |
| `IntentInstance` | `@manifesto-ai/governance` low-level helpers | Carry actor, source, and projection context before proposal orchestration |

`Intent` is the canonical public request object. `IntentInstance` exists when you need to materialize governed provenance outside the activated runtime methods.

---

## The Practical Runtime Shape

The safest path is to create intents from the activated runtime:

```typescript
const app = createManifesto(schema, effects).activate();

const intent = app.createIntent(
  app.MEL.actions.addTodo,
  crypto.randomUUID(),
  "Review the docs",
);
```

Then dispatch it:

```typescript
await app.dispatchAsync(intent);
```

That keeps the `intentId` stable while avoiding stringly-typed public calls.

---

## The Governed Shape

Use `createIntentInstance()` when you need actor identity, source metadata, or a service-level governed proposal path:

```typescript
import { createIntentInstance } from "@manifesto-ai/governance";

const intentInstance = await createIntentInstance({
  body: {
    type: "addTodo",
    input: { id: crypto.randomUUID(), title: "Review the docs" },
  },
  schemaHash: "todo-v1",
  projectionId: "todo-ui",
  source: { kind: "agent", eventId: "evt-1" },
  actor: { actorId: "user-1", kind: "human" },
});
```

The decorator runtime usually creates proposal metadata for you. Reach for `IntentInstance` when you are working below that runtime boundary.

---

## Why `intentId` Matters

The current SDK uses `intentId` to correlate lifecycle events:

- `dispatch:completed`
- `dispatch:rejected`
- `dispatch:failed`

If you build an awaitable helper on top of `on()`, it usually matches completion or failure by `intentId`.

---

## Intent Versus Command

An Intent is not "do this imperative step right now." It is "this is the requested transition."

That difference matters because:

- the domain may reject it
- effects may be involved
- the result is observed through Snapshot, not a hidden return channel

---

## A Simple Example

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./todo.mel";

const app = createManifesto(TodoMel, {}).activate();

await app.dispatchAsync(
  app.createIntent(
    app.MEL.actions.addTodo,
    crypto.randomUUID(),
    "Ship the rewrite",
  ),
);

console.log(app.getSnapshot().data);
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
