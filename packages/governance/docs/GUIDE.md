# Governance Guide

## 1. Compose Governance On A Manifesto

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { withGovernance } from "@manifesto-ai/governance";

const governed = withGovernance(
  createManifesto<CounterDomain>(schema, effects),
  {
    lineage: { store },
    bindings: [
      {
        actorId: "agent:demo",
        authorityId: "authority:auto",
        policy: { mode: "auto_approve" },
      },
    ],
    execution: {
      projectionId: "counter",
      deriveActor() {
        return { actorId: "agent:demo", kind: "agent" };
      },
      deriveSource(intent) {
        return { kind: "agent", eventId: intent.intentId };
      },
    },
  },
).activate();
```

If lineage was not explicitly composed earlier, `config.lineage` is required. Governance does not create a default in-memory lineage store for you.

## 2. Propose Instead Of Dispatch

```ts
const proposal = await governed.proposeAsync(
  governed.createIntent(governed.MEL.actions.increment),
);
```

Governed runtimes do not expose `dispatchAsync`. That backdoor is removed by design.

## 3. Auto-Approved Flow

With `auto_approve` or policy-based approval, `proposeAsync()` can return a terminal proposal immediately.

```ts
if (proposal.status === "completed") {
  console.log(governed.getSnapshot().data.count);
}
```

Visible snapshots publish only after lineage seal commit succeeds.

## 4. Pending Human Resolution

HITL and tribunal bindings keep the proposal in `evaluating` until a later decision resolves it.

```ts
const pending = await governed.proposeAsync(
  governed.createIntent(governed.MEL.actions.increment),
);

if (pending.status === "evaluating") {
  await governed.approve(pending.proposalId);
  // or:
  // await governed.reject(pending.proposalId, "manual stop");
}
```

`approve()` and `reject()` are pending-resolution APIs. They are not a general admin override for arbitrary proposal states.

## 5. Lineage Semantics Stay Available

Governed runtimes still carry the lineage query surface:

- `restore(worldId)`
- `getWorld(worldId)`
- `getLatestHead()`
- `getHeads()`
- `getBranches()`
- `getActiveBranch()`
- `switchActiveBranch(branchId)`
- `createBranch(name, fromWorldId?)`

The only removed verb is direct execution.

## 6. Low-Level Governance Substrate

The service/store/evaluator exports still exist for protocol testing and lower-level composition:

- `createGovernanceService()`
- `createGovernanceEventDispatcher()`
- `createInMemoryGovernanceStore()`
- `createAuthorityEvaluator()`

Those are useful when you are testing lifecycle invariants directly. They are no longer the package’s primary application story.

## Related Docs

- [Governance README](../README.md)
- [Governance Specification](governance-SPEC-v3.0.0-draft.md)
- [Historical v2 Baseline](governance-SPEC-2.0.0v.md)
- [Governance Version Index](VERSION-INDEX.md)
