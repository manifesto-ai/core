# Debugging

> A practical checklist for understanding why a dispatch did not produce the snapshot you expected.

---

## Start With the Smallest Loop

When debugging Manifesto, reduce the problem to this loop:

1. Create an intent from `instance.MEL.actions.*`
2. Dispatch it from the activated runtime
3. Observe telemetry
4. Read the next snapshot

If you can see those four steps clearly, most bugs become obvious.

---

## 1. Watch Telemetry First

Attach listeners before you dispatch anything:

```typescript
instance.on("dispatch:completed", (event) => {
  console.log("completed", event.intentId, event.snapshot);
});

instance.on("dispatch:rejected", (event) => {
  console.log("rejected", event.intentId, event.code, event.reason);
});

instance.on("dispatch:failed", (event) => {
  console.error("failed", event.intentId, event.error);
});
```

This immediately tells you which class of failure you are dealing with:

- `completed`: the domain and handlers ran to a terminal snapshot
- `rejected`: availability or dispatchability rejected the intent before publication
  - `ACTION_UNAVAILABLE`: the coarse action gate failed
  - `INTENT_NOT_DISPATCHABLE`: the action stayed available, but the bound intent failed the fine gate
- `failed`: effect execution or downstream processing failed

---

## 2. Compare Snapshots Before and After

```typescript
const intent = instance.createIntent(instance.MEL.actions.fetchUser, "123");
const before = instance.getSnapshot();
const beforeCanonical = instance.getCanonicalSnapshot();
const after = await instance.dispatchAsync(intent);
const afterCanonical = instance.getCanonicalSnapshot();

console.log("before", before.data);
console.log("after", after.data);
console.log("before canonical", beforeCanonical.system.pendingRequirements);
console.log("after canonical", afterCanonical.system.pendingRequirements);
```

If the snapshot did not change, ask:

- What `dispatch:rejected` code was emitted: `ACTION_UNAVAILABLE` or `INTENT_NOT_DISPATCHABLE`?
- Did the action become unavailable by the time it was dequeued?
- Did the action stay available, but the specific bound intent fail dispatchability?
- Did the selector you subscribed to stay equal by `Object.is`?
- Did the effect handler return patches for the fields you expected?

Before you queue the intent again, ask the runtime directly:

```typescript
console.log(
  instance.isIntentDispatchable(instance.MEL.actions.fetchUser, "123"),
);

console.log(
  instance.getIntentBlockers(instance.MEL.actions.fetchUser, "123"),
);
```

`getAvailableActions()` and `isActionAvailable()` answer the coarse question. `isIntentDispatchable()` and `getIntentBlockers()` answer the fine bound-intent question.

---

## 3. Verify the Intent Shape

The safest current path is the runtime-owned `createIntent()` method hanging off the activated instance:

```typescript
const intent = instance.createIntent(instance.MEL.actions.fetchUser, "123");
await instance.dispatchAsync(intent);
```

For parameterized actions, object-form binding is also a supported public path:

```typescript
const intent = instance.createIntent(instance.MEL.actions.addTodo, {
  id: "todo-1",
  title: "Review docs",
});
await instance.dispatchAsync(intent);
```

That keeps app code on the typed `MEL.actions.*` surface and lets the runtime pack the canonical object-shaped input expected by the compiled action.

If you need to see exactly what the runtime thinks the action contract is, inspect it directly:

```typescript
console.log(instance.getActionMetadata("addTodo"));
```

That is often faster than reconstructing the expected input shape from source.

---

## 4. Inspect Effect Handlers in Isolation

If the action declared an effect, test the handler directly.

```typescript
const patches = await effects["api.fetchUser"](
  { id: "123" },
  { snapshot: instance.getSnapshot() },
);

console.log(patches);
```

If the returned patches are wrong, the problem is in the handler. If the patches are right but state still does not look right, the problem is higher in the flow.

Use `instance.getSnapshot()` here when you want to mirror the SDK-facing effect contract. Use `instance.getCanonicalSnapshot()` separately only if you are debugging hidden host/runtime state.

---

## 5. Check Your Subscription Logic

Remember how `subscribe()` behaves today:

- it does not emit immediately on registration
- it compares selected values with `Object.is`
- it runs after terminal snapshots, not during intermediate work

If you subscribe to a value that does not actually change, your listener will not fire.

---

## 6. Re-entry Problems Usually Look Like Duplicates

If an action appears to run more than once, look for:

- missing `onceIntent`
- an unguarded effect declaration
- a state-driven loop that no longer changes its exit condition

Use the [Re-entry Safety](./reentry-safe-flows) guide for that class of bug.

---

## A Simple Debugging Pattern

```typescript
async function debugDispatch(makeIntent: () => ReturnType<typeof instance.createIntent>) {
  console.log("snapshot before", instance.getSnapshot().data);

  try {
    const snapshot = await instance.dispatchAsync(makeIntent());
    console.log("snapshot after", snapshot.data);
  } catch (error) {
    console.error("dispatch failed", error);
  }
}
```

This is often enough to debug an onboarding example or a failing integration test.

---

## Common Mistakes

### Looking only at UI behavior

Start with telemetry and the projected Snapshot. UI bugs and domain bugs are easier to separate once you know whether the public read model actually changed. Escalate to `getCanonicalSnapshot()` only when you need hidden runtime detail.

### Debugging the whole app at once

Reduce the problem to one intent and one expected snapshot transition.

### Assuming an effect returned a value directly

The handler returns patches. If the next snapshot does not contain the value, debug the returned patches.

---

## Next

- Read [Effect Handlers](./effect-handlers) for IO issues
- Read [Re-entry Safety](./reentry-safe-flows) for duplicate work
- Read [SDK API](/api/sdk) for the current activation-first runtime surface
