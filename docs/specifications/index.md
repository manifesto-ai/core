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

If you're new, read [Core Concepts](/core-concepts/) first.

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

**Example:**

```
Core MUST NOT perform IO.
Core SHOULD validate schemas before computation.
Host MAY cache snapshots for performance.
```

### Document Structure

Each specification follows this structure:

```markdown
# [Component] Specification

## 1. Scope
What this spec covers

## 2. Conformance
What conformance means

## 3. Normative Requirements
MUST/SHOULD/MAY statements

## 4. Invariants
What must always be true

## 5. Test Criteria
How to verify conformance
```

### Normative vs. Informative

- **Normative sections** define requirements
- **Informative sections** (marked "Non-normative") provide context

Only normative sections are binding.

---

## Specifications in This Section

### [Schema Specification](./schema-spec)

**Status:** Normative
**Version:** 1.0

Defines the structure and semantics of DomainSchema.

**What it covers:**
- StateSpec (domain state structure)
- ComputedSpec (derived values)
- ActionSpec (intent handlers)
- Expression language (Expr)
- Flow language (FlowNode)
- Schema validation rules

**Who needs this:**
- Implementers of Builder DSL
- Schema validators
- Code generators (AI or otherwise)
- Advanced users writing raw schemas

**Reading time:** 30 minutes

---

### [Host Contract](./host-contract)

**Status:** Normative
**Version:** 1.0

Defines Host's responsibilities and guarantees.

**What it covers:**
- Effect handler contract
- Compute-effect loop requirements
- Patch application semantics
- Snapshot persistence contract
- Failure handling requirements

**Who needs this:**
- Host implementers
- Effect handler authors
- Integration builders
- Advanced debugging

**Reading time:** 20 minutes

---

### [World Protocol](./world-protocol)

**Status:** Normative
**Version:** 1.0

Defines governance layer semantics.

**What it covers:**
- Proposal submission requirements
- Authority evaluation contract
- Decision recording semantics
- Lineage DAG requirements
- Actor registry contract

**Who needs this:**
- World implementers
- Authority policy authors
- Compliance engineers
- Multi-tenant system designers

**Reading time:** 25 minutes

---

### [Intent & Projection](./intent-projection)

**Status:** Normative
**Version:** 1.0

Defines Intent structure and projection semantics.

**What it covers:**
- IntentBody vs IntentInstance
- Intent validation requirements
- Projection function contract
- Issuer responsibilities
- Intent routing semantics

**Who needs this:**
- Bridge implementers
- Custom projection authors
- Event system integrators
- Advanced routing logic

**Reading time:** 15 minutes

---

### [Compiler Specification](./compiler-spec)

**Status:** Normative
**Version:** 1.1

Defines MEL compilation to DomainSchema.

**What it covers:**
- Compiler input/output contract
- MEL parsing and semantic validation
- DomainSchema generation and lowering
- Error handling and diagnostics

**Who needs this:**
- Compiler implementers
- Schema validation tool authors

**Reading time:** 20 minutes

---

## Reading Order

### For Implementers

**Goal:** Build conformant implementations

1. **[Schema Specification](./schema-spec)** — Understand core data model
2. **[Host Contract](./host-contract)** — Understand execution requirements
3. **[World Protocol](./world-protocol)** — Understand governance requirements
4. **[Intent & Projection](./intent-projection)** — Understand intent routing

**Total time:** ~1.5 hours

Then: Read [Architecture](/architecture/) to understand how specs fit together.

### For Reviewers

**Goal:** Validate implementations

1. **[Schema Specification](./schema-spec)** — Verify schema correctness
2. **[Host Contract](./host-contract)** — Verify execution correctness
3. **Test Criteria sections** — Define conformance tests

**Total time:** ~1 hour

Then: Use specs to write conformance tests.

### For Tool Builders

**Goal:** Build linters, analyzers, generators

1. **[Schema Specification](./schema-spec)** — Parse and validate schemas
2. **[Compiler Specification](./compiler-spec)** — Understand generation constraints
3. **Invariants sections** — Verify static properties

**Total time:** ~1 hour

Then: Build tooling that enforces spec requirements.

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

If a spec contradicts the Constitution, the Constitution wins.

If code contradicts a spec, the spec wins (code has a bug).

---

## Conformance Testing

### What is Conformance?

An implementation **conforms** to a spec if it satisfies all MUST/MUST NOT requirements.

### How to Test Conformance

Each spec includes "Test Criteria" section:

```typescript
// Example from Schema Spec
describe('Schema Conformance', () => {
  it('MUST reject schemas with circular computed dependencies', () => {
    const schema = {
      computed: {
        a: { deps: ['b'], expr: { kind: 'get', path: 'computed.b' } },
        b: { deps: ['a'], expr: { kind: 'get', path: 'computed.a' } },
      }
    };

    expect(() => validateSchema(schema)).toThrow('Circular dependency');
  });
});
```

### Conformance Levels

| Level | Requirements |
|-------|-------------|
| **Full Conformance** | All MUST requirements satisfied |
| **Partial Conformance** | Some MUST requirements satisfied (specify which) |
| **Non-Conformance** | One or more MUST requirements violated |

Only "Full Conformance" implementations can claim Manifesto compatibility.

---

## Specification Versioning

Specifications use semantic versioning:

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes (incompatible)
MINOR: Additions (backward compatible)
PATCH: Clarifications (no semantic change)
```

**Example:**
- Schema Spec 1.0.0: Initial release
- Schema Spec 1.1.0: Added optional fields (backward compatible)
- Schema Spec 2.0.0: Changed required fields (breaking)

**Experimental versions** use suffix `v`:
- Compiler Spec 1.1v: Experimental (may change)

---

## Common Questions

### Do I need to read all specs?

**No.** Read only what you need:

- Building apps? Read [Guides](/guides/) instead
- Integrating with existing Host? Read [Host Contract](./host-contract)
- Building authority policies? Read [World Protocol](./world-protocol)
- Generating schemas with AI? Read [Schema Specification](./schema-spec)

### Are specs stable?

**Yes.** Normative specs are stable once released.

Changes to normative specs:
- **Backward compatible** (MINOR version): Rare, additive only
- **Breaking** (MAJOR version): Very rare, documented extensively

### What if I find a conflict?

**Report it:**
1. Open GitHub issue
2. Cite specific spec sections
3. Describe the conflict
4. Propose resolution

Specs should never conflict. If they do, it's a bug.

### Can I deviate from SHOULD requirements?

**Yes, with justification.**

Example:
```
Spec: "Host SHOULD persist snapshots to durable storage."

Deviation: "Our implementation keeps snapshots in-memory only
            because we require sub-millisecond latency and
            can rebuild from source on restart."
```

Document deviations clearly.

### What if spec is ambiguous?

**Clarification process:**
1. Open GitHub discussion
2. Cite ambiguous section
3. Propose clarification

Spec will be updated with PATCH version (no semantic change).

---

## Quick Reference: Spec Summaries

### Schema Specification

**One sentence:** Defines structure and validation rules for DomainSchema.

**Key requirements:**
- StateSpec MUST be serializable
- Computed dependencies MUST form a DAG
- Expressions MUST be pure
- Flows MUST terminate

---

### Host Contract

**One sentence:** Defines Host's execution and orchestration requirements.

**Key requirements:**
- Host MUST execute all declared requirements
- Effect handlers MUST return patches
- Compute loop MUST run until requirements are empty
- Host MUST NOT modify requirements before execution

---

### World Protocol

**One sentence:** Defines governance layer semantics and authority evaluation.

**Key requirements:**
- All intents MUST go through World Protocol
- Authority MUST evaluate before execution
- Decisions MUST be recorded
- Lineage MUST form a DAG

---

### Intent & Projection

**One sentence:** Defines Intent structure and how SourceEvents become Intents.

**Key requirements:**
- IntentBody MUST have type field
- Projection MUST be deterministic
- Issuer MUST add intentId and intentKey
- Intent validation MUST happen before World submission

---

### Compiler Specification

**One sentence:** Defines how MEL is compiled to DomainSchema.

**Key requirements:**
- Compiler MUST produce valid DomainSchema
- Compilation MUST be reproducible (same MEL source -> same schema)
- Validation MUST catch all schema errors
- Error messages MUST be actionable

---

## Next Steps

### After Reading Specs

1. **Understand rationale:** Read [Design Rationale](/rationale/)
2. **Build conformant implementations:** Use Test Criteria
3. **Contribute improvements:** Open GitHub issues/PRs

### If You're Building Tools

1. **Parse schemas:** Use [Schema Specification](./schema-spec)
2. **Validate implementations:** Use Test Criteria
3. **Generate code:** Follow normative requirements

### If You're Auditing

1. **Check conformance:** Verify all MUST requirements
2. **Document deviations:** Note any SHOULD deviations
3. **Report violations:** File issues for non-conformance

---

## Related Sections

- **[Architecture](/architecture/)** — Understand how specs fit together
- **[Rationale](/rationale/)** — Understand why specs are written this way
- **[Core Concepts](/core-concepts/)** — Understand what specs formalize

---

**Specifications are normative. If you're implementing Manifesto, start with [Schema Specification](./schema-spec).**
