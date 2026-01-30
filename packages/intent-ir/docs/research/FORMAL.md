# Formal Definitions and Proofs

> **Status:** Research Document
> **Version:** 0.1.0
> **Audience:** Formal methods researchers, type theorists, verification engineers
> **Normative Authority:** This document is INFORMATIVE. For normative specifications, see [SPEC-v0.2.0](../SPEC-v0.2.0.md).
> **References:** See [BIBLIOGRAPHY.bib](./BIBLIOGRAPHY.bib)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Type System](#2-type-system)
3. [Normalization Equivalence](#3-normalization-equivalence)
4. [Feature Checking](#4-feature-checking)
5. [Reference Resolution](#5-reference-resolution)
6. [Key Derivation](#6-key-derivation)
7. [Correctness Properties](#7-correctness-properties)

---

## 1. Introduction

This document provides formal definitions and proofs for the key properties of Intent IR. We use standard mathematical notation and type-theoretic conventions.

### 1.1 Notation

| Symbol | Meaning |
|--------|---------|
| `:` | Type annotation (e.g., `x : T` means x has type T) |
| `→` | Function type |
| `×` | Product type |
| `+` | Sum type (disjoint union) |
| `∀` | Universal quantification |
| `∃` | Existential quantification |
| `⊢` | Entailment/derivability |
| `≡` | Definitional equality |
| `≈` | Semantic equivalence |
| `⟦·⟧` | Semantic interpretation |
| `𝒞(·)` | Canonicalization function |
| `ℒ` | Lexicon |
| `Σ` | Snapshot |

### 1.2 Preliminaries

We assume familiarity with:
- Basic type theory [Pierce, 2002]
- Algebraic data types
- Fixed-point semantics
- Hash functions and collision resistance

---

## 2. Type System

### 2.1 Core Types

We define Intent IR types as algebraic data types:

**Definition 2.1 (Force):**
```
Force ::= ASK | DO | VERIFY | CONFIRM | CLARIFY
```

**Definition 2.2 (EventClass):**
```
EventClass ::= OBSERVE | TRANSFORM | SOLVE | CREATE | DECIDE | CONTROL
```

**Definition 2.3 (Role):**
```
Role ::= TARGET | THEME | SOURCE | DEST | INSTRUMENT | BENEFICIARY
```

**Definition 2.4 (Modality):**
```
Modality ::= MUST | SHOULD | MAY | FORBID
```

**Definition 2.5 (TimeKind):**
```
TimeKind ::= NOW | AT | BEFORE | AFTER | WITHIN
```

**Definition 2.6 (Term):**
```
Term ::= EntityRefTerm
       | PathRefTerm
       | ArtifactRefTerm
       | ValueTerm
       | ExprTerm

EntityRefTerm ::= ⟨entity, entityType: String, ref: EntityRef?⟩
EntityRef ::= ⟨kind: this | that | last | id, id: String?⟩

PathRefTerm ::= ⟨path, path: String⟩

ArtifactRefTerm ::= ⟨artifact, artifactType: ArtifactType, ref: ArtifactRef, content: String?⟩
ArtifactType ::= text | math | code | data | plan | mixed
ArtifactRef ::= ⟨kind: inline | id, id: String?⟩

ValueTerm ::= ⟨value, valueType: ValueType, shape: Map String Any, raw: Any?⟩
ValueType ::= string | number | boolean | date | enum | id

ExprTerm ::= ⟨expr, exprType: ExprType, expr: String | Object⟩
ExprType ::= latex | ast | code
```

**Definition 2.7 (Pred):**
```
Pred ::= ⟨lhs: ScopedPath, op: PredOp, rhs: Term⟩
PredOp ::= = | != | < | > | <= | >= | contains | startsWith | matches
ScopedPath ::= Prefix "." Path
Prefix ::= target | theme | source | dest | state | env | computed
```

**Definition 2.8 (IntentIR):**
```
IntentIR ::= ⟨
  v: "0.1",
  force: Force,
  event: Event,
  args: Map Role Term,
  cond: List Pred,
  mod: Modality?,
  time: TimeSpec?,
  verify: VerifySpec?,
  out: OutputSpec?,
  ext: Map String Any?
⟩

Event ::= ⟨lemma: String, class: EventClass⟩
TimeSpec ::= ⟨kind: TimeKind, value: Any?⟩
VerifySpec ::= ⟨mode: VerifyMode, spec: Map String Any?⟩
OutputSpec ::= ⟨type: OutputType, format: OutputFormat?, constraints: Map String Any?⟩
```

### 2.2 Well-Formedness

**Definition 2.9 (Well-Formed Term):**

A term `t : Term` is well-formed (written `⊢ t wf`) iff:

```
⊢ t : EntityRefTerm wf  ⟺  t.kind = "entity"
                          ∧ t.entityType ≠ ""
                          ∧ (t.ref.kind = "id" ⟹ t.ref.id ≠ undefined)

⊢ t : PathRefTerm wf    ⟺  t.kind = "path" ∧ t.path ≠ ""

⊢ t : ArtifactRefTerm wf ⟺ t.kind = "artifact"
                          ∧ (t.ref.kind = "inline" ⟹ t.content ≠ undefined)
                          ∧ (t.ref.kind = "id" ⟹ t.ref.id ≠ undefined)

⊢ t : ValueTerm wf      ⟺  t.kind = "value" ∧ t.shape ≠ {}

⊢ t : ExprTerm wf       ⟺  t.kind = "expr"
                          ∧ (t.exprType = "ast" ⟹ typeof t.expr = "object")
                          ∧ (t.exprType ∈ {latex, code} ⟹ typeof t.expr = "string")
```

**Definition 2.10 (Well-Formed IntentIR):**

An IntentIR `ir` is well-formed (written `⊢ ir wf`) iff:

```
⊢ ir wf  ⟺  ir.v = "0.1"
           ∧ ir.force ∈ Force
           ∧ ir.event.class ∈ EventClass
           ∧ ir.event.lemma matches /^[A-Z][A-Z0-9_]*$/
           ∧ ∀(role, term) ∈ ir.args. role ∈ Role ∧ ⊢ term wf
           ∧ ∀pred ∈ ir.cond. ⊢ pred wf
```

---

## 3. Normalization Equivalence

### 3.1 Canonicalization Function

**Definition 3.1 (Canonicalization):**

Let `𝒞 : IntentIR → CanonicalIR` be the canonicalization function defined as:

```
𝒞(ir) = serialize(normalize(ir))

normalize(ir) = {
  v: ir.v,
  force: ir.force,
  event: { lemma: upper(trim(ir.event.lemma)), class: ir.event.class },
  args: sortByKey(mapValues(ir.args, normalizeTerm)),
  cond: sort(map(ir.cond, normalizePred)),
  mod: ir.mod if ir.mod ≠ undefined,
  time: ir.time if ir.time ≠ undefined,
  verify: ir.verify if ir.verify ≠ undefined,
  out: ir.out if ir.out ≠ undefined,
  ext: ir.ext if ir.ext ≠ {} ∧ ir.ext ≠ undefined
}

normalizeTerm(t) = match t.kind with
  | "entity" → removeEmptyRef(t)
  | "value" → { ...t, raw: undefined }  // Semantic mode
  | _ → t

normalizePred(p) = ⟨
  lhs: p.lhs,
  op: p.op,
  rhs: normalizeTerm(p.rhs)
⟩

serialize(ir) = JCS(ir)  // RFC 8785 JSON Canonicalization
```

### 3.2 Equivalence Relation

**Definition 3.2 (Semantic Equivalence):**

Two IntentIRs `ir₁` and `ir₂` are semantically equivalent (written `ir₁ ≈ ir₂`) iff:

```
ir₁ ≈ ir₂  ⟺  𝒞(ir₁) = 𝒞(ir₂)
```

where `=` denotes byte-level string equality.

**Theorem 3.1 (Equivalence Relation):**

The relation `≈` is an equivalence relation. That is, for all well-formed IntentIRs `ir₁, ir₂, ir₃`:

1. **Reflexivity:** `ir₁ ≈ ir₁`
2. **Symmetry:** `ir₁ ≈ ir₂ ⟹ ir₂ ≈ ir₁`
3. **Transitivity:** `ir₁ ≈ ir₂ ∧ ir₂ ≈ ir₃ ⟹ ir₁ ≈ ir₃`

**Proof:**

1. **Reflexivity:**
   - By definition, `𝒞(ir₁) = 𝒞(ir₁)` (string equality is reflexive).
   - Therefore, `ir₁ ≈ ir₁`. ∎

2. **Symmetry:**
   - Assume `ir₁ ≈ ir₂`, i.e., `𝒞(ir₁) = 𝒞(ir₂)`.
   - String equality is symmetric, so `𝒞(ir₂) = 𝒞(ir₁)`.
   - Therefore, `ir₂ ≈ ir₁`. ∎

3. **Transitivity:**
   - Assume `ir₁ ≈ ir₂` and `ir₂ ≈ ir₃`.
   - Then `𝒞(ir₁) = 𝒞(ir₂)` and `𝒞(ir₂) = 𝒞(ir₃)`.
   - By transitivity of string equality, `𝒞(ir₁) = 𝒞(ir₃)`.
   - Therefore, `ir₁ ≈ ir₃`. ∎

**Theorem 3.2 (Idempotence):**

The canonicalization function is idempotent:

```
∀ ir. 𝒞(𝒞(ir)) = 𝒞(ir)
```

**Proof:**

Let `ir' = 𝒞(ir)` (as a parsed object from the serialized string).

By construction of `normalize`:
- `ir'.event.lemma` is already uppercase and trimmed
- `ir'.args` keys are already sorted
- `ir'.cond` predicates are already sorted
- Empty optional fields are already removed

Therefore, `normalize(ir') = ir'` (modulo serialization), and `𝒞(ir') = 𝒞(ir)`. ∎

**Theorem 3.3 (Order Invariance for Conditions):**

Condition order does not affect equivalence:

```
∀ ir, π (permutation of ir.cond).
  ir[cond := π(ir.cond)] ≈ ir
```

**Proof:**

Let `ir' = ir[cond := π(ir.cond)]`.

By definition of `normalize`:
```
normalize(ir).cond = sort(map(ir.cond, normalizePred))
normalize(ir').cond = sort(map(π(ir.cond), normalizePred))
```

Since `sort` produces the same output for any permutation of the same set:
```
sort(map(π(ir.cond), normalizePred)) = sort(map(ir.cond, normalizePred))
```

Therefore, `normalize(ir) = normalize(ir')`, and thus `ir ≈ ir'`. ∎

---

## 4. Feature Checking

### 4.1 Lexicon Structure

**Definition 4.1 (Lexicon):**

A Lexicon `ℒ` is a tuple `⟨E, Ent⟩` where:
- `E : Map Lemma EventEntry` maps lemmas to event specifications
- `Ent : Map EntityType EntitySpec` maps entity types to specifications

```
EventEntry ::= ⟨
  eventClass: EventClass,
  thetaFrame: ThetaFrame,
  footprint: Footprint?,
  policyHints: PolicyHints?
⟩

ThetaFrame ::= ⟨
  required: List Role,
  optional: List Role,
  restrictions: Map Role SelectionalRestriction
⟩

SelectionalRestriction ::= ⟨
  termKinds: List TermKind,
  entityTypes: List EntityType?,
  valueTypes: List ValueType?
⟩
```

### 4.2 Typing Judgment

**Definition 4.2 (Feature Checking Judgment):**

The judgment `ℒ ⊢ ir ✓` means IntentIR `ir` is valid with respect to Lexicon `ℒ`.

**Inference Rules:**

```
[IR-VALID]
                ℒ ⊢ ir.event ✓ᴱ    ℒ ⊢ ir.args ✓ᴬ
               ─────────────────────────────────
                         ℒ ⊢ ir ✓

[EVENT-VALID]
               ℒ.E(ir.event.lemma) = entry
               entry.eventClass = ir.event.class
               ─────────────────────────────────
                      ℒ ⊢ ir.event ✓ᴱ

[ARGS-VALID]
               ∀ r ∈ entry.thetaFrame.required. r ∈ dom(ir.args)
               ∀ (r, t) ∈ ir.args. ℒ ⊢ t ✓ᵀ(entry.thetaFrame.restrictions(r))
               ─────────────────────────────────────────────────────────────
                      ℒ ⊢ ir.args ✓ᴬ

[TERM-VALID]
               t.kind ∈ restriction.termKinds
               (t.kind = "entity" ∧ restriction.entityTypes ≠ ∅)
                  ⟹ t.entityType ∈ restriction.entityTypes
               (t.kind = "value" ∧ restriction.valueTypes ≠ ∅)
                  ⟹ t.valueType ∈ restriction.valueTypes
               ────────────────────────────────────────────
                         ℒ ⊢ t ✓ᵀ(restriction)
```

### 4.3 Soundness

**Theorem 4.1 (Decidability):**

Feature checking is decidable: there exists an algorithm that, given `ℒ` and `ir`, terminates and returns either `valid` or `invalid(reason)`.

**Proof:**

The checking algorithm performs:
1. Finite lookup in `ℒ.E` (by lemma)
2. Finite comparison of event class
3. Finite iteration over required roles
4. Finite iteration over args entries
5. Finite membership tests in finite sets

All operations are bounded and terminating. ∎

**Theorem 4.2 (Completeness of Error Messages):**

If `ℒ ⊬ ir ✓`, then the algorithm returns one of:
- `UNKNOWN_LEMMA`: `ir.event.lemma ∉ dom(ℒ.E)`
- `CLASS_MISMATCH`: `entry.eventClass ≠ ir.event.class`
- `MISSING_ROLE(r)`: `r ∈ entry.required ∧ r ∉ dom(ir.args)`
- `TYPE_MISMATCH(r)`: `ℒ ⊬ ir.args(r) ✓ᵀ(restriction)`

**Proof:**

By case analysis on the inference rules. Each rule has a decidable premise whose failure corresponds to exactly one error type. ∎

---

## 5. Reference Resolution

### 5.1 Discourse Model

**Definition 5.1 (Discourse State):**

A discourse state `D` is a triple `⟨focus, history, entities⟩` where:
- `focus : EntityType → EntityId?` maps types to currently focused entity
- `history : List (EntityType × EntityId)` is the sequence of mentioned entities
- `entities : Map EntityId Entity` is the entity store

### 5.2 Resolution Function

**Definition 5.2 (Resolver):**

The resolver `R : Term × Σ × D → ResolvedTerm` maps symbolic references to concrete IDs.

```
R(t, Σ, D) = match t with
  | ⟨entity, type, ref: ⟨this⟩⟩ → ⟨entity, type, ref: ⟨id, D.focus(type)⟩⟩
  | ⟨entity, type, ref: ⟨that⟩⟩ → ⟨entity, type, ref: ⟨id, previous(D, type)⟩⟩
  | ⟨entity, type, ref: ⟨last⟩⟩ → ⟨entity, type, ref: ⟨id, mostRecent(Σ, type)⟩⟩
  | ⟨entity, type, ref: ⟨id, id⟩⟩ → t  // Already resolved
  | ⟨entity, type, ref: undefined⟩ → t  // Collection scope
  | _ → t  // Non-entity terms pass through
```

**Definition 5.3 (Resolved IntentIR):**

An IntentIR is resolved (written `resolved(ir)`) iff:

```
resolved(ir) ⟺ ∀(r, t) ∈ ir.args.
  t.kind = "entity" ⟹ (t.ref = undefined ∨ t.ref.kind = "id")
```

### 5.3 Determinism

**Theorem 5.1 (Resolution Determinism):**

Given fixed `Σ` and `D`, resolution is deterministic:

```
∀ t, Σ, D. R(t, Σ, D) = R(t, Σ, D)
```

**Proof:**

`R` is a pure function with no side effects. Each case in the match produces a unique output determined solely by the inputs. ∎

**Theorem 5.2 (Resolution Completeness):**

If `⊢ ir wf` and all referenced entities exist in `D`, then resolution succeeds:

```
∀ ir, Σ, D. ⊢ ir wf ∧ complete(ir, D) ⟹ ∃ ir'. ir' = resolve(ir, Σ, D) ∧ resolved(ir')
```

where `complete(ir, D)` means all symbolic references in `ir` have corresponding entities in `D`.

---

## 6. Key Derivation

### 6.1 StrictKey

**Definition 6.1 (StrictKey):**

The strictKey derivation function `K_s : ResolvedIR × Footprint × Σ × Context → Hash` is:

```
K_s(ir, fp, Σ, ctx) = SHA256(JCS({
  schemaHash: ctx.schemaHash,
  constitutionFP: ctx.constitutionFingerprint,
  invariantFP: ctx.invariantFingerprint,
  ir: 𝒞_strict(ir),
  subsnapshot: 𝒞(extract(Σ, closure(fp))),
  context: 𝒞({
    env: ctx.env,
    tenant: ctx.tenant,
    permissions: sort(ctx.permissions),
    focusFingerprint: ctx.focusFingerprint,
    discourseFingerprint: ctx.discourseFingerprint
  })
}))

closure(fp) = fp.reads ∪ fp.depends ∪ fp.verify ∪ fp.policy
```

**Theorem 6.1 (StrictKey Uniqueness):**

For cryptographically secure hash function SHA256, the probability of collision is negligible:

```
Pr[K_s(ir₁, ...) = K_s(ir₂, ...) | ir₁ ≠ ir₂] ≤ 2⁻¹²⁸
```

**Proof:**

By the collision resistance property of SHA256 [NIST, 2015]. The probability of finding distinct inputs with the same hash is bounded by the birthday paradox at approximately 2⁻¹²⁸ for a 256-bit hash. ∎

**Theorem 6.2 (StrictKey Reproducibility):**

Same inputs produce the same strictKey:

```
∀ ir, fp, Σ, ctx. K_s(ir, fp, Σ, ctx) = K_s(ir, fp, Σ, ctx)
```

**Proof:**

`K_s` is composed of deterministic functions:
- JCS is deterministic (RFC 8785)
- SHA256 is deterministic
- `𝒞_strict` is deterministic (Theorem 3.2)
- `extract` and `closure` are pure functions ∎

### 6.2 SimKey

**Definition 6.2 (SimKey):**

The simKey derivation function `K_sim : IntentIR → SimHash` is:

```
K_sim(ir) = SimHash(tokenize(𝒞_semantic(ir)))

tokenize(ir) = flatten([
  ir.force,
  ir.event.lemma,
  ir.event.class,
  ...flatMap(ir.args, (r, t) → [r, tokenizeTerm(t)]),
  ...flatMap(ir.cond, tokenizePred)
])

tokenizeTerm(t) = match t.kind with
  | "entity" → [t.entityType]
  | "value" → [t.valueType, ...keys(t.shape)]
  | "expr" → [t.exprType]
  | "path" → [normalize(t.path)]
  | "artifact" → [t.artifactType]
```

**Definition 6.3 (SimHash):**

SimHash [Charikar, 2002] produces a locality-sensitive hash:

```
SimHash(tokens) =
  let V = [0] × 64
  for token in tokens:
    h = hash64(token)
    for i in 0..63:
      if bit(h, i) = 1 then V[i] += 1 else V[i] -= 1
  return bitsToInt([sign(v) for v in V])
```

**Theorem 6.3 (SimKey Collision Probability):**

For semantically similar IRs (Jaccard similarity J), the probability of bit agreement is:

```
Pr[bit_i(K_sim(ir₁)) = bit_i(K_sim(ir₂))] = (1 + J) / 2
```

where Jaccard similarity `J = |T₁ ∩ T₂| / |T₁ ∪ T₂|` for token sets T₁, T₂.

**Proof:**

By the theoretical analysis of SimHash [Charikar, 2002], each bit is an independent estimate of the sign of a random hyperplane projection. The probability of agreement corresponds to the angle between token set vectors, which relates to Jaccard similarity for binary vectors. ∎

---

## 7. Correctness Properties

### 7.1 System Invariants

**Invariant 7.1 (Canonical Preservation):**

Canonicalization preserves semantic content:

```
∀ ir. ⟦ir⟧ = ⟦𝒞(ir)⟧
```

where `⟦·⟧` is the semantic interpretation function.

**Invariant 7.2 (Feature Checking Stability):**

Feature checking is invariant under canonicalization:

```
∀ ir, ℒ. ℒ ⊢ ir ✓ ⟺ ℒ ⊢ 𝒞(ir) ✓
```

**Invariant 7.3 (Key Determinism):**

Key derivation is deterministic:

```
∀ ir₁, ir₂, ctx. ir₁ ≈ ir₂ ⟹ K_s(ir₁, ctx) = K_s(ir₂, ctx)
```

### 7.2 Safety Properties

**Safety 7.1 (No False Equivalence):**

Canonicalization does not identify semantically distinct IRs:

```
∀ ir₁, ir₂. 𝒞(ir₁) = 𝒞(ir₂) ⟹ ⟦ir₁⟧ = ⟦ir₂⟧
```

**Safety 7.2 (Validation Soundness):**

If an IR passes validation, it is well-formed:

```
∀ ir, ℒ. ℒ ⊢ ir ✓ ⟹ ⊢ ir wf
```

### 7.3 Liveness Properties

**Liveness 7.1 (Validation Termination):**

Feature checking always terminates:

```
∀ ir, ℒ. ∃ result. check(ir, ℒ) = result
```

**Liveness 7.2 (Resolution Termination):**

Reference resolution always terminates:

```
∀ ir, Σ, D. ∃ ir'. resolve(ir, Σ, D) = ir'
```

---

## Appendix A: Proof Sketches

### A.1 Proof of Theorem 3.2 (Idempotence)

**Full proof:**

Let `ir` be any well-formed IntentIR. Define `ir₁ = normalize(ir)` and `ir₂ = normalize(ir₁)`.

We show `ir₁ = ir₂` by structural induction:

**Base case (atoms):**
- `ir₁.v = "0.1" = ir₂.v`
- `ir₁.force ∈ Force` is unchanged
- `ir₁.event.lemma = upper(trim(lemma))` is already normalized
- `ir₁.event.class ∈ EventClass` is unchanged

**Inductive case (args):**
- `ir₁.args` has keys sorted
- `sortByKey(ir₁.args) = ir₁.args` (sorting an already-sorted map is identity)

**Inductive case (cond):**
- `ir₁.cond` is already sorted
- `sort(ir₁.cond) = ir₁.cond` (sorting an already-sorted list is identity)

**Optional fields:**
- Empty fields are already removed in `ir₁`
- Removing already-removed fields has no effect

Therefore, `normalize(ir₁) = ir₁`, and `𝒞(𝒞(ir)) = serialize(ir₁) = 𝒞(ir)`. ∎

---

## References

See [BIBLIOGRAPHY.bib](./BIBLIOGRAPHY.bib) for full citations.

Key works:
- [Pierce, 2002] Types and Programming Languages
- [Charikar, 2002] Similarity Estimation Techniques from Rounding Algorithms
- [NIST, 2015] SHA-3 Standard
- [RFC 8785] JSON Canonicalization Scheme (JCS)

---

*End of Formal Definitions Document*
