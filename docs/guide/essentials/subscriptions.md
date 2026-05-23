# Subscriptions

> Subscriptions run a listener when a selected Snapshot value changes.

Use `observe.state(selector, listener)` when UI, logs, scripts, or integrations need to react to published runtime state.

## Subscribe to a Slice

```typescript
const unsubscribe = app.observe.state(
  (snapshot) => snapshot.computed["todoCount"],
  (next, prev) => {
    console.log("Todo count changed:", prev, next);
  },
);
```

The selector receives each published Snapshot. The listener receives the next and previous selected value.

## Seed the Initial Render

```typescript
render(app.snapshot());

const unsubscribe = app.observe.state(
  (snapshot) => snapshot,
  (snapshot) => render(snapshot),
);
```

`observe.state()` observes later publications. Read `snapshot()` once when you also need the current value immediately.

## Clean Up

```typescript
unsubscribe();
app.dispose();
```

Unsubscribe when the consumer is gone. Dispose the runtime when the app-owned runtime lifetime ends.

## Common Mistake

Do not subscribe to the whole snapshot when one field is enough. A focused selector makes update behavior easier to explain.

## Next

Learn when an action should be visible with [Availability](./availability), then
put the pieces together in [Building a Todo App](./todo-app). Read
[Effects](./effects) later when the domain needs API, database, model, or queue
IO.
