# Subscriptions

> Subscriptions run a listener when a selected Snapshot value changes.

Use `subscribe(selector, listener)` when UI, logs, scripts, or integrations need to react to published runtime state.

## Subscribe to a Slice

```typescript
const unsubscribe = app.subscribe(
  (snapshot) => snapshot.data.count,
  (count) => {
    console.log("Count changed:", count);
  },
);
```

The selector receives each published Snapshot. The listener receives the selected value.

## Seed the Initial Render

```typescript
render(app.getSnapshot());

const unsubscribe = app.subscribe(
  (snapshot) => snapshot,
  (snapshot) => render(snapshot),
);
```

`subscribe()` observes later publications. Read `getSnapshot()` once when you also need the current value immediately.

## Clean Up

```typescript
unsubscribe();
app.dispose();
```

Unsubscribe when the consumer is gone. Dispose the runtime when the app-owned runtime lifetime ends.

## Common Mistake

Do not subscribe to the whole snapshot when one field is enough. A focused selector makes update behavior easier to explain.

## Next

Learn how Manifesto connects to external systems in [Effects](./effects).
