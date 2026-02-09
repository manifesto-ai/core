# Effect Handlers Guide

> **Covers:** Effect handler patterns, error handling, async operations
> **Purpose:** Writing robust, deterministic effect handlers
> **Prerequisites:** Understanding of Effects and App

---

## What Are Effect Handlers?

Effect handlers are functions that execute external operations declared by Core.

**Critical distinction:**
- **Core declares** effects (as data)
- **App executes** effects (via handlers)

```
Core: "I need effect 'api.fetch' with params {url: '/users'}"
       ↓
App: "Let me find the handler for 'api.fetch'"
       ↓
Handler: async (params, ctx) => { ... }
       ↓
Returns: Patch[]
```

---

## Handler Contract

Effect handlers MUST:

1. **Accept** `(params: unknown, ctx: AppEffectContext)`
2. **Return** `Promise<readonly Patch[]>` (never throw)
3. **Express errors as patches**, not exceptions

```typescript
type AppEffectContext = {
  readonly snapshot: Readonly<Snapshot>;
};

type EffectHandler = (
  params: unknown,
  ctx: AppEffectContext
) => Promise<readonly Patch[]>;
```

**Key differences from older versions:**
- Handler signature is `(params, ctx)` — 2 args, not 3
- Context contains ONLY `snapshot` (no `requirement`)
- Effect type is determined by the key in the `effects` record

---

## Registering Handlers

Effect handlers are registered at app creation time via `createApp()`.

**There is NO `app.registerEffect()` method.** All handlers must be provided when creating the app.

```typescript
import { createApp } from '@manifesto-ai/app';

const app = createApp({
  schema: domainSchema,
  effects: {
    'api.fetch': async (params, ctx) => {
      // Handler implementation
    },
    'api.save': async (params, ctx) => {
      // Handler implementation
    },
  },
});

await app.ready();
```

---

## Basic Pattern

```typescript
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.fetch': async (params, ctx) => {
      try {
        // 1. Execute IO
        const url = params.url as string;
        const response = await fetch(url);
        const data = await response.json();

        // 2. Return success patches
        return [
          { op: 'set', path: params.target as string, value: data },
          { op: 'set', path: 'status', value: 'success' }
        ];
      } catch (error) {
        // 3. Return error patches (NOT throw!)
        return [
          { op: 'set', path: 'status', value: 'error' },
          { op: 'set', path: 'errorMessage', value: error.message }
        ];
      }
    },
  },
});
```

**Key points:**
- No `throw` - all outcomes are patches
- Success writes result to Snapshot
- Failure writes error info to Snapshot
- Next `compute()` sees the result in Snapshot

---

## Common Effect Types

### 1. API GET Request

```typescript
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.get': async (params, ctx) => {
      const url = params.url as string;
      const target = params.target as string;

      try {
        const response = await fetch(url);

        if (!response.ok) {
          return [
            { op: 'set', path: 'error', value: `HTTP ${response.status}` }
          ];
        }

        const data = await response.json();
        return [
          { op: 'set', path: target, value: data },
          { op: 'unset', path: 'error' }
        ];
      } catch (error) {
        return [
          { op: 'set', path: 'error', value: error.message }
        ];
      }
    },
  },
});
```

### 2. API POST Request

```typescript
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.post': async (params, ctx) => {
      const url = params.url as string;
      const body = params.body;
      const target = params.target as string | undefined;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await response.json();

        const patches: Patch[] = [
          { op: 'set', path: 'lastPostStatus', value: response.status }
        ];

        if (target) {
          patches.push({ op: 'set', path: target, value: data });
        }

        return patches;
      } catch (error) {
        return [
          { op: 'set', path: 'error', value: error.message }
        ];
      }
    },
  },
});
```

### 3. Database Write

```typescript
const app = createApp({
  schema: domainSchema,
  effects: {
    'db.save': async (params, ctx) => {
      const table = params.table as string;
      const record = params.record as Record<string, unknown>;

      try {
        const savedRecord = await db.table(table).insert(record);

        return [
          {
            op: 'set',
            path: `${table}.${savedRecord.id}`,
            value: savedRecord
          },
          {
            op: 'set',
            path: `${table}.lastSaved`,
            value: Date.now()
          }
        ];
      } catch (error) {
        return [
          { op: 'set', path: 'dbError', value: error.message }
        ];
      }
    },
  },
});
```

### 4. Timer/Delay

```typescript
const app = createApp({
  schema: domainSchema,
  effects: {
    'timer.delay': async (params, ctx) => {
      const ms = params.ms as number;

      await new Promise(resolve => setTimeout(resolve, ms));

      return [
        { op: 'set', path: 'delayCompleted', value: true }
      ];
    },
  },
});
```

### 5. Logging

```typescript
const app = createApp({
  schema: domainSchema,
  effects: {
    'log.info': async (params, ctx) => {
      const message = params.message as string;
      const level = params.level as string || 'info';

      console.log(`[${level.toUpperCase()}]`, message);

      // Logging effects usually don't modify state
      return [];
    },
  },
});
```

---

## Advanced Patterns

### Pattern 1: Retry Logic

```typescript
function createRetryHandler(maxRetries: number, backoff: number) {
  return async (params: unknown, ctx: AppEffectContext) => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const url = params.url as string;
        const target = params.target as string;

        const response = await fetch(url);
        const data = await response.json();

        return [
          { op: 'set', path: target, value: data },
          { op: 'set', path: 'retryAttempts', value: attempt + 1 }
        ];
      } catch (error) {
        lastError = error as Error;

        // Wait before retry
        if (attempt < maxRetries - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, backoff * Math.pow(2, attempt))
          );
        }
      }
    }

    // All retries failed
    return [
      { op: 'set', path: 'error', value: lastError?.message },
      { op: 'set', path: 'retryAttempts', value: maxRetries }
    ];
  };
}

// Register
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.fetchWithRetry': createRetryHandler(3, 1000),
  },
});
```

### Pattern 2: Timeout Handling

```typescript
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.fetchWithTimeout': async (params, ctx) => {
      const url = params.url as string;
      const target = params.target as string;
      const timeoutMs = (params.timeout as number) || 10000;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json();

        clearTimeout(timeoutId);

        return [
          { op: 'set', path: target, value: data }
        ];
      } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          return [
            { op: 'set', path: 'error', value: 'Request timeout' }
          ];
        }

        return [
          { op: 'set', path: 'error', value: error.message }
        ];
      }
    },
  },
});
```

### Pattern 3: Cleanup on Failure

```typescript
const app = createApp({
  schema: domainSchema,
  effects: {
    'file.upload': async (params, ctx) => {
      let uploadId: string | undefined;

      try {
        // Step 1: Initialize upload
        const initResponse = await fetch('/api/upload/init', { method: 'POST' });
        uploadId = (await initResponse.json()).uploadId;

        // Step 2: Upload chunks
        await fetch(`/api/upload/${uploadId}/data`, {
          method: 'PUT',
          body: params.data
        });

        // Step 3: Finalize
        await fetch(`/api/upload/${uploadId}/finalize`, { method: 'POST' });

        return [
          { op: 'set', path: 'uploadResult', value: { uploadId } }
        ];
      } catch (error) {
        // Cleanup: delete partial upload
        if (uploadId) {
          await fetch(`/api/upload/${uploadId}`, { method: 'DELETE' })
            .catch(() => {}); // Ignore cleanup errors
        }

        return [
          { op: 'set', path: 'uploadError', value: error.message }
        ];
      }
    },
  },
});
```

### Pattern 4: Batching

```typescript
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.batchFetch': async (params, ctx) => {
      const urls = params.urls as string[];
      const targets = params.targets as string[];

      const results = await Promise.all(
        urls.map(url => fetch(url).then(r => r.json()))
      );

      const patches: Patch[] = results.map((result, index) => ({
        op: 'set',
        path: targets[index],
        value: result
      }));

      return patches;
    },
  },
});
```

### Pattern 5: Reading Current State

```typescript
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.saveCurrentState': async (params, ctx) => {
      // Read current state from snapshot
      const currentData = ctx.snapshot.data;

      try {
        await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentData)
        });

        return [
          { op: 'set', path: 'lastSyncedAt', value: Date.now() }
        ];
      } catch (error) {
        return [
          { op: 'set', path: 'syncError', value: error.message }
        ];
      }
    },
  },
});
```

---

## Anti-Patterns (What NOT to Do)

### Anti-Pattern 1: Throwing Exceptions

```typescript
// WRONG: Throwing
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.fetch': async (params, ctx) => {
      const response = await fetch(params.url);
      if (!response.ok) {
        throw new Error('API failed'); // WRONG!
      }
      return [{ op: 'set', path: 'result', value: await response.json() }];
    },
  },
});
```

**Why wrong:** Exceptions bypass error handling. App execution fails.

**Fix:** Return error patches.

```typescript
// RIGHT: Return error patches
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.fetch': async (params, ctx) => {
      try {
        const response = await fetch(params.url);
        if (!response.ok) {
          return [
            { op: 'set', path: 'error', value: `HTTP ${response.status}` }
          ];
        }
        return [
          { op: 'set', path: 'result', value: await response.json() }
        ];
      } catch (error) {
        return [
          { op: 'set', path: 'error', value: error.message }
        ];
      }
    },
  },
});
```

### Anti-Pattern 2: Domain Logic in Handlers

```typescript
// WRONG: Business rule in handler
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.createTodo': async (params, ctx) => {
      const { snapshot } = ctx;
      // Business rule!
      if (snapshot.data.todos.length >= 100) {
        return [
          { op: 'set', path: 'error', value: 'Too many todos' }
        ];
      }

      const result = await api.createTodo(params);
      return [{ op: 'set', path: 'newTodo', value: result }];
    },
  },
});
```

**Why wrong:** Domain logic must be traceable. If it's in the handler, Trace doesn't show it.

**Fix:** Domain logic in MEL, handler just does IO.

```mel
// RIGHT: Domain logic in MEL (traceable)
action createTodo(title: string) {
  when gte(len(todos), 100) {
    fail "TOO_MANY_TODOS"
  }
  when lt(len(todos), 100) {
    onceIntent {
      effect api.createTodo({ title: title, into: newTodo })
    }
  }
}
```

```typescript
// Handler just does IO
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.createTodo': async (params, ctx) => {
      const result = await api.createTodo(params.title);
      return [
        { op: 'set', path: 'newTodo', value: result }
      ];
    },
  },
});
```

### Anti-Pattern 3: Not Setting Guard State

```typescript
// WRONG: Missing guard state
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.init': async (params, ctx) => {
      const result = await api.init();
      return [
        { op: 'set', path: 'initResult', value: result }
        // Missing: set initialized flag!
      ];
    },
  },
});
```

**Why wrong:** Flow will re-declare effect on next compute, causing infinite loop.

**Fix:** Set guard state.

```typescript
// RIGHT: Set guard state
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.init': async (params, ctx) => {
      const result = await api.init();
      return [
        { op: 'set', path: 'initResult', value: result },
        { op: 'set', path: 'initialized', value: true } // Guard state!
      ];
    },
  },
});
```

### Anti-Pattern 4: Mutating Snapshot

```typescript
// WRONG: Mutating snapshot from context
const app = createApp({
  schema: domainSchema,
  effects: {
    'increment': async (params, ctx) => {
      const { snapshot } = ctx;
      snapshot.data.count++; // WRONG! Direct mutation
      return [];
    },
  },
});
```

**Why wrong:** Snapshot is immutable. Mutations are lost or cause bugs.

**Fix:** Return patches.

```typescript
// RIGHT: Return patches
const app = createApp({
  schema: domainSchema,
  effects: {
    'increment': async (params, ctx) => {
      const { snapshot } = ctx;
      return [
        { op: 'set', path: 'count', value: snapshot.data.count + 1 }
      ];
    },
  },
});
```

### Anti-Pattern 5: Returning Non-Serializable Values

```typescript
// WRONG: Returning function
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.fetch': async (params, ctx) => {
      const result = await api.fetch();
      return [
        {
          op: 'set',
          path: 'result',
          value: {
            data: result.data,
            refresh: () => api.fetch() // Function! Not serializable!
          }
        }
      ];
    },
  },
});
```

**Why wrong:** Snapshot must be JSON-serializable. Functions, Dates, etc. break serialization.

**Fix:** Only return serializable data.

```typescript
// RIGHT: Only serializable data
const app = createApp({
  schema: domainSchema,
  effects: {
    'api.fetch': async (params, ctx) => {
      const result = await api.fetch();
      return [
        {
          op: 'set',
          path: 'result',
          value: {
            data: result.data,
            fetchedAt: Date.now() // Number, not Date object
          }
        }
      ];
    },
  },
});
```

---

## Testing Effect Handlers

```typescript
import { describe, it, expect, vi } from "vitest";
import { createApp } from "@manifesto-ai/app";

describe("Effect handlers", () => {
  it("handles successful API call", async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "123", name: "Test" })
    });

    // Create app with handler
    const app = createApp({
      schema: domainSchema,
      effects: {
        'api.get': async (params, ctx) => {
          const response = await fetch(params.url);
          const data = await response.json();
          return [{ op: 'set', path: params.target, value: data }];
        },
      },
    });

    await app.ready();

    // Trigger action that declares api.get effect
    await app.act('fetchUser', { url: '/api/users/123' }).done();

    expect(app.getState().data.user).toEqual({ id: "123", name: "Test" });
  });

  it("handles API error", async () => {
    // Mock fetch error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const app = createApp({
      schema: domainSchema,
      effects: {
        'api.get': async (params, ctx) => {
          try {
            const response = await fetch(params.url);
            const data = await response.json();
            return [{ op: 'set', path: params.target, value: data }];
          } catch (error) {
            return [{ op: 'set', path: 'error', value: error.message }];
          }
        },
      },
    });

    await app.ready();

    await app.act('fetchUser', { url: '/api/users/123' }).result();

    expect(app.getState().data.error).toBe('Network error');
  });

  it("never throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Fatal error'));

    const app = createApp({
      schema: domainSchema,
      effects: {
        'api.get': async (params, ctx) => {
          try {
            const response = await fetch(params.url);
            return [{ op: 'set', path: 'result', value: response }];
          } catch (error) {
            return [{ op: 'set', path: 'error', value: error.message }];
          }
        },
      },
    });

    await app.ready();

    // Effect handler catches error and returns patches — no throw
    await app.act('fetchUser', { url: '/api/fail' }).result();

    expect(app.getState().data.error).toBe('Fatal error');
  });
});
```

---

## Checklist: Is My Handler Correct?

- [ ] Accepts `(params, ctx)`
- [ ] Returns `Promise<readonly Patch[]>`
- [ ] Never throws (all errors as patches)
- [ ] No domain logic (only IO)
- [ ] Sets guard state for re-entry safety
- [ ] Returns only JSON-serializable values
- [ ] Does not mutate snapshot from context
- [ ] Handles success and error cases
- [ ] Has tests for both success and error

---

## Related Concepts

- **Effect** - External operation declared by Flow
- **App** - Orchestrates effect execution via handlers
- **Patch** - What handlers return
- **Re-entry Safety** - Why guard state matters

---

## See Also

- [Effect Concept](/concepts/effect) - Understanding effects
- [App API](/api/app) - How App works
- [Re-entry Safe Flows](./reentry-safe-flows) - Guard patterns
- [Specifications](/internals/spec/) - Normative contracts for App and other packages
