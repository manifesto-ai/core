# Manifesto Governance Protocol Specification

> **Status:** Superseded Historical Contract
> **Version:** v1.0.0
> **Package:** `@manifesto-ai/governance`
> **Scope:** All Manifesto Governance Implementations
> **Compatible with:** Core SPEC v3.0.0, Lineage SPEC v1.0.1, ADR-014 (Split World Protocol)
> **Extracted from:** World SPEC v2.0.5 (§5.6–5.7, §6, §7.1–7.7, §8, §10.1–10.2, §10.5–10.7)
> **Authors:** Manifesto Team
> **License:** MIT
> **Historical Note:** This document is retained as the initial split-native governance baseline. The current governance decorator contract now lives in [governance-SPEC-v3.0.0-draft.md](governance-SPEC-v3.0.0-draft.md).

---

## Changelog

| Version | Summary | Key Decisions |
|---------|---------|---------------|
| v1.0.0 | Initial release — extracted from World SPEC v2.0.5 per ADR-014 | ADR-014 D3, D8, D9, D10, D12, D13 |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Normative Language](#2-normative-language)
3. [Scope & Non-Goals](#3-scope--non-goals)
4. [Boundary](#4-boundary)
5. [Governance Entities](#5-governance-entities)
6. [Proposal Lifecycle](#6-proposal-lifecycle)
7. [Single-Writer Gate & Epoch-Based Ingress Control](#7-single-writer-gate--epoch-based-ingress-control)
8. [Host Integration Contract](#8-host-integration-contract)
9. [Seal Coordination](#9-seal-coordination)
10. [Event System](#10-event-system)
11. [GovernanceStore](#11-governancestore)
12. [Invariants](#12-invariants)
13. [Compliance](#13-compliance)
- [Appendix A: Rule Retagging Mapping](#appendix-a-rule-retagging-mapping)
- [Appendix B: Rule Summary](#appendix-b-rule-summary)

---

## 1. Purpose

This document defines the **Manifesto Governance Protocol** — the **Legitimacy Engine** of the Manifesto architecture.

Governance governs:
- **Who** may propose changes to a world (Actor, Authority)
- **How** proposals are judged (Authority, DecisionRecord)
- **How** proposals progress from submission to terminal (Proposal lifecycle)
- **How** execution results are sealed as terminal judgments (Seal coordination)
- **What** events are emitted for governance decisions (Event system)

Governance **does not** govern:
- **How** worlds are identified (deterministic hash — see Lineage SPEC)
- **How** worlds form a reproducible history (DAG, append-only — see Lineage SPEC)
- **How** worlds are stored, restored, or resumed (persistence, branch, head — see Lineage SPEC)

Governance requires lineage. Lineage does not require governance.

This document is **normative**.

---

## 2. Normative Language

Key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are interpreted as described in RFC 2119.

---

## 3. Scope & Non-Goals

### 3.1 In Scope

| Area | Description |
|------|-------------|
| Actor / Authority model | ActorRef, AuthorityRef, ActorAuthorityBinding, AuthorityPolicy |
| Proposal lifecycle | Intent, Proposal, ProposalStatus, DecisionRecord, state machine |
| Ingress / Execution staging | Stage classification, cancellation semantics |
| Single-writer gate | At most one execution-stage proposal per branch |
| Epoch-based ingress control | Stale proposal invalidation, gate-release revalidation |
| HostExecutor interface | Defined by governance, implemented by App |
| ExecutionKey contract | Key policy, serialization context |
| Outcome derivation | `deriveOutcome()` — must agree with lineage's `deriveTerminalStatus()` |
| Terminal snapshot validity | `pendingRequirements` checks |
| BaseWorld policy | Active branch head constraint |
| Re-entry model | Multi-compute execution alignment |
| Context determinism | Host determinism alignment |
| Event system | Governance result events ownership, types, payloads, subscription, scheduling |
| GovernanceStore | Persistence contract for governance audit data |
| Seal coordination | `governance.finalize()` contract, `PreparedGovernanceCommit` |

### 3.2 Explicit Non-Goals

| Non-Goal | Reason |
|----------|--------|
| World identity computation | Lineage SPEC responsibility (LIN-ID-*) |
| Hash canonicalization / snapshotHash | Lineage SPEC responsibility (LIN-HASH-*) |
| TerminalStatus derivation | Lineage SPEC responsibility (LIN-SEAL-1~3) |
| Branch model / head advance | Lineage SPEC responsibility (LIN-HEAD-*, LIN-BRANCH-*) |
| Persistence of lineage records | Lineage SPEC responsibility (LIN-STORE-*) |
| Resume / replay | Lineage SPEC responsibility (LIN-RESUME-*) |
| Commit coordination | Facade SPEC responsibility (Strategy A) |
| Multi-store reconciliation | Deferred to future ADR (ADR-014 §6) |

---

## 4. Boundary

### 4.1 Governance's "Does NOT Know" Boundary

| Governance Does NOT Know | Rule ID |
|--------------------------|---------|
| Lineage internal store structure | GOV-BOUNDARY-1 |
| `createWorldRecord()` algorithm | GOV-BOUNDARY-2 |
| Hash canonicalization details | GOV-BOUNDARY-3 |
| Branch CAS semantics | GOV-BOUNDARY-4 |
| Host internals, TraceEvent structure | GOV-BOUNDARY-5 |
| Core internals (status vocabulary, compute iterations) | GOV-BOUNDARY-6 |

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-BOUNDARY-1 | MUST NOT | Governance MUST NOT access lineage internal store structure |
| GOV-BOUNDARY-2 | MUST NOT | Governance MUST NOT replicate `createWorldRecord()` logic |
| GOV-BOUNDARY-3 | MUST NOT | Governance MUST NOT compute `snapshotHash` or `worldId` |
| GOV-BOUNDARY-4 | MUST NOT | Governance MUST NOT directly mutate branch state |
| GOV-BOUNDARY-5 | MUST NOT | Governance MUST NOT import Host internal types |
| GOV-BOUNDARY-6 | MUST NOT | Governance MUST NOT match specific `system.status` string values (Core-owned vocabulary) |

### 4.2 Dependency Direction

Per ADR-014 D4 (SPLIT-DEP-2):

> **`governance → lineage` only. Never the reverse.**

```
┌─────────────────────────┐
│   @manifesto-ai/governance   │──── imports ────►┌─────────────────────┐
│   (Legitimacy Engine)        │                  │ @manifesto-ai/lineage│
└─────────────────────────┘                  │ (Continuity Engine) │
                                                   └─────────────────────┘
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-DEP-1 | MAY | Governance MAY import from `@manifesto-ai/lineage` |
| GOV-DEP-2 | MUST NOT | Governance MUST NOT import from `@manifesto-ai/core` directly for hash/identity purposes (use lineage's public API) |

### 4.3 What Governance Imports from Lineage

Governance imports **only** the public contract from Lineage SPEC v1.0.1:

| Import | Purpose |
|--------|---------|
| `WorldId`, `BranchId`, `ProvenanceRef` | Identity types |
| `World`, `WorldEdge` | Record types (read-only reference) |
| `BranchInfo` | Branch public view — epoch read path for governance (GOV-EPOCH-2) |
| `TerminalStatus` | For GOV-SEAL-1 cross-verification |
| `PreparedLineageCommit` (discriminated union) | Input to `governance.finalize()` |
| `deriveTerminalStatus()` | For GOV-SEAL-1 cross-verification (optional — governance MAY use its own `deriveOutcome()` and compare) |
| `LineageService` | For `prepareSealNext()` / `prepareSealGenesis()` delegation, branch/epoch queries |
| `SealNextInput`, `SealGenesisInput` | For constructing seal inputs |

Governance MUST NOT import: `LineageStore`, `createWorldRecord()`, `SnapshotHashInput`, `computeHash()`, `PreparedBranchMutation`, or any internal implementation detail.

---

## 5. Governance Entities

### 5.1 Actor

```typescript
type ActorKind = 'human' | 'agent' | 'system';

type ActorRef = {
  readonly actorId: ActorId;
  readonly kind: ActorKind;
  readonly name?: string;
  readonly meta?: Record<string, unknown>;
};
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-ACTOR-1 | MUST | All actors (human, agent, system) are first-class citizens |
| GOV-ACTOR-2 | MUST | Actor identity MUST be stable across proposals |

### 5.2 Authority

```typescript
type AuthorityKind = 'auto' | 'human' | 'policy' | 'tribunal';

type AuthorityRef = {
  readonly authorityId: AuthorityId;
  readonly kind: AuthorityKind;
  readonly name?: string;
};

type AuthorityPolicy =
  | { readonly mode: 'auto_approve' }
  | { readonly mode: 'hitl'; readonly delegate: ActorRef }
  | { readonly mode: 'policy_rules'; readonly rules: unknown }
  | { readonly mode: 'tribunal'; readonly members: ActorRef[] };
```

### 5.3 Actor-Authority Binding

```typescript
type ActorAuthorityBinding = {
  readonly actorId: ActorId;
  readonly authorityId: AuthorityId;
  readonly policy: AuthorityPolicy;
};
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-BIND-1 | MUST | Each Actor MUST have exactly one Authority binding |
| GOV-BIND-2 | MAY | Multiple Actors MAY share the same Authority |

---

## 6. Proposal Lifecycle

### 6.1 Intent

```typescript
type Intent = {
  readonly type: string;
  readonly intentId: string;  // stable within execution attempt
  readonly input?: unknown;
};
```

### 6.2 Proposal

```typescript
type ProposalStatus =
  // Ingress Stage (epoch-droppable)
  | 'submitted'
  | 'evaluating'
  // Decision Boundary
  | 'approved'
  | 'rejected'
  // Execution Stage (must run to terminal)
  | 'executing'
  // Terminal
  | 'completed'
  | 'failed'
  | 'superseded';    // Ingress-terminal: stale proposal invalidated before execution

type SupersedeReason =
  | 'branch_switch'     // epoch incremented by branch switch
  | 'head_advance'      // epoch incremented by head advance (GOV-BRANCH-GATE-6)
  | 'manual_cancel';    // explicit cancellation by caller

type Proposal = {
  readonly proposalId: ProposalId;
  readonly baseWorld: WorldId;

  // Branch identity (ADR-014 D12)
  readonly branchId: BranchId;

  readonly actorId: ActorId;
  readonly authorityId: AuthorityId;

  readonly intent: Intent;
  readonly status: ProposalStatus;

  // ExecutionKey
  readonly executionKey: ExecutionKey;

  // Timestamps
  readonly submittedAt: number;
  readonly decidedAt?: number;
  readonly completedAt?: number;

  // Decision reference
  readonly decisionId?: DecisionId;

  // Epoch for ingress cancellation
  readonly epoch: number;

  // Terminal result
  readonly resultWorld?: WorldId;

  // Supersede reason (present iff status === 'superseded')
  readonly supersededReason?: SupersedeReason;
};
```

**`branchId` is a persisted field (ADR-014 D12).** When a proposal is submitted, the target branch is recorded in the proposal. This field serves three purposes: (1) the seal coordinator uses it to construct the lineage `SealNextInput.branchId`, (2) the single-writer gate (§7) checks execution-stage occupancy per branch, (3) events include `branchId` for observability.

### 6.3 DecisionRecord

```typescript
type FinalDecision =
  | { readonly kind: 'approved' }
  | { readonly kind: 'rejected'; readonly reason?: string };

type DecisionRecord = {
  readonly decisionId: DecisionId;
  readonly proposalId: ProposalId;
  readonly authorityId: AuthorityId;
  readonly decision: FinalDecision;
  readonly decidedAt: number;
};
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-DECISION-1 | MUST | DecisionRecord is created ONLY for terminal decisions (approved/rejected) |
| GOV-DECISION-2 | MUST NOT | `evaluating` status MUST NOT create DecisionRecord |

### 6.4 Ingress vs Execution Stage

| Stage | Statuses | Cancellation | World Creation |
|-------|----------|--------------|----------------|
| **Ingress** | `submitted`, `evaluating` | Safe to supersede (epoch-based) | None |
| **Execution** | `approved`, `executing` | MUST run to terminal | Always |
| **Ingress-terminal** | `rejected`, `superseded` | N/A | None |
| **Execution-terminal** | `completed`, `failed` | N/A | Yes |

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-STAGE-1 | MUST | `submitted` and `evaluating` are Ingress stage |
| GOV-STAGE-2 | MUST | `approved`, `executing`, `completed`, `failed` are Execution stage or Execution-terminal |
| GOV-STAGE-3 | MUST | Ingress-stage proposals with stale epoch MUST transition to `superseded` |
| GOV-STAGE-4 | MUST NOT | Execution-stage proposals MUST NOT be dropped or superseded; MUST reach Execution-terminal |
| GOV-STAGE-5 | MUST | `rejected` is Ingress-terminal (no World created) |
| GOV-STAGE-6 | MUST NOT | Late-arriving evaluating/decision results for stale (old epoch) proposals MUST NOT be applied to current branch |
| GOV-STAGE-7 | MUST | `superseded` is Ingress-terminal (no World created, no DecisionRecord created). The proposal MUST record `supersededReason` |

### 6.5 State Machine

```
                    ┌─────────────────────────────────────────────┐
                    │         INGRESS STAGE                       │
                    │                                             │
   submitProposal() │   submitted                                 │
        ────────────┼──────►│                                     │
                    │       │ routeToAuthority()                  │
                    │       ▼                                     │
                    │   evaluating ─────────────────┬─────────────┼───► rejected
                    │       │                       │             │     (Ingress-terminal)
                    │       │                       │             │
                    │  [stale epoch / stale base]   │ reject()    │
                    │       │         │             │             │
                    │       ▼         ▼             │             │
                    │   superseded ◄──── submitted  │             │
                    │   (Ingress-terminal,          │             │
                    │    no World, no Decision)     │             │
                    └───────┼───────────────────────┼─────────────┘
                            │ approve()             │
                            │ (gate-5 revalidation  │
                            │  passes)              │
  ══════════════════════════╪═══════════════════════╧═══════════  COMMITMENT BOUNDARY
                            │                                      (DecisionRecord created)
                    ┌───────┼─────────────────────────────┐
                    │       ▼    EXECUTION STAGE          │
                    │   approved                          │
                    │       │ startExecution()            │
                    │       ▼                             │
                    │   executing                         │
                    │       │                             │
                    │       ├───────────────────┬─────────┤
                    │       │ success           │ failure │
                    │       ▼                   ▼         │
                    │   completed            failed       │
                    │   (World sealed)      (World sealed) │
                    └─────────────────────────────────────┘
```

### 6.6 Status Transition Rules

| From | To | Trigger | DecisionRecord? |
|------|-----|---------|-----------------|
| `submitted` | `evaluating` | routeToAuthority() | No |
| `submitted` | `rejected` | immediate rejection | Yes |
| `submitted` | `superseded` | stale epoch detected | No |
| `evaluating` | `approved` | Authority approves (gate-5 passes) | Yes |
| `evaluating` | `rejected` | Authority rejects | Yes |
| `evaluating` | `superseded` | stale epoch or stale base at gate release | No |
| `approved` | `executing` | startExecution() | No |
| `executing` | `completed` | Host returns success | No |
| `executing` | `failed` | Host returns failure | No |

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-TRANS-1 | MUST | Status transitions MUST be monotonic (never reverse) |
| GOV-TRANS-2 | MUST | Only `evaluating → approved`, `evaluating → rejected`, or `submitted → rejected` create DecisionRecord |
| GOV-TRANS-3 | MUST | Transitions to `superseded` MUST NOT create DecisionRecord |
| GOV-TRANS-4 | MUST | Transitions to `superseded` are only valid from Ingress-stage statuses (`submitted`, `evaluating`) |

---

## 7. Single-Writer Gate & Epoch-Based Ingress Control

### 7.1 Single-Writer Gate

Per ADR-014 D13: at most one execution-stage proposal per branch at a time.

The single-writer gate prevents two proposals from concurrently executing against the same branch head. Without this gate, two approved proposals on the same branch could both see the same head, execute in parallel, and produce conflicting histories when both attempt to advance the head.

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-BRANCH-GATE-1 | MUST | At most one proposal per branch MAY be in execution stage (`approved` or `executing`) at any time |
| GOV-BRANCH-GATE-2 | MUST | If a proposal is in execution stage for a branch, new proposals for that branch MUST remain in ingress stage until the executing proposal reaches terminal |
| GOV-BRANCH-GATE-3 | MUST | The gate check MUST use `proposal.branchId` to identify the target branch |
| GOV-BRANCH-GATE-4 | MUST | The gate MUST be enforced at the `evaluating → approved` transition (gate release) |

### 7.2 Gate Release Revalidation

When an ingress-stage proposal transitions to `approved` (gate release), governance MUST revalidate the proposal against the current branch state. Between submission and approval, the branch head may have advanced (due to another proposal completing), making the proposal's `baseWorld` stale.

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-BRANCH-GATE-5 | MUST | At gate release (`evaluating → approved`), governance MUST verify that `proposal.baseWorld` equals the current branch head. If the head has advanced, the proposal's base is stale and the proposal MUST be superseded with reason `head_advance` |
| GOV-BRANCH-GATE-6 | MUST | After a successful head advance on a branch, all ingress-stage proposals for that branch whose `epoch` is less than the new branch epoch MUST be invalidated. Invalidated proposals transition to superseded with reason `head_advance` |
| GOV-BRANCH-GATE-7 | MUST | If an authority decision arrives for a proposal whose epoch is stale (less than the branch's current epoch), the decision MUST be discarded. The proposal MUST NOT transition to `approved` or `rejected` based on a stale-epoch decision |

**Sequence: head advance → stale invalidation.**

```
Branch B at epoch E, head H₁
  │
  ├─ Proposal P₁ (branchId=B, epoch=E, baseWorld=H₁) in execution stage
  ├─ Proposal P₂ (branchId=B, epoch=E, baseWorld=H₁) in ingress stage
  │
  │── P₁ completes → lineage seals World H₂ → head advances to H₂ → epoch becomes E+1
  │
  │   GOV-BRANCH-GATE-6: P₂.epoch (E) < branch epoch (E+1)
  │     → P₂ superseded (reason: head_advance)
  │
  │── Meanwhile, authority decision for P₂ arrives (from before head advance)
  │   GOV-BRANCH-GATE-7: P₂.epoch (E) < branch epoch (E+1)
  │     → Decision discarded, P₂ already superseded
```

**Why `head_advance` is a supersede reason.** When the head advances, the branch epoch increments (LIN-EPOCH-2, LIN-HEAD-ADV-4). Any ingress proposal captured at the old epoch was based on a world that is no longer the branch head. Even if the proposal were approved, its `baseWorld` would fail the `LIN-BRANCH-SEAL-2` check at seal time (`branchId`'s current head MUST equal `baseWorldId`). Superseding at the governance level (rather than waiting for a lineage seal rejection) gives clear diagnostic feedback and prevents wasted authority evaluation work.

### 7.3 Proposal Branch Identity

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-BRANCH-1 | MUST | `Proposal.branchId` MUST be set at proposal creation time |
| GOV-BRANCH-2 | MUST NOT | `Proposal.branchId` MUST NOT be changed after creation |
| GOV-BRANCH-3 | MUST | When constructing `SealNextInput` for lineage, the coordinator MUST use `proposal.branchId` |

### 7.4 Epoch-Based Ingress Cancellation

Governance reads the branch epoch from lineage via the `LineageService` public contract. The epoch is owned and incremented by lineage; governance only consumes it. Governance MUST NOT access `LineageStore` directly — it reads epoch through the service layer.

```typescript
// Governance reads epoch via LineageService (public contract)
// NOT via LineageStore.getBranchEpoch() (internal — GOV-BOUNDARY-1)

// For active branch:
const activeBranch = lineageService.getActiveBranch();
const activeEpoch = activeBranch.epoch;

// For any branch by id (needed for parallel branch gate checks):
const branch = lineageService.getBranch(proposal.branchId);
const branchEpoch = branch!.epoch;
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-EPOCH-1 | MUST | Each Proposal MUST record its epoch at submission (the branch's epoch at that moment, read via `LineageService`) |
| GOV-EPOCH-2 | MUST | Governance MUST read the current epoch from `LineageService` public contract, not maintain its own counter, and MUST NOT access `LineageStore` directly |
| GOV-EPOCH-3 | MUST | Ingress-stage proposals with stale epoch MUST transition to `superseded` with the appropriate `SupersedeReason` |
| GOV-EPOCH-4 | MUST | Late-arriving authority results for stale proposals MUST be discarded |
| GOV-EPOCH-5 | MUST | `proposal:superseded` event MUST be emitted when a proposal transitions to `superseded` |

**Note on `SupersedeReason`.** The `SupersedeReason` type is defined in §6.2 alongside `Proposal`. Every transition to `superseded` MUST set `proposal.supersededReason`.

---

## 8. Host Integration Contract

### 8.1 HostExecutor Interface

Per **ADR-001** and **FDR-W028**:

> **Governance defines the interface; App implements it.**

```typescript
/**
 * HostExecutor: The contract through which Governance accesses execution.
 *
 * Ownership:
 * - DEFINED BY: Governance (this specification)
 * - IMPLEMENTED BY: App (Composition Root)
 *
 * Governance declares what it needs; App fulfills using Host.
 * Governance never sees Host internals.
 */
interface HostExecutor {
  /**
   * Execute an intent against a base snapshot under an ExecutionKey.
   *
   * Contract:
   * - ExecutionKey is opaque to Host (GOV-EXK-3)
   * - Host serializes via mailbox per ExecutionKey
   * - Returns terminal snapshot (completed or failed)
   * - Governance receives ONLY the result, not process details
   */
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: HostExecutionOptions
  ): Promise<HostExecutionResult>;

  /**
   * Abort execution for a key (best-effort, optional).
   *
   * If implemented, cancellation MUST still converge to a terminal proposal status.
   * For execution-stage proposals this means terminal `failed` (never dropped).
   */
  abort?(key: ExecutionKey): void;
}

type HostExecutionOptions = {
  readonly approvedScope?: unknown;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};

type HostExecutionResult = {
  /**
   * Convenience hint from App. Governance MUST verify via deriveOutcome(terminalSnapshot).
   * This field exists for fast-path optimization; Governance's deriveOutcome() is authoritative.
   */
  readonly outcome: 'completed' | 'failed';
  readonly terminalSnapshot: Snapshot;
  readonly traceRef?: ArtifactRef;
  readonly error?: ErrorValue;
};
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-HEXEC-1 | MUST | Governance MUST define HostExecutor interface (this SPEC) |
| GOV-HEXEC-2 | MUST NOT | Governance MUST NOT implement HostExecutor |
| GOV-HEXEC-3 | MUST | App MUST implement HostExecutor using Host |
| GOV-HEXEC-4 | MUST | Governance MUST receive HostExecutor via injection |
| GOV-HEXEC-5 | MUST NOT | Governance MUST NOT import Host internal types |
| GOV-HEXEC-6 | MUST | Governance's `deriveOutcome(terminalSnapshot)` is authoritative; `result.outcome` is advisory |
| GOV-HEXEC-7 | MUST | If `abort()` is used for execution-stage work, proposal MUST still reach terminal (`failed`), consistent with GOV-STAGE-4 |

### 8.2 ExecutionKey Contract

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-EXK-1 | MUST | Governance MUST determine executionKey for each Proposal before execution |
| GOV-EXK-2 | MUST | executionKey MUST be fixed in Proposal record (immutable once set) |
| GOV-EXK-3 | MUST | Host MUST treat executionKey as opaque |
| GOV-EXK-4 | MAY | Governance MAY map multiple proposals to the same executionKey to enforce serialization policy |
| GOV-EXK-5 | RECOMMENDED | The default policy is RECOMMENDED: `executionKey = ${proposalId}:1` |

**ExecutionKey Policy Context:**

```typescript
type ExecutionKeyContext = {
  readonly proposalId: ProposalId;
  readonly actorId: string;
  readonly baseWorld: WorldId;
  readonly branchId: BranchId;        // ADR-014 D12.3
  readonly attempt: number;
};

type ExecutionKeyPolicy = (ctx: ExecutionKeyContext) => ExecutionKey;
```

**`branchId` added to `ExecutionKeyContext` (ADR-014 D12.3).** This enables branch-scoped serialization policies (e.g., all proposals on the same branch share an executionKey to enforce sequential execution at the branch level).

**Policy Examples (informative):**

```typescript
// Default: Each proposal gets its own mailbox (parallel)
const defaultPolicy = ({ proposalId, attempt }: ExecutionKeyContext) =>
  `${proposalId}:${attempt}`;

// Actor serialization: Same actor's proposals serialize
const actorSerialPolicy = ({ actorId, attempt }: ExecutionKeyContext) =>
  `actor:${actorId}:${attempt}`;

// Branch serialization: All proposals on same branch serialize
const branchSerialPolicy = ({ branchId, attempt }: ExecutionKeyContext) =>
  `branch:${branchId}:${attempt}`;
```

### 8.3 Outcome Derivation

Governance derives `outcome` from Host's terminal snapshot. Governance does NOT match specific `system.status` values (Core-owned vocabulary).

**CRITICAL:** Current Core Snapshot no longer exposes accumulated `system.errors`. Governance uses `system.lastError` as the current error surface and `pendingRequirements` as the incomplete-work surface.

```typescript
function deriveOutcome(terminalSnapshot: Snapshot): 'completed' | 'failed' {
  // Current error state → 'failed' (lastError is non-null)
  if (terminalSnapshot.system.lastError != null) {
    return 'failed';
  }

  // GOV-TERM-1: pendingRequirements must be empty
  if (terminalSnapshot.system.pendingRequirements.length > 0) {
    return 'failed';
  }

  return 'completed';
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-OUTCOME-1 | MUST | `outcome` is a governance-level derived value, not Core's `system.status` |
| GOV-OUTCOME-2 | MUST | `system.lastError != null` implies `outcome: 'failed'` |
| GOV-OUTCOME-3 | MUST | Non-empty `pendingRequirements` implies `outcome: 'failed'` |
| GOV-OUTCOME-4 | MUST NOT | Governance MUST NOT match specific `system.status` string values |
| GOV-OUTCOME-5 | MUST NOT | Governance MUST NOT depend on removed accumulated error-history fields; failure determination uses `system.lastError` and `pendingRequirements` only |

### 8.4 Terminal Snapshot Validity

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-TERM-1 | MUST | Terminal snapshot MUST have empty `pendingRequirements` for `outcome: 'completed'` |
| GOV-TERM-2 | MUST | Non-empty pendingRequirements MUST result in `outcome: 'failed'` |
| GOV-TERM-3 | MUST | Failed execution creates World **when seal succeeds** (sealed via lineage). When `prepareSealNext()` rejects (worldId collision / self-loop), no World is created — the proposal terminates as `failed` without `resultWorld` (GOV-SEAL-7~9) |
| GOV-TERM-4 | SHOULD | `execution:failed` event SHOULD include pending requirement IDs |

### 8.5 BaseWorld Policy

This section defines governance-specific base world constraints that layer on top of lineage's base admissibility rules (LIN-BASE-1~4).

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-BASE-1 | MUST | In a governance-active environment, `proposal.baseWorld` MUST be the current head of `proposal.branchId` at gate release time (GOV-BRANCH-GATE-5) |

**Relationship to lineage.** Lineage enforces that `baseWorldId` equals the branch head at seal time (`LIN-BRANCH-SEAL-2`). Governance enforces that `baseWorld` equals the branch head at gate release time (`GOV-BASE-1`). The earlier governance check prevents wasted execution — if the base is already stale at approval, there is no point in executing.

### 8.6 Re-entry Model Alignment

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-RE-1 | MUST NOT | Governance MUST NOT assume Host execution is a single compute |
| GOV-RE-2 | MUST | intentId MUST remain stable throughout execution attempt |
| GOV-RE-3 | MUST NOT | Governance MUST NOT require Host to pause for mid-execution approval |

### 8.7 Context Determinism Alignment

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-CTX-1 | MUST | randomSeed is derived from intentId (Host responsibility) |
| GOV-CTX-2 | MUST NOT | Governance MUST NOT inject `now` or `randomSeed` to Host |
| GOV-CTX-3 | MUST | Trace storage MUST include frozen context per job for replay |

---

## 9. Seal Coordination

### 9.1 Overview

After execution completes, governance must finalize its own state (proposal terminalization, decision record) and coordinate with lineage to produce a sealed World. This section defines the governance side of the seal protocol.

The full seal sequence involves three participants: **Governance** (terminalize proposal), **Lineage** (prepare immutable World record), and **Coordinator** (assemble and atomically commit). Governance is responsible for the first step; the coordinator orchestrates the rest.

### 9.2 `governance.finalize()` Contract

```typescript
/**
 * PreparedGovernanceCommit: The result of governance finalization.
 *
 * Contains all governance records that must be atomically committed.
 * In the normal seal path, these are committed alongside lineage records.
 * In the seal rejection path, only governance records are committed (no lineage records).
 */
type PreparedGovernanceCommit = {
  /** The terminalized proposal — status set to 'completed' or 'failed'.
   *  resultWorld is populated from lineage commit in normal path,
   *  absent in seal rejection path (GOV-SEAL-9). */
  readonly proposal: Proposal;

  /** The DecisionRecord (already created at approval time). */
  readonly decisionRecord: DecisionRecord;

  /** Whether this commit has accompanying lineage records.
   *  false when produced by finalizeOnSealRejection(). */
  readonly hasLineageRecords: boolean;
};
```

```typescript
/**
 * SealRejectionReason: Why lineage's prepareSealNext() rejected the seal.
 *
 * These correspond to LIN-COLLISION-1~4 in Lineage SPEC v1.0.1.
 */
type SealRejectionReason = {
  readonly kind: 'worldId_collision' | 'self_loop';
  readonly computedWorldId: WorldId;
  readonly message: string;
};
```

```typescript
/**
 * Finalize governance state for seal.
 *
 * Two paths:
 *
 * finalize() — normal seal path. Called after prepareSealNext() succeeds.
 *   Input: executing proposal + PreparedLineageCommit
 *   Output: PreparedGovernanceCommit with hasLineageRecords = true
 *
 * finalizeOnSealRejection() — rejection path. Called when prepareSealNext()
 *   rejects due to worldId collision or self-loop.
 *   Input: executing proposal + SealRejectionReason
 *   Output: PreparedGovernanceCommit with hasLineageRecords = false
 *
 * Both methods:
 * - Side effects: NONE (read-only preparation)
 * - Input proposal.status MUST be 'executing'
 * - Return a PreparedGovernanceCommit for atomic commit
 */
interface GovernanceService {
  // ─── Normal seal path ───

  /**
   * 1. Derives outcome via deriveOutcome(terminalSnapshot)
   * 2. Cross-verifies outcome against lineageCommit.terminalStatus (GOV-SEAL-1)
   * 3. Sets proposal.resultWorld = lineageCommit.worldId
   * 4. Transitions proposal.status to terminal ('completed' or 'failed')
   * 5. Sets proposal.completedAt
   * 6. Returns PreparedGovernanceCommit { hasLineageRecords: true }
   */
  finalize(
    executingProposal: Proposal,
    lineageCommit: PreparedLineageCommit,
    completedAt: number,
  ): PreparedGovernanceCommit;

  // ─── Seal rejection path ───

  /**
   * 1. Transitions proposal.status to 'failed'
   * 2. Does NOT set proposal.resultWorld (no World created)
   * 3. Sets proposal.completedAt
   * 4. Returns PreparedGovernanceCommit { hasLineageRecords: false }
   */
  finalizeOnSealRejection(
    executingProposal: Proposal,
    rejection: SealRejectionReason,
    completedAt: number,
  ): PreparedGovernanceCommit;
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-SEAL-1 | MUST | Governance's `deriveOutcome()` result MUST agree with `lineageCommit.terminalStatus`. If they disagree, this is a bug — `finalize()` MUST throw |
| GOV-SEAL-2 | MUST | `finalize()` and `finalizeOnSealRejection()` MUST NOT mutate any store. They are pure preparations |
| GOV-SEAL-3 | MUST | `finalize()` MUST set `proposal.resultWorld` to `lineageCommit.worldId` |
| GOV-SEAL-4 | MUST | `finalize()` MUST transition proposal status to `'completed'` or `'failed'` based on `deriveOutcome()` |
| GOV-SEAL-5 | MUST | Both methods MUST set `proposal.completedAt` to the provided `completedAt` value |
| GOV-SEAL-6 | MUST | The input `executingProposal.status` MUST be `'executing'`. Any other status MUST be rejected |
| GOV-SEAL-7 | MUST | When `prepareSealNext()` rejects (worldId collision or self-loop), the coordinator MUST call `finalizeOnSealRejection()` instead of `finalize()` |
| GOV-SEAL-8 | MUST | `finalizeOnSealRejection()` MUST transition proposal status to `'failed'` |
| GOV-SEAL-9 | MUST | `finalizeOnSealRejection()` MUST NOT set `proposal.resultWorld`. No World is created in this path |
| GOV-SEAL-10 | MUST | `PreparedGovernanceCommit.hasLineageRecords` MUST be `true` from `finalize()` and `false` from `finalizeOnSealRejection()`. The coordinator uses this flag to determine whether lineage records are included in the atomic commit |

**Why `finalize()` and `finalizeOnSealRejection()` are both side-effect-free.** The same principle as lineage's prepare/commit separation (LIN-SEAL-PURE-1). Governance's finalization is computation — derive outcome, cross-verify, populate fields. The actual persistence happens in the coordinator's single atomic commit. If either method had side effects (e.g., persisting the terminalized proposal), a coordinator crash between governance commit and lineage commit would leave inconsistent state.

### 9.3 Seal Rejection Handling

When `prepareSealNext()` rejects (LIN-COLLISION-1~4), Host execution has completed successfully but lineage cannot create a new World. This happens in two cases:

**Self-loop (LIN-COLLISION-2).** Execution produced no semantic change — the terminal snapshot's hash-relevant content is identical to the base. The computed `worldId` equals `baseWorldId`.

**WorldId collision (LIN-COLLISION-1).** The computed `worldId` already exists in the lineage store from a different parent (diamond convergence).

In both cases, governance must still terminalize the proposal. Execution-stage proposals MUST reach terminal (GOV-STAGE-4), regardless of whether lineage can create a World.

```
Governance                   Coordinator (facade)         Lineage
    │                              │                        │
    │  1-4. (same as normal path)  │                        │
    │                              │                        │
    │── request seal ────────────>│                        │
    │                              │── prepareSealNext() ──>│
    │                              │                        │  Validate...
    │                              │                        │  worldId collision
    │                              │                        │  or self-loop!
    │                              │<── REJECTION ──────────│
    │                              │   (LIN-COLLISION-*)    │
    │                              │                        │
    │                              │  5. governance.        │
    │                              │     finalizeOnSealRejection()
    │                              │     → PreparedGovernanceCommit
    │                              │       { hasLineageRecords: false }
    │                              │                        │
    │                              │  6. Commit governance   │
    │                              │     records ONLY        │
    │                              │     (no lineage write set)
    │                              │                        │
    │                              │  7. Emit execution:seal_rejected
    │                              │     event (GOV-EXEC-EVT-5)
    │                              │                        │
    │<── seal rejection result ────│                        │
```

**Key differences from normal path:**
- No `PreparedLineageCommit` — lineage rejected the seal
- `finalizeOnSealRejection()` instead of `finalize()`
- Proposal terminates as `failed` with no `resultWorld`
- Atomic commit contains governance records only (`hasLineageRecords: false`)
- `execution:seal_rejected` event (not `execution:failed`) — structurally distinct, no `resultWorld` field

### 9.4 Seal Sequence — Normal Path (Full)

This extends Lineage SPEC §7.5 with governance-specific detail:

```
Governance                   Coordinator (facade)         Lineage             Store
    │                              │                        │                   │
    │  1. Proposal P₁ approved     │                        │                   │
    │  2. Execute via HostExecutor │                        │                   │
    │     → terminalSnapshot       │                        │                   │
    │  3. Derive outcome           │                        │                   │
    │  4. Prepare provenance refs  │                        │                   │
    │     (proposalRef, decisionRef)│                        │                   │
    │                              │                        │                   │
    │── request seal ────────────>│                        │                   │
    │                              │  5. Build SealNextInput│                   │
    │                              │     { branchId: P₁.branchId,              │
    │                              │       baseWorldId: P₁.baseWorld,          │
    │                              │       terminalSnapshot,                    │
    │                              │       proposalRef: P₁.proposalId,         │
    │                              │       decisionRef: P₁.decisionId,         │
    │                              │       createdAt: now() }                   │
    │                              │                        │                   │
    │                              │── prepareSealNext() ──>│                   │
    │                              │                        │  6. Validate      │
    │                              │                        │  7. Derive status │
    │                              │                        │  8. Hash, create  │
    │                              │                        │     records       │
    │                              │<── PreparedLineageCommit│                   │
    │                              │                        │                   │
    │                              │  9. governance.finalize()                  │
    │                              │     (executingProposal, lineageCommit)     │
    │                              │     → PreparedGovernanceCommit             │
    │                              │                        │                   │
    │                              │  10. Assemble write set:                   │
    │                              │      lineage records +                     │
    │                              │      governance records                    │
    │                              │                        │                   │
    │                              │── store.commitSeal(writeSet) ─────────────>│
    │                              │   (atomic: all or nothing)                 │
    │                              │                        │                   │
    │                              │  11. Emit governance events                │
    │                              │      (only after commit success)           │
    │                              │                        │                   │
    │<── seal result ──────────────│                        │                   │
```

**Key ordering constraints:**
1. Lineage `prepareSealNext()` MUST be called before `governance.finalize()` — governance needs `lineageCommit.worldId` and `lineageCommit.terminalStatus`.
2. `governance.finalize()` MUST be called before the atomic commit — the coordinator needs both prepared results.
3. Events MUST be emitted only after the atomic commit succeeds.
4. If the atomic commit fails (e.g., CAS failure), no events are emitted and the coordinator SHOULD retry from step 5.

### 9.5 Provenance Mapping

| Governance Entity | Lineage Field | Type |
|-------------------|---------------|------|
| `proposal.proposalId` | `SealNextInput.proposalRef` → `World.createdBy` | `ProvenanceRef` (opaque string) |
| `decisionRecord.decisionId` | `SealNextInput.decisionRef` → `WorldEdge.decisionRef` | `ProvenanceRef` (opaque string) |

Lineage stores these as opaque strings. Governance interprets their meaning.

---

## 10. Event System

### 10.1 Event Ownership

Per **ADR-001**, **ADR-014 D8**, and **FDR-W027**:

> **Results are Governance's; Process is App's.**

After the split, lineage does not emit events. All governance result events are owned and emitted by governance.

| Owner | Events | Nature |
|-------|--------|--------|
| **Governance** | `proposal:*`, `world:*`, `execution:completed`, `execution:failed` | Governance results |
| **App** | `execution:compute`, `execution:patches`, `execution:effect:*`, `execution:started` | Execution telemetry |

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-EVT-OWN-1 | MUST | Governance MUST only define and emit governance events |
| GOV-EVT-OWN-2 | MUST NOT | Governance MUST NOT define or emit execution telemetry events |
| GOV-EVT-OWN-3 | MUST | `execution:completed`, `execution:failed`, and `execution:seal_rejected` are governance results (Governance-owned) |
| GOV-EVT-OWN-4 | MUST | App MUST emit telemetry events by transforming Host's TraceEvent |

### 10.2 Event Types

```typescript
type GovernanceEventType =
  // Proposal lifecycle
  | 'proposal:submitted'
  | 'proposal:evaluating'
  | 'proposal:decided'
  | 'proposal:superseded'

  // Execution results (governance outcome)
  | 'execution:completed'
  | 'execution:failed'
  | 'execution:seal_rejected'

  // World lifecycle (governance)
  | 'world:created'
  | 'world:forked';
```

### 10.3 Subscription API

```typescript
type GovernanceEventHandler = (event: GovernanceEvent, ctx: ScheduleContext) => void;
type Unsubscribe = () => void;

interface GovernanceEventSubscriber {
  subscribe(handler: GovernanceEventHandler): Unsubscribe;
  subscribe(types: GovernanceEventType[], handler: GovernanceEventHandler): Unsubscribe;
}
```

### 10.4 ScheduleContext

**ScheduleContext is provided by App, not Governance.**

Governance defines the behavioral contract (handlers can schedule actions); App defines the concrete API (action types, scheduling mechanism).

```typescript
/**
 * ScheduleContext: Provided by App to event handlers.
 *
 * Ownership:
 * - DEFINED BY: App (implementation details)
 * - PROVIDED TO: Governance event handlers
 * - PROCESSED BY: App's unified scheduler
 */
interface ScheduleContext {
  schedule(action: ScheduledAction): void;
}

/**
 * ScheduledAction types are ILLUSTRATIVE.
 * Concrete action types are defined by App SPEC.
 */
type ScheduledAction =
  | { type: 'SubmitProposal'; payload: ProposalInput }
  | { type: 'CancelProposal'; payload: { proposalId: ProposalId } }
  | { type: 'Custom'; tag: string; payload: unknown };
```

### 10.5 Non-Interference Constraints

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-EVT-C1 | MUST NOT | Handler MUST NOT modify governance state |
| GOV-EVT-C2 | MUST NOT | Handler MUST NOT call state-modifying APIs (`submitProposal`, `registerActor`, `decide`, etc.) |
| GOV-EVT-C3 | SHOULD | Handler SHOULD complete quickly |
| GOV-EVT-C4 | MUST NOT | Handler MUST NOT await async operations |
| GOV-EVT-C5 | MUST | Handler exceptions MUST be isolated (one bad handler doesn't break others) |
| GOV-EVT-C6 | MUST | Handler MUST be idempotent for replay |

**Enforcement Pattern (Recommended):**

```typescript
class GovernanceEventDispatcher {
  private dispatching = false;
  private scheduledActions: ScheduledAction[] = [];

  dispatch(event: GovernanceEvent): void {
    this.dispatching = true;
    const ctx: ScheduleContext = {
      schedule: (action) => this.scheduledActions.push(action),
    };

    try {
      for (const handler of this.handlers) {
        try {
          handler(event, ctx);
        } catch (e) {
          this.logHandlerError(handler, event, e);  // GOV-EVT-C5
        }
      }
    } finally {
      this.dispatching = false;
    }

    // Process scheduled actions AFTER dispatch (GOV-SCHED-3, GOV-SCHED-5)
    this.flushScheduledActions();
  }

  // Guard on state-modifying APIs (GOV-EVT-C2)
  submitProposal(input: ProposalInput): void {
    if (this.dispatching) {
      throw new Error('GOV-EVT-C2 violation: submitProposal called during event dispatch');
    }
    // ... actual implementation
  }
}
```

### 10.6 Scheduled Reaction Execution

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-SCHED-1 | MUST | Handlers receive `ScheduleContext` as second parameter |
| GOV-SCHED-2 | MUST | Governance MUST provide `schedule()` method in ScheduleContext |
| GOV-SCHED-3 | MUST | Scheduled actions MUST be processed AFTER all handlers complete |
| GOV-SCHED-4 | MUST | Scheduled actions MUST go through App's unified scheduler |
| GOV-SCHED-5 | MUST NOT | Scheduled actions MUST NOT be executed as microtask during event dispatch |

### 10.7 Event Ordering

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-EVT-ORD-1 | MUST | Events MUST be delivered in causal order (synchronously) |
| GOV-EVT-ORD-2 | MUST | Events for same executionKey MUST NOT violate Host mailbox serialization |

### 10.8 Event Payloads

#### 10.8.1 Base Event

```typescript
type BaseGovernanceEvent = {
  readonly type: GovernanceEventType;
  readonly timestamp: number;
};
```

#### 10.8.2 Proposal Events

```typescript
type ProposalSubmittedEvent = BaseGovernanceEvent & {
  readonly type: 'proposal:submitted';
  readonly proposalId: ProposalId;
  readonly actorId: ActorId;
  readonly baseWorld: WorldId;
  readonly branchId: BranchId;          // ADR-014 D12.2
  readonly intent: Intent;
  readonly executionKey: ExecutionKey;
  readonly epoch: number;
};

type ProposalEvaluatingEvent = BaseGovernanceEvent & {
  readonly type: 'proposal:evaluating';
  readonly proposalId: ProposalId;
};

type ProposalDecidedEvent = BaseGovernanceEvent & {
  readonly type: 'proposal:decided';
  readonly proposalId: ProposalId;
  readonly decisionId: DecisionId;
  readonly decision: 'approved' | 'rejected';
  readonly reason?: string;
};

type ProposalSupersededEvent = BaseGovernanceEvent & {
  readonly type: 'proposal:superseded';
  readonly proposalId: ProposalId;
  readonly currentEpoch: number;
  readonly proposalEpoch: number;
  readonly reason: SupersedeReason;     // extended with 'head_advance'
};
```

**`branchId` added to `ProposalSubmittedEvent` (ADR-014 D12.2).** Subscribers can observe which branch a proposal targets without querying the proposal record.

#### 10.8.3 Execution Result Events

Governance emits only governance result events, not telemetry events.

Execution results come in three flavors, each with a distinct type. This union design ensures that the presence or absence of `resultWorld` is structurally enforced — subscribers never encounter an optional field they must guess about.

```typescript
/**
 * Execution completed successfully. World sealed.
 */
type ExecutionCompletedEvent = BaseGovernanceEvent & {
  readonly type: 'execution:completed';
  readonly proposalId: ProposalId;
  readonly executionKey: ExecutionKey;
  readonly resultWorld: WorldId;         // always present — World was sealed
};

/**
 * Execution failed. World sealed (failed World is still recorded in lineage).
 * This is "failure A": Host execution did not succeed, but seal succeeded.
 */
type ExecutionFailedEvent = BaseGovernanceEvent & {
  readonly type: 'execution:failed';
  readonly proposalId: ProposalId;
  readonly executionKey: ExecutionKey;
  readonly resultWorld: WorldId;         // always present — failed World was sealed
  readonly error: {
    readonly summary: string;
    readonly details?: ErrorValue[];
    readonly pendingRequirements?: string[];  // GOV-TERM-4
  };
};

/**
 * Execution completed but seal was rejected by lineage. No World created.
 * This is "failure B": Host execution succeeded (or failed), but lineage
 * rejected the seal due to worldId collision or self-loop.
 *
 * The proposal terminates as 'failed' with no resultWorld.
 * This event is structurally distinct from execution:failed because
 * there is no World to reference.
 */
type ExecutionSealRejectedEvent = BaseGovernanceEvent & {
  readonly type: 'execution:seal_rejected';
  readonly proposalId: ProposalId;
  readonly executionKey: ExecutionKey;
  readonly rejection: SealRejectionReason;   // why lineage rejected
  // NOTE: no resultWorld — structurally absent, not optional
};
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-EXEC-EVT-1 | MUST | Governance MUST emit `execution:completed` when execution succeeds and seal succeeds |
| GOV-EXEC-EVT-2 | MUST | Governance MUST emit `execution:failed` when execution fails and seal succeeds (failed World is sealed) |
| GOV-EXEC-EVT-3 | MUST | All three execution result events MUST be emitted after the atomic commit (not "after World creation" — seal rejection has no World) |
| GOV-EXEC-EVT-4 | MUST NOT | Governance MUST NOT emit events during execution (only after terminal commit) |
| GOV-EXEC-EVT-5 | MUST | Governance MUST emit `execution:seal_rejected` when `prepareSealNext()` rejects (worldId collision or self-loop). This event has no `resultWorld` |

**Why a separate event type instead of optional `resultWorld`.** If `resultWorld` were optional on `ExecutionFailedEvent`, every subscriber would need to check "is this a real failure or a seal rejection?" — and the answer would depend on whether a field happens to be present. Making the distinction structural (different `type` tag) means subscribers can pattern-match at the type level. This is the same principle as lineage's `PreparedGenesisCommit` vs `PreparedNextCommit` — when the shape differs, the type should differ.

#### 10.8.4 World Events

```typescript
type WorldCreatedEvent = BaseGovernanceEvent & {
  readonly type: 'world:created';
  readonly world: World;
  readonly from: WorldId;
  readonly proposalId: ProposalId;
  readonly outcome: 'completed' | 'failed';
};

type WorldForkedEvent = BaseGovernanceEvent & {
  readonly type: 'world:forked';
  readonly branchId: BranchId;
  readonly forkPoint: WorldId;
};
```

---

## 11. GovernanceStore

### 11.1 Purpose

Per ADR-014 D11.2, governance owns its own persistence via `GovernanceStore`. Governance audit data (proposals, decisions, actor bindings) lives in a separate store interface from lineage records.

### 11.2 Interface

```typescript
interface GovernanceStore {
  // ─── Proposals ───
  putProposal(proposal: Proposal): void;
  getProposal(proposalId: ProposalId): Proposal | null;
  getProposalsByBranch(branchId: BranchId): readonly Proposal[];
  getExecutionStageProposal(branchId: BranchId): Proposal | null;

  // ─── Decision Records ───
  putDecisionRecord(record: DecisionRecord): void;
  getDecisionRecord(decisionId: DecisionId): DecisionRecord | null;

  // ─── Actor Bindings ───
  putActorBinding(binding: ActorAuthorityBinding): void;
  getActorBinding(actorId: ActorId): ActorAuthorityBinding | null;
  getActorBindings(): readonly ActorAuthorityBinding[];
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-STORE-1 | MUST NOT | `GovernanceStore` MUST NOT reference lineage types (World, WorldEdge, SnapshotHashInput) |
| GOV-STORE-2 | MUST | `GovernanceStore` MUST be owned and defined by `@manifesto-ai/governance` |
| GOV-STORE-3 | MUST | Governance package MUST provide an in-memory `GovernanceStore` implementation |
| GOV-STORE-4 | MUST | `getExecutionStageProposal(branchId)` MUST return the single proposal in execution stage (`approved` OR `executing`) for that branch, or null if none exists. "Execution stage" includes both `approved` and `executing` statuses per GOV-STAGE-2. This supports GOV-BRANCH-GATE-1 enforcement |

### 11.3 Composite Store (Facade Concern)

When both governance and lineage are present, the `@manifesto-ai/world` facade provides a composite store that extends both `LineageStore` and `GovernanceStore` and adds an atomic `commitSeal()` method. The composite store is NOT defined by this SPEC — it is a facade/coordinator concern.

Governance's `finalize()` does not interact with any store. It is a pure computation. The coordinator uses `GovernanceStore` to persist the `PreparedGovernanceCommit` as part of the atomic commit.

---

## 12. Invariants

### 12.1 Proposal Invariants

| ID | Invariant |
|----|-----------|
| INV-G1 | No Intent is executed without an approved Proposal |
| INV-G2 | Every Proposal has exactly one Actor |
| INV-G3 | Every Proposal with terminal decision (`approved`/`rejected`) has exactly one DecisionRecord. `superseded` proposals have NO DecisionRecord |
| INV-G4 | Proposal status transitions are monotonic |
| INV-G5 | `evaluating` status does NOT create DecisionRecord |
| INV-G6 | ExecutionKey is fixed at Proposal creation |
| INV-G7 | Every Proposal records `branchId` at creation (immutable) |
| INV-G8 | `superseded` is an Ingress-terminal status: no World created, no DecisionRecord, `supersededReason` is set |

### 12.2 Authority Invariants

| ID | Invariant |
|----|-----------|
| INV-G9 | Every registered Actor has exactly one Authority binding |
| INV-G10 | Authority never executes effects or applies patches |
| INV-G11 | No re-judgment of a terminal decision for the same Proposal |

### 12.3 World-Proposal Invariant (Conditional)

| ID | Invariant |
|----|-----------|
| INV-G12 | **Conditional:** Every non-genesis World has exactly one creating Proposal — applies ONLY when governance is active |

**INV-G12 conditionality (ADR-014 D10).** In governance-free environments (lineage-only), Worlds are created without Proposals. `World.createdBy` is `ProvenanceRef | null` at the lineage level — lineage does not enforce this invariant. When governance is present, governance enforces that every sealed World traces back to exactly one approved Proposal.

### 12.4 Execution Invariants

| ID | Invariant |
|----|-----------|
| INV-G13 | ExecutionKey is opaque to Host |
| INV-G14 | Terminal snapshot has empty pendingRequirements (or outcome=failed) |
| INV-G15 | Failed execution creates World when seal succeeds. When lineage rejects the seal (worldId collision / self-loop), proposal terminates as `failed` without `resultWorld` |
| INV-G16 | Execution-stage proposals MUST reach Execution-terminal (`completed` or `failed`) |
| INV-G17 | At most one execution-stage proposal (`approved` or `executing`) per branch at any time (single-writer gate) |

### 12.5 Event Invariants

| ID | Invariant |
|----|-----------|
| INV-G18 | Event handlers do not modify governance state |
| INV-G19 | Event handlers do not await async operations |
| INV-G20 | Scheduled actions are processed after event dispatch |
| INV-G21 | Scheduled actions are NOT executed as microtasks |

### 12.6 Layer Boundary Invariants

| ID | Invariant |
|----|-----------|
| INV-G22 | Governance package does NOT depend on Host package |
| INV-G23 | Governance does NOT subscribe to Host's onTrace |
| INV-G24 | Governance does NOT define telemetry events |
| INV-G25 | Governance only emits governance events |
| INV-G26 | Governance defines HostExecutor interface, does NOT implement it |
| INV-G27 | App implements HostExecutor and provides it to Governance |

### 12.7 Seal Invariants

| ID | Invariant |
|----|-----------|
| INV-G28 | Governance's `deriveOutcome()` and lineage's `deriveTerminalStatus()` agree for the same snapshot |
| INV-G29 | `governance.finalize()` and `finalizeOnSealRejection()` are side-effect-free (no store mutation) |
| INV-G30 | Events are emitted only after atomic commit succeeds |
| INV-G31 | When lineage rejects the seal (collision / self-loop), governance MUST still terminalize the proposal as `failed` via `finalizeOnSealRejection()` |
| INV-G32 | Seal-rejected proposal has no `resultWorld` — the `failed` status in this case means "execution completed but World could not be created" |

---

## 13. Compliance

### 13.1 Compliance Requirements

An implementation claiming compliance with **Manifesto Governance Protocol v1.0.0** MUST:

1. Implement all types defined in this document (including `superseded` in `ProposalStatus` and `SupersedeReason`)
2. Enforce all MUST rules (identified by Rule IDs)
3. Enforce all invariants (INV-G*)
4. Follow Proposal lifecycle state machine (§6.5), including `superseded` as Ingress-terminal
5. Maintain Actor-Authority bindings (GOV-BIND-*)
6. Create DecisionRecords only for authority decisions (`approved`/`rejected`), NOT for `superseded` (GOV-TRANS-2~3)
7. Enforce monotonic status transitions (GOV-TRANS-*)
8. Enforce single-writer gate per branch — `approved` OR `executing` occupies the gate (GOV-BRANCH-GATE-*)
9. Enforce epoch-based ingress control — stale proposals MUST transition to `superseded` (GOV-EPOCH-*, GOV-BRANCH-GATE-5~7)
10. Define HostExecutor interface, NOT implement it (GOV-HEXEC-*)
11. Derive outcome via `deriveOutcome()`, NOT `result.outcome` (GOV-HEXEC-6)
12. Cross-verify outcome with lineage's `terminalStatus` (GOV-SEAL-1)
13. Implement side-effect-free `finalize()` and `finalizeOnSealRejection()` (GOV-SEAL-2)
14. Enforce event handler non-interference (GOV-EVT-C1~C6)
15. Process scheduled actions after event dispatch (GOV-SCHED-3~5)
16. Include `branchId` in Proposal, `ProposalSubmittedEvent`, and `ExecutionKeyContext`
17. Support all `SupersedeReason` values: `branch_switch`, `head_advance`, `manual_cancel`
18. Emit `proposal:superseded` event when a proposal transitions to `superseded` (GOV-EPOCH-5)
19. Read epoch from `LineageService` public contract, NOT `LineageStore` (GOV-EPOCH-2)
20. Handle `prepareSealNext()` rejection via `finalizeOnSealRejection()` (GOV-SEAL-7~10)
21. Import only from `@manifesto-ai/lineage` public contract (GOV-DEP-*)
22. NOT import from Host (GOV-BOUNDARY-5)

### 13.2 Compliance Verification

| Test Category | Description |
|---------------|-------------|
| Type checking | All structures match specification, including `superseded` in `ProposalStatus` and `supersededReason` in `Proposal` |
| Invariant testing | All INV-G* hold under test scenarios |
| State machine testing | Proposal transitions are valid, monotonic, and include `superseded` as Ingress-terminal |
| Superseded status | `submitted → superseded` and `evaluating → superseded` transitions work; `approved → superseded` is rejected |
| Superseded record | Superseded proposal has `supersededReason` set, no DecisionRecord, no resultWorld |
| Single-writer gate | Two proposals same branch → only one in execution stage (`approved` or `executing`) at a time |
| Gate release revalidation | Head advanced between submit and approve → proposal transitions to `superseded` (not `approved`) |
| Stale epoch invalidation | Head advance → ingress proposals with old epoch transition to `superseded` |
| Late authority discard | Decision for stale-epoch proposal → discarded, proposal already `superseded` |
| Outcome derivation | `deriveOutcome()` matches `deriveTerminalStatus()` for same snapshot |
| Finalize purity | `finalize()` and `finalizeOnSealRejection()` do not mutate any store |
| Seal rejection — self-loop | No-op execution (same semantic content as base) → `prepareSealNext()` rejects → `finalizeOnSealRejection()` → proposal `failed`, no `resultWorld` |
| Seal rejection — collision | Diamond convergence worldId → `prepareSealNext()` rejects → `finalizeOnSealRejection()` → proposal `failed`, no `resultWorld` |
| Seal rejection — event | Seal rejection → `execution:seal_rejected` event with `SealRejectionReason`, no `resultWorld` field |
| Seal rejection — gate release | Seal-rejected proposal releases single-writer gate → next proposal can proceed |
| Event handler testing | GOV-EVT-C violations detected/prevented |
| Schedule timing | Scheduled action → NOT executed as microtask |
| Branch identity | Proposal carries `branchId`; events include `branchId` |
| Supersede event | `proposal:superseded` event emitted with correct `SupersedeReason` for all three reasons |
| Epoch source | Proposal reads epoch from `LineageService` (not `LineageStore`) at submission time |
| Boundary | No Host imports; no `LineageStore` access; no telemetry events defined |

### 13.3 Governance-Specific Tests

| Test | Description |
|------|-------------|
| Parallel branches | Two proposals on different branches → both can execute simultaneously |
| Serial within branch | Two proposals on same branch → second waits in ingress (gate occupied by `approved` or `executing`) |
| Gate-5 revalidation | Approve proposal after head advance → `superseded` (not `approved`) |
| Gate-6 bulk invalidation | Head advance → all stale ingress proposals on that branch → `superseded` with `supersededReason: 'head_advance'` |
| Gate-7 late decision | Authority decision arrives after head advance → discarded, proposal already `superseded` |
| Superseded from submitted | `submitted` proposal with stale epoch → `superseded` (no DecisionRecord) |
| Superseded from evaluating | `evaluating` proposal with stale epoch → `superseded` (no DecisionRecord) |
| Superseded immutability | `superseded` proposal has no `resultWorld`, no `decisionId`, but has `supersededReason` |
| Epoch source | Proposal records epoch from `LineageService` at submission time |
| Finalize outcome mismatch | `deriveOutcome()` disagrees with `lineageCommit.terminalStatus` → throw |
| ExecutionKeyContext branchId | Branch-scoped key policy receives `branchId` in context |
| Event after commit only | Commit fails → no events emitted |
| INV-G12 conditionality | Lineage-only seal without Proposal → no violation |

---

## Appendix A: Rule Retagging Mapping

| Old (World SPEC) | New (Governance SPEC) | Section |
|------------------|-----------------------|---------|
| ACTOR-1~2 | GOV-ACTOR-1~2 | §5.1 |
| BIND-1~2 | GOV-BIND-1~2 | §5.3 |
| DECISION-1~2 | GOV-DECISION-1~2 | §6.3 |
| WORLD-STAGE-1~6 | GOV-STAGE-1~7 | §6.4 |
| TRANS-1~2 | GOV-TRANS-1~4 | §6.6 |
| EPOCH-1~5 | GOV-EPOCH-1~5 | §7.4 |
| WORLD-HEXEC-1~7 | GOV-HEXEC-1~7 | §8.1 |
| WORLD-EXK-1~5 | GOV-EXK-1~5 | §8.2 |
| OUTCOME-1~5 | GOV-OUTCOME-1~5 | §8.3 |
| WORLD-TERM-1~4 | GOV-TERM-1~4 | §8.4 |
| WORLD-BASE-3 | GOV-BASE-1 | §8.5 |
| WORLD-RE-1~3 | GOV-RE-1~3 | §8.6 |
| WORLD-CTX-1~3 | GOV-CTX-1~3 | §8.7 |
| WORLD-EVT-OWN-1~4 | GOV-EVT-OWN-1~4 | §10.1 |
| EVT-C1~C6 | GOV-EVT-C1~C6 | §10.5 |
| SCHED-1~5 | GOV-SCHED-1~5 | §10.6 |
| EVT-ORD-1~2 | GOV-EVT-ORD-1~2 | §10.7 |
| WORLD-EXEC-EVT-1~4 | GOV-EXEC-EVT-1~5 | §10.8.3 |
| INV-P1~P6 | INV-G1~G6 | §12.1 |
| INV-A1~A3 | INV-G9~G11 | §12.2 |
| INV-W3 | INV-G12 (conditional) | §12.3 |
| INV-EX1~EX5 | INV-G13~G17 | §12.4 |
| INV-EV1~EV4 | INV-G18~G21 | §12.5 |
| INV-LB1~LB6 | INV-G22~G27 | §12.6 |

**New rules (no World SPEC predecessor):**

| New Rule | Section | Origin |
|----------|---------|--------|
| GOV-BOUNDARY-1~6 | §4.1 | ADR-014 D3 |
| GOV-DEP-1~2 | §4.2 | ADR-014 D4 |
| GOV-STAGE-7 | §6.4 | `superseded` as Ingress-terminal |
| GOV-TRANS-3~4 | §6.6 | `superseded` transition rules |
| GOV-BRANCH-GATE-1~7 | §7.1, §7.2 | ADR-014 D13 |
| GOV-BRANCH-1~3 | §7.3 | ADR-014 D12 |
| GOV-SEAL-1~10 | §9.2, §9.3 | ADR-014 D6 + D14 (seal rejection path included) |
| GOV-STORE-1~4 | §11.2 | ADR-014 D11.2 |
| INV-G7 | §12.1 | ADR-014 D12 (`branchId` immutability) |
| INV-G8 | §12.1 | `superseded` Ingress-terminal invariant |
| INV-G17 | §12.4 | Single-writer gate invariant (ADR-014 D13) |
| INV-G28~G32 | §12.7 | Seal coordination invariants (ADR-014 D6 + seal rejection) |

---

## Appendix B: Rule Summary

| Category | Key Rules |
|----------|-----------|
| Boundary | GOV-BOUNDARY-1~6 |
| Dependency | GOV-DEP-1~2 |
| Actor | GOV-ACTOR-1~2 |
| Binding | GOV-BIND-1~2 |
| Decision | GOV-DECISION-1~2 |
| Stage | GOV-STAGE-1~7 |
| Transition | GOV-TRANS-1~4 |
| Branch Gate | GOV-BRANCH-GATE-1~7 |
| Branch Identity | GOV-BRANCH-1~3 |
| Epoch | GOV-EPOCH-1~5 |
| HostExecutor | GOV-HEXEC-1~7 |
| ExecutionKey | GOV-EXK-1~5 |
| Outcome | GOV-OUTCOME-1~5 |
| Terminal | GOV-TERM-1~4 |
| BaseWorld | GOV-BASE-1 |
| Re-entry | GOV-RE-1~3 |
| Context | GOV-CTX-1~3 |
| Seal | GOV-SEAL-1~10 |
| Event Ownership | GOV-EVT-OWN-1~4 |
| Event Constraints | GOV-EVT-C1~C6 |
| Event Ordering | GOV-EVT-ORD-1~2 |
| Execution Events | GOV-EXEC-EVT-1~5 |
| Scheduling | GOV-SCHED-1~5 |
| Store | GOV-STORE-1~4 |

---

*End of Manifesto Governance Protocol Specification*
