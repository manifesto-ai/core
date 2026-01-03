

# Host Contract — Foundational Design Rationale (FDR)

> **Version:** 1.0
> **Status:** Normative
> **Purpose:** Document the "Why" behind every constitutional decision in the Host Contract

---

## Overview

This document records the foundational design decisions that shape the Host Contract.

Each FDR entry follows the format:

- **Decision**: What was decided
- **Context**: Why this decision was needed
- **Rationale**: The reasoning behind the choice
- **Alternatives Rejected**: Other options considered and why they were rejected
- **Consequences**: What this decision enables and constrains

---

## FDR-H001: Absolute Core-Host Boundary

### Decision

The boundary between Core and Host is absolute and non-negotiable.

```
Core computes meaning.
Host executes reality.
```

### Context

Systems that mix semantic computation with execution become unpredictable, hard to test, and impossible to reason about formally.

### Rationale

| Concern | Why Separation Matters |
|---------|------------------------|
| **Testability** | Core can be tested without mocks, network, or IO |
| **Portability** | Same Core runs in browser, server, CLI, agent |
| **Determinism** | Pure computation guarantees same input → same output |
| **Auditability** | Every state change is traceable through explicit patches |
| **Replayability** | Recorded intents can reproduce exact computation |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Core executes effects directly | Breaks purity, introduces non-determinism |
| Host interprets Flow semantics | Duplicates logic, creates inconsistencies |
| Hybrid model (Core does "safe" IO) | No clear boundary, slippery slope |

### Consequences

- Host MUST handle all IO, network, persistence
- Core MUST remain pure (no side effects)
- Testing is dramatically simplified
- Cross-platform portability is guaranteed

---

## FDR-H002: Snapshot as Sole Communication Channel

### Decision

Snapshot is the **only** valid communication channel between Core and Host.

There are no return values, no callbacks, no events, no context passing.

### Context

Traditional systems use multiple channels:
- Function return values
- Callbacks
- Events
- Shared mutable state
- Context objects

This creates hidden dependencies and makes reasoning impossible.

### Rationale

**Single source of truth eliminates hidden state.**

```
// FORBIDDEN: Effect result as return value
const result = await executeEffect();
core.resume(result);  // Hidden state!

// REQUIRED: Effect result as Snapshot mutation
const patches = await executeEffect();
const context = { now: 0, randomSeed: "seed" };
snapshot = core.apply(schema, snapshot, patches, context);
await core.compute(schema, snapshot, intent, context);  // All state visible
```

| Benefit | Description |
|---------|-------------|
| **Complete visibility** | All state is in one place |
| **Serializable** | Entire world can be saved/restored |
| **Debuggable** | Inspect Snapshot at any point |
| **Replayable** | Reproduce any state by replaying patches |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Return values from effects | Creates hidden execution context |
| Event-based communication | Non-deterministic ordering |
| Context injection | Hidden dependencies, hard to trace |
| Shared mutable state | Race conditions, non-reproducible |

### Consequences

- Effect handlers return Patch[], not values
- All "state" is visible in Snapshot
- No hidden execution context exists
- Complete auditability

---

## FDR-H003: No Resume, No Continuation

### Decision

There is no `resume()` API. Each `compute()` call is complete and independent.

### Context

Traditional effect systems use continuations:

```typescript
// Traditional continuation model
const continuation = core.computeUntilEffect(snapshot, intent);
const result = await executeEffect(continuation.effect);
core.resume(continuation, result);  // Suspended context
```

This implies a **suspended execution context** that must be maintained.

### Rationale

**Suspended execution context is hidden state.**

If there's a continuation waiting to be resumed:
- Where is it stored?
- What happens if Host crashes?
- How do you serialize it?
- How do you replay it?

**The Manifesto answer: There is no suspended context.**

```typescript
// Manifesto model
const context = { now: 0, randomSeed: "seed" };
result = compute(schema, snapshot, intent, context);  // Terminates
// ... effect execution, patch application ...
result = compute(schema, snapshot, intent, context);  // Fresh evaluation
```

Each `compute()` evaluates the Flow from the beginning. The Flow checks Snapshot state to determine what to do.

| Benefit | Description |
|---------|-------------|
| **Crash recovery** | No continuation to lose |
| **Serializable** | Only need to persist Snapshot |
| **Debuggable** | No hidden execution stack |
| **Portable** | No continuation serialization needed |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Continuation-passing style | Hidden state, serialization complexity |
| Coroutines/generators | Platform-dependent, hard to persist |
| Event sourcing with suspended state | Still requires continuation storage |

### Consequences

- **Flows MUST be re-entrant** (evaluated multiple times safely)
- All progress state MUST be in Snapshot
- Host loop is simple: compute → execute → apply → compute
- No special "resume" logic needed

---

## FDR-H004: Flow Re-Entry as Constitutional Requirement

### Decision

**Flows MUST be re-entrant under repeated `compute()` calls for the same Intent.**

This is not a recommendation. It is a constitutional requirement.

### Context

Given FDR-H003 (no resume), the same Flow will be evaluated multiple times for a single user action:

1. First `compute()`: Flow runs until effect, returns `pending`
2. Host executes effect, applies patches
3. Second `compute()`: Flow runs **from the beginning**

If the Flow is not re-entrant, step 3 will duplicate the work from step 1.

### Rationale

**Re-entry safety is the contract between Host semantics and Flow design.**

The Host Contract mandates re-invocation. Therefore, Flow design MUST accommodate this.

### The State-Guarded Pattern

The canonical solution is **state-guarded** steps:

```json
{
  "kind": "if",
  "cond": { "kind": "not", "arg": { "kind": "get", "path": "item.exists" } },
  "then": { "kind": "patch", "..." : "..." }
}
```

This is not optional. **State-guarding is MUST for Host compatibility.**

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Idempotent patches only | Too restrictive, many operations aren't naturally idempotent |
| Flow position tracking | Reintroduces hidden state, violates FDR-H003 |
| Different intent for continuation | Complicates Host, breaks intent identity |

### Consequences

- Flow authors MUST design for re-entry
- Patches MUST be guarded by state conditions
- Effects MUST be guarded to prevent duplicate execution
- Progress is tracked via Snapshot data, not execution position

---

## FDR-H005: Effect Handlers Never Throw

### Decision

Effect handlers MUST return `Patch[]` and MUST NOT throw exceptions.

### Context

Traditional effect handlers throw on failure:

```typescript
// Traditional
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/users/${id}`);
  if (!response.ok) throw new Error('Not found');
  return response.json();
}
```

This creates control flow outside the Snapshot model.

### Rationale

**Exceptions are hidden control flow.**

If an effect throws:
- How does the Flow know what happened?
- What state is the system in?
- How do you replay this?

**The Manifesto answer: Failures are values in Snapshot.**

```typescript
// Manifesto
async function fetchUserHandler(type: string, params: any): Promise<Patch[]> {
  try {
    const response = await fetch(`/users/${params.id}`);
    const user = await response.json();
    return [
      { op: 'set', path: `users.${params.id}`, value: user },
      { op: 'set', path: 'system.lastError', value: null }
    ];
  } catch (error) {
    return [
      { op: 'set', path: 'system.lastError', value: {
        code: 'FETCH_ERROR',
        message: error.message
      }}
    ];
  }
}
```

Now the Flow can check `system.lastError` and branch accordingly.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Throw on failure | Hidden control flow, not in Snapshot |
| Result<T, E> return type | More complex, still needs patch conversion |
| Error events | Violates single-channel (Snapshot only) |

### Consequences

- All effect outcomes are Patch[]
- Failures are data, not exceptions
- Flow can handle errors via state conditions
- Host loop is simple (no try/catch complexity)

---

## FDR-H006: Intent Identity (intentId)

### Decision

Every Intent MUST carry a stable `intentId` that uniquely identifies a processing attempt.

### Context

Without intent identity:
- How do we distinguish "re-entry" from "new request"?
- How do we correlate Requirements to their originating action?
- How do we implement at-most-once semantics?

### Rationale

**IntentId creates a stable reference for a processing attempt.**

```
User clicks "Save"
  → Generate intentId: "abc-123"
  → compute(snapshot, { type: 'save', intentId: 'abc-123' }, context)
  → Effect required, pending
  → Execute effect
  → compute(snapshot, { type: 'save', intentId: 'abc-123' }, context)  // Same intentId!
  → Complete

User clicks "Save" again
  → Generate intentId: "def-456"  // New intentId!
  → compute(snapshot, { type: 'save', intentId: 'def-456' }, context)
```

| Use Case | How IntentId Helps |
|----------|-------------------|
| Re-entry detection | Same intentId = continuation, new intentId = fresh |
| Requirement correlation | requirementId derived from intentId |
| Deduplication | Same intentId + same state = skip |
| Audit trail | All computations linked to originating action |
| Replay | Reproduce exact sequence of intents |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| No identity (stateless) | Cannot distinguish re-entry from new request |
| Timestamp-based | Not unique enough, clock issues |
| Implicit from input | Same input might be intentional re-submission |

### Consequences

- Host MUST generate unique intentId per user action
- Host MUST preserve intentId across re-invocations
- Requirement.id can be derived from intentId
- Audit logs can trace full intent lifecycle

---

## FDR-H007: Deterministic Requirement Identity

### Decision

Requirement `id` SHOULD be deterministic: `hash(schemaHash, intentId, actionId, flowNodePath)`.

### Context

Requirements need stable identity for:
- Deduplication (don't execute same effect twice)
- Replay verification (same intent produces same requirements)
- At-most-once semantics

### Rationale

**Deterministic identity enables deduplication without external coordination.**

If requirementId is computed from:
- schemaHash: Different schema = different requirement
- intentId: Different intent = different requirement
- actionId: Different action = different requirement
- flowNodePath: Different effect node = different requirement

Then the **same effect for the same intent will always have the same requirementId**.

```typescript
// Example
const requirementId = hash(
  schema.hash,           // "sha256:abc..."
  intent.intentId,       // "550e8400-..."
  action.id,             // "addTodo"
  flowNode.path          // "steps.1.then"
);
// Always produces same ID for same computation
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Random UUID | Cannot deduplicate, cannot verify replay |
| Sequence number | Requires global state, not deterministic |
| Timestamp-based | Clock skew issues, not reproducible |

### Consequences

- Same computation always produces same requirementId
- Deduplication is trivial: check if already processed
- Replay verification: expected requirements must match
- No external coordination needed

---

## FDR-H008: Single-Writer Concurrency

### Decision

Intent processing MUST be serialized per Snapshot lineage. No concurrent `compute()` on same Snapshot version.

### Context

What happens if two Hosts (or threads) call `compute()` on the same Snapshot simultaneously?

- Both read version N
- Both produce patches
- Both try to apply
- Result: Conflict, lost updates, inconsistent state

### Rationale

**Determinism requires serialization.**

Manifesto guarantees:
> Given the same DomainSchema, Snapshot, and Intent, Core computation is deterministic and reproducible.

This guarantee is void if concurrent modifications occur.

| Model | Determinism | Complexity |
|-------|-------------|------------|
| Single-writer | ✅ Guaranteed | Simple |
| Optimistic locking | ❓ Requires retry | Medium |
| CRDT/merge | ❓ Depends on merge | Complex |

For v1.0, single-writer is the only compliant model.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Optimistic locking | Retries break determinism without careful design |
| CRDTs | Requires semantic-aware merge, out of scope for v1 |
| Last-write-wins | Loses updates, non-deterministic |

### Consequences

- One intent at a time per Snapshot lineage
- Host MUST serialize intent processing
- Simple reasoning, guaranteed determinism
- Future versions MAY relax with explicit merge semantics

---

## FDR-H009: Core-Owned Versioning

### Decision

Core is exclusively responsible for `snapshot.meta.version` and `snapshot.meta.timestamp`.

Host MUST NOT modify these fields.

### Context

If Host can modify version:
- Version can be reset (breaks monotonicity)
- Version can skip (breaks gaplessness)
- Two Hosts might assign same version (breaks uniqueness)

### Rationale

**Version is the foundation of ordering and causality.**

| Property | Why It Matters |
|----------|---------------|
| Monotonic | Later is always > earlier |
| Gapless | No missing history |
| Single source | No conflicts |

Core controls `apply()`, which is the only state mutation path. Therefore, Core should control versioning.

```typescript
// Inside Core.apply()
function apply(schema, snapshot, patches, context) {
  const newSnapshot = applyPatches(snapshot, patches);
  return {
    ...newSnapshot,
    meta: {
      ...newSnapshot.meta,
      version: snapshot.meta.version + 1,  // Core increments
      timestamp: context.now,               // Core sets from HostContext
      randomSeed: context.randomSeed
    }
  };
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Host assigns version | Risk of conflicts, resets, gaps |
| Vector clocks | More complex, needed only for distributed case |
| No versioning | Cannot order or replay |

### Consequences

- Version always increases by exactly 1 per `apply()`
- Timestamp reflects actual mutation time
- History is gapless and monotonic
- Replay can verify version sequence

---

## FDR-H010: Requirement Clearing Obligation

### Decision

Host MUST clear fulfilled Requirements before re-invoking `compute()`.

### Context

After effect execution, `pendingRequirements` still contains the fulfilled Requirement.

If not cleared:
- Next `compute()` sees same Requirement
- Host might re-execute same effect
- Infinite loop possible

### Rationale

**The consumption contract: read → execute → clear → continue.**

```
snapshot.system.pendingRequirements = [{ id: 'req-1', type: 'api:create' }]
                ↓
        Host reads req-1
                ↓
        Host executes api:create
                ↓
        Host applies result patches
                ↓
        Host clears req-1  ← CRITICAL
                ↓
snapshot.system.pendingRequirements = []
                ↓
        Host calls compute()
```

Without the clear step, the system cannot make progress.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Core auto-clears on next compute | Implicit, hard to debug |
| Never clear (idempotent requirements) | Most effects aren't idempotent |
| Separate "consumed" flag | Extra complexity, still needs management |

### Consequences

- Host MUST explicitly clear requirements
- Clearing is done via `apply()` (consistent with all mutations)
- Clear can be per-requirement or all-at-once
- Unfulfilled requirements MUST still be cleared (with failure patches)

---

## FDR-H011: Effect Handler Domain Logic Prohibition

### Decision

Effect handlers MUST NOT contain domain logic. All domain decisions belong in Flow or Computed.

### Context

It's tempting to put business logic in handlers:

```typescript
// WRONG: Domain logic in handler
async function purchaseHandler(type, params) {
  if (params.amount > 1000) {  // Business rule!
    return [{ op: 'set', path: 'approval.required', value: true }];
  }
  // ...
}
```

This is forbidden.

### Rationale

**Domain logic must be explainable and traceable.**

| Concern | Flow/Computed | Effect Handler |
|---------|---------------|----------------|
| Traceable | ✅ In Trace | ❌ Invisible |
| Explainable | ✅ Via Explain | ❌ Black box |
| Testable | ✅ Pure | ❓ Requires mocks |
| Replayable | ✅ Deterministic | ❌ May vary |

If domain logic is in handlers:
- Trace doesn't show it
- Explain can't explain it
- Tests require complex mocks
- Replay may diverge

### The Correct Pattern

```typescript
// CORRECT: Domain logic in Flow
{
  "kind": "if",
  "cond": { "kind": "gt", 
    "left": { "kind": "get", "path": "order.amount" },
    "right": { "kind": "lit", "value": 1000 }
  },
  "then": { "kind": "patch", "op": "set", "path": "approval.required", "value": true },
  "else": { "kind": "effect", "type": "payment:process", "params": { "...": "..." } }
}

// Handler just does IO
async function paymentHandler(type, params) {
  await paymentGateway.charge(params.amount);
  return [{ op: 'set', path: 'payment.status', value: 'completed' }];
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Allow "simple" logic in handlers | Slippery slope, no clear boundary |
| Trace handlers separately | Duplicates tracing, complex |

### Consequences

- Handlers are pure IO adapters
- All business rules in Flow/Computed
- Complete traceability
- Handler testing is simple (just IO)

---

## Summary Table

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| H001 | Absolute Core-Host boundary | Compute ≠ Execute |
| H002 | Snapshot as sole channel | No hidden state |
| H003 | No resume/continuation | No suspended context |
| H004 | Flow re-entry requirement | State-guarded is MUST |
| H005 | Handlers never throw | Errors are values |
| H006 | Intent identity (intentId) | Stable processing reference |
| H007 | Deterministic requirement ID | Content-addressable effects |
| H008 | Single-writer concurrency | Determinism over parallelism |
| H009 | Core-owned versioning | Single source of version truth |
| H010 | Requirement clearing | Explicit consumption contract |
| H011 | No domain logic in handlers | IO only, logic in Flow |

---

## Cross-Reference: Schema Spec FDR

The following Schema Spec FDRs are foundational to Host Contract:

| Schema FDR | Relevance to Host Contract |
|------------|---------------------------|
| FDR-001 (Core as Calculator) | Foundation of Core-Host boundary |
| FDR-002 (Snapshot as Only Medium) | Foundation of single-channel communication |
| FDR-003 (No Pause/Resume) | Foundation of re-entry model |
| FDR-004 (Effects as Declarations) | Foundation of handler contract |
| FDR-005 (Errors as Values) | Foundation of no-throw handlers |

---

*End of Host Contract FDR*
