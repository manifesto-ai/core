# Manifesto World Facade Specification

> **Status:** Normative
> **Version:** v2.0.0
> **Package:** `@manifesto-ai/world`
> **Scope:** `@manifesto-ai/world` facade surface for governed composition
> **Compatible with:** Lineage SPEC v2.0.0, Governance SPEC v2.0.0
> **SDK alignment:** [SDK SPEC v2.0.0](../../sdk/docs/sdk-SPEC-v2.0.0.md)
> **Implements:** ADR-014 D7/D11.3/D14, ADR-015, ADR-016
> **Changelog:**
> - **v2.0.0 (2026-03-30):** Super hard-cut current facade contract
>   - `GovernedWorldStore` replaces `CommitCapableWorldStore`
>   - `runInSealTransaction()` becomes the sole canonical seal persistence seam
>   - `WriteSet` and `commitSeal()` are removed from the public contract
>   - execution abstraction ownership moves from Governance to World
>   - SDK/world CTS alignment follows the hard-cut surface

> **Historical Note:** [world-facade-spec-v1.0.0.md](world-facade-spec-v1.0.0.md) is retained as the superseded pre-hard-cut facade baseline.

---

## 1. Purpose

This document specifies the exact next-major façade that remains in `@manifesto-ai/world` after Governance and Lineage become split protocols.

The facade owns only composition:

1. assemble Governance + Lineage into a ready-to-use governed runtime
2. provide the single atomic seal transaction seam
3. coordinate `prepare -> finalize -> transaction -> post-commit dispatch`
4. surface the World-owned execution abstraction used by governed runtimes

The facade does **not** define lineage rules, governance rules, or Host behavior. It assembles those protocols without re-legislating them.

---

## 2. Normative Language

Key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are interpreted as described in RFC 2119.

---

## 3. Scope & Non-Goals

### 3.1 In Scope

| Area | Description |
|------|-------------|
| Re-export policy | What the facade re-exports from Governance and Lineage |
| Governed store | `GovernedWorldStore` and `WorldStoreTransaction` |
| Coordinator | `WorldCoordinator` orchestration |
| Factory | `createWorld()` plus adapter subpaths such as `@manifesto-ai/world/in-memory` |
| Event timing | Post-commit dispatch policy |
| Execution seam | `WorldExecutor`, `WorldExecutionOptions`, `WorldExecutionResult` ownership |
| SDK alignment | Thin top-level surface consumed by SDK |

### 3.2 Explicit Non-Goals

| Non-Goal | Owner |
|----------|-------|
| World identity, hash, branch semantics, restore normalization | Lineage SPEC |
| Proposal lifecycle, authority evaluation, finalize semantics | Governance SPEC |
| Effect execution, patch application, compute semantics | Host / Core |
| Durable backend implementation | Future implementation phase |
| Compatibility aliases for removed world store APIs | Not provided in the current contract |

---

## 4. Dependency Direction

```
@manifesto-ai/world
  ├── imports @manifesto-ai/governance
  └── imports @manifesto-ai/lineage
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-DEP-1 | MAY | Facade MAY import from Governance and Lineage public contracts |
| FACADE-DEP-2 | MUST NOT | Governance MUST NOT import from the facade |
| FACADE-DEP-3 | MUST NOT | Lineage MUST NOT import from the facade |
| FACADE-DEP-4 | MUST NOT | Facade MUST NOT import Host runtime internals directly |

---

## 5. Re-export Policy

### 5.1 Re-exported Symbols

The facade re-exports the public split-native surfaces from:

- `@manifesto-ai/lineage`
- `@manifesto-ai/governance`

with one hard-cut exception:

- execution abstraction ownership is **not** re-exported from Governance because it is World-owned in the current contract

### 5.2 Facade-Owned Exports

The facade owns and exports:

- `GovernedWorldStore`
- `WorldStoreTransaction`
- `WorldCoordinator`
- `GovernanceEventDispatcher`
- `WorldConfig`
- `WorldInstance`
- `WorldExecutor`
- `WorldExecutionOptions`
- `WorldExecutionResult`
- `ExecuteApprovedProposalInput`
- `ResumeExecutingProposalInput`
- `SealedWorldRuntimeCompletion`
- `RecoveredWorldRuntimeCompletion`
- `WorldRuntimeCompletion`
- `WorldRuntime`
- `createWorld()`

### 5.3 Re-export Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-REEXPORT-1 | MUST | Facade MUST re-export the public Governance and Lineage surfaces needed for governed composition |
| FACADE-REEXPORT-2 | MUST NOT | Facade MUST NOT re-export internal implementation types |
| FACADE-REEXPORT-3 | MUST | Re-exported split-native types MUST remain pass-through so type identity is preserved |
| FACADE-REEXPORT-4 | SHOULD | Facade SHOULD use direct re-exports where possible |

---

## 6. Governed Store

### 6.1 Purpose

When governance and lineage participate in the same seal, their terminal writes must be committed atomically. The facade therefore owns a transaction seam rather than a convenience commit wrapper.

### 6.2 Interface

```typescript
interface WorldStoreTransaction {
  commitPrepared(prepared: PreparedLineageCommit): Promise<void>;
  putProposal(proposal: Proposal): Promise<void>;
  putDecisionRecord(record: DecisionRecord): Promise<void>;
}

interface GovernedWorldStore extends LineageStore, GovernanceStore {
  runInSealTransaction<T>(work: (tx: WorldStoreTransaction) => Promise<T>): Promise<T>;
}
```

The hard-cut contract treats governed persistence as async so browser-first adapters such as IndexedDB remain first-class targets without another API break.

### 6.3 Store Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-STORE-1 | MUST | `GovernedWorldStore` MUST extend both `LineageStore` and `GovernanceStore` |
| FACADE-STORE-2 | MUST | `runInSealTransaction()` MUST be atomic — all terminal writes or none |
| FACADE-STORE-3 | MUST | The canonical governed seal path MUST persist lineage commit records, governance proposal/decision records, and lineage `SealAttempt` persistence inside one transaction |
| FACADE-STORE-7 | MUST | World package MUST provide an in-memory `GovernedWorldStore` through the dedicated `@manifesto-ai/world/in-memory` subpath |

### 6.4 Store Factories

```typescript
// @manifesto-ai/world/in-memory
function createInMemoryWorldStore(): GovernedWorldStore;

// @manifesto-ai/world/indexeddb
function createIndexedDbWorldStore(options?: IndexedDbWorldStoreOptions): IndexedDbGovernedWorldStore;

// @manifesto-ai/world/sqlite
function createSqliteWorldStore(options?: SqliteWorldStoreOptions): SqliteGovernedWorldStore;
```

The in-memory implementation is a driver-backed reference adapter for tests and local composition. IndexedDB is the browser-first durable adapter. SQLite remains a local/server-side reference adapter that preserves the same async seam.

Concrete store adapters are intentionally not part of the top-level `@manifesto-ai/world` export surface. All three factories preserve the same `GovernedWorldStore` contract and therefore remain swappable beneath `WorldRuntime` and `WorldCoordinator`.

### 6.5 Durable Direction

Future durable adapters MUST preserve the same `GovernedWorldStore` semantics.

- Atomic seal transactions MUST continue to cover lineage terminal writes plus governance proposal/decision writes
- Lineage branch CAS failures MUST surface faithfully through the world store seam
- Restore/recovery semantics MUST preserve the same lineage/governance meaning as the in-memory reference adapter

IndexedDB in the browser is the canonical durable target. A SQLite-backed adapter is acceptable for local testing and server-side composition as long as it preserves the same async transaction and CAS semantics.

---

## 7. World-Owned Execution Boundary

### 7.1 Ownership

World owns the execution abstraction consumed by governed runtimes. Governance does not define these interfaces in the hard-cut contract.

### 7.2 Types

```typescript
interface WorldExecutionOptions {
  readonly approvedScope?: unknown;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

interface WorldExecutionResult {
  readonly outcome: "completed" | "failed";
  readonly terminalSnapshot: Snapshot;
  readonly traceRef?: ArtifactRef;
  readonly error?: NonNullable<Snapshot["system"]["lastError"]>;
}

interface WorldExecutor {
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: WorldExecutionOptions
  ): Promise<WorldExecutionResult>;

  abort?(key: ExecutionKey): void;
}
```

World defines this seam and app/runtime code implements it using Host.

---

## 8. Coordinator Orchestration Protocol

### 8.1 Overview

The coordinator owns the façade’s only behavior:

1. prepare lineage
2. finalize governance
3. persist through `runInSealTransaction()`
4. emit post-commit governance events

### 8.2 Interface

```typescript
interface WorldCoordinator {
  sealNext(params: CoordinatorSealNextParams): SealResult;
  sealGenesis(params: CoordinatorSealGenesisParams): SealResult;
}
```

### 8.3 Ordering Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-COORD-1 | MUST | `lineage.prepareSealNext()` MUST run before `governance.finalize()` |
| FACADE-COORD-2 | MUST | `governance.finalize()` MUST complete before `runInSealTransaction()` starts |
| FACADE-COORD-3 | MUST | Events MUST be emitted only after the seal transaction succeeds |
| FACADE-COORD-5 | MUST | Governed seal paths MUST NOT call `lineage.commitPrepared()` directly |

### 8.4 Genesis Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-COORD-6 | MUST | Governed genesis MUST use the same prepare -> finalize -> transaction -> dispatch pattern |
| FACADE-COORD-7 | MUST | Standalone genesis MUST delegate directly to `lineage.prepareSealGenesis()` + `lineage.commitPrepared()` |
| FACADE-COORD-8 | MUST NOT | Standalone genesis MUST NOT create governance records or use the governed transaction seam |

### 8.5 Retry Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-COORD-9 | MUST | On CAS failure, the coordinator MUST retry from `prepareSealNext()` rather than retrying only the transaction |
| FACADE-COORD-10 | SHOULD | Coordinator SHOULD use bounded retries |
| FACADE-COORD-11 | MUST | Each retry iteration MUST re-run prepare -> finalize -> transaction |

---

## 9. createWorld() Entrypoint

### 9.1 Signature

```typescript
interface WorldConfig {
  readonly store: GovernedWorldStore;
  readonly lineage: LineageService;
  readonly governance: GovernanceService;
  readonly eventDispatcher: GovernanceEventDispatcher;
  readonly executor: WorldExecutor;
}

interface WorldInstance {
  readonly coordinator: WorldCoordinator;
  readonly runtime: WorldRuntime;
  readonly lineage: LineageService;
  readonly governance: GovernanceService;
  readonly store: GovernedWorldStore;
}

function createWorld(config: WorldConfig): WorldInstance;
```

### 9.2 Factory Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-FACTORY-1 | MUST | `createWorld()` MUST return a ready-to-use façade instance |
| FACADE-FACTORY-2 | MUST | `createWorld()` MUST retain the exact provided store instance |
| FACADE-FACTORY-3 | MUST | Caller MUST bind `store`, `lineage`, and `governance` to the same physical store instance |
| FACADE-FACTORY-4 | MUST | `createWorld()` MUST expose the provided service instances and assembled runtime facets without wrapping or replacement |

### 9.3 Runtime Surface

```typescript
interface ExecuteApprovedProposalInput {
  readonly proposal: Proposal;
  readonly completedAt: number;
  readonly executionOptions?: WorldExecutionOptions;
}

interface ResumeExecutingProposalInput {
  readonly proposal: Proposal;
  readonly resumeSnapshot: Snapshot;
  readonly completedAt: number;
  readonly executionOptions?: WorldExecutionOptions;
}

interface SealedWorldRuntimeCompletion {
  readonly kind: "sealed";
  readonly proposal: Proposal;
  readonly execution: WorldExecutionResult;
  readonly resultWorld: WorldId;
  readonly terminalStatus: TerminalStatus;
  readonly lineageCommit: PreparedLineageCommit;
  readonly governanceCommit: PreparedGovernanceCommit;
  readonly sealResult: SealResult;
}

interface RecoveredWorldRuntimeCompletion {
  readonly kind: "recovered";
  readonly proposal: Proposal;
  readonly execution: WorldExecutionResult;
  readonly resultWorld: WorldId;
  readonly terminalStatus: TerminalStatus;
}

type WorldRuntimeCompletion =
  | SealedWorldRuntimeCompletion
  | RecoveredWorldRuntimeCompletion;

interface WorldRuntime {
  executeApprovedProposal(
    input: ExecuteApprovedProposalInput
  ): Promise<WorldRuntimeCompletion>;
  resumeExecutingProposal(
    input: ResumeExecutingProposalInput
  ): Promise<WorldRuntimeCompletion>;
}
```

### 9.4 Runtime Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-RUNTIME-1 | MUST | `WorldRuntime` MUST load the base snapshot from `proposal.baseWorld` in lineage before execution |
| FACADE-RUNTIME-2 | MUST | `WorldRuntime` MUST pass through `proposal.executionKey`, `proposal.intent`, and effective execution options to `WorldExecutor` |
| FACADE-RUNTIME-3 | MUST | After execution, `WorldRuntime` MUST drive the same governed seal path that persists lineage and governance records atomically |
| FACADE-RUNTIME-4 | MUST | `executeApprovedProposal()` MUST reject proposals that are not already in `executing` status |
| FACADE-RUNTIME-5 | MUST | `WorldExecutor.outcome` MUST agree with the terminal snapshot outcome derived by Governance before sealing |
| FACADE-RUNTIME-6 | MUST | `WorldRuntime` MUST expose an explicit `resumeExecutingProposal()` recovery entrypoint |
| FACADE-RUNTIME-7 | MUST | Only truly terminal `resumeSnapshot` values (`system.status === 'idle'` or `'error'` with zero pending requirements) MAY be sealed directly; all other statuses MUST resume through `WorldExecutor` |
| FACADE-RUNTIME-8 | MUST | When store state already contains a terminal proposal with `resultWorld`, runtime replay MUST converge to a `recovered` completion without duplicate execution or duplicate event emission |
| FACADE-RUNTIME-9 | MUST | When `resumeSnapshot` is non-terminal, `resumeExecutingProposal()` MUST resume from `resumeSnapshot` rather than reloading `proposal.baseWorld` |
| FACADE-RUNTIME-10 | MUST | Runtime MUST reject stale executing proposals whose branch head or epoch no longer matches `proposal.baseWorld` / `proposal.epoch` |
| FACADE-RUNTIME-11 | MUST | Runtime MUST reject proposals whose execution-stage ownership/currentness disappears before dispatch, and when a seal race loses to another writer that already committed the same proposal it MUST converge to a `recovered` completion rather than re-emitting or partially re-sealing |
| FACADE-RUNTIME-12 | MUST | When an execution `AbortSignal` fires while `WorldExecutor.execute()` is in flight, runtime MUST forward it to `WorldExecutor.abort()` if that hook exists |
| FACADE-RUNTIME-13 | MUST | Post-commit event dispatch failures MUST surface to the caller and MUST NOT be converted into `recovered` runtime completions |

---

## 10. Event Emission Policy

### 10.1 Dispatcher Surface

```typescript
interface GovernanceEventDispatcher {
  emitSealCompleted(
    governanceCommit: PreparedGovernanceCommit,
    lineageCommit: PreparedLineageCommit
  ): void;
}
```

### 10.2 Event Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-EVT-1 | MUST | Dispatcher activation MUST happen only after a successful seal transaction |
| FACADE-EVT-2 | MUST | Successful governed seals MUST use `emitSealCompleted()` exactly once |
| FACADE-EVT-3 | MUST | Dispatcher implementation consumed by the facade remains a pass-through Governance surface |
| FACADE-EVT-5 | MUST NOT | Dispatcher MUST NOT be invoked during prepare/finalize pre-commit phases |

---

## 11. Facade Lifecycle

The façade remains the canonical top-level governed composition package in the split-protocol era. Deprecated compatibility names are intentionally not preserved in the current contract.

---

## 12. SDK Alignment

The SDK remains thin and re-exports only the top-level façade surface needed for explicit governed composition.

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-SDK-1 | MUST | SDK MUST surface `GovernedWorldStore` as the canonical governed store type |
| FACADE-SDK-2 | MUST | SDK MUST expose only `createWorld()` from top-level `@manifesto-ai/world` and MUST NOT re-export concrete store adapter implementations |

SDK does **not** re-export the removed `CommitCapableWorldStore`, `WriteSet`, or any compatibility alias.

---

## 13. Invariants

| ID | Invariant |
|----|-----------|
| INV-F1 | Governed seal persistence is atomic |
| INV-F2 | Governed seal transactions always carry both lineage and governance terminal writes |
| INV-F3 | Post-commit events are emitted only after successful persistence |
| INV-F4 | Standalone genesis never enters the governed transaction seam |
| INV-F5 | World owns the execution abstraction; Governance does not |
| INV-F6 | SDK thin surface matches the hard-cut façade names |

---

## 14. Compliance

An implementation claiming compliance with this contract MUST:

1. implement the façade-owned types in §5.2, §6.2, §7.2, §8.2, §9.1, §9.3, and §10.1
2. satisfy all `FACADE-STORE-*`, `FACADE-COORD-*`, `FACADE-EVT-*`, `FACADE-FACTORY-*`, `FACADE-RUNTIME-*`, and `FACADE-SDK-*` MUST rules listed above
3. preserve split-native type identity for all re-exported Governance and Lineage surfaces
4. avoid compatibility aliases for removed `WriteSet` and `commitSeal()` concepts

---

## 15. References

- [ADR-014: Split World Protocol](../../../docs/internals/adr/014-split-world-protocol.md)
- [ADR-015: Snapshot Ontological Purification](../../../docs/internals/adr/015-snapshot-ontological-purification.md)
- [ADR-016: Merkle Tree Lineage](../../../docs/internals/adr/016-merkle-tree-lineage.md)
- [Governance SPEC v2.0.0](../../governance/docs/governance-SPEC-2.0.0v.md)
- [Lineage SPEC v2.0.0](../../lineage/docs/lineage-SPEC-2.0.0v.md)
- [SDK SPEC v2.0.0](../../sdk/docs/sdk-SPEC-v2.0.0.md)
