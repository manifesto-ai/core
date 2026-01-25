# Specifications

> **Purpose:** Normative contracts for Manifesto implementations
> **Audience:** Implementers, reviewers, auditors
> **Status:** Normative (binding)

---

## What Are Specifications?

Specifications are **normative documents** that define how Manifesto components MUST behave.

These are NOT:
- Tutorials
- Guides
- Examples
- Explanations

These ARE:
- Authoritative contracts
- Requirements (MUST/SHOULD/MAY)
- Invariants (guarantees)
- Test criteria (conformance)

**Who should read specs:**
- Implementers building Manifesto libraries
- Reviewers validating implementations
- Tool builders (linters, analyzers, compilers)
- Advanced users needing precise semantics

**Who should NOT start here:**
- Beginners learning Manifesto
- Users building applications
- People evaluating whether to use Manifesto

If you're new, read [Core Concepts](/concepts/) first.

---

## How to Read Specifications

### RFC 2119 Keywords

Specifications use RFC 2119 keywords:

| Keyword | Meaning |
|---------|---------|
| **MUST** | Absolute requirement. Violation = non-conformance. |
| **MUST NOT** | Absolute prohibition. Violation = non-conformance. |
| **SHOULD** | Strong recommendation. May deviate for valid reasons. |
| **SHOULD NOT** | Strong discouragement. May deviate for valid reasons. |
| **MAY** | Optional. Implementers decide. |

---

## Package Specifications

### High-Level Packages

#### [App Spec](./app-spec)

**Status:** Normative | **Version:** 0.4.7

High-level facade for building Manifesto applications.

**What it covers:**
- `createApp()` API and lifecycle
- Action dispatching and service handlers
- Subscription system and state access
- Branch management for parallel states

---

### Core Layer

#### [Core Spec](./core-spec)

**Status:** Draft | **Version:** 1.0

Defines the pure computation engine and DomainSchema.

**What it covers:**
- DomainSchema structure (StateSpec, ComputedSpec, ActionSpec)
- Expression language (Expr) and evaluation
- Flow language (FlowNode) and execution
- Snapshot structure and validation
- Trace and Requirements output

---

#### [Compiler Spec](./compiler-spec)

**Status:** Normative | **Version:** 0.4.0

Defines MEL compilation to DomainSchema.

**What it covers:**
- MEL parsing and semantic analysis
- DomainSchema generation
- Error diagnostics and recovery
- Canonical form guarantees

---

### Runtime Layer

#### [Host Spec](./host-spec)

**Status:** Normative | **Version:** 2.0.1

Defines Host's responsibilities and guarantees.

**What it covers:**
- Effect handler contract
- Compute-effect loop requirements
- Patch application semantics
- FIFO serialization guarantees
- Failure handling requirements

---

#### [World Spec](./world-spec)

**Status:** Normative | **Version:** 1.0

Defines governance layer semantics.

**What it covers:**
- Proposal submission requirements
- Authority evaluation contract
- Decision recording semantics
- Lineage DAG requirements
- Actor registry contract

---

### Builder & DSL

#### [Builder Spec](./builder-spec)

**Status:** Normative | **Version:** 1.0

Defines the type-safe domain definition DSL.

**What it covers:**
- `defineDomain()` API contract
- Zod-first state schema
- Zero-string-path guarantees
- Re-entry safety helpers

---

#### [Intent IR Spec](./intent-ir-spec)

**Status:** Stable | **Version:** 0.1.0

Defines the Intent Intermediate Representation.

**What it covers:**
- Chomskyan LF-based semantic structures
- Term and Proposition types
- Force and EventClass enumerations

---

## Reading Order

### For Implementers

**Goal:** Build conformant implementations

1. **[Core Spec](./core-spec)** — Understand core data model
2. **[Host Spec](./host-spec)** — Understand execution requirements
3. **[World Spec](./world-spec)** — Understand governance requirements

**Total time:** ~1.5 hours

### For App Developers

**Goal:** Understand high-level APIs

1. **[App Spec](./app-spec)** — High-level facade
2. **[Compiler Spec](./compiler-spec)** — MEL compilation

**Total time:** ~45 minutes

---

## Specification Hierarchy

When specs conflict (rare), prefer this order:

```
1. Constitution (CLAUDE.md)         ← Highest authority
2. Specifications (this section)    ← Normative contracts
3. FDR (Design Rationale)           ← Explanations
4. Code                             ← Implementation
5. Guides/README                    ← Documentation
```

---

## Related Sections

- **[Architecture](/architecture/)** — Understand how specs fit together
- **[Rationale](/internals/fdr/)** — Understand why specs are written this way
- **[Core Concepts](/concepts/)** — Understand what specs formalize

---

**Start with [Core Spec](./core-spec) to understand the foundation.**
