# Core SPEC v2.0.3 (Patch)

> **Version:** 2.0.3
> **Type:** Patch
> **Status:** Draft
> **Date:** 2026-02-24
> **Base:** v2.0.2 (REQUIRED - read SPEC-v2.0.2-patch.md first)
> **Scope:** Expression primitive extensions — string, collection, object, and type coercion
> **Related:** Issue #188 (missing evaluator primitives)

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| 6 new String expression kinds | Additive | Non-breaking |
| 3 new Collection expression kinds | Additive | Non-breaking |
| 4 new Object expression kinds | Additive | Non-breaking |
| 2 new Type Coercion expression kinds | Additive | Non-breaking |
| Updated ExprKind enum | Additive | Non-breaking |
| §7.5 additional totality requirements | Normative Clarification | Non-breaking |

---

## 1. §7.2 Node Types — Additions (Insert into existing categories)

### 1.1 String Extensions (Insert after `strLen`)

```typescript
  // String (extended — v2.0.3)
  | { kind: 'startsWith'; str: ExprNode; prefix: ExprNode }
  | { kind: 'endsWith'; str: ExprNode; suffix: ExprNode }
  | { kind: 'strIncludes'; str: ExprNode; search: ExprNode }
  | { kind: 'indexOf'; str: ExprNode; search: ExprNode }
  | { kind: 'replace'; str: ExprNode; search: ExprNode; replacement: ExprNode }
  | { kind: 'split'; str: ExprNode; delimiter: ExprNode }
```

### 1.2 Collection Extensions (Insert after `append`)

```typescript
  // Collection (extended — v2.0.3)
  | { kind: 'reverse'; array: ExprNode }
  | { kind: 'unique'; array: ExprNode }
  | { kind: 'flat'; array: ExprNode }
```

### 1.3 Object Extensions (Insert after `merge`)

```typescript
  // Object (extended — v2.0.3)
  | { kind: 'hasKey'; obj: ExprNode; key: ExprNode }
  | { kind: 'pick'; obj: ExprNode; keys: ExprNode }
  | { kind: 'omit'; obj: ExprNode; keys: ExprNode }
  | { kind: 'fromEntries'; entries: ExprNode }
```

### 1.4 Type Coercion (Insert after `toString`)

```typescript
  // Conversion (extended — v2.0.3)
  | { kind: 'toNumber'; arg: ExprNode }
  | { kind: 'toBoolean'; arg: ExprNode }
```

---

## 2. Semantics

### 2.1 String Operations

| Kind | Semantics | Return Type | Totality |
|------|-----------|-------------|----------|
| `startsWith` | `toString(str).startsWith(toString(prefix))` | `boolean` | Always returns `boolean` |
| `endsWith` | `toString(str).endsWith(toString(suffix))` | `boolean` | Always returns `boolean` |
| `strIncludes` | `toString(str).includes(toString(search))` | `boolean` | Always returns `boolean` |
| `indexOf` | `toString(str).indexOf(toString(search))` | `number` | Returns `-1` if not found |
| `replace` | Replace **first** occurrence of `search` in `str` | `string` | Returns original string if no match |
| `split` | `toString(str).split(toString(delimiter))` | `string[]` | Always returns array (at least 1 element) |

**Coercion:** All string operations coerce non-string inputs using the same `toString()` rules as `concat` and `trim`:
- `null` / `undefined` → `""`
- `number` → `String(n)`
- `boolean` → `"true"` / `"false"`
- `object` / `array` → `""` (not JSON serialized)

**`replace` determinism:** Only replaces the **first** occurrence. This is the simplest deterministic behavior. For replacing all occurrences, compose with `split` + `concat`:
```
concat(split(str, search), replacement)   // replaceAll via composition
```

### 2.2 Collection Operations

| Kind | Semantics | Return Type | Totality |
|------|-----------|-------------|----------|
| `reverse` | Reverse element order. Non-array → `[]` | `array` | Always returns array |
| `unique` | Remove duplicates (first occurrence kept, `===` equality). Non-array → `[]` | `array` | Always returns array |
| `flat` | Flatten **one level** only. `[[1,2],[3]]` → `[1,2,3]`. Non-array → `[]` | `array` | Always returns array |

**`flat` depth:** Single-level only. Deep/recursive flattening is excluded to maintain bounded complexity. For deeper flattening, compose: `flat(flat(arr))`.

**`unique` equality:** Uses strict equality (`===`). For object deduplication, use `map` + domain-specific key extraction.

**`unique` order:** Preserves first occurrence order. `unique([3,1,2,1,3])` → `[3,1,2]`.

### 2.3 Object Operations

| Kind | Semantics | Return Type | Totality |
|------|-----------|-------------|----------|
| `hasKey` | Check if `key` exists in `obj`. Non-object → `false` | `boolean` | Always returns `boolean` |
| `pick` | Select only listed `keys` from `obj`. Non-object → `{}` | `object` | Always returns object |
| `omit` | Exclude listed `keys` from `obj`. Non-object → `{}` | `object` | Always returns object |
| `fromEntries` | Convert `[[key, value], ...]` array to object. Non-array → `{}` | `object` | Always returns object |

**`pick`/`omit` keys parameter:** `keys` MUST evaluate to an array of strings. Non-array → treated as empty array. Non-string elements are skipped.

**`hasKey` key parameter:** `key` MUST evaluate to a string. Checks `Object.prototype.hasOwnProperty`.

**`fromEntries` input:** Each entry MUST be a 2-element array `[string, value]`. Invalid entries are skipped.

### 2.4 Type Coercion Operations

| Kind | Semantics | Return Type | Totality |
|------|-----------|-------------|----------|
| `toNumber` | Explicit numeric coercion | `number` | Always returns `number` (non-numeric → `0`) |
| `toBoolean` | Explicit boolean coercion | `boolean` | Always returns `boolean` |

**`toNumber` coercion rules:**
- `number` → identity
- `string` → `parseFloat(s)`, or `0` if `NaN`
- `boolean` → `true` = `1`, `false` = `0`
- `null` / `undefined` → `0`
- `object` / `array` → `0`

**`toBoolean` coercion rules:**
- `boolean` → identity
- `null` / `undefined` → `false`
- `number` → `0` = `false`, all others = `true`
- `string` → `""` = `false`, all others = `true`
- `object` / `array` → `true` (always truthy)

---

## 3. §7.5 Requirements — Additions (Append to existing list)

- `replace` MUST replace only the **first** occurrence (deterministic).
- `flat` MUST flatten exactly **one level** (bounded complexity).
- `unique` MUST preserve first-occurrence order (deterministic).
- `unique` MUST use strict equality (`===`) for comparison.
- `indexOf` MUST return `-1` when the search string is not found.
- `split` MUST always return at least one element.
- `pick`, `omit` MUST ignore non-string keys in the keys array.
- `fromEntries` MUST skip entries that are not 2-element arrays.
- `toNumber` MUST return `0` for non-numeric inputs (never `NaN`).
- `toBoolean` MUST follow JavaScript truthiness semantics.

---

## 4. Philosophy Justification

All 15 new kinds pass the constitutional compliance checks:

| Check | Result |
|-------|--------|
| **Pure** (no side effects) | All are stateless transformations |
| **Total** (always return a value) | All have defined fallback values for invalid inputs |
| **Deterministic** (same input → same output) | No randomness, no time-dependence |
| **No hidden state** | No accumulator, no carry variable between iterations |
| **Bounded** (terminates in finite steps) | All are O(n) or O(n^2) on input size |
| **Schema-first** (JSON-serializable) | All are ExprNode union members |

**Permanently forbidden operations** (for reference):
- `reduce`, `fold`, `foldl`, `foldr`, `scan` — hidden state progression (FDR-MEL-062)
- `groupBy` — specialization of reduce (A32 Constraint 1)

---

## 5. Updated ExprKind Enum

```typescript
export const ExprKind = z.enum([
  "lit", "get",
  "eq", "neq", "gt", "gte", "lt", "lte",
  "and", "or", "not",
  "if",
  "add", "sub", "mul", "div", "mod", "min", "max", "abs", "neg",
  "floor", "ceil", "round", "sqrt", "pow",           // v2.0.0
  "sumArray", "minArray", "maxArray",                  // v2.0.0
  "concat", "substring", "trim",
  "toLowerCase", "toUpperCase", "strLen",              // v2.0.0
  "startsWith", "endsWith", "strIncludes",             // v2.0.3
  "indexOf", "replace", "split",                       // v2.0.3
  "len", "at", "first", "last", "slice", "includes",
  "filter", "map", "find", "every", "some", "append",
  "reverse", "unique", "flat",                         // v2.0.3
  "object", "field", "keys", "values", "entries", "merge",
  "hasKey", "pick", "omit", "fromEntries",             // v2.0.3
  "typeof", "isNull", "coalesce",
  "toString",                                          // v2.0.0
  "toNumber", "toBoolean",                             // v2.0.3
]);
```

---

## 6. Cross-Reference

| Document | Section | Relationship |
|----------|---------|-------------|
| Core SPEC v2.0.0 | §7 ExprSpec | Base expression type definitions |
| Core FDR v2.0.0 | FDR-006 | Flow is not Turing-complete |
| Compiler FDR v0.3.3 | FDR-MEL-062 | Primitive aggregation constraints |
| Issue #188 | — | Triggered this review |

---

*End of Core SPEC v2.0.3 Patch Document*
