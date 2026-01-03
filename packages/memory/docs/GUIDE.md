# Memory Guide

> **Purpose:** Practical guide for using @manifesto-ai/memory
> **Prerequisites:** Basic understanding of World Protocol
> **Time to complete:** ~20 minutes

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Common Patterns](#common-patterns)
4. [Advanced Usage](#advanced-usage)
5. [Common Mistakes](#common-mistakes)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

```bash
pnpm add @manifesto-ai/memory @manifesto-ai/world
```

### Minimal Setup

```typescript
// 1. Import
import {
  InMemoryStore,
  createExistenceVerifier,
  createSimpleSelector,
} from "@manifesto-ai/memory";

// 2. Setup the 4-Layer stack
const store = new InMemoryStore();
const verifier = createExistenceVerifier();
const selector = createSimpleSelector(store, verifier);

// 3. Verify
console.log(store.size);
// → 0
```

### Project Structure

```
my-project/
├── src/
│   ├── memory/
│   │   ├── store.ts        # Custom MemoryStore implementation
│   │   └── selector.ts     # Custom MemorySelector implementation
│   ├── actors/
│   │   └── agent.ts        # Actor using Memory
│   └── index.ts
├── package.json
└── tsconfig.json
```

---

## Basic Usage

### Use Case 1: Selecting Memories

**Goal:** Find past Worlds relevant to a query.

```typescript
import {
  InMemoryStore,
  createExistenceVerifier,
  createSimpleSelector,
} from "@manifesto-ai/memory";
import type { ActorRef } from "@manifesto-ai/world";

// Step 1: Setup
const store = new InMemoryStore();
const verifier = createExistenceVerifier();
const selector = createSimpleSelector(store, verifier);

// Step 2: Index some Worlds
store.put(pastWorld1);
selector.addToIndex(pastWorld1.worldId, ["pricing", "decision"], pastWorld1.createdAt);

store.put(pastWorld2);
selector.addToIndex(pastWorld2.worldId, ["user", "profile"], pastWorld2.createdAt);

// Step 3: Select relevant memories
const actor: ActorRef = { actorId: "agent-1", kind: "agent" };
const result = await selector.select({
  query: "pricing decision",
  atWorldId: currentWorld.worldId,
  selector: actor,
  constraints: {
    maxResults: 5,
    minConfidence: 0.7,
    requireVerified: true,
  },
});

// Step 4: Use results
console.log(result.selected.length);
// → 1
console.log(result.selected[0].confidence);
// → 1.0 (both keywords matched)
```

### Use Case 2: Attaching Memory to Proposal

**Goal:** Attach a MemoryTrace to a Proposal for accountability.

```typescript
import {
  createMemoryTrace,
  attachToProposal,
} from "@manifesto-ai/memory";
import { createProposal } from "@manifesto-ai/world";

// Step 1: Create proposal
const proposal = createProposal(actor, intentInstance, baseWorldId);

// Step 2: Create memory trace from selection result
const trace = createMemoryTrace(
  actor,
  "pricing decision",
  currentWorld.worldId,
  result.selected
);

// Step 3: Attach to proposal
const proposalWithMemory = attachToProposal(proposal, trace);

// Step 4: Submit to World Protocol
await world.submitProposal(proposalWithMemory);
```

### Use Case 3: Verifying Memory in Authority

**Goal:** Verify memory evidence in Authority handler (M-12 pattern).

```typescript
import {
  getFromProposal,
  extractProof,
  createMerkleVerifier,
} from "@manifesto-ai/memory";
import type { AuthorityHandler } from "@manifesto-ai/world";

const memoryAwareAuthority: AuthorityHandler = {
  async evaluate(proposal, binding) {
    // Step 1: Extract MemoryTrace from proposal
    const memoryTrace = getFromProposal(proposal);

    if (!memoryTrace) {
      return { approved: true, reason: "No memory used" };
    }

    // Step 2: Verify each memory
    const verifier = createMerkleVerifier();

    for (const memory of memoryTrace.selected) {
      // Check confidence threshold
      if (memory.confidence < 0.7) {
        return {
          approved: false,
          reason: `Low confidence: ${memory.confidence}`,
        };
      }

      // Verify proof if evidence exists (M-12)
      if (memory.evidence) {
        const proof = extractProof(memory.evidence);
        const valid = verifier.verifyProof(proof);

        if (!valid) {
          return {
            approved: false,
            reason: `Invalid proof for ${memory.ref.worldId}`,
          };
        }
      }
    }

    return { approved: true, reason: "Memory verification passed" };
  },
};
```

---

## Common Patterns

### Pattern 1: State-based Selection

**When to use:** Reference past decisions for context.

```typescript
// Select memories about previous pricing decisions
const result = await selector.select({
  query: "pricing update",
  atWorldId: currentWorld.worldId,
  selector: actor,
  constraints: {
    maxResults: 10,
  },
});

// Use the most recent relevant decision
const mostRecent = result.selected[0];
console.log(`Previous decision: ${mostRecent.ref.worldId}`);
```

### Pattern 2: Time-range Filtering

**When to use:** Limit memories to a specific time window.

```typescript
const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

const result = await selector.select({
  query: "user feedback",
  atWorldId: currentWorld.worldId,
  selector: actor,
  constraints: {
    timeRange: {
      after: oneWeekAgo,
    },
    maxResults: 20,
  },
});
```

### Pattern 3: Verified-only Selection

**When to use:** Ensure all returned memories are cryptographically verified.

```typescript
const result = await selector.select({
  query: "audit trail",
  atWorldId: currentWorld.worldId,
  selector: actor,
  constraints: {
    requireVerified: true,
    minConfidence: 0.9,
  },
});

// All results are verified
console.log(result.selected.every(m => m.verified));
// → true
```

---

## Advanced Usage

### Custom MemoryStore (PostgreSQL)

**Prerequisites:** Understanding of MemoryStore interface.

```typescript
import type { MemoryStore } from "@manifesto-ai/memory";
import type { World, WorldId } from "@manifesto-ai/world";
import { Pool } from "pg";

export class PostgresMemoryStore implements MemoryStore {
  constructor(private pool: Pool) {}

  async get(worldId: WorldId): Promise<World | null> {
    const result = await this.pool.query(
      "SELECT data FROM worlds WHERE id = $1",
      [worldId]
    );
    return result.rows[0]?.data ?? null;
  }

  async exists(worldId: WorldId): Promise<boolean> {
    const result = await this.pool.query(
      "SELECT 1 FROM worlds WHERE id = $1 LIMIT 1",
      [worldId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
```

### Custom MemorySelector (LLM-based)

**Prerequisites:** Understanding of MemorySelector interface.

```typescript
import type {
  MemorySelector,
  SelectionRequest,
  SelectionResult,
  SelectedMemory,
  MemoryStore,
  MemoryVerifier,
} from "@manifesto-ai/memory";

export class LLMMemorySelector implements MemorySelector {
  constructor(
    private store: MemoryStore,
    private verifier: MemoryVerifier,
    private llm: LLMClient,
    private vectorIndex: VectorIndex
  ) {}

  async select(request: SelectionRequest): Promise<SelectionResult> {
    const selectedAt = Date.now();

    // 1. Vector search for candidates
    const candidates = await this.vectorIndex.search(request.query, 20);

    // 2. LLM reranking
    const ranked = await this.llm.rankByRelevance(request.query, candidates);

    // 3. Verify and create evidence
    const selected: SelectedMemory[] = await Promise.all(
      ranked.map(async (candidate) => {
        const world = await this.store.get(candidate.worldId);
        const proveResult = world
          ? this.verifier.prove({ worldId: candidate.worldId }, world)
          : { valid: false, error: "World not found" };

        return {
          ref: { worldId: candidate.worldId },
          reason: candidate.reason,
          confidence: candidate.score,
          verified: proveResult.valid,
          evidence: proveResult.proof
            ? {
                method: proveResult.proof.method,
                proof: proveResult.proof.proof,
                verifiedAt: selectedAt,
                verifiedBy: request.selector,
              }
            : undefined,
        };
      })
    );

    // 4. Apply constraints
    let filtered = selected;

    if (request.constraints?.requireVerified) {
      filtered = filtered.filter((m) => m.verified);
    }

    if (request.constraints?.minConfidence !== undefined) {
      filtered = filtered.filter(
        (m) => m.confidence >= request.constraints!.minConfidence!
      );
    }

    return { selected: filtered, selectedAt };
  }
}
```

### Choosing a Verifier

| Verifier | Use Case |
|----------|----------|
| `ExistenceVerifier` | Development, testing, trusted environments |
| `HashVerifier` | General production, content integrity |
| `MerkleVerifier` | Audit compliance, regulatory requirements |

```typescript
import {
  createExistenceVerifier,
  createHashVerifier,
  createMerkleVerifier,
} from "@manifesto-ai/memory";

// For development
const devVerifier = createExistenceVerifier();

// For production
const prodVerifier = createHashVerifier();

// For compliance
const auditVerifier = createMerkleVerifier();
```

---

## Common Mistakes

### ❌ Mistake 1: Accessing Memory in Projection (M-10)

**What people do:**

```typescript
// Wrong - Projection cannot access Memory
const projection = (event) => {
  const memories = await selector.select(...); // FORBIDDEN!
  return { type: "action", input: memories };
};
```

**Why it's wrong:** Projection must be deterministic. Memory selection is non-deterministic.

**Correct approach:**

```typescript
// Right - Actor accesses Memory before creating intent
const memories = await selector.select(...);
const intent = createIntent("action", { memories });
```

### ❌ Mistake 2: Accessing Store in Authority

**What people do:**

```typescript
// Wrong - Authority cannot access Store
const authority = {
  evaluate(proposal) {
    const world = await store.get(worldId); // FORBIDDEN!
    // ...
  },
};
```

**Why it's wrong:** Authority can only use `verifyProof()`, not `store.get()`.

**Correct approach:**

```typescript
// Right - Authority only verifies proofs
const authority = {
  evaluate(proposal) {
    const trace = getFromProposal(proposal);
    if (trace?.selected[0]?.evidence) {
      const proof = extractProof(trace.selected[0].evidence);
      const valid = verifier.verifyProof(proof);
      // ...
    }
  },
};
```

### ❌ Mistake 3: Calling prove() in Authority

**What people do:**

```typescript
// Wrong - Authority cannot call prove()
const authority = {
  evaluate(proposal) {
    const proof = verifier.prove(ref, world); // FORBIDDEN!
  },
};
```

**Why it's wrong:** `prove()` requires the World object. Authority cannot access Store.

**Correct approach:**

```typescript
// Right - Use extractProof() from evidence (M-12)
const proof = extractProof(memory.evidence);
const valid = verifier.verifyProof(proof);
```

### ❌ Mistake 4: IO in Verifier (M-8)

**What people do:**

```typescript
// Wrong - Verifier must be pure
class BadVerifier implements MemoryVerifier {
  prove(memory, world) {
    const data = await fetch(...);      // FORBIDDEN!
    const now = Date.now();             // FORBIDDEN!
    return { valid: true, proof: { method: "bad", verifiedAt: now } };
  }
}
```

**Why it's wrong:** Verifiers must be pure functions with no side effects.

**Correct approach:**

```typescript
// Right - All data passed as arguments
class GoodVerifier implements MemoryVerifier {
  prove(memory, world) {
    // Uses only input arguments
    const root = computeMerkleRoot(world);
    return {
      valid: true,
      proof: { method: "merkle", proof: { computedRoot: root } },
    };
  }
}
```

---

## Troubleshooting

### Error: World not found

**Cause:** The World was not indexed in the Store.

**Solution:**

```typescript
// Ensure World is stored before selection
store.put(world);
selector.addToIndex(world.worldId, keywords, world.createdAt);

// Then select
const result = await selector.select({ ... });
```

### Error: Low confidence

**Cause:** Query keywords don't match indexed keywords well.

**Diagnosis:**

```typescript
// Check what keywords were indexed
console.log("Indexed keywords:", ["pricing", "decision"]);
console.log("Query:", "price update");
// "price" doesn't match "pricing" exactly
```

**Solution:**

```typescript
// Use broader or more specific keywords
selector.addToIndex(worldId, ["price", "pricing", "decision"], createdAt);
// Or adjust minConfidence threshold
constraints: { minConfidence: 0.5 }
```

### Error: Invalid proof

**Cause:** Proof data doesn't match expected format or content.

**Diagnosis:**

```typescript
// Check proof structure
console.log(JSON.stringify(proof, null, 2));
// Verify proof method matches verifier
console.log("Method:", proof.method);
```

**Solution:**

```typescript
// Ensure correct verifier is used
if (proof.method === "merkle") {
  const verifier = createMerkleVerifier();
  const valid = verifier.verifyProof(proof);
}
```

---

## Testing

### Unit Testing

```typescript
import {
  InMemoryStore,
  createExistenceVerifier,
  createSimpleSelector,
} from "@manifesto-ai/memory";
import { describe, it, expect, beforeEach } from "vitest";

describe("Memory Selection", () => {
  let store: InMemoryStore;
  let selector: SimpleSelector;

  beforeEach(() => {
    store = new InMemoryStore();
    const verifier = createExistenceVerifier();
    selector = createSimpleSelector(store, verifier);
  });

  it("should find matching World by keyword", async () => {
    // Arrange
    const world = createMockWorld("world-123");
    store.put(world);
    selector.addToIndex("world-123", ["important"], Date.now());

    // Act
    const result = await selector.select({
      query: "important",
      atWorldId: "current-world" as any,
      selector: { actorId: "test", kind: "agent" },
    });

    // Assert
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].ref.worldId).toBe("world-123");
  });
});
```

### Verifier Purity Test

```typescript
it("should be pure: same inputs produce same outputs", () => {
  const verifier = createMerkleVerifier();
  const memory = { worldId: "world-123" as any };
  const world = createMockWorld("world-123");

  const result1 = verifier.prove(memory, world);
  const result2 = verifier.prove(memory, world);

  expect(result1.valid).toBe(result2.valid);
  expect(JSON.stringify(result1.proof)).toBe(JSON.stringify(result2.proof));
});
```

---

## Next Steps

- **Deep dive:** Read [SPEC.md](./SPEC-1.2v.md) for complete API reference
- **Understand why:** Read [FDR.md](./FDR-1.2.md) for design rationale
- **Integration:** Read [USAGE.md](./USAGE.md) for World Protocol integration

---

## Quick Reference

### Key APIs

| API | Purpose | Example |
|-----|---------|---------|
| `createSimpleSelector()` | Create keyword-based selector | `createSimpleSelector(store, verifier)` |
| `createMemoryTrace()` | Create trace from selection | `createMemoryTrace(actor, query, worldId, selected)` |
| `attachToProposal()` | Attach trace to proposal | `attachToProposal(proposal, trace)` |
| `getFromProposal()` | Extract trace from proposal | `getFromProposal(proposal)` |
| `extractProof()` | Extract proof from evidence (M-12) | `extractProof(evidence)` |

### Selection Constraints

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxResults` | `number` | unlimited | Maximum memories to return |
| `minConfidence` | `number` | 0 | Minimum confidence threshold (0-1) |
| `requireVerified` | `boolean` | false | Only return verified memories |
| `timeRange.after` | `number` | - | Only memories after this timestamp |
| `timeRange.before` | `number` | - | Only memories before this timestamp |

### Module Boundary Checklist

Before going to production:

- [ ] Actor uses Memory correctly (Store, prove, verifyProof, Selector all allowed)
- [ ] Projection does NOT access Memory
- [ ] Authority only uses `verifyProof()` and `extractProof()`
- [ ] Host does NOT access Memory
- [ ] Core does NOT access Memory
- [ ] Verifiers are pure (no IO, no Date.now())

---

*End of Guide*
