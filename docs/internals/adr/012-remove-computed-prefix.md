# ADR-012: Remove `computed.` Prefix from Computed Snapshot Keys

> **Status:** Accepted
> **Date:** 2026-03-05
> **Deciders:** Manifesto Core/Compiler Design Group
> **Scope:** Core, Compiler, Host, SDK, Docs
> **Breaking:** Yes
> **Related:** ADR-001 (Layer Separation), ADR-006 (Canonical rules), ADR-009 (Structured PatchPath), ADR-011 (Boundary contract)
> **Reason for change:** Developer Ergonomics / API consistency

---

## 1. Context

Computed keys were stored with a `computed.<name>` prefix (e.g., `snapshot.computed["computed.activeCount"]`).

Since `snapshot.computed` is already a separate top-level namespace, the prefix was redundant — a double-encoding of the namespace. This forced users to know an internal naming convention and made access patterns unnecessarily verbose.

The structural safety guarantees that could justify a prefix were already provided by:
- **ADR-009 (Structured PatchPath):** Patches are rooted at `snapshot.data` only — computed namespace is physically unreachable via patches.
- **Snapshot top-level separation:** `data`, `computed`, `system`, `input`, `meta` are distinct top-level fields.

With near-zero external users and a hard-cut policy in effect, this is the right moment to simplify.

## 2. Decision

### 2.1 Core Change

Remove the `computed.<name>` key convention. `snapshot.computed` keys are now **bare domain names**.

- Before: `snapshot.computed["computed.activeCount"]`
- After: `snapshot.computed["activeCount"]`

### 2.2 Routing Change

The expression evaluator (`evaluateGet`) switches from prefix-based routing (`path.startsWith("computed.")`) to **schema lookup** (`ctx.schema.computed.fields[path] !== undefined`).

### 2.3 Hard Cut Policy

- No backward compatibility (alias, shim, dual-read).
- Snapshots with prefixed keys are treated as invalid.
- All docs, examples, and tests are updated to bare keys.

### 2.4 Scope Exclusions

- **Archive documents** (`docs/archive/`, frozen SPEC versions) — not updated.

## 3. Consequences

### 3.1 Positive

- Simpler access: `snapshot.computed["activeCount"]` is natural.
- Eliminates double-namespace encoding.
- Reduces compiler/core string convention coupling.

### 3.2 Negative

- Breaking change for any code using prefixed keys.
- Archived docs retain old convention (acceptable — they are frozen snapshots).

## 4. Alternatives Considered

| Alternative | Verdict |
|-------------|---------|
| Keep prefix + add user-facing alias | Rejected — adds complexity, conflicts with hard-cut policy |
| Change prefix to shorter form (`_c.`) | Rejected — doesn't solve the fundamental double-encoding issue |
| **Remove prefix (chosen)** | Accepted — simplest, cleanest, aligns with hard-cut window |

## 5. Implementation Summary

| Layer | Files | Changes |
|-------|-------|---------|
| Compiler IR | 2 | Prefix generation removed (3 sites in `ir.ts`, 1 in `expr-node.ts`) |
| Core evaluator | 1 | Prefix routing → schema lookup (`expr.ts`) |
| Core validation | 1 | Prefix check → schema lookup (`validate.ts`, 3 sites) |
| Core explain | 1 | Prefix routing → schema lookup (`explain.ts`) |
| Tests | 12 | Mechanical key replacement |
| Examples | 1 | Access pattern update |
| Governance | 2 | `ComputedRef` type updated (`CLAUDE.md`, `AGENTS.md`) |
| Docs/SPECs | ~16 | Mechanical key and example replacement |
