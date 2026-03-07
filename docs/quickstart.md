# Quickstart

> Get Manifesto running in 5 minutes

---

## Installation

```bash
# npm
npm install @manifesto-ai/sdk @manifesto-ai/compiler

# pnpm
pnpm add @manifesto-ai/sdk @manifesto-ai/compiler

# bun
bun add @manifesto-ai/sdk @manifesto-ai/compiler
```

---

## Configure MEL Loader

MEL files (`.mel`) need a loader to be imported in your code. Choose the option that fits your setup:

### Using tsx (Simplest)

```bash
# Run tsx with MEL loader
npx tsx --loader @manifesto-ai/compiler/loader main.ts
```

### Using Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { melPlugin } from '@manifesto-ai/compiler/vite';

export default defineConfig({
  plugins: [melPlugin()]
});
```

### Using Webpack

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.mel$/,
        use: '@manifesto-ai/compiler/loader'
      }
    ]
  }
};
```

### Troubleshooting

::: details Cannot find module './counter.mel'?
MEL files require a loader. If you see this error:
1. Make sure you're using `tsx`, Vite with plugin, or Webpack with loader
2. Check that `@manifesto-ai/compiler` is installed
3. For TypeScript: create a `mel.d.ts` file with:
```typescript
declare module '*.mel' {
  import { DomainModule } from '@manifesto-ai/compiler';
  const module: DomainModule;
  export default module;
}
```
:::

---

## Create Your First Manifesto Instance

### 1. Define Your Domain

Create `counter.mel`:

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
}
```

### 2. Create and Run

Create `main.ts`:

```typescript
import {
  createManifesto,
  createIntent,
  type ManifestoInstance,
  type Intent,
  type Snapshot,
} from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

function dispatchAsync(
  manifesto: ManifestoInstance,
  intent: Intent,
): Promise<Snapshot> {
  return new Promise((resolve, reject) => {
    const offCompleted = manifesto.on("dispatch:completed", (event) => {
      if (event.intentId !== intent.intentId) return;
      offCompleted();
      offFailed();
      resolve(event.snapshot!);
    });
    const offFailed = manifesto.on("dispatch:failed", (event) => {
      if (event.intentId !== intent.intentId) return;
      offCompleted();
      offFailed();
      reject(event.error ?? new Error("Dispatch failed"));
    });

    manifesto.dispatch(intent);
  });
}

const manifesto = createManifesto({ schema: CounterMel, effects: {} });

await dispatchAsync(manifesto, createIntent("increment", "intent-1"));
console.log(manifesto.getSnapshot().data.count); // 1

await dispatchAsync(manifesto, createIntent("increment", "intent-2"));
console.log(manifesto.getSnapshot().data.count); // 2
```

Run it:

```bash
npx tsx main.ts
```

---

## What Just Happened?

- **MEL domain** defined your state schema and actions declaratively
- **`onceIntent` guard** ensured the action runs exactly once per intent (re-entry safe)
- **No guard fields** needed — `onceIntent` stores guard state in the platform `$mel` namespace
- **`createManifesto()`** compiled or accepted your schema and assembled the protocol stack
- **`dispatch()`** enqueued intents for serial processing
- **`dispatchAsync()`** is a tiny convenience built on top of `dispatch()` + `on()`
- **`getSnapshot()`** returned the current terminal snapshot

---

## Add a Decrement Action

Update `counter.mel`:

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

  action decrement() available when gt(count, 0) {
    onceIntent {
      patch count = sub(count, 1)
    }
  }
}
```

Update `main.ts`:

```typescript
import {
  createManifesto,
  createIntent,
  type ManifestoInstance,
  type Intent,
  type Snapshot,
} from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

function dispatchAsync(
  manifesto: ManifestoInstance,
  intent: Intent,
): Promise<Snapshot> {
  return new Promise((resolve, reject) => {
    const offCompleted = manifesto.on("dispatch:completed", (event) => {
      if (event.intentId !== intent.intentId) return;
      offCompleted();
      offFailed();
      resolve(event.snapshot!);
    });
    const offFailed = manifesto.on("dispatch:failed", (event) => {
      if (event.intentId !== intent.intentId) return;
      offCompleted();
      offFailed();
      reject(event.error ?? new Error("Dispatch failed"));
    });

    manifesto.dispatch(intent);
  });
}

const manifesto = createManifesto({ schema: CounterMel, effects: {} });

// Subscribe to changes
manifesto.subscribe(
  (state) => state.data.count,
  (count) => console.log("Count changed:", count)
);

await dispatchAsync(manifesto, createIntent("increment", "intent-1"));
// → Count changed: 1

await dispatchAsync(manifesto, createIntent("increment", "intent-2"));
// → Count changed: 2

await dispatchAsync(manifesto, createIntent("decrement", "intent-3"));
// → Count changed: 1

// Access computed values
console.log(manifesto.getSnapshot().computed["doubled"]); // 2
```

---

## Next Steps

| Topic | Description |
|-------|-------------|
| [Tutorial](/tutorial/) | Step-by-step learning path |
| [MEL Syntax](/mel/SYNTAX) | Complete language reference |
| [Core Concepts](/concepts/) | Snapshot, Intent, Effect, Flow |
| [Integration](/integration/) | React and AI agents |

---

## Key Concepts (1-Minute Summary)

| Concept | What It Does |
|---------|--------------|
| **Snapshot** | Single source of truth for all state |
| **Intent** | Request to perform an action |
| **Flow** | Declarative computation (pure, no side effects) |
| **Effect** | External operation (API calls, etc.) |
| **World** | Governance layer (who can do what) |

**The fundamental equation:**

```
compute(schema, snapshot, intent) -> (snapshot', requirements, trace)
```

Same input always produces same output. Pure, deterministic, traceable.
