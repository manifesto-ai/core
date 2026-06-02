# Bundler Setup

> Configure your bundler to import `.mel` files and emit generated domain facades.

---

## Start With Vite

For a React app or local web prototype, use Vite first. After the Todo tutorial,
keep `src/domain/todo.mel` and add this Vite setup:

```bash
npm install @manifesto-ai/sdk @manifesto-ai/core
npm install -D @manifesto-ai/compiler @manifesto-ai/codegen
```

`@manifesto-ai/core` is a peer dependency for build-time compiler/codegen
packages. You should not need to import it in ordinary app code; use the
generated `<source>.domain.ts` facade instead.

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { melPlugin } from "@manifesto-ai/compiler/vite";
import { createCompilerCodegen, createDomainPlugin } from "@manifesto-ai/codegen";

export default defineConfig({
  plugins: [
    melPlugin({
      codegen: createCompilerCodegen({
        plugins: [createDomainPlugin({ interfaceName: "TodoDomain" })],
      }),
    }),
  ],
});
```

Now a file like `src/domain/todo.mel` can be imported by runtime code, and the
compiler/codegen path emits `src/domain/todo.domain.ts` for app TypeScript. The
Todo docs use `TodoDomain` as the generated interface name, matching the
runnable example.

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import TodoMel from "./domain/todo.mel";
import type { TodoDomain } from "./domain/todo.domain";

const app = createManifesto<TodoDomain>(TodoMel, {}).activate();
```

If you do not want generated TypeScript yet, omit the `codegen` option:

```typescript
melPlugin()
```

That is enough for `.mel` imports and the base runtime path. Add codegen later
when local domain types start to repeat the `.mel` file.

After Vite runs, check that this file exists:

```text
src/domain/todo.domain.ts
```

Do not edit it by hand. Import types from it in React, server routes, and agent
tools.

## How It Works

The compiler provides a unified [unplugin](https://github.com/unjs/unplugin)-based plugin. One implementation powers every bundler: Vite, Webpack, Rollup, esbuild, and Rspack.

When you import a `.mel` file, the plugin compiles it to the domain object that
`createManifesto()` expects and serves it as an ES module:

```
import schema from "./counter.mel";
// schema is ready for createManifesto()
```

---

## Vite Without Codegen

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { melPlugin } from "@manifesto-ai/compiler/vite";

export default defineConfig({
  plugins: [melPlugin()],
});
```

---

## Vite With A Custom Facade Name

The default facade name is derived from the source file. Customize it only when
you need a stable project-specific name:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { melPlugin } from "@manifesto-ai/compiler/vite";
import { createCompilerCodegen, createDomainPlugin } from "@manifesto-ai/codegen";

export default defineConfig({
  plugins: [
    melPlugin({
      codegen: createCompilerCodegen({
        plugins: [createDomainPlugin({ interfaceName: "TodoDomain" })],
      }),
    }),
  ],
});
```

The Todo React example uses this shape so the generated facade exports
`TodoDomain`. If you use the default `createCompilerCodegen()` with no custom
plugin options, keep the emitted interface name that codegen chooses and import
that name consistently.

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
import { createCompilerCodegen } from "@manifesto-ai/codegen";

melPlugin({
  include: /\.mel$/,  // File filter regex (default: /\.mel$/)
  codegen: createCompilerCodegen(),
});
```

### Code Generation

The compiler does not import `@manifesto-ai/codegen` on its own. If you want build-time code generation, inject an emitter explicitly:

```bash
pnpm add -D @manifesto-ai/codegen
```

```typescript
// vite.config.ts
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

`createCompilerCodegen()` can be called with no options. In that default mode it uses `createDomainPlugin()` and writes an app-facing `<source>.domain.ts` facade. For example, compiling `src/domain/counter.mel` emits `src/domain/counter.domain.ts`.

You can still customize the pipeline:

```typescript
import { createCompilerCodegen, createDomainPlugin } from "@manifesto-ai/codegen";

melPlugin({
  codegen: createCompilerCodegen({
    outDir: "src/generated",
    plugins: [createDomainPlugin({ interfaceName: "CounterDomain" })],
  }),
});
```

See [Code Generation](/guides/code-generation) for plugin details.

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

To get type-checking for `.mel` imports, create a declaration file in your app source tree such as `src/types/mel.d.ts`:

```typescript
// src/types/mel.d.ts
declare module "*.mel" {
  const schema: import("@manifesto-ai/core").DomainSchema;
  export default schema;
}
```

The compiler does not inject this declaration automatically. Keep the file inside your TypeScript `include` globs so editor and `tsc` both see it.

If you inject a codegen emitter, you get the generated `<source>.domain.ts`
facade alongside your compiled `.mel` imports. That is the recommended
TypeScript path for application code.

If you are not using codegen yet, this declaration is still enough to import
`.mel` as a typed `DomainSchema`. Pairing it with an explicit
`ManifestoDomainShape` should be treated as a fallback for small examples,
migrations, or unusual build environments.

App code should usually import the generated facade type, not `DomainSchema`
directly. The declaration file is for TypeScript's module resolver.

---

## Troubleshooting

### Cannot find module './counter.mel'

1. Check that `@manifesto-ai/compiler` is installed
2. Check that your bundler config includes the MEL plugin
3. For TypeScript, add the `mel.d.ts` declaration file above

### MEL compilation failed

The plugin throws on compilation errors with diagnostic details (line, column, error code). Check your `.mel` syntax against the [MEL Syntax](/mel/SYNTAX) reference.
