# @manifesto-ai/memory Functional Design Rationale

This document explains the **why** behind Memory's design decisions.

---

## FDR-M001: Non-Determinism by Design

### Decision

Memory selection is intentionally NON-DETERMINISTIC.

### Context

Traditional databases provide deterministic queries:

```sql
SELECT * FROM memories WHERE topic = 'schema' ORDER BY created_at DESC LIMIT 5;
-- Always returns same results for same data
```

Should Memory selection be deterministic?

### Rationale

**Memory selection is fundamentally different:**

1. **Vector similarity** varies with embedding model versions
2. **Recency bias** changes relevance over time
3. **New memories** appear between calls
4. **LLM-based ranking** is inherently non-deterministic

```typescript
// Same query, different times
const result1 = await selector.select({ query: "user schema" });
const result2 = await selector.select({ query: "user schema" });
// result1.selected may !== result2.selected (by design)
```

**Benefits of non-determinism:**

| Benefit | Description |
|---------|-------------|
| Fresh context | New memories immediately available |
| Adaptive relevance | Recency affects selection |
| Model flexibility | Can upgrade embeddings without API change |
| Realistic behavior | Matches human memory retrieval |

### Consequences

- Results may vary between calls
- Caching requires explicit TTL decisions
- Traces capture exact selection for audit
- Applications must handle variation

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Deterministic by default | Forces stale results |
| Seed-based determinism | Complexity, doesn't reflect reality |
| Hash-based caching | Stale context problem |

---

## FDR-M002: Reference-Only Pattern

### Decision

Memory returns references, not content.

### Context

When Memory selects relevant memories, what should it return?

```typescript
// Option A: Full content
{ worldId: "...", content: { /* full snapshot */ } }

// Option B: Reference only
{ ref: { worldId: "..." }, reason: "...", confidence: 0.8 }
```

### Rationale

**Separation of concerns:**

```
Memory Selection:  "What is relevant?"
Content Fetching:  "What does it contain?"
```

**Benefits of reference-only:**

1. **Lightweight selection**: No large payloads during search
2. **Lazy loading**: Fetch content only when needed
3. **Access control**: Content fetch can enforce permissions
4. **Caching**: References cacheable, content fetched fresh

**The two-step pattern:**

```typescript
// Step 1: Select references (fast, lightweight)
const result = await selector.select({ query });
// result.selected = [{ ref, reason, confidence }, ...]

// Step 2: Fetch content (on-demand)
const content = await fetcher.fetch(result.selected, query);
```

### Consequences

- Two-step API (select, then fetch)
- MemoryContentFetcher interface required
- Content structure application-defined
- Efficient for large World snapshots

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Full content in selection | Large payloads, slow selection |
| Streaming content | Complexity, harder to reason about |
| Content alongside reference | Mixed concerns, inflexible |

---

## FDR-M003: Verification Evidence

### Decision

Selected memories include optional verification evidence.

### Context

How do we know a memory reference is valid?

### Rationale

**Trust but verify:**

Memory selection involves:
- LLM-based ranking (non-deterministic)
- Vector similarity (approximate)
- External stores (potentially stale)

Evidence provides cryptographic proof:

```typescript
interface VerificationEvidence {
  method: "existence" | "hash" | "merkle";
  proof: VerificationProof;
  verifiedAt: number;
  verifiedBy: ActorRef;
}
```

**Three levels of verification:**

| Method | What it proves | Cost |
|--------|----------------|------|
| Existence | World exists in store | Low |
| Hash | Content unchanged | Medium |
| Merkle | Cryptographic inclusion | High |

**Evidence enables:**

1. **Authority inspection**: Governance can verify claims
2. **Audit trail**: Proof of what was used
3. **Trust gradation**: Higher evidence for critical decisions

### Consequences

- Evidence is optional (graceful degradation)
- Three verifier implementations
- `requireEvidence` constraint available
- Evidence stored in trace

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Always required | Blocks basic usage |
| Trust blindly | No governance integration |
| External verification only | Tight coupling |

---

## FDR-M004: Graceful Degradation (MEM-006a)

### Decision

Memory absence triggers degradation, NOT failure.

### Context

What happens when Memory is unavailable?

```typescript
// Scenarios:
// 1. No MemorySelector configured
// 2. Store connection failed
// 3. Selection timed out
// 4. No results found
```

### Rationale

**Memory enhances, doesn't gate:**

```typescript
// Bad: Memory required
if (!memorySelector) {
  throw new Error("Memory required");  // Blocks usage
}

// Good: Degraded operation
if (!memorySelector) {
  return {
    content: EMPTY_MEMORY_CONTENT,
    degraded: true,
    degradeReason: "SELECTOR_NOT_CONFIGURED",
  };
}
```

**Progressive enhancement model:**

```
Full Memory    → Best quality translation
Partial Memory → Reduced quality, works
No Memory      → Basic translation, works
```

**Degradation reasons:**

| Reason | Condition |
|--------|-----------|
| `SELECTOR_NOT_CONFIGURED` | No selector provided |
| `STORE_UNAVAILABLE` | Connection failed |
| `TIMEOUT` | Selection exceeded time limit |
| `NO_RESULTS` | Query returned empty |

### Consequences

- Translation works without Memory
- Quality improves with Memory
- Degradation observable in result
- No hard infrastructure dependency

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Required Memory | Complex setup, blocks basic usage |
| Silent fallback | Hides quality issues |
| Hard failure | Poor developer experience |

---

## FDR-M005: Actor-Based Access Control

### Decision

Memory access is controlled by Actor identity.

### Context

Who can select memories? From which Worlds?

### Rationale

**World Protocol integration:**

Memory operates within World Protocol:

```typescript
interface SelectionRequest {
  query: string;
  atWorldId: WorldId;    // Current context
  selector: ActorRef;    // Who is selecting
  constraints?: SelectionConstraints;
}
```

**Access matrix:**

| Module | Memory Access |
|--------|---------------|
| Actor | Full access |
| Projection | Forbidden (M-10) |
| Authority | Forbidden (M-4) |
| Host | Forbidden |
| Core | Forbidden |

**Why restrict access:**

1. **Actors** need memory for context-aware decisions
2. **Projections** are pure functions (no side effects)
3. **Authorities** evaluate proposals (can't query)
4. **Host** executes effects (not queries)
5. **Core** is pure computation

### Consequences

- `selector` field required in request
- Access control enforced by World
- Audit trail includes actor identity
- Projection purity preserved

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Open access | No governance |
| World-level only | Too coarse-grained |
| Per-memory ACLs | Too complex |

---

## FDR-M006: Trace-Based Audit

### Decision

All memory operations produce audit traces.

### Context

How do we audit memory selection decisions?

### Rationale

**Memory selection is opaque:**

```typescript
// What happened inside?
const result = await selector.select(request);
// Why these results? What was considered?
```

**Traces provide full visibility:**

```typescript
interface MemoryTrace {
  traceId: string;
  selector: ActorRef;
  atWorldId: WorldId;
  query: string;
  constraints?: SelectionConstraints;
  selected: SelectedMemory[];
  selectedCount: number;
  degraded: boolean;
  degradeReason?: string;
  durationMs: number;
  timestamp: number;
}
```

**Trace benefits:**

| Benefit | Description |
|---------|-------------|
| Reproducibility | Understand past decisions |
| Debugging | Why was this selected? |
| Compliance | Audit trail for governance |
| Performance | Duration tracking |

### Consequences

- `createMemoryTrace()` utility provided
- Traces stored by application
- Full selection details captured
- Degradation recorded

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| No tracing | No audit capability |
| Optional tracing | Inconsistent audit trail |
| External logging only | No structured data |

---

## FDR-M007: Constraint-Based Filtering

### Decision

Selection constraints are declarative, not procedural.

### Context

How should applications control memory selection?

### Rationale

**Declarative constraints:**

```typescript
const constraints: SelectionConstraints = {
  maxResults: 5,
  minConfidence: 0.7,
  requireVerified: true,
  requireEvidence: true,
  timeRange: {
    after: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
};
```

**Benefits of declarative:**

1. **Portable**: Same constraints work across implementations
2. **Inspectable**: Can audit what was requested
3. **Composable**: Combine multiple constraints
4. **Optimizable**: Selector can optimize execution

**Ordered application:**

Constraints MUST be applied in order:
1. Time range filtering
2. Confidence filtering
3. Verification filtering
4. Evidence filtering
5. Result limiting

### Consequences

- `SelectionConstraints` schema defined
- Order of application specified
- Selector implementations must respect order
- Constraints visible in trace

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Procedural filters | Not portable, can't optimize |
| SQL-like DSL | Too complex |
| Callback-based | Hard to audit |

---

## FDR-M008: Store Interface Minimalism

### Decision

MemoryStore interface is minimal (3 required methods).

### Context

What should the Store interface look like?

### Rationale

**Minimal surface area:**

```typescript
interface MemoryStore {
  exists(ref: MemoryRef): Promise<boolean>;
  getSnapshot(ref: MemoryRef): Promise<Snapshot | null>;
  getHash(ref: MemoryRef): Promise<string | null>;
  getMerkleRoot?(ref: MemoryRef): Promise<string | null>;  // Optional
}
```

**Why minimal:**

1. **Easy implementation**: Any backend can implement
2. **Consistent behavior**: Few methods, clear contract
3. **Flexible storage**: SQL, NoSQL, file, memory
4. **Testable**: Simple mock implementation

**No write methods:**

Store is read-only by design (invariant M-5):
- Memory MUST NOT mutate past Worlds
- Write operations are World Protocol concern
- Verifiers need read-only access

### Consequences

- Simple implementation requirement
- Read-only access enforced
- Optional Merkle support
- Backend-agnostic

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Full CRUD | Violates read-only invariant |
| Query interface | Too complex |
| Event sourcing | Different concern |

---

## Summary

| FDR | Decision | Key Rationale |
|-----|----------|---------------|
| M001 | Non-Determinism | Matches reality of memory retrieval |
| M002 | Reference-Only | Separation of selection and fetching |
| M003 | Verification Evidence | Trust gradation for governance |
| M004 | Graceful Degradation | Enhance, don't gate |
| M005 | Actor-Based Access | World Protocol integration |
| M006 | Trace-Based Audit | Full visibility for compliance |
| M007 | Constraint-Based Filtering | Declarative, portable, auditable |
| M008 | Store Minimalism | Easy implementation, flexible backend |

---

*End of @manifesto-ai/memory FDR*
