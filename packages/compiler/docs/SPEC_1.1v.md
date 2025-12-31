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

## §4. Actors (LLM Roles)

### 4.1 PlannerActor

**Role:** Analyzes SourceInput and proposes a splitting strategy.

```typescript
type PlannerActor = {
  id: string;
  kind: 'llm';
  
  plan(input: PlanRequest): Promise<PlanResponse>;
};

type PlanRequest = {
  sourceInput: SourceInput;
  hints?: {
    preferredStrategy?: PlanStrategy;
    maxChunks?: number;
  };
};

type PlanResponse = 
  | { ok: true; plan: Plan }
  | { ok: false; error: string };
```

**Constraints (MUST NOT):**
- Generate Fragments directly
- Generate DomainDraft/DomainSpec
- Self-validate its Plan

### 4.2 GeneratorActor

**Role:** Proposes FragmentDrafts for each Chunk in the accepted Plan.

```typescript
type GeneratorActor = {
  id: string;
  kind: 'llm';
  
  generate(input: GenerateRequest): Promise<GenerateResponse>;
};

type GenerateRequest = {
  chunk: Chunk;
  plan: Plan;                  // Context
  previousFragments?: Fragment[]; // Already confirmed Fragments
  hints?: {
    retryContext?: {
      previousDraft: FragmentDraft;
      issues: Issue[];
    };
  };
};

type GenerateResponse = 
  | { ok: true; drafts: FragmentDraft[] }  // Multiple alternatives possible
  | { ok: false; error: string };
```

**Constraints (MUST NOT):**
- Generate or modify Plans
- Generate DomainDraft/DomainSpec directly
- Generate Fragments for other Chunks

---

## §5. Deterministic Stages (Judge)

### 5.1 PassLayer

**Role:** Validates and lowers `FragmentDraft` to `Fragment`.

```typescript
type PassLayer = {
  lower(draft: FragmentDraft, context: PassContext): PassResult;
};

type PassContext = {
  sourceInput: SourceInput;
  chunk: Chunk;
  existingFragments: Fragment[];
};

type PassResult = 
  | { ok: true; fragment: Fragment }
  | { ok: false; issues: Issue[] };
```

**Responsibilities (MUST):**
- Deterministically convert `FragmentDraft.interpretation.raw` into typed FragmentContent
- Emit Issues for malformed/unsupported draft shapes
- Attach Provenance
- Infer `requires`/`provides` from content analysis

**Determinism Guarantee:**
- Same Draft + Same Context → Same Fragment or Same Issues

### 5.2 Linker

**Role:** Assembles Fragment[] into DomainDraft and detects conflicts.

```typescript
type Linker = {
  link(fragments: Fragment[], context: LinkContext): LinkResult;
};

type LinkContext = {
  sourceInput: SourceInput;
  plan: Plan;
};

type LinkResult = 
  | { ok: true; domainDraft: DomainDraft }
  | { ok: 'conflict'; conflicts: Conflict[] }
  | { ok: false; issues: Issue[] };
```

**Responsibilities (MUST):**
- Construct semantic dependency graph using `path`, `requires`, `provides`
- Perform topological sorting for stable assembly order
- Detect conflicts and missing dependencies
- MUST NOT auto-merge conflicts in v1.1
- MUST request Resolution if conflicts exist

**Conflict Detection Rules:**

| Conflict Type | Detection Condition |
|---------------|---------------------|
| `duplicate_path` | Two Fragments `provides` the same path |
| `type_mismatch` | Same path with different type definitions |
| `missing_dependency` | Fragment `requires` a path that no Fragment `provides` |
| `circular_dependency` | Topological sort impossible (cycle exists) |

### 5.3 Verifier

**Role:** Validates the structural correctness of DomainDraft.

```typescript
type Verifier = {
  verify(domainDraft: DomainDraft, context: VerifyContext): VerifyResult;
};

type VerifyContext = {
  sourceInput: SourceInput;
  plan: Plan;
  strictMode?: boolean;
};

type VerifyResult = {
  valid: boolean;
  issues: Issue[];
};
```

**Validation Rules (MUST):**
- Path validity (correct format, reserved word avoidance)
- DAG constraints (no cycles, all dependencies resolved)
- Pattern checks (duplicate semantics, unused definitions)
- Provenance completeness (all Fragments have source)
- Type consistency (expression reference type matching)

**Result Rules:**
- If any `error` severity Issue exists → `valid: false`
- If only `warning`/`info` → `valid: true`

### 5.4 Emitter

**Role:** Converts DomainDraft to immutable DomainSpec.

```typescript
type Emitter = {
  emit(domainDraft: DomainDraft, verification: VerifyResult): EmitResult;
};

type EmitResult = 
  | { ok: true; domainSpec: DomainSpec }
  | { ok: false; reason: string };
```

**Responsibilities (MUST):**
- Only emit DomainDraft that passed verification (MUST)
- Produce immutable DomainSpec
- Calculate content hash
- Attach version and metadata

**Determinism Guarantee:**
- Same DomainDraft → Same DomainSpec bytes (identical hash)

---

## §6. Resolution Contract

### 6.1 Resolution Trigger Conditions (MUST)

Resolution MUST be triggered when any of the following occurs:

| Stage | Trigger Condition |
|-------|-------------------|
| Plan decision | Multiple valid Plan strategies possible |
| Draft decision | Multiple Drafts proposed for same Chunk |
| Linker | Conflicts detected (≥ 1) |
| Verifier | Competing valid interpretations (extension) |

**Key Change:** Resolution is triggered when **the pipeline structurally detects conflicts**, not when LLM declares "I don't know."

### 6.2 ResolutionRequest

```typescript
type ResolutionRequest = {
  id: string;
  stage: 'plan' | 'draft' | 'link' | 'verify';
  reason: string;
  conflicts: Conflict[];
  options: ResolutionOption[];
  context: {
    sourceInputId: string;
    planId?: string;
    fragmentIds?: string[];
  };
};

type ResolutionOption = {
  id: string;
  description: string;
  preview?: string;            // Preview of selection result
  impact: ResolutionImpact;
};

type ResolutionImpact = 
  | { kind: 'accept_plan'; planId: string }
  | { kind: 'reject_plan'; planId: string; reason: string }
  | { kind: 'accept_draft'; draftId: string }
  | { kind: 'reject_draft'; draftId: string; reason: string }
  | { kind: 'select_fragment'; fragmentId: string; rejectIds: string[] }
  | { kind: 'manual_override'; content: unknown };
```

### 6.3 ResolutionResponse

```typescript
type ResolutionResponse = {
  requestId: string;
  selectedOptionId: string;
  decidedBy: {
    kind: 'human' | 'ai' | 'consensus' | 'policy';
    actorId: string;
  };
  timestamp: number;
};
```

### 6.4 Resolution Recording (MUST)

All Resolution decisions MUST be recorded for replay:

```typescript
type ResolutionRecord = {
  request: ResolutionRequest;
  response: ResolutionResponse;
  appliedAt: number;
};
```

---

## §7. Compiler State Machine

The Compiler MAY be implemented as a Manifesto Application with the following states:

### 7.1 States

```typescript
type CompilerStatus = 
  | 'idle'
  | 'planning'              // LLM generating Plan
  | 'awaiting_plan_decision' // Waiting for Plan selection
  | 'drafting'              // LLM generating FragmentDrafts
  | 'awaiting_draft_decision'// Waiting for Draft selection
  | 'lowering'              // PassLayer executing
  | 'linking'               // Linker executing
  | 'awaiting_conflict_resolution' // Waiting for conflict resolution
  | 'verifying'             // Verifier executing
  | 'emitting'              // Emitter executing
  | 'success'               // Complete
  | 'failed';               // Failed
```

### 7.2 State Transitions

```
idle
  │ start(sourceInput)
  ▼
planning
  │ receivePlan(plan)
  ▼
awaiting_plan_decision ◄─────────────────┐
  │ resolvePlan(accepted)                │
  │ resolvePlan(rejected) ───► planning ─┘
  ▼
drafting ◄───────────────────────────────┐
  │ receiveDrafts(drafts)                │
  ▼                                      │
awaiting_draft_decision                  │
  │ resolveDrafts(accepted)              │
  │ resolveDrafts(rejected) ─────────────┘
  ▼
lowering
  │ loweringComplete(fragments)
  │ loweringFailed(issues) ───► failed
  ▼
linking
  │ linkingComplete(domainDraft)
  │ linkingConflict(conflicts) ──┐
  ▼                              ▼
verifying            awaiting_conflict_resolution
  │                              │ resolveConflict(selected)
  │ ◄────────────────────────────┘
  │ verifyComplete(issues)
  │ verifyFailed(issues) ───► failed
  ▼
emitting
  │ emitComplete(domainSpec)
  ▼
success
```

### 7.3 CompilerState Schema

```typescript
const CompilerStateSchema = z.object({
  // ─── Input ───
  sourceInput: SourceInputSchema.nullable(),
  
  // ─── Configuration ───
  config: z.object({
    maxPlanAttempts: z.number().default(3),
    maxDraftAttempts: z.number().default(5),
    maxLoweringRetries: z.number().default(3),
    recordProvenance: z.boolean().default(true),
  }),
  
  // ─── Pipeline State ───
  plan: PlanSchema.nullable(),
  chunks: z.array(ChunkSchema),
  currentChunkIndex: z.number(),
  fragmentDrafts: z.array(FragmentDraftSchema),
  fragments: z.array(FragmentSchema),
  domainDraft: DomainDraftSchema.nullable(),
  
  // ─── Resolution State ───
  pendingResolution: ResolutionRequestSchema.nullable(),
  resolutionHistory: z.array(ResolutionRecordSchema),
  
  // ─── Conflicts & Issues ───
  conflicts: z.array(ConflictSchema),
  issues: z.array(IssueSchema),
  
  // ─── Counters ───
  planAttempts: z.number(),
  draftAttempts: z.record(z.string(), z.number()), // chunkId → attempts
  
  // ─── Status ───
  status: CompilerStatusSchema,
  
  // ─── Output ───
  domainSpec: DomainSpecSchema.nullable(),
  failureReason: z.string().nullable(),
});
```

---

## §8. Effects

### 8.1 Effect Types

| Effect | Input | Description |
|--------|-------|-------------|
| `llm:plan` | `SourceInput` | Request Plan generation |
| `llm:generate` | `Chunk, Plan, Fragment[]` | Request FragmentDraft generation |
| `pass:lower` | `FragmentDraft, Context` | Lower Draft to Fragment |
| `linker:link` | `Fragment[]` | Assemble Fragments, detect conflicts |
| `verifier:verify` | `DomainDraft` | Structural verification |
| `emitter:emit` | `DomainDraft, VerifyResult` | Generate DomainSpec |

### 8.2 Effect Handler Contracts

```typescript
type CompilerEffectHandlers = {
  'llm:plan': (params: {
    sourceInput: SourceInput;
    hints?: PlanHints;
  }) => Promise<
    | { ok: true; plan: Plan }
    | { ok: false; error: string }
  >;

  'llm:generate': (params: {
    chunk: Chunk;
    plan: Plan;
    existingFragments: Fragment[];
    retryContext?: RetryContext;
  }) => Promise<
    | { ok: true; drafts: FragmentDraft[] }
    | { ok: false; error: string }
  >;

  'pass:lower': (params: {
    draft: FragmentDraft;
    context: PassContext;
  }) => PassResult;  // Synchronous, deterministic

  'linker:link': (params: {
    fragments: Fragment[];
    context: LinkContext;
  }) => LinkResult;  // Synchronous, deterministic

  'verifier:verify': (params: {
    domainDraft: DomainDraft;
    context: VerifyContext;
  }) => VerifyResult;  // Synchronous, deterministic

  'emitter:emit': (params: {
    domainDraft: DomainDraft;
    verification: VerifyResult;
  }) => EmitResult;  // Synchronous, deterministic
};
```

### 8.3 Determinism Boundary

| Effect | Deterministic | Reason |
|--------|---------------|--------|
| `llm:plan` | ❌ | LLM is non-deterministic |
| `llm:generate` | ❌ | LLM is non-deterministic |
| `pass:lower` | ✅ | Rule-based transformation |
| `linker:link` | ✅ | Graph algorithm |
| `verifier:verify` | ✅ | Rule-based validation |
| `emitter:emit` | ✅ | Serialization |

---

## §9. Public API

### 9.1 createCompiler

```typescript
import { createCompiler } from '@manifesto-ai/compiler';

const compiler = createCompiler({
  planner: myPlannerActor,
  generator: myGeneratorActor,
  authority: myAuthority,
  config: {
    maxPlanAttempts: 3,
    maxDraftAttempts: 5,
    recordProvenance: true,
  },
});
```

### 9.2 Compiler Interface

```typescript
type Compiler = {
  // Start compilation
  start(sourceInput: SourceInput): Promise<void>;
  
  // Current state
  getSnapshot(): CompilerState;
  
  // Subscribe to state changes
  subscribe(callback: (state: CompilerState) => void): Unsubscribe;
  
  // Handle resolution
  resolve(response: ResolutionResponse): Promise<void>;
  
  // Abort
  abort(reason?: string): Promise<void>;
  
  // Reset
  reset(): Promise<void>;
};
```

### 9.3 High-Level API

```typescript
type CompileInput = {
  source: SourceInput;
  planner: PlannerActor;
  generator: GeneratorActor;
  authority: Authority;
  options?: CompileOptions;
};

type CompileOptions = {
  maxPlanAttempts?: number;
  maxDraftAttempts?: number;
  recordProvenance?: boolean;
  timeout?: number;
};

type CompileOutput = 
  | { status: 'success'; domainSpec: DomainSpec; issues: Issue[] }
  | { status: 'needs_resolution'; request: ResolutionRequest }
  | { status: 'failed'; issues: Issue[] };

async function compile(input: CompileInput): Promise<CompileOutput>;
```

### 9.4 Usage Example

```typescript
const result = await compile({
  source: {
    id: 'src-001',
    type: 'natural-language',
    content: 'Users can add tasks to a list and mark them complete.',
    receivedAt: Date.now(),
  },
  planner: gpt4Planner,
  generator: gpt4Generator,
  authority: interactiveAuthority,
});

if (result.status === 'success') {
  console.log('DomainSpec:', result.domainSpec);
} else if (result.status === 'needs_resolution') {
  // Handle resolution in UI
  const userChoice = await showResolutionUI(result.request);
  // ... continue with resolution
}
```

---

## §10. Fragment Granularity Guide

### 10.1 Recommended Fragment Units

| FragmentType | Unit | Example |
|--------------|------|---------|
| `state` | One state field | `state.todos`, `state.filter` |
| `computed` | One computed value | `computed.filteredTodos`, `computed.totalCount` |
| `action` | One action | `action.addTodo`, `action.toggleComplete` |
| `constraint` | One constraint rule | "todo.title cannot be empty" |
| `effect` | One effect declaration | `effect.saveTodos`, `effect.loadTodos` |
| `flow` | One flow definition | `flow.addTodoFlow` |

### 10.2 Fragment Splitting Principles

1. **Single Responsibility**: Each Fragment defines only one concept
2. **Explicit Dependencies**: `requires`/`provides` must be clearly expressible
3. **Independent Validation**: Each Fragment must be lowerable independently
4. **Retry Unit**: On failure, only that Fragment should need regeneration

### 10.3 Example: TodoApp Split

```
SourceInput: "Users can add tasks to a list and mark them complete."

Plan (by-layer strategy):
├── Chunk 1: "task list" → expectedType: 'state'
├── Chunk 2: "add tasks" → expectedType: 'action'
└── Chunk 3: "mark complete" → expectedType: 'action'

Fragments:
├── Fragment 1: state.todos
│   ├── provides: ["state.todos"]
│   └── requires: []
├── Fragment 2: action.addTodo
│   ├── provides: ["action.addTodo"]
│   └── requires: ["state.todos"]
└── Fragment 3: action.toggleComplete
    ├── provides: ["action.toggleComplete"]
    └── requires: ["state.todos"]
```

---

## §11. Non-Goals (v1.1)

| Item | Reason |
|------|--------|
| Automatic semantic correctness | Only structural validation, semantics out of scope |
| Automatic conflict merge | v1.1 requires Resolution for all conflicts |
| Trust in LLM self-judgment | Only Judge decides |
| Single-shot schema generation | Fragment-based incremental assembly |
| Runtime trace interpretation | Teacher/Student responsibility |
| Performance optimization | Correctness first |

---

## §12. Migration from v1.0

### 12.1 Breaking Changes

| v1.0 | v1.1 | Migration |
|------|------|-----------|
| LLM → DomainDraft | LLM → Plan + FragmentDraft[] | Actor reimplementation required |
| `requestResolution` action | Structural conflict detection | Resolution logic change |
| `receiveValidation` | `pass:lower` + `linker:link` | Pipeline separation |
| Single `llm:propose` effect | `llm:plan` + `llm:generate` | Effect separation |

### 12.2 Compatible Parts

- Resolution protocol (ITL)
- Authority interface
- Basic state machine concept
- Provenance tracking

---

## §13. Package Structure

```
@manifesto-ai/compiler
├── domain/
│   ├── schema.ts           # CompilerStateSchema
│   ├── domain.ts           # CompilerDomain
│   └── types.ts            # Core types
│
├── actors/
│   ├── planner.ts          # PlannerActor interface
│   └── generator.ts        # GeneratorActor interface
│
├── pipeline/
│   ├── pass-layer.ts       # PassLayer implementation
│   ├── linker.ts           # Linker implementation
│   ├── verifier.ts         # Verifier implementation
│   └── emitter.ts          # Emitter implementation
│
├── resolution/
│   ├── types.ts            # Resolution types
│   └── authority.ts        # Authority interface
│
├── effects/
│   ├── llm.ts              # LLM effect handlers
│   └── pipeline.ts         # Pipeline effect handlers
│
├── host/
│   └── index.ts            # createCompilerHost
│
├── api/
│   └── index.ts            # createCompiler, compile()
│
└── index.ts                # Public exports
```

---

## Appendix A: Conflict Resolution Examples

### A.1 duplicate_path Conflict

```typescript
// Fragment A
{
  id: 'frag-1',
  path: 'state.count',
  provides: ['state.count'],
  content: { kind: 'state', name: 'count', schema: z.number() }
}

// Fragment B (generated from different Chunk)
{
  id: 'frag-2',
  path: 'state.count',
  provides: ['state.count'],
  content: { kind: 'state', name: 'count', schema: z.string() }
}

// Conflict
{
  type: 'duplicate_path',
  path: 'state.count',
  fragmentIds: ['frag-1', 'frag-2'],
  message: 'Multiple fragments define the same path: state.count'
}

// Resolution Options
[
  { id: 'opt-1', description: 'Keep Fragment A (number)', impact: { kind: 'select_fragment', fragmentId: 'frag-1', rejectIds: ['frag-2'] } },
  { id: 'opt-2', description: 'Keep Fragment B (string)', impact: { kind: 'select_fragment', fragmentId: 'frag-2', rejectIds: ['frag-1'] } },
  { id: 'opt-3', description: 'Regenerate both', impact: { kind: 'reject_draft', draftId: '...', reason: 'conflict' } }
]
```

### A.2 missing_dependency Conflict

```typescript
// Fragment A
{
  id: 'frag-1',
  path: 'computed.doubled',
  provides: ['computed.doubled'],
  requires: ['state.value'],  // state.value doesn't exist!
  content: { kind: 'computed', expression: 'state.value * 2' }
}

// Conflict
{
  type: 'missing_dependency',
  path: 'state.value',
  fragmentIds: ['frag-1'],
  message: 'Fragment frag-1 requires state.value but no fragment provides it'
}

// Resolution Options
[
  { id: 'opt-1', description: 'Add state.value fragment', impact: { kind: 'manual_override', content: { addChunk: true, expectedType: 'state' } } },
  { id: 'opt-2', description: 'Remove computed.doubled', impact: { kind: 'reject_draft', draftId: '...', reason: 'unresolvable dependency' } }
]
```

---

## Appendix B: LLM Prompt Guidelines

### B.1 PlannerActor Prompt

```
You are a Planner for Manifesto domain schema compilation.

Analyze the input and:
1. Identify input type (natural language, code, mixed)
2. Select optimal splitting strategy
3. Specify expected Fragment type for each Chunk
4. Declare dependencies between Chunks

Output format: Plan JSON

Important:
- Do NOT generate Fragments or DomainSchema directly
- Explain your rationale for the split
- Express dependencies explicitly
```

### B.2 GeneratorActor Prompt

```
You are a Generator for Manifesto Fragments.

Generate a FragmentDraft for the given Chunk:
1. Analyze Chunk content
2. Interpret as appropriate Fragment type
3. Infer requires/provides
4. Include alternatives if uncertain

Output format: FragmentDraft JSON

Important:
- Do NOT generate entire DomainSchema
- Work only within this Chunk's scope
- If uncertain, set low confidence and provide alternatives
```

---

*End of @manifesto-ai/compiler Specification v1.1*
