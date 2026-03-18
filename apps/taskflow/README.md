# TaskFlow UI Shell

`apps/taskflow` is no longer the old Intent-Native demo app.
It is now a cleaned shell prepared for a fresh rebuild on top of `@manifesto-ai/sdk`.

## Current Status

- Preserved:
  - `src/components/views/*`
  - `src/components/shared/*`
  - `src/components/sidebar/*`
  - `src/components/assistant/*`
  - `src/components/ui/*`
  - theme, motion, layout, global styles, responsive hooks
- Removed:
  - Zustand store and provider
  - legacy domain/runtime bridge
  - storage layer
  - agent runtimes and agent API routes
  - old assistant execution flow

The app currently renders from local fixture data only. This is intentional.

## Source Of Truth For The Rebuild

- [FRICTION.md](./FRICTION.md)
- [docs/SDK-REBUILD-WORKING.md](./docs/SDK-REBUILD-WORKING.md)
- [docs/UI-CONTRACT.md](./docs/UI-CONTRACT.md)

Historical files under `docs/` that describe the previous architecture should be treated as archive material, not current implementation guidance.

## Local Commands

```bash
pnpm -C apps/taskflow dev
pnpm -C apps/taskflow typecheck
pnpm -C apps/taskflow lint
```

## Rebuild Direction

Target architecture:

```text
taskflow.mel
  -> @manifesto-ai/compiler
  -> createManifesto({ schema, effects })
  -> React UI + AI agent on the same Intent protocol
```

Practical baseline decisions for this repo:

- Keep the current Next.js / React baseline already in the workspace.
- Reintroduce `@manifesto-ai/sdk` and `@manifesto-ai/compiler` as workspace dependencies during Phase 1.
- Record friction as it happens. Do not postpone it.
