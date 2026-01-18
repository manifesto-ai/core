# `@manifesto-ai/translator` Specification v1.0

> **Status:** Release
> **Version:** 1.0.0
> **License:** MIT
> **Depends On:** MEL v0.3.3, Manifesto Host Contract, World Protocol, `@manifesto-ai/memory` v1.0.0
> **Purpose:** Define the normative contract for translating multilingual natural language into incremental, auditable semantic change proposals for Manifesto domains.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Normative Language](#2-normative-language)
3. [Core Constitution (Invariants)](#3-core-constitution-invariants)
4. [Canonical IR Contracts](#4-canonical-ir-contracts-aligned-with-mel-v033)
5. [Architecture Overview (Pipeline)](#5-architecture-overview-pipeline)
6. [Data Types (Normative Shapes)](#6-data-types-normative-shapes)
7. [Glossary](#7-glossary)
8. [Memory Integration](#8-memory-integration-normative)
9. [Public API](#9-public-api-normative-semantics)
10. [Validation Rules](#10-validation-rules-translator-level)
11. [Configuration](#11-configuration-normative-behaviors)
12. [Error Handling](#12-error-handling)
13. [Determinism Requirements](#13-determinism-requirements)
14. [Trace Redaction](#14-trace-redaction)
15. [Non-Goals (v1)](#15-non-goals-v1)
16. [Acceptance Criteria](#16-acceptance-criteria-gono-go)

---

## 1. Introduction

### 1.1 What is Translator?

Translator is a **compiler frontend** that transforms **natural language (any language)** into **incremental semantic change proposals** for a Manifesto domain.

Translator outputs only:

* **PatchFragment(s)** (proposed semantic changes), or
* **AmbiguityReport** (requires an Actor decision), or
* **TranslationError**

Translator **MUST NOT**:

* generate MEL text,
* apply patches,
* resolve ambiguity,
* perform governance approval,
* execute Host effects.

### 1.2 End-to-End Positioning

```
NL Input (any language)
  → Translator (this spec)
    → PatchFragment(s) | AmbiguityReport (+ traces)
      → Authority (policy + verifyProof only)
        → Host apply/execute
          → Schema/Snapshot updated (Truth)
            → Deterministic Renderer (optional, may be bundled)
              → MEL text projection
```

### 1.3 Scope of Incremental Semantic Change

v1 defines "incremental semantic change" as:

* ✅ **Schema/domain semantics**: type definitions, constraints, action signatures
* ❌ **Runtime data migration**: requires separate domain/action design (deferred to v2)

---

## 2. Normative Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHOULD**, **MAY** are to be interpreted as described in RFC 2119.

---

## 3. Core Constitution (Invariants)

Translator MUST uphold:

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-001 | Frontend Only | Translator is a compiler frontend, not a code generator. |
| INV-002 | Untrusted Proposer | Any model output is a *proposal* only. |
| INV-003 | Incremental-First | Every input is treated as an incremental fragment; "initial generation" is just the first fragment set. |
| INV-004 | Ambiguity Return | Translator MUST NOT resolve ambiguity; it MUST return a structured AmbiguityReport to the originating Actor. |
| INV-005 | Deterministic Projection | MEL text is a deterministic projection; Translator MUST NOT emit MEL. |
| INV-006 | Auditable | Every run MUST produce a TranslationTrace. |
| INV-007 | Type Facts, Not Inference | Type metadata MUST be first-class and queryable from schema; Translator MUST rely on lookup rather than model inference where possible. |
| INV-008 | Memory ≠ Truth | Memory is candidates + selection + trace; never treated as truth. Truth is only referenced World/Snapshot. |

---

## 4. Canonical IR Contracts (Aligned with MEL v0.3.3)

### 4.1 Expression IR (Canonical)

Translator MUST target **MEL v0.3.3 call-only `ExprNode`** for all **computed expressions**:

* constraint rules (`addConstraint.rule`)
* computed expressions (`addComputed.expr`)
* available conditions (`addActionAvailable.expr`)
* ambiguity candidate expressions (if any)

**Literal Values (Exception):**

Default values (`setDefaultValue.value`) are **not expressions** but **literal data**. They use `JsonValue` type instead of `ExprNode`. This is because:
- Default values must be deterministic literals (no `$system.*`, `$input.*`)
- They must be directly serializable to MEL state initializers
- No runtime evaluation is needed

| Context | Type | Rationale |
|---------|------|-----------|
| Constraint rules | `ExprNode` | Runtime evaluation needed |
| Computed expressions | `ExprNode` | Runtime evaluation needed |
| Action availability | `ExprNode` | Runtime evaluation needed |
| Default values | `JsonValue` | Static literal, no evaluation |

Translator MUST NOT introduce any alternative ExprNode representation.

### 4.2 SemanticPath (Normative)

```typescript
type SemanticPath = string;
```

**Format:** Dot-separated identifiers.

**Examples:**
- `"state.tracking"`
- `"types.Address.fields.zipCode"`
- `"actions.addTask.params.title"`
- `"computed.totalItems"`

**Constraints:**
- MUST be non-empty
- Segments MUST match Identifier grammar (MEL v0.3.3)
- MUST be stable across render (ordering independent)

### 4.3 TypeExpr AST (Decl View)

TypeExpr represents type declarations as structured AST, aligned with MEL v0.3.3:

```typescript
type TypeExpr =
  | { kind: 'primitive'; name: 'string' | 'number' | 'boolean' | 'null' }
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'ref'; name: string }
  | { kind: 'array'; element: TypeExpr }
  | { kind: 'record'; key: TypeExpr; value: TypeExpr }
  | { kind: 'union'; members: TypeExpr[] }
  | { kind: 'object'; fields: TypeField[] };

type TypeField = {
  readonly name: string;
  readonly optional: boolean;
  readonly type: TypeExpr;
};
```

**Constraints:**
- `union.members` MUST be flattened (no nested unions)
- `object` kind is allowed only inside TypeDecl
- `record.key` SHOULD be string, number, or literal union

### 4.4 ResolvedType (Resolved View)

ResolvedType is the **normalized form** for AI consumption:

```typescript
type ResolvedType =
  | { kind: 'primitive'; name: 'string' | 'number' | 'boolean' | 'null' }
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'array'; element: ResolvedType }
  | { kind: 'record'; key: ResolvedType; value: ResolvedType }
  | { kind: 'union'; members: ResolvedType[]; nullable: boolean }
  | { kind: 'object'; fields: ResolvedTypeField[]; typeName?: string };

type ResolvedTypeField = {
  readonly name: string;
  readonly optional: boolean;
  readonly type: ResolvedType;
};
```

**Key differences from TypeExpr:**
- No `ref` kind (all references resolved)
- `union` includes `nullable` flag for optimization
- `object` MAY include `typeName` for provenance

### 4.5 TypeIndex Contract

```typescript
type TypeIndex = Record<SemanticPath, ResolvedType>;
```

TypeIndex MUST include entries for:

| Category | Path Pattern | Example |
|----------|--------------|---------|
| State fields | `state.<field>` | `state.tracking` |
| Computed | `computed.<name>` | `computed.totalItems` |
| Action params | `actions.<action>.params.<param>` | `actions.addTask.params.title` |
| Type fields | `types.<Type>.fields.<field>` | `types.Address.fields.zipCode` |

**Invariants:**
- MUST be deterministic projection from `types + state + computed + actions`
- MUST NOT require LLM to resolve
- MUST be regenerated on schema change

### 4.6 First-Class Types in Schema

Target schema MUST expose:

| View | Description | Type |
|------|-------------|------|
| Decl View | Named type declarations | `types: Record<string, TypeExpr>` |
| Resolved View | Path-indexed resolved types | `typeIndex: TypeIndex` |

Translator SHOULD use `typeIndex` to:

* gate fast-path patterns,
* prune/boost anchor candidates,
* reduce model calls.

---

## 5. Architecture Overview (Pipeline)

Translator MUST implement the following pipeline. Each stage MUST emit trace data.

```
┌─────────────────────────────────────────────────────────────────┐
│  Stage 0: Deterministic Chunking (No LLM)                       │
│    Input: raw NL                                                │
│    Output: Section[]                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 1: Normalization                                         │
│    Input: Section[]                                             │
│    Output: NormalizationResult                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 2: Fast Path (Deterministic)                             │
│    Input: NormalizationResult                                   │
│    Output: FastPathResult                                       │
│    ─── hit ───────────────────────────────────────────► Stage 6 │
│    ─── miss ──┐                                                 │
└───────────────┼─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 3: Retrieval (Anchor Candidates)                         │
│    Input: NormalizationResult + typeIndex                       │
│    Output: RetrievalResult                                      │
└─────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 4: Memory Broker (Optional)                              │
│    Input: RetrievalResult + query context                       │
│    Output: MemorySelectionResult                                │
└─────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 5: Proposer (SLM by default)                             │
│    Input: canonical text + anchors + typeIndex + memories       │
│    Output: ProposalResult                                       │
└─────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 6: Result Assembly                                       │
│    Input: FastPathResult | ProposalResult                       │
│    Output: TranslationResult                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Stage 0 — Deterministic Chunking (No LLM)

* For long inputs, Translator MUST deterministically segment input into smaller sections (rule-based).
* Output: `Section[]` (ids + text slices).

### Stage 1 — Normalization

* Detect language (best-effort).
* Produce **canonical representation** (English-preferred, but not required).
* Preserve protected tokens deterministically (identifiers/numbers/quoted literals/etc.).
* Use Glossary mapping with semanticId-first normalization when available.

**Normalization Strategy:**
- If Glossary covers the input language → use Glossary-based canonicalization
- If input is already English-like → minimal normalization
- Otherwise → best-effort canonical form suitable for retrieval

**Determinism Requirement:** Normalization MUST be deterministic and offline-capable. Same input MUST produce same canonical output.

Output: `NormalizationResult`.

### Stage 2 — Fast Path (Deterministic)

* Attempt pattern-based, type-guided translation.
* MUST be no-network and low latency.

**Fast-path result handling:**

```
┌─────────────────────────────────────────────────────────────────┐
│  FastPathResult                                                 │
│    candidates: FastPathCandidate[]                              │
│    best: FastPathCandidate | null                               │
│    matched: boolean                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
         matched=true    matched=false    matched=false
                         candidates>0     candidates=0
              │               │               │
              ▼               ▼               ▼
         Stage 6         (see below)     (see below)
        (fragment)
```

**Fast-path miss handling (when `matched=false`):**

| Config | Condition | Result |
|--------|-----------|--------|
| `fastPathOnly=false` | Any | Proceed to Stage 3 |
| `fastPathOnly=true` | `candidates.length > 0` | `AmbiguityReport(kind='intent')` with candidates as options |
| `fastPathOnly=true` | `candidates.length == 0` | `TranslationError(code='FAST_PATH_MISS')` |

**Fast-path ambiguity (Normative):**

When `fastPathOnly=true` and candidates exist but none matched, Translator MUST return:

```typescript
const ambiguity: AmbiguityReport = {
  reportId: computeReportId(...),
  kind: 'intent',
  normalizedInput: norm.canonical,
  candidates: [
    // Map each FastPathCandidate to AmbiguityCandidate
    ...fastPathResult.candidates.map(c => ({
      optionId: c.patternId,
      description: `Apply pattern: ${c.patternId}`,
      fragments: c.fragments,
      confidence: c.confidence,
    })),
    // Always include cancel option
    {
      optionId: 'opt-cancel',
      description: 'Do not apply changes',
      fragments: [],
      confidence: 1.0,
    },
  ],
  resolutionPrompt: {
    question: 'Multiple patterns matched with low confidence. Select one:',
    optionIds: [...candidateIds, 'opt-cancel'],
  },
  partialFragments: [],
  createdAt: now,
};
```

Output: `FastPathResult`.

### Stage 3 — Retrieval (Anchor Candidates)

* Retrieve Top-K relevant anchors from schema/typeIndex and optional retrieval providers.
* Tiered retrieval MAY exist; Tier0 MUST work offline (OSS baseline).

Output: `RetrievalResult`.

### Stage 4 — Memory Broker (Optional, Recommended)

When input requires additional context beyond current schema:

* Translator MUST issue a memory query to `@manifesto-ai/memory` Selector.
* Translator MUST receive:
    * selected memories
    * MemoryTrace / MemorySelectionTrace
* Translator MUST treat memory as evidence, not truth.

### Stage 5 — Proposer (SLM by default)

* A small model (SLM) proposes **one or a small batch of fragments** given:
    * canonical text
    * candidate anchors
    * relevant typeIndex slice
    * selected memories (optional)
* Output is strictly schema constrained.

Translator MAY escalate to a larger model only for:

* intent decomposition ambiguity,
* persistent anchor ties after deterministic pruning,
* conflict resolution suggestion generation.

Output: `ProposalResult`.

### Stage 6 — Result Assembly

Translator returns one of:

| Result Kind | Condition |
|-------------|-----------|
| `TranslationResult.kind = 'fragment'` | One or more PatchFragments produced (or zero from cancel resolution) |
| `TranslationResult.kind = 'ambiguity'` | AmbiguityReport requiring Actor decision |
| `TranslationResult.kind = 'error'` | TranslationError |

**Fragment Count Rules:**

| Source | Allowed `fragments.length` |
|--------|---------------------------|
| Direct `translate()` | `>= 1` (zero → error) |
| `resolve()` with apply option | `>= 1` |
| `resolve()` with `opt-cancel` | `== 0` (no-op, any ambiguity kind) |

See §6.12 for full semantics.

---

## 6. Data Types (Normative Shapes)

Translator MUST support these artifacts (field names may be exact per implementation, but semantics MUST match):

### 6.1 TranslationRequest

```typescript
type TranslationRequest = {
  /** Raw natural language input */
  readonly input: string;
  
  /**
   * Target schema identifier.
   * Used for trace/audit. Actual schema is in TranslationContext.
   */
  readonly targetSchemaId: string;
  
  /** Stable identifier for this translation attempt */
  readonly intentId: string;
  
  /** Optional: Actor initiating the request */
  readonly actor?: ActorRef;
};
```

**Note:** `TranslationRequest` is a convenience type for logging/wire format. The normative input to `translate()` is the `(input, context)` tuple where `context.schema` is the source of truth.

### 6.2 Section

```typescript
type Section = {
  readonly sectionId: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly text: string;
};
```

### 6.3 NormalizationResult

```typescript
type NormalizationResult = {
  /** Canonical representation (English-preferred, not required) */
  readonly canonical: string;
  
  /** Detected language (ISO 639-1) */
  readonly language: string;
  
  /** Protected tokens with positions */
  readonly tokens: ProtectedToken[];
  
  /** Glossary matches */
  readonly glossaryHits: GlossaryHit[];
};

type ProtectedToken = {
  readonly original: string;
  readonly position: { start: number; end: number };
  readonly kind: 'identifier' | 'number' | 'quoted' | 'symbol';
};

type GlossaryHit = {
  readonly semanticId: string;
  readonly canonical: string;
  readonly originalTerm: string;
  readonly confidence: number;
};
```

### 6.4 FastPathResult

```typescript
type FastPathResult = {
  /** Whether a high-confidence match was found */
  readonly matched: boolean;
  
  /** Best candidate (may exist even when not matched) */
  readonly best: FastPathCandidate | null;
  
  /**
   * All pattern candidates found.
   * Empty array means no patterns matched at all.
   * Non-empty with low confidence means patterns exist but uncertain.
   */
  readonly candidates: FastPathCandidate[];
};

type FastPathCandidate = {
  /** Pattern identifier */
  readonly patternId: string;
  
  /** Proposed fragments if pattern applied */
  readonly fragments: PatchFragment[];
  
  /** Confidence score (0-1) */
  readonly confidence: number;
  
  /** Match evidence */
  readonly evidence?: string[];
};
```

**Fast Path Match Semantics:**

| `candidates.length` | `best` | `matched` | Meaning |
|---------------------|--------|-----------|---------|
| `0` | `null` | `false` | No patterns matched |
| `>= 1` | non-null | `false` | Patterns found but confidence below threshold |
| `>= 1` | non-null | `true` | High-confidence match found |

**Match Threshold:**

`matched = true` when `best.confidence >= config.confidencePolicy.autoAcceptThreshold`.

### 6.5 RetrievalResult

```typescript
type RetrievalResult = {
  /** Retrieval tier used */
  readonly tier: 0 | 1 | 2;
  
  /** Retrieved anchor candidates */
  readonly candidates: AnchorCandidate[];
};

type AnchorCandidate = {
  readonly path: SemanticPath;
  readonly score: number;
  readonly matchType: 'exact' | 'fuzzy' | 'semantic';
  readonly evidence: string[];
  readonly resolvedType?: ResolvedType;
};
```

### 6.6 ProposalResult

```typescript
type ProposalResult = {
  /** Produced fragments */
  readonly fragments: PatchFragment[] | null;
  
  /** Ambiguity if detected */
  readonly ambiguity: AmbiguityReport | null;
  
  /** Confidence score (0-1) */
  readonly confidence: number;
  
  /** Evidence strings for audit */
  readonly evidence: string[];
};
```

### 6.7 PatchFragment

PatchFragment MUST represent schema-level semantic changes (not MEL text).

```typescript
type PatchFragment = {
  /**
   * Unique fragment identifier.
   * MUST be deterministically derived: sha256(intentId + ':' + canonicalize(op))
   * where canonicalize() follows RFC 8785 (JCS). See §13.2.
   * 
   * No ordinal: fragmentId is content-addressed and order-independent.
   */
  readonly fragmentId: string;
  
  /** Source intent identifier */
  readonly sourceIntentId: string;
  
  /** Fragment operation */
  readonly op: PatchOp;
  
  /** Confidence score (0-1) */
  readonly confidence: number;
  
  /** Evidence strings */
  readonly evidence: string[];
  
  /**
   * Creation timestamp (ISO 8601).
   * Observational metadata: excluded from determinism requirements.
   */
  readonly createdAt: string;
};
```

#### 6.7.1 PatchOp (v1 Operator Set)

**JsonValue (Normative):**

```typescript
/**
 * JSON-serializable value type.
 * Used for default values and literal expressions.
 */
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
```

**v1 Core Operators (MUST support):**

```typescript
type PatchOp =
  // Type operations
  | { kind: 'addType'; typeName: string; typeExpr: TypeExpr }
  | { kind: 'addField'; typeName: string; field: TypeField }
  | { kind: 'setFieldType'; path: SemanticPath; typeExpr: TypeExpr }
  | { kind: 'setDefaultValue'; path: SemanticPath; value: JsonValue }
  
  // Constraint operations
  | { kind: 'addConstraint'; targetPath: SemanticPath; rule: ExprNode; message?: string }
  
  // Computed operations (optional v1, gated)
  | { kind: 'addComputed'; name: string; expr: ExprNode; deps?: SemanticPath[] }
  
  // Action availability (optional v1, gated)
  | { kind: 'addActionAvailable'; actionName: string; expr: ExprNode };
```

**setDefaultValue Constraints (Normative):**

| Constraint | Description |
|------------|-------------|
| JSON-serializable | `value` MUST be JSON-serializable (JsonValue) |
| MEL-representable | `value` MUST be representable as MEL literal/object/array expression |
| No system refs | `value` MUST NOT contain `$system.*`, `$meta.*`, or `$input.*` semantics |
| No functions | `value` MUST NOT contain functions, Date, BigInt, or other non-JSON types |
| Deterministic | `value` MUST be a pure, deterministic literal |

**Rationale:** MEL state initializers MUST be deterministic. The deterministic renderer MUST be able to emit `value` as a valid MEL expression without runtime resolution.
```

**v1 Explicit Non-Goals (NOT supported):**

| Operator | Reason for Exclusion |
|----------|---------------------|
| `removeType` | Large ripple effect, orphan references |
| `renameField` | Requires data migration coordination |
| `removeConstraint` | Policy/governance implications |
| `removeField` | Data loss risk, requires migration |

These operations SHOULD be expressed as composite fragment programs in v2.

### 6.7.2 Fragment Ordering and Dependencies

**Order Independence (Normative):**

`TranslationResult.fragments` array order is **semantically insignificant**. The order in which fragments appear in the array MUST NOT affect the final applied state.

**Applicator Responsibility:**

The entity applying fragments (Host or Authority) MUST perform **deterministic topological ordering** before application:

| Priority | Operator Kind | Rationale |
|----------|---------------|-----------|
| 1 | `addType` | Types must exist before fields reference them |
| 2 | `addField` | Fields must exist before constraints reference them |
| 3 | `setFieldType` | Type changes before default values |
| 4 | `setDefaultValue` | Defaults before constraints validate them |
| 5 | `addConstraint` | Constraints last (depend on fields/types) |
| 6 | `addComputed` | May depend on fields |
| 7 | `addActionAvailable` | May depend on computed |

**Explicit Dependencies (Optional):**

For complex multi-fragment translations, Translator MAY use `PatchProgram` (§6.10) which includes explicit `dependencies` DAG. When `PatchProgram.dependencies` is provided, applicator MUST respect it over default ordering.

**Conflict Detection:**

If two fragments in the same result conflict (e.g., two `setFieldType` on same path), Translator MUST handle as follows:

**Conflict Handling Priority (Normative):**

| Scenario | Handling |
|----------|----------|
| Identical ops (same fragmentId) | Deduplicate (keep one) |
| Different ops, same target path | `TranslationError(FRAGMENT_CONFLICT)` |
| Resolvable conflict (rare) | `AmbiguityReport(kind='conflict')` |

**When to use error vs ambiguity:**

- **Error (default)**: When conflict is clearly a proposer mistake or constraint violation. The Actor cannot meaningfully choose between them.
- **Ambiguity**: When both options are semantically valid and Actor preference matters. This is rare in v1 operator set.

For v1, Translator SHOULD default to `FRAGMENT_CONFLICT` error. Ambiguity is reserved for future operators where Actor choice is meaningful (e.g., choosing between two valid migration strategies).

### 6.8 AmbiguityReport

```typescript
type AmbiguityReport = {
  /** Unique report identifier */
  readonly reportId: string;
  
  /** Ambiguity kind */
  readonly kind: AmbiguityKind;
  
  /** Normalized input that triggered ambiguity */
  readonly normalizedInput: string;
  
  /**
   * Candidate options.
   * MUST contain at least 2 candidates for ALL ambiguity kinds.
   */
  readonly candidates: AmbiguityCandidate[];
  
  /** Resolution prompt for Actor */
  readonly resolutionPrompt: {
    readonly question: string;
    readonly optionIds: string[];
  };
  
  /** Already-determined progress */
  readonly partialFragments: PatchFragment[];
  
  /** Creation timestamp (ISO 8601) */
  readonly createdAt: string;
};

type AmbiguityKind = 'target' | 'intent' | 'value' | 'conflict' | 'policy';

type AmbiguityCandidate = {
  readonly optionId: string;
  readonly description: string;
  readonly fragments: PatchFragment[];
  readonly confidence: number;
};
```

**Candidates Constraint (Normative):**

ALL AmbiguityReports MUST have `candidates.length >= 2`. This includes `kind='policy'` ambiguity.

For policy/confidence-based ambiguity, Translator MUST provide:

| Option | optionId | Description | Fragments |
|--------|----------|-------------|-----------|
| Apply | `opt-apply` | Apply proposed changes | Proposed fragments |
| Cancel | `opt-cancel` | Do not apply changes | `[]` (empty) |

**Example:**

```typescript
const policyAmbiguity: AmbiguityReport = {
  reportId: 'amb-123',
  kind: 'policy',
  normalizedInput: 'add email validation',
  candidates: [
    {
      optionId: 'opt-apply',
      description: 'Apply: Add email validation constraint',
      fragments: [proposedFragment],
      confidence: 0.75,
    },
    {
      optionId: 'opt-cancel',
      description: 'Cancel: Do not apply changes',
      fragments: [],
      confidence: 1.0,
    },
  ],
  resolutionPrompt: {
    question: 'Confidence is below threshold (0.75 < 0.95). Apply changes?',
    optionIds: ['opt-apply', 'opt-cancel'],
  },
  partialFragments: [],
  createdAt: '2025-01-03T12:00:00Z',
};
```
```

### 6.9 AmbiguityResolution

Resolution is recorded as a **separate artifact**, not mutating AmbiguityReport:

```typescript
type AmbiguityResolution = {
  /** Reference to the resolved report */
  readonly reportId: string;
  
  /** Chosen resolution */
  readonly choice: 
    | { kind: 'option'; optionId: string }
    | { kind: 'freeform'; input: string };
  
  /** Who resolved */
  readonly resolvedBy: ActorRef;
  
  /** Resolution timestamp (ISO 8601) */
  readonly resolvedAt: string;
};
```

### 6.10 PatchProgram

For long/complex documents, Translator SHOULD support producing:

```typescript
type PatchProgram = {
  /** Program identifier */
  readonly programId: string;
  
  /** Ordered fragments */
  readonly fragments: PatchFragment[];
  
  /** Dependencies (DAG) */
  readonly dependencies: Record<string, string[]>;
  
  /** Program status */
  readonly status: ProgramStatus;
  
  /** Pending ambiguity resolutions */
  readonly pendingResolutions?: string[];
};

type ProgramStatus = 
  | { kind: 'complete' }
  | { kind: 'partial'; pendingAmbiguity: string[] }
  | { kind: 'failed'; error: TranslationError };
```

### 6.11 TranslationTrace

Every call MUST emit:

```typescript
type TranslationTrace = {
  /** Trace identifier */
  readonly traceId: string;
  
  /** Request metadata */
  readonly request: {
    readonly intentId: string;
    readonly atWorldId: string;
    readonly inputLength: number;
    readonly inputPreview?: string;  // First N chars if enabled
    readonly inputHash: string;
    readonly language: string;
  };
  
  /** Stage traces */
  readonly stages: {
    readonly chunking?: ChunkingTrace;
    readonly normalization?: NormalizationTrace;
    readonly fastPath?: FastPathTrace;
    readonly retrieval?: RetrievalTrace;
    readonly memory?: MemoryStageTrace;
    readonly proposer?: ProposerTrace;
    readonly assembly?: AssemblyTrace;
  };
  
  /** Final result kind */
  readonly resultKind: 'fragment' | 'ambiguity' | 'error';
  
  /** Timing */
  readonly timing: {
    readonly startedAt: string;
    readonly completedAt: string;
    readonly durationMs: number;
  };
  
  /** Ambiguity resolution if applicable */
  readonly ambiguityResolution?: AmbiguityResolution;
};
```

**Stage Trace Required Fields (Normative):**

Each stage trace MUST include at minimum:

```typescript
type ChunkingTrace = {
  readonly sectionCount: number;
  readonly durationMs: number;
};

type NormalizationTrace = {
  readonly detectedLanguage: string;
  readonly glossaryHitCount: number;
  readonly protectedTokenCount: number;
  readonly durationMs: number;
};

type FastPathTrace = {
  readonly attempted: boolean;
  readonly matched: boolean;
  readonly candidateCount: number;
  readonly bestPatternId?: string;
  readonly bestConfidence?: number;
  readonly durationMs: number;
};

type RetrievalTrace = {
  readonly tier: 0 | 1 | 2;
  readonly candidateCount: number;
  readonly topScore?: number;
  readonly durationMs: number;
};

type MemoryStageTrace = {
  readonly atWorldId: string;
  /**
   * MemoryTrace from @manifesto-ai/memory v1.0.0.
   * Created via MemoryTraceUtils.create(request, result).
   * MUST be present when memory was used.
   * Caller (Actor) MUST attach this to Proposal for Authority verification.
   */
  readonly trace?: MemoryTrace;
  readonly selectedCount: number;
  readonly averageConfidence?: number;
  readonly durationMs: number;
};

/**
 * MemoryTrace is defined in @manifesto-ai/memory v1.0.0.
 * Translator MUST NOT redefine this type; import from memory package.
 * 
 * See @manifesto-ai/memory v1.0.0 SPEC §5.1.5 for full definition.
 * See §8.2 of this spec for reference copy.
 */

type ProposerTrace = {
  readonly modelId: string;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly escalated: boolean;
  readonly escalationReason?: string;
  readonly durationMs: number;
};

type AssemblyTrace = {
  readonly fragmentCount: number;
  readonly finalConfidence: number;
  readonly resultKind: 'fragment' | 'ambiguity' | 'error';
  readonly durationMs: number;
};
```

Trace MUST be JSON-serializable and safe to store.

### 6.12 TranslationResult

```typescript
type TranslationResult =
  | { kind: 'fragment'; fragments: PatchFragment[]; trace: TranslationTrace }
  | { kind: 'ambiguity'; report: AmbiguityReport; trace: TranslationTrace }
  | { kind: 'error'; error: TranslationError; trace: TranslationTrace };
```

**Fragment Result Semantics:**

| `fragments.length` | Meaning | When Allowed |
|--------------------|---------|--------------|
| `>= 1` | Semantic changes proposed | Normal translation result |
| `== 0` | No-op (no changes) | **Only** from `opt-cancel` resolution |

**No-op Result (Normative):**

A `kind='fragment'` result with `fragments: []` is valid **only** when:
1. Result comes from `resolve()` call
2. Actor chose `opt-cancel` option

This applies to **all ambiguity kinds** that include `opt-cancel`:
- `kind='policy'` (confidence-based)
- `kind='intent'` (fast-path candidates)
- `kind='target'`, `kind='value'`, `kind='conflict'` (if they include cancel option)

The no-op result represents an explicit "do not apply changes" decision by the Actor.

```typescript
// Example: Actor resolves ANY ambiguity with cancel
const resolution: AmbiguityResolution = {
  reportId: report.reportId,
  choice: { kind: 'option', optionId: 'opt-cancel' },
  resolvedBy: actor,
  resolvedAt: now,
};

const result = await resolve(report, resolution, context);
// result = { kind: 'fragment', fragments: [], trace: ... }
// This is valid regardless of report.kind
```

**Direct Translation:**

When `translate()` produces a fragment result directly (not via resolution), `fragments.length` MUST be `>= 1`. If proposer produces zero fragments, it MUST return `error(NO_FRAGMENTS_PRODUCED)`.

---

## 7. Glossary

### 7.1 Purpose

Glossary provides **stable semantic anchoring** for multilingual inputs. Normalization uses Glossary to map aliases to canonical semantic identifiers.

### 7.2 GlossaryEntry

```typescript
type GlossaryEntry = {
  /** Stable semantic identifier */
  readonly semanticId: string;
  
  /** Canonical English token/phrase */
  readonly canonical: string;
  
  /** Aliases by language (ISO 639-1 → aliases) */
  readonly aliases: Record<string, string[]>;
  
  /** Optional: hints for anchor resolution */
  readonly anchorHints?: SemanticPath[];
  
  /** Part of speech */
  readonly pos?: 'noun' | 'verb' | 'adj' | 'adv';
  
  /** Entry provenance */
  readonly provenance?: 'builtin' | 'project' | 'user';
};
```

**Examples:**

```typescript
const greaterThanOrEqual: GlossaryEntry = {
  semanticId: 'op.gte',
  canonical: 'greater than or equal',
  aliases: {
    en: ['>=', 'at least', 'no less than'],
    ko: ['이상', '크거나 같은'],
    ja: ['以上'],
  },
  pos: 'adj',
  provenance: 'builtin',
};

const userEntity: GlossaryEntry = {
  semanticId: 'entity.user',
  canonical: 'user',
  aliases: {
    en: ['user', 'member', 'account'],
    ko: ['사용자', '유저', '회원'],
  },
  anchorHints: ['types.User', 'state.currentUser'],
  pos: 'noun',
  provenance: 'project',
};
```

### 7.3 Glossary Interface

```typescript
interface Glossary {
  /**
   * Find entry by term.
   * @param term - Term to look up
   * @param language - Optional language hint (ISO 639-1)
   * @returns Matching entry or null
   */
  find(term: string, language?: string): GlossaryEntry | null;
  
  /**
   * Get all entries.
   * @returns All glossary entries
   */
  entries(): GlossaryEntry[];
  
  /**
   * Find by semantic ID.
   * @param semanticId - Semantic identifier
   * @returns Matching entry or null
   */
  getBySemanticId(semanticId: string): GlossaryEntry | null;
}
```

### 7.4 Normalization Strategy

Normalization is NOT translation. It is:

```
alias → semanticId → canonical
```

**Example:**

```
Input (Korean): "사용자 이름은 5자 이상이어야 함"
                    ↓
Glossary lookup: "사용자" → entity.user → "user"
                 "이상" → op.gte → "greater than or equal"
                    ↓
Canonical: "user name must be greater than or equal to 5 characters"
```

---

## 8. Memory Integration (Normative)

Translator MUST integrate with `@manifesto-ai/memory` v1.0.0 as follows:

| Rule | Description |
|------|-------------|
| Memory as Evidence | Translator MUST NOT treat memory summaries/excerpts as truth. |
| Selection via Selector | Translator MAY request memory selection via Selector. |
| Trace Creation | Translator MUST use `MemoryTraceUtils.create()` to create trace from selection result. |
| Trace Return | Translator MUST return `MemoryTrace` in `TranslationTrace.stages.memory.trace` when memory was used. |
| Attachment Responsibility | Caller (Actor) MUST attach `MemoryTrace` to Proposal for Authority verification. |
| Authority Boundary | Authority MUST NOT call Store or prove(); Authority MAY call verifyProof() only. |
| Evidence Quality | Translator MUST surface `verified/confidence/evidence` signals and MAY produce `policy` ambiguity when evidence quality is insufficient. |

### 8.1 Memory Request Flow

This flow aligns with `@manifesto-ai/memory` v1.0.0 API:

```typescript
import { MemoryTraceUtils } from '@manifesto-ai/memory';

// 1. Build selection request per memory package contract
const memoryRequest: SelectionRequest = {
  query: normalizedInput,
  atWorldId: context.atWorldId,  // REQUIRED: World reference point
  selector: context.actor ?? { actorId: 'translator', kind: 'system' },
  constraints: {
    maxResults: 5,
    minConfidence: 0.7,
    requireVerified: true,
  },
};

// 2. Call selector.select() → SelectionResult (per memory v1.0.0)
const selectionResult: SelectionResult = await selector.select(memoryRequest);
// selectionResult = { selected: SelectedMemory[], selectedAt: number }

// 3. Create MemoryTrace using package utility
const memoryTrace: MemoryTrace = MemoryTraceUtils.create(
  memoryRequest,
  selectionResult
);

// 4. Attach to TranslationTrace
trace.stages.memory = {
  atWorldId: context.atWorldId,
  trace: memoryTrace,  // ✅ MemoryTrace per memory v1.0.0
  selectedCount: selectionResult.selected.length,
  averageConfidence: computeAverage(selectionResult.selected.map(s => s.confidence)),
  durationMs: elapsed,
};
```

### 8.2 Memory Package Types (Reference)

These types are defined in `@manifesto-ai/memory` v1.0.0. Translator MUST NOT redefine them.

```typescript
// From @manifesto-ai/memory v1.0.0
type SelectionRequest = {
  readonly query: string;
  readonly atWorldId: string;
  readonly selector: ActorRef;
  readonly constraints?: SelectionConstraints;
};

type SelectionResult = {
  readonly selected: readonly SelectedMemory[];
  readonly selectedAt: number;
};

type SelectedMemory = {
  readonly ref: MemoryRef;
  readonly reason: string;
  readonly confidence: number;
  readonly verified: boolean;
  readonly evidence?: VerificationEvidence;
};

type MemoryTrace = {
  readonly query: string;
  readonly atWorldId: string;
  readonly selector: ActorRef;
  readonly selected: readonly SelectedMemory[];
  readonly selectedAt: number;
};
```

### 8.3 Trace Attachment Contract

Translator does NOT create Proposals directly. The responsibility chain is:

```
Translator → returns TranslationResult with MemoryTrace
     ↓
Actor (caller) → extracts trace.stages.memory.trace
     ↓
Actor → uses MemoryTraceUtils.attachToProposal(proposal, memoryTrace)
     ↓
Authority → calls verifyProof() on evidence from Proposal
```

**Invariants:**
- `atWorldId` MUST be passed to Memory Selector
- `MemoryTrace` MUST be included in TranslationTrace when memory was used
- Actor MUST use `MemoryTraceUtils.attachToProposal()` to attach trace
- Authority MUST NOT re-select; it only verifies provided evidence

---

## 9. Public API (Normative Semantics)

Translator MUST expose:

### 9.1 translate

```typescript
function translate(
  input: string,
  context: TranslationContext
): Promise<TranslationResult>;
```

Translates a single natural language input.

### 9.2 translateMany

```typescript
function translateMany(
  inputs: string[],
  context: TranslationContext
): Promise<PatchProgram>;
```

Translates multiple inputs into a coordinated patch program.

### 9.3 resolve

```typescript
function resolve(
  report: AmbiguityReport,
  resolution: AmbiguityResolution,
  context: TranslationContext
): Promise<TranslationResult>;
```

Resolves a pending ambiguity and continues translation.

**Stateless Design Rationale:**

Translator is **stateless** by design. The caller MUST provide:
- `report`: The original AmbiguityReport (immutable)
- `resolution`: The Actor's choice
- `context`: The same TranslationContext used in the original `translate()` call

This design:
- Avoids session state management complexity
- Enables horizontal scaling without shared state
- Allows resolution across process restarts
- Makes retry semantics explicit

**Invariants:**
- `resolution.reportId` MUST match `report.reportId`
- `context.atWorldId` SHOULD match the original translation context
- If `context` differs, Translator MAY re-validate and produce different results

**Idempotency:**
- Calling `resolve()` multiple times with the same inputs SHOULD produce the same result
- The `resolution.resolvedAt` timestamp does NOT affect output (for idempotency)

### 9.4 reset

```typescript
function reset(): void;
```

Optional convenience method. MUST remain Host-Contract compliant if modeled in MEL.

### 9.5 TranslationContext

```typescript
type TranslationContext = {
  /** Target schema (with typeIndex) */
  readonly schema: DomainSchema;
  
  /** Type index for fast lookup */
  readonly typeIndex: TypeIndex;
  
  /** Intent identifier */
  readonly intentId: string;
  
  /**
   * REQUIRED: Current World reference point.
   * 
   * Used for:
   * - Memory selection anchoring (passed to selector.select())
   * - Proposal anchoring (what World this change applies to)
   * - Authority verification context
   * 
   * WorldId format is opaque per World Protocol SPEC.
   */
  readonly atWorldId: string;
  
  /** Glossary (optional override) */
  readonly glossary?: Glossary;
  
  /** Retrieval tier preference */
  readonly retrievalTier?: 0 | 1 | 2;
  
  /** Model policy */
  readonly modelPolicy?: 'small' | 'large' | 'auto';
  
  /** Actor context */
  readonly actor?: ActorRef;
};
```

**atWorldId Invariants:**
- MUST be provided in every translation request
- MUST be valid WorldId per World Protocol
- MUST be passed to Memory Selector as `atWorldId`
- MUST be recorded in TranslationTrace for audit

**Schema/TypeIndex Consistency:**

`context.schema` and `context.typeIndex` MUST be consistent. Specifically:
- `typeIndex` MUST be derived from `schema` (or the same source)
- If they are inconsistent (e.g., typeIndex references types not in schema), Translator MUST return `TranslationError(code='INVALID_CONTEXT')` before Stage 0.

Implementations MAY compute `typeIndex` from `schema` at translate() entry if only `schema` is provided.

---

## 10. Validation Rules (Translator-Level)

Translator MAY perform **structural validation** (frontend validation):

| Validation | Description |
|------------|-------------|
| Path Existence | Referenced paths exist (where applicable) |
| Operator Allowlist | Fragment kind is allowed by v1 operator set |
| Expression Validity | Expressions are valid MEL call-only ExprNode |
| Type Reference | Type refs exist or are introduced by the same program |

Translator MUST NOT perform governance approval; governance remains Authority's role.

---

## 11. Configuration (Normative Behaviors)

### 11.1 Required Configuration

```typescript
type TranslatorConfig = {
  /** Retrieval tier preference (default: 0) */
  retrievalTier: 0 | 1 | 2;
  
  /** SLM model selection */
  slmModel: string;
  
  /** Escalation threshold for larger model */
  escalationThreshold: number;
  
  /** Fast-path enable/disable */
  fastPathEnabled: boolean;
  
  /** Fast-path only mode */
  fastPathOnly: boolean;
  
  /** Confidence policy */
  confidencePolicy: ConfidencePolicy;
  
  /** Trace configuration */
  traceConfig: TraceConfig;
};
```

**Fast-Path Configuration Priority:**

| `fastPathEnabled` | `fastPathOnly` | Behavior |
|-------------------|----------------|----------|
| `true` | `false` | Normal: try fast-path, fallback to proposer on miss |
| `true` | `true` | Strict: fast-path only, error/ambiguity on miss |
| `false` | `*` | Skip: always proceed to proposer (ignore `fastPathOnly`) |

When `fastPathEnabled=false`, the `fastPathOnly` flag is ignored and Stage 2 is skipped entirely.

### 11.2 Confidence Policy

```typescript
type ConfidencePolicy = {
  /**
   * Auto-accept threshold (RECOMMENDED: 0.95)
   * Confidence >= this returns fragment directly.
   */
  autoAcceptThreshold: number;
  
  /**
   * Reject threshold (RECOMMENDED: 0.30)
   * Confidence < this returns error.
   * Between reject and autoAccept returns policy ambiguity.
   */
  rejectThreshold: number;
};
```

**Result Determination Priority (Normative):**

The following rules are evaluated **in order**. The first matching rule determines the result:

1. **Structural Ambiguity First:** If Proposer detects structural ambiguity (multiple valid interpretations), return `ambiguity` regardless of confidence score.

2. **Error on Low Confidence:** If `confidence < rejectThreshold`, return `error(CONFIDENCE_TOO_LOW)`.

3. **Fragment on High Confidence:** If `confidence >= autoAcceptThreshold`, return `fragment`.

4. **Policy Ambiguity on Medium Confidence:** If `rejectThreshold <= confidence < autoAcceptThreshold`, return `ambiguity(kind='policy')` with two candidates: `opt-apply` and `opt-cancel`.

**Confidence → Result Summary:**

| Condition | Result |
|-----------|--------|
| Structural ambiguity detected | `ambiguity` (multiple interpretations) |
| `confidence < rejectThreshold` | `error(CONFIDENCE_TOO_LOW)` |
| `confidence >= autoAcceptThreshold` | `fragment` |
| `rejectThreshold <= confidence < autoAcceptThreshold` | `ambiguity(kind='policy')` with apply/cancel |

**Policy Ambiguity Candidates (Normative):**

When returning `ambiguity(kind='policy')` due to confidence thresholds, Translator MUST provide exactly two candidates:

```typescript
candidates: [
  {
    optionId: 'opt-apply',
    description: 'Apply proposed changes',
    fragments: proposedFragments,
    confidence: actualConfidence,
  },
  {
    optionId: 'opt-cancel',
    description: 'Do not apply changes',
    fragments: [],
    confidence: 1.0,
  },
]
```

This ensures `candidates.length >= 2` invariant is always satisfied.

### 6.8.1 opt-cancel as Universal Pattern

The `opt-cancel` candidate is a **universal escape hatch** that SHOULD be included in most ambiguity types:

| Ambiguity Kind | Include opt-cancel? | Rationale |
|----------------|---------------------|-----------|
| `policy` | **MUST** | Confidence-based; Actor may reject low-confidence proposals |
| `intent` | **SHOULD** | Pattern ambiguity; Actor may want to abort and rephrase |
| `target` | **SHOULD** | Target unclear; Actor may want to clarify first |
| `value` | MAY | Value ambiguity; sometimes all options are valid attempts |
| `conflict` | MAY | Usually error is more appropriate than Actor choice |

When `opt-cancel` is included and chosen, `resolve()` returns `{ kind: 'fragment', fragments: [] }`. See §6.12.

### 11.3 Trace Configuration

```typescript
type TraceConfig = {
  /** Trace sink */
  sink: 'file' | 'callback' | 'none';
  
  /** Include raw input in trace */
  includeRawInput: boolean;
  
  /** Include raw model response */
  includeRawModelResponse: boolean;
  
  /** Maximum preview length */
  previewMaxLength: number;
};
```

---

## 12. Error Handling

### 12.1 TranslationError

```typescript
type TranslationError = {
  /** Error code */
  readonly code: TranslationErrorCode;
  
  /** Human-readable message */
  readonly message: string;
  
  /** Stage where error occurred */
  readonly stage: TranslationStage;
  
  /** Whether error is recoverable */
  readonly recoverable: boolean;
  
  /** Additional context */
  readonly context?: Record<string, unknown>;
};

type TranslationStage = 
  | 'chunking'
  | 'normalization'
  | 'fastPath'
  | 'retrieval'
  | 'memory'
  | 'proposer'
  | 'assembly';
```

### 12.2 Error Codes (Normative)

| Code | Stage | Recoverable | Description |
|------|-------|-------------|-------------|
| `INVALID_CONTEXT` | (pre-stage) | No | schema/typeIndex inconsistency |
| `NORMALIZATION_FAILED` | normalization | No | Failed to normalize input |
| `SCHEMA_NOT_FOUND` | retrieval | No | Target schema not found |
| `TYPE_MISMATCH` | proposer | No | Proposed type incompatible with schema |
| `FAST_PATH_MISS` | fastPath | No | No pattern match in fast-path only mode |
| `RETRIEVAL_TIMEOUT` | retrieval | Yes | Retrieval provider timed out |
| `RETRIEVAL_UNAVAILABLE` | retrieval | Yes | Retrieval provider unavailable |
| `MEMORY_UNAVAILABLE` | memory | Yes | Memory selector unavailable |
| `MEMORY_TIMEOUT` | memory | Yes | Memory selection timed out |
| `PROPOSER_FAILURE` | proposer | Yes | Model failed to produce valid output |
| `PROPOSER_TIMEOUT` | proposer | Yes | Model timed out |
| `NO_FRAGMENTS_PRODUCED` | assembly | No | Proposer produced zero fragments |
| `FRAGMENT_CONFLICT` | assembly | No | Multiple fragments conflict on same target |
| `INVALID_FRAGMENT` | assembly | No | Produced fragment failed validation |
| `CONFIDENCE_TOO_LOW` | assembly | No | Confidence below reject threshold |

### 12.3 Recovery Strategy

For recoverable errors, Translator MAY:

| Error | Recovery Strategy |
|-------|-------------------|
| `RETRIEVAL_TIMEOUT` | Retry with Tier 0 (offline) |
| `RETRIEVAL_UNAVAILABLE` | Fall back to Tier 0 |
| `MEMORY_UNAVAILABLE` | Proceed without memory |
| `MEMORY_TIMEOUT` | Proceed without memory |
| `PROPOSER_FAILURE` | Retry with different prompt |
| `PROPOSER_TIMEOUT` | Retry with smaller context |

---

## 13. Determinism Requirements

### 13.1 Determinism Scope

Determinism applies to **semantic payload** only. Observational metadata is explicitly excluded.

| Category | Examples | Deterministic? |
|----------|----------|----------------|
| Semantic Payload | fragment ops, expressions, types, paths | **MUST** |
| Observational Metadata | traceId, timing.*, durationMs | Excluded |
| Identity (see §13.2) | fragmentId, reportId | **MUST** (derived) |

### 13.2 Canonical JSON Serialization (Normative)

To ensure deterministic identity generation, all JSON serialization for hashing MUST follow **RFC 8785 (JSON Canonicalization Scheme, JCS)**.

**Key Rules:**
- Object keys MUST be sorted lexicographically (Unicode code point order)
- No whitespace between tokens
- Numbers in shortest form (no trailing zeros)
- Strings escaped per RFC 8785

**Semantic Collection Ordering (Normative):**

Some MEL constructs contain collections that are **semantically unordered** (order doesn't affect meaning). For deterministic hashing, these MUST be sorted before canonicalization:

| Type | Field | Sort Key |
|------|-------|----------|
| `TypeExpr (union)` | `members` | `canonicalize(member)` lexicographic |
| `TypeExpr (object)` | `fields` | `field.name` lexicographic |
| `ResolvedType (union)` | `members` | `canonicalize(member)` lexicographic |
| `ResolvedType (object)` | `fields` | `field.name` lexicographic |

**Example:**

```typescript
// These two produce the SAME fragmentId:
{ kind: 'union', members: [{ kind: 'literal', value: 'a' }, { kind: 'literal', value: 'b' }] }
{ kind: 'union', members: [{ kind: 'literal', value: 'b' }, { kind: 'literal', value: 'a' }] }

// Because members are sorted before hashing:
// sorted: [{ kind: 'literal', value: 'a' }, { kind: 'literal', value: 'b' }]
```

**Reference Implementation:**

```typescript
function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort(); // lexicographic
    const pairs = keys.map(k => JSON.stringify(k) + ':' + canonicalize((value as any)[k]));
    return '{' + pairs.join(',') + '}';
  }
  throw new Error('Unsupported type');
}

function canonicalizeTypeExpr(expr: TypeExpr): TypeExpr {
  if (expr.kind === 'union') {
    // Sort members by their canonical form
    const sorted = [...expr.members]
      .map(canonicalizeTypeExpr)
      .sort((a, b) => canonicalize(a).localeCompare(canonicalize(b)));
    return { kind: 'union', members: sorted };
  }
  if (expr.kind === 'object') {
    // Sort fields by name
    const sorted = [...expr.fields]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(f => ({ ...f, type: canonicalizeTypeExpr(f.type) }));
    return { kind: 'object', fields: sorted };
  }
  // Other kinds pass through
  return expr;
}
```

### 13.3 Deterministic Identity Generation

Identity fields MUST be derived deterministically using canonical JSON:

```typescript
// fragmentId: content-addressed, order-independent
fragmentId = sha256(intentId + ':' + canonicalize(op))

// reportId: content-addressed with sorted components
reportId = sha256(intentId + ':' + canonicalize({
  normalizedInput,
  // Candidates sorted by optionId for determinism
  candidateOps: candidates
    .sort((a, b) => a.optionId.localeCompare(b.optionId))
    .map(c => ({
      optionId: c.optionId,
      // Fragments sorted by fragmentId for determinism
      fragmentIds: c.fragments
        .map(f => f.fragmentId)
        .sort()
    }))
}))

// traceId: MAY be non-deterministic (observational)
traceId = uuid() // allowed
```

**Critical: No Ordinal in fragmentId**

`fragmentId` MUST NOT depend on fragment ordering. This ensures:
- Same operation produces same ID regardless of proposer output order
- Deduplication works correctly
- Cache keys are stable

**reportId Sorting Rules (Normative):**

To ensure deterministic `reportId`:
1. `candidates` MUST be sorted by `optionId` (lexicographic)
2. Within each candidate, `fragments` MUST be sorted by `fragmentId` (lexicographic)
3. Only `optionId` and `fragmentId` arrays are included (not full fragment content, which is already captured by fragmentId)

**Fragment Deduplication:**

When assembling fragments, implementations SHOULD deduplicate by `fragmentId`:

```typescript
function deduplicateFragments(fragments: PatchFragment[]): PatchFragment[] {
  const seen = new Set<string>();
  return fragments.filter(f => {
    if (seen.has(f.fragmentId)) return false;
    seen.add(f.fragmentId);
    return true;
  });
}
```

### 13.4 Semantic Hash

For diff stability and caching, implementations SHOULD compute semantic hash:

```typescript
type SemanticHash = string; // sha256 hex

function computeSemanticHash(
  canonical: string,
  schemaHash: string,
  ops: PatchOp[]
): SemanticHash {
  // Sort ops by their canonical form for order-independence
  const sortedOps = [...ops].sort((a, b) => 
    canonicalize(a).localeCompare(canonicalize(b))
  );
  const payload = canonicalize({
    canonical,
    schemaHash,
    ops: sortedOps,
  });
  return sha256(payload);
}
```

### 13.5 Stage Determinism Table

| Stage | Semantic Determinism | Notes |
|-------|---------------------|-------|
| Stage 0 (Chunking) | **MUST** | Pure computation, rule-based |
| Stage 1 (Normalization) | **MUST** | Pure computation, glossary lookup |
| Stage 2 (Fast Path) | **MUST** | Pattern matching, no network |
| Stage 3 (Retrieval) | **SHOULD** | Cache recommended for consistency |
| Stage 4 (Memory) | **MAY NOT** | Memory selection is non-deterministic |
| Stage 5 (Proposer) | **MAY NOT** | LLM outputs are non-deterministic |
| Stage 6 (Assembly) | **MUST** | Pure computation from inputs |

**Implications:**
- Same input to Stages 0-2 MUST produce same **semantic output** (ops, types, paths)
- Stage 3-5 MAY produce different results on retry
- Stage 6 MUST produce same **semantic output** given same ProposalResult
- Observational metadata (timestamps, durations) are NOT subject to determinism requirements

### 13.6 Observational Metadata

The following fields are classified as **observational metadata** and are excluded from determinism requirements:

| Type | Fields |
|------|--------|
| TranslationTrace | `traceId`, `timing.*`, all `durationMs` fields |
| PatchFragment | `createdAt` |
| AmbiguityReport | `createdAt` |

These fields:
- MAY vary between identical translation runs
- MUST NOT affect semantic hash computation
- MUST NOT affect Authority approval decisions

---

## 14. Trace Redaction

### 14.1 Forbidden Data (MUST NOT store)

- API keys / tokens
- Raw model provider credentials
- Authentication headers

### 14.2 Configurable Data (Toggle-controlled)

| Data | Config Flag | Default |
|------|-------------|---------|
| Raw input text | `includeRawInput` | `false` |
| Raw model response | `includeRawModelResponse` | `false` |

### 14.3 Safe Alternatives

When raw data is excluded, store:

| Original | Alternative |
|----------|-------------|
| Raw input | SHA-256 hash + length + preview (first N chars) |
| Raw response | SHA-256 hash + token count |

### 14.4 Example Redacted Trace

```json
{
  "request": {
    "intentId": "intent-123",
    "inputLength": 156,
    "inputHash": "sha256:a1b2c3...",
    "inputPreview": "Add a new field for...",
    "language": "en"
  },
  "stages": {
    "proposer": {
      "modelId": "claude-3-haiku",
      "promptTokens": 1250,
      "completionTokens": 340,
      "escalated": false
    }
  }
}
```

---

## 15. Non-Goals (v1)

Translator v1.0 does NOT guarantee:

| Non-Goal | Reason |
|----------|--------|
| Full domain generation from single epic document | Incremental-first design |
| Automatic conflict resolution without Actor decision | INV-004 |
| Perfect multilingual semantic equivalence without glossary | Glossary is recommended |
| Runtime data migration | Schema change only in v1 |
| Destructive schema operations | Monotonic evolution in v1 |
| `removeType`, `renameField`, `removeConstraint` | See §6.7.1 |

---

## 16. Acceptance Criteria (Go/No-Go)

Translator v1.0 is spec-compliant if and only if:

| Criterion | Requirement |
|-----------|-------------|
| Output Constraint | Emits only fragments/ambiguity/error (never MEL) |
| IR Compliance | Uses MEL v0.3.3 call-only ExprNode for computed expressions |
| Literal Values | Uses JsonValue (not ExprNode) for `setDefaultValue.value` |
| Type System | Treats types as first-class schema facts (`types` + `typeIndex`) |
| Context Validation | Returns `INVALID_CONTEXT` if schema/typeIndex inconsistent |
| World Context | Requires `atWorldId` in TranslationContext |
| Incremental Design | Supports fragment follow-ups (incremental-first) |
| Auditability | Produces complete TranslationTrace for every run |
| Memory Integration | Uses `@manifesto-ai/memory` v1.0.0 API (SelectionResult + MemoryTraceUtils) |
| Authority Boundary | Authority uses verifyProof-only; Actor attaches trace to Proposal |
| Stateless Resolution | `resolve()` accepts report + resolution + context |
| Error Handling | Implements error taxonomy with codes |
| Canonical JSON | Uses RFC 8785 (JCS) for all identity hashing |
| Collection Ordering | Sorts union.members and object.fields before hashing |
| Deterministic Identity | `fragmentId = sha256(intentId + ':' + canonicalize(op))` (no ordinal) |
| reportId Sorting | Candidates sorted by optionId, fragments by fragmentId |
| Fast Path Model | FastPathResult includes `candidates[]` for miss handling |
| Candidates Constraint | All AmbiguityReports have `candidates.length >= 2` |
| opt-cancel Universal | `opt-cancel` allowed in any ambiguity kind (not just policy) |
| No-op Result | `fragments: []` allowed from any `opt-cancel` resolution |
| Fragment Ordering | Applicator performs topological ordering; array order is insignificant |
| Conflict Detection | Returns `FRAGMENT_CONFLICT` error (default) or `ambiguity(kind='conflict')` |
| Redaction | Trace excludes forbidden data |

---

## Appendix A: Quick Reference

### A.1 Import Pattern

```typescript
import { 
  translate, 
  translateMany, 
  resolve,
  type TranslationResult,
  type PatchFragment,
  type AmbiguityReport,
} from '@manifesto-ai/translator';
```

### A.2 Basic Usage

```typescript
const result = await translate(
  "사용자 이름은 5자 이상이어야 함",
  {
    schema: mySchema,
    typeIndex: myTypeIndex,
    intentId: 'intent-123',
    atWorldId: 'world-abc-123',  // REQUIRED
    glossary: koreanGlossary,
  }
);

switch (result.kind) {
  case 'fragment':
    console.log('Fragments:', result.fragments);
    break;
  case 'ambiguity':
    console.log('Need decision:', result.report.resolutionPrompt.question);
    break;
  case 'error':
    console.error('Error:', result.error.code, result.error.message);
    break;
}
```

### A.3 Ambiguity Resolution

```typescript
if (result.kind === 'ambiguity') {
  const resolution: AmbiguityResolution = {
    reportId: result.report.reportId,
    choice: { kind: 'option', optionId: 'opt-1' },
    resolvedBy: { actorId: 'user-123', kind: 'human' },
    resolvedAt: new Date().toISOString(),
  };
  
  // Stateless: pass report and context back
  const resolved = await resolve(
    result.report,
    resolution,
    {
      schema: mySchema,
      typeIndex: myTypeIndex,
      intentId: 'intent-123',
      atWorldId: 'world-abc-123',
    }
  );
}
```

---

## Appendix B: Migration from v0.x

This section is informative.

### B.1 Breaking Changes

| v0.x | v1.0 | Migration |
|------|------|-----------|
| String paths | SemanticPath type | Type alias, no runtime change |
| Inline type definitions | TypeExpr AST | Use schema converter |
| Untyped errors | TranslationError | Add error handling |

### B.2 New Requirements

| Requirement | Action |
|-------------|--------|
| TypeIndex | Generate from schema at build time |
| Glossary | Provide domain-specific glossary |
| Trace redaction | Configure trace sink |

---

*End of Specification v1.0*
