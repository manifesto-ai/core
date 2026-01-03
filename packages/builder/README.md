# @manifesto-ai/builder

> **Builder** is the developer experience (DX) layer of Manifesto. It provides type-safe domain definition with Zod integration and zero string paths.

---

## What is Builder?

Builder provides a developer-friendly DSL for defining Manifesto domains. It takes Zod schemas as input and produces strongly-typed DomainModules with compile-time safety.

In the Manifesto architecture:

```
Your App ──→ BUILDER ──→ DomainSchema ──→ Core
               │
    Type-safe DSL for domain definition
    Zod-first, no string paths
```

---

## What Builder Does

| Responsibility | Description |
|----------------|-------------|
| Define state schemas | Use Zod for type-safe state definition |
| Define computed values | Declarative derived values with dependency tracking |
| Define actions | Type-safe action handlers with flow DSL |
| Provide typed references | FieldRef, ComputedRef, ActionRef for zero string paths |

---

## What Builder Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Execute domains | Host |
| Compute state transitions | Core |
| Handle UI bindings | Bridge / React |
| Govern authority | World |

---

## Installation

```bash
npm install @manifesto-ai/builder @manifesto-ai/core zod
# or
pnpm add @manifesto-ai/builder @manifesto-ai/core zod
```

### Peer Dependencies

```bash
npm install zod  # Required peer
```

---

## Quick Example

```typescript
import { z } from "zod";
import { defineDomain, expr, flow } from "@manifesto-ai/builder";

// Define domain with Zod schema
const TodoDomain = defineDomain(
  // State schema
  z.object({
    todos: z.array(z.object({
      id: z.string(),
      title: z.string(),
      completed: z.boolean(),
    })),
    filter: z.enum(["all", "active", "completed"]).default("all"),
  }),

  // Domain definition
  ({ state, computed, actions }) => ({
    computed: {
      // Type-safe computed with dependencies
      remaining: computed.define({
        deps: [state.todos],
        expr: expr.len(
          expr.filter(state.todos, (t) => expr.not(t.completed))
        ),
      }),

      filteredTodos: computed.define({
        deps: [state.todos, state.filter],
        expr: expr.cond(
          expr.eq(state.filter, "active"),
          expr.filter(state.todos, (t) => expr.not(t.completed)),
          expr.cond(
            expr.eq(state.filter, "completed"),
            expr.filter(state.todos, (t) => t.completed),
            state.todos
          )
        ),
      }),
    },

    actions: {
      // Type-safe action with input validation
      add: actions.define({
        input: z.object({ id: z.string(), title: z.string().min(1) }),
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
              expr.merge(todo, expr.object({
                completed: expr.not(todo.completed),
              })),
              todo
            )
          )
        ),
      }),
    },
  })
);

// Use the domain
console.log(TodoDomain.schema);        // → DomainSchema IR for Core
console.log(TodoDomain.state.todos);   // → FieldRef<Todo[]>
console.log(TodoDomain.actions.add);   // → ActionRef<{ id: string; title: string }>
```

MEL equivalent:

```mel
domain TodoDomain {
  type TodoItem = {
    id: string,
    title: string,
    completed: boolean
  }

  state {
    todos: Array<TodoItem> = []
    filter: "all" | "active" | "completed" = "all"
  }

  computed remaining = len(filter(todos, not($item.completed)))

  computed filteredTodos = cond(
    eq(filter, "active"),
    filter(todos, not($item.completed)),
    cond(
      eq(filter, "completed"),
      filter(todos, $item.completed),
      todos
    )
  )

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

> See [GUIDE.md](../../docs/packages/builder/GUIDE.md) for the full tutorial.

---

## Builder API

### Main Exports

```typescript
// Main DSL
function defineDomain<TState, TComputed, TActions>(
  stateSchema: z.ZodObject<TState>,
  definition: (ctx: DomainContext) => DomainOutput
): DomainModule<TState, TComputed, TActions>;

// Expression builders
const expr = {
  // Comparisons
  eq, ne, gt, lt, gte, lte,
  // Logical
  and, or, not,
  // Arithmetic
  add, sub, mul, div,
  // Collections
  filter, map, find, length, includes,
  // Object
  get, merge,
  // Utilities
  uuid, now, cond,
};

// Flow builders
const flow = {
  seq,      // Sequential steps
  if,       // Conditional
  patch,    // State mutation
  effect,   // External operation
  call,     // Invoke another flow
  halt,     // Success termination
  fail,     // Error termination
};

// Flow helpers
function guard(condition, then): FlowNode;
function onceNull(path, then): FlowNode;
function onceNotSet(path, then): FlowNode;

// Typed references
type FieldRef<T> = { path: string; /* type-safe operations */ };
type ComputedRef<T> = { path: string; /* read-only */ };
type ActionRef<TInput> = { type: string; /* type-safe dispatch */ };
```

> See [SPEC.md](../../docs/packages/builder/SPEC.md) for complete API reference.

---

## Core Concepts

### Zero String Paths

Builder eliminates error-prone string paths:

```typescript
// Without Builder (error-prone)
{ path: "todos.0.completedd" }  // Typo? Wrong index?

// With Builder (type-safe)
state.todos[0].completed  // TypeScript catches errors
```

### Re-entry Safe Patterns

Flows are evaluated from the beginning each time. Use guards to prevent duplicate operations:

```typescript
// Guard pattern - only runs if condition is false
guard(expr.not(state.initialized), ({ patch, effect }) => {
  patch(state.initialized).set(true);
  effect("api.init", {});
});

// onceNull pattern - only runs if value is null
onceNull(state.user, ({ effect }) => {
  effect("api.fetchUser", {});
});
```

MEL equivalent:

```mel
domain Example {
  state {
    initialized: boolean = false
    user: string | null = null
  }

  action init() {
    when not(initialized) {
      patch initialized = true
      effect api.init({})
    }
  }

  action loadUser() {
    when isNull(user) {
      effect api.fetchUser({})
    }
  }
}
```

### Expression DSL

All expressions are pure and deterministic:

```typescript
// Filtering
expr.filter(state.todos, (t) => expr.not(t.completed))

// Conditionals
expr.cond(
  expr.gt(state.count, 10),
  "high",
  expr.cond(
    expr.gt(state.count, 5),
    "medium",
    "low"
  )
)

// Arithmetic
expr.add(state.subtotal, expr.mul(state.subtotal, state.taxRate))
```

MEL equivalent:

```mel
domain Example {
  type Todo = {
    completed: boolean
  }

  state {
    todos: Array<Todo> = []
    count: number = 0
    subtotal: number = 0
    taxRate: number = 0
  }

  computed filtered = filter(todos, not($item.completed))

  computed level = cond(
    gt(count, 10),
    "high",
    cond(
      gt(count, 5),
      "medium",
      "low"
    )
  )

  computed total = add(subtotal, mul(subtotal, taxRate))
}
```

---

## Relationship with Other Packages

```
┌─────────────┐
│  Your App   │ ← Uses Builder to define domains
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   BUILDER   │
└──────┬──────┘
       │ produces
       ▼
┌─────────────┐
│    Core     │ ← Consumes DomainSchema
└─────────────┘
```

| Relationship | Package | How |
|--------------|---------|-----|
| Depends on | `@manifesto-ai/core` | Produces Core-compatible schemas |
| Used by | Applications | For domain definition |

---

## When to Use Builder

**Use Builder for all domain definitions.** It provides:

- Compile-time type safety
- Autocomplete for state paths
- Validation of schema structure
- Readable, maintainable domain code

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](../../docs/packages/builder/GUIDE.md) | Step-by-step usage guide |
| [SPEC.md](docs/SPEC.md) | Complete specification |
| [FDR.md](docs/FDR.md) | Design rationale |

---

## License

[MIT](../../LICENSE)
