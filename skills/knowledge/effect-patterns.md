# Effect Patterns

> Source: Host SPEC v2.0.2 §7, App SPEC v2.3.0 §8, Core FDR v2.0.0
> Last synced: 2026-02-09

## Rules

> **R1**: Effect handlers MUST return `Patch[]` and MUST NOT throw exceptions. [HANDLER-1, HANDLER-2]
> **R2**: Failures MUST be expressed as patches to state (error values in Snapshot). [HANDLER-3]
> **R3**: Effect handlers MUST NOT contain domain logic. They are pure IO adapters. [HANDLER-4, HANDLER-5]
> **R4**: Effects are declared by Core, executed by Host. Core never performs IO. [FDR-004]
> **R5**: Host-generated error patches MUST target `$host` or domain-owned paths, NOT `system.*`. [INV-SNAP-4]

## Handler Contract

Developers register effect handlers through the **App layer** API:

```typescript
// App-layer handler signature (what you write)
type EffectHandler = (
  params: unknown,
  ctx: AppEffectContext
) => Promise<readonly Patch[]>;

type Patch = {
  op: 'set' | 'unset' | 'merge';
  path: string;
  value?: unknown;
};
```

Note: The Host layer internally uses a different signature `(type, params, context)` but App wraps this. Handlers receive effect params, perform IO, and return patches.

## Patterns

### Successful Effect

```typescript
async function fetchUser(params: { id: string }): Promise<Patch[]> {
  const response = await fetch(`/users/${params.id}`);
  const data = await response.json();
  return [
    { op: 'set', path: 'data.user', value: data },
    { op: 'set', path: 'data.user.error', value: null }
  ];
}
```

### Failed Effect (Errors as Patches)

```typescript
async function fetchUser(params: { id: string }): Promise<Patch[]> {
  try {
    const response = await fetch(`/users/${params.id}`);
    if (!response.ok) {
      return [
        { op: 'set', path: 'data.user.error', value: { code: response.status } },
        { op: 'set', path: 'data.user.data', value: null }
      ];
    }
    const data = await response.json();
    return [
      { op: 'set', path: 'data.user.data', value: data },
      { op: 'set', path: 'data.user.error', value: null }
    ];
  } catch (error) {
    return [
      { op: 'set', path: 'data.user.error', value: { message: error.message } },
      { op: 'set', path: 'data.user.data', value: null }
    ];
  }
}
```

### Effect Registration (App Layer)

```typescript
import { createApp } from '@manifesto-ai/app';

const app = createApp({
  schema: domainSchema,
  effects: {
    'api.fetchUser': fetchUser,
    'api.createTodo': createTodo,
    'payment.process': processPayment,
  },
});
```

Effect names in handlers must match effect type names declared in MEL.

### Collection Effect Handlers

Collection effects (`array.filter`, `array.map`, `record.keys`, etc.) are built-in — you do NOT write handlers for these. They are handled by Core/Host internally.

You only write handlers for custom domain effects (API calls, storage, etc.).

## Antipatterns

### Throwing Handler

```typescript
// FORBIDDEN
async function bad(params) {
  if (!params.id) throw new Error('Missing id');  // Don't throw!
  const result = await api.call(params.id);
  return [{ op: 'set', path: 'data.result', value: result }];
}

// CORRECT
async function good(params) {
  if (!params.id) {
    return [{ op: 'set', path: 'data.error', value: 'Missing id' }];
  }
  const result = await api.call(params.id);
  return [{ op: 'set', path: 'data.result', value: result }];
}
```

### Domain Logic in Handler

```typescript
// FORBIDDEN — Business rule in handler
async function purchaseHandler(params) {
  if (params.amount > 1000) {  // Domain decision!
    return [{ op: 'set', path: 'data.approval.required', value: true }];
  }
  // ...
}

// CORRECT — Handler does IO only, domain logic stays in Flow/MEL
async function paymentHandler(params) {
  const result = await paymentGateway.charge(params.amount);
  return [{ op: 'set', path: 'data.payment.status', value: result.status }];
}
```

### Returning Raw Values

```typescript
// FORBIDDEN — Returns value, not patches
async function bad(params) {
  return await api.fetchData(params.id);  // Returns data directly!
}

// CORRECT — Returns patches
async function good(params) {
  const data = await api.fetchData(params.id);
  return [{ op: 'set', path: 'data.result', value: data }];
}
```

### Writing to system.*

```typescript
// FORBIDDEN — Handler must not write system namespace
return [{ op: 'set', path: 'system.lastError', value: { ... } }];

// CORRECT — Write to $host or domain paths
return [{ op: 'set', path: 'data.fetchError', value: { ... } }];
```

## Requirement Lifecycle

When Core encounters an effect declaration:
1. Core records a Requirement in `system.pendingRequirements`
2. Core terminates and returns to Host
3. Host executes the effect handler
4. Host applies result patches to Snapshot
5. Host MUST clear the requirement from `pendingRequirements`
6. Host calls `compute()` again

**Critical**: Requirement MUST be cleared even if handler fails. Leaving it pending causes infinite loops.

## Why

**Patches as protocol**: Decouples effect execution from Core. Host can serialize, batch, retry, or substitute effects without Core knowing.

**Errors as values**: Same inputs (including failures) always produce same snapshot state. Enables deterministic replay.

**No domain logic**: Keeps all business decisions in Flow/MEL where they are traceable and deterministic.

## Cross-References

- Patch operations: @knowledge/patch-rules.md
- State structure: @knowledge/architecture.md
- MEL effect declarations: @knowledge/mel-patterns.md
