# Snapshots and Subscriptions

> Snapshot is the visible result of runtime work.

## `snapshot()`

Reads the app-facing Snapshot.

```typescript
const snapshot = app.snapshot();

console.log(snapshot.state.todos);
console.log(snapshot.computed.activeCount);
```

Use this in UI, routes, tools, tests, and agent context builders.

## Submit Result

`action.<name>.submit()` resolves with an explicit submit result. Settled
results include app-facing `before` and `after` snapshots.

```typescript
const result = await app.action.toggleTodo.submit("todo-1");

if (result.ok && result.status === "settled" && result.outcome.kind === "ok") {
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

Seed initial UI with `snapshot()`. The observer listener is for later Snapshot
publications.

## Advanced: `inspect.canonicalSnapshot()`

Reads the full internal runtime snapshot.

```typescript
const canonical = app.inspect.canonicalSnapshot();
await saveRuntimeSnapshot(canonical);
```

Use this for restore/persistence, seal-aware tooling, Studio overlays, and deep
debugging. Prefer `snapshot()` for normal application rendering and agent
context.

## Next

- Connect state to React in [React](/integration/react)
- Read [Snapshot](/concepts/snapshot)
- Escalate only when needed in [Debugging](/guides/debugging)
