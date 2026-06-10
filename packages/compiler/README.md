# @manifesto-ai/compiler

> **Compiler** lets apps import MEL domains and can emit generated SDK domain facades.

---

## What is the Compiler?

The compiler is the MEL frontend for Manifesto. For app developers, it lets a
bundler import `.mel` files and optionally emit the generated
`<source>.domain.ts` facade used by `createManifesto<TDomain>()`.

```text
.mel source -> compiler plugin -> createManifesto()
                              -> optional generated <source>.domain.ts facade
```

Internally, the compiler tokenizes, parses, validates, and lowers MEL source
into the runtime schema consumed behind the SDK app path.

---

## What the Compiler Does

| Responsibility | Description |
| --- | --- |
| Parse MEL | Tokenize and parse MEL into an AST |
| Validate | Scope, typing, and domain-rule checks aligned to the current compiler contract |
| Emit runtime schema | Produce the schema imported by `createManifesto()` |
| Emit optional TypeScript facade | Write generated domain types for larger SDK apps |
| Lower runtime/context expressions | Lower `$runtime.*` and `$context.*` references for deterministic runtime evaluation |

---

## What the Compiler Does NOT Do

| NOT Responsible For | Who Is |
| --- | --- |
| Execute external work | Runtime effect handlers |
| Apply domain transitions | Manifesto runtime |
| Add optional approval/history protocols | `@manifesto-ai/governance` + `@manifesto-ai/lineage` |
| Bind UI or caller integrations | SDK / application layer |

Current MEL/compiler highlights:

- `available when` remains the coarse action gate.
- `dispatchable when` is the fine input-specific legality gate.
- Expression-level collection builtins include `filter`, `map`, `find`, `every`, and `some`.
- Bounded parser-free sugar includes `absDiff`, `clamp`, `idiv`, `streak`, `match`, `argmax`, and `argmin`.
- Current schema-position lowering supports `Record<string, T>` and `T | null`.

---

## Installation

```bash
npm install -D @manifesto-ai/compiler
# or
pnpm add -D @manifesto-ai/compiler
```

---

## Bundler Integration (unplugin)

The compiler uses [unplugin](https://github.com/unjs/unplugin) to provide a unified MEL plugin for all major bundlers. One implementation, every bundler.

### Vite

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { melPlugin } from "@manifesto-ai/compiler/vite";

export default defineConfig({
  plugins: [melPlugin()],
});
```

### Next.js / Webpack

```javascript
// next.config.js
const mel = require("@manifesto-ai/compiler/webpack");

module.exports = {
  webpack: (config) => {
    config.plugins.push(mel());
    return config;
  },
};
```

### Rollup

```javascript
// rollup.config.js
import { melPlugin } from "@manifesto-ai/compiler/rollup";

export default { plugins: [melPlugin()] };
```

### esbuild

```javascript
import { melPlugin } from "@manifesto-ai/compiler/esbuild";

await esbuild.build({ plugins: [melPlugin()] });
```

### Rspack

```javascript
const mel = require("@manifesto-ai/compiler/rspack");

module.exports = { plugins: [mel()] };
```

### Node / tsx (ESM Loader)

```bash
npx tsx --loader @manifesto-ai/compiler/node-loader main.ts
```

### Plugin Options

```typescript
import { createCompilerCodegen } from "@manifesto-ai/codegen";

melPlugin({
  include: /\.mel$/,           // File filter (default: /\.mel$/)
  codegen: createCompilerCodegen(),
});
```

`codegen` is an explicit emitter hook. `@manifesto-ai/compiler` does not import
`@manifesto-ai/codegen` for you; install it only if you want MEL artifacts
written during dev or build and inject the emitter yourself.

`createCompilerCodegen()` can be called with no options. In that default mode
it writes `<source>.domain.ts` next to the compiled `.mel` file during
transform. You can still customize the generated facade:

```typescript
import { createCompilerCodegen, createDomainPlugin } from "@manifesto-ai/codegen";

melPlugin({
  codegen: createCompilerCodegen({
    outDir: "src/generated",
    plugins: [createDomainPlugin({ interfaceName: "TodoDomain" })],
  }),
});
```

Advanced build setups can still pass `{ emit, timing }` when they need build-end
or dual transform/build emission.

### Subpath Exports

| Export | Bundler |
| --- | --- |
| `@manifesto-ai/compiler/vite` | Vite |
| `@manifesto-ai/compiler/webpack` | Webpack / Next.js |
| `@manifesto-ai/compiler/rollup` | Rollup |
| `@manifesto-ai/compiler/esbuild` | esbuild |
| `@manifesto-ai/compiler/rspack` | Rspack |
| `@manifesto-ai/compiler/node-loader` | Node ESM loader hooks |

---

## CLI Usage

```bash
pnpm exec mel check path/to/domain.mel
pnpm exec mel compile path/to/domain.mel --pretty
pnpm exec mel compile path/to/domain.mel --stdout
pnpm exec mel parse path/to/domain.mel
pnpm exec mel tokens path/to/domain.mel
```

---

## Node API

```typescript
import { compile, check } from "@manifesto-ai/compiler";

const source = `
domain Counter {
  state { count: number = 0 }
  action increment() {
    onceIntent { patch count = count + 1 }
  }
}
`;

const result = compile(source);

if (!result.success) {
  console.error(result.errors);
} else {
  console.log(result.schema);
}

const errors = check(source);
```

### Compile Options

```typescript
type CompileOptions = {
  skipSemanticAnalysis?: boolean;
};
```

Legacy compatibility options may still exist for older call sites, but they are
not current v5 integration seams. Runtime facts are represented through
`$runtime.*` and explicit Core `Context`, not compiler-lowered system values.

---

## Documentation

| Document | Purpose |
| --- | --- |
| [MEL Overview](../../docs/mel/) | What MEL is and how to use it |
| [MEL Syntax](../../docs/mel/SYNTAX.md) | Grammar and syntax |
| [MEL Examples](../../docs/mel/EXAMPLES.md) | Example library |
| [MEL Error Guide](../../docs/mel/ERROR-GUIDE.md) | Error codes and fixes |
| [Compiler Spec](docs/SPEC-v1.2.0.md) | Current full compiler and MEL spec |
| [Compiler FDR](docs/FDR-v0.5.0.md) | Design rationale |
| [Compiler Compliance Suite](docs/compiler-SPEC-compilance-test-suite.md) | CCTS structure, rule modes, and execution guide |

---

## License

[MIT](../../LICENSE)
