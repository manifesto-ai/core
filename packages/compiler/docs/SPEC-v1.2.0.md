# MEL Compiler SPEC v1.2.0

> **Version:** 1.2.0
> **Type:** Full
> **Status:** Normative
> **Date:** 2026-04-23
> **Replaces:** v1.1.0 as the current full compiler contract
> **Compatible with:** Core SPEC v4.2.0, current SDK activation-first contract

---

## Changelog

### v1.2.0

- admit object-literal spread as the sole bounded parser-level shorthand in current MEL
- define spread operand admissibility, canonical `merge(...)` lowering, and patch-layer distinction from `patch path merge expr`
- define presence-aware object typing for spread results and direct `merge()` parity
- define optional-field read contract as `T | null` at the expression boundary
- add diagnostic expectations for forbidden adjacent JS-like forms and presence-aware normalization failures

### v1.1.0

- add `SourceMapIndex` as a compiler-owned, tooling-only declaration-level source location sidecar on `DomainModule`
- add `SourceMapEmissionContext` as the explicit emission-context contract for deterministic source-map extraction
- split sidecar cache identity by artifact class while preserving the existing runtime-facing `DomainSchema` contract
- reaffirm that action-level trace replay is the current stable join scope for source-map consumers

---

## 1. Purpose

This document is the **current full MEL compiler contract**.

It consolidates the landed compiler surface into one current contract, including:

- the active full MEL/compiler baseline
- `SchemaGraph` extraction
- structural annotations via `@meta` with a tooling-only sidecar
- compiler-owned declaration-level source locations via `SourceMapIndex`
- `dispatchable when`
- current landed compiler/runtime alignment for `Record<string, T>` and `T | null` in schema positions
- current landed support for pure collection builtins in expression contexts
- current clarification that additive MEL surface forms must preserve existing builtin meanings and lower only through the compiler-owned MEL → Core boundary
- object-literal spread as the sole bounded parser-level shorthand in current MEL
- presence-aware object typing and direct `merge()` typing parity for spread-admitted object composition

Historical compiler docs remain useful for archaeology, but **this file is the current truth**.

---

## 2. Current Output Contract

The current compiler contract defines four distinct artifacts:

- `DomainSchema` as the semantic runtime artifact returned by existing schema-only compile entrypoints
- `SchemaGraph` as the projected static dependency artifact
- `AnnotationIndex` as the tooling-only structural sidecar
- `SourceMapIndex` as the tooling-only declaration-level source location sidecar

Additive compiler/tooling entrypoints MAY expose those artifacts together through a module envelope:

```typescript
type DomainModule = {
  readonly schema: DomainSchema;
  readonly graph: SchemaGraph;
  readonly annotations: AnnotationIndex;
  readonly sourceMap: SourceMapIndex;
};
```

Within `DomainSchema`, the compiler emits three distinct type-carrying seams:

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

- `schema` is the semantic runtime artifact. Core, Host, and SDK runtime entrypoints remain `DomainSchema`-only.
- `graph` is the projected static dependency artifact extracted from `schema` alone.
- `annotations` is a tooling-only structural sidecar and MUST remain out-of-schema.
- `sourceMap` is a tooling-only declaration-level source location sidecar and MUST remain out-of-schema.
- schema-only compiler entrypoints MAY continue to expose `DomainSchema` without wrapping it in `DomainModule`.
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

Ordinary function-call forms remain the baseline contract. The sole admitted parser-level shorthand is object-literal spread inside object literals. No new arm syntax, named arguments, or other parser-only shorthand is implied here.

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

### 5.2 Object-Literal Spread

Object-literal spread is part of the current MEL surface as a bounded source-level sugar:

```mel
computed shippedOrder = { ...order, status: "shipped" }

action submit(customerId: string) {
  onceIntent {
    patch draft = {
      ...draft,
      customerId: customerId,
      appliedCouponId: null,
      submissionState: "submitted"
    }
  }
}
```

Normative rules:

- spread entries are admitted only inside object literals: `{ ...expr, key: value }`
- spread is source-order sensitive; named fields and spread contributors compete by source order alone
- spread operands MUST be object-shaped, or `T | null` where `T` is object-shaped
- `Record<string, T>` spread operands are not part of the current v1.2 contract
- primitive, array, and object-only multi-branch union spread operands are not part of the current v1.2 contract
- object-literal spread MUST lower to canonical `merge(...)` expressions with source order preserved
- consecutive named fields between spread contributors MUST group into one object-literal `merge(...)` argument
- `patch path = { ...expr, key: value }` remains a `set` patch whose value is the lowered `merge(...)`
- `patch path merge expr` remains a distinct patch operation and is not interchangeable with `patch path = <spread>`
- lowering MUST continue to use existing MEL canonical expression shapes and existing Core/runtime expression kinds only

Typing rules:

- spread result typing is presence-aware at the field level
- a required field contributed unconditionally remains required
- a field contributed only through a nullable spread or an optional source field remains optional until later unconditionally contributed
- optional result fields MUST NOT satisfy required assignment targets without a later unconditional contribution
- direct reads from optional result fields are observed as `T | null` at the expression boundary
- values read from optional spread-result fields MUST be explicitly normalized before they satisfy a non-null required sink
- direct `merge()` typing MUST follow the same presence-aware rules as the lowered spread form

Compatibility note:

- current runtime semantics of `merge()` are unchanged
- current compile-time typing MAY tighten existing `merge()` call sites that previously relied on unsound nullable/object-presence behavior
- this tightening is part of the v1.2 current contract, not a runtime change

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
Structural annotations and source-map sidecars MUST NOT alter graph nodes, graph edges, or graph derivation.

---

## 8. Tooling Sidecars

### 8.1 Surface and Target Model

`@meta` is part of the current MEL surface as a structural annotation form.

Source form:

```mel
@meta("namespace:kind")
@meta("namespace:kind", { key: "value", enabled: true })
```

Normative rules:

- `@meta` uses prefix syntax and attaches to the immediately following construct.
- Multiple annotations MAY stack on the same target.
- The compiler MUST treat the tag string as opaque. Namespace or kind semantics are consumer-owned.
- Current v1 attachable targets are:
  - `domain`
  - `type`
  - `type_field`
  - `state_field`
  - `computed`
  - `action`
- For `type_field` and `state_field`, the same prefix form appears immediately above the field declaration inside the enclosing block.
- `action_param` annotations are deferred from the current v1 contract and are NOT part of current MEL syntax.

Examples:

```mel
@meta("doc:summary", { area: "tasks" })
domain TaskBoard {
  @meta("doc:entity")
  type Task = {
    id: string,
    @meta("ui:hidden")
    internalNote: string | null
  }

  state {
    @meta("analytics:track")
    lastArchivedId: string | null = null
  }

  @meta("ui:primary-list")
  computed hasArchivedTask = isNotNull(lastArchivedId)

  @meta("ui:button", { variant: "secondary" })
  action archive(id: string) {
    when true {
      patch lastArchivedId = id
    }
  }
}
```

### 8.2 Sidecar Types and Boundaries

Annotations compile into a tooling-only sidecar. They MUST NOT appear inside `DomainSchema` or `SchemaGraph`.

```typescript
type AnnotationIndex = {
  readonly schemaHash: string;
  readonly entries: Record<LocalTargetKey, readonly Annotation[]>;
};

type LocalTargetKey = string;

type Annotation = {
  readonly tag: string;
  readonly payload?: JsonLiteral;
};

type JsonLiteral =
  | string
  | number
  | boolean
  | null
  | readonly JsonLiteral[]
  | { readonly [key: string]: JsonLiteral };
```

Current v1 `LocalTargetKey` forms are:

```text
domain:<DomainName>
type:<TypeName>
type_field:<TypeName>.<FieldName>
state_field:<FieldName>
computed:<ComputedName>
action:<ActionName>
```

Current v1 emission rules:

- `schemaHash` MUST equal `hash` on the emitted `DomainSchema`.
- `entries` MUST include only targets that carry at least one annotation.
- `entries` MUST NOT contain empty annotation arrays.
- stacked annotations on the same target MUST preserve source order.
- repeated tags on the same target MUST NOT be deduplicated by the compiler.
- sidecar emission order MUST be deterministic for a fixed source input.

Normative rules:

- `schemaHash` scopes the entire annotation sidecar to one emitted semantic schema.
- Every emitted `LocalTargetKey` MUST map to an existing construct in the emitted `DomainSchema`.
- Child targets use exactly one dotted segment (`Parent.Child`) in the current contract.
- The sidecar MAY be exposed only by additive compiler/tooling entrypoints. It MUST NOT become a runtime input artifact.

### 8.3 Payload Model

Payloads are JSON-like literals only.

Permitted payload values:

- strings
- numbers
- booleans
- `null`
- arrays of JSON-like literals
- objects whose values are JSON-like literals

Current v1 payload restrictions:

- payload is optional
- maximum nesting depth is 2
- MEL expressions are forbidden
- semantic references are forbidden
- guard references or runtime predicates are forbidden

Examples:

```mel
// valid
@meta("ui:button", { variant: "primary", size: "lg" })
@meta("doc:priority", 3)

// invalid: MEL expression in payload
@meta("ui:button", { disabled: eq(len(items), 0) })

// invalid: depth > 2
@meta("ui:card", { config: { pricing: { free: "$0" } } })
```

### 8.4 Annotation Rules and Invariants

| Rule ID | Level | Description |
|---------|-------|-------------|
| META-1 | MUST | The compiler MUST remain namespace-blind for annotation tags and payload meaning |
| META-2 | MUST | Annotations MUST exist only in `AnnotationIndex`, never in `DomainSchema` or `SchemaGraph` |
| META-3 | MUST | Annotation presence or absence MUST NOT affect schema hash, `compute()`, availability, dispatchability, or other runtime semantics |
| META-4 | MUST | Runtime entrypoints MUST continue to accept `DomainSchema` only, not `DomainModule` |
| META-5 | MUST | The compiler MUST validate emitted annotation targets against the emitted `DomainSchema` structure |
| META-6 | MUST | Payloads MUST be JSON-like literals only, with current v1 nesting depth capped at 2 |
| META-7 | MUST | Semantic validation of namespace-specific annotation meaning MUST remain consumer-owned |
| META-8 | MUST | Stacked annotations on the same target MUST preserve source order and repeated tags MUST NOT be deduplicated |
| META-9 | MUST | `AnnotationIndex.schemaHash` MUST equal `hash` on the emitted `DomainSchema` |
| META-10 | MUST | `AnnotationIndex.entries` MUST omit unannotated targets and empty arrays, and emission order MUST be deterministic |

Current invariants:

| Invariant | Meaning |
|-----------|---------|
| INV-META-1 | Removing all `@meta` from MEL source MUST leave emitted `DomainSchema` byte-identical |
| INV-META-2 | Removing all `@meta` from MEL source MUST leave emitted `SchemaGraph` identical |
| INV-META-3 | For any snapshot and intent, `compute()` results MUST remain identical regardless of annotation presence |
| INV-META-4 | For any snapshot, `getAvailableActions()` MUST remain identical regardless of annotation presence |
| INV-META-5 | For any snapshot and intent, `isIntentDispatchable()` MUST remain identical regardless of annotation presence |
| INV-META-6 | Tooling-only `DomainModule` artifacts MUST remain outside runtime schema-input seams |

### 8.5 Compiler-Owned Source Location Sidecar

`SourceMapIndex` is a compiler-owned sibling sidecar to `AnnotationIndex`. It records declaration-level MEL source spans for tooling and inspection consumers.

It MUST remain outside `DomainSchema`, `SchemaGraph`, and runtime entrypoint contracts.

```typescript
type SourceMapIndex = {
  readonly schemaHash: string;
  readonly sourceHash: string;
  readonly format: "manifesto/source-map-v1";
  readonly coordinateUnit: "utf16" | "bytes";
  readonly emissionFingerprint: string;
  readonly entries: Record<LocalTargetKey, SourceMapEntry>;
};

type SourceMapEntry = {
  readonly target: SourceMapPath;
  readonly span: SourceSpan;
};

type SourceMapPath =
  | { readonly kind: "domain"; readonly domain: { readonly name: string } }
  | { readonly kind: "type"; readonly type: { readonly name: string } }
  | {
      readonly kind: "type_field";
      readonly type: { readonly name: string };
      readonly field: { readonly name: string };
    }
  | { readonly kind: "state_field"; readonly field: { readonly name: string } }
  | { readonly kind: "computed"; readonly computed: { readonly name: string } }
  | { readonly kind: "action"; readonly action: { readonly name: string } };

type SourceSpan = {
  readonly start: SourcePoint;
  readonly end: SourcePoint;
};

type SourcePoint = {
  readonly line: number;
  readonly column: number;
  readonly offset?: number;
};

type SourceMapEmissionContext = {
  readonly coordinateUnit: "utf16" | "bytes";
  readonly compilerVersion: string;
  readonly emissionOptionsFingerprint: string;
};
```

Current v1 `SourceMapPath.kind` forms are byte-identical to the landed `LocalTargetKey` kind set:

```text
domain
type
type_field
state_field
computed
action
```

Current v1 source-map scope:

- declaration-level mappings only
- no body-statement resolution
- no `action_param` mappings in the current landed subset

Current v1 cache scope by artifact:

| Artifact | Cache identity |
|---------|----------------|
| `DomainSchema` / `SchemaGraph` | `schemaHash` |
| `AnnotationIndex` | `(schemaHash, sourceHash)` under a fixed compiler version |
| `SourceMapIndex` / `DomainModule` | `(schemaHash, sourceHash, emissionFingerprint)` |

Normative rules:

| Rule ID | Level | Description |
|---------|-------|-------------|
| SMAP-1 | MUST | `SourceMapIndex` MUST exist only as a tooling-only out-of-schema sidecar |
| SMAP-2 | MUST | `DomainModule.sourceMap` MUST be the only current compiler-owned source-location surface |
| SMAP-3 | MUST | `SourceMapIndex.schemaHash` MUST equal `hash` on the emitted `DomainSchema` |
| SMAP-4 | MUST | `SourceMapIndex.entries` MUST use the same current landed target-key universe as `AnnotationIndex` |
| SMAP-5 | MUST | `SourceMapEntry.target` MUST structurally agree with its `LocalTargetKey` entry key |
| SMAP-6 | MUST | `format` and `coordinateUnit` MUST remain separate fields; `format` is protocol version, `coordinateUnit` is payload encoding |
| SMAP-7 | MUST | `emissionFingerprint` MUST be deterministic for a fixed semantic source and `SourceMapEmissionContext` |
| SMAP-8 | MUST | source-map extraction MUST be modeled as a deterministic compiler operation over emitted source/module inputs plus explicit `SourceMapEmissionContext` |
| SMAP-9 | MUST | `SourceMapIndex` and `DomainModule` caching MUST use `(schemaHash, sourceHash, emissionFingerprint)` rather than `schemaHash` alone |
| SMAP-10 | MUST | current stable trace replay scope for source-map consumers is action-level only through `TraceGraph.intent.type -> action:<ActionName>` |
| SMAP-11 | MUST NOT | consumers MUST NOT treat `TraceNode.sourcePath` as a stabilized compiler-side source-map contract in the current version |

Current invariants:

| Invariant | Meaning |
|-----------|---------|
| INV-SMAP-1 | Adding or removing `SourceMapIndex` emission MUST leave emitted `DomainSchema` byte-identical |
| INV-SMAP-2 | Adding or removing `SourceMapIndex` emission MUST leave emitted `SchemaGraph` identical |
| INV-SMAP-3 | For any snapshot and intent, runtime legality and compute results MUST remain identical regardless of source-map emission |
| INV-SMAP-4 | Tooling-only `DomainModule` artifacts that carry `sourceMap` MUST remain outside runtime schema-input seams |

---

## 9. Diagnostics

The following diagnostics remain active in this area:

- `E043` for unsupported non-trivial schema-position unions
- `E044` for recursive schema-position refs that cannot be soundly lowered
- `E047` / `E048` for `dispatchable when` scope violations
- `E053` for misplaced or floating `@meta`, including unsupported attachment sites
- `E054` for unsupported `action_param` annotation syntax in the current contract
- `E055` for annotation payload values that are not JSON-like literals, including MEL expressions and semantic references
- `E056` for annotation payload nesting depth overflow
- `E057` for emitted annotation targets that do not map to the emitted `DomainSchema`
- `E058` for emitted source-map targets that do not map to the emitted `DomainSchema`
- spread-form diagnostics for forbidden adjacent JS-like syntax such as array spread, rest destructuring, computed keys, and optional chaining
- spread operand diagnostics for primitives, arrays, records, and unsupported object-only unions
- presence-aware assignability diagnostics when optional spread contributors do not satisfy required target fields
- optional-field consumption diagnostics when a spread-derived `T | null` value must be explicitly normalized before reaching a non-null sink

The following historical diagnostics are superseded in the current contract:

- `E045` nullable schema-position rejection
- `E046` record schema-position rejection

They remain historical references only and are no longer part of the current compiler surface.

---

## 10. Summary

The current compiler contract is:

- rich MEL types stay precise through `TypeDefinition`
- compatibility `FieldSpec` remains available for coarse tooling and legacy consumers
- nullable and record schema-position types are supported
- pure collection builtins are supported in expressions
- additive MEL surface expansions MUST preserve existing builtin meanings and lower only through the compiler-owned MEL → Core boundary
- object-literal spread is the sole bounded parser-level shorthand in the current MEL surface
- spread and direct `merge()` share one presence-aware object typing model
- optional fields produced by spread are observed as `T | null` at read boundaries and require explicit normalization for non-null sinks
- structural annotations via `@meta` compile into a tooling-only `AnnotationIndex` sidecar
- declaration-level source locations compile into a tooling-only `SourceMapIndex` sidecar on `DomainModule`
- `action_param` annotations remain outside the current v1 surface
- `dispatchable when` is part of the full action contract
- `SchemaGraph` remains availability-only and input-independent

This is the current full compiler surface to use for implementation, tooling, and documentation.
