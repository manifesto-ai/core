# @manifesto-ai/compiler — Foundational Design Rationale (FDR) v1.1

> **Version:** 1.1
> **Status:** Normative
> **Purpose:** Document the "Why" behind every constitutional decision in Compiler Spec v1.1
> **Supersedes:** FDR v1.0

---

## Overview

This document records the design decisions and rationale for `@manifesto-ai/compiler` v1.1, including reasons for changes from v1.0.

Each FDR entry follows this format:

- **Decision**: What was decided
- **Context**: Why this decision was needed
- **Rationale**: The reasoning behind the choice
- **Alternatives Rejected**: Other options considered and why they were rejected
- **Consequences**: What this decision enables and constrains

---

## FDR-C101: LLM Must Not Generate DomainSchema Directly

### Decision

LLM MUST NOT output `DomainSchema` or `DomainSpec` directly. LLM outputs are limited to `Plan` and `FragmentDraft[]`.

```
v1.0: LLM → DomainDraft (entire schema)
v1.1: LLM → Plan + FragmentDraft[] (split fragments)
```

### Context

Problems encountered when v1.0 had LLM generate entire DomainDraft:

**Problem 1: Must get entire structure right at once**
```
LLM: "I need to generate 5 states, 3 computeds, 4 actions correctly at once"
     → If any one is wrong, entire fails
     → Retry = regenerate everything
```

**Problem 2: Failure point unclear**
```
Builder: "Validation failed"
Problem: Hard to know which part is wrong
     → Difficult to debug
     → Hard to give feedback to LLM
```

**Problem 3: No partial success**
```
LLM gets 9 out of 10 correct
1 wrong causes entire failure
→ 9 good results also discarded
```

### Rationale

**"Assembling fragments is safer than generating the whole at once"**

| Approach | Failure Mode | Retry Cost |
|----------|--------------|------------|
| Generate whole | Entire fails | Regenerate all |
| Assemble fragments | Only that fragment fails | Regenerate that fragment |

Benefits of Fragment-based approach:

1. **Isolated failures**: Fragment A fails but Fragment B survives
2. **Precise feedback**: "state.count type is wrong" vs "everything is wrong"
3. **Incremental progress**: Build next Fragment on confirmed ones
4. **Parallelization possible**: Independent Fragments can be generated in parallel

### Alternatives Rejected

| Alternative | Rejection Reason |
|-------------|------------------|
| LLM generates whole + better prompt | Doesn't solve fundamental problem |
| LLM generates whole + partial validation | Validation/generation boundary unclear |
| Multiple LLMs generate whole + consensus | Increased complexity, still whole-unit |

### Consequences

- LLM Actor split into two: `PlannerActor`, `GeneratorActor`
- More pipeline stages (Plan → Draft → Fragment → ...)
- Fragment unit definition needed (granularity decision)
- Assembly logic moves to pipeline responsibility

---

## FDR-C102: Fragment-Based Incremental Assembly

### Decision

Compilation proceeds incrementally through these stages:

```
SourceInput → Plan → Chunks → FragmentDrafts → Fragments → DomainDraft → DomainSpec
```

Each stage takes the output of the previous stage as input and transforms it.

### Context

Historical lessons from software compilers:

```
Early compilers: Source → Machine Code (at once)
Modern compilers: Source → Tokens → AST → IR → Optimized IR → Machine Code
```

Why split into stages?
- Each stage has clear responsibility
- Optimization possible through intermediate representation (IR)
- Easier debugging
- Per-stage validation possible

### Rationale

**"Complex transformations should be decomposed into simple stages"**

Compiler v1.1 pipeline:

| Stage | Input | Output | Responsibility |
|-------|-------|--------|----------------|
| Plan | SourceInput | Plan + Chunks | Splitting strategy |
| Generate | Chunk | FragmentDraft | Individual interpretation |
| Lower | FragmentDraft | Fragment | Normalization + validation |
| Link | Fragment[] | DomainDraft | Assembly + conflict detection |
| Verify | DomainDraft | Issues | Full validation |
| Emit | DomainDraft | DomainSpec | Serialization |

Since each stage has **single responsibility**:
- Clear failure cause
- Independently testable
- Per-stage optimization possible

### Alternatives Rejected

| Alternative | Rejection Reason |
|-------------|------------------|
| 2 stages (Generate → Validate) | Same problems as v1.0 |
| 3 stages (Plan → Generate → Validate) | Assembly logic unclear |
| No stages (streaming) | Validation points unclear |

### Consequences

- Intermediate types needed (Plan, Chunk, FragmentDraft, Fragment, DomainDraft)
- Effect definition per stage
- State machine complexity increase
- But each stage is clear and testable

---

## FDR-C103: Deterministic Pipeline is the Judge

### Decision

The Judge is defined as the following deterministic sequence:

```
PassLayer → Linker → Verifier → Emitter
```

LLM is not part of the Judge.

### Context

In v1.0, Builder was the Judge:

```
v1.0: LLM → DomainDraft → Builder.validate() → Accept/Reject
```

Problem: Builder only validates "already made" whole, doesn't participate in assembly.

In v1.1, Judge includes **the entire assembly process**:

```
v1.1: FragmentDraft[] → PassLayer → Linker → Verifier → Emitter
      ────────────────────── Judge ──────────────────────────
```

### Rationale

**"Judge should decide 'what is made' and control 'how it's made'"**

| Role | v1.0 | v1.1 |
|------|------|------|
| Assembly | LLM (implicit) | Linker (explicit) |
| Order decision | LLM (implicit) | Linker (topological sort) |
| Conflict detection | Builder (limited) | Linker (structural) |
| Validation | Builder | Verifier |
| Output generation | After Builder pass | Emitter |

When Judge handles assembly too:
1. **Dependency order guaranteed**: Linker determines correct assembly order via topological sort
2. **Conflict detection**: Conflicts naturally discovered during assembly
3. **Traceability**: Clear which Fragment came from where

### Alternatives Rejected

| Alternative | Rejection Reason |
|-------------|------------------|
| LLM decides assembly order | LLM is untrusted |
| Validate without assembly | Can't detect conflicts |
| Separate Assembler + Validator | Boundary unclear, Judge scattered |

### Consequences

- Linker becomes key component
- Topological sort algorithm required
- `requires`/`provides` specification mandatory
- Assembly process deterministically reproducible

---

## FDR-C104: Resolution is Triggered by Structural Conflict Detection

### Decision

Resolution is triggered when **the pipeline structurally detects conflicts**, not when LLM declares "I don't know."

```
v1.0: LLM → "This is ambiguous" → Resolution
v1.1: Linker → "Two Fragments define same path" → Conflict → Resolution
```

### Context

Problem with v1.0:

**LLM doesn't know what it doesn't know (Unknown unknowns)**

```
LLM: "state.count is a number" (confident)
Reality: Should be string based on context
LLM: Doesn't request Resolution (thinks it's right)
```

Relying on LLM's self-awareness **violates the Untrusted Proposer principle**.

### Rationale

**"Don't ask an untrusted party whether it can be trusted"**

Benefits of structural conflict detection:

| Situation | LLM Declaration | Structural Detection |
|-----------|-----------------|---------------------|
| LLM wrong + confident | No Resolution ❌ | Verifier catches error ✅ |
| LLM wrong + uncertain | Resolution ✅ | Unnecessary Resolution |
| Two LLMs give different answers | Who to believe? | Linker detects conflict ✅ |
| Truly ambiguous situation | LLM must recognize | Detected structurally ✅ |

Structural conflict detection conditions:

```typescript
type ConflictType = 
  | 'duplicate_path'        // Two Fragments define same path
  | 'type_mismatch'         // Same path with different types
  | 'missing_dependency'    // requires not provided
  | 'circular_dependency';  // Circular reference
```

These conditions are detectable **mechanically without LLM judgment**.

### Alternatives Rejected

| Alternative | Rejection Reason |
|-------------|------------------|
| Based on LLM confidence | Relies on LLM self-awareness |
| Human reviews all Fragments | Inefficient |
| Always Resolution | Unnecessary delays |

### Consequences

- Conflict detection logic required in Linker
- ConflictType enumeration defined
- Resolution is "pipeline detected" not "LLM requested"
- LLM confidence is hint only, not trigger

---

## FDR-C105: Fragment requires/provides Model

### Decision

Each Fragment specifies what it **reads (requires)** and what it **defines (provides)**.

```typescript
type Fragment = {
  path: string;
  requires: string[];    // Paths this Fragment depends on
  provides: string[];    // Paths this Fragment defines
  // ...
};
```

### Context

How to express relationships between Fragments?

**Option A: Implicit dependencies**
```
LLM generates Fragments in correct order
→ Problem: LLM is untrusted
```

**Option B: Global analysis**
```
Gather all Fragments and analyze code
→ Problem: Complex and potentially non-deterministic
```

**Option C: Explicit declaration (chosen)**
```
Each Fragment declares requires/provides
→ Linker constructs graph
→ Topological sort determines order
```

### Rationale

**"Dependencies must be explicitly declared"**

Benefits of requires/provides model:

1. **Deterministic graph construction**: DAG constructable from declarations alone
2. **Topological sort possible**: Correct assembly order automatically determined
3. **Easy conflict detection**: provides overlap = duplicate_path
4. **Verifiable**: Check if requires are provided
5. **Traceable**: Explainable why this order

Example:
```
Fragment A: provides=['state.count'], requires=[]
Fragment B: provides=['computed.doubled'], requires=['state.count']
Fragment C: provides=['action.increment'], requires=['state.count']

DAG:
A ──► B
 \
  ──► C

Topological sort: [A, B, C] or [A, C, B]
```

### Alternatives Rejected

| Alternative | Rejection Reason |
|-------------|------------------|
| Implicit dependencies | Depends on LLM order |
| Global code analysis | Complex, potentially non-deterministic |
| Numeric ordering | Meaningless |

### Consequences

- requires/provides mandatory for all Fragments
- PassLayer infers requires/provides from Draft
- Linker needs graph algorithms (topological sort, cycle detection)
- LLM can be asked for requires/provides hints (but PassLayer verifies)

---

## FDR-C106: Plan and Chunk Separation

### Decision

The first compilation stage generates a `Plan`, and Plan contains `Chunk[]`.

```typescript
type Plan = {
  strategy: PlanStrategy;
  chunks: Chunk[];
};

type Chunk = {
  content: string;           // Portion of original
  expectedType: FragmentType;
  dependencies: ChunkDependency[];
};
```

### Context

If SourceInput is converted directly to Fragments:
- Unclear what unit to split by
- Splitting strategy is implicit
- No opportunity to review the split itself

If Plan is made first:
- Splitting strategy is explicit
- Expected type for each Chunk is declared
- Authority can review/modify Plan
- If split is wrong, only Plan is regenerated

### Rationale

**"Separate splitting from interpretation"**

| Stage | Responsibility | Review Opportunity |
|-------|----------------|-------------------|
| Planning | "How to split?" | Plan approval/rejection |
| Generating | "What does each piece mean?" | Draft approval/rejection |

Benefits of separation:

1. **Strategy selection**: by-statement vs by-entity vs by-layer
2. **Retry scope**: If split is wrong, only regenerate Plan
3. **HITL opportunity**: Can review splitting strategy itself
4. **Context passing**: Plan provides context to Generator

### Alternatives Rejected

| Alternative | Rejection Reason |
|-------------|------------------|
| Fixed splitting strategy | Different inputs need different optima |
| No splitting, interpret whole | Same problems as v1.0 |
| Generator handles splitting too | Mixed responsibilities |

### Consequences

- PlannerActor and GeneratorActor separation
- PlanStrategy enumeration defined
- Chunk dependencies can be specified
- HITL possible at Plan stage

---

## FDR-C107: PassLayer Lowering Responsibility

### Decision

PassLayer **lowers** `FragmentDraft` to `Fragment`. This process is deterministic.

```
FragmentDraft (untrusted) → PassLayer → Fragment (verified)
```

### Context

What is lowering?
- High-level representation → Low-level representation
- Includes validation
- Includes normalization

FragmentDraft.interpretation.raw is arbitrary structure from LLM:
```typescript
// LLM output (various forms possible)
interpretation: {
  raw: {
    name: "count",
    type: "number",
    default: 0
  }
}
```

Fragment.content is normalized structure:
```typescript
// Normalized form
content: {
  kind: 'state',
  name: 'count',
  schema: z.number(),
  initial: 0
}
```

### Rationale

**"Untrusted input must go through normalization"**

PassLayer responsibilities:

1. **Format validation**: Is raw the expected structure?
2. **Type conversion**: String → Zod schema, etc.
3. **Normalization**: Various expressions → Standard format
4. **requires/provides inference**: Extract dependencies from content analysis
5. **Attach Provenance**: Record source information

Example:
```typescript
// LLM can express variously
{ type: "number" }
{ type: "int" }
{ schema: "z.number()" }

// PassLayer normalizes all to
{ schema: z.number() }
```

### Alternatives Rejected

| Alternative | Rejection Reason |
|-------------|------------------|
| LLM generates normalized format | LLM is untrusted |
| Normalize in Linker | Mixed responsibilities |
| Validate only, no normalization | Can't handle various expressions |

### Consequences

- Lowering rules needed per FragmentType
- requires/provides inference logic needed
- Issue generation for unsupported formats
- Determinism guarantee: Same Draft → Same Fragment

---

## FDR-C108: Linker Topological Sort and Conflict Detection

### Decision

Linker receives Fragment[] and:
1. Constructs semantic dependency graph
2. Determines assembly order via topological sort
3. Detects conflicts
4. Generates DomainDraft or returns Conflict[]

### Context

Since Fragments are generated independently:
- Order is not guaranteed
- Conflicts are possible
- Dependencies need resolution

Linker solves these problems:

```
Fragments (unordered):
  - action.increment (requires: state.count)
  - state.count (requires: nothing)
  - computed.doubled (requires: state.count)

Linker processing:
1. Graph construction: state.count → [action.increment, computed.doubled]
2. Topological sort: [state.count, action.increment, computed.doubled]
3. Conflict check: None
4. Assemble: DomainDraft
```

### Rationale

**"Assembly order should be determined by dependencies"**

Benefits of topological sort:
1. **Deterministic**: Same Graph → Same order (with stable sort)
2. **Correct order**: Dependencies always defined first
3. **Cycle detection**: Topological sort impossible = circular reference
4. **Missing detection**: requires not provided anywhere

Conflict detection:
```typescript
// duplicate_path
Fragment A provides ['state.count']
Fragment B provides ['state.count']
→ Conflict!

// missing_dependency
Fragment A requires ['state.value']
No fragment provides ['state.value']
→ Conflict!
```

### Alternatives Rejected

| Alternative | Rejection Reason |
|-------------|------------------|
| Generation order = assembly order | Depends on LLM order |
| Alphabetical sort | Ignores dependencies |
| Auto-resolve conflicts | Can't know which is correct |

### Consequences

- Topological sort algorithm implementation needed
- Stable sort used (for determinism)
- Resolution requested on conflict (no auto-resolve)
- dependencyGraph included in DomainDraft

---

## FDR-C109: No Automatic Conflict Merge in v1.1

### Decision

In v1.1, conflicts are NOT automatically merged. All conflicts are resolved through Resolution.

```
Linker: Conflict detected
  → Auto-merge ❌
  → Request Resolution ✅
```

### Context

Why automatic merging is dangerous:

**Scenario: duplicate_path**
```
Fragment A: state.count (number, for counter)
Fragment B: state.count (string, for error message)
```

Auto-merge options:
- Pick first one? → Depends on generation order (non-deterministic)
- Pick last one? → Also non-deterministic
- Type priority? → By what criteria?
- Try to merge? → number and string can't merge

No automatic rule guarantees **semantic correctness**.

### Rationale

**"Delegate decisions in ambiguous situations"**

Benefits of no auto-merge:

1. **Safe**: Prevents wrong automatic decisions
2. **Transparent**: All decisions are recorded
3. **Accurate**: Entity that knows semantics (Human/AI Authority) decides
4. **Reproducible**: Decisions recorded for replay

v1.1 takes conservative approach:
- All conflicts → Resolution
- Safe auto-merge rules can be added in future versions

### Alternatives Rejected

| Alternative | Rejection Reason |
|-------------|------------------|
| First/last priority | Non-deterministic |
| Type priority | Can't guarantee semantic correctness |
| Heuristic merge | Unpredictable |

### Consequences

- Resolution always requested on conflict
- Compilation stops without HITL (or default policy applies)
- Safe auto-merge rules can be added in future versions
- Resolution frequency may be high initially

---

## FDR-C110: Actor Separation (Planner vs Generator)

### Decision

LLM Actor is split into two:
- **PlannerActor**: Plan generation
- **GeneratorActor**: FragmentDraft generation

### Context

Problems with single LLM Actor:

```
Single Actor handles everything:
  - Decide splitting strategy
  - Interpret each part
  - Figure out dependencies
  → Too much responsibility
  → Complex prompts
  → Unclear failure cause
```

When separated:

```
PlannerActor:
  - Input: SourceInput
  - Output: Plan (splitting strategy + Chunks)
  - Responsibility: "How to split?"

GeneratorActor:
  - Input: Chunk (+ Plan context)
  - Output: FragmentDraft
  - Responsibility: "What does this piece mean?"
```

### Rationale

**"Single Responsibility Principle applies to LLMs too"**

Benefits of separation:

| Aspect | Single Actor | Separated Actors |
|--------|--------------|------------------|
| Prompt | Complex | Simple, focused |
| Failure cause | Unclear | Clear (Plan issue vs Generation issue) |
| Retry | Entire | Only that stage |
| Optimization | Difficult | Per-stage model selection possible |
| Parallelization | Impossible | Per-Chunk parallel generation possible |

Different models can be used:
```
PlannerActor: GPT-4 (strategic thinking)
GeneratorActor: Claude (code generation)
```

### Alternatives Rejected

| Alternative | Rejection Reason |
|-------------|------------------|
| Single Actor | Too much responsibility, complex |
| 3+ Actors | Excessive separation |
| No Actor, just prompts | Difficult to structure |

### Consequences

- Two LLM calls (Plan + Generate per Chunk)
- Prompt templates per Actor
- Actor interface definition
- Different models/settings possible

---

## FDR-C111: Provenance Tracking

### Decision

All Fragments MUST include **Provenance** (source information).

```typescript
type Provenance = {
  source: 'natural-language' | 'code' | 'manual';
  inputId: string;
  inputSpan?: { start: number; end: number };
  chunkId: string;
  fragmentDraftId: string;
  actorId: string;
  runtimeId: string;
  timestamp: number;
  planId: string;
  passLayerVersion: string;
  linkerVersion: string;
};
```

### Context

Situations where "Where did this Fragment come from?" must be answered:

1. **Debugging**: Trace cause on problems
2. **Audit**: Regulatory requirements
3. **Reproduction**: Verify same input → same output
4. **Trust**: Clear source for each part

### Rationale

**"All decisions must be traceable"**

What Provenance provides:

| Question | Provenance Field |
|----------|------------------|
| Original input? | inputId, inputSpan |
| From which Chunk? | chunkId |
| From which Draft? | fragmentDraftId |
| Which LLM? | actorId |
| When? | timestamp |
| Which version pipeline? | passLayerVersion, linkerVersion |

Reproducibility:
```
Same SourceInput 
+ Same Plan 
+ Same FragmentDraft[] 
+ Same Resolution[]
= Same DomainSpec (including Provenance)
```

### Alternatives Rejected

| Alternative | Rejection Reason |
|-------------|------------------|
| No Provenance | Can't trace |
| Only in final result | Can't trace intermediate process |
| Selective recording | Inconsistent |

### Consequences

- Provenance mandatory for all Fragments
- Storage space increase
- PassLayer responsible for Provenance generation
- Full Provenance summary in DomainSpec too

---

## FDR-C112: Fragment Granularity Decision

### Decision

Fragment unit is based on **single concept**:

| FragmentType | Unit |
|--------------|------|
| `state` | One state field |
| `computed` | One computed value |
| `action` | One action |
| `constraint` | One constraint rule |
| `effect` | One effect declaration |
| `flow` | One flow definition |

### Context

If granularity is too large:
- Same problems as v1.0 (whole fails)
- Wide retry scope

If granularity is too small:
- Fragment count explosion
- Increased assembly complexity
- Complex dependency graph

Appropriate balance: **One concept = One Fragment**

### Rationale

**"Retry unit = Semantic unit"**

Benefits of single concept unit:

1. **Semantic completeness**: Each Fragment has independent meaning
2. **Clear dependencies**: requires/provides naturally expressible
3. **Appropriate retry scope**: Not too wide, not too narrow
4. **Understandability**: Appropriate size for human review

Example:
```
❌ Too large: Entire Domain is one Fragment
❌ Too small: state.count's name, type, initial are each a Fragment
✅ Appropriate: Entire state.count is one Fragment
```

### Alternatives Rejected

| Alternative | Rejection Reason |
|-------------|------------------|
| Line-by-line | Meaningless split |
| File-by-file | Too large |
| Property-by-property | Too small |

### Consequences

- Content schema definition per FragmentType
- Chunk specifies expectedType
- Generator guided to produce per-concept
- Complex actions can be split into multiple Fragments

---

## Summary Table

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| C101 | LLM generates only fragments | Fragments safer than whole |
| C102 | Incremental assembly | Decompose complex transformations into stages |
| C103 | Pipeline is Judge | Assembly process is also Judge's responsibility |
| C104 | Resolution is structural detection | Don't rely on LLM self-awareness |
| C105 | requires/provides model | Dependencies explicitly declared |
| C106 | Plan/Chunk separation | Separate splitting from interpretation |
| C107 | PassLayer Lowering | Untrusted input goes through normalization |
| C108 | Linker topological sort | Order determined by dependencies |
| C109 | No auto-merge (v1.1) | Delegate when ambiguous |
| C110 | Actor separation | Single Responsibility Principle |
| C111 | Provenance tracking | All decisions must be traceable |
| C112 | Concept-unit granularity | Retry unit = Semantic unit |

---

## Cross-Reference: Relationship to v1.0 FDR

### Preserved Principles

| v1.0 FDR | In v1.1 |
|----------|---------|
| C001: Compiler as Manifesto App | Preserved |
| C002: LLM as Untrusted Proposer | **Strengthened** (only fragments) |
| C003: Actor-neutral Design | Preserved |
| C004: ITL-agnostic Resolution | Preserved |
| C010: Builder as Judge | **Extended** (pipeline is Judge) |

### Changed/Replaced Principles

| v1.0 FDR | In v1.1 |
|----------|---------|
| C006: Draft vs Schema | Extended (Plan, Chunk, FragmentDraft, Fragment, DomainDraft, DomainSpec) |
| C008: Single Retry Increment | Replaced (per-Fragment retry) |
| C011: Effect Handler Abstraction | Extended (more Effect types) |

---

## Lessons from v1.0 to v1.1

### Why v1.0 Didn't Work as Expected

1. **Too much responsibility on LLM**: Had to get entire structure right at once
2. **Resolution trigger limitation**: Resolution only when LLM says "I don't know"
3. **Excessive failure scope**: One error leads to entire retry
4. **Opaque assembly**: Builder only validates "already made" result

### How v1.1 Solves These

1. **Distributed responsibility**: Plan → FragmentDraft → Fragment → DomainDraft → DomainSpec
2. **Structural Resolution**: Pipeline detects conflicts
3. **Isolated failures**: Per-Fragment retry
4. **Transparent assembly**: Linker assembles explicitly

### Key Lesson

> **"The Untrusted Proposer principle must apply to output scope too.
> If LLM proposes the whole, trust issues arise for the whole.
> If LLM proposes only fragments, a trusted pipeline handles assembly."**

---

*End of @manifesto-ai/compiler FDR v1.1*
