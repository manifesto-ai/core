# Governance Guide

## 1. Compose Governance On A Manifesto

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import {
  waitForProposal,
  waitForProposalWithReport,
  withGovernance,
} from "@manifesto-ai/governance";

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

When a caller wants a normalized proposal-settlement read, use the additive root helper:

```ts
const settlement = await waitForProposal(governed, proposal);

if (settlement.kind === "completed") {
  console.log(settlement.snapshot.data.count);
}
```

`waitForProposal()` does not replace `proposeAsync()`. It observes the current proposal state and returns `completed`, `failed`, `rejected`, `superseded`, `pending`, or `timed_out`.

When tooling needs a first-party outcome bundle anchored on stored lineage worlds, use the additive settlement-report companion:

```ts
const report = await waitForProposalWithReport(governed, proposal);

if (report.kind === "completed") {
  console.log(report.outcome.projected.changedPaths);
  console.log(report.resultWorld);
}
```

`waitForProposalWithReport()` stays observational. It does not replace `proposeAsync()`, and it does not turn governed runtime submission into a direct execution verb.

For failed settlements with a `resultWorld`, the report reflects the stored
terminal Snapshot's semantic failure state (`system.lastError` and pending
requirements). Canonical `data.$host.lastError` remains a Host diagnostic for
deep debugging, not the governed settlement error surface.

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
`getAvailableActions()` and `isActionAvailable()` remain current visible-snapshot reads, not durable capability grants for later proposal admission.

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
