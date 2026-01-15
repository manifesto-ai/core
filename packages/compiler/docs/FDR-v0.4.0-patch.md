# MEL Foundational Design Rationale v0.4.0 (Patch)

> **Version:** 0.4.0
> **Type:** Patch
> **Status:** Normative
> **Base:** v0.3.3 (REQUIRED - read FDR-v0.3.3.md first)
> **Purpose:** Document the "Why" behind design decisions in MEL v0.4.0
> **Changelog:**
> - v0.3.3: Core alignment — available, fail, stop, call policy, primitive aggregation, named types
> - **v0.4.0: Translator Lowering, Expression Evaluation, Host Integration**

---

## Part XII: Translator Integration (v0.4.0)

This section documents the foundational decisions for Translator output handling, expression evaluation, and Host integration.

### Table of Contents (v0.4.0)

| FDR | Title | Key Decision |
|-----|-------|--------------|
| FDR-MEL-064 | Compiler Owns Lowering Boundary | AD-COMP-LOW-001 |
| FDR-MEL-065 | Host Must Use Compiler | Mandatory integration |
| FDR-MEL-066 | Context Determination Per Op-Field | AD-COMP-LOW-002 |
| FDR-MEL-067 | Core Path Conventions | No $ prefix for meta/input |
| FDR-MEL-068 | $item Scope Restriction | effect.args only |
| FDR-MEL-069 | Expression Evaluation is Total | A35 |
| FDR-MEL-070 | Sequential Evaluation | Working snapshot |
| FDR-MEL-071 | $system Forbidden in Translator Path | Effect lifecycle required |
| FDR-MEL-072 | ConditionalPatchOp Preserves Conditions | Fragment condition survival |
| FDR-MEL-073 | Boolean-Only Conditions | No truthy/falsy coercion |

---

## FDR-MEL-064: Compiler Owns Lowering Boundary

### Decision

**Compiler MUST be the single owner of all lowering from MEL Canonical IR to Core Runtime IR.**

```
MEL Canonical IR (Translator) ──► Compiler ──► Core Runtime IR (Core)
```

### Context

The Manifesto ecosystem has two distinct IR representations:

| IR | Owner | Structure | Purpose |
|----|-------|-----------|---------|
| MEL Canonical IR | Translator | 7 node kinds, `call`-based | LLM-friendly, uniform |
| Core Runtime IR | Core | 30+ node kinds, named fields | Evaluator-friendly |

Example transformation:
```
MEL IR:  { kind: 'call', fn: 'eq', args: [A, B] }
Core IR: { kind: 'eq', left: A, right: B }
```

Prior to v0.4.0, the lowering boundary was implicit. It was unclear who transforms MEL IR to Core IR.

### Rationale

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Translator produces Core IR | No lowering needed | Couples Translator to Core internals; LLM must learn two shapes | ❌ Rejected |
| Core accepts both IRs | Flexibility | Complicates Core evaluator; no single source of truth | ❌ Rejected |
| **Compiler owns lowering** | Clean separation; centralized rules; evolution safety | Additional step | ✅ Adopted |

### Consequences

- Translator produces MEL Canonical IR only — no Core-specific shapes
- Core evaluates Core Runtime IR only — no MEL canonical forms
- Compiler transforms MEL IR to Core IR via explicit lowering API
- Host MUST call Compiler before applying Translator output to Core
- Future MEL/Core changes only require Compiler updates, not Translator changes

### Axiom

```
A34. Compiler is the single boundary between MEL IR and Core IR. [v0.4.0]
```

---

## FDR-MEL-065: Host Must Use Compiler

### Decision

**Host MUST use `@manifesto-ai/compiler` for all Translator output processing.**

Bypassing Compiler is a SPEC VIOLATION.

### Context

Without mandatory Compiler usage:
- Hosts might pass MEL IR directly to Core (undefined behavior)
- Hosts might implement custom lowering (drift from canonical rules)
- Different Hosts might produce different results from the same input

### Rationale

```
PROBLEM:
  Host A: implements lowering with bug
  Host B: implements lowering correctly
  Same Translator output → different Snapshots
  
  This violates "same input → same output" principle.

SOLUTION:
  Host A: uses Compiler.lower()
  Host B: uses Compiler.lower()
  Same Translator output → same Snapshots ✓
```

### Consequences

- Host dependency on `@manifesto-ai/compiler` is mandatory
- Custom lowering implementations are SPEC VIOLATIONS
- Compiler upgrades automatically propagate to all Hosts
- Deterministic behavior across all Host implementations

---

## FDR-MEL-066: Context Determination Per Op-Field

### Decision

**Compiler MUST determine schema/action context per PatchOp field and MUST enforce context restrictions regardless of host-provided options.**

Host does NOT provide `mode` for patch-level lowering.

### Context

A single `PatchFragment[]` array can contain expressions from different contexts:

| Op Field | Context | What's Allowed |
|----------|---------|----------------|
| `addComputed.expr` | schema | No $system, no $item |
| `addConstraint.rule` | schema | No $system, no $item |
| `ActionGuard.condition` | action | $meta, $input (no $system, no $item) |
| `ActionStmt.patch.value` | action | $meta, $input (no $system, no $item) |
| `ActionStmt.effect.args.*` | action | $meta, $input, $item |

If Host provided a global `mode="action"`, schema-context expressions would incorrectly allow forbidden nodes.

### Rationale

```
PROBLEM (global mode):
  Host says: mode="action"
  PatchFragment contains: addComputed.expr with $system.uuid
  Result: Compiler accepts (wrong!)
  
SOLUTION (per-field context):
  Compiler inspects: "addComputed.expr" → schema context
  Compiler rejects: $system.uuid (correct!)
  Host cannot override this determination
```

### Consequences

- `ExprLoweringContext` has `mode` (caller knows single-expression context)
- `PatchLoweringContext` has NO `mode` (Compiler determines per field)
- Schema-context expressions always reject $system and $item
- Host cannot accidentally bypass context restrictions

---

## FDR-MEL-067: Core Path Conventions

### Decision

**Core IR paths use Core conventions: `meta.*`, `input.*` (no $ prefix). `$item` retains $ prefix as special iteration variable.**

### Context

MEL uses $ prefix for special values: `$meta`, `$input`, `$system`, `$item`.

Core examples show paths without $ prefix: `input.title`, `meta.intentId`.

Mixing conventions creates confusion and potential bugs.

### Rationale

| Path Type | MEL Surface | Core IR Path | Resolution |
|-----------|-------------|--------------|------------|
| Intent metadata | `$meta.intentId` | `meta.intentId` | `ctx.meta.*` |
| Intent input | `$input.title` | `input.title` | `ctx.input.*` |
| Iteration var | `$item.name` | `$item.name` | `ctx.item.*` |
| State | `user.name` | `user.name` | `ctx.snapshot.data.*` |
| Computed | `computed.total` | `computed.total` | `ctx.snapshot.computed.*` |

`$item` retains $ because it's semantically distinct (iteration variable, not a snapshot path).

### Consequences

- Lowering transforms `sys(["meta","intentId"])` → `get("meta.intentId")`
- Lowering transforms `sys(["input","title"])` → `get("input.title")`
- Lowering transforms `var("item")` → `get("$item")`
- Evaluation resolves paths against correct context sources

---

## FDR-MEL-068: $item Scope Restriction

### Decision

**`$item` is ONLY allowed in `effect.args.*` context. Guards and patch values do NOT have access to $item.**

### Context

MEL SPEC states `$item` is an "Iteration Variable" for effects with collection parameters:

```mel
effect api:notify { to: $item.email } for each users
```

However, $item has no meaning outside effect iteration.

### Rationale

| Context | $item Allowed | Reason |
|---------|---------------|--------|
| `ActionGuard.condition` | ❌ | No iteration in guards |
| `ActionStmt.patch.value` | ❌ | No iteration in patches |
| `ActionStmt.effect.args.*` | ✅ | Effect `for each` iteration |

```
PROBLEM:
  Guard: when gt($item.price, 100)
  What is $item? There's no iteration!
  
SOLUTION:
  Compiler rejects: INVALID_KIND_FOR_CONTEXT
```

### Consequences

- Lowering rejects `var(item)` in guard/patch contexts
- Lowering accepts `var(item)` only in effect.args contexts
- Clear error messages guide developers to correct usage

---

## FDR-MEL-069: Expression Evaluation is Total

### Decision

**Expression evaluation MUST be a total function. Invalid operations return null, never throw.**

### Context

MEL SPEC §6.5 states: "Expressions do NOT throw. Invalid operations return null."

Core expects computed values to always resolve without exceptions.

JavaScript-style exceptions would break determinism and complicate error handling.

### Rationale

| Operation | Invalid Condition | Result |
|-----------|-------------------|--------|
| `div(a, b)` | b = 0 | null |
| `get(path)` | Path not found | null |
| `add(a, b)` | Non-numeric operand | null |
| `at(arr, i)` | Index out of bounds | null |
| `first(arr)` | Empty array | null |

```
PROBLEM (throw-based):
  try {
    const result = evaluateExpr(expr, ctx);
  } catch (e) {
    // What do we do? Abort? Partial state?
  }

SOLUTION (total):
  const result = evaluateExpr(expr, ctx);
  // result is always a value (possibly null)
  // No exception handling needed
  // Deterministic behavior
```

**Exception:** Only structural errors (UNKNOWN_NODE_KIND, INVALID_SHAPE) may throw, as these indicate implementation bugs, not runtime conditions.

### Axiom

```
A35. Expression evaluation is total; invalid operations return null, never throw. [v0.4.0]
```

### Consequences

- `evaluateExpr()` always returns a value (never throws for runtime conditions)
- `evaluateConditionalPatchOps()` is predictable and testable
- No try/catch needed around evaluation
- Null propagation is explicit and traceable

---

## FDR-MEL-070: Sequential Evaluation with Working Snapshot

### Decision

**Multi-patch evaluation MUST use sequential semantics with working snapshot. Later patches see effects of earlier patches.**

### Context

When evaluating multiple patches:
```typescript
ops: [
  { op: "set", path: "a", value: lit(1) },
  { op: "set", path: "b", value: add(get("a"), lit(1)) }
]
```

Should `b` evaluate to:
- `initialSnapshot.a + 1` (parallel semantics)?
- `1 + 1 = 2` (sequential semantics)?

### Rationale

| Semantics | Behavior | Pros | Cons |
|-----------|----------|------|------|
| Parallel | All patches evaluate against initial snapshot | Simple | Counter-intuitive; can't reference earlier patches |
| **Sequential** | Each patch sees effects of previous | Intuitive; matches Flow semantics | Slightly more complex |

```
Sequential (ADOPTED):
  Initial: { a: 0, b: 0 }
  Step 1: a = 1, working = { a: 1, b: 0 }
  Step 2: b = a + 1 = 2 (sees a=1)
  Result: { a: 1, b: 2 }

Parallel (REJECTED):
  Initial: { a: 0, b: 0 }
  Step 1: a = 1
  Step 2: b = a + 1 = 1 (sees initial a=0)
  Result: { a: 1, b: 1 } ← surprising!
```

### Consequences

- Evaluation maintains working snapshot
- Each op evaluation sees previous patches' effects
- Order of patches matters (deterministic)
- Output preserves input order (filtered by conditions)

---

## FDR-MEL-071: $system Forbidden in Translator Path

### Decision

**`$system.*` is NOT available in Translator-evaluation path. System values require Flow execution with system.get effect.**

### Context

System values (`$system.uuid`, `$system.now`) are IO operations:
1. Core.compute() executes Flow
2. Flow encounters $system.* → raises system.get effect
3. Host executes effect → produces value
4. Host patches value into Snapshot
5. Core.compute() resumes with fresh value

Translator-evaluation path bypasses this lifecycle:
```
Translator → lower → evaluate → core.apply
             (no compute, no effects!)
```

### Rationale

```
PROBLEM:
  Translator output: patch id = $system.uuid
  
  lower(): { kind: 'get', path: '__sys__action_uuid_value' }
  evaluate(): snapshot.data['__sys__action_uuid_value'] = undefined
  
  Result: id = undefined (no effect executed to produce UUID!)

SOLUTION:
  Translator path: $system.* → INVALID_SYS_PATH error
  Flow path: $system.* → works via effect lifecycle
```

### Consequences

- `allowSysPaths` in Translator context: `["meta", "input"]` only
- `system` prefix is forbidden → LoweringError(INVALID_SYS_PATH)
- System values work correctly in Flow execution (core.compute)
- Clear separation between Translator patches and Flow-based actions

---

## FDR-MEL-072: ConditionalPatchOp Preserves Conditions

### Decision

**Lowering MUST preserve PatchFragment.condition in ConditionalPatchOp. Host MUST use evaluateConditionalPatchOps() which applies conditions.**

### Context

Translator PatchFragment includes optional `condition`:
```typescript
type PatchFragment = {
  condition?: MelExprNode;  // "Apply only if..."
  op: MelPatchOp;
  // ...metadata
};
```

If lowering discards conditions, all patches would always apply (wrong!).

### Rationale

```
PROBLEM (condition lost):
  Fragment: { condition: gt(balance, 0), op: set(active, true) }
  lowerPatchFragments() → { op: "set", path: "active", value: true }
  Result: active = true even when balance ≤ 0!

SOLUTION (condition preserved):
  Fragment: { condition: gt(balance, 0), op: set(active, true) }
  lowerPatchFragments() → { 
    condition: { kind: 'gt', ... },
    op: "set", path: "active", value: { kind: 'lit', value: true }
  }
  evaluateConditionalPatchOps() → checks condition first
  Result: active = true only when balance > 0 ✓
```

### Consequences

- `lowerPatchFragments()` returns `ConditionalPatchOp[]` (not `PatchOp[]`)
- `ConditionalPatchOp.condition` is optional Core IR expression
- `evaluateConditionalPatchOps()` applies condition before including patch
- Conditional patches work correctly end-to-end

---

## FDR-MEL-073: Boolean-Only Conditions

### Decision

**Condition MUST evaluate to boolean. Truthy/falsy coercion is forbidden. Non-boolean results are treated as false.**

### Context

MEL SPEC states guard conditions must be boolean. JavaScript-style truthy/falsy creates ambiguity:

| Value | JS Truthy | Boolean? |
|-------|-----------|----------|
| `1` | ✅ | ❌ |
| `"ok"` | ✅ | ❌ |
| `{}` | ✅ | ❌ |
| `true` | ✅ | ✅ |
| `false` | ❌ | ✅ |
| `null` | ❌ | ❌ |

### Rationale

```
PROBLEM (truthy):
  Host A: treats 1 as truthy → applies patch
  Host B: treats 1 as non-boolean → skips patch
  Same input → different results!

SOLUTION (boolean-only):
  Condition = true → apply
  Condition = false → skip
  Condition = null/non-boolean → skip (+ warning)
  
  All Hosts behave identically.
```

### Consequences

- Condition evaluation: `true` → apply, `false` → skip
- Non-boolean results (including null) → skip (treated as false)
- Compiler MAY emit warning for non-boolean condition results
- Deterministic behavior across all implementations

---

## Appendix: v0.3.3 to v0.4.0 Changes

### Architecture Decisions

| AD | Title | Status |
|----|-------|--------|
| AD-COMP-LOW-001 | Compiler Owns Lowering Boundary | Normative |
| AD-COMP-LOW-002 | Context Determination Per Op-Field | Normative |
| AD-COMP-LOW-003 | Expression Evaluation is Total | Normative |

### New Axioms

```
A34. Compiler is the single boundary between MEL IR and Core IR. [v0.4.0]
A35. Expression evaluation is total; invalid operations return null, never throw. [v0.4.0]
```

### New API Surface

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `lowerPatchFragments()` | `PatchFragment[]` | `ConditionalPatchOp[]` | MEL IR → Core IR |
| `evaluateConditionalPatchOps()` | `ConditionalPatchOp[]` | `Patch[]` | Core IR → concrete |
| `compileMelDomain()` | MEL text | `DomainSchema` | Text → Schema |
| `compileMelPatch()` | MEL text | `ConditionalPatchOp[]` | Text → Ops |

### Data Flow

```
Translator
    │
    ▼
PatchFragment[] (MEL IR + condition)
    │
    │ lowerPatchFragments() [FDR-064, 066, 067, 068, 071, 072]
    ▼
ConditionalPatchOp[] (Core IR + condition)
    │
    │ evaluateConditionalPatchOps() [FDR-069, 070, 073]
    ▼
Patch[] (concrete values)
    │
    │ core.apply()
    ▼
Snapshot
```

---

## Appendix: Key Quotes (v0.4.0)

> "Compiler is the single boundary between MEL IR and Core IR. Translator produces MEL IR. Core consumes Core IR. Compiler bridges."
> — FDR-MEL-064

> "Host MUST use Compiler for all Translator output processing. Bypassing Compiler is a SPEC VIOLATION."
> — FDR-MEL-065

> "Compiler determines schema/action context per op-field. Host cannot override. Schema expressions never allow $system or $item."
> — FDR-MEL-066

> "Core IR uses Core path conventions: `meta.*`, `input.*` without $ prefix. `$item` retains $ as special iteration variable."
> — FDR-MEL-067

> "$item is ONLY allowed in effect.args context. Guards and patch values do not have access to $item — there is no iteration there."
> — FDR-MEL-068

> "Expression evaluation is total. Invalid operations return null, never throw. This follows MEL's 'no throw' principle."
> — FDR-MEL-069

> "Multi-patch evaluation uses sequential semantics. Later patches see effects of earlier patches via working snapshot."
> — FDR-MEL-070

> "$system.* is forbidden in Translator-evaluation path. System values require the full effect lifecycle via core.compute()."
> — FDR-MEL-071

> "ConditionalPatchOp preserves PatchFragment.condition. Lowering does not discard conditions. Evaluation applies them."
> — FDR-MEL-072

> "Conditions are boolean-only. Truthy/falsy coercion is forbidden. true → apply, false/null/other → skip."
> — FDR-MEL-073

---

*End of MEL FDR Document v0.4.0*
