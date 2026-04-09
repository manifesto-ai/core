# Bundler Adapters

> Use compiler subpaths when your app imports `.mel` files directly.

The SDK can activate a compiled schema or MEL source string. Bundler adapters are for app code that imports `.mel` modules.

## Vite

```typescript
import { defineConfig } from "vite";
import { melPlugin } from "@manifesto-ai/compiler/vite";

export default defineConfig({
  plugins: [melPlugin()],
});
```

Then import the domain:

```typescript
import counterMel from "./counter.mel";
```

## Public Adapter Subpaths

| Subpath | Purpose |
|---------|---------|
| `@manifesto-ai/compiler/vite` | Vite plugin |
| `@manifesto-ai/compiler/webpack` | webpack plugin |
| `@manifesto-ai/compiler/rollup` | Rollup plugin |
| `@manifesto-ai/compiler/esbuild` | esbuild plugin |
| `@manifesto-ai/compiler/rspack` | Rspack plugin |
| `@manifesto-ai/compiler/node-loader` | Node ESM loader hooks for `.mel` files |
| `@manifesto-ai/compiler/loader` | compatibility alias for the Node loader |

Bundler plugin subpaths export `melPlugin` and the shared MEL plugin option types. The node-loader subpath exports loader hooks.

## Install Note

The runtime package is `@manifesto-ai/sdk`.

Install `@manifesto-ai/compiler` directly when your application imports compiler entrypoints such as `@manifesto-ai/compiler/vite` or `@manifesto-ai/compiler/node-loader`.

## Next

- Start from [Quick Start](/guide/quick-start)
- Read [@manifesto-ai/compiler](./compiler)
- Configure tooling with the [CLI](./cli)
