# Quickstart

> Get Manifesto running in 5 minutes

---

## Install

```bash
# npm
npm install @manifesto-ai/sdk @manifesto-ai/compiler

# pnpm
pnpm add @manifesto-ai/sdk @manifesto-ai/compiler

# bun
bun add @manifesto-ai/sdk @manifesto-ai/compiler
```

---

## Configure MEL

MEL files (`.mel`) need a bundler plugin. Here's the common Vite setup:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { melPlugin } from "@manifesto-ai/compiler/vite";

export default defineConfig({
  plugins: [melPlugin()],
});
```

::: tip Other bundlers?
Next.js, Webpack, Rollup, esbuild, and Rspack are all supported. See [Bundler Setup](/guides/bundler-setup).
:::

---

## Create Your First App

### 1. Define the domain

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

### 2. Create and run

```typescript
import { createIntent, createManifesto, dispatchAsync } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

const app = createManifesto({ schema: CounterMel, effects: {} });

await dispatchAsync(app, createIntent("increment", "intent-1"));
console.log(app.getSnapshot().data.count); // 1

await dispatchAsync(app, createIntent("increment", "intent-2"));
console.log(app.getSnapshot().data.count); // 2
```

---

## What Just Happened?

- MEL defined the state and action semantics
- `onceIntent` kept the action re-entry safe
- `createManifesto()` assembled the direct-dispatch runtime
- `dispatch()` enqueued the intent
- `getSnapshot()` returned the terminal result

---

## Next Step

If you need explicit lineage, authority, and sealing, read [Governed Composition](/guides/governed-composition).

---

## Key Concepts

| Concept | What It Does |
|---------|--------------|
| **Snapshot** | Single source of truth for all state |
| **Intent** | Request to perform an action |
| **Flow** | Declarative computation (pure, no side effects) |
| **Effect** | External operation (API calls, etc.) |
| **World** | Governance layer that decides what becomes history |

```text
compute(schema, snapshot, intent) -> (snapshot', requirements, trace)
```

Same input always produces same output. Pure, deterministic, traceable.
