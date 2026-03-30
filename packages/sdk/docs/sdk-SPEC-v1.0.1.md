# Manifesto SDK Specification v1.0.1

> **Status:** Superseded Historical Contract
> **Scope:** Manifesto SDK Layer - Public Developer API
> **Compatible with:** Core SPEC v3.0.0, Host Contract v3.0.0, World Protocol v3.0.0, World Facade SPEC v1.0.0, Compiler SPEC v0.6.0
> **Supersedes:** SDK SPEC v1.0.0
> **Implements:** ADR-010, ADR-014 Phase 5
> **Authors:** Manifesto Team
> **License:** MIT
> **Historical Note:** This additive world-alignment contract is retained for migration history only. The current normative SDK contract now lives in [sdk-SPEC-v2.0.0.md](sdk-SPEC-v2.0.0.md).
> **Changelog:**
> - **v1.0.1 (2026-03-29):** Additive world/facade alignment
>   - Retains `createManifesto()` as the sole SDK-owned concept
>   - Adds additive re-exports for governed World composition
>   - Keeps legacy `createMemoryWorldStore()` and adds `createInMemoryWorldStore()`
>   - Documents the facade path as the canonical governed composition surface

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Normative Language](#2-normative-language)
3. [Scope & Non-Goals](#3-scope--non-goals)
4. [SDK Role](#4-sdk-role)
5. [createManifesto() Factory](#5-createmanifesto-factory)
6. [ManifestoInstance Interface](#6-manifestoinstance-interface)
7. [ManifestoConfig Interface](#7-manifestoconfig-interface)
8. [Event Channel](#8-event-channel)
9. [World Alignment](#9-world-alignment)
10. [Re-export Hub](#10-re-export-hub)
11. [Invariants](#11-invariants)
12. [Migration from v1.0.0](#12-migration-from-v100)
13. [References](#13-references)

---

## 1. Purpose

This document defines the Manifesto SDK Specification v1.0.1.

The SDK remains a thin composition layer. It owns exactly one concept, `createManifesto()`, and re-exports protocol types and factories from the owning packages.

This revision exists to align the SDK with the ADR-014 split:

- additive top-level `@manifesto-ai/world` exports are the canonical governed composition surface for callers who need World + Lineage + Governance
- the full split-native facade remains available at `@manifesto-ai/world/facade`
- `createManifesto()` does **not** implicitly assemble a governed world or change the default direct-dispatch SDK path

The SDK does not invent new orchestration concepts. It only aggregates protocol surfaces that already belong to Core, Host, World, Lineage, and Governance.

---

## 2. Normative Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are interpreted as described in RFC 2119.

---

## 3. Scope & Non-Goals

### 3.1 In Scope

| Area | Description |
|------|-------------|
| `createManifesto()` factory | Configuration, validation, protocol assembly |
| `ManifestoInstance` interface | dispatch, subscribe, on, getSnapshot, dispose |
| `ManifestoConfig` interface | SDK-owned configuration only |
| Event channel | Intent lifecycle telemetry |
| Re-export hub | Protocol-package types and factories |
| World alignment | Additive governed composition surface and compatibility docs |

### 3.2 Explicit Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Core computation internals | Core SPEC responsibility |
| Host execution internals | Host Contract responsibility |
| World governance rules | World Protocol and World Facade responsibilities |
| Lineage identity rules | Lineage SPEC responsibility |
| Managed SDK world assembly | Reserved for explicit World integration, not `createManifesto()` |
| React/Vue/framework bindings | Ecosystem packages |

---

## 4. SDK Role

`@manifesto-ai/sdk` owns exactly one concept: `createManifesto()`.

All other exports are pass-through re-exports from protocol packages. In this revision, the SDK MUST preserve the following roles:

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-ROLE-1 | MUST | SDK MUST own exactly one concept: `createManifesto()` |
| SDK-ROLE-2 | MUST NOT | SDK MUST NOT invent new binding-layer concepts |
| SDK-ROLE-3 | MUST | SDK MUST serve as a re-export hub for protocol package types and factories |
| SDK-ROLE-4 | MUST NOT | `createManifesto()` MUST NOT implicitly assemble a governed world |
| SDK-ROLE-5 | SHOULD | SDK SHOULD preserve additive compatibility for legacy and facade-adjacent World exports |

---

## 5. createManifesto() Factory

### 5.1 Signature

```typescript
function createManifesto<T>(config: ManifestoConfig<T>): ManifestoInstance<T>;
```

`createManifesto()` returns a ready-to-use instance. There is no `ready()` step or asynchronous initialization.

### 5.2 Factory Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-FACTORY-1 | MUST | `createManifesto()` MUST return a ready-to-use instance |
| SDK-FACTORY-2 | MUST | `createManifesto()` MUST inject `$host` and `$mel` platform namespaces into the schema |
| SDK-FACTORY-3 | MUST | `createManifesto()` MUST normalize the initial snapshot |
| SDK-FACTORY-4 | MUST | `createManifesto()` MUST reject user effects that override reserved effect types with `ReservedEffectError` |
| SDK-FACTORY-5 | MUST | `createManifesto()` MUST provide built-in effects for reserved system types |
| SDK-FACTORY-6 | MUST NOT | `createManifesto()` MUST NOT implicitly create or wire `@manifesto-ai/world/facade` |

---

## 6. ManifestoInstance Interface

```typescript
interface ManifestoInstance<T = unknown> {
  dispatch(intent: Intent): void;
  subscribe<R>(selector: Selector<T, R>, listener: (value: R) => void): Unsubscribe;
  on(event: ManifestoEvent, handler: (payload: ManifestoEventPayload) => void): Unsubscribe;
  getSnapshot(): Snapshot<T>;
  dispose(): void;
}
```

The `ManifestoInstance` contract is unchanged from v1.0.0.

---

## 7. ManifestoConfig Interface

The `ManifestoConfig` contract remains SDK-owned and focused on direct dispatch composition. It does not gain World facade orchestration fields in this revision.

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-CONFIG-1 | MUST | `ManifestoConfig` MUST remain compatible with direct dispatch composition |
| SDK-CONFIG-2 | MUST NOT | `ManifestoConfig` MUST NOT require governed world store or coordinator inputs |
| SDK-CONFIG-3 | MUST NOT | `createManifesto()` MUST NOT depend on `createWorld()` or `createInMemoryWorldStore()` |

---

## 8. Event Channel

The `ManifestoEvent` contract remains unchanged. `createManifesto()` continues to surface `dispatch:completed`, `dispatch:rejected`, and `dispatch:failed`.

---

## 9. World Alignment

### 9.1 Additive Top-Level World Surface

This SDK revision aligns with the additive top-level `@manifesto-ai/world` surface.

The SDK MUST re-export the following from `@manifesto-ai/world`:

- `WorldStore`
- `createMemoryWorldStore`
- `CommitCapableWorldStore`
- `WriteSet`
- `GovernanceEventDispatcher`
- `WorldCoordinator`
- `WorldConfig`
- `WorldInstance`
- `CoordinatorSealNextParams`
- `CoordinatorSealGenesisParams`
- `SealResult`
- `createWorld`
- `createInMemoryWorldStore`

### 9.2 Governance Integration Guidance

If a caller needs governed composition, the canonical path is:

```typescript
import {
  createInMemoryWorldStore,
  createWorld,
} from "@manifesto-ai/world";
```

The full split-native surface remains available at `@manifesto-ai/world/facade` for callers that want direct access to all governance and lineage symbols.

### 9.3 World Alignment Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SDK-REEXPORT-1 | MUST | SDK MUST re-export the additive top-level World surface listed in §9.1 |
| SDK-REEXPORT-2 | MUST | Legacy `WorldStore` and `createMemoryWorldStore()` MUST remain available |
| SDK-REEXPORT-3 | MUST | `createInMemoryWorldStore()` and `createWorld()` MUST be available through the SDK via the top-level World surface |
| SDK-REEXPORT-4 | MUST NOT | SDK MUST NOT silently switch `createManifesto()` to governed world composition |

---

## 10. Re-export Hub

The SDK continues to re-export protocol types from Core and Host. World re-exports are additive in v1.0.1 and remain pass-through.

---

## 11. Invariants

- `createManifesto()` remains the sole SDK-owned concept.
- Additive World exports do not replace the direct dispatch path.
- The SDK does not own World facade orchestration.
- Compatibility for `createMemoryWorldStore()` remains intact.

---

## 12. Migration from v1.0.0

If you need governed composition:

1. Keep using `createManifesto()` for direct dispatch-only SDK usage.
2. Use additive `@manifesto-ai/world` exports or `@manifesto-ai/world/facade` when you need explicit World orchestration.
3. Prefer `createInMemoryWorldStore()` + `createWorld()` for new governed composition code.
4. Keep `createMemoryWorldStore()` for legacy compatibility while migrating.

---

## 13. References

- [SDK SPEC v1.0.0](sdk-SPEC-v1.0.0.md)
- [World Facade SPEC v1.0.0](../../world/docs/world-facade-spec-v1.0.0.md)
- [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md)
