# SDK Version Index

> **Package:** `@manifesto-ai/sdk`
> **Last Updated:** 2026-04-29

## Current Contract

| Version | Document | ADR | Notes | Status |
|---------|----------|-----|-------|--------|
| v5.x | [SPEC](sdk-SPEC.md) | [ADR-025](../../../docs/internals/adr/025-snapshot-ontology-hard-cut-data-retirement-and-namespace-separation.md), [ADR-026](../../../docs/internals/adr/026-sdk-v5-action-candidate-surface-and-law-aware-submit-ingress.md) | Action-candidate runtime surface with `snapshot()`, `actions.*`, `action(name)`, `observe.*`, `inspect.*`, and law-aware `submit()`. Canonical v3 root APIs are removed from the v5 public surface; no `compat-v4` subpath is part of the current contract. | Current |

## Superseded Contract

| Version | Document | ADR | Notes | Status |
|---------|----------|-----|-------|--------|
| v3.x | Git history / superseded SPEC revisions | [ADR-017](../../../docs/internals/adr/017-capability-decorator-pattern.md), [ADR-019](../../../docs/internals/adr/019-post-activation-extension-kernel.md), [ADR-020](../../../docs/internals/adr/020-intent-level-dispatchability.md) | Activation-first SDK with typed `createIntent()`, `dispatchAsync*`, `simulate*`, `subscribe`, `on`, projected `SchemaGraph`, and extension-kernel helpers. These names are historical migration inputs, not v5 compatibility targets. | Superseded |

## Accepted Rationale Companion

| Version | Document | Related ADR | Notes | Status |
|---------|----------|-------------|-------|--------|
| v3.1.0 | [FDR](FDR-v3.1.0.md) | [ADR-015](../../../docs/internals/adr/015-snapshot-ontological-purification.md) | Rationale companion for the v3.1.0 introspection surface: `SchemaGraph` (`feeds` / `mutates` / `unlocks`) and full-transition `simulate()`. Its current v5 successor lives under `inspect.graph()` and `actions.x.preview()`. | Historical |

The companion compiler contract now lives in
[../../compiler/docs/SPEC-v1.1.0.md](../../compiler/docs/SPEC-v1.1.0.md).
Historical addenda remain available in
[../../compiler/docs/SPEC-v0.8.0.md](../../compiler/docs/SPEC-v0.8.0.md) and
[../../compiler/docs/SPEC-v0.9.0.md](../../compiler/docs/SPEC-v0.9.0.md).

## Reading Order

1. Read [sdk-SPEC.md](sdk-SPEC.md) for the current SDK v5 living contract.
2. Read [ADR-026](../../../docs/internals/adr/026-sdk-v5-action-candidate-surface-and-law-aware-submit-ingress.md) for the action-candidate ladder and law-aware `submit()` rationale.
3. Read [ADR-025](../../../docs/internals/adr/025-snapshot-ontology-hard-cut-data-retirement-and-namespace-separation.md) for the v5 snapshot ontology that makes `snapshot.state` and `snapshot.namespaces` distinct.
4. If you are updating Lineage or Governance, read their package SPECs after this SDK SPEC; those packages own mode-specific settlement semantics.
5. If you are updating arbitrary-snapshot tooling, read [ADR-019](../../../docs/internals/adr/019-post-activation-extension-kernel.md) and the extension-kernel section in [sdk-SPEC.md](sdk-SPEC.md).

## Historical Note

Superseded SDK v0-v3 spec files and v3 living-document revisions are not active
package docs. If you need archaeology, use `git log -- packages/sdk/docs` or
GitHub history instead of treating old surfaces as current contract.
