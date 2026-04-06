# @manifesto-ai/cli

> Official CLI for installing, configuring, and validating Manifesto projects.

## Overview

`@manifesto-ai/cli` is the repo bootstrap and drift-management surface.

Use it when you want to:

- declare runtime intent in `manifesto.config.*`
- install the right runtime packages for `base`, `lineage`, or `gov`
- patch a bundler or loader integration such as `vite` or `node-loader`
- install optional tooling such as codegen or Codex skills
- validate that declared intent still matches the real repo state

The CLI treats `manifesto.config.*` as the source of truth.

```ts
export default {
  runtime: "gov",
  integration: {
    mode: "vite",
  },
  tooling: {
    codegen: "wire",
    skills: "codex",
  },
  sample: "counter",
};
```

## Install

```bash
npm install -D @manifesto-ai/cli
```

Then run:

```bash
npx manifesto help
```

## Command Surface

| Command | Purpose |
|---------|---------|
| `manifesto init` | Declare Manifesto intent, install packages, and optionally run setup steps |
| `manifesto integrate` | Patch a host integration surface such as `vite`, `webpack`, `rollup`, `esbuild`, `rspack`, or `node-loader` |
| `manifesto setup` | Manage tooling modes such as `codegen=off|install|wire` and `skills=off|install|codex` |
| `manifesto scaffold` | Generate optional sample files such as the counter runtime |
| `manifesto doctor` | Diagnose package, integration, and tooling drift |
| `manifesto add` | Deprecated compatibility wrapper for the older capability flow |

## Current Modes

| Area | Supported Values |
|------|------------------|
| `runtime` | `base`, `lineage`, `gov` |
| `integration.mode` | `none`, `vite`, `webpack`, `rollup`, `esbuild`, `rspack`, `node-loader` |
| `tooling.codegen` | `off`, `install`, `wire` |
| `tooling.skills` | `off`, `install`, `codex` |
| `sample` | `none`, `counter` |

That split makes "packages only", "install but do not wire codegen", and "install skills plus run Codex setup" first-class states instead of ad-hoc shell steps.

## Examples

```bash
manifesto init --runtime gov --integration none --codegen install --skills codex
manifesto integrate vite
manifesto setup codegen wire
manifesto setup skills codex
manifesto scaffold counter
manifesto doctor --json
```

## Interactive Init

When `manifesto init` runs in a TTY, it opens an Ink-based wizard for:

- runtime
- integration mode
- codegen mode
- skills mode
- sample mode
- final review

The wizard defaults to the conservative install-only path:

`runtime=base`, `integration=none`, `codegen=off`, `skills=off`, `sample=none`

Use `--non-interactive` when you want flag-driven setup only.

## Relationship To Other Packages

- [`@manifesto-ai/compiler`](./compiler) owns the actual MEL bundler adapters that `integrate` wires.
- [`@manifesto-ai/skills`](./skills) owns the tool-specific Codex and agent setup content that `setup skills codex` installs.
- [`@manifesto-ai/mel-lsp`](./mel-lsp) is editor-facing and separate from repo bootstrap.

## Related Docs

- [Developer Tooling Guide](/guides/developer-tooling)
- [Bundler Setup](/guides/bundler-setup)
- [Quickstart](/quickstart)
