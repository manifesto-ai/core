# Current Contract

> **Status:** Living Document
> **Last Updated:** 2026-04-29
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
createManifesto(schema, effects)
  -> withLineage(config)
  -> withGovernance(config)
  -> activate();
```

This is the canonical entry story for new integrations.

## Current Package Matrix

| Package | Current Contract | Role |
|---------|------------------|------|
| `@manifesto-ai/core` | [core-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/core-SPEC.md) (current through v5.0.0 ADR-025 baseline) | Pure semantic runtime, schema validation, patch/apply semantics |
| `@manifesto-ai/host` | [host-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/host-SPEC.md) (current through v4.0.0) | Effect execution, compute loop orchestration, canonical snapshot substrate |
| `@manifesto-ai/sdk` | [sdk-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC.md) (current v5.0.0 ADR-026 surface) | Action-candidate application surface, projected reads, observe/inspect, law-aware `submit()` ingress |
| `@manifesto-ai/compiler` | [SPEC-v1.2.0.md](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/SPEC-v1.2.0.md) (current v1.3.0 in-place) | Full current MEL compiler contract |
| `@manifesto-ai/lineage` | [lineage-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC.md) (current v3.x decorator surface) | Seal-aware continuity, additive lineage write reports, canonical snapshot persistence, restore |
| `@manifesto-ai/governance` | [governance-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/governance/docs/governance-SPEC.md) (current v3.x decorator surface) | Proposal legitimacy, governed runtime gate over lineage-composed manifesto, settlement observation and settlement reports |

## ADR-025 v5 Ontology Baseline

The v5 branch adopts ADR-025 as the current Snapshot ontology baseline:

- Domain-owned state is `snapshot.state`.
- `Snapshot.data` is retired from the current public/canonical contract.
- Platform/runtime/compiler/tooling state lives under `snapshot.namespaces`.
- Host diagnostics live under `snapshot.namespaces.host.*`.
- Compiler/MEL operational guards live under `snapshot.namespaces.mel.*`.
- `computed`, `system`, `input`, and `meta` remain top-level Snapshot partitions.

Current package SPECs remain authoritative while their v5 patches land. When this page and an owning package SPEC disagree, the owning current package SPEC wins.

Schema hash verification result:

- `hashSchema()` / `hashSchemaSync()` default to semantic mode and exclude pre-v5 `$`-prefixed state fields such as `$host` and `$mel`.
- `hashSchemaEffective()` / `hashSchemaEffectiveSync()` include those fields and remain internal/effective-hash utilities.
- Therefore ADR-025's semantic `schemaHash` continuity requirement is satisfied for the current Core hash path; no semantic schemaHash epoch is introduced by pre-v5 platform namespace augmentation.

## ADR-026 v5 SDK Surface Baseline

The v5 branch adopts ADR-026 as the current SDK public-surface baseline:

- `createManifesto(schema, effects)` remains the base SDK entrypoint and returns
  a composable manifesto, not a live runtime.
- `activate()` opens the runtime and returns a `ManifestoApp`.
- The canonical root surface is `snapshot()`, `actions`, `action(name)`,
  `observe`, `inspect`, and `dispose()`.
- The canonical action ladder is `info()`, `available()`, `check()`,
  `preview()`, `submit()`, and `bind()`.
- `submit()` is a law-aware ingress verb, not a promise of direct execution.
  Base, Lineage, and Governance modes expose authority differences through
  mode-specific result types and decorator-owned implementations.
- Raw `Intent` construction remains an advanced protocol escape hatch through
  `BoundAction.intent()`, not the primary app path.
- Canonical v3 root runtime verbs such as `createIntent()`, `dispatchAsync()`,
  `simulate()`, `subscribe()`, and `on()` are retired from the v5 public root.

ADR-025 and ADR-026 are the two required layers of the same v5 hard cut:
ADR-025 defines the canonical Snapshot substrate, and ADR-026 defines the SDK
surface that exposes that substrate to application and agent callers.

## Core Runtime Contract

`@manifesto-ai/core` remains the pure semantic engine.

Current contract highlights:

- `compute(schema, snapshot, intent)` is pure and deterministic.
- `apply(schema, snapshot, patches)` applies domain patches rooted at `snapshot.state`.
- Namespace transitions are separate from domain patches and are rooted at `snapshot.namespaces[namespace]`.
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
- Host-owned execution diagnostics live under canonical `namespaces.host.*`. In particular, `namespaces.host.lastError` is a canonical-only diagnostic, not the semantic Snapshot error surface.

## SDK Contract

`@manifesto-ai/sdk` is the canonical application-facing runtime entry.

Current contract highlights:

- `createManifesto()` returns a composable manifesto, not an already-running instance.
- Runtime verbs appear only after `activate()`.
- `snapshot()` is the projected app-facing read surface.
- `actions.*` exposes typed action-candidate handles.
- `action(name)` is the collision-safe accessor for every declared action name.
- `ActionHandle.info()` returns static action metadata and resolved annotations.
- `ActionHandle.available()` is the input-free coarse action-family query.
- `ActionHandle.check(input)` returns first-failing admission state.
- `ActionHandle.preview(input)` is the non-committing dry-run surface.
- `ActionHandle.submit(input)` submits the candidate to the active runtime law boundary.
- `ActionHandle.bind(input)` creates a reusable bound candidate with nullable `intent()`.
- `observe.state()` and `observe.event()` separate projected state observation from runtime telemetry.
- `inspect.graph()`, `inspect.action()`, `inspect.availableActions()`, `inspect.schemaHash()`, and `inspect.canonicalSnapshot()` are the advanced/tooling reads.
- helper-safe arbitrary-snapshot reads remain under `@manifesto-ai/sdk/extensions`.

Current failure observation:

- Use `submit()` results for per-attempt admission and terminal domain outcomes.
- Use mode-specific reports attached to `submit()` or governance settlement results for additive write-report details.
- Use `snapshot.system.lastError` to read the current semantic error state of the canonical or projected Snapshot.
- Use canonical `namespaces.host.lastError` only for Host-owned effect/execution diagnostics during deep debugging.
- The runtime MUST NOT automatically promote `namespaces.host.lastError` into `system.lastError`; such promotion would turn Host diagnostics into semantic Snapshot state without domain or governance authority.

Current rejection split:

- `unavailable`: coarse action gate failed
- `invalid_input`: action is available, but bound candidate input failed SDK validation
- `not_dispatchable`: action is available, but the bound candidate failed the fine gate

Current extension seam:

- `@manifesto-ai/sdk/extensions` is the first-party arbitrary-snapshot seam after activation.
- extension-kernel reads align to the same availability/dispatchability ordering as the public runtime but do not enter the active runtime law boundary.

## Compiler and MEL Contract

`@manifesto-ai/compiler` is now described by one current full contract:

- [SPEC-v1.2.0.md](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/SPEC-v1.2.0.md)
  (current v1.3.0 in-place)

Current MEL/compiler highlights:

- `available when` is the coarse action gate.
- `dispatchable when` is the bound-intent fine gate.
- `dispatchable when` may read state, computed values, and bare action parameters.
- `dispatchable when` does not allow direct `$input.*`, `$meta.*`, `$system.*`, or effects.
- tooling-only compiler sidecars now include structural annotations and declaration-level source maps through `DomainModule`
- runtime seams continue to consume `DomainSchema` only; `DomainModule` remains tooling-only
- `compileFragmentInContext()` is the compiler-owned authoring-time MEL source-fragment editing primitive
- Safe v1 remove/rename edits are all-or-nothing: complete safe edits or diagnostics with no partial edits
- source edit results are tooling-only artifacts and do not change runtime entrypoints or semantic schema artifacts
- The compiler preserves precise type information through `TypeDefinition`.
- `state.fields` / `action.input` remain compatibility surfaces.
- `state.fieldTypes` / `action.inputType` / `action.params` are the authoritative emitted typing seams for current consumers.
- object-literal spread is the sole bounded parser-level shorthand in current MEL
- spread results and direct `merge()` now share a presence-aware object typing model
- optional fields introduced through spread are observed as `T | null` at the read boundary and require explicit normalization for non-null sinks

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
- `{ ...obj, key: value }` object-literal spread, lowered through canonical `merge(...)`

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
- lineage derives sealed failure outcome from the terminal Snapshot's `system.lastError` and pending requirements, not from Host-owned `namespaces.host.lastError` alone
- governance composes on top of lineage, not beside it
- decorated runtimes inherit the base read-only legality surface, including `isActionAvailable()`, `isIntentDispatchable()`, and `getIntentBlockers()`
- inherited decorator-runtime legality queries preserve the base SDK ordering: availability first, dispatchability second
- inherited `getIntentBlockers()` surfaces only the first failing layer, so unavailable intents do not evaluate `dispatchable`
- helper authors may share legality helpers across decorators, but execution helpers must stay verb-specific: base `dispatchAsync()`, lineage `commitAsync()`, governance `proposeAsync()`
- the active governed path is `withLineage(...)->withGovernance(...)->activate()`
- governed runtimes intentionally omit direct base/lineage execution verbs and their report companions, and use `waitForProposal()` / `waitForProposalWithReport()` as additive settlement observers
- governance settlement failure reports read semantic failure from terminal Snapshot state when a `resultWorld` exists; Host-owned namespace diagnostics remain canonical-substrate debugging data
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
