# ADR-002 Spec Patches

> **Purpose:** ADR-002 구현을 위한 스펙 문서 변경사항 모음
> **Status:** Ready for Review
> **Related:** ADR-002-dx-improvements-v3.md

---

## 1. World SPEC v2.0.2 → v2.0.3

### 1.1 변경 위치: §7.9 Host-World Data Contract

**Before (v2.0.2):**
```markdown
#### 7.9.1 The `$host` Namespace Convention

Host stores its internal execution state in `snapshot.data.$host`.
```

**After (v2.0.3):**
```markdown
#### 7.9.1 Platform-Reserved Namespaces

Platform components store internal state in reserved namespaces within `snapshot.data`. These namespaces are excluded from World hash computation to ensure semantic equivalence.

| Namespace | Owner | Purpose | Hash Inclusion |
|-----------|-------|---------|----------------|
| `$host` | Host | Error bookkeeping, intent slots, execution context | ❌ Excluded |
| `$mel` | Compiler | Guard state, compiler-generated internal slots | ❌ Excluded |

**Convention:** All `$`-prefixed keys in `snapshot.data` are platform-reserved. Domain schemas MUST NOT use keys starting with `$`.
```

### 1.2 변경 위치: §7.9.3 Contract Rules

**추가:**
```markdown
| Rule ID | Description |
|---------|-------------|
| HOST-DATA-1 | Host MUST store its internal state under `data.$host` namespace |
| HOST-DATA-2 | Host MUST NOT store internal state in `system.*` namespace |
| HOST-DATA-3 | World MUST exclude `data.$host` from snapshotHash computation (WORLD-HASH-4a) |
| HOST-DATA-4 | World MUST NOT interpret or depend on `data.$host` contents |
| HOST-DATA-5 | App MAY read `data.$host` for debugging/telemetry purposes |
| HOST-DATA-6 | Domain schemas MUST NOT use any key starting with `$` |
| **MEL-DATA-1** | **Compiler MUST store guard state under `data.$mel.guards.*` namespace** |
| **MEL-DATA-2** | **World MUST exclude `data.$mel` from snapshotHash computation (WORLD-HASH-4b)** |
| **MEL-DATA-3** | **World MUST NOT interpret or depend on `data.$mel` contents** |
```

### 1.3 변경 위치: §7.5 Snapshot Hash Computation

**Before (v2.0.2):**
```markdown
| Rule ID | Description |
|---------|-------------|
| WORLD-HASH-4a | `data.$host` MUST NOT be included in hash |
```

**After (v2.0.3):**
```markdown
| Rule ID | Description |
|---------|-------------|
| WORLD-HASH-4a | `data.$host` MUST NOT be included in hash |
| **WORLD-HASH-4b** | **`data.$mel` MUST NOT be included in hash** |
```

### 1.4 변경 위치: §7.5.x Implementation (코드 예시)

**Before:**
```typescript
function stripHostNamespace<T extends Record<string, unknown>>(
  data: T
): Omit<T, '$host'> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const { $host, ...rest } = data;
    return rest as Omit<T, '$host'>;
  }
  return data;
}
```

**After:**
```typescript
/**
 * Strip platform-reserved namespaces from data before hashing.
 * WORLD-HASH-4a: data.$host MUST NOT be included in hash.
 * WORLD-HASH-4b: data.$mel MUST NOT be included in hash.
 */
function stripPlatformNamespaces<T extends Record<string, unknown>>(
  data: T
): Omit<T, '$host' | '$mel'> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const { $host, $mel, ...rest } = data;
    return rest as Omit<T, '$host' | '$mel'>;
  }
  return data;
}
```

### 1.5 Changelog Entry

```markdown
## v2.0.3 (2026-01-XX)

### Added
- **WORLD-HASH-4b**: `data.$mel` excluded from snapshot hash computation
- **MEL-DATA-1~3**: Rules for compiler-owned `$mel` namespace
- Platform-reserved namespace concept (`$` prefix)

### Changed
- `stripHostNamespace()` → `stripPlatformNamespaces()` (generalized)
- HOST-DATA-6 extended to cover all `$`-prefixed keys

### Migration
- No breaking changes
- World hash computation automatically excludes `$mel` if present
```

---

## 2. MEL SPEC v0.3.3 Patch

### 2.1 변경 위치: §4.5 Action Declaration (문법 추가)

**Before:**
```ebnf
GuardedStmt     = WhenStmt
                | OnceStmt
```

**After:**
```ebnf
GuardedStmt     = WhenStmt
                | OnceStmt
                | OnceIntentStmt

OnceIntentStmt  = "onceIntent" [ "when" Expression ] "{" { InnerStmt } "}"
```

### 2.2 새 섹션 추가: §4.8 Once-Intent Statement (Per-Intent Idempotency Sugar)

```markdown
### 4.8 Once-Intent Statement (v0.3.4)

```ebnf
OnceIntentStmt  = "onceIntent" [ "when" Expression ] "{" { InnerStmt } "}"
```

`onceIntent` provides **per-intent idempotency** without requiring manual guard field management. It is syntactic sugar that compiles to `once()` with an auto-generated guard in the `$mel` namespace.

**Semantics:**
- The block executes **at most once per intentId**
- Guard state is stored in `$mel.guards.intent.<guardId>`, not in domain state
- No schema pollution: developers don't need to declare guard fields

**Example:**
```mel
action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}

// With condition
action submit() {
  onceIntent when isValid(form) {
    effect api.submit({ data: form, into: result })
  }
}
```

**Desugaring (Conceptual):**
```mel
// Source
onceIntent { patch count = add(count, 1) }

// Desugars to
once($mel.guards.intent.<guardId>) {
  patch $mel.guards.intent.<guardId> = $meta.intentId
  patch count = add(count, 1)
}
```

Where `<guardId>` is computed as `hash(actionName + ":" + blockIndex + ":intent")`.

**Critical Rules:**
- COMPILER-MEL-1: Guard patches MUST use `merge` at `$mel.guards.intent` level (not root `$mel`)
- COMPILER-MEL-2: Desugared `once(X)` argument and first patch path MUST be identical

See FDR-MEL-060 for rationale.
```

### 2.3 새 섹션 추가: §4.8.1 Contextual Keyword

```markdown
#### 4.8.1 `onceIntent` as Contextual Keyword (v0.3.4)

`onceIntent` is a **contextual keyword**, not a reserved keyword. This preserves backward compatibility with existing code that may use `onceIntent` as an identifier.

**Parsing Rules:**

| Context | Token Sequence | Interpretation |
|---------|----------------|----------------|
| Statement start | `onceIntent` `{` | OnceIntentStmt |
| Statement start | `onceIntent` `when` | OnceIntentStmt |
| Elsewhere | `onceIntent` | Identifier |

**Examples:**
```mel
// ✅ Parsed as OnceIntentStmt (keyword)
onceIntent { patch x = 1 }
onceIntent when ready { patch x = 1 }

// ✅ Parsed as identifier (backward compatible)
once(onceIntent) { patch onceIntent = $meta.intentId }
patch onceIntent = "value"
when eq(onceIntent, null) { ... }
```

See FDR-MEL-064 for rationale.
```

### 2.4 변경 위치: §6.1 Scope Resolution (예약 네임스페이스 추가)

**추가:**
```markdown
**Reserved Namespaces (v0.3.4):**

The following paths are reserved for platform use:

| Path Prefix | Owner | Purpose |
|-------------|-------|---------|
| `$host.*` | Host | Execution context, intent slots |
| `$mel.*` | Compiler | Guard state, compiler internals |
| `$meta.*` | Runtime | Intent metadata (read-only) |
| `$input.*` | Runtime | Action parameters (read-only) |
| `$system.*` | Core | System values (read-only in computed) |

**Rule:** Domain identifiers starting with `$` are forbidden (compile error E004).

**Note:** This rule applies to *domain-defined* identifiers. Platform components (Host, Compiler) inject `$host`/`$mel` for their own use. Developers using Host directly may manually add these fields—this is permitted because the fields are *platform-owned*, not domain-owned.
```

### 2.5 변경 위치: §14 Compiler Rules (신규 또는 확장)

```markdown
### 14.X Compiler Rules for `$mel` Namespace (v0.3.4)

| Rule ID | Description |
|---------|-------------|
| COMPILER-MEL-1 | Guard patches for `onceIntent` MUST use `merge` operation at `$mel.guards.intent` path. Root `$mel` merge is FORBIDDEN (shallow merge would overwrite sibling guards). |
| COMPILER-MEL-2 | Desugared `once(X)` argument path and the first `patch` statement path MUST be identical. |
| COMPILER-MEL-3 | `onceIntent` MUST be parsed as contextual keyword: keyword only at statement start followed by `{` or `when`. |

**COMPILER-MEL-1 Rationale:**

Core's `merge` is shallow. If compiler generates:
```typescript
// ❌ WRONG: Root merge overwrites guards
{ op: "merge", path: "$mel", value: { guards: { intent: { a: "i1" } } } }
{ op: "merge", path: "$mel", value: { guards: { intent: { b: "i1" } } } }
// Result: { guards: { intent: { b: "i1" } } } — "a" is lost!
```

Correct approach:
```typescript
// ✅ CORRECT: Map-level merge preserves siblings
{ op: "merge", path: "$mel.guards.intent", value: { a: "i1" } }
{ op: "merge", path: "$mel.guards.intent", value: { b: "i1" } }
// Result: { guards: { intent: { a: "i1", b: "i1" } } }
```
```

### 2.6 Changelog Entry

```markdown
## v0.3.4 (2026-01-XX)

### Added
- `onceIntent` statement for per-intent idempotency without schema pollution
- `onceIntent when <condition>` variant
- Contextual keyword parsing for `onceIntent`
- COMPILER-MEL-1~3 rules for `$mel` namespace handling
- Reserved namespace documentation (`$mel.*`)

### Unchanged
- `once(guard)` behavior unchanged (low-level primitive)
- Existing code using `onceIntent` as identifier continues to work
```

---

## 3. Core SPEC Patch (Schema/Patch 규범)

### 3.1 변경 위치: Patch Operations 정의

**명확화 (이미 있으면 강조):**
```markdown
### X.X.X `merge` Operation

```typescript
{ op: "merge", path: string, value: object }
```

**Semantics:** Shallow merge of `value` into the object at `path`.

- Only top-level keys of `value` are merged
- Nested objects are **replaced**, not recursively merged
- If `path` does not exist or is not an object, behavior is undefined (implementation may error)

**Example:**
```typescript
// State: { a: { x: 1, y: 2 }, b: 3 }
{ op: "merge", path: "a", value: { y: 10, z: 20 } }
// Result: { a: { x: 1, y: 10, z: 20 }, b: 3 }

// CAUTION: Nested objects are replaced, not merged
// State: { config: { db: { host: "a", port: 1 }, cache: { ttl: 60 } } }
{ op: "merge", path: "config", value: { db: { host: "b" } } }
// Result: { config: { db: { host: "b" }, cache: { ttl: 60 } } }
// Note: db.port is LOST because db object was replaced
```

**IMPORTANT:** `merge` is shallow. For deep structures, merge at the appropriate nesting level.
```

### 3.2 변경 위치: Schema Reserved Namespace Policy

**신규 섹션 또는 기존 섹션에 추가:**
```markdown
### X.X Platform-Reserved Namespace Policy

**Rule SCHEMA-RESERVED-1:** All keys in `snapshot.data` starting with `$` are reserved for platform use.

| Prefix | Owner | Examples |
|--------|-------|----------|
| `$host` | Host layer | `$host.intentSlots`, `$host.errors` |
| `$mel` | MEL Compiler | `$mel.guards.intent.*` |
| `$*` (future) | Platform | Reserved for future platform components |

**Rule SCHEMA-RESERVED-2:** Domain schemas MUST NOT define **domain-owned** fields with names starting with `$`.

**Clarification:** This rule prohibits *domain logic* from using `$`-prefixed fields. It does NOT prohibit:
- Platform components (Host, Compiler, App) from injecting `$host`/`$mel`
- Developers manually adding `$host`/`$mel` when using Host directly (required for Host/Compiler operation)

The distinction is **ownership**: `$`-prefixed fields are *platform-owned*, even when manually added by developers for platform components to use.

**Enforcement:**
- Compiler MUST reject domain field names starting with `$` (compile error)
- Schema validation SHOULD reject `$`-prefixed user-defined *domain* fields
- Runtime MAY ignore `$`-prefixed fields in domain logic

**Rationale:** Reserving `$` prefix ensures platform components can extend snapshot structure without collision with domain schemas. See ADR-002 for context.
```

---

## 4. Host SPEC v2.0.2 Migration Guide Patch

### 4.1 변경 위치: Migration Step 3 보강

**Before:**
```markdown
### Step 3: Add `$host` to Schema

Domain schemas MUST include `$host` namespace:

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
```

**After:**
```markdown
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
```

### 4.2 새 섹션: Platform Namespace Auto-Injection

```markdown
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

**Note:** If your MEL code uses `onceIntent`, the compiler generates patches to `$mel.guards.intent.*`. Without `$mel` in your schema, these patches will fail with `PATH_NOT_FOUND`. In this case, add:
```typescript
$mel: { type: 'object', required: false, default: { guards: { intent: {} } } }
```
```

---

## 5. App SPEC v2.0.x (신규 또는 확장)

### 5.1 새 섹션: Platform Namespace Management

```markdown
## X. Platform Namespace Management

App is responsible for managing platform-reserved namespaces in schemas and snapshots.

### X.1 Schema Injection

**Rule APP-NS-1:** `createApp()` MUST apply `withPlatformNamespaces()` to the provided schema.

```typescript
function withPlatformNamespaces(schema: Schema): Schema {
  const fields = { ...schema.state.fields };
  
  // $host: Host-owned namespace
  if (!fields.$host) {
    fields.$host = { type: 'object', required: false, default: {} };
  }
  
  // $mel: Compiler-owned namespace (structured default for guard safety)
  if (!fields.$mel) {
    fields.$mel = { 
      type: 'object', 
      required: false, 
      default: { guards: { intent: {} } }
    };
  }
  
  return { ...schema, state: { ...schema.state, fields } };
}
```

**Rule APP-NS-2:** If `$host` or `$mel` exists but has invalid type, App MUST throw descriptive error.

**Rule APP-NS-3:** If `$host` or `$mel` exists with valid type but no default, App SHOULD add appropriate default with warning.

### X.2 Snapshot Normalization

**Rule APP-NS-4:** On restore/rehydrate, App MUST apply `normalizeSnapshot()` to ensure platform namespace structure.

```typescript
function normalizeSnapshot(snapshot: Snapshot): Snapshot {
  const data = { ...snapshot.data };
  
  // Ensure $host exists
  data.$host = data.$host ?? {};
  
  // Ensure $mel exists with full structure
  if (!data.$mel || typeof data.$mel !== 'object') {
    data.$mel = { guards: { intent: {} } };
  } else {
    const mel = data.$mel as Record<string, unknown>;
    if (!mel.guards || typeof mel.guards !== 'object') {
      mel.guards = { intent: {} };
    } else {
      const guards = mel.guards as Record<string, unknown>;
      if (!guards.intent || typeof guards.intent !== 'object') {
        guards.intent = {};
      }
    }
    data.$mel = mel;
  }
  
  return { ...snapshot, data };
}
```

**Rationale:** Partial `$mel` structures can occur from:
- Manual snapshot editing
- Legacy snapshots before `$mel` introduction
- External persistence systems that prune empty objects

Normalization ensures compiler-generated guard patches never hit `PATH_NOT_FOUND`.

### X.3 Persistence Options

**Rule APP-NS-5:** App SHOULD provide option to strip platform namespaces on persist.

```typescript
interface PersistOptions {
  stripPlatformState?: boolean;  // default: false
}

async function persist(snapshot: Snapshot, options?: PersistOptions): Promise<void> {
  const data = options?.stripPlatformState
    ? stripPlatformNamespaces(snapshot.data)
    : snapshot.data;
  // ...
}
```

**Default is `false`** because:
- Manifesto principle: "Snapshot is the complete truth"
- Stripped guards cause re-execution on replay
- Debugging requires full state visibility
```

### 5.2 Changelog Entry

```markdown
## v2.1.0 (2026-01-XX)

### Added
- `withPlatformNamespaces()`: Auto-inject `$host` and `$mel` into schemas
- `normalizeSnapshot()`: Ensure platform namespace structure on restore
- `PersistOptions.stripPlatformState`: Opt-in platform state stripping
- APP-NS-1~5 rules for platform namespace management

### Changed
- `createApp()` now applies `withPlatformNamespaces()` automatically
- Restore/rehydrate now applies `normalizeSnapshot()` automatically
```

---

## 6. New FDR Entries

### FDR-MEL-060: `onceIntent` Sugar

```markdown
# FDR-MEL-060: `onceIntent` Sugar

## Decision

**`onceIntent` provides per-intent idempotency as syntactic sugar over `once()`, with guard state stored in `$mel.guards.intent.*` instead of domain state.**

## Context

The existing `once(guard)` pattern requires:
1. Declaring guard field in domain schema
2. Writing `patch guard = $meta.intentId` as first statement
3. Understanding FDR-MEL-044 marker rule

This creates DX friction for the common case of "run this block once per intent."

## Rationale

| Concern | `once(guard)` | `onceIntent` |
|---------|---------------|--------------|
| Schema pollution | Guard field in domain | Guard in `$mel` (hidden) |
| Boilerplate | Manual marker patch | Automatic |
| Mental model | "Why save intentId?" | "Once per intent" |
| Advanced patterns | Full control | Use `once()` instead |

**Key insight:** Most `once()` uses are simple per-intent guards. `onceIntent` optimizes this case while `once()` remains for advanced patterns.

## Consequences

- `onceIntent` desugars to `once($mel.guards.intent.<guardId>)` with auto-generated marker patch
- Guard state is excluded from World hash (WORLD-HASH-4b)
- Existing `once()` behavior is unchanged
- Migration is optional (both syntaxes coexist)
```

### FDR-MEL-061: `$mel` Namespace

```markdown
# FDR-MEL-061: `$mel` Namespace

## Decision

**Compiler-owned internal state MUST be stored in `data.$mel`, separate from Host-owned `data.$host`.**

## Context

ADR-002 needed a place to store compiler-generated guard state. Options considered:

| Option | Pros | Cons |
|--------|------|------|
| `$host.__compiler.*` | Single namespace | Violates HOST-DATA-1, role confusion |
| `$runtime` | Neutral name | Ambiguous (Host? Compiler? Both?) |
| `$mel` | Clear ownership | New namespace |

## Rationale

**Separation of concerns:**
- `$host` = Host layer owns it (intent slots, errors, execution context)
- `$mel` = MEL Compiler owns it (guards, future compiler internals)

**Naming:** `$mel` is short for "MEL" (Manifesto Expression Language), making ownership explicit.

**Extensibility:** Future compiler features (e.g., `onceExecution`, debug info) have a clear home.

## Consequences

- World SPEC must exclude `$mel` from hash (WORLD-HASH-4b)
- App must inject `$mel` into schemas (APP-NS-1)
- Domain schemas cannot use `$mel` (SCHEMA-RESERVED-1)
```

### FDR-MEL-063: `$mel` Patch Safety

```markdown
# FDR-MEL-063: `$mel` Patch Safety

## Decision

**Compiler MUST generate guard patches as `merge` at `$mel.guards.intent` level. Root `$mel` merge is FORBIDDEN.**

## Context

Core's `merge` operation is **shallow**. This creates a critical issue:

```typescript
// Action with two onceIntent blocks
// Block 1 generates:
{ op: "merge", path: "$mel", value: { guards: { intent: { a: "i1" } } } }
// Block 2 generates:
{ op: "merge", path: "$mel", value: { guards: { intent: { b: "i1" } } } }

// Result with shallow merge:
{ guards: { intent: { b: "i1" } } }  // "a" is LOST!
```

Lost guards cause:
1. Block 1 sees no guard → executes again
2. Generates same patches → infinite loop potential

## Rationale

**Solution:** Merge at the map level where keys should accumulate:

```typescript
{ op: "merge", path: "$mel.guards.intent", value: { a: "i1" } }
{ op: "merge", path: "$mel.guards.intent", value: { b: "i1" } }
// Result: { guards: { intent: { a: "i1", b: "i1" } } }  // Both preserved!
```

**Defense in depth:**
1. App provides structured default: `$mel = { guards: { intent: {} } }`
2. Compiler uses map-level merge (COMPILER-MEL-1)

## Consequences

- COMPILER-MEL-1 is a MUST rule
- Violation causes silent guard loss → potential infinite loops
- Implementation must be tested with multiple `onceIntent` blocks
```

### FDR-MEL-064: `onceIntent` Contextual Keyword

```markdown
# FDR-MEL-064: `onceIntent` Contextual Keyword

## Decision

**`onceIntent` is a contextual keyword, recognized only at statement start followed by `{` or `when`. Elsewhere it is a regular identifier.**

## Context

The name `onceIntent` is plausible as an existing identifier:

```mel
// Hypothetical existing code
once(onceIntent) {
  patch onceIntent = $meta.intentId
  // ...
}
```

Making `onceIntent` a reserved keyword would break this code, violating SemVer minor compatibility.

## Rationale

**Contextual keyword parsing:**

| Position | Next Token | Interpretation |
|----------|------------|----------------|
| Statement start | `{` | Keyword (OnceIntentStmt) |
| Statement start | `when` | Keyword (OnceIntentStmt) |
| Other | Any | Identifier |

This is unambiguous because:
- `onceIntent {` can only be the new statement (no other production starts with `identifier {`)
- `onceIntent when` can only be the new statement (condition variant)
- `once(onceIntent)` is clearly `once` with identifier argument
- `patch onceIntent` is clearly patch with identifier target

## Consequences

- Backward compatibility preserved (existing `onceIntent` identifiers work)
- SemVer minor release is justified
- Parser complexity is minimal (lookahead for `{` or `when`)
- COMPILER-MEL-3 documents this rule
```

---

## Summary: Files to Modify

| Document | Version | Changes |
|----------|---------|---------|
| World SPEC | v2.0.2 → v2.0.3 | WORLD-HASH-4b, MEL-DATA-1~3, platform namespace concept |
| MEL SPEC | v0.3.3 → v0.3.4 | `onceIntent` syntax, contextual keyword, COMPILER-MEL-1~3 |
| Core SPEC | (clarification) | `merge` is shallow, SCHEMA-RESERVED-1~2 |
| Host SPEC | v2.0.2 (patch) | Migration guide update, auto-injection note |
| App SPEC | v2.0.x → v2.1.0 | APP-NS-1~5, `withPlatformNamespaces`, `normalizeSnapshot` |
| FDR | (new) | FDR-MEL-060, 061, 063, 064 |

---

*End of ADR-002 Spec Patches*
