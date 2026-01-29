# Formal Definitions

> **Full Document:** [packages/intent-ir/docs/research/FORMAL.md](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/research/FORMAL.md)

This page summarizes the formal definitions and proofs for Intent IR. For complete mathematical specifications, see the full document.

## Type System

### Core Types

Intent IR types are defined as algebraic data types:

```
Force ::= ASK | DO | VERIFY | CONFIRM | CLARIFY

EventClass ::= OBSERVE | TRANSFORM | SOLVE | CREATE | DECIDE | CONTROL

Role ::= TARGET | THEME | SOURCE | DEST | INSTRUMENT | BENEFICIARY

Term ::= EntityRefTerm | PathRefTerm | ArtifactRefTerm | ValueTerm | ExprTerm
```

### Well-Formedness

An IntentIR `ir` is well-formed (`⊢ ir wf`) iff:

- `ir.v = "0.1"`
- `ir.force ∈ Force`
- `ir.event.class ∈ EventClass`
- `ir.event.lemma` matches `/^[A-Z][A-Z0-9_]*$/`
- All terms in `ir.args` are well-formed
- All predicates in `ir.cond` are well-formed

## Normalization Equivalence

### Canonicalization Function

```
𝒞(ir) = serialize(normalize(ir))
```

where `serialize` uses RFC 8785 JSON Canonicalization (JCS).

### Equivalence Relation

Two IntentIRs are semantically equivalent (`ir₁ ≈ ir₂`) iff:

```
𝒞(ir₁) = 𝒞(ir₂)  (byte-level equality)
```

### Key Properties

| Property | Statement |
|----------|-----------|
| **Reflexivity** | `ir ≈ ir` |
| **Symmetry** | `ir₁ ≈ ir₂ ⟹ ir₂ ≈ ir₁` |
| **Transitivity** | `ir₁ ≈ ir₂ ∧ ir₂ ≈ ir₃ ⟹ ir₁ ≈ ir₃` |
| **Idempotence** | `𝒞(𝒞(ir)) = 𝒞(ir)` |
| **Order Invariance** | Condition permutations produce equivalent IRs |

## Feature Checking

### Typing Judgment

The judgment `ℒ ⊢ ir ✓` means IntentIR `ir` is valid with respect to Lexicon `ℒ`.

### Inference Rules

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
    ∀ r ∈ entry.required. r ∈ dom(ir.args)
    ∀ (r, t) ∈ ir.args. ℒ ⊢ t ✓ᵀ(restriction)
   ─────────────────────────────────────────
              ℒ ⊢ ir.args ✓ᴬ
```

### Properties

| Property | Statement |
|----------|-----------|
| **Decidability** | Feature checking always terminates |
| **Error Completeness** | All failures map to specific error codes |

## Reference Resolution

### Resolver Function

```
R(t, Σ, D) = match t.ref.kind with
  | "this" → resolve from focus
  | "that" → resolve from history
  | "last" → resolve from snapshot
  | "id"   → pass through
  | undefined → collection scope
```

### Properties

| Property | Statement |
|----------|-----------|
| **Determinism** | Same inputs → same output |
| **Completeness** | If references exist, resolution succeeds |

## Key Derivation

### StrictKey

```
K_s(ir, fp, Σ, ctx) = SHA256(JCS({
  schemaHash, constitutionFP, invariantFP,
  ir: 𝒞_strict(ir),
  subsnapshot: 𝒞(extract(Σ, closure(fp))),
  context: 𝒞({ env, tenant, permissions, ... })
}))
```

**Properties:**
- Collision probability: ≤ 2⁻¹²⁸
- Reproducibility: same inputs → same key

### SimKey

```
K_sim(ir) = SimHash(tokenize(𝒞_semantic(ir)))
```

**Properties:**
- Locality-sensitive: similar IRs have similar keys
- Bit agreement probability: (1 + J) / 2 for Jaccard similarity J

## Correctness Properties

### Invariants

| Invariant | Statement |
|-----------|-----------|
| Canonical Preservation | `⟦ir⟧ = ⟦𝒞(ir)⟧` |
| Feature Checking Stability | `ℒ ⊢ ir ✓ ⟺ ℒ ⊢ 𝒞(ir) ✓` |
| Key Determinism | `ir₁ ≈ ir₂ ⟹ K_s(ir₁) = K_s(ir₂)` |

### Safety Properties

| Property | Statement |
|----------|-----------|
| No False Equivalence | `𝒞(ir₁) = 𝒞(ir₂) ⟹ ⟦ir₁⟧ = ⟦ir₂⟧` |
| Validation Soundness | `ℒ ⊢ ir ✓ ⟹ ⊢ ir wf` |

### Liveness Properties

| Property | Statement |
|----------|-----------|
| Validation Termination | Feature checking always terminates |
| Resolution Termination | Reference resolution always terminates |

## Further Reading

- **[Full Formal Document](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/research/FORMAL.md)** - Complete proofs and definitions
- **[SPEC §11](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/SPEC-v0.1.0.md#11-canonicalization-rules)** - Normative canonicalization rules
- **[SPEC §12](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/SPEC-v0.1.0.md#12-key-system)** - Normative key system
