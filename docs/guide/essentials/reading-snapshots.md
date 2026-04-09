# Reading Snapshots

> Snapshot is the visible result after runtime work completes.

In ordinary SDK apps, use `getSnapshot()` for the current published read model and use the value returned by `dispatchAsync()` for the newly published result.

## Read the Current Snapshot

```typescript
const snapshot = app.getSnapshot();

console.log(snapshot.data);
console.log(snapshot.computed);
console.log(snapshot.system.lastError);
```

## Read the Dispatch Result

```typescript
const nextSnapshot = await app.dispatchAsync(
  app.createIntent(app.MEL.actions.increment),
);

console.log(nextSnapshot.data.count);
```

The intent is the request. The snapshot is the result.

## Data and Computed

```typescript
const snapshot = app.getSnapshot();

const count = snapshot.data.count;
const doubled = snapshot.computed.doubled;
```

`data` contains domain state. `computed` contains public derived values.

## Common Mistake

Do not expect an effect handler or action to return a separate payload from `dispatchAsync()`. Make the visible result part of the next Snapshot.

## Next

Learn how to react to later publications with [Subscriptions](./subscriptions). For the canonical/projected split, read [Snapshot](/concepts/snapshot).
