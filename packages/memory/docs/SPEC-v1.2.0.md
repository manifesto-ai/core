# Manifesto Memory Specification v1.2.0

> **Status:** Final  
> **Authors:** eggplantiny  
> **License:** MIT  
> **Date:** 2026-01-03  
> **Based on:** FDR-Memory v1.2.0  
> **Supersedes:** Memory SPEC v1.1.2  
> **Related:** World Protocol SPEC v1.0, Intent & Projection SPEC v1.0

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Normative Language](#2-normative-language)
3. [Terminology](#3-terminology)
4. [Architecture](#4-architecture)
5. [Type Definitions](#5-type-definitions)
6. [Interfaces](#6-interfaces)
7. [Verification](#7-verification)
8. [Rules](#8-rules)
9. [Module Boundaries](#9-module-boundaries)
10. [Proposal Integration](#10-proposal-integration)
11. [Responsibility Model](#11-responsibility-model)
12. [Validation](#12-validation)
13. [Conformance Requirements](#13-conformance-requirements)
14. [Forbidden Patterns](#14-forbidden-patterns)

**Appendices**
- [Appendix A: Type Summary](#appendix-a-type-summary)
- [Appendix B: Interface Summary](#appendix-b-interface-summary)
- [Appendix C: Cross-Reference](#appendix-c-cross-reference)
- [Appendix D: Implementation Examples](#appendix-d-implementation-examples)
- [Appendix E: Merkle Reference Implementation](#appendix-e-merkle-reference-implementation)
- [Appendix F: Migration Guide](#appendix-f-migration-guide)
- [Appendix G: Revision History](#appendix-g-revision-history)

---

## 1. Introduction

### 1.1 Purpose

This specification defines how Manifesto systems handle **Memory**—the retrieval and use of past World/Snapshot information—through a layered architecture that separates concerns and delegates implementation responsibility to applications.

### 1.2 Scope

This specification defines:
- **Types** for memory references, selection, tracing, and verification
- **Interfaces** that applications MUST implement (Store, Selector, Verifier)
- **Rules** governing memory usage across system modules
- **Module boundaries** specifying where memory operations are allowed

This specification does NOT define:
- Storage implementation details (database choice, caching strategy)
- Selection algorithm details (LLM choice, embedding model)
- Verification algorithm details (Merkle, hash, signature)
- WorldId format (see World Protocol SPEC)
- Infrastructure concerns (deployment, scaling)

### 1.3 Design Goals

| Goal | Description |
|------|-------------|
| **Minimal Core** | Manifesto package has zero external dependencies |
| **Clear Boundaries** | Explicit separation between Manifesto and App responsibilities |
| **Auditability** | All memory selection is traceable via MemoryTrace |
| **Integrity** | Verification interface ensures tamper detection |
| **Flexibility** | Apps choose their own infrastructure and algorithms |

### 1.4 Relationship to Other Specifications

| Specification | Relationship |
|---------------|--------------|
| World Protocol | Memory is a **consumer** of World Protocol. WorldId format is defined there, not here. |
| Intent & Projection | Memory selection occurs during Intent generation, before Projection. |
| Host Contract | Host has no access to Memory layers. |

### 1.5 Changes from v1.1.2

| Change | Rationale |
|--------|-----------|
| Clarified `requireEvidence` semantics | Prevent policy misunderstanding |
| Clarified `verified` field meaning | "Verification passed" not just "existence" |
| Added M-12: Proof extraction rule | Authority verification clarity |
| Fixed Appendix E type consistency | Reference implementation quality |

---

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

---

## 3. Terminology

### 3.1 Memory Terms

| Term | Definition |
|------|------------|
| **Memory** | Retrieval of past World/Snapshot information for use in Intent construction |
| **Selection** | The act of choosing relevant memories from available candidates |
| **Selector** | The ActorRef that performed memory selection |
| **Verification** | Confirmation that a referenced World exists and is untampered |
| **Trace** | Record of memory selection for audit purposes |

### 3.2 Verification Terms

| Term | Definition |
|------|------------|
| **Verification Proof** | Pure, deterministic output proving integrity (no timestamps, no actor) |
| **Verification Evidence** | Proof + metadata (who verified, when) for audit trail |
| **Policy Verification** | Checking constraints (timing, confidence) without cryptographic proof |
| **Cryptographic Verification** | Proving integrity using cryptographic evidence |

### 3.3 Architecture Terms

| Term | Definition |
|------|------------|
| **Store** | Layer responsible for persisting and retrieving Worlds |
| **Verifier** | Layer responsible for integrity verification (pure) |
| **Selector** | Layer responsible for choosing relevant memories |
| **Trace** | Layer responsible for audit trail recording |

### 3.4 Imported Terms

| Term | Source | Definition |
|------|--------|------------|
| `WorldId` | World Protocol §4.1 | Unique identifier for a World (opaque) |
| `ActorRef` | Intent & Projection §3.1 | Reference to an Actor |
| `Proposal` | World Protocol §6.2 | Intent submission for Authority approval |
| `ProposalTrace` | World Protocol §6.2 | Audit trail attached to Proposal |

---

## 4. Architecture

### 4.1 Layer Model

Memory functionality is organized into four layers:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Trace                                             │
│  Purpose: Record selection audit trail                      │
│  Provider: Manifesto (types + utilities)                    │
└─────────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Selector                                          │
│  Purpose: Choose relevant memories                          │
│  Provider: Application (implements interface)               │
└─────────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Verifier                                          │
│  Purpose: Integrity verification (PURE)                     │
│  Provider: Application (implements interface)               │
└─────────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Store                                             │
│  Purpose: Persist and retrieve Worlds                       │
│  Provider: Application (implements interface)               │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Responsibility Assignment

| Layer | Manifesto Provides | Application Provides |
|-------|-------------------|---------------------|
| Store | Interface definition | Implementation |
| Verifier | Interface definition | Implementation |
| Selector | Interface definition | Implementation |
| Trace | Types + Utilities | Nothing |

### 4.3 Dependency Model

#### 4.3.1 Conceptual Dependency (Layer Ordering)

```
Trace ← Selector ← Verifier ← Store

Reading: "Trace uses concepts from Selector, 
          Selector uses concepts from Verifier and Store"
```

This represents **semantic layering**, not code calls.

#### 4.3.2 Runtime Dependency (Actual Calls)

```
┌─────────────────────────────────────────────────────────────┐
│                 Runtime Dependency Graph                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│     Actor                                                   │
│       │                                                     │
│       ├────────→ Selector                                   │
│       │              │                                      │
│       │              ├────────→ Store (IO)                  │
│       │              │              │                       │
│       │              │              ↓ world data            │
│       │              │              │                       │
│       │              └────────→ Verifier.prove(ref, world)  │
│       │                              │                      │
│       │                              ↓ ProveResult          │
│       │                              │                      │
│       │              ←───────────────┘                      │
│       │              │                                      │
│       │              └─→ wrap with verifiedAt/verifiedBy    │
│       │                              │                      │
│       │                              ↓ VerificationEvidence │
│       │                                                     │
│       └────────→ TraceUtils                                 │
│                                                             │
│  ═══════════════════════════════════════════════════════    │
│                                                             │
│     Authority                                               │
│       │                                                     │
│       ├────────→ Extract proof from evidence (M-12)         │
│       │              │                                      │
│       │              ↓ VerificationProof                    │
│       │              │                                      │
│       └────────→ Verifier.verifyProof(proof)                │
│                              │                              │
│                              ↓ boolean                      │
│                                                             │
│     (Authority does NOT call Store or Selector)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 4.3.3 Purity Rules

| Layer | Purity | IO Allowed | Timestamp/Actor |
|-------|--------|------------|-----------------|
| Store | Impure | Yes | N/A |
| Verifier | **Pure** | **No** | **No** |
| Selector | Impure | Yes | Yes (creates Evidence) |
| Trace | Pure | No | N/A |

---

## 5. Type Definitions

### 5.1 Core Types

#### 5.1.1 MemoryRef

```typescript
/**
 * Reference to a past World.
 *
 * WorldId is OPAQUE. This specification does not define its format.
 * See World Protocol SPEC for WorldId definition.
 */
type MemoryRef = {
  readonly worldId: WorldId;
};
```

**Constraints:**
- `worldId` MUST be a valid WorldId as defined in World Protocol
- This specification makes NO assumptions about WorldId internal structure
- WorldId MUST NOT be parsed or decomposed by Memory implementations

#### 5.1.2 VerificationProof

```typescript
/**
 * Pure verification output.
 * Contains ONLY deterministic data derived from inputs.
 * NO timestamps, NO actor references.
 *
 * This is what Verifier.prove() returns (inside ProveResult).
 * This is what Verifier.verifyProof() accepts.
 */
type VerificationProof = {
  /** Verification method used */
  readonly method: VerificationMethod;

  /** Method-specific proof data (deterministic) */
  readonly proof?: unknown;
};

/**
 * Supported verification methods.
 * Extensible by applications.
 */
type VerificationMethod =
  | 'existence'    // World exists in Store
  | 'hash'         // Hash comparison
  | 'merkle'       // Merkle proof (see Appendix E)
  | 'signature'    // Cryptographic signature
  | 'none'         // No verification performed
  | string;        // Custom methods allowed
```

**Constraints:**
- `method` MUST be non-empty string
- `proof` format depends on `method`
- MUST NOT contain timestamps
- MUST NOT contain actor references

#### 5.1.3 VerificationEvidence

```typescript
/**
 * Verification proof with audit metadata.
 * Created by Selector/Actor layer, NOT by Verifier.
 *
 * IMPORTANT: Verifier produces VerificationProof.
 *            Selector wraps it into VerificationEvidence.
 *
 * For Authority to verify, proof must be extracted back into
 * VerificationProof format (see M-12).
 */
type VerificationEvidence = {
  /** Verification method used (from VerificationProof) */
  readonly method: VerificationMethod;

  /** Method-specific proof data (from VerificationProof) */
  readonly proof?: unknown;

  /** When verification was performed (added by Selector, NOT Verifier) */
  readonly verifiedAt: number;

  /** Who performed verification (added by Selector, NOT Verifier) */
  readonly verifiedBy: ActorRef;
};
```

**Constraints:**

| Field | Constraint | Source |
|-------|------------|--------|
| `method` | MUST be non-empty string | From VerificationProof |
| `proof` | Format depends on `method` | From VerificationProof |
| `verifiedAt` | MUST be positive integer | Added by Selector |
| `verifiedBy` | MUST be valid ActorRef | Added by Selector |

**Relationship:**
```typescript
// Verifier produces:
VerificationProof = { method, proof }

// Selector wraps:
VerificationEvidence = { method, proof, verifiedAt, verifiedBy }

// Authority extracts for verification:
VerificationProof = { method: evidence.method, proof: evidence.proof }
```

#### 5.1.4 SelectedMemory

```typescript
/**
 * A selected memory with selection context.
 */
type SelectedMemory = {
  /** Reference to the selected World */
  readonly ref: MemoryRef;

  /** Why this memory was selected */
  readonly reason: string;

  /** Confidence in relevance (0-1) */
  readonly confidence: number;

  /**
   * Whether verification passed.
   *
   * TRUE if Verifier.prove() returned valid: true.
   * FALSE if Verifier.prove() returned valid: false or was not called.
   *
   * Note: This indicates verification result, not just existence.
   * The actual verification method is in evidence.method.
   */
  readonly verified: boolean;

  /** Optional verification evidence for Authority inspection */
  readonly evidence?: VerificationEvidence;
};
```

**Constraints:**

| Field | Constraint |
|-------|------------|
| `ref` | MUST be present |
| `ref.worldId` | MUST be valid WorldId |
| `reason` | MUST be non-empty string |
| `confidence` | MUST be in range [0, 1] inclusive |
| `confidence` | MUST be finite (not NaN, not Infinity) |
| `verified` | MUST be boolean |
| `evidence` | OPTIONAL |

#### 5.1.5 MemoryTrace

```typescript
/**
 * Record of memory selection for audit.
 * Attached to Proposal.trace.context.memory.
 */
type MemoryTrace = {
  /** Who performed the selection */
  readonly selector: ActorRef;

  /** What was being searched for */
  readonly query: string;

  /** When selection was performed (Unix timestamp ms) */
  readonly selectedAt: number;

  /** World context at selection time */
  readonly atWorldId: WorldId;

  /** What was selected */
  readonly selected: readonly SelectedMemory[];
};
```

**Constraints:**

| Field | Constraint |
|-------|------------|
| `selector` | MUST be valid ActorRef per Intent & Projection §3.1 |
| `query` | MUST be non-empty string |
| `selectedAt` | MUST be positive integer |
| `atWorldId` | MUST be valid WorldId |
| `selected` | MUST be array (MAY be empty) |
| `selected[*]` | Each element MUST satisfy SelectedMemory constraints |

### 5.2 Verification Result Types

#### 5.2.1 ProveResult

```typescript
/**
 * Result of Verifier.prove().
 * Pure output: contains ONLY deterministic data.
 */
type ProveResult = {
  /** Whether verification passed */
  readonly valid: boolean;

  /** Proof data (if verification succeeded or partial) */
  readonly proof?: VerificationProof;

  /** Error message (if verification failed) */
  readonly error?: string;
};
```

### 5.3 Selection Types

#### 5.3.1 SelectionRequest

```typescript
/**
 * Request for memory selection.
 */
type SelectionRequest = {
  /** What to search for */
  readonly query: string;

  /** Current World context */
  readonly atWorldId: WorldId;

  /** Who is performing selection */
  readonly selector: ActorRef;

  /** Optional constraints */
  readonly constraints?: SelectionConstraints;
};
```

#### 5.3.2 SelectionConstraints

```typescript
/**
 * Constraints for memory selection.
 */
type SelectionConstraints = {
  /** Maximum number of results */
  readonly maxResults?: number;

  /** Minimum confidence threshold */
  readonly minConfidence?: number;

  /** Require verified memories only (verified === true) */
  readonly requireVerified?: boolean;

  /**
   * Require verification evidence to be present.
   *
   * If true:
   *   - evidence field MUST be present
   *   - evidence.method MUST NOT be 'none'
   *
   * NOTE: This checks for "evidence presence with actual method",
   * NOT "cryptographic proof specifically".
   * For cryptographic requirements, use policy-level rules
   * that check for specific methods like 'merkle' or 'signature'.
   */
  readonly requireEvidence?: boolean;

  /** Time range filter */
  readonly timeRange?: {
    readonly after?: number;
    readonly before?: number;
  };
};
```

#### 5.3.3 SelectionResult

```typescript
/**
 * Result of memory selection.
 */
type SelectionResult = {
  /** Selected memories */
  readonly selected: readonly SelectedMemory[];

  /** When selection was performed */
  readonly selectedAt: number;
};
```

---

## 6. Interfaces

### 6.1 MemoryStore

Applications MUST implement this interface for memory storage.

```typescript
/**
 * Memory storage interface.
 *
 * Applications MUST implement this interface.
 * Implementation details (database, caching) are application's concern.
 */
interface MemoryStore {
  /**
   * Retrieve a World by ID.
   *
   * @param worldId - The World identifier
   * @returns The World if found, null otherwise
   *
   * MUST return null if World not found (not throw).
   * MUST NOT modify the World.
   */
  get(worldId: WorldId): Promise<World | null>;

  /**
   * Check if a World exists.
   *
   * @param worldId - The World identifier
   * @returns true if World exists
   *
   * SHOULD be cheaper than full retrieval.
   */
  exists(worldId: WorldId): Promise<boolean>;
}
```

### 6.2 MemoryVerifier

Applications MUST implement this interface for verification.

```typescript
/**
 * Memory verification interface.
 *
 * Applications MUST implement this interface.
 *
 * CRITICAL PURITY REQUIREMENT:
 * - All methods MUST be pure functions
 * - Same inputs MUST produce same outputs
 * - MUST NOT perform IO
 * - MUST NOT call MemoryStore
 * - MUST NOT access current time
 * - MUST NOT access actor context
 */
interface MemoryVerifier {
  /**
   * Generate verification proof for a memory.
   *
   * @param memory - The memory reference to verify
   * @param world - The World data (passed by caller, NOT fetched)
   * @returns Pure verification result with proof
   *
   * Called by: Selector (which fetches world from Store)
   *
   * MUST be pure: same inputs → same outputs.
   * MUST NOT contain timestamps or actor references in output.
   */
  prove(memory: MemoryRef, world: World): ProveResult;

  /**
   * Verify a proof without access to World data.
   *
   * @param proof - The proof to verify (extracted from Evidence)
   * @returns Whether the proof is valid
   *
   * Called by: Authority (which cannot access Store)
   *
   * MUST be pure.
   * Enables Authority verification without World fetch.
   */
  verifyProof(proof: VerificationProof): boolean;
}
```

### 6.3 MemorySelector

Applications MUST implement this interface for memory selection.

```typescript
/**
 * Memory selection interface.
 *
 * Applications MUST implement this interface.
 * Selection logic (LLM, embedding, rules) is application's concern.
 *
 * This layer is IMPURE:
 * - Calls MemoryStore (IO)
 * - Adds timestamps (Date.now())
 * - Adds actor references (request.selector)
 */
interface MemorySelector {
  /**
   * Select relevant memories for a query.
   *
   * @param request - Selection request
   * @returns Selection result
   *
   * This operation is NON-DETERMINISTIC.
   * Same request MAY yield different results.
   * Results MUST satisfy constraints if provided.
   *
   * Selector is responsible for:
   * 1. Finding candidate memories
   * 2. Calling Store to get World data
   * 3. Calling Verifier.prove() for verification
   * 4. Wrapping VerificationProof into VerificationEvidence
   *    (adding verifiedAt, verifiedBy)
   */
  select(request: SelectionRequest): Promise<SelectionResult>;
}
```

---

## 7. Verification

### 7.1 Verification Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Verification Flow                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Actor/Selector Side:                                       │
│  ─────────────────────                                      │
│  1. Selector finds candidate memory                         │
│  2. Selector calls Store.get(worldId) → world               │
│  3. Selector calls Verifier.prove(ref, world)               │
│       → ProveResult { valid, proof: { method, proof } }     │
│  4. Selector creates VerificationEvidence:                  │
│       {                                                     │
│         method: proveResult.proof.method,                   │
│         proof: proveResult.proof.proof,                     │
│         verifiedAt: Date.now(),                             │
│         verifiedBy: request.selector                        │
│       }                                                     │
│  5. Selector returns SelectedMemory with evidence           │
│  6. Actor attaches to Proposal                              │
│                                                             │
│  Authority Side:                                            │
│  ───────────────                                            │
│  7. Authority receives Proposal                             │
│  8. Authority extracts proof from evidence (M-12):          │
│       const proof: VerificationProof = {                    │
│         method: evidence.method,                            │
│         proof: evidence.proof                               │
│       };                                                    │
│  9. Authority calls Verifier.verifyProof(proof) → boolean   │
│  10. Authority makes decision                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Verification Scope

This specification defines **what verification means**, not **how to implement it**.

| Aspect | Defined Here | Defined by Implementation |
|--------|--------------|---------------------------|
| VerificationProof type | ✅ | |
| VerificationEvidence type | ✅ | |
| MemoryVerifier interface | ✅ | |
| Verification algorithm | | ✅ |
| Proof format | | ✅ |

### 7.3 Verification Levels

| Level | Description | Method | Proof Contains |
|-------|-------------|--------|----------------|
| **None** | No verification | `'none'` | Nothing |
| **Existence** | World exists | `'existence'` | Nothing (implicit) |
| **Hash** | Content hash matches | `'hash'` | Hash value |
| **Cryptographic** | Full integrity | `'merkle'` / `'signature'` | Full proof data |

### 7.4 Authority Verification

Authority verification operates at two levels:

#### 7.4.1 Policy Verification (Default)

Authority can verify without cryptographic evidence:
- Confidence thresholds
- Selector authorization
- Timing constraints
- Selection count limits

This requires only `MemoryTrace` inspection.

#### 7.4.2 Cryptographic Verification (When Evidence Present)

If `SelectedMemory.evidence` contains proof:
1. Authority extracts proof per M-12
2. Authority calls `Verifier.verifyProof(proof)`
3. Authority uses result in decision

**Key point:** Authority NEVER calls Store. All data comes from Proposal.

---

## 8. Rules

### 8.1 Core Rules

#### M-1: Memory is Not Truth

> Memory is NOT authoritative. `SelectedMemory.ref` provides access to truth.

#### M-2: Trace Required for Memory Usage

> Proposals using memory MUST include `trace.context.memory: MemoryTrace`.

#### M-3: Selection Before Submission

> Memory selection MUST complete before Proposal submission.

#### M-4: Authority Does Not Re-Select

> Authority MAY evaluate MemoryTrace. Authority MUST NOT re-execute selection.

### 8.2 Architecture Rules

#### M-5: Store Implementation Required

> Applications MUST provide MemoryStore implementation.

#### M-6: Selector Implementation Required

> Applications MUST provide MemorySelector implementation.

#### M-7: Verifier Implementation Required

> Applications MUST provide MemoryVerifier implementation.

#### M-8: Verifier Purity

> MemoryVerifier implementations MUST be pure.

**Normative:**
- Verifier MUST NOT call MemoryStore
- Verifier MUST NOT perform IO
- Verifier MUST NOT access current time (no `Date.now()`)
- Verifier MUST NOT access actor context
- All data MUST be passed as function arguments
- Same inputs MUST produce same outputs
- Outputs MUST NOT contain `verifiedAt` or `verifiedBy`

#### M-9: Evidence Creation Responsibility

> VerificationEvidence MUST be created by Selector, not Verifier.

#### M-10: Projection Memory Ban

> Projection MUST NOT invoke any Memory layer.

#### M-11: WorldId Opacity

> Memory specification MUST NOT assume WorldId internal structure.

#### M-12: Proof Extraction for Authority Verification

> Authority MUST extract VerificationProof from VerificationEvidence before calling verifyProof().

**Normative:**
```typescript
// Authority MUST use this pattern:
const proof: VerificationProof = {
  method: evidence.method,
  proof: evidence.proof
};
const valid = verifier.verifyProof(proof);
```

This rule ensures type safety and explicit data flow.

---

## 9. Module Boundaries

### 9.1 Access Matrix

| Module | Store | Verifier.prove | Verifier.verifyProof | Selector |
|--------|-------|----------------|----------------------|----------|
| **Actor** | ✅ | ✅ | ✅ | ✅ |
| **Projection** | ❌ | ❌ | ❌ | ❌ |
| **Authority** | ❌ | ❌ | ✅ | ❌ |
| **Host** | ❌ | ❌ | ❌ | ❌ |
| **Core** | ❌ | ❌ | ❌ | ❌ |

### 9.2 Access Definitions

#### 9.2.1 Actor

```
✅ ALLOWED:
  - MemoryStore.get()
  - MemoryStore.exists()
  - MemoryVerifier.prove()
  - MemoryVerifier.verifyProof()
  - MemorySelector.select()
  - MemoryTraceUtils.create()
  - MemoryTraceUtils.attachToProposal()
```

#### 9.2.2 Projection

```
❌ ALL MEMORY ACCESS FORBIDDEN

Rationale: Projection must be deterministic.
```

#### 9.2.3 Authority

```
✅ ALLOWED:
  - MemoryTraceUtils.getFromProposal() (read-only)
  - MemoryTraceUtils.hasTrace()
  - MemoryVerifier.verifyProof() (with proof extracted per M-12)

❌ FORBIDDEN:
  - MemoryStore.* (no storage access)
  - MemoryVerifier.prove() (requires World data)
  - MemorySelector.select() (no re-selection)
```

#### 9.2.4 Host

```
❌ ALL MEMORY ACCESS FORBIDDEN
```

#### 9.2.5 Core

```
❌ ALL MEMORY ACCESS FORBIDDEN
```

### 9.3 Future Module Extensions

> Future specifications MAY define their own Memory access rules in their respective specifications.

---

## 10. Proposal Integration

### 10.1 Extension Point

Memory integrates via existing `Proposal.trace.context`:

```typescript
type ProposalTrace = {
  summary: string;
  reasoning?: string;
  context?: {
    memory?: MemoryTrace;
  };
};
```

### 10.2 Attachment Flow

```typescript
// 1. Perform selection
const result = await selector.select(request);

// 2. Create trace
const trace = MemoryTraceUtils.create(request, result);

// 3. Attach to proposal
const proposal = MemoryTraceUtils.attachToProposal(baseProposal, trace);
```

---

## 11. Responsibility Model

### 11.1 Responsibility Chain

| Stage | Responsible Party | Identifier |
|-------|-------------------|------------|
| Storage | Store Implementation | App-defined |
| Proof Generation | Verifier Implementation | N/A (pure) |
| Evidence Creation | Selector Implementation | `evidence.verifiedBy` |
| Selection | Selector Implementation | `MemoryTrace.selector` |
| Usage | Calling Actor | `Proposal.actor` |
| Proof Validation | Authority + Verifier | `DecisionRecord.authority` |

### 11.2 Failure Attribution

| Failure Type | Responsible |
|--------------|-------------|
| Storage failure | Store Implementation |
| Invalid proof generation | Verifier Implementation |
| Incorrect evidence metadata | Selector Implementation |
| Poor selection | Selector Implementation |
| Misuse of memory | Proposal.actor |
| Approval of bad memory | Authority |

---

## 12. Validation

### 12.1 MemoryRef Validation

```typescript
function validateMemoryRef(ref: MemoryRef): ValidationResult {
  if (!ref.worldId || typeof ref.worldId !== 'string') {
    return invalid('worldId must be non-empty string');
  }
  return valid();
}
```

### 12.2 VerificationProof Validation

```typescript
function validateVerificationProof(proof: VerificationProof): ValidationResult {
  if (!proof.method || typeof proof.method !== 'string') {
    return invalid('method must be non-empty string');
  }
  return valid();
}
```

### 12.3 VerificationEvidence Validation

```typescript
function validateVerificationEvidence(evidence: VerificationEvidence): ValidationResult {
  const errors: string[] = [];

  if (!evidence.method || typeof evidence.method !== 'string') {
    errors.push('method must be non-empty string');
  }

  if (!Number.isInteger(evidence.verifiedAt) || evidence.verifiedAt <= 0) {
    errors.push('verifiedAt must be positive integer');
  }

  if (!isValidActorRef(evidence.verifiedBy)) {
    errors.push('verifiedBy must be valid ActorRef');
  }

  return errors.length === 0 ? valid() : invalid(errors.join('; '));
}
```

### 12.4 SelectedMemory Validation

```typescript
function validateSelectedMemory(memory: SelectedMemory): ValidationResult {
  const errors: string[] = [];

  const refResult = validateMemoryRef(memory.ref);
  if (!refResult.valid) errors.push(`ref: ${refResult.error}`);

  if (!memory.reason || typeof memory.reason !== 'string') {
    errors.push('reason must be non-empty string');
  }

  if (typeof memory.confidence !== 'number') {
    errors.push('confidence must be number');
  } else if (memory.confidence < 0 || memory.confidence > 1) {
    errors.push('confidence must be in range [0, 1]');
  } else if (!Number.isFinite(memory.confidence)) {
    errors.push('confidence must be finite');
  }

  if (typeof memory.verified !== 'boolean') {
    errors.push('verified must be boolean');
  }

  if (memory.evidence !== undefined) {
    const evidenceResult = validateVerificationEvidence(memory.evidence);
    if (!evidenceResult.valid) errors.push(`evidence: ${evidenceResult.error}`);
  }

  return errors.length === 0 ? valid() : invalid(errors.join('; '));
}
```

### 12.5 MemoryTrace Validation

```typescript
function validateMemoryTrace(trace: MemoryTrace): ValidationResult {
  const errors: string[] = [];

  if (!isValidActorRef(trace.selector)) {
    errors.push('selector must be valid ActorRef');
  }

  if (!trace.query || typeof trace.query !== 'string') {
    errors.push('query must be non-empty string');
  }

  if (!Number.isInteger(trace.selectedAt) || trace.selectedAt <= 0) {
    errors.push('selectedAt must be positive integer');
  }

  if (!trace.atWorldId || typeof trace.atWorldId !== 'string') {
    errors.push('atWorldId must be non-empty string');
  }

  if (!Array.isArray(trace.selected)) {
    errors.push('selected must be array');
  } else {
    trace.selected.forEach((memory, i) => {
      const result = validateSelectedMemory(memory);
      if (!result.valid) errors.push(`selected[${i}]: ${result.error}`);
    });
  }

  return errors.length === 0 ? valid() : invalid(errors.join('; '));
}
```

---

## 13. Conformance Requirements

### 13.1 MUST Requirements

| ID | Requirement | Source |
|----|-------------|--------|
| CR-01 | Proposals using memory MUST include `trace.context.memory` | M-2 |
| CR-02 | `MemoryTrace.selector` MUST be valid ActorRef | §5.1.5 |
| CR-03 | `MemoryTrace.query` MUST be non-empty string | §5.1.5 |
| CR-04 | `MemoryTrace.selectedAt` MUST be positive integer | §5.1.5 |
| CR-05 | `MemoryTrace.atWorldId` MUST be valid WorldId | §5.1.5 |
| CR-06 | `SelectedMemory.ref.worldId` MUST be valid WorldId | §5.1.4 |
| CR-07 | `SelectedMemory.reason` MUST be non-empty string | §5.1.4 |
| CR-08 | `SelectedMemory.confidence` MUST be in [0, 1] | §5.1.4 |
| CR-09 | `SelectedMemory.verified` MUST be boolean | §5.1.4 |
| CR-10 | Memory selection MUST occur before Proposal submission | M-3 |
| CR-11 | Projection MUST NOT access Memory layers | M-10 |
| CR-12 | Authority MUST NOT re-execute selection | M-4 |
| CR-13 | Applications MUST implement MemoryStore | M-5 |
| CR-14 | Applications MUST implement MemorySelector | M-6 |
| CR-15 | Applications MUST implement MemoryVerifier | M-7 |
| CR-16 | MemoryVerifier MUST be pure | M-8 |
| CR-17 | VerificationEvidence MUST be created by Selector | M-9 |
| CR-18 | Memory MUST NOT assume WorldId format | M-11 |
| CR-19 | Verifier output MUST NOT contain timestamps | M-8 |
| CR-20 | Verifier output MUST NOT contain actor references | M-8 |
| CR-21 | Authority MUST extract proof per M-12 before verifyProof | M-12 |

### 13.2 SHOULD Requirements

| ID | Requirement |
|----|-------------|
| SR-01 | Implementations SHOULD verify memory refs before high-risk decisions |
| SR-02 | Implementations SHOULD prefer verified memories |
| SR-03 | Authority SHOULD reject unverified memories for high-risk intents |
| SR-04 | High-risk proposals SHOULD include VerificationEvidence |

### 13.3 MAY Requirements

| ID | Requirement |
|----|-------------|
| MR-01 | Authority MAY define policies based on MemoryTrace |
| MR-02 | Implementations MAY use any storage backend |
| MR-03 | Implementations MAY use any selection algorithm |
| MR-04 | Implementations MAY use any verification algorithm |
| MR-05 | `MemoryTrace.selected` MAY be empty array |
| MR-06 | `SelectedMemory.evidence` MAY be omitted |

---

## 14. Forbidden Patterns

| ID | Pattern | Violation | Severity |
|----|---------|-----------|----------|
| FP-01 | Using `reason` as factual basis | M-1 | Error |
| FP-02 | Omitting trace when memory used | M-2 | Error |
| FP-03 | Memory selection in Projection | M-10 | Error |
| FP-04 | Authority re-selecting memories | M-4 | Error |
| FP-05 | `confidence` outside [0, 1] | CR-08 | Error |
| FP-06 | Non-finite `confidence` | CR-08 | Error |
| FP-07 | Empty `reason` string | CR-07 | Error |
| FP-08 | Verifier performing IO | M-8 | Error |
| FP-09 | Verifier calling Store | M-8 | Error |
| FP-10 | Verifier adding timestamps | M-8 | Error |
| FP-11 | Verifier adding actor refs | M-8 | Error |
| FP-12 | Parsing WorldId | M-11 | Error |
| FP-13 | Host accessing Memory | §9 | Error |
| FP-14 | Core accessing Memory | §9 | Error |
| FP-15 | Authority calling prove() | §9.2.3 | Error |
| FP-16 | Authority calling Store | §9.2.3 | Error |
| FP-17 | Authority not extracting proof per M-12 | M-12 | Error |

---

## Appendix A: Type Summary

```typescript
// === Core Types ===
type MemoryRef = {
  readonly worldId: WorldId;
};

type VerificationProof = {
  readonly method: VerificationMethod;
  readonly proof?: unknown;
};

type VerificationMethod =
  | 'existence' | 'hash' | 'merkle' | 'signature' | 'none'
  | string;

type VerificationEvidence = {
  readonly method: VerificationMethod;
  readonly proof?: unknown;
  readonly verifiedAt: number;
  readonly verifiedBy: ActorRef;
};

type SelectedMemory = {
  readonly ref: MemoryRef;
  readonly reason: string;
  readonly confidence: number;
  readonly verified: boolean;
  readonly evidence?: VerificationEvidence;
};

type MemoryTrace = {
  readonly selector: ActorRef;
  readonly query: string;
  readonly selectedAt: number;
  readonly atWorldId: WorldId;
  readonly selected: readonly SelectedMemory[];
};

// === Verification Result ===
type ProveResult = {
  readonly valid: boolean;
  readonly proof?: VerificationProof;
  readonly error?: string;
};

// === Selection Types ===
type SelectionRequest = {
  readonly query: string;
  readonly atWorldId: WorldId;
  readonly selector: ActorRef;
  readonly constraints?: SelectionConstraints;
};

type SelectionConstraints = {
  readonly maxResults?: number;
  readonly minConfidence?: number;
  readonly requireVerified?: boolean;
  readonly requireEvidence?: boolean;
  readonly timeRange?: { readonly after?: number; readonly before?: number };
};

type SelectionResult = {
  readonly selected: readonly SelectedMemory[];
  readonly selectedAt: number;
};
```

---

## Appendix B: Interface Summary

```typescript
interface MemoryStore {
  get(worldId: WorldId): Promise<World | null>;
  exists(worldId: WorldId): Promise<boolean>;
}

interface MemoryVerifier {
  prove(memory: MemoryRef, world: World): ProveResult;
  verifyProof(proof: VerificationProof): boolean;
}

interface MemorySelector {
  select(request: SelectionRequest): Promise<SelectionResult>;
}
```

---

## Appendix C: Cross-Reference

### C.1 Imported Types

| Type | Source Spec | Section |
|------|-------------|---------|
| `WorldId` | World Protocol SPEC | §4.1 |
| `World` | World Protocol SPEC | §4.2 |
| `ActorRef` | Intent & Projection SPEC | §3.1 |
| `Proposal` | World Protocol SPEC | §6.2 |
| `ProposalTrace` | World Protocol SPEC | §6.2 |

### C.2 Related FDRs

| FDR | Resolution |
|-----|------------|
| FDR-MEM-ARCH-01 | Merkle moved to Appendix |
| FDR-MEM-ARCH-02 | WorldId opacity enforced |
| FDR-MEM-ARCH-03 | Authority verification API |
| FDR-MEM-ARCH-04 | Dependency clarification |
| FDR-MEM-ARCH-05 | Monologue removed |

---

## Appendix D: Implementation Examples

### D.1 Simple Store (PostgreSQL)

```typescript
import { MemoryStore, World, WorldId } from '@manifesto/memory';

export class PostgresMemoryStore implements MemoryStore {
  constructor(private pool: Pool) {}

  async get(worldId: WorldId): Promise<World | null> {
    const result = await this.pool.query(
      'SELECT data FROM worlds WHERE id = $1',
      [worldId]
    );
    return result.rows[0]?.data ?? null;
  }

  async exists(worldId: WorldId): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM worlds WHERE id = $1 LIMIT 1',
      [worldId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
```

### D.2 Simple Verifier (Existence Check)

```typescript
import {
  MemoryVerifier,
  MemoryRef,
  World,
  ProveResult,
  VerificationProof
} from '@manifesto/memory';

export class ExistenceVerifier implements MemoryVerifier {
  prove(memory: MemoryRef, world: World): ProveResult {
    const valid = world !== null && world !== undefined;

    return {
      valid,
      proof: valid ? { method: 'existence' } : undefined,
      error: valid ? undefined : 'World not found'
    };
  }

  verifyProof(proof: VerificationProof): boolean {
    return proof.method === 'existence';
  }
}
```

### D.3 Complete Selector

```typescript
import {
  MemorySelector,
  SelectionRequest,
  SelectionResult,
  MemoryStore,
  MemoryVerifier,
  VerificationEvidence,
  SelectedMemory
} from '@manifesto/memory';

export class SimpleMemorySelector implements MemorySelector {
  constructor(
    private store: MemoryStore,
    private verifier: MemoryVerifier,
    private index: WorldIndex
  ) {}

  async select(request: SelectionRequest): Promise<SelectionResult> {
    const candidates = this.index.findByKeywords(request.query.split(/\s+/));

    const selected: SelectedMemory[] = await Promise.all(
      candidates
        .slice(0, request.constraints?.maxResults ?? 10)
        .map(async (candidate) => {
          // 1. Fetch world (IO - allowed in Selector)
          const world = await this.store.get(candidate.worldId);

          // 2. Generate proof (pure - Verifier)
          const proveResult = world
            ? this.verifier.prove({ worldId: candidate.worldId }, world)
            : { valid: false, error: 'World not found' };

          // 3. Create evidence (Selector adds timestamp/actor)
          const evidence: VerificationEvidence | undefined =
            proveResult.proof ? {
              method: proveResult.proof.method,
              proof: proveResult.proof.proof,
              verifiedAt: Date.now(),
              verifiedBy: request.selector
            } : undefined;

          return {
            ref: { worldId: candidate.worldId },
            reason: `Matched query: ${request.query}`,
            confidence: 0.7,
            verified: proveResult.valid,
            evidence
          };
        })
    );

    // Apply constraints
    let filtered = selected;

    if (request.constraints?.requireVerified) {
      filtered = filtered.filter(m => m.verified);
    }

    if (request.constraints?.requireEvidence) {
      filtered = filtered.filter(
        m => m.evidence !== undefined && m.evidence.method !== 'none'
      );
    }

    if (request.constraints?.minConfidence !== undefined) {
      filtered = filtered.filter(
        m => m.confidence >= request.constraints!.minConfidence!
      );
    }

    return { selected: filtered, selectedAt: Date.now() };
  }
}
```

### D.4 Authority Verification

```typescript
import {
  MemoryVerifier,
  MemoryTrace,
  VerificationProof,
  SelectedMemory
} from '@manifesto/memory';

function authorityVerifyMemories(
  trace: MemoryTrace,
  verifier: MemoryVerifier
): { allValid: boolean; failures: string[] } {
  const failures: string[] = [];

  for (const memory of trace.selected) {
    if (memory.evidence) {
      // M-12: Extract proof from evidence
      const proof: VerificationProof = {
        method: memory.evidence.method,
        proof: memory.evidence.proof
      };

      // Verify without Store access
      const valid = verifier.verifyProof(proof);

      if (!valid) {
        failures.push(`Invalid proof for ${memory.ref.worldId}`);
      }
    }
  }

  return { allValid: failures.length === 0, failures };
}
```

---

## Appendix E: Merkle Reference Implementation

> **Note:** This appendix provides a reference implementation for Merkle-based verification.
> It is NOT normative. Applications MAY use different verification strategies.

### E.1 Merkle Proof Data Type

```typescript
/**
 * Merkle-specific proof data.
 * This is what goes into VerificationProof.proof when method === 'merkle'.
 */
type MerkleProofData = {
  /** Computed Merkle root from World data */
  readonly computedRoot: string;

  /** Stored/expected Merkle root (if available) */
  readonly expectedRoot?: string;

  /** Optional path proof for partial verification */
  readonly pathProof?: {
    readonly leafHash: string;
    readonly siblings: readonly {
      readonly hash: string;
      readonly position: 'left' | 'right';
    }[];
  };
};
```

### E.2 Merkle Verifier

```typescript
export class MerkleMemoryVerifier implements MemoryVerifier {
  prove(memory: MemoryRef, world: World): ProveResult {
    const computedRoot = this.computeMerkleRoot(world);
    const expectedRoot = world.metadata?.merkleRoot as string | undefined;

    const proofData: MerkleProofData = {
      computedRoot,
      expectedRoot
    };

    // If no expected root, we can only confirm we computed one
    if (!expectedRoot) {
      return {
        valid: true,
        proof: { method: 'merkle', proof: proofData }
      };
    }

    // Compare roots
    const valid = computedRoot === expectedRoot;

    return {
      valid,
      proof: { method: 'merkle', proof: proofData },
      error: valid ? undefined : 'Merkle root mismatch'
    };
  }

  verifyProof(proof: VerificationProof): boolean {
    if (proof.method !== 'merkle') return false;

    const data = proof.proof as MerkleProofData | undefined;
    if (!data || !data.computedRoot) return false;

    // If expectedRoot was provided, they must match
    if (data.expectedRoot) {
      return data.computedRoot === data.expectedRoot;
    }

    // Otherwise, just verify proof structure exists
    return true;
  }

  private computeMerkleRoot(world: World): string {
    return computeHash(JSON.stringify(world));
  }
}

function computeHash(data: string): string {
  // Use crypto library for real implementation
  return `hash:${data.length}`;
}
```

---

## Appendix F: Migration Guide

### F.1 From v1.1.2 to v1.2.0

**No Breaking Changes.** v1.2.0 is backward-compatible with v1.1.2.

**Clarifications:**
1. `requireEvidence` semantics documented explicitly
2. `verified` field meaning clarified
3. M-12 (proof extraction) made explicit rule
4. Appendix E types fixed for consistency

### F.2 From Earlier Versions

See previous version migration guides. Key changes from v1.0:
- Implement MemoryVerifier interface (split into prove/verifyProof)
- Evidence creation moved to Selector
- WorldId opacity enforced

---

## Appendix G: Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-02 | Initial release |
| 1.1.0 | 2026-01-03 | 4-Layer Architecture |
| 1.1.1 | 2026-01-03 | FDR-MEM-ARCH resolutions |
| 1.1.2 | 2026-01-03 | Verifier purity fix |
| 1.2.0 | 2026-01-03 | Final polish, ready for release |

### G.1 Changes in v1.2.0

| Change | Rationale |
|--------|-----------|
| Clarified `requireEvidence` semantics | Prevent policy confusion |
| Clarified `verified` field documentation | "Verification passed" not "existence" |
| Added M-12: Proof extraction rule | Authority verification clarity |
| Fixed Appendix E type consistency | Reference implementation quality |
| Added CR-21, FP-17 | Enforce M-12 |

---

*End of Manifesto Memory Specification v1.2.0*
