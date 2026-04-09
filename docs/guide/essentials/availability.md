# Availability

> Availability is the state-based precondition for an action.

Use `available when` when an action should only be available in some current domain states.

## Gate an Action

```mel
domain Counter {
  state {
    count: number = 0
  }

  computed canDecrement = gt(count, 0)

  action decrement() available when canDecrement {
    onceIntent {
      patch count = sub(count, 1)
    }
  }
}
```

`available when` reads current state and computed values. It is a good fit for rules like “only decrement above zero” or “only submit when the form is valid.”

## Keep Input-Specific Gates Separate

```mel
action shoot(cellIndex: number)
  available when gameIsRunning
  dispatchable when eq(at(cells, cellIndex), "unknown") {
  onceIntent {
    patch cells = updateAt(cells, cellIndex, "pending")
  }
}
```

Use `dispatchable when` for bound-intent checks that need the action parameters. Treat it as the next step after `available when` is comfortable.

## Common Mistake

Do not reference action parameters in `available when`. If the gate depends on the specific submitted input, use `dispatchable when` and confirm the current MEL reference.

## Next

Put the essential pieces together in [Building a Todo App](./todo-app). For exact syntax, read the [MEL Syntax Cookbook](/mel/SYNTAX#available-when-precondition).
