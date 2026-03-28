# World

> Governance, lineage, and sealing coordination for Manifesto.

## What World Is

World is the governed layer that decides whether an intent is legitimate, records that decision, and seals the resulting world into lineage.

At the package surface, `@manifesto-ai/world` is now the exact facade for:

- governance services
- lineage services
- intent-instance creation
- facade-owned storage and coordinator assembly

## Mental Model

```text
Actor -> Governance -> Host -> Coordinator -> Lineage
```

More precisely:

1. An actor produces an intent instance.
2. Governance creates a proposal and records the authority decision.
3. Host executes the approved intent against a base snapshot.
4. The coordinator prepares lineage, finalizes governance, commits both, and emits post-commit events.

## Proposal Lifecycle

```text
submitted -> evaluating -> approved -> executing -> completed
                     \-> rejected
                     \-> superseded
                                  \-> failed
```

`superseded` is a first-class status in the split-native governance model. It represents stale ingress that lost legitimacy before execution completed.

## Exact Facade Surface

New code should import from top-level `@manifesto-ai/world`:

```typescript
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createInMemoryWorldStore,
  createIntentInstance,
  createLineageService,
  createWorld,
} from "@manifesto-ai/world";
```

`@manifesto-ai/world/facade` is an exact alias, not the canonical path.

## Key Properties

- Worlds are immutable.
- Governance and lineage are explicit services.
- The coordinator enforces atomic, ordered sealing.
- Event emission happens only after commit succeeds.

## See Also

- [World API](../api/world.md)
- [Intent](./intent.md)
- [Snapshot](./snapshot.md)
