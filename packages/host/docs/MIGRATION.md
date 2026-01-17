# Migration Guide: v1.x → v2.0.1

> **Purpose:** Step-by-step guide for migrating from Host v1.x to v2.0.1
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

---

## 2. Step-by-Step Migration

### Step 1: Update Package Version

```bash
npm install @manifesto-ai/host@^2.0.1
# or
pnpm add @manifesto-ai/host@^2.0.1
```

### Step 2: Update Host Instantiation

The `createHost()` factory function is still supported. Both patterns work:

```typescript
// v1.x pattern (still works)
import { createHost } from "@manifesto-ai/host";
const host = createHost(schema, { initialData: {}, context: { now: () => Date.now() } });

// v2.0.1 pattern (recommended)
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

// v2.0.1 options
{
  initialData: {},
  runtime: { now: () => Date.now() },  // ✅ Use runtime instead
  env: {},                              // ✅ Environment variables
  onTrace: (event) => {},               // ✅ Trace callback
  maxIterations: 100,                   // ✅ Same
}
```

### Step 3: Update Effect Handler Signatures

The effect handler signature remains the same, but `EffectContext` has been updated:

```typescript
// v1.x handler
host.registerEffect("api.get", async (type, params, context) => {
  const { snapshot, requirement } = context;
  // ...
  return patches;
});

// v2.0.1 handler (same signature, but context type updated)
host.registerEffect("api.get", async (type, params, context) => {
  const { snapshot, requirement } = context;
  // snapshot.meta now includes randomSeed from intentId
  // ...
  return patches;
});
```

### Step 4: Handle ExecutionKey (if using low-level APIs)

If you're using low-level Host APIs, you need to understand `ExecutionKey`:

```typescript
// v2.0.1 low-level API
const key: ExecutionKey = intent.intentId;  // Use intentId as ExecutionKey

// Seed snapshot for an execution
host.seedSnapshot(key, snapshot);

// Submit intent for processing
host.submitIntent(key, intent);

// Drain the mailbox
await host.drain(key);
```

### Step 5: Migrate Translator Integration (CRITICAL)

**This is the most significant change.** If you were using Translator integration via Host, you must migrate to the Bridge/App layer:

#### Before (v1.x - Host handled Translator)

```typescript
// ❌ v1.x: Host processed Translator output directly
// This is no longer supported

// Host internally:
// 1. Received TranslatorFragment[]
// 2. Called lowerPatchFragments()
// 3. Called evaluateConditionalPatchOps()
// 4. Applied patches
```

#### After (v2.0.1 - Bridge/App handles Translator)

```typescript
// ✅ v2.0.1: Bridge/App processes Translator output

import { lowerPatchFragments, evaluateConditionalPatchOps } from '@manifesto-ai/compiler';

// Create a TranslatorAdapter at Bridge/App layer
class TranslatorAdapter {
  async processTranslatorOutput(
    fragments: TranslatorFragment[],
    snapshot: Snapshot,
    context: HostContext
  ): Promise<Patch[]> {
    // Step 1: Lower MEL IR to Core IR
    const conditionalOps = lowerPatchFragments(fragments);

    // Step 2: Evaluate to concrete patches
    const patches = evaluateConditionalPatchOps(conditionalOps, snapshot, context);

    return patches;  // Concrete Patch[] only
  }
}

// Usage
const adapter = new TranslatorAdapter();
const patches = await adapter.processTranslatorOutput(fragments, snapshot, context);

// Submit to Host as concrete Patch[]
host.injectEffectResult(key, requirementId, intentId, patches);
```

### Step 6: Update Persistence (if applicable)

Host no longer manages persistence directly. Snapshot persistence is now the caller's responsibility:

```typescript
// v1.x: Host had built-in store
const host = createHost(schema, {
  store: new MemorySnapshotStore(),  // ❌ Removed
});

// v2.0.1: Caller manages persistence
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

| v1.x | v2.0.1 | Notes |
|------|--------|-------|
| `createHost(schema, options)` | `createHost(schema, options)` | Still works |
| - | `new ManifestoHost(schema, options)` | New class-based API |

### Options

| v1.x Option | v2.0.1 Option | Notes |
|-------------|---------------|-------|
| `initialData` | `initialData` | Same |
| `context: { now }` | `runtime: { now }` | Renamed |
| `store` | - | Removed (external persistence) |
| `maxIterations` | `maxIterations` | Same |
| - | `env` | New: environment variables |
| - | `onTrace` | New: trace callback |
| - | `disableAutoEffect` | New: for HCTS testing |

### Effect Handler API

| v1.x | v2.0.1 | Notes |
|------|--------|-------|
| `registerEffect(type, handler)` | `registerEffect(type, handler)` | Same |
| `registerEffect(type, handler, options)` | `registerEffect(type, handler, options)` | Same |
| - | `unregisterEffect(type)` | New |
| - | `hasEffect(type)` | New |
| - | `getEffectTypes()` | New |

### Dispatch API

| v1.x | v2.0.1 | Notes |
|------|--------|-------|
| `dispatch(intent)` | `dispatch(intent)` | Same |
| `getSnapshot()` → `Promise<Snapshot>` | `getSnapshot()` → `Snapshot | null` | Now synchronous |

### New v2.0.1 APIs (Low-level)

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

v2.0.1 guarantees that `HostContext` is frozen at job start:

```typescript
// All operations in a job see the same timestamp
// This enables deterministic replay

// Before (v1.x): Each call could see different now()
const ctx1 = getContext();  // now = 1000
const ctx2 = getContext();  // now = 1005 (different!)

// After (v2.0.1): Frozen at job start
const frozenContext = createFrozenContext(intentId);
// frozenContext.now is captured once
// frozenContext.randomSeed = intentId (deterministic)
```

### 4.2 Trace Events

v2.0.1 adds comprehensive tracing:

```typescript
const host = new ManifestoHost(schema, {
  initialData: {},
  onTrace: (event) => {
    console.log(event);
    // { t: "job:start", type: "StartIntent", timestamp: 1234567890 }
    // { t: "job:complete", type: "StartIntent", timestamp: 1234567891 }
    // { t: "effect:request", type: "api.get", requirementId: "req-1" }
    // { t: "runner:kick", key: "intent-1", timestamp: 1234567892 }
  },
});
```

### 4.3 Runtime Abstraction

For deterministic testing:

```typescript
import { type Runtime, defaultRuntime } from "@manifesto-ai/host";

// Custom runtime for deterministic tests
const testRuntime: Runtime = {
  now: () => 1704067200000,  // Fixed: 2024-01-01T00:00:00Z
  randomSeed: () => "test-seed",
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


// ========== v2.0.1 ==========
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

### With Translator Migration

```typescript
// ========== v1.x (Translator via Host) ==========
// Host internally processed TranslatorFragment[]
// This is no longer supported


// ========== v2.0.1 (Translator via Bridge/App) ==========
import { ManifestoHost, createIntent } from "@manifesto-ai/host";
import { lowerPatchFragments, evaluateConditionalPatchOps } from "@manifesto-ai/compiler";

const host = new ManifestoHost(schema, { initialData: {} });

// TranslatorAdapter at Bridge/App layer
async function processTranslatorOutput(
  fragments: TranslatorFragment[],
  snapshot: Snapshot,
  context: HostContext
): Promise<Patch[]> {
  const conditionalOps = lowerPatchFragments(fragments);
  return evaluateConditionalPatchOps(conditionalOps, snapshot, context);
}

// When LLM returns TranslatorFragment[]
const llmResult = await translator.translate(prompt);
const patches = await processTranslatorOutput(
  llmResult.fragments,
  host.getSnapshot()!,
  { now: Date.now(), randomSeed: intentId, env: {} }
);

// Inject as concrete patches
host.injectEffectResult(executionKey, requirementId, intentId, patches);
await host.drain(executionKey);
```

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

---

## 7. FAQ

### Q: Do I need to change my effect handlers?

**A:** No, effect handler signatures are compatible. The only change is that `EffectContext.snapshot.meta` now includes `randomSeed`.

### Q: Is `createHost()` deprecated?

**A:** No, `createHost()` is still supported and works the same way. It's a convenience wrapper around `new ManifestoHost()`.

### Q: What if I was using Translator via Host?

**A:** You need to migrate Translator processing to the Bridge/App layer. Host no longer depends on `@manifesto-ai/compiler`. See [Step 5](#step-5-migrate-translator-integration-critical) for details.

### Q: Is the execution model change visible to users?

**A:** Not for most users. The Mailbox + Runner + Job architecture is internal. The `dispatch()` API works the same way.

### Q: How do I test with deterministic time?

**A:** Use the `runtime` option:

```typescript
const host = new ManifestoHost(schema, {
  initialData: {},
  runtime: {
    now: () => 1704067200000,  // Fixed timestamp
    randomSeed: () => "test-seed",
  },
});
```

### Q: What's the benefit of v2.0.1 context determinism?

**A:** Trace replay now produces identical results. The same intent + snapshot always produces the same output, even with time-dependent computed values.

---

## Checklist

Before completing migration, verify:

- [ ] Updated `@manifesto-ai/host` to `^2.0.1`
- [ ] Replaced `context` option with `runtime` (if applicable)
- [ ] Removed `store` option (manage persistence externally)
- [ ] Migrated Translator integration to Bridge/App layer (if applicable)
- [ ] Updated effect handlers if accessing new context fields
- [ ] Tests pass with new API
- [ ] Verified deterministic behavior (same input → same output)

---

*End of Migration Guide*
