# @manifesto-ai/memory Specification v1.2

> **Version:** 1.2.0
> **Status:** Normative
> **Role:** Memory Retrieval, Verification, and Tracing
> **Philosophy:** *Memory enables context. Verification ensures trust. Traces provide accountability.*

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Package Boundaries](#2-package-boundaries)
3. [Core Types](#3-core-types)
4. [MemorySelector Interface](#4-memoryselector-interface)
5. [MemoryStore Interface](#5-memorystore-interface)
6. [MemoryVerifier Interface](#6-memoryverifier-interface)
7. [Verification Methods](#7-verification-methods)
8. [Memory Traces](#8-memory-traces)
9. [Selection Constraints](#9-selection-constraints)
10. [Access Control](#10-access-control)
11. [Non-Determinism](#11-non-determinism)

---

## §1. Purpose

### 1.1 Overview

`@manifesto-ai/memory` provides infrastructure for AI agents to access past World states with verifiable provenance.

```
Agent Query ──MemorySelector──> SelectedMemory[]
                                     │
                           MemoryVerifier.prove()
                                     │
                                     ▼
                            VerificationEvidence
```

### 1.2 Key Invariants

| Invariant | Description |
|-----------|-------------|
| M-1 | Memory references MUST be to past Worlds only |
| M-4 | Authority MUST NOT access Memory directly |
| M-5 | Memory MUST NOT mutate past Worlds |
| M-6 | Applications MUST implement MemorySelector |
| M-9 | Evidence MUST include timestamp and actor |
| M-10 | Projection MUST NOT access Memory |

---

## §2. Package Boundaries

### 2.1 Dependencies

```
@manifesto-ai/memory
    │
    ├──→ @manifesto-ai/world (WorldId, ActorRef)
    └──→ zod (schema validation)
```

### 2.2 What Memory Does

- Defines types for memory references and proofs
- Provides interfaces for Store, Verifier, Selector
- Implements pure Verifiers (Existence, Hash, Merkle)
- Provides trace utilities for audit trails

### 2.3 What Memory Does NOT Do

- Store data (Store interface only)
- Implement selection logic (application concern)
- Mutate past Worlds (read-only)
- Provide access control (World/Authority concern)

---

## §3. Core Types

### 3.1 MemoryRef

Reference to a past World:

```typescript
interface MemoryRef {
  /** WorldId of the past World */
  worldId: WorldId;
}
```

**Constraints:**
- `worldId` MUST be a valid WorldId
- Memory implementations MUST NOT parse WorldId

### 3.2 SelectedMemory

A selected memory with context:

```typescript
interface SelectedMemory {
  /** Reference to the World */
  ref: MemoryRef;

  /** Why this memory was selected */
  reason: string;

  /** Relevance confidence (0-1) */
  confidence: number;

  /** Whether verification passed */
  verified: boolean;

  /** Optional verification evidence */
  evidence?: VerificationEvidence;
}
```

**Constraints:**
- `reason` MUST be non-empty
- `confidence` MUST be in range [0, 1] inclusive
- `confidence` MUST be finite (not NaN, not Infinity)

### 3.3 VerificationEvidence

Evidence for Authority inspection:

```typescript
interface VerificationEvidence {
  /** Verification method used */
  method: VerificationMethod;

  /** The proof data */
  proof: VerificationProof;

  /** When verification was performed */
  verifiedAt: number;

  /** Who performed verification */
  verifiedBy: ActorRef;
}
```

---

## §4. MemorySelector Interface

### 4.1 Interface Definition

```typescript
interface MemorySelector {
  select(request: SelectionRequest): Promise<SelectionResult>;
}
```

### 4.2 SelectionRequest

```typescript
interface SelectionRequest {
  /** Search query */
  query: string;

  /** Current World context */
  atWorldId: WorldId;

  /** Who is selecting */
  selector: ActorRef;

  /** Optional constraints */
  constraints?: SelectionConstraints;
}
```

### 4.3 SelectionResult

```typescript
interface SelectionResult {
  /** Selected memories */
  selected: SelectedMemory[];

  /** Selection timestamp */
  selectedAt: number;
}
```

### 4.4 Implementation Requirements

A MemorySelector implementation MUST:

1. Find candidate memories (implementation-specific)
2. Fetch World data from Store
3. Call `Verifier.prove()` for each candidate
4. Wrap proof into VerificationEvidence
5. Apply constraints
6. Return SelectionResult

---

## §5. MemoryStore Interface

### 5.1 Interface Definition

```typescript
interface MemoryStore {
  /** Check if World exists */
  exists(ref: MemoryRef): Promise<boolean>;

  /** Get World snapshot */
  getSnapshot(ref: MemoryRef): Promise<Snapshot | null>;

  /** Get World hash */
  getHash(ref: MemoryRef): Promise<string | null>;

  /** Get Merkle root */
  getMerkleRoot?(ref: MemoryRef): Promise<string | null>;
}
```

### 5.2 Implementation Requirements

MemoryStore implementations MUST:
- Be read-only (no mutations)
- Return `null` for non-existent Worlds
- Be consistent (same ref → same data)

---

## §6. MemoryVerifier Interface

### 6.1 Interface Definition

```typescript
interface MemoryVerifier<T extends VerificationMethod> {
  /** Verification method name */
  readonly method: T;

  /** Generate proof */
  prove(ref: MemoryRef, store: MemoryStore): Promise<VerificationProof>;

  /** Verify proof */
  verify(proof: VerificationProof, store: MemoryStore): Promise<boolean>;
}
```

### 6.2 VerificationProof

```typescript
interface VerificationProof {
  /** Verification method */
  method: VerificationMethod;

  /** Proof validity */
  valid: boolean;

  /** Method-specific data */
  data: Record<string, unknown>;
}
```

---

## §7. Verification Methods

### 7.1 Existence Verification

Checks if World exists:

```typescript
const existenceVerifier = new ExistenceVerifier();
const proof = await existenceVerifier.prove(ref, store);
// proof.valid === store.exists(ref)
```

### 7.2 Hash Verification

Verifies content hash:

```typescript
const hashVerifier = new HashVerifier();
const proof = await hashVerifier.prove(ref, store);
// proof.data.hash === sha256(snapshot)
```

### 7.3 Merkle Verification

Cryptographic Merkle proof:

```typescript
const merkleVerifier = new MerkleVerifier();
const proof = await merkleVerifier.prove(ref, store);
// proof.data.root, proof.data.path, proof.data.leaf
```

---

## §8. Memory Traces

### 8.1 MemoryTrace

Full audit trail for memory operations:

```typescript
interface MemoryTrace {
  /** Unique trace ID */
  traceId: string;

  /** Who initiated */
  selector: ActorRef;

  /** Current World context */
  atWorldId: WorldId;

  /** Search query */
  query: string;

  /** Applied constraints */
  constraints?: SelectionConstraints;

  /** Selected memories */
  selected: SelectedMemory[];

  /** Selection count */
  selectedCount: number;

  /** Whether degradation occurred */
  degraded: boolean;

  /** Degradation reason */
  degradeReason?: string;

  /** Duration in ms */
  durationMs: number;

  /** Timestamp */
  timestamp: number;
}
```

### 8.2 Trace Utilities

```typescript
import {
  createMemoryTrace,
  attachTrace,
  validateTrace,
} from "@manifesto-ai/memory";

// Create initial trace
const trace = createMemoryTrace({
  atWorldId: "world-1",
  selector: { actorId: "user-1", kind: "human" },
  query: "find related",
});

// After selection, attach result
const finalTrace = attachTrace(trace, result);

// Validate trace structure
const isValid = validateTrace(finalTrace);
```

---

## §9. Selection Constraints

### 9.1 SelectionConstraints

```typescript
interface SelectionConstraints {
  /** Maximum results */
  maxResults?: number;

  /** Minimum confidence */
  minConfidence?: number;

  /** Require verified memories */
  requireVerified?: boolean;

  /** Require evidence present */
  requireEvidence?: boolean;

  /** Time range */
  timeRange?: {
    after?: number;
    before?: number;
  };
}
```

### 9.2 Constraint Application

Constraints MUST be applied in order:
1. Time range filtering
2. Confidence filtering
3. Verification filtering
4. Evidence filtering
5. Result limiting

---

## §10. Access Control

### 10.1 Module Access Matrix

| Module | Memory Access |
|--------|---------------|
| Actor | ✅ Full access |
| Projection | ❌ Forbidden (M-10) |
| Authority | ❌ Forbidden (M-4) |
| Host | ❌ Forbidden |
| Core | ❌ Forbidden |

### 10.2 Rationale

- **Actors** need memory for context-aware decisions
- **Projections** are pure functions (no memory access)
- **Authorities** evaluate proposals, not query memory
- **Host** executes effects, not queries
- **Core** is pure computation

---

## §11. Non-Determinism

### 11.1 By Design

Memory selection is intentionally NON-DETERMINISTIC:

- Same query MAY yield different results
- Confidence scores MAY vary over time
- New memories MAY appear between calls

### 11.2 Why Non-Determinism?

1. **Vector search** is inherently non-deterministic
2. **Recency bias** may change relevance
3. **New memories** added between calls
4. **LLM-based ranking** varies

### 11.3 Mitigation

Non-determinism is mitigated by:
- **MemoryTrace** records all selection details
- **Evidence** provides verification proof
- **Constraints** enforce minimum quality

---

## Appendix A: Graceful Degradation

### A.1 MEM-006a Pattern

When memory is unavailable, graceful degradation applies:

```typescript
if (!memorySelector) {
  return {
    content: EMPTY_MEMORY_CONTENT,
    degraded: true,
    degradeReason: "SELECTOR_NOT_CONFIGURED",
    durationMs: 0,
  };
}
```

### A.2 Degradation Reasons

| Reason | Description |
|--------|-------------|
| `SELECTOR_NOT_CONFIGURED` | No selector provided |
| `STORE_UNAVAILABLE` | Store connection failed |
| `TIMEOUT` | Selection timed out |
| `NO_RESULTS` | Query returned empty |

---

## Appendix B: Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | 2025-01-04 | Initial specification |

---

*End of @manifesto-ai/memory Specification v1.2*
