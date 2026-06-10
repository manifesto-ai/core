# Quick Start

> Get one MEL domain running through the SDK in a few minutes.

## Prerequisites

- Node 24 or newer. The repository examples are validated with `node >=24.0.0`.
- A package manager. The repo uses `pnpm@10.33.2`; app projects can also use
  npm, pnpm, bun, or yarn.
- Basic TypeScript familiarity. You can start with plain JavaScript, but the
  React and agent docs use generated TypeScript facades.
- Choose one way to import `.mel` files:
  - Node/tsx with the MEL loader for the smallest copy-paste script
  - Vite or another bundler for app code

## Install Manually

Choose the path you are using. The direct Node/tsx path is the smallest way to
prove the runtime works.

For a direct Node/tsx script:

```bash
npm install @manifesto-ai/sdk
npm install -D @manifesto-ai/compiler tsx typescript
```

For a Vite app:

```bash
npm install @manifesto-ai/sdk
npm install -D @manifesto-ai/compiler
```

Install `@manifesto-ai/compiler` whenever your project imports compiler
entrypoints, such as the Vite MEL plugin or the Node/tsx loader.

## Optional: Bootstrap With The CLI

```bash
npx @manifesto-ai/cli init
```

This opens the interactive init flow. Choose the SDK runtime and your bundler
integration. The CLI installs runtime packages, records the project
configuration, and wires the selected MEL integration.

::: tip Prefer pnpm or bun?
Use `pnpm dlx @manifesto-ai/cli init` or `bunx @manifesto-ai/cli init`.
:::

## Configure MEL Manually

Skip this section for the direct Node/tsx script. If you are using Vite and the
CLI did not already wire it for you, add the MEL plugin:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { melPlugin } from "@manifesto-ai/compiler/vite";

export default defineConfig({
  plugins: [melPlugin()],
});
```

Other bundlers are covered in [Bundler Setup](/guides/bundler-setup). If you
want the CLI to patch a bundler integration, run it through the package:

```bash
npx @manifesto-ai/cli integrate vite
```

## Define Your Domain

Create `counter.mel` and `main.ts` in the same directory for this quick start:

```mel
domain Counter {
  state {
    count: number = 0
  }

  computed doubled = count * 2

  action increment() {
    onceIntent {
      patch count = count + 1
    }
  }
}
```

This guide uses the current sugar-first MEL surface. The equivalent function-form source remains valid where documented in the MEL reference.

## Run It In Your App

Put this in a file that your app or script runs:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

const app = createManifesto(CounterMel, {}).activate();

await app.action.increment.submit();

const snapshot = app.snapshot();
console.log(snapshot.state.count);      // 1
console.log(snapshot.computed.doubled); // 2
```

In a Vite app, put the TypeScript in your normal app entry and run your normal
dev server:

```bash
npm run dev
```

Open the browser console or render those two values in your app; you should see
the same `1` and `2` values shown below. In a direct Node/tsx script, run
`main.ts` from the directory that contains `counter.mel`:

```bash
npx tsx --loader @manifesto-ai/compiler/node-loader main.ts
```

If you want that direct-script path pinned in your project, install `tsx` and
`typescript` as dev dependencies.

## What You Should See

The direct script should print:

```text
1
2
```

That means the action updated `count`, and `doubled` was recalculated from the
new state.

## What Just Happened?

- MEL declared domain state, derived values, and an action.
- `createManifesto()` prepared the MEL domain for the app runtime.
- `activate()` opened the runtime helpers.
- `action.increment.submit()` validated the request and updated the app state
  you can read with `snapshot()`.
- Under the SDK surface, Core computed the semantic transition and Host
  converged the next Snapshot.

## Next

Skim [Project Anatomy](./project-anatomy) to see where files go. Then continue
to [MEL Domain Basics](./essentials/mel-domain-basics),
[MEL For App Developers](./essentials/mel-for-app-developers), and the
[Tutorial](/tutorial/).

When the Todo app works, add [Bundler Setup](/guides/bundler-setup) and
[Code Generation](/guides/code-generation) so the same `.mel` file emits the
generated `TodoDomain` type used by the React and agent docs. Then wire
[React](/integration/react), compare with [Runnable Examples](./runnable-examples),
and use [Web App + Agent](/integration/web-app-and-agent) when the UI and an
agent need to share the same server runtime.
