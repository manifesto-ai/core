# @manifesto-ai/sdk v1.0.0

> Public developer API layer. Canonical entry point for Manifesto applications.

## Role

SDK owns the public contract for creating and interacting with Manifesto instances.
It provides `createManifesto()`, `ManifestoInstance`, and typed patch ops while directly orchestrating Host, World, and Compiler internally.

## Dependencies

- `@manifesto-ai/core`, `@manifesto-ai/host`, `@manifesto-ai/world`, `@manifesto-ai/compiler`

## Public API

### `createManifesto(config): ManifestoInstance`

```typescript
import { createManifesto } from '@manifesto-ai/sdk';

const instance = createManifesto({
  schema: domainSchema,   // DomainSchema or MEL source string
  effects: {              // Effect handlers (required)
    'api.fetchUser': async (params, ctx) => {
      const data = await fetch(`/users/${params.id}`).then(r => r.json());
      return [{ op: 'set', path: 'user', value: data }];
    },
  },
});
```

### ManifestoConfig

```typescript
interface ManifestoConfig {
  readonly schema: DomainSchema | string;
  readonly effects: Record<string, EffectHandler>;
  readonly store?: WorldStore;
  readonly guard?: (intent: Intent, snapshot: Snapshot) => boolean;
  readonly snapshot?: Snapshot;
}
```

### ManifestoInstance (5 methods)

```typescript
interface ManifestoInstance {
  dispatch(intent: Intent): void;
  subscribe<R>(selector: Selector<R>, listener: (value: R) => void): Unsubscribe;
  on(event: ManifestoEvent, handler: (payload: ManifestoEventPayload) => void): Unsubscribe;
  getSnapshot(): Snapshot;
  dispose(): void;
}
```

### Effect Handler Signature (SDK-level)

```typescript
type EffectHandler = (
  params: unknown,
  ctx: { readonly snapshot: Readonly<Snapshot> }
) => Promise<readonly Patch[]>;
```

Note: SDK wraps this into the Host-level `(type, params, ctx)` signature internally.

### Typed Patch Operations (defineOps)

```typescript
import { defineOps } from '@manifesto-ai/sdk';

type State = { count: number; user: { name: string; age: number } };
const ops = defineOps<State>();

ops.set('count', 5);            // OK — path autocompletes, value: number
ops.set('user.name', 'Alice');  // OK — nested path, value: string
ops.merge('user', { age: 30 }); // OK — partial object merge
ops.unset('count');              // OK

ops.set('count', 'wrong');      // TS Error — expected number
ops.set('counnt', 5);           // TS Error — path does not exist
```

### Events

```typescript
type ManifestoEvent = 'dispatch:completed' | 'dispatch:rejected' | 'dispatch:failed';
```

## Errors

- `ManifestoError` — base error class
- `ReservedEffectError` — conflict with reserved effect types (e.g. `system.get`)
- `DisposedError` — operation attempted after dispose()
