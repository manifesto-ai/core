# World SPEC v2.0.3 Patch Document

> **Patch Target:** World SPEC v2.0.2 → v2.0.3
> **Status:** Draft
> **Date:** 2026-01-27
> **Related ADR:** ADR-002 (DX 개선 — `$mel` 네임스페이스)
> **Scope:** Platform namespace extension, snapshotHash computation

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| WORLD-HASH-4b (`$mel` exclusion) | Rule Addition | Non-breaking |
| `stripPlatformNamespaces()` | Function Update | Non-breaking |
| NS-PLAT-1~4 (Platform namespace policy) | New Rules | Normative |
| HOST-DATA-6 Extension | Rule Update | Clarification |

---

## 1. Changelog Entry

```diff
> **Changelog:**
> - v1.0: Initial release
> - v2.0: Host v2.0.1 Integration, Event-Loop Execution Model alignment
> - v2.0.1: ADR-001 Layer Separation - Event ownership, "Does NOT Know" boundary
> - v2.0.2: Host-World Data Contract - `$host` namespace, deterministic hashing, baseSnapshot via WorldStore
+ > - **v2.0.3: Platform Namespace Extension - `$mel` namespace for Compiler, unified platform namespace policy**
```

---

## 2. Section 5.5.2: Inclusion/Exclusion Rules (Update)

### 2.1 Current Text (v2.0.2)

```markdown
| Field | Included | Reason | Rule ID |
|-------|----------|--------|---------|
| `snapshot.data` (excluding `$host`) | ✅ MUST | Domain state | WORLD-HASH-1 |
...
| **`data.$host.*`** | ❌ **MUST NOT** | **Host-owned transient state (WorldId divergence risk)** | **WORLD-HASH-4a** |
```

### 2.2 Patched Text (v2.0.3)

```diff
 | Field | Included | Reason | Rule ID |
 |-------|----------|--------|---------|
-| `snapshot.data` (excluding `$host`) | ✅ MUST | Domain state | WORLD-HASH-1 |
+| `snapshot.data` (excluding platform namespaces) | ✅ MUST | Domain state | WORLD-HASH-1 |
 ...
 | **`data.$host.*`** | ❌ **MUST NOT** | **Host-owned transient state (WorldId divergence risk)** | **WORLD-HASH-4a** |
+| **`data.$mel.*`** | ❌ **MUST NOT** | **Compiler-owned internal state (guard markers, etc.)** | **WORLD-HASH-4b** |
```

---

## 3. Section 7.8: World Creation Algorithm (Update)

### 3.1 Current Function (v2.0.2)

```typescript
function stripHostNamespace<T extends Record<string, unknown>>(data: T): Omit<T, '$host'> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const { $host, ...rest } = data;
    return rest as Omit<T, '$host'>;
  }
  return data;
}
```

### 3.2 Patched Function (v2.0.3)

```diff
-function stripHostNamespace<T extends Record<string, unknown>>(data: T): Omit<T, '$host'> {
+/**
+ * Strip platform-owned namespaces from data before hashing.
+ * WORLD-HASH-4a: data.$host MUST NOT be included in hash.
+ * WORLD-HASH-4b: data.$mel MUST NOT be included in hash.
+ */
+function stripPlatformNamespaces<T extends Record<string, unknown>>(
+  data: T
+): Omit<T, '$host' | '$mel'> {
   if (data && typeof data === 'object' && !Array.isArray(data)) {
-    const { $host, ...rest } = data;
-    return rest as Omit<T, '$host'>;
+    const { $host, $mel, ...rest } = data;
+    return rest as Omit<T, '$host' | '$mel'>;
   }
   return data;
 }
```

### 3.3 Usage Update

```diff
   // Compute snapshotHash (deterministic, JCS-based)
-  // WORLD-HASH-4a: MUST exclude data.$host from hash
+  // WORLD-HASH-4a, WORLD-HASH-4b: MUST exclude platform namespaces from hash
   const hashInput: SnapshotHashInput = {
-    data: stripHostNamespace(snapshot.data),  // ← $host excluded
+    data: stripPlatformNamespaces(snapshot.data),  // ← $host, $mel excluded
     system: {
       terminalStatus,
       errors: normalizedErrors,
       pendingDigest,
     },
   };
```

---

## 4. Section 7.9: Host-World Data Contract (Update)

### 4.1 Section 7.9.1: Platform Namespace Convention (v2.0.3)

```diff
-#### 7.9.1 The `$host` Namespace Convention
+#### 7.9.1 Platform Namespace Convention (v2.0.3)

-Host stores its internal execution state in `snapshot.data.$host`. This is a **cross-layer convention** that both Host and World MUST respect.
+Platform layers store their internal state in reserved `$`-prefixed namespaces within `snapshot.data`. This is a **cross-layer convention** that all Manifesto layers MUST respect.

+**Reserved Platform Namespaces:**
+
+| Namespace | Owner | Purpose | Hash Included |
+|-----------|-------|---------|---------------|
+| `$host` | Host | Effect bookkeeping, intent slots | ❌ MUST NOT (WORLD-HASH-4a) |
+| `$mel` | Compiler | Guard state, compiler internals | ❌ MUST NOT (WORLD-HASH-4b) |
+| `$` prefix (general) | Platform | Reserved for future platform use | ❌ MUST NOT |

 ```typescript
+/**
+ * Platform-owned namespaces within snapshot.data
+ */
+
 /**
  * Host-owned namespace within snapshot.data
- *
- * Host uses this namespace to store:
- * - Intent slot state (intentSlots)
- * - Execution context
- * - Other Host-managed transient state
- *
- * This namespace is:
- * - WRITTEN BY: Host (during execution)
- * - READ BY: Host (for re-entry continuity)
- * - EXCLUDED BY: World (from snapshotHash computation)
  */
 type HostNamespace = {
   readonly intentSlots?: Record<string, IntentSlotState>;
-  // Future: other Host-managed state
+  // Other Host-managed transient state
+};
+
+/**
+ * Compiler-owned namespace within snapshot.data
+ * Used by MEL compiler for internal state management.
+ */
+type MelNamespace = {
+  readonly guards?: {
+    readonly intent?: Record<string, string>;  // guardId -> intentId
+    // Future: execution guards when onceExecution is introduced
+  };
 };

 // Convention: Platform layers store state in $-prefixed namespaces
 type SnapshotData = {
   readonly $host?: HostNamespace;  // Host-owned
+  readonly $mel?: MelNamespace;    // Compiler-owned
   // ... domain state (World-owned for hashing)
 };
 ```
```

### 4.2 Section 7.9.3: Contract Rules (v2.0.3)

```diff
 #### 7.9.3 Contract Rules (v2.0.2)
+#### 7.9.3 Contract Rules (v2.0.3)

 | Rule ID | Description |
 |---------|-------------|
 | HOST-DATA-1 | Host MUST store its internal state under `data.$host` namespace |
 | HOST-DATA-2 | Host MUST NOT store internal state in `system.*` namespace |
-| HOST-DATA-3 | World MUST exclude `data.$host` from snapshotHash computation (WORLD-HASH-4a) |
+| HOST-DATA-3 | World MUST exclude platform namespaces from snapshotHash computation (WORLD-HASH-4a, 4b) |
 | HOST-DATA-4 | World MUST NOT interpret or depend on `data.$host` contents |
 | HOST-DATA-5 | App MAY read `data.$host` for debugging/telemetry purposes |
-| HOST-DATA-6 | The `$host` namespace is reserved; domain schemas MUST NOT use `$host` as a key |
+| HOST-DATA-6 | All `$`-prefixed namespaces are reserved; domain schemas MUST NOT use `$`-prefixed keys |
+
+**New Rules (v2.0.3):**
+
+| Rule ID | Description |
+|---------|-------------|
+| NS-PLAT-1 | All `$`-prefixed fields in `snapshot.data` are platform-owned |
+| NS-PLAT-2 | Platform-owned namespaces MUST NOT be included in snapshotHash |
+| NS-PLAT-3 | Domain schemas MUST NOT define fields starting with `$` |
+| NS-PLAT-4 | World MUST use `stripPlatformNamespaces()` before hash computation |
+| MEL-DATA-1 | Compiler MUST store its internal state under `data.$mel` namespace |
+| MEL-DATA-2 | Compiler MUST NOT store internal state in `data.$host` or `system.*` |
```

### 4.3 Section 7.9.4: Implementation (v2.0.3)

```diff
 #### 7.9.4 Implementation

 ```typescript
 /**
- * Strip Host-owned namespace from data before hashing.
- * WORLD-HASH-4a + HOST-DATA-3: data.$host MUST NOT be included in hash.
+ * Strip platform-owned namespaces from data before hashing.
+ * WORLD-HASH-4a: data.$host MUST NOT be included in hash.
+ * WORLD-HASH-4b: data.$mel MUST NOT be included in hash.
  */
-function stripHostNamespace<T extends Record<string, unknown>>(
+function stripPlatformNamespaces<T extends Record<string, unknown>>(
   data: T
-): Omit<T, '$host'> {
+): Omit<T, '$host' | '$mel'> {
   if (data && typeof data === 'object' && !Array.isArray(data)) {
-    const { $host, ...rest } = data;
-    return rest as Omit<T, '$host'>;
+    const { $host, $mel, ...rest } = data;
+    return rest as Omit<T, '$host' | '$mel'>;
   }
   return data;
 }
 ```
```

### 4.4 Section 7.9.5: Cross-Reference (Update)

```diff
 #### 7.9.5 Cross-Reference

 | Layer | Responsibility | `$host` Access | `$mel` Access |
-|-------|---------------|----------------|
-| **Host** | Write intent slots, execution context | Read/Write |
-| **World** | Hash computation, World creation | Exclude from hash |
-| **App** | Debugging, telemetry | Read-only |
-| **Core** | Pure computation | Unaware |
+|-------|---------------|----------------|---------------|
+| **Host** | Write intent slots, execution context | Read/Write | Unaware |
+| **Compiler** | Guard state management | Unaware | Read/Write |
+| **World** | Hash computation, World creation | Exclude | Exclude |
+| **App** | Debugging, telemetry, namespace injection | Read-only | Read-only |
+| **Core** | Pure computation | Unaware | Unaware |
```

---

## 5. Section 10.3: World Invariants (Update)

```diff
 ### 10.3 World Invariants

 | ID | Invariant |
 |----|-----------|
 ...
 | INV-W7 | snapshotHash excludes non-deterministic fields |
+| INV-W16 | snapshotHash excludes all `$`-prefixed platform namespaces |
```

---

## 6. Appendix A.1: Rule Summary (Update)

```diff
 ### A.1 Rule Summary by Category

 | Category | Key Rules |
 |----------|-----------|
 ...
-| Host Data Contract | HOST-DATA-1~6 |
+| Host Data Contract | HOST-DATA-1~6, NS-PLAT-1~4, MEL-DATA-1~2 |
```

---

## 7. Appendix A.5: v2.0.3 Additions Summary (New)

```markdown
### A.6 v2.0.3 Additions Summary (Platform Namespace Extension)

| Addition | Purpose |
|----------|---------|
| WORLD-HASH-4b | `$mel` namespace excluded from hash |
| NS-PLAT-1~4 | Unified platform namespace policy |
| MEL-DATA-1~2 | Compiler namespace ownership rules |
| `stripPlatformNamespaces()` | Replaces `stripHostNamespace()` |

**New Rules (v2.0.3):**

| Rule ID | Description |
|---------|-------------|
| WORLD-HASH-4b | `data.$mel` MUST NOT be included in snapshotHash |
| NS-PLAT-1 | All `$`-prefixed fields in `snapshot.data` are platform-owned |
| NS-PLAT-2 | Platform-owned namespaces MUST NOT be included in snapshotHash |
| NS-PLAT-3 | Domain schemas MUST NOT define fields starting with `$` |
| NS-PLAT-4 | World MUST use `stripPlatformNamespaces()` before hash computation |
| MEL-DATA-1 | Compiler MUST store its internal state under `data.$mel` namespace |
| MEL-DATA-2 | Compiler MUST NOT store internal state in `data.$host` or `system.*` |

**Rationale:**
- `$mel` namespace is used by MEL compiler for internal guard state management
- Guard markers (from `onceIntent` syntax) are implementation details
- Platform namespaces should not affect domain state identity (WorldId)
- Unified policy simplifies future platform namespace additions
```

---

## 8. Appendix C: Migration (Update)

```diff
 ### C.5 New Requirements (v2.0.3)

 | Requirement | Section |
 |-------------|---------|
+| `$mel` namespace exclusion | §5.5.2, §7.8 |
+| NS-PLAT-* rules | §7.9.3 |
+| MEL-DATA-* rules | §7.9.3 |
+| `stripPlatformNamespaces()` function | §7.9.4 |

 ### C.4 Implementation Impact

 | Component | Change Required (v2.0.3) |
 |-----------|--------------------------|
+| Hash computation | Use `stripPlatformNamespaces()` instead of `stripHostNamespace()` |
+| Schema validation | Reject `$`-prefixed field names |
```

---

## 9. Test Cases

```typescript
describe('World SPEC v2.0.3: Platform namespace exclusion', () => {
  describe('WORLD-HASH-4b', () => {
    it('excludes $mel from snapshotHash computation', () => {
      const snap1 = {
        data: {
          count: 1,
          $host: { error: null },
          $mel: { guards: { intent: { a: 'i1' } } }
        },
        system: { status: 'idle', lastError: null, errors: [], pendingRequirements: [] },
      };
      const snap2 = {
        data: {
          count: 1,
          $host: { error: null },
          $mel: { guards: { intent: { b: 'i2', c: 'i3' } } }  // Different $mel
        },
        system: { status: 'idle', lastError: null, errors: [], pendingRequirements: [] },
      };

      const hash1 = computeSnapshotHash(snap1);
      const hash2 = computeSnapshotHash(snap2);

      // Same hash despite different $mel content
      expect(hash1).toBe(hash2);
    });
  });

  describe('stripPlatformNamespaces', () => {
    it('removes both $host and $mel from data', () => {
      const data = {
        count: 1,
        user: { name: 'Alice' },
        $host: { intentSlots: {} },
        $mel: { guards: { intent: {} } },
      };

      const stripped = stripPlatformNamespaces(data);

      expect(stripped).toEqual({ count: 1, user: { name: 'Alice' } });
      expect('$host' in stripped).toBe(false);
      expect('$mel' in stripped).toBe(false);
    });

    it('handles data without platform namespaces', () => {
      const data = { count: 1, user: { name: 'Alice' } };

      const stripped = stripPlatformNamespaces(data);

      expect(stripped).toEqual(data);
    });

    it('handles data with only $host', () => {
      const data = { count: 1, $host: { error: null } };

      const stripped = stripPlatformNamespaces(data);

      expect(stripped).toEqual({ count: 1 });
    });

    it('handles data with only $mel', () => {
      const data = { count: 1, $mel: { guards: {} } };

      const stripped = stripPlatformNamespaces(data);

      expect(stripped).toEqual({ count: 1 });
    });
  });

  describe('WorldId stability', () => {
    it('produces same WorldId for same domain state regardless of $mel', () => {
      const schemaHash = 'schema-abc123';

      const snap1 = createSnapshot({ count: 5 }, { $mel: { guards: { intent: { x: 'i1' } } } });
      const snap2 = createSnapshot({ count: 5 }, { $mel: { guards: { intent: { y: 'i2' } } } });

      const world1 = createWorldFromSnapshot(schemaHash, snap1);
      const world2 = createWorldFromSnapshot(schemaHash, snap2);

      expect(world1.worldId).toBe(world2.worldId);
    });

    it('produces different WorldId for different domain state', () => {
      const schemaHash = 'schema-abc123';

      const snap1 = createSnapshot({ count: 5 }, {});
      const snap2 = createSnapshot({ count: 10 }, {});

      const world1 = createWorldFromSnapshot(schemaHash, snap1);
      const world2 = createWorldFromSnapshot(schemaHash, snap2);

      expect(world1.worldId).not.toBe(world2.worldId);
    });
  });
});
```

---

## 10. Compliance Checklist

- [ ] `stripPlatformNamespaces()` implementation strips both `$host` and `$mel`
- [ ] snapshotHash computation uses `stripPlatformNamespaces()`
- [ ] WorldId remains stable when only `$mel` content changes
- [ ] Domain schema validation rejects `$`-prefixed field definitions
- [ ] `$mel` namespace is documented in platform namespace table

---

*End of World SPEC v2.0.3 Patch Document*
