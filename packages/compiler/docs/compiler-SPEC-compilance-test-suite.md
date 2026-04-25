# Compiler SPEC Compilance Test Suite (CCTS)

> **Purpose:** Define the compliance harness for `@manifesto-ai/compiler` against the current MEL compiler contract in SPEC-v1.3.0.
> **Audience:** Compiler maintainers and contributors extending MEL semantics.
> **Status:** Operational

---

## 1. Goal

CCTS exists to make compiler SPEC compliance executable.

It has two simultaneous jobs:

1. Turn normative MEL rules into named, reviewable test targets.
2. Make residual normative gaps explicit when they exist, instead of letting them disappear into implicit behavior.

This is intentionally a **rule-mode-visible blocking** suite:

- `blocking` rules fail the suite when violated.
- `pending` rules are probed and reported as `WARN` or `SKIP` until implementation catches up.
- `informational` rules are tracked in the registry but are not yet asserted directly inside CCTS.

---

## 2. Layout

```text
packages/compiler/src/__tests__/compliance/
  ccts-types.ts
  ccts-spec-inventory.ts
  ccts-rules.ts
  ccts-coverage.ts
  ccts-adapter.ts
  ccts-assertions.ts
  ccts-matrix.spec.ts
  suite/
    grammar.spec.ts
    annotations.spec.ts
    context.spec.ts
    state-and-computed.spec.ts
    actions-and-control.spec.ts
    lowering-and-ir.spec.ts
    flow-composition.spec.ts
    entity-primitives.spec.ts
    source-editing.spec.ts
    determinism.golden.spec.ts
```

The suite mirrors the Host HCTS shape, but adds explicit inventory and coverage layers:

- spec inventory (SPEC v1.3.0, stored in the current in-place `SPEC-v1.2.0.md` file)
- shared rule registry
- case/rule coverage map
- test adapter wrapping exported APIs
- assertion helpers that fail only on `FAIL`
- suite files grouped by spec surface

---

## 3. Adapter Contract

`CompilerComplianceAdapter` is test-only and wraps exported compiler APIs.

Supported phases:

- `lex`
- `parse`
- `analyze`
- `generate`
- `compile`
- `lower`

Each phase returns a normalized `CompilerPhaseSnapshot`:

- `success`
- `value`
- `diagnostics`
- `warnings`
- `errors`
- optional `trace`

This keeps compliance tests independent from internal module layout and lets the suite probe the compiler through the same public surfaces used elsewhere in the repo.

---

## 4. Rule Modes

### Blocking

Blocking rules reflect currently implemented compiler behavior:

- lexer/parser baseline
- existing semantic diagnostics (`E001`, `E002`, `E003`, `E005`, `E009`, `E010`, `E011`)
- guarded patch/effect behavior
- fail/stop lowering baseline
- exact unguarded `fail` / `stop` / stop-message diagnostics (`E006`, `E007`, `E008`)
- `at()` lowering
- system-value lowering baseline
- broad expression axioms (`A1`, `A3`, `A4`, `A8`, `A18`) with direct proof cases
- primitive-only equality enforcement (`A15`) with direct compile-time probes
- `flow` / `include` composition and diagnostics (ADR-013a, `FLOW-*`, `E013`-`E024`)
- entity primitives and placement/type diagnostics (ADR-013b, `ENTITY-*`, `TRANSFORM-*`, `E030`-`E035`)
- schema-position lowering hardening (`A26`, `A28`, `A33`, `TYPE-LOWER-6`-`TYPE-LOWER-9`, `E040`-`E044`; `E045`/`E046` retained only as superseded inventory items)
- structural annotations via `@meta`, plus declaration-level source maps via `SourceMapIndex`, including valid v1 target placement, literal-only payload enforcement, deterministic sidecar emission, source-map cache identity, semantic erasure invariants, and the runtime-boundary guard between `DomainSchema` and tooling-only `DomainModule`
- source-fragment editing via `compileFragmentInContext()` (`MEL-EDIT-*`, single-operation shape rejection, raw-splice hardening for fragments/identifiers/JSON keys, runtime-invalid JSON literal rejection, safe remove/rename materialization, all-or-nothing unsafe remove/rename diagnostics, `E_STALE_MODULE`, `E_FRAGMENT_PARSE_FAILED`, `E_FRAGMENT_SCOPE_VIOLATION`, `E_TARGET_NOT_FOUND`, `E_TARGET_KIND_MISMATCH`, `E_UNSAFE_RENAME_AMBIGUOUS`, `E_REMOVE_BLOCKED_BY_REFERENCES`)
- deterministic compile/lower output

### Pending

There are currently no active `pending` rules. New residual gaps should only remain `pending` while the implementation is genuinely incomplete.

Superseded rules remain in the inventory and registry for auditability, but matrix completeness does not require them to keep active probes.

---

## 5. Execution

Package-local run:

```bash
pnpm --filter @manifesto-ai/compiler exec vitest run src/__tests__/compliance/
```

Current acceptance shape:

- inventory/registry/coverage matrix checks pass
- blocking rules pass
- any pending probes, when introduced, remain visible for the residual backlog and do not regress into silent coverage gaps
- existing compiler tests continue to run alongside CCTS

---

## 6. Non-Goals

CCTS still does **not**:

- emit `compliance.json`
- emit `trace.ndjson`
- parse the SPEC document automatically

Those are valid future extensions once the registry and suite skeleton are stable.

---

## 7. Current Residual Gap Audit

As of the SPEC v1.3.0 source-editing baseline:

- `blocking`: concrete current-contract feature families already enforced in compiler + CCTS
- `pending`: none
- `informational`: `A16`, `COMPILER-MEL-2a`

The active compliance backlog is closed for the current SPEC baseline. Remaining tracked items are informational only.

---

## 8. Maintenance Rule

When MEL SPEC adds or changes a normative rule:

1. add or update the entry in `ccts-rules.ts`
2. keep `ccts-spec-inventory.ts` aligned with the SPEC
3. decide `blocking` vs `pending`
4. add or adjust a suite probe and `ccts-coverage.ts`
5. keep `ccts-matrix.spec.ts` passing

If a rule is not in the registry, it is not visible to compliance review.
