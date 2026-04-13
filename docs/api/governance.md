# @manifesto-ai/governance

> Governed decorator runtime for legitimacy, approval, and sealed execution.

## Overview

`@manifesto-ai/governance` owns `withGovernance()` and the activated advanced runtime.

> **Current Contract Note:** This page describes the current Governance v3.x decorator surface, including the additive settlement helpers `waitForProposal()` and `waitForProposalWithReport()`. See [packages/governance/docs/governance-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/governance/docs/governance-SPEC.md).

## Canonical Surface

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { withGovernance } from "@manifesto-ai/governance";

const governed = withGovernance(
  withLineage(createManifesto<CounterDomain>(schema, effects), {
    store: createInMemoryLineageStore(),
  }),
  {
    bindings,
    execution: {
      projectionId: "counter",
      deriveActor(intent) {
        return { actorId: "agent:demo", kind: "agent" };
      },
      deriveSource(intent) {
        return { kind: "agent", eventId: intent.intentId };
      },
    },
  },
).activate();
```

## Activated Runtime

Governed runtimes keep the lineage query surface, but remove direct execution:

- `proposeAsync(intent)`
- `approve(proposalId, approvedScope?)`
- `reject(proposalId, reason?)`
- `getProposal(proposalId)`
- `getProposals(branchId?)`
- `bindActor(binding)`
- `getActorBinding(actorId)`
- `getDecisionRecord(decisionId)`
- inherited legality queries such as `isActionAvailable()`, `isIntentDispatchable()`, and `getIntentBlockers()`

The root package also exposes additive settlement helpers:

- `waitForProposal(app, proposalOrId, options?)` for normalized settlement state
- `waitForProposalWithReport(app, proposalOrId, options?)` for world-anchored settlement outcome reports

Neither helper replaces `proposeAsync()`.

Lineage queries such as `getWorldSnapshot(worldId)`, `getLatestHead()`, and `getBranches()` remain available.
`getSnapshot()` remains the projected runtime read. `getCanonicalSnapshot()` remains the current visible canonical substrate. `getWorldSnapshot(worldId)` remains the stored sealed canonical snapshot lookup inherited from lineage. `restore(worldId)` remains the normalized resume path.

Those inherited legality queries preserve the base SDK ordering and blocker meaning:

- availability is checked before dispatchability
- `getIntentBlockers()` returns the first failing layer, so unavailable intents surface an `available` blocker rather than evaluating `dispatchable`
- `getAvailableActions()` and `isActionAvailable()` remain current visible-snapshot reads, not durable capability grants for later proposal admission

`dispatchAsync`, `dispatchAsyncWithReport`, `commitAsync`, and `commitAsyncWithReport` are intentionally absent. There is no governed `proposeAsyncWithReport()` in the current public surface.

## Lineage Guarantee

- `withLineage()` must already be composed.
- Governance uses that explicit lineage setup.
- Governance does not create lineage on behalf of the caller.

## Low-Level Protocol Surface

Use `@manifesto-ai/governance/provider` for low-level seams such as `createGovernanceService()`, `createGovernanceEventDispatcher()`, `createAuthorityEvaluator()`, and authority handlers. `createInMemoryGovernanceStore()` remains available from the root package as a consumer-safe bootstrap helper.

## Related Docs

- [SDK API](./sdk.md)
- [Lineage API](./lineage.md)
- [Advanced Runtime Assembly](/guides/governed-composition)
- [Specifications](/internals/spec/)
