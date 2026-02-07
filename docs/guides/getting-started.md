# Getting Started with Manifesto

> **Covers:** Domain definition with MEL, App usage, Core computation, Host execution
> **Purpose:** Quick start guide for developers new to Manifesto
> **Time to complete:** 15-20 minutes

---

## Prerequisites

- Node.js 18+ or Bun
- Basic TypeScript knowledge

---

## Installation

```bash
npm install @manifesto-ai/app @manifesto-ai/compiler
# or
pnpm add @manifesto-ai/app @manifesto-ai/compiler
# or
bun add @manifesto-ai/app @manifesto-ai/compiler
```

---

## Your First Manifesto App: Counter

### Step 1: Define the Domain (MEL)

Create a file called `counter.mel`:

```mel
domain Counter {
  state {
    count: number = 0
    lastAction: string | null = null
  }

  action increment() {
    onceIntent {
      patch count = add(count, 1)
      patch lastAction = "increment"
    }
  }

  action decrement() {
    onceIntent {
      patch count = sub(count, 1)
      patch lastAction = "decrement"
    }
  }

  action reset() {
    onceIntent {
      patch count = 0
      patch lastAction = "reset"
    }
  }
}
```

**What you just did:**
- Defined state shape (`count` is a number, `lastAction` is an optional string)
- Created three actions: `increment`, `decrement`, and `reset`
- Each action uses `patch` to describe state changes
- Actions are **declarative** — they describe what should happen, not how to execute it
- `onceIntent` ensures the action body runs only once per intent (re-entry safety)

---

### Step 2: Create and Use the App

Create a file called `main.ts`:

```typescript
import { createApp } from "@manifesto-ai/app";
import CounterMel from "./counter.mel";

// Create app instance
const app = createApp({ schema: CounterMel, effects: {} });

async function main() {
  // Initialize the app
  await app.ready();

  // Read initial state
  console.log("Initial count:", app.getState().data.count);
  // → Initial count: 0

  // Dispatch actions
  await app.act("increment").done();
  console.log("After increment:", app.getState().data.count);
  // → After increment: 1

  await app.act("increment").done();
  console.log("After second increment:", app.getState().data.count);
  // → After second increment: 2

  await app.act("decrement").done();
  console.log("After decrement:", app.getState().data.count);
  // → After decrement: 1

  await app.act("reset").done();
  console.log("After reset:", app.getState().data.count);
  // → After reset: 0

  // Clean up
  await app.dispose();
}

main().catch(console.error);
```

Run it:

```bash
npx tsx main.ts
```

**What you just did:**
- Created an app from your MEL domain
- Initialized the app with `app.ready()`
- Dispatched intents to change state with `app.act()`
- Read state with `app.getState()`

---

### Step 3: Add Computed Values

Update `counter.mel`:

```mel
domain Counter {
  state {
    count: number = 0
    lastAction: string | null = null
  }

  // Computed values - derived from state, always recalculated
  computed isPositive = gt(count, 0)
  computed isZero = eq(count, 0)
  computed doubled = mul(count, 2)
  computed description = cond(
    gt(count, 0),
    "positive",
    cond(
      lt(count, 0),
      "negative",
      "zero"
    )
  )

  action increment() {
    onceIntent {
      patch count = add(count, 1)
      patch lastAction = "increment"
    }
  }

  action decrement() {
    onceIntent {
      patch count = sub(count, 1)
      patch lastAction = "decrement"
    }
  }

  action reset() {
    onceIntent {
      patch count = 0
      patch lastAction = "reset"
    }
  }
}
```

Use computed values in TypeScript:

```typescript
await app.act("increment").done();
await app.act("increment").done();

const state = app.getState();
console.log("Count:", state.data.count);           // → 2
console.log("Is positive?", state.computed.isPositive);  // → true
console.log("Doubled:", state.computed.doubled);        // → 4
console.log("Description:", state.computed.description); // → "positive"
```

**What computed values are:**
- Derived values calculated from state
- **Always recalculated** (never stored)
- Form a Directed Acyclic Graph (DAG)
- Declared once, available everywhere

---

### Step 4: Add Actions with Parameters

Update `counter.mel`:

```mel
domain Counter {
  state {
    count: number = 0
  }

  action setCount(value: number) {
    onceIntent {
      patch count = value
    }
  }

  action addAmount(amount: number) {
    onceIntent {
      patch count = add(count, amount)
    }
  }

  action increment() {
    onceIntent {
      patch count = add(count, 1)
    }
  }
}
```

Use actions with parameters:

```typescript
await app.act("setCount", { value: 10 }).done();
console.log(app.getState().data.count);  // → 10

await app.act("addAmount", { amount: 5 }).done();
console.log(app.getState().data.count);  // → 15

await app.act("increment").done();
console.log(app.getState().data.count);  // → 16
```

**What you just did:**
- Added action parameters in MEL
- Passed input values when dispatching actions

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
    status: 'idle' | 'running' | 'completed' | 'failed';
    pendingRequirements: Requirement[];
    // ...
  };
  input: unknown;
  meta: {
    version: number;
    timestamp: string;
    hash: string;
  };
};
```

**Key principle:** All communication happens through Snapshot. There is no other channel.

### Flow: Declarative Computation

Flows are data structures that describe computations. When you write:

```mel
action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}
```

This compiles to a data structure like:

```typescript
{
  kind: "seq",
  steps: [
    { kind: "guard", condition: "...", body: [
      { kind: "patch", op: "set", path: "data.count", value: { kind: "add", ... } }
    ]}
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
// When you call:
app.act("increment");

// It creates an intent like:
{
  type: "increment",
  input: undefined,
  intentId: "uuid-..."
}
```

Intents are requests to perform an action. They trigger Flow execution.

---

## Next Steps

### Add Effects (API Calls, etc.)

```mel
domain Users {
  state {
    user: object | null = null
    loading: boolean = false
    error: string | null = null
  }

  action fetchUser(id: string) {
    onceIntent when eq(loading, false) {
      patch loading = true
      patch error = null
      effect api.fetchUser { userId: id }
    }
  }
}
```

Register the effect handler in TypeScript:

```typescript
import { createApp } from "@manifesto-ai/app";
import UsersMel from "./users.mel";

const app = createApp({
  schema: UsersMel,
  effects: {
    "api.fetchUser": async (params, ctx) => {
      try {
        const response = await fetch(`/api/users/${params.userId}`);
        const user = await response.json();

        return [
          { op: "set", path: "data.user", value: user },
          { op: "set", path: "data.loading", value: false }
        ];
      } catch (error) {
        return [
          { op: "set", path: "data.error", value: error.message },
          { op: "set", path: "data.loading", value: false }
        ];
      }
    },
  },
});

await app.ready();
await app.act("fetchUser", { id: "123" }).done();
console.log(app.getState().data.user);
```

**Important:** Effects return **patches**, not values. The result is written to Snapshot.

### Subscribe to State Changes

```typescript
const app = createApp({ schema: CounterMel, effects: {} });
await app.ready();

// Subscribe to count changes
const unsubscribe = app.subscribe(
  (state) => state.data.count,
  (count) => console.log("Count changed to:", count)
);

await app.act("increment").done();  // → "Count changed to: 1"
await app.act("increment").done();  // → "Count changed to: 2"

unsubscribe();  // Stop listening
```

---

## Common Beginner Mistakes

### Mistake 1: Missing onceIntent Guard

```mel
// WRONG: Runs every compute cycle!
action increment() {
  patch count = add(count, 1)
}

// RIGHT: Runs only once per intent
action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}
```

### Mistake 2: Mutating Snapshots

```typescript
// WRONG: Direct mutation does nothing!
const state = app.getState();
state.data.count = 5;

// RIGHT: Use actions
await app.act("setCount", { value: 5 }).done();
```

### Mistake 3: Expecting Effects to Return Values

```typescript
// WRONG: Effects don't return values to actions
const user = await someEffect();  // Not how it works!

// RIGHT: Effects write to Snapshot, read it after
await app.act("fetchUser", { id: "123" }).done();
const user = app.getState().data.user;  // Read from Snapshot
```

---

## Minimal Complete Example

**counter.mel:**

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
}
```

**main.ts:**

```typescript
import { createApp } from "@manifesto-ai/app";
import CounterMel from "./counter.mel";

const app = createApp({ schema: CounterMel, effects: {} });

async function main() {
  await app.ready();

  console.log("Count:", app.getState().data.count);      // → 0
  console.log("Doubled:", app.getState().computed.doubled); // → 0

  await app.act("increment").done();

  console.log("Count:", app.getState().data.count);      // → 1
  console.log("Doubled:", app.getState().computed.doubled); // → 2

  await app.dispose();
}

main();
```

---

## What to Learn Next

| Topic | Guide | Why |
|-------|-------|-----|
| **Re-entry safety** | [Re-entry Safe Flows](./reentry-safe-flows.md) | Prevent duplicate effects |
| **Effect handlers** | [Effect Handlers Guide](./effect-handlers.md) | Handle API calls, DB, etc. |
| **Complete example** | [Todo App Example](./todo-example.md) | Full-stack integration |
| **React integration** | [React Integration](./react-integration.md) | Build reactive UIs |
| **MEL syntax** | [MEL Syntax Reference](/mel/SYNTAX) | Complete language reference |

---

## Troubleshooting

### Error: "Cannot find module './counter.mel'"

MEL files need bundler support. Configure your bundler:

**Vite:**
```typescript
// vite.config.ts
import { melPlugin } from '@manifesto-ai/compiler/vite';

export default defineConfig({
  plugins: [melPlugin()],
});
```

**Node.js with tsx:**
```bash
npx tsx --loader @manifesto-ai/compiler/loader main.ts
```

### Error: "App is not ready"

Always call `app.ready()` before using the app:

```typescript
const app = createApp({ schema: mel, effects: {} });
await app.ready();  // Required!
// Now safe to use app.act(), app.getState(), etc.
```

### Action never completes

Check that your MEL action has proper guards:

```mel
// WRONG: No guard - runs every compute cycle!
action bad() {
  patch count = 1
}

// RIGHT: Has guard
action good() {
  onceIntent { patch count = 1 }
}
```

---

## Summary

You've learned:
- How to define a domain with MEL
- How to create and use a Manifesto app
- How to dispatch actions and read state
- How to add computed values
- How to handle action parameters
- How to add effects for async operations
- How to avoid common pitfalls

Next: Try building the [Todo App Example](./todo-example.md) to see all layers working together.
