# ADR-001: Layer Separation after Host v2.0.1

> **Status:** Accepted
> **Date:** 2025-01-17
> **Deciders:** Manifesto Architecture Team
> **Scope:** Core, Host, World, App layer boundaries

---

## Context

### The Problem

Host v2.0.1 introduced fundamental changes to the execution model:

- ExecutionKey-based mailbox serialization
- Run-to-completion job model
- `onTrace(TraceEvent)` stream (replacing lifecycle callbacks)
- Removal of `HostLoopOptions` and dispatch options

These changes broke existing contracts because **World was tightly coupled to Host's execution surface** (callbacks, options, internal state).

### Root Cause

The problem was not "Host API changed" but rather:

> **World was too close to Host's internal execution model.**

World was directly:
- Calling Host dispatch
- Using HostLoopOptions / lifecycle callbacks
- Emitting execution events (`execution:*`) based on Host internals

### Ambiguous Responsibilities (Pre-Decision)

| Responsibility | Unclear Owner |
|---------------|---------------|
| TraceEvent → World Event mapping | World? Host? App? |
| ExecutionKey policy | World? App? |
| baseSnapshot injection | World? App? |
| approvedScope enforcement | World? Adapter? |
| HostResult interpretation | World? Adapter? |
| Snapshot shape ownership | Core? Host? |
| "Bridge" naming conflict | Semantic vs Integration |

---

## Decision

### Layer Constitution

#### Core
- **Role:** Semantic computation (pure, deterministic)
- **Knows:** Snapshot structure, compute/apply semantics
- **Does NOT know:** IO, execution, approval, World
- **Responsibility:** Truth of semantic computation

#### Host
- **Role:** Execution engine
  - Event-loop
  - Effect execution
  - Patch apply + re-entry
- **Knows:** ExecutionKey, Snapshot, Intent
- **Does NOT know:** World, Proposal, Authority, governance
- **Responsibility:** Converge execution to terminal state

#### World
- **Role:** Governance + History
  - Proposal lifecycle
  - DecisionRecord
  - World creation/sealing
  - Lineage (DAG)
- **Knows:** Governance rules, WorldId computation, HostExecutor interface
- **Does NOT know:** Host internal API, TraceEvent, execution micro-steps
- **Responsibility:** "What becomes history"

> World does NOT interpret execution; it only seals results.

#### App (Composition Root)
- **Role:** Assembly + Policy + Presentation
  - Host ↔ World integration
  - ExecutionKey policy implementation
  - baseSnapshot injection
  - TraceEvent → execution:* transformation
  - approvedScope enforcement
  - Event presentation (UI/BE)
- **Knows:** Both Host and World interfaces
- **Does NOT know:** Core computation internals, World constitution changes
- **Responsibility:** Make execution viable from product/operational perspective

---

### Bridge Layer Decision

**Decision: No independent Bridge layer for Host-World integration.**

#### Reasoning

The term "Bridge" was overloaded:
1. **Semantic Bridge:** NL→Intent, Projection (Translator)
2. **Integration Bridge:** Host↔World glue (new requirement)

Creating a new layer would:
- Add dependency complexity
- Create new boundary debates ("where does Runtime end, App begin?")
- Increase package count without clear benefit

#### Resolution

- Host↔World integration responsibility is **absorbed into App**
- App internally organizes this as `runtime/` module
- "Bridge" remains reserved for semantic transformation (Translator)

---

### Runtime Layer Decision

**Decision: Runtime is a conceptual role within App, not an independent layer.**

#### Reasoning

Runtime responsibilities exist:
- Host ↔ World integration
- Execution policy/observation/scheduling

But extracting as independent package:
- Creates artificial boundary
- Forces premature abstraction
- Can be done later when reuse patterns emerge

#### Resolution

- Start as `app/runtime/` internal module
- World and Host do NOT know about Runtime
- Extract only when natural reuse occurs

> Runtime is not a "new layer" but **the name for App's execution environment responsibility**.

---

### Event Ownership Decision

| Owner | Events | Nature |
|-------|--------|--------|
| **World** | `proposal:*`, `world:*`, `execution:completed`, `execution:failed` | Governance results |
| **App** | `execution:compute`, `execution:patches`, `execution:effect:*` | Execution telemetry |

> **Results belong to World; Process belongs to App.**

#### Implication for World SPEC

World SPEC v2.0.0 currently defines all execution events. This needs update:

```typescript
// World-owned events (governance results)
type WorldEventType =
  | 'proposal:submitted'
  | 'proposal:evaluating'
  | 'proposal:decided'
  | 'proposal:superseded'
  | 'execution:completed'
  | 'execution:failed'
  | 'world:created'
  | 'world:forked';

// App-owned events (execution telemetry) - move out of World SPEC
// execution:compute, execution:patches, execution:effect:*
```

---

### HostExecutor Interface Decision

**Decision: World defines the interface; App implements it.**

```typescript
// Defined in World SPEC
interface HostExecutor {
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: HostExecutionOptions
  ): Promise<HostExecutionResult>;
}

// Implemented in App (runtime/ module)
class AppHostExecutor implements HostExecutor {
  constructor(private host: Host) {}

  async execute(...): Promise<HostExecutionResult> {
    // Transform, dispatch, interpret
  }
}
```

**Rationale:** World declares "I need execution results in this shape" (contract). App fulfills using Host (implementation).

---

## Consequences

### Positive

1. **Host changes no longer break World**
   - World only sees HostExecutor interface
   - App absorbs Host evolution

2. **World focuses on constitution**
   - Governance, lineage, audit
   - No execution internals

3. **App becomes evolution absorption layer**
   - Can adapt to Host changes
   - Can optimize telemetry
   - Can add policies without touching World

4. **Translator/semantic layer is independent**
   - Can be added later
   - No coupling to execution concerns

### Negative

1. **App has many responsibilities**
   - Mitigated by internal modularization (`runtime/`, `session/`, `ui/`)

2. **World SPEC needs update**
   - Remove execution telemetry events
   - Document App event responsibility

3. **Existing code needs refactoring**
   - World-to-Host direct calls must go through App

---

## Compliance

### What Must Change

| Component | Change Required |
|-----------|-----------------|
| World SPEC | Remove `execution:compute`, `execution:patches`, `execution:effect:*` from WorldEventType |
| World SPEC | Clarify HostExecutor as "interface World expects, App implements" |
| App | Create `runtime/` module for Host integration |
| App | Implement HostExecutor adapter |
| App | Own TraceEvent → telemetry event transformation |

### What Stays Same

| Component | Unchanged |
|-----------|-----------|
| Core | Pure computation, Snapshot shape |
| Host | ExecutionKey mailbox, run-to-completion, onTrace |
| World | Governance, WorldId, Lineage, DecisionRecord |

---

## Summary

> **This decision achieves, for the first time, a state where Manifesto architecture has "non-overlapping responsibilities."**
>
> Bridge did not disappear; it was precisely absorbed into App's assembly responsibility.

One sentence:

> **Results are World's; Process is App's.**
