# Manifesto Intent IR Specification v0.1

> **Status:** Draft  
> **Version:** 0.1.0  
> **Authors:** Manifesto Contributors  
> **License:** MIT  
> **Companion:** FDR-INT-* (Foundational Design Rationale)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Normative Language](#2-normative-language)
3. [Core Philosophy](#3-core-philosophy)
4. [Axioms](#4-axioms)
5. [Architecture Decisions](#5-architecture-decisions)
6. [Functional Heads (Core Vocabulary)](#6-functional-heads-core-vocabulary)
7. [IntentIR Structure](#7-intentir-structure)
8. [Term Types](#8-term-types)
9. [Condition (Predicate)](#9-condition-predicate)
10. [Auxiliary Specifications](#10-auxiliary-specifications)
11. [Canonicalization Rules](#11-canonicalization-rules)
12. [Key System](#12-key-system)
13. [Lowering (IntentIR → IntentBody)](#13-lowering)
14. [Feature Checking](#14-feature-checking)
15. [Zod Schema (Reference Implementation)](#15-zod-schema-reference-implementation)
16. [TypeScript Definitions (Informative)](#16-typescript-definitions-informative)
17. [JSON Schema](#17-json-schema)
18. [Examples](#18-examples)
19. [Extension Points](#19-extension-points)
20. [Versioning](#20-versioning)

---

## 1. Introduction

### 1.1 What is Intent IR?

Intent IR is a **Chomskyan LF(Logical Form)-based Intermediate Representation** for natural language intent. It provides:

- A **deterministic and verifiable LF structure** derived from natural language (PF)
- **Type/selectional restriction checking** via Lexicon (Manifesto Schema/Action spec)
- **Normalizable** structure where equivalent meanings converge to identical forms
- **Coordinate-ready** representation for semantic retrieval and caching

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Natural Language (PF)  ───────────►  Intent IR (LF)  ───────►  IntentBody │
│   "주문 취소해"                         Semantic Structure      (Protocol)   │
│   "Cancel my order"                    (language-independent)              │
│   "取消订单"                                                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 What Intent IR is NOT

Intent IR is NOT:

- A natural language generation system (surface form generation is out of scope)
- A general-purpose NLP framework
- An execution plan or runtime instruction
- A database query language
- A replacement for IntentBody (Intent IR lowers to IntentBody; MEL/Patch is downstream compiler concern)

### 1.3 Design Goals

| Goal | Description |
|------|-------------|
| **Language Independence** | Same meaning from any human language yields identical IR |
| **Deterministic Canonicalization** | Equivalent intents produce identical serializations |
| **Lexicon Verifiability** | IR validity is checkable against domain schema |
| **Coordinate Readiness** | IR can be transformed into semantic coordinates (StrictKey/SimKey) |
| **Minimal Expressiveness** | Smallest set of constructs that covers domain intent space |

### 1.4 Theoretical Foundation

Intent IR is grounded in **Chomsky's Minimalist Program**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Chomskyan Architecture                              │
│                                                                         │
│   PF (Phonetic Form)  ◄────  Syntax  ────►  LF (Logical Form)          │
│   "surface utterance"                        "semantic structure"       │
│                                                                         │
│   Intent IR = LF                                                        │
│   - Structure (heads + arguments + features) IS meaning                 │
│   - Lexicon provides feature checking for grammaticality                │
│   - Same LF = Same meaning (regardless of surface form)                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

---

## 3. Core Philosophy

### 3.1 The Intent IR Constitution

```
1. Structure is meaning. Not strings, not tokens—structured heads and arguments.
2. Lexicon is the arbiter. Validity is determined by feature checking against Lexicon.
3. Same meaning, same form. Canonicalization ensures semantic equivalence = structural equivalence.
4. IR is intent, not plan. Execution strategy is downstream concern.
5. Functional heads are finite. Fixed set of heads bounds the semantic space.
6. Terms are typed. Every argument slot has selectional restrictions.
7. Extension is namespaced. Future additions MUST NOT break existing structure.
```

### 3.2 Functional Projection Hierarchy

Intent IR uses a fixed hierarchy of **functional heads** derived from linguistic theory:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Functional Projection Hierarchy                     │
│                                                                         │
│   ForceP ─── Illocutionary force (ASK/DO/VERIFY/CONFIRM/CLARIFY)       │
│      │                                                                  │
│   ModP ──── Modality (MUST/SHOULD/MAY/FORBID)                          │
│      │                                                                  │
│   TP ────── Temporal specification (NOW/AT/BEFORE/AFTER/WITHIN)        │
│      │                                                                  │
│   EventP ── Event/operation type (lemma + class)                       │
│      │                                                                  │
│   RoleP ─── θ-role arguments (TARGET/THEME/SOURCE/DEST/...)            │
│      │                                                                  │
│   VerifyP ─ Verification contract (NONE/TEST/PROOF/CITATION/...)       │
│      │                                                                  │
│   OutP ──── Output contract (number/expression/proof/plan/code/...)    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 The Semantic Triangle

```
                        Intent IR (LF)
                             ▲
                            / \
                           /   \
                          /     \
                         /       \
            Natural Language    Lexicon (Schema)
                 (PF)          (Selectional Restrictions)
```

- **PF → LF**: Parsing/extraction (may involve LLM)
- **Lexicon → LF**: Feature checking (deterministic)
- **LF → downstream**: Lowering to IntentBody (deterministic)

---

## 4. Axioms

```
A1. Intent IR represents semantic intent, not execution plan. [v0.1]
A2. Functional heads are enumerated and finite. [v0.1]
A3. Same canonical form implies same semantic intent. [v0.1]
A4. Feature checking against Lexicon is decidable. [v0.1]
A5. Term types are discriminated and exhaustive for v0.1 scope. [v0.1]
A6. Conditions in v0.1 are AND-only; OR/NOT are extension points. [v0.1]
A7. Extension keys MUST be namespaced to prevent collision. [v0.1]
A8. Determinism boundary: Only PF→IR MAY be non-deterministic. [v0.1]
```

**A8 Clarification (Determinism Boundary):**

| Phase | Determinism | Notes |
|-------|-------------|-------|
| PF → IntentIR | MAY non-deterministic | LLM/Translator involved |
| Validation | MUST deterministic | Schema checking |
| Canonicalization | MUST deterministic | Structural normalization |
| Feature Checking | MUST deterministic | Lexicon lookup |
| Key Derivation | MUST deterministic | Hash computation |
| Lowering | MUST deterministic | IntentBody generation |
| Reference Resolution | MUST deterministic | this/that/last → id |

---

## 5. Architecture Decisions

### AD-INT-001: LF-Based Semantic Representation

**Decision:** Intent IR adopts Chomskyan LF as the theoretical foundation for semantic representation.

**Rationale:**
- LF provides language-independent meaning representation
- Functional heads create bounded, verifiable structure
- Feature checking maps naturally to type systems
- Well-studied theoretical foundation with decades of research

### AD-INT-002: Functional Heads are Enumerated

**Decision:** All functional head values (Force, EventClass, Role, Modality, Time, VerifyMode, OutputType) MUST be enumerated in this specification.

**Rationale:**
- Enumeration enables exhaustive pattern matching
- Bounds the semantic space for deterministic processing
- Prevents unbounded vocabulary drift
- Extension happens via `ext` field, not new head values

### AD-INT-003: AND-Only Conditions in v0.1

**Decision:** The `cond` field represents AND-conjunction only. OR, NOT, and nested boolean logic are deferred to v0.2+.

**Rationale:**
- AND-only conditions are trivially normalizable (sort predicates)
- OR introduces disjunctive normal form complexity
- NOT requires careful scope handling
- Covers majority of practical use cases

### AD-INT-004: Term is Discriminated Union

**Decision:** Term types form a closed discriminated union with `kind` discriminator.

**Rationale:**
- Exhaustive pattern matching in consumers
- Clear serialization/deserialization
- Type-safe processing
- Explicit extension path via new `kind` values

### AD-INT-005: Value Terms Use Shape, Not Raw

**Decision:** ValueTerm stores semantic `shape` (features/buckets) rather than raw values for canonicalization.

**Rationale:**
- Raw values defeat coordinate-based caching ("5" vs "five" vs 5)
- Shape captures semantic equivalence class
- Raw is optional for execution contexts that need it
- Enables fuzzy matching and similarity computation

---

## 6. Functional Heads (Core Vocabulary)

### 6.1 Force

Force represents the **illocutionary force** of the utterance—what the speaker intends to accomplish.

| Value | Description | Typical Surface Forms |
|-------|-------------|----------------------|
| `ASK` | Request information | "what is...", "show me...", "...가 뭐야?" |
| `DO` | Request action execution | "do...", "create...", "...해줘" |
| `VERIFY` | Request verification/validation | "check if...", "is it true...", "...맞아?" |
| `CONFIRM` | Request confirmation before proceeding | "are you sure...", "confirm...", "...할까?" |
| `CLARIFY` | Indicate need for clarification | (system-generated when info insufficient) |

**Normative:**
- Force MUST be exactly one of the enumerated values.
- `CLARIFY` is typically system-generated, not user-expressed.

### 6.2 EventClass

EventClass provides **coarse-grained categorization** of the event/operation type.

| Value | Description | Example Lemmas |
|-------|-------------|----------------|
| `OBSERVE` | Read/query/inspect | GET, LIST, SHOW, DESCRIBE |
| `TRANSFORM` | Modify existing entity | UPDATE, CHANGE, EDIT, MODIFY |
| `SOLVE` | Compute/derive/prove | CALCULATE, SOLVE, PROVE, DERIVE |
| `CREATE` | Generate new entity | CREATE, ADD, WRITE, GENERATE |
| `DECIDE` | Make choice/judgment | SELECT, CHOOSE, APPROVE, REJECT |
| `CONTROL` | Lifecycle/state control | START, STOP, CANCEL, ARCHIVE |

**Normative:**
- EventClass MUST be exactly one of the enumerated values.
- `event.lemma` provides fine-grained identification within the class.

**OBSERVE Class Interpretation:**

For `OBSERVE` class events (LIST, GET, SHOW, etc.), the TARGET role semantics are delegated to Lexicon:
- TARGET.entityType alone MAY indicate "collection" scope (e.g., "list all Users")
- TARGET.ref is OPTIONAL for collection queries; absence means "default/all scope"
- Specific ref (e.g., `{ kind: "id", id: "123" }`) narrows to single entity

This interpretation is NOT hardcoded in IR; Lexicon's `thetaFrame` defines required/optional roles per lemma.

### 6.3 Role (θ-roles)

Roles represent **thematic relations** between the event and its arguments.

| Role | Description | Example |
|------|-------------|---------|
| `TARGET` | Entity directly affected by action | "Cancel **the order**" |
| `THEME` | Content/subject matter | "Write about **winter**" |
| `SOURCE` | Origin point | "Copy from **this folder**" |
| `DEST` | Destination point | "Move to **archive**" |
| `INSTRUMENT` | Means/tool used | "Translate using **GPT-4**" |
| `BENEFICIARY` | Entity that benefits | "Create for **the client**" |

**Normative:**
- Roles MUST be exactly one of the enumerated values.
- In v0.1, each role maps to **exactly one Term** (not an array).
- Multiple Terms per role is deferred to v0.2+ (requires ListTerm and canonicalization rules).
- Required roles are determined by Lexicon (event-specific).

### 6.4 Modality

Modality expresses **deontic force**—obligation, permission, prohibition.

| Value | Description | Semantic Force |
|-------|-------------|----------------|
| `MUST` | Obligatory | Required, no alternative |
| `SHOULD` | Recommended | Preferred but not required |
| `MAY` | Permitted | Optional, allowed |
| `FORBID` | Prohibited | Must not occur |

**Normative:**
- Modality is OPTIONAL; default interpretation is `MAY`.
- Modality applies to the entire intent, not individual arguments.

### 6.5 Time

Time specifies **temporal constraints** on the event.

| Value | Description | Parameters |
|-------|-------------|------------|
| `NOW` | Immediate execution | None |
| `AT` | Specific point in time | `value`: ISO 8601 or relative reference |
| `BEFORE` | Must complete before | `value`: deadline reference |
| `AFTER` | Must start after | `value`: prerequisite reference |
| `WITHIN` | Duration constraint | `value`: duration specification |

**Normative:**
- Time is OPTIONAL; default interpretation is `NOW` or context-dependent.
- `value` field semantics depend on `kind`.

### 6.6 VerifyMode

VerifyMode specifies the **verification contract** for the output.

| Value | Description | Typical Use |
|-------|-------------|-------------|
| `NONE` | No verification required | Casual/low-stakes requests |
| `TEST` | Automated test verification | Code, calculations |
| `PROOF` | Formal proof required | Mathematical claims |
| `CITATION` | Source citation required | Factual claims |
| `RUBRIC` | Criteria-based evaluation | Creative content |
| `POLICY` | Policy compliance check | Sensitive operations |

**Normative:**
- VerifyMode is OPTIONAL; default is system-determined (often `POLICY`).
- `spec` field provides mode-specific parameters.

### 6.7 OutputType

OutputType specifies the **expected output format**.

| Value | Description |
|-------|-------------|
| `number` | Numeric result |
| `expression` | Mathematical/logical expression |
| `proof` | Formal proof structure |
| `explanation` | Natural language explanation |
| `summary` | Condensed summary |
| `plan` | Action plan/steps |
| `code` | Executable code |
| `text` | General text |
| `artifactRef` | Reference to external artifact |

**Normative:**
- OutputType is OPTIONAL.
- `format` field specifies serialization (markdown/json/latex/text).
- `constraints` field specifies additional requirements.

---

## 7. IntentIR Structure

### 7.1 Root Structure

```typescript
type IntentIR = {
  /** Version identifier. MUST be "0.1" for this specification. */
  v: "0.1";

  /** Illocutionary force. REQUIRED. */
  force: Force;

  /** Event specification. REQUIRED. */
  event: Event;

  /** θ-role arguments. REQUIRED (may be empty object). */
  args: Partial<Record<Role, Term>>;

  /** Condition predicates. OPTIONAL. AND-conjunction in v0.1. */
  cond?: Pred[];

  /** Modality. OPTIONAL. Default: MAY. */
  mod?: Modality;

  /** Temporal specification. OPTIONAL. Default: NOW or context. */
  time?: TimeSpec;

  /** Verification contract. OPTIONAL. Default: system-determined. */
  verify?: VerifySpec;

  /** Output specification. OPTIONAL. */
  out?: OutputSpec;

  /** Extension point. OPTIONAL. Keys SHOULD be namespaced. */
  ext?: Record<string, unknown>;
};
```

### 7.2 Event Structure

```typescript
type Event = {
  /** 
   * Canonical verb/event label. 
   * MUST resolve to a LexiconEntry at runtime.
   * Examples: "CANCEL", "SOLVE", "WRITE", "GET"
   */
  lemma: string;

  /** Coarse event classification. */
  class: EventClass;
};
```

**Normative:**
- `lemma` MUST be uppercase ASCII for canonical form.
- `lemma` MUST exist in the active Lexicon for valid IR.

---

## 8. Term Types

Term represents **argument values** in the semantic structure. Terms form a discriminated union.

### 8.1 Term Union

```typescript
type Term =
  | EntityRefTerm
  | PathRefTerm
  | ArtifactRefTerm
  | ValueTerm
  | ExprTerm;
```

### 8.2 EntityRefTerm

Reference to a domain entity.

```typescript
type EntityRefTerm = {
  kind: "entity";
  
  /** Entity type name. MUST exist in Lexicon. */
  entityType: string;
  
  /** 
   * Reference specification. 
   * OPTIONAL: absence means collection/default scope (e.g., "all users").
   */
  ref?: EntityRef;
};

type EntityRef = {
  /** Reference kind. */
  kind: "this" | "that" | "last" | "id";
  
  /** Explicit identifier. REQUIRED when kind="id". */
  id?: string;
};
```

| ref | Description | Example |
|-----|-------------|---------|
| (absent) | Collection/default scope | "list users", "모든 주문" |
| `{ kind: "this" }` | Currently focused entity | "this order", "이 주문" |
| `{ kind: "that" }` | Previously mentioned entity | "that one", "그거" |
| `{ kind: "last" }` | Most recent of type | "last order", "지난 주문" |
| `{ kind: "id", id: "..." }` | Explicit identifier | "order #123" |

**Discourse Resolution (NORMATIVE):**

When `ref.kind ≠ "id"`, the reference is **symbolic** at IR level:
- IntentIR represents the *intent to refer*, not the resolved identity
- A **Resolver** (deterministic, non-LLM) MUST resolve to `id` before execution
- Resolution uses: `Resolver(snapshot, focus, discourse) → id`

This separation ensures:
1. IR remains deterministic and cacheable
2. Resolution is reproducible given same context
3. LLM is not involved in reference resolution

### 8.3 PathRefTerm

Reference to a semantic path in the domain.

```typescript
type PathRefTerm = {
  kind: "path";
  
  /** 
   * Canonical path pattern.
   * MAY contain wildcards (*) for dynamic segments.
   * Example: "/orders/*/status", "state.user.email"
   */
  path: string;
};
```

### 8.4 ArtifactRefTerm

Reference to a document, formula, code, or data artifact.

```typescript
type ArtifactRefTerm = {
  kind: "artifact";
  
  /** Artifact type classification. */
  artifactType: "text" | "math" | "code" | "data" | "plan" | "mixed";
  
  /** Reference specification. */
  ref: ArtifactRef;
  
  /** Inline content. REQUIRED when ref.kind="inline". */
  content?: string;
};

type ArtifactRef = {
  kind: "inline" | "id";
  id?: string;
};
```

### 8.5 ValueTerm

Literal value with semantic shape.

```typescript
type ValueTerm = {
  kind: "value";
  
  /** Value type. */
  valueType: "string" | "number" | "boolean" | "date" | "enum" | "id";
  
  /** 
   * Semantic shape for canonicalization.
   * Contains features/buckets, NOT raw value.
   * Example: { range: "1-10", sign: "positive" } for numbers
   */
  shape: Record<string, unknown>;
  
  /** 
   * Raw value. OPTIONAL.
   * Present when exact value is needed for execution.
   */
  raw?: unknown;
};
```

**Shape Guidelines:**

| valueType | Shape Fields | Example |
|-----------|--------------|---------|
| `string` | `pattern`, `length`, `category` | `{ length: "short", category: "name" }` |
| `number` | `range`, `sign`, `magnitude` | `{ range: "1-100", sign: "positive" }` |
| `boolean` | `value` | `{ value: true }` |
| `date` | `relative`, `precision` | `{ relative: "past", precision: "day" }` |
| `enum` | `domain`, `value` | `{ domain: "status", value: "active" }` |

### 8.6 ExprTerm

Mathematical, logical, or code expression.

```typescript
type ExprTerm = {
  kind: "expr";
  
  /** Expression format. */
  exprType: "latex" | "ast" | "code";
  
  /** 
   * Expression content.
   * String for latex/code, structured object for ast.
   */
  expr: string | Record<string, unknown>;
};
```

**Cross-field constraints (MUST):**

| `exprType` | `expr` type |
|------------|-------------|
| `"latex"` | `string` |
| `"code"` | `string` |
| `"ast"` | `object` (Record) |

---

## 9. Condition (Predicate)

### 9.1 Predicate Structure

```typescript
type Pred = {
  /** 
   * Left-hand side: scoped path.
   * MUST use prefix to indicate scope (see LHS Grammar below).
   */
  lhs: string;
  
  /** Comparison operator. */
  op: PredOp;
  
  /** Right-hand side: value to compare against. */
  rhs: Term;
};

type PredOp = 
  | "=" | "!=" 
  | "<" | ">" | "<=" | ">=" 
  | "contains" | "startsWith" | "matches";
```

**LHS Grammar (NORMATIVE):**

LHS MUST be a scoped path with explicit prefix:

| Prefix | Scope | Example |
|--------|-------|---------|
| `target.` | TARGET arg entity | `target.status`, `target.createdAt` |
| `theme.` | THEME arg entity | `theme.amount` |
| `source.` | SOURCE arg entity | `source.path` |
| `dest.` | DEST arg entity | `dest.format`, `dest.language` |
| `state.` | World state path | `state.user.role`, `state.order.total` |
| `env.` | Environment variable | `env.region`, `env.mode` |
| `computed.` | Computed/derived value | `computed.age`, `computed.discount` |

> **Rationale**: Explicit scoping prevents ambiguity. `status` alone is ambiguous; `target.status` is not.

> **Note:** The `"in"` (membership) operator is deferred to v0.2+, which will introduce `ListTerm` to properly type the RHS as an array.

### 9.2 Condition Semantics (v0.1)

**Normative:**
- `cond` is an array of predicates.
- All predicates are AND-conjoined: `cond[0] AND cond[1] AND ... AND cond[n]`.
- OR, NOT, and parenthesized grouping are NOT supported in v0.1.
- Empty `cond` (or omitted) means no conditions (always true).

### 9.3 Operator Semantics

| Operator | Meaning | LHS Type | RHS Type |
|----------|---------|----------|----------|
| `=` | Equality | any | matching |
| `!=` | Inequality | any | matching |
| `<` | Less than | number/date | number/date |
| `>` | Greater than | number/date | number/date |
| `<=` | Less or equal | number/date | number/date |
| `>=` | Greater or equal | number/date | number/date |
| `contains` | Contains substring | string | string |
| `startsWith` | Prefix match | string | string |
| `matches` | Regex match | string | regex pattern |

**Deferred to v0.2+:**

| Operator | Meaning | Reason for Deferral |
|----------|---------|---------------------|
| `in` | Membership test | Requires `ListTerm` for proper RHS typing |

---

## 10. Auxiliary Specifications

### 10.1 TimeSpec

```typescript
type TimeSpec = {
  kind: "NOW" | "AT" | "BEFORE" | "AFTER" | "WITHIN";
  
  /** 
   * Time value. Interpretation depends on kind.
   * - AT: ISO 8601 datetime or relative reference
   * - BEFORE/AFTER: reference point
   * - WITHIN: duration (e.g., "1h", "30m", "7d")
   */
  value?: unknown;
};
```

### 10.2 VerifySpec

```typescript
type VerifySpec = {
  mode: "NONE" | "TEST" | "PROOF" | "CITATION" | "RUBRIC" | "POLICY";
  
  /** Mode-specific parameters. Schema varies by mode. */
  spec?: Record<string, unknown>;
};
```

### 10.3 OutputSpec

```typescript
type OutputSpec = {
  type: "number" | "expression" | "proof" | "explanation" 
      | "summary" | "plan" | "code" | "text" | "artifactRef";
  
  /** Serialization format. */
  format?: "markdown" | "json" | "latex" | "text";
  
  /** Additional constraints (length, tone, style, etc.). */
  constraints?: Record<string, unknown>;
};
```

---

## 11. Canonicalization Rules

### 11.1 Purpose

**Same meaning → Same bytes.**

Canonicalization removes representational non-determinism so that semantically equivalent IRs produce identical serialization.

### 11.2 Two Canonicalization Modes

| Mode | Purpose | `ValueTerm.raw` | Use Case |
|------|---------|-----------------|----------|
| **Semantic** | Similarity search, clustering | Removed | `simKey` generation |
| **Strict** | Exact reproduction, caching | Normalized (preserved) | `strictKey` generation |

```typescript
canonicalizeSemantic(ir: IntentIR): SemanticCanonicalIR  // raw removed
canonicalizeStrict(ir: IntentIR): StrictCanonicalIR     // raw normalized
```

### 11.3 Scope

| IN SCOPE | OUT OF SCOPE |
|----------|--------------|
| Structural normalization (ordering, empty fields, case) | Semantic interpretation ("Cancel" ≡ "취소") |
| | Expression equivalence (`x^2` ≡ `x*x`) |

### 11.4 MUST Rules (Both Modes)

#### 11.4.1 Root Level

| Field | Rule |
|-------|------|
| `event.lemma` | UPPERCASE ASCII, trim whitespace |
| `args` | Keys sorted lexicographically (RFC 8785) |
| `cond` | Sort predicates by tuple `(lhs, op, rhs.kind, canonicalize(rhs))` |
| Empty fields | Remove `{}` objects and `[]` arrays from optional fields |

> **Note**: ROLE_ORDER (`TARGET → THEME → ... → BENEFICIARY`) is for **display/pretty-print only**, not canonical serialization. Canonical form uses lexicographic order per RFC 8785.

#### 11.4.2 Term Canonicalization

| Term | Semantic Mode | Strict Mode |
|------|---------------|-------------|
| EntityRefTerm | If `ref` absent, preserve; if `ref.kind ≠ "id"`, remove `ref.id` | Same |
| ArtifactRefTerm | If `inline`, remove `ref.id`; if `id`, remove `content` | Same |
| ValueTerm | **Remove `raw`** | **Normalize `raw`** (see below) |
| ExprTerm | Content is opaque; sort keys if object | Same |
| PathRefTerm | Trim whitespace | Same |

**ValueTerm.raw Normalization (Strict Mode, NORMATIVE):**

| `valueType` | Normalization Rule |
|-------------|-------------------|
| `"string"` | Trim leading/trailing whitespace |
| `"number"` | JSON number (not string); no trailing zeros |
| `"boolean"` | JSON boolean (`true`/`false`) |
| `"date"` | ISO 8601 string (`YYYY-MM-DDTHH:mm:ss.sssZ`) |
| `"enum"` | Exact string match (case-sensitive) |
| `"id"` | String, trimmed |

#### 11.4.3 Serialization

Strictly follows RFC 8785 (JCS):
- Object keys: lexicographic order (UTF-16 code units)
- No exceptions (including `args`)
- No whitespace between tokens

> **Rationale**: Pure RFC 8785 compliance ensures cross-implementation byte equality. Custom exceptions would require test vectors and risk divergence.

### 11.5 Conformance

Implementations MUST satisfy:

```
canonicalize(canonicalize(ir)) === canonicalize(ir)  // Idempotent
canonicalize({cond: [A, B]}) === canonicalize({cond: [B, A]})  // Order invariant
```

### 11.6 Extension Points (v0.2+)

- ListTerm + `in` operator
- OR/NOT conditions
- Lexicon-aware normalization (lemma aliases)
- Expression canonicalizer plugins

---

## 12. Key System

### 12.1 Three Key Types

Intent IR defines three distinct key types for different purposes:

| Key | Purpose | Derivation | Includes |
|-----|---------|------------|----------|
| **intentKey** | Protocol semantic identity | IntentBody | `type + input + scopeProposal` |
| **strictKey** | Exact reproduction cache | ResolvedIntentIR | `resolvedIR + subsnapshot + context` |
| **simKey** | Similarity search | SemanticCanonicalIR | `IR tokens → SimHash` |

### 12.2 intentKey (Protocol Identity)

```typescript
type IntentKey = string;  // SHA-256 hash

/**
 * Protocol-aligned intentKey derivation.
 * Uses JCS array to avoid delimiter collision risk.
 */
function deriveIntentKey(body: IntentBody, schemaHash: string): IntentKey {
  // Array format: [schemaHash, type, input, scopeProposal]
  // JCS preserves array order, no delimiter collision possible
  const preimage = [
    schemaHash,
    body.type,
    body.input ?? null,
    body.scopeProposal ?? null,
  ];
  
  return sha256(JCS(preimage));
}
```

**Why JCS array (not string concatenation):**
- String delimiter (`:`) can appear in `body.type` (e.g., `"domain:Action"`)
- JCS array structure eliminates collision risk entirely
- Still deterministic and cross-implementation consistent

**MUST NOT include:**
- `origin` (meta, not semantic)
- `intentId` (attempt identity, not semantic)
- Snapshot data (execution-time binding)

### 12.3 strictKey (Reproduction Cache)

**CRITICAL**: strictKey MUST be computed from **ResolvedIntentIR** (after reference resolution), never from symbolic IR.

```typescript
/**
 * ResolvedEntityRef: Only "id" kind is allowed after resolution.
 */
type ResolvedEntityRef = { kind: "id"; id: string };

/**
 * ResolvedEntityRefTerm: 
 * - ref is OPTIONAL (collection scope preserved)
 * - If ref exists, it MUST be { kind: "id", id: string }
 */
type ResolvedEntityRefTerm = Omit<EntityRefTerm, "ref"> & {
  ref?: ResolvedEntityRef;  // Optional: absence = collection scope
};

/**
 * ResolvedTerm: EntityRefTerm is replaced with ResolvedEntityRefTerm.
 * All other term types remain unchanged.
 */
type ResolvedTerm =
  | ResolvedEntityRefTerm
  | Exclude<Term, EntityRefTerm>;

/**
 * ResolvedIntentIR: Symbolic refs (this/that/last) resolved to "id".
 * Collection scope (ref absent) is preserved as-is.
 * Note: args is still Partial - only present roles are included.
 */
type ResolvedIntentIR = Omit<IntentIR, "args"> & {
  args: Partial<Record<Role, ResolvedTerm>>;
};

type StrictKey = string;  // SHA-256 hash

function deriveStrictKey(
  resolvedIR: ResolvedIntentIR,  // NOT IntentIR
  footprint: Footprint, 
  snapshot: Snapshot,
  context: ExecutionContext
): StrictKey {
  const canonicalIR = canonicalizeStrict(resolvedIR);
  
  // Full closure: reads + depends + verify + policy footprints
  const footprintClosure = new Set([
    ...footprint.reads,
    ...footprint.depends,
    ...(footprint.verify ?? []),
    ...(footprint.policy ?? []),
  ]);
  
  const subsnapshot = extractSubsnapshot(snapshot, footprintClosure);
  
  return sha256(JCS({
    schemaHash: context.schemaHash,
    constitutionFP: context.constitutionFingerprint,
    invariantFP: context.invariantFingerprint,
    ir: canonicalIR,
    subsnapshot: canonicalize(subsnapshot),
    context: canonicalize({
      env: context.env,
      tenant: context.tenant,
      permissions: context.permissions,
      focusFingerprint: context.focusFingerprint,      // Resolver dependency
      discourseFingerprint: context.discourseFingerprint, // Resolver dependency
    }),
  }));
}
```

**Resolver rules (NORMATIVE):**
- `ref.kind ∈ {this, that, last}` → MUST resolve to `{ kind: "id", id: "..." }`
- `ref.kind = "id"` → Preserve as-is
- `ref` absent (collection scope) → MUST preserve absence

**Resolution ordering (NORMATIVE):**
```
IntentIR (symbolic: this/that/last OR collection scope)
    ↓ Resolver.resolve(snapshot, focus, discourse)
ResolvedIntentIR (symbolic → id; collection scope preserved)
    ↓ deriveStrictKey()
StrictKey
```

**MUST include (for reproducibility):**
- `schemaHash`: Domain schema fingerprint
- `constitutionFP`: Constitution/rules fingerprint
- `invariantFP`: Invariant constraints fingerprint
- `canonicalIR`: Strict-canonicalized **resolved** IR
- `subsnapshot`: State closure (reads ∪ depends ∪ verify ∪ policy)
- `context`: Environment, tenant, permissions, **focus/discourse fingerprints**

**Set-semantic arrays MUST be sorted (NORMATIVE):**

JCS preserves array order. Arrays with **set semantics** (where order is not meaningful) MUST be lexicographically sorted before canonicalization:

| Field | Semantic | Sort Required |
|-------|----------|---------------|
| `ExecutionContext.permissions` | Set | ✅ MUST sort |
| `IntentScope.paths` | Set | ✅ MUST sort |
| `Footprint.reads/writes/depends/verify/policy` | Set | ✅ MUST sort |
| `cond` (predicates) | AND-set | ✅ Already sorted by §11.4.1 |
| `ThetaFrame.required/optional` | Ordered list | ❌ Preserve order |

**Use case**: Same resolved IR + same relevant state + same context → same result (deterministic replay).

### 12.4 simKey (Similarity Search)

```typescript
type SimKey = bigint;  // SimHash

function deriveSimKey(ir: IntentIR): SimKey {
  const canonicalIR = canonicalizeSemantic(ir);
  const tokens = extractTokens(canonicalIR);  // lemma, entityTypes, shape keys, etc.
  return simhash(tokens);
}
```

**Use case**: Find similar intents for transfer learning, clustering, recommendations.

---

## 13. Lowering (IntentIR → IntentBody)

### 13.1 Lowering Target

IntentIR lowers to **IntentBody** (Manifesto protocol), not directly to code.

```
IntentIR (semantic structure)
    ↓ lower()
IntentBody (protocol intent)
    ↓ Issuer.issue()
IntentInstance (executable attempt)
```

### 13.2 IntentBody Structure (Protocol-Aligned)

```typescript
type IntentBody = {
  /** Action type. Resolved from lemma via Lexicon. */
  type: string;
  
  /** 
   * Domain input. Mapped from IR args + cond.
   * Note: IR cond (query/filter) is mapped into input, not scopeProposal.
   */
  input?: unknown;
  
  /** 
   * Write-boundary proposal (optional).
   * For scoped writes, not for query filters.
   */
  scopeProposal?: IntentScope;
};

type IntentScope = {
  paths?: string[];
  constraints?: Record<string, unknown>;
};
```

> **Note**: IR `cond` is a query filter and maps to `input` via Lexicon. `scopeProposal` is for write-boundary control, which is a separate concern.

### 13.3 Lowering Algorithm

```typescript
function lower(ir: IntentIR, lexicon: Lexicon, resolver: Resolver): IntentBody {
  // 1. Resolve action type from lemma
  const actionType = lexicon.resolveActionType(ir.event.lemma);
  
  // 2. Resolve discourse references (this/that/last → id)
  const resolvedIR = resolver.resolveReferences(ir);
  
  // 3. Map args + cond to domain input (cond becomes filter in input)
  const input = lexicon.mapArgsToInput(resolvedIR.args, resolvedIR.cond);
  
  // 4. Derive scope proposal if write operation
  const scopeProposal = lexicon.deriveScopeProposal?.(resolvedIR);
  
  return { type: actionType, input, scopeProposal };
}
```

### 13.4 Separation of Concerns

| Layer | Responsibility |
|-------|---------------|
| **Translator** | PF → IntentIR (LLM-assisted) |
| **Resolver** | Discourse refs → IDs (deterministic) |
| **Lowering** | IntentIR → IntentBody (deterministic) |
| **Issuer** | IntentBody → IntentInstance (protocol) |

> **Note**: LLM is only involved in Translator. All other steps are deterministic.

---

## 14. Feature Checking

### 14.1 Lexicon Interface (NORMATIVE)

Lexicon is the **single interface** for both feature checking and lowering.

```typescript
interface Lexicon {
  // === Feature Checking ===
  
  /** Resolve event entry by lemma. */
  resolveEvent(lemma: string): EventEntry | undefined;
  
  /** Get entity specification. */
  resolveEntity(entityType: string): EntitySpec | undefined;
  
  // === Lowering ===
  
  /** Resolve action type for IntentBody. */
  resolveActionType(lemma: string): string | undefined;
  
  /** Map IR args + cond to domain input. Cond becomes filter in input. */
  mapArgsToInput(args: IntentIR["args"], cond?: IntentIR["cond"]): unknown;
  
  /** Derive scope proposal for write operations (optional). */
  deriveScopeProposal?(ir: IntentIR): IntentScope | undefined;
}

type EventEntry = {
  /** Event class for this lemma. */
  eventClass: EventClass;
  
  /** θ-frame: which roles are required and their type constraints */
  thetaFrame: ThetaFrame;
  
  /** Read/write/depends paths (for effect analysis) */
  footprint?: Footprint;
  
  /** Policy hints (destructive, prod-sensitive, etc.) */
  policyHints?: PolicyHints;
};

type ThetaFrame = {
  required: Role[];
  optional: Role[];
  restrictions: Partial<Record<Role, SelectionalRestriction>>;
};

// Invariant: For each role in (required ∪ optional), restrictions[role] MUST exist.

type SelectionalRestriction = {
  termKinds: Term["kind"][];
  entityTypes?: string[];
  valueTypes?: ValueTerm["valueType"][];
};
```

> **Note**: Record-based implementations (e.g., `events: Record<string, EventEntry>`) are valid as long as they satisfy the interface contract.

### 14.2 Checking Rules

| Check | Condition | Result on Failure |
|-------|-----------|-------------------|
| **Lemma exists** | `lexicon.resolveEvent(lemma)` returns entry | ERROR or CLARIFY |
| **Class matches** | `entry.eventClass === ir.event.class` | ERROR (IR malformed) |
| **Required roles present** | All `thetaFrame.required` roles in `args` | ERROR or CLARIFY |
| **Term kind valid** | `term.kind` in `restrictions[role].termKinds` | ERROR or CLARIFY |
| **Entity type valid** | `entityType` in `restrictions[role].entityTypes` | ERROR or CLARIFY |
| **Policy check** | `policyHints` pass policy rules | CONFIRM or POLICY verify |

### 14.3 Checking Algorithm

```
function checkFeatures(ir: IntentIR, lexicon: Lexicon): CheckResult {
  const entry = lexicon.resolveEvent(ir.event.lemma);
  if (!entry) {
    return { valid: false, error: "UNKNOWN_LEMMA", suggest: "CLARIFY" };
  }
  
  // Check event class consistency
  if (entry.eventClass !== ir.event.class) {
    return { valid: false, error: "CLASS_MISMATCH", suggest: "ERROR" };
  }
  
  // Check required roles
  for (const role of entry.thetaFrame.required) {
    if (!(role in ir.args)) {
      return { valid: false, error: "MISSING_ROLE", role, suggest: "CLARIFY" };
    }
  }
  
  // Check selectional restrictions
  for (const [role, term] of Object.entries(ir.args)) {
    const restriction = entry.thetaFrame.restrictions[role];
    if (restriction && !satisfies(term, restriction)) {
      return { valid: false, error: "TYPE_MISMATCH", role, suggest: "CLARIFY" };
    }
  }
  
  // Check policy hints
  if (entry.policyHints?.destructive) {
    return { valid: true, requiresConfirm: true };
  }
  
  return { valid: true };
}
```

---

## 15. Zod Schema (Reference Implementation)

Zod schemas provide **runtime validation** and **type inference** for TypeScript/JavaScript implementations.

> **Status:** INFORMATIVE. These schemas are a reference implementation.  
> **Normative contract:** JSON Schema (§15) + RFC 2119 rules in this document.

### 13.1 Design Rationale

| Aspect | JSON Schema | Zod |
|--------|-------------|-----|
| Normative status | **NORMATIVE** | INFORMATIVE |
| Language independence | ✅ Any language | TypeScript/JavaScript only |
| Runtime validation | Via validators (ajv, etc.) | Built-in `.parse()` |
| Type inference | Codegen required | Native `z.infer<>` |

**Zod is RECOMMENDED** for TypeScript/JavaScript implementations but is NOT required for spec compliance. Implementations in other languages SHOULD use the JSON Schema (§17) as the normative contract.

> **Implementation Note**: Zod objects default to "strip" mode, which silently removes unknown keys. For strict validation matching JSON Schema's `additionalProperties: false`, use `.strict()` on object schemas or configure Zod globally.

### 15.2 Core Schemas

```typescript
import { z } from 'zod';

// =============================================================================
// Intent IR v0.1 - Zod Schemas
// =============================================================================
// NOTE: Add .strict() to object schemas for stricter validation
//       e.g., z.object({...}).strict()

// -----------------------------------------------------------------------------
// Version
// -----------------------------------------------------------------------------
export const IntentIRVersionSchema = z.literal("0.1");

// -----------------------------------------------------------------------------
// Functional Heads (Enumerations)
// -----------------------------------------------------------------------------
export const ForceSchema = z.enum([
  "ASK", 
  "DO", 
  "VERIFY", 
  "CONFIRM", 
  "CLARIFY"
]);

export const EventClassSchema = z.enum([
  "OBSERVE", 
  "TRANSFORM", 
  "SOLVE", 
  "CREATE", 
  "DECIDE", 
  "CONTROL"
]);

export const RoleSchema = z.enum([
  "TARGET", 
  "THEME", 
  "SOURCE", 
  "DEST", 
  "INSTRUMENT", 
  "BENEFICIARY"
]);

export const ModalitySchema = z.enum([
  "MUST", 
  "SHOULD", 
  "MAY", 
  "FORBID"
]);

export const TimeKindSchema = z.enum([
  "NOW", 
  "AT", 
  "BEFORE", 
  "AFTER", 
  "WITHIN"
]);

export const VerifyModeSchema = z.enum([
  "NONE", 
  "TEST", 
  "PROOF", 
  "CITATION", 
  "RUBRIC", 
  "POLICY"
]);

export const OutputTypeSchema = z.enum([
  "number", 
  "expression", 
  "proof", 
  "explanation", 
  "summary", 
  "plan", 
  "code", 
  "text", 
  "artifactRef"
]);

export const OutputFormatSchema = z.enum([
  "markdown", 
  "json", 
  "latex", 
  "text"
]);

// -----------------------------------------------------------------------------
// Event
// -----------------------------------------------------------------------------
export const EventSchema = z.object({
  lemma: z.string().min(1).regex(/^[A-Z][A-Z0-9_]*$/, 
    "lemma must be uppercase ASCII"),
  class: EventClassSchema,
});

// -----------------------------------------------------------------------------
// Term Types
// -----------------------------------------------------------------------------
export const EntityRefKindSchema = z.enum(["this", "that", "last", "id"]);

export const EntityRefSchema = z.object({
  kind: EntityRefKindSchema,
  id: z.string().optional(),
}).refine(
  (data) => data.kind !== "id" || data.id !== undefined,
  { message: "id is required when kind is 'id'" }
);

export const EntityRefTermSchema = z.object({
  kind: z.literal("entity"),
  entityType: z.string().min(1),
  ref: EntityRefSchema.optional(),
});

export const PathRefTermSchema = z.object({
  kind: z.literal("path"),
  path: z.string().min(1),
});

export const ArtifactTypeSchema = z.enum([
  "text", 
  "math", 
  "code", 
  "data", 
  "plan", 
  "mixed"
]);

export const ArtifactRefSchema = z.object({
  kind: z.enum(["inline", "id"]),
  id: z.string().optional(),
});

export const ArtifactRefTermSchema = z.object({
  kind: z.literal("artifact"),
  artifactType: ArtifactTypeSchema,
  ref: ArtifactRefSchema,
  content: z.string().optional(),
}).refine(
  (data) => data.ref.kind !== "inline" || data.content !== undefined,
  { message: "content is required when ref.kind is 'inline'" }
).refine(
  (data) => data.ref.kind !== "id" || data.ref.id !== undefined,
  { message: "id is required when ref.kind is 'id'" }
);

export const ValueTypeSchema = z.enum([
  "string", 
  "number", 
  "boolean", 
  "date", 
  "enum", 
  "id"
]);

export const ValueTermSchema = z.object({
  kind: z.literal("value"),
  valueType: ValueTypeSchema,
  shape: z.record(z.string(), z.unknown()),
  raw: z.unknown().optional(),
});

export const ExprTypeSchema = z.enum(["latex", "ast", "code"]);

export const ExprTermSchema = z.object({
  kind: z.literal("expr"),
  exprType: ExprTypeSchema,
  expr: z.union([z.string(), z.record(z.string(), z.unknown())]),
}).superRefine((data, ctx) => {
  if (data.exprType === "ast" && typeof data.expr !== "object") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "expr must be object when exprType is 'ast'",
      path: ["expr"],
    });
  }
  if ((data.exprType === "latex" || data.exprType === "code") && typeof data.expr !== "string") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "expr must be string when exprType is 'latex' or 'code'",
      path: ["expr"],
    });
  }
});

// Discriminated union for Term
export const TermSchema = z.discriminatedUnion("kind", [
  EntityRefTermSchema,
  PathRefTermSchema,
  ArtifactRefTermSchema,
  ValueTermSchema,
  ExprTermSchema,
]);

// -----------------------------------------------------------------------------
// Predicate (Condition)
// -----------------------------------------------------------------------------
export const PredOpSchema = z.enum([
  "=", "!=", 
  "<", ">", "<=", ">=", 
  "contains", "startsWith", "matches"
]);

export const LHSSchema = z.string().regex(
  /^(target|theme|source|dest|state|env|computed)\.[A-Za-z0-9_.]+$/,
  "lhs must be scoped path, e.g. target.status"
);

export const PredSchema = z.object({
  lhs: LHSSchema,
  op: PredOpSchema,
  rhs: TermSchema,
});

// -----------------------------------------------------------------------------
// Auxiliary Specifications
// -----------------------------------------------------------------------------
export const TimeSpecSchema = z.object({
  kind: TimeKindSchema,
  value: z.unknown().optional(),
});

export const VerifySpecSchema = z.object({
  mode: VerifyModeSchema,
  spec: z.record(z.string(), z.unknown()).optional(),
});

export const OutputSpecSchema = z.object({
  type: OutputTypeSchema,
  format: OutputFormatSchema.optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
});

// -----------------------------------------------------------------------------
// Args (θ-role map)
// -----------------------------------------------------------------------------
// Args: each role maps to at most one Term (v0.1)
// Using explicit object + partial for proper type inference
export const ArgsSchema = z.object({
  TARGET: TermSchema,
  THEME: TermSchema,
  SOURCE: TermSchema,
  DEST: TermSchema,
  INSTRUMENT: TermSchema,
  BENEFICIARY: TermSchema,
}).partial();

// -----------------------------------------------------------------------------
// IntentIR (Root)
// -----------------------------------------------------------------------------
export const IntentIRSchema = z.object({
  v: IntentIRVersionSchema,
  force: ForceSchema,
  event: EventSchema,
  args: ArgsSchema,
  cond: z.array(PredSchema).optional(),
  mod: ModalitySchema.optional(),
  time: TimeSpecSchema.optional(),
  verify: VerifySpecSchema.optional(),
  out: OutputSpecSchema.optional(),
  ext: z.record(z.string(), z.unknown()).optional(),
});
```

### 13.3 Type Inference

```typescript
// Infer TypeScript types from Zod schemas
export type IntentIR = z.infer<typeof IntentIRSchema>;
export type Force = z.infer<typeof ForceSchema>;
export type EventClass = z.infer<typeof EventClassSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type Modality = z.infer<typeof ModalitySchema>;
export type TimeKind = z.infer<typeof TimeKindSchema>;
export type VerifyMode = z.infer<typeof VerifyModeSchema>;
export type OutputType = z.infer<typeof OutputTypeSchema>;
export type Event = z.infer<typeof EventSchema>;
export type Term = z.infer<typeof TermSchema>;
export type EntityRefTerm = z.infer<typeof EntityRefTermSchema>;
export type PathRefTerm = z.infer<typeof PathRefTermSchema>;
export type ArtifactRefTerm = z.infer<typeof ArtifactRefTermSchema>;
export type ValueTerm = z.infer<typeof ValueTermSchema>;
export type ExprTerm = z.infer<typeof ExprTermSchema>;
export type Pred = z.infer<typeof PredSchema>;
export type TimeSpec = z.infer<typeof TimeSpecSchema>;
export type VerifySpec = z.infer<typeof VerifySpecSchema>;
export type OutputSpec = z.infer<typeof OutputSpecSchema>;
```

### 13.4 Validation API

```typescript
/**
 * Parse and validate IntentIR.
 * @throws ZodError on validation failure
 */
export function parseIntentIR(data: unknown): IntentIR {
  return IntentIRSchema.parse(data);
}

/**
 * Safe parse IntentIR without throwing.
 * @returns { success: true, data: IntentIR } | { success: false, error: ZodError }
 */
export function safeParseIntentIR(data: unknown): z.SafeParseReturnType<unknown, IntentIR> {
  return IntentIRSchema.safeParse(data);
}

/**
 * Validate IntentIR and return diagnostics.
 */
export function validateIntentIR(data: unknown): ValidationResult {
  const result = IntentIRSchema.safeParse(data);
  
  if (result.success) {
    return {
      valid: true,
      data: result.data,
      errors: [],
    };
  }
  
  return {
    valid: false,
    data: null,
    errors: result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  };
}

export type ValidationResult = 
  | { valid: true; data: IntentIR; errors: [] }
  | { valid: false; data: null; errors: ValidationError[] };

export type ValidationError = {
  path: string;
  message: string;
  code: string;
};
```

### 13.5 Refinements and Custom Validators

```typescript
/**
 * Extended schema with cross-field validations.
 */
export const IntentIRStrictSchema = IntentIRSchema.refine(
  (data) => {
    // CLARIFY force should have empty or minimal args
    if (data.force === "CLARIFY" && Object.keys(data.args).length > 2) {
      return false;
    }
    return true;
  },
  { message: "CLARIFY force should have minimal arguments" }
).refine(
  (data) => {
    // VERIFY force should have verify spec
    if (data.force === "VERIFY" && !data.verify) {
      return false;
    }
    return true;
  },
  { message: "VERIFY force requires verify specification" }
);

/**
 * Schema for canonicalized IntentIR.
 * Used after canonicalization to ensure proper form.
 */
export const CanonicalIntentIRSchema = IntentIRSchema.refine(
  (data) => {
    // lemma must be uppercase
    if (data.event.lemma !== data.event.lemma.toUpperCase()) {
      return false;
    }
    return true;
  },
  { message: "Canonical form requires uppercase lemma" }
);
```

### 13.6 Constants

```typescript
/**
 * Canonical role ordering for serialization.
 */
export const ROLE_ORDER: readonly Role[] = [
  "TARGET",
  "THEME",
  "SOURCE",
  "DEST",
  "INSTRUMENT",
  "BENEFICIARY",
] as const;

/**
 * All valid Force values.
 */
export const FORCE_VALUES = ForceSchema.options;

/**
 * All valid EventClass values.
 */
export const EVENT_CLASS_VALUES = EventClassSchema.options;

/**
 * All valid Role values.
 */
export const ROLE_VALUES = RoleSchema.options;
```

---

## 16. TypeScript Definitions (Informative)

Complete TypeScript type definitions for Intent IR v0.1.

> **Note:** These types are **informative**. The normative types are derived from Zod schemas via `z.infer<>`. These are provided for reference and documentation.

```typescript
// =============================================================================
// Intent IR v0.1 - TypeScript Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// Version
// -----------------------------------------------------------------------------
export type IntentIRVersion = "0.1";

// -----------------------------------------------------------------------------
// Functional Heads (Enumerations)
// -----------------------------------------------------------------------------
export type Force = "ASK" | "DO" | "VERIFY" | "CONFIRM" | "CLARIFY";

export type EventClass = 
  | "OBSERVE" 
  | "TRANSFORM" 
  | "SOLVE" 
  | "CREATE" 
  | "DECIDE" 
  | "CONTROL";

export type Role = 
  | "TARGET" 
  | "THEME" 
  | "SOURCE" 
  | "DEST" 
  | "INSTRUMENT" 
  | "BENEFICIARY";

export type Modality = "MUST" | "SHOULD" | "MAY" | "FORBID";

export type TimeKind = "NOW" | "AT" | "BEFORE" | "AFTER" | "WITHIN";

export type VerifyMode = 
  | "NONE" 
  | "TEST" 
  | "PROOF" 
  | "CITATION" 
  | "RUBRIC" 
  | "POLICY";

export type OutputType = 
  | "number" 
  | "expression" 
  | "proof" 
  | "explanation" 
  | "summary" 
  | "plan" 
  | "code" 
  | "text" 
  | "artifactRef";

// -----------------------------------------------------------------------------
// Event
// -----------------------------------------------------------------------------
export type Event = {
  readonly lemma: string;
  readonly class: EventClass;
};

// -----------------------------------------------------------------------------
// Term Types
// -----------------------------------------------------------------------------
export type EntityRefKind = "this" | "that" | "last" | "id";

export type EntityRef = {
  readonly kind: EntityRefKind;
  readonly id?: string;
};

export type EntityRefTerm = {
  readonly kind: "entity";
  readonly entityType: string;
  readonly ref?: EntityRef;
};

export type PathRefTerm = {
  readonly kind: "path";
  readonly path: string;
};

export type ArtifactType = "text" | "math" | "code" | "data" | "plan" | "mixed";

export type ArtifactRef = {
  readonly kind: "inline" | "id";
  readonly id?: string;
};

export type ArtifactRefTerm = {
  readonly kind: "artifact";
  readonly artifactType: ArtifactType;
  readonly ref: ArtifactRef;
  readonly content?: string;
};

export type ValueType = "string" | "number" | "boolean" | "date" | "enum" | "id";

export type ValueTerm = {
  readonly kind: "value";
  readonly valueType: ValueType;
  readonly shape: Record<string, unknown>;
  readonly raw?: unknown;
};

export type ExprType = "latex" | "ast" | "code";

export type ExprTerm = {
  readonly kind: "expr";
  readonly exprType: ExprType;
  readonly expr: string | Record<string, unknown>;
};

export type Term = 
  | EntityRefTerm 
  | PathRefTerm 
  | ArtifactRefTerm 
  | ValueTerm 
  | ExprTerm;

// -----------------------------------------------------------------------------
// Predicate (Condition)
// -----------------------------------------------------------------------------
export type PredOp = 
  | "=" | "!=" 
  | "<" | ">" | "<=" | ">=" 
  | "contains" | "startsWith" | "matches";

export type Pred = {
  readonly lhs: string;
  readonly op: PredOp;
  readonly rhs: Term;
};

// -----------------------------------------------------------------------------
// Auxiliary Specifications
// -----------------------------------------------------------------------------
export type TimeSpec = {
  readonly kind: TimeKind;
  readonly value?: unknown;
};

export type VerifySpec = {
  readonly mode: VerifyMode;
  readonly spec?: Record<string, unknown>;
};

export type OutputFormat = "markdown" | "json" | "latex" | "text";

export type OutputSpec = {
  readonly type: OutputType;
  readonly format?: OutputFormat;
  readonly constraints?: Record<string, unknown>;
};

// -----------------------------------------------------------------------------
// IntentIR (Root)
// -----------------------------------------------------------------------------
export type IntentIR = {
  readonly v: IntentIRVersion;
  readonly force: Force;
  readonly event: Event;
  readonly args: Partial<Record<Role, Term>>;
  readonly cond?: Pred[];
  readonly mod?: Modality;
  readonly time?: TimeSpec;
  readonly verify?: VerifySpec;
  readonly out?: OutputSpec;
  readonly ext?: Record<string, unknown>;
};

// -----------------------------------------------------------------------------
// Lexicon Types (for Feature Checking)
// -----------------------------------------------------------------------------
export type SelectionalRestriction = {
  readonly termKinds: Term["kind"][];
  readonly entityTypes?: string[];
  readonly valueTypes?: ValueType[];
};

export type ThetaFrame = {
  readonly required: Role[];
  readonly optional: Role[];
  readonly restrictions: Partial<Record<Role, SelectionalRestriction>>;
};

export type Footprint = {
  readonly reads: string[];
  readonly writes: string[];
  readonly depends: string[];
  readonly verify?: string[];   // Paths for verification
  readonly policy?: string[];   // Paths for policy check
};

export type PolicyHints = {
  readonly destructive?: boolean;
  readonly prodSensitive?: boolean;
  readonly requiresAuth?: boolean;
};

export type EventEntry = {
  readonly eventClass: EventClass;  // Required for CLASS_MISMATCH check
  readonly thetaFrame: ThetaFrame;
  readonly footprint?: Footprint;
  readonly policyHints?: PolicyHints;
};

export type EntitySpec = {
  readonly fields: Record<string, unknown>;
};

export type Lexicon = {
  readonly events: Record<string, EventEntry>;
  readonly entities: Record<string, EntitySpec>;
};

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
export const ROLE_ORDER: readonly Role[] = [
  "TARGET",
  "THEME", 
  "SOURCE",
  "DEST",
  "INSTRUMENT",
  "BENEFICIARY",
] as const;
```


## 17. JSON Schema

JSON Schema (Draft 2020-12) for Intent IR v0.1.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://manifesto.dev/schemas/intent-ir/0.1",
  "title": "Manifesto Intent IR v0.1",
  "description": "Chomskyan LF-based Semantic IR for natural language intent",
  "type": "object",
  "additionalProperties": false,
  "required": ["v", "force", "event", "args"],
  
  "properties": {
    "v": { 
      "const": "0.1",
      "description": "Specification version"
    },

    "force": {
      "type": "string",
      "enum": ["ASK", "DO", "VERIFY", "CONFIRM", "CLARIFY"],
      "description": "Illocutionary force"
    },

    "event": {
      "$ref": "#/$defs/event",
      "description": "Event specification"
    },

    "args": {
      "type": "object",
      "additionalProperties": { "$ref": "#/$defs/term" },
      "propertyNames": {
        "enum": ["TARGET", "THEME", "SOURCE", "DEST", "INSTRUMENT", "BENEFICIARY"]
      },
      "description": "θ-role arguments"
    },

    "cond": {
      "type": "array",
      "items": { "$ref": "#/$defs/pred" },
      "description": "Condition predicates (AND-conjoined)"
    },

    "mod": {
      "type": "string",
      "enum": ["MUST", "SHOULD", "MAY", "FORBID"],
      "description": "Modality"
    },

    "time": { 
      "$ref": "#/$defs/timeSpec",
      "description": "Temporal specification"
    },

    "verify": { 
      "$ref": "#/$defs/verifySpec",
      "description": "Verification contract"
    },

    "out": { 
      "$ref": "#/$defs/outputSpec",
      "description": "Output specification"
    },

    "ext": {
      "type": "object",
      "additionalProperties": true,
      "description": "Extension point (namespaced keys recommended)"
    }
  },

  "$defs": {
    "event": {
      "type": "object",
      "additionalProperties": false,
      "required": ["lemma", "class"],
      "properties": {
        "lemma": { 
          "type": "string", 
          "minLength": 1,
          "pattern": "^[A-Z][A-Z0-9_]*$",
          "description": "Canonical event label (uppercase)"
        },
        "class": {
          "type": "string",
          "enum": ["OBSERVE", "TRANSFORM", "SOLVE", "CREATE", "DECIDE", "CONTROL"],
          "description": "Coarse event classification"
        }
      }
    },

    "term": {
      "oneOf": [
        { "$ref": "#/$defs/entityRefTerm" },
        { "$ref": "#/$defs/pathRefTerm" },
        { "$ref": "#/$defs/artifactRefTerm" },
        { "$ref": "#/$defs/valueTerm" },
        { "$ref": "#/$defs/exprTerm" }
      ]
    },

    "entityRefTerm": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "entityType"],
      "properties": {
        "kind": { "const": "entity" },
        "entityType": { "type": "string", "minLength": 1 },
        "ref": {
          "type": "object",
          "additionalProperties": false,
          "required": ["kind"],
          "properties": {
            "kind": { "enum": ["this", "that", "last", "id"] },
            "id": { "type": "string" }
          },
          "if": { "properties": { "kind": { "const": "id" } } },
          "then": { "required": ["kind", "id"] }
        }
      }
    },

    "pathRefTerm": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "path"],
      "properties": {
        "kind": { "const": "path" },
        "path": { "type": "string", "minLength": 1 }
      }
    },

    "artifactRefTerm": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "artifactType", "ref"],
      "properties": {
        "kind": { "const": "artifact" },
        "artifactType": { "enum": ["text", "math", "code", "data", "plan", "mixed"] },
        "ref": {
          "type": "object",
          "additionalProperties": false,
          "required": ["kind"],
          "properties": {
            "kind": { "enum": ["inline", "id"] },
            "id": { "type": "string" }
          },
          "if": { "properties": { "kind": { "const": "id" } } },
          "then": { "required": ["kind", "id"] }
        },
        "content": { "type": "string" }
      },
      "allOf": [
        {
          "if": { "properties": { "ref": { "properties": { "kind": { "const": "inline" } } } } },
          "then": { "required": ["kind", "artifactType", "ref", "content"] }
        }
      ]
    },

    "valueTerm": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "valueType", "shape"],
      "properties": {
        "kind": { "const": "value" },
        "valueType": { "enum": ["string", "number", "boolean", "date", "enum", "id"] },
        "shape": { "type": "object", "additionalProperties": true },
        "raw": {}
      }
    },

    "exprTerm": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "exprType", "expr"],
      "properties": {
        "kind": { "const": "expr" },
        "exprType": { "enum": ["latex", "ast", "code"] },
        "expr": {
          "oneOf": [
            { "type": "string" },
            { "type": "object" }
          ]
        }
      },
      "allOf": [
        {
          "if": { "properties": { "exprType": { "const": "ast" } } },
          "then": { "properties": { "expr": { "type": "object" } } }
        },
        {
          "if": { "properties": { "exprType": { "enum": ["latex", "code"] } } },
          "then": { "properties": { "expr": { "type": "string" } } }
        }
      ]
    },

    "pred": {
      "type": "object",
      "additionalProperties": false,
      "required": ["lhs", "op", "rhs"],
      "properties": {
        "lhs": { 
          "type": "string", 
          "pattern": "^(target|theme|source|dest|state|env|computed)\\.[A-Za-z0-9_.]+$"
        },
        "op": { "enum": ["=", "!=", "<", ">", "<=", ">=", "contains", "startsWith", "matches"] },
        "rhs": { "$ref": "#/$defs/term" }
      }
    },

    "timeSpec": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind"],
      "properties": {
        "kind": { "enum": ["NOW", "AT", "BEFORE", "AFTER", "WITHIN"] },
        "value": {}
      }
    },

    "verifySpec": {
      "type": "object",
      "additionalProperties": false,
      "required": ["mode"],
      "properties": {
        "mode": { "enum": ["NONE", "TEST", "PROOF", "CITATION", "RUBRIC", "POLICY"] },
        "spec": { "type": "object", "additionalProperties": true }
      }
    },

    "outputSpec": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type"],
      "properties": {
        "type": { "enum": ["number", "expression", "proof", "explanation", "summary", "plan", "code", "text", "artifactRef"] },
        "format": { "enum": ["markdown", "json", "latex", "text"] },
        "constraints": { "type": "object", "additionalProperties": true }
      }
    }
  }
}
```

---

## 18. Examples

### 18.1 Example A: "지난 주문 취소해줘" / "Cancel my last order"

```json
{
  "v": "0.1",
  "force": "DO",
  "event": { 
    "lemma": "CANCEL", 
    "class": "CONTROL" 
  },
  "args": {
    "TARGET": { 
      "kind": "entity", 
      "entityType": "Order", 
      "ref": { "kind": "last" } 
    }
  },
  "mod": "MUST",
  "time": { "kind": "NOW" },
  "verify": { "mode": "POLICY" },
  "out": { "type": "text", "format": "markdown" }
}
```

### 18.2 Example B: "이 적분 풀어줘" / "Solve this integral"

```json
{
  "v": "0.1",
  "force": "DO",
  "event": { 
    "lemma": "SOLVE", 
    "class": "SOLVE" 
  },
  "args": {
    "THEME": { 
      "kind": "expr", 
      "exprType": "latex", 
      "expr": "\\int_0^1 x^2 e^x dx" 
    }
  },
  "verify": { 
    "mode": "TEST", 
    "spec": { "numericCheck": true } 
  },
  "out": { "type": "expression", "format": "latex" }
}
```

### 18.3 Example C: "겨울 주제로 소네트 써줘" / "Write a sonnet about winter"

```json
{
  "v": "0.1",
  "force": "DO",
  "event": { 
    "lemma": "WRITE", 
    "class": "CREATE" 
  },
  "args": {
    "THEME": {
      "kind": "value",
      "valueType": "enum",
      "shape": { "theme": "winter", "form": "sonnet" }
    }
  },
  "verify": { 
    "mode": "RUBRIC", 
    "spec": { "lines": 14, "rhymeScheme": "shakespearean" } 
  },
  "out": { "type": "text", "format": "markdown" }
}
```

### 18.4 Example D: "활성 사용자 목록 보여줘" / "Show me active users"

```json
{
  "v": "0.1",
  "force": "ASK",
  "event": { 
    "lemma": "LIST", 
    "class": "OBSERVE" 
  },
  "args": {
    "TARGET": { 
      "kind": "entity", 
      "entityType": "User"
    }
  },
  "cond": [
    {
      "lhs": "target.status",
      "op": "=",
      "rhs": { 
        "kind": "value", 
        "valueType": "enum", 
        "shape": { "value": "active" } 
      }
    }
  ],
  "out": { "type": "text", "format": "json" }
}
```

> **Note**: `ref` is absent, indicating collection scope ("all users matching condition").

### 18.5 Example E: "이 코드를 Python으로 변환해줘" / "Convert this code to Python"

```json
{
  "v": "0.1",
  "force": "DO",
  "event": { 
    "lemma": "CONVERT", 
    "class": "TRANSFORM" 
  },
  "args": {
    "SOURCE": { 
      "kind": "artifact", 
      "artifactType": "code", 
      "ref": { "kind": "inline" },
      "content": "function add(a, b) { return a + b; }"
    },
    "DEST": {
      "kind": "value",
      "valueType": "enum",
      "shape": { "language": "python" }
    }
  },
  "out": { "type": "code", "format": "text" }
}
```

---

## 19. Extension Points

### 19.1 Extension Field (`ext`)

The `ext` field provides a namespace for domain-specific or experimental extensions.

**Normative:**
- Extension keys SHOULD be namespaced: `"domain:key"` or `"org.example:key"`
- Extensions MUST NOT change semantics of core fields
- Extensions are NOT guaranteed to be preserved across systems

**Example:**
```json
{
  "v": "0.1",
  "force": "DO",
  "event": { "lemma": "DEPLOY", "class": "CONTROL" },
  "args": { ... },
  "ext": {
    "k8s:namespace": "production",
    "k8s:replicas": 3,
    "internal:priority": "high"
  }
}
```

### 19.2 Future Extension Candidates (v0.2+)

| Extension | Description | Status |
|-----------|-------------|--------|
| OR/NOT conditions | Disjunctive and negated predicates | Planned v0.2 |
| Quantifiers | Universal/existential (∀, ∃) | Under consideration |
| Multi-event | Sequenced/parallel event composition | Under consideration |
| Context reference | Explicit discourse context binding | Under consideration |

---

## 20. Versioning

### 20.1 Version Scheme

Intent IR follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes to structure or semantics
- **MINOR**: Backward-compatible additions (new optional fields, clarifications)
- **PATCH**: Documentation fixes, non-normative changes

> **Note**: Adding a new value to any core enum (Force, EventClass, Role, Modality, TimeKind, VerifyMode, OutputType) is a **BREAKING** change requiring a MAJOR version bump. See §18.2.

### 20.2 Compatibility Rules

| Change Type | Compatibility | Example |
|-------------|---------------|---------|
| Add optional field | Backward compatible | Adding `priority?: number` |
| Add enum value | **BREAKING** | Adding `DELEGATE` to Force |
| Remove field | **BREAKING** | Removing `mod` |
| Change field type | **BREAKING** | `lemma: string` → `lemma: string[]` |
| Add required field | **BREAKING** | Adding `scope: string` as required |

**Why enum addition is BREAKING (AD-INT-002 alignment):**

Consumers implementing exhaustive pattern matching (which this spec encourages per AD-INT-002) will fail on unknown enum values. Adding an enum value therefore breaks existing strict validators and consumers. Extension MUST happen via the `ext` field, not new enum values.

### 20.3 Wire Version vs Spec Version

| Version Type | Format | Example | Purpose |
|--------------|--------|---------|---------|
| **Wire version** (`v` field) | `"MAJOR.MINOR"` | `"0.1"` | Compatibility check at runtime |
| **Spec version** | `"MAJOR.MINOR.PATCH"` | `"0.1.0"` | Document revision tracking |

- Wire version changes only on MAJOR or MINOR changes
- Spec PATCH versions are documentation-only fixes (typos, clarifications)
- Consumers SHOULD check wire version, not spec version

### 20.4 Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2025-01 | Initial specification |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **LF (Logical Form)** | Abstract semantic representation in Chomskyan linguistics |
| **PF (Phonetic Form)** | Surface-level representation (actual utterance) |
| **θ-role (Theta role)** | Thematic relation between predicate and argument |
| **Functional Head** | Syntactic category carrying grammatical features |
| **Selectional Restriction** | Semantic constraint on argument types |
| **Lexicon** | Repository of lexical entries with their features |
| **Feature Checking** | Process of validating feature compatibility |
| **Canonicalization** | Normalization to unique representative form |

---

## Appendix B: Reference Implementation Notes

### B.1 Canonical Serialization (INFORMATIVE)

> **Note**: This is an informative example only. For normative canonicalization rules, see §11.
> This simplified algorithm does NOT handle the `args` ROLE_ORDER exception.

Implementations SHOULD use a stable JSON serialization library. Example algorithm:

```typescript
function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, (_, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((sorted, key) => {
        sorted[key] = value[key];
        return sorted;
      }, {} as Record<string, unknown>);
    }
    return value;
  });
}
```

### B.2 Validation Order

Recommended validation order:

1. JSON Schema validation (structural)
2. Canonicalization
3. Lexicon feature checking (semantic)
4. Policy checking (contextual)

---

*End of Manifesto Intent IR Specification v0.1*
