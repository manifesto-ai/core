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

## Optional DX Add-ons

Once the base runtime is in place, add the surrounding tooling only where it helps:

| Need | Package | Docs |
|------|---------|------|
| Bootstrap and configure a project | `@manifesto-ai/cli` | [CLI API](/api/cli) |
| Author MEL with editor and agent-aware tooling | `@manifesto-ai/mel-lsp` | [MEL LSP API](/api/mel-lsp) |
| Load current Manifesto guidance into AI tools | `@manifesto-ai/skills` | [Skills API](/api/skills) |
| Inspect findings, snapshots, trace, lineage, or governance | `@manifesto-ai/studio-cli`, `@manifesto-ai/studio-mcp` | [Developer Tooling Guide](/guides/developer-tooling) |

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

const world = createManifesto(CounterMel, {}).activate();

await world.dispatchAsync(
  world.createIntent(world.MEL.actions.increment),
);
console.log(world.getSnapshot().data.count); // 1

await world.dispatchAsync(
  world.createIntent(world.MEL.actions.increment),
);
console.log(world.getSnapshot().data.count); // 2
```

---

## What Just Happened?

- MEL defined the state and action semantics
- `createManifesto()` created a composable manifesto
- `activate()` opened the runtime surface
- `world.createIntent(world.MEL.actions.increment)` built a typed intent from the MEL action
- `dispatchAsync()` executed that intent and resolved after the next terminal snapshot was published

---

## Next Step

- Continue with the [Tutorial](/tutorial/) for the base-runtime learning path
- Read [Developer Tooling](/guides/developer-tooling) when you want CLI setup, editor support, Studio inspection, or AI coding tool integration
- Read [When You Need Approval or History](/guides/approval-and-history) only if the project later needs review, audit history, or sealing

---

## Key Concepts

| Concept | What It Does |
|---------|--------------|
| **Snapshot** | Default runtime read model for application state |
| **Intent** | Request to perform an action |
| **Flow** | Declarative computation (pure, no side effects) |
| **Effect** | External operation (API calls, etc.) |

```text
compute(schema, snapshot, intent) -> (snapshot', requirements, trace)
```

Same input always produces same output. Pure, deterministic, traceable.
