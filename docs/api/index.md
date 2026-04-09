# API Reference

> Lookup the app-facing runtime surface first. Drop into package overviews only when you need the owning package boundary.

If you are learning Manifesto for the first time, start with the [Guide](/guide/introduction). Use this section when you know what you want to call.

## App Runtime APIs

| Area | Start Here |
|------|------------|
| Create an app | [Application](./application) |
| Inspect the activated handle | [Runtime Instance](./runtime) |
| Show legal actions to UI or agents | [Actions and Availability](./actions-and-availability) |
| Request a transition | [Intents](./intents) |
| Read domain state | [Snapshots and Subscriptions](./snapshots-and-subscriptions) |
| Fulfill external work | [Effects](./effects) |
| Add approval or HITL | [Governed Runtime](./governed-runtime) |
| Import `.mel` files | [Bundler Adapters](./bundler-adapters) |

## Public Surface Inventory

[Public Surface Inventory](./public-surface) is generated from first-party package exports. Use it when you need to confirm whether a name is public. Use curated pages above for meaning and examples.

## Package Overviews

| Package | Use When |
|---------|----------|
| [@manifesto-ai/sdk](./sdk) | You want the activation-first base runtime |
| [@manifesto-ai/lineage](./lineage) | You need continuity, restore, branch/head history, or sealing |
| [@manifesto-ai/governance](./governance) | You need proposals, approval flow, decisions, and governance events |
| [@manifesto-ai/compiler](./compiler) | You need MEL compilation, lowering, or bundler adapters |
| [@manifesto-ai/codegen](./codegen) | You need schema-driven TypeScript or Zod generation |
| [@manifesto-ai/core](./core) | You need the pure computation layer |
| [@manifesto-ai/host](./host) | You need the low-level host orchestration layer |

## Tooling Overviews

| Package | Use When |
|---------|----------|
| [@manifesto-ai/cli](./cli) | You want project bootstrap, bundler integration, setup flows, or drift checks |
| [@manifesto-ai/mel-lsp](./mel-lsp) | You want MEL diagnostics, completion, navigation, rename, and schema introspection |
| [@manifesto-ai/skills](./skills) | You want current Manifesto guidance loaded into Codex or other AI tools |
| [@manifesto-ai/studio-cli](./studio-cli) | You want local read-only inspection from a terminal |
| [@manifesto-ai/studio-core](./studio-core) | You want projection-first analysis APIs in TypeScript tooling |
| [@manifesto-ai/studio-mcp](./studio-mcp) | You want an MCP inspection surface for agents or remote clients |

## Related Docs

- [Guide](/guide/introduction)
- [Quick Start](/guide/quick-start)
- [MEL Reference](/mel/)
- [Internals](/internals/)
