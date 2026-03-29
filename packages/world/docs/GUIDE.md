# World Guide

> Practical guide for assembling the governed `@manifesto-ai/world` facade.

## 1. Assemble the Facade

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

## 2. Create Intent Instances

```typescript
import { createIntentInstance } from "@manifesto-ai/world";

const intent = await createIntentInstance({
  body: {
    type: "todo.add",
    input: { title: "Document the facade" },
  },
  schemaHash: "todo-v1",
  projectionId: "todo-ui",
  source: { kind: "ui", eventId: "evt-1" },
  actor: { actorId: "user-1", kind: "human" },
});
```

The intent key is derived from the intent body and schema data only. Origin metadata does not affect it.

## 3. Evaluate and Seal

```typescript
const branch = lineage.getActiveBranch();
const genesis = world.coordinator.sealGenesis({
  kind: "standalone",
  sealInput: {
    schemaHash: "todo-v1",
    terminalSnapshot,
    createdAt: Date.now(),
  },
});

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
```

World coordinates the commit sequence, governance finalization, and event emission. Lineage remains responsible for identity and history; governance remains responsible for legitimacy.

## 4. Canonical Imports

Use top-level `@manifesto-ai/world` for new code.

## 5. Related Docs

- [World README](../README.md)
- [World Specification](world-facade-spec-v1.0.0.md)
- [World Version Index](VERSION-INDEX.md)
