# Getting Started with Manifesto

> **Covers:** Domain definition, Core computation, Host execution, basic patterns
> **Purpose:** Quick start guide for developers new to Manifesto
> **Time to complete:** 15-20 minutes

::: tip Recommended Approach
For most users, we recommend using **MEL** with **@manifesto-ai/app** for a simpler, more streamlined experience:

```bash
npm install @manifesto-ai/app @manifesto-ai/compiler
```

See the [@manifesto-ai/app Getting Started Guide](/packages/app/getting-started) for the recommended approach.

This guide covers the **low-level approach** using Builder, Core, and Host directly.
:::

---

## Prerequisites

- Node.js 18+ or Bun
- Basic TypeScript knowledge
- Familiarity with Zod (for schema definition)

---

## Installation (Low-Level Approach)

```bash
npm install @manifesto-ai/builder @manifesto-ai/core @manifesto-ai/host zod
# or
pnpm add @manifesto-ai/builder @manifesto-ai/core @manifesto-ai/host zod
# or
bun add @manifesto-ai/builder @manifesto-ai/core @manifesto-ai/host zod
```

---

## Your First Manifesto App: Counter

### Step 1: Define the Domain

```typescript
// counter-domain.ts
import { z } from "zod";
import { defineDomain } from "@manifesto-ai/builder";

// Define state schema using Zod
const CounterStateSchema = z.object({
  count: z.number().default(0),
  lastAction: z.string().optional(),
});

// Define domain with actions and computed values
export const CounterDomain = defineDomain(
  CounterStateSchema,
  ({ state, actions, expr, flow }) => {
    // Define actions
    const { increment, decrement, reset } = actions.define({
      increment: {
        flow: flow.seq(
          flow.patch(state.count).set(expr.add(state.count, 1)),
          flow.patch(state.lastAction).set(expr.lit("increment"))
        ),
      },

      decrement: {
        flow: flow.seq(
          flow.patch(state.count).set(expr.sub(state.count, 1)),
          flow.patch(state.lastAction).set(expr.lit("decrement"))
        ),
      },

      reset: {
        flow: flow.seq(
          flow.patch(state.count).set(expr.lit(0)),
          flow.patch(state.lastAction).set(expr.lit("reset"))
        ),
      },
    });

    return {
      actions: { increment, decrement, reset },
    };
  },
  { id: "counter-domain", version: "1.0.0" }
);
```

MEL equivalent:

```mel
domain CounterDomain {
  state {
    count: number = 0
    lastAction: string | null = null
  }

  action increment() {
    when true {
      patch count = add(count, 1)
      patch lastAction = "increment"
    }
  }

  action decrement() {
    when true {
      patch count = sub(count, 1)
      patch lastAction = "decrement"
    }
  }

  action reset() {
    when true {
      patch count = 0
      patch lastAction = "reset"
    }
  }
}
```

**What you just did:**
- Defined state shape with Zod (`count` is a number, `lastAction` is an optional string)
- Created three actions: `increment`, `decrement`, and `reset`
- Each action uses `flow.patch()` to describe state changes
- Actions are **declarative** — they describe what should happen, not how to execute it

---

### Step 2: Create Host

```typescript
// main.ts
import { createHost } from "@manifesto-ai/host";
import { createIntent } from "@manifesto-ai/core";
import { CounterDomain } from "./counter-domain";

// Create Host (execution engine)
const host = createHost(CounterDomain.schema, {
  initialData: { count: 0 },
  context: { now: () => Date.now() },
});

const logSnapshot = async () => {
  const snapshot = await host.getSnapshot();
  if (!snapshot) return;
  console.log("Count:", snapshot.data.count);
  console.log("Last action:", snapshot.data.lastAction);
};

// Dispatch actions
await host.dispatch(createIntent("increment", "intent-1"));
await logSnapshot();
// → Count: 1, Last action: increment

await host.dispatch(createIntent("increment", "intent-2"));
await logSnapshot();
// → Count: 2, Last action: increment

await host.dispatch(createIntent("decrement", "intent-3"));
await logSnapshot();
// → Count: 1, Last action: decrement

await host.dispatch(createIntent("reset", "intent-4"));
await logSnapshot();
// → Count: 0, Last action: reset
```

**What you just did:**
- Created Core (handles pure computation)
- Created Host (handles execution and side effects)
- Subscribed to state changes
- Dispatched intents to change state

---

### Step 3: Add Computed Values

```typescript
// counter-domain.ts (updated)
export const CounterDomain = defineDomain(
  CounterStateSchema,
  ({ state, computed, actions, expr, flow }) => {
    // Add computed values
    const { isPositive, isZero, description } = computed.define({
      isPositive: expr.gt(state.count, 0),
      isZero: expr.eq(state.count, 0),
      description: expr.cond(
        expr.gt(state.count, 0),
        expr.lit("positive"),
        expr.cond(
          expr.lt(state.count, 0),
          expr.lit("negative"),
          expr.lit("zero")
        )
      ),
    });

    // ... actions ...

    return {
      computed: { isPositive, isZero, description },
      actions: { increment, decrement, reset },
    };
  }
);

// Use computed values
const logComputed = async () => {
  const snapshot = await host.getSnapshot();
  if (!snapshot) return;
  console.log("Count:", snapshot.data.count);
  console.log("Is positive?", snapshot.computed["computed.isPositive"]);
  console.log("Is zero?", snapshot.computed["computed.isZero"]);
  console.log("Description:", snapshot.computed["computed.description"]);
};
```

MEL equivalent (computed section):

```mel
domain CounterDomain {
  state {
    count: number = 0
    lastAction: string | null = null
  }

  computed isPositive = gt(count, 0)
  computed isZero = eq(count, 0)
  computed description = cond(
    gt(count, 0),
    "positive",
    cond(
      lt(count, 0),
      "negative",
      "zero"
    )
  )
}
```

**What computed values are:**
- Derived values calculated from state
- **Always recalculated** (never stored)
- Form a Directed Acyclic Graph (DAG)
- Declared once, available everywhere

---

### Step 4: Add Actions with Input

```typescript
// counter-domain.ts (updated)
export const CounterDomain = defineDomain(
  CounterStateSchema,
  ({ state, actions, expr, flow }) => {
    const { setCount, addAmount } = actions.define({
      // Action with required input
      setCount: {
        input: z.object({ value: z.number() }),
        flow: flow.patch(state.count).set(expr.input("value")),
      },

      // Action with optional input
      addAmount: {
        input: z.object({
          amount: z.number().default(1),
        }),
        flow: flow.patch(state.count).set(
          expr.add(state.count, expr.input("amount"))
        ),
      },
    });

    return { actions: { setCount, addAmount } };
  }
);

// Use actions with input
await host.dispatch(createIntent("setCount", { value: 10 }, "intent-5"));
// → Count: 10

await host.dispatch(createIntent("addAmount", { amount: 5 }, "intent-6"));
// → Count: 15

await host.dispatch(createIntent("addAmount", {}, "intent-7")); // Uses default amount: 1
// → Count: 16
```

MEL equivalent:

```mel
domain CounterDomain {
  state {
    count: number = 0
  }

  action setCount(value: number) {
    when true {
      patch count = value
    }
  }

  action addAmount(amount: number | null) {
    when true {
      patch count = add(count, coalesce(amount, 1))
    }
  }
}
```

**What you just did:**
- Added input validation with Zod
- Used `expr.input()` to access input values in flows
- Specified default values for optional input

---

## Understanding Core Concepts

### Snapshot: The Single Source of Truth

```typescript
type Snapshot = {
  data: {
    count: number;
    lastAction?: string;
  };
  computed: {
    isPositive: boolean;
    isZero: boolean;
    description: string;
  };
  system: {
    status: 'idle' | 'computing' | 'pending' | 'error';
    // ...
  };
  input: unknown;
  meta: {
    version: number;
    timestamp: number;
    randomSeed: string;
    schemaHash: string;
  };
};
```

**Key principle:** All communication happens through Snapshot. There is no other channel.

### Flow: Declarative Computation

Flows are data structures that describe computations:

```typescript
// This is DATA, not CODE
{
  kind: "seq",
  steps: [
    { kind: "patch", op: "set", path: "count", value: { kind: "lit", value: 0 } },
    { kind: "patch", op: "set", path: "lastAction", value: { kind: "lit", value: "reset" } }
  ]
}
```

Flows:
- Do NOT execute; they describe
- Do NOT return values; they modify Snapshot
- Are NOT Turing-complete; they always terminate
- Have no memory between executions

### Intent: What You Want to Happen

```typescript
type IntentBody = {
  type: string;      // Action name
  input?: unknown;   // Optional input data
};

// Example
const intent: IntentBody = {
  type: "increment"
};
```

Intents are requests to perform an action. They trigger Flow execution.

---

## Next Steps

### Add Effects (API Calls, etc.)

```typescript
// Define action with effect
const { fetchUser } = actions.define({
  fetchUser: {
    input: z.object({ id: z.string() }),
    flow: flow.seq(
      // Mark as loading
      flow.patch(state.loading).set(expr.lit(true)),

      // Declare effect (NOT executed yet)
      flow.effect("api:fetchUser", {
        userId: expr.input("id")
      }),

      // Mark as loaded (executed after effect completes)
      flow.patch(state.loading).set(expr.lit(false))
    ),
  },
});

// Register effect handler in Host
host.registerEffect("api:fetchUser", async (type, params) => {
  const response = await fetch(`/api/users/${params.userId}`);
  const user = await response.json();

  return [
    { op: "set", path: "user", value: user }
  ];
});
```

MEL equivalent:

```mel
domain UsersDomain {
  state {
    loading: boolean = false
  }

  action fetchUser(id: string) {
    when true {
      patch loading = true
      effect api.fetchUser({
        userId: id
      })
      patch loading = false
    }
  }
}
```

**Important:** Effects return **patches**, not values. The next compute cycle reads the result from Snapshot.

### Add Re-entry Safety

```typescript
// WRONG: Runs every time
flow.patch(state.count).set(expr.add(state.count, 1))

// RIGHT: Only runs once
flow.onceNull(state.initialized, ({ patch }) => {
  patch(state.count).set(expr.add(state.count, 1));
  patch(state.initialized).set(expr.lit(true));
})
```

MEL equivalent:

```mel
domain CounterDomain {
  state {
    count: number = 0
    initialized: boolean | null = null
  }

  action init() {
    when isNull(initialized) {
      patch count = add(count, 1)
      patch initialized = true
    }
  }
}
```

See [Re-entry Safe Flows Guide](./reentry-safe-flows.md) for details.

---

## Common Beginner Mistakes

### Mistake 1: Expecting Effects to Execute Immediately

```typescript
// WRONG expectation
const context = { now: 0, randomSeed: "seed" };
const result = await core.compute(schema, snapshot, intent, context);
console.log(result.snapshot.data.user); // → undefined (effect not executed!)
```

**Why:** Core only **declares** effects. It never executes them. Host executes effects.

**Fix:** Use Host, which handles the compute-effect loop automatically:

```typescript
// RIGHT
await host.dispatch(intent);
const snapshot = await host.getSnapshot();
console.log(snapshot?.data.user); // → { id: "123", ... }
```

### Mistake 2: Mutating Snapshots

```typescript
// WRONG
snapshot.data.count = 5; // Direct mutation!
```

**Fix:** Use patches:

```typescript
// RIGHT
const context = { now: 0, randomSeed: "seed" };
const newSnapshot = core.apply(schema, snapshot, [
  { op: "set", path: "count", value: 5 }
], context);
```

### Mistake 3: Using Async in Expressions

```typescript
// WRONG
const expr = async () => await fetchData(); // Expressions must be pure!
```

**Fix:** Use effects for async:

```typescript
// RIGHT
flow.effect("api:fetchData", {})
// Effect handler does the async work and returns patches
```

---

## Minimal Example: Complete File

```typescript
// counter-app.ts
import { z } from "zod";
import { defineDomain } from "@manifesto-ai/builder";
import { createIntent } from "@manifesto-ai/core";
import { createHost } from "@manifesto-ai/host";

// 1. Define domain
const CounterDomain = defineDomain(
  z.object({
    count: z.number().default(0),
  }),
  ({ state, actions, expr, flow }) => {
    const { increment } = actions.define({
      increment: {
        flow: flow.patch(state.count).set(expr.add(state.count, 1)),
      },
    });

    return { actions: { increment } };
  }
);

// 2. Create host
const host = createHost(CounterDomain.schema, {
  initialData: { count: 0 },
  context: { now: () => Date.now() },
});

// 3. Dispatch and read snapshot
await host.dispatch(createIntent("increment", "intent-1"));
const snapshot = await host.getSnapshot();
console.log("Count:", snapshot?.data.count);
// → Count: 1
```

MEL equivalent (domain definition):

```mel
domain CounterDomain {
  state {
    count: number = 0
  }

  action increment() {
    when true {
      patch count = add(count, 1)
    }
  }
}
```

---

## What to Learn Next

| Topic | Guide | Why |
|-------|-------|-----|
| **Re-entry safety** | [Re-entry Safe Flows](./reentry-safe-flows.md) | Prevent duplicate effects |
| **Effect handlers** | [Effect Handlers Guide](./effect-handlers.md) | Handle API calls, DB, etc. |
| **Complete example** | [Todo App Example](./todo-example.md) | Full-stack integration |
| **React integration** | [Getting Started](/guides/getting-started) | Build UIs (React guide coming soon) |

---

## Troubleshooting

### Error: "Schema validation failed"

**Cause:** State doesn't match Zod schema.

**Fix:** Check your initial state:

```typescript
import { createSnapshot } from "@manifesto-ai/core";

const context = { now: 0, randomSeed: "seed" };
const initialSnapshot = createSnapshot({ count: "0" }, schema.hash, context); // WRONG: should be number

// Fix:
const initialSnapshot = createSnapshot({ count: 0 }, schema.hash, context); // RIGHT
```

### Error: "No handler for effect type X"

**Cause:** Effect handler not registered.

**Fix:** Register handler before dispatching:

```typescript
host.registerEffect("api:fetchUser", async (type, params) => {
  // ... handler implementation
  return [];
});
```

### Computed value is undefined

**Cause:** Dependencies not specified correctly.

**Fix:** Ensure `deps` includes all state fields used:

```typescript
const { total } = computed.define({
  total: {
    deps: [state.items], // Must include dependencies
    expr: expr.len(state.items),
  },
});
```

MEL equivalent:

```mel
domain Example {
  state {
    items: Array<number> = []
  }

  computed total = len(items)
}
```

---

## Summary

You've learned:
- How to define a domain with Builder
- How to create Core and Host
- How to dispatch intents
- How to add computed values
- How to handle input validation
- How to avoid common pitfalls

Next: Try building the [Todo App Example](./todo-example.md) to see all layers working together.
