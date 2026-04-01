# @manifesto-ai/governance

> Governed decorator runtime for legitimacy, approval, and sealed execution.

## Overview

`@manifesto-ai/governance` owns `withGovernance()` and the activated governed runtime.

> **Current Contract Note:** The truthful current package contract is Governance v3. See [Specifications](/internals/spec/) for the current draft index.

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

`dispatchAsync` and `commitAsync` are intentionally absent.

## Lineage Guarantee

- `withLineage()` must already be composed.
- Governance uses that explicit lineage setup.
- Governance does not create lineage on behalf of the caller.

## Low-Level Protocol Surface

The package still exports low-level seams such as:

- `createGovernanceService()`
- `createGovernanceEventDispatcher()`
- `createInMemoryGovernanceStore()`
- `createAuthorityEvaluator()`

Those remain useful for protocol tests and custom orchestration, but they are no longer the canonical app-facing entry.

## Related Docs

- [SDK API](./sdk.md)
- [Lineage API](./lineage.md)
- [Governed Composition Guide](/guides/governed-composition)
- [Specifications](/internals/spec/)
