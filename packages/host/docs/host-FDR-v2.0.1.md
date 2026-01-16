# Host Contract — Foundational Design Rationale (FDR)

> **Version:** 2.0.1
> **Status:** Normative
> **Purpose:** Document the "Why" behind every constitutional decision in the Host Contract
> **Changelog:**
> - v1.0: Initial release (FDR-H001 ~ H010)
> - v1.x: Compiler Integration, Expression Evaluation (FDR-H011 ~ H017)
> - v2.0: Event-Loop Execution Model (FDR-H018 ~ H022)
> - **v2.0.1: Context Determinism (FDR-H023)**

---

## Part IV: Event-Loop Execution Model (v2.0)

This section documents the foundational decisions for execution model enforcement. While FDR-H008 (Single-Writer Concurrency) establishes the **principle**, this section defines the **enforcement mechanism**.

### Table of Contents (v2.0/v2.0.1)

| FDR | Title | Key Decision |
|-----|-------|--------------|
| FDR-H018 | Execution Mailbox per ExecutionKey | Single-writer queue keyed by opaque ExecutionKey |
| FDR-H019 | Run-to-Completion Job Model | Job handlers MUST NOT await; effect execution as job splitting |
| FDR-H020 | Single-Runner Invariant | One runner per ExecutionKey at any time |
| FDR-H021 | Effect Result Reinjection Protocol | Effect results return via FulfillEffect jobs |
| FDR-H022 | Requirement Lifecycle Enforcement | H007 + H010 as atomic sequence |
| **FDR-H023** | **Context Determinism (v2.0.1)** | **HostContext frozen per job; f(snapshot) = snapshot' preserved** |

### Motivation

FDR-H008 states: "Intent processing MUST be serialized per Snapshot lineage."

However, **the absence of an explicit enforcement mechanism** allows interleaving issues during async operations—not as occasional bugs, but as structural failures.

```typescript
// ❌ Interleaving creates logical concurrency
async function processIntent(snapshot, intent) {
  const lowered = await translate(intent);      // ← interleave point 1
  const evaluated = await evaluate(lowered);    // ← interleave point 2
  Core.apply(snapshot, evaluated);              // ← snapshot may be stale
}
```

At each `await` point, other code can execute. If that code modifies the snapshot, **lost updates** occur.

**Key Insight**: Event-loop elegance comes not from "single thread" but from these rules:

| Rule | Description |
|------|-------------|
| **Run-to-Completion** | One job runs to completion without interruption |
| **Single Writer** | State commits are serialized through a single queue (mailbox) |
| **No Continuation State** | Don't carry intermediate local state; re-read state and recompute |
| **Handlers are Observers** | Event handlers don't mutate state; they only enqueue |

This section enforces these rules at the Host Contract level.

---

## FDR-H018: Execution Mailbox per ExecutionKey

### Decision

**Host MUST maintain a single-writer mailbox per `ExecutionKey`, where `ExecutionKey` is opaque to Host.**

### Context

World Protocol (FDR-W017) permits multiple Proposals from the same baseWorld to execute in parallel, each creating separate branches.

If mailbox is keyed by `baseWorld`:
- Parallel branches (permitted by W017) would be artificially serialized
- Valid parallelism blocked by enforcement mechanism

If mailbox is keyed by `proposalId` (or equivalent opaque key):
- Single-writer within an execution ✓
- Parallel branches preserved ✓

### Rationale

**Layer Boundary Preservation**:

Host Contract must not know about World's governance concepts (Proposal/Authority). The boundary is:

| Layer | Knows | Provides |
|-------|-------|----------|
| **Host** | ExecutionKey (opaque), intentId, Snapshot | Single-writer serialization |
| **World** | proposalId, baseWorldId, branch | ExecutionKey mapping |
| **App** | User intent, UI state | Orchestration policy |

```typescript
// ✅ Correct: World/App maps proposalId → ExecutionKey
function getExecutionKey(proposalId: string): ExecutionKey {
  return proposalId;  // or hash, or composite key
}

// ❌ Wrong: Host directly uses proposalId
// Host should not import ProposalId type from World
```

### Normative Requirement

```
For a given ExecutionKey, Host MUST ensure single-runner + single-writer 
processing of all compute/apply/effect-fulfillment steps.
```

### Type Definition

```typescript
// Host layer: opaque identifier
type ExecutionKey = string;  // Opaque to Host

// Host internal structure (reference)
interface ExecutionMailbox {
  readonly key: ExecutionKey;
  enqueue(job: Job): void;
  dequeue(): Job | undefined;
  isEmpty(): boolean;
}
```

### Canonical Head Clarification

"Current snapshot" in job processing means **that execution's canonical head**, not a global latest:

```typescript
// In job handler
function handleJob(job: Job, context: ExecutionContext) {
  // ✅ Correct: read this execution's head
  const snapshot = context.getCanonicalHead();
  
  // ❌ Wrong: implies global state
  // const snapshot = getCurrentSnapshot();
}
```

### Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              World (baseWorld: W1)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │ Execution Mailbox   │    │ Execution Mailbox   │        │
│  │ key: P1 (opaque)    │    │ key: P2 (opaque)    │        │
│  │  → branch A         │    │  → branch B         │        │
│  │  [serial jobs]      │    │  [serial jobs]      │        │
│  └─────────────────────┘    └─────────────────────┘        │
│           │                          │                      │
│           ▼                          ▼                      │
│    run-to-completion           run-to-completion            │
│                                                             │
│         ←── parallel permitted (W017) ──→                  │
└─────────────────────────────────────────────────────────────┘

World provides: proposalId → ExecutionKey mapping
Host provides: ExecutionKey → Mailbox serialization
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Global single mailbox | Blocks W017-permitted parallelism |
| baseWorld as key | Same as above |
| No mailbox (trust caller) | No enforcement; interleaving bugs |

### Consequences

- Host provides single-writer serialization keyed by opaque ExecutionKey
- World/App determines ExecutionKey mapping policy
- Parallel branch execution is preserved
- Clear layer boundary maintained

---

## FDR-H019: Run-to-Completion Job Model

### Decision

**Host's effect execution MUST be modeled as "job splitting," not "blocking await."**

Job handlers MUST NOT await external work (effects, network, translator). This is the **job handler await ban**.

### Context

FDR-H003 (No Resume, No Continuation) prohibits suspended execution context. However, `await` inside a job handler creates implicit continuation state:

```typescript
// ❌ Continuation state (violates H003)
async function handleStartIntent(job) {
  const computed = Core.compute(snapshot, job.intent);
  if (computed.pendingRequirements.length > 0) {
    const result = await executeEffect(computed.pendingRequirements);
    // 'computed' is continuation state held across await
    Core.apply(snapshot, result);
  }
}
```

### Rationale

**Run-to-Completion Rules**:

| Rule | Scope | Requirement |
|------|-------|-------------|
| **Job Handler Await Ban** | Inside job handler | MUST NOT await external work |
| **Mailbox Drain Async** | Mailbox processing loop | MAY yield between jobs for UI responsiveness |
| **Single-Runner Invariant** | Per ExecutionKey | MUST ensure only one runner processes mailbox at any time |

**Correct Pattern (Job Splitting)**:

```typescript
// ✅ Job splitting (compliant with H003)
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

function handleFulfillEffect(job) {
  const snapshot = context.getCanonicalHead();  // Fresh read again
  applyPatches(job.resultPatches);
  clearRequirement(job.requirementId);  // H010 MUST
  enqueue({ type: 'ContinueCompute', intentId: job.intentId });
}
```

**Job Lifecycle**:

```
Job declares "effect needed" → Job terminates (run-to-completion)
                                      ↓
Effect executes (outside mailbox) → Result arrives
                                      ↓
FulfillEffect job enqueued → Patches applied → ContinueCompute enqueued
```

### Async Mailbox Drain

The mailbox processing loop MAY be async for UI responsiveness, but the single-runner invariant MUST hold:

```typescript
// ✅ ALLOWED: async mailbox drain with single-runner guard
async function processMailbox(key: ExecutionKey) {
  if (runnerActive.has(key)) return;  // Single-runner guard
  runnerActive.add(key);
  
  try {
    while (!queue.isEmpty()) {
      const job = queue.dequeue();
      runJobSync(job);  // Synchronous execution (no await inside)
      await yieldToUI();  // MAY yield between jobs
    }
  } finally {
    runnerActive.delete(key);
  }
}
```

### Effect Runner Location

Effect execution happens **outside the mailbox**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Execution Mailbox                         │
│  (single-writer, run-to-completion)                         │
├─────────────────────────────────────────────────────────────┤
│  Job1 → Job2 → Job3 → ...                                   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ effect request
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Effect Runner                             │
│  (async, outside mailbox, may parallelize)                  │
├─────────────────────────────────────────────────────────────┤
│  • Executes IO/network/external calls                       │
│  • Returns Patch[] (FDR-H005: never throws)                 │
│  • Enqueues FulfillEffect to mailbox                        │
└─────────────────────────────────────────────────────────────┘
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Await inside job handler | Creates continuation state (H003 violation) |
| Generators/coroutines | Platform-dependent, hard to persist |
| Promise chaining | Hidden continuation; hard to serialize |

### Consequences

- Job handlers are synchronous (no await)
- Effect execution is job splitting, not blocking
- Each job reads fresh snapshot (re-entry compliant)
- No continuation state to serialize or lose

---

## FDR-H020: Single-Runner Invariant

### Decision

**For each ExecutionKey, Host MUST ensure only ONE runner processes the mailbox at any time. Runner MUST re-check mailbox before releasing guard (lost wakeup prevention).**

### Context

If multiple runners process the same mailbox:
- Jobs may be processed out of order
- Same job may be processed twice
- Race condition on queue state

Additionally, without re-check before guard release, a **lost wakeup** can occur.

### Lost Wakeup Problem

**Critical Edge Case:**

```
1. Runner processing last job, queue becomes empty
2. Runner exits while loop, but BEFORE runnerActive.delete(key)
3. Effect callback arrives, enqueues FulfillEffect
4. enqueue() sees empty→non-empty, calls processMailbox(key)
5. processMailbox() sees runnerActive.has(key) = true, returns immediately
6. Original runner does runnerActive.delete(key), exits
7. New job sits in queue forever — LIVE-1 VIOLATION
```

This is NOT rare. It occurs whenever effect results arrive during runner shutdown.

### Rationale

Single-runner is the foundation of single-writer guarantee. Lost wakeup prevention is required for liveness:

```typescript
// ❌ WRONG: No re-check (lost wakeup possible)
async function processMailbox(key: ExecutionKey) {
  if (runnerActive.has(key)) return;
  runnerActive.add(key);
  
  try {
    while (!queue.isEmpty()) {
      runJobSync(queue.dequeue());
    }
  } finally {
    runnerActive.delete(key);  // Job may be enqueued HERE and lost!
  }
}

// ✅ CORRECT: Re-check + kick flag
const runnerKickRequested = new Set<ExecutionKey>();

async function processMailbox(key: ExecutionKey) {
  if (runnerActive.has(key)) {
    runnerKickRequested.add(key);  // Remember blocked kick
    return;
  }
  runnerActive.add(key);
  
  try {
    while (true) {
      const job = queue.dequeue();
      if (!job) break;
      runJobSync(job);
      await yieldToUI();
    }
  } finally {
    runnerActive.delete(key);
    
    // Re-check before fully exiting
    if (!queue.isEmpty() || runnerKickRequested.has(key)) {
      runnerKickRequested.delete(key);
      queueMicrotask(() => processMailbox(key));
    }
  }
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Lock/mutex | Adds complexity; guard + re-check is simpler |
| Queue per call | Defeats serialization purpose |
| No guard (trust caller) | No enforcement; bugs |
| No re-check | Lost wakeup → permanent stall |

### Consequences

- Single-runner per ExecutionKey guaranteed
- Yield between jobs is safe with guard
- No concurrent processing of same mailbox
- Clear failure mode (skip) when re-entry attempted
- **Lost wakeup prevented by re-check + kick flag**

---

## FDR-H021: Effect Result Reinjection Protocol

### Decision

**Effect results MUST be reinjected to the mailbox as `FulfillEffect` jobs. Direct application from effect callback is FORBIDDEN.**

### Context

When effect execution completes, the result (Patch[]) must return to the mailbox for application:

```typescript
// ❌ WRONG: Direct application from callback
async function executeEffect(req: Requirement) {
  const patches = await effectRunner.execute(req);
  Core.apply(snapshot, patches);  // Outside mailbox! Violates single-writer!
}

// ✅ CORRECT: Reinject as job
async function executeEffect(key: ExecutionKey, req: Requirement) {
  const patches = await effectRunner.execute(req);
  
  // Reinject to mailbox
  mailbox.get(key).enqueue({
    type: 'FulfillEffect',
    requirementId: req.id,
    intentId: req.intentId,
    resultPatches: patches
  });
  
  // Trigger processing
  processMailbox(key);
}
```

### Rationale

Direct application bypasses:
1. Single-writer serialization (H008)
2. Run-to-completion guarantee (H019)
3. Snapshot version consistency

Reinjection ensures:
1. All mutations go through mailbox
2. Version checks apply
3. Other pending jobs processed in order

### Protocol Steps

```
1. Effect Request
   Job: StartIntent
   Action: requestEffectExecution(key, requirement)
   
2. Effect Execution (outside mailbox)
   effectRunner.execute(requirement) → Patch[]
   
3. Result Reinjection (back to mailbox)
   enqueue(FulfillEffect { requirementId, resultPatches })
   
4. Result Processing (inside mailbox)
   Job: FulfillEffect
   Action: applyPatches, clearRequirement, enqueueContinue
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Direct apply from callback | Bypasses single-writer |
| Return value from effect | Requires continuation (H003 violation) |
| Event emission | Non-deterministic ordering |

### Consequences

- All state mutations serialize through mailbox
- Effect results traceable as jobs
- No hidden mutation paths
- Clear reinjection protocol

---

## FDR-H022: Requirement Lifecycle Enforcement

### Decision

**Host MUST follow the requirement lifecycle as an atomic sequence. Skipping any step is a SPEC VIOLATION. Additionally, Host MUST protect against stale/duplicate fulfillments and guarantee clear even on apply failure.**

This decision strengthens FDR-H007 (Deterministic Requirement ID) and FDR-H010 (Requirement Clearing Obligation) into an enforced sequence with race condition protection.

### Context

Requirement lifecycle from H007 and H010:
1. Generate: `requirementId = hash(schemaHash + intentId + actionId + flowNodePath + effectSignature)`
2. Execute: Effect runner processes requirement
3. Apply: Result patches applied to snapshot
4. Clear: Remove from `pendingRequirements`
5. Continue: Re-invoke compute

If any step is skipped:

| Skipped Step | Failure Mode |
|--------------|--------------|
| Generate | Non-deterministic ID; replay fails |
| Execute | Effect never runs; stalled |
| Apply | State not updated; logic fails |
| **Clear** | **Infinite loop; duplicate effects** |
| Continue | Execution incomplete; stalled |

### Rationale

**The Clear Step is Critical**

FDR-H010 states: "Host MUST clear fulfilled Requirements before re-invoking compute()."

This is not a suggestion. Without clearing:

```
Iteration 1: compute() → requirement R1 in pending
             execute R1 → apply result
             [MISSING: clear R1]
             
Iteration 2: compute() → R1 still in pending!
             execute R1 again → duplicate effect!
             ...infinite loop
```

### Stale/Duplicate Fulfillment Protection (FULFILL-0)

**Critical Race Condition: Timeout/Cancel/Duplicate**

```
Timeline:
1. Effect request sent (requirementId = R1)
2. Timeout fires → Apply error patch → Clear R1 → ContinueCompute
3. Compute continues, moves on
4. Original network request FINALLY completes
5. FulfillEffect(R1, successPatches) arrives

WITHOUT FULFILL-0:
  → successPatches applied AFTER timeout was processed
  → State corrupted, timeout decision overwritten

WITH FULFILL-0:
  → R1 not in pendingRequirements (already cleared)
  → FulfillEffect logs "stale" and returns without apply
  → State preserved, deterministic
```

**FULFILL-0 Rule**: Before applying, check if `requirementId` is still in `pendingRequirements`. If not, the fulfillment is stale/duplicate and MUST be dropped (with logging).

### Error Handling: Clear Even on Apply Failure (ERR-FE-4)

**Wrong Mental Model**: "Clear only if apply succeeded"
**Correct Mental Model**: "Clear ALWAYS, to prevent re-execution"

```typescript
// ❌ WRONG: Clear only on success
function handleFulfillEffect(job: FulfillEffect) {
  try {
    applyPatches(job.resultPatches);
    clearRequirement(job.requirementId);  // Not reached on throw
  } catch (e) {
    // Clear NOT called → requirement still pending → infinite loop
  }
}

// ✅ CORRECT: Clear always
function handleFulfillEffect(job: FulfillEffect) {
  if (!isPendingRequirement(snapshot, job.requirementId)) {
    traceStale(job);
    return;  // FULFILL-0
  }
  
  let applyError = null;
  try {
    applyPatches(job.resultPatches);
  } catch (e) {
    applyError = e;
    // DO NOT RETURN
  }
  
  clearRequirement(job.requirementId);  // ALWAYS (ERR-FE-4)
  
  if (applyError) {
    applyErrorPatch(job.intentId, applyError);
  }
  
  enqueue({ type: 'ContinueCompute', intentId: job.intentId });
}
```

### Compute-Effect Interlock (COMP-REQ-INTERLOCK-1)

**All snapshot mutations from `Core.compute()` MUST be applied BEFORE effect execution requests are dispatched.**

Why: Core.compute() returns both patches (including `pendingRequirements` update) and effect execution needs. If effect execution starts BEFORE patches are applied:
- `pendingRequirements` may not contain the new requirement yet
- FULFILL-0 check will incorrectly treat fulfillment as "stale"

```typescript
// ✅ CORRECT order
const result = Core.compute(schema, snapshot, intent);
applyPatches(result.patches);              // FIRST: includes pendingRequirements
requestEffectExecution(result.requirements); // THEN: dispatch
```

### Enforcement as Atomic Sequence

```typescript
// FulfillEffect job MUST perform ALL of:
function handleFulfillEffect(job: FulfillEffect) {
  // Step 0: Stale check (FULFILL-0)
  if (!isPendingRequirement(snapshot, job.requirementId)) {
    traceStaleOrDuplicateFulfillment(job);  // MUST log
    return;
  }
  
  // Step 3: Attempt apply (may fail)
  let applyError = null;
  try {
    applyPatches(job.resultPatches);
  } catch (e) {
    applyError = e;
  }
  
  // Step 4: Clear requirement (H010 - MUST, even on error)
  clearRequirement(job.requirementId);
  // ⚠️ Skipping this step is a SPEC VIOLATION
  
  // Step 4.5: Record error if apply failed
  if (applyError) {
    applyErrorPatch(job.intentId, job.requirementId, applyError);
  }
  
  // Step 5: Continue
  enqueue({ type: 'ContinueCompute', intentId: job.intentId });
}
```

### Lifecycle Diagram (Updated)

```
┌─────────────────────────────────────────────────────────────┐
│                  Requirement Lifecycle                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. GENERATE                                                │
│     requirementId = hash(schema + intent + action + path    │
│                         + effectSignature)                  │
│     [FDR-H007]                                              │
│           │                                                 │
│           ▼                                                 │
│  2. EXECUTE                                                 │
│     effectRunner.execute(requirement) → Patch[]             │
│     [FDR-H005: never throws]                                │
│           │                                                 │
│           ▼                                                 │
│  0. STALE CHECK ⚠️ NEW                                       │
│     if not in pendingRequirements → drop (log)              │
│     [FULFILL-0]                                             │
│           │                                                 │
│           ▼                                                 │
│  3. APPLY (may fail)                                        │
│     Core.apply(snapshot, resultPatches)                     │
│     [FDR-H002: Snapshot as sole channel]                    │
│           │                                                 │
│           ▼                                                 │
│  4. CLEAR ⚠️ CRITICAL (even on apply failure)               │
│     remove from pendingRequirements                         │
│     [FDR-H010 + ERR-FE-4: MUST clear]                       │
│           │                                                 │
│           ▼                                                 │
│  5. CONTINUE                                                │
│     enqueue(ContinueCompute)                                │
│     [FDR-H003: re-entry]                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Skipping step 4 causes: infinite loop, duplicate effects, stalled execution
Skipping step 0 causes: stale fulfillment overwrites valid state (timeout race)
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Auto-clear by Core | Implicit; hard to debug |
| Idempotent requirements | Most effects aren't idempotent |
| Clear-on-read | Race condition with multiple requirements |
| Clear only on success | Apply failure leaves req pending → infinite loop |
| No stale check | Timeout/cancel race corrupts state |

### Consequences

- Requirement lifecycle is atomic sequence
- Step 4 (clear) is mandatory, not optional
- Step 0 (stale check) prevents race condition corruption
- Clear happens even on apply failure
- Skipping any step is SPEC VIOLATION
- Clear debugging when violations occur

---

## FDR-H023: Context Determinism (v2.0.1)

### Decision

**HostContext MUST be frozen at the start of each job. All operations within a job MUST use the same frozen context. This preserves `f(snapshot) = snapshot'` determinism.**

### Context

`HostContext` provides temporal and random values to Core computation:

```typescript
type HostContext = {
  readonly now: number;        // Current timestamp
  readonly randomSeed: string; // Seed for deterministic randomness
  readonly env?: Record<string, unknown>;
};
```

**Problem Identified:**

The v1.x and v2.0 implementations allowed `getContext()` to be called multiple times during a single job, returning different `now` values:

```typescript
// ❌ BROKEN: Different timestamps within same job
function handleStartIntent(job) {
  const ctx1 = getContext();  // now = 1000
  Core.compute(..., ctx1);

  // 5ms later...
  const ctx2 = getContext();  // now = 1005
  Core.apply(..., ctx2);      // Different context!
}
```

This breaks the fundamental equation:

```
compute(schema, snapshot, intent) -> (snapshot', requirements, trace)
```

If `now` differs between calls, the same logical operation produces different results depending on wall-clock timing.

### Rationale

**The Core Axiom States:**

> "Same inputs MUST always produce same outputs" (CLAUDE.md §1)

If `HostContext.now` is a function that returns different values on each call, **the input is not the same**, even though `snapshot` and `intent` are identical.

**Consequences of Non-Deterministic Context:**

| Scenario | Without Frozen Context | With Frozen Context |
|----------|----------------------|---------------------|
| Same job, two Core calls | Different `now` values | Same `now` value |
| Trace replay | Different results | Identical results |
| Debugging | Non-reproducible | Reproducible |
| Computed values using `now` | Inconsistent | Consistent |

**Why Per-Job, Not Per-Iteration?**

Jobs are the atomic unit of work in the mailbox model (FDR-H019). A job runs to completion without interruption. Therefore:
- Context MUST be frozen at job start
- All operations within the job share the same context
- This aligns with run-to-completion semantics

### Implementation Pattern

```typescript
interface HostContextProvider {
  /**
   * Create a frozen context for a job.
   * MUST be called ONCE at job start.
   */
  createFrozenContext(intentId: string): HostContext;
}

// ✅ CORRECT: Freeze context at job start
function handleStartIntent(job: StartIntent) {
  const frozenContext: HostContext = Object.freeze({
    now: Date.now(),           // Captured once
    randomSeed: job.intentId,  // Deterministic from intentId
    env: getEnvironment(),
  });

  const snapshot = ctx.getCanonicalHead();
  const result = Core.compute(schema, snapshot, job.intent, frozenContext);

  if (result.patches.length > 0) {
    applyPatches(result.patches, frozenContext);  // Same context
  }

  // All subsequent operations use frozenContext
}
```

### randomSeed Derivation

`randomSeed` MUST be deterministically derived from `intentId`:

```typescript
// ✅ CORRECT: Deterministic from intentId
const frozenContext = {
  now: Date.now(),
  randomSeed: intentId,  // Same intent → same seed
  env: {},
};

// ❌ WRONG: Random per call
const frozenContext = {
  now: Date.now(),
  randomSeed: crypto.randomUUID(),  // Non-deterministic!
  env: {},
};
```

This ensures that replaying the same intent with the same snapshot produces identical computed values.

### Trace Recording

For deterministic replay, the frozen context MUST be recorded in the trace:

```typescript
type TraceEntry = {
  jobType: string;
  intentId: string;
  frozenContext: HostContext;  // Recorded for replay
  snapshot: Snapshot;
  result: ComputeResult;
};

// Replay uses recorded context
function replayJob(trace: TraceEntry) {
  Core.compute(schema, trace.snapshot, intent, trace.frozenContext);
  // Result is identical to original execution
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Context per operation | Non-deterministic; breaks replay |
| Context per iteration | Acceptable but less precise than per-job |
| Mutable context | Violates immutability principle |
| Global frozen context | Different jobs need different timestamps |

### Consequences

- HostContext is frozen at job start, immutable during job
- All Core operations in a job share the same context
- `now` value is captured once, never changes during job
- `randomSeed` is deterministic from intentId
- Trace replay produces identical results
- `f(snapshot) = snapshot'` determinism is preserved

---

## Summary Table (v2.0/v2.0.1)

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| H018 | Execution Mailbox per ExecutionKey | Opaque key; layer boundary preserved |
| H019 | Run-to-Completion Job Model | Job handler await ban; job splitting; **compute-effect interlock** |
| H020 | Single-Runner Invariant | One runner per ExecutionKey; **lost wakeup prevention** |
| H021 | Effect Result Reinjection | Results return via FulfillEffect jobs |
| H022 | Requirement Lifecycle Enforcement | H007 + H010 as atomic sequence; **stale protection**; **clear even on failure** |
| **H023** | **Context Determinism (v2.0.1)** | **Frozen per job; f(snapshot) = snapshot' preserved** |

---

## Cross-Reference: Related FDRs

| FDR | Relationship |
|-----|--------------|
| FDR-H003 | No Resume/Continuation (H019 enforces) |
| FDR-H005 | Handlers Never Throw (H021 references) |
| FDR-H007 | Deterministic Requirement ID (H022 enforces) |
| FDR-H008 | Single-Writer Concurrency (H018-H020 implement) |
| FDR-H010 | Requirement Clearing (H022 enforces) |
| FDR-W017 | Parallel Branch Execution (H018 preserves) |
| FDR-EL-001 | Event-Loop Execution Model (source FDR) |
| **Core §1** | **Determinism axiom (H023 enforces)** |

---

## Appendix: Reference Implementation Model

The following job types serve as a **reference implementation model**. They are not normative spec types but demonstrate how to satisfy the constitutional requirements:

```typescript
// Job types (reference)
type Job =
  | { type: 'StartIntent'; intentId: string; intent: Intent }
  | { type: 'ContinueCompute'; intentId: string }
  | { type: 'FulfillEffect'; intentId: string; requirementId: string; resultPatches: Patch[] }
  | { type: 'ApplyPatches'; patches: Patch[]; source: string }
  | { type: 'ApplyTranslatorOutput'; intentId: string; fragments: TranslatorFragment[] };

// Mailbox per execution (reference)
const mailboxes = new Map<ExecutionKey, JobQueue>();
const runnerActive = new Set<ExecutionKey>();
const runnerKickRequested = new Set<ExecutionKey>();  // For lost wakeup prevention

// Job processing with single-runner guard + lost wakeup prevention (reference)
async function processMailbox(key: ExecutionKey) {
  // RUN-2: re-entrant attempts return immediately, but remember the kick
  if (runnerActive.has(key)) {
    runnerKickRequested.add(key);  // LIVE-4
    return;
  }
  runnerActive.add(key);
  
  try {
    const queue = mailboxes.get(key);
    while (true) {
      const job = queue.dequeue();
      if (!job) break;
      runJobSync(job);  // MUST be synchronous
      await yieldToEventLoop();  // MAY yield between jobs
    }
  } finally {
    runnerActive.delete(key);
    
    // RUN-4 + LIVE-4: prevent lost wakeup
    const queue = mailboxes.get(key);
    if (!queue.isEmpty() || runnerKickRequested.has(key)) {
      runnerKickRequested.delete(key);
      queueMicrotask(() => processMailbox(key));
    }
  }
}

// Job handler (reference)
function runJobSync(job: Job) {
  switch (job.type) {
    case 'StartIntent':
      handleStartIntentSync(job);
      break;
    case 'FulfillEffect':
      handleFulfillEffectSync(job);
      break;
    // ...
  }
}

// StartIntent handler (reference) - COMP-REQ-INTERLOCK-1~2 compliant
function handleStartIntentSync(job: StartIntent) {
  const snapshot = ctx.getCanonicalHead();
  const result = Core.compute(schema, snapshot, job.intent);
  
  // COMP-REQ-INTERLOCK-1: Apply patches BEFORE effect dispatch
  if (result.patches.length > 0) {
    applyPatches(result.patches);  // Includes pendingRequirements update
  }
  
  // COMP-REQ-INTERLOCK-2: Read requirements from UPDATED snapshot (SHOULD)
  const updatedSnapshot = ctx.getCanonicalHead();  // Fresh read after apply
  const requirements = updatedSnapshot.system.pendingRequirements;
  
  // THEN dispatch effect requests
  if (requirements.length > 0) {
    for (const req of requirements) {
      requestEffectExecution(job.intentId, req);  // Async, outside mailbox
    }
    // Job terminates here - no continuation state
  } else {
    enqueue({ type: 'ContinueCompute', intentId: job.intentId });
  }
}

// FulfillEffect handler (reference) - FULFILL-0 + ERR-FE-4 compliant
function handleFulfillEffectSync(job: FulfillEffect) {
  const snapshot = ctx.getCanonicalHead();
  
  // FULFILL-0: Stale/duplicate check
  if (!isPendingRequirement(snapshot, job.requirementId)) {
    traceStaleOrDuplicateFulfillment(job);  // MUST log
    return;  // Do NOT apply, do NOT continue
  }
  
  // Step 3: Attempt apply (may fail)
  let applyError: Error | null = null;
  try {
    applyPatches(job.resultPatches);
  } catch (error) {
    applyError = error;
    // DO NOT RETURN - must still clear
  }
  
  // Step 4: ALWAYS clear (ERR-FE-1, ERR-FE-4)
  try {
    clearRequirement(job.requirementId);
  } catch (clearError) {
    // ERR-FE-3: Clear failure is fatal
    escalateToFatal(job.intentId, clearError);
    return;
  }
  
  // Step 5: Record error if apply failed (best-effort, ERR-FE-5)
  if (applyError) {
    try {
      applyErrorPatch(job.intentId, job.requirementId, applyError);
    } catch (patchError) {
      // ERR-FE-5: Error patch failure is logged but does NOT block continue
      logErrorPatchFailure(job, patchError);
    }
  }
  
  // Step 6: Continue (MUST happen)
  enqueue({ type: 'ContinueCompute', intentId: job.intentId });
}

function isPendingRequirement(snapshot: Snapshot, reqId: string): boolean {
  return snapshot.system.pendingRequirements.some(r => r.id === reqId);
}

// Effect execution (outside mailbox, reference)
async function executeEffect(key: ExecutionKey, req: Requirement): Promise<void> {
  const patches = await effectRunner.execute(req);
  
  mailboxes.get(key)?.enqueue({
    type: 'FulfillEffect',
    intentId: req.intentId,
    requirementId: req.id,
    resultPatches: patches
  });
  
  processMailbox(key);
}
```

### Translator Path Implementation

LLM translate call is treated as a Host-level async operation; Lower→Evaluate→Apply runs as **one job**.

**Critical:** Translator output uses `ApplyTranslatorOutput`, NOT `FulfillEffect`. This is because:
- FulfillEffect expects `Patch[]` and does requirement clear
- Translator output is `TranslatorFragment[]` (MEL IR) and has no Core requirement

```
Intent arrives
    ↓
[Mailbox] StartIntent job
    ↓
translateEffect request (async, OUTSIDE mailbox)
    ↓
Translation completes with TranslatorFragment[]
    ↓
[Mailbox] ApplyTranslatorOutput job ← NOT FulfillEffect
    │
    ├── lowerPatchFragments()      ─┐
    ├── evaluateConditionalPatchOps()  ├── ALL SYNCHRONOUS in this job
    └── Core.apply()               ─┘
    ↓
[Mailbox] ContinueCompute job (if needed)
```

Splitting Lower/Evaluate/Apply into separate jobs would reintroduce continuation state.

---

## Appendix: Key Quotes (v2.0/v2.0.1)

> "Host MUST maintain a single-writer mailbox per ExecutionKey, where ExecutionKey is opaque to Host."
> — FDR-H018

> "Job handlers MUST NOT await external work. Effect execution is job splitting, not blocking. All snapshot mutations from compute() MUST be applied BEFORE effect dispatch."
> — FDR-H019 (+ COMP-REQ-INTERLOCK-1)

> "For each ExecutionKey, Host MUST ensure only ONE runner processes the mailbox at any time. Runner MUST re-check mailbox before releasing guard."
> — FDR-H020

> "Effect results MUST be reinjected to the mailbox as FulfillEffect jobs. Direct application is FORBIDDEN."
> — FDR-H021

> "Host MUST follow the requirement lifecycle as an atomic sequence. FulfillEffect MUST verify requirement is pending before applying (stale protection). Clear MUST happen even on apply failure."
> — FDR-H022 (+ FULFILL-0 + ERR-FE-4)

> "HostContext MUST be frozen at the start of each job. All operations within a job MUST use the same frozen context. This preserves f(snapshot) = snapshot' determinism."
> — FDR-H023

---

*End of Host Contract FDR Document v2.0.1*
