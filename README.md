# Manifesto

A semantic state layer for building AI-governed applications with deterministic computation and full accountability.

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/core.svg)](https://www.npmjs.com/package/@manifesto-ai/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What is Manifesto?

Manifesto is a state management framework built on three principles:

1. **Determinism** — Same input always produces same output. No hidden state, no side effects in core logic.
2. **Accountability** — Every state change is traceable to an Actor + Authority + Intent. Full audit trail built-in.
3. **Separation of Concerns** — Core computes, Host executes, World governs. Clean boundaries, testable layers.

Define your domain logic declaratively in MEL, and Manifesto guarantees reproducible state transitions. Perfect for AI-native applications where agents need to safely reason about and modify state.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Your Application                   │
└──────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │    @manifesto-ai/app  │  ← High-level facade
              └───────────────────────┘
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│    core     │   │    host     │   │    world    │
│  (compute)  │   │  (execute)  │   │  (govern)   │
└─────────────┘   └─────────────┘   └─────────────┘
```

- **Core** — Pure computation engine. Evaluates expressions, interprets flows, generates patches.
- **Host** — Effect executor. Handles side effects (API calls, storage), applies patches to state.
- **World** — Governance layer. Manages authority, records decisions, maintains audit lineage.

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

> **Note:** MEL imports require a loader. See [Quickstart](https://docs.manifesto-ai.dev/quickstart) for Vite/webpack configuration.

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@manifesto-ai/app](./packages/app) | 0.6.0 | High-level facade for building applications |
| [@manifesto-ai/core](./packages/core) | 2.0.0 | Pure computation engine |
| [@manifesto-ai/host](./packages/host) | 2.0.1 | Effect execution runtime |
| [@manifesto-ai/world](./packages/world) | 2.0.1 | Governance layer |
| [@manifesto-ai/compiler](./packages/compiler) | 1.3.0 | MEL to DomainSchema compiler |
| [@manifesto-ai/builder](./packages/builder) | 1.3.0 | Type-safe domain definition DSL |
| [@manifesto-ai/intent-ir](./packages/intent-ir) | 0.2.0 | Intent intermediate representation |

## Key Features

- **Deterministic** — Same input always produces same output
- **Traceable** — Every state change has full lineage and audit trail
- **Declarative** — Define domains in MEL (Manifesto Expression Language)
- **AI-Ready** — Semantic state that AI agents can safely read and modify
- **Framework-agnostic** — Works with React, Vue, or any UI framework

## When to Use Manifesto

**Perfect fit:**
- AI agent governance requiring audit trails
- Applications needing deterministic state transitions
- Complex domain logic with formal verification requirements

**Good fit:**
- Multi-actor systems with authority requirements
- Applications needing time-travel debugging
- Event-sourced systems requiring reproducibility

**Not ideal for:**
- Simple UI state (use React state/Zustand instead)
- Rapid prototyping where structure overhead isn't justified

## Documentation

- **Full documentation:** https://docs.manifesto-ai.dev
- **Live demo:** https://taskflow.manifesto-ai.dev

### Quick Links

- [Quickstart](https://docs.manifesto-ai.dev/quickstart) — Get running in 5 minutes
- [Core Concepts](https://docs.manifesto-ai.dev/concepts/) — Understand Snapshot, Intent, Flow, Effect
- [MEL Language](https://docs.manifesto-ai.dev/mel/) — Domain definition syntax
- [API Reference](https://docs.manifesto-ai.dev/api/) — Package APIs

## Development

```bash
# Clone and install
git clone https://github.com/manifesto-ai/core.git
cd core
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Build documentation
pnpm docs:build
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

Key principles:
- Core must remain pure (no IO, no side effects)
- All state changes go through patches
- Tests verify determinism

## License

[MIT](./LICENSE) © 2025 Manifesto AI
