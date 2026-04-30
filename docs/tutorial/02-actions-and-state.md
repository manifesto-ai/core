# Actions and State

> Move from a counter to structured state, computed values, and list updates.

---

## What You'll Learn

- How to model arrays and objects in MEL
- How to derive UI-ready values in `computed`
- How to observe only the slice of state you care about
- How typed action handles map positional arguments into the domain input shape

---

## Prerequisites

- You finished [Your First Activated Manifesto](./01-your-first-app)
- You are using the activation-first SDK path from tutorial 1

---

## 1. Define a Todo Domain

Create `todo.mel`:

```mel
domain TodoList {
  type Todo = {
    id: string,
    title: string,
    completed: boolean
  }

  state {
    todos: Array<Todo> = []
    filter: "all" | "active" | "completed" = "all"
  }

  computed totalCount = len(todos)
  computed hasTodos = totalCount > 0

  action addTodo(title: string, id: string) {
    onceIntent {
      patch todos = append(todos, {
        id: id,
        title: title,
        completed: false
      })
    }
  }

  action toggleTodo(id: string) {
    onceIntent {
      effect array.map({
        source: todos,
        select: $item.id == id ? { ...$item, completed: !$item.completed } : $item,
        into: todos
      })
    }
  }

  action setFilter(value: string) {
    onceIntent {
      patch filter = value
    }
  }

  action clearCompleted() available when hasTodos {
    onceIntent {
      effect array.filter({
        source: todos,
        where: !$item.completed,
        into: todos
      })
    }
  }
}
```

This domain keeps the rules close to the data:

- `todos` and `filter` live in `snapshot.state`
- simple derived flags and counts live in `snapshot.computed`
- actions describe legal transitions against the current snapshot

---

## 2. Use the Domain

Create `main.ts`:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./todo.mel";

const app = createManifesto(TodoMel, {}).activate();

app.observe.state(
  (snapshot) => snapshot.computed["totalCount"],
  (totalCount) => {
    console.log("Total todos:", totalCount);
  },
);

async function run() {
  await app.actions.addTodo.submit(
    "Learn Manifesto",
    crypto.randomUUID(),
  );

  await app.actions.addTodo.submit(
    "Ship the first tutorial rewrite",
    crypto.randomUUID(),
  );

  let snapshot = app.snapshot();
  console.log("Total todos:", snapshot.computed["totalCount"]);
  console.log("Has todos:", snapshot.computed["hasTodos"]);

  const firstTodoId = (snapshot.state.todos as Array<{ id: string }>)[0].id;
  await app.actions.toggleTodo.submit(firstTodoId);

  snapshot = app.snapshot();
  console.log("Completed state:", snapshot.state.todos);

  await app.actions.clearCompleted.submit();

  snapshot = app.snapshot();
  console.log("Todos after clearCompleted:", snapshot.state.todos);

  app.dispose();
}

run().catch((error) => {
  console.error(error);
  app.dispose();
});
```

---

## What to Notice

### `snapshot.state` vs `snapshot.computed`

Use `state` for stored domain state. Use `computed` for values you want to derive every time from that state.

### Selector-based subscriptions

This tutorial subscribes to `totalCount`, not the full snapshot. That keeps the reaction focused on one meaningful value.

### Action inputs can be positional or object-shaped in app code

`app.actions.addTodo.submit(title, id)` is typed from the MEL action signature. Object-shaped actions use one object argument. The runtime still owns canonical input packing.

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
(snapshot.state.todos as Array<{ completed: boolean }>)[0].completed = true;
```

That changes your local copy, not the domain. Submit an action instead.

### Treating `computed` as storage

If a value must be persisted in the domain, put it in `state`. If it can be derived from current state, keep it in `computed`.

### Expecting `observe.state()` to fire immediately

It does not emit the current value on registration. Read `snapshot()` once if you need an initial render, then observe for changes.

---

## Next

Continue to [Working with Effects](./03-effects) to connect the domain to external systems and return patches from effect handlers.
