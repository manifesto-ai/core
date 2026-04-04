# @manifesto-ai/sdk

> Activation-first base runtime entry point for Manifesto.

## Overview

`@manifesto-ai/sdk` owns one concept: `createManifesto()`.

Use SDK when you want:

- the shortest path to a running base world
- a clear activation boundary before runtime execution
- typed intent creation through `MEL.actions.*`
- subscriptions, availability queries, action metadata inspection, and snapshot reads in one package

The current SDK contract is:

`createManifesto(schema, effects) -> activate() -> base runtime instance`

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
  - `getActionMetadata`
  - `isActionAvailable`
  - `MEL`
  - `dispose`
- SDK error types
- `@manifesto-ai/sdk/provider` for decorator/provider authoring seams

## Base Runtime Example

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto<CounterDomain>(domainSchema, {});
const world = manifesto.activate();

const intent = world.createIntent(world.MEL.actions.increment);
await world.dispatchAsync(intent);

world.isActionAvailable("increment");
world.getAvailableActions();
world.getActionMetadata("increment");
world.getSnapshot();
world.getCanonicalSnapshot();
```

## `createIntent()` binding forms

`createIntent()` stays anchored on the canonical `MEL.actions.*` surface.

Supported forms today are:

```typescript
world.createIntent(world.MEL.actions.increment);
world.createIntent(world.MEL.actions.add, 3);
world.createIntent(world.MEL.actions.addTodo, "Review docs", "todo-1");
world.createIntent(world.MEL.actions.addTodo, {
  title: "Review docs",
  id: "todo-1",
});
```

Rules:

- zero-parameter actions use `createIntent(action)`
- single-parameter actions use the parameter value directly
- multi-parameter actions support both positional binding and a single object argument
- hand-authored multi-field object inputs without positional metadata should be treated as object-only bindings

This is a supported public contract, not an implementation detail.

## Action metadata for tooling

Use `getActionMetadata()` when a UI, adapter, or agent needs the runtime's public action contract without maintaining a parallel registry.

```typescript
const addTodo = world.getActionMetadata("addTodo");

console.log(addTodo.name);
console.log(addTodo.params);
console.log(addTodo.input);
console.log(addTodo.description);

const allActions = world.getActionMetadata();
```

The accessor exposes:

- action name
- parameter names
- machine-readable input schema
- optional description

`getAvailableActions()` remains the legality query. `getActionMetadata()` is a read-only contract inspection surface.

## Decorator/provider authoring seam

Use `@manifesto-ai/sdk/provider` when you are composing activation-first runtimes or authoring decorators on top of the SDK. That subpath is for package authors, not typical app code.

The current public seam includes:

- `RuntimeKernel`
- `RuntimeKernelFactory`
- activation helpers such as `attachRuntimeKernelFactory()`, `getRuntimeKernelFactory()`, `getActivationState()`, and `activateComposable()`

App-facing runtime work should stay on `@manifesto-ai/sdk`.
`getSnapshot()` is the default projected read model for application code. `getCanonicalSnapshot()` is the full runtime substrate for persistence, deep debugging, and infrastructure-aware tooling.

## Advanced Runtime Direction

The forward public direction under ADR-017 is:

`createManifesto() -> withLineage() -> withGovernance() -> activate()`

Those advanced-runtime contracts belong to the owning `@manifesto-ai/lineage` and `@manifesto-ai/governance` packages. Legacy world-facade docs are historical tombstones, not the SDK's canonical current story.

## Related Docs

- [Lineage API](./lineage.md)
- [Governance API](./governance.md)
- [Quickstart](/quickstart)
- [When You Need Approval or History](/guides/approval-and-history)
