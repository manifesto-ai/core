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

## Write With `actions.<name>.submit()`

Governed runtimes intentionally do not expose base-runtime execution verbs such as `dispatchAsync()` or `dispatchAsyncWithReport()`.
They also omit historical lineage commit verbs, v3 proposal write verbs, raw `createIntent()`, and root `MEL` refs from the app-facing root.

```typescript
const pending = await app.actions.addTodo.submit("Review this");

if (pending.ok) {
  const settlement = await pending.waitForSettlement();

  if (settlement.ok && settlement.status === "settled") {
    console.log(settlement.after.state);
  }
}
```

The first successful result is intentionally pending:

- `ok: true`
- `mode: "governance"`
- `status: "pending"`
- `proposal: ProposalRef`
- `waitForSettlement()`

With `auto_approve` policy, settlement may already be available by the time the initial pending result returns. With `hitl` policy, it usually remains `evaluating` until a governance control method resolves it.

When a caller stores or transfers the proposal handle, use runtime re-attachment:

```typescript
const ref = pending.proposal;
const settlement = await app.waitForSettlement(ref);

if (settlement.ok && settlement.status === "settled") {
  console.log(settlement.report?.changes);
}
```

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
const pending = await app.actions.addTodo.submit("Review this");

if (pending.ok) {
  await app.approve(pending.proposal);
}
```

Reject manually:

```typescript
await app.reject(pending.proposal, "Needs a smaller scope");
```

## Query Proposals

```typescript
const proposals = await app.getProposals();
const sameProposal = await app.getProposal(pending.proposal);
```

Use lineage queries such as `getLatestHead()`, `getWorldSnapshot(worldId)`, `getBranches()`, and `restore(worldId)` when sealed history matters.

## Next

- Read the decision guide in [When You Need Approval or History](/guides/approval-and-history)
- Assemble the advanced runtime in [Governed Composition](/guides/governed-composition)
- See package details in [@manifesto-ai/governance](./governance)
