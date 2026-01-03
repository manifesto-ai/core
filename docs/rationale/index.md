# Design Rationale (FDR)

> **Purpose:** Understand why Manifesto is designed the way it is
> **Audience:** Contributors, skeptics, researchers, architects
> **Status:** Informative (non-normative)

---

## What is FDR?

**FDR** stands for **Foundational Design Rationale** — documents that explain why Manifesto's architecture exists and why alternatives were rejected.

FDRs are NOT:
- Specifications (see [Specifications](/specifications/) instead)
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

If you're new, read [Core Concepts](/core-concepts/) first.

---

## Why Design Decisions Are Documented

Manifesto makes **strong architectural commitments**:
- Core must be pure (no IO)
- Flows must terminate (no unbounded loops)
- Snapshot is the only medium (no hidden channels)
- World Protocol is mandatory (no direct execution)

These aren't arbitrary. Each decision:
- Solves a specific problem
- Rejects alternatives for documented reasons
- Makes explicit trade-offs

FDRs document these decisions so:
- **Contributors** understand constraints
- **Reviewers** can verify consistency
- **Users** understand trade-offs
- **Future maintainers** don't accidentally violate principles

---

## FDR Documents in This Section

### [Core FDR](./core-fdr)

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

**Reading time:** 25 minutes

---

### [Host FDR](./host-fdr)

**Why Host executes but doesn't decide.**

**Key decisions explained:**
- Why does Host not interpret effects?
- Why must effect handlers return patches?
- Why does Host loop until requirements are empty?
- Why is persistence optional?

**Alternatives rejected:**
- Intelligent Host (interpreting requirements)
- Effect handlers returning values
- Single compute-execute cycle
- Mandatory persistence

**Reading time:** 20 minutes

---

### [World FDR](./world-fdr)

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

**Reading time:** 25 minutes

---

### [Compiler FDR](./compiler-fdr)

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

**Reading time:** 60 minutes

---

## How to Read FDRs

### Structure of an FDR

Each FDR follows this structure:

```markdown
# [Component] FDR

## Problem Statement
What problem are we solving?

## Alternatives Considered
What approaches did we consider?

## Decision
What did we choose?

## Rationale
Why did we choose this?

## Trade-offs
What did we give up?

## Consequences
What does this decision imply?
```

### Reading Strategy

**For understanding:**
1. Read "Problem Statement" to understand context
2. Read "Decision" to see what was chosen
3. Read "Rationale" to understand why

**For evaluation:**
1. Read "Alternatives Considered" to see what was rejected
2. Read "Trade-offs" to understand costs
3. Form your own opinion

**For contribution:**
1. Read all sections
2. Understand constraints
3. Propose changes that respect principles (or challenge principles with new FDR)

---

## Reading Order

### For Contributors

**Goal:** Understand architectural constraints before contributing

1. **[Core FDR](./core-fdr)** — Understand purity requirement
2. **[Host FDR](./host-fdr)** — Understand execution model
3. **[World FDR](./world-fdr)** — Understand governance model

**Total time:** ~1 hour

Then: Read [Specifications](/specifications/) for normative requirements.

---

### For Skeptics/Evaluators

**Goal:** Decide if Manifesto's approach is sound

1. **[Core FDR](./core-fdr)** — Evaluate purity vs. convenience trade-off
2. **[World FDR](./world-fdr)** — Evaluate mandatory governance trade-off
3. **"Trade-offs" sections** — Assess if costs are worth benefits

**Total time:** ~45 minutes

Then: Compare with [Manifesto vs. Others](/what-is-manifesto/manifesto-vs-others).

---

### For Researchers

**Goal:** Understand philosophical foundations

1. Read all FDRs (~1.5 hours)
2. Read "Alternatives Considered" sections carefully
3. Read "Consequences" sections for implications

Then: Compare with academic literature on:
- Pure functional programming
- Event Sourcing
- Capability-based security
- Deterministic systems

---

## Common Questions

### Why not just read the code?

**Code shows what. FDRs explain why.**

Code changes over time. Principles shouldn't. FDRs document the invariants that code must respect.

### Can I propose changes to FDRs?

**Yes, but carefully.**

FDRs document fundamental decisions. Changing them means changing Manifesto's identity.

**Process:**
1. Open GitHub Discussion explaining why decision should change
2. Propose new FDR with:
   - New problem statement
   - New alternatives considered
   - New rationale
3. Community reviews and discusses
4. If accepted, FDR is updated and code follows

### What if I disagree with a decision?

**Good! That means FDRs are doing their job.**

FDRs make trade-offs explicit so you can evaluate them.

If you disagree:
1. Identify which FDR you disagree with
2. Explain which alternative you prefer
3. Explain why you think the trade-off is wrong
4. Open Discussion

Disagreement is welcome. It keeps us honest.

### Do FDRs ever change?

**Rarely, and only for good reason.**

FDRs can change if:
- Original problem statement was incomplete
- New information invalidates original reasoning
- Original decision had unforeseen consequences

Changes require:
- Strong justification
- Community consensus
- Migration path for existing code

---

## Key Design Principles (Summary)

### Principle 1: Determinism Over Convenience

**Decision:** Core must be pure, even if it's less convenient.

**Why:** Determinism enables:
- Reproducible debugging
- Time-travel
- Reliable testing
- Verifiable computation

**Trade-off:** More verbose (effects as declarations), but guaranteed correctness.

**FDR:** [Core FDR](./core-fdr)

---

### Principle 2: Separation of Concerns

**Decision:** Core computes, Host executes, World governs. No mixing.

**Why:** Separation enables:
- Independent testing
- Replaceable implementations
- Clear reasoning boundaries

**Trade-off:** More layers, but each layer is simple and testable.

**FDR:** [Core FDR](./core-fdr), [Host FDR](./host-fdr), [World FDR](./world-fdr)

---

### Principle 3: Accountability Over Flexibility

**Decision:** World Protocol is mandatory. All intents must be governed.

**Why:** Accountability is non-negotiable for:
- AI agent safety
- Compliance requirements
- Audit trails
- Trust in multi-actor systems

**Trade-off:** Less flexibility (can't skip governance), but guaranteed accountability.

**FDR:** [World FDR](./world-fdr)

---

### Principle 4: Snapshot as Sole Medium

**Decision:** All communication through Snapshot. No hidden channels.

**Why:** Single medium ensures:
- Complete state visibility
- Serialization
- Reproducibility

**Trade-off:** More explicit patch handling, but no hidden state bugs.

**FDR:** [Core FDR](./core-fdr#snapshot-as-sole-medium)

---

### Principle 5: Termination Guarantees

**Decision:** Flows must terminate. No unbounded loops.

**Why:** Termination enables:
- Static analysis
- Complete traces
- Guaranteed halt

**Trade-off:** Less expressiveness (no while loops in Flows), but guaranteed termination.

**FDR:** [Core FDR](./core-fdr#flow-termination)

---

## Philosophical Foundations

Manifesto draws inspiration from:

### Pure Functional Programming

- Haskell's separation of pure and impure code
- Effect systems (Effect-TS)
- Elm Architecture

**What we borrowed:**
- Pure computation layer
- Effects as data
- Immutability

**What we didn't:**
- Lazy evaluation
- Higher-kinded types
- Monadic composition

---

### Event Sourcing

- Event Store
- CQRS pattern
- Audit logging

**What we borrowed:**
- Immutable history
- Replay capability
- Audit trails

**What we didn't:**
- Event log as source of truth (we use Snapshot)
- Event-first modeling (we use Intent-first)

---

### Capability-Based Security

- Object-capability model
- Principle of least authority
- Explicit authority delegation

**What we borrowed:**
- Authority as first-class concept
- Explicit authorization
- Audit trails

**What we didn't:**
- Pure object-capability model (we use World Protocol)

---

### Finite State Machines

- XState
- State charts
- Formal verification

**What we borrowed:**
- Explicit state transitions
- Termination guarantees
- Visualization potential

**What we didn't:**
- FSM as primary abstraction (we use domain state)
- Nested/parallel states (we use World DAG)

---

## Trade-offs We Accept

Manifesto is **not** for everyone. We accept these trade-offs:

### More Upfront Structure

**Trade-off:** More boilerplate than imperative code.

**We accept this because:** Structure enables tooling, verification, and AI generation.

**Alternative:** Redux/Zustand (less structure, more flexibility)

---

### Less Imperative Flexibility

**Trade-off:** Can't write arbitrary async/await code in Core.

**We accept this because:** Pure Core enables determinism and testing without mocks.

**Alternative:** MobX/Vue (imperative reactions, less determinism)

---

### Mandatory Governance

**Trade-off:** Can't skip World Protocol for "simple" intents.

**We accept this because:** Accountability is non-negotiable.

**Alternative:** Skip governance for trusted environments (we don't allow this)

---

### Larger State Snapshots

**Trade-off:** Store full snapshots, not just events.

**We accept this because:** Instant state access > smaller storage.

**Alternative:** Event Sourcing (smaller logs, rebuild required)

---

## Next Steps

### After Reading FDRs

1. **Contribute:** Understand constraints, propose changes
2. **Evaluate:** Decide if trade-offs fit your needs
3. **Research:** Compare with other systems

### If You Want to Contribute

1. Read relevant FDRs
2. Read [Specifications](/specifications/)
3. Read [Architecture](/architecture/)
4. Open Discussion for proposals

### If You Want to Challenge a Decision

1. Identify the FDR
2. Explain your alternative
3. Show why trade-off is wrong
4. Open Discussion

---

## Related Sections

- **[Architecture](/architecture/)** — How design is implemented
- **[Specifications](/specifications/)** — Normative requirements
- **[Core Concepts](/core-concepts/)** — What FDRs formalize

---

## Contributing to FDRs

We welcome FDR improvements:

**Good contributions:**
- Clarifying existing decisions
- Adding new alternatives considered
- Documenting unforeseen consequences
- Proposing new FDRs for new components

**Process:**
1. Open GitHub Discussion
2. Draft FDR following template
3. Community reviews
4. If accepted, add to repository

See [FDR Template](https://github.com/manifesto-ai/core/blob/main/docs/FDR_TEMPLATE.md).

---

## Summary

**FDRs explain why Manifesto is designed the way it is.**

**Core principles:**
1. Determinism over convenience
2. Separation of concerns
3. Accountability over flexibility
4. Snapshot as sole medium
5. Termination guarantees

**Trade-offs we accept:**
- More structure, less flexibility
- Mandatory governance
- Larger snapshots

**Read FDRs if:**
- You want to contribute
- You're skeptical of design
- You're researching alternatives

---

**Start with [Core FDR](./core-fdr) to understand the foundation.**
