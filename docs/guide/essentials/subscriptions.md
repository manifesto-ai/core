# Subscriptions

> Subscriptions run a listener when a selected Snapshot value changes.

Use `observe.state(selector, listener)` when UI, logs, scripts, or integrations need to react to published runtime state.

## Subscribe to a Slice

```typescript
const unsubscribe = app.observe.state(
  (snapshot) => snapshot.state.count,
  (next, prev) => {
    console.log("Count changed:", prev, next);
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

Learn how Manifesto connects to external systems in [Effects](./effects).
