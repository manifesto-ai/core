# SDK Guide

> Practical guide for the activation-first `@manifesto-ai/sdk` path.

> **Current Contract Note:** This guide follows the current SDK v3 activation model. `createManifesto()` now returns a composable manifesto, and runtime verbs appear only after `activate()`.

## 1. Build The Activation Lifecycle

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto<CounterDomain>(domainSchema, {});
const world = manifesto.activate();

const intent = world.createIntent(world.MEL.actions.increment);
await world.dispatchAsync(intent);

const canIncrement = world.isActionAvailable("increment");
const available = world.getAvailableActions();
const metadata = world.getActionMetadata("increment");
const snapshot = world.getSnapshot();
```

This is the normal SDK lifecycle:

1. create one composable manifesto
2. activate it once
3. create a typed intent from `MEL.actions.*`
4. dispatch it through the activated instance
5. optionally query action availability or action metadata
6. read the next terminal Snapshot

`createManifesto()` no longer returns a ready-to-run runtime instance. The activated instance is the canonical public surface.

---

## 2. Create Typed Intents

```typescript
const increment = world.createIntent(world.MEL.actions.increment);
const add = world.createIntent(world.MEL.actions.add, 3);
const addTodo = world.createIntent(world.MEL.actions.addTodo, {
  title: "Review docs",
  id: "todo-1",
});
```

`createIntent()` is instance-owned and typed from the activated runtime's MEL surface.

The canonical path is:

```typescript
const intent = world.createIntent(world.MEL.actions.someAction, ...args);
await world.dispatchAsync(intent);
```

For multi-parameter actions, the runtime also supports a single object argument:

```typescript
const intent = world.createIntent(world.MEL.actions.addTodo, {
  title: "Review docs",
  id: "todo-1",
});
```

Use that when field-name binding is clearer than positional order.

String-name intent creation is no longer the SDK's canonical public story.

---

## 3. Inspect The Runtime Contract

```typescript
const allActions = world.getActionMetadata();
const addTodo = world.getActionMetadata("addTodo");

console.log(addTodo.params);
console.log(addTodo.input);
console.log(addTodo.description);
```

Use `getActionMetadata()` when an adapter, model-facing tool, or UI needs the public action contract without maintaining a parallel registry.

`getAvailableActions()` answers “what is legal right now?”
`getActionMetadata()` answers “what does this action look like?”

---

## 4. Dispatch, Observe, And Read

```typescript
const off = world.subscribe(
  (snapshot) => snapshot.data.count,
  (count) => {
    console.log("Count changed:", count);
  },
);

const offCompleted = world.on("dispatch:completed", (event) => {
  console.log("Completed intent:", event.intentId);
});
```

Subscriptions are the main render path. Telemetry events are the main lifecycle path. Together they cover most direct-dispatch integrations.

If you need effect-level instrumentation, keep the effect handlers small and let them return patches that describe the visible result.

---

## 5. Activation Is One-Shot

```typescript
const manifesto = createManifesto<CounterDomain>(domainSchema, {});
const world = manifesto.activate();
```

After activation:

- runtime verbs exist on `world`
- the composable manifesto cannot be activated again
- there is no path back to the pre-activation phase

---

## 6. Decorator / provider authoring seam

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
        getAvailableActions: kernel.getAvailableActions,
        getActionMetadata: kernel.getActionMetadata,
        isActionAvailable: kernel.isActionAvailable,
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

## 7. Governed Composition Direction

Stay on the SDK when:

- you need the present-only base runtime
- Snapshot reads, subscriptions, availability queries, and action metadata inspection are enough
- you do not need lineage or governance semantics

The public direction for governed composition is:

`createManifesto() -> withLineage() -> withGovernance() -> activate()`

Those runtime contracts belong to the owning Lineage and Governance packages. This guide intentionally focuses on the landed base SDK contract.

---

## 8. Related Docs

- [SDK README](../README.md)
- [SDK Specification](sdk-SPEC.md)
- [SDK Version Index](VERSION-INDEX.md)
- [SDK API](../../../docs/api/sdk.md)
- [API Index](../../../docs/api/index.md)
- [World](../../../docs/api/world.md)
- [Tutorial](../../../docs/tutorial/)
