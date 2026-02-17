# @manifesto-ai/compiler

> MEL compiler package (MEL text -> DomainSchema / IR / module code)

---

## Overview

`@manifesto-ai/compiler` provides the MEL compilation pipeline and integration adapters for loading `.mel` files in build tools.

Use this package when you need:

- Programmatic MEL compilation in tooling or CLIs
- Direct access to lexer/parser/analyzer/lowering/evaluation layers
- Build-time `.mel` module support (Vite / Node loader / Webpack loader)

---

## Main Entry Points

### compileMelDomain()

Compiles MEL domain source text into a `DomainSchema`.

```typescript
import { compileMelDomain } from "@manifesto-ai/compiler";

const result = compileMelDomain(melSource, { mode: "domain" });

if (result.schema) {
  // DomainSchema ready for @manifesto-ai/core / @manifesto-ai/sdk
}
```

`CompileMelDomainResult` includes:

- `schema: DomainSchema | null`
- `trace: CompileTrace[]`
- `warnings: Diagnostic[]`
- `errors: Diagnostic[]`

### compileMelPatch()

Compiles MEL patch text into runtime patch ops shape.

```typescript
import { compileMelPatch } from "@manifesto-ai/compiler";

const result = compileMelPatch(patchText, {
  mode: "patch",
  actionName: "updateTodo",
});
```

Note: current implementation returns `ops: []` with a warning indicating MEL patch text parsing is not fully implemented yet.

---

## Pipeline Exports

The package root exports each stage for advanced use:

- `lexer/*` - tokenization
- `parser/*` - AST parsing
- `analyzer/*` - static analysis
- `diagnostics/*` - diagnostics types/helpers
- `generator/*` - IR generation
- `lowering/*` - MEL IR -> Core IR lowering
- `evaluation/*` - Core IR evaluation
- `renderer/*` - PatchFragment -> MEL rendering
- `api/*` - high-level compile APIs

---

## Toolchain Adapters

### Vite Plugin (`@manifesto-ai/compiler/vite`)

```typescript
import { defineConfig } from "vite";
import { melPlugin } from "@manifesto-ai/compiler/vite";

export default defineConfig({
  plugins: [melPlugin()],
});
```

### Node / Webpack Loader (`@manifesto-ai/compiler/loader`)

Supports:

- Node ESM loader hooks: `resolve`, `load`
- Webpack loader default export

```typescript
import melWebpackLoader from "@manifesto-ai/compiler/loader";
```

---

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/core](./core) | Executes compiled `DomainSchema` semantics |
| [@manifesto-ai/sdk](./sdk) | Uses compiler results at app creation time |
| [MEL Docs](/mel/) | Language reference and examples |

