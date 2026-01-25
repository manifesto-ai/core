# Layer Model

> **Extracted from:** docs-original/ARCHITECTURE.md
> **Purpose:** Understanding Manifesto's layered architecture

---

## Overview

Manifesto is structured as a **layered computation architecture** where each layer has a single responsibility. This layering enforces separation of concerns and prevents category errors in system design.

---

## The Six Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                           React / UI                             │
│  Responsibility: Present state to users, capture interactions   │
│  Owns: Component rendering, local UI state                       │
│  Never: Directly mutate domain state, execute business logic    │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Hooks (useValue, useActions)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Bridge                                 │
│  Responsibility: Two-way binding, event routing                 │
│  Owns: Subscriptions, projections, SnapshotView                 │
│  Never: Execute effects, make authority decisions               │
└─────────────────────────────┬───────────────────────────────────┘
                              │ dispatchEvent / dispatch
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           World                                  │
│  Responsibility: Governance, authority, lineage                 │
│  Owns: Proposals, decisions, actor registry, world DAG          │
│  Never: Execute effects, compute state transitions              │
└─────────────────────────────┬───────────────────────────────────┘
                              │ submitProposal (via Host)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Host                                   │
│  Responsibility: Effect execution, patch application            │
│  Owns: Effect handlers, snapshot persistence, compute loop      │
│  Never: Define business logic, make authority decisions         │
└─────────────────────────────┬───────────────────────────────────┘
                              │ compute / apply
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Core                                   │
│  Responsibility: Pure semantic computation                      │
│  Owns: Expression evaluation, flow execution, patch generation  │
│  Never: Execute IO, persist data, access network                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities Matrix

| Layer | Does | Does NOT |
|-------|------|----------|
| **React** | Render UI, capture events, manage local state | Execute effects, define domain logic |
| **Bridge** | Route events, manage subscriptions, transform SourceEvents | Execute effects, make decisions |
| **World** | Manage actors, evaluate authority, track lineage | Execute effects, compute state |
| **Host** | Execute effects, apply patches, run compute loop | Define domain logic, make decisions |
| **Core** | Compute transitions, evaluate expressions, generate patches | Execute IO, persist data |
| **Builder** | Define domains, provide type safety, generate schemas | Execute anything |

---

## Guiding Principles

| Principle | Why It Matters |
|-----------|----------------|
| **Core computes, Host executes** | Separating computation from execution enables deterministic testing, time-travel debugging, and crash recovery |
| **Snapshot is the sole medium** | All communication happens through Snapshot—no hidden state, no suspended context |
| **Effects as declarations** | Effects are data describing IO, not executed code—enables auditing and replay |
| **Immutable Worlds** | Every committed state is a World with governance metadata—enables accountability and lineage |

---

## Boundaries & Contracts

### Boundary: Core ↔ Host

| Direction | Allowed | Forbidden |
|-----------|---------|-----------|
| Host → Core | DomainSchema, Snapshot, Intent | Side effects, async operations |
| Core → Host | ComputeResult (patches, requirements) | Direct IO, network calls |

**Contract:**
- Core MUST be pure (same input → same output)
- Host MUST execute all requirements before re-computing
- Host MUST NOT modify requirements before execution

### Boundary: World ↔ Host

| Direction | Allowed | Forbidden |
|-----------|---------|-----------|
| World → Host | Approved intents | Rejected proposals |
| Host → World | Execution results, new snapshot | Authority decisions |

**Contract:**
- World MUST evaluate authority before delegating to Host
- Host MUST report execution results back to World
- World MUST create DecisionRecord for all authority decisions

### Boundary: Bridge ↔ World

| Direction | Allowed | Forbidden |
|-----------|---------|-----------|
| Bridge → World | IntentBodies, SourceEvents | Direct effect execution |
| World → Bridge | ProposalResults, SnapshotViews | Internal governance state |

**Contract:**
- Bridge MUST route all intents through World
- Bridge MUST NOT bypass governance
- World MUST notify Bridge of snapshot changes

---

## Why Not [Alternative Approach]?

| Alternative | Why Not |
|-------------|---------|
| **Event Sourcing** | We store intents + worlds, not events. Worlds are the source of truth, not event logs. |
| **Redux/Flux** | Too coupled to UI. Our architecture separates UI binding (Bridge) from state management (Core+Host+World). |
| **Actor Model** | Actors have hidden state. Our Snapshot is fully visible and serializable. |
| **Traditional ORM** | ORMs hide persistence. Our Host explicitly handles IO through effect handlers. |

---

## Related Documents

- [Architecture Overview](/architecture/) - Complete architecture overview
- [Data Flow](/architecture/data-flow) - How data moves through layers
- [Schema Specification](/internals/spec/core-spec) - Core layer specification
- [Host Contract](/internals/spec/host-spec) - Host layer specification
- [World Protocol](/internals/spec/world-spec) - World layer specification
