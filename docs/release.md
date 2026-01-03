# Release Operations

This repository uses Release Please to manage version bumps, tags, GitHub releases,
and npm publishing for the pnpm monorepo.

## Normal Release Flow

1. Merge conventional-commit PRs into `main`.
2. Release Please opens release PRs per package.
3. Merge the release PR(s).
4. Release Please creates tags and GitHub releases.
5. The publish job releases only the updated packages to npm.

Release PR titles follow:

```
chore: release <component> <version>
```

Tag format (from config):

```
@manifesto-ai/<package>-v<version>
```

## Required Secrets

- `NPM_TOKEN`: npm publish token with access to `@manifesto-ai/*`.
- `RELEASE_PLEASE_TOKEN` (optional): PAT used when `GITHUB_TOKEN` cannot create PRs.

Minimal PAT scopes (fine-grained):
- Contents: read/write
- Pull requests: read/write
- Metadata: read

For classic PAT, `repo` is sufficient.

## Recovery: Release Please Blocked by Untagged Release PRs

If the workflow logs:
`There are untagged, merged release PRs outstanding - aborting`

1. Run the **Release** workflow manually with `backfill=true`.
2. Confirm tags and GitHub releases were created.
3. Re-run the Release workflow or merge a new PR to resume normal flow.

## Consistency Checklist

Use this checklist to verify repo state when releases are stuck:

- `.release-please-manifest.json` versions match each `packages/*/package.json`.
- Tags exist for every package/version in the manifest.
  - Example: `git tag -l '@manifesto-ai/*-v1.1.0'`
- GitHub Releases exist for the same tags.
- npm shows the same version for each package (example):
  - `npm view @manifesto-ai/core version`

## Merge Strategy

Merge commits can trigger non-fatal conventional-commit warnings in logs.
Prefer **squash merge** with a conventional PR title to keep logs clean.
