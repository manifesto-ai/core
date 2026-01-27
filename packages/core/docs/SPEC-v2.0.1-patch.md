# Core SPEC v2.0.1 (Patch)

> **Version:** 2.0.1
> **Type:** Patch
> **Status:** Draft
> **Date:** 2026-01-27
> **Base:** v2.0.0 (REQUIRED - read SPEC-v2.0.0.md first)
> **Scope:** Patch operation clarification, reserved namespace policy
> **ADR:** ADR-002 (DX Improvement - MEL Namespace & onceIntent)

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| `merge` operation clarification | Normative Clarification | Non-breaking |
| Platform-reserved namespace policy | New Rules | Normative |

---

## 1. Patch Operations: `merge` Clarification

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

---

## 2. Platform-Reserved Namespace Policy

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

---

*End of Patch Document*
