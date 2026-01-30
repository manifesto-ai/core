# Using Memory

> **Covers:** Memory retrieval, selection, verification, and Proposal integration
> **Purpose:** Reference past Worlds for decision-making with accountability
> **Prerequisites:** Understanding of World Protocol and Proposals

---

## What is Memory?

Memory is an **optional layer** for retrieving and referencing past World/Snapshot information. It enables Actors to base decisions on historical context while maintaining full accountability.

**Critical distinction:**
- **Memory is NOT Truth** - The referenced World is the source of truth
- **Selection is non-deterministic** - LLM ranking, vector search, etc.
- **Selection is TRACED** - Every selection is recorded in MemoryTrace

```
Actor needs past context
       ↓
Memory selects relevant Worlds
       ↓
MemoryTrace records what was selected
       ↓
Proposal includes MemoryTrace
       ↓
Authority can verify the selection
```

---

## 4-Layer Architecture

Memory uses a 4-layer stack:

| Layer | Interface | Responsibility |
|-------|-----------|----------------|
| **L1: Store** | `MemoryStore` | Persist and retrieve Worlds |
| **L2: Verifier** | `MemoryVerifier` | Pure verification (no IO) |
| **L3: Selector** | `MemorySelector` | Find relevant Worlds |
| **L4: Trace** | `MemoryTrace` | Record selection decisions |

```typescript
import {
  InMemoryStore,
  createExistenceVerifier,
  createSimpleSelector,
  createMemoryTrace,
} from "@manifesto-ai/memory";

// Setup the stack
const store = new InMemoryStore();
const verifier = createExistenceVerifier();
const selector = createSimpleSelector(store, verifier);
```

---

## Basic Usage

### 1. Index Worlds

```typescript
// Store the World
store.put(world);

// Index for search (keywords + timestamp)
selector.addToIndex(
  world.worldId,
  ["pricing", "decision", "q4"],
  world.createdAt
);
```

### 2. Select Relevant Memories

```typescript
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

console.log(result.selected);
// → [{ ref: { worldId: "world-123" }, confidence: 0.85, verified: true, ... }]
```

### 3. Create and Attach Trace

```typescript
import { createMemoryTrace, attachToProposal } from "@manifesto-ai/memory";

// Create trace
const trace = createMemoryTrace(
  actor,
  "pricing decision",
  currentWorld.worldId,
  result.selected
);

// Attach to proposal
const proposalWithMemory = attachToProposal(proposal, trace);

// Submit
await world.submitProposal(proposalWithMemory);
```

---

## Module Boundaries

**CRITICAL:** Memory access is restricted by module type.

| Module | Store | prove() | verifyProof() | Selector |
|--------|-------|---------|---------------|----------|
| **Actor** | ✅ | ✅ | ✅ | ✅ |
| **Projection** | ❌ | ❌ | ❌ | ❌ |
| **Authority** | ❌ | ❌ | ✅ | ❌ |
| **Host** | ❌ | ❌ | ❌ | ❌ |
| **Core** | ❌ | ❌ | ❌ | ❌ |

### Why These Restrictions?

- **Projection must be deterministic** - Memory selection is non-deterministic
- **Authority must not access external state** - Only verifies proofs from evidence
- **Host/Core are execution layers** - No governance or memory concerns

---

## Authority Integration (M-12 Pattern)

Authority can verify memory evidence but cannot access Store or call `prove()`.

```typescript
import {
  getFromProposal,
  extractProof,
  createMerkleVerifier,
} from "@manifesto-ai/memory";

const memoryAwareAuthority: AuthorityHandler = {
  async evaluate(proposal, binding) {
    // 1. Extract trace from proposal
    const trace = getFromProposal(proposal);
    if (!trace) {
      return { approved: true };
    }

    // 2. Verify each memory
    const verifier = createMerkleVerifier();

    for (const memory of trace.selected) {
      // Check confidence
      if (memory.confidence < 0.7) {
        return { approved: false, reason: "Low confidence memory" };
      }

      // Verify proof (M-12: extract from evidence)
      if (memory.evidence) {
        const proof = extractProof(memory.evidence);
        if (!verifier.verifyProof(proof)) {
          return { approved: false, reason: "Invalid memory proof" };
        }
      }
    }

    return { approved: true };
  },
};
```

---

## Verifier Selection

| Verifier | Security | Use Case |
|----------|----------|----------|
| `ExistenceVerifier` | Low | Development, testing |
| `HashVerifier` | Medium | General production |
| `MerkleVerifier` | High | Audit compliance |

```typescript
import {
  createExistenceVerifier,
  createHashVerifier,
  createMerkleVerifier,
} from "@manifesto-ai/memory";

// Choose based on requirements
const verifier = createMerkleVerifier();  // For compliance
```

---

## Verifier Purity (M-8)

**Verifiers MUST be pure functions.**

```typescript
// ❌ WRONG: IO in verifier
class BadVerifier implements MemoryVerifier {
  prove(memory, world) {
    const data = await fetch(...);  // FORBIDDEN!
    const now = Date.now();         // FORBIDDEN!
    return { valid: true, proof: { method: "bad" } };
  }
}

// ✅ RIGHT: Pure function
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

## Common Patterns

### Pattern 1: Verified-only Selection

```typescript
const result = await selector.select({
  query: "audit trail",
  atWorldId: currentWorldId,
  selector: actor,
  constraints: {
    requireVerified: true,
    minConfidence: 0.9,
  },
});
```

### Pattern 2: Time-range Filtering

```typescript
const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

const result = await selector.select({
  query: "recent changes",
  atWorldId: currentWorldId,
  selector: actor,
  constraints: {
    timeRange: { after: oneWeekAgo },
  },
});
```

### Pattern 3: Conditional Memory Use

```typescript
// Only use memory if needed
if (needsHistoricalContext) {
  const result = await selector.select({ ... });
  const trace = createMemoryTrace(actor, query, worldId, result.selected);
  proposal = attachToProposal(proposal, trace);
}
```

---

## Anti-Patterns

### ❌ Memory in Projection

```typescript
// WRONG: Projection cannot access Memory
const projection = (event) => {
  const memories = await selector.select(...);  // FORBIDDEN!
  return { type: "action", input: memories };
};
```

**Fix:** Access Memory in Actor before creating intent.

### ❌ Store Access in Authority

```typescript
// WRONG: Authority cannot access Store
const authority = {
  evaluate(proposal) {
    const world = await store.get(worldId);  // FORBIDDEN!
  },
};
```

**Fix:** Use `extractProof()` and `verifyProof()` only.

### ❌ prove() in Authority

```typescript
// WRONG: Authority cannot call prove()
const authority = {
  evaluate(proposal) {
    const proof = verifier.prove(ref, world);  // FORBIDDEN!
  },
};
```

**Fix:** Proof must come from Actor via evidence in MemoryTrace.

---

## Testing Memory

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryStore,
  createExistenceVerifier,
  createSimpleSelector,
} from "@manifesto-ai/memory";

describe("Memory Selection", () => {
  let store: InMemoryStore;
  let selector: SimpleSelector;

  beforeEach(() => {
    store = new InMemoryStore();
    selector = createSimpleSelector(store, createExistenceVerifier());
  });

  it("finds matching World", async () => {
    // Arrange
    store.put(mockWorld);
    selector.addToIndex("world-1", ["important"], Date.now());

    // Act
    const result = await selector.select({
      query: "important",
      atWorldId: "current" as any,
      selector: { actorId: "test", kind: "agent" },
    });

    // Assert
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].ref.worldId).toBe("world-1");
  });
});
```

---

## Checklist

Before using Memory in production:

- [ ] Actor uses Memory correctly (all operations allowed)
- [ ] Projection does NOT access Memory
- [ ] Authority only uses `verifyProof()` and `extractProof()`
- [ ] Verifiers are pure (no IO, no Date.now())
- [ ] MemoryTrace is attached to Proposals
- [ ] Selection constraints match requirements
- [ ] Appropriate verifier chosen for security level

---

## See Also

- [World Concept](/concepts/world) - Governance and authority
- [Specifications](/internals/spec/) - Package specifications including World
- [Memory Package README](https://github.com/manifesto-ai/core/tree/main/packages/memory) - Package documentation
