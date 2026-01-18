# Host Contract Specification v2.0.2

> **Status:** Normative
> **Scope:** Manifesto Host Implementations
> **Compatible with:** Core SPEC v2.0.0, ARCHITECTURE v2.0
> **Authors:** Manifesto Team
> **License:** MIT
> **Changelog:**
> - v1.0: Initial release (Core-Host boundary, Snapshot communication, Effect handlers)
> - v1.x: Compiler Integration (Translator pipeline, Expression evaluation)
> - v2.0: Event-Loop Execution Model (Mailbox, Job model, Single-runner)
> - v2.0.1: Context Determinism (HostContext frozen per job)
> - **v2.0.2: Snapshot Type Alignment (Core Snapshot canonical reference)**

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Normative Language](#2-normative-language)
3. [Definitions](#3-definitions)
4. [Core-Host Boundary](#4-core-host-boundary)
5. [Snapshot Communication](#5-snapshot-communication)
6. [Intent Processing](#6-intent-processing)
7. [Effect Handler Contract](#7-effect-handler-contract)
8. [Requirement Lifecycle](#8-requirement-lifecycle)
9. [Compiler Integration](#9-compiler-integration)
10. [Execution Model (v2.0)](#10-execution-model-v20)
11. [Context Determinism (v2.0.1)](#11-context-determinism-v201)
12. [Invariants](#12-invariants)
13. [Error Handling](#13-error-handling)
14. [Cross-Reference](#14-cross-reference)

---

## 1. Purpose

This document defines the **Host Contract** for Manifesto.

The Host is the execution layer that:
- Bridges Core (pure computation) with external reality (IO, network, persistence)
- Executes effects declared by Core
- Applies patches to snapshots
- Ensures determinism and reproducibility through single-writer semantics

This specification defines:
- The absolute boundary between Core and Host
- Snapshot as the sole communication channel
- Effect handler contract (no-throw, Patch[] return)
- Intent processing model (no resume, re-entry required)
- Requirement lifecycle (generate, execute, apply, clear, continue)
- **Execution model with mailbox-based serialization (v2.0)**

---

## 2. Normative Language

Key words **MUST**, **MUST NOT**, **SHOULD**, **MAY**, etc. are interpreted as described in RFC 2119.

---

## 3. Definitions

### 3.1 Core

The pure computation engine that evaluates Flows against Snapshots.

```typescript
interface Core {
  compute(schema: DomainSchema, snapshot: Snapshot, intent: Intent, context: HostContext): ComputeResult;
  apply(schema: DomainSchema, snapshot: Snapshot, patches: Patch[], context: HostContext): Snapshot;
}
```

### 3.2 Host

The execution layer that orchestrates Core computation and effect execution.

```typescript
interface Host {
  processIntent(intent: Intent): Promise<void>;
  executeEffect(requirement: Requirement): Promise<Patch[]>;
}
```

### 3.3 Snapshot (Core Reference)

The complete state of a domain at a point in time.

**Host MUST use the canonical Snapshot type defined in Core SPEC.**

```typescript
// Host imports from Core (NOT redefined here)
import type { Snapshot, SystemState, SnapshotMeta, ErrorValue } from '@manifesto-ai/core';

// ============================================================
// AUTHORITATIVE DEFINITION - Core SPEC v2.0.0
// ============================================================
// type Snapshot<TData = unknown> = {
//   readonly data: TData;
//   readonly computed: Record<string, unknown>;
//   readonly system: SystemState;
//   readonly input: unknown;
//   readonly meta: SnapshotMeta;
// };
//
// type SystemState = {
//   readonly status: 'idle' | 'computing' | 'pending' | 'error';
//   readonly lastError: ErrorValue | null;
//   readonly errors: readonly ErrorValue[];  // History (accumulated)
//   readonly pendingRequirements: readonly Requirement[];
//   readonly currentAction: string | null;
// };
//
// type SnapshotMeta = {
//   readonly version: number;
//   readonly timestamp: number;
//   readonly randomSeed: string;
//   readonly schemaHash: string;
// };
// ============================================================
```

| Rule ID | Description |
|---------|-------------|
| HOST-SNAP-1 | Host MUST use Core's canonical Snapshot type |
| HOST-SNAP-2 | Host MUST NOT redefine Snapshot/SnapshotMeta/SystemState |
| HOST-SNAP-3 | Host MUST preserve all Core fields when applying patches |
| HOST-SNAP-4 | Host MAY read any Core field but MUST NOT assume field absence |

**Field Ownership Table:**

| Field | Owner | Host Reads | Host Writes | Description |
|-------|-------|------------|-------------|-------------|
| `data.*` | Core | Yes | via Patch | Domain state |
| `data.$host.*` | **Host** | Yes | Yes | Host-owned namespace (see below) |
| `computed.*` | Core | Yes | No | Derived values |
| `system.status` | Core | Yes | No | Core sets via compute() |
| `system.lastError` | Core | Yes | No | Current error state |
| `system.errors` | Core | Yes | No | Error history (accumulated) |
| `system.pendingRequirements` | Core | Yes | via Patch | Requirement lifecycle |
| `system.currentAction` | Core | Yes | No | Core sets during compute |
| `meta.schemaHash` | Core | Yes | No | Domain schema identity |
| `meta.version` | Core | Yes | No | Core-owned versioning |
| `meta.timestamp` | Host | Yes | Yes | Host provides per execution |
| `meta.randomSeed` | Host | Yes | Yes | Host provides, frozen per job |

### 3.3.1 Host-Owned State Namespace

Host requires persistent state across intent processing (e.g., intent-scoped effect data).
Rather than extending Core's `SystemState`, Host uses a **reserved namespace in `data`**.

```typescript
// Host-owned state lives in data.$host (NOT in system.*)
type HostOwnedState = {
  /** Intent-scoped effect data */
  intentSlots?: Record<string, Record<string, unknown>>;
  /** Other Host-specific state */
  [key: string]: unknown;
};

// Access pattern
const hostState = snapshot.data.$host as HostOwnedState | undefined;
```

**Note:** Patch paths are rooted at `data` by default. Use `$host.*` to target
the Host-owned namespace.

| Rule ID | Description |
|---------|-------------|
| HOST-NS-1 | Host-owned state MUST be stored in `data.$host` namespace |
| HOST-NS-2 | Host MUST NOT extend Core's SystemState with custom fields |
| HOST-NS-3 | Host MUST treat `data.$host` as opaque to Core |
| HOST-NS-4 | Patches targeting `$host` follow standard Patch semantics |
| HOST-NS-5 | Host error reporting MUST use `$host` or domain paths (never `system.*`) |

**Rationale:**
- Core's `SystemState` is owned by Core SPEC; Host must not extend it
- `data` is the domain state container, with `$host` reserved for Host
- This preserves Core Snapshot structure while allowing Host-specific state
- Patches to `$host` are standard operations, no special handling needed

### 3.4 Intent

A command to perform a domain action.

```typescript
type Intent = {
  readonly type: string;
  readonly intentId: string;
  readonly input?: unknown;
};
```

### 3.5 Requirement

An effect declaration from Core that Host must execute.

```typescript
type Requirement = {
  readonly id: string;           // Deterministic ID (H007)
  readonly intentId: string;     // Associated intent
  readonly type: string;         // Effect type
  readonly params: unknown;      // Effect parameters
};
```

### 3.6 ExecutionKey (v2.0)

An opaque identifier for execution serialization.

```typescript
/**
 * ExecutionKey is opaque to Host.
 * World/App layer determines the mapping policy.
 */
type ExecutionKey = string;
```

### 3.7 Job (v2.0)

A unit of work in the execution mailbox. The specific job type union is **informative** (reference implementation); see Appendix C for example shapes.

What is **normative** is the behavioral contract each job type must satisfy (Section 10).

---

## 4. Core-Host Boundary

### 4.1 Absolute Separation

The boundary between Core and Host is **absolute and non-negotiable**.

```
Core computes meaning.
Host executes reality.
```

### 4.2 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| CORE-HOST-1 | Core MUST NOT perform IO, network calls, or any side effects |
| CORE-HOST-2 | Host MUST NOT interpret Flow semantics or compute derived values |
| CORE-HOST-3 | Core MUST remain pure: same input -> same output |
| CORE-HOST-4 | Host MUST handle all IO, network, and persistence |

### 4.3 Diagram

```
Host
  - Effect execution
  - Snapshot persistence
  - Network communication
  - All IO operations
  - Calls Core for pure computation

Core
  - Flow evaluation
  - Patch generation
  - NO IO, NO network, NO side effects
```

---

## 5. Snapshot Communication

### 5.1 Sole Communication Channel

Snapshot is the **only** valid communication channel between Core and Host.

There are no return values, no callbacks, no events, no mutable context passing between jobs; each job receives a fresh frozen HostContext (CTX-1~5).

### 5.2 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| SNAP-1 | All state MUST be visible in Snapshot |
| SNAP-2 | Effect results MUST be expressed as Patch[] applied to Snapshot |
| SNAP-3 | No hidden execution context MUST exist |
| SNAP-4 | Core MUST NOT receive effect results via return values or callbacks |

### 5.3 Correct Pattern

```typescript
// FORBIDDEN: Effect result as return value
const result = await executeEffect();
core.resume(result);  // Hidden state!

// REQUIRED: Effect result as Snapshot mutation
const patches = await executeEffect();
// Context is frozen once per job (CTX-1~5)
// frozenContext.now is captured once (CTX-3)
// frozenContext.randomSeed = intentId (CTX-4)
const frozenContext = createFrozenContext(job.id, job.intentId);
snapshot = core.apply(schema, snapshot, patches, frozenContext);
```

---

## 6. Intent Processing

### 6.1 No Resume, No Continuation

There is no `resume()` API. Each `compute()` call is complete and independent.

### 6.2 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| INTENT-1 | Each `compute()` call MUST be complete and independent |
| INTENT-2 | Host MUST NOT maintain suspended execution context |
| INTENT-3 | Flows MUST be re-entrant under repeated `compute()` calls |
| INTENT-4 | All progress state MUST be in Snapshot, not in Host memory |
| INTENT-5 | `intentId` MUST remain stable throughout a single execution |

### 6.3 Re-Entry Requirement

Given no resume, the same Flow will be evaluated multiple times for a single intent:

1. First `compute()`: Flow runs until effect, returns `pending`
2. Host executes effect, applies patches
3. Second `compute()`: Flow runs **from the beginning**

**State-guarded pattern** is MUST for re-entry safety:

```typescript
// Flow checks Snapshot state before acting
{
  "kind": "if",
  "cond": { "kind": "not", "arg": { "kind": "get", "path": "item.exists" } },
  "then": { "kind": "patch", "op": "set", "path": "item", "value": {...} }
}
```

### 6.4 Intent Identity (intentId)

| Rule ID | Description |
|---------|-------------|
| INTENT-ID-1 | `intentId` MUST be generated at intent submission time |
| INTENT-ID-2 | `intentId` MUST remain stable throughout all compute cycles for that intent |
| INTENT-ID-3 | Same `intentId` MUST be used for EvaluationContext and Intent |
| INTENT-ID-4 | Retry creates new `intentId`; same body creates same `intentKey` |

---

## 7. Effect Handler Contract

### 7.1 No-Throw Philosophy

Effect handlers MUST return `Patch[]` and MUST NOT throw exceptions.

### 7.2 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| HANDLER-1 | Effect handlers MUST return `Patch[]` |
| HANDLER-2 | Effect handlers MUST NOT throw exceptions |
| HANDLER-3 | Failures MUST be expressed as patches (error state in Snapshot) |
| HANDLER-4 | Effect handlers MUST NOT contain domain logic |
| HANDLER-5 | Effect handlers MUST be pure IO adapters |

### 7.3 Correct Pattern

```typescript
// CORRECT: Failures as patches
async function fetchUserHandler(type: string, params: any): Promise<Patch[]> {
  try {
    const response = await fetch(`/users/${params.id}`);
    if (!response.ok) {
      return [
        { op: 'set', path: 'user.error', value: { code: response.status } },
        { op: 'set', path: 'user.data', value: null }
      ];
    }
    const data = await response.json();
    return [
      { op: 'set', path: 'user.data', value: data },
      { op: 'set', path: 'user.error', value: null }
    ];
  } catch (error) {
    return [
      { op: 'set', path: 'user.error', value: { message: error.message } },
      { op: 'set', path: 'user.data', value: null }
    ];
  }
}
```

### 7.4 Domain Logic Prohibition

All domain decisions belong in Flow or Computed, not in handlers.

```typescript
// WRONG: Domain logic in handler
async function purchaseHandler(type, params) {
  if (params.amount > 1000) {  // Business rule in handler!
    return [{ op: 'set', path: 'approval.required', value: true }];
  }
}

// CORRECT: Handler does IO only
async function paymentHandler(type, params) {
  const result = await paymentGateway.charge(params.amount);
  return [{ op: 'set', path: 'payment.status', value: result.status }];
}
```

---

## 8. Requirement Lifecycle

### 8.1 Deterministic Requirement ID

Requirement ID MUST be computed deterministically from content.

### 8.2 Requirement ID Algorithm (v2.0 revised)

Requirement ID MUST be computed from the following inputs:

```typescript
type RequirementIdInputs = {
  schemaHash: string;       // DomainSchema hash
  intentId: string;         // Stable per execution attempt
  actionId: string;         // Action being executed
  flowNodePath: string;     // Path to effect node in Flow
  effectSignature: {
    name: string;           // Effect type name
    normalizedArgs: string; // JCS-canonicalized arguments (RFC 8785)
    writeTargets: string[]; // Declared write target paths (into/pass/fail)
  };
};

// requirementId = SHA-256( JCS(inputs) )
```

**Canonicalization Rules:**

| Field | Canonicalization |
|-------|------------------|
| `normalizedArgs` | RFC 8785 (JSON Canonicalization Scheme) |
| `writeTargets` | Sorted lexicographically |
| Final hash input | JCS of entire `RequirementIdInputs` object |

**Generation Responsibility:**

- **Core generates** `requirementId` (Requirement is Core's output)
- **Host uses** `requirementId` for tracking, clearing, and correlation
- Host MUST NOT interpret or modify the ID semantically

### 8.3 Lifecycle Steps

| Step | Action | Rule ID |
|------|--------|---------|
| 1. Generate | `requirementId = hash(schema + intent + action + path)` | REQ-GEN-1 |
| 2. Execute | Effect runner processes requirement | REQ-EXEC-1 |
| 3. Apply | Result patches applied to snapshot | REQ-APPLY-1 |
| 4. Clear | Remove from `pendingRequirements` | REQ-CLEAR-1 |
| 5. Continue | Re-invoke compute | REQ-CONT-1 |

### 8.4 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| REQ-GEN-1 | `requirementId` MUST be computed using Section 8.2 algorithm |
| REQ-EXEC-1 | Effect runner MUST NOT throw (H005) |
| REQ-APPLY-1 | Result MUST be applied via `Core.apply()` |
| REQ-CLEAR-1 | **Host MUST clear fulfilled requirement from `pendingRequirements`** |
| REQ-CONT-1 | Host MUST re-invoke `compute()` after clearing |
| REQ-SEQ-1 | **Steps 3, 4, 5 MUST be executed atomically in sequence** |

### 8.5 Clearing Obligation (Critical)

**Skipping the clear step causes infinite loop or duplicate effects.**

```
Iteration 1: compute() -> requirement R1 in pending
             execute R1 -> apply result
             [MISSING: clear R1]
             
Iteration 2: compute() -> R1 still in pending!
             execute R1 again -> duplicate effect!
             ...infinite loop
```

---

## 9. Compiler Integration

> **DEPRECATED (v2.0.1)**
>
> This section is **deprecated** as of v2.0.1. Host is now **decoupled from Compiler and Translator**.
>
> **Rationale:** Host should only receive concrete `Patch[]` values. Translator output processing
> (MEL IR -> Patch[]) is the responsibility of the App layer, not Host.
>
> **Migration:** If Translator integration is needed, implement a `TranslatorAdapter` at the
> App layer that converts `TranslatorFragment[]` to `Patch[]` before submitting to Host.
>
> See FDR-H024 for the design rationale.

### 9.1 ~~Mandatory Compiler Dependency~~ (DEPRECATED)

~~Host MUST declare dependency on `@manifesto-ai/compiler` and use it for all Translator output processing.~~

**v2.0.1:** Host MUST NOT depend on `@manifesto-ai/compiler`. Host receives only concrete `Patch[]`.

### 9.2 ~~Two-Step Processing~~ (DEPRECATED)

~~Host MUST perform two distinct steps:~~

1. ~~**Lowering**: MEL IR -> Core IR (`lowerPatchFragments()`)~~
2. ~~**Evaluation**: Core IR -> concrete values (`evaluateConditionalPatchOps()`)~~

**v2.0.1:** These steps are performed by App layer, not Host.

### 9.3 Rules (DEPRECATED)

| Rule ID | Description | Status |
|---------|-------------|--------|
| ~~COMP-1~~ | ~~Host MUST import from `@manifesto-ai/compiler`~~ | **DEPRECATED** |
| ~~COMP-2~~ | ~~Host MUST call `lowerPatchFragments()` first~~ | **DEPRECATED** |
| ~~COMP-3~~ | ~~Host MUST call `evaluateConditionalPatchOps()` second~~ | **DEPRECATED** |
| COMP-4 | Host MUST pass only concrete `Patch[]` to `Core.apply()` | **RETAINED** |
| COMP-5 | Passing expressions to `Core.apply()` is SPEC VIOLATION | **RETAINED** |
| ~~COMP-6~~ | ~~`$system.*` MUST be excluded from Translator path `allowSysPaths`~~ | **DEPRECATED** |

### 9.4 ~~Data Flow~~ (DEPRECATED)

**v2.0.1 Architecture:**

```
App layer (optional TranslatorAdapter, outside Host)
  - Depends on @manifesto-ai/compiler (if used)
  - Translator.translate() -> TranslatorFragment[]
  - lowerPatchFragments()
  - evaluateConditionalPatchOps()
  - Submits concrete Patch[] to Host

Host (compiler-free, translator-free)
  - Receives only concrete Patch[]
  - No @manifesto-ai/compiler dependency
  - Single responsibility: execution orchestration
```

---

## 10. Execution Model (v2.0)

This section defines the enforcement mechanism for single-writer concurrency.

### 10.1 Execution Mailbox

Host MUST maintain a single-writer mailbox per `ExecutionKey`.

#### 10.1.1 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| MAIL-1 | Host MUST maintain one mailbox per ExecutionKey |
| MAIL-2 | ExecutionKey MUST be opaque to Host |
| MAIL-3 | World/App layer determines ExecutionKey mapping policy |
| MAIL-4 | All state mutations MUST go through the mailbox |

#### 10.1.2 Type Definition

```typescript
interface ExecutionMailbox {
  readonly key: ExecutionKey;
  enqueue(job: Job): void;
  dequeue(): Job | undefined;
  isEmpty(): boolean;
}
```

#### 10.1.3 Layer Boundary

| Layer | Knows | Provides |
|-------|-------|----------|
| **Host** | ExecutionKey (opaque), intentId, Snapshot | Single-writer serialization |
| **World** | proposalId, baseWorldId, branch | ExecutionKey mapping |
| **App** | User intent, UI state | Orchestration policy |

```typescript
// Correct: World/App maps proposalId -> ExecutionKey
function getExecutionKey(proposalId: string): ExecutionKey {
  return proposalId;
}

// Wrong: Host directly uses World concepts
// Host should not import ProposalId type from World
```

### 10.2 Run-to-Completion Job Model

Job handlers MUST NOT await external work. Effect execution is modeled as job splitting.

#### 10.2.1 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| JOB-1 | Job handlers MUST NOT await external work (effects, network, translator) |
| JOB-2 | Job handlers MUST be synchronous |
| JOB-3 | Effect execution MUST be modeled as job splitting |
| JOB-4 | Each job MUST read fresh snapshot (no continuation state) |
| JOB-5 | Mailbox drain MAY be async, but single-runner invariant MUST hold |

#### 10.2.2 Job Handler Await Ban

```typescript
// FORBIDDEN: await inside job handler
async function handleStartIntent(job) {
  const result = await translateIntent(job.intent);  // VIOLATION
  applyResult(result);
}

// CORRECT: request effect, terminate job
function handleStartIntent(job) {
  const snapshot = context.getCanonicalHead();  // Fresh read
  const computed = Core.compute(schema, snapshot, job.intent);
  
  if (computed.pendingRequirements.length > 0) {
    requestEffectExecution(job.intentId, computed.pendingRequirements);
    // Job terminates here. No continuation state.
  } else {
    enqueue({ type: 'ApplyPatches', patches: computed.patches });
  }
}
```

#### 10.2.3 Job Lifecycle

```
Job declares "effect needed" -> Job terminates (run-to-completion)
                                      v
Effect executes (outside mailbox) -> Result arrives
                                      v
FulfillEffect job enqueued -> Patches applied -> ContinueCompute enqueued
```

#### 10.2.4 Compute Result and Effect Request Ordering (Critical)

| Rule ID | Description |
|---------|-------------|
| COMP-REQ-INTERLOCK-1 | **All snapshot mutations from `Core.compute()` MUST be applied BEFORE effect execution requests are dispatched** |
| COMP-REQ-INTERLOCK-2 | **Effect dispatch list SHOULD be read from `snapshot.system.pendingRequirements` AFTER apply, not from compute return value** |

**Why This Matters:**

Core.compute() returns both:
- Patches to apply (including `pendingRequirements` update in system state)
- Effect execution needs

If effect execution starts BEFORE patches are applied:
- `pendingRequirements` may not contain the new requirement yet
- FULFILL-0 check will incorrectly treat fulfillment as "stale"
- Race condition between apply and fulfill

**Why INTERLOCK-2 (read from snapshot after apply):**

Reading effect dispatch list from `snapshot.system.pendingRequirements` after apply:
- Guarantees consistency between what's in snapshot and what's being dispatched
- Eliminates class of bugs where compute return value differs from snapshot state
- Aligns with Core SPEC's "Host reads pendingRequirements from snapshot" principle

**Correct Sequence:**

```typescript
function handleStartIntent(job: StartIntent) {
  const snapshot = ctx.getCanonicalHead();
  const result = Core.compute(schema, snapshot, job.intent);
  
  // STEP 1: Apply ALL mutations FIRST (COMP-REQ-INTERLOCK-1)
  if (result.patches.length > 0) {
    applyPatches(result.patches);  // Includes pendingRequirements update
  }
  
  // STEP 2: Read requirements from UPDATED snapshot (COMP-REQ-INTERLOCK-2)
  const updatedSnapshot = ctx.getCanonicalHead();  // Fresh read after apply
  const requirements = updatedSnapshot.system.pendingRequirements;
  
  // STEP 3: THEN dispatch effect requests
  if (requirements.length > 0) {
    for (const req of requirements) {
      requestEffectExecution(job.intentId, req);  // Async, outside mailbox
    }
    // Job terminates here - no continuation state
  } else {
    // No effects needed, continue
    enqueue({ type: 'ContinueCompute', intentId: job.intentId });
  }
}
```

**Alternative (Simpler but less safe):**

If implementation guarantees compute return value matches snapshot update:

```typescript
// Acceptable if Core guarantees result.pendingRequirements === snapshot update
const result = Core.compute(schema, snapshot, job.intent);
applyPatches(result.patches);

if (result.pendingRequirements.length > 0) {
  for (const req of result.pendingRequirements) {
    requestEffectExecution(job.intentId, req);
  }
}
```

**Wrong Pattern (violates COMP-REQ-INTERLOCK-1):**

```typescript
// WRONG: Effect request before patch apply
function handleStartIntent(job: StartIntent) {
  const result = Core.compute(schema, snapshot, job.intent);
  
  // Effect requested BEFORE pendingRequirements is in snapshot
  requestEffectExecution(job.intentId, result.pendingRequirements[0]);
  
  // Now apply patches - too late!
  applyPatches(result.patches);
}
```

### 10.3 Single-Runner Invariant

For each ExecutionKey, only ONE runner processes the mailbox at any time.

#### 10.3.1 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| RUN-1 | At most one runner per ExecutionKey at any time |
| RUN-2 | Re-entrant processing attempts MUST return immediately |
| RUN-3 | Runner guard MUST be maintained across async yields |
| RUN-4 | **Runner MUST re-check mailbox before releasing guard (lost wakeup prevention)** |

#### 10.3.2 Lost Wakeup Problem

**Critical Edge Case:** Without RUN-4, the following sequence causes permanent stall:

```
1. Runner processing last job, queue becomes empty
2. Runner exits while loop, but BEFORE runnerActive.delete(key)
3. Effect callback arrives, enqueues FulfillEffect
4. enqueue() sees empty->non-empty, calls processMailbox(key)
5. processMailbox() sees runnerActive.has(key) = true, returns immediately
6. Original runner does runnerActive.delete(key), exits
7. New job sits in queue forever -- LIVE-1 VIOLATION
```

This is NOT a rare race condition. It occurs whenever effect results arrive during runner shutdown.

#### 10.3.3 Implementation Pattern (Lost Wakeup Safe)

```typescript
const runnerActive = new Set<ExecutionKey>();
const runnerKickRequested = new Set<ExecutionKey>(); // LIVE-4: remember blocked kicks

async function processMailbox(key: ExecutionKey) {
  // RUN-2: re-entrant attempts return immediately, but remember the kick
  if (runnerActive.has(key)) {
    runnerKickRequested.add(key);  // LIVE-4: will be retried after runner exits
    return;
  }

  runnerActive.add(key);
  try {
    const queue = mailboxes.get(key)!;

    while (true) {
      const job = queue.dequeue();
      if (!job) break;

      runJobSync(job);              // MUST be synchronous
      await yieldToUI();            // MAY yield between jobs
    }
  } finally {
    runnerActive.delete(key);

    // RUN-4 + LIVE-4: prevent lost wakeup
    const queue = mailboxes.get(key)!;
    if (!queue.isEmpty() || runnerKickRequested.has(key)) {
      runnerKickRequested.delete(key);
      queueMicrotask(() => processMailbox(key));  // Re-schedule
    }
  }
}
```

#### 10.3.4 Why This Pattern Works

| Phase | Without RUN-4/LIVE-4 | With RUN-4/LIVE-4 |
|-------|---------------------|-------------------|
| Kick during active | Returns, kick lost | Returns, kick remembered |
| Runner exit | Just exits | Re-checks queue + kick flag |
| Result | Job orphaned forever | Job processed on re-schedule |

### 10.4 Effect Result Reinjection

Effect results MUST be reinjected to the mailbox as jobs.

#### 10.4.1 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| REINJ-1 | Effect results MUST be reinjected as FulfillEffect jobs |
| REINJ-2 | Direct application from effect callback is FORBIDDEN |
| REINJ-3 | Effect runner MUST enqueue result to mailbox |
| REINJ-4 | Effect runner MUST trigger mailbox processing after enqueue |

#### 10.4.2 Correct Pattern

```typescript
// WRONG: Direct application from callback
async function executeEffect(req: Requirement) {
  const patches = await effectRunner.execute(req);
  Core.apply(snapshot, patches);  // VIOLATION: outside mailbox
}

// CORRECT: Reinject as job
async function executeEffect(key: ExecutionKey, req: Requirement) {
  const patches = await effectRunner.execute(req);
  
  // Reinject to mailbox
  mailboxes.get(key)?.enqueue({
    type: 'FulfillEffect',
    intentId: req.intentId,
    requirementId: req.id,
    resultPatches: patches
  });
  
  // Trigger processing
  processMailbox(key);
}
```

### 10.5 Mailbox Liveness Guarantee

Host MUST guarantee that enqueued jobs are eventually processed.

#### 10.5.1 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| LIVE-1 | Every enqueued job MUST eventually be processed |
| LIVE-2 | When queue transitions from empty to non-empty, runner MUST be kicked/scheduled |
| LIVE-3 | Runner kick failure MUST be logged and retried |
| LIVE-4 | **Kick blocked by runnerActive MUST be remembered and retried after runner exits** |

#### 10.5.2 LIVE-4 Rationale

When `processMailbox(key)` is called but `runnerActive.has(key)` is true:
- The kick cannot proceed (RUN-2)
- But the kick request MUST NOT be lost
- Store in `runnerKickRequested` set
- Runner checks this flag before exiting (RUN-4)

Without LIVE-4, kicks during the "loop exit -> guard release" window are permanently lost.

#### 10.5.3 Implementation Pattern

```typescript
function enqueue(key: ExecutionKey, job: Job) {
  const queue = mailboxes.get(key);
  const wasEmpty = queue.isEmpty();
  
  queue.enqueue(job);
  
  // LIVE-2: kick runner on empty->non-empty transition
  if (wasEmpty) {
    scheduleRunner(key);
  }
}

function scheduleRunner(key: ExecutionKey) {
  // This may return immediately if runner is active (RUN-2)
  // But LIVE-4 ensures the kick is remembered
  queueMicrotask(() => processMailbox(key));
}
```

### 10.6 Effect Result Application Order

Effect results MUST be applied in deterministic order within an ExecutionKey.

#### 10.6.1 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| ORD-1 | Effect result patches MUST be applied in mailbox dequeue order |
| ORD-2 | Out-of-order application is SPEC VIOLATION |
| ORD-3 | Version conflicts indicate order violation or concurrent modification |
| ORD-4 | **Reinjection order MUST be deterministic for reproducible traces** |

#### 10.6.2 Effect Execution Policy (MUST choose one)

When multiple Requirements are pending, implementations MUST choose one of these policies:

| Policy | Rule ID | Description | Trade-off |
|--------|---------|-------------|-----------|
| **Serial (DEFAULT)** | ORD-SERIAL | Execute one Requirement at a time, in `pendingRequirements` array order | Head-of-line blocking; fully deterministic |
| **Parallel + Ordered Reinject** | ORD-PARALLEL | Execute in parallel; reinject in `pendingRequirements` array order | Better throughput; requires ordering buffer |

**ORD-SERIAL is the default.** Implementations choosing ORD-PARALLEL MUST:
1. Document the policy explicitly
2. Implement reinjection ordering buffer
3. Guarantee deterministic reinjection order (same order as `pendingRequirements` array from Core)

#### 10.6.3 Why Deterministic Order Matters

```
Scenario: Two effects E1, E2 both modify `state.counter`

E1: counter += 10
E2: counter *= 2

Serial (E1 then E2):  0 -> 10 -> 20
Parallel (E2 finishes first, applied first): 0 -> 0 -> 10  // WRONG

Without deterministic reinjection order:
- Traces are non-reproducible
- Debugging is impossible
- State divergence between runs
```

#### 10.6.4 Ordering Buffer Pattern (for ORD-PARALLEL)

```typescript
// When using parallel execution
const pendingResults = new Map<string, Patch[]>(); // requirementId -> patches
const expectedOrder: string[] = [...pendingRequirements.map(r => r.id)];

function onEffectComplete(reqId: string, patches: Patch[]) {
  pendingResults.set(reqId, patches);
  flushInOrder();
}

function flushInOrder() {
  while (expectedOrder.length > 0) {
    const nextReqId = expectedOrder[0];
    if (!pendingResults.has(nextReqId)) break; // Wait for this one
    
    const patches = pendingResults.get(nextReqId)!;
    pendingResults.delete(nextReqId);
    expectedOrder.shift();
    
    enqueue({ type: 'FulfillEffect', requirementId: nextReqId, resultPatches: patches });
  }
}
```

#### 10.6.5 Timeout/Cancel in Ordering Buffer (ORD-PARALLEL)

| Rule ID | Description |
|---------|-------------|
| ORD-TIMEOUT-1 | Timeout/cancel MUST produce a fulfillment outcome for ordering purposes |
| ORD-TIMEOUT-2 | Timeout result (error patch) MUST be enqueued to pendingResults like success |
| ORD-TIMEOUT-3 | Ordering buffer MUST NOT stall waiting for timed-out requirements |

**Why This Matters:**

Without this rule, a timeout on requirement R1 could stall the ordering buffer forever:

```
Expected order: [R1, R2, R3]
R2 completes -> stored in pendingResults
R3 completes -> stored in pendingResults
R1 times out -> ??? (buffer stuck waiting for R1)
```

**Correct Pattern:**

```typescript
function onEffectTimeout(reqId: string, error: Error) {
  // Timeout produces a fulfillment outcome (error patches)
  const errorPatches = createTimeoutErrorPatches(reqId, error);
  pendingResults.set(reqId, errorPatches);  // ORD-TIMEOUT-1
  flushInOrder();  // Buffer can now proceed
}

function onEffectCancel(reqId: string) {
  // Cancel also produces an outcome (empty or cancel-marker patches)
  const cancelPatches = createCancelPatches(reqId);
  pendingResults.set(reqId, cancelPatches);  // ORD-TIMEOUT-1
  flushInOrder();
}
```

### 10.7 FulfillEffect Job Contract

FulfillEffect job MUST perform the complete requirement lifecycle atomically, with stale/duplicate protection.

**Scope Clarification:** FulfillEffect handles **Core-generated Requirements** (from Flow evaluation). It receives `Patch[]`, not fragments or expressions.

#### 10.7.1 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| FULFILL-0 | **FulfillEffect MUST verify requirementId exists in pendingRequirements before applying** |
| FULFILL-1 | FulfillEffect MUST apply result patches (only if FULFILL-0 passes) |
| FULFILL-2 | FulfillEffect MUST clear requirement from `pendingRequirements` |
| FULFILL-3 | FulfillEffect MUST enqueue ContinueCompute |
| FULFILL-4 | Steps 0, 1, 2, 3 MUST be executed in one job (no splitting) |

#### 10.7.2 FULFILL-0: Stale/Duplicate Protection (Critical)

**Why This Is Critical:**

```
Timeline of timeout race condition:
1. Effect request sent (requirementId = R1)
2. Timeout fires -> Apply error patch -> Clear R1 -> ContinueCompute
3. Compute continues, maybe retries or moves on
4. Original network request FINALLY completes
5. FulfillEffect(R1, successPatches) arrives

WITHOUT FULFILL-0:
  -> successPatches applied AFTER timeout was processed
  -> State corrupted, timeout decision overwritten
  -> Non-reproducible trace

WITH FULFILL-0:
  -> R1 not in pendingRequirements (already cleared by timeout)
  -> FulfillEffect logs "stale" and returns without apply
  -> State preserved, deterministic
```

**Scenarios requiring FULFILL-0:**

| Scenario | What Happens | Without FULFILL-0 | With FULFILL-0 |
|----------|--------------|-------------------|----------------|
| Timeout then late success | Late result arrives | Overwrites timeout | Dropped as stale |
| Duplicate effect completion | Same req fulfilled twice | Double apply | Second dropped |
| Cancel during execution | Cancel clears, result arrives | Applies anyway | Dropped as stale |
| Retry after failure | Old attempt completes | Conflicts with retry | Dropped as stale |

#### 10.7.3 Implementation (Stale-Safe)

```typescript
function handleFulfillEffect(job: FulfillEffect) {
  const snapshot = ctx.getCanonicalHead();

  // FULFILL-0: Check if requirement is still pending
  if (!isPendingRequirement(snapshot, job.requirementId)) {
    // Stale or duplicate - requirement already processed
    traceStaleOrDuplicateFulfillment(job);  // MUST log for debugging
    return;  // MUST NOT apply, MUST NOT continue
  }

  // FULFILL-1: Apply result patches
  applyPatches(job.resultPatches);
  
  // FULFILL-2: Clear requirement
  clearRequirement(job.requirementId);
  
  // FULFILL-3: Continue
  enqueue({ type: 'ContinueCompute', intentId: job.intentId });
}

function isPendingRequirement(snapshot: Snapshot, reqId: string): boolean {
  return snapshot.system.pendingRequirements.some(r => r.id === reqId);
}
```

#### 10.7.4 Stale Detection Logging (MUST)

| Rule ID | Description |
|---------|-------------|
| FULFILL-0-LOG | Stale/duplicate FulfillEffect MUST be logged with requirementId and reason |
| FULFILL-0-TRACE | If tracing is enabled, stale fulfillment MUST appear in trace as "dropped:stale" |

Silent drops make debugging impossible. Always log.

### 10.8 ~~Translator Output Processing~~ (DEPRECATED)

> **DEPRECATED (v2.0.1)**
>
> This section is **deprecated**. Host no longer handles Translator output directly.
> Translator processing is the responsibility of the App layer.
>
> See Section 9 (Compiler Integration - DEPRECATED) and FDR-H024 for details.

~~Translator output processing is **distinct from Core Requirement lifecycle**.~~

**v2.0.1 Approach:**
- Host receives only concrete `Patch[]`
- App layer handles Translator processing externally
- No `ApplyTranslatorOutput` job type in Host

#### 10.8.1 ~~Rules~~ (DEPRECATED)

| Rule ID | Description | Status |
|---------|-------------|--------|
| ~~TRANS-1~~ | ~~LLM translate call is treated as Host-level async operation~~ | **DEPRECATED** |
| ~~TRANS-2~~ | ~~Translator fragments MUST be processed via `ApplyTranslatorOutput` job~~ | **DEPRECATED** |
| ~~TRANS-3~~ | ~~Lower -> Evaluate -> Apply MUST run synchronously in ONE job~~ | **DEPRECATED** |
| ~~TRANS-4~~ | ~~Splitting Lower/Evaluate/Apply into separate jobs is FORBIDDEN~~ | **DEPRECATED** |

**v2.0.1:** These rules are now the responsibility of the App layer's `TranslatorAdapter`.

### 10.9 Effect Runner Location

Effect execution happens **outside the mailbox**.

```
Execution mailbox (single-writer, run-to-completion)
  Job1 -> Job2 -> Job3 -> ...

effect request
v
Effect runner (async, outside mailbox, may parallelize)
  - Executes IO/network/external calls
  - Returns Patch[] (never throws)
  - Enqueues FulfillEffect to mailbox
```

### 10.10 Canonical Head

"Current snapshot" in job processing means that execution's canonical head.

```typescript
function handleJob(job: Job, context: ExecutionContext) {
  // Correct: read this execution's head
  const snapshot = context.getCanonicalHead();

  // Wrong: implies global state
  // const snapshot = getCurrentSnapshot();
}
```

---

## 11. Context Determinism (v2.0.1)

This section defines the determinism requirements for `HostContext` to preserve the `f(snapshot) = snapshot'` philosophy.

### 11.1 Problem Statement

`HostContext` provides temporal and random values to Core computation:

```typescript
type HostContext = {
  readonly now: number;        // Current timestamp
  readonly randomSeed: string; // Seed for deterministic randomness
  readonly env?: Record<string, unknown>;
};
```

**Issue:** If `now` is called multiple times during a single job and returns different values, determinism is broken.

```typescript
// WRONG: Different timestamps within same job
function handleStartIntent(job) {
  const ctx1 = getContext();  // now = 1000
  Core.compute(..., ctx1);

  const ctx2 = getContext();  // now = 1005 (5ms later!)
  Core.apply(..., ctx2);      // Different context!
}
```

### 11.2 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| CTX-1 | HostContext MUST be frozen at the start of each job |
| CTX-2 | All operations within a single job MUST use the same frozen context |
| CTX-3 | `now` value MUST NOT change during job execution |
| CTX-4 | `randomSeed` MUST be deterministically derived from intentId |
| CTX-5 | Context MUST be captured ONCE per job, not per operation |

### 11.3 Frozen Context Pattern

```typescript
// CORRECT: Freeze context at job start
function handleStartIntent(job: StartIntent) {
  // Capture context ONCE at job start
  const frozenContext: HostContext = {
    now: Date.now(),                    // Captured once
    randomSeed: job.intentId,           // Deterministic from intentId
    env: getEnvironment(),
  };

  const snapshot = ctx.getCanonicalHead();
  const result = Core.compute(schema, snapshot, job.intent, frozenContext);

  if (result.patches.length > 0) {
    // Same frozenContext for apply
    applyPatches(result.patches, frozenContext);
  }

  // ... rest of job uses same frozenContext
}

// WRONG: Call getContext() multiple times
function handleStartIntent(job: StartIntent) {
  const result = Core.compute(..., getContext());  // now = 1000
  applyPatches(result.patches, getContext());      // now = 1005 - VIOLATION!
}
```

### 11.4 Context Scope

| Scope | Context Behavior |
|-------|-----------------|
| **Per Job** | Context frozen at job start (REQUIRED) |
| Per Iteration | Context frozen at iteration start (ACCEPTABLE but less precise) |
| Per Operation | Context created per call (FORBIDDEN - breaks determinism) |

### 11.5 Deterministic Replay

For trace replay and debugging, the frozen context values MUST be recorded:

```typescript
type TraceEntry = {
  jobType: string;
  intentId: string;
  frozenContext: HostContext;  // Recorded for replay
  // ...
};

// Replay uses recorded context, not current time
function replayJob(trace: TraceEntry) {
  const frozenContext = trace.frozenContext;  // From trace, not Date.now()
  Core.compute(schema, snapshot, intent, frozenContext);
}
```

### 11.6 Implementation Pattern

```typescript
interface HostContextProvider {
  /**
   * Create a frozen context for a job.
   * MUST be called once at job start.
   */
  createFrozenContext(intentId: string): HostContext;
}

class DefaultHostContextProvider implements HostContextProvider {
  constructor(
    private readonly nowProvider: () => number = Date.now,
    private readonly envProvider: () => Record<string, unknown> = () => ({})
  ) {}

  createFrozenContext(intentId: string): HostContext {
    return Object.freeze({
      now: this.nowProvider(),      // Called once, frozen
      randomSeed: intentId,          // Deterministic
      env: this.envProvider(),
    });
  }
}
```

### 11.7 Testing Determinism

For deterministic tests, inject a fixed `nowProvider`:

```typescript
// Test setup
const testProvider = new DefaultHostContextProvider(
  () => 1704067200000,  // Fixed timestamp: 2024-01-01T00:00:00Z
  () => ({ NODE_ENV: 'test' })
);

// All jobs will have the same frozen timestamp
const context = testProvider.createFrozenContext(intentId);
// context.now === 1704067200000 (always)
```

---

## 12. Invariants

### 12.1 Core-Host Invariants

| ID | Invariant |
|----|-----------|
| INV-CH-1 | Core computes, Host executes; boundary is absolute |
| INV-CH-2 | Snapshot is the single communication channel |
| INV-CH-3 | No resume - each compute() is complete |
| INV-CH-4 | Effect handlers return Patch[], never throw |

### 12.2 Intent Processing Invariants

| ID | Invariant |
|----|-----------|
| INV-IP-1 | Flows MUST be re-entrant |
| INV-IP-2 | All progress state MUST be in Snapshot |
| INV-IP-3 | intentId MUST remain stable throughout execution |
| INV-IP-4 | Same intentId for EvaluationContext and Intent |

### 12.3 Requirement Lifecycle Invariants

| ID | Invariant |
|----|-----------|
| INV-RL-1 | requirementId is deterministically computed |
| INV-RL-2 | Requirement MUST be cleared after fulfillment |
| INV-RL-3 | Apply, Clear, Continue MUST be atomic sequence |

### 12.4 Execution Model Invariants (v2.0)

| ID | Invariant |
|----|-----------|
| INV-EX-1 | One mailbox per ExecutionKey |
| INV-EX-2 | ExecutionKey is opaque to Host |
| INV-EX-3 | Job handlers MUST NOT await |
| INV-EX-4 | Single runner per ExecutionKey at any time |
| INV-EX-5 | Effect results reinjected via FulfillEffect jobs |
| INV-EX-6 | All state mutations go through mailbox |
| INV-EX-7 | Enqueued jobs MUST eventually be processed (liveness) |
| INV-EX-8 | Effect results applied in deterministic order (ordering) |
| ~~INV-EX-9~~ | ~~FulfillEffect handles Core Requirements; ApplyTranslatorOutput handles Translator fragments~~ **DEPRECATED** |
| INV-EX-10 | **Runner MUST re-check queue before releasing guard (lost wakeup prevention)** |
| INV-EX-11 | **Blocked kicks MUST be remembered and retried (no lost wakeup)** |
| INV-EX-12 | **FulfillEffect MUST guarantee requirement clear even on error** |
| INV-EX-13 | **FulfillEffect MUST verify requirement is pending before applying (stale protection)** |
| INV-EX-14 | **Apply failure does NOT exempt from clear obligation** |
| INV-EX-15 | **Compute result patches MUST be applied before effect dispatch** |
| INV-EX-16 | **Timeout/cancel MUST produce fulfillment outcome for ordering (ORD-PARALLEL)** |
| INV-EX-17 | **Error patch recording is best-effort; failure MUST NOT block continue** |

### 12.5 Context Determinism Invariants (v2.0.1)

| ID | Invariant |
|----|-----------|
| INV-CTX-1 | **HostContext MUST be frozen at job start** |
| INV-CTX-2 | **All operations in a job MUST use the same frozen context** |
| INV-CTX-3 | **`now` value MUST NOT change during job execution** |
| INV-CTX-4 | **`randomSeed` MUST be deterministic (derived from intentId)** |
| INV-CTX-5 | **Frozen context MUST be recorded in trace for replay** |

### 12.6 Snapshot Type Invariants (v2.0.2)

| ID | Invariant |
|----|-----------|
| INV-SNAP-1 | **Host MUST use Core's canonical Snapshot type** |
| INV-SNAP-2 | **Host MUST NOT redefine Snapshot/SnapshotMeta/SystemState** |
| INV-SNAP-3 | **Host MUST preserve all Core-owned fields when applying patches** |
| INV-SNAP-4 | **Host MUST NOT write to Core-owned fields (status, lastError, errors, currentAction)** |
| INV-SNAP-5 | **Host reads Core fields but MUST NOT assume field absence** |
| INV-SNAP-6 | **Host-owned state MUST be stored in `data.$host` namespace** |
| INV-SNAP-7 | **Host MUST NOT extend Core's SystemState with custom fields** |

---

## 13. Error Handling

### 13.1 Effect Execution Errors

Effect handlers MUST NOT throw. Errors are expressed as patches.
Host-generated error patches MUST target `$host` or domain-owned paths.
Patches to `system.*` are forbidden (INV-SNAP-4).

### 13.2 Mailbox Processing Errors

| Error Type | Handling |
|------------|----------|
| Job handler throws (general) | Log error, continue to next job |
| **FulfillEffect throws** | **CRITICAL: See Section 13.4** |
| Mailbox corrupted | Reset mailbox, report error |
| Runner guard violation | Return immediately (re-entry attempt) |

### 13.3 Requirement Lifecycle Errors

| Error Type | Handling |
|------------|----------|
| Effect timeout | Apply timeout error patch (not `system.*`), clear requirement, continue |
| Effect network error | Apply error patch (not `system.*`), clear requirement, continue |
| Clear failed | CRITICAL: Must retry or fail execution |

### 13.4 FulfillEffect Error Handling (Critical)

**Core Principle:** FulfillEffect failures MUST NOT leave requirement in pending state. A pending requirement causes infinite loop on next `compute()`.

#### 13.4.1 Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| ERR-FE-1 | FulfillEffect MUST guarantee requirement is removed from pending, even on error |
| ERR-FE-2 | Apply failure does NOT exempt from clear obligation |
| ERR-FE-3 | If clear itself fails, escalate to ExecutionKey-level fatal |
| ERR-FE-4 | **Any FulfillEffect error MUST prevent requirementId from being re-executed in subsequent compute cycles** |

#### 13.4.2 ERR-FE-4 Rationale

The goal is NOT "apply succeeded -> clear" but "**requirement never runs twice**":

| Scenario | Wrong Approach | Correct Approach |
|----------|----------------|------------------|
| Apply throws | Don't clear (req remains) -> infinite loop | Clear anyway -> error patch -> continue |
| Partial apply | Don't clear -> re-runs and double-applies | Clear -> error patch with partial state |
| Clear throws | Ignore -> req remains -> infinite loop | Fatal for ExecutionKey |

**Key insight:** Even if apply fails completely, the requirement MUST be cleared. The alternative (re-execution) is worse than recording "effect failed" in state.

#### 13.4.3 Safe FulfillEffect Pattern (Corrected)

```typescript
function handleFulfillEffect(job: FulfillEffect) {
  const snapshot = ctx.getCanonicalHead();

  // FULFILL-0: Stale check
  if (!isPendingRequirement(snapshot, job.requirementId)) {
    traceStaleOrDuplicateFulfillment(job);
    return;
  }

  let applyError: Error | null = null;

  // Step 1: Attempt apply (may fail)
  try {
    applyPatches(job.resultPatches);
  } catch (error) {
    applyError = error;
    // DO NOT RETURN - must still clear
  }

  // Step 2: ALWAYS clear (ERR-FE-1, ERR-FE-2)
  try {
    clearRequirement(job.requirementId);
  } catch (clearError) {
    // ERR-FE-3: Clear failure is fatal - cannot recover safely
    escalateToFatal(job.intentId, clearError);
    return;
  }

  // Step 3: Record error if apply failed (best-effort), then continue
  if (applyError) {
    try {
      applyErrorPatch(job.intentId, job.requirementId, applyError); // not system.*
    } catch (patchError) {
      // ERR-FE-5: Error patch failure is logged but does NOT block continue
      logErrorPatchFailure(job, patchError);
    }
  }

  // Step 4: Continue (MUST happen)
  enqueue({ type: 'ContinueCompute', intentId: job.intentId });
}
```

#### 13.4.4 Error Patch Recording (ERR-FE-5)

| Rule ID | Description |
|---------|-------------|
| ERR-FE-5 | Error patch recording is best-effort; failure MUST NOT block ContinueCompute |

Error patches MUST NOT target `system.*`. Use `$host` or domain-owned paths.

**Rationale:** The priority order is:
1. **Clear** (non-negotiable - prevents infinite loop)
2. **Continue** (non-negotiable - execution must proceed)
3. **Error patch** (best-effort - nice to have for debugging)

If error patch recording fails:
- Log the failure for debugging
- Continue anyway (ContinueCompute MUST be enqueued)
- Alternatively, escalate to fatal if error visibility is critical for domain

#### 13.4.5 Why "Clear Before Error Patch"?

The order is: **Attempt Apply -> Clear -> Error Patch -> Continue**

NOT: Apply -> Error Patch -> Clear

Reason: If error patch application fails, we still need the requirement cleared. Clear is the **non-negotiable** step.

#### 13.4.5 Fatal Escalation

When clear fails, the ExecutionKey is in an unrecoverable state:

```typescript
function escalateToFatal(intentId: string, error: Error) {
  // 1. Log fatal error with full context
  logFatal({ intentId, error, snapshot: ctx.getCanonicalHead() });
  
  // 2. Mark execution as failed
  markExecutionFailed(ctx.executionKey, error);
  
  // 3. Emit failure to observers (World Protocol)
  emitExecutionFailure(ctx.executionKey, 'requirement_clear_failed');
  
  // 4. Stop processing this mailbox
  // (Do NOT continue - state is inconsistent)
}
```

---

## 14. Cross-Reference

### 14.1 Related Specifications

| Spec | Relationship |
|------|--------------|
| Core SPEC | Host executes Core's computation results |
| World Protocol SPEC | World provides ExecutionKey mapping |
| ~~Compiler SPEC~~ | ~~Host uses Compiler for Translator integration~~ **DEPRECATED (v2.0.1)** |
| App SPEC | App orchestrates Host and provides scheduling policy |

### 14.2 FDR References

| FDR | Topic |
|-----|-------|
| FDR-H001 ~ H011 | Core-Host boundary, Snapshot, Intent, Handlers |
| ~~FDR-H012 ~ H017~~ | ~~Compiler Integration (v1.x)~~ **DEPRECATED** |
| FDR-H018 ~ H022 | Execution Model (v2.0) |
| **FDR-H023** | **Context Determinism (v2.0.1)** |
| **FDR-H024** | **Compiler/Translator Decoupling (v2.0.1)** |
| FDR-EL-001 | Event-Loop Execution Model (source) |

### 14.3 App SPEC Alignment

App SPEC ARCH-2 states:
> "The Host is branch-agnostic and does not participate in scheduling."

This SPEC (v2.0) provides the **mechanism** for single-writer serialization, while App SPEC provides the **policy** (ExecutionKey mapping, ingress vs execution stage).

---

## Appendix A: Quick Reference

### A.1 Rule Summary by Category

| Category | Key Rules |
|----------|-----------|
| Core-Host | CORE-HOST-1~4: Absolute separation |
| Snapshot | SNAP-1~4: Single channel |
| Intent | INTENT-1~5, INTENT-ID-1~4: No resume, re-entry |
| Handler | HANDLER-1~5: No throw, Patch[], IO only |
| Requirement | REQ-*: Deterministic ID, clear obligation |
| ~~Compiler~~ | ~~COMP-1~6: Two-step processing~~ **DEPRECATED** (COMP-4,5 retained) |
| Mailbox | MAIL-1~4: Per-key serialization |
| Job | JOB-1~5: Await ban, fresh read; **COMP-REQ-INTERLOCK-1~2** |
| Runner | RUN-1~4: Single runner, **lost wakeup prevention** |
| Reinjection | REINJ-1~4: Via FulfillEffect |
| Liveness | LIVE-1~4: Enqueue -> eventually processed, **blocked kick retry** |
| Order | ORD-1~4: **Deterministic order**; **ORD-TIMEOUT-1~3** (buffer timeout handling) |
| FulfillEffect | **FULFILL-0~4**: Stale check, atomic lifecycle |
| ~~Translator~~ | ~~TRANS-1~4: Separate from FulfillEffect, single job~~ **DEPRECATED** |
| Error | ERR-FE-1~5: FulfillEffect must guarantee clear, **error patch best-effort** |
| **Context** | **CTX-1~5: Frozen per job, deterministic randomSeed (v2.0.1)** |

### A.2 Critical Violations

| Violation | Consequence |
|-----------|-------------|
| Await in job handler | Continuation state (INV-EX-3 violation) |
| Skip requirement clear | Infinite loop, duplicate effects |
| Direct apply from callback | Single-writer bypass (INV-EX-6 violation) |
| ~~Split Lower/Evaluate/Apply~~ | ~~Continuation state~~ **DEPRECATED** (moved to App) |
| Multiple runners same key | Race condition, lost updates |
| ~~Use FulfillEffect for Translator~~ | ~~Requirement lifecycle corruption~~ **DEPRECATED** |
| No runner kick on enqueue | Jobs never processed (liveness violation) |
| **No re-check before guard release** | **Lost wakeup -> permanent stall (LIVE-1 violation)** |
| **Forget blocked kick request** | **Lost wakeup -> permanent stall (LIVE-1 violation)** |
| **FulfillEffect throw without clear** | **Infinite loop on next compute()** |
| **Skip FULFILL-0 stale check** | **Timeout/cancel race -> state corruption** |
| **Clear only on apply success** | **Apply failure -> infinite loop** |
| **Effect dispatch before patch apply** | **FULFILL-0 false positive (stale)** |
| **Timeout not producing fulfillment outcome** | **Ordering buffer stall (ORD-PARALLEL)** |
| **Multiple getContext() calls per job** | **Non-deterministic timestamps (INV-CTX-3 violation)** |
| **Context not frozen at job start** | **f(snapshot) = snapshot' broken (INV-CTX-1 violation)** |

### A.3 Implementation Checklist

- [ ] Mailbox per ExecutionKey
- [ ] ExecutionKey opaque (no World/Proposal types in Host)
- [ ] Job handlers synchronous (no await)
- [ ] Single-runner guard with Set<ExecutionKey>
- [ ] **Blocked kick remembered in runnerKickRequested set (LIVE-4)**
- [ ] **Runner re-checks queue + kick flag before releasing guard (RUN-4)**
- [ ] Runner kick on empty->non-empty transition
- [ ] Effect results via FulfillEffect job (for Core Requirements)
- [x] ~~Translator output via ApplyTranslatorOutput job~~ **DEPRECATED** - Host receives only Patch[]
- [ ] **FulfillEffect checks pendingRequirements before apply (FULFILL-0)**
- [ ] FulfillEffect performs Apply + Clear + Continue atomically
- [ ] **FulfillEffect guarantees clear even on apply failure (ERR-FE-2)**
- [ ] **Error patch recording is best-effort, does not block continue (ERR-FE-5)**
- [ ] **Compute patches applied BEFORE effect dispatch (COMP-REQ-INTERLOCK-1)**
- [ ] **Effect dispatch list read from snapshot after apply (COMP-REQ-INTERLOCK-2, SHOULD)**
- [x] ~~Translator path as single job~~ **DEPRECATED** - moved to App layer
- [ ] Effect execution policy documented (ORD-SERIAL or ORD-PARALLEL)
- [ ] **If ORD-PARALLEL: timeout/cancel produces fulfillment outcome (ORD-TIMEOUT-1)**
- [ ] **HostContext frozen at job start, not per operation (CTX-1, CTX-5)**
- [ ] **Same frozen context used for all Core calls in a job (CTX-2)**
- [ ] **randomSeed derived from intentId (CTX-4)**
- [ ] **Frozen context recorded in trace for replay (CTX-5)**
- [ ] **No @manifesto-ai/compiler dependency (v2.0.1 decoupling)**

---

## Appendix B: Migration from v1.x

### B.1 New Requirements (v2.0)

| Requirement | Rule ID |
|-------------|---------|
| Mailbox per ExecutionKey | MAIL-1 |
| Job handler await ban | JOB-1, JOB-2 |
| Single-runner guard | RUN-1~3 |
| **Lost wakeup prevention (re-check)** | **RUN-4** |
| Liveness guarantee | LIVE-1~3 |
| **Blocked kick retry** | **LIVE-4** |
| Effect result reinjection | REINJ-1~4 |
| **Deterministic application order** | **ORD-1~4** |
| **Ordering buffer timeout handling** | **ORD-TIMEOUT-1~3** |
| **Stale/duplicate fulfillment protection** | **FULFILL-0** |
| FulfillEffect atomic sequence | FULFILL-1~4 |
| ~~Translator vs FulfillEffect separation~~ | ~~TRANS-1~4~~ **DEPRECATED** |
| **FulfillEffect error handling** | **ERR-FE-1~5** |
| **Compute-effect interlock** | **COMP-REQ-INTERLOCK-1~2** |

### B.1.1 New Requirements (v2.0.1)

| Requirement | Rule ID |
|-------------|---------|
| **HostContext frozen at job start** | **CTX-1** |
| **Same context for all operations in job** | **CTX-2** |
| **now value immutable during job** | **CTX-3** |
| **randomSeed from intentId** | **CTX-4** |
| **Context recorded in trace** | **CTX-5** |

### B.2 Backward Compatibility

v2.0/v2.0.1 does not change:
- Core-Host boundary (Section 4)
- Snapshot communication (Section 5)
- Effect handler contract (Section 7)

v2.0.1 **deprecates**:
- Compiler integration (Section 9) - Host is now decoupled from Compiler/Translator

v2.0/v2.0.1 **strengthens enforcement** of existing principles (FDR-H003, H008, H010).

### B.3 Implementation Impact

| Component | Impact |
|-----------|--------|
| Effect handlers | No change |
| ~~Translator integration~~ | **DEPRECATED** - Translator processing moved to App layer |
| Intent processing | Restructure as job queue; **apply patches before effect dispatch**; **read requirements from snapshot** |
| Requirement lifecycle | Ensure atomic Clear step; **stale check before apply** |
| Error handling | **Clear even on apply failure**; **error patch is best-effort** |
| ORD-PARALLEL users | **Timeout/cancel must produce fulfillment outcome** |
| **Context handling (v2.0.1)** | **Freeze context at job start; use same context throughout job** |

---

## Appendix C: Job Type Reference (Informative)

This appendix provides **example job shapes** for reference implementation. The specific union type is NOT normative; what is normative is the behavioral contract in Section 10.

### C.1 Reference Job Union

```typescript
// INFORMATIVE: Reference job shapes
// Implementations MAY use different structures as long as Section 10 rules are satisfied

type Job =
  | StartIntent
  | ContinueCompute
  | FulfillEffect
  | ApplyPatches;
  // NOTE: ApplyTranslatorOutput is DEPRECATED (v2.0.1)
  // Translator processing is now handled by App layer

interface StartIntent {
  readonly type: 'StartIntent';
  readonly intentId: string;
  readonly intent: Intent;
}

interface ContinueCompute {
  readonly type: 'ContinueCompute';
  readonly intentId: string;
}

interface FulfillEffect {
  readonly type: 'FulfillEffect';
  readonly intentId: string;
  readonly requirementId: string;      // Core-generated requirement ID
  readonly resultPatches: Patch[];     // Concrete patches (NOT expressions)
}

interface ApplyPatches {
  readonly type: 'ApplyPatches';
  readonly patches: Patch[];
  readonly source: string;             // For debugging/tracing
}

// DEPRECATED: ApplyTranslatorOutput
// interface ApplyTranslatorOutput {
//   readonly type: 'ApplyTranslatorOutput';
//   readonly intentId: string;
//   readonly fragments: TranslatorFragment[];  // MEL IR, NOT Patch[]
// }
```

### C.2 Job Type Distinctions

| Job Type | Input | Source | Requirement Clear? |
|----------|-------|--------|-------------------|
| FulfillEffect | `Patch[]` | Core Requirement | YES |
| ApplyPatches | `Patch[]` | Direct patches | NO |
| ~~ApplyTranslatorOutput~~ | ~~`TranslatorFragment[]`~~ | ~~Translator~~ | **DEPRECATED** |

### C.3 When to Use Each

| Scenario | Job Type |
|----------|----------|
| Effect handler returned | FulfillEffect |
| Direct state mutation (rare) | ApplyPatches |
| Resume after effect | ContinueCompute |
| New intent arrives | StartIntent |
| ~~Translator completed~~ | ~~ApplyTranslatorOutput~~ **DEPRECATED** - use App layer |

---

*End of Host Contract Specification v2.0*
