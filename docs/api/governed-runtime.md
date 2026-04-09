# Governed Runtime

> Compose Lineage and Governance before activation when writes need legitimacy.

## Activate a Governed Runtime

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import {
  createInMemoryGovernanceStore,
  withGovernance,
} from "@manifesto-ai/governance";

const app = withGovernance(
  withLineage(createManifesto(schema, effects), {
    store: createInMemoryLineageStore(),
  }),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings,
    execution,
  },
).activate();
```

Governance requires an explicitly lineage-composed manifesto.

## Write With `proposeAsync(intent)`

Governed runtimes intentionally do not expose `dispatchAsync()` or lineage `commitAsync()`.

```typescript
const proposal = await app.proposeAsync(
  app.createIntent(app.MEL.actions.addTodo, "Review this"),
);
```

With `auto_approve` policy, a proposal may execute and complete immediately. With `hitl` policy, it usually remains `evaluating`.

## HITL Policy

```typescript
const binding = {
  actorId: "actor:agent",
  authorityId: "authority:reviewer",
  policy: {
    mode: "hitl",
    delegate: {
      actorId: "actor:human",
      kind: "human",
      name: "Human Reviewer",
    },
  },
} as const;
```

The visible Snapshot does not change while a proposal is waiting for human resolution.

## `approve()` and `reject()`

```typescript
const pending = await app.proposeAsync(intent);

if (pending.status === "evaluating") {
  await app.approve(pending.proposalId);
}
```

Reject manually:

```typescript
await app.reject(pending.proposalId, "Needs a smaller scope");
```

## Query Proposals

```typescript
const proposals = await app.getProposals();
const sameProposal = await app.getProposal(proposal.proposalId);
```

Use lineage queries such as `getLatestHead()`, `getWorldSnapshot(worldId)`, `getBranches()`, and `restore(worldId)` when sealed history matters.

## Next

- Read the decision guide in [When You Need Approval or History](/guides/approval-and-history)
- Assemble the advanced runtime in [Governed Composition](/guides/governed-composition)
- See package details in [@manifesto-ai/governance](./governance)
