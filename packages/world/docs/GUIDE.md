# World Guide

> Practical guide for assembling the governed `@manifesto-ai/world` runtime.

> **Current Contract Note:** This guide follows the current World facade v1.0.0 surface. The projected ADR-015 + ADR-016 rewrite lives in [world-facade-spec-v2.0.0.md](world-facade-spec-v2.0.0.md) as draft only.

## 1. Assemble The Governed Runtime

```typescript
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createInMemoryWorldStore,
  createLineageService,
  createWorld,
} from "@manifesto-ai/world";

const store = createInMemoryWorldStore();
const lineage = createLineageService(store);
const governance = createGovernanceService(store, {
  lineageService: lineage,
});

const world = createWorld({
  store,
  lineage,
  governance,
  eventDispatcher: createGovernanceEventDispatcher({
    service: governance,
  }),
});
```

`createWorld()` is a thin assembler. It wires together the coordinator, lineage service, governance service, and composite store without hiding any of those responsibilities.

---

## 2. Create Intent Instances For Governed Requests

```typescript
import { createIntentInstance } from "@manifesto-ai/world";

const intent = await createIntentInstance({
  body: {
    type: "todo.add",
    input: { title: "Document the governed path" },
  },
  schemaHash: "todo-v1",
  projectionId: "todo-ui",
  source: { kind: "ui", eventId: "evt-1" },
  actor: { actorId: "user-1", kind: "human" },
});
```

The intent key is derived from the intent body and schema data only. Origin metadata does not affect it.

---

## 3. Proposal -> Decision -> Seal

```typescript
const branch = lineage.getActiveBranch();
const proposal = governance.createProposal({
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

const approved = governance.prepareAuthorityResult(
  { ...proposal, status: "evaluating" },
  { kind: "approved", approvedScope: null },
  {
    currentEpoch: branch.epoch,
    currentBranchHead: branch.head,
    decidedAt: Date.now(),
  },
);

if (!approved.decisionRecord) {
  throw new Error("expected decision record");
}

const executingProposal = {
  ...approved.proposal,
  status: "executing" as const,
  decisionId: approved.decisionRecord.decisionId,
  decidedAt: approved.decisionRecord.decidedAt,
};

world.store.putProposal(executingProposal);
world.store.putDecisionRecord(approved.decisionRecord);

const sealed = world.coordinator.sealNext({
  executingProposal,
  completedAt: Date.now(),
  sealInput: {
    schemaHash: "todo-v1",
    terminalSnapshot,
    createdAt: Date.now(),
    baseWorldId: branch.head,
    branchId: branch.id,
    proposalRef: executingProposal.proposalId,
    decisionRef: approved.decisionRecord.decisionId,
  },
});
```

World coordinates the commit sequence, governance finalization, and event emission. Lineage remains responsible for identity and history; governance remains responsible for legitimacy.

---

## 4. Standalone Genesis Versus Governed Sealing

```typescript
const genesis = world.coordinator.sealGenesis({
  kind: "standalone",
  sealInput: {
    schemaHash: "todo-v1",
    terminalSnapshot: initialSnapshot,
    createdAt: Date.now(),
  },
});
```

Use standalone genesis when you only need to bootstrap the first sealed world. Use governed sealing when the first seal should also go through legitimacy and event flow.

---

## 5. Read Resulting Worlds And Branches

```typescript
const activeBranch = world.lineage.getActiveBranch();
const heads = world.lineage.getHeads();
const latestHead = world.lineage.getLatestHead();
const restored = latestHead
  ? world.lineage.restore(latestHead.worldId)
  : null;
```

The governed runtime does not hide history. It makes the current branch and its sealed ancestry queryable.

---

## 6. Related Docs

- [World README](../README.md)
- [World Specification](world-facade-spec-v1.0.0.md)
- [World Specification v2 Draft](world-facade-spec-v2.0.0.md)
- [World Version Index](VERSION-INDEX.md)
- [Governed Composition](../../../docs/tutorial/05-governed-composition)
- [Governed Sealing and History](../../../docs/tutorial/06-governed-sealing-and-history)
