# @manifesto-ai/memory

> **Status:** Deprecated (v2 focuses on Core/Host/World/App). This package is legacy and may be removed.


> **Memory** is the retrieval layer for past World/Snapshot information in Manifesto.

---

## What is Memory?

Memory provides a 4-Layer Architecture for searching and using past World information. It operates as an **optional layer** between Actors and World Protocol.

In the Manifesto architecture:

```
Actor ──→ MEMORY ──→ World Protocol
              │
     Retrieves past Worlds
     Traces selection decisions
```

---

## What Memory Does

| Responsibility | Description |
|----------------|-------------|
| Store | Persist and retrieve World objects |
| Verify | Pure function verification of World existence/integrity |
| Select | Find relevant past Worlds based on queries |
| Trace | Record selection decisions for accountability |

---

## What Memory Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Execute effects | Host |
| Apply patches | Host |
| Make governance decisions | World |
| Compute state transitions | Core |

---

## Installation

```bash
npm install @manifesto-ai/memory
# or
pnpm add @manifesto-ai/memory
```

### Peer Dependencies

```bash
npm install @manifesto-ai/world  # Required peer
```

---

## Quick Example

```typescript
import {
  InMemoryStore,
  createExistenceVerifier,
  createSimpleSelector,
  createMemoryTrace,
  attachToProposal,
} from "@manifesto-ai/memory";
import type { ActorRef } from "@manifesto-ai/world";

// Setup
const store = new InMemoryStore();
const verifier = createExistenceVerifier();
const selector = createSimpleSelector(store, verifier);

// Index a World
store.put(world);
selector.addToIndex(world.worldId, ["keyword1", "keyword2"], world.createdAt);

// Select relevant memories
const actor: ActorRef = { actorId: "agent-1", kind: "agent" };
const result = await selector.select({
  query: "keyword1",
  atWorldId: currentWorld.worldId,
  selector: actor,
  constraints: { maxResults: 5, minConfidence: 0.7 },
});

// Create trace and attach to proposal
const trace = createMemoryTrace(
  actor,
  "keyword1",
  currentWorld.worldId,
  result.selected
);
const proposalWithMemory = attachToProposal(proposal, trace);
```

> See [GUIDE.md](./docs/GUIDE.md) for the full tutorial.

---

## Core Concepts

### Memory ≠ Truth

Memory is a **reference** to past Worlds, not the truth itself. The referenced World is the source of truth.

### Selection is Non-deterministic but Traced

Memory selection may involve LLM-based ranking or other non-deterministic processes. However, every selection MUST be recorded in a `MemoryTrace` for accountability.

### Verifier MUST be Pure

Verifiers are pure functions with no side effects:
- No Store access
- No IO (network, filesystem)
- No `Date.now()`
- Same inputs always produce same outputs

---

## API Overview

### Interfaces

```typescript
// Store - Persists and retrieves Worlds
interface MemoryStore {
  get(worldId: WorldId): Promise<World | null>;
  exists(worldId: WorldId): Promise<boolean>;
}

// Verifier - Pure function verification (M-8)
interface MemoryVerifier {
  prove(memory: MemoryRef, world: World): ProveResult;
  verifyProof(proof: VerificationProof): boolean;
}

// Selector - Finds relevant past Worlds
interface MemorySelector {
  select(request: SelectionRequest): Promise<SelectionResult>;
}
```

### Trace Utilities

```typescript
function createMemoryTrace(
  selector: ActorRef,
  query: string,
  atWorldId: WorldId,
  selected: SelectedMemory[]
): MemoryTrace;

function attachToProposal<P extends Proposal>(
  proposal: P,
  trace: MemoryTrace
): P;

function getFromProposal(proposal: Proposal): MemoryTrace | undefined;

// M-12: Extract proof for Authority verification
function extractProof(evidence: VerificationEvidence): VerificationProof;
```

### Verifier Implementations

| Verifier | Complexity | Security | Use Case |
|----------|------------|----------|----------|
| `ExistenceVerifier` | Low | Low | Development/testing |
| `HashVerifier` | Medium | Medium | General production |
| `MerkleVerifier` | High | High | Audit compliance |

> See [SPEC.md](./docs/SPEC-1.2v.md) for complete API reference.

---

## Relationship with Other Packages

```
┌─────────────┐
│    Actor    │ ← Uses Memory to reference past Worlds
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   MEMORY    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    World    │ ← Memory depends on World types
└─────────────┘
```

| Relationship | Package | How |
|--------------|---------|-----|
| Depends on | `@manifesto-ai/world` | Uses WorldId, World, ActorRef, Proposal types |
| Used by | Actor implementations | Actors use Memory to reference past decisions |

---

## Module Boundaries (SPEC §9)

| Module | Store | prove() | verifyProof() | Selector |
|--------|-------|---------|---------------|----------|
| **Actor** | ✅ | ✅ | ✅ | ✅ |
| **Projection** | ❌ | ❌ | ❌ | ❌ |
| **Authority** | ❌ | ❌ | ✅ | ❌ |
| **Host** | ❌ | ❌ | ❌ | ❌ |
| **Core** | ❌ | ❌ | ❌ | ❌ |

---

## When to Use Memory Directly

**Most applications don't need Memory.**

Use Memory directly when:
- Referencing past World states for decision-making
- Tracking decision rationale with verifiable evidence
- Audit compliance requiring proof of past state access
- Building AI agents that need historical context

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](./docs/GUIDE.md) | Step-by-step usage guide |
| [SPEC.md](./docs/SPEC-1.2v.md) | Complete specification |
| [FDR.md](./docs/FDR-1.2.md) | Design rationale |
| [USAGE.md](./docs/USAGE.md) | World integration guide |

---

## License

[MIT](../../LICENSE)
