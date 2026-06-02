# World Records

> In-depth record model for the approval/history runtime.

## What World Means Now

This is an advanced concept. You do not need World records to build a normal
Manifesto app, React integration, backend route, or trusted agent worker. Read
[When You Need Approval or History](/guides/approval-and-history) first if you
are still deciding whether the product needs this runtime.

In the current contract, **World** is not a top-level package or governance layer.
A World is a Lineage-owned, immutable record for a sealed full Snapshot,
identified by `WorldId`.

The approval/history runtime is created by composing:

- Governance for proposal and approval rules
- Lineage for durable history records
- the same SDK runtime for execution

The advanced runtime is expressed directly through `withLineage()` and
`withGovernance()`.

## When To Use It

Use Lineage World records when you need one or more of these:

- immutable history and branch/head behavior
- seal-aware publication and restore
- stored full Snapshot lookup by `WorldId`

Add Governance when you also need:

- explicit proposal and reviewer/authority flow
- approval and decision visibility without bypassing runtime boundaries

If you only need direct action submission in an application runtime, stay on
`@manifesto-ai/sdk`.

## Mental Model

At the app boundary, callers still use `app.action.<name>.submit(...)`. The
additional proposal, authority, and sealing steps happen around that same submit
surface.

```text
actor
  -> action.x.submit(...)
  -> Governance accepts or rejects the proposal
  -> SDK runtime submits approved work
  -> Host executes declared requirements
  -> Core computes terminal Snapshot
  -> Lineage seals a World record
```

More concretely:

1. A caller submits an action from the activated runtime.
2. Governance creates and advances a proposal.
3. SDK and Host execute the approved intent against the current runtime state.
4. Lineage seals the terminal Snapshot as a World record and advances visible history only when history rules allow it.

## Public Assembly

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { withLineage } from "@manifesto-ai/lineage";
import { withGovernance } from "@manifesto-ai/governance";

const governed = withGovernance(
  withLineage(createManifesto(schema, effects), lineageConfig),
  governanceConfig,
).activate();
```

## Key Properties

- Lineage Worlds are immutable sealed records.
- Approval and history stay in explicit packages.
- Sealing is ordered and publication-aware.
- Approval and history behavior are explicit, not hidden in a facade.

## See Also

- [Governance API](../api/governance.md)
- [Lineage API](../api/lineage.md)
- [When You Need Approval or History](../guides/approval-and-history.md)
- [Advanced Runtime Assembly](../guides/governed-composition.md)
