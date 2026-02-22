# @manifesto-ai/sdk v1.2.1

> Public developer API layer. Canonical entry point for Manifesto applications.

## Role

SDK owns the public contract for app creation and interaction.
It provides `createApp()`, `createTestApp()`, `ManifestoApp`, hooks, and typed patch ops while delegating orchestration to Runtime.

## Dependencies

- `@manifesto-ai/core`, `@manifesto-ai/runtime`, `@manifesto-ai/world`

## Public API

### `createApp(config): App`

```typescript
import { createApp } from '@manifesto-ai/sdk';

const app = createApp({
  schema: domainSchema,   // DomainSchema or MEL source string
  effects: {              // Effect handlers (required)
    'api.fetchUser': async (params, ctx) => {
      const data = await fetch(`/users/${params.id}`).then(r => r.json());
      return [{ op: 'set', path: 'user', value: data }];
    },
  },
  initialData: {},        // Optional initial state
});
```

### AppConfig (Full)

```typescript
interface AppConfig {
  readonly schema: DomainSchema | string;
  readonly effects: Effects;
  readonly world?: ManifestoWorld;
  readonly policyService?: PolicyService;
  readonly executionKeyPolicy?: ExecutionKeyPolicy;
  readonly memoryStore?: MemoryStore;
  readonly memoryProvider?: MemoryProvider;
  readonly memory?: false | MemoryHubConfig;
  readonly plugins?: readonly AppPlugin[];
  readonly hooks?: Partial<AppHooks>;
  readonly initialData?: unknown;
  readonly actorPolicy?: ActorPolicyConfig;
  readonly systemActions?: SystemActionsConfig;
  readonly validation?: { readonly effects?: 'strict' | 'warn' | 'off' };
}
```

### App Interface

```typescript
interface App {
  // Lifecycle
  status: 'created' | 'ready' | 'disposing' | 'disposed';
  ready(): Promise<void>;
  dispose(opts?): Promise<void>;

  // State
  getDomainSchema(): DomainSchema;
  getState<T>(): AppState<T>;
  subscribe<T>(selector, listener, opts?): Unsubscribe;

  // Actions (primary API)
  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;

  // Branching
  currentBranch(): Branch;
  fork(opts?): Promise<Branch>;
  switchBranch(branchId): Promise<Branch>;
  getHeads(): HeadMap;
  getLatestHead(): Head | null;

  // Sessions
  session(actorId, opts?): Session;

  // System
  system: SystemFacade;
  memory: MemoryFacade;
  hooks: Hookable<AppHooks>;
}
```

### `createTestApp(config): App`

Testing helper with in-memory defaults and minimal config.

```typescript
import { createTestApp } from '@manifesto-ai/sdk';

const app = createTestApp(schema, { effects: {} });
await app.ready();
```

### Effect Handler Signature (SDK-level)

```typescript
type EffectHandler = (
  params: unknown,
  ctx: { readonly snapshot: Readonly<Snapshot> }
) => Promise<readonly Patch[]>;
```

Note: SDK wraps this into the Host-level `(type, params, ctx)` signature internally.

### ActionHandle & ActionPhase

```typescript
const handle = app.act('addTodo', { title: 'Buy milk' });
const result = await handle.done();

type ActionPhase =
  | 'created' | 'preparing' | 'proposed' | 'evaluating'
  | 'approved' | 'executing' | 'completed' | 'rejected' | 'failed';
```

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

### Hook System

```typescript
const app = createApp({
  schema,
  effects: {},
  hooks: {
    'app:ready': (ctx) => { /* ... */ },
    'action:completed': (ctx, result) => {
      ctx.app.getState();                      // Read-only via AppRef
      ctx.app.enqueueAction('log', { result }); // Deferred execution
    },
  },
});
```

Inside hooks, `ctx.app` is an `AppRef` — a read-only facade preventing re-entrant mutations.

## Errors

Lifecycle: `AppNotReadyError`, `AppDisposedError`
Action: `ActionRejectedError`, `ActionFailedError`, `ActionTimeoutError`, `ActionNotFoundError`
Effects: `ReservedEffectTypeError`
Hook: `HookMutationError`
Branch: `BranchNotFoundError`, `WorldNotFoundError`, `WorldSchemaHashMismatchError`
