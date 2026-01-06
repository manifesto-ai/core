# Examples

> Real-world application patterns with @manifesto-ai/app

This page provides complete, copy-paste ready examples for common application patterns.

---

## Todo App

A classic todo application demonstrating core patterns.

### Domain (MEL)

```mel
domain TodoApp {
  state {
    todos: Array<{
      id: string,
      title: string,
      completed: boolean,
      createdAt: number
    }> = []
    filter: string = "all"
    status: string = "idle"
    lastError: string | null = null
  }

  // Computed values
  computed activeCount = len(filter(todos, fn(t) => not(t.completed)))
  computed completedCount = len(filter(todos, fn(t) => t.completed))
  computed totalCount = len(todos)

  // Load todos from API
  action loadTodos() {
    once(loadTodosIntent) {
      patch loadTodosIntent = $meta.intentId
      patch status = "loading"
      effect api.loadTodos({})
    }
  }

  // Add a new todo
  action addTodo(title: string) {
    once(addTodoIntent) {
      patch addTodoIntent = $meta.intentId
      let newTodo = {
        id: $system.uuid,
        title: title,
        completed: false,
        createdAt: $system.now
      }
      patch todos = append(todos, newTodo)
      effect api.saveTodo(newTodo)
    }
  }

  // Toggle completion status
  action toggleTodo(id: string) {
    once(toggleTodoIntent) {
      patch toggleTodoIntent = $meta.intentId
      patch todos = map(todos, fn(t) =>
        cond(eq(t.id, id),
          merge(t, { completed: not(t.completed) }),
          t
        )
      )
    }
  }

  // Remove a todo
  action removeTodo(id: string) {
    once(removeTodoIntent) {
      patch removeTodoIntent = $meta.intentId
      patch todos = filter(todos, fn(t) => neq(t.id, id))
      effect api.deleteTodo({ id: id })
    }
  }

  // Set filter
  action setFilter(newFilter: string) {
    once(setFilterIntent) {
      patch setFilterIntent = $meta.intentId
      patch filter = newFilter
    }
  }

  // Clear completed
  action clearCompleted() {
    once(clearCompletedIntent) {
      patch clearCompletedIntent = $meta.intentId
      patch todos = filter(todos, fn(t) => not(t.completed))
    }
  }
}
```

### App Setup

```typescript
// app.ts
import { createApp, type ServiceMap } from "@manifesto-ai/app";
import TodoMel from "./todo.mel";

const services: ServiceMap = {
  "api.loadTodos": async (params, ctx) => {
    try {
      const response = await fetch("/api/todos");
      const todos = await response.json();
      return [
        ctx.patch.set("todos", todos),
        ctx.patch.set("status", "idle"),
      ];
    } catch (error) {
      return [
        ctx.patch.set("status", "error"),
        ctx.patch.set("lastError", error.message),
      ];
    }
  },

  "api.saveTodo": async (params, ctx) => {
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return [];
  },

  "api.deleteTodo": async (params, ctx) => {
    await fetch(`/api/todos/${params.id}`, { method: "DELETE" });
    return [];
  },
};

export const todoApp = createApp(TodoMel, { services });
```

### React Component

```tsx
// TodoApp.tsx
import { useEffect, useState, useCallback } from "react";
import { todoApp } from "./app";
import type { AppState } from "@manifesto-ai/app";

interface TodoData {
  todos: Array<{ id: string; title: string; completed: boolean }>;
  filter: string;
  status: string;
}

export function TodoApp() {
  const [state, setState] = useState<AppState<TodoData> | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      await todoApp.ready();
      setState(todoApp.getState<TodoData>());

      unsubscribe = todoApp.subscribe(
        (s) => s,
        (s) => setState(s as AppState<TodoData>),
        { batchMode: "immediate" }
      );

      await todoApp.act("loadTodos").done();
    };

    init();
    return () => unsubscribe?.();
  }, []);

  const handleAdd = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.currentTarget.value.trim()) {
      await todoApp.act("addTodo", { title: e.currentTarget.value.trim() }).done();
      e.currentTarget.value = "";
    }
  }, []);

  const handleToggle = useCallback((id: string) => {
    todoApp.act("toggleTodo", { id }).done();
  }, []);

  const handleRemove = useCallback((id: string) => {
    todoApp.act("removeTodo", { id }).done();
  }, []);

  if (!state) return <div>Loading...</div>;

  const { todos, filter } = state.data;
  const filteredTodos = todos.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  return (
    <div className="todo-app">
      <h1>Todos</h1>
      <input
        type="text"
        placeholder="What needs to be done?"
        onKeyDown={handleAdd}
      />
      <ul>
        {filteredTodos.map((todo) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggle(todo.id)}
            />
            <span className={todo.completed ? "completed" : ""}>
              {todo.title}
            </span>
            <button onClick={() => handleRemove(todo.id)}>×</button>
          </li>
        ))}
      </ul>
      <footer>
        <span>{state.computed.activeCount as number} items left</span>
        <div>
          {["all", "active", "completed"].map((f) => (
            <button
              key={f}
              className={filter === f ? "selected" : ""}
              onClick={() => todoApp.act("setFilter", { newFilter: f })}
            >
              {f}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
```

---

## Form with Validation

A form example with client-side validation and server submission.

### Domain (MEL)

```mel
domain ContactForm {
  state {
    name: string = ""
    email: string = ""
    message: string = ""
    errors: {
      name: string | null,
      email: string | null,
      message: string | null
    } = { name: null, email: null, message: null }
    status: string = "idle"
    submitResult: string | null = null
  }

  // Computed validation
  computed isValid = and(
    and(
      gt(len(name), 0),
      isNull(errors.name)
    ),
    and(
      gt(len(email), 0),
      isNull(errors.email)
    )
  )

  // Update field
  action updateField(field: string, value: string) {
    once(updateFieldIntent) {
      patch updateFieldIntent = $meta.intentId
      patch $path(field) = value

      // Clear error when user types
      patch errors = merge(errors, { $key(field): null })
    }
  }

  // Validate field
  action validateField(field: string) {
    once(validateFieldIntent) {
      patch validateFieldIntent = $meta.intentId

      when eq(field, "email") {
        when not(contains(email, "@")) {
          patch errors = merge(errors, { email: "Invalid email format" })
        }
      }

      when eq(field, "name") {
        when lt(len(name), 2) {
          patch errors = merge(errors, { name: "Name must be at least 2 characters" })
        }
      }
    }
  }

  // Submit form
  action submit() {
    once(submitIntent) {
      patch submitIntent = $meta.intentId
      patch status = "submitting"
      effect api.submitForm({
        name: name,
        email: email,
        message: message
      })
    }
  }

  // Reset form
  action reset() {
    once(resetIntent) {
      patch resetIntent = $meta.intentId
      patch name = ""
      patch email = ""
      patch message = ""
      patch errors = { name: null, email: null, message: null }
      patch status = "idle"
      patch submitResult = null
    }
  }
}
```

### App & Services

```typescript
const services: ServiceMap = {
  "api.submitForm": async (params, ctx) => {
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error("Submission failed");
      }

      return [
        ctx.patch.set("status", "success"),
        ctx.patch.set("submitResult", "Thank you! We'll be in touch."),
      ];
    } catch (error) {
      return [
        ctx.patch.set("status", "error"),
        ctx.patch.set("submitResult", error.message),
      ];
    }
  },
};

export const formApp = createApp(FormMel, { services });
```

### React Component

```tsx
function ContactForm() {
  const [state, setState] = useState<AppState<FormData> | null>(null);

  useEffect(() => {
    formApp.ready().then(() => {
      setState(formApp.getState<FormData>());
      return formApp.subscribe((s) => s, (s) => setState(s as AppState<FormData>));
    });
  }, []);

  if (!state) return null;

  const { name, email, message, errors, status, submitResult } = state.data;

  return (
    <form onSubmit={(e) => { e.preventDefault(); formApp.act("submit"); }}>
      <div>
        <input
          value={name}
          onChange={(e) => formApp.act("updateField", { field: "name", value: e.target.value })}
          onBlur={() => formApp.act("validateField", { field: "name" })}
          placeholder="Name"
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </div>

      <div>
        <input
          value={email}
          onChange={(e) => formApp.act("updateField", { field: "email", value: e.target.value })}
          onBlur={() => formApp.act("validateField", { field: "email" })}
          placeholder="Email"
        />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>

      <div>
        <textarea
          value={message}
          onChange={(e) => formApp.act("updateField", { field: "message", value: e.target.value })}
          placeholder="Message"
        />
      </div>

      <button
        type="submit"
        disabled={!(state.computed.isValid as boolean) || status === "submitting"}
      >
        {status === "submitting" ? "Sending..." : "Send"}
      </button>

      {submitResult && (
        <div className={status === "success" ? "success" : "error"}>
          {submitResult}
        </div>
      )}
    </form>
  );
}
```

---

## Data Sync Pattern

Synchronizing local state with a remote server.

### Domain (MEL)

```mel
domain DataSync {
  state {
    items: Array<Item> = []
    syncStatus: string = "idle"
    lastSyncAt: number | null = null
    pendingChanges: number = 0
  }

  // Pull from server
  action sync() {
    once(syncIntent) {
      patch syncIntent = $meta.intentId
      patch syncStatus = "syncing"
      effect api.fetchItems({})
    }
  }

  // Local add with server sync
  action addItem(name: string) {
    once(addItemIntent) {
      patch addItemIntent = $meta.intentId
      let newItem = {
        id: $system.uuid,
        name: name,
        synced: false
      }
      patch items = append(items, newItem)
      patch pendingChanges = add(pendingChanges, 1)
      effect api.createItem(newItem)
    }
  }

  // Mark item as synced
  action markSynced(id: string) {
    once(markSyncedIntent) {
      patch markSyncedIntent = $meta.intentId
      patch items = map(items, fn(item) =>
        cond(eq(item.id, id),
          merge(item, { synced: true }),
          item
        )
      )
      patch pendingChanges = sub(pendingChanges, 1)
    }
  }
}
```

### Services with Retry

```typescript
const services: ServiceMap = {
  "api.fetchItems": async (params, ctx) => {
    try {
      const items = await fetchWithRetry("/api/items", 3);
      return [
        ctx.patch.set("items", items),
        ctx.patch.set("syncStatus", "synced"),
        ctx.patch.set("lastSyncAt", Date.now()),
      ];
    } catch (error) {
      return [
        ctx.patch.set("syncStatus", "error"),
      ];
    }
  },

  "api.createItem": async (params, ctx) => {
    try {
      await fetchWithRetry("/api/items", 3, {
        method: "POST",
        body: JSON.stringify(params),
      });

      // Trigger mark synced via enqueue
      return [
        // Patches applied immediately
      ];
    } catch (error) {
      // Item remains with synced: false
      return [];
    }
  },
};

async function fetchWithRetry(url: string, retries: number, opts?: RequestInit) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

---

## Multi-Branch Workflow

Document editing with draft/publish workflow.

### Domain (MEL)

```mel
domain Document {
  state {
    title: string = ""
    content: string = ""
    published: boolean = false
    publishedAt: number | null = null
    version: number = 1
  }

  action updateTitle(title: string) {
    once(updateTitleIntent) {
      patch updateTitleIntent = $meta.intentId
      patch title = title
      patch version = add(version, 1)
    }
  }

  action updateContent(content: string) {
    once(updateContentIntent) {
      patch updateContentIntent = $meta.intentId
      patch content = content
      patch version = add(version, 1)
    }
  }

  action publish() {
    once(publishIntent) {
      patch publishIntent = $meta.intentId
      patch published = true
      patch publishedAt = $system.now
    }
  }
}
```

### Workflow Implementation

```typescript
class DocumentEditor {
  private draftBranch: Branch | null = null;

  async startEditing() {
    // Create draft branch
    this.draftBranch = await app.fork({
      name: `draft-${Date.now()}`,
    });
  }

  async updateTitle(title: string) {
    if (!this.draftBranch) throw new Error("Not editing");
    await this.draftBranch.act("updateTitle", { title }).done();
  }

  async updateContent(content: string) {
    if (!this.draftBranch) throw new Error("Not editing");
    await this.draftBranch.act("updateContent", { content }).done();
  }

  getDraftState() {
    return this.draftBranch?.getState();
  }

  async discardDraft() {
    // Just switch back to main
    await app.switchBranch("main");
    this.draftBranch = null;
  }

  async publishDraft() {
    if (!this.draftBranch) throw new Error("No draft");

    // Get draft content
    const draft = this.draftBranch.getState();

    // Switch to main
    await app.switchBranch("main");

    // Apply changes to main
    await app.act("updateTitle", { title: draft.data.title }).done();
    await app.act("updateContent", { content: draft.data.content }).done();
    await app.act("publish").done();

    this.draftBranch = null;
  }
}
```

---

## Real-Time Collaboration

Multi-user editing with session tracking.

```typescript
class CollaborativeEditor {
  private sessions = new Map<string, Session>();
  private cursors = new Map<string, { x: number; y: number }>();

  join(userId: string, userName: string): Session {
    const session = app.session(userId, {
      kind: "human",
      name: userName,
    });
    this.sessions.set(userId, session);
    return session;
  }

  leave(userId: string) {
    this.sessions.delete(userId);
    this.cursors.delete(userId);
  }

  updateCursor(userId: string, x: number, y: number) {
    this.cursors.set(userId, { x, y });
    // Broadcast to other users
    this.broadcast("cursor", { userId, x, y });
  }

  async edit(userId: string, content: string) {
    const session = this.sessions.get(userId);
    if (!session) throw new Error("User not in session");

    await session.act("updateContent", { content }).done();
  }

  getCursors() {
    return Object.fromEntries(this.cursors);
  }

  private broadcast(type: string, data: unknown) {
    // WebSocket broadcast implementation
  }
}
```

---

## More Examples

For more complete examples, check out the example apps in the repository:

- **todo-app** — Full todo application with React
- **logistics-app** — Complex multi-step workflow example

Clone the repository and explore:

```bash
git clone https://github.com/manifesto-ai/core
cd core
pnpm install
pnpm dev:todo     # Run todo app
pnpm dev:logistics # Run logistics app
```
