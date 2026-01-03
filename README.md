# Manifesto

> **Manifesto** is a semantic state layer for building AI-governed applications with deterministic computation and full accountability.

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/core.svg)](https://www.npmjs.com/package/@manifesto-ai/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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

> See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the complete mental model.

---

## Quick Start

```bash
npm install @manifesto-ai/react @manifesto-ai/builder
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

> See [Getting Started Guide](packages/core/docs/GUIDE.md) for the full tutorial.

---

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| [`@manifesto-ai/core`](packages/core) | Pure semantic calculator. Computes state transitions deterministically. | [README](packages/core/docs/README.md) |
| [`@manifesto-ai/host`](packages/host) | Effect execution runtime. Executes effects and applies patches. | [README](packages/host/docs/README.md) |
| [`@manifesto-ai/world`](packages/world) | Governance layer. Manages authority, proposals, and lineage. | [README](packages/world/docs/README.md) |
| [`@manifesto-ai/bridge`](packages/bridge) | Two-way binding. Routes external events to intents and back. | [README](packages/bridge/docs/README.md) |
| [`@manifesto-ai/builder`](packages/builder) | Type-safe DSL. Define domains with Zod and zero string paths. | [README](packages/builder/docs/README.md) |
| [`@manifesto-ai/react`](packages/react) | React integration. Hooks and context for React applications. | [README](packages/react/docs/README.md) |
| [`@manifesto-ai/compiler`](packages/compiler) | NL compiler. Compiles natural language to DomainSchema. | [README](packages/compiler/docs/README.md) |

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
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Core                                   │
│  Pure computation. No IO. Same input → same output.             │
└─────────────────────────────────────────────────────────────────┘
```

> See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed explanation.

---

## Examples

| Example | What it demonstrates |
|---------|---------------------|
| [example-todo](./apps/example-todo) | Basic CRUD with React integration |

---

## Documentation

| Type | For whom | Link |
|------|----------|------|
| **Guides** | Users who want to learn | [Getting Started](packages/core/docs/GUIDE.md) |
| **Specs** | Implementers & reviewers | [Core Spec](packages/core/docs/SPEC.md) |
| **Rationale** | Contributors & researchers | [Design Decisions](packages/core/docs/FDR.md) |
| **Architecture** | System designers | [Architecture](docs/ARCHITECTURE.md) |
| **FAQ** | Everyone | [Frequently Asked Questions](docs/FAQ.md) |

---

## Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md).

For significant changes, please open an issue first to discuss what you would like to change.

> See [GOVERNANCE.md](docs/GOVERNANCE.md) for our decision-making process.

---

## License

[MIT](./LICENSE) © 2025-2025 Manifesto AI

---

## Acknowledgments

- [Zod](https://github.com/colinhacks/zod) for runtime type validation
- [Effect](https://effect.website/) for inspiration on principled effect systems
- [Redux](https://redux.js.org/) for pioneering predictable state management
