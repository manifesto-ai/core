# Intent

> An Intent is the low-level request object behind an action candidate.

---

## What An Intent Is

In Manifesto, you do not call domain methods that mutate state directly. You
submit an action candidate and let the runtime compute the next terminal
Snapshot.

At the protocol level, a raw `Intent` is the packed request that Core and Host
understand. In v5, ordinary application code does not need to construct that
object directly.

---

## Intent vs IntentInstance

The app path and low-level governed path use related but different inputs:

| Type | Used By | Purpose |
|------|---------|---------|
| `BoundAction` | SDK, Lineage, and Governance activated runtimes | Typed app-facing candidate for check, preview, submit, and optional raw intent access |
| `Intent` | Core/Host protocol seams and extension tooling | Packed Snapshot transition request |
| `IntentInstance` | Governance low-level helpers | Carry actor, source, and projection context before proposal orchestration |

`Intent` remains a protocol object. `IntentInstance` exists when you need to
materialize governed provenance outside the activated runtime methods.

---

## The Practical Runtime Shape

The safest path is to use action handles from the activated runtime:

```typescript
const app = createManifesto(schema, effects).activate();

const result = await app.actions.addTodo.submit(
  crypto.randomUUID(),
  "Review the docs",
);
```

Object-shaped actions bind with a single object argument:

```typescript
const result = await app.actions.addTodo.submit({
  id: crypto.randomUUID(),
  title: "Review the docs",
});
```

That keeps the public call typed while letting the runtime own canonical input
packing. Base, Lineage, and Governance all use `actions.<name>.submit(...)`;
their result unions express the active runtime law.

---

## Binding Rules

Current SDK rules are:

- zero-parameter actions: `actions.x.submit()` or `actions.x.bind()`
- single-parameter actions: `actions.x.submit(value)` or `actions.x.bind(value)`
- multi-parameter actions with positional metadata: `actions.x.submit(...args)` or `actions.x.bind(...args)`
- hand-authored multi-field object inputs without positional metadata: use one object argument

`BoundAction.input` preserves the public shape:

- `undefined` for zero-parameter actions
- the single value for single-parameter actions
- a readonly tuple for multi-parameter actions

---

## Raw Intent Escape Hatch

Use `bind(...).intent()` only when a bridge, extension, or protocol test needs
the packed raw shape:

```typescript
const candidate = app.actions.addTodo.bind("Review the docs");
const intent = candidate.intent();
```

If the candidate input is not valid, `intent()` returns `null`.

---

## The Governed Shape

Use `createIntentInstance()` when you need actor identity, source metadata, or a
service-level governed proposal path:

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

The decorator runtime usually creates proposal metadata for you. Reach for
`IntentInstance` when you are working below that runtime boundary.

---

## Why `intentId` Matters

Raw intents use `intentId` to correlate lower-level lifecycle events and stored
records. Most app code observes the v5 event surface instead:

- `submission:admitted`
- `submission:rejected`
- `submission:submitted`
- `submission:settled`
- `submission:failed`

---

## Intent Versus Command

An Intent is not "do this imperative step right now." It is "this is the
requested transition."

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

await app.actions.addTodo.submit({
  id: crypto.randomUUID(),
  title: "Ship the rewrite",
});

console.log(app.snapshot().state);
```

---

## Common Mistakes

### Treating the intent like the result

The intent is the request. The snapshot is the result.

### Starting with raw Intent construction

You can get the object through `bind(...).intent()` when you need it, but action
candidates are the safer and clearer path for current SDK usage.

### Assuming `submit()` returns a hidden business payload

`submit()` returns a runtime result union. It does not bypass Snapshot-first
semantics or hand you raw effect results directly.

---

## See Also

- [Tutorial](/tutorial/) for the first end-to-end examples
- [Effect](./effect) for what happens when an action declares external work
- [World Records and Governed Composition](./world) for lineage records and governed runtime composition
