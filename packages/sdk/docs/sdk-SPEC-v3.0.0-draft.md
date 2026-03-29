# Manifesto SDK Specification v3.0.0 Draft

> **Status:** Draft (Projected next major)
> **Scope:** Manifesto SDK Layer - Public Developer API
> **Compatible with:** Core SPEC v4.0.0 draft, Host Contract v4.0.0 draft, World Facade SPEC v2.0.0 draft, Compiler SPEC v0.7.0
> **Supersedes:** SDK SPEC v2.0.0
> **Implements:** ADR-010, ADR-014, ADR-015, ADR-016 (projected epoch)

> **Draft Note:** This file captures the projected SDK v3.0.0 rewrite aligned to ADR-015 and ADR-016. The current normative package contract remains [sdk-SPEC-v2.0.0.md](sdk-SPEC-v2.0.0.md) until the shared epoch boundary lands.

## 1. Purpose

This document defines the projected SDK contract for the ADR-015 + ADR-016 epoch boundary.

The SDK remains a thin composition layer. It owns exactly one concept, `createManifesto()`, and re-exports only a narrow governed World surface for callers that need explicit governance + lineage composition.

The breaking change in this draft is not governed seal orchestration. It is the SDK's own public `Snapshot<T>` surface: the SDK transparently follows Core v4's removal of accumulated `system.errors` history.

## 2. Scope

### In Scope

- `createManifesto()`
- `ManifestoInstance`
- `ManifestoConfig`
- public `Snapshot<T>` overlay and every SDK API that exposes it
- `dispatchAsync()`
- `defineOps()`
- selected re-exports from Core, Host, and World

### Out of Scope

- governance lifecycle semantics
- lineage identity rules
- full World facade surface
- implicit governed assembly inside `createManifesto()`

## 3. SDK Role

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ROLE-1 | MUST | SDK MUST own exactly one concept: `createManifesto()` |
| SDK-ROLE-2 | MUST NOT | SDK MUST NOT invent new orchestration concepts |
| SDK-ROLE-3 | MUST | SDK MUST remain a thin re-export hub |
| SDK-ROLE-4 | MUST NOT | `createManifesto()` MUST NOT implicitly assemble governed World composition |

## 4. createManifesto()

`createManifesto()` remains a ready-to-use direct-dispatch factory.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-FACTORY-1 | MUST | `createManifesto()` MUST return a ready-to-use instance |
| SDK-FACTORY-2 | MUST | SDK MUST inject reserved platform namespaces |
| SDK-FACTORY-3 | MUST | SDK MUST normalize the initial snapshot without reintroducing removed Core fields |
| SDK-FACTORY-4 | MUST NOT | SDK MUST NOT require governed world inputs in `ManifestoConfig` |
| SDK-FACTORY-5 | MUST NOT | SDK MUST NOT call `createWorld()` or `createInMemoryWorldStore()` as part of default dispatch composition |
| SDK-FACTORY-6 | MUST | When given a restore-normalized snapshot, SDK MUST treat it as boundary-ready input and MUST NOT attempt to restore deprecated accumulated error-history fields |

### 4.1 Public Snapshot Surface

In the projected Core v4 contract, `Snapshot.system` no longer contains accumulated `errors`. SDK follows the Core Snapshot shape exactly instead of emulating compatibility fields.

The following SDK surfaces transitively expose `Snapshot<T>` and therefore inherit the Core v4 shape:

- `ManifestoConfig.snapshot`
- `ManifestoInstance.getSnapshot()`
- `dispatch:completed` event payload `snapshot`
- `guard(intent, snapshot)`
- `subscribe(selector)` selector input

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-SNAPTYPE-1 | MUST | SDK `Snapshot<T>` MUST remain a transparent generic overlay on the current Core `Snapshot` type |
| SDK-SNAPTYPE-2 | MUST NOT | SDK MUST NOT reintroduce removed accumulated error-history fields such as `system.errors` |
| SDK-SNAPTYPE-3 | MUST | `ManifestoConfig.snapshot`, `ManifestoInstance.getSnapshot()`, and `dispatch:completed.snapshot` MUST transitively follow the Core v4 `Snapshot` shape |
| SDK-SNAPTYPE-4 | MUST | `guard()` and `subscribe()` selector inputs MUST transitively follow the Core v4 `Snapshot` shape |

## 5. World Re-export Surface

SDK MUST re-export exactly the thin governed World surface below:

- `createWorld`
- `createInMemoryWorldStore`
- `CommitCapableWorldStore`
- `GovernanceEventDispatcher`
- `WorldCoordinator`
- `WorldConfig`
- `WorldInstance`
- `CoordinatorSealNextParams`
- `CoordinatorSealGenesisParams`
- `SealResult`
- `WriteSet`

SDK MUST NOT re-export:

- the legacy store contract
- the legacy in-memory store factory
- the full split-native governance and lineage APIs

## 6. World Alignment Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-WORLD-1 | MUST | SDK MUST source governed world re-exports from top-level `@manifesto-ai/world` |
| SDK-WORLD-2 | MUST | SDK MUST expose `createWorld()` and `createInMemoryWorldStore()` |
| SDK-WORLD-3 | MUST NOT | SDK MUST NOT expose legacy World store factories after the hard cut |
| SDK-WORLD-4 | MUST NOT | SDK MUST NOT expose the full split-native facade through SDK |

## 7. Invariants

- `createManifesto()` remains the sole SDK-owned factory.
- Governed composition remains explicit.
- SDK stays thin even though top-level `@manifesto-ai/world` is now the exact facade surface.
- SDK `Snapshot<T>` remains a transparent overlay on Core and does not restore removed `system.errors` history.

## 8. Migration

If you need governed composition:

1. Keep using `createManifesto()` for direct dispatch.
2. Use SDK thin world re-exports for `createWorld()` and `createInMemoryWorldStore()`.
3. Replace any `snapshot.system.errors` reads with `snapshot.system.lastError` or domain-owned history/telemetry.
4. Import from `@manifesto-ai/world` directly when you need `createGovernanceService()`, `createLineageService()`, or proposal lifecycle types.

## 9. References

- [SDK SPEC v2.0.0](sdk-SPEC-v2.0.0.md)
- [Core SPEC v4.0.0 draft](../../core/docs/core-SPEC-v4.0.0-draft.md)
- [Host Contract v4.0.0 draft](../../host/docs/host-SPEC-v4.0.0-draft.md)
- [World Facade SPEC v2.0.0 draft](../../world/docs/world-facade-spec-v2.0.0.md)
- [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md)
- [ADR-015](../../../docs/internals/adr/015-snapshot-ontological-purification.md)
- [ADR-016](../../../docs/internals/adr/016-merkle-tree-lineage.md)
