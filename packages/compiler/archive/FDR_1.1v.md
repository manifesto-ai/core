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

*[Full FDR continues with all sections from the original document]*

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

*End of @manifesto-ai/compiler FDR v1.1*
