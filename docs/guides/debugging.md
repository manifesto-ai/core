# Debugging

> A practical checklist for understanding why a dispatch did not produce the snapshot you expected.

---

## Start With the Smallest Loop

When debugging Manifesto, reduce the problem to this loop:

1. Create an intent
2. Dispatch it
3. Observe telemetry
4. Read the next snapshot

If you can see those four steps clearly, most bugs become obvious.

---

## 1. Watch Telemetry First

Attach listeners before you dispatch anything:

```typescript
manifesto.on("dispatch:completed", (event) => {
  console.log("completed", event.intentId, event.snapshot);
});

manifesto.on("dispatch:rejected", (event) => {
  console.log("rejected", event.intentId, event.reason);
});

manifesto.on("dispatch:failed", (event) => {
  console.error("failed", event.intentId, event.error);
});
```

This immediately tells you which class of failure you are dealing with:

- `completed`: the domain and handlers ran to a terminal snapshot
- `rejected`: a guard rejected the intent
- `failed`: effect execution or downstream processing failed

---

## 2. Compare Snapshots Before and After

```typescript
const before = manifesto.getSnapshot();
await dispatchAsync(manifesto, "fetchUser", { id: "123" });
const after = manifesto.getSnapshot();

console.log("before", before.data);
console.log("after", after.data);
```

If the snapshot did not change, ask:

- Did the action guard prevent the transition?
- Did the selector you subscribed to stay equal by `Object.is`?
- Did the effect handler return patches for the fields you expected?

---

## 3. Verify the Intent Shape

The safest beginner path is still to build intents with `createIntent()`:

```typescript
const intent = createIntent("fetchUser", { id: "123" }, crypto.randomUUID());
manifesto.dispatch(intent);
```

That avoids bugs caused by missing `intentId` or mismatched input shape.

---

## 4. Inspect Effect Handlers in Isolation

If the action declared an effect, test the handler directly.

```typescript
const patches = await effects["api.fetchUser"](
  { id: "123" },
  { snapshot: manifesto.getSnapshot() },
);

console.log(patches);
```

If the returned patches are wrong, the problem is in the handler. If the patches are right but state still does not look right, the problem is higher in the flow.

---

## 5. Check Your Subscription Logic

Remember how `subscribe()` behaves today:

- It does not emit immediately on registration
- It compares selected values with `Object.is`
- It runs after terminal snapshots, not during intermediate work

If you subscribe to a value that does not actually change, your listener will not fire.

---

## 6. Re-entry Problems Usually Look Like Duplicates

If an action appears to run more than once, look for:

- Missing `onceIntent`
- An unguarded effect declaration
- A state-driven loop that no longer changes its exit condition

Use the [Re-entry Safety](./reentry-safe-flows) guide for that class of bug.

---

## A Simple Debugging Pattern

```typescript
async function debugDispatch(type: string, input?: unknown) {
  console.log("snapshot before", manifesto.getSnapshot().data);

  try {
    const snapshot = await dispatchAsync(manifesto, type, input);
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

Start with telemetry and Snapshot. UI bugs and domain bugs are easier to separate once you know whether the snapshot actually changed.

### Debugging the whole app at once

Reduce the problem to one intent and one expected snapshot transition.

### Assuming an effect returned a value directly

The handler returns patches. If the next snapshot does not contain the value, debug the returned patches.

---

## Next

- Read [Effect Handlers](./effect-handlers) for IO issues
- Read [Re-entry Safety](./reentry-safe-flows) for duplicate work
- Read [Typed Patch Ops](./typed-patch-ops) for safer patch construction
