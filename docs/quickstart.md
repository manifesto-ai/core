# Quickstart

> Get Manifesto running in 5 minutes.

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

### 2. Activate and run

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

const instance = createManifesto(CounterMel, {}).activate();

await instance.dispatchAsync(
  instance.createIntent(instance.MEL.actions.increment),
);
console.log(instance.getSnapshot().data.count); // 1

await instance.dispatchAsync(
  instance.createIntent(instance.MEL.actions.increment),
);
console.log(instance.getSnapshot().data.count); // 2
```

---

## What Just Happened?

- MEL defined the state and action semantics
- `createManifesto()` created a composable manifesto
- `activate()` opened the runtime surface
- `instance.createIntent(instance.MEL.actions.increment)` built a typed intent from the MEL action
- `dispatchAsync()` executed that intent and resolved after the next terminal snapshot was published

---

## Next Step

- Continue with the [Tutorial](/tutorial/) for the base-runtime learning path
- Jump to [Governed Composition](/tutorial/05-governed-composition) when you need explicit lineage, authority, and sealing

---

## Key Concepts

| Concept | What It Does |
|---------|--------------|
| **Snapshot** | Default runtime read model for application state |
| **Intent** | Request to perform an action |
| **Flow** | Declarative computation (pure, no side effects) |
| **Effect** | External operation (API calls, etc.) |
| **World** | Governed composition built from Lineage and Governance when you need legitimacy and continuity |

```text
compute(schema, snapshot, intent) -> (snapshot', requirements, trace)
```

Same input always produces same output. Pure, deterministic, traceable.
