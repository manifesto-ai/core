# Manifesto Intent & Projection Specification v1.1

> **Status:** Proposed
> **Scope:** Normative (except where marked Informative)
> **Authors:** Manifesto Team
> **Applies to:** All Manifesto Intent Producers & Projections
> **License:** MIT
> **Changelog:** v1.1 adds Action Catalog system (§3.4, §7.4), clarifies ExpressionIR cross-reference, adds catalogHash algorithm

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Normative Language](#2-normative-language)
3. [Definitions](#3-definitions)
4. [Intent Semantics](#4-intent-semantics)
5. [Intent Types](#5-intent-types)
6. [Intent Identity](#6-intent-identity)
7. [Projection Contract](#7-projection-contract)
8. [System Direct Intent](#8-system-direct-intent)
9. [Weak Interpreter Boundary](#9-weak-interpreter-boundary)
10. [SnapshotView Contract](#10-snapshotview-contract)
11. [Determinism Requirements](#11-determinism-requirements)
12. [Projection Recording](#12-projection-recording)
13. [Scope Proposal & Approval](#13-scope-proposal--approval)
14. [Integration with World Protocol & Host](#14-integration-with-world-protocol--host)
15. [Bridge Compatibility (Informative)](#15-bridge-compatibility-informative)
16. [Invariants](#16-invariants)
17. [Explicit Non-Goals](#17-explicit-non-goals)

---

## 1. Purpose

This document defines **Intent** and **Projection** for Manifesto.

It specifies:

- Intent is a **Command** (not an event)
- Intent identity uses **dual keys**: `intentId` (instance) and `intentKey` (semantic)
- Projection is a **weak interpreter** (DX-friendly selection, not domain logic)
- Projection may read **SnapshotView (data + computed)** read-only
- Projection **MUST** be **deterministic**
- Scope is **proposed by Projection, approved by Authority**
- **Action Catalog** is a projection output for context injection (v1.1)

---

## 2. Normative Language

Key words **MUST**, **MUST NOT**, **SHOULD**, **MAY**, etc. are interpreted as described in RFC 2119.

---

## 3. Definitions

### 3.1 Actor

All Intents are attributable to an Actor.
**System is also an Actor.**

```typescript
type ActorKind = 'human' | 'agent' | 'system';

type ActorRef = {
  readonly actorId: string;
  readonly kind: ActorKind;
  readonly name?: string;
  readonly meta?: Record<string, unknown>;
};
```

### 3.2 SourceEvent

The raw external trigger that Projection receives.

```typescript
type SourceKind = 'ui' | 'api' | 'agent' | 'system';

type SourceEvent = {
  readonly kind: SourceKind;
  readonly eventId: string;       // Stable identifier if available
  readonly payload: unknown;      // Raw input from source
  readonly occurredAt?: number;   // OPTIONAL; MUST NOT affect semantic projection
};
```

### 3.3 SnapshotView

Projection reads a **read-only** view of semantic state.

```typescript
type SnapshotView = Readonly<{
  data: unknown;
  computed: Record<string, unknown>;
}>;
```

> SnapshotView intentionally excludes `meta`, `version`, and `timestamp`.

### 3.4 Action Catalog (Context Injection)

An **Action Catalog** is a *projection output* used by UIs and LLM runtimes to enumerate
which actions are currently relevant and/or callable.

This specification defines a **standard** Action Catalog shape for Bridge runtimes.

```typescript
/**
 * ExpressionIR: Opaque Intermediate Representation for availability predicates.
 * 
 * When MEL is used, this is the compiler output ExprNode.
 * See manifesto-ai-compiler SPEC §7 (IR Mapping).
 * 
 * Constraints:
 * - MUST be JSON-serializable (for cross-system transport)
 * - MUST be deterministic (same inputs → same output)
 * - MUST yield boolean result
 */
type ExpressionIR = unknown;  // Opaque; structure defined by compiler/builder

/**
 * AvailabilityContext: Input for availability evaluation.
 */
type AvailabilityContext = Readonly<{
  data: unknown;
  computed: Record<string, unknown>;
  actor: ActorRef;
}>;

/**
 * AvailabilityPredicate: What ActionDescriptor.available can hold.
 * 
 * - ExpressionIR: Portable, MEL-compiled expression (preferred)
 * - fn: Non-portable extension for local runtimes only (not cross-system)
 * - null/undefined: Always available
 */
type AvailabilityPredicate =
  | ExpressionIR
  | { readonly kind: 'fn'; readonly evaluate: (ctx: AvailabilityContext) => boolean }  // Non-portable
  | null;

type ActionDescriptor = Readonly<{
  type: string;                      // Stable action identifier
  label?: string;                    // Optional UI label
  description?: string;              // Optional description
  inputSchema?: unknown;             // JSON-serializable schema for tool/UI input
  available?: AvailabilityPredicate; // Optional availability predicate (pure)
}>;

type AvailabilityStatus =
  | { readonly status: 'available' }
  | { readonly status: 'unavailable'; readonly reason?: string }
  | { readonly status: 'unknown'; readonly reason: 'missing_context' | 'indeterminate' };

type ProjectedAction = Readonly<{
  type: string;
  label?: string;
  description?: string;
  inputSchema?: unknown;
  availability: AvailabilityStatus;
}>;

type ActionCatalog = Readonly<{
  kind: 'action_catalog';
  schemaHash: string;
  catalogHash: string;          // Deterministic hash of actions + options (see §7.4.4)
  actions: readonly ProjectedAction[];
}>;
```

> Action Catalog is **NOT** a security boundary.
> Final enforcement remains the responsibility of World Protocol (Authority) and Core runtime validation.
> See FDR-IP015 for rationale.

> If `schemaHash` is needed (it is, for intentKey), it is passed separately in ProjectionRequest.

---

## 4. Intent Semantics

### 4.1 Intent is a Command

An Intent is a **command**: a request to perform a domain action.

> Intent is not a fact ("what happened").
> Intent is a request ("do this").

A system MAY transport Intents via event streams, but "subscription" is only **routing/capability**.
Legitimacy is governed by World Protocol (Authority), unless the actor's binding is auto-approve.

### 4.2 Intent Immutability

- IntentBody **MUST** be immutable once produced
- IntentInstance **MUST** be immutable once issued
- If the "same semantic intent" is needed again, it **MUST** be re-issued as a new IntentInstance with a new `intentId`

---

## 5. Intent Types

### 5.1 Split: Body vs Meta vs Instance

To avoid conflating semantic content with metadata, Intent is structured as:

```typescript
/**
 * IntentBody: Semantic content of the command
 * This is what Projection produces.
 * intentKey is computed from this (+ schemaHash).
 */
type IntentBody = {
  readonly type: string;              // Action identifier (e.g., "todo.create")
  readonly input?: unknown;           // Action parameters
  readonly scopeProposal?: IntentScope; // Proposed write scope (optional)
};

/**
 * IntentMeta: Non-semantic metadata
 * Excluded from intentKey computation.
 */
type IntentMeta = {
  readonly origin: IntentOrigin;
};

/**
 * IntentInstance: Complete intent ready for submission
 * This is what World Protocol receives.
 */
type IntentInstance = {
  readonly body: IntentBody;
  readonly intentId: string;    // Instance identity (unique per attempt)
  readonly intentKey: string;   // Semantic identity (derived from body + schemaHash)
  readonly meta: IntentMeta;
};
```

### 5.2 Intent Origin

Origin captures where and how the Intent was produced.

```typescript
type IntentOrigin = {
  readonly projectionId: string;                    // Which projection produced this
  readonly source: { kind: SourceKind; eventId: string }; // Source event reference
  readonly actor: ActorRef;                         // Who is responsible
  readonly note?: string;                           // Optional human note (not semantic)
};
```

**Rules:**

- `origin` is metadata, **NOT** semantic content
- `origin` **MUST NOT** affect `intentKey` computation
- `origin.note` is for debugging only and **MUST NOT** affect any computation

### 5.3 Intent Scope

Scope defines proposed write boundaries.

```typescript
type IntentScope = {
  readonly allowedPaths?: string[];  // Path patterns allowed to write (e.g., "data.profile.*")
  readonly note?: string;            // Optional human description
};
```

---

## 6. Intent Identity

### 6.1 `intentId` (Instance Identity)

`intentId` identifies a single processing attempt.

**Rules:**

| Rule | Requirement |
|------|-------------|
| ID-1 | Every IntentInstance **MUST** have an `intentId` |
| ID-2 | `intentId` **MUST** be unique per processing attempt |
| ID-3 | `intentId` **MUST** remain stable during a single Host execution loop |
| ID-4 | `intentId` **SHOULD** be UUIDv4, ULID, or equivalent high-entropy identifier |

### 6.2 `intentKey` (Semantic Identity)

`intentKey` defines semantic equality across re-issuance.

#### 6.2.1 Computation Algorithm (MUST)

`intentKey` **MUST** be computed as:

```
intentKey = SHA-256(
  schemaHash + ":" +
  body.type + ":" +
  JCS(body.input ?? null) + ":" +
  JCS(body.scopeProposal ?? null)
)
```

Where:

- `SHA-256` produces a lowercase hex string
- `JCS(x)` is JSON Canonicalization Scheme (RFC 8785) applied to `x`
- `??` is nullish coalescing (use `null` if undefined)

**Implementation Notes:**

- Implementations **MAY** prefix the result (e.g., `sha256:abcd...`) but **MUST** be consistent
- Implementations **MAY** use an alternative canonicalizer **only if** it produces byte-identical output to RFC 8785 for all JSON values

#### 6.2.2 Explicit Exclusions (MUST NOT)

The following fields **MUST NOT** be included in `intentKey` computation:

| Excluded Field | Reason |
|----------------|--------|
| `intentId` | Instance-specific |
| `meta.origin.*` | Metadata, not semantic |
| Wall-clock timestamps | Non-deterministic |
| Runtime correlation fields | Instance-specific |

> **Rationale:** The same semantic command (e.g., "create todo with title X") may originate from different projections, actors, or sources. These are the same *intent*, just different *attempts*.

### 6.3 Equality Semantics

| Equality Type | Definition | Use Case |
|---------------|------------|----------|
| **Instance equality** | Same `intentId` | "Is this the exact same attempt?" |
| **Semantic equality** | Same `intentKey` | "Is this the same command?" |

### 6.4 Retry and Re-issue Semantics

When retrying or re-issuing a semantically identical command:

| Field | Behavior |
|-------|----------|
| `intentId` | **MUST** be new (different attempt) |
| `intentKey` | **MUST** be same (if body is identical) |
| `body` | Same content produces same key |

If `body` changes (different input, different scope), `intentKey` changes.

---

## 7. Projection Contract

### 7.1 Projection Definition

A Projection maps `(SourceEvent, SnapshotView, Actor)` to an IntentBody (or none).

Projection does **NOT** execute, patch, or apply. It only **selects** an Intent type and shapes its input.

```typescript
type ProjectionResult =
  | { kind: 'none'; reason?: string }
  | { kind: 'intent'; body: IntentBody };

interface Projection {
  readonly projectionId: string;

  project(req: ProjectionRequest): ProjectionResult;
}

type ProjectionRequest = {
  readonly schemaHash: string;      // For intentKey computation reference
  readonly snapshot: SnapshotView;  // Read-only: data + computed
  readonly actor: ActorRef;         // Who is acting
  readonly source: SourceEvent;     // What triggered this
};
```

### 7.2 Issuer Contract

Projection returns IntentBody only. An **Issuer** produces IntentInstance.

```typescript
interface IntentIssuer {
  issue(req: IssueRequest): IntentInstance;
}

type IssueRequest = {
  readonly schemaHash: string;
  readonly projectionId: string;
  readonly actor: ActorRef;
  readonly source: SourceEvent;
  readonly body: IntentBody;
};
```

**Issuer Responsibilities (MUST):**

| Responsibility | Description |
|----------------|-------------|
| Generate `intentId` | New unique identifier for this attempt |
| Compute `intentKey` | Using §6.2.1 algorithm |
| Attach `meta.origin` | From projectionId, source, actor |
| Ensure immutability | Returned IntentInstance is frozen |

**Issuer Constraints (MUST NOT):**

| Constraint | Description |
|------------|-------------|
| Modify body | Issuer MUST NOT change type, input, or scopeProposal |
| Add semantic content | Issuer MUST NOT inject business logic |

### 7.3 Issuer Deployment (Guidance)

| Context | Typical Issuer Location |
|---------|------------------------|
| UI | Bridge runtime |
| API | API gateway or handler |
| Agent | Agent runtime |
| System | System runtime or scheduler |

### 7.4 Action Catalog Projection (Standard, Optional)

In addition to Intent-producing projections, Bridge runtimes **MAY** provide a deterministic
**Action Catalog Projection** that supports state-dependent context injection for UIs and LLM toolsets.

This projection **does not** produce Intents and **does not** interact with World Protocol.
It is a read-only *selection & shaping* operation that enumerates currently relevant actions.

#### 7.4.1 Contract

```typescript
type ActionCatalogProjectionRequest = Readonly<{
  schemaHash: string;
  snapshot: SnapshotView;                 // data + computed (read-only)
  actor: ActorRef;                        // acting actor (for meta/roles)
  actions: readonly ActionDescriptor[];    // source catalog (typically from schema)
  mode?: 'llm' | 'ui' | 'debug';           // default: 'llm'
  pruning?: Readonly<{
    policy?: 'drop_unavailable' | 'mark_only';  // default: drop_unavailable
    includeUnknown?: boolean;                   // default: true
    maxActions?: number;                        // OPTIONAL
    sort?: 'type_lex' | 'schema_order';         // default: type_lex
  }>;
}>;

/**
 * Sort order definitions:
 * - `type_lex`: Lexicographic sort by `action.type` (deterministic, interoperable)
 * - `schema_order`: Preserve the order of `req.actions` as provided.
 *   Callers MUST provide `req.actions` in a deterministic order when using `schema_order`.
 */

interface ActionCatalogProjector {
  projectActionCatalog(req: ActionCatalogProjectionRequest): ActionCatalog;
}
```

#### 7.4.2 Availability Evaluation

- If `ActionDescriptor.available` is absent or `null`, the action is treated as **available**.
- If `available` is present, implementations MUST evaluate it deterministically from:
    - `snapshot.data`
    - `snapshot.computed`
    - actor context (at minimum `actorId`, `kind`, and `actor.meta`)

**Purity requirement:** availability evaluation MUST NOT depend on:
- time, randomness, network, external IO
- `$system.*`, `$input.*`, or effects (as defined by MEL availability purity constraints)

If evaluation cannot be completed due to missing context (e.g., required actor meta is absent),
the action MUST be marked `{ status: 'unknown', reason: 'missing_context' }` rather than forced to false.

If evaluation cannot be completed due to expression complexity (e.g., requires runtime-only data),
the action MUST be marked `{ status: 'unknown', reason: 'indeterminate' }`.

> Implementations SHOULD use IR/AST dependency inspection (or builder-provided deps) to detect
> missing context and avoid false-negative pruning.

#### 7.4.3 Pruning Policy

Default behavior (when `pruning` is omitted):

- `policy = drop_unavailable`
- `includeUnknown = true`
- `sort = type_lex`

Rules:

- `drop_unavailable`: remove actions where `availability.status === 'unavailable'`
- `mark_only`: keep all actions, but set `availability` accordingly (debug tooling)

If `maxActions` is set, implementations MUST apply it deterministically
(e.g., after sorting, take the first N).

#### 7.4.4 Determinism and catalogHash

Action Catalog Projection MUST be deterministic.

**appliedPruningOptions** is the effective pruning configuration after applying defaults:
```typescript
const appliedPruningOptions = {
  policy: req.pruning?.policy ?? 'drop_unavailable',
  includeUnknown: req.pruning?.includeUnknown ?? true,
  sort: req.pruning?.sort ?? 'type_lex',
  maxActions: req.pruning?.maxActions ?? null
};
```

`catalogHash` **MUST** be computed as:

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

Where:

- `SHA-256` produces a lowercase hex string
- `JCS(x)` is JSON Canonicalization Scheme (RFC 8785) applied to `x`
- `actions` is the **final** list after pruning (not the input list)

**Note on `mode`:** The `mode` parameter (`'llm' | 'ui' | 'debug'`) affects which fields are included
in the output (e.g., description for LLM, label for UI), but is **NOT** included in `catalogHash`.
If implementations need mode-specific caching, they SHOULD use a composite key: `(catalogHash, mode)`.

Non-deterministic fields (timestamps, counters) MUST NOT contribute to `catalogHash`.

**Critical:** World Protocol **MUST** receive `IntentInstance`, not `IntentBody`.

#### 7.4.5 Unknown Status and Runtime Behavior

If an action with `status: 'unknown'` is subsequently invoked via Intent:

- Core runtime **MUST** evaluate the action availability predicate before executing the flow
- Authority **MAY** evaluate availability while judging a Proposal, but it is not required by this spec
- Authority and Host **MUST NOT** treat projection-time `unknown` as `unavailable`
- Unknown status is a **projection-time optimization hint**, not a final determination

This ensures that honest uncertainty at projection time does not incorrectly block valid actions.
The enforcement responsibility lies with Core runtime, not Authority.

---

## 8. System Direct Intent

System Actors **MAY** produce IntentBody directly without using a formal Projection.

### 8.1 When Direct Intent is Allowed

System direct intent is appropriate for:

- Scheduled jobs (cron, timers)
- Migration scripts
- Internal automation
- Event-driven system reactions

### 8.2 Direct Intent Rules (MUST)

| Rule | Requirement |
|------|-------------|
| SD-1 | `origin.projectionId` **MUST** indicate direct production (e.g., `system:direct`, `system:scheduler`) |
| SD-2 | `origin.source.kind` **MUST** be `'system'` |
| SD-3 | Determinism requirements still apply to the producing logic |
| SD-4 | All Intent invariants (INV-I*) apply |
| SD-5 | Projection invariants (INV-P*) do NOT apply (no Projection involved) |

### 8.3 Direct Intent Example

```typescript
// System scheduler producing an intent directly
const body: IntentBody = {
  type: 'maintenance.cleanup',
  input: { olderThanDays: 30 },
};

const instance = issuer.issue({
  schemaHash: currentSchemaHash,
  projectionId: 'system:scheduler',  // Marker for direct production
  actor: { actorId: 'scheduler', kind: 'system' },
  source: { kind: 'system', eventId: 'cron-daily-001', payload: {} },
  body,
});
```

---

## 9. Weak Interpreter Boundary

Projection is explicitly a **weak interpreter**.

> Projection **MAY** select among known actions.
> Projection **MUST NOT** invent meaning or implement domain logic.

### 9.1 Allowed Operations (MAY)

Projection MAY:

| Operation | Example |
|-----------|---------|
| Select `body.type` based on UI identifiers | `buttonId === 'btnSubmit'` → `type: 'form.submit'` |
| Gate emission on computed availability | `if (!computed.canSubmit) → none` |
| Extract input from source payload | `body.input = { title: payload.title }` |
| Perform lossless transport normalization | Ensure JSON-compatible primitives |
| Propose scope | `body.scopeProposal = { allowedPaths: ['data.todos.*'] }` |

### 9.2 Forbidden Operations (MUST NOT)

Projection MUST NOT:

| Operation | Why Forbidden |
|-----------|---------------|
| Apply domain thresholds | `if (amount > 1000)` belongs in Computed |
| Make policy decisions | "needs approval" belongs in Flow/Authority |
| Choose "best action" | Agent planning is not Projection |
| Mutate snapshots | Projection is read-only |
| Create or apply patches | Projection produces Intent, not patches |
| Execute effects | Effects are Host responsibility |
| Bypass World Protocol | All Intents go through Authority |

### 9.3 Boundary Heuristic (STRONGLY RECOMMENDED)

**If a condition could change the domain outcome, it belongs in Computed/Flow, not Projection.**

| Scenario | Belongs In | Reason |
|----------|------------|--------|
| "Is submit button enabled?" | Computed → Projection reads | Availability is domain logic |
| "If amount > 1000, need approval" | Computed/Flow | Threshold is domain logic |
| "Map button click to intent type" | Projection | Pure UI mapping |
| "Validate input format" | Schema/Computed | Validation is domain logic |

### 9.4 Examples

**✅ Allowed (Weak Interpretation):**

```typescript
// UI mapping
if (source.payload.buttonId === 'btnSubmit') {
  return { kind: 'intent', body: { type: 'form.submit', input: source.payload.data } };
}

// Gating on computed availability
if (snapshot.computed['form.canSubmit'] === false) {
  return { kind: 'none', reason: 'Submit not available' };
}
```

**❌ Forbidden (Strong Interpretation):**

```typescript
// Domain threshold in projection - WRONG
if (source.payload.amount > 1000) {
  return { kind: 'intent', body: { type: 'payment.requestApproval', ... } };
} else {
  return { kind: 'intent', body: { type: 'payment.process', ... } };
}
// This threshold belongs in Computed; Projection should read computed.requiresApproval
```

---

## 10. SnapshotView Contract

### 10.1 Read Access (MAY)

Projection MAY read:

| Field | Access |
|-------|--------|
| `snapshot.data` | ✅ Read-only |
| `snapshot.computed` | ✅ Read-only |

### 10.2 Excluded Fields

SnapshotView intentionally excludes:

| Field | Reason |
|-------|--------|
| `meta.version` | Would break determinism across versions |
| `meta.timestamp` | Non-deterministic |
| `meta.schemaHash` | Passed separately in ProjectionRequest |
| `system.*` | Internal state, not for Projection |
| `input` | Transient effect input |

### 10.3 UI State Guidance

If a UI needs loading/error states:

| Need | Solution |
|------|----------|
| Loading indicator | Express via computed value derived from state |
| Error display | Express via explicit field in `data` (schema-defined) |
| Availability | Read from `computed` |

Do NOT rely on implicit meta fields.

---

## 11. Determinism Requirements

### 11.1 Projection Determinism (MUST)

Projection **MUST** be deterministic with respect to IntentBody.

Given identical inputs:

| Input | Must Be Same |
|-------|--------------|
| `schemaHash` | ✅ |
| `snapshot.data` | ✅ |
| `snapshot.computed` | ✅ |
| `actor` | ✅ |
| `source.kind` | ✅ |
| `source.eventId` | ✅ |
| `source.payload` | ✅ |

Projection **MUST** output identical:

| Output | Must Be Same |
|--------|--------------|
| `ProjectionResult.kind` | ✅ |
| `IntentBody.type` | ✅ (if intent) |
| `IntentBody.input` | ✅ (if intent) |
| `IntentBody.scopeProposal` | ✅ (if intent) |

### 11.2 Issuer Determinism (MUST)

Issuer **MUST** be deterministic for:

| Output | Deterministic? |
|--------|----------------|
| `intentKey` | ✅ MUST (fixed algorithm) |
| `meta.origin` | ✅ MUST (based on inputs) |
| `intentId` | ❌ Intentionally unique |

### 11.3 Non-Deterministic Inputs (MUST NOT)

Projection **MUST NOT** depend on:

| Input | Why Forbidden |
|-------|---------------|
| Wall-clock time | Non-deterministic |
| Random numbers | Non-deterministic |
| Network state | External dependency |
| Global mutable state | Side-effect |
| `source.occurredAt` | Timestamp |

If time-based behavior is needed, it **MUST** be:

- A field in `source.payload` (supplied externally), or
- A field in `snapshot.data` (schema-defined domain state)

---

## 12. Projection Recording

Projection outputs **SHOULD** be recorded for debugging, replay, and audit.

### 12.1 Recording Guidance

| Result Type | Recording |
|-------------|-----------|
| `intent` | **SHOULD** record |
| `none` with reason | **SHOULD** record (debuggability) |
| `none` without reason | **MAY** omit (noise reduction) |

### 12.2 ProjectionRecord Structure

```typescript
type ProjectionRecord = {
  readonly recordId: string;        // Unique record identifier
  readonly createdAt: number;       // Timestamp (non-deterministic OK)
  readonly projectionId: string;    // Which projection
  readonly actor: ActorRef;         // Who acted
  readonly source: SourceEvent;     // What triggered
  readonly snapshotVersion?: number; // Optional: snapshot reference
  readonly result: ProjectionResult; // What was produced
  readonly intentId?: string;       // If issued
  readonly intentKey?: string;      // If issued
};
```

### 12.3 Storage Location (MAY)

ProjectionRecords MAY be stored:

- In World Protocol storage (recommended for audit)
- In a dedicated logging system
- In `snapshot.system.*` namespace (if schema supports it)

Recording **MUST NOT** mutate semantic state.

---

## 13. Scope Proposal & Approval

### 13.1 Scope Flow Overview

```
Projection → scopeProposal (optional)
     ↓
IntentInstance.body.scopeProposal
     ↓
World Protocol Proposal
     ↓
Authority → approvedScope
     ↓
DecisionRecord.approvedScope
     ↓
Host execution (may enforce or ignore per trust model)
```

### 13.2 Scope Proposal (Projection)

- Projection **MAY** set `body.scopeProposal`
- Scope proposal is a **suggestion**, not a guarantee
- Projection **SHOULD** propose the narrowest scope needed

### 13.3 Scope Approval (Authority)

Authority decides the approved scope:

| Decision | approvedScope Value |
|----------|---------------------|
| Approve as proposed | Copy of `scopeProposal` |
| Approve with modification | Modified scope |
| Approve without scope | `null` (no restriction) |
| Reject | N/A (proposal rejected) |

### 13.4 World Protocol Integration

Scope is carried through the Proposal lifecycle:

```typescript
// Proposal carries intent (which contains scopeProposal in body)
type Proposal = {
  readonly intent: IntentInstance;  // body.scopeProposal is here
  approvedScope?: IntentScope | null; // Set by Authority
  // ... other fields per World Protocol Spec
};

// DecisionRecord includes approved scope
type DecisionRecord = {
  readonly approvedScope?: IntentScope | null; // MUST be set if approved
  // ... other fields per World Protocol Spec
};
```

**Note:** `scopeProposal` is NOT duplicated in Proposal; it is read from `intent.body.scopeProposal`.

### 13.5 Scope Enforcement (v1.0)

| Model | Behavior |
|-------|----------|
| Trusted Host | Host MAY ignore approvedScope |
| Enforcing Host | Host MUST validate patches against approvedScope |

v1.0 does not mandate enforcement. Regardless of enforcement:

- Approval flow **MUST** be followed
- `approvedScope` **MUST** be recorded in DecisionRecord

---

## 14. Integration with World Protocol & Host

### 14.1 End-to-End Pipeline

```
┌─────────────┐
│ SourceEvent │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│ Projection  │────►│ IntentBody  │
└─────────────┘     └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Issuer    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌──────────────┐
                    │IntentInstance│
                    │ (id + key +  │
                    │  body + meta)│
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │World Protocol│
                    │  (Proposal)  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Authority   │
                    │  (Decision)  │
                    └──────┬───────┘
                           │ approved
                           ▼
                    ┌──────────────┐
                    │    Host      │
                    │ (Execution)  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  New World   │
                    └──────────────┘
```

### 14.2 Layer Responsibilities

| Layer | Input | Output | Responsibility |
|-------|-------|--------|----------------|
| Projection | SourceEvent + SnapshotView | IntentBody | Select and shape |
| Issuer | IntentBody | IntentInstance | Add identity |
| World Protocol | IntentInstance | Proposal | Wrap for governance |
| Authority | Proposal | DecisionRecord | Judge legitimacy |
| Host | Approved Proposal | Snapshot | Execute |
| World Protocol | Snapshot | World | Record history |

### 14.3 Host Execution and intentId Stability

During a single Host execution loop for an approved Proposal:

- Host **MUST** use the **same IntentInstance** throughout
- Host **MAY** call Core `compute()` multiple times (for effects)
- The `intentId` remains **stable** across all compute calls in that loop
- **No new Intent is created** during execution

This is the meaning of "intentId stability during execution": it is **continuation of the same attempt**, not re-issuance.

### 14.4 World Protocol Type Alignment

World Protocol **MUST** use `IntentInstance` as defined in this spec:

```typescript
// World Protocol Proposal (per World Protocol Spec)
type Proposal = {
  readonly proposalId: ProposalId;
  readonly actor: ActorRef;
  readonly intent: IntentInstance;  // THIS SPEC'S TYPE
  readonly baseWorld: WorldId;
  readonly trace?: ProposalTrace;
  readonly submittedAt: number;
  
  status: ProposalStatus;
  approvedScope?: IntentScope | null;  // Set by Authority
  // ... other fields
};
```

---

## 15. Bridge Compatibility (Informative)

This section is **informative** (non-normative guidance).

### 15.1 Two-Way Binding Model

Bridge packages preserve familiar FE DX:

| Direction | Mechanism |
|-----------|-----------|
| Domain → UI | `subscribe(snapshot)` |
| UI → Domain | `dispatch(intent)` |

### 15.2 Recommended Bridge API

```typescript
interface Bridge {
  // Read current state
  subscribe(callback: (snapshot: SnapshotView) => void): Unsubscribe;
  get(path: string): unknown;
  
  // Dispatch intent (bridge acts as issuer internally)
  dispatch(body: IntentBody): Promise<void>;

  // Optional: state-dependent tool / command catalog
  // (See §7.4 Action Catalog Projection)
  projectActionCatalog?(req: ActionCatalogProjectionRequest): ActionCatalog;
  
  // Convenience: sugar for common patterns
  set(path: string, value: unknown): Promise<void>;
  // Equivalent to: dispatch({ type: 'field.set', input: { path, value } })
}
```

### 15.3 Dispatch Flow

1. Application calls `bridge.dispatch(body)`
2. Bridge internally issues IntentInstance (adds intentId, intentKey, origin)
3. Bridge submits IntentInstance to World Protocol
4. World Protocol handles approval and execution

### 15.4 Intent Type Convention

The specific Intent types (`field.set`, `form.submit`, etc.) are **schema-defined**, not protocol-defined.

### 15.5 Action Catalog Fallback (Optional Method)

If `projectActionCatalog` is not implemented:

- LLM runtimes **SHOULD** fall back to schema-defined static action list
- LLM runtimes **MUST NOT** fail; instead, treat all actions as `available`
- UI runtimes **MAY** omit availability-based rendering

```typescript
// Recommended LLM runtime fallback pattern
const catalog = bridge.projectActionCatalog?.(req) 
  ?? staticCatalogFromSchema(schema, { allAvailable: true });
```

This enables progressive enhancement: simple implementations can omit Action Catalog initially,
and LLM runtimes will still function (with reduced optimization).

---

## 16. Invariants

### 16.1 Intent Invariants (MUST ALWAYS HOLD)

| ID | Invariant |
|----|-----------|
| INV-I1 | Every IntentInstance has immutable `body`, `intentId`, `intentKey`, and `meta` |
| INV-I2 | `intentKey` MUST be computed using §6.2.1 algorithm |
| INV-I3 | `meta.origin` MUST NOT affect `intentKey` |
| INV-I4 | Retry creates new `intentId` but preserves `intentKey` if body is identical |
| INV-I5 | `intentId` remains stable throughout a single Host execution loop |

### 16.2 Projection Invariants (MUST ALWAYS HOLD)

| ID | Invariant |
|----|-----------|
| INV-P1 | Projection never patches, applies, or executes effects |
| INV-P2 | Projection is deterministic for IntentBody |
| INV-P3 | Projection reads SnapshotView (data + computed) read-only |
| INV-P4 | Projection is weak interpreter only (selection, not domain logic) |
| INV-P5 | Projection MUST NOT depend on non-deterministic inputs |
| INV-P6 | Any auxiliary projection (e.g., Action Catalog Projection) MUST be deterministic and MUST NOT invent actions |

### 16.3 Issuer Invariants (MUST ALWAYS HOLD)

| ID | Invariant |
|----|-----------|
| INV-IS1 | Issuer generates unique `intentId` per issuance |
| INV-IS2 | Issuer computes `intentKey` using §6.2.1 algorithm |
| INV-IS3 | Issuer MUST NOT modify `body` content |
| INV-IS4 | Issued IntentInstance is immutable |

### 16.4 System Direct Intent Invariants

| ID | Invariant |
|----|-----------|
| INV-SD1 | System direct intent MUST have `origin.projectionId` indicating direct production |
| INV-SD2 | System direct intent MUST have `origin.source.kind === 'system'` |
| INV-SD3 | All Intent invariants (INV-I*) apply to system direct intents |

### 16.5 Action Catalog Invariants (v1.1)

| ID | Invariant |
|----|-----------|
| INV-AC1 | Action Catalog Projection MUST be deterministic |
| INV-AC2 | `catalogHash` MUST be computed using §7.4.4 algorithm |
| INV-AC3 | Action Catalog is NOT a security boundary; final enforcement is outside projection (Authority governance + Core runtime validation) |
| INV-AC4 | Availability predicates MUST be pure functions (no time, network, $system.*, $input.*, effects) |
| INV-AC5 | Unknown availability MUST NOT be treated as unavailable; Core runtime evaluates at execution |

---

## 17. Explicit Non-Goals

This specification does **NOT** define:

| Non-Goal | Reason |
|----------|--------|
| Authentication / security | Orthogonal concern |
| Prompt/tool pruning as a security boundary | Pruning is UX/cost/hallucination mitigation; enforcement belongs to Authority/Core |
| Authority policy logic | Defined by World Protocol |
| Patch semantics | Defined by Schema Spec |
| Effect execution | Defined by Host Contract |
| UI framework specifics | Implementation detail |
| Scope enforcement mechanism | v1.0 defers to host trust model |
| Agent planning / reasoning | Application layer |
| MEL/ExpressionIR structure | Defined by Compiler Spec |

---

## Appendix A: Quick Reference

### A.1 Type Summary

```typescript
// Body: Semantic content (what Projection produces)
type IntentBody = {
  readonly type: string;
  readonly input?: unknown;
  readonly scopeProposal?: IntentScope;
};

// Meta: Non-semantic metadata
type IntentMeta = {
  readonly origin: IntentOrigin;
};

// Instance: Complete intent (what World Protocol receives)
type IntentInstance = {
  readonly body: IntentBody;
  readonly intentId: string;
  readonly intentKey: string;
  readonly meta: IntentMeta;
};

// Scope
type IntentScope = {
  readonly allowedPaths?: string[];
  readonly note?: string;
};

// Origin
type IntentOrigin = {
  readonly projectionId: string;
  readonly source: { kind: SourceKind; eventId: string };
  readonly actor: ActorRef;
  readonly note?: string;
};

// Action Catalog (v1.1)
type ActionCatalog = {
  readonly kind: 'action_catalog';
  readonly schemaHash: string;
  readonly catalogHash: string;
  readonly actions: readonly ProjectedAction[];
};
```

### A.2 intentKey Algorithm

```
intentKey = SHA-256(
  schemaHash + ":" +
  body.type + ":" +
  JCS(body.input ?? null) + ":" +
  JCS(body.scopeProposal ?? null)
)
```

### A.3 catalogHash Algorithm (v1.1)

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

### A.4 Key Invariants Summary

| Category | Key Rule |
|----------|----------|
| Intent | Immutable, dual identity (id + key) |
| Projection | Deterministic, weak interpreter, read-only |
| Issuer | Adds identity, doesn't modify body |
| Scope | Proposed by Projection, approved by Authority |
| Action Catalog | Deterministic, NOT security boundary, pure predicates (no $input) |

---

## Appendix B: Cross-Reference

### B.1 Related Specifications

| Spec | Relationship |
|------|--------------|
| World Protocol Spec | Uses `IntentInstance` in Proposal |
| Host Contract | Executes approved Intents |
| Schema Spec | Defines domain types and validation |
| Compiler Spec | Defines ExpressionIR structure for availability predicates |

### B.2 World Protocol Alignment

This spec defines Intent types that World Protocol MUST use:

- `Proposal.intent` is `IntentInstance`
- `scopeProposal` is in `intent.body.scopeProposal`
- `approvedScope` is set by Authority, stored in DecisionRecord

### B.3 Compiler Spec Alignment (v1.1)

This spec references Compiler types:

- `ExpressionIR` for availability predicates is the compiler output ExprNode
- Purity constraints for availability evaluation follow MEL availability purity rules
- See manifesto-ai-compiler SPEC §7 (IR Mapping) for structure details

---

*End of Manifesto Intent & Projection Specification v1.1*

---
