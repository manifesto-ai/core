# Actions and State

> Move from a counter to structured state, computed values, and list updates.

---

## What You'll Learn

- How to model arrays and objects in MEL
- How to derive UI-ready values in `computed`
- How to observe only the slice of state you care about
- How typed action refs map positional arguments into the domain input shape

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
  computed hasTodos = gt(totalCount, 0)

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
        select: if(eq($item.id, id), merge($item, { completed: not($item.completed) }), $item),
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
        where: eq($item.completed, false),
        into: todos
      })
    }
  }
}
```

This domain keeps the rules close to the data:

- `todos` and `filter` live in `snapshot.data`
- simple derived flags and counts live in `snapshot.computed`
- actions describe legal transitions against the current snapshot

---

## 2. Use the Domain

Create `main.ts`:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./todo.mel";

const world = createManifesto(TodoMel, {}).activate();

world.subscribe(
  (snapshot) => snapshot.computed["totalCount"],
  (totalCount) => {
    console.log("Total todos:", totalCount);
  },
);

async function run() {
  await world.dispatchAsync(
    world.createIntent(
      world.MEL.actions.addTodo,
      "Learn Manifesto",
      crypto.randomUUID(),
    ),
  );

  await world.dispatchAsync(
    world.createIntent(
      world.MEL.actions.addTodo,
      "Ship the first tutorial rewrite",
      crypto.randomUUID(),
    ),
  );

  let snapshot = world.getSnapshot();
  console.log("Total todos:", snapshot.computed["totalCount"]);
  console.log("Has todos:", snapshot.computed["hasTodos"]);

  const firstTodoId = (snapshot.data.todos as Array<{ id: string }>)[0].id;
  await world.dispatchAsync(
    world.createIntent(world.MEL.actions.toggleTodo, firstTodoId),
  );

  snapshot = world.getSnapshot();
  console.log("Completed state:", snapshot.data.todos);

  await world.dispatchAsync(
    world.createIntent(world.MEL.actions.clearCompleted),
  );

  snapshot = world.getSnapshot();
  console.log("Todos after clearCompleted:", snapshot.data.todos);

  world.dispose();
}

run().catch((error) => {
  console.error(error);
  world.dispose();
});
```

---

## What to Notice

### `snapshot.data` vs `snapshot.computed`

Use `data` for stored domain state. Use `computed` for values you want to derive every time from that state.

### Selector-based subscriptions

This tutorial subscribes to `totalCount`, not the full snapshot. That keeps the reaction focused on one meaningful value.

### Action arguments stay positional in app code

`world.createIntent(world.MEL.actions.addTodo, title, id)` is typed from the MEL action signature. The runtime packs those values into the canonical object input expected by the compiled action.

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
const snapshot = world.getSnapshot();
(snapshot.data.todos as Array<{ completed: boolean }>)[0].completed = true;
```

That changes your local copy, not the domain. Create and dispatch an intent instead.

### Treating `computed` as storage

If a value must be persisted in the domain, put it in `state`. If it can be derived from current state, keep it in `computed`.

### Expecting `subscribe()` to fire immediately

It does not emit the current value on registration. Read `getSnapshot()` once if you need an initial render, then subscribe for changes.

---

## Next

Continue to [Working with Effects](./03-effects) to connect the domain to external systems and return patches from effect handlers.
