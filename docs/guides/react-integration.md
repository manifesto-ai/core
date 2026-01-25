# React Integration Guide

> **Covers:** Using Manifesto with React applications
> **Purpose:** Build reactive UIs with Manifesto state management
> **Prerequisites:** Basic React knowledge, completed Getting Started

---

## Overview

Manifesto integrates with React through the `@manifesto-ai/react` package, providing:
- `ManifestoProvider` - Context provider for app instance
- `useManifesto` - Access the full app instance
- `useSnapshot` - Subscribe to state changes with selectors
- `useAction` - Get action dispatch functions

**Key principle:** React components subscribe to Snapshot slices. When those slices change, components re-render. Components dispatch actions via Bridge - they never mutate state directly.

---

## Installation

```bash
npm install @manifesto-ai/react
```

---

## Basic Setup

### 1. Create the Provider

```tsx
// app/providers.tsx
import { ManifestoProvider } from '@manifesto-ai/react';
import { createApp } from '@manifesto-ai/app';
import CounterMel from './counter.mel';

const app = createApp(CounterMel);

export function Providers({ children }) {
  return (
    <ManifestoProvider app={app}>
      {children}
    </ManifestoProvider>
  );
}
```

### 2. Use in Components

```tsx
// components/Counter.tsx
import { useSnapshot, useAction } from '@manifesto-ai/react';

export function Counter() {
  const count = useSnapshot(s => s.data.count);
  const doubled = useSnapshot(s => s.computed.doubled);
  const increment = useAction('increment');
  const decrement = useAction('decrement');

  return (
    <div>
      <p>Count: {count} (doubled: {doubled})</p>
      <button onClick={() => increment()}>+</button>
      <button onClick={() => decrement()}>-</button>
    </div>
  );
}
```

---

## Hooks Reference

### useSnapshot(selector)

Subscribes to state changes and returns the selected value.

```tsx
// Select a single value
const count = useSnapshot(s => s.data.count);

// Select computed value
const total = useSnapshot(s => s.computed.totalItems);

// Select nested object
const user = useSnapshot(s => s.data.user);

// Select system status
const status = useSnapshot(s => s.system.status);
```

**Behavior:**
- Component re-renders only when selected value changes
- Uses shallow equality by default
- Selector runs on every Snapshot update

### useAction(actionName)

Returns a dispatch function for the named action.

```tsx
const addTodo = useAction('addTodo');
const deleteTodo = useAction('deleteTodo');

// Call with input
addTodo({ title: 'New Todo' });

// Wait for completion
await addTodo({ title: 'New Todo' }).done();
```

**Returns:** A function that accepts action input and returns `{ done(): Promise<void> }`.

### useManifesto()

Returns the full app instance. Use sparingly - prefer specific hooks.

```tsx
const app = useManifesto();

// Access snapshot directly
const snapshot = app.getSnapshot();

// Access schema
const schema = app.schema;
```

---

## Performance Optimization

### Selector Functions

The selector you pass to `useSnapshot` determines when re-renders happen.

```tsx
// BAD: Re-renders on ANY state change
const state = useSnapshot(s => s);

// BAD: Creates new object every time
const data = useSnapshot(s => ({ count: s.data.count, status: s.system.status }));

// GOOD: Re-renders only when count changes
const count = useSnapshot(s => s.data.count);

// GOOD: Re-renders only when specific computed changes
const activeCount = useSnapshot(s => s.computed.activeCount);
```

### Memoized Selectors

For derived data, memoize your selectors:

```tsx
import { useCallback } from 'react';

function TodoList() {
  // Memoize the selector
  const selectActiveTodos = useCallback(
    (s) => s.data.todos.filter(t => !t.completed),
    []
  );

  const activeTodos = useSnapshot(selectActiveTodos);

  return (
    <ul>
      {activeTodos.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

**Better approach:** Define computed values in your MEL domain instead:

```mel
domain TodoDomain {
  state {
    todos: Array<Todo> = []
  }

  computed {
    activeTodos: filter(todos, (t) => not(t.completed))
  }
}
```

Then select the computed directly:

```tsx
const activeTodos = useSnapshot(s => s.computed.activeTodos);
```

---

## Common Patterns

### Loading States

```tsx
function UserProfile({ userId }) {
  const status = useSnapshot(s => s.data.userStatus);
  const user = useSnapshot(s => s.data.user);
  const error = useSnapshot(s => s.data.userError);
  const fetchUser = useAction('fetchUser');

  useEffect(() => {
    fetchUser({ id: userId });
  }, [userId, fetchUser]);

  if (status === 'loading') return <Spinner />;
  if (status === 'error') return <Error message={error} />;
  if (!user) return null;

  return <Profile user={user} />;
}
```

### Form Handling

```tsx
function TodoForm() {
  const [title, setTitle] = useState('');
  const addTodo = useAction('addTodo');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    await addTodo({ title }).done();
    setTitle('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="What needs to be done?"
      />
      <button type="submit">Add</button>
    </form>
  );
}
```

### Conditional Rendering Based on State

```tsx
function AuthGate({ children }) {
  const isAuthenticated = useSnapshot(s => s.data.isAuthenticated);
  const authStatus = useSnapshot(s => s.data.authStatus);

  if (authStatus === 'checking') {
    return <Spinner />;
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return children;
}
```

### Multiple Actions in One Handler

```tsx
function TodoItem({ id }) {
  const todo = useSnapshot(s => s.data.todos.find(t => t.id === id));
  const toggleTodo = useAction('toggleTodo');
  const deleteTodo = useAction('deleteTodo');

  if (!todo) return null;

  return (
    <li>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => toggleTodo({ id })}
      />
      <span>{todo.title}</span>
      <button onClick={() => deleteTodo({ id })}>Delete</button>
    </li>
  );
}
```

---

## Anti-Patterns

### Direct State Mutation (FORBIDDEN)

```tsx
// WRONG: Never mutate snapshot
const app = useManifesto();
app.getSnapshot().data.count = 5; // This does nothing and breaks React!
```

**Fix:** Always use actions.

### Business Logic in Components (AVOID)

```tsx
// WRONG: Domain logic in component
function TodoList() {
  const todos = useSnapshot(s => s.data.todos);
  const addTodo = useAction('addTodo');

  const handleAdd = (title) => {
    // Business rule in component!
    if (todos.length >= 100) {
      alert('Too many todos');
      return;
    }
    addTodo({ title });
  };
}
```

**Fix:** Put business rules in your MEL domain:

```mel
action addTodo(title: string) {
  when gte(len(todos), 100) {
    fail "TOO_MANY_TODOS"
  }
  when lt(len(todos), 100) {
    // ... add todo
  }
}
```

---

## Troubleshooting

### "Cannot find ManifestoProvider"

Your component is not wrapped in `ManifestoProvider`. Check your component tree.

```tsx
// Make sure Provider wraps your app
<ManifestoProvider app={app}>
  <App />
</ManifestoProvider>
```

### Component Not Updating

1. **Check your selector** - It should return a primitive or stable reference
2. **Verify action completes** - Use `.done()` to await completion
3. **Check for selector creating new objects** - See Performance Optimization section

### Action Not Triggering

1. Verify the action name matches your MEL domain exactly
2. Check browser console for errors
3. Verify the action's guard conditions in MEL

---

## See Also

- [Getting Started](/quickstart) - First app tutorial
- [Todo Example](/guides/todo-example) - Complete CRUD example
- [Effect Handlers](/guides/effect-handlers) - API integration
- [Re-entry Safety](/guides/reentry-safe-flows) - Guard patterns
