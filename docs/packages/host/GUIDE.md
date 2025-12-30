# Host Guide

> **Purpose:** Practical guide for using @manifesto-ai/host
> **Prerequisites:** Basic understanding of Core
> **Time to complete:** ~15 minutes

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Common Patterns](#common-patterns)
4. [Advanced Usage](#advanced-usage)
5. [Common Mistakes](#common-mistakes)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

```bash
npm install @manifesto-ai/host @manifesto-ai/core
```

### Minimal Setup

```typescript
import { createHost, createSnapshot } from "@manifesto-ai/host";
import type { DomainSchema } from "@manifesto-ai/core";

// 1. Define schema
const schema: DomainSchema = {
  version: "1.0.0",
  state: {
    count: { type: "number", default: 0 },
  },
  actions: {
    increment: {
      flow: {
        kind: "patch",
        op: "set",
        path: "/data/count",
        value: { kind: "add", left: { kind: "get", path: "/data/count" }, right: 1 },
      },
    },
  },
};

// 2. Create host
const host = createHost({
  schema,
  snapshot: createSnapshot(schema),
});

// 3. Verify
console.log(host.getSnapshot().data.count);
// → 0
```

---

## Basic Usage

### Use Case 1: Dispatching an Intent

**Goal:** Execute an intent and update state.

```typescript
import { createHost, createSnapshot } from "@manifesto-ai/host";

const host = createHost({ schema, snapshot: createSnapshot(schema) });

// Dispatch intent
const result = await host.dispatch({
  type: "increment",
  intentId: "i_1",
});

console.log(result.status); // → "completed"
console.log(host.getSnapshot().data.count); // → 1
```

### Use Case 2: Registering Effect Handlers

**Goal:** Handle effects declared by Core.

```typescript
// Schema with effect
const schema: DomainSchema = {
  version: "1.0.0",
  state: {
    user: { type: "object", default: null },
    loading: { type: "boolean", default: false },
  },
  actions: {
    fetchUser: {
      input: { type: "object", properties: { id: { type: "string" } } },
      flow: {
        kind: "seq",
        steps: [
          { kind: "patch", op: "set", path: "/data/loading", value: true },
          {
            kind: "effect",
            type: "api.get",
            params: {
              url: { kind: "concat", args: ["/users/", { kind: "get", path: "/input/id" }] },
              target: "/data/user",
            },
          },
          { kind: "patch", op: "set", path: "/data/loading", value: false },
        ],
      },
    },
  },
};

const host = createHost({ schema, snapshot: createSnapshot(schema) });

// Register effect handler
host.registerEffect("api.get", async ({ params }) => {
  const response = await fetch(params.url);
  const data = await response.json();

  return {
    ok: true,
    patches: [{ op: "set", path: params.target, value: data }],
  };
});

// Dispatch
const result = await host.dispatch({
  type: "fetchUser",
  input: { id: "123" },
  intentId: "i_1",
});

console.log(host.getSnapshot().data.user); // → { id: "123", name: "..." }
```

### Use Case 3: Error Handling in Effects

**Goal:** Handle errors gracefully.

```typescript
host.registerEffect("api.get", async ({ params }) => {
  try {
    const response = await fetch(params.url);

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}`,
        patches: [
          { op: "set", path: "/data/error", value: `Failed: ${response.status}` },
        ],
      };
    }

    const data = await response.json();
    return {
      ok: true,
      patches: [
        { op: "set", path: params.target, value: data },
        { op: "set", path: "/data/error", value: null },
      ],
    };
  } catch (e) {
    return {
      ok: false,
      error: e.message,
      patches: [
        { op: "set", path: "/data/error", value: e.message },
      ],
    };
  }
});
```

---

## Common Patterns

### Pattern 1: Timer/Delay Effect

**When to use:** Delay execution or implement timeouts.

```typescript
host.registerEffect("timer.delay", async ({ params }) => {
  await new Promise((resolve) => setTimeout(resolve, params.ms));
  return { ok: true };
});

// In schema flow:
{ kind: "effect", type: "timer.delay", params: { ms: 1000 } }
```

### Pattern 2: API POST Effect

**When to use:** Send data to an API.

```typescript
host.registerEffect("api.post", async ({ params }) => {
  const response = await fetch(params.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params.body),
  });

  const data = await response.json();

  return {
    ok: response.ok,
    patches: params.target
      ? [{ op: "set", path: params.target, value: data }]
      : [],
    error: response.ok ? undefined : data.message,
  };
});
```

### Pattern 3: Effect with Cleanup

**When to use:** Effects that need cleanup on failure.

```typescript
host.registerEffect("file.upload", async ({ params, snapshot }) => {
  let uploadId: string | undefined;

  try {
    // Start upload
    const initResponse = await fetch("/api/upload/init", { method: "POST" });
    uploadId = (await initResponse.json()).uploadId;

    // Upload chunks
    await fetch(`/api/upload/${uploadId}/data`, {
      method: "PUT",
      body: params.data,
    });

    // Finalize
    await fetch(`/api/upload/${uploadId}/finalize`, { method: "POST" });

    return {
      ok: true,
      patches: [{ op: "set", path: "/data/uploadResult", value: { uploadId } }],
    };
  } catch (e) {
    // Cleanup on failure
    if (uploadId) {
      await fetch(`/api/upload/${uploadId}`, { method: "DELETE" }).catch(() => {});
    }

    return { ok: false, error: e.message };
  }
});
```

---

## Advanced Usage

### Custom Snapshot Store

**Prerequisites:** Understanding of persistence requirements.

```typescript
import { createHost, type SnapshotStore } from "@manifesto-ai/host";

// Custom store (e.g., localStorage)
const localStorageStore: SnapshotStore = {
  get() {
    const saved = localStorage.getItem("app-snapshot");
    return saved ? JSON.parse(saved) : undefined;
  },
  set(snapshot) {
    localStorage.setItem("app-snapshot", JSON.stringify(snapshot));
  },
};

const host = createHost({
  schema,
  snapshot: localStorageStore.get() ?? createSnapshot(schema),
  store: localStorageStore,
});
```

### Using runHostLoop Directly

```typescript
import { runHostLoop, createEffectRegistry, createEffectExecutor } from "@manifesto-ai/host";

const registry = createEffectRegistry();
registry.register("api.get", async ({ params }) => {
  // ... handler implementation
  return { ok: true, patches: [] };
});

const executor = createEffectExecutor({ registry });

const result = await runHostLoop({
  schema,
  snapshot,
  intent,
  executor,
  maxIterations: 10,
  timeout: 30000,
});
```

---

## Common Mistakes

### Mistake 1: Forgetting to Register Effect Handlers

**What people do:**

```typescript
// Wrong: No handler registered
const host = createHost({ schema, snapshot });
await host.dispatch({ type: "fetchUser", input: { id: "123" } });
// → Error: No handler for effect type "api.get"
```

**Why it's wrong:** Host doesn't know how to execute the effect.

**Correct approach:**

```typescript
// Right: Register handler before dispatch
const host = createHost({ schema, snapshot });

host.registerEffect("api.get", async ({ params }) => {
  // ... implementation
  return { ok: true, patches: [] };
});

await host.dispatch({ type: "fetchUser", input: { id: "123" } });
```

### Mistake 2: Not Returning Patches from Effect Handler

**What people do:**

```typescript
// Wrong: Modifying external state instead of returning patches
host.registerEffect("api.get", async ({ params }) => {
  const data = await fetch(params.url).then((r) => r.json());
  externalState.user = data; // Wrong!
  return { ok: true };
});
```

**Why it's wrong:** State changes must go through patches to maintain determinism.

**Correct approach:**

```typescript
// Right: Return patches
host.registerEffect("api.get", async ({ params }) => {
  const data = await fetch(params.url).then((r) => r.json());
  return {
    ok: true,
    patches: [{ op: "set", path: "/data/user", value: data }],
  };
});
```

### Mistake 3: Throwing Exceptions in Effect Handlers

**What people do:**

```typescript
// Wrong: Throwing
host.registerEffect("api.get", async ({ params }) => {
  const response = await fetch(params.url);
  if (!response.ok) throw new Error("Failed"); // Wrong!
  return { ok: true, patches: [] };
});
```

**Why it's wrong:** Exceptions bypass the error handling system.

**Correct approach:**

```typescript
// Right: Return error result
host.registerEffect("api.get", async ({ params }) => {
  const response = await fetch(params.url);
  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}` };
  }
  return { ok: true, patches: [] };
});
```

---

## Troubleshooting

### Error: "No handler for effect type X"

**Cause:** Effect handler not registered.

**Solution:**

```typescript
// Register the handler
host.registerEffect("X", async ({ params }) => {
  return { ok: true, patches: [] };
});
```

### Error: "Effect timeout"

**Cause:** Effect handler took too long.

**Solution:**

```typescript
// Increase timeout
const host = createHost({
  schema,
  snapshot,
  timeout: 60000, // 60 seconds
});

// Or handle timeout in handler
host.registerEffect("api.get", async ({ params }) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(params.url, { signal: controller.signal });
    return { ok: true, patches: [] };
  } finally {
    clearTimeout(timeoutId);
  }
});
```

### Infinite loop detected

**Cause:** Effect keeps producing more effects without progress.

**Solution:**

```typescript
// Check your flow logic - ensure effects don't recursively trigger themselves
// Use guards to prevent re-entry
{
  kind: "if",
  condition: { kind: "not", arg: { kind: "get", path: "/data/loaded" } },
  then: {
    kind: "seq",
    steps: [
      { kind: "patch", op: "set", path: "/data/loaded", value: true },
      { kind: "effect", type: "api.get", params: {} },
    ],
  },
}
```

---

## Testing

### Unit Testing Effect Handlers

```typescript
import { describe, it, expect, vi } from "vitest";

describe("API effect handler", () => {
  it("returns data on success", async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "123", name: "Test" }),
    });

    const handler = async ({ params }) => {
      const response = await fetch(params.url);
      const data = await response.json();
      return { ok: true, patches: [{ op: "set", path: "/data/user", value: data }] };
    };

    const result = await handler({ params: { url: "/users/123" } });

    expect(result.ok).toBe(true);
    expect(result.patches[0].value).toEqual({ id: "123", name: "Test" });
  });
});
```

---

## Quick Reference

### Key APIs

| API | Purpose | Example |
|-----|---------|---------|
| `createHost()` | Create host instance | `createHost({ schema, snapshot })` |
| `host.registerEffect()` | Register handler | `host.registerEffect("api.get", handler)` |
| `host.dispatch()` | Execute intent | `await host.dispatch(intent)` |
| `host.getSnapshot()` | Get current snapshot | `host.getSnapshot()` |

### EffectResult Structure

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | Whether effect succeeded |
| `patches` | Patch[] | State changes to apply |
| `error` | string? | Error message if failed |

---

*End of Guide*
