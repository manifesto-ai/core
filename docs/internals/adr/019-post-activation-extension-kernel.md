# ADR-019: Post-Activation Extension Kernel — Safe Public Seam for Arbitrary-Snapshot Operations

> **Status:** Implemented
> **Date:** 2026-04-07 (v1.2 — implemented in SDK v3.2.0 and used by SDK v3.3.0 helper APIs)
> **Deciders:** 정성우 (Architect)
> **Scope:** SDK
> **Related:** ADR-017 (Capability Decorator Pattern), ADR-018 (Public Snapshot Boundary), FDR-SDK-002 (Simulate)
> **Preserves:** Core, Host, Lineage, Governance, Compiler — zero changes

> **Current Contract Authority:** This ADR is now reflected by the current SDK living spec and runtime implementation for `@manifesto-ai/sdk/extensions`.

---

## Revision History

| Version | Date | Change |
|---------|------|--------|
| v1 | 2026-04-07 | Initial proposal |
| v1.1 | 2026-04-07 | Accepted. Hardened the contract around activated-runtime acquisition, pure projection, unavailable-action parity, and the explicit `sdk/extensions` vs `sdk/provider` split |
| v1.2 | 2026-04-07 | Implemented in SDK v3.2.0. `@manifesto-ai/sdk/extensions` is current, the extension seam is attached to activated runtimes, and later helper APIs build on the same substrate |

---

## 1. Context

### 1.1 The Current SDK Surface Has Two Extremes and No Middle

SDK v3 currently exposes two different layers:

1. **App-facing activated runtime** via `@manifesto-ai/sdk`
   - `getSnapshot()`
   - `getCanonicalSnapshot()`
   - `simulate()`
   - `getAvailableActions()`
   - `isActionAvailable()`
2. **Decorator/provider authoring seam** via `@manifesto-ai/sdk/provider`
   - `RuntimeKernel`
   - `getRuntimeKernelFactory()`
   - arbitrary-snapshot `simulateSync(snapshot, intent)`
   - arbitrary-snapshot `getAvailableActionsFor(snapshot)`
   - arbitrary-snapshot `isActionAvailableFor(snapshot, actionName)`
   - internal runtime-control methods such as publication reset, host execution, and queue/event helpers

There is no safe middle layer for consumers who need **arbitrary-snapshot read-only analysis** but do not need, and must not receive, runtime mutation or execution control.

### 1.2 The Gap Is Already Real

The gap is not hypothetical.

Any consumer that wants to reason over possible futures from hypothetical snapshots runs into the same problem:

- branching simulation helpers
- tree-search tools
- agent what-if analysis
- interactive tutorial or debugging helpers
- manual simulation sessions such as `createSimulationSession(app)`

These use cases all require:

- reading the current canonical snapshot
- simulating against caller-supplied canonical snapshots
- checking action availability against caller-supplied canonical snapshots
- projecting simulated canonical snapshots back to the SDK's public `Snapshot` surface

Today, the app-facing runtime cannot do this. The provider seam can, but it also exposes unsafe capabilities that are not appropriate for ordinary helper or tool authors.

### 1.3 The Existing Workaround Is a Boundary Smell

Earlier outer-package experiments projected hypothetical canonical snapshots by using a publication-oriented runtime path (`setVisibleSnapshot() -> getSnapshot()`) as a workaround.

That is a design smell. Projection of a hypothetical snapshot should be a **pure read operation**, not a visible-runtime mutation API used in no-notify mode.

### 1.4 Why This Is Not a Core Problem

Core already solves the hard part.

Because Core computation is pure and snapshots are immutable, arbitrary-snapshot simulation is already a valid substrate:

```typescript
computeSync(schema, snapshot, intent, context)
  -> apply(schema, snapshot, patches, context)
  -> applySystemDelta(snapshot', systemDelta)
```

The missing piece is not protocol semantics. The missing piece is a **sanctioned public SDK seam** for post-activation, read-only, arbitrary-snapshot operations.

---

## 2. Decision

SDK will introduce a **public Extension Kernel** as a safe, narrow subset of the internal `RuntimeKernel`.

The Extension Kernel is:

- **post-activation**
- **read-only**
- **arbitrary-snapshot capable**
- **projection-aware**
- **safe for helper and tool authors**

It is not a decorator. It does not alter laws, runtime identity, publication behavior, or execution behavior.

---

## 3. Amendment to ADR-017

ADR-017 established the current activation-first decorator model:

> identity-constitutive capability changes occur before `activate()`

This ADR preserves that rule for all capabilities that change what the runtime **is**:

- lineage
- governance
- any future law-transforming capability

This ADR adds a new permitted category:

> **Post-activation extension is allowed only for observationally pure capabilities.**

The Extension Kernel does not change runtime law. It only exposes a safe lens into computations the runtime already knows how to perform.

### 3.1 Ontological Distinction

- **Decorator capabilities** answer: what kind of world is this?
- **Extension-kernel capabilities** answer: what can an observer learn about this world's possible futures?

The former is ontological and must be composed before activation.
The latter is epistemological and may be exposed after activation, provided it cannot mutate, publish, execute, or otherwise alter the runtime.

---

## 4. Extension Kernel Contract

### 4.1 Acquisition

```typescript
import { getExtensionKernel } from "@manifesto-ai/sdk/extensions";

const ext = getExtensionKernel(app);
```

`getExtensionKernel()` accepts any activated SDK runtime:

```typescript
getExtensionKernel<T extends ManifestoDomainShape, Laws extends BaseLaws>(
  app: ActivatedInstance<T, Laws>
): ExtensionKernel<T>
```

This includes:

- base activated SDK runtimes
- lineage-decorated activated runtimes
- governance-decorated activated runtimes
- any future activated runtime that preserves the SDK base runtime contract

It MUST NOT accept a pre-activation `ComposableManifesto`.

Repeated calls for the same runtime MAY return the same frozen kernel object, but object identity is not part of the contract.

### 4.2 Public Surface

```typescript
interface ExtensionKernel<T extends ManifestoDomainShape> {
  /** Typed MEL reference tree for the activated runtime. */
  readonly MEL: TypedMEL<T>;

  /** Activated domain schema. */
  readonly schema: DomainSchema;

  /** Typed intent creation, identical to the activated runtime surface. */
  createIntent: TypedCreateIntent<T>;

  /** Current canonical runtime snapshot. */
  getCanonicalSnapshot(): CanonicalSnapshot<T["state"]>;

  /** Pure canonical -> projected conversion using the same boundary as getSnapshot(). */
  projectSnapshot(
    snapshot: CanonicalSnapshot<T["state"]>,
  ): Snapshot<T["state"]>;

  /** Pure dry-run against an arbitrary canonical snapshot. */
  simulateSync(
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ): ExtensionSimulateResult<T>;

  /** Action availability against an arbitrary canonical snapshot. */
  getAvailableActionsFor(
    snapshot: CanonicalSnapshot<T["state"]>,
  ): readonly (keyof T["actions"])[];

  /** Single-action availability against an arbitrary canonical snapshot. */
  isActionAvailableFor(
    snapshot: CanonicalSnapshot<T["state"]>,
    actionName: keyof T["actions"],
  ): boolean;
}

type ExtensionSimulateResult<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  /** Final canonical snapshot after compute + apply + applySystemDelta. */
  readonly snapshot: CanonicalSnapshot<T["state"]>;

  /** Patches produced by Core for this transition. */
  readonly patches: readonly Patch[];

  /** Requirement declarations after system-delta application. */
  readonly requirements: readonly Requirement[];

  /** Final compute status. */
  readonly status: ComputeStatus;

  /** Optional debug-grade dry-run diagnostics. */
  readonly diagnostics?: { readonly trace: TraceGraph };
};
```

All caller-supplied canonical snapshots are interpreted under the activated runtime's schema. Passing a canonical snapshot that does not conform to that schema is a contract violation.

### 4.3 Hard Boundary: Excluded Surface

The Extension Kernel MUST NOT expose any runtime-control capability.

The following remain internal/provider-only:

| Capability | Why Excluded |
|-----------|--------------|
| `setVisibleSnapshot()` | Publication mutation breaks snapshot sovereignty |
| `restoreVisibleSnapshot()` | Same |
| `executeHost()` | Breaks execution sovereignty |
| `emitEvent()` | Breaks lifecycle/event contract |
| `enqueue()` | Breaks dispatch serialization boundary |
| `dispose()` | Lifecycle ownership belongs to the runtime holder |
| provider activation helpers | Decorator-only concerns |

### 4.4 Invariants

| ID | Rule |
|----|------|
| EXT-PURE-1 | Every `ExtensionKernel` method is observationally pure with respect to the source runtime. No method may mutate, publish, enqueue, emit, or execute |
| EXT-PURE-2 | `simulateSync()` MUST use the same `computeSync -> apply -> applySystemDelta` transition contract as SDK `simulate()` |
| EXT-PROJ-1 | `projectSnapshot()` MUST apply the same projection rules as `getSnapshot()` |
| EXT-PROJ-2 | `projectSnapshot()` MUST be observationally pure. It MUST NOT be implemented by mutating the runtime's visible snapshot and reading it back |
| EXT-CANON-1 | All arbitrary-snapshot inputs MUST be canonical snapshots, not projected snapshots |
| EXT-CANON-2 | All arbitrary-snapshot inputs MUST conform to the activated runtime's schema. Cross-schema canonical snapshots are out of contract |
| EXT-SIM-1 | `simulateSync()` MUST preserve the same unavailable-action semantics as SDK `simulate()`: unavailable actions are rejected before dry-run compute begins |
| EXT-SAFE-1 | The returned kernel object MUST be frozen and its methods MUST be bound |
| EXT-SAFE-2 | The Extension Kernel MUST NOT expose any method that can alter visible runtime state |
| EXT-ACQ-1 | `getExtensionKernel()` MUST require an activated runtime instance. It MUST NOT become a second extension path for pre-activation composables |

---

## 5. Internal Implementation Consequence

This ADR requires a **pure internal projection primitive** in the SDK runtime.

The current workaround pattern:

```typescript
setVisibleSnapshot(hypotheticalCanonical);
getSnapshot();
```

MUST NOT be the basis of the Extension Kernel.

Instead, SDK must provide or derive an internal pure projection path equivalent to:

```typescript
projectCanonicalSnapshot(canonical, projectionPlan)
```

without mutating the visible runtime snapshot or reusing publication-control APIs.

This means the implementation may:

- add an internal projection helper to `RuntimeKernel`
- or construct the Extension Kernel with direct access to the existing projection primitive

but it MUST NOT route projection through visible-runtime mutation.

---

## 6. Options Considered

### Option 1: Keep the Status Quo

Only `@manifesto-ai/sdk/provider` exposes arbitrary-snapshot simulation.

- **Pro:** No new public surface
- **Con:** Tool/helper authors are forced either to overreach into provider seams or to give up on arbitrary-snapshot operations
- **Con:** Unsafe methods become tempting de facto public APIs

**Verdict:** Rejected.

### Option 2: SDK-Owned Helper Only

SDK ships `createSimulationSession(app)` or similar, but no public kernel.

- **Pro:** Smallest user-facing surface
- **Con:** Every new simulation helper requires an SDK release
- **Con:** Userland cannot compose on the substrate directly
- **Con:** SDK still needs the same safe substrate internally

**Verdict:** Not sufficient as the primary answer.

### Option 3: Public Extension Kernel

SDK ships a safe kernel and may ship first-party helpers on top of it.

- **Pro:** Clean substrate / helper separation
- **Pro:** Userland and SDK-owned helpers can share the same primitive
- **Pro:** Avoids creating new decorator packages for read-only simulation ergonomics
- **Con:** Adds a new public SDK contract to maintain

**Verdict:** Accepted.

---

## 7. Relationship to `@manifesto-ai/sdk/provider`

The Extension Kernel does not replace the provider seam.

| Subpath | Audience | Capability Level |
|---------|----------|------------------|
| `@manifesto-ai/sdk` | App consumers | Safe current-snapshot runtime |
| `@manifesto-ai/sdk/extensions` | Helper and tool authors | Safe arbitrary-snapshot read-only runtime |
| `@manifesto-ai/sdk/provider` | Decorator/runtime authors | Full provider-authoring seam |

The three layers are intentionally distinct.

- `sdk` owns the ordinary activated runtime
- `sdk/extensions` owns post-activation pure extension
- `sdk/provider` owns decorator/runtime composition internals

Ordinary app code SHOULD continue preferring `simulate()`, `getSnapshot()`, and other current-snapshot runtime conveniences when they are sufficient. The Extension Kernel is an advanced seam, not a replacement for the normal activated-runtime story.

---

## 8. Version Impact

| Package | Current | Target | Change Type |
|---------|---------|--------|-------------|
| SDK | v3.1.0 | v3.2.0 | Minor — additive public extension seam |
| Core | v4.0.0 | v4.0.0 | None |
| Host | v4.0.0 | v4.0.0 | None |
| Lineage | v3.0.0 | v3.0.0 | None |
| Governance | v3.0.0 | v3.0.0 | None |

This ADR landed as a minor SDK version bump because the change is additive and does not remove any existing surface from the SDK itself.

---

## 9. Acceptance Criteria

1. `@manifesto-ai/sdk/extensions` exports `getExtensionKernel` and `ExtensionKernel`
2. `ExtensionKernel` exposes the surface in §4.2 and no runtime-control methods from §4.3
3. For `snapshot === ext.getCanonicalSnapshot()` and an intent created from the same activated runtime, `ext.simulateSync(snapshot, intent)` produces:
   - a projected snapshot equal to the public `simulate()` snapshot after `projectSnapshot()`
   - the same `status`
   - the same `requirements`
4. `ext.getAvailableActionsFor(result.snapshot)` matches public `simulate().newAvailableActions` for the equivalent current-snapshot dry-run
5. `ext.projectSnapshot(ext.getCanonicalSnapshot())` matches `app.getSnapshot()`
6. No `ExtensionKernel` call triggers `subscribe()` callbacks or `on()` events on the source runtime
7. No `ExtensionKernel` call mutates the source runtime's visible snapshot or dispatch queue
8. Projection of hypothetical canonical snapshots no longer requires visible-runtime mutation APIs such as `setVisibleSnapshot()`

---

## 10. Non-Goals

- Raw `RuntimeKernel` promotion to public status
- Any new decorator package such as `@manifesto-ai/simulator`
- Execution control through the extension seam
- Publication control through the extension seam
- Cross-runtime coordination or multi-world orchestration
- Mandating where future helpers beyond `createSimulationSession(app)` must live

This ADR authorizes the substrate only. Helper ergonomics remain a separate decision.

---

## 11. Consequences

### Positive

- Makes arbitrary-snapshot simulation officially available to safe consumers
- Prevents provider-only internals from becoming unofficial public APIs
- Allows userland simulation helpers without creating new decorator packages
- Clarifies that simulation substrate belongs to SDK, not to dedicated outer capability layers

### Negative

- SDK takes on one more stable public seam
- ADR-017's earlier “SDK never changes for new capability layers” framing must now be interpreted more narrowly:
  - identity-changing capabilities still use pre-activation decorators
  - observationally pure post-activation extensions may be SDK-owned

### Follow-Up Work

- Evaluate whether SDK should ship additional first-party helpers on top of the same seam beyond `createSimulationSession(app)`

---

*End of ADR-019 v1*
