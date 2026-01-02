# Architecture

> **Purpose:** Structural understanding of Manifesto's design
> **Audience:** System designers, architects, implementers
> **Reading time:** 5 minutes (overview) + 1.5 hours (all pages)

---

## What is Covered Here?

The Architecture section explains **how Manifesto is structured** and **why it's structured that way**.

After reading this section, you'll understand:
- The six-layer architecture
- How data flows through the system
- Why determinism is guaranteed
- How failures are handled
- How governance works

This is not API documentation. This is structural understanding.

---

## The Core Architectural Principles

### Principle 1: Separation of Concerns

**Core computes. Host executes. World governs.**

```
┌─────────────────────────────────────────────┐
│ Core: What should happen                    │
│   - Pure computation                        │
│   - No IO, no side effects                  │
│   - Same input → same output                │
└─────────────────────────────────────────────┘
                    ↓
         Declares requirements
                    ↓
┌─────────────────────────────────────────────┐
│ Host: How to make it happen                 │
│   - Executes effects                        │
│   - Applies patches                         │
│   - Reports results                         │
└─────────────────────────────────────────────┘
                    ↓
         Notifies World
                    ↓
┌─────────────────────────────────────────────┐
│ World: Who can do what                      │
│   - Evaluates authority                     │
│   - Records decisions                       │
│   - Maintains lineage                       │
└─────────────────────────────────────────────┘
```

**Why this matters:** Each concern can be tested, replaced, and reasoned about independently.

### Principle 2: Snapshot as Sole Medium

**All communication happens through Snapshot. There is no other channel.**

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Core    │────────▶│ Snapshot │◀────────│   Host   │
└──────────┘         └──────────┘         └──────────┘
     ▲                     │                     │
     │                     ▼                     │
     │               ┌──────────┐                │
     └───────────────│  World   │◀───────────────┘
                     └──────────┘
```

**Why this matters:** No hidden state, no suspended context, complete visibility.

### Principle 3: Immutability

**Snapshots and Worlds are immutable after creation.**

```typescript
// FORBIDDEN
snapshot.data.count = 5;
snapshot.meta.version++;

// REQUIRED
const newSnapshot = core.apply(schema, snapshot, [
  { op: 'set', path: 'data.count', value: 5 }
]);
```

**Why this matters:** Time-travel debugging, safe concurrency, reproducible computation.

---

## Pages in This Section

### [Layers](./layers)

The six-layer architecture and their responsibilities.

**What you'll learn:**
- React/UI layer
- Bridge layer
- World layer
- Host layer
- Core layer
- Builder layer
- Boundaries and contracts between layers

**When to read:** Start here to understand the big picture.

**Reading time:** 15 minutes

---

### [Data Flow](./data-flow)

How data moves through Manifesto's layers.

**What you'll learn:**
- Primary flow: Intent execution
- Secondary flow: Effect handling
- The Snapshot principle
- Computation cycle
- Component interactions

**When to read:** After Layers. Understand how layers work together.

**Reading time:** 20 minutes

---

### [Determinism](./determinism)

How Manifesto guarantees deterministic computation.

**What you'll learn:**
- What determinism means
- Why it matters
- How Core achieves it
- What breaks determinism
- Testing for determinism

**When to read:** After Data Flow. Understand the core guarantee.

**Reading time:** 25 minutes

---

### [Failure Model](./failure-model)

How Manifesto handles errors and failures.

**What you'll learn:**
- Errors as values (not exceptions)
- Effect failure handling
- Flow failure patterns
- Recovery strategies
- Audit trails for failures

**When to read:** After Determinism. Understand how things fail safely.

**Reading time:** 20 minutes

---

### Governance Model

How World Protocol manages authority and accountability.

**What you'll learn:**
- Proposal → Authority → Decision flow
- Authority registration and evaluation
- Multi-authority coordination
- Lineage DAG
- Audit trail generation

**When to read:** After Failure Model. Understand governance architecture.

**Reading time:** 25 minutes

**Note:** See [World Concept](/core-concepts/world) and [World Protocol Specification](/specifications/world-protocol) for governance details.

---

## Reading Order

### For System Designers

**Goal:** Understand architectural decisions and trade-offs

1. **[Layers](./layers)** — See the structure
2. **[Data Flow](./data-flow)** — See how it works
3. **[Determinism](./determinism)** — Understand core guarantee
4. **[World Protocol](/specifications/world-protocol)** — Understand authority architecture

**Total time:** ~1 hour

### For Implementers

**Goal:** Build compliant implementations

1. **[Layers](./layers)** — Understand boundaries
2. **[Data Flow](./data-flow)** — Understand execution model
3. **[Failure Model](./failure-model)** — Handle errors correctly
4. **[Specifications](/specifications/)** — Read normative contracts

**Total time:** ~1.5 hours + specs

### For Evaluators

**Goal:** Decide if architecture fits your needs

1. **[Layers](./layers)** — See high-level structure
2. **[Determinism](./determinism)** — Understand key guarantee
3. **[Design Rationale](/rationale/)** — Understand why

**Total time:** ~45 minutes

---

## Architecture Quick Reference

### The Six Layers

| Layer | Responsibility | Can Do | Cannot Do |
|-------|----------------|--------|-----------|
| **React/UI** | Present state, capture events | Render, dispatch intents | Execute effects, define logic |
| **Bridge** | Route events ↔ intents | Subscribe, project, issue | Mutate, execute, govern |
| **World** | Govern proposals, evaluate authority | Approve/reject, record | Execute, compute |
| **Host** | Execute effects, apply patches | Run handlers, orchestrate | Decide, interpret meaning |
| **Core** | Pure computation | Compute patches/effects | IO, execution, time-awareness |
| **Builder** | Define domains (DSL) | Generate schemas | Execute anything |

### Data Flow Summary

```
User Action
    ↓
React Dispatch
    ↓
Bridge Routing
    ↓
World Authority
    ↓
Host Orchestration
    ↓
Core Computation
    ↓
New Snapshot
```

### Key Guarantees

| Guarantee | How It's Enforced |
|-----------|-------------------|
| **Determinism** | Core is pure (no IO, no time, no mutation) |
| **Accountability** | World records all decisions |
| **Immutability** | Snapshots/Worlds never mutate after creation |
| **Completeness** | Snapshot contains all state (no hidden channels) |
| **Termination** | Flows are not Turing-complete |

---

## Common Architectural Questions

### Why separate Core and Host?

**Question:** Why not just have Core execute effects directly?

**Answer:** Separation enables:
- **Deterministic testing**: Core is pure, testable without mocks
- **Time-travel debugging**: Replay Core computation exactly
- **Effect isolation**: Swap implementations (mock APIs, different databases)
- **Parallelization**: Host can execute effects in parallel

See [Determinism](./determinism) for details.

### Why is Snapshot the only medium?

**Question:** Why not pass values directly between layers?

**Answer:** Single medium ensures:
- **Complete state visibility**: No hidden state
- **Serialization**: Can save entire world
- **Reproducibility**: Can replay from Snapshot
- **Simplicity**: One place to look for state

See [Data Flow](./data-flow#the-snapshot-principle) for details.

### Why is Flow not Turing-complete?

**Question:** Why can't Flows have unbounded loops?

**Answer:** Guarantees:
- **Termination**: Flows always finish in finite steps
- **Static analysis**: Can analyze Flow without executing
- **Complete traces**: Finite execution means complete logs

For unbounded iteration, Host controls the loop.

See [Flow Concept](/core-concepts/flow) for details.

### Why is World required?

**Question:** Can I skip World for simple apps?

**Answer:** World provides:
- **Audit trails**: Who did what, when, why
- **Lineage tracking**: How we got to this state
- **Authority evaluation**: Even if it always approves
- **Decision records**: Compliance and debugging

Even "always approve" authority provides value. World is not optional.

See [World Concept](/core-concepts/world) and [World Protocol](/specifications/world-protocol) for details.

---

## Architecture Diagrams

### Layer Dependencies

```mermaid
graph BT
    Builder["Builder<br/>(DSL)"]
    Core["Core<br/>(Computation)"]
    Host["Host<br/>(Execution)"]
    World["World<br/>(Governance)"]
    Bridge["Bridge<br/>(Routing)"]
    React["React<br/>(UI)"]

    Core --> Builder
    Host --> Core
    Host --> World
    Bridge --> World
    Bridge --> Host
    React --> Bridge

    style Core fill:#e1f5ff
    style Host fill:#fff4e1
    style World fill:#ffe1f5
    style Bridge fill:#f0f0f0
    style React fill:#e8f5e9
    style Builder fill:#fff9c4
```

### Execution Flow

```mermaid
sequenceDiagram
    participant User
    participant React
    participant Bridge
    participant World
    participant Host
    participant Core

    User->>React: Click button
    React->>Bridge: Dispatch action
    Bridge->>World: Submit proposal
    World->>World: Evaluate authority
    alt Approved
        World->>Host: Execute intent
        Host->>Core: compute()
        Core-->>Host: (patches, requirements)
        Host->>Host: Execute effects
        Host->>Host: Apply patches
        Host->>Core: compute() again
        Core-->>Host: (new snapshot, [])
        Host->>World: Commit decision
        World->>Bridge: Notify
        Bridge->>React: Update
        React->>User: Render
    else Rejected
        World->>Bridge: Notify rejection
        Bridge->>React: Update
        React->>User: Show error
    end
```

---

## Next Steps

### After Reading Architecture

1. **Understand specifications:** Read [Specifications](/specifications/)
2. **Understand rationale:** Read [Design Rationale](/rationale/)
3. **Build something:** Try [Getting Started](/guides/getting-started)

### If You're Designing a System

1. **Map your domain:** Identify state, actions, effects
2. **Define authorities:** Determine who can do what
3. **Model failures:** Plan error handling
4. **Choose integration points:** Decide where Manifesto fits in your stack

### If You're Evaluating Manifesto

1. **Check fit:** Does your problem need determinism, accountability, or governance?
2. **Assess trade-offs:** More upfront structure, less imperative flexibility
3. **Review alternatives:** See [Manifesto vs. Others](/what-is-manifesto/manifesto-vs-others)

---

## Related Sections

- **[Core Concepts](/core-concepts/)** — Understand building blocks
- **[Specifications](/specifications/)** — Normative contracts
- **[Rationale](/rationale/)** — Why decisions were made
- **[Guides](/guides/)** — Practical tutorials

---

**Start with [Layers](./layers) to understand Manifesto's structure.**
