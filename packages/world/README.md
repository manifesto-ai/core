# @manifesto-ai/world

> Explicit governance, proposal flow, and lineage for Manifesto deployments that need more than the default SDK path.

---

## What This Package Is For

Use `@manifesto-ai/world` when you need to answer questions like:

- Who proposed this change?
- Who approved it?
- What world did this transition come from?
- How do I require human review for agent actions?

If you only need the default `createManifesto()` runtime, you do not need this package on day one.

---

## How World Fits

```text
default path
SDK -> Host -> Core

governed path
participant -> World -> Host -> Core
```

World is an explicit integration layer. The current SDK does not wire it implicitly.

---

## Main Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Actor registry | Track human, agent, and system participants |
| Proposal flow | Accept, evaluate, and resolve proposed transitions |
| Authority policies | Auto-approve, rule-check, or require review |
| Lineage | Track immutable world ancestry |
| Audit records | Preserve approval and execution history |

---

## Quick Example

```typescript
import { createManifestoWorld, createIntentInstance } from "@manifesto-ai/world";

const world = createManifestoWorld({
  schemaHash: "todo-v1",
  executor: hostExecutor,
});

const actor = {
  actorId: "user-1",
  kind: "human",
  name: "Alice",
};

world.registerActor(actor, { mode: "auto_approve" });

const genesis = await world.createGenesis(initialSnapshot);

const intent = await createIntentInstance({
  body: {
    type: "todo.add",
    input: { title: "Review the governance model" },
  },
  schemaHash: world.schemaHash,
  projectionId: "todo-ui",
  source: { kind: "ui", eventId: "evt-1" },
  actor,
});

const result = await world.submitProposal(
  actor.actorId,
  intent,
  genesis.worldId,
);

console.log(result.proposal.status);
console.log(result.resultWorld?.worldId);
```

---

## Important Types

```typescript
function createManifestoWorld(config: ManifestoWorldConfig): ManifestoWorld;

class ManifestoWorld {
  createGenesis(initialSnapshot: Snapshot): Promise<World>;
  registerActor(actor: ActorRef, policy: AuthorityPolicy): void;
  submitProposal(
    actorId: string,
    intent: IntentInstance,
    baseWorld: WorldId,
    trace?: ProposalTrace,
  ): Promise<ProposalResult>;
}
```

Actor kinds are currently:

- `human`
- `agent`
- `system`

---

## Relationship With SDK

`@manifesto-ai/sdk` re-exports a small part of World for explicit integrations, such as the `WorldStore` type and `createMemoryWorldStore()`. The default `createManifesto()` path still focuses on direct intent dispatch rather than proposal orchestration.

---

## When to Adopt World

Bring in World when you need:

- human-in-the-loop approval
- explicit actor policies
- lineage across worlds
- governed multi-agent systems

Stay with the default SDK path when you only need direct domain execution.

---

## Documentation

- [World API](../../docs/api/world.md)
- [World Concept](../../docs/concepts/world.md)
- [Specifications](../../docs/internals/spec/)
