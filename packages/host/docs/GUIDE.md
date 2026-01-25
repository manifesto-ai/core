# Host Guide

> **Version:** v2.0.1
> **Purpose:** Practical guide for using @manifesto-ai/host
> **Prerequisites:** Basic understanding of Core
> **Time to complete:** ~20 minutes

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding the Execution Model](#understanding-the-execution-model)
3. [Basic Usage](#basic-usage)
4. [Effect Handlers](#effect-handlers)
5. [Job Types and Lifecycle](#job-types-and-lifecycle)
6. [Context Determinism](#context-determinism)
7. [Common Patterns](#common-patterns)
8. [Advanced Usage](#advanced-usage)
9. [Testing](#testing)
10. [Common Mistakes](#common-mistakes)
11. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

```bash
npm install @manifesto-ai/host @manifesto-ai/core
# or
pnpm add @manifesto-ai/host @manifesto-ai/core
```

### Minimal Setup

```typescript
import { ManifestoHost, createIntent, type DomainSchema } from "@manifesto-ai/host";

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
const host = new ManifestoHost(schema, {
  initialData: { count: 0 },
});

// 3. Dispatch intent
const intent = createIntent("increment", "intent-1");
const result = await host.dispatch(intent);

// 4. Check result
console.log(result.status);             // → "complete"
console.log(result.snapshot.data.count); // → 1
```

---

## Understanding the Execution Model

Host v2.0 introduces an **event-loop execution model** with three core concepts:

### Mailbox

A per-`ExecutionKey` queue that serializes all state mutations:

```
┌────────────────────────────────────────┐
│           Execution Mailbox             │
│  key: "intent-1"                        │
├────────────────────────────────────────┤
│  Job1 → Job2 → Job3 → ...              │
│         (FIFO queue)                    │
└────────────────────────────────────────┘
```

- One mailbox per `ExecutionKey` (typically `intentId`)
- All state mutations go through the mailbox
- Jobs are processed in FIFO order

### Runner

A single-runner processes the mailbox:

```typescript
// Only ONE runner per ExecutionKey at any time
// This guarantees single-writer semantics
await processMailbox(ctx, runnerState);
```

Key invariants:
- **Single-runner**: At most one runner per ExecutionKey
- **Run-to-completion**: Job handlers complete without interruption
- **Lost-wakeup prevention**: Runner re-checks mailbox before releasing guard

### Jobs

Four job types handle different operations:

| Job Type | Purpose | When Used |
|----------|---------|-----------|
| `StartIntent` | Begin processing a new intent | `dispatch(intent)` |
| `ContinueCompute` | Resume after effect fulfillment | After effect completes |
| `FulfillEffect` | Apply effect results | Effect returns Patch[] |
| `ApplyPatches` | Apply direct patches | Direct patch submission |

---

## Basic Usage

### Use Case 1: Dispatching an Intent

**Goal:** Execute an intent and update state.

```typescript
import { ManifestoHost, createIntent } from "@manifesto-ai/host";

const host = new ManifestoHost(schema, {
  initialData: { count: 0 },
});

// Dispatch intent
const intent = createIntent("increment", "intent-1");
const result = await host.dispatch(intent);

console.log(result.status); // → "complete"
console.log(host.getSnapshot()?.data.count); // → 1
```

### Use Case 2: Dispatching with Input

**Goal:** Pass input parameters to an action.

```typescript
const schema: DomainSchema = {
  // ...
  actions: {
    addAmount: {
      input: { type: "object", properties: { amount: { type: "number" } } },
      flow: {
        kind: "patch",
        op: "set",
        path: "count",
        value: { kind: "add", left: { kind: "get", path: "count" }, right: { kind: "get", path: "input.amount" } },
      },
    },
  },
};

const host = new ManifestoHost(schema, { initialData: { count: 0 } });

// Dispatch with input
const intent = createIntent("addAmount", { amount: 5 }, "intent-1");
const result = await host.dispatch(intent);

console.log(host.getSnapshot()?.data.count); // → 5
```

### Use Case 3: Handling Multiple Intents

**Goal:** Process intents sequentially.

```typescript
const host = new ManifestoHost(schema, { initialData: { count: 0 } });

// Each intent has a unique intentId
await host.dispatch(createIntent("increment", "intent-1"));
await host.dispatch(createIntent("increment", "intent-2"));
await host.dispatch(createIntent("increment", "intent-3"));

console.log(host.getSnapshot()?.data.count); // → 3
```

---

## Effect Handlers

### Registering Effect Handlers

```typescript
const host = new ManifestoHost(schema, { initialData: {} });

// Register effect handler
host.registerEffect("api.get", async (type, params, context) => {
  const { snapshot, requirement } = context;

  try {
    const response = await fetch(params.url);
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

### Effect Handler Contract

Effect handlers MUST:

1. **Return `Patch[]`** — Never throw exceptions
2. **Express failures as patches** — Write errors to Snapshot
3. **Be pure IO adapters** — No domain logic

```typescript
// ✅ CORRECT: Errors as patches
host.registerEffect("api.get", async (type, params) => {
  try {
    const response = await fetch(params.url);
    if (!response.ok) {
      return [{ op: "set", path: "error", value: `HTTP ${response.status}` }];
    }
    return [{ op: "set", path: "data", value: await response.json() }];
  } catch (e) {
    return [{ op: "set", path: "error", value: e.message }];
  }
});

// ❌ WRONG: Throwing exceptions
host.registerEffect("api.get", async (type, params) => {
  const response = await fetch(params.url);
  if (!response.ok) throw new Error("Failed"); // WRONG!
  return [];
});
```

### Effect Handler Options

```typescript
host.registerEffect("api.slowRequest", async (type, params) => {
  // Long-running operation...
  return [];
}, {
  timeout: 30000,  // 30 second timeout
});
```

### Checking Registered Effects

```typescript
// Check if effect is registered
if (host.hasEffect("api.get")) {
  console.log("api.get handler is registered");
}

// Get all registered effect types
const effectTypes = host.getEffectTypes();
console.log(effectTypes); // → ["api.get", "api.post", ...]

// Unregister an effect
host.unregisterEffect("api.get");
```

---

## Job Types and Lifecycle

### Job Flow

```
dispatch(intent)
       │
       ▼
┌──────────────────┐
│   StartIntent    │ ── Core.compute() ──┬── has effects ──→ request effect
└──────────────────┘                      │                        │
                                          │                        ▼
                                          │               ┌──────────────────┐
                                          │               │   Effect Runner   │
                                          │               │   (outside mailbox)│
                                          │               └────────┬──────────┘
                                          │                        │
                                          ▼                        ▼
                                   no effects             ┌──────────────────┐
                                          │               │  FulfillEffect   │
                                          │               │  (apply + clear)  │
                                          │               └────────┬──────────┘
                                          │                        │
                                          ▼                        ▼
                                   ┌──────────────────┐   ┌──────────────────┐
                                   │    complete      │   │ ContinueCompute  │
                                   └──────────────────┘   └──────────────────┘
                                                                   │
                                                                   ▼
                                                           (repeat until done)
```

### Job Handler Await Ban

Job handlers MUST NOT await external work. This is the **run-to-completion** rule:

```typescript
// ❌ WRONG: await inside job handler
async function handleStartIntent(job) {
  const result = await translateIntent(job.intent);  // VIOLATION!
  applyResult(result);
}

// ✅ CORRECT: request effect, terminate job
function handleStartIntent(job) {
  const snapshot = context.getCanonicalHead();
  const computed = Core.compute(schema, snapshot, job.intent);

  if (computed.pendingRequirements.length > 0) {
    requestEffectExecution(job.intentId, computed.pendingRequirements);
    // Job terminates here. No continuation state.
  }
}
```

---

## Context Determinism

### Why Context Determinism Matters

v2.0.1 guarantees that `HostContext` is frozen at job start:

```typescript
// ❌ v1.x PROBLEM: Different timestamps within same job
function handleStartIntent(job) {
  const ctx1 = getContext();  // now = 1000
  Core.compute(..., ctx1);

  const ctx2 = getContext();  // now = 1005 (different!)
  Core.apply(..., ctx2);      // Non-deterministic!
}

// ✅ v2.0.1: Context frozen at job start
function handleStartIntent(job) {
  const frozenContext = createFrozenContext(job.intentId);
  // frozenContext.now is captured once
  // frozenContext.randomSeed = job.intentId

  Core.compute(..., frozenContext);
  Core.apply(..., frozenContext);  // Same context!
}
```

### Using Deterministic Runtime

For testing with fixed time:

```typescript
import { ManifestoHost, type Runtime } from "@manifesto-ai/host";

// Fixed runtime for deterministic tests
const testRuntime: Runtime = {
  now: () => 1704067200000,  // 2024-01-01T00:00:00Z
  randomSeed: () => "test-seed",
};

const host = new ManifestoHost(schema, {
  initialData: {},
  runtime: testRuntime,
});

// All jobs will see the same timestamp
const result = await host.dispatch(intent);
// result.snapshot.meta.timestamp === 1704067200000
```

### randomSeed and Determinism

The `randomSeed` is derived from `intentId`, ensuring deterministic randomness:

```typescript
// Same intentId → same randomSeed → same computed values
const intent1 = createIntent("generateRandom", "intent-123");
const intent2 = createIntent("generateRandom", "intent-123");

// Both will produce the same result
const result1 = await host.dispatch(intent1);
const result2 = await host.dispatch(intent2);
// result1.snapshot === result2.snapshot (for same initial snapshot)
```

---

## Common Patterns

### Pattern 1: Timer/Delay Effect

```typescript
host.registerEffect("timer.delay", async (type, params) => {
  await new Promise((resolve) => setTimeout(resolve, params.ms));
  return [];
});

// In schema flow:
{
  kind: "effect",
  type: "timer.delay",
  params: { ms: 1000 }
}
```

### Pattern 2: API POST Effect

```typescript
host.registerEffect("api.post", async (type, params) => {
  try {
    const response = await fetch(params.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return [
        { op: "set", path: "error", value: data.message || `HTTP ${response.status}` },
      ];
    }

    return params.target
      ? [{ op: "set", path: params.target, value: data }]
      : [];
  } catch (e) {
    return [{ op: "set", path: "error", value: e.message }];
  }
});
```

### Pattern 3: Effect with Timeout

```typescript
host.registerEffect("api.fetch", async (type, params) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeout || 10000);

  try {
    const response = await fetch(params.url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [{ op: "set", path: "error", value: `HTTP ${response.status}` }];
    }

    return [
      { op: "set", path: params.target, value: await response.json() },
    ];
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      return [{ op: "set", path: "error", value: "Request timed out" }];
    }
    return [{ op: "set", path: "error", value: e.message }];
  }
});
```

### Pattern 4: Mailbox/Job Pattern (Low-level)

For advanced use cases, you can interact with the mailbox directly:

```typescript
const host = new ManifestoHost(schema, {
  initialData: {},
  disableAutoEffect: true,  // Disable auto effect execution
});

const key = "execution-1";

// Seed snapshot
host.seedSnapshot(key, initialSnapshot);

// Submit intent
host.submitIntent(key, intent);

// Drain mailbox (processes StartIntent job)
await host.drain(key);

// Check for pending effects
const snapshot = host.getContextSnapshot(key);
const pendingReqs = snapshot?.system.pendingRequirements || [];

// Manually fulfill effect
if (pendingReqs.length > 0) {
  const req = pendingReqs[0];
  const patches = await executeMyEffect(req);
  host.injectEffectResult(key, req.id, intent.intentId, patches);
}

// Drain again to process FulfillEffect
await host.drain(key);
```

---

## Advanced Usage

### Tracing

Enable tracing to debug execution:

```typescript
const host = new ManifestoHost(schema, {
  initialData: {},
  onTrace: (event) => {
    console.log(JSON.stringify(event, null, 2));
  },
});

// Trace events:
// { t: "job:start", type: "StartIntent", intentId: "...", timestamp: ... }
// { t: "job:complete", type: "StartIntent", intentId: "...", timestamp: ... }
// { t: "effect:request", type: "api.get", requirementId: "...", timestamp: ... }
// { t: "runner:kick", key: "...", timestamp: ... }
```

### Custom HostContextProvider

For advanced determinism control:

```typescript
import {
  ManifestoHost,
  createHostContextProvider,
  type Runtime,
} from "@manifesto-ai/host";

const runtime: Runtime = {
  now: () => Date.now(),
  randomSeed: () => "custom-seed",
};

const contextProvider = createHostContextProvider(runtime, {
  env: { NODE_ENV: "production" },
});

// Use contextProvider in custom execution flows
const frozenContext = contextProvider.createFrozenContext("intent-1");
```

### Environment Variables

Pass environment variables to effect handlers:

```typescript
const host = new ManifestoHost(schema, {
  initialData: {},
  env: {
    API_BASE_URL: "https://api.example.com",
    API_KEY: process.env.API_KEY,
  },
});

// Access in effect handler via context
host.registerEffect("api.get", async (type, params, context) => {
  const baseUrl = context.env?.API_BASE_URL;
  const apiKey = context.env?.API_KEY;

  const response = await fetch(`${baseUrl}${params.path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  return [{ op: "set", path: "data", value: await response.json() }];
});
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

    const handler = async (type, params) => {
      const response = await fetch(params.url);
      const data = await response.json();
      return [{ op: "set", path: "user", value: data }];
    };

    const result = await handler("api.get", { url: "/users/123" });

    expect(result).toEqual([
      { op: "set", path: "user", value: { id: "123", name: "Test" } },
    ]);
  });

  it("returns error patch on failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const handler = async (type, params) => {
      const response = await fetch(params.url);
      if (!response.ok) {
        return [{ op: "set", path: "error", value: `HTTP ${response.status}` }];
      }
      return [];
    };

    const result = await handler("api.get", { url: "/users/999" });

    expect(result).toEqual([
      { op: "set", path: "error", value: "HTTP 404" },
    ]);
  });
});
```

### Integration Testing with Host

```typescript
import { describe, it, expect } from "vitest";
import { ManifestoHost, createIntent } from "@manifesto-ai/host";

describe("Counter host", () => {
  it("increments count", async () => {
    const host = new ManifestoHost(counterSchema, {
      initialData: { count: 0 },
    });

    const result = await host.dispatch(createIntent("increment", "intent-1"));

    expect(result.status).toBe("complete");
    expect(result.snapshot.data.count).toBe(1);
  });

  it("handles effects", async () => {
    const host = new ManifestoHost(fetchSchema, {
      initialData: { user: null },
    });

    // Mock effect
    host.registerEffect("api.get", async () => {
      return [{ op: "set", path: "user", value: { id: "1", name: "Test" } }];
    });

    const result = await host.dispatch(createIntent("fetchUser", { id: "1" }, "intent-1"));

    expect(result.status).toBe("complete");
    expect(result.snapshot.data.user).toEqual({ id: "1", name: "Test" });
  });
});
```

### Determinism Testing

```typescript
import { describe, it, expect } from "vitest";
import { ManifestoHost, createIntent, type Runtime } from "@manifesto-ai/host";

describe("Determinism", () => {
  it("produces identical results for same input", async () => {
    const fixedRuntime: Runtime = {
      now: () => 1704067200000,
      randomSeed: () => "fixed-seed",
    };

    const host1 = new ManifestoHost(schema, {
      initialData: { count: 0 },
      runtime: fixedRuntime,
    });

    const host2 = new ManifestoHost(schema, {
      initialData: { count: 0 },
      runtime: fixedRuntime,
    });

    const intent = createIntent("increment", "intent-1");

    const result1 = await host1.dispatch(intent);
    const result2 = await host2.dispatch(intent);

    // Same input → same output
    expect(result1.snapshot.data).toEqual(result2.snapshot.data);
    expect(result1.snapshot.meta.timestamp).toBe(result2.snapshot.meta.timestamp);
  });
});
```

---

## Common Mistakes

### Mistake 1: Throwing in Effect Handlers

```typescript
// ❌ WRONG: Throwing exceptions
host.registerEffect("api.get", async (type, params) => {
  const response = await fetch(params.url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);  // WRONG!
  }
  return [];
});

// ✅ CORRECT: Return error patches
host.registerEffect("api.get", async (type, params) => {
  const response = await fetch(params.url);
  if (!response.ok) {
    return [{ op: "set", path: "error", value: `HTTP ${response.status}` }];
  }
  return [];
});
```

### Mistake 2: Forgetting to Register Effect Handlers

```typescript
// ❌ WRONG: No handler registered
const host = new ManifestoHost(schemaWithEffects, { initialData: {} });
await host.dispatch(intent);  // Will fail or hang

// ✅ CORRECT: Register handler before dispatch
const host = new ManifestoHost(schemaWithEffects, { initialData: {} });
host.registerEffect("api.get", async () => []);
await host.dispatch(intent);
```

### Mistake 3: Domain Logic in Effect Handlers

```typescript
// ❌ WRONG: Domain logic in handler
host.registerEffect("purchase", async (type, params) => {
  if (params.amount > 1000) {  // Business rule in handler!
    return [{ op: "set", path: "approval.required", value: true }];
  }
  // ...
});

// ✅ CORRECT: Domain logic in Flow, handler does IO only
// Flow:
{
  kind: "if",
  cond: { kind: "gt", left: { kind: "get", path: "input.amount" }, right: 1000 },
  then: { kind: "patch", op: "set", path: "approval.required", value: true },
  else: { kind: "effect", type: "payment.process", params: { ... } }
}
```

### Mistake 4: Mutating External State in Handlers

```typescript
// ❌ WRONG: Mutating external state
let cache = {};
host.registerEffect("api.get", async (type, params) => {
  const data = await fetch(params.url).then(r => r.json());
  cache[params.url] = data;  // WRONG! External mutation
  return [];
});

// ✅ CORRECT: Return patches, let Snapshot be the source of truth
host.registerEffect("api.get", async (type, params) => {
  const data = await fetch(params.url).then(r => r.json());
  return [{ op: "set", path: `cache.${params.url}`, value: data }];
});
```

---

## Troubleshooting

### Error: "No handler for effect type X"

**Cause:** Effect handler not registered.

**Solution:**
```typescript
host.registerEffect("X", async () => []);
```

### Error: "HOST_NOT_INITIALIZED"

**Cause:** Dispatch called without initial data.

**Solution:**
```typescript
const host = new ManifestoHost(schema, {
  initialData: {},  // Must provide initial data
});
```

### Error: "LOOP_MAX_ITERATIONS"

**Cause:** Intent processing didn't complete within max iterations.

**Solutions:**
1. Increase max iterations:
   ```typescript
   const host = new ManifestoHost(schema, {
     initialData: {},
     maxIterations: 200,
   });
   ```

2. Check for infinite loops in Flow (missing state guards):
   ```typescript
   // ❌ WRONG: Runs every iteration
   { kind: "patch", op: "set", path: "count", value: { kind: "add", ... } }

   // ✅ CORRECT: State-guarded
   {
     kind: "if",
     cond: { kind: "isNull", arg: { kind: "get", path: "result" } },
     then: { kind: "effect", type: "api.get", ... }
   }
   ```

### Intent Processing Hangs

**Cause:** Effect handler never returns or throws.

**Solution:**
```typescript
host.registerEffect("api.get", async (type, params) => {
  // Always return patches, even on failure
  try {
    const response = await fetch(params.url);
    return [{ op: "set", path: "data", value: await response.json() }];
  } catch (e) {
    return [{ op: "set", path: "error", value: e.message }];
  }
});
```

---

## Quick Reference

### Key APIs

| API | Purpose |
|-----|---------|
| `new ManifestoHost(schema, options)` | Create host instance |
| `createHost(schema, options)` | Factory function (same as above) |
| `host.registerEffect(type, handler)` | Register effect handler |
| `host.dispatch(intent)` | Execute intent |
| `host.getSnapshot()` | Get current snapshot (sync) |
| `host.reset(initialData)` | Reset to new initial data |

### Effect Handler Return

Effect handlers return `Patch[]`:

| Scenario | Return Value |
|----------|--------------|
| Success | Patches that write results |
| Failure | Patches that write error state |
| No-op | Empty array `[]` |

### HostOptions

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `initialData` | `unknown` | - | Initial snapshot data |
| `maxIterations` | `number` | 100 | Max compute iterations |
| `runtime` | `Runtime` | `defaultRuntime` | Time/random provider |
| `env` | `Record` | `{}` | Environment variables |
| `onTrace` | `function` | - | Trace callback |
| `disableAutoEffect` | `boolean` | `false` | For HCTS testing |

---

*End of Guide*
