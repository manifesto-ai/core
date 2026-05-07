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
    selectedTodoId: string | null = null
  }
}
```

## Read State in TypeScript

```typescript
const snapshot = app.snapshot();

console.log(snapshot.state.todos);
console.log(snapshot.state.filter);
console.log(snapshot.state.selectedTodoId);
```

Application code reads state through `snapshot.state`.

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

Do not mutate `snapshot.state` in UI, server, or agent code. A snapshot is the read result. To request change, submit an action candidate.

## Next

Move derived labels, totals, and flags into [Computed Values](./computed-values).
