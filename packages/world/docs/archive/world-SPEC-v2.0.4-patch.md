# World SPEC v2.0.4 Patch Document

> **Patch Target:** World SPEC v2.0.3 → v2.0.4
> **Status:** Draft
> **Date:** 2026-02-03
> **Related:** Core SPEC SCHEMA-RESERVED-1, FDR-APP-INTEGRATION-001 v0.4.1
> **Scope:** Future-proof platform namespace handling
> **Breaking Change:** No

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| `stripPlatformNamespaces()` → $-prefix pattern | Implementation Update | Non-breaking |
| `isPlatformNamespace()` helper | Function Addition | Non-breaking |
| `PLATFORM_NAMESPACE_PREFIX` constant | Constant Addition | Non-breaking |

---

## 1. Changelog Entry

```diff
> **Changelog:**
> - v1.0: Initial release
> - v2.0: Host v2.0.1 Integration, Event-Loop Execution Model alignment
> - v2.0.1: ADR-001 Layer Separation - Event ownership, "Does NOT Know" boundary
> - v2.0.2: Host-World Data Contract - `$host` namespace, deterministic hashing, baseSnapshot via WorldStore
> - v2.0.3: Platform Namespace Extension - `$mel` namespace for Compiler, unified platform namespace policy
+ > - **v2.0.4: Future-proof Platform Namespace - $-prefix pattern for automatic handling of new namespaces**
```

---

## 2. Motivation

### 2.1 Problem

World SPEC v2.0.3 §7.9.1 already states:

> **Convention:** All `$`-prefixed keys in `snapshot.data` are platform-reserved.

However, the implementation (`stripPlatformNamespaces()`) uses explicit destructuring:

```typescript
// v2.0.3 - Explicit listing (requires code change for each new namespace)
const { $host, $mel, ...rest } = data;
```

This creates a maintenance burden when new platform namespaces are introduced (e.g., `$app`, `$trace`).

### 2.2 Solution

Align implementation with the stated convention by using `$`-prefix pattern matching:

```typescript
// v2.0.4 - Prefix pattern (automatically handles future namespaces)
const result = {};
for (const key of Object.keys(data)) {
  if (!key.startsWith('$')) {
    result[key] = data[key];
  }
}
```

### 2.3 Consistency

This change aligns World implementation with:
- **Core SPEC SCHEMA-RESERVED-1**: "All keys starting with `$` are reserved for platform use"
- **FDR-APP-INTEGRATION-001 v0.4.1**: Already uses $-prefix pattern in `toCanonicalSnapshot()`

---

## 3. Section 7.8: `stripPlatformNamespaces()` (Update)

### 3.1 Current Function (v2.0.3)

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

### 3.2 Patched Function (v2.0.4)

```diff
+/**
+ * Platform namespace prefix.
+ *
+ * Per Core SPEC SCHEMA-RESERVED-1 and World SPEC v2.0.3 §7.9.1:
+ * - All $-prefixed keys in snapshot.data are platform-reserved
+ * - Domain schemas MUST NOT define $-prefixed keys
+ *
+ * Known platform namespaces:
+ * - $host: Host-owned state (WORLD-HASH-4a)
+ * - $mel: Compiler-owned guard state (WORLD-HASH-4b)
+ * - Future: $app, $trace, etc. (automatically handled)
+ */
+const PLATFORM_NAMESPACE_PREFIX = "$";
+
+/**
+ * Check if a key is a platform namespace.
+ *
+ * @param key - Key to check
+ * @returns True if key is a platform namespace ($-prefixed)
+ */
+function isPlatformNamespace(key: string): boolean {
+  return key.startsWith(PLATFORM_NAMESPACE_PREFIX);
+}
+
 /**
- * Strip platform-reserved namespaces from data before hashing.
- * WORLD-HASH-4a: data.$host MUST NOT be included in hash.
- * WORLD-HASH-4b: data.$mel MUST NOT be included in hash.
+ * Strip platform namespaces from data before hashing.
+ *
+ * Per Core SPEC SCHEMA-RESERVED-1 and World SPEC v2.0.3 §7.9.1:
+ * - All $-prefixed top-level keys are platform namespaces
+ * - Platform namespaces MUST be excluded from snapshotHash
+ * - This is future-proof for new platform namespaces ($app, $trace, etc.)
+ *
+ * @param data - Data object
+ * @returns Data without platform namespaces
  */
-function stripPlatformNamespaces<T extends Record<string, unknown>>(
-  data: T
-): Omit<T, '$host' | '$mel'> {
-  if (data && typeof data === 'object' && !Array.isArray(data)) {
-    const { $host, $mel, ...rest } = data;
-    return rest as Omit<T, '$host' | '$mel'>;
+function stripPlatformNamespaces(
+  data: Record<string, unknown>
+): Record<string, unknown> {
+  if (data === undefined || data === null) {
+    return {};
   }
-  return data;
+
+  const keys = Object.keys(data);
+  const hasPlatformNamespace = keys.some(isPlatformNamespace);
+
+  if (!hasPlatformNamespace) {
+    return data;
+  }
+
+  const result: Record<string, unknown> = {};
+  for (const key of keys) {
+    if (!isPlatformNamespace(key)) {
+      result[key] = data[key];
+    }
+  }
+  return result;
 }
```

---

## 4. Section 7.9.1: Platform-Reserved Namespaces (Clarification)

### 4.1 Current Text (v2.0.3)

```markdown
| Namespace | Owner | Purpose | Hash Inclusion |
|-----------|-------|---------|----------------|
| `$host` | Host | Error bookkeeping, intent slots, execution context | ❌ Excluded |
| `$mel` | Compiler | Guard state, compiler-generated internal slots | ❌ Excluded |

**Convention:** All `$`-prefixed keys in `snapshot.data` are platform-reserved.
```

### 4.2 Patched Text (v2.0.4)

```diff
 | Namespace | Owner | Purpose | Hash Inclusion |
 |-----------|-------|---------|----------------|
 | `$host` | Host | Error bookkeeping, intent slots, execution context | ❌ Excluded |
 | `$mel` | Compiler | Guard state, compiler-generated internal slots | ❌ Excluded |
+| `$*` (future) | Platform | Reserved for future platform components | ❌ Excluded |

-**Convention:** All `$`-prefixed keys in `snapshot.data` are platform-reserved.
+**Convention:** All `$`-prefixed keys in `snapshot.data` are platform-reserved.
+The implementation uses prefix matching (`key.startsWith('$')`) to automatically
+exclude any future platform namespaces without requiring specification updates.
```

---

## 5. Cross-Reference Updates

| Document | Section | Change |
|----------|---------|--------|
| FDR-APP-INTEGRATION-001 | §3.5.2, §3.6 | Already uses $-prefix pattern (v0.4.1) |
| Core SPEC | SCHEMA-RESERVED-1 | No change needed (already defines `$*`) |
| Host SPEC | HOST-NS-* | No change needed (Host only manages `$host`) |
| Compiler SPEC | COMPILER-MEL-* | No change needed (Compiler only manages `$mel`) |

---

## 6. Test Cases

### 6.1 Future Namespace Exclusion

```typescript
describe('World SPEC v2.0.4: $-prefix pattern', () => {
  it('excludes ALL $-prefixed namespaces from hash', async () => {
    const snapshot = {
      data: {
        count: 42,
        $host: { internal: true },
        $mel: { guards: {} },
        $app: { futureNamespace: true },  // Future
        $trace: { debug: true },           // Future
      },
      // ... other fields
    };

    const hash1 = await computeSnapshotHash(snapshot);

    // Change only platform namespaces
    const snapshot2 = {
      ...snapshot,
      data: {
        count: 42,  // Same domain data
        $host: { internal: false },
        $mel: { guards: { g1: 'i1' } },
        $app: { futureNamespace: false },
        $trace: { debug: false },
      },
    };

    const hash2 = await computeSnapshotHash(snapshot2);

    // Hashes should be identical (platform namespaces excluded)
    expect(hash1).toBe(hash2);
  });

  it('preserves non-$-prefixed keys', () => {
    const data = {
      count: 42,
      _private: { value: 1 },  // Underscore is NOT platform
      normal: 'data',
    };

    const stripped = stripPlatformNamespaces(data);

    expect(stripped).toHaveProperty('_private');
    expect(stripped).toHaveProperty('normal');
    expect(stripped).toHaveProperty('count');
  });
});
```

---

## 7. Migration Guide

### For Implementers

No migration required. This is a non-breaking implementation alignment.

### For Consumers

No changes required. The behavior is semantically identical; only the implementation mechanism changed.

---

## 8. Rationale

| Aspect | Before (v2.0.3) | After (v2.0.4) |
|--------|-----------------|----------------|
| **New namespace** | Requires code + SPEC change | Automatic |
| **Consistency** | Implementation differs from convention | Implementation matches convention |
| **Maintenance** | Manual updates needed | Zero maintenance |
| **Type safety** | `Omit<T, '$host' \| '$mel'>` | `Record<string, unknown>` |

Note: Type safety trade-off is acceptable because platform namespaces are opaque to World layer (it doesn't interpret their contents).

---

## 9. Checklist

- [x] `stripPlatformNamespaces()` uses `key.startsWith('$')` pattern
- [x] `isPlatformNamespace()` helper function added
- [x] `PLATFORM_NAMESPACE_PREFIX` constant defined
- [x] Comments document known namespaces ($host, $mel) and future extensibility
- [x] Tests verify future namespace exclusion
- [ ] Documentation merged into world-SPEC-v2.0.4.md

---

*End of World SPEC v2.0.4 Patch Document*
