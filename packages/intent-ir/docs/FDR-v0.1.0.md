# Manifesto Intent IR — Foundational Design Rationale (FDR)

> **Status:** Draft  
> **Version:** 0.1.0  
> **Companion To:** `manifesto-intent-ir` SPEC v0.1.0  
> **License:** MIT

---

## Changelog

| Version | Changes |
|---------|---------|
| **v0.1.0** | Initial release: FDR-INT-001 ~ FDR-INT-012 |

---

## Table of Contents

1. [Overview](#overview)
2. [Foundational Architecture Decision (FAD-INT-001)](#foundational-architecture-decision-fad-int-001)
3. [Core Philosophy Decisions](#core-philosophy-decisions)
    - FDR-INT-001: Chomskyan LF as Semantic Foundation
    - FDR-INT-002: Functional Heads are Enumerated and Finite
    - FDR-INT-003: AND-Only Conditions in v0.1
4. [Data Model Decisions](#data-model-decisions)
    - FDR-INT-004: Term is Discriminated Union
    - FDR-INT-005: Shape over Raw for ValueTerm
    - FDR-INT-006: Single Term per Role in v0.1
5. [Operator and Expression Decisions](#operator-and-expression-decisions)
    - FDR-INT-007: "in" Operator Deferred to v0.2+
    - FDR-INT-008: OBSERVE TARGET Semantics Delegated to Lexicon
6. [Contract and Validation Decisions](#contract-and-validation-decisions)
    - FDR-INT-009: JSON Schema Normative, Zod Informative
    - FDR-INT-010: Lexicon-Based Feature Checking
7. [Versioning Decisions](#versioning-decisions)
    - FDR-INT-011: Enum Extension is BREAKING
    - FDR-INT-012: Wire Version vs Spec Version Separation
8. [Summary Table](#summary-table)
9. [Cross-Reference: Related FDRs](#cross-reference-related-fdrs)

---

## Overview

This document captures the **foundational design rationale** for the Manifesto Intent IR specification. Each decision (FDR-INT-*) explains why the specification is designed the way it is, what alternatives were considered, and what consequences follow.

> **Intent IR = 자연어(PF)에서 추출된 의미를 언어-독립적 논리형(LF)으로 표현하는 중간 표현**

Intent IR is:
- A **Chomskyan LF-based semantic structure** (not strings, not tokens)
- **Language-independent** (Korean, English, Chinese → same IR)
- **Lexicon-verifiable** (validity decidable against domain schema)
- **Canonicalizable** (same meaning → same serialization)
- **Coordinate-ready** (transformable to StrictKey/SimKey for retrieval)

Intent IR is NOT:
- A natural language generation system
- An execution plan or runtime instruction
- A database query language
- A replacement for MEL IR (Intent IR *lowers to* MEL IR)

---

## Foundational Architecture Decision (FAD-INT-001)

### Intent IR is LF, Not Surface Form

> **핵심: "구조가 의미다." 문자열이나 토큰이 아니라, 헤드+논항+특징의 구조가 의미를 담는다.**

This is the **foundational identity** of Intent IR. All other decisions derive from this.

#### The Chomskyan Framework

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Chomskyan Architecture                              │
│                                                                         │
│   PF (Phonetic Form)  ◄────  Syntax  ────►  LF (Logical Form)          │
│   "표면 발화"                                "의미 구조"                  │
│                                                                         │
│   "주문 취소해"  ─────────────────────────►  { force: DO,               │
│   "Cancel my order"  ─────────────────────►    event: { lemma: CANCEL } │
│   "取消订单"  ────────────────────────────►    args: { TARGET: ... } }  │
│                                                                         │
│   다양한 PF  ──────────────────────────────►  동일한 LF                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Why Chomskyan LF?

| Aspect | Surface-based (tokens/strings) | LF-based (Intent IR) |
|--------|-------------------------------|---------------------|
| Language independence | ❌ Language-specific | ✅ Universal structure |
| Canonicalization | ❌ "cancel" ≠ "취소" | ✅ Same LF |
| Validation | ❌ String matching | ✅ Feature checking |
| Caching/Retrieval | ❌ Embedding-only | ✅ Structural coordinates |
| Deterministic processing | ❌ Requires NLP | ✅ Pure structure manipulation |

#### Core Properties

| Property | Value |
|----------|-------|
| Foundation | Chomsky's Minimalist Program |
| Unit of Meaning | Functional Head + Arguments + Features |
| Validation Method | Lexicon-based feature checking |
| Canonicalization | Structural normalization |
| Downstream | Lowers to MEL IR for execution |

#### Why This Decision Matters

This decision ensures:
- **Multiple surface forms → single semantic representation**
- **Lexicon (schema) becomes the arbiter of validity**
- **Deterministic processing after LF extraction**
- **Retrieval/caching based on meaning, not surface form**
- **Clear separation: LLM extracts intent (PF→LF), Compiler handles the rest (LF→MEL)**

**This decision is final and non-negotiable.**

---

## Core Philosophy Decisions

### FDR-INT-001: Chomskyan LF as Semantic Foundation

#### Decision

Intent IR adopts **Chomsky's Logical Form (LF)** as the theoretical foundation for semantic representation.

#### Context

Natural language systems face a fundamental challenge: the same meaning can be expressed in countless surface forms across languages, registers, and phrasings. Traditional NLP approaches handle this via:
- Embeddings (lossy, non-interpretable)
- Dependency parsing (language-specific)
- Semantic role labeling (schema-agnostic)

Chomskyan LF provides a principled alternative: a **universal semantic structure** where meaning is expressed through **functional heads** and **argument structure**.

#### Rationale

**LF provides what we need:**

1. **Language Independence**: LF abstracts away from surface syntax
2. **Bounded Structure**: Functional heads are finite and enumerable
3. **Feature Checking**: Validity is decidable via Lexicon
4. **Compositional**: Complex meanings built from simple structures
5. **Decades of Research**: Well-studied theoretical foundation

**The key insight**: Chomsky's framework separates *what is said* (PF) from *what is meant* (LF). Intent IR captures the "meant" part.

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| AMR (Abstract Meaning Representation) | Less principled head structure; node-centric rather than projection-centric |
| Frame Semantics (FrameNet) | Frame-centric; doesn't map cleanly to functional projections |
| Dependency-based semantics | Too tied to surface syntax; language-specific |
| Embedding-only | Non-interpretable; can't do feature checking |

#### Consequences

| Enables | Constrains |
|---------|------------|
| Language-independent meaning | Must define functional head inventory |
| Lexicon-based validation | Requires Lexicon for each domain |
| Deterministic canonicalization | Structure must be normalizable |
| Coordinate-based retrieval | Shape/features must be extractable |

---

### FDR-INT-002: Functional Heads are Enumerated and Finite

#### Decision

All functional head values (Force, EventClass, Role, Modality, Time, VerifyMode, OutputType) MUST be **enumerated** in the specification. Extension happens via `ext` field, not new head values.

#### Context

In Chomskyan syntax, functional heads (C, T, v, etc.) are a **closed class**. This constrains the grammar and enables predictable processing. Intent IR adopts the same principle.

#### Rationale

**Enumeration provides:**

1. **Exhaustive pattern matching**: Consumers can handle all cases
2. **Bounded semantic space**: No unbounded vocabulary drift
3. **Deterministic processing**: Switch/case over known values
4. **Clear extension path**: Unknown values are never in core heads; use `ext`

**Open vocabulary would mean:**
- Unknown head values at runtime → undefined behavior
- Consumers can't guarantee exhaustive handling
- Canonicalization becomes impossible (how to normalize unknown heads?)

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Open string values | Unbounded; can't exhaustively match |
| Extensible enum pattern | Complicates validation; unclear semantics |
| Hierarchical heads | Adds complexity; v0.1 doesn't need it |

#### Consequences

| Enables | Constrains |
|---------|------------|
| Exhaustive pattern matching | Cannot add head values without version bump |
| Deterministic validation | Extensions must use `ext` field |
| Clear version boundaries | New heads = BREAKING change |

---

### FDR-INT-003: AND-Only Conditions in v0.1

#### Decision

The `cond` field in v0.1 supports **AND-conjunction only**. OR, NOT, and nested boolean logic are deferred to v0.2+.

#### Context

Conditions in semantic representations can range from simple (equality checks) to arbitrarily complex (nested boolean algebra with quantifiers). More expressive conditions mean:
- Harder canonicalization (DNF/CNF conversions needed)
- Complex validation logic
- Harder coordinate extraction

#### Rationale

**AND-only is the pragmatic choice for v0.1:**

1. **Trivial canonicalization**: Sort predicates alphabetically; done
2. **Covers majority of cases**: Most practical intents use AND conditions
3. **Simple validation**: Check each predicate independently
4. **Easy coordinate extraction**: Each predicate is a dimension

**OR/NOT would require:**
- Disjunctive normal form (DNF) conversion for canonicalization
- Complex satisfiability reasoning
- Multiple coordinate vectors per condition (one per disjunct)

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Full boolean algebra | Canonicalization complexity; overkill for v0.1 |
| Limited OR (top-level only) | Still requires DNF handling |
| Nested conditions | Even more complex; deferred |

#### Consequences

| Enables | Constrains |
|---------|------------|
| Simple canonicalization | Cannot express OR/NOT in v0.1 |
| Predictable coordinates | Must decompose complex conditions |
| Easy validation | Extension point clearly defined for v0.2+ |

---

## Data Model Decisions

### FDR-INT-004: Term is Discriminated Union

#### Decision

Term types form a **closed discriminated union** with `kind` as the discriminator:

```typescript
type Term =
  | EntityRefTerm    // kind: "entity"
  | PathRefTerm      // kind: "path"
  | ArtifactRefTerm  // kind: "artifact"
  | ValueTerm        // kind: "value"
  | ExprTerm;        // kind: "expr"
```

#### Context

Arguments in semantic structures need to represent various types: entities, paths, values, expressions, artifacts. The representation choice affects:
- Type safety in consumers
- Serialization/deserialization
- Validation
- Extension path

#### Rationale

**Discriminated union provides:**

1. **Exhaustive pattern matching**: `switch(term.kind)` covers all cases
2. **Type narrowing**: TypeScript narrows type after kind check
3. **Clear serialization**: `kind` field is always present
4. **Explicit extension**: New kinds require spec update

**Alternative representations lack these properties:**
- Untagged unions: Can't distinguish at runtime
- Class hierarchies: Over-engineered for data structures
- String-typed: No type safety

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Untagged union | Runtime type detection unreliable |
| Class hierarchy | Over-engineering; serialization complexity |
| Any/unknown | No type safety |
| Separate fields per type | Sparse objects; unclear which fields apply |

#### Consequences

| Enables | Constrains |
|---------|------------|
| Exhaustive pattern matching | Must check `kind` before accessing type-specific fields |
| Safe type narrowing | New term types require spec update |
| Clean serialization | `kind` always present in JSON |

---

### FDR-INT-005: Shape over Raw for ValueTerm

#### Decision

`ValueTerm` stores semantic `shape` (features/buckets) as the primary representation. `raw` is optional and for execution contexts only.

```typescript
type ValueTerm = {
  kind: "value";
  valueType: "string" | "number" | "boolean" | "date" | "enum" | "id";
  shape: Record<string, unknown>;  // Semantic features
  raw?: unknown;                    // Optional exact value
};
```

#### Context

Values in intents can be expressed in many equivalent forms:
- "5", "five", "다섯" → same number
- "today", "2024-01-15", "오늘" → same date concept

If we store raw values, canonicalization fails (different strings for same meaning). If we store only shape/features, we enable:
- Semantic equivalence checking
- Fuzzy matching
- Coordinate extraction

#### Rationale

**Shape-first design enables:**

1. **Canonicalization**: Same meaning → same shape (regardless of surface)
2. **Similarity computation**: Shapes can be compared structurally
3. **Coordinate extraction**: Shape fields become coordinate dimensions
4. **Abstraction level control**: Choose granularity via bucket design

**Raw values defeat the purpose:**
- "5" ≠ "five" as strings, but same semantically
- Can't cache/retrieve based on meaning
- Forces string normalization (what about "5.0"? "5.00"?)

#### Shape Design Guidelines

| valueType | Shape Strategy | Example |
|-----------|---------------|---------|
| `number` | Range buckets, magnitude | `{ range: "1-100", sign: "positive" }` |
| `string` | Length category, pattern | `{ length: "short", pattern: "word" }` |
| `date` | Relative position, precision | `{ relative: "past", precision: "day" }` |
| `boolean` | Direct value | `{ value: true }` |
| `enum` | Domain + value | `{ domain: "status", value: "active" }` |

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Raw only | Can't canonicalize; different strings for same meaning |
| Shape only (no raw) | Some execution contexts need exact value |
| Normalized raw | Still string-based; normalization rules unclear |

#### Consequences

| Enables | Constrains |
|---------|------------|
| Semantic canonicalization | Must define shape buckets per domain |
| Coordinate extraction | Shape design affects retrieval quality |
| Fuzzy matching | Raw value may be lost (acceptable for IR) |

---

### FDR-INT-006: Single Term per Role in v0.1

#### Decision

In v0.1, each θ-role maps to **exactly one Term** (not an array). Multiple terms per role is deferred to v0.2+.

```typescript
// v0.1: Role → Term (single)
args: Partial<Record<Role, Term>>

// v0.2+: Role → Term | Term[] (future)
```

#### Context

Linguistic theory allows multiple arguments for some roles (e.g., "Give [the book]THEME and [the pen]THEME to Mary"). Supporting this in IR requires:
- ListTerm type or array handling
- Canonicalization rules for lists (ordering)
- Feature checking for list contents

#### Rationale

**Single Term per Role in v0.1:**

1. **Simpler canonicalization**: No list ordering to handle
2. **Clearer validation**: One term, one check
3. **Sufficient for most cases**: Majority of intents have single arguments
4. **Clean extension path**: v0.2+ adds ListTerm with proper rules

**Multiple terms would require:**
- How to canonicalize `[A, B]` vs `[B, A]`? (Order matters? Sort?)
- How to validate? (All must satisfy restriction? Any?)
- How to extract coordinates? (One vector or multiple?)

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Allow array now | Canonicalization undefined; premature complexity |
| Union type (Term \| Term[]) | Complicates all consumers |
| Flatten to multiple roles | Loses semantic grouping |

#### Consequences

| Enables | Constrains |
|---------|------------|
| Simple `args` structure | Can't express multi-argument roles in v0.1 |
| Straightforward canonicalization | Must decompose or defer such intents |
| Clear v0.2+ scope | ListTerm + canonicalization rules needed |

---

## Operator and Expression Decisions

### FDR-INT-007: "in" Operator Deferred to v0.2+

#### Decision

The `"in"` (membership) operator is **not included** in v0.1 PredOp. It requires ListTerm for proper RHS typing.

```typescript
// v0.1 PredOp
type PredOp = "=" | "!=" | "<" | ">" | "<=" | ">=" 
            | "contains" | "startsWith" | "matches";

// Note: "in" deferred to v0.2+
```

#### Context

Membership testing (`x in [a, b, c]`) is useful but requires the RHS to be a list/array. In v0.1:
- Term union has no ListTerm
- ValueTerm.raw *could* hold an array, but shape semantics are unclear
- Canonicalization for list values is undefined

#### Rationale

**Deferring "in" is cleaner than partial support:**

1. **Type safety**: Without ListTerm, RHS type is unclear
2. **Canonicalization**: List element ordering affects shape
3. **Consistency**: All other operators have clear RHS Term types
4. **Clear scope**: v0.2+ adds ListTerm + "in" together

**Workaround in v0.1:**
```
// Instead of: status in ["active", "pending"]
// Use: status = "active" OR status = "pending"
// But OR is also deferred... so decompose to separate intents
```

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Use ValueTerm.raw as array | Shape semantics undefined; canonicalization unclear |
| Add ListTerm now | Cascading complexity; not needed for core v0.1 |
| String-encoded list | Parsing required; defeats type safety |

#### Consequences

| Enables | Constrains |
|---------|------------|
| Clean operator semantics | Can't express membership in v0.1 |
| All operators fully typed | Must decompose membership checks |
| Clear v0.2+ scope | ListTerm + "in" + canonicalization rules |

---

### FDR-INT-008: OBSERVE TARGET Semantics Delegated to Lexicon

#### Decision

For `OBSERVE` class events (LIST, GET, SHOW), the interpretation of TARGET role is **delegated to Lexicon**, not hardcoded in IR.

#### Context

When a user says "Show me active users", what does TARGET represent?
- The collection (User type)?
- A filter (active users)?
- Both?

Different lemmas may interpret TARGET differently:
- `LIST User` → all users of type
- `GET User` → specific user (requires id)
- `SHOW User` → depends on context

#### Rationale

**Delegation to Lexicon provides:**

1. **Flexibility**: Each lemma defines its own θ-frame
2. **No hardcoded semantics**: IR stays neutral
3. **Extensibility**: New lemmas can have different interpretations
4. **Validation at right layer**: Feature checking enforces lemma-specific rules

**Hardcoding would mean:**
- IR spec must enumerate all lemma interpretations
- Adding new lemmas requires IR spec change
- Reduces Lexicon's authority

#### Example

```typescript
// Lexicon entry for LIST
{
  lemma: "LIST",
  class: "OBSERVE",
  thetaFrame: {
    required: [],  // No required roles!
    optional: ["TARGET"],
    restrictions: {
      TARGET: { 
        termKinds: ["entity"],
        note: "entityType alone = collection; ref narrows scope"
      }
    }
  }
}

// Lexicon entry for GET
{
  lemma: "GET",
  class: "OBSERVE",
  thetaFrame: {
    required: ["TARGET"],  // TARGET required
    optional: [],
    restrictions: {
      TARGET: { 
        termKinds: ["entity"],
        requiresRef: true  // Must have specific ref
      }
    }
  }
}
```

#### Consequences

| Enables | Constrains |
|---------|------------|
| Lemma-specific interpretation | Lexicon must define for each lemma |
| IR stays neutral | Consumers must check Lexicon, not assume |
| Easy to add new lemmas | Documentation burden on Lexicon authors |

---

## Contract and Validation Decisions

### FDR-INT-009: JSON Schema Normative, Zod Informative

#### Decision

**JSON Schema** is the **normative** contract for Intent IR validation. **Zod schemas** are **informative** (reference implementation for TypeScript/JavaScript).

#### Context

Intent IR needs validation at multiple levels:
- Structure validation (are required fields present?)
- Type validation (is `force` one of the enum values?)
- Cross-field validation (if ref.kind="id", is id present?)

Two schema technologies are common:
- **JSON Schema**: Language-agnostic, widely supported
- **Zod**: TypeScript-native, excellent DX

#### Rationale

**JSON Schema as normative because:**

1. **Language independence**: Intent IR should be implementable in any language
2. **Tooling ecosystem**: ajv, quicktype, many validators
3. **Standard**: JSON Schema is an IETF standard
4. **No runtime dependency**: Validation is separate from schema definition

**Zod as informative because:**
- Excellent for TypeScript implementations
- Type inference via `z.infer<>`
- Convenient refinements
- But: TypeScript-specific

**Making Zod normative would:**
- Tie spec to TypeScript ecosystem
- Contradict "language independence" goal
- Create confusion for non-TS implementations

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Zod normative | Language-specific; violates independence goal |
| Both normative | Sync burden; potential conflicts |
| Neither (prose only) | Unenforceable; implementation drift |

#### Consequences

| Enables | Constrains |
|---------|------------|
| Language-independent validation | Must maintain JSON Schema |
| Any implementation can validate | Zod is optional for TS impls |
| Clear normative source | JSON Schema and Zod must stay in sync (informatively) |

---

### FDR-INT-010: Lexicon-Based Feature Checking

#### Decision

Intent IR validity is determined by **Lexicon-based feature checking**, not just structural validation.

```
Validation Layers:
1. Structural (JSON Schema)  → "Is it well-formed IR?"
2. Feature Checking (Lexicon) → "Is it valid for this domain?"
```

#### Context

A structurally valid IR may still be semantically invalid:
- `{ lemma: "CANCEL", args: {} }` — missing required TARGET
- `{ lemma: "SOLVE", args: { TARGET: entityRef } }` — SOLVE expects THEME (expression), not TARGET

These checks require **domain knowledge** (Lexicon), not just structure.

#### Rationale

**Lexicon-based checking provides:**

1. **Domain-specific validation**: Each domain has different rules
2. **Separation of concerns**: IR spec defines structure; Lexicon defines semantics
3. **Extensibility**: New domains just add Lexicon entries
4. **Principled errors**: "Missing role X for lemma Y" is actionable

**Feature checking rules:**
- Required roles must be present
- Term kinds must match selectional restrictions
- Entity types must be valid for the role
- Policy hints trigger appropriate verification modes

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| All validation in IR spec | Can't cover domain-specific rules |
| No semantic validation | Invalid IRs would reach downstream |
| Validation in consumers | Duplicated logic; inconsistent |

#### Consequences

| Enables | Constrains |
|---------|------------|
| Domain-specific validity | Requires Lexicon for each domain |
| Actionable error messages | Lexicon must define θ-frames |
| Extensible validation | Consumers must have Lexicon access |

---

## Versioning Decisions

### FDR-INT-011: Enum Extension is BREAKING

#### Decision

Adding a new enum value (e.g., new Force, new EventClass) is a **BREAKING** change that requires major or minor version bump.

#### Context

Spec versioning must define what changes are backward-compatible. For enums:
- **Option A**: Adding enum value is backward-compatible (optimistic)
- **Option B**: Adding enum value is BREAKING (strict)

#### Rationale

**Enum addition is BREAKING because:**

1. **Exhaustive matching**: Consumers implementing `switch(force)` will have unhandled case
2. **Strict validation**: Validators rejecting unknown values will fail
3. **AD-INT-002 alignment**: "Functional heads are enumerated" implies stability
4. **Extension path exists**: Use `ext` field for domain-specific extensions

**If we said "backward-compatible":**
- Consumers would need catch-all handlers (defeats exhaustive matching benefit)
- Validators would need "unknown value tolerance" (weakens validation)
- Contradicts the "closed enum" design principle

#### Consequences

| Enables | Constrains |
|---------|------------|
| Exhaustive pattern matching is safe | Adding enum values requires version bump |
| Strict validation is valid | Extension must use `ext` field |
| Clear version semantics | Enum changes are infrequent |

---

### FDR-INT-012: Wire Version vs Spec Version Separation

#### Decision

Intent IR has two version identifiers:

| Version Type | Format | Location | Purpose |
|--------------|--------|----------|---------|
| **Wire version** | `"MAJOR.MINOR"` | `v` field in IR | Runtime compatibility |
| **Spec version** | `"MAJOR.MINOR.PATCH"` | Document header | Document revision |

```json
// In IR (wire version)
{ "v": "0.1", "force": "DO", ... }

// In document (spec version)
// Intent IR Specification v0.1.0
```

#### Context

Spec documents may be updated for:
- Typo fixes
- Clarifications
- Non-normative additions

These don't affect wire compatibility. Conflating versions causes:
- Unnecessary concern ("v0.1.0 → v0.1.1, do I need to update?")
- Version churn in IR data
- Confusion about what actually changed

#### Rationale

**Separation provides:**

1. **Clear compatibility signal**: Wire version changes = check compatibility
2. **Document flexibility**: Patch versions for clarifications
3. **Stable IR data**: IR `v` field doesn't change for doc fixes
4. **Standard practice**: Many specs separate wire/doc versions

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Single version for both | Typo fixes bump IR version unnecessarily |
| No wire version in IR | Can't detect version mismatch at runtime |
| Full semver in IR | Overkill; patch irrelevant for compatibility |

#### Consequences

| Enables | Constrains |
|---------|------------|
| Stable wire version | Must maintain two version numbers |
| Flexible spec updates | Must document which changes are which |
| Clear compatibility | Consumers check wire version, not spec version |

---

## Canonicalization Decisions

### FDR-INT-CAN-001: Structural Normalization Only

**Decision**: Canonicalization removes representational non-determinism only. It does NOT perform semantic interpretation.

| In Scope | Out of Scope |
|----------|--------------|
| Key ordering, empty field removal | Lemma synonyms (`REMOVE` → `DELETE`) |
| Case normalization, predicate sorting | Expression equivalence (`x^2` vs `x*x`) |

**Why**: Parser handles semantic interpretation. Lexicon handles domain-specific normalization. Narrow scope ensures determinism and cross-implementation consistency.

---

### FDR-INT-CAN-002: ValueTerm.raw Excluded

**Decision**: `ValueTerm.raw` is removed from canonical form. Only `shape` participates in equivalence.

```
{ raw: 42, shape: { range: "1-100" } }
{ raw: "42", shape: { range: "1-100" } }
→ Both canonicalize to: { shape: { range: "1-100" } }
```

**Why**: `raw` is execution convenience. `shape` is semantic identity. Including `raw` would break equivalence for identical meanings.

---

### FDR-INT-CAN-003: ROLE_ORDER for Display Only

**Decision**: ROLE_ORDER (`TARGET → THEME → ... → BENEFICIARY`) is for **display/pretty-print only**. Canonical serialization uses RFC 8785 lexicographic order for all keys including `args`.

**Why**:
- Pure RFC 8785 compliance ensures cross-implementation byte equality
- Custom exceptions (even one) risk implementation divergence
- Display ordering can be applied at presentation layer

**Change from draft**: Earlier versions proposed `args` as ROLE_ORDER exception. This was removed to maintain strict JCS compliance.

---

### FDR-INT-CAN-004: Predicate Sorting

**Decision**: `cond` predicates are sorted by `(lhs, op, rhs.kind, rhs)` tuple.

**Why**: AND conditions have no semantic order (A ∧ B ≡ B ∧ A). Sorting ensures permutation invariance.

---

### FDR-INT-CAN-005: Empty Fields Removed

**Decision**: Empty optional fields (`{}`, `[]`) are removed.

**Why**: `{ ext: {} }` and `{}` are semantically equivalent but byte-different. Single representation ensures determinism.

---

### FDR-INT-CAN-006: Pure RFC 8785 Serialization

**Decision**: Canonical JSON follows RFC 8785 (JCS) **without exceptions**. All object keys (including `args`) use lexicographic order.

**Why**: Standard algorithm for cross-implementation byte equality. No custom exceptions means no implementation divergence risk.

---

## Summary Table

| FDR | Decision | Impact |
|-----|----------|--------|
| FAD-INT-001 | Intent IR is LF, not surface form | Foundational |
| FDR-INT-001 | Chomskyan LF as semantic foundation | Theoretical basis |
| FDR-INT-002 | Functional heads are enumerated | Bounded semantics |
| FDR-INT-003 | AND-only conditions in v0.1 | Simple canonicalization |
| FDR-INT-004 | Term is discriminated union | Type safety |
| FDR-INT-005 | Shape over raw for ValueTerm | Canonicalization |
| FDR-INT-006 | Single Term per Role in v0.1 | Simplicity |
| FDR-INT-007 | "in" operator deferred | Clean typing |
| FDR-INT-008 | OBSERVE TARGET to Lexicon | Flexibility |
| FDR-INT-009 | JSON Schema normative | Language independence |
| FDR-INT-010 | Lexicon-based feature checking | Domain validation |
| FDR-INT-011 | Enum extension is BREAKING | Stability |
| FDR-INT-012 | Wire vs Spec version | Version clarity |
| FDR-INT-CAN-001 | Structural normalization only | Scope definition |
| FDR-INT-CAN-002 | ValueTerm.raw excluded | Semantic identity |
| FDR-INT-CAN-003 | ROLE_ORDER for display only | RFC 8785 compliance |
| FDR-INT-CAN-004 | Predicate sorting | Permutation invariance |
| FDR-INT-CAN-005 | Empty fields removed | Minimal form |
| FDR-INT-CAN-006 | Pure RFC 8785 serialization | Interoperability |

---

## Cross-Reference: Related FDRs

| Related FDR | Package | Relationship |
|-------------|---------|--------------|
| FDR-T001 | Translator | Frontend outputs IR, not MEL text |
| FDR-MEL-012 | Compiler | AI-Native design driver (shared) |
| FDR-MEL-039 | Compiler | IR specification (MEL canonical) |
| FDR-MEL-040 | Compiler | Call-only IR (Intent IR lowers to this) |

---

## Appendix: Design Principles Summary

```
Intent IR Constitution (from FAD-INT-001):

1. Structure is meaning.
   Not strings, not tokens—structured heads and arguments.

2. Lexicon is the arbiter.
   Validity is determined by feature checking against Lexicon.

3. Same meaning, same form.
   Canonicalization ensures semantic equivalence = structural equivalence.

4. IR is intent, not plan.
   Execution strategy is downstream concern.

5. Functional heads are finite.
   Fixed set of heads bounds the semantic space.

6. Terms are typed.
   Every argument slot has selectional restrictions.

7. Extension is namespaced.
   Future additions MUST NOT break existing structure.
```

---

*End of Manifesto Intent IR FDR v0.1.0*
