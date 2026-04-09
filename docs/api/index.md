# API Reference

> Lookup surface by job, not reading order.

If you are new, start with [Quickstart](/quickstart) and [Tutorial](/tutorial/) first. Come back here once you know which package you need.

## Build An App

| Package | Use When |
|---------|----------|
| [@manifesto-ai/sdk](./sdk) | You want the activation-first app path with `createManifesto()` and `activate()` |

## Add Approval And History Later

| Package | Use When |
|---------|----------|
| [@manifesto-ai/lineage](./lineage) | You need continuity, restore, branch/head history, or sealing on top of the base runtime |
| [@manifesto-ai/governance](./governance) | You need proposals, approval flow, decisions, and governance events |

## Set Up Tooling Around The Runtime

| Package | Use When |
|---------|----------|
| [@manifesto-ai/cli](./cli) | You want project bootstrap, bundler integration, setup flows, or drift checks |
| [@manifesto-ai/mel-lsp](./mel-lsp) | You want MEL diagnostics, completion, navigation, rename, and schema introspection |
| [@manifesto-ai/skills](./skills) | You want current Manifesto guidance loaded into Codex or other AI tools |
| [@manifesto-ai/studio-cli](./studio-cli) | You want local read-only inspection for findings, graph, snapshot, trace, lineage, or governance |
| [@manifesto-ai/studio-core](./studio-core) | You want projection-first analysis APIs in your own tooling |
| [@manifesto-ai/studio-mcp](./studio-mcp) | You want an MCP inspection surface for agents or remote clients |

## Work On The Runtime Or Compiler Surface

| Package | Use When |
|---------|----------|
| [@manifesto-ai/core](./core) | You need the pure computation layer |
| [@manifesto-ai/host](./host) | You need effect execution and compute/apply orchestration |
| [@manifesto-ai/compiler](./compiler) | You need MEL compilation and lowering |
| [@manifesto-ai/codegen](./codegen) | You need schema-driven TypeScript or Zod generation |

## Related Docs

- [Quickstart](/quickstart)
- [Tutorial](/tutorial/)
- [Guides](/guides/)
- [Concepts](/concepts/)
- [Architecture](/architecture/)
- [Internals](/internals/)
