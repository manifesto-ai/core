# Comparative Analysis

> **Full Document:** [packages/intent-ir/docs/research/COMPARISON.md](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/research/COMPARISON.md)

This page summarizes how Intent IR compares to established semantic representation formalisms.

## Overview

Intent IR is not the first meaning representation for natural language. This analysis compares it with:

- **AMR** - Abstract Meaning Representation
- **FrameNet** - Frame-based semantic annotation
- **PropBank** - Predicate-argument structure
- **UCCA** - Universal Conceptual Cognitive Annotation
- **UD** - Universal Dependencies

## Comparison Matrix

| Feature | AMR | FrameNet | PropBank | UCCA | UD | Intent IR |
|---------|-----|----------|----------|------|-----|-----------|
| **Language Independent** | Partial | No | Partial | Yes | Yes | **Yes** |
| **Canonicalizable** | Approx. | No | No | No | N/A | **Exact** |
| **Closed Role Vocabulary** | No | No | Numbered | Yes | Yes | **Yes** |
| **Force Representation** | No | Partial | No | No | No | **Yes** |
| **Modality Representation** | Partial | No | Partial | No | No | **Yes** |
| **Schema Verifiable** | No | No | No | No | Yes | **Yes** |

## AMR Comparison

**Structure:** AMR uses rooted DAGs; Intent IR uses hierarchical projections.

**Roles:** AMR uses PropBank-derived ARG0-5; Intent IR uses semantic θ-roles.

**Canonicalization:** AMR uses Smatch (approximate); Intent IR uses JCS (exact bytes).

**Force:** AMR does not represent illocutionary force; Intent IR does.

| Use Case | Better Choice |
|----------|---------------|
| Broad semantic parsing | AMR |
| Intent understanding | Intent IR |
| Cross-lingual transfer | Intent IR |
| Caching/retrieval | Intent IR |

## FrameNet Comparison

**Role Granularity:** FrameNet has 1000+ frame-specific FEs; Intent IR has 6 universal roles.

**Extensibility:** FrameNet grows by adding frames; Intent IR extends via `ext` field.

**Example Mapping:**

| FrameNet FE | Intent IR Role |
|-------------|----------------|
| Agent-like FEs | (implicit in lemma) |
| Patient-like FEs | TARGET |
| Content-like FEs | THEME |
| Source-like FEs | SOURCE |
| Goal-like FEs | DEST |

## PropBank Comparison

**Role Semantics:** PropBank's numbered roles are predicate-specific; Intent IR's are universal.

**Modifier Treatment:** PropBank uses ArgM-* adjuncts; Intent IR uses dedicated projections.

**Example:**
```
PropBank Arg1 of "cancel" = "thing cancelled"
PropBank Arg1 of "give" = "thing given"
Intent IR TARGET = "entity directly affected" (universal)
```

## UCCA Comparison

**Foundation:** UCCA is cognitive/typological; Intent IR is generative/Chomskyan.

**Primary Unit:** UCCA uses scenes; Intent IR uses intents (single speech acts).

## UD Comparison

**Level:** UD is syntactic; Intent IR is semantic.

**Surface Variation:** UD preserves word order; Intent IR abstracts it.

**Example:**
```
Active: "The user cancelled the order."
Passive: "The order was cancelled by the user."

UD: Different dependency structures
Intent IR: Identical representation
```

## Application Suitability

| Application | Best Formalism |
|-------------|----------------|
| Machine translation | AMR, UD |
| Question answering | AMR, UCCA |
| **Dialogue systems** | **Intent IR** |
| **Task-oriented agents** | **Intent IR** |
| **Semantic search** | **Intent IR** |
| Linguistic annotation | UD, UCCA |

## Trade-offs

Intent IR's design involves explicit trade-offs:

| Gained | Lost |
|--------|------|
| Canonical equivalence | Fine-grained role distinctions |
| Force/modality representation | Broad semantic coverage |
| Domain verifiability | Zero-shot generalization |
| Language independence | Easy adoption of existing resources |

## Further Reading

- **[Full Comparison Document](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/research/COMPARISON.md)** - Complete comparative analysis
- **[SPEC §1.2](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/SPEC-v0.2.0.md#12-what-intent-ir-is-not)** - Scope definition
