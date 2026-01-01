                      # Manifesto Translator Specification v2.0

> **Status:** Normative
> **Version:** 2.0.0
> **Depends On:** MEL SPEC v0.3.3, Manifesto Core SPEC v1.0, Manifesto Bridge SPEC v1.0
> **Supersedes:** Translator SPEC v1.x
> **License:** MIT

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Normative Language](#2-normative-language)
3. [Core Philosophy](#3-core-philosophy)
4. [Domain Definition](#4-domain-definition)
5. [Type System](#5-type-system)
6. [Host Effects](#6-host-effects)
7. [Normalization](#7-normalization)
8. [Fast Path](#8-fast-path)
9. [Retrieval](#9-retrieval)
10. [Proposal](#10-proposal)
11. [Ambiguity Resolution](#11-ambiguity-resolution)
12. [Glossary System](#12-glossary-system)
13. [Bridge Integration](#13-bridge-integration)
14. [Validation Rules](#14-validation-rules)
15. [API Reference](#15-api-reference)

**Appendices**
- [A. Complete MEL Definition](#appendix-a-complete-mel-definition)
- [B. TypeScript Type Definitions](#appendix-b-typescript-type-definitions)
- [C. Fast Path Pattern Grammar](#appendix-c-fast-path-pattern-grammar)
- [D. Built-in Glossary Entries](#appendix-d-built-in-glossary-entries)
- [E. Example Scenarios](#appendix-e-example-scenarios)

---

## 1. Introduction

### 1.1 What is Translator?

Translator is a **Manifesto Domain** that converts natural language intent into structured `PatchFragment` changes. It is:

- A proof that Manifesto can express complex LLM pipelines
- A dogfooding example of World-Centric architecture
- A multilingual NL-to-schema translation system

### 1.2 What Translator is NOT

Translator is NOT:

- A standalone TypeScript package (v1.x design)
- An LLM wrapper or agent framework
- A code generator
- A MEL parser (MEL rendering is separate)

### 1.3 Design Goals

| Goal | Description |
|------|-------------|
| **Dogfooding** | Prove Manifesto works for real systems |
| **Small-Model-First** | Prefer gpt-4o-mini over gpt-4o |
| **Zero-LLM-When-Possible** | Fast Path handles common patterns |
| **Multilingual** | Korean, English, French, etc. |
| **Type-Aware** | Types are first-class, AI-queryable |

### 1.4 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Translator Domain                           │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │Normalize │ → │Fast Path │ → │ Retrieve │ → │ Propose  │     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│       ↓              ↓              ↓              ↓            │
│    effect        computed        effect        effect          │
│  llm.normalize   (no LLM)    translator.    llm.propose        │
│                              retrieve                          │
│                                                                 │
│  state { request, normalization, fastPath, retrieval,          │
│          proposal, result }                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                        World Snapshot
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Bridge                                 │
│                                                                 │
│  subscribe() → observe needsResolution                          │
│  dispatch()  → translator.resolve, translator.translate         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

---

## 3. Core Philosophy

### 3.1 Translator Constitution

```
1. Translator is a Manifesto Domain, not a TypeScript package.
2. All state lives in World Snapshot.
3. LLM calls are Host Effects, not direct API calls.
4. Types are first-class, AI-queryable schema objects.
5. Ambiguity resolution uses standard Bridge pattern.
6. Lab is optional (for tracing/replay only).
7. Fast Path handles common patterns without LLM.
8. LLM outputs are untrusted proposals requiring validation.
```

### 3.2 Pipeline Model

Translation is a **staged pipeline** where each stage is Domain state:

| Stage | State Field | Trigger | Effect |
|-------|-------------|---------|--------|
| 0. Initialize | `request` | `translate()` action | none |
| 1. Normalize | `normalization` | `hasRequest` | `llm.normalize` |
| 2. Fast Path | `fastPath` | `isNormalized` | `translator.fastPath` |
| 3. Retrieve | `retrieval` | `needsSlm` | `translator.retrieve` |
| 4. Propose | `proposal` | `hasRetrieval` | `llm.propose` |
| 5. Result | `result` | `fastPathSucceeded` or `hasProposal` | none |

### 3.3 Ambiguity Model

When multiple interpretations exist, Translator:

1. Sets `proposal.ambiguity` with options
2. `needsResolution` computed becomes true
3. Bridge subscriber observes and presents to consumer
4. Consumer dispatches `resolve` Intent
5. Domain finalizes `result`

**Fallback behavior** on timeout:
- `guess`: Select highest-confidence option
- `discard`: Reject translation entirely

---

## 4. Domain Definition

### 4.1 Domain Identity

```
Domain ID: manifesto.translator
Version: 2.0.0
Schema Hash: <computed from canonical form>
```

### 4.2 Imports

```mel
import { Token, GlossaryHit } from "@manifesto/core"
import { PatchFragment, AmbiguityReport, ResolutionOption } from "@manifesto/translator-types"
```

### 4.3 Named Types

The following types MUST be declared in the Domain:

#### 4.3.1 TranslationRequest

```mel
type TranslationRequest = {
  input: string
  targetSchemaId: string
  intentId: string
  options: TranslationOptions | null
}

type TranslationOptions = {
  language: string | null
  maxCandidates: number
  timeoutMs: number
  fallbackBehavior: "guess" | "discard"
}
```

#### 4.3.2 NormalizationResult

```mel
type NormalizationResult = {
  canonical: string
  language: string
  tokens: Array<Token>
  glossaryHits: Array<GlossaryHit>
  protected: Array<ProtectedSpan>
}

type ProtectedSpan = {
  start: number
  end: number
  kind: "identifier" | "number" | "literal" | "operator"
  value: string
}
```

#### 4.3.3 FastPathResult

```mel
type FastPathResult = {
  matched: boolean
  pattern: string | null
  fragment: PatchFragment | null
  confidence: number
}
```

#### 4.3.4 RetrievalResult

```mel
type RetrievalResult = {
  tier: number
  candidates: Array<AnchorCandidate>
  queryTerms: Array<string>
}

type AnchorCandidate = {
  path: string
  score: number
  matchType: "exact" | "alias" | "fuzzy" | "semantic"
  typeHint: TypeExpr | null
}
```

#### 4.3.5 ProposalResult

```mel
type ProposalResult = {
  fragment: PatchFragment | null
  ambiguity: AmbiguityReport | null
  confidence: number
  reasoning: string | null
}
```

#### 4.3.6 TranslationResult

```mel
type TranslationResultFragment = {
  kind: "fragment"
  fragment: PatchFragment
}

type TranslationResultAmbiguity = {
  kind: "ambiguity"
  report: AmbiguityReport
}

type TranslationResultDiscarded = {
  kind: "discarded"
  reason: string
}

type TranslationResult = 
  | TranslationResultFragment 
  | TranslationResultAmbiguity 
  | TranslationResultDiscarded
```

#### 4.3.7 ResolutionSelection

```mel
type ResolutionSelection = {
  decision: "select" | "discard" | "freeform"
  optionId: string | null
  freeformInput: string | null
}
```

### 4.4 State

```mel
state {
  // Current request
  request: TranslationRequest | null = null
  
  // Pipeline stages (null = not yet computed)
  normalization: NormalizationResult | null = null
  fastPath: FastPathResult | null = null
  retrieval: RetrievalResult | null = null
  proposal: ProposalResult | null = null
  
  // Final output
  result: TranslationResult | null = null
  
  // Intent markers (per-intent idempotency)
  initializing: string | null = null
  normalizing: string | null = null
  fastPathing: string | null = null
  retrieving: string | null = null
  proposing: string | null = null
  resolving: string | null = null
  resetting: string | null = null
}
```

### 4.5 Computed

```mel
// Pipeline state queries
computed hasRequest = isNotNull(request)
computed isNormalized = isNotNull(normalization)
computed hasFastPath = isNotNull(fastPath)
computed hasRetrieval = isNotNull(retrieval)
computed hasProposal = isNotNull(proposal)
computed isComplete = isNotNull(result)

// Fast path outcome
computed fastPathSucceeded = and(hasFastPath, fastPath.matched)
computed needsSlm = and(hasFastPath, not(fastPath.matched))

// Ambiguity detection
computed needsResolution = and(
  hasProposal,
  isNotNull(proposal.ambiguity),
  isNull(result)
)

// Timeout detection
computed resolutionExpired = and(
  needsResolution,
  isNotNull(proposal.ambiguity.expiresAt),
  gte($meta.timestamp, proposal.ambiguity.expiresAt)
)

// Current pipeline stage (for observability)
computed currentStage = cond(
  not(hasRequest), "idle",
  cond(not(isNormalized), "normalizing",
  cond(not(hasFastPath), "fast-path",
  cond(and(needsSlm, not(hasRetrieval)), "retrieving",
  cond(and(needsSlm, not(hasProposal)), "proposing",
  cond(needsResolution, "awaiting-resolution",
  "complete"))))))

// Translation progress (0.0 - 1.0)
computed progress = cond(
  not(hasRequest), 0.0,
  cond(not(isNormalized), 0.2,
  cond(not(hasFastPath), 0.4,
  cond(fastPathSucceeded, 1.0,
  cond(not(hasRetrieval), 0.6,
  cond(not(hasProposal), 0.8,
  1.0))))))
```

### 4.6 Actions

#### 4.6.1 translate

```mel
action translate(input: string, schemaId: string, options: TranslationOptions | null)
  available when not(hasRequest) {
  
  // Stage 0: Initialize request
  once(initializing) {
    patch initializing = $meta.intentId
    patch request = {
      input: input,
      targetSchemaId: schemaId,
      intentId: $meta.intentId,
      options: coalesce(options, {
        language: null,
        maxCandidates: 5,
        timeoutMs: 300000,
        fallbackBehavior: "guess"
      })
    }
  }
  
  // Stage 1: Normalize (waits for request)
  once(normalizing) when hasRequest {
    patch normalizing = $meta.intentId
    effect llm.normalize({
      protocol: "translator.normalize",
      input: { 
        text: request.input,
        languageHint: request.options.language
      },
      into: normalization
    })
  }
  
  // Stage 2: Fast Path (deterministic, no LLM)
  once(fastPathing) when isNormalized {
    patch fastPathing = $meta.intentId
    effect translator.fastPath({
      canonical: normalization.canonical,
      tokens: normalization.tokens,
      glossaryHits: normalization.glossaryHits,
      schemaId: request.targetSchemaId,
      into: fastPath
    })
  }
  
  // Stage 3a: Fast path succeeded → finalize
  when and(isNull(result), fastPathSucceeded) {
    patch result = {
      kind: "fragment",
      fragment: fastPath.fragment
    }
  }
  
  // Stage 3b: Fast path failed → retrieve anchors
  once(retrieving) when needsSlm {
    patch retrieving = $meta.intentId
    effect translator.retrieve({
      terms: normalization.tokens,
      glossaryHits: normalization.glossaryHits,
      schemaId: request.targetSchemaId,
      maxCandidates: request.options.maxCandidates,
      into: retrieval
    })
  }
  
  // Stage 4: SLM proposal
  once(proposing) when hasRetrieval {
    patch proposing = $meta.intentId
    effect llm.propose({
      protocol: "translator.propose",
      input: {
        canonical: normalization.canonical,
        tokens: normalization.tokens,
        candidates: retrieval.candidates,
        schemaId: request.targetSchemaId,
        timeoutMs: request.options.timeoutMs,
        fallbackBehavior: request.options.fallbackBehavior
      },
      into: proposal
    })
  }
  
  // Stage 5a: Proposal with fragment (no ambiguity) → finalize
  when and(isNull(result), hasProposal, isNull(proposal.ambiguity)) {
    patch result = {
      kind: "fragment",
      fragment: proposal.fragment
    }
  }
  
  // Stage 5b: Proposal with ambiguity → wait for resolution
  // (needsResolution computed handles this)
  
  // Stage 5c: Resolution timeout → apply fallback
  when resolutionExpired {
    patch result = cond(
      eq(request.options.fallbackBehavior, "guess"),
      {
        kind: "fragment",
        fragment: proposal.ambiguity.options[0].fragment
      },
      {
        kind: "discarded",
        reason: "resolution timeout"
      }
    )
  }
}
```

#### 4.6.2 resolve

```mel
action resolve(selection: ResolutionSelection)
  available when needsResolution {
  
  once(resolving) {
    patch resolving = $meta.intentId
    
    // Select option
    when eq(selection.decision, "select") {
      patch result = {
        kind: "fragment",
        fragment: findOption(proposal.ambiguity.options, selection.optionId).fragment
      }
    }
    
    // Discard
    when eq(selection.decision, "discard") {
      patch result = {
        kind: "discarded",
        reason: "user rejected"
      }
    }
    
    // Freeform (re-translate with clarification)
    when eq(selection.decision, "freeform") {
      // Reset for re-translation with clarified input
      patch request = {
        input: selection.freeformInput,
        targetSchemaId: request.targetSchemaId,
        intentId: $meta.intentId,
        options: request.options
      }
      patch normalization = null
      patch fastPath = null
      patch retrieval = null
      patch proposal = null
      patch initializing = null
      patch normalizing = null
      patch fastPathing = null
      patch retrieving = null
      patch proposing = null
    }
  }
}
```

#### 4.6.3 reset

```mel
action reset()
  available when isComplete {
  
  once(resetting) {
    patch resetting = $meta.intentId
    patch request = null
    patch normalization = null
    patch fastPath = null
    patch retrieval = null
    patch proposal = null
    patch result = null
    patch initializing = null
    patch normalizing = null
    patch fastPathing = null
    patch retrieving = null
    patch proposing = null
    patch resolving = null
  }
}
```

---

## 5. Type System

### 5.1 Overview

Translator treats types as **first-class, AI-queryable schema objects**. This enables:

- Type-aware Fast Path pattern selection
- Better anchor candidate scoring
- Smaller, more focused LLM prompts

### 5.2 TypeExpr AST

TypeExpr is the canonical representation of types (aligned with MEL v0.3.3):

```typescript
type TypeExpr =
  | { kind: 'primitive'; name: 'string' | 'number' | 'boolean' | 'null' }
  | { kind: 'literal'; value: string | number }
  | { kind: 'ref'; name: string }
  | { kind: 'union'; members: readonly TypeExpr[] }
  | { kind: 'array'; element: TypeExpr }
  | { kind: 'record'; key: TypeExpr; value: TypeExpr }
  | { kind: 'object'; fields: readonly ObjectTypeField[] }

interface ObjectTypeField {
  readonly name: string;
  readonly type: TypeExpr;
  readonly optional: boolean;
}
```

### 5.3 ResolvedType

ResolvedType is the fully-expanded type at a semantic path:

```typescript
interface ResolvedType {
  /** Fully expanded type (refs resolved) */
  readonly resolved: TypeExpr;
  
  /** Original named type (if from type decl) */
  readonly sourceName?: string;
  
  /** Whether union includes null */
  readonly nullable: boolean;
  
  /** Base kind for pattern matching */
  readonly baseKind: 'string' | 'number' | 'boolean' | 'null' 
                   | 'array' | 'record' | 'object' | 'union';
}
```

### 5.4 TypeIndex

TypeIndex is a deterministic projection of all types in a schema:

```typescript
type TypeIndex = Readonly<Record<SemanticPath, ResolvedType>>;

/**
 * Build TypeIndex from DomainSchema
 * MUST be deterministic: same schema → same index
 */
function buildTypeIndex(schema: DomainSchema): TypeIndex;
```

### 5.5 Type-Aware Operations

#### 5.5.1 Pattern Selection

Fast Path MUST select patterns based on `ResolvedType.baseKind`:

| baseKind | Applicable Patterns |
|----------|---------------------|
| `number` | comparator, range, null |
| `string` | length, inclusion, pattern, null |
| `boolean` | boolean, null |
| `array` | length, inclusion, null |
| `object` | field, null |
| `union` | All patterns of member types |

#### 5.5.2 Candidate Scoring

Retrieval SHOULD boost candidates where `typeHint` matches query intent:

```
Query: "age must be at least 18"
Candidate A: User.age (number) → +0.3 boost (numeric constraint)
Candidate B: User.name (string) → no boost
```

---

## 6. Host Effects

### 6.1 Effect Contract

Translator Host MUST implement the following effects:

```typescript
interface TranslatorHostEffects {
  "llm.normalize": LLMNormalizeEffect;
  "llm.propose": LLMProposeEffect;
  "translator.fastPath": FastPathEffect;
  "translator.retrieve": RetrieveEffect;
}
```

### 6.2 llm.normalize

```typescript
interface LLMNormalizeEffect {
  (params: {
    protocol: "translator.normalize";
    input: {
      text: string;
      languageHint?: string;
    };
    into: Path;
  }): Promise<void>;
}
```

**Protocol Configuration:**

```typescript
{
  model: "gpt-4o-mini",
  temperature: 0,
  maxTokens: 500,
  systemPrompt: NORMALIZATION_SYSTEM_PROMPT,
  outputSchema: NormalizationResultSchema,
}
```

**Output:** `NormalizationResult` patched to `into` path.

### 6.3 llm.propose

```typescript
interface LLMProposeEffect {
  (params: {
    protocol: "translator.propose";
    input: {
      canonical: string;
      tokens: Token[];
      candidates: AnchorCandidate[];
      schemaId: string;
      timeoutMs: number;
      fallbackBehavior: "guess" | "discard";
    };
    into: Path;
  }): Promise<void>;
}
```

**Protocol Configuration:**

```typescript
{
  model: "gpt-4o-mini",
  temperature: 0.1,
  maxTokens: 1000,
  systemPrompt: PROPOSAL_SYSTEM_PROMPT,
  outputSchema: ProposalResultSchema,
  escalation: {
    condition: (result) => result.confidence < 0.6 || result.ambiguity?.options.length > 3,
    model: "gpt-4o",
  },
}
```

**Output:** `ProposalResult` patched to `into` path.

### 6.4 translator.fastPath

```typescript
interface FastPathEffect {
  (params: {
    canonical: string;
    tokens: Token[];
    glossaryHits: GlossaryHit[];
    schemaId: string;
    into: Path;
  }): Promise<void>;
}
```

**Behavior:**
1. Match canonical against registered patterns
2. If match found, construct `PatchFragment`
3. If no match, return `{ matched: false }`

**Output:** `FastPathResult` patched to `into` path.

### 6.5 translator.retrieve

```typescript
interface RetrieveEffect {
  (params: {
    terms: Token[];
    glossaryHits: GlossaryHit[];
    schemaId: string;
    maxCandidates: number;
    into: Path;
  }): Promise<void>;
}
```

**Behavior:**
1. Query retrieval tier (0, 1, or 2)
2. Score and rank candidates
3. Return top N candidates

**Output:** `RetrievalResult` patched to `into` path.

---

## 7. Normalization

### 7.1 Purpose

Normalization transforms raw multilingual input into canonical English form with protected tokens.

### 7.2 Input

```typescript
interface NormalizationInput {
  text: string;           // Raw user input
  languageHint?: string;  // Optional language hint (ISO 639-1)
}
```

### 7.3 Output

```typescript
interface NormalizationResult {
  canonical: string;           // Canonical English form
  language: string;            // Detected language (ISO 639-1)
  tokens: Token[];             // Tokenized form
  glossaryHits: GlossaryHit[]; // Matched glossary entries
  protected: ProtectedSpan[];  // Spans not to modify
}
```

### 7.4 Process

1. **Language Detection**: Identify input language
2. **Token Protection**: Mark identifiers, numbers, operators
3. **Glossary Matching**: Find known terms (see §12)
4. **Canonicalization**: Convert to English with glossary terms replaced

### 7.5 Examples

| Input | Language | Canonical |
|-------|----------|-----------|
| `나이가 18세 이상이어야 해` | ko | `User.age gte 18` |
| `email is required` | en | `User.email required` |
| `le nom doit avoir au moins 2 caractères` | fr | `User.name minLen 2` |

---

## 8. Fast Path

### 8.1 Purpose

Fast Path handles common patterns **without any LLM call**, providing:

- Zero latency
- Zero cost
- Deterministic behavior

### 8.2 Pattern Grammar

See [Appendix C](#appendix-c-fast-path-pattern-grammar) for full BNF.

### 8.3 Built-in Patterns

#### 8.3.1 Comparator Pattern

```
<anchor> <op> <number>

Where:
  <anchor> = semantic path (e.g., User.age)
  <op>     = gte | lte | gt | lt | eq | neq
  <number> = numeric literal
```

**Applicable to:** `baseKind = 'number'`

**Examples:**
- `User.age gte 18` → `{ kind: 'constraint', path: 'User.age', expr: gte(get('User.age'), 18) }`

#### 8.3.2 Range Pattern

```
<anchor> between <min> and <max>
```

**Applicable to:** `baseKind = 'number'`

**Examples:**
- `User.age between 18 and 65`

#### 8.3.3 Length Pattern

```
<anchor> minLen <number>
<anchor> maxLen <number>
<anchor> len <op> <number>
```

**Applicable to:** `baseKind = 'string' | 'array'`

**Examples:**
- `User.password minLen 8`
- `Order.items maxLen 100`

#### 8.3.4 Inclusion Pattern

```
<anchor> in [<values>]
<anchor> notIn [<values>]
```

**Applicable to:** Any type

**Examples:**
- `Order.status in [pending, active, done]`

#### 8.3.5 Required Pattern

```
<anchor> required
<anchor> optional
```

**Applicable to:** Any type

**Examples:**
- `User.email required`

#### 8.3.6 Boolean Pattern

```
<anchor> must be true
<anchor> must be false
```

**Applicable to:** `baseKind = 'boolean'`

### 8.4 Pattern Matching Algorithm

```typescript
function matchFastPath(
  canonical: string,
  tokens: Token[],
  typeIndex: TypeIndex
): FastPathResult {
  // 1. Extract anchor from tokens
  const anchor = extractAnchor(tokens);
  if (!anchor) return { matched: false };
  
  // 2. Get type info for anchor
  const resolvedType = typeIndex[anchor];
  
  // 3. Select applicable patterns
  const patterns = selectPatterns(resolvedType?.baseKind);
  
  // 4. Try each pattern
  for (const pattern of patterns) {
    const match = pattern.match(canonical, tokens);
    if (match) {
      return {
        matched: true,
        pattern: pattern.name,
        fragment: match.fragment,
        confidence: 1.0,  // Fast Path is always high confidence
      };
    }
  }
  
  return { matched: false, pattern: null, fragment: null, confidence: 0 };
}
```

---

## 9. Retrieval

### 9.1 Purpose

Retrieval finds relevant schema anchors for the translation query.

### 9.2 Tiers

| Tier | Name | Requirements | Capability |
|------|------|--------------|------------|
| 0 | OSS Baseline | None | BM25 + alias table |
| 1 | Enhanced | Local vector DB | Semantic similarity |
| 2 | Managed | Cloud vector service | Best semantic matching |

**Tier 0 is REQUIRED.** Higher tiers are OPTIONAL enhancements.

### 9.3 Tier 0 Implementation

#### 9.3.1 Alias Table

Built from Glossary entries:

```typescript
type AliasTable = Map<string, SemanticPath[]>;

// Example
{
  "age": ["User.age", "Profile.age"],
  "나이": ["User.age", "Profile.age"],
  "email": ["User.email"],
  "이메일": ["User.email"],
}
```

#### 9.3.2 BM25 Scoring

Standard BM25 over:
- Field names
- Field descriptions
- Glossary aliases

#### 9.3.3 Scoring Formula

```
score(candidate) = 
  0.4 * bm25_score +
  0.3 * alias_match_score +
  0.2 * type_match_score +
  0.1 * recency_score
```

### 9.4 Candidate Format

```typescript
interface AnchorCandidate {
  path: string;                          // Semantic path
  score: number;                         // 0.0 - 1.0
  matchType: "exact" | "alias" | "fuzzy" | "semantic";
  typeHint: TypeExpr | null;             // Type info for AI
}
```

---

## 10. Proposal

### 10.1 Purpose

Proposal generates a `PatchFragment` from canonical input and anchor candidates.

### 10.2 Input

```typescript
interface ProposalInput {
  canonical: string;
  tokens: Token[];
  candidates: AnchorCandidate[];
  schemaId: string;
  timeoutMs: number;
  fallbackBehavior: "guess" | "discard";
}
```

### 10.3 Output

```typescript
interface ProposalResult {
  /** Generated fragment (null if ambiguous) */
  fragment: PatchFragment | null;
  
  /** Ambiguity report (null if unambiguous) */
  ambiguity: AmbiguityReport | null;
  
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  
  /** LLM reasoning (for debugging) */
  reasoning: string | null;
}
```

### 10.4 Ambiguity Detection

Proposal MUST return `ambiguity` when:

| Condition | Ambiguity Kind |
|-----------|----------------|
| Top 2 candidates within 0.1 score | `anchor` |
| Intent unclear (add vs. modify) | `intent` |
| Value unclear ("big" for number) | `value` |
| Conflicts with existing constraint | `conflict` |

### 10.5 AmbiguityReport

```typescript
interface AmbiguityReport {
  kind: "anchor" | "intent" | "value" | "conflict";
  question: string;
  options: ResolutionOption[];
  fallbackBehavior: "guess" | "discard";
  expiresAt: number | null;
}

interface ResolutionOption {
  id: string;
  label: string;
  fragment: PatchFragment;
  confidence: number;
}
```

### 10.6 LLM Untrusted

LLM output MUST be validated before acceptance:

- Path exists in schema
- Type is compatible
- Expression parses correctly
- No conflicts with invariants

Invalid proposals MUST be rejected with error, not silently fixed.

---

## 11. Ambiguity Resolution

### 11.1 Overview

Ambiguity resolution uses **standard Manifesto pattern**: State → Computed → Action → Bridge.

No special system is required.

### 11.2 Detection

```mel
computed needsResolution = and(
  hasProposal,
  isNotNull(proposal.ambiguity),
  isNull(result)
)
```

### 11.3 Resolution Action

```mel
action resolve(selection: ResolutionSelection)
  available when needsResolution { ... }
```

### 11.4 Timeout Fallback

```mel
computed resolutionExpired = and(
  needsResolution,
  isNotNull(proposal.ambiguity.expiresAt),
  gte($meta.timestamp, proposal.ambiguity.expiresAt)
)

when resolutionExpired {
  // Apply fallback behavior (guess or discard)
}
```

### 11.5 Bridge Integration

```typescript
// Subscribe to observe ambiguity
bridge.subscribe((snapshot) => {
  if (snapshot.computed.needsResolution) {
    const { ambiguity } = snapshot.data.proposal;
    presentAmbiguityDialog(ambiguity);
  }
});

// Dispatch resolution
bridge.dispatch({
  type: "translator.resolve",
  input: { decision: "select", optionId: "opt-1" }
});
```

---

## 12. Glossary System

### 12.1 Purpose

Glossary provides **semantic mapping** between natural language terms and schema concepts.

### 12.2 Entry Format

```typescript
interface GlossaryEntry {
  /** Stable semantic identifier */
  readonly semanticId: string;
  
  /** Canonical English representation */
  readonly canonical: string;
  
  /** Aliases per language */
  readonly aliases: Record<LanguageCode, string[]>;
  
  /** Type hint for AI */
  readonly typeHint?: TypeExpr;
  
  /** Anchor hints for retrieval */
  readonly anchorHints?: SemanticPath[];
  
  /** Part of speech */
  readonly pos?: "noun" | "verb" | "adjective" | "adverb" | "operator";
}
```

### 12.3 Built-in Categories

| Category | Examples |
|----------|----------|
| Operators | `gte`, `lte`, `gt`, `lt`, `eq`, `neq` |
| Constraints | `required`, `optional`, `minLen`, `maxLen` |
| Actions | `add`, `remove`, `update`, `set` |
| Common Fields | `name`, `email`, `age`, `status` |

See [Appendix D](#appendix-d-built-in-glossary-entries) for complete list.

### 12.4 Resolution Order

1. Exact match to `semanticId`
2. Exact match to any `alias`
3. Fuzzy match to `canonical`
4. No match → unknown term

### 12.5 Custom Glossary

Users MAY provide custom glossary entries:

```typescript
const customGlossary: GlossaryEntry[] = [
  {
    semanticId: "domain.order.status",
    canonical: "Order.status",
    aliases: {
      ko: ["주문상태", "주문 상태", "오더상태"],
      en: ["order status", "order state"],
    },
    anchorHints: ["Order.status"],
  },
];
```

---

## 13. Bridge Integration

### 13.1 Standard Pattern

Translator uses standard Bridge pattern for all external interaction:

```typescript
const bridge = createBridge({
  world,
  schemaHash: world.schemaHash,
  defaultActor: { actorId: "user", kind: "human" },
});
```

### 13.2 Projections

#### 13.2.1 Translation Projection

```typescript
bridge.registerProjection({
  projectionId: "translator:translate",
  project(req) {
    if (req.source.payload?.action === "translate") {
      return {
        kind: "intent",
        body: {
          type: "translator.translate",
          input: {
            input: req.source.payload.text,
            schemaId: req.source.payload.schemaId,
            options: req.source.payload.options,
          },
        },
      };
    }
    return { kind: "none" };
  },
});
```

#### 13.2.2 Resolution Projection

```typescript
bridge.registerProjection({
  projectionId: "translator:resolve",
  project(req) {
    if (req.source.payload?.action === "resolve") {
      return {
        kind: "intent",
        body: {
          type: "translator.resolve",
          input: req.source.payload.selection,
        },
      };
    }
    return { kind: "none" };
  },
});
```

### 13.3 Subscription Patterns

#### 13.3.1 Progress Observer

```typescript
bridge.subscribe((snapshot) => {
  const { currentStage, progress } = snapshot.computed;
  updateProgressUI(currentStage, progress);
});
```

#### 13.3.2 Result Observer

```typescript
bridge.subscribe((snapshot) => {
  if (snapshot.computed.isComplete) {
    const { result } = snapshot.data;
    handleResult(result);
  }
});
```

#### 13.3.3 Ambiguity Observer

```typescript
bridge.subscribe((snapshot) => {
  if (snapshot.computed.needsResolution) {
    const { ambiguity } = snapshot.data.proposal;
    showResolutionDialog(ambiguity);
  }
});
```

---

## 14. Validation Rules

### 14.1 Domain Validation

| Rule | Description |
|------|-------------|
| V-001 | All state fields MUST use named types |
| V-002 | All patch/effect MUST be inside guards |
| V-003 | `once()` marker patch MUST be first in guard |
| V-004 | State reads MUST wait for next cycle after patch |
| V-005 | `available` conditions MUST be pure expressions |

### 14.2 Fragment Validation

| Rule | Description |
|------|-------------|
| V-101 | Path MUST exist in target schema |
| V-102 | Value type MUST be compatible with field type |
| V-103 | Expression MUST parse without error |
| V-104 | Constraint MUST NOT conflict with existing |
| V-105 | Fragment MUST NOT violate schema invariants |

### 14.3 Effect Validation

| Rule | Description |
|------|-------------|
| V-201 | `into` path MUST exist in state |
| V-202 | Effect output type MUST match state field type |
| V-203 | Protocol MUST be registered in Host |

---

## 15. API Reference

### 15.1 Domain Actions

| Action | Input | Available When |
|--------|-------|----------------|
| `translate` | `(input, schemaId, options?)` | `not(hasRequest)` |
| `resolve` | `(selection)` | `needsResolution` |
| `reset` | none | `isComplete` |

### 15.2 Computed Properties

| Computed | Type | Description |
|----------|------|-------------|
| `hasRequest` | `boolean` | Request initialized |
| `isNormalized` | `boolean` | Normalization complete |
| `hasFastPath` | `boolean` | Fast path evaluated |
| `fastPathSucceeded` | `boolean` | Fast path found match |
| `needsSlm` | `boolean` | SLM path required |
| `hasRetrieval` | `boolean` | Retrieval complete |
| `hasProposal` | `boolean` | Proposal complete |
| `needsResolution` | `boolean` | Ambiguity awaiting resolution |
| `resolutionExpired` | `boolean` | Resolution timed out |
| `isComplete` | `boolean` | Translation finished |
| `currentStage` | `string` | Current pipeline stage |
| `progress` | `number` | Progress 0.0-1.0 |

### 15.3 State Fields

| Field | Type | Description |
|-------|------|-------------|
| `request` | `TranslationRequest \| null` | Current request |
| `normalization` | `NormalizationResult \| null` | Normalization output |
| `fastPath` | `FastPathResult \| null` | Fast path output |
| `retrieval` | `RetrievalResult \| null` | Retrieval output |
| `proposal` | `ProposalResult \| null` | Proposal output |
| `result` | `TranslationResult \| null` | Final result |

---

## Appendix A: Complete MEL Definition

```mel
import { Token, GlossaryHit } from "@manifesto/core"
import { PatchFragment } from "@manifesto/translator-types"

domain Translator {
  
  // ═══════════════════════════════════════════════════════════════════
  // Types
  // ═══════════════════════════════════════════════════════════════════
  
  type TranslationOptions = {
    language: string | null
    maxCandidates: number
    timeoutMs: number
    fallbackBehavior: "guess" | "discard"
  }
  
  type TranslationRequest = {
    input: string
    targetSchemaId: string
    intentId: string
    options: TranslationOptions
  }
  
  type ProtectedSpan = {
    start: number
    end: number
    kind: "identifier" | "number" | "literal" | "operator"
    value: string
  }
  
  type NormalizationResult = {
    canonical: string
    language: string
    tokens: Array<Token>
    glossaryHits: Array<GlossaryHit>
    protected: Array<ProtectedSpan>
  }
  
  type FastPathResult = {
    matched: boolean
    pattern: string | null
    fragment: PatchFragment | null
    confidence: number
  }
  
  type AnchorCandidate = {
    path: string
    score: number
    matchType: "exact" | "alias" | "fuzzy" | "semantic"
  }
  
  type RetrievalResult = {
    tier: number
    candidates: Array<AnchorCandidate>
    queryTerms: Array<string>
  }
  
  type ResolutionOption = {
    id: string
    label: string
    fragment: PatchFragment
    confidence: number
  }
  
  type AmbiguityReport = {
    kind: "anchor" | "intent" | "value" | "conflict"
    question: string
    options: Array<ResolutionOption>
    fallbackBehavior: "guess" | "discard"
    expiresAt: number | null
  }
  
  type ProposalResult = {
    fragment: PatchFragment | null
    ambiguity: AmbiguityReport | null
    confidence: number
    reasoning: string | null
  }
  
  type TranslationResultFragment = {
    kind: "fragment"
    fragment: PatchFragment
  }
  
  type TranslationResultDiscarded = {
    kind: "discarded"
    reason: string
  }
  
  type ResolutionSelection = {
    decision: "select" | "discard" | "freeform"
    optionId: string | null
    freeformInput: string | null
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════
  
  state {
    request: TranslationRequest | null = null
    normalization: NormalizationResult | null = null
    fastPath: FastPathResult | null = null
    retrieval: RetrievalResult | null = null
    proposal: ProposalResult | null = null
    result: TranslationResultFragment | TranslationResultDiscarded | null = null
    
    initializing: string | null = null
    normalizing: string | null = null
    fastPathing: string | null = null
    retrieving: string | null = null
    proposing: string | null = null
    resolving: string | null = null
    resetting: string | null = null
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════════════════════════════════
  
  computed hasRequest = isNotNull(request)
  computed isNormalized = isNotNull(normalization)
  computed hasFastPath = isNotNull(fastPath)
  computed hasRetrieval = isNotNull(retrieval)
  computed hasProposal = isNotNull(proposal)
  computed isComplete = isNotNull(result)
  
  computed fastPathSucceeded = and(hasFastPath, fastPath.matched)
  computed needsSlm = and(hasFastPath, not(fastPath.matched))
  
  computed needsResolution = and(
    hasProposal,
    isNotNull(proposal.ambiguity),
    isNull(result)
  )
  
  computed resolutionExpired = and(
    needsResolution,
    isNotNull(proposal.ambiguity.expiresAt),
    gte($meta.timestamp, proposal.ambiguity.expiresAt)
  )
  
  computed currentStage = cond(
    not(hasRequest), "idle",
    cond(not(isNormalized), "normalizing",
    cond(not(hasFastPath), "fast-path",
    cond(and(needsSlm, not(hasRetrieval)), "retrieving",
    cond(and(needsSlm, not(hasProposal)), "proposing",
    cond(needsResolution, "awaiting-resolution",
    "complete"))))))
  
  computed progress = cond(
    not(hasRequest), 0.0,
    cond(not(isNormalized), 0.2,
    cond(not(hasFastPath), 0.4,
    cond(fastPathSucceeded, 1.0,
    cond(not(hasRetrieval), 0.6,
    cond(not(hasProposal), 0.8,
    1.0))))))
  
  // ═══════════════════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════════════════
  
  action translate(input: string, schemaId: string, options: TranslationOptions | null)
    available when not(hasRequest) {
    
    once(initializing) {
      patch initializing = $meta.intentId
      patch request = {
        input: input,
        targetSchemaId: schemaId,
        intentId: $meta.intentId,
        options: coalesce(options, {
          language: null,
          maxCandidates: 5,
          timeoutMs: 300000,
          fallbackBehavior: "guess"
        })
      }
    }
    
    once(normalizing) when hasRequest {
      patch normalizing = $meta.intentId
      effect llm.normalize({
        protocol: "translator.normalize",
        input: { text: request.input, languageHint: request.options.language },
        into: normalization
      })
    }
    
    once(fastPathing) when isNormalized {
      patch fastPathing = $meta.intentId
      effect translator.fastPath({
        canonical: normalization.canonical,
        tokens: normalization.tokens,
        glossaryHits: normalization.glossaryHits,
        schemaId: request.targetSchemaId,
        into: fastPath
      })
    }
    
    when and(isNull(result), fastPathSucceeded) {
      patch result = { kind: "fragment", fragment: fastPath.fragment }
    }
    
    once(retrieving) when needsSlm {
      patch retrieving = $meta.intentId
      effect translator.retrieve({
        terms: normalization.tokens,
        glossaryHits: normalization.glossaryHits,
        schemaId: request.targetSchemaId,
        maxCandidates: request.options.maxCandidates,
        into: retrieval
      })
    }
    
    once(proposing) when hasRetrieval {
      patch proposing = $meta.intentId
      effect llm.propose({
        protocol: "translator.propose",
        input: {
          canonical: normalization.canonical,
          tokens: normalization.tokens,
          candidates: retrieval.candidates,
          schemaId: request.targetSchemaId,
          timeoutMs: request.options.timeoutMs,
          fallbackBehavior: request.options.fallbackBehavior
        },
        into: proposal
      })
    }
    
    when and(isNull(result), hasProposal, isNull(proposal.ambiguity)) {
      patch result = { kind: "fragment", fragment: proposal.fragment }
    }
    
    when resolutionExpired {
      patch result = cond(
        eq(request.options.fallbackBehavior, "guess"),
        { kind: "fragment", fragment: proposal.ambiguity.options[0].fragment },
        { kind: "discarded", reason: "resolution timeout" }
      )
    }
  }
  
  action resolve(selection: ResolutionSelection)
    available when needsResolution {
    
    once(resolving) {
      patch resolving = $meta.intentId
      
      when eq(selection.decision, "select") {
        patch result = {
          kind: "fragment",
          fragment: findOption(proposal.ambiguity.options, selection.optionId).fragment
        }
      }
      
      when eq(selection.decision, "discard") {
        patch result = { kind: "discarded", reason: "user rejected" }
      }
      
      when eq(selection.decision, "freeform") {
        patch request = {
          input: selection.freeformInput,
          targetSchemaId: request.targetSchemaId,
          intentId: $meta.intentId,
          options: request.options
        }
        patch normalization = null
        patch fastPath = null
        patch retrieval = null
        patch proposal = null
        patch initializing = null
        patch normalizing = null
        patch fastPathing = null
        patch retrieving = null
        patch proposing = null
      }
    }
  }
  
  action reset()
    available when isComplete {
    
    once(resetting) {
      patch resetting = $meta.intentId
      patch request = null
      patch normalization = null
      patch fastPath = null
      patch retrieval = null
      patch proposal = null
      patch result = null
      patch initializing = null
      patch normalizing = null
      patch fastPathing = null
      patch retrieving = null
      patch proposing = null
      patch resolving = null
    }
  }
}
```

---

## Appendix B: TypeScript Type Definitions

```typescript
// Core types
export type SemanticPath = string;
export type LanguageCode = string;

// Token
export interface Token {
  readonly text: string;
  readonly pos: string;
  readonly lemma: string;
  readonly index: number;
}

// GlossaryHit
export interface GlossaryHit {
  readonly semanticId: string;
  readonly canonical: string;
  readonly matchedAlias: string;
  readonly confidence: number;
}

// PatchFragment
export interface PatchFragment {
  readonly fragmentId: string;
  readonly sourceIntentId: string;
  readonly description: string;
  readonly change: FragmentChange;
  readonly confidence: number;
  readonly evidence: readonly string[];
}

// FragmentChange
export type FragmentChange =
  | FragmentPatch
  | FragmentConstraint
  | FragmentAddField
  | FragmentRemoveField
  | FragmentAddComputed
  | FragmentAddType
  | FragmentSetFieldType;

export interface FragmentPatch {
  readonly kind: 'patch';
  readonly path: SemanticPath;
  readonly op: 'set' | 'merge' | 'remove';
  readonly value: ExprNode;
}

export interface FragmentConstraint {
  readonly kind: 'constraint';
  readonly path: SemanticPath;
  readonly expr: ExprNode;
  readonly message?: string;
}

export interface FragmentAddField {
  readonly kind: 'addField';
  readonly path: SemanticPath;
  readonly type: TypeExpr;
  readonly default?: unknown;
}

export interface FragmentRemoveField {
  readonly kind: 'removeField';
  readonly path: SemanticPath;
}

export interface FragmentAddComputed {
  readonly kind: 'addComputed';
  readonly name: string;
  readonly expr: ExprNode;
  readonly deps: readonly SemanticPath[];
}

export interface FragmentAddType {
  readonly kind: 'addType';
  readonly name: string;
  readonly typeExpr: TypeExpr;
  readonly description?: string;
}

export interface FragmentSetFieldType {
  readonly kind: 'setFieldType';
  readonly path: SemanticPath;
  readonly typeExpr: TypeExpr;
  readonly migrateValue?: ExprNode;
}

// ExprNode (MEL v0.3.3 call-only IR)
export type ExprNode =
  | { kind: 'lit'; value: null | boolean | number | string }
  | { kind: 'var'; name: 'item' }
  | { kind: 'sys'; path: string[] }
  | { kind: 'get'; path: PathNode }
  | { kind: 'get'; base: ExprNode; path: PathNode }
  | { kind: 'call'; fn: string; args: ExprNode[] }
  | { kind: 'obj'; fields: { key: string; value: ExprNode }[] }
  | { kind: 'arr'; elements: ExprNode[] };

export type PathNode =
  | { kind: 'name'; name: string }
  | { kind: 'index'; index: number }
  | { kind: 'chain'; segments: PathNode[] };

// TypeExpr
export type TypeExpr =
  | { kind: 'primitive'; name: 'string' | 'number' | 'boolean' | 'null' }
  | { kind: 'literal'; value: string | number }
  | { kind: 'ref'; name: string }
  | { kind: 'union'; members: readonly TypeExpr[] }
  | { kind: 'array'; element: TypeExpr }
  | { kind: 'record'; key: TypeExpr; value: TypeExpr }
  | { kind: 'object'; fields: readonly ObjectTypeField[] };

export interface ObjectTypeField {
  readonly name: string;
  readonly type: TypeExpr;
  readonly optional: boolean;
}

// ResolvedType
export interface ResolvedType {
  readonly resolved: TypeExpr;
  readonly sourceName?: string;
  readonly nullable: boolean;
  readonly baseKind: 'string' | 'number' | 'boolean' | 'null' 
                   | 'array' | 'record' | 'object' | 'union';
}

// TypeIndex
export type TypeIndex = Readonly<Record<SemanticPath, ResolvedType>>;
```

---

## Appendix C: Fast Path Pattern Grammar

```ebnf
(* Fast Path Pattern Grammar *)

Pattern       = ComparatorPat | RangePat | LengthPat | InclusionPat 
              | RequiredPat | BooleanPat ;

ComparatorPat = Anchor , CompOp , Number ;
RangePat      = Anchor , "between" , Number , "and" , Number ;
LengthPat     = Anchor , LengthOp , Number ;
InclusionPat  = Anchor , InclusionOp , "[" , ValueList , "]" ;
RequiredPat   = Anchor , RequiredOp ;
BooleanPat    = Anchor , "must" , "be" , BoolValue ;

Anchor        = Identifier , { "." , Identifier } ;
Identifier    = Letter , { Letter | Digit | "_" } ;

CompOp        = "gte" | "lte" | "gt" | "lt" | "eq" | "neq" 
              | ">=" | "<=" | ">" | "<" | "==" | "!=" ;

LengthOp      = "minLen" | "maxLen" | "len" , CompOp ;

InclusionOp   = "in" | "notIn" ;

RequiredOp    = "required" | "optional" ;

BoolValue     = "true" | "false" ;

Number        = [ "-" ] , Digit , { Digit } , [ "." , Digit , { Digit } ] ;

ValueList     = Value , { "," , Value } ;
Value         = String | Number | Identifier ;
String        = '"' , { Character } , '"' 
              | "'" , { Character } , "'" ;

Letter        = "A" | ... | "Z" | "a" | ... | "z" ;
Digit         = "0" | ... | "9" ;
Character     = (* any printable character except quote *) ;
```

---

## Appendix D: Built-in Glossary Entries

### D.1 Operators

| semanticId | canonical | ko | en |
|------------|-----------|----|----|
| `op.gte` | `gte` | 이상, 크거나 같음 | at least, greater than or equal |
| `op.lte` | `lte` | 이하, 작거나 같음 | at most, less than or equal |
| `op.gt` | `gt` | 초과, 보다 큼 | greater than, more than |
| `op.lt` | `lt` | 미만, 보다 작음 | less than |
| `op.eq` | `eq` | 같음, 동일 | equal, same as |
| `op.neq` | `neq` | 다름, 같지 않음 | not equal, different |

### D.2 Constraints

| semanticId | canonical | ko | en |
|------------|-----------|----|----|
| `constraint.required` | `required` | 필수, 반드시 | required, must have |
| `constraint.optional` | `optional` | 선택, 옵션 | optional |
| `constraint.minLen` | `minLen` | 최소길이, 최소 글자 | minimum length |
| `constraint.maxLen` | `maxLen` | 최대길이, 최대 글자 | maximum length |
| `constraint.between` | `between` | 사이, 범위 | between, range |

### D.3 Actions

| semanticId | canonical | ko | en |
|------------|-----------|----|----|
| `action.add` | `add` | 추가, 더하다 | add, create |
| `action.remove` | `remove` | 제거, 삭제 | remove, delete |
| `action.update` | `update` | 수정, 변경 | update, modify |
| `action.set` | `set` | 설정 | set |

### D.4 Common Fields

| semanticId | canonical | ko | en |
|------------|-----------|----|----|
| `field.name` | `name` | 이름 | name |
| `field.email` | `email` | 이메일 | email |
| `field.age` | `age` | 나이, 연령 | age |
| `field.status` | `status` | 상태 | status |
| `field.id` | `id` | 아이디, 식별자 | id, identifier |

---

## Appendix E: Example Scenarios

### E.1 Simple Constraint (Fast Path)

**Input:** `"나이가 18세 이상이어야 해"` (Korean)

**Pipeline:**

1. **Normalize:**
   ```
   canonical: "User.age gte 18"
   language: "ko"
   glossaryHits: [
     { semanticId: "field.age", canonical: "age" },
     { semanticId: "op.gte", canonical: "gte" }
   ]
   ```

2. **Fast Path:** ✅ Match (Comparator Pattern)
   ```
   matched: true
   pattern: "comparator"
   fragment: {
     kind: "constraint",
     path: "User.age",
     expr: { kind: "call", fn: "gte", args: [...] }
   }
   ```

3. **Result:** Direct to result (no SLM needed)

### E.2 Ambiguous Anchor

**Input:** `"나이를 확인해줘"` (Korean)

**Pipeline:**

1. **Normalize:**
   ```
   canonical: "check age"
   language: "ko"
   ```

2. **Fast Path:** ❌ No match

3. **Retrieve:**
   ```
   candidates: [
     { path: "User.age", score: 0.85 },
     { path: "Profile.age", score: 0.82 }
   ]
   ```

4. **Propose:**
   ```
   ambiguity: {
     kind: "anchor",
     question: "Which 'age' field did you mean?",
     options: [
       { id: "opt-1", label: "User.age", ... },
       { id: "opt-2", label: "Profile.age", ... }
     ]
   }
   ```

5. **needsResolution:** `true`

6. **Bridge subscriber** presents dialog

7. **User resolves:**
   ```
   bridge.dispatch({
     type: "translator.resolve",
     input: { decision: "select", optionId: "opt-1" }
   })
   ```

8. **Result:** Fragment with User.age

### E.3 Timeout Fallback

**Input:** Complex query with ambiguity

**Pipeline:**
1. ... (same as E.2 until ambiguity)
2. No resolution within `timeoutMs`
3. `resolutionExpired` becomes `true`
4. Domain applies `fallbackBehavior`:
    - `"guess"`: Select `options[0]` (highest confidence)
    - `"discard"`: Result = `{ kind: "discarded", reason: "timeout" }`

---

*End of Specification*
