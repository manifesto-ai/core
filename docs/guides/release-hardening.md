# Release Hardening

> Current release gate for the hard-cut next-major runtime.

This guide defines the minimum checks required before publishing the current governed runtime surface. It is not a historical report. It is the tracked release gate for the current hard-cut line.

## Release Gate

Run these commands from the monorepo root:

```bash
pnpm build
pnpm test:e2e:world
pnpm docs:release:check
```

For the one-shot gate, use:

```bash
pnpm test:hardening
```

## What `test:e2e:world` Proves

The hardening gate is intentionally `world-first`. It exercises the current release path instead of trying to replay every package test a second time.

- `@manifesto-ai/world` bootstrap/runtime/persistence smoke for the current governed surface
- `@manifesto-ai/compiler` full pipeline integration against the governed path
- `@manifesto-ai/sdk` thin public-surface smoke
- `examples/governed-minimal-node` build and demo run

Representative runtime scenarios:

- happy path: an approved executing proposal seals a terminal completed world
- recovery path: replay or restart converges to `recovered` without duplicate event emission

## Durable Adapter Status

Current durable adapters on the async `GovernedWorldStore` seam:

| Adapter | Status | Primary Use |
| --- | --- | --- |
| `createInMemoryWorldStore()` | Reference adapter | tests, ephemeral local composition |
| `createSqliteWorldStore()` | Local reference durable adapter | Node-local apps, release smoke, developer workflows |
| `createIndexedDbWorldStore()` | Browser-first durable adapter | browser persistence |

The release gate uses SQLite for the canonical Node-local consumer story.

## Known Limitations

- same-process duplicate execute exclusion is not implemented
- cross-process or distributed lease coordination is not implemented
- release-grade deep tracing and telemetry aggregation are not implemented
- aggregate reporting is Markdown-only; JSON and NDJSON exports are intentionally not part of the gate
- SQLite is the Node-local durable reference adapter, not the browser canonical backend

## Perf And Observability Baseline

Phase F does not add new telemetry products. The minimum operator baseline is:

- release gate commands above stay green
- governed example still runs end-to-end
- benchmark history remains informational only in [Performance Report](./performance-report)

If you need deeper operational tracing, treat that as follow-up work rather than part of the current release gate.
