# ADR-028: Core-Owned Dynamic Patch Target Semantics

> **Status:** Accepted
> **Date:** 2026-05-07
> **Deciders:** Manifesto Architecture Team (Seongwoo Jung)
> **Reviewers:** Codex architecture review
> **Scope:** Core, Compiler, Host, Docs, CTS
> **Type:** Breaking / Major Hard Cut
> **Release Vehicle:** Manifesto v5 (semantic-boundary layer)
>
> **Supersedes:**
> - ADR-009 `evaluateConditionalPatchOps()` runtime evaluation contract
> - ADR-009 "invalid dynamic path -> skip + warning" policy
> - Compiler public runtime evaluation surface for patch target resolution
> - `compileMelPatch()` as a public runtime patch evaluation ingress
>
> **Related:**
> - ADR-009 (Structured PatchPath)
> - ADR-020 (`dispatchable when`)
> - ADR-025 (Snapshot ontology hard cut)
> - ADR-027 (Context and runtime namespace semantics)
>
> **Non-Goals:** New patch operations, Host effect API redesign, MEL syntax redesign, user-defined runtime expression namespaces, Lineage storage policy, Governance authority policy.

---

## 1. Context

ADR-009 correctly fixed the representation of concrete patch targets by replacing string paths with structured `PatchPath` segments. That decision remains valid.

However, ADR-009 also placed dynamic patch target resolution in a Compiler/runtime evaluation path:

```text
RuntimeConditionalPatchOp[]
  -> evaluateConditionalPatchOps() / evaluateRuntimePatches()
  -> Patch[]
  -> core.apply()
```

That arrangement was tolerable while the runtime boundary was still in flux. It is no longer tolerable after the v5 hard cuts:

- ADR-025 separates domain state from owner namespaces.
- ADR-027 makes Core computation explicitly depend on `schema`, `snapshot`, `intent`, and `context`.
- The package constitution says Core computes meaning, Host executes reality, and Compiler lowers source artifacts.

Dynamic patch target resolution is semantic computation. It can read domain state, action input, `$runtime.*`, `$context.*`, computed values, and previous same-flow patch results. Therefore it belongs to Core `compute()`, not to Compiler and not to Host.

## 2. Problem

### 2.1 Compiler currently owns runtime meaning

The Compiler package currently exposes evaluation helpers that require a runtime-like snapshot/context and produce concrete patches. That makes Compiler responsible for behavior that is not compilation:

- expression evaluation
- runtime allocation order
- sequential working-snapshot semantics
- invalid runtime target policy
- patch application simulation

Those are Core semantics.

### 2.2 Host cannot be the fallback owner

Moving the evaluator from Compiler to Host would not fix the boundary. Host executes requirements and applies Core-emitted transitions. Host must not interpret Flow semantics or decide how dynamic targets resolve.

### 2.3 `skip + warning` contradicts the current failure model

ADR-009 specified that invalid dynamic path segments are skipped and warnings are emitted. The current Core failure surface is different:

```text
semantic failure -> system.lastError via SystemDelta
```

Silently skipping a domain patch is not acceptable for a Core-owned semantic transition. If a Flow says "patch this target" and the target cannot be resolved, the compute result must expose that failure as Snapshot-visible semantic state.

### 2.4 Full-domain compilation loses dynamic targets

The full Compiler generator has had a placeholder path for dynamic index targets. This means MEL source can carry intent that the emitted Core Flow cannot faithfully preserve.

That is not a small compiler bug. It is evidence that the model lacks an owner-correct representation for "patch target to be resolved during compute".

### 2.5 CTS ownership is misplaced

Compiler compliance tests currently cover runtime evaluation behavior. After this ADR, Compiler CTS must prove lowering and preservation only. Core CTS must prove semantic resolution, failure behavior, deterministic allocation, and sequential evaluation.

## 3. Decision

### 3.1 Keep concrete `PatchPath` as the apply-time contract

The Core `Patch` type remains concrete:

```ts
type Patch =
  | { op: "set"; path: PatchPath; value: unknown }
  | { op: "unset"; path: PatchPath }
  | { op: "merge"; path: PatchPath; value: Record<string, unknown> };
```

`core.apply()` accepts only concrete `PatchPath`. It never evaluates dynamic path expressions.

ADR-009's structured `PatchPath` decision remains current.

### 3.2 Add a Core Flow target representation

Core Flow may represent patch targets that contain dynamic expression segments:

```ts
type FlowPatchPath = readonly FlowPatchSegment[];

type FlowPatchSegment =
  | { kind: "prop"; name: string }
  | { kind: "index"; index: number }
  | { kind: "expr"; expr: ExprNode };
```

This type is not a public apply-time patch. It is a Core Flow IR target that Core resolves during `compute()`.

### 3.3 Core owns dynamic target resolution

During Flow evaluation, Core resolves `FlowPatchPath` to concrete `PatchPath` before emitting a `Patch`.

Resolution rules:

- `prop` and `index` segments pass through unchanged.
- `expr` segments are evaluated using the same expression evaluator and the same explicit `Context` input as the surrounding Flow.
- An expression resolving to a non-empty string becomes `{ kind: "prop", name }`.
- An expression resolving to a non-negative integer becomes `{ kind: "index", index }`.
- Any other value is a semantic failure.

The emitted `ComputeResult.patches` still contains only concrete `Patch[]`.

### 3.4 Invalid dynamic targets are semantic failures

Invalid target resolution is no longer `skip + warning`.

Core must report:

- invalid dynamic segment value: `INVALID_PATCH_PATH`
- resolved path not admitted by schema: `PATH_NOT_FOUND`
- invalid merge target or invalid value: `TYPE_MISMATCH`

Those failures are expressed through the normal Core error path and become visible as `snapshot.system.lastError` after the Host/Core boundary applies the `SystemDelta`.

### 3.5 Same-flow sequential semantics are Core semantics

Flow patch evaluation is sequential.

If a Flow contains multiple patches, later patch values and later dynamic target expressions observe the working Snapshot produced by earlier patches in the same Flow evaluation.

This preserves the useful behavior previously simulated by Compiler evaluation, but assigns ownership to Core.

### 3.6 Runtime allocation order is deterministic and Core-owned

If a dynamic target expression uses `$runtime.random.uuid`, allocation is deterministic over the explicit Core input tuple:

```text
schema + snapshot + intent + context
```

Core owns the allocation order. Compiler must not allocate runtime values, and Host must not reinterpret allocation sites.

### 3.7 Compiler lowers and preserves only

Compiler responsibilities are:

- parse MEL patch target syntax
- type-check and reject statically invalid syntax where possible
- preserve dynamic target expressions in Core Flow IR
- never replace a dynamic target with a placeholder such as `"*"`
- never evaluate dynamic target expressions
- never produce concrete runtime patches from runtime data

Compiler is a source-to-schema/source-to-IR package, not a runtime evaluator.

### 3.8 Remove Compiler public runtime evaluation APIs

The following are removed from the public Compiler surface:

- `compileMelPatch()`
- `createEvaluationContext`
- `evaluateExpr`
- `evaluateConditionalPatchOps`
- `evaluateRuntimePatches`
- `evaluateRuntimePatchesWithTrace`
- `EvaluationContext`
- `MelIRPatchPath`
- `MelRuntimePatch`
- `MelRuntimePatchOp`
- `MelIRPathSegment`
- `IRPathSegment`
- `IRPatchPath`
- `lowerRuntimePatch`
- `lowerRuntimePatches`
- `RuntimeConditionalPatchOp`

There is no compatibility period for these APIs in v5. The v5 hard cut is the compatibility boundary.

If future tooling needs dry-run style diagnostics, it must call Core-owned simulation or a clearly tooling-only API that does not claim to produce runtime patches.

### 3.9 Host does not resolve dynamic targets

Host applies concrete domain patches, concrete namespace deltas, and system deltas in the package-owned order defined by Core/Host specs.

Host must not:

- inspect Flow IR to resolve dynamic targets
- evaluate MEL/Core expressions
- suppress unresolved target failures
- reinterpret Core semantic errors

Effect handlers also return concrete `Patch[]`; effect-returned dynamic target expressions are not part of this ADR.

### 3.10 CTS moves to the owning package

Core CTS must cover:

- dynamic target expression resolution
- invalid target semantic failure
- sequential same-flow working Snapshot behavior
- deterministic `$runtime.random.uuid` allocation in paths
- `core.apply()` remaining concrete-only

Compiler CTS must cover:

- dynamic MEL target preservation in emitted Core Flow IR
- absence of placeholder target lowering
- removal of public runtime evaluation APIs
- absence of Compiler compliance claims over runtime patch evaluation

## 4. Consequences

### 4.1 Benefits

- Compiler is restored to a lowering/source-tooling role.
- Core becomes the sole owner of Flow semantic evaluation.
- Host remains an execution/apply orchestrator, not a semantic interpreter.
- Dynamic record-key patching remains supported without keeping a Compiler runtime evaluator.
- Invalid dynamic targets become accountable Snapshot-visible failures.

### 4.2 Costs

- Core Flow IR becomes wider than apply-time `Patch`.
- Compiler public API breaks for callers using `compileMelPatch()` or `evaluation/*`.
- Existing Compiler evaluation tests must be deleted, moved, or rewritten as Core CTS.
- Package specs and generated public-surface docs must be updated in the same v5 release train.

### 4.3 schemaHash continuity and epoch boundary

`FlowPatchPath` is part of `DomainSchema.actions.*.flow`. It therefore
participates in `DomainSchema.hash` / `schemaHash` as semantic runtime schema
content.

ADR-028 can change `schemaHash` for MEL sources that previously compiled dynamic
patch targets through placeholder paths or Compiler/runtime evaluator bridge
types. This is intentional: preserving a dynamic target expression for Core is a
different runtime schema than emitting a concrete placeholder target or relying
on an external evaluator.

```text
ADR028-SCHEMA-HASH-1 (MUST):
The emitted runtime DomainSchema.hash MUST be computed from the final runtime
DomainSchema, including lowered FlowPatchPath values.

ADR028-SCHEMA-HASH-2 (MUST NOT):
Compiler-internal canonical MEL IR hashes MUST NOT be reused as the emitted
runtime DomainSchema.hash when runtime lowering changes DomainSchema content.

ADR028-SCHEMA-HASH-3 (CAVEAT - honest disclosure):
For sources whose emitted Flow IR changes from pre-ADR-028 placeholder/evaluator
semantics to Core-owned FlowPatchPath semantics, ADR-028 introduces a
schemaHash-level epoch boundary.
```

In that case:

- snapshotHash continuity can still hold for the same terminal semantic state.
- worldId continuity is broken because `worldId = hash(schemaHash, snapshotHash, parentWorldId)`.
- pre-ADR-028 sealed worlds become roots of a new lineage epoch under the v5
  ADR-028 runtime schema.
- Genealogy Phase 1 dual schema identity consistency
  (`intendedSchemaHash` vs `runtimeSchemaHash`) MUST be re-examined.

This caveat is cumulative with ADR-025 `SCHEMA-HASH-3`. ADR-025 disclosed the
Snapshot ontology side of the v5 epoch risk; ADR-028 discloses the Flow IR side.

### 4.4 Migration

Runtime callers must stop using Compiler evaluation APIs. The supported runtime path is:

```text
compile MEL domain -> DomainSchema -> SDK/Host/Core runtime -> Core compute
```

Patch text fragments that previously depended on `compileMelPatch()` must be represented as full domain actions or as source-edit/tooling workflows that recompile a domain/module.

## 5. Required Follow-Up Changes

This ADR requires follow-up edits before v5 can be considered internally consistent:

1. Core SPEC: define `FlowPatchPath`, dynamic target resolution, failure codes, and sequential semantics.
2. Compiler SPEC: remove runtime evaluator obligations and define target preservation.
3. Compiler implementation: ensure emitted runtime `DomainSchema.hash` is computed from final runtime `DomainSchema` content.
4. Host SPEC: state explicitly that Host never resolves dynamic patch targets.
5. API docs/public-surface inventory: remove Compiler runtime evaluation exports.
6. ADR-009: mark evaluator/skip-warning sections as superseded by ADR-028 while preserving structured `PatchPath`.
7. Core CTS: add dynamic target semantic cases.
8. Compiler CTS: replace evaluator cases with lowering-preservation and schema-hash consistency cases.

## 6. Final Decision

Manifesto v5 keeps dynamic patch targets, but their meaning belongs to Core.

Compiler lowers source. Host executes and applies. Core computes semantic transitions, including dynamic patch target resolution.

The earlier Compiler runtime evaluator was a pre-v5 bridge. ADR-028 removes that bridge and makes the ownership boundary explicit.
