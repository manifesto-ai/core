# Actions and State

> Move from a counter to structured state, computed values, and list updates.

---

## What You'll Learn

- How to model arrays and objects in MEL
- How to derive UI-ready values in `computed`
- How to observe only the slice of state you care about
- How action inputs stay close to what the user actually means

---

## Prerequisites

- You finished [Your First App](./01-your-first-app)
- You are using the SDK app path from tutorial 1

---

## 1. Define a Todo Domain

Create `todo.mel`:

This example uses a few MEL helpers:

| Name | Meaning |
|------|---------|
| `$item` | The current item inside `filter(...)` or `map(...)` |
| `$runtime.random.uuid` | A deterministic id supplied by the runtime for this submitted action |
| `available when` | Makes an action visible only when it applies |
| `dispatchable when` | Rejects invalid input even if a caller submits it |

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

  action toggleTodo(id: string)
    available when todoCount > 0
    dispatchable when len(filter(todos, $item.id == id)) > 0 {
    onceIntent {
      patch todos = map(todos,
        $item.id == id
          ? { id: $item.id, title: $item.title, completed: !$item.completed }
          : $item
      )
    }
  }

  action setFilter(newFilter: "all" | "active" | "completed")
    dispatchable when filterMode != newFilter {
    onceIntent {
      patch filterMode = newFilter
    }
  }

  action clearCompleted() available when hasCompleted {
    onceIntent {
      patch todos = filter(todos, !$item.completed)
    }
  }
}
```

This domain keeps the rules close to the data:

- `todos` and `filterMode` live in `snapshot.state`
- simple derived flags and counts live in `snapshot.computed`
- actions describe legal transitions against the current snapshot

---

## 2. Use the Domain

Create `main.ts`:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./todo.mel";

type Todo = {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
};

const app = createManifesto(TodoMel, {}).activate();

app.observe.state(
  (snapshot) => snapshot.computed["todoCount"],
  (todoCount) => {
    console.log("Total todos:", todoCount);
  },
);

async function run() {
  await app.action.addTodo.submit("Learn Manifesto");
  await app.action.addTodo.submit("Ship the first tutorial rewrite");

  let snapshot = app.snapshot();
  console.log("Total todos:", snapshot.computed["todoCount"]);
  console.log("Active todos:", snapshot.computed["activeCount"]);

  const firstTodoId = (snapshot.state.todos as Todo[])[0].id;
  await app.action.toggleTodo.submit(firstTodoId);

  snapshot = app.snapshot();
  console.log("Completed state:", snapshot.state.todos);

  await app.action.clearCompleted.submit();

  snapshot = app.snapshot();
  console.log("Todos after clearCompleted:", snapshot.state.todos);

  app.dispose();
}

run().catch((error) => {
  console.error(error);
  app.dispose();
});
```

Run it:

```bash
npx tsx --loader @manifesto-ai/compiler/node-loader main.ts
```

You should see `todoCount` move from one to two, then a completed todo in the
printed array, then an empty array after `clearCompleted()`. The generated todo
ids are runtime-provided, so they do not need to match the docs exactly.

---

## What to Notice

### `snapshot.state` vs `snapshot.computed`

Use `state` for stored domain state. Use `computed` for values you want to derive every time from that state.

### Selector-based subscriptions

This tutorial subscribes to `todoCount`, not the full snapshot. That keeps the reaction focused on one meaningful value.

### Action inputs should match the caller's goal

`app.action.addTodo.submit(title)` asks the caller for the title only. The
domain can still derive runtime-owned fields such as `$runtime.random.uuid`.

### Local types are temporary

This tutorial uses a small local `Todo` type only because it is a no-build
script. In normal typed app code, use [Code Generation](/guides/code-generation)
to generate the domain facade instead of maintaining local types by hand.

### Actions stay small

Each action does one job:

- `addTodo` inserts a new item
- `toggleTodo` changes one item
- `setFilter` changes the view mode
- `clearCompleted` removes a subset

That makes the domain easier to test and easier to explain.

---

## Common Mistakes

### Mutating an item after reading the snapshot

Do not do this:

```typescript
const snapshot = app.snapshot();
(snapshot.state.todos as Todo[])[0].completed = true;
```

That changes your local copy, not the domain. Submit an action instead.

### Treating `computed` as storage

If a value must be persisted in the domain, put it in `state`. If it can be derived from current state, keep it in `computed`.

### Expecting `observe.state()` to fire immediately

It does not emit the current value on registration. Read `snapshot()` once if you need an initial render, then observe for changes.

---

## Next

Continue to [Building a Todo App](./04-todo-app) to organize the same ideas into
a small app before adding a UI framework. Open [Working with Effects](./03-effects)
later when your domain needs API, database, model, or queue IO.
