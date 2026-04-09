# State

> State is the source-of-truth domain data stored in Snapshot.

Use `state` for values that must survive from one transition to the next: records, selected ids, form fields, status flags, and domain collections.

## Declare State in MEL

```mel
domain TodoApp {
  type Todo = {
    id: string,
    title: string,
    completed: boolean
  }

  state {
    todos: Array<Todo> = []
    filter: "all" | "active" | "completed" = "all"
    selectedTodoId: string? = null
  }
}
```

## Read State in TypeScript

```typescript
const snapshot = app.getSnapshot();

console.log(snapshot.data.todos);
console.log(snapshot.data.filter);
console.log(snapshot.data.selectedTodoId);
```

Application code reads state through `snapshot.data`.

## Change State with Actions

```mel
action setFilter(nextFilter: string) {
  onceIntent {
    patch filter = nextFilter
  }
}
```

State changes happen through patches declared by the domain, or through patches returned by effect handlers.

## Common Mistake

Do not mutate `snapshot.data` in UI, server, or agent code. A snapshot is the read result. To request change, create an intent and dispatch it.

## Next

Move derived labels, totals, and flags into [Computed Values](./computed-values).
