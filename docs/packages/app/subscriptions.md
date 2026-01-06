# Subscriptions

> Reactive state subscription patterns

Subscriptions allow your UI or other consumers to react to state changes. The `subscribe()` method provides fine-grained control over when and how your listeners are notified.

---

## Basic Usage

### Subscribe to Entire State

```typescript
const unsubscribe = app.subscribe(
  (state) => state,  // Selector: return entire state
  (state) => {
    console.log("State changed:", state);
  }
);

// Later: cleanup
unsubscribe();
```

### Subscribe to Specific Value

```typescript
app.subscribe(
  (state) => state.data.count,  // Only select 'count'
  (count) => {
    console.log("Count is now:", count);
  }
);
```

### Subscribe to Multiple Values

```typescript
app.subscribe(
  (state) => ({
    count: state.data.count,
    total: state.computed.total,
    status: state.system.status,
  }),
  ({ count, total, status }) => {
    console.log(`Count: ${count}, Total: ${total}, Status: ${status}`);
  }
);
```

---

## Selectors

Selectors are functions that extract specific values from the state. They determine:

1. **What** value your listener receives
2. **When** your listener is called (via equality comparison)

### Simple Selector

```typescript
// Select a single value
(state) => state.data.user.name

// Select a computed value
(state) => state.computed.totalPrice

// Select system state
(state) => state.meta.version
```

### Derived Selector

```typescript
// Compute a derived value
(state) => state.data.items.filter(i => i.active).length

// Combine multiple values
(state) => `${state.data.firstName} ${state.data.lastName}`
```

### Object Selector

```typescript
// Return an object (requires custom equality)
(state) => ({
  items: state.data.items,
  filter: state.data.filter,
  sorted: state.data.items.sort((a, b) => a.name.localeCompare(b.name)),
})
```

---

## Batch Modes

The `batchMode` option controls when your listener is invoked.

### immediate

Listener is called for **every snapshot change**, including intermediate states during effect execution.

```typescript
app.subscribe(
  (state) => state.data.count,
  (count) => console.log("Count:", count),
  { batchMode: "immediate" }
);

// Action with multiple patches:
// → Count: 1 (after first patch)
// → Count: 2 (after second patch)
// → Count: 3 (after effect patches)
```

**Use when:** You need real-time updates (e.g., progress indicators, live previews).

### transaction (Default)

Listener is called **once per action completion**.

```typescript
app.subscribe(
  (state) => state.data.count,
  (count) => console.log("Count:", count),
  { batchMode: "transaction" }  // Default
);

// Action with multiple patches:
// → Count: 3 (only after action completes)
```

**Use when:** You want stable, consistent state updates (most UI cases).

### debounce

Listener is called at most once per time window.

```typescript
app.subscribe(
  (state) => state.data.searchQuery,
  (query) => fetchSuggestions(query),
  { batchMode: { debounce: 300 } }  // 300ms debounce
);

// Rapid typing: "a", "ab", "abc"
// → Only calls fetchSuggestions("abc") after 300ms pause
```

**Use when:** You need to throttle expensive operations (search, analytics).

---

## Equality Functions

By default, `Object.is` is used to compare selected values. For objects or arrays, you need a custom equality function.

### Default Equality

```typescript
// Works for primitives
app.subscribe(
  (state) => state.data.count,  // number
  (count) => console.log(count)
  // Uses Object.is by default
);
```

### Custom Equality for Objects

```typescript
app.subscribe(
  (state) => ({
    name: state.data.user.name,
    age: state.data.user.age,
  }),
  (user) => console.log(user),
  {
    equalityFn: (a, b) =>
      a.name === b.name && a.age === b.age,
  }
);
```

### Shallow Equality Helper

```typescript
function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => a[key] === b[key]);
}

app.subscribe(
  (state) => ({ count: state.data.count, name: state.data.name }),
  (data) => console.log(data),
  { equalityFn: shallowEqual }
);
```

### Array Equality

```typescript
function arrayEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item === b[i]);
}

app.subscribe(
  (state) => state.data.items.map(i => i.id),  // Array of IDs
  (ids) => console.log("Items changed:", ids),
  { equalityFn: arrayEqual }
);
```

---

## Fire Immediately

Use `fireImmediately: true` to invoke the listener immediately with the current value:

```typescript
app.subscribe(
  (state) => state.data.theme,
  (theme) => applyTheme(theme),
  { fireImmediately: true }  // Called immediately
);
// → applyTheme() is called right away with current theme
```

This is useful for initialization or synchronizing external state.

---

## React Integration

### Basic Hook Pattern

```tsx
function useAppState<T>(selector: (state: AppState<unknown>) => T): T {
  const [value, setValue] = useState(() => selector(app.getState()));

  useEffect(() => {
    return app.subscribe(selector, setValue, {
      batchMode: "transaction",
      fireImmediately: true,
    });
  }, [selector]);

  return value;
}

// Usage
function Counter() {
  const count = useAppState((s) => s.data.count);
  return <div>Count: {count}</div>;
}
```

### Memoized Selector Pattern

```tsx
function useAppSelector<T>(
  selector: (state: AppState<unknown>) => T,
  equalityFn?: (a: T, b: T) => boolean
): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const [value, setValue] = useState(() => selector(app.getState()));

  useEffect(() => {
    return app.subscribe(
      (state) => selectorRef.current(state),
      setValue,
      {
        equalityFn: equalityFn || Object.is,
        batchMode: "transaction",
      }
    );
  }, [equalityFn]);

  return value;
}

// Usage with object selector
function UserCard() {
  const user = useAppSelector(
    (s) => ({ name: s.data.user.name, avatar: s.data.user.avatar }),
    (a, b) => a.name === b.name && a.avatar === b.avatar
  );

  return (
    <div>
      <img src={user.avatar} alt={user.name} />
      <span>{user.name}</span>
    </div>
  );
}
```

### Full State with Immediate Updates

```tsx
function useLiveState<T>(): AppState<T> | null {
  const [state, setState] = useState<AppState<T> | null>(null);

  useEffect(() => {
    setState(app.getState<T>());

    return app.subscribe(
      (s) => s,
      (s) => setState(s as AppState<T>),
      { batchMode: "immediate" }
    );
  }, []);

  return state;
}

// Usage for real-time updates
function LiveDashboard() {
  const state = useLiveState<DashboardData>();

  if (!state) return <Loading />;

  return (
    <div>
      <span>Version: {state.meta.version}</span>
      <span>Status: {state.system.status}</span>
    </div>
  );
}
```

---

## Common Patterns

### Filtered List

```typescript
app.subscribe(
  (state) => {
    const items = state.data.items;
    const filter = state.data.filter;

    return items.filter(item => {
      if (filter === "all") return true;
      if (filter === "active") return !item.completed;
      if (filter === "completed") return item.completed;
      return true;
    });
  },
  (filteredItems) => renderList(filteredItems),
  {
    equalityFn: (a, b) =>
      a.length === b.length &&
      a.every((item, i) => item.id === b[i].id),
  }
);
```

### Loading State

```typescript
app.subscribe(
  (state) => ({
    isLoading: state.system.status === "computing",
    hasError: state.system.lastError !== null,
    error: state.system.lastError?.message,
  }),
  ({ isLoading, hasError, error }) => {
    if (isLoading) showSpinner();
    else hideSpinner();

    if (hasError) showError(error);
  },
  {
    equalityFn: (a, b) =>
      a.isLoading === b.isLoading &&
      a.hasError === b.hasError &&
      a.error === b.error,
  }
);
```

### Computed Value Watcher

```typescript
app.subscribe(
  (state) => state.computed.totalPrice as number,
  (totalPrice) => {
    analytics.track("cart_total_changed", { total: totalPrice });
  },
  { batchMode: "transaction" }
);
```

### Version Tracking

```typescript
app.subscribe(
  (state) => state.meta.version,
  (version) => {
    console.log("State version:", version);
    localStorage.setItem("lastVersion", String(version));
  }
);
```

---

## Cleanup

Always clean up subscriptions when they're no longer needed:

```typescript
// Store unsubscribe function
const unsubscribe = app.subscribe(selector, listener);

// Later: cleanup
unsubscribe();
```

In React:

```tsx
useEffect(() => {
  const unsubscribe = app.subscribe(selector, listener);
  return unsubscribe;  // Cleanup on unmount
}, []);
```

---

## Performance Tips

1. **Use narrow selectors** — Select only what you need
2. **Avoid creating new objects in selectors** — Use memoization if needed
3. **Use appropriate batch modes** — `transaction` for most cases
4. **Provide custom equality for objects** — Prevent unnecessary re-renders
5. **Debounce expensive operations** — Use `{ debounce: ms }` batch mode
6. **Cleanup subscriptions** — Prevent memory leaks
