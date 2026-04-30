# SDK Guide

> Practical guide for the activation-first `@manifesto-ai/sdk` path.

> **Current Contract Note:** This guide follows the current SDK v3.x living contract. `createManifesto()` returns a composable manifesto, runtime verbs appear only after `activate()`, the base surface includes dispatchability queries, projected introspection, and bound-intent dry-run through `simulateIntent(intent)`, `dispatchAsyncWithReport()` is the additive base write-report companion, and `@manifesto-ai/sdk/extensions` provides the safe post-activation arbitrary-snapshot seam plus a first-party simulation-session helper.

## 1. Build The Activation Lifecycle

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto<CounterDomain>(domainSchema, {});
const instance = manifesto.activate();

const intent = instance.createIntent(instance.MEL.actions.increment);
await instance.dispatchAsync(intent);

const canIncrement = instance.isActionAvailable("increment");
const available = instance.getAvailableActions();
const metadata = instance.getActionMetadata("increment");
const snapshot = instance.getSnapshot();
const canonical = instance.getCanonicalSnapshot();
const graph = instance.getSchemaGraph();
const preview = instance.simulate(instance.MEL.actions.increment);
const intentPreview = instance.simulateIntent(intent);
```

This is the normal SDK lifecycle:

1. create one composable manifesto
2. activate it once
3. create a typed intent from `MEL.actions.*`
4. dispatch it through the activated instance
5. optionally query action availability or action metadata
6. read the next terminal Snapshot

`createManifesto()` no longer returns a ready-to-run runtime instance. The activated instance is the canonical public surface.

`getSnapshot()` is the normal projected read for app code. `getCanonicalSnapshot()` is the explicit full-substrate read for persistence-aware or infrastructure-aware debugging.

When ordinary app code only needs the next published Snapshot, keep using `dispatchAsync()`. When tooling or agent callers need in-band admission, before/after snapshots, projected diffs, availability deltas, or optional diagnostics, use the additive companion `dispatchAsyncWithReport()`.

---

## 2. Create Typed Intents

```typescript
const increment = instance.createIntent(instance.MEL.actions.increment);
const add = instance.createIntent(instance.MEL.actions.add, 3);
const addTodo = instance.createIntent(instance.MEL.actions.addTodo, {
  title: "Review docs",
  id: "todo-1",
});
```

`createIntent()` is instance-owned and typed from the activated runtime's MEL surface.

The canonical path is:

```typescript
const intent = instance.createIntent(instance.MEL.actions.someAction, ...args);
await instance.dispatchAsync(intent);
```

For parameterized actions, the runtime also supports a single object argument:

```typescript
const intent = instance.createIntent(instance.MEL.actions.addTodo, {
  title: "Review docs",
  id: "todo-1",
});
```

Use that when field-name binding is clearer than positional order. Single-parameter actions may also use `{ paramName: value }` when that is more readable than the raw value form.

String-name intent creation is no longer the SDK's canonical public story.

---

## 3. Inspect The Runtime Contract

```typescript
const allActions = instance.getActionMetadata();
const addTodo = instance.getActionMetadata("addTodo");

console.log(addTodo.params);
console.log(addTodo.input);
console.log(addTodo.description);
```

Use `getActionMetadata()` when an adapter, model-facing tool, or UI needs the public action contract without maintaining a parallel registry.

`getAvailableActions()` answers “what is legal right now?”
`getActionMetadata()` answers “what does this action look like?”

---

## 4. Inspect Static Graphs And Dry-Run Outcomes

```typescript
const graph = instance.getSchemaGraph();

const downstream = graph.traceDown(instance.MEL.state.count);
const upstream = graph.traceUp(instance.MEL.actions.incrementIfEven);
const debug = graph.traceDown("state:count");

const intent = instance.createIntent(instance.MEL.actions.increment);
const preview = instance.simulateIntent(intent);

console.log(preview.snapshot);
console.log(preview.changedPaths);
console.log(preview.newAvailableActions);
```

Use `getSchemaGraph()` for projected static dependency inspection. Ref-based lookup through `instance.MEL.*` is canonical. Kind-prefixed ids such as `state:count` remain convenience/debug-only.

Use `simulateIntent(intent)` when you already have a typed intent. Use `simulate(action, ...args)` when you want the runtime to bind and dry-run in one call. Both perform a non-committing dry-run against the current canonical snapshot and return the projected next snapshot, effect requirements, new availability, sorted `changedPaths`, and optional debug-grade `diagnostics.trace`. Treat `changedPaths` and diagnostics as explanation/debug output rather than the branching API.

---

## 5. Use The Additive Report Companion When Tooling Needs More Context

```typescript
const report = await instance.dispatchAsyncWithReport(
  instance.createIntent(instance.MEL.actions.increment),
);

if (report.kind === "completed") {
  console.log(report.outcome.projected.changedPaths);
  console.log(report.outcome.projected.availability.unlocked);
}

if (report.kind === "rejected") {
  console.log(report.rejection.code);
  console.log(report.admission.failure.kind);
}
```

`dispatchAsyncWithReport()` does not replace `dispatchAsync()`.
It is the additive write companion for callers that need:

- first-failing admission data without `try/catch` control flow
- before/after projected and canonical snapshots
- projected `changedPaths` and availability deltas
- optional debug-grade Host diagnostics when they already exist

The report surface reuses the same dequeue-time legality ordering and publication semantics as `dispatchAsync()`.

For failure observation, keep the surfaces distinct:

- use `dispatchAsyncWithReport()` for the result of this execution attempt
- use `snapshot.system.lastError` for the current semantic error state
- use canonical `data.$host.lastError` only for deep Host/effect diagnostics

---

## 6. Dispatch, Observe, And Read

```typescript
const off = instance.observe.state(
  (snapshot) => snapshot.state.count,
  (count) => {
    console.log("Count changed:", count);
  },
);

const offSettled = instance.observe.event("submission:settled", (event) => {
  console.log("Settled action:", event.action);
});
```

State observers are the main render path. Telemetry events are the main lifecycle path. Together they cover most v5 submit integrations.

If you need effect-level instrumentation, keep the effect handlers small and let them return patches that describe the visible result.

---

## 7. Activation Is One-Shot

```typescript
const manifesto = createManifesto<CounterDomain>(domainSchema, {});
const instance = manifesto.activate();
```

After activation:

- runtime verbs exist on `instance`
- the composable manifesto cannot be activated again
- there is no path back to the pre-activation phase

---

## 8. `@manifesto-ai/sdk/extensions`

The current post-activation extension seam is:

```typescript
import { getExtensionKernel } from "@manifesto-ai/sdk/extensions";

const ext = getExtensionKernel(instance);
const root = ext.getCanonicalSnapshot();
const intent = ext.createIntent(ext.MEL.actions.increment);
const simulated = ext.simulateSync(root, intent);
const projected = ext.projectSnapshot(simulated.snapshot);
```

Use this seam when you need:

- arbitrary-snapshot dry-runs after activation
- availability checks against hypothetical canonical snapshots
- pure projection of hypothetical canonical snapshots back to public `Snapshot`
- helper/tool authoring without importing the full provider seam

This seam remains distinct from `@manifesto-ai/sdk/provider`:

- `sdk/extensions` = safe arbitrary-snapshot read-only tools
- `sdk/provider` = full decorator/provider authoring seam

Minimal branching example:

```typescript
const ext = getExtensionKernel(instance);
const root = ext.getCanonicalSnapshot();

const step1 = ext.simulateSync(
  root,
  ext.createIntent(ext.MEL.actions.increment),
);

const branchA = ext.simulateSync(
  step1.snapshot,
  ext.createIntent(ext.MEL.actions.increment),
);

const branchB = ext.simulateSync(
  step1.snapshot,
  ext.createIntent(ext.MEL.actions.add, 5),
);

const projectedA = ext.projectSnapshot(branchA.snapshot);
const projectedB = ext.projectSnapshot(branchB.snapshot);
```

The SDK treats this as substrate, not as a separate outer decorator. The first-party `createSimulationSession(app)` helper is built directly on this seam.

The SDK now ships that helper directly:

```typescript
import { createSimulationSession } from "@manifesto-ai/sdk/extensions";

const sim = createSimulationSession(instance);
const step1 = sim.next(instance.MEL.actions.increment);
const branchA = step1.next(instance.MEL.actions.increment);
const branchB = step1.next(instance.MEL.actions.load);

console.log(branchA.snapshot);
console.log(branchB.status);
```

`createSimulationSession()` is a thin immutable wrapper over the Extension Kernel:

- root session starts from the current canonical snapshot
- `next()` returns a new branch and leaves the original session unchanged
- `availableActions` are typed MEL action refs for the current branch
- `finish()` returns the current branch state as a plain result object
- terminal `pending`, `halted`, and `error` branches reject further `next()` calls

## 8. Decorator / provider authoring seam

Use `@manifesto-ai/sdk/provider` only when you are composing new decorators or provider-level runtime wrappers.

The stable authoring seam is the activation/runtime composition layer:

- `RuntimeKernel`
- `RuntimeKernelFactory`
- `attachRuntimeKernelFactory()`
- `createBaseRuntimeInstance()`
- `getRuntimeKernelFactory()`
- `getActivationState()`
- `activateComposable()`
- `assertComposableNotActivated()`

If you want to turn a provider-authored `RuntimeKernel` back into the standard
base SDK runtime contract, use `createBaseRuntimeInstance(kernel)` from the
provider seam rather than reaching into an internal subpath.

For decorators that need hypothetical planning or availability checks against
non-live state, `RuntimeKernel` also exposes pure arbitrary-snapshot helpers:

- `simulateSync(snapshot, intent)`
- `getAvailableActionsFor(snapshot)`
- `isActionAvailableFor(snapshot, actionName)`

These operate on caller-provided canonical snapshots. They do not publish,
commit, or mutate the runtime's visible snapshot.

Minimal example:

```typescript
import type {
  BaseComposableLaws,
  ComposableManifesto,
  ManifestoDomainShape,
} from "@manifesto-ai/sdk";
import {
  activateComposable,
  attachRuntimeKernelFactory,
  createBaseRuntimeInstance,
  getActivationState,
  getRuntimeKernelFactory,
} from "@manifesto-ai/sdk/provider";

function withExampleDecorator<T extends ManifestoDomainShape>(
  manifesto: ComposableManifesto<T, BaseComposableLaws>,
): ComposableManifesto<T, BaseComposableLaws> {
  const createKernel = getRuntimeKernelFactory(manifesto);
  const activationState = getActivationState(manifesto);

  const decorated: ComposableManifesto<T, BaseComposableLaws> = {
    _laws: manifesto._laws,
    schema: manifesto.schema,
    activate() {
      activateComposable(decorated);
      return createBaseRuntimeInstance(createKernel());
    },
  };

  return attachRuntimeKernelFactory(decorated, createKernel, activationState);
}
```

The point of the subpath is to let decorator authors stay on public imports. App-facing integrations should stay on `@manifesto-ai/sdk`.

Example arbitrary-snapshot dry-run:

```typescript
const kernel = getRuntimeKernelFactory(manifesto)();
const root = kernel.getCanonicalSnapshot();
const intent = kernel.createIntent(kernel.MEL.actions.increment);
const simulated = kernel.simulateSync(root, intent);

console.log(simulated.snapshot);
console.log(kernel.getAvailableActionsFor(simulated.snapshot));
console.log(kernel.isActionAvailableFor(simulated.snapshot, "incrementIfEven"));
```

---

## 9. Governed Composition Direction

Stay on the SDK when:

- you need the present-only base runtime
- Snapshot reads, subscriptions, availability queries, and action metadata inspection are enough
- you do not need lineage or governance semantics

The public direction for governed composition is:

`createManifesto() -> withLineage() -> withGovernance() -> activate()`

Those runtime contracts belong to the owning Lineage and Governance packages. This guide intentionally focuses on the landed base SDK contract.

---

## 10. Related Docs

- [SDK README](../README.md)
- [SDK Specification](sdk-SPEC.md)
- [SDK Version Index](VERSION-INDEX.md)
- [SDK API](../../../docs/api/sdk.md)
- [API Index](../../../docs/api/index.md)
- [World Records and Governed Composition](../../../docs/concepts/world.md)
- [Tutorial](../../../docs/tutorial/)
