---
layout: home

hero:
  name: Manifesto
  text: Deterministic State Protocol
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
  - icon: 👥
    title: Actor-Agnostic
    details: Humans, AI agents, and automated processes share the same interface.
  - icon: ⚡
    title: Effect Isolation
    details: Pure computation separated from IO.
---

# Quick Example

```mel
domain Counter {
  state { count: number = 0 }
  action increment() {
    onceIntent { patch count = add(count, 1) }
  }
}
```

```typescript
import { createApp } from "@manifesto-ai/app";
import CounterMel from "./counter.mel";

const app = createApp({ schema: CounterMel, effects: {} });
await app.ready();
await app.act("increment").done();
console.log(app.getState().data.count); // 1
```

## Learn

- [Quickstart](/quickstart) - 5 minutes to running code
- [Tutorial](/tutorial/) - Step-by-step learning path
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
| `@manifesto-ai/codegen` | TypeScript / Zod code generation from DomainSchema |
| `@manifesto-ai/intent-ir` | Intent intermediate representation |

See [API Reference](/api/) for full documentation.

> Note: Runtime/SDK specs are currently draft decomposition documents derived from APP-SPEC.
> The recommended production entry point remains `@manifesto-ai/app`.

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
