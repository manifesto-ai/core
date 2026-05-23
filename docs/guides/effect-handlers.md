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

At that point you need to register a handler when you activate the MEL domain:
`createManifesto(DomainMel, effects)`.

For a script or browser-only demo, `effects.ts` can sit next to
`manifesto-app.ts`. For a web app plus agent, keep effects in the same
server-side runtime used by both surfaces:

```text
src/
  domain/
    todo.mel
  server/
    effects.ts
    manifesto-app.ts
    todo-actions.ts
    todo-agent-tools.ts
```

React and agent tools should not call effect handlers directly. They submit
actions. The runtime invokes the matching handler, applies returned patches, and
then both surfaces read the next Snapshot.

---

## Handler Shape

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

async function fetchUser(id: string) {
  // Replace this with fetch(), a database call, or a model call in your app.
  return { id, name: id === "123" ? "Ada" : "Unknown User" };
}

export const effects = defineEffects(({ set }, refs) => ({
  "api.fetchUser": async (params) => {
    const { id } = params as { id: string };

    try {
      const user = await fetchUser(id);

      return [
        set(refs.state.user, user),
        set(refs.state.loading, false),
        set(refs.state.error, null),
      ];
    } catch (error) {
      return [
        set(refs.state.loading, false),
        set(
          refs.state.error,
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

const app = createManifesto(DomainMel, effects).activate();
```

This plain form works before you add generated TypeScript facades. When you
later enable code generation, pass the generated domain shape to
`defineEffects<...>()` for stronger `refs.state.*` autocomplete.

`defineEffects()` is the recommended app-facing authoring helper. Stay with it
until you need low-level runtime tests or adapter code.

## Where Effects Fit With UI And Agents

The same effect result should be visible to every caller through Snapshot:

```text
React UI -> server action -> app.action.saveDraft.submit()
                                      |
                                      v
                              effect api.saveDraft
                                      |
                                      v
Agent tool <- fresh context <- returned patches <- handler IO
```

Put product rules in MEL actions and `available when` / `dispatchable when`
guards. Put IO details in the handler. That split keeps a human UI, a server
route, and an agent tool from each inventing separate save/error semantics.

Example server boundary:

```typescript
// src/server/manifesto-app.ts
import { createManifesto } from "@manifesto-ai/sdk";

import TodoMel from "../domain/todo.mel";
import { effects } from "./effects";

export const app = createManifesto(TodoMel, effects).activate();

export function readContext() {
  const snapshot = app.snapshot();

  return {
    state: snapshot.state,
    computed: snapshot.computed,
    availableActions: app.inspect.availableActions(),
  };
}
```

App-owned action functions can then return fresh context after writes:

```typescript
// src/server/todo-actions.ts
import { app, readContext } from "./manifesto-app";

export async function saveDraft(title: string) {
  const result = await app.action.saveDraft.submit(title);

  return {
    status: result.ok
      ? result.outcome.kind === "ok" ? "settled" : result.outcome.kind
      : "admission_blocked",
    context: readContext(),
  };
}
```

The UI and agent can both call `saveDraft()` through their own adapters. Neither
side needs to know whether the effect handler used `fetch()`, a database client,
or a model provider.

## Advanced Raw Patch Form

Skip this section on the first pass. It shows the lower-level shape that
`defineEffects()` helps you avoid writing by hand.

```typescript
import type { EffectHandler } from "@manifesto-ai/sdk";

export const effects = {
  "api.fetchUser": async (params) => {
    const { id } = params as { id: string };
    const user = await fetchUser(id);

    return [
      { op: "set", path: [{ kind: "prop", name: "user" }], value: user },
      { op: "set", path: [{ kind: "prop", name: "loading" }], value: false },
      { op: "set", path: [{ kind: "prop", name: "error" }], value: null },
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
import { describe, expect, it } from "vitest";
import type { Snapshot } from "@manifesto-ai/sdk";
import { effects } from "./effects";

describe("api.fetchUser", () => {
  it("returns patches for the success path", async () => {
    const snapshot = {
      state: { loading: true, user: null, error: null },
      computed: {},
      system: {
        status: "idle",
        lastError: null,
        pendingRequirements: [],
        currentAction: null,
      },
      input: null,
      meta: {
        version: 0,
        timestamp: 0,
        randomSeed: "test-seed",
        schemaHash: "test-schema",
      },
      namespaces: {},
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
