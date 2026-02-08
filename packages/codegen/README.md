# @manifesto-ai/codegen

> **Codegen** generates TypeScript types and Zod schemas from a Manifesto DomainSchema through a deterministic plugin pipeline.

---

## What is Codegen?

Codegen transforms a DomainSchema into type-safe code artifacts. It runs plugins sequentially, each producing file patches that are validated, collision-checked, and flushed to disk.

In the Manifesto architecture:

```
DomainSchema -> CODEGEN -> Generated Files
                  |
           Plugin pipeline
           (deterministic, no runtime deps)
```

---

## What Codegen Does

| Responsibility | Description |
|----------------|-------------|
| Generate TypeScript types | DomainSchema types -> `export interface` / `export type` |
| Generate Zod schemas | DomainSchema types -> Zod validators with type annotations |
| Plugin pipeline | Run plugins sequentially with shared artifacts |
| Path safety | Validate and normalize output file paths |
| Collision detection | Prevent multiple plugins from writing to the same file |
| Deterministic output | Same schema always produces identical files |

---

## What Codegen Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Define schemas | App (DomainSchema authoring) |
| Runtime validation | Application code using generated Zod schemas |
| Bundling or compilation | Build tools (tsc, esbuild, etc.) |
| Schema versioning | `@manifesto-ai/core` |

---

## Installation

```bash
pnpm add @manifesto-ai/codegen
# or
npm install @manifesto-ai/codegen
```

**Peer dependency:** `@manifesto-ai/core` must be installed separately.

---

## Quick Example

```typescript
import { generate, createTsPlugin, createZodPlugin } from "@manifesto-ai/codegen";
import type { DomainSchema } from "@manifesto-ai/core";

const schema: DomainSchema = { /* your domain schema */ };

const result = await generate({
  schema,
  outDir: "./generated",
  plugins: [createTsPlugin(), createZodPlugin()],
});

// result.files -> [{ path: "types.ts", content: "..." }, { path: "base.ts", content: "..." }]
// result.diagnostics -> [] (empty = no warnings or errors)
```

This produces two files:

**types.ts** -- TypeScript type definitions:
```typescript
export interface Todo {
  completed: boolean;
  id: string;
  title: string;
}
```

**base.ts** -- Zod schemas with type annotations:
```typescript
import { z } from "zod";
import type { Todo } from "./types";

export const TodoSchema: z.ZodType<Todo> = z.object({
  completed: z.boolean(),
  id: z.string(),
  title: z.string(),
});
```

> See [GUIDE.md](docs/GUIDE.md) for the full tutorial.

---

## API Reference

### Main Exports

```typescript
// Entry point
function generate(options: GenerateOptions): Promise<GenerateResult>;

// Built-in plugins
function createTsPlugin(options?: TsPluginOptions): CodegenPlugin;
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

type CodegenPlugin = {
  name: string;
  generate(ctx: CodegenContext): CodegenOutput;
};
```

> See [SPEC-v0.1.1.md](docs/SPEC-v0.1.1.md) for complete API reference.

---

## Core Concepts

### Plugin Pipeline

Plugins run in array order. Each plugin receives a context containing the schema and artifacts from all previous plugins. The TS plugin publishes type names; the Zod plugin reads them to generate type-annotated schemas.

### Artifacts

Plugins communicate through artifacts -- a namespaced key-value store. Plugin _i_ sees frozen artifacts from plugins 0..i-1. This enables cross-plugin coordination without coupling.

### Deterministic Output

Same DomainSchema always produces byte-identical output files. Fields and types are lexicographically sorted. No timestamps are included by default.

---

## Relationship with Other Packages

```
@manifesto-ai/core -> CODEGEN -> Generated .ts files
```

| Relationship | Package | How |
|--------------|---------|-----|
| Depends on | `@manifesto-ai/core` | Reads DomainSchema, TypeDefinition, TypeSpec |
| Used by | App build scripts | Called during build to generate type-safe code |

---

## When to Use Codegen

Use Codegen when:
- You want type-safe TypeScript interfaces from your DomainSchema
- You want Zod runtime validators that match your schema types
- You need deterministic, reproducible code generation in CI
- You are building a custom plugin for additional output formats

For schema authoring, see [`@manifesto-ai/core`](../core/).

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
