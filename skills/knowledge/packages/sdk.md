# @manifesto-ai/sdk

> Public developer API layer. Canonical entry point for SDK-style Manifesto apps.

## Role

SDK owns the public app-facing surface:

- `createManifesto()`
- availability query convenience methods on `ManifestoInstance`
- `dispatchAsync()`
- `defineOps()`
- SDK error types
- selected re-exports from Core, Host, and World

In the current implementation, `createManifesto()` composes Core, Host, and Compiler directly. The package also depends on `@manifesto-ai/world` and re-exports only a thin governed surface, but `createManifesto()` itself is not a World orchestrator.

## Dependencies

- `@manifesto-ai/core`
- `@manifesto-ai/host`
- `@manifesto-ai/world`
- `@manifesto-ai/compiler`

## Public API

### `createManifesto(config): ManifestoInstance<T>`

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const app = createManifesto({
  schema: domainSchema,
  effects: {
    "api.fetchUser": async (params, ctx) => {
      const p = params as { id: string };
      const data = await fetch(`/users/${p.id}`).then((r) => r.json());
      return [{ op: "set", path: "data.user", value: data }];
    },
  },
});
```

### `ManifestoConfig<T>`

```typescript
interface ManifestoConfig<T = unknown> {
  schema: DomainSchema | string;
  effects: Record<string, EffectHandler>;
  guard?: (intent: Intent, snapshot: Snapshot<T>) => boolean;
  snapshot?: Snapshot<T>;
}
```

Note: current implementation does not accept a `store` option on `createManifesto()`.

### `ManifestoInstance<T>`

```typescript
interface ManifestoInstance<T = unknown> {
  dispatch(intent: Intent): void;
  subscribe<R>(selector: Selector<T, R>, listener: (value: R) => void): Unsubscribe;
  on<K extends ManifestoEvent>(
    event: K,
    handler: (payload: ManifestoEventMap<T>[K]) => void,
  ): Unsubscribe;
  isActionAvailable(actionName: string): boolean;
  getAvailableActions(): readonly string[];
  getSnapshot(): Snapshot<T>;
  dispose(): void;
}
```

### Effect handler types

```typescript
type EffectContext<T = unknown> = {
  readonly snapshot: Readonly<Snapshot<T>>;
};

type EffectHandler = (
  params: unknown,
  ctx: EffectContext,
) => Promise<readonly Patch[]>;
```

SDK adapts this 2-argument handler to Host's internal 3-argument effect handler contract.

### `dispatchAsync(instance, intent): Promise<Snapshot<T>>`

Promise wrapper around `dispatch()` plus event subscriptions:

- resolves on `dispatch:completed`
- rejects on `dispatch:failed`
- rejects with `DispatchRejectedError` on `dispatch:rejected`

### `defineOps<TData>()`

```typescript
import { defineOps } from "@manifesto-ai/sdk";

type State = { count: number; user: { name: string; age: number } };
const ops = defineOps<State>();

ops.set("count", 5);
ops.set("user.name", "Alice");
ops.merge("user", { age: 30 });
ops.unset("count");
ops.raw.set("$host.custom", { ok: true });
```

### Event channel

```typescript
type ManifestoEvent = "dispatch:completed" | "dispatch:rejected" | "dispatch:failed";
```

Payloads are event-specific through `ManifestoEventMap<T>`.

## Selected Re-exports

- From Core: `createIntent`, `createSnapshot`, `createCore`, core types
- From Host: `HostResult`, `HostOptions`
- From World: `createWorld` plus the thin governed type surface needed for explicit composition

## Errors

- `ManifestoError`
- `ReservedEffectError`
- `DisposedError`
- `CompileError`
- `DispatchRejectedError`

## Notes

- SDK `Snapshot<T>` transparently follows the current Core Snapshot shape.
- `getSnapshot()` no longer exposes accumulated `system.errors`.
- `isActionAvailable()` and `getAvailableActions()` delegate to Core against the current snapshot.
