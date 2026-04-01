# Release Hardening

> Current release gate for the hard-cut next-major runtime.

This guide defines the minimum checks required before publishing the current hard-cut runtime surface. It is not a historical report. It is the tracked release gate for the current line.

## Release Gate

Run these commands from the monorepo root:

```bash
pnpm build
pnpm test
pnpm docs:release:check
```

For the one-shot gate, use:

```bash
pnpm test:hardening
```

## What The Test Gate Proves

The hardening gate is package-first. It exercises the current shipped packages instead of replaying a removed facade layer.

- `@manifesto-ai/sdk` base runtime tests and build
- `@manifesto-ai/lineage` continuity runtime tests and build
- `@manifesto-ai/governance` legitimacy runtime tests and build
- `@manifesto-ai/compiler` active package tests and build
- maintained docs checks and site build

Representative runtime scenarios:

- happy path: approved governed proposal seals and publishes
- rejection path: legitimacy constraints block publication
- base path: activation-first runtime still dispatches deterministically

## Known Limitations

- same-process duplicate execute exclusion is not implemented
- cross-process or distributed lease coordination is not implemented
- release-grade deep tracing and telemetry aggregation are not implemented
- aggregate reporting is Markdown-only; JSON and NDJSON exports are intentionally not part of the gate
- a new durable governed adapter package was not landed in this phase

## Perf And Observability Baseline

Phase F does not add new telemetry products. The minimum operator baseline is:

- release gate commands above stay green
- benchmark history remains informational only in [Performance Report](./performance-report)

If you need deeper operational tracing, treat that as follow-up work rather than part of the current release gate.
