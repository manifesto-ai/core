# Working with Effects

> Add API, database, model, or queue IO after the first app path works.

---

## What You'll Learn

- What an effect declaration does in MEL
- What an effect handler does in TypeScript
- Why effect handlers return patches instead of values
- How to model loading, success, and failure in `snapshot.state`

---

## Prerequisites

- You finished [Building a Todo App](./04-todo-app), or you are deliberately
  pausing the Todo path to learn IO
- You are still using the SDK app path from tutorial 1

---

## 1. Declare the Effect in MEL

Create `user-profile.mel`:

```mel
domain UserProfile {
  type User = {
    id: string,
    name: string
  }

  state {
    user: User | null = null
    loading: boolean = false
    error: string | null = null
    requestedId: string | null = null
  }

  action fetchUser(id: string) {
    onceIntent {
      patch loading = true
      patch error = null
      patch requestedId = id
      effect api.fetchUser({ id: id })
    }
  }

  action reset() {
    onceIntent {
      patch user = null
      patch loading = false
      patch error = null
      patch requestedId = null
    }
  }
}
```

The important part is this line:

```mel
effect api.fetchUser({ id: id })
```

That does not execute the request by itself. It declares a requirement for the
activated runtime to fulfill.

---

## 2. Implement the Effect Handler

Create `effects.ts`:

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

Two details matter here:

- The handler receives `params`; add a second `{ snapshot }` argument when the
  handler needs to read current state
- The handler returns concrete patches that update the domain

It does not "return the fetched user to the action." The next snapshot carries that result.

---

## 3. Run It

Create `main.ts`:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import UserProfileMel from "./user-profile.mel";
import { effects } from "./effects";

const app = createManifesto(UserProfileMel, effects).activate();

app.observe.state(
  (snapshot) => ({
    loading: snapshot.state.loading,
    error: snapshot.state.error,
    user: snapshot.state.user,
  }),
  (view) => {
    console.log("View state:", view);
  },
);

async function run() {
  await app.action.fetchUser.submit("123");

  const snapshot = app.snapshot();
  console.log("User data:", snapshot.state.user);

  app.dispose();
}

run().catch((error) => {
  console.error(error);
  app.dispose();
});
```

Run it:

```bash
npx tsx --loader @manifesto-ai/compiler/node-loader main.ts
```

You should see the fetched user in the final output:

```text
User data: { id: "123", name: "Ada" }
```

Depending on your terminal and runtime logging, you may also see one or more
`View state:` lines as the effect patches publish updated state.

---

## What Just Happened

1. `fetchUser` declared `api.fetchUser`
2. The runtime invoked the registered handler
3. The handler returned patches
4. Those patches became part of the next snapshot
5. `observe.state()` and `snapshot()` saw the updated state

That is the core pattern for all IO in Manifesto.

---

## Model the Result in State

A practical effect-driven domain usually keeps these fields in `state`:

- The current value, such as `user`
- A loading flag
- A recoverable error message
- Enough state to retry later, such as `requestedId`

This makes the result visible to UI, scripts, tests, and AI agents through the same Snapshot.

---

## Common Mistakes

### Returning raw values from the handler

This is wrong:

```typescript
return user;
```

Handlers must return `Patch[]`.

### Throwing business failures out of the handler

Network code may throw, but your handler should translate that failure into patches that keep the domain honest.

### Hiding loading state outside the Snapshot

If your UI needs `loading`, store it in domain state so every consumer sees the same truth.

---

## Next

Return to [Building a Todo App](./04-todo-app) if you have not built the base
Todo path yet. Otherwise continue to [Bundler Setup](/guides/bundler-setup) and
[Code Generation](/guides/code-generation) before wiring a typed UI.
