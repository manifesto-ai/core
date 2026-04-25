# MEL Compiler SPEC v1.3.0

> **Version:** 1.3.0
> **Type:** Full
> **Status:** Normative
> **Date:** 2026-04-25
> **Replaces:** v1.2.0 as the current full compiler contract
> **Compatible with:** Core SPEC v4.2.0, current SDK activation-first contract

---

## Changelog

### v1.3.0

- introduce `compileFragmentInContext()` as a compiler-owned authoring-time source-fragment editing primitive
- define the `MelEditOp` union, `MelEditResult`, `MelTextEdit`, and `SchemaDiff` contracts
- define single-op source editing, grammar-specific fragment parsing, full-domain output, and full-domain recompile invariants
- define source-hash validation for optional reusable `baseModule` context
- define changed-target and schema-diff reporting for external Author layer acceptance policy
- reaffirm that compiler-owned source editing does not change `DomainSchema`, `DomainModule`, runtime entrypoints, schema hash semantics, `SchemaGraph`, `AnnotationIndex`, or `SourceMapIndex`

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
- compiler-owned source-fragment editing for authoring-time tooling

Historical compiler docs remain useful for archaeology, but **this file is the current truth**.

---

## 2. Current Output Contract

The current compiler contract defines four distinct artifacts:

- `DomainSchema` as the semantic runtime artifact returned by existing schema-only compile entrypoints
- `SchemaGraph` as the projected static dependency artifact
- `AnnotationIndex` as the tooling-only structural sidecar
- `SourceMapIndex` as the tooling-only declaration-level source location sidecar
- `MelEditResult` as the authoring-time source-edit result returned by source-fragment edit entrypoints

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
- source-edit results are tooling-only authoring artifacts and MUST NOT be accepted by Core, Host, SDK runtime, Lineage, or Governance entrypoints.
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
- `Record<string, T>` spread operands are not part of the current spread contract
- primitive, array, and object-only multi-branch union spread operands are not part of the current spread contract
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

## 9. Authoring-Time Source Fragment Editing

The compiler owns one deterministic source-fragment editing primitive for authoring-time tooling:

```typescript
function compileFragmentInContext(
  baseSource: string,
  op: MelEditOp,
  options?: CompileFragmentInContextOptions,
): MelEditResult;
```

This primitive is a compiler/tooling API. It does not change runtime semantics. Core, Host, SDK runtime, Lineage, and Governance continue to consume runtime `DomainSchema` artifacts, not edit results, `DomainModule`, `AnnotationIndex`, or `SourceMapIndex`.

### 9.1 Author Layer Boundary

The compiler is responsible for validating and materializing exactly one requested source edit.

The external Author layer owns user request interpretation, op selection, multi-op sequencing, retry/repair loops, edit-attempt storage, lineage/proposal handling, acceptance policy, and agent decomposition.

The compiler MUST NOT provide author sessions, edit sequence stores, multi-op composers, retry loops, repair loops, LLM planners, runtime snapshot mutation, governance policy decisions, lineage commits, or acceptance decisions.

### 9.2 API Types

```typescript
type CompileFragmentInContextOptions = {
  readonly baseModule?: DomainModule;
  readonly includeModule?: boolean;
  readonly includeSchemaDiff?: boolean;
};

type MelEditResult = {
  readonly ok: boolean;
  readonly newSource: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly module?: DomainModule;
  readonly changedTargets: readonly LocalTargetKey[];
  readonly edits: readonly MelTextEdit[];
  readonly schemaDiff?: SchemaDiff;
};

type MelTextEdit = {
  readonly range: SourceSpan;
  readonly replacement: string;
};

type SchemaDiff = {
  readonly addedTargets: readonly LocalTargetKey[];
  readonly removedTargets: readonly LocalTargetKey[];
  readonly modifiedTargets: readonly SchemaModifiedTarget[];
};

type SchemaModifiedTarget = {
  readonly target: LocalTargetKey;
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly before?: unknown;
  readonly after?: unknown;
};
```

`before` and `after` are optional normalized summaries. Stable comparison is hash-based through `beforeHash` and `afterHash`.

`MelEditResult` MUST NOT include nondeterministic trace timing fields. For identical inputs, deterministic result fields are `newSource`, `diagnostics`, `edits`, `changedTargets`, and `schemaDiff`.

Result semantics:

- `ok` MUST be `true` only when no `error` diagnostics are present after fragment parsing, source materialization, and full-domain compilation.
- If an edit fails before source materialization, `newSource` MUST equal `baseSource`, `edits` MUST be empty, and `changedTargets` MUST be empty.
- If source materialization succeeds but full-domain compilation fails, `newSource` and `edits` MUST describe the materialized edit, `ok` MUST be `false`, and diagnostics MUST include the full-domain compile errors.
- `module` MUST be present only when `includeModule` is `true`, full-domain compilation succeeds, and the result has no error diagnostics.
- `schemaDiff` MUST be present only when `includeSchemaDiff` is `true` and both the base and edited sources compile successfully enough to compare emitted schemas.
- `changedTargets`, `schemaDiff.addedTargets`, `schemaDiff.removedTargets`, and `schemaDiff.modifiedTargets` MUST be sorted by `LocalTargetKey` using deterministic Unicode code point order.
- `edits` MUST be ordered by ascending start offset. Overlapping edits are forbidden.
- Applying returned `MelTextEdit` entries as a non-overlapping replacement set over the original `baseSource` MUST produce `newSource`.

### 9.3 Edit Operations

The public edit operation union is:

```typescript
type MelEditOp =
  | MelEditAddTypeOp
  | MelEditAddStateFieldOp
  | MelEditAddComputedOp
  | MelEditAddActionOp
  | MelEditAddAvailableOp
  | MelEditAddDispatchableOp
  | MelEditReplaceActionBodyOp
  | MelEditReplaceComputedExprOp
  | MelEditReplaceAvailableOp
  | MelEditReplaceDispatchableOp
  | MelEditReplaceStateDefaultOp
  | MelEditReplaceTypeFieldOp
  | MelEditRemoveDeclarationOp
  | MelEditRenameDeclarationOp;
```

Operation type names use the `MelEdit*` prefix to avoid colliding with existing renderer fragment types. Operation `kind` string values remain the concise MEL edit verbs.

```typescript
type MelParamSource = {
  readonly name: string;
  readonly type: string;
};

type MelEditAddTypeOp = {
  readonly kind: "addType";
  readonly name: string;
  readonly expr: string;
};

type MelEditAddStateFieldOp = {
  readonly kind: "addStateField";
  readonly name: string;
  readonly type: string;
  readonly defaultValue: JsonLiteral;
};

type MelEditAddComputedOp = {
  readonly kind: "addComputed";
  readonly name: string;
  readonly expr: string;
};

type MelEditAddActionOp = {
  readonly kind: "addAction";
  readonly name: string;
  readonly params: readonly MelParamSource[];
  readonly body: string;
};

type MelEditAddAvailableOp = {
  readonly kind: "addAvailable";
  readonly target: `action:${string}`;
  readonly expr: string;
};

type MelEditAddDispatchableOp = {
  readonly kind: "addDispatchable";
  readonly target: `action:${string}`;
  readonly expr: string;
};

type MelEditReplaceActionBodyOp = {
  readonly kind: "replaceActionBody";
  readonly target: `action:${string}`;
  readonly body: string;
};

type MelEditReplaceComputedExprOp = {
  readonly kind: "replaceComputedExpr";
  readonly target: `computed:${string}`;
  readonly expr: string;
};

type MelEditReplaceAvailableOp = {
  readonly kind: "replaceAvailable";
  readonly target: `action:${string}`;
  readonly expr: string | null;
};

type MelEditReplaceDispatchableOp = {
  readonly kind: "replaceDispatchable";
  readonly target: `action:${string}`;
  readonly expr: string | null;
};

type MelEditReplaceStateDefaultOp = {
  readonly kind: "replaceStateDefault";
  readonly target: `state_field:${string}`;
  readonly value: JsonLiteral;
};

type MelEditReplaceTypeFieldOp = {
  readonly kind: "replaceTypeField";
  readonly target: `type_field:${string}.${string}`;
  readonly type: string;
};

type MelEditRemoveDeclarationOp = {
  readonly kind: "removeDeclaration";
  readonly target: LocalTargetKey;
};

type MelEditRenameDeclarationOp = {
  readonly kind: "renameDeclaration";
  readonly target: LocalTargetKey;
  readonly newName: string;
};
```

Fragment payloads are string-first. Action bodies, computed expressions, type expressions, state-field type expressions, and available/dispatchable guard expressions are accepted as MEL source strings and immediately parsed by the compiler.

Identifier-bearing fields such as declaration names, action parameter names, and rename targets MUST parse as exactly one MEL identifier token before any source edit is materialized. These fields MUST NOT be treated as raw source snippets.

JSON literal payloads used for state defaults MUST be validated before rendering. The compiler MUST reject non-finite numbers, sparse arrays, accessor properties, non-plain objects, non-inspectable object/array values, and object keys that are not valid MEL identifiers with `E_FRAGMENT_SCOPE_VIOLATION` and no source edits.

### 9.4 Fragment Parsing and Materialization Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| MEL-EDIT-1 | MUST | `compileFragmentInContext()` MUST process exactly one `MelEditOp` |
| MEL-EDIT-2 | MUST_NOT | The public primitive MUST NOT accept arrays, non-object values, or unknown operation shapes as valid edit operations |
| MEL-EDIT-3 | MUST | `newSource` MUST be a full MEL domain source string, not only the inserted fragment |
| MEL-EDIT-4 | MUST | After materializing `newSource`, the compiler MUST run full-domain compilation and return resulting diagnostics |
| MEL-EDIT-5 | MUST | Fragment strings MUST be parsed with the narrowest valid grammar for the operation |
| MEL-EDIT-6 | MUST_NOT | The compiler MUST NOT raw-splice unparsed source text through fragments, identifiers, action parameters, or JSON object keys into `baseSource` |
| MEL-EDIT-7 | MUST | `options.baseModule`, when provided, MUST be source-hash checked against `baseSource` before any source spans are reused |
| MEL-EDIT-8 | MUST | A stale `baseModule` MUST return `E_STALE_MODULE` and MUST NOT use stale source spans |
| MEL-EDIT-9 | MUST | Results for identical `baseSource`, `MelEditOp`, compiler version, and options MUST be deterministic for `newSource`, diagnostics, edits, changed targets, and schema diff |
| MEL-EDIT-10 | MUST | `changedTargets` MUST expose every declaration target the compiler can determine was directly changed by the edit |
| MEL-EDIT-11 | MUST | `schemaDiff`, when requested and available, MUST expose added, removed, and modified schema targets using deterministic ordering |
| MEL-EDIT-12 | MUST | The compiler MUST report impact; the external Author layer decides whether the impact matches user intent |
| MEL-EDIT-13 | MUST | Invalid `baseSource` MUST return diagnostics as values and MUST NOT attempt target mutation |
| MEL-EDIT-14 | MUST | `MelTextEdit.range` MUST be expressed in `baseSource` coordinates using the same `SourceSpan` coordinate convention as `SourceMapIndex` |
| MEL-EDIT-15 | MUST | Successful edits MUST preserve unrelated source text byte-for-byte except for the returned edit ranges |
| MEL-EDIT-16 | MUST | Result ordering for diagnostics, edits, changed targets, and schema diff MUST be stable for identical inputs |
| MEL-EDIT-17 | MUST_NOT | A failed remove or rename safety check MUST NOT return partial source edits |
| MEL-EDIT-18 | MUST | A safe remove or rename operation MUST produce a complete source edit and deterministic target impact report |

Grammar-specific fragment constraints:

| Fragment | Grammar |
|----------|---------|
| action body string | action-body grammar only |
| computed expression string | expression grammar only |
| type expression string | type grammar only |
| state field string | state-field grammar only |
| available/dispatchable string | expression grammar only |

An action body fragment MUST NOT be able to smuggle top-level declarations such as `action`, `state`, `computed`, `type`, or `domain`.

Declaration identifiers and action parameter identifiers MUST NOT be able to smuggle source syntax such as assignment, braces, newline-separated declarations, or secondary action/type/computed declarations. JSON object keys rendered into MEL object literals follow the same identifier rule.

### 9.5 Operation Semantics

| Operation | Required behavior |
|-----------|-------------------|
| `addType` | Adds one top-level named type declaration and reports `type:<name>` in `changedTargets` / `schemaDiff.addedTargets` when successful |
| `addStateField` | Adds one state field with the provided MEL type expression and JSON default value |
| `addComputed` | Adds one computed declaration and reports `computed:<name>` in added targets |
| `addAction` | Adds one action declaration with provided params and action body |
| `addAvailable` / `addDispatchable` | Adds the corresponding action guard only when the target action does not already carry that clause |
| `replaceActionBody` | Replaces only the target action body while preserving action identity, params, annotations, and guard clauses |
| `replaceComputedExpr` | Replaces only the target computed expression while preserving computed identity and annotations |
| `replaceAvailable` / `replaceDispatchable` | Replaces the target guard expression, or removes the clause when `expr` is `null` |
| `replaceStateDefault` | Replaces only the target state field initializer value |
| `replaceTypeField` | Replaces only the target top-level type field's type expression |
| `removeDeclaration` | Removes one declaration only when references are safe; otherwise returns `E_REMOVE_BLOCKED_BY_REFERENCES` |
| `renameDeclaration` | Renames one declaration and all compiler-known safe references only when unambiguous; otherwise returns `E_UNSAFE_RENAME_AMBIGUOUS` |

If secondary target changes occur, they MUST be represented in `changedTargets` and `schemaDiff`. The compiler MAY reject an edit when it violates the operation's safety contract, such as ambiguous rename references or remove blockers.

### 9.6 Target Validation and Diagnostics

Target-bearing operations MUST validate the target before materializing source edits.

| Condition | Diagnostic |
|-----------|------------|
| `baseModule.sourceMap.sourceHash` does not match `baseSource` | `E_STALE_MODULE` |
| Fragment fails its grammar-specific parser | `E_FRAGMENT_PARSE_FAILED` |
| Fragment parses but violates the requested fragment scope or in-context semantic constraints | `E_FRAGMENT_SCOPE_VIOLATION` |
| Operation shape, source-string field, identifier field, target field, or JSON literal payload is invalid before materialization | `E_FRAGMENT_SCOPE_VIOLATION` |
| Target key does not exist in the base source/module target index | `E_TARGET_NOT_FOUND` |
| Target key exists but is not valid for the requested operation | `E_TARGET_KIND_MISMATCH` |
| Rename cannot update references safely or deterministically | `E_UNSAFE_RENAME_AMBIGUOUS` |
| Remove would leave references dangling | `E_REMOVE_BLOCKED_BY_REFERENCES` |

Target-kind rules:

| Operation | Valid target kind |
|-----------|-------------------|
| `addAvailable`, `addDispatchable`, `replaceActionBody`, `replaceAvailable`, `replaceDispatchable` | `action:*` |
| `replaceComputedExpr` | `computed:*` |
| `replaceStateDefault` | `state_field:*` |
| `replaceTypeField` | `type_field:*.*` |
| `removeDeclaration`, `renameDeclaration` | any current `LocalTargetKey` kind except `domain:*` |

Add operations that introduce new named declarations MUST reject duplicate names through existing duplicate-identifier diagnostics when full-domain compilation detects the duplicate. Add operations that attach `available` or `dispatchable` MUST reject an already-present clause with `E_FRAGMENT_SCOPE_VIOLATION`.

Remove and rename are all-or-nothing operations. They MUST either produce a complete safe source edit and full recompile result, or return diagnostics with `newSource === baseSource` and no edits.

### 9.7 Acceptance Criteria

The compliance suite for this surface MUST cover:

- fragment grammar rejection for top-level declaration smuggling inside action body fragments
- rejection of runtime-invalid operation shapes without thrown exceptions
- rejection of raw-splice smuggling through declaration identifiers, action parameter identifiers, and JSON object keys
- rejection of invalid JSON literal payloads before rendering state defaults
- `replaceActionBody` preserving action signature and replacing only the target body
- `replaceComputedExpr` preserving computed identity and replacing only the expression
- `addComputed` returning `schemaDiff.addedTargets` containing `computed:<name>`
- stale `baseModule` source-hash mismatch returning `E_STALE_MODULE`
- deterministic `newSource`, `edits`, `changedTargets`, `schemaDiff`, and diagnostics for identical inputs
- result semantics for pre-materialization failures, post-materialization compile failures, `includeModule`, and `includeSchemaDiff`
- text edits ordered by base-source range and producing `newSource` as a non-overlapping replacement set
- target-kind mismatch returning `E_TARGET_KIND_MISMATCH`
- safe `removeDeclaration` and `renameDeclaration` producing complete edits and deterministic impact reports
- unsafe `removeDeclaration` and `renameDeclaration` returning diagnostics rather than partial edits
- runtime boundary invariants proving runtime entrypoints still consume `DomainSchema`, not `DomainModule` or edit results

---

## 10. Diagnostics

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
- `E_STALE_MODULE` for `baseModule.sourceMap.sourceHash` mismatch against `baseSource`
- `E_FRAGMENT_PARSE_FAILED` for grammar-specific fragment parse failure
- `E_FRAGMENT_SCOPE_VIOLATION` for fragments, operation shapes, identifier fields, target fields, or JSON literal payloads that are illegal in the requested edit scope or domain context
- `E_TARGET_NOT_FOUND` for edit operations whose target does not exist
- `E_TARGET_KIND_MISMATCH` for edit operations whose target key kind is not valid for the operation
- `E_UNSAFE_RENAME_AMBIGUOUS` for rename operations that cannot safely update references
- `E_REMOVE_BLOCKED_BY_REFERENCES` for remove operations blocked by references

The following historical diagnostics are superseded in the current contract:

- `E045` nullable schema-position rejection
- `E046` record schema-position rejection

They remain historical references only and are no longer part of the current compiler surface.

---

## 11. Summary

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
- `compileFragmentInContext()` is the current compiler-owned authoring-time source-fragment editing primitive
- Safe v1 remove/rename source edits are all-or-nothing, with complete safe edits or no partial edits on diagnostics
- source edit results are tooling-only artifacts and do not change runtime entrypoints or semantic schema artifacts
- `action_param` annotations remain outside the current v1 surface
- `dispatchable when` is part of the full action contract
- `SchemaGraph` remains availability-only and input-independent

This is the current full compiler surface to use for implementation, tooling, and documentation.
