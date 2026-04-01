# Re-entry Safety

> Prevent the same action or effect from running more than once for a single intent.

---

## Why Re-entry Happens

Manifesto actions participate in a compute loop. If an action stays eligible while the loop revisits it, patches or effects can repeat.

That is why the beginner default is:

```mel
action submit() {
  onceIntent {
    effect api.submit({})
  }
}
```

`onceIntent` is the easiest safe default for one-shot work.

---

## The Unsafe Version

```mel
action submit() {
  effect api.submit({})
}
```

This action has no marker and no exit condition. If the loop revisits it, the effect can be declared again.

---

## The Safe Version

```mel
action submit() {
  onceIntent {
    patch status = "submitting"
    effect api.submit({})
  }
}
```

Now the work is tied to a single intent.

---

## Use State Guards for Repeatable Workflows

Not every action is one-shot forever. Some actions are repeatable, but only when state says they should run.

```mel
action retry() available when eq(status, "error") {
  onceIntent {
    patch status = "loading"
    patch error = null
    effect api.fetchUser({ id: requestedId })
  }
}
```

This action is safe because:

- the domain only exposes it when retry makes sense
- each retry attempt is still guarded per intent

---

## Pure Array Effects Are Still Part of the Flow

Inline array operations should also live inside guards:

```mel
action clearCompleted() {
  onceIntent {
    effect array.filter({
      source: todos,
      where: eq($item.completed, false),
      into: todos
    })
  }
}
```

They are pure, but they are still part of the same action flow.

---

## How to Test for Re-entry Bugs

Dispatch the same action more than once and inspect the resulting snapshot:

```typescript
const first = world.createIntent(world.MEL.actions.submit);
const second = world.createIntent(world.MEL.actions.submit);

await world.dispatchAsync(first);
await world.dispatchAsync(second);

const snapshot = world.getSnapshot();
console.log(snapshot.data);
```

Then ask:

- Did the second dispatch intentionally do new work?
- Did the same effect fire twice for one intent?
- Did the snapshot end in a stable state?

---

## Common Traps

### Unguarded patches

```mel
action increment() {
  patch count = add(count, 1)
}
```

### Unguarded effects

```mel
action load() {
  effect api.fetch({})
}
```

### State that never leaves the triggering condition

If an action depends on `status == "loading"` and you never transition out of that state, the flow can keep re-triggering.

---

## Practical Rule of Thumb

Start with `onceIntent`. Remove it only when you can explain:

- why repeat execution is correct
- what state condition controls the repetition
- what makes the loop terminate

If you cannot explain those three points clearly, keep the guard.

---

## Next

- Read [Debugging](./debugging) if you need help spotting duplicate work
- Read [Effect Handlers](./effect-handlers) if repeated effects are causing inconsistent data
