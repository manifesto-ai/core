# @manifesto-ai/react

> **React** is the React integration layer of Manifesto. It provides hooks and context for seamless React application development.

---

## What is React?

The React package provides React-specific bindings for Manifesto Bridge. It offers a high-level factory API for zero-config setup and low-level hooks for advanced use cases.

In the Manifesto architecture:

```
Your Components ──→ REACT ──→ Bridge ──→ World
                      │
    React hooks, context, type-safe actions
    SSR-compatible, optimized re-renders
```

---

## What React Does

| Responsibility | Description |
|----------------|-------------|
| Provide React context | BridgeProvider wraps your app |
| Expose hooks | useValue, useDispatch, useActions for component integration |
| Type-safe actions | ActionDispatchers with full type inference |
| Optimize renders | Selector-based subscriptions for minimal re-renders |

---

## What React Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Framework-agnostic bindings | Bridge |
| Compute state transitions | Core |
| Execute effects | Host |
| Govern authority | World |

---

## Installation

```bash
npm install @manifesto-ai/react @manifesto-ai/builder zod react
# or
pnpm add @manifesto-ai/react @manifesto-ai/builder zod react
```

### Peer Dependencies

```bash
npm install react  # React 18+
npm install zod    # For schema definition
```

---

## Quick Example (Recommended)

Use `createManifestoApp` for zero-config setup:

```tsx
import { z } from "zod";
import { defineDomain, expr, flow } from "@manifesto-ai/builder";
import { createManifestoApp } from "@manifesto-ai/react";

// 1. Define your domain
const TodoDomain = defineDomain(
  z.object({
    todos: z.array(z.object({
      id: z.string(),
      title: z.string(),
      completed: z.boolean(),
    })),
  }),
  ({ state, actions }) => ({
    actions: {
      add: actions.define({
        input: z.object({ id: z.string(), title: z.string() }),
        flow: flow.patch(state.todos).set(
          expr.append(
            state.todos,
            expr.object({
              id: expr.input("id"),
              title: expr.input("title"),
              completed: expr.lit(false),
            })
          )
        ),
      }),
      toggle: actions.define({
        input: z.object({ id: z.string() }),
        flow: flow.patch(state.todos).set(
          expr.map(state.todos, (todo) =>
            expr.cond(
              expr.eq(todo.id, expr.input("id")),
              expr.merge(
                todo,
                expr.object({
                  completed: expr.not(todo.completed),
                })
              ),
              todo
            )
          )
        ),
      }),
    },
  })
);

// 2. Create app
const App = createManifestoApp(TodoDomain, {
  initialState: { todos: [] },
});

// 3. Use in components
function TodoList() {
  const todos = App.useValue((s) => s.todos);
  const { add, toggle } = App.useActions();

  return (
    <ul>
      {todos.map((t) => (
        <li key={t.id} onClick={() => toggle({ id: t.id })}>
          {t.completed ? "✓" : "○"} {t.title}
        </li>
      ))}
      <button onClick={() => add({ id: crypto.randomUUID(), title: "New Todo" })}>Add</button>
    </ul>
  );
}

// 4. Wrap with Provider
function Root() {
  return (
    <App.Provider>
      <TodoList />
    </App.Provider>
  );
}
```

MEL equivalent (domain definition):

```mel
domain TodoDomain {
  type TodoItem = {
    id: string,
    title: string,
    completed: boolean
  }

  state {
    todos: Array<TodoItem> = []
  }

  action add(id: string, title: string) {
    when true {
      patch todos = append(todos, {
        id: id,
        title: title,
        completed: false
      })
    }
  }

  action toggle(id: string) {
    when true {
      patch todos = map(todos, cond(
        eq($item.id, id),
        merge($item, { completed: not($item.completed) }),
        $item
      ))
    }
  }
}
```

> See [GUIDE.md](../../docs/packages/react/GUIDE.md) for the full tutorial.

---

## React API

### Factory API (Recommended)

```typescript
function createManifestoApp<TDomain>(
  domain: DomainModule<TDomain>,
  options: ManifestoAppOptions
): ManifestoApp<TDomain>;

interface ManifestoApp<TDomain> {
  Provider: React.FC<{ children: ReactNode }>;
  useValue<T>(selector: (state: TDomain) => T): T;
  useComputed<T>(selector: (computed: Record<string, unknown>) => T): T;
  useDispatch(): DispatchFn;
  useActions(): ActionDispatchers<TDomain>;
}
```

### Low-Level API

```typescript
// Context
<BridgeProvider bridge={bridge}>
  {children}
</BridgeProvider>

// Hooks
function useBridge(): Bridge;
function useSnapshot(): SnapshotView;
function useValue<T>(selector: (snapshot) => T): T;
function useDispatch(): DispatchFn;
function useDispatchEvent(): DispatchEventFn;

// Types
type DispatchFn = (body: IntentBody) => Promise<ProposalResult>;
type DispatchEventFn = (event: SourceEvent) => Promise<ProposalResult | undefined>;
```

> See [SPEC.md](../../docs/packages/react/SPEC.md) for complete API reference.

---

## Core Concepts

### Type-Safe Actions

`useActions()` returns fully typed action dispatchers:

```typescript
const { add, toggle, remove } = App.useActions();

// TypeScript knows the input types!
add({ title: "Buy milk" });      // ✓ Correct
add({ name: "Buy milk" });       // ✗ Type error: 'name' doesn't exist
toggle({ id: "123" });           // ✓ Correct
toggle({ id: 123 });             // ✗ Type error: 'id' should be string
```

### Selector-Based Subscriptions

`useValue` only re-renders when the selected value changes:

```typescript
// Only re-renders when todos array changes
const todos = App.useValue((s) => s.todos);

// Only re-renders when filter changes
const filter = App.useValue((s) => s.filter);

// Derived values also work
const completedCount = App.useValue((s) =>
  s.todos.filter(t => t.completed).length
);
```

### Factory vs Low-Level API

| Use Case | Recommended API |
|----------|-----------------|
| Most applications | `createManifestoApp()` factory |
| Custom Bridge setup | Low-level `BridgeProvider` + hooks |
| Multiple domains | Multiple `createManifestoApp()` calls |
| Testing | Mock Bridge with `BridgeProvider` |

---

## Relationship with Other Packages

```
┌─────────────┐
│ Components  │ ← Uses React hooks
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    REACT    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Bridge    │ ← React wraps Bridge
└─────────────┘
```

| Relationship | Package | How |
|--------------|---------|-----|
| Depends on | `@manifesto-ai/bridge` | Wraps Bridge in React context |
| Depends on | `@manifesto-ai/builder` | Uses DomainModule for types |
| Used by | React applications | For state management |

---

## When to Use React

Use the React package when building React applications with Manifesto. It provides:

- React context for Bridge
- Optimized hooks for minimal re-renders
- Full type inference for actions and state
- SSR compatibility

For non-React applications, use [`@manifesto-ai/bridge`](../bridge/) directly.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](../../docs/packages/react/GUIDE.md) | Step-by-step usage guide |
| [SPEC.md](docs/SPEC.md) | Complete specification |
| [FDR.md](docs/FDR.md) | Design rationale |

---

## License

[MIT](../../LICENSE)
