# World Guide

> Practical guide for the exact-facade `@manifesto-ai/world` surface.

## 1. Assemble the Governed Runtime

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
const eventDispatcher = createGovernanceEventDispatcher({
  service: governance,
});

const world = createWorld({
  store,
  lineage,
  governance,
  eventDispatcher,
});
```

`createWorld()` does not hide proposal evaluation or sealing. It wires together the coordinator, lineage service, governance service, and composite store.

## 2. Seal Genesis

```typescript
const genesis = world.coordinator.sealGenesis({
  kind: "standalone",
  sealInput: {
    schemaHash: "todo-v1",
    terminalSnapshot,
    createdAt: Date.now(),
  },
});
```

Standalone genesis writes only lineage records. Governed genesis uses the full lineage + governance commit path.

## 3. Create an Intent Instance

```typescript
import { createIntentInstance } from "@manifesto-ai/world";

const intent = await createIntentInstance({
  body: {
    type: "todo.add",
    input: { title: "Document the hard cut" },
  },
  schemaHash: "todo-v1",
  projectionId: "todo-ui",
  source: { kind: "ui", eventId: "evt-1" },
  actor: { actorId: "user-1", kind: "human" },
});
```

`intentKey` is computed from `schemaHash`, `body.type`, `body.input`, and `body.scopeProposal` using JCS + SHA-256. Origin metadata does not affect the key.

## 4. Evaluate and Seal a Proposal

```typescript
const branch = lineage.getActiveBranch();

const proposal = governance.createProposal({
  baseWorld: genesis.worldId,
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

const prepared = governance.prepareAuthorityResult(
  { ...proposal, status: "evaluating" },
  { kind: "approved", approvedScope: null },
  {
    currentEpoch: branch.epoch,
    currentBranchHead: genesis.worldId,
    decidedAt: Date.now(),
  },
);

store.putProposal({
  ...prepared.proposal,
  status: "executing",
  decisionId: prepared.decisionRecord!.decisionId,
  decidedAt: prepared.decisionRecord!.decidedAt,
});
store.putDecisionRecord(prepared.decisionRecord!);

const sealed = world.coordinator.sealNext({
  executingProposal: store.getProposal(proposal.proposalId)!,
  completedAt: Date.now(),
  sealInput: {
    schemaHash: "todo-v1",
    baseWorldId: genesis.worldId,
    branchId: branch.id,
    terminalSnapshot,
    createdAt: Date.now(),
    proposalRef: proposal.proposalId,
    decisionRef: prepared.decisionRecord!.decisionId,
  },
});
```

The coordinator enforces:

- prepare -> finalize -> commit -> emit ordering
- post-commit-only event emission
- retry from prepare on CAS mismatch
- governance-only commit on seal rejection

## 5. Canonical Imports

Use top-level `@manifesto-ai/world` for new code.

`@manifesto-ai/world/facade` currently exists only as an exact alias for the same surface.
