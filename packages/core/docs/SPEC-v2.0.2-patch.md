# Core SPEC v2.0.2 (Patch)

> **Version:** 2.0.2
> **Type:** Patch
> **Status:** Draft
> **Date:** 2026-02-10
> **Base:** v2.0.1 (REQUIRED - read SPEC-v2.0.1-patch.md first)
> **Scope:** Normative note on Snapshot field naming and computed key access semantics
> **Related:** App SPEC v2.3.2 (DX aliases)

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| Normative Note on `data` vs "state" terminology | Clarification | Non-breaking |
| Normative Note on `computed` key access semantics | Clarification | Non-breaking |

---

## 1. §13.2 Structure — Normative Note (Insert after §13.2)

### Normative Note: `data` vs "state" terminology, and computed key access

In this specification, domain-owned mutable state is stored under `snapshot.data`.
Higher-level layers (e.g., MEL or App-level facades) may refer to this conceptually as "state".
This is terminology only.

- Implementations and consumers operating at the **Core/Host boundary** MUST treat `Snapshot` as having the canonical fields:
  `data`, `computed`, `system`, `input`, `meta`.
  In particular, the field name is `data` (not `state`).

- `snapshot.computed` is a **string-keyed map** whose keys are `SemanticPath` values (dot-separated paths such as `computed.doubled` or `summary.total`).
  Therefore, consumers MUST treat `snapshot.computed` as a dictionary/map and access values by string key
  (e.g., `snapshot.computed['computed.doubled']`), not by assuming nested object structure.

- Higher-level layers **MAY** provide derived read-only views or aliases (e.g., `snapshot.state` as an alias of `snapshot.data`,
  or ergonomic aliases for computed keys), but such views **MUST NOT** change the canonical Snapshot contract at the Core/Host boundary.

---

## 2. Rationale

MEL uses `state { ... }` to declare domain fields, and developers naturally expect to read `snapshot.state.count`.
At the Core/Host boundary, however, the canonical field name is `data` (to avoid ambiguity with the broader concept of "system state" which includes `system`, `meta`, etc.).

Similarly, `snapshot.computed` uses `SemanticPath` strings as keys (e.g., `computed.doubled`). These are flat map keys, not nested property paths. App-level aliases may provide `snapshot.computed.doubled` for ergonomic access, but Core/Host consumers must use the canonical string-key form.

This note pins down the intentional design so that:
1. Core/Host/World layers never rename or alias these fields.
2. App-level DX aliases (see App SPEC v2.3.2) are understood as a convenience layer, not a contract change.
3. Consumers who use Core/Host directly understand the canonical access patterns.

---

## 3. Cross-Reference

| Document | Section | Relationship |
|----------|---------|-------------|
| Core SPEC v2.0.0 | §13 Snapshot | Base definition of Snapshot structure |
| Core SPEC v2.0.1 | §2 Reserved Namespaces | `$host`, `$mel` prefix policy |
| App SPEC v2.3.2 | §4 AppState Aliases | DX aliases that depend on this note |
| Host SPEC v2.0.2 | — | Uses canonical Snapshot type from Core |

---

*End of Core SPEC v2.0.2 Patch Document*
