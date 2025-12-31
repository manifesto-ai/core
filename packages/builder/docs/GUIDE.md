# Builder Guide

> **Purpose:** Practical guide for using @manifesto-ai/builder
> **Prerequisites:** Basic TypeScript and Zod knowledge
> **Time to complete:** ~20 minutes

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
npm install @manifesto-ai/builder @manifesto-ai/core zod
```

### Minimal Setup

```typescript
import { z } from "zod";
import { defineDomain, expr, flow } from "@manifesto-ai/builder";

// Define a minimal domain
const CounterDomain = defineDomain(
  // State schema (Zod)
  z.object({
    count: z.number().default(0),
  }),

  // Domain definition
  ({ state, actions }) => ({
    actions: {
      increment: actions.define({
        flow: () => flow.patch("add", "/data/count", expr.add(state.count, 1)),
      }),
    },
  })
);

// Verify
console.log(CounterDomain.schema);
// → DomainSchema IR for Core
```

---

## Basic Usage

### Use Case 1: Defining State with Zod

**Goal:** Define typed state schema.

```typescript
import { z } from "zod";
import { defineDomain } from "@manifesto-ai/builder";

const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean().default(false),
  createdAt: z.string().datetime(),
});

const AppDomain = defineDomain(
  z.object({
    todos: z.array(TodoSchema).default([]),
    filter: z.enum(["all", "active", "completed"]).default("all"),
    lastUpdated: z.string().datetime().optional(),
  }),

  ({ state, actions }) => ({
    actions: {
      // ... actions
    },
  })
);
```

### Use Case 2: Defining Computed Values

**Goal:** Define derived values from state.

```typescript
const TodoDomain = defineDomain(
  z.object({
    todos: z.array(TodoSchema).default([]),
    filter: z.enum(["all", "active", "completed"]).default("all"),
  }),

  ({ state, computed }) => ({
    computed: {
      // Count of incomplete todos
      remaining: computed.define({
        deps: [state.todos],
        expr: expr.length(
          expr.filter(state.todos, (t) => expr.not(expr.get(t, "completed")))
        ),
      }),

      // Filtered todos based on current filter
      visibleTodos: computed.define({
        deps: [state.todos, state.filter],
        expr: expr.cond(
          [
            [expr.eq(state.filter, "active"),
             expr.filter(state.todos, (t) => expr.not(expr.get(t, "completed")))],
            [expr.eq(state.filter, "completed"),
             expr.filter(state.todos, (t) => expr.get(t, "completed"))],
          ],
          state.todos // default: all
        ),
      }),

      // Are all todos completed?
      allCompleted: computed.define({
        deps: [state.todos],
        expr: expr.and(
          expr.gt(expr.length(state.todos), 0),
          expr.eq(
            expr.length(expr.filter(state.todos, (t) => expr.not(expr.get(t, "completed")))),
            0
          )
        ),
      }),
    },
  })
);
```

### Use Case 3: Defining Actions

**Goal:** Define type-safe actions with input validation.

```typescript
const TodoDomain = defineDomain(
  z.object({
    todos: z.array(TodoSchema).default([]),
  }),

  ({ state, actions }) => ({
    actions: {
      // Action with input
      add: actions.define({
        input: z.object({
          title: z.string().min(1, "Title required"),
        }),
        flow: ({ input }) =>
          flow.patch("add", "/data/todos/-", {
            id: expr.uuid(),
            title: input.title,
            completed: false,
            createdAt: expr.now(),
          }),
      }),

      // Action with ID lookup
      toggle: actions.define({
        input: z.object({ id: z.string() }),
        flow: ({ input, state }) => {
          const todo = expr.find(state.todos, (t) => expr.eq(expr.get(t, "id"), input.id));
          return flow.patch("replace",
            expr.concat("/data/todos/", expr.indexOf(state.todos, todo), "/completed"),
            expr.not(expr.get(todo, "completed"))
          );
        },
      }),

      // Action with no input
      clearCompleted: actions.define({
        flow: ({ state }) =>
          flow.patch("replace", "/data/todos",
            expr.filter(state.todos, (t) => expr.not(expr.get(t, "completed")))
          ),
      }),
    },
  })
);
```

---

## Common Patterns

### Pattern 1: Guard (Conditional Execution)

**When to use:** Only execute if condition is met.

```typescript
import { guard } from "@manifesto-ai/builder";

const actions = {
  submit: actions.define({
    flow: ({ state }) =>
      flow.seq([
        // Only proceed if not already submitted
        guard(expr.not(state.submitted), [
          flow.patch("set", "/data/submitted", true),
          flow.effect("api.submit", { data: state.formData }),
        ]),
      ]),
  }),
};
```

### Pattern 2: onceNull (Initialize If Null)

**When to use:** Fetch data only if not already loaded.

```typescript
import { onceNull } from "@manifesto-ai/builder";

const actions = {
  loadUser: actions.define({
    input: z.object({ id: z.string() }),
    flow: ({ input, state }) =>
      flow.seq([
        // Only fetch if user is null
        onceNull(state.user, [
          flow.patch("set", "/data/loading", true),
          flow.effect("api.fetchUser", { id: input.id }),
          flow.patch("set", "/data/loading", false),
        ]),
      ]),
  }),
};
```

### Pattern 3: Effect with Target Path

**When to use:** API call that stores result at specific path.

```typescript
const actions = {
  fetchPosts: actions.define({
    flow: () =>
      flow.seq([
        flow.patch("set", "/data/loading", true),
        flow.effect("api.get", {
          url: "/api/posts",
          target: "/data/posts", // Effect handler will set result here
        }),
        flow.patch("set", "/data/loading", false),
      ]),
  }),
};
```

---

## Advanced Usage

### Complex State with Records

```typescript
const AppDomain = defineDomain(
  z.object({
    users: z.record(z.string(), z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })).default({}),
    selectedUserId: z.string().optional(),
  }),

  ({ state, computed, actions }) => ({
    computed: {
      selectedUser: computed.define({
        deps: [state.users, state.selectedUserId],
        expr: expr.cond(
          [[expr.isSet(state.selectedUserId),
            expr.get(state.users, state.selectedUserId)]],
          null
        ),
      }),
    },

    actions: {
      addUser: actions.define({
        input: z.object({ name: z.string(), email: z.string() }),
        flow: ({ input }) => {
          const id = expr.uuid();
          return flow.patch("set", expr.concat("/data/users/", id), {
            id,
            name: input.name,
            email: input.email,
          });
        },
      }),
    },
  })
);
```

### Nested Flows

```typescript
const OrderDomain = defineDomain(
  z.object({
    order: z.object({
      status: z.enum(["draft", "submitted", "paid", "shipped"]).default("draft"),
      items: z.array(z.object({ id: z.string(), qty: z.number() })).default([]),
    }),
  }),

  ({ state, actions, flows }) => ({
    flows: {
      // Reusable flow
      validateOrder: flows.define({
        flow: ({ state }) =>
          flow.if(
            expr.eq(expr.length(state.order.items), 0),
            flow.fail("Order has no items"),
            flow.halt()
          ),
      }),
    },

    actions: {
      submit: actions.define({
        flow: ({ state }) =>
          flow.seq([
            flow.call("validateOrder"), // Call named flow
            flow.patch("set", "/data/order/status", "submitted"),
            flow.effect("api.submitOrder", { items: state.order.items }),
          ]),
      }),
    },
  })
);
```

---

## Common Mistakes

### Mistake 1: Using String Paths Instead of Refs

**What people do:**

```typescript
// Wrong: String path (typo-prone)
expr: { kind: "get", path: "/data/todoss" } // Typo!
```

**Why it's wrong:** No type checking, easy to make typos.

**Correct approach:**

```typescript
// Right: Use state ref (type-safe)
expr: state.todos // TypeScript catches typos
```

### Mistake 2: Forgetting Re-entry Safety

**What people do:**

```typescript
// Wrong: No guard
flow: () =>
  flow.seq([
    flow.effect("api.init", {}),
    flow.patch("set", "/data/initialized", true),
  ])
// Effect runs every time!
```

**Why it's wrong:** Flow re-evaluates from the beginning each time.

**Correct approach:**

```typescript
// Right: Guard with state check
flow: ({ state }) =>
  flow.seq([
    guard(expr.not(state.initialized), [
      flow.effect("api.init", {}),
      flow.patch("set", "/data/initialized", true),
    ]),
  ])
```

### Mistake 3: Async Expressions

**What people do:**

```typescript
// Wrong: Async in expression
computed: {
  userData: computed.define({
    deps: [state.userId],
    expr: await fetchUser(state.userId), // NO!
  }),
}
```

**Why it's wrong:** Expressions must be pure and synchronous.

**Correct approach:**

```typescript
// Right: Use effect for async, store in state
actions: {
  loadUser: actions.define({
    flow: ({ state }) =>
      flow.seq([
        onceNull(state.userData, [
          flow.effect("api.fetchUser", { id: state.userId }),
        ]),
      ]),
  }),
},
computed: {
  userName: computed.define({
    deps: [state.userData],
    expr: expr.get(state.userData, "name"),
  }),
}
```

---

## Troubleshooting

### Error: "Type X is not assignable to..."

**Cause:** Zod schema doesn't match usage.

**Solution:**

```typescript
// Check your schema matches your usage
const schema = z.object({
  count: z.number(), // Not z.string()!
});

// Then in actions:
flow.patch("set", "/data/count", 5) // number, not string
```

### Error: "Cannot find property X"

**Cause:** Accessing field that doesn't exist in schema.

**Solution:**

```typescript
// Ensure field exists in schema
const schema = z.object({
  todos: z.array(...),
  filter: z.string(), // Add missing field
});
```

### Computed value always undefined

**Cause:** Dependencies not correctly specified.

**Solution:**

```typescript
computed: {
  total: computed.define({
    deps: [state.items], // Must include all dependencies!
    expr: expr.length(state.items),
  }),
}
```

---

## Testing

### Unit Testing Domain Logic

```typescript
import { describe, it, expect } from "vitest";
import { createCore, createSnapshot } from "@manifesto-ai/core";

describe("TodoDomain", () => {
  const core = createCore();

  it("adds todo correctly", async () => {
    const snapshot = createSnapshot(TodoDomain.schema);

    const result = await core.compute(TodoDomain.schema, snapshot, {
      type: "add",
      input: { title: "Test todo" },
      intentId: "i_1",
    });

    expect(result.status).toBe("completed");
    expect(result.snapshot.data.todos).toHaveLength(1);
    expect(result.snapshot.data.todos[0].title).toBe("Test todo");
  });

  it("computes remaining correctly", async () => {
    const snapshot = createSnapshot(TodoDomain.schema);
    // Add some todos...

    expect(snapshot.computed.remaining).toBe(0);
  });
});
```

---

## Quick Reference

### Expression Helpers

| Helper | Purpose | Example |
|--------|---------|---------|
| `expr.eq(a, b)` | Equality | `expr.eq(state.status, "active")` |
| `expr.gt(a, b)` | Greater than | `expr.gt(state.count, 10)` |
| `expr.and(...args)` | Logical AND | `expr.and(cond1, cond2)` |
| `expr.or(...args)` | Logical OR | `expr.or(cond1, cond2)` |
| `expr.not(a)` | Logical NOT | `expr.not(state.disabled)` |
| `expr.add(a, b)` | Addition | `expr.add(state.count, 1)` |
| `expr.filter(arr, fn)` | Filter array | `expr.filter(state.todos, t => ...)` |
| `expr.map(arr, fn)` | Map array | `expr.map(state.items, i => ...)` |
| `expr.length(arr)` | Array length | `expr.length(state.todos)` |
| `expr.get(obj, key)` | Get property | `expr.get(todo, "title")` |
| `expr.uuid()` | Generate UUID | `id: expr.uuid()` |
| `expr.now()` | Current timestamp | `createdAt: expr.now()` |

### Flow Helpers

| Helper | Purpose | Example |
|--------|---------|---------|
| `flow.seq([...])` | Sequential steps | `flow.seq([step1, step2])` |
| `flow.if(cond, then, else)` | Conditional | `flow.if(cond, thenFlow, elseFlow)` |
| `flow.patch(op, path, value)` | State change | `flow.patch("set", "/data/x", 5)` |
| `flow.effect(type, params)` | External op | `flow.effect("api.get", { url })` |
| `flow.halt()` | Stop success | `flow.halt()` |
| `flow.fail(msg)` | Stop error | `flow.fail("Invalid")` |
| `guard(cond, steps)` | Guarded exec | `guard(state.ready, [...])` |
| `onceNull(ref, steps)` | Init if null | `onceNull(state.data, [...])` |

---

*End of Guide*
