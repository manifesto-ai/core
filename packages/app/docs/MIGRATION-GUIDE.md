# Migration Guide: @manifesto-ai/app

This guide helps you migrate between major versions of `createApp()` API.

**Version History:**
- [v2.3.0 → v2.4.0](#v230--v240-sdkruntime-extraction) — SDK/Runtime extraction (ADR-007)
- [v2.2.0 → v2.3.0](#v220--v230-world-owns-persistence) — World owns persistence (ADR-003)
- [v2.0.0 → v2.2.0](#v200--v220-effects-first-api) — Effects-first API (ADR-APP-002)
- [v1.x → v2.0.0](#v1x--v200-injectable-host) — Injectable Host

---

# v2.3.0 → v2.4.0: SDK/Runtime Extraction

> **Breaking Change:** None
> **Internal Change:** App internals extracted into `@manifesto-ai/sdk` and `@manifesto-ai/runtime`

## Overview

v2.4.0 implements **ADR-007** (SDK/Runtime Split):

| v2.3.0 | v2.4.0 |
|--------|--------|
| Monolithic (~14,000 LOC) | Pure re-export facade (328 LOC) |
| All internals in `app` | Internals in `runtime`, public API in `sdk` |
| Single package | App re-exports from `sdk` + `runtime` |

## No Migration Needed

**The public API is identical.** No code changes are required.

```typescript
// This works exactly the same in v2.3.0 and v2.4.0
import { createApp } from "@manifesto-ai/app";

const app = createApp({
  schema,
  effects: { "api.save": handler },
});

await app.ready();
```

## Advanced: Direct SDK Import (Preview)

During **Phase 1**, `@manifesto-ai/app` remains the canonical entry point. Direct SDK imports are available as a preview:

```typescript
// Preview — may change in Phase 2
import { createApp } from "@manifesto-ai/sdk";
```

> **Note:** SDK/Runtime packages are kickoff-locked per ADR-007. Requirement IDs (`SDK-*`, `RT-*`) are stable, but the packages are not yet promoted to primary entry points.

## Resources

- [ADR-007: SDK/Runtime Split](../../../docs/internals/adr/007-sdk-runtime-split-kickoff.md)
- [sdk-SPEC-v0.1.0](../../sdk/docs/sdk-SPEC-v0.1.0.md)
- [runtime-SPEC-v0.1.0](../../runtime/docs/runtime-SPEC-v0.1.0.md)

---

# v2.2.0 → v2.3.0: World Owns Persistence

> **Breaking Change:** `worldStore` removed from `AppConfig`
> **New Option:** `world?: ManifestoWorld` (optional)

## Overview

v2.3.0 implements **ADR-003** (World Owns Persistence):

| v2.2.0 | v2.3.0 |
|--------|--------|
| `worldStore?: WorldStore` | Removed |
| N/A | `world?: ManifestoWorld` |
| App creates WorldStore | World owns WorldStore internally |

## Quick Migration

```typescript
// Before (v2.2.0)
import { createApp, createInMemoryWorldStore } from "@manifesto-ai/app";

const app = createApp({
  schema,
  effects: { 'api.save': handler },
  worldStore: createInMemoryWorldStore(),  // ❌ Removed
});

// After (v2.3.0) - Simplest form
import { createApp } from "@manifesto-ai/app";

const app = createApp({
  schema,
  effects: { 'api.save': handler },
  // World created internally with InMemoryWorldStore
});

// After (v2.3.0) - Custom World
import { createApp } from "@manifesto-ai/app";
import { createManifestoWorld } from "@manifesto-ai/world";

const customWorld = createManifestoWorld({
  store: createPostgresWorldStore(pgClient),
});

const app = createApp({
  schema,
  effects: { 'api.save': handler },
  world: customWorld,  // ✅ Provide World instance
});
```

## Why This Change?

Per ADR-003, **World owns persistence**:
- WorldStore is World's internal concern
- App should not directly manage WorldStore
- Cleaner separation of concerns

---

# v2.0.0 → v2.2.0: Effects-First API

> **Breaking Change:** `host` removed from `AppConfig`
> **New Requirement:** `effects` is required

## Overview

v2.2.0 implements **ADR-APP-002** (createApp API Simplification):

| v2.0.0 | v2.2.0 |
|--------|--------|
| `host: Host` (required) | Removed (internal) |
| `services?: ServiceMap` | `effects: Effects` (required) |
| `compiler?: Compiler` | Removed (internal) |

## Quick Migration

```typescript
// Before (v2.0.0)
import { createApp, createHost, createInMemoryWorldStore } from "@manifesto-ai/app";

const host = createHost(schema);
host.registerEffect('api.save', async (type, params, ctx) => {
  // ... return patches
});

const app = createApp({
  schema,
  host,          // ❌ Removed
  worldStore,
});

// After (v2.2.0)
import { createApp } from "@manifesto-ai/app";

const app = createApp({
  schema,
  effects: {
    'api.save': async (params, ctx) => {
      // Note: only (params, ctx), not (type, params, ctx)
      return [{ op: 'set', path: 'data.saved', value: true }];
    },
  },
  // host is created internally
});
```

## Effect Handler Signature Change

```typescript
// v2.0.0 (Host EffectHandler)
type HostEffectHandler = (
  type: string,    // ← Removed in v2.2.0
  params: unknown,
  ctx: EffectContext
) => Promise<Patch[]>;

// v2.2.0 (App EffectHandler)
type AppEffectHandler = (
  params: unknown,
  ctx: AppEffectContext  // Simplified context
) => Promise<readonly Patch[]>;
```

## Why This Change?

Per ADR-APP-002:
- Users shouldn't need to understand Host/Compiler internals
- "Vue-level simplicity": just provide schema + effects
- Host is an implementation detail, not a public API

---

# v1.x → v2.0.0: Injectable Host

This section covers the original migration from v1.x legacy API to v2.0.0.

---

## Overview

v2.0.0 introduces a more modular architecture with explicit dependency injection:

| v1.x (Legacy) | v2.0.0 |
|---------------|--------|
| Internal DomainExecutor | Injectable `Host` |
| No state persistence | Injectable `WorldStore` |
| Implicit policy | Configurable `PolicyService` |
| Direct `act()` in hooks | `AppRef.enqueueAction()` |

---

## Quick Start

### Before (v1.x)

```typescript
import { createApp } from "@manifesto-ai/app";

const app = createApp(schema, {
  initialData: { todos: [] },
  services: {
    "api.fetch": async (params, ctx) => {
      const data = await fetch(params.url);
      return ctx.patch("data.result").set(data);
    },
  },
});

await app.ready();
```

### After (v2.0.0)

```typescript
import {
  createApp,
  createInMemoryWorldStore,
} from "@manifesto-ai/app";

// Create Host (implements effect execution)
const host: Host = {
  dispatch: async (snapshot, intent) => {
    // Execute effects and return result
    return { status: "completed", snapshot: newSnapshot };
  },
  registerEffect: (type, handler) => { /* ... */ },
};

// Create WorldStore
const worldStore = createInMemoryWorldStore();

// Create App with v2 config
const app = createApp({
  schema,
  host,
  worldStore,
  initialData: { todos: [] },
});

await app.ready();
```

---

## Step-by-Step Migration

### Step 1: Create a Host Implementation

The `Host` interface replaces the internal DomainExecutor:

```typescript
import type { Host, HostResult, Snapshot, Intent } from "@manifesto-ai/app";

const host: Host = {
  async dispatch(snapshot: Snapshot, intent: Intent): Promise<HostResult> {
    // Your execution logic here
    // This is where effects are evaluated and patches applied

    return {
      status: "completed", // or "failed", "halted"
      snapshot: updatedSnapshot,
    };
  },

  registerEffect(type: string, handler: EffectHandler): void {
    // Register effect handlers
  },

  // Optional: for schema compatibility checks
  getRegisteredEffectTypes(): string[] {
    return ["api.fetch", "api.save", /* ... */];
  },
};
```

### Step 2: Choose a WorldStore

v2 provides `InMemoryWorldStore` for development/testing:

```typescript
import { createInMemoryWorldStore } from "@manifesto-ai/app";

const worldStore = createInMemoryWorldStore();
```

---

## Additional Updates (v2.1.0, Non-breaking)

### Platform Namespaces (`$host`, `$mel`)

From v2.1.0, the App layer treats all `$`-prefixed keys in `snapshot.data` as **platform-reserved**:

- `$host` — Host execution state
- `$mel` — Compiler guard state (used by `onceIntent`)

If you implement a **custom WorldStore**, update your persistence logic to **exclude** these namespaces from:

1. **Canonical hash computation**
2. **Restored snapshots** (App/Host re-seed them at runtime)

**Recommended pattern (pseudo-code):**

```typescript
function stripPlatformNamespaces(data: Record<string, unknown>) {
  const { $host, $mel, ...rest } = data;
  return rest;
}

// Store
const cleanSnapshot = { ...snapshot, data: stripPlatformNamespaces(snapshot.data) };

// Restore
return { ...snapshotFromStore, data: stripPlatformNamespaces(snapshotFromStore.data) };
```

**Note:** If your MEL uses `onceIntent`, you do **not** need to add any guard fields in your schema. The compiler writes guards into `$mel` automatically.

For production, implement your own `WorldStore`:

```typescript
import type { WorldStore, World, WorldDelta, Snapshot } from "@manifesto-ai/app";

const worldStore: WorldStore = {
  async store(world: World, delta: WorldDelta): Promise<void> {
    // Persist to your database
  },

  async restore(worldId: WorldId): Promise<Snapshot> {
    // Reconstruct snapshot from deltas
  },

  async compact(options: CompactOptions): Promise<CompactResult> {
    // Optimize storage
  },
};
```

### Step 3: Configure PolicyService (Optional)

Use built-in policies or create custom ones:

```typescript
import {
  createDefaultPolicyService,
  actorSerialPolicy,
} from "@manifesto-ai/app";

const policyService = createDefaultPolicyService({
  executionKeyPolicy: actorSerialPolicy,
  authorityHandler: async (proposal) => {
    // Custom approval logic
    return { approved: true, scope: createPermissiveScope() };
  },
});

const app = createApp({
  schema,
  host,
  worldStore,
  policyService, // Optional - defaults to auto-approve with warning
});
```

### Step 4: Update Hook Handlers

Replace direct `act()` calls with `enqueueAction()`:

```typescript
// Before (v1.x) - May cause re-entrancy issues
app.hooks.on("action:completed", (payload, ctx) => {
  ctx.app.act("audit.log", { action: payload.type }); // Dangerous!
});

// After (v2.0.0) - Safe re-entrancy
app.hooks.on("action:completed", (payload, ctx) => {
  ctx.app.enqueueAction("audit.log", { action: payload.type }); // Queued safely
});
```

---

## API Changes

### createApp() Signature

```typescript
// v1.x (deprecated, still works)
createApp(schema: DomainSchema, opts?: CreateAppOptions): App;

// v2.0.0 (recommended)
createApp(config: AppConfig): App;

interface AppConfig {
  schema: DomainSchema;
  host: Host;
  worldStore: WorldStore;
  policyService?: PolicyService;
  initialData?: Record<string, unknown>;
  services?: ServiceMap;  // For backward compatibility
  hooks?: Partial<AppHooks>;
  plugins?: AppPlugin[];
}
```

### New v2 Methods

```typescript
// Get current World head
const head: WorldId = app.getCurrentHead();

// Get snapshot for any World
const snapshot: Snapshot = await app.getSnapshot(worldId);

// Get World metadata
const world: World = await app.getWorld(worldId);

// Submit proposal directly (advanced)
const result: ProposalResult = await app.submitProposal(proposal);
```

### New Hook: state:publish

```typescript
app.hooks.on("state:publish", (payload, ctx) => {
  // Fired once per proposal tick with terminal snapshot
  console.log("New World:", payload.worldId);
  console.log("Snapshot:", payload.snapshot);
});
```

---

## Memory Context Freezing

v2 introduces deterministic memory context freezing:

```typescript
import {
  freezeMemoryContext,
  getMemoryContext,
} from "@manifesto-ai/app";

// Freeze context into snapshot (for replay)
const frozenSnapshot = freezeMemoryContext(snapshot, {
  relevantDocs: ["doc1", "doc2"],
});

// Retrieve frozen context (deterministic replay)
const context = getMemoryContext(frozenSnapshot);
```

---

## Schema Compatibility

v2 validates effect handler compatibility on fork:

```typescript
import { validateSchemaCompatibility } from "@manifesto-ai/app";

// Before forking with new schema
const result = validateSchemaCompatibility(newSchema, registeredEffects);

if (!result.compatible) {
  console.error("Missing handlers:", result.missingEffects);
}
```

---

## Backward Compatibility

The legacy API continues to work with a deprecation warning:

```typescript
// This still works but shows console warning
const app = createApp(schema, { initialData: {} });
// Warning: Using legacy createApp() signature. Migrate to v2 API...
```

The warning is suppressed in test environments (`NODE_ENV=test`).

---

## Timeline

| Version | Status | Changes |
|---------|--------|---------|
| v2.3.0 | **Current** | World owns persistence (ADR-003) |
| v2.2.0 | Stable | Effects-first API (ADR-APP-002) |
| v2.0.0 | Deprecated | Injectable Host/WorldStore |
| v1.x | Removed | Legacy DomainExecutor |
| v3.0.0 | Planned | All legacy APIs removed |

---

## Troubleshooting

### "Cannot read properties of undefined"

Ensure your Host's `dispatch` returns a valid `HostResult`:

```typescript
// Must return this structure
return {
  status: "completed",
  snapshot: { /* valid Snapshot */ },
};
```

### "WorldNotFoundError"

Initialize genesis World in WorldStore:

```typescript
const worldStore = createInMemoryWorldStore({
  genesisWorld: { /* ... */ },
  genesisSnapshot: { /* ... */ },
});
```

### Hook re-entrancy issues

Use `enqueueAction()` instead of `act()`:

```typescript
// Wrong
ctx.app.act("action", {});

// Correct
ctx.app.enqueueAction("action", {});
```

---

## Resources

- [APP-SPEC-v2.3.0.md](./APP-SPEC-v2.3.0.md) - Current specification
- [ADR-APP-002-v0.2.0.md](./ADR-APP-002-v0.2.0.md) - createApp API Simplification
- [FDR-APP-INTEGRATION-001](./FDR-APP-INTEGRATION-001-v0.4.1.md) - Integration FDR
- [FDR-APP-POLICY-001](./FDR-APP-POLICY-001-v0.2.3.md) - Policy FDR
