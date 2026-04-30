# Computed Values

> Computed values are derived from current state and read from Snapshot.

Use `computed` for values that can be recalculated from `state`: counts, booleans, labels, totals, and UI-ready summaries.

## Declare Computed Values

```mel
domain Counter {
  state {
    count: number = 0
  }

  computed doubled = count * 2
  computed canDecrement = count > 0
}
```

Computed values are not separate storage. They describe how to derive a value from the current domain state.

## Read Them in TypeScript

```typescript
const snapshot = app.snapshot();

console.log(snapshot.computed.doubled);
console.log(snapshot.computed.canDecrement);
```

## Use Them in the Domain

```mel
action decrement() available when canDecrement {
  onceIntent {
    patch count = count - 1
  }
}
```

## Common Mistake

Do not patch a computed value. If the value must be stored, put it in `state`. If it can be derived, keep it in `computed`.

## Next

Learn how callers request transitions in [Actions and Intents](./actions-and-intents).
