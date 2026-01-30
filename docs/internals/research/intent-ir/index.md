# Intent IR Research

This section provides academic-depth documentation for the Intent IR (Intermediate Representation) package, targeting computational linguists, NLP researchers, and formal semanticists.

## Overview

Intent IR is a **Chomskyan LF-based semantic representation** for natural language intent. It provides:

- A **deterministic and verifiable** logical form derived from natural language
- **Language-independent** meaning representation
- **Lexicon-based feature checking** for domain validation
- **Canonicalizable** structure for semantic retrieval and caching

```
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│  Natural Language (PF)  ─────►  Intent IR (LF)  ─────►  IntentBody │
│  "주문 취소해"                    Semantic Structure    (Protocol)  │
│  "Cancel my order"               (language-independent)           │
│  "取消订单"                                                         │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Research Documents

### [Theoretical Foundations](./theory)

Explores the linguistic theory underlying Intent IR:

- **Chomskyan Minimalism** - Y-model, LF as semantic interface
- **Functional Projections** - Force, Modality, Tense, Event structures
- **θ-Theory** - Thematic roles and argument structure
- **Feature Checking** - Agree operation and selectional restrictions
- **Speech Act Theory** - Austin/Searle integration

### [Comparative Analysis](./comparison)

Systematic comparison with established semantic formalisms:

- **AMR** - Graph vs. projection structure
- **FrameNet** - Frame-specific FEs vs. universal θ-roles
- **PropBank** - Numbered arguments vs. semantic roles
- **UCCA** - Cognitive scenes vs. intents
- **Universal Dependencies** - Syntactic vs. semantic representation

### [Formal Definitions](./formal)

Mathematical specifications and proofs:

- **Type System** - Algebraic data type definitions
- **Normalization** - Equivalence relation properties
- **Feature Checking** - Typing judgments and soundness
- **Reference Resolution** - Determinism proofs
- **Key Derivation** - Uniqueness and collision analysis

## Quick Reference

| Topic | Document | Key Sections |
|-------|----------|--------------|
| Why Chomsky? | [Theory](./theory) | §2 Chomskyan Foundations |
| How does canonicalization work? | [Formal](./formal) | §3 Normalization Equivalence |
| How does Intent IR compare to AMR? | [Comparison](./comparison) | §2 Abstract Meaning Representation |
| What are the formal guarantees? | [Formal](./formal) | §7 Correctness Properties |
| Where do θ-roles come from? | [Theory](./theory) | §4 Theta Theory |

## Relationship to SPEC/FDR

These research documents are **INFORMATIVE** and supplement the normative specifications:

- **[SPEC-v0.2.0](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/SPEC-v0.2.0.md)** - Normative specification
- **[FDR-v0.1.0](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/FDR-v0.1.0.md)** - Design rationale

When conflicts exist, SPEC takes precedence over research documents.

## Bibliography

All research documents share a common bibliography:

- **[BIBLIOGRAPHY.bib](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/research/BIBLIOGRAPHY.bib)** - BibTeX references

Key citations include:
- Chomsky (1995) *The Minimalist Program*
- Rizzi (1997) *The Fine Structure of the Left Periphery*
- Banarescu et al. (2013) *Abstract Meaning Representation*
- Austin (1962) *How to Do Things with Words*
