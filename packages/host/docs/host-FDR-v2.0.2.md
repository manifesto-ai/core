# Host Contract - Foundational Design Rationale (FDR)

> **Version:** 2.0.2
> **Status:** Normative
> **Purpose:** Document the "Why" behind every constitutional decision in the Host Contract
> **Changelog:**
> - v1.0: Initial release (FDR-H001 ~ H010)
> - v1.x: Compiler Integration, Expression Evaluation (FDR-H011 ~ H017)
> - v2.0: Event-Loop Execution Model (FDR-H018 ~ H022)
> - v2.0.1: Context Determinism (FDR-H023), Compiler/Translator Decoupling (FDR-H024)
> - **v2.0.2: Snapshot Ownership Alignment (FDR-H025)**

---

## Scope

This document is a **normative addendum** to `host-FDR-v2.0.1.md`.
All decisions in v2.0.1 remain in force. This addendum introduces FDR-H025.

---

## Part V: Snapshot Ownership Alignment (v2.0.2)

### Table of Contents (v2.0.2)

| FDR | Title | Key Decision |
|-----|-------|--------------|
| **FDR-H025** | **Snapshot Ownership Alignment** | **Host uses Core Snapshot type; Host-owned state in `$host` (data namespace); Host never writes `system.*`** |

---

## FDR-H025: Snapshot Ownership Alignment (v2.0.2)

### Decision

**Host MUST treat Snapshot as Core-owned schema.**

1. **Host MUST use Core's canonical Snapshot type.**
2. **Host MUST NOT write to Core-owned fields** (`system.status`, `system.lastError`, `system.errors`, `system.currentAction`).
3. **Host-owned state MUST live in `$host` (data namespace)** and be mutated only via standard Patch operations.

These are **non-negotiable constraints**. Any Host that violates them is not Manifesto-compliant.

### Context

The v2.0 execution model introduced strict single-writer semantics. As implementations evolved, Host-specific state began to leak into:
- `system.*` fields (Core-owned), or
- in-memory maps (hidden state not represented in Snapshot).

Both patterns violate the constitutional requirement that **Snapshot is the sole communication channel** (FDR-H002) and create replay gaps. v2.0.2 corrects this by aligning Host to the canonical Snapshot type and enforcing ownership boundaries.

### Rationale

**Ownership clarity preserves determinism and replay:**

- Core computes meaning, so Core owns `system.*`.
- Host executes effects, so Host owns `$host` (data namespace).
- If Host writes `system.*`, it bypasses Core and corrupts the causal chain.
- If Host stores durable state outside Snapshot, replay diverges and debugging becomes non-deterministic.

`$host` provides a **single explicit namespace** for Host state without altering the Core schema.

### Non-negotiables

The following are **hard rules**:

- Host MUST NOT write to `system.status`, `system.lastError`, `system.errors`, or `system.currentAction`.
- Host MUST NOT redefine `Snapshot`, `SnapshotMeta`, or `SystemState` locally.
- Host-owned data MUST be stored under `$host`, never under `system.*`.
- Host error recording MUST go to `$host` (data namespace) or domain-level paths, not to `system.*`.

### Consequences

- Host bookkeeping must be represented in Snapshot (no hidden continuity state).
- Replay and trace determinism are preserved.
- Compliance auditing is straightforward: any Host patch to `system.*` is a violation.

### Forbidden Patterns (Examples)

```typescript
// FORBIDDEN: Host writes Core-owned system fields
core.apply(schema, snapshot, [
  { op: "set", path: "system.lastError", value: errorValue },
]);

// FORBIDDEN: Hidden Host-only continuity state
const intentSlots = new Map(); // not in Snapshot
```

```typescript
// REQUIRED: Host-owned state under $host (data namespace)
core.apply(schema, snapshot, [
  { op: "set", path: "$host.intentSlots", value: slots },
]);
```

### Compliance Checklist (v2.0.2)

- [ ] Host imports Snapshot types from Core only
- [ ] No Host patch writes to `system.*`
- [ ] Host-owned state stored under `$host` (data namespace)
- [ ] Errors recorded in `$host` or domain paths

### Cross-Reference

- Host SPEC v2.0.2: HOST-SNAP-1~4, HOST-NS-1~4, INV-SNAP-1~7
- Core axiom: Snapshot is the sole communication medium
