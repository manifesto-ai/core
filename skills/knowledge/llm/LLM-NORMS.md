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

- In this repo, top-level `@manifesto-ai/world` is the exact consumer-facing governed facade.
- `@manifesto-ai/governance` and `@manifesto-ai/lineage` are implemented code packages and own their protocol-layer behavior.
- For consumer-facing governed work, prefer current `@manifesto-ai/world` exports and adapter subpaths. Import split-native packages directly only when the task is intentionally scoped to governance or lineage.

## Guidance for LLM use

- Do not infer behavior not stated in SPEC, FDR, ADR, or current exported code.
- When current and next-major docs differ, call that out explicitly and prefer the current exported surface unless the task targets a draft.
- Prefer current package exports and source layout for implementation guidance.
