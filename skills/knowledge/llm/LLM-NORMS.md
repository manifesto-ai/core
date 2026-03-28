# Manifesto Normative Summary (LLM)

This is a compact summary of high-salience rules. For exact wording, defer to the sources listed in `./LLM-INDEX.md`.

## Document precedence

- SPEC is authoritative.
- FDR is rationale and must not contradict SPEC.
- ADR is decision context and must not contradict SPEC or FDR.
- Guides and READMEs are non-normative.

## Core boundaries

- Core computes meaning; Host executes effects; World governs proposals and lineage.
- Core is pure and deterministic: same input, same output.
- Snapshot is the sole communication medium between layers.
- State changes are expressed as patches plus system transitions, not hidden mutable state.

## Patch semantics

- Only three patch ops exist: `set`, `unset`, `merge`.
- Core returns domain `patches` plus a `systemDelta`.
- Patch application creates a new snapshot and increments version exactly once.

## Error handling

- Errors are values in snapshot state.
- Core must not throw business-logic errors.
- Effect handlers should report failures through patches or terminal results, not opaque side channels.

## Platform namespaces

- `$host` and `$mel` are platform namespaces, not domain fields.
- Schema hashing excludes platform-owned `$` namespaces.
- Domain schemas must not define `$`-prefixed identifiers.

## MEL guard rules

- `once(marker)` requires the first statement to patch the same marker with `$meta.intentId`.
- `onceIntent` is syntactic sugar for per-intent idempotency using `$mel` guard storage.
- Guard writes for `onceIntent` use `merge` at `$mel.guards.intent`.

## Current implementation note

- In this repo, `@manifesto-ai/world` is still the active implementation target for world/governance/lineage behavior.
- `@manifesto-ai/governance` and `@manifesto-ai/lineage` exist as split-design documentation, not implemented code packages.
- For coding tasks, prefer the current exported surface in `packages/world/src/*` over future split docs.

## Guidance for LLM use

- Do not infer behavior not stated in SPEC, FDR, ADR, or current exported code.
- When docs and code differ because a future split is not implemented yet, call that out explicitly.
- Prefer current package exports and source layout for implementation guidance.
