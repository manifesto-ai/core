# Manifesto

**Semantic Layer for Deterministic Domain State**

Manifesto gives you one semantic model for deterministic domain state, traceable history, and explicit governance.

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/core.svg)](https://www.npmjs.com/package/@manifesto-ai/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Install

```bash
pnpm add @manifesto-ai/sdk @manifesto-ai/compiler
```

---

## Quick Example

Define a domain in MEL:

```mel
domain Counter {
  state { count: number = 0 }

  action increment() {
    onceIntent { patch count = add(count, 1) }
  }
}
```

Configure your bundler (Vite shown):

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { melPlugin } from "@manifesto-ai/compiler/vite";

export default defineConfig({
  plugins: [melPlugin()],
});
```

Activate and run:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

const app = createManifesto(CounterMel, {}).activate();

await app.dispatchAsync(
  app.createIntent(app.MEL.actions.increment),
);
console.log(app.getSnapshot().data.count); // 1
```

---

## Packages

| Package | Role |
|---------|------|
| [`@manifesto-ai/sdk`](./docs/api/sdk.md) | Activation-first public API |
| [`@manifesto-ai/core`](./docs/api/core.md) | Pure semantic computation |
| [`@manifesto-ai/host`](./docs/api/host.md) | Effect execution runtime |
| [`@manifesto-ai/compiler`](./docs/api/compiler.md) | MEL to DomainSchema compiler |
| [`@manifesto-ai/codegen`](./docs/api/codegen.md) | Schema-driven code generation |
| [`@manifesto-ai/lineage`](./docs/api/lineage.md) | Seal-aware continuity and history |
| [`@manifesto-ai/governance`](./docs/api/governance.md) | Proposal legitimacy and approval |

---

## Two Paths

| Path | Use it when | Start here |
|------|-------------|------------|
| **Base runtime** | You want the shortest path to a running app | [`@manifesto-ai/sdk`](./docs/api/sdk.md) |
| **Governed composition** | You need lineage, authority, and sealing | [`@manifesto-ai/lineage`](./docs/api/lineage.md) + [`@manifesto-ai/governance`](./docs/api/governance.md) |

The core equation stays the same:

```text
compute(schema, snapshot, intent) -> (snapshot', requirements, trace)
```

Pure, total, and traceable.

---

## What Manifesto Is Not

- Not a state management library
- Not an AI framework
- Not a database or ORM
- Not a workflow engine

---

## Where To Go Next

- [Quickstart](./docs/quickstart.md)
- [Tutorial](./docs/tutorial/index.md)
- [API Reference](./docs/api/index.md)
- [Concepts](./docs/concepts/index.md)
- [Architecture](./docs/architecture/index.md)
