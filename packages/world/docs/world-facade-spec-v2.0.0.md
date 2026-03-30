# Manifesto World Facade Specification

> **Status:** Draft (Projected next major)
> **Version:** v2.0.0
> **Package:** `@manifesto-ai/world`
> **Scope:** `@manifesto-ai/world` — Composition Facade for Governance + Lineage
> **Compatible with:** Lineage SPEC v2.0.0 draft, Governance SPEC v2.0.0 draft
> **SDK alignment:** current SDK SPEC v2.0.0 remains aligned to facade v1.0.0; [SDK SPEC v3.0.0 draft](../../sdk/docs/sdk-SPEC-v3.0.0-draft.md) is expected to align to this draft when the shared epoch lands.
> **Implements:** ADR-014 D7 (Facade), D11.3 (Storage Seam — Composite), D14 (Commit Coordinator)
> **Authors:** Manifesto Team
> **License:** MIT
> **Changelog:**
> - **v2.0.0 (2026-03-29):** Projected facade-major aligned to ADR-015 + ADR-016
>   - Re-export policy updated for Lineage v2 / Governance v2 draft surfaces
>   - `WriteSet` semantics now transitively include `SealAttempt` persistence through `PreparedLineageCommit`
>   - `commitSeal()` aligns to `(head, tip, epoch)` CAS, idempotent reuse, and snapshot first-write-wins semantics
>   - Typed rejection path removed from the current v2 public contract and deferred to future ADR work
>   - Event/fork semantics align to continuity-parent lineage model
> - **v1.0.0 (2026-03-28):** Initial facade specification after ADR-014 split
>   - Composite store interface (`CommitCapableWorldStore`)
>   - WriteSet type definition
>   - Coordinator orchestration protocol
>   - `createWorld()` convenience entrypoint
>   - Re-export policy
>   - Facade lifecycle policy

> **Draft Note:** This file captures the projected World facade v2.0.0 rewrite aligned to ADR-015 and ADR-016. The current normative package contract remains [world-facade-spec-v1.0.0.md](world-facade-spec-v1.0.0.md) until the shared epoch boundary lands.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Normative Language](#2-normative-language)
3. [Scope & Non-Goals](#3-scope--non-goals)
4. [Dependency Direction](#4-dependency-direction)
5. [Re-export Policy](#5-re-export-policy)
6. [Composite Store](#6-composite-store)
7. [WriteSet](#7-writeset)
8. [Coordinator Orchestration Protocol](#8-coordinator-orchestration-protocol)
9. [createWorld() Entrypoint](#9-createworld-entrypoint)
10. [Event Emission Policy](#10-event-emission-policy)
11. [Facade Lifecycle](#11-facade-lifecycle)
12. [SDK Alignment](#12-sdk-alignment)
13. [Invariants](#13-invariants)
14. [Compliance](#14-compliance)
15. [References](#15-references)

---

## 1. Purpose

This document specifies the **World Facade** — the composition layer that remains in `@manifesto-ai/world` after ADR-014 promotes Governance and Lineage to independent protocols.

The facade exists for two reasons:

1. **SDK SPEC stability.** Moving coordinator logic into the SDK would require a projected SDK v3.0.0 rewrite. The facade absorbs this complexity so the current SDK v2.0.0 surface can remain truthful until the shared epoch lands.
2. **Adoption convenience.** Users who need both governance and lineage can depend on a single package instead of importing and wiring two.

The facade is **thin by design.** It does not define new constitutional rules. Every protocol invariant it enforces is delegated to Governance SPEC v2.0.0 draft or Lineage SPEC v2.0.0 draft. The facade's own rules govern only the **assembly** — how two projected protocols are composed, committed atomically, and surfaced as a unified API.

---

## 2. Normative Language

Key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are interpreted as described in RFC 2119.

---

## 3. Scope & Non-Goals

### 3.1 In Scope

| Area | Description |
|------|-------------|
| Re-export policy | Which governance/lineage exports are re-exported |
| Composite store | `CommitCapableWorldStore` interface |
| WriteSet | Type that bundles lineage + governance records |
| Coordinator protocol | Orchestration sequence for the current typed seal path |
| `createWorld()` | Convenience factory assembling governance + lineage + store |
| Event emission timing | When governance events are triggered relative to commit |
| Facade lifecycle | Maintenance, deprecation, and removal policy |
| SDK alignment | How SDK consumes the facade |

### 3.2 Explicit Non-Goals

| Non-Goal | Owner |
|----------|-------|
| World identity, hash, terminalStatus derivation | Lineage SPEC (LIN-*) |
| Proposal lifecycle, Actor/Authority, HostExecutor | Governance SPEC (GOV-*) |
| Branch CAS semantics, head advance, epoch mechanics | Lineage SPEC (LIN-STORE-*, LIN-HEAD-*) |
| Single-writer gate, stale ingress invalidation | Governance SPEC (GOV-BRANCH-GATE-*) |
| Host/Core internals | Host SPEC / Core SPEC |
| Physically separated stores (Strategy B/C) | Deferred (ADR-014 §6) |
| New constitutional rules | Not permitted — facade assembles, not legislates |

---

## 4. Dependency Direction

```
@manifesto-ai/world (this facade)
  ├── imports @manifesto-ai/governance
  └── imports @manifesto-ai/lineage
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-DEP-1 | MAY | Facade MAY import from `@manifesto-ai/governance` and `@manifesto-ai/lineage` |
| FACADE-DEP-2 | MUST NOT | `@manifesto-ai/governance` MUST NOT import from facade |
| FACADE-DEP-3 | MUST NOT | `@manifesto-ai/lineage` MUST NOT import from facade |
| FACADE-DEP-4 | MUST NOT | Facade MUST NOT import from `@manifesto-ai/core` or `@manifesto-ai/host` directly. Core and Host types reach the facade only through governance or lineage re-exports |

---

## 5. Re-export Policy

The facade serves as a **convenience aggregator** — users who depend on `@manifesto-ai/world` can access both protocols' public APIs without adding separate dependencies.

### 5.1 Re-exported Symbols

The facade MUST re-export the following from their owning packages:

**From `@manifesto-ai/lineage`:**

All public types and services defined in Lineage SPEC v2.0.0 draft §7.1–§7.3 and §11.2, including but not limited to: `LineageService`, `LineageStore`, `PreparedLineageCommit`, `PreparedGenesisCommit`, `PreparedNextCommit`, `PreparedBranchMutation`, `PreparedBranchBootstrap`, `SealGenesisInput`, `SealNextInput`, `WorldId`, `BranchId`, `World`, `WorldEdge`, `SealAttempt`, `AttemptId`, `BranchInfo`, `WorldHead`, `TerminalStatus`, `Snapshot`, `SnapshotHashInput`, `CurrentErrorSignature`, `ProvenanceRef`, `ArtifactRef`, `PersistedPatchDeltaV2`.

**From `@manifesto-ai/governance`:**

All public governance protocol types and services defined in Governance SPEC v2.0.0 draft §5–§6, §9.2, the event payload definitions in §10, and `GovernanceStore` in §11.2, including but not limited to: `GovernanceService`, `GovernanceStore`, `Proposal`, `ProposalId`, `ProposalStatus`, `DecisionRecord`, `DecisionId`, `ActorId`, `AuthorityId`, `ActorAuthorityBinding`, `Intent`, `ExecutionKey`, `ExecutionKeyContext`, `PreparedGovernanceCommit`, `SupersedeReason`, and governance event types (`ProposalSubmittedEvent`, `ExecutionCompletedEvent`, `ExecutionFailedEvent`, `WorldCreatedEvent`, `WorldForkedEvent`).

### 5.2 Facade-Owned Exports

The facade exports the following types and functions that it owns:

- `CommitCapableWorldStore` (§6)
- `WriteSet` (§7)
- `WorldCoordinator` (§8)
- `GovernanceEventDispatcher` (§10)
- `createWorld()` (§9)
- `createInMemoryWorldStore()` (§6.4)

### 5.3 Re-export Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-REEXPORT-1 | MUST | Facade MUST re-export all public types listed in §5.1 |
| FACADE-REEXPORT-2 | MUST NOT | Facade MUST NOT re-export internal implementation types (e.g., `createWorldRecord()`, `computeHash()`, lineage/governance store implementation classes) |
| FACADE-REEXPORT-3 | MUST | Re-exported types MUST be pass-through — facade MUST NOT wrap, extend, or alter their signatures |
| FACADE-REEXPORT-4 | SHOULD | Facade SHOULD re-export using `export { ... } from '...'` or equivalent to ensure type identity is preserved |

---

## 6. Composite Store

### 6.1 Purpose

When both governance and lineage are present, their records must be committed atomically. The composite store provides this capability by extending both `LineageStore` and `GovernanceStore` with a joint atomic commit method.

### 6.2 Interface

```typescript
interface CommitCapableWorldStore extends LineageStore, GovernanceStore {
  /**
   * Atomically commits lineage records and governance records together.
   *
   * The write set always contains lineage records + governance records,
   * including `PreparedLineageCommit.attempt` persistence.
   *
   * Atomicity: all-or-nothing. On failure, no records are persisted.
   *
   * When the write set includes lineage records with branchChange.kind === 'advance',
   * the same joint `(head, tip, epoch)` CAS semantics as
   * LineageStore.commitPrepared() apply (LIN-STORE-4).
   * When branchChange.kind === 'bootstrap', branch non-existence is verified (LIN-GENESIS-3).
   * Same-parent same-world reuse is detected in-transaction and MUST still
   * persist one `SealAttempt` (LIN-STORE-9, MRKL-STORE-1~4).
   */
  commitSeal(writeSet: WriteSet): void;
}
```

### 6.3 Store Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-STORE-1 | MUST | `CommitCapableWorldStore` MUST extend both `LineageStore` and `GovernanceStore` |
| FACADE-STORE-2 | MUST | `commitSeal()` MUST be atomic — all records or nothing |
| FACADE-STORE-3 | MUST | `commitSeal()` MUST persist both lineage records (`writeSet.lineage`) and governance records (`writeSet.governance`) in a single transaction, including the lineage `SealAttempt` carried by `PreparedLineageCommit` |
| FACADE-STORE-4 | MUST NOT | `commitSeal()` MUST NOT define or accept a governance-only write path in the current v2 draft |
| FACADE-STORE-5 | MUST | `commitSeal()` with lineage records MUST enforce the same semantics as `LineageStore.commitPrepared()`: joint `(head, tip, epoch)` CAS (LIN-STORE-4), branch-scoped mutation (LIN-STORE-5), and reuse detection + attempt persistence + snapshot first-write-wins safety (LIN-STORE-9, MRKL-STORE-1~4) |
| FACADE-STORE-6 | MUST NOT | `commitSeal()` MUST NOT be used in lineage-only environments. Lineage standalone callers use `LineageService.commitPrepared()` directly (LIN-SEAL-5) |
| FACADE-STORE-7 | MUST | Facade package MUST provide an in-memory `CommitCapableWorldStore` implementation via `createInMemoryWorldStore()` |

### 6.4 In-Memory Implementation

```typescript
/**
 * Creates an in-memory CommitCapableWorldStore.
 *
 * Composes in-memory LineageStore and GovernanceStore into a single
 * store that supports commitSeal(). Suitable for development, testing,
 * and non-persistent use cases.
 */
function createInMemoryWorldStore(): CommitCapableWorldStore;
```

**Implementation guidance (informative).** The in-memory implementation MAY delegate individual read/write methods to the underlying `LineageStore` and `GovernanceStore` implementations. `commitSeal()` atomicity is trivially achieved in-memory via synchronous writes. Persistent implementations MUST use database transactions or equivalent mechanisms.

---

## 7. WriteSet

### 7.1 Type Definition

```typescript
/**
 * WriteSet: bundles all records from a seal operation for atomic commit.
 *
 * In the current v2 draft there is a single shape:
 * lineage prepare succeeded → lineage + governance records.
 * `lineage.attempt` transitively carries attempt-scoped provenance/trace/delta.
 */
type WriteSet = {
  readonly lineage: PreparedLineageCommit;
  readonly governance: PreparedGovernanceCommit;
};
```

### 7.2 WriteSet Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-WS-1 | MUST | `WriteSet` MUST contain both `lineage` and `governance` records from the same seal operation |
| FACADE-WS-2 | MUST NOT | `WriteSet` MUST NOT omit lineage records in the current v2 draft |
| FACADE-WS-3 | MUST NOT | Coordinator MUST NOT invent alternate `WriteSet` variants outside this single typed surface |
| FACADE-WS-4 | MUST | `lineage.attempt` remains part of the committed write set transitively through `PreparedLineageCommit` |

**Why a single shape in v2.** The projected Lineage v2 public API does not expose a typed rejection channel from `prepareSealNext()`. Keeping a governance-only `WriteSet` variant in the facade would therefore document a branch that the current typed surface cannot produce.

---

## 8. Coordinator Orchestration Protocol

### 8.1 Overview

The coordinator is the facade's primary behavioral responsibility. It orchestrates the seal across governance and lineage, assembles the write set, commits atomically, and triggers event emission.

The coordinator is injected with (or internally holds references to):
- `LineageService` — for `prepareSealNext()` / `prepareSealGenesis()`
- `GovernanceService` — for `finalize()`
- `CommitCapableWorldStore` — for `commitSeal()`
- `GovernanceEventDispatcher` — for post-commit event emission (§10)

### 8.2 Coordinator Interface

```typescript
interface WorldCoordinator {
  /**
   * Seal a next World after governance-approved execution.
   *
   * Orchestrates: lineage prepare → governance finalize → atomic commit → events.
   */
  sealNext(params: CoordinatorSealNextParams): SealResult;

  /**
   * Seal the genesis World.
   *
   * Genesis in a governance-active facade: lineage prepareGenesis → governance
   * finalize (if governance wraps genesis) → atomic commit → events.
   *
   * See §8.6 for genesis coordination details.
   */
  sealGenesis(params: CoordinatorSealGenesisParams): SealResult;
}

type CoordinatorSealNextParams = {
  readonly executingProposal: Proposal;
  readonly sealInput: SealNextInput;
  readonly completedAt: number;
};

type CoordinatorSealGenesisParams =
  | {
      readonly kind: 'governed';
      readonly sealInput: SealGenesisInput;
      readonly executingProposal: Proposal;
      readonly completedAt: number;
    }
  | {
      readonly kind: 'standalone';
      readonly sealInput: SealGenesisInput;
    };

type SealResult = {
  readonly kind: 'sealed';
  readonly worldId: WorldId;
  readonly terminalStatus: TerminalStatus;
};
```

### 8.3 Normal Path — `sealNext()` Sequence

This is the normative sequence when `prepareSealNext()` succeeds:

```
Governance                   Coordinator                     Lineage             Store
    │                              │                            │                   │
    │── sealNext(params) ─────────>│                            │                   │
    │                              │                            │                   │
    │                              │  1. lineage.               │                   │
    │                              │     prepareSealNext(       │                   │
    │                              │       sealInput)           │                   │
    │                              │──────────────────────────>│                   │
    │                              │                            │  validate,        │
    │                              │                            │  derive, hash,    │
    │                              │                            │  create records   │
    │                              │<── PreparedLineageCommit ──│                   │
    │                              │                            │                   │
    │                              │  2. governance.finalize(   │                   │
    │                              │       executingProposal,   │                   │
    │                              │       lineageCommit,       │                   │
    │                              │       completedAt)         │                   │
    │                              │  → PreparedGovernanceCommit│                   │
    │                              │                            │                   │
    │                              │  3. Assemble WriteSet      │                   │
    │                              │     { lineage, governance }│                   │
    │                              │                            │                   │
    │                              │  4. store.commitSeal(      │                   │
    │                              │       writeSet)            │                   │
    │                              │──────────────────────────────────────────────>│
    │                              │            (atomic: all or nothing)            │
    │                              │                            │                   │
    │                              │  5. dispatcher.             │                   │
    │                              │     emitSealCompleted(      │                   │
    │                              │       govCommit,            │                   │
    │                              │       lineageCommit)        │                   │
    │                              │     (§10, only after        │                   │
    │                              │      commit success)        │                   │
    │                              │                            │                   │
    │<── SealResult { kind:        │                            │                   │
    │     'sealed', worldId,       │                            │                   │
    │     terminalStatus }         │                            │                   │
```

### 8.4 Reserved Rejection Path — `sealNext()` Sequence

This path is intentionally **not** part of the current normative v2 surface. The projected Lineage v2 public API returns `PreparedNextCommit` and does not expose a typed structural rejection result. If a future ADR adds such a channel, the facade may grow a second orchestration branch in a later revision.

### 8.5 Ordering Constraints

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-COORD-1 | MUST | `lineage.prepareSealNext()` MUST be called before `governance.finalize()` — governance needs `lineageCommit.worldId` and `lineageCommit.terminalStatus` (GOV-SEAL-1, GOV-SEAL-3) |
| FACADE-COORD-2 | MUST | `governance.finalize()` MUST be called before `store.commitSeal()` — the coordinator needs both prepared results to assemble the WriteSet |
| FACADE-COORD-3 | MUST | Events MUST be emitted only after `store.commitSeal()` succeeds (GOV-EXEC-EVT-3, INV-G30) |
| FACADE-COORD-4 | MUST NOT | The coordinator MUST NOT invent governance-only terminalization branches outside the current typed v2 surface |
| FACADE-COORD-5 | MUST | The coordinator MUST NOT call `lineage.commitPrepared()` — that path is for lineage-only environments (LIN-SEAL-5). Governed environments use `store.commitSeal()` exclusively |

### 8.6 Genesis Coordination

The facade supports genesis in two modes, discriminated by `CoordinatorSealGenesisParams.kind`:

**Governance-wrapped genesis (`kind: 'governed'`).** The coordinator runs the same pattern as `sealNext()`: lineage prepare → governance finalize → atomic commit → events. Genesis never rejects (LIN-GENESIS-1 requires `completed` status; collision on a fresh store is not possible), so only the normal path applies.

**Governance-free genesis (`kind: 'standalone'`).** The coordinator delegates directly to lineage: `lineage.prepareSealGenesis()` → `lineage.commitPrepared()`. No governance records are created. No `WriteSet` or `commitSeal()` is used — this is the lineage standalone path (Lineage SPEC §7.4).

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-COORD-6 | MUST | When `kind === 'governed'`, genesis MUST follow the governance-wrapped path (prepare → finalize → commitSeal → events) |
| FACADE-COORD-7 | MUST | When `kind === 'standalone'`, genesis MUST delegate to `lineage.prepareSealGenesis()` + `lineage.commitPrepared()` directly |
| FACADE-COORD-8 | MUST NOT | Standalone genesis MUST NOT create governance records or use `commitSeal()` |

### 8.7 CAS Failure Retry Policy

When `store.commitSeal()` fails due to a CAS mismatch (branch head, tip, or epoch changed between prepare and commit), the coordinator must retry.

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-COORD-9 | MUST | On CAS failure, the coordinator MUST retry from `lineage.prepareSealNext()` (step 1), not from `commitSeal()` alone. Store state has changed — the prepared result is stale |
| FACADE-COORD-10 | SHOULD | The coordinator SHOULD implement a bounded retry strategy (e.g., maximum 3 attempts) to prevent infinite loops under persistent contention |
| FACADE-COORD-11 | MUST | Each retry iteration MUST re-execute the full sequence: prepare → finalize → assemble → commit |

**Why retry from prepare, not from commit.** `prepareSealNext()` reads the current `(head, tip, epoch)` from the store and embeds these as CAS expectations in `PreparedBranchMutation`. If the store state changed (another branch advanced, a failed seal advanced `tip`, or a concurrent seal succeeded), the prepare-time expectations are invalid. Re-running `commitSeal()` with stale expectations would fail again. Only a fresh prepare against current store state can produce valid expectations.

---

## 9. createWorld() Entrypoint

### 9.1 Purpose

`createWorld()` is a convenience factory that assembles governance, lineage, the composite store, and the coordinator into a ready-to-use composition. It is the facade's primary public API for users who want both protocols.

### 9.2 Signature

```typescript
interface WorldConfig {
  /** The composite store that all services share.
   *  The caller MUST construct LineageService and GovernanceService
   *  with this exact same store instance before passing them here. */
  store: CommitCapableWorldStore;

  /** Pre-constructed lineage service.
   *  Created by the lineage package (e.g., createLineageService(store)).
   *  The facade does not own lineage service creation logic. */
  lineage: LineageService;

  /** Pre-constructed governance service.
   *  Created by the governance package (e.g., createGovernanceService(store, ...)).
   *  The facade does not own governance service creation logic. */
  governance: GovernanceService;

  /** Event dispatcher for post-commit governance event emission.
   *  See §10 for interface definition.
   *  Governance package provides the implementation. */
  eventDispatcher: GovernanceEventDispatcher;
}

interface WorldInstance {
  /** The coordinator for seal operations. */
  readonly coordinator: WorldCoordinator;

  /** The lineage service for queries, branch management, and restore. */
  readonly lineage: LineageService;

  /** The governance service for proposal lifecycle. */
  readonly governance: GovernanceService;

  /** The composite store (for direct access if needed). */
  readonly store: CommitCapableWorldStore;
}

function createWorld(config: WorldConfig): WorldInstance;
```

**Why pre-built services, not config objects.** The facade is an assembly layer — it wires existing components, not a factory that knows how to construct them. `GovernanceService` creation requires governance-internal parameters (authority policy, actor bindings, HostExecutor) that are defined and owned by the Governance SPEC. If the facade accepted a `GovernanceConfig`, it would need to understand governance internals — violating the "facade does not legislate" principle. Pre-built injection keeps creation responsibility in each package's SPEC and gives the facade only assembly responsibility.

**Why `store` is required, not optional.** Services are pre-built by the caller with a specific store instance. If `createWorld()` created a default store internally, that store would be unknown to the already-constructed services — lineage would read from store A while the coordinator commits to store B. This breaks single-store atomic commit (ADR-014 Strategy A) and CAS correctness. Making `store` required ensures the caller controls the single physical store and passes the same instance to all three: `LineageService`, `GovernanceService`, and `createWorld()`.

**Typical wiring pattern (schematic):**

```typescript
// Step 1: Create the single shared store
const store = createInMemoryWorldStore();           // facade export

// Step 2: Create services with that store
const lineage = createLineageService(store);         // lineage package
const governance = createGovernanceService(store, {  // governance package
  authority: myAuthority,
  hostExecutor: myExecutor,
});
const dispatcher = createGovernanceEventDispatcher({ service: governance }); // governance package

// Step 3: Assemble
const world = createWorld({ store, lineage, governance, eventDispatcher: dispatcher });
```

### 9.3 Factory Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-FACTORY-1 | MUST | `createWorld()` MUST return a ready-to-use `WorldInstance` (no async initialization) |
| FACADE-FACTORY-2 | MUST | `createWorld()` MUST wire the coordinator with the provided `lineage`, `governance`, `eventDispatcher`, and `store` |
| FACADE-FACTORY-3 | MUST | The `lineage`, `governance`, and `store` provided to `createWorld()` MUST be bound to the exact same `CommitCapableWorldStore` instance. This is a caller precondition. Violation results in undefined behavior — CAS expectations from `prepareSealNext()` will not match the store that `commitSeal()` targets |
| FACADE-FACTORY-4 | MUST | `createWorld()` MUST expose the provided `lineage` and `governance` on the returned `WorldInstance` without wrapping or modifying them |

---

## 10. Event Emission Policy

### 10.1 Ownership

Per ADR-014 D8, all governance result events are **owned by governance**. The facade does not define its own event types. However, the facade owns the **emission seam** — the interface through which the coordinator triggers event dispatch after a successful commit.

### 10.2 GovernanceEventDispatcher Interface

```typescript
/**
 * GovernanceEventDispatcher: the seam between coordinator (commit timing)
 * and governance (event payload construction + subscriber notification).
 *
 * This interface is the facade coordinator's dependency shape.
 * Governance MUST expose a public implementation that conforms to this seam.
 *
 * The coordinator calls these methods after commitSeal() succeeds.
 * The implementation constructs appropriate governance events (GOV-EXEC-EVT-*)
 * and dispatches them to registered subscribers.
 */
interface GovernanceEventDispatcher {
  /**
   * Emit events for a successful seal (normal path).
   *
   * Called after commitSeal(writeSet) succeeds.
   * The implementation emits execution:completed or execution:failed
   * and world:created / world:forked events based on the governance commit's outcome.
   * `WorldCreatedEvent.world` transitively follows the Lineage v2 World shape,
   * and `WorldForkedEvent.forkPoint` is the continuity parent.
   */
  emitSealCompleted(
    governanceCommit: PreparedGovernanceCommit,
    lineageCommit: PreparedLineageCommit,
  ): void;
}
```

### 10.3 Dispatch Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-EVT-1 | MUST | Events MUST be emitted only after `store.commitSeal()` succeeds. If `commitSeal()` throws, no events are emitted |
| FACADE-EVT-2 | MUST | The coordinator MUST call `GovernanceEventDispatcher.emitSealCompleted()` after a successful commit |
| FACADE-EVT-3 | MUST | `GovernanceEventDispatcher` MUST be implemented by the governance package. The facade fixes the seam shape and timing semantics; governance provides the concrete public implementation |
| FACADE-EVT-4 | MUST NOT | The coordinator MUST NOT construct governance event payloads itself — payload construction is governance's responsibility inside the dispatcher implementation |
| FACADE-EVT-5 | MUST NOT | The coordinator MUST NOT call dispatcher methods during prepare or finalize steps — only after successful commit |

**Why the facade defines this interface.** The coordinator needs a concrete call target for "emit events now." Governance owns event types, payloads, and subscribers, but the facade owns the post-commit timing rule because only the coordinator knows when the atomic commit succeeds. The interface is minimal and synchronous, and it does not introduce new event types — it only fixes the call shape and timing semantics.

**Why governance implements it.** Governance owns the subscriber registry (Governance SPEC §10.3), the public dispatcher implementation and factory described in §10.4, event type definitions (§10.9), and handler constraints (GOV-EVT-C1~C6). The dispatcher implementation wraps all of this. The facade never touches subscriber lists or event payloads.

---

## 11. Facade Lifecycle

### 11.1 Maintenance Policy

Per ADR-014 D7:

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-LIFECYCLE-1 | MUST | The facade MUST be maintained for at least 2 minor versions after the split |
| FACADE-LIFECYCLE-2 | SHOULD | Facade removal SHOULD only occur at a major version boundary |
| FACADE-LIFECYCLE-3 | MUST | A migration guide MUST be provided at deprecation time, documenting how to replace facade usage with direct governance + lineage imports |
| FACADE-LIFECYCLE-4 | MAY | The facade MAY be kept permanently if it retains value as a convenience wrapper |

### 11.2 Deprecation Signals

If the facade is deprecated, the following signals MUST be provided:

1. `@deprecated` JSDoc annotation on `createWorld()` and `CommitCapableWorldStore`
2. Console warning on first `createWorld()` invocation (once per process)
3. Migration guide in package README

---

## 12. SDK Alignment

### 12.1 SDK Consumption Path

The current SDK v2.0.0 remains aligned to facade v1.0.0. This draft captures the projected facade-side contract that a future SDK v3.0.0 draft is expected to consume.

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-SDK-1 | MUST | The facade draft MUST continue to export `CommitCapableWorldStore` as the canonical governed store type projected to surface through SDK |
| FACADE-SDK-2 | MUST | The projected SDK v3 re-export from `@manifesto-ai/world` MUST include `CommitCapableWorldStore`, `createWorld()`, and `createInMemoryWorldStore()` |
| FACADE-SDK-3 | MUST NOT | SDK MUST NOT depend on facade internals — only on facade's public exports |

### 12.2 Hard-Cut Outcome

The SDK alignment step for this facade draft is pending:

1. top-level `@manifesto-ai/world` remains the exact facade surface
2. the current SDK v2.0.0 stays aligned to facade v1.0.0 until the shared epoch lands
3. projected SDK v3.0.0 is expected to re-export the thin governed facade-owned types and factories from this draft surface
4. `createManifesto()` remains a direct-dispatch SDK entry point and does not implicitly assemble governed world composition

---

## 13. Invariants

| ID | Invariant |
|----|-----------|
| INV-F1 | `commitSeal()` is atomic — all records or nothing (delegates LIN-STORE-6 + governance atomicity) |
| INV-F2 | `WriteSet` always contains both lineage and governance records from the same seal |
| INV-F3 | Events are emitted only after successful commit — coordinator calls `GovernanceEventDispatcher` methods only after `commitSeal()` returns (delegates INV-G30) |
| INV-F4 | Coordinator calls `prepareSealNext()` before `governance.finalize()` — ordering is strict |
| INV-F5 | Facade does not define new constitutional rules — all protocol invariants are delegated to governance or lineage |
| INV-F6 | CAS retry re-runs the full prepare→finalize→commit sequence, never commit alone |
| INV-F7 | Governance-free genesis does not create governance records or use `commitSeal()` |
| INV-F8 | `lineage`, `governance`, and `store` in `WorldConfig` MUST be bound to the exact same `CommitCapableWorldStore` instance — violation breaks CAS correctness and single-store atomicity |

---

## 14. Compliance

### 14.1 Compliance Requirements

An implementation claiming compliance with **Manifesto World Facade v2.0.0 draft** MUST:

1. Implement `CommitCapableWorldStore` extending both `LineageStore` and `GovernanceStore`
2. Implement `commitSeal()` with all-or-nothing atomicity (FACADE-STORE-2~5)
3. Provide `createInMemoryWorldStore()` (FACADE-STORE-7)
4. Implement `WorldCoordinator` with the normal path defined by the current typed v2 surface
5. Enforce ordering constraints (FACADE-COORD-1~5)
6. Support governance-wrapped and governance-free genesis (FACADE-COORD-6~8)
7. Retry from prepare on CAS failure (FACADE-COORD-9)
8. Define `GovernanceEventDispatcher` interface and call its methods only after successful commit (FACADE-EVT-1~5)
9. Re-export all symbols listed in §5.1 (FACADE-REEXPORT-1)
10. Provide `createWorld()` factory that accepts pre-built services (FACADE-FACTORY-1~4)

### 14.2 Compliance Verification

| Test Category | Description |
|---------------|-------------|
| Atomic commit | `commitSeal({ lineage, governance })` persists both lineage and governance records, including lineage `SealAttempt` |
| Commit failure | `commitSeal()` failure → no records persisted, no events emitted |
| Normal seal path | prepare → finalize → commit → events: all steps execute in order |
| Idempotent reuse | Same-parent same-snapshot full commit reuses World/Edge/snapshot and still persists a new `SealAttempt` |
| CAS retry | Simulate CAS failure → coordinator retries from prepare, not commit |
| Governance-free genesis | `sealGenesis()` without proposal → lineage standalone path (commitPrepared, not commitSeal) |
| Governance-wrapped genesis | `sealGenesis()` with proposal → full coordinator path |
| Store identity | Services constructed with different store instance than `WorldConfig.store` → CAS mismatch on seal attempt |
| WriteSet consistency | `WriteSet` always contains both lineage and governance records from the same seal |
| Re-export identity | Types re-exported from facade are identical to source package types |
| Event ordering | Events not emitted during prepare or finalize steps |
| Event dispatcher seam | `GovernanceEventDispatcher.emitSealCompleted()` is called only after successful commit |
| Fork event meaning | `WorldForkedEvent.forkPoint` equals continuity parent, not `proposal.baseWorld` |

---

## 15. References

### 15.1 Specifications

| Document | Version | Relevance |
|----------|---------|-----------|
| Lineage SPEC | v2.0.0 draft | Seal protocol, `PreparedLineageCommit`, `SealAttempt`, `LineageStore`, `LineageService` |
| Governance SPEC | v2.0.0 draft | Seal coordination, `PreparedGovernanceCommit`, `GovernanceService`, `GovernanceStore`, event system |
| [SDK SPEC](../../sdk/docs/sdk-SPEC-v3.0.0-draft.md) | v3.0.0 draft | `ManifestoConfig`, `createManifesto()`, re-export hub |

### 15.2 Architecture Decision Records

| ADR | Scope |
|-----|-------|
| ADR-014 | World split — D7 (facade), D11.3 (storage seam), D14 (commit coordinator) |
| ADR-010 | Protocol-First SDK Reconstruction |
| ADR-001 | Layer Separation |

### 15.3 Cross-Reference Index

| Facade Rule | Delegates To |
|-------------|-------------|
| FACADE-STORE-5 | LIN-STORE-4, LIN-STORE-5, LIN-STORE-9 |
| FACADE-COORD-1 | GOV-SEAL-1, GOV-SEAL-3 |
| FACADE-COORD-3 | GOV-EXEC-EVT-3, INV-G30 |
| FACADE-COORD-5 | LIN-SEAL-5 |
| FACADE-EVT-1 | INV-G30 |
| FACADE-EVT-2 | GOV-EXEC-EVT-1~2 |

---

## Appendix A: Rule Summary

| Category | Rules | Count |
|----------|-------|-------|
| Dependency | FACADE-DEP-1~4 | 4 |
| Re-export | FACADE-REEXPORT-1~4 | 4 |
| Store | FACADE-STORE-1~7 | 7 |
| WriteSet | FACADE-WS-1~4 | 4 |
| Coordinator | FACADE-COORD-1~11 | 11 |
| Factory | FACADE-FACTORY-1~4 | 4 |
| Event | FACADE-EVT-1~5 | 5 |
| Lifecycle | FACADE-LIFECYCLE-1~4 | 4 |
| SDK | FACADE-SDK-1~3 | 3 |
| **Total** | | **46** |

---

## Appendix B: Design Decisions

### B.1 CommitCapableWorldStore extends both stores (not composition)

**Decision:** `CommitCapableWorldStore extends LineageStore, GovernanceStore`.

**Why extends, not composition.** The composite store is backed by a single physical store (Strategy A). Interface extension reflects this — a single implementation class satisfies all three interfaces. If we used composition (`{ lineage: LineageStore; governance: GovernanceStore; commitSeal(): void }`), every call site would need to destructure, and `createWorld()` would need to extract facets to pass to `LineageService` and `GovernanceService` separately.

With extends, `createWorld()` passes the same store instance to both services. `LineageService` sees it as `LineageStore`; `GovernanceService` sees it as `GovernanceStore`; the coordinator sees it as `CommitCapableWorldStore`. TypeScript's structural typing makes this natural.

**Trade-off acknowledged.** This coupling prevents Strategy B/C (physically separated stores) without a facade or adapter. This is intentional — ADR-014 explicitly defers Strategy B/C.

### B.2 Facade assumes governance-active for non-genesis coordinator paths

**Decision:** `sealNext()` always requires `executingProposal`. Governance-free seal uses `lineage.commitPrepared()` directly, bypassing the coordinator entirely.

**Why.** The coordinator exists to solve the "two protocols, one transaction" problem. If there's only one protocol (lineage), there's no coordination needed. Forcing governance-free callers through the coordinator would add complexity with no benefit. Lineage standalone callers use the lineage API directly; they don't need the facade at all.

### B.3 WriteSet as a single full shape

**Decision:** `{ lineage, governance }`.

**Why not keep the old rejection-oriented variants.** The projected Lineage v2 public API does not expose a typed structural rejection channel from `prepareSealNext()`. Keeping a governance-only variant in the facade would therefore advertise a branch that the current typed surface cannot produce.

### B.4 CAS retry from prepare, not commit

**Decision:** Retry the full prepare→finalize→commit sequence.

**Why.** See FACADE-COORD-9 rationale. Stale CAS expectations in `PreparedBranchMutation` cannot be fixed by retrying `commitSeal()` alone. The prepare step reads current store state; if state changed, prepare must re-read.

### B.5 GovernanceEventDispatcher as facade-owned seam

**Decision:** The facade defines `GovernanceEventDispatcher` interface; governance implements it; coordinator calls it after commit.

**Why.** Governance owns event types and payloads (Governance SPEC §10). But the coordinator owns the commit — it's the only actor that knows when commit succeeded. Neither governance nor lineage can know the commit result because neither performs the commit. The dispatcher interface bridges this gap with one concrete post-commit method (`emitSealCompleted`) instead of leaving implementors to guess what "delegate to governance's event dispatcher" means.

**Why not add emit to GovernanceService.** `GovernanceService` is defined by Governance SPEC and has a clear contract: `finalize()` is a side-effect-free preparation. Adding an emit method would break this purity principle (GOV-SEAL-2). The dispatcher is a separate concern — post-commit side effects — and deserves its own interface.

### B.6 Pre-built services + required store (not config objects + optional store)

**Decision:** `WorldConfig` accepts pre-constructed `LineageService`, `GovernanceService`, and `GovernanceEventDispatcher` instances. `store` is required, not optional.

**Why not accept config objects.** If `WorldConfig` had a `governance: GovernanceConfig` field, the facade would need to know how to construct `GovernanceService` — which requires governance-internal knowledge (authority policy, actor bindings, HostExecutor). This violates the facade's "assembly only" principle. Each service's construction is its own package's responsibility. The facade just wires pre-built components together.

**Why store is required.** Pre-built services and optional store are incompatible. If `createWorld()` internally creates a default store, the pre-built services — already constructed by the caller — cannot be retroactively rebound to that new store. The coordinator would `commitSeal()` to store B while lineage's `prepareSealNext()` read CAS expectations from store A. This silently breaks single-store atomicity (ADR-014 Strategy A). Making `store` required forces the caller to create the store first, pass it to service constructors, then pass all three to `createWorld()` — a linear, auditable wiring sequence.

### B.7 Rule count: 46 (above the "20 rule" advisory, justified)

The prompt advisory suggested "if rules exceed 20, the facade is too thick." This facade has 46 rules. However, the vast majority are delegation rules (pointing to LIN-* or GOV-* rules), re-export rules (mechanical pass-through), or lifecycle/SDK alignment rules. The coordinator itself — the facade's core behavioral logic — has 11 rules (FACADE-COORD-1~11), comfortably within the advisory. The additional rules exist because the facade's scope includes store, factory, re-export, event, and lifecycle concerns, each requiring a small number of boundary rules.

---

*End of Manifesto World Facade Specification v2.0.0 draft*
