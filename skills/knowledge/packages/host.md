# @manifesto-ai/host v2.3.0

> Effect execution runtime. Implements Mailbox + Runner + Job architecture.

## Role

Host executes effects, applies patches, orchestrates compute loop. MUST NOT make decisions or interpret semantics.

## Dependencies

- Peer: `@manifesto-ai/core` ^2.0.0

## Public API

### `createHost(schema, effectHandlers, options?): ManifestoHost`

```typescript
const host = createHost(schema, effectHandlers, {
  maxIterations: 100,
  initialData: {},
  runtime: defaultRuntime,
  env: {},
  onTrace: (event) => {},
  disableAutoEffect: false,
});
```

### ManifestoHost (class)

```typescript
class ManifestoHost {
  dispatch(intent: Intent): Promise<HostResult>;
  registerEffect(type, handler, options?): void;
  unregisterEffect(type): boolean;
  hasEffect(type): boolean;
  getEffectTypes(): string[];
  getSnapshot(): Snapshot | null;
  getSchema(): DomainSchema;
  getCore(): ManifestoCore;
  validateSchema(): ValidateResult;
  reset(initialData): void;
}
```

### HostOptions

```typescript
interface HostOptions {
  maxIterations?: number;      // Default: 100
  initialData?: unknown;
  runtime?: Runtime;
  env?: Record<string, unknown>;
  onTrace?: (event: TraceEvent) => void;
  disableAutoEffect?: boolean; // HCTS testing
}
```

### HostResult

```typescript
interface HostResult {
  status: 'complete' | 'pending' | 'error';
  snapshot: Snapshot;
  traces: TraceGraph[];
  error?: HostError;
}
```

## Effect Handler (Host-level)

```typescript
type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
) => Promise<Patch[]>;
```

Note: App wraps this into `(params, ctx)` signature for developer convenience.

Handlers MUST return `Patch[]`, MUST NOT throw, MUST NOT contain domain logic.

## Execution Model

### Architecture

- **Mailbox** → FIFO queue of Jobs per ExecutionKey
- **Runner** → Single-writer per key, lost-wakeup prevention
- **Jobs** → `StartIntent` | `ContinueCompute` | `FulfillEffect` | `ApplyPatches`

### Mailbox & Runner Functions

```typescript
createMailbox(): ExecutionMailbox
createMailboxManager(): MailboxManager
createRunnerState(): RunnerState
processMailbox(mailbox, runner, handler): Promise<void>
kickRunner(mailbox, runner, handler): void
enqueueAndKick(mailbox, runner, job, handler): void
isRunnerActive(runner): boolean
```

### Effect Registry & Executor

```typescript
createEffectRegistry(): EffectHandlerRegistry
createEffectExecutor(registry, options?): EffectExecutor
```

### Job Handlers

```typescript
runJob(job, context): Promise<void>
handleStartIntent(job, context): Promise<void>
handleContinueCompute(job, context): Promise<void>
handleFulfillEffect(job, context): Promise<void>
handleApplyPatches(job, context): Promise<void>
```

### Host Context

```typescript
createHostContextProvider(options): HostContextProvider
createTestHostContextProvider(): HostContextProvider    // For testing
```

## Execution Flow

```
dispatch(intent)
  → enqueue StartIntentJob
  → Runner processes: compute → requirements? → dispatch effects
  → effect results → FulfillEffectJob → apply patches → ContinueComputeJob
  → repeat until requirements=[] or maxIterations
```

## Trace Events

`runner:kick`, `runner:start`, `runner:end`, `job:start`, `job:end`, `core:compute`, `core:apply`, `effect:dispatch`, `effect:fulfill:apply`, `effect:fulfill:drop`, `fatal:escalate`

## Error Codes

`UNKNOWN_EFFECT_TYPE`, `EFFECT_TIMEOUT`, `EFFECT_EXECUTION_FAILED`, `EFFECT_HANDLER_ERROR`, `STORE_ERROR`, `LOOP_MAX_ITERATIONS`, `INVALID_STATE`, `HOST_NOT_INITIALIZED`
