# @manifesto-ai/sdk

> Default application-facing runtime for Manifesto.

## Role

SDK owns the current direct-dispatch surface:

- `createManifesto(schema, effects)`
- activation boundary via `activate()`
- typed `createIntent()` and `dispatchAsync()`
- projected `getSnapshot()`
- canonical `getCanonicalSnapshot()`
- action availability and metadata inspection
- projected introspection via `getSchemaGraph()` and `simulate()`

SDK no longer owns governed composition through a top-level `world` facade.

## Dependencies

- `@manifesto-ai/core`
- `@manifesto-ai/host`
- `@manifesto-ai/compiler`

## Public API

### `createManifesto(schema, effects): ComposableManifesto<T, BaseComposableLaws>`

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterSchema from "./counter.mel";

const manifesto = createManifesto(CounterSchema, {
  "api.fetchUser": async (params, ctx) => {
    const p = params as { id: string };
    const data = await fetch(`/users/${p.id}`).then((r) => r.json());
    return [{ op: "set", path: ["user"], value: data }];
  },
});
```

### Base activated instance

```typescript
const instance = createManifesto(schema, effects).activate();

const intent = instance.createIntent(instance.MEL.actions.increment);
await instance.dispatchAsync(intent);

instance.getSnapshot();
instance.getCanonicalSnapshot();
instance.getSchemaGraph();
instance.simulate(instance.MEL.actions.increment);
instance.getAvailableActions();
instance.getActionMetadata();
instance.isActionAvailable("increment");
```

### `ManifestoBaseInstance<T>`

```typescript
interface ManifestoBaseInstance<T> {
  createIntent(actionRef, ...args): TypedIntent<T>;
  dispatchAsync(intent): Promise<Snapshot<T["state"]>>;
  subscribe(selector, listener): Unsubscribe;
  on(event, handler): Unsubscribe;
  getSnapshot(): Snapshot<T["state"]>;
  getCanonicalSnapshot(): CanonicalSnapshot<T["state"]>;
  getAvailableActions(): readonly (keyof T["actions"])[];
  getActionMetadata(name?): TypedActionMetadata<T> | readonly TypedActionMetadata<T>[];
  isActionAvailable(name): boolean;
  getSchemaGraph(): SchemaGraph;
  simulate(actionRef, ...args): SimulateResult<T>;
  MEL: TypedMEL<T>;
  schema: DomainSchema;
  dispose(): void;
}
```

## Current semantics

- `getSnapshot()` is projected and hides platform-owned internals such as `data.$*`.
- `getCanonicalSnapshot()` returns the current visible canonical substrate.
- `getSchemaGraph()` exposes projected static graph structure only.
- `simulate()` is a pure dry-run that uses the full transition contract but does not commit runtime state.
- `changedPaths` from `simulate()` is inspection/debug output, not the canonical branching API.

## Governed composition

SDK is the substrate for the current governed path:

```typescript
createManifesto(schema, effects)
  -> withLineage(...)
  -> withGovernance(...)
  -> activate()
```

SDK does not re-export the old world facade and does not own governed bootstrap assembly.

## Errors

- `ManifestoError`
- `ReservedEffectError`
- `DisposedError`
- `CompileError`

## Notes

- `FieldRef` and `ComputedRef` use `name` as the current public identity field.
- Graph traversal is ref-canonical; string node ids are debug convenience only.
- Current living contract is `packages/sdk/docs/sdk-SPEC.md`.
