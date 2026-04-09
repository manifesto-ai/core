# Quickstart

> Get one base-runtime app running in a few minutes.

## Install

```bash
# npm
npm install @manifesto-ai/sdk @manifesto-ai/compiler

# pnpm
pnpm add @manifesto-ai/sdk @manifesto-ai/compiler

# bun
bun add @manifesto-ai/sdk @manifesto-ai/compiler
```

## Configure MEL

MEL files (`.mel`) need a bundler plugin. Here is the common Vite setup:

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

## What Just Happened?

- MEL defined the state and action semantics.
- `createManifesto()` created a composable manifesto.
- `activate()` opened the runtime surface.
- `createIntent()` built a typed intent from the MEL action.
- `dispatchAsync()` executed that intent and resolved after the next terminal snapshot was published.

## Next Step

1. Continue with the [Tutorial](/tutorial/) for the normal learning path.
2. Use [Bundler Setup](/guides/bundler-setup) only if you are not on Vite.
3. Use [Developer Tooling](/guides/developer-tooling) when you want CLI, editor, Studio, or AI-tool setup.
4. Use [When You Need Approval or History](/guides/approval-and-history) only if the project later needs review, audit history, or sealing.
