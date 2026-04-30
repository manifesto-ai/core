# Snapshots and Subscriptions

> Snapshot is the visible result of runtime work.

## `snapshot()`

Reads the projected app-facing Snapshot.

```typescript
const snapshot = app.snapshot();

console.log(snapshot.state.todos);
console.log(snapshot.computed.activeCount);
```

Use this in UI, routes, tools, tests, and agent context builders.

## Submit Result

`actions.<name>.submit()` resolves with an explicit submit result. Settled
results include projected `before` and `after` snapshots.

```typescript
const result = await app.actions.toggleTodo.submit("todo-1");

if (result.ok) {
  render(result.after.state.todos);
}
```

## `observe.state(selector, listener)`

Subscribe to a selected Snapshot value.

```typescript
const unsubscribe = app.observe.state(
  (snapshot) => snapshot.state.todos,
  (todos) => {
    render(todos);
  },
);

render(app.snapshot().state.todos);
```

Seed initial UI with `snapshot()`. The observer listener is for later
projected Snapshot publications.

## `inspect.canonicalSnapshot()`

Reads the full canonical runtime substrate.

```typescript
const canonical = app.inspect.canonicalSnapshot();
await saveRuntimeSnapshot(canonical);
```

Use this for restore/persistence, seal-aware tooling, Studio overlays, and deep debugging. Prefer `snapshot()` for normal application rendering.

## Next

- Connect state to React in [React](/integration/react)
- Read [Snapshot](/concepts/snapshot)
- Debug canonical state in [Debugging](/guides/debugging)
