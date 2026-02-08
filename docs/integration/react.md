# React Integration Guide

> **Covers:** Using Manifesto with React applications
> **Purpose:** Build reactive UIs with Manifesto state management
> **Prerequisites:** Basic React knowledge, completed Getting Started

---

## Overview

Manifesto integrates with React through the `@manifesto-ai/app` package's subscription API:

- `app.subscribe()` - Subscribe to state changes with selectors
- `app.act()` - Dispatch actions
- `app.getState()` - Access current state

**Key principle:** React components subscribe to Snapshot slices. When those slices change, components re-render. Components dispatch actions via `app.act()` - they never mutate state directly.

---

## Installation

```bash
npm install @manifesto-ai/app @manifesto-ai/compiler react react-dom
```

---

## Basic Setup

### 1. Create the App Instance

```typescript
// src/manifesto-app.ts
import { createApp } from '@manifesto-ai/app';
import CounterMel from './counter.mel';

export const app = createApp({ schema: CounterMel, effects: {} });
```

### 2. Create Custom React Hooks

Since there's no dedicated React package yet, create your own hooks:

```tsx
// src/hooks/useManifesto.ts
import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { app } from '../manifesto-app';

// Hook to subscribe to state changes
export function useSnapshot<T>(selector: (state: any) => T): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => app.subscribe(() => true, onStoreChange),
    []
  );

  const getSnapshot = useCallback(() => selector(app.getState()), [selector]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

// Hook to get action dispatcher
export function useAction(actionName: string) {
  return useCallback(
    (input?: Record<string, unknown>) => app.act(actionName, input),
    [actionName]
  );
}
```

### 3. Use in Components

```tsx
// src/components/Counter.tsx
import { useSnapshot, useAction } from '../hooks/useManifesto';

export function Counter() {
  const count = useSnapshot(s => s.data.count);
  const doubled = useSnapshot(s => s.computed["computed.doubled"]);
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

## Alternative: Direct Subscription

For simpler cases, you can subscribe directly without custom hooks:

```tsx
import { useState, useEffect } from 'react';
import { app } from '../manifesto-app';

function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Initialize app
    app.ready().then(() => {
      setCount(app.getState().data.count);
    });

    // Subscribe to changes
    const unsubscribe = app.subscribe(
      (state) => state.data.count,
      (newCount) => setCount(newCount)
    );

    return () => unsubscribe();
  }, []);

  const handleIncrement = async () => {
    await app.act('increment').done();
  };

  const handleDecrement = async () => {
    await app.act('decrement').done();
  };

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={handleIncrement}>+</button>
      <button onClick={handleDecrement}>-</button>
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
const total = useSnapshot(s => s.computed["computed.totalItems"]);

// Select nested object
const user = useSnapshot(s => s.data.user);

// Select system status
const status = useSnapshot(s => s.system.status);
```

**Behavior:**
- Component re-renders only when selected value changes
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

**Returns:** A function that accepts action input and returns an ActionHandle with `done(): Promise<void>`.

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
const activeCount = useSnapshot(s => s.computed["computed.activeCount"]);
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

  computed activeTodos = filter(todos, not($item.completed))
}
```

Then select the computed directly:

```tsx
const activeTodos = useSnapshot(s => s.computed["computed.activeTodos"]);
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
const state = app.getState();
state.data.count = 5; // This does nothing and breaks React!
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

## Complete Example: Counter with React

### counter.mel

```mel
domain Counter {
  state {
    count: number = 0
  }

  computed doubled = mul(count, 2)

  action increment() {
    onceIntent {
      patch count = add(count, 1)
    }
  }

  action decrement() {
    onceIntent {
      patch count = sub(count, 1)
    }
  }
}
```

### manifesto-app.ts

```typescript
import { createApp } from '@manifesto-ai/app';
import CounterMel from './counter.mel';

export const app = createApp({ schema: CounterMel, effects: {} });
```

### hooks/useManifesto.ts

```typescript
import { useCallback, useSyncExternalStore } from 'react';
import { app } from '../manifesto-app';

export function useSnapshot<T>(selector: (state: any) => T): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => app.subscribe(() => true, onStoreChange),
    []
  );

  const getSnapshot = useCallback(() => selector(app.getState()), [selector]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useAction(actionName: string) {
  return useCallback(
    (input?: Record<string, unknown>) => app.act(actionName, input),
    [actionName]
  );
}
```

### App.tsx

```tsx
import { useSnapshot, useAction } from './hooks/useManifesto';

function Counter() {
  const count = useSnapshot(s => s.data.count);
  const doubled = useSnapshot(s => s.computed["computed.doubled"]);
  const increment = useAction('increment');
  const decrement = useAction('decrement');

  return (
    <div>
      <h1>Manifesto Counter</h1>
      <p>Count: {count}</p>
      <p>Doubled: {doubled}</p>
      <button onClick={() => increment()}>+</button>
      <button onClick={() => decrement()}>-</button>
    </div>
  );
}

export default function App() {
  return <Counter />;
}
```

---

## Troubleshooting

### "App is not ready"

Always ensure the app is ready before using:

```tsx
useEffect(() => {
  app.ready().then(() => {
    // Now safe to use
  });
}, []);
```

### Component Not Updating

1. **Check your selector** - It should return a primitive or stable reference
2. **Verify action completes** - Use `.done()` to await completion
3. **Check subscription** - Ensure `app.subscribe()` is called correctly

### Action Not Triggering

1. Verify the action name matches your MEL domain exactly
2. Check browser console for errors
3. Verify the action's guard conditions in MEL

---

## See Also

- [Getting Started](/quickstart) - First app tutorial
- [Todo App Tutorial](/tutorial/04-todo-app) - Complete CRUD example
- [Effect Handlers](/guides/effect-handlers) - API integration
- [Re-entry Safety](/guides/reentry-safe-flows) - Guard patterns
