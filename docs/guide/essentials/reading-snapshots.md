# Reading Snapshots

> Snapshot is the visible result after runtime work completes.

In ordinary SDK apps, use `snapshot()` for the current published read model and use the `after` snapshot returned by successful `submit()` calls for the newly published result.

## Read the Current Snapshot

```typescript
const snapshot = app.snapshot();

console.log(snapshot.state);
console.log(snapshot.computed);
```

## Read the Dispatch Result

```typescript
const result = await app.action.addTodo.submit("Read snapshots");

if (result.ok && result.status === "settled" && result.outcome.kind === "ok") {
  console.log(result.after.state.todos);
  console.log(result.after.computed["todoCount"]);
}
```

The action submission is the request. The snapshot is the result.

## Data and Computed

```typescript
const snapshot = app.snapshot();

const todos = snapshot.state.todos;
const activeCount = snapshot.computed["activeCount"];
```

`state` contains domain state. `computed` contains public derived values.
Use [Code Generation](/guides/code-generation) later when you want TypeScript
to know those exact shapes without local casts.

## Common Mistake

Do not expect an effect handler or action to return a separate business payload from `submit()`. Make the visible result part of the next Snapshot.

For ordinary app code, stay with `snapshot.state`, `snapshot.computed`, and
successful `result.after` reads. Reach for lower-level snapshot details only
when a debugging or tooling page sends you there.

## Next

Learn how domain [State](./state) and [Computed Values](./computed-values) show
up in a snapshot, then how callers request changes in
[Actions](./actions-and-intents). After that, react to later publications with
[Subscriptions](./subscriptions). For advanced snapshot internals, read
[Snapshot](/concepts/snapshot).
