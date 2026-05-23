# Building a Todo App

> A small app is one MEL domain plus one activated runtime plus one presentation layer.

This page is a map of the pieces. For the full hands-on walkthrough, use [Building a Todo App](/tutorial/04-todo-app).

## Domain

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
}
```

## Runtime

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./todo.mel";

export const app = createManifesto(TodoMel, {}).activate();

await app.action.addTodo.submit("Write a domain");
```

## Presentation

```typescript
function renderTodos() {
  const snapshot = app.snapshot();
  console.log(snapshot.state.todos);
  console.log(snapshot.computed["todoCount"]);
  console.log(snapshot.computed["activeCount"]);
}

renderTodos();
app.observe.state((snapshot) => snapshot.state.todos, renderTodos);
```

Keep framework code outside MEL. The same domain can sit behind React, a backend route, a CLI, or an agent turn.

## Next

Try the [hands-on todo tutorial](/tutorial/04-todo-app), then add
[Bundler Setup](/guides/bundler-setup) and [Code Generation](/guides/code-generation).
After that, connect [React](/integration/react) and compare with
[Runnable Examples](/guide/runnable-examples).
