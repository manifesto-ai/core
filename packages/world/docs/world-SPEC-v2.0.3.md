# Manifesto World Protocol Specification v2.0.3

> **Status:** Active
> **Scope:** All Manifesto World Implementations
> **Compatible with:** Core SPEC v2.0.0, Host Contract v2.0.2, ARCHITECTURE v2.0
> **Implements:** ADR-001 (Layer Separation)
> **Authors:** Manifesto Team
> **License:** MIT
> **Changelog:**
> - v1.0: Initial release
> - v2.0: Host v2.0.1 Integration, Event-Loop Execution Model alignment
> - v2.0.1: ADR-001 Layer Separation - Event ownership, "Does NOT Know" boundary
> - **v2.0.2: Host-World Data Contract - `$host` namespace, deterministic hashing, baseSnapshot via WorldStore**
> - **v2.0.3: Platform Namespace Extension - `$mel` namespace for Compiler, unified platform namespace policy**

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Normative Language](#2-normative-language)
3. [Scope & Non-Goals](#3-scope--non-goals)
4. [Layering Model & Boundary](#4-layering-model--boundary)
5. [Core Entities & Identifiers](#5-core-entities--identifiers)
6. [Proposal Lifecycle](#6-proposal-lifecycle)
7. [Host Integration Contract](#7-host-integration-contract)
8. [World Event System](#8-world-event-system)
9. [Persistence Model](#9-persistence-model)
10. [Invariants](#10-invariants)
11. [Compliance](#11-compliance)

---

## 1. Purpose

This document defines the **Manifesto World Protocol v2.0.3**.

The World Protocol governs:
- **Who** may propose changes to a world (Actor)
- **How** proposals are judged (Authority)
- **What** record is kept of decisions (DecisionRecord)
- **How** worlds form a reproducible history (Lineage)

This protocol operates **above** Manifesto Core and Host:

| Layer | Responsibility | Does NOT Know |
|-------|---------------|---------------|
| **Core** | Computes semantic truth (pure) | IO, execution, governance |
| **Host** | Executes effects, applies patches | World, Proposal, Authority |
| **World Protocol** | Governs legitimacy, authority, lineage | Host internals, TraceEvent |
| **App** | Assembles layers, owns telemetry | Core internals, World constitution |

**v2.0.3 Focus**: Platform namespace extension (`$mel`), unified hash exclusion for `$host` and `$mel`, and baseSnapshot restoration via WorldStore.

This document is **normative**.

---

## 2. Normative Language

Key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are interpreted as described in RFC 2119.

---

## 3. Scope & Non-Goals

### 3.1 In Scope

| Area | Description |
|------|-------------|
| Intent-level governance | Actor → Proposal → Authority → Decision → Execution → World |
| Fork-only lineage | Branching without merge (v2.0) |
| Host v2.0.2 integration | ExecutionKey, canonical head, terminal snapshot |
| World Event System | Observability with non-interference constraints |
| Ingress/Execution staging | Cancellation semantics |

### 3.2 Explicit Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Patch-level authorization | World governs Intent approval only |
| Host internal job types | Mailbox/runner structure is Host's concern |
| Translator/Compiler pipeline | Deferred to App layer (Translator deprecated in v2) |
| Merge semantics | Fork-only in v2.0; merge is future extension |
| Effect execution details | Defined by Host Contract |
| UI/session management | App layer concern |

---

## 4. Layering Model & Boundary

### 4.1 Constitutional Boundary (v2.0.3)

Per **ADR-001** and **ARCHITECTURE v2.0**:

```
Core computes meaning.     (pure, deterministic)
Host executes reality.     (IO, effects, mailbox)
World governs legitimacy.  (governance, lineage, audit)
App assembles and absorbs. (integration, telemetry, UI)
```

### 4.2 World's "Does NOT Know" Boundary (v2.0.3)

**Explicit ignorance is constitutional.** World does NOT know:

| World Does NOT Know | Reason | Rule ID |
|--------------------|--------|---------|
| Host internal API (`dispatch`, `onTrace`) | Layer separation | WORLD-BOUNDARY-1 |
| TraceEvent structure | App transforms | WORLD-BOUNDARY-2 |
| Execution micro-steps | Telemetry is App's | WORLD-BOUNDARY-3 |
| How HostExecutor is implemented | Interface segregation | WORLD-BOUNDARY-4 |
| Effect execution details | Host's responsibility | WORLD-BOUNDARY-5 |

| Rule ID | Description |
|---------|-------------|
| WORLD-BOUNDARY-1 | World package MUST NOT depend on Host package |
| WORLD-BOUNDARY-2 | World MUST NOT subscribe to Host's onTrace |
| WORLD-BOUNDARY-3 | World MUST NOT assume specific TraceEvent types |
| WORLD-BOUNDARY-4 | World MUST interact with execution ONLY through HostExecutor interface |
| WORLD-BOUNDARY-5 | World MUST receive HostExecutor via injection |

### 4.3 Boundary Rules (MUST)

| Rule ID | Description |
|---------|-------------|
| WORLD-B1 | World MUST only request execution of **approved Intents** |
| WORLD-B2 | Host MUST NOT know World concepts (Proposal/Authority/Actor) |
| WORLD-B3 | World MUST NOT require Host to pause/resume for approval |
| WORLD-B4 | Host execution results are Snapshot only; World seals them as World/Lineage |

### 4.4 Boundary Diagram (v2.0.3)

```
┌─────────────────────────────────────────────────────────────────┐
│                           App                                   │
│                   (Composition Root)                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 runtime/ (internal)                       │  │
│  │         Host ↔ World Integration Layer                    │  │
│  │         - HostExecutor implementation                     │  │
│  │         - TraceEvent → Telemetry events                   │  │
│  │         - baseSnapshot retrieval (WorldStore)             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                   │
│              ┌──────────────┴──────────────┐                    │
│              ▼                              ▼                   │
│  ┌─────────────────────┐      ┌─────────────────────────────┐  │
│  │       World         │      │          Host               │  │
│  │   (Governance)      │      │       (Execution)           │  │
│  │                     │      │                             │  │
│  │ - Proposal lifecycle│      │ - ExecutionKey mailbox      │  │
│  │ - Actor/Authority   │      │ - run-to-completion         │  │
│  │ - DecisionRecord    │      │ - onTrace stream            │  │
│  │ - World/Lineage     │      │ - effect execution          │  │
│  │ - HostExecutor intf │      │                             │  │
│  │   (defines, not impl)│     │                             │  │
│  │                     │      │                             │  │
│  │  ┌───────────────┐  │      │  ┌───────────────────────┐  │  │
│  │  │     Core      │  │      │  │        Core           │  │  │
│  │  │  (Semantics)  │  │      │  │     (Semantics)       │  │  │
│  │  └───────────────┘  │      │  └───────────────────────┘  │  │
│  └─────────────────────┘      └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Key: World defines HostExecutor interface.
     App implements HostExecutor using Host.
     World never imports Host directly.
```

---

## 5. Core Entities & Identifiers

### 5.1 Identifier Types

```typescript
type WorldId = string;      // hash(schemaHash:snapshotHash)
type ProposalId = string;   // unique proposal identifier
type ActorId = string;      // unique actor identifier
type AuthorityId = string;  // unique authority identifier
type DecisionId = string;   // unique decision identifier
type ExecutionKey = string; // opaque to Host (FDR-W018)
```

### 5.2 World

A **World** is an immutable record representing a snapshot of reality.

```typescript
type World = {
  readonly worldId: WorldId;
  
  // Domain schema identity
  readonly schemaHash: string;
  
  // Hash of terminal snapshot content (deterministic subset)
  readonly snapshotHash: string;
  
  // Metadata (not part of identity)
  readonly createdAt: number;
  
  // Provenance
  readonly createdBy: ProposalId | null;  // null only for genesis
  // Parent lineage is tracked via WorldEdge (not embedded here)
  
  // Optional audit artifacts
  readonly executionTraceRef?: ArtifactRef;
};

type ArtifactRef = {
  readonly uri: string;
  readonly hash: string;
};
```

### 5.3 WorldId Computation (MUST)

| Rule ID | Description |
|---------|-------------|
| WORLD-ID-1 | WorldId MUST be computed as `computeHash({ schemaHash, snapshotHash })` |
| WORLD-ID-2 | Hash function MUST use JCS (RFC 8785) + SHA-256 (see §5.5.4) |
| WORLD-ID-3 | WorldId MUST NOT use string concatenation (e.g., `schemaHash + ':' + snapshotHash`) |

```typescript
// CORRECT: JCS-based object hash
worldId = computeHash({ schemaHash, snapshotHash });

// FORBIDDEN: String concatenation (ambiguous encoding)
// worldId = SHA256(`${schemaHash}:${snapshotHash}`);  // ❌ DO NOT USE
```

**Rationale:** String concatenation creates ambiguity—some implementations might apply JCS to the string (adding quotes), others might not. Using a JSON object ensures all implementations produce identical bytes via JCS.

### 5.4 Snapshot Type Dependency (Normative)

In this specification, `Snapshot` refers to the **Manifesto Core Snapshot** shape.

**World MUST NOT redefine Snapshot types.** Instead, World imports Core's canonical types.

```typescript
// World imports from Core (NOT redefined here)
import type { Snapshot, SystemState, SnapshotMeta, ErrorValue } from '@manifesto-ai/core';

// ============================================================
// AUTHORITATIVE DEFINITION - Core SPEC v2.0.0
// ============================================================
// type Snapshot<TData = unknown> = {
//   readonly data: TData;
//   readonly computed: Record<string, unknown>;
//   readonly system: SystemState;
//   readonly input: unknown;
//   readonly meta: SnapshotMeta;
// };
//
// type SystemState = {
//   readonly status: 'idle' | 'computing' | 'pending' | 'error';
//   readonly lastError: ErrorValue | null;  // Current error state
//   readonly errors: readonly ErrorValue[];  // Error HISTORY (accumulated)
//   readonly pendingRequirements: readonly Requirement[];
//   readonly currentAction: string | null;
// };
//
// type ErrorValue = {
//   readonly code: string;
//   readonly message: string;
//   readonly source: { readonly actionId: string; readonly nodePath: string };
//   readonly timestamp: number;
//   readonly context?: Record<string, unknown>;
// };
//
// NOTE: Platform-owned state (e.g., intentSlots, guard state) is in data.$host or data.$mel, NOT in system.*
// ============================================================
```

| Rule ID | Description |
|---------|-------------|
| SNAP-TYPE-1 | World MUST import Snapshot types from Core (not redefine) |
| SNAP-TYPE-2 | HostExecutor MUST return terminal Snapshot conforming to Core shape |
| SNAP-TYPE-3 | World MUST NOT assume specific `system.status` values (Core-owned vocabulary) |
| SNAP-TYPE-4 | World determines terminal state via `lastError` and `pendingRequirements` |
| SNAP-TYPE-5 | `system.errors` is HISTORY (accumulated); `system.lastError` is CURRENT state |
| SNAP-TYPE-6 | Platform-owned state (e.g., intentSlots, guard state) is in `data.$host` or `data.$mel`, NOT in `system.*` |

**Rationale**:
- `system.status` vocabulary is Core-owned; values may evolve without World SPEC changes.
- `system.errors` is accumulated history—using `errors.length > 0` would permanently mark recovered snapshots.
- `system.lastError` represents current error state (null when no active error).
- World's terminal determination uses `lastError == null && pendingRequirements.length === 0`.

---

### 5.5 SnapshotHash Computation (MUST)

To ensure reproducibility, `snapshotHash` computation follows strict rules.

#### 5.5.1 Hash Input Structure

```typescript
/**
 * Terminal status for hash: normalized to exactly two values.
 * This ensures consistent hashing regardless of Core's raw status vocabulary.
 */
type TerminalStatusForHash = 'completed' | 'failed';

type SnapshotHashInput = {
  readonly data: Snapshot['data'];
  readonly system: {
    readonly terminalStatus: TerminalStatusForHash;  // Normalized, NOT raw status
    readonly errors: readonly ErrorSignature[];  // Normalized + sorted (see 5.5.3)
    readonly pendingDigest: string;  // Safety for WORLD-TERM violation cases
  };
};

/**
 * Derive normalized terminal status for hashing.
 * World does NOT match specific status strings (Core-owned vocabulary).
 * 
 * CRITICAL: Core's `system.errors` is a HISTORY (accumulated array).
 * Using `errors.length > 0` would permanently mark any snapshot that
 * ever had an error as 'error', even after recovery.
 * 
 * Instead, we use `system.lastError` which represents CURRENT error state.
 */
function deriveTerminalStatusForHash(
  snapshot: Snapshot
): TerminalStatusForHash {
  // Current error state → 'failed' (lastError is non-null)
  if (snapshot.system.lastError != null) {
    return 'failed';
  }
  // Non-empty pending → 'failed' (WORLD-TERM-1 violation)
  if (snapshot.system.pendingRequirements.length > 0) {
    return 'failed';
  }
  // Otherwise → 'completed'
  return 'completed';
}
```

| Rule ID | Description |
|---------|-------------|
| WORLD-TERM-STATUS-1 | World MUST NOT match specific `system.status` string values |
| WORLD-TERM-STATUS-2 | World determines error state via `system.lastError != null` (NOT `errors.length`) |
| WORLD-TERM-STATUS-3 | World determines incomplete state via `pendingRequirements.length > 0` |
| WORLD-TERM-STATUS-4 | `system.errors` is history (accumulated); `lastError` is current state |

```typescript
/**
 * Compute pendingDigest for hash input.
 * - Normal terminal: empty array → constant digest
 * - Violation case: non-empty → unique digest prevents collision
 * 
 * MUST use computeHash (JCS-based) for consistency.
 */
function computePendingDigest(pending: readonly Requirement[]): string {
  if (pending.length === 0) {
    return 'empty';  // Constant for normal case
  }
  // Violation case: JCS-based hash of sorted requirement IDs
  const sortedIds = pending.map(r => r.id).sort();
  return computeHash({ pendingIds: sortedIds });  // JCS-based, NOT string join
}
```

| Rule ID | Description |
|---------|-------------|
| WORLD-HASH-PENDING-1 | pendingDigest MUST use `computeHash()` (JCS-based) |
| WORLD-HASH-PENDING-2 | pendingDigest MUST NOT use string concatenation/join |

**Rationale**:
- Core's `system.errors` is an accumulated history array, not current error state.
- Using `errors.length > 0` would permanently mark recovered snapshots as failed.
- `system.lastError` represents current error state (null when no active error).
- To ensure WorldId consistency, we normalize to exactly two values: `completed` or `failed`.
- This aligns with World's outcome model (`'completed' | 'failed'`) and Host's `HostExecutionResult.outcome` while ensuring hash determinism.

#### 5.5.2 Inclusion/Exclusion Rules

| Field | Included | Reason | Rule ID |
|-------|----------|--------|---------|
| `snapshot.data` (excluding `$host`, `$mel`) | ✅ MUST | Domain state | WORLD-HASH-1 |
| `system.terminalStatus` | ✅ MUST | Normalized terminal status | WORLD-HASH-2 |
| `system.errors` (full history) | ✅ MUST | Error lineage (see rationale below) | WORLD-HASH-3 |
| `system.pendingDigest` | ✅ MUST | Collision prevention for violations | WORLD-HASH-11 |
| Raw `system.status` | ❌ MUST NOT | Use terminalStatus instead | WORLD-HASH-2a |
| `system.currentAction` | ❌ MUST NOT | Transient execution state | WORLD-HASH-4 |
| **`data.$host.*`** | ❌ **MUST NOT** | **Host-owned transient state (WorldId divergence risk)** | **WORLD-HASH-4a** |
| **`data.$mel.*`** | ❌ **MUST NOT** | **Compiler-owned internal state (guard markers, etc.)** | **WORLD-HASH-4b** |
| `meta.version` | ❌ MUST NOT | Core-owned versioning | WORLD-HASH-5 |
| `meta.timestamp` | ❌ MUST NOT | Non-deterministic | WORLD-HASH-6 |
| `meta.randomSeed` | ❌ MUST NOT | Derived from intentId | WORLD-HASH-7 |
| `meta.schemaHash` | ❌ MUST NOT | Already in WorldId | WORLD-HASH-8 |
| `computed` | ❌ SHOULD NOT | Re-derivable | WORLD-HASH-9 |
| `input` | ❌ SHOULD NOT | Transient | WORLD-HASH-10 |

**Rationale for `system.errors` (full history) inclusion:**

Including the **full error history** (not just `lastError`) is an **intentional design choice**:
- Two executions that reach the same final `data` but encountered different errors along the way represent **different lineages**.
- This supports auditability: "this World experienced errors X, Y, Z during execution" is part of its identity.
- If only `lastError` were used, recovered errors would be invisible to World identity.
- **Trade-off acknowledged**: Same `data` + different error history = different WorldId.

If an implementation prefers "current state only" identity (ignoring recovered errors), it may exclude `system.errors` and use only `system.lastError`, but MUST document this deviation from the normative SPEC.

| Rule ID | Description |
|---------|-------------|
| WORLD-HASH-1 | `snapshot.data` MUST be included, **excluding `$host` and `$mel` namespaces** |
| WORLD-HASH-2a | snapshotHash MUST use `terminalStatus` (normalized), NOT raw `system.status` |
| **WORLD-HASH-4a** | **`data.$host` MUST NOT be included in hash (prevents WorldId divergence)** |
| **WORLD-HASH-4b** | **`data.$mel` MUST NOT be included in hash (prevents WorldId divergence)** |
| WORLD-TERM-5 | `terminalStatus` for hash MUST be exactly `'completed'` or `'failed'` |

#### 5.5.3 Error Normalization (MUST)

Errors included in `snapshotHash` MUST be normalized to exclude non-deterministic fields.

```typescript
/**
 * ErrorSignature: Deterministic subset of ErrorValue for hashing.
 * 
 * CRITICAL: `message` and `timestamp` are EXCLUDED (non-deterministic).
 * Only `code`, `source`, and deterministic `context` are included.
 * 
 * source structure matches Core's ErrorValue.source exactly.
 */
type ErrorSignature = {
  readonly code: string;
  readonly source: {
    readonly actionId: string;
    readonly nodePath: string;
  };
  readonly context?: Record<string, unknown>;  // deterministic subset only
  // NOTE: `message` and `timestamp` are intentionally EXCLUDED
};

/**
 * Convert Core's ErrorValue to hash-safe ErrorSignature.
 * message and timestamp are NOT included.
 */
function toErrorSignature(error: ErrorValue): ErrorSignature {
  return {
    code: error.code,
    source: {
      actionId: error.source.actionId,
      nodePath: error.source.nodePath,
    },
    context: error.context ? normalizeContext(error.context) : undefined,
    // message and timestamp intentionally omitted (WORLD-HASH-ERR-MSG-1)
  };
}

/**
 * Normalize context to deterministic subset.
 * Remove any runtime-variable values.
 */
function normalizeContext(ctx: Record<string, unknown>): Record<string, unknown> | undefined {
  // Implementation filters out non-deterministic values
  // (e.g., timestamps, memory addresses, locale strings)
  const normalized = filterDeterministicValues(ctx);
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/**
 * Compute deterministic sort key for ErrorSignature.
 * 
 * CRITICAL: Using JCS string comparison directly has Unicode edge cases
 * that can differ across languages/runtimes.
 * 
 * Solution: Use computeHash(ErrorSignature) as sort key.
 * - Output is always 64-character lowercase hex (ASCII only)
 * - Comparison is trivially deterministic across all languages
 * - No UTF-8/UTF-16 encoding ambiguity
 */
function errorSortKey(e: ErrorSignature): string {
  return computeHash(e);  // 64-char lowercase hex string
}

/**
 * Sort errors deterministically for hashing.
 * Sort key is hash of ErrorSignature (ASCII hex), ensuring
 * cross-language/cross-runtime consistency.
 */
function sortErrorSignatures(errors: ErrorSignature[]): ErrorSignature[] {
  return [...errors].sort((a, b) => {
    const keyA = errorSortKey(a);
    const keyB = errorSortKey(b);
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
}
```

| Rule ID | Description |
|---------|-------------|
| WORLD-HASH-ERR-1 | Errors in snapshotHash MUST use ErrorSignature (normalized) |
| WORLD-HASH-ERR-2 | ErrorSignature MUST NOT include timestamp |
| WORLD-HASH-ERR-3 | ErrorSignature MUST NOT include stack traces |
| WORLD-HASH-ERR-4 | ErrorSignature[] MUST be sorted deterministically before hashing |
| WORLD-HASH-ERR-4a | Sort key MUST be `computeHash(ErrorSignature)` (64-char hex) |
| WORLD-HASH-ERR-4b | Sort key comparison is simple ASCII string comparison (hex chars only) |
| WORLD-HASH-ERR-4c | This eliminates UTF-8/UTF-16/locale comparison ambiguity |
| **WORLD-HASH-ERR-MSG-1** | **ErrorSignature MUST NOT include `message` field (non-deterministic)** |
| WORLD-HASH-ERR-MSG-2 | Error identification relies on `code` + `source` + `context` only |
| WORLD-HASH-ERR-CTX-1 | `context` MUST only include deterministic values (no timestamps, addresses, locale strings) |

#### 5.5.4 Hash Computation

```typescript
snapshotHash = SHA256(JCS(snapshotHashInput));
// JCS = JSON Canonicalization Scheme (RFC 8785)
```

**Interoperability Requirements:**

| Rule ID | Description |
|---------|-------------|
| HASH-ENC-1 | SHA256 input MUST be UTF-8 encoded bytes of JCS output |
| HASH-ENC-2 | Hash output MUST be represented as lower-case hexadecimal string |
| HASH-JSON-1 | Hash input MUST be JSON-serializable (no `undefined`, `BigInt`, `NaN`, `Infinity`, `function`) |
| WORLD-SCHEMA-1 | `world.schemaHash` MUST equal `snapshot.meta.schemaHash` |

**Hash Computation Algorithm (Normative):**

```typescript
/**
 * Compute SHA256 hash with interoperability guarantees.
 */
function computeHash(input: unknown): string {
  // 1. Canonicalize to JSON string (RFC 8785)
  const canonicalJson: string = JCS(input);
  
  // 2. Encode to UTF-8 bytes (HASH-ENC-1)
  const utf8Bytes: Uint8Array = new TextEncoder().encode(canonicalJson);
  
  // 3. Compute SHA256
  const hashBytes: Uint8Array = SHA256(utf8Bytes);
  
  // 4. Output as lower-case hex (HASH-ENC-2)
  return Array.from(hashBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Usage:
snapshotHash = computeHash(snapshotHashInput);
worldId = computeHash({ schemaHash, snapshotHash });  // JCS object, NOT string
```

**schemaHash Validation (WORLD-SCHEMA-1):**

```typescript
async function createWorldFromExecution(
  proposal: Proposal,
  result: HostExecutionResult,
  schemaHash: string
): Promise<World> {
  // Validate schemaHash consistency (WORLD-SCHEMA-1)
  if (schemaHash !== result.terminalSnapshot.meta.schemaHash) {
    throw new Error(
      `WORLD-SCHEMA-1 violation: provided schemaHash (${schemaHash}) ` +
      `does not match snapshot.meta.schemaHash (${result.terminalSnapshot.meta.schemaHash})`
    );
  }
  // ... rest of implementation
}
```

### 5.6 Actor

```typescript
type ActorKind = 'human' | 'agent' | 'system';

type ActorRef = {
  readonly actorId: ActorId;
  readonly kind: ActorKind;
  readonly name?: string;
  readonly meta?: Record<string, unknown>;
};
```

| Rule ID | Description |
|---------|-------------|
| ACTOR-1 | All actors (human, agent, system) are first-class citizens |
| ACTOR-2 | Actor identity MUST be stable across proposals |

### 5.6 Authority

```typescript
type AuthorityKind = 'auto' | 'human' | 'policy' | 'tribunal';

type AuthorityRef = {
  readonly authorityId: AuthorityId;
  readonly kind: AuthorityKind;
  readonly name?: string;
};

type AuthorityPolicy =
  | { readonly mode: 'auto_approve' }
  | { readonly mode: 'hitl'; readonly delegate: ActorRef }
  | { readonly mode: 'policy_rules'; readonly rules: unknown }
  | { readonly mode: 'tribunal'; readonly members: ActorRef[] };
```

### 5.7 Actor-Authority Binding

```typescript
type ActorAuthorityBinding = {
  readonly actorId: ActorId;
  readonly authorityId: AuthorityId;
  readonly policy: AuthorityPolicy;
};
```

| Rule ID | Description |
|---------|-------------|
| BIND-1 | Each Actor MUST have exactly one Authority binding |
| BIND-2 | Multiple Actors MAY share the same Authority |

---

## 6. Proposal Lifecycle

### 6.1 Intent

```typescript
type Intent = {
  readonly type: string;
  readonly intentId: string;  // stable within execution attempt
  readonly input?: unknown;
};
```

### 6.2 Proposal

```typescript
type ProposalStatus =
  // Ingress Stage (epoch-droppable)
  | 'submitted'
  | 'evaluating'
  // Decision Boundary
  | 'approved'
  | 'rejected'
  // Execution Stage (must run to terminal)
  | 'executing'
  // Terminal
  | 'completed'
  | 'failed';

type Proposal = {
  readonly proposalId: ProposalId;
  readonly baseWorld: WorldId;
  
  readonly actorId: ActorId;
  readonly authorityId: AuthorityId;
  
  readonly intent: Intent;
  readonly status: ProposalStatus;
  
  // ExecutionKey (v2.0)
  readonly executionKey: ExecutionKey;
  
  // Timestamps
  readonly submittedAt: number;
  readonly decidedAt?: number;
  readonly completedAt?: number;
  
  // Decision reference
  readonly decisionId?: DecisionId;
  
  // Epoch for ingress cancellation (v2.0)
  readonly epoch: number;
  
  // Terminal result
  readonly resultWorld?: WorldId;
};
```

### 6.3 DecisionRecord

```typescript
type FinalDecision =
  | { readonly kind: 'approved' }
  | { readonly kind: 'rejected'; readonly reason?: string };

type DecisionRecord = {
  readonly decisionId: DecisionId;
  readonly proposalId: ProposalId;
  readonly authorityId: AuthorityId;
  readonly decision: FinalDecision;
  readonly decidedAt: number;
};
```

| Rule ID | Description |
|---------|-------------|
| DECISION-1 | DecisionRecord is created ONLY for terminal decisions (approved/rejected) |
| DECISION-2 | `evaluating` status MUST NOT create DecisionRecord |

### 6.4 Ingress vs Execution Stage (v2.0)

| Stage | Statuses | Cancellation | World Creation |
|-------|----------|--------------|----------------|
| **Ingress** | `submitted`, `evaluating` | Safe to drop (epoch-based) | None |
| **Execution** | `approved`, `executing` | MUST run to terminal | Always |
| **Terminal** | `completed`, `failed`, `rejected` | N/A | Yes (except rejected) |

| Rule ID | Description |
|---------|-------------|
| WORLD-STAGE-1 | `submitted` and `evaluating` are Ingress stage |
| WORLD-STAGE-2 | `approved`, `executing`, `completed`, `failed` are Execution stage or terminal |
| WORLD-STAGE-3 | Ingress-stage proposals MAY be dropped on branch switch (epoch-based) |
| WORLD-STAGE-4 | Execution-stage proposals MUST NOT be dropped; MUST reach terminal |
| WORLD-STAGE-5 | `rejected` is terminal in Ingress stage (no World created) |
| WORLD-STAGE-6 | Late-arriving evaluating/decision results for stale (old epoch) proposals MUST NOT be applied to current branch |

### 6.5 State Machine

```
                    ┌─────────────────────────────────────┐
                    │         INGRESS STAGE               │
                    │                                     │
   submitProposal() │   submitted                         │
        ────────────┼──────►│                             │
                    │       │ routeToAuthority()          │
                    │       ▼                             │
                    │   evaluating ─────────────────┬─────┼───► rejected
                    │       │                       │     │     (terminal, no World)
                    └───────┼───────────────────────┼─────┘
                            │ approve()             │ reject()
  ══════════════════════════╪═══════════════════════╧═══════════  COMMITMENT BOUNDARY
                            │                                      (DecisionRecord created)
                    ┌───────┼─────────────────────────────┐
                    │       ▼    EXECUTION STAGE          │
                    │   approved                          │
                    │       │ startExecution()            │
                    │       ▼                             │
                    │   executing                         │
                    │       │                             │
                    │       ├───────────────────┬─────────┤
                    │       │ success           │ failure │
                    │       ▼                   ▼         │
                    │   completed            failed       │
                    │   (World created)      (World created)
                    └─────────────────────────────────────┘
```

### 6.6 Status Transition Rules

| From | To | Trigger | DecisionRecord? |
|------|-----|---------|-----------------|
| `submitted` | `evaluating` | routeToAuthority() | No |
| `submitted` | `rejected` | immediate rejection | Yes |
| `evaluating` | `approved` | Authority approves | Yes |
| `evaluating` | `rejected` | Authority rejects | Yes |
| `approved` | `executing` | startExecution() | No |
| `executing` | `completed` | Host returns success | No |
| `executing` | `failed` | Host returns failure | No |

| Rule ID | Description |
|---------|-------------|
| TRANS-1 | Status transitions MUST be monotonic (never reverse) |
| TRANS-2 | Only `evaluating → approved` and `evaluating → rejected` (or `submitted → rejected`) create DecisionRecord |

### 6.7 Epoch-based Ingress Cancellation (v2.0)

```typescript
interface IngressContext {
  readonly epoch: number;
  incrementEpoch(): void;
  isStale(proposalEpoch: number): boolean;
}

// On branch switch
function onBranchSwitch(newBranch: WorldId): void {
  ingressContext.incrementEpoch();
  // Ingress-stage proposals with old epoch: safe to drop
  // Execution-stage proposals: MUST continue to terminal
}
```

| Rule ID | Description |
|---------|-------------|
| EPOCH-1 | Each Proposal MUST record its epoch at submission |
| EPOCH-2 | Branch switch MUST increment epoch |
| EPOCH-3 | Ingress-stage proposals with stale epoch MAY be dropped |
| EPOCH-4 | Late-arriving results for stale proposals MUST be discarded |
| EPOCH-5 | `proposal:superseded` event MAY be emitted for dropped proposals |

---

## 7. Host Integration Contract

### 7.1 HostExecutor Interface

World interacts with Host through the `HostExecutor` abstraction.

### 7.1 HostExecutor Interface (v2.0.3)

Per **ADR-001** and **FDR-W028**:

> **World defines the interface; App implements it.**

```typescript
/**
 * HostExecutor: The contract through which World accesses execution.
 * 
 * Ownership:
 * - DEFINED BY: World (this specification)
 * - IMPLEMENTED BY: App (Composition Root)
 * 
 * World declares what it needs; App fulfills using Host.
 * World never sees Host internals.
 */
interface HostExecutor {
  /**
   * Execute an intent against a base snapshot under an ExecutionKey.
   * 
   * Contract:
   * - ExecutionKey is opaque to Host (WORLD-EXK-3)
   * - Host serializes via mailbox per ExecutionKey (Host H018)
   * - Returns terminal snapshot (completed or failed)
   * - World receives ONLY the result, not process details
   */
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: HostExecutionOptions
  ): Promise<HostExecutionResult>;
}

type HostExecutionOptions = {
  readonly approvedScope?: unknown;  // Optional scope guard
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};

type HostExecutionResult = {
  /**
   * Convenience hint from App. World MUST verify via deriveOutcome(terminalSnapshot).
   * This field exists for fast-path optimization; World's deriveOutcome() is authoritative.
   */
  readonly outcome: 'completed' | 'failed';
  readonly terminalSnapshot: Snapshot;
  readonly traceRef?: ArtifactRef;
  readonly error?: ErrorValue;  // Core's ErrorValue type
};
```

| Rule ID | Description |
|---------|-------------|
| WORLD-HEXEC-1 | World MUST define HostExecutor interface (this SPEC) |
| WORLD-HEXEC-2 | World MUST NOT implement HostExecutor |
| WORLD-HEXEC-3 | App MUST implement HostExecutor using Host |
| WORLD-HEXEC-4 | World MUST receive HostExecutor via injection |
| WORLD-HEXEC-5 | World MUST NOT import Host internal types |
| **WORLD-HEXEC-6** | **World's `deriveOutcome(terminalSnapshot)` is authoritative; `result.outcome` is advisory** |

**App Implementation Pattern (informative):**

Note: method names depend on Host implementation; example uses v2 mailbox APIs
(`seedSnapshot`, `submitIntent`, `drain`) for clarity.

```typescript
// In App (NOT in World)
class AppHostExecutor implements HostExecutor {
  constructor(
    private host: Host,
    private telemetryEmitter: TelemetryEmitter
  ) {}
  
  async execute(key, baseSnapshot, intent, opts): Promise<HostExecutionResult> {
    // Host is created with onTrace callback; App transforms TraceEvent → telemetry
    this.host.seedSnapshot(key, baseSnapshot);
    this.host.submitIntent(key, intent);

    // Drain mailbox to terminal (Host internal mechanics)
    await this.host.drain(key);

    const terminalSnapshot = this.host.getContextSnapshot(key) ?? baseSnapshot;

    // Return only the result (World sees only this)
    return {
      outcome: this.deriveOutcome(terminalSnapshot),
      terminalSnapshot,
      traceRef: this.flushTraceIfEnabled(),
    };
  }
}
```

### 7.2 ExecutionKey Contract (v2.0)

| Rule ID | Description |
|---------|-------------|
| WORLD-EXK-1 | World MUST determine executionKey for each Proposal before execution |
| WORLD-EXK-2 | executionKey MUST be fixed in Proposal record (immutable once set) |
| WORLD-EXK-3 | Host MUST treat executionKey as opaque |
| WORLD-EXK-4 | World MAY map multiple proposals to the same executionKey to enforce serialization policy |
| WORLD-EXK-5 | The default policy is RECOMMENDED: `executionKey = ${proposalId}:1` |

**ExecutionKey Policy Context (informative):**

```typescript
type ExecutionKeyContext = {
  readonly proposalId: ProposalId;
  readonly actorId: string;
  readonly baseWorld: WorldId;
  readonly attempt: number;
};

type ExecutionKeyPolicy = (ctx: ExecutionKeyContext) => ExecutionKey;
```

**Policy Examples:**

```typescript
// Default: Each proposal gets its own mailbox (parallel)
const defaultPolicy = ({ proposalId, attempt }) =>
  `${proposalId}:${attempt}`;

// Actor serialization: Same actor's proposals serialize
const actorSerialPolicy = ({ actorId, attempt }) =>
  `actor:${actorId}:${attempt}`;

// Base serialization: Proposals from same base serialize
const baseSerialPolicy = ({ baseWorld, attempt }) =>
  `base:${baseWorld}:${attempt}`;
```

### 7.3 Outcome Derivation (v2.0.3)

World derives `outcome` from Host's terminal snapshot.
World does NOT match specific `system.status` values (Core-owned vocabulary).

**CRITICAL:** Core's `system.errors` is accumulated history, NOT current error state.
Use `system.lastError` for current error determination.

```typescript
function deriveOutcome(terminalSnapshot: Snapshot): 'completed' | 'failed' {
  // Current error state → 'failed' (lastError is non-null)
  if (terminalSnapshot.system.lastError != null) {
    return 'failed';
  }
  
  // WORLD-TERM-1: pendingRequirements must be empty
  if (terminalSnapshot.system.pendingRequirements.length > 0) {
    return 'failed';
  }
  
  return 'completed';
}
```

| Rule ID | Description |
|---------|-------------|
| OUTCOME-1 | `outcome` is World-level derived value, not Core's `system.status` |
| OUTCOME-2 | `system.lastError != null` implies `outcome: 'failed'` |
| OUTCOME-3 | Non-empty `pendingRequirements` implies `outcome: 'failed'` (WORLD-TERM-1) |
| OUTCOME-4 | World MUST NOT match specific `system.status` string values |
| OUTCOME-5 | World MUST NOT use `system.errors.length` for failure determination (it's history) |

### 7.4 Terminal Snapshot Validity (v2.0)

| Rule ID | Description |
|---------|-------------|
| WORLD-TERM-1 | Terminal snapshot MUST have empty `pendingRequirements` |
| WORLD-TERM-2 | Non-empty pendingRequirements MUST result in `outcome: 'failed'` |
| WORLD-TERM-3 | Failed execution still creates World (FDR-W012) |
| WORLD-TERM-4 | `execution:failed` event SHOULD include pending requirement IDs |

### 7.5 BaseWorld Validity (v2.0)

| Rule ID | Description |
|---------|-------------|
| WORLD-BASE-1 | World with non-empty `pendingRequirements` MUST NOT be used as baseWorld |
| WORLD-BASE-2 | Only `completed` Worlds SHOULD be used as baseWorld |
| WORLD-BASE-3 | Using `failed` World as baseWorld is NOT RECOMMENDED |

### 7.6 Re-entry Model Alignment

| Rule ID | Description |
|---------|-------------|
| WORLD-RE-1 | World MUST NOT assume Host execution is a single compute |
| WORLD-RE-2 | intentId MUST remain stable throughout execution attempt |
| WORLD-RE-3 | World MUST NOT require Host to pause for mid-execution approval |

### 7.7 Context Determinism Alignment (v2.0)

| Rule ID | Description |
|---------|-------------|
| WORLD-CTX-1 | randomSeed is derived from intentId (Host H023) |
| WORLD-CTX-2 | World MUST NOT inject `now` or `randomSeed` to Host |
| WORLD-CTX-3 | Trace storage MUST include frozen context per job for replay |

### 7.8 World Creation Algorithm

```typescript
/**
 * Strip platform-reserved namespaces from data before hashing.
 * WORLD-HASH-4a: data.$host MUST NOT be included in hash.
 * WORLD-HASH-4b: data.$mel MUST NOT be included in hash.
 */
function stripPlatformNamespaces<T extends Record<string, unknown>>(
  data: T
): Omit<T, '$host' | '$mel'> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const { $host, $mel, ...rest } = data;
    return rest as Omit<T, '$host' | '$mel'>;
  }
  return data;
}

async function createWorldFromExecution(
  proposal: Proposal,
  result: HostExecutionResult,
  schemaHash: string
): Promise<World> {
  const snapshot = result.terminalSnapshot;
  
  // Derive outcome for proposal status
  const outcome = deriveOutcome(snapshot);
  
  // Derive normalized terminal status for hash (WORLD-HASH-2a, WORLD-TERM-5)
  const terminalStatus = deriveTerminalStatusForHash(snapshot);
  
  // Normalize and sort errors for hashing (WORLD-HASH-ERR-1, WORLD-HASH-ERR-4)
  const normalizedErrors = sortErrorSignatures(
    snapshot.system.errors.map(toErrorSignature)
  );
  
  // Compute pendingDigest (WORLD-HASH-11, WORLD-HASH-PENDING-1)
  const pendingDigest = computePendingDigest(
    snapshot.system.pendingRequirements
  );
  
  // Compute snapshotHash (deterministic, JCS-based)
  // WORLD-HASH-4a, WORLD-HASH-4b: MUST exclude data.$host and data.$mel from hash
  const hashInput: SnapshotHashInput = {
    data: stripPlatformNamespaces(snapshot.data),  // ← $host, $mel excluded
    system: {
      terminalStatus,  // Normalized, NOT raw status
      errors: normalizedErrors,
      pendingDigest,
    },
  };
  const snapshotHash = computeHash(hashInput);  // JCS-based
  
  // Compute worldId (WORLD-ID-1: JCS object, NOT string concatenation)
  const worldId = computeHash({ schemaHash, snapshotHash });
  
  return {
    worldId,
    schemaHash,
    snapshotHash,
    createdAt: Date.now(),
    createdBy: proposal.proposalId,
    executionTraceRef: result.traceRef,  // Optional audit artifact
  };
}
```

### 7.9 Host-World Data Contract (v2.0.3)

This section defines the **explicit data contract** between Host and World layers for snapshot data structure.

#### 7.9.1 Platform-Reserved Namespaces

Platform components store internal state in reserved namespaces within `snapshot.data`. These namespaces are excluded from World hash computation to ensure semantic equivalence.

| Namespace | Owner | Purpose | Hash Inclusion |
|-----------|-------|---------|----------------|
| `$host` | Host | Error bookkeeping, intent slots, execution context | ❌ Excluded |
| `$mel` | Compiler | Guard state, compiler-generated internal slots | ❌ Excluded |

**Convention:** All `$`-prefixed keys in `snapshot.data` are platform-reserved. Domain schemas MUST NOT use keys starting with `$`.

```typescript
/**
 * Host-owned namespace within snapshot.data
 *
 * Host uses this namespace to store:
 * - Intent slot state (intentSlots)
 * - Execution context
 * - Other Host-managed transient state
 *
 * This namespace is:
 * - WRITTEN BY: Host (during execution)
 * - READ BY: Host (for re-entry continuity)
 * - EXCLUDED BY: World (from snapshotHash computation)
 */
type HostNamespace = {
  readonly intentSlots?: Record<string, IntentSlotState>;
  // Future: other Host-managed state
};

/**
 * Compiler-owned namespace within snapshot.data
 *
 * Compiler-generated flows use this namespace to store:
 * - Guard state for once/onceIntent semantics
 */
type MelNamespace = {
  readonly guards?: {
    readonly intent?: Record<string, string>;
  };
};

// Convention: platform namespaces live under data.$host and data.$mel
type SnapshotData = {
  readonly $host?: HostNamespace;  // Host-owned, World-excluded
  readonly $mel?: MelNamespace;    // Compiler-owned, World-excluded
  // ... domain state (World-owned for hashing)
};
```

#### 7.9.2 Rationale

| Concern | Solution |
|---------|----------|
| Host needs persistent execution context | Store in `data.$host` |
| Compiler needs guard continuity | Store in `data.$mel` |
| World hash must be deterministic | Exclude `data.$host` and `data.$mel` from hash |
| Semantic state must be separated | Platform namespaces are non-semantic |
| Cross-replay consistency | Same semantic state = same WorldId |

**Why not `system.$host`?**
- `system.*` is Core-owned vocabulary (status, errors, pendingRequirements)
- Host should not pollute Core's namespace
- `data.$host` clearly signals "Host's data within snapshot"
- `data.$mel` isolates compiler-internal state from domain semantics

#### 7.9.3 Contract Rules (v2.0.3)

| Rule ID | Description |
|---------|-------------|
| HOST-DATA-1 | Host MUST store its internal state under `data.$host` namespace |
| HOST-DATA-2 | Host MUST NOT store internal state in `system.*` namespace |
| HOST-DATA-3 | World MUST exclude `data.$host` from snapshotHash computation (WORLD-HASH-4a) |
| HOST-DATA-4 | World MUST NOT interpret or depend on `data.$host` contents |
| HOST-DATA-5 | App MAY read `data.$host` for debugging/telemetry purposes |
| HOST-DATA-6 | All `$`-prefixed keys are reserved; domain schemas MUST NOT use them |
| MEL-DATA-1 | Compiler MUST store guard state under `data.$mel.guards.*` namespace |
| MEL-DATA-2 | World MUST exclude `data.$mel` from snapshotHash computation (WORLD-HASH-4b) |
| MEL-DATA-3 | World MUST NOT interpret or depend on `data.$mel` contents |

#### 7.9.4 Implementation

```typescript
/**
 * Strip platform-reserved namespaces from data before hashing.
 * WORLD-HASH-4a + HOST-DATA-3: data.$host MUST NOT be included in hash.
 * WORLD-HASH-4b + MEL-DATA-2: data.$mel MUST NOT be included in hash.
 */
function stripPlatformNamespaces<T extends Record<string, unknown>>(
  data: T
): Omit<T, '$host' | '$mel'> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const { $host, $mel, ...rest } = data;
    return rest as Omit<T, '$host' | '$mel'>;
  }
  return data;
}
```

#### 7.9.5 Cross-Reference

| Layer | Responsibility | Platform Namespace Access |
|-------|---------------|---------------------------|
| **Host** | Write intent slots, execution context | Read/Write `$host`; applies `$mel` patches |
| **World** | Hash computation, World creation | Exclude `$host`, `$mel` from hash |
| **App** | Debugging, telemetry | Read-only `$host`/`$mel` |
| **Core** | Pure computation | Unaware |

---

## 8. World Event System

### 8.1 Event Ownership (v2.0.3)

Per **ADR-001** and **FDR-W027**:

> **Results are World's; Process is App's.**

| Owner | Events | Nature |
|-------|--------|--------|
| **World** | `proposal:*`, `world:*`, `execution:completed`, `execution:failed` | Governance results |
| **App** | `execution:compute`, `execution:patches`, `execution:effect:*`, `execution:started` | Execution telemetry |

| Rule ID | Description |
|---------|-------------|
| WORLD-EVT-OWN-1 | World MUST only define and emit governance events |
| WORLD-EVT-OWN-2 | World MUST NOT define or emit execution telemetry events |
| WORLD-EVT-OWN-3 | `execution:completed` and `execution:failed` are governance results (World-owned) |
| WORLD-EVT-OWN-4 | App MUST emit telemetry events by transforming Host's TraceEvent |

### 8.2 World Event Types (v2.0.3)

World owns and emits **governance result events only**:

```typescript
type WorldEventType =
  // Proposal lifecycle (governance)
  | 'proposal:submitted'
  | 'proposal:evaluating'
  | 'proposal:decided'
  | 'proposal:superseded'  // Ingress cancellation (v2.0)
  
  // Execution results (governance outcome)
  | 'execution:completed'  // Governance: execution succeeded
  | 'execution:failed'     // Governance: execution failed
  
  // World lifecycle (governance)
  | 'world:created'
  | 'world:forked';

// ============================================================
// REMOVED from World (v2.0.1) - Now App's responsibility:
// ============================================================
// The following are execution telemetry events.
// App emits these by transforming Host's TraceEvent stream.
// World does NOT define or emit these events.
//
// - 'execution:scheduled'
// - 'execution:started'
// - 'execution:compute'
// - 'execution:patches'
// - 'execution:effect:dispatched'
// - 'execution:effect:fulfilled'
// ============================================================
```

### 8.3 Subscription API

```typescript
type WorldEventHandler = (event: WorldEvent, ctx: ScheduleContext) => void;
type Unsubscribe = () => void;

interface WorldEventSubscriber {
  subscribe(handler: WorldEventHandler): Unsubscribe;
  subscribe(types: WorldEventType[], handler: WorldEventHandler): Unsubscribe;
}
```

### 8.4 ScheduleContext (v2.0)

**ScheduleContext is provided by App, not World.**

World SPEC defines the **behavioral contract** (handlers can schedule actions),
while App SPEC defines the **concrete API** (action types, scheduling mechanism).

```typescript
/**
 * ScheduleContext: Provided by App to event handlers.
 * 
 * Ownership:
 * - DEFINED BY: App (implementation details)
 * - PROVIDED TO: World event handlers
 * - PROCESSED BY: App's unified scheduler
 * 
 * World declares what handlers may do; App fulfills the mechanism.
 */
interface ScheduleContext {
  /**
   * Schedule an action to be processed after event dispatch completes.
   * Actions are processed through App's unified scheduler.
   */
  schedule(action: ScheduledAction): void;
}

/**
 * ScheduledAction types are ILLUSTRATIVE.
 * Concrete action types are defined by App SPEC.
 */
type ScheduledAction =
  | { type: 'SubmitProposal'; payload: ProposalInput }
  | { type: 'CancelProposal'; payload: { proposalId: ProposalId } }
  | { type: 'Custom'; tag: string; payload: unknown };
```

### 8.4 Non-Interference Constraints (v2.0)

| Rule ID | Description |
|---------|-------------|
| EVT-C1 | Handler MUST NOT modify World state |
| EVT-C2 | Handler MUST NOT call state-modifying APIs (`submitProposal`, `registerActor`, `decide`, etc.) |
| EVT-C3 | Handler SHOULD complete quickly |
| EVT-C4 | Handler MUST NOT await async operations |
| EVT-C5 | Handler exceptions MUST be isolated (one bad handler doesn't break others) |
| EVT-C6 | Handler MUST be idempotent for replay |

### 8.5 Scheduled Reaction Execution (v2.0)

| Rule ID | Description |
|---------|-------------|
| SCHED-1 | Handlers receive `ScheduleContext` as second parameter |
| SCHED-2 | World MUST provide `schedule()` method in ScheduleContext |
| SCHED-3 | Scheduled actions MUST be processed AFTER all handlers complete |
| SCHED-4 | Scheduled actions MUST go through App's unified scheduler |
| SCHED-5 | Scheduled actions MUST NOT be executed as microtask during event dispatch |

**Enforcement Pattern (Recommended):**

```typescript
class WorldEventDispatcher {
  private dispatching = false;
  private scheduledActions: ScheduledAction[] = [];
  
  dispatch(event: WorldEvent): void {
    this.dispatching = true;
    const ctx: ScheduleContext = {
      schedule: (action) => this.scheduledActions.push(action),
    };
    
    try {
      for (const handler of this.handlers) {
        try {
          handler(event, ctx);
        } catch (e) {
          this.logHandlerError(handler, event, e);  // EVT-C5
        }
      }
    } finally {
      this.dispatching = false;
    }
    
    // Process scheduled actions AFTER dispatch (SCHED-3, SCHED-5)
    this.flushScheduledActions();
  }
  
  private flushScheduledActions(): void {
    const actions = this.scheduledActions;
    this.scheduledActions = [];
    
    // Queue to App scheduler, NOT microtask
    for (const action of actions) {
      this.appScheduler.enqueue(action);
    }
  }
  
  // Guard on state-modifying APIs (EVT-C2)
  submitProposal(input: ProposalInput): void {
    if (this.dispatching) {
      throw new Error('EVT-C2 violation: submitProposal called during event dispatch');
    }
    // ... actual implementation
  }
}
```

### 8.6 Event Ordering

| Rule ID | Description |
|---------|-------------|
| EVT-ORD-1 | Events MUST be delivered in causal order (synchronously) |
| EVT-ORD-2 | Events for same executionKey MUST NOT violate Host mailbox serialization |

### 8.7 Event Payloads

#### 8.7.1 Base Event

```typescript
type BaseEvent = {
  readonly type: WorldEventType;
  readonly timestamp: number;
};
```

#### 8.7.2 Proposal Events

```typescript
type ProposalSubmittedEvent = BaseEvent & {
  readonly type: 'proposal:submitted';
  readonly proposalId: ProposalId;
  readonly actorId: ActorId;
  readonly baseWorld: WorldId;
  readonly intent: Intent;
  readonly executionKey: ExecutionKey;
  readonly epoch: number;
};

type ProposalDecidedEvent = BaseEvent & {
  readonly type: 'proposal:decided';
  readonly proposalId: ProposalId;
  readonly decisionId: DecisionId;
  readonly decision: 'approved' | 'rejected';
  readonly reason?: string;
};

type ProposalSupersededEvent = BaseEvent & {
  readonly type: 'proposal:superseded';
  readonly proposalId: ProposalId;
  readonly currentEpoch: number;
  readonly proposalEpoch: number;
  readonly reason: 'branch_switch' | 'manual_cancel';
};
```

#### 8.8.3 Execution Result Events (v2.0.3)

World emits only **governance result** events, not telemetry events (per FDR-W027, FDR-W030).

```typescript
/**
 * Execution completed successfully.
 * Emitted by World when HostExecutor returns outcome: 'completed'.
 */
type ExecutionCompletedEvent = BaseEvent & {
  readonly type: 'execution:completed';
  readonly proposalId: ProposalId;
  readonly executionKey: ExecutionKey;
  readonly resultWorld: WorldId;
};

/**
 * Execution failed.
 * Emitted by World when HostExecutor returns outcome: 'failed'.
 * Note: Failed World is still created (FDR-W012).
 */
type ExecutionFailedEvent = BaseEvent & {
  readonly type: 'execution:failed';
  readonly proposalId: ProposalId;
  readonly executionKey: ExecutionKey;
  readonly error: {
    readonly summary: string;
    readonly details?: ErrorValue[];  // Core's ErrorValue type
    readonly pendingRequirements?: string[];  // WORLD-TERM-4
  };
  readonly resultWorld: WorldId;
};

// ============================================================
// REMOVED from World (v2.0.1) - App-owned telemetry events:
// ============================================================
// The following event types are NOT defined by World.
// App defines and emits these by transforming Host's TraceEvent.
//
// - ExecutionScheduledEvent
// - ExecutionStartedEvent
// - ExecutionComputeEvent
// - ExecutionPatchesEvent
// - ExecutionEffectDispatchedEvent
// - ExecutionEffectFulfilledEvent
// ============================================================
```

| Rule ID | Description |
|---------|-------------|
| WORLD-EXEC-EVT-1 | World MUST emit `execution:completed` when execution succeeds |
| WORLD-EXEC-EVT-2 | World MUST emit `execution:failed` when execution fails |
| WORLD-EXEC-EVT-3 | Both events MUST be emitted after World creation |
| WORLD-EXEC-EVT-4 | World MUST NOT emit events during execution (only after) |

#### 8.8.4 World Events

```typescript
type WorldCreatedEvent = BaseEvent & {
  readonly type: 'world:created';
  readonly world: World;
  readonly from: WorldId;
  readonly proposalId: ProposalId;
  readonly outcome: 'completed' | 'failed';
};
```

---

## 9. Persistence Model

### 9.1 Required Records

World implementations MUST persist (in serializable form) at minimum:

| Record | Key | Description |
|--------|-----|-------------|
| Worlds | WorldId | Immutable World records |
| TerminalSnapshots | WorldId | Full terminal snapshot (or sufficient data to restore it) |
| **SnapshotHashInputs** | snapshotHash | **Normalized hash input** (RECOMMENDED for audit/replay) |
| Proposals | ProposalId | Proposal records with status |
| DecisionRecords | DecisionId | Authority decisions |
| WorldEdges | edgeId | Lineage edges |
| ActorBindings | ActorId | Actor-Authority bindings |

### 9.2 Snapshot Storage Clarification (v2.0.3)

**Critical:** `snapshotHash` is computed from `SnapshotHashInput` (§5.5.1), which **excludes non-deterministic fields** (timestamp, randomSeed, etc.). This means multiple different "full terminal snapshots" may map to the **same** `snapshotHash`.

| Rule ID | Description |
|---------|-------------|
| PERSIST-SNAP-1 | Implementations MUST NOT key full snapshots by `snapshotHash` (ambiguous) |
| PERSIST-SNAP-2 | Full terminal snapshot (if stored) MUST use `WorldId` as key |
| PERSIST-SNAP-3 | Implementations SHOULD store `SnapshotHashInput` keyed by `snapshotHash` (recommended for audit/replay) |
| PERSIST-SNAP-4 | Replay verification SHOULD use `SnapshotHashInput` when available |

**Storage Structure:**

```typescript
// RECOMMENDED: snapshotHash → normalized hash input (audit/replay)
type StoredSnapshotHashInput = {
  readonly snapshotHash: string;  // Key
  readonly hashInput: SnapshotHashInput;  // What was hashed
  readonly schemaHash: string;  // For context
};

// BASELINE: worldId → full terminal snapshot (for baseSnapshot restore)
type StoredTerminalSnapshot = {
  readonly worldId: WorldId;  // Key
  readonly terminalSnapshot: Snapshot;  // Full snapshot including meta.timestamp etc.
};
```

**Rationale:**
- Using `snapshotHash` as key for "full blob" creates ambiguity when different snapshots (different timestamps) produce the same hash.
- `SnapshotHashInput` is what we actually hash, so it's the content-addressable artifact for audit/replay.
- Full snapshots are keyed by `WorldId` for baseSnapshot restoration (unique per semantic world).

### 9.3 BaseSnapshot Restoration (v2.0.3)

When executing a new Proposal, HostExecutor needs a `baseSnapshot` to start from.
This section clarifies restoration strategies for App implementations and the WorldStore contract.

**World/Store Responsibility:**
- World MUST retrieve `baseSnapshot` via its WorldStore for any valid `baseWorld`
- App MUST provide a WorldStore implementation (or adapter) capable of restoring `baseSnapshot`
- Restoration strategy is App's choice; World does not interpret storage details

**Restoration Strategies:**

| Strategy | Description | Pros | Cons |
|----------|-------------|------|------|
| **Full Snapshot Storage** | Store complete Snapshot per WorldId | Instant restore | Storage cost |
| **Data-Only + Recompute** | Store only `data`; recompute `computed` via Core | Minimal storage | CPU cost on restore |
| **External Artifact** | Store in `executionTraceRef` URI | Flexible location | Requires artifact resolver |

| Rule ID | Description |
|---------|-------------|
| PERSIST-BASE-1 | World MUST be able to retrieve baseSnapshot via WorldStore for any valid baseWorld |
| PERSIST-BASE-2 | App MUST provide a WorldStore implementation that can restore baseSnapshot |
| PERSIST-BASE-3 | Restored baseSnapshot MUST produce same snapshotHash as original |

**Example: Full Snapshot Storage**
```typescript
// App stores full snapshot keyed by WorldId
async function getBaseSnapshot(worldId: WorldId): Promise<Snapshot> {
  const stored = await snapshotStore.get(worldId);
  if (!stored) throw new Error(`No snapshot for world ${worldId}`);
  return stored.terminalSnapshot;
}
```

**Example: Data-Only + Recompute**
```typescript
// App stores only data; recomputes computed fields
async function getBaseSnapshot(worldId: WorldId): Promise<Snapshot> {
  const world = await worldStore.get(worldId);
  const hashInput = await hashInputStore.get(world.snapshotHash);
  
  // Recompute computed fields via Core
  return Core.rehydrate(hashInput.data, world.schemaHash);
}
```

### 9.4 WorldEdge (Lineage)

```typescript
type WorldEdge = {
  readonly edgeId: string;
  readonly from: WorldId;
  readonly to: WorldId;
  readonly proposalId: ProposalId;
  readonly decisionId: DecisionId;
  readonly createdAt: number;
};

type WorldLineage = {
  readonly genesis: WorldId;
  readonly worlds: Map<WorldId, World>;
  readonly edges: Map<string, WorldEdge>;
};
```

### 9.5 Lineage Rules

| Rule ID | Description |
|---------|-------------|
| WORLD-LIN-1 | Every non-genesis World MUST have exactly one parent (fork-only) |
| WORLD-LIN-2 | Lineage MUST be acyclic (DAG) |
| WORLD-LIN-3 | Lineage MUST be append-only |
| WORLD-LIN-4 | Multiple children from same parent are allowed (W017 branching) |

### 9.6 Replay Support

| Rule ID | Description |
|---------|-------------|
| REPLAY-1 | Stored lineage and snapshots SHOULD enable history reconstruction |
| REPLAY-2 | traceRef (if present) SHOULD enable execution observation replay |
| REPLAY-3 | Same Proposals replayed MUST produce identical WorldIds |

---

## 10. Invariants

### 10.1 Proposal Invariants

| ID | Invariant |
|----|-----------|
| INV-P1 | No Intent is executed without an approved Proposal |
| INV-P2 | Every Proposal has exactly one Actor |
| INV-P3 | Every Proposal with terminal decision has exactly one DecisionRecord |
| INV-P4 | Proposal status transitions are monotonic |
| INV-P5 | `evaluating` status does NOT create DecisionRecord |
| INV-P6 | ExecutionKey is fixed at Proposal creation |

### 10.2 Authority Invariants

| ID | Invariant |
|----|-----------|
| INV-A1 | Every registered Actor has exactly one Authority binding |
| INV-A2 | Authority never executes effects or applies patches |
| INV-A3 | No re-judgment of a terminal decision for the same Proposal |

### 10.3 World Invariants

| ID | Invariant |
|----|-----------|
| INV-W1 | Worlds are immutable after creation |
| INV-W2 | WorldId is deterministic from (schemaHash, snapshotHash) |
| INV-W3 | Every non-genesis World has exactly one creating Proposal |
| INV-W4 | Lineage is acyclic |
| INV-W5 | Lineage is append-only |
| INV-W6 | Every non-genesis World has exactly one parent (v2.0 fork-only) |
| INV-W7 | snapshotHash excludes non-deterministic fields |
| INV-W8 | Errors in snapshotHash use ErrorSignature (code, source, context only) |
| INV-W9 | snapshotHash includes pendingDigest for collision prevention |
| INV-W10 | snapshotHash uses terminalStatus (normalized), not raw status |
| INV-W11 | Error sorting uses `computeHash(ErrorSignature)` as sort key (64-char hex) |
| INV-W12 | world.schemaHash equals snapshot.meta.schemaHash |
| INV-W13 | Hash input is JSON-serializable (no undefined/BigInt/NaN/function) |
| INV-W14 | ErrorSignature MUST NOT include `message` field |
| INV-W15 | Error state determination uses `lastError`, not `errors.length` |

### 10.4 Hash Invariants (v2.0.3)

| ID | Invariant |
|----|-----------|
| INV-H1 | SHA256 input is UTF-8 encoded bytes |
| INV-H2 | Hash output is lower-case hexadecimal string |
| INV-H3 | Hash input contains only JSON-serializable values |

### 10.5 Execution Invariants (v2.0)

| ID | Invariant |
|----|-----------|
| INV-EX1 | ExecutionKey is opaque to Host |
| INV-EX2 | Terminal snapshot has empty pendingRequirements (or outcome=failed) |
| INV-EX3 | Failed execution still creates World |
| INV-EX4 | Execution-stage proposals MUST reach terminal |
| INV-EX5 | World with non-empty pendingRequirements is NOT a valid baseWorld |

### 10.6 Event Invariants (v2.0)

| ID | Invariant |
|----|-----------|
| INV-EV1 | Event handlers do not modify World state |
| INV-EV2 | Event handlers do not await async operations |
| INV-EV3 | Scheduled actions are processed after event dispatch |
| INV-EV4 | Scheduled actions are NOT executed as microtasks |

### 10.7 Layer Boundary Invariants (v2.0.3)

| ID | Invariant |
|----|-----------|
| INV-LB1 | World package does NOT depend on Host package |
| INV-LB2 | World does NOT subscribe to Host's onTrace |
| INV-LB3 | World does NOT define telemetry events |
| INV-LB4 | World only emits governance events |
| INV-LB5 | World defines HostExecutor interface, does NOT implement it |
| INV-LB6 | App implements HostExecutor and provides it to World |

---

## 11. Compliance

### 11.1 Compliance Requirements

An implementation claiming compliance with **Manifesto World Protocol v2.0.3** MUST:

1. Implement all types defined in this document
2. Enforce all MUST rules (identified by Rule IDs)
3. Enforce all invariants (INV-*)
4. Follow Proposal lifecycle state machine
5. Maintain Actor-Authority bindings
6. Create DecisionRecords only for terminal decisions
7. Preserve World immutability
8. Maintain fork-only, acyclic, append-only lineage
9. Compute snapshotHash excluding non-deterministic fields
10. Normalize and sort errors using ErrorSignature for hashing
11. Include pendingDigest in snapshotHash computation
12. Integrate with Host through HostExecutor interface ONLY (WORLD-HEXEC-*)
13. Use Core Snapshot shape (SNAP-TYPE-*)
14. Enforce event handler non-interference (EVT-C1~C6)
15. Process scheduled actions after event dispatch (SCHED-3~5)
16. Validate terminal snapshot (WORLD-TERM-*)
17. Validate baseWorld (WORLD-BASE-*)
18. Use UTF-8 encoding for SHA256 input (HASH-ENC-1)
19. Use lower-case hex for hash output (HASH-ENC-2)
20. Ensure hash input is JSON-serializable (HASH-JSON-1)
21. Validate schemaHash consistency (WORLD-SCHEMA-1)
22. **[v2.0.3]** Only define governance events (WORLD-EVT-OWN-*)
23. **[v2.0.3]** NOT depend on Host package (WORLD-BOUNDARY-*)
24. **[v2.0.3]** Define but NOT implement HostExecutor (WORLD-HEXEC-*)

### 11.2 Compliance Verification

Compliance can be verified by:

| Test Category | Description |
|---------------|-------------|
| Type checking | All structures match specification |
| Invariant testing | All INV-* hold under test scenarios |
| State machine testing | Proposal transitions are valid |
| Lineage testing | DAG properties preserved |
| Reproducibility testing | Same Proposals → same WorldIds |
| Hash stability testing | Non-deterministic fields don't affect snapshotHash |
| Event handler testing | EVT-C violations detected/prevented |
| Ingress cancellation testing | Epoch-based dropping works correctly |
| Execution testing | Terminal validation and World creation |
| Integration testing | HostExecutor contract satisfied |

### 11.3 v2.0 Specific Tests

| Test | Description |
|------|-------------|
| Parallel branches | Two proposals from same baseWorld → different executionKeys → two child Worlds |
| Serial policy | Two proposals with same executionKey → serialize execution |
| Handler violation | submitProposal in handler → throws or blocked |
| Terminal validation | pendingRequirements non-empty → outcome: failed |
| Pending collision | Two different pending states → different snapshotHash (pendingDigest) |
| Error sorting | Same errors in different order → same snapshotHash |
| Ingress drop | Branch switch during evaluating → Proposal dropped |
| Execution completion | Branch switch during executing → Proposal completes |
| Late arrival | Stale decision arrives → discarded, not applied |
| Schedule timing | Scheduled action → NOT executed as microtask |
| BaseWorld validation | Failed World as base → rejected or warned |
| Hash encoding | UTF-8 + lower-case hex produces consistent WorldId across languages |
| schemaHash mismatch | Provided schemaHash ≠ snapshot.meta.schemaHash → error |
| JSON-serializable | Hash input with BigInt/undefined/function → error or excluded |

---

## Appendix A: Quick Reference

### A.1 Rule Summary by Category

| Category | Key Rules |
|----------|-----------|
| Boundary | WORLD-B1~B4 |
| WorldId | WORLD-ID-1~2 |
| Actor | ACTOR-1~2 |
| Binding | BIND-1~2 |
| Decision | DECISION-1~2 |
| Stage | WORLD-STAGE-1~6 |
| Transition | TRANS-1~2 |
| Epoch | EPOCH-1~5 |
| Host Integration | WORLD-HOST-1~4 |
| ExecutionKey | WORLD-EXK-1~5 |
| Outcome | OUTCOME-1~3 |
| Terminal | WORLD-TERM-1~5 |
| BaseWorld | WORLD-BASE-1~3 |
| Re-entry | WORLD-RE-1~3 |
| Context | WORLD-CTX-1~3 |
| Snapshot Type | SNAP-TYPE-1~3 |
| SnapshotHash | WORLD-HASH-1~11, WORLD-HASH-2a |
| Error Hashing | WORLD-HASH-ERR-1~6, WORLD-HASH-ERR-4a~4b |
| Hash Encoding | HASH-ENC-1~2, HASH-JSON-1 |
| Schema | WORLD-SCHEMA-1 |
| Event Ownership | WORLD-EVT-OWN-1~4 |
| HostExecutor | WORLD-HEXEC-1~5 |
| Layer Boundary | WORLD-BOUNDARY-1~5 |
| Execution Events | WORLD-EXEC-EVT-1~4 |
| Event Constraints | EVT-C1~C6 |
| Event Ordering | EVT-ORD-1~2 |
| Scheduling | SCHED-1~5 |
| Lineage | WORLD-LIN-1~4 |
| Replay | REPLAY-1~3 |
| Host Data Contract | HOST-DATA-1~6 |

### A.2 State Machine Summary

```
submitted → evaluating → approved → executing → completed
    │           │                       │
    │           │                       └──→ failed
    │           │
    └───────────┴──────────────────────────→ rejected

DecisionRecord: approved or rejected transition only
World created: completed or failed only
```

### A.3 v2.0 Additions Summary

| Addition | Purpose |
|----------|---------|
| Snapshot Type Dependency | Core Snapshot shape normative alignment |
| ExecutionKey | Host mailbox serialization key (opaque, policy-flexible) |
| Ingress/Execution stage | Cancellation semantics |
| ScheduleContext | Handler reaction mechanism |
| EVT-C1~C6 strengthened | Non-interference enforcement |
| ErrorSignature + JCS sorting | Deterministic error hashing (no localeCompare) |
| terminalStatus normalization | Hash uses 'completed'\|'failed' only |
| pendingDigest | Collision prevention for WORLD-TERM violations |
| HASH-ENC-* | UTF-8 encoding, lower-case hex output |
| HASH-JSON-1 | JSON-serializable hash input requirement |
| WORLD-SCHEMA-1 | schemaHash consistency validation |
| WORLD-BASE-* | BaseWorld validity rules |
| EPOCH-* | Ingress cancellation rules |
| SCHED-* | Scheduled action timing rules |

### A.4 v2.0.1 Additions Summary (ADR-001 Layer Separation)

| Addition | Purpose |
|----------|---------|
| WORLD-EVT-OWN-* | Event ownership: World owns governance, App owns telemetry |
| WORLD-HEXEC-* | HostExecutor: World defines, App implements |
| WORLD-BOUNDARY-* | World "Does NOT Know" enforcement |
| WORLD-EXEC-EVT-* | Execution result events only |
| INV-LB-* | Layer boundary invariants |

**Events Removed from World (moved to App):**

| Event | Reason |
|-------|--------|
| `execution:scheduled` | Telemetry (App owns) |
| `execution:started` | Telemetry (App owns) |
| `execution:compute` | Telemetry (App owns) |
| `execution:patches` | Telemetry (App owns) |
| `execution:effect:dispatched` | Telemetry (App owns) |
| `execution:effect:fulfilled` | Telemetry (App owns) |

**Events Preserved in World:**

| Event | Reason |
|-------|--------|
| `proposal:*` | Governance lifecycle |
| `world:*` | Governance lifecycle |
| `execution:completed` | Governance result |
| `execution:failed` | Governance result |

### A.5 v2.0.2 Additions Summary (Host-World Data Contract)

| Addition | Purpose |
|----------|---------|
| HOST-DATA-* | `$host` namespace convention formalized |
| §7.9 Host-World Data Contract | Explicit cross-layer data contract |
| Terminology unification | `'failed'` instead of `'error'` for TerminalStatusForHash |

**New Rules (v2.0.2):**

| Rule ID | Description |
|---------|-------------|
| HOST-DATA-1 | Host MUST store internal state under `data.$host` |
| HOST-DATA-2 | Host MUST NOT use `system.*` for internal state |
| HOST-DATA-3 | World MUST exclude `data.$host` from hash |
| HOST-DATA-4 | World MUST NOT interpret `data.$host` contents |
| HOST-DATA-5 | App MAY read `data.$host` for debugging |
| HOST-DATA-6 | The `$host` namespace is reserved; domain schemas MUST NOT use `$host` as a key |

**Terminology Changes (v2.0.2):**

| Before | After | Rationale |
|--------|-------|-----------|
| `TerminalStatusForHash = 'completed' \| 'error'` | `TerminalStatusForHash = 'completed' \| 'failed'` | Align with World outcome and Host's `HostExecutionResult.outcome` |

### A.6 v2.0.3 Additions Summary (Platform Namespace Extension)

| Addition | Purpose |
|----------|---------|
| MEL-DATA-* | `$mel` namespace convention formalized |
| WORLD-HASH-4b | `$mel` excluded from snapshot hash computation |
| HOST-DATA-6 extension | `$`-prefixed keys reserved (not just `$host`) |

**New Rules (v2.0.3):**

| Rule ID | Description |
|---------|-------------|
| HOST-DATA-6 | All `$`-prefixed keys are reserved; domain schemas MUST NOT use them |
| MEL-DATA-1 | Compiler MUST store guard state under `data.$mel.guards.*` |
| MEL-DATA-2 | World MUST exclude `data.$mel` from hash |
| MEL-DATA-3 | World MUST NOT interpret `data.$mel` contents |

---

## Appendix B: Cross-Reference

### B.1 Host Contract v2.0.1 Alignment

| Host Rule | World Rule | Relationship |
|-----------|------------|--------------|
| H018 (ExecutionKey Mailbox) | WORLD-EXK-* | World maps, Host serializes |
| H019 (Run-to-Completion) | EVT-C4 | No await in handlers |
| H020 (Single-Runner) | EVT-ORD-2 | Event ordering consistency |
| H022 (Requirement Lifecycle) | WORLD-TERM-1 | Empty pending at terminal |
| H023 (Context Determinism) | WORLD-CTX-*, WORLD-HASH-7 | randomSeed handling |

### B.2 Event-Loop FDR Alignment

| EL Decision | World Rule | Relationship |
|-------------|------------|--------------|
| D1 (Execution Mailbox) | WORLD-EXK-* | ExecutionKey mapping |
| D2 (Job Splitting) | WORLD-RE-* | Re-entry model |
| D3 (Scheduled Reactions) | SCHED-* | Handler scheduling |
| D4 (Unified Scheduler) | WORLD-STAGE-* | Ingress/Execution |

### B.3 World FDR v2.0 Alignment

| FDR | SPEC Section | Key Rules |
|-----|--------------|-----------|
| W018 | §7.2 | WORLD-EXK-* |
| W019 | §6.4 | WORLD-STAGE-* |
| W020 | §8.4 | SCHED-* |
| W021 | §8.5 | EVT-C* |
| W022 | §7.4 | WORLD-TERM-* |
| W023 | §7.3, §8.8.3 | OUTCOME-*, error payloads |
| W024 | §7.1 | WORLD-HEXEC-* |
| W025 | §5.4.2 | WORLD-HASH-7 |
| W026 | §6.3 | DECISION-* |

### B.4 World FDR v2.0.1 Alignment (ADR-001)

| FDR | SPEC Section | Key Rules |
|-----|--------------|-----------|
| W027 | §8.1, §8.2 | WORLD-EVT-OWN-* |
| W028 | §7.1 | WORLD-HEXEC-* |
| W029 | §4.2 | WORLD-BOUNDARY-* |
| W030 | §8.8.3 | WORLD-EXEC-EVT-* |
| W031 | §4.1, §4.4 | (architectural guidance) |

### B.5 ADR-001 Alignment

| ADR-001 Decision | SPEC Implementation |
|------------------|---------------------|
| Event ownership (Results vs Process) | §8.1, §8.2 WORLD-EVT-OWN-* |
| HostExecutor ownership | §7.1 WORLD-HEXEC-* |
| "Does NOT Know" matrix | §4.2 WORLD-BOUNDARY-* |
| No independent Bridge/Runtime layer | §4.4 (App runtime/) |

---

## Appendix C: Migration from v1.0

### C.1 New Requirements (v2.0)

| Requirement | Section |
|-------------|---------|
| ExecutionKey in Proposal | §6.2 |
| Epoch in Proposal | §6.2 |
| HostExecutor interface | §7.1 |
| ScheduleContext in handlers | §8.3 |
| ErrorSignature for hashing | §5.4.3 |
| BaseWorld validity check | §7.5 |
| Late-arrival handling | §6.4 |

### C.2 New Requirements (v2.0.1)

| Requirement | Section |
|-------------|---------|
| Remove telemetry events from World | §8.1, §8.2 |
| HostExecutor: World defines, App implements | §7.1 |
| World package must not depend on Host | §4.2 |
| Layer boundary invariants | §10.7 |

### C.3 Backward Compatibility

v2.0 preserves:
- World structure (added optional fields)
- Proposal structure (added executionKey, epoch)
- DecisionRecord structure (unchanged)
- Lineage structure (unchanged)
- Core governance invariants (INV-P*, INV-A*, INV-W1~7)

v2.0 strengthens:
- Event handler constraints (EVT-C*)
- Terminal validation (WORLD-TERM-*)
- BaseWorld validation (WORLD-BASE-*)

v2.0.1 changes:
- **Event types reduced** (telemetry moved to App)
- **HostExecutor ownership clarified** (World defines, App implements)
- **Layer boundary enforced** (WORLD-BOUNDARY-*)

v2.0.2 changes:
- **`$host` namespace formalized** (HOST-DATA-* rules)
- **Terminology unified** (`'failed'` replaces `'error'` in TerminalStatusForHash)
- **Cross-layer data contract** (§7.9 added)

v2.0.3 changes:
- **`$mel` namespace formalized** (MEL-DATA-* rules)
- **Platform namespace policy extended** (all `$`-prefixed keys reserved)
- **World hash exclusion extended** (WORLD-HASH-4b)

### C.4 Implementation Impact

| Component | Change Required (v2.0) | Change Required (v2.0.1) | Change Required (v2.0.3) |
|-----------|------------------------|--------------------------|--------------------------|
| Proposal creation | Add executionKey, epoch | - | - |
| Event dispatch | Add ScheduleContext, enforce EVT-C* | - | - |
| World creation | Add ErrorSignature normalization | - | - |
| BaseWorld selection | Add validity check | - | - |
| Host integration | Implement HostExecutor adapter | Move to App | - |
| **Event types** | - | Remove telemetry events | - |
| **Package deps** | - | Remove Host dependency | - |
| **Hash terminology** | - | - | `'error'` → `'failed'` |
| **Host data storage** | - | - | Use `data.$host` namespace |
| **Compiler guard storage** | - | - | Use `data.$mel` namespace |

### C.5 New Requirements (v2.0.3)

| Requirement | Section |
|-------------|---------|
| `$mel` namespace convention | §7.9.1 |
| MEL-DATA-* rules | §7.9.3 |
| `$`-prefixed namespace reservation | §7.9.3 |
| WORLD-HASH-4b (`$mel` exclusion) | §5.5.2 |

---

*End of Manifesto World Protocol Specification v2.0.3*
