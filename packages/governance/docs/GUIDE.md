# Governance Guide

> Practical guide for using `@manifesto-ai/governance` directly.

## 1. Assemble Governance on Top of Lineage

```typescript
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createInMemoryGovernanceStore,
  createIntentInstance,
} from "@manifesto-ai/governance";
import { createInMemoryLineageStore, createLineageService } from "@manifesto-ai/lineage";

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

## 2. Create an Intent Instance

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

## 3. Evaluate a Proposal

```typescript
const branch = lineage.getActiveBranch();
const proposal = governance.createProposal({
  baseWorld: "world-1",
  branchId: branch.id,
  actorId: "user-1",
  authorityId: "auth-auto",
  intent: {
    type: intent.body.type,
    intentId: intent.intentId,
    input: intent.body.input,
    scopeProposal: intent.body.scopeProposal,
  },
  executionKey: "exec:intent-1",
  submittedAt: Date.now(),
  epoch: branch.epoch,
});
```

The governance service keeps proposal lifecycle, branch gating, and decision records explicit.

## 4. Finalize and Emit

```typescript
const prepared = governance.prepareAuthorityResult(
  { ...proposal, status: "evaluating" },
  { kind: "approved", approvedScope: null },
  {
    currentEpoch: branch.epoch,
    currentBranchHead: "world-1",
    decidedAt: Date.now(),
  },
);

const finalized = governance.finalize(prepared.proposal, prepared.decisionRecord);
```

Use `createGovernanceEventDispatcher()` when you want post-commit event payloads for completion, failure, world creation, or branch fork events.

## 5. Related Docs

- [Governance README](../README.md)
- [Governance Specification](governance-SPEC-1.0.0v.md)
- [Governance Version Index](VERSION-INDEX.md)

