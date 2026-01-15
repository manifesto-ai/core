# FDR-Memory v1.1: Layered Memory Architecture

> **Status:** Draft  
> **Author:** eggplantiny  
> **Date:** 2026-01-03  
> **Supersedes:** FDR-Memory v1.0  
> **Related:** World Protocol SPEC v1.0, Intent & Projection SPEC v1.0

---

## 1. Executive Summary

This FDR extends FDR-Memory v1.0 by introducing a **4-Layer Architecture** and the **Minimal Responsibility Principle** while preserving all core principles from v1.0.

### Retained from v1.0
- Memory is **interpretation, not truth**
- Memory selection is **non-deterministic** and **traced**
- **Selector** is explicitly recorded for responsibility tracking
- Four Core Rules (M-1 through M-4)

### Added in v1.1
- **4-Layer Architecture**: Store, Verifier, Selector, Trace
- **Minimal Responsibility Principle**: Manifesto provides interfaces + pure functions only; implementation delegated to applications
- **Merkle Tree Integration**: Partial verification, efficient diff computation
- **Module Boundary Clarification**: Explicit allowed/forbidden zones for Memory usage

---

## 2. Motivation

### 2.1 Problem with v1.0

v1.0 successfully defined **what to record** but left architectural boundaries implicit:

```
┌─────────────────────────────────────────────────────────────┐
│  v1.0 Ambiguities                                           │
├─────────────────────────────────────────────────────────────┤
│  1. Where does Storage belong? (Manifesto or App?)          │
│  2. Where does Selection logic belong?                      │
│  3. How do modules interact with Memory?                    │
│  4. How is integrity verified at scale?                     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Goals for v1.1

| Goal | Description |
|------|-------------|
| **Clear Boundaries** | Define what Manifesto provides vs. what Apps implement |
| **Minimal Core** | Manifesto package has minimal dependencies |
| **Maximum Flexibility** | Apps choose their own infra (DB, LLM, etc.) |
| **Integrity at Scale** | Merkle-based verification for large state trees |

---

## 3. Design Principles

### 3.1 Separation of Concerns

Memory is not a single module. It is **four distinct layers** with different responsibilities:

| Layer | Responsibility | Determinism | Provided By |
|-------|---------------|-------------|-------------|
| **Store** | Persist/retrieve Worlds | Deterministic (IO) | App |
| **Verifier** | Validate integrity | Deterministic (Pure) | Manifesto |
| **Selector** | Choose relevant memories | Non-deterministic | App |
| **Trace** | Record selection audit | Deterministic | Manifesto |

### 3.2 Minimal Responsibility Principle

> **Manifesto defines contracts. Apps fulfill them.**

```
┌─────────────────────────────────────────────────────────────┐
│  Manifesto Provides                                         │
├─────────────────────────────────────────────────────────────┤
│  ✅ Type definitions                                        │
│  ✅ Interface declarations                                  │
│  ✅ Pure functions (Verifier)                               │
│  ✅ Validation rules                                        │
│  ✅ Trace utilities                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Manifesto Does NOT Provide                                 │
├─────────────────────────────────────────────────────────────┤
│  ❌ Store implementations                                   │
│  ❌ Selector implementations                                │
│  ❌ Database dependencies                                   │
│  ❌ LLM dependencies                                        │
│  ❌ Specific search algorithms                              │
└─────────────────────────────────────────────────────────────┘
```

**Rationale:**
- Each application has different infrastructure (PostgreSQL, Redis, IPFS...)
- Each application uses different LLMs (OpenAI, Anthropic, Local...)
- Manifesto should not dictate these choices
- Minimal core = easier adoption, smaller bundle, fewer conflicts

### 3.3 Merkle-Based Integrity

> **WorldId encodes Merkle root. Verification is cryptographic.**

```
WorldId = hash(schemaHash + ':' + snapshotMerkleRoot)
```

This enables:
- **Tamper detection**: Any modification changes the root
- **Partial verification**: Prove specific fields without loading entire World
- **Efficient diff**: Compare roots, traverse only changed subtrees
- **Web3 compatibility**: Roots can be anchored on-chain

---

## 4. Architecture

### 4.1 Layer Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Memory Architecture                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Layer 4: Trace                                     │   │
│  │  Record selection for audit                         │   │
│  │  Provider: Manifesto (utilities)                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↑                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Layer 3: Selector                                  │   │
│  │  Choose relevant memories (non-deterministic)       │   │
│  │  Provider: App (implements interface)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↑                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Layer 2: Verifier                                  │   │
│  │  Validate Merkle proofs (pure functions)            │   │
│  │  Provider: Manifesto (implementation)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↑                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Layer 1: Store                                     │   │
│  │  Persist and retrieve Worlds                        │   │
│  │  Provider: App (implements interface)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Dependency Direction

```
Actor
  │
  ▼
Selector ──────→ Store
  │                │
  │                ▼
  └────────→ Verifier
                   │
                   ▼
              MerkleTree
```

**Rules:**
- Dependencies flow downward only (no cycles)
- Upper layers depend on lower layers
- Lower layers have no knowledge of upper layers

---

## 5. Layer Specifications

### 5.1 Layer 1: Store (Interface)

**Purpose:** Persist and retrieve World data.

**Provider:** Application (implements interface)

```typescript
/**
 * Memory storage interface.
 * Applications MUST implement this interface.
 * Implementation details (DB choice, caching, etc.) are app's concern.
 */
interface MemoryStore {
  /**
   * Retrieve a World by ID.
   * MUST return null if not found (not throw).
   */
  get(worldId: WorldId): Promise<World | null>;
  
  /**
   * Check if a World exists.
   * SHOULD be cheaper than full retrieval.
   */
  exists(worldId: WorldId): Promise<boolean>;
  
  /**
   * Retrieve only the Merkle root.
   * OPTIONAL. Enables cheap verification against cold storage.
   */
  getRoot?(worldId: WorldId): Promise<string | null>;
  
  /**
   * Retrieve partial data with Merkle proofs.
   * OPTIONAL. Enables partial verification without full load.
   */
  getWithProof?(
    worldId: WorldId, 
    paths: readonly string[]
  ): Promise<PartialWorldWithProof | null>;
}
```

**What Manifesto provides:** Interface definition only.

**What Apps implement:**
- PostgreSQL-based store
- Redis-based store
- IPFS-based store
- Hybrid (hot/warm/cold) store
- Any other storage backend

### 5.2 Layer 2: Verifier (Implementation)

**Purpose:** Cryptographic verification of Memory integrity.

**Provider:** Manifesto (pure function implementations)

```typescript
/**
 * Memory verification utilities.
 * All functions are PURE: same input → same output, no side effects.
 * This is the ONLY implementation Manifesto provides.
 */
const MemoryVerifier = {
  /**
   * Verify a Merkle proof against expected root.
   * @returns true if proof is valid
   */
  verifyProof(proof: MerkleProof, expectedRoot: string): boolean;
  
  /**
   * Extract Merkle root from WorldId.
   * WorldId format: `${schemaHash}:${merkleRoot}`
   */
  extractRoot(worldId: WorldId): string;
  
  /**
   * Compute diff between two snapshots.
   * Only traverses changed subtrees (O(changes), not O(total)).
   */
  diff(
    oldSnapshot: MerkleSnapshot, 
    newSnapshot: MerkleSnapshot
  ): SnapshotDiff;
  
  /**
   * Compute Merkle root for a snapshot.
   */
  computeRoot(snapshot: Snapshot): string;
  
  /**
   * Build Merkle tree from snapshot data.
   */
  buildTree(data: Record<string, unknown>): MerkleNode;
} as const;
```

**Why Manifesto provides this:**
- Verification must be consistent across all implementations
- Pure functions have no dependencies
- Critical for integrity guarantees

### 5.3 Layer 3: Selector (Interface)

**Purpose:** Choose relevant memories for a given query.

**Provider:** Application (implements interface)

```typescript
/**
 * Memory selection interface.
 * Applications MUST implement this interface.
 * Selection logic (LLM, embedding, rules, etc.) is app's concern.
 */
interface MemorySelector {
  /**
   * Select relevant memories for a query.
   * This operation is NON-DETERMINISTIC.
   * Same query may yield different results.
   */
  select(request: SelectionRequest): Promise<SelectionResult>;
}

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

type SelectionConstraints = {
  readonly maxResults?: number;
  readonly minConfidence?: number;
  readonly requireVerified?: boolean;
  readonly timeRange?: {
    readonly after?: number;
    readonly before?: number;
  };
};

type SelectionResult = {
  readonly selected: readonly SelectedMemory[];
  readonly selectedAt: number;
};
```

**What Manifesto provides:** Interface definition only.

**What Apps implement:**
- LLM-based selector (OpenAI, Anthropic, etc.)
- Embedding-based selector (vector similarity)
- Rule-based selector (deterministic rules)
- Hybrid selector (combine approaches)

### 5.4 Layer 4: Trace (Utilities)

**Purpose:** Record selection process for audit.

**Provider:** Manifesto (utility functions)

```typescript
/**
 * Trace utilities.
 * Types are from v1.0, utilities are new in v1.1.
 */

// Types (unchanged from v1.0)
type MemoryTrace = {
  readonly selector: ActorRef;
  readonly query: string;
  readonly selectedAt: number;
  readonly atWorldId: WorldId;
  readonly selected: readonly SelectedMemory[];
};

// Utilities (new in v1.1)
const MemoryTraceUtils = {
  /**
   * Create trace from selection request and result.
   */
  create(
    request: SelectionRequest, 
    result: SelectionResult
  ): MemoryTrace;
  
  /**
   * Attach trace to proposal.
   */
  attachToProposal(
    proposal: Proposal, 
    trace: MemoryTrace
  ): Proposal;
  
  /**
   * Extract trace from proposal.
   */
  getFromProposal(proposal: Proposal): MemoryTrace | undefined;
  
  /**
   * Check if proposal has memory trace.
   */
  hasTrace(proposal: Proposal): boolean;
} as const;
```

---

## 6. Type Definitions

### 6.1 Core Types (unchanged from v1.0)

```typescript
type MemoryRef = {
  readonly worldId: WorldId;
};

type SelectedMemory = {
  readonly ref: MemoryRef;
  readonly reason: string;
  readonly confidence: number;  // 0-1
  readonly verified: boolean;
};

type MemoryTrace = {
  readonly selector: ActorRef;
  readonly query: string;
  readonly selectedAt: number;
  readonly atWorldId: WorldId;
  readonly selected: readonly SelectedMemory[];
};
```

### 6.2 Merkle Types (new in v1.1)

```typescript
/**
 * Merkle proof for partial verification.
 */
type MerkleProof = {
  /** Path to the value (e.g., "memory.lastInteraction") */
  readonly path: string;
  
  /** The value at this path */
  readonly value: unknown;
  
  /** Hash of the leaf node */
  readonly leafHash: string;
  
  /** Sibling hashes from leaf to root */
  readonly siblings: readonly MerkleSibling[];
};

type MerkleSibling = {
  readonly hash: string;
  readonly position: 'left' | 'right';
};

/**
 * Merkle tree node.
 */
type MerkleNode = {
  readonly hash: string;
  readonly children?: Readonly<Record<string, MerkleNode>>;
  readonly value?: unknown;  // Only for leaf nodes
};

/**
 * Snapshot with Merkle structure.
 */
type MerkleSnapshot = {
  readonly rootHash: string;
  readonly root: MerkleNode;
};

/**
 * Diff between two snapshots.
 */
type SnapshotDiff = {
  readonly changed: boolean;
  readonly diffs: readonly FieldDiff[];
};

type FieldDiff = {
  readonly path: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
};

/**
 * Partial world data with proofs.
 */
type PartialWorldWithProof = {
  readonly worldId: WorldId;
  readonly rootHash: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly proofs: readonly MerkleProof[];
};
```

---

## 7. Module Boundaries

### 7.1 Memory Usage Zones

```
┌─────────────────────────────────────────────────────────────┐
│  Module Interaction with Memory                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ ALLOWED                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Actor (Intent generation phase)                    │   │
│  │  - May use MemorySelector                           │   │
│  │  - May use MemoryStore (read)                       │   │
│  │  - May use MemoryVerifier                           │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Monologue Layer                                    │   │
│  │  - May use MemoryStore (read)                       │   │
│  │  - May use MemoryVerifier.diff()                    │   │
│  │  - SHOULD NOT use MemorySelector                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ❌ FORBIDDEN                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Projection                                         │   │
│  │  - MUST NOT use MemorySelector                      │   │
│  │  - MUST NOT use MemoryStore                         │   │
│  │  - Rationale: Projection must be deterministic      │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Authority                                          │   │
│  │  - MUST NOT use MemorySelector                      │   │
│  │  - MAY inspect MemoryTrace (read-only)              │   │
│  │  - Rationale: Authority reviews, not re-selects    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Host                                               │   │
│  │  - MUST NOT use any Memory layer                    │   │
│  │  - Rationale: Host only executes                    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Core                                               │   │
│  │  - MUST NOT use any Memory layer                    │   │
│  │  - Rationale: Core must be pure                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Rationale

| Module | Memory Access | Why |
|--------|--------------|-----|
| Actor | Full | Needs context for Intent generation |
| Monologue | Store + Verifier | Needs diff for internal narrative; selection done externally |
| Projection | None | Must be deterministic |
| Authority | Trace only | Reviews decisions, doesn't make them |
| Host | None | Pure execution |
| Core | None | Pure computation |

---

## 8. Rules (extended from v1.0)

### 8.1 Core Rules (unchanged)

| ID | Rule | Rationale |
|----|------|-----------|
| **M-1** | Memory is NOT truth. `SelectedMemory.ref` points to truth. | Memory is interpretation |
| **M-2** | Proposals using memory MUST include `trace.context.memory`. | Auditability |
| **M-3** | Memory selection MUST complete before Proposal submission. | Projection determinism |
| **M-4** | Authority MAY review trace. Authority MUST NOT re-select. | Responsibility separation |

### 8.2 Architecture Rules (new in v1.1)

| ID | Rule | Rationale |
|----|------|-----------|
| **M-5** | MemoryStore MUST be implemented by application. | Minimal responsibility |
| **M-6** | MemorySelector MUST be implemented by application. | Minimal responsibility |
| **M-7** | MemoryVerifier functions MUST be used for integrity checks. | Consistent verification |
| **M-8** | Projection MUST NOT invoke any Memory layer. | Determinism |
| **M-9** | MerkleProof verification SHOULD use MemoryVerifier.verifyProof(). | Correctness |

---

## 9. Package Structure

### 9.1 Manifesto Package

```
@manifesto/memory/
├── types.ts          # All type definitions
├── interfaces.ts     # MemoryStore, MemorySelector interfaces
├── verifier.ts       # Pure verification functions (ONLY implementation)
├── trace.ts          # Trace utilities
├── rules.ts          # Validation functions
└── index.ts          # Public exports
```

**Dependencies:** None (pure TypeScript)

**Exports:**
```typescript
// Types
export type {
  MemoryRef,
  SelectedMemory,
  MemoryTrace,
  MerkleProof,
  MerkleSibling,
  MerkleNode,
  MerkleSnapshot,
  SnapshotDiff,
  FieldDiff,
  PartialWorldWithProof,
  SelectionRequest,
  SelectionConstraints,
  SelectionResult,
};

// Interfaces
export type { MemoryStore, MemorySelector };

// Implementations
export { MemoryVerifier };
export { MemoryTraceUtils };

// Validation
export { validateMemoryRef, validateSelectedMemory, validateMemoryTrace };
```

### 9.2 Application Implementation (example)

```
my-app/
├── src/
│   ├── infra/
│   │   ├── memory/
│   │   │   ├── postgres-store.ts    # implements MemoryStore
│   │   │   ├── openai-selector.ts   # implements MemorySelector
│   │   │   └── index.ts
```

**Example Store:**
```typescript
import { MemoryStore, World, WorldId } from '@manifesto/memory';
import { Pool } from 'pg';

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

  async getRoot(worldId: WorldId): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT merkle_root FROM worlds WHERE id = $1',
      [worldId]
    );
    return result.rows[0]?.merkle_root ?? null;
  }
}
```

**Example Selector:**
```typescript
import { 
  MemorySelector, 
  SelectionRequest, 
  SelectionResult,
  MemoryStore 
} from '@manifesto/memory';
import OpenAI from 'openai';

export class OpenAIMemorySelector implements MemorySelector {
  constructor(
    private store: MemoryStore,
    private openai: OpenAI,
    private vectorDb: VectorDB
  ) {}

  async select(request: SelectionRequest): Promise<SelectionResult> {
    // 1. Vector search for candidates
    const candidates = await this.vectorDb.search(request.query);
    
    // 2. LLM reranking
    const ranked = await this.rerank(request.query, candidates);
    
    // 3. Verify existence
    const verified = await Promise.all(
      ranked.map(async (c) => ({
        ref: { worldId: c.worldId },
        reason: c.reason,
        confidence: c.score,
        verified: await this.store.exists(c.worldId)
      }))
    );
    
    // 4. Apply constraints
    let selected = verified;
    if (request.constraints?.requireVerified) {
      selected = selected.filter(m => m.verified);
    }
    if (request.constraints?.minConfidence) {
      selected = selected.filter(
        m => m.confidence >= request.constraints!.minConfidence!
      );
    }
    
    return {
      selected: selected.slice(0, request.constraints?.maxResults ?? 10),
      selectedAt: Date.now()
    };
  }
  
  private async rerank(query: string, candidates: Candidate[]) {
    // LLM-based reranking implementation
  }
}
```

---

## 10. Verification Strategies

### 10.1 Full Verification

```typescript
// Load entire World, recompute root
async function verifyFull(
  store: MemoryStore, 
  worldId: WorldId
): Promise<boolean> {
  const world = await store.get(worldId);
  if (!world) return false;
  
  const computedRoot = MemoryVerifier.computeRoot(world.snapshot);
  const expectedRoot = MemoryVerifier.extractRoot(worldId);
  
  return computedRoot === expectedRoot;
}
```

### 10.2 Partial Verification (Merkle Proof)

```typescript
// Verify specific field without loading entire World
async function verifyPartial(
  store: MemoryStore,
  worldId: WorldId,
  path: string
): Promise<{ valid: boolean; value: unknown } | null> {
  if (!store.getWithProof) return null;
  
  const partial = await store.getWithProof(worldId, [path]);
  if (!partial) return null;
  
  const proof = partial.proofs.find(p => p.path === path);
  if (!proof) return null;
  
  const expectedRoot = MemoryVerifier.extractRoot(worldId);
  const valid = MemoryVerifier.verifyProof(proof, expectedRoot);
  
  return { valid, value: proof.value };
}
```

### 10.3 Root-Only Verification

```typescript
// Check only that root exists in cold storage
async function verifyRootOnly(
  store: MemoryStore,
  worldId: WorldId
): Promise<boolean> {
  if (!store.getRoot) {
    return store.exists(worldId);
  }
  
  const storedRoot = await store.getRoot(worldId);
  const expectedRoot = MemoryVerifier.extractRoot(worldId);
  
  return storedRoot === expectedRoot;
}
```

---

## 11. Integration with Monologue

### 11.1 Diff-Based Monologue

The Monologue layer uses Memory differently than Actors:

```typescript
/**
 * Monologue accesses Memory for diff computation,
 * NOT for selection.
 */
interface MonologueMemoryAccess {
  /** Get recent snapshot diffs for context */
  getRecentDiffs(count: number): Promise<SnapshotDiff[]>;
  
  /** Get relationship history with specific actor */
  getRelationshipHistory(actorId: ActorId): Promise<WorldId[]>;
}
```

### 11.2 Example Usage

```typescript
async function generateMonologue(
  current: MerkleSnapshot,
  previous: MerkleSnapshot,
  store: MemoryStore
): Promise<Monologue> {
  // 1. Compute diff (pure, uses MemoryVerifier)
  const diff = MemoryVerifier.diff(previous, current);
  
  // 2. Generate monologue based on changes
  // (SLM processes diff, not raw snapshots)
  return await slm.generate({
    changes: diff.diffs,
    context: { /* ... */ }
  });
}
```

**Key distinction:**
- Actor: Uses Selector to find relevant memories
- Monologue: Uses Verifier.diff() to understand changes

---

## 12. Migration from v1.0

### 12.1 Breaking Changes

None. v1.1 is backward-compatible with v1.0.

### 12.2 New Requirements

| Requirement | Impact |
|-------------|--------|
| Implement MemoryStore | Apps must provide storage implementation |
| Implement MemorySelector | Apps must provide selection implementation |
| Use MemoryVerifier for verification | Recommended, not required |

### 12.3 Migration Steps

1. **Create MemoryStore implementation** matching your infrastructure
2. **Create MemorySelector implementation** matching your LLM/search strategy
3. **Optionally adopt Merkle verification** for integrity checks
4. **No changes to existing MemoryTrace usage**

---

## 13. Conformance

### 13.1 v1.0 Requirements (unchanged)

| ID | Requirement |
|----|-------------|
| C-1 | Proposals using memory MUST include `trace.context.memory` |
| C-2 | `MemoryTrace.selector` MUST be valid ActorRef |
| C-3 | All `ref.worldId` MUST be valid WorldId format |
| C-4 | Memory selection MUST complete before Proposal submission |
| C-5 | Projection MUST NOT perform memory selection |

### 13.2 v1.1 Requirements (new)

| ID | Requirement |
|----|-------------|
| C-6 | MemoryStore implementations MUST satisfy interface contract |
| C-7 | MemorySelector implementations MUST satisfy interface contract |
| C-8 | MemoryVerifier SHOULD be used for Merkle operations |
| C-9 | Module boundaries (§7) SHOULD be respected |

---

## 14. Comparison with v1.0

| Aspect | v1.0 | v1.1 |
|--------|------|------|
| Core types | 3 | 3 (unchanged) |
| Merkle types | 0 | 7 (new) |
| Interfaces | 0 (implicit) | 2 (explicit) |
| Pure implementations | 0 | 1 (Verifier) |
| Rules | 4 | 9 |
| Module boundaries | Implicit | Explicit |
| Responsibility | Ambiguous | Clear (Manifesto vs App) |

---

## 15. Open Questions

### 15.1 Deferred to Future Versions

| Question | Current Position | Reconsider When |
|----------|-----------------|-----------------|
| Should Manifesto provide reference Store implementations? | No | If adoption friction is high |
| Should Merkle types be in separate package? | No | If package size becomes concern |
| Should verification be mandatory? | No (SHOULD) | If integrity issues arise |

---

## 16. Appendix

### A. Type Summary

```typescript
// === Core Types (v1.0) ===
type MemoryRef = { readonly worldId: WorldId };

type SelectedMemory = {
  readonly ref: MemoryRef;
  readonly reason: string;
  readonly confidence: number;
  readonly verified: boolean;
};

type MemoryTrace = {
  readonly selector: ActorRef;
  readonly query: string;
  readonly selectedAt: number;
  readonly atWorldId: WorldId;
  readonly selected: readonly SelectedMemory[];
};

// === Merkle Types (v1.1) ===
type MerkleProof = {
  readonly path: string;
  readonly value: unknown;
  readonly leafHash: string;
  readonly siblings: readonly MerkleSibling[];
};

type MerkleSibling = { readonly hash: string; readonly position: 'left' | 'right' };
type MerkleNode = { readonly hash: string; readonly children?: Record<string, MerkleNode>; readonly value?: unknown };
type MerkleSnapshot = { readonly rootHash: string; readonly root: MerkleNode };
type SnapshotDiff = { readonly changed: boolean; readonly diffs: readonly FieldDiff[] };
type FieldDiff = { readonly path: string; readonly oldValue: unknown; readonly newValue: unknown };

// === Interfaces (v1.1) ===
interface MemoryStore {
  get(worldId: WorldId): Promise<World | null>;
  exists(worldId: WorldId): Promise<boolean>;
  getRoot?(worldId: WorldId): Promise<string | null>;
  getWithProof?(worldId: WorldId, paths: readonly string[]): Promise<PartialWorldWithProof | null>;
}

interface MemorySelector {
  select(request: SelectionRequest): Promise<SelectionResult>;
}
```

### B. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.3.0 | - | Initial comprehensive design |
| 1.0.0 | 2026-01-02 | Radical simplification: 3 types, 4 rules |
| 1.1.0 | 2026-01-03 | 4-Layer Architecture, Minimal Responsibility, Merkle integration |

---

*End of FDR-Memory v1.1*
