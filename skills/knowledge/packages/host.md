# @manifesto-ai/host

> Effect execution runtime for Manifesto.

## Role

Host executes effects, applies patches and system transitions, orchestrates the compute loop, and fulfills requirements. It must not compute semantic meaning or make legitimacy decisions.

## Public API

### `createHost(schema, options?): ManifestoHost`

```typescript
const host = createHost(schema, {
  initialData: {},
});
```

### `ManifestoHost`

```typescript
class ManifestoHost {
  dispatch(intent: Intent): Promise<HostResult>;
  registerEffect(type, handler, options?): void;
  unregisterEffect(type): boolean;
  hasEffect(type): boolean;
  getSnapshot(): Snapshot | null;
  getSchema(): DomainSchema;
  getCore(): ManifestoCore;
  validateSchema(): ValidationResult;
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

SDK wraps this Host-level contract into the simpler developer-facing `(params, ctx)` signature.

## Execution model

- **Mailbox**: FIFO queue of jobs per execution key
- **Runner**: single-writer execution loop
- **Jobs**: `StartIntent`, `ContinueCompute`, `FulfillEffect`, `ApplyPatches`

## Notes

- Host is the execution seam between Core and the outside world.
- Host-facing Snapshot references follow the current Core v4 shape and no longer include accumulated `system.errors`.
- Governed composition builds on the SDK runtime chain above Host; Host itself does not know proposal or authority semantics.
- Current living contract is `packages/host/docs/host-SPEC.md`.
