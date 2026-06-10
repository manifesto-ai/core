# Effect

> An effect is a declared piece of work that happens outside ordinary patch evaluation.

---

## Two Things Called "Effect"

Manifesto uses the word in two closely related ways:

1. an effect declaration in MEL
2. an effect handler in TypeScript

The declaration lives in the domain. The handler lives in runtime configuration.

---

## In MEL

```mel
action fetchUser(id: string) {
  onceIntent {
    patch loading = true
    effect api.fetchUser({ id: id })
  }
}
```

This says: "when this action runs, declare the `api.fetchUser` requirement."

It does not execute the fetch inline inside the domain.

---

## In TypeScript

```typescript
import { defineEffects } from "@manifesto-ai/sdk/effects";

export const effects = defineEffects(({ set }, refs) => ({
  "api.fetchUser": async (params) => {
    const { id } = params as { id: string };
    const response = await fetch(`https://example.com/users/${id}`);
    const user = await response.json();

    return [
      set(refs.state.user, user),
      set(refs.state.loading, false),
    ];
  },
}));
```

The handler performs IO and returns patches that become part of the next snapshot.

---

## The Same Effect Model When You Add Review

The base runtime and the later approval/history runtime use the same effect contract:

- effect declarations still live in MEL
- handlers still return patches
- the next Snapshot still carries the visible result

Review and history change who can reach the execution step and when the result is
published. They do not change what an effect handler looks like or how it
reports its result.

---

## Effects Update Snapshot Through Patches

This is the key idea:

- effects do not return values to your action body
- effects do not mutate hidden runtime state
- effects return patches
- the next snapshot carries the visible result

That keeps UI, tests, scripts, and AI agents on the same truth.

---

## Pure Snapshot Array Updates

For normal state-only array updates, prefer expression-level `map()` and
`filter()` in a `patch` statement:

```mel
patch todos = filter(todos, !$item.completed)
```

Reserve named effects for work that crosses a process boundary, such as API,
database, queue, storage, or model calls.

---

## Common Mistakes

### Expecting `submit()` to give you the effect result

The result is visible in the next snapshot, not as a direct business return value from `submit()`.

### Throwing away status fields

If consumers need `loading`, `error`, or retry context, keep them in the domain state.

### Treating handlers as free-form side effects

Handlers should still return a precise patch story. That is what makes the system debuggable.

---

## See Also

- [Effect Handlers](/guides/effect-handlers) for the implementation guide
- [Debugging](/guides/debugging) for troubleshooting effect-driven flows
- [When You Need Approval or History](/guides/approval-and-history) before adding review, audit history, or restore
