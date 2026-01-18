# `@manifesto-ai/translator` Specification v1.1.1

> **Status:** Release
> **Version:** 1.1.1
> **License:** MIT
> **Depends On:** MEL v0.3.3, Manifesto Core v1.0, World Protocol v1.0, `@manifesto-ai/memory` v1.2.0
> **Purpose:** Define the normative contract for translating multilingual natural language into incremental, auditable semantic change proposals for Manifesto domains.

---

## Changelog

| Version | Changes |
|---------|---------|
| **v1.1.1** | Architecture Decision + Critical Issue Fixes + **MEL Type Definitions** |
| v1.1.0 | Manifesto Ecosystem Integration: World-derived context (§8A), Human Escalation Protocol (§8B), TypeIndex derivation, Fragment→Proposal flow |
| v1.0.0 | Initial release: Core pipeline, PatchFragment, AmbiguityReport, Memory integration (reference only) |

### v1.1.1 Architecture Decision Alignment

This version implements the **Architecture Decision: Translator is a Compiler Frontend with Deterministic Contracts**.

| Change | Section | Description |
|--------|---------|-------------|
| Identity Redefinition | §1.1 | Clarified: deterministic stages 0–2, 6; non-deterministic proposer 5 |
| Architecture Principles | §1.2 | Three pillars: World premise, Memory default, Human constitutional |
| Invariants Expansion | §3 | Added INV-009~012 for architectural guarantees |
| Memory Reframing | §8.1 | "Optional enhancement" → "Default path + degradation" |
| Human Escalation | §8B | UX feature → Constitutional invariant |
| Forbidden Patterns | §3.3 | Explicit architectural violations |
| **MEL Type Definitions** | §6, §7 | **All domain types now defined in MEL (not TypeScript)** |

### v1.1.1 MEL Type Migration

All normative domain types are now defined in **MEL** for consistency with Manifesto ecosystem:

| Section | Types Defined in MEL |
|---------|---------------------|
| §6.1 | `ActorRef`, `SemanticPath`, `WorldId`, `IntentId`, `JsonValue` |
| §6.2 | `PrimitiveValue`, `PathSegment`, `PathNode`, `SystemPath`, `ExprNode` (7 kinds) |
| §6.3 | `TypeExpr`, `ResolvedType`, `TypeIndex` |
| §6.4 | `TranslationRequest` |
| §6.5 | `Section`, `NormalizationResult`, `FastPathResult`, `RetrievalResult`, `MemoryStageResult`, `ProposalResult` |
| §6.6-6.7 | `PatchFragment`, `PatchOp`, `ActionParamSpec`, `ActionGuard`, `GuardedBlock`, `ActionStmt`, `ActionBody` |
| §6.8-6.9 | `AmbiguityReport`, `AmbiguityResolution`, `EscalationMetadata` |
| §6.10-6.11 | `TranslationResult`, `TranslationError`, `ErrorCode` |
| §6.12-6.15 | `PatchProgram`, `TranslationTrace`, Stage traces, `EscalationTrace` |
| §6.16 | `TranslationContext` |
| §6.17 | `MemoryContent`, `TranslationExample`, `SchemaSnapshot`, `GlossaryTerm`, `ResolutionRecord` |
| §6.18 | `TranslatorConfig`, `MemoryPolicy`, `ConfidencePolicy`, `TraceConfig` |
| §7.2-7.3 | `GlossaryEntry`, `Glossary` |

TypeScript code in §4, §8, §9, §11 is **informative** (implementation examples), not normative.

### v1.1.1 Final Polish (Post-GO)

| Item | Section | Fix |
|------|---------|-----|
| §8.8 trace presence rule inconsistency | §8.8 | Unified trace presence description with explicit rule |
| `obj.fields` key uniqueness not specified | §6.2 | Added validation rule: duplicate keys are `TYPE_ERROR` |

### v1.1.1 Critical Issue Fixes (Round 10 — STOPPER)

| Issue | Section | Fix |
|-------|---------|-----|
| MEM-006 vs §8.9 "require" mode conflict | §8.7 | Split into MEM-006a (default) and MEM-006b (require) |
| `schema.types` / `typeIndex` MUST vs "if present" | §4.6, §8A.2 | Clarified: schema.types REQUIRED, typeIndex derived not stored |

### v1.1.1 Critical Issue Fixes (Round 9 — STOPPER)

| Issue | Section | Fix |
|-------|---------|-----|
| §8.5 example uses fields not in §6.14 normative | §6.14 | Added `degradeReason?`, `errorMessage?` to `MemoryStageTrace` |
| `contentSummary` key names mismatch | §8.5 | Changed to `schemaSnapshotCount`, `glossaryTermCount` |

### v1.1.1 Critical Issue Fixes (Round 8 — STOPPER)

| Issue | Section | Fix |
|-------|---------|-----|
| §8.5 example doesn't match `MemoryStageResult` | §8.5 | Rewrote `memoryStage()` with `degraded`, `trace: MemoryStageTrace`, error handling |
| `TypeExpr.literal.value` JsonValue vs primitive | §6.3 | Changed to `PrimitiveValue` (consistent with §4.3/§4.4) |

### v1.1.1 Critical Issue Fixes (Round 7 — STOPPER)

| Issue | Section | Fix |
|-------|---------|-----|
| `sys.path` string vs Array | §6.2 | Changed to `Array<string>` (MEL v0.3.3 canonical) |
| `obj.fields` Record vs key/value array | §6.2 | Changed to `Array<{ key: string, value: ExprNode }>` |
| `obj.fields` canonicalization missing | §13.2 | Added sorting by `field.key` before hashing |
| Context rules conflate MEL vs Translator | §6.2.1 | Clarified as "Translator-Level" restrictions |

### v1.1.1 Critical Issue Fixes (Round 6 — STOPPER)

| Issue | Section | Fix |
|-------|---------|-----|
| `ExprNode` misaligned with MEL v0.3.3 | §6.2 | Changed to 7-kind canonical IR (`lit`/`var`/`sys`/`get`/`call`/`obj`/`arr`) |
| `lit.value` allows object/array | §6.2 | Restricted to `PrimitiveValue` only |
| `$meta.*` uses `var` | §6.2 | Changed to `sys` node kind |
| No ExprNode context validation | §6.2.1 | Added context-specific kind restrictions |
| Stage 4 output type undefined | §6.5 | Added `MemoryStageResult` |

### v1.1.1 Critical Issue Fixes (Round 5)

| Issue | Section | Fix |
|-------|---------|-----|
| `addAction.params` Array vs Record | §6.7 | Changed to `Record<string, ActionParamSpec>` |
| `ActionBody` guard-stmt binding | §6.7 | Introduced `GuardedBlock`, `ActionStmt`, nested structure |
| Stage 4 "Optional" wording | §5 | Changed to "Default; may degrade" |
| `ProposalResult` state space | §6.5 | Changed to discriminated union (one-of) |

### v1.1.1 Critical Issue Fixes (Round 4)

| Issue | Section | Fix |
|-------|---------|-----|
| freeform `text` vs `input` mismatch | §8B.3 | Examples use `text` (matches §6.9 MEL) |
| Human resolution missing `escalation` | §8B.3 | Examples include `escalation` metadata |
| `deriveTypeIndex` uses Array | §8A.2 | Updated to `Object.entries(typeDef.fields)` |
| `MemoryPolicy.mode: require` unclear | §8.9 | Added explicit failure behavior |

### v1.1.1 Critical Issue Fixes (Round 3)

| Issue | Section | Fix |
|-------|---------|-----|
| `opt-cancel` MUST vs MAY conflict | §6.8, §11.2.1 | Unified to **MUST** for all ambiguity kinds |
| `TypeExpr` array vs Record mismatch | §4.3, §4.4, §13.2 | §4 references §6.3 MEL; fields is Record |
| `Glossary` type undefined | §7.3 | Added MEL data structure definition |

### v1.1.1 Critical Issue Fixes (Round 2)

| Issue | Section | Fix |
|-------|---------|-----|
| `TypeIndex`/`ResolvedType` missing | §6.3 | Added normative MEL definitions |
| `ExprNode` too loose | §6.2 | Fixed to call-only IR (`lit`/`var`/`get`/`call`) |
| `ResolutionPrompt` field mismatch | §6.8 | Added `optionIds` field |
| `TraceConfig` duplicate definitions | §6.18 | Single normative MEL definition |
| `updateComputedExpr` vs monotonic | §6.7.2 | Removed from v1, reserved for v2 |

### v1.1.1 Critical Issue Fixes (Round 1)

| Issue | Section | Fix |
|-------|---------|-----|
| `MemoryStageTrace` duplicate | §6.14 | Single canonical MEL definition |
| `EscalationTrace` duplicate | §6.15 | Single canonical MEL definition |
| Memory v1.0.0 references | Throughout | Updated to v1.2.0 |
| Config missing fields | §6.18 | Added `MemoryPolicy` type in MEL |
| Section numbering | §6 | Renumbered 6.1-6.18 |

### v1.1.0 Breaking Changes (from v1.0.0)

| Change | Impact |
|--------|--------|
| `TranslationContext` must be World-derived | Callers must use `deriveContext(worldId)` pattern |
| `typeIndex` cannot be provided independently | Must use `deriveTypeIndex(schema)` |
| Ambiguity requires Human escalation | Agents cannot auto-resolve (ESC-001) |
| New acceptance criteria categories | Manifesto integration, Human escalation required |
| Memory v1.2.0 required | Must implement content fetching, not just selection |

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
    - 8.1 [Why Memory Matters](#81-why-memory-matters-for-translation)
    - 8.2 [Memory Architecture](#82-memory-architecture-in-translator)
    - 8.3 [What Translator Retrieves](#83-what-translator-retrieves-from-memory)
    - 8.4 [Memory Usage by Stage](#84-memory-usage-by-stage)
    - 8.5 [Stage 4: Memory Stage](#85-stage-4-memory-stage-detailed)
    - 8.6 [Memory in Proposer](#86-memory-in-proposer-stage-5)
    - 8.7 [Memory Rules](#87-memory-rules-normative)
    - 8.8 [Memory Trace Structure](#88-memory-trace-structure)
    - 8.9 [When Memory is Unavailable](#89-when-memory-is-unavailable)
    - 8.10 [Memory Confidence and Ambiguity](#810-memory-confidence-and-ambiguity)
      8A. [World Integration](#8a-world-integration-normative)
      8B. [Human Escalation Protocol](#8b-human-escalation-protocol-normative)
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

Translator is a **compiler frontend with deterministic contracts** that operates on Manifesto World, transforming **natural language (any language)** into **incremental semantic change proposals**.

> **Translator = Manifesto World 위에서 동작하는 Compiler Frontend**
> (deterministic stages 0–2, 6; untrusted/non-deterministic proposer stage 5)

**Important Clarification on Determinism:**

| Aspect | Deterministic? | Description |
|--------|---------------|-------------|
| **Semantic Identity** | ✅ Yes | `fragmentId = sha256(intentId + ':' + canonicalize(op))` |
| **Stage 0–2** | ✅ Yes | Chunking, normalization, fast-path |
| **Stage 6** | ✅ Yes | Assembly (validation, dedup, conflict) |
| **Stage 3** | ⚠️ Should | Retrieval (with tie-breaking) |
| **Stage 4** | ❌ May not | Memory selection (LLM-based) |
| **Stage 5** | ❌ May not | Proposer (LLM-based) |

Translator is NOT "fully deterministic" in the sense that re-running `translate()` with the same input will always produce identical output. However:

1. **Contracts are deterministic**: Types, validation rules, identity functions are pure
2. **Core stages are deterministic**: Stages 0–2, 6 are reproducible
3. **Proposer is explicitly untrusted**: Stage 5 output is a *proposal*, not truth
4. **Semantic identity is deterministic**: Fragment identity is content-addressed

Translator is NOT:
* An "AI helper" or "LLM-based assistant"
* A standalone tool that can run without World
* A general-purpose NLP system

Translator IS:
* A **semantic proposal engine** that interprets intent
* A **compiler frontend** that targets PatchFragment IR
* A **stateless function** that reads World and emits proposals

**Core Properties:**

| Property | Value |
|----------|-------|
| Input | Natural Language (any human language) |
| Output | `PatchFragment[]` \| `AmbiguityReport` \| `TranslationError` |
| State | **None** (stateless) |
| Truth | **Only World** (Schema + Snapshot) |
| Responsibility | Interpret + Propose + Trace (never Apply, never Approve) |

Translator outputs only:

* **PatchFragment(s)** (proposed semantic changes), or
* **AmbiguityReport** (requires Human decision), or
* **TranslationError**

Translator **MUST NOT**:

* generate MEL text,
* apply patches,
* resolve ambiguity (Human's constitutional right),
* perform governance approval,
* execute Host effects,
* operate without World context.

### 1.2 Architecture Principles

Translator is built on three **non-negotiable architectural pillars**:

#### Pillar 1: World is the Premise, Not an Option

> **World는 Translator의 옵션이 아니라 전제다.**

Translator cannot operate without World. All context is derived from World:

| Context | Source | Derivation |
|---------|--------|------------|
| Schema | World.schemaHash | Lookup from SchemaStore |
| TypeIndex | Schema | `deriveTypeIndex(schema)` — **external injection forbidden** |
| Snapshot | World.snapshotHash | Lookup from SnapshotStore (optional but World-based) |
| intentId | Fresh generation | Per-translation unique ID |

**Forbidden patterns:**
- "Standalone Translator" execution
- "Context-agnostic" examples
- "Direct context construction" without World

#### Pillar 2: Memory is Structural Input, Not Optional Enhancement

> **Memory = 과거 World들의 투영이며, Translator의 few-shot / 패턴 / 해석 근거를 구성하는 구조적 입력이다.**

Memory is the **default path**. Absence of Memory triggers **graceful degradation**, not "normal operation".

| With Memory | Without Memory |
|-------------|----------------|
| Default path | Degraded path |
| Few-shot examples in Proposer | Generic prompting |
| Resolution history for confidence | No historical calibration |
| Schema evolution context | Current schema only |

**Reframing:**
- ~~"Memory is optional enhancement"~~ → **"Memory is default; absence is degradation"**

#### Pillar 3: Human Escalation is Constitutional, Not UX

> **Ambiguity = 기계가 결정할 수 없는 의미 → Human의 헌법적 권한**

Ambiguity is not a technical problem to be solved. It is a **constitutional boundary** where machine interpretation ends and Human authority begins.

| Aspect | Old View | New View |
|--------|----------|----------|
| Ambiguity | Technical limitation | Constitutional boundary |
| Human escalation | UX feature | Architectural invariant |
| Agent auto-resolve | Allowed with caution | **Forbidden (ESC-001)** |
| opt-cancel | One option among many | Universal escape hatch |

**Human escalation is not:**
- A "nice-to-have" feature
- A "UI implementation hint"
- An "optional enhancement"

**Human escalation IS:**
- An **architectural invariant**
- A **constitutional right**
- A **trace that becomes World history**

### 1.3 End-to-End Positioning

Translator operates **within** the Manifesto ecosystem, not independently:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MANIFESTO ECOSYSTEM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐                                                        │
│  │   World     │ ◄── Current truth (Schema + Snapshot)                  │
│  │  (atWorldId)│                                                        │
│  └──────┬──────┘                                                        │
│         │                                                               │
│         │ schema + snapshot                                             │
│         ▼                                                               │
│  ┌─────────────┐     NL Input      ┌─────────────────────────┐         │
│  │   Actor     │ ─────────────────►│      Translator         │         │
│  │ (human/     │                   │   (this spec)           │         │
│  │  agent)     │ ◄─────────────────│                         │         │
│  └──────┬──────┘   fragment |      └─────────────────────────┘         │
│         │          ambiguity |                                          │
│         │          error                                                │
│         │                                                               │
│         │ (if ambiguity: Human resolves via UI)                        │
│         │ (if fragment: Actor wraps as Proposal)                       │
│         ▼                                                               │
│  ┌─────────────┐                                                        │
│  │  Authority  │ ◄── Judges Proposal (policy/human/auto)               │
│  └──────┬──────┘                                                        │
│         │ approved Intent                                               │
│         ▼                                                               │
│  ┌─────────────┐                                                        │
│  │    Host     │ ◄── Executes effects, applies patches                 │
│  └──────┬──────┘                                                        │
│         │ new Snapshot                                                  │
│         ▼                                                               │
│  ┌─────────────┐                                                        │
│  │  New World  │ ◄── Immutable, content-addressed                      │
│  └─────────────┘                                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Integration Points:**

| Integration | Translator Role | Other Component |
|-------------|-----------------|-----------------|
| World → Schema | Reads current schema via `atWorldId` | World provides `DomainSchema` |
| World → TypeIndex | Derives `typeIndex` from `DomainSchema` | World provides schema structure |
| Fragment → Proposal | Returns fragments | Actor wraps as `Proposal` |
| Ambiguity → Human | Returns `AmbiguityReport` | Actor presents to Human for decision |
| Memory → Selection | Queries past Worlds | Memory provides context |

### 1.3 Manifesto Component Dependencies

Translator **MUST** integrate with these Manifesto components:

```typescript
// From World Protocol
type World = {
  worldId: WorldId;
  schemaHash: string;      // → DomainSchema lookup
  snapshotHash: string;    // → Snapshot lookup
  // ...
};

// From Core Spec  
type DomainSchema = {
  id: string;
  version: string;
  hash: string;
  state: StateSpec;        // → typeIndex derivation
  computed: ComputedSpec;  // → typeIndex derivation
  actions: Record<string, ActionSpec>;
  // ...
};

// From Core Spec
type Snapshot = {
  data: Record<string, unknown>;   // Current state values
  computed: Record<string, unknown>;
  system: SystemState;
  meta: SnapshotMeta;
  // ...
};
```

**Translator reads World to understand:**
1. What types exist (from `schema.state`)
2. What computed values exist (from `schema.computed`)
3. What actions are available (from `schema.actions`)
4. Current state values (from `snapshot.data`) for context

### 1.4 Scope of Incremental Semantic Change

v1 defines "incremental semantic change" as:

* ✅ **Schema/domain semantics**: type definitions, constraints, action signatures
* ❌ **Runtime data migration**: requires separate domain/action design (deferred to v2)

---

## 2. Normative Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHOULD**, **MAY** are to be interpreted as described in RFC 2119.

---

## 3. Core Constitution (Invariants)

Translator MUST uphold these **non-negotiable invariants**:

### 3.1 Semantic Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-001 | Frontend Only | Translator is a **deterministic compiler frontend**, not an "AI helper" or code generator. |
| INV-002 | Untrusted Proposer | Any model output is a *proposal* only. Never truth, never authority. |
| INV-003 | Incremental-First | Every input is treated as an incremental fragment; "initial generation" is just the first fragment set. |
| INV-004 | Ambiguity = Human Authority | Translator MUST NOT resolve ambiguity. **Ambiguity is Human's constitutional right.** |
| INV-005 | Deterministic Projection | MEL text is a deterministic projection; Translator MUST NOT emit MEL. |
| INV-006 | Auditable | Every run MUST produce a TranslationTrace. |
| INV-007 | Type Facts, Not Inference | Type metadata MUST be first-class and queryable from schema; Translator MUST rely on lookup rather than model inference where possible. |
| INV-008 | Memory ≠ Truth | Memory is candidates + selection + trace; never treated as truth. Truth is only referenced World/Snapshot. |

### 3.2 Architectural Invariants (v1.1)

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-009 | World is Premise | Translator CANNOT operate without World. Context MUST be derived from World. |
| INV-010 | Memory is Default | Memory is the default execution path. Absence triggers graceful degradation, not "normal operation". |
| INV-011 | Human Escalation is Constitutional | Agent auto-resolve is **forbidden** (ESC-001). Ambiguity MUST be escalated to Human. |
| INV-012 | Escalation is History | Resolution becomes trace, trace becomes World history. No silent decisions. |

### 3.3 Forbidden Patterns

The following are **architectural violations**, not just "discouraged":

| Pattern | Violation |
|---------|-----------|
| Standalone Translator execution | INV-009 |
| Direct context construction without World | INV-009 |
| Agent auto-resolving ambiguity | INV-011, ESC-001 |
| Memory as "optional enhancement" | INV-010 |
| "AI helper" or "LLM assistant" framing | INV-001 |

---

## 4. Canonical IR Contracts (Aligned with MEL v0.3.3)

### 4.1 Expression IR (Canonical)

**Normative Definition:** See §6.2 for the normative MEL v0.3.3 `ExprNode` definition (7 kinds).

Translator MUST target **MEL v0.3.3 canonical `ExprNode`** for all **computed expressions**:

* constraint rules (`addConstraint.rule`)
* computed expressions (`addComputed.expr`)
* available conditions (`addActionAvailable.expr`)
* guard conditions (`ActionGuard.condition`)
* patch values (`ActionStmt.patch.value`)
* effect arguments (`ActionStmt.effect.args`)

**Key MEL v0.3.3 Constraints:**

| Constraint | Description |
|------------|-------------|
| 7 node kinds | `lit` / `var` / `sys` / `get` / `call` / `obj` / `arr` |
| `lit` is primitive only | Object/array literals use `obj`/`arr` nodes |
| `sys` for system values | `$meta.*`, `$system.*`, `$input.*` |
| `var` is `$item` only | `$acc` removed in v0.3.3 |
| Context-specific restrictions | See §6.2.1 |

**Literal Values (Exception):**

Default values (`setDefaultValue.value`, `ActionParamSpec.defaultValue`) are **not expressions** but **literal data**. They use `JsonValue` type instead of `ExprNode`. This is because:
- Default values must be deterministic literals (no `$system.*`, `$input.*`)
- They must be directly serializable to MEL state initializers
- No runtime evaluation is needed

| Context | Type | Rationale |
|---------|------|-----------|
| Constraint rules | `ExprNode` | Runtime evaluation needed |
| Computed expressions | `ExprNode` | Runtime evaluation needed |
| Action availability | `ExprNode` | Runtime evaluation needed |
| Guard conditions | `ExprNode` | Runtime evaluation needed |
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

TypeExpr represents type declarations as structured AST, aligned with MEL v0.3.3.

**Normative Definition:** See §6.3 for the normative MEL definition.

> **Note:** The TypeScript example below is **informative** only. The normative structure uses `Record<string, {...}>` for object fields, not arrays.

```typescript
// INFORMATIVE: TypeScript representation
// See §6.3 for normative MEL definition
type TypeExpr =
  | { kind: 'primitive'; name: 'string' | 'number' | 'boolean' | 'null' }
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'ref'; name: string }
  | { kind: 'array'; element: TypeExpr }
  | { kind: 'record'; key: TypeExpr; value: TypeExpr }
  | { kind: 'union'; members: TypeExpr[] }
  | { kind: 'object'; fields: Record<string, { type: TypeExpr; optional: boolean }> };
```

**Constraints:**
- `union.members` MUST be flattened (no nested unions)
- `object` kind is allowed only inside TypeDecl
- `record.key` SHOULD be string, number, or literal union
- `object.fields` is a **Record** (not array) for deterministic JSON Canonicalization (see §13.2)

### 4.4 ResolvedType (Resolved View)

ResolvedType is the **normalized form** for AI consumption.

**Normative Definition:** See §6.3 for the normative MEL definition.

> **Note:** The TypeScript example below is **informative** only.

```typescript
// INFORMATIVE: TypeScript representation
// See §6.3 for normative MEL definition
type ResolvedType =
  | { kind: 'primitive'; name: 'string' | 'number' | 'boolean' | 'null' }
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'array'; element: ResolvedType }
  | { kind: 'record'; key: ResolvedType; value: ResolvedType }
  | { kind: 'union'; members: ResolvedType[]; nullable: boolean }
  | { kind: 'object'; fields: Record<string, { type: ResolvedType; optional: boolean }>; typeName?: string };
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

| View | Description | Type | Required |
|------|-------------|------|----------|
| Decl View | Named type declarations | `types: Record<string, TypeExpr>` | REQUIRED (may be `{}`) |
| State | State field definitions | `state.fields: Record<string, {...}>` | REQUIRED |
| Computed | Computed value definitions | `computed: Record<string, {...}>` | REQUIRED (may be `{}`) |
| Actions | Action definitions | `actions: Record<string, {...}>` | REQUIRED (may be `{}`) |

**TypeIndex Derivation (Critical):**

`typeIndex` is NOT stored in schema. It is **deterministically derived** from schema via `deriveTypeIndex(schema)` (see §8A.2).

| Aspect | Rule |
|--------|------|
| Storage | TypeIndex MUST NOT be stored in schema or World |
| Derivation | TypeIndex MUST be derived via `deriveTypeIndex(schema)` |
| External Injection | **FORBIDDEN** — TypeIndex provided independently MUST be rejected |
| Caching | Implementations MAY cache derived TypeIndex keyed by `schemaHash` |

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
│  Stage 4: Memory Broker (Default; may degrade)                  │
│    Input: RetrievalResult + query context                       │
│    Output: MemoryStageResult                                    │
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

### Stage 4 — Memory Broker (Default; may degrade)

When input requires additional context beyond current schema:

* Translator MUST issue a memory query to `@manifesto-ai/memory` Selector.
* Translator MUST receive:
    * selected memories
    * MemoryTrace / MemorySelectionTrace
* Translator MUST treat memory as evidence, not truth.

**Degradation:** If selector is not configured or unavailable, Stage 4 produces empty content and sets `trace.memory.degraded = true`. Proposer proceeds with reduced context. See §8.9 for mode-specific behavior.

### Stage 5 — Proposer (SLM by default)

* A small model (SLM) proposes **one or a small batch of fragments** given:
    * canonical text
    * candidate anchors
    * relevant typeIndex slice
    * selected memories (from Stage 4; empty if degraded)
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

See §6.10 for full semantics.

---

## 6. Data Types (Normative Shapes)

Translator data types are defined in MEL. Implementations MUST support these semantics.

> **Note:** MEL type definitions are **normative**. TypeScript/other language bindings are informative.

### 6.1 Core Primitives

```mel
// Actor reference (from World Protocol)
type ActorRef = {
  actorId: string,
  kind: "human" | "agent" | "system"
}

// Semantic path in schema
type SemanticPath = string

// World identifier (opaque)
type WorldId = string

// Intent identifier
type IntentId = string

// JSON-serializable value (for literals, not expressions)
type JsonValue = null | boolean | number | string
              | Array<JsonValue>
              | Record<string, JsonValue>
```

### 6.2 MEL Expression IR (v0.3.3 Canonical)

Translator MUST target **MEL v0.3.3 canonical expression IR**. This IR uses 7 node kinds.

> **"Call-only"** means all operations are expressed as `call` nodes (no infix operators). It does NOT mean only 4 node kinds exist.

```mel
// Primitive value (NOT JsonValue - primitives only)
type PrimitiveValue = null | boolean | number | string

// Path segment for property access
type PathSegment = { kind: "prop", name: string }
type PathNode = Array<PathSegment>

// System path as segment array (MEL v0.3.3 canonical)
// $meta.intentId → ["meta", "intentId"]
// $system.uuid → ["system", "uuid"]
// $input.raw → ["input", "raw"]
type SystemPath = Array<string>

// Object field as key/value pair (MEL v0.3.3 canonical)
type ObjField = { key: string, value: ExprNode }

// MEL v0.3.3 canonical expression IR (7 kinds)
type ExprNode =
  // Literals (primitive only - object/array use obj/arr nodes)
  | { kind: "lit", value: PrimitiveValue }
  
  // Variable reference (v0.3.3: only $item, $acc removed)
  | { kind: "var", name: "item" }
  
  // System value access ($meta.*, $system.*, $input.*)
  | { kind: "sys", path: SystemPath }
  
  // Property access (base absent = root state)
  | { kind: "get", base?: ExprNode, path: PathNode }
  
  // Function call (all operations)
  | { kind: "call", fn: string, args: Array<ExprNode> }
  
  // Object literal (key/value pairs, NOT Record)
  | { kind: "obj", fields: Array<ObjField> }
  
  // Array literal (NOT lit with array value)
  | { kind: "arr", elements: Array<ExprNode> }
```

**ExprNode Kind Summary:**

| Kind | Description | Example |
|------|-------------|---------|
| `lit` | Primitive literal | `{ kind: "lit", value: 42 }` |
| `var` | Variable (`$item` only in v0.3.3) | `{ kind: "var", name: "item" }` |
| `sys` | System value | `{ kind: "sys", path: ["meta", "intentId"] }` |
| `get` | Property access | `{ kind: "get", path: [{ kind: "prop", name: "user" }] }` |
| `call` | Function call | `{ kind: "call", fn: "eq", args: [...] }` |
| `obj` | Object literal | `{ kind: "obj", fields: [{ key: "x", value: litExpr }] }` |
| `arr` | Array literal | `{ kind: "arr", elements: [litExpr1, litExpr2] }` |

**Critical Differences from JsonValue:**

| Value | Correct IR | WRONG |
|-------|------------|-------|
| `42` | `{ kind: "lit", value: 42 }` | ✅ |
| `"hello"` | `{ kind: "lit", value: "hello" }` | ✅ |
| `{ x: 1 }` | `{ kind: "obj", fields: [{ key: "x", value: { kind: "lit", value: 1 } }] }` | ❌ `Record` or `lit` |
| `[1, 2]` | `{ kind: "arr", elements: [{ kind: "lit", value: 1 }, ...] }` | ❌ `{ kind: "lit", value: [1, 2] }` |
| `$meta.intentId` | `{ kind: "sys", path: ["meta", "intentId"] }` | ❌ `path: "meta.intentId"` |

**v0.3.3 Changes:**
- `$acc` removed (no reduce operations)
- `var` is effectively `$item` only (used in effect sub-expressions)

**obj.fields Validation:**

`ExprNode.obj.fields` keys MUST be unique. Duplicate keys are invalid:

```typescript
// VALID: unique keys
{ kind: "obj", fields: [{ key: "a", value: lit1 }, { key: "b", value: lit2 }] }

// INVALID: duplicate key "a"
{ kind: "obj", fields: [{ key: "a", value: lit1 }, { key: "a", value: lit2 }] }  // ❌
```

Stage 6 MUST validate and return `TYPE_ERROR` if duplicate keys are detected.

#### 6.2.1 ExprNode Context Validation Rules (Translator-Level)

> **Note:** These are **Translator-level restrictions** for safety and determinism. MEL IR itself may allow `sys` in more contexts (e.g., `$meta.*` is "Anywhere" in MEL). Translator imposes stricter rules to ensure schema-level declarations remain deterministic.

Different PatchOp contexts have different allowed ExprNode kinds:

| Context | `lit` | `var` | `sys` | `get` | `call` | `obj` | `arr` |
|---------|-------|-------|-------|-------|--------|-------|-------|
| `addComputed.expr` | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `addConstraint.rule` | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `addActionAvailable.expr` | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `ActionGuard.condition` | ✅ | ❌ | ✅* | ✅ | ✅ | ✅ | ✅ |
| `ActionStmt(patch).value` | ✅ | ❌ | ✅* | ✅ | ✅ | ✅ | ✅ |
| `ActionStmt(effect).args` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

`*` = `sys` allowed only for action-scoped system values (e.g., `$meta.intentId`, `$input.*`)

**Rationale (Translator-Level Policy):**

- **`var` restricted:** `$item` is only meaningful in effect sub-expressions (e.g., array iteration)
- **`sys` restricted in computed/constraint:** Translator enforces that schema-level declarations (computed, constraint) are deterministic at definition time. `$system.*` would introduce runtime variance.
- **`sys` allowed in actions:** Actions execute at runtime where system context is available

**Validation Error:**

If proposer produces ExprNode violating these rules, Stage 6 MUST return:

```mel
error("TYPE_ERROR", "Invalid ExprNode kind 'var' in addComputed.expr context")
```

### 6.3 Type System

```mel
// Type expression (for declarations)
type TypeExpr =
  | { kind: "primitive", name: "string" | "number" | "boolean" | "null" }
  | { kind: "literal", value: PrimitiveValue }  // Literal types are primitive only
  | { kind: "ref", name: string }
  | { kind: "array", element: TypeExpr }
  | { kind: "record", key: TypeExpr, value: TypeExpr }
  | { kind: "union", members: Array<TypeExpr> }
  | { kind: "object", fields: Record<string, { type: TypeExpr, optional: boolean }> }

// Resolved type (after reference resolution)
type ResolvedType =
  | { kind: "primitive", name: "string" | "number" | "boolean" | "null" }
  | { kind: "literal", value: PrimitiveValue }  // Literal types are primitive only
  | { kind: "array", element: ResolvedType }
  | { kind: "record", key: ResolvedType, value: ResolvedType }
  | { kind: "union", members: Array<ResolvedType>, nullable: boolean }
  | { kind: "object", fields: Record<string, { type: ResolvedType, optional: boolean }>, typeName?: string }

// Type index: maps semantic paths to resolved types
type TypeIndex = Record<SemanticPath, ResolvedType>
```

**Literal Type Constraint:**

`literal.value` uses `PrimitiveValue` (not `JsonValue`) because:
- Type system literal types represent specific primitive values (e.g., `"active"`, `42`, `true`)
- Object/array types are expressed via `object` and `array` kinds, not literals
- Consistent with TypeScript/MEL type theory where literal types are primitives

**TypeExpr vs ResolvedType:**

| Aspect | TypeExpr | ResolvedType |
|--------|----------|--------------|
| Purpose | Declaration (what user writes) | Runtime (what engine uses) |
| `ref` kind | ✅ Allowed | ❌ Forbidden (resolved away) |
| `nullable` | Implicit in union | ✅ Explicit field |
| `typeName` | N/A | ✅ Tracks source type name |

### 6.4 Translation Request

```mel
type TranslationRequest = {
  input: string,
  targetSchemaId: string,
  intentId: IntentId,
  actor?: ActorRef
}
```

**Note:** `TranslationRequest` is a convenience type for logging/wire format. The normative input to `translate()` is the `(input, context)` tuple where `context.schema` is the source of truth.

### 6.5 Stage Results

```mel
// Chunking result
type Section = {
  sectionId: string,
  startOffset: number,
  endOffset: number,
  text: string
}

// Normalization result
type ProtectedToken = {
  original: string,
  position: { start: number, end: number },
  kind: "identifier" | "number" | "quoted" | "symbol"
}

type GlossaryHit = {
  semanticId: string,
  canonical: string,
  originalTerm: string,
  confidence: number
}

type NormalizationResult = {
  canonical: string,
  language: string,
  tokens: Array<ProtectedToken>,
  glossaryHits: Array<GlossaryHit>
}

// Fast-path result
type FastPathCandidate = {
  patternId: string,
  fragments: Array<PatchFragment>,
  confidence: number,
  evidence?: Array<string>
}

type FastPathResult = {
  matched: boolean,
  best: FastPathCandidate | null,
  candidates: Array<FastPathCandidate>
}

// Retrieval result
type AnchorCandidate = {
  path: SemanticPath,
  score: number,
  matchType: "exact" | "fuzzy" | "semantic",
  evidence: Array<string>,
  resolvedType?: ResolvedType  // NOTE: ResolvedType, not TypeExpr
}

type RetrievalResult = {
  tier: 0 | 1 | 2,
  candidates: Array<AnchorCandidate>
}

// Memory stage result (Stage 4 output)
type MemoryStageResult = {
  content: MemoryContent,
  selectedCount: number,
  averageConfidence?: number,
  degraded: boolean,
  trace?: MemoryStageTrace
}

// Proposer result (one-of: exactly one branch is non-null)
type ProposalResult =
  | { kind: "fragments", fragments: Array<PatchFragment>, confidence: number, evidence: Array<string> }
  | { kind: "ambiguity", ambiguity: AmbiguityReport, confidence: number, evidence: Array<string> }
  | { kind: "empty", confidence: number, evidence: Array<string> }  // No fragments produced
```

**ProposalResult Semantics:**

| `kind` | `fragments` | `ambiguity` | Meaning |
|--------|-------------|-------------|---------|
| `fragments` | `>= 1` | N/A | Proposer produced fragments |
| `ambiguity` | N/A | present | Proposer detected ambiguity |
| `empty` | N/A | N/A | Proposer produced nothing (→ error in Stage 6) |

**Fast Path Match Semantics:**

| `len(candidates)` | `best` | `matched` | Meaning |
|-------------------|--------|-----------|---------|
| `0` | `null` | `false` | No patterns matched |
| `>= 1` | non-null | `false` | Patterns found but confidence below threshold |
| `>= 1` | non-null | `true` | High-confidence match found |

### 6.6 PatchFragment

PatchFragment represents schema-level semantic changes (not MEL text).

```mel
type PatchFragment = {
  // Content-addressed: sha256(intentId + ':' + canonicalize(op))
  fragmentId: string,
  sourceIntentId: IntentId,
  op: PatchOp,
  confidence: number,
  evidence: Array<string>,
  createdAt: string  // ISO 8601, observational metadata
}
```

**Identity Rule:** `fragmentId = sha256(intentId + ':' + canonicalize(op))` where `canonicalize()` follows RFC 8785 (JCS).

### 6.7 PatchOp (v1 Operator Set)

v1 operator set is **strictly monotonic** (add-only, no destructive changes).

#### 6.7.1 v1 Operators (Monotonic)

```mel
type PatchOp =
  // Type definition
  | { kind: "defineType", typeName: string, definition: TypeExpr }
  
  // State evolution (monotonic)
  | { kind: "addField", path: SemanticPath, fieldType: TypeExpr, defaultValue?: JsonValue }
  | { kind: "addConstraint", path: SemanticPath, constraintId: string, rule: ExprNode, message?: string }
  | { kind: "setDefaultValue", path: SemanticPath, value: JsonValue }
  | { kind: "widenFieldType", path: SemanticPath, newType: TypeExpr }
  
  // Computed evolution (monotonic: add only)
  | { kind: "addComputed", path: SemanticPath, expr: ExprNode, returnType?: TypeExpr }
  
  // Action evolution (monotonic)
  | { kind: "addAction", actionName: string, params: Record<string, ActionParamSpec>, body: ActionBody }
  | { kind: "addActionParam", actionName: string, paramName: string, param: ActionParamSpec }
  | { kind: "addActionAvailable", actionName: string, expr: ExprNode }
  | { kind: "addActionGuard", actionName: string, block: GuardedBlock }

// Action parameter specification (name is the Record key)
type ActionParamSpec = {
  type: TypeExpr,
  optional: boolean,
  defaultValue?: JsonValue
}

// Guard types
type ActionGuard = {
  guardKind: "when" | "once",
  condition?: ExprNode,   // Required for "when"
  marker?: SemanticPath   // Required for "once"
}

// Guarded block: guard owns its statements
type GuardedBlock = {
  guard: ActionGuard,
  body: Array<ActionStmt>
}

// Action statement (what can appear inside a guarded block)
type ActionStmt =
  | { kind: "patch", target: SemanticPath, value: ExprNode }
  | { kind: "effect", effectId: string, args: Record<string, ExprNode> }
  | { kind: "nested", block: GuardedBlock }  // Nested guard block

// Action body: sequence of guarded blocks
type ActionBody = {
  blocks: Array<GuardedBlock>
}
```

**params as Record:**

Action parameters use `Record<string, ActionParamSpec>` where the key is the parameter name. This ensures:
- Consistent with `TypeExpr.object.fields` (also Record)
- JCS key ordering provides deterministic canonicalization (see §13.2)
- `deriveTypeIndex()` can use `Object.entries()` uniformly

**GuardedBlock Structure:**

The `GuardedBlock` structure expresses guard-statement binding:

```mel
// Example: when(condition) { patch; effect }
type ExampleBlock = {
  guard: { guardKind: "when", condition: someExpr },
  body: [
    { kind: "patch", target: "state.count", value: addExpr },
    { kind: "effect", effectId: "notify", args: { ... } }
  ]
}

// Example: once(marker) { nested when }
type ExampleNested = {
  guard: { guardKind: "once", marker: "state.initialized" },
  body: [
    { kind: "nested", block: {
      guard: { guardKind: "when", condition: validExpr },
      body: [{ kind: "patch", ... }]
    }}
  ]
}
```

**Migration from v1.1.0:**

| Old (v1.1.0) | New (v1.1.1) |
|--------------|--------------|
| `params: Array<ActionParam>` | `params: Record<string, ActionParamSpec>` |
| `ActionParam.name` | Record key |
| `ActionBody.guards/patches/effects` | `ActionBody.blocks: Array<GuardedBlock>` |
| `addActionGuard(..., guard)` | `addActionGuard(..., block)` |

#### 6.7.2 Forbidden Operators (v1)

The following are **NOT** available in v1 (breaks monotonic evolution):

| Forbidden | Reason |
|-----------|--------|
| `removeField` | Non-monotonic (destructive) |
| `removeType` | Non-monotonic (destructive) |
| `renameField` | Non-monotonic (use add + deprecate) |
| `removeConstraint` | Non-monotonic (destructive) |
| `narrowFieldType` | Non-monotonic (breaks existing data) |
| `updateComputedExpr` | Non-monotonic (modifies semantics) — **reserved for v2** |

**Note:** `updateComputedExpr` was considered for v1 but removed because it modifies existing semantics rather than adding new ones. To change a computed expression in v1, use `addComputed` with a new path and deprecate the old one.

### 6.8 AmbiguityReport

```mel
type AmbiguityKind = "intent" | "target" | "value" | "conflict" | "policy"

type AmbiguityCandidate = {
  optionId: string,
  description: string,
  fragments: Array<PatchFragment>,
  confidence: number,
  evidence?: Array<string>
}

type ResolutionPrompt = {
  question: string,
  optionIds?: Array<string>,       // Subset of candidates to highlight (UI hint)
  affirmativeLabel?: string,
  negativeLabel?: string
}

type AmbiguityReport = {
  reportId: string,
  kind: AmbiguityKind,
  normalizedInput: string,
  candidates: Array<AmbiguityCandidate>,
  resolutionPrompt?: ResolutionPrompt,
  createdAt?: string,              // ISO 8601 timestamp
  partialFragments?: Array<PatchFragment>  // Fragments already confident
}
```

**Candidate Invariants:**

| Rule | Description |
|------|-------------|
| `len(candidates) >= 2` | Always at least 2 meaningful choices |
| `opt-cancel` required | One candidate MUST be `opt-cancel` (universal escape hatch) |

**opt-cancel Semantics:**

```mel
// opt-cancel is always present
type OptCancelCandidate = {
  optionId: "opt-cancel",
  description: string,  // e.g., "Cancel: do not apply any changes"
  fragments: Array<PatchFragment>,  // MUST be empty: []
  confidence: 1.0
}
```

### 6.9 AmbiguityResolution

```mel
type ResolutionChoice =
  | { kind: "option", optionId: string }
  | { kind: "freeform", text: string }

type EscalationMetadata = {
  escalatedAt: string,
  escalatedTo: ActorRef
}

type AmbiguityResolution = {
  reportId: string,
  choice: ResolutionChoice,
  resolvedBy: ActorRef,
  resolvedAt: string,
  escalation?: EscalationMetadata  // Required when resolvedBy.kind == "human"
}
```

### 6.10 TranslationResult

```mel
type TranslationResult =
  | { kind: "fragment", fragments: Array<PatchFragment>, trace: TranslationTrace }
  | { kind: "ambiguity", report: AmbiguityReport, trace: TranslationTrace }
  | { kind: "error", error: TranslationError, trace: TranslationTrace }
```

**Fragment Result Semantics:**

| `len(fragments)` | Meaning | When Allowed |
|------------------|---------|--------------|
| `>= 1` | Semantic changes proposed | Normal translation result |
| `== 0` | No-op (no changes) | **Only** from `opt-cancel` resolution |

**No-op Result (Normative):**

A `kind="fragment"` result with `fragments: []` is valid **only** when:
1. Result comes from `resolve()` call
2. Actor chose `opt-cancel` option

When `translate()` produces a fragment result directly (not via resolution), `len(fragments) >= 1`. If proposer produces zero fragments, it MUST return `error(NO_FRAGMENTS_PRODUCED)`.

### 6.11 TranslationError

```mel
type TranslationStage =
  | "chunking" | "normalization" | "fastPath" | "retrieval" 
  | "memory" | "proposer" | "assembly"

type ErrorCode =
  // Context errors
  | "INVALID_INPUT"
  | "INVALID_CONTEXT"
  | "SCHEMA_MISMATCH"
  | "SCHEMA_NOT_FOUND"
  // Stage-specific errors
  | "NORMALIZATION_FAILED"
  | "FAST_PATH_MISS"
  | "TYPE_ERROR"
  | "TYPE_MISMATCH"
  // Retrieval errors
  | "RETRIEVAL_TIMEOUT"
  | "RETRIEVAL_UNAVAILABLE"
  // Memory errors
  | "MEMORY_FAILURE"
  | "MEMORY_UNAVAILABLE"
  | "MEMORY_TIMEOUT"
  // Proposer errors
  | "PROPOSER_FAILURE"
  | "PROPOSER_TIMEOUT"
  // Assembly errors
  | "FRAGMENT_CONFLICT"
  | "INVALID_FRAGMENT"
  | "CONFIDENCE_TOO_LOW"
  | "NO_FRAGMENTS_PRODUCED"

type TranslationError = {
  code: ErrorCode,
  message: string,
  stage?: TranslationStage,    // Which stage failed
  details?: Record<string, JsonValue>,
  recoverable: boolean
}
```

### 6.12 PatchProgram (Multi-Input)

For long/complex documents with multiple inputs:

```mel
type ProgramStatus =
  | { kind: "complete" }
  | { kind: "partial", pendingAmbiguity: Array<string> }
  | { kind: "failed", error: TranslationError }

type PatchProgram = {
  programId: string,
  fragments: Array<PatchFragment>,
  dependencies: Record<string, Array<string>>,  // DAG
  status: ProgramStatus,
  pendingResolutions?: Array<string>
}
```

### 6.13 TranslationTrace

Every call MUST emit a trace. Trace MUST be JSON-serializable and safe to store.

```mel
type TranslationTrace = {
  traceId: string,
  
  request: {
    intentId: IntentId,
    atWorldId: WorldId,
    inputLength: number,
    inputPreview?: string,
    inputHash: string,
    language: string
  },
  
  stages: {
    chunking?: ChunkingTrace,
    normalization?: NormalizationTrace,
    fastPath?: FastPathTrace,
    retrieval?: RetrievalTrace,
    memory?: MemoryStageTrace,
    proposer?: ProposerTrace,
    assembly?: AssemblyTrace
  },
  
  resultKind: "fragment" | "ambiguity" | "error",
  
  timing: {
    startedAt: string,
    completedAt: string,
    durationMs: number
  },
  
  ambiguityResolution?: AmbiguityResolution,
  escalation?: EscalationTrace
}
```

### 6.14 Stage Traces

```mel
type ChunkingTrace = {
  sectionCount: number,
  durationMs: number
}

type NormalizationTrace = {
  detectedLanguage: string,
  glossaryHitCount: number,
  protectedTokenCount: number,
  durationMs: number
}

type FastPathTrace = {
  attempted: boolean,
  matched: boolean,
  candidateCount: number,
  bestConfidence?: number,
  durationMs: number
}

type RetrievalTrace = {
  tier: 0 | 1 | 2,
  candidateCount: number,
  topScore?: number,
  durationMs: number
}

// Memory trace (canonical definition)
type MemoryStageTrace = {
  attempted: boolean,
  atWorldId: WorldId,
  trace?: MemoryTrace,  // From @manifesto-ai/memory v1.2.0
  selectedCount: number,
  averageConfidence?: number,
  contentSummary?: {
    exampleCount: number,
    schemaSnapshotCount: number,
    glossaryTermCount: number,
    resolutionCount: number
  },
  degraded: boolean,
  degradeReason?: "SELECTOR_NOT_CONFIGURED" | "SELECTION_EMPTY" | "SELECTOR_ERROR",
  errorMessage?: string,  // Present when degradeReason is "SELECTOR_ERROR"
  durationMs: number
}

type ProposerTrace = {
  modelId: string,
  promptTokens?: number,
  completionTokens?: number,
  escalated: boolean,
  escalationReason?: string,
  durationMs: number
}

type AssemblyTrace = {
  fragmentCount: number,
  finalConfidence: number,
  conflictCount: number,
  dedupeCount: number,
  resultKind: "fragment" | "ambiguity" | "error",
  durationMs: number
}
```

**Note:** `MemoryTrace` is defined in `@manifesto-ai/memory` v1.2.0. Translator MUST NOT redefine this type.

### 6.15 EscalationTrace

```mel
// Escalation trace (canonical definition)
type EscalationTrace = {
  reportId: string,
  escalatedAt: string,
  escalatedTo: ActorRef,
  resolvedAt: string,
  resolutionDurationMs: number,
  choiceKind: "option" | "freeform",
  selectedOptionId?: string
}
```

### 6.16 TranslationContext

```mel
type TranslationContext = {
  // REQUIRED: World reference (source of truth)
  atWorldId: WorldId,
  
  // MUST be derived from World.schemaHash
  schema: DomainSchema,
  
  // MUST be derived from schema via deriveTypeIndex()
  typeIndex: TypeIndex,
  
  // Optional: for context-aware translation
  snapshot?: Snapshot,
  
  // Intent identifier for this translation
  intentId: IntentId,
  
  // Actor initiating translation
  actor?: ActorRef,
  
  // Optional glossary for normalization
  glossary?: Glossary
}
```

**World Derivation (Normative):**

TranslationContext MUST be derived from World. Independent construction is a spec violation.

| Field | Derivation |
|-------|------------|
| `atWorldId` | Direct from World |
| `schema` | `schemaStore.get(World.schemaHash)` |
| `typeIndex` | `deriveTypeIndex(schema)` |
| `snapshot` | `snapshotStore.get(World.snapshotHash)` (optional) |

### 6.17 Memory Content Types

```mel
type TranslationExample = {
  worldId: WorldId,
  input: string,
  normalizedInput: string,
  fragments: Array<PatchFragment>,
  confidence: number,
  verified: boolean
}

type SchemaSnapshot = {
  worldId: WorldId,
  schema: DomainSchema,
  changedPaths: Array<SemanticPath>
}

type GlossaryTerm = {
  term: string,
  definition: string,
  mappedPath?: SemanticPath,
  sourceWorldId?: WorldId,
  confidence?: number
}

type ResolutionRecord = {
  worldId: WorldId,
  report: AmbiguityReport,
  resolution: AmbiguityResolution,
  resultingFragments: Array<PatchFragment>
}

type MemoryContent = {
  translationExamples: Array<TranslationExample>,
  schemaHistory: Array<SchemaSnapshot>,
  glossaryTerms: Array<GlossaryTerm>,
  resolutionHistory: Array<ResolutionRecord>
}
```

### 6.18 Configuration Types

```mel
type MemoryPolicy = {
  mode: "default" | "require",
  minAverageConfidence?: number,
  requireStrongEvidence?: boolean
}

type ConfidencePolicy = {
  autoAcceptThreshold: number,
  rejectThreshold: number
}

// TraceConfig: Single normative definition (Blocker #4 fix)
// §11.3 TypeScript version is informative only
type TraceConfig = {
  sink?: "file" | "callback" | "none",
  includeRawInput: boolean,
  includeRawModelResponse: boolean,
  includeInputPreview: boolean,
  maxPreviewLength: number,
  redactSensitiveData: boolean
}

type TranslatorConfig = {
  stores?: {
    world: WorldStore,
    schema: SchemaStore,
    snapshot?: SnapshotStore
  },
  memorySelector?: MemorySelector,
  memoryPolicy?: MemoryPolicy,
  retrievalTier: 0 | 1 | 2,
  slmModel: string,
  escalationThreshold: number,
  fastPathEnabled: boolean,
  fastPathOnly: boolean,
  confidencePolicy: ConfidencePolicy,
  traceConfig: TraceConfig,
  contextVerification?: "strict" | "trust"
}
```

---

## 7. Glossary

### 7.1 Purpose

Glossary provides **stable semantic anchoring** for multilingual inputs. Normalization uses Glossary to map aliases to canonical semantic identifiers.

### 7.2 GlossaryEntry

```mel
type GlossaryEntry = {
  semanticId: string,
  canonical: string,
  aliases: Record<string, Array<string>>,
  anchorHints?: Array<SemanticPath>,
  pos?: "noun" | "verb" | "adj" | "adv",
  provenance?: "builtin" | "project" | "user"
}
```

**Examples:**

```mel
// Built-in operator mapping
type GreaterThanOrEqualEntry = {
  semanticId: "op.gte",
  canonical: "greater than or equal",
  aliases: {
    en: [">=", "at least", "no less than"],
    ko: ["이상", "크거나 같은"],
    ja: ["以上"]
  },
  pos: "adj",
  provenance: "builtin"
}

// Project-specific entity
type UserEntityEntry = {
  semanticId: "entity.user",
  canonical: "user",
  aliases: {
    en: ["user", "member", "account"],
    ko: ["사용자", "유저", "회원"]
  },
  anchorHints: ["types.User", "state.currentUser"],
  pos: "noun",
  provenance: "project"
}
```

### 7.3 Glossary (MEL Data Structure)

```mel
// Glossary container (normative MEL definition)
type Glossary = {
  entries: Array<GlossaryEntry>
}
```

**Normalization Indexing (Informative):**

Stage 1 implementations SHOULD build deterministic indices from `Glossary.entries`:

```typescript
// INFORMATIVE: Example implementation
interface GlossaryIndex {
  // Built from Glossary.entries during initialization
  bySemanticId: Map<string, GlossaryEntry>;
  byAlias: Map<string, Map<string, GlossaryEntry>>; // lang -> alias -> entry
}

function buildIndex(glossary: Glossary): GlossaryIndex {
  const bySemanticId = new Map<string, GlossaryEntry>();
  const byAlias = new Map<string, Map<string, GlossaryEntry>>();
  
  for (const entry of glossary.entries) {
    bySemanticId.set(entry.semanticId, entry);
    for (const [lang, aliases] of Object.entries(entry.aliases)) {
      if (!byAlias.has(lang)) byAlias.set(lang, new Map());
      for (const alias of aliases) {
        byAlias.get(lang)!.set(alias.toLowerCase(), entry);
      }
    }
  }
  return { bySemanticId, byAlias };
}
```

**Stage 1 Determinism:** The index built from `Glossary.entries` is deterministic because:
1. `entries` array order is preserved
2. Index construction is pure function
3. Same `Glossary` input → same lookup behavior

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

Translator MUST integrate with `@manifesto-ai/memory` v1.2.0. Memory is the **default execution path**, not an optional enhancement.

### 8.1 Memory as Structural Input

> **Memory는 "참고용 선택 결과"가 아니라, Translator의 few-shot / 패턴 / 해석 근거를 구성하는 구조적 입력이다.**

Memory provides:

| Memory Provides | Used For |
|-----------------|----------|
| TranslationExamples | Few-shot examples in Proposer (Stage 5) |
| SchemaHistory | Understanding domain evolution |
| ResolutionHistory | Confidence calibration (Stage 6) |
| GlossaryTerms | Domain vocabulary (compiled to config) |

**Default vs. Degraded Path:**

| Path | Memory Status | Behavior |
|------|---------------|----------|
| **Default** | Memory available | Full few-shot, history-aware translation |
| **Degraded** | Memory unavailable | Generic prompting, lower quality |

The absence of Memory is **graceful degradation**, not "normal operation".

### 8.2 Memory Architecture in Translator

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TRANSLATOR MEMORY FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  NL Input: "사용자 이름은 5자 이상이어야 함"                               │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────┐                                                        │
│  │  Stage 4:   │                                                        │
│  │  Memory     │───────► Selector.select({                              │
│  │             │           query: normalizedInput,                      │
│  │             │           atWorldId: context.atWorldId,                │
│  │             │           constraints: { ... }                         │
│  │             │         })                                             │
│  └──────┬──────┘                                                        │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  SelectionResult                                                 │   │
│  │  {                                                               │   │
│  │    selected: [                                                   │   │
│  │      {                                                           │   │
│  │        ref: { worldId: 'world-past-1' },                         │   │
│  │        reason: 'Similar constraint translation',                 │   │
│  │        confidence: 0.85,                                         │   │
│  │        verified: true,                                           │   │
│  │        evidence: { method: 'merkle', ... }                       │   │
│  │      },                                                          │   │
│  │      ...                                                         │   │
│  │    ]                                                             │   │
│  │  }                                                               │   │
│  └──────┬──────────────────────────────────────────────────────────┘   │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────┐     Fetch World content for each selected memory      │
│  │  Store.get  │◄────────────────────────────────────────────────────   │
│  │  (worldId)  │                                                        │
│  └──────┬──────┘                                                        │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  MemoryContext (for Proposer)                                    │   │
│  │  {                                                               │   │
│  │    translationExamples: [                                        │   │
│  │      { input: "이름은 필수", output: [addConstraint(...)] },      │   │
│  │      { input: "길이 제한 5자", output: [addConstraint(...)] },    │   │
│  │    ],                                                            │   │
│  │    schemaHistory: [...],                                         │   │
│  │    glossaryTerms: [...],                                         │   │
│  │    resolutionHistory: [...]                                      │   │
│  │  }                                                               │   │
│  └──────┬──────────────────────────────────────────────────────────┘   │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────┐                                                        │
│  │  Stage 5:   │◄──── MemoryContext injected into LLM prompt           │
│  │  Proposer   │                                                        │
│  │  (LLM)      │                                                        │
│  └─────────────┘                                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.3 What Translator Retrieves from Memory

Memory selection returns `SelectedMemory[]` - references to past Worlds. Translator MUST fetch **actual content** from these Worlds.

**Memory Content Types (defined in §6.17):**

| Type | Description |
|------|-------------|
| `MemoryContent` | Container for all memory-derived content |
| `TranslationExample` | Past translation (NL → Fragment) |
| `SchemaSnapshot` | Schema evolution snapshot |
| `GlossaryTerm` | Domain-specific term from past usage |
| `ResolutionRecord` | How past ambiguities were resolved |

See §6.17 for complete type definitions in MEL.

### 8.4 Memory Usage by Stage

Memory is fetched at **Stage 4** and used in **subsequent stages only**:

| Stage | Memory Usage | Determinism |
|-------|--------------|-------------|
| Stage 0 (Chunking) | ❌ None | MUST deterministic |
| Stage 1 (Normalization) | ❌ None (uses pre-built glossary from config) | MUST deterministic |
| Stage 2 (Fast-Path) | ❌ None (uses pre-built patterns from config) | MUST deterministic |
| Stage 3 (Retrieval) | ❌ None | SHOULD deterministic |
| **Stage 4 (Memory)** | **Selection + content fetch** | MAY non-deterministic |
| **Stage 5 (Proposer)** | **✅ Few-shot examples** | MAY non-deterministic |
| **Stage 6 (Assembly)** | **✅ Resolution history for confidence** | MUST deterministic |

**Important Clarification:**

Stage 1/2 do NOT use runtime Memory. They use **pre-built, offline-compiled** resources:

```typescript
// Stage 1 uses pre-built glossary (from config, NOT from Memory)
type TranslationConfig = {
  // Pre-compiled glossary for normalization (offline)
  glossary?: Glossary;
  
  // Pre-compiled fast-path patterns (offline)
  fastPathPatterns?: FastPathPattern[];
  
  // ... other config
};

// These are built OFFLINE from historical data, not fetched at runtime
// This preserves Stage 1/2 determinism while still benefiting from history
```

**Why this separation matters:**

| Concern | Resolution |
|---------|------------|
| Stage 1/2 MUST be deterministic | No runtime Memory fetch |
| Stage 1/2 MUST be offline-capable | Pre-built config, no network |
| Memory is non-deterministic (LLM selection) | Only used after Stage 4 |
| Historical patterns still useful | Compiled into config offline |

### 8.5 Stage 4: Memory Stage (Detailed)

Stage 4 performs memory selection and content retrieval.

**Store Boundaries (Important):**

| Store | Package | Responsibility |
|-------|---------|---------------|
| `MemorySelector` | `@manifesto-ai/memory` v1.2.0 | Select relevant past WorldIds |
| `WorldStore` | World Protocol / Application | Fetch actual World content |
| `SchemaStore` | World Protocol / Application | Fetch Schema by hash |

Memory package handles **selection only**. World content is fetched via **World Protocol stores**:

```typescript
import { MemorySelector, MemoryTraceUtils } from '@manifesto-ai/memory';  // v1.2.0
import type { SelectionRequest, SelectionResult, MemoryTrace } from '@manifesto-ai/memory';

// World stores are from World Protocol, NOT memory package
import type { WorldStore, SchemaStore } from '@manifesto-ai/world';

async function memoryStage(
  normalizedInput: string,
  context: TranslationContext,
  selector: MemorySelector | null,  // null if not configured
  worldStore: WorldStore,
  schemaStore: SchemaStore
): Promise<MemoryStageResult> {
  const startTime = Date.now();
  
  // Handle degraded case: no selector configured
  if (!selector) {
    return {
      content: { translationExamples: [], schemaHistory: [], glossaryTerms: [], resolutionHistory: [] },
      selectedCount: 0,
      degraded: true,
      trace: {
        attempted: false,
        atWorldId: context.atWorldId,
        selectedCount: 0,
        degraded: true,
        degradeReason: 'SELECTOR_NOT_CONFIGURED',
        durationMs: Date.now() - startTime,
      },
    };
  }
  
  try {
    // 1. Build selection request (memory v1.2.0 API)
    const request: SelectionRequest = {
      query: normalizedInput,
      atWorldId: context.atWorldId,
      selector: context.actor ?? { actorId: 'translator', kind: 'system' },
      constraints: {
        maxResults: 10,
        minConfidence: 0.6,
        requireVerified: true,
      },
    };
    
    // 2. Select relevant past Worlds (memory package)
    const selectionResult: SelectionResult = await selector.select(request);
    
    // 3. Fetch content from selected Worlds (World Protocol stores)
    const memoryContent: MemoryContent = await fetchMemoryContent(
      selectionResult.selected,
      worldStore,
      schemaStore,
      normalizedInput
    );
    
    // 4. Create memory trace (memory v1.2.0 utility)
    const memoryTrace: MemoryTrace = MemoryTraceUtils.create(request, selectionResult);
    
    // 5. Calculate average confidence
    const selectedCount = selectionResult.selected.length;
    const averageConfidence = selectedCount > 0
      ? selectionResult.selected.reduce((sum, m) => sum + m.confidence, 0) / selectedCount
      : undefined;
    
    // 6. Build MemoryStageResult (matches §6.5 normative type)
    const durationMs = Date.now() - startTime;
    const degraded = selectedCount === 0;
    
    return {
      content: memoryContent,
      selectedCount,
      averageConfidence,
      degraded,
      trace: {
        attempted: true,
        atWorldId: context.atWorldId,
        trace: memoryTrace,  // MemoryTrace goes inside MemoryStageTrace.trace
        selectedCount,
        averageConfidence,
        contentSummary: {
          exampleCount: memoryContent.translationExamples.length,
          schemaSnapshotCount: memoryContent.schemaHistory.length,
          glossaryTermCount: memoryContent.glossaryTerms.length,
          resolutionCount: memoryContent.resolutionHistory.length,
        },
        degraded,
        degradeReason: degraded ? 'SELECTION_EMPTY' : undefined,
        durationMs,
      },
    };
    
  } catch (error) {
    // Handle selector errors gracefully (degraded mode)
    const durationMs = Date.now() - startTime;
    return {
      content: { translationExamples: [], schemaHistory: [], glossaryTerms: [], resolutionHistory: [] },
      selectedCount: 0,
      degraded: true,
      trace: {
        attempted: true,
        atWorldId: context.atWorldId,
        selectedCount: 0,
        degraded: true,
        degradeReason: 'SELECTOR_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs,
      },
    };
  }
}

async function fetchMemoryContent(
  selected: SelectedMemory[],
  worldStore: WorldStore,
  schemaStore: SchemaStore,
  currentInput: string
): Promise<MemoryContent> {
  const translationExamples: TranslationExample[] = [];
  const schemaHistory: SchemaSnapshot[] = [];
  const glossaryTerms: GlossaryTerm[] = [];
  const resolutionHistory: ResolutionRecord[] = [];
  
  for (const memory of selected) {
    // Fetch World from World Protocol store (NOT memory store)
    const world: World = await worldStore.get(memory.ref.worldId);
    
    // Extract relevant content based on what's in the World
    // (Implementation depends on what metadata is stored with Worlds)
    
    // If World has translation history metadata
    if (world.metadata?.translationHistory) {
      translationExamples.push(...extractExamples(world, currentInput));
    }
    
    // Schema snapshot (via World Protocol schema store)
    const schema = await schemaStore.get(world.schemaHash);
    schemaHistory.push({
      worldId: memory.ref.worldId,
      schema: schema,
      changedPaths: world.metadata?.changedPaths ?? [],
    });
    
    // Glossary terms from this World's usage
    if (world.metadata?.glossary) {
      glossaryTerms.push(...world.metadata.glossary);
    }
    
    // Resolution history
    if (world.metadata?.resolutions) {
      resolutionHistory.push(...world.metadata.resolutions);
    }
  }
  
  return { translationExamples, schemaHistory, glossaryTerms, resolutionHistory };
}
```

### 8.6 Memory in Proposer (Stage 5)

Proposer uses MemoryContent to build LLM prompt with few-shot examples:

```typescript
function buildProposerPrompt(
  normalizedInput: string,
  context: TranslationContext,
  memoryContent: MemoryContent
): string {
  return `
You are a Manifesto schema translator. Convert natural language to PatchFragment.

## Current Schema
${JSON.stringify(context.schema, null, 2)}

## Past Translation Examples (from memory)
${memoryContent.translationExamples.map(ex => `
Input: "${ex.input}"
Output: ${JSON.stringify(ex.fragments, null, 2)}
`).join('\n')}

## Domain Glossary
${memoryContent.glossaryTerms.map(t => `- ${t.term}: ${t.definition}`).join('\n')}

## Current Input
"${normalizedInput}"

## Task
Generate PatchFragment(s) for the current input.
`;
}
```

### 8.7 Memory Rules (Normative)

| Rule | Description |
|------|-------------|
| MEM-001 | Translator MUST call Selector with `atWorldId` from context |
| MEM-002 | Translator MUST NOT treat memory content as truth |
| MEM-003 | Translator MUST create MemoryTrace via `MemoryTraceUtils.create()` |
| MEM-004 | Translator MUST fetch actual World content via Store |
| MEM-005 | Translator MUST include MemoryContent in Proposer prompt |
| MEM-006a | When `memoryPolicy.mode === "default"`: Translator MAY skip Stage 4 if no Selector is configured (proceeds degraded) |
| MEM-006b | When `memoryPolicy.mode === "require"`: Translator MUST error if Selector unavailable or selection empty (see §8.9) |
| MEM-007 | Authority MUST NOT re-select; Authority MAY call verifyProof() only |
| MEM-008 | Actor MUST attach MemoryTrace to Proposal |

**MEM-006 Clarification:** The behavior when Selector is unavailable depends on `memoryPolicy.mode`. In "default" mode, Stage 4 degrades gracefully. In "require" mode, Stage 4 failure is a hard error (§8.9 takes precedence).

### 8.8 Memory Trace Structure

`MemoryStageTrace` is defined in §6.14 (single canonical definition).

**Key Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `attempted` | `boolean` | Whether selector was configured |
| `atWorldId` | `string` | World anchor for selection |
| `trace` | `MemoryTrace?` | From `@manifesto-ai/memory` v1.2.0 (see table below for presence rules) |
| `selectedCount` | `number` | Number of memories selected |
| `averageConfidence` | `number?` | Average confidence score |
| `contentSummary` | `object?` | Counts of examples, schemas, glossary, resolutions |
| `degraded` | `boolean` | `true` when memory unavailable/empty |
| `durationMs` | `number` | Stage timing |

**Degradation Scenarios:**

| Scenario | `attempted` | `degraded` | `trace` |
|----------|-------------|------------|---------|
| No selector configured | `false` | `true` | `undefined` |
| Selector configured, selection failed | `true` | `true` | `undefined` |
| Selector configured, empty result | `true` | `true` | present (with empty selections) |
| Selector configured, successful | `true` | `false` | present (with content) |

**trace Presence Rule:** `trace` is present whenever `attempted === true` AND selector did not throw an error. Empty selection still produces a valid `MemoryTrace` with `selected: []`.

### 8.9 When Memory is Unavailable

Memory unavailability behavior depends on `memoryPolicy.mode`:

**Mode: "default" (Default)**

If Selector is not configured or returns empty:

```typescript
if (!selector || selectionResult.selected.length === 0) {
  // Stage 4 produces empty content
  return {
    content: {
      translationExamples: [],
      schemaHistory: [],
      glossaryTerms: [],
      resolutionHistory: [],
    },
    trace: emptyTrace,
    selectedCount: 0,
  };
  
  // Stage 5 (Proposer) proceeds without few-shot examples
  // Translation quality may be lower but still functional
}
```

**Mode: "require" (Strict)**

If `memoryPolicy.mode === "require"` and memory is unavailable:

```typescript
if (memoryPolicy.mode === 'require') {
  if (!selector) {
    // Selector not configured → fail immediately
    return error('MEMORY_UNAVAILABLE', 'Memory selector not configured but memoryPolicy.mode is require');
  }
  
  try {
    const selectionResult = await selector.select(/*...*/);
    if (selectionResult.selected.length === 0) {
      // Empty result → fail
      return error('MEMORY_UNAVAILABLE', 'Memory selection returned empty but memoryPolicy.mode is require');
    }
  } catch (e) {
    // Selection failed → fail with timeout or unavailable
    if (isTimeout(e)) {
      return error('MEMORY_TIMEOUT', 'Memory selection timed out');
    }
    return error('MEMORY_UNAVAILABLE', 'Memory selection failed');
  }
}
```

**Summary:**

| Mode | Selector Not Configured | Selection Empty | Selection Timeout |
|------|------------------------|-----------------|-------------------|
| `default` | Proceed (degraded) | Proceed (degraded) | Proceed (degraded) |
| `require` | `error(MEMORY_UNAVAILABLE)` | `error(MEMORY_UNAVAILABLE)` | `error(MEMORY_TIMEOUT)` |

### 8.10 Memory Confidence and Ambiguity

Low memory confidence MAY trigger policy ambiguity when `memoryPolicy.requireStrongEvidence` is enabled:

```typescript
const memoryPolicy = config.memoryPolicy ?? { mode: 'default' };
const minConfidence = memoryPolicy.minAverageConfidence ?? 0.6;

if (averageMemoryConfidence < minConfidence) {
  // Memory evidence is weak
  // Translator MAY:
  // 1. Proceed with lower overall confidence (mode: 'default')
  // 2. Return policy ambiguity asking Human to confirm (requireStrongEvidence: true)
  
  if (memoryPolicy.requireStrongEvidence) {
    return {
      kind: 'ambiguity',
      report: {
        kind: 'policy',
        reportId: generateReportId(),
        normalizedInput,
        candidates: [
          { 
            optionId: 'opt-apply', 
            description: 'Apply with weak memory evidence',
            fragments: proposedFragments,
            confidence: adjustedConfidence,
          },
          { 
            optionId: 'opt-cancel', 
            description: 'Cancel and provide more context',
            fragments: [],
            confidence: 1.0,
          },
        ],
        resolutionPrompt: {
          question: 'Memory evidence is weak. Proceed anyway?',
          affirmativeLabel: 'Apply',
          negativeLabel: 'Cancel',
        },
      },
      trace: buildTrace(),
    };
  }
  
  // mode: 'default' → continue with degraded confidence
}
```

---

## 8A. World Integration (Normative)

Translator operates on a specific World. This section defines how Translator integrates with the World Protocol.

### 8A.1 World as Source of Truth

Translator MUST derive all schema information from the referenced World:

```typescript
// Actor provides World reference
const world: World = await worldStore.get(atWorldId);

// Translator derives context from World
const schema: DomainSchema = await schemaStore.get(world.schemaHash);
const snapshot: Snapshot = await snapshotStore.get(world.snapshotHash);

// TranslationContext is built FROM World
const context: TranslationContext = {
  atWorldId: world.worldId,
  schema: schema,
  typeIndex: deriveTypeIndex(schema),  // See §8A.2
  glossary: loadGlossary(schema),
  intentId: generateIntentId(),
  actor: currentActor,
};
```

**World → Context Derivation Rules:**

| Context Field | Source | Derivation |
|---------------|--------|------------|
| `atWorldId` | World.worldId | Direct reference |
| `schema` | World.schemaHash → DomainSchema | Lookup by hash |
| `typeIndex` | DomainSchema.state + computed + actions | Derived (§8A.2) |
| `glossary` | DomainSchema.meta or external | Schema-specific terms |
| `intentId` | Fresh generation | Unique per translation attempt |
| `actor` | Caller context | Who is requesting translation |

### 8A.2 TypeIndex Derivation from Schema

TypeIndex MUST be derived from `DomainSchema`, not provided independently:

```typescript
function deriveTypeIndex(schema: DomainSchema): TypeIndex {
  const index: TypeIndex = {};
  
  // 1. State fields (REQUIRED: schema.state.fields)
  for (const [fieldName, fieldSpec] of Object.entries(schema.state.fields)) {
    index[`state.${fieldName}`] = resolveType(fieldSpec.type, schema);
  }
  
  // 2. Named types (REQUIRED: schema.types, may be empty {})
  for (const [typeName, typeDef] of Object.entries(schema.types)) {
    index[`types.${typeName}`] = resolveType(typeDef, schema);
    // Also index fields of object types
    // NOTE: fields is Record<string, {...}>, not array (see §6.3)
    if (typeDef.kind === 'object') {
      for (const [fieldName, fieldSpec] of Object.entries(typeDef.fields)) {
        index[`types.${typeName}.fields.${fieldName}`] = resolveType(fieldSpec.type, schema);
      }
    }
  }
  
  // 3. Computed values (REQUIRED: schema.computed, may be empty {})
  for (const [computedName, computedSpec] of Object.entries(schema.computed)) {
    index[`computed.${computedName}`] = resolveType(computedSpec.type, schema);
  }
  
  // 4. Action parameters (REQUIRED: schema.actions, may be empty {})
  // NOTE: params is Record<string, ActionParamSpec>, not array (see §6.7)
  for (const [actionName, actionSpec] of Object.entries(schema.actions)) {
    for (const [paramName, paramSpec] of Object.entries(actionSpec.params ?? {})) {
      index[`actions.${actionName}.params.${paramName}`] = resolveType(paramSpec.type, schema);
    }
  }
  
  return index;
}
```

**Schema Requirements for TypeIndex Derivation:**

| Field | Required | May be Empty |
|-------|----------|--------------|
| `schema.state.fields` | ✅ MUST | ✅ May be `{}` |
| `schema.types` | ✅ MUST | ✅ May be `{}` |
| `schema.computed` | ✅ MUST | ✅ May be `{}` |
| `schema.actions` | ✅ MUST | ✅ May be `{}` |

**Invariant:** TypeIndex MUST be consistent with Schema. If provided independently, Translator MUST reject with `INVALID_CONTEXT` error.

### 8A.3 Snapshot Context for Translation

Translator MAY read current Snapshot values for context-aware translation:

```typescript
// Example: Understanding current state for better translation
const currentTasks = snapshot.data.tasks;  // Array of current tasks
const isArchived = snapshot.computed.isArchived;  // Computed value

// Translator can use this context to:
// 1. Suggest field names that match existing patterns
// 2. Understand domain vocabulary from actual data
// 3. Validate proposed changes against current structure
```

**Rules:**
- Translator MAY read Snapshot for context
- Translator MUST NOT modify Snapshot
- Snapshot values are NOT truth for schema (Schema is truth)
- Snapshot provides "current state" context for natural language understanding

### 8A.4 Fragment → Proposal Conversion

Translator returns `PatchFragment[]`. Actor MUST convert to World Protocol `Proposal`:

```typescript
// Translator returns
const result: TranslationResult = await translator.translate(input, context);

if (result.kind === 'fragment') {
  // Actor converts to Proposal for World Protocol
  const intent: IntentInstance = {
    body: {
      type: 'schema:patch',  // Schema modification intent
      input: {
        fragments: result.fragments,
        trace: result.trace,
      },
    },
    intentId: context.intentId,
    intentKey: `translate:${context.intentId}`,
    meta: {
      origin: {
        actor: context.actor,
        source: 'translator',
        timestamp: Date.now(),
      },
    },
  };
  
  const proposal: Proposal = {
    proposalId: generateProposalId(),
    actor: context.actor,
    intent: intent,
    baseWorld: context.atWorldId,
    status: 'submitted',
    submittedAt: Date.now(),
  };
  
  // Submit to Authority for approval
  const decision = await authority.judge(proposal);
}
```

**Responsibility Chain:**

| Step | Component | Action |
|------|-----------|--------|
| 1 | Actor | Calls `translator.translate(input, context)` |
| 2 | Translator | Returns `fragment` or `ambiguity` or `error` |
| 3 | Actor | Wraps fragments in `IntentInstance` |
| 4 | Actor | Creates `Proposal` with intent |
| 5 | Actor | Submits to Authority |
| 6 | Authority | Judges and approves/rejects |
| 7 | Host | Executes approved intent |
| 8 | World | New World created with updated schema |

---

## 8B. Human Escalation Protocol (Normative)

> **Ambiguity = 기계가 결정할 수 없는 의미 → Human의 헌법적 권한**

Human Escalation is NOT a UX feature. It is an **architectural invariant**.

### 8B.0 Constitutional Foundation

Ambiguity represents a **constitutional boundary**—the point where machine interpretation ends and Human authority begins.

| Principle | Implication |
|-----------|-------------|
| Ambiguity is not a bug | It's a signal that Human decision is required |
| Agents cannot substitute for Humans | ESC-001: Agent auto-resolve is **forbidden** |
| opt-cancel is constitutional | Human can always decline all interpretations |
| Resolution becomes history | Stored in trace, becomes part of World lineage |

**This protocol is not:**
- A "nice-to-have" UX enhancement
- An "optional implementation hint"
- Something that can be "optimized away"

**This protocol IS:**
- An **architectural invariant** of Translator
- A **constitutional guarantee** for Human agency
- A **mandatory trace requirement** for governance

When Translator returns `AmbiguityReport`, it MUST be escalated to a Human for resolution. There are **no exceptions**.

### 8B.1 Escalation Flow

```
┌─────────────┐
│  Translator │
│  returns    │
│  ambiguity  │
└──────┬──────┘
       │ AmbiguityReport
       ▼
┌─────────────┐
│   Actor     │
│  (agent or  │
│   system)   │
└──────┬──────┘
       │ presents to Human (MUST, not MAY)
       ▼
┌─────────────┐
│   Human     │ ◄── UI shows candidates, asks for choice
│   (via UI)  │     Human exercises constitutional authority
└──────┬──────┘
       │ selects optionId or provides freeform
       ▼
┌─────────────┐
│ Actor calls │
│ resolve()   │
└──────┬──────┘
       │ AmbiguityResolution (with escalation trace)
       ▼
┌─────────────┐
│  Translator │
│  returns    │
│  fragment   │
└─────────────┘
```

### 8B.2 UI Presentation Requirements

When presenting `AmbiguityReport` to Human:

```typescript
// AmbiguityReport structure for UI
const report: AmbiguityReport = {
  reportId: 'amb-123',
  kind: 'intent',  // or 'policy', 'target', 'value', 'conflict'
  normalizedInput: 'Add email validation to user profile',
  candidates: [
    {
      optionId: 'opt-1',
      description: 'Add email format constraint to profile.email field',
      fragments: [...],
      confidence: 0.8,
    },
    {
      optionId: 'opt-2', 
      description: 'Add email uniqueness constraint across users',
      fragments: [...],
      confidence: 0.6,
    },
    {
      optionId: 'opt-cancel',
      description: 'Do not apply any changes',
      fragments: [],
      confidence: 1.0,
    },
  ],
  resolutionPrompt: {
    question: 'Which type of email validation do you want?',
    optionIds: ['opt-1', 'opt-2', 'opt-cancel'],
  },
  partialFragments: [],
  createdAt: '2025-01-03T12:00:00Z',
};

// UI MUST present:
// 1. The original input (normalizedInput)
// 2. All candidates with descriptions
// 3. Confidence scores (optional but recommended)
// 4. The resolution question
// 5. Option to cancel (opt-cancel)
// 6. Option to provide freeform clarification
```

### 8B.3 Resolution Collection

Human provides resolution via UI:

```typescript
// Option 1: Human selects a candidate
const resolution: AmbiguityResolution = {
  reportId: report.reportId,
  choice: { kind: 'option', optionId: 'opt-1' },
  resolvedBy: { actorId: 'human-user-123', kind: 'human' },
  resolvedAt: new Date().toISOString(),
  // REQUIRED when resolvedBy.kind === 'human' (see §6.9)
  escalation: {
    escalatedAt: escalationStartTime,  // When Actor presented to Human
    escalatedTo: { actorId: 'human-user-123', kind: 'human' },
  },
};

// Option 2: Human provides clarification
const resolution: AmbiguityResolution = {
  reportId: report.reportId,
  choice: { 
    kind: 'freeform', 
    text: 'I want email format validation like checking for @ symbol'  // NOTE: field is 'text', not 'input'
  },
  resolvedBy: { actorId: 'human-user-123', kind: 'human' },
  resolvedAt: new Date().toISOString(),
  // REQUIRED when resolvedBy.kind === 'human' (see §6.9)
  escalation: {
    escalatedAt: escalationStartTime,
    escalatedTo: { actorId: 'human-user-123', kind: 'human' },
  },
};
```

### 8B.4 Resolution Processing

Actor calls `resolve()` with Human's decision:

```typescript
// Actor processes Human's resolution
const resolvedResult = await translator.resolve(report, resolution, context);

if (resolvedResult.kind === 'fragment') {
  // Human's choice produced fragments → proceed to Proposal
  const proposal = createProposal(resolvedResult.fragments, context);
  await authority.judge(proposal);
} else if (resolvedResult.kind === 'ambiguity') {
  // Still ambiguous (e.g., freeform input unclear) → escalate again
  presentToHuman(resolvedResult.report);
} else {
  // Error → show error to Human
  showError(resolvedResult.error);
}
```

### 8B.5 Escalation Trace

All Human escalations MUST be recorded in `TranslationTrace.escalation`.

`EscalationTrace` is defined in §6.15 (single canonical definition).

**Key Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `reportId` | `string` | Which ambiguity report was escalated |
| `escalatedAt` | `string` | When escalation was initiated (by Actor) |
| `escalatedTo` | `ActorRef` | Human actor who received escalation |
| `resolvedAt` | `string` | When Human provided resolution |
| `resolutionDurationMs` | `number` | How long Human took to decide |
| `choiceKind` | `'option' \| 'freeform'` | Resolution type |
| `selectedOptionId` | `string?` | If option, which optionId was selected |

**Population Flow:**

```
Actor receives AmbiguityReport
  ↓
Actor presents to Human (records escalatedAt, escalatedTo)
  ↓
Human makes decision
  ↓
Actor builds AmbiguityResolution with escalation metadata
  ↓
Actor calls resolve(report, resolution, context)
  ↓
Translator builds EscalationTrace from resolution
  ↓
Translator returns TranslationResult with trace.escalation populated
```

### 8B.6 Escalation Invariants

| ID | Invariant |
|----|-----------|
| ESC-001 | Ambiguity MUST be escalated to Human; agents MUST NOT auto-resolve |
| ESC-002 | Human MUST see all candidates including opt-cancel |
| ESC-003 | Resolution MUST include `resolvedBy` with Human actor reference |
| ESC-004 | Freeform resolution MAY trigger another translation cycle |
| ESC-005 | Escalation trace MUST be preserved for audit |

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

### 9.5 deriveContext (Recommended)

```typescript
/**
 * Derives TranslationContext from World.
 * 
 * This is the RECOMMENDED way to construct TranslationContext.
 * It ensures context is properly derived from World (§8A.1).
 * 
 * @param atWorldId - The World to derive context from
 * @param actor - Actor initiating translation
 * @param stores - Store dependencies (from TranslatorConfig)
 * @returns Properly derived TranslationContext
 */
async function deriveContext(
  atWorldId: string,
  actor: ActorRef,
  stores: {
    world: WorldStore;
    schema: SchemaStore;
    snapshot?: SnapshotStore;
  }
): Promise<TranslationContext>;
```

**Implementation:**

```typescript
async function deriveContext(
  atWorldId: string,
  actor: ActorRef,
  stores: { world: WorldStore; schema: SchemaStore; snapshot?: SnapshotStore }
): Promise<TranslationContext> {
  // 1. Fetch World
  const world = await stores.world.get(atWorldId);
  if (!world) {
    throw new TranslationError('INVALID_CONTEXT', `World not found: ${atWorldId}`);
  }
  
  // 2. Fetch Schema from World
  const schema = await stores.schema.get(world.schemaHash);
  if (!schema) {
    throw new TranslationError('INVALID_CONTEXT', `Schema not found: ${world.schemaHash}`);
  }
  
  // 3. Derive TypeIndex from Schema
  const typeIndex = deriveTypeIndex(schema);
  
  // 4. Optionally fetch Snapshot
  const snapshot = stores.snapshot 
    ? await stores.snapshot.get(world.snapshotHash)
    : undefined;
  
  // 5. Return properly derived context
  return {
    atWorldId: world.worldId,
    schema,
    typeIndex,
    snapshot,
    actor,
    intentId: generateIntentId(),
    glossary: schema.meta?.glossary,
  };
}
```

**Usage Pattern:**

```typescript
// ✅ RECOMMENDED: Use deriveContext()
const context = await deriveContext(worldId, actor, translator.config.stores);
const result = await translate(input, context);

// ⚠️ ALLOWED but risky: Manual construction (verification depends on config)
const context = { atWorldId, schema, typeIndex, ... };  // Must match World
const result = await translate(input, context);
```

### 9.6 TranslationContext

```typescript
type TranslationContext = {
  /**
   * REQUIRED: Current World reference point.
   * 
   * ALL other context fields MUST be derived from this World:
   * - schema = worldStore.get(atWorldId) → schemaStore.get(world.schemaHash)
   * - typeIndex = deriveTypeIndex(schema) (see §8A.2)
   * 
   * Used for:
   * - Schema/TypeIndex derivation source
   * - Memory selection anchoring (passed to selector.select())
   * - Proposal anchoring (what World this change applies to)
   * - Authority verification context
   */
  readonly atWorldId: string;
  
  /**
   * Domain schema from referenced World.
   * MUST be looked up via World.schemaHash.
   * MUST NOT be constructed independently.
   */
  readonly schema: DomainSchema;
  
  /**
   * Type index derived from schema.
   * MUST be derived via deriveTypeIndex(schema) (see §8A.2).
   * MUST NOT be provided independently (inconsistency risk).
   */
  readonly typeIndex: TypeIndex;
  
  /** Intent identifier (unique per translation attempt) */
  readonly intentId: string;
  
  /**
   * Current Snapshot from World (optional but recommended).
   * Provides runtime context for context-aware translation.
   * MUST be looked up via World.snapshotHash if provided.
   */
  readonly snapshot?: Snapshot;
  
  /**
   * Actor initiating translation.
   * Used for Memory selection and Human escalation tracking.
   */
  readonly actor?: ActorRef;
  
  /** Glossary (from schema.meta or external override) */
  readonly glossary?: Glossary;
  
  /** Retrieval tier preference */
  readonly retrievalTier?: 0 | 1 | 2;
  
  /** Model policy */
  readonly modelPolicy?: 'small' | 'large' | 'auto';
};
```

**World Derivation (Normative):**

TranslationContext MUST be derived from World. Independent construction is a spec violation:

```typescript
// ✅ CORRECT: Derive everything from World
async function buildContext(atWorldId: string, actor: ActorRef): Promise<TranslationContext> {
  // 1. Get World
  const world: World = await worldStore.get(atWorldId);
  
  // 2. Get Schema from World
  const schema: DomainSchema = await schemaStore.get(world.schemaHash);
  
  // 3. Derive TypeIndex from Schema (see §8A.2)
  const typeIndex: TypeIndex = deriveTypeIndex(schema);
  
  // 4. Optionally get Snapshot for context
  const snapshot: Snapshot = await snapshotStore.get(world.snapshotHash);
  
  return {
    atWorldId: world.worldId,
    schema,
    typeIndex,
    snapshot,
    actor,
    intentId: generateIntentId(),
    glossary: schema.meta?.glossary,
  };
}

// ❌ INCORRECT: Independent construction (spec violation)
const context = {
  atWorldId: 'some-id',
  schema: someOtherSchema,  // May not match World!
  typeIndex: manuallyCreatedIndex,  // May not match schema!
  // ...
};
```

**Invariants:**
- `atWorldId` MUST reference a valid, existing World
- `schema` MUST be the exact schema from `World.schemaHash`
- `typeIndex` MUST be derived from `schema` (not provided independently)
- Translator MUST validate consistency and return `INVALID_CONTEXT` if mismatched

**Why World Derivation Matters:**

| Without World Derivation | With World Derivation |
|--------------------------|----------------------|
| Schema may be stale | Schema is current truth |
| TypeIndex may be inconsistent | TypeIndex is guaranteed consistent |
| Changes may conflict with current state | Changes are based on current state |
| Authority cannot verify context | Authority can verify against World |

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

Configuration types are defined in MEL (see §6.18):

- `TranslatorConfig` - Main configuration type
- `MemoryPolicy` - Memory handling configuration
- `ConfidencePolicy` - Confidence threshold configuration
- `TraceConfig` - Trace output configuration

**Key Configuration Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `stores` | `{ world, schema, snapshot? }` | Store dependencies for verification |
| `memorySelector` | `MemorySelector` | Memory selector for Stage 4 |
| `memoryPolicy` | `MemoryPolicy` | Memory handling behavior |
| `retrievalTier` | `0 \| 1 \| 2` | Retrieval tier preference |
| `slmModel` | `string` | SLM model selection |
| `escalationThreshold` | `number` | Escalation threshold for larger model |
| `fastPathEnabled` | `boolean` | Fast-path enable/disable |
| `fastPathOnly` | `boolean` | Fast-path only mode |
| `confidencePolicy` | `ConfidencePolicy` | Confidence thresholds |
| `traceConfig` | `TraceConfig` | Trace configuration |
| `contextVerification` | `"strict" \| "trust"` | Context verification mode |

**Context Verification (§9.6):**

When `contextVerification == "strict"` and `stores` are provided, Translator verifies context matches World:

1. Fetch World from `stores.world`
2. Verify `context.schema.hash` matches `World.schemaHash`
3. Spot check TypeIndex consistency

**Fast-Path Configuration Priority:**

| `fastPathEnabled` | `fastPathOnly` | Behavior |
|-------------------|----------------|----------|
| `true` | `false` | Normal: try fast-path, fallback to proposer on miss |
| `true` | `true` | Strict: fast-path only, error/ambiguity on miss |
| `false` | `*` | Skip: always proceed to proposer (ignore `fastPathOnly`) |

When `fastPathEnabled=false`, the `fastPathOnly` flag is ignored and Stage 2 is skipped entirely.

### 11.2 Confidence Policy

`ConfidencePolicy` is defined in §6.18. Key thresholds:

| Field | Recommended | Description |
|-------|-------------|-------------|
| `autoAcceptThreshold` | 0.95 | Confidence >= this returns fragment directly |
| `rejectThreshold` | 0.30 | Confidence < this returns error |

Between reject and autoAccept thresholds, Translator returns policy ambiguity.

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

### 11.2.1 opt-cancel as Constitutional Escape Hatch

The `opt-cancel` candidate is a **constitutional escape hatch** that MUST be included in **all** ambiguity types (see §6.8 Candidate Invariants).

| Ambiguity Kind | Include opt-cancel? | Rationale |
|----------------|---------------------|-----------|
| `policy` | **MUST** | Confidence-based; Actor may reject low-confidence proposals |
| `intent` | **MUST** | Pattern ambiguity; Actor may want to abort and rephrase |
| `target` | **MUST** | Target unclear; Actor may want to clarify first |
| `value` | **MUST** | Even valid options need escape; Actor may want to cancel |
| `conflict` | **MUST** | Error might be appropriate, but Actor retains right to cancel |

**Rationale for Universal MUST:**

The Human Escalation Protocol (§8B) establishes that Actors—especially Humans—always retain the right to abort any operation. The `opt-cancel` candidate materializes this constitutional right in the ambiguity resolution flow:

1. **ESC-001:** Ambiguity MUST be escalated to Human for final decision
2. **Human Right:** Human can always choose to not proceed
3. **opt-cancel:** Implements "do not proceed" as a first-class choice

Without `opt-cancel`, an Actor facing ambiguity would be forced to choose among options they may not want—violating the constitutional principle.

When `opt-cancel` is chosen, `resolve()` returns `{ kind: 'fragment', fragments: [] }`. See §6.10.

### 11.3 Trace Configuration

`TraceConfig` is defined in §6.18 (normative MEL definition).

**Key Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `sink` | `"file" \| "callback" \| "none"` | Trace output destination |
| `includeRawInput` | `boolean` | Include raw input in trace |
| `includeRawModelResponse` | `boolean` | Include raw model response |
| `includeInputPreview` | `boolean` | Include input preview |
| `maxPreviewLength` | `number` | Maximum preview length |
| `redactSensitiveData` | `boolean` | Redact sensitive data |

> **Note:** The TypeScript example below is **informative** only. See §6.18 for normative definition.

---

## 12. Error Handling

### 12.1 TranslationError

`TranslationError` and `TranslationStage` are defined in §6.11 (normative MEL definition).

> **Note:** The TypeScript example below is **informative** only.

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

Some MEL constructs contain collections that are **semantically unordered** (order doesn't affect meaning). For deterministic hashing:

| Type | Field | Ordering |
|------|-------|----------|
| `TypeExpr (union)` | `members` | Sort by `canonicalize(member)` lexicographic |
| `TypeExpr (object)` | `fields` | **JCS key ordering** (fields is Record, not array) |
| `ResolvedType (union)` | `members` | Sort by `canonicalize(member)` lexicographic |
| `ResolvedType (object)` | `fields` | **JCS key ordering** (fields is Record, not array) |
| `ExprNode (obj)` | `fields` | Sort by `field.key` lexicographic (fields is key/value array) |

**Note on ExprNode.obj.fields:**

`ExprNode.obj.fields` is `Array<{ key: string, value: ExprNode }>` (MEL v0.3.3 canonical). Since arrays preserve insertion order, canonicalization MUST sort fields by `key` before hashing:

```typescript
// These two produce the SAME fragmentId:
{ kind: 'obj', fields: [{ key: 'a', value: lit1 }, { key: 'b', value: lit2 }] }
{ kind: 'obj', fields: [{ key: 'b', value: lit2 }, { key: 'a', value: lit1 }] }

// Because fields are sorted by key before hashing:
// sorted: [{ key: 'a', value: lit1 }, { key: 'b', value: lit2 }]
```

**Note on TypeExpr/ResolvedType.object.fields:**

Since `object.fields` is defined as `Record<string, {...}>` in MEL (see §6.3), JCS key ordering is automatically applied during canonicalization. No additional sorting step is needed for object fields.

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
    // JCS: keys sorted lexicographically
    const keys = Object.keys(value).sort();
    const pairs = keys.map(k => JSON.stringify(k) + ':' + canonicalize((value as any)[k]));
    return '{' + pairs.join(',') + '}';
  }
  throw new Error('Unsupported type');
}

function canonicalizeExprNode(expr: ExprNode): ExprNode {
  if (expr.kind === 'obj') {
    // Sort fields by key, then recursively canonicalize values
    const sorted = [...expr.fields]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(f => ({ key: f.key, value: canonicalizeExprNode(f.value) }));
    return { kind: 'obj', fields: sorted };
  }
  if (expr.kind === 'arr') {
    // Array order is semantic - preserve order, recursively canonicalize
    return { kind: 'arr', elements: expr.elements.map(canonicalizeExprNode) };
  }
  if (expr.kind === 'call') {
    return { kind: 'call', fn: expr.fn, args: expr.args.map(canonicalizeExprNode) };
  }
  if (expr.kind === 'get' && expr.base) {
    return { kind: 'get', base: canonicalizeExprNode(expr.base), path: expr.path };
  }
  // lit, var, sys, get without base pass through
  return expr;
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
    // fields is Record - JCS handles key ordering automatically
    // Recursively canonicalize nested types
    const canonicalizedFields: Record<string, { type: TypeExpr; optional: boolean }> = {};
    for (const [name, field] of Object.entries(expr.fields)) {
      canonicalizedFields[name] = { ...field, type: canonicalizeTypeExpr(field.type) };
    }
    return { kind: 'object', fields: canonicalizedFields };
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

### 16.1 Core Output Constraints

| Criterion | Requirement |
|-----------|-------------|
| Output Constraint | Emits only fragments/ambiguity/error (never MEL) |
| IR Compliance | Uses MEL v0.3.3 call-only ExprNode for computed expressions |
| Literal Values | Uses JsonValue (not ExprNode) for `setDefaultValue.value` |
| Type System | Treats types as first-class schema facts (`types` + `typeIndex`) |
| Context Validation | Returns `INVALID_CONTEXT` if schema/typeIndex inconsistent |

### 16.2 Manifesto Ecosystem Integration

| Criterion | Requirement |
|-----------|-------------|
| World Derivation | Context MUST be derived from World (§8A.1) |
| Schema Source | Schema MUST come from World.schemaHash lookup |
| TypeIndex Derivation | TypeIndex MUST be derived from Schema (§8A.2) |
| Snapshot Context | MAY use Snapshot for context-aware translation |
| Fragment → Proposal | Actor converts fragments to World Protocol Proposal (§8A.4) |
| Memory World Anchor | Memory selection uses atWorldId as anchor |

### 16.3 Human Escalation

| Criterion | Requirement |
|-----------|-------------|
| Ambiguity Escalation | AmbiguityReport MUST be escalated to Human (§8B.1) |
| Candidate Visibility | UI MUST show all candidates including opt-cancel (§8B.2) |
| Resolution Tracking | Resolution MUST include resolvedBy with Human actor (§8B.3) |
| Escalation Trace | Escalation MUST be recorded in trace (§8B.5) |
| No Auto-Resolve | Agents MUST NOT auto-resolve ambiguity (ESC-001) |

### 16.4 Identity & Determinism

| Criterion | Requirement |
|-----------|-------------|
| Canonical JSON | Uses RFC 8785 (JCS) for all identity hashing |
| Collection Ordering | Sorts union.members and object.fields before hashing |
| Deterministic Identity | `fragmentId = sha256(intentId + ':' + canonicalize(op))` (no ordinal) |
| reportId Sorting | Candidates sorted by optionId, fragments by fragmentId |

### 16.5 Ambiguity & Resolution

| Criterion | Requirement |
|-----------|-------------|
| Candidates Constraint | All AmbiguityReports have `candidates.length >= 2` |
| opt-cancel Universal | `opt-cancel` allowed in any ambiguity kind |
| No-op Result | `fragments: []` allowed from any `opt-cancel` resolution |
| Stateless Resolution | `resolve()` accepts report + resolution + context |

### 16.6 Memory Integration

| Criterion | Requirement |
|-----------|-------------|
| Memory Selection | Uses `@manifesto-ai/memory` v1.2.0 Selector API |
| Store Boundaries | Memory selects, World Protocol stores fetch content (§8.5) |
| Memory Usage | MemoryContent feeds Stage 5 (Proposer) and Stage 6 (Assembly) only |
| Stage 1/2 Independence | Stage 1/2 use pre-built config, NOT runtime Memory (§8.4) |
| Memory Trace | Creates MemoryTrace via `MemoryTraceUtils.create()` |
| World Context | Requires `atWorldId` in TranslationContext |
| Authority Boundary | Authority uses verifyProof-only |
| Auditability | Produces complete TranslationTrace for every run |
| Escalation Trace | `TranslationTrace.escalation` populated for Human escalations |
| Graceful Degradation | Functions without Memory (lower quality) |

### 16.7 Error & Conflict Handling

| Criterion | Requirement |
|-----------|-------------|
| Error Handling | Implements error taxonomy with codes |
| Fast Path Model | FastPathResult includes `candidates[]` for miss handling |
| Fragment Ordering | Applicator performs topological ordering |
| Conflict Detection | Returns `FRAGMENT_CONFLICT` or `ambiguity(kind='conflict')` |

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

### A.2 Basic Usage (World-Derived Context)

```typescript
import { translate, resolve, deriveContext } from '@manifesto-ai/translator';
import { worldStore, schemaStore, snapshotStore } from '@manifesto-ai/world';

// 1. Derive context from World (RECOMMENDED)
const context = await deriveContext(
  'world-abc-123',
  { actorId: 'user-123', kind: 'human' },
  { world: worldStore, schema: schemaStore, snapshot: snapshotStore }
);

// 2. Translate NL to fragments
const result = await translate(
  "사용자 이름은 5자 이상이어야 함",
  context
);

// 3. Handle result
switch (result.kind) {
  case 'fragment':
    // Convert to Proposal for World Protocol
    const proposal = createProposal(result.fragments, context);
    await authority.judge(proposal);
    break;
    
  case 'ambiguity':
    // Escalate to Human for decision (see A.3)
    const resolution = await presentToHuman(result.report);
    const resolved = await resolve(result.report, resolution, context);
    // ... handle resolved result
    break;
    
  case 'error':
    console.error('Error:', result.error.code, result.error.message);
    break;
}
```

### A.3 Ambiguity Resolution (with Human Escalation)

```typescript
if (result.kind === 'ambiguity') {
  // 1. Escalate to Human via UI
  const humanChoice = await presentToHuman(result.report);
  
  // 2. Build resolution with escalation metadata (ESC-003)
  const resolution: AmbiguityResolution = {
    reportId: result.report.reportId,
    choice: humanChoice,
    resolvedBy: { actorId: 'user-123', kind: 'human' },
    resolvedAt: new Date().toISOString(),
    // Escalation metadata for trace (ESC-005)
    escalation: {
      escalatedAt: escalationStartTime,
      escalatedTo: { actorId: 'user-123', kind: 'human' },
    },
  };
  
  // 3. Resolve using same World-derived context
  const resolved = await resolve(result.report, resolution, context);
  
  // 4. Handle resolved result
  if (resolved.kind === 'fragment') {
    const proposal = createProposal(resolved.fragments, context);
    await authority.judge(proposal);
  }
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

*End of Specification v1.1.1*
