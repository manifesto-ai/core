# World Guide

> Practical guide for the current governed `@manifesto-ai/world` runtime.

`@manifesto-ai/world` is the canonical package when you want explicit lineage, proposal flow, legitimacy, and sealed history in one runtime.

## 1. Assemble A Local Governed Runtime

```typescript
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createLineageService,
  createWorld,
} from "@manifesto-ai/world";
import { createSqliteWorldStore } from "@manifesto-ai/world/sqlite";

const filename = join(process.cwd(), ".manifesto", "world.sqlite");
mkdirSync(dirname(filename), { recursive: true });

const store = createSqliteWorldStore({ filename });
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
  executor,
});
```

For Node-local governed apps, `createSqliteWorldStore()` from `@manifesto-ai/world/sqlite` is the default path. Use `@manifesto-ai/world/in-memory` only for tests or ephemeral flows.

## 2. Bootstrap The First Sealed World

```typescript
await world.coordinator.sealGenesis({
  kind: "standalone",
  sealInput: {
    schemaHash: "counter-v1",
    terminalSnapshot: createCounterSnapshot(0, 1),
    createdAt: 1,
  },
});
```

This gives the active branch a real base world before proposals start executing.

## 3. Create And Approve A Governed Request

```typescript
const intent = await createIntentInstance({
  body: {
    type: "counter.increment",
    input: { amount: 1 },
  },
  schemaHash: "counter-v1",
  projectionId: "counter-cli",
  source: { kind: "script", eventId: "evt-1" },
  actor: { actorId: "local-user", kind: "human" },
  intentId: "intent-1",
});

const branch = await world.lineage.getActiveBranch();
const proposal = governance.createProposal({
  baseWorld: branch.head,
  branchId: branch.id,
  actorId: intent.meta.origin.actor.actorId,
  authorityId: "auth-local",
  intent: {
    type: intent.body.type,
    intentId: intent.intentId,
    input: intent.body.input,
    scopeProposal: intent.body.scopeProposal,
  },
  executionKey: intent.intentKey,
  submittedAt: 2,
  epoch: branch.epoch,
});

const approved = await governance.prepareAuthorityResult(
  { ...proposal, status: "evaluating" },
  { kind: "approved", approvedScope: null },
  {
    currentEpoch: branch.epoch,
    currentBranchHead: branch.head,
    decidedAt: 3,
  },
);
```

`createIntentInstance()` carries actor/source metadata. Governance turns that into a proposal and explicit approval result.

## 4. Execute Through WorldRuntime

```typescript
const executingProposal = {
  ...approved.proposal,
  status: "executing" as const,
  decisionId: approved.decisionRecord!.decisionId,
  decidedAt: approved.decisionRecord!.decidedAt,
};

await world.store.putProposal(executingProposal);
await world.store.putDecisionRecord(approved.decisionRecord!);

const completion = await world.runtime.executeApprovedProposal({
  proposal: executingProposal,
  completedAt: 4,
});
```

`WorldRuntime` is the consumer-facing happy-path entrypoint. It owns:

- executor invocation
- lineage sealing
- governance finalization
- atomic persistence
- post-commit event dispatch

## 5. Read The Resulting World

```typescript
const restored = await world.lineage.restore(completion.resultWorld);
console.log(restored.data.count);
```

The runtime does not hide history. It gives you the new sealed world id and keeps lineage queryable.

## 6. Swap Store Backends Deliberately

- `@manifesto-ai/world/sqlite` for Node-local durable apps
- `@manifesto-ai/world/in-memory` for tests or ephemeral flows
- `@manifesto-ai/world/indexeddb` for browser durable apps

The rest of the assembly stays the same because the store contract is `GovernedWorldStore`.

## 7. Related Docs

- [World README](../README.md)
- [World Spec v2 Draft](world-facade-spec-v2.0.0.md)
- [Governed Composition Guide](../../../docs/guides/governed-composition.md)
- [World API](../../../docs/api/world.md)
