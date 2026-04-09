# Manifesto

**Semantic Layer for Deterministic Domain State**

Manifesto gives you one semantic model for deterministic domain state and tooling surfaces built from the same schema. Approval, history, and governance come later only when the project needs them.

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/core.svg)](https://www.npmjs.com/package/@manifesto-ai/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Install

```bash
pnpm add @manifesto-ai/sdk @manifesto-ai/compiler
```

## Quick Example

```mel
domain Counter {
  state { count: number = 0 }

  action increment() {
    onceIntent { patch count = add(count, 1) }
  }
}
```

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

const app = createManifesto(CounterMel, {}).activate();

await app.dispatchAsync(
  app.createIntent(app.MEL.actions.increment),
);
console.log(app.getSnapshot().data.count); // 1
```

## Start With The Docs

- Build the first app: [Docs Home](./docs/index.md) -> [Quickstart](./docs/quickstart.md) -> [Tutorial](./docs/tutorial/index.md)
- Set up CLI, editor, AI, or Studio workflows: [Developer Tooling](./docs/guides/developer-tooling.md)
- Add approval, review, or sealed history later: [When You Need Approval or History](./docs/guides/approval-and-history.md)
- Look up a package you already know: [API Reference](./docs/api/index.md)
- Go deeper into the model: [Concepts](./docs/concepts/index.md), [Architecture](./docs/architecture/index.md), [Internals](./docs/internals/index.md)

Start with `@manifesto-ai/sdk` and `@manifesto-ai/compiler`. Add Lineage, Governance, or the surrounding DX packages only when the project actually needs them.

## What Manifesto Is Not

- Not a state management library
- Not an AI framework
- Not a database or ORM
- Not a workflow engine

## Research & Citation
Manifesto is a general-purpose declarative runtime. The underlying design philosophy and the initial empirical validation of its reflective protocol
If you use this core framework in your research, please cite:

```
@misc{jeong2026llmdoesselfrevisingagent,
      title={How Much LLM Does a Self-Revising Agent Actually Need?},
      author={Seongwoo Jeong and Seonil Son},
      year={2026},
      eprint={2604.07236},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2604.07236},
}
```
