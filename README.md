# Manifesto

**Semantic Protocol for Deterministic State**

Define your domain's meaning once — derive UI, backend, AI, and full history as projections.

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/core.svg)](https://www.npmjs.com/package/@manifesto-ai/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Define Once, Project Everywhere

Write one domain declaration in MEL. Every surface — UI, backend, AI agent, audit log — reads the same Snapshot.

**Step 1: Define your domain (once)**

```mel
domain Document {
  type Doc = {
    title: string,
    content: string,
    status: "draft" | "review" | "published"
  }

  state {
    doc: Doc = { title: "", content: "", status: "draft" }
    sections: Array<string> = []
  }

  computed sectionCount = len(sections)
  computed canPublish = and(eq(doc.status, "review"), gt(sectionCount, 0))

  action addSection(text: string) {
    onceIntent when neq(doc.status, "published") {
      patch sections = append(sections, text)
    }
  }

  action publish() available when canPublish {
    onceIntent {
      patch doc.status = "published"
    }
  }
}
```

**Step 2: Every projection reads the same source**

**→ App / Backend**

```typescript
import { createApp } from "@manifesto-ai/app";

const app = createApp({ schema: documentMEL, effects: {} });
await app.ready();

await app.act("addSection", { text: "Introduction..." }).done();
await app.act("publish").done();

console.log(app.getState().data.doc.status); // "published"
```

**→ UI**

```typescript
// conceptual — @manifesto-ai/react in development
const state = app.getState();
const canPublish = state.computed["computed.canPublish"];

// UI is a projection of Snapshot — no separate state management needed
<button disabled={!canPublish} onClick={() => app.act("publish")}>
  Publish ({state.computed["computed.sectionCount"]} sections)
</button>
```

**→ History / Audit**

```typescript
// Every act() produces an immutable World — who, when, what, why
const result = await app.act("publish").done();
console.log(result.worldId); // content-addressable, immutable

const branch = app.currentBranch();
const history = branch.lineage(); // full DAG of state transitions
```

Three projections, one source of truth. Change the domain declaration — every projection updates.

---

## What is Manifesto?

Manifesto is a **semantic protocol** that separates *meaning* from *mechanism*. You declare what your domain means in [MEL](https://docs.manifesto-ai.dev/mel/); the protocol handles computation, execution, governance, and history.

The core equation:

```
compute(schema, snapshot, intent) → (snapshot', requirements, trace)
```

This function is **pure** (same inputs → same outputs), **total** (always returns), and **traceable** (every step recorded). All state transitions in Manifesto follow this equation.

Humans, AI agents, and automated systems all participate through the same interface: `app.act()`. Every state change records who proposed it, who authorized it, and why. The protocol does not distinguish between actor types — governance rules apply equally.

Manifesto is not a library you add to your stack. It is the **semantic layer** between your domain logic and whatever surface consumes it — React renders a Snapshot, Express serves a Snapshot, an AI agent reads a Snapshot and proposes actions against it.

---

## What Manifesto is NOT

- **Not a state management library.** Redux and Zustand manage UI state. Manifesto defines domain semantics — the meaning behind the state.
- **Not an AI framework.** LangChain and CrewAI orchestrate LLM calls. Manifesto governs the state that AI agents modify.
- **Not an event sourcing framework.** Events are a mechanism. Manifesto operates at the semantic level — Intents carry meaning, not just data.
- **Not a database or ORM.** Manifesto computes state transitions. Persistence is delegated to Host.
- **Not a workflow engine.** Workflows are imperative sequences. Manifesto domains are declarative — the runtime determines execution order.

Manifesto is the semantic layer that all of these can work *on top of*.

---

## The Paradigm Shift

| Concern | Current approach | With Manifesto |
|---------|-----------------|----------------|
| **State definition** | Scattered across reducers, handlers, models | Single MEL domain declaration |
| **Validation** | Imperative checks in handlers | Declarative `when` guards + `available when` |
| **Audit trail** | Bolted-on logging after the fact | Built-in — every World records actor, intent, and trace |
| **AI integration** | Separate wrapper API per agent | Same `app.act()` interface as human users |
| **Determinism** | Hope and testing | Guaranteed — `compute()` is pure |
| **Undo / branching** | Custom implementation | Built-in — `app.fork()`, `app.switchBranch()` |
| **Reproducibility** | Not feasible in most systems | Any past state reconstructible from lineage |

**Current software development:**

```
Domain Logic  →  UI code          ← its own representation
              →  API code         ← its own representation
              →  AI integration   ← its own representation
              →  Audit logging    ← its own representation

N representations = N inconsistency opportunities
```

**With Manifesto:**

```
MEL Domain Declaration (define once)
          ↓
      ┌────────┐
      │Snapshot │ ← single source of truth
      └────┬───┘
     ┌─────┼─────┬─────┬─────┐
     UI   API    AI  History  Test

1 source = automatic consistency across all projections
```

---

## Core Guarantees

These are not features. They are **protocol-level invariants** — properties that hold by construction, not by convention.

| Guarantee | Mechanism |
|-----------|-----------|
| **Determinism** | `compute()` is pure — same schema + snapshot + intent always yields the same result |
| **Accountability** | Every state change records Actor + Authority + Intent |
| **Traceability** | Complete trace for every transition — every value answers "why?" |
| **Immutability** | Snapshots and Worlds never mutate after creation |
| **Re-entry safety** | `onceIntent` guards prevent duplicate effects across compute cycles |
| **Governance** | World Protocol evaluates every intent through Authority before execution |
| **Schema-first** | All semantics are JSON-serializable data — machines can read, analyze, and generate domains |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  App    — assembles, integrates, absorbs         │
├─────────────────────────────────────────────────┤
│  World  — governs legitimacy and lineage         │
├─────────────────────────────────────────────────┤
│  Host   — executes effects in reality            │
├─────────────────────────────────────────────────┤
│  Core   — computes meaning (pure, deterministic) │
└─────────────────────────────────────────────────┘
```

| Layer | Package | Responsibility |
|-------|---------|----------------|
| **Core** | `@manifesto-ai/core` | Pure computation. Expressions, flows, patches. Zero IO. |
| **Host** | `@manifesto-ai/host` | Effect execution. Runs the compute-effect-apply loop. |
| **World** | `@manifesto-ai/world` | Governance. Actors, authorities, proposals, audit lineage (DAG). |
| **App** | `@manifesto-ai/app` | Facade. `createApp()`, `app.act()`, subscriptions, branches. |
| **Compiler** | `@manifesto-ai/compiler` | MEL → DomainSchema compilation. |

**Data flow:**

```
Actor submits Intent
  → World Protocol (governance)
    → Host (effect execution)
      → Core (pure computation)
        → new Snapshot (via patches)
          → new World (immutable)
            → Projections (UI, API, AI, History)
```

All information flows through Snapshot. There are no other channels.

---

## Quick Start

```bash
npm install @manifesto-ai/app
```

```typescript
import { createApp } from "@manifesto-ai/app";

const app = createApp({
  schema: `
    domain Counter {
      state { count: number = 0 }
      computed doubled = mul(count, 2)

      action increment() {
        onceIntent { patch count = add(count, 1) }
      }

      action decrement() available when gt(count, 0) {
        onceIntent { patch count = sub(count, 1) }
      }
    }
  `,
  effects: {},
});

await app.ready();

await app.act("increment").done();
await app.act("increment").done();
console.log(app.getState().data.count);                  // 2
console.log(app.getState().computed["computed.doubled"]); // 4

await app.dispose();
```

> See [examples/](./packages/app/examples/) for more: todos, effects, subscriptions.

---

## Built on Manifesto

Manifesto is designed for domains where traceability, governance, and determinism are not optional.

- **[ProofFlow](https://github.com/manifesto-ai/proofflow)** — Structural recording and pattern reuse for Lean 4 mathematical proof experiences. Every proof step is a governed state transition in the Manifesto lineage.

- **[Mind Protocol](https://github.com/manifesto-ai/mind-protocol)** — A protocol for continuous AI existence — memory, inner monologue, and personality grounded in deterministic Snapshots and traceable World lineage.

- **[TaskFlow](https://taskflow.manifesto-ai.dev)** — Collaborative task management demonstrating multi-actor governance: human and AI actors share the same domain through `app.act()`.

---

## Packages

| Package | Description |
|---------|-------------|
| [@manifesto-ai/app](./packages/app) | High-level application facade |
| [@manifesto-ai/core](./packages/core) | Pure computation engine |
| [@manifesto-ai/host](./packages/host) | Effect execution runtime |
| [@manifesto-ai/world](./packages/world) | Governance and lineage layer |
| [@manifesto-ai/compiler](./packages/compiler) | MEL → DomainSchema compiler |
| [@manifesto-ai/codegen](./packages/codegen) | TypeScript / Zod code generation from DomainSchema |
| [@manifesto-ai/intent-ir](./packages/intent-ir) | Intent intermediate representation |

---

## Documentation

- [Quickstart](https://docs.manifesto-ai.dev/quickstart) — Get running in 5 minutes
- [Tutorial](https://docs.manifesto-ai.dev/tutorial/) — Step-by-step learning path
- [Core Concepts](https://docs.manifesto-ai.dev/concepts/) — Snapshot, Intent, Flow, Effect, World
- [MEL Language](https://docs.manifesto-ai.dev/mel/) — Domain definition syntax
- [Architecture](https://docs.manifesto-ai.dev/architecture/) — Layers, data flow, determinism
- [API Reference](https://docs.manifesto-ai.dev/api/) — Package documentation
- [Guides](https://docs.manifesto-ai.dev/guides/) — Effect handlers, re-entry safety, debugging
- [Live Demo](https://taskflow.manifesto-ai.dev) — TaskFlow example

---

## Development

```bash
git clone https://github.com/manifesto-ai/core.git
cd core && pnpm install
pnpm build   # Build all packages
pnpm test    # Run tests
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE) © 2025-2026 Manifesto AI
