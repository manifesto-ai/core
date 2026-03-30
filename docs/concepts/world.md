# World

> Governed composition for legitimacy, continuity, and sealing.

## What World Means in the Hard-Cut Model

World is no longer a separate monolithic runtime hidden behind its own object model. At the public package surface, top-level `@manifesto-ai/world` is the exact governed facade that composes:

- governance for legitimacy
- lineage for continuity
- a facade-owned store and coordinator for sealing

The underlying semantics still live in explicit protocol packages. World is the package you use when you want the governed runtime assembled coherently.

## When To Use It

Choose World when you need one or more of these:

- explicit proposal and authority flow
- immutable world history and branch/head semantics
- atomic sealing and post-commit governance events
- a single package that exposes the full governed runtime surface

If you only need direct-dispatch application runtime, stay on `@manifesto-ai/sdk`.

## Mental Model

```text
actor
  -> intent instance
  -> governance decides legitimacy
  -> host executes approved intent
  -> coordinator seals result into lineage
  -> post-commit events are emitted
```

More concretely:

1. An actor creates an intent instance.
2. Governance creates and advances a proposal.
3. Host executes the approved intent against a base snapshot.
4. The coordinator finalizes governance, commits lineage and governance records, and emits post-commit events.

## Public Assembly

```typescript
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createIntentInstance,
  createLineageService,
  createWorld,
} from "@manifesto-ai/world";
import { createInMemoryWorldStore } from "@manifesto-ai/world/in-memory";
```

## Package Structure

```text
@manifesto-ai/world
  -> re-exports @manifesto-ai/governance
  -> re-exports @manifesto-ai/lineage
  -> owns createWorld(), WorldCoordinator, WorldRuntime
  -> exposes store adapters through /in-memory, /indexeddb, /sqlite subpaths
```

That split matters:

- use `@manifesto-ai/world` for governed runtime assembly
- use `@manifesto-ai/governance` directly for legitimacy-specific work
- use `@manifesto-ai/lineage` directly for continuity-specific work

## Key Properties

- Worlds are immutable.
- Governance and lineage stay explicit protocol services.
- Sealing is atomic and ordered.
- Post-commit events happen only after the commit succeeds.

## See Also

- [World API](../api/world.md)
- [Governance API](../api/governance.md)
- [Lineage API](../api/lineage.md)
- [Governed Composition Guide](../guides/governed-composition.md)
