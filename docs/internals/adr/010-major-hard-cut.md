# ADR-010: Manifesto Runtime/App Hard-Cut and Public Surface Simplification

> **Status:** Proposed
> **Date:** 2026-02-25
> **Deciders:** Manifesto Architecture Team
> **Scope:** Core, Runtime, Host, World, SDK
> **Resolves:** [#108](https://github.com/manifesto-ai/core/issues/108), [#189](https://github.com/manifesto-ai/core/issues/189), [#187](https://github.com/manifesto-ai/core/issues/187), [#198](https://github.com/manifesto-ai/core/issues/198), [#201](https://github.com/manifesto-ai/core/issues/201), [#202](https://github.com/manifesto-ai/core/issues/202)
> **Supersedes:** ADR-009 (implementation pathway to be executed after hard-cut)
> **Breaking:** Yes — major version bump required for public packages

## 1. Context

The current stack still carries App-shaped abstractions that were originally part of a richer internal system (hooks, lifecycle, world bootstrap, low-level executors). After moving to hard-cut posture, this layering is now too broad:

- `SDK` still acts as mostly public API while re-exporting many internal `runtime` symbols.
- `Runtime` still carries App-oriented objects and bootstrap wiring that should be private in a hard-cut system.
- `Translator` and `Intent IR` remain in product-critical paths even though roadmap now favors canonical `Core-Host-World` execution.

As a result, users cannot reason about one clear entrypoint. Public contracts are larger than intended, and compatibility behavior is difficult to prove by design.

## 2. Decision

We will execute a major hard-cut and define one high-level entrypoint stack:

- `@manifesto-ai/sdk`: high-level facade for developers.
- `@manifesto-ai/runtime`: execution kernel and orchestration primitives.
- `@manifesto-ai/core`, `@manifesto-ai/host`, `@manifesto-ai/world`: strict layer boundaries for pure compute, effect execution, and persistence/governance.

The API will move from an `App` noun to a runtime-oriented facade noun at public boundaries.

### 2.1 Single public factory

- Add/keep `createRuntime()` in `SDK`.
- `createRuntime(config)` returns a public `RuntimeHandle` facade.
- Public APIs are intentionally small and action-oriented:
  - `start()`
  - `dispatch(type, input, options)`
  - `subscribe(selector, listener, options)`
  - `snapshot()` and `getHeadSnapshot(worldId?)`
  - `close()` and `abort(actionId?)`
- `createApp`, `ManifestoApp`, and `App*` public aliases are removed from public exports.
- `ready()` is removed from canonical API.
- `ManifestoRuntime` is intentionally not used for the public handle name; `RuntimeHandle` is explicitly a façade contract, not the runtime core.
- Runtime internals (`@manifesto-ai/runtime`) remain non-user-facing in line with Runtime SPEC v0.1.0.

### 2.2 Runtime package becomes core execution boundary

- `@manifesto-ai/runtime` is reduced to orchestration essentials and does not expose app-layer abstractions.
- `AppRuntime`, `AppBootstrap`, `AppRef`, and related helper constructors move to internal/private exposure only.
- Public exports from runtime are limited to:
  - host creation/dispatching boundary
  - world read/write abstraction interfaces
  - scheduler/policy execution behavior needed by SDK
  - typed snapshot/error/state contracts consumed by SDK
- SDK may consume runtime internals in tests only when absolutely necessary via explicit internal entrypoints.

### 2.3 SDK is core+host+dx integration layer

- SDK owns the developer-facing assembly path: domain schema validation, compiler bootstrap, runtime construction, and runtime handle lifetime.
- SDK exposes only DX-friendly extensions (hooks/plugins, typed error helpers, convenience types).
- Internal integration points such as `manifesto plugin registry`, hook internals, and bootstrap debug details are hidden behind stable adapters.

### 2.4 Archive policy for legacy modules

- `Translator` and `Intent IR` are removed from runtime paths and build requirements.
- Their docs remain as historical references only, with no API import path from product packages.
- No runtime compatibility adapters are required for these modules.

### 2.5 Compatibility and versioning policy

- Hard-cut is declared as breaking for all affected packages:
  - `@manifesto-ai/sdk`: major bump
  - `@manifesto-ai/runtime`: major bump
  - `@manifesto-ai/world`: major bump if API surface intersects persisted runtime contracts
  - `@manifesto-ai/core`, `@manifesto-ai/host`: major bump if runtime contract types change
- No backward-compatibility scaffolding is preserved in production code.
- Legacy public symbol aliases may exist only in a temporary `x-compat` branch with a single release and deprecated flag, then removed in next major.

## 3. Consequences

- Positive:
  - One stable public mental model: developer-facing entrypoint is `createRuntime`.
  - Clear boundary: SDK for DX, Runtime for orchestration, Host/Core/World for protocol roles.
  - Easier verification: fewer exported symbols and fewer compatibility branches.
- Negative / cost:
  - existing custom integrations depending on `ManifestoApp`-like API will break.
  - plugin and test utilities that import internal runtime/app symbols need migration.
  - CI and snapshot baselines that assert old public exports will fail and must be updated.

### 3.1 Spec lock and public naming alignment

- The public handle is named `RuntimeHandle` to avoid exposing execution-kernel internals.
- `RuntimeHandle` is an SDK façade contract; it does not expose internal runtime core methods.
- `ADR-010` explicitly lifts the `SDK SPEC v0.1.0` kickoff-lock in this cut.
- `SDK SPEC v1.0.0` is published with the new canonical public contract (`createRuntime`, `RuntimeHandle`, `dispatch`, `snapshot`, `close`, `abort`).

## 4. Implementation Plan

### 4.1 Package/API surface cleanup

1. Remove public exports of legacy `App` symbols from `@manifesto-ai/sdk`.
2. Introduce `RuntimeHandle` public interface and `createRuntime` factory.
3. Constrain `runtime` exports to execution contracts only; move/remove app-bound abstractions.
4. Keep internal symbols behind internal-only paths or package-private directories.

### 4.2 Core flow simplification

1. Define mandatory `Runtime` lifecycle sequence: `createRuntime -> start -> dispatch -> close`.
2. Keep state updates deterministic and source-traceable through existing `Core/Host/World` boundaries.
3. Ensure legacy `createApp` call path is not part of canonical docs or examples.

### 4.3 Legacy module archival

1. Mark translator/intent-ir packages as archived in docs.
2. Remove runtime references and dependencies from SDK/Runtime build graph.
3. Keep only historical references in ADR/spec docs.

### 4.4 Validation

1. Public export contract tests updated to assert:
   - only one façade factory exists in SDK public API (`createRuntime`)
   - `App*` symbols are not present on canonical entrypoint
   - `submitProposal()` is not publicly exposed in v1; only `dispatch()` is available
2. Compatibility matrix updated for major break:
   - migration checklist and affected imports
3. End-to-end happy-path remains covered with existing world snapshot tests after adapter rewrite.

### 4.5 Rollout

1. ADR acceptance requires:
   - SDK and Runtime documentation changes merged
   - public export audit test green
   - major version bump prepared with release notes
2. If any unresolved regression appears in post-cut execution path, keep cut intact and add explicit failing tests rather than restoring legacy compatibility.

## 5. Alternatives Considered

### 5.1 Keep App naming, trim only exports

- Rejected because it keeps conceptual coupling with existing app semantics and does not simplify the user mental model.

### 5.2 Keep separate entrypoints and provide compatibility mode

- Rejected because hard-cut is the objective; compatibility mode reintroduces long-lived complexity and blocks meaningful simplification.

### 5.3 Keep runtime as-is and only alias SDK naming

- Rejected because it shifts user-facing naming without reducing architectural ambiguity or reducing coupling.

## 6. Open Questions

- Whether `subscribe()` should support selector-based diff hooks by default in first hard-cut release.
- Whether `createRuntime` should accept raw compiled schema only or accept MEL text for ergonomics in v1 of hard-cut.
