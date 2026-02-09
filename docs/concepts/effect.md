# Effect

> A declaration of an external operation for Host to execute.

## What is Effect?

Effect is a declaration that some external operation (API call, database write, file access) needs to happen. Effects are NOT executed by Core. Core declares requirements; Host fulfills them.

When Core encounters an effect node in a Flow, it records a Requirement in `snapshot.system.pendingRequirements` and returns with `status: 'pending'`. Host then executes the effect, applies the resulting patches, and calls `compute()` again.

This separation keeps Core pure (no IO) while enabling real-world interactions through Host.

## Structure

### In Flow

```typescript
type EffectNode = {
  readonly kind: 'effect';
  readonly type: string;                      // Handler identifier
  readonly params: Record<string, ExprNode>;  // Parameters
};
```

### As Requirement

```typescript
type Requirement = {
  readonly id: string;
  readonly type: string;
  readonly params: Record<string, unknown>;  // Resolved values
  readonly actionId: string;
  readonly flowPosition: FlowPosition;
  readonly createdAt: number;
};
```

## Key Properties

- **Declarative**: Effects describe what, not how.
- **Non-blocking**: Core stops at effects; Host handles execution.
- **Patchable results**: Effect handlers return patches, not values.
- **Never throw**: Errors are expressed as patches to Snapshot.

## Example

### Declaring an Effect (MEL)

```mel
action fetchUser(userId: string) {
  onceIntent {
    patch loading = true
    effect api.fetchUser({ userId: userId, into: user })
  }
}
```

### Handling an Effect (App)

```typescript
const app = createApp({
  schema: domainSchema,
  effects: {
    'api:fetchUser': async (params, ctx) => {
      try {
        const response = await fetch(`/api/users/${params.userId}`);
        const user = await response.json();

        return [
          { op: 'set', path: 'data.user', value: user },
          { op: 'set', path: 'data.loading', value: false }
        ];
      } catch (error) {
        return [
          { op: 'set', path: 'data.error', value: error.message },
          { op: 'set', path: 'data.loading', value: false }
        ];
      }
    },
  },
});
```

## Common Patterns

### Effect Handler Contract

```typescript
type EffectHandler = (
  params: unknown,
  ctx: AppEffectContext  // { snapshot: Readonly<Snapshot> }
) => Promise<readonly Patch[]>;

// ALWAYS return patches, NEVER throw
async function handler(params, ctx): Promise<Patch[]> {
  try {
    const result = await doSomething(params);
    return [{ op: 'set', path: 'result', value: result }];
  } catch (error) {
    return [{ op: 'set', path: 'error', value: error.message }];
  }
}
```

### Idempotent Handlers

```typescript
async function createUserHandler(params, ctx) {
  // Check if already exists
  const existing = await db.users.findOne({ id: params.id });
  if (existing) {
    return [{ op: 'set', path: `users.${params.id}`, value: existing }];
  }

  // Create new
  const user = await db.users.create(params);
  return [{ op: 'set', path: `users.${params.id}`, value: user }];
}
```

### Re-entry Safe Effect Usage

```mel
// WRONG: Effect runs every compute cycle
action submit() {
  effect api.submit({ data: form })
}

// RIGHT: Guard with onceIntent
action submit() {
  onceIntent {
    patch submittedAt = $meta.intentId
    effect api.submit({ data: form, into: submitResult })
  }
}
```

## Why Effects as Declarations?

| Alternative | Why Rejected |
|-------------|--------------|
| Direct execution in Core | Breaks purity |
| Injected handlers in Core | Couples Core to execution |
| Promise-based returns | Implies async in Core |

**Benefits of declarations:**
- Core remains pure and testable
- Host controls execution timing and batching
- Retry logic lives in Host, invisible to Core
- Effects can be mocked for testing

## See Also

- [Flow](./flow.md) - Where effects are declared
- [Snapshot](./snapshot.md) - Where effect results appear
- [World](./world.md) - Governance over effect execution
