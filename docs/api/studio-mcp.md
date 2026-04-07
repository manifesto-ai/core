# @manifesto-ai/studio-mcp

> MCP server surface for `@manifesto-ai/studio-core`.

## Overview

`@manifesto-ai/studio-mcp` exposes Studio analysis through MCP tools and resources.

Use it when you want an agent or remote client to inspect a Manifesto domain through tool calls instead of importing Studio APIs directly.

## Install

```bash
npm install -D @manifesto-ai/studio-mcp
```

Run a local stdio server:

```bash
npx @manifesto-ai/studio-mcp --transport stdio --mel path/to/domain.mel
```

Run an HTTP server:

```bash
npx @manifesto-ai/studio-mcp --transport http --host 0.0.0.0 --port 8787 --endpoint /mcp --mel path/to/domain.mel
```

Put HTTPS in front of the HTTP transport when a remote connector product requires a public endpoint.

## Startup Context

At startup the server can establish default context with:

- `--bundle <file>`
- `--schema <file>`
- `--mel <file>`
- `--snapshot <file>`
- `--trace <file>`
- `--lineage <file>`
- `--governance <file>`
- `--validation-mode <lenient|strict>`
- `--lineage-stale-ms <number>`
- `--governance-proposal-stale-ms <number>`

That default context is reused for later tool calls unless a request provides overrides.

## Tool Surface

The current tool set is:

- `get_domain_graph`
- `find_issues`
- `explain_action_blocker`
- `get_action_availability`
- `analyze_trace`
- `get_lineage_state`
- `get_governance_state`

Per-request overrides can replace startup defaults with file paths or inline payloads for schema, snapshot, trace, lineage, and governance.

## Resource Surface

The server also exposes context-derived resources:

- `studio://domain/graph`
- `studio://domain/findings`
- `studio://domain/schema`

If the server starts without a default schema, those resources return an error payload explaining that the caller needs `--bundle`, `--schema`, or `--mel`.

## When To Use It

Use `studio-mcp` when:

- one MCP session is focused on one domain and its overlays
- an agent needs read-only graph, findings, coarse availability, or action-blocker tools
- you want the same inspection surface locally over stdio or remotely over HTTP

Use [`@manifesto-ai/studio-core`](./studio-core) directly when you are already inside TypeScript and do not need MCP transport.

## Related Docs

- [Developer Tooling Guide](/guides/developer-tooling)
- [AI Agents](/integration/ai-agents)
- [@manifesto-ai/studio-core](./studio-core)
