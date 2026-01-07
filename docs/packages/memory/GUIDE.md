# @manifesto-ai/memory Guide

A step-by-step guide to implementing memory selection in Manifesto applications.

---

## Quick Start

### Installation

```bash
pnpm add @manifesto-ai/memory @manifesto-ai/world zod
```

### Your First MemorySelector

```typescript
import {
  MemorySelector,
  SelectionRequest,
  SelectionResult,
  SelectedMemory,
  createMemoryRef,
} from "@manifesto-ai/memory";

class SimpleMemorySelector implements MemorySelector {
  private memories: Map<string, { content: string; timestamp: number }>;

  constructor() {
    this.memories = new Map();
  }

  async select(request: SelectionRequest): Promise<SelectionResult> {
    const matches: SelectedMemory[] = [];

    for (const [worldId, memory] of this.memories) {
      // Simple keyword matching
      if (memory.content.includes(request.query)) {
        matches.push({
          ref: createMemoryRef(worldId),
          reason: `Contains "${request.query}"`,
          confidence: 0.8,
          verified: true,
        });
      }
    }

    // Apply constraints
    let results = matches;

    if (request.constraints?.minConfidence) {
      results = results.filter(
        (m) => m.confidence >= request.constraints!.minConfidence!
      );
    }

    if (request.constraints?.maxResults) {
      results = results.slice(0, request.constraints.maxResults);
    }

    return {
      selected: results,
      selectedAt: Date.now(),
    };
  }

  // Add memory for testing
  addMemory(worldId: string, content: string) {
    this.memories.set(worldId, { content, timestamp: Date.now() });
  }
}
```

---

## Integration with Translator

### Setting Up Memory

```typescript
import { createTranslatorHost } from "@manifesto-ai/translator";
import { MemorySelector, SelectedMemory } from "@manifesto-ai/memory";

// Create selector
const selector = new MyMemorySelector();

// Create translator with memory
const host = createTranslatorHost({
  schema,
  worldId: "my-world",
  memorySelector: selector,
  memoryContentFetcher: {
    async fetch(selected: SelectedMemory[], query: string) {
      // Fetch actual content from selected memories
      const examples = [];
      const history = [];

      for (const memory of selected) {
        // Load content based on your storage
        const content = await loadContent(memory.ref.worldId);

        if (content.type === "translation-example") {
          examples.push({
            input: content.input,
            output: content.output,
          });
        } else if (content.type === "schema-history") {
          history.push({
            version: content.version,
            changes: content.changes,
          });
        }
      }

      return {
        translationExamples: examples,
        schemaHistory: history,
        glossaryTerms: [],
        resolutionHistory: [],
      };
    },
  },
});
```

---

## Implementing MemoryStore

### Basic Store Implementation

```typescript
import {
  MemoryStore,
  MemoryRef,
} from "@manifesto-ai/memory";
import type { Snapshot } from "@manifesto-ai/core";

class InMemoryStore implements MemoryStore {
  private data: Map<string, { snapshot: Snapshot; hash: string }>;

  constructor() {
    this.data = new Map();
  }

  async exists(ref: MemoryRef): Promise<boolean> {
    return this.data.has(ref.worldId);
  }

  async getSnapshot(ref: MemoryRef): Promise<Snapshot | null> {
    const entry = this.data.get(ref.worldId);
    return entry?.snapshot ?? null;
  }

  async getHash(ref: MemoryRef): Promise<string | null> {
    const entry = this.data.get(ref.worldId);
    return entry?.hash ?? null;
  }

  // For testing
  store(worldId: string, snapshot: Snapshot) {
    const hash = computeHash(snapshot);
    this.data.set(worldId, { snapshot, hash });
  }
}
```

---

## Using Verifiers

### Existence Verification

```typescript
import {
  ExistenceVerifier,
  MemoryStore,
  createMemoryRef,
} from "@manifesto-ai/memory";

const verifier = new ExistenceVerifier();
const store: MemoryStore = new InMemoryStore();

// Prove existence
const ref = createMemoryRef("world-123");
const proof = await verifier.prove(ref, store);

console.log("Exists:", proof.valid);
console.log("Method:", proof.method); // "existence"
```

### Hash Verification

```typescript
import { HashVerifier } from "@manifesto-ai/memory";

const verifier = new HashVerifier();
const proof = await verifier.prove(ref, store);

if (proof.valid) {
  console.log("Hash:", proof.data.hash);
  console.log("Algorithm:", proof.data.algorithm); // "sha256"
}
```

### Merkle Verification

```typescript
import { MerkleVerifier } from "@manifesto-ai/memory";

const verifier = new MerkleVerifier();
const proof = await verifier.prove(ref, store);

if (proof.valid) {
  console.log("Root:", proof.data.root);
  console.log("Path:", proof.data.path);
  console.log("Leaf:", proof.data.leaf);
}

// Later: verify the proof
const isValid = await verifier.verify(proof, store);
```

---

## Working with Traces

### Creating Traces

```typescript
import {
  createMemoryTrace,
  attachTrace,
  validateTrace,
} from "@manifesto-ai/memory";

// 1. Create initial trace before selection
const trace = createMemoryTrace({
  atWorldId: "my-world",
  selector: { actorId: "user-1", kind: "human" },
  query: "find related schemas",
  constraints: { maxResults: 10 },
});

// 2. Perform selection
const result = await selector.select(request);

// 3. Attach result to trace
const finalTrace = attachTrace(trace, result);

// 4. Validate trace structure
if (!validateTrace(finalTrace)) {
  console.error("Invalid trace structure");
}

// 5. Store trace for audit
await auditLog.store(finalTrace);
```

### Trace Contents

```typescript
console.log("Trace ID:", finalTrace.traceId);
console.log("Query:", finalTrace.query);
console.log("Selected count:", finalTrace.selectedCount);
console.log("Duration:", finalTrace.durationMs, "ms");
console.log("Degraded:", finalTrace.degraded);

for (const memory of finalTrace.selected) {
  console.log(`  - ${memory.ref.worldId}: ${memory.reason}`);
  console.log(`    Confidence: ${memory.confidence}`);
  console.log(`    Verified: ${memory.verified}`);
}
```

---

## Selection Constraints

### Applying Constraints

```typescript
const request: SelectionRequest = {
  query: "user authentication",
  atWorldId: "my-world",
  selector: { actorId: "agent-1", kind: "agent" },
  constraints: {
    // Limit results
    maxResults: 5,

    // Minimum confidence
    minConfidence: 0.7,

    // Only verified memories
    requireVerified: true,

    // Require evidence
    requireEvidence: true,

    // Time range
    timeRange: {
      after: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
      before: Date.now(),
    },
  },
};
```

### Constraint Processing Order

```typescript
class MySelector implements MemorySelector {
  async select(request: SelectionRequest): Promise<SelectionResult> {
    let candidates = await this.findCandidates(request.query);
    const c = request.constraints;

    if (c) {
      // 1. Time range
      if (c.timeRange) {
        candidates = candidates.filter((m) => {
          const ts = this.getTimestamp(m);
          if (c.timeRange!.after && ts < c.timeRange!.after) return false;
          if (c.timeRange!.before && ts > c.timeRange!.before) return false;
          return true;
        });
      }

      // 2. Confidence
      if (c.minConfidence !== undefined) {
        candidates = candidates.filter(
          (m) => m.confidence >= c.minConfidence!
        );
      }

      // 3. Verification
      if (c.requireVerified) {
        candidates = candidates.filter((m) => m.verified);
      }

      // 4. Evidence
      if (c.requireEvidence) {
        candidates = candidates.filter((m) => m.evidence !== undefined);
      }

      // 5. Limit
      if (c.maxResults) {
        candidates = candidates.slice(0, c.maxResults);
      }
    }

    return { selected: candidates, selectedAt: Date.now() };
  }
}
```

---

## Graceful Degradation

### Handling Missing Memory

```typescript
import { EMPTY_MEMORY_CONTENT } from "@manifesto-ai/memory";

async function fetchMemoryContent(
  selector: MemorySelector | undefined,
  query: string
): Promise<MemoryStageResult> {
  // No selector configured
  if (!selector) {
    return {
      content: EMPTY_MEMORY_CONTENT,
      degraded: true,
      degradeReason: "SELECTOR_NOT_CONFIGURED",
      durationMs: 0,
    };
  }

  try {
    const result = await selector.select({
      query,
      atWorldId: currentWorldId,
      selector: currentActor,
    });

    // No results found
    if (result.selected.length === 0) {
      return {
        content: EMPTY_MEMORY_CONTENT,
        degraded: true,
        degradeReason: "NO_RESULTS",
        durationMs: Date.now() - startTime,
      };
    }

    // Success
    return {
      content: await fetchContent(result.selected),
      degraded: false,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    // Store unavailable
    return {
      content: EMPTY_MEMORY_CONTENT,
      degraded: true,
      degradeReason: "STORE_UNAVAILABLE",
      durationMs: Date.now() - startTime,
    };
  }
}
```

---

## Best Practices

### 1. Always Provide Reason

```typescript
// Good: descriptive reason
{
  ref: createMemoryRef("world-123"),
  reason: "Contains similar user schema definition",
  confidence: 0.85,
  verified: true,
}

// Bad: vague reason
{
  ref: createMemoryRef("world-123"),
  reason: "matched",  // Not helpful
  confidence: 0.85,
  verified: true,
}
```

### 2. Include Evidence for Important Decisions

```typescript
const memory: SelectedMemory = {
  ref,
  reason: "Critical schema reference",
  confidence: 0.95,
  verified: true,
  evidence: {
    method: "hash",
    proof: await hashVerifier.prove(ref, store),
    verifiedAt: Date.now(),
    verifiedBy: { actorId: "system", kind: "system" },
  },
};
```

### 3. Use Traces for Audit

```typescript
// Always create and store traces
const trace = createMemoryTrace(request);
const result = await selector.select(request);
const finalTrace = attachTrace(trace, result);

// Store for audit
await auditStore.save(finalTrace);

// Return result
return result;
```

### 4. Handle Non-Determinism

```typescript
// Don't assume same results
const result1 = await selector.select(request);
const result2 = await selector.select(request);

// result1 may !== result2 (by design)

// If you need consistency, cache results
const cached = cache.get(request.query);
if (cached) return cached;

const result = await selector.select(request);
cache.set(request.query, result, TTL);
return result;
```

---

## Debugging

### Inspecting Selection Results

```typescript
const result = await selector.select(request);

console.log("Selected:", result.selected.length, "memories");
console.log("At:", new Date(result.selectedAt).toISOString());

for (const m of result.selected) {
  console.log(`\n--- ${m.ref.worldId} ---`);
  console.log("Reason:", m.reason);
  console.log("Confidence:", m.confidence);
  console.log("Verified:", m.verified);
  if (m.evidence) {
    console.log("Evidence method:", m.evidence.method);
    console.log("Verified at:", new Date(m.evidence.verifiedAt).toISOString());
  }
}
```

### Validating Constraints

```typescript
import { SelectionConstraints } from "@manifesto-ai/memory";

// Validate before use
const result = SelectionConstraints.safeParse(constraints);

if (!result.success) {
  console.error("Invalid constraints:", result.error.format());
}
```

---

## Related Guides

- [Translator Guide](/packages/translator/GUIDE) - Using memory with Translator
- [World Guide](/specifications/world-spec) - WorldId and ActorRef
- [Core Guide](/specifications/core-spec) - Snapshot structure
