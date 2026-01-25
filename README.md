# Manifesto

A semantic state layer for building AI-governed applications with deterministic computation and full accountability.

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/core.svg)](https://www.npmjs.com/package/@manifesto-ai/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What is Manifesto?

Manifesto is a state management system where every change is traceable, reversible, and governed by explicit authority. Define your domain logic declaratively, and Manifesto guarantees deterministic computation—same input always produces same output. Perfect for AI-native applications where agents need to safely reason about and modify state.

## Quick Start

```bash
npm install @manifesto-ai/app @manifesto-ai/compiler
```

```mel
// counter.mel
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

## Documentation

Full documentation: https://docs.manifesto-ai.dev

Live demo: https://taskflow.manifesto-ai.dev

## Key Features

- **Deterministic** — Same input always produces same output
- **Traceable** — Every state change has full lineage and audit trail
- **Declarative** — Define domains in MEL (Manifesto Expression Language)
- **AI-Ready** — Semantic state that AI agents can safely read and modify
- **Framework-agnostic** — Works with React, Vue, or any UI framework

## License

[MIT](./LICENSE) © 2025 Manifesto AI
