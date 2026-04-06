# Manifesto Normative Summary (LLM)

This is a compact summary of high-salience rules. For exact wording, defer to the sources listed in `./LLM-INDEX.md`.

## Document precedence

- SPEC is authoritative.
- FDR is rationale and must not contradict SPEC.
- ADR is decision context and must not contradict SPEC or FDR.
- Guides and READMEs are non-normative.

## Core boundaries

- Core computes meaning; Host executes effects.
- SDK owns the default direct-dispatch runtime.
- Lineage owns continuity and sealing.
- Governance owns legitimacy and proposals.
- Snapshot is the sole communication medium between compute steps.
- State changes are expressed as patches plus system transitions, not hidden mutable state.

## Patch semantics

- Only three patch ops exist: `set`, `unset`, `merge`.
- Core returns domain `patches` plus a `systemDelta`.
- Patch application creates a new snapshot and increments version exactly once.

## Error handling

- Errors are values in snapshot state.
- Core must not throw business-logic errors.
- Effect handlers should report failures through patches or terminal results, not opaque side channels.
- Current snapshot contract keeps `lastError` as the sole current error surface; accumulated `system.errors` is removed.

## Platform namespaces

- `$host` and `$mel` are platform namespaces, not domain fields.
- Schema hashing excludes platform-owned `$` namespaces.
- Domain schemas must not define `$`-prefixed identifiers.

## Current runtime model

- `createManifesto(schema, effects)` returns a composable manifesto.
- Runtime verbs appear only after `activate()`.
- Governed composition is `createManifesto(...) -> withLineage(...) -> withGovernance(...) -> activate()`.
- There is no current top-level `@manifesto-ai/world` facade in the active public package story.

## Current SDK note

- `getSnapshot()` is the projected app-facing read.
- `getCanonicalSnapshot()` is the canonical substrate read.
- `getSchemaGraph()` is projected static introspection.
- `simulate()` is a non-committing projected dry-run.
- Ref-based lookup is canonical; string ids in graph traversal are debug convenience only.

## Guidance for LLM use

- Do not infer behavior not stated in SPEC, FDR, ADR, or current exported code.
- When current and historical docs differ, call that out explicitly and prefer the current maintained package surface unless the task targets history.
- Prefer current package exports and current living specs for implementation guidance.
