# Governance Guide

## 1. Compose Governance On A Manifesto

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { withGovernance } from "@manifesto-ai/governance";

const governed = withGovernance(
  withLineage(createManifesto<CounterDomain>(schema, effects), {
    store: createInMemoryLineageStore(),
  }),
  {
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

Governance only accepts a manifesto that has already been composed with `withLineage()`.

## 2. Propose Instead Of Dispatch

```ts
const proposal = await governed.proposeAsync(
  governed.createIntent(governed.MEL.actions.increment),
);
```

Governed runtimes do not expose `dispatchAsync` or `commitAsync`. Both backdoors are removed by design.

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
- `getWorldSnapshot(worldId)`
- `getLatestHead()`
- `getHeads()`
- `getBranches()`
- `getActiveBranch()`
- `switchActiveBranch(branchId)`
- `createBranch(name, fromWorldId?)`

The removed verbs are direct execution verbs. Governance keeps the lineage query surface, not lineage execution.
`getSnapshot()` remains the projected runtime read. `getCanonicalSnapshot()` reads the current visible canonical substrate. `getWorldSnapshot(worldId)` reads the stored sealed canonical snapshot substrate. `restore(worldId)` remains the normalized runtime resume path.
The activated governed runtime also keeps the inherited SDK legality queries: `getAvailableActions()`, `isActionAvailable()`, `isIntentDispatchable()`, and `getIntentBlockers()`.
Those inherited legality queries keep the base SDK semantics: availability short-circuits dispatchability, and `getIntentBlockers()` reports the first failing layer instead of combining coarse and fine blockers.

## 6. Low-Level Governance Substrate

The provider entry point exists for protocol testing and lower-level composition:

- `@manifesto-ai/governance/provider`
- `createGovernanceService()`
- `createGovernanceEventDispatcher()`
- `createAuthorityEvaluator()`

`createInMemoryGovernanceStore()` remains available from the root package for simple bootstrap and tests.

Those are useful when you are testing lifecycle invariants directly. They are no longer the package’s primary application story.

## Related Docs

- [Governance README](../README.md)
- [Governance Specification](governance-SPEC.md)
- [Historical v2 Baseline](governance-SPEC-2.0.0v.md)
- [Governance Version Index](VERSION-INDEX.md)
