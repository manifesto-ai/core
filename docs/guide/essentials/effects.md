# Effects

> Effects declare external work; effect handlers fulfill it and return patches.

Core does not fetch, write databases, call APIs, or send messages. A MEL action declares an effect requirement, then the activated runtime calls the handler you registered.

## Declare an Effect

```mel
domain UserProfile {
  state {
    userName: string | null = null
    loading: boolean = false
  }

  action fetchUser(id: string) {
    onceIntent {
      patch loading = true
      effect api.fetchUser({ id: id })
    }
  }
}
```

The effect type is the name after `effect`. In this example, the type is `api.fetchUser`.

## Which Effect Should I Use?

| Need | Use | Runtime Behavior |
|------|-----|------------------|
| Call an API, database, queue, storage layer, or model | your own named effect such as `api.fetchUser`, `db.saveTodo`, `agent.summarize` | Register a TypeScript handler with the same effect type |
| Update each item in an array from existing Snapshot data | `effect array.map({ source, select, into })` | Pure runtime transform; no network handler |
| Keep only matching array items from existing Snapshot data | `effect array.filter({ source, where, into })` | Pure runtime transform; no network handler |

Start with a named effect when the work crosses a process boundary. Start with `array.map` or `array.filter` when you are transforming an array already in Snapshot.

## Register a Handler

```typescript
import { defineEffects } from "@manifesto-ai/sdk/effects";
import type { UserProfileDomain } from "./user-profile-types";

const app = createManifesto(UserProfileSchema, defineEffects<UserProfileDomain>(({ set }, MEL) => ({
  "api.fetchUser": async (params) => {
    const { id } = params as { id: string };
    const user = await fetchUser(id);

    return [
      set(MEL.state.userName, user.name),
      set(MEL.state.loading, false),
    ];
  },
}))).activate();
```

Handlers return patches. The next Snapshot carries the visible result.

## Low-Level Patch Ops Returned by Handlers

`defineEffects()` still lowers to concrete `Patch[]`. If you want the low-level form directly, use the smallest raw patch that describes the visible result:

| Patch op | Use When | Example |
|----------|----------|---------|
| `set` | Replace a value, or create it when missing | `{ op: "set", path: [{ kind: "prop", name: "userName" }], value: "Ada" }` |
| `unset` | Remove a property from domain state | `{ op: "unset", path: [{ kind: "prop", name: "error" }] }` |
| `merge` | Shallow-merge fields into an object | `{ op: "merge", path: [{ kind: "prop", name: "profile" }], value: { name: "Ada" } }` |

If a handler fetches data, patch the fetched data into domain state. If the UI needs `loading`, `error`, `saved`, or retry context, patch those fields too.

## Array Transform Example

```mel
action completeTodo(id: string) {
  onceIntent {
    effect array.map({
      source: todos,
      select: $item.id == id ? { ...$item, completed: true } : $item,
      into: todos
    })
  }
}
```

Use `$item` inside `select` or `where` to refer to the current array item.

## Common Mistake

Do not `return user` from the handler. Return precise patches for the domain state that should change.

## Next

Learn how to expose or hide actions with [Availability](./availability). For a deeper handler guide, read [Effect Handlers](/guides/effect-handlers). For the broader MEL effect reference, read [MEL Syntax: Effects](/mel/SYNTAX#effects).
