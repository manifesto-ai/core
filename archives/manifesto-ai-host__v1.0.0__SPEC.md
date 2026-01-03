# Manifesto Host Contract Specification v1.0

> **Status:** Draft
> **Scope:** Normative
> **Authors:** eggplantiny
> **Applies to:** All Manifesto Hosts
> **License:** MIT

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Definitions](#2-definitions)
3. [Core–Host Boundary](#3-corehost-boundary)
4. [Host Obligations (MUST)](#4-host-obligations-must)
5. [Host Prohibitions (MUST NOT)](#5-host-prohibitions-must-not)
6. [Flow Re-Entry Contract](#6-flow-re-entry-contract)
7. [Effect Handler Contract](#7-effect-handler-contract)
8. [Requirement Lifecycle](#8-requirement-lifecycle)
9. [Intent Identity](#9-intent-identity)
10. [Concurrency Model](#10-concurrency-model)
11. [Versioning and Timestamps](#11-versioning-and-timestamps)
12. [Schema Validation](#12-schema-validation)
13. [Normative Host Loop](#13-normative-host-loop)
14. [Host Policy Freedom (MAY)](#14-host-policy-freedom-may)
15. [Explicit Non-Goals](#15-explicit-non-goals)
16. [Compliance Statement](#16-compliance-statement)

---

## 1. Purpose

This document defines the **Host Contract** for Manifesto.

The Host Contract specifies the **mandatory responsibilities**, **forbidden behaviors**, and **interaction protocol** that any external system (**Host**) MUST follow in order to safely and correctly operate a Manifesto Core.

This document is **normative**.

Any system claiming compatibility with Manifesto Core **MUST** conform to this contract.

---

## 2. Definitions

### 2.1 Core

**Core** refers to the Manifesto Core semantic calculator, responsible for:

- Evaluating Flows
- Computing derived values
- Producing Snapshots, Requirements, and Traces

Core is **pure** and **side-effect free**.

### 2.2 Host

A **Host** is any external system that:

- Calls `compute()` on Core
- Executes declared effects
- Persists and manages Snapshots
- Controls execution flow and policy

A Host is a **role**, not a product.

Examples include (but are not limited to):

- Web servers
- Browsers
- CLI applications
- Agent loops
- Simulators
- Test harnesses

### 2.3 Snapshot

A **Snapshot** is an immutable, point-in-time representation of world state.

> **Snapshot is the only medium of communication between Core and Host.**

There are no other valid channels.

### 2.4 Intent

An **Intent** is a request to perform an action, consisting of:

- `type`: Action identifier
- `input`: Action parameters (optional)
- `intentId`: Unique identifier for this processing attempt

### 2.5 Requirement

A **Requirement** is a recorded effect declaration waiting for Host fulfillment.

### 2.6 HostContext

**HostContext** provides host-supplied inputs for Core computation
(deterministic if the Host supplies deterministic values):

- `now`: Logical time provided by Host
- `randomSeed`: Deterministic seed for this intent execution
- `env`: Optional environment metadata
- `durationMs`: Optional measured compute duration

**Reference Host Defaults (Non-normative):**
- If no `now` provider is supplied, `@manifesto-ai/host` uses `Date.now()`.
- If no `randomSeed` provider is supplied, it uses `intent.intentId` computed once per intent
  and re-used across re-entries.
- For initial snapshot creation, `@manifesto-ai/host` uses `randomSeed: "initial"`.
- For reproducible traces and replays, Hosts SHOULD supply deterministic `now`/`randomSeed`.

---

## 3. Core–Host Boundary

The boundary between Core and Host is **absolute**.

> **Core computes meaning.**
> **Host executes reality.**

### 3.1 Responsibility Matrix

| Concern | Core | Host |
|---------|------|------|
| Semantic computation | ✅ | ❌ |
| Expression evaluation | ✅ | ❌ |
| Flow interpretation | ✅ | ❌ |
| Trace generation | ✅ | ❌ |
| Effect execution | ❌ | ✅ |
| IO / Network | ❌ | ✅ |
| State mutation | ❌ | ✅ (via apply only) |
| Loop control | ❌ | ✅ |
| Persistence | ❌ | ✅ |
| Policy decisions | ❌ | ✅ |
| Version/Timestamp management | ✅ | ❌ |
| Host context inputs (now/randomSeed) | ❌ | ✅ |

---

## 4. Host Obligations (MUST)

A compliant Host **MUST** satisfy all requirements in this section.

### 4.1 Compute Invocation

The Host **MUST** invoke Core computation exclusively via:

```typescript
compute(
  schema: DomainSchema,
  snapshot: Snapshot,
  intent: Intent,
  context: HostContext
): ComputeResult
```

- Host **MUST NOT** partially evaluate, skip, or short-circuit Core logic.
- Host **MUST NOT** attempt to infer outcomes without calling `compute()`.
- Host **MUST** provide a valid `intentId` with each Intent.
- Host **MUST** provide a HostContext for every compute call.

### 4.2 State Mutation

The Host **MUST** mutate state **only** by applying patches via:

```typescript
apply(
  schema: DomainSchema,
  snapshot: Snapshot,
  patches: Patch[],
  context: HostContext
): Snapshot
```

- Host **MUST NOT** mutate Snapshot directly.
- Host **MUST NOT** infer diffs or modify Snapshot implicitly.
- Host **MUST NOT** modify Snapshot metadata directly.
- Host **MUST** supply HostContext for every apply call.

### 4.3 Re-Invocation After Effect

After fulfilling Requirements and applying result patches:

- Host **MUST** re-invoke `compute()` with the **same Intent** (same `intentId`).
- Host **MUST** keep `context.randomSeed` stable across re-invocations for the same intent.
- Host **MUST** clear fulfilled Requirements before re-invocation.

There is **no resume**. There is **no continuation**.

Each `compute()` call is **complete and independent**.

All continuity is carried **only by Snapshot**.

---

## 5. Host Prohibitions (MUST NOT)

A Host **MUST NOT** perform any of the following actions.

### 5.1 Direct Snapshot Mutation

```typescript
// FORBIDDEN
snapshot.data.x = 1;
snapshot.meta.version = 5;
```

All state changes **MUST** go through `apply()`.

### 5.2 Value Passing Outside Snapshot

A Host **MUST NOT**:

- Pass effect results as return values to Core
- Inject side-channel data into Core
- Maintain hidden execution context
- Store continuation state outside Snapshot

```typescript
// FORBIDDEN
const result = await executeEffect();
await core.compute(schema, snapshot, { ...intent, injectedResult: result }, context);
```

All information **MUST** be written to Snapshot via patches.

### 5.3 Execution Interpretation

A Host **MUST NOT**:

- Guess what Core "would do next"
- Skip `compute()` calls
- Reorder or reinterpret Flow semantics
- Modify pending Requirements

The Host is **not an interpreter**.

### 5.4 Version/Timestamp Manipulation

A Host **MUST NOT**:

- Manually set `snapshot.meta.version`
- Manually set `snapshot.meta.timestamp` or `snapshot.meta.randomSeed`
- Reset or decrement version numbers

These are Core's responsibility. Hosts provide time/seed **only** via `HostContext`.

---

## 6. Flow Re-Entry Contract

### 6.1 The Re-Entry Problem

When Core encounters an `effect` node:

1. Core records a Requirement in Snapshot.
2. Core returns with `status: 'pending'`.
3. Host executes the effect and applies result patches.
4. Host calls `compute()` **again** with the same Intent.

This means the **Flow is evaluated from the beginning** on each `compute()` call.

### 6.2 Re-Entry Requirements (MUST)

**Flows MUST be re-entrant under repeated `compute()` calls for the same Intent instance.**

This means:

- Patch steps **MUST** be state-guarded or otherwise idempotent.
- Effect declarations **MUST** be guarded by state to prevent duplicate Requirements.
- The Flow **MUST** produce the same semantic outcome regardless of how many times it is evaluated.

### 6.3 State-Guarded Pattern (Normative)

The canonical pattern for re-entrant Flows:

```json
{
  "kind": "seq",
  "steps": [
    {
      "kind": "if",
      "cond": { "kind": "not", "arg": { "kind": "get", "path": "items.${input.localId}" } },
      "then": { "kind": "patch", "op": "set", "path": "items.${input.localId}", "value": "..." }
    },
    {
      "kind": "if",
      "cond": { "kind": "eq",
        "left": { "kind": "get", "path": "items.${input.localId}.syncStatus" },
        "right": { "kind": "lit", "value": "pending" }
      },
      "then": { "kind": "effect", "type": "api:create", "params": { "..." : "..." } }
    }
  ]
}
```

**Key Principle:**

> Progress state is NOT execution context.
> Progress state IS data in Snapshot (e.g., `syncStatus`, `processed`, existence of records).

### 6.4 Anti-Patterns (MUST NOT)

The following patterns violate re-entry safety:

```json
// WRONG: Unconditional patch that accumulates
{ "kind": "patch", "op": "set", "path": "count",
  "value": { "kind": "add", 
    "left": { "kind": "get", "path": "count" }, 
    "right": { "kind": "lit", "value": 1 } } }

// WRONG: Unconditional effect without state guard
{ "kind": "effect", "type": "api:create", "params": { "..." : "..." } }
```

---

## 7. Effect Handler Contract

### 7.1 Handler Signature

Effect handlers **MUST** conform to:

```typescript
type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
) => Promise<Patch[]>;
```

### 7.2 Handler Requirements (MUST)

| Requirement | Description |
|-------------|-------------|
| Return `Patch[]` | Always return an array of patches (may be empty) |
| Never throw | Express failures as patches, not exceptions |
| No domain logic | Decision logic belongs in Flow/Computed, not handlers |
| Deterministic per params | Same params should produce equivalent patches |

### 7.3 Handler Prohibitions (MUST NOT)

| Prohibition | Reason |
|-------------|--------|
| Throw exceptions | Breaks Host loop, non-recoverable |
| Implement domain decisions | Violates separation of concerns |
| Access external state beyond effect scope | Non-deterministic |
| Modify shared mutable state | Side effects outside Snapshot |

### 7.4 Failure Representation

Effect failures **MUST** be represented as patches:

```typescript
// Example: API call failure
async function createTodoHandler(
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
): Promise<Patch[]> {
  try {
    const result = await api.createTodo(params.title);
    return [
      { op: 'set', path: `todos.${params.localId}.serverId`, value: result.id },
      { op: 'set', path: `todos.${params.localId}.syncStatus`, value: 'synced' },
    ];
  } catch (error) {
    return [
      { op: 'set', path: `todos.${params.localId}.syncStatus`, value: 'error' },
      { op: 'set', path: `todos.${params.localId}.errorMessage`, value: error.message },
    ];
  }
}
```

### 7.5 EffectContext

Handlers receive read-only context:

```typescript
type EffectContext = {
  snapshot: Readonly<Snapshot>;
  requirement: Requirement;
};
```

- Handler **MAY** read Snapshot for observational context.
- Handler **MUST NOT** implement domain decision logic based on Snapshot.
- Handler **MUST NOT** mutate the Snapshot reference.

---

## 8. Requirement Lifecycle

### 8.1 Requirement Generation

When Core encounters an `effect` node during Flow evaluation:

1. Core resolves effect params from current Snapshot.
2. Core generates a Requirement with deterministic `id`.
3. Core appends Requirement to `snapshot.system.pendingRequirements`.
4. Core terminates computation with `status: 'pending'`.

### 8.2 Requirement Identity

Requirement `id` **SHOULD** be deterministic:

```typescript
requirementId = hash(schemaHash, intentId, actionId, flowNodePath)
```

This enables:

- Deduplication across re-entries
- Replay verification
- At-most-once execution guarantees

### 8.3 Requirement Fulfillment (Host)

Host **MUST** process Requirements as follows:

1. Read `snapshot.system.pendingRequirements`.
2. For each Requirement, execute the corresponding effect handler.
3. Apply result patches via `core.apply()`.
4. Clear the fulfilled Requirement from `pendingRequirements`.

### 8.4 Clearing Requirements (MUST)

**Host MUST clear fulfilled Requirements before re-invoking `compute()`.**

Two acceptable patterns:

**Pattern A: Clear All After Processing**

```typescript
const context = { now: 0, randomSeed: "seed" };

// Process all requirements
for (const req of snapshot.system.pendingRequirements) {
  const patches = await executeEffect(req.type, req.params, {
    snapshot,
    requirement: req,
  });
  snapshot = core.apply(schema, snapshot, patches, context);
}
// Clear all
snapshot = core.apply(schema, snapshot, [
  { op: 'set', path: 'system.pendingRequirements', value: [] }
], context);
```

**Pattern B: Clear Each After Fulfillment**

```typescript
const context = { now: 0, randomSeed: "seed" };

for (const req of [...snapshot.system.pendingRequirements]) {
  const patches = await executeEffect(req.type, req.params, {
    snapshot,
    requirement: req,
  });
  snapshot = core.apply(schema, snapshot, [
    ...patches,
    { op: 'set', path: 'system.pendingRequirements', 
      value: snapshot.system.pendingRequirements.filter(r => r.id !== req.id) }
  ], context);
}
```

### 8.5 Unfulfilled Requirements

If a Requirement cannot be fulfilled:

- Host **MUST** still apply patches (failure patches).
- Host **MUST** still clear the Requirement.
- Host **MAY** apply policy (retry, abort, escalate).

---

## 9. Intent Identity

### 9.1 Intent Structure

```typescript
type Intent = {
  /** Action type identifier */
  readonly type: string;
  
  /** Action input parameters */
  readonly input?: unknown;
  
  /** Unique identifier for this processing attempt */
  readonly intentId: string;
};
```

### 9.2 IntentId Requirements

| Requirement | Level | Description |
|-------------|-------|-------------|
| Presence | MUST | Every Intent MUST have an `intentId` |
| Uniqueness | MUST | Different processing attempts MUST have different `intentId`s |
| Stability | MUST | Re-invocations for same attempt MUST reuse same `intentId` |
| Format | SHOULD | UUID v4 or equivalent entropy |

### 9.3 IntentId Semantics

```
New user action     → Generate new intentId
Effect fulfilled    → Reuse same intentId for re-invoke
Retry after error   → Host policy: may reuse or generate new
```

### 9.4 IntentId Usage

IntentId enables:

- **Re-entry detection**: Core/Flow can distinguish re-entry from new request.
- **Requirement correlation**: Link Requirements to originating Intent.
- **Deduplication**: Prevent duplicate processing of same Intent.
- **Audit trail**: Trace all computations for a single user action.

### 9.5 Example

```typescript
// User clicks "Add Todo"
const intentId = crypto.randomUUID();  // "550e8400-e29b-41d4-a716-446655440000"
const context = { now: 0, randomSeed: intentId };

// First compute
let result = await core.compute(schema, snapshot, {
  type: 'addTodo',
  input: { title: 'Buy milk', localId: 'local-1' },
  intentId: intentId  // New intentId
}, context);

// After effect fulfillment, re-invoke with SAME intentId
result = await core.compute(schema, newSnapshot, {
  type: 'addTodo',
  input: { title: 'Buy milk', localId: 'local-1' },
  intentId: intentId  // Same intentId
}, context);
```

---

## 10. Concurrency Model

### 10.1 Single-Writer Requirement (MUST)

**Intent processing MUST be serialized per Snapshot lineage.**

- Concurrent `compute()` calls on the same Snapshot version **MUST NOT** occur.
- Only one Intent may be "in flight" per Snapshot at any time.

### 10.2 Rationale

Concurrent modification would:

- Break determinism (race conditions)
- Invalidate version ordering
- Make replay impossible

### 10.3 Effect Parallelization (MAY)

A Host **MAY** execute multiple effects in parallel, subject to:

| Constraint | Level | Description |
|------------|-------|-------------|
| Sequential patch application | MUST | Patches MUST be applied in deterministic order |
| Order determinism | MUST | Order MUST be reproducible (e.g., Requirement list order) |
| No cross-effect dependencies | SHOULD | Effects SHOULD NOT depend on each other's results |

### 10.4 Example: Parallel Effect Execution

```typescript
// ALLOWED: Parallel execution with sequential application
const requirements = snapshot.system.pendingRequirements;
const context = { now: 0, randomSeed: "seed" };

// Execute in parallel
const results = await Promise.all(
  requirements.map(req => executeEffect(req.type, req.params, {
    snapshot,
    requirement: req,
  }))
);

// Apply sequentially in deterministic order
for (let i = 0; i < requirements.length; i++) {
  snapshot = core.apply(schema, snapshot, results[i], context);
}

// Clear requirements
snapshot = core.apply(schema, snapshot, [
  { op: 'set', path: 'system.pendingRequirements', value: [] }
], context);
```

### 10.5 Multi-Snapshot Concurrency (MAY)

A Host **MAY** process multiple Snapshots concurrently if they represent **independent lineages** (e.g., different users, different sessions).

---

## 11. Versioning and Timestamps

### 11.1 Core Responsibility

**Core is exclusively responsible for snapshot metadata updates.**

When `apply()` is called:

- Core **MUST** increment `snapshot.meta.version`.
- Core **MUST** set `snapshot.meta.timestamp` from `HostContext.now`.
- Core **MUST** set `snapshot.meta.randomSeed` from `HostContext.randomSeed`.
- Core **MUST** ensure version is monotonically increasing.

### 11.2 Host Prohibition

Host **MUST NOT**:

- Set `snapshot.meta.version` directly
- Set `snapshot.meta.timestamp` directly
- Skip or reset versions
- Use non-`apply()` methods to change these fields

### 11.3 Version Semantics

```typescript
type SnapshotMeta = {
  /** Monotonically increasing, incremented by Core on each apply() */
  readonly version: number;
  
  /** Timestamp of last apply(), set by Core */
  readonly timestamp: number;

  /** Deterministic random seed from Host context */
  readonly randomSeed: string;
  
  /** Schema hash this Snapshot conforms to */
  readonly schemaHash: string;
};
```

### 11.4 Version Invariants

| Invariant | Description |
|-----------|-------------|
| Monotonic | `version(n+1) > version(n)` always |
| Gapless | Each `apply()` increments by exactly 1 |
| Immutable history | Past versions never change |

---

## 12. Schema Validation

### 12.1 Validation Requirement

Host **SHOULD** validate schema before first `compute()`.

```typescript
const validation = core.validate(schema);
if (!validation.valid) {
  // Handle invalid schema
}
```

### 12.2 Core Behavior

- Core **MAY** reject invalid schemas with error status.
- Core **MAY** perform validation lazily on first `compute()`.
- Core **MUST** produce deterministic validation results.

### 12.3 Host Responsibility

- Host **MUST NOT** assume schema validity without validation.
- Host **SHOULD** cache validation results for performance.
- Host **MUST** re-validate if schema changes.

---

## 13. Normative Host Loop

The following Host loop pattern is **normative**, not illustrative.

A compliant Host **MUST** implement equivalent behavior.

```typescript
type HostLoopResult = {
  status: "complete" | "halted" | "error";
  snapshot: Snapshot;
};

async function processIntent(
  core: ManifestoCore,
  schema: DomainSchema,
  snapshot: Snapshot,
  intent: Intent,
  getContext: () => HostContext
): Promise<HostLoopResult> {
  
  // Validate intentId presence
  if (!intent.intentId) {
    return { status: "error", snapshot: snapshot };
  }
  
  let current = snapshot;
  
  while (true) {
    const context = getContext();

    // Clear any stale requirements before compute (defensive)
    if (current.system.pendingRequirements.length > 0) {
      current = core.apply(schema, current, [
        { op: 'set', path: 'system.pendingRequirements', value: [] }
      ], context);
    }
    
    // Compute
    const result = await core.compute(schema, current, intent, context);
    current = result.snapshot;
    
    // Handle result status
    switch (result.status) {
      case 'complete':
      case 'halted':
        // Terminal states - return final snapshot
        return { status: result.status, snapshot: current };
        
      case 'error':
        // Error state - Host policy applies
        // Options: return, retry, escalate
        return { status: "error", snapshot: current };
        
      case 'pending':
        // Effect(s) required - fulfill and re-enter
        
        // Process requirements in deterministic order
        for (const req of result.requirements) {
          // Execute effect handler
          const patches = await executeEffect(req.type, req.params, {
            snapshot: current,
            requirement: req,
          });
          
          // Apply result patches
          current = core.apply(schema, current, patches, context);
        }
        
        // Clear fulfilled requirements
        current = core.apply(schema, current, [
          { op: 'set', path: 'system.pendingRequirements', value: [] }
        ], context);
        
        // Loop continues - compute() will be called again with same intentId
        break;
    }
  }
}

async function executeEffect(
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
): Promise<Patch[]> {
  const handler = effectHandlers[type];
  
  if (!handler) {
    // Unknown effect type - return error patches
    return [
      { op: 'set', path: 'system.lastError', value: {
        code: 'UNKNOWN_EFFECT_TYPE',
        message: `No handler registered for effect type: ${type}`,
        timestamp: context.requirement.createdAt
      }}
    ];
  }
  
  // Handler MUST NOT throw - but defensive wrapping is acceptable
  try {
    return await handler(type, params, context);
  } catch (error) {
    // Convert unexpected throw to error patches
    return [
      { op: 'set', path: 'system.lastError', value: {
        code: 'EFFECT_HANDLER_ERROR',
        message: error.message,
        timestamp: context.requirement.createdAt
      }}
    ];
  }
}
```

---

## 14. Host Policy Freedom (MAY)

Within the constraints defined above, a Host **MAY**:

| Policy | Description |
|--------|-------------|
| Retry | Retry failed effects with backoff |
| Parallelize | Execute independent effects in parallel |
| Persist | Store Snapshots in any storage system |
| Cache | Cache computation results by schema hash |
| Visualize | Render state in any UI framework |
| Schedule | Control timing and scheduling of computations |
| Compensate | Implement saga/compensation patterns |
| Circuit break | Stop calling failing effect handlers |
| Timeout | Set timeouts on effect execution |
| Log | Log any aspect of computation and effects |

These are **policy decisions**, not part of the Contract.

---

## 15. Explicit Non-Goals

The Host Contract intentionally does **NOT** specify:

| Non-Goal | Reason |
|----------|--------|
| Performance optimizations | Implementation concern |
| Specific concurrency frameworks | Platform-specific |
| UI architecture | Application concern |
| Error recovery strategies | Policy decision |
| Security/authentication | Orthogonal concern |
| Network protocols | Transport concern |
| Storage formats | Persistence concern |
| Monitoring/observability | Operations concern |

These concerns are **out of scope** for this specification.

---

## 16. Compliance Statement

### 16.1 Compliance Requirements

A system claiming to be a **Manifesto Host** MUST:

1. Implement all **MUST** requirements in this document.
2. Avoid all **MUST NOT** behaviors in this document.
3. Treat Snapshot as the sole source of truth.
4. Ensure Flows are re-entrant under repeated `compute()` calls.
5. Provide stable `intentId` across re-invocations.

### 16.2 Compliance Verification

Compliance can be verified by:

1. **Static analysis**: Code review against MUST/MUST NOT rules.
2. **Dynamic testing**: Run standard test scenarios.
3. **Replay testing**: Verify deterministic replay of recorded intents.

### 16.3 Non-Compliance Consequences

Failure to comply with this Contract:

- **Voids determinism guarantee**: Computations may produce different results.
- **Breaks reproducibility**: Cannot replay or debug reliably.
- **Invalidates Manifesto semantics**: System is not a valid Manifesto Host.

---

## Appendix A: Quick Reference

### A.1 Host MUST

- Invoke `compute()` for all semantic computation
- Mutate state only via `apply()`
- Re-invoke `compute()` after effect fulfillment with same `intentId`
- Clear fulfilled Requirements before re-invocation
- Serialize Intent processing per Snapshot lineage
- Apply patches in deterministic order

### A.2 Host MUST NOT

- Mutate Snapshot directly
- Pass values outside Snapshot
- Modify version/timestamp
- Skip `compute()` calls
- Allow concurrent `compute()` on same Snapshot version

### A.3 Flow MUST

- Be re-entrant (safe under repeated evaluation)
- Use state-guarded patches
- Use state-guarded effect declarations

### A.4 Effect Handler MUST

- Return `Patch[]`
- Never throw
- Not contain domain logic

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Core** | Pure semantic calculator |
| **Host** | External system operating Core |
| **Snapshot** | Immutable point-in-time state |
| **Intent** | Request to perform action |
| **IntentId** | Unique identifier for processing attempt |
| **Requirement** | Recorded effect awaiting fulfillment |
| **Re-entry** | Repeated `compute()` for same Intent |
| **State-guarded** | Conditional on current Snapshot state |

---

## Appendix C: Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | TBD | Initial release |

---

*End of Host Contract Specification v1.0*
