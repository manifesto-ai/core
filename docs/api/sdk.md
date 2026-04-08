# @manifesto-ai/sdk

> Activation-first base runtime entry point for Manifesto.

## Overview

`@manifesto-ai/sdk` owns one concept: `createManifesto()`.

Use SDK when you want:

- the shortest path to a running base runtime
- a clear activation boundary before runtime execution
- typed intent creation through `MEL.actions.*`
- subscriptions, availability queries, dispatchability queries, action metadata inspection, static graph inspection, dry-run simulation, and snapshot reads in one package

The current documented SDK contract is:

`createManifesto(schema, effects) -> activate() -> base runtime instance`

The current post-activation extension seam is:

`@manifesto-ai/sdk/extensions -> getExtensionKernel(app)`

The current first-party hypothetical-session helper is:

`@manifesto-ai/sdk/extensions -> createSimulationSession(app)`

## SDK-Owned Surface

- `createManifesto()`
- `activate()`
- activated base runtime:
  - `createIntent`
  - `dispatchAsync`
  - `subscribe`
  - `on`
  - `getSnapshot`
  - `getCanonicalSnapshot`
  - `getAvailableActions`
  - `isIntentDispatchable`
  - `getIntentBlockers`
  - `getActionMetadata`
  - `isActionAvailable`
  - `getSchemaGraph`
  - `simulate`
  - `MEL`
  - `schema`
  - `dispose`
- SDK error types
- `@manifesto-ai/sdk/extensions` for safe arbitrary-snapshot read-only helpers
- `@manifesto-ai/sdk/provider` for decorator/provider authoring seams

## Base Runtime Example

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto<CounterDomain>(domainSchema, {});
const instance = manifesto.activate();

const intent = instance.createIntent(instance.MEL.actions.increment);
await instance.dispatchAsync(intent);

instance.isActionAvailable("increment");
instance.getAvailableActions();
instance.isIntentDispatchable(instance.MEL.actions.increment);
instance.getIntentBlockers(instance.MEL.actions.increment);
instance.getActionMetadata("increment");
instance.getSnapshot();
instance.getCanonicalSnapshot();
instance.getSchemaGraph();
instance.simulate(instance.MEL.actions.increment);
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

`getAvailableActions()` remains the coarse legality query. `isIntentDispatchable()` and `getIntentBlockers()` are the fine bound-intent legality surface. `getActionMetadata()` is a read-only contract inspection surface.

## Static Graph And Dry-Run Introspection

Use `getSchemaGraph()` when you need the projected static dependency graph for the activated schema. Ref-based lookup through `instance.MEL.*` is the canonical surface; kind-prefixed ids such as `state:count` are debug-only convenience.

Use `simulate()` when you need a non-committing dry-run of an action against the current runtime state. It returns the projected snapshot, effect requirements, new action availability, and sorted `changedPaths`. Unavailable actions reject with `ACTION_UNAVAILABLE`; available but non-dispatchable intents reject with `INTENT_NOT_DISPATCHABLE`. Treat `changedPaths` as inspection/debug output rather than the canonical branching API.

Queued dispatches use the same legality split. If `dispatchAsync()` is rejected before publication, the runtime emits `dispatch:rejected` with a stable machine-readable `code` plus a human-readable `reason`. `ACTION_UNAVAILABLE` means the coarse action gate failed at dequeue time. `INTENT_NOT_DISPATCHABLE` means the action stayed available, but the bound intent failed the fine gate.

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
const simulated = ext.simulateSync(root, intent);
const projected = ext.projectSnapshot(simulated.snapshot);
```

The core analytical helpers on this seam are:

- `projectSnapshot()`
- `getAvailableActionsFor()`
- `isActionAvailableFor()`
- `isIntentDispatchableFor()`
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

The extension seam does not expose blocker explanations. For arbitrary snapshots, compose `isIntentDispatchableFor()` with your own tooling logic. For the current visible snapshot, stay on the activated base runtime and use `getIntentBlockers()`.

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
- [Quickstart](/quickstart)
- [When You Need Approval or History](/guides/approval-and-history)
