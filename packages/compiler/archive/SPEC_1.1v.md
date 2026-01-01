# @manifesto-ai/compiler Specification v1.1

> **Version:** 1.1
> **Status:** Normative
> **Role:** LLM-Assisted Deterministic Compiler
> **Architecture:** Fragment Pipeline
> **Philosophy:** *LLM proposes fragments. Deterministic pipeline assembles. Resolution is structural.*

---

## §1. Overview

### 1.1 Purpose

`@manifesto-ai/compiler` transforms **SourceInput** (natural language, code, or mixed) into a verified **DomainSpec** artifact by:

1. Using LLMs only to propose **Plans** and **FragmentDrafts**
2. Converting drafts into verified Fragments via deterministic lowering
3. Building a dependency DAG and performing semantic topological sorting
4. Verifying structure and provenance deterministically
5. Emitting a final immutable DomainSpec

### 1.2 Hard Rule (Constitutional)

> **LLM MUST NOT output DomainSchema/DomainSpec directly.**

LLM outputs are limited to:
- `Plan` proposals
- `FragmentDraft[]` proposals
- (Optional) `confidence` + provenance hints

All adoption decisions MUST occur through deterministic pipeline stages.

### 1.3 Changes from v1.0

| Aspect | v1.0 | v1.1 |
|--------|------|------|
| LLM output | `DomainDraft` (entire schema) | `Plan` + `FragmentDraft[]` |
| Assembly responsibility | LLM | Deterministic pipeline |
| Resolution trigger | LLM declares "ambiguous" | Linker/Verifier detects conflict |
| Retry unit | Entire | Per-Fragment |
| Trust boundary | LLM proposes structure | LLM proposes fragments only |

### 1.4 Design Principles

```
"LLM proposes fragments.
 Pipeline assembles.
 Conflicts are detected structurally.
 Resolution is decided externally."
```

| Component | Role |
|-----------|------|
| PlannerActor (LLM) | Proposes splitting strategy |
| GeneratorActor (LLM) | Proposes fragment drafts |
| Judge (Pipeline) | Deterministic validation and assembly |
| Authority (ITL) | Conflict resolution |

---

## §2. Architecture

### 2.1 Pipeline (Normative)

```
 SourceInput
     │
     ▼
┌─────────────────────┐
│   PlannerActor      │  LLM (untrusted)
│   (LLM)             │
└──────────┬──────────┘
           │ Plan (proposal)
           ▼
┌─────────────────────┐
│   Authority         │  ITL (HITL/AITL)
│   .decidePlan()     │
└──────────┬──────────┘
           │ accepted Plan + Chunks
           ▼
┌─────────────────────┐
│   GeneratorActor    │  LLM (untrusted)
│   (LLM)             │
└──────────┬──────────┘
           │ FragmentDraft[] (proposals)
           ▼
┌─────────────────────┐
│   Authority         │  ITL
│   .decideDrafts()   │
└──────────┬──────────┘
           │ accepted drafts
           ▼
╔═════════════════════╗
║       JUDGE         ║  Deterministic Pipeline
╠═════════════════════╣
║                     ║
║   PassLayer         ║  FragmentDraft → Fragment
║        │            ║  (lowering + validation)
║        ▼            ║
║   Linker            ║  Fragment[] → DAG → DomainDraft
║        │            ║  (conflict detection)
║        ▼            ║
║   [Resolution?]     ║  If conflicts → Authority
║        │            ║
║        ▼            ║
║   Verifier          ║  DomainDraft → Issues[]
║        │            ║  (structural verification)
║        ▼            ║
║   Emitter           ║  DomainDraft → DomainSpec
║                     ║  (immutable output)
╚══════════┬══════════╝
           │
           ▼
      DomainSpec (immutable)
```

### 2.2 Judge Definition

The **Judge** is the deterministic sequence:

1. **PassLayer** — Lowers Draft to Fragment
2. **Linker** — Assembles Fragments, detects conflicts
3. **Verifier** — Validates structure
4. **Emitter** — Produces immutable output

LLM never judges itself.

### 2.3 Resolution (ITL)

When multiple valid interpretations exist, or conflicts cannot be auto-merged, the compiler MUST request resolution from an external resolver:

- **HITL** — Human decides
- **AITL** — Another LLM decides
- **Consensus** — Multi-agent voting
- **Tribunal** — Rule-based judgment
- **Policy-based Authority** — Automatic decision by policy

Authority evaluates and selects; it never executes.

---

## §3. Core Types

### 3.1 SourceInput

```typescript
type SourceInput = {
  id: string;
  type: 'natural-language' | 'code' | 'mixed';
  content: string;
  language?: string;           // e.g., 'typescript', 'python'
  receivedAt: number;          // timestamp
};
```

### 3.2 Plan & Chunk

```typescript
type PlanStrategy =
  | 'by-statement'    // Split by statement
  | 'by-entity'       // Split by entity
  | 'by-layer'        // Split by layer (state → computed → action)
  | 'single'          // Single chunk
  | 'custom';         // Custom strategy

type Plan = {
  id: string;
  sourceInputId: string;
  strategy: PlanStrategy;
  chunks: Chunk[];
  rationale?: string;          // LLM's explanation for the split
  status: 'pending' | 'accepted' | 'rejected';
};

type Chunk = {
  id: string;
  content: string;             // Portion of original input
  expectedType: FragmentType;  // Expected Fragment type
  dependencies: ChunkDependency[];
  sourceSpan?: {               // Position in original
    start: number;
    end: number;
  };
};

type ChunkDependency = {
  kind: 'requires';
  targetChunkId: string;
  reason?: string;
};
```

### 3.3 FragmentDraft (UNTRUSTED)

```typescript
type FragmentType =
  | 'state'           // State field definition
  | 'computed'        // Computed value definition
  | 'constraint'      // Constraint rule
  | 'effect'          // Effect declaration
  | 'action'          // Action definition
  | 'flow';           // Flow definition

type FragmentDraft = {
  id: string;
  chunkId: string;
  type: FragmentType;
  interpretation: {
    raw: unknown;              // LLM-proposed structure
    description?: string;      // LLM's interpretation explanation
  };
  confidence?: number;         // 0-1, LLM's self-confidence
  alternatives?: {             // Alternative interpretations
    raw: unknown;
    description?: string;
  }[];
  status: 'pending' | 'accepted' | 'rejected';
};
```

### 3.4 Fragment (VERIFIED)

```typescript
type Fragment = {
  id: string;
  type: FragmentType;
  path: string;                // Semantic path (e.g., "state.count")
  requires: string[];          // Paths this fragment depends on (reads)
  provides: string[];          // Paths this fragment defines (writes)
  content: FragmentContent;    // Type-specific normalized content
  provenance: Provenance;
};

type FragmentContent =
  | StateFragmentContent
  | ComputedFragmentContent
  | ConstraintFragmentContent
  | EffectFragmentContent
  | ActionFragmentContent
  | FlowFragmentContent;

type StateFragmentContent = {
  kind: 'state';
  name: string;
  schema: unknown;             // Zod-like schema definition
  initial?: unknown;
};

type ComputedFragmentContent = {
  kind: 'computed';
  name: string;
  expression: unknown;         // Expression definition
  dependencies: string[];      // States/computeds this depends on
};

type ActionFragmentContent = {
  kind: 'action';
  name: string;
  input: unknown;              // Input schema
  available?: unknown;         // Availability expression
  flow: unknown;               // Flow definition
};

// ... other FragmentContent types
```

### 3.5 Provenance

```typescript
type Provenance = {
  source: 'natural-language' | 'code' | 'manual';
  inputId: string;             // SourceInput.id
  inputSpan?: {
    start: number;
    end: number;
  };
  chunkId: string;
  fragmentDraftId: string;
  actorId: string;             // LLM actor that generated this
  runtimeId: string;           // Compilation session ID
  timestamp: number;

  // Tracing information
  planId: string;
  passLayerVersion: string;
  linkerVersion: string;
};
```

### 3.6 DomainDraft

```typescript
type DomainDraft = {
  id: string;
  fragments: Fragment[];

  // Assembled structure
  assembled: {
    state: Record<string, unknown>;
    computed: Record<string, unknown>;
    actions: Record<string, unknown>;
    constraints: unknown[];
  };

  // DAG information
  dependencyGraph: {
    nodes: string[];           // Fragment IDs
    edges: Array<{
      from: string;
      to: string;
      kind: 'requires';
    }>;
    topologicalOrder: string[];
  };

  // Metadata
  sourceInputId: string;
  planId: string;
};
```

### 3.7 DomainSpec (Final Output)

```typescript
type DomainSpec = {
  id: string;
  version: string;
  hash: string;                // Content hash for integrity

  // Final schema
  schema: {
    state: unknown;
    computed: Record<string, unknown>;
    actions: Record<string, unknown>;
  };

  // Provenance tracking
  provenance: {
    sourceInputId: string;
    planId: string;
    fragmentIds: string[];
    compiledAt: number;
    compilerVersion: string;
  };

  // Verification result
  verification: {
    valid: true;
    issues: Issue[];           // warnings, info only
  };
};
```

### 3.8 Conflicts

```typescript
type ConflictType =
  | 'duplicate_path'           // Two Fragments define same path
  | 'type_mismatch'            // Same path with different types
  | 'missing_dependency'       // requires not provided
  | 'circular_dependency';     // Circular reference

type Conflict = {
  id: string;
  type: ConflictType;
  message: string;
  fragmentIds: string[];       // Fragments involved in conflict
  path?: string;               // Path where conflict occurred
  details: unknown;            // Type-specific details
};
```

### 3.9 Issues

```typescript
type IssueSeverity = 'error' | 'warning' | 'info';

type Issue = {
  id: string;
  code: string;                // e.g., 'E001', 'W002'
  severity: IssueSeverity;
  message: string;
  fragmentId?: string;
  path?: string;
  location?: {
    line?: number;
    column?: number;
  };
  suggestion?: string;
};
```

---

*[Full spec continues with all sections from the original document]*

---

*End of @manifesto-ai/compiler Specification v1.1*
