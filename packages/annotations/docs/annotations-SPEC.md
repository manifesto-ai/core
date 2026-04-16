# Manifesto Annotations Specification

> **Status:** Proposed (v0.2 overlay-aware draft)
> **Package:** `@manifesto-ai/annotations`
> **ADR Basis:** [ADR-017](../../../docs/internals/adr/017-capability-decorator-pattern.md), [ADR-019](../../../docs/internals/adr/019-post-activation-extension-kernel.md), [ADR-021](../../../docs/internals/adr/021-mel-structural-annotation-system-meta-sidecar.md)
> **Current Contract Note:** This package is not part of the current implemented runtime contract. The current landed annotation surface remains compiler-owned through `@meta(...)`, `AnnotationIndex`, and tooling-only `DomainModule` output.

---

## 1. Purpose

`@manifesto-ai/annotations` is the proposed decorator package that exposes compiler-produced structural annotations at runtime without changing runtime law.

In proposed v0.2 it owns:

- `withAnnotations(manifesto, config)`
- immutable compiler baseline plus optional runtime overlay composition
- the activated runtime annotation read facet
- pure helpers for composing annotations and exporting composed annotations as canonical annotation fragments

It does not own:

- annotation parsing or sidecar emission
- `@meta(...)` MEL syntax
- `DomainSchema`, `SchemaGraph`, or runtime legality semantics
- full domain MEL regeneration
- persistent overlay stores or synchronization protocols in this phase

The package exists to let applications consume and extend compiler-produced annotation metadata while preserving the current boundary:

- compiler source syntax remains `@meta(...)`
- compiler sidecar types remain `Annotation` and `AnnotationIndex`
- runtime annotation access is additive and decorator-based
- runtime meaning remains schema-owned, not annotation-owned

---

## 2. Canonical Public API

### 2.1 Decorator Entry

```ts
function withAnnotations<
  T extends ManifestoDomainShape,
  Laws,
>(
  manifesto: ComposableManifesto<T, Laws>,
  config: AnnotationsConfig,
): AnnotationsComposableManifesto<T, Laws>;
```

`withAnnotations()` accepts any composable manifesto law set. It is not limited to base-only composition.

Canonical composition forms:

```ts
withAnnotations(createManifesto(...), config).activate()
withAnnotations(withLineage(createManifesto(...), ...), config).activate()
withAnnotations(withGovernance(withLineage(createManifesto(...), ...), ...), config).activate()
```

### 2.2 Config and Overlay Types

```ts
type AnnotationsConfig = {
  readonly baseline: AnnotationIndex;
  readonly overlay?: AnnotationOverlay;
};

type AnnotationOverlay = {
  readonly schemaHash: string;
  readonly ops: readonly AnnotationOverlayOp[];
};

type AnnotationOverlayOp =
  | {
      readonly kind: "append";
      readonly target: LocalTargetKey;
      readonly annotations: readonly Annotation[];
    }
  | {
      readonly kind: "prepend";
      readonly target: LocalTargetKey;
      readonly annotations: readonly Annotation[];
    }
  | {
      readonly kind: "removeAll";
      readonly target: LocalTargetKey;
      readonly tag: string;
    }
  | {
      readonly kind: "replaceAll";
      readonly target: LocalTargetKey;
      readonly tag: string;
      readonly annotations: readonly Annotation[];
    };
```

Normative meaning:

- `baseline` is compiler truth and is immutable in this contract
- `overlay` is an optional op log layered over that truth
- no single-occurrence selector exists in v0.2
- no reorder primitive exists in v0.2

### 2.3 Pure Helper Exports

```ts
function composeAnnotations(
  schema: DomainSchema,
  baseline: AnnotationIndex,
  overlay?: AnnotationOverlay,
): AnnotationIndex;

function renderEffectiveAnnotationFragment(
  index: AnnotationIndex,
): string;
```

`composeAnnotations()` is the pure composition seam for tooling and non-runtime consumers.

`renderEffectiveAnnotationFragment()` exports the composed effective annotations as a canonical annotation fragment. It does not regenerate a full domain source file.

### 2.4 Activated Runtime

```ts
type AnnotationTarget =
  | TypedActionRef<ManifestoDomainShape>
  | FieldRef<unknown>
  | ComputedRef<unknown>
  | LocalTargetKey;

type AnnotationFacet = {
  readonly getBaselineAnnotationIndex: () => AnnotationIndex;
  readonly getEffectiveAnnotationIndex: () => AnnotationIndex;
  readonly getAnnotations: (
    target: AnnotationTarget,
  ) => readonly Annotation[];
  readonly hasAnnotation: (
    target: AnnotationTarget,
    tag: string,
  ) => boolean;
};

type AnnotationsComposableManifesto<
  T extends ManifestoDomainShape,
  Laws,
> = {
  readonly _laws: Laws;
  readonly schema: DomainSchema;
  activate(): ActivatedInstance<T, Laws> & AnnotationFacet;
};
```

`LocalTargetKey` remains the fallback target form for compiler-visible shapes that do not have SDK refs in the current runtime contract, including:

- `domain:<DomainName>`
- `type:<TypeName>`
- `type_field:<TypeName>.<FieldName>`

In proposed v0.2, `LocalTargetKey` is a **compatibility target form**, not the long-term canonical user-facing target API. It exists only because the current runtime contract does not yet expose typed handles for those compiler-visible shapes.

Current SDK refs remain the canonical runtime lookup surface for:

- actions through `MEL.actions.*`
- state fields through `MEL.state.*`
- computed fields through `MEL.computed.*`

A future typed target-handle generation seam is reserved. Tooling SHOULD prefer generated typed handles when they become available.

---

## 3. Config and Validation Contract

`withAnnotations()` remains explicit-config only in this phase.

Normative meaning:

- callers MUST provide `config.baseline`
- callers MAY provide `config.overlay`
- `withAnnotations()` MUST treat `baseline` as immutable compiler-owned metadata
- `baseline.schemaHash` MUST equal `manifesto.schema.hash`
- when provided, `overlay.schemaHash` MUST equal `manifesto.schema.hash`
- every overlay target MUST resolve against `manifesto.schema`
- schema mismatch or invalid target resolution MUST reject before activation with an annotations-owned configuration error

This phase does not define:

- implicit baseline recovery from `createManifesto(melString, ...)`
- runtime recompilation of MEL source
- acceptance of tooling artifacts such as `DomainModule` in place of `AnnotationIndex`

---

## 4. Composition and Activation Model

`withAnnotations()` decorates a **composable manifesto**. It does not create a live runtime.

It preserves the underlying runtime law:

- base runtimes remain base runtimes with an added annotation read facet
- lineage runtimes remain lineage runtimes with an added annotation read facet
- governed runtimes remain governed runtimes with an added annotation read facet

This package does not promote or replace write verbs.

Normative consequences:

- if the underlying runtime exposes `dispatchAsync`, the decorated runtime still exposes `dispatchAsync`
- if the underlying runtime exposes `commitAsync`, the decorated runtime still exposes `commitAsync`
- if the underlying runtime exposes `proposeAsync`, the decorated runtime still exposes `proposeAsync`
- `withAnnotations()` MUST NOT weaken governance or lineage prerequisites already established by other decorators
- activation remains one-shot through the underlying manifesto activation boundary

---

## 5. Overlay Composition and Ordering

The effective annotation view is defined as:

`effective = composeAnnotations(schema, baseline, overlay)`

Composition starts from the compiler baseline and applies overlay ops in `overlay.ops` order to the current effective list for each target.

### 5.1 Baseline

- baseline order is compiler-owned and immutable
- duplicate tags in baseline are valid and preserved
- baseline entries continue to omit unannotated targets and empty arrays

### 5.2 Overlay Ops

`append`:

- operates on one `LocalTargetKey`
- appends the provided annotations to the end of the current effective list
- preserves the annotation order given in the op payload

`prepend`:

- operates on one `LocalTargetKey`
- prepends the provided annotations to the start of the current effective list
- preserves the annotation order given in the op payload
- later `prepend` ops appear before earlier prepends because ops are applied sequentially

`removeAll`:

- removes every annotation on the target whose `tag` equals the provided tag
- if no matching tag exists, it is a no-op

`replaceAll`:

- removes every annotation on the target whose `tag` equals the provided tag
- if one or more matches exist, the replacement annotations are inserted at the first removed match position
- if no matching tag exists, the replacement annotations are appended to the end of the current effective list
- replacement annotations preserve the order given in the op payload

Current v0.2 intentionally does not define:

- editing one duplicate instance out of many
- addressing annotations by ordinal or id
- arbitrary reordering of existing annotations

### 5.3 Effective Index Normalization

The effective `AnnotationIndex` MUST:

- preserve `schemaHash`
- omit empty target arrays
- preserve effective per-target annotation order after composition
- use deterministic target ordering

---

## 6. Activated Runtime Annotation Facet

### 6.1 `getBaselineAnnotationIndex()`

`getBaselineAnnotationIndex()` returns the schema-bound compiler sidecar carried by the decorator.

Normative rules:

- it MUST expose the provided `baseline` unchanged in semantic content
- it MUST preserve duplicate tags, source order, and target-key structure already present in the compiler sidecar
- it MUST NOT synthesize annotations that were not present in `baseline`

### 6.2 `getEffectiveAnnotationIndex()`

`getEffectiveAnnotationIndex()` returns the composed annotation view after applying the optional overlay to the baseline.

Normative rules:

- it MUST equal `composeAnnotations(manifesto.schema, baseline, overlay)`
- it MUST be deterministic for a fixed schema, baseline, and overlay

### 6.3 `getAnnotations(target)`

`getAnnotations(target)` returns the annotations attached to one runtime or local target from the effective view.

Normative target resolution:

- `TypedActionRef` resolves to `action:<ActionName>`
- `FieldRef` resolves to `state_field:<FieldName>`
- `ComputedRef` resolves to `computed:<ComputedName>`
- `LocalTargetKey` MAY be used only as the current v0.2 compatibility target form for compiler-visible targets that do not yet have typed runtime handles

If a target has no effective annotations, the method returns `[]`.

### 6.4 `hasAnnotation(target, tag)`

`hasAnnotation(target, tag)` is a convenience read over the effective result of `getAnnotations(target)`.

Normative rules:

- it MUST return `true` when at least one effective annotation on the resolved target has the given tag
- it MUST NOT imply deduplication or uniqueness of tags
- it MUST remain a pure read helper with no caching guarantees in the public contract

---

## 7. Annotation Fragment Export

`renderEffectiveAnnotationFragment()` exports the effective annotation view as a canonical annotation fragment.

This fragment is package-owned export syntax, not full domain MEL. It exists so applications can persist or inspect composed annotation state without regenerating the domain itself.

Illustrative shape:

```mel
annotate action:submit {
  @meta("ui:button", { variant: "primary" })
  @meta("analytics:track")
}

annotate type_field:Task.internalNote {
  @meta("ui:hidden")
}
```

Normative meaning:

- fragment targets MUST emit in deterministic `LocalTargetKey` order
- annotations within a target MUST emit in effective order
- payloads MUST render as canonical JSON-like literals
- export MUST NOT promise source-faithful round-tripping
- export MUST NOT regenerate declarations, flows, or other domain structure

This phase does not define a parse/import helper for annotation fragments.

---

## 8. Boundary and Semantic Invariants

Annotations remain descriptive sidecars. They do not change runtime meaning.

This package MUST preserve all current runtime boundaries:

- `getSchemaGraph()` remains annotation-blind and schema-derived only
- `createManifesto()` remains `DomainSchema | string` only
- `DomainModule` remains a compiler tooling artifact and is not accepted as a runtime schema input
- annotation presence or absence MUST NOT change legality, dispatchability, compute results, or snapshot publication behavior

This package therefore exposes **read-only runtime access plus pure composition/export helpers**. It does not convert annotations into executable law.

---

## 9. Deferred Areas

The following areas are explicitly out of scope for proposed v0.2:

- fine-grained single-occurrence edit APIs
- public selectors based on annotation ordinal or synthetic ids
- persistent overlay stores
- automatic compiler bootstrap from MEL string input
- parsing annotation fragments back into overlays
- full domain MEL regeneration
- any change to `getSchemaGraph()` shape
- any widening of `createManifesto()` to accept `DomainModule`

If a later phase adds writable or persistent annotations, it MUST preserve the separation between:

- immutable compiler baseline metadata
- runtime-authored overlay metadata

That later phase is not standardized by this document.

---

## 10. Normative Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| ANN-DECORATOR-1 | MUST | `withAnnotations()` MUST accept composable manifestos, not live runtime instances |
| ANN-DECORATOR-2 | MUST | `withAnnotations()` MUST preserve the underlying manifesto law set rather than promoting or replacing write verbs |
| ANN-DECORATOR-3 | MUST | `withAnnotations()` MUST work over base, lineage, and governance compositions |
| ANN-DECORATOR-4 | MUST NOT | `withAnnotations()` MUST NOT create lineage or governance implicitly |
| ANN-CONFIG-1 | MUST | callers MUST provide `config.baseline` explicitly in proposed v0.2 |
| ANN-CONFIG-2 | MUST | `config.baseline.schemaHash` MUST equal `manifesto.schema.hash` |
| ANN-CONFIG-3 | MUST | when `config.overlay` is present, `config.overlay.schemaHash` MUST equal `manifesto.schema.hash` |
| ANN-CONFIG-4 | MUST | overlay targets MUST resolve against the decorated schema before activation succeeds |
| ANN-CONFIG-5 | MUST NOT | proposed v0.2 MUST NOT auto-recompile MEL source or recover annotations implicitly from string-based manifesto construction |
| ANN-OVERLAY-1 | MUST | composition MUST start from immutable compiler baseline and apply overlay ops sequentially |
| ANN-OVERLAY-2 | MUST | `append` and `prepend` MUST preserve the order of annotations listed in the op payload |
| ANN-OVERLAY-3 | MUST | `removeAll` MUST remove every matching tag on the target from the current effective list |
| ANN-OVERLAY-4 | MUST | `replaceAll` MUST replace every matching tag block on the target, or append replacements when no match exists |
| ANN-OVERLAY-5 | MUST NOT | proposed v0.2 MUST NOT define single-occurrence editing or reorder primitives |
| ANN-RUNTIME-1 | MUST | the activated decorated runtime MUST expose `getBaselineAnnotationIndex()`, `getEffectiveAnnotationIndex()`, `getAnnotations(target)`, and `hasAnnotation(target, tag)` |
| ANN-RUNTIME-2 | MUST | `getAnnotations(target)` MUST resolve SDK refs and `LocalTargetKey` compatibility targets deterministically to the same effective entries |
| ANN-RUNTIME-2a | SHOULD | tooling SHOULD prefer typed target handles when available; `LocalTargetKey` remains a v0.2 compatibility target form for targets that do not yet have typed runtime handles |
| ANN-RUNTIME-3 | MUST | duplicate tags and effective-order preservation MUST remain visible to callers |
| ANN-RUNTIME-4 | MUST | missing targets in the effective view MUST resolve to an empty annotation list rather than an error |
| ANN-EXPORT-1 | MUST | `composeAnnotations()` MUST return a normalized effective `AnnotationIndex` with deterministic target ordering and no empty arrays |
| ANN-EXPORT-2 | MUST | `renderEffectiveAnnotationFragment()` MUST export canonical annotation fragments only, not full domain MEL |
| ANN-EXPORT-3 | MUST NOT | annotation fragment export promise source-faithful round-tripping |
| ANN-BOUNDARY-1 | MUST NOT | this package MUST NOT change `DomainSchema`, `SchemaGraph`, compute semantics, legality semantics, or snapshot publication rules |
| ANN-BOUNDARY-2 | MUST | `getSchemaGraph()` MUST remain annotation-blind |
| ANN-BOUNDARY-3 | MUST NOT | this package MUST NOT widen runtime schema-input seams to accept `DomainModule` |
| ANN-BOUNDARY-4 | MUST NOT | proposed v0.2 MUST NOT define full domain MEL regeneration or persistent overlay-store semantics |

---

## 11. Summary

The proposed `@manifesto-ai/annotations` package is the runtime decorator companion to compiler-owned `@meta(...)` sidecars.

Its role remains narrow by design:

- compiler owns annotation syntax and `AnnotationIndex` emission
- SDK, Lineage, and Governance keep their current runtime laws
- `withAnnotations()` adds read-only annotation access on top of those laws
- overlay composition extends that access without mutating compiler baseline truth

In proposed v0.2, annotations become:

- explicit at configuration time
- composable through a coarse-grained overlay model
- exportable as canonical annotation fragments

They still do not become runtime law.
