# World

> Governed composition for legitimacy, continuity, and sealing.

## What World Means Now

World is no longer a top-level facade package. In the current hard-cut model, "world" means the governed state transition path created by composing:

- governance for legitimacy
- lineage for continuity
- the same SDK runtime for execution

The underlying semantics live in explicit protocol packages. Governed composition is now expressed directly through `withLineage()` and `withGovernance()`.

## When To Use It

Choose World when you need one or more of these:

- explicit proposal and authority flow
- immutable world history and branch/head semantics
- seal-aware publication and restore
- approval and decision visibility without bypassing runtime boundaries

If you only need direct-dispatch application runtime, stay on `@manifesto-ai/sdk`.

## Mental Model

```text
actor
  -> typed intent
  -> governance decides legitimacy
  -> host executes approved intent
  -> lineage seals result
  -> governed history advances
```

More concretely:

1. A caller creates a typed intent from the activated runtime.
2. Governance creates and advances a proposal.
3. Host executes the approved intent against a base snapshot.
4. Lineage seals the result and exposes it as visible history.

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

- Worlds are immutable.
- Governance and lineage stay explicit protocol packages.
- Sealing is ordered and publication-aware.
- Legitimacy and continuity are explicit, not hidden in a facade.

## See Also

- [World API](../api/world.md)
- [Governance API](../api/governance.md)
- [Lineage API](../api/lineage.md)
- [Governed Composition Guide](../guides/governed-composition.md)
