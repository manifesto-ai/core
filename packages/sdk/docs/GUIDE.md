# SDK Guide

> Practical guide for the activation-first `@manifesto-ai/sdk` path.

> **Current Contract Note:** This guide follows the current SDK v3.1.0 living contract. `createManifesto()` returns a composable manifesto, runtime verbs appear only after `activate()`, and the current base surface includes projected introspection.

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

For multi-parameter actions, the runtime also supports a single object argument:

```typescript
const intent = instance.createIntent(instance.MEL.actions.addTodo, {
  title: "Review docs",
  id: "todo-1",
});
```

Use that when field-name binding is clearer than positional order.

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

const preview = instance.simulate(instance.MEL.actions.increment);

console.log(preview.snapshot);
console.log(preview.changedPaths);
console.log(preview.newAvailableActions);
```

Use `getSchemaGraph()` for projected static dependency inspection. Ref-based lookup through `instance.MEL.*` is canonical. Kind-prefixed ids such as `state:count` remain convenience/debug-only.

Use `simulate()` for a non-committing dry-run against the current canonical snapshot. It returns the projected next snapshot, effect requirements, new availability, and sorted `changedPaths`. Treat `changedPaths` as explanation/debug output rather than the branching API.

---

## 5. Dispatch, Observe, And Read

```typescript
const off = instance.subscribe(
  (snapshot) => snapshot.data.count,
  (count) => {
    console.log("Count changed:", count);
  },
);

const offCompleted = instance.on("dispatch:completed", (event) => {
  console.log("Completed intent:", event.intentId);
});
```

Subscriptions are the main render path. Telemetry events are the main lifecycle path. Together they cover most direct-dispatch integrations.

If you need effect-level instrumentation, keep the effect handlers small and let them return patches that describe the visible result.

---

## 6. Activation Is One-Shot

```typescript
const manifesto = createManifesto<CounterDomain>(domainSchema, {});
const instance = manifesto.activate();
```

After activation:

- runtime verbs exist on `instance`
- the composable manifesto cannot be activated again
- there is no path back to the pre-activation phase

---

## 7. Decorator / provider authoring seam

Use `@manifesto-ai/sdk/provider` only when you are composing new decorators or provider-level runtime wrappers.

The stable authoring seam is the activation/runtime composition layer:

- `RuntimeKernel`
- `RuntimeKernelFactory`
- `attachRuntimeKernelFactory()`
- `getRuntimeKernelFactory()`
- `getActivationState()`
- `activateComposable()`
- `assertComposableNotActivated()`

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
      const kernel = createKernel();
      return {
        createIntent: kernel.createIntent,
        dispatchAsync: async (intent) => kernel.executeHost(intent).then((result) => result.snapshot),
        subscribe: kernel.subscribe,
        on: kernel.on,
        getSnapshot: kernel.getSnapshot,
        getCanonicalSnapshot: kernel.getCanonicalSnapshot,
        getAvailableActions: kernel.getAvailableActions,
        getActionMetadata: kernel.getActionMetadata,
        isActionAvailable: kernel.isActionAvailable,
        getSchemaGraph: kernel.getSchemaGraph,
        simulate: kernel.simulate,
        MEL: kernel.MEL,
        schema: kernel.schema,
        dispose: kernel.dispose,
      };
    },
  };

  return attachRuntimeKernelFactory(decorated, createKernel, activationState);
}
```

The point of the subpath is to let decorator authors stay on public imports. App-facing integrations should stay on `@manifesto-ai/sdk`.

---

## 8. Governed Composition Direction

Stay on the SDK when:

- you need the present-only base runtime
- Snapshot reads, subscriptions, availability queries, and action metadata inspection are enough
- you do not need lineage or governance semantics

The public direction for governed composition is:

`createManifesto() -> withLineage() -> withGovernance() -> activate()`

Those runtime contracts belong to the owning Lineage and Governance packages. This guide intentionally focuses on the landed base SDK contract.

---

## 9. Related Docs

- [SDK README](../README.md)
- [SDK Specification](sdk-SPEC.md)
- [SDK Version Index](VERSION-INDEX.md)
- [SDK API](../../../docs/api/sdk.md)
- [API Index](../../../docs/api/index.md)
- [World Concept](../../../docs/concepts/world.md)
- [Tutorial](../../../docs/tutorial/)
