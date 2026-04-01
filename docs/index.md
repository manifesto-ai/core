---
layout: home

hero:
  name: Manifesto
  text: Semantic Layer for Deterministic Domain State
  tagline: Define meaning once - use the SDK for the shortest path, then add Lineage and Governance only when you need governed history.
  actions:
    - theme: brand
      text: Quickstart
      link: /quickstart
    - theme: alt
      text: Governed Composition
      link: /tutorial/05-governed-composition
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

Manifesto has one base runtime and one governed composition direction:

| Path | Package | When to use |
|------|---------|-------------|
| **Base runtime** | `@manifesto-ai/sdk` | You want the shortest path to a working app |
| **Governed composition** | `@manifesto-ai/lineage` + `@manifesto-ai/governance` | You need lineage, authority, and explicit sealing |

The SDK is the fastest way to start. Governed composition now means decorating the same manifesto before activation.

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
import CounterSchema from "./counter.mel";

const app = createManifesto(CounterSchema, {}).activate();
await app.dispatchAsync(app.createIntent(app.MEL.actions.increment));
console.log(app.getSnapshot().data.count); // 1
```

## Start Here

| Step | Link | Time |
|------|------|------|
| **Install and run** | [Quickstart](/quickstart) | 5 min |
| **Learn the model** | [Concepts](/concepts/) | 15 min |
| **Add governed composition** | [Governed Composition](/tutorial/05-governed-composition) | 15 min |
| **Read the API** | [API Reference](/api/) | Browse |

## Installation

```bash
npm install @manifesto-ai/sdk @manifesto-ai/compiler
```

Add `@manifesto-ai/lineage` and `@manifesto-ai/governance` only if the app needs continuity and legitimacy on top of the same base runtime.

## Go Deeper

- [Architecture](/architecture/) - system design and boundaries
- [Guides](/guides/) - practical workflows
- [API Reference](/api/) - package-level API docs
- [Internals](/internals/) - ADRs, SPECs, FDRs
