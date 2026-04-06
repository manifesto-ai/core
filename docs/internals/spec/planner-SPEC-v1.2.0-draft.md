# Manifesto Planner Specification

> **Status:** Normative (Draft)
> **Version:** 1.2.0
> **Scope:** `@manifesto-ai/planner` — Pluggable Planning Strategy Decorator
> **Requires:** SDK SPEC v3.1.0 + pending `RuntimeKernel` additive patch (§10.4)
> **Compatible with:** Core SPEC v4.0.0, Host Contract v4.0.0, Lineage SPEC v3.0.0, Governance SPEC v3.0.0
> **Implements:** ADR-017 v3.1 (Capability Decorator Pattern)
> **Author:** 정성우 (Architect)
> **Date:** 2026-04-07

---

## Revision History

| Version | Date | Change |
|---------|------|--------|
| v1.0.0 | 2026-04-06 | Initial draft. `withPlanner`, `createPlanner`, built-in strategies. |
| v1.0.1 | 2026-04-06 | Fix three critical review blockers: (1) `Plan.bestAction` nullable for `no_actions`, (2) snapshot type surface aligned to ADR-018 projected/canonical split, (3) simulation seam formalized via `@manifesto-ai/sdk/provider` `RuntimeKernel`. |
| v1.1.0 | 2026-04-06 | Governance-required composition. `PlannerComposable<T>` replaces phantom law intersection — planner owns its own terminal composable type whose `activate()` returns `GovernanceInstance<T> & PlannerRuntime<T>`. `preview()` uses `TypedActionRef<T>` for compile-time safety. `preview()` added (renamed from `simulate()` to avoid SDK collision). `SelectedAction.intent` added. `CanonicalSimulationStep` introduced; strategy internals fully canonical; `withPlanner` projects `RawPlan → Plan` at single boundary. SDK simulation seam (`simulateSync`, `getAvailableActionsFor`, `isActionAvailableFor`) declared as explicit prerequisite. |
| v1.2.0 | 2026-04-07 | Tighten public contract without changing planner architecture. `enumerator-first` DX is preserved; `strategy` remains a separate seam. `PLAN-ROLE-1` now distinguishes primary composition concepts from secondary public helpers. Runtime/kernel naming is aligned to the SDK seam. Runtime surfaces preserve `TermK` generics. `PlanOptions` overrides are explicitly clamped by hard policy. `createCoreEnumerator()` is defined as intentionally conservative and MUST NOT invent domain-specific inputs. User-facing trajectory actions no longer expose internal `candidateId`. |

---

## 1. Purpose

This document defines the public contract for `@manifesto-ai/planner`.

The planner package adds **foresight and strategy** to a Manifesto world. It exploits Core's deterministic simulation capability (`computeSync`) to let AI agents evaluate future states before committing actions.

The planner does not own simulation. Core owns computation. The planner owns **strategic evaluation and search** over Core's simulation substrate.

This document is normative for planner-owned behavior. It does not restate Core compute semantics, SDK activation semantics, or lineage/governance contracts. Those remain the responsibility of their owning package specs.

---

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

Normative rule prefixes:

| Prefix | Domain |
|--------|--------|
| `PLAN-ROLE-*` | Package ownership and boundary |
| `PLAN-BUILD-*` | `createPlanner()` builder rules |
| `PLAN-DECO-*` | `withPlanner()` decorator rules |
| `PLAN-ACT-*` | Activation and runtime rules |
| `PLAN-STRAT-*` | Strategy interface contract |
| `PLAN-EVAL-*` | Evaluation and term rules |
| `PLAN-SIM-*` | Simulation boundary rules |
| `PLAN-HARD-*` | Hard policy enforcement |
| `PLAN-PARAM-*` | Runtime parameter mutation |
| `PLAN-ENUM-*` | Action enumeration |
| `PLAN-SNAP-*` | Snapshot boundary (projected vs canonical) |
| `PLAN-SIM-SEAM-*` | SDK provider seam for simulation access |
| `PLAN-SIM-PREVIEW-*` | `preview()` single-step preview |
| `PLAN-ACT-INTENT-*` | SelectedAction intent contract |
| `PLAN-EVAL-STRAT-*` | Strategy-facing evaluator contract |
| `PLAN-STRAT-RAW-*` | RawPlan canonical output contract |

---

## 3. Package Role and Boundaries

The planner owns strategic evaluation and search. It does not own computation, lineage, governance, or the base runtime.

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-ROLE-1 | MUST | The planner package MUST own two primary composition concepts: `createPlanner()` and `withPlanner()`. It MAY additionally expose built-in strategies and enumerator helpers as secondary public surface |
| PLAN-ROLE-2 | MUST NOT | The planner MUST NOT execute effects. All simulation MUST be read-only (Core `computeSync` + `apply` + `applySystemDelta` without Host effect execution) |
| PLAN-ROLE-3 | MUST NOT | The planner MUST NOT modify the target world's live snapshot. Simulation MUST operate on copies |
| PLAN-ROLE-4 | MUST | The planner MUST require `withGovernance()` composition as a prerequisite, mirroring how `withGovernance()` requires `withLineage()`. Package dependencies MUST be limited to `@manifesto-ai/sdk` and `@manifesto-ai/governance` (which transitively provides `@manifesto-ai/lineage` and `@manifesto-ai/core`). The planner accesses Core computation through `@manifesto-ai/sdk/provider`'s `RuntimeKernel` seam |
| PLAN-ROLE-5 | MUST | The planner MUST follow the ADR-017 Capability Decorator Pattern. No runtime verbs before `activate()` |
| PLAN-ROLE-6 | MUST NOT | The planner MUST NOT submit, commit, or propose intents on behalf of the caller. `plan()` returns an intent recommendation; the caller decides the submission verb |
| PLAN-ROLE-7 | MUST | The planner MUST access planning operations (`simulateSync`, `getAvailableActionsFor`, `isActionAvailableFor`, and live canonical snapshot reads) exclusively through the `RuntimeKernel` obtained via `getRuntimeKernelFactory()` from `@manifesto-ai/sdk/provider` |

---

## 4. Ontological Position

### 4.1 What the Planner Adds

```text
createManifesto()  — defines a world with only the present.
withLineage()      — gives that world time and continuity.
withGovernance()   — gives that world legitimacy and law.
withPlanner()      — gives that world foresight and strategy.
activate()         — opens the world.
```

This is the **only valid composition order**. `withPlanner()` requires `withGovernance()`, which requires `withLineage()`. This mirrors the existing prerequisite chain and ensures a single execution verb (`proposeAsync`) for all planner-equipped worlds.

### 4.2 The Planning Equation

Planning in Manifesto is an application of Core's deterministic computation:

```text
plan(snapshot, availableActions, strategy, evaluator, hardPolicy)
  → for each candidate path:
      simulate: computeSync(schema, snapshot, intent, context) → patches, systemDelta
      apply:    apply(schema, snapshot, patches, context) → snapshot'
      evaluate: evaluator.terms(features(snapshot'), parameters) → scores
  → strategy selects best path based on scores
  → return Plan { bestAction, alternatives, stats }
```

This is possible because Core is pure. `computeSync` does not mutate state, does not execute effects, and always returns the same result for the same input. The planner calls it repeatedly on hypothetical snapshots without affecting the live world.

### 4.3 Policy Layering

The planner's internal policy is organized in three layers. This layering is constitutional — violating it invalidates the planner's safety properties.

| Layer | Mutability | Examples | Mechanism |
|-------|-----------|----------|-----------|
| **Hard Policy** | Immutable at runtime | maxDepth, maxExpansions, timeoutMs, allowedTerms | `HardPolicy` config object |
| **Soft Policy** | Adjustable at runtime, auditable | reward weights, penalty coefficients, risk thresholds | `parameters` in `createPlanner()`, mutated via `setParameter()` |
| **Ephemeral Policy** | Per-invocation | budget override, abort signal, depth override | `PlanOptions` argument to `plan()` |

**Constitutional invariant:** The evaluator (soft policy) MUST NOT modify hard policy. The entity being improved and the entity judging the improvement MUST NOT be in the same layer.

> **Rationale:** If an agent can modify both its reward function and its safety constraints, self-improvement degenerates into self-judgment hacking. Hard policy exists precisely to be outside the agent's reach.

### 4.4 Snapshot Boundary

The planner straddles two snapshot surfaces defined by ADR-018:

| Surface | Type | Where Used | Owner |
|---------|------|-----------|-------|
| **CanonicalSnapshot** | `CanonicalSnapshot<T["state"]>` | Simulator, ActionEnumerator, StrategyContext, PlannerEvaluator (external interface) | Core/Host boundary — full substrate including `$host`, `$mel`, `meta.*`, `system.pendingRequirements` |
| **Snapshot (projected)** | `Snapshot<T["state"]>` | Feature extractors (inside evaluator), trajectory output in `Plan` | SDK application boundary — curated read model |

**The planner is a projection boundary.** Internally, strategies, the simulator, the enumerator, and the strategy-facing evaluator operate entirely on `CanonicalSnapshot`. Externally, feature extractors and the user-facing `Plan` output use the projected `Snapshot` — the same surface users see from `getSnapshot()`. The projection happens in exactly two places: (1) inside `PlannerEvaluator.evaluate()` before calling feature extractors, and (2) inside `withPlanner` when converting `RawPlan → Plan`.

**Normative rules:**

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-SNAP-1 | MUST | The simulator, enumerator, `StrategyContext`, and strategy-facing `PlannerEvaluator` MUST operate on `CanonicalSnapshot<T["state"]>`. Strategies never see or produce projected snapshots |
| PLAN-SNAP-2 | MUST | Feature extractor functions in `createPlanner().features()` MUST receive the **projected** `Snapshot<T["state"]>`, consistent with the SDK `getSnapshot()` contract |
| PLAN-SNAP-3 | MUST | The `PlannerEvaluator` MUST project `CanonicalSnapshot` → `Snapshot` before invoking feature extractors, and `CanonicalSimulationStep[]` → `SimulationStep[]` before invoking trajectory feature extractors. The projection function MUST be the same SDK projection used by `getSnapshot()` |
| PLAN-SNAP-4 | MUST | User-facing `SimulationStep` (§8.5) in `Plan` and `SelectedAction` MUST contain projected `Snapshot<T["state"]>`. Strategy-internal `CanonicalSimulationStep` (§9.3) MUST contain `CanonicalSnapshot<T["state"]>` |
| PLAN-SNAP-5 | MUST | `StrategyContext.currentSnapshot` MUST be `CanonicalSnapshot<T["state"]>` |
| PLAN-SNAP-6 | MUST | Strategies MUST return `RawPlan` containing `CanonicalSimulationStep`. Strategies MUST NOT project snapshots. Projection is the exclusive responsibility of `withPlanner` |
| PLAN-SNAP-7 | MUST | `withPlanner` MUST project `RawPlan` (canonical) → `Plan` (projected) as the final step of `plan()`. This is the single projection boundary for trajectory data |

> **Rationale:** Feature extractors are written by domain users who think in terms of `getSnapshot()`. Forcing them to handle `$host`, `$mel`, or canonical `meta` fields would leak implementation details. The simulator needs the full substrate because Core's APIs require it. The planner bridges these two worlds.

---

## 5. `createPlanner()` — Planner Builder

### 5.1 Signature

```typescript
function createPlanner<T extends ManifestoDomainShape>(): PlannerBuilder0<T>;
```

`createPlanner()` returns a fluent builder. The builder accumulates type information through chained method calls, culminating in `.build()`.

### 5.2 Builder Chain

The builder enforces a fixed method order. Each step captures type parameters that flow into subsequent steps.

```text
createPlanner<T>()
  .features({...})                    → PlannerBuilder1<T, FK>
  .trajectoryFeatures({...})          → PlannerBuilder2<T, FK, TFK>     (optional)
  .parameters({...})                  → PlannerBuilder3<T, FK, TFK, PK> (optional)
  .terms({...})                       → PlannerBuilder4<T>
  .build()                            → Planner<T>
```

Where:
- `FK` = string union of feature keys
- `TFK` = string union of trajectory feature keys (or `never` if skipped)
- `PK` = string union of parameter keys (or `never` if skipped)

### 5.3 Builder Interfaces

```typescript
interface PlannerBuilder0<T extends ManifestoDomainShape> {
  features<F extends Record<string, (snapshot: Snapshot<T["state"]>) => number>>(
    features: F
  ): PlannerBuilder1<T, keyof F & string>;
}

interface PlannerBuilder1<T extends ManifestoDomainShape, FK extends string> {
  trajectoryFeatures<TF extends Record<string, (trajectory: readonly SimulationStep<T>[]) => number>>(
    features: TF
  ): PlannerBuilder2<T, FK, keyof TF & string>;

  parameters<P extends Record<string, number>>(
    params: P
  ): PlannerBuilder3<T, FK, never, keyof P & string>;

  terms<TM extends Record<string, (
    f: Record<FK, number>,
    p: {}
  ) => number>>(
    terms: TM
  ): PlannerBuilder4<T, never, keyof TM & string>;
}

interface PlannerBuilder2<T extends ManifestoDomainShape, FK extends string, TFK extends string> {
  parameters<P extends Record<string, number>>(
    params: P
  ): PlannerBuilder3<T, FK, TFK, keyof P & string>;

  terms<TM extends Record<string, (
    f: Record<FK | TFK, number>,
    p: {}
  ) => number>>(
    terms: TM
  ): PlannerBuilder4<T, never, keyof TM & string>;
}

interface PlannerBuilder3<
  T extends ManifestoDomainShape,
  FK extends string,
  TFK extends string,
  PK extends string
> {
  terms<TM extends Record<string, (
    f: Record<FK | TFK, number>,
    p: Record<PK, number>
  ) => number>>(
    terms: TM
  ): PlannerBuilder4<T, PK, keyof TM & string>;
}

interface PlannerBuilder4<
  T extends ManifestoDomainShape,
  PK extends string = never,
  TermK extends string = string
> {
  build(): Planner<T, PK, TermK>;
}
```

### 5.4 Builder Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-BUILD-1 | MUST | `.features()` MUST be the first builder call. A planner without features is not valid |
| PLAN-BUILD-2 | MAY | `.trajectoryFeatures()` MAY be omitted. When omitted, trajectory features are empty (`TFK = never`) |
| PLAN-BUILD-3 | MAY | `.parameters()` MAY be omitted. When omitted, parameters are empty (`PK = never`) and `p` in term functions receives `{}` |
| PLAN-BUILD-4 | MUST | `.terms()` MUST define at least one term |
| PLAN-BUILD-5 | MUST | `.build()` MUST be the terminal call. The builder is consumed; calling methods after `.build()` is not possible |
| PLAN-BUILD-6 | MUST | Feature extractor functions MUST be pure. They MUST NOT mutate the snapshot |
| PLAN-BUILD-7 | MUST | Term functions MUST be pure. They MUST NOT have side effects |
| PLAN-BUILD-8 | MUST | Feature keys, trajectory feature keys, parameter keys, and term keys MUST each be unique within their respective namespaces |
| PLAN-BUILD-9 | MUST | The `f` argument in term functions MUST contain the union of feature keys and trajectory feature keys. TypeScript MUST enforce this at compile time via generic propagation |
| PLAN-BUILD-10 | MUST | The `p` argument in term functions MUST contain the parameter keys. TypeScript MUST enforce this at compile time via generic propagation |

---

## 6. `Planner<T>` — Planner Instance

### 6.1 Interface

```typescript
interface Planner<
  T extends ManifestoDomainShape,
  PK extends string = string,
  TermK extends string = string
> {
  /** Defined term names. Used for strategy compatibility validation at activation. */
  readonly definedTerms: readonly TermK[];

  /**
   * Mutate a parameter value at runtime.
   * Parameters are soft policy — adjustable within hard policy bounds.
   */
  setParameter(key: PK, value: number): void;

  /** Read current parameter values. */
  getParameters(): Readonly<Record<PK, number>>;

  /**
   * Evaluate a trajectory against defined terms.
   * Consumed by strategies via PlannerEvaluator interface.
   * Accepts canonical snapshots; projects internally before calling feature extractors.
   */
  evaluate(
    trajectory: readonly CanonicalSimulationStep<T>[],
    finalSnapshot: CanonicalSnapshot<T["state"]>
  ): EvaluationResult<TermK>;
}
```

### 6.2 EvaluationResult

```typescript
interface EvaluationResult<TermK extends string = string> {
  /** Score per defined term. */
  readonly terms: Readonly<Record<TermK, number>>;
}
```

### 6.3 Planner Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-PARAM-1 | MUST | `setParameter()` MUST only accept keys defined in `.parameters()`. TypeScript MUST enforce this via `PK` |
| PLAN-PARAM-2 | MUST | `setParameter()` MUST take effect on the next `plan()` call. It MUST NOT retroactively affect in-progress planning |
| PLAN-PARAM-3 | MUST | `getParameters()` MUST return a frozen copy, not a mutable reference |
| PLAN-EVAL-1 | MUST | `evaluate()` MUST project canonical snapshots to projected `Snapshot<T["state"]>` before calling feature extractors on `finalSnapshot`, call trajectory feature extractors on the trajectory, and then compute each term function with the combined features and current parameters |
| PLAN-EVAL-2 | MUST | `evaluate()` MUST return a result containing all defined terms. Missing terms are a contract violation |
| PLAN-EVAL-3 | MUST | Feature extraction and term computation MUST be synchronous. No async operations |
| PLAN-EVAL-4 | MUST | Feature extractors MUST receive projected `Snapshot<T["state"]>` (per PLAN-SNAP-2), never `CanonicalSnapshot` |

---

## 7. `withPlanner()` — Decorator

### 7.1 Signature

```typescript
/**
 * withPlanner consumes a governed composable manifesto and returns
 * a PlannerComposable — a planner-owned terminal composable type.
 *
 * PlannerComposable is NOT ComposableManifesto. It cannot be passed
 * to further with*() decorators (PLAN-DECO-4). Its activate() returns
 * a concrete intersection type that the SDK's phantom law mapping
 * does not need to know about.
 */
function withPlanner<
  T extends ManifestoDomainShape,
  PK extends string = string,
  TermK extends string = string
>(
  manifesto: ComposableManifesto<T, GovernanceLaws>,
  config: WithPlannerConfig<T, PK, TermK>
): PlannerComposable<T, TermK>;
```

### 7.1.1 PlannerComposable

```typescript
/**
 * Terminal composable owned by @manifesto-ai/planner.
 * Not assignable to ComposableManifesto — no further decoration is possible.
 */
interface PlannerComposable<
  T extends ManifestoDomainShape,
  TermK extends string = string
> {
  /**
   * Activate the governed + planner world.
   * Returns GovernanceInstance (all governance + lineage verbs)
   * intersected with PlannerRuntime (preview + plan).
   *
   * One-shot: second call throws AlreadyActivatedError.
   */
  activate(): GovernanceInstance<T> & PlannerRuntime<T, TermK>;
}
```

`PlannerComposable` solves the phantom law mapping problem: the SDK's `ActivatedInstance<T, Laws>` only knows about `BaseLaws`, `LineageLaws`, and `GovernanceLaws`. Rather than requiring SDK to add a `PlannerLaws` mapping, the planner owns its own activation path. Internally, `withPlanner` uses `getRuntimeKernelFactory()` to obtain the governed kernel and wraps it with planner capabilities at activation time.

> **Rationale:** The SDK's phantom law system maps `Laws → ActivatedInstance` through a closed set. Adding new law markers would require SDK SPEC changes for every new capability decorator. By owning its own composable type, the planner package is self-contained — SDK never needs to know about planners.

`L extends GovernanceLaws` enforces the governance prerequisite at compile time. Passing a base or lineage-only composable manifesto is a type error.

### 7.2 Config

```typescript
interface WithPlannerConfig<
  T extends ManifestoDomainShape,
  PK extends string = string,
  TermK extends string = string
> {
  /** Planner instance created via createPlanner().build(). */
  readonly planner: Planner<T, PK, TermK>;

  /** Search strategy. Determines how the simulation tree is explored. */
  readonly strategy: Strategy<T, TermK>;

  /**
   * Optional advanced extension point for domain-specific candidate generation.
   * When omitted, the runtime uses createCoreEnumerator(), which is intentionally conservative.
   */
  readonly enumerator?: ActionEnumerator<T>;

  /** Hard policy. Immutable runtime constraints. */
  readonly hardPolicy?: HardPolicy;
}
```

The primary user-facing seams are `planner` and `strategy`. `enumerator` is an advanced extension seam for domains where action availability alone is not enough to generate useful input candidates.

### 7.3 HardPolicy

```typescript
interface HardPolicy {
  /** Maximum simulation depth per rollout/path. Default: 100. */
  readonly maxDepth?: number;

  /** Maximum total node expansions per plan() call. Default: 10_000. */
  readonly maxExpansions?: number;

  /** Wall-clock timeout in milliseconds per plan() call. Default: 5_000. */
  readonly timeoutMs?: number;
}
```

### 7.4 Decorator Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-DECO-1 | MUST | `withPlanner()` MUST accept a `ComposableManifesto<T, GovernanceLaws>` and return a `PlannerComposable<T, TermK>` — a planner-owned terminal composable, NOT a `ComposableManifesto` |
| PLAN-DECO-2 | MUST NOT | `withPlanner()` MUST NOT expose `plan()`, `preview()`, or any `PlannerRuntime` verb before `activate()` |
| PLAN-DECO-3 | MUST | `withPlanner()` MUST require prior `withGovernance()` composition. Passing a base or lineage-only composable manifesto MUST be a compile-time type error |
| PLAN-DECO-4 | MUST | `withPlanner()` MUST be the outermost capability decorator before `activate()`. Decorating a planner-composed manifesto with additional `with*` decorators is undefined behavior |
| PLAN-DECO-5 | MUST | On `activate()`, the planner MUST validate that `strategy.requiredTerms` is a subset of `planner.definedTerms`. If validation fails, activation MUST throw `PlannerActivationError` |
| PLAN-DECO-6 | MUST | When `enumerator` is not provided, the planner MUST default to `createCoreEnumerator()` which delegates to `RuntimeKernel.getAvailableActionsFor()` (see §10.4, PLAN-ENUM-3). The default enumerator is intentionally conservative and MUST NOT invent domain-specific inputs |
| PLAN-DECO-7 | MUST | `hardPolicy` values MUST be frozen at activation time. No runtime mutation path |

> **Rationale (PLAN-DECO-3):** The planner needs a single, unambiguous execution path for callers to submit planned actions. Governance provides `proposeAsync` as the universal submission verb. Without governance, the execution verb varies by layer (`dispatchAsync` vs `commitAsync`), which forces either auto-detection heuristics or a separate `act()` API — both of which add complexity without architectural value. Requiring governance also ensures that planned actions pass through legitimacy judgment before execution, which aligns with the safety properties of autonomous planning agents.

> **Rationale (PLAN-DECO-4):** The planner consumes the simulation capability of the layers below it. Planning is a read-only query, not a state mutation, so it does not need governance approval itself.

---

## 8. Activated Runtime Surface

### 8.1 PlannerRuntime

```typescript
/**
 * Runtime surface added by withPlanner().
 * This is a concrete runtime interface, NOT a phantom law marker.
 * The activated instance is typed as GovernanceInstance<T> & PlannerRuntime<T, TermK>.
 */
interface PlannerRuntime<
  T extends ManifestoDomainShape,
  TermK extends string = string
> {
  /**
   * Preview a single action's outcome without executing it.
   * Synchronous, single simulation call.
   * Returns projected snapshot + evaluation using planner terms + pre-built intent.
   *
   * Uses TypedActionRef + CreateIntentArgs for compile-time action name
   * AND argument type safety, consistent with SDK's createIntent() pattern.
   *
   * Distinct from SDK's simulate(): preview() adds planner evaluation and intent.
   */
  preview<K extends keyof T['actions'] & string>(
    actionRef: TypedActionRef<T, K>,
    ...args: CreateIntentArgs<T, K>
  ): ActionPreview<T, TermK>;

  /**
   * Run the configured strategy to find the best action.
   * Asynchronous, N simulation calls.
   */
  plan(options?: PlanOptions): Promise<Plan<T, TermK>>;

  // Execution is NOT part of PlannerRuntime.
  // The activated instance inherits proposeAsync from GovernanceInstance.
  // Callers submit planned actions via:
  //   app.proposeAsync(plan.bestAction.intent)
}
```

The activated runtime is typed as `GovernanceInstance<T> & PlannerRuntime<T, TermK>`. All governance verbs (`proposeAsync`, `approve`, `reject`, `getProposal`, etc.) and lineage query verbs (`restore`, `getLatestHead`, etc.) remain available alongside `preview()` and `plan()`.

### 8.2 ActionPreview

`preview()` returns a lightweight preview of a single action's outcome. It delegates to `RuntimeKernel.simulateSync()` for a single read-only simulation step, then adds planner-specific evaluation and intent construction.

```typescript
interface ActionPreview<
  T extends ManifestoDomainShape,
  TermK extends string = string
> {
  /** Projected snapshot after the simulated action. */
  readonly snapshotAfter: Snapshot<T["state"]>;

  /** Patches that would be applied. */
  readonly patches: readonly Patch[];

  /** Compute status. */
  readonly status: 'complete' | 'pending' | 'halted' | 'error';

  /** Effect declarations (NOT executed). */
  readonly pendingRequirements: readonly Requirement[];

  /** Evaluation using planner-defined terms against the simulated snapshot. */
  readonly evaluation: EvaluationResult<TermK>;

  /** Pre-built intent ready to pass to proposeAsync(). */
  readonly intent: Intent;
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-SIM-PREVIEW-1 | MUST | `preview()` MUST be synchronous. It performs exactly one `RuntimeKernel.simulateSync()` call |
| PLAN-SIM-PREVIEW-2 | MUST | `preview()` MUST return a projected `Snapshot<T["state"]>`, not canonical |
| PLAN-SIM-PREVIEW-3 | MUST | `preview()` MUST evaluate the result using the planner's terms and return the corresponding `EvaluationResult<TermK>` |
| PLAN-SIM-PREVIEW-4 | MUST | `preview()` MUST NOT mutate the live snapshot |
| PLAN-SIM-PREVIEW-5 | MUST | The returned `intent` MUST be a valid `Intent` that can be directly passed to `proposeAsync()` |
| PLAN-SIM-PREVIEW-6 | MUST NOT | `preview()` MUST NOT shadow or conflict with SDK's existing `simulate()`. They are distinct methods with distinct return types |

### 8.3 PlanOptions

```typescript
interface PlanOptions {
  /** Requested strategy budget for this call only. MUST be clamped by hard policy when relevant. */
  readonly budgetOverride?: number;

  /** Requested max depth for this call only. MUST be clamped by hard policy. */
  readonly depthOverride?: number;

  /** Abort signal for cancellation. */
  readonly signal?: AbortSignal;
}
```

### 8.4 Plan

```typescript
interface Plan<
  T extends ManifestoDomainShape,
  TermK extends string = string
> {
  /**
   * The recommended action, or null if no actions are available.
   * Null when terminationReason is 'no_actions'.
   */
  readonly bestAction: SelectedAction<T, TermK> | null;

  /** Alternative candidates, ordered by score descending. Empty when bestAction is null. */
  readonly alternatives: readonly SelectedAction<T, TermK>[];

  /** Planning statistics. */
  readonly stats: PlanStats;
}
```

### 8.4 SelectedAction

```typescript
interface SelectedAction<
  T extends ManifestoDomainShape,
  TermK extends string = string
> {
  /** Action name from the domain schema. */
  readonly actionName: keyof T['actions'] & string;

  /** Action input, if the action accepts input. */
  readonly input?: unknown;

  /**
   * Pre-built intent ready to pass directly to proposeAsync().
   * Created by the planner via createIntent(MEL.actions[actionName], input).
   */
  readonly intent: Intent;

  /** Evaluation result at the terminal state of this action's best trajectory. */
  readonly evaluation: EvaluationResult<TermK>;

  /** Best trajectory found for this action. */
  readonly trajectory: readonly SimulationStep<T>[];

  /** Confidence score: 0..1. Strategy-defined. */
  readonly confidence: number;
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-ACT-INTENT-1 | MUST | After enumeration, the planner runtime MUST mint one `Intent` per `AvailableAction` via `createIntent()`, and assign a unique `candidateId` to each `AvailableAction`. The planner runtime MUST maintain an internal `Map<candidateId, Intent>` for the duration of the `plan()` or `preview()` call |
| PLAN-ACT-INTENT-2 | MUST | The minted `Intent` MUST be passed to `RuntimeKernel.simulateSync()` during simulation. The planner runtime retrieves the correct Intent from its internal map using `action.candidateId` |
| PLAN-ACT-INTENT-3 | MUST | When projecting `RawPlan → Plan`, the planner runtime MUST look up `RawPlan.bestAction.candidateId` in its internal map to recover the exact minted `Intent` and place it in `SelectedAction.intent` |
| PLAN-ACT-INTENT-4 | MUST | `SelectedAction.intent` MUST be directly passable to `proposeAsync()` without additional transformation |
| PLAN-ACT-INTENT-5 | MUST NOT | The `intentId` MUST NOT change between simulation and execution. Re-minting is forbidden — the `candidateId → Intent` map is the single source of truth |
| PLAN-ACT-INTENT-6 | MUST NOT | Neither the enumerator nor the strategy MUST mint or see `Intent` objects. Strategies see only `candidateId` (opaque string). Intent lifecycle is exclusively owned by the planner runtime |

### 8.5 SimulationStep

`SimulationStep` is the **user-facing** trajectory unit exposed in `Plan` and `SelectedAction`. Snapshots are projected per PLAN-SNAP-4.

```typescript
interface SimulationStep<T extends ManifestoDomainShape> {
  readonly action: ActionCandidate<T>;
  readonly snapshotBefore: Snapshot<T["state"]>;
  readonly snapshotAfter: Snapshot<T["state"]>;
  readonly patches: readonly Patch[];
  readonly depth: number;
}
```

### 8.6 PlanStats

```typescript
interface PlanStats {
  /** Total node expansions performed. */
  readonly expansions: number;

  /** Maximum depth reached during search. */
  readonly maxDepthReached: number;

  /** Wall-clock time in milliseconds. */
  readonly elapsedMs: number;

  /** Nodes pruned by hard policy or strategy heuristics. */
  readonly pruned: number;

  /** Reason planning terminated.
   * - completed: search frontier exhausted normally (e.g., Greedy evaluated all actions)
   * - budget_exhausted: strategy budget (iterations/expansions) depleted
   * - timeout: hardPolicy.timeoutMs exceeded
   * - goal_reached: strategy-defined goal condition met
   * - signal_aborted: AbortSignal triggered
   * - no_actions: no actions available from current snapshot (bestAction is null)
   */
  readonly terminationReason: 'completed' | 'budget_exhausted' | 'timeout' | 'goal_reached' | 'signal_aborted' | 'no_actions';
}
```

### 8.7 Activation Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-ACT-1 | MUST | `activate()` MUST validate strategy-planner term compatibility (PLAN-DECO-5) |
| PLAN-ACT-2 | MUST | `activate()` MUST freeze hard policy. Post-activation mutation is not permitted |
| PLAN-ACT-3 | MUST | `plan()` MUST read the current live canonical snapshot (via `getCanonicalSnapshot()`) at invocation time as the simulation root |
| PLAN-ACT-4 | MUST NOT | `plan()` MUST NOT mutate the live snapshot. All simulation operates on copies |
| PLAN-ACT-5 | MUST | `plan()` MUST respect `AbortSignal` when provided. Cancellation MUST return the best result found so far, not throw |
| PLAN-ACT-6 | MUST | `plan()` MUST enforce hard policy limits. Exceeding `maxExpansions` or `timeoutMs` terminates search and returns best result so far |
| PLAN-ACT-7 | MUST | `plan()` MUST be safe to call concurrently. Multiple `plan()` calls on the same instance MUST NOT interfere with each other |
| PLAN-ACT-8 | MUST | If no actions are available from the current snapshot, `plan()` MUST return a `Plan` with `bestAction: null`, empty `alternatives`, and `terminationReason: 'no_actions'` |
| PLAN-ACT-9 | MUST | When `bestAction` is `null`, `alternatives` MUST be empty. When `bestAction` is not `null`, `alternatives` MUST NOT contain the `bestAction` |
| PLAN-ACT-10 | MUST | `PlanOptions` overrides are requests only. The runtime MUST clamp `budgetOverride` and `depthOverride` against `hardPolicy` before exposing options to the strategy |

---

## 9. Strategy Interface

### 9.1 Interface

```typescript
interface Strategy<
  T extends ManifestoDomainShape = any,
  TermK extends string = string
> {
  /** Human-readable strategy name. */
  readonly name: string;

  /**
   * Term keys this strategy requires from the planner.
   * Validated against planner.definedTerms at activation.
   */
  readonly requiredTerms: readonly TermK[];

  /**
   * Execute the search algorithm.
   * Called by the activated runtime when plan() is invoked.
   */
  run(context: StrategyContext<T, TermK>): Promise<RawPlan<T, TermK>>;
}
```

### 9.2 StrategyContext

```typescript
interface StrategyContext<
  T extends ManifestoDomainShape = any,
  TermK extends string = string
> {
  /** Simulation interface. Step forward without mutating live state. */
  readonly simulator: Simulator<T>;

  /**
   * Action enumeration. Returns AvailableAction[] (with candidateId).
   *
   * This is a planner-wrapped enumerator, NOT the raw ActionEnumerator.
   * The planner runtime calls the user-provided ActionEnumerator internally,
   * then wraps each ActionCandidate into AvailableAction (adding candidateId
   * and minting Intent into its internal map).
   */
  readonly enumerator: StrategyEnumerator<T>;

  /** Evaluation. Score a trajectory using planner-defined terms. Accepts canonical snapshots; projects internally before calling feature extractors. */
  readonly evaluator: PlannerEvaluator<T, TermK>;

  /** Current live canonical snapshot. The root of the search tree. Canonical because the simulator requires the full substrate. */
  readonly currentSnapshot: CanonicalSnapshot<T["state"]>;

  /** Immutable runtime constraints. */
  readonly hardPolicy: Readonly<Required<HardPolicy>>;

  /** Per-invocation options. */
  readonly options: Readonly<PlanOptions>;
}

/**
 * Strategy-facing enumerator that returns AvailableAction (with candidateId).
 * Created by the planner runtime as a wrapper around the user-provided ActionEnumerator.
 */
interface StrategyEnumerator<T extends ManifestoDomainShape = any> {
  enumerate(snapshot: CanonicalSnapshot<T["state"]>): readonly AvailableAction<T>[];
}
```

### 9.3 CanonicalSimulationStep (Strategy-internal)

Strategies operate entirely in canonical space. `CanonicalSimulationStep` is the trajectory unit used inside strategies, the simulator, and the evaluator.

```typescript
interface CanonicalSimulationStep<T extends ManifestoDomainShape = any> {
  readonly action: AvailableAction<T>;
  readonly snapshotBefore: CanonicalSnapshot<T["state"]>;
  readonly snapshotAfter: CanonicalSnapshot<T["state"]>;
  readonly patches: readonly Patch[];
  readonly depth: number;
}
```

This type is NOT exposed to users. `withPlanner` projects it to user-facing `SimulationStep` (§8.5) when building the `Plan` output.

### 9.4 PlannerEvaluator (Strategy-facing)

```typescript
interface PlannerEvaluator<
  T extends ManifestoDomainShape = any,
  TermK extends string = string
> {
  evaluate(
    trajectory: readonly CanonicalSimulationStep<T>[],
    finalSnapshot: CanonicalSnapshot<T["state"]>
  ): EvaluationResult<TermK>;
}
```

The evaluator accepts canonical snapshots from the strategy. Internally, `withPlanner` projects canonical → projected before invoking user-defined feature extractors (PLAN-SNAP-3). This projection is invisible to both the strategy and the feature extractor author.

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-EVAL-STRAT-1 | MUST | `PlannerEvaluator.evaluate()` MUST accept `CanonicalSimulationStep[]` and `CanonicalSnapshot`. The planner internally projects to `Snapshot` before calling snapshot feature extractors, and to `SimulationStep[]` before calling trajectory feature extractors |
| PLAN-EVAL-STRAT-2 | MUST | The projection from canonical to projected MUST be invisible to both the strategy (which passes canonical) and the feature extractor author (which receives projected) |

### 9.5 RawPlan

`RawPlan` is the strategy's return type. It is fully canonical — `withPlanner` projects it to the user-facing `Plan` (§8.4).

```typescript
interface RawPlan<
  T extends ManifestoDomainShape = any,
  TermK extends string = string
> {
  readonly bestAction: {
    readonly actionName: string;
    readonly input?: unknown;
    readonly candidateId: string;
    readonly evaluation: EvaluationResult<TermK>;
    readonly trajectory: readonly CanonicalSimulationStep<T>[];
    readonly confidence: number;
  } | null;
  readonly alternatives: readonly NonNullable<RawPlan<T, TermK>['bestAction']>[];
  readonly stats: PlanStats;
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-STRAT-RAW-1 | MUST | `RawPlan` trajectories MUST contain `CanonicalSimulationStep` (canonical snapshots). Strategies MUST NOT project snapshots themselves |
| PLAN-STRAT-RAW-2 | MUST | `withPlanner` MUST project `RawPlan` → `Plan` by converting each `CanonicalSimulationStep` to `SimulationStep` (projected snapshots) before returning to the caller |

### 9.6 Strategy Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-STRAT-1 | MUST | `requiredTerms` MUST be a static readonly array. It MUST NOT change between calls |
| PLAN-STRAT-2 | MUST | `run()` MUST only access simulation through `context.simulator`. Direct Core access is forbidden |
| PLAN-STRAT-3 | MUST | `run()` MUST only enumerate actions through `context.enumerator`. Inventing actions outside the enumerator is forbidden |
| PLAN-STRAT-4 | MUST | `run()` MUST respect `hardPolicy.maxExpansions` and `hardPolicy.timeoutMs`. Strategies that ignore hard limits are non-compliant |
| PLAN-STRAT-5 | MUST | `run()` MUST check `context.options.signal` periodically and terminate gracefully when aborted |
| PLAN-STRAT-6 | MUST | `run()` MUST return the best result found even on early termination (timeout, abort, budget). Throwing on early termination is forbidden |
| PLAN-STRAT-7 | MUST NOT | `run()` MUST NOT mutate `context.currentSnapshot` |
| PLAN-STRAT-8 | SHOULD | `confidence` SHOULD reflect the strategy's internal certainty metric. For MCTS, this is visit ratio. For greedy, this is normalized score delta |
| PLAN-STRAT-9 | MUST | Strategies MUST preserve `AvailableAction.candidateId` unchanged through `RawPlan.bestAction.candidateId` and all trajectory steps. Strategies MUST NOT modify, regenerate, or drop `candidateId` |

---

## 10. Simulator Interface

### 10.1 Interface

```typescript
interface Simulator<T extends ManifestoDomainShape = any> {
  /**
   * Simulate a single action from a given canonical snapshot.
   * Returns the resulting canonical snapshot without mutating the input.
   *
   * Internally delegates to RuntimeKernel.simulateSync().
   * Effects are declared (as pendingRequirements) but NOT executed.
   *
   * Operates on CanonicalSnapshot because Core APIs require the full substrate.
   */
  step(
    snapshot: CanonicalSnapshot<T["state"]>,
    action: AvailableAction<T>
  ): SimulationResult<T>;
}
```

### 10.2 SimulationResult (Single Step)

```typescript
interface SimulationResult<T extends ManifestoDomainShape = any> {
  /** Resulting canonical snapshot after the simulated action. */
  readonly snapshot: CanonicalSnapshot<T["state"]>;

  /** Compute status: complete, pending, halted, error. */
  readonly status: 'complete' | 'pending' | 'halted' | 'error';

  /** Patches applied during this step. */
  readonly patches: readonly Patch[];

  /** Effect declarations produced. NOT executed. */
  readonly pendingRequirements: readonly Requirement[];
}
```

### 10.3 Simulation Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-SIM-1 | MUST | `Simulator.step()` MUST be implemented using `RuntimeKernel.simulateSync()` from `@manifesto-ai/sdk/provider`. The planner MUST NOT access Core internals directly or through construction closures |
| PLAN-SIM-2 | MUST | `Simulator.step()` MUST be synchronous |
| PLAN-SIM-3 | MUST NOT | The simulator MUST NOT execute effects. Requirements are recorded but not fulfilled |
| PLAN-SIM-4 | MUST NOT | The simulator MUST NOT mutate the input snapshot |
| PLAN-SIM-5 | MUST | `HostContext` construction MUST be delegated to `RuntimeKernel.simulateSync()`. The simulator MUST NOT construct or modify `HostContext` directly. The SDK/Host contract's deterministic context policy (frozen `now`, `intentId`-derived `randomSeed`) applies to simulation identically as to live execution |
| PLAN-SIM-6 | MUST | When the compute status is `pending` (effects declared), the simulator MUST return the snapshot as-is with pending requirements. The strategy decides whether to continue simulation past pending states |
| PLAN-SIM-7 | MUST | Simulator output (`SimulateResult` from `RuntimeKernel.simulateSync()`) is canonical. Strategies build `CanonicalSimulationStep` from simulator output. `withPlanner` projects canonical trajectories to user-facing `SimulationStep` when converting `RawPlan` → `Plan` (PLAN-SNAP-7). The `PlannerEvaluator` projects canonical snapshots internally before calling feature extractors (PLAN-SNAP-3) |

> **Rationale (PLAN-SIM-3):** Effect execution belongs to Host. The planner operates in a "what if" space where effects are visible as declarations but not executed. This preserves Core purity and ensures simulation is deterministic and repeatable.

> **Rationale (PLAN-SIM-6):** In domains with effects, many actions will produce `pending` status. If the simulator blocked on pending, most simulation trees would be depth-1. Strategies MUST handle pending states explicitly — either by skipping past them, treating them as terminal, or applying domain-specific heuristics.

### 10.4 Simulation Seam — SDK Prerequisite

The planner requires pure simulation operations on **arbitrary hypothetical snapshots** — not just the live runtime snapshot. The current stable `RuntimeKernel` surface (SDK GUIDE §6) exposes `executeHost`, `getSnapshot`, `getCanonicalSnapshot`, `getAvailableActions`, `isActionAvailable`, and related methods, but these operate on the **live runtime state**. The planner needs to call `computeSync`, `apply`, and `applySystemDelta` on caller-provided canonical snapshots that are not the live snapshot.

**This surface does not currently exist in the documented `@manifesto-ai/sdk/provider` public contract.**

Therefore, this SPEC declares an **explicit SDK SPEC additive dependency**: the planner package MUST NOT be implemented until the SDK provider seam is extended with a pure simulation surface.

**Required additive surface on `RuntimeKernel`:**

```typescript
// Proposed addition to @manifesto-ai/sdk/provider RuntimeKernel
interface RuntimeKernel {
  // ... existing surface ...

  /**
   * Pure simulation: compute a transition on an arbitrary canonical snapshot
   * without affecting the live runtime state.
   *
   * HostContext is constructed internally by simulateSync() following the
   * same deterministic policy as live execution (frozen now, intentId-derived
   * randomSeed). Callers do NOT provide HostContext.
   *
   * Equivalent to: constructContext(intent) → computeSync → apply → applySystemDelta
   *
   * Returns the resulting canonical snapshot + compute metadata.
   */
  simulateSync(
    snapshot: CanonicalSnapshot,
    intent: Intent
  ): SimulateResult;

  /**
   * Check action availability against an arbitrary canonical snapshot.
   * Unlike the existing getAvailableActions()/isActionAvailable(),
   * this operates on a caller-provided snapshot, not the live state.
   */
  getAvailableActionsFor(snapshot: CanonicalSnapshot): readonly string[];
  isActionAvailableFor(snapshot: CanonicalSnapshot, actionName: string): boolean;
}

interface SimulateResult {
  readonly snapshot: CanonicalSnapshot;
  readonly patches: readonly Patch[];
  readonly systemDelta: SystemDelta;
  readonly status: 'complete' | 'pending' | 'halted' | 'error';
  readonly requirements: readonly Requirement[];
}
```

**Prerequisite tracking:**

| Prerequisite | Owner | Status | Blocking |
|-------------|-------|--------|----------|
| `RuntimeKernel.simulateSync()` | SDK SPEC | **Not yet proposed** | Blocks planner `Simulator` implementation |
| `RuntimeKernel.getAvailableActionsFor()` | SDK SPEC | **Not yet proposed** | Blocks `createCoreEnumerator()` implementation |
| `RuntimeKernel.isActionAvailableFor()` | SDK SPEC | **Not yet proposed** | Same |

**Implementation sequence:**

1. Propose SDK SPEC additive patch: add `simulateSync`, `getAvailableActionsFor`, `isActionAvailableFor` to `RuntimeKernel`
2. Implement the SDK additive patch
3. Implement `@manifesto-ai/planner` against the landed SDK surface

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-SIM-SEAM-1 | MUST | The planner MUST obtain Core access exclusively through `getRuntimeKernelFactory()` from `@manifesto-ai/sdk/provider` |
| PLAN-SIM-SEAM-2 | MUST NOT | The planner package MUST NOT list `@manifesto-ai/core` as a direct dependency in `package.json`. Core is a transitive dependency through SDK |
| PLAN-SIM-SEAM-3 | MUST | The planner MUST NOT construct its own `HostContext`. `HostContext` construction for simulation MUST be owned by `RuntimeKernel.simulateSync()`, following the same deterministic context policy as the SDK/Host execution path (`now` frozen at job start, `randomSeed` derived from `intentId`). The planner passes the `Intent` to `simulateSync()` and receives the result — it does not control context construction |
| PLAN-SIM-SEAM-4 | MUST | The planner MUST NOT be implemented until the SDK provider seam includes the `simulateSync`, `getAvailableActionsFor`, and `isActionAvailableFor` methods as stable public contract |
| PLAN-SIM-SEAM-5 | MUST | The planner's `Simulator` implementation MUST delegate to `RuntimeKernel.simulateSync()`. It MUST NOT access Core internals through construction closures, internal references, or any path outside the documented `RuntimeKernel` surface |

---

## 11. ActionEnumerator Interface

### 11.1 Interface

```typescript
interface ActionEnumerator<T extends ManifestoDomainShape = any> {
  /**
   * Return the set of available action candidates from a given canonical snapshot.
   *
   * Receives CanonicalSnapshot because Core.getAvailableActions()
   * requires the full substrate at the Core/Host boundary.
   *
   * Returns ActionCandidate[] (no candidateId, no Intent).
   * The planner runtime wraps each into AvailableAction after enumeration.
   */
  enumerate(snapshot: CanonicalSnapshot<T["state"]>): readonly ActionCandidate<T>[];
}

/**
 * Raw action candidate returned by enumerators.
 * No candidateId, no Intent — those are added by the planner runtime.
 */
interface ActionCandidate<T extends ManifestoDomainShape = any> {
  readonly actionName: keyof T['actions'] & string;
  readonly input?: unknown;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Enriched action available to strategies.
 * Created by the planner runtime from ActionCandidate + generated candidateId.
 * Strategies see this type; enumerators do not produce it.
 */
interface AvailableAction<T extends ManifestoDomainShape = any> {
  readonly actionName: keyof T['actions'] & string;
  readonly input?: unknown;
  readonly metadata?: Record<string, unknown>;

  /**
   * Opaque candidate identifier assigned by the planner runtime.
   * The planner runtime maintains an internal Map<candidateId, Intent>.
   * Strategies MUST preserve this value unchanged through simulation
   * and into RawPlan.
   */
  readonly candidateId: string;
}
```

### 11.2 Built-in Enumerator

```typescript
/**
 * Default enumerator. Delegates to RuntimeKernel.getAvailableActionsFor().
 * It is intentionally conservative: it returns action-name candidates only
 * and MUST NOT invent domain-specific inputs.
 * Intent minting is handled by the planner runtime, not the enumerator.
 */
function createCoreEnumerator<T extends ManifestoDomainShape>(): ActionEnumerator<T>;
```

### 11.3 Enumerator Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-ENUM-1 | MUST | `enumerate()` MUST be pure and synchronous |
| PLAN-ENUM-2 | MUST | `enumerate()` MUST NOT return actions that are unavailable in the given snapshot |
| PLAN-ENUM-3 | MUST | `createCoreEnumerator()` MUST delegate to `RuntimeKernel.getAvailableActionsFor()` and `RuntimeKernel.isActionAvailableFor()` from `@manifesto-ai/sdk/provider` — the arbitrary-snapshot variants, not the live-state variants |
| PLAN-ENUM-4 | MUST | `createCoreEnumerator()` MUST NOT synthesize domain-specific inputs. It SHOULD emit input-less candidates only. Completeness for input-bearing action spaces is not guaranteed by the default enumerator |
| PLAN-ENUM-5 | MAY | Custom enumerators MAY include input variants (e.g., different task IDs for a `startTask` action). This is the primary extension point for domain-specific action spaces |
| PLAN-ENUM-6 | SHOULD | Custom enumerators SHOULD be stateless. If state is needed, it SHOULD come from the snapshot |
| PLAN-ENUM-7 | MUST | Enumerators MUST return `ActionCandidate[]`, not `AvailableAction[]`. The planner runtime wraps each `ActionCandidate` into an `AvailableAction` by assigning `candidateId` and minting the corresponding `Intent` into its internal map |

---

## 12. Built-in Strategies

### 12.1 MCTS Strategy

```typescript
function mctsStrategy<
  T extends ManifestoDomainShape = any,
  TermK extends string = string
>(config?: MctsStrategyConfig<TermK>): Strategy<T, TermK>;

interface MctsStrategyConfig<TermK extends string = string> {
  /**
   * The term key to use for backpropagation reward.
   * MUST exist in planner.definedTerms.
   */
  readonly useTerm: TermK;

  /** Number of MCTS iterations. Default: 1000. */
  readonly budget?: number;

  /** UCB1 exploration constant. Default: Math.SQRT2. */
  readonly exploration?: number;
}
```

`requiredTerms` = `[config.useTerm]`.

**MCTS internal loop (all canonical):**

1. **SELECT** — traverse tree using UCB1: `avgReward + c * sqrt(ln(parentVisits) / childVisits)`
2. **EXPAND** — `simulator.step(snapshot, action)` for an unexplored child (canonical in/out)
3. **ROLLOUT** — random action selection via `enumerator.enumerate()` until `maxDepth` or terminal (canonical throughout)
4. **EVALUATE** — `evaluator.evaluate(trajectory, finalSnapshot).terms[useTerm]` (evaluator accepts canonical, projects internally)
5. **BACKPROPAGATE** — propagate reward up the tree

### 12.2 Greedy Strategy

```typescript
function greedyStrategy<
  T extends ManifestoDomainShape = any,
  TermK extends string = string
>(config: GreedyStrategyConfig<TermK>): Strategy<T, TermK>;

interface GreedyStrategyConfig<TermK extends string = string> {
  /**
   * The term key to use for immediate comparison.
   * MUST exist in planner.definedTerms.
   */
  readonly useTerm: TermK;
}
```

`requiredTerms` = `[config.useTerm]`.

**Greedy internal loop (all canonical):**

1. `enumerator.enumerate(currentSnapshot)` → candidates (canonical snapshot in)
2. For each candidate: `simulator.step(snapshot, action)` → result (canonical snapshot out)
3. `evaluator.evaluate([step], result.snapshot)` → score (evaluator accepts canonical, projects internally)
4. Return the candidate with the highest score as `RawPlan` (canonical trajectory)

### 12.3 Strategy Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLAN-STRAT-MCTS-1 | MUST | MCTS `budget` MUST be capped by `hardPolicy.maxExpansions` |
| PLAN-STRAT-MCTS-2 | MUST | MCTS rollout depth MUST be capped by `hardPolicy.maxDepth` |
| PLAN-STRAT-MCTS-3 | SHOULD | MCTS SHOULD use a deterministic PRNG seeded from the root snapshot for rollout action selection, to enable reproducible planning |
| PLAN-STRAT-GREEDY-1 | MUST | Greedy MUST evaluate all available actions (no pruning) and return `terminationReason: 'completed'` on normal completion |

---

## 13. Error Model

### 13.1 Activation Errors

| Error | Condition |
|-------|-----------|
| `PlannerActivationError` | `strategy.requiredTerms ⊄ planner.definedTerms` |
| `PlannerActivationError` | `planner.definedTerms` is empty |

### 13.2 Runtime Errors

| Error | Condition |
|-------|-----------|
| `PlannerTimeoutError` | `hardPolicy.timeoutMs` exceeded — NOT thrown, returned as `terminationReason: 'timeout'` |
| `PlannerAbortError` | `AbortSignal` triggered — NOT thrown, returned as `terminationReason: 'signal_aborted'` |

`plan()` MUST NOT throw on expected termination conditions. It MUST return the best result found. Only programming errors (invalid state, contract violations) throw.

---

## 14. Composition Examples

### 14.1 Full Composition (Canonical)

```typescript
const planner = createPlanner<TaskBoardDomain>()
  .features({
    completion: (snap) => snap.data.completionRate as number,
    overdue:    (snap) => snap.data.overdueCount as number,
  })
  .trajectoryFeatures({
    depth: (traj) => traj.length,
  })
  .parameters({
    overdueWeight: 0.3,
    depthPenalty: 0.01,
  })
  .terms({
    reward: (f, p) =>
      f.completion - (f.overdue * p.overdueWeight) - (f.depth * p.depthPenalty),
  })
  .build();

const enumerator: ActionEnumerator<TaskBoardDomain> = {
  enumerate(snapshot) {
    return snapshot.data.tasks
      .filter((task) => !task.completed)
      .map((task) => ({
        actionName: 'completeTask',
        input: { taskId: task.id },
      }));
  },
};

const app = withPlanner(
  withGovernance(
    withLineage(
      createManifesto<TaskBoardDomain>(schema, effects),
      { store: createInMemoryLineageStore() }
    ),
    { bindings, execution }
  ),
  {
    planner,
    strategy: mctsStrategy({ useTerm: 'reward', budget: 3000 }),
    enumerator,
    hardPolicy: { maxDepth: 150, timeoutMs: 3000 },
  }
).activate();
```

### 14.2 Simulate → Plan → Propose (Agent Loop)

```typescript
// 1. 미래 예측 — "completeTask를 하면 어떻게 돼?"
const preview = app.preview(app.MEL.actions.completeTask, { taskId: 'task-7' });
console.log(preview.snapshotAfter.data.completedTasks);  // 3
console.log(preview.evaluation.terms.reward);             // 0.85

// 2. 계획 — "뭘 하는 게 최선이야?"
const plan = await app.plan();

// 3. 실행 — "좋아, 제안한다"
if (plan.bestAction) {
  const proposal = await app.proposeAsync(plan.bestAction.intent);
  await app.approve(proposal.proposalId);
}
```

### 14.3 Strategy Comparison (Same Planner)

```typescript
// Same planner, same governance, different strategies
const devApp = withPlanner(governedManifesto, {
  planner,
  strategy: greedyStrategy({ useTerm: 'reward' }),
  enumerator: createCoreEnumerator(),
}).activate();

const prodApp = withPlanner(governedManifesto, {
  planner,
  strategy: mctsStrategy({ useTerm: 'reward', budget: 5000 }),
  enumerator: createCoreEnumerator(),
}).activate();
```

### 14.4 Runtime Parameter Adjustment

```typescript
const plan1 = await app.plan();
// Agent decides to be more risk-averse
planner.setParameter('overdueWeight', 0.8);
const plan2 = await app.plan();
// plan2 penalizes overdue tasks more heavily
```

### 14.5 Development/Test with Auto-Approve Governance

```typescript
// For dev/test environments where governance approval is automatic:
const app = withPlanner(
  withGovernance(
    withLineage(
      createManifesto<TaskBoardDomain>(schema, effects),
      { store: createInMemoryLineageStore() }
    ),
    {
      bindings: autoApproveBindings,  // auto-approve all proposals
      execution,
    }
  ),
  {
    planner,
    strategy: greedyStrategy({ useTerm: 'reward' }),
  }
).activate();

// proposeAsync still used — but approval is instant
const plan = await app.plan();
if (plan.bestAction) {
  await app.proposeAsync(plan.bestAction.intent);
  // auto-approved, no manual approve() needed
}
```

### 14.6 Invalid Compositions (Compile Errors)

```typescript
// ❌ Base runtime without governance — TYPE ERROR
withPlanner(
  createManifesto<CounterDomain>(schema, effects),
  { planner, strategy }
);
// Error: Type 'BaseLaws' does not satisfy constraint 'GovernanceLaws'

// ❌ Lineage without governance — TYPE ERROR
withPlanner(
  withLineage(createManifesto<CounterDomain>(schema, effects), { store }),
  { planner, strategy }
);
// Error: Type 'BaseLaws & LineageLaws' does not satisfy constraint 'GovernanceLaws'

// ✅ Only valid composition
withPlanner(
  withGovernance(withLineage(createManifesto<T>(schema, effects), { store }), { bindings, execution }),
  { planner, strategy }
);
```

---

## 15. SDK Prerequisite Summary

This section summarizes the SDK SPEC additive patches required before `@manifesto-ai/planner` can be implemented. These are owned by SDK SPEC, not this document.

### 15.1 `RuntimeKernel` Simulation Surface (Blocking)

The following methods MUST be added to `RuntimeKernel` in `@manifesto-ai/sdk/provider`:

- `simulateSync(snapshot, intent)` — pure simulation on arbitrary canonical snapshot; `HostContext` constructed internally by `RuntimeKernel`
- `getAvailableActionsFor(snapshot)` — availability query on arbitrary canonical snapshot
- `isActionAvailableFor(snapshot, actionName)` — single-action availability on arbitrary canonical snapshot

See §10.4 for the full proposed interface and prerequisite tracking.

### 15.2 `SchemaGraph` (Non-blocking)

SDK SHOULD provide a `getSchemaGraph()` method that exposes static dependency analysis (`depends`, `mutates`, `enables`, `traceUp`, `traceDown`). This is useful for strategy-level pruning but is not required by the v1 planner contract.

---

## 16. Future Extensibility (Non-Normative)

| Item | Status | Notes |
|------|--------|-------|
| A* Strategy | Phase 2 | Requires `costTerm` + `heuristicTerm` in config |
| Beam Search Strategy | Phase 2 | Requires `useTerm` + `beamWidth` |
| Iterative Deepening Strategy | Phase 2 | Requires `useTerm` + `initialDepth` + `depthStep` |
| Simulation caching / memoization | Phase 2 | Snapshot hash → SimulationResult cache |
| Snapshot structural sharing | Phase 2 | `snapshotPool` config slot in `HardPolicy` |
| Incremental MCTS (tree reuse across `plan()` calls) | Phase 2 | Real-time constraint environments (e.g., Coin Sapiens) |
| `createMelEvaluator(composableManifesto)` | Phase 3 | Evaluator as a governed Manifesto world |
| Evaluator self-modification via governance | Phase 3 | `withGovernance` on evaluator world |
| Planner trace / visualization (Studio integration) | Phase 2 | Search tree + evaluation breakdown |
| Custom `HostContext` policy for simulation | Phase 2 | SDK-owned override — e.g., simulated time acceleration. Planner does not own context construction (PLAN-SIM-SEAM-3) |

---

## 17. Inviolable Design Principles

These rules are constitutional. They protect the integrity of the planning system.

| ID | Principle |
|----|-----------|
| PLAN-CONSTITUTION-1 | **Core purity is inviolable.** The planner MUST NOT modify Core's computation model. Simulation is read-only use of existing Core APIs. |
| PLAN-CONSTITUTION-2 | **Evaluator and hard policy are in different layers.** The entity being evaluated MUST NOT control the constraints that bound its evaluation. |
| PLAN-CONSTITUTION-3 | **Planning is not execution.** `plan()` recommends. The caller executes. The planner never submits, commits, or proposes. |
| PLAN-CONSTITUTION-4 | **Strategies are replaceable.** No strategy is privileged. The planner-strategy interface is the only contract. |
| PLAN-CONSTITUTION-5 | **Graceful degradation.** Planning always returns a result, even under timeout, abort, or empty action space. Throwing on expected conditions is forbidden. |

---

## 18. Package Dependencies

```text
@manifesto-ai/planner
  ├── @manifesto-ai/sdk (peer dependency)
  │   ├── @manifesto-ai/sdk/provider (subpath — decorator authoring seam)
  │   └── @manifesto-ai/core (transitive — NOT a direct planner dependency)
  └── @manifesto-ai/governance (peer dependency — prerequisite types)
      └── @manifesto-ai/lineage (transitive)
```

The planner depends on `@manifesto-ai/governance` for the `GovernanceLaws` type constraint and `proposeAsync` surface. It does NOT depend on `@manifesto-ai/lineage` directly — lineage is a transitive dependency through governance, mirroring how governance itself requires lineage.

The planner accesses Core operations through `@manifesto-ai/sdk/provider`'s `RuntimeKernel` seam (§10.4). This is architecturally identical to how `withLineage()` and `withGovernance()` access Core — all capability decorators share the same provider-level composition contract.

---

*End of Planner SPEC v1.2.0*
