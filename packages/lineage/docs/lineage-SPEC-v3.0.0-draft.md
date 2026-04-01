# Manifesto Lineage Specification v3.0.0

> **Status:** Normative Draft, truthful current contract
> **Package:** `@manifesto-ai/lineage`
> **Related:** ADR-015, ADR-016, ADR-017

> **Historical Note:** [lineage-SPEC-2.0.0v.md](lineage-SPEC-2.0.0v.md) is retained as the pre-ADR-017 service-first baseline. The current package contract adds the decorator runtime and activated `LineageInstance`.

---

## 1. Purpose

`@manifesto-ai/lineage` owns continuity for the ADR-017 decorator model.

In v3, Lineage owns two public layers:

- the low-level continuity substrate:
  - world identity
  - branch/head/tip semantics
  - seal preparation and commit
  - restore normalization
  - `LineageStore` and `LineageService`
- the app-facing decorator runtime:
  - `withLineage(createManifesto(...), config).activate()`
  - seal-aware `commitAsync`
  - activated restore/head/branch/world queries

Lineage does not own authority, proposal legitimacy, or approval policy. Those remain governance concerns.

---

## 2. Public Surface

### 2.1 Decorator Entry

```ts
function withLineage<T extends ManifestoDomainShape>(
  manifesto: BaseComposableManifesto<T>,
  config: LineageConfig,
): LineageComposableManifesto<T>;
```

### 2.2 Config

```ts
type LineageConfig =
  | {
      readonly service: LineageService;
      readonly branchId?: BranchId;
    }
  | {
      readonly store: LineageStore;
      readonly branchId?: BranchId;
    };
```

Normative rules:

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V3-CFG-1 | MUST | callers provide either `service` or `store` |
| LIN-V3-CFG-2 | MUST | when `service` is absent, Lineage MUST create a `DefaultLineageService` from `store` |
| LIN-V3-CFG-3 | MUST NOT | Lineage create an implicit in-memory store/service pair when neither `service` nor `store` is provided |
| LIN-V3-CFG-4 | MUST | `branchId`, when provided, select the runtime continuity branch |

### 2.3 Activated Runtime

```ts
type LineageInstance<T extends ManifestoDomainShape> =
  Omit<ManifestoBaseInstance<T>, "dispatchAsync"> & {
    readonly commitAsync: TypedCommitAsync<T>;
    readonly restore: (worldId: WorldId) => Promise<void>;
    readonly getWorld: (worldId: WorldId) => Promise<World | null>;
    readonly getLineage: () => Promise<WorldLineage>;
    readonly getLatestHead: () => Promise<WorldHead | null>;
    readonly getHeads: () => Promise<readonly WorldHead[]>;
    readonly getBranches: () => Promise<readonly BranchInfo[]>;
    readonly getActiveBranch: () => Promise<BranchInfo>;
    readonly switchActiveBranch: (branchId: BranchId) => Promise<BranchSwitchResult>;
    readonly createBranch: (name: string, fromWorldId?: WorldId) => Promise<BranchId>;
  };
```

Normative rules:

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V3-SFC-1 | MUST | `LineageInstance<T>` include the entire base SDK runtime surface except that `dispatchAsync` is replaced by lineage-aware `commitAsync` |
| LIN-V3-SFC-2 | MUST | `restore(worldId)` resolve after the runtime visible snapshot has been updated |
| LIN-V3-SFC-3 | MUST | query methods return continuity truth from the backing `LineageService` |
| LIN-V3-SFC-4 | MUST | `getLineage()` expose the world DAG from the backing `LineageService` |
| LIN-V3-SFC-5 | MUST | `createBranch()` and `switchActiveBranch()` remain lineage-owned runtime verbs, not SDK verbs |

---

## 3. Activation Model

`withLineage()` decorates a **composable manifesto**. It does not create a live runtime.

Normative rules:

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V3-ACT-1 | MUST NOT | `withLineage()` expose runtime verbs before `activate()` |
| LIN-V3-ACT-2 | MUST | activation reuse the SDK activation boundary rather than wrapping an already running base instance |
| LIN-V3-ACT-3 | MUST | activation construct lineage-aware commit and publication from day one |
| LIN-V3-ACT-4 | MUST | `activate()` remain one-shot per decorated manifesto |

### 3.1 Continuity Bootstrap

Because SDK activation is synchronous while lineage stores are asynchronous, continuity bootstrap is deferred to the first async lineage operation.

Normative rules:

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V3-BOOT-1 | MUST | when the backing store is empty, the first async lineage operation bootstrap genesis from the current visible SDK snapshot |
| LIN-V3-BOOT-2 | MUST | when the backing store is non-empty, the first async lineage operation bind to `branchId` when provided, otherwise the persisted active branch |
| LIN-V3-BOOT-3 | MUST | binding an existing branch restore that branch head snapshot into the runtime before the operation resolves |
| LIN-V3-BOOT-4 | MUST | bootstrap happen at most once per activated lineage runtime |

---

## 4. Lineage-Aware Commit

`LineageInstance.commitAsync()` means:

1. execute the intent against the visible runtime snapshot
2. seal the resulting terminal snapshot into lineage
3. publish only the snapshot that is legitimate as the new visible head

### 4.1 Availability and Queue

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V3-DISPATCH-1 | MUST | preserve the SDK FIFO per-instance queue |
| LIN-V3-DISPATCH-2 | MUST | evaluate action availability at dequeue time against the currently visible snapshot |
| LIN-V3-DISPATCH-3 | MUST | unavailable actions reject without sealing or snapshot publication |

### 4.2 Successful Completed Commit

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V3-DISPATCH-4 | MUST | a completed terminal snapshot prepare and commit a next lineage seal before publication |
| LIN-V3-DISPATCH-5 | MUST | `commitAsync()` resolve only after seal commit succeeds |
| LIN-V3-DISPATCH-6 | MUST | subscribers and `dispatch:completed` fire only after seal commit succeeds |
| LIN-V3-DISPATCH-7 | MUST | the visible runtime snapshot and the active branch head refer to the same completed World after resolution |

### 4.3 Failed or Pending Terminal Commit

Lineage still seals failed terminal snapshots. However failed continuity does not become the active head.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V3-DISPATCH-8 | MUST | host results whose sealed lineage commit does not advance `head` reject the dispatch Promise |
| LIN-V3-DISPATCH-9 | MUST | failed or pending terminal snapshots MAY be sealed, but MUST NOT become the visible runtime snapshot |
| LIN-V3-DISPATCH-10 | MUST | when the sealed result does not advance `head`, the runtime MUST restore Host execution state back to the current visible snapshot before returning control |
| LIN-V3-DISPATCH-11 | MUST | `dispatch:failed` MAY fire for sealed failed outcomes, but visible state publication MUST NOT occur |

### 4.4 Seal Failure

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V3-DISPATCH-12 | MUST | if seal prepare or commit fails, `commitAsync()` reject |
| LIN-V3-DISPATCH-13 | MUST | if seal prepare or commit fails, the unsealed terminal snapshot MUST NOT become externally visible |
| LIN-V3-DISPATCH-14 | MUST | on seal failure the runtime revert Host execution state back to the last visible snapshot |

---

## 5. Restore and Branch Semantics

### 5.1 Restore

`LineageService.restore(worldId)` continues to return a normalized snapshot substrate.

`LineageInstance.restore(worldId)` is the runtime-facing projection:

- it updates the visible runtime snapshot
- it resets Host execution state to that snapshot
- it does not fabricate approval or governance legitimacy

Normative rules:

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V3-RESTORE-1 | MUST | `LineageInstance.restore(worldId)` delegate normalization to `LineageService.restore(worldId)` |
| LIN-V3-RESTORE-2 | MUST | `LineageInstance.restore(worldId)` update the visible runtime snapshot before resolving |
| LIN-V3-RESTORE-3 | SHOULD | callers use `switchActiveBranch()` when they want branch continuity to move explicitly |

### 5.2 Branch Switching

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V3-BRANCH-1 | MUST | `switchActiveBranch(branchId)` switch the backing lineage branch and restore that branch head snapshot into the runtime |
| LIN-V3-BRANCH-2 | MUST | after branch switch resolves, `getSnapshot()` reflect the target branch head snapshot |
| LIN-V3-BRANCH-3 | MUST | `createBranch(name, fromWorldId?)` default to the current completed continuity point when `fromWorldId` is omitted |

---

## 6. Dispose

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V3-DISP-1 | MUST | `dispose()` delegate to the underlying SDK runtime |
| LIN-V3-DISP-2 | MUST | after dispose, `commitAsync`, `restore`, `createBranch`, and `switchActiveBranch` reject with `DisposedError` |
| LIN-V3-DISP-3 | MAY | read-only query methods continue to read from the backing lineage service after dispose |

---

## 7. Low-Level Substrate

The service/store/hash contract from v2 remains lineage-owned.

`LineageStore`, `LineageService`, `PreparedLineageCommit`, `World`, `WorldHead`, `BranchInfo`, restore normalization, snapshot hashing, `head` / `tip` / `epoch` semantics, and idempotent reuse rules continue to be normative. This v3 draft layers the decorator runtime on top of that substrate; it does not replace it.

---

## 8. Compliance Checklist

An implementation is v3-compliant only if all of the following hold:

- `withLineage()` accepts a composable manifesto and exposes no runtime verbs pre-activation.
- activated lineage runtime promotes `commitAsync` instead of duplicating a second execution path.
- successful dispatch resolves only after seal commit succeeds.
- seal failure rejects and does not publish.
- failed sealed outcomes do not replace the visible head snapshot.
- branch switching restores the target branch head snapshot into the runtime.
- the package documents `withLineage(...).activate()` as the canonical app-facing lineage path.
