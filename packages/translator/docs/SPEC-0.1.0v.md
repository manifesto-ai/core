---
package: "@manifesto-ai/translator-app"
version: "0.1.0"
status: "Draft"
date: "2026-01-13"
depends_on:
  - "@manifesto-ai/app v0.4.10"
  - "@manifesto-ai/intent-ir v0.1.0"
fdr: "manifesto-ai-translator-app v0.1.0 FDR"
---

# Translator App Specification v0.1.0

## Table of Contents

1. [Introduction](#1-introduction)
2. [Conformance](#2-conformance)
3. [Terminology](#3-terminology)
4. [Architecture](#4-architecture)
5. [Pipeline](#5-pipeline)
6. [Key System](#6-key-system)
7. [Lexicon](#7-lexicon)
8. [State Model](#8-state-model)
9. [Actions](#9-actions)
10. [Resolver](#10-resolver)
11. [Lowering Result](#11-lowering-result)
12. [Action Body Structure](#12-action-body-structure)
13. [Error Model](#13-error-model)
14. [Trace](#14-trace)
15. [Invariants](#15-invariants)
16. [Appendix A: Builtin Operator Lexicon](#appendix-a-builtin-operator-lexicon)
17. [Appendix B: Type Definitions](#appendix-b-type-definitions)
18. [Appendix D: Temporal Hinting via pathKey](#appendix-d-temporal-hinting-via-pathkey-addendum-feature-flagged)

---

## 1. Introduction

### 1.1 Purpose

Translator App transforms natural language (PF) into **IntentIR** and produces **IntentBody** through **Lexicon-based deterministic lowering**. It is a Manifesto App.

### 1.2 Scope

| In Scope | Out of Scope |
|----------|--------------|
| PF → IntentIR transformation | MEL text rendering |
| IntentIR → IntentBody lowering | Runtime action execution |
| Lexicon-based feature checking | Memory system integration |
| Lexicon learning (learn) | Query/Runtime mode |
| Schema editing mode | strictKey computation |
| Action Body structure validation | |
| simKey/intentKey derivation (via Intent IR) | |

### 1.3 Design Principles

```
P1. IntentBody is the final output.
    MEL conversion is the adapter/renderer's responsibility.

P2. LLM is used only in the translate stage.
    All subsequent stages are deterministic.

P3. Depends only on App contract.
    Direct World/Host/Core dependency is prohibited.

P4. Lowering returns a result even without Lexicon.
    Cold start support.

P5. Action Body is expressed as structured AST.
    Structural constraints can be validated before MEL rendering.

P6. IntentBody.type is the resolved canonical lemma.
    For builtin/project: type == ir.event.lemma
    For learned alias: type == targetLemma (resolved through alias)

P7. Key derivation delegates to Intent IR SPEC functions.
    simKey = deriveSimKey() (SimHash for proximity, available when IR exists)
    intentKey = deriveIntentKey() (JCS preimage for identity)
    strictKey deferred to v0.2+
```

### 1.4 Relationship to Other Specifications

| Specification | Relationship |
|---------------|--------------|
| App SPEC v0.4.10 | Upper contract (getDomainSchema, act, getState, schemaHash) |
| Intent IR SPEC v0.1.0 | IntentIR/IntentBody types, Lowering algorithm, Lexicon interface, Key system (deriveSimKey, deriveIntentKey, SimKey type) |
| MEL Compiler FDR | Action rules (once, guard, $system) |

---

## 2. Conformance

### 2.1 Keywords

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY" are interpreted as described in RFC 2119.

### 2.2 Conformance Classes

**Minimal Conformance:**

| ID | Requirement |
|----|-------------|
| C1 | Only PF → IntentIR stage is non-deterministic; all others are deterministic |
| C2 | Requires only App contract (no direct World/Host/Core exposure) |
| C3 | Returns lowering result even without Lexicon |
| C4 | Implements translate, lower, resolve, learn actions |
| C5 | Validates Action Body structural constraints (§12) |
| C6 | IntentBody.type is resolved canonical lemma (via Lexicon resolution) |
| C7 | Derives simKey via Intent IR's `deriveSimKey()` when IntentIR exists |
| C8 | Derives intentKey via Intent IR's `deriveIntentKey()` on lowering success |
| C9 | Serializes simKey as SimKeyHex (16-char lowercase hex) |

**Full Conformance:**

| ID | Requirement |
|----|-------------|
| C10 | Supports trace generation |
| C11 | Supports resolver context depth configuration |

---

## 3. Terminology

| Term | Definition |
|------|------------|
| **PF** | Phonetic Form. Natural language text input |
| **IntentIR** | Intent Intermediate Representation. Semantically structured intermediate representation |
| **IntentBody** | Protocol-level intent. Final lowering result |
| **Lexicon** | Provider of lemma → EventEntry mapping |
| **EventEntry** | Contains eventClass, thetaFrame, footprint, policyHints |
| **Lowering** | IntentIR → IntentBody transformation (deterministic) |
| **Resolver** | Discourse reference (this/that/last) → concrete id transformation |
| **Provisional IntentBody** | Undetermined IntentBody returned as UnresolvedResult.partial on Lexicon mapping failure |
| **Action Body** | AST structure representing action definition's execution blocks |
| **SimKey** | 64-bit bigint semantic coordinate (SimHash) |
| **SimKeyHex** | 16-char lowercase hex string representation of SimKey |
| **intentKey** | Protocol intent identity derived via Intent IR's deriveIntentKey() (JCS preimage) |
| **Resolved Canonical Lemma** | The targetLemma returned by Lexicon resolution (= IntentBody.type) |

---

## 4. Architecture

### 4.1 System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                        Manifesto App                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Translator App                         │  │
│  │                                                           │  │
│  │   PF ──► IntentIR ──► IntentBody                         │  │
│  │          (LLM)        (deterministic)                     │  │
│  │                                                           │  │
│  │   [Lexicon]  [Resolver]  [State]                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│                    App API (getDomainSchema, act, getState)     │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   MEL Adapter       │  ← Separate package
                    │   (IntentBody →     │
                    │    MEL Text)        │
                    └─────────────────────┘
```

### 4.2 Contract Boundary

**TAPP-ARCH-1 (MUST):** Translator App's public API requires only the App interface.

```typescript
// ✅ Allowed
interface TranslatorAppDeps {
  app: App;  // @manifesto-ai/app
}

// ❌ Prohibited
interface TranslatorAppDeps {
  world: World;      // Direct dependency prohibited
  host: Host;        // Direct dependency prohibited
  core: Core;        // Direct dependency prohibited
}
```

**TAPP-ARCH-2 (MUST):** Translator App acquires schema via `app.getDomainSchema()`.

---

## 5. Pipeline

### 5.1 Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────┐
│  S1. Normalize (deterministic)                                  │
│      PF normalization (whitespace, characters, language detect) │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  S2. Propose IntentIR (non-deterministic)                       │
│      Generate IntentIR via LLM                                  │
│      ※ Only non-deterministic stage                             │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  S3. Canonicalize + Derive simKey (deterministic)               │
│      IntentIR → Canonical form (Intent IR rules + JCS)          │
│      Derive simKey via deriveSimKey() (SimHash)                 │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  S4. Feature Check (deterministic)                              │
│      Verify selectional restrictions via Lexicon                │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  S5. Resolve References (deterministic)                         │
│      this/that/last → id in all Terms (args + cond)             │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  S6. Lower + Derive intentKey (deterministic)                   │
│      IntentIR → IntentBody (type = resolved canonical lemma)    │
│      Derive intentKey via deriveIntentKey() (JCS preimage)      │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  S7. Validate Action Body (deterministic)                       │
│      §12 structural constraint validation (for Action types)    │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Stage Rules

**TAPP-PIPE-1 (MUST):** Only S2 is non-deterministic. S1, S3-S7 MUST be deterministic.

**TAPP-PIPE-2 (MUST):** Each stage executes after the previous stage completes. Parallel execution is prohibited.

**TAPP-PIPE-3 (SHOULD):** Each stage result should be recordable as trace.

**TAPP-PIPE-4 (MUST):** S7 (Validate Action Body) executes only when IntentBody.type is Action-related.

### 5.3 Canonicalization Rules

**TAPP-PIPE-5 (MUST):** S3 canonicalization follows:
1. Intent IR SPEC canonicalization rules (condition ordering, head normalization, etc.)
2. JCS (RFC 8785) serialization for JSON stability

---

## 6. Key System

### 6.1 Key Hierarchy

**TAPP-KEY-1 (MUST):** v0.1 defines two keys via Intent IR delegation. strictKey is deferred to v0.2+.

| Key | Derivation | Purpose | v0.1 Status |
|-----|------------|---------|-------------|
| `simKey` | `deriveSimKey(intentIR)` | Semantic similarity search, clustering (SimHash) | ✅ MUST (when IR exists) |
| `intentKey` | `deriveIntentKey(body, schemaHash)` | Protocol intent identity (JCS preimage hash) | ✅ MUST (on success) |
| `strictKey` | `deriveStrictKey(...)` | Reproduction cache key | ❌ v0.2+ |

### 6.2 SimKey Type and Serialization

**TAPP-KEY-2 (Normative):** SimKey type definitions:

```typescript
/** 64-bit unsigned SimHash (internal computation) */
type SimKey = bigint;

/** 16-char lowercase hex string (storage/transport) */
type SimKeyHex = string;  // e.g., "0a1b2c3d4e5f6789"
```

**TAPP-KEY-3 (MUST):** SimKey serialization follows this convention:

```typescript
// Serialization (MUST follow)
function serializeSimKey(simKey: SimKey): SimKeyHex {
  return simKey.toString(16).padStart(16, '0');
}

// Deserialization
function deserializeSimKey(hex: SimKeyHex): SimKey {
  return BigInt('0x' + hex);
}
```

**TAPP-KEY-4 (MUST NOT):** Implementations MUST NOT use alternative encodings (decimal, uppercase, variable length) for SimKeyHex.

### 6.3 simKey (Semantic Coordinate via SimHash)

**TAPP-KEY-5 (MUST):** simKey MUST be derived via Intent IR's `deriveSimKey()`.

```typescript
// MUST: delegate to Intent IR SPEC
import { deriveSimKey, SimKey } from '@manifesto-ai/intent-ir';

const simKey: SimKey = deriveSimKey(intentIR);
const simKeyHex: SimKeyHex = serializeSimKey(simKey);
```

| Property | Value |
|----------|-------|
| Input | IntentIR (resolution not required) |
| Algorithm | Intent IR SPEC (tokenization → SimHash) |
| Internal type | `SimKey` (64-bit bigint) |
| Storage/transport type | `SimKeyHex` (16-char lowercase hex) |
| Purpose | Similar meaning search, clustering, transfer learning |
| Key property | **Preserves semantic proximity** (Hamming distance) |
| Derivation stage | S3 (Canonicalize) |

**TAPP-KEY-6 (MUST NOT):** Implementations MUST NOT use simple hash (SHA-256) as simKey.

### 6.4 simKey Availability

**TAPP-KEY-7 (MUST):** simKey is computed only when IntentIR exists.

| Pipeline Stage | simKey Available |
|----------------|------------------|
| S1 (Normalize) fails | ❌ `null` |
| S2 (Propose) fails | ❌ `null` |
| S3+ (IR exists) | ✅ MUST compute |

**TAPP-KEY-8 (MUST):** When IntentIR generation fails, simKey MUST be `null` in output.

### 6.5 intentKey (Protocol Identity via JCS Preimage)

**TAPP-KEY-9 (MUST):** intentKey MUST be derived via Intent IR's `deriveIntentKey()`.

```typescript
// MUST: delegate to Intent IR SPEC
import { deriveIntentKey } from '@manifesto-ai/intent-ir';

intentKey = deriveIntentKey(body, schemaHash);
// Internal: [schemaHash, type, input, scopeProposal] → JCS → SHA-256
```

| Property | Value |
|----------|-------|
| Input | IntentBody + current schemaHash |
| Algorithm | Intent IR SPEC (JCS array preimage → SHA-256) |
| Purpose | Stable identification for caching, deduplication, replay |
| Derivation stage | S6 (Lower) |
| Storage | LoweringEvidence, TranslateRequest |

**TAPP-KEY-10 (MUST NOT):** Implementations MUST NOT use string concatenation (e.g., `body + ':' + schemaHash`) as intentKey preimage.

### 6.6 schemaHash Acquisition

**TAPP-KEY-11 (MUST):** schemaHash is obtained from App, not computed arbitrarily.

```typescript
// schemaHash source (in priority order)
1. App hook payload (domain/schema events)
2. AppState.schemaHash
3. TranslatorState.schemaHash (cached from above)
```

**TAPP-KEY-12 (SHOULD NOT):** Implementations SHOULD NOT compute schema hash independently.

### 6.7 strictKey Deferral

**TAPP-KEY-13 (MUST NOT):** v0.1 MUST NOT compute or expose strictKey.

---

## 7. Lexicon

### 7.1 Composite Lexicon (3 Layers)

**TAPP-LEX-1 (MUST):** Translator App's Lexicon is a 3-layer composite.

```
┌─────────────────────────────────────┐
│  Learned Lexicon                    │  ← Added via learn action
│  (can be empty)                     │
├─────────────────────────────────────┤
│  Project Lexicon                    │  ← Derived from DomainSchema
│  (can be empty)                     │
├─────────────────────────────────────┤
│  Builtin Operator Lexicon           │  ← Always present
│  (for schema editing operations)    │
└─────────────────────────────────────┘
```

**TAPP-LEX-2 (MUST):** Builtin Operator Lexicon MUST always be present.

**TAPP-LEX-3 (MUST):** Lexicon lookup order:
1. Learned Lexicon
2. Project Lexicon
3. Builtin Operator Lexicon

### 7.2 Lexicon Interface

**TAPP-LEX-4 (MUST):** Translator App follows Intent IR SPEC's Lexicon interface.

```typescript
interface Lexicon {
  /** Event entry lookup (for feature check) */
  resolveEvent(lemma: string): EventEntry | undefined;
  
  /** Action type lookup (for lowering) - returns resolved canonical lemma */
  resolveActionType(lemma: string): string | undefined;
  
  /** Map args to input */
  mapArgsToInput(args: IntentIR["args"], cond?: IntentIR["cond"]): unknown;
  
  /** Entity spec lookup (unused in v0.1) */
  resolveEntity?(entityType: string): EntitySpec | undefined;
  
  /** Derive scope proposal (unused in v0.1) */
  deriveScopeProposal?(ir: IntentIR): IntentScope | undefined;
}

type EventEntry = {
  eventClass: EventClass;
  thetaFrame: ThetaFrame;
  footprint?: Footprint;      // v0.2+
  policyHints?: PolicyHints;  // v0.2+
};
```

### 7.3 Project Lexicon Generation

**TAPP-LEX-5 (MUST):** Project Lexicon is derived from `app.getDomainSchema()`.

```typescript
function deriveProjectLexicon(schema: DomainSchema): Lexicon {
  const entries: Record<string, EventEntry> = {};
  
  // Actions → Event entries
  // lemma = action name uppercase
  for (const [name, action] of Object.entries(schema.actions ?? {})) {
    const lemma = name.toUpperCase();
    entries[lemma] = {
      eventClass: inferEventClass(action),
      thetaFrame: deriveThetaFrame(action.params),
    };
  }
  
  return createLexicon(entries);
}
```

### 7.4 Learned Lexicon and Alias Resolution

**TAPP-LEX-6 (MUST):** Learned Lexicon contains entries added via learn action.

**TAPP-LEX-7 (MUST):** Learned entries MUST provide all of the following:
- `resolveEvent(lemma)` → Returns EventEntry (of target)
- `resolveActionType(lemma)` → Returns **targetLemma** (resolved canonical lemma)

Two implementation strategies are allowed:

| Strategy | Storage Format | resolveActionType | resolveEvent |
|----------|---------------|-------------------|--------------|
| **Alias** (recommended) | `{ lemma, targetLemma }` | Returns targetLemma | Re-lookup via targetLemma |
| **Clone** | `{ lemma, entry, actionType }` | Returns actionType | Returns stored entry |

**TAPP-LEX-8 (MUST):** For learned alias, `IntentBody.type` is the **targetLemma**, not the input lemma.

Example:
```
learn: "REGISTER" → "ADD_ACTION"

resolveActionType("REGISTER") → "ADD_ACTION"
resolveEvent("REGISTER") → ADD_ACTION's EventEntry
IntentBody.type → "ADD_ACTION" (not "REGISTER")
```

### 7.5 Cold Start Support

**TAPP-LEX-9 (MUST):** Lowering MUST return a result even when Project Lexicon is empty.

Strategy:
1. Try Builtin Operator Lexicon
2. On failure → Return Provisional IntentBody via `UnresolvedResult`

```typescript
// Provisional IntentBody is returned as UnresolvedResult
{
  kind: 'unresolved',
  partial: {
    type: ir.event.lemma,  // as-is (uppercase)
    input: { args: ir.args, cond: ir.cond, ext: ir.ext }
  },
  missing: [{ kind: 'action_type', detail: 'No matching Lexicon entry for: ' + ir.event.lemma }]
}
```

### 7.6 IntentBody.type Resolution

**TAPP-LEX-10 (MUST):** `IntentBody.type` is always the resolved canonical lemma from Lexicon.

| Lexicon Source | ir.event.lemma | resolveActionType() | IntentBody.type |
|----------------|----------------|---------------------|-----------------|
| Builtin | `ADD_ACTION` | `ADD_ACTION` | `ADD_ACTION` |
| Project | `CREATE_TASK` | `CREATE_TASK` | `CREATE_TASK` |
| Learned alias | `REGISTER` | `ADD_ACTION` | `ADD_ACTION` |
| Provisional (no match) | `UNKNOWN_OP` | undefined | `UNKNOWN_OP` |

---

## 8. State Model

### 8.1 TranslatorState

**TAPP-STATE-1 (MUST):** Translator App maintains the following state.

```typescript
type TranslatorState = {
  /** Current working schema */
  schema: DomainSchema | null;
  
  /** Schema hash (from App) */
  schemaHash: string | null;
  
  /** Request history */
  requests: TranslateRequest[];
  
  /** Last request ID */
  lastRequestId: string | null;
  
  /** Temporary candidates before Lexicon learning */
  pendingMappings: PendingMapping[];
  
  /** Learned Lexicon entries */
  learnedEntries: Record<string, LearnedEntry>;
  
  /** Configuration */
  config: TranslatorConfig;
};
```

### 8.2 TranslateRequest

```typescript
type TranslateRequest = {
  requestId: string;
  input: TranslateInput;
  result: TranslateResult | null;
  intentIR: IntentIR | null;
  /** Semantic coordinate (null if IR generation failed) */
  simKey: SimKeyHex | null;
  /** Protocol identity (null unless lowering succeeded) */
  intentKey: string | null;
  createdAt: string;
  completedAt: string | null;
};

type TranslateResult = 
  | { kind: 'success'; body: IntentBody; }
  | { kind: 'ambiguous'; candidates: AmbiguityCandidate[]; }
  | { kind: 'unresolved'; partial: Partial<IntentBody>; missing: MissingInfo[]; }
  | { kind: 'error'; error: TranslatorError; };
```

### 8.3 PendingMapping

```typescript
type PendingMapping = {
  id: string;
  /** New lemma to learn */
  lemma: string;
  /** Target existing lemma for mapping */
  candidateTargetLemma: string;
  confidence: number;
  source: 'llm' | 'user' | 'inferred';
  requestId: string;
  createdAt: string;
};
```

### 8.4 LearnedEntry

```typescript
type LearnedEntry = 
  | { 
      kind: 'alias'; 
      lemma: string; 
      targetLemma: string; 
      learnedAt: string; 
      learnedFrom: string; 
    }
  | { 
      kind: 'clone'; 
      lemma: string; 
      entry: EventEntry; 
      actionType: string; 
      learnedAt: string; 
      learnedFrom: string; 
    };
```

### 8.5 TranslatorConfig

```typescript
type TranslatorConfig = {
  /** Resolver context depth (default: 5) */
  resolverContextDepth: number;
  
  /** Language hint */
  defaultLang: string;
  
  /** Strict mode - error on feature check failure */
  strict: boolean;
};
```

**TAPP-STATE-2 (MUST):** `resolverContextDepth` default is 5, range is 1-20.

---

## 9. Actions

Translator App provides the following actions.

### 9.1 translate

Transforms natural language into IntentIR and produces IntentBody through lowering.

**Input:**

```typescript
type TranslateInput = {
  /** Natural language text */
  text: string;
  
  /** Language hint (optional) */
  lang?: string;
  
  /** Mode - v0.1 supports only schema */
  mode?: 'schema';
  
  /** Error on feature check failure */
  strict?: boolean;
};
```

**Output:**

```typescript
type TranslateOutput = {
  requestId: string;
  result: TranslateResult;
  /** Semantic coordinate (null if IR generation failed) */
  simKey: SimKeyHex | null;
  /** Protocol identity (present only on success) */
  intentKey?: string;
};
```

**Rules:**

**TAPP-ACT-TRANS-1 (MUST):** translate generates requestId and stores in requests.

**TAPP-ACT-TRANS-2 (MUST):** If LLM-proposed mapping is not in Lexicon, add to pendingMappings. `candidateTargetLemma` is the existing lemma proposed by LLM.

**TAPP-ACT-TRANS-3 (MUST):** Return appropriate result kind based on lowering result.

**TAPP-ACT-TRANS-4 (MUST):** When **valid IntentIR is generated (S3 completes)**, derive simKey via `deriveSimKey()` and serialize to SimKeyHex.

**TAPP-ACT-TRANS-4a (MUST):** When IntentIR generation fails (NORMALIZE_FAILED, IR_PROPOSAL_FAILED, IR_INVALID), simKey MUST be `null`.

**TAPP-ACT-TRANS-5 (MUST):** Derive intentKey via `deriveIntentKey()` when lowering succeeds (kind === 'success').

### 9.2 lower

Directly lowers IntentIR. (Direct invocation of translate's internal stages)

**Input:**

```typescript
type LowerInput = {
  /** IntentIR */
  ir: IntentIR;
  
  /** Request ID (optional, generated if absent) */
  requestId?: string;
};
```

**Output:**

```typescript
type LowerOutput = {
  requestId: string;
  result: LoweringResult | { kind: 'error'; error: TranslatorError; };
  /** Always present (IR is provided) */
  simKey: SimKeyHex;
  /** Present only on success */
  intentKey?: string;
};
```

**Rules:**

**TAPP-ACT-LOWER-1 (MUST):** lower MUST be deterministic.

**TAPP-ACT-LOWER-2 (MUST):** Same IntentIR + same Lexicon state → same result.

**TAPP-ACT-LOWER-3 (MUST):** lower always computes simKey (IR is guaranteed to exist).

**TAPP-ACT-LOWER-4 (MUST):** lower executes S3-S7 (canonicalize through validate_action_body). On S7 validation failure, return `{ kind: 'error', error: { code: 'ACTION_BODY_INVALID', ... } }`.

### 9.3 resolve

Resolves Ambiguity or Unresolved state and re-lowers.

**Input:**

```typescript
type ResolveInput = {
  /** Original request ID */
  requestId: string;
  
  /** Resolution method */
  resolution: Resolution;
};

type Resolution = 
  | { kind: 'select'; index: number; }
  | { kind: 'provide'; role: Role; value: Term; }
  | { kind: 'cancel'; };
```

**Output:**

```typescript
type ResolveOutput = 
  | { kind: 'success'; body: IntentBody; intentKey: string; }
  | { kind: 'still_ambiguous'; candidates: AmbiguityCandidate[]; }
  | { kind: 'still_unresolved'; partial: Partial<IntentBody>; missing: MissingInfo[]; }
  | { kind: 'cancelled'; }
  | { kind: 'error'; error: TranslatorError; };
```

**Rules:**

**TAPP-ACT-RES-1 (MUST):** resolve is valid only when `request.result.kind ∈ {'ambiguous', 'unresolved'}`. Otherwise return `INVALID_RESOLUTION` error.

**TAPP-ACT-RES-1a (MUST):** `select` resolution is allowed only when `result.kind === 'ambiguous'`.

**TAPP-ACT-RES-1b (MUST):** When `result.kind === 'unresolved'`, only `provide` or `cancel` is allowed.

**TAPP-ACT-RES-2 (MUST):** `provide` reflects `request.intentIR.args[role] = value` then **re-lowers**.

**TAPP-ACT-RES-2a (MUST):** `select` confirms the selected candidate IntentBody. Selection reason may be recorded in evidence.

**TAPP-ACT-RES-2b (MUST):** When `provide` modifies IntentIR, simKey MUST be **recalculated** from the modified IR. The original simKey is not preserved.

**TAPP-ACT-RES-3 (MUST):** On `cancel` selection, terminate request and return `cancelled`.

**TAPP-ACT-RES-4 (MUST):** Update request.result based on resolve result.

### 9.4 learn

Confirms pendingMapping and adds to Learned Lexicon.

**Input:**

```typescript
type LearnInput = {
  mapping: 
    | { 
        kind: 'confirm'; 
        pendingId: string; 
        /** Corrected target lemma (optional) */
        correctedTargetLemma?: string; 
      }
    | { 
        kind: 'direct'; 
        lemma: string; 
        targetLemma: string; 
      };
};
```

**Output:**

```typescript
type LearnOutput = 
  | { kind: 'success'; entry: LearnedEntry; }
  | { kind: 'conflict'; existing: LearnedEntry; }
  | { kind: 'error'; error: TranslatorError; };
```

**Rules:**

**TAPP-ACT-LEARN-1 (MUST):** On confirm, remove item from pendingMappings and add to learnedEntries.

**TAPP-ACT-LEARN-2 (SHOULD):** If same lemma already exists in learnedEntries, return conflict.

**TAPP-ACT-LEARN-3 (MUST):** Learned entry is included in Learned Lexicon for next translate.

**TAPP-ACT-LEARN-4 (MUST):** In direct mode, targetLemma MUST exist in existing Lexicon (Project or Builtin). Otherwise return `LEARN_TARGET_NOT_FOUND` error.

**TAPP-ACT-LEARN-5 (MUST):** In confirm mode, `correctedTargetLemma ?? candidateTargetLemma` MUST point to an **existing EventEntry**. Otherwise return `LEARN_TARGET_NOT_FOUND` error.

**TAPP-ACT-LEARN-6 (MUST):** Learned Lexicon MUST provide for learned lemma:
- `resolveActionType(lemma)` returns **targetLemma** (resolved canonical lemma)
- `resolveEvent(lemma)` returns **target's EventEntry** (or re-lookup via alias)

---

## 10. Resolver

### 10.1 Purpose

Resolver transforms discourse references in IntentIR to concrete IDs.

**Intent IR EntityRef.kind (Normative):**

| kind | Meaning | Resolution needed |
|------|---------|------------------|
| `this` | Entity in current context | ✅ |
| `that` | Previously mentioned entity | ✅ |
| `last` | Most recent entity of that type | ✅ |
| `id` | Concrete ID | ❌ (already determined) |

### 10.2 Resolver Interface

```typescript
interface Resolver {
  resolveReferences(
    ir: IntentIR, 
    context: ResolverContext
  ): ResolveStageOutput;
}

type ResolverContext = {
  /** Recent requests to reference */
  recentRequests: TranslateRequest[];
  
  /** Current schema */
  schema: DomainSchema;
  
  /** Maximum depth */
  depth: number;
};

/** Resolution result is separated from IR */
type ResolveStageOutput = {
  /** Pure IntentIR (ref.kind replaced with 'id') */
  ir: IntentIR;
  
  /** Resolution records (separate) */
  resolutions: ResolutionRecord[];
};

type ResolutionRecord = {
  path: string;        // e.g., "args.TARGET.ref" or "cond[0].rhs.ref"
  original: EntityRef; // { kind: 'this' | 'that' | 'last', ... }
  resolved: EntityRef; // { kind: 'id', id: '...' }
};
```

### 10.3 Resolution Algorithm

**TAPP-RES-ALG-1 (MUST):** Resolver MUST traverse all Terms in IntentIR, including both `args` and `cond`.

```typescript
function resolveReferences(ir: IntentIR, ctx: ResolverContext): ResolveStageOutput {
  const resolutions: ResolutionRecord[] = [];
  const resolvedIR = deepClone(ir);
  
  // Traverse args - entity ref terms
  for (const [role, term] of Object.entries(ir.args)) {
    resolveTermIfNeeded(term, `args.${role}`, resolvedIR.args[role], ctx, resolutions);
  }
  
  // Traverse cond - entity ref terms in rhs
  if (ir.cond) {
    for (let i = 0; i < ir.cond.length; i++) {
      const pred = ir.cond[i];
      if (pred.rhs && isEntityRefTerm(pred.rhs)) {
        resolveTermIfNeeded(pred.rhs, `cond[${i}].rhs`, resolvedIR.cond[i].rhs, ctx, resolutions);
      }
    }
  }
  
  return { ir: resolvedIR, resolutions };
}

function resolveTermIfNeeded(
  term: Term, 
  path: string, 
  target: Term, 
  ctx: ResolverContext, 
  resolutions: ResolutionRecord[]
): void {
  if (term.kind === 'entity' && term.ref && term.ref.kind !== 'id') {
    const concrete = findConcreteRef(term, ctx);
    if (concrete) {
      (target as EntityRefTerm).ref = concrete;
      resolutions.push({
        path: `${path}.ref`,
        original: term.ref,
        resolved: concrete,
      });
    }
  }
}
```

### 10.4 Context Depth

**TAPP-RES-1 (MUST):** Resolver references as many recent requests as `config.resolverContextDepth`.

**TAPP-RES-2 (MUST):** Default is 5, range is 1-20.

**TAPP-RES-3 (MUST):** Resolution MUST be deterministic.

**TAPP-RES-4 (MUST):** Resolution records are managed separately, not injected into IntentIR. (IR purity)

---

## 11. Lowering Result

### 11.1 LoweringResult Type

```typescript
type LoweringResult = 
  | ResolvedResult
  | AmbiguousResult
  | UnresolvedResult;

type ResolvedResult = {
  kind: 'resolved';
  body: IntentBody;
  evidence: LoweringEvidence;
};

type AmbiguousResult = {
  kind: 'ambiguous';
  candidates: AmbiguityCandidate[];
  reason: AmbiguityReason;
};

type UnresolvedResult = {
  kind: 'unresolved';
  partial: Partial<IntentBody>;
  missing: MissingInfo[];
};
```

### 11.2 IntentBody (from Intent IR SPEC)

```typescript
type IntentBody = {
  /** Action type (= resolved canonical lemma from Lexicon) */
  type: string;
  input?: unknown;
  scopeProposal?: IntentScope;
};
```

### 11.3 Evidence

```typescript
type LoweringEvidence = {
  lexiconSource: 'builtin' | 'project' | 'learned';
  /** Original lemma from IntentIR */
  originalLemma: string;
  /** Resolved canonical lemma (= IntentBody.type) */
  resolvedLemma: string;
  mappedFields: FieldMapping[];
  /** Resolution records from resolve stage */
  resolutions?: ResolutionRecord[];
  /** Protocol identity key (via deriveIntentKey) */
  intentKey: string;
};

type FieldMapping = {
  from: { role: Role; path: string; };
  to: { field: string; };
};
```

### 11.4 Ambiguity

```typescript
type AmbiguityCandidate = {
  index: number;
  body: IntentBody;
  confidence: number;
  reason: string;
};

type AmbiguityReason = 
  | 'multiple_action_match'
  | 'role_mapping_unclear'
  | 'entity_type_ambiguous';
```

### 11.5 Missing Info

```typescript
type MissingInfo = {
  kind: 'required_role' | 'action_type' | 'entity_ref';
  detail: string;
  suggestion?: string;
};
```

---

## 12. Action Body Structure

Structural constraints for Action Body included in IntentBody.input when Translator App generates Action definitions.

### 12.1 Action Body AST (Normative)

**TAPP-AST-1 (MUST):** Action Body follows this AST structure.

```typescript
type ActionBody = {
  blocks: GuardedBlock[];
};

type GuardedBlock = {
  guard: ActionGuard;
  body: ActionStmt[];
};

type ActionGuard = 
  | { kind: 'when'; condition: ExprNode; }
  | { kind: 'once'; marker: string; };

type ActionStmt = 
  | PatchStmt
  | EffectStmt
  | NestedGuardedBlock;

type PatchStmt = {
  kind: 'patch';
  path: PathNode;
  value: ExprNode;
};

type EffectStmt = {
  kind: 'effect';
  effectType: string;
  args: Record<string, ExprNode>;
  into?: string;
};

type NestedGuardedBlock = {
  kind: 'nested';
  block: GuardedBlock;
};
```

### 12.2 ExprNode (Simplified for v0.1)

```typescript
type ExprNode = 
  | { kind: 'lit'; value: unknown; }
  | { kind: 'get'; path: PathNode; }
  | { kind: 'call'; fn: string; args: ExprNode[]; }
  | { kind: 'sys'; path: string[]; }  // $system.*, $meta.*, $input.*
  | { kind: 'var'; name: string; };   // $item, $acc

type PathNode = PathSegment[];

type PathSegment = 
  | { kind: 'prop'; name: string; }
  | { kind: 'index'; expr: ExprNode; };
```

### 12.3 Structural Constraints

**TAPP-AST-2 (MUST):** All PatchStmt and EffectStmt in Action Body MUST be inside GuardedBlock.

**TAPP-AST-3 (MUST):** When using `once` guard, the first statement in body MUST be marker patch.

**TAPP-AST-3a (MUST):** Marker patch value MUST be `{ kind: 'sys', path: ['meta', 'intentId'] }`.

```typescript
// ✅ Valid once block
{
  guard: { kind: 'once', marker: 'addingTask' },
  body: [
    // First: marker patch (MUST)
    { 
      kind: 'patch', 
      path: [{ kind: 'prop', name: 'addingTask' }], 
      value: { kind: 'sys', path: ['meta', 'intentId'] }  // MUST be this value
    },
    // Subsequent statements
    { kind: 'patch', ... }
  ]
}
```

### 12.4 once+when Pattern (Informative)

**Note:** `once(marker) when cond` pattern is expressed by **nesting once block inside when block**:

```typescript
// once(marker) when cond { ... }
{
  blocks: [{
    guard: { kind: 'when', condition: cond },
    body: [{
      kind: 'nested',
      block: {
        guard: { kind: 'once', marker: 'marker' },
        body: [
          { kind: 'patch', path: [{ kind: 'prop', name: 'marker' }], 
            value: { kind: 'sys', path: ['meta', 'intentId'] } },
          // ... rest
        ]
      }
    }]
  }]
}
```

### 12.5 $system Usage Restriction

**TAPP-AST-4 (MUST):** `sys` node is allowed only in the following contexts:

| Context | sys.path[0] = 'system' | sys.path[0] = 'meta' | sys.path[0] = 'input' |
|---------|------------------------|----------------------|----------------------|
| GuardedBlock.body (patch value) | ✅ | ✅ | ✅ |
| GuardedBlock.body (effect args) | ✅ | ✅ | ✅ |
| GuardedBlock.guard.condition | ❌ | ✅ | ✅ |
| Computed expression | ❌ | ❌ | ❌ |
| State initializer | ❌ | ❌ | ❌ |

### 12.6 Validation Rules

**TAPP-AST-5 (MUST):** When IntentBody.type is Action-related (`ADD_ACTION`, `ADD_ACTION_GUARD`, etc.), ActionBody included in IntentBody.input MUST satisfy §12.2-12.5 constraints.

**TAPP-AST-6 (MUST):** On constraint violation, return `ACTION_BODY_INVALID` error.

### 12.7 Validation Error Details

```typescript
type ActionBodyValidationError = {
  code: 'ACTION_BODY_INVALID';
  violations: ActionBodyViolation[];
};

type ActionBodyViolation = 
  | { kind: 'top_level_stmt'; path: string; }
  | { kind: 'missing_marker_patch'; blockIndex: number; }
  | { kind: 'marker_patch_not_first'; blockIndex: number; actualIndex: number; }
  | { kind: 'invalid_marker_value'; blockIndex: number; actualValue: ExprNode; }
  | { kind: 'sys_in_forbidden_context'; path: string; sysPath: string[]; };
```

---

## 13. Error Model

### 13.1 TranslatorError

**TAPP-ERR-1 (MUST):** All errors are returned in structured form.

```typescript
type TranslatorError = {
  code: TranslatorErrorCode;
  message: string;
  detail?: unknown;
  stage?: PipelineStage;
  recoverable: boolean;
};

type TranslatorErrorCode =
  | 'NORMALIZE_FAILED'
  | 'IR_PROPOSAL_FAILED'
  | 'IR_INVALID'
  | 'FEATURE_CHECK_FAILED'
  | 'RESOLUTION_FAILED'
  | 'LOWERING_FAILED'
  | 'LEXICON_ERROR'
  | 'REQUEST_NOT_FOUND'
  | 'INVALID_INPUT'
  | 'INVALID_RESOLUTION'
  | 'LEARN_TARGET_NOT_FOUND'
  | 'LEARN_CONFLICT'
  | 'ACTION_BODY_INVALID';

type PipelineStage = 
  | 'normalize'
  | 'propose'
  | 'canonicalize'
  | 'feature_check'
  | 'resolve'
  | 'lower'
  | 'validate_action_body';
```

### 13.2 Error Recoverability

| Code | Recoverable | Recovery Action |
|------|-------------|-----------------|
| IR_PROPOSAL_FAILED | true | Retry or different prompt |
| FEATURE_CHECK_FAILED | true | Provide information via resolve |
| RESOLUTION_FAILED | true | Provide explicit ID |
| LOWERING_FAILED | true | Add mapping via learn |
| LEARN_TARGET_NOT_FOUND | true | Specify correct targetLemma |
| INVALID_RESOLUTION | true | Use correct resolution type |
| ACTION_BODY_INVALID | false | Input correction needed |
| IR_INVALID | false | Input correction needed |

---

## 14. Trace

### 14.1 Trace Structure

**TAPP-TRACE-1 (SHOULD):** Each request should be able to generate trace.

```typescript
type TranslateTrace = {
  requestId: string;
  stages: {
    normalize?: NormalizeTrace;
    propose?: ProposeTrace;
    canonicalize?: CanonicalizeTrace;
    featureCheck?: FeatureCheckTrace;
    resolve?: ResolveStageTrace;
    lower?: LowerTrace;
    validateActionBody?: ValidateActionBodyTrace;
  };
  timing: {
    startedAt: string;
    completedAt: string;
    stageDurations: Record<PipelineStage, number>;
  };
};
```

### 14.2 Stage Traces

```typescript
type NormalizeTrace = {
  original: string;
  normalized: string;
  detectedLang: string;
};

type ProposeTrace = {
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  rawOutput?: string;  // redactable
  proposedIR: IntentIR;
};

type CanonicalizeTrace = {
  beforeHash: string;
  afterHash: string;
  /** Semantic coordinate (via deriveSimKey) */
  simKey: SimKeyHex;
};

type FeatureCheckTrace = {
  lexiconUsed: 'builtin' | 'project' | 'learned';
  checksPerformed: FeatureCheck[];
  result: 'pass' | 'fail';
  failures?: FeatureCheckFailure[];
};

type ResolveStageTrace = {
  referencesFound: number;
  resolved: number;
  unresolved: string[];
  resolutions: ResolutionRecord[];
};

type LowerTrace = {
  originalLemma: string;
  resolvedLemma: string;
  mappings: FieldMapping[];
  result: LoweringResult["kind"];
  /** Protocol identity (on success, via deriveIntentKey) */
  intentKey?: string;
};

type ValidateActionBodyTrace = {
  performed: boolean;
  violations: ActionBodyViolation[];
  result: 'pass' | 'fail';
};
```

### 14.3 Trace Redaction

**TAPP-TRACE-2 (MUST):** Sensitive data MUST NOT be included in trace.

| Data | Policy |
|------|--------|
| API keys | ❌ MUST NOT |
| Raw LLM prompts | Optional (configurable) |
| User PF text | Optional (hash alternative) |

---

## 15. Invariants

### 15.1 Determinism Invariants

| ID | Invariant |
|----|-----------|
| INV-DET-1 | All stages except S2 (propose) are deterministic |
| INV-DET-2 | Same IntentIR + same Lexicon → same LoweringResult |
| INV-DET-3 | Resolver with same context → same resolution |

### 15.2 Key System Invariants

| ID | Invariant |
|----|-----------|
| INV-KEY-1 | simKey is derived via Intent IR's deriveSimKey() (SimHash, 64-bit bigint) |
| INV-KEY-2 | simKey is serialized as SimKeyHex (16-char lowercase hex, zero-padded) |
| INV-KEY-3 | simKey is null when IntentIR generation fails |
| INV-KEY-4 | intentKey is derived via Intent IR's deriveIntentKey() (JCS preimage) |
| INV-KEY-5 | strictKey is not computed in v0.1 |
| INV-KEY-6 | simKey preserves semantic proximity (similar IRs → similar simKeys, Hamming distance) |
| INV-KEY-7 | intentKey preimage uses JCS array, not string concatenation |
| INV-KEY-8 | schemaHash is obtained from App, not computed independently |

### 15.3 Lexicon Invariants

| ID | Invariant |
|----|-----------|
| INV-LEX-1 | Builtin Operator Lexicon is always present |
| INV-LEX-2 | Project/Learned Lexicon can be empty |
| INV-LEX-3 | Lookup order: Learned → Project → Builtin |
| INV-LEX-4 | Learned entry provides both resolveEvent and resolveActionType |
| INV-LEX-5 | IntentBody.type = resolved canonical lemma (targetLemma from Lexicon) |
| INV-LEX-6 | For learned alias: IntentBody.type = targetLemma (not input lemma) |

### 15.4 State Invariants

| ID | Invariant |
|----|-----------|
| INV-STATE-1 | requestId is unique |
| INV-STATE-2 | learnedEntries has one entry per lemma |
| INV-STATE-3 | pendingMappings is removed after learn |

### 15.5 HITL Invariants

| ID | Invariant |
|----|-----------|
| INV-HITL-1 | Ambiguity and Unresolved are normal results, not errors |
| INV-HITL-2 | policyHints.destructive → MUST NOT auto-resolve |
| INV-HITL-3 | policyHints.requiresAuth → MUST NOT auto-resolve |
| INV-HITL-4 | resolve handles both ambiguous and unresolved |

### 15.6 Action Body Invariants

| ID | Invariant |
|----|-----------|
| INV-ACT-1 | patch/effect exists only inside guard |
| INV-ACT-2 | First statement in once block is marker patch |
| INV-ACT-3 | Marker patch value is { kind: 'sys', path: ['meta', 'intentId'] } |
| INV-ACT-4 | $system.* is allowed only in action body |

### 15.7 IR Purity Invariants

| ID | Invariant |
|----|-----------|
| INV-IR-1 | Resolution records are not injected into IntentIR |
| INV-IR-2 | IntentIR is kept pure for canonicalization/key derivation |

### 15.8 Resolver Invariants

| ID | Invariant |
|----|-----------|
| INV-RES-1 | Resolver traverses all Terms in IR (args + cond) |
| INV-RES-2 | All symbolic refs (this/that/last) are resolved deterministically |
| INV-RES-3 | resolve(provide) recalculates simKey from modified IR |

### 15.9 Action Invariants

| ID | Invariant |
|----|-----------|
| INV-ACTION-1 | lower executes S3-S7 (canonicalize through validate_action_body) |
| INV-ACTION-2 | lower returns error on S7 validation failure |

---

## Appendix A: Builtin Operator Lexicon

### A.1 Minimum Required Lemmas

**TAPP-BUILTIN-1 (MUST):** The following lemmas MUST be included in Builtin Operator Lexicon.

| Lemma | EventClass | Description |
|-------|------------|-------------|
| `DEFINE_TYPE` | CREATE | Define new type |
| `ADD_FIELD` | TRANSFORM | Add field to type |
| `ADD_CONSTRAINT` | TRANSFORM | Add constraint to field |
| `SET_DEFAULT` | TRANSFORM | Set field default value |
| `ADD_COMPUTED` | CREATE | Add computed value |
| `ADD_ACTION` | CREATE | Define action |
| `ADD_ACTION_PARAM` | TRANSFORM | Add parameter to action |
| `ADD_ACTION_GUARD` | TRANSFORM | Add guard to action |
| `ADD_ACTION_EFFECT` | TRANSFORM | Add effect to action |

### A.2 Example EventEntry

```typescript
const DEFINE_TYPE_ENTRY: EventEntry = {
  eventClass: "CREATE",
  thetaFrame: {
    required: ["TARGET"],  // type name
    optional: ["INSTRUMENT"],  // field definitions
    restrictions: {
      TARGET: { termKinds: ["value"], valueTypes: ["string"] },
      INSTRUMENT: { termKinds: ["artifact"], artifactTypes: ["data"] },
    }
  }
};

const ADD_ACTION_ENTRY: EventEntry = {
  eventClass: "CREATE",
  thetaFrame: {
    required: ["TARGET"],  // action name
    optional: ["INSTRUMENT", "THEME"],  // params, body
    restrictions: {
      TARGET: { termKinds: ["value"], valueTypes: ["string"] },
      INSTRUMENT: { termKinds: ["artifact"], artifactTypes: ["data"] },  // params
      THEME: { termKinds: ["artifact"], artifactTypes: ["data"] },  // body (ActionBody)
    }
  }
};
```

---

## Appendix B: Type Definitions

### B.1 Re-exported from Intent IR

```typescript
// From @manifesto-ai/intent-ir
export type {
  IntentIR,
  IntentBody,
  Force,
  EventClass,
  Role,
  Term,
  EntityRef,
  Pred,
  ThetaFrame,
  SelectionalRestriction,
  EventEntry,
  Lexicon,
  SimKey,  // 64-bit bigint
};

// Key derivation functions (MUST use these, not custom implementations)
export { deriveSimKey, deriveIntentKey } from '@manifesto-ai/intent-ir';
```

### B.2 Translator App Specific

```typescript
/** 16-char lowercase hex string (zero-padded) */
type SimKeyHex = string;

// Serialization utilities
function serializeSimKey(simKey: SimKey): SimKeyHex {
  return simKey.toString(16).padStart(16, '0');
}

function deserializeSimKey(hex: SimKeyHex): SimKey {
  return BigInt('0x' + hex);
}

// TranslatorState
export type TranslatorState = {
  schema: DomainSchema | null;
  schemaHash: string | null;
  requests: TranslateRequest[];
  lastRequestId: string | null;
  pendingMappings: PendingMapping[];
  learnedEntries: Record<string, LearnedEntry>;
  config: TranslatorConfig;
};

// Action Inputs/Outputs
export type TranslateInput = {
  text: string;
  lang?: string;
  mode?: 'schema';
  strict?: boolean;
};

export type TranslateOutput = {
  requestId: string;
  result: TranslateResult;
  /** null if IR generation failed */
  simKey: SimKeyHex | null;
  intentKey?: string;
};

export type TranslateResult = 
  | { kind: 'success'; body: IntentBody; }
  | { kind: 'ambiguous'; candidates: AmbiguityCandidate[]; }
  | { kind: 'unresolved'; partial: Partial<IntentBody>; missing: MissingInfo[]; }
  | { kind: 'error'; error: TranslatorError; };

export type LowerInput = { ir: IntentIR; requestId?: string; };
export type LowerOutput = { 
  requestId: string; 
  result: LoweringResult | { kind: 'error'; error: TranslatorError; }; 
  /** Always present (IR is provided) */
  simKey: SimKeyHex; 
  intentKey?: string; 
};

export type ResolveInput = {
  requestId: string;
  resolution: Resolution;
};

export type Resolution = 
  | { kind: 'select'; index: number; }
  | { kind: 'provide'; role: Role; value: Term; }
  | { kind: 'cancel'; };

export type ResolveOutput = 
  | { kind: 'success'; body: IntentBody; intentKey: string; }
  | { kind: 'still_ambiguous'; candidates: AmbiguityCandidate[]; }
  | { kind: 'still_unresolved'; partial: Partial<IntentBody>; missing: MissingInfo[]; }
  | { kind: 'cancelled'; }
  | { kind: 'error'; error: TranslatorError; };

export type LearnInput = {
  mapping: 
    | { kind: 'confirm'; pendingId: string; correctedTargetLemma?: string; }
    | { kind: 'direct'; lemma: string; targetLemma: string; };
};

export type LearnOutput = 
  | { kind: 'success'; entry: LearnedEntry; }
  | { kind: 'conflict'; existing: LearnedEntry; }
  | { kind: 'error'; error: TranslatorError; };

// Resolver types
export type ResolveStageOutput = {
  ir: IntentIR;
  resolutions: ResolutionRecord[];
};

export type ResolutionRecord = {
  path: string;
  original: EntityRef;
  resolved: EntityRef;
};
```

---

## Appendix C: Change History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01-13 | Initial draft |

---

## Appendix D: Temporal Hinting via pathKey (Addendum, Feature-Flagged)

> **Status:** Addendum (v0.1.0)  
> **Scope:** Optional retrieval hint for Resolver/Selector; does not change identity keys (simKey, intentKey)  
> **Default:** Disabled (feature flag)

### D.1 Motivation

`simKey` provides a **spatial coordinate** (semantic proximity).

However, "recent N retrieval" alone cannot distinguish **how the user arrived** at the current point (trajectory).

This addendum introduces a **temporal hint key** (`pathKey`) that summarizes the trajectory as a rolling hash, enabling hippocampus-style association and habit/workflow detection **without affecting protocol identity**.

### D.2 Feature Flag

**TAPP-PATH-FF-1 (MAY):** Implementations MAY enable temporal hinting via a feature flag.

```typescript
type TranslatorConfig = {
  // existing
  resolverContextDepth: number;
  defaultLang: string;
  strict: boolean;

  // addendum
  enableTemporalHint?: boolean;  // default: false
  temporalDepth?: number;        // default: 8 (used only for ranking; range: 1-32)
};
```

**TAPP-PATH-FF-2 (MUST):** If `enableTemporalHint !== true`, the implementation MUST behave exactly as the base v0.1.0 SPEC (no extra fields required, no ranking changes).

### D.3 Types

**TAPP-PATH-T-1 (Normative):** pathKey is a deterministic rolling hash encoded as lowercase hex.

```typescript
/** 32-byte SHA-256 digest, lowercase hex */
type PathKeyHex = string; // 64 hex chars, e.g. "0f...a9"
```

**TAPP-PATH-T-2 (MUST):** pathKey MUST NOT be used as an identity key. It is a **retrieval hint only**.

### D.4 Derivation Rule (Rolling Hash)

**TAPP-PATH-D-1 (MUST, when enabled):** For each request where IntentIR exists (i.e., S3 completed), derive pathKey deterministically:

1. Let `prevPathKey` be the previous request's pathKey within the same app runtime, or `GENESIS` if none.
2. Let `simKeyHex` be the already-derived SimHash coordinate (S3).
3. Let `resolvedLemma` be the resolved canonical lemma:
    - If lowering resolved: `resolvedLemma = IntentBody.type`
    - Else (unresolved/provisional): `resolvedLemma = intentIR.event.lemma` (as-is canonical lemma)

**Preimage (MUST use JCS array form):**

```typescript
const GENESIS = '0'.repeat(64);  // 64 zeros for initial state

preimage = JCS([ prevPathKey, simKeyHex, resolvedLemma ])
pathKey  = SHA256(preimage)  // hex lowercase
```

**TAPP-PATH-D-2 (MUST, when enabled):** pathKey derivation MUST be deterministic and MUST NOT depend on wall-clock time, randomness, or external IO.

**TAPP-PATH-D-3 (MUST NOT):** pathKey MUST NOT affect:
- simKey derivation
- intentKey derivation
- canonicalization of IntentIR
- Lexicon feature checking / lowering results

(i.e., must not influence semantic identity/meaning)

### D.5 Storage and Output (Minimal Additions)

If `enableTemporalHint === true`, extend TranslateRequest and action outputs:

```typescript
type TranslateRequest = {
  // existing
  requestId: string;
  input: TranslateInput;
  result: TranslateResult | null;
  intentIR: IntentIR | null;
  simKey: SimKeyHex | null;
  intentKey: string | null;
  createdAt: string;
  completedAt: string | null;

  // addendum (when enabled)
  pathKey?: PathKeyHex | null;        // null if IR missing
  prevPathKey?: PathKeyHex | null;    // null for GENESIS
};
```

**TAPP-PATH-S-1 (MUST, when enabled):** If IntentIR generation fails (`intentIR == null`), then `pathKey` MUST be `null` (and `prevPathKey` MAY be preserved as the last known path).

**TAPP-PATH-S-2 (MAY, when enabled):** TranslateOutput / LowerOutput MAY expose pathKey as an optional field:

```typescript
type TranslateOutput = {
  requestId: string;
  result: TranslateResult;
  simKey: SimKeyHex | null;
  intentKey?: string;

  // addendum (when enabled)
  pathKey?: PathKeyHex | null;
};
```

### D.6 Using pathKey for Retrieval (Recommended, Non-Normative)

This addendum does not mandate a specific ranking algorithm. It provides a safe recommendation.

**Baseline candidate set (unchanged):**

```typescript
candidates = recentRequests.slice(-N)  // where N = resolverContextDepth
```

**Recommended scoring (Informative):**

1. **Primary:** semantic proximity by simKey (Hamming distance)
2. **Secondary:** trajectory affinity using pathKey chain pointers (prevPathKey)

**Example heuristic:**

```typescript
temporalAffinity(candidate) = sharedSuffixLength(
  current.prevPathKeyChain, 
  candidate.pathKeyChain, 
  up to temporalDepth
)

finalScore = w1 * simProximity + w2 * temporalAffinity + w3 * recency
```

This keeps v0.1 stable while allowing hippocampus-like association.

### D.7 Trace (Optional)

If trace is enabled, record:

```typescript
type CanonicalizeTrace = {
  // existing
  beforeHash: string;
  afterHash: string;
  simKey: SimKeyHex;

  // addendum (when enabled)
  pathKey?: PathKeyHex;
  prevPathKey?: PathKeyHex;
};
```

### D.8 Invariants (Addendum)

| ID | Invariant |
|----|-----------|
| INV-PATH-1 | (when enabled) pathKey MUST be derived only after simKeyHex exists |
| INV-PATH-2 | (when enabled) pathKey MUST NOT change for the same (prevPathKey, simKeyHex, resolvedLemma) tuple |
| INV-PATH-3 | pathKey is a hint only; it MUST NOT be used as intentKey/strictKey or as part of identity |

---

*End of Specification v0.1.0*
