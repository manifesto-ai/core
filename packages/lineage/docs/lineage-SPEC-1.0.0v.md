# Manifesto Lineage Protocol Specification

> **Status:** Normative (Living Document)
> **Version:** v1.0.0
> **Package:** `@manifesto-ai/lineage`
> **Scope:** All Manifesto Lineage Implementations
> **Compatible with:** Core SPEC v3.0.0, ADR-014 (Split World Protocol)
> **Extracted from:** World SPEC v2.0.5 (§5.2–5.5, §7.3, §7.5, §7.8–7.9, §9, §10.3–10.4)
> **Authors:** Manifesto Team
> **License:** MIT

---

## Changelog

| Version | Summary | Key Decisions |
|---------|---------|---------------|
| v1.0.0 | Initial release — extracted from World SPEC v2.0.5 per ADR-014 | ADR-014 D2, D4, D5, D6 |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Normative Language](#2-normative-language)
3. [Scope & Non-Goals](#3-scope--non-goals)
4. [Boundary](#4-boundary)
5. [Core Types & Identity](#5-core-types--identity)
6. [Identity Computation](#6-identity-computation)
7. [Seal Protocol](#7-seal-protocol)
8. [WorldId Collision Policy](#8-worldid-collision-policy)
9. [BaseWorld Admissibility](#9-baseworld-admissibility)
10. [Branch Model](#10-branch-model)
11. [Persistence Model](#11-persistence-model)
12. [DAG Rules](#12-dag-rules)
13. [Replay Support](#13-replay-support)
14. [Resume Semantics](#14-resume-semantics)
15. [Epoch Semantics](#15-epoch-semantics)
16. [Invariants](#16-invariants)
17. [Compliance](#17-compliance)
- [Appendix A: Rule Retagging Mapping](#appendix-a-rule-retagging-mapping)
- [Appendix B: Rule Summary](#appendix-b-rule-summary)

---

## 1. Purpose

This document defines the **Manifesto Lineage Protocol** — the **Continuity Engine** of the Manifesto architecture.

Lineage governs:
- **How** worlds are identified (deterministic hash-based identity)
- **How** worlds form a reproducible history (acyclic DAG, append-only)
- **How** worlds are stored, restored, and resumed (persistence, branch, head)
- **How** terminal snapshots become sealed, immutable World records (seal protocol)

Lineage **does not** govern:
- **Who** may propose or approve changes (Actor, Authority — see Governance SPEC)
- **How** proposals are judged (Proposal lifecycle — see Governance SPEC)
- **What** events are emitted for governance decisions (see Governance SPEC)

This protocol can be used **independently of governance**. A web application that needs snapshot history, resume, and deterministic identity — but not Actor/Authority/Proposal — can import `@manifesto-ai/lineage` alone.

This document is **normative**.

---

## 2. Normative Language

Key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are interpreted as described in RFC 2119.

---

## 3. Scope & Non-Goals

### 3.1 In Scope

| Area | Description |
|------|-------------|
| Deterministic World identity | WorldId = hash(schemaHash, snapshotHash) |
| TerminalStatus derivation | Lineage derives status from snapshot internally |
| Fork-only lineage DAG | Branching without merge |
| Branch model | Head semantics, head advance, branch switch, genesis |
| Seal protocol | Prepare/commit separation, PreparedLineageCommit |
| Persistence model | LineageStore, snapshot storage, patch deltas, crash recovery |
| Resume | Restore from persisted branch head |
| Replay support | History reconstruction from stored lineage |
| Platform namespace exclusion | `$`-prefixed keys excluded from hash |

### 3.2 Explicit Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Actor/Authority/Proposal lifecycle | Governance SPEC responsibility |
| Event system | Lineage does not emit events (SPLIT-EVT-1) |
| HostExecutor interface | Governance SPEC responsibility |
| Merge semantics | Fork-only in v1.0; merge is future extension |
| ExecutionKey policy | Governance SPEC responsibility |
| Multi-store reconciliation | Deferred to future ADR (ADR-014 §6) |
| Failed genesis | Deferred to future ADR (LIN-GENESIS-1) |

---

## 4. Boundary

### 4.1 Lineage's "Does NOT Know" Boundary

Per ADR-014 D2 and SPLIT-DEP-1:

> **Lineage is the lower substrate. It does not know governance.**

| Lineage Does NOT Know | Rule ID |
|-----------------------|---------|
| `@manifesto-ai/governance` package | LIN-BOUNDARY-1 |
| Proposal type, ProposalStatus, ProposalId (concrete) | LIN-BOUNDARY-2 |
| Actor, Authority, ActorAuthorityBinding | LIN-BOUNDARY-3 |
| DecisionRecord | LIN-BOUNDARY-4 |
| HostExecutor interface | LIN-BOUNDARY-5 |
| Governance events | LIN-BOUNDARY-6 |

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-BOUNDARY-1 | MUST NOT | Lineage package MUST NOT import from `@manifesto-ai/governance` |
| LIN-BOUNDARY-2 | MUST NOT | Lineage MUST NOT reference concrete governance types |
| LIN-BOUNDARY-3 | MUST NOT | Lineage MUST NOT interpret provenance references as governance concepts |
| LIN-BOUNDARY-4 | MUST NOT | Lineage MUST NOT emit events of any kind |

### 4.2 What Lineage Provides to Governance

Governance MAY import lineage (SPLIT-DEP-2). The public contract consists of:

| Export | Purpose |
|--------|---------|
| `LineageService` interface | Seal preparation, branch management, query |
| `LineageStore` interface | Persistence contract |
| `WorldId`, `BranchId`, `ProvenanceRef` types | Identity types |
| `World`, `WorldEdge`, `WorldLineage` types | Record types |
| `PreparedLineageCommit` (discriminated union) | Seal result for atomic commit |
| `deriveTerminalStatus()` | TerminalStatus derivation (pure function) |
| `SnapshotHashInput`, `ErrorSignature` types | Hash computation types |

---

## 5. Core Types & Identity

### 5.1 Identifier Types

```typescript
type WorldId = string;          // hash({ schemaHash, snapshotHash })
type BranchId = string;         // unique branch identifier
type SchemaHash = string;       // hash of domain schema definition
type ProvenanceRef = string;    // opaque — governance interprets the meaning
type ArtifactRef = {
  readonly uri: string;
  readonly hash: string;
};
```

**`ProvenanceRef` is intentionally opaque.** Lineage stores `proposalRef` and `decisionRef` as plain strings. It does not import `ProposalId` or `DecisionId` from governance. This structurally prevents circular dependency (ADR-014 D5).

### 5.2 World

A **World** is an immutable record representing a sealed snapshot of reality.

```typescript
type TerminalStatus = 'completed' | 'failed';

type World = {
  readonly worldId: WorldId;

  // Domain schema identity
  readonly schemaHash: string;

  // Hash of terminal snapshot content (deterministic subset)
  readonly snapshotHash: string;

  // Terminal status — derived from snapshot by lineage (LIN-SEAL-1)
  readonly terminalStatus: TerminalStatus;

  // Metadata (not part of identity)
  readonly createdAt: number;

  // Provenance — opaque references, governance interprets
  readonly createdBy: ProvenanceRef | null;  // null only for genesis

  // Optional audit artifacts — non-identity (LIN-TRACE-1)
  readonly executionTraceRef?: ArtifactRef;
};
```

**Differences from World SPEC v2.0.5:**
- `createdBy` is `ProvenanceRef | null`, not `ProposalId | null`.
- `terminalStatus` is a first-class field, derived internally by lineage.

### 5.3 WorldEdge

```typescript
type WorldEdge = {
  readonly edgeId: string;
  readonly from: WorldId;
  readonly to: WorldId;
  readonly proposalRef?: ProvenanceRef;   // opaque — governance interprets
  readonly decisionRef?: ProvenanceRef;   // opaque — governance interprets
  readonly createdAt: number;
};
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-EDGE-1 | MUST | `edgeId` MUST be computed as `computeHash({ from, to })` |
| LIN-EDGE-2 | MUST | `WorldEdge.createdAt` MUST equal the seal input's `createdAt` |

**LIN-EDGE-1 rationale.** An edge is uniquely identified by its parent-child pair. Since the DAG is single-parent (LIN-DAG-1), no two edges can share the same `(from, to)`. Deriving `edgeId` from these values makes it deterministic — same seal input and store state always produce the same edge record.

**Differences from World SPEC v2.0.5:**
- `proposalId: ProposalId` → `proposalRef?: ProvenanceRef` (optional, opaque).
- `decisionId: DecisionId` → `decisionRef?: ProvenanceRef` (optional, opaque).
- Both are optional because governance-free environments produce edges without proposals.
- `edgeId` generation is now normatively fixed (was implementation-defined).

### 5.4 WorldLineage

```typescript
type WorldLineage = {
  readonly genesis: WorldId;
  readonly worlds: ReadonlyMap<WorldId, World>;
  readonly edges: ReadonlyMap<string, WorldEdge>;
};
```

### 5.5 Snapshot Type Dependency (Normative)

`Snapshot` refers to the **Manifesto Core Snapshot** shape. Lineage MUST import Core's canonical types, not redefine them.

```typescript
// Lineage imports from Core (NOT redefined here)
import type { Snapshot, ErrorValue } from '@manifesto-ai/core';
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-SNAP-1 | MUST | Lineage MUST import Snapshot types from Core (not redefine) |
| LIN-SNAP-2 | MUST NOT | Lineage MUST NOT assume specific `system.status` values (Core-owned vocabulary) |
| LIN-SNAP-3 | MUST | Lineage determines terminal state via `lastError` and `pendingRequirements` |
| LIN-SNAP-4 | MUST | `system.errors` is HISTORY (accumulated); `system.lastError` is CURRENT state |

### 5.6 Platform Namespace Policy

Platform components store internal state in reserved namespaces within `snapshot.data`. These namespaces are excluded from hash computation to ensure semantic equivalence.

| Namespace | Owner | Purpose | Hash Inclusion |
|-----------|-------|---------|----------------|
| `$host` | Host | Error bookkeeping, intent slots, execution context | ❌ Excluded |
| `$mel` | Compiler | Guard state, compiler-generated internal slots | ❌ Excluded |
| `$*` (future) | Platform | Reserved for future platform components | ❌ Excluded |

All `$`-prefixed keys in `snapshot.data` are platform-reserved.

```typescript
const PLATFORM_NAMESPACE_PREFIX = "$";

function isPlatformNamespace(key: string): boolean {
  return key.startsWith(PLATFORM_NAMESPACE_PREFIX);
}

function stripPlatformNamespaces(
  data: Record<string, unknown>
): Record<string, unknown> {
  if (data === undefined || data === null) return {};
  const keys = Object.keys(data);
  if (!keys.some(isPlatformNamespace)) return data;

  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (!isPlatformNamespace(key)) {
      result[key] = data[key];
    }
  }
  return result;
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-NS-1 | MUST | Lineage MUST exclude all `$`-prefixed keys from `snapshot.data` before hash computation |
| LIN-NS-2 | MUST NOT | Lineage MUST NOT interpret `data.$host` or `data.$mel` contents |
| LIN-NS-3 | MUST | Domain schemas MUST NOT use `$`-prefixed keys |

---

## 6. Identity Computation

### 6.1 WorldId Computation

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-ID-1 | MUST | WorldId MUST be computed as `computeHash({ schemaHash, snapshotHash })` |
| LIN-ID-2 | MUST | Hash function MUST use JCS (RFC 8785) + SHA-256 |
| LIN-ID-3 | MUST NOT | WorldId MUST NOT use string concatenation |

```typescript
// CORRECT: JCS-based object hash
worldId = computeHash({ schemaHash, snapshotHash });

// FORBIDDEN: String concatenation (ambiguous encoding)
// worldId = SHA256(`${schemaHash}:${snapshotHash}`);  // ❌
```

### 6.2 TerminalStatus Derivation

Lineage derives `terminalStatus` from the terminal snapshot internally. This is the most important boundary decision in the split: **the same snapshot must always produce the same terminalStatus, regardless of caller intent.**

```typescript
function deriveTerminalStatus(snapshot: Snapshot): TerminalStatus {
  // LIN-OUTCOME-1: pendingRequirements non-empty → failed
  if (snapshot.system.pendingRequirements.length > 0) {
    return 'failed';
  }
  // LIN-OUTCOME-2: lastError non-null → failed
  if (snapshot.system.lastError != null) {
    return 'failed';
  }
  // LIN-OUTCOME-3: otherwise → completed
  return 'completed';
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-SEAL-1 | MUST | Lineage MUST derive `terminalStatus` from `terminalSnapshot` internally |
| LIN-SEAL-2 | MUST | Derivation MUST use `lastError` and `pendingRequirements`, NOT raw `system.status` |
| LIN-SEAL-3 | MUST NOT | Lineage MUST NOT accept `terminalStatus` as caller-provided input |
| LIN-OUTCOME-1 | MUST | Non-empty `pendingRequirements` implies `terminalStatus: 'failed'` |
| LIN-OUTCOME-2 | MUST | `system.lastError != null` implies `terminalStatus: 'failed'` |
| LIN-OUTCOME-3 | MUST | Otherwise `terminalStatus: 'completed'` |
| LIN-OUTCOME-4 | MUST NOT | Lineage MUST NOT match specific `system.status` string values |
| LIN-OUTCOME-5 | MUST NOT | Lineage MUST NOT use `system.errors.length` for failure determination (it's history) |

**Why lineage must own this derivation.** `terminalStatus` is included in `snapshotHash` computation (INV-L9). If this value were caller-provided, the same snapshot could be sealed as `completed` by one caller and `failed` by another, producing different worldIds. WorldId determinism would depend on caller honesty, not on the snapshot's actual content. Lineage owning the derivation makes identity a function of content alone.

**Governance consistency.** Governance performs its own `deriveOutcome()` for proposal lifecycle purposes. The two derivations MUST agree. Disagreement is a bug, not a valid divergence. Governance SHOULD verify this by comparing its outcome with the `terminalStatus` in the returned `PreparedLineageCommit` (see Governance SPEC GOV-SEAL-1).

### 6.3 SnapshotHash Computation

#### 6.3.1 Hash Input Structure

```typescript
type SnapshotHashInput = {
  readonly data: Record<string, unknown>;  // platform namespaces stripped
  readonly system: {
    readonly terminalStatus: TerminalStatus;       // normalized, NOT raw status
    readonly errors: readonly ErrorSignature[];     // normalized + sorted
    readonly pendingDigest: string;                 // collision prevention
  };
};
```

#### 6.3.2 PendingDigest Computation

```typescript
function computePendingDigest(pending: readonly Requirement[]): string {
  if (pending.length === 0) return 'empty';
  const sortedIds = pending.map(r => r.id).sort();
  return computeHash({ pendingIds: sortedIds });
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-HASH-PENDING-1 | MUST | pendingDigest MUST use `computeHash()` (JCS-based) |
| LIN-HASH-PENDING-2 | MUST NOT | pendingDigest MUST NOT use string concatenation/join |

#### 6.3.3 Inclusion/Exclusion Rules

| Field | Included | Rule ID |
|-------|----------|---------|
| `snapshot.data` (excluding `$`-prefixed) | ✅ MUST | LIN-HASH-1 |
| `system.terminalStatus` (normalized) | ✅ MUST | LIN-HASH-2 |
| `system.errors` (full history, as ErrorSignature[]) | ✅ MUST | LIN-HASH-3 |
| `system.pendingDigest` | ✅ MUST | LIN-HASH-11 |
| Raw `system.status` | ❌ MUST NOT | LIN-HASH-2a |
| `system.currentAction` | ❌ MUST NOT | LIN-HASH-4 |
| `data.$host.*` | ❌ MUST NOT | LIN-HASH-4a |
| `data.$mel.*` | ❌ MUST NOT | LIN-HASH-4b |
| `meta.version` | ❌ MUST NOT | LIN-HASH-5 |
| `meta.timestamp` | ❌ MUST NOT | LIN-HASH-6 |
| `meta.randomSeed` | ❌ MUST NOT | LIN-HASH-7 |
| `meta.schemaHash` | ❌ MUST NOT | LIN-HASH-8 |
| `computed` | ❌ SHOULD NOT | LIN-HASH-9 |
| `input` | ❌ MUST NOT | LIN-HASH-10 |

**Rationale for `system.errors` (full history) inclusion:** Two executions reaching the same final `data` but encountering different errors represent different lineages. This supports auditability: "this World experienced errors X, Y, Z during execution" is part of its identity. Trade-off acknowledged: same `data` + different error history = different WorldId.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-HASH-1 | MUST | `snapshot.data` MUST be included, excluding `$`-prefixed namespaces |
| LIN-HASH-2 | MUST | snapshotHash MUST include `terminalStatus` (normalized) |
| LIN-HASH-2a | MUST NOT | snapshotHash MUST NOT include raw `system.status` |
| LIN-HASH-3 | MUST | snapshotHash MUST include full error history as `ErrorSignature[]` |
| LIN-HASH-4 | MUST NOT | `system.currentAction` MUST NOT be included |
| LIN-HASH-4a | MUST NOT | `data.$host` MUST NOT be included |
| LIN-HASH-4b | MUST NOT | `data.$mel` MUST NOT be included |
| LIN-HASH-5 | MUST NOT | `meta.version` MUST NOT be included |
| LIN-HASH-6 | MUST NOT | `meta.timestamp` MUST NOT be included |
| LIN-HASH-7 | MUST NOT | `meta.randomSeed` MUST NOT be included |
| LIN-HASH-8 | MUST NOT | `meta.schemaHash` MUST NOT be included (already in WorldId) |
| LIN-HASH-9 | SHOULD NOT | `computed` SHOULD NOT be included (re-derivable) |
| LIN-HASH-10 | MUST NOT | `input` MUST NOT be included (replay context, not semantic identity) |
| LIN-HASH-11 | MUST | `pendingDigest` MUST be included |
| LIN-HASH-TERM-5 | MUST | `terminalStatus` for hash MUST be exactly `'completed'` or `'failed'` |

### 6.4 Error Normalization

Errors included in `snapshotHash` MUST be normalized to exclude non-deterministic fields.

```typescript
type ErrorSignature = {
  readonly code: string;
  readonly source: {
    readonly actionId: string;
    readonly nodePath: string;
  };
  readonly context?: Record<string, unknown>;
  // NOTE: `message` and `timestamp` are intentionally EXCLUDED
};

function toErrorSignature(error: ErrorValue): ErrorSignature {
  return {
    code: error.code,
    source: {
      actionId: error.source.actionId,
      nodePath: error.source.nodePath,
    },
    context: error.context ? normalizeContext(error.context) : undefined,
  };
}

function normalizeContext(
  ctx: Record<string, unknown>
): Record<string, unknown> | undefined {
  const normalized = filterDeterministicValues(ctx);
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function errorSortKey(e: ErrorSignature): string {
  return computeHash(e);  // 64-char lowercase hex string
}

function sortErrorSignatures(errors: ErrorSignature[]): ErrorSignature[] {
  return [...errors].sort((a, b) => {
    const keyA = errorSortKey(a);
    const keyB = errorSortKey(b);
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-HASH-ERR-1 | MUST | Errors in snapshotHash MUST use ErrorSignature (normalized) |
| LIN-HASH-ERR-2 | MUST NOT | ErrorSignature MUST NOT include timestamp |
| LIN-HASH-ERR-3 | MUST NOT | ErrorSignature MUST NOT include stack traces |
| LIN-HASH-ERR-4 | MUST | ErrorSignature[] MUST be sorted deterministically before hashing |
| LIN-HASH-ERR-4a | MUST | Sort key MUST be `computeHash(ErrorSignature)` (64-char hex) |
| LIN-HASH-ERR-4b | MUST | Sort key comparison is simple ASCII string comparison |
| LIN-HASH-ERR-MSG-1 | MUST NOT | ErrorSignature MUST NOT include `message` field |
| LIN-HASH-ERR-MSG-2 | MUST | Error identification relies on `code` + `source` + `context` only |
| LIN-HASH-ERR-CTX-1 | MUST | `context` MUST only include deterministic values |

### 6.5 Hash Algorithm

```typescript
function computeHash(input: unknown): string {
  // 1. Canonicalize to JSON string (RFC 8785)
  const canonicalJson: string = JCS(input);
  // 2. Encode to UTF-8 bytes
  const utf8Bytes: Uint8Array = new TextEncoder().encode(canonicalJson);
  // 3. Compute SHA-256
  const hashBytes: Uint8Array = SHA256(utf8Bytes);
  // 4. Output as lower-case hex
  return Array.from(hashBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-ENC-1 | MUST | SHA-256 input MUST be UTF-8 encoded bytes of JCS output |
| LIN-ENC-2 | MUST | Hash output MUST be represented as lower-case hexadecimal string |
| LIN-JSON-1 | MUST | Hash input MUST be JSON-serializable (no `undefined`, `BigInt`, `NaN`, `Infinity`, `function`) |
| LIN-SCHEMA-1 | MUST | `world.schemaHash` MUST equal `snapshot.meta.schemaHash` |

### 6.6 World Creation Algorithm

This is the internal algorithm Lineage uses during seal preparation. **This function is pure** — it takes all inputs explicitly (no store reads) and produces deterministic output. No side effects, no I/O, no `Date.now()`. The prepare methods (`prepareSealGenesis`, `prepareSealNext`) read branch state from the store and then delegate to this pure core for identity computation.

```typescript
function createWorldRecord(
  schemaHash: string,
  terminalSnapshot: Snapshot,
  createdAt: number,                    // caller-provided (LIN-SEAL-PURE-1)
  createdBy: ProvenanceRef | null,
  traceRef?: ArtifactRef,
): { world: World; hashInput: SnapshotHashInput; worldId: WorldId } {
  // 1. Derive terminal status (LIN-SEAL-1)
  const terminalStatus = deriveTerminalStatus(terminalSnapshot);

  // 2. Normalize errors (LIN-HASH-ERR-1, LIN-HASH-ERR-4)
  const normalizedErrors = sortErrorSignatures(
    terminalSnapshot.system.errors.map(toErrorSignature)
  );

  // 3. Compute pendingDigest (LIN-HASH-PENDING-1)
  const pendingDigest = computePendingDigest(
    terminalSnapshot.system.pendingRequirements
  );

  // 4. Build hash input (LIN-HASH-1, LIN-HASH-4a, LIN-HASH-4b)
  const hashInput: SnapshotHashInput = {
    data: stripPlatformNamespaces(terminalSnapshot.data as Record<string, unknown>),
    system: {
      terminalStatus,
      errors: normalizedErrors,
      pendingDigest,
    },
  };

  // 5. Compute snapshotHash
  const snapshotHash = computeHash(hashInput);

  // 6. Validate schemaHash consistency (LIN-SCHEMA-1)
  if (schemaHash !== terminalSnapshot.meta.schemaHash) {
    throw new Error(
      `LIN-SCHEMA-1 violation: provided schemaHash (${schemaHash}) ` +
      `does not match snapshot.meta.schemaHash (${terminalSnapshot.meta.schemaHash})`
    );
  }

  // 7. Compute WorldId (LIN-ID-1)
  const worldId = computeHash({ schemaHash, snapshotHash });

  // 8. Create immutable World record — all values from inputs, no side effects
  const world: World = {
    worldId,
    schemaHash,
    snapshotHash,
    terminalStatus,
    createdAt,                          // from seal input, NOT Date.now()
    createdBy,
    executionTraceRef: traceRef,
  };

  return { world, hashInput, worldId };
}
```

**Why `createdAt` is caller-provided.** Prepare methods are read-only — they read store state but do not mutate it, and do not perform wall-clock or random I/O (LIN-SEAL-PURE-1). `createdAt` is not part of World identity (`snapshotHash` and `worldId` do not include it), but it is observable: `getLatestHead()` uses `createdAt` for ordering (LIN-HEAD-4). If prepare called `Date.now()` internally, the same seal input + same store state could produce different outputs on different calls. The caller (SDK, governance coordinator, or user code) provides the timestamp; in typical usage this is `Date.now()` at the call site, but tests can use fixed values for deterministic verification.

---

## 7. Seal Protocol

The seal protocol transforms a terminal snapshot into an immutable World record. It is built on a strict **prepare/commit separation**: preparation reads from the store but never mutates it, performs no wall-clock or random I/O, and given the same seal input and store state produces identical output. Commit is always a separate step.

### 7.1 Seal Inputs

```typescript
/** Genesis — first World creation. Creates the first branch. */
type SealGenesisInput = {
  readonly schemaHash: string;
  readonly terminalSnapshot: Snapshot;
  readonly createdAt: number;                // caller-provided (LIN-SEAL-PURE-1)
  readonly branchName?: string;              // default: 'main'
  readonly proposalRef?: ProvenanceRef;      // → World.createdBy
  readonly traceRef?: ArtifactRef;
};

/** Next — continuation from an existing World. */
type SealNextInput = {
  readonly schemaHash: string;
  readonly baseWorldId: WorldId;
  readonly branchId: BranchId;
  readonly terminalSnapshot: Snapshot;
  readonly createdAt: number;                // caller-provided (LIN-SEAL-PURE-1)
  readonly patchDelta?: PersistedPatchDeltaV2;  // caller-provided, optional
  readonly proposalRef?: ProvenanceRef;
  readonly decisionRef?: ProvenanceRef;
  readonly traceRef?: ArtifactRef;
};
```

**Why genesis and next are separate.** The two paths have fundamentally different preconditions. Genesis has no base, creates the first branch, and initializes `activeBranchId`. Next requires a valid `baseWorldId` and `branchId`, adds an edge to the DAG, and advances the branch head. Merging them into one method with conditional logic would produce a shape-shifting API where preconditions and return types depend on runtime values.

**Why `branchId` is required in `SealNextInput`.** `baseWorldId` alone identifies the parent World but not the target branch. When multiple branches point to the same World (e.g., `main` and `experiment` both at W1), lineage cannot determine which branch's head to advance without explicit identification. Guessing would cause branch corruption; advancing both would break fork semantics.

**Why `patchDelta` is caller-provided.** Patch deltas are generated by Host during execution — they are the sequence of patches that transformed `baseSnapshot` into `terminalSnapshot`. Lineage does not execute intents and therefore cannot compute these patches. The caller (governance coordinator, SDK, or user code) is responsible for providing them if available. When omitted, lineage stores the World without a delta; replay from patches is unavailable but full-snapshot restore remains functional.

**Why `createdAt` is caller-provided.** See §6.6 for the full rationale. In short: prepare methods are read-only (no mutation, no wall-clock I/O), and `createdAt` affects observable ordering (`getLatestHead()`). Moving timestamp responsibility to the caller ensures reproducibility given the same seal input and store state.

**Why genesis has no `decisionRef`.** In the `Next` path, `proposalRef` maps to `World.createdBy` and `decisionRef` maps to `WorldEdge.decisionRef`. Genesis has no parent, so it has no edge — and therefore no place to store `decisionRef`. `SealGenesisInput.proposalRef` maps to `World.createdBy`; if governance wraps genesis in a proposal, that ref is preserved there. A `decisionRef` without an edge would be orphaned data with no structural home.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-SEAL-PURE-1 | MUST | `prepareSealGenesis()` and `prepareSealNext()` are read-only preparations: they MAY read from `LineageStore` but MUST NOT mutate it, MUST NOT perform I/O beyond store reads, MUST NOT call `Date.now()` or generate random values. All non-deterministic values (including `createdAt`) MUST be provided via seal input. Given the same seal input and the same store state, the output MUST be identical |
| LIN-BRANCH-SEAL-1 | MUST | `prepareSealNext()` MUST require `branchId` |
| LIN-BRANCH-SEAL-2 | MUST | `branchId`'s current head MUST equal `baseWorldId`. Mismatch → reject |
| LIN-BRANCH-SEAL-3 | MUST | `prepareSealGenesis()` MUST return a `PreparedGenesisCommit` that includes `PreparedBranchBootstrap` |
| LIN-BRANCH-SEAL-4 | MUST | Head advance via seal MUST only affect the branch identified by `branchId` |

### 7.2 PreparedLineageCommit

The result of seal preparation. Contains everything needed for atomic commit. Preparation reads from store but never mutates it.

```typescript
// ─── Branch change variants ───

/** Next: advance existing branch (head, epoch) via joint CAS */
type PreparedBranchMutation = {
  readonly kind: 'advance';
  readonly branchId: BranchId;
  readonly expectedHead: WorldId;
  readonly nextHead: WorldId;
  readonly headAdvanced: boolean;     // true iff terminalStatus === 'completed'
  readonly expectedEpoch: number;
  readonly nextEpoch: number;         // expectedEpoch + 1 when head advances, else unchanged
};

/** Genesis: bootstrap first branch + initial head + activeBranch */
type PreparedBranchBootstrap = {
  readonly kind: 'bootstrap';
  readonly branch: PersistedBranchEntry;
  readonly activeBranchId: BranchId;
};

type PreparedBranchChange = PreparedBranchMutation | PreparedBranchBootstrap;

// ─── Prepared commit variants ───

/** Common lineage records */
type PreparedLineageRecords = {
  readonly worldId: WorldId;
  readonly world: World;
  readonly terminalSnapshot: Snapshot;
  readonly hashInput: SnapshotHashInput;
};

/** Genesis commit */
type PreparedGenesisCommit = PreparedLineageRecords & {
  readonly kind: 'genesis';
  readonly branchId: BranchId;
  readonly terminalStatus: 'completed';       // genesis is completed-only (LIN-GENESIS-1)
  readonly edge: null;
  readonly patchDelta: null;
  readonly branchChange: PreparedBranchBootstrap;
};

/** Next commit */
type PreparedNextCommit = PreparedLineageRecords & {
  readonly kind: 'next';
  readonly branchId: BranchId;
  readonly terminalStatus: TerminalStatus;
  readonly edge: WorldEdge;
  readonly patchDelta: PersistedPatchDeltaV2 | null;
  readonly branchChange: PreparedBranchMutation;
};

type PreparedLineageCommit = PreparedGenesisCommit | PreparedNextCommit;
```

**Epoch semantics in `PreparedBranchMutation`.** When `headAdvanced` is `true` (terminal status is `completed`), `nextEpoch` is `expectedEpoch + 1`. When `headAdvanced` is `false` (terminal status is `failed`), `nextEpoch` equals `expectedEpoch` — the failed World is stored in the DAG but the branch pointer does not move and the epoch does not change.

Lineage increments epoch as a mechanical side-effect of head advance. The governance-level meaning of this increment — invalidating stale ingress proposals — is not interpreted by lineage. Lineage does not know what an epoch means to governance; it only knows that epoch and head must be CAS'd together.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-SEAL-4 | MUST | `prepareSealNext()` and `prepareSealGenesis()` MUST NOT mutate the store |
| LIN-SEAL-5 | MUST | `LineageService.commitPrepared()` MUST delegate to `LineageStore.commitPrepared()` for atomic persistence. This path is for lineage-only environments. Governance environments use `CommitCapableWorldStore.commitSeal()` |
| LIN-SEAL-6 | MUST NOT | Lineage MUST NOT provide an API that combines prepare and commit in a single method |

### 7.3 LineageService Interface

```typescript
interface LineageService {
  // ─── Prepare — read-only, no mutation, no wall-clock I/O ───

  prepareSealGenesis(input: SealGenesisInput): PreparedGenesisCommit;
  prepareSealNext(input: SealNextInput): PreparedNextCommit;

  // ─── Commit — lineage-only environments ───

  commitPrepared(prepared: PreparedLineageCommit): void;

  // ─── Branch management ───

  createBranch(name: string, headWorldId: WorldId): BranchId;
  getBranches(): readonly BranchInfo[];
  getActiveBranch(): BranchInfo;
  switchActiveBranch(targetBranchId: BranchId): BranchSwitchResult;

  // ─── Query ───

  getWorld(worldId: WorldId): World | null;
  getSnapshot(worldId: WorldId): Snapshot | null;
  getLineage(): WorldLineage;
  getHeads(): readonly WorldHead[];
  getLatestHead(): WorldHead | null;

  // ─── Resume ───

  restore(worldId: WorldId): Snapshot;
}
```

### 7.4 Seal Sequence — Governance-Free (Lineage Standalone)

```
User Code / SDK                     Lineage                    LineageStore
    │                                  │                           │
    │  1. Execute intent               │                           │
    │     → terminalSnapshot           │                           │
    │     → patches (optional)         │                           │
    │                                  │                           │
    │── prepareSealNext() ────────────>│                           │
    │   { branchId, baseWorldId,       │                           │
    │     terminalSnapshot, ... }      │                           │
    │                                  │  2. Read branch state     │
    │                                  │  3. Validate branchId     │
    │                                  │     head == baseWorldId   │
    │                                  │     (LIN-BRANCH-SEAL-2)   │
    │                                  │  4. deriveTerminalStatus()│
    │                                  │  5. Canonicalize, hash,   │
    │                                  │     create records        │
    │                                  │     (in memory only)      │
    │                                  │  6. Prepare branchChange  │
    │                                  │     (CAS advance delta)   │
    │                                  │                           │
    │<── PreparedNextCommit ──────────│                           │
    │                                  │                           │
    │── commitPrepared(prepared) ─────>│                           │
    │                                  │── atomic persist ────────>│
    │                                  │   (all records + branch   │
    │                                  │    CAS in one transaction) │
    │                                  │                           │
    │  7. Check result.terminalStatus  │                           │
    │     Update UI / handle error     │                           │
```

**This is the core value proposition of the split.** Governance-free usage requires no Proposal, no Actor, no Authority. The caller provides a terminal snapshot; lineage computes identity, prepares all records, and commits atomically.

### 7.5 Seal Sequence — With Governance (Coordinator Pattern)

When governance is present, a coordinator (typically the `@manifesto-ai/world` facade or SDK) orchestrates the seal across both protocols.

```
Governance       Coordinator (facade)      Lineage              Store
    │                    │                     │                    │
    │  1-5. Approve,     │                     │                    │
    │  execute, validate │                     │                    │
    │  prepare refs      │                     │                    │
    │                    │                     │                    │
    │── request seal ──>│                     │                    │
    │                    │── prepareSealNext() ─>│                    │
    │                    │                     │  6-12. derive,     │
    │                    │                     │  canonicalize,     │
    │                    │                     │  create records    │
    │                    │<── PreparedLineageCommit ─│                    │
    │                    │                     │                    │
    │                    │── governance.        │                    │
    │                    │   finalize()         │                    │
    │                    │ → PreparedGovCommit  │                    │
    │                    │                     │                    │
    │                    │── store.commitSeal(  │                    │
    │                    │   writeSet) ─────────────────────────────>│
    │                    │   (lineage + governance, atomic)          │
    │                    │                     │                    │
    │                    │── emit events ──────────────────────────>│
    │                    │   (only after commit success)             │
    │                    │                     │                    │
    │<── result ─────────│                     │                    │
```

Lineage does not know this coordinator exists. It sees only `prepareSealNext()` calls. The coordinator is responsible for assembling the write set and ensuring atomicity (see ADR-014 D14, COMMIT-1~4).

### 7.6 traceRef Policy

`traceRef` is a non-identity field set at World creation time.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-TRACE-1 | MUST NOT | `traceRef` MUST NOT be included in `snapshotHash` or `worldId` computation |
| LIN-TRACE-2 | MUST | `traceRef` MUST be set only at World creation time; post-hoc mutation is forbidden (INV-L1) |

**When `traceRef` is unavailable at seal time.** If execution trace collection is asynchronous and not yet complete when seal is called, the World is created without `traceRef`. Since Worlds are immutable after creation (INV-L1), the trace cannot be attached later. In this case, the trace SHOULD be stored externally (e.g., in a separate telemetry store) and correlated with the World via `worldId`. Lineage does not provide a "late attach" mechanism because it would violate World immutability.

---

## 8. WorldId Collision Policy

WorldId is content-addressable: `worldId = computeHash({ schemaHash, snapshotHash })`. This means two terminal snapshots with identical hash-relevant content produce the same worldId, regardless of their lineage position. This creates two collision scenarios that the DAG invariants cannot absorb.

**Scenario 1 — Self-loop.** An execution produces no semantic change (same data, same errors, same pendingRequirements as the base). The computed worldId equals `baseWorldId`. Creating an edge with `from == to` violates LIN-DAG-2 (acyclic).

**Scenario 2 — Diamond convergence.** Two different parents both produce terminal snapshots with identical hash-relevant content. The second seal attempts to create a World that already exists with a different parent, violating LIN-DAG-1 (exactly one parent).

Both scenarios are structural: the conflict is between content-addressable identity and the single-parent acyclic DAG model. In v1, lineage rejects these cases rather than introducing noop/reuse semantics that would complicate the commit model.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-COLLISION-1 | MUST | `prepareSealNext()` MUST reject if the computed `worldId` already exists in `LineageStore` |
| LIN-COLLISION-2 | MUST | `prepareSealNext()` MUST reject if the computed `worldId` equals `baseWorldId` (self-loop prevention) |
| LIN-COLLISION-3 | MUST | `prepareSealGenesis()` MUST reject if the computed `worldId` already exists in `LineageStore` |
| LIN-COLLISION-4 | MUST | Rejection MUST include the conflicting `worldId` and the reason (existing world / self-loop) in the error |

**LIN-COLLISION-2 is a special case of LIN-COLLISION-1** — if `baseWorldId` exists (which it must per LIN-BASE-1), and the computed worldId equals it, then the worldId already exists. LIN-COLLISION-2 is stated separately because the self-loop case has a distinct diagnostic meaning: "execution produced no semantic change."

**Two-layer enforcement.** Collision is checked at both prepare time (LIN-COLLISION-1~3) and commit time (LIN-STORE-9). Prepare-time checks catch the common case early with a clear error. Commit-time checks close the race window between prepare and commit — two callers on different branches may both pass prepare-time checks against the same store state, but only one commit can succeed. Without commit-time enforcement, branch-local CAS (which only validates the target branch's head and epoch) would allow both commits to succeed, attaching different parent edges to the same worldId.

**Practical implications.** A no-op execution (semantic identity between base and result) is not silently absorbed — it is a detectable, reportable condition. The caller can respond by not dispatching the intent, by modifying the input, or by treating it as a normal "nothing changed" signal at the application level. What lineage will not do is pretend a new World was created when the content is identical to one that already exists.

**Future extension.** If noop-commit semantics (e.g., `PreparedNoopCommit` that skips edge creation and head advance) are needed, they require a dedicated protocol extension that defines how the DAG, branch state, and epoch behave when no new World is created. This is out of scope for v1.

---

## 9. BaseWorld Admissibility

Continuity is not just storage — "what may be continued" is part of continuity's responsibility. Even without governance, lineage must determine whether a given base World is a valid foundation for the next World.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-BASE-1 | MUST | `prepareSealNext()`'s `baseWorldId` MUST exist in LineageStore |
| LIN-BASE-2 | MUST | Base world with non-empty `pendingRequirements` MUST cause `prepareSealNext()` to reject |
| LIN-BASE-3 | MUST NOT | Failed world (`terminalStatus: 'failed'`) MUST NOT be used as base. `prepareSealNext()` MUST reject |
| LIN-BASE-4 | MUST | `baseWorldId`'s `schemaHash` MUST match the seal input's `schemaHash` |

**LIN-BASE-2 rationale.** A World with unresolved `pendingRequirements` represents an execution that did not fully converge. Building on this foundation means the resumed snapshot inherits unresolved requirements, breaking continuity soundness.

**LIN-BASE-3 rationale.** Building on a failed World means stacking new history on top of a failure. More importantly, this rule is structurally enforced by the head model: `LIN-BRANCH-SEAL-2` requires `baseWorldId` to be the branch's current head, and `LIN-HEAD-ADV-1` guarantees that heads are always `completed`. A failed World can never be a branch head, so it can never be a valid `baseWorldId` under the current branch model. Making this a hard MUST NOT (rather than a soft SHOULD NOT with opt-in) aligns the rule's stated strength with its actual enforcement. If failed-state branching is needed in the future (e.g., diagnostic fork from a failure), it requires a dedicated protocol extension — not an opt-in flag — because it must also address how a branch head can point to a non-completed World without violating head invariants.

---

## 10. Branch Model

### 10.1 Branch Types

```typescript
type BranchId = string;

type BranchInfo = {
  readonly id: BranchId;
  readonly name: string;
  readonly head: WorldId;
  readonly schemaHash: string;
  readonly createdAt: number;
};

type PersistedBranchEntry = {
  readonly id: BranchId;
  readonly name: string;
  readonly head: WorldId;
  readonly epoch: number;
  readonly schemaHash: SchemaHash;
  readonly createdAt: number;
  readonly parentBranch?: BranchId;
  readonly lineage: readonly string[];
};

type PersistedBranchState = {
  readonly branches: readonly PersistedBranchEntry[];
  readonly activeBranchId: BranchId;
};
```

#### 10.1.1 BranchId Generation Rules

`BranchId` generation MUST be deterministic in contexts covered by the prepare reproducibility contract (`prepareSealGenesis`). For `createBranch()`, which is a direct store mutation outside prepare, `BranchId` generation is implementation-defined.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-BRANCH-ID-1 | MUST | Genesis `branchId` MUST be computed as `computeHash({ kind: 'genesis-branch', branchName, worldId })` where `branchName` is from seal input (default `'main'`) and `worldId` is the computed genesis worldId |
| LIN-BRANCH-ID-2 | MAY | `createBranch()` MAY use any unique id generation strategy (UUID, counter, hash). This method is not covered by the prepare reproducibility contract |

#### 10.1.2 PersistedBranchEntry Field Rules for Genesis Bootstrap

When `prepareSealGenesis()` constructs the `PreparedBranchBootstrap`, every field in the `PersistedBranchEntry` MUST be deterministically derived from seal input and computed values.

| Field | Derivation | Rule ID |
|-------|-----------|---------|
| `id` | `computeHash({ kind: 'genesis-branch', branchName, worldId })` (LIN-BRANCH-ID-1) | LIN-BOOTSTRAP-1 |
| `name` | Seal input's `branchName` (default: `'main'`) | LIN-BOOTSTRAP-2 |
| `head` | Computed `worldId` | LIN-BOOTSTRAP-3 |
| `epoch` | `0` | LIN-BOOTSTRAP-4 |
| `schemaHash` | Seal input's `schemaHash` | LIN-BOOTSTRAP-5 |
| `createdAt` | Seal input's `createdAt` | LIN-BOOTSTRAP-6 |
| `parentBranch` | `undefined` (genesis has no parent branch) | LIN-BOOTSTRAP-7 |
| `lineage` | `[branchId]` | LIN-BOOTSTRAP-8 |

The `PreparedBranchBootstrap.activeBranchId` MUST equal the computed `branchId` (LIN-BOOTSTRAP-1).

**`epoch` is in `PersistedBranchEntry`.** Epoch is branch-level lineage metadata. It is incremented by head advance (§10.3) and by branch switch (§10.4). Since epoch and head must always be CAS'd together, they belong in the same record. Governance reads the current epoch via `LineageStore.getBranchEpoch()` for admission decisions, but governance does not own or compute the epoch value — lineage does.

### 10.2 Head Semantics

A **Head** is a World referenced by `Branch.head` — pointer semantics, not graph leaf.

```typescript
type WorldHead = {
  readonly worldId: WorldId;
  readonly branchId: BranchId;
  readonly branchName: string;
  readonly createdAt: number;        // head World's creation time, NOT Branch's
  readonly schemaHash: string;       // Branch's current schemaHash
};
```

| Property | Description |
|----------|-------------|
| Pointer semantics | Head is where a Branch currently points, not a graph property |
| Always completed | Head Worlds always have `terminalStatus: 'completed'` (LIN-HEAD-ADV-1) |
| One head per branch | Each Branch has exactly one head |
| Shared World possible | Multiple Branches may point to the same WorldId |
| Genesis is initial head | The default 'main' branch starts with genesis as its head |

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-HEAD-1 | MUST | A Head is defined as a World referenced by `Branch.head` |
| LIN-HEAD-2 | MUST | `getHeads()` MUST return one entry per Branch |
| LIN-HEAD-3 | MUST | Head Worlds MUST have `terminalStatus: 'completed'` |
| LIN-HEAD-4 | MUST | `getLatestHead()` MUST return the Head with the most recent `createdAt` |
| LIN-HEAD-5 | MUST | Tie-break: `worldId` ascending, then `branchId` ascending |
| LIN-HEAD-6 | MUST | Head query results MUST be consistent with current branch state |
| LIN-HEAD-7 | MUST | `WorldHead.createdAt` MUST be the head World's creation timestamp |
| LIN-HEAD-8 | MUST | `WorldHead.schemaHash` MUST be the Branch's current schemaHash |

### 10.3 Head Advance Policy

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-HEAD-ADV-1 | MUST | Head advance MUST only occur for `terminalStatus === 'completed'` |
| LIN-HEAD-ADV-2 | MUST | Failed world MUST be persisted in the DAG but MUST NOT advance branch head |
| LIN-HEAD-ADV-3 | MUST | Failed world MUST be queryable via `getWorld()` and `getLineage()` |
| LIN-HEAD-ADV-4 | MUST | Head advance MUST increment the branch's epoch (§15) |

**LIN-HEAD-ADV-4 rationale.** Head advance changes the branch's history — any proposal or operation that was valid against the previous head is now stale. Incrementing epoch on head advance is the mechanism that makes this staleness detectable. This extends the existing EPOCH-2 ("branch switch increments epoch") to cover same-branch progression. Without this rule, stale operations could pass epoch validation after a head advance because the epoch hasn't changed.

### 10.4 Branch Switch

`switchActiveBranch()` is an explicit protocol operation, not a simple setter. It is a persisted state change that survives restart.

```typescript
type BranchSwitchResult = {
  readonly previousBranchId: BranchId;
  readonly targetBranchId: BranchId;
  readonly sourceBranchEpochAfter: number;
};
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-SWITCH-1 | MUST | `switchActiveBranch()` MUST atomically combine `activeBranchId` change with source branch epoch increment |
| LIN-SWITCH-2 | MUST | Only the source (previous active) branch's epoch increments. Target branch epoch is unchanged |
| LIN-SWITCH-3 | MUST | `targetBranchId` that does not exist MUST be rejected |
| LIN-SWITCH-4 | MUST | Result MUST include the incremented source branch epoch |
| LIN-SWITCH-5 | MUST | `targetBranchId` that equals the current `activeBranchId` MUST be rejected. Self-switch is not a no-op — it is an error |

**LIN-SWITCH-5 rationale.** When source and target are the same branch, LIN-SWITCH-1 ("increment source epoch") and LIN-SWITCH-2 ("target epoch unchanged") contradict each other — the same branch cannot simultaneously have its epoch incremented and unchanged. Rather than picking one interpretation, lineage rejects the call. A self-switch indicates a caller logic error (the caller already knows which branch is active via `getActiveBranch()`), and silently succeeding would mask that error while potentially producing unintended epoch side effects.

**Why source branch epoch only.** Before the switch, proposals may be pending on the source branch. These proposals' base context is no longer the active context — their epoch must become stale. Target branch proposals, if any, become valid when the target becomes active, so their epoch should not change.

### 10.5 Genesis

Genesis is the bootstrap of a lineage — the first World and the first branch.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-GENESIS-1 | MUST | `prepareSealGenesis()` MUST only succeed when `deriveTerminalStatus(snapshot) === 'completed'`. Failed snapshot → reject |
| LIN-GENESIS-2 | MUST | `prepareSealGenesis()` MUST return a `PreparedGenesisCommit` that includes `PreparedBranchBootstrap` with new branch entry, initial head, and `activeBranchId` |
| LIN-GENESIS-3 | MUST | If branches already exist in the store, genesis commit MUST be rejected (no duplicate bootstrap) |

**Why failed genesis is forbidden.** Genesis has no "previous head" to fall back to. If genesis is failed, the branch has no completed head, violating LIN-HEAD-3. "Head-less branch" semantics would require adjusting resume invariants across the board — this complexity is deferred to a future ADR.

### 10.6 Branch Creation (Post-Genesis)

`createBranch(name, headWorldId)` creates a new branch pointing to an existing World. This is the mechanism for forking — the new branch shares history up to `headWorldId` and diverges from there.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-BRANCH-CREATE-1 | MUST | `headWorldId` MUST exist in LineageStore |
| LIN-BRANCH-CREATE-2 | MUST | `headWorldId` MUST have `terminalStatus: 'completed'` (head invariant LIN-HEAD-3) |
| LIN-BRANCH-CREATE-3 | MUST | The new branch's `epoch` MUST be initialized to `0` |
| LIN-BRANCH-CREATE-4 | MUST | The new branch's `schemaHash` MUST be set to the `headWorldId`'s `schemaHash` |
| LIN-BRANCH-CREATE-5 | MUST | Branch name uniqueness is NOT required — multiple branches MAY share the same name. `BranchId` is the unique identifier |
| LIN-BRANCH-CREATE-6 | MUST NOT | `createBranch()` MUST NOT change `activeBranchId`. Use `switchActiveBranch()` separately |

---

## 11. Persistence Model

### 11.1 Required Records

Lineage implementations MUST persist (in serializable form) at minimum:

| Record | Key | Description |
|--------|-----|-------------|
| Worlds | WorldId | Immutable World records |
| TerminalSnapshots | WorldId | Full terminal snapshot (or sufficient data to restore) |
| WorldEdges | edgeId | Lineage DAG edges |
| BranchState | BranchId | Branch entries + activeBranchId |

RECOMMENDED additional records:

| Record | Key | Description |
|--------|-----|-------------|
| PatchDeltas | `(fromWorld, toWorld)` | Serialized patch deltas for replay/restore |
| SnapshotHashInputs | snapshotHash | Normalized hash input for audit/replay |

### 11.2 LineageStore Interface

```typescript
interface LineageStore {
  // ─── World records ───
  putWorld(world: World): void;
  getWorld(worldId: WorldId): World | null;

  // ─── Terminal snapshots ───
  putSnapshot(worldId: WorldId, snapshot: Snapshot): void;
  getSnapshot(worldId: WorldId): Snapshot | null;

  // ─── Patch deltas ───
  putPatchDelta(from: WorldId, to: WorldId, delta: PersistedPatchDeltaV2): void;
  getPatchDelta(from: WorldId, to: WorldId): PersistedPatchDeltaV2 | null;

  // ─── Hash inputs (RECOMMENDED for audit/replay) ───
  putHashInput?(snapshotHash: string, input: SnapshotHashInput): void;
  getHashInput?(snapshotHash: string): SnapshotHashInput | null;

  // ─── Edges ───
  putEdge(edge: WorldEdge): void;
  getEdges(worldId: WorldId): readonly WorldEdge[];

  // ─── Branch state ───
  getBranchHead(branchId: BranchId): WorldId | null;
  getBranchEpoch(branchId: BranchId): number;
  mutateBranch(mutation: PreparedBranchMutation): void;
  putBranch(branch: PersistedBranchEntry): void;
  getBranches(): readonly PersistedBranchEntry[];
  getActiveBranchId(): BranchId | null;
  switchActiveBranch(sourceBranchId: BranchId, targetBranchId: BranchId): void;

  // ─── Atomic commit ───
  commitPrepared(prepared: PreparedLineageCommit): void;
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-STORE-1 | MUST NOT | `LineageStore` MUST NOT reference governance types (Proposal, DecisionRecord, ActorBinding) |
| LIN-STORE-2 | MUST | `LineageStore` MUST be owned and defined by `@manifesto-ai/lineage` |
| LIN-STORE-3 | MUST | Lineage package MUST provide an in-memory `LineageStore` implementation |
| LIN-STORE-4 | MUST | `mutateBranch()` MUST CAS-verify `(expectedHead, expectedEpoch)` jointly against current stored values. Any mismatch → throw |
| LIN-STORE-5 | MUST | `mutateBranch()` MUST only affect the specified branch. Other branches are not touched |
| LIN-STORE-6 | MUST | `commitPrepared()` MUST atomically persist all records and branch change. On failure, nothing is persisted |
| LIN-STORE-7 | MUST | `commitPrepared()` with `branchChange.kind === 'advance'` MUST apply joint CAS (LIN-STORE-4). With `kind === 'bootstrap'` MUST verify branch non-existence (LIN-GENESIS-3) |
| LIN-STORE-8 | MUST | `switchActiveBranch()` MUST atomically combine `activeBranchId` change with source branch epoch increment (LIN-SWITCH-1) |
| LIN-STORE-9 | MUST | `commitPrepared()` MUST verify within the same transaction that the `worldId` does not already exist in the store. If it exists, the entire commit MUST be rejected and nothing persisted. This is the commit-time enforcement of LIN-COLLISION-1~3 |

**LIN-STORE-9 rationale.** Prepare-time collision checks (LIN-COLLISION-1~3) are necessary but not sufficient. Between prepare and commit, another caller on a different branch may commit a World with the same `worldId`. Since branch-local CAS (LIN-STORE-4) only validates the target branch's `(head, epoch)`, it does not detect cross-branch worldId collision. Without commit-time re-verification, two commits from different branches could both succeed and attach different parent edges to the same `worldId`, violating LIN-DAG-1 (exactly one parent) and INV-L28 (no duplicate worlds with different parents). The in-transaction check closes this race.

### 11.3 Snapshot Storage Clarification

`snapshotHash` is computed from `SnapshotHashInput`, which excludes non-deterministic fields. Multiple full snapshots may map to the same `snapshotHash`.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-PERSIST-SNAP-1 | MUST NOT | Full snapshots MUST NOT be keyed by `snapshotHash` (ambiguous) |
| LIN-PERSIST-SNAP-2 | MUST | Full terminal snapshot MUST use `WorldId` as key |
| LIN-PERSIST-SNAP-3 | SHOULD | `SnapshotHashInput` SHOULD be stored keyed by `snapshotHash` (audit/replay) |
| LIN-PERSIST-SNAP-4 | SHOULD | Replay verification SHOULD use `SnapshotHashInput` when available |

### 11.4 BaseSnapshot Restoration

When continuing from an existing World, the caller needs a `baseSnapshot`. Lineage provides `getSnapshot(worldId)` for this purpose. The restoration strategy (full snapshot, data-only + recompute, external artifact) is an implementation choice.

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-PERSIST-BASE-1 | MUST | Lineage MUST be able to retrieve snapshot via `getSnapshot()` for any persisted World |
| LIN-PERSIST-BASE-2 | MUST | Restored snapshot MUST produce the same `snapshotHash` as the original |

### 11.5 Patch Delta Format

```typescript
type PersistedPatchDeltaV2 = {
  readonly _patchFormat: 2;
  readonly patches: readonly Patch[];
};
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-PERSIST-PATCH-1 | MUST | Serialized patch payloads MUST include `_patchFormat` |
| LIN-PERSIST-PATCH-2 | MUST | Store restore MUST accept only `_patchFormat: 2` |
| LIN-PERSIST-PATCH-3 | MUST | `_patchFormat: 1` or missing format tag MUST be hard-rejected |
| LIN-PERSIST-PATCH-4 | MUST | On legacy format rejection, re-initialization from genesis is required |

### 11.6 Branch Persistence

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-BRANCH-PERSIST-1 | MUST | LineageStore MUST persist branch state sufficient to reconstruct branch manager |
| LIN-BRANCH-PERSIST-2 | MUST | Persisted branch head MUST reference a valid, restorable WorldId |
| LIN-BRANCH-PERSIST-3 | MUST | Active branch ID MUST be persisted |
| LIN-BRANCH-PERSIST-4 | SHOULD | Branch state update SHOULD be atomic with World creation |
| LIN-BRANCH-PERSIST-5 | SHOULD | Branch state SHOULD be stored alongside lineage store index |

### 11.7 Crash Recovery

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-RECOVER-1 | MUST | On restart, each persisted branch head WorldId MUST be validated against the store |
| LIN-RECOVER-2 | MUST | Branches with invalid head WorldIds MUST be excluded from resume; a warning MUST be logged |
| LIN-RECOVER-3 | MUST | If all persisted branches have invalid heads, fall back to fresh start |

---

## 12. DAG Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-DAG-1 | MUST | Every non-genesis World MUST have exactly one parent (fork-only) |
| LIN-DAG-2 | MUST | Lineage MUST be acyclic (DAG) |
| LIN-DAG-3 | MUST | Lineage MUST be append-only |
| LIN-DAG-4 | MAY | Multiple children from same parent are allowed (branching) |

---

## 13. Replay Support

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-REPLAY-1 | SHOULD | Stored lineage and snapshots SHOULD enable history reconstruction |
| LIN-REPLAY-2 | SHOULD | `traceRef` (if present) SHOULD enable execution observation replay |
| LIN-REPLAY-3 | MUST | Same inputs replayed MUST produce identical WorldIds |

---

## 14. Resume Semantics

Resume is the process of reconstructing runtime state from persisted lineage after a restart.

```
Restart Flow:
  App.ready()
    ├─ LineageStore loaded, branch state restored
    ├─ activeBranch = persisted activeBranchId (LIN-BRANCH-PERSIST-3)
    ├─ head = activeBranch.head
    ├─ snapshot = lineage.restore(head)
    │    → Initialize runtime with snapshot on activeBranch
    └─ if no persisted branch state (first launch):
         → Initialize with genesis snapshot on 'main' branch
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-RESUME-1 | MUST | Lineage MUST support `getLatestHead()` query after initialization |
| LIN-RESUME-2 | MUST | Head's snapshot MUST be restorable via `getSnapshot()` / `restore()` |
| LIN-RESUME-3 | MUST | Resume MUST NOT create new Worlds (read-only operation) |
| LIN-RESUME-4 | SHOULD | Default resume SHOULD use persisted active branch's head |
| LIN-RESUME-5 | MAY | Alternative resume strategies MAY be implemented by the caller |
| LIN-RESUME-6 | MUST | If active branch's `schemaHash` differs from current schema, the caller MUST handle migration or reject resume |

### 14.1 Schema Migration on Resume

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-RESUME-SCHEMA-1 | MUST | Schema hash mismatch between persisted branches and current schema MUST be detected during bootstrap |
| LIN-RESUME-SCHEMA-2 | MUST | Schema mismatch MUST NOT be silently ignored; a warning MUST be logged |
| LIN-RESUME-SCHEMA-3 | MUST | On schema mismatch, fall back to fresh start (new genesis on 'main' branch) |

---

## 15. Epoch Semantics

Epoch is a monotonically increasing counter per branch. It serves as a staleness detector for operations that were valid against a previous branch state.

**Ownership boundary.** Lineage owns the epoch value — it stores, increments, and CAS-validates it. Governance reads the epoch for admission decisions (e.g., stale proposal detection). Lineage does not interpret the governance-level meaning of epoch; it only guarantees that epoch and head are always updated atomically.

### 15.1 Epoch Increment Triggers

| Trigger | Mechanism | Rationale |
|---------|-----------|-----------|
| Head advance | `PreparedBranchMutation.nextEpoch = expectedEpoch + 1` when `headAdvanced` is `true` | History changed — operations against the previous head are stale |
| Branch switch | `switchActiveBranch()` increments source branch epoch | Active context changed — source branch operations are stale |

### 15.2 Epoch Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-EPOCH-1 | MUST | Epoch MUST be stored per branch in `PersistedBranchEntry` |
| LIN-EPOCH-2 | MUST | Head advance MUST increment the branch's epoch |
| LIN-EPOCH-3 | MUST | Branch switch MUST increment the source (previous active) branch's epoch |
| LIN-EPOCH-4 | MUST NOT | Branch switch MUST NOT change the target branch's epoch |
| LIN-EPOCH-5 | MUST | Epoch and head MUST be CAS'd together in `mutateBranch()` (LIN-STORE-4) |
| LIN-EPOCH-6 | MUST | Epoch MUST be readable by external protocols via `LineageStore.getBranchEpoch()` |

---

## 16. Invariants

### 16.1 World Invariants

| ID | Invariant |
|----|-----------|
| INV-L1 | Worlds are immutable after creation |
| INV-L2 | WorldId is deterministic from (schemaHash, snapshotHash) |
| INV-L3 | Lineage is acyclic |
| INV-L4 | Lineage is append-only |
| INV-L5 | Every non-genesis World has exactly one parent |
| INV-L6 | snapshotHash excludes non-deterministic fields |
| INV-L7 | Errors in snapshotHash use ErrorSignature |
| INV-L8 | snapshotHash includes pendingDigest |
| INV-L9 | snapshotHash uses terminalStatus (normalized) |
| INV-L10 | Error sorting uses `computeHash(ErrorSignature)` |
| INV-L11 | world.schemaHash equals snapshot.meta.schemaHash |
| INV-L12 | Hash input is JSON-serializable |
| INV-L13 | ErrorSignature MUST NOT include message field |
| INV-L14 | Error state determination uses lastError, not errors.length |
| INV-L15 | Head is pointer semantics, not graph leaf |
| INV-L16 | All Heads have terminalStatus completed |
| INV-L17 | getLatestHead() returns restorable World |
| INV-L18 | Resume is read-only |

### 16.2 Hash Invariants

| ID | Invariant |
|----|-----------|
| INV-L19 | SHA-256 input is UTF-8 encoded bytes |
| INV-L20 | Hash output is lower-case hexadecimal string |
| INV-L21 | Hash input contains only JSON-serializable values |

### 16.3 Epoch Invariants

| ID | Invariant |
|----|-----------|
| INV-L22 | Epoch and head are always CAS'd together |
| INV-L23 | Epoch is monotonically non-decreasing per branch |
| INV-L24 | Head advance increments epoch |

### 16.4 Seal Invariants

| ID | Invariant |
|----|-----------|
| INV-L25 | terminalStatus is derived from snapshot, never caller-provided |
| INV-L26 | Seal preparation is read-only — may read store, must not mutate it, no wall-clock I/O, no randomness |
| INV-L27 | Commit is atomic — all records or nothing |
| INV-L28 | WorldId collision is rejected — no self-loops, no duplicate worlds with different parents |
| INV-L29 | Every field in `PreparedLineageCommit` is deterministic from seal input + store state — including `edgeId`, `branchId`, and all bootstrap record fields |

---

## 17. Compliance

### 17.1 Compliance Requirements

An implementation claiming compliance with **Manifesto Lineage Protocol v1.0.0** MUST:

1. Implement all types defined in this document
2. Enforce all MUST rules (identified by Rule IDs)
3. Enforce all invariants (INV-L*)
4. Compute WorldId via JCS + SHA-256 (LIN-ID-1~3)
5. Derive terminalStatus internally (LIN-SEAL-1~3)
6. Compute snapshotHash excluding non-deterministic fields (LIN-HASH-*)
7. Normalize and sort errors using ErrorSignature (LIN-HASH-ERR-*)
8. Enforce prepare read-only contract — no mutation, no wall-clock I/O, no randomness (LIN-SEAL-PURE-1)
9. Enforce prepare/commit separation (LIN-SEAL-4~6)
10. Reject worldId collisions — existing worldId or self-loop (LIN-COLLISION-1~4)
11. Enforce head advance policy — completed only (LIN-HEAD-ADV-1~4)
12. Enforce baseWorld admissibility — failed base hard reject (LIN-BASE-1~4)
13. Enforce branch creation constraints (LIN-BRANCH-CREATE-1~6)
14. Enforce branch CAS semantics (LIN-STORE-4~5)
15. Provide atomic commit with worldId uniqueness check (LIN-STORE-6, LIN-STORE-9)
16. Not import governance (LIN-BOUNDARY-1)
17. Not emit events (LIN-BOUNDARY-4)

### 17.2 Compliance Verification

| Test Category | Description |
|---------------|-------------|
| Hash stability | Non-deterministic fields don't affect snapshotHash |
| Reproducibility | Same seal input + same store state → identical `PreparedLineageCommit` (including `worldId`, `edgeId`, `branchId`, all bootstrap fields) |
| Genesis determinism | Same `SealGenesisInput` → same genesis `branchId`, same bootstrap record, same `activeBranchId` |
| Prepare contract | Prepare does not mutate store; no wall-clock reads; no randomness |
| Error sorting | Same errors in different order → same snapshotHash |
| WorldId collision | No-op execution (same semantic content as base) → rejected; diamond convergence → rejected; different branches, same computed worldId, concurrent prepare+commit → at most one commit succeeds |
| Head advance | Failed World → head unchanged, DAG updated |
| BaseWorld validation | Pending requirements → rejected; failed → rejected |
| Branch creation | Non-existent headWorldId → rejected; failed headWorldId → rejected |
| Branch CAS | Concurrent seal to same branch → exactly one succeeds |
| Genesis | Failed snapshot → rejected; duplicate → rejected |
| Atomic commit | Crash mid-commit → nothing persisted |
| Resume | Active branch head → restorable snapshot |
| Branch switch | Source epoch increments; target unchanged; self-switch (target == current active) → rejected |
| Platform namespace | `$host`, `$mel` excluded from hash |
| Boundary | No governance imports; no events emitted |

---

## Appendix A: Rule Retagging Mapping

| Old (World SPEC) | New (Lineage SPEC) | Section |
|------------------|--------------------|---------|
| WORLD-ID-1~3 | LIN-ID-1~3 | §6.1 |
| SNAP-TYPE-1~6 | LIN-SNAP-1~4 | §5.5 |
| WORLD-HASH-1~11, 2a | LIN-HASH-1~11, 2a | §6.3 |
| WORLD-HASH-4a | LIN-HASH-4a | §6.3.3 |
| WORLD-HASH-4b | LIN-HASH-4b | §6.3.3 |
| WORLD-HASH-ERR-* | LIN-HASH-ERR-* | §6.4 |
| WORLD-HASH-PENDING-* | LIN-HASH-PENDING-* | §6.3.2 |
| WORLD-TERM-5 | LIN-HASH-TERM-5 | §6.3.3 |
| WORLD-TERM-STATUS-1~4 | (absorbed into LIN-SEAL-*, LIN-OUTCOME-*) | §6.2 |
| HASH-ENC-1~2 | LIN-ENC-1~2 | §6.5 |
| HASH-JSON-1 | LIN-JSON-1 | §6.5 |
| WORLD-SCHEMA-1 | LIN-SCHEMA-1 | §6.5 |
| HOST-DATA-3~6 | LIN-NS-1~3 | §5.6 |
| MEL-DATA-2~3 | LIN-NS-1~2 | §5.6 |
| OUTCOME-1~5 | LIN-OUTCOME-1~5 | §6.2 |
| WORLD-BASE-1 | LIN-BASE-2 | §9 |
| WORLD-BASE-2 | LIN-BASE-3 (strengthened to MUST NOT) | §9 |
| WORLD-BASE-3 | (→ GOV-BASE-1, Governance SPEC) | — |
| (new) | LIN-BASE-1 (existence check) | §9 |
| (new) | LIN-BASE-4 (schema match) | §9 |
| (new) | LIN-COLLISION-1~4 (worldId collision) | §8 |
| PERSIST-SNAP-* | LIN-PERSIST-SNAP-* | §11.3 |
| PERSIST-BASE-* | LIN-PERSIST-BASE-* | §11.4 |
| PERSIST-PATCH-* | LIN-PERSIST-PATCH-* | §11.5 |
| WORLD-LIN-1~4 | LIN-DAG-1~4 | §12 |
| REPLAY-1~3 | LIN-REPLAY-1~3 | §13 |
| HEAD-1~8 | LIN-HEAD-1~8 | §10.2 |
| RESUME-1~6 | LIN-RESUME-1~6 | §14 |
| RESUME-SCHEMA-1~3 | LIN-RESUME-SCHEMA-1~3 | §14.1 |
| BRANCH-PERSIST-1~5 | LIN-BRANCH-PERSIST-1~5 | §11.6 |
| BRANCH-RECOVER-1~3 | LIN-RECOVER-1~3 | §11.7 |
| INV-W1 | INV-L1 | §16.1 |
| INV-W2 | INV-L2 | §16.1 |
| INV-W4 | INV-L3 | §16.1 |
| INV-W5 | INV-L4 | §16.1 |
| INV-W6 | INV-L5 | §16.1 |
| INV-W7 | INV-L6 | §16.1 |
| INV-W8 | INV-L7 | §16.1 |
| INV-W9 | INV-L8 | §16.1 |
| INV-W10 | INV-L9 | §16.1 |
| INV-W11 | INV-L10 | §16.1 |
| INV-W12 | INV-L11 | §16.1 |
| INV-W13 | INV-L12 | §16.1 |
| INV-W14 | INV-L13 | §16.1 |
| INV-W15 | INV-L14 | §16.1 |
| INV-W16 | INV-L15 | §16.1 |
| INV-W17 | INV-L16 | §16.1 |
| INV-W18 | INV-L17 | §16.1 |
| INV-W19 | INV-L18 | §16.1 |
| INV-H1 | INV-L19 | §16.2 |
| INV-H2 | INV-L20 | §16.2 |
| INV-H3 | INV-L21 | §16.2 |

## Appendix B: Rule Summary

| Category | Key Rules |
|----------|-----------|
| Boundary | LIN-BOUNDARY-1~4 |
| WorldId | LIN-ID-1~3 |
| Snapshot Type | LIN-SNAP-1~4 |
| Platform Namespace | LIN-NS-1~3 |
| TerminalStatus | LIN-SEAL-1~3, LIN-OUTCOME-1~5 |
| SnapshotHash | LIN-HASH-1~11, 2a, LIN-HASH-TERM-5 |
| Error Hashing | LIN-HASH-ERR-1~4, 4a~4b, MSG-1~2, CTX-1 |
| PendingDigest | LIN-HASH-PENDING-1~2 |
| Hash Encoding | LIN-ENC-1~2, LIN-JSON-1 |
| Schema | LIN-SCHEMA-1 |
| Seal Protocol | LIN-SEAL-PURE-1, LIN-SEAL-4~6, LIN-BRANCH-SEAL-1~4 |
| Edge | LIN-EDGE-1~2 |
| WorldId Collision | LIN-COLLISION-1~4 |
| BaseWorld | LIN-BASE-1~4 |
| Head | LIN-HEAD-1~8, LIN-HEAD-ADV-1~4 |
| Branch ID | LIN-BRANCH-ID-1~2 |
| Bootstrap | LIN-BOOTSTRAP-1~8 |
| Branch Creation | LIN-BRANCH-CREATE-1~6 |
| Branch Switch | LIN-SWITCH-1~5 |
| Genesis | LIN-GENESIS-1~3 |
| DAG | LIN-DAG-1~4 |
| Replay | LIN-REPLAY-1~3 |
| Resume | LIN-RESUME-1~6, LIN-RESUME-SCHEMA-1~3 |
| Epoch | LIN-EPOCH-1~6 |
| Store | LIN-STORE-1~9 |
| Persistence | LIN-PERSIST-SNAP-1~4, LIN-PERSIST-BASE-1~2, LIN-PERSIST-PATCH-1~4 |
| Branch Persistence | LIN-BRANCH-PERSIST-1~5 |
| Crash Recovery | LIN-RECOVER-1~3 |
| Trace | LIN-TRACE-1~2 |

---

*End of Manifesto Lineage Protocol Specification*
