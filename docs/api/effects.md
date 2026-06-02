# Effects

> SDK effect handlers fulfill declared MEL effects and return patches.

## Builder-First Authoring

Use `defineEffects()` for normal app code. It gives handlers top-level
`refs.state.*` refs while keeping the runtime contract unchanged.

```typescript
import { defineEffects } from "@manifesto-ai/sdk/effects";

async function fetchUser(id: string) {
  return { id, name: id === "123" ? "Ada" : "Unknown User" };
}

const effects = defineEffects(({ set }, refs) => ({
  "api.fetchUser": async (params) => {
    const { id } = params as { id: string };
    const user = await fetchUser(id);

    return [
      set(refs.state.user, user),
      set(refs.state.loading, false),
      set(refs.state.error, null),
    ];
  },
}));
```

In normal typed apps, pass the generated domain facade as the generic so
`refs.state.*` autocomplete follows the same `.mel` file as the runtime. For a
one-file no-build experiment, you can omit the generic temporarily.

Register handlers before activation:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import schema from "./domain.mel";

const app = createManifesto(schema, effects).activate();
```

`defineEffects()` is an SDK authoring helper only. The returned value is still
`Record<string, EffectHandler>`, and each handler still returns concrete
`Patch[]`.

## Handler Contract

An SDK effect handler receives effect params and an app-facing Snapshot context.
The raw handler type is useful for adapters, tests, and low-level code.

```typescript
import type { EffectHandler } from "@manifesto-ai/sdk";

const effects = {
  "api.fetchUser": async (params) => {
    const { id } = params as { id: string };
    const user = await fetchUser(id);

    return [
      { op: "set", path: [{ kind: "prop", name: "user" }], value: user },
    ];
  },
} satisfies Record<string, EffectHandler>;
```

## Low-Level Raw Patch Form

If you need the low-level surface directly, raw patch literals remain supported.

```typescript
const effects = {
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

| Op | Meaning |
|----|---------|
| `set` | Replace the value at path |
| `unset` | Remove the property at path |
| `merge` | Shallow-merge object fields at path |

Do not return fetched values directly. Put the result in Snapshot with patches.

## Error Values

Catch recoverable IO errors in the handler and patch domain state.

```typescript
catch (error) {
  return [
    { op: "set", path: [{ kind: "prop", name: "loading" }], value: false },
    {
      op: "set",
      path: [{ kind: "prop", name: "error" }],
      value: error instanceof Error ? error.message : "Unknown error",
    },
  ];
}
```

## Next

- Learn the Guide version in [Effects](/guide/essentials/effects)
- Read the deeper guide in [Effect Handlers](/guides/effect-handlers)
- Review low-level host behavior in [@manifesto-ai/host](./host)
