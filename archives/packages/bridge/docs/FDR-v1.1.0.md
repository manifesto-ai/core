# Intent & Projection — Foundational Design Rationale (FDR)

> **Version:** 1.1
> **Status:** Normative
> **Purpose:** Document the "Why" behind every constitutional decision in Intent & Projection Spec
> **Changelog:** v1.1 adds Action Catalog system (FDR-IP015 through FDR-IP019)

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
    timestamp: number;    // Wall-clock time
    schemaHash: string;   // Schema identifier
  };
};
```

Should Projection see all of this?

### Rationale

**Non-determinism risk outweighs convenience.**

| Field | Risk if Included |
|-------|------------------|
| `meta.version` | Same data at v1 vs v2 → different projection? |
| `meta.timestamp` | Wall-clock in projection → non-deterministic |
| `system.*` | Internal state leaks into projection |
| `input` | Transient effect data; not relevant |

**schemaHash is passed separately** in `ProjectionRequest` because:
- It's needed for `intentKey` computation
- It's **not** state; it's request context
- Different lifecycle (per-request, not per-snapshot)

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Include all fields | Non-determinism risk |
| Include version only | Projection shouldn't vary by version |
| Include schemaHash in SnapshotView | It's request context, not state |

### Consequences

- SnapshotView is deterministic-safe
- Projection cannot depend on version/timestamp
- schemaHash is explicitly passed in request
- System state is hidden from Projection

---

## FDR-IP009: Projection MUST be Deterministic

### Decision

Projection **MUST** be deterministic for IntentBody output.

### Context

If Projection is non-deterministic:
```typescript
// Time 1: User clicks submit
project(event, snapshot) → { type: 'A', input: {...} }

// Time 2: Same event, same snapshot
project(event, snapshot) → { type: 'B', input: {...} }
```

This breaks:
- Reproducibility (can't replay)
- Testing (flaky tests)
- Debugging ("why did it do that?")

### Rationale

**Reproducibility is foundational.**

| Scenario | Deterministic | Non-deterministic |
|----------|---------------|-------------------|
| **Replay** | ✅ Same result | ❌ Different result |
| **Testing** | ✅ Reliable | ❌ Flaky |
| **Debugging** | ✅ Reproduce issue | ❌ "Works on my machine" |
| **Audit** | ✅ "Given X, Y was produced" | ❌ "Given X, sometimes Y" |

**What makes projection deterministic:**
- Same `snapshot.data` + Same `snapshot.computed` + Same `actor` + Same `source.*` (except `occurredAt`) → Same IntentBody

**What's explicitly excluded from determinism:**
- `source.occurredAt` — timestamp, non-deterministic by nature
- Wall-clock time — use `source.payload` or `snapshot.data` for time-based logic

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| SHOULD be deterministic | Too weak; violators break ecosystem |
| Allow "controlled non-determinism" | Slippery slope; hard to enforce |

### Consequences

- Projection is pure function (for its deterministic inputs)
- Can test Projection in isolation
- Can replay projection for debugging
- `intentId` is the only intentionally non-deterministic output (from Issuer)

---

## FDR-IP010: Issuer is a Separate Role

### Decision

**Issuer** is a distinct role that transforms IntentBody → IntentInstance.

### Context

Who adds `intentId` and `intentKey`?

| Option | Description |
|--------|-------------|
| Projection adds them | Projection produces complete IntentInstance |
| Core adds them | Core wraps IntentBody |
| Separate Issuer | Dedicated component for identity |

### Rationale

**Single responsibility: Projection shapes, Issuer identifies.**

```
Projection: "What action should happen?"
    ↓ IntentBody
Issuer: "Here's a unique instance with identity"
    ↓ IntentInstance
World Protocol: "Let's govern this"
```

**Why not Projection:**
- Projection is already complex (event mapping, state reading)
- Adding ID generation mixes concerns
- Projection should be stateless; ID generation needs state/randomness

**Why not Core:**
- Core is about computation, not identity
- Core shouldn't know about Intent lifecycle

**Issuer responsibilities:**
- Generate unique `intentId` (stateful: needs counter or randomness)
- Compute `intentKey` (deterministic: from body + schemaHash)
- Attach `meta.origin` (from projection context)
- Ensure immutability (freeze the instance)

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Projection generates ID | Mixes concerns, adds state to Projection |
| Core generates ID | Core is computation, not lifecycle |
| World Protocol generates ID | Too late; need ID for submission |

### Consequences

- Clear separation: Projection produces body, Issuer produces instance
- Issuer is the single point of ID generation
- Issuer can be shared across projections
- Testing: mock Issuer for deterministic IDs

---

## FDR-IP011: System Direct Intent is First-Class

### Decision

System actors **MAY** produce IntentBody directly without using a formal Projection.

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
    ↓ scopeProposal: { allowedPaths: ['data.profile.*'] }
    
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
{ type: 'profile.update', input: {...}, scopeProposal: { allowedPaths: ['data.profile.name'] } }
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

## FDR-IP015: Action Catalog is a Projection Output, Not a Security Boundary (v1.1)

### Decision

Action Catalog is a **projection output** for UX/cost optimization, explicitly **NOT** a security boundary.

### Context

LLM-based agents need to know which actions are currently available. Two mental models:

| Model | Semantics | Implication |
|-------|-----------|-------------|
| **Security boundary** | "Hide action = prevent action" | Pruning is enforcement |
| **UX/cost optimization** | "Hide action = reduce noise/tokens" | Authority is enforcement |

### Rationale

**Security through obscurity is not security.**

```
LLM sees: [action A, action B]  (C was pruned)
LLM calls: action C anyway (hallucination, injection, etc.)

If Action Catalog is security boundary:
  → System assumes C is blocked
  → C might execute (security hole!)

If Action Catalog is UX optimization:
  → Authority validates C at runtime
  → C is rejected by Authority (security intact)
```

**Why Action Catalog is NOT security:**
- LLMs can hallucinate actions not in the catalog
- Prompt injection can bypass pruning
- Client-side pruning is never trustworthy

**Why Action Catalog IS valuable:**
- **Token reduction**: 98% cost savings by not sending unavailable actions
- **Hallucination mitigation**: LLM less likely to call actions it doesn't see
- **UX improvement**: UI can show/hide buttons based on availability

**Defense in Depth:**
```
Action Catalog: "Don't show action C" (hint)
    ↓
LLM: Calls action C anyway
    ↓
Authority: Judges Proposal (governance)
    ↓
Core runtime: "Action C not available" (availability enforcement)
    ↓
Rejected
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Action Catalog as security boundary | False security; Authority bypass risk |
| No Action Catalog | Poor DX; token waste; more hallucinations |
| Duplicate enforcement in Catalog | Redundant; Authority already does this |

### Consequences

- Action Catalog is explicitly "NOT a security boundary" in spec
- Final enforcement is outside projection (Authority governance + Core runtime validation)
- Implementations can prune aggressively without security concern
- LLM runtimes MUST NOT assume pruning prevents action calls

---

## FDR-IP016: Availability Evaluation Must Be Pure and Deterministic (v1.1)

### Decision

Action availability predicates (`available` field) **MUST** be pure functions of `(snapshot.data, snapshot.computed, actor)`.

### Context

Availability predicates determine if an action should be shown. What inputs can they use?

| Input | Example | Allowed? |
|-------|---------|----------|
| `snapshot.data` | `data.user.role === 'admin'` | ✅ |
| `snapshot.computed` | `computed.canDelete === true` | ✅ |
| `actor.kind` | `actor.kind === 'human'` | ✅ |
| `actor.meta` | `actor.meta.permissions` | ✅ |
| Wall-clock time | `Date.now() > deadline` | ❌ |
| Random | `Math.random() > 0.5` | ❌ |
| Network | `await fetch(...)` | ❌ |
| `$system.*` | `$system.status` | ❌ |
| `$input.*` | `$input.amount > 1000` | ❌ |

### Rationale

**Determinism enables caching and debugging. $input exclusion ensures stable catalogs.**

**Why pure:**
```typescript
// Pure: Same inputs → same output
available: (snapshot, actor) => snapshot.computed.canEdit && actor.kind !== 'system'

// Impure: Side effects, non-deterministic
available: async (snapshot) => {
  const external = await fetch('/permissions');  // ❌ Network
  return external.allowed && Date.now() < deadline;  // ❌ Time
}
```

**Why exclude $input:**
```typescript
// ❌ Forbidden: Input-dependent availability
available: (ctx) => ctx.input?.amount <= 1000

// Problem: Action Catalog is projected BEFORE intent input is known.
// If availability depends on input, the catalog would need to be re-projected
// for every possible input value, which breaks the "enumerate available actions" model.
```

The Action Catalog answers "what CAN the user do?" not "what CAN the user do with this specific input?"
Input validation belongs in Schema/Core, not in availability predicates.

**Benefits of purity:**
- **Caching**: `catalogHash` is stable for same inputs
- **Debugging**: "Why was action X unavailable?" → replay with same inputs
- **Testing**: Mock snapshot + actor, verify availability
- **Consistency**: UI and LLM runtime see same availability

**What if time-based logic is needed?**
- Put deadline in `snapshot.data` (schema field)
- Compute `isExpired` in `snapshot.computed`
- Availability reads `computed.isExpired`

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Allow async availability | Non-deterministic; can't cache |
| Allow time access | Different results per second; flaky |
| Allow $system access | Internal state leak; unpredictable |
| Allow $input access | Catalog instability; breaks enumeration model |

### Consequences

- Availability predicates are pure functions
- MEL expressions for `available` have purity constraints including $input exclusion
- Time-based availability must use schema-defined fields
- `catalogHash` is deterministic

---

## FDR-IP017: catalogHash Algorithm is Normative (v1.1)

### Decision

`catalogHash` computation algorithm is **MUST** (normative), parallel to `intentKey`:

```
catalogHash = SHA-256(
  schemaHash + ":" +
  JCS(actions.map(a => ({
    type: a.type,
    status: a.availability.status,
    reason: a.availability.status === 'unknown' ? a.availability.reason : null
  }))) + ":" +
  JCS(appliedPruningOptions)
)
```

### Context

If `catalogHash` is implementation-defined:
- LLM runtime A: hash = "abc123"
- LLM runtime B: hash = "xyz789" (same catalog!)
- Cannot compare, cannot cache cross-system

### Rationale

**Same reasoning as intentKey: interoperability requires normative algorithm.**

| Concern | Normative | Implementation-defined |
|---------|-----------|------------------------|
| **Cache sharing** | ✅ Cross-system | ❌ Per-implementation |
| **Debugging** | ✅ "Same hash = same catalog" | ❌ Can't compare |
| **LLM prompt caching** | ✅ Cache by catalogHash | ❌ Can't identify same catalog |

**Algorithm choices:**

| Component | Choice | Reason |
|-----------|--------|--------|
| Hash | SHA-256 | Consistent with intentKey |
| Canonicalization | JCS (RFC 8785) | Consistent with intentKey |
| Include schemaHash | Yes | Different schemas = different catalogs |
| Include status | Yes | Availability affects pruning result |
| Include unknown reason | Yes | Distinguishes "missing_context" vs "indeterminate" |
| Include pruning options | Yes | Different policies = different catalogs |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| RECOMMENDED | Breaks cross-system cache |
| Implementation-defined | Vendor lock-in |
| Include label/description | Non-semantic; same catalog could have different labels |

### Consequences

- `catalogHash` is deterministic and interoperable
- Can use `catalogHash` as cache key across systems
- LLM prompt caching can leverage `catalogHash`
- Algorithm changes require spec version bump

---

## FDR-IP018: Unknown Availability Status and Runtime Fallback (v1.1)

### Decision

If availability evaluation cannot complete (e.g., missing context), status **MUST** be `'unknown'`, not forced to `false`. Core runtime **MUST** perform full evaluation for `unknown` actions if invoked.

### Context

What happens when availability predicate references missing data?

```typescript
// Predicate
available: (snapshot, actor) => actor.meta.permissions?.includes('admin')

// Runtime
actor.meta = undefined  // No permissions data!
```

| Option | Behavior |
|--------|----------|
| Force to `false` | Action hidden; maybe incorrectly |
| Force to `true` | Action shown; maybe incorrectly |
| `unknown` status | Honest uncertainty |

### Rationale

**Honest uncertainty is better than false confidence.**

**Problem with forcing to false:**
```
Predicate: actor.meta.permissions?.includes('admin')
Actor meta: undefined (not loaded yet)

If forced to false:
  → "Admin action" hidden
  → Admin user can't see their action
  → Bug reports: "Where's my admin button?"
```

**Problem with forcing to true:**
```
If forced to true:
  → "Admin action" shown to everyone
  → Non-admin clicks → Core rejects at execution
  → Better UX? Maybe, but noisy
```

**Unknown status solution:**
```typescript
// Projection time
availability: { status: 'unknown', reason: 'missing_context' }

// Pruning policy
includeUnknown: true → Show action (optimistic)
includeUnknown: false → Hide action (conservative)

// Runtime (if invoked)
Core runtime: Full evaluation with all context
  → Either allow execution or reject definitively
```

**Why Core runtime, not Authority?**

| Layer | Responsibility | Availability Enforcement |
|-------|----------------|--------------------------|
| Authority | Governance: approve/reject Proposal | MAY check, not MUST |
| Core runtime | Execution: compute state transition | MUST check before flow execution |

Authority's job is policy judgment (scope, permissions, HITL).
Core runtime's job is domain logic execution — this includes "is this action actually available right now?"

Forcing Authority to "MUST evaluate availability" would:
- Conflate governance with domain logic
- Require Authority to embed Core's computation semantics
- Break the clean layering between World Protocol and Core

**Two unknown reasons:**
- `missing_context`: Required data not available (might be available later)
- `indeterminate`: Expression cannot be evaluated statically (too complex)

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Force to false | False negative; hides valid actions |
| Force to true | False positive; shows invalid actions |
| Error/throw | Breaks projection; poor DX |
| Authority MUST evaluate | Conflates governance with domain logic |

### Consequences

- `unknown` is valid availability status
- `includeUnknown` policy controls pruning behavior
- Core runtime performs full evaluation at execution time
- Authority MAY evaluate but is not required to
- UI can show "unknown" actions differently (e.g., grayed out)

---

## FDR-IP019: Bridge Optional Method Fallback (v1.1)

### Decision

If `projectActionCatalog` is not implemented, LLM runtimes **SHOULD** fall back to schema-defined static action list with all actions treated as `available`.

### Context

`projectActionCatalog` is optional in Bridge API:

```typescript
interface Bridge {
  // ... required methods ...
  projectActionCatalog?(req: ActionCatalogProjectionRequest): ActionCatalog;
}
```

What happens when an LLM runtime calls it but it's not implemented?

### Rationale

**Graceful degradation over hard failure.**

| Scenario | Hard Failure | Graceful Degradation |
|----------|--------------|----------------------|
| Old Bridge, new LLM runtime | ❌ Crash | ✅ Use static list |
| Minimal implementation | ❌ Can't use LLM | ✅ Works (less optimal) |
| Progressive enhancement | ❌ All or nothing | ✅ Start simple, add later |

**Fallback behavior:**
```typescript
// LLM runtime
const catalog = bridge.projectActionCatalog?.(req) 
  ?? staticCatalogFromSchema(schema, { allAvailable: true });
```

**Why "all available" as default:**
- Conservative: Better to show action and have Authority reject
- Authority is the enforcement point anyway
- Avoids false negatives from missing projection

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Hard failure | Breaks LLM integration for simple implementations |
| Empty catalog | LLM can't do anything; poor DX |
| All unavailable | False negatives; users confused |

### Consequences

- `projectActionCatalog` is truly optional
- LLM runtimes have defined fallback behavior
- Progressive enhancement is supported
- Minimum viable Bridge can omit Action Catalog initially

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
| IP015 | Action Catalog is NOT security | Defense in depth; Authority enforces |
| IP016 | Availability is pure | Caching, debugging, consistency; no $input |
| IP017 | catalogHash algorithm is MUST | Cross-system interoperability |
| IP018 | Unknown status + runtime fallback | Honest uncertainty; Core enforces |
| IP019 | Bridge optional method fallback | Graceful degradation |

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

### From Compiler Spec (v1.1 addition)

| Compiler Reference | Relevance |
|--------------------|-----------|
| MEL Expression Spec §7 (IR Mapping) | ExpressionIR structure for `available` field |
| MEL Availability Purity Constraints | Availability evaluation purity rules ($input exclusion) |

---

*End of Intent & Projection FDR v1.1*
