# React Guide

> **Purpose:** Practical guide for using @manifesto-ai/react
> **Prerequisites:** React basics, understanding of Builder
> **Time to complete:** ~15 minutes

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Common Patterns](#common-patterns)
4. [Advanced Usage](#advanced-usage)
5. [Common Mistakes](#common-mistakes)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

```bash
npm install @manifesto-ai/react @manifesto-ai/builder zod react
```

### Minimal Setup

```tsx
import { z } from "zod";
import { defineDomain, expr, flow } from "@manifesto-ai/builder";
import { createManifestoApp } from "@manifesto-ai/react";

// 1. Define domain
const CounterDomain = defineDomain(
  z.object({ count: z.number().default(0) }),
  ({ state, actions }) => ({
    actions: {
      increment: actions.define({
        flow: () => flow.patch(state.count).set(expr.add(state.count, 1)),
      }),
    },
  })
);

// 2. Create app
const Counter = createManifestoApp(CounterDomain, {
  initialState: { count: 0 },
});

// 3. Use in components
function App() {
  return (
    <Counter.Provider>
      <CounterDisplay />
    </Counter.Provider>
  );
}

function CounterDisplay() {
  const count = Counter.useValue((s) => s.count);
  const { increment } = Counter.useActions();

  return (
    <button onClick={() => increment()}>
      Count: {count}
    </button>
  );
}
```

---

## Basic Usage

### Use Case 1: Reading State with useValue

**Goal:** Subscribe to specific parts of state.

```tsx
function TodoStats() {
  // Only re-renders when these values change
  const total = Counter.useValue((s) => s.todos.length);
  const remaining = Counter.useValue((s) => s.remaining);
  const filter = Counter.useValue((s) => s.filter);

  return (
    <div>
      <p>{remaining} of {total} remaining</p>
      <p>Filter: {filter}</p>
    </div>
  );
}
```

### Use Case 2: Dispatching Actions with useActions

**Goal:** Call type-safe actions from components.

```tsx
function TodoForm() {
  const [title, setTitle] = useState("");
  const { add } = TodoApp.useActions();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      add({ title: title.trim() });
      setTitle("");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add todo..."
      />
      <button type="submit">Add</button>
    </form>
  );
}
```

### Use Case 3: Reading Computed Values

**Goal:** Use computed values from domain.

```tsx
function FilteredTodoList() {
  // Computed value from domain
  const visibleTodos = TodoApp.useValue((s) => s.visibleTodos);
  const { toggle, remove } = TodoApp.useActions();

  return (
    <ul>
      {visibleTodos.map((todo) => (
        <li key={todo.id}>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => toggle({ id: todo.id })}
          />
          <span>{todo.title}</span>
          <button onClick={() => remove({ id: todo.id })}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

---

## Common Patterns

### Pattern 1: Filter Controls

**When to use:** UI for changing filter state.

```tsx
function FilterButtons() {
  const filter = TodoApp.useValue((s) => s.filter);
  const { setFilter } = TodoApp.useActions();

  return (
    <div>
      {["all", "active", "completed"].map((f) => (
        <button
          key={f}
          onClick={() => setFilter({ filter: f })}
          style={{ fontWeight: filter === f ? "bold" : "normal" }}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
```

### Pattern 2: Loading States

**When to use:** Show loading indicator during async operations.

```tsx
function UserProfile() {
  const loading = UserApp.useValue((s) => s.loading);
  const user = UserApp.useValue((s) => s.user);
  const error = UserApp.useValue((s) => s.error);
  const { loadUser } = UserApp.useActions();

  useEffect(() => {
    loadUser({ id: "123" });
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>No user found</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

### Pattern 3: Optimistic Updates

**When to use:** Update UI immediately while waiting for server.

```tsx
function TodoItem({ todo }) {
  const { toggle } = TodoApp.useActions();

  const handleToggle = async () => {
    // Action immediately updates local state
    // Effect sends to server
    // If server fails, error is stored in state
    await toggle({ id: todo.id });
  };

  return (
    <li>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={handleToggle}
      />
      {todo.title}
    </li>
  );
}
```

---

## Advanced Usage

### Low-Level API with BridgeProvider

**Prerequisites:** Custom Bridge setup.

```tsx
import { createBridge } from "@manifesto-ai/bridge";
import { BridgeProvider, useValue, useDispatch } from "@manifesto-ai/react";

// Create bridge manually
const bridge = createBridge({
  world,
  schemaHash: "my-app",
  defaultActor: { actorId: "user-1", kind: "human" },
});

function App() {
  return (
    <BridgeProvider bridge={bridge}>
      <MyComponent />
    </BridgeProvider>
  );
}

function MyComponent() {
  // Low-level hooks
  const todos = useValue((s) => s.data.todos);
  const dispatch = useDispatch();

  const handleAdd = () => {
    dispatch({ type: "todo.add", input: { title: "New" } });
  };

  return (/* ... */);
}
```

### Multiple Domains

```tsx
// Create separate apps for each domain
const TodoApp = createManifestoApp(TodoDomain, { initialState: { todos: [] } });
const UserApp = createManifestoApp(UserDomain, { initialState: { user: null } });

function App() {
  return (
    <TodoApp.Provider>
      <UserApp.Provider>
        <MainLayout />
      </UserApp.Provider>
    </TodoApp.Provider>
  );
}

function MainLayout() {
  const todos = TodoApp.useValue((s) => s.todos);
  const user = UserApp.useValue((s) => s.user);

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <p>You have {todos.length} todos</p>
    </div>
  );
}
```

### Custom Selectors with Memoization

```tsx
import { useMemo } from "react";

function ExpensiveComponent() {
  const todos = TodoApp.useValue((s) => s.todos);

  // Memoize expensive computation
  const stats = useMemo(() => ({
    total: todos.length,
    completed: todos.filter(t => t.completed).length,
    byCategory: groupBy(todos, 'category'),
  }), [todos]);

  return (
    <div>
      <p>Total: {stats.total}</p>
      <p>Completed: {stats.completed}</p>
    </div>
  );
}
```

---

## Common Mistakes

### Mistake 1: Not Wrapping with Provider

**What people do:**

```tsx
// Wrong: No Provider
function App() {
  const count = Counter.useValue((s) => s.count); // Error!
  return <div>{count}</div>;
}
```

**Why it's wrong:** Hooks require Provider context.

**Correct approach:**

```tsx
// Right: Wrap with Provider
function App() {
  return (
    <Counter.Provider>
      <CounterDisplay />
    </Counter.Provider>
  );
}

function CounterDisplay() {
  const count = Counter.useValue((s) => s.count);
  return <div>{count}</div>;
}
```

### Mistake 2: Selecting Too Much State

**What people do:**

```tsx
// Wrong: Selecting entire state
function TodoItem({ id }) {
  const state = TodoApp.useValue((s) => s); // Re-renders on ANY change!
  const todo = state.todos.find(t => t.id === id);
  return <div>{todo.title}</div>;
}
```

**Why it's wrong:** Component re-renders whenever any state changes.

**Correct approach:**

```tsx
// Right: Select only what you need
function TodoItem({ id }) {
  const todo = TodoApp.useValue((s) => s.todos.find(t => t.id === id));
  return <div>{todo?.title}</div>;
}
```

### Mistake 3: Calling Actions in Render

**What people do:**

```tsx
// Wrong: Action in render
function TodoList() {
  const { load } = TodoApp.useActions();
  load(); // Called on every render!
  return <div>...</div>;
}
```

**Why it's wrong:** Creates infinite loop.

**Correct approach:**

```tsx
// Right: Use useEffect
function TodoList() {
  const { load } = TodoApp.useActions();

  useEffect(() => {
    load();
  }, [load]);

  return <div>...</div>;
}
```

---

## Troubleshooting

### Error: "Cannot read property of undefined"

**Cause:** Using hook outside Provider.

**Solution:**

```tsx
// Ensure component is inside Provider
<App.Provider>
  <YourComponent /> {/* Hooks work here */}
</App.Provider>
```

### Component not re-rendering on state change

**Cause:** Selector returns new object reference.

**Solution:**

```tsx
// Wrong: New object every time
const data = App.useValue((s) => ({ a: s.a, b: s.b }));

// Right: Use multiple selectors
const a = App.useValue((s) => s.a);
const b = App.useValue((s) => s.b);

// Or: Use useMemo in component
const data = useMemo(() => ({ a, b }), [a, b]);
```

### Action not updating state

**Cause:** Action threw error or has bug.

**Diagnosis:**

```tsx
const { myAction } = App.useActions();

const handleClick = async () => {
  try {
    const result = await myAction({ input: "value" });
    console.log("Result:", result);
  } catch (e) {
    console.error("Error:", e);
  }
};
```

---

## Testing

### Testing Components

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";

describe("CounterDisplay", () => {
  it("shows count and increments", async () => {
    render(
      <Counter.Provider>
        <CounterDisplay />
      </Counter.Provider>
    );

    expect(screen.getByText("Count: 0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByText("Count: 1")).toBeInTheDocument();
  });
});
```

### Testing with Mock State

```tsx
import { createManifestoApp } from "@manifesto-ai/react";

describe("TodoList", () => {
  it("renders todos", () => {
    // Create test app with initial state
    const TestApp = createManifestoApp(TodoDomain, {
      initialState: {
        todos: [
          { id: "1", title: "Test", completed: false },
        ],
      },
    });

    render(
      <TestApp.Provider>
        <TodoList />
      </TestApp.Provider>
    );

    expect(screen.getByText("Test")).toBeInTheDocument();
  });
});
```

---

## Quick Reference

### Factory API

| API | Purpose | Example |
|-----|---------|---------|
| `createManifestoApp()` | Create app | `createManifestoApp(domain, opts)` |
| `App.Provider` | Context provider | `<App.Provider>...</App.Provider>` |
| `App.useValue()` | Read state | `App.useValue(s => s.count)` |
| `App.useActions()` | Get actions | `const { add } = App.useActions()` |
| `App.useDispatch()` | Raw dispatch | `const dispatch = App.useDispatch()` |

### Low-Level API

| API | Purpose | Example |
|-----|---------|---------|
| `BridgeProvider` | Provide bridge | `<BridgeProvider bridge={...}>` |
| `useBridge()` | Get bridge | `const bridge = useBridge()` |
| `useSnapshot()` | Full snapshot | `const snapshot = useSnapshot()` |
| `useValue()` | Select value | `useValue(s => s.data.x)` |
| `useDispatch()` | Dispatch fn | `const dispatch = useDispatch()` |

---

*End of Guide*
