# Governed Sealing and History

> See how a proposal becomes a sealed world, and how lineage records that result.
>
> **Current Contract Note:** This tutorial follows the current World facade v1.0.0 surface, which composes Governance v1.0.0 and Lineage v1.0.1. The projected ADR-015 + ADR-016 rewrite remains draft-only in [packages/world/docs/world-facade-spec-v2.0.0.md](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/world-facade-spec-v2.0.0.md).

---

## What You'll Learn

- how a governed proposal moves toward execution
- how `sealGenesis()` differs from `sealNext()`
- how finalization and rejection fit into the sealing flow
- how to read branch, head, and history state after commit

---

## Prerequisites

- You finished [Governed Composition](./05-governed-composition)
- You already know the governed runtime assembly
- You want to understand the operational flow after a proposal is created

---

## 1. Create The Governed Request

```typescript
import { createIntentInstance } from "@manifesto-ai/world";

const intent = await createIntentInstance({
  body: {
    type: "todo.add",
    input: { title: "Ship the history tutorial" },
  },
  schemaHash: "todo-v1",
  projectionId: "todo-ui",
  source: { kind: "agent", eventId: "evt-2" },
  actor: { actorId: "agent-1", kind: "agent" },
});
```

This is the governed input. It is not the same thing as a plain SDK `Intent`.

---

## 2. Create And Evaluate The Proposal

```typescript
const branch = world.lineage.getActiveBranch();

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

const approved = world.governance.prepareAuthorityResult(
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
```

The proposal and decision stay explicit. In a real app, a controller or approval workflow owns this handoff from `submitted` to `executing`.

---

## 3. Seal The Result

Use `sealGenesis()` when you are bootstrapping the first sealed world, and `sealNext()` when you are advancing an existing branch head.

```typescript
const sealedNext = world.coordinator.sealNext({
  executingProposal,
  completedAt: Date.now(),
  sealInput: {
    schemaHash: "todo-v1",
    baseWorldId: branch.head,
    branchId: branch.id,
    terminalSnapshot,
    createdAt: Date.now(),
    proposalRef: executingProposal.proposalId,
    decisionRef: approved.decisionRecord.decisionId,
  },
});
```

In the current facade v1 surface, `sealInput` still carries `proposalRef` and `decisionRef`, and the branch baseline is read from `branch.head`. The projected v2 drafts move per-attempt provenance into `SealAttempt` and add `tip` / `headAdvancedAt`, but those semantics are not current yet.

If you need the first seal to bypass governance entirely, use standalone genesis:

```typescript
const sealedGenesis = world.coordinator.sealGenesis({
  kind: "standalone",
  sealInput: {
    schemaHash: "todo-v1",
    terminalSnapshot: initialSnapshot,
    createdAt: Date.now(),
  },
});
```

If a seal is rejected, governance still finalizes the rejected outcome so the failure is visible in the record stream.

---

## 4. Read Branch And History State

```typescript
const activeBranch = world.lineage.getActiveBranch();
const heads = world.lineage.getHeads();
const latestHead = world.lineage.getLatestHead();
const restored = latestHead
  ? world.lineage.restore(latestHead.worldId)
  : null;
const graph = world.lineage.getLineage();
```

Current head queries remain head-based in the public API. The projected `tip` and `headAdvancedAt` semantics live only in the Lineage v2 / World facade v2 drafts.

Sealed history is what makes audit and replay useful. The current Snapshot tells you the state now. Lineage tells you how that state became the current one.

---

## 5. Standalone Genesis Versus Governed Genesis

- Use standalone genesis when you only need to establish the first world state.
- Use governed genesis when you want the first seal to go through the same legitimacy and event flow as later seals.

The difference is policy, not data shape.

---

## Next

Return to [Governed Composition](./05-governed-composition) if you want the assembly details again, or jump back to [World](../concepts/world) for the conceptual model.
