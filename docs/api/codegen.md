# @manifesto-ai/codegen

> Generate app-facing SDK domain facades, with lower-level plugin APIs available when needed.

---

## Overview

`@manifesto-ai/codegen` generates the TypeScript facade that keeps SDK app
code typed against a MEL domain. Most apps use it through the compiler plugin,
which emits `<source>.domain.ts` beside the source `.mel` file. It can also run
lower-level plugin pipelines from a compiled DomainSchema for tooling and CI.

Use this package when you need:

- App-facing SDK domain facades from your MEL domain
- Legacy TypeScript type definitions and Zod validators during migration
- Deterministic, reproducible code generation in CI
- Custom output formats via the plugin system
- Explicit build-tool integration via injected emitters

---

## App-Facing Path

For app code, wire Codegen into the MEL compiler and import the generated
facade at activation:

```typescript
import { createCompilerCodegen } from "@manifesto-ai/codegen";
import { melPlugin } from "@manifesto-ai/compiler/vite";

melPlugin({
  codegen: createCompilerCodegen(),
});
```

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./domain/todo.mel";
import type { TodoDomain } from "./domain/todo.domain";

const app = createManifesto<TodoDomain>(TodoMel, {}).activate();
```

Direct `generate()` usage is for build scripts, CI jobs, and custom tooling that
already has a compiled DomainSchema.

---

## Main Entry Points

### createCompilerCodegen()

Builds an explicit emitter for `@manifesto-ai/compiler` bundler plugins. This keeps the compiler decoupled from Codegen: the compiler only calls the emitter you provide.

```typescript
import { createCompilerCodegen } from "@manifesto-ai/codegen";
import { melPlugin } from "@manifesto-ai/compiler/vite";

melPlugin({
  codegen: createCompilerCodegen(),
});
```

Options are optional. By default, this uses `createDomainPlugin()` and emits an app-facing `<source>.domain.ts` facade next to the source `.mel` file.

### createDomainPlugin()

Generates the SDK v5 domain facade for `snapshot.state`, `computed`,
`action.*`, `ActionInput`, and `ActionArgs`.

```typescript
import { createDomainPlugin } from "@manifesto-ai/codegen";

const plugin = createDomainPlugin({
  fileName: "todo.domain.ts",
});
```

### generate()

Runs the codegen pipeline directly. Use this from build scripts or CI after MEL
has already been compiled to a DomainSchema.

```typescript
import { generate, createDomainPlugin } from "@manifesto-ai/codegen";

const result = await generate({
  schema,
  outDir: "./generated",
  sourceId: "src/domain/todo.mel",
  plugins: [createDomainPlugin()],
});

if (result.diagnostics.some((d) => d.level === "error")) {
  // Error occurred; no files were written to disk
}
```

`GenerateResult` includes:

- `files: Array<{ path: string; content: string }>` -- generated file contents
- `artifacts: Record<string, unknown>` -- plugin artifacts (namespaced by plugin name)
- `diagnostics: Diagnostic[]` -- warnings and errors

## Legacy Migration Plugins

### createTsPlugin() (deprecated)

Generates TypeScript type definitions from `schema.types`.

```typescript
import { createTsPlugin } from "@manifesto-ai/codegen";

const plugin = createTsPlugin({
  typesFile: "types.ts",     // Default: "types.ts"
  actionsFile: "actions.ts", // Default: "actions.ts"
});
```

**Artifacts published:** `{ typeNames: string[], typeImportPath: string }`

### createZodPlugin() (deprecated)

Generates Zod schemas from `schema.types`. When run after the TS plugin, adds `z.ZodType<T>` annotations and type imports.

```typescript
import { createZodPlugin } from "@manifesto-ai/codegen";

const plugin = createZodPlugin({
  schemasFile: "base.ts", // Default: "base.ts"
});
```

---

## TypeDefinition Mapping

This section is for direct tooling and custom plugin authors. App developers
usually write MEL `type` definitions and consume the generated facade.

| Kind | TypeScript | Zod |
|------|-----------|-----|
| primitive (string) | `string` | `z.string()` |
| primitive (number) | `number` | `z.number()` |
| primitive (boolean) | `boolean` | `z.boolean()` |
| primitive (null) | `null` | `z.null()` |
| literal | `"value"` | `z.literal("value")` |
| array | `T[]` | `z.array(T)` |
| record | `Record<K, V>` | `z.record(K, V)` |
| object (top-level) | `export interface` | `z.object({ ... })` |
| union | `T1 \| T2` | `z.union([T1, T2])` |
| union (T \| null) | `T \| null` | `z.nullable(T)` |
| ref | `TypeName` | `z.lazy(() => TypeNameSchema)` |

---

## Plugin Utilities

For custom plugin authors:

```typescript
// Path validation (rejects traversal, absolute paths)
import { validatePath } from "@manifesto-ai/codegen";
const result = validatePath("sub/file.ts"); // { valid: true, normalized: "sub/file.ts" }

// Deterministic hash
import { stableHash } from "@manifesto-ai/codegen";
const hash = stableHash({ key: "value" }); // Same input -> same hash

// File header
import { generateHeader } from "@manifesto-ai/codegen";
const header = generateHeader({ schemaHash: "abc123" });
// "// @generated by @manifesto-ai/codegen — DO NOT EDIT\n// Source: ..."
```

---

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/compiler](./compiler) | Compiles MEL and can call the injected codegen emitter |
| [@manifesto-ai/core](./core) | Provides the compiled DomainSchema and TypeDefinition types used by direct tooling |

---

## Documentation

- **[Usage Guide](/guides/code-generation)** -- Step-by-step guide with examples
- **[Package GUIDE.md](https://github.com/manifesto-ai/core/blob/main/packages/codegen/docs/GUIDE.md)** -- Detailed package guide with custom plugin tutorial
- **[SPEC-v0.1.1](https://github.com/manifesto-ai/core/blob/main/packages/codegen/docs/SPEC-v0.1.1.md)** -- Normative specification
- **[ADR-CODEGEN-001](https://github.com/manifesto-ai/core/blob/main/packages/codegen/docs/ADR-CODEGEN-001.md)** -- Architecture decisions
