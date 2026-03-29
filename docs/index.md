---
layout: home

hero:
  name: Manifesto
  text: Semantic Layer for Deterministic Domain State
  tagline: Define meaning once - use the SDK for the shortest path or the World facade for governed composition.
  actions:
    - theme: brand
      text: Quickstart
      link: /quickstart
    - theme: alt
      text: Governed Composition
      link: /guides/governed-composition
    - theme: alt
      text: GitHub
      link: https://github.com/manifesto-ai/core

features:
  - icon: 🎯
    title: Deterministic
    details: Same input -> same output. Always.
  - icon: 🔍
    title: Accountable
    details: Every change is traceable to Actor, Authority, and Intent.
  - icon: 📐
    title: Schema-First
    details: All domain semantics are JSON-serializable data.
  - icon: ⚡
    title: Effect Isolation
    details: Pure computation stays separate from IO.
---

## Choose Your Runtime

Manifesto has two supported entry paths:

| Path | Package | When to use |
|------|---------|-------------|
| **Direct-dispatch** | `@manifesto-ai/sdk` | You want the shortest path to a working app |
| **Governed composition** | `@manifesto-ai/world` | You need lineage, authority, and explicit sealing |

The SDK is the fastest way to start. The World facade is the canonical governed surface.

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
import { createIntent, createManifesto, dispatchAsync } from "@manifesto-ai/sdk";
import CounterSchema from "./counter.mel";

const app = createManifesto({ schema: CounterSchema, effects: {} });
await dispatchAsync(app, createIntent("increment", "intent-1"));
console.log(app.getSnapshot().data.count); // 1
```

## Start Here

| Step | Link | Time |
|------|------|------|
| **Install and run** | [Quickstart](/quickstart) | 5 min |
| **Learn the model** | [Concepts](/concepts/) | 15 min |
| **Use governed composition** | [Governed Composition](/guides/governed-composition) | 15 min |
| **Read the API** | [API Reference](/api/) | Browse |

## Installation

```bash
npm install @manifesto-ai/sdk @manifesto-ai/compiler
```

Use `@manifesto-ai/sdk` for direct-dispatch apps. Use `@manifesto-ai/world` when you want governed composition as a first-class runtime surface.

## Go Deeper

- [Architecture](/architecture/) - system design and boundaries
- [Guides](/guides/) - practical workflows
- [API Reference](/api/) - package-level API docs
- [Internals](/internals/) - ADRs, SPECs, FDRs
