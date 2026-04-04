# @manifesto-ai/mel-lsp

> Language Server Protocol implementation for MEL.

## Overview

`@manifesto-ai/mel-lsp` is the editor and authoring-time tooling surface for MEL.

It provides:

- real-time diagnostics through `@manifesto-ai/compiler`
- completion for builtins, keywords, domain symbols, and system identifiers
- hover, signature help, document symbols, go-to-definition, references, and rename
- semantic tokens and code actions
- AI-facing schema introspection methods for agent workflows

## Install

```bash
npm install -D @manifesto-ai/mel-lsp
```

Run the server over stdio:

```bash
npx mel-lsp
```

Any editor that supports LSP can launch `mel-lsp` for `*.mel` files.

## Feature Surface

### Authoring Support

- diagnostics
- completion
- hover
- signature help
- document symbols
- go-to-definition
- references
- rename
- semantic tokens
- code actions

### AI-Native Methods

`mel-lsp` also exposes two custom methods:

- `mel/schemaIntrospection`: full compiled `DomainSchema`
- `mel/actionSignatures`: lightweight action metadata for agent integration

That makes it useful not only for editors but also for tool-hosted MEL-aware assistants.

## Typical Usage

### In an Editor

Configure the editor to launch `mel-lsp` over stdio for `.mel` files.

### In a Tooling Workspace

Use `mel-lsp` when you want diagnostics and symbol navigation while authoring domains, then pair it with [`@manifesto-ai/studio-cli`](./studio-cli) or [`@manifesto-ai/studio-mcp`](./studio-mcp) for runtime overlay inspection.

## Relationship To Other Packages

- [`@manifesto-ai/compiler`](./compiler) owns MEL compilation and powers diagnostics.
- [`@manifesto-ai/skills`](./skills) installs prompt guidance for AI tools; `mel-lsp` gives those tools schema-aware editor capabilities.
- [`@manifesto-ai/studio-core`](./studio-core) is downstream, read-only inspection after a schema or bundle already exists.

## Related Docs

- [Developer Tooling Guide](/guides/developer-tooling)
- [MEL Docs](/mel/)
- [@manifesto-ai/compiler](./compiler)
