# Architecture

> **Status:** Stable
> **Last Updated:** 2025-12

---

## Overview

Manifesto is structured as a **layered computation architecture** where each layer has a single responsibility. This document explains the conceptual model, layer responsibilities, and data flow that govern the entire system.

---

## Guiding Principles

| Principle | Why It Matters |
|-----------|----------------|
| **Core computes, Host executes** | Separating computation from execution enables deterministic testing, time-travel debugging, and crash recovery |
| **Snapshot is the sole medium** | All communication happens through Snapshot—no hidden state, no suspended context |
| **Effects as declarations** | Effects are data describing IO, not executed code—enables auditing and replay |
| **Immutable Worlds** | Every committed state is a World with governance metadata—enables accountability and lineage |

---

## Layer Model

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

### Layer Responsibilities Matrix

| Layer | Does | Does NOT |
|-------|------|----------|
| **React** | Render UI, capture events, manage local state | Execute effects, define domain logic |
| **Bridge** | Route events, manage subscriptions, transform SourceEvents | Execute effects, make decisions |
| **World** | Manage actors, evaluate authority, track lineage | Execute effects, compute state |
| **Host** | Execute effects, apply patches, run compute loop | Define domain logic, make decisions |
| **Core** | Compute transitions, evaluate expressions, generate patches | Execute IO, persist data |
| **Builder** | Define domains, provide type safety, generate schemas | Execute anything |

---

## Data Flow

### Primary Flow: Intent Execution

```
User ─────────┐
              │ 1. Click button
              ▼
         ┌─────────┐
         │ React   │ 2. Dispatch action
         └────┬────┘
              │
              ▼
         ┌─────────┐
         │ Bridge  │ 3. Route through projection
         └────┬────┘
              │
              ▼
         ┌─────────┐
         │ World   │ 4. Evaluate authority
         └────┬────┘
              │
              ▼
         ┌─────────┐
         │  Host   │ 5. Run compute loop
         └────┬────┘
              │
              ▼
         ┌─────────┐
         │  Core   │ 6. Compute patches/effects
         └────┬────┘
              │
         New Snapshot
```

**Step-by-step:**

1. **User Action**: User clicks a button in the UI
2. **React Dispatch**: Component calls `action({ input })` from useActions()
3. **Bridge Routing**: Bridge wraps as IntentBody and submits to World
4. **Authority Evaluation**: World checks if actor is authorized
5. **Host Execution**: Host runs compute-effect loop until completion
6. **Core Computation**: Core produces patches and effect declarations
7. **Snapshot Update**: New snapshot propagates back to Bridge subscribers

### Secondary Flow: Effect Handling

```
Core declares effect
        │
        ▼
┌───────────────┐
│  Requirement  │ (stored in snapshot.system.pendingRequirements)
└───────┬───────┘
        │
        ▼
┌───────────────┐
│    Host       │ Reads requirement, calls handler
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Effect Handler│ Executes IO (API call, etc.)
└───────┬───────┘
        │
        ▼
   EffectResult
  (patches to apply)
        │
        ▼
┌───────────────┐
│    Core       │ Apply patches, recompute
└───────────────┘
```

---

## Component Interactions

```
┌──────────┐     knows     ┌──────────┐
│  Bridge  │──────────────▶│  World   │
└──────────┘               └──────────┘
     │                          │
     │ subscribes               │ uses
     ▼                          ▼
┌──────────┐               ┌──────────┐
│   React  │               │   Host   │
└──────────┘               └──────────┘
                                │
                                │ calls
                                ▼
                           ┌──────────┐
                           │   Core   │
                           └──────────┘
                                ▲
                                │ produces
                           ┌──────────┐
                           │ Builder  │
                           └──────────┘
```

| Component | Knows About | Created By | Consumed By |
|-----------|-------------|------------|-------------|
| DomainSchema | Core types | Builder | Core, Host |
| Snapshot | - | Core | Everyone |
| World | Proposal, Decision | World | Bridge |
| Bridge | SnapshotView | Application | React |
| Requirement | Effect params | Core | Host |

---

## Key Abstractions

### Snapshot

**What it represents:** Complete state of the system at a point in time.

**Why it exists:** Single source of truth eliminates hidden state and enables deterministic computation.

**Structure:**
```typescript
type Snapshot = {
  data: Record<string, any>;      // Domain state
  computed: Record<string, any>;  // Derived values
  system: {                       // Runtime state
    status: "idle" | "running" | "completed" | "failed";
    pendingRequirements: Requirement[];
    errors: Error[];
  };
  input: Record<string, any>;     // Transient input
  meta: {                         // Metadata
    version: number;
    timestamp: string;
    hash: string;
  };
};
```

**Invariants:**
- Snapshots are immutable after creation
- All state changes happen via Patches
- Computed values are recalculated, never stored

### Intent

**What it represents:** A request to perform a domain action.

**Why it exists:** Intents are the only way to request state changes, enabling auditing and governance.

**Invariants:**
- Intents have unique IDs
- Intents specify action type and input
- Intents never directly mutate state

### World

**What it represents:** An immutable record of committed state with governance metadata.

**Why it exists:** Worlds provide accountability (who, what, when, why) and enable lineage tracking.

**Invariants:**
- Worlds are immutable after creation
- WorldId is deterministic: hash(schemaHash:snapshotHash)
- Worlds form a DAG (no cycles)

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
| **Event Sourcing** | We store intents + worlds, not events. Worlds are the source of truth, not event logs. → See [Core FDR](../packages/core/docs/FDR.md) |
| **Redux/Flux** | Too coupled to UI. Our architecture separates UI binding (Bridge) from state management (Core+Host+World). |
| **Actor Model** | Actors have hidden state. Our Snapshot is fully visible and serializable. |
| **Traditional ORM** | ORMs hide persistence. Our Host explicitly handles IO through effect handlers. |

---

## Extension Points

| Extension Point | What Can Be Extended | Current Status |
|-----------------|---------------------|----------------|
| Effect Handlers | Custom IO operations | Stable |
| Authority Handlers | Custom approval logic | Stable |
| Projections | Custom event routing | Stable |
| LLM Adapters | Custom LLM providers | Stable |
| Snapshot Stores | Custom persistence | Stable |
| World Stores | Custom world persistence | Stable |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [GLOSSARY.md](./GLOSSARY.md) | Term definitions |
| [Core SPEC](../packages/core/docs/SPEC.md) | Core layer specification |
| [Host SPEC](../packages/host/docs/SPEC.md) | Host layer specification |
| [World SPEC](../packages/world/docs/SPEC.md) | World layer specification |
| [Core FDR](../packages/core/docs/FDR.md) | Core design rationale |

---

*End of Architecture Document*
