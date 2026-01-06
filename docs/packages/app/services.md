# Service Handlers

> How to write effect handlers for side effects

Services are the bridge between your pure domain logic and the outside world. When your MEL domain declares an `effect`, a service handler executes it and returns patches to update the state.

---

## What Are Services?

In Manifesto, **effects are declared, not executed**. Your MEL domain declares what effects should happen:

```mel
action fetchUsers() {
  once(fetchUsersIntent) {
    patch fetchUsersIntent = $meta.intentId
    patch status = "loading"
    effect api.fetchUsers({ limit: 10 })  // Declaration, not execution
  }
}
```

**Services** are the handlers that execute these effects:

```typescript
const services: ServiceMap = {
  "api.fetchUsers": async (params, ctx) => {
    // Execute the actual side effect
    const users = await fetch(`/api/users?limit=${params.limit}`)
      .then((r) => r.json());

    // Return patches to apply
    return [
      ctx.patch.set("users", users),
      ctx.patch.set("status", "idle"),
    ];
  },
};
```

---

## ServiceMap Structure

A `ServiceMap` is a record of effect types to handler functions:

```typescript
import type { ServiceMap } from "@manifesto-ai/app";

const services: ServiceMap = {
  // Each key is an effect type
  "api.fetchUsers": handler1,
  "api.saveUser": handler2,
  "db.query": handler3,
  "email.send": handler4,
};

const app = createApp(mel, { services });
```

Effect types are strings. By convention, use dot notation for namespacing:
- `api.xxx` — HTTP API calls
- `db.xxx` — Database operations
- `email.xxx` — Email sending
- `storage.xxx` — File storage

---

## Writing a Handler

### Basic Structure

```typescript
import type { ServiceHandler, Patch } from "@manifesto-ai/app";

const myHandler: ServiceHandler = async (params, ctx) => {
  // 1. Execute side effect
  const result = await doSomething(params);

  // 2. Return patches
  return [
    ctx.patch.set("result", result),
  ];
};
```

### Handler Signature

```typescript
type ServiceHandler = (
  params: Record<string, unknown>,
  ctx: ServiceContext
) => ServiceReturn | Promise<ServiceReturn>;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `params` | `Record<string, unknown>` | Parameters from the effect declaration |
| `ctx` | `ServiceContext` | Execution context with helpers |

### Return Types

Handlers can return:

```typescript
type ServiceReturn =
  | void                      // No patches
  | Patch                     // Single patch
  | readonly Patch[]          // Array of patches
  | { patches: readonly Patch[] };  // Explicit object
```

---

## ServiceContext

The `ctx` parameter provides useful information and helpers:

```typescript
interface ServiceContext {
  /** Current snapshot (read-only) */
  snapshot: Readonly<AppState<unknown>>;

  /** Actor executing this action */
  actorId: string;

  /** World ID being modified */
  worldId: string;

  /** Current branch ID */
  branchId: string;

  /** Patch helper functions */
  patch: PatchHelpers;

  /** Abort signal for cancellation */
  signal: AbortSignal;
}
```

### Reading Current State

```typescript
"api.saveUser": async (params, ctx) => {
  // Access current state
  const currentUser = ctx.snapshot.data.user;
  const version = ctx.snapshot.meta.version;

  // Use in your logic
  if (currentUser.id === params.userId) {
    // ...
  }
};
```

### Using Actor Information

```typescript
"api.auditLog": async (params, ctx) => {
  await logAuditEvent({
    action: params.action,
    actor: ctx.actorId,
    timestamp: Date.now(),
  });
  return [];
};
```

---

## PatchHelpers

The `ctx.patch` object provides convenient methods for creating patches:

### set()

Replaces a value at a path:

```typescript
ctx.patch.set("user.name", "John")
// → { op: "set", path: "user.name", value: "John" }
```

### merge()

Shallow merges an object at a path:

```typescript
ctx.patch.merge("user", { name: "John", age: 30 })
// → { op: "merge", path: "user", value: { name: "John", age: 30 } }
```

### unset()

Removes a property at a path:

```typescript
ctx.patch.unset("user.tempData")
// → { op: "unset", path: "user.tempData" }
```

### many()

Combines multiple patches:

```typescript
ctx.patch.many(
  ctx.patch.set("status", "idle"),
  ctx.patch.set("data", result),
  ctx.patch.unset("error")
)
// → [{ op: "set", ... }, { op: "set", ... }, { op: "unset", ... }]
```

### from()

Creates patches from an object:

```typescript
ctx.patch.from({ name: "John", age: 30 }, { basePath: "user" })
// → [
//   { op: "set", path: "user.name", value: "John" },
//   { op: "set", path: "user.age", value: 30 }
// ]
```

---

## Error Handling

### Returning Error State

Handlers should NOT throw exceptions. Instead, return patches that represent the error:

```typescript
"api.fetchData": async (params, ctx) => {
  try {
    const data = await fetch(params.url).then((r) => r.json());
    return [
      ctx.patch.set("data", data),
      ctx.patch.set("status", "idle"),
      ctx.patch.unset("error"),
    ];
  } catch (error) {
    // Return error as state
    return [
      ctx.patch.set("status", "error"),
      ctx.patch.set("error", {
        code: "FETCH_FAILED",
        message: error.message,
      }),
    ];
  }
}
```

### Abort Signal

Use the `ctx.signal` for cancellation-aware operations:

```typescript
"api.longRunning": async (params, ctx) => {
  const response = await fetch(params.url, {
    signal: ctx.signal,  // Pass to fetch
  });

  // Check if aborted
  if (ctx.signal.aborted) {
    return [ctx.patch.set("status", "cancelled")];
  }

  return [ctx.patch.set("data", await response.json())];
}
```

---

## Common Patterns

### API Call Pattern

```typescript
const apiServices: ServiceMap = {
  "api.get": async (params, ctx) => {
    try {
      const response = await fetch(params.url, {
        headers: { Authorization: `Bearer ${ctx.snapshot.data.token}` },
        signal: ctx.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return [ctx.patch.set(params.target || "data", data)];
    } catch (error) {
      return [
        ctx.patch.set("error", error.message),
        ctx.patch.set("status", "error"),
      ];
    }
  },

  "api.post": async (params, ctx) => {
    const { url, body, target = "result" } = params;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctx.signal,
      });

      const data = await response.json();
      return [ctx.patch.set(target, data)];
    } catch (error) {
      return [ctx.patch.set("error", error.message)];
    }
  },
};
```

### Database Pattern

```typescript
const dbServices: ServiceMap = {
  "db.query": async (params, ctx) => {
    const { sql, values, target } = params;

    const result = await db.query(sql, values);
    return [ctx.patch.set(target, result.rows)];
  },

  "db.insert": async (params, ctx) => {
    const { table, data } = params;

    const result = await db.insert(table, data);
    return [
      ctx.patch.set("lastInsertId", result.insertId),
    ];
  },
};
```

### Storage Pattern

```typescript
const storageServices: ServiceMap = {
  "storage.upload": async (params, ctx) => {
    const { file, path } = params;

    const url = await storage.upload(path, file);
    return [ctx.patch.set("uploadedUrl", url)];
  },

  "storage.download": async (params, ctx) => {
    const { url, target } = params;

    const data = await storage.download(url);
    return [ctx.patch.set(target, data)];
  },
};
```

### Notification Pattern

```typescript
const notificationServices: ServiceMap = {
  "notify.email": async (params) => {
    await emailService.send({
      to: params.to,
      subject: params.subject,
      body: params.body,
    });
    // No patches needed for fire-and-forget
    return [];
  },

  "notify.push": async (params) => {
    await pushService.send(params.userId, params.message);
    return [];
  },
};
```

---

## Validation

### Lazy Validation (Default)

By default, services are validated at execution time:

```typescript
const app = createApp(mel, {
  services: myServices,
  validation: { services: "lazy" },  // Default
});
```

If an effect type has no handler, the action fails with an error.

### Strict Validation

Validate all effect types at `ready()` time:

```typescript
const app = createApp(mel, {
  services: myServices,
  validation: { services: "strict" },
});

// Throws if MEL declares effects without handlers
await app.ready();
```

---

## Testing Services

Services are pure async functions, making them easy to test:

```typescript
import { describe, it, expect, vi } from "vitest";

describe("api.fetchUsers", () => {
  it("returns users on success", async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 1, name: "John" }]),
    });

    // Create mock context
    const ctx = {
      snapshot: { data: {}, computed: {}, system: {}, meta: {} },
      actorId: "test",
      worldId: "world-1",
      branchId: "main",
      patch: {
        set: (path: string, value: unknown) => ({ op: "set", path, value }),
        merge: (path: string, value: unknown) => ({ op: "merge", path, value }),
        unset: (path: string) => ({ op: "unset", path }),
        many: (...patches: any[]) => patches.flat(),
        from: (record: any, opts?: any) =>
          Object.entries(record).map(([k, v]) => ({
            op: "set",
            path: opts?.basePath ? `${opts.basePath}.${k}` : k,
            value: v,
          })),
      },
      signal: new AbortController().signal,
    };

    // Call handler
    const handler = services["api.fetchUsers"];
    const patches = await handler({ limit: 10 }, ctx);

    // Assert
    expect(patches).toEqual([
      { op: "set", path: "users", value: [{ id: 1, name: "John" }] },
      { op: "set", path: "status", value: "idle" },
    ]);
  });

  it("handles errors gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const ctx = { /* ... */ };
    const patches = await services["api.fetchUsers"]({}, ctx);

    expect(patches).toContainEqual(
      expect.objectContaining({ path: "status", value: "error" })
    );
  });
});
```

---

## Composing Services

### Factory Pattern

```typescript
function createApiServices(baseUrl: string): ServiceMap {
  return {
    "api.get": async (params, ctx) => {
      const url = `${baseUrl}${params.path}`;
      const data = await fetch(url).then((r) => r.json());
      return [ctx.patch.set(params.target, data)];
    },
    // ...
  };
}

const app = createApp(mel, {
  services: createApiServices("https://api.example.com"),
});
```

### Merging Services

```typescript
const app = createApp(mel, {
  services: {
    ...createApiServices("https://api.example.com"),
    ...createDbServices(dbConnection),
    ...createStorageServices(s3Client),
  },
});
```

---

## Best Practices

1. **Never throw in handlers** — Return error patches instead
2. **Use `ctx.signal` for long operations** — Respect cancellation
3. **Keep handlers focused** — One handler, one responsibility
4. **Return minimal patches** — Only update what changed
5. **Use namespaced effect types** — `api.xxx`, `db.xxx`, etc.
6. **Test handlers in isolation** — They're just async functions
7. **Log for debugging** — But don't throw logs into state
