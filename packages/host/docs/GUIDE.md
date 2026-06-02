# Host Guide

> **Version:** Current v5-aligned surface
> **Purpose:** Low-level runtime and Host-loop guide for @manifesto-ai/host
> **Prerequisites:** You already know the SDK app path and Core boundary
> **Time to complete:** ~20 minutes

> **Current Contract Note:** This guide follows the current v5-aligned Host surface. Host-facing Snapshot references use `snapshot.state` for domain state and `snapshot.namespaces.host` for Host-owned operational state; accumulated `system.errors` is not part of the current contract.

Most app and agent integrations should use Host through the SDK:

```typescript
const app = createManifesto<TodoDomain>(TodoMel, effects).activate();
await app.action.addTodo.submit("Review docs");
```

Use this guide when you need a custom runtime, Host behavior tests, or
low-level execution-loop debugging.

If your goal is to build a web app, backend route, or agent workflow, read the
main [Guide](../../../docs/guide/introduction.md), [Tutorial](../../../docs/tutorial/index.md),
and [Effect Handlers](../../../docs/guides/effect-handlers.md) first. The rest
of this file intentionally uses raw `DomainSchema`, `Intent`, and Host
execution fixtures.

| You Want To | Read |
|-------------|------|
| Submit app actions and read projected Snapshots | Main Guide + SDK API |
| Fulfill API/database effects in app code | Effect Handlers guide |
| Connect React or agent tools | Integration docs |
| Own or test the compute/effect loop directly | This Host guide |

---

## Table of Contents

1. [Low-Level Fixtures](#low-level-fixtures)
2. [Understanding the Execution Model](#understanding-the-execution-model)
3. [Direct Host Examples](#direct-host-examples)
4. [Effect Handlers](#effect-handlers)
5. [Job Types and Lifecycle](#job-types-and-lifecycle)
6. [Context Determinism](#context-determinism)
7. [Common Patterns](#common-patterns)
8. [Advanced Usage](#advanced-usage)
9. [Testing](#testing)
10. [Common Mistakes](#common-mistakes)
11. [Troubleshooting](#troubleshooting)

---

## Low-Level Fixtures

### Install Only For Direct Host Fixtures

```bash
npm install @manifesto-ai/host @manifesto-ai/core
# or
pnpm add @manifesto-ai/host @manifesto-ai/core
```

### Low-Level Host Fixture

```typescript
import { ManifestoHost, createIntent, type DomainSchema } from "@manifesto-ai/host";

// 1. Define schema
const schema: DomainSchema = {
  id: "example:counter",
  version: "1.0.0",
  hash: "example-hash",
  state: {
    fields: {
      count: { type: "number", required: true, default: 0 },
    },
  },
  actions: {
    increment: {
      flow: {
        kind: "patch",
        op: "set",
        path: [{ kind: "prop", name: "count" }],
        value: { kind: "add", left: { kind: "get", path: "count" }, right: { kind: "lit", value: 1 } },
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
console.log(result.snapshot.state.count); // → 1
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

- One mailbox per `ExecutionKey` (default key is `intent.intentId`; optional `options.key` can override routing)
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
| `StartIntent` | Begin processing a new intent | `dispatch(intent, options?)` |
| `ContinueCompute` | Resume after effect fulfillment | After effect completes |
| `FulfillEffect` | Apply effect results | Effect returns Patch[] |
| `ApplyPatches` | Apply direct patches | Direct patch submission |

---

## Direct Host Examples

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
console.log(host.getSnapshot()?.state.count); // → 1
```

### Use Case 2: Dispatching with Input

**Goal:** Pass input parameters to an action.

```typescript
const schema: DomainSchema = {
  // ...
  actions: {
    addAmount: {
      input: {
        type: "object",
        required: true,
        fields: {
          amount: { type: "number", required: true },
        },
      },
      flow: {
        kind: "patch",
        op: "set",
        path: [{ kind: "prop", name: "count" }],
        value: { kind: "add", left: { kind: "get", path: "count" }, right: { kind: "get", path: "input.amount" } },
      },
    },
  },
};

const host = new ManifestoHost(schema, { initialData: { count: 0 } });

// Dispatch with input
const intent = createIntent("addAmount", { amount: 5 }, "intent-1");
const result = await host.dispatch(intent);

console.log(host.getSnapshot()?.state.count); // → 5
```

### Use Case 3: Handling Multiple Intents

**Goal:** Process intents sequentially.

```typescript
const host = new ManifestoHost(schema, { initialData: { count: 0 } });

// Each intent has a unique intentId
await host.dispatch(createIntent("increment", "intent-1"));
await host.dispatch(createIntent("increment", "intent-2"));
await host.dispatch(createIntent("increment", "intent-3"));

console.log(host.getSnapshot()?.state.count); // → 3
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
      { op: "set", path: [{ kind: "prop", name: "data" }], value: data },
      { op: "set", path: [{ kind: "prop", name: "error" }], value: null },
    ];
  } catch (e) {
    return [
      { op: "set", path: [{ kind: "prop", name: "error" }], value: e.message },
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
      return [{ op: "set", path: [{ kind: "prop", name: "error" }], value: `HTTP ${response.status}` }];
    }
    return [{ op: "set", path: [{ kind: "prop", name: "data" }], value: await response.json() }];
  } catch (e) {
    return [{ op: "set", path: [{ kind: "prop", name: "error" }], value: e.message }];
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
  const computeContext = context.createTransitionContext(job.intent);
  const computed = Core.compute(schema, snapshot, job.intent, computeContext);

  if (computed.pendingRequirements.length > 0) {
    requestEffectExecution(job.intentId, computed.pendingRequirements);
    // Job terminates here. No continuation state.
  }
}
```

---

## Context Determinism

### Why Context Determinism Matters

Host materializes one ADR-027 `Context` at the transition boundary:

```typescript
// ❌ v1.x PROBLEM: Different timestamps within same job
function handleStartIntent(job) {
  const ctx1 = getContext();  // timestamp = 1000
  Core.compute(..., ctx1);

  const ctx2 = getContext();  // timestamp = 1005 (different!)
  Core.compute(..., ctx2);    // Non-deterministic for the same transition!
}

// ✅ v5: Context materialized once per transition attempt
function handleStartIntent(job) {
  const computeContext = createFrozenContext(job.intentId);
  // computeContext.runtime.time.timestamp is captured once
  // computeContext.runtime.random.seed = job.intentId

  Core.compute(..., computeContext);
  Core.compute(..., computeContext);  // Same context on re-entry!
}
```

### Using Deterministic Runtime

For testing with fixed time:

```typescript
import { ManifestoHost, type Runtime } from "@manifesto-ai/host";

// Fixed runtime for deterministic tests
const testRuntime: Runtime = {
  now: () => 1704067200000,  // 2024-01-01T00:00:00Z
  microtask: (fn) => queueMicrotask(fn),
  yield: () => Promise.resolve(),
};

const host = new ManifestoHost(schema, {
  initialData: {},
  runtime: testRuntime,
});

// All jobs will see the same timestamp
const result = await host.dispatch(intent);
// result.snapshot.meta.timestamp === 1704067200000
```

### Runtime Seed and Determinism

The transition context derives `runtime.random.seed` from `intentId`, ensuring deterministic runtime values:

```typescript
// Same intentId -> same runtime.random.seed -> same runtime values
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
        { op: "set", path: [{ kind: "prop", name: "error" }], value: data.message || `HTTP ${response.status}` },
      ];
    }

    return params.targetPath
      ? [{ op: "set", path: params.targetPath, value: data }]
      : [];
  } catch (e) {
    return [{ op: "set", path: [{ kind: "prop", name: "error" }], value: e.message }];
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
      return [{ op: "set", path: [{ kind: "prop", name: "error" }], value: `HTTP ${response.status}` }];
    }

    return [
      { op: "set", path: params.targetPath, value: await response.json() },
    ];
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      return [{ op: "set", path: [{ kind: "prop", name: "error" }], value: "Request timed out" }];
    }
    return [{ op: "set", path: [{ kind: "prop", name: "error" }], value: e.message }];
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

### Custom Context Provider

For advanced Host-owned context materialization control:

```typescript
import {
  ManifestoHost,
  createHostContextProvider,
  type Runtime,
} from "@manifesto-ai/host";

const runtime: Runtime = {
  now: () => Date.now(),
  microtask: (fn) => queueMicrotask(fn),
  yield: () => Promise.resolve(),
};

const contextProvider = createHostContextProvider(runtime, {
  env: { NODE_ENV: "production" },
});

// Use contextProvider in custom execution flows
const computeContext = contextProvider.createFrozenContext("intent-1", {
  NODE_ENV: "production",
});
```

The `HostContextProvider` naming is retained as a Host package compatibility
surface. The canonical Core boundary type is owner-neutral `Context`, and
current Core calls receive that materialized `Context` directly.

### Operational Configuration

`HostOptions.env` is retained for Host-owned provider inspection through
`contextProvider.getEnv()`. It is not injected into Core `Context.external` or
into effect handler context. Capture operational configuration in the handler
closure instead:

```typescript
import { semanticPathToPatchPath } from "@manifesto-ai/core";

const apiConfig = {
  baseUrl: "https://api.example.com",
  apiKey: process.env.API_KEY,
};
const host = new ManifestoHost(schema, {
  initialData: {},
});

host.registerEffect("api.get", async (_type, params) => {
  const response = await fetch(`${apiConfig.baseUrl}${String(params.path)}`, {
    headers: { Authorization: `Bearer ${apiConfig.apiKey}` },
  });

  return [{
    op: "set",
    path: semanticPathToPatchPath("data"),
    value: await response.json(),
  }];
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
      return [{ op: "set", path: [{ kind: "prop", name: "user" }], value: data }];
    };

    const result = await handler("api.get", { url: "/users/123" });

    expect(result).toEqual([
      { op: "set", path: [{ kind: "prop", name: "user" }], value: { id: "123", name: "Test" } },
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
        return [{ op: "set", path: [{ kind: "prop", name: "error" }], value: `HTTP ${response.status}` }];
      }
      return [];
    };

    const result = await handler("api.get", { url: "/users/999" });

    expect(result).toEqual([
      { op: "set", path: [{ kind: "prop", name: "error" }], value: "HTTP 404" },
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
    expect(result.snapshot.state.count).toBe(1);
  });

  it("handles effects", async () => {
    const host = new ManifestoHost(fetchSchema, {
      initialData: { user: null },
    });

    // Mock effect
    host.registerEffect("api.get", async () => {
      return [{ op: "set", path: [{ kind: "prop", name: "user" }], value: { id: "1", name: "Test" } }];
    });

    const result = await host.dispatch(createIntent("fetchUser", { id: "1" }, "intent-1"));

    expect(result.status).toBe("complete");
    expect(result.snapshot.state.user).toEqual({ id: "1", name: "Test" });
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
      microtask: (fn) => queueMicrotask(fn),
      yield: () => Promise.resolve(),
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
    expect(result1.snapshot.state).toEqual(result2.snapshot.state);
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
    return [{ op: "set", path: [{ kind: "prop", name: "error" }], value: `HTTP ${response.status}` }];
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
    return [{ op: "set", path: [{ kind: "prop", name: "approval" }, { kind: "prop", name: "required" }], value: true }];
  }
  // ...
});

// ✅ CORRECT: Domain logic in Flow, handler does IO only
// Flow:
{
  kind: "if",
  cond: { kind: "gt", left: { kind: "get", path: "input.amount" }, right: { kind: "lit", value: 1000 } },
  then: {
    kind: "patch",
    op: "set",
    path: [{ kind: "prop", name: "approval" }, { kind: "prop", name: "required" }],
    value: { kind: "lit", value: true },
  },
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
   { kind: "patch", op: "set", path: [{ kind: "prop", name: "count" }], value: { kind: "add", ... } }

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
    return [{ op: "set", path: [{ kind: "prop", name: "data" }], value: await response.json() }];
  } catch (e) {
    return [{ op: "set", path: [{ kind: "prop", name: "error" }], value: e.message }];
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
| `host.dispatch(intent, options?)` | Execute intent (`options.key` overrides routing key; default is `intent.intentId`) |
| `host.getSnapshot()` | Get current snapshot (sync) |
| `host.reset(snapshot)` | Reset to a full canonical snapshot only (ADR-011) |

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
