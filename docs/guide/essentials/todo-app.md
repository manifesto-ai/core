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
  }

  computed totalCount = len(todos)

  action addTodo(title: string, id: string) {
    onceIntent {
      patch todos = append(todos, {
        id: id,
        title: title,
        completed: false
      })
    }
  }
}
```

## Runtime

```typescript
export const app = createManifesto(TodoAppSchema, {}).activate();

await app.dispatchAsync(
  app.createIntent(app.MEL.actions.addTodo, "Write a domain", crypto.randomUUID()),
);
```

## Presentation

```typescript
function renderTodos() {
  const snapshot = app.getSnapshot();
  console.log(snapshot.data.todos);
  console.log(snapshot.computed.totalCount);
}

renderTodos();
app.subscribe((snapshot) => snapshot.data.todos, renderTodos);
```

Keep framework code outside MEL. The same domain can sit behind React, a backend route, a CLI, or an agent turn.

## Next

Try the [hands-on todo tutorial](/tutorial/04-todo-app), then choose an [Integration](/integration/react) or continue to the [In-Depth shared semantic model](/concepts/shared-semantic-model).
