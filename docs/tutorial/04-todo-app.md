# Building a Todo App

> Put the pieces together into a small app before bringing in React or another UI layer.

---

## What You'll Learn

- How to organize a slightly larger domain
- How to keep rendering logic outside the domain
- How `subscribe()` can drive an app loop without any framework
- How to prepare for a later UI integration

---

## Prerequisites

- You finished [Working with Effects](./03-effects)
- You are still using the activation-first SDK path from tutorial 1

---

## 1. Define the Todo App Domain

Create `todo-app.mel`:

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

  action clearCompleted() {
    onceIntent when hasTodos {
      effect array.filter({
        source: todos,
        where: eq($item.completed, false),
        into: todos
      })
    }
  }
}
```

---

## 2. Create the App Runtime

Create `manifesto.ts`:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoAppMel from "./todo-app.mel";

export const instance = createManifesto(TodoAppMel, {}).activate();
```

---

## 3. Add a Tiny Render Loop

Create `main.ts`:

```typescript
import { instance } from "./manifesto";

type Todo = {
  id: string;
  title: string;
  completed: boolean;
};

function render() {
  const snapshot = instance.getSnapshot();
  const todos = snapshot.data.todos as Todo[];
  const filter = snapshot.data.filter as "all" | "active" | "completed";

  const visibleTodos = todos.filter((todo) => {
    if (filter === "active") return !todo.completed;
    if (filter === "completed") return todo.completed;
    return true;
  });

  console.clear();
  console.log(`Filter: ${filter}`);
  console.log(`Total: ${snapshot.computed["totalCount"]}`);
  console.log(`Has todos: ${snapshot.computed["hasTodos"]}`);
  console.log("");

  for (const todo of visibleTodos) {
    const mark = todo.completed ? "x" : " ";
    console.log(`[${mark}] ${todo.title}`);
  }
}

instance.subscribe(
  (snapshot) => ({
    todos: snapshot.data.todos,
    filter: snapshot.data.filter,
    totalCount: snapshot.computed["totalCount"],
    hasTodos: snapshot.computed["hasTodos"],
  }),
  () => render(),
);

async function run() {
  render();

  await instance.dispatchAsync(
    instance.createIntent(
      instance.MEL.actions.addTodo,
      "Write the tutorial",
      crypto.randomUUID(),
    ),
  );

  await instance.dispatchAsync(
    instance.createIntent(
      instance.MEL.actions.addTodo,
      "Review the generated docs build",
      crypto.randomUUID(),
    ),
  );

  const firstTodoId = (instance.getSnapshot().data.todos as Todo[])[0].id;
  await instance.dispatchAsync(
    instance.createIntent(instance.MEL.actions.toggleTodo, firstTodoId),
  );

  await instance.dispatchAsync(
    instance.createIntent(instance.MEL.actions.setFilter, "completed"),
  );

  await instance.dispatchAsync(
    instance.createIntent(instance.MEL.actions.clearCompleted),
  );

  render();
  instance.dispose();
}

run().catch((error) => {
  console.error(error);
  instance.dispose();
});
```

---

## Why This Matters

This tutorial separates three concerns cleanly:

- MEL owns domain rules
- `createManifesto(...).activate()` owns runtime composition
- `render()` owns presentation

That same split scales to React, a CLI, a server process, or an AI worker. The UI layer changes. The domain and Snapshot model stay the same.

---

## Common Mistakes

### Pulling framework concerns into the domain

The domain should not know about components, DOM events, or UI framework state.

### Making the render loop compute business rules

The render loop can filter or format for presentation, but business invariants should stay in MEL actions and computed values.

### Skipping selector-based subscriptions

Subscribing to a focused slice makes it easier to reason about when the app should rerender.

---

## Next

- Go to [Integration](/integration/) to connect the same app model to React or AI workflows
- Go to [How-to Guides](/guides/) for debugging, effects, re-entry safety, and typed patch helpers
