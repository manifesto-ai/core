# Determinism: The Foundation of Manifesto

> **Status:** Stable
> **Last Updated:** 2026-01

---

## What Is Determinism?

In Manifesto, determinism means that **the same input always produces the same output, always**. This is not a convenience—it is the foundational constraint that makes every other guarantee possible.

```typescript
compute(schema, snapshot, intent, context) → (snapshot', requirements, trace)
```

This equation is:
- **Pure**: Same inputs always produce same outputs
- **Total**: Always returns a result (never throws)
- **Traceable**: Every step is recorded
- **Complete**: Snapshot is the whole truth

**There are no exceptions to this rule.**

---

## Why Determinism Is Fundamental

Most state management systems fail to provide determinism because they conflate two concerns:

1. **Computing** what should change
2. **Executing** the change (IO, network, side effects)

This conflation creates systems that are:
- Hard to test (require mocking IO)
- Hard to explain (side effects hidden in computation)
- Hard to replay (non-deterministic)
- Hard to debug (behavior varies by execution environment)

Manifesto achieves determinism by making **Core a pure semantic calculator**. Core computes state transitions but does not execute them.

### The Core Principle

> **Core computes. Host executes. These concerns never mix.**

This separation enables:

| Guarantee | Enabled By Determinism |
|-----------|----------------------|
| **Testability** | No mocking needed; just provide snapshot and intent |
| **Explainability** | Every step can be traced without IO interference |
| **Portability** | Core can run anywhere (browser, server, edge, WASM) |
| **Reproducibility** | Replay any computation by providing the same inputs |
| **Time-travel debugging** | Step backward/forward through state without re-executing effects |
| **Crash recovery** | Re-run computation from last snapshot—no lost context |

---

## How Determinism Is Achieved

### 1. Snapshot Is the Only Medium

The first pillar of determinism is eliminating all hidden state:

> **If it's not in Snapshot, it doesn't exist.**

Traditional systems pass values in multiple ways:
- Function return values
- Callbacks
- Events
- Shared mutable state
- Context objects
- Continuation parameters

This multiplicity creates:
- Hidden state
- Untraceable data flow
- Non-reproducible behavior

**Manifesto's approach:**

**Single communication medium** means:

1. **Complete State**: Snapshot contains everything needed to understand current state
2. **No Hidden State**: Nothing exists outside Snapshot
3. **Reproducibility**: Same Snapshot + Same Intent = Same Result
4. **Debuggability**: Inspect Snapshot at any point to understand everything

#### Snapshot Structure

```typescript
type Snapshot = {
  data: Record<string, unknown>;      // Domain state
  computed: Record<string, unknown>;  // Derived values (recalculated, never stored)
  system: {
    status: 'idle' | 'computing' | 'pending' | 'error';
    pendingRequirements: Requirement[];
    currentAction: string | null;
    lastError: ErrorValue | null;
    errors: ErrorValue[];
  };
  input: unknown;                     // Transient action input
  meta: {
    version: number;                  // Monotonically increasing
    timestamp: number;                // Host-provided logical time
    randomSeed: string;               // Host-provided deterministic seed
    schemaHash: string;               // Schema hash this snapshot conforms to
  };
};
```

**Key invariants:**
- Snapshots are immutable after creation
- All state changes happen via Patches
- Computed values are recalculated, never stored
- There is no channel for value passing outside Snapshot

### 2. No Suspended Execution Context

The second pillar is eliminating continuation state:

> **There is no suspended execution context. All continuity is expressed through Snapshot.**

Initial designs considered a `resume()` API:

```typescript
// Old design (rejected)
const result = await core.compute(schema, snapshot, intent, context);
if (result.status === 'paused') {
  // Execute effects...
  core.resume(result.context, patches);  // Suspended state!
}
```

This was **explicitly rejected** because it implies:
- Suspended execution context
- Hidden continuation state
- Complex lifecycle management
- Non-serializable state

**Why we chose stateless computation:**

Each `compute()` call is **complete and independent**. There is no `resume()` API.

When an effect is needed:
1. Core records Requirement in Snapshot
2. Core returns
3. Host executes effect
4. Host applies patches to Snapshot
5. Host calls `compute()` again with new Snapshot
6. Flow reads result from Snapshot and proceeds

**Benefits:**

| Enables | Constrains |
|---------|------------|
| Stateless Core | Flow must check Snapshot for effect results |
| Simple serialization | Host must track which intent to re-dispatch |
| Easy horizontal scaling | Slightly more verbose Flow logic |
| No memory leaks from suspended contexts | |

### 3. Effects as Declarations

The third pillar is separating semantic intent from execution:

> **Core declares requirements. Host fulfills them. Core never executes IO.**

In Manifesto, an effect is a **requirement declaration**, not an execution:

```typescript
// NOT this (execution)
await fetch('/api/data');

// THIS (declaration)
{ kind: 'effect', type: 'api:fetch', params: { url: '/api/data' } }
```

**Why this matters for determinism:**

1. **Purity**: Core remains pure; no IO inside
2. **Testability**: Test Flow without executing real effects
3. **Flexibility**: Host decides how/when/whether to execute
4. **Batching**: Host can batch multiple effects
5. **Retry Logic**: Host can implement retry without Core knowing

**The computation cycle:**

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPUTATION CYCLE                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Host calls: compute(snapshot, intent, context)             │
│                     │                                       │
│                     ▼                                       │
│  ┌─────────────────────────────────────┐                   │
│  │ Core evaluates Flow until:          │                   │
│  │   - Flow completes (requirements=[])│                   │
│  │   - Effect encountered (req=[...])  │                   │
│  │   - Error occurs                    │                   │
│  └─────────────────────────────────────┘                   │
│                     │                                       │
│                     ▼                                       │
│  Returns: (snapshot', requirements, trace)                  │
│                     │                                       │
│         ┌──────────┴──────────┐                            │
│         ▼                     ▼                            │
│   requirements=[]       requirements=[r1,r2]               │
│   (DONE)                      │                            │
│                               ▼                            │
│                    Host executes effects                   │
│                    Host applies patches                    │
│                               │                            │
│                               ▼                            │
│                    Host calls compute() AGAIN              │
│                    with new snapshot                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Critical insight:** Information flows ONLY through Snapshot. Each compute cycle is independent and deterministic.

### 4. Schema-First Design

The fourth pillar is expressing all semantics as data:

> **Code is for humans. Schema is for machines. Manifesto speaks Schema.**

All logic is expressed as **JSON-serializable Schema**, not code:

```json
{
  "kind": "filter",
  "array": { "kind": "get", "path": "todos" },
  "predicate": {
    "kind": "not",
    "arg": { "kind": "get", "path": "$item.completed" }
  }
}
```

**Why schema-first enables determinism:**

1. **Serializable**: Store, transmit, version schemas as data
2. **Analyzable**: Static analysis without execution
3. **Portable**: Same schema works in any host language
4. **Reproducible**: Schema hash uniquely identifies semantics
5. **Verifiable**: Can prove properties without execution

**Canonical form and hashing:**

Every Schema has a canonical form and deterministic hash:

1. Sort all object keys alphabetically (recursive)
2. Remove `undefined` values
3. Serialize as JSON with no whitespace
4. Hash with SHA-256

**Result:** Same meaning → same hash. Always.

This enables:
- Content-addressable storage
- Integrity verification
- Deterministic caching
- Schema comparison

---

## Determinism Guarantees

### Developer Guarantees

When you use Manifesto, you get these guarantees:

#### 1. Reproducibility Guarantee

**Given:** Same schema + same snapshot + same intent

**Then:** You will always get:
- Same resulting snapshot
- Same requirements declared
- Same trace structure

**No exceptions.** Not "usually," not "in most cases"—always.

#### 2. Testability Guarantee

**Core is pure.** You can test it without:
- Mocking IO
- Setting up databases
- Network stubs
- Time manipulation

```typescript
// No mocks needed
test('computes transition', () => {
  const context = { now: 0, randomSeed: "seed" };
  const result = await core.compute(schema, snapshot, intent, context);
  expect(result.snapshot.data.count).toBe(1);
});
```

#### 3. Debuggability Guarantee

**Every value can answer "why?"**

Because computation is pure and traceable:
- Step through any computation
- Inspect intermediate states
- Explain how any value was derived
- Replay from any point

```typescript
// Trace shows the complete computation
const context = { now: 0, randomSeed: "seed" };
const result = await core.compute(schema, snapshot, intent, context);
console.log(result.trace);
// Every step, every input, every output
```

#### 4. Portability Guarantee

**Core runs anywhere:**
- Browser
- Node.js
- Deno
- Edge workers
- WASM

**No environment-specific code.** No hidden dependencies on:
- `Date.now()`
- `Math.random()`
- File system
- Network

#### 5. Recovery Guarantee

**Crash recovery is trivial:**

1. Persist snapshot after each commit
2. On crash, load last snapshot
3. Re-run last intent if needed

**No continuation to lose.** No execution stack to recover. Just snapshot + schema + intent.

---

## Architectural Implications

### Layer Boundaries

Determinism requires strict boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│                           Host                               │
│  - Effect execution                                         │
│  - IO / Network / Storage                                   │
│  - Loop control                                             │
│  - User interaction                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ compute(snapshot, intent, context)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                           Core                               │
│  - Pure computation                                         │
│  - State transitions                                        │
│  - Requirement declarations                                 │
│  - Trace generation                                         │
└─────────────────────────────────────────────────────────────┘
```

**Boundary contract:**

| Direction | Allowed | Forbidden |
|-----------|---------|-----------|
| Host → Core | DomainSchema, Snapshot, Intent, HostContext | Side effects, async operations |
| Core → Host | ComputeResult (snapshot, requirements, trace) | Direct IO, network calls |

**Contract rules:**
- Core MUST be pure (same input → same output)
- Host MUST execute all requirements before re-computing
- Host MUST NOT modify requirements before execution

### Computed Values

Determinism extends to derived values:

**Computed values form a DAG (Directed Acyclic Graph):**

```typescript
activeCount depends on todos
canClear depends on completedCount
completedCount depends on todos
```

**Why DAG:**

1. **Termination**: Topological order guarantees finite computation
2. **Determinism**: Same evaluation order every time
3. **Incremental Update**: Only recompute affected nodes
4. **Static Verification**: Detect cycles at schema validation time

**Rules:**
- Computed dependencies MUST be acyclic
- Computed expressions MUST be pure
- Computed values are ALWAYS recalculated, NEVER stored
- Computed MUST be total (always return a value, never throw)

> **Computed values flow downward. They never cycle back.**

---

## What Determinism Is NOT

### Not "Eventually Consistent"

Manifesto is **immediately consistent**. Every compute returns a complete result, not a promise of future consistency.

### Not "Best Effort"

Determinism is absolute. There is no "usually deterministic" or "deterministic in practice." Same input → same output. Period.

### Not "Pure Except for Effects"

Core is **completely pure**. Effects are declarations, not executions. There is no escape hatch for "necessary side effects."

### Not "Testable with Mocks"

Core doesn't need mocks—it's pure. If you're mocking to test Core logic, something is architecturally wrong.

---

## Common Questions

### Q: Isn't re-computing expensive?

**A:** Usually no.

- Flows are declarative data, not imperative code
- State-guarded conditions short-circuit quickly
- Computed values are cached within a single compute

For very deep Flows (100+ nodes) or high-frequency updates (1000+/sec):
1. Use guards to short-circuit early
2. Break large Flows into smaller, focused ones
3. Use computed values for expensive derivations
4. Profile before optimizing

### Q: How do you handle time-dependent logic?

**A:** Time comes from Snapshot, not the environment.

```typescript
// Wrong: Non-deterministic
const now = Date.now();

// Right: Deterministic
const now = snapshot.input.__host.now;
```

Host provides time as input. Core reads it from Snapshot.

### Q: Can effects have side effects?

**A:** Yes, but they're Host's responsibility, not Core's.

Core declares effects. Host executes them. The execution can do anything—network calls, database writes, file IO.

But Core's computation remains pure.

### Q: What about randomness?

**A:** Randomness comes from Snapshot, not `Math.random()`.

```typescript
// Wrong: Non-deterministic
const id = Math.random().toString();

// Right: Deterministic
const id = snapshot.input.__host.randomSeed;
```

Host provides randomness via HostContext (available under `input.__host`). Core uses it deterministically.

---

## Related Documents

- [Core FDR](/rationale/core-fdr) — Detailed design rationale for Core decisions
- [Schema Specification](/specifications/core-spec) — Normative specification for Core behavior
- [Failure Model](./failure-model) — How errors are handled deterministically
- [Architecture Overview](/architecture/) — Full system architecture

---

## Summary

Determinism is not a feature of Manifesto—it is the constraint that defines what Manifesto IS.

**Key principles:**

1. **Snapshot is the only medium** — No hidden state
2. **No suspended execution context** — No continuation state
3. **Effects as declarations** — Core never executes IO
4. **Schema-first design** — All semantics are data

**What you get:**

- Same input → same output (always)
- Test without mocks
- Debug by replay
- Run anywhere
- Recover from crashes trivially

**The fundamental equation:**

```
compute(schema, snapshot, intent, context) → (snapshot', requirements, trace)
```

This equation is pure, total, traceable, and complete.

**Everything else follows from this.**

---

*End of Determinism Documentation*
