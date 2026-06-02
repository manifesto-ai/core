# Computed Values

> Computed values are derived from current state and read from Snapshot.

Use `computed` for values that can be recalculated from `state`: counts, booleans, labels, totals, and UI-ready summaries.

## Declare Computed Values

```mel
domain TodoApp {
  type Todo = {
    id: string,
    title: string,
    completed: boolean
  }

  state {
    todos: Array<Todo> = []
  }

  computed todoCount = len(todos)
  computed completedCount = len(filter(todos, $item.completed))
  computed activeCount = todoCount - completedCount
  computed hasCompleted = completedCount > 0
}
```

Computed values are not separate storage. They describe how to derive a value from the current domain state.

## Read Them in TypeScript

```typescript
const snapshot = app.snapshot();

console.log(snapshot.computed["todoCount"]);
console.log(snapshot.computed["activeCount"]);
```

## Use Them in the Domain

```mel
action clearCompleted() available when hasCompleted {
  onceIntent {
    patch todos = filter(todos, !$item.completed)
  }
}
```

## Common Mistake

Do not patch a computed value. If the value must be stored, put it in `state`. If it can be derived, keep it in `computed`.

## Next

Learn how callers request transitions in [Actions](./actions-and-intents).
