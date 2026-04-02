# ADR-014: Split World Protocol into Governance and Lineage Packages

> **Status:** Implemented
> **Implemented In:** `@manifesto-ai/lineage`, `@manifesto-ai/governance`, ADR-017 decorator composition, current package version indexes, and the world-package retirement path
> **Date:** 2026-03-28
> **Deciders:** Sungwoo Jung, Manifesto Architecture Team
> **Scope:** `@manifesto-ai/world`, `@manifesto-ai/governance`, `@manifesto-ai/lineage`, SDK composition, docs/release
> **Related:** ADR-001 (Layer Separation), ADR-003 (World Owns Persistence), ADR-006 (PUB/CHAN/CAN), ADR-010 (Protocol-First SDK)

---

## 1. Context

### 1.1 The Adoption Barrier

Even in ordinary web-app scenarios that need no governance, using snapshot continuity (lineage) requires importing the entire `@manifesto-ai/world` package. Actor, Authority, Proposal lifecycle, and DecisionRecord concepts act as an adoption barrier, **repeatedly confirmed by feedback that Manifesto feels too heavy to adopt** in governance-free use cases.

The core of this feedback is: "let me use lineage (snapshot history, resume, branch) independently, without governance."

### 1.2 The Structural Evidence

Independent of the feedback, the World SPEC itself reveals two cohesion clusters growing in different directions.

**Lineage growth.** ADR-003 assigned WorldStore ownership and read-only query boundary to World. v2.0.5 promoted `getHeads()`, `getLatestHead()`, resume, and branch persistence to the World public contract. This shows persistence has grown from an internal implementation detail into a **constitutional substrate guaranteeing continuity**.

**Governance cohesion.** Proposal lifecycle, Actor/Authority binding, HostExecutor ownership, and `execution:completed`/`execution:failed` remain cohesive around the question of **legitimacy** — "who approved this?" and "how is the execution result sealed as a terminal judgment?"

**Independent changeability.** Classifying World SPEC rule IDs shows that `WORLD-HASH-*`, `PERSIST-*`, `HEAD-*`, `RESUME-*`, `REPLAY-*`, `BRANCH-*` (lineage) and `ACTOR-*`, `BIND-*`, `DECISION-*`, `WORLD-STAGE-*`, `TRANS-*`, `OUTCOME-*`, `WORLD-HEXEC-*` (governance) can change independently of each other.

### 1.3 ADR-006 Deferral Condition Met

ADR-006 §5 deferred the package split, stating:

> "When sufficient internal decomposition evidence is available, propose via a separate ADR."

The adoption friction (§1.1) and structural separability (§1.2) satisfy this condition. This decision is evidence-driven, not speculative.

### 1.4 Problem Summary

The current `@manifesto-ai/world` carries the **Legitimacy Engine** (who may authorize changes to history) and the **Continuity Engine** (how history is stored, continued, and restored) under a single name.

| Problem | Impact |
|---------|--------|
| Users who only want lineage must import all of governance | Adoption barrier |
| Governance rule changes can ripple into persistence/resume code | Change cost |
| Lineage tests require Actor/Authority fixtures | Test isolation failure |
| Two kinds of rules interleaved in one SPEC | Documentation cohesion loss |

---

## 2. Decision

### D1. Split `@manifesto-ai/world` into two independent protocol packages

The new packages are:

* `@manifesto-ai/governance` — Legitimacy Engine
* `@manifesto-ai/lineage` — Continuity Engine

This decision **does not add a new layer.** It redistributes the existing World constitutional scope (defined by ADR-001) into two independent packages. The World constitution does not disappear; its interior is decomposed into two first-class protocols.

### D2. `@manifesto-ai/lineage` owns continuity responsibility only

`@manifesto-ai/lineage` owns:

* `WorldId`, `snapshotHash`, canonical hash rules
* `terminalStatus` derivation from snapshot — lineage derives this internally, never accepts it as caller input
* Platform namespace exclusion (`data.$*`)
* `World`, `WorldEdge`, `WorldLineage` types (provenance fields are opaque references)
* `LineageStore` ownership — with atomic commit contract for durable lineage-only use
* Terminal snapshot persistence / restore / replay
* Head query, head advance policy — completed worlds only; failed worlds persist in DAG but do not advance head
* BaseWorld admissibility — existence check, pending-requirements rejection, failed-base rejection, schema consistency
* Resume-support primitives
* Branch persistence / crash recovery
* Branch switch — `activeBranchId` change and source-branch epoch increment as a single atomic operation

Lineage does not interpret approval policy, authority model, or proposal stage semantics.

### D3. `@manifesto-ai/governance` owns legitimacy responsibility only

`@manifesto-ai/governance` owns:

* `ActorRef`, `AuthorityRef`, `ActorAuthorityBinding`
* `Proposal`, `DecisionRecord` — Proposal includes `branchId` as persisted truth
* `GovernanceStore` ownership
* Ingress / execution / terminal stage rules
* `HostExecutor` interface ownership
* Outcome derivation for proposal lifecycle (must agree with lineage's derivation)
* Terminal snapshot validity checks
* Governance result events
* `ExecutionKey` policy contract
* BaseWorld policy — active branch head constraint
* Re-entry rules
* Single-writer per branch gate — at most one execution-stage proposal per branch at a time
* Stale ingress invalidation — epoch increment on head advance, gate-release revalidation, late authority result discard

Governance does not know lineage storage internals. Governance owns its own persistence via `GovernanceStore`.

### D4. Dependency direction: `governance → lineage` only

* `@manifesto-ai/governance` MAY import from `@manifesto-ai/lineage` to seal approved execution results.
* `@manifesto-ai/lineage` MUST NOT import from `@manifesto-ai/governance`.

The reason is straightforward:

* **History can exist without policy** — you can create a genesis, continue it, and resume, with no governance.
* **Policy cannot exist without a recording substrate** — DecisionRecords and Proposal results must be sealed into lineage to become history.

Lineage is the lower substrate; governance is the upper protocol layered on top.

### D5. Provenance connections remain opaque references

After the split, lineage stores `proposalId` and `decisionId` as opaque `string` references, not as concrete governance types. Governance interprets the meaning of these opaque refs. This structurally prevents circular dependencies between packages.

### D6. Seal boundary — governance judges, lineage seals

After the split, the responsibility for creating a World from a terminal snapshot divides as follows.

**Governance is responsible for:**

* Terminal proposal judgment, outcome derivation
* Terminal snapshot validity verification
* Provenance refs preparation (proposalRef, decisionRef)

**Lineage is responsible for:**

* Deriving `terminalStatus` from the snapshot internally (never accepting it as caller input — the same snapshot must always produce the same status)
* Hash canonicalization, `snapshotHash` / `worldId` computation
* `World` / `WorldEdge` record creation
* Persistence, branch-scoped head advance (completed only)

**Key design principles established by this ADR (exact contracts deferred to Lineage/Governance SPECs):**

1. **Prepare/commit separation.** Lineage's seal API is always pure computation — it reads from store but never mutates it. It returns the full set of records to be persisted. Commit is always a separate call. The side-effect semantics of a method must not change based on whether governance is present.

2. **Genesis and next are separate at the type level.** Genesis is not "mutation of an existing branch" but "bootstrap of the lineage." It includes first-branch creation and activeBranch initialization. Failed genesis is forbidden in this ADR — resume semantics for a "headless branch" are undefined.

3. **Branch-scoped CAS mutation, not global state overwrite.** Committing a seal result must only mutate the target branch via compare-and-swap on `(head, epoch)` jointly. Other branches and `activeBranchId` are not affected. This prevents cross-branch lost updates when multiple branches are active simultaneously.

4. **Epoch is branch-level lineage metadata.** Epoch is incremented by head advance and by branch switch. Since epoch and head must always be CAS'd together, epoch belongs to `LineageStore`, not `GovernanceStore`. Governance reads the current epoch for admission decisions.

5. **Branch switch is an explicit atomic protocol operation.** Changing `activeBranchId` is not a simple setter — it is a persisted state change that survives restart and triggers source-branch epoch increment. The switch must atomically combine `activeBranchId` change with source-branch epoch increment. Only the source (previous active) branch epoch increments; the target branch epoch is unchanged.

### D7. `@manifesto-ai/world` becomes a compatibility facade

`@manifesto-ai/world` is reduced from an independent constitutional owner to a composition facade that re-exports from `governance` and `lineage`, provides a convenience `createWorld()` entrypoint, and owns the commit coordinator role defined in D14.

**Facade owns the commit coordinator.** When both governance and lineage are present, their state changes must be committed atomically. The facade assembles the write set from lineage's prepared result and governance's terminalization, then commits them in a single store transaction. This is Strategy A (single-store atomic commit) — the only strategy permitted by this ADR. Physically separated stores (Strategy B/C) require reconciliation boundaries (durable journal, watermark, etc.) that exceed this ADR's scope and are deferred to a future ADR. D11.3 defines the composite store seam; D14 defines the coordinator's cross-protocol responsibility.

**SDK impact.** The existing `createManifesto()` code that calls `createWorld()` continues to work through the facade. SDK SPEC v1.0.0's `ManifestoConfig.store?: WorldStore` and re-export structure are not changed by this ADR. SDK surface changes are out of scope; if needed, they are addressed in a subsequent SDK SPEC patch.

**Facade lifecycle policy.** The facade MUST be maintained for at least 2 minor versions after the split. Removal SHOULD only occur at a major version boundary. A migration guide MUST be provided at deprecation time. The facade MAY be kept permanently if it retains value as a convenience wrapper.

### D8. Governance result event ownership

After the split, lineage does not emit events. All governance result events (`proposal:*`, `execution:completed`, `execution:failed`, `world:created`, `world:forked`) are owned and emitted by governance. In governance-free environments, App/SDK MAY emit its own events based on lineage seal results.

### D9. Rule namespace reclassification

Existing World rules are retagged to `LIN-*` (lineage) and `GOV-*` (governance). The complete mapping is provided in the Lineage SPEC and Governance SPEC respectively. Cross-cutting boundary rules (`WORLD-BOUNDARY-*`, `WORLD-SCHEMA-*`) are referenced by both package SPECs.

### D10. Invariant reclassification

Existing World invariants (INV-W, INV-P, INV-A, INV-EX, INV-EV, INV-LB, INV-H) are reclassified to `INV-L` (lineage) and `INV-G` (governance). Key reclassification notes:

* **INV-W14/W15** (ErrorSignature exclusion, lastError-based determination) move to lineage — they are hash normalization and outcome derivation rules, and lineage now owns `terminalStatus` derivation.
* **INV-W3** ("every non-genesis World has exactly one creating Proposal") becomes a conditional invariant — it applies only when governance is active. In governance-free environments, Worlds are created without Proposals.

The complete invariant migration matrix is provided in the Lineage SPEC and Governance SPEC respectively.

### D11. Storage seam — `LineageStore` and `GovernanceStore` are separate

The current World persistence model stores lineage data (Worlds, Snapshots, PatchDeltas, HashInputs, Edges, BranchState) and governance audit data (Proposals, DecisionRecords, ActorBindings) in a single WorldStore.

This ADR separates them into `LineageStore` (owned by `@manifesto-ai/lineage`) and `GovernanceStore` (owned by `@manifesto-ai/governance`). Each store interface knows nothing about the other's types.

#### D11.1. `LineageStore` owns continuity persistence and lineage-only atomic commit

**`LineageStore` includes an atomic commit method** for durable lineage-only use. This ensures that lineage-only users get the same crash consistency guarantees as governed environments, without needing the facade's composite store.

`LineageStore` owns only lineage records and branch CAS semantics. Governance concepts do not appear in this interface.

#### D11.2. `GovernanceStore` owns governance audit persistence only

`GovernanceStore` owns governance audit data (`Proposal`, `DecisionRecord`, `ActorAuthorityBinding`) as its own protocol-local persistence contract.

`GovernanceStore` does not expose lineage records, branch CAS operations, or lineage storage internals. Governance persists its own audit trail through this separate interface.

#### D11.3. Facade defines the composite store for Strategy A atomic commit

**Facade provides a composite store.** The facade defines a transaction-aware store that extends both `LineageStore` and `GovernanceStore`, adding an atomic commit method that commits lineage records and governance records together. This is the Strategy A single-store atomic commit.

Exact interface definitions are specified in the Lineage SPEC and Governance SPEC respectively.

### D12. Branch identity is a first-class governance contract

After the split, governance must persist and propagate target-branch identity explicitly. This makes branch-scoped sealing, observability, and execution policy traceable without requiring hidden coupling to lineage internals.

#### D12.1. `Proposal.branchId` is persisted truth

`Proposal` includes `branchId` as a persisted field. The target branch is recorded at proposal creation time and remains immutable for the proposal's lifetime.

This branch identity is used when constructing lineage seal inputs and when applying branch-scoped governance policies.

#### D12.2. `ProposalSubmittedEvent` includes `branchId`

The proposal-submission event includes `branchId` so subscribers can observe which branch a proposal targets without re-querying the proposal record.

#### D12.3. `ExecutionKeyContext` includes `branchId`

`ExecutionKeyContext` includes `branchId` so execution-key policies can serialize or partition work at the branch scope when needed.

### D13. Branch-scoped single-writer gate and stale ingress invalidation

After the split, governance enforces **at most one execution-stage proposal per branch at a time**.

This gate is branch-scoped, not global. Gate release must revalidate against the current branch head, and stale ingress-stage proposals are invalidated when the branch epoch advances due to head advance or branch switch. Late authority results for stale-epoch proposals are discarded.

### D14. Facade commit coordinator owns atomic cross-protocol seal commit

The facade's commit coordinator is the composition role that bridges governance finalization and lineage sealing without collapsing their boundaries.

The coordinator:

* calls lineage prepare APIs and governance finalize APIs in the required order
* assembles the combined write set when both protocols produce records
* commits lineage and governance records atomically through the composite store
* handles seal rejection as a coordinator concern — if lineage cannot create a World, it commits the governance-only terminalization path without fabricating lineage records

Lineage remains unaware of the coordinator. Governance remains responsible for judgment. The coordinator owns only orchestration and atomic commit at the composition boundary.

---

## 3. Consequences

### 3.1 Positive

1. **Adoption barrier reduced.** Lineage can be used independently — web apps that need no governance can adopt Manifesto easily.

2. **Responsibilities are clear.** Lineage is the continuity engine; governance is the legitimacy engine.

3. **Change blast radius reduced.** Hash/resume/persistence changes are isolated from authority/proposal lifecycle changes, and vice versa.

4. **Reusability improved.** Lineage works in thin governance environments. Governance can be independently tested with an in-memory lineage adapter.

5. **Documentation structure improved.** Two kinds of rules that were interleaved in a single World SPEC can now live in separate SPECs.

6. **Storage boundary clear.** `LineageStore` and `GovernanceStore` are separated — lineage-only environments need no `GovernanceStore` implementation.

7. **Branch conflict structurally prevented.** Single-writer per branch gate prevents execution-stage stale-head conflicts at the admission level. Stale ingress-stage proposals are invalidated via epoch-based mechanisms.

8. **Crash consistency guaranteed.** The facade commits lineage and governance state in a single logical transaction. Lineage-only environments get equivalent guarantees through `LineageStore`'s own atomic commit.

### 3.2 Negative

1. **Migration cost.** Import paths, rule IDs, docs links, and test names must be updated.

2. **Compatibility facade maintenance.** `@manifesto-ai/world` has a duplicate surface for a transitional period.

3. **Outcome derivation duplication.** Both governance (for proposal lifecycle) and lineage (for hash identity) derive outcome from the snapshot. The two must agree; disagreement is a bug signal.

4. **INV-G10 conditionalized.** "Every non-genesis World has one Proposal" no longer holds in governance-free environments.

5. **Store facade complexity.** New implementations must understand `LineageStore` and `GovernanceStore` separately.

6. **Commit coordinator complexity.** Only Strategy A (single-store atomic commit) is permitted. Physically separated stores are deferred.

---

## 4. Alternatives Considered

### A1. Keep `@manifesto-ai/world` and separate internal folders only

Rejected. Public ownership stays in `world`, so **lineage cannot be used independently** — the adoption barrier feedback is not addressed.

### A2. Split into `persistence` and `governance`

Rejected. The problem is not just storage but the entire lineage continuity. Head, resume, replay, branch persistence, and hash identity are constitutional, not storage-adapter details. `lineage` is a more accurate name than `persistence`.

### A3. Add a separate Runtime/Bridge layer

Rejected. This decision is package decomposition of the existing World scope, not a new layer.

### A4. Make governance optional at the SDK level without package split

Rejected. Even if governance config is optional in `createManifesto()`, the package still contains governance types and code. The real problem is coupling at import time, which only package separation solves.

---

## 5. Migration Plan

### Phase 1. Rule retagging + Lineage SPEC draft

* Retag existing World SPEC rules to `LIN-*` / `GOV-*`
* Provide old → new mapping appendix
* Draft Lineage SPEC v1.0.0 (based on World SPEC §5.3–5.5, §9)

### Phase 2. Lineage extraction

* Move hash / persistence / replay / head / resume / branch persistence to `@manifesto-ai/lineage`
* Implement `LineageStore`, seal prepare/commit contracts, `deriveTerminalStatus()`
* `@manifesto-ai/world` maintains re-exports

### Phase 3. Governance extraction

* Move actor / authority / proposal lifecycle / HostExecutor / governance events to `@manifesto-ai/governance`
* Governance communicates with lineage through the prepare-seal API
* Implement `GovernanceStore`, single-writer gate, stale invalidation
* Draft Governance SPEC v1.0.0 (based on World SPEC §5.6–5.7, §6, §7, §8)

### Phase 4. Facade stabilization + SDK alignment

* Reduce `@manifesto-ai/world` to composition facade
* Implement composite store and commit coordinator in facade
* Verify SDK re-export paths (legacy compatibility via facade)
* Provide migration guide and compatibility table

---

## 6. Non-Goals

* This ADR does not define a new architectural layer.
* This ADR does not redefine Host or SDK responsibilities.
* Merge lineage semantics are not added. Merge is a governance responsibility (legitimacy judgment), not a lineage responsibility (continuity substrate). Lineage remains a fork-only DAG.
* Governance policy model itself is not changed.
* SDK's `ManifestoConfig` surface is not changed (deferred to SDK SPEC patch).
* Reconciliation strategies for physically separated stores (Strategy B/C) are not defined. Only Strategy A is permitted. Deferred to future ADR.
* Failed genesis is not permitted. "Headless branch" resume semantics are deferred to future ADR.
* Exact TypeScript interfaces, store method signatures, CAS semantics, runtime sequence diagrams, and pseudocode are not normatively defined in this ADR. They are deferred to the Lineage SPEC, Governance SPEC, and Facade SPEC respectively.

---

## 7. Related Decisions / Compatibility

| Related ADR | Impact |
|-------------|--------|
| ADR-001 (Layer Separation) | Maintained. "Results are World's; Process is App's" continues to apply to governance events |
| ADR-003 (World Owns Persistence) | Refined to "**Lineage** owns continuity persistence" |
| ADR-006 (PUB/CHAN/CAN) | Maintained. CHAN-2 applies to lineage seal. `traceRef` is a non-identity field set at creation time only — no post-hoc mutation |
| ADR-010 (Protocol-First SDK) | No SDK surface change. Legacy compatibility via facade |

---

## 8. Summary

> World carried two constitutions under one name.
> Legitimacy (who approves) and Continuity (how history continues) are now
> promoted to independent protocols — **Governance** and **Lineage**.
>
> Users who need no governance can use lineage alone for Manifesto's core value —
> snapshot history, resume, deterministic identity.
>
> This is not dismantling. It is **expanding accessibility**.

---

## 9. Forward References — SPEC Work Required

This ADR establishes the architectural decisions. The following items require normative specification in the respective package SPECs and are **not defined in this ADR**:

### Lineage SPEC v1.0.0

* `LineageStore` interface (methods, joint CAS semantics, atomic commit contract)
* `PreparedGenesisCommit` / `PreparedNextCommit` type definitions
* `PreparedBranchBootstrap` / `PreparedBranchMutation` type definitions
* `LineageService` interface (prepare/commit API surface)
* `deriveTerminalStatus()` specification
* `switchActiveBranch()` precise semantics
* BaseWorld admissibility rules (`LIN-BASE-*`)
* Head advance rules (`LIN-HEAD-ADV-*`)
* Branch seal rules (`LIN-BRANCH-SEAL-*`)
* Genesis rules (`LIN-GENESIS-*`)
* Branch switch rules (`LIN-SWITCH-*`)
* Store rules (`LIN-STORE-*`, `LIN-SEAL-*`)
* Hash, persistence, replay, resume, branch recovery rules
* Invariant migration matrix (`INV-L-*`)
* Rule retagging mapping (old `WORLD-*` → new `LIN-*`)

### Governance SPEC v1.0.0

* `GovernanceStore` interface and exact store method signatures
* Exact type definitions for `Proposal.branchId`, `ProposalSubmittedEvent.branchId`, and `ExecutionKeyContext.branchId`
* `PreparedGovernanceCommit` type definition
* Single-writer gate rules (`GOV-BRANCH-GATE-*`)
* Proposal branch identity rules (`GOV-BRANCH-*`)
* Stale ingress invalidation semantics (gate-release revalidation, late authority discard)
* Seal coordination protocol, including the coordinator-facing seal rejection path
* Invariant migration matrix (`INV-G-*`)
* Rule retagging mapping (old `WORLD-*` → new `GOV-*`)

### Facade / World SPEC update

* Composite store interface (`commitSeal()`)
* Write-set type definition
* Exact coordinator orchestration protocol for normal and seal-rejection paths
* Facade lifecycle and deprecation policy details

---

*End of ADR-014*
