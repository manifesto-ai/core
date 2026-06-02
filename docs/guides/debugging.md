# Debugging

> A practical checklist for understanding why a submit did not produce the snapshot you expected.

---

## Start With the Smallest Loop

When debugging Manifesto, reduce the problem to this loop:

1. Call an action helper from `app.action.*`
2. Submit it from the activated runtime
3. Observe telemetry
4. Read the next snapshot

If you can see those four steps clearly, most bugs become obvious.

---

## 1. Watch Telemetry First

Attach listeners before you submit anything:

```typescript
app.observe.event("submission:settled", (event) => {
  console.log("settled", event.action, event.outcome.kind);
});

app.observe.event("submission:rejected", (event) => {
  console.log("rejected", event.action, event.admission.code);
});

app.observe.event("submission:failed", (event) => {
  console.error("failed", event.action, event.error);
});
```

This immediately tells you which class of failure you are dealing with:

- `submission:settled`: the runtime reached a terminal result
- `submission:rejected`: availability, input validation, or an input-specific rule rejected the request before publication
- `submission:failed`: execution or settlement failed

---

## 2. Compare Snapshots Before and After

```typescript
const before = app.snapshot();
const result = await app.action.fetchUser.submit("123");

if (result.ok && result.status === "settled" && result.outcome.kind === "ok") {
  console.log("before", before.state);
  console.log("after", result.after.state);
}
```

If the snapshot did not change, ask:

- Was the submit result blocked with `ACTION_UNAVAILABLE`, `INVALID_INPUT`, or `INTENT_NOT_DISPATCHABLE`?
- Did the action become unavailable by the time it was submitted?
- Did the action stay available, but the specific input fail its input-specific rule?
- Did the selector you observed stay equal by `Object.is`?
- Did the effect handler return patches for the fields you expected?

Before you submit again, ask the runtime directly:

```typescript
const admission = app.action.fetchUser.check("123");

if (!admission.ok) {
  console.log(admission.code, admission.blockers);
}
```

`available()` answers the coarse question. `check(...input)` answers the fine
input question.

If the public Snapshot and submit result still do not explain the issue, move
to [Runtime Tooling Surface](./runtime-tooling-surface). Normal app debugging
should stay on `snapshot()` and the `result.after` Snapshot returned from
`submit()`.

---

## 3. Verify the Action Shape

The safest current path is the runtime-owned action handle:

```typescript
await app.action.fetchUser.submit("123");
```

For object-shaped actions, object-form binding is also a supported public path:

```typescript
await app.action.addTodo.submit({
  id: "todo-1",
  title: "Review docs",
});
```

That keeps app code on the typed `action.*` surface and lets the runtime pack
the input expected by the compiled action.

If you need to see exactly what the runtime thinks the action contract is,
inspect it directly:

```typescript
console.log(app.action.addTodo.info());
```

That is often faster than reconstructing the expected input shape from source.

---

## 4. Inspect Effect Handlers in Isolation

If the action declared an effect, test the handler directly.

```typescript
const patches = await effects["api.fetchUser"](
  { id: "123" },
  { snapshot: app.snapshot() },
);

console.log(patches);
```

If the returned patches are wrong, the problem is in the handler. If the patches
are right but state still does not look right, the problem is higher in the
flow.

Use `app.snapshot()` here when you want to mirror the SDK-facing effect
contract. Use the runtime tooling guide only if you are debugging hidden
runtime state.

---

## 5. Check Your Observer Logic

Remember how `observe.state()` behaves today:

- it does not emit immediately on registration
- it compares selected values with `Object.is`
- it runs after terminal snapshots, not during intermediate work

If you observe a value that does not actually change, your listener will not
fire.

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
async function debugSubmit(run: () => ReturnType<typeof app.action.fetchUser.submit>) {
  console.log("snapshot before", app.snapshot().state);

  const result = await run();
  if (result.ok && result.status === "settled" && result.outcome.kind === "ok") {
    console.log("snapshot after", result.after.state);
  } else if (!result.ok) {
    console.error("submit blocked", result.admission);
  } else {
    console.warn("domain outcome", result.outcome);
  }
}
```

This is often enough to debug an onboarding example or a failing integration
test.

---

## Common Mistakes

### Looking only at UI behavior

Start with telemetry and the app-facing Snapshot. UI bugs and domain bugs are
easier to separate once you know whether the public read model actually changed.
Move to runtime tooling only when you need hidden runtime detail.

### Debugging the whole app at once

Reduce the problem to one action and one expected snapshot transition.

### Assuming an effect returned a value directly

The handler returns patches. If the next snapshot does not contain the value,
debug the returned patches.

---

## Next

- Read [Effect Handlers](./effect-handlers) for IO issues
- Read [Re-entry Safety](./reentry-safe-flows) for duplicate work
- Read [SDK API](/api/sdk) for the current runtime surface
