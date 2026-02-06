# Manifesto World Protocol FDR v2.0.2

> **Status:** Active
> **Scope:** All Manifesto World Implementations
> **Compatible with:** Host Contract v2.0.2, ARCHITECTURE v2.0
> **Authors:** Manifesto Team
> **License:** MIT
> **Changelog:**
> - v1.0: Initial release
> - v2.0: Host v2.0.1 Integration, Event-Loop Execution Model alignment
> - v2.0.1: ADR-001 Layer Separation - Event ownership clarification
> - **v2.0.2: Host-World Data Contract - `$host` namespace convention, terminology unification**
> - **v2.0.3 addendum: Snapshot hash identity (`input` exclusion), HostExecutor `abort` ownership clarification**

---

## Purpose

This document records the **foundational design decisions** for the Manifesto World Protocol.

Each decision follows the format:
- **Decision:** What was decided
- **Context:** Why it was needed
- **Rationale:** Why this choice over alternatives
- **Consequences:** What rules/constraints follow

---

## Part I: Core Governance Decisions (v1.0)

> These decisions establish the constitutional foundation of World Protocol.
> They are preserved from v1.0 and remain normative.

### Summary (W001–W017)

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| W001 | Intent-level governance | Intent is human meaning |
| W002 | Proposal = Actor + Intent | Accountability envelope |
| W003 | Actor as first-class citizen | Protocol uniformity |
| W004 | Actor-Authority 1:1 binding | Trust is per-actor |
| W005 | Pending is not decision | Deliberation ≠ Decision |
| W006 | Host executes approved only | Separation of concerns |
| W007 | Constitutional review as effect | Manifestofy everything |
| W008 | World immutability | Time travel and audit |
| W009 | SnapshotHash excludes non-deterministic | Reproducibility |
| W010 | Fork-only DAG | Simplicity, unique paths |
| W011 | Rejected → no World | Rejection is counterfactual |
| W012 | Failure → World created | Failure is an outcome |
| W013 | World as orchestration container | Single coordination |
| W014 | Serializable persistence | Audit and replay |
| W015 | Execution trace reference | Concrete auditability |
| W016 | Host trust model | Scope enforcement deferred |
| W017 | Multi-proposal branching | Parallel exploration |

---

## Part II: Host v2.0.1 Integration (v2.0)

> These decisions align World Protocol with Host Contract v2.0.1's Event-Loop Execution Model.

### Summary (W018–W026)

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| W018 | ExecutionKey mapping policy | World maps, Host is opaque |
| W019 | Ingress vs Execution stage | Clear cancellation boundary |
| W020 | Scheduled reaction pattern | Handlers enqueue, never mutate |
| W021 | Event handler non-interference | EVT-C1~C6 enforcement |
| W022 | Terminal snapshot validity | Empty pendingRequirements |
| W023 | Error propagation contract | Dual-channel visibility |
| W024 | HostExecutor abstraction | Interface segregation |
| W025 | randomSeed excluded from hash | Derived from intentId |
| W026 | Evaluating state semantics | Deliberation, not decision |

---

## Part III: Layer Separation (v2.0.1)

> These decisions implement **ADR-001: Layer Separation**.
> They clarify the boundary between World (governance) and App (execution integration).

### FDR-W027: Event Ownership Separation

#### Decision

**World owns governance events; App owns execution telemetry events.**

| Owner | Events | Nature |
|-------|--------|--------|
| **World** | `proposal:*`, `world:*`, `execution:completed`, `execution:failed` | Governance results |
| **App** | `execution:compute`, `execution:patches`, `execution:effect:*`, `execution:started` | Execution telemetry |

#### Context

World SPEC v2.0.0 defined all execution-related events as World events:

```typescript
// v2.0.0 - ALL events in World
type WorldEventType =
  | 'proposal:submitted'
  | 'execution:compute'      // ← telemetry (problem)
  | 'execution:patches'      // ← telemetry (problem)
  | 'execution:effect:dispatched'  // ← telemetry (problem)
  // ...
```

This created coupling issues identified in ADR-001:
- World needed Host's TraceEvent structure to emit telemetry
- World was coupled to Host's internal execution model
- Host changes could break World

#### Rationale

**"Results are World's; Process is App's."**

| Aspect | World (Results) | App (Process) |
|--------|-----------------|---------------|
| Concern | What became history | How execution happened |
| Source | HostExecutionResult | Host TraceEvent stream |
| Stability | Constitutional | Operational |
| Change frequency | Rare | May evolve with Host |

World's role is governance—deciding legitimacy and recording history. Execution telemetry (compute iterations, patches, effects) is operational observation, not governance.

By separating:
1. World doesn't need TraceEvent structure
2. Host can evolve TraceEvent without breaking World
3. App absorbs execution model changes
4. World focuses on its constitutional role

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Keep all events in World | Couples World to Host internals |
| Create Runtime layer | Unnecessary; App already knows both Host and World |
| Remove telemetry entirely | Operational visibility is valuable; just not World's job |

#### Consequences

- **WORLD-EVT-OWN-1 (MUST):** World MUST only define governance events.
- **WORLD-EVT-OWN-2 (MUST NOT):** World MUST NOT define telemetry events.
- **WORLD-EVT-OWN-3 (MUST):** `execution:completed` and `execution:failed` remain World events.
- **APP-EVT-OWN-1:** App SHOULD define telemetry events from TraceEvent stream.

---

### FDR-W028: HostExecutor Interface Ownership

#### Decision

**World defines the HostExecutor interface; App implements it.**

```typescript
// World SPEC defines the contract
interface HostExecutor {
  execute(key, baseSnapshot, intent, opts?): Promise<HostExecutionResult>;
}

// App implements using Host
class AppHostExecutor implements HostExecutor {
  constructor(private host: Host) {}
  async execute(...) { /* Host integration */ }
}
```

#### Context

In v2.0.0, HostExecutor was defined but ownership was ambiguous. ADR-001 clarified: World is the **consumer** of execution, not the **provider**.

#### Rationale

**Contract-Implementation Separation:**

| Aspect | World | App |
|--------|-------|-----|
| Relationship | Consumer | Provider |
| Knows about Host | Interface only | Implementation details |
| Responsibility | Declare needs | Fulfill needs |

This follows Dependency Inversion:
- World depends on abstraction (HostExecutor interface)
- App provides concrete implementation
- Host internals are hidden from World

#### Consequences

- **WORLD-HEXEC-1 (MUST):** World MUST define HostExecutor interface.
- **WORLD-HEXEC-2 (MUST NOT):** World MUST NOT implement HostExecutor.
- **WORLD-HEXEC-3 (MUST NOT):** World MUST NOT import Host internal types.
- **APP-HEXEC-1:** App MUST provide HostExecutor implementation.

---

### FDR-W029: World's "Does NOT Know" Principle

#### Decision

**World explicitly does NOT know:**

| World Does NOT Know | Implication |
|--------------------|-------------|
| Host internal API | No direct Host imports |
| TraceEvent structure | No telemetry emission |
| Dispatch options | No execution configuration |
| Execution micro-steps | No compute/patch/effect observation |
| Host job model | No mailbox/runner awareness |

#### Context

ADR-001 established the "Does NOT Know" matrix as the primary boundary definition mechanism.

#### Rationale

**Ignorance as Architecture:**

When World doesn't know Host internals:
1. Host can evolve without breaking World
2. World cannot accidentally couple to Host
3. Testing World doesn't require Host
4. World's concerns remain purely governance

This is stronger than "should not use"—it's "cannot even reference."

#### Consequences

- **WORLD-BOUNDARY-1 (MUST NOT):** World package MUST NOT depend on Host.
- **WORLD-BOUNDARY-2 (MUST):** World MUST use HostExecutor interface only.
- **WORLD-BOUNDARY-3 (MUST NOT):** World MUST NOT reference Host internal types.
- **WORLD-BOUNDARY-4 (MUST):** World MUST receive HostExecutor via injection.

---

### FDR-W030: Execution Result Events Only

#### Decision

**World emits execution events only for terminal results, not intermediate states.**

| Event | When Emitted | Contains |
|-------|--------------|----------|
| `execution:completed` | Execution succeeded | worldId, proposalId |
| `execution:failed` | Execution failed | worldId, proposalId, error |

#### Context

With telemetry moved to App, World needs clarity on what execution events it owns.

#### Rationale

**Result Events are Governance Events:**

`execution:completed` and `execution:failed` are governance outcomes:
- They trigger World creation
- They complete Proposal lifecycle
- They become immutable history

They answer: "Did the Proposal succeed?" Not: "How many compute iterations?"

#### Consequences

- **WORLD-EXEC-EVT-1 (MUST):** World MUST emit `execution:completed` on success.
- **WORLD-EXEC-EVT-2 (MUST):** World MUST emit `execution:failed` on failure.
- **WORLD-EXEC-EVT-3 (MUST):** Both events MUST follow World creation.
- **WORLD-EXEC-EVT-4 (MUST NOT):** World MUST NOT emit during execution.

---

### FDR-W031: App as Evolution Absorption Layer

#### Decision

**App absorbs Host evolution; World remains stable.**

```
Host v2.0.1 → Host v2.1.0 (changes)
     ↓
App adapts HostExecutor implementation
     ↓
World unchanged
```

#### Context

Host will evolve. If World is coupled to Host, every Host change risks breaking World.

#### Rationale

**Change Isolation:**

| Change Type | Absorbed By | World Impact |
|-------------|-------------|--------------|
| New TraceEvent type | App | None |
| Host API signature | App | None |
| New execution strategy | App | None |
| New governance rule | World | Direct |

World changes only when governance changes. Execution mechanics are App's problem.

#### Consequences

- **ARCH-ABSORB-1:** App SHOULD encapsulate Host logic in `runtime/` module.
- **ARCH-ABSORB-2:** Host changes SHOULD NOT require World updates.

---

## Summary Table (v2.0.1)

| FDR | Decision | Key Principle | Reference |
|-----|----------|---------------|-----------|
| W027 | Event ownership separation | Results vs Process | ADR-001 §6 |
| W028 | HostExecutor: World defines, App implements | Dependency Inversion | ADR-001 §5 |
| W029 | World's "Does NOT Know" principle | Ignorance as Architecture | ADR-001 §3 |
| W030 | Execution result events only | Governance outcomes | ADR-001 §6 |
| W031 | App as evolution absorption layer | Change isolation | ADR-001 §7 |

---

## Part IV: Host-World Data Contract (v2.0.2)

> These decisions formalize the cross-layer data contract between Host and World.

### FDR-W032: The `$host` Namespace Convention

#### Decision

**Host MUST store its internal execution state in `snapshot.data.$host`. World MUST exclude this namespace from snapshotHash computation.**

```typescript
// Host writes to data.$host
snapshot.data.$host = {
  intentSlots: { ... },
  // other Host-managed state
};

// World excludes from hash
function computeSnapshotHash(snapshot) {
  const { $host, ...domainData } = snapshot.data;
  return hash({ data: domainData, ... });  // $host excluded
}
```

#### Context

Host needs persistent state across re-entry cycles (intent slots, execution context). This state must survive in Snapshot but should NOT affect World identity.

Without explicit convention:
- Host could store state anywhere (system.*, data.*, custom fields)
- World couldn't reliably exclude non-semantic state from hash
- Same semantic state could produce different WorldIds

#### Rationale

**Namespace Separation:**

| Namespace | Owner | Purpose | Hash Inclusion |
|-----------|-------|---------|----------------|
| `data.$host` | Host | Execution context, intent slots | ❌ Excluded |
| `data.*` (other) | Domain | Semantic state | ✅ Included |
| `system.*` | Core | Execution status, errors, pending | ✅ Included (normalized) |

**Why `data.$host` not `system.$host`?**
- `system.*` is Core-owned vocabulary (status, errors, pendingRequirements)
- Host should not pollute Core's namespace
- `$` prefix signals "reserved" namespace

**Benefits:**
1. **Determinism**: Same semantic state → same WorldId (regardless of intent slot state)
2. **Clarity**: Clear ownership boundary (`$host` = Host-owned)
3. **Safety**: `$host` prefix unlikely to collide with domain schemas
4. **Evolvability**: Host can add fields to `$host` without affecting World

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Store in `system.$host` | Pollutes Core's namespace |
| Store in separate channel | Violates "Snapshot is sole truth" principle |
| Hash everything | Intent slot changes would create new Worlds |
| Convention without formalization | Implicit contracts lead to bugs |

#### Consequences

- **HOST-DATA-1 (MUST):** Host MUST store internal state under `data.$host`.
- **HOST-DATA-2 (MUST NOT):** Host MUST NOT store internal state in `system.*`.
- **HOST-DATA-3 (MUST):** World MUST exclude `data.$host` from snapshotHash.
- **HOST-DATA-4 (MUST NOT):** World MUST NOT interpret `data.$host` contents.
- **HOST-DATA-5 (MAY):** App MAY read `data.$host` for debugging/telemetry.
- **HOST-DATA-6 (MUST NOT):** Domain schemas MUST NOT use `$host` as a key.

---

### FDR-W033: TerminalStatusForHash Terminology Unification

#### Decision

**`TerminalStatusForHash` uses `'completed' | 'failed'`, not `'completed' | 'error'`.**

```typescript
// v2.0.1 (inconsistent)
type TerminalStatusForHash = 'completed' | 'error';

// v2.0.2 (unified)
type TerminalStatusForHash = 'completed' | 'failed';
```

#### Context

v2.0.1 used `'error'` for the failure case in `TerminalStatusForHash`, while:
- World outcome: `'completed' | 'failed'`
- HostExecutionResult.outcome: `'completed' | 'failed'`

This inconsistency was confusing and error-prone.

#### Rationale

**Single Vocabulary:**

| Concept | Term (v2.0.2) |
|---------|---------------|
| World outcome | `'failed'` |
| Host result outcome | `'failed'` |
| Hash terminal status | `'failed'` |

Using `'failed'` consistently:
1. Reduces cognitive load
2. Eliminates mapping between vocabularies
3. Makes code more self-documenting

#### Consequences

- **TERM-UNIFIED-1:** `TerminalStatusForHash` MUST use `'failed'` (not `'error'`).
- **TERM-UNIFIED-2:** All World/Host outcome references MUST use `'failed'`.

---

## Part V: v2.0.3 Addendum Decisions

### FDR-W034: SnapshotHash Excludes `snapshot.input`

#### Decision

**`snapshot.input` is replay context, not semantic state. It MUST NOT participate in `snapshotHash`.**

#### Context

App may freeze execution-time context (for example, `input.$app.memoryContext`) for deterministic replay behavior.  
That context is operationally useful but does not define domain semantic identity.

#### Rationale

World identity follows the principle:

> **Same meaning, same hash.**

Including `input` would make equivalent semantic outcomes diverge by operational context snapshots.
The semantic identity surface remains:
- `data` (excluding platform namespaces)
- normalized `system` hash inputs

while replay context remains available through full snapshots and audit artifacts.

#### Consequences

- **WORLD-HASH-10 (MUST):** `snapshot.input` MUST NOT be included in `snapshotHash`.
- **PERSIST-SNAP-3 (SHOULD):** Store normalized `SnapshotHashInput` for audit/replay.
- **REPLAY-CTX-1:** Replay systems MAY use frozen `input` from stored snapshots, but this MUST NOT affect World identity hashing.

---

### FDR-W035: `HostExecutor.abort` Ownership and Terminal Convergence

#### Decision

**`abort?(executionKey)` is part of the World-defined HostExecutor contract (optional capability).**

#### Context

Cancellation capability existed at App implementation level, but ownership of the contract was ambiguous.
World governs Proposal lifecycle and therefore must define execution cancellation contract boundaries.

#### Rationale

Execution-stage Proposals are commitment-bound:
- they MUST NOT be dropped,
- they MUST converge to terminal outcome.

If cancellation is invoked, the lifecycle still belongs to World governance and must end in terminal `failed`.

#### Consequences

- **WORLD-HEXEC-7 (MUST):** If `abort()` is used for execution-stage work, proposal MUST still reach terminal (`failed`).
- **WORLD-STAGE-4 (MUST):** Execution-stage proposals are never drop-cancelled.
- **HEXEC-ABORT-1:** `abort` is best-effort and optional; absence of support is valid.
- **HEXEC-ABORT-2:** `abort` MUST NOT create hidden control channels outside normal execution result handling.

---

## Summary Table (v2.0.2 + v2.0.3 addendum)

| FDR | Decision | Key Principle | Reference |
|-----|----------|---------------|-----------|
| W032 | `$host` namespace convention | Namespace separation | WORLD-HASH-4a |
| W033 | Terminology unification (`'failed'`) | Single vocabulary | WORLD-TERM-5 |
| W034 | `snapshot.input` excluded from hash | Semantic identity boundary | WORLD-HASH-10 |
| W035 | `HostExecutor.abort` is World-owned contract | Governance owns lifecycle | WORLD-HEXEC-7 |

---

## Migration from v2.0.0

### Events Removed from World

| Event | Now In | Reason |
|-------|--------|--------|
| `execution:scheduled` | App | Telemetry |
| `execution:started` | App | Telemetry |
| `execution:compute` | App | Telemetry |
| `execution:patches` | App | Telemetry |
| `execution:effect:dispatched` | App | Telemetry |
| `execution:effect:fulfilled` | App | Telemetry |

### Events Preserved in World

| Event | Reason |
|-------|--------|
| `proposal:*` | Governance lifecycle |
| `world:*` | Governance lifecycle |
| `execution:completed` | Governance result |
| `execution:failed` | Governance result |

---

## Cross-Reference

| Document | Relationship |
|----------|--------------|
| ADR-001 | Source of W027–W031 decisions |
| ARCHITECTURE v2.0 | Layer definitions |
| Host SPEC v2.0.2 | HostExecutor implementation target |
| World SPEC v2.0.3 | Normative specification |

---

## Migration from v2.0.1

### New Decisions (v2.0.2)

| FDR | Change | Impact |
|-----|--------|--------|
| W032 | `$host` namespace formalized | Host MUST use `data.$host` |
| W033 | `'error'` → `'failed'` | Hash terminology change |
| W034 | `snapshot.input` excluded from hash | Semantic worlds remain stable across replay context |
| W035 | `HostExecutor.abort` owned by World contract | Cancellation semantics aligned with terminal lifecycle |

### Breaking Changes

| Change | Migration |
|--------|-----------|
| `TerminalStatusForHash = 'error'` | Change to `'failed'` |

---

*End of World Protocol FDR v2.0.2*
