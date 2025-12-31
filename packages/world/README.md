# @manifesto-ai/world

> **World** is the governance layer of Manifesto. It manages authority, proposals, decision records, and lineage.

---

## What is World?

World operates above Core and Host, governing who can propose changes, who can approve them, and tracking the complete history of all state transitions.

In the Manifesto architecture:

```
Bridge ──→ WORLD ──→ Host ──→ Core
             │
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
| Handle UI bindings | Bridge / React |
| Define domain logic | Builder |

---

## Installation

```bash
npm install @manifesto-ai/world @manifesto-ai/host @manifesto-ai/core
# or
pnpm add @manifesto-ai/world @manifesto-ai/host @manifesto-ai/core
```

---

## Quick Example

```typescript
import { createManifestoWorld, createAutoApproveHandler } from "@manifesto-ai/world";
import { createHost } from "@manifesto-ai/host";

// Create world with auto-approve authority
const world = createManifestoWorld({
  schemaHash: "todo-v1",
  host: createHost({ schema, snapshot }),
  defaultAuthority: createAutoApproveHandler(),
});

// Register an actor
world.registerActor({
  actorId: "user-1",
  kind: "human",
  name: "Alice",
});

// Submit a proposal
const result = await world.submitProposal({
  actorId: "user-1",
  intent: {
    type: "todo.add",
    input: { title: "Buy milk" },
  },
});

console.log(result.status); // → "completed"
console.log(result.world.worldId); // → "w_abc123..."
```

> See [GUIDE.md](../../docs/packages/world/GUIDE.md) for the full tutorial.

---

## World API

### Main Exports

```typescript
// Factory
function createManifestoWorld(config: ManifestoWorldConfig): ManifestoWorld;

// World class
class ManifestoWorld {
  registerActor(actor: ActorRef): void;
  bindAuthority(actorId, authorityId, policy): void;
  submitProposal(proposal: ProposalInput): Promise<ProposalResult>;
  getWorld(worldId: WorldId): World | undefined;
  queryProposals(query: ProposalQuery): Proposal[];
}

// Authority handlers
function createAutoApproveHandler(): AuthorityHandler;
function createPolicyRulesHandler(rules): AuthorityHandler;
function createHITLHandler(options): AuthorityHandler;
function createTribunalHandler(options): AuthorityHandler;

// Key types
type World = { worldId, schemaHash, snapshotHash, createdAt, createdBy };
type Proposal = { proposalId, actorId, intent, baseWorld, status, decision? };
type DecisionRecord = { decisionId, proposalId, authority, decision, timestamp };
type ActorRef = { actorId, kind: "human" | "agent" | "system", name?, meta? };
```

> See [SPEC.md](../../docs/packages/world/SPEC.md) for complete API reference.

---

## Core Concepts

### Authority System

World supports multiple authority types:

| Authority | Description |
|-----------|-------------|
| `auto` | Auto-approve all proposals (no deliberation) |
| `policy` | Rule-based decisions (path restrictions, rate limits) |
| `human` | Human-in-the-loop approval required |
| `tribunal` | Multi-agent review process |

```typescript
// Human-in-the-loop example
const hitlAuthority = createHITLHandler({
  notify: (proposal) => sendToApprovalQueue(proposal),
  timeout: 30_000, // 30 second timeout
});

world.bindAuthority("agent-1", "hitl-authority", hitlAuthority);
```

### Proposal Lifecycle

```
submitted → pending → approved → executing → completed
                  ↓                    ↓
               rejected              failed
```

### Immutable Worlds

Each successful proposal creates a new World. Worlds are immutable and form a DAG (directed acyclic graph) of lineage.

---

## Relationship with Other Packages

```
┌─────────────┐
│   Bridge    │ ← Uses World for governance
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    WORLD    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Host     │ ← World uses Host to execute
└─────────────┘
```

| Relationship | Package | How |
|--------------|---------|-----|
| Depends on | `@manifesto-ai/host` | Uses Host to execute proposals |
| Depends on | `@manifesto-ai/core` | Uses Core types |
| Used by | `@manifesto-ai/bridge` | Bridge submits proposals through World |

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
| [GUIDE.md](../../docs/packages/world/GUIDE.md) | Step-by-step usage guide |
| [SPEC.md](docs/SPEC.md) | Complete specification |
| [FDR.md](docs/FDR.md) | Design rationale |

---

## License

[MIT](../../LICENSE)
