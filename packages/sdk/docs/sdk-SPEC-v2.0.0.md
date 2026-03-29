# Manifesto SDK Specification v2.0.0

> **Status:** Normative
> **Scope:** Manifesto SDK Layer - Public Developer API
> **Compatible with:** Core SPEC v3.0.0, Host Contract v3.0.0, World Facade SPEC v1.0.0, Compiler SPEC v0.7.0
> **Supersedes:** SDK SPEC v1.0.1
> **Implements:** ADR-010, ADR-014, Phase 6 hard cut

## 1. Purpose

This document defines the SDK contract after the World super hard cut.

The SDK remains a thin composition layer. It owns exactly one concept, `createManifesto()`, and re-exports only a narrow governed World surface for callers that need explicit governance + lineage composition.

## 2. Scope

### In Scope

- `createManifesto()`
- `ManifestoInstance`
- `ManifestoConfig`
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
| SDK-FACTORY-3 | MUST | SDK MUST normalize the initial snapshot |
| SDK-FACTORY-4 | MUST NOT | SDK MUST NOT require governed world inputs in `ManifestoConfig` |
| SDK-FACTORY-5 | MUST NOT | SDK MUST NOT call `createWorld()` or `createInMemoryWorldStore()` as part of default dispatch composition |

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

## 8. Migration

If you need governed composition:

1. Keep using `createManifesto()` for direct dispatch.
2. Use SDK thin world re-exports for `createWorld()` and `createInMemoryWorldStore()`.
3. Import from `@manifesto-ai/world` directly when you need `createGovernanceService()`, `createLineageService()`, or proposal lifecycle types.

## 9. References

- [SDK SPEC v1.0.1](sdk-SPEC-v1.0.1.md)
- [World Facade SPEC v1.0.0](../../world/docs/world-facade-spec-v1.0.0.md)
- [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md)
