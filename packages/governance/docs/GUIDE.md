# Governance Guide

> Practical guide for using `@manifesto-ai/governance` directly.

> **Current Contract Note:** This guide describes the current v1.0.0 governance surface. The projected v2.0.0 rewrite is tracked in [governance-SPEC-2.0.0v.md](governance-SPEC-2.0.0v.md) as draft only.

## 1. Assemble Governance On Top Of Lineage

```typescript
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createInMemoryGovernanceStore,
  createIntentInstance,
} from "@manifesto-ai/governance";
import {
  createInMemoryLineageStore,
  createLineageService,
} from "@manifesto-ai/lineage";

const lineageStore = createInMemoryLineageStore();
const lineage = createLineageService(lineageStore);
const governanceStore = createInMemoryGovernanceStore();
const governance = createGovernanceService(governanceStore, {
  lineageService: lineage,
});
const eventDispatcher = createGovernanceEventDispatcher({
  service: governance,
});
```

Governance depends on lineage for branch and identity reads. It does not own lineage storage or world sealing.

---

## 2. Create An Intent Instance

```typescript
const intent = await createIntentInstance({
  body: {
    type: "todo.add",
    input: { title: "Write the governance guide" },
  },
  schemaHash: "todo-v1",
  projectionId: "todo-ui",
  source: { kind: "ui", eventId: "evt-1" },
  actor: { actorId: "user-1", kind: "human" },
});
```

`intentKey` is derived from the intent body and schema context. It remains stable for the same semantic input.

---

## 3. Proposal Lifecycle Recipe

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
```

The governance service keeps proposal lifecycle, branch gating, and decision records explicit.

Typical statuses move through submitted, evaluating, approved or rejected, and then to a terminal outcome. If a proposal loses its branch race, it can become superseded instead of executing.

---

## 4. Branch Gate, Stale Ingress, And Superseded Cases

```typescript
if (governanceStore.getExecutionStageProposal(branch.id)) {
  throw new Error("branch already has an execution-stage proposal");
}
```

Use the branch gate to keep only one execution-stage proposal active for a branch at a time.

When the branch head changes before the decision lands, stale ingress should be discarded or superseded rather than executed against the wrong base world.

The important lesson is not the exact status label. The important lesson is that governance makes the race explicit and records the outcome.

---

## 5. Finalize And Emit

```typescript
const prepared = governance.prepareAuthorityResult(
  { ...proposal, status: "evaluating" },
  { kind: "approved", approvedScope: null },
  {
    currentEpoch: branch.epoch,
    currentBranchHead: branch.head,
    decidedAt: Date.now(),
  },
);

if (!prepared.decisionRecord) {
  throw new Error("expected decision record");
}

const executingProposal = {
  ...prepared.proposal,
  status: "executing" as const,
  decisionId: prepared.decisionRecord.decisionId,
  decidedAt: prepared.decisionRecord.decidedAt,
};

governanceStore.putProposal(executingProposal);
governanceStore.putDecisionRecord(prepared.decisionRecord);

const lineageCommit = lineage.prepareSealNext({
  schemaHash: "todo-v1",
  baseWorldId: branch.head,
  branchId: branch.id,
  terminalSnapshot,
  createdAt: Date.now(),
  proposalRef: executingProposal.proposalId,
  decisionRef: prepared.decisionRecord.decisionId,
});

const finalized = governance.finalize(
  executingProposal,
  lineageCommit,
  Date.now(),
);

const rejected = governance.finalizeOnSealRejection(
  executingProposal,
  {
    kind: "self_loop",
    computedWorldId: executingProposal.baseWorld,
    message: "No-op transition",
  },
  Date.now(),
);
```

Use `finalize()` for the normal success path. Use `finalizeOnSealRejection()` when the seal cannot be accepted and you still need a terminal governance record.

---

## 6. Post-Commit Event Dispatcher

```typescript
const events: string[] = [];
const eventDispatcher = createGovernanceEventDispatcher({
  service: governance,
  sink: {
    emit(event): void {
      events.push(event.type);
    },
  },
});

eventDispatcher.emitSealCompleted(finalized, lineageCommit);
eventDispatcher.emitSealRejected(rejected, {
  kind: "self_loop",
  computedWorldId: executingProposal.baseWorld,
  message: "No-op transition",
});
```

Use `createGovernanceEventDispatcher()` when you want post-commit event emission for completion, failure, world creation, or branch fork events.

---

## 7. Related Docs

- [Governance README](../README.md)
- [Governance Specification](governance-SPEC-1.0.0v.md)
- [Governance v2 Draft](governance-SPEC-2.0.0v.md)
- [Governance Version Index](VERSION-INDEX.md)
- [World](../../../docs/concepts/world)
- [Governed Composition](../../../docs/tutorial/05-governed-composition)
