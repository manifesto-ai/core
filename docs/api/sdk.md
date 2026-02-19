# @manifesto-ai/sdk

> Public developer API layer for the Manifesto protocol stack

> **Canonical Entry:** SDK is the official public package for new integrations.

---

## Overview

`@manifesto-ai/sdk` is the public API surface for building Manifesto applications.

- `createApp()` — single entry point for app creation
- `ManifestoApp` — thin facade delegating to Runtime
- Hook system with re-entrancy guards and deferred execution

---

## Architecture Role

SDK presents the public contract. All orchestration is delegated to Runtime.

```mermaid
flowchart LR
  U["Application Code"] --> SDK["SDK (createApp, App, Hooks)"]
  SDK --> RT["Runtime (orchestration)"]
  RT --> C["Core"]
  RT --> H["Host"]
  RT --> W["World"]
```

---

## Main Exports

### createApp()

Creates a new Manifesto App instance.

```typescript
import { createApp } from "@manifesto-ai/sdk";

const app = createApp({
  schema: domainSchema,
  effects: {
    "api.save": async (params, ctx) => [
      { op: "set", path: "data.savedAt", value: params.timestamp },
    ],
  },
});

await app.ready();
```

### AppConfig

```typescript
interface AppConfig {
  readonly schema: DomainSchema | string;
  readonly effects: Effects;

  readonly world?: ManifestoWorld;
  readonly policyService?: PolicyService;
  readonly executionKeyPolicy?: ExecutionKeyPolicy;

  readonly memoryStore?: MemoryStore;
  readonly memoryProvider?: MemoryProvider;
  readonly memory?: false | MemoryHubConfig;

  readonly plugins?: readonly AppPlugin[];
  readonly hooks?: Partial<AppHooks>;
  readonly initialData?: unknown;
  readonly actorPolicy?: ActorPolicyConfig;
  readonly systemActions?: SystemActionsConfig;
  readonly validation?: { readonly effects?: "strict" | "warn" | "off" };
}
```

### createTestApp()

Minimal app for testing with in-memory defaults.

```typescript
import { createTestApp } from "@manifesto-ai/sdk";

const app = createTestApp(schema, { effects: {} });
await app.ready();
```

---

## App Interface

### Lifecycle

```typescript
await app.ready();           // Initialize (created → ready)
await app.dispose();         // Shutdown (ready → disposed)
app.status;                  // 'created' | 'ready' | 'disposing' | 'disposed'
```

### Actions

```typescript
const handle = app.act("increment", { by: 1 });
await handle.completed();    // Wait for completion
handle.phase;                // 'queued' | 'executing' | 'completed' | 'rejected' | 'failed'
```

### State Access

```typescript
const state = app.getState<MyState>();
state.data.count;            // Type-safe access

const unsubscribe = app.subscribe(
  (s) => s.data.count,
  (count) => console.log("count changed:", count)
);
```

### Session

```typescript
const session = app.session("user-123");
session.act("increment");    // Actor-scoped action
```

### Branch Management

```typescript
const branch = app.currentBranch();
const branches = app.listBranches();
const forked = await app.fork({ name: "experiment" });
await app.switchBranch(forked.id);
```

---

## Hook System

SDK provides lifecycle hooks with re-entrancy guards.

```typescript
const app = createApp({
  schema,
  effects: {},
  hooks: {
    "app:ready": (ctx) => {
      console.log("App is ready");
    },
    "action:completed": (ctx, result) => {
      // Safe: read-only access via ctx.app
      const state = ctx.app.getState();

      // Safe: deferred execution (runs after hook completes)
      ctx.app.enqueueAction("log.action", { result });
    },
  },
});
```

### AppRef (Read-Only Facade)

Inside hooks, `ctx.app` is an `AppRef` — a read-only facade that prevents re-entrant mutations.

| AppRef Method | Description |
|---------------|-------------|
| `status` | Current app status |
| `getState()` | Read current state |
| `getDomainSchema()` | Read schema |
| `getCurrentHead()` | Read current world head |
| `currentBranch()` | Read current branch |
| `enqueueAction()` | Deferred action (runs after hook) |

---

## Typed Patch Operations

### defineOps\<TData\>()

Creates a type-safe patch builder with IDE autocomplete and compile-time type checking.

```typescript
import { defineOps } from "@manifesto-ai/sdk";

type State = {
  count: number;
  user: { name: string; age: number };
  tags: string[];
};

const ops = defineOps<State>();

ops.set("count", 5);            // OK — value: number
ops.set("user.name", "Alice");  // OK — value: string
ops.merge("user", { age: 30 }); // OK — partial object merge
ops.unset("tags");               // OK

ops.set("count", "wrong");      // TS Error — expected number
ops.set("counnt", 5);           // TS Error — path does not exist
```

### TypedOps\<TData\> Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `set` | `(path, value) → SetPatch` | Replace value at path |
| `unset` | `(path) → UnsetPatch` | Remove value at path |
| `merge` | `(path, value) → MergePatch` | Shallow merge at object path |
| `error` | `(code, message, options?) → SetPatch` | Convenience for `system.lastError` |
| `raw.set` | `(path, value) → SetPatch` | Untyped set (escape hatch) |
| `raw.unset` | `(path) → UnsetPatch` | Untyped unset (escape hatch) |
| `raw.merge` | `(path, value) → MergePatch` | Untyped merge (escape hatch) |

### Type Utilities

| Type | Purpose |
|------|---------|
| `DataPaths<T>` | Union of all valid dot-separated paths from `T` |
| `ValueAt<T, P>` | Resolves the value type at path `P` in `T` |
| `ObjectPaths<T>` | Subset of `DataPaths` — only object paths (valid for merge) |

> See the **[Typed Patch Ops Guide](/guides/typed-patch-ops)** for usage patterns and design characteristics.

---

## Error Types

SDK re-exports error types from Runtime. Key errors:

| Error | When |
|-------|------|
| `AppNotReadyError` | API called before `ready()` |
| `AppDisposedError` | API called after `dispose()` |
| `ReservedEffectTypeError` | User tried to override `system.get` |
| `HookMutationError` | Direct mutation attempted inside hook |

---

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/runtime](./runtime) | Internal orchestration engine (SDK delegates to Runtime) |
| [@manifesto-ai/core](./core) | Pure computation (used by Runtime) |
| [@manifesto-ai/host](./host) | Effect execution (used by Runtime) |
| [@manifesto-ai/world](./world) | Governance and lineage (used by Runtime) |
