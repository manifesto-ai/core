# Availability

> Availability is the state-based precondition for an action.

Use `available when` when an action should only be available in some current domain states.

## Gate an Action

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

  computed completedCount = len(filter(todos, $item.completed))
  computed hasCompleted = completedCount > 0

  action clearCompleted() available when hasCompleted {
    onceIntent {
      patch todos = filter(todos, !$item.completed)
    }
  }
}
```

`available when` reads current state and computed values. It is a good fit for
rules like “only clear completed todos when at least one completed item exists.”

## Keep Input-Specific Gates Separate

```mel
action toggleTodo(id: string)
  available when len(todos) > 0
  dispatchable when len(filter(todos, $item.id == id)) > 0 {
  onceIntent {
    patch todos = map(todos,
      $item.id == id
        ? { id: $item.id, title: $item.title, completed: !$item.completed }
        : $item
    )
  }
}
```

Use `dispatchable when` for input-specific checks that need the submitted action parameters. Treat it as the next step after `available when` is comfortable.

## Common Mistake

Do not reference action parameters in `available when`. If the gate depends on the specific submitted input, use `dispatchable when` and confirm the current MEL reference.

## Next

Put the essential pieces together in [Building a Todo App](./todo-app), then
follow the hands-on [Todo tutorial](/tutorial/04-todo-app). For exact syntax,
read the [MEL Syntax Cookbook](/mel/SYNTAX#available-when-precondition).
