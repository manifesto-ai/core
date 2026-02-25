# ADR-009: Structured PatchPath (Segments)

> **Status:** Accepted
> **Date:** 2026-02-25
> **Deciders:** Manifesto Architecture Team
> **Scope:** Core, Compiler, Host, Runtime, World
> **Resolves:** [#108](https://github.com/manifesto-ai/core/issues/108), [#189](https://github.com/manifesto-ai/core/issues/189)
> **Supersedes:** None
> **Implemented-by:** [/packages/core/src/schema/patch.ts](../../packages/core/src/schema/patch.ts), [/packages/core/src/core/apply.ts](../../packages/core/src/core/apply.ts), [/packages/compiler/src/lowering/lower-runtime-patch.ts](../../packages/compiler/src/lowering/lower-runtime-patch.ts) (planned in PR-B)
> **Strengthens:** FDR-015 (Static Patch Paths), FDR-MEL-032 (Dynamic Path Segments)
> **Breaking:** Yes — Major version bump required for Core, Compiler

---

## 1. Context

### 1.1 The Bottleneck

Manifesto's patch system has a single bottleneck that produces two distinct failures.

The MEL IR already represents paths as structured `PathNode[]`:

```typescript
// Compiler SPEC v0.5.0 §7.2.2 — MEL IR (CURRENT)
type PathSegment = { kind: 'prop'; name: string };
type PathNode = PathSegment[];

// Example: user.name → [{ kind: 'prop', name: 'user' }, { kind: 'prop', name: 'name' }]
```

However, the lowering step (Compiler SPEC §17.3.3) **flattens** this to a string:

```typescript
// Compiler SPEC v0.5.0 §17.3.3 — get Lowering (CURRENT)
// MEL: { kind: 'get', path: [{prop:'user'}, {prop:'name'}] }
// Core: { kind: 'get', path: 'user.name' }
```

And `ConditionalPatchOp` carries this string forward:

```typescript
// Compiler SPEC v0.5.0 §17.5 — ConditionalPatchOp (CURRENT)
type ConditionalPatchOp = {
  condition?: CoreExprNode;
  op: "set" | "unset" | "merge";
  path: string;              // ← THE BOTTLENECK
  value?: CoreExprNode;
};
```

The same `path: string` propagates to the Core `Patch` type that reaches `core.apply()`.

This single design point — **`path: string` at the Compiler→Core boundary** — is the root cause of both reported issues.

### 1.2 Issue #108: Key Corruption in Replay/Restore

When a Record key contains `.`, `:`, or `/` (e.g., `file:///proof.lean`, `TACTIC_FAILED:simp`), the dot-notation encoding creates an **irreversible ambiguity**:

```
// Intent: set the key "file:///proof.lean" in data.history.files
// Encoded: "history.files.file:///proof.lean"
// Decoded: ["history", "files", "file:///proof", "lean"]  ← WRONG
```

The problem is not a parsing bug — it is a **representational impossibility**. The dot character serves as both path separator and key content. No escaping scheme resolves this cleanly because:

1. Escaping (e.g., `\.`) requires all consumers to implement unescape logic.
2. Any escape character chosen can itself appear in keys, creating recursive escaping.
3. Existing serialized data cannot be retroactively escaped without ambiguity.

**Impact:** Patch → Store → Restore cycle produces a different snapshot. Replay determinism is broken.

### 1.3 Issue #189: Record Dynamic Key Rejection

Runtime validation rejects patches targeting `Record<string, T>` with dynamic keys:

```
// MEL: patch messages[$system.uuid] = { ... }
// After lowering: path = "messages.abc-123-def"
// Validator: "Unknown patch path: messages.*" → REJECTED
```

The validator performs string pattern matching against the schema. Since `Record<string, T>` admits **arbitrary** string keys, no fixed pattern can distinguish "unknown field" from "legitimate Record entry."

**Impact:** The most common domain modeling pattern (id-keyed entity stores) is blocked at the framework level.

### 1.4 Why Now

Both issues trace to the same root: path representation collapses structural information into an ambiguous string. Fixing either issue without addressing the representation model would produce ad-hoc workarounds (custom escaping, validator wildcards) that create new failure modes.

FDR-015 already establishes that patch paths are "data, not computation." This ADR makes them **structurally sound data**.

---

## 2. Decision

### 2.1 Core PatchPath Type

Replace `path: string` with `path: PatchPath` across the Core–Host boundary.

```typescript
/**
 * An ordered sequence of segments describing the location within a Snapshot
 * where a patch operation applies.
 *
 * INVARIANT: At Core boundary, every segment is concrete (no expressions).
 * INVARIANT: Segments preserve key content atomically — no encoding/escaping.
 */
type PatchPath = readonly PatchSegment[];

type PatchSegment =
  | { readonly kind: "prop";  readonly name: string  }   // Object field access
  | { readonly kind: "index"; readonly index: number }    // Array element access
;
```

**Critical design choice: unified `prop` for both Object fields and Record keys.**

There is no separate `key` kind. The rationale:

1. **Schema independence at construction time.** Patch producers (Compiler, Host effect handlers) need not know whether a target field is an Object property or a Record entry when constructing the path. This knowledge is only required at **validation time**, where the schema is available.

2. **Alignment with MEL IR.** The existing `PathSegment = { kind: 'prop'; name: string }` in Compiler SPEC v0.5.0 §7.2.2 already uses `prop` for all named access. The new Core type is a direct descendant — no translation layer needed.

3. **Validator determines semantics via schema-walk.** The validator inspects the schema at each segment to determine whether `prop` is accessing an Object field (must match declared field name) or a Record entry (any string key is valid). This is the same pattern used by JSON Schema validators.

The `index` kind exists because arrays require positional (numeric) access, which is semantically distinct from named access.

### 2.2 Core Patch Type (Updated)

```typescript
type Patch =
  | { readonly op: "set";   readonly path: PatchPath; readonly value: unknown }
  | { readonly op: "unset"; readonly path: PatchPath }
  | { readonly op: "merge"; readonly path: PatchPath; readonly value: Record<string, unknown> }
;
```

This replaces the current definition where `path` is `string`.

### 2.3 Compiler IR Path Type (Two-Tier)

The Compiler operates on **unevaluated** paths where some segments may contain expressions (e.g., `items[$system.uuid]`). These must be resolved to concrete values before reaching Core.

```typescript
/**
 * IR-level path segment. May contain expressions that resolve at evaluation time.
 * This type is INTERNAL to the Compiler/Host evaluation pipeline.
 */
type IRPathSegment =
  | { readonly kind: "prop";  readonly name: string }              // Static field/key
  | { readonly kind: "expr";  readonly value: CoreExprNode }       // Dynamic (must resolve to string or number)
;

type IRPatchPath = readonly IRPathSegment[];
```

`ConditionalPatchOp` adopts `IRPatchPath`:

```typescript
type ConditionalPatchOp = {
  readonly condition?: CoreExprNode;
  readonly op: "set" | "unset" | "merge";
  readonly path: IRPatchPath;             // ← CHANGED from string
  readonly value?: CoreExprNode;
};
```

**Resolution contract:** `evaluateConditionalPatchOps()` MUST resolve all `expr` segments to concrete values, producing `Patch[]` with `PatchPath` (no expressions). If an `expr` segment evaluates to a string, it becomes `{ kind: "prop", name: <string> }`. If it evaluates to a non-negative integer, it becomes `{ kind: "index", index: <number> }`. If it evaluates to any other type (null, boolean, object, negative number, non-integer), the **entire PatchOp is skipped** and a warning is emitted. This follows the TOTAL evaluation principle (Compiler SPEC §18.2): evaluation never throws on runtime data — invalid results cause the operation to be dropped, not the pipeline to crash.

**Note on numeric-string Record keys:** If a Record uses string keys that happen to be numeric (e.g., `"0"`, `"42"`), the MEL expression providing the key value **must** evaluate to a string, not a number. A MEL expression that evaluates to the number `0` will produce `{ kind: "index", index: 0 }` (Array access), not `{ kind: "prop", name: "0" }` (Record key). This is correct behavior — the type distinction between `string` and `number` is the disambiguation signal. MEL's type checker ensures Record key expressions are string-typed; if a user coerces an integer to use as a Record key, they must use an explicit string conversion.

### 2.4 Patch Path Lowering Changes

**Scope: This section applies to `PatchOp.path` lowering only.** Expression-level path lowering (§17.3.3 `get` nodes used in conditions and values) is **not changed** by this ADR. The existing `PathNode[] → string` rule for `CoreExprNode.get.path` remains in force for the current Core IR expression evaluator.

The reason for this asymmetry: expression-level `get` paths are consumed by `evaluateExpr()`, which already handles string paths correctly (no Record key ambiguity because `get` reads values, not addresses for writes). Patch paths have the unique problem of addressing **write targets** including Record keys with arbitrary characters. A future ADR MAY unify expression paths to segments as well, but it is not required by #108 or #189.

**What changes — `ConditionalPatchOp.path` lowering:**

The current string flattening for patch paths is **removed**.

```typescript
// BEFORE: PatchOp path is flattened to string during lowering
// MEL patch: patch user.name = "Alice"
// Lowered:   { op: "set", path: "user.name", value: { kind: "lit", value: "Alice" } }

// AFTER: PatchOp path preserves segments
// MEL patch: patch user.name = "Alice"
// Lowered:   { op: "set", path: [{ kind: "prop", name: "user" }, { kind: "prop", name: "name" }], value: { kind: "lit", value: "Alice" } }
```

For dynamic index access (MEL's `items[id]` syntax) in patch context:

```typescript
// BEFORE: items[id] in patch context → string concatenation at evaluation
// path: "items" + "." + evaluatedId

// AFTER: items[id] in patch context → expr segment
// path: [{ kind: 'prop', name: 'items' }, { kind: 'expr', value: <id-expr> }]
```

### 2.5 Schema-Walk Validation

Validation MUST traverse the schema alongside the path segments. At each step, the validator resolves the current schema node and determines which segment kinds are valid.

**Core traversal rules:**

| Current Schema Node | Allowed Segment Kind | Validation Rule |
|---------------------|----------------------|-----------------|
| **Object** (named fields) | `prop` | `name` MUST match a declared field. Continue with field's type. |
| **Record<string, T>** | `prop` | Any `name` is valid. Continue with `T`. |
| **Array\<T\>** | `index` | `index` MUST be non-negative integer. Continue with `T`. |

A `prop` segment encountering an Array, or an `index` segment encountering an Object/Record, is a **validation error**.

**Type indirection rules:**

| Schema Node Kind | Resolution |
|------------------|------------|
| **Ref** (named type reference) | Dereference to the type definition. Continue walk with resolved type. |
| **Union** (`A \| B \| ...`) | Segment is valid if **at least one** union branch accepts it. Continue with the union of accepting branches' result types. |
| **Primitive** (string, number, boolean) | No further segments allowed. If remaining path is non-empty, validation error. |
| **Literal** (e.g., `"active" \| "inactive"`) | Same as primitive — terminal, no further segments. |
| **Nullable** (`T \| null`) | Treat as union of `T` and `null`. `null` branch never accepts further segments, so effectively walk continues with `T`. |

**Union walk example:**

```typescript
// Schema: status: StatusObject | null
// Path: [{ kind: "prop", name: "status" }, { kind: "prop", name: "code" }]
//
// Step 1: "status" → resolves to (StatusObject | null)
// Step 2: "code" → null branch rejects (primitive, no further segments)
//                 → StatusObject branch accepts if "code" is a declared field
//                 → Result: valid (at least one branch accepts)
```

This eliminates the "unknown path" false positives from Issue #189: when the schema declares `Record<string, T>`, the validator knows that any `prop` segment is a valid Record key.

### 2.6 Reserved Namespace Bypass

Host SPEC §3.3.1 establishes that `$host` is a Host-owned namespace within `data` that Core accepts **even when `StateSpec` does not declare it** (HOST-NS-6). Similarly, the Compiler uses `$mel.guards.intent.*` for `onceIntent` guard state (Compiler SPEC §21, COMPILER-MEL-1).

The schema-walk validator MUST NOT reject paths into these namespaces simply because they are absent from the domain schema. The rule:

> **If the first segment of a PatchPath is `$host` or `$mel`, validation MUST accept the path unconditionally.** Sub-paths under these prefixes are treated as opaque — any sequence of `prop` segments is valid.

| First Segment | Behavior | Owner |
|---------------|----------|-------|
| `$host` | Always valid. Sub-path segments MUST be `prop` only (object namespace, no `index`). | Host |
| `$mel` | Always valid. Sub-path segments MUST be `prop` only (object namespace, no `index`). | Compiler |
| Any other `$`-prefixed name | Validation error (reserved prefix, not currently assigned). | — |
| Non-`$` name | Normal schema-walk (§2.5 rules apply). | Domain |

**Interaction with existing rules:**

- COMPILER-MEL-1 ("root `$mel` merge is FORBIDDEN, must merge at `$mel.guards.intent` level") remains in force. This ADR does not change **what** can be patched under `$mel`, only that the **path validator** does not reject it.
- Host SPEC HOST-NS-4 ("patches targeting `$host` follow standard Patch semantics") is preserved. Validation bypass applies to path acceptance only; the patch operation semantics (`set`/`unset`/`merge`) are unchanged.
- **`index` segments under `$host`/`$mel`:** Currently restricted to `prop` only because both namespaces use object/record structures in practice. If a future Host or Compiler version stores arrays under `$host.*` or `$mel.*` and needs index-based patching, this restriction MAY be relaxed to "all segment kinds allowed, owner is responsible for internal schema consistency." Such relaxation requires a Host/Compiler SPEC amendment, not an ADR-009 revision.

### 2.7 Relationship to Existing Decisions

**FDR-015 (Static Patch Paths):** This ADR **preserves and strengthens** FDR-015. The principle "patch paths are data, not computation" is unchanged. `core.apply()` still performs no expression evaluation. What changes is the **shape** of the data — from ambiguous strings to unambiguous segments. FDR-015 is not modified; this ADR is the implementation-level complement.

**FDR-MEL-032 (Dynamic Path Segments):** This ADR **extends** FDR-MEL-032 from the Compiler-internal scope to the full Core boundary. FDR-MEL-032 established that MEL IR uses structured path nodes. This ADR ensures that structure is not lost during lowering. FDR-MEL-032 remains valid; this ADR closes the gap it left open at the Compiler→Core boundary.

**FDR-MEL-048 (Index Access IR Normalization):** The existing `at()` call mechanism for expression-level index access is unchanged. This ADR addresses **patch target paths**, not expression read paths. In patch context, `items[id]` generates an `IRPathSegment` with kind `expr`; in expression context, it still generates `{ kind: 'call', fn: 'at', args: [...] }`.

### 2.8 PatchPath Root Anchor

**PatchPath is ALWAYS rooted at `snapshot.data`.** This is a normative rule.

```
PatchPath: [{ kind: "prop", name: "user" }, { kind: "prop", name: "name" }]
Resolves to: snapshot.data.user.name

PatchPath: [{ kind: "prop", name: "$host" }, { kind: "prop", name: "intentSlots" }]
Resolves to: snapshot.data.$host.intentSlots
```

Patches MUST NOT target `snapshot.system`, `snapshot.meta`, `snapshot.computed`, or `snapshot.input` directly. These are owned by Core and Host respectively and are modified through their own mechanisms (Core sets `system.*` during `compute()`, Host sets `meta.timestamp` and `meta.randomSeed` per execution).

This aligns with Host SPEC §3.3.1: "Patch paths are rooted at `data` by default." The rule is now **absolute**, not "by default."

| Snapshot Field | Patchable via PatchPath? | Modification Mechanism |
|---------------|--------------------------|------------------------|
| `data.*` | **Yes** | Standard `Patch` operations |
| `data.$host.*` | **Yes** (§2.6 bypass) | Host-owned patches |
| `data.$mel.*` | **Yes** (§2.6 bypass) | Compiler-owned patches |
| `computed.*` | **No** | Core recomputes from expressions |
| `system.*` | **No** | Core-provided pure functions (§2.9): `compute()` returns `SystemDelta`, applied via `applySystemDelta()` |
| `meta.*` | **No** | Host sets via direct snapshot construction per execution cycle |
| `input.*` | **No** | Provided per intent, immutable during execution |

**Why absolute, not routing:**

An alternative design would route `[{ prop: "system" }, ...]` to `snapshot.system`, providing the ability to patch any snapshot field. This is rejected because:

1. It violates Core–Host separation: `system.*` is Core-owned, not patch-modifiable.
2. It creates ambiguity: is `[{ prop: "system" }]` targeting `snapshot.data.system` or `snapshot.system`? A domain could legitimately have a `state.system` field.
3. It expands the attack surface for invalid patches.

### 2.9 System State Mutations: Separating Domain Patches from System Transitions

#### 2.9.1 The Problem

§2.8 establishes that PatchPath is rooted at `snapshot.data`. But the current `Core.compute()` contract returns a **single** `patches: Patch[]` array that bundles two fundamentally different kinds of mutations:

1. **Domain patches**: changes to `snapshot.data.*` (user state, `$host.*`, `$mel.*`)
2. **System transitions**: changes to `snapshot.system.*` (status, pendingRequirements, currentAction, lastError, errors)

Host SPEC §10.2.4 (COMP-REQ-INTERLOCK-1/2) depends on this: Host applies all patches, then reads `snapshot.system.pendingRequirements` to dispatch effects. The compliance test suite (HCTS-INTERLOCK-001) explicitly verifies that "core.compute가 pendingRequirements를 추가하는 patch를 반환" and Host applies them before dispatch.

If PatchPath only targets `snapshot.data`, then `Core.compute()` **cannot express system transitions as Patch operations**. This is not merely the `clearRequirement` case identified earlier — it is the entire `system.*` mutation pipeline.

This tension already existed in the Host SPEC: §13.1 states "Patches to `system.*` are forbidden (INV-SNAP-4)" while the Field Ownership Table marks `system.pendingRequirements` as "Host Writes: via Patch." ADR-009 surfaces and resolves this contradiction.

#### 2.9.2 Decision: Split ComputeResult

`Core.compute()` returns a **structured result** with domain patches separated from system transitions.

```typescript
// BEFORE (current Core SPEC)
type ComputeResult = {
  readonly patches: Patch[];   // Mixed: data + system mutations
};

// AFTER (ADR-009)
type ComputeResult = {
  /** Domain state patches — PatchPath targets snapshot.data only */
  readonly patches: Patch[];

  /** System state transition — applied via core.applySystemDelta() */
  readonly systemDelta: SystemDelta;
};
```

`SystemDelta` is a **declarative description** of system state changes, not a Patch:

```typescript
type SystemDelta = {
  readonly status?: SystemState['status'];
  readonly currentAction?: string | null;
  readonly lastError?: ErrorValue | null;
  readonly appendErrors?: readonly ErrorValue[];
  readonly addRequirements?: readonly Requirement[];
  readonly removeRequirementIds?: readonly string[];
};
```

**Why a delta object, not individual functions:**

A single `SystemDelta` value is returned alongside `patches`, applied atomically in one step, and recorded in traces as a single unit. This is simpler and more auditable than a sequence of individual function calls. It is also naturally serializable for replay.

#### 2.9.3 Core-Provided System Transformer

Core provides a pure function to apply system deltas:

```typescript
/**
 * Applies a SystemDelta to a Snapshot, producing a new Snapshot with
 * updated system fields. Domain data is untouched.
 *
 * Pure, deterministic, TOTAL (never throws on valid SystemDelta).
 */
function applySystemDelta(
  snapshot: Snapshot,
  delta: SystemDelta
): Snapshot;
```

Semantics:

- `status`: replaces `system.status` if present
- `currentAction`: replaces `system.currentAction` if present
- `lastError`: replaces `system.lastError` if present
- `appendErrors`: appends to `system.errors` (preserves existing history)
- `addRequirements`: appends to `system.pendingRequirements`
- `removeRequirementIds`: filters out matching entries from `system.pendingRequirements` (idempotent — missing ids are silently ignored)

All fields in `SystemDelta` are optional. An empty delta `{}` is a no-op.

#### 2.9.4 Host Interlock (Updated)

The apply-before-dispatch interlock (COMP-REQ-INTERLOCK-1/2) is preserved. The sequence changes only in **how** the two kinds of mutations are applied:

```typescript
// BEFORE (current Host SPEC §10.2.4)
function handleStartIntent(job: StartIntent) {
  const snapshot = ctx.getCanonicalHead();
  const result = Core.compute(schema, snapshot, job.intent);
  
  // Apply ALL mutations (data + system mixed in one Patch[])
  applyPatches(result.patches);
  
  // Read requirements from updated snapshot
  const updated = ctx.getCanonicalHead();
  dispatchEffects(updated.system.pendingRequirements);
}

// AFTER (ADR-009)
function handleStartIntent(job: StartIntent) {
  const snapshot = ctx.getCanonicalHead();
  const result = Core.compute(schema, snapshot, job.intent, ctx.frozenContext);
  
  // STEP 1: Apply domain patches (PatchPath → snapshot.data only)
  let snap = snapshot;
  if (result.patches.length > 0) {
    snap = core.apply(schema, snap, result.patches, ctx.frozenContext);
  }
  
  // STEP 2: Apply system delta (pure function → snapshot.system only)
  snap = core.applySystemDelta(snap, result.systemDelta);
  
  ctx.setCanonicalHead(snap);
  
  // STEP 3: Read requirements from updated snapshot (INTERLOCK-2)
  dispatchEffects(snap.system.pendingRequirements);
}
```

**FulfillEffect** uses `removeRequirementIds` instead of the old patch-based clear:

```typescript
function handleFulfillEffect(job: FulfillEffect) {
  let snap = ctx.getCanonicalHead();
  
  // FULFILL-0: Stale check
  if (!snap.system.pendingRequirements.some(r => r.id === job.requirementId)) {
    traceStaleOrDuplicateFulfillment(job);
    return;
  }
  
  let applyError: Error | null = null;
  
  // FULFILL-1: Apply result patches (domain only, may fail)
  try {
    snap = core.apply(schema, snap, job.resultPatches, ctx.frozenContext);
  } catch (error) {
    applyError = error;
    // DO NOT RETURN — must still clear (ERR-FE-2)
  }
  
  // FULFILL-2: Clear requirement (system delta, always executes)
  snap = core.applySystemDelta(snap, {
    removeRequirementIds: [job.requirementId]
  });
  
  ctx.setCanonicalHead(snap);
  
  // FULFILL-3: Record error if apply failed (best-effort, ERR-FE-5)
  if (applyError) {
    try {
      snap = core.apply(schema, snap, [errorPatch(job, applyError)], ctx.frozenContext);
      ctx.setCanonicalHead(snap);
    } catch { /* best-effort — ERR-FE-5 */ }
  }
  
  enqueue({ type: 'ContinueCompute', intentId: job.intentId });
}
```

#### 2.9.5 Why This Is Correct

1. **"Patch = domain data only" is structurally enforced.** There is no way to construct a `PatchPath` that targets `system.*`. The type system prevents it.

2. **System transitions remain pure and deterministic.** `applySystemDelta` is a pure function. Given the same `(snapshot, delta)`, it always returns the same result. Replay determinism is preserved.

3. **The interlock invariant is preserved.** `core.apply()` + `core.applySystemDelta()` are called sequentially before dispatch. The ordering guarantee is identical; only the mechanism is split.

4. **Traces become more precise.** Instead of a mixed `Patch[]` where some entries target `data` and others target `system`, traces now record `{ patches: Patch[], systemDelta: SystemDelta }` — making it structurally clear what changed where. Audit tools can distinguish domain changes from system transitions without path inspection.

5. **The existing Host SPEC tension is resolved.** §13.1 "Patches to `system.*` are forbidden" and the Field Ownership Table "via Patch" annotation are no longer contradictory. System mutations are not patches. Period.

#### 2.9.6 Required Spec Updates (from this subsection)

| Document | Section | Change |
|----------|---------|--------|
| **Core SPEC** | §3.1 (Core interface) | `compute()` return type: `{ patches, systemDelta }` |
| **Core SPEC** | (new) | Add `SystemDelta` type definition and `applySystemDelta()` pure function |
| **Host SPEC** | §3.1 (Core definition) | Reflect updated `ComputeResult` type |
| **Host SPEC** | §3.3 (Field Ownership Table) | `system.pendingRequirements` "Host Writes": "via `core.applySystemDelta()`" |
| **Host SPEC** | §10.2.4 (Interlock) | Update sequence: `apply(patches)` then `applySystemDelta(delta)` then dispatch |
| **Host SPEC** | §10.7 (FulfillEffect) | Use `applySystemDelta({ removeRequirementIds })` for FULFILL-2 |
| **Host SPEC** | §13.1 | Remove "Patches to `system.*` are forbidden" caveat — system is no longer patchable at all |
| **Host Compliance Test Suite** | HCTS-INTERLOCK-001 | Update trace expectation: separate `core:apply` and `core:applySystemDelta` events |

---

## 3. Serialization

### 3.1 Canonical JSON Form

Patches are serialized as part of traces, deltas, and WorldStore records. The canonical JSON representation:

```json
{
  "op": "set",
  "path": [
    { "kind": "prop", "name": "history" },
    { "kind": "prop", "name": "files" },
    { "kind": "prop", "name": "file:///proof.lean" }
  ],
  "value": { "status": "verified" }
}
```

Note that `"file:///proof.lean"` is preserved atomically in the `name` field. No escaping. No ambiguity.

### 3.2 Compactness Consideration

The segment representation is more verbose than dot-notation. For a path like `user.preferences.theme`:

| Format | JSON bytes |
|--------|------------|
| String | `"user.preferences.theme"` (25 bytes) |
| Segments | `[{"kind":"prop","name":"user"},{"kind":"prop","name":"preferences"},{"kind":"prop","name":"theme"}]` (97 bytes) |

This is ~4× larger per path. For production persistence, implementations MAY use a compact binary encoding (e.g., MessagePack with schema-aware compression). However, the **canonical wire format** MUST be the full JSON segments. Implementations MUST NOT use dot-notation strings as the persistence format.

### 3.3 Display String Utility

For debugging, logging, and error messages, a display utility MUST be provided:

```typescript
function patchPathToDisplayString(path: PatchPath): string;
```

**Rules:**

- `prop` segments are joined with `.`
- `index` segments use bracket notation: `[n]`
- If a `prop` name contains `.`, `[`, `]`, `"`, `\`, or whitespace, it is quoted: `["file:///proof.lean"]`
- Quoting uses **JSON string escaping** (RFC 8259 §7) inside double quotes. This means `"` → `\"`, `\` → `\\`, control characters → `\uNNNN`. This ensures all prop names — including those with quotes and backslashes — are unambiguously represented in human-readable form.
- The display string is **informational only** and MUST NOT be parsed back into a `PatchPath`

**Examples:**

| PatchPath | Display String |
|-----------|---------------|
| `[{prop:"user"}, {prop:"name"}]` | `user.name` |
| `[{prop:"items"}, {index:3}, {prop:"title"}]` | `items[3].title` |
| `[{prop:"files"}, {prop:"file:///proof.lean"}]` | `files["file:///proof.lean"]` |
| `[{prop:"$host"}, {prop:"intentSlots"}]` | `$host.intentSlots` |

---

## 4. core.apply() Changes

### 4.1 Traversal Algorithm

`core.apply()` replaces string splitting with segment-based traversal:

```typescript
function applyPatch<T>(root: T, patch: Patch): T {
  const { path, op } = patch;
  
  if (path.length === 0) {
    // Root-level operation
    if (op === "set") return patch.value as T;
    if (op === "merge") return { ...root, ...patch.value } as T;
    // "unset" at root is invalid
    throw new ApplyError("UNSET_AT_ROOT");
  }
  
  // Navigate to parent, then apply operation at final segment
  let current: unknown = root;
  const parentPath = path.slice(0, -1);
  const target = path[path.length - 1];
  
  for (const segment of parentPath) {
    current = resolveSegment(current, segment);
    if (current === undefined || current === null) {
      // Path does not exist — operation is a no-op for unset, error for set/merge
      // (Policy: same as current behavior)
    }
  }
  
  // Apply operation at target segment
  // ...
}

function resolveSegment(obj: unknown, segment: PatchSegment): unknown {
  switch (segment.kind) {
    case "prop":
      return (obj as Record<string, unknown>)?.[segment.name];
    case "index":
      return (obj as unknown[])?.[segment.index];
  }
}
```

The key difference: no `.split(".")` anywhere. Path resolution is a direct array traversal.

### 4.2 Prototype Pollution Defense (NORMATIVE)

Because `PatchSegment.prop` allows **arbitrary strings** as `name` (required by #189: Record keys can be any string), `core.apply()` MUST defend against JavaScript prototype pollution. The dangerous keys are `"__proto__"`, `"constructor"`, and `"prototype"` — if written via naive `obj[name] = value` assignment, they can corrupt the prototype chain.

**Rule APPLY-PROTO-1: Safe Property Write.** `core.apply()` MUST use **immutable spread** (`{ ...obj, [name]: nextValue }`) or equivalent safe assignment when writing `prop` segments. Direct prototype-mutating assignment (`obj[name] = value` on a mutable object) is FORBIDDEN.

**Rule APPLY-PROTO-2: Safe Intermediate Creation.** When `core.apply()` creates intermediate objects during traversal (e.g., auto-vivifying a missing parent), it MUST use `Object.create(null)` or plain `{}` spread patterns. It MUST NOT use patterns where a `prop.name` of `"__proto__"` could inject a prototype.

**Why immutable spread is sufficient:**

```typescript
// SAFE: Spread creates a new data property, never touches prototype chain
const updated = { ...parent, [segment.name]: nextValue };
// Even if segment.name === "__proto__", this creates an own enumerable
// property named "__proto__" — it does NOT modify the prototype.

// UNSAFE: Direct assignment on mutable object
parent[segment.name] = nextValue;
// If segment.name === "__proto__" and parent is a regular {}, this
// modifies parent's prototype chain — classic prototype pollution.
```

This defense is invisible to correct programs: Record keys `"__proto__"`, `"constructor"`, `"prototype"` are stored and retrieved as normal data properties. No key values are forbidden. The defense is purely an **implementation constraint** on `core.apply()` internals.

### 4.3 Determinism Guarantee

`core.apply()` remains a **pure function**. Given the same `(schema, snapshot, patches)` triple, it produces the same output. The segments representation makes this property **structurally evident** — there is no parsing step that could introduce environment-dependent behavior.

---

## 5. Evaluation Pipeline Update

### 5.1 evaluateConditionalPatchOps() Contract

```typescript
function evaluateConditionalPatchOps(
  ops: readonly ConditionalPatchOp[],
  ctx: EvaluationContext
): Patch[] {
  const result: Patch[] = [];
  let workingSnapshot = ctx.snapshot;
  
  for (const op of ops) {
    // 1. Check condition (unchanged from current spec)
    if (op.condition !== undefined) {
      const condResult = evaluateExpr(op.condition, { ...ctx, snapshot: workingSnapshot });
      if (condResult !== true) continue;
    }
    
    // 2. Resolve path segments (TOTAL: null means skip)
    const concretePath = resolveIRPath(op.path, { ...ctx, snapshot: workingSnapshot });
    if (concretePath === null) continue;  // Unresolvable path → skip (warning already emitted)
    
    // 3. Evaluate value (unchanged from current spec)
    const concreteValue = op.value !== undefined
      ? evaluateExpr(op.value, { ...ctx, snapshot: workingSnapshot })
      : undefined;
    
    // 4. Build concrete Patch
    const patch = buildPatch(op.op, concretePath, concreteValue);
    result.push(patch);
    
    // 5. Apply to working snapshot (sequential semantics preserved)
    workingSnapshot = applyPatchToSnapshot(workingSnapshot, patch);
  }
  
  return result;
}
```

### 5.2 resolveIRPath() — TOTAL Semantics

Path resolution follows the same TOTAL principle as expression evaluation (Compiler SPEC §18.2): **invalid runtime data produces null, never throws.** The caller (`evaluateConditionalPatchOps`) skips the entire PatchOp when resolution fails, identical to how a false condition skips a PatchOp.

```typescript
/**
 * Resolves IR path segments to concrete PatchPath.
 * Returns null if any expr segment evaluates to an unresolvable value.
 * TOTAL: never throws on runtime data.
 */
function resolveIRPath(
  irPath: IRPatchPath,
  ctx: EvaluationContext
): PatchPath | null {
  const result: PatchSegment[] = [];
  
  for (const segment of irPath) {
    switch (segment.kind) {
      case "prop":
        result.push(segment); // Already concrete
        break;
        
      case "expr": {
        const value = evaluateExpr(segment.value, ctx);
        
        if (typeof value === "string") {
          result.push({ kind: "prop", name: value });
        } else if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
          result.push({ kind: "index", index: value });
        } else {
          // TOTAL: invalid segment value → null (caller skips this op)
          // Emit warning for diagnostics
          ctx.warn?.({
            code: "INVALID_PATH_SEGMENT_VALUE",
            message: `Path expression evaluated to ${value === null ? "null" : typeof value}, expected string or non-negative integer. PatchOp skipped.`,
            segment,
          });
          return null;
        }
        break;
      }
    }
  }
  
  return result;
}
```

**Why TOTAL, not throw:**

The pattern is consistent with condition evaluation (§18.6): a non-boolean condition is treated as false (skip + warning), not an exception. Path resolution is analogous — an unresolvable path segment means "this patch cannot be applied," which is a skip, not a crash. This matters for resilience: a single malformed dynamic key in a batch of patches must not abort the entire batch.

---

## 6. Migration Policy

### 6.1 Decision: Epoch Reset

Existing persisted data that uses dot-notation string paths **cannot be losslessly migrated**. The fundamental reason is the same as Issue #108 itself: given the string `"history.files.file:///proof.lean"`, it is impossible to determine programmatically whether `file:///proof` was a segment boundary or part of a key.

Therefore:

> **All persisted traces, deltas, and WorldStore records using string-encoded paths are incompatible with this change. Applications MUST re-initialize from genesis.**

This is acceptable because:

1. Manifesto is pre-1.0. No production deployments with long-lived persistence exist.
2. The alternative (ambiguous migration) would **perpetuate** the exact data integrity problem this ADR solves.
3. Any data that was affected by Issue #108 is already corrupted and non-recoverable.

### 6.2 Version Detection

To prevent silent data corruption if old-format data is loaded, the **serialization layer** (WorldStore) MUST tag persisted patches with a format version.

**Important:** The version tag exists only in the **serialization envelope**, not in the in-memory `Patch` type. In-memory patches produced by Host effect handlers, `evaluateConditionalPatchOps()`, and other runtime code use the bare `Patch` type (§2.2) without version tags. This keeps the runtime API clean — version detection is a persistence concern, not an execution concern.

```typescript
// Serialization envelope (WorldStore/Trace persistence only)
type SerializedPatchEnvelope = {
  readonly _patchFormat: 2;       // v1 = string paths (deprecated), v2 = segments
  readonly patches: readonly SerializedPatch[];
};

type SerializedPatch = {
  readonly op: "set" | "unset" | "merge";
  readonly path: PatchPath;       // Segments — no version tag per patch
  readonly value?: unknown;
};

// In-memory Patch type (unchanged from §2.2) — NO _patchFormat field
```

If a WorldStore loader encounters `_patchFormat: 1` (or missing `_patchFormat`), it MUST reject with:

```
IncompatiblePatchFormatError:
  Patch format v1 (string paths) is no longer supported.
  Data must be re-initialized from genesis.
  See ADR-009 for details.
```

The guard is enforced at the **WorldStore.restore()** boundary — the earliest point where persisted data enters the runtime. `core.apply()` itself does not check `_patchFormat`; it relies on the type system to ensure it only receives `PatchPath` segments.

### 6.3 What Is NOT Affected

- **DomainSchema definitions**: Unchanged. State/type declarations do not use patch paths.
- **MEL source code**: Unchanged. `patch user.name = "Alice"` and `patch items[id] = { ... }` work identically. The change is in the compiled output.
- **Expression-level paths** (`get`, `at`, `field` in CoreExprNode): Unchanged. The existing `PathNode[] → string` lowering for `get.path` in expressions remains (§2.4). Only **patch target paths** adopt segments.
- **Host effect handlers**: If they produce `Patch[]`, they must produce `PatchPath` segments instead of strings. This is a code change in effect handler implementations.
- **Core.compute() / Flow evaluation**: Unchanged. This ADR only affects **patch target paths**, not the expression evaluator.

---

## 7. Impact by Layer

### 7.1 Core (@manifesto-ai/core)

| Component | Change | Severity |
|-----------|--------|----------|
| `Patch` type definition | `path: string` → `path: PatchPath` | **Breaking** |
| `core.apply()` | Replace string split with segment traversal. Root anchor: always `snapshot.data`. | Internal |
| `core.validate()` (if exists) | Replace pattern matching with schema-walk (ref/union aware). `$host`/`$mel` bypass. | Internal |
| `PatchPath` type + `patchPathToDisplayString()` | New export | Additive |

**Version:** Major bump (v3.0.0).

### 7.2 Compiler (@manifesto-ai/compiler)

| Component | Change | Severity |
|-----------|--------|----------|
| `ConditionalPatchOp.path` | `string` → `IRPatchPath` | **Breaking** |
| `IRPathSegment` type | New export | Additive |
| `lowerPatchFragments()` | Preserve segments for patch paths (no string flattening) | Internal |
| `evaluateConditionalPatchOps()` | Add `resolveIRPath()` step | Internal |
| §17.3.3 get Lowering | **Unchanged** — expression `get.path` remains string | None |
| §17.5 ConditionalPatchOp | `path: string` → `path: IRPatchPath` | **SPEC change** |

**Version:** Major bump (v1.0.0).

### 7.3 Host (@manifesto-ai/host)

| Component | Change | Severity |
|-----------|--------|----------|
| `Patch[]` pass-through | Type change propagates from Core | Minimal |
| Effect handlers producing patches | Must construct `PatchPath` segments | Implementation |
| Host-owned `$host.*` patches | Segment construction (already static paths) | Minimal |
| FulfillEffect requirement clear | Replace patch-based `system.*` clear with `core.applySystemDelta({ removeRequirementIds })` | **Behavioral** |
| `ComputeResult` consumption | Handle split `{ patches, systemDelta }` instead of mixed `Patch[]` | **Behavioral** |
| Field Ownership Table | `system.pendingRequirements` "Host Writes" updated to "via `core.applySystemDelta()`" | **SPEC change** |

**Version:** Major bump (v3.0.0) for type compatibility.

### 7.4 Runtime (@manifesto-ai/runtime)

| Component | Change | Severity |
|-----------|--------|----------|
| Patch validation | Rewrite to schema-walk + segment-kind (ref/union aware, `$host`/`$mel` bypass) | **Resolves #189** |
| Error messages | Replace `"Unknown path: X.*"` with precise segment-level errors | Quality |

**Version:** Minor bump (validation is internal).

### 7.5 World / Persistence

| Component | Change | Severity |
|-----------|--------|----------|
| WorldStore serialization | `path` field in stored patches changes shape | **Breaking** |
| Trace/Delta records | Same | **Breaking** |
| Restore/Replay | Use segments directly (no parsing) | Simplification |

**Migration:** Epoch reset (§6.1).

---

## 8. Spec Document Updates

This ADR requires normative changes to the following specifications:

| Document | Section | Change |
|----------|---------|--------|
| **Core SPEC** | §5 (Patch) | Replace `path: string` with `path: PatchPath`. Add PatchSegment definition. |
| **Core SPEC** | §5 (apply) | Replace string-based traversal with segment-based. Add root anchor rule (§2.8). |
| **Core SPEC** | §5.5 (reserved) | Add normative note: `$host` and `$mel` paths bypass schema validation (§2.6). |
| **Core SPEC** | (new section) | Add `patchPathToDisplayString()` utility definition. |
| **Core SPEC** | (new section) | Add `SystemDelta` type and `core.applySystemDelta()` pure function (§2.9). |
| **Core SPEC** | §3.1 (Core interface) | `compute()` return type split: `{ patches: Patch[], systemDelta: SystemDelta }` (§2.9). |
| **Core FDR** | FDR-015 | Add normative note: "Static paths are represented as `PatchPath` segments. String encoding is not supported." |
| **Compiler SPEC** | §17.3.3 | **Unchanged** — expression `get.path` remains `string`. (Future ADR may unify.) |
| **Compiler SPEC** | §17.5 | Update `ConditionalPatchOp.path` to `IRPatchPath`. Add `IRPathSegment` type. |
| **Compiler SPEC** | §18.5 | Update evaluation to include `resolveIRPath()` step with TOTAL semantics. |
| **Compiler FDR** | FDR-MEL-032 | Add note: "Extended to Core boundary for patch paths by ADR-009." |
| **Host SPEC** | §3.1 (Core definition) | Reflect updated `ComputeResult` type with `systemDelta` (§2.9). |
| **Host SPEC** | §3.3 (Field Ownership) | Update `system.pendingRequirements` "Host Writes" from "via Patch" to "via `core.applySystemDelta()`". Clarify `meta.timestamp`/`meta.randomSeed` as "direct construction, not Patch". |
| **Host SPEC** | §4.1 | Note: Host passes `Patch[]` with segments to `core.apply()`. |
| **Host SPEC** | §10.2.4 (Interlock) | Update sequence: `apply(patches)` then `applySystemDelta(delta)` then dispatch (§2.9.4). |
| **Host SPEC** | §10.7 (FulfillEffect) | Use `applySystemDelta({ removeRequirementIds })` for FULFILL-2 (§2.9.4). |
| **Host SPEC** | §13.1 | Remove "Patches to `system.*` are forbidden" caveat — system is no longer patchable at all. |
| **Host Compliance Test Suite** | HCTS-INTERLOCK-001 | Update trace expectation: separate `core:apply` and `core:applySystemDelta` events. |
| **Runtime SPEC** | (validation) | Add schema-walk validation rules (§2.5 of this ADR) including ref/union resolution. |
| **World SPEC** | (persistence) | Add `_patchFormat: 2` requirement for serialized patches. Legacy format hard-rejected. |

---

## 9. Acceptance Criteria

### 9.1 Issue #108 Resolution

```typescript
test("Record key with dots/colons survives patch→store→restore", () => {
  const schema = defineSchema({
    state: {
      history: { type: "object", fields: {
        files: { type: "Record<string, FileEntry>" }
      }}
    }
  });
  
  const key = "file:///proof.lean";
  const patch: Patch = {
    op: "set",
    path: [
      { kind: "prop", name: "history" },
      { kind: "prop", name: "files" },
      { kind: "prop", name: key }          // Atomic. No escaping.
    ],
    value: { status: "verified", size: 1024 }
  };
  
  const snapshot1 = core.apply(schema, genesisSnapshot, [patch]);
  
  // Serialize → deserialize (simulates store/restore)
  const serialized = JSON.stringify(snapshot1);
  const snapshot2 = JSON.parse(serialized);
  
  // Key is intact
  expect(snapshot2.data.history.files[key]).toEqual({ status: "verified", size: 1024 });
  expect(snapshot2.data.history.files["file:///proof"]).toBeUndefined(); // NOT split
});
```

### 9.2 Issue #189 Resolution

```typescript
test("Record<string, T> dynamic key patch passes validation", () => {
  const schema = defineSchema({
    state: {
      messages: { type: "Record<string, Message>" }
    }
  });
  
  const dynamicKey = "msg-abc-123";  // Resolved from $system.uuid by Host
  const patch: Patch = {
    op: "set",
    path: [
      { kind: "prop", name: "messages" },
      { kind: "prop", name: dynamicKey }
    ],
    value: { text: "hello", timestamp: 1234567890 }
  };
  
  // Validation MUST pass — Record<string, T> allows any prop name
  expect(() => validatePatch(schema, patch)).not.toThrow();
  
  const snapshot = core.apply(schema, genesisSnapshot, [patch]);
  expect(snapshot.data.messages[dynamicKey]).toEqual({ text: "hello", timestamp: 1234567890 });
});
```

### 9.3 FDR-015 Compliance

```typescript
test("core.apply() does not evaluate expressions in path", () => {
  // This type should not even compile — PatchPath has no expr segments
  // @ts-expect-error
  const badPatch: Patch = {
    op: "set",
    path: [
      { kind: "prop", name: "items" },
      { kind: "expr", value: { kind: "sys", path: ["system", "uuid"] } }  // INVALID AT CORE LEVEL
    ],
    value: "test"
  };
  
  // Even if bypassed at type level, apply MUST reject
  expect(() => core.apply(schema, snapshot, [badPatch])).toThrow("INVALID_SEGMENT_KIND");
});
```

### 9.4 Format Version Guard

```typescript
test("WorldStore rejects legacy string-path patch format", () => {
  const legacyEnvelope = {
    _patchFormat: 1,
    patches: [{ op: "set", path: "user.name", value: "Alice" }]
  };
  
  // Guard is at WorldStore.restore() boundary
  expect(() => worldStore.restore(worldIdWithLegacyData)).toThrow(
    "IncompatiblePatchFormatError"
  );
});

test("WorldStore rejects missing _patchFormat", () => {
  const unversionedEnvelope = {
    patches: [{ op: "set", path: "user.name", value: "Alice" }]
  };
  
  expect(() => worldStore.loadPatches(unversionedEnvelope)).toThrow(
    "IncompatiblePatchFormatError"
  );
});

test("core.apply() rejects non-array path at runtime (type guard)", () => {
  const malformedPatch = { op: "set", path: "user.name", value: "Alice" };
  
  // core.apply does structural validation — path must be an array
  expect(() => core.apply(schema, snapshot, [malformedPatch as any])).toThrow();
});
```

### 9.5 Composite Key Integrity (Regression Suite)

```typescript
const problematicKeys = [
  "file:///proof.lean",
  "TACTIC_FAILED:simp",
  "user.name@domain.com",
  "path/to/resource",
  "key.with.many.dots",
  "key[with]brackets",
  "",                          // empty string key (valid for Record)
  "hello world",               // space in key
  '{"json":"key"}',            // JSON-like key
];

for (const key of problematicKeys) {
  test(`Record key "${key}" round-trips through patch→serialize→apply`, () => {
    const patch: Patch = {
      op: "set",
      path: [{ kind: "prop", name: "store" }, { kind: "prop", name: key }],
      value: "test-value"
    };
    
    const serialized = JSON.stringify(patch);
    const deserialized = JSON.parse(serialized) as Patch;
    
    const snapshot = core.apply(recordSchema, genesisSnapshot, [deserialized]);
    expect(snapshot.data.store[key]).toBe("test-value");
  });
}

// --- Prototype Pollution Defense (APPLY-PROTO-1, APPLY-PROTO-2) ---

const DANGEROUS_KEYS = ["__proto__", "constructor", "prototype"];

for (const key of DANGEROUS_KEYS) {
  test(`Record key "${key}" is stored as data property, not prototype mutation`, () => {
    const patch: Patch = {
      op: "set",
      path: [
        { kind: "prop", name: "store" },
        { kind: "prop", name: key },
      ],
      value: "safe-value"
    };
    
    const snapshot = core.apply(recordSchema, genesisSnapshot, [patch]);
    
    // Key stored as own data property
    expect(Object.prototype.hasOwnProperty.call(snapshot.data.store, key)).toBe(true);
    expect(snapshot.data.store[key]).toBe("safe-value");
    
    // No prototype pollution
    const freshObj: Record<string, unknown> = {};
    expect(freshObj[key as keyof typeof freshObj]).toBeUndefined();
    // If __proto__ was polluted, freshObj would inherit "safe-value"
  });
}

test("nested intermediate creation with __proto__ key does not pollute", () => {
  const patch: Patch = {
    op: "set",
    path: [
      { kind: "prop", name: "store" },
      { kind: "prop", name: "__proto__" },
      { kind: "prop", name: "nested" },
    ],
    value: "deep-safe"
  };
  
  const snapshot = core.apply(recordSchema, genesisSnapshot, [patch]);
  
  // Navigable as normal data
  expect(snapshot.data.store["__proto__"].nested).toBe("deep-safe");
  
  // No pollution on unrelated objects
  const unrelated: any = {};
  expect(unrelated.nested).toBeUndefined();
});
```

### 9.6 Reserved Namespace Bypass

```typescript
test("$host path is accepted without schema declaration", () => {
  const schema = defineSchema({
    state: { count: { type: "number" } }
    // No $host declared
  });
  
  const patch: Patch = {
    op: "merge",
    path: [
      { kind: "prop", name: "$host" },
      { kind: "prop", name: "intentSlots" },
    ],
    value: { "intent-abc": { status: "pending" } }
  };
  
  expect(() => validatePatch(schema, patch)).not.toThrow();
  const snapshot = core.apply(schema, genesisSnapshot, [patch]);
  expect(snapshot.data.$host.intentSlots["intent-abc"].status).toBe("pending");
});

test("$mel guard path is accepted without schema declaration", () => {
  const patch: Patch = {
    op: "merge",
    path: [{ kind: "prop", name: "$mel" }, { kind: "prop", name: "guards" }, { kind: "prop", name: "intent" }],
    value: { myMarker: "intent-123" }
  };
  
  expect(() => validatePatch(schema, patch)).not.toThrow();
});
```

### 9.7 Root Anchor

```typescript
test("PatchPath is always rooted at snapshot.data", () => {
  const schema = defineSchema({
    state: { system: { type: "object", fields: { mode: { type: "string" } } } }
  });
  
  // This targets snapshot.data.system.mode, NOT snapshot.system
  const patch: Patch = {
    op: "set",
    path: [{ kind: "prop", name: "system" }, { kind: "prop", name: "mode" }],
    value: "debug"
  };
  
  const snapshot = core.apply(schema, genesisSnapshot, [patch]);
  expect(snapshot.data.system.mode).toBe("debug");
  // snapshot.system (Core-owned) is untouched
  expect(snapshot.system.status).toBe("idle");
});
```

### 9.8 TOTAL Path Resolution

```typescript
test("unresolvable path expr skips PatchOp instead of throwing", () => {
  const ops: ConditionalPatchOp[] = [
    {
      op: "set",
      path: [
        { kind: "prop", name: "items" },
        { kind: "expr", value: { kind: "lit", value: null } }  // null → unresolvable
      ],
      value: { kind: "lit", value: "test" }
    },
    {
      op: "set",
      path: [{ kind: "prop", name: "status" }],
      value: { kind: "lit", value: "ok" }
    }
  ];
  
  // Should NOT throw — first op is skipped, second op applies
  const patches = evaluateConditionalPatchOps(ops, ctx);
  expect(patches).toHaveLength(1);
  expect(patches[0].path).toEqual([{ kind: "prop", name: "status" }]);
});
```

---

## 10. Alternatives Considered

### 10.1 Escaped Dot-Notation

| Property | Assessment |
|----------|------------|
| **Description** | Keep `path: string`, introduce escape sequences (e.g., `\.` for literal dot) |
| **Why Rejected** | Requires all consumers to implement escape/unescape. Recursive escaping problem (what if key contains `\.`?). Existing serialized data cannot be migrated. Every new special character requires a new escape rule. |
| **Verdict** | Transfers complexity to every path consumer. Violates "structural soundness." |

### 10.2 Separate `key` Segment Kind

| Property | Assessment |
|----------|------------|
| **Description** | `PatchSegment = prop \| key \| index` where `key` is Record-specific |
| **Why Rejected** | Forces patch producers to know the schema type at construction time. Creates a coupling between path construction and schema awareness. MEL IR already uses `prop` uniformly. Adding `key` would require a translation step that doesn't exist today. |
| **Verdict** | Correct in theory, premature in practice. Can be added later as a refinement if schema-at-construction becomes available. |

### 10.3 JSON Pointer (RFC 6901)

| Property | Assessment |
|----------|------------|
| **Description** | Use RFC 6901 JSON Pointer format (`/history/files/file:~1~1~1proof.lean`) |
| **Why Rejected** | Escaping (`~0` for `~`, `~1` for `/`) is error-prone. Does not distinguish Object fields from Record keys from Array indices. Not aligned with MEL's existing `PathNode` model. |
| **Verdict** | Standard but poor fit. Manifesto needs type-aware paths, not just location strings. |

### 10.4 Status Quo + Validator Wildcards

| Property | Assessment |
|----------|------------|
| **Description** | Keep strings, add `Record<string, T>` wildcard patterns to validator |
| **Why Rejected** | Fixes #189 only. Does not fix #108. Introduces pattern matching complexity. Wildcard patterns can over-match (validate paths that shouldn't exist). |
| **Verdict** | Symptom treatment, not cure. |

---

## 11. Consequences

### Positive

1. **#108 permanently resolved.** Key content is never confused with path structure. URI, composite, and punctuation-heavy keys are safe by construction.

2. **#189 permanently resolved.** Schema-walk validation naturally permits Record entries without special-casing.

3. **FDR-015 strengthened.** "Paths are data" now means "paths are typed, structured data" — a stronger guarantee.

4. **Replay determinism hardened.** No parsing ambiguity in the serialize→deserialize→apply cycle.

5. **Validator simplified.** Pattern matching against strings is replaced by straightforward schema-walk. Error messages become precise ("segment 2: expected Object field, got unknown name 'xyz'" instead of "Unknown path: a.b.*").

6. **Compiler lowering simplified.** The `PathNode[] → string` step is removed entirely. Less code, fewer edge cases.

### Negative

1. **Serialized patch size increases ~4×.** Mitigated by optional compact binary encoding for persistence. Canonical JSON format prioritizes correctness over compactness.

2. **All layers require version bump.** Core, Host, Compiler all have breaking type changes. Mitigated by pre-1.0 status and epoch reset policy.

3. **Effect handlers must update.** Any Host effect handler that constructs `Patch[]` with string paths must be updated to use segments. Migration is mechanical (split string, wrap in `{ kind: "prop", name: ... }`).

4. **Tooling (debuggers, inspectors) must update.** String paths were human-readable by default. Segment arrays require `patchPathToDisplayString()` for readability. Mitigated by providing this utility in Core.

---

## 12. Implementation Order

The recommended implementation sequence:

| Phase | Package | Work | Gate |
|-------|---------|------|------|
| **1** | Core | Define `PatchPath`, `PatchSegment` types. Update `core.apply()` to segment traversal. Add `patchPathToDisplayString()`. Add reserved namespace bypass (`$host`, `$mel`). Root anchor rule. Add `SystemDelta` type and `core.applySystemDelta()`. Split `ComputeResult` to `{ patches, systemDelta }`. | Core unit tests pass (§9.1, §9.5, §9.6, §9.7) |
| **2** | Compiler | Update `ConditionalPatchOp.path` to `IRPatchPath`. Remove string flattening in patch path lowering. Update `evaluateConditionalPatchOps()` with TOTAL `resolveIRPath()`. | Compiler integration tests pass (§9.3, §9.8) |
| **3** | Runtime | Rewrite patch validation to schema-walk (including ref/union resolution). | Runtime validation tests pass (§9.2) |
| **4** | Host | Update Patch pass-through types. Update effect handler Patch construction. | Host integration tests pass |
| **5** | World | Update serialization format. Add `_patchFormat: 2` envelope at WorldStore boundary. Hard-reject v1 on restore. | Store→restore round-trip tests pass (§9.1, §9.4) |
| **6** | Specs | Update all normative documents per §8. | Spec review complete |

Phases 1–2 are the critical path. Phases 3–5 can proceed in parallel once Core types are published.

---

## Summary

> **Patch paths are structured data. Structure cannot be lost in transit.**

This ADR replaces `path: string` with `path: PatchPath` (an array of typed segments) at the Core boundary. The change is a hard cut with no backward compatibility for serialized data. It permanently resolves two open issues (#108, #189), strengthens FDR-015's "paths are data" principle, and eliminates an entire class of representation-ambiguity bugs from the framework.

One sentence:

> **A path that cannot be misread cannot be misapplied.**
