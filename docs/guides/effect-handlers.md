# Effect Handlers Guide

> **Covers:** Effect handler patterns, error handling, async operations
> **Purpose:** Writing robust, deterministic effect handlers
> **Prerequisites:** Understanding of Effects and Host

---

## What Are Effect Handlers?

Effect handlers are functions that Host uses to execute external operations declared by Core.

**Critical distinction:**
- **Core declares** effects (as data)
- **Host executes** effects (via handlers)

```
Core: "I need effect 'api.fetch' with params {url: '/users'}"
       ↓
Host: "Let me find the handler for 'api.fetch'"
       ↓
Handler: async (type, params) => { ... }
       ↓
Returns: Patch[]
```

---

## Handler Contract

Effect handlers MUST:

1. **Accept** `(type: string, params: Record<string, unknown>, snapshot: Snapshot)`
2. **Return** `Promise<Patch[]>` (never throw)
3. **Express errors as patches**, not exceptions

```typescript
type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  snapshot: Snapshot
) => Promise<Patch[]>;
```

---

## Basic Pattern

```typescript
// Register handler
host.registerEffect('api.fetch', async (type, params, snapshot) => {
  try {
    // 1. Execute IO
    const response = await fetch(params.url as string);
    const data = await response.json();

    // 2. Return success patches
    return [
      { op: 'set', path: params.target as string, value: data },
      { op: 'set', path: 'data.status', value: 'success' }
    ];
  } catch (error) {
    // 3. Return error patches (NOT throw!)
    return [
      { op: 'set', path: 'data.status', value: 'error' },
      { op: 'set', path: 'data.errorMessage', value: error.message }
    ];
  }
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
host.registerEffect('api.get', async (type, params) => {
  const url = params.url as string;
  const target = params.target as string;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return [
        { op: 'set', path: 'data.error', value: `HTTP ${response.status}` }
      ];
    }

    const data = await response.json();
    return [
      { op: 'set', path: target, value: data },
      { op: 'unset', path: 'data.error' }
    ];
  } catch (error) {
    return [
      { op: 'set', path: 'data.error', value: error.message }
    ];
  }
});
```

### 2. API POST Request

```typescript
host.registerEffect('api.post', async (type, params) => {
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
      { op: 'set', path: 'data.lastPostStatus', value: response.status }
    ];

    if (target) {
      patches.push({ op: 'set', path: target, value: data });
    }

    return patches;
  } catch (error) {
    return [
      { op: 'set', path: 'data.error', value: error.message }
    ];
  }
});
```

### 3. Database Write

```typescript
host.registerEffect('db.save', async (type, params, snapshot) => {
  const table = params.table as string;
  const record = params.record as Record<string, unknown>;

  try {
    const savedRecord = await db.table(table).insert(record);

    return [
      {
        op: 'set',
        path: `data.${table}.${savedRecord.id}`,
        value: savedRecord
      },
      {
        op: 'set',
        path: `data.${table}.lastSaved`,
        value: Date.now()
      }
    ];
  } catch (error) {
    return [
      { op: 'set', path: 'data.dbError', value: error.message }
    ];
  }
});
```

### 4. Timer/Delay

```typescript
host.registerEffect('timer.delay', async (type, params) => {
  const ms = params.ms as number;

  await new Promise(resolve => setTimeout(resolve, ms));

  return [
    { op: 'set', path: 'data.delayCompleted', value: true }
  ];
});
```

### 5. Logging

```typescript
host.registerEffect('log.info', async (type, params) => {
  const message = params.message as string;
  const level = params.level as string || 'info';

  console.log(`[${level.toUpperCase()}]`, message);

  // Logging effects usually don't modify state
  return [];
});
```

---

## Advanced Patterns

### Pattern 1: Retry Logic

```typescript
async function retryHandler(
  maxRetries: number,
  backoff: number
) {
  return async (type: string, params: Record<string, unknown>) => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(params.url as string);
        const data = await response.json();

        return [
          { op: 'set', path: params.target as string, value: data },
          { op: 'set', path: 'data.retryAttempts', value: attempt + 1 }
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
      { op: 'set', path: 'data.error', value: lastError?.message },
      { op: 'set', path: 'data.retryAttempts', value: maxRetries }
    ];
  };
}

// Register
host.registerEffect('api.fetchWithRetry', retryHandler(3, 1000));
```

### Pattern 2: Timeout Handling

```typescript
host.registerEffect('api.fetchWithTimeout', async (type, params) => {
  const url = params.url as string;
  const timeoutMs = (params.timeout as number) || 10000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json();

    clearTimeout(timeoutId);

    return [
      { op: 'set', path: params.target as string, value: data }
    ];
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      return [
        { op: 'set', path: 'data.error', value: 'Request timeout' }
      ];
    }

    return [
      { op: 'set', path: 'data.error', value: error.message }
    ];
  }
});
```

### Pattern 3: Cleanup on Failure

```typescript
host.registerEffect('file.upload', async (type, params, snapshot) => {
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
      { op: 'set', path: 'data.uploadResult', value: { uploadId } }
    ];
  } catch (error) {
    // Cleanup: delete partial upload
    if (uploadId) {
      await fetch(`/api/upload/${uploadId}`, { method: 'DELETE' })
        .catch(() => {}); // Ignore cleanup errors
    }

    return [
      { op: 'set', path: 'data.uploadError', value: error.message }
    ];
  }
});
```

### Pattern 4: Batching

```typescript
// Batch multiple API calls into one
host.registerEffect('api.batchFetch', async (type, params) => {
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
});
```

---

## Anti-Patterns (What NOT to Do)

### Anti-Pattern 1: Throwing Exceptions

```typescript
// WRONG: Throwing
host.registerEffect('api.fetch', async (type, params) => {
  const response = await fetch(params.url);
  if (!response.ok) {
    throw new Error('API failed'); // WRONG!
  }
  return [{ op: 'set', path: 'data.result', value: await response.json() }];
});
```

**Why wrong:** Exceptions bypass error handling. Host crashes.

**Fix:** Return error patches.

```typescript
// RIGHT: Return error patches
host.registerEffect('api.fetch', async (type, params) => {
  try {
    const response = await fetch(params.url);
    if (!response.ok) {
      return [
        { op: 'set', path: 'data.error', value: `HTTP ${response.status}` }
      ];
    }
    return [
      { op: 'set', path: 'data.result', value: await response.json() }
    ];
  } catch (error) {
    return [
      { op: 'set', path: 'data.error', value: error.message }
    ];
  }
});
```

### Anti-Pattern 2: Domain Logic in Handlers

```typescript
// WRONG: Business rule in handler
host.registerEffect('api.createTodo', async (type, params, snapshot) => {
  // Business rule!
  if (snapshot.data.todos.length >= 100) {
    return [
      { op: 'set', path: 'data.error', value: 'Too many todos' }
    ];
  }

  const result = await api.createTodo(params);
  return [{ op: 'set', path: 'data.newTodo', value: result }];
});
```

**Why wrong:** Domain logic must be traceable. If it's in the handler, Trace doesn't show it.

**Fix:** Domain logic in Flow, handler just does IO.

```typescript
// RIGHT: Domain logic in Flow
flow.seq(
  // Business rule in Flow (traceable)
  flow.if(
    expr.gte(expr.len(state.todos), 100),
    flow.fail('TOO_MANY_TODOS'),
    flow.seq(
      // Only IO in effect
      flow.effect('api.createTodo', { title: expr.input('title') })
    )
  )
)

// Handler just does IO
host.registerEffect('api.createTodo', async (type, params) => {
  const result = await api.createTodo(params.title);
  return [
    { op: 'set', path: 'data.newTodo', value: result }
  ];
});
```

### Anti-Pattern 3: Not Setting Guard State

```typescript
// WRONG: Missing guard state
host.registerEffect('api.init', async (type, params) => {
  const result = await api.init();
  return [
    { op: 'set', path: 'data.initResult', value: result }
    // Missing: set initialized flag!
  ];
});
```

**Why wrong:** Flow will re-declare effect on next compute, causing infinite loop.

**Fix:** Set guard state.

```typescript
// RIGHT: Set guard state
host.registerEffect('api.init', async (type, params) => {
  const result = await api.init();
  return [
    { op: 'set', path: 'data.initResult', value: result },
    { op: 'set', path: 'data.initialized', value: true } // Guard state!
  ];
});
```

### Anti-Pattern 4: Mutating Snapshot

```typescript
// WRONG: Mutating snapshot parameter
host.registerEffect('increment', async (type, params, snapshot) => {
  snapshot.data.count++; // WRONG! Direct mutation
  return [];
});
```

**Why wrong:** Snapshot is immutable. Mutations are lost or cause bugs.

**Fix:** Return patches.

```typescript
// RIGHT: Return patches
host.registerEffect('increment', async (type, params, snapshot) => {
  return [
    { op: 'set', path: 'data.count', value: snapshot.data.count + 1 }
  ];
});
```

### Anti-Pattern 5: Returning Non-Serializable Values

```typescript
// WRONG: Returning function
host.registerEffect('api.fetch', async (type, params) => {
  const result = await api.fetch();
  return [
    {
      op: 'set',
      path: 'data.result',
      value: {
        data: result.data,
        refresh: () => api.fetch() // Function! Not serializable!
      }
    }
  ];
});
```

**Why wrong:** Snapshot must be JSON-serializable. Functions, Dates, etc. break serialization.

**Fix:** Only return serializable data.

```typescript
// RIGHT: Only serializable data
host.registerEffect('api.fetch', async (type, params) => {
  const result = await api.fetch();
  return [
    {
      op: 'set',
      path: 'data.result',
      value: {
        data: result.data,
        fetchedAt: Date.now() // Number, not Date object
      }
    }
  ];
});
```

---

## Testing Effect Handlers

```typescript
import { describe, it, expect, vi } from "vitest";

describe("Effect handlers", () => {
  it("handles successful API call", async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "123", name: "Test" })
    });

    // Create handler
    const handler = async (type, params) => {
      const response = await fetch(params.url);
      const data = await response.json();
      return [{ op: 'set', path: params.target, value: data }];
    };

    // Test
    const result = await handler('api.get', {
      url: '/api/users/123',
      target: 'data.user'
    });

    expect(result).toEqual([
      {
        op: 'set',
        path: 'data.user',
        value: { id: "123", name: "Test" }
      }
    ]);
  });

  it("handles API error", async () => {
    // Mock fetch error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const handler = async (type, params) => {
      try {
        const response = await fetch(params.url);
        const data = await response.json();
        return [{ op: 'set', path: params.target, value: data }];
      } catch (error) {
        return [{ op: 'set', path: 'data.error', value: error.message }];
      }
    };

    const result = await handler('api.get', {
      url: '/api/users/123',
      target: 'data.user'
    });

    expect(result).toEqual([
      { op: 'set', path: 'data.error', value: 'Network error' }
    ]);
  });

  it("never throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Fatal error'));

    const handler = async (type, params) => {
      try {
        const response = await fetch(params.url);
        return [{ op: 'set', path: 'data.result', value: response }];
      } catch (error) {
        return [{ op: 'set', path: 'data.error', value: error.message }];
      }
    };

    // Should not throw
    await expect(
      handler('api.get', { url: '/api/fail' })
    ).resolves.toBeDefined();
  });
});
```

---

## Checklist: Is My Handler Correct?

- [ ] Accepts `(type, params, snapshot)`
- [ ] Returns `Promise<Patch[]>`
- [ ] Never throws (all errors as patches)
- [ ] No domain logic (only IO)
- [ ] Sets guard state for re-entry safety
- [ ] Returns only JSON-serializable values
- [ ] Does not mutate snapshot parameter
- [ ] Handles success and error cases
- [ ] Has tests for both success and error

---

## Related Concepts

- **Effect** - External operation declared by Flow
- **Host** - Executes effect handlers
- **Patch** - What handlers return
- **Re-entry Safety** - Why guard state matters

---

## See Also

- [Effect Concept](/core-concepts/effect) - Understanding effects
- [Host Concept](/core-concepts/host) - How Host works
- [Re-entry Safe Flows](./reentry-safe-flows) - Guard patterns
- [Host Contract](/specifications/host-contract) - Normative contract
