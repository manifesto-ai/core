# @manifesto-ai/sdk

> Activation-first base runtime entry point for Manifesto.

## Overview

`@manifesto-ai/sdk` owns one concept: `createManifesto()`.

Use SDK when you want:

- the shortest path to a running base runtime
- a clear activation boundary before runtime execution
- typed intent creation through `MEL.actions.*`
- typed effect authoring through `@manifesto-ai/sdk/effects`
- additive base write reports through `dispatchAsyncWithReport()`
- subscriptions, availability queries, dispatchability queries, intent explanation reads, action metadata inspection, static graph inspection, dry-run simulation, and snapshot reads in one package

The current documented SDK contract is:

`createManifesto(schema, effects) -> activate() -> base runtime instance`

The current post-activation extension seam is:

`@manifesto-ai/sdk/extensions -> getExtensionKernel(app)`

The current first-party hypothetical-session helper is:

`@manifesto-ai/sdk/extensions -> createSimulationSession(app)`

The current effect-authoring helper seam is:

`@manifesto-ai/sdk/effects -> defineEffects()`

## SDK-Owned Surface

- `createManifesto()`
- `activate()`
- activated base runtime:
  - `createIntent`
  - `dispatchAsync`
  - `dispatchAsyncWithReport`
  - `subscribe`
  - `on`
  - `getSnapshot`
  - `getCanonicalSnapshot`
  - `getAvailableActions`
  - `isIntentDispatchable`
  - `getIntentBlockers`
  - `explainIntent`
  - `why`
  - `whyNot`
  - `getActionMetadata`
  - `isActionAvailable`
  - `getSchemaGraph`
  - `simulate`
  - `MEL`
  - `schema`
  - `dispose`
- SDK error types
- `@manifesto-ai/sdk/extensions` for safe arbitrary-snapshot read-only helpers
- `@manifesto-ai/sdk/effects` for typed effect authoring helpers
- `@manifesto-ai/sdk/provider` for decorator/provider authoring seams

## Effect Authoring Helper

The root SDK story stays centered on `createManifesto()`. If you want typed top-level state refs when authoring effect handlers, import `defineEffects()` from the dedicated effects subpath.

```typescript
import { defineEffects } from "@manifesto-ai/sdk/effects";
```

`defineEffects()` is an authoring helper only. It still returns a plain `Record<string, EffectHandler>`, and handlers still return concrete `Patch[]`.

## Base Runtime Example

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto<CounterDomain>(domainSchema, {});
const instance = manifesto.activate();

const intent = instance.createIntent(instance.MEL.actions.increment);
instance.explainIntent(intent);
instance.why(intent);
instance.whyNot(intent);
await instance.dispatchAsync(intent);
const report = await instance.dispatchAsyncWithReport(
  instance.createIntent(instance.MEL.actions.increment),
);

instance.isActionAvailable("increment");
instance.getAvailableActions();
instance.isIntentDispatchable(instance.MEL.actions.increment);
instance.getIntentBlockers(instance.MEL.actions.increment);
instance.getActionMetadata("increment");
instance.getSnapshot();
instance.getCanonicalSnapshot();
instance.getSchemaGraph();
instance.simulate(instance.MEL.actions.increment);
console.log(report.kind);
```

## `createIntent()` binding forms

`createIntent()` stays anchored on the canonical `MEL.actions.*` surface.

Supported forms today are:

```typescript
instance.createIntent(instance.MEL.actions.increment);
instance.createIntent(instance.MEL.actions.add, 3);
instance.createIntent(instance.MEL.actions.addTodo, "Review docs", "todo-1");
instance.createIntent(instance.MEL.actions.addTodo, {
  title: "Review docs",
  id: "todo-1",
});
```

Rules:

- zero-parameter actions use `createIntent(action)`
- single-parameter actions accept the parameter value directly; keyed object binding is also supported when the single parameter is not itself object-like
- multi-parameter actions support both positional binding and a single object argument
- hand-authored multi-field object inputs without positional metadata should be treated as object-only bindings

This is a supported public contract, not an implementation detail.

## Action metadata for tooling

Use `getActionMetadata()` when a UI, adapter, or agent needs the runtime's public action contract without maintaining a parallel registry.

```typescript
const addTodo = instance.getActionMetadata("addTodo");

console.log(addTodo.name);
console.log(addTodo.params);
console.log(addTodo.input);
console.log(addTodo.hasDispatchableGate);
console.log(addTodo.description);

const allActions = instance.getActionMetadata();
```

The accessor exposes:

- action name
- parameter names
- machine-readable input schema
- `hasDispatchableGate`
- optional description

`getAvailableActions()` remains the coarse legality query. `isIntentDispatchable()`, `getIntentBlockers()`, and the intent explanation reads are the fine bound-intent legality surface. `getActionMetadata()` is a read-only contract inspection surface.

Treat `getAvailableActions()` and `isActionAvailable()` as current-snapshot reads, not durable capability grants. The runtime still revalidates legality at dequeue time, so callers should re-read after state changes instead of caching an old action name as a future promise.

## Intent Explanation

Use the current-snapshot runtime reads when you want one structured answer to:

- is the action available right now?
- if available, is this bound intent dispatchable?
- if admitted, what would the dry-run result look like?

```typescript
const intent = instance.createIntent(instance.MEL.actions.increment);

const explanation = instance.explainIntent(intent);
const same = instance.why(intent);
const blockers = instance.whyNot(intent);
```

- `explainIntent()` returns a structured `IntentExplanation` for the bound intent against the current visible canonical snapshot.
- `why()` is a convenience alias of `explainIntent()`.
- `whyNot()` returns blockers for the first failing layer, or `null` if the intent is admitted.

Explanation reads preserve SDK input validation ordering. If the action is available but the supplied intent input is invalid, `explainIntent()`, `why()`, and `whyNot()` throw `INVALID_INPUT` before dispatchability or blocker projection.
If the action is unavailable, these reads return the unavailable blocked result and do not surface invalid-input failures hidden behind that unavailable action.
They remain available after `dispose()` as read-only inspection over the last visible canonical snapshot.

Blocked and admitted branches are explicit:

```typescript
if (explanation.kind === "blocked" && !explanation.available) {
  console.log("Unavailable blockers", explanation.blockers);
}

if (explanation.kind === "blocked" && explanation.available) {
  console.log("Dispatchability blockers", explanation.blockers);
}

if (explanation.kind === "admitted") {
  console.log(explanation.snapshot);
  console.log(explanation.canonicalSnapshot);
  console.log(explanation.newAvailableActions);
  console.log(explanation.changedPaths);
}
```

Treat `snapshot`, `newAvailableActions`, `changedPaths`, and `status` as the stable comparison surface for repeated explanation reads. `canonicalSnapshot` is a canonical inspection view and may carry host-managed logical metadata such as `timestamp`.

The intended legality ladder for callers is:

1. coarse availability
2. blocker / explanation reads
3. admitted dry-run
4. execution

`whyNot()` and `getIntentBlockers()` are the lightweight first-failing-layer reads. `simulate()` is the admitted dry-run step.

## Static Graph And Dry-Run Introspection

Use `getSchemaGraph()` when you need the projected static dependency graph for the activated schema. Ref-based lookup through `instance.MEL.*` is the canonical surface; kind-prefixed ids such as `state:count` are debug-only convenience.

Use `simulate()` when you need a non-committing dry-run of an action against the current runtime state. It returns the projected snapshot, effect requirements, new action availability, sorted `changedPaths`, and may also expose optional inspection-only `diagnostics.trace`. Unavailable actions reject with `ACTION_UNAVAILABLE`; available but invalid-input intents reject with `INVALID_INPUT`; available but non-dispatchable intents reject with `INTENT_NOT_DISPATCHABLE`. Treat `changedPaths` and diagnostics as inspection/debug output rather than the canonical branching API.

If the action is available but the bound intent input is invalid, `simulate()` rejects with `INVALID_INPUT` before dispatchability.

If `diagnostics.trace` is present, it is derived from the dry-run Core trace for the same admitted compute pass that produced the simulated snapshot, status, and requirements. SDK dry-run surfaces may normalize volatile host-time fields such as trace-node timestamps or duration so repeated reads stay stable.

Queued dispatches use the same legality split. If `dispatchAsync()` is rejected before publication, the runtime emits `dispatch:rejected` with a stable machine-readable `code` plus a human-readable `reason`. `ACTION_UNAVAILABLE` means the coarse action gate failed at dequeue time. `INVALID_INPUT` means the action stayed available, but the bound intent input failed SDK validation. `INTENT_NOT_DISPATCHABLE` means the action stayed available, input was valid, and the bound intent failed the fine gate.

Base SDK and lineage runtimes keep event payloads plus stable rejection codes as streaming lifecycle telemetry. They now also expose additive write-report companions: base uses `dispatchAsyncWithReport()` and lineage uses `commitAsyncWithReport()`. Governed runtimes use root helpers from `@manifesto-ai/governance`: `waitForProposal()` for normalized settlement state and `waitForProposalWithReport()` for stored-world settlement outcome reports. Neither helper replaces `proposeAsync()`.

## Additive Write Report

Use `dispatchAsyncWithReport()` when a caller needs a first-party execution bundle instead of `try/catch` plus manual before/after diff logic.

```typescript
const intent = instance.createIntent(instance.MEL.actions.increment);
const report = await instance.dispatchAsyncWithReport(intent);

if (report.kind === "completed") {
  console.log(report.outcome.projected.changedPaths);
  console.log(report.outcome.projected.availability.unlocked);
}

if (report.kind === "rejected") {
  console.log(report.rejection.code);
  console.log(report.admission.failure.kind);
}
```

`dispatchAsyncWithReport()` is additive. It does not replace `dispatchAsync()`, and it does not change queueing, legality ordering, or publication behavior.

The report union gives tooling and agent callers:

- admitted vs blocked intent admission in-band
- before/after projected and canonical snapshots on completed reports
- projected diff and availability delta in `report.outcome`
- stable rejection codes plus before snapshots on rejected reports
- `published: true | false` on failed reports, with `outcome` only when a terminal snapshot was actually published
- optional debug-grade `diagnostics.hostTraces` when the Host already returned trace data

## Decorator/provider authoring seam

Use `@manifesto-ai/sdk/provider` when you are composing activation-first runtimes or authoring decorators on top of the SDK. That subpath is for package authors, not typical app code.

The current public seam includes:

- `RuntimeKernel`
- `RuntimeKernelFactory`
- activation helpers such as `attachRuntimeKernelFactory()`, `getRuntimeKernelFactory()`, `getActivationState()`, and `activateComposable()`

App-facing runtime work should stay on `@manifesto-ai/sdk`.
`getSnapshot()` is the default projected read model for application code. `getCanonicalSnapshot()` is the full runtime substrate for persistence, deep debugging, and infrastructure-aware tooling.

## Extension Kernel

ADR-019 now lands in the current SDK contract through `@manifesto-ai/sdk/extensions`.

Its purpose is to give helper and tool authors a **safe post-activation arbitrary-snapshot read-only surface** without exposing the full provider seam.

Usage:

```typescript
import { getExtensionKernel } from "@manifesto-ai/sdk/extensions";

const ext = getExtensionKernel(instance);
const root = ext.getCanonicalSnapshot();
const intent = ext.createIntent(ext.MEL.actions.increment);
const explanation = ext.explainIntentFor(root, intent);
const simulated = ext.simulateSync(root, intent);
const projected = ext.projectSnapshot(simulated.snapshot);

console.log(simulated.diagnostics?.trace);
```

The core analytical helpers on this seam are:

- `projectSnapshot()`
- `getAvailableActionsFor()`
- `isActionAvailableFor()`
- `isIntentDispatchableFor()`
- `explainIntentFor()`
- `simulateSync()`

Branching hypothetical futures stays on the same seam:

```typescript
const ext = getExtensionKernel(instance);
const root = ext.getCanonicalSnapshot();

const first = ext.simulateSync(
  root,
  ext.createIntent(ext.MEL.actions.increment),
);

const branchA = ext.simulateSync(
  first.snapshot,
  ext.createIntent(ext.MEL.actions.increment),
);

const branchB = ext.simulateSync(
  first.snapshot,
  ext.createIntent(ext.MEL.actions.add, 5),
);

const projectedA = ext.projectSnapshot(branchA.snapshot);
const projectedB = ext.projectSnapshot(branchB.snapshot);
```

This is the intended substrate for manual simulation helpers. The SDK no longer relies on a dedicated planner/simulator package for post-activation hypothetical tooling.

Use `explainIntentFor()` when you want the extension seam to compose availability, input validation, dispatchability, first-failing-layer blocker construction, and dry-run simulation for a caller-supplied canonical snapshot. `simulateSync()` remains the lower-level minimal dry-run primitive: it returns the canonical simulated snapshot, status, requirements, and may also expose optional inspection-only `diagnostics.trace`.

`explainIntentFor()` preserves the same legality ordering as the public runtime:

1. availability
2. input validation
3. dispatchability
4. dry-run simulation if admitted

Blocked results expose blockers for the first failing layer only. Admitted results expose the simulated canonical snapshot, the projected public snapshot, and the dry-run summary fields.

If the action is available but the supplied intent input is invalid, `explainIntentFor()` throws `INVALID_INPUT` before dispatchability, blocker projection, or simulation.
If the action is unavailable, `explainIntentFor()` returns the unavailable blocked result and does not surface invalid-input failures hidden behind that unavailable action.
Like the rest of the analytical extension seam, it remains callable after `dispose()` and keeps reading from the last visible canonical snapshot.

Branching from an admitted explanation stays on the same seam:

```typescript
const step1 = ext.explainIntentFor(
  root,
  ext.createIntent(ext.MEL.actions.increment),
);

if (step1.kind === "admitted") {
  const step2 = ext.explainIntentFor(
    step1.canonicalSnapshot,
    ext.createIntent(ext.MEL.actions.add, 5),
  );
}
```

When you want a branchable helper rather than raw substrate access, use the built-in session API:

```typescript
import { createSimulationSession } from "@manifesto-ai/sdk/extensions";

const sim = createSimulationSession(instance);
const step1 = sim.next(instance.MEL.actions.increment);
const branchA = step1.next(instance.MEL.actions.increment);
const branchB = step1.next(instance.MEL.actions.add, 5);
```

## Advanced Runtime Direction

The forward public direction under ADR-017 is:

`createManifesto() -> withLineage() -> withGovernance() -> activate()`

Those advanced-runtime contracts belong to the owning `@manifesto-ai/lineage` and `@manifesto-ai/governance` packages. Legacy world-facade docs are historical tombstones, not the SDK's canonical current story.

If you need richer post-activation hypothetical tooling, build it on `@manifesto-ai/sdk/extensions` rather than a dedicated outer decorator.

## Related Docs

- [Lineage API](./lineage.md)
- [Governance API](./governance.md)
- [Quick Start](/guide/quick-start)
- [When You Need Approval or History](/guides/approval-and-history)
