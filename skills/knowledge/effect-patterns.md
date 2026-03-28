# Effect Patterns

> Source: `packages/host/docs/host-SPEC.md`, `packages/sdk/src/types.ts`, `packages/sdk/src/create-manifesto.ts`
> Last synced: 2026-03-28

## Rules

> **R1**: Effect handlers return `Patch[]` and should not use exceptions as the business-logic result channel.
> **R2**: Failures should be expressed as state patches or terminal execution results.
> **R3**: Effect handlers are IO adapters, not policy engines.
> **R4**: Effects are declared by Core and executed by Host.
> **R5**: Handler patches should target domain-owned or platform-approved paths, not ad hoc hidden state.

## Handler Contract

Developers register effect handlers through the SDK:

```typescript
type EffectContext<T = unknown> = {
  readonly snapshot: Readonly<Snapshot<T>>;
};

type EffectHandler = (
  params: unknown,
  ctx: EffectContext,
) => Promise<readonly Patch[]>;
```

Host uses a different internal signature, but SDK adapts your handler automatically.

## Registration Pattern

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const app = createManifesto({
  schema: domainSchema,
  effects: {
    "api.fetchUser": fetchUser,
    "api.createTodo": createTodo,
    "payment.process": processPayment,
  },
});
```

Effect names must match effect types declared in schema or MEL.

## Patterns

### Successful effect

```typescript
async function fetchUser(params: { id: string }): Promise<Patch[]> {
  const response = await fetch(`/users/${params.id}`);
  const data = await response.json();
  return [
    { op: "set", path: "data.user.data", value: data },
    { op: "set", path: "data.user.error", value: null },
  ];
}
```

### Failed effect

```typescript
async function fetchUser(params: { id: string }): Promise<Patch[]> {
  try {
    const response = await fetch(`/users/${params.id}`);
    if (!response.ok) {
      return [
        { op: "set", path: "data.user.error", value: { code: response.status } },
        { op: "set", path: "data.user.data", value: null },
      ];
    }

    const data = await response.json();
    return [
      { op: "set", path: "data.user.data", value: data },
      { op: "set", path: "data.user.error", value: null },
    ];
  } catch (error) {
    return [
      {
        op: "set",
        path: "data.user.error",
        value: { message: error instanceof Error ? error.message : String(error) },
      },
      { op: "set", path: "data.user.data", value: null },
    ];
  }
}
```

## Built-in collection effects

Collection-oriented effects such as `array.filter`, `array.map`, and `record.keys` are platform/compiler features. This document is about custom domain handlers such as API, storage, or integration effects.

## Antipatterns

### Throwing as the primary failure channel

```typescript
// Avoid this for business logic failures
async function bad(params) {
  if (!params.id) throw new Error("Missing id");
  return [{ op: "set", path: "data.result", value: await api.call(params.id) }];
}

// Prefer patches
async function good(params) {
  if (!params.id) {
    return [{ op: "set", path: "data.error", value: "Missing id" }];
  }
  return [{ op: "set", path: "data.result", value: await api.call(params.id) }];
}
```

### Domain logic in handler

```typescript
// Avoid policy decisions here
async function purchaseHandler(params) {
  if (params.amount > 1000) {
    return [{ op: "set", path: "data.approval.required", value: true }];
  }
  return [];
}
```

Keep business rules in Core / Flow / MEL where they remain traceable.

### Returning raw values

```typescript
// Wrong: not a Patch[]
async function bad(params) {
  return api.fetchData(params.id);
}
```

## Requirement Lifecycle

When Core encounters an effect declaration:

1. Core emits a pending result with requirements in snapshot/system state.
2. Host executes the matching handler.
3. Host applies returned patches.
4. Host updates system state and re-enters compute.

The details differ between Core and Host internals, but the contract is the same: effect execution feeds back through snapshot changes, never hidden channels.

## Cross-References

- Patch operations: `@knowledge/patch-rules.md`
- State structure: `@knowledge/architecture.md`
- SDK package API: `@knowledge/packages/sdk.md`
