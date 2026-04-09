# Effects

> SDK effect handlers fulfill declared MEL effects and return patches.

## Handler Contract

```typescript
import type { EffectHandler } from "@manifesto-ai/sdk";

type Handler = EffectHandler;
```

An SDK effect handler receives effect params and a projected Snapshot context.

```typescript
const effects = {
  "api.fetchUser": async (params, ctx) => {
    console.log(params);
    console.log(ctx.snapshot.data);

    return [];
  },
} satisfies Record<string, EffectHandler>;
```

Register handlers before activation:

```typescript
const app = createManifesto(schema, effects).activate();
```

## Return Patches

Handlers return core patches. Patch paths are structured and rooted at domain state.

```typescript
const effects = {
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
