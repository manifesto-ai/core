# Manifesto Codegen Specification v0.1.1

> **Status:** Draft
> **Version:** 0.1.1
> **Date:** 2026-02-05
> **Scope:** `@manifesto-ai/codegen` (build-time code generation tooling)
> **Compatible with:** Core SPEC v2.0.x (`DomainSchema`, `TypeSpec`, `TypeDefinition`)
> **Implements:** ADR-CODEGEN-001 v0.3.1
> **Authors:** Manifesto Team
> **License:** MIT
> **Changelog:**
> - **v0.1.1 (2026-02-05):** Critical fixes: (1) `CodegenOutput.diagnostics` field added, (2) GEN-5/GEN-8 — error diagnostics prevent all disk mutation including outDir clean, (3) TS-4 demoted MUST→SHOULD, (4) ZOD-7 — non-string record key degrade policy, (5) GEN-9 — multi-invocation pattern
> - **v0.1.0 (2026-02-05):** Initial specification — Plugin interface, FilePatch model, Runner rules, TS/Zod plugin mapping, artifacts pipeline, generation scope

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Normative Language](#2-normative-language)
3. [Scope & Non-Goals](#3-scope--non-goals)
4. [Boundary Model](#4-boundary-model)
5. [Core Types](#5-core-types)
6. [Plugin Interface](#6-plugin-interface)
7. [FilePatch Model](#7-filepatch-model)
8. [Runner](#8-runner)
9. [Artifacts Pipeline](#9-artifacts-pipeline)
10. [Generation Scope](#10-generation-scope)
11. [TypeDefinition Mapping: TypeScript](#11-typedefinition-mapping-typescript)
12. [TypeDefinition Mapping: Zod](#12-typedefinition-mapping-zod)
13. [Output Layout](#13-output-layout)
14. [Refine Overlay](#14-refine-overlay)
15. [Generated File Header](#15-generated-file-header)
16. [DomainSchema Synchronization](#16-domainschema-synchronization)
17. [Determinism](#17-determinism)
18. [Invariants](#18-invariants)
19. [Compliance](#19-compliance)
20. [References](#20-references)

---

## 1. Purpose

This document defines the **Manifesto Codegen Specification v0.1.1**.

Codegen is a **build-time consumer tool** that transforms `DomainSchema` (produced by `@manifesto-ai/compiler`) into typed artifacts for downstream consumption. It governs:

- **What** the codegen tool accepts as input (`DomainSchema`)
- **How** plugins transform schema into file patches
- **How** the runner composes patches, detects conflicts, and writes output
- **What** guarantees plugins and consumers can rely on (determinism, safety, collision rules)

This document is **normative**.

---

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

**Normative Rule IDs:**

| Prefix | Domain |
|--------|--------|
| `GEN-*` | Runner behavior rules |
| `PLG-*` | Plugin contract rules |
| `FP-*` | FilePatch rules |
| `TS-*` | TypeScript plugin mapping rules |
| `ZOD-*` | Zod plugin mapping rules |
| `OUT-*` | Output layout rules |
| `DET-*` | Determinism rules |
| `SYNC-*` | DomainSchema synchronization rules |
| `REF-*` | Refine overlay rules |

---

## 3. Scope & Non-Goals

### 3.1 In Scope

- Plugin interface contract and lifecycle
- FilePatch model and conflict resolution
- Runner execution semantics (ordering, flush, clean)
- TypeScript type generation from `TypeDefinition`
- Zod schema generation from `TypeDefinition`
- Artifacts pipeline between plugins
- Generated file header format
- Determinism guarantees
- DomainSchema version synchronization protocol

### 3.2 Non-Goals

| Non-Goal | Rationale |
|----------|-----------|
| MEL parsing or compilation | Compiler's responsibility (`@manifesto-ai/compiler`) |
| Runtime validation logic | Host's responsibility (refine overlay is handwritten) |
| Formatting/prettification | Consumer's lint/format pipeline responsibility |
| Watch/dev mode | DomainSchema changes are infrequent; manual CLI suffices for v0.1 |
| Computed type inference | Requires Expr-based type inference engine; deferred to future ADR |
| Multi-schema codegen | Single `DomainSchema` per invocation in v0.1 |
| Third-party plugin ecosystem | Array ordering suffices for 1st-party plugins |

---

## 4. Boundary Model

### 4.1 Layering

Codegen operates **outside** the Manifesto runtime stack. It is a build-time tool that consumes the same IR that Core produces.

```
┌─────────────────────────────────────────────────┐
│                  MEL Source                      │
└──────────────────────┬──────────────────────────┘
                       │ compileMelDomain()
                       ▼
┌─────────────────────────────────────────────────┐
│             DomainSchema (Core IR)              │
│  types · state · computed · actions · meta      │
└──────┬───────────────────────────┬──────────────┘
       │                           │
       │  (runtime)                │  (build-time)
       ▼                           ▼
┌──────────────┐          ┌───────────────────┐
│ Core/Host/   │          │  @manifesto-ai/   │
│ World/App    │          │  codegen           │
│ (runtime     │          │                   │
│  stack)      │          │  plugins:         │
└──────────────┘          │   ├ plugin-ts     │
                          │   └ plugin-zod    │
                          └─────────┬─────────┘
                                    │ FilePatch[]
                                    ▼
                          ┌───────────────────┐
                          │  Generated Files  │
                          │  types.ts         │
                          │  base.ts          │
                          │  actions.ts       │
                          └───────────────────┘
```

### 4.2 Dependency Direction

| Package | Depends On | Does NOT Depend On |
|---------|------------|-------------------|
| `@manifesto-ai/codegen` | `@manifesto-ai/core` (peerDep, types only) | Host, World, App, Compiler impl |
| `@manifesto-ai/codegen-plugin-ts` | `@manifesto-ai/codegen` | Zod, any runtime library |
| `@manifesto-ai/codegen-plugin-zod` | `@manifesto-ai/codegen`, `zod` (peerDep) | Host, any runtime library |

### 4.3 What Codegen Does NOT Know

| Concern | Owner | Codegen Boundary |
|---------|-------|-----------------|
| MEL syntax | Compiler | Receives `DomainSchema`, never MEL text |
| Runtime state values | Core/Host | Receives schema structure, never runtime data |
| Effect execution | Host | Generates types for action inputs, not effect handlers |
| Governance/Authority | World | No interaction |
| Semantic validation | Host (refine) | Generates structural base only |

---

## 5. Core Types

### 5.1 DomainSchema (Input — from Core SPEC v2.0.x)

Codegen consumes `DomainSchema` as defined in Core SPEC §4. The following fields are relevant to codegen:

```typescript
// Re-exported from @manifesto-ai/core — NOT redefined by codegen
type DomainSchema = {
  readonly id: string;
  readonly version: string;
  readonly hash: string;
  readonly types: Record<string, TypeSpec>;
  readonly state: StateSpec;
  readonly computed: ComputedSpec;
  readonly actions: Record<string, ActionSpec>;
  readonly meta?: { readonly name?: string; readonly description?: string };
};

type TypeSpec = {
  readonly name: string;
  readonly definition: TypeDefinition;
};

type TypeDefinition =
  | { kind: "primitive"; type: string }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "array"; element: TypeDefinition }
  | { kind: "record"; key: TypeDefinition; value: TypeDefinition }
  | { kind: "object"; fields: Record<string, { type: TypeDefinition; optional: boolean }> }
  | { kind: "union"; types: TypeDefinition[] }
  | { kind: "ref"; name: string };
```

**Normative**: Codegen MUST NOT redefine or extend these types. Codegen imports them from `@manifesto-ai/core`.

### 5.2 Diagnostic

```typescript
type Diagnostic = {
  readonly level: "warn" | "error";
  readonly plugin: string;
  readonly message: string;
};
```

### 5.3 GenerateResult

```typescript
type GenerateResult = {
  readonly files: ReadonlyArray<{ readonly path: string; readonly content: string }>;
  readonly artifacts: Readonly<Record<string, unknown>>;
  readonly diagnostics: readonly Diagnostic[];
};
```

---

## 6. Plugin Interface

### 6.1 CodegenPlugin

```typescript
interface CodegenPlugin {
  /**
   * Unique plugin identifier.
   * Used as the artifacts namespace key.
   * MUST be unique within a generate() invocation (GEN-2).
   */
  readonly name: string;

  /**
   * Generate file patches from DomainSchema.
   * Plugins are invoked in array order (GEN-3).
   */
  generate(ctx: CodegenContext): CodegenOutput | Promise<CodegenOutput>;
}
```

### 6.2 CodegenContext

```typescript
interface CodegenContext {
  readonly schema: DomainSchema;
  readonly sourceId?: string;
  readonly outDir: string;

  /**
   * Accumulated artifacts from previously executed plugins.
   * Keyed by plugin.name. Read-only.
   */
  readonly artifacts: Readonly<Record<string, unknown>>;

  readonly helpers: CodegenHelpers;
}

interface CodegenHelpers {
  /**
   * Deterministic hash function.
   * Same input MUST always produce the same output (DET-1).
   */
  stableHash(input: unknown): string;
}
```

### 6.3 CodegenOutput

```typescript
interface CodegenOutput {
  /**
   * File operations to apply. Runner applies these to a virtual FS.
   * Order within the array is significant (FP-3).
   */
  readonly patches: readonly FilePatch[];

  /**
   * Data to pass to subsequent plugins.
   * Runner places this at artifacts[plugin.name] automatically.
   */
  readonly artifacts?: Readonly<Record<string, unknown>>;

  /**
   * Diagnostics produced during generation.
   * Runner merges these into GenerateResult.diagnostics (GEN-4).
   */
  readonly diagnostics?: readonly Diagnostic[];
}
```

### 6.4 Plugin Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLG-1 | MUST | `plugin.name` MUST be a non-empty string. |
| PLG-2 | MUST | `plugin.generate()` MUST return a valid `CodegenOutput` (or a Promise thereof). |
| PLG-3 | MUST | Plugins MUST handle unknown `TypeDefinition.kind` values by emitting `unknown` (or `z.unknown()`) and a `Diagnostic` with level `"warn"`. Plugins MUST NOT throw on unknown kinds. |
| PLG-4 | MUST | Plugins MUST NOT mutate `ctx.schema`, `ctx.artifacts`, or any object reachable from them. |
| PLG-5 | MUST | All file paths in emitted `FilePatch` MUST comply with FP-1 through FP-4. |
| PLG-6 | SHOULD | Plugins SHOULD define and export a TypeScript type for their artifacts shape (e.g., `TsPluginArtifacts`). |
| PLG-7 | SHOULD | Plugins that depend on another plugin's artifacts SHOULD treat the dependency as optional and degrade gracefully if absent. |

---

## 7. FilePatch Model

### 7.1 Definition

```typescript
type FilePatch =
  | { readonly op: "set"; readonly path: string; readonly content: string }
  | { readonly op: "delete"; readonly path: string };
```

Plugins declare **operations on files**, not final file contents. The runner composes these operations on a virtual filesystem before flushing to disk.

### 7.2 Design Rationale

The FilePatch model mirrors Manifesto's Patch mechanism for domain state:

- Natural collision detection (same path, multiple `set` operations)
- Composable plugin output (patch sequencing)
- Delete semantics (domain type removal → orphan file cleanup)
- Future extensibility for incremental/cache-based generation

### 7.3 FilePatch Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| FP-1 | MUST | `patch.path` MUST be a POSIX-normalized relative path using `/` as separator. |
| FP-2 | MUST | `patch.path` MUST NOT contain `..`, absolute path prefixes, drive letters, or null bytes. Any path that would resolve outside `outDir` MUST be rejected. |
| FP-3 | MUST | Patches within a single plugin's output are applied in array order. |
| FP-4 | SHOULD | `patch.path` SHOULD be treated case-sensitively regardless of host OS, to ensure cross-platform determinism. |

### 7.4 Collision Rules

| Scenario | Behavior | Level | Rationale |
|----------|----------|-------|-----------|
| Same path receives `set` twice from the **same** plugin | Error | MUST | Plugin internal bug |
| Same path receives `set` twice from **different** plugins | Error | MUST | Silent overwrite is unacceptable |
| `delete` then `set` on same path (in order) | Allowed | — | Intentional regeneration |
| `set` then `delete` on same path (in order) | Allowed + `Diagnostic.warn` | SHOULD | Prior plugin's work is voided; likely unintentional |
| `delete` on nonexistent path | `Diagnostic.warn` | SHOULD | Harmless but likely unintentional |

| Rule ID | Level | Description |
|---------|-------|-------------|
| FP-5 | MUST | Runner MUST reject duplicate `set` operations on the same path with a `Diagnostic` of level `"error"`. |
| FP-6 | SHOULD | Runner SHOULD emit a `Diagnostic` of level `"warn"` when a `set` is followed by `delete` from a later plugin. |
| FP-7 | SHOULD | Runner SHOULD emit a `Diagnostic` of level `"warn"` for `delete` on a path not present in the virtual FS. |

---

## 8. Runner

### 8.1 Entry Point

```typescript
function generate(opts: GenerateOptions): Promise<GenerateResult>;

interface GenerateOptions {
  readonly schema: DomainSchema;
  readonly outDir: string;
  readonly plugins: readonly CodegenPlugin[];
  readonly sourceId?: string;
  readonly stamp?: boolean;
}
```

### 8.2 Execution Flow

1. **Validate plugins** — check name uniqueness (GEN-2)
2. **Initialize** — empty virtual FS, empty artifacts `{}`, empty diagnostics `[]`
3. **For each plugin** (in array order):
   a. Build `CodegenContext` with current accumulated artifacts
   b. Invoke `plugin.generate(ctx)`
   c. Merge `output.diagnostics` into runner's diagnostics list
   d. Validate returned patches (FP-1, FP-2)
   e. Apply patches to virtual FS (with collision detection per §7.4)
   f. Store `output.artifacts` at `allArtifacts[plugin.name]`
4. **Error gate** — if any `Diagnostic` with level `"error"` exists, **skip steps 5–6 and return immediately** with the current diagnostics. Disk state is NOT modified. (GEN-5, GEN-8)
5. **Clean outDir** — remove all existing files in `outDir` (GEN-1)
6. **Flush** — write virtual FS contents to disk under `outDir`
7. **Return** `GenerateResult`

### 8.3 Runner Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| GEN-1 | MUST | On successful generation (no error diagnostics), runner MUST guarantee stale file removal. Strategy: **clean-before-write** — delete all files in `outDir` before flushing. Safe because `outDir` is generated-only; handwritten files MUST reside outside `outDir`. |
| GEN-2 | MUST | `plugin.name` MUST be unique within a `generate()` invocation. Runner MUST validate uniqueness before executing any plugin. Duplicate names MUST cause an immediate error. |
| GEN-3 | MUST | Plugins MUST be executed in array order. Plugin at index `i` MUST see artifacts from plugins `0..i-1` only. |
| GEN-4 | MUST | Runner MUST collect all `Diagnostic` entries from plugins and from its own collision/validation checks into `GenerateResult.diagnostics`. |
| GEN-5 | MUST | If any `Diagnostic` with level `"error"` exists after all plugins have run, runner MUST NOT flush files to disk and MUST NOT clean `outDir`. |
| GEN-6 | MUST | Runner MUST normalize all `patch.path` values to POSIX format internally. OS-specific path conversion MUST happen only at disk write time. |
| GEN-7 | MUST NOT | Runner MUST NOT execute plugins concurrently. Sequential execution is required for deterministic artifacts accumulation. |
| GEN-8 | MUST NOT | If any `Diagnostic` with level `"error"` exists, runner MUST NOT modify disk state in any way, including cleaning `outDir`. |
| GEN-9 | MAY | A project MAY invoke `generate()` multiple times with different `outDir`/plugin combinations. Each invocation is independent. |

---

## 9. Artifacts Pipeline

### 9.1 Purpose

Artifacts enable inter-plugin data transfer. The canonical use case is the Zod plugin reading type names and import paths from the TS plugin.

### 9.2 Namespace Isolation

Each plugin's artifacts are automatically placed under `artifacts[plugin.name]` by the runner.

```typescript
// TS plugin returns:
{
  artifacts: {
    typeNames: ["ProofNode", "ProofTree", "FileState"],
    typeImportPath: "../schema/generated/types",
  }
}
// Runner stores at: artifacts["codegen-plugin-ts"]

// Zod plugin reads:
const ts = ctx.artifacts["codegen-plugin-ts"] as TsPluginArtifacts | undefined;
if (ts) {
  // Use ts.typeNames, ts.typeImportPath for z.ZodType<T> annotations
}
```

### 9.3 Artifacts Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLG-8 | MUST | Runner MUST place each plugin's returned `artifacts` at `allArtifacts[plugin.name]`. |
| PLG-9 | MUST | `ctx.artifacts` provided to plugin at index `i` MUST be a frozen (read-only) snapshot of `allArtifacts` accumulated from plugins `0..i-1`. |
| PLG-10 | MUST NOT | Plugins MUST NOT rely on artifacts from plugins that execute after them. Forward references are structurally impossible. |
| PLG-11 | SHOULD | Plugins that consume artifacts from another plugin SHOULD use `as T | undefined` and degrade gracefully when absent. |

---

## 10. Generation Scope

### 10.1 DomainSchema Field Coverage

| DomainSchema Field | TS Types | Zod Schemas | Status | Notes |
|--------------------|----------|-------------|--------|-------|
| `types` (TypeSpec) | ✅ | ✅ | Primary target | Named types — codegen's core input |
| `state` (StateSpec) | ⚠️ best-effort | ⚠️ best-effort | Limited | See §10.2 |
| `computed` (ComputedSpec) | ❌ | ❌ | Deferred | Requires Expr-based type inference; out of v0.1 scope |
| `actions` (ActionSpec) | ✅ (input types) | ✅ (input validation) | Supported | Action inputs originate externally |
| `meta` | ❌ | ❌ | Excluded | Build metadata; no runtime use |

### 10.2 StateSpec Expressiveness Limitations

Core SPEC's `StateSpec` / `FieldType` is intentionally simple — its concern is structural validation, not type precision:

| MEL Pattern | StateSpec Representation | Codegen Output | Problem |
|-------------|------------------------|---------------|---------|
| `Record<FileUri, FileState>` | `type: "object"` (no fields) | `Record<string, unknown>` | Value type lost |
| `FileState \| null` | `type: "object"`, `required: false` | `object \| null` | Concrete type lost |
| `Set<string>` | `type: "array"` | `unknown[]` | Semantics lost |

### 10.3 StateSpec Generation Policy

| Rule ID | Level | Description |
|---------|-------|-------------|
| GEN-10 | MUST | Accurate domain structure types MUST be generated from `schema.types` (TypeSpec). |
| GEN-11 | SHOULD | State types SHOULD be treated as "structural validation helpers" only. When a `StateSpec` field has a corresponding named type in `schema.types`, plugins SHOULD reference that TypeSpec. |
| GEN-12 | MUST | When a `StateSpec` field's type cannot be precisely represented, plugins MUST degrade to `unknown` / `z.unknown()` and MUST emit a `Diagnostic` with level `"warn"`. |
| GEN-13 | — | **Future path**: If the Compiler produces a synthesized `DomainState` TypeSpec for the state root, codegen SHOULD prefer it over raw `StateSpec` traversal. Out of v0.1 scope. |

---

## 11. TypeDefinition Mapping: TypeScript

### 11.1 Mapping Table

| `TypeDefinition.kind` | TypeScript Output | Notes |
|------------------------|-------------------|-------|
| `"primitive"` (`"string"`) | `string` | Direct map |
| `"primitive"` (`"number"`) | `number` | Direct map |
| `"primitive"` (`"boolean"`) | `boolean` | Direct map |
| `"primitive"` (`"null"`) | `null` | Direct map |
| `"literal"` | `"foo"`, `42`, `true`, `null` | Literal types |
| `"array"` | `T[]` | Recursive on `element` |
| `"record"` | `Record<K, V>` | Recursive on `key`, `value` |
| `"object"` (named, top-level) | `export interface X { ... }` | See TS-3 |
| `"object"` (inline) | `{ field: T; ... }` | Inline object literal type |
| `"union"` | `T1 \| T2 \| ...` | — |
| `"ref"` | Name reference (e.g., `ProofNode`) | Enables circular references |
| *unknown kind* | `unknown` + `Diagnostic` | Fallback for Core evolution |

### 11.2 TypeScript Plugin Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| TS-1 | MUST | Plugin MUST emit `unknown` for any unrecognized `TypeDefinition.kind` and MUST produce a `Diagnostic` with level `"warn"`. Plugin MUST NOT throw. |
| TS-2 | MUST | Nullable types MUST use `T \| null` semantics. `undefined` MUST NOT be used in generated types. |
| TS-3 | MUST | Top-level named types with `kind: "object"` MUST be emitted as `export interface`. All other named types MUST be emitted as `export type`. |
| TS-4 | SHOULD | When a named type participates in a `"ref"` cycle, the plugin SHOULD prefer `interface` if the type is object-shaped. If no valid emission form exists, degrade to `unknown` with `Diagnostic` warn. |
| TS-5 | MUST | Optional fields (`optional: true`) in `"object"` MUST be emitted with the `?` modifier. |
| TS-6 | SHOULD | Named types SHOULD be emitted in a deterministic order (e.g., lexicographic by name). |
| TS-7 | SHOULD | TS plugin SHOULD publish artifacts including at minimum: `typeNames: string[]` and `typeImportPath: string`. |

---

## 12. TypeDefinition Mapping: Zod

### 12.1 Mapping Table

| `TypeDefinition.kind` | Zod Output | Notes |
|------------------------|------------|-------|
| `"primitive"` (`"string"`) | `z.string()` | — |
| `"primitive"` (`"number"`) | `z.number()` | — |
| `"primitive"` (`"boolean"`) | `z.boolean()` | — |
| `"primitive"` (`"null"`) | `z.null()` | — |
| `"literal"` | `z.literal(...)` | — |
| `"array"` | `z.array(...)` | Recursive on `element` |
| `"record"` | `z.record(...)` | Recursive on `key`, `value` |
| `"object"` | `z.object({ ... })` | Optional → `.optional()` |
| `"union"` (general) | `z.union([...])` | — |
| `"union"` (`T \| null` exactly) | `z.nullable(T)` | 2-variant null optimization (ZOD-3) |
| `"ref"` | `z.lazy(() => XSchema)` | **Required** for circular references |
| *unknown kind* | `z.unknown()` + `Diagnostic` | Fallback for Core evolution |

### 12.2 Zod Plugin Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| ZOD-1 | MUST | Plugin MUST emit `z.unknown()` for any unrecognized `TypeDefinition.kind` and MUST produce a `Diagnostic` with level `"warn"`. Plugin MUST NOT throw. |
| ZOD-2 | MUST | `"ref"` kind MUST be emitted as `z.lazy(() => ReferencedSchema)`. Required for circular reference handling. |
| ZOD-3 | SHOULD | A `"union"` with exactly two variants where one is `{ kind: "primitive", type: "null" }` SHOULD be optimized to `z.nullable(T)`. |
| ZOD-4 | SHOULD | When TS plugin artifacts are available, the Zod plugin SHOULD annotate schemas with `z.ZodType<T>` for compile-time drift detection. |
| ZOD-5 | MUST | When TS plugin artifacts are absent, Zod plugin MUST still produce valid schemas without type annotations. The plugin MUST NOT require the TS plugin as a hard dependency. |
| ZOD-6 | SHOULD | Optional fields in `"object"` SHOULD be emitted with `.optional()`. |
| ZOD-7 | MUST | When a `"record"` TypeDefinition's `key` is not `{ kind: "primitive", type: "string" }`, the plugin MUST degrade to `z.record(z.string(), valueSchema)` and MUST emit a `Diagnostic` with level `"warn"`. |

### 12.3 TS Type Annotation Example

When TS plugin artifacts are available:

```typescript
// generated: base.ts
import type { ProofNode } from '../../schema/generated/types';

export const ProofNodeSchema: z.ZodType<ProofNode> = z.object({
  id: z.string(),
  status: z.nullable(z.string()),
  dependencies: z.array(z.lazy(() => ProofNodeSchema)),
});
```

When TS plugin artifacts are absent:

```typescript
// generated: base.ts (no type annotation)
export const ProofNodeSchema = z.object({
  id: z.string(),
  status: z.nullable(z.string()),
  dependencies: z.array(z.lazy(() => ProofNodeSchema)),
});
```

---

## 13. Output Layout

### 13.1 Recommended Directory Structure

**TypeScript types** (runtime-dependency-free, shareable):

```
<project>/packages/schema/generated/     ← outDir for TS plugin
  types.ts          ← TypeSpec → named types (primary)
  state.ts          ← StateSpec → best-effort DomainState
  actions.ts        ← ActionSpec → input types
  index.ts          ← re-export barrel
```

**Zod schemas** (Host boundary, Zod dependency):

```
<project>/packages/host/schemas/generated/   ← outDir for Zod plugin
  base.ts           ← AUTO-GENERATED structural schemas
```

**Handwritten overlay** (outside `outDir`):

```
<project>/packages/host/schemas/
  refine.ts         ← HANDWRITTEN semantic validation overlay
  index.ts          ← exports refined schemas only
```

### 13.2 Output Layout Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| OUT-1 | MUST | `outDir` MUST be a dedicated directory for generated files only. Handwritten files MUST NOT reside inside `outDir`. |
| OUT-2 | MUST | Zod schemas MUST NOT be placed in a runtime-dependency-free package. Zod output MUST reside on the Host side (or equivalent consumer-side package). |
| OUT-3 | SHOULD | TS types package SHOULD NOT import Zod or any validation library. |
| OUT-4 | SHOULD | Each plugin SHOULD use a distinct `outDir` to avoid cross-plugin file collision. |

---

## 14. Refine Overlay

### 14.1 Purpose

Refine overlay enables **semantic validation** (acyclic checks, referential integrity, domain-specific invariants) layered on top of auto-generated structural schemas.

### 14.2 Pattern

```typescript
// packages/host/schemas/refine.ts
import { ProofNodeBaseSchema, ProofTreeBaseSchema } from './generated/base';

// ✅ CORRECT: Extend base
export const ProofNodeSchema = ProofNodeBaseSchema.refine(
  (data) => !hasCycle(data.dependencies),
  { message: "ProofNode dependencies must be acyclic" }
);

// ❌ FORBIDDEN: Redefine structure
// export const ProofNodeSchema = z.object({ ... });
```

```typescript
// packages/host/schemas/index.ts
export { ProofNodeSchema, ProofTreeSchema } from './refine';
// Base schemas are internal — do NOT export directly.
```

### 14.3 Drift Detection

`z.ZodType<T>` annotations provide **compile-time detection** of structural drift between base Zod schemas and TS types.

**Limitation**: Refine overlay functions access `data` properties at runtime. If a base schema field is renamed, refine code referencing the old field name will fail **at runtime, not at compile time**. Mitigated by:

- The "extend only, never redefine" pattern (REF-1)
- CI tests that exercise refine overlay with representative data

### 14.4 Refine Overlay Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| REF-1 | MUST | Refine overlays MUST extend base schemas (via `.refine()`, `.superRefine()`, `.transform()`, `.pipe()`, etc.). MUST NOT redefine structural schema. |
| REF-2 | MUST | Only refined schemas MUST be exported from the package's public `index.ts`. Base schemas are internal. |
| REF-3 | MUST | Refine files MUST reside **outside** `outDir`. |
| REF-4 | SHOULD | Projects SHOULD include CI tests that parse representative data through the full refine chain. |

---

## 15. Generated File Header

### 15.1 Format

All generated files MUST include:

```typescript
// @generated by @manifesto-ai/codegen — DO NOT EDIT
// Source: <sourceId> | Schema hash: <schema.hash>
```

If `opts.stamp` is `true`:

```typescript
// @generated by @manifesto-ai/codegen — DO NOT EDIT
// Source: <sourceId> | Schema hash: <schema.hash>
// Generated at: <ISO 8601 timestamp>
```

### 15.2 Header Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| DET-2 | MUST | Default mode (`stamp: false`) MUST NOT include a timestamp. Generated files MUST be deterministic given same input. |
| DET-3 | MUST | The `@generated` marker MUST be present in all generated files. |
| DET-4 | SHOULD | `Schema hash` SHOULD use the value of `schema.hash` from the input `DomainSchema`. |

---

## 16. DomainSchema Synchronization

### 16.1 Version Contract

```jsonc
{
  "peerDependencies": {
    "@manifesto-ai/core": "~2.0.0"   // pin until TypeDefinition stabilizes
  }
}
```

### 16.2 Unknown Kind Fallback

```typescript
default: {
  diagnostics.push({
    level: "warn",
    plugin: pluginName,
    message: `Unknown TypeDefinition kind: "${(def as any).kind}". Emitting "unknown".`,
  });
  return "unknown"; // or z.unknown() for Zod
}
```

### 16.3 Synchronization Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SYNC-1 | MUST | Codegen MUST declare `@manifesto-ai/core` as a `peerDependency`. |
| SYNC-2 | MUST | All plugins MUST handle unknown `TypeDefinition.kind` gracefully (= PLG-3). |
| SYNC-3 | SHOULD | Cross-repo CI SHOULD detect `DomainSchema` breaking changes within 24 hours. |
| SYNC-4 | SHOULD | `peerDependency` range SHOULD use tilde (`~`) pinning until `TypeDefinition` union is declared stable. |

### 16.4 Reconsideration Trigger

If `TypeDefinition` changes cause codegen failures **two or more times per quarter**, the independent repository strategy MUST be re-evaluated.

---

## 17. Determinism

### 17.1 Principle

**Same `DomainSchema` + same plugins + same configuration → identical output bytes.**

### 17.2 Determinism Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| DET-1 | MUST | `helpers.stableHash()` MUST be a pure, deterministic function. |
| DET-2 | MUST | Default mode MUST NOT include non-deterministic content. |
| DET-5 | MUST | Plugins MUST emit types, fields, and schema entries in a deterministic order. |
| DET-6 | MUST | Runner MUST apply patches in deterministic order: plugin array order × patch array order. |
| DET-7 | SHOULD | Generated files SHOULD be committed. CI SHOULD verify with `generate && git diff --exit-code`. |
| DET-8 | SHOULD | `.gitattributes` SHOULD include `**/generated/** linguist-generated=true`. |

---

## 18. Invariants

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| INV-1 | **Input immutability.** `DomainSchema` and `CodegenContext` are never mutated. | PLG-4 |
| INV-2 | **Plugin isolation.** Plugin `i` sees artifacts from `0..i-1` only. | GEN-3, PLG-10 |
| INV-3 | **Namespace isolation.** Each plugin's artifacts occupy `artifacts[plugin.name]` exclusively. | PLG-8, GEN-2 |
| INV-4 | **No silent collision.** Duplicate `set` on same path always produces error. | FP-5 |
| INV-5 | **Clean output.** After success, `outDir` contains exactly the final virtual FS. On error, disk untouched. | GEN-1, GEN-5, GEN-8 |
| INV-6 | **Deterministic output.** Identical inputs → byte-identical files (excluding `stamp` mode). | DET-* |
| INV-7 | **Graceful evolution.** Unknown `TypeDefinition.kind` → `unknown` + warning, never crash. | PLG-3, SYNC-2 |
| INV-8 | **Path safety.** No generated file can escape `outDir`. | FP-1, FP-2, GEN-6 |
| INV-9 | **Sequential execution.** Plugins execute one at a time, in declared order. | GEN-7 |

---

## 19. Compliance

### 19.1 Compliance Levels

| Level | Meaning |
|-------|---------|
| **Compliant Runner** | Implements all GEN-*, FP-*, DET-* MUST rules |
| **Compliant Plugin** | Implements all PLG-* MUST rules, handles unknown kinds per PLG-3 |
| **Compliant Output** | Valid headers (DET-3), deterministic (DET-2), within `outDir` (FP-2) |

### 19.2 Conformance Test Categories

| Category | Tests |
|----------|-------|
| **Runner** | Plugin name uniqueness, patch collision detection, outDir clean on success, outDir preserved on error, path safety rejection, deterministic ordering, plugin diagnostics merge |
| **TS Plugin** | TypeDefinition mapping (all known kinds + unknown fallback), named type output form, recursive union degrade, nullable semantics, diagnostics for unknown kinds |
| **Zod Plugin** | TypeDefinition mapping (all known kinds + unknown fallback), `z.lazy()` for refs, nullable optimization, optional TS artifacts, non-string record key degrade |
| **Integration** | TS → Zod artifacts pipeline, multi-plugin collision detection, freshness check |

---

## 20. References

| Reference | Version | Relationship |
|-----------|---------|-------------|
| Core SPEC | v2.0.x | `DomainSchema`, `TypeSpec`, `TypeDefinition`, `StateSpec`, `ActionSpec` |
| MEL SPEC | v0.5.x | `compileMelDomain()` output |
| Host Contract | v2.0.2 | Host boundary validation (refine overlay consumer) |
| App SPEC | v2.0.0 | `$mel` namespace, platform namespace policy |
| ADR-CODEGEN-001 | v0.3.1 | Architectural decisions governing this specification |
| RFC 2119 | — | Normative language definitions |

---

## Appendix A: Rule ID Quick Reference

### Runner Rules (GEN-*)

| ID | Level | Summary |
|----|-------|---------|
| GEN-1 | MUST | Clean outDir before write on success |
| GEN-2 | MUST | Plugin name uniqueness |
| GEN-3 | MUST | Sequential plugin execution in array order |
| GEN-4 | MUST | Collect all diagnostics |
| GEN-5 | MUST | No flush AND no clean on error |
| GEN-6 | MUST | POSIX path normalization |
| GEN-7 | MUST NOT | No concurrent plugin execution |
| GEN-8 | MUST NOT | No disk modification on error |
| GEN-9 | MAY | Multiple generate() invocations |
| GEN-10 | MUST | TypeSpec is primary source |
| GEN-11 | SHOULD | StateSpec is supplementary |
| GEN-12 | MUST | Degrade unknown StateSpec → `unknown` + warn |

### Plugin Rules (PLG-*)

| ID | Level | Summary |
|----|-------|---------|
| PLG-1 | MUST | Non-empty name |
| PLG-2 | MUST | Valid CodegenOutput return |
| PLG-3 | MUST | Handle unknown TypeDefinition kinds |
| PLG-4 | MUST | No mutation of context |
| PLG-5 | MUST | Comply with FilePatch path rules |
| PLG-6 | SHOULD | Export artifacts type |
| PLG-7 | SHOULD | Optional artifact dependencies |
| PLG-8 | MUST | Artifacts placed at `[plugin.name]` |
| PLG-9 | MUST | Frozen artifacts snapshot |
| PLG-10 | MUST NOT | No forward artifact references |
| PLG-11 | SHOULD | Graceful degrade on missing artifacts |

### FilePatch Rules (FP-*)

| ID | Level | Summary |
|----|-------|---------|
| FP-1 | MUST | POSIX relative path |
| FP-2 | MUST | No path escape |
| FP-3 | MUST | Array order within plugin |
| FP-4 | SHOULD | Case-sensitive paths |
| FP-5 | MUST | Duplicate set → error |
| FP-6 | SHOULD | Set-then-delete → warn |
| FP-7 | SHOULD | Delete nonexistent → warn |

### Determinism Rules (DET-*)

| ID | Level | Summary |
|----|-------|---------|
| DET-1 | MUST | stableHash is pure |
| DET-2 | MUST | No timestamp by default |
| DET-3 | MUST | @generated marker present |
| DET-4 | SHOULD | Schema hash in header |
| DET-5 | MUST | Deterministic emit order |
| DET-6 | MUST | Deterministic patch order |
| DET-7 | SHOULD | Commit generated files |
| DET-8 | SHOULD | linguist-generated gitattributes |

### TypeScript Plugin Rules (TS-*)

| ID | Level | Summary |
|----|-------|---------|
| TS-1 | MUST | Unknown kind → `unknown` + warn |
| TS-2 | MUST | `T \| null`, never `undefined` |
| TS-3 | MUST | Named object → interface, others → type |
| TS-4 | SHOULD | Circular ref prefer interface; degrade if impossible |
| TS-5 | MUST | Optional → `?` modifier |
| TS-6 | SHOULD | Lexicographic name ordering |
| TS-7 | SHOULD | Publish typeNames + typeImportPath artifacts |

### Zod Plugin Rules (ZOD-*)

| ID | Level | Summary |
|----|-------|---------|
| ZOD-1 | MUST | Unknown kind → `z.unknown()` + warn |
| ZOD-2 | MUST | Ref → `z.lazy()` |
| ZOD-3 | SHOULD | `T \| null` → `z.nullable()` |
| ZOD-4 | SHOULD | `z.ZodType<T>` when TS artifacts available |
| ZOD-5 | MUST | Independent without TS plugin |
| ZOD-6 | SHOULD | Optional → `.optional()` |
| ZOD-7 | MUST | Non-string record key → degrade + warn |

### Sync Rules (SYNC-*)

| ID | Level | Summary |
|----|-------|---------|
| SYNC-1 | MUST | Core as peerDependency |
| SYNC-2 | MUST | Unknown kind fallback (= PLG-3) |
| SYNC-3 | SHOULD | Cross-repo CI within 24h |
| SYNC-4 | SHOULD | Tilde pin until stable |

### Refine Rules (REF-*)

| ID | Level | Summary |
|----|-------|---------|
| REF-1 | MUST | Extend base, never redefine |
| REF-2 | MUST | Export refined only |
| REF-3 | MUST | Refine files outside outDir |
| REF-4 | SHOULD | CI tests for refine drift |

### Output Rules (OUT-*)

| ID | Level | Summary |
|----|-------|---------|
| OUT-1 | MUST | outDir is generated-only |
| OUT-2 | MUST | Zod not in dependency-free package |
| OUT-3 | SHOULD | TS package free of Zod |
| OUT-4 | SHOULD | Distinct outDir per plugin |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **DomainSchema** | Core IR representing a domain's structural and behavioral definition |
| **TypeSpec** | Named type declaration within DomainSchema |
| **TypeDefinition** | Discriminated union describing type structure |
| **FilePatch** | A declared file operation (`set` or `delete`) |
| **Virtual FS** | In-memory file system maintained by the runner during generation |
| **Artifacts** | Structured data a plugin publishes for subsequent plugins |
| **Refine Overlay** | Handwritten Zod validation layer extending auto-generated base schemas |
| **outDir** | Dedicated directory for generated files |
| **Base Schema** | Auto-generated Zod schema capturing structural shape |
| **Runner** | Core engine orchestrating plugin execution, patch composition, and disk output |
