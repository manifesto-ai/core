# Manifesto Schema Specification — Foundational Design Rationale (FDR)

> **Version:** 1.0
> **Status:** Normative
> **Purpose:** Document the "why" behind every major design decision

---

## Table of Contents

1. [Purpose of This Document](#1-purpose-of-this-document)
2. [FDR-001: Core as Calculator](#fdr-001-core-as-calculator)
3. [FDR-002: Snapshot as Only Medium](#fdr-002-snapshot-as-only-medium)
4. [FDR-003: No Pause/Resume](#fdr-003-no-pauseresume)
5. [FDR-004: Effects as Declarations](#fdr-004-effects-as-declarations)
6. [FDR-005: Errors as Values](#fdr-005-errors-as-values)
7. [FDR-006: Flow is Not Turing-Complete](#fdr-006-flow-is-not-turing-complete)
8. [FDR-007: No Value Binding in Flows](#fdr-007-no-value-binding-in-flows)
9. [FDR-008: Call Without Arguments](#fdr-008-call-without-arguments)
10. [FDR-009: Schema-First Design](#fdr-009-schema-first-design)
11. [FDR-010: Canonical Form and Hashing](#fdr-010-canonical-form-and-hashing)
12. [FDR-011: Computed as DAG](#fdr-011-computed-as-dag)
13. [FDR-012: Patch Operations Limited to Three](#fdr-012-patch-operations-limited-to-three)
14. [FDR-013: Host Responsibility Boundary](#fdr-013-host-responsibility-boundary)
15. [FDR-014: Browser Compatibility](#fdr-014-browser-compatibility)
16. [Summary: The Manifesto Identity](#summary-the-manifesto-identity)

---

## 1. Purpose of This Document

This document records the **foundational design decisions** of Manifesto Schema Specification.

For each decision, we document:

| Section | Content |
|---------|---------|
| **Decision** | What we decided |
| **Context** | Why this decision was needed |
| **Alternatives** | What other options existed |
| **Rationale** | Why we chose this option |
| **Consequences** | What this enables and constrains |

These decisions are **constitutional** — they define what Manifesto IS and IS NOT.

---

## FDR-001: Core as Calculator

### Decision

Core is a **pure semantic calculator**. It computes state transitions but does not execute them.

### Context

Most state management systems conflate two concerns:

1. **Computing** what should change
2. **Executing** the change (IO, network, side effects)

This conflation creates systems that are:
- Hard to test (require mocking IO)
- Hard to explain (side effects hidden in computation)
- Hard to replay (non-deterministic)

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Integrated Runtime** | Core executes effects directly | Violates purity, breaks determinism |
| **Plugin Architecture** | Core calls effect handlers via injection | Still couples execution to computation |
| **Actor Model** | Core sends messages to effect actors | Adds complexity, still couples concerns |

### Rationale

By making Core a pure calculator:

1. **Determinism**: `compute(snapshot, intent, context)` always produces the same result.
2. **Testability**: No mocking needed; just provide snapshot and intent.
3. **Explainability**: Every step can be traced without IO interference.
4. **Portability**: Core can run anywhere (browser, server, edge, WASM).

### Consequences

| Enables | Constrains |
|---------|------------|
| Pure unit testing | Host must implement effect execution |
| Time-travel debugging | No "fire and forget" effects |
| Deterministic replay | All IO goes through Host |
| Cross-platform Core | Effect handlers are Host-specific |

### Canonical Statement

> **Core computes. Host executes. These concerns never mix.**

---

## FDR-002: Snapshot as Only Medium

### Decision

Snapshot is the **only medium of communication** between computations. There is no other channel.

### Context

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

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Return Values** | Effects return results to caller | Creates hidden continuation state |
| **Context Passing** | Pass context object through calls | Implicit state, hard to trace |
| **Event Emitters** | Publish results as events | Temporal coupling, order-dependent |
| **Continuation Monads** | Chain computations functionally | Complex, still implies suspended state |

### Rationale

Single communication medium means:

1. **Complete State**: Snapshot contains everything needed to understand current state.
2. **No Hidden State**: Nothing exists outside Snapshot.
3. **Reproducibility**: Same Snapshot + Same Intent = Same Result.
4. **Debuggability**: Inspect Snapshot at any point to understand everything.

### Consequences

| Enables | Constrains |
|---------|------------|
| Complete state serialization | Verbose state structure |
| Perfect reproducibility | No "quick" value passing |
| Time-travel debugging | All intermediate values in Snapshot |
| State diffing and comparison | Larger Snapshot size |

### Canonical Statement

> **If it's not in Snapshot, it doesn't exist.**

---

## FDR-003: No Pause/Resume

### Decision

There is no `resume()` API. Each `compute()` call is **complete and independent**.

### Context

Initial design had:

```typescript
// Old design
const context = { now: 0, randomSeed: "seed" };
const result = await core.compute(schema, snapshot, intent, context);
if (result.status === 'paused') {
  // Execute effects...
  core.resume(result.context, patches);  // Resume suspended computation
}
```

This implied:
- Suspended execution context
- Hidden continuation state
- Complex lifecycle management

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Explicit Resume** | `resume(context, patches)` | Implies suspended state exists |
| **Continuation Tokens** | Return token, pass to continue | Hidden state in token |
| **Callback Registration** | Register callback for effect result | Temporal coupling |

### Rationale

No pause/resume means:

1. **Stateless Core**: Core holds no state between calls.
2. **Simple Mental Model**: Each `compute()` is a pure function.
3. **Easy Serialization**: No continuation to serialize.
4. **Clear Responsibility**: Host owns all lifecycle.

The key insight:

> **Continuity is expressed through Snapshot, not through execution context.**

When an effect is needed:
1. Core records Requirement in Snapshot.
2. Core returns.
3. Host executes effect.
4. Host applies patches to Snapshot.
5. Host calls `compute()` again.
6. Flow reads result from Snapshot and proceeds.

### Consequences

| Enables | Constrains |
|---------|------------|
| Stateless Core | Flow must check Snapshot for effect results |
| Simple serialization | Host must track which intent to re-dispatch |
| Easy horizontal scaling | Slightly more verbose Flow logic |
| No memory leaks from suspended contexts | |

### Canonical Statement

> **There is no suspended execution context. All continuity is expressed through Snapshot.**

---

## FDR-004: Effects as Declarations

### Decision

Effects are **declarations** that something external is needed. They are not executions.

### Context

The word "effect" in programming usually means "side effect" — something that happens.

In Manifesto, an effect is a **requirement declaration**:

```typescript
// NOT this (execution)
await fetch('/api/data');

// THIS (declaration)
{ kind: 'effect', type: 'api:fetch', params: { url: '/api/data' } }
```

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Direct Execution** | Core executes effects | Breaks purity |
| **Effect Handlers in Core** | Core calls injected handlers | Couples Core to execution |
| **Promise-based** | Effects return Promises | Implies async execution in Core |

### Rationale

Effects as declarations:

1. **Purity**: Core remains pure; no IO inside.
2. **Testability**: Test Flow without executing real effects.
3. **Flexibility**: Host decides how/when/whether to execute.
4. **Batching**: Host can batch multiple effects.
5. **Retry Logic**: Host can implement retry without Core knowing.

### Consequences

| Enables | Constrains |
|---------|------------|
| Mock-free testing | Host must implement all effect handlers |
| Effect batching | Cannot use familiar async/await in Flows |
| Retry and circuit breakers | More verbose than inline calls |
| Effect substitution |  |

### Canonical Statement

> **Core declares requirements. Host fulfills them. Core never executes IO.**

---

## FDR-005: Errors as Values

### Decision

Errors are **values in Snapshot**, not exceptions.

### Context

Exception-based error handling:

```typescript
try {
  await doSomething();
} catch (error) {
  handleError(error);
}
```

Problems:
- Control flow is non-local
- Hard to trace
- Difficult to serialize
- Cannot be inspected without catching

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Exceptions** | throw/catch | Non-local control flow, hard to trace |
| **Result Types** | `Result<T, E>` return values | Implies value passing, which we rejected |
| **Error Callbacks** | Separate error channel | Temporal coupling |

### Rationale

Errors as values:

1. **Traceability**: Errors are in Snapshot, visible at any time.
2. **Locality**: Error handling is just reading Snapshot.
3. **Serializability**: Errors survive serialization.
4. **Explainability**: Trace shows when/where error occurred.

```json
{
  "system": {
    "lastError": {
      "code": "VALIDATION_ERROR",
      "message": "Title cannot be empty",
      "source": { "actionId": "addTodo", "nodePath": "flow.steps[0]" },
      "timestamp": 1704067200000
    }
  }
}
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Error inspection without catching | Must check for errors explicitly |
| Error history | Slightly verbose error handling |
| Serializable error state | No stack traces (by design) |
| Error recovery patterns |  |

### Canonical Statement

> **Errors are values. They live in Snapshot. They never throw.**

---

## FDR-006: Flow is Not Turing-Complete

### Decision

FlowSpec does NOT include unbounded loops (`while`, `for`, recursion).

### Context

Turing-complete languages can express any computation, but:

1. **Halting Problem**: Cannot statically determine if program terminates.
2. **Unbounded Resources**: May consume infinite time/memory.
3. **Analysis Difficulty**: Cannot prove properties without execution.

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Full Turing-Completeness** | Include while/recursion | Halting problem, hard to analyze |
| **Bounded Loops** | `repeat(n) { ... }` | Still complex, arbitrary limits |
| **Tail Recursion Only** | Allow TCO recursion | Complex implementation, hard to trace |

### Rationale

By limiting expressiveness:

1. **Guaranteed Termination**: All Flows finish in finite steps.
2. **Static Analysis**: Can verify properties without execution.
3. **Complete Traces**: Trace is always finite.
4. **Predictable Resources**: Bounded memory and time.

For unbounded iteration, **Host controls the loop**:

```typescript
const context = { now: 0, randomSeed: "seed" };
while (needsMoreWork(snapshot)) {
  const result = await core.compute(schema, snapshot, intent, context);
  snapshot = result.snapshot;
}
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Guaranteed termination | Cannot express unbounded loops in Flow |
| Static analysis | Host must implement iteration |
| Bounded resource usage | More code in Host for loops |
| Complete, finite traces |  |

### Canonical Statement

> **Flows always terminate. Unbounded iteration is Host's responsibility.**

---

## FDR-007: No Value Binding in Flows

### Decision

Flows do NOT have variable binding (`let`, `bind`, `←`).

### Context

Initial design considered:

```typescript
// Considered and rejected
{
  kind: 'bind',
  name: 'result',
  value: { kind: 'effect', type: 'api:call', ... },
  then: {
    kind: 'if',
    cond: { kind: 'get', path: 'result.ok' },
    ...
  }
}
```

This implies:
- Effects "return" values
- Local scope exists
- Hidden state in bindings

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Let Bindings** | `let x = expr in body` | Implies value passing |
| **Pattern Matching** | `match result with ...` | Complex, implies returned values |
| **Monadic Do-Notation** | `do { x <- effect; ... }` | Implies continuation state |

### Rationale

No value binding enforces the Snapshot principle:

1. **Single Source**: All values come from Snapshot.
2. **No Hidden State**: No local variables to track.
3. **Explicit State**: If you need a value later, put it in Snapshot.

```json
{
  "kind": "seq",
  "steps": [
    { "kind": "effect", "type": "api:call", "params": {} },
    { "kind": "if", 
      "cond": { "kind": "get", "path": "api.lastResult.ok" },
      "then": { "...": "..." }
    }
  ]
}
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Simple mental model | More paths in Snapshot |
| Complete state visibility | Verbose for simple value passing |
| Easy serialization | Must design Snapshot carefully |
| No scope-related bugs |  |

### Canonical Statement

> **If you need a value, read it from Snapshot. There is no other place.**

---

## FDR-008: Call Without Arguments

### Decision

`call` invokes another Flow but does NOT pass arguments.

### Context

Initial design considered:

```typescript
// Considered and rejected
{ kind: 'call', flow: 'validate', input: { kind: 'get', path: 'user' } }
```

This implies:
- Parameter passing mechanism
- Local scope in called Flow
- Implicit value channel

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Argument Passing** | `call(flow, args)` | Implies value channel |
| **Input Mapping** | Map input to called flow's expected shape | Complex, hidden transformation |
| **Partial Application** | Pre-bind some arguments | Functional complexity |

### Rationale

No arguments enforces:

1. **Snapshot is the only medium**: Called Flow reads same Snapshot.
2. **Explicit data flow**: If called Flow needs data, write it to Snapshot first.
3. **Traceable**: All "arguments" are visible in Snapshot.

Pattern for passing context:

```json
{
  "kind": "seq",
  "steps": [
    { "kind": "patch", "op": "set", "path": "system.callContext", 
      "value": { "kind": "get", "path": "input" } },
    { "kind": "call", "flow": "shared.validate" }
  ]
}
```

Called Flow reads `system.callContext`.

### Consequences

| Enables | Constrains |
|---------|------------|
| Simple call semantics | Must set up context before call |
| Traceable "arguments" | More patches for context setup |
| No parameter mismatch bugs | Slightly verbose |
| Consistent mental model |  |

### Canonical Statement

> **`call` means "continue with another Flow on the same Snapshot." Nothing more.**

---

## FDR-009: Schema-First Design

### Decision

All semantics are expressed as **JSON-serializable Schema**, not code.

### Context

Code-first approaches:

```typescript
// Code-first
const computed = {
  isValid: (state) => state.email.length > 0 && state.password.length >= 8
}
```

Problems:
- Cannot serialize
- Cannot analyze without execution
- Cannot share across languages
- Hidden complexity in functions

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Code-First** | Define logic in host language | Not serializable, not portable |
| **DSL with Code Escape** | Schema + embedded code | Breaks purity at escape points |
| **Hybrid** | Schema for structure, code for logic | Inconsistent, hard to analyze |

### Rationale

Schema-first:

1. **Serializable**: Store, transmit, version schemas as data.
2. **Analyzable**: Static analysis without execution.
3. **Portable**: Same schema works in any host language.
4. **Toolable**: Generate docs, visualizations, validators.
5. **AI-Friendly**: LLMs can read, write, and reason about schemas.

### Consequences

| Enables | Constrains |
|---------|------------|
| Cross-language portability | More verbose than code |
| Static analysis | Learning curve for schema language |
| Schema versioning | Need builder DSL for ergonomics |
| AI-readable semantics |  |

### Canonical Statement

> **Code is for humans. Schema is for machines. Manifesto speaks Schema.**

---

## FDR-010: Canonical Form and Hashing

### Decision

Every Schema has a **canonical form** and a deterministic **hash**.

### Context

For content-addressable storage and integrity:

- Same content should produce same hash
- Order of keys should not matter
- Formatting should not matter

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **JSON as-is** | Hash raw JSON | Key order affects hash |
| **Schema ID only** | Use ID as identifier | Cannot detect content changes |
| **Custom Binary Format** | Compact binary representation | Complexity, debugging difficulty |

### Rationale

Canonical form + hashing enables:

1. **Deduplication**: Same content = same hash = store once.
2. **Integrity**: Detect tampering or corruption.
3. **Caching**: Memoize computation by schema hash.
4. **Versioning**: Track schema evolution.
5. **Comparison**: Diff schemas semantically.

Algorithm:
1. Sort all object keys alphabetically (recursive).
2. Remove `undefined` values.
3. Serialize as JSON with no whitespace.
4. Hash with SHA-256.

### Consequences

| Enables | Constrains |
|---------|------------|
| Content-addressable storage | Must normalize before hashing |
| Integrity verification | Slightly more processing |
| Deterministic caching | |
| Schema comparison | |

### Canonical Statement

> **Same meaning, same hash. Always.**

---

## FDR-011: Computed as DAG

### Decision

Computed values form a **Directed Acyclic Graph (DAG)**.

### Context

Computed values depend on other values:

```
activeCount depends on todos
canClear depends on completedCount
completedCount depends on todos
```

Cycles would cause:
- Infinite computation
- Undefined order
- Non-deterministic results

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Allow Cycles** | Iterate until stable | Non-termination risk |
| **Lazy Evaluation** | Compute on demand | Hidden computation order |
| **Flat Computed** | No computed-to-computed deps | Too limiting |

### Rationale

DAG ensures:

1. **Termination**: Topological order guarantees finite computation.
2. **Determinism**: Same order every time.
3. **Incremental Update**: Only recompute affected nodes.
4. **Static Verification**: Detect cycles at schema validation time.

### Consequences

| Enables | Constrains |
|---------|------------|
| Guaranteed termination | Cannot express circular dependencies |
| Incremental recomputation | Must structure computed carefully |
| Static cycle detection | |
| Predictable evaluation order | |

### Canonical Statement

> **Computed values flow downward. They never cycle back.**

---

## FDR-012: Patch Operations Limited to Three

### Decision

Only three patch operations: `set`, `unset`, `merge`.

### Context

Rich patch operations could include:

- Array push/pop/splice
- Object deep merge
- Increment/decrement
- Custom transformations

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **JSON Patch (RFC 6902)** | add, remove, replace, move, copy, test | Complex, move/copy are confusing |
| **Rich Array Operations** | push, pop, splice, etc. | Can be composed from set |
| **Deep Merge** | Recursive object merge | Semantic ambiguity |

### Rationale

Three operations cover all cases:

1. **set**: Replace value at path.
2. **unset**: Remove value at path.
3. **merge**: Shallow merge object at path.

Array operations are expressed as:

```json
// Push
{ "op": "set", "path": "items", "value": { "kind": "concat", "args": [{ "kind": "get", "path": "items" }, [newItem]] } }

// Remove at index
{ "op": "set", "path": "items", "value": { "kind": "filter", ... } }
```

Benefits:
1. **Simplicity**: Easy to implement in any language.
2. **Predictability**: Clear semantics, no edge cases.
3. **Composability**: Complex operations from simple primitives.

### Consequences

| Enables | Constrains |
|---------|------------|
| Simple implementation | Array operations more verbose |
| Clear semantics | No atomic increment |
| Easy verification | Must compose from primitives |
| Portable across hosts | |

### Canonical Statement

> **Three operations are enough. Complexity is composed, not built-in.**

---

## FDR-013: Host Responsibility Boundary

### Decision

Clear boundary between Core (compute) and Host (execute).

### Context

Without clear boundary:

- Testing requires mocking
- Behavior depends on environment
- Non-determinism creeps in

### Responsibilities

| Core (Compute) | Host (Execute) |
|----------------|----------------|
| Evaluate expressions | Execute effects |
| Apply patches to snapshot | Perform IO |
| Generate traces | Control loops |
| Validate schemas | Manage persistence |
| Record requirements | Handle user interaction |
| | Implement effect handlers |

### Rationale

Clear boundary:

1. **Testability**: Core is pure, test without mocks.
2. **Portability**: Same Core, different Hosts.
3. **Flexibility**: Host can implement any execution strategy.
4. **Predictability**: Core behavior is deterministic.

### Consequences

| Enables | Constrains |
|---------|------------|
| Pure Core testing | Host has more responsibilities |
| Multi-platform Core | Must define clear interface |
| Execution strategy flexibility | Two components to maintain |
| Deterministic replay | |

### Canonical Statement

> **Core is pure and portable. Host is practical and platform-specific.**

---

## FDR-014: Browser Compatibility

### Decision

All packages in the Manifesto stack MUST use **browser-compatible APIs only**. Node.js-specific APIs are forbidden.

### Context

The Manifesto stack was initially developed in Node.js, using Node.js-specific APIs like `crypto.createHash()` for SHA-256 hashing in the Compiler's IR generator.

When building a React application with Vite for browser deployment, this caused a critical runtime error:

```
Uncaught Error: Module "crypto" has been externalized for browser compatibility.
Cannot access "crypto.createHash" in client code.
```

Dependency chain:
```
React App (browser)
    → @manifesto-ai/app
        → @manifesto-ai/host
            → @manifesto-ai/compiler (build-time only expected)
                → crypto.createHash() ← FAILS in browser
```

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Bundle Node.js polyfills** | Include crypto-browserify | Increases bundle size significantly |
| **Make Compiler Node-only** | Strict boundary at build time | Breaks runtime MEL compilation use cases |
| **Use Web Crypto API** | `crypto.subtle.digest()` | Async-only, not suitable for synchronous `computeHash()` |
| **Pure JS Implementation** | JavaScript-only SHA-256 | Chosen: Works everywhere, deterministic |

### Rationale

Using browser-compatible APIs ensures:

1. **Universal Execution**: Core, Host, Compiler can run in browser, Node.js, Deno, Bun, edge workers.
2. **No Polyfills**: Zero external crypto polyfills needed.
3. **Bundle Size**: No bloated crypto libraries.
4. **Build Simplicity**: No special Vite/Webpack configuration for Node.js modules.

Implementation:

```typescript
// BEFORE (Node.js only)
import { createHash } from "crypto";
function computeHash(schema: Omit<DomainSchema, "hash">): string {
  return createHash("sha256").update(toCanonical(schema)).digest("hex");
}

// AFTER (Browser-compatible)
import { sha256Sync, toCanonical } from "@manifesto-ai/core";
function computeHash(schema: Omit<DomainSchema, "hash">): string {
  return sha256Sync(toCanonical(schema));
}
```

`@manifesto-ai/core` provides:
- `sha256Sync(data)`: Pure JavaScript, synchronous
- `sha256(data)`: Web Crypto API, async (for larger payloads)

### Consequences

| Enables | Constrains |
|---------|------------|
| Browser React apps | Slightly slower than native crypto |
| Edge worker deployment | Must use Core's hash utilities |
| No build configuration | Cannot use Node.js crypto directly |
| Universal package compatibility | |

### Canonical Statement

> **Manifesto runs everywhere. Browser compatibility is non-negotiable.**

---

## Summary: The Manifesto Identity

These design decisions collectively define what Manifesto IS:

```
Manifesto IS:
  ✓ A semantic calculator for domain state
  ✓ Schema-first and JSON-serializable
  ✓ Deterministic and reproducible
  ✓ Explainable at every step
  ✓ Pure (no side effects in Core)
  ✓ Host-agnostic

Manifesto IS NOT:
  ✗ An execution runtime
  ✗ A Turing-complete language
  ✗ An exception-throwing system
  ✗ A framework with hidden state
  ✗ A workflow orchestrator
  ✗ An agent framework
```

### The One-Sentence Summary

> **Manifesto computes what the world should become; Host makes it so.**

### The Fundamental Equation

```
compute(schema, snapshot, intent, context) → (snapshot', requirements, trace)
```

This equation is:
- **Pure**: Same inputs always produce same outputs.
- **Total**: Always returns a result (never throws).
- **Traceable**: Every step is recorded.
- **Complete**: Snapshot is the whole truth.

---

## Appendix: Decision Dependency Graph

```
FDR-001 (Core as Calculator)
    │
    ├─► FDR-002 (Snapshot as Only Medium)
    │       │
    │       ├─► FDR-003 (No Pause/Resume)
    │       │
    │       ├─► FDR-007 (No Value Binding)
    │       │
    │       └─► FDR-008 (Call Without Arguments)
    │
    ├─► FDR-004 (Effects as Declarations)
    │       │
    │       └─► FDR-013 (Host Responsibility Boundary)
    │
    ├─► FDR-005 (Errors as Values)
    │
    └─► FDR-006 (Flow Not Turing-Complete)

FDR-009 (Schema-First)
    │
    ├─► FDR-010 (Canonical Form)
    │
    └─► FDR-011 (Computed as DAG)

FDR-012 (Three Patch Operations)
    │
    └─► (Simplicity principle)
```

---

*End of FDR Document*
