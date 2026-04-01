# Manifesto Lineage Protocol Specification

> **Status:** Historical Normative Reference
> **Package:** `@manifesto-ai/lineage`
> **Authors:** Manifesto Team
> **License:** MIT
> **Related:** ADR-014, ADR-015, ADR-016

> **Historical Note:** [lineage-SPEC-v3.0.0-draft.md](lineage-SPEC-v3.0.0-draft.md) now defines the truthful current contract. This document is retained as the pre-ADR-017 service-first baseline.

---

## Changelog

| Version | Summary | Key ADRs |
|---------|---------|----------|
| v2.0.0 | ADR-015 + ADR-016 epoch boundary: current-error hash identity, parent-linked `WorldId`, `SealAttempt`, `tip`, `headAdvancedAt`, idempotent reuse, restore normalization | ADR-014, ADR-015, ADR-016 |
| v1.0.1 | Patch release - adds `BranchInfo.epoch`, `LineageService.getBranch()`, and public-contract epoch read clarification | ADR-014 |
| v1.0.0 | Initial split-native lineage protocol | ADR-014 |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Normative Language](#2-normative-language)
3. [Scope and Non-Goals](#3-scope-and-non-goals)
4. [Boundary](#4-boundary)
5. [Core Types and Identity](#5-core-types-and-identity)
6. [Identity Computation](#6-identity-computation)
7. [Seal Protocol](#7-seal-protocol)
8. [Idempotent Reuse Policy](#8-idempotent-reuse-policy)
9. [BaseWorld Admissibility](#9-baseworld-admissibility)
10. [Branch Model](#10-branch-model)
11. [Persistence Model](#11-persistence-model)
12. [DAG Rules](#12-dag-rules)
13. [Replay Support](#13-replay-support)
14. [Resume Semantics](#14-resume-semantics)
15. [Epoch Semantics](#15-epoch-semantics)
16. [Invariants](#16-invariants)
17. [Compliance](#17-compliance)

---

## 1. Purpose

`@manifesto-ai/lineage` is the continuity engine of Manifesto. It owns the deterministic identity of sealed Worlds, the persistence substrate for immutable history, and the branch-local rules required to continue and restore that history safely.

This specification defines:

- deterministic `snapshotHash` and `worldId` computation
- lineage-owned `terminalStatus` derivation from `Snapshot`
- seal preparation and atomic commit contracts
- `head` / `tip` / `epoch` / `headAdvancedAt` branch semantics
- immutable `World`, `WorldEdge`, and `SealAttempt` records
- snapshot restore and resume normalization

`@manifesto-ai/lineage` does not evaluate legitimacy, authority, or proposal lifecycle. Those concerns belong to `@manifesto-ai/governance` per ADR-014.

---

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119 / RFC 8174.

---

## 3. Scope and Non-Goals

### 3.1 In Scope

| Concern | Description |
|---------|-------------|
| Deterministic world identity | `worldId = hash(schemaHash, snapshotHash, parentWorldId)` |
| Snapshot identity | `snapshotHash` from domain state + terminal status + current error + pending digest |
| Seal protocol | Prepare/commit separation and `PreparedLineageCommit` |
| Persistence model | `LineageStore`, atomic commit, immutable lineage records |
| Branch model | `head`, `tip`, `epoch`, `headAdvancedAt`, branch switch |
| Restore | World-based restore with normalization before resume |
| Replay | Attempt-scoped delta contract and audit surfaces |

### 3.2 Explicit Non-Goals

| Concern | Why out of scope |
|---------|------------------|
| Proposal lifecycle | Governance owns legitimacy and terminal judgment |
| Authority evaluation | Governance concern |
| Event emission | Governance or caller concern, not lineage |
| Host execution | Host executes effects; lineage only seals terminal results |
| Cross-store reconciliation | World facade owns atomic cross-protocol commit |

---

## 4. Boundary

### 4.1 Lineage's "Does NOT Know" Boundary

Lineage MUST NOT import or depend on:

- `Proposal`, `DecisionRecord`, `ActorBinding`, or any governance-owned type
- authority rules, approval policy, or proposal stage semantics
- host execution internals
- wall-clock or randomness inside prepare methods

Lineage stores provenance only as opaque strings (`ProvenanceRef`). The meaning of those refs is interpreted by higher layers.

### 4.2 What Lineage Provides to Governance

Lineage exposes the continuity contract that governance depends on:

| Surface | Role |
|---------|------|
| `LineageStore` | Persistence contract |
| `WorldId`, `BranchId`, `ProvenanceRef`, `ArtifactRef`, `AttemptId` | Identity types |
| `World`, `WorldEdge`, `SealAttempt`, `BranchInfo`, `WorldHead` | Public continuity records |
| `PreparedLineageCommit` | Deterministic seal result |
| `SnapshotHashInput`, `CurrentErrorSignature` | Identity/audit structures |
| `restore(worldId)` | Resume boundary |

---

## 5. Core Types and Identity

### 5.1 Identifier Types

```typescript
type WorldId = string;       // hash({ schemaHash, snapshotHash, parentWorldId })
type BranchId = string;      // unique branch identifier
type AttemptId = string;     // hash({ worldId, branchId, createdAt })
type SchemaHash = string;    // hash of domain schema definition
type ProvenanceRef = string; // opaque - governance interprets the meaning

type ArtifactRef = {
  readonly uri: string;
  readonly hash: string;
};
```

### 5.2 World

A `World` is the immutable commit-level identity of a sealed terminal snapshot.

```typescript
type TerminalStatus = "completed" | "failed";

type World = {
  readonly worldId: WorldId;
  readonly schemaHash: SchemaHash;
  readonly snapshotHash: string;
  readonly parentWorldId: WorldId | null;
  readonly terminalStatus: TerminalStatus;
};
```

`World` contains no attempt-local chronology or provenance metadata. Those belong to `SealAttempt`.

### 5.3 WorldEdge

`WorldEdge` captures only DAG structure.

```typescript
type WorldEdge = {
  readonly edgeId: string;
  readonly from: WorldId;
  readonly to: WorldId;
};
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-EDGE-1 | MUST | `edgeId` MUST be computed as `computeHash({ from, to })` |

### 5.4 SealAttempt

`SealAttempt` captures every seal operation, including idempotent reuse.

```typescript
type SealAttempt = {
  readonly attemptId: AttemptId;
  readonly worldId: WorldId;
  readonly branchId: BranchId;
  readonly baseWorldId: WorldId | null;
  readonly parentWorldId: WorldId | null;
  readonly proposalRef?: ProvenanceRef;
  readonly decisionRef?: ProvenanceRef;
  readonly createdAt: number;
  readonly traceRef?: ArtifactRef;
  readonly patchDelta?: PersistedPatchDeltaV2;
  readonly reused: boolean;
};
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| MRKL-ATTEMPT-1 | MUST | Every genesis and next seal preparation MUST produce one `SealAttempt` in `PreparedLineageCommit` |
| MRKL-ATTEMPT-2 | MUST | `SealAttempt` MUST be persisted whether the World is new or reused |
| MRKL-ATTEMPT-3 | MUST | `SealAttempt.baseWorldId` MUST equal the seal input's `baseWorldId` for next seals; genesis uses `null` |
| MRKL-ATTEMPT-4 | MUST | `SealAttempt.parentWorldId` MUST equal the branch's `tip` at prepare time; genesis uses `null` |
| MRKL-ATTEMPT-5 | MUST NOT | `attemptId`, attempt chronology, provenance, trace, and delta MUST NOT participate in `snapshotHash` or `worldId` computation |
| MRKL-ATTEMPT-6 | MUST | `attempt.reused` MUST be `false` in prepared output and MUST become `true` at commit time when idempotent reuse is detected |

### 5.5 WorldLineage

```typescript
type WorldLineage = {
  readonly genesis: WorldId;
  readonly worlds: ReadonlyMap<WorldId, World>;
  readonly edges: ReadonlyMap<string, WorldEdge>;
};
```

### 5.6 Snapshot Type Dependency (Normative)

Lineage identity depends on the public `Snapshot` contract from `@manifesto-ai/core`.

```typescript
type CurrentErrorSignature = {
  readonly code: string;
  readonly source: {
    readonly actionId: string;
    readonly nodePath: string;
  };
} | null;

type SnapshotHashInput = {
  readonly data: Record<string, unknown>;
  readonly system: {
    readonly terminalStatus: TerminalStatus;
    readonly currentError: CurrentErrorSignature;
    readonly pendingDigest: string;
  };
};
```

The Lineage hash contract depends on:

- `snapshot.data`
- `snapshot.system.lastError`
- `snapshot.system.pendingRequirements`
- `snapshot.meta.schemaHash`

The Lineage hash contract MUST NOT depend on any removed Core surfaces such as `snapshot.system.errors`.

### 5.7 Platform Namespace Policy

All `$`-prefixed keys in `snapshot.data` are platform namespaces.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-NS-1 | MUST NOT | `data.$host` MUST NOT participate in `snapshotHash` |
| LIN-NS-2 | MUST NOT | `data.$mel` MUST NOT participate in `snapshotHash` |
| LIN-NS-3 | MUST NOT | Future `data.$*` namespaces MUST NOT participate in `snapshotHash` |

---

## 6. Identity Computation

### 6.1 WorldId Computation

`worldId` is positional, not content-only.

```typescript
worldId = computeHash({ schemaHash, snapshotHash, parentWorldId });
```

`parentWorldId` is:

- `null` for genesis
- the branch's `tip` at prepare time for next seals

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-ID-1 | MUST | `worldId` MUST be computed as `computeHash({ schemaHash, snapshotHash, parentWorldId })` |
| LIN-ID-2 | MUST | Genesis MUST use `parentWorldId: null` |
| LIN-ID-3 | MUST | Next seals MUST use the branch's current `tip` as `parentWorldId` |
| LIN-ID-4 | MUST NOT | `worldId` MUST NOT be computed from `schemaHash + snapshotHash` alone |
| LIN-ID-5 | MUST NOT | `worldId` MUST NOT use string concatenation |

### 6.2 TerminalStatus Derivation

Lineage derives terminal status from snapshot content. It never accepts caller-provided terminal status.

```typescript
function deriveTerminalStatus(snapshot: Snapshot): TerminalStatus {
  if (snapshot.system.pendingRequirements.length > 0) return "failed";
  if (snapshot.system.lastError != null) return "failed";
  return "completed";
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-TERM-1 | MUST | `terminalStatus` MUST be derived internally from `Snapshot` |
| LIN-TERM-2 | MUST | Any pending requirements make the terminal status `failed` |
| LIN-TERM-3 | MUST | Any non-null `lastError` makes the terminal status `failed` |
| LIN-TERM-4 | MUST | Only snapshots with no pending requirements and `lastError === null` derive `completed` |
| LIN-HASH-TERM-5 | MUST | The hash-visible terminal status MUST be exactly `"completed"` or `"failed"` |

### 6.3 SnapshotHash Computation

#### 6.3.1 Hash Input Structure

```typescript
type SnapshotHashInput = {
  readonly data: Record<string, unknown>;
  readonly system: {
    readonly terminalStatus: TerminalStatus;
    readonly currentError: CurrentErrorSignature;
    readonly pendingDigest: string;
  };
};
```

#### 6.3.2 PendingDigest Computation

```typescript
function computePendingDigest(pending: readonly Requirement[]): string {
  if (pending.length === 0) return "empty";
  const sortedIds = pending.map((requirement) => requirement.id).sort();
  return computeHash({ pendingIds: sortedIds });
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-HASH-PENDING-1 | MUST | `pendingDigest` MUST use `computeHash()` over sorted requirement ids |
| LIN-HASH-PENDING-2 | MUST NOT | `pendingDigest` MUST NOT use string concatenation or join as the canonical identity form |

#### 6.3.3 Inclusion and Exclusion Rules

| Field | Included | Rule ID |
|-------|----------|---------|
| `snapshot.data` excluding `$*` | MUST | LIN-HASH-1 |
| `system.terminalStatus` | MUST | LIN-HASH-2 |
| `system.currentError` | MUST | LIN-HASH-3a |
| `system.pendingDigest` | MUST | LIN-HASH-11 |
| Raw `system.status` | MUST NOT | LIN-HASH-2a |
| `system.currentAction` | MUST NOT | LIN-HASH-4 |
| `data.$host.*` | MUST NOT | LIN-HASH-4a |
| `data.$mel.*` | MUST NOT | LIN-HASH-4b |
| Future `data.$*` | MUST NOT | LIN-HASH-4c |
| `meta.version` | MUST NOT | LIN-HASH-5 |
| `meta.timestamp` | MUST NOT | LIN-HASH-6 |
| `meta.randomSeed` | MUST NOT | LIN-HASH-7 |
| `meta.schemaHash` | MUST NOT | LIN-HASH-8 |
| `computed` | SHOULD NOT | LIN-HASH-9 |
| `input` | MUST NOT | LIN-HASH-10 |

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-HASH-1 | MUST | `snapshot.data` MUST be included after stripping `$`-prefixed platform namespaces |
| LIN-HASH-2 | MUST | `snapshotHash` MUST include normalized terminal status |
| LIN-HASH-2a | MUST NOT | `snapshotHash` MUST NOT include raw `system.status` |
| LIN-HASH-3a | MUST | `snapshotHash` MUST include `currentError`, normalized from `snapshot.system.lastError` |
| LIN-HASH-3b | MUST | `currentError` MUST be `CurrentErrorSignature | null` |
| LIN-HASH-3c | MUST | `CurrentErrorSignature` MUST include only `code` and `source` |
| LIN-HASH-3d | MUST NOT | `message`, `timestamp`, and `context` MUST NOT be included in hash identity |
| LIN-HASH-4 | MUST NOT | `system.currentAction` MUST NOT be included |
| LIN-HASH-4a | MUST NOT | `data.$host` MUST NOT be included |
| LIN-HASH-4b | MUST NOT | `data.$mel` MUST NOT be included |
| LIN-HASH-4c | MUST NOT | Future `data.$*` namespaces MUST NOT be included |
| LIN-HASH-5 | MUST NOT | `meta.version` MUST NOT be included |
| LIN-HASH-6 | MUST NOT | `meta.timestamp` MUST NOT be included |
| LIN-HASH-7 | MUST NOT | `meta.randomSeed` MUST NOT be included |
| LIN-HASH-8 | MUST NOT | `meta.schemaHash` MUST NOT be included because it already participates in `worldId` |
| LIN-HASH-9 | SHOULD NOT | `computed` SHOULD NOT be included because it is re-derivable |
| LIN-HASH-10 | MUST NOT | `input` MUST NOT be included |
| LIN-HASH-11 | MUST | `pendingDigest` MUST be included |

### 6.4 Current Error Projection

`CurrentErrorSignature` captures only the deterministic identity of the current error.

```typescript
function toCurrentErrorSignature(
  lastError: ErrorValue | null
): CurrentErrorSignature {
  if (lastError == null) {
    return null;
  }

  return {
    code: lastError.code,
    source: {
      actionId: lastError.source.actionId,
      nodePath: lastError.source.nodePath,
    },
  };
}
```

Two snapshots with the same domain state but different `lastError.code` or `lastError.source` MUST produce different `snapshotHash` values. Two snapshots with the same final `lastError` and different intermediate error histories MUST produce the same `snapshotHash`.

### 6.5 Hash Algorithm

```typescript
function computeHash(input: unknown): string {
  const canonicalJson = JCS(input);
  const utf8Bytes = new TextEncoder().encode(canonicalJson);
  const hashBytes = SHA256(utf8Bytes);
  return Array.from(hashBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-ENC-1 | MUST | SHA-256 input MUST be the UTF-8 bytes of JCS output |
| LIN-ENC-2 | MUST | Hash output MUST be lower-case hexadecimal |
| LIN-JSON-1 | MUST | Hash input MUST be JSON-serializable |
| LIN-SCHEMA-1 | MUST | `schemaHash` passed to Lineage MUST equal `snapshot.meta.schemaHash` |

### 6.6 World Creation Algorithm

World creation is pure and depends only on explicit inputs.

```typescript
function createWorldRecord(
  schemaHash: string,
  terminalSnapshot: Snapshot,
  parentWorldId: WorldId | null
): { world: World; hashInput: SnapshotHashInput; worldId: WorldId } {
  const terminalStatus = deriveTerminalStatus(terminalSnapshot);
  const currentError = toCurrentErrorSignature(terminalSnapshot.system.lastError);
  const pendingDigest = computePendingDigest(terminalSnapshot.system.pendingRequirements);

  const hashInput: SnapshotHashInput = {
    data: stripPlatformNamespaces(terminalSnapshot.data as Record<string, unknown>),
    system: {
      terminalStatus,
      currentError,
      pendingDigest,
    },
  };

  const snapshotHash = computeHash(hashInput);
  const worldId = computeHash({ schemaHash, snapshotHash, parentWorldId });

  return {
    worldId,
    hashInput,
    world: {
      worldId,
      schemaHash,
      snapshotHash,
      parentWorldId,
      terminalStatus,
    },
  };
}
```

---

## 7. Seal Protocol

### 7.1 Seal Inputs

```typescript
type SealGenesisInput = {
  readonly schemaHash: SchemaHash;
  readonly terminalSnapshot: Snapshot;
  readonly createdAt: number;
  readonly branchName?: string;
  readonly proposalRef?: ProvenanceRef;
  readonly traceRef?: ArtifactRef;
};

type SealNextInput = {
  readonly schemaHash: SchemaHash;
  readonly baseWorldId: WorldId;
  readonly branchId: BranchId;
  readonly terminalSnapshot: Snapshot;
  readonly createdAt: number;
  readonly patchDelta?: PersistedPatchDeltaV2;
  readonly proposalRef?: ProvenanceRef;
  readonly decisionRef?: ProvenanceRef;
  readonly traceRef?: ArtifactRef;
};
```

`SealNextInput` is externally unchanged from v1.x. `parentWorldId` is derived during prepare from the target branch's `tip`.

`baseWorldId` and `parentWorldId` are different concepts:

- `baseWorldId` = computation predecessor (`head` at execution time)
- `parentWorldId` = lineage predecessor (`tip` at seal time)

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-SEAL-PURE-1 | MUST | `prepareSealGenesis()` and `prepareSealNext()` are read-only preparations: they MAY read the store but MUST NOT mutate it, MUST NOT call `Date.now()`, and MUST NOT generate random values |
| LIN-BRANCH-SEAL-1 | MUST | `prepareSealNext()` MUST require `branchId` |
| LIN-BRANCH-SEAL-2 | MUST | The target branch's current `head` MUST equal `baseWorldId` |
| LIN-BRANCH-SEAL-3 | MUST | `prepareSealGenesis()` MUST return a `PreparedGenesisCommit` with bootstrap branch state |
| LIN-BRANCH-SEAL-4 | MUST | A next seal MUST mutate only the branch identified by `branchId` |

### 7.2 PreparedLineageCommit

```typescript
type PreparedBranchMutation = {
  readonly kind: "advance";
  readonly branchId: BranchId;
  readonly expectedHead: WorldId;
  readonly nextHead: WorldId;
  readonly headAdvanced: boolean;
  readonly expectedTip: WorldId;
  readonly nextTip: WorldId;
  readonly headAdvancedAt: number | null; // updated atomically with the CAS-guarded branch mutation
  readonly expectedEpoch: number;
  readonly nextEpoch: number;
};

type PreparedBranchBootstrap = {
  readonly kind: "bootstrap";
  readonly branch: PersistedBranchEntry;
  readonly activeBranchId: BranchId;
};

type PreparedLineageRecords = {
  readonly worldId: WorldId;
  readonly world: World;
  readonly terminalSnapshot: Snapshot;
  readonly hashInput: SnapshotHashInput;
  readonly attempt: SealAttempt;
};

type PreparedGenesisCommit = PreparedLineageRecords & {
  readonly kind: "genesis";
  readonly branchId: BranchId;
  readonly terminalStatus: "completed";
  readonly edge: null;
  readonly branchChange: PreparedBranchBootstrap;
};

type PreparedNextCommit = PreparedLineageRecords & {
  readonly kind: "next";
  readonly branchId: BranchId;
  readonly terminalStatus: TerminalStatus;
  readonly edge: WorldEdge;
  readonly branchChange: PreparedBranchMutation;
};

type PreparedLineageCommit = PreparedGenesisCommit | PreparedNextCommit;
```

`PreparedLineageCommit` always contains the full deterministic write set for a new commit. If commit-time idempotent reuse is detected, World/Edge/snapshot writes are skipped, but the prepared shape remains valid and truthful.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-SEAL-4 | MUST | Prepare methods MUST NOT mutate the store |
| LIN-SEAL-5 | MUST | `LineageService.commitPrepared()` MUST delegate to `LineageStore.commitPrepared()` for lineage-only atomic persistence |
| LIN-SEAL-6 | MUST NOT | Lineage MUST NOT provide a combined prepare+commit API |

### 7.3 LineageService Interface

```typescript
interface LineageService {
  prepareSealGenesis(input: SealGenesisInput): Promise<PreparedGenesisCommit>;
  prepareSealNext(input: SealNextInput): Promise<PreparedNextCommit>;
  commitPrepared(prepared: PreparedLineageCommit): Promise<void>;

  createBranch(name: string, headWorldId: WorldId): Promise<BranchId>;
  getBranch(branchId: BranchId): Promise<BranchInfo | null>;
  getBranches(): Promise<readonly BranchInfo[]>;
  getActiveBranch(): Promise<BranchInfo>;
  switchActiveBranch(targetBranchId: BranchId): Promise<BranchSwitchResult>;

  getWorld(worldId: WorldId): Promise<World | null>;
  getSnapshot(worldId: WorldId): Promise<Snapshot | null>;
  getAttempts(worldId: WorldId): Promise<readonly SealAttempt[]>;
  getAttemptsByBranch(branchId: BranchId): Promise<readonly SealAttempt[]>;
  getLineage(): Promise<WorldLineage>;
  getHeads(): Promise<readonly WorldHead[]>;
  getLatestHead(): Promise<WorldHead | null>;
  restore(worldId: WorldId): Promise<Snapshot>;
}
```

`getSnapshot(worldId)` returns the stored persistence substrate. `restore(worldId)` returns the resume-ready normalized snapshot.

### 7.4 traceRef Policy

`traceRef` is attempt-scoped.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-TRACE-1 | MUST NOT | `traceRef` MUST NOT participate in `snapshotHash` or `worldId` computation |
| LIN-TRACE-2 | MUST | `traceRef`, when present, MUST be stored on `SealAttempt` only |

---

## 8. Idempotent Reuse Policy

Positional identity eliminates content-only collision handling as a rejection path.

### 8.1 Eliminated Cases

- **Self-loop** is structurally eliminated because `worldId = hash(schemaHash, snapshotHash, parentWorldId)` cannot equal `parentWorldId` except via a hash fixed point.
- **Different-parent diamond convergence** is structurally eliminated because different `parentWorldId` values produce different `worldId` values even when `snapshotHash` matches.

### 8.2 Residual Same-Parent Same-Snapshot Case

When two seals share the same `parentWorldId` and the same `snapshotHash`, they represent the same commit identity.

This is not a rejection. It is idempotent reuse.

At commit time:

1. the existing World is reused
2. the existing WorldEdge is reused
3. the stored snapshot is not overwritten
4. a new `SealAttempt` is still persisted
5. branch CAS still applies
6. the seal succeeds

| Rule ID | Level | Description |
|---------|-------|-------------|
| MRKL-REUSE-1 | MUST | Same `worldId` with matching `parentWorldId` MUST commit successfully via idempotent reuse rather than rejection |
| MRKL-REUSE-2 | MUST | Idempotent reuse MUST still persist a new `SealAttempt` |
| MRKL-REUSE-3 | MUST | Idempotent reuse MUST still CAS-verify `(expectedHead, expectedTip, expectedEpoch)` |

### 8.3 Rule Disposition

| Rule ID | Disposition |
|---------|-------------|
| LIN-COLLISION-1 | Eliminated - replaced by positional identity + idempotent reuse |
| LIN-COLLISION-2 | Eliminated - self-loop structurally impossible |
| LIN-COLLISION-3 | Eliminated at World level - genesis bootstrap uniqueness remains in LIN-GENESIS-3 |
| LIN-COLLISION-4 | Eliminated - no rejection payload required |
| LIN-STORE-9 | Reframed - reuse detection + attempt persistence + snapshot first-write-wins safety |
| LIN-EDGE-2 | Eliminated - edge chronology moved to `SealAttempt` |
| LIN-HEAD-7 | Superseded - `WorldHead.createdAt` comes from `BranchInfo.headAdvancedAt` |

### 8.4 No-Op Semantics

Under positional identity, a no-op seal is valid.

| Rule ID | Level | Description |
|---------|-------|-------------|
| MRKL-NOOP-1 | MUST | No-op seals MUST be accepted. Same content with a different `parentWorldId` produces a distinct World naturally |

---

## 9. BaseWorld Admissibility

`baseWorldId` remains the computation predecessor and is validated against the branch `head`, not the branch `tip`.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-BASE-1 | MUST | `baseWorldId` MUST exist in the store |
| LIN-BASE-2 | MUST | The base snapshot MUST have no pending requirements |
| LIN-BASE-3 | MUST | Failed Worlds MUST NOT be used as `baseWorldId` |
| LIN-BASE-4 | MUST | `baseWorldId.schemaHash` MUST match the seal input's `schemaHash` |

`baseWorldId` and `parentWorldId` MUST NOT be conflated. A failed seal advances `tip` without advancing `head`; subsequent seals still compute from `head` while inheriting lineage position from `tip`.

---

## 10. Branch Model

### 10.1 Branch Types

```typescript
type BranchInfo = {
  readonly id: BranchId;
  readonly name: string;
  readonly head: WorldId;
  readonly tip: WorldId;
  readonly headAdvancedAt: number;
  readonly epoch: number;
  readonly schemaHash: SchemaHash;
  readonly createdAt: number;
};

type PersistedBranchEntry = {
  readonly id: BranchId;
  readonly name: string;
  readonly head: WorldId;
  readonly tip: WorldId;
  readonly headAdvancedAt: number;
  readonly epoch: number;
  readonly schemaHash: SchemaHash;
  readonly createdAt: number;
};

type PersistedBranchState = {
  readonly branches: readonly PersistedBranchEntry[];
  readonly activeBranchId: BranchId;
};
```

`head` and `tip` have different meanings:

| Pointer | Advances on | Purpose |
|---------|-------------|---------|
| `head` | Completed seals only | Base snapshot for the next computation |
| `tip` | Every seal | Parent position for the next `worldId` computation |

#### 10.1.1 BranchId Generation Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-BRANCH-ID-1 | MUST | Genesis `branchId` MUST be `computeHash({ kind: "genesis-branch", branchName, worldId })` |
| LIN-BRANCH-ID-2 | MAY | `createBranch()` MAY use any unique implementation-defined id strategy because it is outside prepare reproducibility |

#### 10.1.2 Genesis Bootstrap Field Rules

| Field | Derivation | Rule ID |
|-------|------------|---------|
| `id` | `computeHash({ kind: "genesis-branch", branchName, worldId })` | LIN-BOOTSTRAP-1 |
| `name` | `branchName ?? "main"` | LIN-BOOTSTRAP-2 |
| `head` | genesis `worldId` | LIN-BOOTSTRAP-3 |
| `tip` | genesis `worldId` | LIN-BOOTSTRAP-4 |
| `headAdvancedAt` | genesis seal `createdAt` | LIN-BOOTSTRAP-5 |
| `epoch` | `0` | LIN-BOOTSTRAP-6 |
| `schemaHash` | seal input `schemaHash` | LIN-BOOTSTRAP-7 |
| `createdAt` | seal input `createdAt` | LIN-BOOTSTRAP-8 |

### 10.2 Head Semantics

```typescript
type WorldHead = {
  readonly worldId: WorldId;
  readonly branchId: BranchId;
  readonly branchName: string;
  readonly createdAt: number;
  readonly schemaHash: string;
};
```

`WorldHead.createdAt` is branch-local. It answers "when did this branch's head pointer last move?" not "when was the World object first created?"

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-HEAD-1 | MUST | A Head is a World referenced by `Branch.head` |
| LIN-HEAD-2 | MUST | `getHeads()` MUST return one entry per branch |
| LIN-HEAD-3 | MUST | Head Worlds MUST have `terminalStatus === "completed"` |
| LIN-HEAD-4 | MUST | `getLatestHead()` MUST return the head with the most recent `createdAt` |
| LIN-HEAD-5 | MUST | Tie-break is `worldId` ascending, then `branchId` ascending |
| LIN-HEAD-6 | MUST | Head queries MUST reflect current branch state |
| LIN-HEAD-8 | MUST | `WorldHead.schemaHash` MUST equal the branch's current `schemaHash` |
| MRKL-HEAD-1 | MUST | `BranchInfo` and `PersistedBranchEntry` MUST include `headAdvancedAt` |
| MRKL-HEAD-2 | MUST | Completed seals MUST set `headAdvancedAt` to the seal input's `createdAt` |
| MRKL-HEAD-3 | MUST | Failed seals MUST NOT change `headAdvancedAt` |
| MRKL-HEAD-4 | MUST | Genesis bootstrap MUST set `headAdvancedAt` to the genesis seal's `createdAt` |
| MRKL-HEAD-5 | MUST | `WorldHead.createdAt` MUST be sourced from `BranchInfo.headAdvancedAt` |
| MRKL-HEAD-6 | MUST | `headAdvancedAt` MUST be updated atomically in the same branch mutation guarded by CAS on `head`, `tip`, and `epoch` |

### 10.3 Head Advance Policy

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-HEAD-ADV-1 | MUST | Head advance MUST occur only for `terminalStatus === "completed"` |
| LIN-HEAD-ADV-2 | MUST | Failed Worlds MUST be persisted but MUST NOT advance `head` |
| LIN-HEAD-ADV-3 | MUST | Failed Worlds MUST remain queryable |
| LIN-HEAD-ADV-4 | MUST | Head advance MUST increment branch `epoch` |
| MRKL-TIP-1 | MUST | `tip` MUST advance on every successful seal |
| MRKL-TIP-2 | MUST | Failed seals MUST advance `tip` while keeping `head` unchanged |

### 10.4 Branch Switch

```typescript
type BranchSwitchResult = {
  readonly previousBranchId: BranchId;
  readonly targetBranchId: BranchId;
  readonly sourceBranchEpochAfter: number;
};
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-SWITCH-1 | MUST | `switchActiveBranch()` MUST atomically combine `activeBranchId` change with source-branch epoch increment |
| LIN-SWITCH-2 | MUST | Only the source branch's epoch increments |
| LIN-SWITCH-3 | MUST | Missing target branch MUST be rejected |
| LIN-SWITCH-4 | MUST | Result MUST include the incremented source epoch |
| LIN-SWITCH-5 | MUST | Self-switch MUST be rejected |

### 10.5 Genesis

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-GENESIS-1 | MUST | Genesis MUST only succeed when the terminal snapshot derives `completed` |
| LIN-GENESIS-2 | MUST | Genesis bootstrap MUST create the first branch, set `head = tip = worldId`, and set `activeBranchId` |
| LIN-GENESIS-3 | MUST | Genesis MUST be rejected when the store already has persisted branch state |

### 10.6 Branch Creation

`createBranch(name, headWorldId)` creates a new branch pointing to an existing completed World.

`createBranch()` is outside prepare reproducibility. Implementations MUST obtain one implementation-defined branch creation timestamp and use that same value for both `createdAt` and `headAdvancedAt` on the new branch entry.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-BRANCH-CREATE-1 | MUST | `headWorldId` MUST exist |
| LIN-BRANCH-CREATE-2 | MUST | `headWorldId` MUST be completed |
| LIN-BRANCH-CREATE-3 | MUST | The new branch's `tip` MUST equal its `head` at creation |
| LIN-BRANCH-CREATE-4 | MUST | The new branch's `schemaHash` MUST equal the adopted head World's `schemaHash` |
| LIN-BRANCH-CREATE-5 | MUST | Branch name uniqueness is not required; `BranchId` is the unique identifier |
| LIN-BRANCH-CREATE-6 | MUST NOT | `createBranch()` MUST NOT change `activeBranchId` |
| LIN-BRANCH-CREATE-7 | MUST | The new branch's `headAdvancedAt` MUST equal the branch creation timestamp |
| LIN-BRANCH-CREATE-8 | MUST | The new branch's `createdAt` MUST equal that same branch creation timestamp |

---

## 11. Persistence Model

### 11.1 Required Records

Lineage implementations MUST persist at minimum:

| Record | Key | Description |
|--------|-----|-------------|
| Worlds | `WorldId` | Immutable commit records |
| TerminalSnapshots | `WorldId` | Stored terminal snapshot substrate |
| WorldEdges | `edgeId` | DAG edges |
| SealAttempts | `attemptId` | Per-seal chronology, provenance, trace, delta |
| BranchState | `BranchId` | Branch entries + `activeBranchId` |

RECOMMENDED additional records:

| Record | Key | Description |
|--------|-----|-------------|
| SnapshotHashInputs | `snapshotHash` | Audit / replay verification |

### 11.2 LineageStore Interface

```typescript
interface LineageStore {
  putWorld(world: World): Promise<void>;
  getWorld(worldId: WorldId): Promise<World | null>;

  putSnapshot(worldId: WorldId, snapshot: Snapshot): Promise<void>;
  getSnapshot(worldId: WorldId): Promise<Snapshot | null>;

  putAttempt(attempt: SealAttempt): Promise<void>;
  getAttempts(worldId: WorldId): Promise<readonly SealAttempt[]>;
  getAttemptsByBranch(branchId: BranchId): Promise<readonly SealAttempt[]>;

  putHashInput?(snapshotHash: string, input: SnapshotHashInput): Promise<void>;
  getHashInput?(snapshotHash: string): Promise<SnapshotHashInput | null>;

  putEdge(edge: WorldEdge): Promise<void>;
  getEdges(worldId: WorldId): Promise<readonly WorldEdge[]>;

  getBranchHead(branchId: BranchId): Promise<WorldId | null>;
  getBranchTip(branchId: BranchId): Promise<WorldId | null>;
  getBranchEpoch(branchId: BranchId): Promise<number>;
  mutateBranch(mutation: PreparedBranchMutation): Promise<void>;
  putBranch(branch: PersistedBranchEntry): Promise<void>;
  getBranches(): Promise<readonly PersistedBranchEntry[]>;
  getActiveBranchId(): Promise<BranchId | null>;
  switchActiveBranch(sourceBranchId: BranchId, targetBranchId: BranchId): Promise<void>;

  commitPrepared(prepared: PreparedLineageCommit): Promise<void>;
}
```

The projected v2 persistence surface is async by default so browser-first adapters such as IndexedDB and server-side adapters can share one contract.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-STORE-1 | MUST NOT | `LineageStore` MUST NOT reference governance-owned types |
| LIN-STORE-2 | MUST | `LineageStore` MUST be owned by `@manifesto-ai/lineage` |
| LIN-STORE-3 | MUST | Lineage MUST provide an in-memory store implementation |
| LIN-STORE-4 | MUST | `mutateBranch()` MUST jointly CAS-verify `(expectedHead, expectedTip, expectedEpoch)` |
| LIN-STORE-5 | MUST | `mutateBranch()` MUST affect only the specified branch |
| LIN-STORE-6 | MUST | `commitPrepared()` MUST atomically persist all required records and branch change |
| LIN-STORE-7 | MUST | `commitPrepared()` with `bootstrap` MUST enforce bootstrap uniqueness; with `advance` MUST enforce branch CAS |
| LIN-STORE-8 | MUST | `switchActiveBranch()` MUST atomically combine active-branch switch with source-branch epoch increment |
| LIN-STORE-9 | MUST | `commitPrepared()` MUST detect same-parent same-world reuse in the transaction, skip duplicate World/Edge/snapshot writes, persist `SealAttempt`, set `attempt.reused = true`, and still apply branch CAS |
| MRKL-STORE-1 | MUST | `LineageStore` MUST persist `SealAttempt` records |
| MRKL-STORE-2 | MUST | Every successful commit MUST persist exactly one `SealAttempt` |
| MRKL-STORE-3 | MUST | Reuse commits MUST skip duplicate World/Edge/snapshot writes |
| MRKL-STORE-4 | MUST | Reuse commits MUST preserve the first-written snapshot substrate |

### 11.3 Snapshot Storage Clarification

`snapshotHash` is not a storage key for full snapshots.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-PERSIST-SNAP-1 | MUST NOT | Full snapshots MUST NOT be keyed by `snapshotHash` |
| LIN-PERSIST-SNAP-2 | MUST | Full terminal snapshots MUST be keyed by `worldId` |
| LIN-PERSIST-SNAP-3 | SHOULD | `SnapshotHashInput` SHOULD be stored by `snapshotHash` |
| LIN-PERSIST-SNAP-4 | SHOULD | Audit and replay verification SHOULD use stored `SnapshotHashInput` when available |
| MRKL-RESTORE-5 | MUST NOT | Reuse commits MUST NOT overwrite the stored snapshot for an existing `worldId` |

### 11.4 Snapshot Query vs Restore

`getSnapshot(worldId)` returns the stored substrate. `restore(worldId)` returns the normalized resume contract.

This distinction is normative:

- substrate storage is for persistence and audit
- restore is for runtime resume

### 11.5 Patch Delta Contract

Patch deltas are attempt-scoped.

| Rule ID | Level | Description |
|---------|-------|-------------|
| MRKL-DELTA-1 | MUST NOT | `patchDelta` MUST NOT participate in `snapshotHash` or `worldId` |
| MRKL-DELTA-2 | MUST | `patchDelta` MUST describe the transformation from `SealAttempt.baseWorldId`'s snapshot to the terminal snapshot |
| MRKL-DELTA-3 | MUST | `patchDelta` MUST be stored on `SealAttempt`, not on `World` |
| MRKL-DELTA-4 | MUST | Replay from patches MUST start from `SealAttempt.baseWorldId`, not `World.parentWorldId` |

---

## 12. DAG Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-DAG-1 | MUST | Every non-genesis World MUST have exactly one `parentWorldId` |
| LIN-DAG-2 | MUST | Lineage MUST remain acyclic |
| LIN-DAG-3 | MUST | Lineage is append-only |
| LIN-DAG-4 | MAY | A parent MAY have multiple children |

Genesis is the unique World with `parentWorldId === null`.

---

## 13. Replay Support

Replay and audit operate on commit identity plus attempt chronology.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-REPLAY-1 | SHOULD | Implementations SHOULD expose enough data to replay from `baseWorldId + patchDelta` when deltas are present |
| LIN-REPLAY-2 | MUST | Audit verification MUST use the stored `SnapshotHashInput` and `SealAttempt` when available |
| LIN-REPLAY-3 | MUST | Same `schemaHash`, same `snapshotHash`, and same `parentWorldId` MUST reproduce the same `worldId` |

---

## 14. Resume Semantics

Resume reconstructs runtime state from persisted lineage after restart.

```
Restart Flow:
  App.ready()
    -> load persisted branch state
    -> choose active branch head
    -> snapshot = lineage.restore(activeBranch.head)
    -> initialize runtime from normalized snapshot
```

`restore(worldId)` MUST normalize non-hash fields before returning.

### 14.1 Restore Normalization

| Field | Restore Behavior |
|-------|------------------|
| Domain `data` (non-`$`) | Preserve |
| `data.$host` | Reset to `{}` |
| `data.$mel` | Reset to `{ guards: { intent: {} } }` |
| Future `data.$*` roots present in the stored snapshot | Reset to `{}` |
| `computed` | Preserve |
| `system.status` | Preserve |
| `system.lastError` | Preserve |
| `system.pendingRequirements` | Preserve |
| `system.currentAction` | Reset to `null` |
| `input` | Reset to `null` |
| `meta.version` | Preserve |
| `meta.schemaHash` | Preserve |
| `meta.timestamp` | Reset to `0` |
| `meta.randomSeed` | Reset to `""` |

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-RESUME-1 | MUST | Lineage MUST support head-based resume after initialization |
| LIN-RESUME-2 | MUST | A head's snapshot MUST be restorable via `restore()` |
| LIN-RESUME-3 | MUST | Resume MUST NOT create new Worlds |
| LIN-RESUME-4 | SHOULD | Default resume SHOULD use the active branch's head |
| LIN-RESUME-5 | MAY | Callers MAY choose alternative restore strategies |
| LIN-RESUME-6 | MUST | Schema mismatch on resume MUST be detected and handled by the caller |
| MRKL-RESTORE-1 | MUST | `restore()` MUST reset platform namespaces to clean defaults: `data.$host = {}`, `data.$mel = { guards: { intent: {} } }`, and any other stored `data.$*` root to `{}` |
| MRKL-RESTORE-2 | MUST | `restore()` MUST reset `input` to `null` |
| MRKL-RESTORE-3 | MUST | `restore()` MUST reset `meta.timestamp` to `0` and `meta.randomSeed` to `""` |
| MRKL-RESTORE-3a | MUST | `restore()` MUST reset `system.currentAction` to `null` |
| MRKL-RESTORE-4 | MUST | `restore()` MUST preserve domain `data`, `computed`, `system.status`, `system.lastError`, `system.pendingRequirements`, `meta.version`, and `meta.schemaHash` |

### 14.2 Schema Migration on Resume

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-RESUME-SCHEMA-1 | MUST | Schema mismatch between persisted branch state and current schema MUST be detected |
| LIN-RESUME-SCHEMA-2 | MUST | Schema mismatch MUST NOT be silently ignored |
| LIN-RESUME-SCHEMA-3 | MUST | On mismatch, callers MUST either migrate explicitly or start a new epoch/genesis |

---

## 15. Epoch Semantics

Epoch is a monotonically increasing branch-local staleness detector.

| Trigger | Mechanism |
|---------|-----------|
| Head advance | Completed seal increments epoch |
| Branch switch | Source branch epoch increments |

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-EPOCH-1 | MUST | Epoch MUST be stored per branch |
| LIN-EPOCH-2 | MUST | Head advance MUST increment epoch |
| LIN-EPOCH-3 | MUST | Branch switch MUST increment the source branch epoch |
| LIN-EPOCH-4 | MUST NOT | Branch switch MUST NOT change the target branch epoch |
| LIN-EPOCH-5 | MUST | `head`, `tip`, and `epoch` MUST be CAS-verified together, and `headAdvancedAt` MUST be updated atomically in the same branch mutation |
| LIN-EPOCH-6 | MUST | Epoch MUST be readable through the Lineage public contract |

---

## 16. Invariants

### 16.1 World Invariants

| ID | Invariant |
|----|-----------|
| INV-L1 | Worlds are immutable after creation |
| INV-L2 | `worldId` is deterministic from `(schemaHash, snapshotHash, parentWorldId)` |
| INV-L3 | Lineage is acyclic |
| INV-L4 | Lineage is append-only |
| INV-L5 | Every non-genesis World has exactly one parent |
| INV-L6 | `snapshotHash` excludes non-deterministic fields |
| INV-L7 | Error identity in `snapshotHash` uses `CurrentErrorSignature`, not history |
| INV-L8 | `snapshotHash` includes `pendingDigest` |
| INV-L9 | `snapshotHash` uses normalized `terminalStatus` |
| INV-L10 | There is no error-array sort pass in current hash identity |
| INV-L11 | `world.schemaHash` equals `snapshot.meta.schemaHash` |
| INV-L12 | Hash input is JSON-serializable |
| INV-L13 | `CurrentErrorSignature` excludes `message`, `timestamp`, and `context` |
| INV-L14 | Error state uses `lastError`, and `snapshot.system.errors` is not part of the contract |
| INV-L15 | Head is pointer semantics, not graph-leaf semantics |
| INV-L16 | All heads have terminal status `completed` |
| INV-L17 | `getLatestHead()` returns a restorable head |
| INV-L18 | Resume is read-only |

### 16.2 Hash Invariants

| ID | Invariant |
|----|-----------|
| INV-L19 | SHA-256 input is UTF-8 bytes of JCS output |
| INV-L20 | Hash output is lower-case hexadecimal |
| INV-L21 | Hash input contains only JSON-serializable values |

### 16.3 Branch and Epoch Invariants

| ID | Invariant |
|----|-----------|
| INV-L22 | `head`, `tip`, and `epoch` are the branch CAS compare-set; `headAdvancedAt` is updated atomically in the same mutation |
| INV-L23 | Epoch is monotonically non-decreasing per branch |
| INV-L24 | Head advance increments epoch |
| INV-L25 | `tip` advances on every seal |
| INV-L26 | `head` advances only on completed seals |

### 16.4 Seal and Restore Invariants

| ID | Invariant |
|----|-----------|
| INV-L27 | `terminalStatus` is derived from snapshot, never caller-provided |
| INV-L28 | Same-parent same-snapshot is idempotent reuse, not rejection |
| INV-L29 | Every field in `PreparedLineageCommit` is deterministic from seal input + store state |
| INV-L30 | Every successful seal produces exactly one `SealAttempt` |
| INV-L31 | Stored snapshots are first-write-wins under reuse |
| INV-L32 | `restore()` normalizes non-hash fields before returning |

---

## 17. Compliance

### 17.1 Compliance Requirements

An implementation claiming compliance with **Manifesto Lineage Protocol v2.0.0** MUST:

1. Implement all public types defined in this document.
2. Compute `snapshotHash` using current-error identity (`CurrentErrorSignature`) rather than error history.
3. Compute `worldId` as `hash(schemaHash, snapshotHash, parentWorldId)`.
4. Derive `terminalStatus` internally from snapshot content.
5. Enforce prepare read-only semantics.
6. Enforce prepare/commit separation.
7. Enforce base-world admissibility rules.
8. Enforce branch CAS on `(head, tip, epoch)` and update `headAdvancedAt` atomically in the same branch mutation.
9. Persist `SealAttempt` for every successful seal.
10. Treat same-parent same-snapshot as idempotent reuse, not rejection.
11. Preserve first-written snapshot substrate on reuse.
12. Apply restore normalization before returning from `restore()`.
13. Not import governance-owned types or emit governance-owned events.

### 17.2 Compliance Verification

| Test Category | Description |
|---------------|-------------|
| Hash stability | Non-deterministic fields do not affect `snapshotHash` |
| Current error identity | Different `lastError.code` or `source` yields different `snapshotHash`; identical current error with different history yields the same `snapshotHash` |
| Positional world identity | Same content + different parent yields different `worldId` |
| Genesis determinism | Same genesis input yields the same genesis `worldId` and bootstrap branch |
| Prepare contract | Prepare does not mutate the store and performs no wall-clock I/O |
| Repeated identical failures | Same branch repeated failures produce distinct Worlds because `tip` changes |
| Idempotent reuse | Same parent + same snapshot across branches reuses World/Edge and persists distinct `SealAttempt` records |
| Head/tip semantics | Failed seal advances `tip` only; completed seal advances `head`, `tip`, `headAdvancedAt`, and `epoch` |
| Latest head selection | `getLatestHead()` uses `headAdvancedAt` |
| Base validation | Missing base, failed base, pending requirements, or schema mismatch are rejected |
| Atomic commit | Crash or CAS failure yields all-or-nothing persistence |
| Restore normalization | `$host`, `$mel`, `input`, `system.currentAction`, `meta.timestamp`, and `meta.randomSeed` are reset; semantic fields are preserved |
| Attempt queries | `getAttempts(worldId)` and `getAttemptsByBranch(branchId)` return complete attempt chronology |
