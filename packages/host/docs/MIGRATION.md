# Migration Guide: v1.x → v2.0.2

> **Purpose:** Step-by-step guide for migrating from Host v1.x to v2.0.2
> **Audience:** Developers using @manifesto-ai/host in existing projects

---

## Table of Contents

1. [Breaking Changes Overview](#1-breaking-changes-overview)
2. [Step-by-Step Migration](#2-step-by-step-migration)
3. [API Comparison Table](#3-api-comparison-table)
4. [New Features](#4-new-features)
5. [Code Examples](#5-code-examples)
6. [Deprecation Timeline](#6-deprecation-timeline)
7. [FAQ](#7-faq)

---

## 1. Breaking Changes Overview

### v2.0.0 Breaking Changes

| Change | Impact | Migration Required |
|--------|--------|-------------------|
| Mailbox + Runner + Job execution model | Internal architecture | Low (API mostly compatible) |
| `ExecutionKey` concept | New abstraction | Medium (if using low-level APIs) |
| Effect handler context change | `EffectContext` type | Low |
| `createHost()` still works | Factory function retained | None |

### v2.0.1 Breaking Changes

| Change | Impact | Migration Required |
|--------|--------|-------------------|
| Context frozen per job | Determinism improvement | None (internal) |
| Compiler/Translator decoupling | Host no longer depends on compiler | **High** (if using Translator via Host) |
| `ApplyTranslatorOutput` job deprecated | Translator processing moved | **High** (if using Translator) |

### v2.0.2 Breaking Changes

| Change | Impact | Migration Required |
|--------|--------|-------------------|
| Snapshot ownership alignment (Host MUST NOT write `system.*`) | Medium | **Yes** (if you read Host errors from `system.*`) |
| Host-owned state moved to `data.$host` | High | **Yes** (add `$host` to schema) |
| Effect execution policy defaulted to ORD-SERIAL | Low | Only if you depended on parallel execution |

---

## 2. Step-by-Step Migration

### Step 1: Update Package Version

```bash
npm install @manifesto-ai/host@^2.0.2
# or
pnpm add @manifesto-ai/host@^2.0.2
```

### Step 2: Update Host Instantiation

The `createHost()` factory function is still supported. Both patterns work:

```typescript
// v1.x pattern (still works)
import { createHost } from "@manifesto-ai/host";
const host = createHost(schema, { initialData: {}, context: { now: () => Date.now() } });

// v2.0.2 pattern (recommended)
import { ManifestoHost } from "@manifesto-ai/host";
const host = new ManifestoHost(schema, { initialData: {} });
```

**Changes in options:**

```typescript
// v1.x options
{
  initialData: {},
  context: { now: () => Date.now() },  // ❌ Removed
  store: snapshotStore,                 // ❌ Removed (Host is now stateless)
}

// v2.0.2 options
{
  initialData: {},
  runtime: {
    now: () => Date.now(),
    microtask: (fn) => queueMicrotask(fn),
    yield: () => Promise.resolve(),
  },                                   // ✅ Runtime interface (now/microtask/yield)
  env: {},                              // ✅ Environment variables
  onTrace: (event) => {},               // ✅ Trace callback
  maxIterations: 100,                   // ✅ Same
}
```

### Step 3: `$host` Schema Requirement

Domain schemas MUST allow the `$host` namespace for Host to store its internal state.

**Option A: Using App Layer (Recommended)**

If using `@manifesto/app`, this is **automatic**. The `createApp()` function injects `$host` (and `$mel`) into the schema via `withPlatformNamespaces()`.

```typescript
import { createApp } from '@manifesto/app';

const app = createApp({
  schema: {
    state: {
      fields: {
        count: { type: 'number', default: 0 },
        // $host and $mel are automatically injected
      },
    },
  },
  // ...
});
```

**Option B: Using Host Directly (Manual)**

If using Host without the App layer, you MUST manually add `$host`:

```typescript
const schema = {
  state: {
    fields: {
      // ... domain fields
      $host: { type: 'object', required: false, default: {} },
    },
  },
};
```

**Note:** The `$host` namespace requirement is unchanged. What changes is that App now handles this automatically, reducing boilerplate for most users.

### Platform Namespace Auto-Injection (v2.0.3+)

When using the App layer, platform-reserved namespaces are automatically managed:

| Namespace | Injected By | Default Value |
|-----------|-------------|---------------|
| `$host` | App | `{}` |
| `$mel` | App | `{ guards: { intent: {} } }` |

**Behavior:**
1. `createApp()` calls `withPlatformNamespaces(schema)` internally
2. Missing `$host`/`$mel` fields are added with appropriate defaults
3. On restore/rehydrate, `normalizeSnapshot()` ensures structure integrity

**Direct Host Users:**
If you use Host without App, you are responsible for:
- Adding `$host` to schema manually (MUST)
- Ensuring `$host` exists in restored snapshots (MUST)
- Adding `$mel` with proper structure **if using MEL compiled output with `onceIntent`** (Conditional MUST)
- Avoiding any `$`-prefixed keys in domain state (reserved for platform use)

**Note:** If your MEL code uses `onceIntent`, the compiler generates patches to `$mel.guards.intent.*`. Without `$mel` in your schema, these patches will fail with `PATH_NOT_FOUND`. In this case, add:
```typescript
$mel: { type: 'object', required: false, default: { guards: { intent: {} } } }
```

### Step 4: Update Effect Handler Signatures

The effect handler signature remains the same, but `EffectContext` has been updated:

```typescript
// v1.x handler
host.registerEffect("api.get", async (type, params, context) => {
  const { snapshot, requirement } = context;
  // ...
  return patches;
});

// v2.0.2 handler (same signature, but context type updated)
host.registerEffect("api.get", async (type, params, context) => {
  const { snapshot, requirement } = context;
  // snapshot.meta now includes randomSeed from intentId
  // ...
  return patches;
});
```

Effect handlers MUST NOT return patches targeting `system.*`. Use domain paths or
`$host` for Host-owned error reporting.

### Step 5: Handle ExecutionKey (if using low-level APIs)

If you're using low-level Host APIs, you need to understand `ExecutionKey`:

```typescript
// v2.0.2 low-level API
const key: ExecutionKey = intent.intentId;  // Use intentId as ExecutionKey

// Seed snapshot for an execution
host.seedSnapshot(key, snapshot);

// Submit intent for processing
host.submitIntent(key, intent);

// Drain the mailbox
await host.drain(key);
```

### Step 6: Translator Deprecation (v2.0.2)

Translator is deprecated. Host no longer processes Translator output.
If you still rely on Translator in legacy code, keep it in the App layer and
pass only concrete `Patch[]` to Host. Otherwise remove Translator integration.

### Step 7: Update Persistence (if applicable)

Host no longer manages persistence directly. Snapshot persistence is now the caller's responsibility:

```typescript
// v1.x: Host had built-in store
const host = createHost(schema, {
  store: new MemorySnapshotStore(),  // ❌ Removed
});

// v2.0.2: Caller manages persistence
const host = new ManifestoHost(schema, { initialData: {} });

// Get snapshot from host
const snapshot = host.getSnapshot();

// Persist externally
await myStore.save(snapshot);

// Restore later
const restored = await myStore.get();
host.reset(restored.data);
```

---

## 3. API Comparison Table

### Host Creation

| v1.x | v2.0.2 | Notes |
|------|--------|-------|
| `createHost(schema, options)` | `createHost(schema, options)` | Still works |
| - | `new ManifestoHost(schema, options)` | New class-based API |

### Options

| v1.x Option | v2.0.2 Option | Notes |
|-------------|---------------|-------|
| `initialData` | `initialData` | Same |
| `context: { now }` | `runtime: { now, microtask, yield }` | Renamed |
| `store` | - | Removed (external persistence) |
| `maxIterations` | `maxIterations` | Same |
| - | `env` | New: environment variables |
| - | `onTrace` | New: trace callback |
| - | `disableAutoEffect` | New: for HCTS testing |

### Effect Handler API

| v1.x | v2.0.2 | Notes |
|------|--------|-------|
| `registerEffect(type, handler)` | `registerEffect(type, handler)` | Same |
| `registerEffect(type, handler, options)` | `registerEffect(type, handler, options)` | Same |
| - | `unregisterEffect(type)` | New |
| - | `hasEffect(type)` | New |
| - | `getEffectTypes()` | New |

### Dispatch API

| v1.x | v2.0.2 | Notes |
|------|--------|-------|
| `dispatch(intent)` | `dispatch(intent)` | Same |
| `getSnapshot()` → `Promise<Snapshot>` | `getSnapshot()` → `Snapshot | null` | Now synchronous |

### Low-level APIs (v2.0.x)

| API | Purpose |
|-----|---------|
| `getMailbox(key)` | Get or create mailbox for ExecutionKey |
| `seedSnapshot(key, snapshot)` | Seed snapshot for execution |
| `submitIntent(key, intent)` | Submit intent for processing |
| `injectEffectResult(key, reqId, intentId, patches)` | Inject effect result |
| `drain(key)` | Drain mailbox |
| `getContextSnapshot(key)` | Get snapshot for ExecutionKey |

---

## 4. New Features

### 4.1 Context Determinism

v2.0.1+ guarantees that `HostContext` is frozen at job start:

```typescript
// All operations in a job see the same timestamp
// This enables deterministic replay

// Before (v1.x): Each call could see different now()
const ctx1 = getContext();  // now = 1000
const ctx2 = getContext();  // now = 1005 (different!)

// After (v2.0.1+): Frozen at job start
const frozenContext = createFrozenContext(intentId);
// frozenContext.now is captured once
// frozenContext.randomSeed = intentId (deterministic)
```

### 4.2 Snapshot Ownership Alignment (v2.0.2)

Host-owned state is stored under `data.$host` (use `$host.*` patch paths), and Host never writes `system.*`.
Host error recording must target `$host` or domain-owned paths.

```typescript
// Host-owned errors (example shape)
const patches: Patch[] = [
  {
    op: "merge",
    path: "$host",
    value: {
      lastError: { code: "EFFECT_FAILED", message: "Network error" },
      errors: [{ code: "EFFECT_FAILED", message: "Network error" }],
    },
  },
];
```

### 4.3 Deterministic Effect Ordering (ORD-SERIAL)

Host executes one requirement at a time, in `pendingRequirements` order.
If you want parallel execution, you MUST implement ordered reinjection.

### 4.4 Trace Events

v2.0.1+ adds comprehensive tracing:

```typescript
const host = new ManifestoHost(schema, {
  initialData: {},
  onTrace: (event) => {
    console.log(event);
    // { t: "job:start", jobType: "StartIntent", jobId: "job-1", key: "intent-1" }
    // { t: "job:end", jobType: "StartIntent", jobId: "job-1", key: "intent-1" }
    // { t: "effect:dispatch", effectType: "api.get", requirementId: "req-1", key: "intent-1" }
    // { t: "runner:kick", key: "intent-1", timestamp: 1234567892 }
  },
});
```

### 4.5 Runtime Abstraction

For deterministic testing:

```typescript
import { type Runtime } from "@manifesto-ai/host";

// Custom runtime for deterministic tests
const testRuntime: Runtime = {
  now: () => 1704067200000,  // Fixed: 2024-01-01T00:00:00Z
  microtask: (fn) => fn(),
  yield: () => Promise.resolve(),
};

const host = new ManifestoHost(schema, {
  initialData: {},
  runtime: testRuntime,
});
```

---

## 5. Code Examples

### Basic Migration

```typescript
// ========== v1.x ==========
import { createHost, createIntent } from "@manifesto-ai/host";

const host = createHost(schema, {
  initialData: { count: 0 },
  context: { now: () => Date.now() },
});

host.registerEffect("api.get", async (type, params) => {
  const response = await fetch(params.url);
  return [{ op: "set", path: "data", value: await response.json() }];
});

const intent = createIntent("increment", "intent-1");
const result = await host.dispatch(intent);
const snapshot = await host.getSnapshot();


// ========== v2.0.2 ==========
import { ManifestoHost, createIntent } from "@manifesto-ai/host";

const host = new ManifestoHost(schema, {
  initialData: { count: 0 },
  // runtime is optional - defaults to real time
});

host.registerEffect("api.get", async (type, params) => {
  const response = await fetch(params.url);
  return [{ op: "set", path: "data", value: await response.json() }];
});

const intent = createIntent("increment", "intent-1");
const result = await host.dispatch(intent);
const snapshot = host.getSnapshot();  // Now synchronous
```

### Translator (Deprecated)

Translator is deprecated. Do not build new integrations.
If you must keep legacy usage, isolate it in App and pass only concrete `Patch[]`
to Host.

---

## 6. Deprecation Timeline

| Feature | Status | Removal Version |
|---------|--------|-----------------|
| `context` option (use `runtime`) | Deprecated | v3.0 |
| `store` option | Removed | v2.0 |
| `ApplyTranslatorOutput` job | Removed | v2.0.1 |
| Host Compiler dependency | Removed | v2.0.1 |
| COMP-1, COMP-2, COMP-3, COMP-6 rules | Deprecated | v2.0.1 |
| TRANS-1~4 rules | Deprecated | v2.0.1 |
| Translator package | Deprecated | v2.0.2 |

---

## 7. FAQ

### Q: Do I need to change my effect handlers?

**A:** No, effect handler signatures are compatible. Do not return patches to `system.*`.
If you were recording errors in `system.*`, move them to `$host` or domain paths.

### Q: Is `createHost()` deprecated?

**A:** No, `createHost()` is still supported and works the same way. It's a convenience wrapper around `new ManifestoHost()`.

### Q: What if I was using Translator via Host?

**A:** Translator is deprecated. Remove the integration or keep it isolated in App and pass only concrete `Patch[]` to Host. See [Step 6](#step-6-translator-deprecation-v202).

### Q: Do I need to add `$host` to my schema?

**A:** Yes. Host writes intent slots and host error bookkeeping to `data.$host`.
Add an optional `$host` field with a default `{}` (see Step 3).

### Q: Is the execution model change visible to users?

**A:** Not for most users. The Mailbox + Runner + Job architecture is internal. The `dispatch()` API works the same way.

### Q: How do I test with deterministic time?

**A:** Use the `runtime` option:

```typescript
const host = new ManifestoHost(schema, {
  initialData: {},
  runtime: {
    now: () => 1704067200000,  // Fixed timestamp
    microtask: (fn) => fn(),
    yield: () => Promise.resolve(),
  },
});
```

### Q: What's the benefit of v2.0.1+ context determinism?

**A:** Trace replay now produces identical results. The same intent + snapshot always produces the same output, even with time-dependent computed values.

---

## Checklist

Before completing migration, verify:

- [ ] Updated `@manifesto-ai/host` to `^2.0.2`
- [ ] Added `$host` field to schema with default `{}`
- [ ] Replaced `context` option with `runtime` (if applicable)
- [ ] Removed `store` option (manage persistence externally)
- [ ] Removed Translator integration (deprecated)
- [ ] Stopped writing to `system.*` from Host or effect handlers
- [ ] Updated effect handlers if accessing new context fields
- [ ] Tests pass with new API
- [ ] Verified deterministic behavior (same input → same output)

---

*End of Migration Guide*
