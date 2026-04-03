# Governed Composition

> Assemble governed composition directly from SDK, Lineage, and Governance.

Use governed composition when you need explicit proposal approval, lineage continuity, sealed worlds, or auditable runtime events. If you only need direct dispatch, stay on `@manifesto-ai/sdk` and `createManifesto()`.

## The Current Path

The current governed path is:

1. create a composable manifesto with `createManifesto(schema, effects)`
2. add continuity with `withLineage(...)`
3. add legitimacy with `withGovernance(...)`
4. call `activate()`
5. submit governed work with `proposeAsync(...)`

## Minimal Assembly

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { createInMemoryGovernanceStore, withGovernance } from "@manifesto-ai/governance";

const governed = withGovernance(
  withLineage(createManifesto(schema, effects), {
    store: createInMemoryLineageStore(),
  }),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings: [
      {
        actorId: "actor:auto",
        authorityId: "authority:auto",
        policy: { mode: "auto_approve" },
      },
    ],
    execution: {
      projectionId: "counter-ui",
      deriveActor: () => ({ actorId: "actor:auto", kind: "agent" }),
      deriveSource: () => ({ kind: "ui", eventId: crypto.randomUUID() }),
    },
  },
).activate();
```

## Canonical Flow

1. Activate the decorated runtime.
2. Create a typed intent from `governed.MEL.actions.*`.
3. Call `proposeAsync(intent)`.
4. Let Governance auto-approve or return a pending proposal.
5. Read sealed history through Lineage queries such as `getLatestHead()` and `restore()`.

Use `getWorldSnapshot(worldId)` when you need the stored sealed canonical snapshot substrate for a committed world. Use `restore(worldId)` when you need the normalized runtime resume path.

## Store Choices

Use the store surfaces from the owning packages directly:

- `createInMemoryLineageStore()` from `@manifesto-ai/lineage`
- `createInMemoryGovernanceStore()` from `@manifesto-ai/governance`

The old world-facade adapter story was removed. No direct replacement for `world/sqlite` or `world/indexeddb` was landed in this phase.

## See Also

- [SDK API](/api/sdk)
- [Lineage API](/api/lineage)
- [Governance API](/api/governance)
