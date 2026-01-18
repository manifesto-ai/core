# Manifesto World Protocol FDR v2.0.2

> **Status:** Accepted  
> **Scope:** All Manifesto World Implementations  
> **Compatible with:** Core SPEC v2.0.0, Host Contract v2.0.2, ARCHITECTURE v2.0  
> **Authors:** Manifesto Team  
> **License:** MIT  
> **Changelog:**
> - v1.0: Initial release
> - v2.0: Host v2.0.1 Integration, Event-Loop Execution Model alignment
> - v2.0.1: ADR-001 Layer Separation - Event ownership clarification
> - **v2.0.2: WorldId hash determinism + baseSnapshot responsibility**

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
- **APP-EVT-OWN-2:** App owns event/listener mechanics; World emits via an App-provided EventSink.

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

## Part IV: Hash Determinism & Snapshot Responsibility (v2.0.2)

### FDR-W032: Deterministic WorldId Hash Input

#### Decision

**WorldId hashing MUST be derived from deterministic, normalized inputs only.**

Specifically:
- Use JCS (RFC 8785) canonicalization for all hash inputs
- Derive `terminalStatus` from `system.lastError` and `pendingRequirements` only
- Compute `pendingDigest` from sorted requirement IDs
- ErrorSignature excludes `message`, `timestamp`, and `context`

#### Context

WorldId is the identity of a World. Any non-deterministic input (timestamps, status vocabulary, or effect artifacts) breaks replay and lineage invariants across hosts and runtimes.

#### Rationale

**Determinism is the only stable coordinate for lineage.**

By constraining the hash input:
1. Different runtimes produce the same WorldId for the same terminal snapshot
2. Host execution mechanics cannot influence governance identity
3. Pending/failed states cannot collide with successful states

#### Consequences

- **WORLD-HASH-2 (MUST):** terminalStatus derives from `lastError` + `pendingRequirements` only
- **WORLD-HASH-PENDING-1 (MUST):** pendingDigest uses sorted requirement IDs
- **WORLD-HASH-ERR-MSG-1 (MUST NOT):** ErrorSignature MUST NOT include `message`, `timestamp`, or `context`
- **HASH-ENC-1 (MUST):** Hash inputs MUST be JCS canonicalized

---

### FDR-W033: BaseSnapshot Retrieval via WorldStore

#### Decision

**World retrieves baseSnapshot through WorldStore; App supplies the storage implementation.**

#### Context

World owns lineage and baseWorld selection, but storage persistence varies by product. World needs a stable abstraction for baseSnapshot retrieval without coupling to app storage details.

#### Rationale

**Separation of concerns:**
- World requires baseSnapshot to execute approved intents
- App provides persistence strategy without changing World semantics

#### Consequences

- **PERSIST-BASE-1 (MUST):** World MUST retrieve baseSnapshot via WorldStore
- **PERSIST-BASE-2 (MUST):** App MUST provide a WorldStore capable of restoring baseSnapshot

---

## Summary Table (v2.0.2)

| FDR | Decision | Key Principle | Reference |
|-----|----------|---------------|-----------|
| W027 | Event ownership separation | Results vs Process | ADR-001 §6 |
| W028 | HostExecutor: World defines, App implements | Dependency Inversion | ADR-001 §5 |
| W029 | World's "Does NOT Know" principle | Ignorance as Architecture | ADR-001 §3 |
| W030 | Execution result events only | Governance outcomes | ADR-001 §6 |
| W031 | App as evolution absorption layer | Change isolation | ADR-001 §7 |
| W032 | Deterministic WorldId hash input | Determinism first | SPEC §5.5 |
| W033 | BaseSnapshot via WorldStore | Responsibility clarity | SPEC §9.3 |

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
| World SPEC v2.0.2 | Normative specification |

---

*End of World Protocol FDR v2.0.2*
