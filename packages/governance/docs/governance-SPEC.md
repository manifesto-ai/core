# Manifesto Governance Specification

> **Status:** Normative (Living Document)
> **Package:** `@manifesto-ai/governance`
> **ADR Basis:** [ADR-017 v3.1](../../../docs/internals/adr/017-capability-decorator-pattern.md)

## 1. Scope

This draft defines the governed decorator runtime for Manifesto.

Governance v3 owns:

- `withGovernance(manifesto, config)`
- the activated `GovernanceInstance`
- proposal creation and authority evaluation
- pending human resolution through `approve()` / `reject()`
- post-commit governance visibility through decision records and governance events

Governance v3 does not own base manifesto creation. That remains `@manifesto-ai/sdk`.

## 2. Canonical Public API

```ts
function withGovernance<T extends ManifestoDomainShape>(
  manifesto: LineageComposableManifestoInput<T>,
  config: GovernanceConfig<T>,
): GovernanceComposableManifesto<T>;

function waitForProposal<T extends ManifestoDomainShape>(
  app: GovernanceInstance<T>,
  proposalOrId: Proposal | ProposalId,
  options?: WaitForProposalOptions,
): Promise<ProposalSettlement<T>>;

function waitForProposalWithReport<T extends ManifestoDomainShape>(
  app: GovernanceInstance<T>,
  proposalOrId: Proposal | ProposalId,
  options?: WaitForProposalOptions,
): Promise<ProposalSettlementReport<T>>;
```

## 3. Config Contract

```ts
type GovernanceConfig<T extends ManifestoDomainShape = ManifestoDomainShape> = {
  bindings: readonly ActorAuthorityBinding[];
  governanceStore?: GovernanceStore;
  evaluator?: AuthorityEvaluator;
  eventSink?: GovernanceEventSink;
  now?: () => number;
  execution: {
    projectionId: string;
    deriveActor(intent: TypedIntent<T>): ActorRef;
    deriveSource(intent: TypedIntent<T>): SourceRef;
  };
};
```

## 4. Lineage Guarantee

Governed runtimes MUST include lineage semantics.

- `withGovernance()` MUST receive a manifesto already composed with `withLineage()`.
- Governance MUST use that explicit lineage configuration.
- Governance MUST NOT create lineage implicitly on behalf of the caller.

## 5. Activated Runtime

```ts
type GovernanceInstance<T> =
  Omit<LineageInstance<T>, "commitAsync"> & {
    proposeAsync(intent: TypedIntent<T>): Promise<Proposal>;
    approve(proposalId: ProposalId, approvedScope?: IntentScope | null): Promise<Proposal>;
    reject(proposalId: ProposalId, reason?: string): Promise<Proposal>;
    getProposal(proposalId: ProposalId): Promise<Proposal | null>;
    getProposals(branchId?: BranchId): Promise<readonly Proposal[]>;
    bindActor(binding: ActorAuthorityBinding): Promise<void>;
    getActorBinding(actorId: ActorId): Promise<ActorAuthorityBinding | null>;
    getDecisionRecord(decisionId: DecisionId): Promise<DecisionRecord | null>;
  };
```

The inherited read surfaces keep their lineage/SDK meanings:

- `getSnapshot()` is the projected application-facing runtime read
- `getCanonicalSnapshot()` is the current visible canonical runtime substrate
- `getWorldSnapshot(worldId)` is the stored canonical snapshot for a sealed world
- `getAvailableActions()`, `isActionAvailable()`, `isIntentDispatchable()`, `getIntentBlockers()`, `getActionMetadata()`, `getSchemaGraph()`, and `simulate()` remain inherited read/query surfaces
- `getAvailableActions()` and `isActionAvailable()` remain current visible-snapshot observational reads, not durable capability grants
- inherited legality queries preserve the base SDK ordering: availability is checked before dispatchability
- inherited `getIntentBlockers()` returns the first failing layer, so unavailable intents surface an `available` blocker without evaluating `dispatchable`

`waitForProposal()` and `waitForProposalWithReport()` are root-export observation helpers. They are additive and MUST NOT replace the governed write path.

### 5.1 `waitForProposal()`

`waitForProposal()` observes proposal settlement without changing governed execution law.

- the canonical state-change path remains `proposeAsync(intent) -> approve()/reject()`
- if the latest proposal is terminal, `waitForProposal()` MUST return `completed`, `failed`, `rejected`, or `superseded`
- if the latest proposal is non-terminal and `timeoutMs` is omitted or `0`, it MUST return `pending`
- if `timeoutMs > 0`, it MUST poll `getProposal()` until the proposal becomes terminal or the observation deadline is reached
- timing out MUST return `timed_out`; it is an observation boundary, not an execution failure
- missing proposals MUST reject with `GOVERNANCE_PROPOSAL_NOT_FOUND`
- disposed governed runtimes MUST reject with `DisposedError`
- `completed` MUST include the current visible projected snapshot from `getSnapshot()` plus `resultWorld`
- `failed` MUST include `ErrorInfo` and MUST NOT fabricate a visible snapshot
- `failed` SHOULD include `resultWorld` when a sealed failed world exists; when execution fails before a result world is recorded, `failed` MAY omit `resultWorld` and return summary-only `ErrorInfo`
- when `resultWorld` exists, failed-branch `ErrorInfo` MUST follow the same shape as governance `execution:failed` events: `summary`, optional `currentError`, optional `pendingRequirements`
- callers that need the stored failed world MUST use `getWorldSnapshot(resultWorld)` directly when `resultWorld` is present

### 5.2 `waitForProposalWithReport()`

`waitForProposalWithReport()` is the additive governance settlement-report companion.

It observes the same proposal lifecycle as `waitForProposal()`, but when settlement truth includes sealed worlds it packages a first-party execution outcome anchored on stored lineage worlds rather than on the current visible head.

Illustrative public shape:

```ts
type ProposalSettlementReport<T extends ManifestoDomainShape> =
  | {
      readonly kind: "completed";
      readonly proposal: Proposal & { readonly status: "completed"; readonly resultWorld: WorldId };
      readonly baseWorld: WorldId;
      readonly resultWorld: WorldId;
      readonly outcome: ExecutionOutcome<T>;
    }
  | {
      readonly kind: "failed";
      readonly proposal: Proposal & { readonly status: "failed" };
      readonly baseWorld: WorldId;
      readonly published: false;
      readonly error: ErrorInfo;
      readonly resultWorld?: WorldId;
      readonly sealedOutcome?: ExecutionOutcome<T>;
    }
  | { readonly kind: "rejected"; readonly proposal: Proposal & { readonly status: "rejected" } }
  | { readonly kind: "superseded"; readonly proposal: Proposal & { readonly status: "superseded" } }
  | { readonly kind: "pending"; readonly proposal: Proposal }
  | { readonly kind: "timed_out"; readonly proposal: Proposal };
```

Normative rules:

- `waitForProposalWithReport()` MUST remain additive and MUST NOT replace `proposeAsync()`
- for `completed`, the report MUST derive `ExecutionOutcome<T>` from `proposal.baseWorld -> proposal.resultWorld`
- for `completed`, the report MUST NOT use the current visible runtime head as the settlement `after` truth
- for `failed` with `resultWorld`, the report MUST include `published: false` and MAY include `sealedOutcome` derived from `proposal.baseWorld -> proposal.resultWorld`
- for `failed` without `resultWorld`, the report MUST remain summary-only and MUST NOT fabricate `sealedOutcome`
- `rejected`, `superseded`, `pending`, and `timed_out` reports MUST remain proposal-state observations only and MUST NOT fabricate execution diffs
- governance settlement report derivation MUST reuse the same projected snapshot, changed-path, and availability-delta semantics already used by SDK/Lineage report companions
- governance settlement reports in this phase MUST NOT expose diagnostics or raw host traces as part of the public contract

## 6. Verb Promotion

Governed runtimes MUST NOT expose `dispatchAsync`, `dispatchAsyncWithReport`, `commitAsync`, or `commitAsyncWithReport`.

The canonical state-change path is:

`proposeAsync(intent) -> approve()/reject()`

## 7. Proposal Semantics

### 7.1 `proposeAsync()`

`proposeAsync()` MUST:

1. ensure lineage continuity is ready
2. derive actor/source metadata from `config.execution`
3. create and persist a submitted proposal
4. move that proposal into `evaluating`
5. evaluate authority according to the resolved actor binding

Proposal admission MUST evaluate inherited availability, input validation, and dispatchability against the current visible snapshot at proposal time. A prior `getAvailableActions()` or `isActionAvailable()` read MUST NOT be treated as a durable capability token for later proposal admission.

### 7.2 Immediate Outcomes

- `auto_approve` and policy rules MAY resolve during `proposeAsync()`
- an immediately rejected proposal MUST be persisted as terminal `rejected`
- an immediately approved proposal MUST execute through lineage sealing before returning

### 7.3 Pending Outcomes

- HITL and tribunal policies MUST leave the proposal in `evaluating`
- `approve()` and `reject()` MAY only operate on `evaluating` proposals

## 8. Execution And Publication

Approved governance execution MUST run through lineage sealing.

- completion MUST seal first, then publish the visible snapshot, then resolve
- failed terminal execution MUST still produce a lineage world and terminal proposal record
- failed terminal execution MUST NOT publish the failed snapshot as the visible runtime snapshot
- governance events are emitted through `eventSink` only after seal/finalize completes

## 9. Low-Level Exports

Low-level seams are owned by the provider entry point:

- `@manifesto-ai/governance/provider`
- `createGovernanceService()`
- `createGovernanceEventDispatcher()`
- `createAuthorityEvaluator()`
- authority handlers and protocol types

`createInMemoryGovernanceStore()` also remains available from the root package as a consumer-safe bootstrap helper.

They are valid low-level seams but are no longer the canonical application entry path.

## 10. Hard-Cut Removals From The Governance Story

Governance v3 no longer teaches:

- service-first assembly as the package’s primary entry path
- `@manifesto-ai/world` as the canonical governed composition surface
- any governed runtime that still exposes direct `dispatchAsync` or `commitAsync`

## 11. Normative Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V3-1 | MUST | `withGovernance()` MUST accept composable manifestos, not live runtime instances |
| GOV-V3-2 | MUST | governed activation MUST require explicit lineage semantics |
| GOV-V3-3 | MUST NOT | governed runtimes MUST NOT expose `dispatchAsync` or `commitAsync` |
| GOV-V3-4 | MUST | `withGovernance()` accept only manifestos already decorated by `withLineage()` |
| GOV-V3-5 | MUST NOT | governance MUST NOT create lineage implicitly on behalf of the caller |
| GOV-V3-6 | MUST | pending HITL or tribunal proposals MUST remain in `evaluating` until `approve()` or `reject()` resolves them |
| GOV-V3-7 | MUST | approved execution MUST seal through lineage before visible snapshot publication |
| GOV-V3-8 | MUST NOT | failed governed execution MUST NOT publish the failed snapshot as the visible runtime snapshot |
| GOV-V3-9 | MUST | inherited legality queries preserve the base SDK availability-before-dispatchability ordering |
| GOV-V3-10 | MUST | inherited `getIntentBlockers()` expose only the first failing legality layer |
| GOV-V3-11 | MUST NOT | `waitForProposal()` or `waitForProposalWithReport()` replace `proposeAsync()` as the governed write path |
| GOV-V3-12 | MUST | `waitForProposal()` return `pending` for non-terminal proposals when `timeoutMs` is omitted or `0`, and `timed_out` when the observation deadline expires |
| GOV-V3-13 | MUST | `waitForProposal()` return failed settlement `ErrorInfo` without fabricating a visible snapshot |
| GOV-V3-14 | MUST NOT | inherited availability reads be documented as durable capability grants for later proposal admission |
| GOV-V3-15 | MUST | `waitForProposalWithReport()` anchor completed settlement outcomes on `proposal.baseWorld -> proposal.resultWorld`, not on the current visible head |
| GOV-V3-16 | MUST NOT | `waitForProposalWithReport()` fabricate execution outcome or diff data for `rejected`, `superseded`, `pending`, or `timed_out` settlements |
| GOV-V3-17 | MUST | failed settlement reports with no `resultWorld` remain summary-only with `published: false` |
