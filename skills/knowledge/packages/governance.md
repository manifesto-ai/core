# @manifesto-ai/governance

> Legitimacy and proposal decorator runtime for Manifesto.

## Role

Governance decorates a lineage-composed manifesto to add:

- proposal lifecycle
- authority evaluation
- approval / rejection
- decision records
- governed execution and publication

## Public API

### `withGovernance(lineageManifesto, config): GovernanceComposableManifesto<T>`

```typescript
const governed = withGovernance(
  withLineage(createManifesto(schema, effects), {
    store: createInMemoryLineageStore(),
  }),
  {
    bindings,
    execution: {
      projectionId: "ui",
      deriveActor: () => actor,
      deriveSource: () => source,
    },
  },
).activate();
```

### `GovernanceInstance<T>`

```typescript
interface GovernanceInstance<T> extends Omit<LineageInstance<T>, "commitAsync"> {
  proposeAsync(intent): Promise<Proposal>;
  approve(proposalId, approvedScope?): Promise<Proposal>;
  reject(proposalId, reason?): Promise<Proposal>;
  getProposal(proposalId): Promise<Proposal | null>;
  getProposals(branchId?): Promise<readonly Proposal[]>;
  bindActor(binding): Promise<void>;
  getActorBinding(actorId): Promise<ActorAuthorityBinding | null>;
  getDecisionRecord(decisionId): Promise<DecisionRecord | null>;
}
```

## Notes

- `withGovernance()` requires a manifesto already composed with `withLineage()`.
- Governed runtimes do not expose `dispatchAsync()` or `commitAsync()`.
- Inherited snapshot reads still follow the SDK projected/canonical boundary.
- Current living contract is `packages/governance/docs/governance-SPEC.md`.
