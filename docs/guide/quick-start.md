# Quick Start

> Get one base-runtime app running in a few minutes.

## Bootstrap With The CLI

```bash
npx @manifesto-ai/cli init
```

This opens the interactive init flow. Choose the base runtime and your bundler integration. The CLI installs runtime packages, records Manifesto project intent, and wires the selected MEL integration.

::: tip Prefer pnpm or bun?
Use `pnpm dlx @manifesto-ai/cli init` or `bunx @manifesto-ai/cli init`.
:::

## Install Manually

If you do not want the CLI to patch your repo, install the runtime first:

```bash
npm install @manifesto-ai/sdk
```

`@manifesto-ai/sdk` depends on the compiler. Install `@manifesto-ai/compiler` directly only when your project imports compiler entrypoints, such as the Vite MEL plugin:

```bash
npm install -D @manifesto-ai/compiler
```

## Configure MEL Manually

Skip this section if the CLI already wired Vite for you. Otherwise, add the MEL plugin:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { melPlugin } from "@manifesto-ai/compiler/vite";

export default defineConfig({
  plugins: [melPlugin()],
});
```

Other bundlers are covered in [Bundler Setup](/guides/bundler-setup), or can be wired with `manifesto integrate`.

## Define Your Domain

Create `counter.mel`:

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

## Run It In Your App

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterSchema from "./counter.mel";

const app = createManifesto(CounterSchema, {}).activate();

await app.dispatchAsync(
  app.createIntent(app.MEL.actions.increment),
);

const snapshot = app.getSnapshot();
console.log(snapshot.data.count);       // 1
console.log(snapshot.computed.doubled); // 2
```

## What Just Happened?

- MEL declared domain state, derived values, and an action.
- `createManifesto()` created a composable manifesto from the schema.
- `activate()` opened the base runtime surface.
- `createIntent()` built a typed request from `MEL.actions.increment`.
- `dispatchAsync()` published the next terminal Snapshot.

## Next

Continue to [Creating an App](./essentials/creating-an-app), or jump to [React](/integration/react), [AI Agents](/integration/ai-agents), or [API Reference](/api/) if you already know what you need.
