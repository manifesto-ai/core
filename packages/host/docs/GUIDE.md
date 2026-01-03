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
import { createHost } from "@manifesto-ai/host";
import type { DomainSchema } from "@manifesto-ai/core";

// 1. Define schema
const schema: DomainSchema = {
  id: "example:counter",
  version: "1.0.0",
  hash: "example-hash",
  state: {
    count: { type: "number", default: 0 },
  },
  actions: {
    increment: {
      flow: {
        kind: "patch",
        op: "set",
        path: "count",
        value: { kind: "add", left: { kind: "get", path: "count" }, right: 1 },
      },
    },
  },
};

// 2. Create host
const host = createHost(schema, {
  initialData: { count: 0 },
  context: { now: () => Date.now() },
});

// 3. Verify
const snapshot = await host.getSnapshot();
console.log(snapshot?.data.count);
// → 0
```

---

## Basic Usage

### Use Case 1: Dispatching an Intent

**Goal:** Execute an intent and update state.

```typescript
import { createHost } from "@manifesto-ai/host";
import { createIntent } from "@manifesto-ai/core";

const host = createHost(schema, {
  initialData: { count: 0 },
  context: { now: () => Date.now() },
});

// Dispatch intent
const intent = createIntent("increment", "intent-1");
const result = await host.dispatch(intent);

console.log(result.status); // → "complete"
const snapshot = await host.getSnapshot();
console.log(snapshot?.data.count); // → 1
```

### Use Case 2: Registering Effect Handlers

**Goal:** Handle effects declared by Core.

```typescript
// Schema with effect
const schema: DomainSchema = {
  id: "example:fetch-user",
  version: "1.0.0",
  hash: "example-fetch-hash",
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
          { kind: "patch", op: "set", path: "loading", value: true },
          {
            kind: "effect",
            type: "api.get",
            params: {
              url: { kind: "concat", args: ["/users/", { kind: "get", path: "input.id" }] },
              target: "user",
            },
          },
          { kind: "patch", op: "set", path: "loading", value: false },
        ],
      },
    },
  },
};

const host = createHost(schema, {
  initialData: { user: null, loading: false },
  context: { now: () => Date.now() },
});

// Register effect handler
host.registerEffect("api.get", async (_type, params) => {
  const response = await fetch(params.url);
  const data = await response.json();

  return [{ op: "set", path: params.target, value: data }];
});

// Dispatch
const intent = createIntent("fetchUser", { id: "123" }, "intent-1");
const result = await host.dispatch(intent);

const snapshot = await host.getSnapshot();
console.log(snapshot?.data.user); // → { id: "123", name: "..." }
```

### Use Case 3: Error Handling in Effects

**Goal:** Handle errors gracefully.

```typescript
host.registerEffect("api.get", async (_type, params) => {
  try {
    const response = await fetch(params.url);

    if (!response.ok) {
      return [
        { op: "set", path: "error", value: `Failed: ${response.status}` },
      ];
    }

    const data = await response.json();
    return [
      { op: "set", path: params.target, value: data },
      { op: "set", path: "error", value: null },
    ];
  } catch (e) {
    return [
      { op: "set", path: "error", value: e.message },
    ];
  }
});
```

---

## Common Patterns

### Pattern 1: Timer/Delay Effect

**When to use:** Delay execution or implement timeouts.

```typescript
host.registerEffect("timer.delay", async (_type, params) => {
  await new Promise((resolve) => setTimeout(resolve, params.ms));
  return [];
});

// In schema flow:
{ kind: "effect", type: "timer.delay", params: { ms: 1000 } }
```

### Pattern 2: API POST Effect

**When to use:** Send data to an API.

```typescript
host.registerEffect("api.post", async (_type, params) => {
  const response = await fetch(params.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params.body),
  });

  const data = await response.json();

  const patches = params.target
    ? [{ op: "set", path: params.target, value: data }]
    : [];

  if (!response.ok) {
    patches.push({ op: "set", path: "error", value: data.message });
  }

  return patches;
});
```

### Pattern 3: Effect with Cleanup

**When to use:** Effects that need cleanup on failure.

```typescript
host.registerEffect("file.upload", async (_type, params, context) => {
  const { snapshot } = context;
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

    return [{ op: "set", path: "uploadResult", value: { uploadId } }];
  } catch (e) {
    // Cleanup on failure
    if (uploadId) {
      await fetch(`/api/upload/${uploadId}`, { method: "DELETE" }).catch(() => {});
    }

    return [{ op: "set", path: "error", value: e.message }];
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

const host = createHost(schema, {
  store: localStorageStore,
  initialData: {},
  context: { now: () => Date.now() },
});
```

### Using runHostLoop Directly

```typescript
import { runHostLoop, createEffectRegistry, createEffectExecutor } from "@manifesto-ai/host";
import { createCore } from "@manifesto-ai/core";

const core = createCore();
const registry = createEffectRegistry();
registry.register("api.get", async (_type, params) => {
  // ... handler implementation
  return [];
});

const executor = createEffectExecutor(registry);

const result = await runHostLoop(
  core,
  schema,
  snapshot,
  intent,
  executor,
  {
    maxIterations: 10,
    context: { now: () => Date.now() },
  }
);
```

---

## Common Mistakes

### Mistake 1: Forgetting to Register Effect Handlers

**What people do:**

```typescript
// Wrong: No handler registered
const host = createHost(schema, {
  initialData: { user: null },
  context: { now: () => Date.now() },
});
const intent = createIntent("fetchUser", { id: "123" }, "intent-1");
await host.dispatch(intent);
// → Error: No handler for effect type "api.get"
```

**Why it's wrong:** Host doesn't know how to execute the effect.

**Correct approach:**

```typescript
// Right: Register handler before dispatch
const host = createHost(schema, {
  initialData: { user: null },
  context: { now: () => Date.now() },
});
const intent = createIntent("fetchUser", { id: "123" }, "intent-1");

host.registerEffect("api.get", async (_type, _params) => {
  // ... implementation
  return [];
});

await host.dispatch(intent);
```

### Mistake 2: Not Returning Patches from Effect Handler

**What people do:**

```typescript
// Wrong: Modifying external state instead of returning patches
host.registerEffect("api.get", async (_type, params) => {
  const data = await fetch(params.url).then((r) => r.json());
  externalState.user = data; // Wrong!
  return [];
});
```

**Why it's wrong:** State changes must go through patches to maintain determinism.

**Correct approach:**

```typescript
// Right: Return patches
host.registerEffect("api.get", async (_type, params) => {
  const data = await fetch(params.url).then((r) => r.json());
  return [{ op: "set", path: "user", value: data }];
});
```

### Mistake 3: Throwing Exceptions in Effect Handlers

**What people do:**

```typescript
// Wrong: Throwing
host.registerEffect("api.get", async (_type, params) => {
  const response = await fetch(params.url);
  if (!response.ok) throw new Error("Failed"); // Wrong!
  return [];
});
```

**Why it's wrong:** Exceptions bypass the error handling system.

**Correct approach:**

```typescript
// Right: Return error result
host.registerEffect("api.get", async (_type, params) => {
  const response = await fetch(params.url);
  if (!response.ok) {
    return [{ op: "set", path: "error", value: `HTTP ${response.status}` }];
  }
  return [];
});
```

---

## Troubleshooting

### Error: "No handler for effect type X"

**Cause:** Effect handler not registered.

**Solution:**

```typescript
// Register the handler
host.registerEffect("X", async () => []);
```

### Error: "Effect timeout"

**Cause:** Effect handler took too long.

**Solution:**

```typescript
// Increase timeout
const host = createHost(schema, {
  initialData: {},
  context: { now: () => Date.now() },
});

host.registerEffect("api.get", async (_type, params) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(params.url, { signal: controller.signal });
    return response.ok ? [] : [{ op: "set", path: "error", value: response.status }];
  } finally {
    clearTimeout(timeoutId);
  }
}, { timeout: 60000 });

// Or handle timeout in handler
host.registerEffect("api.get", async (_type, params) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(params.url, { signal: controller.signal });
    return response.ok ? [] : [{ op: "set", path: "error", value: response.status }];
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
  condition: { kind: "not", arg: { kind: "get", path: "loaded" } },
  then: {
    kind: "seq",
    steps: [
      { kind: "patch", op: "set", path: "loaded", value: true },
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

    const handler = async (_type, params) => {
      const response = await fetch(params.url);
      const data = await response.json();
      return [{ op: "set", path: "user", value: data }];
    };

    const result = await handler("api.get", { url: "/users/123" }, {
      snapshot: {
        data: {},
        computed: {},
        system: {
          status: "idle",
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        input: undefined,
        meta: {
          version: 0,
          timestamp: 0,
          randomSeed: "seed",
          schemaHash: "test-hash",
        },
      },
      requirement: {
        id: "req-1",
        type: "api.get",
        params: {},
        actionId: "fetchUser",
        flowPosition: { nodePath: "root", snapshotVersion: 0 },
        createdAt: 0,
      },
    });

    expect(result[0].value).toEqual({ id: "123", name: "Test" });
  });
});
```

---

## Quick Reference

### Key APIs

| API | Purpose | Example |
|-----|---------|---------|
| `createHost()` | Create host instance | `createHost(schema, { initialData, context })` |
| `host.registerEffect()` | Register handler | `host.registerEffect("api.get", handler)` |
| `host.dispatch()` | Execute intent | `await host.dispatch(intent)` |
| `host.getSnapshot()` | Get current snapshot (async) | `await host.getSnapshot()` |

### Effect Handler Return

Effect handlers return `Patch[]` directly:

- Success: return patches that write results into Snapshot.
- Failure: return patches that write error values into Snapshot.

---

*End of Guide*
