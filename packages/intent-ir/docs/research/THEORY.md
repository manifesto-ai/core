# Theoretical Foundations of Intent IR

> **Status:** Research Document
> **Version:** 0.1.0
> **Audience:** Computational linguists, NLP researchers, formal semanticists
> **Normative Authority:** This document is INFORMATIVE. For normative specifications, see [SPEC-v0.2.0](../SPEC-v0.2.0.md).
> **References:** See [BIBLIOGRAPHY.bib](./BIBLIOGRAPHY.bib)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Chomskyan Foundations](#2-chomskyan-foundations)
3. [Functional Projection Hierarchy](#3-functional-projection-hierarchy)
4. [Theta Theory and Argument Structure](#4-theta-theory-and-argument-structure)
5. [Feature Checking and Agree](#5-feature-checking-and-agree)
6. [Speech Act Theory Integration](#6-speech-act-theory-integration)
7. [Cross-Linguistic Validity](#7-cross-linguistic-validity)
8. [Open Questions](#8-open-questions)

---

## 1. Introduction

Intent IR is grounded in the theoretical framework of **Chomsky's Minimalist Program** [Chomsky, 1995], specifically the notion that semantic interpretation occurs at **Logical Form (LF)**—an abstract syntactic level that interfaces with the conceptual-intentional systems.

This document explicates the linguistic theory underlying Intent IR's design decisions, providing researchers with the formal and empirical basis for our representational choices.

### 1.1 The Core Claim

> **Thesis:** Natural language intents, across all human languages, share a universal semantic structure expressible through functional projections and thematic relations.

This claim derives from the **Universal Grammar (UG)** hypothesis: the human language faculty is constrained by innate, species-specific principles that limit possible grammars. Intent IR operationalizes this hypothesis for the domain of intent representation.

### 1.2 Scope and Limitations

This document covers:
- The theoretical justification for Intent IR's functional head inventory
- The relationship between linguistic theory and IR design decisions
- Cross-linguistic evidence for universality claims

This document does NOT cover:
- Implementation details (see SPEC)
- Decision rationale (see FDR)
- Comparative analysis with other formalisms (see COMPARISON.md)

---

## 2. Chomskyan Foundations

### 2.1 The Minimalist Program

The Minimalist Program [Chomsky, 1995; Chomsky, 2000] proposes that the language faculty is an optimal solution to interface conditions imposed by external systems:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Y-Model Architecture                              │
│                                                                         │
│                           LEXICON                                       │
│                              │                                          │
│                              ▼                                          │
│                        Computation                                      │
│                        (Narrow Syntax)                                  │
│                           /   \                                         │
│                          /     \                                        │
│                         ▼       ▼                                       │
│                       PF         LF                                     │
│            (Phonetic Form)    (Logical Form)                           │
│                   │               │                                     │
│                   ▼               ▼                                     │
│        Sensorimotor        Conceptual-Intentional                      │
│           Systems               Systems                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key insight for Intent IR:** PF and LF are distinct representations of the same syntactic object. Multiple PF realizations (surface forms in different languages) can map to the same LF (semantic content).

### 2.2 LF as the Locus of Semantic Interpretation

Following [Heim & Kratzer, 1998], we assume:

1. **Compositionality:** The meaning of a complex expression is a function of the meanings of its parts and their mode of combination.
2. **LF as input:** Semantic interpretation operates on LF structures, not surface strings.
3. **Covert operations:** LF may contain elements not pronounced at PF (e.g., covert movement, null operators).

Intent IR adopts LF as its representational level, abstracting away from:
- Phonological form (word order, morphology, prosody)
- Language-specific surface syntax
- Discourse-level phenomena not relevant to intent

### 2.3 Projection and Structure Building

Bare Phrase Structure [Chomsky, 1995] builds syntactic objects through **Merge**:

```
Merge(α, β) = {α, {α, β}}  or  {β, {α, β}}
```

This yields binary-branching structures where one element **projects** its label. For Intent IR, this means:

- Functional heads (Force, Mod, T, v) project their features
- Arguments are merged as specifiers or complements
- The resulting structure encodes scopal and thematic relations

---

## 3. Functional Projection Hierarchy

### 3.1 The Cartographic Approach

Intent IR's functional head inventory draws on the **Cartographic approach** to syntax [Rizzi, 1997; Cinque, 1999], which proposes that functional projections form a **universal hierarchy**.

Rizzi's [1997] seminal work on the left periphery proposes:

```
[ForceP Force [TopP* Top [FocP Foc [TopP* Top [FinP Fin [IP ... ]]]]]]
```

This decomposition of the CP (Complementizer Phrase) domain informs Intent IR's **Force** head.

### 3.2 Intent IR's Projection Hierarchy

Intent IR adopts a simplified, domain-appropriate projection sequence:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   Intent IR Functional Hierarchy                         │
│                                                                         │
│   ForceP ─── Illocutionary type (ASK/DO/VERIFY/CONFIRM/CLARIFY)        │
│      │       ← [Rizzi, 1997; Austin, 1962]                              │
│      │                                                                  │
│   ModP ──── Deontic modality (MUST/SHOULD/MAY/FORBID)                  │
│      │       ← [Kratzer, 1991; Palmer, 2001]                            │
│      │                                                                  │
│   TP ────── Temporal specification (NOW/AT/BEFORE/AFTER/WITHIN)        │
│      │       ← [Reichenbach, 1947; Comrie, 1985]                        │
│      │                                                                  │
│   vP ────── Event type (lemma + class)                                 │
│      │       ← [Vendler, 1967; Dowty, 1979]                             │
│      │                                                                  │
│   VP ────── Argument structure (θ-roles)                               │
│              ← [Chomsky, 1981; Fillmore, 1968]                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Theoretical Justification for Each Head

#### 3.3.1 Force (ForceP)

**Linguistic basis:** Following [Rizzi, 1997], Force encodes the **clause type**—the fundamental illocutionary contribution of the utterance.

| Force Value | Linguistic Category | Cross-linguistic Evidence |
|-------------|---------------------|---------------------------|
| `ASK` | Interrogative | Wh-movement, question particles (Japanese *ka*, Mandarin *ma*) |
| `DO` | Imperative | Imperative morphology, null subjects |
| `VERIFY` | Declarative (epistemic) | Evidential markers |
| `CONFIRM` | Confirmative | Tag questions, confirmation particles |
| `CLARIFY` | Meta-linguistic | Echo questions, repair sequences |

**Evidence for universality:** All attested human languages distinguish at least declarative, interrogative, and imperative clause types [Sadock & Zwicky, 1985].

#### 3.3.2 Modality (ModP)

**Linguistic basis:** Modality expresses the speaker's attitude toward the proposition. Following [Kratzer, 1991], we distinguish:

- **Deontic modality:** Obligations, permissions, prohibitions
- **Epistemic modality:** Probability, certainty (out of scope for v0.1)

Intent IR focuses on **deontic modality** as relevant to intent specification:

| Mod Value | Modal Force | Example |
|-----------|-------------|---------|
| `MUST` | Necessity | "You MUST cancel the order" |
| `SHOULD` | Weak necessity | "You SHOULD verify first" |
| `MAY` | Possibility/Permission | "You MAY proceed" |
| `FORBID` | Impossibility | "You MUST NOT delete" |

#### 3.3.3 Tense/Time (TP)

**Linguistic basis:** Reichenbach's [1947] analysis of tense distinguishes:
- **Speech time (S):** When the utterance is made
- **Event time (E):** When the event occurs
- **Reference time (R):** The temporal perspective

Intent IR's Time specification maps to these primitives:

| Time Value | Reichenbach Relation | Semantics |
|------------|----------------------|-----------|
| `NOW` | S = R = E | Immediate execution |
| `AT` | R = E, S ≠ E | Scheduled execution |
| `BEFORE` | E < R | Deadline constraint |
| `AFTER` | R < E | Prerequisite constraint |
| `WITHIN` | E ⊆ interval(R) | Duration constraint |

#### 3.3.4 Event (vP)

**Linguistic basis:** The **light verb** (v) domain [Chomsky, 1995; Kratzer, 1996] hosts:
- Agent introduction
- Voice alternations (active/passive)
- Event type (aktionsart)

Intent IR's `event.class` corresponds to Vendler's [1967] aspectual classes, adapted for computational domains:

| EventClass | Vendler Class | Properties |
|------------|---------------|------------|
| `OBSERVE` | State | [-dynamic, +durative] |
| `TRANSFORM` | Accomplishment | [+dynamic, +telic] |
| `SOLVE` | Achievement | [+dynamic, -durative, +telic] |
| `CREATE` | Accomplishment | [+dynamic, +telic, +change-of-state] |
| `DECIDE` | Achievement | [+dynamic, -durative] |
| `CONTROL` | Activity/Achievement | [+dynamic, ±telic] |

---

## 4. Theta Theory and Argument Structure

### 4.1 θ-Theory Foundations

Theta theory [Chomsky, 1981] governs the assignment of **thematic roles** to arguments:

**θ-Criterion:** Each argument bears one and only one θ-role, and each θ-role is assigned to one and only one argument.

This constraint ensures a bijective mapping between arguments and roles, which Intent IR enforces through the discriminated union structure of the `args` field.

### 4.2 Universal θ-Roles

Intent IR adopts a subset of universally attested thematic roles:

| Role | Definition | Theoretical Source |
|------|------------|-------------------|
| `TARGET` | Entity undergoing change | Patient/Theme [Dowty, 1991] |
| `THEME` | Content/subject matter | Theme [Gruber, 1965] |
| `SOURCE` | Origin of motion/transfer | Source [Jackendoff, 1990] |
| `DEST` | Goal of motion/transfer | Goal [Jackendoff, 1990] |
| `INSTRUMENT` | Means of action | Instrument [Fillmore, 1968] |
| `BENEFICIARY` | Entity benefiting | Benefactive [Fillmore, 1968] |

### 4.3 The Theta Hierarchy

Following [Baker, 1988] and [Larson, 1988], θ-roles exhibit a universal hierarchy that determines syntactic realization:

```
Agent > Beneficiary > Goal/Source > Instrument > Theme/Patient
```

Intent IR's `ROLE_ORDER` constant reflects this hierarchy for display purposes, though canonical serialization uses lexicographic order per RFC 8785.

### 4.4 Selectional Restrictions

θ-roles impose **selectional restrictions** on their fillers [Chomsky, 1965]. Intent IR implements this through the Lexicon's `ThetaFrame`:

```typescript
type SelectionalRestriction = {
  termKinds: Term["kind"][];      // Syntactic category
  entityTypes?: string[];         // Semantic type (domain-specific)
  valueTypes?: ValueTerm["valueType"][];  // Value constraints
};
```

This corresponds to the linguistic notion that predicates select for arguments with specific semantic features:

- *read* selects for [+animate] Agent, [+legible] Theme
- *frighten* selects for [+animate] Experiencer, [+frightening] Stimulus

---

## 5. Feature Checking and Agree

### 5.1 The Agree Operation

Chomsky's [2000, 2001] **Agree** operation establishes a relation between a **Probe** (functional head with unvalued features) and a **Goal** (element with valued features):

```
Agree(Probe, Goal) → Feature valuation, Case assignment
```

Intent IR's feature checking mechanism mirrors this:

1. **Probe:** The Lexicon entry for a lemma (specifies required features)
2. **Goal:** The Term filling an argument position (provides feature values)
3. **Checking:** Verification that Goal satisfies Probe's selectional restrictions

### 5.2 Feature Specification in Intent IR

Features in Intent IR are expressed through:

1. **Term kind:** Categorical feature (entity, path, artifact, value, expr)
2. **Type specifications:** Entity type, value type, expression type
3. **Shape features:** Semantic properties for canonicalization

This corresponds to the traditional distinction between:
- **Formal features:** Syntactic category, case, phi-features
- **Semantic features:** Selectional features, theta-grids

### 5.3 Checking Algorithm

The feature checking algorithm (see SPEC §14.3) implements a simplified Agree:

```
checkFeatures(ir, lexicon):
  probe := lexicon.resolveEvent(ir.event.lemma)
  for each role in probe.thetaFrame.required:
    goal := ir.args[role]
    if goal undefined:
      return FAILURE(MISSING_ROLE)
    if not satisfies(goal, probe.restrictions[role]):
      return FAILURE(TYPE_MISMATCH)
  return SUCCESS
```

---

## 6. Speech Act Theory Integration

### 6.1 Austin's Taxonomy

Austin's [1962] taxonomy of speech acts distinguishes:

1. **Locutionary act:** The act of saying something (PF)
2. **Illocutionary act:** The act performed in saying (Force)
3. **Perlocutionary act:** The effect on the hearer (out of scope)

Intent IR captures the **illocutionary force** through the `force` field:

| Force | Austinian Category | Searle's [1976] Class |
|-------|--------------------|-----------------------|
| `ASK` | Expositive | Directive (information-seeking) |
| `DO` | Exercitive | Directive (action-inducing) |
| `VERIFY` | Verdictive | Assertive |
| `CONFIRM` | Commissive | Commissive |
| `CLARIFY` | Expositive | Expressive (meta-linguistic) |

### 6.2 Searle's Conditions

Searle [1969] analyzed speech acts in terms of **felicity conditions**:

- **Propositional content condition:** What the utterance is about
- **Preparatory condition:** Background assumptions
- **Sincerity condition:** Speaker's psychological state
- **Essential condition:** What makes it that type of act

Intent IR's structure maps to these conditions:

| IR Component | Searle Condition |
|--------------|------------------|
| `event` + `args` | Propositional content |
| `cond` | Preparatory conditions (filters) |
| `mod` | Sincerity (deontic stance) |
| `force` | Essential condition |

### 6.3 Indirect Speech Acts

Indirect speech acts (e.g., "Can you pass the salt?" as a request) pose a challenge. Intent IR handles this by representing the **primary illocution**:

```json
// Surface: "Can you cancel this order?"
// Intent IR represents the indirect request:
{
  "force": "DO",
  "event": { "lemma": "CANCEL", "class": "CONTROL" },
  "args": { "TARGET": { "kind": "entity", "entityType": "Order", "ref": { "kind": "this" } } }
}
```

The mapping from surface form to primary illocution is the responsibility of the Translator component, which MAY involve LLM-based pragmatic inference.

---

## 7. Cross-Linguistic Validity

### 7.1 Evidence for Universal Functional Structure

Intent IR's universality claim rests on cross-linguistic evidence for functional projections:

**Force universality:**
- All languages distinguish clause types [Sadock & Zwicky, 1985]
- Force marking varies (word order, particles, morphology) but the semantic distinction is universal

**Modality universality:**
- Modal distinctions are universal, though expression varies [Palmer, 2001]
- Some languages use modal verbs (English), others use mood morphology (Romance), or particles (Japanese)

**θ-role universality:**
- The UTAH (Uniformity of Theta Assignment Hypothesis) [Baker, 1988] proposes identical roles receive identical structural positions across languages
- Role inventories are largely consistent cross-linguistically [Dowty, 1991]

### 7.2 Case Study: Korean-English Mapping

Consider the Korean-English pair:

```
Korean: "주문 취소해줘" /jumun chwisohae-jwo/
English: "Cancel the order"
```

Both map to identical Intent IR:

```json
{
  "v": "0.1",
  "force": "DO",
  "event": { "lemma": "CANCEL", "class": "CONTROL" },
  "args": {
    "TARGET": { "kind": "entity", "entityType": "Order", "ref": { "kind": "this" } }
  }
}
```

**Surface differences abstracted away:**
- Word order: SOV (Korean) vs. SVO (English)
- Morphology: Benefactive suffix *-jwo* vs. separate pronoun
- Definiteness: No article (Korean) vs. *the* (English)
- Politeness: Informal imperative (Korean) vs. base imperative (English)

---

## 8. Open Questions

### 8.1 Theoretical Questions

1. **Quantifier scope:** How should Intent IR represent scope ambiguities (e.g., "Every user should see a notification")?

2. **Anaphora resolution:** The Resolver component handles discourse reference, but the theoretical basis for resolution strategies needs elaboration.

3. **Negation:** Current v0.1 defers negation to v0.2+. What is the correct position for NegP in the projection hierarchy?

4. **Event structure decomposition:** Should complex events (e.g., causatives) be decomposed into primitive predicates?

### 8.2 Empirical Questions

1. **Coverage:** What percentage of natural intents in a given domain can Intent IR v0.1 express?

2. **Translation accuracy:** How reliably can different surface forms be mapped to the correct LF by current Translator implementations?

3. **Cross-linguistic equivalence:** Do semantically equivalent utterances in different languages consistently produce identical IRs?

### 8.3 Design Questions

1. **θ-role granularity:** Is the current six-role inventory sufficient? Should we add more fine-grained roles (e.g., Experiencer, Stimulus)?

2. **Modality scope:** Should epistemic modality be added? How does it interact with Force?

3. **Information structure:** Should Topic and Focus be represented? They may be relevant for response generation.

---

## References

See [BIBLIOGRAPHY.bib](./BIBLIOGRAPHY.bib) for full citations.

Key works:
- [Chomsky, 1995] The Minimalist Program
- [Chomsky, 2000, 2001] Derivation by Phase
- [Rizzi, 1997] The Fine Structure of the Left Periphery
- [Kratzer, 1991] Modality
- [Dowty, 1991] Thematic Proto-Roles
- [Austin, 1962] How to Do Things with Words
- [Searle, 1969] Speech Acts

---

*End of Theoretical Foundations Document*
