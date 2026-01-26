# Manifesto Translator Foundational Design Rationale v0.1

> **Version:** 0.1.0  
> **Type:** Foundational  
> **Status:** Normative  
> **Companion:** SPEC-TRANSLATOR-v0.1.0  
> **Purpose:** Document the "Why" behind design decisions in Translator v0.1

---

## Table of Contents

1. [Overview](#1-overview)
2. [FDR-TRN-001: Package Independence](#fdr-trn-001-package-independence)
3. [FDR-TRN-002: Intent Graph as DAG](#fdr-trn-002-intent-graph-as-dag)
4. [FDR-TRN-003: Node = IntentIR Wrapper](#fdr-trn-003-node--intentir-wrapper)
5. [FDR-TRN-004: Two-Status Model](#fdr-trn-004-two-status-model)
6. [FDR-TRN-005: Measurement over Decision](#fdr-trn-005-measurement-over-decision)
7. [FDR-TRN-006: Two-Phase Validation](#fdr-trn-006-two-phase-validation)
8. [FDR-TRN-007: Deferred Lowering](#fdr-trn-007-deferred-lowering)
9. [FDR-TRN-008: Terminology Isolation](#fdr-trn-008-terminology-isolation)
10. [FDR-TRN-009: InvocationPlan as Lowerable Plan](#fdr-trn-009-invocationplan-as-lowerable-plan)
11. [FDR-TRN-010: MelCandidate Scope](#fdr-trn-010-melcandidate-scope)

---

## 1. Overview

This document captures the foundational design rationale for Translator v0.1. Each FDR entry explains **why** a particular design decision was made, the alternatives considered, and the consequences of the decision.

### Document Conventions

Each FDR follows this structure:

```
FDR-TRN-XXX: Title
├── Context: The situation that led to this decision
├── Decision: What we decided
├── Alternatives: Options we considered
├── Rationale: Why we chose this option
└── Consequences: What follows from this decision
```

---

## FDR-TRN-001: Package Independence

### Context

Manifesto v2 introduced strict layer separation (ADR-001). The "Does NOT Know" matrix explicitly states that Translator should not know about:
- Execution (Host)
- Governance (World)
- Runtime internals (Core implementation details)

However, Translator needs to produce output compatible with Manifesto systems.

### Decision

**Translator is published as an independent package (`@manifesto-ai/translator`) with no runtime dependencies on Core/Host/World/App.**

```
Allowed:
  - @manifesto-ai/intent-ir (peer dependency)
  - Type-only imports from @manifesto-ai/core

Forbidden:
  - Runtime imports from @manifesto-ai/core
  - Any imports from @manifesto-ai/host
  - Any imports from @manifesto-ai/world
  - Any imports from @manifesto-ai/app
```

### Alternatives Considered

| Alternative | Pros | Cons |
|-------------|------|------|
| **A1: Part of App package** | Single package, easier imports | Couples semantic bridge to App lifecycle |
| **A2: Part of Core package** | Centralized, guaranteed compatibility | Violates Core's pure computation mandate |
| **A3: Independent package** | Clean boundaries, orthogonal to Host↔World | Requires careful type alignment |

### Rationale

1. **Orthogonality:** Translator can be added/removed without affecting Host↔World integration
2. **Testability:** Translator can be tested in isolation without Manifesto runtime
3. **Reusability:** Other systems could use Translator without full Manifesto stack
4. **Layer integrity:** Prevents "Does NOT Know" violations at compile time

### Consequences

- **Positive:** Clean architectural boundary, independent versioning
- **Negative:** Must maintain type compatibility manually (SnapshotLike, etc.)
- **Neutral:** Consumers must install separate package

---

## FDR-TRN-002: Intent Graph as DAG

### Context

Natural language often expresses complex, multi-step intentions:
- "Create a project and add tasks to it"
- "If the order is pending, cancel it; otherwise, archive it"
- "Find all overdue tasks and notify their assignees"

A single IntentIR cannot represent these compound structures.

### Decision

**Translator's primary output is an Intent Graph—a Directed Acyclic Graph (DAG) of IntentIR nodes.**

```
┌─────────────────────────────────────────────────────────────┐
│                     Intent Graph (DAG)                      │
│                                                             │
│   [n1: Create Project] ──────► [n2: Add Tasks]             │
│                                      │                      │
│                                      ▼                      │
│                               [n3: Set Due Date]           │
└─────────────────────────────────────────────────────────────┘
```

### Alternatives Considered

| Alternative | Pros | Cons |
|-------------|------|------|
| **A1: Flat list of IntentIR** | Simple | Loses dependency information |
| **A2: Tree structure** | Hierarchical | Can't represent diamond dependencies |
| **A3: General graph (cycles allowed)** | Maximum expressiveness | Non-terminating traversals possible |
| **A4: DAG** | Dependencies + termination guarantee | Slightly more complex than list |

### Rationale

1. **Termination guarantee:** DAG traversal always terminates (no cycles)
2. **Deterministic ordering:** Topological sort yields consistent execution order
3. **Static verification:** Cycles can be detected at construction time
4. **Parallel execution:** Independent subgraphs can execute concurrently
5. **Alignment with Core:** Core's `computed` fields already use DAG semantics

### Consequences

- **Positive:** Predictable execution, parallelization opportunity
- **Negative:** Cannot express genuinely cyclic processes (loops must be unrolled or handled differently)
- **Neutral:** Cycle detection adds small overhead to translation

---

## FDR-TRN-003: Node = IntentIR Wrapper

### Context

Intent IR v0.1 already defines a robust semantic structure for single intents. We needed to decide how Intent Graph nodes relate to IntentIR.

Options:
1. Intent Graph nodes contain IntentIR instances
2. Intent Graph nodes extend/modify IntentIR
3. Intent Graph uses a completely separate representation

### Decision

**Each Intent Graph node wraps exactly one IntentIR instance, adding graph-specific metadata without modifying IntentIR semantics.**

```typescript
type IntentNode = {
  id: IntentNodeId;
  ir: IntentIR;           // Wrapped, not extended
  dependsOn: IntentNodeId[];
  resolution: Resolution;
};
```

### Alternatives Considered

| Alternative | Pros | Cons |
|-------------|------|------|
| **A1: Wrap IntentIR** | Preserves IR semantics, clear composition | Two-level structure |
| **A2: Extend IntentIR** | Single type | Modifies stable spec, coupling |
| **A3: Separate representation** | Full flexibility | Duplication, conversion overhead |

### Rationale

1. **Composition over modification:** Intent IR v0.1 is stable; extending it creates coupling
2. **Lowering compatibility:** Intent IR's lowering contract (`IntentIR → IntentBody`) applies unchanged
3. **Clear responsibilities:** IntentIR = semantic content, IntentNode = graph position + resolution
4. **Independent evolution:** Intent IR and Translator can evolve separately

### Consequences

- **Positive:** Intent IR spec remains stable, clear separation of concerns
- **Negative:** Consumers must understand two-level structure
- **Neutral:** Serialization includes nested structure

---

## FDR-TRN-004: Two-Status Model

### Context

During design review, confusion arose between:
- "Is this intent semantically complete?" (meaning clear)
- "Can this intent be executed?" (schema supports it)

These were initially conflated, leading to inconsistent behavior.

### Decision

**Translator distinguishes two orthogonal status dimensions:**

| Dimension | Question | Values |
|-----------|----------|--------|
| `resolution.status` | Is the meaning complete? | `Resolved`, `Ambiguous`, `Abstract` |
| `lowering.status` | Can it be executed? | `ready`, `deferred`, `failed` |

These are **independent**:

```
┌─────────────────────────────────────────────────────────────┐
│                  Status Independence                        │
│                                                             │
│   resolution.status = "Resolved"                            │
│   lowering.status = "failed"                                │
│                                                             │
│   → Intent is perfectly clear                               │
│   → But current schema doesn't support this action          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Alternatives Considered

| Alternative | Pros | Cons |
|-------------|------|------|
| **A1: Single status** | Simpler | Conflates different concerns |
| **A2: Two independent statuses** | Precise modeling | More complex |
| **A3: Status + capability flags** | Extensible | Overly complex for v0.1 |

### Rationale

1. **Conceptual clarity:** Meaning completeness ≠ execution capability
2. **Better error messages:** "Clear but unsupported" vs "Unclear" are different user experiences
3. **Schema evolution:** A `Resolved` intent with `failed` lowering suggests schema extension opportunity
4. **Consumer flexibility:** Consumers can decide how to handle each combination

### Consequences

- **Positive:** Precise status representation, better MelCandidate triggers
- **Negative:** Consumers must handle 3×3 status combinations
- **Neutral:** Status combinations are well-defined in spec

---

## FDR-TRN-005: Measurement over Decision

### Context

Translator needs to handle ambiguous input. The question: should Translator decide what to do with ambiguous intents, or just report the ambiguity?

### Decision

**Translator measures ambiguity (produces `ambiguityScore: 0..1`) but does NOT make triage decisions (auto/ask/reject). Triage is consumer responsibility.**

```typescript
// Translator produces
resolution: {
  status: "Ambiguous",
  ambiguityScore: 0.65,  // Measurement
  missing: ["DEST.ref.id"]
}

// Consumer decides
if (score < 0.3) execute();           // Auto
else if (score < 0.7) askUser();      // Ask
else reject();                         // Reject
```

### Alternatives Considered

| Alternative | Pros | Cons |
|-------------|------|------|
| **A1: Translator decides** | Single responsibility | One-size-fits-all policy |
| **A2: Translator measures** | Consumer flexibility | Consumers need policy logic |
| **A3: Configurable thresholds** | Flexible defaults | Still limiting |

### Rationale

1. **Context dependence:** Appropriate thresholds vary by use case
    - Agent: Low threshold (aggressive auto-execution)
    - Medical app: High threshold (conservative, always ask)

2. **Separation of concerns:** Translator's job is semantic analysis, not policy
3. **Reusability:** Same Translator serves different consumers with different policies
4. **Testability:** Measurement is deterministic; policy is application-specific

### Consequences

- **Positive:** Maximum consumer flexibility, pure measurement function
- **Negative:** Every consumer must implement triage logic
- **Neutral:** Spec includes recommended (non-normative) threshold guidelines

---

## FDR-TRN-006: Two-Phase Validation

### Context

Validation has two aspects:
1. **Structural:** Is the graph well-formed? (Acyclic, stateful, etc.)
2. **Semantic:** Is it valid against the domain? (Lexicon compatibility)

Structural validation doesn't need Lexicon; semantic validation does.

### Decision

**Validation is split into two phases:**

| Phase | Timing | Requires Lexicon | Automatic |
|-------|--------|------------------|-----------|
| Structural | `translate()` return | No | Yes (MUST) |
| Lexicon-Verified | `validate()` call | Yes | No (explicit) |

```typescript
// Phase 1: Automatic
const graph = translate(text);  // Structurally valid

// Phase 2: Explicit
const result = validate(graph, { lexicon });  // Semantically valid
```

### Alternatives Considered

| Alternative | Pros | Cons |
|-------------|------|------|
| **A1: All validation at translate()** | Single call | Requires Lexicon for basic translation |
| **A2: All validation at validate()** | Lazy validation | Could return invalid graphs |
| **A3: Two-phase** | Flexible, always-valid structural output | Two API calls for full validation |

### Rationale

1. **Lexicon availability:** Lexicon may not be available at translation time
2. **Fail-fast on structure:** Structural errors should never escape `translate()`
3. **Domain portability:** Same Intent Graph can be validated against different Lexicons
4. **Progressive enhancement:** Basic use cases don't need Lexicon validation

### Consequences

- **Positive:** Flexible validation, always-valid structural output
- **Negative:** Two calls for complete validation
- **Neutral:** `validateWith` option allows single-call convenience

---

## FDR-TRN-007: Deferred Lowering

### Context

Complex intents often contain **discourse references** that refer to results of earlier steps:

```
"Create a project and add tasks to it"
                                  ↑
                            Refers to the project
                            created in step 1
```

At translation/emit time, the project doesn't exist yet. The reference cannot be resolved.

### Decision

**Lowering can be deferred when discourse references cannot be resolved at emit time. The original IntentIR is preserved at the step level for re-lowering at execution time.**

```typescript
type InvocationStep = {
  nodeId: IntentNodeId;
  ir: IntentIR;  // Always present at step level
  lowering: LoweringResult;
  resolution: Resolution;
};

type LoweringResult = 
  | { status: "ready"; intentBody: IntentBody }
  | { status: "deferred"; reason: string }  // ir is at step level
  | { status: "failed"; reason: LoweringFailureReason };
```

### Alternatives Considered

| Alternative | Pros | Cons |
|-------------|------|------|
| **A1: Fail on unresolvable refs** | Simple | Rejects valid multi-step intents |
| **A2: Placeholder IDs** | Can lower immediately | Fake data in IntentBody |
| **A3: Deferred lowering** | Honest contract | Consumer must handle deferred steps |
| **A4: Template strings** | Inline resolution | Stringly-typed, error-prone |

### Rationale

1. **Honest contract:** `lowering.status = "deferred"` clearly indicates "not ready yet"
2. **Data preservation:** Original IR is preserved for accurate re-lowering
3. **Consumer control:** Consumer resolves at the right time with fresh context
4. **No fake data:** IntentBody is always valid, never contains placeholders

### Consequences

- **Positive:** Accurate representation of execution-time dependencies
- **Negative:** Consumers must implement deferred lowering logic
- **Neutral:** Common pattern documented with examples

---

## FDR-TRN-008: Terminology Isolation

### Context

Internally, Translator uses a concept called "Semantic Projection" (similar to LLVM's lowering). However:
- Manifesto Core already uses "Projection" for `Projection(schema, snapshot, intent) → snapshot'`
- External users might confuse the two concepts

### Decision

**"Semantic Projection" is internal terminology only. It MUST NOT appear in:**
- Exported API names
- Exported error names
- Public documentation
- User-facing error messages

```typescript
// ❌ Internal concept exposed
throw new SemanticProjectionError("...");
class SemanticProjector { ... }

// ✅ User-facing terminology
throw new TranslatorError("Cannot generate invocation plan: ...");
function emitForManifesto() { ... }  // "emit", not "project"
```

### Alternatives Considered

| Alternative | Pros | Cons |
|-------------|------|------|
| **A1: Use "Projection" everywhere** | Consistent with internal model | Conflicts with Core terminology |
| **A2: Rename internal concept** | No conflict | Loses LLVM analogy internally |
| **A3: Isolate terminology** | Clear external API | Two vocabularies to maintain |

### Rationale

1. **No confusion:** External users never encounter conflicting "Projection" concepts
2. **Lower barrier:** Users don't need to understand compiler theory
3. **Internal freedom:** Team can use precise terminology internally
4. **Error clarity:** "Cannot generate invocation plan" is actionable; "SemanticProjectionError" is not

### Consequences

- **Positive:** Clean external API, no terminology conflicts
- **Negative:** Internal/external vocabulary divergence
- **Neutral:** Documentation clearly separates internal/external terms

---

## FDR-TRN-009: InvocationPlan as Lowerable Plan

### Context

Initial design had InvocationPlan contain only `IntentBody[]`. This works for simple cases but fails for complex multi-step intents where later steps depend on earlier results.

The problem: at emit time, we cannot lower step 2 because it references step 1's (not-yet-existing) result.

### Decision

**InvocationPlan is a "Lowerable Plan" containing steps with three possible lowering states. Each step always includes the original IntentIR for re-lowering, debugging, and standalone serialization:**

```typescript
type InvocationStep = {
  nodeId: IntentNodeId;
  ir: IntentIR;  // Always present at step level
  lowering: 
    | { status: "ready"; intentBody: IntentBody }
    | { status: "deferred"; reason: string }
    | { status: "failed"; reason: LoweringFailureReason };
  resolution: Resolution;
};
```

Consumers execute with:
```typescript
for (const step of plan.steps) {
  if (step.lowering.status === "ready") {
    await execute(step.lowering.intentBody);
  } else if (step.lowering.status === "deferred") {
    // Use step.ir (always available)
    const resolved = resolver.resolveReferences(step.ir);
    const intentBody = lower(resolved, lexicon);
    await execute(intentBody);
  }
}
```

### Alternatives Considered

| Alternative | Pros | Cons |
|-------------|------|------|
| **A1: IntentBody[] only** | Simple | Can't handle deferred refs |
| **A2: Template IntentBody** | Single type | Stringly-typed, fake data |
| **A3: Lowerable Plan (current)** | Honest, flexible | More complex consumer logic |

### Rationale

1. **Critical enabler:** This decision unblocks complex multi-step intents
2. **Honest contract:** Each step's status is explicit
3. **Consumer control:** Consumer can optimize (e.g., batch-resolve, parallel lower)
4. **No fake data:** IntentBody is valid when present, IR is valid when deferred

### Consequences

- **Positive:** Enables complex intent execution, honest contract
- **Negative:** Consumers must handle three lowering states
- **Neutral:** Pattern well-documented with examples

---

## FDR-TRN-010: MelCandidate Scope

### Context

When lowering fails (action not supported), Translator could:
1. Just report the failure
2. Suggest schema extensions (MEL code)
3. Generate executable patches directly

### Decision

**MelCandidate is generated ONLY for lowering failures, and ONLY for non-Abstract intents.**

Generation rules:
- `resolveActionType()` fails → Generate MelCandidate
- Role mapping fails → Generate MelCandidate
- `resolution.status = "Abstract"` → Do NOT generate (insufficient information)

```typescript
// Generated when lowering fails but intent is clear
{
  nodeId: "n1",
  ir: { ... },
  suggestedMel: "action archive(target: Task[]) { ... }",
  reason: { kind: "action_not_found", details: "..." }
}
```

### Alternatives Considered

| Alternative | Pros | Cons |
|-------------|------|------|
| **A1: No suggestions** | Simple | Poor UX, dead end |
| **A2: Always suggest** | Maximum help | Noise for Abstract intents |
| **A3: Conditional suggestions** | Balanced | Needs clear rules |

### Rationale

1. **Actionable output:** MelCandidate gives users a path forward
2. **Quality control:** Abstract intents don't have enough info for good suggestions
3. **Scope limitation:** Intent IR spec says "MEL/Patch is downstream concern"
4. **Clear boundary:** MelCandidate is suggestion, not execution

### Consequences

- **Positive:** Actionable schema extension suggestions
- **Negative:** MelCandidate quality depends on IR quality
- **Neutral:** Consumers decide whether to apply suggestions

---

## Summary

| FDR | Key Decision | Primary Rationale |
|-----|--------------|-------------------|
| TRN-001 | Package independence | Layer separation, orthogonality |
| TRN-002 | DAG structure | Termination guarantee, determinism |
| TRN-003 | Node wraps IntentIR | Composition over modification |
| TRN-004 | Two-status model | Resolution ≠ lowering capability |
| TRN-005 | Measurement over decision | Consumer flexibility |
| TRN-006 | Two-phase validation | Lexicon optionality |
| TRN-007 | Deferred lowering | Honest contract for runtime refs |
| TRN-008 | Terminology isolation | No "Projection" confusion |
| TRN-009 | Lowerable Plan | Enables complex multi-step intents |
| TRN-010 | MelCandidate scope | Actionable suggestions for failures |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01-26 | Initial FDR |
