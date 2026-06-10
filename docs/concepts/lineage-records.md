# Lineage Records

> Optional Lineage record model for history, restore, audit, and approval/history runtimes.

## What Lineage Records Mean

This is an advanced extension concept. You do not need Lineage records to build a
normal Manifesto app, React integration, backend route, or trusted agent worker.
Read [When You Need Approval or History](/guides/approval-and-history) first if
you are still deciding whether the product needs this runtime.

In the current contract, there is no top-level `@manifesto-ai/world` package or
facade. The current package is `@manifesto-ai/lineage`, and its sealed
history record is `WorldRecord`, identified by `WorldId`.

Lineage adds sealed records with `withLineage()` by composing:

- the same SDK runtime for action submission
- Lineage for durable history records, restore, and branch/head queries

Governance can be composed on top with `withGovernance()` when the product also
needs proposal, approval, policy, or delegation.

## When To Use It

Use Lineage records when you need one or more of these:

- immutable history and branch/head behavior
- seal-aware publication and restore
- stored full Snapshot lookup by `WorldId`

Add Governance when you also need:

- explicit proposal and reviewer approval flow
- approval and decision visibility without bypassing runtime boundaries

If you only need direct action submission in an application runtime, stay on
`@manifesto-ai/sdk`.

## Mental Model

At the app boundary, callers still use `app.action.<name>.submit(...)`. Lineage
adds sealing and history around that same submit surface.

```text
caller
  -> action.x.submit(...)
  -> Host executes declared requirements
  -> Core computes terminal Snapshot
  -> Lineage seals a record
```

When Governance is also active, proposal and approval steps happen before the
approved work reaches the same SDK/Host/Core runtime path.

More concretely:

1. A caller submits an action from the activated runtime.
2. SDK and Host execute the intent against the current runtime state.
3. Core computes the terminal Snapshot.
4. Lineage seals the terminal Snapshot as a `WorldRecord` and advances visible history only when history rules allow it.

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

- Lineage records are immutable sealed records.
- Approval and history stay in explicit packages.
- Sealing is ordered and publication-aware.
- Approval and history behavior are explicit, not hidden in a facade.

## See Also

- [Governance API](../api/governance.md)
- [Lineage API](../api/lineage.md)
- [When You Need Approval or History](../guides/approval-and-history.md)
- [Advanced Runtime Assembly](../guides/governed-composition.md)
