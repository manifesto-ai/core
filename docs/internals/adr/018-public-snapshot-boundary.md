# ADR-018: Public Snapshot Boundary — User-Facing Snapshot Projection and CanonicalSnapshot Separation

> **Status:** Implemented
> **Date:** 2026-04-03 (v7 — projection runtime, canonical read seam, and docs landed)
> **Deciders:** 정성우, Manifesto Architecture Team
> **Scope:** SDK, Core (documentation only), Runtime Surface, Docs, Snapshot Vocabulary, Failure Observation Contract
> **Resolves:** #320, #364
> **Informs:** #353
> **Related:** ADR-002 ($mel namespace), ADR-015 (Snapshot Ontological Purification), ADR-016 (Merkle Tree Lineage), ADR-017 (Capability Decorator Pattern)

---

## Revision History

| Version | Date | Change |
|---------|------|--------|
| v1 | 2026-04-03 | Initial draft |
| v2 | 2026-04-03 | Resolved initial review blockers: layer-scoped axiom, projection ownership, subscribe diffing, pendingSummary, computed-$* dependency rule |
| v3 | 2026-04-03 | Cross-model review round 1. Removed `pendingSummary` (terminal-only publish boundary conflict + premature effect-kind taxonomy). Added restore input type surface contract. Relaxed PROJ-4 to SHOULD. Tightened computed filtering to transitive closure. Added `system.status` observability caveat. |
| v4 | 2026-04-03 | Cross-model review round 2. Removed `meta.version` from projected Snapshot (canonical version increments on $*-only changes, defeating boundary hardening). Fixed `CanonicalSnapshot<TData>` type honesty (`TData & CanonicalPlatformNamespaces`). |
| v5 | 2026-04-03 | Cross-model review round 3. Resolved pending observation self-contradiction: `system.status` reframed as terminal dispatch outcome (not busy signal), pending observation removed from recommended paths (not observable under terminal-only publish boundary), deferred to future ADR. |
| v6 | 2026-04-03 | Cross-model review round 4. Corrected `system.status` framing from "terminal dispatch outcome" to "last-published snapshot status" (rejected/failed dispatches may not update the snapshot). Removed false claim that current telemetry provides in-flight visibility. |
| v7 | 2026-04-03 | Implemented. Added `getCanonicalSnapshot()`, projected `EffectContext.snapshot`, projected `subscribe()` semantics, canonical `getWorldSnapshot()`, and updated maintained docs. Removed obsolete SDK factory restore-key discussion; current v3 base factory remains restore-free. |

---

## 1. Context

### 1.1 The Current Surface Overloads One Word with Too Many Roles

The term **Snapshot** currently serves as:

1. the complete substrate exchanged across Core/Host boundaries
2. the object ordinary users read through `getSnapshot()`
3. the substrate used for persistence / restore
4. the substrate used for snapshot hashing and lineage identity
5. the object developers inspect during debugging

These are not the same concern.

The overloading creates two categories of confusion:

- **Boundary confusion** — users can observe host/compiler residue and orchestration state through the same surface they use for ordinary application logic
- **Meaning confusion** — users naturally assume the value returned from `getSnapshot()` is the same object that defines hash identity, restore substrate, and full runtime truth

### 1.2 #320 Exposes a Boundary Leak

Issue #320 identifies that the primary snapshot-reading path exposes internal runtime details too easily. Application code, APIs, or UI payloads may accidentally treat internal host/system state as a stable public contract.

This is dangerous because internal runtime state must remain free to evolve. Once routinely consumed through the default read surface, it becomes a de facto public API.

### 1.3 #364 Exposes a Failure Observation Split

Issue #364 identifies a related problem: multiple meaningful observation surfaces exist for failure-like information — especially `data.$host.*`-based runtime residue and `snapshot.system.lastError`.

Downstream integrations must currently make semantic decisions that the framework itself should make:

- Which failure surface is the recommended public one?
- Which fields are current state versus runtime bookkeeping?
- Which path should ordinary apps rely on?

### 1.4 The Existing Architecture Already Distinguishes These Categories

This ADR does not invent a new ontology. It makes an existing one explicit.

ADR-015 classifies Snapshot fields into ontological categories:

- **Essence** — what the snapshot fundamentally is
- **Projection** — derived read model
- **Process** — runtime progression state
- **Transient** — compute-cycle scoped data
- **Envelope / Binding** — metadata and schema linkage

That classification makes clear that not every field belongs equally on the default user-facing read surface.

Likewise, platform-reserved namespaces already live under `data.$*`, while top-level partitions (`system`, `input`, `meta`) are structural Snapshot partitions, not user domain state.

### 1.5 The Problem Is Not That the Full Substrate Is Wrong

The complete substrate remains necessary. Manifesto requires it for:

- deterministic compute/apply boundaries
- host execution continuity
- persistence / restore
- hashing and lineage
- deep debugging and forensic inspection

The problem is that ordinary application developers read the substrate directly by default, with no separation between infrastructure-relevant fields and application-relevant fields.

### 1.6 Design Goal

Manifesto should present:

- **Snapshot** as the ordinary user-facing state surface
- **CanonicalSnapshot** as the advanced substrate for persistence, restore, hashing, and deep inspection

Ordinary users should not need to understand runtime residue to build web apps or agents successfully. Advanced users should still be able to reach the full substrate intentionally.

---

## 2. Decision

### 2.1 Layer-Scoped Truth Axiom

The Core SPEC axiom **"If it's not in Snapshot, it doesn't exist"** expresses a protocol-layer truth: at the Core/Host boundary, the full substrate is the sole communication medium. This ADR does not weaken that axiom.

However, that axiom cannot be forwarded verbatim to SDK consumers. A user calling `getSnapshot()` is not operating at the Core/Host boundary — they are operating at the **application boundary**, where a curated read model is both sufficient and safer.

This ADR establishes **layer-scoped truth rules:**

| Layer | Axiom | Substrate |
|-------|-------|-----------|
| **Core / Host** | "If it's not in CanonicalSnapshot, it doesn't exist." | `CanonicalSnapshot` — the full substrate. All fields. Single communication medium. |
| **SDK / Application** | "Snapshot is everything your application needs to observe. Infrastructure state exists but is not your concern by default." | `Snapshot` — the curated projection. Sufficient for UI, agents, and application logic. |
| **Lineage / Persistence** | "CanonicalSnapshot is the persistence and identity substrate." | `CanonicalSnapshot` — what gets hashed, sealed, stored, and restored. |

**Normative constraint:** Documentation at the Core/Host layer MUST use "CanonicalSnapshot" when referring to the full substrate. Documentation at the SDK/application layer MUST use "Snapshot" when referring to the default read model. Mixing the two terms without qualification is a documentation defect.

### 2.2 Vocabulary Split

| Term | Meaning |
|------|---------|
| **Snapshot** | The default user-facing read model returned by ordinary runtime APIs |
| **CanonicalSnapshot** | The full substrate used for Core/Host boundaries, persistence, restore, hashing, and deep debugging |

The word **Snapshot** is reserved for the ordinary user-facing surface.
The word **CanonicalSnapshot** is used for the full internal substrate.

### 2.3 `getSnapshot()` Returns User-Facing Snapshot

`getSnapshot()` returns the default user-facing Snapshot, not the full CanonicalSnapshot.

The returned shape MUST be sufficient for ordinary application development:

- rendering UI
- making agent decisions
- observing current error state
- observing high-level runtime status
- reacting to state changes

It MUST NOT expose runtime residue or low-level orchestration state by default.

### 2.4 `getCanonicalSnapshot()` Is the Advanced Substrate API

A new advanced API is introduced:

```typescript
getCanonicalSnapshot(): CanonicalSnapshot
```

This API exists for advanced consumers who intentionally need the full substrate:

- persistence / restore tooling
- hashing / lineage-related tooling
- host/runtime debugging
- forensic inspection
- infrastructure-level adapters

This API is not the default path for ordinary application code.

### 2.5 Default Snapshot Shape

The default user-facing Snapshot includes:

```typescript
type Snapshot<TData = unknown> = {
  /** Domain data — platform-owned $* namespaces excluded */
  readonly data: TData;

  /** Computed values — only those whose transitive dependency graph
      references no data.$* path (see §2.9) */
  readonly computed: Record<string, unknown>;

  /** System state — curated for application use */
  readonly system: {
    readonly status: 'idle' | 'computing' | 'pending' | 'error';
    readonly lastError: ErrorValue | null;
  };

  /** Snapshot metadata — curated for application use */
  readonly meta: {
    readonly schemaHash: string;
  };
};
```

**Inclusion rationale:**

| Field | Ontological Class | Why included |
|-------|-------------------|-------------|
| `data` (non-$*) | Essence | The domain state itself |
| `computed` (filtered) | Projection | Derivable from domain Essence + Schema |
| `system.status` | Process (exception) | The status carried by the last published snapshot — reflects what state the world was in when the snapshot was published, not live in-flight transitions (see §2.11) |
| `system.lastError` | Essence | Current error state — the recommended public failure surface |
| `meta.schemaHash` | Binding | Structural identity — needed by tooling, schema-aware UIs, and migration detection |

**Why `system.status` is an exception to its ontological class:** ADR-015 classified `status` as Process, but it serves an essential application-facing role as the status of the last published snapshot. Without it, consumers would have no synchronous way to distinguish a world that completed successfully from one that ended in an error or pending suspension. This is a pragmatic exception, similar to the `pendingDigest` hash inclusion rationale in ADR-015 INV-015-3. See §2.11 for the observability contract and its limits.

**Why `meta.version` is NOT included:** See §2.12.

**What else is NOT included:** `pendingRequirements` (the full `Requirement[]` array) is excluded from Snapshot. Consumers who need to know what effects are pending MUST use `getCanonicalSnapshot()`. The rationale for not providing a summarized form in Snapshot is given in §2.13.

### 2.6 Projection Ownership: SDK Layer

The projection from CanonicalSnapshot to Snapshot is **owned by the SDK layer**.

```
Core ──(CanonicalSnapshot)──▶ Host ──(CanonicalSnapshot)──▶ SDK ──(Snapshot)──▶ Application
                                                              ▲
                                                     projection happens here
```

**Rationale:**

- Core and Host must not be burdened with consumer-facing concerns. Their contract is the full substrate.
- The SDK already owns the public surface (`getSnapshot()`, `subscribe()`, `on()`). Projection is a natural extension of that ownership.
- Projection logic changes independently of Core/Host protocol evolution. Placing it in the SDK keeps protocol packages at zero change.

**Implementation contract:**

| Rule ID | Level | Description |
|---------|-------|-------------|
| PROJ-1 | MUST | The SDK activated instance MUST internally hold the CanonicalSnapshot and produce the Snapshot projection on read |
| PROJ-2 | MUST | The projection MUST be computed lazily or cached — not on every canonical state change |
| PROJ-3 | MUST | The projection function MUST be pure: `project(canonical: CanonicalSnapshot): Snapshot` |
| PROJ-4 | SHOULD | `getCanonicalSnapshot()` SHOULD return the same object the SDK holds internally without copy overhead. Implementations MAY apply freeze, proxy, or other read-barriers if needed for safety, but SHOULD avoid full cloning. |
| PROJ-5 | MUST NOT | The projection MUST NOT allocate a new Snapshot object if the canonical change does not affect any projected field |

**PROJ-5 rationale:** This is the key performance contract. If `data.$host` changes but no projected field changes, the cached Snapshot reference is reused. This makes `Object.is` equality on the projected Snapshot a valid change-detection signal, and ensures that `subscribe()` listeners do not fire for infrastructure-only changes (see §2.14).

### 2.7 CanonicalSnapshot Shape and Type Honesty

CanonicalSnapshot preserves the current full substrate shape. However, its `data` type must honestly reflect the inclusion of platform-owned `$*` namespaces.

```typescript
/**
 * Platform-owned namespaces that live inside canonical data
 * alongside domain state. These are NOT part of TData.
 */
type CanonicalPlatformNamespaces = {
  readonly $host?: Record<string, unknown>;
  readonly $mel?: Record<string, unknown>;
  readonly [k: `$${string}`]: unknown;
};

type CanonicalSnapshot<TData = unknown> = {
  /** Domain data + platform-owned $* namespaces */
  readonly data: TData & CanonicalPlatformNamespaces;

  /** All computed values, including $*-dependent ones */
  readonly computed: Record<SemanticPath, unknown>;

  readonly system: {
    readonly status: 'idle' | 'computing' | 'pending' | 'error';
    readonly lastError: ErrorValue | null;
    readonly pendingRequirements: readonly Requirement[];
    readonly currentAction: string | null;
  };

  /** Compute-cycle scoped input */
  readonly input: unknown;

  readonly meta: {
    readonly version: number;
    readonly timestamp: number;
    readonly randomSeed: string;
    readonly schemaHash: string;
  };
};
```

**Type honesty rule:**

| Rule ID | Level | Description |
|---------|-------|-------------|
| TYPE-1 | MUST | `Snapshot<TData>.data` is typed as `TData` — pure domain data, no `$*` namespaces |
| TYPE-2 | MUST | `CanonicalSnapshot<TData>.data` is typed as `TData & CanonicalPlatformNamespaces` — domain data plus platform namespaces |
| TYPE-3 | MUST NOT | `Snapshot` and `CanonicalSnapshot` MUST NOT share the same `data` type. The projection strips `$*`; the type must reflect this. |

**Rationale:** The projected Snapshot's `data` is `TData` — the user's domain type as declared in their schema. The canonical substrate's `data` is `TData & CanonicalPlatformNamespaces` because the full substrate includes platform-owned namespaces that the user did not declare. Using the same `TData` for both would be a type-level lie: the canonical data is structurally wider than the projected data. TYPE-3 makes this a normative constraint, not just a convention.

This ADR does not weaken the canonical substrate. It changes the default read boundary and ensures the types honestly reflect the boundary.

### 2.8 Default Exclusions from Snapshot

The default Snapshot MUST NOT expose the following:

| Excluded | Ontological Class | Rationale |
|----------|-------------------|-----------|
| `data.$host` | Platform-owned | Host runtime residue, not domain state |
| `data.$mel` | Platform-owned | Compiler/language runtime residue |
| Any future `data.$*` | Platform-owned | Reserved platform namespace |
| `system.pendingRequirements` | Process | Full orchestration detail (see §2.13) |
| `system.currentAction` | Process | Compute-loop intermediate state |
| `input` | Transient | Compute-cycle scoped; not meaningful outside active computation |
| `meta.version` | Envelope | Canonical version; increments on $*-only changes (see §2.12) |
| `meta.timestamp` | Envelope | Execution context detail, not app-facing state |
| `meta.randomSeed` | Envelope | Execution context detail, not app-facing state |

### 2.9 Computed Field Filtering: The $* Transitive Dependency Rule

**Problem:** A computed expression may reference `data.$host` or `data.$mel`. If such a computed field appears in the projected Snapshot, it becomes an indirect leak of platform-owned state.

Further, if computed field A depends on computed field B, and B depends on `data.$host`, then A also leaks platform state transitively.

**Rule:**

| Rule ID | Level | Description |
|---------|-------|-------------|
| PROJ-COMP-1 | MUST | The SDK projection MUST include only computed fields whose **transitive** dependency closure references no `data.$*` path |
| PROJ-COMP-2 | MUST NOT | Computed fields whose transitive dependency closure references **any** `data.$*` path MUST NOT appear in the projected Snapshot |
| PROJ-COMP-3 | MUST | `getCanonicalSnapshot().computed` MUST include all computed fields regardless of dependency |
| PROJ-COMP-4 | SHOULD | The SDK SHOULD resolve computed transitive dependency graphs at activation time (from the compiled schema), not at runtime per snapshot |

**Rationale:** Dependency graph information is available from the compiled schema (ComputedSpec declares its inputs). PROJ-COMP-4 means the "which computed fields to include" decision is made once at activation, not per projection. This keeps the projection function cheap.

**Edge case — mixed dependencies:** If a computed field depends on both `data.todos` and `data.$host.sessionId`, it is excluded from Snapshot. A computed value that mixes domain and platform concerns is itself an infrastructure concern.

**Edge case — transitive chain:** If computed `A` depends on computed `B`, and `B` depends on `data.$mel.guards`, then both `B` and `A` are excluded from projected Snapshot. The transitive closure catches the entire dependency chain.

### 2.10 Snapshot Is a Projection, Not a Reversible Encoding

The user-facing Snapshot is a projection of CanonicalSnapshot.

`Snapshot → CanonicalSnapshot` is **not reversible**.

The default Snapshot is a curated read model, not a serialization substrate. Consumers MUST NOT attempt to reconstruct CanonicalSnapshot from Snapshot.

### 2.11 `system.status` Observability Contract

`system.status` is included in the projected Snapshot as the **status of the last published snapshot**, not as a live process monitor or a dispatch outcome reporter.

**Key distinction:** `system.status` reflects what is in the most recently published snapshot. It is not guaranteed to reflect the outcome of the most recent dispatch. Under the current SDK contract:

- `subscribe()` fires at most once per intent, and only when a new terminal snapshot is published
- Rejected dispatches (e.g., guard failures) and certain failure modes do not publish a new snapshot — in these cases, the previous snapshot's `status` remains visible unchanged
- Intermediate status transitions (`idle → computing → pending → idle`) are **never individually observable** through `getSnapshot()` or `subscribe()`

Therefore, `system.status` answers the question **"what state is the last published snapshot in?"** — not "what happened in the last dispatch?" or "what is the world doing right now?"

**What `system.status` tells the application:**

| Published `status` | Meaning |
|--------------------|---------|
| `'idle'` | The last published snapshot reflects a successfully completed state. |
| `'error'` | The last published snapshot reflects an error state. See `system.lastError`. |
| `'pending'` | The last published snapshot reflects a world suspended awaiting effect resolution. |
| `'computing'` | Should not appear in a published snapshot under normal operation. If observed, indicates an abnormal Host termination. |

**What `system.status` does NOT tell the application:** It does not provide live in-flight visibility, and it does not report on dispatches that were rejected or failed without publishing a new snapshot. An application cannot use `subscribe()` to watch `status` transition from `idle` to `computing` to `idle` within a single dispatch. Those transitions happen inside the Host execution boundary and are not published.

**In-flight visibility is not currently supported.** Neither the Snapshot state channel nor the current telemetry events (`dispatch:completed`, `dispatch:rejected`, `dispatch:failed`) provide live in-flight status transitions. If future use cases require this, the solution belongs in a publish-boundary ADR and/or a telemetry-extension ADR (see §8.6). This ADR does not pre-commit to either path.

### 2.12 Why `meta.version` Is Not in Projected Snapshot

v2 of this ADR included `meta.version` in the projected Snapshot as a "practical state-change indicator." This was removed in v4 because it contradicts the core goal of boundary hardening.

**The problem:** `meta.version` is a canonical substrate counter. It increments on **every** canonical state change — including changes to `data.$host`, `data.$mel`, `system.currentAction`, and other fields that the projected Snapshot deliberately excludes.

This creates a direct contradiction:

- PROJ-5 says: "Do not allocate a new projected Snapshot if no projected field changed."
- But if `meta.version` is a projected field, and `meta.version` changes whenever `data.$host` changes, then the projected Snapshot changes on every canonical change — exactly the spurious-update problem that PROJ-5 exists to prevent.

Keeping `meta.version` in the projected Snapshot would either:

1. **Break PROJ-5** — the projected Snapshot changes on every canonical change, defeating boundary hardening, or
2. **Require a projection-specific version** — a separate counter that increments only when projected fields change. This is a new concept (`projectionVersion` / `revision`) that adds complexity and is not justified by current use cases.

**Decision:** `meta.version` is excluded from the projected Snapshot.

**What replaces it for change detection?** The projected Snapshot's referential identity (PROJ-5) is the change-detection signal. If the projected Snapshot reference changes, something the user cares about changed. If it doesn't, nothing did. This is the same contract that `subscribe()` already relies on via `Object.is` (SDK-SUB-3).

Consumers who need a monotonic counter for caching, ETags, or optimistic concurrency MUST use `getCanonicalSnapshot().meta.version`. This is an infrastructure concern, and `getCanonicalSnapshot()` is the infrastructure API.

**Future direction:** If a projection-specific revision counter proves necessary (e.g., for HTTP ETag generation without canonical access), it can be introduced in a follow-up ADR with a distinct name (not `version`) to avoid confusion with the canonical counter. This ADR does not introduce it.

### 2.13 Why No Pending Summary in Snapshot

v2 of this ADR proposed a `pendingSummary` field — a lightweight summary of pending effects by kind. This was removed in v3 for two reasons:

**Reason 1: Terminal-only publish boundary conflict.** The current SDK state channel publishes terminal snapshots only. A "pending summary" field is meaningful primarily during in-flight orchestration — exactly the window that the current publish boundary does not expose to `subscribe()`. Including it would create a field that is structurally present but semantically inert under the current contract.

**Reason 2: Premature taxonomy.** The current `Requirement` has a `type: string` field, but no higher-level "effect kind" taxonomy exists in the protocol. Introducing `EffectKindSummary` would implicitly establish a new classification layer that belongs in a separate design decision, not inside a read-boundary ADR.

**Recommendation for consumers who need pending state:**

- For **published snapshot state** that may include `'pending'`: `getSnapshot().system.status` — but note this reflects the last published snapshot, not live visibility (§2.11)
- For **full pending detail** when the published snapshot shows `status === 'pending'`: `getCanonicalSnapshot().system.pendingRequirements`
- For **dispatch lifecycle events**: `on('dispatch:*')` telemetry — but note these are lifecycle events, not in-flight status transitions
- For **live in-flight pending observation**: not currently supported. See §8.6.

### 2.14 Subscription Semantics Follow Snapshot, Not CanonicalSnapshot

The default `subscribe()` path MUST observe changes in the user-facing Snapshot surface.

| Rule ID | Level | Description |
|---------|-------|-------------|
| PROJ-SUB-1 | MUST | If CanonicalSnapshot changes but the projected Snapshot is referentially identical (per PROJ-5), `subscribe()` listeners MUST NOT fire |
| PROJ-SUB-2 | MUST | Selector-based subscriptions (`subscribe(selector)`) MUST run the selector against the projected Snapshot, not the canonical substrate |
| PROJ-SUB-3 | MAY | A future advanced subscription seam for CanonicalSnapshot MAY be introduced if concrete use cases emerge (see §8.2) |

**Implementation note:** PROJ-5 (referential caching) makes this free. The `subscribe()` comparator already uses `Object.is` on the selector output (SDK-SUB-3). If the projected Snapshot reference doesn't change, `Object.is` returns `true` and the listener doesn't fire. No additional diffing layer is needed — the caching contract is the diffing contract.

### 2.15 Failure and State Observation Contract

The recommended public observation paths are:

| What you need | Recommended surface | API |
|---------------|---------------------|-----|
| Current semantic error state | `snapshot.system.lastError` | `getSnapshot()` |
| Last published snapshot status | `snapshot.system.status` | `getSnapshot()` |
| Dispatch lifecycle events | Telemetry events (`dispatch:*`) | `on('dispatch:*')` |
| Runtime residue / low-level forensic state | Full canonical substrate | `getCanonicalSnapshot()` |

`data.$host.*` MUST NOT be treated as the recommended public failure surface.

**Pending-state observation is not a supported path in this ADR.** Under the current terminal-only publish boundary, in-flight pending state is not observable through the Snapshot state channel. `system.status === 'pending'` may appear in a published snapshot in effect-driven re-entrant flows (see §2.11), but this ADR does not establish it as a recommended observation path for "is something pending right now." **In-flight visibility is not currently supported** by either the state channel or the telemetry channel. Richer pending observability requires a future publish-boundary and/or telemetry-extension ADR. See §8.6.

This resolves the ambiguity identified in #364 by establishing a single recommended public path for each category of observation that is currently observable.

### 2.16 Telemetry Remains a Separate Channel

This ADR preserves the separation between:

- **state** — read through Snapshot / subscription
- **events** — read through telemetry (`on('dispatch:*')`)
- **substrate** — read through CanonicalSnapshot

Ordinary Snapshot MUST NOT become a catch-all diagnostic channel.

### 2.17 Hash and Identity APIs Must Be Separate from Snapshot

Because Snapshot is now a user-facing projection, hash and identity MUST NOT be implied as properties of Snapshot itself.

The following advanced APIs are the recommended shape:

```typescript
getSnapshotHash(): string      // canonical state-root hash
getWorldId(): string | null    // lineage commit identity, when lineage is present
```

These are hashes of the **CanonicalSnapshot** (specifically, the `SnapshotHashInput` as defined by Core SPEC and ADR-016). They are not "the hash of the user-facing Snapshot."

### 2.18 Persistence and Restore Use CanonicalSnapshot Only

Persistence / restore flows MUST use CanonicalSnapshot, not Snapshot.

Snapshot is not a persistence substrate.

| Application concern | Substrate |
|---------------------|-----------|
| UI / API / default application reads | Snapshot |
| Persistence / restore / hashing / forensic tooling | CanonicalSnapshot |

### 2.19 Restore Input and SDK Type Surface

The vocabulary split introduced by this ADR applies to restore and persistence surfaces as well, but the current SDK v3 base factory no longer accepts restore input.

**Current reality:** `createManifesto(schema, effects)` is restore-free. Base SDK activation does not accept `snapshot`, `canonicalSnapshot`, or any other hydration payload.

**Implemented decision:** restore and persistence concerns remain canonical, but they live in lineage/persistence seams rather than the base SDK factory. This ADR therefore establishes the following implemented rules:

| Rule ID | Level | Description |
|---------|-------|-------------|
| PROJ-RESTORE-1 | MUST | Persistence and restore flows MUST use `CanonicalSnapshot`, not projected `Snapshot` |
| PROJ-RESTORE-2 | MUST NOT | The projected user-facing `Snapshot` MUST NOT be treated as a restore substrate |
| PROJ-RESTORE-3 | MUST | The SDK package MUST export `CanonicalSnapshot` as a public type alias |

For the landed v3 surface, this means:

- `createManifesto()` and base `activate()` stay restore-free
- `LineageService.restore(worldId)` returns canonical substrate
- `LineageInstance.restore(worldId)` restores canonical substrate into the runtime, after which `getSnapshot()` exposes the projected read and `getCanonicalSnapshot()` exposes the visible canonical state
- `getWorldSnapshot(worldId)` exposes stored canonical substrate for sealed worlds

**Type export contract:**

```typescript
// @manifesto-ai/sdk public exports
export type { Snapshot } from './projection';           // user-facing projection
export type { CanonicalSnapshot } from './canonical';   // full substrate
```

The `CanonicalSnapshot` type structurally extends the Core SPEC `Snapshot` type with explicit `CanonicalPlatformNamespaces` on `data`. The alias exists to maintain vocabulary consistency across the SDK boundary.

---

## 3. Namespace Taxonomy

### 3.1 `$` Prefix Policy

The `$` prefix is reserved for **platform-owned namespaces inside `data`**.

Examples: `data.$host`, `data.$mel`, future `data.$*`.

This ADR clarifies that `$` does not mean "all platform-related state everywhere." It means:

> A reserved platform-owned namespace inside `snapshot.data`.

### 3.2 Top-Level Partitions Are Not `$` Namespaces

The following are top-level structural partitions, not `$`-prefixed data namespaces:

- `system`
- `input`
- `meta`
- `computed`

These remain prefix-free by design. Their role is ontological partitioning of CanonicalSnapshot, not ownership tagging inside `data`.

### 3.3 Lexical Runtime Namespaces Are Distinct from Snapshot Fields

Names such as `$system`, `$meta`, `$input`, and similar MEL/runtime lexical references are not themselves Snapshot field names. They belong to the language/runtime lexical surface, not to persisted Snapshot naming.

This ADR explicitly separates:

1. **CanonicalSnapshot structural partitions** — `data`, `computed`, `system`, `input`, `meta`
2. **Platform-owned data namespaces** — `data.$host`, `data.$mel`, etc.
3. **MEL/runtime lexical namespaces** — `$system`, `$meta`, `$input`, etc.

---

## 4. Consequences

### 4.1 Positive

1. **Safer default surface** — ordinary users get a read model free of infrastructure residue.
2. **No boundary leak** — internal runtime state no longer becomes a de facto public API through the default read path.
3. **Clear observation paths** — current error → `lastError`, published snapshot status → `status`, dispatch lifecycle → telemetry, forensics → `getCanonicalSnapshot()`.
4. **Cleaner `$` semantics** — the meaning of `$` is structurally consistent and well-scoped.
5. **Safer evolution** — future runtime internals can change without breaking application code that only reads Snapshot.
6. **Layer-scoped axiom** — the "if it's not in Snapshot" principle is preserved at every layer without lying to anyone.
7. **No protocol-layer changes** — Core SPEC and Host SPEC remain untouched. Only SDK surface and documentation are affected.
8. **Restore type safety** — the vocabulary split is reflected in actual SDK types, not just documentation.
9. **Type honesty** — `Snapshot<TData>.data` is `TData` (domain only), `CanonicalSnapshot<TData>.data` is `TData & CanonicalPlatformNamespaces`. The types match reality.
10. **No spurious change signals** — excluding `meta.version` from the projected Snapshot ensures that referential identity (PROJ-5) is a faithful change-detection signal for application-relevant state.

### 4.2 Trade-offs

1. **Snapshot is now a projection, not the full substrate.** The word's meaning changes depending on layer context. Documentation discipline is required.
2. **Some advanced users must explicitly call `getCanonicalSnapshot()`.** This is intentional friction — it signals "you are now touching infrastructure."
3. **Equality semantics split into three:**
   - Snapshot reference equality (has the user-facing state changed?)
   - Canonical state-root equality (has the hash-relevant state changed?)
   - Commit identity equality (has a lineage commit occurred?)
4. **Computed field filtering adds a schema-time decision.** PROJ-COMP-4 mitigates runtime cost, but the compiler/codegen must propagate dependency graph metadata to the SDK.
5. **Pending observability is limited by current publish boundary.** Under the terminal-only publish contract, in-flight pending state is not observable through either the Snapshot state channel or the current telemetry events. `system.status` may reflect `'pending'` in a published snapshot in re-entrant flows, but live pending visibility requires a future ADR (§8.6).
6. **Restore config surface needs updating.** Either the property name or its type annotation must change. This is a one-time SDK migration cost.
7. **No monotonic counter in projected Snapshot.** Consumers who previously relied on `meta.version` for caching or ETags must switch to `getCanonicalSnapshot().meta.version`. See §2.12 for rationale and future direction.

---

## 5. Non-Goals

This ADR does **not:**

- change the canonical Core/Host substrate contract
- remove CanonicalSnapshot from the system
- redefine snapshot hashing rules
- redefine world identity rules
- introduce result-oriented helper APIs
- redesign governed execution helpers
- standardize framework-specific bindings (e.g., React)
- relocate Process/Transient fields out of CanonicalSnapshot (future ADR per ADR-015 §10)
- change the SDK publish boundary (terminal-only per intent)
- introduce effect-kind taxonomy or pending-state summary types
- introduce a projection-specific revision counter (future ADR if evidence warrants)
- establish a supported path for live in-flight pending-state observation (future ADR, see §8.6)

---

## 6. Migration

### 6.1 Ordinary Application Code

Most ordinary application code SHOULD continue using:

```typescript
getSnapshot()
subscribe()
```

with no changes required. The projected Snapshot contains all Essence and Projection fields that ordinary apps need.

### 6.2 Advanced Consumers

Consumers currently relying on any of the following MUST migrate intentionally to `getCanonicalSnapshot()`:

- `data.$host.*`
- `data.$mel.*`
- `system.pendingRequirements`
- `system.currentAction`
- `input`
- `meta.version`
- `meta.timestamp`
- `meta.randomSeed`

### 6.3 Failure Observation Migration

Consumers currently reading failure-like state from `data.$host.*` in ordinary application code SHOULD migrate to:

- `snapshot.system.lastError` for current error state
- telemetry events for chronology

### 6.4 Computed Field Migration

Computed fields whose transitive dependency graph references any `data.$*` path will no longer appear in `getSnapshot().computed`. Consumers relying on such fields MUST either:

1. migrate to `getCanonicalSnapshot().computed`, or
2. restructure the computed expression to depend only on non-`$*` data paths

### 6.5 Restore Surface Migration

Code that previously treated base SDK factory input as a restore seam must migrate to the current lineage/persistence surface.

- base `createManifesto()` and base `activate()` no longer accept restore input
- persisted or sealed snapshot reads belong to lineage APIs and MUST be canonical
- runtime forensic reads that need the full visible substrate MUST use `getCanonicalSnapshot()`

### 6.6 Version Counter Migration

Code that currently reads `getSnapshot().meta.version` for caching, ETags, or optimistic concurrency MUST migrate to `getCanonicalSnapshot().meta.version`.

Code that uses `meta.version` only for change detection (e.g., React memoization, `useSyncExternalStore`) SHOULD switch to referential identity on the projected Snapshot itself, which is the intended change-detection mechanism under this ADR.

### 6.7 Documentation Migration

Documentation MUST distinguish clearly between Snapshot and CanonicalSnapshot:

| Documentation category | Default term |
|-----------------------|-------------|
| Quickstart, tutorial, framework integration | Snapshot |
| Core SPEC, Host SPEC, Lineage SPEC, persistence | CanonicalSnapshot |
| Debugging / forensic inspection guides | CanonicalSnapshot (with Snapshot as starting point) |
| Concept docs (`docs/concepts/snapshot.md`) | Both — explicitly distinguished |

The Core SPEC axiom "If it's not in Snapshot, it doesn't exist" MUST be updated to reference CanonicalSnapshot and to include the layer-scoped restatement from §2.1.

---

## 7. Acceptance Criteria

This ADR is considered implemented when **all** of the following are true:

1. `getSnapshot()` returns the user-facing Snapshot projection
2. `getCanonicalSnapshot()` returns the full substrate
3. Default Snapshot **excludes** `data.$*`, `system.pendingRequirements`, `system.currentAction`, `input`, `meta.version`, `meta.timestamp`, `meta.randomSeed`
4. Default Snapshot **includes** `data` (non-$*), `computed` (non-$*-dependent per transitive closure), `system.lastError`, `system.status`, `meta.schemaHash`
5. `Snapshot<TData>.data` is typed as `TData`; `CanonicalSnapshot<TData>.data` is typed as `TData & CanonicalPlatformNamespaces`
6. Computed field filtering respects the $* transitive dependency rule (PROJ-COMP-1 through PROJ-COMP-4)
7. Projection is implemented in the SDK layer per PROJ-1 through PROJ-5
8. `subscribe()` fires only on projected Snapshot changes per PROJ-SUB-1 and PROJ-SUB-2
9. Restore and stored-world reads use `CanonicalSnapshot` per PROJ-RESTORE-1 through PROJ-RESTORE-3, while the base SDK factory remains restore-free
10. SDK exports both `Snapshot` and `CanonicalSnapshot` as public types
11. Docs consistently distinguish Snapshot from CanonicalSnapshot per §6.7
12. The Core SPEC axiom is updated with layer-scoped restatement per §2.1
13. Public observation paths are documented:
    - current error → `system.lastError`
    - last published snapshot status → `system.status`
    - dispatch lifecycle → telemetry
    - forensic substrate → `getCanonicalSnapshot()`
    - pending-state observability is explicitly deferred (§8.6)
14. Hash/identity APIs are documented separately from Snapshot projection semantics

---

## 8. Open Questions

### 8.1 Should `meta.schemaHash` remain visible in Snapshot?

**Current draft says yes.**

Rationale: Schema-aware UIs, migration detection, and tooling benefit from knowing the schema identity without reaching for canonical. Unlike `meta.version`, `schemaHash` does not change on every canonical state change — it changes only when the schema itself changes, which is a structural event, not a runtime event. It does not create spurious update signals.

**Disposition:** Keep for now. Revisit based on Coin Sapiens and TaskFlow usage evidence.

### 8.2 Should there be an advanced subscription seam for CanonicalSnapshot?

**Current draft does not require one.**

A `subscribeCanonical()` or similar API may be added later if concrete use cases emerge (e.g., infrastructure dashboards, lineage visualizers that need to observe seal attempts in real time).

**Disposition:** Defer. The escape hatch is polling `getCanonicalSnapshot()` — inelegant but sufficient for known use cases.

### 8.3 Should `system.status` remain visible in Snapshot?

**Current draft says yes, with a strict observability contract (§2.11).**

`status` is classified as Process (ADR-015), but it serves a unique role as the status of the last published snapshot. Without it, consumers would have no synchronous way to distinguish a world that completed successfully from one that ended in error or pending suspension.

The §2.11 contract explicitly limits what `status` promises: it reflects the last published snapshot's state, not the outcome of the most recent dispatch (which may not have published a snapshot), and not live in-flight transitions. If a future ADR changes the publish boundary to allow intermediate snapshots, `status` observability improves without changing this ADR's Snapshot shape.

**Disposition:** Keep with caveat. If a future ADR changes the publish boundary to allow intermediate snapshots, `status` observability improves without changing this ADR.

### 8.4 Should the base SDK factory expose a restore key again?

The landed answer is no for the current v3 base SDK surface.

Restore belongs to lineage/persistence seams, not `createManifesto(schema, effects)`.

**Disposition:** Closed for the current contract. A future hydration seam would still need canonical typing, but no such surface is part of the implemented v3 base SDK.

### 8.5 Should a projection-specific revision counter be introduced?

**Current draft says no.**

If future evidence (e.g., HTTP ETag generation, optimistic concurrency in APIs) shows that consumers routinely need a monotonic counter scoped to projection-relevant changes, a follow-up ADR may introduce one with a distinct name (e.g., `revision`) to avoid confusion with the canonical `version`.

**Disposition:** Defer. Referential identity is the v1 change-detection mechanism. Evaluate after Coin Sapiens and TaskFlow integration.

### 8.6 Pending-State Observability

**Current draft defers this entirely.**

Under the current terminal-only publish boundary, in-flight pending state is not observable through either the Snapshot state channel or the current telemetry events. `system.status === 'pending'` may appear in a published snapshot in effect-driven re-entrant flows (§2.11), but this ADR does not establish a supported path for live "is something pending right now?" observation.

If future use cases (e.g., Coin Sapiens multi-effect orchestration, agent UIs that show progress) require live pending-state visibility, the solution belongs in one of:

1. A **publish-boundary ADR** that allows intermediate snapshot publication (enabling `subscribe()` to observe `pending` transitions)
2. A **telemetry-extension ADR** that adds `dispatch:pending` and `dispatch:resolved` events to the `on()` channel
3. A combination of both

This ADR intentionally does not pre-commit to any of these paths. The Snapshot shape defined here (`system.status` included as last-published snapshot status) is forward-compatible with all three options.

**Disposition:** Defer. Evaluate after Coin Sapiens integration reveals whether live pending observability is a real need or a speculative one.

---

## 9. Rules Summary

| Rule ID | Level | Description |
|---------|-------|-------------|
| PROJ-1 | MUST | SDK activated instance MUST hold CanonicalSnapshot internally and produce Snapshot projection on read |
| PROJ-2 | MUST | Projection MUST be computed lazily or cached |
| PROJ-3 | MUST | Projection function MUST be pure |
| PROJ-4 | SHOULD | `getCanonicalSnapshot()` SHOULD return the internal canonical reference without copy overhead |
| PROJ-5 | MUST NOT | Projection MUST NOT allocate a new object if no projected field changed |
| PROJ-COMP-1 | MUST | Projected `computed` includes only fields whose transitive dependency closure references no `data.$*` path |
| PROJ-COMP-2 | MUST NOT | $*-transitively-dependent computed fields MUST NOT appear in projected Snapshot |
| PROJ-COMP-3 | MUST | `getCanonicalSnapshot().computed` includes all computed fields |
| PROJ-COMP-4 | SHOULD | Computed dependency filtering resolved at activation time from compiled schema |
| PROJ-SUB-1 | MUST | `subscribe()` MUST NOT fire if projected Snapshot is referentially identical |
| PROJ-SUB-2 | MUST | Selector subscriptions run against projected Snapshot |
| PROJ-RESTORE-1 | MUST | Persistence and restore flows MUST use `CanonicalSnapshot` |
| PROJ-RESTORE-2 | MUST NOT | Projected `Snapshot` MUST NOT be accepted as a restore substrate |
| PROJ-RESTORE-3 | MUST | SDK MUST export `CanonicalSnapshot` as a public type |
| TYPE-1 | MUST | `Snapshot<TData>.data` typed as `TData` |
| TYPE-2 | MUST | `CanonicalSnapshot<TData>.data` typed as `TData & CanonicalPlatformNamespaces` |
| TYPE-3 | MUST NOT | The two `data` types MUST NOT be identical |

---

## 10. ADR Dependency Chain

| ADR | Contribution to ADR-018 |
|-----|------------------------|
| ADR-002 | `$mel` namespace convention; lexical vs snapshot namespace distinction basis |
| ADR-015 | Ontological classification (Essence/Projection/Process/Transient/Envelope/Binding) that determines inclusion/exclusion |
| ADR-016 | Merkle Tree Lineage — hash/identity semantics that remain on CanonicalSnapshot, not Snapshot |
| ADR-017 | Capability Decorator Pattern — `activate()` boundary where projection ownership begins |

---

*End of ADR-018 v6*
