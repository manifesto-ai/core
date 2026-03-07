# Effect

> An effect is a declared piece of work that happens outside ordinary patch evaluation.

---

## Two Things Called "Effect"

Manifesto uses the word in two closely related ways:

1. An effect declaration in MEL
2. An effect handler in TypeScript

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

This says: “when this action runs, declare the `api.fetchUser` requirement.”

It does not execute the fetch inline inside the domain.

---

## In TypeScript

```typescript
import type { EffectHandler } from "@manifesto-ai/sdk";

export const effects = {
  "api.fetchUser": async (params) => {
    const { id } = params as { id: string };
    const response = await fetch(`https://example.com/users/${id}`);
    const user = await response.json();

    return [
      { op: "set", path: [{ kind: "prop", name: "user" }], value: user },
      { op: "set", path: [{ kind: "prop", name: "loading" }], value: false },
    ];
  },
} satisfies Record<string, EffectHandler>;
```

The handler performs IO and returns patches that become part of the next snapshot.

---

## Effects Update Snapshot Through Patches

This is the key idea:

- Effects do not return values to your action body
- Effects do not mutate hidden runtime state
- Effects return patches
- The next snapshot carries the visible result

That keeps UI, tests, scripts, and AI agents on the same truth.

---

## A Special Case: Pure Array Effects

Some effect-like flow nodes are pure array transforms and can run inline in Core:

```mel
effect array.filter({
  source: todos,
  where: eq($item.completed, false),
  into: todos
})
```

These are still declared in flow form, but they do not require a user-supplied network or database handler.

---

## Common Mistakes

### Expecting `await dispatch()` to give you the effect result

The result is visible in the next snapshot, not as a direct return value from `dispatch()`.

### Throwing away status fields

If consumers need `loading`, `error`, or retry context, keep them in the domain state.

### Treating handlers as free-form side effects

Handlers should still return a precise patch story. That is what makes the system debuggable.

---

## See Also

- [Effect Handlers](/guides/effect-handlers) for the implementation guide
- [Debugging](/guides/debugging) for troubleshooting effect-driven flows
