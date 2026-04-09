---
layout: home

hero:
  name: Manifesto
  text: Semantic Layer for Deterministic Domain State
  tagline: Define your domain once in MEL, then run it, inspect it, and extend it from the same schema.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/quick-start
    - theme: alt
      text: Learn the Model
      link: /guide/introduction

features:
  - icon: 🎯
    title: Deterministic by Design
    details: Pure compute, explicit effects, and the same state transition for the same input.
  - icon: 🧩
    title: Frontend, Backend, and Agents
    details: Use the same domain model to power UI, backend services, and agent workflows without redefining semantics for each surface.
  - icon: 📸
    title: Snapshot-First State
    details: The next snapshot is the visible result. No hidden channels, no side-effect return path.
---

## Quick Example

### First, define your domain in MEL:
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

### Then, run it in your app:
```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterSchema from "./counter.mel";

const app = createManifesto(CounterSchema, {}).activate();
await app.dispatchAsync(app.createIntent(app.MEL.actions.increment));

console.log(app.getSnapshot().data.count);        // 1
console.log(app.getSnapshot().computed.doubled);  // 2
```

Start with [Quick Start](/guide/quick-start). Use the [Guide](/guide/introduction) to learn the runtime step by step, or jump to the [API Reference](/api/) if you already know the package you need.
