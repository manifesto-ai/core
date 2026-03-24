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
import { createManifesto, createIntent } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

const manifesto = createManifesto({ schema: CounterMel, effects: {} });

manifesto.on("dispatch:completed", ({ snapshot }) => {
  console.log(snapshot?.data.count); // 1
});

manifesto.dispatch(createIntent("increment", "intent-1"));
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
| `@manifesto-ai/sdk` | Thin public composition layer (recommended starting point) |
| `@manifesto-ai/compiler` | MEL compiler |
| `@manifesto-ai/core` | Pure computation engine |
| `@manifesto-ai/host` | Effect execution runtime |
| `@manifesto-ai/world` | World Protocol governance |
| `@manifesto-ai/codegen` | TypeScript / Zod code generation from DomainSchema |

See [API Reference](/api/) for full documentation.

> Note: `@manifesto-ai/runtime` is retired per ADR-010. The recommended production entry point remains `@manifesto-ai/sdk`.

## Installation

```bash
npm install @manifesto-ai/sdk @manifesto-ai/compiler
```

## Community

- [GitHub](https://github.com/manifesto-ai/core)
- [Discord](https://discord.gg/manifesto-ai)
- [Twitter](https://x.com/manifesto__ai)

---

MIT © 2025 Manifesto AI
