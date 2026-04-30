# Effect Handlers

> Fulfill declared effects and return patches for the next snapshot.

---

## When to Read This

Read this guide when your MEL domain declares an effect such as:

```mel
action fetchUser(id: string) {
  onceIntent {
    patch loading = true
    effect api.fetchUser({ id: id })
  }
}
```

At that point you need to register a handler in `createManifesto(schema, effects)`.

---

## The Current Contract

An SDK effect handler looks like this:

```typescript
type EffectHandler = (
  params: unknown,
  ctx: { readonly snapshot: Readonly<Snapshot> },
) => Promise<readonly Patch[]>;
```

The rules are simple:

- Read what you need from `params`
- Optionally inspect `ctx.snapshot`
- Perform IO
- Return patches

Do not return raw values. Do not rely on a hidden callback channel.

---

## A Minimal Example

```typescript
import { defineEffects } from "@manifesto-ai/sdk/effects";
import type { UserProfileDomain } from "./user-profile-types";

export const effects = defineEffects<UserProfileDomain>(({ set, unset }, MEL) => ({
  "api.fetchUser": async (params) => {
    const { id } = params as { id: string };

    try {
      const response = await fetch(`https://example.com/users/${id}`);
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const user = await response.json();

      return [
        set(MEL.state.user, user),
        set(MEL.state.loading, false),
        unset(MEL.state.error),
      ];
    } catch (error) {
      return [
        set(MEL.state.loading, false),
        set(
          MEL.state.error,
          error instanceof Error ? error.message : "Unknown error",
        ),
      ];
    }
  },
}));
```

Register it:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import DomainMel from "./domain.mel";
import { effects } from "./effects";

const manifesto = createManifesto(DomainMel, effects);
```

`defineEffects()` is only an authoring helper. Each handler still returns concrete `Patch[]`, and raw patch literals are still valid when you want the low-level surface.

## Low-Level Raw Patch Form

```typescript
import type { EffectHandler } from "@manifesto-ai/sdk";

export const effects = {
  "api.fetchUser": async (params) => {
    const { id } = params as { id: string };
    const user = await fetchUser(id);

    return [
      { op: "set", path: [{ kind: "prop", name: "user" }], value: user },
      { op: "set", path: [{ kind: "prop", name: "loading" }], value: false },
      { op: "unset", path: [{ kind: "prop", name: "error" }] },
    ];
  },
} satisfies Record<string, EffectHandler>;
```

---

## What a Good Handler Usually Writes

Most handlers patch some combination of:

- The fetched or created value
- A loading flag
- A recoverable error message
- Retry context, such as the last requested id

That keeps the result visible to every consumer of the snapshot.

---

## Using `ctx.snapshot`

The snapshot context is useful when the effect depends on current state:

```typescript
const effects = {
  "api.saveDraft": async (_params, ctx) => {
    const draft = ctx.snapshot.state.draft as { title: string; body: string };

    try {
      await saveDraftToApi(draft);
      return [
        { op: "set", path: [{ kind: "prop", name: "saveStatus" }], value: "saved" },
      ];
    } catch (error) {
      return [
        { op: "set", path: [{ kind: "prop", name: "saveStatus" }], value: "error" },
      ];
    }
  },
} satisfies Record<string, EffectHandler>;
```

The handler still returns patches. The snapshot is input, not mutable shared state.

---

## Testing a Handler

You can test an effect handler directly because it is just an async function:

```typescript
import { describe, expect, it, vi } from "vitest";
import type { Snapshot } from "@manifesto-ai/sdk";
import { effects } from "./effects";

describe("api.fetchUser", () => {
  it("returns patches for the success path", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "123", name: "Ada" }),
    }) as typeof fetch;

    const snapshot = {
      data: { loading: true, user: null, error: null },
    } as Snapshot;

    const patches = await effects["api.fetchUser"]({ id: "123" }, { snapshot });

    expect(patches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "set" }),
      ]),
    );
  });
});
```

---

## Common Mistakes

### Returning a value instead of patches

This is wrong:

```typescript
return user;
```

### Throwing recoverable business errors out of the handler

Translate recoverable failures into patches so the domain can show them in Snapshot.

### Hiding status outside the domain

If the UI needs `loading`, `saved`, or `error`, patch those values into state.

### Writing overly broad patches

Patch only the state you intend to change. It keeps handlers easier to review and easier to test.

---

## Next

- Read [Debugging](./debugging) if an effect is not behaving the way you expect
