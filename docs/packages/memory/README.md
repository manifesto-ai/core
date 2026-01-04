# @manifesto-ai/memory

Memory retrieval, verification, and tracing for Manifesto applications.

## Overview

The Memory package provides infrastructure for AI agents to access past World states with verifiable provenance. It enables context-aware decision making while maintaining full audit trails.

### Key Features

- **Memory Selection**: Query and retrieve relevant memories
- **Verification**: Prove memory integrity (Existence, Hash, Merkle)
- **Tracing**: Full audit trail for all memory operations
- **Non-deterministic by Design**: Same query may yield different results

## Installation

```bash
pnpm add @manifesto-ai/memory
```

### Peer Dependencies

```bash
pnpm add @manifesto-ai/world zod
```

## Quick Start

### Implementing MemorySelector

```typescript
import {
  MemorySelector,
  SelectionRequest,
  SelectionResult,
  SelectedMemory,
} from "@manifesto-ai/memory";

class MyMemorySelector implements MemorySelector {
  async select(request: SelectionRequest): Promise<SelectionResult> {
    // 1. Find candidate memories (your search logic)
    const candidates = await this.search(request.query);

    // 2. Apply constraints
    const filtered = candidates.filter((c) => {
      if (request.constraints?.minConfidence) {
        return c.confidence >= request.constraints.minConfidence;
      }
      return true;
    });

    // 3. Limit results
    const limited = request.constraints?.maxResults
      ? filtered.slice(0, request.constraints.maxResults)
      : filtered;

    // 4. Return result
    return {
      selected: limited,
      selectedAt: Date.now(),
    };
  }

  private async search(query: string): Promise<SelectedMemory[]> {
    // Your implementation: vector search, keyword matching, etc.
    return [];
  }
}
```

### Using with Translator

```typescript
import { createTranslatorHost } from "@manifesto-ai/translator";

const host = createTranslatorHost({
  schema,
  worldId: "my-world",
  memorySelector: new MyMemorySelector(),
  memoryContentFetcher: {
    async fetch(selected, query) {
      // Fetch content from selected memories
      return {
        translationExamples: [...],
        schemaHistory: [...],
        glossaryTerms: [...],
        resolutionHistory: [...],
      };
    },
  },
});
```

## Core Types

### MemoryRef

```typescript
interface MemoryRef {
  worldId: WorldId;
}
```

### SelectedMemory

```typescript
interface SelectedMemory {
  ref: MemoryRef;
  reason: string;
  confidence: number;  // 0-1
  verified: boolean;
  evidence?: VerificationEvidence;
}
```

### SelectionRequest

```typescript
interface SelectionRequest {
  query: string;
  atWorldId: WorldId;
  selector: ActorRef;
  constraints?: SelectionConstraints;
}
```

### SelectionConstraints

```typescript
interface SelectionConstraints {
  maxResults?: number;
  minConfidence?: number;
  requireVerified?: boolean;
  requireEvidence?: boolean;
  timeRange?: {
    after?: number;
    before?: number;
  };
}
```

## Verification

### Verifier Interface

```typescript
interface MemoryVerifier<T extends VerificationMethod> {
  method: T;
  prove(ref: MemoryRef, store: MemoryStore): Promise<VerificationProof>;
  verify(proof: VerificationProof, store: MemoryStore): Promise<boolean>;
}
```

### Built-in Verifiers

| Verifier | Description |
|----------|-------------|
| `ExistenceVerifier` | Checks if World exists |
| `HashVerifier` | Verifies content hash |
| `MerkleVerifier` | Cryptographic Merkle proof |

## Trace Utilities

```typescript
import { createMemoryTrace, attachTrace } from "@manifesto-ai/memory";

// Create trace
const trace = createMemoryTrace({
  atWorldId: "my-world",
  selector: { actorId: "user-1", kind: "human" },
  query: "find related schemas",
});

// After selection, attach result
const finalTrace = attachTrace(trace, selectionResult);
```

## Related Packages

- [`@manifesto-ai/core`](../core) - Core compute engine
- [`@manifesto-ai/world`](../world) - World protocol
- [`@manifesto-ai/translator`](../translator) - Natural language translation

## License

MIT
