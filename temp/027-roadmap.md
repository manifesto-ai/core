# ADR-027 Roadmap

> **Status:** Workspace roadmap, non-normative
> **Release Train:** Manifesto v5
> **Normative Source:** [ADR-027](../docs/internals/adr/027-context-and-runtime-namespace-semantics.md)
> **Related Impact Analysis:** [ADR-027 Impact Analysis](./027-impact.md)
> **Branch:** `feature/v5`
> **Last Updated:** 2026-05-06
> **Scope:** ADR-027 compute-input contract, context lifecycle, runtime expressions, SDK surface, replay envelope, migration, and release gates

This file is a workspace planning note under `temp/`. It is not a formal ADR,
SPEC, or FDR document.

ADR-027 is the v5 compute-input layer. It defines Manifesto determinism over the
full input tuple:

```text
compute(schema, snapshot, intent, context)
```

The canonical determinism claim is:

```text
same schema + same snapshot + same intent + same context = same result
```

ADR-027 is a P0 boundary. If Core regains Host/MEL-specific knowledge, hidden
runtime-value storage, live context providers, or non-replayable external
channels, v5 should not ship.

## 0. Current Position

ADR-025, ADR-026, and ADR-027 are peer hard cuts in the v5 train:

| ADR | Layer | Owns |
|-----|-------|------|
| ADR-025 | Snapshot substrate | `state`, `namespaces`, projection, restore, hashing |
| ADR-026 | Runtime surface | `actions.*`, `check()`, `preview()`, `submit()`, observe, inspect |
| ADR-027 | Compute input | `context`, `$runtime.*`, `$context.*`, replay context, `causalGuard` |

Current status:

- [x] PR-0 promotion/planning closed.
- [x] PR-1 SPEC/Constitution alignment closed.
- [x] PR-2 Core context/runtime expression hard cut closed.
- [x] PR-2.5 ADR/SDK context lifecycle patch closed.
- [x] PR-3 Compiler context surface closed.
- [x] PR-4 SDK context API/runtime surface closed with staged execution view.
- [x] PR-5 Lineage/Governance replay envelope closed.
- [x] PR-6 tooling/migration/release gate closed.

## 1. Locked Decisions

These decisions are no longer open:

- [x] Core compute is `compute(schema, snapshot, intent, context)`.
- [x] Core canonical input is `Context`, not `HostContext`.
- [x] `Intent` does not carry `frame` or runtime environment fields.
- [x] Core `Context` shape is `{ runtime, external }`.
- [x] `$runtime.*` is Manifesto-owned and intentionally small.
- [x] `$context.*` reads only schema-declared `context.external`.
- [x] `$runtime.*` and `$context.*` are legal only in bound action flow expressions.
- [x] `$meta.*`, `$system.*`, and `$mel.sys` are retired in v5 current contract.
- [x] `onceIntent` lowers to owner-neutral `causalGuard`.
- [x] User-defined context is direct-injected JSON only.
- [x] SDK public context is flat external context, not the nested Core envelope.
- [x] `createManifesto(..., { context })` may provide initial external context.
- [x] `injectContext(next)` is full replace, not partial merge.
- [x] `updateContext(updater)` is a synchronous helper only.
- [x] `preview()` and `submit()` do not accept SDK option bags in the canonical v5 surface.
- [x] `with(view)` is the request-local context/report/diagnostics mechanism for shared runtimes.
- [x] Context changes do not trigger compute, effects, patches, or lineage events.
- [x] Preview/submit context capture happens at call-entry from the triggering runtime view and is reused through re-entry.
- [x] If schema has no `context {}`, only empty external context is valid.

## 2. PR-2.5 - Context Lifecycle Documentation Patch

Purpose: close the SDK/user-surface decisions discovered after PR-2 without
touching source implementation.

Status: closed.

Work:

- [x] Amend ADR-027 with explicit context lifecycle.
- [x] Specify initial context, `injectContext`, `updateContext`, and the original transition-local override model.
- [x] Specify non-reactive context changes: no automatic transition/effect.
- [x] Specify call-entry capture and in-flight transition isolation.
- [x] Amend SDK SPEC public types and root surface.
- [x] Add SDK rules for full replace, transition-local override, JSON-only validation, clone/freeze, and schema shape conformance.
- [x] Review diff.
- [x] Commit documentation patch.

Exit criteria:

- ADR-027 and SDK SPEC agree on lifecycle, public flat context, and Core nested envelope.
- No source behavior is changed in this PR.
- Core/SDK/Compiler/Host tests still pass because docs patch must not disturb code.

## 3. PR-3 - Compiler Context Surface

Purpose: make MEL and compiler output match the ADR-027 context model.

### 3.1 Required Behavior

- `context {}` declares schema-derived external context shape.
- `$context.*` resolves only against declared context fields.
- `$runtime.*` is the only built-in runtime expression namespace.
- `$runtime.*` and `$context.*` are rejected in state initializers, computed values, `available when`, and `dispatchable when`.
- `$meta.*` and `$system.*` are rejected in the v5 current path.
- `onceIntent` continues to lower to `causalGuard`.
- SchemaGraph and dependency extraction remain context-blind for computed/availability.

### 3.2 Implementation

- [x] Add or finish parser/AST support for top-level `context {}`.
- [x] Add analyzer/type checker validation for context fields and references.
- [x] Lower `context {}` to `DomainSchema.context`.
- [x] Lower `$context.foo` to Core expression path `$context.foo`.
- [x] Lower `$runtime.*` to Core `$runtime.*` paths without `$meta`/`$system` aliases.
- [x] Remove current v5 lowering paths that emit `$mel.sys` or system-value compatibility storage.
- [x] Ensure `compileMelPatch` and patch compatibility paths either reject context/runtime where illegal or lower them identically to full domain compilation.
- [x] Update compiler docs/tests that still teach `$meta.*`, `$system.*`, or old intent guard language.

### 3.3 Tests

- [x] `context { tenantId: string, locale: string }` emits `DomainSchema.context`.
- [x] `$context.tenantId` works in action flow patch values and effect params.
- [x] Unknown `$context.missing` is diagnosed.
- [x] `$context.*` is rejected when no `context {}` is declared.
- [x] `$runtime.time.timestamp`, `$runtime.random.uuid`, and `$runtime.intent.id` lower through compiler integration.
- [x] `$runtime.*` / `$context.*` are rejected in computed, state init, available, and dispatchable.
- [x] `$meta.*` and `$system.*` are rejected in v5 mode.
- [x] `onceIntent` emits `causalGuard`.

Exit criteria:

- `pnpm --filter @manifesto-ai/compiler test` passes.
- Compiler integration through Core proves emitted schema works with explicit `Context`.
- No compiler path requires Core to know MEL-owned namespace shape.

## 4. PR-4 - SDK Context API And Runtime Assembly

Purpose: expose the decided user-facing context API and make runtime capture
race-safe.

Status: closed. The initial implementation exposed transition-local context and
projection options through `PreviewOptions` and `SubmitOptions`. That model was
superseded by the 2026-05-06 staged execution view grammar and the
implementation now follows:
`with(view) -> actions.foo -> bind(input)? -> preview/submit`.

### 4.1 Public API

- [x] Add `CreateManifestoOptions.context` as initial flat external context.
- [x] Add `app.context()`.
- [x] Add `app.injectContext(next)`.
- [x] Add `app.updateContext(updater)`.
- [x] Add `app.with({ context?, report?, diagnostics? })` as an execution view.
- [x] Remove canonical `PreviewOptions`, `SubmitOptions`, and `__kind` option bags.
- [x] Keep public API flat; users never pass Core `{ runtime, external }`.
- [x] Ensure `preview()` and `submit()` do not accept SDK option bags.

### 4.2 Runtime Semantics

- [x] Validate context against `DomainSchema.context`; absent context means only `{}`.
- [x] Reject non-JSON values: functions, promises, lazy getters, symbols, class instances, `undefined`, providers, mutable services.
- [x] Clone/freeze accepted context values so caller-owned mutable references cannot affect in-flight transitions.
- [x] Capture preview/submit context at call-entry before any awaited work.
- [x] Reuse captured context across Host/Core re-entry for the same transition attempt.
- [x] Ensure `injectContext` and `updateContext` do not emit runtime events, trigger compute, or enqueue effects by themselves.
- [x] Ensure `with({ context })` does not mutate the parent runtime's `context()`.
- [x] Ensure execution views share the same active runtime law boundary and substrate without creating a new activation.
- [x] Keep `available()` and `check()` context-blind.

### 4.3 Tests

- [x] Initial context is used by submit when no override is supplied.
- [x] `injectContext` affects only later transitions.
- [x] `updateContext` executes synchronously once and stores the returned JSON value.
- [x] Async updater or Promise result is rejected.
- [x] `with({ context })` wins for transitions triggered through that view only and does not mutate parent context.
- [x] `with({ report })` controls submit report projection.
- [x] `with({ diagnostics })` controls preview diagnostic projection.
- [x] `PreviewOptions`, `SubmitOptions`, and `__kind` option bags are absent from the canonical public type surface.
- [x] In-flight submit is unaffected by later `injectContext`.
- [x] Host re-entry after an effect uses the original captured context.
- [x] Missing/extra/mistyped context fields fail according to `DomainSchema.context`.
- [x] `runtime` as a user external key remains `$context.runtime`, not `$runtime`.

Exit criteria:

- `pnpm --filter @manifesto-ai/sdk test` passes.
- `pnpm --filter @manifesto-ai/host test` passes.
- SDK public examples in `sdk-SPEC.md` match implementation.

Closure verification:

- `pnpm --filter @manifesto-ai/sdk test:types` passed.
- `pnpm --filter @manifesto-ai/sdk test` passed.
- `pnpm --filter @manifesto-ai/sdk build` passed.
- `pnpm --filter @manifesto-ai/lineage test` passed.
- `pnpm --filter @manifesto-ai/lineage build` passed.
- `pnpm --filter @manifesto-ai/governance test` passed.
- `pnpm --filter @manifesto-ai/governance build` passed.
- `pnpm --filter @manifesto-ai/core test` passed.
- `pnpm --filter @manifesto-ai/host test` passed.
- `pnpm docs:check` passed.
- `git diff --check` passed.

## 5. PR-5 - Lineage And Governance Replay Envelope

Purpose: make deterministic replay possible after execution.

### 5.1 Lineage

- [x] Store exact submitted `intent`.
- [x] Store exact materialized `context`.
- [x] Preserve Snapshot hash semantics unless a separate lineage identity ADR changes it.
- [x] Expose replay inputs through existing attempt lookup for `schema + snapshot + intent + context`.
- [x] Prove replay reproduces the sealed terminal snapshot.

### 5.2 Governance

- [x] Capture context at proposal submission.
- [x] Approval/settlement must not regenerate context.
- [x] Proposal records carry or reference the submitted compute envelope.
- [x] Authority evaluation remains policy-only.
- [x] Governance does not interpret `$runtime.*` or `$context.*`.

### 5.3 Tests

- [x] Lineage records intent+context for replayable transition records.
- [x] Replay with recorded context diff-checks to the sealed result.
- [x] Governed settlement uses proposal-time context.
- [x] Approval-time context changes do not affect settlement.

Exit criteria:

- Lineage and Governance SPECs and source agree on the replay envelope.
- Governed submit path preserves ADR-027 determinism.

Closure verification:

- `pnpm --filter @manifesto-ai/host build` passed.
- `pnpm --filter @manifesto-ai/sdk build` passed.
- `pnpm --filter @manifesto-ai/lineage build` passed.
- `pnpm --filter @manifesto-ai/governance build` passed.
- `pnpm --filter @manifesto-ai/host test` passed.
- `pnpm --filter @manifesto-ai/sdk test` passed.
- `pnpm --filter @manifesto-ai/lineage test` passed.
- `pnpm --filter @manifesto-ai/lineage test:types` passed.
- `pnpm --filter @manifesto-ai/governance test` passed.
- `pnpm --filter @manifesto-ai/governance test:types` passed.
- `pnpm docs:check` passed.
- `git diff --check` passed.

## 6. PR-6 - Migration, Tooling, And Release Gate

Purpose: remove stale guidance and make v5 shippable.

Work:

- [x] Replace remaining `$meta.*` / `$system.*` examples with `$runtime.*`.
- [x] Add `$context.*` examples only where direct injection is valid.
- [x] Add migration notes for Core test fixtures: explicit `Context`.
- [x] Add migration notes for SDK context API.
- [x] Add lint/codemod guidance for `$meta/$system`.
- [x] Update Studio/agent replay docs to include recorded context.
- [x] Update API docs still mentioning `HostContext` as current surface.
- [x] Run full v5 hardening.

Release gates:

- [x] No canonical Core public API names `HostContext`.
- [x] No canonical v5 MEL/runtime path accepts `$meta.*` or `$system.*`.
- [x] `$runtime.*` and `$context.*` are phase-restricted.
- [x] User-defined context is direct-injected JSON only.
- [x] Context changes are non-reactive unless followed by explicit action.
- [x] Host re-entry reuses the same context for one transition attempt.
- [x] Lineage records intent+context for replayable transitions.
- [x] Governance does not regenerate context at approval/settlement time.
- [x] Core, Compiler, Host, SDK, Lineage, Governance, and docs all agree on
  `compute(schema, snapshot, intent, context)`.

Closure verification:

- `pnpm --filter @manifesto-ai/activation-cts test` passed.
- `pnpm --filter @manifesto-ai/sdk test` passed.
- `pnpm docs:check` passed.
- `pnpm test:hardening` passed.
- `git diff --check` passed.
