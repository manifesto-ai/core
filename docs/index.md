---
layout: home

hero:
  name: Manifesto
  text: Semantic Layer for Deterministic Domain State
  tagline: Define meaning once — derive UI, backend, AI, and full history as projections.
  actions:
    - theme: brand
      text: Quickstart
      link: /quickstart
    - theme: alt
      text: Tutorial
      link: /tutorial/
    - theme: alt
      text: GitHub
      link: https://github.com/manifesto-ai/core

features:
  - icon: 🎯
    title: Deterministic
    details: Same input → same output. Always.
  - icon: 🔍
    title: Accountable
    details: Every change traceable to Actor + Authority + Intent.
  - icon: 📐
    title: Schema-First
    details: All domain semantics expressed as JSON-serializable data.
  - icon: ⚡
    title: Effect Isolation
    details: Pure computation separated from IO.
---

## What is Manifesto?

Manifesto is a **semantic layer for deterministic domain state**. You define _what your domain means_ — state, transitions, derived values — and Manifesto guarantees deterministic computation, full traceability, and clean separation between logic and IO.

**Manifesto is NOT** a state manager (Redux), a workflow engine (Temporal), or an AI framework (LangChain). It is the layer that sits between your domain logic and your execution environment.

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
import { createManifesto, dispatchAsync } from "@manifesto-ai/sdk";
import CounterSchema from "./counter.mel";

const app = createManifesto({ schema: CounterSchema, effects: {} });
const snapshot = await dispatchAsync(app, { type: "increment", intentId: "1" });
console.log(snapshot.data.count); // 1
```

## Start Here

| Step | Link | Time |
|------|------|------|
| **Install and run** | [Quickstart](/quickstart) | 5 min |
| **Learn step-by-step** | [Tutorial](/tutorial/) | 30 min |
| **Understand the model** | [Concepts](/concepts/) | 15 min |
| **MEL language reference** | [MEL Reference](/mel/REFERENCE) | Browse |

## Installation

```bash
npm install @manifesto-ai/sdk @manifesto-ai/compiler
```

`@manifesto-ai/sdk` is the only package you need. It re-exports everything from Core, Host, World, and Compiler.

## Go Deeper

- [Architecture](/architecture/) — System design: Core/Host/World separation
- [Guides](/guides/) — Effect handlers, debugging, bundler setup
- [API Reference](/api/) — Package-level API docs
- [Internals](/internals/) — ADRs, SPECs, FDRs

## Community

- [GitHub](https://github.com/manifesto-ai/core)
- [Discord](https://discord.gg/manifesto-ai)
- [Twitter](https://x.com/manifesto__ai)

---

MIT © 2025 Manifesto AI
