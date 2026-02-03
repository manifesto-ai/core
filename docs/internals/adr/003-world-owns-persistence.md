# ADR-003: World Owns Persistence

> **Status:** Proposed
> **Date:** 2026-02-03
> **Deciders:** Manifesto Architecture Team
> **Scope:** App, World layer boundaries

---

## Context

### The Problem

Currently, App directly receives and holds `WorldStore` reference:

```typescript
// Current: App receives WorldStore
const app = createApp(domain, {
  _v2Config: {
    host,
    worldStore,      // App holds this
    policyService,
  }
});
```

This creates confusion about ownership:
- **World** is responsible for governance and history (lineage, decisions)
- **WorldStore** is the persistence layer for World's data
- Yet **App** holds the WorldStore reference and passes it around

### Related: ADR-001 Established Layer Boundaries

ADR-001 established:

| Layer | Responsibility |
|-------|---------------|
| **World** | Governance + History (Proposal, Decision, Lineage) |
| **App** | Assembly + Policy + Presentation |

WorldStore is clearly World's persistence concern, not App's.

### Additional Complexity: v1 Legacy Code

App currently maintains two execution paths:

1. **v1 (Legacy):** `DomainExecutor` - direct execution without World
2. **v2:** `V2Executor` → `HostExecutor` → World

v1 is unused in production and adds ~3,000 lines of complexity.

---

## Decision

### 1. World Owns WorldStore

World should receive and own WorldStore:

```typescript
// Proposed: World owns WorldStore
const world = createManifestoWorld({
  schemaHash,
  executor: hostExecutor,
  store: worldStore,      // World owns this
});

const app = createApp(domain, {
  world,                  // App only references World
});
```

### 2. Dependency Direction

```
┌─────────────────────────────────────────────────────────────────┐
│                           User                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     @manifesto-ai/app                           │
│  • User-facing facade                                           │
│  • Schema compilation                                           │
│  • Subscription notifications                                   │
│  • Branch abstraction (DX layer over DAG)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │ App references World (not WorldStore)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    @manifesto-ai/world                          │
│  • Governance + History                                         │
│  • WorldStore ownership ◀── NEW                                 │
│  • Proposal lifecycle                                           │
│  • Lineage (DAG)                                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    @manifesto-ai/host                           │
│  • Execution engine                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Remove v1 Legacy Execution Path

Remove `DomainExecutor` and v1-related code from App:
- `DomainExecutor` class
- v1/v2 conditional paths in `ManifestoApp`
- Associated types and utilities

This simplifies App to v2-only execution via World.

### 4. App's WorldStore Access Pattern

When App needs to query World state (e.g., `getSnapshot`, `getWorld`):

```typescript
// Current: App queries WorldStore directly
async getSnapshot(worldId: WorldId): Promise<Snapshot> {
  return this._v2WorldStore.restore(worldId);
}

// Proposed: App queries through World
async getSnapshot(worldId: WorldId): Promise<Snapshot> {
  return this._world.getSnapshot(worldId);
}
```

### 5. Read-Only Query API Boundary

> **World MUST expose read-only query APIs only; no raw store access leaks upward.**

This principle ensures:

| Rule | Rationale |
|------|-----------|
| World exposes **query methods** (`getSnapshot`, `getWorld`, `getLineage`) | App can read state |
| World does **NOT** expose `getStore()` | No raw store access bypass |
| All mutations go through **governance** (`submitProposal`) | Audit trail preserved |

```typescript
// ALLOWED: Read-only queries
world.getSnapshot(worldId);
world.getWorld(worldId);
world.getLineage();
world.getProposal(proposalId);

// FORBIDDEN: Raw store access
world.getStore();              // ❌ Must not exist
world.store.saveWorld(...);    // ❌ Bypasses governance
```

**Why this matters:**
- Prevents App from bypassing World's governance logic
- All state changes remain auditable through Proposal/Decision
- World maintains invariant control over its persistence

---

## Consequences

### Positive

1. **Clear ownership**
   - World owns persistence (WorldStore)
   - App is purely a facade

2. **Simplified dependency graph**
   - `App → World → WorldStore`
   - No more `App → WorldStore` bypass

3. **Reduced complexity**
   - Remove ~3,000 lines of v1 legacy code
   - Single execution path (v2 only)

4. **Aligned with ADR-001**
   - Reinforces "World = Governance + History"
   - App doesn't need to know persistence details

### Negative

1. **Breaking change for v2 configuration**
   - `createApp({ _v2Config: { worldStore } })` → `createApp({ world })`
   - Migration guide needed

2. **World API surface increases**
   - World must expose query methods that App needs
   - Already partially exists (`getSnapshot`, `getWorld`)

---

## Migration Path

### Phase 1: Add New API (Non-Breaking)

```typescript
// ✅ New: preferred
const app = createApp(domain, { world });

// ✅ Old: still supported (deprecated)
const app = createApp(domain, { _v2Config: { host, worldStore } });

// ❌ FORBIDDEN: both world and _v2Config.worldStore
const app = createApp(domain, {
  world,
  _v2Config: { worldStore },  // Error: ambiguous ownership
});
```

**Conflict Resolution:**
- If both `world` and `_v2Config.worldStore` are provided → **runtime error**
- Error message: `"Cannot provide both 'world' and '_v2Config.worldStore'. Use 'world' only."`
- This prevents "which store do we use?" ambiguity

### Phase 2: Deprecation Warning

Log warning when `_v2Config` is used without `world`.

### Phase 3: Remove Legacy

- Remove `_v2Config.worldStore` support
- Remove `DomainExecutor` (v1)
- Remove v1/v2 conditional logic

---

## Compliance

### What Must Change

| Component | Change Required |
|-----------|-----------------|
| App | Accept `world: ManifestoWorld` in options |
| App | Remove `_v2Config.worldStore` direct usage |
| App | Remove `DomainExecutor` and v1 execution path |
| App | Query World for state, not WorldStore directly |
| World | Ensure all App-needed queries are exposed |
| World | Remove `getStore()` method if exists (no raw store access) |

### What Stays Same

| Component | Unchanged |
|-----------|-----------|
| Core | Pure computation |
| Host | Execution engine |
| World | Governance logic (internal) |
| WorldStore interface | API contract |

---

## Summary

> **World owns its persistence. App is just a facade.**

This decision:
1. Clarifies WorldStore ownership (World, not App)
2. Removes v1 legacy complexity
3. Aligns with ADR-001's layer boundaries
4. Enforces read-only query boundary (no raw store leakage)

One sentence:

> **App references World; World owns WorldStore; no raw store access leaks upward.**
