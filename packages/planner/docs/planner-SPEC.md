# Planner SPEC

> **Package:** `@manifesto-ai/planner`
> **Status:** Living Document
> **Contract Surface:** v0.2.0 implemented planner slice
> **Last Updated:** 2026-04-07

## Changelog

| Version | Date | Change |
|---------|------|--------|
| v0.2.0 | 2026-04-07 | Added `mctsStrategy()` with deterministic rollout, root-visit confidence, and terminal handling for `pending` rollout states |
| v0.1.0 | 2026-04-07 | First implemented planner slice landed: `createPlanner()`, `withPlanner()`, `preview()`, `plan()`, `greedyStrategy()`, conservative `createCoreEnumerator()` |

## 1. Purpose

`@manifesto-ai/planner` adds read-only foresight on top of the governed decorator path.

The package owns:

- `createPlanner()` for feature, parameter, and term construction
- `withPlanner()` as the outer pre-activation planner decorator
- activated `preview()` and `plan()` runtime verbs
- built-in `greedyStrategy()`
- built-in `mctsStrategy()`
- built-in `createCoreEnumerator()`

The planner does not execute effects and does not submit intents on behalf of the caller.

## 2. Canonical Composition

The current package contract is:

```ts
createManifesto(schema, effects)
  -> withLineage(...)
  -> withGovernance(...)
  -> withPlanner(...)
  -> activate()
```

`withPlanner()` requires a governed composable manifesto. It does not accept a base runtime or an already activated governed instance.

## 3. Public Surface

### 3.1 `createPlanner()`

`createPlanner<T>()` returns a fluent builder with the current first-slice order:

```ts
createPlanner<T>()
  .features({...})
  .trajectoryFeatures({...}) // optional
  .parameters({...})         // optional
  .terms({...})
  .build()
```

Built planners expose:

- `definedTerms`
- `setParameter(key, value)`
- `getParameters()`
- `evaluate(trajectory, finalSnapshot)`

Feature extractors receive the projected SDK snapshot surface from `getSnapshot()`.

### 3.2 `withPlanner(manifesto, config)`

`withPlanner()` accepts:

- `planner`
- `strategy`
- optional `enumerator`
- optional `hardPolicy`

It returns a planner-owned terminal composable. Runtime verbs do not exist until `activate()`.

On activation:

- strategy terms are validated against `planner.definedTerms`
- `hardPolicy` is frozen
- the resulting runtime is `GovernanceInstance<T> & PlannerRuntime<T, TermK>`

### 3.3 Activated Runtime

The current first-slice runtime adds:

- `preview(actionRef, ...args)`
- `plan(options?)`

`preview()` is synchronous and performs exactly one arbitrary-snapshot simulation through the SDK provider seam.

`plan()` is asynchronous and delegates to the configured strategy. The current bundled strategies are `greedyStrategy()` and `mctsStrategy()`.

### 3.4 Built-in Strategy and Enumerator

The implemented built-ins are:

- `greedyStrategy({ useTerm })`
- `mctsStrategy({ useTerm, budget?, exploration? })`
- `createCoreEnumerator()`

`createCoreEnumerator()` is intentionally conservative:

- it delegates to `RuntimeKernel.getAvailableActionsFor()`
- it emits action-name candidates only
- it does not invent domain-specific inputs

Domains that need input-bearing candidates must provide a custom `enumerator`.

## 4. Runtime Semantics

### 4.1 Planning Is Read-Only

- `preview()` and `plan()` simulate over canonical snapshots
- they do not mutate the live governed runtime
- returned `SelectedAction.intent` values are directly reusable with `proposeAsync()`

### 4.2 Snapshot Boundary

- internal strategy/runtime simulation uses canonical snapshots
- public runtime results expose projected snapshots
- user-facing `SimulationStep.action` does not expose internal `candidateId`

### 4.3 Parameters and Hard Policy

- `setParameter()` affects the next `plan()` or `preview()` call
- in-flight planning uses its own parameter snapshot
- `PlanOptions.budgetOverride` and `depthOverride` are requests only and are clamped by `hardPolicy`

### 4.4 Current Early-Termination Surface

The current implemented slice returns planner results instead of throwing for normal search termination:

- `completed`
- `budget_exhausted`
- `timeout`
- `signal_aborted`
- `no_actions`

### 4.5 Current MCTS Policy

The current `mctsStrategy()` slice uses these package-level policies:

- rollout action selection is deterministic for the same root canonical snapshot
- `status: "pending"` is terminal for rollout
- confidence is based on root-child visit ratio
- budget requests are clamped by `hardPolicy.maxExpansions`

## 5. Current Omissions

The following are not part of the current implemented package surface:

- planner tracing / visualization
- package-owned provider subpath
- richer built-in candidate-generation helpers beyond `createCoreEnumerator()`

Future-phase design work remains in the internal draft spec.

## 6. Related Docs

- [../README.md](../README.md)
- [GUIDE.md](GUIDE.md)
- [VERSION-INDEX.md](VERSION-INDEX.md)
- [Planner Draft v1.2.0](../../../docs/internals/spec/planner-SPEC-v1.2.0-draft.md)
