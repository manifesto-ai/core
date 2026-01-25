# FDR-Memory v1.2.0: Final Architecture Decision Record

> **Status:** Accepted  
> **Author:** eggplantiny  
> **Date:** 2026-01-03  
> **Supersedes:** FDR-Memory v1.1  
> **Related:** Memory SPEC v1.2.0

---

## 1. Executive Summary

This FDR consolidates all architectural decisions made during the Memory specification review process, resulting in Memory SPEC v1.2.0.

### Decision Timeline

| Version | Status | Key Changes |
|---------|--------|-------------|
| v1.0 | Accepted | Initial: 3 types, 4 rules |
| v1.1 | STOP | 4-Layer Architecture, Merkle types (over-exposed) |
| v1.1.1 | STOP | FDR-MEM-ARCH-01~05 applied, but 2 critical issues |
| v1.1.2 | GO | Verifier purity fix, Authority verification API |
| v1.2.0 | **Final** | Polish: requireEvidence semantics, verified field, proof extraction |

---

## 2. Core Principles (Unchanged)

These principles have remained constant throughout all versions:

| Principle | Description |
|-----------|-------------|
| **Memory ≠ Truth** | Memory is interpretation, not authoritative data |
| **Trace Required** | All memory usage must be auditable |
| **Selection Before Submission** | Non-determinism contained to Actor phase |
| **Responsibility Separation** | Selector ≠ Authority ≠ Verifier |

---

## 3. Architecture Decisions

### 3.1 Four-Layer Model

**Decision:** Memory is organized into four distinct layers.

```
Layer 4: Trace      → Audit trail (Manifesto provides)
Layer 3: Selector   → Selection logic (App implements, impure)
Layer 2: Verifier   → Integrity verification (App implements, PURE)
Layer 1: Store      → Persistence (App implements, impure)
```

**Rationale:**
- Clear separation of concerns
- Testable pure core (Verifier)
- Flexible implementation (Store, Selector)

### 3.2 Minimal Responsibility Principle

**Decision:** Manifesto provides interfaces and utilities only. Apps provide implementations.

| Manifesto Provides | App Provides |
|-------------------|--------------|
| Type definitions | MemoryStore implementation |
| Interface declarations | MemorySelector implementation |
| Trace utilities | MemoryVerifier implementation |
| Validation functions | Infrastructure choices |

**Rationale:**
- Zero external dependencies in Manifesto package
- Apps choose their own DB, LLM, verification strategy
- Maximum flexibility, minimum coupling

### 3.3 Verifier Purity

**Decision:** MemoryVerifier MUST be pure. All impure operations (timestamps, actor context) belong to Selector.

```typescript
// Verifier (Pure)
interface MemoryVerifier {
  prove(memory: MemoryRef, world: World): ProveResult;
  verifyProof(proof: VerificationProof): boolean;
}

// ProveResult contains NO timestamps, NO actor refs
type ProveResult = {
  valid: boolean;
  proof?: VerificationProof;
  error?: string;
};
```

**Rationale:**
- Deterministic verification
- Testable without mocks
- Clear responsibility boundary

### 3.4 Split Verifier API

**Decision:** Verifier exposes two methods: `prove()` for proof generation, `verifyProof()` for proof validation.

| Method | Called By | World Access | Purpose |
|--------|-----------|--------------|---------|
| `prove()` | Selector | Required (passed as arg) | Generate proof |
| `verifyProof()` | Authority | Not needed | Validate proof |

**Rationale:**
- Authority can verify without Store access
- Maintains Authority's "no data fetch" rule
- Enables cryptographic verification flow

### 3.5 Evidence Creation Responsibility

**Decision:** Selector creates VerificationEvidence by wrapping VerificationProof with metadata.

```typescript
// Verifier produces (pure)
VerificationProof = { method, proof }

// Selector wraps (impure)
VerificationEvidence = {
  ...proof,
  verifiedAt: Date.now(),      // Selector adds
  verifiedBy: request.selector  // Selector adds
}
```

**Rationale:**
- Preserves Verifier purity
- Audit metadata at appropriate layer
- Clear responsibility chain

### 3.6 WorldId Opacity

**Decision:** Memory specification MUST NOT assume WorldId internal structure.

**Prohibited:**
- Parsing WorldId
- Extracting components
- Assuming format

**Rationale:**
- WorldId format is World Protocol's domain
- Memory is consumer, not definer
- Prevents protocol conflicts

### 3.7 Module Boundaries

**Decision:** Explicit access matrix for all modules.

| Module | Store | Verifier.prove | Verifier.verifyProof | Selector |
|--------|-------|----------------|----------------------|----------|
| Actor | ✅ | ✅ | ✅ | ✅ |
| Authority | ❌ | ❌ | ✅ | ❌ |
| Projection | ❌ | ❌ | ❌ | ❌ |
| Host | ❌ | ❌ | ❌ | ❌ |
| Core | ❌ | ❌ | ❌ | ❌ |

**Rationale:**
- Projection determinism protected
- Authority verification enabled without data access
- Clear compliance boundaries

### 3.8 Merkle as Reference Implementation

**Decision:** Merkle verification is moved to Appendix as reference implementation, not core spec.

**Rationale:**
- Merkle is one verification strategy, not the definition of Memory
- Allows alternative strategies (hash, signature, etc.)
- Reduces spec complexity

---

## 4. Resolved STOP Conditions

### 4.1 FDR-MEM-ARCH-01: Merkle Over-Exposure

**Problem:** Merkle types at same level as core types implied "Merkle = Memory"

**Resolution:** Moved to Appendix E as reference implementation

### 4.2 FDR-MEM-ARCH-02: WorldId Protocol Violation

**Problem:** Memory spec assumed parseable WorldId format

**Resolution:** M-11 rule enforces WorldId opacity

### 4.3 FDR-MEM-ARCH-03: Authority Verification Impossible

**Problem:** `verify(ref, world)` required world, but Authority couldn't fetch

**Resolution:** Split into `prove()` + `verifyProof()`

### 4.4 FDR-MEM-ARCH-04: Dependency Confusion

**Problem:** Conceptual vs runtime dependency conflated

**Resolution:** Separate diagrams, explicit purity rules

### 4.5 FDR-MEM-ARCH-05: Undefined Monologue

**Problem:** Monologue in boundaries but never defined

**Resolution:** Removed from Memory spec scope

### 4.6 Critical-1: Verifier Purity Self-Contradiction

**Problem:** Pure Verifier required to output timestamps/actor refs

**Resolution:** Evidence creation moved to Selector

### 4.7 Critical-2: Authority Verification API Gap

**Problem:** No API for Authority to verify without world data

**Resolution:** `verifyProof()` method added

---

## 5. Final Polish (v1.2.0)

### 5.1 `requireEvidence` Semantics

**Decision:** `requireEvidence: true` means evidence exists AND method !== 'none'

**Clarification:** This is "evidence presence" check, not "cryptographic proof" check. For cryptographic requirement, use policy-level rules on specific methods.

### 5.2 `verified` Field Semantics

**Decision:** Rename conceptually from "existence verified" to "verification passed"

**Clarification:** `verified: boolean` indicates whether `Verifier.prove()` returned `valid: true`, regardless of verification method.

### 5.3 Proof Extraction Rule

**Decision:** Authority MUST reconstruct VerificationProof from Evidence before calling verifyProof.

```typescript
// Authority extraction pattern
const proof: VerificationProof = {
  method: evidence.method,
  proof: evidence.proof
};
const valid = verifier.verifyProof(proof);
```

---

## 6. Type Summary

```typescript
// Core Types
type MemoryRef = { worldId: WorldId };
type VerificationProof = { method: VerificationMethod; proof?: unknown };
type VerificationEvidence = {
  method: VerificationMethod;
  proof?: unknown;
  verifiedAt: number;    // Selector adds
  verifiedBy: ActorRef;  // Selector adds
};
type SelectedMemory = {
  ref: MemoryRef;
  reason: string;
  confidence: number;    // [0, 1]
  verified: boolean;     // prove() returned valid
  evidence?: VerificationEvidence;
};
type MemoryTrace = {
  selector: ActorRef;
  query: string;
  selectedAt: number;
  atWorldId: WorldId;
  selected: SelectedMemory[];
};

// Interfaces
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

## 7. Rules Summary

| ID | Rule |
|----|------|
| M-1 | Memory is NOT truth |
| M-2 | Trace required for memory usage |
| M-3 | Selection before submission |
| M-4 | Authority does not re-select |
| M-5 | Store implementation required |
| M-6 | Selector implementation required |
| M-7 | Verifier implementation required |
| M-8 | Verifier MUST be pure |
| M-9 | Evidence created by Selector |
| M-10 | Projection memory ban |
| M-11 | WorldId opacity |
| M-12 | Proof extraction required for Authority verification |

---

## 8. Final Status

**Memory Specification v1.2.0: GO**

All architectural issues resolved. Spec is implementable, consistent, and aligned with Manifesto principles.

---

## 9. Appendix: Decision Flow

```
v1.0 (Initial)
    │
    ▼
v1.1 (4-Layer + Merkle) ──→ STOP: Merkle over-exposed
    │
    ▼
v1.1.1 (FDR-ARCH-01~05) ──→ STOP: Purity contradiction, Authority API gap
    │
    ▼
v1.1.2 (Purity fix) ──→ GO: All criticals resolved
    │
    ▼
v1.2.0 (Final polish) ──→ GO: Ready for release
```

---

*End of FDR-Memory v1.2.0*
