# @manifesto-ai/world

> **World** is the governance layer of Manifesto. It manages authority, proposals, decision records, and lineage.

---

## What is World?

World operates above Core and Host, governing who can propose changes, who can approve them, and tracking the complete history of all state transitions.
World never imports Host directly; App provides a HostExecutor adapter.

In the Manifesto architecture:

```
App -> World -> Host -> Core
          |
  Governs legitimacy, authority, lineage
  Tracks WHO proposed WHAT, WHEN, WHY
```

---

## What World Does

| Responsibility | Description |
|----------------|-------------|
| Manage actors | Register and track actors (human, agent, system) |
| Evaluate authority | Route proposals to appropriate authority handlers |
| Track proposals | Full lifecycle from submission to completion |
| Maintain lineage | DAG of World ancestry (who came from where) |
| Create decision records | Immutable audit trail of authority decisions |

---

## What World Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Compute state transitions | Core |
| Execute effects | Host |
| Handle UI/event bindings | App |
| Define domain logic | App |

---

## Installation

```bash
npm install @manifesto-ai/world @manifesto-ai/core
# or
pnpm add @manifesto-ai/world @manifesto-ai/core
```

---

## Quick Example

```typescript
import { createManifestoWorld, createIntentInstance } from "@manifesto-ai/world";

const world = createManifestoWorld({
  schemaHash: "todo-v1",
  executor: appHostExecutor, // App-provided HostExecutor (optional)
});

// Register an actor
const actor = {
  actorId: "user-1",
  kind: "human",
  name: "Alice",
};
world.registerActor(actor, { mode: "auto_approve" });

// Create genesis world
const initialSnapshot = /* Snapshot from Core */;
const genesis = await world.createGenesis(initialSnapshot);

// Build intent instance
const intent = await createIntentInstance({
  body: {
    type: "todo.add",
    input: { title: "Buy milk" },
  },
  schemaHash: world.schemaHash,
  projectionId: "app:ui",
  source: { kind: "ui", eventId: "evt-1" },
  actor,
});

// Submit a proposal
const result = await world.submitProposal(actor.actorId, intent, genesis.worldId);

console.log(result.proposal.status); // -> "completed" | "failed" | "rejected" | "evaluating"
if (result.resultWorld) {
  console.log(result.resultWorld.worldId); // -> "w_abc123..."
}
```

> See [GUIDE.md](GUIDE.md) for the full tutorial.

---

## World API

### Main Exports

```typescript
// Factory
function createManifestoWorld(config: ManifestoWorldConfig): ManifestoWorld;

// World class
class ManifestoWorld {
  registerActor(actor: ActorRef): void;
  registerActor(actor: ActorRef, policy: AuthorityPolicy): void;
  updateActorBinding(actorId: string, policy: AuthorityPolicy): void;
  submitProposal(actorId: string, intent: IntentInstance, baseWorld: WorldId, trace?: ProposalTrace): Promise<ProposalResult>;
  processHITLDecision(proposalId: string, decision: "approved" | "rejected", reason?: string, approvedScope?: IntentScope | null): Promise<ProposalResult>;
  getWorld(worldId: WorldId): Promise<World | null>;
  getSnapshot(worldId: WorldId): Promise<Snapshot | null>;
  getProposal(proposalId: string): Promise<Proposal | null>;
  getEvaluatingProposals(): Promise<Proposal[]>;
}

// Key types
type World = { worldId, schemaHash, snapshotHash, createdAt, createdBy };
type Proposal = { proposalId, actor, intent, baseWorld, status, decisionId? };
type DecisionRecord = { decisionId, proposalId, authority, decision, decidedAt };
type ActorRef = { actorId, kind: "human" | "agent" | "system", name?, meta? };
```

> See [world-SPEC-v2.0.2.md](world-SPEC-v2.0.2.md) for complete API reference.

---

## Core Concepts

### Authority Policies

World routes proposals using authority policy objects:

| Policy | Description |
|--------|-------------|
| `auto_approve` | Auto-approve all proposals |
| `policy_rules` | Rule-based decisions |
| `hitl` | Human-in-the-loop approval |
| `tribunal` | Multi-agent review |

```typescript
const reviewer = { actorId: "human-1", kind: "human" };
world.registerActor(
  { actorId: "agent-1", kind: "agent" },
  { mode: "hitl", delegate: reviewer }
);
```

### Proposal Lifecycle

```
submitted -> evaluating -> approved -> executing -> completed
                     v                    v
                  rejected              failed
```

### Immutable Worlds

Each successful proposal creates a new World. Worlds are immutable and form a DAG (directed acyclic graph) of lineage.

---

## Relationship with Other Packages

```
App -> World -> Host
```

| Relationship | Package | How |
|--------------|---------|-----|
| Depends on | `@manifesto-ai/core` | Uses Core types |
| Integrates with | `@manifesto-ai/host` | Via HostExecutor adapter (App-provided) |
| Used by | `@manifesto-ai/sdk` | SDK submits proposals through World |

---

## When to Use World Directly

Use World directly when:
- Building applications with governance requirements
- Implementing human-in-the-loop approval flows
- Tracking audit trails for compliance
- Building multi-agent systems with authority policies

For simple applications without governance, you can use Host directly.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](GUIDE.md) | Step-by-step usage guide |
| [world-SPEC-v2.0.2.md](world-SPEC-v2.0.2.md) | Complete specification |
| [world-FDR-v2.0.2.md](world-FDR-v2.0.2.md) | Design rationale |

---

## License

[MIT](../../LICENSE)
