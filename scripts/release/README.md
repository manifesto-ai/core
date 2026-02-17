# Release Deprecation Procedure (`@manifesto-ai/app`)

This note documents npm deprecation workflow for the App compatibility-to-retirement transition.

## Preconditions

- `@manifesto-ai/sdk` release is published and validated.
- Migration guide is available: `docs/guides/migrate-app-to-sdk.md`.
- ADR-008 is merged.

## Deprecate Legacy Package

```bash
npm deprecate @manifesto-ai/app "Deprecated compatibility package. Use @manifesto-ai/sdk as canonical public entrypoint. See https://docs.manifesto-ai.dev/guides/migrate-app-to-sdk"
```

For targeted ranges (optional):

```bash
npm deprecate @manifesto-ai/app@"<=2.x" "Deprecated compatibility package. Use @manifesto-ai/sdk."
```

## Verify

```bash
npm view @manifesto-ai/app deprecated
```

## Communication Checklist

- Add release note entry in changelog/release PR.
- Post migration notice in docs and package README.
- Keep legacy API page (`docs/api/app.md`) as historical reference.

## Phase 2 Closeout Checklist

Use this checklist when preparing final closeout for the SDK-first transition.

### 1) Decide Release Shape

Choose one track before merge:

- **Track A (Strict plan):** Keep **R1** (SDK-first + app deprecation) and **R2** (app removal) in separate releases.
- **Track B (Combined):** Ship R1+R2 together in one release.

Recommended default is **Track A** to match ADR-008 release cadence.

### 2) Validation Gate

Run all checks before release:

```bash
pnpm docs:build
pnpm --filter @manifesto-ai/example-todo-react build
pnpm build
pnpm test
```

Expected outcome:

- VitePress docs build succeeds.
- Example build succeeds with `@manifesto-ai/sdk`.
- Workspace build/tests succeed with SDK/Runtime as first-class paths and App compatibility package present.

Track A additional requirement:

- Before R2 removal, run one compatibility smoke test with an app-consumer setup while `packages/app` still exists.

### 3) Release Notes Gate

Confirm release note message includes:

- `@manifesto-ai/sdk@1.0.0` as canonical public entrypoint.
- `@manifesto-ai/app` deprecated compatibility status (R1) and R2 removal schedule.
- Migration guide link: `docs/guides/migrate-app-to-sdk.md`.

### 4) npm Deprecation Gate

Run deprecate command after publish:

```bash
npm deprecate @manifesto-ai/app "Deprecated compatibility package. Use @manifesto-ai/sdk as canonical public entrypoint. See https://docs.manifesto-ai.dev/guides/migrate-app-to-sdk"
npm view @manifesto-ai/app deprecated
```

### 5) Post-release Guard Gate

Prepare R2 guard activation:

- Add `scripts/check-no-app-imports.mjs`
- Add workflow step in `.github/workflows/ci.yml`

Enable this gate in R2 to prevent accidental reintroduction of `@manifesto-ai/app` imports in active paths.
