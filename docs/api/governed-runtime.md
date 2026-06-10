# Optional Approval/History Runtime

> Compose the optional extension runtime before activation when writes need review, audit history, restore, or approval policy.

## Activate the Advanced Runtime

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import {
  createInMemoryGovernanceStore,
  withGovernance,
} from "@manifesto-ai/governance";
import TodoMel from "./domain/todo.mel";
import type { TodoDomain } from "./domain/todo.domain";

const app = withGovernance(
  withLineage(createManifesto<TodoDomain>(TodoMel, effects), {
    store: createInMemoryLineageStore(),
  }),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings,
    execution,
  },
).activate();
```

Approval requires an explicitly history-composed manifesto.

## Write With `action.<name>.submit()`

Approval/history runtimes intentionally keep app writes on action handles. They
also omit historical root write verbs, raw `createIntent()`, and root `MEL`
refs from the app-facing root.

```typescript
const pending = await app.action.addTodo.submit("Review this");

if (pending.ok) {
  const settlement = await pending.waitForSettlement();

  if (settlement.ok && settlement.status === "settled" && settlement.outcome.kind === "ok") {
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

if (settlement.ok && settlement.status === "settled" && settlement.outcome.kind === "ok") {
  console.log(settlement.report?.changes);
}
```

## Human Review Policy

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
const pending = await app.action.addTodo.submit("Review this");

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

Use lineage queries such as `getLatestHead()`, `getWorldSnapshot(worldId)`, `getBranches()`, and `restore(worldId)` when durable history or restore matters.

## Next

- Read the decision guide in [When You Need Approval or History](/guides/approval-and-history)
- Assemble the advanced runtime in [Advanced Runtime Assembly](/guides/governed-composition)
- See package details in [@manifesto-ai/governance](./governance)
