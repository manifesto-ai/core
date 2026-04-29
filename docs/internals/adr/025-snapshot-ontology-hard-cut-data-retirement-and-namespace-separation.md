# ADR-025: Snapshot Ontology Hard Cut — `data` Retirement and Namespace Separation

> **Status:** Accepted
> **Date:** 2026-04-29
> **Deciders:** Manifesto Architecture Team (Seongwoo Jung)
> **Reviewers:** GPT cross-review (two rounds)
> **Scope:** Core, Host, SDK, Compiler, Lineage, Governance, Studio, Agent tooling, Constitution, Docs
> **Type:** Breaking / Major Hard Cut
> **Release Vehicle:** Manifesto v5 (ontology layer)
> **Supersedes:**
> - Current Snapshot contract (`Snapshot.data` field)
> - SPEC §13.3 normative note ("the field name is `data` (not `state`)")
> - Platform namespace placement under `data.$*`
> - Constitution / CLAUDE.md canonical Snapshot definition
> - ADR-009 §2.8 ("PatchPath is ALWAYS rooted at `snapshot.data`")
>
> **Related:**
> - ADR-002 (`$mel` namespace, onceIntent guard, `withPlatformNamespaces` schema augmentation)
> - ADR-009 (PatchPath structure)
> - ADR-014 (World decomposition into Lineage / Governance)
> - ADR-015 (Snapshot ontological classes)
> - ADR-016 (Restore normalization, two-level hash, Merkle continuity)
> - ADR-projection-layer (Snapshot vs CanonicalSnapshot)
> - ADR-019 (`dispatchable when`)
>
> **Non-Goals:** Patch operation semantics, MEL source syntax, computed semantics, system error model, governance authority model, SDK surface decisions (dispatch / simulate / report). The latter live in sibling v5 ADRs.

---

## 1. Context

### 1.1 Manifesto's grounding model

Manifesto is not a state-management library or a workflow engine. It targets the following structure:

```text
Human UI  <->  Manifesto Runtime  <->  Agent
```

UI and Agent must observe the same domain world, manipulate it through the same action surface, and reason about results over the same lineage. For this grounding to hold, **the ontology of the runtime's exposed surface MUST match the ontology that MEL authors, UI renderers, and Agent tools actually reason about.**

In MEL source, domain state is declared as:

```mel
state {
  phase: "idle" | "running" | "done" = "idle"
  count: number = 0
}
```

But the runtime Snapshot exposes this state under `snapshot.data`:

```ts
snapshot.data.phase
snapshot.data.count
```

MEL calls it `state`, the runtime calls it `data`. This naming mismatch looks like a minor DX issue but is in fact a **persistent cost imposed at the very first layer of grounding** — every consumer must reconcile two names for the same thing.

### 1.2 Accumulated `$*` special-casing (entropy inventory)

Today, `data.$host` and `data.$mel` coexist with domain state inside the same container. Ownership is encoded only by naming convention (the `$` prefix). This single decision has accumulated the following special cases across the SPEC surface:

| Location | Special-casing |
|----------|----------------|
| **SCHEMA-RESERVED-1/2** (Compiler SPEC) | Domain code cannot use `$` prefix, but platform packages place their state in the same container. Ownership is convention only. |
| **ADR-009 §2.8** (PatchPath) | "PatchPath is ALWAYS rooted at `snapshot.data`" with `data.$*` paths bypassing standard validation under owner responsibility. |
| **ADR-016 MRKL-RESTORE-1/2/3** | Restore must reset `data.$host`, deep-normalize `data.$mel.guards.intent`, etc. — namespace-by-namespace normalization rules. |
| **WORLD-HASH-4a** (Lineage) | Hash computation strips `$host`/`$mel` via a dedicated `stripPlatformNamespaces` function. |
| **PROJ-COMP-1~4** (Projection ADR) | Projection must filter computed fields by transitive `$*` dependency closure. |
| **SPEC §13.3 normative note** | "The field name is `data` (not `state`) ... higher layers MAY refer to it as `state`, but that is terminology only" — the SPEC itself acknowledges the dual-naming problem. |
| **ADR-002 `withPlatformNamespaces`** | The App layer auto-injects `$host` / `$mel` into the schema, blurring the boundary between domain schema and platform schema. |

Each of these rules is correct in isolation. Taken together, they form a layer of **derivative cost rooted in the single decision to keep `$*` inside the `data` container**. Each new namespace (e.g. `$genealogy`, `$studio`) repeats this pattern and grows the cost monotonically.

### 1.3 External user friction (Codex M1 evidence)

During Codex's use of Manifesto through M1, the following observation was reported:

> "`getSnapshot()` returns a `{ data: ... }` shape, which had one extra layer than I expected. I wrapped it, but a direct user could find it confusing."

This is the exact scenario SPEC §13.3 anticipated when it stated:

> "Higher-level layers MAY provide derived read-only views or aliases (e.g., `snapshot.state` as an alias of `snapshot.data`)."

An external user, on first contact, built that alias. This demonstrates that the cost in §1.2 is not only an internal-maintainer concern: it surfaces as immediate mental-model overhead for new users.

A subsequent observation from Codex during lineage integration is also load-bearing for this ADR:

> "Canonical snapshots include `$host` and `$mel` platform bookkeeping, so naive deep equality between simulation and commit snapshots breaks on random intent ids. We had to introduce `snapshotData()` that strips `$`-prefixed platform fields. ... The boundary between projected/domain state and canonical substrate must be preserved."

This is direct evidence that the cohabitation of platform namespaces with domain state corrupts equality semantics in real downstream code. The `snapshotData()` helper is precisely the workaround `snapshot.state` makes unnecessary by structural separation.

### 1.4 V5 hard cut window economics

This ADR is the **ontology layer** of the Manifesto v5 hard cut. It ships in a single v5 release together with sibling ADRs covering the SDK surface (dispatch / simulate / report).

The decision to cut **now** rests on three conditions, all of which currently hold and none of which can be assumed to hold later:

- **Bus factor = 1.** Manifesto's sole architect today is Seongwoo Jung. The marginal cost of any breaking change rises monotonically once collaborators or external users are added.
- **Pre-stable artifacts.** Currently sealed worlds are internal experiment artifacts, not commitments to an external lineage-stability promise.
- **The cut window narrows monotonically.** The above two conditions will not co-occur again.

V5 narrative therefore forms part of the justification: this ADR is not a standalone change but the first entry under a v5 manifest.

### 1.5 Explicit retraction of SPEC §13.3, Constitution, and ADR-009 §2.8

This ADR explicitly retracts the following prior normative statements:

**SPEC §13.3 (current):**

> "Domain-owned mutable state is stored under `snapshot.data`. ... In particular, the field name is `data` (not `state`)."

**Manifesto Constitution / CLAUDE.md:**

> The canonical Snapshot definition that names `data` as the domain field.

**ADR-009 §2.8:**

> "PatchPath is ALWAYS rooted at `snapshot.data`."

These were reasonable conservative decisions at the time. Their lifetime has ended. The Constitution update is part of PR-1 (§11) — without it, a higher-order norm would continue to mandate `data` while a lower-order ADR mandates `state`, producing a contradiction. ADR-009 §2.8 is replaced by channel-determined root anchoring (§3.4).

---

## 2. Problem

### 2.1 `data` is misaligned with Manifesto's shared semantic surface

The current naming creates the following mismatch:

```text
MEL source:      state
Runtime read:    snapshot.data
UI mental model: state
Agent context:   data? state?
Docs:            data as domain state
```

§1.3 demonstrates that this mismatch surfaces immediately as a wrapper-forcing pattern (`const state = snapshot.data;`) for external users. It is not a stylistic quibble; it is a permanent grounding tax at layer one.

### 2.2 `data.$*` cannot be moved to `state` unchanged

The simplest renaming would produce:

```ts
snapshot.state.$host
snapshot.state.$mel
```

This is **worse** than the status quo. `state` is a strong semantic name corresponding to the domain's own `state {}` declaration. Placing platform namespaces inside it amplifies the very ontology violation that already bothers users:

> "If MEL `state` corresponds to `snapshot.state`, why does my snapshot.state contain `$host` and `$mel` that I never declared?"

`data` was a sufficiently generic word to absorb this anomaly. `state` is not. Strengthening the name strengthens the eligibility constraint.

### 2.3 Projection and canonical snapshot stay needlessly complex

Today's projection model (ADR-projection-layer §2.5) reads:

```text
canonical: snapshot.data includes data.$host / data.$mel
projected: snapshot.data excludes data.$host / data.$mel
```

If the hard cut keeps `$*` inside `state`, projection's complexity stays identical: per-field intra-partition filtering. The correct model is:

```text
snapshot.state       = domain-owned state           (always projected)
snapshot.namespaces  = platform / runtime / tooling (default not projected)
```

Under this model, projection becomes a whole-partition include/exclude decision; transitive `$*` dependency tracking on computed fields disappears (see §3.9).

---

## 3. Decision

### 3.1 Retire `Snapshot.data`

`Snapshot.data` becomes a retired field. The new canonical Snapshot shape is:

```ts
type Snapshot<TState = Record<string, unknown>> = {
  /** Domain-owned state declared by MEL `state {}`. */
  readonly state: TState;

  /** Derived facts declared by MEL `computed`. */
  readonly computed: Record<string, unknown>;

  /** Runtime semantic status, pending requirements, current action, semantic lastError. */
  readonly system: SystemState;

  /** Transient bound intent input. */
  readonly input: unknown;

  /** Snapshot identity and deterministic host context. */
  readonly meta: SnapshotMeta;

  /** Platform / runtime / compiler / tooling-owned namespaces. NOT domain state. */
  readonly namespaces: SnapshotNamespaces;
};
```

`state` corresponds 1-to-1 with the MEL `state {}` declaration.

### 3.2 Move platform / runtime / compiler namespaces to `Snapshot.namespaces`

```ts
// Before
snapshot.data.$host
snapshot.data.$mel

// After
snapshot.namespaces.host
snapshot.namespaces.mel
```

Recommended type:

```ts
type SnapshotNamespaces = {
  readonly host?: HostNamespace;
  readonly mel?: MelNamespace;
  readonly [namespace: string]: unknown;
};
```

`namespaces` is a Snapshot-level extension surface available to Host, Compiler, Runtime, Studio, Planner, Debugger, and similar platform / tooling layers. It is not domain state.

### 3.3 `state` contains domain-owned fields only

```ts
// allowed
snapshot.state.phase
snapshot.state.count
snapshot.state.selectedCandidateIds

// forbidden — both compile-time and runtime validation
snapshot.state.$host
snapshot.state.$mel
snapshot.state.$debug
snapshot.state.$studio
```

The `$` prefix is no longer an in-container ownership marker. Ownership is expressed by **top-level partition** (`state` vs `namespaces`). The `$` prefix becomes a *symbolic name* for a platform namespace, while *storage* lives entirely under the `namespaces` partition.

### 3.4 PatchPath is root-relative; the channel determines the root

ADR-009 §2.8 ("PatchPath is ALWAYS rooted at `snapshot.data`") is retracted by this ADR.

**The PatchPath type itself is root-relative.** A PatchPath value carries no root information. The root is determined by the **transition channel** through which the PatchPath travels.

```text
PATCH-ROOT-1 (MUST):
The PatchPath of a domain Patch carried in ComputeResult.patches is rooted at snapshot.state.

NSPATCH-ROOT-1 (MUST):
The PatchPath of a Patch carried in NamespaceDelta.patches is rooted at snapshot.namespaces[namespace].

PATCH-ROOT-2 (MUST):
PatchPath type itself MUST NOT carry root information.
Root anchoring is determined by the transition channel through which
the PatchPath is conveyed, not by the PatchPath value.
```

Example:

```ts
// Channel: ComputeResult.patches  → root = snapshot.state
{ op: "set", path: [{ kind: "prop", name: "count" }], value: 1 }
// Applies to: snapshot.state.count

// Channel: NamespaceDelta(namespace="mel").patches  → root = snapshot.namespaces.mel
{ op: "merge", path: [
    { kind: "prop", name: "guards" },
    { kind: "prop", name: "intent" }
  ], value: { [guardId]: intentId }
}
// Applies to: snapshot.namespaces.mel.guards.intent
```

`snapshot.computed`, `snapshot.system`, `snapshot.meta`, and `snapshot.input` are not targetable by any patch channel (Core / Host manage them directly).

### 3.5 Namespace mutation uses a separate channel from domain-state patches

Because `namespaces` is not domain state, namespace mutation MUST NOT travel through the same channel as domain patches. This ADR introduces a dedicated transition channel — **NamespaceDelta**.

```ts
type NamespaceDelta = {
  readonly namespace: string;
  readonly patches: readonly Patch[];   // PatchPath rooted at snapshot.namespaces[namespace]
};

type ComputeResult = {
  readonly patches: readonly Patch[];                // PatchPath rooted at snapshot.state
  readonly namespaceDelta?: readonly NamespaceDelta[];
  readonly systemDelta: SystemDelta;
  readonly trace: TraceGraph;
  readonly status: ComputeStatus;
};
```

#### 3.5.1 Why a separate channel — comparison with the alternative

The alternative — *Root-aware Patch* (adding a `root` discriminator to Patch) — was considered. NamespaceDelta wins on Manifesto's harness criterion.

| Dimension | NamespaceDelta | RootedPatch |
|-----------|----------------|-------------|
| Change to `Patch` type | None — root is determined by channel (PATCH-ROOT-2) | `root` discriminator added |
| Change to `ComputeResult` | `namespaceDelta?` field added | None |
| **Harness strength: preventing user-authored MEL from touching namespaces** | **Enforced by channel absence — user surface has no transition through which to express NamespaceDelta** | Compile-time check that user code never emits `root: 'namespace'` |
| Static analysis | NamespaceDelta appears as a distinct trace node | Filter by root within a single patch sequence |

NamespaceDelta means *user-authored MEL has no transition channel through which to express a namespace mutation at all*. This is a physical separation of transition contracts, not a type-system check that needs to be enforced. **Harness provable by static analysis** is this project's load-bearing value, and this decision aligns with that value.

#### 3.5.2 Channel-level invariants — authority and materialization

NamespaceDelta is governed by separating **authority** (who owns the namespace) from **materialization** (which package builds the delta object at runtime).

```text
NSDELTA-1 (MUST):
NamespaceDelta authority is owned by the namespace owner.
- Authority for `namespaces.mel` belongs to the Compiler.
- Authority for `namespaces.host` belongs to the Host.

NSDELTA-1a (MAY):
Core MAY materialize NamespaceDelta for `namespaces.mel` only while interpreting
compiler-owned fixed-shape IR nodes registered under NSDELTA-2a / NSREAD-2.

NSDELTA-1b (MAY):
Host MAY materialize NamespaceDelta for `namespaces.host` only for Host-owned
bookkeeping (diagnostics, intent slots, effect coordination).

NSDELTA-2 (MUST NOT):
User-authored MEL explicit mutation syntax (patch statements, effect handler
patch returns, action body field writes, etc.) MUST NOT target namespaces or
express any NamespaceDelta.

NSDELTA-2a (MAY):
Compiler-owned language-runtime constructs MAY lower to fixed-shape NamespaceDelta.
Currently this is limited to onceIntent → namespaces.mel.guards.intent.
Adding a new compiler-owned construct requires a separate ADR.

NSDELTA-3 (MUST):
apply() processes ComputeResult.patches and NamespaceDelta through distinct paths,
applying each at its respective root per PATCH-ROOT-1 and NSPATCH-ROOT-1.

NSDELTA-4 (MUST):
NamespaceDelta is recorded as a distinct transition node in the trace.
```

**Why authority and materialization are separated:** at runtime, the code that *actually constructs* a `mel` namespace delta object lives in Core (while interpreting compiler-owned IR), but the *legitimacy* of that delta originates from the Compiler's fixed-shape contract. NSDELTA-1 governs legitimacy. NSDELTA-1a / 1b govern who is allowed to perform the construction at runtime.

#### 3.5.3 Namespace read access (NamespaceRead)

NamespaceDelta defines the write channel. A symmetric contract for read access is required because compiler-owned constructs (notably `onceIntent`) must read previously-set guard state to decide whether to execute. Without an explicit read contract, namespace reads silently leak into general expression evaluation.

```text
NSREAD-1 (MUST NOT):
MEL user expressions (computed, state init, action when conditions, patch RHS,
effect args, dispatchable when, available when) MUST NOT reference any
`namespaces.*` path. Compiler rejects with a compile error.

NSREAD-2 (MAY):
Compiler-generated IR MAY emit reads of `namespaces.{owner}.*` paths for
owned constructs. Currently limited to onceIntent → `namespaces.mel.guards.intent.*`.

NSREAD-3 (MUST):
Compiler-generated namespace reads MUST be recorded in the trace as
namespace-scoped read events (distinct from domain-state reads).

NSREAD-4 (MUST):
NSREAD-2 privileges mirror NSDELTA-2a — the set of compiler-owned constructs
permitted to read a namespace MUST equal the set permitted to write it,
defined by the same fixed-shape contract.
```

Together, NSREAD and NSDELTA close the user-facing harness on both sides: user code can neither read nor write namespaces; compiler-owned constructs may do both within fixed-shape contracts.

#### 3.5.4 Namespace initialization invariants

Compiler-owned constructs that read or write `namespaces.mel` presuppose a fixed-shape path. If fresh, migrated, or partially-restored snapshots lack the expected sub-paths, the first read or merge fails.

```text
NSINIT-1 (MUST):
Every v5 canonical Snapshot MUST contain `namespaces` as an object
(never undefined, never null).

NSINIT-2 (MUST):
Before evaluating any compiler-owned construct that reads or writes
namespaces.mel, runtime normalization MUST guarantee the following shape:

namespaces.mel = {
  guards: {
    intent: {}
  }
}

NSINIT-3 (MUST):
NSINIT-2 normalization MUST be applied to:
- Fresh initial snapshots (factory creation)
- Read-time migrated snapshots (§7.2.1)
- Restore-normalized snapshots (§7.2.2)

NSINIT-4 (MUST):
If `namespaces.mel` is partially present (e.g., `{}`, `{ guards: {} }`),
runtime normalization MUST **deep-normalize** rather than preserve.
Missing sub-paths MUST be filled recursively to satisfy NSINIT-2.

NSINIT-5 (SHOULD):
Future namespaces (e.g., namespaces.studio, namespaces.debug) SHOULD follow
the same pattern: the owning package defines an expected shape, and runtime
normalization guarantees that shape.
```

NSINIT-4 is critical — a presence check alone does not catch partial corruption. Both restore normalization and read-time migration are bound by the deep-normalize obligation.

### 3.6 The `$mel` symbolic namespace is preserved; only the storage location changes

```text
$mel symbolic namespace
  -> snapshot.namespaces.mel
```

#### 3.6.1 Fixed lowering contract for onceIntent

Per ADR-002, `onceIntent` is a compiler-owned construct that reads and writes `$mel.guards.intent`. Under this ADR, its lowering target is fixed to the following shape.

**Precondition (NSINIT-2):**

```text
namespaces.mel = { guards: { intent: { ... } } }
```

This shape is guaranteed before evaluation — by factory creation for fresh snapshots, by normalization for migrated or restored snapshots.

**Read (NSREAD-2):**

```text
target: snapshot.namespaces.mel.guards.intent[guardId]
- value === currentIntentId  → already executed; skip body
- value !== currentIntentId  → proceed
```

**Write (NSDELTA-2a, NSPATCH-ROOT-1):**

```ts
namespaceDelta: [
  {
    namespace: "mel",
    patches: [
      {
        op: "merge",
        path: [
          { kind: "prop", name: "guards" },
          { kind: "prop", name: "intent" }
        ],
        value: { [guardId]: currentIntentId }
      }
    ]
  }
]
```

By NSPATCH-ROOT-1, the patch's PatchPath is rooted at `snapshot.namespaces.mel`, producing `snapshot.namespaces.mel.guards.intent[guardId] = currentIntentId`.

**ADR-002 preservation note:** the merge target is `mel.guards.intent`, not the root `mel`. This preserves the shallow-merge safety condition from ADR-002 — merging at a deeper path prevents one guard entry from clobbering the others.

MEL source surface is unchanged. `onceIntent` semantics are unchanged. Only the lowering target moves.

#### 3.6.2 Compiler-owned construct registry

| Construct | Read path | Write path | ADR |
|-----------|-----------|------------|-----|
| `onceIntent` | `namespaces.mel.guards.intent[guardId]` | `namespaces.mel.guards.intent[guardId]` (merge) | This ADR + ADR-002 |

Any new construct requires a separate ADR per NSDELTA-2a / NSREAD-2.

### 3.7 The `$host` namespace remains Host-owned; only the storage location changes

```ts
// Before
snapshot.data.$host.lastError
snapshot.data.$host.intentSlots

// After
snapshot.namespaces.host.lastError
snapshot.namespaces.host.intentSlots
```

**The semantic error surface remains `snapshot.system.lastError`.** Host-owned diagnostics are not auto-promoted to semantic errors (a separation already established by ADR-projection-layer; this ADR preserves it).

Host mutates `namespaces.host` exclusively through the NamespaceDelta channel (NSDELTA-1b), never through the Patch channel.

### 3.8 `computed`, `system`, `input`, and `meta` remain top-level partitions

This ADR does not move:

```ts
snapshot.computed
snapshot.system
snapshot.input
snapshot.meta
```

#### 3.8.1 Why `system` does not move to `namespaces` — ontological asymmetry

| Field | Ontological class (ADR-015) | Semantic? | In hash? | Conclusion |
|-------|------------------------------|-----------|----------|------------|
| `state` | Essence | ✅ | ✅ (snapshotHash) | top-level |
| `computed` | Projection | derived from state | derived (excluded) | top-level |
| `system.lastError` | Essence | ✅ | ✅ (snapshotHash) | part of top-level |
| `system.terminalStatus` | Process (exception) | ✅ | ✅ (snapshotHash) | part of top-level |
| `system.pendingDigest` | Process | ✅ | ✅ (snapshotHash) | part of top-level |
| `meta.schemaHash` | Envelope / Binding | structural | ✅ (worldId only) | top-level (binding) |
| `input` | Transient | per-action | excluded | top-level (transient binding) |
| `namespaces.host` | **non-semantic, operational** | ❌ | ❌ | namespaces |
| `namespaces.mel` | **non-semantic, operational** | ❌ | ❌ | namespaces |

The classifying axis is **semantic vs operational**:

- **Semantic** — carries domain meaning. Recomputing the same domain outcome must produce the same value. Part of world identity.
- **Operational** — records *how* a domain outcome was reached (which intent slot was held, which effect was dispatched, which Host instance executed). Independent of world identity.

`system` is uniformly semantic. `$host` and `$mel` are uniformly operational — ADR-016 already implicitly recognized this by mandating their reset on restore. The asymmetry is the load-bearing classification principle for evaluating future namespace candidates.

### 3.9 Computed dependency boundary

`computed` fields may depend only on `state` and other `computed` fields.

```text
COMP-DEP-1 (MUST NOT):
computed expressions MUST NOT reference snapshot.namespaces, snapshot.system,
snapshot.meta, or snapshot.input. Compiler rejects with a compile error.

COMP-DEP-2 (MUST):
computed dependency closures are restricted to state and other computed.

COMP-DEP-3 (MUST):
computed cannot read namespaces by NSREAD-1.
COMP-DEP-1 is a specialization of NSREAD-1; the two do not conflict.
```

This rule retires the PROJ-COMP-1~4 transitive `$*` filtering from ADR-projection-layer entirely. Computed is now namespace-independent by definition; transitive closure tracking is no longer needed.

---

## 4. New Snapshot Ontology

### 4.1 Canonical Snapshot

```ts
type Snapshot<TState = Record<string, unknown>> = {
  readonly state: TState;
  readonly computed: Record<string, unknown>;
  readonly system: SystemState;
  readonly input: unknown;
  readonly meta: SnapshotMeta;
  readonly namespaces: SnapshotNamespaces;  // always present (NSINIT-1)
};

type SnapshotNamespaces = {
  readonly host?: HostNamespace;
  readonly mel?: MelNamespace;
  readonly [namespace: string]: unknown;
};
```

### 4.2 Projected Snapshot

```ts
type ProjectedSnapshot<TState = Record<string, unknown>> = {
  readonly state: TState;
  readonly computed: Record<string, unknown>;
  readonly system: ProjectedSystemState;  // status, lastError only
  readonly meta: ProjectedSnapshotMeta;   // schemaHash only
};
```

The default projection MUST NOT expose `namespaces`.

### 4.3 Agent context

```json
{
  "state": { "phase": "selecting" },
  "computed": { "canFinalize": false },
  "availableActions": []
}
```

Agent-facing context omits `namespaces` unless a debug or forensic tool explicitly requests them.

---

## 5. Canonicalization and Hashing

### 5.1 Two-level hash decomposition (alignment with ADR-016)

This ADR preserves the two-level hash model established by ADR-016.

**snapshotHash (state-level identity):**

```text
snapshotHash = hash(
  snapshot.state,
  semanticSystemDigest
)

semanticSystemDigest = hash(
  system.terminalStatus,
  system.currentError,
  system.pendingDigest
)
```

**worldId (commit-level identity):**

```text
worldId = hash(schemaHash, snapshotHash, parentWorldId)
```

`snapshot.meta.schemaHash` participates in worldId binding but **does not enter snapshotHash**. This separation is ADR-015 / 016's prior decision; this ADR preserves it exactly.

### 5.2 Hash-excluded fields

The following enter neither snapshotHash nor worldId:

```text
snapshot.computed       // derived, recomputable
snapshot.input          // transient
snapshot.meta.timestamp
snapshot.meta.randomSeed
snapshot.namespaces     // operational
snapshot.system.currentAction  // execution-scoped (per ADR-016)
```

### 5.3 Namespace exclusion — normative

```text
SNAP-HASH-1 (MUST NOT):
snapshot.namespaces MUST NOT enter either snapshotHash or worldId.
```

### 5.4 Hash continuity matrix

This ADR makes explicit how each hash level preserves continuity across the cut.

| Identity level | Inputs | Continuity condition | Result |
|----------------|--------|----------------------|--------|
| snapshotHash | `state` + `semanticSystemDigest` | same domain state, same semantic system fields | **Preserved** (SNAP-HASH-2) |
| worldId | `schemaHash` + `snapshotHash` + `parentWorldId` | same `schemaHash` AND same `snapshotHash` AND same `parentWorldId` | **Conditionally preserved** (SCHEMA-HASH-1~3) |

**Note:** worldId continuity requires all three inputs to match. A different `parentWorldId` produces a different worldId even if `snapshotHash` is identical. This follows directly from the definition of commit-level identity.

```text
SNAP-HASH-2 (MUST):
The snapshotHash input under this ADR MUST be bit-equivalent to the snapshotHash
input prior to this ADR.

Rationale:
- Pre-ADR snapshotHash input = (data with $* stripped) + semanticSystemDigest
                             = (domain state) + semanticSystemDigest
- Post-ADR snapshotHash input = state + semanticSystemDigest
                             = (the same domain state) + (the same semanticSystemDigest)

The same (domain state, semantic system) pair therefore produces the same snapshotHash.

SNAP-HASH-3 (MUST):
The WORLD-HASH-4a stripPlatformNamespaces helper is retired by this ADR.
The strip operation has been absorbed by partition separation; intra-partition
filtering is no longer required.
```

### 5.5 schemaHash continuity (worldId-level caveat)

worldId preservation requires schemaHash preservation in addition to snapshotHash preservation.

```text
SCHEMA-HASH-1 (MUST):
This Snapshot ontology cut MUST NOT alter DomainSchema.hash / schemaHash for the
same MEL source — to the extent this is achievable.

SCHEMA-HASH-2 (MUST):
Platform namespace relocation is a change to Snapshot **storage** ontology,
not to DomainSchema's **semantic** identity.

SCHEMA-HASH-3 (CAVEAT — honest disclosure):
If the existing current implementation injects $host / $mel into DomainSchema via
ADR-002's `withPlatformNamespaces` and that injection participates in schemaHash
computation, then this ADR introduces a schemaHash-level **epoch boundary**.

In that case:
- snapshotHash continuity is preserved by SNAP-HASH-2.
- worldId continuity is **broken at the pre-v5 → v5 boundary**.
- pre-v5 sealed worlds become **roots of a new lineage epoch** under v5.

If this case obtains, the v5 release notes MUST announce the worldId
discontinuity, and Genealogy Phase 1 dual schema identity
(intendedSchemaHash vs runtimeSchemaHash) consistency MUST be re-examined.
```

**Verification gate:** PR-1 (or PR-6) MUST verify whether the current v3 implementation includes platform-namespace augmentation in schemaHash computation. The verification result determines:

- *Not included* → SCHEMA-HASH-1 / 2 are satisfied naturally; worldId continuity holds.
- *Included* → SCHEMA-HASH-3 epoch boundary applies; v5 release notes MUST announce it.

---

## 6. Impacted Packages

### 6.1 Core (`@manifesto-ai/core`)

- `Snapshot.data` → `Snapshot.state`
- Add `Snapshot.namespaces`
- PatchPath root anchoring becomes channel-determined (PATCH-ROOT-1 / NSPATCH-ROOT-1 / PATCH-ROOT-2)
- Add NamespaceDelta application logic (NSDELTA-3)
- Support compiler-owned namespace materialization (NSDELTA-1a)
- Support compiler-owned namespace read paths (NSREAD-2)
- Trace separation: state read vs namespace read (NSREAD-3); Patch vs NamespaceDelta (NSDELTA-4)
- Enforce NSINIT-1 (`namespaces` always present)
- Update Snapshot fixtures and tests

### 6.2 Host (`@manifesto-ai/host`)

- Move Host-owned namespace from `data.$host` to `namespaces.host`
- Update effect handler context: `ctx.snapshot.data` → `ctx.snapshot.state`
- Use Host materialization channel (NSDELTA-1b)
- Update Host docs and tests

### 6.3 SDK (`@manifesto-ai/sdk`)

- `getSnapshot()` returns `.state`
- `getCanonicalSnapshot()` returns `.state` + `.namespaces`
- `simulate()` / `simulateIntent()` results expose `.state`
- Dispatch reports expose before/after `.state`
- Runtime event payloads expose `.state`
- Default projection excludes `namespaces`
- Type names: `Snapshot<TData>` → `Snapshot<TState>`

> SDK surface decisions (dispatch / simulate / report unification) live in sibling v5 ADRs. This ADR covers only the SDK changes that are unavoidable consequences of the ontology cut.

### 6.4 Compiler (`@manifesto-ai/compiler`)

- Domain patch lowering: PatchPath rooted at `snapshot.state` (PATCH-ROOT-1)
- `$mel` lowering: NamespaceDelta with namespaces-rooted PatchPath (NSDELTA-2a, NSPATCH-ROOT-1)
- Lower onceIntent's namespace read path (NSREAD-2)
- User expression validator enforces NSREAD-1 and COMP-DEP-1
- Regression tests for ADR-002 shallow-merge safety
- Verify whether `withPlatformNamespaces` participates in schemaHash (§5.5)

### 6.5 Lineage (`@manifesto-ai/lineage`)

- Sealed world Snapshot shape uses `state`, not `data`
- Stored canonical Snapshot lookup returns `state` + `namespaces`
- Two-level hash decomposition documented per §5.1
- snapshotHash excludes namespaces (SNAP-HASH-1)
- Retire `stripPlatformNamespaces` (SNAP-HASH-3)
- **Implement `migrateStoredSnapshotShape` and `normalizeForRestore` as distinct functions (§7.2)**
- Verify worldId continuity and process the SCHEMA-HASH-3 caveat per the verification gate

### 6.6 Governance (`@manifesto-ai/governance`)

- Proposal settlement reports expose `.state`
- Governed-runtime inherited reads expose `.state`
- Settlement failure logic continues to read from `system.lastError` (no change)

### 6.7 Studio / Agent tooling

- Inspector label "Data" → "State"
- Agent context readers consume `state`
- UI labels updated
- Hide `namespaces` by default; expose them in debug views
- Update skills, prompts, and examples

### 6.8 Constitution and docs

- **Constitution / CLAUDE.md** — update the canonical Snapshot definition (PR-1)
- Current Contract, all SPECs, MEL / Projection / Agent / Studio docs
- Migration guide
- Examples

---

## 7. Migration Policy

### 7.1 V5 hard cut

This ADR is the ontology layer of the v5 hard cut. No long-lived dual public API is provided.

```ts
// Retired in v5
snapshot.data
snapshot.data.$host
snapshot.data.$mel
snapshot.data.$*

// New surface
snapshot.state
snapshot.namespaces.host
snapshot.namespaces.mel
snapshot.namespaces.*
```

### 7.2 Storage shape migration vs restore normalization (separated)

This ADR makes the two phases explicit and distinct.

```text
RESTORE-ONTO-1 (MUST):
Storage shape migration and restore normalization are distinct phases.
A single function MUST NOT carry both responsibilities.
```

#### 7.2.1 `migrateStoredSnapshotShape` — storage shape migration

Converts legacy or new stored snapshots into v5 canonical shape. Used during forensic canonical lookup; **namespaces are preserved** (no operational reset).

```text
RESTORE-ONTO-2 (MUST):
migrateStoredSnapshotShape MUST forensic-preserve namespaces.
It MUST NOT apply operational field resets.
```

```ts
function migrateStoredSnapshotShape(stored: unknown): Snapshot {
  // already-new shape — passthrough
  if (hasField(stored, 'state')) {
    return ensureNamespacesPresent(stored as Snapshot);
  }

  const { data, ...rest } = stored as { data: Record<string, unknown> };

  // Generic separation: domain state vs ALL $* namespaces
  const namespaces: Record<string, unknown> = {};
  const domainState: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data ?? {})) {
    if (key.startsWith('$')) {
      // Strip $ prefix when relocating ($studio → studio)
      namespaces[key.slice(1)] = value;
    } else {
      domainState[key] = value;
    }
  }

  return ensureNamespacesPresent({
    ...rest,
    state: domainState,
    namespaces,
  });
}

// NSINIT-1 + NSINIT-4 deep-normalization
function ensureNamespacesPresent(snapshot: Snapshot): Snapshot {
  const namespaces = { ...(snapshot.namespaces ?? {}) };

  // host: ensure object presence (host fields are operational; no deep shape required)
  if (!namespaces.host || typeof namespaces.host !== 'object') {
    namespaces.host = {};
  }

  // mel: deep-normalize to NSINIT-2 shape
  namespaces.mel = deepNormalizeMel(namespaces.mel);

  return { ...snapshot, namespaces };
}

function deepNormalizeMel(mel: unknown): MelNamespace {
  const m = (mel && typeof mel === 'object') ? mel as Record<string, unknown> : {};
  const guards = (m.guards && typeof m.guards === 'object')
    ? m.guards as Record<string, unknown>
    : {};
  const intent = (guards.intent && typeof guards.intent === 'object')
    ? guards.intent as Record<string, unknown>
    : {};
  return { ...m, guards: { ...guards, intent } };
}
```

By SNAP-HASH-2, the migrated snapshot's snapshotHash equals the pre-migration snapshotHash.

#### 7.2.2 `normalizeForRestore` — execution input normalization

Used on `restore()` paths to produce execution input. Applies the ADR-016 *operational field reset* and enforces NSINIT-2 via deep-normalize.

```text
RESTORE-ONTO-3 (MUST):
normalizeForRestore MUST apply ADR-016's non-hash operational field reset
AND MUST guarantee the NSINIT-2 invariant via deep-normalization.
```

```ts
function normalizeForRestore(snapshot: Snapshot): Snapshot {
  return {
    state: snapshot.state,                    // domain preserved
    computed: snapshot.computed,              // derived, preserved (recomputable)
    system: {
      ...snapshot.system,
      currentAction: null,                    // ADR-016 — execution-scoped reset
    },
    input: null,                              // no in-flight action on restore
    meta: {
      ...snapshot.meta,
      timestamp: 0,                           // host context will set
      randomSeed: '',
    },
    namespaces: {
      host: {},                               // host bookkeeping reset
      mel: { guards: { intent: {} } },       // NSINIT-2 deep-normalize
      // unknown future namespaces: deterministic empty object
      ...stripUnknownNamespaceContents(snapshot.namespaces ?? {}),
    },
  };
}

function stripUnknownNamespaceContents(
  namespaces: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(namespaces)) {
    if (key !== 'host' && key !== 'mel') {
      result[key] = {};  // unknown future platform namespace → empty object
    }
  }
  return result;
}
```

#### 7.2.3 Call flow

```text
Storage read:
  raw = storage.read(key)
  canonical = migrateStoredSnapshotShape(raw)   // for forensic lookup

Forensic lookup:
  return canonical                               // operational state preserved

Restore for execution:
  return normalizeForRestore(canonical)          // operational state reset
```

This separation makes explicit what ADR-016 already implied implicitly. This ADR encodes it as normative rules (RESTORE-ONTO-1~3).

### 7.3 Codemod

```ts
// Snapshot field rename
snapshot.data              -> snapshot.state
getSnapshot().data         -> getSnapshot().state
result.snapshot.data       -> result.snapshot.state
canonicalSnapshot.data     -> canonicalSnapshot.state
worldSnapshot.data         -> worldSnapshot.state

// Namespace relocation (general $* handling)
snapshot.data.$<x>         -> snapshot.namespaces.<x>

// Type names (best effort)
Snapshot<TData>            -> Snapshot<TState>
```

The codemod MUST be type-aware: it MUST NOT rewrite generic `data` variables unrelated to Manifesto's Snapshot. It SHOULD restrict rewrites to bindings that depend on imports from `@manifesto-ai/sdk` or `@manifesto-ai/core`.

---

## 8. Non-Goals

This ADR does NOT change:

- MEL `state {}`, `computed`, or action declaration syntax
- `available when` / `dispatchable when` semantics
- `set` / `unset` / `merge` patch operation semantics
- The `system.lastError` semantic error model
- The Host effect handler conceptual contract
- Lineage / Governance authority semantics
- The `@meta` sidecar model
- SchemaGraph semantics
- onceIntent semantics (only its lowering target moves)
- ADR-016's hash decomposition model (preserved exactly)
- DomainSchema's semantic identity (SCHEMA-HASH-1)

This ADR does NOT introduce:

- A top-level `platform` field
- Top-level `$host` / `$mel` fields
- A new governance policy model
- An effect receipt ledger
- A replay receipt design

These are addressed by separate ADRs (some sibling to v5, others later).

---

## 9. Alternatives Considered

### 9.1 Keep `data`

**Rejected.** §1.3 (Codex friction) and §1.2 (accumulated cost) make the status quo no longer defensible.

### 9.2 Rename `data` → `state` but keep `$host` / `$mel` under `state.$*`

**Rejected.** §2.2 — placing platform namespaces inside the strong semantic name `state` is *worse* than the `data` status quo.

### 9.3 Top-level `$host` and `$mel`

**Rejected.** Top-level Snapshot ontology would grow with each new platform namespace, becoming an unstable extension surface.

### 9.4 `snapshot.platform`

**Rejected.** Too narrow — some namespaces are runtime, compiler, studio, planner, or debugging in nature, not platform.

### 9.5 `snapshot.runtime`

**Rejected.** Overlaps semantically with `system`.

### 9.6 `snapshot.namespaces`

**Accepted.** Explicit, extensible, and naturally maps to `$host`, `$mel`, and future namespaces. Forward-compatibility is a secondary benefit; the primary justifications are §1.2 (accumulated cost) and §1.3 (external user friction).

### 9.7 Alias-only

**Closest competing alternative. Explicitly considered and rejected.**

The alias-only option:

- Preserves SPEC §13.3 unchanged
- Adds `snapshot.state` as a read-only alias of `snapshot.data`
- Leaves `$host` / `$mel` in place (`data.$host`, `data.$mel`)
- Patch contract unchanged
- Hash inputs unchanged

**Cost:** roughly one alias getter and a type alias. Near-zero.

**Benefit:** resolves §1.3 (Codex friction).

**Load-bearing rejection rationale:**

The accumulated cost inventory in §1.2 is *not* resolved by an alias.

| Accumulated cost | Resolved by alias-only? |
|------------------|-------------------------|
| SCHEMA-RESERVED-1 / 2 ownership convention | ❌ — `$*` still cohabits |
| ADR-009 §2.8 PatchPath validation bypass | ❌ — unchanged |
| ADR-016 MRKL-RESTORE namespace normalization | ❌ — unchanged |
| WORLD-HASH-4a stripPlatformNamespaces | ❌ — unchanged |
| PROJ-COMP transitive `$*` filtering | ❌ — unchanged |
| SPEC §13.3 self-acknowledged dual naming | ❌ — preserved by definition |

An alias *hides* friction. It does *not* resolve entropy. Each new namespace (`$genealogy`, `$studio`, ...) repeats the pattern, raising cost monotonically.

By §1.4 (V5 hard cut window economics), deferring the cut is a deferral with positive cost; the cut window narrows monotonically. Alias-only is therefore a costlier deferral.

---

## 10. Risks

### 10.1 Large breaking surface

**Mitigation:** v5 unified release; single PR series; codemod; docs updated within the same PR series.

### 10.2 NamespaceDelta + NamespaceRead increase Core / Host complexity

**Mitigation:** Domain patch semantics unchanged; namespace surfaces accept only fixed-shape contracts (NSREAD-4); authority and materialization separated (NSDELTA-1 / 1a / 1b).

### 10.3 Risk of regression in onceIntent lowering

**Mitigation:** §3.6.1 specifies the fixed-shape merge path; ADR-002 regression tests carried forward.

### 10.4 Stored lineage artifact compatibility

**Mitigation:** §7.2.1 `migrateStoredSnapshotShape` handles all `$*` generically; SNAP-HASH-2 preserves snapshotHash → Merkle continuity holds at the snapshotHash level.

### 10.5 Constitution / ADR ordering risk

**Mitigation:** PR-1 includes the Constitution update.

### 10.6 schemaHash epoch boundary risk

If the v3 implementation incorporates platform-namespace augmentation into schemaHash, this ADR breaks worldId continuity (SCHEMA-HASH-3).

**Mitigation:**

- Verification step in PR-1 / PR-6 (§5.5).
- *Not included* → no further action.
- *Included* → v5 release notes MUST announce worldId epoch boundary; Genealogy Phase 1 dual schema identity consistency MUST be re-examined.

### 10.7 NSINIT normalization gaps

If migration or restore functions skip NSINIT-2 deep-normalization, `onceIntent`'s first execution may fail on a partial path.

**Mitigation:** Helper functions in §7.2.1 and §7.2.2 perform deep-normalization; PR-2 (Core) and PR-6 (Lineage) include unit tests.

### 10.8 Stale computed after restore

If the restore path returns a snapshot whose `computed` is stale relative to `state`, downstream consumers may observe inconsistency.

**Mitigation:** Per Manifesto's existing contract, `computed` is recalculated, never stored as authoritative state. PR-6 includes a test asserting that after `restore()`, `computed` is recomputed and not stale relative to the restored `state` before any legality check or read.

---

## 11. Implementation Plan

This ADR is NOT a multi-phase deployable rollout. It is a single PR series; intermediate states are not deployable.

### PR-1 — ADR acceptance, Constitution, Current Contract, schemaHash verification

- Accept this ADR.
- Update **Constitution / CLAUDE.md** canonical Snapshot definition.
- Update Current Contract with v5 ontology decision summary.
- Freeze terminology.
- **Verify the v3 schemaHash computation path** — confirm whether `withPlatformNamespaces` participates in schemaHash. The verification result determines SCHEMA-HASH-3 disposition (continuity preserved vs epoch boundary).

### PR-2 — Core ontology cut

- `Snapshot.data` → `Snapshot.state`; add `Snapshot.namespaces`.
- PatchPath channel-based root anchoring (PATCH-ROOT-1 / NSPATCH-ROOT-1 / PATCH-ROOT-2).
- NamespaceDelta type and apply logic (NSDELTA-3).
- Compiler-owned namespace read path support (NSREAD-2).
- Trace separation (NSDELTA-4, NSREAD-3).
- Enforce NSINIT-1 (always-present namespaces).
- Test fixtures updated.

### PR-3 — Host cut

- Move Host-owned namespace to `namespaces.host`.
- Update effect handler context.
- Host materialization (NSDELTA-1b).
- Host tests updated.

### PR-4 — Compiler cut

- `$mel` lowering → NamespaceDelta with namespaces-rooted PatchPath.
- onceIntent read/write lowering (§3.6.1).
- User expression validator: NSREAD-1, COMP-DEP-1 enforcement.
- ADR-002 shallow-merge safety regression tests.
- Compiler tests and docs updated.

### PR-5 — SDK cut

- Public Snapshot type updated.
- Projection updated.
- simulate / report / event payloads updated.
- Runtime helper docs updated.

### PR-6 — Lineage / Governance + migration / restore separation

- Sealed world Snapshot shape updated.
- Two-level hash decomposition documented (§5.1).
- snapshotHash excludes namespaces (SNAP-HASH-1).
- Retire `stripPlatformNamespaces` (SNAP-HASH-3).
- **Implement `migrateStoredSnapshotShape`** (§7.2.1).
- **Implement `normalizeForRestore`** (§7.2.2).
- Adopt the call flow in §7.2.3.
- Settlement reports updated.
- Apply the SCHEMA-HASH-3 verification result.
- **Computed staleness test (§10.8):** assert that after `restore()`, `computed` is recomputed from `state` and is not stale relative to the restored state, before any subsequent legality check or read.

### PR-7 — Studio / Agent tooling

- Inspector, agent context, labels updated; namespaces hidden by default.
- Skills and prompts updated.

### PR-8 — Docs / codemod

- All docs updated.
- Migration guide.
- AST codemod.
- Docs grep / lint guard.

### PR-9 — v5 release

- Release together with sibling v5 ADRs (SDK surface).
- Release notes reference this ADR and siblings.
- If SCHEMA-HASH-3 is in effect, the worldId epoch boundary is announced.

PR series ordering is *implementation-internal*; intermediate steps are not deployable. From the external user's perspective, v5 is a single cut.

---

## 12. Acceptance Criteria

This ADR is implemented when ALL of the following hold:

1. `Snapshot.data` no longer exists in any current public or canonical TypeScript type.
2. `Snapshot.state` is the canonical domain-state substrate.
3. `Snapshot.namespaces` exists for platform / runtime / compiler / tooling namespaces.
4. NSINIT-1: every v5 canonical Snapshot has `namespaces` as an always-present object.
5. `data.$host` and `data.$mel` no longer exist.
6. The Constitution / CLAUDE.md reflects the new ontology and no longer defines `data` as canonical.
7. PatchPath is root-relative; the root is determined by the channel (PATCH-ROOT-1 / NSPATCH-ROOT-1 / PATCH-ROOT-2).
8. ADR-009 §2.8 is retracted.
9. Host-owned namespace lives at `namespaces.host`.
10. Compiler / MEL-owned namespace lives at `namespaces.mel`.
11. Domain patches apply through `ComputeResult.patches` to `snapshot.state`.
12. Namespace mutation is processed exclusively through the NamespaceDelta channel.
13. NSDELTA-1~4 plus NSDELTA-1a / 1b / 2a are enforced.
14. NSREAD-1~4 are enforced.
15. COMP-DEP-1~3 are enforced.
16. NSINIT-2 deep-normalization applies to fresh, migrated, and restored snapshots (NSINIT-3 / 4).
17. onceIntent reads and writes `namespaces.mel.guards.intent` in fixed shape, preserving ADR-002 shallow-merge safety.
18. `getSnapshot()` exposes `state`.
19. `simulateIntent()` results expose `snapshot.state`.
20. Lineage stored snapshots use `state` and `namespaces`.
21. snapshotHash excludes `namespaces` (SNAP-HASH-1).
22. SNAP-HASH-2 is verified — pre-cut sealed worlds recompute to identical snapshotHash under the new ontology.
23. worldId is defined as `hash(schemaHash, snapshotHash, parentWorldId)`.
24. SCHEMA-HASH-1 / 2 are satisfied, OR the SCHEMA-HASH-3 epoch boundary is explicitly announced in v5 release notes.
25. `stripPlatformNamespaces` is retired (SNAP-HASH-3).
26. `migrateStoredSnapshotShape` and `normalizeForRestore` are implemented as distinct functions (RESTORE-ONTO-1~3).
27. `migrateStoredSnapshotShape` relocates all `$`-prefixed keys generically into `namespaces`.
28. Current docs no longer teach `snapshot.data` (migration notes excepted).
29. Agent / Studio tools expose `state` to ordinary users and hide `namespaces`.
30. A codemod is provided that automates common rename cases.
31. After `restore()`, `computed` is recomputed from the restored `state` and is not stale relative to it (§10.8).

---

## 13. Open Questions

### 13.1 Is `namespaces` required or optional?

**Disposition:** Required (NSINIT-1 — always present, may be empty). Final implementation confirms.

### 13.2 Future namespace plurality

New namespaces require:

- A separate ADR.
- Passing the §3.8.1 semantic-vs-operational test.
- Registration under NSREAD-2 / NSDELTA-2a if compiler-owned.

### 13.3 Type parameter naming

`Snapshot<TState>` recommended. SDK PR (PR-5) finalizes.

### 13.4 `@meta` sidecar impact

No change required. The `state_field` annotation target becomes semantically more accurate.

### 13.5 SCHEMA-HASH-3 disposition

Determined by PR-1 verification result.

### 13.6 Compiler-owned construct registry format

Currently inline (one entry: onceIntent). If the registry grows beyond three entries, consider extracting to a separate SPEC.

---

## 14. Final Decision

**Accepted.**

Manifesto v5 retires `Snapshot.data`, promotes domain state to `Snapshot.state`, and separates platform / runtime / compiler / tooling namespaces under `Snapshot.namespaces`.

The result is the following alignment:

```text
MEL declares:        state { ... }
Runtime exposes:     snapshot.state
UI reads:            state
Agent reasons over:  state
Lineage seals:       state (+ semantic system)
PatchPath:           root-relative; root determined by transition channel
Domain patches:      ComputeResult.patches → state-rooted
Namespace writes:    NamespaceDelta.patches → namespaces[namespace]-rooted
onceIntent:          fixed-shape mel namespace read/write (NSREAD-2 + NSDELTA-2a)
namespaces.mel:      always deep-normalized to NSINIT-2 shape
snapshotHash:        hash(state, semanticSystemDigest)
worldId:             hash(schemaHash, snapshotHash, parentWorldId)
                     (continuity conditional on SCHEMA-HASH-3 verification)
User code:           cannot read or write namespaces
Compiler-owned:      may read/write namespaces in fixed shape only
Computed dependency: state and other computed only
Storage migration:   migrateStoredSnapshotShape (forensic preserve)
Execution restore:   normalizeForRestore (operational reset, NSINIT-2 enforced)
```

The intent is to make Manifesto's founding model — a runtime that grounds UI and Agent in the same domain world — *consistent at the ontology level of the runtime itself*. UI authors, MEL authors, and Agent tools all reason about a `state`. The runtime now exposes that same `state` directly, and isolates the operational substrate that supports execution but does not belong to the domain.

The cut is large. Keeping `data` or co-locating `$host` / `$mel` under `state` would each preserve a deeper conceptual mismatch. Manifesto cannot serve as a grounding runtime between UI and Agent if its Snapshot surface uses an ontology that diverges from the one MEL authors, UI renderers, and Agent tools actually use.

This ADR is accepted within the v5 hard cut window — bus factor 1, pre-stable artifacts, surfaced external user friction. Beyond this window, the marginal cost of any equivalent cut rises monotonically.

---

## Appendix A — Revision History

- **revision 1 (2026-04-29):** Initial formal draft (Korean).
- **revision 2 (2026-04-29):** GPT cross-review round 1 fixes (Korean):
  - Added NamespaceRead contract (§3.5.3, NSREAD-1~4).
  - Split NSDELTA-2 into user-authored prohibition and compiler-owned fixed-shape allowance.
  - Rewrote §5 hash decomposition (snapshotHash vs worldId separation).
  - Added Constitution / CLAUDE.md to PR-1 scope.
  - Added §3.9 (COMP-DEP-1~3).
  - §7.2.1 migration adapter generalized to all `$*` keys.
  - §3.6.1 onceIntent fixed lowering contract.
  - §3.6.2 compiler-owned construct registry.
- **revision 3 (2026-04-29):** GPT cross-review round 2 fixes (Korean):
  - **Redline 1 — channel-determined PatchPath root:** retracted §3.4 in favor of PATCH-ROOT-1 / NSPATCH-ROOT-1 / PATCH-ROOT-2. Added ADR-009 §2.8 to the explicit retraction list. Made the differing roots of `NamespaceDelta.patches` and `ComputeResult.patches` explicit at the type level.
  - **Redline 2 — NSDELTA-1 authority/materialization split:** rewrote "emit" framing as "authority + materialization." Split into NSDELTA-1 (authority), NSDELTA-1a (Core materialization for mel), NSDELTA-1b (Host materialization for host).
  - **Redline 3 — namespace initialization invariants:** added §3.5.4 with NSINIT-1~5. NSINIT-4's deep-normalize obligation guards against partial corruption and ensures onceIntent's first execution.
  - **Redline 4 — migration vs restore normalization separation:** split §7.2 into §7.2.1 (`migrateStoredSnapshotShape`, forensic preserve), §7.2.2 (`normalizeForRestore`, operational reset), §7.2.3 (call flow). Added RESTORE-ONTO-1~3 as normative rules. Renamed function for clarity.
  - **Redline 5 — worldId continuity precision and schemaHash continuity:** added the §5.4 hash continuity matrix with explicit `parentWorldId` impact. Added §5.5 with SCHEMA-HASH-1~3 — SCHEMA-HASH-3 is honest disclosure regarding the impact of ADR-002's `withPlatformNamespaces` on schemaHash. Added a verification step to PR-1 and a corresponding §10.6 risk.
- **revision 4 (2026-04-29):** GO confirmed by GPT cross-review round 3. English formalization, ADR number 025 assigned, status promoted to Accepted. Added §10.8 (computed staleness risk) and Acceptance Criterion 31 (computed-not-stale test in PR-6) per cross-review implementation note.
