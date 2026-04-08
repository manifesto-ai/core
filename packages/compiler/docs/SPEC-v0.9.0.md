# MEL Compiler SPEC v0.9.0 (Normative Addendum)

> **Version:** 0.9.0
> **Type:** Normative Addendum
> **Status:** Normative
> **Date:** 2026-04-07
> **Base:** v0.7.0 (REQUIRED - read [SPEC-v0.7.0.md](SPEC-v0.7.0.md) first)
> **Companion Addendum:** [SPEC-v0.8.0.md](SPEC-v0.8.0.md) remains in force for `SchemaGraph`
> **Scope:** Intent-level dispatchability via `dispatchable when`
> **Compatible with:** Core SPEC v4.1.0, SDK living spec v3.4.0
> **Related:** ADR-020 Intent-Level Dispatchability

---

## 1. Purpose

This document adds the compiler-side contract for **intent-level dispatchability**.

Unless this addendum says otherwise, [SPEC-v0.7.0.md](SPEC-v0.7.0.md) remains the authoritative full compiler contract.

The new responsibility introduced here is:

- parse `dispatchable when` on action declarations
- lower the new clause into compiled `ActionSpec.dispatchable`
- validate a new expression scope that is broader than `available`, but still pure

This addendum preserves the existing `available when` contract exactly.

---

## 2. Relationship to Existing Compiler Contracts

`available when` remains the **coarse action-family gate**:

- pure
- state/computed only
- evaluated without bound input

`dispatchable when` adds a **fine bound-intent gate**:

- pure
- evaluated after input binding
- may read state, computed, and action parameters

This addendum does **not** change `SchemaGraph`.

`SchemaGraph` remains the static graph from [SPEC-v0.8.0.md](SPEC-v0.8.0.md). Input-dependent dispatchability is not represented as graph nodes or edges.

---

## 3. Syntax Delta

### 3.1 Action Declaration

```ebnf
ActionDecl ::= 'action' Identifier '(' Params? ')' AvailableClause? DispatchableClause? '{' ActionBody '}'

AvailableClause ::= 'available' 'when' Expr
DispatchableClause ::= 'dispatchable' 'when' Expr
```

Clause ordering is fixed:

- `available when` MAY appear
- `dispatchable when` MAY appear
- if both appear, `available when` MUST come first

### 3.2 Keyword Status

`dispatchable` is a reserved MEL keyword as of v0.9.0.

---

## 4. Semantic Scope

### 4.1 AvailableExpr (unchanged)

`available when` retains the v0.7.0 A28 contract:

- allowed: state fields, computed fields
- forbidden: action parameters, `$input.*`, `$meta.*`, `$system.*`, effects

### 4.2 DispatchableExpr (new)

`dispatchable when` introduces a new pure expression scope:

- allowed: state fields, computed fields, action parameters
- forbidden: direct `$input.*` syntax in MEL source, `$meta.*`, `$system.*`, effects
- forbidden: transform primitives such as `updateById()` and `removeById()`

Action parameters are referenced by their **bare declared names**:

```mel
action shoot(cellIndex: number)
  available when canShoot
  dispatchable when eq(at(cells, cellIndex), "unknown") {
  when true {
    patch cells = updateAt(cells, cellIndex, "pending")
  }
}
```

The compiler MUST lower bare action parameter names in `dispatchable when` to the same bound-input reads used by action-body expressions.

Direct `$input.<field>` syntax is still not valid MEL source in `dispatchable when`.

If a name is both a top-level state field and an action parameter, the compiler MUST bind the name to the action parameter inside `dispatchable when`.

---

## 5. Lowered Schema Delta

The compiled action surface becomes:

```typescript
type ActionSpec = {
  readonly flow: FlowNode;
  readonly input?: FieldSpec;
  readonly available?: ExprNode;
  readonly dispatchable?: ExprNode;
  readonly description?: string;
};
```

The compiler MUST omit `dispatchable` when the source action does not declare `dispatchable when`.

---

## 6. Normative Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| DISP-MEL-1 | MUST | the compiler MUST accept `dispatchable when` only on action declarations |
| DISP-MEL-2 | MUST | `dispatchable when` MUST compile to `ActionSpec.dispatchable` |
| DISP-MEL-3 | MUST | bare action parameter names in `dispatchable when` MUST lower to bound-input reads |
| DISP-MEL-4 | MUST | `dispatchable when` MAY reference state fields and computed fields in the same way action-body expressions do |
| DISP-MEL-5 | MUST NOT | `dispatchable when` MUST NOT allow direct `$input.*` MEL syntax |
| DISP-MEL-6 | MUST NOT | `dispatchable when` MUST NOT allow `$meta.*`, `$system.*`, effect references, or any other impure source |
| DISP-MEL-7 | MUST | if both `available when` and `dispatchable when` are present, the compiler MUST preserve that ordering in the parsed action representation |
| DISP-MEL-8 | MUST | `dispatchable when` expression results MUST be boolean-compatible under the same validation regime used for `available when` |
| DISP-MEL-9 | MUST NOT | the compiler MUST NOT project `dispatchable when` into `SchemaGraph` edges or node kinds |
| DISP-MEL-10 | SHOULD | compiler diagnostics for `dispatchable when` SHOULD explicitly distinguish coarse availability violations from fine dispatchability violations |

---

## 7. Diagnostics

This addendum allocates the next free diagnostic ids:

```text
E047: dispatchable expression must be pure (state/computed/action parameters only).
      $meta.*, $system.*, effects, and direct $input.* syntax are not allowed.

E048: Transform primitive in dispatchable condition.
      dispatchable when updateById(...) — not allowed in dispatchable.
```

Existing `available when` diagnostics remain unchanged:

- `E005` still applies only to `available when`
- `E035` still applies only to `available when`

---

## 8. SchemaGraph Non-Change

[SPEC-v0.8.0.md](SPEC-v0.8.0.md) stays authoritative for `SchemaGraph`.

The following remains true after this addendum:

- graph nodes are still only `state`, `computed`, and `action`
- graph edges are still only `feeds`, `mutates`, and `unlocks`
- `unlocks` still reflects `available when` only
- dispatchability is input-bound and therefore outside the static graph contract

---

## 9. Summary

`available when` remains the answer to:

> "Can this action family be considered right now?"

`dispatchable when` adds the answer to:

> "Can this specific bound intent be admitted right now?"

The compiler's responsibility is to preserve that distinction in syntax, lowering, validation, and diagnostics without altering the existing `available when` or `SchemaGraph` contracts.
