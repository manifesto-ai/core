# MEL For App Developers

> Learn the smallest MEL surface you need before wiring UI, server routes, or agents.

MEL defines the domain rules. TypeScript activates those rules and calls them.

```text
domain.mel -> createManifesto(...).activate() -> app.action.x.submit() -> snapshot()
```

Start with the pieces below. You can build the first web app and trusted agent
integration without reading the full language reference.

## The First Things To Learn

| MEL Piece | Use It For | First Example |
|-----------|------------|---------------|
| `domain` | Name the app model | `domain TodoApp { ... }` |
| `type` | Name reusable data shapes | `type Todo = { id: string, title: string }` |
| `state` | Store source-of-truth app data | `todos: Array<Todo> = []` |
| `computed` | Derive read-only values from state | `computed todoCount = len(todos)` |
| `action` | Define a change callers can submit | `action addTodo(title: string) { ... }` |
| `dispatchable when` | Reject invalid input before the action runs | `dispatchable when trim(title) != ""` |
| `available when` | Hide or disable actions that do not apply | `available when hasCompleted` |
| `onceIntent` | Run the action body once for one submitted action | `onceIntent { patch ... }` |
| `patch` | Write the next app state | `patch filterMode = newFilter` |
| `effect` | Later: ask TypeScript to do external work | `effect api.fetchUser({ id: id })` |

If a page introduces more than these pieces, treat it as a lookup page or an
advanced topic.

## A Small Todo Domain

The example below uses three MEL helpers that app developers see often:

| Name | Meaning |
|------|---------|
| `$item` | The current item inside `filter(...)` or `map(...)` |
| `$runtime.random.uuid` | A deterministic runtime-provided id for the submitted action |
| `dispatchable when` | Rejects invalid input before the action body runs |

```mel
domain TodoApp {
  type Todo = {
    id: string,
    title: string,
    completed: boolean
  }

  state {
    todos: Array<Todo> = []
    filterMode: "all" | "active" | "completed" = "all"
  }

  computed todoCount = len(todos)
  computed completedCount = len(filter(todos, $item.completed))
  computed activeCount = todoCount - completedCount
  computed hasCompleted = completedCount > 0

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

  action setFilter(newFilter: "all" | "active" | "completed")
    dispatchable when filterMode != newFilter {
    onceIntent {
      patch filterMode = newFilter
    }
  }
}
```

That file is enough for app code to submit actions and read Snapshots:

```typescript
const app = createManifesto(TodoMel, {}).activate();

await app.action.addTodo.submit("Ship docs");
await app.action.setFilter.submit("active");

const snapshot = app.snapshot();
console.log(snapshot.state.todos);
console.log(snapshot.computed["activeCount"]);
```

## State

Put data in `state` when users, UI, server routes, or agents need to see it
later.

```mel
state {
  todos: Array<Todo> = []
  draftTitle: string = ""
  lastSavedAt: number | null = null
}
```

Keep state concrete. Prefer names that match the product: `todos`,
`selectedProjectId`, `syncStatus`, `lastAgentSummary`.

## Computed Values

Use `computed` for values that can be derived from state.

```mel
computed todoCount = len(todos)
computed completedTodos = filter(todos, $item.completed)
computed hasCompleted = len(completedTodos) > 0
```

Computed values are read from `snapshot().computed`. Do not patch them directly.

## Actions

Use actions for app, route, script, and agent commands.

```mel
action clearCompleted()
  available when hasCompleted {
  onceIntent {
    patch todos = filter(todos, !$item.completed)
  }
}
```

Submit that action from TypeScript:

```typescript
await app.action.clearCompleted.submit();
```

### `available when` vs `dispatchable when`

Use `available when` when the UI should hide or disable an action. Use
`dispatchable when` when an input must be rejected even if the caller submits it.

```mel
action renameTodo(id: string, title: string)
  available when todoCount > 0
  dispatchable when trim(title) != "" && len(filter(todos, $item.id == id)) > 0 {
  onceIntent {
    patch todos = map(todos,
      $item.id == id
        ? { id: $item.id, title: trim(title), completed: $item.completed }
        : $item
    )
  }
}
```

## Effects Later

You can build the first Todo app, React UI, and local agent wiring without
effects. Use `effect` only when the work leaves the Manifesto domain: API
calls, database writes, model calls, queues, storage, email, or other services.

```mel
domain Profile {
  state {
    userName: string | null = null
    loading: boolean = false
  }

  action fetchUser(id: string) {
    onceIntent {
      patch loading = true
      effect api.fetchUser({ id: id })
    }
  }
}
```

The TypeScript handler lives outside the `.mel` file and returns patches that
update state. Read [Effects](./effects) or [Effect Handlers](/guides/effect-handlers)
after the first app path works.

## What Not To Learn First

Skip these until a guide points you there:

- raw `DomainSchema` objects
- low-level runtime assembly
- full internal snapshots
- proposal, approval, and durable history runtime setup
- full MEL grammar tables
- raw codegen plugin internals, unless you are customizing generated output

## Next

Read [Creating an App](./creating-an-app) and
[Reading Snapshots](./reading-snapshots) before the app-code examples in
[State](./state), [Computed Values](./computed-values), and
[Actions](./actions-and-intents). Then build the [Tutorial](/tutorial/) or wire
[React](/integration/react). Use the [MEL Reference](/mel/REFERENCE) only when
you need complete syntax lookup.
