# World

> The governance layer managing authority, proposals, and lineage.

## What is World?

World is Manifesto's governance layer. It manages who can do what, tracks proposals through their lifecycle, and maintains an immutable lineage of all state changes.

Every Intent passes through World Protocol before execution. World evaluates authority (can this actor perform this action?), creates decision records, and only then delegates to Host for execution.

World answers the fundamental governance questions: Who proposed what? When? Was it approved? By whom? What was the result?

## Structure

### World Record

```typescript
type World = {
  readonly worldId: WorldId;
  readonly schemaHash: string;
  readonly snapshotHash: string;      // Content-addressable
  readonly createdAt: number;
  readonly createdBy: ProposalId | null;
  readonly executionTraceRef?: ArtifactRef;
};
```

### Proposal

```typescript
type Proposal = {
  readonly proposalId: ProposalId;
  readonly actor: ActorRef;           // WHO
  readonly intent: IntentInstance;    // WHAT
  readonly baseWorld: WorldId;        // WHERE
  readonly submittedAt: number;       // WHEN
  readonly status: ProposalStatus;
  readonly decision?: DecisionRecord;
  readonly resultWorld?: WorldId;
};

type ProposalStatus =
  | 'submitted' | 'pending' | 'approved'
  | 'rejected' | 'executing' | 'completed' | 'failed';
```

### Actor

```typescript
type ActorRef = {
  readonly actorId: string;
  readonly kind: 'human' | 'agent' | 'system';
  readonly name?: string;
};
```

## Key Properties

- **Immutable**: Worlds never change; changes create new Worlds.
- **Traceable**: Every World links to its creating Proposal.
- **Actor-neutral**: Humans, agents, and systems use the same protocol.
- **Intent-level**: Governance is per-Intent, not per-patch.

## Example

```typescript
import { createManifestoWorld, createAutoApproveHandler } from "@manifesto-ai/world";

// Create World
const world = createManifestoWorld({
  schemaHash: 'todo-v1',
  host: createHost(schema, { initialData: {} }),
  defaultAuthority: createAutoApproveHandler()
});

// Register actors
world.registerActor({
  actorId: 'user-1',
  kind: 'human',
  name: 'Alice'
});

world.registerActor({
  actorId: 'agent-1',
  kind: 'agent',
  name: 'Assistant Bot'
});

// Submit proposal
const result = await world.submitProposal({
  actorId: 'user-1',
  intent: { type: 'addTodo', input: { title: 'Buy milk' } }
});

console.log(result.status);        // 'completed'
console.log(result.world.worldId); // 'w_abc123...'
```

## Common Patterns

### Auto-Approve (Simple Apps)

```typescript
const authority = createAutoApproveHandler();
world.bindAuthority('user-1', 'auto', authority);
```

### Policy Rules

```typescript
const policy = {
  mode: "policy_rules",
  rules: [
    {
      condition: { kind: "intent_type", types: ["todos.add", "todos.toggle"] },
      decision: "approve"
    },
    {
      condition: { kind: "intent_type", types: ["todos.deleteAll"] },
      decision: "reject",
      reason: "Bulk delete not allowed"
    }
  ],
  defaultDecision: "reject"
};

world.registerActor({ actorId: "bot-1", kind: "agent" }, policy);
```

### Human-in-the-Loop

```typescript
const authority = createHITLHandler({
  notify: async (proposal) => {
    await slack.send({
      channel: '#approvals',
      text: `${proposal.actor.name} wants to: ${proposal.intent.type}`
    });
  },
  timeout: 60000
});

world.bindAuthority('trading-bot', 'hitl', authority);
```

## Proposal Lifecycle

```
submitted -> pending -> approved -> executing -> completed
                    \                         \-> failed
                     \-> rejected
```

| Status | Meaning |
|--------|---------|
| `submitted` | Proposal created |
| `pending` | Authority evaluating |
| `approved` | Ready for execution |
| `rejected` | Denied (no World created) |
| `executing` | Host running |
| `completed` | Success (new World created) |
| `failed` | Error (new World with error state) |

## World Lineage

Worlds form a DAG (Directed Acyclic Graph):

```
Genesis World
     |
     +---> World-2 (Proposal A)
     |         |
     |         +---> World-4 (Proposal C)
     |
     +---> World-3 (Proposal B)
               |
               +---> World-5 (Proposal D)
```

- Each World has exactly one parent
- Genesis has no parent
- Rejected proposals don't create Worlds
- Failed executions create Worlds (with error state)

## Authority Types

| Type | Description | Use Case |
|------|-------------|----------|
| `auto` | Auto-approve all | Trusted actors |
| `policy` | Rule-based decisions | Scoped permissions |
| `hitl` | Human-in-the-loop | Agent supervision |
| `tribunal` | Multi-agent review | Critical decisions |

## See Also

- [Intent](./intent.md) - What World governs
- [Snapshot](./snapshot.md) - State that World wraps
- [Effect](./effect.md) - Operations authorized by World
