# Bundler Setup

> Configure your bundler to import `.mel` files as compiled DomainSchema modules.

---

## How It Works

The compiler provides a unified [unplugin](https://github.com/unjs/unplugin)-based plugin. One implementation powers every bundler — Vite, Webpack, Rollup, esbuild, Rspack.

When you import a `.mel` file, the plugin compiles it to a `DomainSchema` JSON object and serves it as an ES module:

```
import schema from "./counter.mel";
// schema is a DomainSchema object, ready for createManifesto()
```

---

## Vite

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { melPlugin } from "@manifesto-ai/compiler/vite";

export default defineConfig({
  plugins: [melPlugin()],
});
```

---

## Next.js

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

---

## Webpack (Standalone)

```javascript
// webpack.config.js
const mel = require("@manifesto-ai/compiler/webpack");

module.exports = {
  plugins: [mel()],
};
```

---

## Rollup

```javascript
// rollup.config.js
import { melPlugin } from "@manifesto-ai/compiler/rollup";

export default {
  plugins: [melPlugin()],
};
```

---

## esbuild

```javascript
import { melPlugin } from "@manifesto-ai/compiler/esbuild";

await esbuild.build({
  plugins: [melPlugin()],
});
```

---

## Rspack

```javascript
// rspack.config.js
const mel = require("@manifesto-ai/compiler/rspack");

module.exports = {
  plugins: [mel()],
};
```

---

## Node / tsx (No Bundler)

For scripts or tests that don't use a bundler, use the Node ESM loader:

```bash
npx tsx --loader @manifesto-ai/compiler/node-loader main.ts
```

---

## Plugin Options

All bundler plugins accept the same options:

```typescript
melPlugin({
  include: /\.mel$/,  // File filter regex (default: /\.mel$/)
  codegen: {          // Optional: auto-generate types at build time
    outDir: "src/generated",
  },
});
```

### Auto Code Generation

When `codegen` is provided, the plugin generates TypeScript types and Zod validation schemas whenever `.mel` files are compiled. Requires `@manifesto-ai/codegen`:

```bash
pnpm add -D @manifesto-ai/codegen
```

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { melPlugin } from "@manifesto-ai/compiler/vite";

export default defineConfig({
  plugins: [
    melPlugin({
      codegen: { outDir: "src/generated" },
    }),
  ],
});
```

This generates `types.ts` and Zod schemas in `src/generated/` every time your `.mel` files change. See [Code Generation](/guides/code-generation) for details on customizing plugins.

---

## Subpath Exports Reference

| Import Path | Bundler |
|-------------|---------|
| `@manifesto-ai/compiler/vite` | Vite |
| `@manifesto-ai/compiler/webpack` | Webpack / Next.js |
| `@manifesto-ai/compiler/rollup` | Rollup |
| `@manifesto-ai/compiler/esbuild` | esbuild |
| `@manifesto-ai/compiler/rspack` | Rspack |
| `@manifesto-ai/compiler/node-loader` | Node ESM loader hooks |

---

## TypeScript Support

To get type-checking for `.mel` imports, create a declaration file:

```typescript
// mel.d.ts
declare module "*.mel" {
  const schema: import("@manifesto-ai/core").DomainSchema;
  export default schema;
}
```

If you use the `codegen` option, you get full type definitions for your domain's state, actions, and computed values.

---

## Troubleshooting

### Cannot find module './counter.mel'

1. Check that `@manifesto-ai/compiler` is installed
2. Check that your bundler config includes the MEL plugin
3. For TypeScript, add the `mel.d.ts` declaration file above

### MEL compilation failed

The plugin throws on compilation errors with diagnostic details (line, column, error code). Check your `.mel` syntax against the [MEL Syntax](/mel/SYNTAX) reference.
