# Manifesto LLM Constitution

> **Scope:** This constitution applies to LLM agents (Claude, GPT, etc.) writing or modifying Manifesto code.

**Version:** 1.0
**Status:** Binding
**Applies to:** All LLMs writing, modifying, or refactoring Manifesto code

---

## 0. Document Identity

This document is a **binding operational constitution** for any LLM agent that interacts with the Manifesto codebase.

This is NOT documentation. This is NOT a tutorial. This is a **constraint specification**.

**Who it applies to:**
- Any LLM writing new code
- Any LLM refactoring existing code
- Any LLM adding features
- Any LLM modifying architecture

**Why violating it invalidates changes:**
Changes that violate this constitution produce systems that are NOT Manifesto-compliant. Partial compliance is not recognized. A system violating any single axiom, sovereignty rule, or forbidden pattern is NOT Manifesto.

**Normative hierarchy:**
1. Constitution (highest authority)
2. SPEC documents
3. FDR documents
4. Code
5. README (lowest authority)

When documents conflict, prefer higher-ranked sources.

---

## 1. Core Engineering Axiom

**Manifesto computes what the world should become; Host makes it so.**

The fundamental equation is:

```
compute(schema, snapshot, intent) -> (snapshot', requirements, trace)
```

This equation is:
- **Pure**: Same inputs MUST always produce same outputs
- **Total**: MUST always return a result (never throws)
- **Traceable**: Every step MUST be recorded
- **Complete**: Snapshot MUST be the whole truth

---

## 2. Engineering Priorities (Ordered)

When priorities conflict, higher-ranked priorities MUST prevail.

1. **Determinism** — Same input MUST produce same output, always
2. **Accountability** — Every state change MUST be traceable to Actor + Authority + Intent
3. **Explainability** — Every value MUST answer "why?"
4. **Separation of Concerns** — Core computes, Host executes, World governs
5. **Immutability** — Snapshots and Worlds MUST NOT mutate after creation
6. **Schema-first** — All semantics MUST be expressible as JSON-serializable data
7. **Type safety** — Zero string paths in user-facing APIs
8. **Simplicity** — Minimum complexity for current requirements only

**Never trade a higher priority for a lower one.** Convenience, performance optimization, and developer preference are NOT valid reasons to violate determinism or accountability.

---

## 3. Package Boundary Rules

### @manifesto-ai/core

**IS responsible for:**
- Pure semantic computation
- Expression evaluation
- Flow interpretation
- Patch generation
- Trace generation
- Schema validation

**MUST NOT:**
- Perform IO (network, filesystem, database)
- Access wall-clock time (`Date.now()` is forbidden)
- Execute effects
- Have mutable state
- Know about Host or World

**Forbidden imports:** Host, World, network libraries

### @manifesto-ai/host

**IS responsible for:**
- Effect execution
- Patch application via `apply()`
- Compute loop orchestration
- Requirement fulfillment
- Snapshot persistence

**MUST NOT:**
- Compute semantic meaning
- Make policy decisions
- Suppress, alter, or reinterpret effects declared by Core
- Know about World governance or Authority
- Define domain logic

**Forbidden imports:** World governance types, React, Authority handlers

### @manifesto-ai/world

**IS responsible for:**
- Proposal management
- Authority evaluation
- Decision recording
- Lineage maintenance (DAG)
- Actor registry

**MUST NOT:**
- Execute effects
- Apply patches
- Compute state transitions
- Make implicit decisions

**Forbidden imports:** Host execution internals, Core compute internals

---

## 4. State & Data Flow Rules

### 4.1 Snapshot Structure (Canonical)

```typescript
type Snapshot = {
  data: Record<string, unknown>;     // Domain state
  computed: Record<string, unknown>; // Derived values (recalculated, never stored)
  system: {
    status: 'idle' | 'running' | 'completed' | 'failed';
    pendingRequirements: Requirement[];
    currentAction?: string;
    errors: ErrorValue[];
  };
  input: Record<string, unknown>;    // Transient action input
  meta: {
    version: number;                 // Monotonically increasing
    timestamp: string;               // ISO 8601
    hash: string;                    // Content-addressable
  };
};
```

### 4.2 State Mutation Rules

**ONLY THREE PATCH OPERATIONS EXIST:**
1. `set` — Replace value at path (create if missing)
2. `unset` — Remove property at path
3. `merge` — Shallow merge at path

**FORBIDDEN:**
- In-place mutation of Snapshot
- Direct property assignment
- Array push/pop/splice (use `set` with expression)
- Deep merge (use multiple patches)

**ALL state changes MUST:**
- Go through `apply(schema, snapshot, patches)`
- Result in a new Snapshot (old Snapshot unchanged)
- Increment `meta.version` by exactly 1

### 4.3 Computed Values

- Computed values are ALWAYS recalculated, NEVER stored
- Computed dependencies form a DAG (cycles are rejected)
- Computed expressions MUST be pure (no side effects)
- Computed MUST be total (always return a value, never throw)

### 4.4 Data Flow Direction

```
Actor submits Intent
      |
      v
World Protocol (Proposal + Authority)
      |
      v
Host (compute loop + effect execution)
      |
      v
Core (pure computation)
      |
      v
New Snapshot (via patches)
      |
      v
New World (immutable)
```

**CRITICAL:** Information flows ONLY through Snapshot. There are no other channels.

---

## 5. Failure Model

### 5.1 Errors Are Values

Errors are **values in Snapshot**, NOT exceptions.

```typescript
type ErrorValue = {
  code: string;
  message: string;
  source: { actionId: string; nodePath: string };
  timestamp: number;
  context?: Record<string, unknown>;
};
```

### 5.2 FORBIDDEN Failure Patterns

- `throw` in Core logic (Core is pure, never throws)
- `try/catch` for business logic errors
- Boolean success flags (`{ success: boolean, data?: T }`)
- Implicit error channels
- Swallowed errors

### 5.3 REQUIRED Failure Patterns

- Effect handlers MUST return `Patch[]`, never throw
- Failures MUST be expressed as patches to `system.lastError` or domain state
- Flow failures use `{ kind: 'fail', code: string, message?: string }`
- Host MUST report effect execution failures faithfully through Snapshot

### 5.4 Error Handling Pattern

```typescript
// Effect handler - CORRECT
async function handler(type, params): Promise<Patch[]> {
  try {
    const result = await api.call(params);
    return [{ op: 'set', path: 'data.result', value: result }];
  } catch (error) {
    return [
      { op: 'set', path: 'data.syncStatus', value: 'error' },
      { op: 'set', path: 'data.errorMessage', value: error.message },
    ];
  }
}

// Flow - CORRECT
{ kind: 'fail', code: 'VALIDATION_ERROR', message: 'Title required' }
```

---

## 6. Type Discipline

### 6.1 Zero String Paths

User-facing APIs MUST NOT require string paths.

```typescript
// FORBIDDEN
{ path: '/data/todos/0/completed' }

// REQUIRED
state.todos[0].completed  // TypeScript-checked FieldRef
```

### 6.2 Phantom Types for References

```typescript
type FieldRef<T> = {
  readonly __kind: 'FieldRef';
  readonly path: string;
  readonly _type?: T;  // Phantom type
};

type ComputedRef<T> = {
  readonly __kind: 'ComputedRef';
  readonly path: `computed.${string}`;
  readonly _type?: T;
};
```

### 6.3 Type Safety Requirements

- All state field access MUST support IDE autocomplete via Zod inference
- Type mismatch MUST fail at compile time where possible
- Generated schemas MUST be JSON-serializable
- Expression results MUST be typed

### 6.4 FORBIDDEN Type Shortcuts

- `any` in public APIs
- `as` casts to bypass type checks
- `@ts-ignore` without explicit justification
- String literal types where FieldRef should be used

---

## 7. File & Module Structure Rules

### 7.1 File Size

- Files SHOULD NOT exceed 500 lines
- Files exceeding 300 lines SHOULD be evaluated for decomposition
- Single-responsibility principle: one concept per file

### 7.2 Export Rules

- Public API exports MUST go through package `index.ts`
- Internal modules MUST NOT be imported directly from outside package
- Types and implementations MUST be co-located or explicitly separated

### 7.3 Naming Conventions

| Kind | Convention | Example |
|------|------------|---------|
| Package | kebab-case | `@manifesto-ai/core` |
| File | kebab-case | `snapshot-adapter.ts` |
| Type | PascalCase | `DomainSchema` |
| Function | camelCase | `computeResult` |
| Constant | SCREAMING_SNAKE_CASE | `MAX_RETRIES` |

### 7.4 Test File Location

- Tests MUST be in `__tests__/` directories
- Test files MUST be named `*.test.ts` or `*.spec.ts`
- Test helpers MUST be in `__tests__/helpers/`

---

## 8. Refactoring Rules

### 8.1 Valid Refactoring Motivations

- Reducing cyclomatic complexity
- Improving type safety
- Fixing constitutional violations
- Removing dead code
- Extracting reusable patterns that already appear 3+ times

### 8.2 INVALID Refactoring Motivations

- "Cleaner" code (subjective)
- Future requirements not yet specified
- Personal style preferences
- Performance optimization without profiling evidence
- Making code "more flexible" for hypotheticals

### 8.3 Refactoring Constraints

- MUST NOT change public API signatures without explicit request
- MUST NOT introduce new dependencies
- MUST NOT change constitutional boundaries
- MUST maintain all existing test assertions
- MUST NOT add features disguised as refactoring

### 8.4 Before Refactoring

- Read the file first
- Understand existing patterns
- Verify tests pass before changes
- Verify tests pass after changes

---

## 9. Testing Philosophy

### 9.1 What Tests Prove

- **Core tests:** Determinism (same input -> same output)
- **Host tests:** Effect handler correctness, patch application
- **World tests:** Governance invariants, lineage integrity
- **Integration tests:** End-to-end flow correctness

### 9.2 Core Testing (No Mocks)

Core is pure. Tests require NO mocking.

```typescript
// CORRECT - Core test
it('computes transition', () => {
  const result = core.compute(schema, snapshot, intent);
  expect(result.snapshot.data.count).toBe(1);
});
```

### 9.3 FORBIDDEN Test Patterns

- Mocking Core internals
- Time-dependent assertions in Core tests
- Tests that depend on execution order of unrelated tests
- Tests that modify global state
- Tests that require network access

### 9.4 REQUIRED Test Patterns

- Effect handlers tested with explicit return values
- Determinism tests: run same input twice, assert identical output
- Boundary tests: verify layer doesn't import forbidden dependencies
- Invariant tests: verify constitutional axioms hold

---

## 10. Anti-Patterns (Explicit Examples)

### 10.1 Intelligent Host (FORBIDDEN)

```typescript
// FORBIDDEN - Host making decisions
async function executeEffect(req) {
  if (shouldSkipEffect(req)) {  // Host deciding!
    return [];
  }
  // ...
}

// Host MUST execute or report failure, never decide
```

### 10.2 Direct State Mutation (FORBIDDEN)

```typescript
// FORBIDDEN
snapshot.data.count = 5;
snapshot.meta.version++;

// REQUIRED
const newSnapshot = core.apply(schema, snapshot, [
  { op: 'set', path: 'data.count', value: 5 }
]);
```

### 10.3 Value Passing Outside Snapshot (FORBIDDEN)

```typescript
// FORBIDDEN - Returning value from effect
const result = await executeEffect();
core.compute(schema, snapshot, { ...intent, result });

// REQUIRED - Effect writes to Snapshot
// Effect handler returns patches, Host applies them
// Next compute() reads result from Snapshot
```

### 10.4 Execution-Aware Core (FORBIDDEN)

```typescript
// FORBIDDEN - Core branching on execution state
if (effectExecutionSucceeded) {  // Core cannot know this
  // ...
}

// REQUIRED - Core reads from Snapshot
if (snapshot.data.syncStatus === 'success') {
  // ...
}
```

### 10.5 Re-Entry Unsafe Flow (FORBIDDEN)

```typescript
// FORBIDDEN - Runs every compute cycle
flow.seq(
  flow.patch(state.count).set(expr.add(state.count, 1)),  // Increments forever!
  flow.effect('api.submit', {})  // Called multiple times!
)

// REQUIRED - State-guarded
flow.onceNull(state.submittedAt, ({ patch, effect }) => {
  patch(state.submittedAt).set(expr.input('timestamp'));
  effect('api.submit', {});
});
```

### 10.6 Authority Bypass (FORBIDDEN)

```typescript
// FORBIDDEN - Direct execution without governance
host.execute(snapshot, intent);  // Skips World Protocol!

// REQUIRED - All intents through World Protocol
world.submitProposal(actor, intentInstance);
// Authority evaluates, then approved intents go to Host
```

### 10.7 Hidden Continuation State (FORBIDDEN)

```typescript
// FORBIDDEN - Execution context stored outside Snapshot
const pendingCallbacks = new Map();  // Hidden state!

// REQUIRED - All execution state in Snapshot
// snapshot.system.pendingRequirements
```

### 10.8 Turing-Complete Flow (FORBIDDEN)

```typescript
// FORBIDDEN - Unbounded loops in Flow
{ kind: 'while', condition: expr, body: flow }  // Does not exist

// REQUIRED - Host controls iteration
while (snapshot.system.pendingRequirements.length > 0) {
  // Host loop, not Flow
}
```

### 10.9 Circular Computed Dependencies (FORBIDDEN)

```typescript
// FORBIDDEN
computed.define({
  a: expr.get(computed.b),  // a depends on b
  b: expr.get(computed.a),  // b depends on a - CYCLE!
});
```

---

## 11. LLM Self-Check

Before producing any code change, mentally verify ALL of the following:

### Constitutional Compliance

- [ ] Does this change preserve determinism? (Same input -> same output)
- [ ] Does this change maintain Snapshot as sole communication medium?
- [ ] Does this change respect sovereignty boundaries? (Core computes, Host executes, World governs)
- [ ] Are all state changes expressed as Patches?
- [ ] Are all errors expressed as values, not exceptions?

### Package Boundaries

- [ ] Does this code import only from allowed packages?
- [ ] Does this code NOT import forbidden dependencies?
- [ ] Is this code in the correct package for its responsibility?

### Flow Safety

- [ ] Are all Flow patches state-guarded for re-entry safety?
- [ ] Are all Flow effects state-guarded for re-entry safety?
- [ ] Does this Flow terminate in finite steps?
- [ ] Are there no circular `call` references?

### Type Safety

- [ ] Are there zero string paths in user-facing APIs?
- [ ] Are all public APIs properly typed (no `any`)?
- [ ] Do types compile without `@ts-ignore`?

### Testing

- [ ] Can Core changes be tested without mocks?
- [ ] Do tests verify determinism where applicable?
- [ ] Are all existing tests still passing?

### Simplicity

- [ ] Is this the minimum complexity needed for the current requirement?
- [ ] Are there no features added beyond what was requested?
- [ ] Are there no premature abstractions?
- [ ] Are there no hypothetical future requirements addressed?

### Before Submitting

- [ ] Have I read the files I'm modifying?
- [ ] Have I run the relevant tests?
- [ ] Does this change align with existing patterns in the codebase?
- [ ] Would this change be accepted by the Constitution?

---

## 12. Canonical Statements

Reference these when making decisions:

| Statement | Source |
|-----------|--------|
| "Core computes. Host executes. These concerns never mix." | FDR-001 |
| "If it's not in Snapshot, it doesn't exist." | FDR-002 |
| "There is no suspended execution context. All continuity is expressed through Snapshot." | FDR-003 |
| "Core declares requirements. Host fulfills them. Core never executes IO." | FDR-004 |
| "Errors are values. They live in Snapshot. They never throw." | FDR-005 |
| "Flows always terminate. Unbounded iteration is Host's responsibility." | FDR-006 |
| "If you need a value, read it from Snapshot. There is no other place." | FDR-007 |
| "Same meaning, same hash. Always." | FDR-010 |
| "Computed values flow downward. They never cycle back." | FDR-011 |
| "Three operations are enough. Complexity is composed, not built-in." | FDR-012 |

---

## 13. Quick Reference Tables

### Sovereignty Matrix

| Role | May Do | MUST NOT Do |
|------|--------|-------------|
| **Actor** | Propose change | Mutate state, execute effects, govern |
| **Authority** | Approve, reject, constrain scope | Execute, compute, apply patches, rewrite Intent |
| **World** | Govern, audit, maintain lineage | Execute, apply patches, hidden channels |
| **Core** | Compute meaning, declare effects | IO, execution, time-awareness |
| **Host** | Execute effects, apply patches, report | Decide, interpret, suppress effects |

### Forbidden Import Matrix

| Package | MUST NOT Import |
|---------|-----------------|
| core | host, world |
| host | world governance |
| world | host internals, core compute |
| app | core internals, host internals, world internals |

### Priority Decision Tree

```
Is determinism preserved?
├── No → REJECT change
└── Yes → Is accountability maintained?
    ├── No → REJECT change
    └── Yes → Is separation of concerns respected?
        ├── No → REJECT change
        └── Yes → Is Snapshot the sole medium?
            ├── No → REJECT change
            └── Yes → ACCEPT change (apply remaining checks)
```

---

*End of Manifesto LLM Constitution v1.0*