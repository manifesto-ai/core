# Release Hardening

> Current release gate for the hard-cut next-major runtime.

This guide defines the minimum checks required before publishing the current hard-cut runtime surface. It is not a historical report. It is the tracked release gate for the current line.

## Release PR Model

Release Please runs in workspace mode for this monorepo. Active runtime packages are not released as unrelated per-package PRs.

- `@manifesto-ai/core`, `@manifesto-ai/host`, `@manifesto-ai/sdk`, `@manifesto-ai/lineage`, and `@manifesto-ai/governance` form the linked runtime stack.
- `@manifesto-ai/compiler` and `@manifesto-ai/codegen` form the linked tooling stack.
- `@manifesto-ai/skills` remains independent from the runtime and tooling release trains.
- Changes touching any package in a linked train must be reviewed and merged as a single release train when Release Please proposes them together.
- Internal workspace dependency updates are handled by the `node-workspace` and `linked-versions` plugins. Do not work around version skew in consumer apps with package-manager overrides unless you are diagnosing a broken publish.
- Manual publish is for recovery only. Normal releases should flow through the grouped Release Please PR and the publish workflow.
- Release Please computes release candidates from conventional commit messages. Use `feat:`, `fix:`, `deps:`, `perf:`, or `revert:` for release-bearing changes. `docs:`, `chore:`, `refactor:`, `test:`, `build:`, and `ci:` changes may pass CI but do not, by themselves, create a release PR.
- Backfill is for merged release PR recovery only. `workflow_dispatch backfill=true` can recreate missing tags or GitHub releases, but it cannot create a release PR that was never opened.

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

For commit-message diagnosis before opening a PR, use:

```bash
node scripts/check-commit-messages.mjs origin/main HEAD
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
- benchmark history is available in git history

If you need deeper operational tracing, treat that as follow-up work rather than part of the current release gate.
