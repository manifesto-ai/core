---
layout: home

hero:
  name: Manifesto
  text: Semantic State for AI-Governed Apps
  tagline: Deterministic computation. Full accountability. Every state change traceable.
  actions:
    - theme: brand
      text: Quickstart
      link: /quickstart
    - theme: alt
      text: Learn
      link: /learn/
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
  - icon: 🤖
    title: AI-Native
    details: Schema-first. LLMs can read, reason, and modify safely.
  - icon: ⚡
    title: Effect Isolation
    details: Pure computation separated from IO.
---

# Quick Example

```mel
domain Counter {
  state { count: number = 0 }
  action increment() {
    once(i) { patch i = $meta.intentId; patch count = add(count, 1) }
  }
}
```

```typescript
import { createApp } from "@manifesto-ai/app";
import CounterMel from "./counter.mel";

const app = createApp(CounterMel);
await app.ready();
await app.act("increment").done();
console.log(app.getState().data.count); // 1
```

## Learn

- [Quickstart](/quickstart) - 5 minutes to running code
- [Tutorials](/learn/) - Step-by-step learning path
- [Concepts](/concepts/) - Core concepts explained
- [Architecture](/architecture/) - System design overview
- [MEL Language](/mel/SYNTAX) - Domain definition syntax

## Packages

| Package | Description |
|---------|-------------|
| `@manifesto-ai/app` | High-level app facade (recommended starting point) |
| `@manifesto-ai/compiler` | MEL compiler |
| `@manifesto-ai/core` | Pure computation engine |
| `@manifesto-ai/host` | Effect execution runtime |
| `@manifesto-ai/world` | World Protocol governance |
| `@manifesto-ai/builder` | Type-safe DSL (advanced) |
| `@manifesto-ai/intent-ir` | Intent intermediate representation |

See [API Reference](/api/) for full documentation.

## Installation

```bash
npm install @manifesto-ai/app @manifesto-ai/compiler
```

## Community

- [GitHub](https://github.com/manifesto-ai/core)
- [Discord](https://discord.gg/manifesto-ai)
- [Twitter](https://x.com/manifesto__ai)

---

MIT © 2025 Manifesto AI
