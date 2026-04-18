# ADR-022: Compiler-Owned Source Location Sidecar (`SourceMapIndex`)

> **Status:** Accepted (v11)
> **Date:** 2026-04-16
> **Deciders:** 정성우 (Architect), Manifesto Architecture Team
> **Scope:** Compiler (MEL output contract), Tooling, Docs
> **Related ADRs:** ADR-001 (Layer Separation), ADR-009 (Structured PatchPath), ADR-021 (`@meta` Structural Annotation Sidecar)
> **Related SPECs:** Compiler SPEC v1.0.0, Core SPEC v4.2.0, SDK SPEC v3.x
> **Breaking:** No — additive tooling-only sidecar; Core/Host/SDK runtime layers unchanged
> **Preserves:** `DomainSchema` hash, `SchemaGraph`, `AnnotationIndex`, runtime entrypoint contract
> **Current-truth alignment:** This ADR is subordinate to the owning package SPECs and the current-contract page. Where ambiguity exists, owning package SPEC > current-contract page > this ADR.

---

## 0. Revision Note

### v11 (2026-04-16, acceptance + polish)

**Accepted** after nine review cycles (v2 → v10). Status flips from `Proposed` to `Accepted`. Two non-blocking polish items applied per final review:

- **§14 Compiler SPEC list gains `SourceMapEmissionContext`** as a new type introduced by this ADR. Oversight from v8 when the type was added to §10.2 but not back-referenced in the spec-changes summary.
- **§15 Review Checklist gains a quick-reference cache key table** at the top, compressing the per-artifact scope (§5.2) into a three-row lookup for scan-speed during review.

No normative change. `SourceMapIndex` shape, cache rules, trace scope, extraction contract, and API-surface rules are byte-identical to v10.

Phase 0 consumer evidence annex is a separate deliverable and not part of this ADR file (see `ADR-022-Phase0-Annex.md` for the skeleton).

### v10 (2026-04-16, eighth review)

Resolves one API-surface representation issue: the ADR's §10.1 entrypoint block read as a public API shape change, conflicting with the header's "No — additive tooling-only sidecar" promise and with current compiler wrapper-form API (`result.success / result.errors? / result.schema?` style).

- **§10.1 rewritten in wrapper-form.** New `CompileMelDomainResult` / `CompileMelModuleResult` type sketches make explicit that only `DomainModule` gains `sourceMap` (§3.1), while the rest of the result wrapper — success discriminant, diagnostics, errors, metadata — is unchanged. The type blocks are labeled illustrative and omit fields this ADR does not touch, rather than re-declaring the current compile-result contract.
- **SMAP-API-1..4 added.** Normative rules pinning down that this ADR introduces exactly one new field on `DomainModule` and no other change to the compile-result surface.
- **Concrete function names removed from §6 / §7 / §14.** `compileMelDomain()` and `compileMelModule()` references in SMAP-ARCH-2/3, INV-SMAP-3, the §14 Compiler SPEC bullet, and the §14 API Docs example replaced with role-based phrasing ("schema-only compile entrypoint", "module compile entrypoint"). Specific function naming belongs to the compiler SPEC, not to this ADR.
- **§14 API Docs example corrected** to use wrapper-form access (`if (result.module) { ... }`) instead of chaining on a hypothetical function return.

No type change inside `SourceMapIndex`, no new cache rules, no new invariants. This is an API-surface alignment pass.

### v9 (2026-04-16, seventh review)

Alignment pass only — no normative change. Brings the summary and checklist layers into line with the three-axis identity model that v7 established but v8 had not yet propagated everywhere.

- **§12.1 Positive #4 updated** from `(schemaHash, sourceHash) gives consumers exact cache-invalidation signals` to per-artifact phrasing: `schemaHash` for semantic artifacts, `(schemaHash, sourceHash)` for `AnnotationIndex` under a fixed compiler version, `(schemaHash, sourceHash, emissionFingerprint)` for `SourceMapIndex` and `DomainModule`.
- **§15 checklist "Per-artifact cache scope" item updated** from `sidecars on tuple` to the explicit per-artifact breakdown that matches §5.2.
- **§15 checklist "SMAP-HASH-5/7 contradict" item updated** to reference the 5a/5b/5c split landed in v7 and describe the correct per-artifact key for each.

No type changes, no rule changes, no new invariants. Body normative content (§3, §4, §5, §7, §10) is byte-identical to v8.

### v8 (2026-04-16, sixth review)

Resolves one extract-contract contradiction introduced in v7, plus two polish items.

- **`extractSourceMap()` now takes `SourceMapEmissionContext` as an explicit input.** v7 simultaneously required (a) `emissionFingerprint` to be a deterministic function of `coordinateUnit` + compiler version + future emission options (SMAP-EMIT-FP-1), and (b) `extractSourceMap(ast, source, schema)` to depend only on AST, source text, and `DomainSchema` (SMAP-EMIT-1). Those cannot both be true — there is no path from the v7 extract inputs to the v7 fingerprint inputs. v8 introduces `SourceMapEmissionContext = { coordinateUnit, compilerVersion, emissionOptionsFingerprint }` as a fourth explicit input to `extractSourceMap()`. `SMAP-EMIT-1` is amended accordingly, a new SMAP-EMIT-5 requires the compiler to populate the context faithfully, and SMAP-EMIT-FP-1 is rewritten as a deterministic function of the context. `emissionOptionsFingerprint` absorbs future emission options without further signature churn (the same opacity pattern applied to `emissionFingerprint` itself).
- **Phase 1 identity-model bullet updated** from `(schemaHash, sourceHash)` to the three-axis `(schemaHash, sourceHash, emissionFingerprint)` model that v5/v7 actually established.
- **§15 checklist cardinality item updated** to reference `SMAP-HASH-1..9` and `SMAP-EMIT-FP-1..5` together, and a new checklist item verifies that `extractSourceMap()` and SMAP-EMIT-FP-1 do not contradict.

### v7 (2026-04-16, fifth review)

Resolves one cache-identity gap introduced in v6.

- **`emissionFingerprint` added as `SourceMapIndex`'s third identity axis.** v6 made `coordinateUnit` an observable field on `SourceMapIndex`, which by design can vary across emissions of the same `(schemaHash, sourceHash)` (e.g., a utf16 build vs a bytes build of the same source on the same compiler version). But v6 SMAP-HASH-5 still keyed sidecar caches on `(schemaHash, sourceHash)` alone, which meant two structurally different `SourceMapIndex` instances could collide on the same cache slot. v7 adds `emissionFingerprint: string` to `SourceMapIndex` — an opaque, deterministic hash composed by the compiler over `coordinateUnit`, compiler version, and any future emission options. Adds SMAP-EMIT-FP-1..5. Splits SMAP-HASH-5 into 5a/5b/5c: `AnnotationIndex` keeps the `(schemaHash, sourceHash)` tuple under a fixed compiler version (its content is emission-option-independent in current contract), `SourceMapIndex` uses `(schemaHash, sourceHash, emissionFingerprint)`, `DomainModule` blob inherits the strictest triple.
- **Three-axis identity model made explicit in §3.2.2.** semantic (`schemaHash`, observable) / physical source (`sourceHash`, observable) / emission (`emissionFingerprint`, opaque). `format` is a separate literal protocol-version field. `coordinateUnit` remains an observable payload encoding flag. Each axis evolves independently. **Amended by v8 above** — v7 left the extract-contract path from context to fingerprint unwritten.

### v6 (2026-04-16, fourth review)

Resolves one type-level contract contradiction introduced in v5.

- **`format` vs `coordinateUnit` separated into two fields.** v5 `SourceMapIndex` declared `format: "manifesto/source-map-v1"` as a fixed literal, then SMAP-OFFSET-1 said the unit (`utf16`/`bytes`) had to be encoded *inside* `format`, with examples like `"manifesto/source-map-v1+utf16"`. Those two normative statements are type-level incompatible — the same field cannot be both a fixed literal and an extended union in the same contract. v6 splits them: `format` remains the protocol version literal, and a new `coordinateUnit: "utf16" | "bytes"` field carries payload encoding. This preserves independent evolution axes — format can bump to v2 (e.g., for extended `SourceMapPath` kinds under ADR-022c) without constraining coordinate encoding choice, and vice versa. SMAP-OFFSET-1..5 renumbered and restated accordingly. **Amended by v7 above** — v6 still left cache identity incomplete.

### v5 (2026-04-16, third review)

Resolves one internal inconsistency + one polish item flagged in the third architecture review.

- **Hash / cache rule split by artifact class.** v4 §5.1 described `schemaHash` match as sufficient to reuse `SchemaGraph` **and** `AnnotationIndex`, while v4 SMAP-HASH-5 required all consumer caches to key on the `(schemaHash, sourceHash)` tuple. These two normative statements contradict each other. Current contract already settles the underlying question: `@meta` (ADR-021 INV-META-1/2) and `SourceMapIndex` (INV-SMAP-3/4) are invariant to `DomainSchema` / `SchemaGraph`, which means sidecars can vary within a fixed `schemaHash`. v5 separates cache scope by artifact: runtime-semantic products (`DomainSchema`, `SchemaGraph`, activation artifacts) MAY reuse on `schemaHash` alone; sidecars (`AnnotationIndex`, `SourceMapIndex`) and `DomainModule` blobs MUST use the tuple. Rules are renumbered SMAP-HASH-1..9 with explicit per-artifact scope.
- **`SourcePoint` unit ambiguity made explicit.** v4 described `offset` as byte offset without committing to a column/offset unit convention. Editor tooling (LSP) uses UTF-16 code units; some compiler front-ends use bytes. v5 does not fix the choice but requires the compiler to declare the unit alongside `format`. **Superseded by v6 above** — the v5 approach entangled the unit with `format`, v6 splits them into separate fields.

### v4 (2026-04-16, second review)

One critical correction from the second architecture review:

- **Trace replay scope further reduced to action-level only (via `TraceGraph.intent.type`).** v3 promised "enclosing declaration (action or computed) highlight," but the current Core trace contract exposes `TraceNode.kind`, `TraceNode.sourcePath` (as an opaque schema-navigation string), and `TraceGraph.intent.type`. Only the last is a stable consumer-facing coordinate today. Mapping an arbitrary trace node *up to its enclosing computed declaration* would require `sourcePath` parsing stability, which this ADR explicitly defers to ADR-022c. v1 therefore promises only what `TraceGraph.intent.type` can deliver: `action:<intent.type>` highlighting. Computed-level and sub-declaration highlighting both defer to ADR-022c.
- Related: §13 Phase 0 evidence annex MUST cite a concrete trace surface path (Core `TraceGraph` via compiler/host integration, or a future tooling path). At the time of the v4 review SDK `SimulateResult` did not expose trace. The current SDK now exposes dry-run trace via `SimulateResult.diagnostics.trace`, which MAY be cited as an evidence surface for action-level trace-replay highlighting.

### v3 (2026-04-16, first review)

v3 incorporated the first 2026-04-16 architecture review. Four critical corrections and two polish items:

1. **`SourceMapPath.domain` now carries a `name`** — the v2 shape could not round-trip through its own `LocalTargetKey` grammar. Fixed.
2. **Graph↔source is an explicit mapping, not a direct join** — v2 overstated shared-key-space symmetry. `SchemaGraphNodeId` uses `state:*` while `LocalTargetKey` uses `state_field:*`. A compiler-owned mapping function is now normative (§9.1).
3. **`action_param` is excluded from v1** — ADR-021's *landed* subset excludes `action_param` pending a separate grammar decision (ADR-021 Companion Notes). Per current-truth rule, this ADR follows the landed subset rather than the ADR-021 grammar text. `SourceMapIndex` Kind set is therefore exactly `AnnotationIndex` landed Kind set, and co-evolves with it.
4. **Trace replay scoped to enclosing-declaration highlighting** — further narrowed in v4 (see above).

Polish: `SourceLocation` → `SourceSpan` (reflects that it carries start+end). `SMAP-HASH-3` relaxed to hold only within a fixed compiler version and compile options.

---

## 1. Context

### 1.1 The Gap

The compiler already knows where MEL constructs come from in source text — AST nodes carry source locations during parsing. After lowering, however, the current emission envelope preserves only:

- `DomainSchema` — semantic runtime artifact
- `SchemaGraph` — projected static dependency artifact
- `AnnotationIndex` — user-authored structural sidecar (ADR-021)

Nothing in the envelope answers the physical question:

> "Which MEL source span produced this declaration?"

That drives three downstream needs — editor navigation, coarse trace highlighting (§9.2), and coverage/inspection tooling. Without a compiler-owned answer, tooling either re-parses MEL or guesses via name matching, duplicating compiler knowledge the compiler already holds.

### 1.2 Why `AnnotationIndex` Does Not Solve This

`@meta` is intentionally user-authored, **partial**, and **semantic**. Per ADR-021 §2.3–2.5, annotations attach only where the author declares them, carry opaque tag strings the compiler does not interpret, and express semantic hints rather than physical coordinates.

A compiler-owned source map has the opposite shape: **compiler-produced**, **total over declarations**, **physical** (line/column, not semantic). Collapsing the two forces either `@meta` to become mandatory and compiler-authored, or source maps to become user-authored and partial. Both are wrong.

The correct pattern is **sibling sidecars under a shared key space**: different payloads, same key. ADR-021 established `AnnotationIndex`; this ADR introduces `SourceMapIndex` as its structural sibling.

### 1.3 Why Declaration-Level Only in v1

The earlier draft proposed mapping source spans down to body-statement resolution. Review concluded:

- No landed consumer currently requires body-statement resolution at the *source map* layer. (Trace *itself* uses sub-declaration `sourcePath`, but that is a runtime artifact, not a sidecar — see §1.5.)
- `SchemaGraph` operates at declaration level.
- `AnnotationIndex` operates at declaration + one-level-child.

Extending source-map resolution below declaration level in v1 would require inventing a new coordinate system the compiler does not externalize elsewhere. That violates the Manifesto principle **"separation by evidence, not by speculation."** Body-level resolution is therefore deferred to ADR-022c with explicit entry criteria (§11.3).

### 1.4 Why `OriginIndex` Is Not Part of This ADR

The earlier draft proposed a second sidecar, `OriginIndex`, to express 1:N source→semantic provenance for compiler-introduced expansion.

MEL is declarative and non-Turing-complete. The landed lowering surface (ADR-013a `flow`/`include`, ADR-013b entity collection primitives, `dispatchable when`) does not currently produce 1:N fan-out that consumers cannot reconstruct from declaration-level mapping alone. Admitting `OriginIndex` in v1 would mean either a mostly-identity mapping that duplicates `SourceMapIndex`, or speculative roles without concrete producers. Both violate evidence-first discipline. Deferred to ADR-022b (§11.2).

### 1.5 A Note on Trace vs Source Map Granularity

A natural question: if the current Core `TraceNode` already carries sub-declaration `sourcePath`, why does this ADR only map declarations, and why does v1 further promise only action-level highlighting?

Because the stable, consumer-facing surface of the current Core trace contract is narrower than `TraceNode` as a whole. What v1 can lean on today is:

- `TraceGraph.intent.type` — the action name that triggered computation. Stable, consumer-facing.
- `TraceNode.kind` — stable.
- `TraceNode.sourcePath` — **a Core-internal schema navigation string**, not yet a stabilized consumer contract.

Promising "enclosing-declaration highlight including computeds" would require `sourcePath` parsing — walking up the schema-navigation string to find the containing declaration. That couples tooling to a string format this ADR explicitly cannot stabilize. v1 therefore promises only the `TraceGraph.intent.type` → `action:<name>` join. Everything above that is deferred to ADR-022c, which can co-specify `sourcePath` stability with Core.

This is the honest version of what v1 can deliver from the current trace contract.

---

## 2. Decision

### 2.1 Add One Compiler-Owned Sidecar

`DomainModule` gains one tooling-only sidecar:

```typescript
type DomainModule = {
  readonly schema: DomainSchema;
  readonly graph: SchemaGraph;
  readonly annotations: AnnotationIndex;
  readonly sourceMap: SourceMapIndex;   // new, tooling-only
};
```

### 2.2 Sidecar Boundary

`SourceMapIndex` obeys the same boundary discipline as `AnnotationIndex` (ADR-021 META-2, META-4):

- MUST NOT appear inside `DomainSchema`
- MUST NOT affect `DomainSchema.hash`
- MUST NOT affect `SchemaGraph` derivation
- MUST NOT be accepted by any runtime entrypoint
- MUST remain out-of-schema tooling data

Runtime entrypoints (`createManifesto()`, Core `compute`, Host dispatch, SDK activation) continue to accept `DomainSchema` only. That boundary is reaffirmed, not extended.

---

## 3. Artifact Model

### 3.1 Shape

```typescript
type SourceMapIndex = {
  readonly schemaHash: string;            // semantic identity
  readonly sourceHash: string;            // physical source identity
  readonly format: "manifesto/source-map-v1";            // protocol version
  readonly coordinateUnit: "utf16" | "bytes";            // observable payload encoding
  readonly emissionFingerprint: string;                  // opaque cache identity (§3.2.2)
  readonly entries: Record<LocalTargetKey, SourceMapEntry>;
};

type SourceMapEntry = {
  readonly target: SourceMapPath;   // structured truth (§4)
  readonly span: SourceSpan;         // physical coordinate
};

type SourceSpan = {
  readonly start: SourcePoint;
  readonly end: SourcePoint;
};

type SourcePoint = {
  readonly line: number;      // 1-indexed
  readonly column: number;    // 1-indexed, in the units specified by `SourceMapIndex.coordinateUnit`
  readonly offset?: number;   // optional, in the units specified by `SourceMapIndex.coordinateUnit`
};
```

### 3.2 Why `SourceSpan`, not `SourceLocation`

v1 always emits a range (declarations have a beginning and an end). Calling it `Location` would either mislead consumers ("is this a point or a range?") or collide with whatever the compiler's AST layer already names a single-point location. `SourceSpan` with explicit `start` / `end` `SourcePoint`s is unambiguous and parallel to standard tooling ecosystems (LSP, TextMate).

If the compiler's internal AST uses its own `SourceLocation` type, this ADR does *not* adopt or rename it. `SourceSpan` is a dedicated contract type on the sidecar boundary. Internal AST representations remain compiler-private.

### 3.2.1 Coordinate Unit — Separate Field from Format

`SourcePoint.column` and `SourcePoint.offset` must agree on a unit. The two viable choices are:

- **UTF-16 code units** — what LSP and most JavaScript tooling assume
- **bytes** — what some compiler front-ends (including some Manifesto compiler internals) may use natively

This ADR does **not** fix the choice at v1. It is declared per emission via a dedicated `coordinateUnit` field on `SourceMapIndex` (see §3.1).

**Why a dedicated field, not an extension of `format`.** An earlier draft encoded the unit inside `format` (e.g., `"manifesto/source-map-v1+utf16"`). That conflated two orthogonal concerns: `format` is an **artifact protocol version**, while unit is a **payload encoding choice**. A future `"manifesto/source-map-v2"` should be free to bump for reasons unrelated to coordinate encoding (e.g., extended `SourceMapPath` kinds per ADR-022c), and a compiler should be free to switch coordinate encoding within a single protocol version without version-bump ceremony. Separating the two fields preserves both axes of evolution.

| ID | Level | Rule |
|----|-------|------|
| SMAP-OFFSET-1 | MUST | `SourceMapIndex.coordinateUnit` MUST be declared as exactly `"utf16"` or `"bytes"` |
| SMAP-OFFSET-2 | MUST | A single emitted `SourceMapIndex` MUST use a single unit for all entries (determined by `coordinateUnit`) |
| SMAP-OFFSET-3 | MUST | Mixing units across a single `SourceMapIndex` is a compiler bug; consumers MAY reject such output |
| SMAP-OFFSET-4 | MUST | `coordinateUnit` MUST NOT participate in `SourceMapIndex.format`. The two are orthogonal axes of contract evolution |
| SMAP-OFFSET-5 | SHOULD | Consumers that target LSP-based tooling SHOULD prefer `"utf16"`; consumers that target byte-oriented pipelines (e.g., external tree-sitter) SHOULD prefer `"bytes"`. The compiler may offer either, documented per release. |

This is deliberately light-touch: v1 does not force a unit choice, but v1 does forbid silent ambiguity. Editor tooling will hit this immediately once adoption begins; declaring it as a distinct field prevents silent mismatches and preserves independent evolution of protocol version and coordinate encoding.

### 3.2.2 Emission Fingerprint — Opaque Cache Identity

`coordinateUnit` is observable: consumers read it directly and branch tooling accordingly (UTF-16 path vs byte path). But cache identity cannot rely on `coordinateUnit` alone, because future emission options (canonicalization mode, included span metadata, etc.) will also vary the payload without changing `(schemaHash, sourceHash)`. Encoding every such option into the cache key one-by-one would force consumer cache contracts to churn every time a new emission axis lands.

`emissionFingerprint` exists to absorb that churn. It is an **opaque, deterministic hash** composed by the compiler over — at minimum — `coordinateUnit` and the compiler version, plus any future emission options that affect `SourceMapIndex` payload. Consumers treat it as an opaque string: equal fingerprint = interchangeable `SourceMapIndex`; unequal fingerprint = distinct emissions regardless of `(schemaHash, sourceHash)` match.

Three identity axes, cleanly separated:

| Axis | Field | Nature | Purpose |
|---|---|---|---|
| Semantic | `schemaHash` | observable | Is the `DomainSchema` the same? |
| Physical source | `sourceHash` | observable | Is the source text byte-identical? |
| Emission | `emissionFingerprint` | opaque | Is this the same compiler+options emission? |

`format` is a literal protocol version (the *shape* contract). `coordinateUnit` is an observable encoding flag (the *payload* contract). `emissionFingerprint` is opaque cache identity. Keeping all three separate lets each evolve independently: `format` bumps for shape changes, `coordinateUnit` toggles per emission, `emissionFingerprint` absorbs everything else.

| ID | Level | Rule |
|----|-------|------|
| SMAP-EMIT-FP-1 | MUST | `emissionFingerprint` MUST be a deterministic function of `SourceMapEmissionContext` (`coordinateUnit` + `compilerVersion` + `emissionOptionsFingerprint`). See §10.2 for how the compiler supplies this context to `extractSourceMap()`. |
| SMAP-EMIT-FP-2 | MUST | Two emissions with the same `(schemaHash, sourceHash)` but different `emissionFingerprint` MUST be treated as distinct artifacts by consumer caches |
| SMAP-EMIT-FP-3 | MUST | Two emissions with the same `(schemaHash, sourceHash, emissionFingerprint)` MUST be byte-identical (modulo structural equality on `entries`) |
| SMAP-EMIT-FP-4 | MUST | Consumers MUST treat `emissionFingerprint` as opaque — no parsing, no substring assumptions, no cross-compiler comparison |
| SMAP-EMIT-FP-5 | SHOULD | The compiler SHOULD document which inputs participate in `emissionFingerprint` in its release notes, even though the format itself is opaque |

### 3.3 Why This Shape

Three design choices, each ruling out a subtly-broken simpler alternative.

**Choice 1 — Key reuses `LocalTargetKey` from ADR-021.**

`AnnotationIndex.entries` and `SourceMapIndex.entries` share the same key space. A consumer holding a `LocalTargetKey` (from either sidecar, or derived from a `SchemaGraph` node via the mapping in §9.1) can join into both sidecars by string identity. No parallel enums, no divergent coordinate drift.

**Choice 2 — `target` is structured, not a rendered string.**

ADR-009 established that flattening structured paths into dotted strings at contract boundaries is a *representational impossibility*, not an ergonomic inconvenience. `SourceMapPath` is a discriminated union (§4). Any string rendering is a display helper, not the contract.

**Choice 3 — `schemaHash` and `sourceHash` are independent identities.**

Semantic identity (ADR-006 CAN-3/CAN-4) and physical source-text identity answer different questions and have different change profiles. Conflating them would either make whitespace reformatting change `DomainSchema.hash` (breaking ADR-021 INV-META-1) or let source-location maps silently mismatch their source text. See §5 for cardinality.

---

## 4. `SourceMapPath` Model

### 4.1 Closed Discriminated Union

```typescript
type SourceMapPath =
  | { readonly kind: "domain";       readonly name: string }
  | { readonly kind: "type";         readonly name: string }
  | { readonly kind: "type_field";   readonly typeName: string; readonly fieldName: string }
  | { readonly kind: "state_field";  readonly name: string }
  | { readonly kind: "computed";     readonly name: string }
  | { readonly kind: "action";       readonly name: string };
```

### 4.2 Rationale

The `kind` set is **exactly the currently-landed `AnnotationIndex` `LocalTargetKey` Kind set** (ADR-021 Companion Notes: "the current landed/documented subset excludes `action_param`; that grammar decision remains deferred"). Because current-truth rule places owning package SPEC and maintained docs above ADR-021's grammar text, v1 `SourceMapIndex` follows the landed subset.

Consequence: `action_param` is **excluded from v1**. When ADR-021 (or a successor) lands `action_param` in the annotation grammar, `SourceMapIndex` extends in lockstep through an explicit format-version bump. Until then, `action_param` source spans are out of scope; consumers that need them can compute them from `ActionSpec.params` ordering + the action's span, or wait for the lockstep extension.

**Why identical Kind set, not strict superset.** A superset approach ("v1 source map includes `action_param` even though v1 annotations do not") was considered and rejected. Two sibling sidecars with different Kind sets is exactly the coordinate drift the shared-key-space principle exists to prevent. The lockstep discipline is the slow-but-correct path.

**The earlier draft's `domain` variant without a `name` field** was a round-trip bug: `LocalTargetKey` grammar requires `domain:<n>`, so a `{ kind: "domain" }` without a name could not serialize to its own key. Fixed in v3 §4.1.

### 4.3 Key Rendering

A `SourceMapPath` renders to `LocalTargetKey` by ADR-021 §2.4 grammar:

```
{ kind: "domain",       name: "TaskBoard"              } → domain:TaskBoard
{ kind: "type",         name: "Task"                   } → type:Task
{ kind: "type_field",   typeName: "Task",
                        fieldName: "title"             } → type_field:Task.title
{ kind: "state_field",  name: "tasks"                  } → state_field:tasks
{ kind: "computed",     name: "visibleTasks"           } → computed:visibleTasks
{ kind: "action",       name: "archive"                } → action:archive
```

The rendered `LocalTargetKey` is the `entries` map key. `target` inside each entry preserves the structured form.

### 4.4 Rules

| ID | Level | Rule |
|----|-------|------|
| SMAP-PATH-1 | MUST | `SourceMapPath.kind` is a closed union equal to ADR-021 `LocalTargetKey` **landed** Kind set |
| SMAP-PATH-2 | MUST | Every emitted entry's `target`, when rendered by ADR-021 §2.4 grammar, MUST equal the entry's `LocalTargetKey` |
| SMAP-PATH-3 | MUST | `SourceMapPath` extension (new kinds, body-level resolution) requires a new ADR and `format` version bump |
| SMAP-PATH-4 | MUST | When ADR-021 lands a new Kind (e.g., `action_param`), `SourceMapPath` co-extends in the same release under an explicit format-version bump |
| SMAP-PATH-5 | MUST NOT | Rendered dotted strings MUST NOT be accepted as public mutation API; they are tooling lookup keys only |

---

## 5. Identity: `schemaHash` × `sourceHash`

### 5.1 Why Two Hashes

- Same source text → same `schemaHash`, same `sourceHash`
- Whitespace-only / comment-only / source-ordering reformatting → same `schemaHash`, **different** `sourceHash`
- `@meta` addition or removal → same `schemaHash` (ADR-021 INV-META-1), different `sourceHash`
- Semantic change → different `schemaHash`, different `sourceHash`

The two hashes answer different questions, and consumer caches MUST apply them at different granularities depending on which artifact they hold. A single blanket rule would either let sidecars go stale (schemaHash alone) or block legitimate `SchemaGraph` reuse (tuple always).

### 5.2 Per-Artifact Cache Scope

The current sidecar contract already establishes that `@meta` presence does not affect `DomainSchema`, `DomainSchema.hash`, or `SchemaGraph` (ADR-021 INV-META-1/2/3). `SourceMapIndex` inherits the same property by SMAP-ARCH-5/6 and INV-SMAP-3/4. Consequently, **different sidecars cannot share the same cache-key discipline as runtime-semantic artifacts.** Further, `SourceMapIndex` has a *third* identity axis (`emissionFingerprint`, §3.2.2) because the same `(schemaHash, sourceHash)` can produce observably different emissions under different compiler versions or emission options (e.g., `coordinateUnit = "utf16"` vs `"bytes"`).

| Artifact | Cache key | Why |
|---|---|---|
| `DomainSchema` (runtime) | `schemaHash` | Semantic identity; by construction unaffected by sidecars, reformatting, or emission options |
| `SchemaGraph` (projected semantic) | `schemaHash` | Derived from `DomainSchema` alone (current contract) |
| Runtime products derived from `DomainSchema` alone (e.g., activation artifacts) | `schemaHash` | Same reasoning |
| `AnnotationIndex` (user sidecar) | `(schemaHash, sourceHash)` **under a fixed compiler version** | `@meta` presence/content varies with source text but not with emission options in the current contract. MUST NOT reuse on `schemaHash` alone |
| `SourceMapIndex` (compiler sidecar) | `(schemaHash, sourceHash, emissionFingerprint)` | Emission options (`coordinateUnit`, future options) vary output under fixed `(schemaHash, sourceHash)`; fingerprint absorbs that variability |
| `DomainModule` blob | `(schemaHash, sourceHash, emissionFingerprint)` | Transitively contains `SourceMapIndex`; inherits strictest key |

Finer-grained sidecar cache keys (e.g., a separate `annotationHash`) are out of scope for this ADR. They may be introduced by future ADRs if sidecar-only invalidation becomes a measured hot path.

**Why `emissionFingerprint` on `SourceMapIndex` but not on `AnnotationIndex`.** The current `@meta` contract is emission-option-independent: annotation extraction consumes AST structure and `@meta` literal content, not `coordinateUnit` or any option this ADR introduces. If a future ADR (or ADR-021 successor) adds emission options that affect `AnnotationIndex` payload, the correct response is to add a parallel `emissionFingerprint` to `AnnotationIndex` in that ADR. This ADR does not preemptively do so.

### 5.3 Cardinality Rules

| ID | Level | Rule |
|----|-------|------|
| SMAP-HASH-1 | MUST | `SourceMapIndex.schemaHash` equals the sibling `DomainSchema.hash` in the same `DomainModule` emission |
| SMAP-HASH-2 | MUST | `sourceHash` is computed from the exact physical MEL source text passed to the compiler |
| SMAP-HASH-3 | MUST | **Given a fixed compiler version and fixed compile options**, one `sourceHash` deterministically produces exactly one `schemaHash`. Consumers MUST NOT assume this holds across compiler versions or compile-option differences. |
| SMAP-HASH-4 | MAY  | One `schemaHash` may correspond to many `sourceHash` values (whitespace, comment, ordering reformatting, and `@meta` edits that preserve semantics) |
| SMAP-HASH-5a | MUST | Consumers caching `AnnotationIndex` MUST key on the tuple `(schemaHash, sourceHash)` **under a fixed compiler version**. If the compiler version changes, consumers MUST invalidate the cache entry |
| SMAP-HASH-5b | MUST | Consumers caching `SourceMapIndex` MUST key on the triple `(schemaHash, sourceHash, emissionFingerprint)` |
| SMAP-HASH-5c | MUST | Consumers caching `DomainModule` as a whole blob MUST key on the triple `(schemaHash, sourceHash, emissionFingerprint)` (inherits strictest key from `SourceMapIndex`) |
| SMAP-HASH-6 | MUST NOT | Consumers caching `AnnotationIndex` or `SourceMapIndex` on `schemaHash` alone is forbidden — the underlying content can vary within a fixed `schemaHash` |
| SMAP-HASH-7 | MAY  | Consumers caching `DomainSchema`, `SchemaGraph`, or runtime products derived from `DomainSchema` alone MAY key on `schemaHash` alone. ADR-021 INV-META-1/2 and INV-SMAP-3/4 together guarantee invariance under sidecar variation, and `emissionFingerprint` does not affect these artifacts |
| SMAP-HASH-8 | MUST NOT | v1 MUST NOT apply source canonicalization; whitespace/comment changes MUST produce a different `sourceHash` |
| SMAP-HASH-9 | MUST NOT | `sourceHash` MUST NOT participate in `DomainSchema.hash` computation (preserves ADR-021 INV-META-1 semantics) |

SMAP-HASH-5a/5b/5c and SMAP-HASH-7 together resolve the blanket-rule contradiction and the `coordinateUnit` cache-identity gap in one pass. Runtime-semantic artifacts keep `schemaHash`-only reuse (which is their whole point — identity independent of sidecars and emission options). `AnnotationIndex` uses `(schemaHash, sourceHash)` because its content is option-independent under current contract. `SourceMapIndex` and the `DomainModule` blob use the triple `(schemaHash, sourceHash, emissionFingerprint)` because emission options (`coordinateUnit` today, more options tomorrow) do change their payload.

SMAP-HASH-3 is deliberately scoped. The same source compiled by a future compiler version or with different compile options may legitimately produce a different schema. That is not a bug to paper over; it is a property consumers must respect when their cache keys cross version or option boundaries.

SMAP-HASH-8 is the strict-but-explainable choice. Source canonicalization would collapse "is this the same source?" into a compiler-internal policy. v1 keeps that question local. A future ADR may relax it alongside an explicit canonicalization spec.

---

## 6. Boundary Rules

| ID | Level | Rule |
|----|-------|------|
| SMAP-ARCH-1 | MUST | `sourceMap` MUST exist only in `DomainModule`, never in `DomainSchema` |
| SMAP-ARCH-2 | MUST | Schema-only compile entrypoints MUST remain schema-only; they MUST NOT emit `sourceMap` |
| SMAP-ARCH-3 | MUST | Module compile entrypoints MUST emit `sourceMap` as part of the returned `DomainModule` |
| SMAP-ARCH-4 | MUST | `.mel` loader/bundler default export MUST remain compiled `DomainSchema` only |
| SMAP-ARCH-5 | MUST | Core, Host, SDK, Lineage, Governance MUST NOT read or require `sourceMap` |
| SMAP-ARCH-6 | MUST | `SchemaGraph` derivation MUST remain independent of `sourceMap` |
| SMAP-ARCH-7 | MUST | `AnnotationIndex` and `SourceMapIndex` are sibling sidecars, not extensions of one another |
| SMAP-ARCH-8 | MUST | Runtime entrypoints MUST continue to accept `DomainSchema` only, not `DomainModule` |
| SMAP-ARCH-9 | MUST | `SourceMapIndex` MUST be total over every declaration present in the companion `DomainSchema` under the landed `SourceMapPath` Kind set (§4.1) |

SMAP-ARCH-9 is the compiler-owned completeness guarantee. Unlike `AnnotationIndex` (user-authored, partial), `SourceMapIndex` is compiler-produced and consumers may rely on totality *within the currently-landed Kind set*. When the Kind set extends (§4.4 SMAP-PATH-4), totality extends with it through the same release.

---

## 7. Completeness Invariants (CI-Enforced)

| ID | Invariant |
|----|-----------|
| INV-SMAP-1 | For every declaration in emitted `DomainSchema` under the landed `SourceMapPath` Kind set (domain, types, type fields, state fields, computeds, actions), `SourceMapIndex.entries` MUST contain exactly one entry with the matching `LocalTargetKey` |
| INV-SMAP-2 | `SourceMapIndex.schemaHash` MUST equal `DomainSchema.hash` in the same emission |
| INV-SMAP-3 | `DomainSchema` emitted with `SourceMapIndex` present MUST be byte-identical to `DomainSchema` emitted without `SourceMapIndex` (e.g., via a schema-only compile entrypoint) |
| INV-SMAP-4 | `SchemaGraph` emitted alongside `SourceMapIndex` MUST be identical to `SchemaGraph` emitted without it |
| INV-SMAP-5 | For any snapshot and intent, `compute()` / `getAvailableActions()` / `isIntentDispatchable()` results MUST be identical regardless of `SourceMapIndex` presence |
| INV-SMAP-6 | `DomainModule` containing `SourceMapIndex` MUST NOT be accepted by `createManifesto()` or any runtime entrypoint |
| INV-SMAP-7 | For any two MEL sources `A` and `B` with `schemaHash(A) = schemaHash(B)`, swapping `SourceMapIndex(A)` with `SourceMapIndex(B)` MUST NOT change any runtime semantics (runtime-independence) |
| INV-SMAP-8 | For every entry, the rendered form of `entry.target` MUST equal the entry's `LocalTargetKey` (round-trip) |

INV-SMAP-3/4 are the structural parallels of ADR-021 INV-META-1/2. INV-SMAP-7 is the runtime-independence backstop. INV-SMAP-8 is new in v3 — it catches the class of round-trip bug that the v2 `domain` variant had.

---

## 8. Relationship to `@meta` / `AnnotationIndex`

### 8.1 Sibling Sidecars, Not a Hierarchy

| Property | `AnnotationIndex` (ADR-021) | `SourceMapIndex` (this ADR) |
|---|---|---|
| Producer | User (via `@meta`) | Compiler |
| Completeness | Partial | Total over landed Kind set |
| Purpose | Semantic / tooling hint | Physical source coordinate |
| Key space | `LocalTargetKey` (landed subset) | `LocalTargetKey` (same landed subset) |
| Payload | `{ tag, payload? }[]` | `{ target, span }` |
| Runtime impact | None | None |
| Tag semantics | Opaque to compiler | N/A |

### 8.2 Why the Completeness Difference Is Principled

A user-authored sidecar **must** be partial: total `@meta` coverage would be punishing to write and would reduce annotations to noise. Its value is in the authored hint, not the density.

A compiler-owned sidecar **must** be total (over the landed Kind set): the compiler has the information trivially, and consumers need a uniform contract to reason about. Partial compiler output silently shifts "what tooling can assume" into the compiler's implementation details.

The *shared landed Kind set* is what keeps these asymmetric sidecars joinable. When the Kind set grows, it grows on both sides in the same release.

### 8.3 Combined Consumer Flow

```typescript
// studio-core: from a graph node, get source span + authored annotations
function navigateFromGraphNode(
  node: SchemaGraphNode,
  module: DomainModule,
): { span: SourceSpan; hints: Annotation[] } {
  const key: LocalTargetKey = graphNodeToLocalTargetKey(node);  // §9.1
  return {
    span:  module.sourceMap.entries[key].span,
    hints: module.annotations.entries[key] ?? [],
  };
}
```

---

## 9. Consumer Model

### 9.1 Graph ↔ Source — Explicit Mapping

`SchemaGraphNodeId` and `LocalTargetKey` use **different kind labels** for the same declarations:

| Declaration | `SchemaGraphNodeId` | `LocalTargetKey` |
|---|---|---|
| state field `tasks` | `state:tasks` | `state_field:tasks` |
| computed `visibleTasks` | `computed:visibleTasks` | `computed:visibleTasks` |
| action `archive` | `action:archive` | `action:archive` |

`state` ↔ `state_field` rename is the asymmetry. `computed` and `action` align. This ADR therefore specifies a compiler-owned mapping function rather than claiming a direct join.

```typescript
// Exposed by the compiler package alongside SourceMapIndex
function graphNodeIdToLocalTargetKey(id: SchemaGraphNodeId): LocalTargetKey;
// "state:X"     → "state_field:X"
// "computed:X"  → "computed:X"
// "action:X"    → "action:X"

function graphNodeToLocalTargetKey(node: SchemaGraphNode): LocalTargetKey;
// convenience over graphNodeIdToLocalTargetKey(node.id)
```

| ID | Level | Rule |
|----|-------|------|
| SMAP-GRAPH-1 | MUST | The compiler package MUST expose `graphNodeIdToLocalTargetKey()` as a pure, total function over `SchemaGraphNodeId` |
| SMAP-GRAPH-2 | MUST | The mapping MUST preserve the declaration name unchanged |
| SMAP-GRAPH-3 | MUST | Graph nodes not present in the landed `SourceMapPath` Kind set (none in v1, reserved for future Kind additions) MUST be handled explicitly by the mapping contract |

`SchemaGraph` does not currently model type declarations, type fields, or domain-level metadata. Source navigation for those constructs uses `LocalTargetKey` directly without graph mediation. This is expected, not a gap.

### 9.2 Trace Replay ↔ Source — Action-Level Highlight Only

The current Core trace contract exposes `TraceNode.kind`, `TraceNode.sourcePath` (an opaque schema-navigation string), and `TraceGraph.intent.type`. Of these, only `TraceGraph.intent.type` is a stable consumer-facing coordinate today.

v1 therefore uses **only** `TraceGraph.intent.type` as the join key:

```typescript
// v1-sanctioned trace highlight
function actionLevelHighlight(
  graph: TraceGraph,
  module: DomainModule,
): SourceSpan | undefined {
  const key = `action:${graph.intent.type}` as LocalTargetKey;
  return module.sourceMap.entries[key]?.span;
}
```

| ID | Level | Rule |
|----|-------|------|
| SMAP-TRACE-1 | MUST | v1 trace replay tooling using `SourceMapIndex` MUST highlight **only** the action identified by `TraceGraph.intent.type`, rendered as `LocalTargetKey` `action:<intent.type>` |
| SMAP-TRACE-2 | MUST NOT | v1 tooling MUST NOT claim computed-level, statement-precise, or expression-precise source highlighting from `SourceMapIndex` |
| SMAP-TRACE-3 | MUST NOT | v1 tooling MUST NOT parse `TraceNode.sourcePath` to derive highlight targets. `sourcePath` is not a stabilized consumer contract in v1 |
| SMAP-TRACE-4 | SHOULD | Computed-level, statement-precise, and expression-precise highlighting SHOULD wait for ADR-022c, which co-specifies `TraceNode.sourcePath` stability with Core and extends the `SourceMapPath` Kind set |

Concretely: if a trace under `intent.type = "archive"` contains branches, computed evaluations, and effects, v1 highlights `action:archive`'s span. Nothing finer. Promising "the enclosing computed declaration of *this* trace node" would require `sourcePath` parsing, and that is exactly what v1 does not stabilize.

This is a genuine scope reduction relative to v3, and the right one — v1 promises only what the current Core trace contract can back.

### 9.3 Editor Navigation

Cursor-position → source-map lookup is the reverse direction and requires a spatial index built by the consumer over `SourceMapIndex.entries`. v1 does not prescribe that index. A future ADR may standardize it once more than one consumer needs it.

---

## 10. Emission

### 10.1 Entrypoints

This ADR does **not** introduce new compiler entrypoints or change the shape of existing ones. Current compiler entrypoints already return result wrappers with optional `schema` / `module` fields alongside diagnostics; this ADR operates entirely within the existing wrapper form. The sole observable change is that `DomainModule.sourceMap` becomes present in the module-level result.

```typescript
// Schema-only entrypoint result — wrapper shape unchanged by this ADR
type CompileMelDomainResult = {
  readonly schema?: DomainSchema;
  // existing success discriminant, diagnostics, errors, and metadata fields unchanged
};

// Module entrypoint result — wrapper shape unchanged by this ADR;
// the embedded `DomainModule` now carries an additional `sourceMap` field per §3.1
type CompileMelModuleResult = {
  readonly module?: DomainModule;  // DomainModule gains `sourceMap` (§3.1); other fields unchanged
  // existing success discriminant, diagnostics, errors, and metadata fields unchanged
};
```

The type blocks above are **illustrative**: they show only the field this ADR introduces, not a re-declaration of the current compile-result contract. Any field not listed here is inherited from the current compiler output contract unchanged. No result field is removed, renamed, or re-typed by this ADR.

| ID | Level | Rule |
|----|-------|------|
| SMAP-API-1 | MUST | Schema-only compile result shape MUST be unchanged by this ADR |
| SMAP-API-2 | MUST | Module compile result shape MUST be unchanged by this ADR except for `DomainModule` gaining `sourceMap` (§3.1) |
| SMAP-API-3 | MUST | No existing compile-result field MAY be removed, renamed, or re-typed as a consequence of this ADR |
| SMAP-API-4 | MUST | The addition of `sourceMap` to `DomainModule` MUST preserve the "No — additive tooling-only sidecar" promise in this ADR's header |

This framing makes the scope of the ADR exact: **one new field on `DomainModule`**, nothing else in the compile-result surface.

### 10.2 Extraction

```typescript
type SourceMapEmissionContext = {
  readonly coordinateUnit: "utf16" | "bytes";
  readonly compilerVersion: string;
  readonly emissionOptionsFingerprint: string;   // opaque hash of any other compile/emission options that affect SourceMapIndex payload (future extensibility)
};

function extractSourceMap(
  ast: MelAst,
  source: string,
  schema: DomainSchema,
  ctx: SourceMapEmissionContext,
): SourceMapIndex;
```

`SourceMapEmissionContext` makes the fingerprint's inputs first-class in the extraction contract rather than smuggling them in through compiler-global state. The compiler populates `ctx` from its own version and the active compile options; `extractSourceMap()` composes `ctx.coordinateUnit`, `ctx.compilerVersion`, and `ctx.emissionOptionsFingerprint` into the resulting `SourceMapIndex.emissionFingerprint` per SMAP-EMIT-FP-1.

`emissionOptionsFingerprint` exists so that the extract contract does not have to re-enumerate every future emission option as a new parameter. When ADR-022c (or any later ADR) adds emission options, they fold into `emissionOptionsFingerprint` without changing `extractSourceMap()`'s signature.

| ID | Level | Rule |
|----|-------|------|
| SMAP-EMIT-1 | MUST | `extractSourceMap()` MUST depend only on AST, source text, `DomainSchema`, and `SourceMapEmissionContext` |
| SMAP-EMIT-2 | MUST | `extractSourceMap()` MUST NOT consult `AnnotationIndex` or `SchemaGraph` |
| SMAP-EMIT-3 | MUST | `extractAnnotations()` and `extractGraph()` MUST NOT consult `SourceMapIndex` or `SourceMapEmissionContext` |
| SMAP-EMIT-4 | MUST | Emission order: `schema` → `graph` / `annotations` / `sourceMap` (three siblings, independent) |
| SMAP-EMIT-5 | MUST | The compiler MUST populate `SourceMapEmissionContext` before invoking `extractSourceMap()`; `ctx.compilerVersion` MUST match the actual compiler build, and `ctx.emissionOptionsFingerprint` MUST deterministically reflect the active compile options |
| SMAP-EMIT-6 | SHOULD | Implementations MAY share AST traversal with other passes for performance, provided isolation invariants (SMAP-EMIT-2, SMAP-EMIT-3) hold |

### 10.3 Completeness Audit

Per INV-SMAP-1 and SMAP-ARCH-9, the compiler MUST fail compilation if any declaration in the emitted `DomainSchema` under the landed `SourceMapPath` Kind set lacks a corresponding source-map entry. This is the compiler's internal invariant, not a consumer validation.

---

## 11. Non-Goals and Deferred Items

### 11.1 Non-Goals

This ADR does **not**:

- change Core, Host, SDK, Lineage, or Governance contracts
- change `DomainSchema` structure or hash computation
- change `SchemaGraph` structure, edges, or derivation
- change `TraceEvent` / `TraceNode` shape or runtime trace semantics
- stabilize Core `TraceNode.sourcePath` for consumer use (reserved for ADR-022c co-specification)
- replace `@meta` / `AnnotationIndex`
- define UI rendering or Studio behavior
- define a public runtime path DSL
- introduce source canonicalization
- introduce multi-file / multi-document MEL compilation

### 11.2 Deferred to ADR-022b (`OriginIndex`)

Entry criteria:

1. At least one landed lowering path that demonstrably produces 1:N source→semantic fan-out consumers cannot reconstruct from `SourceMapIndex` + `DomainSchema` alone.
2. At least two concrete consumer use cases that require `role: "expansion-site" | "generated-from"` distinction.
3. Explicit cardinality rules parallel to §5.2.

### 11.3 Deferred to ADR-022c (Computed-Level + Statement / Expression Resolution + Trace Co-Spec)

Entry criteria:

1. A concrete consumer (trace stepper, guard debugger, or equivalent) that demonstrably requires computed-level or sub-declaration resolution.
2. Co-specification with Core on `TraceNode.sourcePath` stability, including which sub-declaration positions and which enclosing-declaration walks are guaranteed to be addressable across compiler versions.
3. Stable extension of `SourceMapPath` that does not leak AST internals.
4. Invariants parallel to INV-SMAP-1 over the extended coordinate space.

### 11.4 Deferred: `action_param`

Entry criteria:

1. ADR-021 (or successor) lands `action_param` in the annotation grammar.
2. `SourceMapPath` extends `{ kind: "action_param", actionName: string, paramName: string }` in the same release under explicit format-version bump (SMAP-PATH-4).

---

## 12. Consequences

### 12.1 Positive

1. Declaration-level source navigation becomes a first-class tooling contract.
2. Graph↔source joins reduce to one compiler-owned mapping function + shared-key lookup.
3. Annotation↔source joins reduce to a shared-key lookup (identical key space by construction).
4. Per-artifact identity gives consumers exact cache-invalidation signals: `schemaHash` for semantic artifacts, `(schemaHash, sourceHash)` for `AnnotationIndex` under a fixed compiler version, and `(schemaHash, sourceHash, emissionFingerprint)` for `SourceMapIndex` and `DomainModule`.
5. Runtime contracts (Core/Host/SDK/Lineage/Governance) remain byte-unchanged.
6. Kind-set lockstep with `AnnotationIndex` removes a whole class of future drift.

### 12.2 Trade-offs

1. `DomainModule` grows from three artifacts to four.
2. Closed `SourceMapPath` union couples v1 to the current landed declaration set. Extensions are explicit ADRs + format-version bumps. Intended cost.
3. v1 trace replay highlighting is **action-level only** (via `TraceGraph.intent.type`). Consumers wanting computed-level, statement-precise, or expression-precise highlighting wait for ADR-022c. Intended cost.
4. `action_param` spans are unavailable in v1. Consumers can approximate via `ActionSpec.params` + action span, or wait for the lockstep landing.

### 12.3 Explicit Trade-off Rejections

- **Render `SourceMapPath` as a dotted string.** Rejected under ADR-009.
- **Expose raw `AstNodeKind`.** Rejected; `LocalTargetKey` Kind is the established closed enum.
- **Merge into `AnnotationIndex` under a reserved namespace.** Rejected; would force `@meta` to become total and compiler-authored.
- **Ship `OriginIndex` in v1 as mostly-identity mapping.** Rejected as YAGNI without 1:N evidence.
- **Superset Kind set (include `action_param` even though annotation landed subset excludes it).** Rejected; sibling sidecar drift is exactly what shared-key-space prevents.
- **Claim statement-precise trace replay with declaration-only source map.** Rejected; user promise would exceed artifact resolution.
- **Promise "enclosing-declaration highlight including computed-level" in v1 by parsing `TraceNode.sourcePath`.** Rejected; couples v1 tooling to a Core-internal string format this ADR explicitly cannot stabilize. Computed-level highlighting defers to ADR-022c where `sourcePath` stability can be co-specified with Core.

---

## 13. Rollout

### Phase 0 — Consumer Evidence Collection (precondition)

Before Phase 1, at least two concrete consumer use cases MUST be documented:

- studio-core graph→source navigation
- one of: **action-level** trace highlight (via `TraceGraph.intent.type`), coverage reporting, or editor jump-to-definition

Evidence annex notes:

- The current SDK `SimulateResult` exposes dry-run trace via `diagnostics.trace`. Phase 0 evidence for trace-highlight use cases MUST still cite a concrete trace surface path, and `simulate().diagnostics.trace` is now a valid action-level evidence surface alongside Core `TraceGraph` integrations.
- Claims beyond action-level highlight (computed-level, statement-precise, expression-precise) do not satisfy Phase 0 for v1; they are evidence for ADR-022c, not v1.

This preserves "separation by evidence." v1 design was shaped by anticipated consumers; Phase 0 confirms they are real before compiler surface area grows.

### Phase 1 — ADR Acceptance

- sidecar boundary accepted
- `LocalTargetKey` reuse (landed subset) confirmed with ADR-021 authors
- `DomainModule` expansion accepted
- `(schemaHash, sourceHash, emissionFingerprint)` three-axis identity model accepted, with per-artifact cache scope (§5.2)
- `graphNodeIdToLocalTargetKey()` exposure accepted

### Phase 2 — Compiler SPEC Patch

- Compiler SPEC v1.0.0 companion subsection for `SourceMapIndex`
- Module compile entrypoint result wrapper carries an expanded `DomainModule` (gains `sourceMap` per §3.1); wrapper shape itself is unchanged
- `extractSourceMap()` contract added
- `graphNodeIdToLocalTargetKey()` exposed from compiler package
- INV-SMAP-* invariants added to compiler CI
- no runtime package SPEC changes

### Phase 3 — Tooling Adoption

- studio-core graph↔source navigation
- action-level trace replay highlight via `TraceGraph.intent.type` (consumer-side, no runtime changes)
- coverage / inspection utilities

---

## 14. Specification Changes Summary

### Compiler SPEC

- `DomainModule` gains `sourceMap: SourceMapIndex`
- Current output contract expands from three artifacts to four
- New types: `SourceMapIndex`, `SourceMapEntry`, `SourceMapPath`, `SourceSpan`, `SourcePoint`, `SourceMapEmissionContext`
- New function exposure: `graphNodeIdToLocalTargetKey()`
- `extractSourceMap()` emission rule added
- INV-SMAP-* invariants added

### API Docs

```typescript
// Module compile result wrapper — shape unchanged by this ADR.
// `result.module` embeds DomainModule; DomainModule now includes sourceMap (§3.1):
if (result.module) {
  const { schema, graph, annotations, sourceMap } = result.module;
}
```

Runtime examples (`createManifesto()`, Core `compute`, Host dispatch, SDK activation) remain unchanged.

### Other Packages

- Core: no changes
- Host: no changes
- SDK: no changes
- Lineage: no changes
- Governance: no changes

---

## 15. Review Checklist

**Cache key quick reference** (detailed in §5.2):

| Artifact | Cache key |
|---|---|
| `DomainSchema` / `SchemaGraph` / runtime products | `schemaHash` |
| `AnnotationIndex` | `(schemaHash, sourceHash)` under fixed compiler version |
| `SourceMapIndex` / `DomainModule` blob | `(schemaHash, sourceHash, emissionFingerprint)` |

Before acceptance, reviewers MUST confirm:

- [ ] Phase 0 consumer evidence annex populated with at least two use cases
- [ ] `SourceMapPath.kind` set is byte-identical to ADR-021 `LocalTargetKey` **landed** Kind set
- [ ] `{ kind: "domain", name }` round-trips via §4.3 grammar
- [ ] `graphNodeIdToLocalTargetKey()` behavior is specified for every `SchemaGraphNodeKind`
- [ ] `(schemaHash, sourceHash, emissionFingerprint)` cardinality rules (SMAP-HASH-1..9, SMAP-EMIT-FP-1..5) are unambiguous
- [ ] SMAP-HASH-3 scope ("fixed compiler version and compile options") is acceptable to consumer caches
- [ ] **Per-artifact cache scope table (§5.2) matches consumer intuition** — `DomainSchema` / `SchemaGraph` on `schemaHash` alone; `AnnotationIndex` on `(schemaHash, sourceHash)` under a fixed compiler version; `SourceMapIndex` and `DomainModule` on `(schemaHash, sourceHash, emissionFingerprint)`
- [ ] **SMAP-HASH-5a/5b/5c and SMAP-HASH-7 explicitly do not contradict** — `AnnotationIndex` on `(schemaHash, sourceHash)` under a fixed compiler version; `SourceMapIndex` and `DomainModule` on `(schemaHash, sourceHash, emissionFingerprint)`; runtime-semantic artifacts on `schemaHash` alone
- [ ] `extractSourceMap()` receives `SourceMapEmissionContext` as an explicit input (SMAP-EMIT-1, SMAP-EMIT-5); its signature and SMAP-EMIT-FP-1 do not contradict
- [ ] §10.1 entrypoint description reads as wrapper-form result types (`CompileMelDomainResult` / `CompileMelModuleResult`), not as new function signatures (SMAP-API-1..4)
- [ ] The only change to compile-result surface is `DomainModule` gaining `sourceMap` (SMAP-API-2)
- [ ] No existing compile-result field is removed, renamed, or re-typed (SMAP-API-3)
- [ ] `SourceMapIndex` declares `format` (protocol version), `coordinateUnit` (utf16 or bytes), and `emissionFingerprint` (opaque cache identity) as three separate fields (SMAP-OFFSET-1, SMAP-OFFSET-4, SMAP-EMIT-FP-1)
- [ ] `emissionFingerprint` is deterministic over `coordinateUnit` + compiler version + any future emission options (SMAP-EMIT-FP-1)
- [ ] Cache rules split explicitly: `AnnotationIndex` on `(schemaHash, sourceHash)` under fixed compiler version (SMAP-HASH-5a); `SourceMapIndex` and `DomainModule` blob on `(schemaHash, sourceHash, emissionFingerprint)` (SMAP-HASH-5b, 5c)
- [ ] INV-SMAP-3, INV-SMAP-4, INV-SMAP-7, INV-SMAP-8 tests are implementable in existing compiler CI
- [ ] `SMAP-TRACE-*` scope (**action-level only via `TraceGraph.intent.type`**) is acceptable to trace-replay tooling owners
- [ ] Phase 0 trace-highlight evidence cites a concrete trace surface (including `SDK SimulateResult.diagnostics.trace` when appropriate)
- [ ] No runtime SPEC (Core/Host/SDK/Lineage/Governance) requires modification
- [ ] `OriginIndex`, body-level resolution, **computed-level resolution**, and `action_param` all remain deferred with explicit entry criteria

---

*End of ADR-022 v11 — Accepted*
