# Comparative Analysis: Intent IR and Related Formalisms

> **Status:** Research Document
> **Version:** 0.1.0
> **Audience:** NLP researchers, computational linguists, semantic web practitioners
> **Normative Authority:** This document is INFORMATIVE. For normative specifications, see [SPEC-v0.1.0](../SPEC-v0.1.0.md).
> **References:** See [BIBLIOGRAPHY.bib](./BIBLIOGRAPHY.bib)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Abstract Meaning Representation (AMR)](#2-abstract-meaning-representation-amr)
3. [FrameNet](#3-framenet)
4. [PropBank](#4-propbank)
5. [Universal Conceptual Cognitive Annotation (UCCA)](#5-universal-conceptual-cognitive-annotation-ucca)
6. [Universal Dependencies (UD)](#6-universal-dependencies-ud)
7. [Comparative Matrix](#7-comparative-matrix)
8. [Design Implications](#8-design-implications)
9. [Future Directions](#9-future-directions)

---

## 1. Introduction

Intent IR is not the first attempt at meaning representation for natural language. This document provides a systematic comparison with established formalisms, analyzing the theoretical and practical trade-offs that motivated Intent IR's design.

### 1.1 Comparison Criteria

We evaluate each formalism along these dimensions:

| Criterion | Description |
|-----------|-------------|
| **Language Independence** | Can the same representation express equivalent meanings across languages? |
| **Canonicalizability** | Does semantic equivalence imply structural equivalence? |
| **Closed Vocabulary** | Is the set of relational/role labels bounded? |
| **Force/Modality** | Does the formalism represent illocutionary force and modal semantics? |
| **Verifiability** | Can validity be checked against a domain schema? |
| **Computational Tractability** | Is parsing, comparison, and canonicalization efficient? |

### 1.2 Scope

This comparison focuses on formalisms used for:
- Semantic parsing
- Meaning representation
- Intent understanding

We do not compare against:
- Knowledge representation languages (OWL, RDF)
- Formal logic systems (first-order logic, DRT)
- Programming language semantics

---

## 2. Abstract Meaning Representation (AMR)

### 2.1 Overview

AMR [Banarescu et al., 2013] is a broad-coverage semantic representation that encodes sentence meaning as a **rooted, directed, acyclic graph**.

```
# AMR for "The boy wants the girl to believe him."
(w / want-01
   :ARG0 (b / boy)
   :ARG1 (b2 / believe-01
            :ARG0 (g / girl)
            :ARG1 b))
```

### 2.2 Comparison with Intent IR

| Dimension | AMR | Intent IR | Analysis |
|-----------|-----|-----------|----------|
| **Structure** | Rooted DAG | Hierarchical projections | AMR's graph structure allows reentrancy; Intent IR uses trees with explicit reference |
| **Roles** | PropBank-derived (ARG0-5) | Universal θ-roles | Intent IR uses semantically meaningful role names |
| **Canonicalization** | Smatch metric (approximate) | RFC 8785 JCS (exact) | Intent IR achieves byte-level canonical equivalence |
| **Force** | Not represented | Explicit Force head | Intent IR captures illocutionary type |
| **Modality** | Concept-based (:mode obligatory) | Dedicated ModP | Intent IR treats modality as structural |
| **Language** | English-centric predicates | Language-independent lemmas | Intent IR abstracts over surface predicates |

### 2.3 Key Differences

**Graph vs. Projection:**
AMR's graph structure represents coreference through variable binding (e.g., `b` appearing multiple times). Intent IR uses explicit reference terms (`ref: { kind: "this" }`) that are resolved by a separate component.

**Predicate Inventory:**
AMR uses English predicate senses (e.g., `want-01`, `believe-01`). Intent IR uses domain-defined lemmas that are language-independent.

**Canonicalization:**
AMR comparison uses the Smatch metric [Cai & Knight, 2013], which computes approximate graph overlap. Intent IR's JCS-based canonicalization produces identical byte sequences for equivalent structures.

### 2.4 When to Use Which

| Use Case | Better Choice | Reason |
|----------|---------------|--------|
| Broad-coverage semantic parsing | AMR | Larger coverage, established tools |
| Intent understanding for dialogue | Intent IR | Force representation, closed vocabulary |
| Cross-lingual transfer | Intent IR | Language-independent design |
| Coreference-heavy texts | AMR | Native graph reentrancy |
| Caching/retrieval | Intent IR | Exact canonicalization |

---

## 3. FrameNet

### 3.1 Overview

FrameNet [Baker et al., 1998] is a lexical database based on **Frame Semantics** [Fillmore, 1976]. Each frame represents a type of event or situation with associated **Frame Elements (FEs)**.

```
Frame: Commerce_buy
FEs: Buyer, Seller, Goods, Money, Purpose, ...

"Kim bought the book from the store for $20."
Buyer: Kim
Goods: the book
Seller: the store
Money: $20
```

### 3.2 Comparison with Intent IR

| Dimension | FrameNet | Intent IR | Analysis |
|-----------|----------|-----------|----------|
| **Role Inventory** | Frame-specific FEs | Universal θ-roles | FrameNet has 1000+ FE types; Intent IR has 6 |
| **Abstraction** | Frames group related predicates | EventClass categorizes lemmas | Both provide coarse-grained classification |
| **Lexicalization** | English-specific | Language-independent | FrameNet tied to English lemmas |
| **Canonical Form** | Not defined | JCS-normalized | Intent IR supports exact equivalence |
| **Computational Use** | Annotation resource | Executable specification | Intent IR includes validation API |

### 3.3 Key Differences

**Role Granularity:**
FrameNet's fine-grained FEs capture nuanced semantic distinctions (e.g., `Donor` vs. `Giver` vs. `Seller`). Intent IR collapses these into broader θ-roles, sacrificing nuance for canonicalizability.

**Frame-Specificity:**
FrameNet FEs are defined per frame—`Buyer` only exists in commercial frames. Intent IR's roles are universal—`TARGET` applies across all events.

**Extensibility:**
FrameNet grows by adding frames and FEs. Intent IR extends via the `ext` field and domain-specific Lexicon entries.

### 3.4 FrameNet-to-Intent-IR Mapping

A possible mapping from FrameNet to Intent IR:

| FrameNet FE Category | Intent IR Role | Examples |
|----------------------|----------------|----------|
| Core, Agent-like | (implicit in lemma) | Buyer, Sender, Speaker |
| Core, Patient-like | TARGET | Goods, Theme, Message |
| Core, Content-like | THEME | Content, Topic, Issue |
| Peripheral, Source-like | SOURCE | Origin, Donor |
| Peripheral, Goal-like | DEST | Goal, Recipient |
| Peripheral, Instrument-like | INSTRUMENT | Instrument, Means |
| Peripheral, Beneficiary-like | BENEFICIARY | Beneficiary, Recipient |

---

## 4. PropBank

### 4.1 Overview

PropBank [Palmer et al., 2005] annotates predicate-argument structure with **numbered argument roles** (Arg0, Arg1, ..., Arg5) plus modifier roles (ArgM-TMP, ArgM-LOC, etc.).

```
Predicate: cancel.01
Arg0: Canceler (agent)
Arg1: Thing cancelled (patient)
Arg2: Reason for cancellation

"John cancelled the meeting due to illness."
Arg0: John
Arg1: the meeting
ArgM-CAU: due to illness
```

### 4.2 Comparison with Intent IR

| Dimension | PropBank | Intent IR | Analysis |
|-----------|----------|-----------|----------|
| **Role Naming** | Numbered (Arg0-5) | Semantic (TARGET, THEME) | Intent IR roles are self-documenting |
| **Consistency** | Arg0/Arg1 vary by predicate | θ-roles are universal | Intent IR roles have consistent semantics |
| **Predicate Sense** | Sense-specific rolesets | Lemma + Lexicon | Both handle predicate polysemy |
| **Modifiers** | ArgM-TMP, ArgM-MOD, etc. | Dedicated projections | Intent IR treats modifiers as structural |
| **Resource Type** | Annotation scheme | Executable specification | Intent IR includes validation semantics |

### 4.3 Key Differences

**Role Semantics:**
PropBank's numbered roles are predicate-specific. `Arg1` of `cancel.01` is "thing cancelled," but `Arg1` of `give.01` is "thing given." Intent IR's `TARGET` always means "entity directly affected."

**Modifier Treatment:**
PropBank treats temporal and modal information as adjuncts (ArgM-TMP, ArgM-MOD). Intent IR promotes these to first-class projections (TP, ModP).

### 4.4 PropBank-to-Intent-IR Mapping

General mapping heuristics:

| PropBank Role | Intent IR Mapping | Notes |
|---------------|-------------------|-------|
| Arg0 (proto-agent) | Implicit in force | Typically the speaker/user |
| Arg1 (proto-patient) | TARGET | Most affected entity |
| Arg2+ | Context-dependent | May map to THEME, DEST, etc. |
| ArgM-TMP | time | Temporal specification |
| ArgM-MOD | mod | Modal specification |
| ArgM-LOC | DEST or SOURCE | Spatial arguments |

---

## 5. Universal Conceptual Cognitive Annotation (UCCA)

### 5.1 Overview

UCCA [Abend & Rappoport, 2013] is a **cross-linguistically applicable** semantic representation based on Basic Linguistic Theory [Dixon, 2010]. It represents meaning through **scenes** and **participants**.

```
Scene: "Kim gave Sam a book"
├── A (Actor): Kim
├── P (Process): gave
├── R (Recipient): Sam
└── T (Theme): a book
```

### 5.2 Comparison with Intent IR

| Dimension | UCCA | Intent IR | Analysis |
|-----------|------|-----------|----------|
| **Foundation** | Cognitive/typological | Generative/Chomskyan | Different theoretical traditions |
| **Structure** | DAG with scene units | Functional projections | Both hierarchical, different primitives |
| **Cross-linguistic** | Explicitly designed | Theoretically motivated | Both claim universality |
| **Role Inventory** | ~15 categories | 6 θ-roles | UCCA more fine-grained for scenes |
| **Focus** | General semantic content | Intent/action specification | Intent IR optimized for dialogue/agents |

### 5.3 Key Differences

**Cognitive vs. Formal:**
UCCA derives from cognitive/typological linguistics, focusing on how humans conceptualize scenes. Intent IR derives from generative grammar, focusing on formal properties of semantic structure.

**Scene vs. Intent:**
UCCA's primary unit is the **scene**—a complex situation that may include multiple events. Intent IR's primary unit is the **intent**—a single speech act with a specific illocutionary force.

**Participant Roles:**
UCCA distinguishes more participant types (Experiencer, Stimulus, Attribute, etc.). Intent IR collapses these into fewer θ-roles to enable canonicalization.

---

## 6. Universal Dependencies (UD)

### 6.1 Overview

Universal Dependencies [de Marneffe et al., 2014] is a framework for cross-lingual **syntactic** annotation, representing sentence structure as dependency trees.

```
# UD for "The boy cancelled the order."
cancelled -NSUBJ-> boy
          -OBJ-> order
boy -DET-> The
order -DET-> the
```

### 6.2 Comparison with Intent IR

| Dimension | UD | Intent IR | Analysis |
|-----------|-----|-----------|----------|
| **Level** | Syntactic | Semantic | Different abstraction levels |
| **Structure** | Dependency tree | Functional projection | UD surface-oriented; Intent IR meaning-oriented |
| **Cross-linguistic** | Universal relations | Universal heads/roles | Both aim for language independence |
| **Surface Variation** | Preserved | Abstracted | UD reflects word order; Intent IR normalizes |
| **Purpose** | Parsing, typology | Intent understanding | Different application domains |

### 6.3 Key Differences

**Syntax vs. Semantics:**
UD represents **how** meaning is expressed (syntactic relations). Intent IR represents **what** is expressed (semantic content). Passive/active alternations differ in UD but produce identical Intent IR.

```
Active: "The user cancelled the order."
Passive: "The order was cancelled by the user."

UD: Different dependency structures
Intent IR: Identical (same TARGET, same lemma, same force)
```

**Relation Types:**
UD relations (nsubj, obj, iobj) are syntactic. Intent IR roles (TARGET, THEME) are semantic.

---

## 7. Comparative Matrix

### 7.1 Feature Comparison

| Feature | AMR | FrameNet | PropBank | UCCA | UD | Intent IR |
|---------|-----|----------|----------|------|-----|-----------|
| **Language Independence** | Partial | No | Partial | Yes | Yes | **Yes** |
| **Canonicalizable** | Approx. | No | No | No | N/A | **Exact** |
| **Closed Role Vocabulary** | No | No | Numbered | Yes | Yes | **Yes** |
| **Force Representation** | No | Partial | No | No | No | **Yes** |
| **Modality Representation** | Partial | No | Partial | No | No | **Yes** |
| **Temporal Representation** | Partial | Partial | ArgM-TMP | E | No | **Yes** |
| **Schema Verifiable** | No | No | No | No | Yes | **Yes** |
| **Domain Adaptable** | Via frames | Via frames | Via rolesets | Generic | Generic | **Lexicon** |

### 7.2 Structural Comparison

| Formalism | Structure Type | Node Types | Edge Types |
|-----------|---------------|------------|------------|
| AMR | Rooted DAG | Concepts (predicates, entities) | Relations (ARG0-5, :mod, :time, ...) |
| FrameNet | Flat annotation | Frame tokens | FE assignments |
| PropBank | Flat annotation | Predicate tokens | Arg0-5, ArgM-* |
| UCCA | DAG | Scene/non-scene units | ~15 relation types |
| UD | Dependency tree | Words | ~40 relation types |
| Intent IR | Hierarchical projection | Functional heads | θ-roles (6) |

### 7.3 Application Suitability

| Application | Best Formalism | Rationale |
|-------------|----------------|-----------|
| **Machine translation** | AMR, UD | Broad coverage, established systems |
| **Question answering** | AMR, UCCA | Complex scene representation |
| **Dialogue systems** | **Intent IR** | Force, closed vocabulary, caching |
| **Task-oriented agents** | **Intent IR** | Action specification, validation |
| **Semantic search** | **Intent IR** | Exact canonicalization, StrictKey |
| **Linguistic annotation** | UD, UCCA | Comprehensive coverage |
| **Lexical resources** | FrameNet, PropBank | Rich lexical semantics |

---

## 8. Design Implications

### 8.1 What Intent IR Inherits

From each formalism, Intent IR inherits specific insights:

| From | Inherited Design Element |
|------|--------------------------|
| **AMR** | Concept-based representation, abstract predicates |
| **FrameNet** | Event classification (EventClass ≈ Frame grouping) |
| **PropBank** | Lexicon-based argument structure (θ-frame ≈ roleset) |
| **UCCA** | Cross-linguistic commitment, category universality |
| **UD** | Standardized annotation, open resource model |

### 8.2 What Intent IR Differs In

| Design Choice | Departure From | Rationale |
|---------------|----------------|-----------|
| Closed role vocabulary | AMR, FrameNet | Enables canonicalization |
| Force as structural | All | Required for intent understanding |
| Exact canonicalization | All | Enables caching/retrieval |
| Lexicon-based validation | All except PropBank | Domain adaptability |
| Projection-based hierarchy | UD, AMR | Theoretical coherence (Minimalism) |

### 8.3 Trade-offs

Intent IR's design involves explicit trade-offs:

| Gained | Lost |
|--------|------|
| Canonical equivalence | Fine-grained role distinctions |
| Force/modality representation | Broad semantic coverage |
| Domain verifiability | Zero-shot generalization |
| Language independence | Easy adoption of existing resources |
| Computational tractability | Expressiveness (e.g., no OR in v0.1) |

---

## 9. Future Directions

### 9.1 Interoperability

Future work should explore automatic conversion between formalisms:

- **AMR → Intent IR:** Map AMR predicates to Intent IR lemmas via alignment
- **PropBank → Intent IR:** Map rolesets to θ-frames in Lexicon
- **Intent IR → AMR:** Generate AMR graphs from Intent IR for downstream tasks

### 9.2 Hybrid Approaches

Some applications may benefit from combining formalisms:

- Use Intent IR for dialogue acts, AMR for background content
- Use UD for syntactic parsing, Intent IR for semantic extraction
- Use FrameNet frames to inform Intent IR Lexicon entries

### 9.3 Evaluation

Comparative evaluation should address:

1. **Parsing accuracy:** Which formalism is easier to parse accurately?
2. **Cross-lingual consistency:** Do parallel sentences yield equivalent representations?
3. **Downstream task performance:** Which formalism leads to better agent behavior?
4. **Annotation efficiency:** How quickly can humans annotate each formalism?

---

## References

See [BIBLIOGRAPHY.bib](./BIBLIOGRAPHY.bib) for full citations.

Key works:
- [Banarescu et al., 2013] Abstract Meaning Representation
- [Baker et al., 1998] The Berkeley FrameNet Project
- [Palmer et al., 2005] The Proposition Bank
- [Abend & Rappoport, 2013] UCCA
- [de Marneffe et al., 2014] Universal Dependencies
- [Cai & Knight, 2013] Smatch

---

*End of Comparative Analysis Document*
