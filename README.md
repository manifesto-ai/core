# Manifesto

> **Manifesto** is a semantic state layer for building AI-governed applications with deterministic computation and full accountability.

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/core.svg)](https://www.npmjs.com/package/@manifesto-ai/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Docs:** https://docs.manifesto-ai.dev

---

## What is Manifesto?

Manifesto solves the problem of building AI-native applications where every state change is traceable, reversible, and governed by explicit authority.

Traditional state management scatters business logic across components, making it impossible for AI agents to reason about or safely modify application state. Manifesto takes a fundamentally different approach: **Core computes. Host executes. World governs.**

```
Intent → Core (compute) → Patches + Effects → Host (execute) → New Snapshot
                                    ↓
                              World (govern)
                                    ↓
                        Proposal → Authority → Decision
```

---

## What This Is NOT

| Manifesto is NOT... | Instead, it is... |
|---------------------|-------------------|
| An AI agent framework | A semantic state layer that AI agents can read and modify |
| A workflow/orchestration engine | A deterministic computation system with declarative flows |
| A database or ORM | A pure computation layer (persistence is handled by Host) |
| A replacement for React/Redux | A complement that provides semantic state to any UI framework |

---

## Core Concepts

| Concept | One-Liner |
|---------|-----------|
| **Snapshot** | Complete state at a point in time. The single source of truth. |
| **Intent** | A request to perform a domain action. |
| **Patch** | An atomic mutation to Snapshot (the only way to change state). |
| **Effect** | A declaration of external operation for Host to execute. |
| **World** | An immutable committed Snapshot with governance metadata. |

> See https://docs.manifesto-ai.dev/architecture/ for the complete mental model.

---

## Quick Start

```bash
# Core packages
npm install @manifesto-ai/react @manifesto-ai/builder zod react

# For natural language translation (optional)
npm install @manifesto-ai/translator @manifesto-ai/memory
```

```typescript
import { z } from "zod";
import { defineDomain, expr, flow } from "@manifesto-ai/builder";
import { createManifestoApp } from "@manifesto-ai/react";

// 1. Define your domain
const TodoDomain = defineDomain(
  z.object({
    todos: z.array(z.object({
      id: z.string(),
      title: z.string(),
      completed: z.boolean(),
    })),
  }),
  ({ state, computed, actions }) => ({
    computed: {
      remaining: computed.define({
        deps: [state.todos],
        expr: expr.len(expr.filter(state.todos, (t) => expr.not(t.completed))),
      }),
    },
    actions: {
      add: actions.define({
        input: z.object({ id: z.string(), title: z.string() }),
        flow: flow.patch(state.todos).set(
          expr.append(
            state.todos,
            expr.object({
              id: expr.input("id"),
              title: expr.input("title"),
              completed: expr.lit(false),
            })
          )
        ),
      }),
    },
  })
);

// 2. Create React app
const App = createManifestoApp(TodoDomain, {
  initialState: { todos: [] },
});

// 3. Use in components
function TodoList() {
  const todos = App.useValue((s) => s.todos);
  const remaining = App.useComputed((c) => c.remaining);
  const { add } = App.useActions();

  return (
    <div>
      <p>{remaining} remaining</p>
      <button onClick={() => add({ id: crypto.randomUUID(), title: "New Todo" })}>Add</button>
    </div>
  );
}
```

MEL equivalent:

```mel
domain TodoDomain {
  type TodoItem = {
    id: string,
    title: string,
    completed: boolean
  }

  state {
    todos: Array<TodoItem> = []
  }

  computed remaining = len(filter(todos, not($item.completed)))

  action add(id: string, title: string) {
    when true {
      patch todos = append(todos, {
        id: id,
        title: title,
        completed: false
      })
    }
  }
}
```

> See https://docs.manifesto-ai.dev/guides/getting-started for the full tutorial.

---

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| [`@manifesto-ai/core`](packages/core) | Pure semantic calculator. Computes state transitions deterministically. | [README](packages/core/README.md) |
| [`@manifesto-ai/host`](packages/host) | Effect execution runtime. Executes effects and applies patches. | [README](packages/host/README.md) |
| [`@manifesto-ai/world`](packages/world) | Governance layer. Manages authority, proposals, and lineage. | [README](packages/world/README.md) |
| [`@manifesto-ai/bridge`](packages/bridge) | Two-way binding. Routes external events to intents and back. | [README](packages/bridge/README.md) |
| [`@manifesto-ai/builder`](packages/builder) | Type-safe DSL. Define domains with Zod and zero string paths. | [README](packages/builder/README.md) |
| [`@manifesto-ai/react`](packages/react) | React integration. Hooks and context for React applications. | [README](packages/react/README.md) |
| [`@manifesto-ai/compiler`](packages/compiler) | MEL compiler. Compiles MEL to DomainSchema with lowering/evaluation. | [README](packages/compiler/README.md) |
| [`@manifesto-ai/translator`](packages/translator) | Natural language to semantic changes. 6-stage pipeline with memory. | [README](packages/translator/README.md) |
| [`@manifesto-ai/memory`](packages/memory) | Memory retrieval, verification, and tracing. | [README](packages/memory/README.md) |
| [`@manifesto-ai/effect-utils`](packages/effect-utils) | Effect handler utilities and helpers. | [SPEC](packages/effect-utils/docs/SPEC.md) |
| [`@manifesto-ai/lab`](packages/lab) | LLM governance, tracing, and HITL tooling. | [README](packages/lab/README.md) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                           React / UI                             │
│  Uses hooks to read Snapshot and dispatch Intents               │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Bridge                                 │
│  Routes SourceEvents through Projections to Intents             │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           World                                  │
│  Governs proposals, evaluates authority, tracks lineage         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Host                                   │
│  Executes effects, applies patches, runs compute-effect loop    │
└───────────┬─────────────────┴───────────────────────────────────┘
            │                 │
            ▼                 ▼
┌───────────────────┐  ┌─────────────────────────────────────────┐
│    Translator     │  │                  Core                    │
│  NL → Semantic    │  │  Pure computation. No IO.               │
│  changes (6-stage)│  │  Same input → same output.              │
└─────────┬─────────┘  └─────────────────────────────────────────┘
          │
          ▼
┌───────────────────┐
│      Memory       │
│  Context retrieval│
│  & verification   │
└───────────────────┘
```

- **Builder** generates the DomainSchema consumed by Core (build-time only).
- **Translator** transforms natural language to semantic changes via Host.
- **Memory** provides context retrieval with verification for Translator.

> See https://docs.manifesto-ai.dev/architecture/ for detailed explanation.

---

## Examples

| Example | What it demonstrates |
|---------|---------------------|
| [example-todo](./apps/example-todo) | Todo example using MEL compiler, Host, and effect-utils |
| [shipment-app](./apps/shipment-app) | Global ocean logistics example using MEL compiler and Host |
| [taskflow](./apps/taskflow) | TaskFlow demo with intent-native UI and LLM-driven intents |
| [llm-babybench](./apps/llm-babybench) | BabyBench LLM benchmark suite for Manifesto systems |

---

## Documentation

Official docs: https://docs.manifesto-ai.dev

| Type | For whom | Link |
|------|----------|------|
| **Guides** | Users who want to learn | https://docs.manifesto-ai.dev/guides/getting-started |
| **Core Concepts** | Mental model builders | https://docs.manifesto-ai.dev/core-concepts/ |
| **Architecture** | System designers | https://docs.manifesto-ai.dev/architecture/ |
| **Specifications** | Implementers & reviewers | https://docs.manifesto-ai.dev/specifications/ |
| **Rationale (FDRs)** | Contributors & researchers | https://docs.manifesto-ai.dev/rationale/ |
| **MEL** | DSL authors | https://docs.manifesto-ai.dev/mel/ |

---

## Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md).

For significant changes, please open an issue first to discuss what you would like to change.

Security issues: see [SECURITY.md](./SECURITY.md).

---

## License

[MIT](./LICENSE) © 2025-2025 Manifesto AI

---

## Acknowledgments

- [Zod](https://github.com/colinhacks/zod) for runtime type validation
- [Effect](https://effect.website/) for inspiration on principled effect systems
- [Redux](https://redux.js.org/) for pioneering predictable state management
