# Manifesto App SPEC v2.0.1 (Patch)

> **Version:** 2.0.1
> **Type:** Patch
> **Status:** Draft
> **Date:** 2026-01-27
> **Base:** v2.0.0 (REQUIRED - read APP-SPEC-v2.0.0.md first)
> **Scope:** Platform Namespace Auto-Injection, Snapshot Normalization
> **ADR:** ADR-002 (DX Improvement - MEL Namespace & onceIntent)

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| APP-NS-1 ~ APP-NS-9 | New Rules | Normative |
| Section 9.4: Platform Namespace Injection | New Section | Normative |
| Section 9.5: Snapshot Normalization | New Section | Normative |
| `withPlatformNamespaces()` | New API | Breaking |
| `normalizeSnapshot()` | New API | Normative |
| `stripPlatformNamespaces()` | Renamed API | Breaking |
| STORE-7/8 extension | Modified Rules | Normative |

---

## 1. Changelog Entry

```diff
> **Changelog:**
> - **v2.0.0 (2025-01-20):** Final polish — HookContext→AppRef, Tick terminology, proposalId pre-allocation
+ > - **v2.0.1 (2026-01-27):** Platform Namespace Auto-Injection ($mel), Snapshot Normalization
```

---

## 2. Section 9 Extension: World Integration

### 9.4 Platform Namespace Injection (NEW)

```markdown
---

### 9.4 Platform Namespace Injection

App layer MUST auto-inject platform-owned namespaces into domain schemas.

#### 9.4.1 Platform Namespaces

| Namespace | Owner | Purpose |
|-----------|-------|---------|
| `$host` | Host | Host-owned transient state |
| `$mel` | Compiler | Compiler-owned guard markers |

#### 9.4.2 Normative Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| APP-NS-1 | MUST | App MUST call `withPlatformNamespaces(schema)` before schema validation |
| APP-NS-2 | MUST NOT | User-provided schema MUST NOT define `$host` or `$mel` in state fields |
| APP-NS-3 | MUST | If user schema contains `$host` or `$mel`, App MUST throw `ReservedNamespaceError` |
| APP-NS-4 | MUST | Injected namespaces MUST be optional (`{ $host?: HostNamespace, $mel?: MelNamespace }`) |
| APP-NS-5 | DEPRECATED | `stripHostNamespace()` is deprecated; use `stripPlatformNamespaces()` |
| APP-NS-6 | SHOULD | App SHOULD warn on first use of deprecated `stripHostNamespace()` |

#### 9.4.3 `withPlatformNamespaces()` API

```typescript
import { z } from 'zod';

/**
 * Platform namespace type definitions.
 */
type HostNamespace = {
  // Host-defined transient state
  [key: string]: unknown;
};

type MelNamespace = {
  readonly guards?: {
    readonly intent?: Record<string, string>;  // guardId -> intentId
  };
};

/**
 * Inject platform-owned namespaces into a Zod schema.
 *
 * MUST be called by App before schema validation (APP-NS-1).
 *
 * @param schema - User-provided Zod schema for domain state
 * @returns Extended schema with $host and $mel namespaces
 * @throws ReservedNamespaceError if schema already defines $host or $mel
 */
function withPlatformNamespaces<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<T & {
  $host: z.ZodOptional<z.ZodType<HostNamespace>>;
  $mel: z.ZodOptional<z.ZodType<MelNamespace>>;
}>;

// Example:
const userSchema = z.object({
  count: z.number(),
  todos: z.array(z.object({ title: z.string() }))
});

const fullSchema = withPlatformNamespaces(userSchema);
// Result type includes:
// { count: number; todos: Todo[]; $host?: HostNamespace; $mel?: MelNamespace }
```

#### 9.4.4 Validation Flow

```
User Schema
     |
     v
+----------------------------------+
| Check for $host or $mel fields   |
| If found → ReservedNamespaceError|
+----------------------------------+
     |
     v
+----------------------------------+
| withPlatformNamespaces(schema)   |
| Inject $host and $mel optionals  |
+----------------------------------+
     |
     v
Full Schema (ready for validation)
```

#### 9.4.5 Error Definition

```typescript
class ReservedNamespaceError extends ManifestoError {
  readonly code = 'RESERVED_NAMESPACE';
  readonly namespace: '$host' | '$mel';
  readonly message: string;

  constructor(namespace: '$host' | '$mel') {
    super(`Namespace '${namespace}' is reserved for platform use`);
    this.namespace = namespace;
  }
}
```
```

---

### 9.5 Snapshot Normalization (NEW)

```markdown
---

### 9.5 Snapshot Normalization

App layer MUST normalize snapshots on restore/rehydrate to ensure platform namespace integrity.

#### 9.5.1 Normative Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| APP-NS-7 | MUST | On snapshot restore, App MUST call `normalizeSnapshot()` |
| APP-NS-8 | MUST | `normalizeSnapshot()` MUST ensure `$mel.guards.intent` exists as empty object if missing |
| APP-NS-9 | MUST | `normalizeSnapshot()` MUST preserve existing guard entries |

#### 9.5.2 `normalizeSnapshot()` API

```typescript
/**
 * Normalize a snapshot to ensure platform namespace structure integrity.
 *
 * Use cases:
 * - Restoring snapshot from persistence
 * - Rehydrating snapshot from serialized form
 * - Migrating snapshot from older version
 *
 * This function is idempotent: calling it multiple times produces same result.
 *
 * @param snapshot - Snapshot to normalize
 * @returns Normalized snapshot with valid $mel structure
 */
function normalizeSnapshot<T extends Snapshot>(snapshot: T): T;

// Implementation behavior:
function normalizeSnapshot<T extends Snapshot>(snapshot: T): T {
  const data = snapshot.data as Record<string, unknown>;

  // Ensure $mel exists
  if (!data.$mel) {
    return {
      ...snapshot,
      data: {
        ...data,
        $mel: { guards: { intent: {} } }
      }
    };
  }

  // Ensure $mel.guards exists
  const $mel = data.$mel as Record<string, unknown>;
  if (!$mel.guards) {
    return {
      ...snapshot,
      data: {
        ...data,
        $mel: { ...$mel, guards: { intent: {} } }
      }
    };
  }

  // Ensure $mel.guards.intent exists
  const guards = $mel.guards as Record<string, unknown>;
  if (!guards.intent) {
    return {
      ...snapshot,
      data: {
        ...data,
        $mel: { ...$mel, guards: { ...guards, intent: {} } }
      }
    };
  }

  // Already normalized
  return snapshot;
}
```

#### 9.5.3 Restore Flow

```
Serialized Snapshot (from persistence/network)
     |
     v
+----------------------------------+
| Parse/deserialize                |
+----------------------------------+
     |
     v
+----------------------------------+
| normalizeSnapshot()              |
| Ensure $mel.guards.intent exists |
+----------------------------------+
     |
     v
Normalized Snapshot (ready for use)
```

#### 9.5.4 Examples

```typescript
// Example 1: Old snapshot without $mel
const oldSnapshot = {
  data: { count: 5 },
  computed: {},
  system: { status: 'idle', pendingRequirements: [], errors: [] },
  input: {},
  meta: { version: 1, timestamp: '...', hash: '...' }
};

const normalized = normalizeSnapshot(oldSnapshot);
// normalized.data.$mel = { guards: { intent: {} } }

// Example 2: Partial $mel (missing guards.intent)
const partialSnapshot = {
  data: {
    count: 5,
    $mel: { guards: {} }  // Missing intent
  },
  // ... other fields
};

const normalized2 = normalizeSnapshot(partialSnapshot);
// normalized2.data.$mel = { guards: { intent: {} } }

// Example 3: Already normalized (idempotent)
const alreadyNormalized = {
  data: {
    count: 5,
    $mel: { guards: { intent: { 'abc123': 'intent-1' } } }
  },
  // ... other fields
};

const result = normalizeSnapshot(alreadyNormalized);
// result === alreadyNormalized (preserves existing guards)
```
```

---

## 3. Section 9.3 Modification: WorldStore Rules

### STORE-7/8 Extension

```diff
| Rule ID | Level | Description |
|---------|-------|-------------|
- | STORE-7 | MUST | `store()` MUST exclude `data.$host` from canonical hash computation |
+ | STORE-7 | MUST | `store()` MUST exclude `data.$host` and `data.$mel` from canonical hash computation |
- | STORE-8 | MUST | `restore()` MUST return Snapshot without `data.$host` (Host re-seeds on execution) |
+ | STORE-8 | MUST | `restore()` MUST return Snapshot without `data.$host` (Host re-seeds on execution); `data.$mel` is preserved and normalized via `normalizeSnapshot()` |
```

**Rationale:**
> `$host` is transient (Host re-seeds on every execution).
> `$mel` is persistent (guards must survive across compute cycles for re-entry safety).
> Both are excluded from hash per World SPEC WORLD-HASH-4a/4b.

---

## 4. API Deprecation: `stripHostNamespace()`

```markdown
---

### 9.6 Deprecated APIs

#### `stripHostNamespace()` (DEPRECATED)

**Status:** Deprecated as of v2.0.1. Use `stripPlatformNamespaces()` instead.

```typescript
/**
 * @deprecated Use stripPlatformNamespaces() instead.
 *
 * This function only strips $host namespace.
 * stripPlatformNamespaces() strips both $host and $mel.
 */
function stripHostNamespace<T extends Record<string, unknown>>(
  data: T
): Omit<T, '$host'>;
```

**Migration:**

```typescript
// Before (deprecated)
const hashableData = stripHostNamespace(snapshot.data);

// After (correct)
const hashableData = stripPlatformNamespaces(snapshot.data);
```

**Rationale:**
> ADR-002 introduced `$mel` namespace which, like `$host`, must be excluded from hash computation.
> A unified `stripPlatformNamespaces()` function is clearer than multiple strip functions.
```

---

## 5. FDR Summary

| FDR | Title |
|-----|-------|
| FDR-APP-023 | Platform namespace auto-injection |
| FDR-APP-024 | Snapshot normalization on restore |
| FDR-APP-025 | stripPlatformNamespaces supersedes stripHostNamespace |

---

## 6. References Update

```diff
### 21.2 Foundational Design Rationales

| FDR | Scope |
|-----|-------|
| FDR-APP-PUB-001 | Tick definition, publish boundary |
| FDR-APP-RUNTIME-001 | Lifecycle, hooks, plugins |
| FDR-APP-INTEGRATION-001 | HostExecutor, WorldStore, maintenance |
| FDR-APP-POLICY-001 | ExecutionKey, authority, scope |
| FDR-APP-EXT-001 | MemoryStore, context freezing |
+ | FDR-APP-023~025 | Platform namespace injection, normalization |
```

---

## 7. Acceptance Criteria

- [ ] `withPlatformNamespaces()` injects `$host` and `$mel` as optional fields
- [ ] Schema validation throws `ReservedNamespaceError` if user defines `$host` or `$mel`
- [ ] `normalizeSnapshot()` ensures `$mel.guards.intent` exists
- [ ] `normalizeSnapshot()` preserves existing guard entries
- [ ] `normalizeSnapshot()` is idempotent
- [ ] `stripHostNamespace()` emits deprecation warning
- [ ] `stripPlatformNamespaces()` strips both `$host` and `$mel`
- [ ] Restored snapshots pass through `normalizeSnapshot()`
- [ ] STORE-7 excludes both `$host` and `$mel` from hash
- [ ] STORE-8 preserves `$mel` on restore (unlike `$host`)

---

*End of Patch Document*
