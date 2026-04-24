# Intent

> An Intent is a request to move the domain from one Snapshot to the next.

---

## What An Intent Is

In Manifesto, you do not call domain methods that mutate state directly. You submit an `Intent` and let the runtime compute the next terminal Snapshot.

At the runtime level, an intent is the unit that goes into `dispatchAsync(intent)`. The same typed intent also flows through lineage `commitAsync(intent)` and governance `proposeAsync(intent)`.

---

## Intent vs IntentInstance

The direct-dispatch path and the governed path use related but different inputs:

| Type | Used By | Purpose |
|------|---------|---------|
| `Intent` | `@manifesto-ai/sdk`, `@manifesto-ai/lineage`, governed activated runtimes | Request a typed Snapshot transition |
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

Parameterized actions also support a single object argument when you want to bind by field name instead of position:

```typescript
const intent = app.createIntent(app.MEL.actions.addTodo, {
  id: crypto.randomUUID(),
  title: "Review the docs",
});
```

Then dispatch it:

```typescript
await app.dispatchAsync(intent);
```

That keeps the `intentId` stable while avoiding stringly-typed public calls.
Lineage and governance keep the same typed intent object while promoting the runtime verb to `commitAsync()` and `proposeAsync()`.

---

## Binding rules

Current SDK rules are:

- zero-parameter actions: `createIntent(action)`
- single-parameter actions: `createIntent(action, value)`; keyed object binding is also supported when the single parameter is not itself object-like
- multi-parameter actions with positional metadata: `createIntent(action, ...args)` or `createIntent(action, { ...params })`
- hand-authored multi-field object inputs without positional metadata: prefer `createIntent(action, { ...params })`

The runtime still owns the canonical `Intent.input` packing step.

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
  app.createIntent(app.MEL.actions.addTodo, {
    id: crypto.randomUUID(),
    title: "Ship the rewrite",
  }),
);

console.log(app.getSnapshot().data);
```

---

## Common Mistakes

### Treating the intent like the result

The intent is the request. The snapshot is the result.

### Skipping `createIntent()`

You can construct the object yourself, but `createIntent()` is the safer and clearer path for current SDK usage.

### Assuming `dispatchAsync()` gives you anything other than the next terminal snapshot

`dispatchAsync()` resolves with the next terminal snapshot. It does not bypass Snapshot-first semantics or hand you raw effect results directly.

---

## See Also

- [Tutorial](/tutorial/) for the first end-to-end examples
- [Effect](./effect) for what happens when an action declares external work
- [World Records and Governed Composition](./world) for lineage records and governed runtime composition
