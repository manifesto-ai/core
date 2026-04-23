# Actions and Intents

> An action describes a transition; an intent requests that transition.

Define actions in MEL. In TypeScript, create typed intents from `app.MEL.actions.*` and dispatch them.

## Define an Action

```mel
domain Counter {
  state {
    count: number = 0
  }

  action add(amount: number) {
    onceIntent {
      patch count = count + amount
    }
  }
}
```

## Create and Dispatch an Intent

```typescript
const intent = app.createIntent(app.MEL.actions.add, 3);

const snapshot = await app.dispatchAsync(intent);
console.log(snapshot.data.count);
```

`dispatchAsync()` resolves with the next terminal Snapshot. The requested change does not return through a hidden side channel.

## Object-Style Binding

When it is clearer for your app code, use the keyed form:

```typescript
await app.dispatchAsync(
  app.createIntent(app.MEL.actions.add, { amount: 3 }),
);
```

## Common Mistake

Do not dispatch raw string action names as your app-facing contract. Prefer `app.createIntent(app.MEL.actions.someAction, input)`.

## Next

Learn what the dispatch result contains in [Reading Snapshots](./reading-snapshots). For deeper intent semantics, read [Intent](/concepts/intent).
