# Developer Tooling

> Bootstrap projects, wire editors, give agents current Manifesto context, and inspect the same schema through read-only Studio projections.

Manifesto's current DX stack is intentionally split into a small set of packages around the runtime.

| Need | Package | What It Gives You |
|------|---------|-------------------|
| Start or retrofit a repo | [@manifesto-ai/cli](/api/cli) | `init`, `integrate`, `setup`, `doctor`, `scaffold` |
| Author MEL with editor support | [@manifesto-ai/mel-lsp](/api/mel-lsp) | diagnostics, completion, hover, rename, references, schema introspection |
| Load Manifesto guidance into AI tools | [@manifesto-ai/skills](/api/skills) | explicit installers for Codex, Claude Code, Cursor, Copilot, and Windsurf |
| Inspect a schema from the terminal | [@manifesto-ai/studio-cli](/api/studio-cli) | findings, graph, snapshot, trace, lineage, governance, transition graphs |
| Build dashboards or agent endpoints | [@manifesto-ai/studio-core](/api/studio-core), [@manifesto-ai/studio-mcp](/api/studio-mcp) | stable JSON projections and MCP transport |

## Recommended Flow

1. Use [@manifesto-ai/cli](/api/cli) to declare runtime and tooling intent in `manifesto.config.*`.
2. Run [@manifesto-ai/mel-lsp](/api/mel-lsp) in the editor so MEL authoring stays schema-aware.
3. Install [@manifesto-ai/skills](/api/skills) only for the AI tools your team actually uses.
4. Reach for [@manifesto-ai/studio-cli](/api/studio-cli) locally and [@manifesto-ai/studio-mcp](/api/studio-mcp) when an agent or remote client needs read-only inspection tools.

## Typical Workflows

### Bootstrap a New App

```bash
manifesto init --runtime base --integration vite --codegen wire --skills codex
manifesto doctor
```

That flow installs the runtime packages, patches the selected integration surface, writes `manifesto.config.*`, and validates that declared intent still matches the repo.

Switch `--runtime` to `lineage` or `gov` only when the project already needs approval, continuity, or sealed history.

### Give an AI Tool Current Manifesto Context

```bash
pnpm add -D @manifesto-ai/skills
pnpm exec manifesto-skills install-codex
```

If you prefer to stay inside the CLI flow, `manifesto setup skills codex` can drive the Codex setup path from the repo configuration.

### Inspect a Domain Locally

```bash
studio-cli analyze path/to/domain.mel
studio-cli snapshot path/to/domain.mel --snapshot path/to/canonical-snapshot.json
studio-cli governance path/to/domain.mel --governance path/to/governance.json
```

Use this path when one developer or CI job wants findings, action availability, snapshot inspection, trace replay, lineage state, or governance state without building a custom UI.

### Expose Inspection Tools to an Agent

```bash
studio-mcp --transport stdio --mel path/to/domain.mel
```

Switch to HTTP transport when the client cannot spawn a local subprocess:

```bash
studio-mcp --transport http --host 0.0.0.0 --port 8787 --endpoint /mcp --mel path/to/domain.mel
```

Put HTTPS in front of the HTTP transport when a remote connector product needs a public MCP endpoint.

## Important Boundaries

- Studio snapshot inspection expects canonical snapshots from `runtime.getCanonicalSnapshot()`, not the projected result of `getSnapshot()`.
- `@manifesto-ai/skills` does not auto-install from `postinstall`; setup is always explicit.
- `@manifesto-ai/studio-core` is read-only and renderer-neutral. It analyzes a bundle and returns JSON projections; it does not execute effects or mutate runtime state.

If the project later needs reviewable writes or sealed history, step out of the tooling track and read [When You Need Approval or History](/guides/approval-and-history) first.

## See Also

- [Quick Start](/guide/quick-start)
- [AI Agents](/integration/ai-agents)
- [When You Need Approval or History](/guides/approval-and-history)
- [Bundler Setup](/guides/bundler-setup)
- [API Reference](/api/)
