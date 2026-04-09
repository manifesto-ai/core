# Snapshots and Subscriptions

> Snapshot is the visible result of runtime work.

## `getSnapshot()`

Reads the projected app-facing Snapshot.

```typescript
const snapshot = app.getSnapshot();

console.log(snapshot.data.todos);
console.log(snapshot.computed.activeCount);
```

Use this in UI, routes, tools, tests, and agent context builders.

## Dispatch Result

`dispatchAsync(intent)` resolves with the next projected Snapshot.

```typescript
const next = await app.dispatchAsync(
  app.createIntent(app.MEL.actions.toggleTodo, "todo-1"),
);

render(next.data.todos);
```

## `subscribe(selector, listener)`

Subscribe to a selected Snapshot value.

```typescript
const unsubscribe = app.subscribe(
  (snapshot) => snapshot.data.todos,
  (todos) => {
    render(todos);
  },
);

render(app.getSnapshot().data.todos);
```

Seed initial UI with `getSnapshot()`. The subscription listener is for later publications.

## `getCanonicalSnapshot()`

Reads the full canonical runtime substrate.

```typescript
const canonical = app.getCanonicalSnapshot();
await saveRuntimeSnapshot(canonical);
```

Use this for restore/persistence, seal-aware tooling, Studio overlays, and deep debugging. Prefer `getSnapshot()` for normal application rendering.

## Next

- Connect state to React in [React](/integration/react)
- Read [Snapshot](/concepts/snapshot)
- Debug canonical state in [Debugging](/guides/debugging)
