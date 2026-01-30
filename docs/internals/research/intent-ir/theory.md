# Theoretical Foundations

> **Full Document:** [packages/intent-ir/docs/research/THEORY.md](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/research/THEORY.md)

This page summarizes the theoretical foundations of Intent IR. For complete details, proofs, and citations, see the full document.

## Core Thesis

> **Intent IR Thesis:** Natural language intents, across all human languages, share a universal semantic structure expressible through functional projections and thematic relations.

This thesis derives from Chomsky's **Universal Grammar (UG)** hypothesis and the **Minimalist Program**.

## Chomskyan Foundations

### The Y-Model

Intent IR operates at the **Logical Form (LF)** level of the Chomskyan Y-model:

```
                    LEXICON
                       │
                       ▼
                  Computation
                  (Narrow Syntax)
                    /     \
                   /       \
                  ▼         ▼
                PF           LF
         (Phonetic Form)  (Logical Form)
              │               │
              ▼               ▼
       Sensorimotor    Conceptual-Intentional
          Systems           Systems
```

**Key insight:** Multiple surface forms (PF) can map to the same semantic content (LF).

### LF as Semantic Interface

Following Heim & Kratzer (1998):
- Semantic interpretation operates on LF structures
- Compositionality: meaning is computed from parts and their combination
- Covert operations: LF may contain unpronounced elements

## Functional Projection Hierarchy

Intent IR adopts the **Cartographic approach** (Rizzi, 1997; Cinque, 1999):

| Projection | Function | Theoretical Source |
|------------|----------|-------------------|
| **ForceP** | Illocutionary type | Rizzi (1997) |
| **ModP** | Deontic modality | Kratzer (1991) |
| **TP** | Temporal specification | Reichenbach (1947) |
| **vP** | Event type (aktionsart) | Vendler (1967) |
| **VP** | Argument structure | Fillmore (1968) |

### Force

Force encodes **clause type** (interrogative, imperative, declarative):

| Force | Linguistic Category | Evidence |
|-------|---------------------|----------|
| `ASK` | Interrogative | Wh-movement, question particles |
| `DO` | Imperative | Imperative morphology |
| `VERIFY` | Declarative (epistemic) | Evidential markers |
| `CONFIRM` | Confirmative | Tag questions |
| `CLARIFY` | Meta-linguistic | Echo questions |

### Modality

Deontic modality (Kratzer, 1991) expresses obligation and permission:

| Mod | Modal Force |
|-----|-------------|
| `MUST` | Necessity |
| `SHOULD` | Weak necessity |
| `MAY` | Possibility |
| `FORBID` | Impossibility |

## Theta Theory

### θ-Criterion

> Each argument bears one and only one θ-role, and each θ-role is assigned to one and only one argument.

This bijective mapping is enforced by Intent IR's discriminated union structure.

### Universal θ-Roles

Intent IR uses roles from Dowty (1991) and Jackendoff (1990):

| Role | Definition | Source |
|------|------------|--------|
| `TARGET` | Entity undergoing change | Patient/Theme |
| `THEME` | Content/subject matter | Theme |
| `SOURCE` | Origin of motion/transfer | Source |
| `DEST` | Goal of motion/transfer | Goal |
| `INSTRUMENT` | Means of action | Instrument |
| `BENEFICIARY` | Entity benefiting | Benefactive |

## Speech Act Theory

Intent IR integrates Austin (1962) and Searle (1969):

| IR Component | Speech Act Component |
|--------------|---------------------|
| `event` + `args` | Propositional content |
| `cond` | Preparatory conditions |
| `mod` | Sincerity (deontic stance) |
| `force` | Essential condition |

## Cross-Linguistic Validity

Intent IR's universality claim rests on evidence that:
- All languages distinguish clause types
- Modal distinctions are universal (though expressed differently)
- θ-role inventories are consistent cross-linguistically

**Example:** Korean and English map to identical IR:

```
Korean: "주문 취소해줘"
English: "Cancel my order"

Both → { force: DO, event: { lemma: CANCEL }, args: { TARGET: Order } }
```

## Further Reading

- **[Full Theory Document](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/research/THEORY.md)** - Complete theoretical exposition
- **[SPEC §1.4](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/SPEC-v0.2.0.md#14-theoretical-foundation)** - Normative theoretical foundation
- **[FDR-INT-001](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/FDR-v0.1.0.md#fdr-int-001-chomskyan-lf-as-semantic-foundation)** - Design rationale
