# Governed Minimal Node Example

Minimal Node-local governed bootstrap for `@manifesto-ai/world`.

## What It Shows

- SQLite-backed `GovernedWorldStore`
- explicit lineage + governance + world assembly
- proposal approval to `executing`
- `world.runtime.executeApprovedProposal()` happy path
- sealed world lookup after commit

## Run

```bash
pnpm --filter @manifesto-ai/world build
pnpm --filter @manifesto-ai/example-governed-minimal-node demo
```

By default the demo writes to a temporary SQLite file. Set `MANIFESTO_SQLITE_FILE` if you want a stable local path.
