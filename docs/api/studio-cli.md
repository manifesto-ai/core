# @manifesto-ai/studio-cli

> Terminal inspection surface for `@manifesto-ai/studio-core`.

## Overview

`@manifesto-ai/studio-cli` compiles or loads a schema, attaches optional overlays, and renders Studio projections in a shell-friendly form.

Use it when you want to inspect one domain from:

- a local terminal
- a shell script
- CI
- a lightweight debugging workflow without building a custom UI

## Install

```bash
npm install -D @manifesto-ai/studio-cli
```

Run without installing globally:

```bash
npx @manifesto-ai/studio-cli --help
```

## Command Surface

| Command | Purpose |
|---------|---------|
| `studio-cli analyze` | Run findings analysis |
| `studio-cli check` | Alias of findings analysis |
| `studio-cli graph` | Return the semantic domain graph |
| `studio-cli explain` | Explain why an action is blocked |
| `studio-cli trace` | Return trace replay analysis |
| `studio-cli availability` | Return action availability from the current canonical snapshot |
| `studio-cli snapshot` | Inspect a canonical snapshot |
| `studio-cli lineage` | Return lineage state |
| `studio-cli governance` | Return governance state |
| `studio-cli transition-graph` | Project observation records into a transition graph |

## Common Inputs

The CLI can start from:

- `--bundle <file>`: analysis bundle JSON
- `--schema <file>`: `DomainSchema` JSON
- `--mel <file>`: MEL file compiled at startup
- `--snapshot <file>`: canonical snapshot JSON
- `--trace <file>`: trace graph JSON
- `--lineage <file>`: lineage export JSON
- `--governance <file>`: governance export JSON
- `--observations <file>` and `--preset <file>` for `transition-graph`

Outputs are `text` or `json`.

## Examples

```bash
studio-cli analyze path/to/domain.mel
studio-cli graph path/to/domain.mel --format full --output json
studio-cli snapshot path/to/domain.mel --snapshot path/to/canonical-snapshot.json
studio-cli trace path/to/trace.json --schema path/to/schema.json
studio-cli transition-graph --observations path/to/observations.json --preset path/to/projection-preset.json
```

## Important Notes

- Snapshot inspection expects canonical snapshots from `runtime.getCanonicalSnapshot()`.
- `transition-graph` requires explicit observations and a projection preset unless `--bundle` already contains both.
- The CLI is thin by design. It delegates bundle loading to `@manifesto-ai/studio-node` and analysis to `@manifesto-ai/studio-core`.

## Relationship To Other Packages

- Use [`@manifesto-ai/studio-core`](./studio-core) when you want the same analysis surface inside an app or service.
- Use [`@manifesto-ai/studio-mcp`](./studio-mcp) when a tool-host or agent should call the same surface through MCP.

## Related Docs

- [Developer Tooling Guide](/guides/developer-tooling)
- [Debugging](/guides/debugging)
- [@manifesto-ai/studio-core](./studio-core)
