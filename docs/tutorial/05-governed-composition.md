# Approval And History Setup

> Add the advanced runtime layers only after the base path already works.

Read this tutorial only when the project now needs approval, branch continuity, or sealed history.

## What You'll Build

- one composable manifesto
- one lineage decorator for continuity
- one governance decorator for legitimacy
- one activated advanced runtime

## 1. Assemble The Advanced Runtime

Create `governed-runtime.ts`:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { createInMemoryGovernanceStore, withGovernance } from "@manifesto-ai/governance";

export const governed = withGovernance(
  withLineage(createManifesto(todoSchema, effects), {
    store: createInMemoryLineageStore(),
  }),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings: [
      {
        actorId: "actor:user",
        authorityId: "authority:auto",
        policy: { mode: "auto_approve" },
      },
    ],
    execution: {
      projectionId: "todo-ui",
      deriveActor: () => ({ actorId: "actor:user", kind: "human" }),
      deriveSource: () => ({ kind: "ui", eventId: crypto.randomUUID() }),
    },
  },
).activate();
```

This file should live outside React components and outside request handlers that only need Snapshot reads.

## 2. Create A Reviewable Request

```typescript
const candidate = governed.actions.addTodo.bind("Document the governed path");
```

The typed candidate still comes from the runtime. Governance adds proposal semantics when you submit it.

## 3. Submit The Proposal

```typescript
const pending = await candidate.submit();
```

Auto-approved policies can settle quickly. Pending policies return a `ProposalRef` and wait for human approval.

## 4. Keep UI Code Out Of The Assembly Path

React and other UI layers should usually receive Snapshot data, not store or policy wiring.

```typescript
import { governed } from "./governed-runtime";

export function readCurrentBranch() {
  return governed.getActiveBranch();
}
```

## When To Use This Track

Use this track when you need:

- explicit approval or review before a state transition
- branch-aware history
- auditability for the final committed world
- a clear split between request, decision, execution, and sealing

If none of those matter, stay on the base-runtime tutorials and the SDK path.

## Next

Continue to [Sealed History and Review Flow](./06-governed-sealing-and-history) to see how proposals become sealed history.
