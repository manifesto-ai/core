# Manifesto Governance Specification v5.0.0

> **Status:** Normative (Living Document)
> **Package:** `@manifesto-ai/governance`
> **Compatible with:** Manifesto v5 substrate, ADR-025 Snapshot Ontology, SDK SPEC v5, Lineage SPEC v5
> **Implements:** ADR-017, ADR-025, ADR-026

> **Historical Note:** [governance-SPEC-2.0.0v.md](governance-SPEC-2.0.0v.md)
> is retained as the service-first baseline before ADR-017. Git history
> preserves the v3 decorator runtime contract centered on `proposeAsync()`,
> `waitForProposal()`, and `waitForProposalWithReport()`.
>
> **Current Contract Status:** Governance v5 is the legitimacy-owning decorator
> for the SDK v5 action-candidate runtime. The canonical governed write ingress
> is `actions.x.submit(...)` / `action(name).submit(...)` on a governance-mode
> `ManifestoApp`. V3 proposal helper names are historical migration inputs, not
> canonical v5 runtime root methods.

---

## 1. Change Log

| Version | Change | Source |
|---------|--------|--------|
| v5.0.0 | Adopt ADR-026 governance-mode `submit()` surface, durable `ProposalRef`, runtime `waitForSettlement(ref)`, and ADR-025 failure observation wording | ADR-025, ADR-026 |
| v3.0.0 | Decorator runtime with `proposeAsync()`, pending resolution, and additive proposal settlement helpers | ADR-017 |
| v2.0.0 | Service-first governance protocol baseline | ADR-015, ADR-016 |

## 2. Purpose

`@manifesto-ai/governance` owns governed legitimacy for Manifesto runtimes.

Governance owns:

- `withGovernance()` composition over explicit lineage semantics
- proposal creation and durable proposal references
- authority evaluation and decision recording
- pending human or tribunal resolution
- governance-mode `submit()` semantics
- settlement re-observation through `waitForSettlement(ref)`
- governance control surface for approval, rejection, proposal lookup, decision
  lookup, and actor binding

Governance does not own semantic computation, Host effect execution, Lineage
continuity storage, Lineage world identity, or direct state publication.

The v5 public model is:

```typescript
const app = withGovernance(withLineage(createManifesto(schema, effects), {
  store,
}), {
  bindings,
  execution,
}).activate();

const pending = await app.actions.approveInvoice.submit({ invoiceId });
const settlement = await pending.waitForSettlement();
```

`submit()` is the common SDK verb, but the governance decorator owns what it
means in governance mode: admitted candidates enter the proposal and authority
path. Governance `submit()` does not mean direct execution.

---

## 3. Public Surface

### 3.1 Decorator Entry

```typescript
declare function withGovernance<TDomain extends ManifestoDomainShape>(
  manifesto: ComposableManifesto<TDomain, "lineage">,
  config: GovernanceConfig<TDomain>,
): ComposableManifesto<TDomain, "governance">;
```

`withGovernance()` decorates a composable manifesto. It does not create a live
runtime and MUST NOT expose runtime verbs before `activate()`.

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V5-CFG-1 | MUST | `withGovernance()` MUST accept composable manifestos, not live runtime instances. |
| GOV-V5-CFG-2 | MUST | `withGovernance()` MUST receive a manifesto already decorated with `withLineage()`. |
| GOV-V5-CFG-3 | MUST NOT | Governance MUST NOT create lineage implicitly on behalf of the caller. |
| GOV-V5-CFG-4 | MUST | Governance MUST use the explicit lineage configuration supplied by the decorated manifesto. |

### 3.2 Config Contract

```typescript
type GovernanceConfig<TDomain extends ManifestoDomainShape = ManifestoDomainShape> = {
  readonly bindings: readonly ActorAuthorityBinding[];
  readonly governanceStore?: GovernanceStore;
  readonly evaluator?: AuthorityEvaluator;
  readonly eventSink?: GovernanceEventSink;
  readonly now?: () => number;
  readonly execution: {
    readonly projectionId: string;
    readonly deriveActor: (candidate: GovernanceSubmittedCandidate<TDomain>) => ActorRef;
    readonly deriveSource: (candidate: GovernanceSubmittedCandidate<TDomain>) => SourceRef;
  };
};

type GovernanceSubmittedCandidate<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain> = ActionName<TDomain>,
> = {
  readonly action: Name;
  readonly input: ActionInput<TDomain, Name>;
};
```

The current implementation may derive actor/source from the internal `Intent`
protocol. The v5 public contract describes the action candidate boundary. The
internal protocol remains an implementation detail.

### 3.3 Activated Runtime

```typescript
type GovernanceInstance<TDomain extends ManifestoDomainShape> =
  ManifestoApp<TDomain, "governance">
  & LineageContinuitySurface<TDomain>
  & GovernanceControlSurface<TDomain>;

type ProposalRecord = Proposal;

type GovernanceControlSurface<TDomain extends ManifestoDomainShape> = {
  approve(proposal: ProposalRef, approvedScope?: IntentScope | null): Promise<ProposalRecord>;
  reject(proposal: ProposalRef, reason?: string): Promise<ProposalRecord>;
  getProposal(proposal: ProposalRef): Promise<ProposalRecord | null>;
  getProposals(branchId?: BranchId): Promise<readonly ProposalRecord[]>;
  bindActor(binding: ActorAuthorityBinding): Promise<void>;
  getActorBinding(actorId: ActorId): Promise<ActorAuthorityBinding | null>;
  getDecisionRecord(decisionId: DecisionId): Promise<DecisionRecord | null>;
};
```

The SDK owns `ManifestoApp`, action handles, admission, preview, projected
snapshot reads, observation, and inspection. Lineage owns
`LineageContinuitySurface`. Governance owns the control surface above and the
governance-mode implementation of `submit()`.

`approve()`, `reject()`, proposal lookup, decision lookup, and actor binding are
governance-owned control/admin methods. They are not the canonical app-facing
action submission grammar and they do not provide lower-authority execution
backdoors.

`ProposalRecord` is the governance-owned proposal read model. Current
implementations MAY expose it as `Proposal` when that type is already the public
proposal read boundary.

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V5-SFC-1 | MUST | Activated governance runtimes MUST expose the SDK v5 root grammar plus `GovernanceControlSurface`. |
| GOV-V5-SFC-2 | MUST | `actions.x.submit()` and `action(name).submit()` MUST be the canonical governed action submission ingress. |
| GOV-V5-SFC-3 | MUST | `app.waitForSettlement(ref)` MUST be reachable on governance-mode runtimes. |
| GOV-V5-SFC-4 | MUST | `approve()`, `reject()`, and lookup methods MUST be treated as governance control surface, not action submission verbs. |
| GOV-V5-SFC-5 | MUST NOT | Governance control methods MUST NOT expose direct base or lineage execution. |
| GOV-V5-SFC-6 | MUST | Lineage continuity query and restore methods remain Lineage-owned even when exposed through a governance runtime. |

### 3.4 V3 Hard-Cut Removals

The following v3 governance names are not canonical v5 runtime root surface:

```text
proposeAsync
waitForProposal
waitForProposalWithReport
```

Migration mapping:

| v3 API | v5 API |
|--------|--------|
| `proposeAsync(intent)` | `actions.x.submit(input)` on a governance runtime |
| `waitForProposal(app, proposalOrId)` | `pending.waitForSettlement()` or `app.waitForSettlement(ref)` |
| `waitForProposalWithReport(app, proposalOrId)` | `GovernanceSettlementResult.report` |

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V5-HC-1 | MUST | V3 proposal helper names MUST be absent from the canonical v5 governance runtime root. |
| GOV-V5-HC-2 | MUST | Migration documentation MAY reference v3 names only as historical mapping guidance. |
| GOV-V5-HC-3 | MUST NOT | A governance compat alias MUST NOT bypass decorator-owned `submit()` authority. |

---

## 4. Governance Submission Result

The SDK fixes the common discriminants and result envelope. Governance owns the
meaning of `ProposalRef`, authority settlement, decision records, and
`GovernanceSettlementReport`.

```typescript
type ProposalRef = string;

type GovernanceSubmissionResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | {
      readonly ok: true;
      readonly mode: "governance";
      readonly status: "pending";
      readonly action: Name;
      readonly proposal: ProposalRef;
      waitForSettlement(): Promise<GovernanceSettlementResult<TDomain, Name>>;
    }
  | {
      readonly ok: false;
      readonly mode: "governance";
      readonly action: Name;
      readonly admission: AdmissionFailure<Name>;
    };
```

`result.ok` means the submission protocol reached the governance law boundary.
It does not mean the proposal was approved, executed, rejected, or published.

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V5-RESULT-1 | MUST | Successful governance submissions MUST return `mode: "governance"` and `status: "pending"`. |
| GOV-V5-RESULT-2 | MUST | Successful governance submissions MUST include durable `proposal: ProposalRef`. |
| GOV-V5-RESULT-3 | MUST | Admission failures MUST resolve as `ok: false` and MUST NOT create a proposal. |
| GOV-V5-RESULT-4 | MUST | `result.ok` MUST represent the submission protocol envelope, not authority approval or domain success. |
| GOV-V5-RESULT-5 | MUST | The result-bound `waitForSettlement()` MUST observe the same proposal identified by `result.proposal`. |

### 4.1 ProposalRef

`ProposalRef` is the durable settlement handle.

The public boundary is a string. Implementations MAY brand the string at the
type level, but the runtime value MUST be a stable string representation that
survives process boundaries.

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V5-PREF-1 | MUST | `ProposalRef` MUST be serializable to a stable string representation. |
| GOV-V5-PREF-2 | MUST | `ProposalRef` MUST survive process restart, agent handoff, and loss of the original JS result object. |
| GOV-V5-PREF-3 | MUST NOT | `ProposalRef` MUST NOT carry references to in-process objects, closures, or non-serializable runtime state. |
| GOV-V5-PREF-4 | MUST | `ProposalRef` MUST be sufficient for `app.waitForSettlement(ref)` to re-observe settlement. |

---

## 5. Settlement Surface

### 5.1 Runtime Re-Attachment

```typescript
type GovernanceSettlementSurface<TDomain extends ManifestoDomainShape> = {
  waitForSettlement(
    ref: ProposalRef,
  ): Promise<GovernanceSettlementResult<TDomain, ActionName<TDomain>>>;
};
```

`app.waitForSettlement(ref)` is equivalent to calling `waitForSettlement()` on
the original pending submit result. It observes settlement; it does not cause
settlement and it does not bypass authority.

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V5-SETTLE-1 | MUST | Governance-mode runtimes MUST expose `app.waitForSettlement(ref)`. |
| GOV-V5-SETTLE-2 | MUST | Base and lineage runtimes MUST NOT expose `app.waitForSettlement(ref)`. |
| GOV-V5-SETTLE-3 | MUST | `app.waitForSettlement(ref)` MUST work after process restart when backed by a store containing the referenced proposal. |
| GOV-V5-SETTLE-4 | MUST NOT | The observer method MUST NOT be named `settle()`. |
| GOV-V5-SETTLE-5 | MUST NOT | `waitForSettlement()` MUST NOT approve, reject, execute, seal, or publish by itself. |

### 5.2 Settlement Result

```typescript
type GovernanceSettlementResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | {
      readonly ok: true;
      readonly mode: "governance";
      readonly status: "settled";
      readonly action: Name;
      readonly proposal: ProposalRef;
      readonly world: WorldRecord;
      readonly before: ProjectedSnapshot<TDomain>;
      readonly after: ProjectedSnapshot<TDomain>;
      readonly outcome: ExecutionOutcome;
      readonly report?: GovernanceSettlementReport;
    }
  | {
      readonly ok: true;
      readonly mode: "governance";
      readonly status: "rejected" | "superseded" | "expired" | "cancelled";
      readonly action: Name;
      readonly proposal: ProposalRef;
      readonly decision?: DecisionRecord;
      readonly report?: GovernanceSettlementReport;
    }
  | {
      readonly ok: false;
      readonly mode: "governance";
      readonly status: "settlement_failed";
      readonly action: Name;
      readonly proposal: ProposalRef;
      readonly error: ErrorValue;
      readonly report?: GovernanceSettlementReport;
    };
```

`settled` is used only when authority permits execution and the runtime reaches
a sealed world result. Rejected, superseded, expired, and cancelled proposals are
governance lifecycle outcomes, not execution outcomes.

For `settled` results, `before` MUST be the projected snapshot at
`proposal.baseWorld` and `after` MUST be the projected snapshot of the sealed
result world. These fields are proposal settlement truth; they MUST NOT be
derived from the current visible runtime head unless that head is the same
lineage world.

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V5-SETTLE-6 | MUST | `settled` results MUST include the sealed `world: WorldRecord`. |
| GOV-V5-SETTLE-7 | MUST | `rejected`, `superseded`, `expired`, and `cancelled` results MUST NOT fabricate `world`, `before`, `after`, or `outcome`. |
| GOV-V5-SETTLE-8 | MUST | `settlement_failed` MUST be `ok: false` and MUST include `error: ErrorValue`. |
| GOV-V5-SETTLE-9 | MUST | Settlement result statuses MUST be limited to `settled`, `rejected`, `superseded`, `expired`, `cancelled`, and `settlement_failed`. |
| GOV-V5-SETTLE-10 | MUST | Governance settlement reports MUST remain additive and MUST NOT weaken proposal, authority, lineage, or seal law. |
| GOV-V5-SETTLE-11 | MUST | `settled.before` MUST project the stored canonical snapshot at `proposal.baseWorld`. |
| GOV-V5-SETTLE-12 | MUST | `settled.after` MUST project the sealed result world snapshot. |

### 5.3 Settlement Report

`GovernanceSettlementReport` is an additive report. It carries governance,
authority, and lineage continuity facts without replacing
`GovernanceSettlementResult`.

```typescript
type GovernanceSettlementReport =
  | {
      readonly mode: "governance";
      readonly status: "settled";
      readonly action: string;
      readonly proposal: ProposalRef;
      readonly baseWorldId: WorldId;
      readonly worldId: WorldId;
      readonly sealedSnapshotHash: string;
      readonly published: boolean;
      readonly outcome: ExecutionOutcome;
      readonly changes: readonly ChangedPath[];
      readonly requirements: readonly Requirement[];
    }
  | {
      readonly mode: "governance";
      readonly status: "rejected" | "superseded" | "expired" | "cancelled";
      readonly action: string;
      readonly proposal: ProposalRef;
      readonly decision?: DecisionRecord;
    }
  | {
      readonly mode: "governance";
      readonly status: "settlement_failed";
      readonly action: string;
      readonly proposal?: ProposalRef;
      readonly stage: "authority" | "runtime" | "settlement" | "persistence" | "observation";
      readonly error: ErrorValue;
    };
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V5-REPORT-1 | MUST | Reports MUST preserve all proposal, authority, lineage, and seal rules. |
| GOV-V5-REPORT-2 | MUST | Settled reports MUST identify `proposal`, `baseWorldId`, `worldId`, `sealedSnapshotHash`, and `outcome`. |
| GOV-V5-REPORT-3 | MUST | Rejected, superseded, expired, and cancelled reports MUST remain governance lifecycle facts only. |
| GOV-V5-REPORT-4 | MUST NOT | Lifecycle-only reports MUST NOT fabricate execution diffs, worlds, or outcomes. |
| GOV-V5-REPORT-5 | MUST NOT | `settlement_failed` reports MUST NOT fabricate `worldId`, `outcome`, `before`, or `after`. |

---

## 6. Governance-Aware Submit Law

Governance-mode `submit()` means:

1. Run SDK admission for the bound action candidate.
2. Create a durable governance proposal.
3. Return a pending governance result carrying `ProposalRef`.
4. Evaluate authority and execute settlement through governance-controlled
   lifecycle processing.
5. Let settlement be observed through the result-bound or runtime
   `waitForSettlement()` surface.

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V5-SUBMIT-1 | MUST | Governance `submit()` MUST preserve SDK admission ordering: availability, input, then dispatchability. |
| GOV-V5-SUBMIT-2 | MUST | Governance `submit()` MUST re-check legality against the then-current runtime state. |
| GOV-V5-SUBMIT-3 | MUST | Unavailable or invalid candidates MUST return an admission failure without creating a proposal. |
| GOV-V5-SUBMIT-4 | MUST NOT | Prior `available()`, `check()`, or `preview()` results MUST NOT be treated as durable capability tokens. |
| GOV-V5-SUBMIT-5 | MUST | Governance `submit()` MUST create or enter the proposal path. |
| GOV-V5-SUBMIT-6 | MUST NOT | Governance `submit()` MUST NOT directly execute base or lineage write verbs. |
| GOV-V5-SUBMIT-7 | MUST NOT | Governed runtimes MUST NOT expose lower-authority direct execution through `submit()` or any other public verb. |
| GOV-V5-SUBMIT-8 | MUST | A proposal created by `submit()` MUST be observable through `ProposalRef`. |
| GOV-V5-SUBMIT-9 | MUST | Governance `submit()` MUST emit governance proposal lifecycle events only after the corresponding governance record exists. |
| GOV-V5-SUBMIT-10 | MUST | Governance `submit()` MUST initially resolve with `status: "pending"` even when authority can auto-approve. |

### 6.1 Authority and Control

Pending HITL or tribunal proposals remain pending until governance control
surface methods resolve them.

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V5-AUTH-1 | MUST | Pending HITL or tribunal proposals MUST remain pending until `approve()` or `reject()` resolves them. |
| GOV-V5-AUTH-2 | MUST | `approve()` and `reject()` MUST operate on governance proposal records, not on raw action candidates. |
| GOV-V5-AUTH-3 | MUST | Authority decisions MUST be recorded before settlement observation reports the decision. |
| GOV-V5-AUTH-4 | MUST NOT | Governance MUST NOT rewrite the submitted action candidate except through explicit approved scope constraints. |

### 6.2 Execution and Publication

Approved governance execution uses the SDK runtime path and lineage sealing. It
does not use governance-owned direct execution.

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V5-EXEC-1 | MUST | Approved governed execution MUST run through the SDK/Host runtime path and Lineage sealing. |
| GOV-V5-EXEC-2 | MUST | Completed governed execution MUST seal first, then publish the visible snapshot, then report settlement. |
| GOV-V5-EXEC-3 | MUST | Failed terminal governed execution MAY seal a failed lineage world and terminal proposal record. |
| GOV-V5-EXEC-4 | MUST NOT | Failed terminal governed execution MUST NOT publish the failed snapshot as the visible runtime snapshot. |
| GOV-V5-EXEC-5 | MUST | Governance events MUST be emitted only after the corresponding proposal, decision, seal, or settlement record is durable. |

---

## 7. Failure Observation

Governance settlement failure and domain failure are separate.

- A settled governed execution with domain `outcome.kind: "fail"` remains
  `ok: true`, `status: "settled"` when the proposal and lineage seal settled.
- A failure before a durable `ProposalRef` is created is an operational submit
  failure and `submit()` rejects with `SubmissionFailedError`.
- After a durable `ProposalRef` exists, authority, runtime, seal, persistence,
  or observation failure is reported by `waitForSettlement()` as `ok: false`,
  `status: "settlement_failed"`.
- Settlement failure MUST NOT fabricate `world`, `before`, `after`, or
  `outcome`.

Semantic failure observation is derived from the canonical Snapshot's
`system.lastError` and `system.pendingRequirements`. Host-owned
`namespaces.host.lastError` is canonical diagnostic state and MUST NOT be merged
into settlement `ErrorInfo` or `ExecutionOutcome`.

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V5-ERR-1 | MUST | Domain success, stop, or fail MUST be represented by `ExecutionOutcome` on `settled` results. |
| GOV-V5-ERR-2 | MUST | `settlement_failed` MUST describe governance, authority, runtime, seal, persistence, or observation failure. |
| GOV-V5-ERR-3 | MUST | Settlement `ErrorInfo` and execution outcome failure state MUST derive from `system.lastError` and pending requirements. |
| GOV-V5-ERR-4 | MUST NOT | Governance settlement `ErrorInfo` MUST NOT merge Host-owned `namespaces.host.lastError` into semantic failure observation. |
| GOV-V5-ERR-5 | MUST NOT | Governance MUST NOT promote Host-owned namespace diagnostics into semantic Snapshot state. |
| GOV-V5-ERR-6 | MUST | Operational failure before durable `ProposalRef` creation MUST reject `submit()` rather than fabricate a governance settlement result. |
| GOV-V5-ERR-7 | MUST | Operational failure after durable `ProposalRef` creation MUST be re-observable through `waitForSettlement(ref)`. |

---

## 8. Low-Level Provider Surface

Low-level seams are owned by the provider entry point:

- `@manifesto-ai/governance/provider`
- `createGovernanceService()`
- `createGovernanceEventDispatcher()`
- `createAuthorityEvaluator()`
- authority handlers and protocol types

`createInMemoryGovernanceStore()` remains available from the root package as a
consumer-safe bootstrap helper.

They are valid low-level seams but are no longer the canonical application entry
path.

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V5-PROVIDER-1 | MUST | Low-level provider APIs MUST remain governance-owned seams. |
| GOV-V5-PROVIDER-2 | MUST NOT | Provider APIs MUST NOT be documented as the canonical v5 application entry path. |
| GOV-V5-PROVIDER-3 | MUST NOT | Governance provider APIs MUST NOT compute lineage world identity or apply patches directly. |

---

## 9. Compliance Checklist

An implementation is v5-compliant only if all of the following hold:

- `withGovernance()` accepts a lineage-decorated composable manifesto and exposes
  no runtime verbs before activation.
- Activated governance runtime exposes the SDK v5 action-candidate grammar.
- Canonical governed write ingress is `actions.x.submit()` /
  `action(name).submit()`.
- Governance `submit()` creates or enters the proposal path and never directly
  executes base or lineage lower-authority verbs.
- `GovernanceSubmissionResult` carries durable `ProposalRef`.
- `ProposalRef` survives process boundaries and can be re-attached through
  `app.waitForSettlement(ref)`.
- Settlement statuses are limited to `settled`, `rejected`, `superseded`,
  `expired`, `cancelled`, and `settlement_failed`.
- Approval, rejection, lookup, and binding methods are governance control
  surface, not action submission verbs.
- V3 `proposeAsync()`, `waitForProposal()`, and `waitForProposalWithReport()`
  are absent from the canonical v5 runtime root.
- Semantic failure observation uses `system.lastError` and pending requirements,
  not Host-owned `namespaces.host.lastError`.
- Low-level provider APIs remain available but are not the canonical application
  entry path.
