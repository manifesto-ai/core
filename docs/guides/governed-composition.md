# Advanced Runtime Assembly

> Assemble the approval-and-history runtime directly from SDK, Lineage, and Governance.

Only read this after [When You Need Approval or History](/guides/approval-and-history) has already told you that the project needs these layers. If you only need direct base-runtime submits, stay on `@manifesto-ai/sdk` and `createManifesto()`.

## The Current Path

The current advanced-runtime path is:

1. create a composable manifesto with `createManifesto(schema, effects)`
2. add continuity with `withLineage(...)`
3. add legitimacy with `withGovernance(...)`
4. call `activate()`
5. submit reviewable work with `actions.<name>.submit(...)`

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
2. Submit a typed action candidate with `governed.actions.<name>.submit(...)`.
3. Observe the returned pending proposal.
4. Let Governance auto-approve or return a pending proposal.
5. Read sealed history through Lineage queries such as `getLatestHead()` and `restore()`.

Use `getWorldSnapshot(worldId)` when you need the stored sealed canonical snapshot substrate for a committed world. Use `restore(worldId)` when you need the normalized runtime resume path.

## Store Choices

Use the store surfaces from the owning packages directly:

- `createInMemoryLineageStore()` from `@manifesto-ai/lineage`
- `createInMemoryGovernanceStore()` from `@manifesto-ai/governance`

The old world-facade adapter story was removed. No direct replacement for `world/sqlite` or `world/indexeddb` was landed in this phase.

## See Also

- [When You Need Approval or History](/guides/approval-and-history)
- [SDK API](/api/sdk)
- [Lineage API](/api/lineage)
- [Governance API](/api/governance)
