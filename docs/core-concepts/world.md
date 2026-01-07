# World

> **Sources:** packages/world/README.md, packages/world/docs/FDR.md, packages/world/docs/SPEC.md
> **Status:** Core Concept

---

## What is World?

**Definition:** The governance layer of Manifesto. World manages authority, proposals, decision records, and lineage—tracking who proposed what, when, and why.

**Canonical Principle:**

> **World governs legitimacy. Host executes work. These concerns never mix.**

---

## Responsibilities

| World DOES | World DOES NOT |
|------------|----------------|
| Manage actors (human, agent, system) | Compute state transitions |
| Evaluate authority for proposals | Execute effects |
| Track proposal lifecycle | Apply patches |
| Maintain lineage (World DAG) | Define business logic |
| Create decision records | Handle UI bindings |

---

## Architecture Position

```
┌─────────────────────────────────────────┐
│                Bridge                    │
│  (Dispatches intents)                    │
└────────────────┬────────────────────────┘
                 │ submitProposal
                 ▼
┌─────────────────────────────────────────┐
│                WORLD                     │
│  • Register actors                       │
│  • Evaluate authority                    │
│  • Track proposals                       │
│  • Maintain lineage                      │
└────────────────┬────────────────────────┘
                 │ Approved intents only
                 ▼
┌─────────────────────────────────────────┐
│                Host                      │
│  (Executes approved intents)             │
└─────────────────────────────────────────┘
```

---

## Core Concepts

### 1. World (Immutable State Record)

```typescript
type World = {
  readonly worldId: WorldId;           // Unique identifier
  readonly schemaHash: string;         // Which schema
  readonly snapshotHash: string;       // Content-addressable snapshot hash
  readonly createdAt: number;          // Timestamp
  readonly createdBy: ProposalId | null; // Which proposal created this
  readonly executionTraceRef?: ArtifactRef; // Link to execution trace
};
```

**Key Properties:**
- **Immutable** - Once created, never modified
- **Content-addressable** - `snapshotHash` uniquely identifies state
- **Lineage** - `createdBy` links to parent World

### 2. Proposal

```typescript
type Proposal = {
  readonly proposalId: ProposalId;
  readonly actor: ActorRef;           // WHO wants to do this
  readonly intent: IntentInstance;    // WHAT they want to do
  readonly baseWorld: WorldId;        // WHERE (which reality)
  readonly submittedAt: number;       // WHEN
  readonly status: ProposalStatus;    // Current state
  readonly decision?: DecisionRecord; // Authority decision (if terminal)
  readonly resultWorld?: WorldId;     // Resulting World (if executed)
};

type ProposalStatus =
  | 'submitted'   // Just created
  | 'pending'     // Authority deliberating
  | 'approved'    // Authority approved
  | 'rejected'    // Authority rejected
  | 'executing'   // Host is executing
  | 'completed'   // Successfully executed
  | 'failed';     // Execution failed
```

**Key Principle:** Proposal = Actor + Intent (Accountability Envelope)

From FDR-W002:
> Proposal enables traceability: "Who intended what in which reality?"

### 3. Actor

```typescript
type ActorRef = {
  readonly actorId: string;
  readonly kind: 'human' | 'agent' | 'system';
  readonly name?: string;
  readonly meta?: Record<string, unknown>;
};
```

**All actors are first-class citizens.** There is no privileged actor type at the protocol level.

From FDR-W003:
> Human, agent, and system actors go through the same protocol. Policy differs, not protocol.

### 4. Authority

```typescript
type AuthorityHandler = (
  proposal: Proposal,
  context: AuthorityContext
) => Promise<AuthorityResponse>;

type AuthorityResponse =
  | { kind: 'approved'; reason?: string }
  | { kind: 'rejected'; reason: string }
  | { kind: 'pending'; waitingFor: string };
```

**Authority Types:**

| Type | Description | Use Case |
|------|-------------|----------|
| `auto` | Auto-approve all | Simple apps, trusted actors |
| `policy` | Rule-based decisions | Path restrictions, rate limits |
| `hitl` | Human-in-the-loop | Agent supervision |
| `tribunal` | Multi-agent review | Critical decisions |

### 5. Decision Record

```typescript
type DecisionRecord = {
  readonly decisionId: DecisionId;
  readonly proposalId: ProposalId;
  readonly authority: AuthorityRef;     // Which authority decided
  readonly decision: 'approved' | 'rejected';
  readonly reason?: string;
  readonly timestamp: number;
};
```

**Important:** DecisionRecord is created **only for terminal decisions** (approved/rejected), not for `pending`.

From FDR-W005:
> `pending` is deliberation, not decision. Decision is final.

---

## Proposal Lifecycle

```
User submits intent
        ↓
┌─────────────────────┐
│   submitted         │ Proposal created
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   pending           │ Authority evaluating (may repeat)
└──────┬──────────────┘
       │
       ├──→ approved ──→ executing ──→ completed ✓
       │                           └──→ failed ✗
       │
       └──→ rejected ✗
```

### Status Details

| Status | Meaning | Next Step |
|--------|---------|-----------|
| `submitted` | Just created | Authority evaluates |
| `pending` | Authority thinking | Wait or re-evaluate |
| `approved` | Authority approved | Host executes |
| `rejected` | Authority denied | Done (no World created) |
| `executing` | Host running | Wait for completion |
| `completed` | Successfully executed | New World created |
| `failed` | Execution error | New World created (with error) |

---

## World Lineage (DAG)

Worlds form a Directed Acyclic Graph (DAG) through WorldEdge records:

```typescript
type WorldEdge = {
  readonly edgeId: EdgeId;
  readonly fromWorld: WorldId;
  readonly toWorld: WorldId;
  readonly proposal: ProposalId;
  readonly createdAt: number;
};
```

### Lineage Rules

From FDR-W010 (v1.0):

- Each World has **exactly one parent** (fork-only, no merge in v1.0)
- Genesis World has no parent
- Rejected proposals do NOT create Worlds
- Failed executions DO create Worlds (with error state)

```
Genesis World
     ├──→ World-2 (Proposal A executed)
     │       └──→ World-4 (Proposal C executed)
     │
     └──→ World-3 (Proposal B executed)
             └──→ World-5 (Proposal D executed)
```

---

## Intent-Level Governance

From FDR-W001:

World Protocol governs **Intent submission and approval**, not individual patches.

**Why?**

- Intent is the unit of human meaning
- Patch is implementation detail
- Users approve "add todo", not "patch field X"

**Once Intent is approved, all patches and effects during its execution are implicitly authorized.**

---

## Actor-Authority Binding

Each Actor has exactly one Authority binding:

```typescript
type ActorAuthorityBinding = {
  readonly actor: ActorRef;
  readonly authority: AuthorityRef;
  readonly policy: AuthorityPolicy;
};
```

From FDR-W004:
> Trust is assigned to actors, not actions. "I trust Alice to do anything" vs "I trust this bot only for reads."

---

## World Immutability

From FDR-W008:

**Worlds are immutable.** Any change creates a new World; existing Worlds never change.

**Benefits:**
- Time travel (go back to World-N)
- Audit (inspect World-N as it was)
- Reproducibility (replay from genesis)
- Branching (explore alternatives)

```typescript
// FORBIDDEN: Mutating a World
world.snapshot = newSnapshot; // WRONG!

// REQUIRED: Creating a new World
const newWorld = await world.submitProposal(actor, intent);
// Old world still exists unchanged
```

---

## SnapshotHash (Content-Addressable)

From FDR-W009:

`snapshotHash` is computed from canonical form that **excludes non-deterministic fields**:

```typescript
type SnapshotHashInput = {
  data: Snapshot['data'],
  system: {
    status: Snapshot['system']['status'],
    lastError: Snapshot['system']['lastError'],
    errors: Snapshot['system']['errors'],
    pendingRequirements: Snapshot['system']['pendingRequirements']
  }
};

// NOT included: meta.timestamp, meta.version, computed
```

**Why?** Same Proposals → Same WorldId (deterministic replay).

---

## World API

```typescript
// Create World
const world = createManifestoWorld({
  schemaHash: 'todo-v1',
  host: createHost(schema, {
    initialData: {},
    context: { now: () => Date.now() },
  }),
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
  name: 'Trading Bot'
});

// Bind authority
world.bindAuthority('agent-1', 'hitl-authority', createHITLHandler({
  notify: (proposal) => sendToApprovalQueue(proposal),
  timeout: 30000
}));

// Submit proposal
const result = await world.submitProposal({
  actorId: 'user-1',
  intent: {
    type: 'addTodo',
    input: { title: 'Buy milk' }
  }
});

console.log(result.status); // 'completed'
console.log(result.world.worldId); // 'w_abc123...'
```

---

## Authority Patterns

### Pattern 1: Auto-Approve (Simple Apps)

```typescript
const authority = createAutoApproveHandler();
world.bindAuthority('user-1', 'auto', authority);
```

### Pattern 2: Policy Rules

```typescript
const policy = {
  mode: "policy_rules",
  rules: [
    {
      condition: { kind: "intent_type", types: ["user.update"] },
      decision: "approve",
      reason: "Allow user profile updates",
    },
    {
      condition: { kind: "scope_pattern", pattern: "todos.*" },
      decision: "approve",
      reason: "Allow todo intents",
    },
  ],
  defaultDecision: "reject",
};

world.registerActor({ actorId: "user-1", kind: "user" }, policy);
```

### Pattern 3: HITL (Agent Supervision)

```typescript
const authority = createHITLHandler({
  notify: async (proposal) => {
    await slack.sendMessage({
      channel: '#agent-approvals',
      text: `Agent ${proposal.actor.actorId} wants to: ${proposal.intent.type}`
    });
  },
  timeout: 60000 // 1 minute timeout
});

world.bindAuthority('trading-agent', 'hitl', authority);
```

### Pattern 4: Tribunal (Multi-Agent Review)

```typescript
const authority = createTribunalHandler({
  judges: ['judge-1', 'judge-2', 'judge-3'],
  quorum: 2, // 2 out of 3 must approve
  timeout: 120000
});
```

---

## Common Misconceptions

### Misconception 1: "World is just a wrapper around Snapshot"

**Wrong:** World = Snapshot + metadata.

**Right:** World includes:
- Immutable Snapshot reference (via snapshotHash)
- Governance metadata (createdBy, authority)
- Lineage (parent/child relationships)
- Decision records (audit trail)

### Misconception 2: "Rejected proposals create Worlds"

**Wrong:** Rejected proposals create "rejected Worlds."

**Right:** Rejected proposals do NOT create Worlds. Only executed Proposals (success or failure) create Worlds.

From FDR-W011:
> Rejection is counterfactual—it describes what someone wanted to do, not what happened.

### Misconception 3: "World handles execution"

**Wrong:** World executes Intents.

**Right:** World approves Intents, then delegates to Host for execution.

---

## When to Use World

Use World when:
- Building applications with governance requirements
- Implementing human-in-the-loop approval flows
- Tracking audit trails for compliance
- Building multi-agent systems with authority policies

**For simple applications without governance, you can use Host directly.**

---

## Design Rationale Summary

From World FDR:

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| W001 | Intent-level governance | Intent is human meaning |
| W002 | Proposal = Actor + Intent | Accountability envelope |
| W003 | Actor as first-class citizen | Protocol uniformity |
| W004 | Actor-Authority 1:1 binding | Trust is per-actor |
| W005 | Pending is not decision | Deliberation ≠ Decision |
| W006 | Host executes approved only | Separation of concerns |
| W008 | World immutability | Time travel and audit |
| W011 | Rejected → no World | Rejection is counterfactual |
| W012 | Failure → World created | Failure is an outcome |

---

## Related Concepts

- **Proposal** - Accountability envelope (Actor + Intent)
- **Authority** - Policy engine for approval
- **DecisionRecord** - Immutable audit of decisions
- **Host** - Execution layer used by World

---

## See Also

- [World Protocol](/specifications/world-spec) - Normative specification
- [World FDR](/rationale/world-fdr) - Why decisions were made
- [Getting Started Guide](/guides/getting-started) - Practical guide
- [Intent](./intent) - Understanding intents
