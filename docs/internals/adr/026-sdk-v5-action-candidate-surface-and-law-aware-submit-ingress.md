# ADR-026: SDK v5 Action Candidate Surface and Law-Aware `submit()` Ingress

> **Status:** Accepted
> **Date:** 2026-04-29
> **Deciders:** Manifesto Architecture Team (Seongwoo Jung)
> **Reviewers:** GPT cross-review, Codex M0–M3 production usage
> **Scope:** `@manifesto-ai/sdk`, `@manifesto-ai/lineage`, `@manifesto-ai/governance`, Studio, Agent tooling, Codegen / domain facade guidance, Docs
> **Type:** Breaking / Major Hard Cut
> **Release Vehicle:** Manifesto v5 (SDK surface layer of v5 hard cut)
>
> **Supersedes:**
> - Current SDK v3 activated-runtime public caller ladder
> - Current public use of `createIntent()` + `dispatchAsync()` as the primary app-facing path
> - Current "no cross-decorator common write verb" rule for public action handles
> - Current public `simulate()` / `simulateIntent()` naming
> - Current public verb fork between `dispatchAsync` / `commitAsync` / `proposeAsync`
>
> **Related:**
> - **ADR-025** (Snapshot Ontology Hard Cut — `state` / `namespaces` separation, the substrate layer of v5)
> - ADR-002 (`$mel` namespace, onceIntent, `withPlatformNamespaces`)
> - ADR-006 (Publish Boundary / Channel Separation)
> - ADR-014 (World decomposition)
> - ADR-015 (Snapshot ontological classes)
> - ADR-017 (Capability Decorator Pattern)
> - ADR-018 (Public Snapshot Boundary)
> - ADR-019 (Intent-Level Dispatchability)
> - ADR-020 (Post-Activation Extension Kernel)
> - **Codex Manifesto Usage Report (M0–M3, 2026-04-29)** — primary external evidence for this ADR
>
> **Non-Goals:** Core compute / apply semantics, Host effect execution, MEL syntax, `available when` / `dispatchable when` semantics, Governance authority policy, Snapshot ontology (covered by ADR-025).

---

## 1. Context

### 1.1 The current public ladder is fragmented

The current SDK is semantically coherent but its public-facing API exposes implementation stages rather than the domain-action mental model. An application or agent caller currently encounters the following surface:

```text
createIntent
getAvailableActions
isActionAvailable
isIntentDispatchable
getIntentBlockers
why
whyNot
explainIntent
simulate
simulateIntent
dispatchAsync
dispatchAsyncWithReport
commitAsync
commitAsyncWithReport
proposeAsync
waitForProposal
waitForProposalWithReport
getSnapshot
getCanonicalSnapshot
getActionMetadata
getSchemaGraph
subscribe
on
```

The underlying semantic ladder is far smaller — five steps:

```text
1. Read the current visible world.
2. Select an action candidate.
3. Check whether the candidate is admissible.
4. Preview the candidate without mutation.
5. Submit the candidate to the active runtime law boundary.
```

The current docs already describe this ladder informally:

```text
availability → explanation/blockers → simulation → write verb
```

But the ladder is fragmented across many unrelated function names. Every consumer must reconstruct the five-step model from a 22-function surface.

### 1.2 Codex M3 evidence — the unified ladder emerged independently in production

The Codex Manifesto Usage Report (M0–M3, 2026-04-29) provides direct evidence that the unified ladder is not a hypothesis but a **convergent production pattern**. After integrating SDK + Lineage through M3, Codex's commit pattern stabilized into:

```text
create intent
  → explain/check legality
  → simulate projected snapshot
  → verify expected fields
  → commitAsyncWithReport
  → verify lineage world snapshot matches runtime snapshot
  → return compact commit audit record
```

Codex packaged this into helpers named:

```text
simulateThenCommit(...)
commitRuntimeStep(...)
```

The Codex report concludes:

> "This pattern should remain the default for all semantic runtime mutations."

This is the ladder this ADR formalizes. The five-step model is not theoretical — it has been observed to emerge under production pressure when an external user wires legality checks, simulation, and lineage commits together. Codex's `simulateThenCommit` helper exists precisely because the v3 surface forced manual ladder reconstruction.

The Codex report also provides direct evidence for several specific decisions in this ADR:

- **Explicit `ok | stop | fail` terminal triad** (Codex §5) → grounds the `ExecutionOutcome` shape in §9.
- **"Lineage-First Public Results" hard cut** (Codex §5) → `submit()` must return mode-specific results that link to lineage refs, not duplicate snapshot bytes.
- **`@meta` annotations as agent contract surface** (Codex §5) → `info()` on action handles is a primary agent-facing surface, not a debug-only metadata reader.
- **"Manifesto should own the grammar of experience"** (Codex §9) → the grammar is *exactly* the action-candidate ladder this ADR makes canonical.

### 1.3 The unified ladder of action candidates

This ADR proposes a public surface organized around the action candidate as the primary user-facing object:

```ts
const app = createManifesto<TodoDomain>(todoMel, effects).activate();

app.snapshot();

app.actions.addTodo.info();
app.actions.addTodo.available();
app.actions.addTodo.check({ title: "Ship v5" });
app.actions.addTodo.preview({ title: "Ship v5" });
await app.actions.addTodo.submit({ title: "Ship v5" });

app.observe.state((s) => s.state.todos, listener);
app.observe.event("submission:settled", handler);

app.inspect.graph();
app.inspect.availableActions();
app.inspect.action("addTodo");
app.inspect.canonicalSnapshot();
```

The runtime root partitions into four surfaces:

```text
runtime
  ├─ snapshot()       // projected visible world read
  ├─ actions.*        // typed action candidate handles
  ├─ action(name)     // collision-safe handle accessor
  ├─ observe.*        // state/event observation
  └─ inspect.*        // advanced introspection / debug / tooling
```

The per-action ladder collapses 22 functions into 5 methods plus `bind()`:

```text
info()       // action contract metadata
available()  // coarse action-family availability
check(input) // bound-candidate admission query
preview(input) // pure non-committing dry-run
submit(input)  // submit candidate to active runtime law boundary
bind(input)    // create reusable bound candidate
```

### 1.4 V5 hard cut window economics and alignment with ADR-025

This ADR is the **SDK surface layer** of the Manifesto v5 hard cut. ADR-025 is the **substrate layer**. The two ship as a single coordinated v5 release.

The conditions justifying this cut are the same conditions that justified ADR-025, and they remain in effect:

- **Bus factor = 1.** The marginal cost of any breaking change rises monotonically once collaborators or external users multiply.
- **Pre-stable artifacts.** The v3 SDK surface is not yet a public stability commitment.
- **The cut window narrows monotonically.** Codex is currently the only material external user, and Codex's M3 report is itself evidence that the cut should have happened earlier — Codex absorbed the cost by writing wrappers (`snapshotData()`, `simulateThenCommit`, `commitRuntimeStep`).

Coupling ADR-025 (substrate) and this ADR (surface) into a single v5 release matters because:

1. ADR-025 already breaks every read site through `data` → `state`. Breaking write sites in the same release halves total user migration cost.
2. The v5 narrative becomes coherent: *Manifesto v5 is the release where the runtime exposes the same ontology MEL authors and agents reason about, through the same ladder humans and agents follow.*
3. Sibling v5 ADRs (`lineage-as-default` and others) build on top of *both* layers and require both to be in place.

### 1.5 Explicit retraction of v3 conventions

This ADR explicitly retracts the following:

- **The "no cross-decorator common write verb" rule.** v5 introduces `submit()` as the unified write verb across base, lineage, and governance runtimes. The rule was correct under v3's authority-leak risk model; this ADR replaces it with a stronger model (§3) that unifies the verb while preserving authority semantics through mode-specific result types and decorator-owned implementations.
- **`createIntent()` + `dispatchAsync()` as the primary app-facing path.** In v5, raw `Intent` construction moves out of the default user path. `Intent` remains an internal protocol primitive and an advanced/escape-hatch surface; it is no longer the entry point users must learn first.
- **Public `simulate()` / `simulateIntent()` naming.** `preview()` becomes canonical at the action-handle level. `simulate*` naming is deferred to advanced extensions if retained at all.
- **Public verb fork between `dispatchAsync` / `commitAsync` / `proposeAsync`.** A single `submit()` verb replaces these in user-facing paths, with mode-specific result types making authority differences explicit.

---

## 2. Problem

### 2.1 Implementation-stage names obscure the domain-action model

The 22-function v3 surface names *implementation stages* (intent construction, dispatchability evaluation, simulation, dispatch, commit, propose). It does not name *what users actually do* — pick an action, check whether it can run, see what it would do, run it.

This costs:

- New-user onboarding (which of 22 functions do I start with?)
- Studio UI consistency (no canonical per-action ladder to render)
- Agent tool design (every per-action operation needs a separate tool definition)
- Type-guided action exploration (action arity/input not visible at the type level)
- Documentation coherence (each function needs its own page)
- Long-running agent freshness discipline (no clear "re-check before submit" cadence)

### 2.2 Authority differences leak through verb proliferation

V3 currently expresses authority differences (base / lineage / governance) by *changing the verb name*: `dispatchAsync` vs `commitAsync` vs `proposeAsync`. This has two failure modes:

- **Verb proliferation:** every new decorator must invent a new verb and re-document its surface.
- **Authority hiding through naming:** an agent that learned `dispatchAsync` does not automatically understand that the same intent against a governed runtime requires a *different* verb. Authority differences should be visible in *return types and runtime law*, not in *verb selection at call time*.

### 2.3 Agent grounding requires a stable ladder

Codex's M3 report (§9) frames the broader principle:

> "Manifesto should own the grammar of experience."

A grammar requires a *stable, finite vocabulary*. The v3 surface fails this — agents must memorize 22 implementation-stage verbs, several of which mean the same thing under different decorators. A grammar that varies per decorator is not a grammar; it is a dialect map.

The action-candidate ladder (`info → available → check → preview → submit`) is finite, stable across decorators, and corresponds 1-to-1 with how Codex describes domain-action reasoning in production.

---

## 3. Core Principle

This ADR adopts the following load-bearing principle:

> **The API is unified, but authority differences are never hidden.**

In Korean (original formulation): "API는 통합하지만 권위 차이는 숨기지 않는다."

This principle has the following normative consequences:

- `submit()` does **not** mean "execute now."
- `submit()` does **not** guarantee mutation.
- `submit()` means: *submit this candidate to the currently active runtime law boundary*.
- Base, Lineage, and Governance runtimes return **different result shapes** from `submit()`.
- Governance is **never** represented as direct execution.
- A decorated runtime **never** regains lower-authority backdoors through `submit()`.
- Authority is encoded in **return types** and **decorator-owned implementations**, not in verb selection.

This principle resolves the v3 tension between "users want one verb" and "decorators need different authority semantics." V5 gives users one verb *and* makes decorators expose their authority through the result type — both at once.

---

## 4. New Public Runtime Shape

### 4.1 ManifestoApp

```ts
export type RuntimeMode = "base" | "lineage" | "governance";

/**
 * Base ManifestoApp surface, common to all runtime modes.
 */
export type BaseManifestoApp<
  TDomain extends ManifestoDomainShape,
  TMode extends RuntimeMode,
> = {
  readonly actions: ActionSurface<TDomain, TMode>;
  readonly observe: ObserveSurface<TDomain>;
  readonly inspect: InspectSurface<TDomain>;

  /**
   * Read the current projected visible Snapshot.
   * This is the app-facing read boundary (see ADR-025 §4.2).
   */
  snapshot(): ProjectedSnapshot<TDomain>;

  /**
   * Collision-safe action handle accessor.
   * Required for action names that collide with JS object properties
   * or reserved surface names.
   */
  action<Name extends ActionName<TDomain>>(
    name: Name,
  ): ActionHandle<TDomain, Name, TMode>;

  dispose(): void;
};

/**
 * Governance-mode surface extension: re-observe settlement of a previously
 * created proposal by ProposalRef. Available only when TMode is "governance".
 *
 * This surface enables ProposalRef-based settlement re-observation after
 * process restart, agent handoff, or any context where the original
 * pending submission result's JS object is lost.
 *
 * Per SDK-SUBMIT-15 / 16, ProposalRef is the durable settlement handle;
 * the JS object on the pending result is a convenience binding only.
 */
export type GovernanceSettlementSurface<
  TDomain extends ManifestoDomainShape,
> = {
  /**
   * Re-observe settlement of a previously created governance proposal.
   * Equivalent to calling waitForSettlement() on the original pending
   * SubmitResult, but reachable from any later runtime instance.
   */
  waitForSettlement(
    ref: ProposalRef,
  ): Promise<GovernanceSettlementResult<TDomain, ActionName<TDomain>>>;
};

/**
 * Empty intersection no-op. Used to add no surface when a runtime mode
 * has no mode-specific extension. `Record<never, never>` (equivalent to
 * `{}` without the lint complaints) is a true empty object type — unlike
 * `Record<string, never>`, which would impose an index signature
 * incompatible with BaseManifestoApp's properties.
 */
type EmptySurface = Record<never, never>;

/**
 * ManifestoApp type. Mode-specific extensions are intersected based on TMode.
 *
 * For TMode = "base" | "lineage": only the base surface is exposed.
 * For TMode = "governance": GovernanceSettlementSurface is added —
 * `app.waitForSettlement(ref)` becomes type-level reachable.
 *
 * The conditional uses the `[TMode] extends ["governance"]` (tuple-wrapped,
 * non-distributive) form rather than `TMode extends "governance"` so that a
 * generic helper accepting a union TMode (e.g., `"base" | "governance"`)
 * does NOT collapse into exposing GovernanceSettlementSurface members.
 * Combined with SDK-SUBMIT-11, this keeps generic-mode callers safe at
 * both the SubmitResult level and the runtime-surface level.
 */
export type ManifestoApp<
  TDomain extends ManifestoDomainShape,
  TMode extends RuntimeMode,
> = BaseManifestoApp<TDomain, TMode>
  & ([TMode] extends ["governance"]
      ? GovernanceSettlementSurface<TDomain>
      : EmptySurface);
```

### 4.2 ActionSurface

```ts
export type ActionSurface<
  TDomain extends ManifestoDomainShape,
  TMode extends RuntimeMode,
> = {
  readonly [Name in ActionName<TDomain>]:
    ActionHandle<TDomain, Name, TMode>;
};
```

`actions.*` is the ergonomic property accessor.

`action(name)` is the normative collision-safe accessor (rules below).

```text
SDK-ROOT-1 (MUST):
ManifestoApp implementations MUST ensure that user-defined action names
cannot override runtime methods such as `then`, `constructor`, `bind`,
`inspect`, `snapshot`, `dispose`, or `action`.

SDK-ROOT-2 (MUST):
For any action name that conflicts with a reserved root method or property,
`actions.*` access MAY shadow safely (return the action handle) ONLY when
implementation can guarantee no runtime corruption. Otherwise, only
`action(name)` is required to work.

SDK-ROOT-3 (MUST):
`action(name)` MUST work for every declared action name regardless of
collision with JS reserved or runtime-reserved identifiers.

SDK-ROOT-4 (MUST):
GovernanceSettlementSurface methods MUST be type-level reachable only on
governance-mode runtimes. The type system MUST prevent base or lineage
runtimes from exposing waitForSettlement(ref).

SDK-ROOT-5 (MUST):
On a governance runtime, runtime.waitForSettlement(ref) MUST work
equivalently to the waitForSettlement() method on the original pending
SubmitResult, accepting persisted ProposalRef across process boundaries
per SDK-SUBMIT-15 and SDK-SUBMIT-16.

SDK-ROOT-6 (MUST):
The ManifestoApp conditional intersection MUST use the non-distributive
form `[TMode] extends ["governance"] ? ... : EmptySurface` rather than the
distributive form `TMode extends "governance" ? ... : EmptySurface`.

Rationale: when a generic helper receives a union TMode (e.g.,
`"base" | "governance"`), the distributive form would collapse to
`(EmptySurface | GovernanceSettlementSurface)` and silently expose
GovernanceSettlementSurface members at the type level. The non-distributive
form requires TMode to literally be `"governance"` for the extension to
apply. Generic helpers therefore cannot accidentally surface governance-only
methods on union-mode runtimes — this complements SDK-SUBMIT-11.

SDK-ROOT-7 (MUST NOT):
The empty-surface side of the ManifestoApp conditional MUST NOT use
`Record<string, never>`. That type imposes an index signature requiring
every string key to map to `never`, which is incompatible with
BaseManifestoApp's named properties. The empty-surface position MUST use
`Record<never, never>` (or an equivalent true-empty object type) so that
intersection acts as a no-op.
```

---

## 5. Action Handle

```ts
export type ActionHandle<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
  TMode extends RuntimeMode,
> = {
  /** Static/public action contract. */
  info(): ActionInfo<Name>;

  /** Coarse action-family availability. Input-free. */
  available(): boolean;

  /** Canonical bound-candidate admission query. */
  check(...args: ActionArgs<TDomain, Name>): Admission<Name>;

  /** Pure non-committing dry-run. */
  preview(
    ...args: [...ActionArgs<TDomain, Name>, PreviewOptions?]
  ): PreviewResult<TDomain, Name>;

  /** Submit this candidate to the active runtime law boundary. */
  submit(
    ...args: [...ActionArgs<TDomain, Name>, SubmitOptions?]
  ): Promise<SubmitResultFor<TMode, TDomain, Name>>;

  /** Create a reusable bound candidate. */
  bind(...args: ActionArgs<TDomain, Name>): BoundAction<TDomain, Name, TMode>;
};
```

### 5.1 Why `bind()` exists

`bind()` is not redundant with the inline `submit(input)` form. It exists because the action candidate is a first-class object in three real-world scenarios:

1. **Agents that decide first, act later.** An agent reasons over candidates (calls `check()` and `preview()` on multiple alternatives) before committing to one. Holding a `BoundAction` lets the agent compare without re-binding.
2. **Multi-stage UI flows.** A confirmation dialog renders `preview()` output and `submit()`s the same bound candidate when the user confirms. Inline forms force re-passing the input through the UI tree.
3. **Tool/workflow composition.** A workflow builder accepts `BoundAction` values as primitives. Without `bind()`, the workflow must carry both an action handle and an input value as separate fields.

`bind()` therefore makes the candidate a noun, not just an inline argument tuple.

---

## 6. Bound Action

```ts
export type BoundAction<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
  TMode extends RuntimeMode,
> = {
  readonly action: Name;
  readonly input: ActionInput<TDomain, Name>;

  check(): Admission<Name>;
  preview(options?: PreviewOptions): PreviewResult<TDomain, Name>;
  submit(options?: SubmitOptions): Promise<SubmitResultFor<TMode, TDomain, Name>>;

  /**
   * Advanced/raw protocol access.
   *
   * Returns null when an Intent cannot be constructed because input validation
   * failed. Callers that need invalid-input diagnostics MUST use check().
   */
  intent(): Intent | null;
};
```

### 6.1 Why `intent()` is a method, not an always-present property

If `intent` were an always-present property, invalid input would still produce an `Intent` object — silently misleading callers into believing the protocol object is dispatchable. The method-with-null contract makes the failure surface explicit:

```ts
const candidate = app.actions.spend.bind({ amount: "invalid" });

candidate.check();
// { ok: false, layer: "input", code: "INVALID_INPUT", ... }

candidate.intent();
// null
```

Diagnostics for invalid input live in the discriminated `Admission` union, not in a malformed `Intent`.

---

## 7. Admission

`check()` is the canonical admission API.

### 7.1 Type shape

```ts
export type Admission<Name extends string = string> =
  | AdmissionOk<Name>
  | AdmissionFailure<Name>;

export type AdmissionOk<Name extends string = string> = {
  readonly ok: true;
  readonly action: Name;
};

export type AdmissionFailure<Name extends string = string> = {
  readonly ok: false;
  readonly action: Name;
  readonly layer: "availability" | "input" | "dispatchability";
  readonly code:
    | "ACTION_UNAVAILABLE"
    | "INVALID_INPUT"
    | "INTENT_NOT_DISPATCHABLE";
  readonly message: string;
  readonly blockers: readonly Blocker[];
};

export type Blocker = {
  readonly path: ReadonlyArray<string | number>;
  readonly code: string;
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
};
```

### 7.2 Three layers, first-failing-only

`check()` evaluates the same semantic ordering as the v3 public caller ladder, returning only the first failing layer:

```text
1. availability      (action-family gate; input-free; coarse)
2. input             (input validation against ActionInput type)
3. dispatchability   (intent-level gate against current snapshot; fine)
```

```text
SDK-ADMISSION-1 (MUST):
check() MUST evaluate availability before input validation.

SDK-ADMISSION-2 (MUST NOT):
check() MUST NOT evaluate dispatchability when availability fails.

SDK-ADMISSION-3 (MUST NOT):
check() MUST NOT evaluate dispatchability when input validation fails.

SDK-ADMISSION-4 (MUST):
check() MUST return only the first failing layer.

SDK-ADMISSION-5 (MUST):
Admission failures MUST be returned as values, not thrown,
for known candidate-admission failures.

SDK-ADMISSION-6 (MAY):
Unknown action names, disposed runtime access, or malformed internal
runtime state MAY throw programmer errors.
```

This contract supersedes the public need for `isIntentDispatchable()`, `getIntentBlockers()`, `why()`, `whyNot()`, and `explainIntent()`. Those names MAY remain in advanced/compat surfaces but MUST NOT be the canonical v5 onboarding path.

### 7.3 Why three layers (not more)

The dispatchability layer covers both (a) snapshot-state-only refusals and (b) input × snapshot combination refusals. Distinguishing these as separate layers was considered and rejected for v5 — production debugging from Codex M0–M3 did not require the distinction. If future evidence shows the merged layer hides too many causes, sub-categorization within `Blocker[]` is the migration path; splitting the admission layer count is a v5+ revision concern.

---

## 8. Preview

`preview()` replaces public `simulate()` / `simulateIntent()`.

### 8.1 Type shape

```ts
export type PreviewResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | {
      readonly admitted: false;
      readonly admission: AdmissionFailure<Name>;
    }
  | {
      readonly admitted: true;

      /**
       * Core compute status. admitted=true does NOT imply success.
       * The underlying action may still produce stop/halted/error.
       */
      readonly status: "complete" | "pending" | "halted" | "error";

      readonly before: ProjectedSnapshot<TDomain>;
      readonly after: ProjectedSnapshot<TDomain>;

      readonly changes: readonly ChangedPath[];
      readonly requirements: readonly Requirement[];

      readonly newAvailableActions?: readonly ActionInfo[];
      readonly diagnostics?: PreviewDiagnostics;
      readonly error?: ErrorValue | null;
    };
```

### 8.2 Preview rules

```text
SDK-PREVIEW-1 (MUST):     preview() MUST be pure and non-committing.
SDK-PREVIEW-2 (MUST NOT): preview() MUST NOT publish state.
SDK-PREVIEW-3 (MUST NOT): preview() MUST NOT enqueue runtime work.
SDK-PREVIEW-4 (MUST):     preview() MUST apply the same admission ordering as check().
SDK-PREVIEW-5 (MUST):     preview() MUST preserve Core status: complete | pending | halted | error.
SDK-PREVIEW-6 (MUST):     admitted=true means dry-run computation was admitted,
                          NOT that the action would necessarily settle successfully.
SDK-PREVIEW-7 (MUST):     admitted=false MUST include the same first-failing
                          admission layer as check().
```

The distinction between admission failure and Core status failure is load-bearing. `preview()` MUST NOT collapse Core stop/halted/error into admission failure — those are valid execution outcomes that callers may need to observe before committing.

---

## 9. Submit

`submit()` is the v5 law-aware ingress verb.

```ts
await app.actions.addTodo.submit({ title: "Ship v5" });
```

It supersedes the public verb fork between `dispatchAsync()`, `commitAsync()`, and `proposeAsync()`.

### 9.1 What `submit()` means

`submit()` means:

> Submit this bound action candidate to the currently active runtime law boundary.

It does **not** mean any of:

```text
execute now
mutate immediately
commit a world
approve governance
bypass authority
```

The actual semantics depend on the active runtime mode, which is statically encoded in the result type (§9.3).

#### 9.1.1 `result.ok` is a protocol envelope, not a domain success signal

The `ok` field on `submit()` results indicates that the **submission protocol** completed — admission passed, the candidate reached the runtime law boundary, and a settled or pending state was reached. It does **not** indicate that the underlying domain action succeeded.

The following is a valid combination:

```ts
{
  ok: true,
  status: "settled",
  outcome: { kind: "fail", error: { ... } }
}
```

Reading: *"The submission protocol completed successfully (admission passed, runtime law boundary entered, settlement reached). The domain action that was settled produced a `fail` outcome (e.g., invariant violation, malformed effect result)."*

```text
SDK-RESULT-1 (MUST):
result.ok represents protocol/admission envelope success, NOT domain success.
Domain success/stop/fail is carried by ExecutionOutcome (§9.2).

SDK-RESULT-2 (MUST):
Documentation, examples, and codemod guidance MUST teach the two-phase check:
  if (!result.ok) { /* admission failure */ }
  else { /* narrow by mode, then narrow by outcome.kind */ }

SDK-RESULT-3 (SHOULD NOT):
Examples SHOULD NOT use `if (result.ok) { /* assume domain success */ }` as
a one-step check unless the caller explicitly does not need to distinguish
domain ok/stop/fail (e.g., fire-and-forget audit logging, telemetry submission).
PR-8 docs review SHOULD warn on single-step patterns that lack such rationale,
not unconditionally reject them.
```

This distinction is load-bearing: collapsing protocol envelope and domain outcome into a single `ok` field would re-introduce the v3 ambiguity that this ADR's `ExecutionOutcome` design (§9.2) explicitly resolves.

### 9.2 ExecutionOutcome — grounding the `ok | stop | fail` triad

`SubmitResult` references `ExecutionOutcome`, defined as the discriminated union covering Core's terminal triad. The triad is established by Codex M3's boundary work (Codex Report §5):

```ts
export type ExecutionOutcome =
  | { readonly kind: "ok"; readonly detail?: ExecutionDetail }
  | { readonly kind: "stop"; readonly reason: string; readonly detail?: ExecutionDetail }
  | { readonly kind: "fail"; readonly error: ErrorValue; readonly detail?: ExecutionDetail };

export type ExecutionDetail = Readonly<Record<string, unknown>>;
```

```text
SDK-SUBMIT-12 (MUST):
ExecutionOutcome MUST be the canonical discriminated union covering Core's
{ ok, stop, fail } terminal triad. This grounds Codex M3's distinction between
recoverable stop and reparable fail (Codex Report §5) into the SDK type system.

SDK-SUBMIT-13 (MUST):
"stop" represents a valid no-result outcome (e.g., insufficient feature data,
no eligible candidates, insufficient evolution evidence).
Recovery MAY be deferred to a later attempt with new evidence.

SDK-SUBMIT-14 (MUST):
"fail" represents a malformed-input or invariant-violation outcome.
Recovery requires repair, not retry.
```

The triad must be visible at the SDK type level. Hiding it inside `BaseWriteReport` or similar substructures would force consumers to re-extract it manually, recreating the v3 ladder problem at a different level.

#### 9.2.1 Core status → ExecutionOutcome mapping

The Core compute layer produces a finer status set than the user-facing `ExecutionOutcome` triad. The mapping is:

| Core compute status | ExecutionOutcome.kind | Notes |
|---------------------|-----------------------|-------|
| `complete` | `ok` | Domain action completed normally. |
| `halted` (semantic stop) | `stop` | MEL-level `stop` statement. Valid no-result outcome. |
| `error` (semantic fail) | `fail` | MEL-level `fail` statement or invariant violation. Carries `ErrorValue`. |

```text
SDK-OUTCOME-1 (MUST):
Core `complete` MUST map to ExecutionOutcome { kind: "ok" }.

SDK-OUTCOME-2 (MUST):
Core `halted` (MEL stop) MUST map to ExecutionOutcome { kind: "stop", reason }.

SDK-OUTCOME-3 (MUST):
Core `error` (MEL fail or invariant) MUST map to
ExecutionOutcome { kind: "fail", error }.
```

#### 9.2.2 What about `pending`?

Core `pending` is intentionally NOT mapped to `ExecutionOutcome`. The reason is structural:

- A `submit()` whose Promise resolves with `status: "settled"` means the runtime law boundary has completed its commitment for this candidate. By definition, the only Core terminal statuses at this boundary are `complete | halted | error`.
- A submission that is *legitimately* pending (governance proposal awaiting decision) is represented by `GovernanceSubmissionResult.status: "pending"` plus `waitForSettlement()` (§9.6) — not by a hypothetical `ExecutionOutcome { kind: "pending" }`.
- A `submit()` that resolved with `status: "settled"` while Core status was internally `pending` would indicate a Host bug, not a domain outcome the SDK mapping is responsible for absorbing.

`ExecutionOutcome` represents *what the domain action did*. Pending represents *what the runtime is currently doing*. Conflating the two would re-introduce v3-style ambiguity at a different layer.

This mapping ensures Codex M3's production distinction (Codex Report §5) — between recoverable `stop` and reparable `fail` — is preserved across the SDK boundary in a deterministic way.

### 9.3 Mode-specific result typing

```ts
export type SubmitResultFor<
  TMode extends RuntimeMode,
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  TMode extends "base"
    ? BaseSubmissionResult<TDomain, Name>
    : TMode extends "lineage"
      ? LineageSubmissionResult<TDomain, Name>
      : TMode extends "governance"
        ? GovernanceSubmissionResult<TDomain, Name>
        : SubmissionResult<TDomain, Name>;  // generic union fallback

export type SubmissionResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | BaseSubmissionResult<TDomain, Name>
  | LineageSubmissionResult<TDomain, Name>
  | GovernanceSubmissionResult<TDomain, Name>;
```

### 9.4 Base result

```ts
export type BaseSubmissionResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | {
      readonly ok: true;
      readonly mode: "base";
      readonly status: "settled";
      readonly action: Name;
      readonly before: ProjectedSnapshot<TDomain>;
      readonly after: ProjectedSnapshot<TDomain>;
      readonly outcome: ExecutionOutcome;
      readonly report?: BaseWriteReport;
    }
  | {
      readonly ok: false;
      readonly mode: "base";
      readonly action: Name;
      readonly admission: AdmissionFailure<Name>;
    };
```

### 9.5 Lineage result

```ts
export type LineageSubmissionResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | {
      readonly ok: true;
      readonly mode: "lineage";
      readonly status: "settled";
      readonly action: Name;
      readonly before: ProjectedSnapshot<TDomain>;
      readonly after: ProjectedSnapshot<TDomain>;
      readonly world: WorldRecord;
      readonly outcome: ExecutionOutcome;
      readonly report?: LineageWriteReport;
    }
  | {
      readonly ok: false;
      readonly mode: "lineage";
      readonly action: Name;
      readonly admission: AdmissionFailure<Name>;
    };
```

The `world: WorldRecord` field carries the lineage worldId established by ADR-025 §5.1 (`hash(schemaHash, snapshotHash, parentWorldId)`). This is the lineage ref that Codex M2 consumed via `commitAsyncWithReport` — preserved at the SDK type level.

### 9.6 Governance result

Governance submission returns a proposal-bearing result. Settlement is observed, not driven, by the caller.

```ts
export type GovernanceSubmissionResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | {
      readonly ok: true;
      readonly mode: "governance";
      readonly status: "pending";
      readonly action: Name;
      readonly proposal: ProposalRef;

      /** Observe settlement. Does NOT itself bypass authority. */
      waitForSettlement(): Promise<GovernanceSettlementResult<TDomain, Name>>;
    }
  | {
      readonly ok: false;
      readonly mode: "governance";
      readonly action: Name;
      readonly admission: AdmissionFailure<Name>;
    };

export type GovernanceSettlementResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | {
      readonly ok: true;
      readonly mode: "governance";
      readonly status: "settled";
      readonly action: Name;
      readonly proposal: ProposalRef;
      readonly world: WorldRecord;
      readonly before: ProjectedSnapshot<TDomain>;
      readonly after: ProjectedSnapshot<TDomain>;
      readonly outcome: ExecutionOutcome;
      readonly report?: GovernanceSettlementReport;
    }
  | {
      readonly ok: true;
      readonly mode: "governance";
      readonly status: "rejected" | "superseded" | "expired" | "cancelled";
      readonly action: Name;
      readonly proposal: ProposalRef;
      readonly decision?: DecisionRecord;
      readonly report?: GovernanceSettlementReport;
    }
  | {
      readonly ok: false;
      readonly mode: "governance";
      readonly status: "settlement_failed";
      readonly action: Name;
      readonly proposal: ProposalRef;
      readonly error: ErrorValue;
      readonly report?: GovernanceSettlementReport;
    };
```

### 9.7 Submit invariants

```text
SDK-SUBMIT-1 (MUST):
submit() MUST run admission before entering the runtime write boundary.

SDK-SUBMIT-2 (MUST):
submit() MUST re-check legality against the then-current runtime state.

SDK-SUBMIT-3 (MUST NOT):
submit() MUST NOT treat prior available() or check() results as
capability tokens. Long-running agents MUST re-check immediately before submit.

SDK-SUBMIT-4 (MUST):
submit() MUST be implemented by each active runtime/decorator.
A generic helper that bypasses decorator authority MUST NOT exist
in the public surface.

SDK-SUBMIT-5 (MAY):
Base submit() MAY delegate internally to base dispatch implementation.

SDK-SUBMIT-6 (MUST):
Lineage submit() MUST preserve sealing/continuity semantics.
It MAY delegate internally to lineage commit implementation.

SDK-SUBMIT-7 (MUST):
Governance submit() MUST create or enter the proposal path.
It MUST NOT directly execute base/lineage write verbs.

SDK-SUBMIT-8 (MUST NOT):
Governed runtimes MUST NOT expose lower-authority direct execution
through submit() or any other public verb.

SDK-SUBMIT-9 (MUST):
submit() result types MUST be mode-specific where the runtime mode
is statically known (TMode is a literal "base" | "lineage" | "governance").

SDK-SUBMIT-10 (MUST NOT):
The public observer method MUST NOT be named settle().
"settle" implies the caller causes settlement, which is incorrect for governance.
The public observer method is waitForSettlement().

SDK-SUBMIT-11 (MUST):
When TMode is not statically known (generic helper context),
SubmitResult MUST be the full discriminated union (SubmissionResult).
Callers MUST narrow by the `mode` field before consuming mode-specific fields.
This invariant is enforced at the type level — the union has no shared
mode-specific fields outside the `mode` discriminator.

SDK-SUBMIT-15 (MUST):
ProposalRef MUST be sufficient to re-observe settlement after process
restart, agent handoff, or any other loss of the original submit() result
JS object.

The Governance runtime MUST expose a re-attachment API as part of its
mode-specific surface (GovernanceSettlementSurface, §4.1) such that:

  // app: ManifestoApp<TDomain, "governance">
  const ref: ProposalRef = /* persisted earlier */;
  const settlement = await app.waitForSettlement(ref);

works equivalently to calling waitForSettlement() on the original pending
result. ProposalRef is the durable settlement handle; the JS object on the
pending result is a convenience binding only.

This API MUST be unreachable at the type level on base/lineage runtimes
(SDK-ROOT-4).

SDK-SUBMIT-16 (MUST):
ProposalRef MUST be serializable to a stable string representation and stable
across runtime restarts. It MUST NOT carry references to in-process objects,
closures, or non-serializable runtime state.

The exact serialization format (JSON object, string-encoded structured clone,
opaque token, or other) is resolved in PR-1 SPEC. The minimum requirement is
that ProposalRef can survive a process boundary and be passed to
`waitForSettlement(ref)` in a later runtime instance.
```

---

## 10. Snapshot Boundary

The v5 public root exposes one Snapshot read method:

```ts
app.snapshot();
```

Canonical/debug substrate reads live under `inspect`:

```ts
app.inspect.canonicalSnapshot();
```

```text
SDK-SNAPSHOT-1 (MUST):
snapshot() MUST return the projected app-facing Snapshot
(ProjectedSnapshot per ADR-025 §4.2).

SDK-SNAPSHOT-2 (MUST):
snapshot() MUST be the only root-level Snapshot read method
in the canonical v5 public surface.

SDK-SNAPSHOT-3 (MUST):
Canonical substrate reads MUST live under inspect.

SDK-SNAPSHOT-4 (MUST NOT):
snapshot() MUST NOT expose Host-owned canonical diagnostics that are
not part of the projected semantic Snapshot. By ADR-025, this means
snapshot() MUST NOT expose `namespaces`.
```

`canonicalSnapshot()` is retained as the inspect method name (not renamed to `rawSnapshot`). After ADR-025, namespaces are *operational, not raw* — `canonical` accurately conveys "the full substrate including operational namespaces"; `raw` would suggest unprocessed bytes, which is misleading.

---

## 11. Observe Surface

```ts
export type ObserveSurface<TDomain extends ManifestoDomainShape> = {
  state<S>(
    selector: (snapshot: ProjectedSnapshot<TDomain>) => S,
    listener: (next: S, prev: S) => void,
  ): Unsubscribe;

  event<E extends ManifestoEventName>(
    event: E,
    listener: (payload: ManifestoEventPayload<E>) => void,
  ): Unsubscribe;
};
```

```text
SDK-OBSERVE-1 (MUST):
State observation and runtime telemetry MUST remain separate channels.

SDK-OBSERVE-2 (MUST):
observe.state() observes projected Snapshot values per ADR-025 §4.2.

SDK-OBSERVE-3 (MUST):
observe.event() observes runtime lifecycle events.

SDK-OBSERVE-4 (MUST NOT):
Telemetry MUST NOT be used as semantic truth for lineage/world identity.
Lineage truth lives in WorldRecord, not in event payloads.

SDK-OBSERVE-5 (MUST):
v5 event taxonomy MUST align with submission lifecycle, not only base
dispatch lifecycle.
```

### 11.1 Event taxonomy

V5 adopts the `submission:*` namespace as the primary lifecycle taxonomy. The `action:*` alternative was considered and rejected because it reinforces the v3 mental model ("an action fires") rather than the v5 model ("a candidate is submitted").

```text
submission:admitted    — admission passed; entering runtime write boundary
submission:rejected    — admission failed
submission:submitted   — submitted to active runtime law boundary
submission:pending     — awaiting settlement (governance path)
submission:settled     — terminal: world sealed (lineage) or state mutated (base)
submission:failed      — terminal: error during settlement

proposal:created       — governance proposal created
proposal:decided       — governance decision recorded
proposal:superseded    — governance proposal superseded by another
proposal:expired       — governance proposal expired without decision
proposal:cancelled     — governance proposal cancelled before decision
```

Final event payload shapes are resolved in the SDK v5 SPEC during PR-1.

---

## 12. Inspect Surface

```ts
export type InspectSurface<TDomain extends ManifestoDomainShape> = {
  graph(): SchemaGraph;
  canonicalSnapshot(): CanonicalSnapshot;
  action<Name extends ActionName<TDomain>>(name: Name): ActionInfo<Name>;
  availableActions(): readonly ActionInfo[];
  schemaHash(): string;
};
```

```text
SDK-INSPECT-1 (MUST):
inspect.* is the advanced/debug/tooling namespace.

SDK-INSPECT-2 (MUST):
v3 getSchemaGraph() maps to inspect.graph().

SDK-INSPECT-3 (MUST):
v3 getActionMetadata(name) maps to inspect.action(name) or actions.x.info().

SDK-INSPECT-4 (MUST):
v3 getAvailableActions() maps to inspect.availableActions().

SDK-INSPECT-5 (MUST NOT):
actions.$available() MUST NOT be introduced. Action-namespace and
inspect-namespace are distinct surfaces.

SDK-INSPECT-6 (MUST):
actions MUST remain an action namespace, not a mixed meta namespace.
```

---

## 13. Extension Kernel Boundary

This ADR does **not** move `@manifesto-ai/sdk/extensions` into the root runtime surface.

```ts
// extension kernel access remains explicit
import {
  getExtensionKernel,
  createSimulationSession,
} from "@manifesto-ai/sdk/extensions";
```

```text
SDK-EXT-1 (MUST):     Extension kernel APIs remain under @manifesto-ai/sdk/extensions for v5.
SDK-EXT-2 (MUST NOT): app.kernel MUST NOT be introduced as a root property.
SDK-EXT-3 (MUST NOT): Extension kernel APIs MUST NOT become runtime mutation backdoors.
SDK-EXT-4 (MUST):     Arbitrary-snapshot preview/session APIs remain read-only/non-committing.
```

### 13.1 Architectural rationale

The reason `app.kernel` is not adopted is **architectural, not stylistic**.

The extension kernel operates on **static schemas** and **hypothetical snapshots** — it does not interact with the active runtime's law boundary. Its read/preview operations have no relationship to `submit()`'s authority semantics.

Placing kernel APIs at the root (`app.kernel.*`) would visually conflate two surfaces with fundamentally different authority models:

- `app.actions.*`, `app.observe.*`, `app.inspect.*`, `app.snapshot()` all operate against the **active runtime**, subject to the runtime mode's law boundary.
- Extension kernel operations are **runtime-independent** — a simulation session against a static schema does not flow through any runtime mode.

A user who sees `app.kernel` next to `app.actions` would reasonably assume both surfaces respect the same authority. They do not. The naming proximity would hide a real architectural separation.

The explicit `@manifesto-ai/sdk/extensions` import signals "you are now leaving the active runtime's law boundary and operating on hypothetical state." This is the correct cognitive break.

---

## 14. v3 → v5 API Mapping

| v3 API                                | v5 API                                                     |
| ------------------------------------- | ---------------------------------------------------------- |
| `getSnapshot()`                       | `snapshot()`                                               |
| `getCanonicalSnapshot()`              | `inspect.canonicalSnapshot()`                              |
| `getSchemaGraph()`                    | `inspect.graph()`                                          |
| `getActionMetadata(name)`             | `inspect.action(name)` or `actions.x.info()`               |
| `getAvailableActions()`               | `inspect.availableActions()`                               |
| `isActionAvailable(name)`             | `actions.x.available()`                                    |
| `createIntent(MEL.actions.x, input)`  | `actions.x.bind(input).intent()`                           |
| `getIntentBlockers(intent)`           | `actions.x.check(input).blockers`                          |
| `isIntentDispatchable(intent)`        | `actions.x.check(input).ok`                                |
| `whyNot(intent)`                      | `actions.x.check(input)`                                   |
| `why(intent)`                         | `actions.x.check(input)` or future `explain()`             |
| `explainIntent(intent)`               | Deferred — see §21 Open Question 1                         |
| `simulate(action, ...args)`           | `actions.x.preview(...args)`                               |
| `simulateIntent(intent)`              | `actions.x.bind(input).preview()`                          |
| `dispatchAsync(intent)`               | `actions.x.submit(input)` on base runtime                  |
| `dispatchAsyncWithReport(intent)`     | `actions.x.submit(input)` result `report` field            |
| `commitAsync(intent)`                 | `actions.x.submit(input)` on lineage runtime               |
| `commitAsyncWithReport(intent)`       | `actions.x.submit(input)` result `report` field            |
| `proposeAsync(intent)`                | `actions.x.submit(input)` on governed runtime              |
| `waitForProposal(id)`                 | `submission.waitForSettlement()`                           |
| `waitForProposalWithReport(id)`       | `submission.waitForSettlement()` result `report` field     |
| `subscribe(selector, listener)`       | `observe.state(selector, listener)`                        |
| `on(event, handler)`                  | `observe.event(event, handler)`                            |

---

## 15. Non-Goals

This ADR does NOT:

1. Change Core compute/apply semantics.
2. Change Host effect execution semantics.
3. Change MEL syntax.
4. Change `available when` or `dispatchable when` semantics.
5. Remove raw `Intent` from internal protocol or advanced tooling.
6. Introduce `app.kernel`.
7. Define final event payload shapes exhaustively (taxonomy is fixed; payload shapes are SPEC work).
8. Decide the Snapshot ontology (covered by ADR-025).
9. Define a new compiler sidecar.
10. Change Governance authority policy.
11. Make lineage the default activation mode (covered by sibling v5 ADR — `lineage-as-default`).

---

## 16. Consequences

### 16.1 Positive

- The public API collapses around the action-candidate mental model that emerged in Codex's M0–M3 production usage.
- Human UI, Studio, and agents share the same per-action ladder.
- `submit()` gives agents a stable single ingress without erasing authority semantics.
- `check()` returns a discriminated union, replacing v3's null-checking patterns.
- `preview()` is more comprehensible than `simulate*` for both humans and agents.
- Canonical/debug substrate is still available but no longer pollutes root onboarding.
- v5 documentation can teach a single path: `snapshot → check → preview → submit`.
- Codex's `simulateThenCommit` and `commitRuntimeStep` helpers become unnecessary; the SDK ships the pattern as the canonical surface.
- `ExecutionOutcome` makes the `ok | stop | fail` triad first-class at the SDK type level, replacing the need for consumers to extract terminal status from heterogeneous report shapes.

### 16.2 Negative / Trade-offs

- This is a major breaking change.
- Existing examples, guides, Studio integrations, agent tools, and tests require migration.
- `submit()` introduces a new semantic abstraction that documentation must convey precisely.
- Governance result modeling is more explicit and therefore larger.
- Mode-specific result narrowing adds SDK type complexity.
- Event taxonomy is renormalized around submission lifecycle rather than dispatch lifecycle.

---

## 17. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `submit()` misunderstood as direct execution | §3 principle is normative; result `status` exposes `pending/settled/rejected`; docs lead with §9.1 |
| Governance bypass through generic helper | SDK-SUBMIT-4 / 7 / 8; tests prove governed runtimes do not call base/lineage direct verbs (§19.3) |
| `preview()` hides Core failure | SDK-PREVIEW-5 / 6; `admitted: true` does NOT imply success |
| `check()` over-evaluates dispatchability | SDK-ADMISSION-1~4 enforce first-failing-layer ordering |
| Invalid input still exposes an `Intent` | `BoundAction.intent()` returns `null` on invalid input (§6.1) |
| Action name collision in `actions.*` | SDK-ROOT-1~3; `action(name)` collision-safe accessor |
| Result union too wide for callers | `SubmitResultFor<TMode>` narrows by mode; SDK-SUBMIT-11 enforces narrowing on generic-mode callers |
| Event naming drifts by runtime mode | §11.1 fixes `submission:*` taxonomy as primary |
| `inspect` becomes a dumping ground | Root minimal; new inspect APIs require named subsections + SPEC ownership |
| Codegen does not match v5 surface | PR-3 codegen update specifically generates `actions.x` typed handles |
| Long-running agents use stale capability tokens | SDK-SUBMIT-2 / 3 require re-check; agent skills reframed accordingly |
| `result.ok` misread as domain success | SDK-RESULT-1~3 + §9.1.1; PR-8 docs review warns on single-step `if (result.ok)` patterns lacking explicit rationale |
| ProposalRef lost across process restart / agent handoff | SDK-SUBMIT-15 / 16; ProposalRef is string-serializable and re-attachable through `waitForSettlement(ref)` |

---

## 18. Implementation Plan

This ADR is NOT a multi-phase deployable rollout. It is a **single coordinated PR series with ADR-025**, shipped as the unified Manifesto v5 release. Intermediate states are not deployable.

### PR-1 — SPEC finalization

- Add SDK v5 SPEC sections for: `ManifestoApp`, `ActionHandle`, `BoundAction`, `Admission`, `Blocker`, `PreviewResult`, `SubmitResultFor`, `SubmissionResult`, `ExecutionOutcome`, `ObserveSurface`, `InspectSurface`.
- Lineage SPEC amendment: decorator-owned `submit()` for lineage mode.
- Governance SPEC amendment: decorator-owned `submit()` for governance mode; `waitForSettlement()` semantics.
- Final `submission:*` event payload shapes.
- v3 → v5 compatibility/removal policy decision (see §21 Open Question 3).
- `@meta` annotation propagation mechanism decision (see §21 Open Question 6) — required before PR-2 implementation can fix the `createManifesto` signature.

### PR-2 — Core SDK shape

- `ManifestoApp` v5 root surface.
- `actions.*` typed property accessor + `action(name)` collision-safe accessor.
- `ActionHandle` with `info / available / check / preview / submit / bind`.
- `BoundAction` with method-style `intent()`.
- `Admission` discriminated union.
- `PreviewResult` discriminated union.
- `SubmissionResult` discriminated union with `mode` discriminator.

### PR-3 — Codegen update

- Codegen emits typed `actions.x` handles (not just action ref symbols).
- `ActionInput<TDomain, Name>` and `ActionArgs<TDomain, Name>` types match handle signatures.
- Domain facade type (`ManifestoDomainShape`) updated to support the new handle surface.

### PR-4 — Lineage decorator

- Lineage decorator implements `submit()` returning `LineageSubmissionResult`.
- `WorldRecord` field carries lineage worldId per ADR-025 §5.1.
- `commitAsync*` v3 names removed from public surface (or moved to compat path per PR-1 decision).

### PR-5 — Governance decorator

- Governance decorator implements `submit()` returning `GovernanceSubmissionResult`.
- `waitForSettlement()` semantics implemented.
- `proposeAsync*`, `waitForProposal*` v3 names removed from public surface.
- SDK-SUBMIT-7 / 8 invariants tested.

### PR-6 — Observe + Inspect

- `observe.state()` and `observe.event()` implemented.
- `submission:*` and `proposal:*` event taxonomy implemented.
- `inspect.*` surface implemented.
- `subscribe` / `on` v3 names removed from public surface.

### PR-7 — Studio + agent tooling

- Studio inspector consumes v5 surface directly.
- Agent skills/prompts updated:
  - `Intent` reframed as advanced primitive (not default user path).
  - Action-handle ladder presented as canonical agent grammar.
  - `submit()` semantics taught with explicit authority awareness.
- `@meta` annotation extraction for action-handle `info()`.

### PR-8 — Docs + codemod

- All docs updated to v5 surface.
- Migration guide.
- AST codemod for the §14 mapping table.
- README quickstart rewritten around `snapshot → check → preview → submit`.

### PR-9 — v5 release

- Co-released with ADR-025 as the unified v5 hard cut.
- Release notes reference ADR-025, this ADR, and any additional sibling v5 ADRs (e.g., `lineage-as-default`).
- v3 compatibility surface (if any) gated per PR-1 policy decision.

---

## 19. Test Plan

### 19.1 Admission tests

- Unavailable action returns `layer: "availability"`.
- Invalid input returns `layer: "input"`.
- Dispatchability failure returns `layer: "dispatchability"`.
- Unavailable action does NOT validate input.
- Invalid input does NOT evaluate dispatchability.
- `available()` remains input-free.
- `Blocker[]` populated only on the failing layer.

### 19.2 Preview tests

- `preview()` does not mutate runtime snapshot.
- `preview()` does not publish state.
- `preview()` does not enqueue runtime work.
- `preview()` preserves `complete | pending | halted | error`.
- `preview()` returns `admitted: false` for admission failures.
- `preview()` `changes` matches projected before/after diff.
- `admitted: true` with `status: "halted"` does NOT collapse into admission failure.

### 19.3 Submit tests

**Base mode:**
- `submit()` settles through base execution.
- `result.mode === "base"`.
- No lineage/governance fields appear in the static result type.
- `ExecutionOutcome` carries `ok / stop / fail` correctly.

**Lineage mode:**
- `submit()` seals a world record.
- `result.mode === "lineage"`.
- `result.world` carries lineage worldId per ADR-025.
- Base direct-dispatch path is NOT exposed as a public canonical write verb.
- `simulationMatchesCommit` verification flag pattern (Codex M2.2) producible from `before/after` + lineage refs.

**Governance mode:**
- `submit()` creates a proposal.
- `result.mode === "governance"`.
- Initial `result.status === "pending"` (default policy).
- `waitForSettlement()` observes settlement.
- Direct base/lineage execution is NOT reachable through any public verb on a governed runtime.
- `rejected | superseded | expired | cancelled | settlement_failed` all representable.
- **ProposalRef-only re-attachment:** persisting only `ProposalRef` (e.g., across process restart) and re-attaching via `app.waitForSettlement(ref)` on a governance runtime works equivalently to calling `waitForSettlement()` on the original pending result (SDK-SUBMIT-15, SDK-ROOT-5).
- **Type-level governance scoping:** `app.waitForSettlement(ref)` MUST be a compile error on base and lineage runtimes (SDK-ROOT-4).
- **ProposalRef serialization:** ProposalRef survives a string-serialization round trip and is accepted by `app.waitForSettlement(ref)` after deserialization (SDK-SUBMIT-16). Exact format determined in PR-1 SPEC.

### 19.4 Action collision tests

Domains with actions named `then`, `bind`, `constructor`, `inspect`, `snapshot`, `dispose`, or `action` must:
- Remain accessible through `app.action("then")`.
- Not corrupt runtime behavior.
- Not shadow runtime methods on `actions.*` in ways that break `dispose()` or other root operations.

### 19.5 Observe tests

- `observe.state()` receives terminal projected Snapshot changes only.
- `observe.event()` receives lifecycle events.
- Telemetry does not affect Snapshot identity (referential equality preserved when only telemetry fires).
- State publish and event telemetry remain on separate channels.
- `submission:*` event sequence matches actual lifecycle (admitted → submitted → settled).

### 19.6 Type tests

- `SubmitResultFor<"base">` excludes governance pending status.
- `SubmitResultFor<"lineage">` includes `world: WorldRecord`.
- `SubmitResultFor<"governance">` includes `proposal: ProposalRef` and `waitForSettlement()`.
- `BoundAction.intent()` is nullable.
- `Admission` discriminated union narrows correctly with `if (result.ok)`.
- `SubmissionResult` (generic mode) requires narrowing by `mode` field before mode-specific access (SDK-SUBMIT-11).
- `ManifestoApp<TDomain, "base">` is satisfiable: a concrete object with `actions / observe / inspect / snapshot / action / dispose` properties type-checks against this type. (Regression test against `Record<string, never>` index-signature collision; SDK-ROOT-7.)
- `ManifestoApp<TDomain, "governance">` exposes `waitForSettlement(ref)`.
- `ManifestoApp<TDomain, "base">` and `ManifestoApp<TDomain, "lineage">` do NOT expose `waitForSettlement(ref)` at the type level (SDK-ROOT-4).
- A generic helper `<TMode>(app: ManifestoApp<TDomain, TMode>)` with `TMode = "base" | "governance"` does NOT see `waitForSettlement(ref)` on `app` without first narrowing TMode to literal `"governance"` (SDK-ROOT-6 non-distributive intersection).

### 19.7 Cross-decorator authority tests

- Governance runtime: any attempt to reach base or lineage direct execution through any public verb fails at the type level OR at runtime.
- Decorator-owned `submit()` is verified — no generic helper bypasses decorator authority (SDK-SUBMIT-4).

### 19.8 Result envelope tests

- `result.ok = true` with `outcome.kind = "fail"` is a valid combination and exercised in tests.
- `result.ok = true` with `outcome.kind = "stop"` is a valid combination and exercised in tests.
- Documentation lint / docs-review check flags single-step `if (result.ok)` patterns that assume domain success (SDK-RESULT-3).
- Codemod helper for v3 → v5 migration emits the two-phase check pattern (SDK-RESULT-2).

### 19.9 Outcome mapping tests

- Core `complete` produces `ExecutionOutcome { kind: "ok" }` (SDK-OUTCOME-1).
- Core `halted` (MEL `stop`) produces `ExecutionOutcome { kind: "stop", reason }` (SDK-OUTCOME-2).
- Core `error` (MEL `fail` or invariant) produces `ExecutionOutcome { kind: "fail", error }` (SDK-OUTCOME-3).
- Governance pending status is exposed via `GovernanceSubmissionResult.status: "pending"` and not via `ExecutionOutcome` (§9.2.2).

---

## 20. Acceptance Criteria

This ADR is implemented when ALL of the following hold:

1. `ManifestoApp` v5 root surface exists with `snapshot()`, `actions.*`, `action(name)`, `observe.*`, `inspect.*`, `dispose()`.
2. `ActionHandle` exposes `info`, `available`, `check`, `preview`, `submit`, `bind`.
3. `BoundAction` exposes `check`, `preview`, `submit`, and method-style `intent()` returning nullable `Intent`.
4. `check()` returns the `Admission` discriminated union with first-failing-layer semantics (SDK-ADMISSION-1~4).
5. `preview()` returns the `PreviewResult` discriminated union preserving Core status (SDK-PREVIEW-1~7).
6. `submit()` returns mode-specific `SubmitResultFor<TMode>` types (SDK-SUBMIT-9 / 11).
7. `ExecutionOutcome` is the canonical `ok | stop | fail` discriminated union (SDK-SUBMIT-12~14).
8. Base `submit()` is decorator-owned; SDK-SUBMIT-4 / 5 enforced.
9. Lineage `submit()` preserves sealing/continuity and exposes `WorldRecord`; SDK-SUBMIT-6 enforced.
10. Governance `submit()` creates proposals and never directly executes lower-authority verbs; SDK-SUBMIT-7 / 8 enforced.
11. Governed runtimes do not expose lower-authority backdoors (verified by §19.7).
12. `observe.state()` and `observe.event()` are separate channels (SDK-OBSERVE-1).
13. `submission:*` and `proposal:*` event taxonomies are implemented.
14. `inspect.canonicalSnapshot()`, `inspect.graph()`, `inspect.action()`, `inspect.availableActions()`, `inspect.schemaHash()` are implemented.
15. Extension kernel remains under `@manifesto-ai/sdk/extensions` (SDK-EXT-1~4).
16. Action-name collision tests pass for reserved JS names and runtime-reserved names (SDK-ROOT-1~3).
17. Codegen emits typed `actions.x` handles matching `ActionHandle` shape.
18. v3 public APIs `getSnapshot`, `getCanonicalSnapshot`, `getSchemaGraph`, `getActionMetadata`, `getAvailableActions`, `isActionAvailable`, `isIntentDispatchable`, `getIntentBlockers`, `why`, `whyNot`, `explainIntent`, `simulate`, `simulateIntent`, `dispatchAsync*`, `commitAsync*`, `proposeAsync`, `waitForProposal*`, `subscribe`, `on` are removed from the canonical public surface (compat treatment per PR-1 policy).
19. AST codemod handles the §14 mapping table.
20. Migration guide published.
21. Studio and agent tooling consume the v5 surface.
22. Docs lead with `snapshot → check → preview → submit` as the canonical user path.
23. v5 ships in coordinated release with ADR-025.
24. `result.ok` envelope vs domain-outcome distinction is documented and taught (SDK-RESULT-1~3, §9.1.1). Docs lint flags single-step `if (result.ok)` patterns.
25. Core compute status → `ExecutionOutcome.kind` mapping is implemented per SDK-OUTCOME-1~3 (`complete → ok`, `halted → stop`, `error → fail`). Pending status is handled exclusively through `GovernanceSubmissionResult.status: "pending"` (§9.2.2), not through `ExecutionOutcome`.
26. ProposalRef durability is implemented via GovernanceSettlementSurface (§4.1): `app.waitForSettlement(ref)` works on governance runtimes after process restart and agent handoff (SDK-SUBMIT-15, SDK-ROOT-5). Base and lineage runtimes do NOT expose this method at the type level (SDK-ROOT-4).
27. ProposalRef survives a string-serialization round trip and is stable across runtime restarts (SDK-SUBMIT-16). Exact serialization format resolved in PR-1 SPEC.

---

## 21. Open Questions

### 21.1 First-class `explain()` method?

Should `explain(input)` exist as a first-class method on `ActionHandle`, or should explanation remain distributed across `check()` (admission diagnostics) and `preview().diagnostics` (execution diagnostics)?

**Disposition:** Defer to v5+ based on Studio and agent feedback. The combined output of `check()` + `preview()` covers known explanation needs.

### 21.2 Governance immediate-settlement policy

Should governed `submit()` ever return `status: "settled"` immediately for auto-approved policies, or always return `pending` with `waitForSettlement()` resolving synchronously?

**Disposition:** Always start with `pending`. Auto-approved settlement still produces a proposal record for audit. Settlement timing is observed via `waitForSettlement()`. Resolved in PR-1 SPEC.

### 21.3 v3 compatibility surface

Are v3 APIs removed entirely in v5, or moved to `@manifesto-ai/sdk/compat-v4`?

**Disposition:** Resolved in PR-1. Default position: full removal at v5, no compat package, given bus factor = 1 and Codex as sole material external user. If compat is required, it lives at `@manifesto-ai/sdk/compat-v4` and is documented as deprecated-on-arrival.

### 21.4 Codegen output for both `actions.x` and `action("x")`

Should codegen generate both property-accessor paths (`actions.x`) and typed-helper paths (`action("x")` typed return)?

**Disposition:** Yes. Both must work for non-colliding names; only `action("x")` is required to work for colliding names.

### 21.5 Re-check cadence guidance

Should the SDK provide explicit guidance/helpers for "re-check before submit" patterns in long-running agents?

**Disposition:** Defer. SDK-SUBMIT-2 / 3 establish the invariant. Agent-side helpers are a tooling concern.

### 21.6 `@meta` annotation propagation to `ActionHandle.info()`

§6.7 (Studio + agent tooling) and the implementation plan (PR-7) call for `@meta` annotation extraction to surface through `ActionHandle.info()`. The propagation mechanism is not yet specified. Two options:

**Option 1 — Annotations as a separate runtime option:**

```ts
createManifesto(module.schema, effects, {
  annotations: module.annotations,
})
```

Preserves the current Compiler contract that "runtime entrypoints are `DomainSchema`-only" by treating annotations as a sidecar passed alongside, not inside, the schema.

**Option 2 — Accept the full `DomainModule`:**

```ts
createManifesto(module, effects)  // module: { schema, graph, annotations, sourceMap }
```

More ergonomic but conflicts with the current "runtime entrypoints are `DomainSchema`-only" contract. This is a larger architectural decision that affects compiler/runtime boundary semantics beyond this ADR.

**Disposition:** Resolved in PR-1 SPEC. Default leaning is Option 1 (preserves current contract). Option 2 requires its own ADR if pursued.

---

## 22. Final Decision

**Accepted.**

Manifesto v5 reorganizes the SDK public surface around the action candidate as the primary user-facing object. The new ladder — `info → available → check → preview → submit` plus `bind` — supersedes the v3 22-function surface and unifies write verbs across base, lineage, and governance runtimes through a single law-aware `submit()`.

The unification preserves authority semantics through three mechanisms:

- **Mode-specific result types** (`SubmitResultFor<TMode>`) make authority differences visible at the type level.
- **Decorator-owned `submit()` implementations** (SDK-SUBMIT-4) prevent generic helpers from bypassing authority.
- **The core principle** (§3) — *"the API is unified, but authority differences are never hidden"* — guides every implementation choice.

This ADR is the **SDK surface layer** of the Manifesto v5 hard cut. ADR-025 is the **substrate layer**. The two ship as a single coordinated v5 release. The release narrative:

> *Manifesto v5 is the release where the runtime exposes the same ontology MEL authors and agents reason about, through the same ladder humans and agents follow.*

The cut is justified by:

- **External evidence:** Codex M0–M3 production usage independently converged on the action-candidate ladder (Codex Report §2). The unified ladder is not a hypothesis; it is an observed pattern.
- **Window economics:** Bus factor = 1, pre-stable artifacts. The marginal cost of any equivalent cut rises monotonically beyond this window.
- **Substrate alignment:** ADR-025 already breaks every read site. Coupling write-site changes into the same release halves total user migration cost.

The result is that Manifesto v5 makes Codex's M3 framing canonical:

> "Manifesto should own the grammar of experience." (Codex Report §9)

The grammar — `info / available / check / preview / submit` — is the surface this ADR defines.

---

## Appendix A — Revision History

- **revision 1 (2026-04-29):** Initial draft (mixed Korean/English, Status: Proposed).
- **revision 2 (2026-04-29):** Cross-review fixes integrated into the formal English draft:
  - **Blocker 1** — removed Phase 1 experimental export. Single coordinated PR series with ADR-025; v5 narrative unified.
  - **Blocker 2** — strengthened §13 Extension Kernel rationale from naming concern to architectural concern (active runtime law boundary vs static schema operations).
  - **Blocker 3** — defined `ExecutionOutcome` as the canonical `ok | stop | fail` discriminated union grounded in Codex M3 evidence (SDK-SUBMIT-12~14).
  - Added SDK-SUBMIT-11 for generic-mode narrowing.
  - Added §5.1 explaining `bind()` rationale (candidate-as-noun).
  - Added `Blocker` type definition in §7.1.
  - Resolved §11 event taxonomy to `submission:*` (in body, not open question).
  - Resolved §10 / §12 `canonicalSnapshot()` naming retention (in body, not open question).
  - Added §20 Acceptance Criteria section.
- **revision 3 (2026-04-29):** Status promoted to Accepted. ADR number 026 assigned. Codex M0–M3 Usage Report cited as primary external evidence; cross-references added throughout §1, §3, §9, §22. Added Appendix B reference.
- **revision 4 (2026-04-29):** GPT cross-review GO-with-checkpoint integration:
  - Added §9.1.1 distinguishing `result.ok` (protocol envelope) from domain success. SDK-RESULT-1~3 normative rules added.
  - Added §9.2.1 mapping Core compute status to `ExecutionOutcome.kind`. SDK-OUTCOME-1~4 normative rules added, including explicit handling of `pending` at submit boundary (representation deferred to PR-1 SPEC).
  - Added SDK-SUBMIT-15 / 16 establishing ProposalRef durability — settlement MUST be re-observable via persisted ProposalRef alone, and ProposalRef MUST be JSON-serializable. This addresses the Governance long-running agent / process restart scenario flagged by GPT cross-review.
  - Added §17 risk rows for `result.ok` misread, ProposalRef loss, and `pending` silent coercion.
  - Added §19.3 ProposalRef re-attachment and serialization tests.
  - Added §19.8 (result envelope tests) and §19.9 (outcome mapping tests).
  - Added Acceptance Criteria 24, 25, 26, 27.
  - Non-blocking checkpoints from GPT cross-review (large snapshot payload policy, additional governance authority type tests) deferred to PR-1 SPEC and PR-5 implementation respectively.
- **revision 5 (2026-04-29):** Self-review correction of revision 4. Three rules accepted from GPT cross-review were over-tightened; this revision corrects them.
  - **Removed SDK-OUTCOME-4** and the corresponding `pending` row from the §9.2.1 mapping table. The rule was defending against a scenario that cannot legitimately arise: `submit()` resolving with `status: "settled"` while Core status is internally `pending` would indicate a Host bug, not a domain outcome the SDK mapping must absorb. Legitimate pending (governance proposal awaiting decision) is already represented by `GovernanceSubmissionResult.status: "pending"`. Conflating the two would re-introduce v3-style ambiguity at a different layer.
  - **Added §9.2.2** explicitly explaining why `pending` is not in the `ExecutionOutcome` triad. This closes the explanatory gap left by removing SDK-OUTCOME-4 and prevents future implementers from re-introducing the conflation.
  - **Weakened SDK-RESULT-3** from `MUST NOT` to `SHOULD NOT`. Single-step `if (result.ok)` patterns are footguns by default but legitimate in fire-and-forget contexts (audit logging, telemetry submission). Docs review warns rather than rejects unconditionally; explicit rationale is the escape hatch.
  - **Weakened SDK-SUBMIT-16** from "JSON-safe" to "stable string representation". The actual serialization format (JSON, structured-clone string-encoding, opaque token, etc.) is resolved in PR-1 SPEC. The minimum requirement is process-boundary survival, not any specific format. ProposalRef carrying a binary hash that gets string-encoded is now valid.
  - Updated §17 risk row wording (removed SDK-OUTCOME-4 row, softened other phrasings), §19.3 / §19.9 test descriptions, and Acceptance Criteria 25 / 27 to reflect the rule changes above.
  - **Lesson recorded:** revision 4 accepted external cross-review checkpoints too quickly. SDK-OUTCOME-4 was a "defending against impossibility" rule that should have been caught by internal model walk-through before adoption. The principle going forward: when integrating cross-review feedback that proposes new normative rules, the integration step MUST include an explicit *can this scenario actually occur in our model?* check. A rule defending against a scenario that cannot occur is a dead rule and adds noise to the spec.
- **revision 6 (2026-04-29):** GPT cross-review GO-blocker fix — type / surface contract reconciliation.
  - **§4.1 ManifestoApp type refactored** into `BaseManifestoApp & (TMode extends "governance" ? GovernanceSettlementSurface : Record<string, never>)`. Previously, SDK-SUBMIT-15 required `runtime.waitForSettlement(ref)` and §19.3 / §20-26 tested for it, but the ManifestoApp type definition exposed no such method. This was a type/surface inconsistency, not a behavioral one — the example in SDK-SUBMIT-15 referenced a method that did not exist on the declared type. Fixed by introducing the `GovernanceSettlementSurface<TDomain>` extension type, intersected only when `TMode` is `"governance"`.
  - **Added SDK-ROOT-4** (governance settlement surface MUST be type-level reachable only on governance-mode runtimes) and **SDK-ROOT-5** (governance `app.waitForSettlement(ref)` MUST work equivalently to original-result `waitForSettlement()`, accepting persisted ProposalRef across process boundaries).
  - **Updated SDK-SUBMIT-15 example** to use `app.waitForSettlement(ref)` (governance runtime root) instead of `runtime.waitForSettlement(ref)`, with explicit `app: ManifestoApp<TDomain, "governance">` type annotation. Cross-references SDK-ROOT-4.
  - **Updated §19.3 ProposalRef tests** to assert (a) governance-runtime re-attachment works via `app.waitForSettlement(ref)`, (b) base/lineage runtimes produce a *compile error* on `app.waitForSettlement(ref)` (type-level governance scoping enforced).
  - **Updated Acceptance Criterion 26** to reference GovernanceSettlementSurface and the type-level scoping requirement.
  - **Added §21.6 Open Question** for `@meta` annotation propagation mechanism (Option 1: separate runtime option vs Option 2: accept full `DomainModule`). Default leaning is Option 1 — preserves current "runtime entrypoints are `DomainSchema`-only" Compiler contract. Decision deferred to PR-1 SPEC.
  - **Added PR-1 SPEC scope item** for §21.6 resolution; flagged as required-before-PR-2 because `createManifesto` signature depends on it.
  - **Lesson recorded:** revision 4 / revision 5 work modified rules and tests but did not propagate downward into the type definition itself. Future revisions integrating new normative rules MUST verify that the rule is reachable from a concrete type/method — otherwise the rule is unimplementable and the inconsistency is silent until cross-review.
- **revision 7 (2026-04-29):** GPT cross-review type-level bug fix — TypeScript semantics correction.
  - **`Record<string, never>` replaced with `Record<never, never>` (aliased as `EmptySurface`).** The revision 6 patch chose `Record<string, never>` as the empty-surface side of the conditional intersection, intending it as a no-op. In TypeScript, `Record<string, never>` is NOT a no-op: it imposes an index signature requiring every string key to map to `never`, which conflicts with `BaseManifestoApp`'s named properties (`actions`, `observe`, `inspect`, `snapshot`, `action`, `dispose`). The result was an unsatisfiable type for `ManifestoApp<TDomain, "base">` and `ManifestoApp<TDomain, "lineage">` — concrete implementations could not satisfy the type. Fixed via `Record<never, never>`, a true empty object type whose intersection acts as a genuine no-op.
  - **Conditional changed from distributive to non-distributive form.** Previously `TMode extends "governance" ? ... : EmptySurface`. Now `[TMode] extends ["governance"] ? ... : EmptySurface`. Rationale: a generic helper receiving a union `TMode` (e.g., `"base" | "governance"`) under the distributive form would collapse to `(EmptySurface | GovernanceSettlementSurface)`, silently exposing governance-only methods at the type level. The tuple-wrapped form requires `TMode` to literally be `"governance"` for the extension to apply. This complements SDK-SUBMIT-11's generic-helper safety constraint at the runtime-surface layer.
  - **Added SDK-ROOT-6** (mandates the non-distributive conditional form) and **SDK-ROOT-7** (forbids `Record<string, never>` in the empty-surface position).
  - **Added §19.6 type tests** for: (a) `ManifestoApp<TDomain, "base">` satisfiability — regression test against the `Record<string, never>` collision; (b) base/lineage NOT exposing `waitForSettlement(ref)`; (c) generic-helper safety — union-mode `TMode` does not see governance methods without explicit literal-narrowing.
  - **Lesson recorded:** the revision-by-revision evolution of this ADR has surfaced a consistent pattern. Each revision tightened one layer but left a deeper layer unchecked: r4 added rules without scenario walk-through; r5 corrected scenario reachability but didn't propagate to type definitions; r6 added type definitions but didn't walk through TypeScript semantics; r7 corrected TypeScript semantics. The general principle: when integrating any normative change, the integration MUST walk through (a) the scenario it defends against, (b) reachability from concrete code, AND (c) the language-level semantics of the types/syntax used. Skipping any of these layers leaves a silent gap detectable only by external cross-review. This is normal evolution of a non-trivial spec; the pattern is recorded here so future revisions can pre-empt it.

## Appendix B — Codex M0–M3 Usage Report Cross-Reference

This ADR's evidence base draws from the Codex Manifesto Usage Report (M0–M3, 2026-04-29). Specific cross-references:

| ADR Section | Codex Report Section | Use |
|-------------|----------------------|-----|
| §1.2 | §2 (commit pattern) | Five-step ladder converged independently in production |
| §1.2 | §2 (`simulateThenCommit`, `commitRuntimeStep` helpers) | Wrapper pattern as evidence of v3 surface friction |
| §2.3 | §9 ("grammar of experience") | Stable vocabulary requirement for agent grounding |
| §9.2 | §5 ("Explicit `ok | stop | fail`") | `ExecutionOutcome` triad grounded in production evidence |
| §9.5 | §5 (Lineage-First Public Results) | `WorldRecord` as the lineage ref, not duplicated snapshot bytes |
| §16.1 | §5 (`@meta` annotations) | `info()` as agent contract surface, not debug-only metadata |
| §22 | §9 (final principle) | Release narrative |

The Codex report itself is preserved as `docs/evidence/codex-manifesto-usage-report-m0-m3.md` (or equivalent path) for traceability.