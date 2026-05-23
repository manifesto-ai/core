# Actions

> Actions are named domain transitions you submit from app code.

Define actions in MEL. In TypeScript, call them through `app.action.*`.

## Define an Action

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

  action addTodo(title: string)
    dispatchable when trim(title) != "" {
    onceIntent {
      patch todos = append(todos, {
        id: $runtime.random.uuid,
        title: trim(title),
        completed: false
      })
    }
  }
}
```

## Submit an Action

```typescript
const result = await app.action.addTodo.submit("Learn actions");

if (result.ok && result.status === "settled" && result.outcome.kind === "ok") {
  console.log(result.after.state.todos);
}
```

`submit()` resolves with a runtime result. Read the returned `after` Snapshot, or call `app.snapshot()`, to see the visible state after the action settles.

## Input Shape

The public argument shape follows the action declaration. A scalar parameter stays positional:

```typescript
await app.action.addTodo.submit("Learn actions");
```

If the action declares a single object-shaped input, submit that object directly:

```typescript
await app.action.configure.submit({ retries: 3, label: "daily" });
```

`submit()` does not wrap scalar inputs into `{ title }`, and object-shaped inputs are not wrapped again into `{ input }`.

## Common Mistake

Do not dispatch raw string action names as your app-facing contract. Prefer `app.action.someAction.submit(input)`.

## Why The Keyword Is `onceIntent`

You will see the word "intent" in MEL keywords and lower-level API docs. In app code, you normally do not construct one yourself. Start with action handles, then read the [Intent concept](/concepts/intent) when you are building runtime tooling.

## Next

Keep later UI state in sync with [Subscriptions](./subscriptions), then learn
when actions should appear with [Availability](./availability).
