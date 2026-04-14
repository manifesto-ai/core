# MEL Compiler SPEC v1.0.0

> **Version:** 1.0.0
> **Type:** Full
> **Status:** Normative
> **Date:** 2026-04-14
> **Supersedes:** [SPEC-v0.7.0.md](SPEC-v0.7.0.md), [SPEC-v0.8.0.md](SPEC-v0.8.0.md), [SPEC-v0.9.0.md](SPEC-v0.9.0.md) as the current compiler contract
> **Compatible with:** Core SPEC v4.2.0, SDK living spec v3.5.0

---

## 1. Purpose

This document is the **current full MEL compiler contract**.

It rolls up the last active baseline plus addenda into one current surface:

- v0.7.0 full baseline
- v0.8.0 `SchemaGraph` addendum
- v0.9.0 `dispatchable when` addendum
- current landed compiler/runtime alignment for `Record<string, T>` and `T | null` in schema positions
- current landed support for pure collection builtins in expression contexts
- current clarification that additive MEL surface forms must preserve existing builtin meanings and lower only through the compiler-owned MEL → Core boundary

Historical compiler docs remain useful for archaeology, but **this file is the current truth**.

---

## 2. Current Output Contract

The compiler emits three distinct type-carrying seams in `DomainSchema`:

```typescript
type DomainSchema = {
  readonly types: Record<string, TypeSpec>;
  readonly state: StateSpec;
  readonly actions: Record<string, ActionSpec>;
  // ...
};

type StateSpec = {
  readonly fields: Record<string, FieldSpec>;
  readonly fieldTypes?: Record<string, TypeDefinition>;
};

type ActionSpec = {
  readonly flow: FlowNode;
  readonly input?: FieldSpec;
  readonly inputType?: TypeDefinition;
  readonly params?: readonly string[];
  readonly available?: ExprNode;
  readonly dispatchable?: ExprNode;
  readonly description?: string;
};
```

Normative meaning:

- `types` preserves named MEL type declarations losslessly.
- `state.fields` and `action.input` are the **compatibility / coarse introspection seam**.
- `state.fieldTypes` and `action.inputType` are the **normative runtime typing seam** when present.
- `action.params` is the normative parameter-order seam.

The compiler MUST preserve precise type information in `fieldTypes` / `inputType` whenever the source schema uses shapes that are wider than `FieldSpec`.

---

## 3. Type Lowering

### 3.1 Lossless Type Preservation

The compiler MUST preserve full MEL type information in `DomainSchema.types` using `TypeDefinition`.

```typescript
type TypeDefinition =
  | { kind: "primitive"; type: string }
  | { kind: "array"; element: TypeDefinition }
  | { kind: "record"; key: TypeDefinition; value: TypeDefinition }
  | { kind: "object"; fields: Record<string, { type: TypeDefinition; optional: boolean }> }
  | { kind: "union"; types: TypeDefinition[] }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "ref"; name: string };
```

### 3.2 Compatibility FieldSpec Lowering

`FieldSpec` is still emitted, but it is no longer the sole normative runtime boundary.

The compiler MUST lower schema-position types according to the following table:

| Rule ID | Level | Description |
|---------|-------|-------------|
| TYPE-LOWER-1 | MUST | Action parameters MUST lower to `ActionSpec.input` as a compatibility `FieldSpec` object with named fields |
| TYPE-LOWER-2 | MUST | Named object types MUST inline into compatibility `FieldSpec.fields` when representable |
| TYPE-LOWER-3 | MUST | `Array<T>` MUST lower to `FieldSpec { type: "array", items: ... }` when `T` is compatibility-representable |
| TYPE-LOWER-4 | MUST | Literal-only unions MUST lower to enum `FieldSpec` where sound |
| TYPE-LOWER-5 | MUST | Inline object types in schema positions MUST remain visible to users through diagnostics/introspection |
| TYPE-LOWER-6 | MUST | `T \| null` in state/action-input positions MUST compile and preserve precise nullability through `fieldTypes` / `inputType` |
| TYPE-LOWER-7 | MUST | `Record<string, T>` in state/action-input positions MUST compile and preserve precise value typing through `fieldTypes` / `inputType` |
| TYPE-LOWER-8 | MUST | Non-trivial unions that are not nullable or literal-enum compatible MUST remain compile errors (`E043`) |
| TYPE-LOWER-9 | MUST | Recursive schema-position refs that cannot be soundly lowered for runtime validation MUST remain compile errors (`E044`) |

### 3.3 Nullable Types

`T | null` is supported in state fields and action input positions.

Normative rules:

- nullable lowering MUST preserve the exact branch structure in `fieldTypes` / `inputType`
- compatibility `FieldSpec` MAY degrade to the non-null branch for coarse shape/tooling
- runtime validation MUST distinguish:
  - missing field
  - explicit `null`
  - non-null value of type `T`

`nullable` means **present-or-null**, not “optional by another name.”

### 3.4 Record Types

`Record<string, T>` is supported in state fields and action input positions.

Normative rules:

- record keys remain string-keyed only
- `fieldTypes` / `inputType` MUST preserve the declared record value type
- compatibility `FieldSpec` MAY degrade records to coarse `{ type: "object" }`
- runtime validation MUST validate each record entry value against `T`

### 3.5 Action Input Lowering

For actions with declared parameters, the compiler MUST emit:

- `action.params` in declared source order
- `action.inputType` as an object-shaped `TypeDefinition`
- `action.input` as the compatibility/coarse `FieldSpec` seam

This split is normative. Consumers that need exact typing MUST prefer `params` plus `inputType`.

---

## 4. State Initializers and Literal Checking

The compiler MUST evaluate state initializer expressions to concrete JSON values where the source expression is statically literal.

When a concrete literal value is available:

- compatibility checks MAY use `FieldSpec`
- precise checks MUST use `TypeDefinition` when available

Static literal mismatch diagnostics MUST continue to point at nested locations such as:

- `current.id`
- `current.done`
- `nums[1]`

---

## 5. Pure Collection Builtins

The current compiler surface supports the following collection builtins in expression contexts:

- `filter(arr, pred)`
- `map(arr, expr)`
- `find(arr, pred)`
- `every(arr, pred)`
- `some(arr, pred)`

Normative rules:

- these functions are expression-level builtins, not effects
- `$item` is valid only inside the predicate/mapper expression they introduce
- hidden accumulation remains forbidden
- aggregation composition rules remain unchanged: `sum()`, `min()`, and `max()` require a direct state/computed reference, not an inline transformed expression

Examples:

```mel
computed active = filter(items, eq($item.active, true))
computed firstOpen = find(items, eq($item.status, "open"))
computed allDone = every(tasks, eq($item.done, true))

// still forbidden
computed bad = sum(filter(prices, gt($item, 0)))
```

### 5.1 Additional Explicit MEL Surface Forms

The builtin and collection surface defined in this spec is the **current** MEL source contract.

Any additive MEL surface form beyond the builtin set explicitly defined here MUST satisfy all of the following:

- it MUST be admitted explicitly at the MEL source level rather than appearing as an undocumented parser or lowering convenience
- it MUST preserve the current meanings of existing builtin names such as `floor`, `ceil`, `min`, `max`, `filter`, `map`, `find`, `every`, and `some`
- it MUST remain representable as an explicit MEL canonical expression or flow form through validation and type checking
- lowering to Core Runtime IR MUST occur only at the existing MEL → Core lowering boundary
- the lowered result MUST use existing Core/runtime expression and flow kinds only
- user-defined accumulation, runtime-shaped iteration, dynamic dispatch, and other general-computation constructs remain forbidden

Entity primitives are the current precedent for this pattern: they remain explicit MEL surface forms until the lowering boundary and then lower into existing Core/runtime kinds without changing the underlying runtime model.

Only ordinary function-call forms are part of this contract. No new arm syntax, named arguments, or parser-only shorthand is implied here.

The following bounded function forms are admitted under that rule:

#### `absDiff(a, b)`

- signature: `(number, number) -> number`
- lowering: `abs(sub(a, b))`
- both arguments MUST be numbers

#### `clamp(x, lo, hi)`

- signature: `(number, number, number) -> number`
- lowering: `min(max(x, lo), hi)`
- all arguments MUST be numbers
- bounds MUST NOT be reordered implicitly
- when both bounds are statically literal numbers and `lo > hi`, the compiler MUST reject the call
- this does NOT change the existing meanings of unary `floor()` or `ceil()`

#### `idiv(a, b)`

- signature: `(number, number) -> number | null`
- lowering: `floor(div(a, b))`
- both arguments MUST be numbers
- negative results MUST follow mathematical floor semantics, not truncation toward zero
- zero-divisor behavior MUST inherit existing `div()` semantics, including `null` on zero

#### `streak(prev, cond)`

- signature: `(number, boolean) -> number`
- lowering: `cond(cond, add(prev, 1), 0)`
- `prev` MUST be a number
- `cond` MUST be a boolean

#### `match(key, [k1, v1], [k2, v2], ..., defaultValue)`

- source form example: `match(status, ["open", 1], ["closed", 0], -1)`
- the call MUST contain at least one arm and one default value
- each arm MUST be an inline 2-item array literal `[matchKey, value]`
- each `matchKey` MUST be a literal `string`, `number`, or `boolean`
- the final positional argument MUST be the default value
- `key` and every `matchKey` MUST have the same comparable primitive type: `string`, `number`, or `boolean`
- duplicate literal arm keys MUST be rejected
- all arm values and the default value MUST unify to one result type
- lowering: nested `cond(eq(key, kN), vN, ...)` in source order

#### `argmax([label, eligible, score], ..., tieBreak)`

- source form example: `argmax(["a", aOk, aScore], ["b", bOk, bScore], "first")`
- the call MUST contain at least one candidate and one tie-break literal
- each candidate MUST be an inline 3-item array literal `[label, eligible, score]`
- `eligible` MUST be boolean
- `score` MUST be number
- all labels MUST unify to one primitive scalar type: `string`, `number`, or `boolean`
- the final positional argument MUST be the literal `"first"` or `"last"`
- runtime-array forms such as `argmax(items, "first")` are NOT part of this contract
- if no candidate is eligible, the result MUST be `null`
- `"first"` MUST select the earliest source-order candidate among equal eligible maxima
- `"last"` MUST select the latest source-order candidate among equal eligible maxima
- lowering MUST use only existing conditional and comparison structure; tie-break determinism MUST be expressed through `gt`/`gte` selection order

#### `argmin([label, eligible, score], ..., tieBreak)`

- source form example: `argmin(["a", aOk, aScore], ["b", bOk, bScore], "last")`
- candidate shape, label rules, and tie-break rules are identical to `argmax`
- runtime-array forms are NOT part of this contract
- if no candidate is eligible, the result MUST be `null`
- `"first"` MUST select the earliest source-order candidate among equal eligible minima
- `"last"` MUST select the latest source-order candidate among equal eligible minima
- lowering MUST use only existing conditional and comparison structure; tie-break determinism MUST be expressed through `lt`/`lte` selection order

Non-goals of this admission rule:

- no `match(expr, "k" => v)` arrow-arm syntax
- no `tieBreak: "first"` named-argument syntax
- no runtime-array `argmax(items, scoreFn)` or `argmin(items, scoreFn)`
- no reinterpretation of existing builtin meanings such as `floor`, `ceil`, `min`, `max`, `filter`, `map`, `find`, `every`, or `some`

---

## 6. Intent Dispatchability

`available when` remains the coarse action-family gate.

`dispatchable when` is part of the current full compiler contract:

- it MAY reference state, computed values, and bare action parameter names
- it MUST NOT allow direct `$input.*` syntax in source
- it MUST NOT allow `$meta.*`, `$system.*`, or effects
- it MUST lower to `ActionSpec.dispatchable`

If both clauses are present, ordering is fixed:

```ebnf
ActionDecl ::= 'action' Identifier '(' Params? ')' AvailableClause? DispatchableClause? '{' ActionBody '}'
```

---

## 7. SchemaGraph

`SchemaGraph` is part of the current compiler contract.

The compiler MUST continue to extract the projected static graph with:

- nodes: `state`, `computed`, `action`
- edges: `feeds`, `mutates`, `unlocks`

`dispatchable when` is input-bound and MUST NOT be projected into `SchemaGraph`.
`unlocks` remains derived from `available when` only.

---

## 8. Diagnostics

The following diagnostics remain active in this area:

- `E043` for unsupported non-trivial schema-position unions
- `E044` for recursive schema-position refs that cannot be soundly lowered
- `E047` / `E048` for `dispatchable when` scope violations

The following historical diagnostics are superseded in the current contract:

- `E045` nullable schema-position rejection
- `E046` record schema-position rejection

They remain historical references only and are no longer part of the current compiler surface.

---

## 9. Summary

The current compiler contract is:

- rich MEL types stay precise through `TypeDefinition`
- compatibility `FieldSpec` remains available for coarse tooling and legacy consumers
- nullable and record schema-position types are supported
- pure collection builtins are supported in expressions
- additive MEL surface expansions MUST preserve existing builtin meanings and lower only through the compiler-owned MEL → Core boundary
- `dispatchable when` is part of the full action contract
- `SchemaGraph` remains availability-only and input-independent

This is the current full compiler surface to use for implementation, tooling, and documentation.
