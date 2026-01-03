# Manifesto World Protocol Specification v1.0

> **Status:** Release
> **Scope:** Normative
> **Authors:** Manifesto Team
> **Applies to:** All Manifesto World Implementations
> **License:** MIT

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Definitions](#3-definitions)
4. [World](#4-world)
5. [Actor](#5-actor)
6. [Proposal](#6-proposal)
7. [Authority](#7-authority)
8. [Actor-Authority Binding](#8-actor-authority-binding)
9. [Decision Record](#9-decision-record)
10. [Proposal Lifecycle](#10-proposal-lifecycle)
11. [Host Integration](#11-host-integration)
12. [World Lineage](#12-world-lineage)
13. [State Persistence](#13-state-persistence)
14. [Invariants](#14-invariants)
15. [Explicit Non-Goals](#15-explicit-non-goals)
16. [Compliance Statement](#16-compliance-statement)

---

## 1. Purpose

This document defines the **Manifesto World Protocol**.

The World Protocol governs:
- **Who** may propose changes to a world (Actor)
- **How** proposals are judged (Authority)
- **What** record is kept of decisions (Decision Record)
- **How** worlds form a reproducible history (Lineage)

This protocol operates **above** Manifesto Core and Host:

| Layer | Responsibility |
|-------|---------------|
| **Core** | Computes semantic truth |
| **Host** | Executes effects, applies patches |
| **World Protocol** | Governs legitimacy, authority, and lineage |

This document is **normative**.

---

## 2. Scope

### 2.1 What IS Governed

World Protocol governs **Intent-level authorization**:

- Intent submission (who proposes what)
- Intent approval (who decides)
- Intent completion (what World is created)

### 2.2 What is NOT Governed

World Protocol does **NOT** govern:

- Individual patches during Host execution
- Effect results (implicitly authorized by Intent approval)
- System state transitions during computation

### 2.3 Governance Boundary

```
Actor submits Intent
         ↓
┌─────────────────────────┐
│  WORLD PROTOCOL SCOPE   │
│                         │
│  Proposal → Authority   │
│      ↓                  │
│  DecisionRecord         │
│                         │
└───────────┬─────────────┘
            │ approved Intent
            ↓
┌─────────────────────────┐
│  HOST SCOPE             │
│                         │
│  compute → effect →     │
│  apply → compute → ...  │
│                         │
└───────────┬─────────────┘
            │ completed Snapshot
            ↓
┌─────────────────────────┐
│  WORLD PROTOCOL SCOPE   │
│                         │
│  New World created      │
│  Lineage edge added     │
│                         │
└─────────────────────────┘
```

---

## 3. Definitions

### 3.1 World

An immutable snapshot of reality, identified by its content hash.

### 3.2 Actor

An entity capable of proposing changes. All actors—human, agent, system—are first-class citizens.

### 3.3 Intent

A command requesting a domain action. Intent types are defined in **Intent & Projection Spec v1.0**.

### 3.4 Proposal

An accountability envelope wrapping an IntentInstance with its submission context.

### 3.5 Authority

An entity that judges Proposals and issues decisions.

### 3.6 Decision Record

An immutable audit log of Authority judgment. Created **only for terminal decisions**.

### 3.7 Lineage

The directed acyclic graph (DAG) of World ancestry. In v1.0, restricted to **fork-only** (branching without merge).

### 3.8 Binding

A mapping where **each Actor has exactly one Authority**. Multiple Actors MAY share the same Authority.

---

## 4. World

### 4.1 World Identity

A **World** is defined as:

```typescript
type World = {
  readonly worldId: WorldId;
  readonly schemaHash: string;
  readonly snapshotHash: string;
  readonly createdAt: number;
  readonly createdBy: ProposalId | null;  // null for genesis only
  readonly executionTraceRef?: ArtifactRef;  // Optional trace reference
};

type WorldId = string;  // deterministic hash of (schemaHash, snapshotHash)

type ArtifactRef = {
  readonly uri: string;
  readonly hash: string;
};
```

### 4.2 WorldId Computation

WorldId **MUST** be computed deterministically:

```typescript
worldId = hash(schemaHash + ':' + snapshotHash)
```

Where `hash` is SHA-256 or equivalent cryptographic hash.

### 4.3 SnapshotHash Computation (MUST)

To ensure reproducibility, `snapshotHash` **MUST** exclude non-deterministic fields:

```typescript
type SnapshotHashInput = {
  data: Snapshot['data'];
  system: Omit<Snapshot['system'], 'timestamp'>;  // Exclude timestamp
};

snapshotHash = hash(canonicalize(snapshotHashInput))
```

**Rules for snapshotHash:**

| Field | Included | Reason |
|-------|----------|--------|
| `snapshot.data` | ✅ MUST | Domain state |
| `snapshot.system.status` | ✅ MUST | Terminal status |
| `snapshot.system.lastError` | ✅ MUST | Error state |
| `snapshot.system.errors` | ✅ MUST | Error history |
| `snapshot.system.pendingRequirements` | ✅ MUST | Should be empty at World creation |
| `snapshot.meta.version` | ❌ MUST NOT | Not world-relevant |
| `snapshot.meta.timestamp` | ❌ MUST NOT | Non-deterministic |
| `snapshot.meta.schemaHash` | ❌ MUST NOT | Already in WorldId |
| `snapshot.computed` | ❌ SHOULD NOT | Derived, can be recomputed |
| `snapshot.input` | ❌ SHOULD NOT | Transient |

**Rationale:** This ensures that replaying the same Proposals produces identical WorldIds.

### 4.4 World Immutability (MUST)

- Worlds **MUST NOT** be mutated after creation.
- Any state change **MUST** create a new World.
- World fields **MUST** be readonly.

### 4.5 Genesis World

Every World lineage has exactly one genesis World:

```typescript
const genesis: World = {
  worldId: computeWorldId(schemaHash, snapshotHash),
  schemaHash: schema.hash,
  snapshotHash: computeSnapshotHash(initialSnapshot),
  createdAt: timestamp,
  createdBy: null  // Genesis has no parent Proposal
};
```

### 4.6 World Creation Rules (MUST)

| Condition | World Created? |
|-----------|---------------|
| Proposal approved, Host completes successfully | ✅ Yes (`completed`) |
| Proposal approved, Host execution fails | ✅ Yes (`failed`) |
| Proposal rejected by Authority | ❌ No |
| Proposal pending (awaiting decision) | ❌ No |

**New World is created ONLY when a Proposal reaches Host execution and Host returns a terminal Snapshot.**

---

## 5. Actor

### 5.1 Actor Reference

Actor types are defined in **Intent & Projection Spec v1.0**:

```typescript
type ActorKind = 'human' | 'agent' | 'system';

type ActorRef = {
  readonly actorId: string;
  readonly kind: ActorKind;
  readonly name?: string;
  readonly meta?: Record<string, unknown>;
};
```

### 5.2 Actor Kinds

| Kind | Description | Examples |
|------|-------------|----------|
| `human` | A human user | UI user, admin, reviewer |
| `agent` | An AI/LLM agent | GPT-4 agent, Claude agent |
| `system` | An automated system | Scheduler, migration script |

### 5.3 Actor as First-Class Citizen (MUST)

- All Actor kinds **MUST** follow the same protocol.
- No Actor kind **MAY** bypass Proposal submission.
- Policy differences are expressed in Authority binding, not protocol.

### 5.4 Actor Capabilities

Actors **MAY**:
- Submit Proposals
- Be delegated to as HITL Authority
- Be part of a Constitutional tribunal

Actors **MUST NOT**:
- Directly mutate Worlds
- Bypass Authority judgment
- Modify other Actors' Proposals

---

## 6. Proposal

### 6.1 Intent Types (Reference)

Intent types are defined in **Intent & Projection Spec v1.0**:

```typescript
// From Intent & Projection Spec
type IntentBody = {
  readonly type: string;
  readonly input?: unknown;
  readonly scopeProposal?: IntentScope;
};

type IntentMeta = {
  readonly origin: IntentOrigin;
};

type IntentInstance = {
  readonly body: IntentBody;
  readonly intentId: string;
  readonly intentKey: string;
  readonly meta: IntentMeta;
};

type IntentScope = {
  readonly allowedPaths?: string[];
  readonly note?: string;
};

type IntentOrigin = {
  readonly projectionId: string;
  readonly source: { kind: SourceKind; eventId: string };
  readonly actor: ActorRef;
  readonly note?: string;
};

type SourceKind = 'ui' | 'api' | 'agent' | 'system';
```

### 6.2 Proposal Structure

```typescript
type Proposal = {
  readonly proposalId: ProposalId;
  readonly actor: ActorRef;
  readonly intent: IntentInstance;  // From Intent & Projection Spec
  readonly baseWorld: WorldId;
  readonly trace?: ProposalTrace;
  readonly submittedAt: number;
  
  // Mutable status fields
  status: ProposalStatus;
  approvedScope?: IntentScope | null;  // Set by Authority
  decisionId?: DecisionId;
  resultWorld?: WorldId;
  decidedAt?: number;
  completedAt?: number;
};

type ProposalId = string;  // UUID v4 or equivalent

type ProposalTrace = {
  readonly summary: string;
  readonly reasoning?: string;
  readonly context?: Record<string, unknown>;
};
```

**Note:** `scopeProposal` is NOT duplicated in Proposal. It is read from `intent.body.scopeProposal`.

### 6.3 Proposal Semantics

A Proposal answers:
- **WHO**: `actor` — who is accountable
- **WHAT**: `intent` — what action is requested (IntentInstance)
- **WHERE**: `baseWorld` — which reality to change
- **WHEN**: `submittedAt` — when it was submitted
- **WHY**: `trace` — optional reasoning

### 6.4 Proposal Rules (MUST)

| Rule | Description |
|------|-------------|
| P-1 | Proposals **MUST** reference exactly one existing `baseWorld` |
| P-2 | Proposals **MUST** include valid `actor` reference |
| P-3 | Proposals **MUST** include valid `IntentInstance` with `intentId` and `intentKey` |
| P-4 | Proposal readonly fields **MUST NOT** be modified after submission |
| P-5 | `proposalId` **MUST** be unique within the World Protocol instance |
| P-6 | Proposals **MUST** be created by registered Actors only |
| P-7 | `intent.meta.origin.actor` **MUST** match `proposal.actor` |

### 6.5 Proposal Status

```typescript
type ProposalStatus =
  | 'submitted'   // Actor has submitted, routing to Authority
  | 'pending'     // Authority is deliberating (e.g., HITL waiting)
  | 'approved'    // Authority approved, waiting for Host execution
  | 'rejected'    // Authority rejected (terminal, no World created)
  | 'executing'   // Host is running the Intent
  | 'completed'   // Done, new World created (terminal)
  | 'failed';     // Execution failed, World created with error state (terminal)
```

### 6.6 Terminal vs Non-Terminal Status

| Status | Terminal? | World Created? | DecisionRecord? |
|--------|-----------|---------------|-----------------|
| `submitted` | ❌ | ❌ | ❌ |
| `pending` | ❌ | ❌ | ❌ |
| `approved` | ❌ | ❌ | ✅ |
| `rejected` | ✅ | ❌ | ✅ |
| `executing` | ❌ | ❌ | ✅ (already created) |
| `completed` | ✅ | ✅ | ✅ |
| `failed` | ✅ | ✅ | ✅ |

---

## 7. Authority

### 7.1 Authority Reference

```typescript
type AuthorityRef = {
  readonly authorityId: string;
  readonly kind: AuthorityKind;
  readonly name?: string;
};

type AuthorityKind = 'auto' | 'human' | 'policy' | 'tribunal';
```

### 7.2 Authority Kinds

| Kind | Description | Decision Maker |
|------|-------------|----------------|
| `auto` | Automatic approval | System (no deliberation) |
| `human` | Human-in-the-loop | Specific human Actor |
| `policy` | Policy-based rules | Deterministic rules |
| `tribunal` | Multi-agent review | Group of Actors |

### 7.3 Authority Responsibilities (MUST)

Authority **MUST**:
- Evaluate every routed Proposal
- Return a decision: `approved`, `rejected`, or `pending`
- Decide `approvedScope` when approving (may be `null`, same as proposed, or modified)
- Produce a DecisionRecord **only for terminal decisions** (`approved` or `rejected`)

Authority **MUST NOT**:
- Execute effects
- Apply patches directly
- Modify Snapshots
- Skip Proposals
- Create DecisionRecord for `pending` state

### 7.4 Authority Response

```typescript
type AuthorityResponse =
  | { kind: 'approved'; approvedScope?: IntentScope | null }
  | { kind: 'rejected'; reason: string }
  | { kind: 'pending'; waitingFor: WaitingFor };

type WaitingFor =
  | { kind: 'human'; delegate: ActorRef }
  | { kind: 'tribunal'; members: ActorRef[] }
  | { kind: 'timeout'; until: number };
```

**Scope Approval:**
- `approvedScope: undefined` — use `scopeProposal` as-is
- `approvedScope: null` — no scope restriction
- `approvedScope: { allowedPaths: [...] }` — explicit approved scope

**Important:** `pending` is a **deliberation state**, not a decision. Authority MAY return `pending` multiple times until a terminal decision is reached.

---

## 8. Actor-Authority Binding

### 8.1 Binding Structure

```typescript
type ActorAuthorityBinding = {
  readonly actor: ActorRef;
  readonly authority: AuthorityRef;
  readonly policy: AuthorityPolicy;
};

type AuthorityPolicy =
  | AutoApprovePolicy
  | HITLPolicy
  | PolicyRulesPolicy
  | TribunalPolicy;
```

### 8.2 Binding Semantics

**Each Actor has exactly one Binding.** Multiple Actors MAY share the same Authority.

```typescript
// Valid: Multiple actors share same authority
const binding1 = { actor: alice, authority: autoApprove, policy: {...} };
const binding2 = { actor: bob, authority: autoApprove, policy: {...} };

// Invalid: Actor has multiple bindings
const binding1 = { actor: alice, authority: autoApprove, policy: {...} };
const binding2 = { actor: alice, authority: humanReview, policy: {...} };  // ERROR
```

### 8.3 Policy Types

#### 8.3.1 Auto-Approve Policy

```typescript
type AutoApprovePolicy = {
  readonly mode: 'auto_approve';
  readonly reason?: string;
};
```

Used when Actor is fully trusted (typically for human actors).

#### 8.3.2 HITL Policy

```typescript
type HITLPolicy = {
  readonly mode: 'hitl';
  readonly delegate: ActorRef;  // Which human to ask
  readonly timeout?: number;    // Optional timeout in ms
  readonly onTimeout?: 'approve' | 'reject';
};
```

Used when Actor needs human supervision.

#### 8.3.3 Policy Rules Policy

```typescript
type PolicyRulesPolicy = {
  readonly mode: 'policy_rules';
  readonly rules: PolicyRule[];
  readonly defaultDecision: 'approve' | 'reject' | 'escalate';
  readonly escalateTo?: AuthorityRef;
};

type PolicyRule = {
  readonly condition: PolicyCondition;
  readonly decision: 'approve' | 'reject' | 'escalate';
  readonly reason?: string;
};

type PolicyCondition =
  | { kind: 'intent_type'; types: string[] }
  | { kind: 'scope_pattern'; pattern: string }
  | { kind: 'custom'; evaluator: string };
```

Used for deterministic rule-based decisions.

#### 8.3.4 Tribunal Policy

```typescript
type TribunalPolicy = {
  readonly mode: 'tribunal';
  readonly members: ActorRef[];
  readonly quorum: QuorumRule;
  readonly timeout?: number;
  readonly onTimeout?: 'approve' | 'reject';
};

type QuorumRule =
  | { kind: 'unanimous' }
  | { kind: 'majority' }
  | { kind: 'threshold'; count: number };
```

Used for constitutional review by multiple agents.

### 8.4 Binding Rules (MUST)

| Rule | Description |
|------|-------------|
| B-1 | Every registered Actor **MUST** have exactly one Binding |
| B-2 | Bindings **MUST** be established before Actor can submit Proposals |
| B-3 | Binding changes **MUST** only affect future Proposals |
| B-4 | Proposals from unbound Actors **MUST** be rejected at submission |
| B-5 | Multiple Actors **MAY** share the same Authority |

### 8.5 Default Bindings (RECOMMENDED)

```typescript
const defaultHumanBinding: AuthorityPolicy = {
  mode: 'auto_approve',
  reason: 'Human actors are self-responsible'
};

const defaultAgentBinding: AuthorityPolicy = {
  mode: 'hitl',
  delegate: { actorId: 'owner', kind: 'human' },
  timeout: 3600000,  // 1 hour
  onTimeout: 'reject'
};

const defaultSystemBinding: AuthorityPolicy = {
  mode: 'policy_rules',
  rules: [],
  defaultDecision: 'approve'
};
```

---

## 9. Decision Record

### 9.1 Decision Record Structure

```typescript
type DecisionRecord = {
  readonly decisionId: DecisionId;
  readonly proposalId: ProposalId;
  readonly authority: AuthorityRef;
  readonly decision: FinalDecision;
  readonly approvedScope?: IntentScope | null;  // Set when approved
  readonly reasoning?: string;
  readonly decidedAt: number;
};

type DecisionId = string;

type FinalDecision =
  | { kind: 'approved' }
  | { kind: 'rejected'; reason: string }
  | { kind: 'timeout'; action: 'approved' | 'rejected' };
```

### 9.2 Scope in DecisionRecord

When a Proposal is approved, `approvedScope` **MUST** be recorded:

| Scenario | approvedScope Value |
|----------|---------------------|
| Approve with proposed scope | Copy of `intent.body.scopeProposal` |
| Approve with modified scope | Modified `IntentScope` |
| Approve with no restriction | `null` |
| Rejected | Not applicable (no approvedScope) |

### 9.3 Decision Record Rules (MUST)

| Rule | Description |
|------|-------------|
| D-1 | DecisionRecord **MUST** be created only for terminal decisions |
| D-2 | DecisionRecords **MUST** be immutable after creation |
| D-3 | DecisionRecords **MUST** reference valid `proposalId` |
| D-4 | `decidedAt` **MUST** be ≥ Proposal's `submittedAt` |
| D-5 | Each Proposal **MUST** have at most one DecisionRecord |
| D-6 | `pending` state **MUST NOT** create a DecisionRecord |
| D-7 | `approvedScope` **MUST** be set when `decision.kind === 'approved'` |

### 9.4 When DecisionRecord is Created

```
submitted ──→ (routing) ──→ pending ──→ (deliberation) ──→ approved ──→ DecisionRecord created
                                   └──→ rejected ──→ DecisionRecord created
                       └──→ approved (instant) ──→ DecisionRecord created
                       └──→ rejected (instant) ──→ DecisionRecord created
```

### 9.5 Tribunal Decision Record

For tribunal decisions, additional metadata is recorded:

```typescript
type TribunalDecisionRecord = DecisionRecord & {
  readonly votes: Vote[];
  readonly quorumMet: boolean;
};

type Vote = {
  readonly voter: ActorRef;
  readonly decision: 'approve' | 'reject' | 'abstain';
  readonly reasoning?: string;
  readonly votedAt: number;
};
```

---

## 10. Proposal Lifecycle

### 10.1 State Machine

```
                                ┌─────────────────────────────────────────────┐
                                │                                             │
                                ▼                                             │
┌───────────┐   ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌───────────┐   │
│ submitted │──▶│ pending │──▶│ approved │──▶│ executing │──▶│ completed │   │
└─────┬─────┘   └────┬────┘   └──────────┘   └─────┬─────┘   └───────────┘   │
      │              │                             │                         │
      │              │                             ▼                         │
      │              │                       ┌──────────┐                    │
      │              │                       │  failed  │ ───────────────────┘
      │              │                       └──────────┘
      │              │
      ▼              ▼
┌────────────────────────┐
│       rejected         │
└────────────────────────┘
```

### 10.2 State Transitions

| From | To | Trigger | Owner | DecisionRecord? |
|------|----|---------|-------|-----------------|
| — | `submitted` | Actor submits Proposal | Actor | ❌ |
| `submitted` | `pending` | Authority needs deliberation | World Protocol | ❌ |
| `submitted` | `approved` | Authority instant-approves | Authority | ✅ Created |
| `submitted` | `rejected` | Authority instant-rejects | Authority | ✅ Created |
| `pending` | `approved` | Authority approves | Authority | ✅ Created |
| `pending` | `rejected` | Authority rejects | Authority | ✅ Created |
| `approved` | `executing` | Host begins execution | World Protocol | — |
| `executing` | `completed` | Host completes successfully | Host | — |
| `executing` | `failed` | Host execution fails | Host | — |

### 10.3 State Invariants (MUST)

| Invariant | Description |
|-----------|-------------|
| L-1 | `submitted` → only `pending`, `approved`, or `rejected` |
| L-2 | `pending` → only `approved` or `rejected` |
| L-3 | `approved` → only `executing` |
| L-4 | `executing` → only `completed` or `failed` |
| L-5 | `completed`, `rejected`, `failed` are terminal |
| L-6 | Transitions **MUST NOT** skip states |
| L-7 | Reverse transitions **MUST NOT** occur |
| L-8 | DecisionRecord **MUST** exist before `executing` |

---

## 11. Host Integration

### 11.1 Integration Point

World Protocol integrates with Host at a single point:

```typescript
interface WorldToHostInterface {
  dispatch(
    intent: Intent,
    options?: HostExecutionOptions
  ): Promise<HostExecutionResult>;
}

type HostExecutionOptions = {
  approvedScope?: IntentScope | null;
};

type HostExecutionResult = {
  status: 'complete' | 'halted' | 'error';
  snapshot: Snapshot;
  traces?: TraceGraph[];
  error?: ErrorInfo;
};

// TraceGraph is defined in Core SPEC
```

### 11.2 Integration Rules (MUST)

| Rule | Description |
|------|-------------|
| I-1 | World Protocol **MUST** only send approved Intents to Host |
| I-2 | World Protocol **MUST** wait for Host completion before creating World |
| I-3 | Host **MUST NOT** know about Proposals, Authority, or Actors |
| I-4 | Host **MUST NOT** pause for approval during execution |
| I-5 | Both success and failure from Host **MUST** create a World |
| I-6 | World Protocol **SHOULD** store TraceGraph[] if provided |
| I-7 | World Protocol **MUST** pass `approvedScope` to Host (for optional enforcement) |

### 11.3 Intent Identity During Execution

Per **Intent & Projection Spec v1.0**:
- `intentId` **MUST** remain stable throughout Host execution loop
- Host **MAY** call Core `compute()` multiple times (for effects)
- **No new Intent is created** during execution
- This is continuation of the same attempt, not re-issuance

### 11.4 Integration Flow

```typescript
async function executeApprovedProposal(
  world: WorldProtocol,
  proposal: Proposal
): Promise<World> {
  // 1. Verify proposal is approved
  if (proposal.status !== 'approved') {
    throw new Error('Proposal must be approved before execution');
  }
  
  // 2. Get base snapshot
  const baseWorld = world.getWorld(proposal.baseWorld);
  const baseSnapshot = world.getSnapshot(baseWorld.snapshotHash);
  
  // 3. Update status
  proposal.status = 'executing';
  
  // 4. Hand to Host with Intent and approvedScope
  const intent: Intent = {
    type: proposal.intent.body.type,
    input: proposal.intent.body.input,
    intentId: proposal.intent.intentId,
  };
  // Host MUST be initialized with baseSnapshot before dispatch.
  const result = await host.dispatch(intent, {
    approvedScope: proposal.approvedScope  // May be used for enforcement
  });
  
  // 5. Compute snapshotHash (excluding non-deterministic fields)
  const snapshotHash = computeSnapshotHash(result.snapshot);
  
  // 6. Create new World (success or failure)
  const newWorld: World = {
    worldId: computeWorldId(schema.hash, snapshotHash),
    schemaHash: schema.hash,
    snapshotHash: snapshotHash,
    createdAt: Date.now(),
    createdBy: proposal.proposalId,
    executionTraceRef: result.traces ? storeTrace(result.traces) : undefined
  };
  
  world.addWorld(newWorld);
  
  // 7. Add lineage edge
  world.addEdge({
    edgeId: generateEdgeId(),
    from: proposal.baseWorld,
    to: newWorld.worldId,
    proposalId: proposal.proposalId,
    decisionId: proposal.decisionId!,
    createdAt: Date.now()
  });
  
  // 8. Update proposal status
  proposal.status = result.status === 'complete' ? 'completed' : 'failed';
  proposal.resultWorld = newWorld.worldId;
  proposal.completedAt = Date.now();
  
  return newWorld;
}
```

---

## 12. World Lineage

### 12.1 Lineage Structure

```typescript
type WorldLineage = {
  readonly worlds: Map<WorldId, World>;
  readonly edges: Map<EdgeId, WorldEdge>;
  readonly genesis: WorldId;
};

type WorldEdge = {
  readonly edgeId: EdgeId;
  readonly from: WorldId;
  readonly to: WorldId;
  readonly proposalId: ProposalId;
  readonly decisionId: DecisionId;
  readonly createdAt: number;
};

type EdgeId = string;
```

### 12.2 v1.0 Lineage Model: Fork-Only

**In v1.0, Lineage is restricted to fork-only (branching without merge).**

This means:
- Every World (except genesis) has **exactly one parent**
- Multiple children are allowed (branching/forking)
- Merge operations are **NOT supported** in v1.0

```
World-1 (genesis)
    ├──→ World-2 (branch A)
    │        └──→ World-4
    │                 └──→ World-6
    └──→ World-3 (branch B)
              └──→ World-5
```

### 12.3 Lineage Invariants (MUST)

| Invariant | Description |
|-----------|-------------|
| LI-1 | Lineage **MUST** be a Directed Acyclic Graph (DAG) |
| LI-2 | Lineage **MUST** be append-only (no deletions or modifications) |
| LI-3 | Every non-genesis World **MUST** have **exactly one** parent (v1.0) |
| LI-4 | Every edge **MUST** reference valid Worlds |
| LI-5 | Every edge **MUST** reference valid Proposal and DecisionRecord |
| LI-6 | Cycles **MUST** be rejected at edge creation |
| LI-7 | Genesis World **MUST** have zero parents |

### 12.4 Multi-Proposal Branching

Multiple Proposals **MAY** be approved from the same `baseWorld`:

```typescript
// Both proposals reference same baseWorld
const proposal1 = { baseWorld: 'world-1', intent: createTodoIntent };
const proposal2 = { baseWorld: 'world-1', intent: updateSettingsIntent };

// Both approved, both create child Worlds (branches)
// world-1 → world-2 (from proposal1)
// world-1 → world-3 (from proposal2)
```

**Rules for concurrent proposals:**

| Rule | Description |
|------|-------------|
| MP-1 | Multiple Proposals **MAY** reference the same `baseWorld` |
| MP-2 | Each approved Proposal **MUST** create its own child World |
| MP-3 | Host execution **MUST** be serialized per Proposal |
| MP-4 | Different Proposals **MAY** execute concurrently |

### 12.5 Cycle Detection

Before adding an edge, World Protocol **MUST** verify no cycle is created:

```typescript
function wouldCreateCycle(
  lineage: WorldLineage,
  from: WorldId,
  to: WorldId
): boolean {
  // In fork-only model, cycle is impossible if:
  // - 'to' is a new World (not in lineage yet), OR
  // - 'from' is not reachable from 'to'
  
  if (!lineage.worlds.has(to)) return false;
  
  const visited = new Set<WorldId>();
  const queue = [to];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === from) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    
    for (const edge of lineage.edges.values()) {
      if (edge.from === current) {
        queue.push(edge.to);
      }
    }
  }
  
  return false;
}
```

### 12.6 Lineage Queries

```typescript
interface LineageQueries {
  // Get parent of a World (exactly one in v1.0, null for genesis)
  getParent(worldId: WorldId): WorldId | null;
  
  // Get direct children of a World
  getChildren(worldId: WorldId): WorldId[];
  
  // Get all ancestors (transitive)
  getAncestors(worldId: WorldId): Set<WorldId>;
  
  // Get all descendants (transitive)
  getDescendants(worldId: WorldId): Set<WorldId>;
  
  // Get path from ancestor to descendant (unique in fork-only model)
  getPath(from: WorldId, to: WorldId): WorldEdge[] | null;
  
  // Find common ancestor of two Worlds
  findCommonAncestor(a: WorldId, b: WorldId): WorldId | null;
}
```

### 12.7 Reproducibility Guarantee

Given:
- A genesis World
- The sequence of Proposals and DecisionRecords along a path

The final World **MUST** be reproducible:

```typescript
async function reproduceWorld(
  lineage: WorldLineage,
  targetWorldId: WorldId
): Promise<Snapshot> {
  const path = lineage.getPath(lineage.genesis, targetWorldId);
  if (!path) throw new Error('World not reachable from genesis');
  
  let snapshot = lineage.getSnapshot(lineage.genesis);
  
  for (const edge of path) {
    const proposal = getProposal(edge.proposalId);
    const decision = getDecisionRecord(edge.decisionId);
    const intent: Intent = {
      type: proposal.intent.body.type,
      input: proposal.intent.body.input,
      intentId: proposal.intent.intentId,
    };
    // Host MUST be initialized with current snapshot before dispatch.
    const result = await host.dispatch(intent, {
      approvedScope: decision.approvedScope
    });
    snapshot = result.snapshot;
    
    // Verify we got expected World
    const actualHash = computeSnapshotHash(snapshot);
    const expectedWorld = lineage.worlds.get(edge.to)!;
    if (actualHash !== expectedWorld.snapshotHash) {
      throw new Error('Reproduction mismatch: non-deterministic execution detected');
    }
  }
  
  return snapshot;
}
```

---

## 13. State Persistence

### 13.1 Persistence Requirement

World Protocol **MUST** produce **serializable records** for all governance state.

### 13.2 Serializable Records

The following records **MUST** be serializable and persistable:

```typescript
interface WorldProtocolState {
  // Core governance records
  readonly proposals: Map<ProposalId, Proposal>;
  readonly decisions: Map<DecisionId, DecisionRecord>;
  readonly worlds: Map<WorldId, World>;
  readonly edges: Map<EdgeId, WorldEdge>;
  
  // Registry
  readonly actors: Map<ActorId, ActorRef>;
  readonly bindings: Map<ActorId, ActorAuthorityBinding>;
  
  // Metadata
  readonly genesis: WorldId;
  readonly createdAt: number;
}
```

### 13.3 Persistence Options

Implementations **MAY** persist World Protocol state in:

| Option | Description |
|--------|-------------|
| **A. Snapshot namespace** | Store in `snapshot.system.governance` or similar |
| **B. Content-addressable store** | Append-only CAS referenced by hash |
| **C. Separate database** | External persistence layer |

### 13.4 Persistence Rules (MUST)

| Rule | Description |
|------|-------------|
| PS-1 | All records **MUST** be serializable to JSON or equivalent |
| PS-2 | All records **MUST** be referenceable by deterministic ID |
| PS-3 | DecisionRecords **MUST** be append-only (never modified) |
| PS-4 | WorldEdges **MUST** be append-only (never modified) |
| PS-5 | Proposals **MAY** have status updated, but history **SHOULD** be preserved |

### 13.5 Content-Addressable References

For auditability, implementations **SHOULD** use content-addressable references:

```typescript
type ArtifactRef = {
  readonly uri: string;    // Location identifier
  readonly hash: string;   // Content hash for verification
  readonly createdAt: number;
};

// Example: Reference to execution trace
const traceRef: ArtifactRef = {
  uri: 'cas://traces/abc123',
  hash: 'sha256:def456...',
  createdAt: 1704067200000
};
```

---

## 14. Invariants

The following invariants **MUST ALWAYS HOLD**:

### 14.1 Proposal Invariants

| ID | Invariant |
|----|-----------|
| INV-P1 | No Intent is executed without an approved Proposal |
| INV-P2 | Every Proposal has exactly one Actor |
| INV-P3 | Every Proposal with terminal decision has exactly one DecisionRecord |
| INV-P4 | Proposal status transitions are monotonic (never reverse) |
| INV-P5 | `pending` status does NOT create DecisionRecord |
| INV-P6 | `proposal.actor` MUST match `proposal.intent.meta.origin.actor` |

### 14.2 Authority Invariants

| ID | Invariant |
|----|-----------|
| INV-A1 | Every registered Actor has exactly one Authority binding |
| INV-A2 | Authority never executes effects or applies patches |
| INV-A3 | No re-judgment of a **terminal** decision for the same Proposal |
| INV-A4 | `pending` is deliberation state, not a decision |
| INV-A5 | `approvedScope` MUST be set in DecisionRecord when approved |

### 14.3 World Invariants

| ID | Invariant |
|----|-----------|
| INV-W1 | Worlds are immutable after creation |
| INV-W2 | WorldId is deterministic from (schemaHash, snapshotHash) |
| INV-W3 | Every non-genesis World has exactly one creating Proposal |
| INV-W4 | Lineage is acyclic |
| INV-W5 | Lineage is append-only |
| INV-W6 | Every non-genesis World has exactly one parent (v1.0) |
| INV-W7 | `snapshotHash` excludes non-deterministic fields |

### 14.4 Integration Invariants

| ID | Invariant |
|----|-----------|
| INV-I1 | Host only receives approved Intents (derived from IntentInstance) |
| INV-I2 | Host execution (success or failure) always creates a World |
| INV-I3 | Core semantics are never bypassed |
| INV-I4 | Rejected Proposals do NOT create Worlds |
| INV-I5 | `intentId` remains stable throughout Host execution loop |

### 14.5 Persistence Invariants

| ID | Invariant |
|----|-----------|
| INV-PS1 | All governance records are serializable |
| INV-PS2 | DecisionRecords are append-only |
| INV-PS3 | WorldEdges are append-only |

---

## 15. Explicit Non-Goals

This protocol does **NOT** define:

| Non-Goal | Reason |
|----------|--------|
| Effect execution semantics | Defined by Host Contract |
| Patch semantics | Defined by Schema Spec |
| Intent structure | Defined by Intent & Projection Spec |
| Projection logic | Defined by Intent & Projection Spec |
| **Execution scope enforcement** | Host is trusted in v1.0 (see 15.1) |
| User interface flows | Application concern |
| Agent planning logic | Application concern |
| LLM prompt strategies | Application concern |
| Security/authentication | Orthogonal concern |
| Persistence format | Infrastructure concern |
| Network protocol | Transport concern |

### 15.1 Host Trust Model (v1.0)

**In v1.0, World Protocol trusts Host to execute Intents faithfully.**

This means:
- Host **MAY** enforce `approvedScope` or ignore it
- No mandatory enforcement of scope at protocol level
- Security boundaries are application responsibility

**Extension point:** `approvedScope` is passed to Host for implementations that choose to enforce.

---

## 16. Compliance Statement

### 16.1 Compliance Requirements

An implementation claiming compliance with **Manifesto World Protocol v1.0** MUST:

1. Implement all types defined in this document
2. Use `IntentInstance` type from Intent & Projection Spec v1.0
3. Enforce all invariants (INV-*)
4. Follow Proposal lifecycle state machine
5. Maintain Actor-Authority bindings
6. Create DecisionRecords only for terminal decisions
7. Record `approvedScope` in DecisionRecord when approved
8. Preserve World immutability
9. Maintain acyclic, append-only, fork-only lineage
10. Compute `snapshotHash` excluding non-deterministic fields
11. Persist all governance state in serializable form

### 16.2 Compliance Verification

Compliance can be verified by:

1. **Type checking**: All structures match specification
2. **Invariant testing**: All INV-* hold under test scenarios
3. **State machine testing**: Proposal transitions are valid
4. **Lineage testing**: DAG properties preserved, fork-only enforced
5. **Reproducibility testing**: Worlds can be reproduced from lineage
6. **Hash stability testing**: Same input produces same `snapshotHash`
7. **Intent compatibility**: IntentInstance from Intent & Projection Spec is used correctly

### 16.3 Non-Compliance Consequences

Failure to comply with this Protocol:

- **Breaks accountability**: Cannot trace who intended what
- **Breaks reproducibility**: Cannot reconstruct history
- **Breaks auditability**: Cannot verify decisions
- **Invalidates Manifesto semantics**: System is not a valid World implementation

---

## Appendix A: Quick Reference

### A.1 Core Types

```typescript
// World
type World = { worldId, schemaHash, snapshotHash, createdAt, createdBy, executionTraceRef? }
type WorldId = string  // hash(schemaHash:snapshotHash)

// Actor (from Intent & Projection Spec)
type ActorRef = { actorId, kind, name?, meta? }
type ActorKind = 'human' | 'agent' | 'system'

// Intent (from Intent & Projection Spec)
type IntentBody = { type, input?, scopeProposal? }
type IntentMeta = { origin }
type IntentInstance = { body, intentId, intentKey, meta }
type IntentScope = { allowedPaths?, note? }

// Proposal
type Proposal = { proposalId, actor, intent: IntentInstance, baseWorld, status, approvedScope?, ... }
type ProposalStatus = 'submitted' | 'pending' | 'approved' | 'rejected' 
                    | 'executing' | 'completed' | 'failed'

// Authority
type AuthorityRef = { authorityId, kind, name? }
type AuthorityKind = 'auto' | 'human' | 'policy' | 'tribunal'

// Binding
type ActorAuthorityBinding = { actor, authority, policy }
type AuthorityPolicy = AutoApprovePolicy | HITLPolicy | PolicyRulesPolicy | TribunalPolicy

// Decision
type DecisionRecord = { decisionId, proposalId, authority, decision, approvedScope?, decidedAt }
type FinalDecision = { kind: 'approved' } | { kind: 'rejected', reason } | { kind: 'timeout', action }

// Lineage
type WorldEdge = { edgeId, from, to, proposalId, decisionId, createdAt }
```

### A.2 SnapshotHash Computation

```typescript
// Include
snapshot.data           // ✅
snapshot.system.*       // ✅ (except timestamp-like fields if any)

// Exclude  
snapshot.meta.version   // ❌
snapshot.meta.timestamp // ❌
snapshot.meta.schemaHash // ❌
snapshot.computed       // ❌
snapshot.input          // ❌
```

### A.3 State Machine

```
submitted → pending → approved → executing → completed
    │          │                      │
    │          │                      └──→ failed
    │          │
    └──────────┴──────────────────────────→ rejected

DecisionRecord created at: approved (transition) or rejected (transition)
World created at: completed or failed
```

### A.4 Key Invariants Summary

| Category | Key Rule |
|----------|----------|
| Proposal | `pending` ≠ decision, no DecisionRecord |
| Authority | Terminal decisions only, approvedScope required |
| World | Exactly one parent (v1.0), immutable |
| Lineage | Fork-only, append-only, acyclic |
| Hash | Exclude non-deterministic fields |
| Persistence | All records serializable |
| Intent | Uses IntentInstance from Intent & Projection Spec |

---

## Appendix B: Cross-Reference

### B.1 Related Specifications

| Spec | Relationship |
|------|--------------|
| **Intent & Projection Spec v1.0** | Defines Intent types used here |
| **Host Contract** | Executes approved Intents |
| **Schema Spec** | Defines domain types and validation |
| **Core Spec** | Computes semantic truth |

### B.2 Intent Type Alignment

This spec uses Intent types from **Intent & Projection Spec v1.0**:

- `Proposal.intent` is `IntentInstance`
- `scopeProposal` is read from `intent.body.scopeProposal`
- `approvedScope` is set by Authority, stored in Proposal and DecisionRecord
- `intentId` and `intentKey` come from IntentInstance

---

## Appendix C: Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | TBD | Initial release |
| 1.0.0-rev1 | TBD | Added snapshotHash rules, fork-only constraint, pending clarification, persistence section |
| 1.0.0-rev2 | TBD | Integrated Intent & Projection Spec types, added approvedScope, removed scopeProposal duplication |

---

*End of Manifesto World Protocol Specification v1.0*
