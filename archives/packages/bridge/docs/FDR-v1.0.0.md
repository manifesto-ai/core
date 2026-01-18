# Intent & Projection — Foundational Design Rationale (FDR)

> **Version:** 1.0
> **Status:** Normative
> **Purpose:** Document the "Why" behind every constitutional decision in Intent & Projection Spec

---

## Overview

This document records the foundational design decisions that shape Intent and Projection.

Each FDR entry follows the format:

- **Decision**: What was decided
- **Context**: Why this decision was needed
- **Rationale**: The reasoning behind the choice
- **Alternatives Rejected**: Other options considered and why they were rejected
- **Consequences**: What this decision enables and constrains

---

## FDR-IP001: Intent is a Command, Not an Event

### Decision

Intent is defined as a **command** (request to perform action), not an event (fact that happened).

### Context

Two mental models for "user wants something to happen":

| Model | Semantics | Example |
|-------|-----------|---------|
| **Event** | "This happened" | `TodoCreated { id, title }` |
| **Command** | "Do this" | `CreateTodo { title }` |

### Rationale

**Intent represents user/system desire, not accomplished fact.**

```
User clicks "Add Todo"
    ↓
Intent: "Please create a todo with title X"  ← Command
    ↓
Authority approves
    ↓
Host executes
    ↓
Event: "Todo was created"  ← Fact (implicit in new Snapshot)
```

Key insight: **Before Authority approves, nothing has happened yet.** Intent is the *request*, not the *result*.

| Concern | Command Model | Event Model |
|---------|---------------|-------------|
| **Approval** | ✅ Natural: "approve this request" | ❌ Awkward: "approve this fact?" |
| **Rejection** | ✅ "Request denied" | ❌ "Fact didn't happen?" |
| **Retry** | ✅ "Request again" | ❌ "Event again?" (confusing) |
| **Audit** | ✅ "Who requested what" | ⚠️ "Who caused this event" (indirect) |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Event-based ("TodoCreated") | Implies fact before approval; confuses governance |
| Hybrid (sometimes event, sometimes command) | Inconsistent mental model |

### Consequences

- Intent is always a request, never a fact
- Authority judges requests, not facts
- Rejection is natural: "request denied"
- Retry is natural: "request again"
- Events are implicit in Snapshot transitions (not explicit)

---

## FDR-IP002: Dual Identity — intentId + intentKey

### Decision

Intent has **dual identity**:
- `intentId`: Unique per processing attempt (instance identity)
- `intentKey`: Derived from semantic content (semantic identity)

### Context

Consider these scenarios:

**Scenario A: Retry after failure**
```
User: "Create todo: Buy milk"
System: (network error, failed)
User: "Try again" (clicks retry)
```
Is this the "same intent" or "different intent"?

**Scenario B: Duplicate detection**
```
User: "Create todo: Buy milk"
User: (accidentally clicks twice)
```
Should both execute?

**Scenario C: Audit trail**
```
Auditor: "Show me all attempts to create this todo"
```

### Rationale

**Both instance and semantic identity are needed for different purposes.**

| Identity | Purpose | Changes On |
|----------|---------|------------|
| `intentId` | Track this specific attempt | Every attempt |
| `intentKey` | Identify semantic equivalence | Content change |

```typescript
// First attempt
{ intentId: 'abc-001', intentKey: 'sha256:xyz', body: { type: 'todo.create', input: { title: 'Buy milk' } } }

// Retry (same semantic, new attempt)
{ intentId: 'abc-002', intentKey: 'sha256:xyz', body: { type: 'todo.create', input: { title: 'Buy milk' } } }

// Different content (different semantic)
{ intentId: 'abc-003', intentKey: 'sha256:qrs', body: { type: 'todo.create', input: { title: 'Buy bread' } } }
```

This enables:
- **Duplicate detection**: Same intentKey in short window? Probably duplicate.
- **Retry tracking**: Same intentKey, multiple intentIds? Track retry attempts.
- **Audit**: Group by intentKey to see all attempts for same semantic intent.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Single ID (always unique) | Cannot detect semantic duplicates |
| Single ID (content hash) | Cannot distinguish retry attempts |
| No ID (use content directly) | No stable reference for tracking |

### Consequences

- Every IntentInstance has both `intentId` and `intentKey`
- Retry creates new `intentId`, preserves `intentKey`
- Semantic equality = same `intentKey`
- Instance equality = same `intentId`

---

## FDR-IP003: Body / Meta / Instance Separation

### Decision

Intent is structured as three layers:
- **IntentBody**: Semantic content (`type`, `input`, `scopeProposal`)
- **IntentMeta**: Non-semantic metadata (`origin`)
- **IntentInstance**: Complete intent (`body` + `intentId` + `intentKey` + `meta`)

### Context

Initial design had flat Intent:
```typescript
type Intent = {
  type: string;
  input: unknown;
  intentId: string;
  intentKey: string;
  origin: IntentOrigin;
  scopeProposal?: IntentScope;
};
```

Problem: Which fields affect `intentKey`? Where's the boundary?

### Rationale

**Clear separation makes intentKey computation unambiguous.**

```typescript
type IntentBody = {
  type: string;           // ✅ Semantic
  input?: unknown;        // ✅ Semantic
  scopeProposal?: IntentScope; // ✅ Semantic (affects execution scope)
};

type IntentMeta = {
  origin: IntentOrigin;   // ❌ Not semantic (who/where, not what)
};

type IntentInstance = {
  body: IntentBody;       // Semantic content
  intentId: string;       // Instance identity (not semantic)
  intentKey: string;      // Derived from body + schemaHash
  meta: IntentMeta;       // Metadata (not semantic)
};
```

**Rule becomes simple:** `intentKey = hash(schemaHash + body)`

| Field | Location | In intentKey? |
|-------|----------|---------------|
| `type` | body | ✅ Yes |
| `input` | body | ✅ Yes |
| `scopeProposal` | body | ✅ Yes |
| `intentId` | instance | ❌ No |
| `intentKey` | instance | ❌ No (it's the result) |
| `origin.*` | meta | ❌ No |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Flat structure with "exclude list" | Error-prone, easy to forget fields |
| Nested but no clear rule | Still ambiguous |
| Origin in body | Same semantic intent from different sources would have different keys |

### Consequences

- Clear boundary: body = semantic, meta = metadata
- intentKey computation is unambiguous
- Projection produces IntentBody only
- Issuer adds identity (intentId, intentKey) and metadata (meta)

---

## FDR-IP004: Origin is Metadata, Not Semantic Content

### Decision

`origin` (projectionId, source, actor) is **metadata** and **MUST NOT** affect `intentKey`.

### Context

Consider:
```typescript
// Same action from UI
{ body: { type: 'todo.create', input: { title: 'X' } }, origin: { projectionId: 'web-ui' } }

// Same action from CLI
{ body: { type: 'todo.create', input: { title: 'X' } }, origin: { projectionId: 'cli' } }

// Same action from agent
{ body: { type: 'todo.create', input: { title: 'X' } }, origin: { projectionId: 'agent-1' } }
```

Are these semantically the same intent?

### Rationale

**Yes. "Create todo with title X" is the same command regardless of who/where.**

The semantic meaning of an intent is:
- **What** action to perform (`type`)
- **With what** parameters (`input`)
- **Within what** boundaries (`scopeProposal`)

The semantic meaning is **NOT**:
- **Who** submitted it (actor) — governance concern
- **Where** it came from (projection) — routing concern
- **When** it was submitted (timestamp) — temporal concern

```
"Create todo: Buy milk" from Alice via Web UI
    = semantically same as =
"Create todo: Buy milk" from Bob via CLI
```

These have the same `intentKey` but different `origin`.

Authority may treat them differently (Alice auto-approve, Bob HITL), but that's **governance policy**, not **semantic identity**.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Include origin in intentKey | Same action = different key based on source; breaks semantic equality |
| No origin at all | Lose audit trail of who/where |
| Origin as optional semantic field | Ambiguous; when is it semantic? |

### Consequences

- Same command from different sources has same `intentKey`
- Duplicate detection works across sources
- Audit can group by `intentKey` to see all attempts
- Governance (Authority) uses `origin.actor` for policy decisions

---

## FDR-IP005: intentKey Algorithm is Normative (MUST)

### Decision

`intentKey` computation algorithm is **MUST** (not SHOULD or MAY):

```
intentKey = SHA-256(schemaHash + ":" + body.type + ":" + JCS(body.input) + ":" + JCS(body.scopeProposal))
```

### Context

If intentKey algorithm is "RECOMMENDED":
- Implementation A uses SHA-256
- Implementation B uses MD5
- Implementation C uses different field order

Same intent → different keys → interoperability broken.

### Rationale

**Semantic identity MUST be interoperable.**

| Concern | Normative Algorithm | Recommended Algorithm |
|---------|--------------------|-----------------------|
| **Interoperability** | ✅ Same key everywhere | ❌ Different keys per impl |
| **Duplicate detection** | ✅ Works across systems | ❌ Fails across systems |
| **Audit correlation** | ✅ Group by key works | ❌ Cannot correlate |

**Algorithm choice:**

| Component | Choice | Reason |
|-----------|--------|--------|
| Hash | SHA-256 | Standard, widely available, collision-resistant |
| Canonicalization | RFC 8785 (JCS) | Standard JSON canonicalization, deterministic |
| Separator | `:` | Simple, unlikely in content |
| Include schemaHash | Yes | Same action in different schemas = different key |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| RECOMMENDED (flexible) | Breaks interoperability |
| Implementation-defined | Vendor lock-in |
| SHA-512 | Overkill, longer strings |
| Custom canonicalization | Non-standard, risk of divergence |

### Consequences

- All implementations produce identical intentKey for identical content
- Interoperability guaranteed
- Third-party tools can compute intentKey independently
- Algorithm changes require spec version bump

---

## FDR-IP006: Projection is a Weak Interpreter

### Decision

Projection is a **weak interpreter**: it may **select** actions and **shape** input, but **MUST NOT** implement domain logic.

### Context

Projection sits between raw events and domain Intents. How much intelligence should it have?

| Level | Example |
|-------|---------|
| **Dumb pipe** | Pass everything through unchanged |
| **Weak interpreter** | Map UI events to Intent types, shape input |
| **Strong interpreter** | Apply business rules, make decisions |
| **Agent** | Reason about best action, plan |

### Rationale

**Weak interpreter balances DX with architectural purity.**

**Why not dumb pipe?**
- UI sends `{ buttonId: 'btnSubmit', formData: {...} }`
- Someone has to map this to `{ type: 'form.submit', input: {...} }`
- If not Projection, then where? Pollute Core? Pollute UI?

**Why not strong interpreter?**
- Domain logic in Projection is untestable (no Core isolation)
- Business rules in two places (Core AND Projection)
- "Why did this happen?" → need to trace both Core AND Projection

**Weak interpreter sweet spot:**
```typescript
// ✅ Allowed: Map UI identifier to Intent type
if (buttonId === 'btnSubmit') {
  return { type: 'form.submit', input: formData };
}

// ✅ Allowed: Gate on computed availability
if (!computed.canSubmit) {
  return { kind: 'none', reason: 'Not available' };
}

// ❌ Forbidden: Apply domain threshold
if (amount > 1000) {
  return { type: 'requestApproval' };  // This rule belongs in Computed!
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Dumb pipe | Poor DX, UI leaks into Core |
| Strong interpreter | Domain logic duplication, untestable |
| Agent-level | Projection is not the place for planning |

### Consequences

- Projection can provide good DX (map UI events to Intents)
- Domain logic stays in Core (Computed/Flow)
- Single source of truth for business rules
- Projection is thin, testable, predictable

---

## FDR-IP007: Projection MUST Read SnapshotView (data + computed)

### Decision

Projection **MAY** read `snapshot.data` and `snapshot.computed` (read-only).

### Context

Initial concern: "Should Projection see any state at all?"

Purist view: Projection should only see SourceEvent.
Pragmatic view: Projection needs state for availability gating.

### Rationale

**DX requires availability gating; this is weak interpretation, not domain logic.**

Consider a UI with a Submit button:
```typescript
// Option A: UI has no idea if submit is valid
// → Show button always, fail on submit (poor UX)

// Option B: UI checks raw data in Projection
// → Projection implements validation logic (domain logic in Projection!)

// Option C: UI reads computed.canSubmit
// → Domain logic in Computed (good), Projection just gates (good)
```

Option C is the design:
```typescript
// Projection reads computed availability
if (snapshot.computed['form.canSubmit'] === false) {
  return { kind: 'none', reason: 'Submit not available' };
}
return { kind: 'intent', body: { type: 'form.submit', ... } };
```

**Key distinction:**
- Reading `computed.canSubmit`: ✅ Projection reads a domain decision
- Computing `data.amount > 1000`: ❌ Projection makes a domain decision

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| No state access | Poor DX, can't gate on availability |
| Only data access | Would need to implement computed logic in Projection |
| Full Snapshot access (including meta/system) | Non-determinism risk, unnecessary coupling |

### Consequences

- Projection has good DX (can gate on availability)
- Domain logic stays in Computed
- SnapshotView is minimal (data + computed only)
- `meta`, `system`, `input` are excluded (not needed, risk non-determinism)

---

## FDR-IP008: SnapshotView Excludes meta/version/timestamp

### Decision

SnapshotView intentionally excludes `meta.version`, `meta.timestamp`, and other non-semantic fields.

### Context

Full Snapshot includes:
```typescript
type Snapshot = {
  data: TData;
  computed: Record<...>;
  system: { status, lastError, ... };
  input: unknown;
  meta: {
    version: number;      // Incremented by Core
    timestamp: number;    // Set by Core from HostContext
    randomSeed: string;   // Set by Core from HostContext
    schemaHash: string;   // Schema identifier
  };
};
```

Should Projection see all of this?

### Rationale

**Projection must be deterministic. Non-deterministic fields break this.**

| Field | Deterministic? | In SnapshotView? |
|-------|----------------|------------------|
| `data` | ✅ Yes | ✅ Yes |
| `computed` | ✅ Yes (derived from data) | ✅ Yes |
| `meta.version` | ❌ Changes on every apply | ❌ No |
| `meta.timestamp` | ❌ Wall-clock time | ❌ No |
| `meta.schemaHash` | ✅ Yes | Passed separately |
| `system.*` | Internal state | ❌ No |
| `input` | Transient | ❌ No |

If Projection could read `meta.timestamp`:
```typescript
// Non-deterministic projection!
if (Date.now() - snapshot.meta.timestamp > 5000) {
  return { type: 'stale.refresh' };
}
```

Same SnapshotView at different times → different Intent → violates INV-P2.

**schemaHash is needed** (for intentKey), but passed separately in ProjectionRequest, not via SnapshotView.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Full Snapshot access | Non-determinism risk |
| Exclude only timestamp | version also changes; incomplete |
| Trust developers not to use | Implicit contract, easy to violate |

### Consequences

- SnapshotView is minimal: `{ data, computed }`
- Determinism is structurally enforced
- schemaHash passed explicitly in ProjectionRequest
- UI loading/error states must be in data or computed, not implicit meta

---

## FDR-IP009: Projection MUST Be Deterministic

### Decision

Projection **MUST** be deterministic with respect to IntentBody output.

Same inputs → Same IntentBody (or same `none` result).

### Context

Why does determinism matter for Projection?

### Rationale

**Reproducibility and debugging require determinism.**

| Concern | Deterministic | Non-deterministic |
|---------|---------------|-------------------|
| **Replay** | ✅ Same result | ❌ Different result |
| **Debugging** | ✅ "Given X, got Y" | ❌ "Sometimes Y, sometimes Z" |
| **Testing** | ✅ Predictable assertions | ❌ Flaky tests |
| **Audit** | ✅ "This input → this intent" | ❌ "This input → ???" |

**What must be deterministic:**
```typescript
// Given same:
{
  schemaHash: 'abc',
  snapshot: { data: {...}, computed: {...} },
  actor: { actorId: 'alice', kind: 'human' },
  source: { kind: 'ui', eventId: 'btn-1', payload: {...} }
}

// Output must always be same:
{ kind: 'intent', body: { type: 'X', input: {...} } }
```

**What is NOT required to be deterministic:**
- `intentId` — intentionally unique per issuance
- Recording timestamps — non-semantic

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| SHOULD be deterministic | Leaves room for non-determinism; debugging nightmare |
| Deterministic for intentKey only | Partial determinism is confusing |

### Consequences

- Projection cannot use `Date.now()`, `Math.random()`, network state
- Time-based behavior must be in source.payload or snapshot.data
- Testing is straightforward
- Replay produces identical results

---

## FDR-IP010: Issuer Role Separation

### Decision

**Issuer** is a separate role from Projection:
- Projection produces IntentBody
- Issuer produces IntentInstance (adds intentId, intentKey, origin)

### Context

Who generates `intentId` and `intentKey`?

Option A: Projection generates everything
```typescript
// Projection returns complete IntentInstance
project(...): IntentInstance
```

Option B: Projection returns body, something else adds identity
```typescript
// Projection returns body only
project(...): IntentBody

// Issuer adds identity
issue(body): IntentInstance
```

### Rationale

**Separation of concerns: Projection knows "what", Issuer knows "how to package".**

| Concern | Projection | Issuer |
|---------|------------|--------|
| Select Intent type | ✅ | ❌ |
| Shape input | ✅ | ❌ |
| Generate intentId | ❌ | ✅ |
| Compute intentKey | ❌ | ✅ |
| Attach origin | ❌ | ✅ |

**Benefits:**
- Projection is simpler (just body)
- intentKey computation is centralized (Issuer)
- Multiple Projections share same Issuer logic
- Testing Projection doesn't require ID generation

**Where does Issuer live?**
- UI: Bridge runtime
- Agent: Agent runtime
- System: Scheduler/automation runtime

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Projection generates everything | Duplicates ID generation logic across projections |
| No explicit Issuer | Unclear where ID generation happens |
| Core generates ID | Core shouldn't know about Intent packaging |

### Consequences

- Projection interface is simple: `project(...) → IntentBody | none`
- Issuer interface is focused: `issue(body) → IntentInstance`
- intentKey algorithm is implemented once (in Issuer)
- Clear boundary: Projection is pure transformation

---

## FDR-IP011: System Direct Intent (Without Projection)

### Decision

System Actors **MAY** produce IntentBody directly without using a formal Projection.

### Context

Not all Intents come from "events" that need "projection":
- Cron job: "Run daily cleanup"
- Migration script: "Upgrade schema"
- Event handler: "React to external webhook"

Should these go through a Projection?

### Rationale

**Projection is for external input transformation. System automation often doesn't need it.**

```typescript
// Scheduled job doesn't need "projection" - it knows exactly what Intent to produce
const body: IntentBody = {
  type: 'maintenance.cleanup',
  input: { olderThanDays: 30 }
};

// Still goes through Issuer
const instance = issuer.issue({
  schemaHash,
  projectionId: 'system:scheduler',  // Marker for direct production
  actor: { actorId: 'scheduler', kind: 'system' },
  source: { kind: 'system', eventId: 'cron-001', payload: {} },
  body
});
```

**Key rules:**
- Must still use Issuer (for intentId, intentKey)
- Must mark `origin.projectionId` (e.g., `system:scheduler`)
- Must have `origin.source.kind === 'system'`
- All Intent invariants still apply

**What's different:**
- No formal Projection interface
- Projection invariants (INV-P*) don't apply
- Still auditable (origin shows it's system-direct)

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Force all through Projection | Unnecessary ceremony for automation |
| No system Intents | System actions are valid and needed |
| System bypasses Issuer | Would lose intentId/intentKey |

### Consequences

- System automation is first-class
- `system:*` projectionId pattern indicates direct production
- Issuer is still required (identity is always needed)
- Audit can distinguish UI/Agent/System intents by origin

---

## FDR-IP012: Scope is Proposed by Projection, Approved by Authority

### Decision

**Projection proposes** scope (`body.scopeProposal`), **Authority approves** scope (`approvedScope`).

### Context

Who decides the write boundaries for an Intent?

| Option | Description |
|--------|-------------|
| Schema defines | Each Intent type has fixed scope |
| Projection decides | Projection sets final scope |
| Authority decides | Authority sets scope regardless of proposal |
| Collaborative | Projection proposes, Authority approves/modifies |

### Rationale

**Projection knows the context; Authority has the final say.**

```
Projection: "This form submit should only write to data.profile.*"
    ↓ scopeProposal: { allowedPaths: ['profile.*'] }
    
Authority: "I approve this scope" OR "I'm widening/narrowing this" OR "No scope restriction"
    ↓ approvedScope: { allowedPaths: [...] } OR null
```

**Why Projection proposes:**
- Projection knows the UI context (which form, which section)
- Narrow scope is safer (principle of least privilege)
- Intent becomes self-documenting

**Why Authority approves:**
- Projection might be wrong or malicious
- Authority has policy context
- Final accountability is with Authority

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Schema-fixed scope | Too rigid; same Intent type might need different scope |
| Projection-final scope | No governance check; security risk |
| Authority-only scope | Authority doesn't know UI context |

### Consequences

- `scopeProposal` is in `IntentBody` (semantic: affects intentKey)
- `approvedScope` is in `DecisionRecord`
- Authority can approve, modify, or nullify scope
- Host enforcement is optional in v1.0 (trusted model)

---

## FDR-IP013: scopeProposal is Semantic (Affects intentKey)

### Decision

`scopeProposal` is part of IntentBody and **affects** intentKey computation.

### Context

Should `scopeProposal` be semantic (in body) or metadata (in meta)?

### Rationale

**Scope proposal is part of "what you're asking for", not "how you're asking".**

Consider:
```typescript
// Request 1: "Update profile, anywhere"
{ type: 'profile.update', input: {...}, scopeProposal: null }

// Request 2: "Update profile, only name field"
{ type: 'profile.update', input: {...}, scopeProposal: { allowedPaths: ['profile.name'] } }
```

These are **semantically different requests**:
- Request 1: Broad permission
- Request 2: Narrow permission

Authority might approve Request 2 but reject Request 1.

If `scopeProposal` didn't affect `intentKey`, these would be "semantically equal" — but they're not.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Scope as metadata (not in intentKey) | Different scopes = same key; semantic confusion |
| Scope outside Intent entirely | Loses the "narrow scope" benefit; not self-documenting |

### Consequences

- `scopeProposal` is in `body`, not `meta`
- Different scope = different `intentKey`
- Retry with different scope = different semantic intent
- Authority can still override (approvedScope may differ)

---

## FDR-IP014: World Protocol Uses IntentInstance Directly

### Decision

World Protocol **MUST** use `IntentInstance` type as defined in this spec. No flattening or transformation.

### Context

Two options for World Protocol integration:

**Option A: World Protocol defines its own Intent type**
```typescript
// World Protocol
type Proposal = {
  intent: {
    type: string;
    input: unknown;
    intentId: string;
    // ... different structure
  }
};
```

**Option B: World Protocol uses IntentInstance directly**
```typescript
// World Protocol
type Proposal = {
  intent: IntentInstance;  // From this spec
};
```

### Rationale

**Single source of truth for Intent structure.**

| Concern | Option A (separate) | Option B (shared) |
|---------|--------------------|--------------------|
| **Type safety** | ⚠️ Need adapters | ✅ Direct use |
| **Documentation** | ❌ Two specs to read | ✅ One spec |
| **Evolution** | ❌ Sync two types | ✅ Change once |
| **Implementation** | ❌ Transform at boundary | ✅ Pass through |

**Practical benefit:**
- `Proposal.intent.body.scopeProposal` — clear path
- No need for `Proposal.scopeProposal` duplication
- intentId, intentKey are already there

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| World Protocol defines own type | Duplication, sync burden |
| Flatten IntentInstance in Proposal | Loses structure, harder to evolve |

### Consequences

- World Protocol depends on this spec for Intent types
- `Proposal.intent` is `IntentInstance`
- `scopeProposal` is read from `intent.body.scopeProposal`
- No type transformation needed at World Protocol boundary

---

## Summary Table

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| IP001 | Intent is Command | Request, not fact |
| IP002 | Dual identity (intentId + intentKey) | Instance vs semantic |
| IP003 | Body/Meta/Instance separation | Clear intentKey boundary |
| IP004 | Origin is metadata | Same command = same key |
| IP005 | intentKey algorithm is MUST | Interoperability |
| IP006 | Projection is weak interpreter | DX without domain logic |
| IP007 | SnapshotView includes data+computed | Availability gating |
| IP008 | SnapshotView excludes meta | Determinism |
| IP009 | Projection MUST be deterministic | Reproducibility |
| IP010 | Issuer role separation | Single ID generation point |
| IP011 | System direct intent | Automation is first-class |
| IP012 | Scope: propose → approve | Collaborative governance |
| IP013 | scopeProposal is semantic | Different scope = different intent |
| IP014 | World Protocol uses IntentInstance | Single source of truth |

---

## Cross-Reference: Related FDRs

### From World Protocol FDR

| World Protocol FDR | Relevance |
|--------------------|-----------|
| FDR-W001 (Intent-level governance) | Intent defined here |
| FDR-W002 (Proposal = Actor + Intent) | IntentInstance is wrapped |
| FDR-W006 (Host executes approved only) | After Authority approves |

### From Host Contract FDR

| Host FDR | Relevance |
|----------|-----------|
| FDR-H006 (Intent identity) | intentId stability during execution |
| FDR-H003 (No pause/resume) | Approval happens before Host |

### From Schema Spec FDR

| Schema FDR | Relevance |
|------------|-----------|
| FDR-010 (Canonical form & hashing) | JCS for intentKey |

---

*End of Intent & Projection FDR v1.0*
