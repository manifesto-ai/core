# Effects

> Effects declare external work; effect handlers fulfill it and return patches.

MEL actions do not fetch, write databases, call APIs, or send messages
directly. A MEL action declares external work, then the activated runtime calls
the handler you registered.

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

Start with a named effect when the work crosses a process boundary. For array
updates that stay inside Snapshot, use `patch todos = map(...)` or
`patch todos = filter(...)` as shown in the state tutorials.

## Register a Handler

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { defineEffects } from "@manifesto-ai/sdk/effects";
import UserProfileMel from "./user-profile.mel";

async function fetchUser(id: string) {
  return { id, name: id === "123" ? "Ada" : "Unknown User" };
}

const effects = defineEffects(({ set }, refs) => ({
  "api.fetchUser": async (params) => {
    const { id } = params as { id: string };
    const user = await fetchUser(id);

    return [
      set(refs.state.userName, user.name),
      set(refs.state.loading, false),
    ];
  },
}));

const app = createManifesto(UserProfileMel, effects).activate();
```

Handlers return patches. The next Snapshot carries the visible result.

This form works before you add generated TypeScript facades. When you later
enable code generation, pass the generated domain shape to `defineEffects<...>()`
for stronger field autocomplete.

If a handler fetches data, patch the fetched data into domain state. If the UI
needs `loading`, `error`, `saved`, or retry state, patch those fields too.

## Where To Put Handlers

For a script or local browser demo, keep `effects.ts` beside the runtime module.
For a UI plus agent app, keep `effects.ts` on the server side with the shared
runtime:

```text
src/
  server/
    effects.ts
    manifesto-app.ts
    todo-actions.ts
    todo-agent-tools.ts
```

React components and agent tools should submit actions, not call effect handlers
directly. The effect result becomes visible when the handler returns patches and
the next Snapshot is published.

## Common Mistake

Do not `return user` from the handler. Return precise patches for the domain state that should change.

## Next

For a deeper handler guide, read [Effect Handlers](/guides/effect-handlers).
For the broader MEL effect reference, read [MEL Syntax: Effects](/mel/SYNTAX#effects).
Return to [Web App + Agent](/integration/web-app-and-agent) when UI and agent
writes must share one server runtime.
