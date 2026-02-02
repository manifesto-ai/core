# MEL Compiler SPEC v0.4.0 (Patch)

> **Version:** 0.4.0
> **Type:** Patch
> **Status:** Merged
> **Date:** 2026-01-04
> **Base:** v0.3.3 (REQUIRED - read SPEC-v0.3.3.md first)
> **Scope:** Translator Lowering, Expression Evaluation, Host Integration
> **Merged Into:** `SPEC-v0.5.0.md`
> **Revision:** Rev.5 - All GO-Blocking issues resolved

---

> **⚠️ PARTIAL SUPERSEDE NOTICE (Host Integration)**
>
> Host-Compiler coupling requirements in this document are superseded by
> Host v2.0.1 FDR-H024 (Compiler/Translator Decoupling).
>
> **Affected sections:**
> - Section 7 (§20): Host Integration Requirements
> - All "Host MUST use Compiler" requirements
> - `evaluateConditionalPatchOps()` Host obligation
>
> Host no longer requires `@manifesto-ai/compiler` dependency.
> Translator integration is now Bridge/App layer responsibility.
>
> See `packages/host/docs/host-FDR-v2.0.1.md#fdr-h024`.

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| AD-COMP-LOW-001 | Architecture Decision | Breaking |
| AD-COMP-LOW-002 | Architecture Decision | Normative |
| AD-COMP-LOW-003 | Architecture Decision | Normative |
| Section 16: Architecture Decisions | New Section | Normative |
| Section 17: Translator Lowering | New Section | Breaking |
| Section 18: Expression Evaluation | **New Section (Normative)** | Breaking |
| Section 19: MEL Text Ingest | New Section | New API |
| Section 20: Host Integration | New Section | Breaking |
| Axiom A34, A35 | New Axioms | Normative |
| FDR-MEL-064 ~ 072 | New FDRs | Rationale |

---

## Revision History (Rev.5 Fixes)

| Issue | Source | Resolution |
|-------|--------|------------|
| intentId split in §13.2 | R1-1 | Single intentId throughout |
| Evaluation norm missing | R1-2 | §18 is Normative |
| $system handling | R1-3, R2-5 | Forbidden in Translator path |
| Multi-patch semantics | R1-4 | Sequential evaluation (working snapshot) |
| Core get.base missing | R2-1 | var(item) only, else UNSUPPORTED |
| $input/$meta path | R2-2 | Core convention: input.*, meta.* |
| $item scope | R2-3 | effect.args only |
| Evaluation throw | R2-4 | Total function, returns null |
| condition loss | R2-6 | ConditionalPatchOp[] type |
| **snapshot.state** | R3-1 | **Changed to snapshot.data** |
| **truthy/falsy** | R3-2 | **Boolean-only condition** |

---

## 1. Changelog Entry

```diff
> **Changelog:**
> ...existing entries...
> - **v0.3.3: Core alignment, primitive aggregation, named types**
+ > - **v0.4.0: Translator Lowering, Expression Evaluation, Host Integration**
```

---

## 2. New Axioms

```
A34. Compiler is the single boundary between MEL IR and Core IR. [v0.4.0]
A35. Expression evaluation is total; invalid operations return null, never throw. [v0.4.0]
```

---

## 3. Architecture Decisions

```markdown
---

## 16. Architecture Decisions

### AD-COMP-LOW-001: Compiler Owns Lowering Boundary

**Decision:** Compiler MUST be the single owner of all lowering from MEL Canonical IR to Core Runtime IR.

### AD-COMP-LOW-002: Compiler Determines Context Per Op-Field

**Decision:** Compiler MUST determine schema/action context per PatchOp field.

**Context Rules (CRIT-08 + R2-3 Fix):**

| Op Field | Context | sys.system | sys.meta/input | var($item) |
|----------|---------|------------|----------------|------------|
| `addComputed.expr` | schema | ❌ | ✅ | ❌ |
| `addConstraint.rule` | schema | ❌ | ✅ | ❌ |
| `addActionAvailable.expr` | schema | ❌ | ✅ | ❌ |
| `stateDefault` | schema | ❌ | ❌ | ❌ |
| `ActionGuard.condition` | action | ❌* | ✅ | ❌ |
| `ActionStmt.patch.value` | action | ❌* | ✅ | ❌ |
| `ActionStmt.effect.args.*` | action | ❌* | ✅ | **✅** |

**$item Scope (R2-3 Fix):**
> `$item` is ONLY allowed in `effect.args.*` (iteration variable for effect parameters).
> Guards and patch values do NOT have access to $item.

**$system Restriction (R1-3 + R2-5 Fix):**
> `$system.*` is forbidden in Translator-evaluation path.
> System values require Flow execution (core.compute) with system.get effect.

### AD-COMP-LOW-003: Expression Evaluation is Total

**Decision:** Expression evaluation MUST be a total function. Invalid operations return null, never throw.

**Rationale (A35):**
> MEL SPEC §6.5: "Expressions do NOT throw. Invalid operations return null."
> Core expects computed values to always resolve. 
> Evaluation follows the same principle.

**Semantic Rules:**
- Division by zero → null
- Path not found → null  
- Type mismatch (add string to number) → null
- Null property access → null

**Exception:** Only structural errors (UNKNOWN_NODE_KIND, INVALID_SHAPE) may throw, as these indicate implementation bugs, not runtime conditions.
```

---

## 4. Translator Lowering

```markdown
---

## 17. Translator Lowering

### 17.1 IR Definitions

#### 17.1.1 MEL Canonical IR (Input)

```typescript
type MelPrimitive = null | boolean | number | string;
type MelPathSegment = { kind: "prop"; name: string };
type MelPathNode = MelPathSegment[];
type MelSystemPath = string[]; // ["meta","intentId"], ["input","title"]
type MelObjField = { key: string; value: MelExprNode };

type MelExprNode =
  | { kind: "lit"; value: MelPrimitive }
  | { kind: "var"; name: "item" }
  | { kind: "sys"; path: MelSystemPath }
  | { kind: "get"; base?: MelExprNode; path: MelPathNode }
  | { kind: "call"; fn: string; args: MelExprNode[] }
  | { kind: "obj"; fields: MelObjField[] }
  | { kind: "arr"; elements: MelExprNode[] };
```

#### 17.1.2 Core Runtime IR (Output)

```typescript
import type { ExprNode as CoreExprNode } from "@manifesto-ai/core";
// Core get uses string path: { kind: "get", path: "user.name" }
// Core get does NOT have base field
```

### 17.2 Lowering Context

```typescript
type ExprLoweringContext = {
  mode: "schema" | "action";
  /** Only meta/input allowed (system forbidden in Translator path) */
  allowSysPaths?: { prefixes: Array<"meta" | "input"> };
  fnTableVersion: string;
  actionName?: string;
};

type PatchLoweringContext = {
  // NO mode — Compiler determines per op-field
  /** Only meta/input allowed (system forbidden) */
  allowSysPaths?: { prefixes: Array<"meta" | "input"> };
  fnTableVersion: string;
  actionName?: string;
};
```

**NORMATIVE: `system` prefix is NOT allowed in Translator path.**

### 17.3 Lowering Semantics

#### 17.3.1 sys Lowering (R2-2 Fix)

**CRITICAL: Use Core path conventions (no $ prefix).**

```typescript
// MEL: { kind: 'sys', path: ['meta', 'intentId'] }
// Core: { kind: 'get', path: 'meta.intentId' }
//                       ↑ NO $ prefix (Core convention)

// MEL: { kind: 'sys', path: ['input', 'title'] }
// Core: { kind: 'get', path: 'input.title' }

// MEL: { kind: 'sys', path: ['system', 'uuid'] }
// Translator path: LoweringError(INVALID_SYS_PATH)
// Flow path only: lowered per §11 → __sys__ slot
```

**Normative:**
> In Translator-evaluation path, `sys.system` MUST be rejected with INVALID_SYS_PATH.
> `sys.meta` and `sys.input` are lowered to Core `get` with paths `meta.*` and `input.*`.

#### 17.3.2 var Lowering (R2-3 Fix)

**CRITICAL: $item only allowed in effect.args context.**

```typescript
// In effect.args context:
// MEL: { kind: 'var', name: 'item' }
// Core: { kind: 'get', path: '$item' }

// MEL: { kind: 'get', base: { kind: 'var', name: 'item' }, path: [{prop:'name'}] }
// Core: { kind: 'get', path: '$item.name' }

// In guard/patch.value context:
// MEL: { kind: 'var', name: 'item' }
// Result: LoweringError(INVALID_KIND_FOR_CONTEXT)
```

#### 17.3.3 get Lowering

**PathNode[] → string path:**

```typescript
// MEL: { kind: 'get', path: [{prop:'user'}, {prop:'name'}] }
// Core: { kind: 'get', path: 'user.name' }
```

#### 17.3.4 get.base Handling (R2-1 Fix)

**CRITICAL: Core `get` has NO base field. Only var(item) base is supported.**

```typescript
// Supported: base is var(item)
// MEL: { kind: 'get', base: { kind: 'var', name: 'item' }, path: [{prop:'x'}] }
// Core: { kind: 'get', path: '$item.x' }

// NOT Supported: base is any other expression
// MEL: { kind: 'get', base: { kind: 'call', fn: 'at', args: [...] }, path: [...] }
// Result: LoweringError(UNSUPPORTED_BASE)
```

**Normative:**
> `get.base` MUST be either:
> - `undefined` → lower path directly
> - `{ kind: 'var', name: 'item' }` → prefix path with `$item.`
> - Any other expression → LoweringError(UNSUPPORTED_BASE)

#### 17.3.5 call Lowering

```typescript
// MEL: { kind: 'call', fn: 'eq', args: [A, B] }
// Core: { kind: 'eq', left: <lowered A>, right: <lowered B> }
```

### 17.4 Lowering API

```typescript
function lowerExprNode(
  input: MelExprNode,
  ctx: ExprLoweringContext
): CoreExprNode;

function lowerPatchOps(
  ops: MelPatchOp[], 
  ctx: PatchLoweringContext
): ConditionalPatchOp[];

function lowerPatchFragments(
  fragments: TranslatorPatchFragment[], 
  ctx: PatchLoweringContext
): ConditionalPatchOp[];
```

### 17.5 ConditionalPatchOp Type (R2-6 Fix)

**CRITICAL: Preserve condition from PatchFragment.**

```typescript
type ConditionalPatchOp = {
  /** 
   * Optional condition (from PatchFragment.condition).
   * MUST evaluate to boolean (true applies, false/null/non-boolean skips).
   * See §18.6 for boolean-only evaluation semantics.
   */
  condition?: CoreExprNode;
  
  /** The patch operation */
  op: "set" | "unset" | "merge";
  path: string;
  value?: CoreExprNode;
};

// lowerPatchFragments preserves fragment.condition
// Host MUST use evaluateConditionalPatchOps()
```

### 17.6 Lowering Errors

```typescript
type LoweringErrorCode =
  | "INVALID_KIND_FOR_CONTEXT"  // var in non-effect context, sys in schema
  | "UNKNOWN_CALL_FN"
  | "INVALID_SYS_PATH"          // sys.system in Translator path
  | "UNSUPPORTED_BASE"          // get.base is not var(item)
  | "INVALID_SHAPE";            // malformed node structure

class LoweringError extends Error {
  readonly code: LoweringErrorCode;
  readonly path?: string[];
  readonly details?: Record<string, unknown>;
}
```
```

---

## 5. Expression Evaluation (Normative)

```markdown
---

## 18. Expression Evaluation

**STATUS: NORMATIVE** — This section defines mandatory evaluation semantics.

### 18.1 Purpose

Core.apply() expects concrete `Patch[]`. Compiler MUST provide evaluation that resolves Core IR expressions to concrete values.

### 18.2 Total Function Principle (R2-4 Fix)

**CRITICAL: Evaluation is TOTAL. Invalid operations return null, never throw.**

```typescript
// A35: "Expression evaluation is total; invalid operations return null, never throw."

// Examples:
// div(10, 0) → null (not throw)
// get("nonexistent.path") → null (not throw)
// add("string", 5) → null (not throw)
// at(arr, -1) → null (not throw)
```

**Exception:** Only structural errors (UNKNOWN_NODE_KIND, INVALID_SHAPE) may throw.

### 18.3 Evaluation Context

```typescript
type EvaluationContext = {
  /** Current snapshot for state lookups */
  snapshot: Snapshot;
  
  /** Intent metadata */
  meta: {
    intentId: string;
    actor?: ActorRef;
    timestamp?: number;
  };
  
  /** Intent input */
  input: Record<string, unknown>;
  
  /** Current $item value (for effect.args evaluation) */
  item?: unknown;
};
```

**NORMATIVE: No `system` field.** System values are not available in Translator-evaluation path.

### 18.4 Evaluation API

```typescript
/**
 * Evaluate a single Core expression to a concrete value.
 * TOTAL: Returns null on invalid operations, never throws (except structural errors).
 */
function evaluateExpr(
  expr: CoreExprNode,
  ctx: EvaluationContext
): unknown;

/**
 * Evaluate conditional patch ops to concrete patches.
 * Applies conditions, evaluates values, returns only applicable patches.
 * 
 * NORMATIVE (Output Order Stability):
 * - Output Patch[] maintains input ops[] order
 * - Patches where condition is false are filtered out
 * - Remaining patches preserve their relative order
 */
function evaluateConditionalPatchOps(
  ops: ConditionalPatchOp[],
  ctx: EvaluationContext
): Patch[];
```

### 18.5 Sequential Evaluation Semantics (R1-4 Fix)

**CRITICAL: Multi-patch evaluation uses working snapshot.**

```typescript
/**
 * NORMATIVE: Sequential evaluation with working snapshot.
 * 
 * Given ops: [op1, op2, op3]
 * 
 * 1. Evaluate op1.condition against ctx.snapshot.data
 *    If true, evaluate op1.value against ctx.snapshot.data
 *    Apply patch1 to working snapshot
 * 
 * 2. Evaluate op2.condition against WORKING snapshot.data
 *    If true, evaluate op2.value against WORKING snapshot.data
 *    Apply patch2 to working snapshot
 * 
 * 3. ... and so on
 * 
 * Return: All applicable Patch[] (concrete values, in input order)
 */

// Example:
// ops: [
//   { op: "set", path: "a", value: { kind: "lit", value: 1 } },
//   { op: "set", path: "b", value: { kind: "add", left: { kind: "get", path: "a" }, right: { kind: "lit", value: 1 } } }
// ]
// Initial snapshot.data: { a: 0, b: 0 }
// 
// Step 1: Evaluate a = 1, working snapshot.data becomes { a: 1, b: 0 }
// Step 2: Evaluate b = a + 1 = 1 + 1 = 2 (uses working snapshot where a=1)
// 
// Result patches: [{ op: "set", path: "a", value: 1 }, { op: "set", path: "b", value: 2 }]
```

### 18.6 Condition Evaluation (R3-2 Fix: Boolean-Only)

**NORMATIVE: Condition MUST be boolean. Truthy/falsy coercion is forbidden.**

```typescript
// If condition is present:
// 1. Evaluate condition expression
// 2. Check result type:
//    - If result === true  → evaluate value and include patch
//    - If result === false → skip this patch
//    - If result is null or non-boolean → treat as false (skip), emit warning
// 
// This follows MEL's boolean-only principle for guards/conditions.

// If condition is absent:
// Always evaluate and include patch

// Example implementation:
function shouldApplyPatch(condition: CoreExprNode | undefined, ctx: EvaluationContext): boolean {
  if (condition === undefined) return true;
  
  const result = evaluateExpr(condition, ctx);
  
  // Boolean-only (MEL rule)
  if (result === true) return true;
  if (result === false) return false;
  
  // Non-boolean or null → false (TOTAL principle: no throw)
  // Compiler MAY emit warning for non-boolean condition result
  return false;
}
```

**Rationale:**
> MEL SPEC: "Guard conditions must evaluate to boolean."
> This prevents JS-style truthy coercion that could cause inconsistent behavior.

### 18.7 Path Resolution (R3-1 Fix: snapshot.data)

**Core convention paths:**

| Path prefix | Resolves to |
|-------------|-------------|
| `meta.*` | `ctx.meta.*` |
| `input.*` | `ctx.input.*` |
| `$item.*` | `ctx.item.*` |
| `computed.*` | `ctx.snapshot.computed.*` |
| (other) | `ctx.snapshot.data.*` |

```typescript
// get(path: "meta.intentId") → ctx.meta.intentId
// get(path: "input.title") → ctx.input.title
// get(path: "$item.name") → ctx.item?.name
// get(path: "computed.total") → ctx.snapshot.computed?.total
// get(path: "user.name") → ctx.snapshot.data.user?.name
// get(path: "user.name") → ctx.snapshot.state.user?.name
```

### 18.8 Operator Semantics (Total)

| Operation | Invalid condition | Result |
|-----------|-------------------|--------|
| `add(a, b)` | Non-numeric operand | null |
| `div(a, b)` | b = 0 | null |
| `get(path)` | Path not found | null |
| `at(arr, i)` | Out of bounds | null |
| `first(arr)` | Empty array | null |
| `eq(a, b)` | (always valid) | boolean |

### 18.9 Complete Flow Example

```typescript
// 1. Translator output
const fragment: TranslatorPatchFragment = {
  fragmentId: "abc",
  sourceIntentId: "intent-123",
  condition: { kind: 'call', fn: 'gt', args: [
    { kind: 'get', path: [{ kind: 'prop', name: 'count' }] },
    { kind: 'lit', value: 0 }
  ]},
  op: {
    op: "set",
    path: "count",
    value: { kind: 'call', fn: 'add', args: [
      { kind: 'get', path: [{ kind: 'prop', name: 'count' }] },
      { kind: 'lit', value: 1 }
    ]}
  },
  confidence: 0.95,
  evidence: [],
  createdAt: Date.now()
};

// 2. Lower (MEL IR → Core IR + condition)
const lowered: ConditionalPatchOp[] = lowerPatchFragments([fragment], {
  fnTableVersion: "1.0",
  actionName: "increment"
});
// Result: [{
//   condition: { kind: 'gt', left: { kind: 'get', path: 'count' }, right: { kind: 'lit', value: 0 } },
//   op: "set", path: "count", value: { kind: 'add', left: {...}, right: {...} }
// }]

// 3. Evaluate (Core IR → concrete values, with boolean condition check)
const patches: Patch[] = evaluateConditionalPatchOps(lowered, {
  snapshot: { data: { count: 5 }, computed: {} },
  meta: { intentId: "intent-123" },
  input: {}
});
// Condition: count(5) > 0 = true (boolean) → include
// Value: count(5) + 1 = 6
// Result: [{ op: "set", path: "count", value: 6 }]

// 4. Apply
const newSnapshot = core.apply(schema, currentSnapshot, patches);
```
```

---

## 6. MEL Text Ingest

```markdown
---

## 19. MEL Text Ingest

### 19.1 Domain Compilation

```typescript
function compileMelDomain(
  melText: string,
  opts: { mode: "domain"; fnTableVersion?: string }
): { schema: DomainSchema; trace: CompileTrace; warnings: CompileWarning[] };
```

### 19.2 Patch Compilation

**Returns `ConditionalPatchOp[]` (not evaluated).**

```typescript
function compileMelPatch(
  melText: string,
  opts: { 
    mode: "patch"; 
    actionName: string;
    fnTableVersion?: string;
    /** Only meta/input (system forbidden) */
    allowSysPaths?: { prefixes: Array<"meta" | "input"> };
  }
): { ops: ConditionalPatchOp[]; trace: CompileTrace; warnings: CompileWarning[] };
```

**Bridge Note:**
> `compileMelPatch()` returns `ConditionalPatchOp[]` where `condition` is `undefined` for all ops
> (MEL patch text does not include inline conditions).
> Host MUST still call `evaluateConditionalPatchOps()` to evaluate expressions to concrete values.
```

---

## 7. Host Integration

> **⚠️ SUPERSEDED** by Host v2.0.1 FDR-H024.
> Host no longer requires `@manifesto-ai/compiler` dependency.
> Translator integration is now Bridge/App layer responsibility.
> See `packages/host/docs/host-FDR-v2.0.1.md#fdr-h024`.

```markdown
---

## 20. Host Integration Requirements (SUPERSEDED)

### 20.1 Complete Data Flow

```
Translator → PatchFragment[] (MEL IR + condition)
│
│  lowerPatchFragments(ctx)
▼
ConditionalPatchOp[] (Core IR + condition)
│
│  evaluateConditionalPatchOps(evalCtx)
▼
Patch[] (concrete values, conditions applied)
│
│  core.apply(schema, snapshot, patches)
▼
Snapshot
```

### 20.2 Required Calls

```typescript
import { 
  lowerPatchFragments, 
  evaluateConditionalPatchOps,
  PatchLoweringContext,
  EvaluationContext,
  ConditionalPatchOp,
  Patch
} from "@manifesto-ai/compiler";

// 1. Lower (preserves conditions)
const lowered: ConditionalPatchOp[] = lowerPatchFragments(
  translatorOutput.fragments,
  {
    // NO system prefix (forbidden in Translator path)
    allowSysPaths: { prefixes: ["meta", "input"] },
    fnTableVersion: "1.0",
    actionName: intent.type
  }
);

// 2. Evaluate (applies conditions, sequential semantics)
const patches: Patch[] = evaluateConditionalPatchOps(lowered, {
  snapshot: currentSnapshot,
  meta: { intentId: intent.intentId },
  input: intent.input ?? {}
});

// 3. Apply (concrete values only)
const newSnapshot = core.apply(schema, currentSnapshot, patches);
```

### 20.3 $system.* Restriction (R1-3 + R2-5)

**NORMATIVE: $system.* is NOT available in Translator-evaluation path.**

| Value type | Translator path | Flow path (core.compute) |
|------------|-----------------|--------------------------|
| $meta.* | ✅ (via EvaluationContext) | ✅ |
| $input.* | ✅ (via EvaluationContext) | ✅ |
| $system.* | ❌ (LoweringError) | ✅ (via system.get effect) |

**Rationale:**
> System values require Host Effect execution → result patch → Snapshot update.
> This lifecycle only exists in core.compute flow.
> Translator-evaluation path bypasses this, so system values cannot be produced.

### 20.4 Spec Violations

| Action | Status |
|--------|--------|
| Pass MEL IR to core.apply() | **VIOLATION** |
| Pass ConditionalPatchOp[] to core.apply() | **VIOLATION** |
| Skip evaluation step | **VIOLATION** |
| Include $system.* in Translator patches | **VIOLATION** |
| Implement custom evaluation | **VIOLATION** |

### 20.5 Compliance Checklist

| Requirement | Level |
|-------------|-------|
| Call `lowerPatchFragments()` | MUST |
| Call `evaluateConditionalPatchOps()` | MUST |
| Pass `Patch[]` (concrete) to `core.apply()` | MUST |
| Use single intentId throughout processing | MUST |
| Exclude $system.* from Translator path | MUST |
| Handle LoweringError | MUST |
| Handle structural EvaluationError only | MUST |
```

---

## 8. FDR Summary

| FDR | Title |
|-----|-------|
| FDR-MEL-064 | Compiler owns lowering boundary |
| FDR-MEL-065 | Host must use Compiler |
| FDR-MEL-066 | Context determination per op-field |
| FDR-MEL-067 | Core path conventions (no $ prefix for meta/input) |
| FDR-MEL-068 | $item restricted to effect.args |
| FDR-MEL-069 | Expression evaluation is total |
| FDR-MEL-070 | Sequential evaluation with working snapshot |
| FDR-MEL-071 | $system forbidden in Translator path |
| FDR-MEL-072 | ConditionalPatchOp preserves conditions |

---

## 9. Acceptance Criteria

- [ ] `lowerPatchFragments()` returns `ConditionalPatchOp[]`
- [ ] Conditions are preserved from PatchFragment
- [ ] Core IR uses string paths without $ prefix for meta/input
- [ ] `var(item)` only allowed in effect.args context
- [ ] `get.base` only supports var(item), else UNSUPPORTED_BASE
- [ ] `sys.system` rejected with INVALID_SYS_PATH
- [ ] `evaluateConditionalPatchOps()` is total (returns null, not throw)
- [ ] Sequential evaluation uses working snapshot
- [ ] `core.apply()` receives concrete `Patch[]` only

---

*End of Patch Document (Rev.4)*
