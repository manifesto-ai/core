# Design Rationale (FDR)

> **Purpose:** Understand why Manifesto is designed the way it is
> **Audience:** Contributors, skeptics, researchers, architects
> **Status:** Informative (non-normative)

---

## What is FDR?

**FDR** stands for **Foundational Design Rationale** — documents that explain why Manifesto's architecture exists and why alternatives were rejected.

FDRs are NOT:
- Specifications (see [Specifications](/internals/spec/) instead)
- Tutorials (see [Guides](/guides/) instead)
- Architecture descriptions (see [Architecture](/architecture/) instead)

FDRs ARE:
- Explanations of design decisions
- Analysis of rejected alternatives
- Trade-off discussions
- Historical context
- Philosophical foundations

**Who should read FDRs:**
- Contributors who want to understand the "why"
- Skeptics evaluating whether Manifesto's approach is sound
- Researchers comparing architectural approaches
- Architects designing similar systems

**Who should NOT start here:**
- Beginners learning Manifesto
- Users just building applications
- People looking for API documentation

If you're new, read [Core Concepts](/concepts/) first.

---

## FDR Documents

### High-Level Package

#### [App FDR](./app-fdr)

**Why the App facade exists and how it simplifies Manifesto usage.**

**Key decisions explained:**
- Why provide a high-level facade over Host/World?
- Why `ready()` is async and returns a promise
- Why actions return `ActionHandle` with `.done()`
- Why subscriptions use selector functions

---

### Core Layer

#### [Core FDR](./core-fdr)

**Why Core is pure. Why effects are declarations.**

**Key decisions explained:**
- Why separate computation from execution?
- Why not allow IO in Core?
- Why are effects declarations, not executions?
- Why is Snapshot the only medium?
- Why are Flows not Turing-complete?

**Alternatives rejected:**
- Mixed computation/execution (Redux thunks)
- Effect execution in Core
- Value passing outside Snapshot
- Turing-complete flows

---

#### [Compiler FDR](./compiler-fdr)

**Why MEL exists and how it stays deterministic.**

**Key decisions explained:**
- Why MEL uses explicit keywords and function-only syntax
- Why patches and effects are statements (not expressions)
- Why expressions are canonical and deterministic
- Why system values are modeled as effects
- Why `available`, `fail`, and `stop` exist for Core alignment

**Alternatives rejected:**
- Using JavaScript/TypeScript directly
- Implicit operators and template literals
- Special-case "magic" system values

---

### Runtime Layer

#### [Host FDR](./host-fdr)

**Why Host executes but doesn't decide.**

**Key decisions explained:**
- Why does Host not interpret effects?
- Why must effect handlers return patches?
- Why does Host loop until requirements are empty?
- Why is persistence optional?
- Why FIFO serialization for dispatch?

**Alternatives rejected:**
- Intelligent Host (interpreting requirements)
- Effect handlers returning values
- Single compute-execute cycle
- Mandatory persistence

---

#### [World FDR](./world-fdr)

**Why governance is built-in, not optional.**

**Key decisions explained:**
- Why is World Protocol mandatory?
- Why store Intents instead of Events?
- Why is authority evaluation separate from execution?
- Why is lineage a DAG?

**Alternatives rejected:**
- Optional governance
- Event Sourcing model
- Inline authorization checks
- Linear history

---

#### [Bridge FDR](./bridge-fdr)

**Why Bridge exists as a separate layer.**

**Key decisions explained:**
- Why separate event routing from Host?
- Why projections are functions, not declarations
- Why two-way binding is explicit
- Why SourceEvents are distinct from Intents

---

### Builder & DSL

#### [Builder FDR](./builder-fdr)

**Why the type-safe DSL exists.**

**Key decisions explained:**
- Why Zod-first schema definition?
- Why zero-string-path APIs?
- Why re-entry helpers are built-in
- Why `defineDomain()` returns schema, not runtime

---

### UI Integration

#### [React FDR](./react-fdr)

**Why React bindings are designed this way.**

**Key decisions explained:**
- Why hooks over HOCs?
- Why Bridge integration is required?
- Why selective re-render matters?

---

### AI & Memory

#### [Translator FDR](./translator-fdr)

**Why natural language translation uses a 6-stage pipeline.**

**Key decisions explained:**
- Why schema-guided interpretation?
- Why verification is separate from translation?
- Why multiple LLM calls instead of one?

---

#### [Memory FDR](./memory-fdr)

**Why memory retrieval is verified.**

**Key decisions explained:**
- Why verification before use?
- Why retrieval is separate from storage?

---

### Utilities

#### [Effect Utils FDR](./effect-utils-fdr)

**Why common patterns are extracted.**

**Key decisions explained:**
- Why composition over inheritance?
- Why declarative error handling?

---

#### [Lab FDR](./lab-fdr)

**Why HITL tooling is built-in.**

**Key decisions explained:**
- Why trace-based replay?
- Why LLM necessity governance?
- Why human-in-the-loop is first-class?

---

## Key Design Principles (Summary)

### Principle 1: Determinism Over Convenience

**Decision:** Core must be pure, even if it's less convenient.

**Why:** Determinism enables:
- Reproducible debugging
- Time-travel
- Reliable testing
- Verifiable computation

**FDR:** [Core FDR](./core-fdr)

---

### Principle 2: Separation of Concerns

**Decision:** Core computes, Host executes, World governs. No mixing.

**Why:** Separation enables:
- Independent testing
- Replaceable implementations
- Clear reasoning boundaries

**FDR:** [Core FDR](./core-fdr), [Host FDR](./host-fdr), [World FDR](./world-fdr)

---

### Principle 3: Accountability Over Flexibility

**Decision:** World Protocol is mandatory. All intents must be governed.

**Why:** Accountability is non-negotiable for:
- AI agent safety
- Compliance requirements
- Audit trails
- Trust in multi-actor systems

**FDR:** [World FDR](./world-fdr)

---

### Principle 4: Snapshot as Sole Medium

**Decision:** All communication through Snapshot. No hidden channels.

**Why:** Single medium ensures:
- Complete state visibility
- Serialization
- Reproducibility

**FDR:** [Core FDR](./core-fdr)

---

### Principle 5: Termination Guarantees

**Decision:** Flows must terminate. No unbounded loops.

**Why:** Termination enables:
- Static analysis
- Complete traces
- Guaranteed halt

**FDR:** [Core FDR](./core-fdr)

---

## Reading Order

### For Contributors

**Goal:** Understand architectural constraints before contributing

1. **[Core FDR](./core-fdr)** — Understand purity requirement
2. **[Host FDR](./host-fdr)** — Understand execution model
3. **[World FDR](./world-fdr)** — Understand governance model

**Total time:** ~1 hour

### For App Developers

**Goal:** Understand high-level design decisions

1. **[App FDR](./app-fdr)** — Why the facade exists
2. **[Compiler FDR](./compiler-fdr)** — Why MEL is designed this way

**Total time:** ~30 minutes

---

## Related Sections

- **[Architecture](/architecture/)** — How design is implemented
- **[Specifications](/internals/spec/)** — Normative requirements
- **[Core Concepts](/concepts/)** — What FDRs formalize

---

**Start with [Core FDR](./core-fdr) to understand the foundation.**
