# Governance SPEC v3.0.0 Draft

> Status: current next-major draft
> Package: `@manifesto-ai/governance`
> ADR Basis: [ADR-017](../../../docs/internals/adr/017-capability-decorator-pattern.md)

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
function withGovernance<T extends ManifestoDomainShape, L extends BaseLaws>(
  manifesto: ComposableManifesto<T, L>,
  config: GovernanceConfig<T, L>,
): GovernanceComposableManifesto<T, L>;
```

## 3. Config Contract

```ts
type GovernanceConfig<T, L extends BaseLaws> = {
  bindings: readonly ActorAuthorityBinding[];
  governanceStore?: GovernanceStore;
  evaluator?: AuthorityEvaluator;
  eventSink?: GovernanceEventSink;
  now?: () => number;
  execution: {
    projectionId: string;
    deriveActor(intent: Intent): ActorRef;
    deriveSource(intent: Intent): SourceRef;
  };
} & (L extends LineageLaws
  ? { lineage?: GovernanceLineageConfig | LineageConfig }
  : { lineage: GovernanceLineageConfig });
```

`GovernanceLineageConfig` MUST provide a `LineageService` or `LineageStore`.

## 4. Lineage Guarantee

Governed runtimes MUST include lineage semantics.

- If `withLineage()` was already explicitly composed, governance MUST use that explicit lineage configuration.
- If lineage was not already composed, `config.lineage` is required.
- Governance MUST NOT create a default in-memory lineage store on behalf of the caller.

## 5. Activated Runtime

```ts
type GovernanceInstance<T> =
  Omit<LineageInstance<T>, "dispatchAsync"> & {
    proposeAsync(intent: Intent): Promise<Proposal>;
    approve(proposalId: ProposalId, approvedScope?: IntentScope | null): Promise<Proposal>;
    reject(proposalId: ProposalId, reason?: string): Promise<Proposal>;
    getProposal(proposalId: ProposalId): Promise<Proposal | null>;
    getProposals(branchId?: BranchId): Promise<readonly Proposal[]>;
    bindActor(binding: ActorAuthorityBinding): Promise<void>;
    getActorBinding(actorId: ActorId): Promise<ActorAuthorityBinding | null>;
    getDecisionRecord(decisionId: DecisionId): Promise<DecisionRecord | null>;
  };
```

## 6. Verb Promotion

Governed runtimes MUST NOT expose `dispatchAsync`.

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

The following exports remain public:

- `createGovernanceService()`
- `createGovernanceEventDispatcher()`
- `createInMemoryGovernanceStore()`
- `createAuthorityEvaluator()`
- authority handlers and protocol types

They are valid low-level seams but are no longer the canonical application entry path.

## 10. Hard-Cut Removals From The Governance Story

Governance v3 no longer teaches:

- service-first assembly as the package’s primary entry path
- `@manifesto-ai/world` as the canonical governed composition surface
- any governed runtime that still exposes direct `dispatchAsync`

## 11. Normative Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| GOV-V3-1 | MUST | `withGovernance()` MUST accept composable manifestos, not live runtime instances |
| GOV-V3-2 | MUST | governed activation MUST include lineage semantics |
| GOV-V3-3 | MUST NOT | governed runtimes MUST NOT expose `dispatchAsync` |
| GOV-V3-4 | MUST | explicit `withLineage()` composition MUST win over `config.lineage` |
| GOV-V3-5 | MUST NOT | governance MUST NOT create a default in-memory lineage store when lineage was not explicitly composed |
| GOV-V3-6 | MUST | pending HITL or tribunal proposals MUST remain in `evaluating` until `approve()` or `reject()` resolves them |
| GOV-V3-7 | MUST | approved execution MUST seal through lineage before visible snapshot publication |
| GOV-V3-8 | MUST NOT | failed governed execution MUST NOT publish the failed snapshot as the visible runtime snapshot |
