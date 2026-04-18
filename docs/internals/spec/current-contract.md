# Current Contract

> **Status:** Living Document
> **Last Updated:** 2026-04-16
> **Purpose:** Single-source current contract for external consumers, canonical-doc exports, and current-surface onboarding

This document is the current-only contract summary for the active Manifesto workspace.

Use this page when you need one stable answer to the question:

> "What is the current Manifesto surface right now?"

This page is intentionally current-only.

- It does not try to preserve version history.
- It does not describe retired package stories.
- It does not use archived ADR/SPEC material to explain the current surface.

If a historical document conflicts with this page or with an owning package SPEC, the owning current package SPEC wins.

## Canonical Composition Path

The current governed runtime composition path is:

```ts
createManifesto(schema, options)
  -> withLineage(config)
  -> withGovernance(config)
  -> activate();
```

This is the canonical entry story for new integrations.

## Current Package Matrix

| Package | Current Contract | Role |
|---------|------------------|------|
| `@manifesto-ai/core` | [core-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/core-SPEC.md) (current through v4.2.0) | Pure semantic runtime, schema validation, patch/apply semantics |
| `@manifesto-ai/host` | [host-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/host-SPEC.md) (current through v4.0.0) | Effect execution, compute loop orchestration, canonical snapshot substrate |
| `@manifesto-ai/sdk` | [sdk-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC.md) (current v3.x surface) | Activation-first application surface, intent creation/dispatch, additive base write reports, simulation, projected introspection |
| `@manifesto-ai/compiler` | [SPEC-v1.1.0.md](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/SPEC-v1.1.0.md) | Full current MEL compiler contract |
| `@manifesto-ai/lineage` | [lineage-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC.md) (current v3.x decorator surface) | Seal-aware continuity, additive lineage write reports, canonical snapshot persistence, restore |
| `@manifesto-ai/governance` | [governance-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/governance/docs/governance-SPEC.md) (current v3.x decorator surface) | Proposal legitimacy, governed runtime gate over lineage-composed manifesto, settlement observation and settlement reports |

## Core Runtime Contract

`@manifesto-ai/core` remains the pure semantic engine.

Current contract highlights:

- `compute(schema, snapshot, intent)` is pure and deterministic.
- `apply(schema, snapshot, patches)` is the only state-application boundary.
- `available` remains the coarse action-family gate.
- `isIntentDispatchable(schema, snapshot, intent)` is the fine bound-intent legality query.
- `FieldSpec` remains the compatibility and coarse-introspection seam.
- `state.fieldTypes` and `action.inputType` are now the normative runtime typing seam when present.

Current typing consequences:

- `T | null` is supported in state and action-input positions.
- `Record<string, T>` is supported in state and action-input positions.
- `nullable` means present-or-null, not optional.
- Runtime validation distinguishes missing fields from explicit `null`.

## Host Contract

`@manifesto-ai/host` owns execution but not semantic meaning.

Current contract highlights:

- Host consumes the canonical Core snapshot substrate.
- Host executes effect requirements and applies the resulting patches.
- Host does not reinterpret domain legality or policy.
- Host remains aligned to the current Core snapshot contract and does not use accumulated `system.errors`.

## SDK Contract

`@manifesto-ai/sdk` is the canonical application-facing runtime entry.

Current contract highlights:

- `createManifesto()` returns a composable manifesto, not an already-running instance.
- Runtime verbs appear only after `activate()`.
- `createIntent()` is anchored on the generated `MEL.actions.*` surface.
- `dispatchAsync()` is the canonical execution verb.
- `dispatchAsyncWithReport()` is the additive base write-report companion.
- `simulate()` is the non-committing dry-run surface and may expose debug-grade `diagnostics.trace`.
- `getSchemaGraph()` is the projected static graph read.
- `isActionAvailable()` remains the coarse gate query.
- `isIntentDispatchable()` and `getIntentBlockers()` are the fine legality/introspection queries.

Current rejection split:

- `ACTION_UNAVAILABLE`: coarse action gate failed
- `INVALID_INPUT`: action is available, but bound intent input failed SDK validation
- `INTENT_NOT_DISPATCHABLE`: action is available, but the bound intent failed the fine gate

Current extension seam:

- `@manifesto-ai/sdk/extensions` is the first-party arbitrary-snapshot seam after activation.
- `simulateSync()`, `explainIntentFor()`, and `isIntentDispatchableFor()` align to the same availability/dispatchability ordering as the public runtime.

## Compiler and MEL Contract

`@manifesto-ai/compiler` is now described by one current full contract:

- [SPEC-v1.1.0.md](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/SPEC-v1.1.0.md)

Current MEL/compiler highlights:

- `available when` is the coarse action gate.
- `dispatchable when` is the bound-intent fine gate.
- `dispatchable when` may read state, computed values, and bare action parameters.
- `dispatchable when` does not allow direct `$input.*`, `$meta.*`, `$system.*`, or effects.
- tooling-only compiler sidecars now include structural annotations and declaration-level source maps through `DomainModule`
- runtime seams continue to consume `DomainSchema` only; `DomainModule` remains tooling-only
- The compiler preserves precise type information through `TypeDefinition`.
- `state.fields` / `action.input` remain compatibility surfaces.
- `state.fieldTypes` / `action.inputType` / `action.params` are the authoritative emitted typing seams for current consumers.

Current expression support includes:

- `filter(arr, pred)`
- `map(arr, expr)`
- `find(arr, pred)`
- `every(arr, pred)`
- `some(arr, pred)`

Current bounded sugar support includes:

- `absDiff(a, b)`
- `clamp(x, lo, hi)`
- `idiv(a, b)` with `number | null` result semantics
- `streak(prev, condition)`
- `match(key, [k, v], ..., default)` in parser-free function form
- `argmax([label, eligible, score], ..., "first" | "last")`
- `argmin([label, eligible, score], ..., "first" | "last")`

Current schema-position support includes:

- `Record<string, T>`
- `T | null`

Still out of current scope:

- arbitrary non-null unions in schema positions
- recursive schema-position lowering that cannot be soundly validated at runtime

## Lineage and Governance Contract

`@manifesto-ai/lineage` and `@manifesto-ai/governance` are the active decorator packages.

Current contract highlights:

- lineage owns sealed continuity and stored canonical snapshot lookup
- lineage promotes the base write verb to `commitAsync()` and the additive report companion to `commitAsyncWithReport()`
- governance composes on top of lineage, not beside it
- decorated runtimes inherit the base read-only legality surface, including `isActionAvailable()`, `isIntentDispatchable()`, and `getIntentBlockers()`
- inherited decorator-runtime legality queries preserve the base SDK ordering: availability first, dispatchability second
- inherited `getIntentBlockers()` surfaces only the first failing layer, so unavailable intents do not evaluate `dispatchable`
- the active governed path is `withLineage(...)->withGovernance(...)->activate()`
- governed runtimes intentionally omit direct base/lineage execution verbs and their report companions, and use `waitForProposal()` / `waitForProposalWithReport()` as additive settlement observers
- there is no separate current `@manifesto-ai/world` package surface

## What External Consumers Should Read

For current-only modeling:

1. Read this page first.
2. Read the owning package SPEC for the area you need.
3. Use `docs/api/` for package selection and import guidance.
4. Use ADRs and historical version indexes only for rationale or archaeology.

## What Not To Infer From Historical Material

Do not use archived or superseded material to infer the current surface in these areas:

- pre-activation SDK or runtime-helper stories
- `@manifesto-ai/world` as a current package
- an older compiler baseline plus addenda as the current MEL contract
- nullable rejection or record rejection in current schema positions
- "collection functions are not builtins" guidance

## Current Truth Rule

When current documents disagree, prefer this order:

1. Owning current package SPEC
2. This current-contract page
3. Current package README or GUIDE
4. Public API docs and guides
5. ADR or historical version-index material
