# Governed Composition

> Assemble the governed runtime explicitly and keep UI code focused on reading snapshots.
>
> **Current Contract Note:** This tutorial follows the current World facade v2.0.0 surface, which composes Governance v2.0.0 and Lineage v2.0.0 on top of the current Core v4 Snapshot contract.

---

## What You'll Build

- one shared in-memory store
- a lineage service for identity and history
- a governance service for proposal legitimacy
- an event dispatcher for post-commit outcomes
- a governed world assembler that wires the pieces together
- an intent-instance factory for governed requests

---

## Prerequisites

- You finished [Building a Todo App](./04-todo-app) or already understand direct dispatch
- You know the difference between Snapshot reads and proposal flow
- You want explicit legitimacy, lineage, or branch history

---

## 1. Assemble The Governed Runtime

Create `world-runtime.ts`:

```typescript
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createLineageService,
  createWorld,
} from "@manifesto-ai/world";
import { createInMemoryWorldStore } from "@manifesto-ai/world/in-memory";

const store = createInMemoryWorldStore();
const lineage = createLineageService(store);
const governance = createGovernanceService(store, {
  lineageService: lineage,
});

export const world = createWorld({
  store,
  lineage,
  governance,
  eventDispatcher: createGovernanceEventDispatcher({
    service: governance,
  }),
});
```

This file should live outside React components and outside request handlers that only need Snapshot reads. It is the governed assembly point for the app.

---

## 2. Bootstrap The First Sealed World

If you are starting from an empty store, bootstrap the first sealed world before you create proposals against it:

```typescript
const genesis = world.coordinator.sealGenesis({
  kind: "standalone",
  sealInput: {
    schemaHash: "todo-v1",
    terminalSnapshot: initialSnapshot,
    createdAt: Date.now(),
  },
});

const branch = world.lineage.getActiveBranch();
```

Standalone genesis establishes the first head and active branch without creating governance records. If your app already has sealed history, start from the existing head instead.
Assume `initialSnapshot` is already a terminal Snapshot produced by your runtime or restored from storage.

---

## 3. Create An Intent Instance

Create `request.ts`:

```typescript
import { createIntentInstance } from "@manifesto-ai/world";

export async function createTodoIntentInstance() {
  return createIntentInstance({
    body: {
      type: "todo.add",
      input: { title: "Document the governed path" },
    },
    schemaHash: "todo-v1",
    projectionId: "todo-ui",
    source: { kind: "ui", eventId: "evt-1" },
    actor: { actorId: "user-1", kind: "human" },
  });
}
```

`IntentInstance` carries the governed request metadata that plain SDK dispatch does not need: actor identity, projection context, and source metadata.

---

## 4. Create A Proposal From That Instance

```typescript
const branch = world.lineage.getActiveBranch();
const intent = await createTodoIntentInstance();

const proposal = world.governance.createProposal({
  baseWorld: branch.head,
  branchId: branch.id,
  actorId: intent.meta.origin.actor.actorId,
  authorityId: "auth-auto",
  intent: {
    type: intent.body.type,
    intentId: intent.intentId,
    input: intent.body.input,
    scopeProposal: intent.body.scopeProposal,
  },
  executionKey: intent.intentKey,
  submittedAt: Date.now(),
  epoch: branch.epoch,
});
```

In the current facade surface, `branch.head` remains the governance baseline while `branch.tip` tracks every seal attempt. This split is part of the current lineage/world contract and is why proposal baselines and seal chronology no longer collapse into a single pointer.

That proposal is the governed handoff point. It is still only a request at this stage. The next step is authority evaluation, then sealing.

---

## 5. Keep UI Code Out Of The Assembly Path

React and other UI layers should usually receive Snapshot data, not the governed assembly itself.

```typescript
import { world } from "./world-runtime";

export function readCurrentBranch() {
  return world.lineage.getActiveBranch();
}
```

The UI can read branch and snapshot state, but it should not own the lifecycle of lineage, governance, or event dispatch.

---

## When To Use This Track

Use the governed track when you need:

- explicit approval or review before a state transition
- branch-aware history
- auditability for the final committed world
- a clear split between request, decision, execution, and sealing

If none of those matter, stay on the direct-dispatch tutorials and the SDK path.

---

## Next

Continue to [Governed Sealing and History](./06-governed-sealing-and-history) to see how proposals become sealed history.
