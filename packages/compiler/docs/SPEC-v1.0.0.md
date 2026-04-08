# MEL Compiler SPEC v1.0.0

> **Version:** 1.0.0
> **Type:** Full
> **Status:** Normative
> **Date:** 2026-04-08
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
- `dispatchable when` is part of the full action contract
- `SchemaGraph` remains availability-only and input-independent

This is the current full compiler surface to use for implementation, tooling, and documentation.
