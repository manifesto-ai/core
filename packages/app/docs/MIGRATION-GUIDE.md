# Migration Guide: @manifesto-ai/app v1.x → v2.0.0

This guide helps you migrate from the legacy `createApp()` API to the new v2 API with injectable Host and WorldStore.

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

| Version | Status |
|---------|--------|
| v2.0.0 | Current - Legacy API deprecated |
| v3.0.0 | Legacy API removed |

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

- [APP-SPEC-v2.0.0.md](./APP-SPEC-v2.0.0.md) - Full specification
- [FDR-APP-INTEGRATION-001](./FDR-APP-INTEGRATION-001-v0.4.0.md) - Integration FDR
- [FDR-APP-POLICY-001](./FDR-APP-POLICY-001-v0.2.3.md) - Policy FDR
