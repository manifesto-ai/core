# Manifesto Lineage Specification v5.0.0

> **Status:** Normative (Living Document)
> **Package:** `@manifesto-ai/lineage`
> **Compatible with:** Manifesto v5 substrate, ADR-025 Snapshot Ontology, SDK SPEC v5, Governance SPEC v5
> **Implements:** ADR-015, ADR-016, ADR-017, ADR-025, ADR-026

> **Historical Note:** [lineage-SPEC-2.0.0v.md](lineage-SPEC-2.0.0v.md)
> is retained as the pre-ADR-017 service-first baseline. Git history preserves
> the v3 decorator runtime contract centered on `commitAsync()` and
> `commitAsyncWithReport()`.
>
> **Current Contract Status:** Lineage v5 is the continuity-owning decorator for
> the SDK v5 action-candidate runtime. The canonical lineage write ingress is
> `actions.x.submit(...)` / `action(name).submit(...)` on a lineage-mode
> `ManifestoApp`. V3 `commitAsync*` names are historical migration inputs, not
> canonical v5 runtime root methods.

---

## 1. Change Log

| Version | Change | Source |
|---------|--------|--------|
| v5.0.0 | Adopt ADR-026 lineage-mode `submit()` surface and ADR-025 `state` / `namespaces` Snapshot ontology | ADR-025, ADR-026 |
| v3.0.0 | Decorator runtime with `commitAsync()` / `commitAsyncWithReport()` over the continuity substrate | ADR-017 |
| v2.0.0 | Service-first continuity substrate baseline | ADR-015, ADR-016 |

## 2. Purpose

`@manifesto-ai/lineage` owns sealed continuity for Manifesto runtimes.

Lineage owns:

- world identity
- branch, head, tip, and epoch semantics
- seal preparation and commit
- restore normalization and stored canonical snapshot lookup
- `LineageStore` and `LineageService`
- the lineage-mode decorator implementation of law-aware `submit()`
- additive lineage write reports

Lineage does not own semantic computation, Host effect execution, Governance
authority, proposal legitimacy, or approval policy.

The v5 public model is:

```typescript
const app = withLineage(createManifesto<TodoDomain>(schema, effects), {
  store,
}).activate();

const result = await app.actions.addTodo.submit({ title: "Ship v5" });
```

`submit()` is the common SDK verb, but the lineage decorator owns what it means
in lineage mode: admitted candidates execute through the runtime path and then
enter lineage sealing before any lineage-visible publication can occur.

---

## 3. Public Surface

### 3.1 Decorator Entry

```typescript
declare function withLineage<TDomain extends ManifestoDomainShape>(
  manifesto: ComposableManifesto<TDomain, "base">,
  config: LineageConfig,
): ComposableManifesto<TDomain, "lineage">;
```

`withLineage()` decorates a composable manifesto. It does not create a live
runtime and MUST NOT expose runtime verbs before `activate()`.

### 3.2 Config

```typescript
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

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-CFG-1 | MUST | Callers MUST provide either `service` or `store`. |
| LIN-V5-CFG-2 | MUST | When `service` is absent, Lineage MUST create a `DefaultLineageService` from `store`. |
| LIN-V5-CFG-3 | MUST NOT | Lineage MUST NOT create an implicit in-memory store/service pair when neither `service` nor `store` is provided. |
| LIN-V5-CFG-4 | MUST | `branchId`, when provided, MUST select the runtime continuity branch. |

### 3.3 Activated Runtime

```typescript
type LineageInstance<TDomain extends ManifestoDomainShape> =
  ManifestoApp<TDomain, "lineage"> & LineageContinuitySurface<TDomain>;

type LineageContinuitySurface<TDomain extends ManifestoDomainShape> = {
  restore(worldId: WorldId): Promise<void>;
  getWorld(worldId: WorldId): Promise<WorldRecord | null>;
  getWorldSnapshot(worldId: WorldId): Promise<CanonicalSnapshot | null>;
  getLineage(): Promise<WorldLineage>;
  getLatestHead(): Promise<WorldHead | null>;
  getHeads(): Promise<readonly WorldHead[]>;
  getBranches(): Promise<readonly BranchInfo[]>;
  getActiveBranch(): Promise<BranchInfo>;
  switchActiveBranch(branchId: BranchId): Promise<BranchSwitchResult>;
  createBranch(name: string, fromWorldId?: WorldId): Promise<BranchId>;
};
```

The SDK owns `ManifestoApp`, action handles, admission, preview, projected
snapshot reads, observation, and inspection. Lineage owns the continuity
extension above and the lineage-mode implementation of `submit()`.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-SFC-1 | MUST | Activated lineage runtimes MUST expose the SDK v5 root grammar plus `LineageContinuitySurface`. |
| LIN-V5-SFC-2 | MUST | `actions.x.submit()` and `action(name).submit()` MUST be the canonical lineage write ingress. |
| LIN-V5-SFC-3 | MUST NOT | Canonical v5 lineage runtimes MUST NOT expose root `commitAsync()` or `commitAsyncWithReport()`. |
| LIN-V5-SFC-4 | MUST | Query methods MUST return continuity truth from the backing `LineageService`. |
| LIN-V5-SFC-5 | SHOULD | `getWorldSnapshot(worldId)` SHOULD expose the stored sealed canonical snapshot substrate for a specific world when available. |
| LIN-V5-SFC-6 | MUST | `getLineage()` MUST expose the world DAG from the backing `LineageService`. |
| LIN-V5-SFC-7 | MUST | `createBranch()` and `switchActiveBranch()` MUST remain lineage-owned runtime verbs, not SDK verbs. |

### 3.4 V3 Hard-Cut Removals

The following v3 lineage runtime root names are not canonical v5 public surface:

```text
commitAsync
commitAsyncWithReport
```

Migration mapping:

| v3 API | v5 API |
|--------|--------|
| `commitAsync(intent)` | `actions.x.submit(input)` on a lineage runtime |
| `commitAsyncWithReport(intent)` | `actions.x.submit(input)` result `report` field |

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-HC-1 | MUST | V3 lineage root write verbs MUST be absent from the canonical v5 lineage runtime root. |
| LIN-V5-HC-2 | MUST | Migration documentation MAY reference v3 names only as historical mapping guidance. |
| LIN-V5-HC-3 | MUST NOT | A lineage compat alias MUST NOT bypass decorator-owned `submit()` authority. |

---

## 4. Lineage Submission Result

The SDK fixes the common discriminants and result envelope. Lineage owns the
meaning of `WorldRecord`, sealing, branch/head effects, and `LineageWriteReport`.

```typescript
type WorldRecord = {
  readonly worldId: WorldId;
  readonly schemaHash: SchemaHash;
  readonly snapshotHash: string;
  readonly parentWorldId: WorldId | null;
  readonly terminalStatus: TerminalStatus;
};

type LineageSubmissionResult<
  TDomain extends ManifestoDomainShape,
  Name extends ActionName<TDomain>,
> =
  | {
      readonly ok: true;
      readonly mode: "lineage";
      readonly status: "settled";
      readonly action: Name;
      readonly before: ProjectedSnapshot<TDomain>;
      readonly after: ProjectedSnapshot<TDomain>;
      readonly world: WorldRecord;
      readonly outcome: ExecutionOutcome;
      readonly report?: LineageWriteReport;
    }
  | {
      readonly ok: false;
      readonly mode: "lineage";
      readonly action: Name;
      readonly admission: AdmissionFailure<Name>;
    };
```

`before` is the projected visible snapshot before submission. `after` is the
projected snapshot of the sealed `WorldRecord` carried by the result. For a
sealed non-head-advancing outcome, `after` is not the post-call `snapshot()`
value; visible runtime state remains at, or is restored to, the current visible
lineage head. Callers that need publication/head state MUST inspect
`report.published`, `report.headAdvanced`, `snapshot()`, or the lineage head.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-RESULT-1 | MUST | Successful lineage submissions MUST return `mode: "lineage"` and `status: "settled"`. |
| LIN-V5-RESULT-2 | MUST | Successful lineage submissions MUST include the sealed `world: WorldRecord`. |
| LIN-V5-RESULT-3 | MUST | Admission failures MUST resolve as `ok: false` and MUST NOT seal or publish. |
| LIN-V5-RESULT-4 | MUST | `result.ok` MUST represent the submission protocol envelope, not domain success. |
| LIN-V5-RESULT-5 | MUST | Domain success, stop, or fail MUST be represented by `ExecutionOutcome`. |
| LIN-V5-RESULT-6 | MUST | `result.after` MUST project the sealed `WorldRecord` snapshot, not necessarily the visible runtime head after the call. |

### 4.1 Lineage Write Report

```typescript
type LineageWriteReport = {
  readonly mode: "lineage";
  readonly action: string;
  readonly worldId: WorldId;
  readonly branchId: BranchId;
  readonly headAdvanced: boolean;
  readonly published: boolean;
  readonly outcome: ExecutionOutcome;
  readonly sealedSnapshotHash: string;
  readonly changes: readonly ChangedPath[];
  readonly requirements: readonly Requirement[];
  readonly diagnostics?: ExecutionDiagnostics;
};
```

`LineageWriteReport` is the v5 successor attachment for v3
`CommitReport`. It is additive; the `LineageSubmissionResult` envelope remains
the canonical submit result.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-REPORT-1 | MUST | Reports MUST preserve all lineage seal/publication rules. |
| LIN-V5-REPORT-2 | MUST | Reports MUST identify `worldId`, `branchId`, `headAdvanced`, and `published`. |
| LIN-V5-REPORT-3 | MUST | `published: true` MUST imply `headAdvanced: true` for the active branch. |
| LIN-V5-REPORT-4 | MUST | `headAdvanced: false` MUST NOT imply visible state publication. |
| LIN-V5-REPORT-5 | MUST NOT | Reports MUST NOT fabricate a world or sealed outcome when seal prepare or commit failed. |
| LIN-V5-REPORT-6 | MUST | `report.worldId` MUST identify the same world as `result.world.worldId`. |

---

## 5. Lineage-Aware Submit Law

Lineage-mode `submit()` means:

1. Run SDK admission for the bound action candidate.
2. Execute the admitted candidate through the SDK/Host runtime path.
3. Seal the terminal canonical snapshot into Lineage.
4. Publish lineage-visible state only when lineage seal and head law allow it.

### 5.1 Admission and Queue

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-SUBMIT-1 | MUST | Lineage `submit()` MUST preserve SDK admission ordering: availability, input, then dispatchability. |
| LIN-V5-SUBMIT-2 | MUST | Lineage `submit()` MUST re-check legality against the then-current runtime state. |
| LIN-V5-SUBMIT-3 | MUST | Unavailable or invalid candidates MUST return an admission failure without sealing or publishing. |
| LIN-V5-SUBMIT-4 | MUST NOT | Prior `available()`, `check()`, or `preview()` results MUST NOT be treated as durable capability tokens. |

### 5.2 Settled Submit

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-SUBMIT-5 | MUST | Lineage `submit()` MUST settle only from Core terminal statuses `complete`, `halted`, or `error`. |
| LIN-V5-SUBMIT-6 | MUST | A terminal snapshot MUST prepare and commit a next lineage seal before visible publication. |
| LIN-V5-SUBMIT-7 | MUST | `submit()` MUST resolve only after the lineage seal commit succeeds and any required visible-state restoration is complete. |
| LIN-V5-SUBMIT-8 | MUST | State observers MUST fire only after seal commit succeeds and lineage publication is legitimate. |
| LIN-V5-SUBMIT-9 | MUST | When `report.published === true`, the visible runtime snapshot and active branch head MUST refer to the same completed lineage world. |

### 5.3 Terminal Domain Stop/Fail Outcomes

Lineage may seal terminal `halted` or `error` snapshots. These are domain
outcomes, not operational settlement failures. Such worlds are continuity
records, not visible heads, unless a future lineage SPEC explicitly changes head
law.

A sealed failed outcome is derived from the terminal canonical Snapshot's
semantic state: non-empty `system.pendingRequirements` or non-null
`system.lastError`. Host-owned `namespaces.host.lastError` is a canonical-only
diagnostic; by itself it MUST NOT define the sealed terminal outcome.

Core `pending` is not a settled lineage outcome. If the runtime cannot produce a
terminal `complete`, `halted`, or `error` snapshot after admission, `submit()`
rejects as an operational failure under seal law.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-SUBMIT-10 | MUST | Terminal `halted` or `error` snapshots MAY be sealed and returned as `ok: true`, `status: "settled"` with `outcome.kind: "stop"` or `"fail"`. |
| LIN-V5-SUBMIT-11 | MUST | Non-head-advancing sealed outcomes MUST report `published: false` and `headAdvanced: false`. |
| LIN-V5-SUBMIT-12 | MUST | When a sealed result does not advance head, runtime visible state MUST be restored to the current visible lineage head before control returns. |
| LIN-V5-SUBMIT-13 | MUST NOT | Lineage MUST NOT derive sealed failed outcome from Host-owned `namespaces.host.lastError` alone. |
| LIN-V5-SUBMIT-14 | MUST NOT | Core `pending` MUST NOT be represented as a settled `LineageSubmissionResult`. |

### 5.4 Seal Failure

If the runtime cannot produce a terminal snapshot after admission, or if seal
prepare or seal commit fails, the lineage law boundary did not settle. The
`submit()` Promise MUST reject with the SDK-owned operational failure surface and
MUST emit `submission:failed`.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-SEAL-1 | MUST | If the runtime cannot produce `complete`, `halted`, or `error` after admission, `submit()` MUST reject as an operational runtime failure. |
| LIN-V5-SEAL-2 | MUST | If seal prepare or commit fails, `submit()` MUST reject as an operational settlement failure. |
| LIN-V5-SEAL-3 | MUST | If seal prepare or commit fails, the unsealed terminal snapshot MUST NOT become externally visible. |
| LIN-V5-SEAL-4 | MUST | On seal failure, runtime visible state MUST be restored to the last visible lineage head. |
| LIN-V5-SEAL-5 | MUST NOT | Seal failure MUST NOT fabricate `world`, `LineageWriteReport`, `ExecutionOutcome`, or projected `after` snapshots. |

---

## 6. ADR-025 Snapshot Hash and World Identity

Lineage v5 follows ADR-025.

```text
snapshotHash = hash(snapshot.state, semanticSystemDigest)
worldId = hash(schemaHash, snapshotHash, parentWorldId)
```

`semanticSystemDigest` is derived from semantic system fields only. These names
are conceptual hash inputs derived from the ADR-025 canonical Snapshot; they do
not require literal stored fields named `terminalStatus`, `currentError`, or
`pendingDigest`.

```text
semanticSystemDigest = hash(
  system.terminalStatus,
  system.currentError,
  system.pendingDigest
)
```

`snapshot.namespaces` is operational state. It is stored in canonical snapshots
where appropriate, but it does not enter `snapshotHash` or `worldId`.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-HASH-1 | MUST | `snapshotHash` MUST be derived from `snapshot.state` and semantic system digest. |
| LIN-V5-HASH-2 | MUST NOT | `snapshot.namespaces` MUST NOT enter `snapshotHash` or `worldId`. |
| LIN-V5-HASH-3 | MUST | `worldId` MUST be derived from `schemaHash`, `snapshotHash`, and `parentWorldId`. |
| LIN-V5-HASH-4 | MUST | `parentWorldId` MUST participate in child world identity. |
| LIN-V5-HASH-5 | MUST | `system.lastError` and pending requirements MUST participate through the semantic system digest. |
| LIN-V5-HASH-6 | MUST NOT | Host-owned namespace diagnostics MUST NOT be promoted into semantic system digest without domain authority. |
| LIN-V5-HASH-7 | MUST | Stored canonical snapshots MAY retain `namespaces`, but hash input construction MUST exclude them. |

---

## 7. Restore and Branch Semantics

### 7.1 Restore

`LineageService.restore(worldId)` returns a normalized canonical snapshot
substrate suitable for runtime resume.

`getWorldSnapshot(worldId)` is the complementary read path for the stored sealed
canonical snapshot substrate. It is not the restore-normalized resume contract.

Runtime `restore(worldId)`:

- updates the visible runtime snapshot
- resets Host execution state to that snapshot
- does not fabricate approval or governance legitimacy

ADR-025 separates stored canonical lookup from execution restore:

- stored canonical lookup uses `migrateStoredSnapshotShape(worldId)` or an
  equivalent path to convert sealed snapshots into the v5 canonical shape while
  preserving stored namespaces for forensic inspection
- runtime restore uses `normalizeForRestore(worldId)` or an equivalent path to
  reset operational namespace state for execution safety
- partial `namespaces.host` and `namespaces.mel` payloads MUST be
  deep-normalized according to NSINIT-2 before runtime resume

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-RESTORE-1 | MUST | Runtime `restore(worldId)` MUST delegate normalization to `LineageService.restore(worldId)`. |
| LIN-V5-RESTORE-2 | MUST | Runtime `restore(worldId)` MUST update the visible runtime snapshot before resolving. |
| LIN-V5-RESTORE-3 | MUST | Stored canonical lookup MUST migrate sealed snapshots to ADR-025 shape and preserve stored namespaces. |
| LIN-V5-RESTORE-4 | MUST | Runtime restore MUST normalize operational namespaces before runtime resume. |
| LIN-V5-RESTORE-5 | MUST | Restore normalization MUST produce ADR-025 canonical shape with always-present `state` and `namespaces`. |
| LIN-V5-RESTORE-6 | MUST | Runtime restore MUST deep-normalize partial `namespaces.host` and `namespaces.mel` payloads before resume. |
| LIN-V5-RESTORE-7 | SHOULD | Callers SHOULD use `switchActiveBranch()` when they want branch continuity to move explicitly. |

### 7.2 Branch Switching

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-BRANCH-1 | MUST | `switchActiveBranch(branchId)` MUST switch the backing lineage branch and restore that branch head snapshot into the runtime. |
| LIN-V5-BRANCH-2 | MUST | After branch switch resolves, `snapshot()` MUST reflect the target branch head through the projected SDK read model. |
| LIN-V5-BRANCH-3 | MUST | `createBranch(name, fromWorldId?)` MUST default to the current completed continuity point when `fromWorldId` is omitted. |

---

## 8. Dispose

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-DISP-1 | MUST | `dispose()` MUST delegate to the underlying SDK runtime. |
| LIN-V5-DISP-2 | MUST | After dispose, `submit()`, `restore`, `createBranch`, and `switchActiveBranch` MUST reject with the SDK disposed error surface. |
| LIN-V5-DISP-3 | MAY | Read-only query methods MAY continue to read from the backing lineage service after dispose. |

---

## 9. Low-Level Substrate

The service/store/hash contract remains lineage-owned.

`LineageStore`, `LineageService`, `PreparedLineageCommit`, `WorldRecord`,
`WorldHead`, `BranchInfo`, restore normalization, snapshot hashing, `head`,
`tip`, `epoch`, and idempotent reuse rules continue to be normative. This v5
living specification layers the SDK action-candidate decorator runtime on top
of that substrate; it does not make SDK, Host, or Governance the owner of
continuity storage semantics.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-V5-SUBSTRATE-1 | MUST | Lineage MUST own sealed continuity storage semantics. |
| LIN-V5-SUBSTRATE-2 | MUST NOT | SDK, Host, or Governance MUST NOT apply patches directly to create lineage worlds. |
| LIN-V5-SUBSTRATE-3 | MUST NOT | Lineage MUST NOT evaluate governance authority policy. |
| LIN-V5-SUBSTRATE-4 | MUST NOT | Lineage MUST NOT compute semantic state transitions. |

---

## 10. Compliance Checklist

An implementation is v5-compliant only if all of the following hold:

- `withLineage()` accepts a composable manifesto and exposes no runtime verbs pre-activation.
- Activated lineage runtime exposes the SDK v5 action-candidate grammar.
- Canonical lineage write ingress is `actions.x.submit()` / `action(name).submit()`.
- `commitAsync()` and `commitAsyncWithReport()` are absent from the canonical v5 lineage runtime root.
- Successful head-advancing submissions resolve only after seal commit succeeds.
- Seal failure rejects and does not publish.
- Core `pending` is never represented as a settled lineage outcome.
- Non-head-advancing sealed outcomes do not replace the visible head snapshot.
- `LineageSubmissionResult.after` projects the sealed `WorldRecord`; visible
  publication is governed by report flags and runtime head reads.
- `LineageSubmissionResult.world` carries the sealed `WorldRecord`.
- `LineageWriteReport` carries lineage continuity facts without weakening seal law.
- `snapshotHash` excludes `snapshot.namespaces`.
- `worldId` includes `schemaHash`, `snapshotHash`, and `parentWorldId`.
- Stored snapshot lookup and runtime restore are separated according to ADR-025.
- Branch switching restores the target branch head snapshot into the runtime.
- The package documents `withLineage(...).activate()` as the canonical app-facing lineage path.
