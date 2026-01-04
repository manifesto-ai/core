# `@manifesto-ai/translator` Foundational Design Rationale v1.1

> **Status:** Release
> **Version:** 1.1.0
> **Companion To:** `@manifesto-ai/translator` SPEC v1.1.0
> **License:** MIT

---

## Changelog

| Version | Changes |
|---------|---------|
| **v1.1.0** | Added FDR-T022~T025: Manifesto Ecosystem Integration decisions |
| v1.0.0 | Initial release: FDR-T001~T021 |

---

## Table of Contents

1. [Overview](#overview)
2. [Core Philosophy Decisions](#core-philosophy-decisions)
3. [Data Model Decisions](#data-model-decisions)
4. [Pipeline Decisions](#pipeline-decisions)
5. [Identity & Determinism Decisions](#identity--determinism-decisions)
6. [Memory Integration Decisions](#memory-integration-decisions)
7. [Ambiguity & Resolution Decisions](#ambiguity--resolution-decisions)
8. [Configuration Decisions](#configuration-decisions)
9. [Summary Table](#summary-table)
10. [Cross-Reference: Related FDRs](#cross-reference-related-fdrs)

---

## Overview

This document captures the **foundational design rationale** for the `@manifesto-ai/translator` package. Each decision (FDR-T*) explains why the specification is designed the way it is, what alternatives were considered, and what consequences follow.

Translator is a **compiler frontend** that transforms natural language into semantic change proposals. It is NOT a code generator, NOT an executor, and NOT a decision-maker.

---

## Core Philosophy Decisions

### FDR-T001: Translator is Frontend Only (No MEL Generation)

#### Decision

Translator outputs **PatchFragment** (structured semantic ops), NOT MEL text.

#### Context

Two possible designs:

| Option | Output | Downstream |
|--------|--------|------------|
| A: Code Generator | MEL source text | Parser needed to consume |
| B: Frontend Only | Structured IR (PatchFragment) | Direct consumption |

#### Rationale

**Frontend-only design enables:**

1. **No round-trip parsing**: Downstream (Authority/Host) consumes fragments directly
2. **Validation before serialization**: Structural validation happens on typed data
3. **Deterministic rendering**: MEL text is a pure projection from IR (if needed)
4. **AI-friendly**: LLMs work better with structured constraints than free-form text

**Code generation would require:**
- MEL parser in every consumer
- Handling of syntax errors from LLM
- Loss of semantic structure

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Generate MEL text | Round-trip parsing, syntax error risk |
| Generate both | Complexity, sync burden |
| Let LLM choose format | Non-deterministic, validation nightmare |

#### Consequences

- Translator MUST NOT emit MEL text (INV-005)
- Deterministic Renderer is separate (optional, may be bundled)
- PatchFragment becomes the canonical unit of semantic change

---

### FDR-T002: Incremental-First Design

#### Decision

Every input is treated as an **incremental fragment**. "Initial generation" is just the first fragment set.

#### Context

Two mental models for domain authoring:

| Model | Approach |
|-------|----------|
| Document-First | Generate complete domain from epic spec |
| Incremental-First | Build domain through successive fragments |

#### Rationale

**Incremental-first is more robust because:**

1. **Smaller LLM context**: Each fragment is bounded
2. **Progressive validation**: Errors caught early
3. **Natural collaboration**: Human + AI iterate together
4. **Resumable**: Ambiguity pauses, resolution continues
5. **Auditable**: Each fragment has trace

**Document-first problems:**
- Massive context window needed
- All-or-nothing failure mode
- Hard to attribute errors
- No natural pause points

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Document-first with chunking | Chunks lose cross-reference context |
| Hybrid (detect epic vs incremental) | Complexity, mode confusion |

#### Consequences

- PatchProgram exists for multi-fragment coordination
- No "generate entire domain" API in v1
- Each fragment has independent identity

---

### FDR-T003: Untrusted Proposer Principle

#### Decision

Any model output is a **proposal** only. Translator never applies, approves, or executes.

#### Context

LLMs are powerful but unreliable. Two trust models:

| Model | LLM Role |
|-------|----------|
| Trusted Agent | LLM output is applied directly |
| Untrusted Proposer | LLM proposes, Authority verifies |

#### Rationale

**Untrusted Proposer aligns with Manifesto philosophy:**

1. **Separation of concerns**: Proposer ≠ Approver ≠ Executor
2. **Auditability**: Every proposal has trace
3. **Governance**: Authority applies policy
4. **Safety**: Bad proposals are rejected, not executed

**Trusted Agent problems:**
- No governance checkpoint
- LLM errors become system errors
- No audit trail for rejections

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Trust high-confidence outputs | Confidence is not reliability |
| Trust after N successful runs | Gaming, distribution shift |

#### Consequences

- Translator returns proposals, never side-effects
- Authority is separate layer (World Protocol)
- Confidence is signal, not authorization

---

### FDR-T004: Ambiguity Return (Never Resolve)

#### Decision

Translator MUST NOT resolve ambiguity. It MUST return a structured AmbiguityReport.

#### Context

When input is ambiguous, two options:

| Option | Behavior |
|--------|----------|
| A: Best-effort | Pick most likely interpretation |
| B: Return ambiguity | Ask Actor to decide |

#### Rationale

**Returning ambiguity respects Actor autonomy:**

1. **No silent assumptions**: Actor knows there was uncertainty
2. **Explicit decision**: Choice is recorded in trace
3. **Better UX**: Actor can rephrase or clarify
4. **Governance-friendly**: Decision attribution is clear

**Best-effort problems:**
- Silent wrong interpretations
- No accountability for choice
- Hard to debug "why did it do X?"

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Best-effort with confidence | Actor may not see low confidence |
| Ask for clarification inline | Breaks stateless API |
| Return both interpretations as fragments | Which one applies? |

#### Consequences

- AmbiguityReport is first-class result type
- resolve() API exists for continuation
- Trace records resolution decision

---

## Data Model Decisions

### FDR-T005: ExprNode for Expressions, JsonValue for Literals

#### Decision

- **Computed expressions** (constraints, computed, availability): `ExprNode` (MEL call-only)
- **Default values**: `JsonValue` (static literal)

#### Context

All values could use ExprNode, or all could use JsonValue, or split by purpose.

| Option | constraint.rule | setDefaultValue.value |
|--------|-----------------|----------------------|
| All ExprNode | ExprNode | ExprNode |
| All JsonValue | JsonValue | JsonValue |
| Split by purpose | ExprNode | JsonValue |

#### Rationale

**Split by purpose is semantically correct:**

1. **Constraints need evaluation**: They reference `$state.*`, comparisons, etc.
2. **Defaults are static**: They are literal values, no runtime resolution
3. **Determinism**: Defaults MUST be deterministic; ExprNode allows non-determinism
4. **MEL alignment**: MEL state initializers are literals, not expressions

**All-ExprNode problems:**
- Temptation to use `$system.now()` in defaults (non-deterministic)
- Overcomplication for simple literals
- Validation burden

**All-JsonValue problems:**
- Can't express constraint logic
- Would need separate constraint type anyway

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| All ExprNode | Allows non-deterministic defaults |
| Subset ExprNode for defaults | Still too permissive |
| String DSL for constraints | Parsing burden, less type-safe |

#### Consequences

- setDefaultValue.value is JsonValue
- addConstraint.rule is ExprNode
- Clear validation: defaults can't reference state

---

### FDR-T006: PatchFragment as Minimal Semantic Unit

#### Decision

PatchFragment represents a **single semantic operation** with identity, confidence, and evidence.

#### Context

What granularity for change proposals?

| Granularity | Unit |
|-------------|------|
| Fine (field-level) | One field change per fragment |
| Medium (op-level) | One logical operation per fragment |
| Coarse (batch-level) | Multiple operations per fragment |

#### Rationale

**Op-level granularity balances:**

1. **Atomicity**: One operation = one decision
2. **Composability**: Combine fragments into programs
3. **Auditability**: Each op has its own trace
4. **Deduplication**: Content-addressed ID enables dedupe

**Fine-grained problems:**
- Too many fragments for simple changes
- Cross-field operations split unnaturally

**Coarse-grained problems:**
- Partial rejection is complex
- Identity is unclear

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Field-level fragments | Over-fragmentation |
| Batch fragments | Unclear identity, partial reject |
| Nested fragments | Complexity, ordering issues |

#### Consequences

- One PatchOp per PatchFragment
- fragmentId is content-addressed (op only)
- PatchProgram coordinates multiple fragments

---

### FDR-T007: v1 Operator Set is Monotonic (No Destructive Ops)

#### Decision

v1 operators are **additive/monotonic**: addType, addField, setFieldType, setDefaultValue, addConstraint.
No removeType, removeField, renameField, removeConstraint.

#### Context

Full schema evolution vs safe subset for v1.

| Approach | Operators |
|----------|-----------|
| Full evolution | add, remove, rename, migrate |
| Monotonic only | add, set (no remove/rename) |

#### Rationale

**Monotonic is safer for v1:**

1. **No orphan references**: Removing types can orphan fields
2. **No data loss**: Removing fields loses data
3. **No migration complexity**: Rename needs data migration
4. **Simpler validation**: Only check "does target exist?"

**Destructive ops require:**
- Orphan detection
- Migration planning
- Data preservation strategy
- Governance approval workflows

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Full operator set | Too risky for v1 |
| Soft-delete only | Still needs orphan handling |
| Rename as add+copy+deprecate | Possible in v2 |

#### Consequences

- v1 is safe for iterative building
- Destructive ops deferred to v2
- "removeField" expressed as deprecation pattern

---

## Pipeline Decisions

### FDR-T008: Six-Stage Pipeline with Clear Determinism Boundaries

#### Decision

Pipeline has 6 stages with explicit determinism requirements:
- Stages 0-2: MUST deterministic
- Stage 3: SHOULD deterministic (cache)
- Stages 4-5: MAY non-deterministic
- Stage 6: MUST deterministic

#### Context

How to structure the translation pipeline?

| Design | Stages | Determinism |
|--------|--------|-------------|
| Monolithic | 1 | Unclear |
| Two-phase | 2 (parse, generate) | Unclear |
| Multi-stage | 6 | Explicit per stage |

#### Rationale

**Multi-stage with explicit determinism enables:**

1. **Caching**: Deterministic stages can cache
2. **Debugging**: Trace shows exactly where non-determinism entered
3. **Testing**: Deterministic stages are unit-testable
4. **Optimization**: Each stage can be optimized independently

**Monolithic problems:**
- Can't cache intermediate results
- Hard to attribute non-determinism
- All-or-nothing testing

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Monolithic | No caching, poor debugging |
| Two-phase | Too coarse |
| Dynamic stages | Unpredictable trace structure |

#### Consequences

- TranslationTrace has stage-specific traces
- Fast-path can short-circuit to Stage 6
- Each stage has its own trace type

---

### FDR-T009: Fast Path with Candidates (Not Just Match/No-Match)

#### Decision

FastPathResult includes `candidates[]` array, not just boolean match.

```typescript
type FastPathResult = {
  matched: boolean;
  best: FastPathCandidate | null;
  candidates: FastPathCandidate[];
};
```

#### Context

Fast-path matching can have multiple outcomes:

| Outcome | Old Model | New Model |
|---------|-----------|-----------|
| No match | matched=false | candidates=[] |
| One match | matched=true | matched=true, candidates=[best] |
| Multiple low-confidence | ??? | matched=false, candidates=[...] |

#### Rationale

**Candidates array enables proper fastPathOnly handling:**

1. **Distinguish "no patterns" from "uncertain patterns"**
2. **fastPathOnly + candidates → intent ambiguity**
3. **fastPathOnly + no candidates → FAST_PATH_MISS error**

**Boolean-only problems:**
- Can't distinguish failure modes
- fastPathOnly always errors on non-match

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Boolean matched only | Can't distinguish failure modes |
| Separate error types | Complex, still loses candidates |
| Always proceed to proposer | Defeats purpose of fast-path only mode |

#### Consequences

- FastPathCandidate is structured type
- fastPathOnly mode has clear semantics
- Intent ambiguity can include pattern candidates

---

### FDR-T010: Fragment Ordering is Applicator Responsibility

#### Decision

Translator declares fragment order as **semantically insignificant**. Applicator (Host/Authority) performs topological ordering.

#### Context

Who decides fragment application order?

| Option | Responsibility |
|--------|---------------|
| Translator orders | Translator emits in dependency order |
| Applicator orders | Translator emits unordered, applicator sorts |

#### Rationale

**Applicator ordering is cleaner because:**

1. **Translator is frontend**: Ordering is execution concern
2. **Deduplication**: Order-independent IDs enable dedupe
3. **Merge**: Multiple proposals can be merged then ordered
4. **Single responsibility**: Applicator already knows schema

**Translator ordering problems:**
- Duplicates ordering logic
- Merge becomes complex
- Different orderings for same semantic content

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Translator topological sort | Duplicates applicator logic |
| Explicit order field | Extra complexity, sync burden |
| Reject unordered batches | Too strict |

#### Consequences

- TranslationResult.fragments order is irrelevant
- PatchProgram.dependencies is optional DAG
- Applicator MUST implement topo-sort

---

## Identity & Determinism Decisions

### FDR-T011: Content-Addressed fragmentId (No Ordinal)

#### Decision

`fragmentId = sha256(intentId + ':' + canonicalize(op))`

No ordinal or sequence number in ID.

#### Context

How to generate fragment identity?

| Approach | Formula |
|----------|---------|
| Sequential | intentId + ordinal |
| Content-addressed | intentId + hash(op) |
| Hybrid | intentId + ordinal + hash(op) |

#### Rationale

**Content-addressed IDs enable:**

1. **Deduplication**: Same op = same ID, automatic dedupe
2. **Order independence**: Proposer output order doesn't matter
3. **Cache stability**: Same op cached regardless of batch
4. **Diff stability**: Same semantic content = same ID

**Ordinal problems:**
- Different order = different IDs for same ops
- Proposer output order affects identity
- Cache misses on reordering

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Sequential IDs | Order-dependent, cache-unfriendly |
| UUID | No deduplication |
| Hybrid with ordinal | Ordinal makes ID order-dependent |

#### Consequences

- Same op in different batches has same fragmentId
- Deduplication is simple set membership
- Proposer can output in any order

---

### FDR-T012: RFC 8785 (JCS) for Canonical JSON

#### Decision

All JSON serialization for hashing MUST follow RFC 8785 (JSON Canonicalization Scheme).

#### Context

JSON serialization is not deterministic by default:
- Object key order varies
- Number formatting varies
- Whitespace varies

#### Rationale

**RFC 8785 is the standard solution:**

1. **Well-specified**: No ambiguity in implementation
2. **Library support**: Implementations exist
3. **Interoperable**: Cross-language consistency
4. **Complete**: Handles edge cases (numbers, escaping)

**Ad-hoc canonicalization problems:**
- Edge cases (NaN, Infinity, Unicode)
- Implementation drift
- No external validation

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Custom sort + stringify | Edge cases, no standard |
| Stable stringify libraries | Not standardized |
| Binary format (CBOR) | Overkill, less tooling |

#### Consequences

- Implementations SHOULD use RFC 8785 library
- NaN/Infinity are reject (not valid JSON)
- Cross-implementation hashes match

---

### FDR-T013: Semantic Collection Ordering Before Hashing

#### Decision

Semantically unordered collections (union.members, object.fields) MUST be sorted before canonicalization.

#### Context

Some MEL constructs have collections where order doesn't affect semantics:
- `union { "a" | "b" }` = `union { "b" | "a" }`
- `object { x: number, y: string }` = `object { y: string, x: number }`

#### Rationale

**Sorting ensures semantic equivalence = hash equivalence:**

1. **Dedup correctness**: Semantically equal ops dedupe correctly
2. **Cache hits**: Reordered but equal ops hit cache
3. **Diff stability**: Trivial reorderings don't show as changes

**Without sorting:**
- Same type, different member order = different hash
- False cache misses
- Noisy diffs

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Preserve order, accept hash variance | Defeats content-addressing |
| Normalize at parse time only | Misses runtime-constructed types |
| Hash sets instead of arrays | Complex, non-standard |

#### Consequences

- canonicalizeTypeExpr() sorts members/fields
- Hash is truly content-addressed
- Implementation must sort before hash

---

## Memory Integration Decisions

### FDR-T014: Memory as Evidence, Not Truth

#### Decision

Translator treats memory as **evidence** (candidates + selection + trace), never as **truth**.

#### Context

Memory provides context from past Worlds. How to treat it?

| Trust Level | Behavior |
|-------------|----------|
| Truth | Use memory content directly |
| Evidence | Use memory as input, verify separately |

#### Rationale

**Evidence model aligns with Manifesto philosophy:**

1. **Authority verifies**: verifyProof() checks evidence
2. **Trace records**: Selection is auditable
3. **Confidence signals**: Low confidence triggers policy ambiguity
4. **No silent assumptions**: Memory doesn't bypass governance

**Truth model problems:**
- No verification checkpoint
- Memory errors become system errors
- No audit of memory usage

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Trust high-confidence memory | Confidence ≠ correctness |
| Skip memory, always fresh | Loses valuable context |
| Memory in proposer prompt only | Still needs verification |

#### Consequences

- INV-008: Memory ≠ Truth
- MemoryTrace attached to TranslationTrace
- Authority calls verifyProof(), not Store

---

### FDR-T015: Translator Returns Trace, Actor Attaches to Proposal

#### Decision

Translator returns `MemoryTrace` in `TranslationTrace`. Actor is responsible for attaching to Proposal.

#### Context

Who creates and attaches memory evidence to Proposal?

| Option | Creator | Attacher |
|--------|---------|----------|
| Translator creates Proposal | Translator | Translator |
| Translator returns trace | Translator | Actor |

#### Rationale

**Actor attachment respects boundaries:**

1. **Translator is frontend**: Doesn't create Proposals
2. **Actor has Proposal context**: Knows how to attach
3. **Separation of concerns**: Translator ≠ Proposal factory
4. **Flexibility**: Actor can modify before attach

**Translator-creates-Proposal problems:**
- Translator becomes too coupled to World Protocol
- Actor loses control over Proposal construction
- Testing requires full Proposal infrastructure

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Translator creates Proposal | Coupling, boundary violation |
| Actor re-selects memory | Duplicates work, inconsistency risk |
| No trace, Actor fetches | Loses selection context |

#### Consequences

- TranslationTrace.stages.memory.trace exists
- Actor calls MemoryTraceUtils.attachToProposal()
- Clear responsibility chain

---

### FDR-T016: atWorldId is Required Context

#### Decision

`TranslationContext.atWorldId` is **REQUIRED**, not optional.

#### Context

Memory selection needs a World reference point. Should it be required or optional?

| Option | atWorldId |
|--------|-----------|
| Required | MUST provide |
| Optional | Defaults to "latest" or null |

#### Rationale

**Required atWorldId ensures:**

1. **Explicit anchoring**: No ambiguity about reference point
2. **Memory scoping**: Selection is scoped to World lineage
3. **Verification context**: Authority knows what was anchored
4. **Reproducibility**: Same atWorldId = same memory scope

**Optional problems:**
- "Latest" is non-deterministic
- Null disables memory silently
- Ambiguous in multi-World scenarios

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Default to latest | Non-deterministic |
| Optional with null | Silent memory disable |
| Derive from schema | Schema doesn't have World |

#### Consequences

- TranslationContext.atWorldId is required field
- Memory selection always has anchor
- INVALID_CONTEXT if atWorldId missing

---

## Ambiguity & Resolution Decisions

### FDR-T017: Candidates >= 2 Invariant for All Ambiguity

#### Decision

All AmbiguityReports MUST have `candidates.length >= 2`.

#### Context

Ambiguity with one candidate is not really ambiguity.

| candidates.length | Meaning |
|-------------------|---------|
| 0 | Error (no options) |
| 1 | Not ambiguity (one option) |
| >= 2 | True ambiguity (choice needed) |

#### Rationale

**Invariant ensures meaningful choice:**

1. **UX clarity**: Actor always has options
2. **Cancel option**: Even low-confidence has apply/cancel
3. **No degenerate cases**: One option = just return it
4. **Consistent resolve()**: Always choosing between options

**Single candidate problems:**
- Why ask Actor if only one option?
- resolve() is meaningless
- UX confusion

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Allow 1 candidate | Meaningless ambiguity |
| Allow 0 candidates | That's an error |
| Flexible count | Inconsistent resolve() |

#### Consequences

- policy ambiguity always has apply + cancel
- intent ambiguity includes candidates + cancel
- resolve() always has meaningful choice

---

### FDR-T018: opt-cancel is Universal (All Ambiguity Kinds)

#### Decision

`opt-cancel` option is valid for **all ambiguity kinds**, not just policy.

#### Context

Should cancel/no-op be available in all ambiguity types?

| Ambiguity Kind | opt-cancel? |
|----------------|-------------|
| policy | Always |
| intent | ? |
| target/value/conflict | ? |

#### Rationale

**Universal cancel provides safe exit:**

1. **Actor autonomy**: Always can say "no"
2. **Rephrase opportunity**: Cancel and retry with better input
3. **Consistent UX**: Same pattern across ambiguity types
4. **No forced choice**: Actor isn't trapped

**Kind-specific cancel problems:**
- Inconsistent UX
- Some ambiguities have no exit
- Complex rules for when cancel exists

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| policy-only cancel | Inconsistent, traps Actor |
| No cancel, must choose | No safe exit |
| Cancel with penalty | Overcomplicates |

#### Consequences

- opt-cancel allowed in any ambiguity
- resolve() with opt-cancel = fragments: []
- No-op result is valid from any ambiguity

---

### FDR-T019: resolve() is Stateless

#### Decision

`resolve()` accepts `(report, resolution, context)`. Translator is stateless.

```typescript
function resolve(
  report: AmbiguityReport,
  resolution: AmbiguityResolution,
  context: TranslationContext
): Promise<TranslationResult>;
```

#### Context

How to handle ambiguity resolution?

| Design | State |
|--------|-------|
| Stateful session | Translator stores pending reports |
| Stateless | Caller provides report + resolution |

#### Rationale

**Stateless design enables:**

1. **Horizontal scaling**: No shared state between instances
2. **Restart resilience**: No session loss on restart
3. **Explicit data flow**: All inputs visible
4. **Simpler testing**: No session setup

**Stateful problems:**
- Session management complexity
- Scaling requires session affinity
- Restart loses pending reports
- TTL/eviction policies needed

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Session-based | Scaling, restart, complexity |
| reportId lookup | Still needs storage |
| Combined translate+resolve | Breaks separation |

#### Consequences

- Caller stores AmbiguityReport
- resolve() is pure function (mostly)
- Context must match original translation

---

## Configuration Decisions

### FDR-T020: Two-Threshold Confidence Policy

#### Decision

Confidence policy uses two thresholds: `autoAcceptThreshold` and `rejectThreshold`.

```typescript
type ConfidencePolicy = {
  autoAcceptThreshold: number;  // >= this → fragment
  rejectThreshold: number;      // < this → error
  // between → policy ambiguity
};
```

#### Context

How many thresholds for confidence-based decisions?

| Design | Thresholds |
|--------|------------|
| Binary | 1 (accept/reject) |
| Ternary | 2 (accept/ambiguity/reject) |
| Multi-zone | 3+ |

#### Rationale

**Two thresholds with ambiguity middle zone:**

1. **High confidence (>= 0.95)**: Auto-accept, no friction
2. **Medium confidence**: Actor reviews via policy ambiguity
3. **Low confidence (< 0.30)**: Reject, don't waste Actor time

**Binary problems:**
- No middle ground for review
- Either too strict or too lenient

**Multi-zone problems:**
- Complex rules
- Unclear UX per zone

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Single threshold | No review zone |
| Three+ thresholds | Overcomplicated |
| Per-operation thresholds | Configuration explosion |

#### Consequences

- Simple mental model: auto/review/reject
- Policy ambiguity handles uncertain cases
- Thresholds are tunable per deployment

---

### FDR-T021: fastPathOnly Uses Same Threshold

#### Decision

Fast-path match threshold uses `confidencePolicy.autoAcceptThreshold`, not a separate config.

#### Context

Should fast-path have its own threshold?

| Design | Threshold |
|--------|-----------|
| Shared | Use confidencePolicy.autoAcceptThreshold |
| Separate | fastPathMatchThreshold |

#### Rationale

**Shared threshold simplifies v1:**

1. **One mental model**: High confidence = accept, everywhere
2. **Less config**: Fewer knobs to tune
3. **Consistency**: Same meaning across stages

**Separate threshold considerations:**
- Fast-path patterns might warrant different bar
- Can add in v1.1 if needed

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Separate threshold | Premature config complexity |
| Always accept fast-path | May accept low-confidence matches |
| Never use thresholds for fast-path | Defeats confidence filtering |

#### Consequences

- Single confidence threshold for v1
- MAY add fastPathMatchThreshold in future
- Simple configuration to start

---

## Summary Table

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| T001 | Frontend Only | No MEL generation, structured output |
| T002 | Incremental-First | Build via successive fragments |
| T003 | Untrusted Proposer | Proposals only, no execution |
| T004 | Ambiguity Return | Never resolve, return to Actor |
| T005 | ExprNode/JsonValue Split | Expressions vs literals |
| T006 | PatchFragment Unit | One op per fragment |
| T007 | Monotonic v1 Ops | No destructive operators |
| T008 | Six-Stage Pipeline | Explicit determinism boundaries |
| T009 | FastPath Candidates | Distinguish failure modes |
| T010 | Applicator Orders | Translator doesn't order |
| T011 | Content-Addressed ID | No ordinal in fragmentId |
| T012 | RFC 8785 (JCS) | Standard canonical JSON |
| T013 | Collection Ordering | Sort before hash |
| T014 | Memory as Evidence | Not truth |
| T015 | Actor Attaches Trace | Translator returns, Actor attaches |
| T016 | atWorldId Required | Explicit anchoring |
| T017 | Candidates >= 2 | Always meaningful choice |
| T018 | Universal opt-cancel | Safe exit from any ambiguity |
| T019 | Stateless resolve() | No session state |
| T020 | Two-Threshold Policy | Auto/review/reject zones |
| T021 | Shared Threshold | Simple v1 config |
| **T022** | **World as Source of Truth** | **Context derived from World** |
| **T023** | **Human Escalation** | **Agents must not auto-resolve** |
| **T024** | **Actor Creates Proposal** | **Fragment → Proposal by Actor** |
| **T025** | **TypeIndex Derived** | **Derived from schema, not provided** |

---

## Cross-Reference: Related FDRs

### From MEL Compiler FDR

| MEL FDR | Relevance |
|---------|-----------|
| FDR-MEL-040 (Call-only IR) | Translator targets this IR |
| FDR-MEL-024 (Canonical form) | Normalization before IR |

### From World Protocol FDR

| World FDR | Relevance |
|-----------|-----------|
| FDR-W001 (Intent-level governance) | Translator produces proposals |
| FDR-W002 (Proposal = Actor + Intent) | Actor wraps Translator output |

### From Memory FDR

| Memory FDR | Relevance |
|------------|-----------|
| M-1 (Memory is not truth) | Translator treats as evidence |
| M-4 (Authority does not re-select) | verifyProof only |

### From Host Contract FDR

| Host FDR | Relevance |
|----------|-----------|
| FDR-H003 (No pause/resume) | Ambiguity returns, doesn't pause |
| FDR-H006 (Intent identity) | intentId in fragmentId |

### From Builder FDR

| Builder FDR | Relevance |
|-------------|-----------|
| FDR-B007 (Zod-first typing) | Schema structure |
| FDR-B001 (No string paths) | SemanticPath type |

---

## Manifesto Ecosystem Integration Decisions

### FDR-T022: World as Single Source of Truth for Context

#### Decision

TranslationContext MUST be derived from World. Independent construction is a spec violation.

#### Context

How should Translator get schema and type information?

| Option | Source |
|--------|--------|
| A: Independent | Caller provides schema/typeIndex directly |
| B: World-derived | Caller provides worldId, Translator derives rest |
| C: Hybrid | Caller provides worldId, context is derived |

#### Rationale

**World-derived context ensures:**

1. **Consistency**: Schema matches World's current state
2. **Verifiability**: Authority can verify context against World
3. **Single source of truth**: No divergence between World and context
4. **Audit trail**: Context is traceable to specific World

**Independent construction problems:**
- Schema may be stale
- TypeIndex may not match schema
- Authority cannot verify context origin
- Changes may conflict with current World state

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Trust caller-provided context | No verification possible |
| Validate independently | Expensive, may still miss drift |
| Ignore World, just use schema | Loses governance integration |

#### Consequences

- Context includes `atWorldId` as primary field
- Schema and typeIndex derived from World
- `INVALID_CONTEXT` error if inconsistent

---

### FDR-T023: Human Escalation for Ambiguity

#### Decision

AmbiguityReport MUST be escalated to Human. Agents MUST NOT auto-resolve.

#### Context

When Translator returns ambiguity, who decides?

| Option | Resolver |
|--------|----------|
| A: Human always | Escalate to Human via UI |
| B: Agent decides | LLM picks best candidate |
| C: Policy-based | Rules decide when to escalate |

#### Rationale

**Human escalation respects Actor autonomy:**

1. **Explicit decision**: Human makes the choice
2. **Audit trail**: `resolvedBy` records Human actor
3. **No silent assumptions**: Agent doesn't guess intent
4. **UX clarity**: Human sees all options including cancel

**Agent auto-resolve problems:**
- Compounds uncertainty (LLM choosing between LLM outputs)
- No accountability for choice
- Human may not know choice was made
- Violates INV-004 (Ambiguity Return principle)

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Agent picks highest confidence | Still uncertain, no accountability |
| Only escalate low confidence | Confidence ≠ correctness |
| Auto-resolve if unambiguous | Defeats purpose of ambiguity type |

#### Consequences

- ESC-001: Agents MUST NOT auto-resolve
- UI MUST show all candidates
- Resolution includes Human actor reference

---

### FDR-T024: Fragment → Proposal Conversion by Actor

#### Decision

Actor (not Translator) converts fragments to World Protocol Proposal.

#### Context

Who creates the Proposal for World Protocol?

| Option | Creator |
|--------|---------|
| A: Translator | Returns Proposal directly |
| B: Actor | Wraps fragments in Proposal |

#### Rationale

**Actor creates Proposal because:**

1. **Separation of concerns**: Translator is frontend, not governance layer
2. **Actor context**: Actor has identity, session, preferences
3. **Flexibility**: Actor can modify before submission
4. **World Protocol alignment**: Proposal.actor must be the Actor

**Translator-creates-Proposal problems:**
- Translator would need Actor context
- Couples Translator to World Protocol internals
- Less flexibility for Actor

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Translator creates Proposal | Coupling, boundary violation |
| Shared creation | Unclear responsibility |

#### Consequences

- Translator returns fragments + trace
- Actor wraps in IntentInstance → Proposal
- Actor submits to Authority

---

### FDR-T025: TypeIndex Derived, Not Provided

#### Decision

TypeIndex MUST be derived from Schema via `deriveTypeIndex()`. Independent provision is error.

#### Context

Should typeIndex be provided or derived?

| Option | Source |
|--------|--------|
| A: Provided | Caller passes typeIndex |
| B: Derived | Translator derives from schema |
| C: Hybrid | Either, with validation |

#### Rationale

**Derivation ensures consistency:**

1. **No drift**: TypeIndex always matches schema
2. **Single algorithm**: `deriveTypeIndex()` is canonical
3. **Less error-prone**: Caller can't provide wrong index
4. **Verifiable**: Can always re-derive and compare

**Provided typeIndex problems:**
- May be stale
- May be incorrectly computed
- Different implementations may differ
- Inconsistency with schema

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Trust caller | Inconsistency risk |
| Accept but validate | Still allows inconsistency |
| Cache independently | Drift risk |

#### Consequences

- `deriveTypeIndex(schema)` is normative algorithm
- TypeIndex is NOT a context input
- Validation rejects inconsistent context

---

*End of Foundational Design Rationale v1.0*
