# MEL Expression Gap Analysis

> **Version:** 1.0
> **Date:** 2026-01-01
> **Status:** Draft
> **References:** `@manifesto-ai/mel-compiler/docs/SPEC.md` (MEL v0.2)

---

## 1. Overview

This document analyzes the gap between MEL (Manifesto Expression Language) SPEC v0.2 and the current `@manifesto-ai/core` implementation. It identifies missing ExprNode types and evaluates implementation feasibility.

---

## 2. Gap Summary

| Category | MEL SPEC Count | Core Implemented | Missing |
|----------|----------------|------------------|---------|
| String Functions | 6 | 2 | **4** |
| Math Functions | 8 | 0 | **8** |
| Unary Operators | 1 | 0 | **1** |
| Null Functions | 3 | 2 | **1** |
| Context Variables | 6 | 4 | **2** |
| **Total** | 24 | 8 | **16** |

---

## 3. Missing ExprNode Types (IR Mapping)

### 3.1 String Functions

| MEL Function | IR Kind | Priority | Feasibility |
|--------------|---------|----------|-------------|
| `trim(s)` | `{ kind: 'trim', str: ExprNode }` | High | ✅ Simple |
| `lower(s)` | `{ kind: 'toLowerCase', str: ExprNode }` | High | ✅ Simple |
| `upper(s)` | `{ kind: 'toUpperCase', str: ExprNode }` | High | ✅ Simple |
| `strlen(s)` | `{ kind: 'strLen', str: ExprNode }` | Medium | ✅ Simple |

**Implementation Notes:**
- All string functions are pure and total
- `strlen` could be unified with `len` (current impl handles strings)

### 3.2 Math Functions

| MEL Function | IR Kind | Priority | Feasibility |
|--------------|---------|----------|-------------|
| `abs(n)` | `{ kind: 'abs', arg: ExprNode }` | High | ✅ Simple |
| `min(a, b, ...)` | `{ kind: 'min', args: ExprNode[] }` | High | ✅ Simple |
| `max(a, b, ...)` | `{ kind: 'max', args: ExprNode[] }` | High | ✅ Simple |
| `floor(n)` | `{ kind: 'floor', arg: ExprNode }` | Medium | ✅ Simple |
| `ceil(n)` | `{ kind: 'ceil', arg: ExprNode }` | Medium | ✅ Simple |
| `round(n)` | `{ kind: 'round', arg: ExprNode }` | Medium | ✅ Simple |
| `sqrt(n)` | `{ kind: 'sqrt', arg: ExprNode }` | Low | ✅ Simple (returns null if negative) |
| `pow(base, exp)` | `{ kind: 'pow', base: ExprNode, exponent: ExprNode }` | Low | ✅ Simple |

**Implementation Notes:**
- All math functions are pure and total
- `sqrt` returns `null` for negative inputs (totality preserved)
- No determinism concerns

### 3.3 Unary Operators

| MEL Syntax | IR Kind | Priority | Feasibility |
|------------|---------|----------|-------------|
| `-a` | `{ kind: 'neg', arg: ExprNode }` | High | ✅ Simple |

**Implementation Notes:**
- Currently only binary `sub` exists
- Unary negation is essential for natural expression writing

### 3.4 Null Functions

| MEL Function | IR Kind | Priority | Feasibility |
|--------------|---------|----------|-------------|
| `isNotNull(x)` | `{ kind: 'isNotNull', arg: ExprNode }` | Low | ✅ Simple (sugar for `not(isNull(x))`) |

**Implementation Notes:**
- Can be implemented as syntactic sugar in compiler
- OR as dedicated ExprNode for optimization

### 3.5 Context Variables

| Variable | Description | Core Status |
|----------|-------------|-------------|
| `$item` | Current element in iteration | ✅ Implemented |
| `$index` | Current index in iteration | ✅ Implemented |
| `$array` | Source array in iteration | ✅ Implemented |
| `$acc` | Accumulator in reduce | ❌ **Missing** |
| `$system.time.now` | Current timestamp | ⚠️ Host-provided |
| `$system.uuid` | Generated UUID | ⚠️ Host-provided |

**Implementation Notes:**
- `$acc` requires context extension for reduce operations
- `$system.*` values are injected by Host, not Core

---

## 4. Reduce Expression (Special Case)

### 4.1 Current State

MEL SPEC defines `array.reduce` as an **Effect**, not a pure expression:

```mel
effect array.reduce({
  source: <Array>,
  initial: <Expression>,
  accumulate: <Expression using $acc and $item>,
  into: <Path>
})
```

### 4.2 Core Consideration

**Option A: Effect Only (SPEC Compliant)**
- Reduce remains an Effect handled by Host
- Core provides no `ReduceExpr`
- Requires `$acc` in context for effect execution

**Option B: Pure Expression (Extension)**
- Add `ReduceExpr` to Core for pure reduction
- Useful for computed values
- Requires careful consideration of totality

**Recommendation:** Follow SPEC - keep reduce as Effect only. Core already has pure alternatives:
- `filter` + `len` for counting
- `map` + computed for transformations
- Host handles complex reductions

---

## 5. Implementation Impossibilities

### 5.1 None Identified

All missing expressions are pure, total, and deterministic. No implementation blockers exist.

### 5.2 Potential Concerns

| Expression | Concern | Resolution |
|------------|---------|------------|
| `sqrt(n)` | Negative input | Returns `null` (totality preserved) |
| `pow(base, exp)` | Large exponents | JavaScript handles gracefully (Infinity) |
| `div(a, b)` | Division by zero | Already returns `null` ✅ |

---

## 6. Effect vs Expression Clarification

MEL SPEC defines some array operations as **Effects**, but Core implements them as **Expressions**:

| Operation | MEL Category | Core Category | Resolution |
|-----------|--------------|---------------|------------|
| `filter` | Effect | Expression ✅ | Keep both (Effect for Host, Expr for computed) |
| `map` | Effect | Expression ✅ | Keep both |
| `find` | Effect | Expression ✅ | Keep both |
| `every` | Effect | Expression ✅ | Keep both |
| `some` | Effect | Expression ✅ | Keep both |
| `reduce` | Effect | Missing | Add to Host only |
| `sort` | Effect | Missing | Add to Host only |
| `flatMap` | Effect | Missing | Add to Host only |
| `groupBy` | Effect | Missing | Add to Host only |
| `unique` | Effect | Missing | Add to Host only |
| `partition` | Effect | Missing | Add to Host only |

**Rationale:**
- Pure expressions (filter, map, etc.) are useful for computed values
- Complex operations (reduce, groupBy, etc.) belong in Effects
- This maintains Core's purity while enabling Host flexibility

---

## 7. Implementation Priority

### Phase 1: High Priority (Essential for MEL Compilation)

```typescript
// Unary
| NegExpr        // { kind: 'neg', arg: ExprNode }

// String
| TrimExpr       // { kind: 'trim', str: ExprNode }
| ToLowerExpr    // { kind: 'toLowerCase', str: ExprNode }
| ToUpperExpr    // { kind: 'toUpperCase', str: ExprNode }

// Math
| AbsExpr        // { kind: 'abs', arg: ExprNode }
| MinExpr        // { kind: 'min', args: ExprNode[] }
| MaxExpr        // { kind: 'max', args: ExprNode[] }
```

### Phase 2: Medium Priority

```typescript
// String
| StrLenExpr     // { kind: 'strLen', str: ExprNode }

// Math
| FloorExpr      // { kind: 'floor', arg: ExprNode }
| CeilExpr       // { kind: 'ceil', arg: ExprNode }
| RoundExpr      // { kind: 'round', arg: ExprNode }
```

### Phase 3: Low Priority

```typescript
// Math
| SqrtExpr       // { kind: 'sqrt', arg: ExprNode }
| PowExpr        // { kind: 'pow', base: ExprNode, exponent: ExprNode }

// Null (optional - can be sugar)
| IsNotNullExpr  // { kind: 'isNotNull', arg: ExprNode }
```

---

## 8. Required Schema Changes

### 8.1 expr.ts Additions

```typescript
// ============ String (New) ============

export const TrimExpr: z.ZodType<{ kind: "trim"; str: ExprNode }> = z.object({
  kind: z.literal("trim"),
  str: z.lazy(() => ExprNodeSchema),
});

export const ToLowerExpr: z.ZodType<{ kind: "toLowerCase"; str: ExprNode }> = z.object({
  kind: z.literal("toLowerCase"),
  str: z.lazy(() => ExprNodeSchema),
});

export const ToUpperExpr: z.ZodType<{ kind: "toUpperCase"; str: ExprNode }> = z.object({
  kind: z.literal("toUpperCase"),
  str: z.lazy(() => ExprNodeSchema),
});

export const StrLenExpr: z.ZodType<{ kind: "strLen"; str: ExprNode }> = z.object({
  kind: z.literal("strLen"),
  str: z.lazy(() => ExprNodeSchema),
});

// ============ Math (New) ============

export const NegExpr: z.ZodType<{ kind: "neg"; arg: ExprNode }> = z.object({
  kind: z.literal("neg"),
  arg: z.lazy(() => ExprNodeSchema),
});

export const AbsExpr: z.ZodType<{ kind: "abs"; arg: ExprNode }> = z.object({
  kind: z.literal("abs"),
  arg: z.lazy(() => ExprNodeSchema),
});

export const MinExpr: z.ZodType<{ kind: "min"; args: ExprNode[] }> = z.object({
  kind: z.literal("min"),
  args: z.array(z.lazy(() => ExprNodeSchema)),
});

export const MaxExpr: z.ZodType<{ kind: "max"; args: ExprNode[] }> = z.object({
  kind: z.literal("max"),
  args: z.array(z.lazy(() => ExprNodeSchema)),
});

export const FloorExpr: z.ZodType<{ kind: "floor"; arg: ExprNode }> = z.object({
  kind: z.literal("floor"),
  arg: z.lazy(() => ExprNodeSchema),
});

export const CeilExpr: z.ZodType<{ kind: "ceil"; arg: ExprNode }> = z.object({
  kind: z.literal("ceil"),
  arg: z.lazy(() => ExprNodeSchema),
});

export const RoundExpr: z.ZodType<{ kind: "round"; arg: ExprNode }> = z.object({
  kind: z.literal("round"),
  arg: z.lazy(() => ExprNodeSchema),
});

export const SqrtExpr: z.ZodType<{ kind: "sqrt"; arg: ExprNode }> = z.object({
  kind: z.literal("sqrt"),
  arg: z.lazy(() => ExprNodeSchema),
});

export const PowExpr: z.ZodType<{ kind: "pow"; base: ExprNode; exponent: ExprNode }> = z.object({
  kind: z.literal("pow"),
  base: z.lazy(() => ExprNodeSchema),
  exponent: z.lazy(() => ExprNodeSchema),
});
```

### 8.2 context.ts Additions (For Host Effects)

```typescript
export type EvalContext = {
  // ... existing fields ...

  /**
   * Accumulator for reduce operations (Host-side only)
   */
  readonly $acc?: unknown;
};

export function withReduceContext(
  ctx: EvalContext,
  acc: unknown,
  item: unknown,
  index: number,
  array: unknown[]
): EvalContext {
  return {
    ...ctx,
    $acc: acc,
    $item: item,
    $index: index,
    $array: array,
  };
}
```

---

## 9. Test Requirements

Each new ExprNode MUST have tests covering:

1. **Happy path** - Normal operation
2. **Null handling** - Returns null for invalid input
3. **Type coercion** - Consistent with existing patterns
4. **Edge cases** - Empty arrays, zero values, etc.

Example for `neg`:

```typescript
describe("neg expression", () => {
  it("negates positive number", () => {
    expect(evaluate({ kind: "neg", arg: lit(5) })).toBe(-5);
  });

  it("negates negative number", () => {
    expect(evaluate({ kind: "neg", arg: lit(-3) })).toBe(3);
  });

  it("returns 0 for 0", () => {
    expect(evaluate({ kind: "neg", arg: lit(0) })).toBe(0);
  });

  it("coerces string to number", () => {
    expect(evaluate({ kind: "neg", arg: lit("5") })).toBe(-5);
  });
});
```

---

## 10. Conclusion

### 10.1 Summary

- **14 ExprNode types** are missing from Core
- **All are implementable** - no blockers
- **6 Effect operations** are missing from Host
- **$acc context variable** needs to be added for reduce

### 10.2 Recommended Next Steps

1. Implement Phase 1 (7 expressions) for MEL v0.2 compatibility
2. Add `$acc` to context for Host-side reduce Effect
3. Implement Phase 2 and 3 as needed
4. Consider `isNotNull` as compiler sugar rather than Core ExprNode

---

*End of Gap Analysis*
