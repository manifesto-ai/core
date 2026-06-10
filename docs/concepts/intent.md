# Intent

> An Intent is the low-level request object behind an action submission.

---

## What An Intent Is

In Manifesto, you do not call domain methods that mutate state directly. You
submit an action and let the runtime compute the next terminal
Snapshot.

```typescript
const result = await app.action.addTodo.submit("Review the docs");
```

A raw `Intent` is the packed request that the lower runtime layers understand.
Ordinary application code does not need to construct that object directly.

---

## The Practical Runtime Shape

The safest path is to use action handles from the activated runtime:

```typescript
const app = createManifesto(schema, effects).activate();

const result = await app.action.addTodo.submit("Review the docs");
```

Object-shaped actions bind with a single object argument:

```typescript
const result = await app.action.configureProject.submit({
  label: "Docs",
  reviewRequired: true,
});
```

That keeps the public call typed while letting the runtime pack the input for
lower layers. Base, Lineage, and Governance all use
`action.<name>.submit(...)`; their result unions express the active runtime
mode.

---

## Binding Rules

Current SDK rules are:

- zero-parameter actions: `action.x.submit()` or `action.x.bind()`
- single-parameter actions: `action.x.submit(value)` or `action.x.bind(value)`
- multi-parameter actions with positional metadata: `action.x.submit(...args)` or `action.x.bind(...args)`
- hand-authored multi-field object inputs without positional metadata: use one object argument

`BoundAction.input` preserves the public shape:

- `undefined` for zero-parameter actions
- the single value for single-parameter actions
- a readonly tuple for multi-parameter actions

---

## Low-Level Escape Hatches

Skip this section while learning the app path. Use it when you are building a
runtime bridge, extension, low-level test, or approval/history service helper.

The app path and low-level approval/history path use related but different inputs:

| Type | Used By | Purpose |
|------|---------|---------|
| `BoundAction` | SDK, Lineage, and Governance activated runtimes | Typed app-facing action for check, preview, submit, and optional raw intent access |
| `Intent` | Core/Host seams and extension tooling | Packed Snapshot transition request |
| `IntentInstance` | Governance low-level helpers | Carry actor and source context before proposal handling |

`Intent` remains a low-level object. `IntentInstance` exists when you need to
build proposal metadata outside the activated runtime methods.

---

## Raw Intent Escape Hatch

Use `bind(...).intent()` only when a bridge, extension, or low-level test needs
the packed raw shape:

```typescript
const candidate = app.action.addTodo.bind("Review the docs");
const intent = candidate.intent();
```

If the candidate input is not valid, `intent()` returns `null`.

---

## Optional Approval Shape

Use `createIntentInstance()` when you need actor identity, source metadata, or a
service-level proposal path:

```typescript
import { createIntentInstance } from "@manifesto-ai/governance";

const intentInstance = await createIntentInstance({
  body: {
    type: "configureProject",
    input: { label: "Docs", reviewRequired: true },
  },
  schemaHash: "todo-v1",
  projectionId: "todo-ui",
  source: { kind: "agent", eventId: "evt-1" },
  actor: { actorId: "user-1", kind: "human" },
});
```

The decorator runtime usually creates proposal metadata for you. Reach for
`IntentInstance` only when you are working below the normal runtime methods.

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

await app.action.addTodo.submit("Ship the rewrite");

console.log(app.snapshot().state);
```

---

## Common Mistakes

### Treating the intent like the result

The intent is the request. The snapshot is the result.

### Starting with raw Intent construction

You can get the object through `bind(...).intent()` when you need it, but action
handles are the safer and clearer path for current SDK usage.

### Assuming `submit()` returns a hidden business payload

`submit()` returns a runtime result union. It does not bypass Snapshot-first
state or hand you raw effect results directly.

---

## See Also

- [Tutorial](/tutorial/) for the first end-to-end examples
- [Effect](./effect) for what happens when an action declares external work
- [When You Need Approval or History](/guides/approval-and-history) before adding review, audit history, or restore
