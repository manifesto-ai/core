# Building a Todo App

> Put the pieces together into a small app before bringing in React or another UI layer.

---

## What You'll Learn

- How to organize a slightly larger domain
- How to keep rendering logic outside the domain
- How to shape actions so UI and agent callers pass only user-facing input
- How `observe.state()` can drive an app loop without any framework
- How to prepare for a later UI integration

---

## Prerequisites

- You finished [Actions and State](./02-actions-and-state)
- You are still using the SDK app path from tutorial 1

---

## 1. Define the Todo App Domain

Create `src/domain/todo.mel`:

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

  action removeTodo(id: string)
    available when todoCount > 0
    dispatchable when len(filter(todos, $item.id == id)) > 0 {
    onceIntent {
      patch todos = filter(todos, $item.id != id)
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

---

## 2. Create the App Runtime

Create `src/manifesto-app.ts`:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./domain/todo.mel";

export const app = createManifesto(TodoMel, {}).activate();
```

---

## 3. Add a Tiny Render Loop

Create `src/main.ts`:

This script uses a small local `Todo` type only to stay independent of a web
build. In normal typed app code, replace this with the generated domain facade
from [Code Generation](/guides/code-generation) before wiring React, routes, or
agent tools.

```typescript
import { app } from "./manifesto-app";

type Todo = {
  id: string;
  title: string;
  completed: boolean;
};

function render() {
  const snapshot = app.snapshot();
  const todos = snapshot.state.todos as Todo[];
  const filterMode = snapshot.state.filterMode as "all" | "active" | "completed";

  const visibleTodos = todos.filter((todo) => {
    if (filterMode === "active") return !todo.completed;
    if (filterMode === "completed") return todo.completed;
    return true;
  });

  console.clear();
  console.log(`Filter: ${filterMode}`);
  console.log(`Total: ${snapshot.computed["todoCount"]}`);
  console.log(`Active: ${snapshot.computed["activeCount"]}`);
  console.log(`Completed: ${snapshot.computed["completedCount"]}`);
  console.log("");

  for (const todo of visibleTodos) {
    const mark = todo.completed ? "x" : " ";
    console.log(`[${mark}] ${todo.title}`);
  }
}

app.observe.state(
  (snapshot) => ({
    todos: snapshot.state.todos,
    filterMode: snapshot.state.filterMode,
    todoCount: snapshot.computed["todoCount"],
    activeCount: snapshot.computed["activeCount"],
    completedCount: snapshot.computed["completedCount"],
    hasCompleted: snapshot.computed["hasCompleted"],
  }),
  () => render(),
);

async function run() {
  render();

  await app.action.addTodo.submit("Write the tutorial");

  await app.action.addTodo.submit("Review the generated docs build");

  const firstTodoId = (app.snapshot().state.todos as Todo[])[0].id;
  await app.action.toggleTodo.submit(firstTodoId);

  await app.action.setFilter.submit("completed");

  await app.action.clearCompleted.submit();

  render();
  app.dispose();
}

run().catch((error) => {
  console.error(error);
  app.dispose();
});
```

Run it:

```bash
npx tsx --loader @manifesto-ai/compiler/node-loader src/main.ts
```

The script clears and redraws the terminal as the app changes. The final render
uses the `completed` filter after completed todos have been cleared, so it
should show counts but no visible todo rows:

```text
Filter: completed
Total: 1
Active: 1
Completed: 0
```

At this point your files should look like this:

```text
src/
  domain/
    todo.mel
  manifesto-app.ts
  main.ts
```

Keep `src/domain/todo.mel`. The next docs reuse that same domain file for the
generated TypeScript facade, React UI, and agent tools.

---

## Why This Matters

This tutorial separates three concerns cleanly:

- MEL owns domain rules
- `createManifesto(...).activate()` owns runtime composition
- `render()` owns presentation

That same split scales to React, a CLI, a server process, or an AI worker. The
UI layer changes; the domain and app state model stay the same.

The action shape is also integration-friendly: `addTodo(title)` lets a UI or
agent submit only the user-facing value, while the domain uses the runtime seed
to create a stable id.

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

- Go to [Bundler Setup](/guides/bundler-setup) and [Code Generation](/guides/code-generation) to emit `src/domain/todo.domain.ts` from the same domain file before typed React, route, or agent code
- Go to [React](/integration/react) to connect the same app model to a web UI
- Go to [Web App + Agent](/integration/web-app-and-agent) when the UI and agent must share one server runtime
- Go to [AI Agents](/integration/ai-agents) when you want deeper agent-only tool-loop guidance
- Go to [Working with Effects](./03-effects) when your domain needs API, database, model, or queue IO
- Go to [How-to Guides](/guides/) for debugging, effects, and developer tooling
