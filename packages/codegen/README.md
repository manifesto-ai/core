# @manifesto-ai/codegen

> **Codegen** generates app-facing SDK domain facades from MEL compiler output.

---

## What is Codegen?

Codegen emits the TypeScript facade that lets SDK app code stay typed against a
MEL domain. Most apps use it through the compiler plugin, which writes a
`<source>.domain.ts` file next to the `.mel` source during dev or build.

For app developers, Codegen is the normal typed setup after the smallest
no-build script works. Use it before React, route, or agent code so those files
import generated `state`, `computed`, and `actions` facades instead of
hand-maintained local TypeScript domain types.

Under the hood, Codegen transforms a DomainSchema into type-safe code
artifacts. It runs plugins sequentially, each producing file patches that are
validated, collision-checked, and flushed to disk.

In the Manifesto architecture:

```
MEL -> @manifesto-ai/compiler -> CODEGEN -> <domain>.domain.ts
                                  |
                           Plugin pipeline
                           (deterministic, no runtime deps)
```

---

## What Codegen Does

| Responsibility | Description |
|----------------|-------------|
| Generate app domain facades | MEL compiler output -> `<domain>.domain.ts` with `state` / `computed` / `actions` |
| Integrate with compiler plugins | Emit facades beside `.mel` files during dev or build |
| Run direct generation for tooling | Use compiled DomainSchema input in CI, repository tools, or custom build scripts |
| Support legacy TS/Zod migration | Optional deprecated `types.ts` / `base.ts` output while older integrations migrate |
| Plugin pipeline | Run plugins sequentially with shared artifacts |
| Path safety | Validate and normalize output file paths |
| Collision detection | Prevent multiple plugins from writing to the same file |
| Deterministic output | Same schema always produces identical files |

---

## What Codegen Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Define app domains | MEL source compiled by `@manifesto-ai/compiler` |
| Runtime validation | Application code using generated Zod schemas |
| Bundling or compilation | Build tools (tsc, esbuild, etc.) |
| Schema versioning | `@manifesto-ai/core` |

---

## Installation

```bash
pnpm add @manifesto-ai/core
pnpm add -D @manifesto-ai/codegen
# or
npm install @manifesto-ai/core
npm install -D @manifesto-ai/codegen
```

`@manifesto-ai/core` satisfies Codegen's peer dependency. App code usually
imports the generated `<source>.domain.ts` facade, not Core APIs directly.

---

## Quick Example: Compiler-Driven Facade

```typescript
import { defineConfig } from "vite";
import { melPlugin } from "@manifesto-ai/compiler/vite";
import { createCompilerCodegen } from "@manifesto-ai/codegen";

export default defineConfig({
  plugins: [
    melPlugin({
      codegen: createCompilerCodegen(),
    }),
  ],
});
```

This produces an app-facing domain facade:

**src/domain/todo.domain.ts**
```typescript
export interface TodoDomain {
  readonly state: {
    filterMode: "all" | "active" | "completed"
    todos: ReadonlyArray<{
      completed: boolean
      id: string
      title: string
    }>
  }
  readonly computed: {
    activeCount: number
    completedCount: number
    hasCompleted: boolean
    todoCount: number
  }
  readonly actions: {
    addTodo: (title: string) => void
    clearCompleted: () => void
    removeTodo: (id: string) => void
    setFilter: (filter: "all" | "active" | "completed") => void
    toggleTodo: (id: string) => void
  }
}
```

Legacy `createTsPlugin()` and `createZodPlugin()` remain available, but are deprecated in favor of `createDomainPlugin()`.

If you want deterministic control from a build script, repository tool, or CI
job, call `generate()` directly after compiling MEL to a DomainSchema:

```typescript
import { generate, createDomainPlugin } from "@manifesto-ai/codegen";
import type { DomainSchema } from "@manifesto-ai/core";

const schema: DomainSchema = await loadCompiledSchema();

const result = await generate({
  schema,
  outDir: "./generated",
  sourceId: "src/domain/todo.mel",
  plugins: [createDomainPlugin()],
});

// result.files -> [{ path: "src/domain/todo.domain.ts", content: "..." }]
// result.diagnostics -> [] (empty = no warnings or errors)
```

> See [GUIDE.md](docs/GUIDE.md) for the full tutorial.

---

## API Reference

### Main Exports

```typescript
// App-facing compiler integration
function createCompilerCodegen(options?: CompilerCodegenOptions): CompilerCodegenEmitter;
function createDomainPlugin(options?: DomainPluginOptions): CodegenPlugin;

// Direct build-script/tooling entry point
function generate(options: GenerateOptions): Promise<GenerateResult>;

// Deprecated migration plugins
/** @deprecated */
function createTsPlugin(options?: TsPluginOptions): CodegenPlugin;
/** @deprecated */
function createZodPlugin(options?: ZodPluginOptions): CodegenPlugin;

// Key types
type GenerateOptions = {
  schema: DomainSchema;
  outDir: string;
  plugins: CodegenPlugin[];
  sourceId?: string;   // Embedded in @generated header
  stamp?: boolean;     // Add timestamp to header (breaks determinism)
};

type GenerateResult = {
  files: Array<{ path: string; content: string }>;
  artifacts: Record<string, unknown>;
  diagnostics: Diagnostic[];
};

type CompilerCodegenOptions = {
  outDir?: string;      // Default: "."
  plugins?: CodegenPlugin[]; // Default: [createDomainPlugin()]
  stamp?: boolean;
};

type CodegenPlugin = {
  name: string;
  generate(ctx: CodegenContext): CodegenOutput;
};
```

> See [SPEC-v0.1.1.md](docs/SPEC-v0.1.1.md) for complete API reference.

---

## Core Concepts

### Plugin Pipeline

Plugins run in array order. Each plugin receives a context containing the schema and artifacts from all previous plugins. The domain facade plugin is self-contained; the legacy TS plugin publishes type names and the legacy Zod plugin reads them to generate type-annotated schemas.

### Artifacts

Plugins communicate through artifacts -- a namespaced key-value store. Plugin _i_ sees frozen artifacts from plugins 0..i-1. This enables cross-plugin coordination without coupling.

### Deterministic Output

Same DomainSchema always produces byte-identical output files. Fields and types are lexicographically sorted. No timestamps are included by default.

---

## Relationship with Other Packages

```
MEL -> @manifesto-ai/compiler -> CODEGEN -> Generated .ts files
```

| Relationship | Package | How |
|--------------|---------|-----|
| Depends on | `@manifesto-ai/core` | Reads compiled DomainSchema, TypeDefinition, TypeSpec |
| Used by | Compiler plugin / build scripts | Called during dev or build to generate type-safe code |

---

## When to Use Codegen

Use Codegen when:
- You want a generated `<domain>.domain.ts` facade for `createManifesto<T>()`
- You are moving from a no-build script to typed React, route, or agent code
- You want Zod runtime validators that match your schema types
- You need deterministic, reproducible code generation in CI
- You are building a custom plugin for additional output formats

For app-facing schema authoring, start with MEL and the compiler plugin. Use
the direct schema APIs only when you are writing tooling or custom build
scripts.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](docs/GUIDE.md) | Step-by-step usage guide |
| [SPEC-v0.1.1.md](docs/SPEC-v0.1.1.md) | Complete specification |
| [ADR-CODEGEN-001.md](docs/ADR-CODEGEN-001.md) | Architecture decisions |
| [VERSION-INDEX.md](docs/VERSION-INDEX.md) | Version tracking |

---

## License

[MIT](../../LICENSE)
