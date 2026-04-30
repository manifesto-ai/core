# @manifesto-ai/governance

`@manifesto-ai/governance` owns governed legitimacy for Manifesto runtimes.

> **Current Contract Note:** This page describes the current Governance v5
> decorator surface: governance-mode `submit()`, durable `ProposalRef`,
> `waitForSettlement(ref)`, and governance control methods. See
> [packages/governance/docs/governance-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/governance/docs/governance-SPEC.md).

## Canonical Surface

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { withGovernance } from "@manifesto-ai/governance";

const app = withGovernance(
  withLineage(createManifesto<CounterDomain>(schema, effects), {
    store: createInMemoryLineageStore(),
  }),
  {
    bindings,
    execution: {
      projectionId: "counter",
      deriveActor(intent) {
        return { actorId: "agent:demo", kind: "agent", meta: { action: intent.type } };
      },
      deriveSource(intent) {
        return { kind: "agent", eventId: `action:${String(intent.type)}` };
      },
    },
  },
).activate();
```

## Submit And Settlement

Governance-mode action submission uses the SDK v5 action-candidate surface:

```typescript
const pending = await app.actions.increment.submit({ by: 1 });
const settlement = await pending.waitForSettlement();
```

A successful initial governance submission returns:

- `ok: true`
- `mode: "governance"`
- `status: "pending"`
- `proposal: ProposalRef`
- result-bound `waitForSettlement()`

Auto-approved policies still return the initial pending result. Settlement is
observed through `pending.waitForSettlement()` or through runtime re-attachment:

```typescript
const ref = pending.proposal;
const settlement = await app.waitForSettlement(ref);
```

`ProposalRef` is a stable string settlement handle. It is sufficient to
re-observe settlement after process restart or agent handoff when the backing
governance store contains the proposal.

## Settlement Results

Governance settlement statuses are:

- `settled`
- `rejected`
- `superseded`
- `expired`
- `cancelled`
- `settlement_failed`

For `settled`, `before` and `after` are projected snapshots anchored on the
governance proposal's `baseWorld -> resultWorld` lineage transition. They are
not arbitrary visible-head reads.

For `rejected`, `superseded`, `expired`, and `cancelled`, settlement results do
not fabricate `world`, `before`, `after`, or `outcome`.

For `settlement_failed`, no world or outcome is fabricated.

## Control Surface

Governance runtimes expose governance-owned control methods:

- `approve(proposalRef, approvedScope?)`
- `reject(proposalRef, reason?)`
- `getProposal(proposalRef)`
- `getProposals(branchId?)`
- `bindActor(binding)`
- `getActorBinding(actorId)`
- `getDecisionRecord(decisionId)`

These methods operate on governance records. They are not action submission
verbs and do not expose direct base or lineage execution.

## Lineage Guarantee

- `withLineage()` must already be composed.
- Governance uses that explicit lineage setup.
- Governance does not create lineage on behalf of the caller.
- Lineage-owned query and restore methods remain lineage-owned when exposed
  through a governed runtime.

## Failure Observation

Failed governed settlements observe semantic failure from the terminal
Snapshot's `system.lastError` and pending requirements when a sealed result world
exists. Canonical `namespaces.host.lastError` remains Host diagnostic data for
deep debugging and is not merged into settlement `ErrorInfo`.

## V3 Migration Names

The v3 names below are historical migration references, not canonical v5 runtime
root methods:

- `proposeAsync(intent)`
- `waitForProposal(app, proposalOrId, options?)`
- `waitForProposalWithReport(app, proposalOrId, options?)`

Use `actions.x.submit(input)`, `pending.waitForSettlement()`, and
`app.waitForSettlement(ref)` in current v5 code.

## Low-Level Protocol Surface

Use `@manifesto-ai/governance/provider` for low-level seams such as
`createGovernanceService()`, `createGovernanceEventDispatcher()`,
`createAuthorityEvaluator()`, and authority handlers.
`createInMemoryGovernanceStore()` remains available from the root package as a
consumer-safe bootstrap helper.

## Related Docs

- [SDK API](./sdk.md)
- [Lineage API](./lineage.md)
- [Advanced Runtime Assembly](/guides/governed-composition)
- [Specifications](/internals/spec/)
