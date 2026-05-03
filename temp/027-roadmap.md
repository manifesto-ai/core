# ADR-027 Roadmap

> **Status:** Workspace roadmap, non-normative
> **Release Train:** Manifesto v5
> **Normative Source:** [ADR-027](../docs/internals/adr/027-context-and-runtime-namespace-semantics.md)
> **Related Impact Analysis:** [ADR-027 Impact Analysis](./027-impact.md)
> **Branch:** `feature/v5`
> **Last Updated:** 2026-05-03
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
- [ ] PR-2.5 ADR/SDK context lifecycle patch is in progress.
- [ ] PR-3 Compiler context surface is next source work.
- [ ] PR-4 SDK context API/runtime surface is the next user-facing work.
- [ ] PR-5 Lineage/Governance replay envelope remains open.
- [ ] PR-6 tooling/migration/release gate remains open.

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
- [x] `preview/submit(..., { context })` is a transition-local full override.
- [x] Context changes do not trigger compute, effects, patches, or lineage events.
- [x] Preview/submit context capture happens at call-entry and is reused through re-entry.
- [x] If schema has no `context {}`, only empty external context is valid.

## 2. PR-2.5 - Context Lifecycle Documentation Patch

Purpose: close the SDK/user-surface decisions discovered after PR-2 without
touching source implementation.

Status: in progress.

Work:

- [x] Amend ADR-027 with explicit context lifecycle.
- [x] Specify initial context, `injectContext`, `updateContext`, and submit/preview override semantics.
- [x] Specify non-reactive context changes: no automatic transition/effect.
- [x] Specify call-entry capture and in-flight transition isolation.
- [x] Amend SDK SPEC public types and root surface.
- [x] Add SDK rules for full replace, transition-local override, JSON-only validation, clone/freeze, and schema shape conformance.
- [ ] Review diff.
- [ ] Commit documentation patch.

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

- [ ] Add or finish parser/AST support for top-level `context {}`.
- [ ] Add analyzer/type checker validation for context fields and references.
- [ ] Lower `context {}` to `DomainSchema.context`.
- [ ] Lower `$context.foo` to Core expression path `$context.foo`.
- [ ] Lower `$runtime.*` to Core `$runtime.*` paths without `$meta`/`$system` aliases.
- [ ] Remove current v5 lowering paths that emit `$mel.sys` or system-value compatibility storage.
- [ ] Ensure `compileMelPatch` and patch compatibility paths either reject context/runtime where illegal or lower them identically to full domain compilation.
- [ ] Update compiler docs/tests that still teach `$meta.*`, `$system.*`, or old intent guard language.

### 3.3 Tests

- [ ] `context { tenantId: string, locale: string }` emits `DomainSchema.context`.
- [ ] `$context.tenantId` works in action flow patch values and effect params.
- [ ] Unknown `$context.missing` is diagnosed.
- [ ] `$context.*` is rejected when no `context {}` is declared.
- [ ] `$runtime.time.timestamp`, `$runtime.random.uuid`, and `$runtime.intent.id` lower through compiler integration.
- [ ] `$runtime.*` / `$context.*` are rejected in computed, state init, available, and dispatchable.
- [ ] `$meta.*` and `$system.*` are rejected in v5 mode.
- [ ] `onceIntent` emits `causalGuard`.

Exit criteria:

- `pnpm --filter @manifesto-ai/compiler test` passes.
- Compiler integration through Core proves emitted schema works with explicit `Context`.
- No compiler path requires Core to know MEL-owned namespace shape.

## 4. PR-4 - SDK Context API And Runtime Assembly

Purpose: expose the decided user-facing context API and make runtime capture
race-safe.

### 4.1 Public API

- [ ] Add `CreateManifestoOptions.context` as initial flat external context.
- [ ] Add `app.context()`.
- [ ] Add `app.injectContext(next)`.
- [ ] Add `app.updateContext(updater)`.
- [ ] Type `PreviewOptions<TContext>` and `SubmitOptions<TContext>` with schema-derived context type.
- [ ] Keep public API flat; users never pass Core `{ runtime, external }`.
- [ ] Treat submit/preview `options.context` as transition-local full override.

### 4.2 Runtime Semantics

- [ ] Validate context against `DomainSchema.context`; absent context means only `{}`.
- [ ] Reject non-JSON values: functions, promises, lazy getters, symbols, class instances, `undefined`, providers, mutable services.
- [ ] Clone/freeze accepted context values so caller-owned mutable references cannot affect in-flight transitions.
- [ ] Capture preview/submit context at call-entry before any awaited work.
- [ ] Reuse captured context across Host/Core re-entry for the same transition attempt.
- [ ] Ensure `injectContext` and `updateContext` do not emit runtime events, trigger compute, or enqueue effects by themselves.
- [ ] Ensure submit/preview override does not mutate `app.context()`.
- [ ] Keep `available()` and `check()` context-blind.

### 4.3 Tests

- [ ] Initial context is used by submit when no override is supplied.
- [ ] `injectContext` affects only later transitions.
- [ ] `updateContext` executes synchronously once and stores the returned JSON value.
- [ ] Async updater or Promise result is rejected.
- [ ] Submit override wins for that transition only and does not mutate current context.
- [ ] In-flight submit is unaffected by later `injectContext`.
- [ ] Host re-entry after an effect uses the original captured context.
- [ ] Missing/extra/mistyped context fields fail according to `DomainSchema.context`.
- [ ] `runtime` as a user external key remains `$context.runtime`, not `$runtime`.

Exit criteria:

- `pnpm --filter @manifesto-ai/sdk test` passes.
- `pnpm --filter @manifesto-ai/host test` passes.
- SDK public examples in `sdk-SPEC.md` match implementation.

## 5. PR-5 - Lineage And Governance Replay Envelope

Purpose: make deterministic replay possible after execution.

### 5.1 Lineage

- [ ] Store exact submitted `intent`.
- [ ] Store exact materialized `context`.
- [ ] Preserve Snapshot hash semantics unless a separate lineage identity ADR changes it.
- [ ] Add replay lookup for `schema + snapshot + intent + context`.
- [ ] Prove replay reproduces the sealed terminal snapshot.

### 5.2 Governance

- [ ] Capture context at proposal submission.
- [ ] Approval/settlement must not regenerate context.
- [ ] Proposal records carry or reference the submitted compute envelope.
- [ ] Authority evaluation remains policy-only.
- [ ] Governance does not interpret `$runtime.*` or `$context.*`.

### 5.3 Tests

- [ ] Lineage records intent+context for replayable transition records.
- [ ] Replay with recorded context diff-checks to the sealed result.
- [ ] Governed settlement uses proposal-time context.
- [ ] Approval-time context changes do not affect settlement.

Exit criteria:

- Lineage and Governance SPECs and source agree on the replay envelope.
- Governed submit path preserves ADR-027 determinism.

## 6. PR-6 - Migration, Tooling, And Release Gate

Purpose: remove stale guidance and make v5 shippable.

Work:

- [ ] Replace remaining `$meta.*` / `$system.*` examples with `$runtime.*`.
- [ ] Add `$context.*` examples only where direct injection is valid.
- [ ] Add migration notes for Core test fixtures: explicit `Context`.
- [ ] Add migration notes for SDK context API.
- [ ] Add lint/codemod guidance for `$meta/$system`.
- [ ] Update Studio/agent replay docs to include recorded context.
- [ ] Update API docs still mentioning `HostContext` as current surface.
- [ ] Run full v5 hardening.

Release gates:

- [ ] No canonical Core public API names `HostContext`.
- [ ] No canonical v5 MEL/runtime path accepts `$meta.*` or `$system.*`.
- [ ] `$runtime.*` and `$context.*` are phase-restricted.
- [ ] User-defined context is direct-injected JSON only.
- [ ] Context changes are non-reactive unless followed by explicit action.
- [ ] Host re-entry reuses the same context for one transition attempt.
- [ ] Lineage records intent+context for replayable transitions.
- [ ] Governance does not regenerate context at approval/settlement time.
- [ ] Core, Compiler, Host, SDK, Lineage, Governance, and docs all agree on
  `compute(schema, snapshot, intent, context)`.
