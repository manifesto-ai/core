# Manifesto

**Semantic Layer for Deterministic Domain State**

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
import { createManifesto, createIntent } from "@manifesto-ai/sdk";
import DocumentMel from "./document.mel";

const manifesto = createManifesto({ schema: DocumentMel, effects: {} });

manifesto.subscribe(
  (snapshot) => snapshot.data.doc.status,
  (status) => console.log("Document status:", status),
);

manifesto.dispatch(
  createIntent("addSection", { text: "Introduction..." }, "intent-add-section-1"),
);
manifesto.dispatch(createIntent("publish", "intent-publish-1"));
```

**→ UI**

```typescript
const snapshot = manifesto.getSnapshot();
const canPublish = snapshot.computed["canPublish"];

// UI is a projection of Snapshot — no separate state management needed
<button
  disabled={!canPublish}
  onClick={() => manifesto.dispatch(createIntent("publish", "intent-publish-ui"))}
>
  Publish ({snapshot.computed["sectionCount"]} sections)
</button>
```

**→ Telemetry / Audit**

```typescript
manifesto.on("dispatch:completed", ({ intentId, snapshot }) => {
  auditLog.append({
    intentId,
    version: snapshot?.meta.version,
    status: snapshot?.data.doc.status,
  });
});
```

Three projections, one source of truth. Change the domain declaration — every projection updates.

---

## What is Manifesto?

Manifesto is a **semantic layer for deterministic domain state**. You declare what your domain means in [MEL](https://docs.manifesto-ai.dev/mel/); the semantic layer handles computation, effect declaration, and traceable state transitions.

The core equation:

```
compute(schema, snapshot, intent) → (snapshot', requirements, trace)
```

This function is **pure** (same inputs → same outputs), **total** (always returns), and **traceable** (every step recorded). All state transitions in Manifesto follow this equation.

What this means in practice:

- **Snapshot is the single source of truth.** Every surface — UI, API, agent, audit — reads from the same Snapshot.
- **Core computes, Host executes.** Pure semantic computation is separated from IO and effect execution.
- **Intents carry meaning.** State changes are requested through typed Intents, not ad-hoc mutations.

Governance, authority, and lineage are available as explicit integrations through `@manifesto-ai/world` when your deployment needs them.

---

## What Manifesto is NOT

- **Not a state management library.** Redux and Zustand manage UI state. Manifesto defines domain semantics — the meaning behind the state.
- **Not an AI framework.** LangChain and CrewAI orchestrate LLM calls. Manifesto provides the deterministic state layer that AI agents can operate on.
- **Not an event sourcing framework.** Events are a mechanism. Manifesto operates at the semantic level — Intents carry meaning, not just data.
- **Not a database or ORM.** Manifesto computes state transitions. Persistence is delegated to Host.
- **Not a workflow engine.** Workflows are imperative sequences. Manifesto domains are declarative — the runtime determines execution order.

Manifesto is the semantic layer that sits between your domain logic and whatever surface consumes it — React renders a Snapshot, Express serves a Snapshot, an AI agent reads a Snapshot and proposes actions against it.

---

## The Paradigm Shift

| Concern | Current approach | With Manifesto |
|---------|-----------------|----------------|
| **State definition** | Scattered across reducers, handlers, models | Single MEL domain declaration |
| **Validation** | Imperative checks in handlers | Declarative `when` guards + `available when` |
| **Audit trail** | Bolted-on logging after the fact | Telemetry is built in; governed lineage composes through `@manifesto-ai/world` |
| **AI integration** | Separate wrapper API per agent | Same Intent protocol and Snapshot model as any other caller |
| **Determinism** | Hope and testing | Guaranteed — `compute()` is pure |
| **Undo / branching** | Custom implementation | Immutable Snapshots are the base; lineage and branch tooling layer on through World |
| **Reproducibility** | Not feasible in most systems | Deterministic snapshots are reproducible; governed history comes from World integration |

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
| **Accountability** | Telemetry is built in; full Actor + Authority lineage comes from World integration |
| **Traceability** | Core produces traceable transitions; SDK emits per-intent lifecycle events |
| **Immutability** | Snapshots and Worlds never mutate after creation |
| **Re-entry safety** | `onceIntent` guards prevent duplicate effects across compute cycles |
| **Governance** | Available through `@manifesto-ai/world` when you need proposal and authority flow |
| **Schema-first** | All semantics are JSON-serializable data — machines can read, analyze, and generate domains |

---

## Architecture

```text
createManifesto() default path
SDK -> Compiler -> Host -> Core

Governed deployments
SDK + @manifesto-ai/world -> Host -> Core
```

| Layer | Package | Responsibility |
|-------|---------|----------------|
| **Core** | `@manifesto-ai/core` | Pure computation. Expressions, flows, patches. Zero IO. |
| **Host** | `@manifesto-ai/host` | Effect execution. Runs the compute-effect-apply loop. |
| **World** | `@manifesto-ai/world` | Governance, proposal flow, actors, authorities, audit lineage (DAG). |
| **SDK** | `@manifesto-ai/sdk` | Thin public layer. `createManifesto()`, dispatch, subscriptions, typed ops, protocol re-exports. |
| **Compiler** | `@manifesto-ai/compiler` | MEL → `DomainSchema` compilation and bundler adapters. |

**Default SDK flow today:**

```text
Caller submits Intent
  → SDK dispatch queue
    → Host (effect execution)
      → Core (pure computation)
        → terminal Snapshot
          → subscribe/on consumers
```

When you need proposal, authority, or lineage semantics, integrate `@manifesto-ai/world` explicitly on top of the same Snapshot/Intent model.

---

## Quick Start

```bash
npm install @manifesto-ai/sdk
```

```typescript
import {
  createManifesto,
  createIntent,
  type ManifestoInstance,
  type Intent,
  type Snapshot,
} from "@manifesto-ai/sdk";

function dispatchAsync(
  manifesto: ManifestoInstance,
  intent: Intent,
): Promise<Snapshot> {
  return new Promise((resolve, reject) => {
    const offCompleted = manifesto.on("dispatch:completed", (event) => {
      if (event.intentId !== intent.intentId) return;
      offCompleted();
      offFailed();
      resolve(event.snapshot!);
    });
    const offFailed = manifesto.on("dispatch:failed", (event) => {
      if (event.intentId !== intent.intentId) return;
      offCompleted();
      offFailed();
      reject(event.error ?? new Error("Dispatch failed"));
    });

    manifesto.dispatch(intent);
  });
}

const manifesto = createManifesto({
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

await dispatchAsync(manifesto, createIntent("increment", "intent-1"));
await dispatchAsync(manifesto, createIntent("increment", "intent-2"));

const snapshot = manifesto.getSnapshot();
console.log(snapshot.data.count);          // 2
console.log(snapshot.computed["doubled"]); // 4

manifesto.dispose();
```

> See [examples/](./examples/) for more: todos, effects, subscriptions.

---

## Built on Manifesto

Manifesto is designed for domains where determinism, traceability, and semantic clarity are not optional.

- **[ProofFlow](https://github.com/manifesto-ai/proofflow)** — Structural recording and pattern reuse for Lean 4 mathematical proof experiences. Every proof step is a governed state transition in the Manifesto lineage.

- **[Mind Protocol](https://github.com/manifesto-ai/mind-protocol)** — A protocol for continuous AI existence — memory, inner monologue, and personality grounded in deterministic Snapshots and traceable World lineage.

- **[TaskFlow](https://taskflow.manifesto-ai.dev)** — Collaborative task management demonstrating multi-actor governance: human and AI actors share the same domain through the Intent protocol.

---

## Packages

| Package | Description |
|---------|-------------|
| [@manifesto-ai/sdk](./packages/sdk) | Public developer API — `createManifesto()`, typed patch ops |
| [@manifesto-ai/core](./packages/core) | Pure computation engine |
| [@manifesto-ai/host](./packages/host) | Effect execution runtime |
| [@manifesto-ai/world](./packages/world) | Governance and lineage layer |
| [@manifesto-ai/compiler](./packages/compiler) | MEL → DomainSchema compiler and bundler adapters |
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
