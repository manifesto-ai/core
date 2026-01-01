# FDR — `@manifesto-ai/translator` (v2.0)

> **Status:** Normative (Foundational)
> **Version:** 2.0.0
> **Supersedes:** FDR v1.0, v1.1 Addendum
> **Depends On:** MEL SPEC v0.3.3, Manifesto World Protocol, Manifesto Lab Protocol
> **Purpose:** Record *why* Translator is a Manifesto Domain, not a TypeScript package

---

## Executive Summary

Translator v2.0 makes a **constitutional pivot**:

| v1.x | v2.0 |
|------|------|
| TypeScript package | **Manifesto Domain** |
| Direct SLM client | **Host Effect** |
| Internal state management | **World Snapshot** |
| Custom trace format | **TraceSpec (Lab optional)** |
| Standalone utility | **Dogfooding proof** |
| External resolution system | **Standard Bridge pattern** |

This is not a refactoring. This is a **philosophical realignment** with Manifesto's core principle:

> **"AI must query facts, not infer them."**

If Translator doesn't use Manifesto, we're saying Manifesto isn't good enough for real systems. If Translator does use Manifesto, we prove it works.

**Key architectural decisions (v2.0 final):**

| Decision | Rationale |
|----------|-----------|
| **World only** | No forced Lab dependency |
| **Host provides LLM Effects** | `llm.normalize`, `llm.propose` |
| **Lab is optional** | Use for tracing/replay when needed |
| **Ambiguity in `proposal.ambiguity`** | No separate pending state |
| **Resolution via Bridge** | Standard subscribe → dispatch pattern |
| **Fallback behavior** | `guess` (highest confidence) or `discard` |

**Ambiguity resolution is mandatory.** When external resolution times out, domain policy determines fallback (guess or discard).

---

## Table of Contents

### Part 1: Core Philosophy
- [FDR-T001: Translator is a Manifesto Domain](#fdr-t001-translator-is-a-manifesto-domain)
- [FDR-T002: Dogfooding as Existence Proof](#fdr-t002-dogfooding-as-existence-proof)
- [FDR-T003: World-Centric State Management](#fdr-t003-world-centric-state-management)
- [FDR-T004: World Only + Ambiguity Resolution via Bridge](#fdr-t004-world-only--ambiguity-resolution-via-bridge)

### Part 2: Type System
- [FDR-T005: Types are First-Class Schema Objects](#fdr-t005-types-are-first-class-schema-objects)
- [FDR-T006: Dual View Requirement](#fdr-t006-dual-view-requirement)
- [FDR-T007: Type Changes as PatchFragments](#fdr-t007-type-changes-as-patchfragments)
- [FDR-T008: Deterministic Type Naming](#fdr-t008-deterministic-type-naming)
- [FDR-T009: Type-Guided Optimization](#fdr-t009-type-guided-optimization)

### Part 3: Pipeline Architecture
- [FDR-T010: Incremental Fragment Model](#fdr-t010-incremental-fragment-model)
- [FDR-T011: Normalization as First Stage](#fdr-t011-normalization-as-first-stage)
- [FDR-T012: Glossary as Semantic Mapping](#fdr-t012-glossary-as-semantic-mapping)
- [FDR-T013: Fast Path for Zero-LLM Cases](#fdr-t013-fast-path-for-zero-llm-cases)
- [FDR-T014: Tiered Retrieval Strategy](#fdr-t014-tiered-retrieval-strategy)
- [FDR-T015: Small-Model-First Proposal](#fdr-t015-small-model-first-proposal)

### Part 4: Governance & Output
- [FDR-T016: LLM as Untrusted Proposer](#fdr-t016-llm-as-untrusted-proposer)
- [FDR-T017: Ambiguity Returns to Actor](#fdr-t017-ambiguity-returns-to-actor)
- [FDR-T018: Authority Validates All Fragments](#fdr-t018-authority-validates-all-fragments)
- [FDR-T019: MEL Rendering is Separate Concern](#fdr-t019-mel-rendering-is-separate-concern)

### Part 5: Expression IR
- [FDR-T020: Canonical Expression IR](#fdr-t020-canonical-expression-ir)

### Part 6: Integration
- [FDR-T021: Host Effect Contract](#fdr-t021-host-effect-contract)
- [FDR-T022: OSS-Ready Baseline](#fdr-t022-oss-ready-baseline)

---

# Part 1: Core Philosophy

## FDR-T001: Translator is a Manifesto Domain

### Decision

Translator MUST be implemented as a **Manifesto Domain** defined in MEL, not as a standalone TypeScript package with imperative control flow.

```mel
import { Token, GlossaryHit } from "@manifesto/core"
import { PatchFragment, AmbiguityReport } from "@manifesto/translator-types"

domain Translator {
  // ═══════════════════════════════════════════════════════════
  // Named Types (v0.3.3: required for state object fields)
  // ═══════════════════════════════════════════════════════════
  
  type TranslationRequest = {
    input: string
    targetSchemaId: string
    intentId: string
  }
  
  type NormalizationResult = {
    canonical: string
    language: string
    tokens: Array<Token>
    glossaryHits: Array<GlossaryHit>
  }
  
  type FastPathResult = {
    matched: boolean
    pattern: string | null
    fragment: PatchFragment | null
  }
  
  type RetrievalResult = {
    tier: number
    candidates: Array<AnchorCandidate>
  }
  
  type ProposalResult = {
    fragment: PatchFragment | null
    ambiguity: AmbiguityReport | null
    confidence: number
  }
  
  type AnchorCandidate = {
    path: string
    score: number
    matchType: "exact" | "alias" | "fuzzy" | "semantic"
  }
  
  type TranslationResultFragment = {
    kind: "fragment"
    fragment: PatchFragment
  }
  
  type TranslationResultAmbiguity = {
    kind: "ambiguity"
    report: AmbiguityReport
  }
  
  // ═══════════════════════════════════════════════════════════
  // State (v0.3.3: named types only, no inline objects)
  // ═══════════════════════════════════════════════════════════
  
  state {
    // Current request
    request: TranslationRequest | null = null
    
    // Pipeline stages (null = not yet computed)
    normalization: NormalizationResult | null = null
    fastPath: FastPathResult | null = null
    retrieval: RetrievalResult | null = null
    proposal: ProposalResult | null = null
    
    // Final output
    result: TranslationResultFragment | TranslationResultAmbiguity | null = null
    
    // Intent markers (per-intent idempotency)
    initializing: string | null = null
    normalizing: string | null = null
    fastPathing: string | null = null
    retrieving: string | null = null
    proposing: string | null = null
    resetting: string | null = null
  }
  
  // ═══════════════════════════════════════════════════════════
  // Computed: Declarative facts about translation state
  // ═══════════════════════════════════════════════════════════
  
  computed hasRequest = isNotNull(request)
  computed isNormalized = isNotNull(normalization)
  computed fastPathSucceeded = and(isNotNull(fastPath), fastPath.matched)
  computed needsSlm = and(isNotNull(fastPath), not(fastPath.matched))
  computed isComplete = isNotNull(result)
  
  computed currentStage = cond(
    not(hasRequest), "idle",
    cond(isNull(normalization), "normalizing",
    cond(isNull(fastPath), "fast-path",
    cond(and(needsSlm, isNull(retrieval)), "retrieving",
    cond(and(needsSlm, isNull(proposal)), "proposing",
    "complete")))))
  
  // ═══════════════════════════════════════════════════════════
  // Actions (v0.3.3: all patch/effect MUST be inside guards)
  // ═══════════════════════════════════════════════════════════
  
  action translate(input: string, schemaId: string) 
    available when not(hasRequest) {
    
    // Stage 0: Initialize request (guarded, sets up for next cycle)
    once(initializing) {
      patch initializing = $meta.intentId
      patch request = { 
        input: input, 
        targetSchemaId: schemaId, 
        intentId: $meta.intentId 
      }
    }
    
    // Stage 1: Normalize (waits for request to be set - next cycle)
    once(normalizing) when hasRequest {
      patch normalizing = $meta.intentId
      effect llm.normalize({
        protocol: "translator.normalize",
        input: { text: request.input },
        into: normalization
      })
    }
    
    // Stage 2: Fast Path (deterministic, no LLM)
    once(fastPathing) when isNormalized {
      patch fastPathing = $meta.intentId
      effect translator.fastPath({
        canonical: normalization.canonical,
        schemaId: request.targetSchemaId,
        into: fastPath
      })
    }
    
    // Stage 3a: Fast path succeeded → finalize (one-time guard)
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
        schemaId: request.targetSchemaId,
        into: retrieval
      })
    }
    
    // Stage 4: SLM proposal
    once(proposing) when isNotNull(retrieval) {
      patch proposing = $meta.intentId
      effect llm.propose({
        protocol: "translator.propose",
        input: {
          canonical: normalization.canonical,
          candidates: retrieval.candidates,
          schemaId: request.targetSchemaId
        },
        into: proposal
      })
    }
    
    // Stage 5: Finalize from proposal (one-time guard)
    when and(isNull(result), isNotNull(proposal)) {
      patch result = cond(
        isNotNull(proposal.fragment),
        { kind: "fragment", fragment: proposal.fragment },
        { kind: "ambiguity", report: proposal.ambiguity }
      )
    }
  }
  
  action reset()
    available when isComplete {
    // All patches inside guard (v0.3.3 requirement)
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
    }
  }
}
```

### Context

v1.x designed Translator as:
```typescript
// v1.x: Imperative TypeScript
class Translator {
  private slm: SLMClient;
  private retrieval: RetrievalProvider;

  async translate(input: string): Promise<TranslationResult> {
    const normalized = await this.normalize(input);
    const fastPathResult = this.fastPath.parse(normalized);
    if (fastPathResult) return fastPathResult;
    // ... imperative control flow
  }
}
```

This contradicts Manifesto's core philosophy:
- State is hidden inside class
- Control flow is imperative
- LLM calls bypass governance
- Trace is ad-hoc

### Rationale

**Manifesto's thesis:** Complex systems are better expressed as declarative state machines with explicit effects than as imperative code with hidden state.

If this thesis is true, Translator should be expressible as a Manifesto Domain.
If Translator can't be expressed this way, Manifesto's thesis is false.

**Therefore:** Translator as Manifesto Domain is an existence proof.

```
Translator works as Manifesto Domain
  → Manifesto can express complex LLM pipelines
    → Manifesto is viable for real-world AI systems
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| TypeScript package with internal state | Contradicts World-Centric philosophy |
| Hybrid (Domain + TypeScript helpers) | Scope creep, unclear boundaries |
| Pure functions (stateless) | Translation is inherently stateful (multi-step pipeline) |

### Consequences

1. All Translator state lives in Snapshot
2. All LLM calls go through Lab Protocol
3. All state transitions are explicit Effects
4. Full auditability via TraceSpec
5. **Manifesto validates itself**

---

## FDR-T002: Dogfooding as Existence Proof

### Decision

Translator MUST serve as **dogfooding** — Manifesto building itself with itself.

### Context

Many frameworks claim capabilities they don't use themselves:
- "Scalable" frameworks with non-scalable docs sites
- "Type-safe" libraries with `any` in core code
- "AI-native" tools built with imperative Python

This creates credibility gap.

### Rationale

**Dogfooding proves:**

| Claim | Proof via Translator |
|-------|---------------------|
| "MEL can express complex logic" | Translation pipeline in MEL |
| "World manages state correctly" | Translator state in Snapshot |
| "Lab governs LLM calls" | All proposals via Lab Protocol |
| "TraceSpec enables debugging" | Full translation trace |
| "Effects are composable" | Multi-stage pipeline |

**Dogfooding exposes:**

- Pain points in MEL syntax
- Missing Effect types
- Awkward patterns
- Performance issues

These discoveries improve Manifesto itself.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Separate "reference implementation" | Doesn't prove production viability |
| "Manifesto is for simple domains" | Self-limiting, defeats purpose |
| External validation only | No skin in the game |

### Consequences

1. Translator is first-class Manifesto citizen
2. MEL must be expressive enough for Translator
3. Pain points in Translator drive Manifesto improvements
4. Success = "Manifesto can build Manifesto"

---

## FDR-T003: World-Centric State Management

### Decision

All Translator state MUST be managed through **World Protocol** (Snapshot-based state).

```
┌─────────────────────────────────────────────────────────────────┐
│                         WORLD                                   │
│                                                                 │
│  Snapshot {                                                     │
│    translator: {                                                │
│      request: TranslationRequest | null                         │
│      normalization: NormalizationResult | null                  │
│      fastPath: FastPathResult | null                            │
│      retrieval: RetrievalResult | null                          │
│      proposal: ProposalResult | null                            │
│      result: TranslationResult | null                           │
│    }                                                            │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ compute(snapshot, intent)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSLATOR DOMAIN                            │
│                                                                 │
│  Pure computation over Snapshot                                 │
│  Returns Effects (requirements for Host)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Effects
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          HOST                                   │
│                                                                 │
│  Executes Effects (Lab calls, retrieval, etc.)                  │
│  Patches results back to Snapshot                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Context

v1.x state was implicit:
```typescript
// v1.x: Hidden state
class Translator {
  private pendingNormalization?: Promise<NormalizationResult>;
  private cachedCandidates: Map<string, AnchorCandidate[]>;
  // ... state scattered across instance
}
```

Problems:
- State invisible to debugger
- No replay capability
- Race conditions possible
- Testing requires mocking

### Rationale

**World Protocol guarantees:**

| Guarantee | How Achieved |
|-----------|--------------|
| **Visibility** | All state in Snapshot (inspectable) |
| **Determinism** | Same Snapshot + Intent → Same output |
| **Replay** | Save Snapshot, replay from any point |
| **Testability** | Provide Snapshot, assert on Effects |
| **Auditability** | Every change traced |

**Translation pipeline maps naturally to Snapshot:**

```typescript
type TranslatorSnapshot = {
  // Input
  request: TranslationRequest | null;

  // Pipeline stages (each nullable = "not yet computed")
  normalization: NormalizationResult | null;
  fastPath: FastPathResult | null;
  retrieval: RetrievalResult | null;
  proposal: ProposalResult | null;

  // Output
  result: TranslationResult | null;

  // Intent markers (per-intent idempotency)
  normalizing: string | null;
  fastPathing: string | null;
  retrieving: string | null;
  proposing: string | null;
};
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Hybrid state (some in World, some local) | Defeats visibility guarantee |
| Ephemeral state for intermediate stages | Breaks replay |
| Event sourcing without Snapshot | More complex, same benefits |

### Consequences

1. Pipeline progress visible in Snapshot
2. Any stage can be inspected/replayed
3. Host loop drives pipeline forward
4. No hidden state, no race conditions

---

## FDR-T004: World Only + Ambiguity Resolution via Bridge

### Decision

Translator uses **World only** (no Lab dependency). Ambiguity resolution is **standard Manifesto pattern**: state → subscribe → dispatch Intent.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Translator Domain                          │
│                                                                 │
│  state {                                                        │
│    proposal: ProposalResult | null   // includes ambiguity      │
│  }                                                              │
│                                                                 │
│  computed needsResolution = and(                                │
│    isNotNull(proposal),                                         │
│    isNotNull(proposal.ambiguity)                                │
│  )                                                              │
│                                                                 │
│  action resolve(selection: ResolutionSelection) { ... }         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                        Snapshot changes
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Bridge                                 │
│                                                                 │
│  bridge.subscribe((snapshot) => {                               │
│    if (snapshot.computed.needsResolution) {                     │
│      // Present ambiguity to consumer                           │
│    }                                                            │
│  })                                                             │
│                                                                 │
│  bridge.dispatch({                                              │
│    type: "translator.resolve",                                  │
│    input: { selectedOptionId: "opt-1" }                         │
│  })                                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**No special system. Just standard Manifesto: State → Subscribe → Intent.**

### Context

Initial v2.0 drafts introduced "HITL" as a separate concept with:
- Special `HITLRequest` / `HITLResponse` types
- Special `hitlPending` state
- Special adapter interface

But this is just the standard Manifesto pattern:
- State has data (proposal with ambiguity)
- Bridge subscriber observes state
- External consumer dispatches Intent to resolve

### Rationale

**Ambiguity is already in ProposalResult:**

```mel
type ProposalResult = {
  fragment: PatchFragment | null
  ambiguity: AmbiguityReport | null   // ← Already here
  confidence: number
}

type AmbiguityReport = {
  kind: "anchor" | "intent" | "value" | "conflict"
  question: string
  options: Array<ResolutionOption>
  fallbackBehavior: "guess" | "discard"
  expiresAt: number | null
}

type ResolutionOption = {
  id: string
  label: string
  fragment: PatchFragment
  confidence: number
}
```

**No separate "pending" state needed:**

```mel
state {
  proposal: ProposalResult | null = null
  result: TranslationResult | null = null
}

// Ambiguity detection is computed
computed needsResolution = and(
  isNotNull(proposal),
  isNotNull(proposal.ambiguity),
  isNull(result)
)

// Resolution action
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
  }
}

// Timeout fallback (computed + when)
computed resolutionExpired = and(
  needsResolution,
  isNotNull(proposal.ambiguity.expiresAt),
  gte($meta.timestamp, proposal.ambiguity.expiresAt)
)

when resolutionExpired {
  patch result = cond(
    eq(proposal.ambiguity.fallbackBehavior, "guess"),
    { kind: "fragment", fragment: proposal.ambiguity.options[0].fragment },
    { kind: "discarded", reason: "timeout" }
  )
}
```

**Bridge integration (standard pattern):**

```typescript
// React
function TranslatorUI() {
  const snapshot = useSnapshot();
  const dispatch = useDispatch();

  if (snapshot.computed.needsResolution) {
    const { ambiguity } = snapshot.data.proposal;

    return (
      <ResolutionDialog
        question={ambiguity.question}
    options={ambiguity.options}
    onSelect={(optionId) => dispatch({
      type: "translator.resolve",
      input: { decision: "select", optionId }
    })}
    onDiscard={() => dispatch({
      type: "translator.resolve",
      input: { decision: "discard" }
    })}
    />
  );
  }

  // Normal UI...
}

// CLI
bridge.subscribe((snapshot) => {
  if (snapshot.computed.needsResolution) {
    const { ambiguity } = snapshot.data.proposal;
    console.log(`\n${ambiguity.question}`);
    ambiguity.options.forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt.label}`);
    });

    const choice = await prompt("Select: ");
    bridge.dispatch({
      type: "translator.resolve",
      input: { decision: "select", optionId: ambiguity.options[parseInt(choice) - 1].id }
    });
  }
});

// AI agent
bridge.subscribe(async (snapshot) => {
  if (snapshot.computed.needsResolution) {
    const { ambiguity } = snapshot.data.proposal;
    const aiChoice = await agent.selectOption(ambiguity);

    bridge.dispatch({
      type: "translator.resolve",
      input: { decision: "select", optionId: aiChoice.id }
    });
  }
});
```

**Resolution triggers (mandatory):**

| Condition | AmbiguityReport.kind | Fallback |
|-----------|----------------------|----------|
| Multiple anchors with similar score | `anchor` | guess (highest confidence) |
| Ambiguous intent | `intent` | guess |
| Unclear value | `value` | guess |
| Conflicts with existing | `conflict` | **discard only** |

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Separate "HITL" system | Just standard Manifesto pattern |
| `hitlPending` state | `proposal.ambiguity` already has this |
| Special adapter interface | Bridge subscriber is the interface |
| Effect for resolution | Intent is the standard mechanism |

### Consequences

1. **No special resolution system** — just State + Computed + Action
2. **Standard Bridge pattern** — subscribe, dispatch
3. **Framework-agnostic** — React, CLI, API, AI all use same pattern
4. **Timeout via computed** — `resolutionExpired` triggers fallback
5. **Lab optional** — only for tracing/replay

---

# Part 2: Type System

## FDR-T005: Types are First-Class Schema Objects

### Decision

Translator MUST treat **type metadata as first-class**, structured schema artifacts, not as generated MEL text or inferred structures.

The schema MUST include:
- `types`: A table of **named type declarations** (TypeDecl → TypeExpr AST)
- State/action/computed references that use **TypeRef** (named references, primitives, unions, Record/Array)
- No reliance on anonymous inline object types in state (aligned with MEL v0.3.3)

### Context

In multilingual NL workflows, LLM "understanding" of structure is unreliable and expensive. Translator needs stable anchors for:
- "Add zip code to Address"
- "Make signup require age >= 18"
- "Rename field X"

These operations require type structure to be queryable.

### Rationale

**Manifesto's core philosophy:**

> **"AI must query facts, not infer them."**

Therefore type information must be:
- **Explicit**: Declared, not inferred
- **Inspectable**: Queryable at any time
- **Addressable**: By semantic path
- **Stable**: Across incremental edits

**MEL v0.3.3 enforces this:**

```mel
// ❌ FORBIDDEN in MEL v0.3.3
state {
  tracking: { shipments: Record<string, Shipment> } = { ... }
}

// ✅ REQUIRED: Named type reference
type Tracking = { shipments: Record<string, Shipment> }
state {
  tracking: Tracking = { shipments: {} }
}
```

This is not just style — it's **constitutional**.

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Types inferred from values/defaults | Inference is brittle and not auditable |
| Types stored only as MEL text | Forces parsing to answer simple questions |
| Anonymous object types in state | Removes referable domain concepts |

### Consequences

1. Translator can propose structural changes with minimal context
2. Anchors become stable: edits attach to `type Address`, not ephemeral shapes
3. Small models can operate with short prompts ("field list + type table")
4. Type information is AI-queryable

---

## FDR-T006: Dual View Requirement

### Decision

The schema MUST provide two complementary representations of types:

**1. Decl View (Source of Concept)**
```typescript
types: Record<TypeName, TypeExpr>
```
Preserves author intent and domain vocabulary.

**2. Resolved View (AI & Runtime Lookup)**
```typescript
typeIndex: Record<SemanticPath, ResolvedType>
```
Provides direct lookup of the fully-resolved type at any schema path.

### Context

Even with first-class type declarations, an AI agent repeatedly resolving unions, nested type refs, record key/value, and nullable branches is slow, error-prone, and increases token cost.

### Rationale

The resolved view is a **deterministic projection** (cache) of the decl view.

It mirrors Manifesto's broader pattern:
- Canonical truth exists (decl)
- Projections exist for performance and usability (resolved)

**This enables:**
- Fast anchor scoring ("this field is number, so comparator constraints apply")
- Fast validation of fragment proposals
- Better ambiguity reports (show types to the actor)

**TypeExpr AST (aligned with MEL v0.3.3):**

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

**ResolvedType:**

```typescript
interface ResolvedType {
  readonly resolved: TypeExpr;        // Refs expanded
  readonly sourceName?: string;       // Original named type
  readonly nullable: boolean;         // Union with null?
  readonly baseKind: 'string' | 'number' | 'boolean' | 'null' 
                   | 'array' | 'record' | 'object' | 'union';
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Decl-only types | Pushes repeated resolution to every caller |
| Resolved-only index | Loses conceptual grouping and author vocabulary |

### Consequences

1. Translator can remain small-model-first and deterministic
2. Schema becomes AI-usable by *lookup*
3. Structural validation becomes cheap and local

---

## FDR-T007: Type Changes as PatchFragments

### Decision

Translator proposes type changes only as structured PatchFragments:

```typescript
type FragmentChange =
  // ... existing changes
  | FragmentAddType
  | FragmentSetFieldType

interface FragmentAddType {
  readonly kind: 'addType';
  readonly name: string;
  readonly typeExpr: TypeExpr;
  readonly description?: string;
}

interface FragmentSetFieldType {
  readonly kind: 'setFieldType';
  readonly path: SemanticPath;
  readonly typeExpr: TypeExpr;
  readonly migrateValue?: ExprNode;
}
```

MEL text generation is performed by a **deterministic renderer** over the schema.

### Context

Generating MEL text directly couples Translator to syntax details and introduces hallucination risk.

### Rationale

Keeping MEL rendering separate preserves:
- **Spec-light translator**: Doesn't need to know MEL syntax details
- **Deterministic output**: Same fragment → same MEL
- **Stable diffs**: PR reviews show structural changes, not text diffs

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Translator writes `.mel` directly | Violates "LLM as proposer" principle |
| Translator uses template strings | Brittle, syntax errors possible |

### Consequences

1. Translator is robust to future MEL syntax changes
2. Renderer becomes the single formatting authority
3. PatchFragments remain the governance unit of change

---

## FDR-T008: Deterministic Type Naming

### Decision

When Translator (or downstream tooling) must introduce new named types, naming and deduplication MUST be deterministic:

1. Name generation rules are explicit
2. Collisions handled deterministically
3. Identical shapes MAY be deduplicated by deterministic hashing rules

**LLM output MUST NOT be trusted for naming stability.**

### Context

MEL v0.3.3's "named types only" principle introduces frequent naming needs. Leaving naming to SLM introduces drift and churn.

### Rationale

Type names are schema anchors. Anchors must be stable.

**Naming rules (examples):**

```typescript
// Rule 1: Path-based for extracted inline types
// { user: { address: { city: string } } }
// → type User_Address = { city: string }

// Rule 2: Content-hash for anonymous types
// { a: number, b: string }
// → type T_<hash> where hash = sha256(canonical(type))

// Rule 3: LLM-suggested name as hint only
// LLM suggests "AddressInfo"
// → Accepted if no collision, otherwise fallback to Rule 1/2
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| LLM-invented names as canonical | Unstable across runs, languages, models |
| User-provided names only | Doesn't scale for automatic type extraction |
| No naming rules (ad-hoc) | Drift and churn in schema |

### Consequences

1. Stable diffs, less churn
2. Better multi-language equivalence
3. Predictable incremental edits

---

## FDR-T009: Type-Guided Optimization

### Decision

Translator SHOULD use `typeIndex` to:

1. **Select applicable Fast Path patterns**
    - Numeric comparator only for number types
    - Length constraint only for string/array types

2. **Filter/boost anchor candidates**
    - "age" likely refers to numeric field
    - "name" likely refers to string field

3. **Tighten SLM prompts**
    - Provide only relevant type slices
    - Reduce token count

### Context

We want low-cost, low-latency translation using small models.

### Rationale

Type facts allow deterministic pruning and reduce ambiguity without "more intelligence."

**Example: Fast Path pattern selection**

```typescript
function selectPatterns(field: SemanticPath, typeIndex: TypeIndex): FastPathPattern[] {
  const resolved = typeIndex[field];
  if (!resolved) return allPatterns; // fallback
  
  switch (resolved.baseKind) {
    case 'number':
      return [comparatorPattern, rangePattern, nullPattern];
    case 'string':
      return [lengthPattern, inclusionPattern, nullPattern];
    case 'boolean':
      return [booleanPattern, nullPattern];
    case 'array':
      return [lengthPattern, nullPattern];
    default:
      return allPatterns;
  }
}
```

### Consequences

1. Higher Fast Path hit rate
2. Fewer SLM calls
3. Smaller prompts and faster proposals

---

# Part 3: Pipeline Architecture

## FDR-T010: Incremental Fragment Model

### Decision

Translator MUST treat every output as an **incremental fragment**, not a complete schema rewrite.

```typescript
interface PatchFragment {
  readonly fragmentId: string;
  readonly sourceIntentId: string;
  readonly description: string;
  readonly change: FragmentChange;
  readonly confidence: number;
  readonly evidence: readonly string[];
}
```

### Context

Users express intent incrementally:
- "나이가 18세 이상이어야 해" (one constraint)
- "이메일은 필수야" (another constraint)
- "이름 필드 추가해줘" (structural change)

Each is a fragment, not a complete schema.

### Rationale

**Incremental benefits:**
- Smaller LLM context (current intent only)
- Faster feedback (each fragment validated immediately)
- Composable (fragments can be combined into programs)
- Undoable (fragments can be individually reverted)

**PatchProgram as fragment collection:**

```typescript
interface PatchProgram {
  readonly programId: string;
  readonly fragments: readonly PatchFragment[];
  readonly dependencies: readonly FragmentDependency[];
  readonly status: ProgramStatus;
}
```

### Consequences

1. Each translation produces one or more fragments
2. Fragments are validated individually
3. Fragments can be composed into programs
4. Partial progress is preserved on ambiguity

---

## FDR-T011: Normalization as First Stage

### Decision

All natural language input MUST pass through **normalization** before any other processing.

```mel
// Pipeline stage 1
once(normalizing) {
  patch normalizing = $meta.intentId
  effect lab.call({
    protocol: "translator.normalize",
    input: { text: request.input },
    into: normalization
  })
}
```

**Normalization produces:**
- Detected language
- Canonical English form
- Protected tokens (identifiers, numbers, literals)
- Glossary matches

### Context

Fast Path and Retrieval need consistent input:
- "사용자의 나이가 18세 이상" (Korean)
- "User age must be at least 18" (English)
- "L'âge de l'utilisateur doit être >= 18" (French)

All should normalize to: `User.age gte 18`

### Rationale

**Normalization separates concerns:**
- Language detection: "What language is this?"
- Token protection: "What must not be changed?"
- Glossary mapping: "What terms do we know?"
- Canonical form: "What's the standard representation?"

**This enables:**
- Language-agnostic Fast Path
- Consistent retrieval queries
- Smaller SLM context (canonical, not raw)

### Consequences

1. Normalization is mandatory (no bypass)
2. Fast Path operates on canonical English
3. Language-specific logic confined to normalizer
4. Glossary is the single source of term mapping

---

## FDR-T012: Glossary as Semantic Mapping

### Decision

Glossary is **semantic mapping**, not translation.

```typescript
interface GlossaryEntry {
  /** Stable semantic identifier - the TRUE anchor */
  readonly semanticId: string;
  
  /** Canonical English representation */
  readonly canonical: string;
  
  /** Aliases per language */
  readonly aliases: Readonly<Record<LanguageCode, readonly string[]>>;
  
  /** Type hint for AI */
  readonly typeHint?: TypeExpr;
  
  /** Anchor hints for retrieval */
  readonly anchorHints?: readonly SemanticPath[];
}
```

### Context

Cross-language semantic equivalence is hard:
- Korean "이상" = English "at least" = MEL `gte`
- But direct translation loses semantic precision

### Rationale

**semanticId is the TRUE anchor:**

```
Korean: "이상"
         ↓
semanticId: "op.gte"  ← This is stable
         ↓
canonical: "gte"
```

**Resolution order:**
1. Exact match to semanticId → return entry
2. Match to any alias → return entry
3. No match → flag as unknown

**This prevents:**
- Cross-language semantic drift
- Ambiguous alias resolution
- Lost domain knowledge

### Consequences

1. Glossary defines the semantic universe
2. Unknown terms are flagged, not guessed
3. Adding language = adding aliases, not rebuilding

---

## FDR-T013: Fast Path for Zero-LLM Cases

### Decision

Fast Path MUST handle common patterns **without any LLM call**.

```mel
// Stage 2: Fast Path (deterministic, no LLM)
once(fastPathing) when isNormalized {
  patch fastPathing = $meta.intentId
  effect translator.fastPath({
    canonical: normalization.canonical,
    schemaId: request.targetSchemaId,
    typeIndex: typeIndex,
    into: fastPath
  })
}
```

### Context

Many translation requests are simple:
- "age >= 18" → comparator constraint
- "email is required" → null constraint
- "status in [pending, active, done]" → inclusion constraint

These don't need LLM reasoning.

### Rationale

**Fast Path benefits:**
- Zero latency (no API call)
- Zero cost (no tokens)
- Deterministic (same input → same output)
- Testable (pattern matching is verifiable)

**V1 patterns (type-aware):**

| Pattern | Applicable Types | Example |
|---------|-----------------|---------|
| Comparator | `number` | `age gte 18` |
| Range | `number` | `age between 18 and 65` |
| Length | `string`, `array` | `password minLen 8` |
| Inclusion | any | `status in [a, b, c]` |
| Boolean | `boolean` | `isActive must be true` |
| Null | any | `email is required` |

**Failure behavior:**
- Fast Path fail → continue to SLM
- Fast Path MUST NOT fail silently

### Consequences

1. Simple cases are instant and free
2. Type information guides pattern selection
3. SLM is only called when necessary

---

## FDR-T014: Tiered Retrieval Strategy

### Decision

Retrieval MUST support multiple tiers with graceful fallback:

```
Tier 0 (OSS baseline): BM25 + Alias table
  - No external dependencies
  - Works offline
  - Sufficient for correctness

Tier 1 (Enhanced): Local vector (FAISS/Qdrant)
  - Better semantic matching
  - Requires local setup

Tier 2 (Managed): Cloud vector service
  - Best semantic matching
  - Requires network + credentials
```

### Context

Different deployments have different constraints:
- OSS users: No cloud dependencies
- Enterprise: May have existing vector infra
- SaaS: Full managed stack

### Rationale

**Tier 0 is SUFFICIENT for correctness:**
- Alias table covers known terms (glossary)
- BM25 handles exact/fuzzy matches
- Context provides disambiguation
- Fallback is SLM, not failure

**Higher tiers improve, not enable:**
- Better recall on rare terms
- Better ranking when multiple matches
- Fewer SLM calls (more Fast Path hits)

### Consequences

1. Translator works without any external services (Tier 0)
2. Higher tiers are performance optimizations
3. No hard dependency on vector databases

---

## FDR-T015: Small-Model-First Proposal

### Decision

SLM proposals MUST use **small models by default**, with explicit escalation triggers.

```typescript
// Lab Protocol definition
{
  "translator.propose": {
    model: "gpt-4o-mini",           // Default: small
    escalation: {
      condition: "confidence < 0.6 || candidates.length > 5",
      model: "gpt-4o"               // Escalate: large
    }
  }
}
```

### Context

Large models are:
- Expensive (10-30x cost)
- Slower (higher latency)
- Often unnecessary (simple tasks don't need GPT-4)

### Rationale

**Small model sufficiency:**
- Normalization: Pattern matching + glossary lookup
- Fast Path matching: Template completion
- Anchor selection: Ranking from short list
- Slot filling: Constrained generation

**Escalation triggers (explicit):**
- Intent split: >3 sub-intents detected
- Anchor tie: Top 2 candidates within 0.1 score
- Low confidence: confidence < 0.6
- Conflict resolution: Contradictory requirements

**NOT escalation triggers:**
- Fast Path success (no LLM needed)
- Single clear intent (small model handles)
- Validation failure (return error, don't retry)

### Consequences

1. Most translations use small models
2. Escalation is governed by Lab Protocol
3. Cost predictable (mostly small model pricing)

---

# Part 4: Governance & Output

## FDR-T016: LLM as Untrusted Proposer

### Decision

LLM outputs MUST be treated as **untrusted proposals** requiring validation.

```
LLM Authority Level = Parser Authority
  - Can propose structure
  - Cannot decide correctness
  - Cannot bypass validation
  - Cannot execute effects
```

### Context

LLMs hallucinate, especially for:
- Field names (inventing fields that don't exist)
- Type compatibility (string → number)
- Constraint logic (invalid expressions)

### Rationale

**Proposal vs Decision:**

| Aspect | LLM (Proposal) | Authority (Decision) |
|--------|----------------|---------------------|
| "Field User.age exists" | Proposes | Validates against schema |
| "age >= 18 is valid expr" | Proposes | Parses and type-checks |
| "This change is safe" | Proposes | Checks invariants |

**Validation is mandatory:**
- Every fragment goes to Authority
- Authority validates against schema
- Invalid proposals are rejected with reason

### Consequences

1. LLM cannot corrupt schema
2. Invalid proposals produce clear errors
3. Trust boundary is explicit

---

## FDR-T017: Ambiguity Returns to Actor

### Decision

When Translator cannot produce a unique PatchFragment, it MUST return an **AmbiguityReport** to the Actor.

```typescript
interface AmbiguityReport {
  readonly reportId: string;
  readonly kind: 'target' | 'intent' | 'value' | 'conflict';
  readonly candidates: readonly AmbiguityCandidate[];
  readonly resolutionPrompt: ResolutionPrompt;
  readonly partialFragments: readonly PatchFragment[];
}
```

**Translator MUST NOT resolve ambiguity itself.**

### Context

Ambiguity examples:
- "age" matches `User.age` and `Profile.age` (target ambiguity)
- "remove empty" could mean removeField or patch-to-null (intent ambiguity)
- "big" as numeric constraint is unclear (value ambiguity)

### Rationale

**Why Actor decides:**
- Actor has context Translator lacks
- Actor can ask clarifying questions
- Actor takes responsibility for choice

**Translator's role:**
- Detect ambiguity
- Present options clearly
- Preserve partial progress
- Accept resolution

### Consequences

1. Ambiguity is explicit, not hidden
2. Actor is informed decision-maker
3. Partial fragments are preserved

---

## FDR-T018: Authority Validates All Fragments

### Decision

All PatchFragments MUST be validated by **Authority** before being applied.

```
Actor (NL input)
  → Translator Domain (propose)
    → Authority (validate)
      → Host (apply)
```

### Context

Authority is Manifesto's governance layer:
- Type checking
- Constraint checking
- Policy enforcement
- Conflict detection

### Rationale

**Authority checks:**
- Does the path exist in schema?
- Is the value type-compatible?
- Does the constraint expression parse?
- Does this conflict with existing constraints?

**Authority is NOT in Translator:**
- Translator proposes
- Authority validates
- Separation of concerns

### Consequences

1. Translator doesn't need full validation logic
2. Authority is single validation point
3. Same validation for all change sources

---

## FDR-T019: MEL Rendering is Separate Concern

### Decision

Translator produces **PatchFragments**, not MEL text.
MEL rendering is performed by a **separate renderer**.

```
Translator → PatchFragment → Authority → MEL Renderer → .mel file
```

### Context

MEL syntax may evolve:
- New keywords
- Grammar changes
- Formatting preferences

### Rationale

**Separation benefits:**
- Translator stable across MEL versions
- Renderer is simple deterministic function
- PatchFragments are the semantic unit

**Renderer responsibility:**
- Fragment → MEL text
- Formatting (indentation, comments)
- Import generation
- File organization

### Consequences

1. Translator doesn't know MEL syntax
2. Renderer is deterministic
3. Schema is source of truth, MEL is projection

---

# Part 5: Expression IR

## FDR-T020: Canonical Expression IR

### Decision

Translator MUST target **MEL v0.3.3 call-only ExprNode** as the canonical expression IR.

```typescript
type ExprNode =
  | { kind: 'lit'; value: null | boolean | number | string }
  | { kind: 'var'; name: 'item' }
  | { kind: 'sys'; path: string[] }
  | { kind: 'get'; path: PathNode }
  | { kind: 'get'; base: ExprNode; path: PathNode }
  | { kind: 'call'; fn: string; args: ExprNode[] }
  | { kind: 'obj'; fields: { key: string; value: ExprNode }[] }
  | { kind: 'arr'; elements: ExprNode[] }
```

### Context

Prior drafts showed multiple expression representations. This fragments:
- Fast Path generators
- SLM response validators
- Authority validation
- Renderer

### Rationale

**MEL v0.3.3 enforces:**
- One canonical form per concept
- Operator sugar desugared to function calls
- Uniform `{ kind: 'call' }` nodes
- Minimal surface for LLM output

**All operators normalize:**

| Syntax | Canonical | IR |
|--------|-----------|-----|
| `a >= b` | `gte(a, b)` | `{ kind: 'call', fn: 'gte', args: [A, B] }` |
| `a && b` | `and(a, b)` | `{ kind: 'call', fn: 'and', args: [A, B] }` |
| `!a` | `not(a)` | `{ kind: 'call', fn: 'not', args: [A] }` |

### Consequences

1. Translator produces uniform IR
2. Validation is simplified
3. No IR mismatch across packages

---

# Part 6: Integration

## FDR-T021: Host Effect Contract

### Decision

Translator Host MUST implement the following Effects:

```typescript
interface TranslatorHostEffects {
  /**
   * LLM normalization (language → canonical English)
   * Protocol configuration defines model, prompt, schema
   */
  "llm.normalize": (params: {
    protocol: string;           // "translator.normalize"
    input: { text: string };
    into: Path;                 // → NormalizationResult
  }) => Promise<void>;
  
  /**
   * LLM proposal (canonical → PatchFragment | AmbiguityReport)
   * Protocol configuration defines model, prompt, escalation rules
   */
  "llm.propose": (params: {
    protocol: string;           // "translator.propose"
    input: {
      canonical: string;
      candidates: AnchorCandidate[];
      schemaId: string;
    };
    into: Path;                 // → ProposalResult
  }) => Promise<void>;
  
  /**
   * Fast Path evaluation (deterministic, no LLM)
   */
  "translator.fastPath": (params: {
    canonical: string;
    schemaId: string;
    into: Path;                 // → FastPathResult
  }) => Promise<void>;
  
  /**
   * Anchor retrieval (may use vector DB)
   */
  "translator.retrieve": (params: {
    terms: Token[];
    schemaId: string;
    tier?: 0 | 1 | 2;
    into: Path;                 // → RetrievalResult
  }) => Promise<void>;
  
  /**
   * Build type index from schema (deterministic projection)
   */
  "translator.buildTypeIndex": (params: {
    schemaId: string;
    into: Path;                 // → TypeIndex
  }) => Promise<void>;
}
```

**Note: Ambiguity resolution is NOT a Host Effect.** It's handled via:
1. `proposal.ambiguity` state (set by domain)
2. `needsResolution` computed (derived)
3. Bridge subscription (observer sees ambiguity)
4. `resolve` action (external decision as Intent)

See [FDR-T004](#fdr-t004-world-only--ambiguity-resolution-via-bridge) for resolution pattern.

**Host Configuration:**

```typescript
const translatorHost = createHost({
  effectHandlers: {
    "llm.normalize": createLLMHandler({
      protocol: "translator.normalize",
      model: "gpt-4o-mini",
      temperature: 0,
      maxTokens: 500,
      systemPrompt: NORMALIZATION_SYSTEM_PROMPT,
      outputSchema: NormalizationResultSchema,
    }),
    
    "llm.propose": createLLMHandler({
      protocol: "translator.propose", 
      model: "gpt-4o-mini",
      temperature: 0.1,
      maxTokens: 1000,
      systemPrompt: PROPOSAL_SYSTEM_PROMPT,
      outputSchema: ProposalResultSchema,
      escalation: {
        condition: (result) => result.confidence < 0.6,
        model: "gpt-4o",
      },
    }),
    
    "translator.fastPath": createFastPathHandler({ /* patterns */ }),
    "translator.retrieve": createRetrievalHandler({ tier: 0 }),
    "translator.buildTypeIndex": createTypeIndexHandler(),
  },
});

// World + Bridge (no Lab required)
const world = createManifestoWorld({ 
  schema: translatorSchema, 
  host: translatorHost 
});

const bridge = createBridge({
  world,
  schemaHash: world.schemaHash,
  defaultActor: { actorId: "translator-user", kind: "human" },
});

// Ambiguity resolution via Bridge subscription
bridge.subscribe((snapshot) => {
  if (snapshot.computed.needsResolution) {
    // Present ambiguity to consumer...
  }
});

// Optional: wrap with Lab for tracing
const labWorld = withLab(world, { runId: 'exp-001', outputPath: './traces' });
```

### Context

Translator as Domain means Effects for external operations.
Host implements these Effects.
**Ambiguity resolution is NOT an Effect** — it's state + computed + action + Bridge.

### Rationale

**Effect-based integration (for LLM/retrieval):**
- Host controls external dependencies
- Translator is pure computation over Snapshot
- Testing: mock Effects, assert on calls
- Deployment: swap Host implementations

**Ambiguity resolution via Bridge (not Effect):**
- State in Snapshot (`proposal.ambiguity`)
- Computed for condition (`needsResolution`)
- Observer pattern via Bridge subscription
- Resolution via Intent (`resolve` action)
- Framework-agnostic (React, CLI, API, AI)

### Consequences

1. Translator has no direct dependencies
2. Host provides LLM and retrieval capabilities
3. Ambiguity resolution via standard Bridge pattern
4. Lab is optional (for tracing/replay)
5. Same Translator Domain, different Hosts/Bridge consumers

---

## FDR-T022: OSS-Ready Baseline

### Decision

Translator MUST be **fully functional** with only OSS dependencies.

| Component | OSS Baseline | Optional Enhancement |
|-----------|--------------|---------------------|
| Normalization | Rule-based + local SLM | Cloud LLM |
| Fast Path | Pattern matching | — |
| Retrieval | BM25 + alias table | Vector DB |
| Proposal | Local SLM (Ollama) | Cloud LLM |
| Type Index | Deterministic builder | — |

### Context

Manifesto is MIT-licensed. Users should be able to run Translator without:
- Cloud API keys
- Proprietary services
- Network access

### Rationale

**OSS-ready means:**
- Tier 0 retrieval works offline
- Local SLM option (Ollama, llama.cpp)
- No hard cloud dependencies
- Full functionality, maybe slower

**Cloud is optional enhancement:**
- Better models
- Managed vector DB
- Lower latency
- Still same Domain, different Host config

### Consequences

1. Zero external dependencies for basic operation
2. Cloud services improve but don't enable
3. Self-hosted deployment is first-class

---

# Summary of Decisions

| FDR | Decision | Supersedes |
|-----|----------|------------|
| **T001** | Translator is Manifesto Domain | v1.x "TypeScript package" |
| **T002** | Dogfooding as existence proof | — |
| **T003** | World-Centric state management | v1.x internal state |
| **T004** | World only + Ambiguity resolution via Bridge | v1.x external systems |
| **T005** | Types as first-class objects | v1.x type-agnostic |
| **T006** | Dual view (Decl + Resolved) | — |
| **T007** | Type changes as PatchFragments | — |
| **T008** | Deterministic type naming | — |
| **T009** | Type-guided optimization | — |
| **T010** | Incremental fragment model | v1.x T003 (enhanced) |
| **T011** | Normalization first | v1.x T006-T007 (merged) |
| **T012** | Glossary as semantic mapping | v1.x T008 (enhanced) |
| **T013** | Fast Path zero-LLM | v1.x T009-T011 (enhanced) |
| **T014** | Tiered retrieval | v1.x T012 (preserved) |
| **T015** | Small-model-first | v1.x T015 (preserved) |
| **T016** | LLM as untrusted proposer | v1.x T002 (preserved) |
| **T017** | Ambiguity returns to Actor (via Bridge) | v1.x T005 (enhanced) |
| **T018** | Authority validates all | — |
| **T019** | MEL rendering is separate | v1.x T001 (enhanced) |
| **T020** | Canonical expression IR | v1.1 T023 (promoted) |
| **T021** | Host Effect contract (LLM only) | v1.x T021 (simplified) |
| **T022** | OSS-ready baseline | v1.x T022 (preserved) |

---

# Open Questions (Tracked for SPEC)

1. **Host Effect Protocol schema**: Exact structure for `llm.normalize` and `llm.propose` effect handlers
2. **Effect handler signatures**: Complete TypeScript types for all Host Effects
3. **Glossary format**: Full specification of GlossaryEntry with typeHint
4. **Fast Path grammar**: BNF for type-aware pattern matching
5. **TypeIndex builder**: Algorithm for deterministic type resolution
6. **Ambiguity thresholds**: Numeric thresholds for confidence, anchor tie detection
7. **Timeout mechanism**: How `$meta.timestamp` triggers expiration (system clock? intent sequence?)
8. **Escalation protocol**: How Host handles `llm.propose` escalation to larger models

---

# Appendix A: MEL v0.3.3 Compliance Checklist

The Translator Domain MEL definition MUST satisfy:

| Rule | Description | Status |
|------|-------------|--------|
| **A-001** | All patch/effect inside guards (when/once) | ✅ |
| **A-002** | once() marker patch is first statement | ✅ |
| **A-003** | No top-level patch/effect in action body | ✅ |
| **A-004** | Named types for all state object fields | ✅ |
| **A-005** | State reads wait for next cycle after patch | ✅ |
| **A-006** | Result setting is one-time (guarded) | ✅ |
| **A-007** | All used types are imported or declared | ✅ |
| **A-008** | available conditions are pure expressions | ✅ |

---

# Appendix B: Ambiguity Resolution via Bridge

Standard pattern for ambiguity resolution:

```typescript
// 1. Bridge subscription observes ambiguity state
bridge.subscribe((snapshot) => {
  if (!snapshot.computed.needsResolution) return;
  
  const { ambiguity } = snapshot.data.proposal;
  
  // 2. Present to consumer (UI/CLI/AI)
  presentAmbiguity(ambiguity);
});

// 3. Consumer decision becomes Intent
function onUserSelect(optionId: string) {
  bridge.dispatch({
    type: "translator.resolve",
    input: {
      decision: "select",
      optionId: optionId
    }
  });
}

// 4. Domain handles resolution via action
// (see FDR-T004 for MEL definition)
```

This pattern works for:
- React UI (useSnapshot + dispatch)
- CLI (readline + bridge.dispatch)
- API (webhook → bridge.dispatchEvent)
- AI agent (LLM decides → bridge.dispatch)

**Key insight:** No special system needed. Just standard Manifesto pattern:
- State (`proposal.ambiguity`)
- Computed (`needsResolution`)
- Subscribe (Bridge)
- Dispatch (Intent)

---

*End of FDR v2.0*
