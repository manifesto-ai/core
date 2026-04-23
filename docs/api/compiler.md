# @manifesto-ai/compiler

> MEL compiler package (MEL text -> `DomainSchema` / tooling sidecars / patch IR / schema-only module code)

---

## Overview

`@manifesto-ai/compiler` provides the MEL compilation seams used by runtime creation, tooling, and bundler integration.

The current canonical compiler contract is documented in the [current SPEC index](../internals/spec/index.md), with the compiler pinned to `SPEC-v1.2.0`.

Current compiler responsibilities include:
- schema-only compilation through `compileMelDomain()`
- tooling-only module compilation through `compileMelModule()`
- projected `SchemaGraph` extraction
- structural annotations via `@meta` as an out-of-schema `AnnotationIndex` sidecar
- declaration-level source locations as an out-of-schema `SourceMapIndex` sidecar
- intent-level dispatchability via `dispatchable when`
- MEL patch lowering through `compileMelPatch()`

Current MEL v1.2 compiler highlights include:
- object-literal spread as the sole bounded parser-level shorthand
- canonical lowering of spread through `merge(...)`
- presence-aware object typing shared by spread and direct `merge()`
- optional spread-result reads observed as `T | null`, requiring explicit normalization before non-null sinks

## Main Entry Points

### `compileMelDomain()`

Use `compileMelDomain()` when you need the semantic runtime artifact only.

```typescript
import { compileMelDomain } from "@manifesto-ai/compiler";

const result = compileMelDomain(melSource, { mode: "domain" });

if (result.schema) {
  // Runtime-facing seam
  const schema = result.schema;
}
```

`compileMelDomain()` returns `DomainSchema` only. Structural annotations and source maps never appear inside that schema.

### `compileMelModule()`

Use `compileMelModule()` when tooling needs compiler-owned helper artifacts in addition to the schema.

```typescript
import { compileMelModule } from "@manifesto-ai/compiler";

const result = compileMelModule(melSource, { mode: "module" });

if (result.module) {
  const { schema, graph, annotations, sourceMap } = result.module;
}
```

`compileMelModule()` returns a tooling-only `DomainModule`:

```typescript
type DomainModule = {
  readonly schema: DomainSchema;
  readonly graph: SchemaGraph;
  readonly annotations: AnnotationIndex;
  readonly sourceMap: SourceMapIndex;
};
```

`annotations` is the compiler-owned sidecar for `@meta`. `sourceMap` is the compiler-owned sidecar for declaration-level MEL provenance. Both remain outside `DomainSchema` and `SchemaGraph`.

### `compileMelPatch()`

```typescript
import { compileMelPatch } from "@manifesto-ai/compiler";

const result = compileMelPatch(patchText, {
  mode: "patch",
  actionName: "updateTodo",
});
```

`compileMelPatch()` returns unresolved conditional ops. Runtime MUST evaluate them before applying to Core.

## Tooling vs Runtime

- Runtime seams consume `DomainSchema`, not `DomainModule`.
- Tooling can use `compileMelModule()` to read `graph`, `annotations`, and `sourceMap`.
- If you compile through `compileMelModule()`, pass `module.schema` to runtime creation and keep `module.annotations` and `module.sourceMap` external.
- `.mel` loader and bundler integrations still default-export compiled `DomainSchema`, even when the source uses `@meta`.

```typescript
import { compileMelModule } from "@manifesto-ai/compiler";
import { createManifesto } from "@manifesto-ai/sdk";

const result = compileMelModule(melSource, { mode: "module" });
const module = result.module!;

const app = createManifesto(module.schema, {}).activate();
const annotations = module.annotations;
const sourceMap = module.sourceMap;
```

## Tooling Sidecar Types

```typescript
type Annotation = {
  readonly tag: string;
  readonly payload?: JsonLiteral;
};

type AnnotationIndex = {
  readonly schemaHash: string;
  readonly entries: Record<LocalTargetKey, readonly Annotation[]>;
};

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
```

- `schemaHash` matches the emitted `DomainSchema.hash`.
- `entries` includes annotated targets only.
- stacked annotations preserve source order.
- repeated tags are preserved and not deduplicated.
- `sourceMap` is keyed by the same landed declaration target space and carries physical source spans only.
- `sourceMap` remains tooling-only and does not participate in runtime schema input, schema hash, or `SchemaGraph` derivation.

## Patch IR Types

```typescript
type IRPathSegment =
  | { kind: "prop"; name: string }
  | { kind: "expr"; expr: CoreExprNode };

type IRPatchPath = readonly IRPathSegment[];

type ConditionalPatchOp = {
  condition?: CoreExprNode;
  op: "set" | "unset" | "merge";
  path: IRPatchPath;
  value?: CoreExprNode;
};
```

## Evaluation Contract

```typescript
function evaluateConditionalPatchOps(
  ops: ConditionalPatchOp[],
  ctx: EvaluationContext
): Patch[];
```

- `resolveIRPath()` MUST convert `IRPatchPath` -> concrete `PatchPath`.
- `expr` segment evaluates to:
  - string -> `{ kind: "prop", name }`
  - non-negative integer -> `{ kind: "index", index }`
- Any other value => skip op + emit warning.

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/core](./core) | Executes compiled `DomainSchema` semantics |
| [@manifesto-ai/sdk](./sdk) | Accepts `DomainSchema` or MEL source at runtime creation, not `DomainModule` |
| [Application](./application) | Runtime-facing `createManifesto()` entrypoint |
| [MEL Docs](/mel/) | Language reference and examples |
