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
        flow: () => flow.patch(state.count).set(expr.add(state.count, 1)),
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
        expr: expr.len(
          expr.filter(state.todos, (t) => expr.not(expr.get(t, "completed")))
        ),
      }),

      // Filtered todos based on current filter
      visibleTodos: computed.define({
        deps: [state.todos, state.filter],
        expr: expr.cond(
          expr.eq(state.filter, "active"),
          expr.filter(state.todos, (t) => expr.not(expr.get(t, "completed"))),
          expr.cond(
            expr.eq(state.filter, "completed"),
            expr.filter(state.todos, (t) => expr.get(t, "completed")),
            state.todos // default: all
          )
        ),
      }),

      // Are all todos completed?
      allCompleted: computed.define({
        deps: [state.todos],
        expr: expr.and(
          expr.gt(expr.len(state.todos), 0),
          expr.eq(
            expr.len(expr.filter(state.todos, (t) => expr.not(expr.get(t, "completed")))),
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
        flow: flow.patch(state.todos).set(
          expr.append(
            state.todos,
            expr.object({
              id: expr.uuid(),
              title: expr.input("title"),
              completed: expr.lit(false),
              createdAt: expr.now(),
            })
          )
        ),
      }),

      // Action with ID lookup
      toggle: actions.define({
        input: z.object({ id: z.string() }),
        flow: flow.patch(state.todos).set(
          expr.map(state.todos, (todo) =>
            expr.cond(
              expr.eq(expr.get(todo, "id"), expr.input("id")),
              expr.merge(todo, expr.object({
                completed: expr.not(expr.get(todo, "completed")),
              })),
              todo
            )
          )
        ),
      }),

      // Action with no input
      clearCompleted: actions.define({
        flow: flow.patch(state.todos).set(
          expr.filter(state.todos, (todo) => expr.not(expr.get(todo, "completed")))
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
    flow: guard(expr.not(state.submitted), ({ patch, effect }) => {
      patch(state.submitted).set(true);
      effect("api.submit", { data: state.formData });
    }),
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
    flow: onceNull(state.user, ({ patch, effect }) => {
      // Only fetch if user is null
      patch(state.loading).set(true);
      effect("api.fetchUser", { id: expr.input("id") });
      patch(state.loading).set(false);
    }),
  }),
};
```

### Pattern 3: Effect with Target Path

**When to use:** API call that stores result at specific path.

```typescript
const actions = {
  fetchPosts: actions.define({
    flow: flow.seq(
      flow.patch(state.loading).set(true),
      flow.effect("api.get", {
        url: "/api/posts",
        target: "posts", // Effect handler will set result here
      }),
      flow.patch(state.loading).set(false)
    ),
  }),
};
```

---

## Advanced Usage

### Complex State with Records

```typescript
const AppDomain = defineDomain(
  z.object({
    users: z.array(z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })).default([]),
    selectedUserId: z.string().optional(),
  }),

  ({ state, computed, actions, expr, flow }) => ({
    computed: {
      selectedUser: computed.define({
        deps: [state.users, state.selectedUserId],
        expr: expr.find(state.users, (user) =>
          expr.eq(expr.get(user, "id"), state.selectedUserId)
        ),
      }),
    },

    actions: {
      addUser: actions.define({
        input: z.object({ name: z.string(), email: z.string() }),
        flow: flow.patch(state.users).set(
          expr.append(
            state.users,
            expr.object({
              id: expr.uuid(),
              name: expr.input("name"),
              email: expr.input("email"),
            })
          )
        ),
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
        flow: flow.when(
            expr.eq(expr.len(state.order.items), 0),
            flow.fail("Order has no items"),
            flow.halt()
          ),
      }),
    },

    actions: {
      submit: actions.define({
        flow: ({ state }) =>
          flow.seq(
            flow.call("validateOrder"), // Call named flow
            flow.patch(state.order.status).set("submitted"),
            flow.effect("api.submitOrder", { items: state.order.items })
          ),
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
expr: { kind: "get", path: "todoss" } // Typo!
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
flow: ({ state }) =>
  flow.seq(
    flow.effect("api.init", {}),
    flow.patch(state.initialized).set(true)
  )
// Effect runs every time!
```

**Why it's wrong:** Flow re-evaluates from the beginning each time. Without state guards, effects execute repeatedly.

#### The Problem: Unbounded Re-execution

**Timeline of what happens (WRONG approach):**

```
┌─────────────────────────────────────────────────────────────────┐
│ Compute Cycle 1 (intent submitted)                             │
├─────────────────────────────────────────────────────────────────┤
│ Flow evaluation:                                                │
│   1. flow.effect("api.init", {})  → Requirement declared        │
│   2. flow.patch(state.initialized).set(true)  → Skipped (pending)│
│ Result: status="pending", requirements=[effect:api.init]        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Host executes effect "api.init"                                 │
│ Returns patches: [{ op: "set", path: "initData", ... }]  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Compute Cycle 2 (auto-triggered by Host)                       │
├─────────────────────────────────────────────────────────────────┤
│ Flow evaluation:                                                │
│   1. flow.effect("api.init", {})  → Requirement declared AGAIN! │
│   2. flow.patch(state.initialized).set(true)  → Skipped          │
│ Result: status="pending", requirements=[effect:api.init]        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Host executes effect "api.init" AGAIN                           │
│ (Infinite loop! Effect keeps re-executing)                      │
└─────────────────────────────────────────────────────────────────┘
```

**Why this happens:**
1. Flow is **pure computation** — it has no memory of previous executions
2. Each `compute()` call starts from the beginning of the Flow
3. Without a state guard, the effect is **always** declared
4. Host executes effect → triggers re-compute → effect declared again → infinite loop

#### The Solution: State Guards

**Timeline of what happens (CORRECT approach):**

```
┌─────────────────────────────────────────────────────────────────┐
│ Initial State: { initialized: false, initData: null }          │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Compute Cycle 1 (intent submitted)                             │
├─────────────────────────────────────────────────────────────────┤
│ Flow evaluation:                                                │
│   1. guard(expr.not(state.initialized), [...])                  │
│      → state.initialized = false → ENTER guard                  │
│   2. flow.effect("api.init", {})  → Requirement declared        │
│   3. flow.patch(state.initialized).set(true)  → Skipped (pending)│
│ Result: status="pending", requirements=[effect:api.init]        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Host executes effect "api.init"                                 │
│ Returns patches:                                                │
│   [{ op: "set", path: "initialized", value: true },      │
│    { op: "set", path: "initData", value: {...} }]        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Updated State: { initialized: true, initData: {...} }          │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Compute Cycle 2 (auto-triggered by Host)                       │
├─────────────────────────────────────────────────────────────────┤
│ Flow evaluation:                                                │
│   1. guard(expr.not(state.initialized), [...])                  │
│      → state.initialized = true → SKIP guard body               │
│ Result: status="complete", requirements=[]                      │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                      ✓ Flow completes
                   (Effect runs only once)
```

**Why this works:**
1. Guard checks `state.initialized` before allowing effect execution
2. Effect handler sets `initialized = true` via patches
3. Next compute cycle sees `initialized = true` and skips the guard
4. Flow completes without re-declaring the effect

**Correct approach:**

```typescript
// Right: Guard with state check
flow: guard(expr.not(state.initialized), ({ patch, effect }) => {
  effect("api.init", {});
  patch(state.initialized).set(true);
})
```

**Alternative: Use `onceNull` helper**

```typescript
import { onceNull } from "@manifesto-ai/builder";

// Simpler: Only execute if state.initData is null
flow: onceNull(state.initData, ({ effect }) => {
  effect("api.fetchData", {});
  // Effect handler will set initData
})
```

**Key principle:** Every effect MUST be guarded by state that the effect changes. This creates a feedback loop that prevents re-execution.

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
    flow: onceNull(state.userData, ({ effect }) => {
      effect("api.fetchUser", { id: state.userId });
    }),
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
flow.patch(state.count).set(5) // number, not string
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
    expr: expr.len(state.items),
  }),
}
```

---

## End-to-End Example: Counter App

**Goal:** Complete working example from domain definition to running application.

**Prerequisites:** Node.js 18+, TypeScript

This example demonstrates the full Manifesto stack in a single file. You can copy-paste and run it.

```typescript
// counter-app.ts
// Copy this entire file and run: npx tsx counter-app.ts

import { z } from "zod";
import { defineDomain } from "@manifesto-ai/builder";
import { createCore, createSnapshot } from "@manifesto-ai/core";
import { createHost } from "@manifesto-ai/host";
import { createManifestoWorld, createAutoApproveHandler } from "@manifesto-ai/world";
import { createBridge } from "@manifesto-ai/bridge";

// ============ Step 1: Define Domain ============

const CounterDomain = defineDomain(
  // State schema (Zod-first)
  z.object({
    count: z.number().default(0),
    lastAction: z.string().optional(),
    history: z.array(z.number()).default([]),
  }),

  // Domain definition
  ({ state, computed, actions, expr, flow }) => {
    // Computed: Is count positive?
    const { isPositive } = computed.define({
      isPositive: expr.gt(state.count, 0),
    });

    // Computed: Average of history
    const { average } = computed.define({
      average: expr.cond(
        expr.gt(expr.len(state.history), 0),
        expr.div(
          expr.reduce(state.history, (sum, val) => expr.add(sum, val), 0),
          expr.len(state.history)
        ),
        expr.lit(0)
      ),
    });

    // Actions
    const { increment } = actions.define({
      increment: {
        flow: flow.seq(
          flow.patch(state.count).set(expr.add(state.count, 1)),
          flow.patch(state.history).set(expr.append(state.history, state.count)),
          flow.patch(state.lastAction).set(expr.lit("increment"))
        ),
      },
    });

    const { decrement } = actions.define({
      decrement: {
        flow: flow.seq(
          flow.patch(state.count).set(expr.sub(state.count, 1)),
          flow.patch(state.history).set(expr.append(state.history, state.count)),
          flow.patch(state.lastAction).set(expr.lit("decrement"))
        ),
      },
    });

    const { reset } = actions.define({
      reset: {
        flow: flow.seq(
          flow.patch(state.count).set(expr.lit(0)),
          flow.patch(state.history).set(expr.lit([])),
          flow.patch(state.lastAction).set(expr.lit("reset"))
        ),
      },
    });

    const { setCount } = actions.define({
      setCount: {
        input: z.object({ value: z.number() }),
        flow: flow.seq(
          flow.patch(state.count).set(expr.input<number>("value")),
          flow.patch(state.lastAction).set(expr.lit("setCount"))
        ),
      },
    });

    return {
      computed: { isPositive, average },
      actions: { increment, decrement, reset, setCount },
    };
  },
  { id: "counter-domain", version: "1.0.0" }
);

// ============ Step 2: Create Core ============

const core = createCore();

// ============ Step 3: Create Initial Snapshot ============

const context = { now: 0, randomSeed: "seed" };
const initialSnapshot = createSnapshot(
  { count: 0, lastAction: undefined, history: [] },
  CounterDomain.schema.hash,
  context
);
console.log("Initial state:", initialSnapshot.data);
// → { count: 0, lastAction: undefined, history: [] }

// ============ Step 4: Create Host ============

const host = createHost(CounterDomain.schema, {
  snapshot: initialSnapshot,
  context: { now: () => Date.now() },
});

// ============ Step 5: Create World with Auto-Approve Authority ============

const world = createManifestoWorld({
  schemaHash: "counter-app-v1",
  host,
  defaultAuthority: createAutoApproveHandler(),
});

// Register actors
world.registerActor({
  actorId: "user-1",
  kind: "human",
  name: "Alice",
});

// ============ Step 6: Create Bridge ============

const bridge = createBridge({
  world,
  schemaHash: "counter-app-v1",
  defaultActor: { actorId: "user-1", kind: "human" },
});

// ============ Step 7: Subscribe to State Changes ============

bridge.subscribe((snapshot) => {
  console.log("\n=== State Updated ===");
  console.log("Count:", snapshot.data.count);
  console.log("Last Action:", snapshot.data.lastAction);
  console.log("History:", snapshot.data.history);
  console.log("Is Positive:", snapshot.computed.isPositive);
  console.log("Average:", snapshot.computed.average);
});

// ============ Step 8: Run Actions ============

async function runDemo() {
  console.log("\n🚀 Starting Counter App Demo\n");

  // Action 1: Increment
  console.log(">>> Dispatching: increment");
  await bridge.dispatch({ type: "increment", input: {} });

  // Action 2: Increment again
  console.log("\n>>> Dispatching: increment");
  await bridge.dispatch({ type: "increment", input: {} });

  // Action 3: Decrement
  console.log("\n>>> Dispatching: decrement");
  await bridge.dispatch({ type: "decrement", input: {} });

  // Action 4: Set count to 10
  console.log("\n>>> Dispatching: setCount (value: 10)");
  await bridge.dispatch({ type: "setCount", input: { value: 10 } });

  // Action 5: Increment
  console.log("\n>>> Dispatching: increment");
  await bridge.dispatch({ type: "increment", input: {} });

  // Action 6: Reset
  console.log("\n>>> Dispatching: reset");
  await bridge.dispatch({ type: "reset", input: {} });

  console.log("\n✅ Demo Complete!\n");

  // Final snapshot
  const finalSnapshot = bridge.getSnapshot();
  console.log("Final snapshot:");
  console.log(JSON.stringify(finalSnapshot.data, null, 2));
}

// Run the demo
runDemo().catch(console.error);
```

**Expected Output:**

```
Initial state: { count: 0, lastAction: undefined, history: [] }

🚀 Starting Counter App Demo

>>> Dispatching: increment

=== State Updated ===
Count: 1
Last Action: increment
History: [ 0 ]
Is Positive: true
Average: 0

>>> Dispatching: increment

=== State Updated ===
Count: 2
Last Action: increment
History: [ 0, 1 ]
Is Positive: true
Average: 0.5

>>> Dispatching: decrement

=== State Updated ===
Count: 1
Last Action: decrement
History: [ 0, 1, 2 ]
Is Positive: true
Average: 1

>>> Dispatching: setCount (value: 10)

=== State Updated ===
Count: 10
Last Action: setCount
History: [ 0, 1, 2 ]
Is Positive: true
Average: 1

>>> Dispatching: increment

=== State Updated ===
Count: 11
Last Action: increment
History: [ 0, 1, 2, 10 ]
Is Positive: true
Average: 3.25

>>> Dispatching: reset

=== State Updated ===
Count: 0
Last Action: reset
History: []
Is Positive: false
Average: 0

✅ Demo Complete!

Final snapshot:
{
  "count": 0,
  "lastAction": "reset",
  "history": []
}
```

**To run this example:**

1. Create a new directory:
   ```bash
   mkdir manifesto-counter
   cd manifesto-counter
   npm init -y
   ```

2. Install dependencies:
   ```bash
   npm install @manifesto-ai/builder @manifesto-ai/core @manifesto-ai/host @manifesto-ai/world @manifesto-ai/bridge zod
   npm install -D tsx typescript
   ```

3. Save the code above as `counter-app.ts`

4. Run:
   ```bash
   npx tsx counter-app.ts
   ```

**What this demonstrates:**

1. **Domain Definition** — Type-safe state schema with Zod, computed values, and actions
2. **Core** — Pure computation engine
3. **Host** — Effect execution and patch application
4. **World** — Governance and authority (auto-approve for this simple example)
5. **Bridge** — Intent dispatching and state subscription
6. **Full Flow** — Define → Create → Run → Subscribe → Dispatch

**Next steps:**

- Add effects (API calls, database writes)
- Add HITL authority for human approval
- Add React UI with `@manifesto-ai/react`
- Add trace recording with `@manifesto-ai/lab`

---

## Testing

### Unit Testing Domain Logic

```typescript
import { describe, it, expect } from "vitest";
import { createCore, createSnapshot } from "@manifesto-ai/core";

describe("TodoDomain", () => {
  const core = createCore();
  const context = { now: 0, randomSeed: "seed" };

  it("adds todo correctly", async () => {
    const snapshot = createSnapshot({ todos: [] }, TodoDomain.schema.hash, context);

    const result = await core.compute(
      TodoDomain.schema,
      snapshot,
      {
        type: "add",
        input: { title: "Test todo" },
        intentId: "i_1",
      },
      context
    );

    expect(result.status).toBe("complete");
    expect(result.snapshot.data.todos).toHaveLength(1);
    expect(result.snapshot.data.todos[0].title).toBe("Test todo");
  });

  it("computes remaining correctly", async () => {
    const snapshot = createSnapshot({ todos: [] }, TodoDomain.schema.hash, context);
    // Add some todos...

    expect(snapshot.computed["computed.remaining"]).toBe(0);
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
| `expr.len(arr)` | Array length | `expr.len(state.todos)` |
| `expr.get(obj, key)` | Get property | `expr.get(todo, "title")` |
| `expr.uuid()` | Generate UUID | `id: expr.uuid()` |
| `expr.now()` | Current timestamp | `createdAt: expr.now()` |

### Flow Helpers

| Helper | Purpose | Example |
|--------|---------|---------|
| `flow.seq(...steps)` | Sequential steps | `flow.seq(step1, step2)` |
| `flow.when(cond, then, else)` | Conditional | `flow.when(cond, thenFlow, elseFlow)` |
| `flow.patch(ref).set(value)` | State change | `flow.patch(state.x).set(5)` |
| `flow.effect(type, params)` | External op | `flow.effect("api.get", { url })` |
| `flow.halt()` | Stop success | `flow.halt()` |
| `flow.fail(msg)` | Stop error | `flow.fail("Invalid")` |
| `guard(cond, body)` | Guarded exec | `guard(state.ready, ({ patch }) => patch(state.readyAt).set(expr.now()))` |
| `onceNull(ref, body)` | Init if null | `onceNull(state.data, ({ effect }) => effect("api.load", {}))` |

---

*End of Guide*
