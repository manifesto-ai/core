# @manifesto-ai/compiler

> **Compiler** translates MEL (Manifesto Expression Language) into DomainSchema for Manifesto Core.

---

## What is the Compiler?

The compiler is the MEL frontend for Manifesto. It tokenizes, parses, validates, and lowers MEL source into a DomainSchema that Core can evaluate deterministically.

```
MEL source -> Compiler -> DomainSchema -> Core
```

---

## What the Compiler Does

| Responsibility | Description |
| --- | --- |
| Parse MEL | Tokenize and parse MEL into an AST |
| Validate | Scope and semantic checks aligned to MEL v0.3.3 |
| Generate IR | Produce DomainSchema for Core |
| Lower system values | Optional lowering of $system.* into explicit effects |

---

## What the Compiler Does NOT Do

| NOT Responsible For | Who Is |
| --- | --- |
| Execute effects | Host |
| Apply patches | Core |
| Govern authority | World |
| Bind UI | Bridge / React |

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
melPlugin({
  include: /\.mel$/,           // File filter (default: /\.mel$/)
  codegen: {                    // Optional: auto-generate types
    outDir: "src/generated",   // Output directory
    plugins: [/* custom */],   // Defaults to TS + Zod plugins
  },
});
```

The `codegen` option requires `@manifesto-ai/codegen` as a peer dependency. When enabled, TypeScript types and Zod schemas are generated automatically at build time.

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
    when true { patch count = add(count, 1) }
  }
}
`;

const result = compile(source, { lowerSystemValues: true });

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
  lowerSystemValues?: boolean;
};
```

---

## Documentation

| Document | Purpose |
| --- | --- |
| [MEL Overview](../../docs/mel/) | What MEL is and how to use it |
| [MEL Syntax](../../docs/mel/SYNTAX.md) | Grammar and syntax |
| [MEL Examples](../../docs/mel/EXAMPLES.md) | Example library |
| [MEL Error Guide](../../docs/mel/ERROR-GUIDE.md) | Error codes and fixes |
| [Compiler Spec](docs/SPEC.md) | Full compiler and MEL spec |
| [Compiler FDR](docs/FDR-0.3.3v.md) | Design rationale |

---

## License

[MIT](../../LICENSE)
