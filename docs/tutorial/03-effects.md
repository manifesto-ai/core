# Working with Effects

> Connect a pure domain to real IO without leaving the Snapshot model.

---

## What You'll Learn

- What an effect declaration does in MEL
- What an effect handler does in TypeScript
- Why effect handlers return patches instead of values
- How to model loading, success, and failure in `snapshot.data`

---

## Prerequisites

- You finished [Actions and State](./02-actions-and-state)
- You are still using the activation-first SDK path from tutorial 1

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
    user: User? = null
    loading: boolean = false
    error: string? = null
    requestedId: string? = null
  }

  computed hasUser = neq(user, null)

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

That does not execute the request by itself. It declares a requirement for the Host layer to fulfill.

---

## 2. Implement the Effect Handler

Create `effects.ts`:

```typescript
import { defineEffects } from "@manifesto-ai/sdk/effects";
import type { UserProfileDomain } from "./user-profile-types";

export const effects = defineEffects<UserProfileDomain>(({ set, unset }, MEL) => ({
  "api.fetchUser": async (params, ctx) => {
    const { id } = params as { id: string };

    try {
      const response = await fetch(`https://example.com/users/${id}`);
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const user = (await response.json()) as { id: string; name: string };

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

Two details matter here:

- The handler receives `params` plus `{ snapshot }`
- The handler returns concrete patches that update the domain

It does not "return the fetched user to the action." The next snapshot carries that result.

---

## 3. Run It

Create `main.ts`:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import UserProfileMel from "./user-profile.mel";
import { effects } from "./effects";

const instance = createManifesto(UserProfileMel, effects).activate();

instance.subscribe(
  (snapshot) => ({
    loading: snapshot.data.loading,
    error: snapshot.data.error,
    user: snapshot.data.user,
  }),
  (view) => {
    console.log("View state:", view);
  },
);

async function run() {
  await instance.dispatchAsync(
    instance.createIntent(instance.MEL.actions.fetchUser, "123"),
  );

  const snapshot = instance.getSnapshot();
  console.log("Has user:", snapshot.computed["hasUser"]);
  console.log("User data:", snapshot.data.user);

  instance.dispose();
}

run().catch((error) => {
  console.error(error);
  instance.dispose();
});
```

---

## What Just Happened

1. `fetchUser` declared `api.fetchUser`
2. Host invoked the registered handler
3. The handler returned patches
4. Those patches became part of the next snapshot
5. `subscribe()` and `getSnapshot()` saw the updated state

That is the core pattern for all IO in Manifesto.

---

## Model the Result in State

A practical effect-driven domain usually keeps these fields in `state`:

- The current value, such as `user`
- A loading flag
- A recoverable error message
- Enough context to retry later, such as `requestedId`

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

Continue to [Building a Todo App](./04-todo-app) to assemble a larger example before adding a UI framework.
