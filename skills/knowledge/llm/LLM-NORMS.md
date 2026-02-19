# Manifesto Normative Summary (LLM)

This file is a compact, non-exhaustive summary of high-salience norms. Always defer to the authoritative specs listed in `./LLM-INDEX.md` for full detail and exact wording.

## Document precedence
- SPEC is authoritative.
- FDR is design rationale; MUST NOT contradict SPEC.
- ADR is a decision record; MUST NOT contradict SPEC/FDR.
- Guides/README are non-normative.

## Core architectural boundaries (cross-package)
- Core computes meaning; Host executes effects; World governs proposals and lineage. (See Core/Host/World SPEC + FDR.)
- Core is pure and deterministic: same input MUST yield same output; no IO; no wall-clock dependency. (Core SPEC/FDR.)
- Snapshot is the sole communication medium between layers; no hidden channels. (Core/World/Host SPEC + FDR.)
- State changes are expressed as patches; snapshots are immutable. (Core SPEC.)

## Patch semantics (Core)
- Only three patch ops exist: set, unset, merge. (Core SPEC.)
- Patch application creates a new snapshot and increments version exactly once. (Core SPEC.)

## Error handling
- Errors are values in snapshot/state; Core MUST NOT throw for business logic. (Core SPEC/FDR.)

## Platform namespaces
- `$host` and `$mel` are platform namespaces, not domain fields. (Host/App/World SPEC patches.)
- `$mel.guards.intent` stores `onceIntent` guard state. (Compiler SPEC/ADR-002.)
- Schema hashing is semantic: `$`-prefixed platform fields do not affect the semantic schema identity. (App/Core spec patches.)

## MEL / Compiler guard rules
- `once(marker)` requires the first statement to patch the same marker with `$meta.intentId`. (Compiler SPEC / ADR-002.)
- `onceIntent` is syntactic sugar for per-intent idempotency using `$mel` guard storage. (Compiler SPEC / ADR-002.)
- `onceIntent` is a contextual keyword: only recognized at statement start followed by `{` or `when`; otherwise it is an identifier. (ADR-002.)
- Guard writes for `onceIntent` use `merge` at `$mel.guards.intent` to avoid shallow-merge loss. (ADR-002.)

## Intent IR v0.2 highlights
- Each role maps to exactly one Term; plurality/coordination MUST use ListTerm. (Intent IR SPEC v0.2.0.)
- ListTerm cannot be nested in v0.2; unordered lists are canonicalized by sorting/deduping. (Intent IR SPEC v0.2.0.)
- Term-level `ext` is allowed for non-semantic hints; semantic canonicalization removes `ext` and `ValueTerm.raw`. (Intent IR SPEC v0.2.0.)
- PredOp `in` requires rhs to be ListTerm. (Intent IR SPEC v0.2.0.)
- EntityRefTerm supports quantification and ordering fields (quant/orderBy/orderDir). (Intent IR SPEC v0.2.0.)

## Translator alignment
- Translator spec v1.0.3 aligns with Intent IR v0.2; refer to translator SPEC + ADRs for exact mappings and lowering rules.

## Guidance for LLM use
- Do not infer behavior not explicitly stated in SPEC/FDR/ADR.
- When conflicts are found, follow the hierarchy and explicitly mention the conflict.
- When patch docs exist, always compose base + patch before reasoning.
