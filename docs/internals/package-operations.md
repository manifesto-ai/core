# Package Operations Manual

> **Purpose:** Contributor-facing operating manual for package ownership, requirement routing, and public-seam decisions in the active Manifesto workspace.
>
> **Status:** Maintained internal guide
>
> **Authority:** Advisory. If this guide conflicts with `CLAUDE.md`, an owning SPEC, or an ADR/FDR constraint, the higher-ranked source wins.

This page answers two recurring maintainer questions:

1. Which package should own this requirement?
2. If a requirement crosses package boundaries, how should it be handled without weakening the architecture?

Use this guide before opening new public seams, moving logic across packages, or turning a local integration need into a workspace-wide contract.

## 1. Operating Model

Manifesto works best when package responsibilities stay narrow:

- `@manifesto-ai/core` owns semantic meaning.
- `@manifesto-ai/host` owns execution of declared requirements.
- `@manifesto-ai/sdk` owns application-facing runtime contracts.
- `@manifesto-ai/compiler` owns MEL parsing, lowering, emitted schema/tooling surfaces, and diagnostics.
- `@manifesto-ai/lineage` owns continuity, sealing, and restore.
- `@manifesto-ai/governance` owns proposal legitimacy and settlement.
- `@manifesto-ai/codegen` owns generated artifact production.

The default bias is:

- keep semantics low in the stack
- keep execution and persistence out of Core
- keep app ergonomics in SDK, not in Core or Host
- keep experimental or narrow tooling seams out of root `sdk`
- keep internal seams internal unless a stable external consumer truly needs them

## 2. Quick Routing Matrix

| Area | Own it when the requirement is about | Avoid routing here when the requirement is really about | Typical proof before merge |
|------|--------------------------------------|----------------------------------------------------------|----------------------------|
| `@manifesto-ai/core` | semantic meaning, patch/apply rules, expression evaluation, flow interpretation, schema validation | IO, host scheduling, app ergonomics, governance policy, persistence | deterministic compute/apply tests, no forbidden imports, no hidden channels |
| `@manifesto-ai/host` | requirement execution, canonical snapshot substrate, host loop behavior, failure reporting from effects | new domain semantics, action legality, policy, app-level convenience methods | host execution/failure/publication tests |
| `@manifesto-ai/sdk` | app-facing runtime contract, activation story, intent creation, runtime read model, sanctioned helper seams | core semantics, host internals, governance policy, compiler-only concerns | runtime tests, type tests, public export tests, docs, public surface inventory |
| `@manifesto-ai/compiler` | MEL syntax, lowering, schema emission, diagnostics, source maps, tooling sidecars | runtime-only convenience, host execution behavior, proposal policy | parser/lowering/compliance/type tests |
| `@manifesto-ai/lineage` | continuity, branch identity, restore, seal-aware write flow | approval legitimacy, authority policy, general app ergonomics | lineage compliance/runtime tests |
| `@manifesto-ai/governance` | proposals, authority, settlement, governance-owned events and records | lineage continuity rules, core legality, base runtime convenience | governance compliance/runtime tests |
| `@manifesto-ai/codegen` | generated code artifacts and generation-time transforms | runtime execution, MEL semantics, package-level public runtime contracts | codegen output and conflict tests |
| `cts/*` | compliance matrices and regression coverage for normative rules | one-off behavior changes with no normative impact | matrix inventory/coverage updates |
| `docs/`, examples | teaching, onboarding, operator guidance, example validation | runtime semantics or public contracts without owning code/spec updates | docs checks, example updates, link correctness |

## 3. Requirement Handling Workflow

### Step 1: Classify the consumer

Ask who needs the new capability:

- app consumer
- helper or tooling author
- decorator or runtime author
- compiler/toolchain maintainer
- governed-runtime owner
- internal maintainer only

Do not open a root app-facing seam just because a single tool or maintainer could use it.

### Step 2: Find the semantic owner

Ask where the meaning belongs:

- If the rule changes what a Snapshot means, it is probably `core`.
- If the rule changes how declared requirements are executed, it is probably `host`.
- If the rule changes how apps activate, dispatch, inspect, or compose runtimes, it is probably `sdk`.
- If the rule changes MEL language or emitted schema/tooling surfaces, it is probably `compiler`.
- If the rule changes continuity or restore, it is probably `lineage`.
- If the rule changes legitimacy, approval, or settlement, it is probably `governance`.

Adapters may span packages. Ownership should not.

### Step 3: Choose the narrowest seam

Especially for SDK work, prefer the narrowest stable seam that satisfies the real consumer:

| Seam | Audience | Use it for | Do not use it for |
|------|----------|------------|-------------------|
| `@manifesto-ai/sdk` | app consumers | ordinary activation, dispatch, current-snapshot reads | provider-only helpers, arbitrary-snapshot internals, maintenance escape hatches |
| `@manifesto-ai/sdk/extensions` | helper/tool authors | safe post-activation arbitrary-snapshot read-only work | dispatch control, publication control, activation/composition |
| `@manifesto-ai/sdk/provider` | decorator/runtime authors | runtime composition, sanctioned kernel/base-runtime helpers | app-facing convenience by default |
| internal modules | maintainers only | local implementation details | semver-backed external contracts |

If the requirement is real but narrow, start with `provider` or `extensions` before promoting it to root `sdk`.

### Step 4: Decide whether the seam is temporary, local, or public

Use this decision rule:

- local integration workaround: keep it local
- repeated maintainer need with stable semantics: consider `provider`
- repeated helper/tool need after activation with read-only semantics: consider `extensions`
- repeated app-consumer need that should survive major-version hard cuts: consider root `sdk`

Avoid publishing a whole internal subpath when one helper would do.

### Step 5: Update proof, docs, and inventories together

When a change affects a public contract, update all of the following in the same change:

- owning tests
- type-level or compliance tests when applicable
- docs or SPEC text
- package version index if contract wording changed materially
- `docs/api/public-surface.md` when public exports changed

## 4. Package-by-Package Operating Rules

### 4.1 `@manifesto-ai/core`

Route requirements to Core only when they change semantic computation itself:

- schema validation
- expression behavior
- flow interpretation
- patch/apply rules
- deterministic runtime legality inputs

Do not route a requirement to Core when the real request is:

- an effect execution policy
- a runtime convenience method
- a Studio or SDK integration helper
- persistence, authority, or governance behavior

Core changes should prove:

- same input still means same output
- state still flows only through Snapshot
- no IO, wall-clock access, or mutable hidden state was introduced
- errors remain values, not business-logic exceptions

### 4.2 `@manifesto-ai/host`

Route requirements to Host when they change:

- effect execution behavior
- host loop orchestration
- canonical snapshot publication and restoration substrate
- host-owned failure reporting from executed requirements

Do not route a requirement to Host when the real need is:

- a new action gate or semantic legality rule
- governance legitimacy or proposal lifecycle
- an app-facing helper that could live in SDK

Host must execute what Core declared or report failure faithfully. It must not become a policy engine.

### 4.3 `@manifesto-ai/sdk`

SDK is the highest-churn package and should be operated as a contract layer, not as a dumping ground for convenience.

Route requirements to SDK when they change:

- activation and runtime assembly
- app-facing dispatch and introspection verbs
- sanctioned helper seams for tooling or decorators
- current projected read model and related runtime ergonomics

When touching SDK, ask which layer the requirement belongs to:

- root `sdk` for stable app-consumer runtime contracts
- `sdk/extensions` for post-activation arbitrary-snapshot read-only helper work
- `sdk/provider` for runtime/decorator composition and sanctioned lower-level helpers

SDK-specific hard rules:

- do not invent semantic meaning that belongs in Core
- do not expose Host internals just because a tool can use them
- do not publish an internal subpath when a single helper on `provider` or `extensions` is enough
- if a requirement is only proven by one tool today, prefer the narrowest sanctioned seam

Promotion guidance:

- repeated app need -> consider root `sdk`
- repeated helper/tool need -> consider `extensions`
- repeated decorator/runtime-author need -> consider `provider`
- single integration convenience -> keep local unless there is a clear compatibility story

### 4.4 `@manifesto-ai/compiler`

Compiler owns the MEL language and emitted tooling/runtime surfaces.

Route requirements here when they change:

- MEL syntax or grammar
- lowering rules
- emitted `DomainSchema` or emitted typing surfaces
- diagnostics and source locations
- tooling sidecars and source maps

Do not route a requirement to Compiler when it is really:

- an SDK helper
- a Host execution rule
- a governance or lineage contract

Compiler changes should update parser/lowering tests and compliance/type suites when the emitted contract changes.

### 4.5 `@manifesto-ai/lineage`

Lineage owns continuity without owning legitimacy.

Route requirements here when they change:

- sealed continuity
- branch identity and branch-head rules
- restore semantics
- lineage write reports and lineage-owned stores/events

Do not route a requirement to Lineage when it is really:

- approval or authority policy
- app-level dispatch ergonomics
- base runtime legality

### 4.6 `@manifesto-ai/governance`

Governance owns legitimacy without owning effect execution or continuity semantics.

Route requirements here when they change:

- proposal lifecycle
- authority evaluation
- governance settlement and terminalization
- governance-owned events and records

Do not route a requirement to Governance when it is really:

- lineage sealing rules
- Host execution policy
- base SDK activation/dispatch ergonomics

### 4.7 `@manifesto-ai/codegen`

Codegen should absorb generation-time convenience, not runtime semantics.

Route requirements here when they change:

- generated files or generated type artifacts
- generation pipeline composition
- output collision rules and generation-time diagnostics

Do not route generation requirements into SDK or Compiler unless they truly alter runtime or MEL semantics.

### 4.8 CTS, Docs, and Examples

Normative changes are not complete until their evidence surfaces are updated.

- update CTS when a rule is normative and should remain visible in regression matrices
- update docs when a public or contributor-facing contract moved
- update examples when a maintained learning path or reference pattern changed

If a public contract changes and docs/examples do not, the repository is only partially updated.

## 5. Common Requirement Patterns

### New semantic construct

Examples:

- new patch semantics
- new expression behavior
- new flow rule

Default route:

- `core`
- then `compiler` if MEL or emitted schema must express it
- then `sdk` only if app-facing introspection or ergonomics must expose it

### New effect execution or publication behavior

Default route:

- `host`
- optionally `sdk` only for app-facing reporting helpers

### New app-facing convenience

Examples:

- activation ergonomics
- dispatch/report helpers
- runtime read helpers used by many apps

Default route:

- `sdk`

But first decide whether it belongs in:

- root `sdk`
- `extensions`
- `provider`

### New Studio or tooling requirement

Default route:

- `sdk/extensions` if it is post-activation and read-only
- `sdk/provider` if it needs runtime composition or sanctioned lower-level helpers
- `compiler` if it needs richer emitted metadata, diagnostics, or source maps

Do not promote the requirement to root `sdk` unless ordinary app consumers truly need it.

### New governed-runtime requirement

Default route:

- `lineage` for continuity/restore/branch rules
- `governance` for legitimacy/authority/settlement rules
- `sdk/provider` only if the decorator assembly seam itself must change

### New generated artifact or build-time helper

Default route:

- `codegen`
- sometimes `compiler` if the source of truth must be emitted first

## 6. Cross-Package Change Checklist

Before opening a cross-package PR, answer these questions:

- What is the single semantic owner of the requirement?
- Which other packages are only adapters or consumers?
- Is the request truly public, or just locally useful?
- What is the narrowest sanctioned seam that solves it?
- Which tests must move with the change?
- Which docs and inventories must move with the change?

If two packages both appear to "own" the same behavior, the boundary is probably unclear and should be resolved before code is added.

## 7. SDK Hardening Notes For Future Majors

SDK will continue to be the package where real product/tooling pressure accumulates first. That is normal. The operating rule is not "freeze SDK forever." The rule is:

- absorb real demand in the narrowest seam now
- record the repeated demand
- promote it to a broader contract only when the use case is clearly durable

This means:

- small current need -> `provider` or `extensions`
- repeated cross-consumer need -> candidate for next major root-`sdk` design
- internal implementation detail -> keep internal

Examples of the right escalation pattern:

- a single tooling need for base-runtime reification may justify a helper on `provider`
- repeated canonical-snapshot hydration needs across apps and tools may justify a later app-facing SDK contract

## 8. Read This With

- [Current Contract](./spec/current-contract) for the active public package matrix
- [Documentation Governance](./documentation-governance) for docs/index update rules
- [Test Conventions](./test-conventions) for workspace test expectations
- [Layer Boundaries](/architecture/layers) for the system-level boundary model

When in doubt, preserve the architecture first and optimize convenience second.
