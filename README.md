# Manifesto

Manifesto computes deterministic domain state transitions.

MEL declares domain transition rules. Core computes semantic transitions from
schema, snapshot, intent, and context. Host fulfills declared effects and
converges the next Snapshot.

Most applications use the SDK as the public runtime surface: activate a domain,
submit typed actions, observe snapshots, and share the same state contract
across UI, backend routes, and agents.

Lineage and Governance are optional protocol extensions. Add them only when a
product needs history, restore, audit, approval, policy, or delegation.

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/sdk.svg)](https://www.npmjs.com/package/@manifesto-ai/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Smallest Start

```bash
npm install @manifesto-ai/sdk
npm install -D @manifesto-ai/compiler tsx typescript
```

Requires **Node.js >= 24**. That is enough for a direct Node/tsx script that
imports `.mel` files through the MEL loader. For Vite or another bundler, add
the compiler plugin shown in [Quick Start](./docs/guide/quick-start.md).

Prefer an interactive setup? Use the optional CLI:

```bash
npx @manifesto-ai/cli init
```

## Quick Example

```mel
domain Counter {
  state { count: number = 0 }

  action increment() {
    onceIntent { patch count = count + 1 }
  }
}
```

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

const app = createManifesto(CounterMel, {}).activate();

await app.action.increment.submit();
console.log(app.snapshot().state.count); // 1
```

Run a direct script with:

```bash
npx tsx --loader @manifesto-ai/compiler/node-loader main.ts
```

## Start With The Docs

Use this order if you are new:

1. Run the smallest app: [Quick Start](./docs/guide/quick-start.md)
2. Learn the file layout: [Project Anatomy](./docs/guide/project-anatomy.md)
3. Learn the MEL file: [MEL Domain Basics](./docs/guide/essentials/mel-domain-basics.md) -> [MEL For App Developers](./docs/guide/essentials/mel-for-app-developers.md)
4. Activate and read the app: [Creating an App](./docs/guide/essentials/creating-an-app.md)
5. Build the Todo path: [Tutorial](./docs/tutorial/index.md)
6. Turn the Todo domain into app-facing TypeScript: [Bundler Setup](./docs/guides/bundler-setup.md) -> [Code Generation](./docs/guides/code-generation.md)
7. Add UI wiring, then compare with the example: [React](./docs/integration/react.md) -> [Runnable Examples](./docs/guide/runnable-examples.md)
8. Put UI and agent writes behind one server runtime: [Web App + Agent](./docs/integration/web-app-and-agent.md)
9. Go deeper on agent-only tool loops: [AI Agents](./docs/integration/ai-agents.md)
10. Decide on review or history only when the product needs it: [When You Need Approval or History](./docs/guides/approval-and-history.md)

Other entry points:

- Set up CLI, editor, AI, or Studio workflows: [Developer Tooling](./docs/guides/developer-tooling.md)
- Add approval, review, or durable history later: [When You Need Approval or History](./docs/guides/approval-and-history.md)
- Look up a package you already know: [API Reference](./docs/api/index.md)
- Go deeper into the model: [Concepts](./docs/concepts/index.md), [Architecture](./docs/architecture/index.md)
- Work on the repository itself: [Internals](./docs/internals/index.md)

Start with the base SDK runtime. Add approval/history packages or surrounding
DX tools only when the project actually needs them.

## What Manifesto Is Not

- Not a state management library
- Not an AI framework
- Not a database or ORM
- Not a workflow engine

## Research & Citation
If you use Manifesto in research, please cite:

```
@misc{jung2026llmdoesselfrevisingagent,
      title={How Much LLM Does a Self-Revising Agent Actually Need?}, 
      author={Sungwoo Jung and Seonil Son},
      year={2026},
      eprint={2604.07236},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2604.07236}, 
}
```
