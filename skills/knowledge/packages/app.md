# @manifesto-ai/app v2.3.0

> Facade and orchestration layer. Composition root over Core + Host + World.

## Role

App wires everything together. Provides developer-facing API. MUST NOT contain domain logic.

## Dependencies

- `@manifesto-ai/core`, `@manifesto-ai/compiler`, `@manifesto-ai/host`, `@manifesto-ai/world`

## Public API

### `createApp(config): App`

```typescript
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
  schema: DomainSchema | string;                  // Required
  effects: Record<string, EffectHandler>;          // Required
  initialData?: unknown;
  world?: ManifestoWorld;
  policyService?: PolicyService;
  memory?: MemoryConfig;
  plugins?: AppPlugin[];
  hooks?: Partial<AppHooks>;
  validation?: { effects?: 'strict' | 'warn' | 'off' };
  actorPolicy?: { mode: 'anonymous' | 'require'; defaultActor?: ActorConfig };
  scheduler?: { maxConcurrent?; defaultTimeoutMs?; singleWriterPerBranch? };
  systemActions?: SystemActionsConfig;
  devtools?: DevtoolsConfig;
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

### Effect Handler Signature (App-level)

```typescript
type EffectHandler = (
  params: unknown,
  ctx: { readonly snapshot: Readonly<Snapshot> }
) => Promise<readonly Patch[]>;
```

Note: App wraps this into the Host-level `(type, params, ctx)` signature internally.

### ActOptions

```typescript
interface ActOptions {
  actorId?: string;
  branchId?: string;
  recall?: false | RecallRequest[];
  trace?: { enabled?: boolean; level?: 'minimal' | 'standard' | 'verbose' };
}
```

### ActionHandle & ActionPhase

```typescript
const handle = app.act('addTodo', { title: 'Buy milk' });
const result = await handle.done();

type ActionPhase =
  | 'created' | 'preparing' | 'proposed' | 'evaluating'
  | 'approved' | 'executing' | 'completed' | 'rejected' | 'failed';
```

### Memory & Policy

```typescript
// Memory
createMemoryHub(config): MemoryHub
freezeMemoryContext(snapshot): MemoryContext
getMemoryContext(snapshot): MemoryContext | undefined

// Policy
createDefaultPolicyService(): DefaultPolicyService
createSilentPolicyService(): PolicyService     // Suppresses warnings
createStrictPolicyService(): PolicyService     // Errors on all violations
validateProposalScope(proposal, scope): ValidationResult
```

### Schema Utilities

```typescript
withPlatformNamespaces(schema): DomainSchema   // Adds $host, $mel namespaces
validateSchemaCompatibility(oldSchema, newSchema): CompatibilityResult
validateSchemaCompatibilityWithEffects(schema, effects): ValidationResult
extractEffectTypes(schema): string[]
```

## Errors

Lifecycle: `AppNotReadyError`, `AppDisposedError`
Action: `ActionRejectedError`, `ActionFailedError`, `ActionPreparationError`, `ActionTimeoutError`
Effects: `ReservedEffectTypeError`
Branch: `BranchNotFoundError`, `WorldNotFoundError`, `WorldSchemaHashMismatchError`, `SchemaMismatchOnResumeError`
