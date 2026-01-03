# World Protocol — Foundational Design Rationale (FDR)

> **Version:** 1.0 (Revised)
> **Status:** Normative
> **Purpose:** Document the "Why" behind every constitutional decision in the World Protocol

---

## Overview

This document records the foundational design decisions that shape the World Protocol.

Each FDR entry follows the format:

- **Decision**: What was decided
- **Context**: Why this decision was needed
- **Rationale**: The reasoning behind the choice
- **Alternatives Rejected**: Other options considered and why they were rejected
- **Consequences**: What this decision enables and constrains

---

## FDR-W001: Intent-Level Governance, Not Patch-Level

### Decision

World Protocol governs **Intent submission and approval**, not individual patches.

Once an Intent is approved, all patches and effects during its execution are implicitly authorized.

### Context

Two possible governance granularities:

| Level | Description | Example |
|-------|-------------|---------|
| **Patch-level** | Every state change needs approval | Each `apply()` call requires Authority |
| **Intent-level** | User intention needs approval | "addTodo" approved → all its patches allowed |

### Rationale

**Intent is the unit of human meaning. Patch is implementation detail.**

When a human says "add a todo", they mean the complete action:
- Optimistic UI update
- API call
- Success/failure handling

They don't mean "approve patch 1, now approve patch 2, now approve effect result..."

| Concern | Intent-Level | Patch-Level |
|---------|--------------|-------------|
| **User mental model** | ✅ Matches | ❌ Alien |
| **Practicality** | ✅ One approval | ❌ Dozens of approvals |
| **Async HITL** | ✅ Feasible | ❌ Blocking on every patch |
| **Auditability** | ✅ "Who intended what" | ⚠️ "Who approved patch #47" |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Patch-level approval | Impractical, breaks async HITL, alien to users |
| Hybrid (some patches need approval) | Complex rules, unclear boundaries |
| No governance | No accountability, no audit trail |

### Consequences

- Authority judges Proposals (Intent + Actor), not patches
- Once approved, Host executes without further approval
- Effect results are implicitly authorized
- Audit trail shows "Actor X intended Y", not "patch Z was approved"

---

## FDR-W002: Proposal = Actor + Intent (Accountability Envelope)

### Decision

A **Proposal** is the envelope that wraps an Intent with its Actor identity:

```
Proposal = Actor + Intent + baseWorld
         = "누가" + "무슨 의도를" + "어디서"
```

### Context

Without Proposal, we only have Intent:

```typescript
IntentInstance = {
  body: { type: 'sellStock', input: { qty: 1000 }, scopeProposal?: ... },
  intentId: '...',
  intentKey: '...',
  meta: { origin: { ... } }
}
```

Question: **Who** requested this deletion?

- A human user? → Probably okay
- A rogue agent? → Needs review
- A scheduled system job? → Check scope

**Intent alone cannot answer "who is accountable".**

### Rationale

**Proposal enables traceability: "누가 어떤 의도로 어떤 짓을 벌였는지"**

```typescript
Proposal = {
  proposalId: 'prop-123',
  actor: { actorId: 'trading-agent', kind: 'agent' },  // WHO
  intent: { type: 'sellStock', input: { qty: 1000 } },  // WHAT
  baseWorld: 'world-456',  // WHERE (which reality)
  submittedAt: 1704067200000  // WHEN
}
```

This enables:
- Routing to correct Authority (based on Actor)
- Audit trail (who did what when)
- Accountability (agent X caused problem Y)
- Policy enforcement (agent X can't do action Y)

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Intent carries actorId field | Conflates Core concept (Intent) with governance |
| Infer actor from context | Implicit, not auditable, error-prone |
| No actor tracking | No accountability, no governance possible |

### Consequences

- Every Intent submission is wrapped in Proposal
- Actor identity is mandatory
- Authority can make decisions based on Actor
- Full audit trail of "who intended what"

---

## FDR-W003: Actor as First-Class Citizen

### Decision

All Actors—human, agent, system—are **first-class citizens** with equal structural treatment.

There is no privileged Actor type at the protocol level.

### Context

Traditional systems often hardcode human privilege:

```typescript
// Traditional approach
if (isHuman(actor)) {
  execute(intent);  // Humans bypass checks
} else {
  checkPermission(actor, intent);
}
```

This creates:
- Inconsistent code paths
- Hidden assumptions
- Untestable human flows

### Rationale

**Protocol uniformity enables policy flexibility.**

All Actors go through the same flow:

```
Actor → Proposal → Authority → Host → World
```

The **policy** differs, not the **protocol**:

```typescript
// Same protocol, different policy
const humanPolicy: AuthorityPolicy = { mode: 'auto_approve' };
const agentPolicy: AuthorityPolicy = { mode: 'hitl', delegate: humanRef };
const systemPolicy: AuthorityPolicy = { mode: 'scope_check', allowedScopes: [...] };
```

| Benefit | Description |
|---------|-------------|
| **Testability** | Same test harness for all actors |
| **Auditability** | Same audit format for all actors |
| **Flexibility** | Policy change doesn't require protocol change |
| **Composability** | Actors can delegate to other actors uniformly |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Human bypass (no Proposal) | Inconsistent, no audit trail for humans |
| Different protocols per actor type | Complex, hard to maintain |
| Agent-only governance | Humans escape accountability |

### Consequences

- Human actions also create Proposals (even if auto-approved)
- Complete audit trail regardless of actor type
- Policy is configuration, not code
- "Human is special" is expressed as policy, not protocol

---

## FDR-W004: Actor-Authority 1:1 Binding

### Decision

Each Actor has exactly one Authority binding. Multiple Actors MAY share the same Authority.

```typescript
type ActorAuthorityBinding = {
  readonly actor: ActorRef;
  readonly authority: AuthorityRef;
  readonly policy: AuthorityPolicy;
};
```

### Context

How should the system know which Authority judges which Actor's Proposals?

Options:
1. Global Authority (one for all)
2. Action-based Authority (different per action type)
3. Actor-based Authority (different per actor)
4. Matrix (actor × action → authority)

### Rationale

**Actor-based binding matches the real-world trust model.**

In reality, trust is assigned to **people/systems**, not actions:
- "I trust Alice to do anything"
- "I trust this bot only for read operations"
- "This agent needs my approval for everything"

```typescript
// Actor-based binding (chosen)
const bindings = [
  { actor: alice, authority: autoApprove, policy: { mode: 'auto' } },
  { actor: tradingBot, authority: alice, policy: { mode: 'hitl' } },
  { actor: dangerousAgent, authority: tribunal, policy: { mode: 'review' } },
];
```

**Clarification on "1:1":**
- Each Actor → exactly one Authority (not bijection)
- Multiple Actors → same Authority is allowed
- This is "many-to-one", not "one-to-one" in mathematical sense

| Model | Trust Granularity | Complexity | Real-world Match |
|-------|------------------|------------|------------------|
| Global | None | Low | ❌ |
| Action-based | Per action | Medium | ⚠️ Partial |
| **Actor-based** | Per actor | Medium | ✅ Best |
| Matrix | Per actor×action | High | ⚠️ Over-engineered |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Global Authority | Can't differentiate trust levels |
| Action-based | Same actor doing "read" vs "delete" has different trust? Odd. |
| Matrix | Combinatorial explosion, hard to manage |

### Consequences

- Each Actor registration includes Authority binding
- Changing an Actor's trust = changing its binding
- World (Orchestrator) manages the binding registry
- Simple lookup: `findAuthority(actor) → authority`

---

## FDR-W005: Proposal State Machine with Pending as Non-Decision

### Decision

Proposals follow a defined state machine. **`pending` is a deliberation state, NOT a decision.**

DecisionRecord is created **only for terminal decisions** (`approved` or `rejected`).

```
submitted → pending → approved → executing → completed
               │                      │
               └─→ rejected           └─→ failed
```

### Context

Initial design had ambiguity:
- Is `pending` a decision?
- When is DecisionRecord created?
- Can Authority "re-judge" after `pending`?

### Rationale

**Deliberation is not decision. Decision is final.**

| State | Nature | DecisionRecord? |
|-------|--------|-----------------|
| `submitted` | Initial | ❌ |
| `pending` | **Deliberation** | ❌ |
| `approved` | **Terminal Decision** | ✅ |
| `rejected` | **Terminal Decision** | ✅ |
| `executing` | Execution | — |
| `completed` | Terminal | — |
| `failed` | Terminal | — |

**Key insight:** Authority MAY return `pending` multiple times. This is not "changing its mind"—it's "still thinking."

```typescript
// Authority deliberation loop
while (true) {
  const response = authority.evaluate(proposal);
  
  if (response.kind === 'pending') {
    // Still deliberating, no DecisionRecord yet
    proposal.status = 'pending';
    await wait(response.waitingFor);
    continue;
  }
  
  // Terminal decision reached
  createDecisionRecord(proposal, response);  // Only here!
  proposal.status = response.kind;  // 'approved' or 'rejected'
  break;
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| DecisionRecord for all states | `pending` is not a decision, pollutes audit log |
| No pending state | Can't model async HITL |
| Multiple DecisionRecords per Proposal | Confusing, "which is final?" |

### Consequences

- `pending` is purely transitional
- DecisionRecord = terminal decision artifact
- INV-A3 is "no re-judgment of **terminal** decision"
- Authority returning `pending` → `approved` is normal flow, not re-judgment

---

## FDR-W006: Host Executes Approved Intents Only

### Decision

Host receives only **approved Intents** and executes them to completion without pause.

Host has no knowledge of Authority, Proposals, or pending states.

### Context

Where does "approval waiting" happen?

Option A: Host pauses mid-execution
```typescript
// Host knows about approval
host.execute(intent);  // Might pause for HITL inside
```

Option B: Host only gets approved work
```typescript
// Host is approval-agnostic
worldProtocol.approve(proposal);  // Approval happens here
host.execute(proposal.intent);    // Host just executes
```

### Rationale

**Separation of concerns: governance vs execution.**

| Concern | World Protocol | Host |
|---------|---------------|------|
| Who submitted | ✅ | ❌ |
| Is it approved | ✅ | ❌ |
| Execute compute/apply | ❌ | ✅ |
| Run effects | ❌ | ✅ |

**Host doesn't need to know about governance.** It just runs approved work.

This enables:
- Simpler Host implementation
- Host Contract unchanged by governance changes
- Clear testing boundaries
- No "pause for approval" complexity in Host

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Host handles approval | Mixes concerns, complex Host |
| Host pause/resume for HITL | Requires suspended context, violates FDR-H003 |
| Approval checks inside Host loop | Every effect would need approval check |

### Consequences

- Host Contract remains pure (no governance concepts)
- World Protocol is the only place governance logic lives
- Clean interface: `host.execute(approvedIntent) → Snapshot`
- No pause/resume needed in Host

---

## FDR-W007: Constitutional Review as Effect

### Decision

Constitutional review (by AI tribunal or other complex judgment) is modeled as an **effect**, not a special protocol mechanism.

### Context

When an Agent's Proposal needs deep review:

```
Agent proposes dangerous action
    ↓
Authority decides: "needs constitutional review"
    ↓
??? → How do we invoke the "constitutional court"?
```

Options:
1. Special protocol for constitutional review
2. Constitutional court as built-in Authority type
3. Constitutional review as effect (external call)

### Rationale

**"Manifestofy everything" — constitutional review is just another Manifesto world.**

The constitutional court is itself an agent (or group of agents). Asking it to review is:

```typescript
// Just an effect
const patches = await executeEffect('constitutional:review', {
  proposal: proposal,
  rules: constitutionalRules
});

// The "court" might be another Manifesto world
// Where judges are agents that compute verdicts
// And their verdict is returned as patches
```

| Approach | Complexity | Flexibility | Consistency |
|----------|------------|-------------|-------------|
| Special protocol | High | Low | ❌ Two systems |
| Built-in court | Medium | Low | ⚠️ Hardcoded |
| **Effect** | Low | High | ✅ Same pattern |

**Recursive Manifesto**: A Manifesto world can call another Manifesto world via effect.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Built-in constitutional court | Inflexible, hardcoded judges |
| Special protocol | Inconsistent with effect-based model |
| No constitutional review | Can't handle complex multi-judge decisions |

### Consequences

- Constitutional court is configured, not hardcoded
- Court can be single AI, multi-AI tribunal, or even human committee
- Same effect pattern as any other external call
- Manifesto worlds can compose recursively

---

## FDR-W008: World Immutability

### Decision

**Worlds are immutable.** Any change creates a new World; existing Worlds never change.

### Context

If Worlds could be mutated:
- What's the "current" state of World X?
- How do we audit what World X looked like yesterday?
- How do we reproduce World X?

### Rationale

**Immutability enables time travel, audit, and reproducibility.**

```
World-1 (genesis)
    │
    │ Proposal-A approved
    ↓
World-2
    │
    │ Proposal-B approved
    ↓
World-3
```

Each World is a frozen point in time. To "change" World-2, you create World-4 that branches from World-2 with different changes.

| Property | Mutable Worlds | Immutable Worlds |
|----------|---------------|------------------|
| Audit | ❌ "What was the state?" | ✅ "Look at World-N" |
| Reproducibility | ❌ State may have changed | ✅ Replay Proposals |
| Branching | ❌ Complex merge logic | ✅ Natural (git-like) |
| Debugging | ❌ "It changed somehow" | ✅ "World-N was created by Proposal-M" |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Mutable Worlds | No audit, no reproducibility |
| Versioned Worlds (same ID, versions) | Confusing identity, merge issues |

### Consequences

- World = (schemaHash, snapshotHash), immutable
- Changes create new Worlds with new IDs
- Lineage is append-only DAG
- Full history preserved forever

---

## FDR-W009: SnapshotHash Excludes Non-Deterministic Fields

### Decision

`snapshotHash` **MUST** be computed from a canonical form that **excludes non-deterministic fields** like `meta.timestamp` and `meta.version`.

### Context

Snapshot in Core/Host includes:

```typescript
type Snapshot = {
  data: TData;                    // Domain state
  computed: Record<...>;          // Derived values
  system: { status, lastError, ... };
  input: unknown;
  meta: {
    version: number;    // Incremented by Core
    timestamp: number;  // Set by Core from HostContext
    randomSeed: string; // Set by Core from HostContext
    schemaHash: string;
  }
};
```

Problem: `meta.timestamp` is **wall-clock time**. If we replay the same Proposals:

```
Original:  timestamp = 1704067200000
Replay:    timestamp = 1704153600000 (different!)
```

If `snapshotHash = hash(entire snapshot)`, then **replay produces different hash**, breaking WorldId stability.

### Rationale

**World identity should be semantic, not temporal.**

Two Snapshots are "the same World" if they have:
- Same domain state (`data`)
- Same system state (`system.status`, `system.lastError`, etc.)

They are NOT different Worlds just because replay happened at a different time.

```typescript
// Hash only world-relevant content
type SnapshotHashInput = {
  data: Snapshot['data'],
  system: {
    status: Snapshot['system']['status'],
    lastError: Snapshot['system']['lastError'],
    errors: Snapshot['system']['errors'],
    pendingRequirements: Snapshot['system']['pendingRequirements']
  }
};

snapshotHash = hash(canonicalize(snapshotHashInput))
```

| Field | Included? | Reason |
|-------|-----------|--------|
| `data` | ✅ | Core semantic state |
| `system.status` | ✅ | Terminal state matters |
| `system.lastError` | ✅ | Error identity matters |
| `meta.timestamp` | ❌ | Non-deterministic |
| `meta.version` | ❌ | Local counter, not semantic |
| `computed` | ❌ | Derived, can be recomputed |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Hash entire Snapshot | Breaks reproducibility |
| Normalize timestamp to 0 | Loses temporal information entirely |
| Separate "identity hash" vs "full hash" | Complex, two concepts to manage |

### Consequences

- Same Proposals → Same WorldId (deterministic)
- Replay verification is possible
- Temporal metadata preserved in World record, not in hash
- `computed` values not part of identity (can be recomputed)

---

## FDR-W010: Fork-Only DAG (No Merge in v1.0)

### Decision

In v1.0, World Lineage is **fork-only**: every non-genesis World has **exactly one parent**.

Merge operations are NOT supported.

### Context

The spec originally said "at least one parent" (LI-3), implying merge (multiple parents) was possible. But:

- `getPath(genesis → target)` assumed unique path
- Reproduction algorithm assumed linear ancestry
- No merge semantics were defined

### Rationale

**Fork-only is simpler and sufficient for v1.0.**

| Model | Parents | Complexity | Use Case |
|-------|---------|------------|----------|
| Linear | Exactly 1 | Low | Single timeline |
| **Fork-only** | Exactly 1 | Medium | Branching, parallel exploration |
| DAG with merge | 1+ | High | Collaborative editing, git-like |

Fork-only enables:
- Simple reproduction (unique path from genesis)
- Clear "which version am I on?"
- No merge conflict resolution needed

```
World-1 (genesis)
    ├──→ World-2 (branch A)
    │        └──→ World-4
    └──→ World-3 (branch B)
              └──→ World-5

// Each World has exactly one parent
// Paths are unique
// No merge arrows between branches
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Linear only | No branching, too restrictive |
| Full DAG with merge | Complex merge semantics, v1.0 scope creep |
| "At least one parent" ambiguity | Implies merge without defining it |

### Consequences

- LI-3: "exactly one parent" (not "at least one")
- `getPath()` always returns unique path
- Reproduction is deterministic
- Future v1.1+ MAY add merge semantics

---

## FDR-W011: Rejected Proposals Do Not Create Worlds

### Decision

**Rejected Proposals do NOT create new Worlds.** Only executed Proposals (success or failure) create Worlds.

### Context

When Authority rejects a Proposal:

```
Agent: "Delete all user data"
Authority: "Rejected - policy violation"
??? → Is a World created?
```

### Rationale

**World = executed reality. Rejection = nothing happened.**

| Proposal Outcome | Host Execution? | World Created? |
|------------------|-----------------|----------------|
| Approved → Completed | ✅ | ✅ |
| Approved → Failed | ✅ | ✅ (with error state) |
| Rejected | ❌ | ❌ |
| Pending | ❌ | ❌ |

A rejected Proposal is **counterfactual**—it describes what someone wanted to do, not what happened. Creating a World for it would:
- Pollute lineage with "nothing happened" states
- Confuse "World" concept (is it reality or proposal?)
- Waste storage on identical Snapshots

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Create "rejected World" | Semantic confusion, storage waste |
| Create "pending World" | Even worse—deliberation is not reality |
| No record of rejection | Loses audit trail (but we have DecisionRecord!) |

### Consequences

- World creation requires Host execution
- Rejected Proposals have DecisionRecord but no resultWorld
- Lineage only contains "things that happened"
- Audit trail for rejections is in DecisionRecords

---

## FDR-W012: Execution Failure Creates World

### Decision

When Host execution **fails** (effect error, validation error, etc.), a new World is **still created** with the error state recorded.

### Context

```
Proposal approved
    ↓
Host executes
    ↓
Effect fails (e.g., payment declined)
    ↓
??? → Do we create a World or not?
```

### Rationale

**"Failure is still an outcome."**

Failure represents a real state transition:
- System attempted the action
- External world responded (negatively)
- State may have partially changed
- Error information is now known

```typescript
// Failed execution produces real Snapshot
snapshot.system = {
  status: 'error',
  lastError: {
    code: 'PAYMENT_DECLINED',
    message: 'Card was declined',
    timestamp: 1704067200000
  }
};

// This becomes a World
const failedWorld = createWorld(snapshot);  // ✅
```

If we don't create a World on failure:
- No record of what happened
- No audit trail for the failure
- Can't branch from failed state to retry differently

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| No World on failure | Lost history, no audit |
| Retry automatically | Policy decision, not protocol |
| Rollback to base World | Still need to record failure somewhere |

### Consequences

- Every completed execution creates a World (`completed` or `failed`)
- Failure state is visible in World's Snapshot
- Actors can query World to see what happened
- Compensation/retry is a new Intent on the failed World
- **INV-I2: Host execution (success or failure) always creates a World**

---

## FDR-W013: World as Orchestration Container

### Decision

**World** (also called Orchestrator) is the top-level container that manages:
- Actor Registry (Actor-Authority bindings)
- Proposal Queue (pending proposals)
- World Lineage (DAG of worlds)
- Host (execution engine)

### Context

Where do all these pieces live? Who coordinates them?

### Rationale

**Single coordination point prevents inconsistency.**

```
┌─────────────────────────────────────────────────────────────┐
│                         World                                │
│                                                              │
│  ┌───────────────────┐  ┌───────────────────┐              │
│  │  Actor Registry   │  │  Proposal Queue   │              │
│  │  (bindings)       │  │  (pending work)   │              │
│  └───────────────────┘  └───────────────────┘              │
│                                                              │
│  ┌───────────────────┐  ┌───────────────────┐              │
│  │  World Lineage    │  │  Host             │              │
│  │  (DAG)            │  │  (execution)      │              │
│  └───────────────────┘  └───────────────────┘              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

World coordinates the flow:
1. Actor submits Proposal → World routes to Authority
2. Authority decides → World updates Proposal status
3. Approved → World hands to Host
4. Host completes → World creates new World, adds edge

| Component | Responsibility | State |
|-----------|---------------|-------|
| Actor Registry | Actor-Authority mappings | Bindings |
| Proposal Queue | Async approval tracking | Proposals |
| World Lineage | History and branching | Worlds, Edges |
| Host | Execution | (transient Snapshot) |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Distributed coordination | Complex, consistency issues |
| Host manages everything | Mixes execution with governance |
| No central coordinator | Who routes Proposals? |

### Consequences

- Single source of truth for governance state
- Clear entry point for Actor interactions
- Host remains pure execution engine
- Lineage managed consistently

---

## FDR-W014: State Persistence as Serializable Records

### Decision

World Protocol **MUST** produce **serializable records** for all governance state. Persistence mechanism is implementation choice, but serializability is required.

### Context

World Protocol manages:
- Proposals (with status)
- DecisionRecords
- Worlds
- WorldEdges
- Actor-Authority bindings

Where does this state live? How is it persisted?

### Rationale

**Serializable records enable portability, audit, and replay.**

| Property | Requires Serializability |
|----------|-------------------------|
| **Persistence** | ✅ Must survive restarts |
| **Audit** | ✅ Must be inspectable |
| **Replay** | ✅ Must be reloadable |
| **Portability** | ✅ Must transfer between systems |

```typescript
interface WorldProtocolState {
  readonly proposals: Map<ProposalId, Proposal>;
  readonly decisions: Map<DecisionId, DecisionRecord>;
  readonly worlds: Map<WorldId, World>;
  readonly edges: Map<EdgeId, WorldEdge>;
  readonly actors: Map<ActorId, ActorRef>;
  readonly bindings: Map<ActorId, ActorAuthorityBinding>;
  readonly genesis: WorldId;
}

// All of this MUST be JSON-serializable
const serialized = JSON.stringify(state, replacer);
const restored = JSON.parse(serialized, reviver);
```

**Persistence options (implementation choice):**

| Option | Description |
|--------|-------------|
| A | Store in `snapshot.system.governance` |
| B | Append-only content-addressable store (CAS) |
| C | External database |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| In-memory only | Lost on restart |
| Hardcoded persistence format | Inflexible |
| Non-serializable state | Can't audit, can't replay |

### Consequences

- All governance state survives system restart
- Audit tools can inspect state
- Replay can reload and verify
- Implementation freedom on storage mechanism

---

## FDR-W015: Execution Trace Reference for Auditability

### Decision

World **MAY** include `executionTraceRef` pointing to the detailed trace of how it was computed.

### Context

Core produces traces (computation history). Host runs the loop. When World is created:
- How was it computed?
- What expressions were evaluated?
- What effects were executed?

Without trace reference, "auditability" is just a claim, not data.

### Rationale

**Trace makes auditability concrete.**

```typescript
type World = {
  worldId: WorldId;
  schemaHash: string;
  snapshotHash: string;
  createdAt: number;
  createdBy: ProposalId | null;
  executionTraceRef?: ArtifactRef;  // NEW: Link to trace
};

type ArtifactRef = {
  uri: string;    // Where to find it
  hash: string;   // Content hash for verification
};
```

| With Trace | Without Trace |
|------------|---------------|
| "World-3 was computed by evaluating expressions X, Y, Z" | "World-3 exists, trust us" |
| Can verify computation | Must re-run to verify |
| Debug "why this value?" | Guess |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Embed trace in World | Too large, bloats World record |
| Embed trace in Snapshot | Same issue |
| No trace at all | "Auditability" is empty claim |

### Consequences

- World record stays small (just reference)
- Trace stored separately (CAS or similar)
- Verification: fetch trace, re-run, compare
- Optional for implementations that don't need deep audit

---

## FDR-W016: Host Trust Model (v1.0 Scope)

### Decision

In v1.0, **World Protocol trusts Host** to execute Intents faithfully. Execution scope enforcement is NOT in protocol scope.

### Context

When Authority approves Intent "addTodo":
- Can the execution modify `user.settings`?
- Can it delete other todos?
- What if effect handler goes rogue?

### Rationale

**v1.0 prioritizes core governance over security enforcement.**

Security enforcement requires:
- Define allowed write paths per Intent
- Intercept all patches in Host
- Validate against allowed paths
- Handle violations

This is significant complexity. For v1.0:
- Core governance model is priority
- Host is trusted (same-process, same-team assumption)
- Scope enforcement is future work

**Extension point provided:**

```typescript
type Intent = {
  type: string;
  input?: unknown;
  intentId: string;
  scope?: IntentScope;  // v1.1 extension point
};

type IntentScope = {
  allowedPaths?: string[];  // Path patterns allowed to write
};
```

Field exists but not enforced in v1.0.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Full scope enforcement in v1.0 | Scope creep, delays core protocol |
| No extension point | Makes v1.1 harder |
| Pretend it's enforced | Dishonest, security theater |

### Consequences

- v1.0: Host is trusted, no scope enforcement
- Explicit non-goal in spec
- `Intent.scope` exists for future use
- Security-sensitive deployments should add application-level checks

---

## FDR-W017: Multi-Proposal Branching from Same Base

### Decision

Multiple Proposals **MAY** be approved from the same `baseWorld`. Each creates its own branch.

### Context

What happens when:

```
Agent A: proposes action-1 on world-1
Agent B: proposes action-2 on world-1 (same base!)
Both approved
```

### Rationale

**Branching is natural in exploration scenarios.**

| Scenario | Behavior |
|----------|----------|
| Sequential | A approved → World-2 created → B's base is now stale |
| Parallel branches | Both approved → World-2 (from A), World-3 (from B) |

For exploration, experimentation, and parallel workflows, **parallel branches are valuable**:

```
world-1 (base)
    ├──→ world-2 (Agent A's action-1)
    └──→ world-3 (Agent B's action-2)
```

This is git-like branching. Each branch is valid. User/system decides which branch to continue.

**Rules:**
- Different Proposals MAY have same baseWorld
- Each approval creates separate child World
- Host execution serialized per Proposal (not global)
- Different Proposals MAY execute concurrently

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Only one Proposal per baseWorld | Too restrictive, blocks parallel exploration |
| Auto-rebase on stale base | Complex, may not be desired |
| Merge concurrent Proposals | Merge semantics not in v1.0 |

### Consequences

- Parallel branches enabled
- No "stale base" rejection
- User manages branch selection
- Host serializes per-Proposal, not globally

---

## Summary Table

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| W001 | Intent-level governance | Intent is human meaning |
| W002 | Proposal = Actor + Intent | Accountability envelope |
| W003 | Actor as first-class citizen | Protocol uniformity |
| W004 | Actor-Authority 1:1 binding | Trust is per-actor |
| W005 | Pending is not decision | Deliberation ≠ Decision |
| W006 | Host executes approved only | Separation of concerns |
| W007 | Constitutional review as effect | Manifestofy everything |
| W008 | World immutability | Time travel and audit |
| W009 | SnapshotHash excludes non-deterministic | Reproducibility |
| W010 | Fork-only DAG (v1.0) | Simplicity, unique paths |
| W011 | Rejected → no World | Rejection is counterfactual |
| W012 | Failure → World created | Failure is an outcome |
| W013 | World as orchestration container | Single coordination |
| W014 | Serializable persistence | Audit and replay |
| W015 | Execution trace reference | Concrete auditability |
| W016 | Host trust model (v1.0) | Scope enforcement deferred |
| W017 | Multi-proposal branching | Parallel exploration |

---

## Cross-Reference: Related FDRs

### From Schema Spec FDR

| Schema FDR | Relevance to World Protocol |
|------------|---------------------------|
| FDR-001 (Core as Calculator) | Core computes, World governs |
| FDR-002 (Snapshot as Only Medium) | World identity from Snapshot |
| FDR-004 (Effects as Declarations) | Constitutional review is effect |
| FDR-010 (Canonical Form & Hashing) | SnapshotHash algorithm basis |

### From Host Contract FDR

| Host FDR | Relevance to World Protocol |
|----------|---------------------------|
| FDR-H001 (Core-Host Boundary) | + World Protocol layer above |
| FDR-H003 (No Pause/Resume) | HITL waiting is in World Protocol, not Host |
| FDR-H006 (Intent Identity) | Proposal wraps Intent with Actor |
| FDR-H009 (Core-Owned Versioning) | Why version excluded from snapshotHash |

---

*End of World Protocol FDR (Revised)*
