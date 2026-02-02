# Tutorial 2: Actions and State

> **Time:** 20 minutes
> **Goal:** Master state mutations and computed values

In this tutorial, you'll build a todo list application to learn how actions, state, computed values, and patch operations work together.

---

## What You'll Build

A todo list with:
- Add, toggle, and remove todos
- Filter by status (all, active, completed)
- Computed counts (active, completed)

---

## Step 1: Define the State

Create `todo.mel`:

```mel
domain TodoApp {
  // Define a named type for Todo items
  type Todo = {
    id: string,
    title: string,
    completed: boolean
  }

  state {
    todos: Array<Todo> = []
    filter: "all" | "active" | "completed" = "all"
  }
}
```

**Key points:**
- `type Todo = {...}` defines a reusable type
- `Array<Todo>` creates a typed array
- `"all" | "active" | "completed"` is a union type (enum-like)
- Every state field needs a default value

---

## Step 2: Add Computed Values

Computed values derive from state. They're recalculated automatically when dependencies change.

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

  // Computed values
  computed todoCount = len(todos)
  computed completedCount = len(filter(todos, fn(t) => t.completed))
  computed activeCount = sub(todoCount, completedCount)
  computed hasCompleted = gt(completedCount, 0)
}
```

**Key points:**
- Computed values are expressions, not functions
- They can reference state fields and other computed values
- They form a Directed Acyclic Graph (no circular dependencies)
- They're never stored, always recalculated

Access computed values in your code:

```typescript
const state = app.getState();
console.log(state.computed.activeCount);     // number
console.log(state.computed.hasCompleted);    // boolean
```

---

## Step 3: Add the AddTodo Action

```mel
action addTodo(title: string) {
  // Only add if title is not empty
  onceIntent when neq(trim(title), "") {
    patch todos = append(todos, {
      id: $system.uuid,
      title: trim(title),
      completed: false
    })
  }
}
```

**New concepts:**

| Element | Description |
|---------|-------------|
| `(title: string)` | Action parameter with type |
| `onceIntent when condition` | Guard with additional condition |
| `trim(title)` | Built-in function to remove whitespace |
| `neq(a, b)` | Not equal comparison |
| `$system.uuid` | System-provided unique ID |
| `append(array, item)` | Creates new array with item added |

> **Note:** `onceIntent` stores guard state in the platform `$mel` namespace. Use `once()` only when you need an explicit guard field in domain state.

**Using action parameters:**

```typescript
await app.act("addTodo", { title: "Buy groceries" }).done();
```

---

## Step 4: Add Toggle and Remove Actions

```mel
action toggleTodo(id: string) {
  onceIntent {
    patch todos = map(todos, fn(t) =>
      cond(eq(t.id, id),
        merge(t, { completed: not(t.completed) }),
        t
      )
    )
  }
}

action removeTodo(id: string) {
  onceIntent {
    patch todos = filter(todos, fn(t) => neq(t.id, id))
  }
}
```

**Array transformation functions:**

| Function | What It Does |
|----------|--------------|
| `map(array, fn)` | Transform each element |
| `filter(array, fn)` | Keep elements matching condition |
| `cond(test, then, else)` | Ternary expression |
| `merge(obj, updates)` | Shallow merge objects |
| `not(value)` | Boolean negation |

---

## Step 5: Add Filter Action

```mel
action setFilter(newFilter: "all" | "active" | "completed") {
  onceIntent {
    patch filter = newFilter
  }
}
```

**Typed parameters:** The `newFilter` parameter only accepts the three valid values. TypeScript will enforce this at compile time.

---

## Complete Domain

Here's the complete `todo.mel`:

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

  computed todoCount = len(todos)
  computed completedCount = len(filter(todos, fn(t) => t.completed))
  computed activeCount = sub(todoCount, completedCount)
  computed hasCompleted = gt(completedCount, 0)

  action addTodo(title: string) {
    onceIntent when neq(trim(title), "") {
      patch todos = append(todos, {
        id: $system.uuid,
        title: trim(title),
        completed: false
      })
    }
  }

  action toggleTodo(id: string) {
    onceIntent {
      patch todos = map(todos, fn(t) =>
        cond(eq(t.id, id),
          merge(t, { completed: not(t.completed) }),
          t
        )
      )
    }
  }

  action removeTodo(id: string) {
    onceIntent {
      patch todos = filter(todos, fn(t) => neq(t.id, id))
    }
  }

  action setFilter(newFilter: "all" | "active" | "completed") {
    onceIntent {
      patch filter = newFilter
    }
  }

  action clearCompleted() {
    onceIntent when hasCompleted {
      patch todos = filter(todos, fn(t) => not(t.completed))
    }
  }
}
```

---

## Step 6: Use the App

Create `main.ts`:

```typescript
import { createApp } from "@manifesto-ai/app";
import TodoMel from "./todo.mel";

const app = createApp(TodoMel);

async function main() {
  await app.ready();

  // Subscribe to state changes
  app.subscribe(
    (state) => ({
      count: state.computed.todoCount,
      active: state.computed.activeCount,
      completed: state.computed.completedCount
    }),
    (counts) => console.log("Counts:", counts)
  );

  // Add some todos
  await app.act("addTodo", { title: "Learn Manifesto" }).done();
  // Counts: { count: 1, active: 1, completed: 0 }

  await app.act("addTodo", { title: "Build an app" }).done();
  // Counts: { count: 2, active: 2, completed: 0 }

  // Get current todos
  const state = app.getState();
  const todos = state.data.todos;
  console.log("Todos:", todos);

  // Toggle first todo
  await app.act("toggleTodo", { id: todos[0].id }).done();
  // Counts: { count: 2, active: 1, completed: 1 }

  // Clear completed
  await app.act("clearCompleted").done();
  // Counts: { count: 1, active: 1, completed: 0 }

  await app.dispose();
}

main().catch(console.error);
```

---

## Understanding State Structure

Every Manifesto app has this state structure:

```typescript
type AppState = {
  data: {
    // Your state fields
    todos: Todo[];
    filter: "all" | "active" | "completed";
  };

  computed: {
    // Your computed values
    todoCount: number;
    activeCount: number;
    completedCount: number;
    hasCompleted: boolean;
  };

  system: {
    // Runtime state
    status: "idle" | "computing" | "pending" | "error";
    lastError: ErrorValue | null;
    errors: ErrorValue[];
    pendingRequirements: Requirement[];
    currentAction: string | null;
  };

  input: unknown;  // Current action's input (transient)

  meta: {
    version: number;    // Increments on every change
    timestamp: number;  // Last change time
    randomSeed: string; // For deterministic random
    schemaHash: string; // Schema identifier
  };
};
```

**Accessing different sections:**

```typescript
const state = app.getState();

// Domain data
state.data.todos
state.data.filter

// Computed values
state.computed.activeCount
state.computed.hasCompleted

// System state
state.system.status
state.system.lastError

// Metadata
state.meta.version
```

---

## Patch Operations

Manifesto supports three patch operations:

### 1. Set (Replace Value)

```mel
patch count = 0
patch user.name = "Alice"
patch todos = append(todos, newTodo)
```

Creates or replaces the value at the path.

### 2. Unset (Remove Property)

```mel
patch selectedId unset
patch users[id] unset
```

Removes the property. Only valid for optional fields and record keys.

### 3. Merge (Shallow Merge)

```mel
patch user merge { name: "Bob" }
patch settings merge $input.updates
```

Shallow merges the object. Only modifies specified keys.

**Example using all three:**

```mel
action updateUser(updates: { name: string | null, email: string | null }) {
  onceIntent {

    // Set: Replace entire name if provided
    when isNotNull(updates.name) {
      patch user.name = updates.name
    }

    // Merge: Partial update of settings
    patch user.settings merge { lastUpdated: $system.timestamp }

    // Unset: Remove temporary flag
    patch user.pendingChanges unset
  }
}
```

---

## Control Flow in Actions

### when (Conditional Guard)

Executes body only when condition is true:

```mel
action decrement() {
  // Only runs when count > 0
  when gt(count, 0) {
    patch count = sub(count, 1)
  }
}
```

### once (Idempotency Guard)

Ensures body runs once per intent:

```mel
action submit() {
  onceIntent {
    // This runs exactly once
  }
}
```

### Combined: once with when

```mel
action submitIfValid() {
  // Runs once AND only if valid
  onceIntent when isValid {
    patch status = "submitted"
  }
}
```

### fail (Error Termination)

Terminates with an error:

```mel
action createTodo(title: string) {
  when eq(trim(title), "") {
    fail "EMPTY_TITLE" with "Title cannot be empty"
  }

  onceIntent {
    patch todos = append(todos, { ... })
  }
}
```

### stop (Early Exit)

Terminates successfully with no action:

```mel
action complete(id: string) {
  // Already done - nothing to do
  when eq(at(todos, id).completed, true) {
    stop "already_completed"
  }

  // Normal completion
  onceIntent {
    patch todos[id].completed = true
  }
}
```

---

## Available When (Preconditions)

Use `available when` to disable actions based on state:

```mel
action clearCompleted() available when hasCompleted {
  onceIntent {
    patch todos = filter(todos, fn(t) => not(t.completed))
  }
}
```

If `hasCompleted` is false, calling `clearCompleted` will be a no-op.

---

## Exercises

### Exercise 1: Edit Todo Title

Add an action to edit a todo's title:

```mel
action editTodo(id: string, newTitle: string) {
  onceIntent when neq(trim(newTitle), "") {
    patch todos = map(todos, fn(t) =>
      cond(eq(t.id, id),
        merge(t, { title: trim(newTitle) }),
        t
      )
    )
  }
}
```

### Exercise 2: Add Due Date

Extend the Todo type and add related computed:

```mel
type Todo = {
  id: string,
  title: string,
  completed: boolean,
  dueDate: number | null
}

computed overdueTodos = filter(todos, fn(t) =>
  and(
    not(t.completed),
    and(
      isNotNull(t.dueDate),
      lt(t.dueDate, $system.timestamp)
    )
  )
)
```

### Exercise 3: Batch Operations

Add actions for bulk operations:

```mel
action completeAll() {
  onceIntent when gt(activeCount, 0) {
    patch todos = map(todos, fn(t) => merge(t, { completed: true }))
  }
}

action uncompleteAll() {
  onceIntent when gt(completedCount, 0) {
    patch todos = map(todos, fn(t) => merge(t, { completed: false }))
  }
}
```

---

## Key Concepts Learned

| Concept | Description |
|---------|-------------|
| **Named types** | `type Todo = {...}` for reusable structures |
| **Union types** | `"a" \| "b" \| "c"` for enum-like values |
| **Computed values** | Derived values that auto-update |
| **Action parameters** | Typed inputs to actions |
| **Array functions** | `map`, `filter`, `append` for transformations |
| **Patch operations** | `set`, `unset`, `merge` |
| **Control flow** | `when`, `once`, `fail`, `stop` |
| **State structure** | `data`, `computed`, `system`, `input`, `meta` |

---

## What's Next?

In the next tutorial, you'll learn about **Effects** - how to:
- Connect to external APIs
- Handle async operations
- Manage loading and error states

[Learn about Effects](/concepts/effect) | [Effect Handlers Guide](/guides/effect-handlers)

---

## Reference

### Built-in Functions

| Function | Description |
|----------|-------------|
| `len(array)` | Array length |
| `append(array, item)` | Add item to end |
| `map(array, fn)` | Transform each item |
| `filter(array, fn)` | Keep matching items |
| `at(array, index)` | Get item at index |
| `first(array)` | Get first item |
| `last(array)` | Get last item |
| `sum(array)` | Sum of numbers |
| `min(array)` | Minimum value |
| `max(array)` | Maximum value |

### Comparison Functions

| Function | Description |
|----------|-------------|
| `eq(a, b)` | Equal |
| `neq(a, b)` | Not equal |
| `gt(a, b)` | Greater than |
| `gte(a, b)` | Greater than or equal |
| `lt(a, b)` | Less than |
| `lte(a, b)` | Less than or equal |

### Boolean Functions

| Function | Description |
|----------|-------------|
| `and(a, b)` | Logical AND |
| `or(a, b)` | Logical OR |
| `not(a)` | Logical NOT |
| `isNull(a)` | Is null |
| `isNotNull(a)` | Is not null |

### String Functions

| Function | Description |
|----------|-------------|
| `trim(s)` | Remove whitespace |
| `lower(s)` | Lowercase |
| `upper(s)` | Uppercase |
| `strlen(s)` | String length |
| `concat(a, b, ...)` | Join strings |

For complete reference, see [MEL Syntax](/mel/SYNTAX).
