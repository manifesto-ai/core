# Tutorial 1: Your First App

> **Time:** 15 minutes
> **Goal:** Build a working counter application

In this tutorial, you'll build a simple counter app that increments and decrements a number. Along the way, you'll learn the fundamental patterns used in every Manifesto application.

---

## What You'll Build

A counter with:
- A count value starting at 0
- An increment action that adds 1
- A decrement action that subtracts 1

---

## Step 1: Create a New Project

Create a new directory and initialize it:

```bash
mkdir my-counter-app
cd my-counter-app
npm init -y
```

Install the required packages:

```bash
npm install @manifesto-ai/app @manifesto-ai/compiler typescript
```

Create a `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["*.ts", "*.mel"]
}
```

---

## Step 2: Define Your Domain (MEL)

Create a file called `counter.mel`. This file defines what your application can do.

```mel
domain Counter {
  state {
    count: number = 0
  }

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

Let's break this down:

| Element | What It Does |
|---------|--------------|
| `domain Counter` | Names your application domain |
| `state { count: number = 0 }` | Declares a `count` field starting at 0 |
| `action increment()` | Defines an action named "increment" |
| `onceIntent { ... }` | Ensures the body runs only once per action call |
| `$mel` guard state | Stored automatically (no extra schema fields) |
| `patch count = add(count, 1)` | Updates `count` by adding 1 |

**Key insight:** The `onceIntent` guard prevents the action from running multiple times if the system re-evaluates. This is called **re-entry safety**. Use `once()` only when you need an explicit guard field in domain state.

---

## Step 3: Create the App

Create a file called `app.ts`:

```typescript
import { createApp } from "@manifesto-ai/app";
import CounterMel from "./counter.mel";

// Create the app instance
export const app = createApp({ schema: CounterMel, effects: {} });
```

That's it. One line creates your entire application. The `createApp` function:
- Compiles your MEL domain
- Sets up the runtime (Host, World, Core)
- Provides a simple API for actions and state

---

## Step 4: Use the App

Create a file called `main.ts`:

```typescript
import { app } from "./app";

async function main() {
  // Step 1: Initialize the app
  await app.ready();
  console.log("App is ready!");

  // Step 2: Read initial state
  const initialState = app.getState();
  console.log("Initial count:", initialState.data.count);
  // Output: Initial count: 0

  // Step 3: Call the increment action
  await app.act("increment").done();
  console.log("After increment:", app.getState().data.count);
  // Output: After increment: 1

  // Step 4: Call increment again
  await app.act("increment").done();
  console.log("After second increment:", app.getState().data.count);
  // Output: After second increment: 2

  // Step 5: Call decrement
  await app.act("decrement").done();
  console.log("After decrement:", app.getState().data.count);
  // Output: After decrement: 1

  // Clean up
  await app.dispose();
}

main().catch(console.error);
```

Run it:

```bash
npx tsx main.ts
```

You should see:

```
App is ready!
Initial count: 0
After increment: 1
After second increment: 2
After decrement: 1
```

---

## Step 5: Subscribe to Changes

Instead of reading state after each action, you can subscribe to changes:

```typescript
import { app } from "./app";

async function main() {
  await app.ready();

  // Subscribe to count changes
  const unsubscribe = app.subscribe(
    (state) => state.data.count,           // Selector: what to watch
    (count) => console.log("Count is now:", count)  // Callback: what to do
  );

  // These will trigger the subscriber
  await app.act("increment").done();
  // Output: Count is now: 1

  await app.act("increment").done();
  // Output: Count is now: 2

  await app.act("decrement").done();
  // Output: Count is now: 1

  // Stop subscribing
  unsubscribe();

  // This won't trigger the subscriber (we unsubscribed)
  await app.act("increment").done();

  // But state still changed
  console.log("Final count:", app.getState().data.count);
  // Output: Final count: 2

  await app.dispose();
}

main().catch(console.error);
```

**Key insight:** The subscriber only fires when the selected value actually changes. If you call an action that doesn't change the count, the subscriber won't fire.

---

## Understanding What Happened

Here's what happens when you call `app.act("increment")`:

```
1. act("increment") creates an ActionHandle
           |
           v
2. Intent { type: "increment" } is submitted to World
           |
           v
3. World evaluates authority (auto-approved by default)
           |
           v
4. Host executes the action:
   - Core reads the Flow from your MEL domain
   - Flow generates patches: [{ op: 'set', path: 'count', value: 1 }]
           |
           v
5. Host applies patches to create new Snapshot
           |
           v
6. Subscribers are notified
           |
           v
7. ActionHandle resolves (.done() completes)
```

This flow is the same for every action, no matter how complex. Understanding it will help you debug issues and reason about your application.

---

## The Complete Code

Here's everything together:

**counter.mel:**
```mel
domain Counter {
  state {
    count: number = 0
  }

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

**app.ts:**
```typescript
import { createApp } from "@manifesto-ai/app";
import CounterMel from "./counter.mel";

export const app = createApp({ schema: CounterMel, effects: {} });
```

**main.ts:**
```typescript
import { app } from "./app";

async function main() {
  await app.ready();

  // Subscribe to changes
  app.subscribe(
    (state) => state.data.count,
    (count) => console.log("Count:", count)
  );

  // Perform actions
  await app.act("increment").done();
  await app.act("increment").done();
  await app.act("decrement").done();

  console.log("Final:", app.getState().data.count);

  await app.dispose();
}

main().catch(console.error);
```

---

## Key Concepts Learned

| Concept | Description |
|---------|-------------|
| **MEL Domain** | Defines state and actions in a declarative language |
| **State** | The data your application manages |
| **Action** | A named operation that modifies state |
| **onceIntent guard** | Ensures an action body runs exactly once |
| **patch** | Declarative instruction to modify state |
| **app.act()** | Triggers an action, returns a handle |
| **app.getState()** | Reads current state |
| **app.subscribe()** | Reacts to state changes |

---

## Exercises

Try these modifications to reinforce what you learned:

### Exercise 1: Add a Reset Action

Add an action that sets count back to 0:

```mel
action reset() {
  onceIntent {
    patch count = 0
  }
}
```

### Exercise 2: Add a Set Action with Parameters

Add an action that sets count to a specific value:

```mel
action setCount(value: number) {
  onceIntent {
    patch count = value
  }
}
```

Use it:
```typescript
await app.act("setCount", { value: 100 }).done();
```

### Exercise 3: Subscribe to Multiple Values

Create a computed value and subscribe to it:

```mel
domain Counter {
  state {
    count: number = 0
  }

  computed doubled = mul(count, 2)
  computed isPositive = gt(count, 0)

  // ... actions
}
```

Subscribe:
```typescript
app.subscribe(
  (state) => state.computed["computed.doubled"],
  (doubled) => console.log("Doubled:", doubled)
);
```

---

## What's Next?

In the next tutorial, you'll learn more about:
- Multiple actions with complex logic
- Action parameters
- Computed values
- The complete state structure

[Continue to Tutorial 2: Actions and State](./02-actions-and-state)

---

## Troubleshooting

### "Cannot find module './counter.mel'"

Ensure your bundler/transpiler supports MEL imports. With `tsx`:

```bash
npx tsx --loader @manifesto-ai/compiler/loader main.ts
```

Or configure your bundler to handle `.mel` files.

### "App is not ready"

Always call `await app.ready()` before using other methods:

```typescript
const app = createApp({ schema: mel, effects: {} });
await app.ready();  // Required!
app.act("increment");
```

### Action never completes

Check that your MEL action has proper guards:

```mel
// WRONG: No guard
action bad() {
  patch count = 1  // Runs every computation cycle!
}

// RIGHT: Has guard
action good() {
  onceIntent { patch count = 1 }
}
```
