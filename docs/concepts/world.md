# World Records and Governed Composition

> Lineage's sealed historical record model, plus the governed composition that can create those records under authority.

## What World Means Now

In the current contract, **World** is not a top-level package or governance layer. A World is a Lineage-owned, immutable record for a sealed canonical Snapshot, identified by `WorldId`.

Governed composition is the runtime path created by composing:

- Governance for legitimacy
- Lineage for continuity and sealed World records
- the same SDK runtime for execution

The underlying semantics live in explicit protocol packages. Governed composition is expressed directly through `withLineage()` and `withGovernance()`.

## When To Use It

Use Lineage World records when you need one or more of these:

- immutable history and branch/head semantics
- seal-aware publication and restore
- stored canonical Snapshot lookup by `WorldId`

Add Governance when you also need:

- explicit proposal and authority flow
- approval and decision visibility without bypassing runtime boundaries

If you only need direct-dispatch application runtime, stay on `@manifesto-ai/sdk`.

## Mental Model

```text
actor
  -> typed intent
  -> Governance decides legitimacy
  -> SDK runtime submits approved work
  -> Host executes declared requirements
  -> Core computes terminal Snapshot
  -> Lineage seals a World record
```

More concretely:

1. A caller creates a typed intent from the activated runtime.
2. Governance creates and advances a proposal.
3. SDK and Host execute the approved intent against the current visible canonical Snapshot.
4. Lineage seals the terminal Snapshot as a World record and advances visible history only when continuity rules allow it.

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
- Governance and Lineage stay explicit protocol packages.
- Sealing is ordered and publication-aware.
- Legitimacy and continuity are explicit, not hidden in a facade.

## See Also

- [Governance API](../api/governance.md)
- [Lineage API](../api/lineage.md)
- [Advanced Runtime Assembly](../guides/governed-composition.md)
