# Approval And History Setup

> Add the advanced runtime layers only after the base path already works.

Read this tutorial only when the project now needs approval, branch history, audit, or restore.

## What You'll Build

- one app definition
- one history decorator
- one approval decorator
- one activated advanced runtime

## Vocabulary Before The Code

This track introduces the approval/history packages after the first app path:

| Term | Meaning in this tutorial |
|------|--------------------------|
| History decorator | `withLineage(...)`; records committed app snapshots and exposes branch/head/restore reads |
| Approval decorator | `withGovernance(...)`; creates reviewable proposals before execution |
| Binding | Which actor can use which approval policy |
| `projectionId` | The app surface name recorded with a submitted request |
| `deriveActor` / `deriveSource` | App callbacks that attach actor and source metadata to a request |

## 1. Assemble The Advanced Runtime

Create `src/server/governed-runtime.ts` next to the server-side runtime files
from [Web App + Agent](/integration/web-app-and-agent):

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { createInMemoryGovernanceStore, withGovernance } from "@manifesto-ai/governance";

import TodoMel from "../domain/todo.mel";

export const governed = withGovernance(
  withLineage(createManifesto(TodoMel, {}), {
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

This file should live outside React components and outside request handlers that
only need Snapshot reads. Add an effects map as the second `createManifesto()`
argument when your domain declares effects.

## 2. Create A Reviewable Request

```typescript
const request = governed.action.addTodo.bind("Document the approval path");
```

The typed request still comes from the runtime. Governance adds an approval
policy and proposal record when you submit it.

## 3. Submit The Proposal

```typescript
const pending = await request.submit();
```

Successful governance submit always returns a pending `ProposalRef`. Auto-approved policies may settle quickly, and human-gated policies wait for approval through `waitForSettlement()`.

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
- auditability for the final committed change
- a clear split between request, approval, execution, and history recording

If none of those matter, stay on the first-app tutorials and the SDK path.

## Next

Continue to [Review And Durable History Flow](./06-governed-sealing-and-history) to see how proposals become durable history.
