# Manifesto App SPEC v2.1.0 (Patch)

> **Version:** 2.1.0
> **Type:** Patch
> **Status:** Draft
> **Date:** 2026-01-27
> **Base:** v2.0.0 (REQUIRED - read APP-SPEC-v2.0.0.md first)
> **Scope:** Platform Namespace Management, Snapshot Normalization
> **ADR:** ADR-002 (DX Improvement - MEL Namespace & onceIntent)

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| APP-NS-1 ~ APP-NS-5 | New Rules | Normative |
| Platform Namespace Management | New Section | Normative |
| `withPlatformNamespaces()` | New API | Non-breaking |
| `normalizeSnapshot()` | New API | Normative |
| `PersistOptions.stripPlatformState` | New Option | Non-breaking |

---

## 1. Changelog Entry

```diff
> **Changelog:**
> - **v2.0.0 (2025-01-20):** Final polish — HookContext→AppRef, Tick terminology, proposalId pre-allocation
+ > - **v2.1.0 (2026-01-27):** Platform Namespace Auto-Injection ($mel), Snapshot Normalization
```

---

## 2. Platform Namespace Management

App is responsible for managing platform-reserved namespaces in schemas and snapshots.

### 2.1 Schema Injection

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

### 2.2 Snapshot Normalization

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
    data.$mel = mel as unknown;
  }
  
  return { ...snapshot, data };
}
```

**Rationale:** Partial `$mel` structures can occur from:
- Manual snapshot editing
- Legacy snapshots before `$mel` introduction
- External persistence systems that prune empty objects

Normalization ensures compiler-generated guard patches never hit `PATH_NOT_FOUND`.

### 2.3 Persistence Options

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

---

*End of Patch Document*
