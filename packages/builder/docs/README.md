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
        expr: expr.filter(state.todos, (t) => expr.not(expr.get(t, "completed"))).length,
      }),

      filteredTodos: computed.define({
        deps: [state.todos, state.filter],
        expr: expr.cond([
          [expr.eq(state.filter, "active"), expr.filter(state.todos, (t) => expr.not(expr.get(t, "completed")))],
          [expr.eq(state.filter, "completed"), expr.filter(state.todos, (t) => expr.get(t, "completed"))],
        ], state.todos),
      }),
    },

    actions: {
      // Type-safe action with input validation
      add: actions.define({
        input: z.object({ title: z.string().min(1) }),
        flow: ({ input }) =>
          flow.patch("add", `/todos/-`, {
            id: expr.uuid(),
            title: input.title,
            completed: false,
          }),
      }),

      toggle: actions.define({
        input: z.object({ id: z.string() }),
        flow: ({ input, state }) =>
          flow.seq([
            flow.patch("replace", `/todos/${input.id}/completed`,
              expr.not(expr.get(state.todos.byId(input.id), "completed"))
            ),
          ]),
      }),
    },
  })
);

// Use the domain
console.log(TodoDomain.schema);        // → DomainSchema IR for Core
console.log(TodoDomain.state.todos);   // → FieldRef<Todo[]>
console.log(TodoDomain.actions.add);   // → ActionRef<{ title: string }>
```

> See [GUIDE.md](GUIDE.md) for the full tutorial.

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

> See [SPEC.md](SPEC.md) for complete API reference.

---

## Core Concepts

### Zero String Paths

Builder eliminates error-prone string paths:

```typescript
// Without Builder (error-prone)
{ path: "/data/todos/0/completed" }  // Typo? Wrong index?

// With Builder (type-safe)
state.todos[0].completed  // TypeScript catches errors
```

### Re-entry Safe Patterns

Flows are evaluated from the beginning each time. Use guards to prevent duplicate operations:

```typescript
// Guard pattern - only runs if condition is false
flow.seq([
  guard(state.initialized, [
    flow.patch("set", "/initialized", true),
    flow.effect("api.init", {}),
  ]),
]);

// onceNull pattern - only runs if value is null
onceNull(state.user, [
  flow.effect("api.fetchUser", {}),
]);
```

### Expression DSL

All expressions are pure and deterministic:

```typescript
// Filtering
expr.filter(state.todos, (t) => expr.not(expr.get(t, "completed")))

// Conditionals
expr.cond([
  [expr.gt(state.count, 10), "high"],
  [expr.gt(state.count, 5), "medium"],
], "low")

// Arithmetic
expr.add(state.subtotal, expr.mul(state.subtotal, state.taxRate))
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
| [GUIDE.md](GUIDE.md) | Step-by-step usage guide |
| [SPEC.md](SPEC.md) | Complete specification |
| [FDR.md](FDR.md) | Design rationale |

---

## License

[MIT](../../LICENSE)
