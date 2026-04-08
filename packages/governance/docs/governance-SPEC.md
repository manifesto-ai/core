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
- inherited legality queries preserve the base SDK ordering: availability is checked before dispatchability
- inherited `getIntentBlockers()` returns the first failing layer, so unavailable intents surface an `available` blocker without evaluating `dispatchable`

## 6. Verb Promotion

Governed runtimes MUST NOT expose `dispatchAsync` or `commitAsync`.

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
