# SDK Version Index

> **Package:** `@manifesto-ai/sdk`
> **Last Updated:** 2026-04-08

## Current Contract

| Version | Document | ADR | Notes | Status |
|---------|----------|-----|-------|--------|
| v3.5.0 | [SPEC](sdk-SPEC.md) | [ADR-017](../../../docs/internals/adr/017-capability-decorator-pattern.md), [ADR-019](../../../docs/internals/adr/019-post-activation-extension-kernel.md), [ADR-020](../../../docs/internals/adr/020-intent-level-dispatchability.md) | Activation-first SDK with `activate()`, typed `createIntent()` including non-ambiguous single-parameter object binding, dequeue-time rejection codes for coarse vs fine legality, current-snapshot blocker explanations, projected `SchemaGraph`, `simulate()`, the `@manifesto-ai/sdk/extensions` Extension Kernel including arbitrary-snapshot `isIntentDispatchableFor()`, the first-party `createSimulationSession()` helper, and the public provider authoring seam | Current |

## Draft Rationale Track

| Version | Document | Related ADR | Notes | Status |
|---------|----------|-------------|-------|--------|
| v3.1.0 | [FDR](FDR-v3.1.0-draft.md) | [ADR-015](../../../docs/internals/adr/015-snapshot-ontological-purification.md) | Rationale companion for the current v3.1.0 introspection surface: `SchemaGraph` (`feeds` / `mutates` / `unlocks`) and full-transition `simulate()` | Draft |

The companion compiler contract now lives in [../../compiler/docs/SPEC-v1.0.0.md](../../compiler/docs/SPEC-v1.0.0.md). Historical addenda remain available in [../../compiler/docs/SPEC-v0.8.0.md](../../compiler/docs/SPEC-v0.8.0.md) and [../../compiler/docs/SPEC-v0.9.0.md](../../compiler/docs/SPEC-v0.9.0.md).

## Reading Order

1. Read [../README.md](../README.md) for package entrypoint guidance.
2. Read [GUIDE.md](GUIDE.md) for current usage and decorator/provider authoring boundaries.
3. Read [sdk-SPEC.md](sdk-SPEC.md) for the current living SDK contract.
4. If you are studying the current introspection surface, read [sdk-SPEC.md](sdk-SPEC.md) §5.5 and §7.4-§7.5, then [../../compiler/docs/SPEC-v1.0.0.md](../../compiler/docs/SPEC-v1.0.0.md), then [FDR-v3.1.0-draft.md](FDR-v3.1.0-draft.md).
5. If you are building helper/tooling work against arbitrary snapshots, read [ADR-019](../../../docs/internals/adr/019-post-activation-extension-kernel.md) and [sdk-SPEC.md](sdk-SPEC.md) §7.10 + §8. This is the canonical home for post-activation branching helpers and simulation-session work.
6. If you need input-aware legality checks, read [ADR-020](../../../docs/internals/adr/020-intent-level-dispatchability.md), [sdk-SPEC.md](sdk-SPEC.md) §7.2-§7.5, and [../../compiler/docs/SPEC-v1.0.0.md](../../compiler/docs/SPEC-v1.0.0.md).

## Historical Note

Superseded SDK v0-v2 spec files were removed from the working tree. If you need pre-activation archaeology, use `git log -- packages/sdk/docs` or GitHub history instead of treating those old files as active package docs.
