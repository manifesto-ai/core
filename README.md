# Manifesto

**Semantic Layer for Deterministic Domain State**

Manifesto gives you one semantic model for deterministic domain state and tooling surfaces built from the same schema. Approval, history, and governance come later only when the project needs them.

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/core.svg)](https://www.npmjs.com/package/@manifesto-ai/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Install

```bash
pnpm add @manifesto-ai/sdk @manifesto-ai/compiler
```

---

## Start Here

| If You Want | Start Here | Then Go To |
|-------------|------------|------------|
| Ship the first working app | [Quickstart](./docs/quickstart.md) | [Tutorial](./docs/tutorial/index.md) |
| Add CLI, editor, AI, or Studio workflows | [Developer Tooling](./docs/guides/developer-tooling.md) | package README or API page |
| Add review, approval, or sealed history later | [When You Need Approval or History](./docs/guides/approval-and-history.md) | `@manifesto-ai/lineage`, `@manifesto-ai/governance` |

Most teams should start with the base runtime and ignore the advanced runtime until the project actually needs reviewability or history.

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

---

## Advanced Runtime

| Package | Role |
|---------|------|
| [`@manifesto-ai/lineage`](./docs/api/lineage.md) | Seal-aware continuity and branch/head history |
| [`@manifesto-ai/governance`](./docs/api/governance.md) | Review, approval, and decision flow on top of lineage |

Only add these when the project now needs approval, audit history, or sealed continuity.

---

## Developer Tooling

| Package | Role |
|---------|------|
| [`@manifesto-ai/cli`](./docs/api/cli.md) | Bootstrap, integrate, configure, and validate a Manifesto project |
| [`@manifesto-ai/skills`](./docs/api/skills.md) | Install Manifesto-specific guidance into Codex and other AI coding tools |
| [`@manifesto-ai/mel-lsp`](./docs/api/mel-lsp.md) | Editor and agent-facing MEL diagnostics, completion, navigation, and schema introspection |
| [`@manifesto-ai/studio-cli`](./docs/api/studio-cli.md) | Terminal analysis for findings, graph, snapshots, trace, lineage, governance, and transition graphs |
| [`@manifesto-ai/studio-core`](./docs/api/studio-core.md) | Read-only projection engine for dashboards and analysis tooling |
| [`@manifesto-ai/studio-mcp`](./docs/api/studio-mcp.md) | MCP server surface for agent and remote inspection workflows |

These packages are optional. Start with `@manifesto-ai/sdk` and `@manifesto-ai/compiler`, then add the DX surface that matches your workflow.

---

## Start With Base Runtime

| Path | Use it when | Start here |
|------|-------------|------------|
| **Base runtime** | You want the shortest path to a running app | [`@manifesto-ai/sdk`](./docs/api/sdk.md) |
| **Advanced runtime** | The project later needs review, approval, or sealed history | [When You Need Approval or History](./docs/guides/approval-and-history.md) |

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

- [Start Here](./docs/start-here.md)
- [Quickstart](./docs/quickstart.md)
- [Tutorial](./docs/tutorial/index.md)
- [Developer Tooling](./docs/guides/developer-tooling.md)
- [When You Need Approval or History](./docs/guides/approval-and-history.md)
- [API Reference](./docs/api/index.md)
- [Concepts](./docs/concepts/index.md)
- [Architecture](./docs/architecture/index.md)

---

## Research & Citation
Manifesto is a general-purpose declarative runtime. The underlying design philosophy and the initial empirical validation of its reflective protocol
If you use this core framework in your research, please cite:

@misc{jeong2026llmdoesselfrevisingagent,
      title={How Much LLM Does a Self-Revising Agent Actually Need?}, 
      author={Seongwoo Jeong and Seonil Son},
      year={2026},
      eprint={2604.07236},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2604.07236}, 
}
