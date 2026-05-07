# Current Contract

> **Status:** Living Document
> **Last Updated:** 2026-05-07
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
| `@manifesto-ai/core` | [core-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/core-SPEC.md) (current through v5.0.0 ADR-025/ADR-027/ADR-028 baseline) | Pure semantic runtime, schema validation, patch/apply semantics, dynamic Flow patch target resolution |
| `@manifesto-ai/host` | [host-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/host-SPEC.md) (current through v5.0.0 ADR-025/ADR-027/ADR-028 alignment) | Effect execution, context materialization, compute loop orchestration, canonical snapshot substrate, concrete patch application |
| `@manifesto-ai/sdk` | [sdk-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC.md) (current v5.0.0 ADR-026/ADR-027 surface) | Action-candidate application surface, projected reads, observe/inspect, law-aware `submit()` ingress |
| `@manifesto-ai/compiler` | [SPEC-v1.2.0.md](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/SPEC-v1.2.0.md) (current v5.0.0 in-place) | Full current MEL compiler contract; source-to-schema/source-to-IR lowering |
| `@manifesto-ai/lineage` | [lineage-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC.md) (current v5.0.0 ADR-026/ADR-027 surface) | Seal-aware continuity, lineage-mode `submit()` results, canonical snapshot persistence, replay envelope, restore |
| `@manifesto-ai/governance` | [governance-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/governance/docs/governance-SPEC.md) (current v5.0.0 ADR-026/ADR-027 surface) | Proposal legitimacy, submitted compute envelope preservation, governance-mode `submit()` results, durable `ProposalRef`, settlement observation, and control surface |
| `@manifesto-ai/codegen` | [SPEC-v0.1.1.md](https://github.com/manifesto-ai/core/blob/main/packages/codegen/docs/SPEC-v0.1.1.md) (current v0.2.8, v5 facade alignment in-place) | Build-time domain facade generation aligned to ADR-025 ontology and ADR-026 SDK v5 action candidates |

## ADR-025 v5 Ontology Baseline

The v5 branch adopts ADR-025 as the current Snapshot ontology baseline:

- Domain-owned state is `snapshot.state`.
- `Snapshot.data` is retired from the current public/canonical contract.
- Platform/runtime/compiler/tooling state lives under `snapshot.namespaces`.
- Core treats `snapshot.namespaces` as an opaque owner-partitioned container.
- Host-owned and Compiler/MEL-owned namespace shapes are defined only by their owner packages, not by Core.
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
- The canonical root surface is `snapshot()`, `context()`, `injectContext()`,
  `updateContext()`, `with(view)`, `action`, `state`, `computed`, `observe`,
  `inspect`, and `dispose()`.
- The canonical action ladder is `info()`, `available()`, `check()`,
  `preview()`, `submit()`, and `bind()`.
- `submit()` is a law-aware ingress verb, not a promise of direct execution.
  Base, Lineage, and Governance modes expose authority differences through
  mode-specific result types and decorator-owned implementations.
- Raw `Intent` construction remains an advanced protocol escape hatch through
  `BoundAction.intent()`, not the primary app path.
- Canonical v3 root runtime verbs such as `createIntent()`, `dispatchAsync()`,
  `simulate()`, `subscribe()`, and `on()` are retired from the v5 public root.

ADR-025, ADR-026, ADR-027, and ADR-028 are the four required layers of the same
v5 hard cut: ADR-025 defines the canonical Snapshot substrate, ADR-026 defines
the SDK surface, ADR-027 defines the explicit compute input model, and ADR-028
defines dynamic patch target ownership.

## ADR-028 v5 Dynamic Patch Target Boundary

The v5 branch adopts ADR-028 as the current ownership boundary for dynamic patch
targets:

- Core Flow may carry dynamic patch targets and Core resolves them during
  `compute()`.
- `ComputeResult.patches` and `core.apply()` remain concrete-only.
- Compiler lowers and preserves dynamic target expressions, but does not
  evaluate them, allocate runtime values, or emit placeholder targets.
- Preserved dynamic target Flow IR participates in `DomainSchema.hash`; emitted
  runtime schema hashes are computed from the final runtime `DomainSchema`.
- Host never resolves dynamic patch targets and never evaluates Flow/MEL
  expressions.
- Invalid dynamic target values are Core semantic failures, not
  skip-and-warning compiler/runtime events.
- Effect handlers still return concrete `Patch[]`; dynamic effect-returned
  targets are outside the current contract.

## Core Runtime Contract

`@manifesto-ai/core` remains the pure semantic engine.

Current contract highlights:

- `compute(schema, snapshot, intent, context)` is the canonical pure compute equation.
- Determinism is over the full `schema + snapshot + intent + context` tuple.
- `snapshot` is schema-driven existence information; `context` is captured external environment for the current computation.
- `apply(schema, snapshot, patches)` applies domain patches rooted at `snapshot.state`.
- Core resolves dynamic Flow patch targets during `compute()` before emitting concrete `Patch[]`.
- Namespace transitions are separate from domain patches and are rooted at `snapshot.namespaces[namespace]`; Core validates structural safety only.
- Core does not expose general `$namespace.*` expression reads and does not know Host or MEL namespace names/shapes.
- Core canonical APIs do not expose Host-owned context types, intent frame fields, runtime providers, callbacks, or owner-specific context shapes.
- Compiler `onceIntent` lowers to Core's generic `causalGuard` primitive.
- `$runtime.*` reads built-in runtime facts from `intent` and `context.runtime`; `$context.*` reads schema-declared values from `context.external`.
- `$runtime.*` and `$context.*` are illegal in state initializers, computed values, `available when`, and `dispatchable when`.
- `$meta.*`, `$system.*`, and `$mel.sys` runtime-value lowering are retired from the current v5 contract.
- SDK runtime view selection is separate from action triggering: initial context, `injectContext()`, `updateContext()`, and `with(view)` select external context and projection settings before action selection; `preview()` and `submit()` capture that selected view and do not accept SDK option bags.
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
- Host materializes ADR-027 `Context` before Core execution and reuses the same context across compute re-entry for one transition attempt.
- Host executes effect requirements and applies the resulting patches.
- Host applies only concrete patches and never resolves dynamic Flow patch targets.
- Host does not reinterpret domain legality or policy.
- Host remains aligned to the current Core snapshot contract and does not use accumulated `system.errors`.
- Host-owned execution diagnostics live under canonical `namespaces.host.*`. In particular, `namespaces.host.lastError` is a canonical-only diagnostic, not the semantic Snapshot error surface.
- Host does not depend on MEL namespace shape and does not transport runtime values through `namespaces.host` or `namespaces.mel`.

## SDK Contract

`@manifesto-ai/sdk` is the canonical application-facing runtime entry.

Current contract highlights:

- `createManifesto()` returns a composable manifesto, not an already-running instance.
- Runtime verbs appear only after `activate()`.
- `snapshot()` is the projected app-facing read surface.
- `action.*` exposes typed action-candidate handles.
- `actions.*` and `app.action(name)` are not canonical v5 semantic action
  accessors.
- Action names `then`, `constructor`, `prototype`, and `__proto__` are rejected
  before activation/codegen output is treated as valid.
- `ActionHandle.info()` returns static action metadata and resolved annotations.
- `ActionHandle.available()` is the input-free coarse action-family query.
- `ActionHandle.check(input)` returns first-failing admission state.
- `ActionHandle.preview(input)` is the non-committing dry-run surface.
- `ActionHandle.submit(input)` submits the candidate to the active runtime law boundary.
- Execution view settings such as `context`, `report`, and `diagnostics` are selected through `createManifesto(..., { context })`, `injectContext()`, `updateContext()`, or `with(view)` before `preview()` or `submit()`.
- `preview()` and `submit()` do not accept SDK option bags or inline context overrides.
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
  (current v5.0.0 in-place)

Current MEL/compiler highlights:

- `available when` is the coarse action gate.
- `dispatchable when` is the bound-intent fine gate.
- `dispatchable when` may read state, computed values, and bare action parameters.
- `dispatchable when` does not allow direct `$input.*`, `$runtime.*`, `$context.*`, `$meta.*`, `$system.*`, or effects.
- MEL `context {}` declares direct-injected user context shape and does not define providers, generators, or effect aliases.
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
- dynamic patch targets are preserved for Core Flow evaluation
- emitted compiler `DomainSchema.hash` values are final runtime schema hashes, not compiler-internal canonical IR hashes
- compiler-owned runtime patch evaluation APIs such as `compileMelPatch()` and `evaluateConditionalPatchOps()` are retired from the current v5 contract
- the generated public-surface inventory no longer lists retired compiler runtime evaluator APIs

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

## Codegen Contract

`@manifesto-ai/codegen` is the build-time domain facade generator.

Current contract highlights:

- Codegen consumes `DomainSchema` and emits generated files; it does not run the runtime.
- The canonical domain plugin emits `<domain>.domain.ts` facade types with `state`, `computed`, and `actions`.
- Generated domain state models `snapshot.state`; generated facades MUST NOT reintroduce `snapshot.data`.
- Generated facades MUST keep platform/tooling bookkeeping and runtime expression facts out of domain state by default; owner bookkeeping belongs under `snapshot.namespaces`, while ADR-027 runtime facts come from `Context`.
- `state.fieldTypes`, `action.inputType`, and `action.params` are the preferred current typing seams when present.
- `state.fields` and `action.input` remain compatibility fallbacks.
- SDK v5 facade types align with `ManifestoDomainShape`, `ActionHandle`,
  `ActionInput`, `ActionArgs`, and `action.*`.
- Actions named `then`, `constructor`, `prototype`, or `__proto__` must be
  rejected before generated facade output is treated as valid.
- Codegen does not own runtime authority, execute effects, evaluate governance policy, seal lineage records, or generate canonical v5 lower-authority write backdoors such as root `dispatchAsync`, `commitAsync`, or `proposeAsync`.

## Lineage and Governance Contract

`@manifesto-ai/lineage` and `@manifesto-ai/governance` are the active decorator packages.

Current contract highlights:

- lineage owns sealed continuity and stored canonical snapshot lookup
- lineage implements the lineage-mode `submit()` law boundary for SDK action candidates
- lineage returns `WorldRecord` refs and additive `LineageWriteReport` data through mode-specific submit results
- root `commitAsync()` and `commitAsyncWithReport()` are superseded historical migration inputs, not canonical v5 lineage runtime methods
- lineage derives sealed failure outcome from the terminal Snapshot's `system.lastError` and pending requirements, not from Host-owned `namespaces.host.lastError` alone
- lineage records exact `intent + context` replay envelopes on `SealAttempt` metadata; context does not enter world identity hashes
- governance composes on top of lineage, not beside it
- decorated runtimes use the SDK v5 action-candidate legality ladder: `available()`, `check()`, `preview()`, and `submit()`
- lineage-mode `submit()` preserves first-failing admission order and re-checks legality against the then-current runtime state
- governance-mode `submit()` creates or enters the proposal path and never directly executes base or lineage lower-authority verbs
- governance proposals carry or reference the submitted `intent + context` compute envelope and must not regenerate context at approval or settlement time
- governance-mode `submit()` returns `GovernanceSubmissionResult` with durable `ProposalRef`
- governed settlement is observed through result-bound `waitForSettlement()` or runtime `app.waitForSettlement(ref)`
- helper authors may share legality/read helpers across decorators, but write helpers must enter through the active runtime's `submit()` implementation
- the active governed path is `withLineage(...)->withGovernance(...)->activate()`
- governed runtimes intentionally omit direct base/lineage execution verbs and their report companions; v3 `proposeAsync()`, `waitForProposal()`, and `waitForProposalWithReport()` are historical migration inputs, not canonical v5 root methods
- governance settlement failure reports read semantic failure from terminal Snapshot state when a sealed world exists; Host-owned namespace diagnostics remain canonical-substrate debugging data
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
