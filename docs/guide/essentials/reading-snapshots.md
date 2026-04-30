# Reading Snapshots

> Snapshot is the visible result after runtime work completes.

In ordinary SDK apps, use `snapshot()` for the current published read model and use the `after` snapshot returned by successful `submit()` calls for the newly published result.

## Read the Current Snapshot

```typescript
const snapshot = app.snapshot();

console.log(snapshot.state);
console.log(snapshot.computed);
console.log(snapshot.system.lastError);
```

## Read the Dispatch Result

```typescript
const result = await app.actions.increment.submit();

if (result.ok) {
  console.log(result.after.state.count);
}
```

The intent is the request. The snapshot is the result.

## Data and Computed

```typescript
const snapshot = app.snapshot();

const count = snapshot.state.count;
const doubled = snapshot.computed.doubled;
```

`state` contains domain state. `computed` contains public derived values.

## Common Mistake

Do not expect an effect handler or action to return a separate business payload from `submit()`. Make the visible result part of the next Snapshot.

## Next

Learn how to react to later publications with [Subscriptions](./subscriptions). For the canonical/projected split, read [Snapshot](/concepts/snapshot).
