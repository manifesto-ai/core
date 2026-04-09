# Creating an App

> Create an activated runtime from a MEL domain.

A Manifesto app starts as a composable manifesto and becomes runnable after `activate()`.

## The App Shape

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterSchema from "./counter.mel";

const app = createManifesto(CounterSchema, {}).activate();
```

`app` is the base runtime handle. It can create intents, dispatch them, publish snapshots, notify subscribers, and clean itself up.

## Schema and Effects

The first argument is your domain schema. The second argument is the effect handler map.

```typescript
const app = createManifesto(UserProfileSchema, {
  "api.fetchUser": async (params) => {
    return [
      { op: "set", path: [{ kind: "prop", name: "loading" }], value: false },
    ];
  },
}).activate();
```

Pass `{}` when the domain does not declare external effects.

## The Minimal Loop

```typescript
const snapshot = await app.dispatchAsync(
  app.createIntent(app.MEL.actions.increment),
);

console.log(snapshot.data.count);
app.dispose();
```

## Common Mistake

`createManifesto()` does not expose runtime verbs by itself. Call `activate()` before using `createIntent()`, `dispatchAsync()`, `subscribe()`, or `getSnapshot()`.

## Next

Learn the domain file in [MEL Domain Basics](./mel-domain-basics), or walk through the longer [first app tutorial](/tutorial/01-your-first-app).
