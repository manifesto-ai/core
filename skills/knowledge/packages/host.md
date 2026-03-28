# @manifesto-ai/host

> Effect execution runtime. Implements Mailbox + Runner + Job architecture.

## Role

Host executes effects, applies patches, orchestrates the compute loop, and fulfills requirements. It must not compute semantic meaning or make governance decisions.

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

### `ManifestoHost`

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

## Effect handler contract

```typescript
type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: EffectContext,
) => Promise<Patch[]>;
```

SDK wraps this Host-level contract into the simpler `(params, ctx)` developer-facing signature.

## Execution Model

- **Mailbox**: FIFO queue of jobs per execution key
- **Runner**: single-writer execution loop
- **Jobs**: `StartIntent`, `ContinueCompute`, `FulfillEffect`, `ApplyPatches`

## Common exports

- mailbox helpers
- runner helpers
- context provider helpers
- job handlers
- effect registry and executor
- Host error helpers

## Notes

- Host is the execution seam between Core and the outside world.
- `@manifesto-ai/world` defines a `HostExecutor` boundary so World does not import Host directly.
