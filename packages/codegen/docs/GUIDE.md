# Codegen Guide

> **Purpose:** Generate the app-facing `<domain>.domain.ts` facade for SDK apps
> **Prerequisites:** A working MEL domain; compiled DomainSchema access only for advanced tooling
> **Time to complete:** ~15 minutes

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Common Patterns](#common-patterns)
4. [Migration-Only Legacy Plugins](#migration-only-legacy-plugins)
5. [Advanced Usage: Custom Plugins](#advanced-usage-custom-plugins)
6. [Common Mistakes](#common-mistakes)
7. [Troubleshooting](#troubleshooting)
8. [Quick Reference](#quick-reference)

---

## Getting Started

Codegen is not required for the smallest no-build script. It is the normal typed
app setup once React, agent, route, or server code needs domain types. Add it
before those files start hand-maintaining the same `state`, `computed`, and
`actions` that already exist in MEL.

The app path is:

```
hello.mel -> compiler plugin -> hello.domain.ts -> createManifesto<HelloDomain>()
```

The direct `generate()` API is for build scripts, CI jobs, and custom tooling
that already has a compiled DomainSchema.

### Installation

```bash
pnpm add @manifesto-ai/core
pnpm add -D @manifesto-ai/codegen
```

`@manifesto-ai/core` satisfies Codegen's peer dependency. Normal app code
should import the generated `<domain>.domain.ts` facade rather than Core APIs.

### Minimal App Example

For app projects, inject Codegen into the MEL compiler plugin:

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

Compiling `src/domain/hello.mel` emits `src/domain/hello.domain.ts`.

Generated **src/domain/hello.domain.ts**:

```typescript
export interface HelloDomain {
  readonly state: {}
  readonly computed: {}
  readonly actions: {}
}
```

Use the generated facade with the SDK:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import HelloSchema from "./domain/hello.mel";
import type { HelloDomain } from "./domain/hello.domain";

const app = createManifesto<HelloDomain>(HelloSchema, {}).activate();
```

### Advanced Direct Build-Script Example

Call `generate()` directly when a build script or CI job already has a compiled
DomainSchema.

```typescript
import { generate, createDomainPlugin } from "@manifesto-ai/codegen";
import type { DomainSchema } from "@manifesto-ai/core";

const schema: DomainSchema = await loadCompiledSchema();

const result = await generate({
  schema,
  outDir: "./generated",
  sourceId: "src/domain/hello.mel",
  plugins: [createDomainPlugin()],
});

console.log(result.diagnostics); // → [] (no errors)
console.log(result.files.map(f => f.path)); // → ["src/domain/hello.domain.ts"]
```

---

## Basic Usage

For app developers, basic usage is the compiler-driven facade shown above. The
direct examples below are for tooling authors or repositories that need explicit
control over when generated files are emitted.

### Use Case 1: Direct Canonical Domain Facade

**Goal:** Generate the recommended `<domain>.domain.ts` shape for SDK consumers.

```typescript
import { generate, createDomainPlugin } from "@manifesto-ai/codegen";

const result = await generate({
  schema,
  outDir: "./generated",
  sourceId: "src/domain/todo.mel",
  plugins: [createDomainPlugin()],
});

// Result: only src/domain/todo.domain.ts is generated
console.log(result.files.map(f => f.path)); // → ["src/domain/todo.domain.ts"]
```

The domain plugin emits one facade interface with:
- `readonly state`
- `readonly computed`
- `readonly actions`

Computed values are inferred from Core expression nodes when possible. Unsupported expressions degrade to `unknown` with a warning diagnostic.

### Use Case 2: Checking Diagnostics

**Goal:** Handle warnings and errors from the pipeline.

```typescript
const result = await generate({
  schema,
  outDir: "./generated",
  plugins: [createDomainPlugin()],
});

// Check for errors
const errors = result.diagnostics.filter(d => d.level === "error");
if (errors.length > 0) {
  console.error("Generation failed:");
  errors.forEach(e => console.error(`  [${e.plugin}] ${e.message}`));
  // Note: when errors occur, no files are written to disk
}

// Check for warnings
const warnings = result.diagnostics.filter(d => d.level === "warn");
warnings.forEach(w => console.warn(`  [${w.plugin}] ${w.message}`));
```

When any error-level diagnostic exists, `generate()` returns without writing
files to disk. The `result.files` array still contains the generated content
for inspection.

---

## Migration-Only Legacy Plugins

Use these APIs only while migrating older code that still expects separate
`types.ts` and Zod schema files. New SDK, React, route, and agent integrations
should use `createCompilerCodegen()` or `createDomainPlugin()`.

### Legacy TypeScript + Zod Together

**Goal:** Keep the old low-level artifact flow during migration.

```typescript
import { generate, createTsPlugin, createZodPlugin } from "@manifesto-ai/codegen";

const result = await generate({
  schema,
  outDir: "./generated",
  plugins: [createTsPlugin(), createZodPlugin()], // Order matters!
});

// types.ts: TypeScript interfaces
// base.ts: Zod schemas with z.ZodType<T> annotations
```

`createTsPlugin()` and `createZodPlugin()` are deprecated. Prefer `createDomainPlugin()` for new integrations.

When the Zod plugin runs after the TS plugin, it reads the TS plugin's artifacts to:
- Add `z.ZodType<TypeName>` type annotations
- Generate `import type { ... } from "./types"` imports

### Legacy Custom File Names

**Goal:** Change output file paths for the deprecated TS/Zod artifact flow.

```typescript
const result = await generate({
  schema,
  outDir: "./generated",
  plugins: [
    createTsPlugin({ typesFile: "domain-types.ts" }),
    createZodPlugin({ schemasFile: "validators.ts" }),
  ],
});

console.log(result.files.map(f => f.path));
// → ["domain-types.ts", "validators.ts"]
```

---

## Common Patterns

These patterns are for low-level schema/plugin users. App developers usually
write the same concepts as MEL `type` definitions and let the compiler-driven
facade hide the DomainSchema representation.

### Pattern 1: Nullable Types

**When to use:** A field that can be `T` or `null`.

```typescript
// Schema definition
assignee: {
  type: {
    kind: "union",
    types: [
      { kind: "ref", name: "User" },
      { kind: "primitive", type: "null" },
    ],
  },
  optional: false,
}
```

Generated output:
```typescript
// types.ts
assignee: User | null;

// base.ts — optimized to z.nullable() instead of z.union()
assignee: z.nullable(z.lazy(() => UserSchema)),
```

### Pattern 2: Recursive / Circular References

**When to use:** A type that references itself or forms a cycle.

```typescript
// Schema: ProofNode has children that are also ProofNodes
ProofNode: {
  name: "ProofNode",
  definition: {
    kind: "object",
    fields: {
      id: { type: { kind: "primitive", type: "string" }, optional: false },
      children: {
        type: { kind: "array", element: { kind: "ref", name: "ProofNode" } },
        optional: false,
      },
    },
  },
}
```

Generated output:
```typescript
// types.ts — direct reference (TypeScript handles this natively)
export interface ProofNode {
  children: ProofNode[];
  id: string;
}

// base.ts — uses z.lazy() for runtime recursion
export const ProofNodeSchema: z.ZodType<ProofNode> = z.object({
  children: z.array(z.lazy(() => ProofNodeSchema)),
  id: z.string(),
});
```

### Pattern 3: Optional Fields

**When to use:** A field that may be omitted.

```typescript
// Schema definition
tags: {
  type: { kind: "array", element: { kind: "primitive", type: "string" } },
  optional: true, // <- this makes it optional
}
```

Generated output:
```typescript
// types.ts
tags?: string[];

// base.ts
tags: z.array(z.string()).optional(),
```

### Pattern 4: Union of Literals (Enum-like)

**When to use:** A value restricted to specific constants.

```typescript
// Schema definition
Status: {
  name: "Status",
  definition: {
    kind: "union",
    types: [
      { kind: "literal", value: "active" },
      { kind: "literal", value: "archived" },
      { kind: "literal", value: "deleted" },
    ],
  },
}
```

Generated output:
```typescript
// types.ts
export type Status = "active" | "archived" | "deleted";

// base.ts
export const StatusSchema: z.ZodType<Status> = z.union([
  z.literal("active"),
  z.literal("archived"),
  z.literal("deleted"),
]);
```

---

## Advanced Usage: Custom Plugins

### The CodegenPlugin Interface

```typescript
interface CodegenPlugin {
  readonly name: string;
  generate(ctx: CodegenContext): CodegenOutput;
}

interface CodegenContext {
  readonly schema: DomainSchema;
  readonly outDir: string;
  readonly artifacts: Readonly<Record<string, unknown>>; // From previous plugins
  readonly helpers: { stableHash(input: unknown): string };
}

interface CodegenOutput {
  readonly patches: readonly FilePatch[];
  readonly artifacts?: Readonly<Record<string, unknown>>;
  readonly diagnostics?: readonly Diagnostic[];
}
```

### Example: JSON Schema Plugin

```typescript
import type { CodegenPlugin, CodegenContext, CodegenOutput } from "@manifesto-ai/codegen";

function createJsonSchemaPlugin(): CodegenPlugin {
  return {
    name: "codegen-plugin-json-schema",
    generate(ctx: CodegenContext): CodegenOutput {
      const definitions: Record<string, unknown> = {};

      for (const [name, spec] of Object.entries(ctx.schema.types).sort()) {
        definitions[name] = mapToJsonSchema(spec.definition);
      }

      const content = JSON.stringify(
        { $schema: "http://json-schema.org/draft-07/schema#", definitions },
        null,
        2
      );

      return {
        patches: [{ op: "set", path: "schema.json", content }],
        artifacts: { definitionNames: Object.keys(definitions) },
      };
    },
  };
}
```

### Using Artifacts from Previous Plugins

```typescript
generate(ctx: CodegenContext): CodegenOutput {
  // Read TS plugin artifacts (if TS plugin ran before this one)
  const tsArtifacts = ctx.artifacts["codegen-plugin-ts"] as
    | { typeNames: string[]; typeImportPath: string }
    | undefined;

  if (tsArtifacts) {
    // Use type names from TS plugin
    console.log("Available types:", tsArtifacts.typeNames);
  }

  // ...
}
```

### Emitting Diagnostics

```typescript
generate(ctx: CodegenContext): CodegenOutput {
  const diagnostics = [];

  for (const [name, spec] of Object.entries(ctx.schema.types)) {
    if (spec.definition.kind === "record") {
      const keyDef = spec.definition.key;
      if (keyDef.kind !== "primitive" || keyDef.type !== "string") {
        diagnostics.push({
          level: "warn" as const,
          plugin: "my-plugin",
          message: `Type "${name}": non-string record key, degrading to string`,
        });
      }
    }
  }

  return { patches: [...], diagnostics };
}
```

---

## Common Mistakes

### Mistake 1: File Name Collision

**What people do:**

```typescript
// Both plugins writing to the same file
const result = await generate({
  schema,
  outDir: "./generated",
  plugins: [
    createTsPlugin({ typesFile: "output.ts" }),
    createZodPlugin({ schemasFile: "output.ts" }), // Same file!
  ],
});
```

**Why it's wrong:** Two plugins cannot write to the same path. This produces an error-level diagnostic and no files are written to disk.

**Correct approach:**

```typescript
// Use distinct file names
const result = await generate({
  schema,
  outDir: "./generated",
  plugins: [
    createTsPlugin({ typesFile: "types.ts" }),
    createZodPlugin({ schemasFile: "schemas.ts" }),
  ],
});
```

### Mistake 2: Absolute or Traversal Paths

**What people do:**

```typescript
// In a custom plugin
return {
  patches: [
    { op: "set", path: "/etc/output.ts", content: "..." },    // Absolute!
    { op: "set", path: "../escape.ts", content: "..." },       // Traversal!
  ],
};
```

**Why it's wrong:** File paths must be relative and cannot escape the output directory. Absolute paths, `..` segments, and drive letters are rejected.

**Correct approach:**

```typescript
return {
  patches: [
    { op: "set", path: "output.ts", content: "..." },
    { op: "set", path: "sub/nested.ts", content: "..." },
  ],
};
```

### Mistake 3: Using Legacy Zod Plugin Without TS Plugin

**What people do:**

```typescript
// Zod plugin alone — no type annotations
const result = await generate({
  schema,
  outDir: "./generated",
  plugins: [createZodPlugin()], // No createTsPlugin()!
});
```

**Why it's wrong:** It's not an error, but the Zod schemas won't have `z.ZodType<T>` annotations or `import type` statements. The schemas still work for runtime validation, but you lose compile-time type safety.

**Correct approach:**

```typescript
// Include TS plugin first for type annotations
plugins: [createTsPlugin(), createZodPlugin()]

// Or use Zod standalone intentionally (valid, just without type annotations)
plugins: [createZodPlugin()] // Produces z.object({...}) without z.ZodType<T>
```

---

## Troubleshooting

### Error: "Duplicate plugin name"

**Cause:** Two plugins in the array have the same `name` property.

**Solution:** Each plugin must have a unique name. If using two instances of the same plugin, this is not supported -- each plugin type should appear once.

### Error: "Path validation failed"

**Cause:** A plugin's patch path contains forbidden characters or patterns.

**Diagnosis:** Check the diagnostic message for details:
- Empty path
- Null bytes
- Absolute path (starts with `/` or drive letter)
- Directory traversal (`..` segment)

**Solution:** Ensure all patch paths are relative, forward-slash separated, and stay within the output directory.

### Error: "File collision"

**Cause:** Two plugins both use `{ op: "set" }` on the same file path.

**Solution:** Change one plugin's output file name:

```typescript
createTsPlugin({ typesFile: "types.ts" })
createZodPlugin({ schemasFile: "schemas.ts" })
```

### No files written to disk

**Cause:** An error-level diagnostic was emitted during generation.

**Solution:** Check `result.diagnostics` for errors:

```typescript
const errors = result.diagnostics.filter(d => d.level === "error");
errors.forEach(e => console.error(`[${e.plugin}] ${e.message}`));
```

Fix the underlying issue (collision, invalid path, plugin exception) and re-run.

---

## Quick Reference

### App-Facing API

| Export | Purpose |
|--------|---------|
| `createCompilerCodegen(options?)` | Emit generated app facades from compiler plugins |
| `createDomainPlugin(options?)` | Generate `<domain>.domain.ts` facade output |
| `generate(options)` | Run the codegen pipeline directly from a compiled schema |

### Migration And Plugin-Author API

| Export | Purpose |
|--------|---------|
| `createTsPlugin(options?)` | Deprecated migration plugin: TypeDefinition -> TypeScript types |
| `createZodPlugin(options?)` | Deprecated migration plugin: TypeDefinition -> Zod schemas |
| `validatePath(path)` | Check if a file path is safe (for plugin authors) |
| `stableHash(input)` | Deterministic hash (for plugin authors) |
| `generateHeader(options)` | Create `@generated` file header (for plugin authors) |

### TypeDefinition Mapping

| Kind | TypeScript | Zod |
|------|-----------|-----|
| primitive (string) | `string` | `z.string()` |
| primitive (number) | `number` | `z.number()` |
| primitive (boolean) | `boolean` | `z.boolean()` |
| primitive (null) | `null` | `z.null()` |
| literal | `"value"` / `42` | `z.literal("value")` / `z.literal(42)` |
| array | `T[]` | `z.array(T)` |
| record | `Record<K, V>` | `z.record(K, V)` |
| object (top-level) | `export interface Name { ... }` | `z.object({ ... })` |
| union | `T1 \| T2` | `z.union([T1, T2])` |
| union (T \| null) | `T \| null` | `z.nullable(T)` |
| ref | `TypeName` | `z.lazy(() => TypeNameSchema)` |
| unknown kind | `unknown` + warn | `z.unknown()` + warn |

### Diagnostic Levels

| Level | Meaning | Effect |
|-------|---------|--------|
| `warn` | Non-fatal issue (degraded output) | Files still written |
| `error` | Fatal issue (collision, invalid path) | No files written to disk |

---

*End of Guide*
