# Host Contract — Foundational Design Rationale (FDR)

> **Version:** 1.1  
> **Status:** Archived (v1.x only)  
> **Purpose:** Historical rationale for Host v1.x (Translator/compiler pipeline). Not normative for v2.0+  
> **Note:** Translator/compiler pipeline is deprecated in v2.0+.  
> **Note:** v2.0+ Host FDRs live in `packages/host/docs/host-FDR-v2.0.2.md`.  
> **Changelog:**
> - v1.0: Initial release (FDR-H001 ~ H010)
> - **v1.1: Compiler Integration, Expression Evaluation (FDR-H011 ~ H017)**

---

## Part III: Compiler Integration (v1.1)

This section documents the foundational decisions for Compiler integration and Translator output handling.

### Table of Contents (v1.1)

| FDR | Title | Key Decision |
|-----|-------|--------------|
| FDR-H011 | Mandatory Compiler Dependency | Host MUST use @manifesto-ai/compiler |
| FDR-H012 | Two-Step Processing | Lower then Evaluate |
| FDR-H013 | Core.apply() Receives Concrete Only | No expressions to apply() |
| FDR-H014 | Single IntentId Throughout | Same ID for evaluation and compute |
| FDR-H015 | $system Exclusion | Translator path forbids system |
| FDR-H016 | snapshot.data Convention | Not snapshot.state |
| FDR-H017 | Informative Translator Loop | §13.2 is guidance, not normative |

---

## FDR-H011: Mandatory Compiler Dependency

### Decision

**Host MUST declare dependency on `@manifesto-ai/compiler` and MUST use it for all Translator output processing.**

```json
{
  "dependencies": {
    "@manifesto-ai/compiler": "^0.4.0"
  }
}
```

### Context

Translator produces `PatchFragment[]` containing MEL Canonical IR. Core expects Core Runtime IR and concrete values.

Without mandatory Compiler usage:
- Hosts might pass MEL IR directly to Core
- Hosts might implement custom lowering with bugs
- Different Hosts might produce different results

### Rationale

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Optional Compiler | Flexibility | Inconsistent behavior | ❌ Rejected |
| Host-specific lowering | No dependency | Logic duplication, drift | ❌ Rejected |
| **Mandatory Compiler** | Consistent behavior | Additional dependency | ✅ Adopted |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Core accepts MEL IR | Complicates Core; no single source of truth |
| Translator outputs Core IR | Couples Translator to Core internals |
| Host implements lowering | Duplicated logic; drift risk |

### Consequences

- Host MUST import from `@manifesto-ai/compiler`
- Custom lowering implementations are SPEC VIOLATIONS
- All Hosts behave identically for same input
- Compiler upgrades automatically apply to all Hosts

---

## FDR-H012: Two-Step Processing

### Decision

**Host MUST perform two distinct steps: lowering (MEL IR → Core IR) and evaluation (Core IR → concrete values).**

```typescript
// Step 1: Lower
const lowered = lowerPatchFragments(fragments, loweringCtx);

// Step 2: Evaluate
const patches = evaluateConditionalPatchOps(lowered, evalCtx);

// Step 3: Apply
core.apply(schema, snapshot, patches);
```

### Context

Core.apply() expects concrete `Patch[]`:
```typescript
{ op: "set", path: "count", value: 6 }  // concrete number
```

Lowering produces Core IR expressions:
```typescript
{ op: "set", path: "count", value: { kind: 'add', left: {...}, right: {...} } }
```

If we pass expressions to Core.apply():
```typescript
snapshot.data.count = { kind: 'add', ... }  // WRONG!
```

### Rationale

```
PROBLEM (single step):
  lowerAndApply(fragments) → ???
  - Who evaluates expressions?
  - Against which snapshot?
  - With what context (meta, input)?

SOLUTION (two steps):
  lower(fragments) → expressions with structure
  evaluate(expressions, ctx) → concrete values
  - Clear responsibility
  - Explicit context
  - Testable separately
```

### Consequences

- Host calls `lowerPatchFragments()` first
- Host calls `evaluateConditionalPatchOps()` second
- Each step has clear input/output types
- Skipping either step is a SPEC VIOLATION

---

## FDR-H013: Core.apply() Receives Concrete Only

### Decision

**Core.apply() MUST receive `Patch[]` with concrete values. Passing expressions is a SPEC VIOLATION.**

### Context

Core.apply() was designed for effect handler results:
```typescript
async function createTodoHandler(params): Promise<Patch[]> {
  const response = await api.post('/todos', params);
  return [
    { op: 'set', path: `todos.${response.id}`, value: response.data }
  ];
}
```

Effect handlers return concrete values (API responses, timestamps, UUIDs).

Translator output contains expressions that need evaluation.

### Rationale

| If apply() receives... | Result |
|-----------------------|--------|
| `{ value: 6 }` | `snapshot.data.count = 6` ✓ |
| `{ value: { kind: 'add', ... } }` | `snapshot.data.count = { kind: 'add', ... }` ✗ |

```
PROBLEM:
  User expects: count = 6
  User gets: count = { kind: 'add', left: {...}, right: {...} }
  
  This object is stored as the value!
  Computed properties break, comparisons fail, UI shows "[object Object]"
```

### Consequences

- Host MUST evaluate before apply
- Passing `ConditionalPatchOp[]` to apply() is VIOLATION
- Passing `PatchFragment[]` to apply() is VIOLATION
- Only `Patch[]` with concrete values is valid

---

## FDR-H014: Single IntentId Throughout

### Decision

**The same `intentId` MUST be used for EvaluationContext.meta.intentId and Intent.intentId in compute loop.**

```typescript
const intentId = crypto.randomUUID();  // ONE ID

const patches = evaluateConditionalPatchOps(lowered, {
  meta: { intentId },  // same
  ...
});

const intent = {
  type: actionName,
  intentId  // same
};
```

### Context

`$meta.intentId` is used for:
- Once-markers (idempotency guards)
- Request tracking
- System value slot association

If evaluation and compute use different intentIds:
```
Evaluation: $meta.intentId = "id-1"
Compute: intent.intentId = "id-2"

Once-marker written with "id-1"
Readiness check with "id-2" → always false!
```

### Rationale

```
PROBLEM (split IDs):
  // Evaluation
  ctx.meta.intentId = crypto.randomUUID()  // "abc"
  patch creating = $meta.intentId  // stores "abc"
  
  // Compute loop
  intent.intentId = crypto.randomUUID()  // "xyz"
  when eq(creating, $meta.intentId)  // "abc" ≠ "xyz" → NEVER TRUE!
  
  Result: once() block never executes, or executes infinitely

SOLUTION (single ID):
  const intentId = crypto.randomUUID()  // "abc"
  
  // Evaluation
  ctx.meta.intentId = intentId  // "abc"
  patch creating = $meta.intentId  // stores "abc"
  
  // Compute loop
  intent.intentId = intentId  // "abc"
  when eq(creating, $meta.intentId)  // "abc" = "abc" → TRUE ✓
```

### Consequences

- Generate intentId once at the start of processing
- Pass same intentId to EvaluationContext and Intent
- Once-markers and readiness checks work correctly
- Request tracking is consistent

---

## FDR-H015: $system Exclusion from Translator Path

### Decision

**Host MUST exclude `system` from `allowSysPaths.prefixes` when processing Translator output.**

```typescript
// CORRECT
{ allowSysPaths: { prefixes: ["meta", "input"] } }

// VIOLATION
{ allowSysPaths: { prefixes: ["meta", "input", "system"] } }
```

### Context

System values require the effect lifecycle:
1. core.compute() encounters $system.*
2. Compiler inserts system.get effect
3. Host executes effect (produces UUID, timestamp, etc.)
4. Host patches result into Snapshot
5. core.compute() resumes with value available

Translator path bypasses this:
```
Translator → lower → evaluate → core.apply
           (no core.compute, no effects!)
```

### Rationale

```
PROBLEM:
  Translator output: patch id = $system.uuid
  
  lower(): __sys__action_uuid_value (slot reference)
  evaluate(): snapshot.data['__sys__action_uuid_value'] = undefined
  
  The slot is never filled! No effect executed!
  Result: id = undefined (or null)

SOLUTION:
  Translator path: forbid $system.*
  lower(): INVALID_SYS_PATH error
  
  If system values needed: use Flow via core.compute()
```

### Consequences

- Translator patches cannot use $system.*
- Lowering rejects system prefix with INVALID_SYS_PATH
- System values work via Flow execution (core.compute)
- Clear separation between Translator patches and Flow actions

---

## FDR-H016: snapshot.data Convention

### Decision

**Host MUST use `snapshot.data` (not `snapshot.state`) for domain data. Evaluation resolves paths against `snapshot.data`.**

### Context

Core/Bridge Snapshot structure:
```typescript
type Snapshot = {
  data: Record<string, unknown>;      // Domain state
  computed: Record<string, unknown>;  // Derived values
  system: SystemState;                // System state
  meta: SnapshotMeta;                 // Metadata
};
```

Some documentation used `snapshot.state` which is incorrect.

### Rationale

```
PROBLEM (wrong field):
  Path resolution: get("user.name")
  Code: ctx.snapshot.state.user?.name
  Result: undefined (field doesn't exist!)

SOLUTION (correct field):
  Path resolution: get("user.name")
  Code: ctx.snapshot.data.user?.name
  Result: "Alice" ✓
```

### Consequences

- Evaluation resolves non-prefixed paths to `snapshot.data.*`
- Evaluation resolves `computed.*` paths to `snapshot.computed.*`
- All documentation uses `snapshot.data` consistently
- Type errors caught at compile time

---

## FDR-H017: Informative Translator Loop

### Decision

**§13.2 (Host Loop with Translator) is INFORMATIVE, not normative. It is guidance for one integration pattern, not a required implementation.**

### Context

Translator SPEC defines Translator as proposal-only:
- Translator produces proposals
- Actor submits to Authority
- Authority approves/rejects
- Host executes approved intents

§13.2 shows a pattern where Host directly executes Translator output, bypassing Authority.

This is valid but not required.

### Rationale

| Approach | Description | Valid? |
|----------|-------------|--------|
| Authority model | Actor → Authority → Host | ✅ |
| Direct execution | Translator → Host (bypasses Authority) | ✅ |
| Human review | Translator → Human → Host | ✅ |
| Batch processing | Translator → Queue → Host | ✅ |

All approaches are valid. §13.2 shows one pattern.

### Consequences

- §13.2 is labeled "INFORMATIVE"
- Hosts MAY use different integration patterns
- Authority/Actor model is not bypassed by this section
- Ambiguity handling is Host policy, not mandated

---

## Appendix: v1.0 to v1.1 Changes

### New Requirements (MUST)

| Requirement | FDR |
|-------------|-----|
| Import `@manifesto-ai/compiler` | FDR-H011 |
| Call `lowerPatchFragments()` | FDR-H012 |
| Call `evaluateConditionalPatchOps()` | FDR-H012 |
| Pass `Patch[]` to `core.apply()` | FDR-H013 |
| Use single intentId | FDR-H014 |
| Exclude `system` from allowSysPaths | FDR-H015 |

### New Prohibitions (MUST NOT)

| Prohibition | FDR |
|-------------|-----|
| Pass MEL IR to core.apply() | FDR-H013 |
| Pass ConditionalPatchOp[] to core.apply() | FDR-H013 |
| Skip evaluation step | FDR-H012 |
| Include `system` in Translator allowSysPaths | FDR-H015 |
| Use different intentIds for eval/compute | FDR-H014 |

### Data Flow

```
Translator.translate()
    │
    ▼
PatchFragment[] (MEL IR + condition)
    │
    │ lowerPatchFragments() [FDR-H011, H015]
    │ • Compiler transforms IR
    │ • Rejects $system.*
    ▼
ConditionalPatchOp[] (Core IR + condition)
    │
    │ evaluateConditionalPatchOps() [FDR-H012, H016]
    │ • Sequential evaluation
    │ • Boolean-only conditions
    │ • Resolves against snapshot.data
    ▼
Patch[] (concrete values) [FDR-H013]
    │
    │ core.apply()
    ▼
Snapshot
```

### IntentId Flow

```
const intentId = crypto.randomUUID()  [FDR-H014]
           │
           ├──► EvaluationContext.meta.intentId
           │
           └──► Intent.intentId (compute loop)
           
Both MUST be the same value.
```

---

## Appendix: Key Quotes (v1.1)

> "Host MUST declare dependency on @manifesto-ai/compiler. Bypassing Compiler is a SPEC VIOLATION."
> — FDR-H011

> "Host MUST perform two steps: lowering (MEL IR → Core IR) and evaluation (Core IR → concrete). Skipping either is VIOLATION."
> — FDR-H012

> "Core.apply() receives concrete Patch[] only. Expressions stored as values break everything."
> — FDR-H013

> "Same intentId for evaluation and compute loop. Split IDs break once-markers and readiness checks."
> — FDR-H014

> "$system.* is forbidden in Translator path. No effect lifecycle means no system values."
> — FDR-H015

> "Use snapshot.data, not snapshot.state. The field is called data in Core/Bridge."
> — FDR-H016

> "§13.2 is informative. There are many valid ways to integrate Translator with Host."
> — FDR-H017

---

## Appendix: Cross-Reference with Compiler FDR

| Host FDR | Related Compiler FDR | Topic |
|----------|---------------------|-------|
| FDR-H011 | FDR-MEL-065 | Mandatory Compiler |
| FDR-H012 | FDR-MEL-069, 070 | Evaluation semantics |
| FDR-H013 | FDR-MEL-072 | ConditionalPatchOp |
| FDR-H014 | — | IntentId (Host-only) |
| FDR-H015 | FDR-MEL-071 | $system restriction |
| FDR-H016 | FDR-MEL-067 | Path conventions |
| FDR-H017 | — | Informative section |

---

*End of Host Contract FDR Document v1.1*
