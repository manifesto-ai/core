---
package: "@manifesto-ai/translator"
version: "0.2.0"
status: "Draft"
date: "2026-01-14"
depends_on:
  - "@manifesto-ai/app v0.4.10"
  - "@manifesto-ai/core v0.5.x"
  - "@manifesto-ai/host v0.5.x"
  - "@manifesto-ai/world v0.5.x"
  - "@manifesto-ai/builder v0.5.x"
  - "@manifesto-ai/intent-ir v0.1.0"
fdr: "FDR-0.2.0v.md"
supersedes: "SPEC-0.1.0v.md"
---

# Translator Specification v0.2.0

## Table of Contents

1. [Introduction](#1-introduction)
2. [Conformance](#2-conformance)
3. [Architecture](#3-architecture)
4. [Domain Schema](#4-domain-schema)
5. [Actions](#5-actions)
6. [Effects](#6-effects)
7. [State Model](#7-state-model)
8. [Lexicon](#8-lexicon)
9. [Key System](#9-key-system)
10. [Resolver](#10-resolver)
11. [Lowering Result](#11-lowering-result)
12. [Action Body Structure](#12-action-body-structure)
13. [Error Model](#13-error-model)
14. [Trace](#14-trace)
15. [Invariants](#15-invariants)
16. [Migration from v0.1.0](#16-migration-from-v010)

---

## 1. Introduction

### 1.1 Purpose

Translator transforms natural language (PF) into **IntentIR** and produces **IntentBody** through **Lexicon-based deterministic lowering**.

**v0.2.0 is a MEL Domain implementation** that operates within the Manifesto protocol stack (Core/Host/World), replacing the standalone TypeScript implementation of v0.1.0.

### 1.2 What Changed from v0.1.0

| Aspect | v0.1.0 | v0.2.0 |
|--------|--------|--------|
| **Implementation** | TypeScript pipeline | MEL Domain |
| **State management** | TranslatorState (separate) | World Snapshot |
| **Effect execution** | Direct LLM calls | Host effect handlers |
| **Governance** | None | World Protocol + Authority |
| **Trace** | Manual | Core automatic |
| **intentKey** | Computed by Translator | Computed by World |
| **Request history** | `requests[]` array | World proposals |

### 1.3 What Remains Unchanged

All functional requirements from v0.1.0 are preserved:

| Requirement | Status |
|-------------|--------|
| PF → IntentIR → IntentBody transformation | Unchanged |
| 7-stage pipeline semantics | Unchanged |
| 4 actions: translate, lower, resolve, learn | Unchanged |
| 3-layer Lexicon (Learned > Project > Builtin) | Unchanged |
| Key system: simKey, intentKey | Unchanged (delegation) |
| Output types: Success, Ambiguous, Unresolved, Error | Unchanged |
| Cold start support | Unchanged |
| ActionBody structure validation | Unchanged |

### 1.4 Scope

| In Scope | Out of Scope |
|----------|--------------|
| PF → IntentIR transformation | MEL text rendering |
| IntentIR → IntentBody lowering | Memory system integration |
| Lexicon-based feature checking | Query/Runtime mode |
| Lexicon learning | strictKey computation |
| Schema editing mode | |
| Action Body validation | |
| simKey/intentKey derivation | |

### 1.5 Design Principles

```
P1. Translator is a Manifesto Domain.
    Core computes. Host executes. World governs.

P2. Snapshot is the single source of truth.
    No separate TranslatorState.

P3. LLM is used only in the propose effect.
    All other stages are deterministic MEL flows.

P4. Effect handlers are the only TypeScript.
    Pipeline logic is expressed in MEL.

P5. World Protocol manages all requests.
    No duplicate request tracking.

P6. IntentBody.type is the resolved canonical lemma.
    Same as v0.1.0.

P7. Key derivation delegates to Intent IR.
    intentKey computation delegates to World.
```

### 1.6 Position in Manifesto Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Natural Language (PF)                        │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    App.act("translator.translate", { text })    │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    World Protocol                               │
│    - Proposal creation                                          │
│    - Authority evaluation                                       │
│    - intentKey computation                                      │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Host (Compute Loop)                          │
│    - Core.compute() orchestration                               │
│    - Effect execution (LLM, normalize, etc.)                    │
│    - Patch application                                          │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Core (Pure Computation)                      │
│    - MEL Flow interpretation                                    │
│    - Patch/Requirement generation                               │
│    - Trace generation                                           │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Snapshot (Domain State)                      │
│    - currentRequest                                             │
│    - learnedLexicon                                             │
│    - Computed: projectLexicon, compositeLexicon                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Conformance

### 2.1 Keywords

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY" are interpreted as described in RFC 2119.

### 2.2 Conformance Classes

**Minimal Conformance:**

| ID | Requirement |
|----|-------------|
| C1 | Implements as MEL Domain with Core/Host/World |
| C2 | Only propose effect is non-deterministic; all flows are deterministic |
| C3 | State managed exclusively through Snapshot |
| C4 | Effect handlers registered with Host |
| C5 | Implements translate, lower, resolve, learn actions |
| C6 | Returns lowering result even without Lexicon (cold start) |
| C7 | IntentBody.type is resolved canonical lemma |
| C8 | simKey derived via Intent IR's `deriveSimKey()` |
| C9 | intentKey delegated to World Protocol |

**Full Conformance:**

| ID | Requirement |
|----|-------------|
| C10 | Supports Authority-based governance |
| C11 | Supports resolver context via World proposals |
| C12 | Core-generated trace for all actions |

---

## 3. Architecture

### 3.1 System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                         Translator Domain                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Domain Schema (MEL)                    │  │
│  │                                                           │  │
│  │   Actions: translate, lower, resolve, learn               │  │
│  │   State: currentRequest, learnedLexicon                   │  │
│  │   Computed: projectLexicon, compositeLexicon              │  │
│  │   Flows: translateFlow, lowerFlow, resolveFlow, etc.      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Effect Handlers (TS)                   │  │
│  │                                                           │  │
│  │   translator.normalize                                    │  │
│  │   translator.propose (LLM)                                │  │
│  │   translator.canonicalize                                 │  │
│  │   translator.featureCheck                                 │  │
│  │   translator.resolveRefs                                  │  │
│  │   translator.lower                                        │  │
│  │   translator.validateActionBody                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Manifesto Stack   │
                    │   (Core/Host/World) │
                    └─────────────────────┘
```

### 3.2 Layer Responsibilities

| Layer | Responsibility | Translator Usage |
|-------|----------------|------------------|
| **Core** | Pure computation, Flow interpretation | Executes MEL flows |
| **Host** | Effect execution, Patch application | Runs LLM, normalize, etc. |
| **World** | Governance, Lineage, intentKey | Manages proposals, computes keys |
| **App** | Facade, orchestration | Entry point for actions |

### 3.3 Sovereignty Rules

**TAPP-SOV-1 (MUST):** Translator Domain MUST NOT bypass Core for computation.

**TAPP-SOV-2 (MUST):** Translator Domain MUST NOT execute effects directly; MUST declare requirements for Host.

**TAPP-SOV-3 (MUST):** Translator Domain MUST NOT manage request history; MUST use World proposals.

**TAPP-SOV-4 (MUST):** All state changes MUST go through Snapshot patches.

### 3.4 Package Structure

```
@manifesto-ai/translator/
├── domain/
│   └── translator.ts       # defineDomain() - MEL schema
├── effects/
│   ├── normalize.ts        # S1 effect handler
│   ├── propose.ts          # S2 effect handler (LLM)
│   ├── canonicalize.ts     # S3 effect handler
│   ├── feature-check.ts    # S4 effect handler
│   ├── resolve-refs.ts     # S5 effect handler
│   ├── lower.ts            # S6 effect handler
│   └── validate.ts         # S7 effect handler
├── lexicon/
│   ├── builtin.ts          # Builtin Operator Lexicon
│   ├── project.ts          # Project Lexicon derivation
│   ├── learned.ts          # Learned Lexicon
│   └── composite.ts        # 3-layer composite
├── types/
│   └── index.ts            # Type definitions
└── index.ts                # Public API
```

---

## 4. Domain Schema

### 4.1 Overview

Translator Domain is defined using `@manifesto-ai/builder`'s `defineDomain()`.

```typescript
import { defineDomain } from '@manifesto-ai/builder';
import { z } from 'zod';

export const translatorDomain = defineDomain('translator', (domain) => {
  // State definitions
  // Action definitions
  // Computed definitions
});
```

### 4.2 State Schema

**TAPP-SCHEMA-1 (MUST):** Domain state follows this structure.

```typescript
const TranslateRequestSchema = z.object({
  input: z.object({
    text: z.string(),
    lang: z.string().optional(),
    strict: z.boolean().optional(),
  }),
  // Pipeline stage results
  normalized: z.string().nullable(),
  intentIR: IntentIRSchema.nullable(),
  canonicalIR: IntentIRSchema.nullable(),
  simKey: z.string().nullable(),           // SimKeyHex
  featureCheckPassed: z.boolean().nullable(),
  resolvedIR: IntentIRSchema.nullable(),
  resolutions: z.array(ResolutionRecordSchema),
  loweringResult: LoweringResultSchema.nullable(),
  actionBodyValid: z.boolean().nullable(),
  // Final result
  result: TranslateResultSchema.nullable(),
  // Stage tracking
  currentStage: z.enum([
    'pending', 'normalizing', 'proposing', 'canonicalizing',
    'checking', 'resolving', 'lowering', 'validating', 'completed', 'failed'
  ]),
  error: TranslatorErrorSchema.nullable(),
});

const LearnedEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('alias'),
    lemma: z.string(),
    targetLemma: z.string(),
    learnedAt: z.string(),
    learnedFrom: z.string(),
  }),
  z.object({
    kind: z.literal('clone'),
    lemma: z.string(),
    entry: EventEntrySchema,
    actionType: z.string(),
    learnedAt: z.string(),
    learnedFrom: z.string(),
  }),
]);

// Domain state
domain.state({
  currentRequest: TranslateRequestSchema.nullable().default(null),
  learnedLexicon: z.record(z.string(), LearnedEntrySchema).default({}),
  config: z.object({
    resolverContextDepth: z.number().min(1).max(20).default(5),
    defaultLang: z.string().default('en'),
    strict: z.boolean().default(false),
  }),
});
```

### 4.3 Computed Values

**TAPP-SCHEMA-2 (MUST):** Lexicons are computed values derived from state and App schema.

```typescript
domain.computed({
  // Project Lexicon derived from App's DomainSchema
  projectLexicon: expr.call('deriveProjectLexicon', [
    expr.sys('schema')  // From App context
  ]),

  // Composite Lexicon (3-layer)
  compositeLexicon: expr.call('createCompositeLexicon', [
    expr.get(state.learnedLexicon),
    expr.computed('projectLexicon'),
    expr.call('createBuiltinLexicon', []),
  ]),

  // Current result (convenience accessor)
  lastResult: expr.get(state.currentRequest.result),
});
```

### 4.4 Action Definitions

**TAPP-SCHEMA-3 (MUST):** Actions are defined with input schemas and flows.

```typescript
// translate action
domain.action('translate', {
  input: z.object({
    text: z.string().min(1),
    lang: z.string().optional(),
    strict: z.boolean().optional(),
  }),
  flow: translateFlow,
});

// lower action
domain.action('lower', {
  input: z.object({
    ir: IntentIRSchema,
  }),
  flow: lowerFlow,
});

// resolve action
domain.action('resolve', {
  input: z.object({
    resolution: ResolutionSchema,
  }),
  flow: resolveFlow,
});

// learn action
domain.action('learn', {
  input: z.object({
    mapping: LearnMappingSchema,
  }),
  flow: learnFlow,
});
```

---

## 5. Actions

### 5.1 translate

Transforms natural language into IntentBody through the full pipeline.

**Input:**

```typescript
type TranslateInput = {
  text: string;
  lang?: string;
  strict?: boolean;
};
```

**Output:** Via `snapshot.data.currentRequest.result`

```typescript
type TranslateResult =
  | { kind: 'success'; body: IntentBody }
  | { kind: 'ambiguous'; candidates: AmbiguityCandidate[] }
  | { kind: 'unresolved'; partial: Partial<IntentBody>; missing: MissingInfo[] }
  | { kind: 'error'; error: TranslatorError };
```

**Flow Definition:**

```typescript
const translateFlow = flow.seq(
  // Initialize request
  flow.onceNull(state.currentRequest, ({ patch }) => {
    patch(state.currentRequest).set({
      input: expr.input(),
      normalized: null,
      intentIR: null,
      canonicalIR: null,
      simKey: null,
      featureCheckPassed: null,
      resolvedIR: null,
      resolutions: [],
      loweringResult: null,
      actionBodyValid: null,
      result: null,
      currentStage: 'pending',
      error: null,
    });
  }),

  // S1: Normalize
  flow.when(
    expr.eq(expr.get(state.currentRequest.currentStage), 'pending'),
    ({ patch, effect }) => {
      patch(state.currentRequest.currentStage).set('normalizing');
      effect('translator.normalize', {
        text: expr.get(state.currentRequest.input.text),
        lang: expr.get(state.currentRequest.input.lang),
      });
    }
  ),

  // S2: Propose (LLM)
  flow.when(
    expr.eq(expr.get(state.currentRequest.currentStage), 'normalizing'),
    ({ patch, effect }) => {
      patch(state.currentRequest.currentStage).set('proposing');
      effect('translator.propose', {
        normalizedText: expr.get(state.currentRequest.normalized),
        lang: expr.get(state.currentRequest.input.lang),
        lexicon: expr.computed('compositeLexicon'),
      });
    }
  ),

  // S3: Canonicalize
  flow.when(
    expr.eq(expr.get(state.currentRequest.currentStage), 'proposing'),
    ({ patch, effect }) => {
      patch(state.currentRequest.currentStage).set('canonicalizing');
      effect('translator.canonicalize', {
        ir: expr.get(state.currentRequest.intentIR),
      });
    }
  ),

  // S4: Feature Check
  flow.when(
    expr.eq(expr.get(state.currentRequest.currentStage), 'canonicalizing'),
    ({ patch, effect }) => {
      patch(state.currentRequest.currentStage).set('checking');
      effect('translator.featureCheck', {
        ir: expr.get(state.currentRequest.canonicalIR),
        lexicon: expr.computed('compositeLexicon'),
        strict: expr.get(state.currentRequest.input.strict),
      });
    }
  ),

  // S5: Resolve References
  flow.when(
    expr.eq(expr.get(state.currentRequest.currentStage), 'checking'),
    ({ patch, effect }) => {
      patch(state.currentRequest.currentStage).set('resolving');
      effect('translator.resolveRefs', {
        ir: expr.get(state.currentRequest.canonicalIR),
        depth: expr.get(state.config.resolverContextDepth),
      });
    }
  ),

  // S6: Lower
  flow.when(
    expr.eq(expr.get(state.currentRequest.currentStage), 'resolving'),
    ({ patch, effect }) => {
      patch(state.currentRequest.currentStage).set('lowering');
      effect('translator.lower', {
        ir: expr.get(state.currentRequest.resolvedIR),
        lexicon: expr.computed('compositeLexicon'),
        resolutions: expr.get(state.currentRequest.resolutions),
      });
    }
  ),

  // S7: Validate ActionBody (conditional)
  flow.when(
    expr.and(
      expr.eq(expr.get(state.currentRequest.currentStage), 'lowering'),
      expr.get(state.currentRequest.loweringResult),
      expr.call('isActionRelatedLemma', [
        expr.get(state.currentRequest.intentIR.event.lemma)
      ])
    ),
    ({ patch, effect }) => {
      patch(state.currentRequest.currentStage).set('validating');
      effect('translator.validateActionBody', {
        loweringResult: expr.get(state.currentRequest.loweringResult),
      });
    }
  ),

  // Complete (success path)
  flow.when(
    expr.and(
      expr.eq(expr.get(state.currentRequest.currentStage), 'lowering'),
      expr.not(expr.call('isActionRelatedLemma', [
        expr.get(state.currentRequest.intentIR.event.lemma)
      ]))
    ),
    ({ patch }) => {
      patch(state.currentRequest.currentStage).set('completed');
      patch(state.currentRequest.result).set(
        expr.call('buildTranslateResult', [
          expr.get(state.currentRequest.loweringResult)
        ])
      );
    }
  ),

  // Complete (after validation)
  flow.when(
    expr.eq(expr.get(state.currentRequest.currentStage), 'validating'),
    ({ patch }) => {
      patch(state.currentRequest.currentStage).set('completed');
      patch(state.currentRequest.result).set(
        expr.call('buildTranslateResult', [
          expr.get(state.currentRequest.loweringResult)
        ])
      );
    }
  ),
);
```

**Rules:**

**TAPP-ACT-TRANS-1 (MUST):** translate executes S1-S7 pipeline via effects.

**TAPP-ACT-TRANS-2 (MUST):** Each stage transition is recorded in `currentStage`.

**TAPP-ACT-TRANS-3 (MUST):** Effect failures set `currentStage = 'failed'` and populate `error`.

**TAPP-ACT-TRANS-4 (MUST):** simKey is stored in Snapshot after S3 completes.

### 5.2 lower

Directly lowers IntentIR (S3-S7 only).

**Input:**

```typescript
type LowerInput = {
  ir: IntentIR;
};
```

**Flow:** Executes S3-S7 of translateFlow.

**TAPP-ACT-LOWER-1 (MUST):** lower MUST be deterministic (given same IR and Lexicon state).

**TAPP-ACT-LOWER-2 (MUST):** lower always computes simKey (IR is provided).

### 5.3 resolve

Resolves Ambiguous or Unresolved state.

**Input:**

```typescript
type ResolveInput = {
  resolution:
    | { kind: 'select'; index: number }
    | { kind: 'provide'; role: string; value: Term }
    | { kind: 'cancel' };
};
```

**Flow:**

```typescript
const resolveFlow = flow.seq(
  // Validate current state allows resolution
  flow.when(
    expr.not(expr.in(
      expr.get(state.currentRequest.result.kind),
      ['ambiguous', 'unresolved']
    )),
    ({ patch }) => {
      patch(state.currentRequest.error).set({
        code: 'INVALID_RESOLUTION',
        message: 'Cannot resolve: not in ambiguous or unresolved state',
      });
      patch(state.currentRequest.currentStage).set('failed');
    }
  ),

  // Handle 'select' resolution
  flow.when(
    expr.eq(expr.input('resolution.kind'), 'select'),
    ({ patch }) => {
      // Select candidate and finalize
      patch(state.currentRequest.result).set(
        expr.call('selectCandidate', [
          expr.get(state.currentRequest.result.candidates),
          expr.input('resolution.index'),
        ])
      );
      patch(state.currentRequest.currentStage).set('completed');
    }
  ),

  // Handle 'provide' resolution
  flow.when(
    expr.eq(expr.input('resolution.kind'), 'provide'),
    ({ patch, effect }) => {
      // Update IR with provided value
      patch(state.currentRequest.intentIR).set(
        expr.call('applyProvision', [
          expr.get(state.currentRequest.intentIR),
          expr.input('resolution.role'),
          expr.input('resolution.value'),
        ])
      );
      // Re-run S3-S7
      patch(state.currentRequest.currentStage).set('canonicalizing');
    }
  ),

  // Handle 'cancel' resolution
  flow.when(
    expr.eq(expr.input('resolution.kind'), 'cancel'),
    ({ patch }) => {
      patch(state.currentRequest.result).set({ kind: 'cancelled' });
      patch(state.currentRequest.currentStage).set('completed');
    }
  ),
);
```

**TAPP-ACT-RES-1 (MUST):** `select` is valid only for `ambiguous` state.

**TAPP-ACT-RES-2 (MUST):** `provide` triggers re-lowering with updated IR.

**TAPP-ACT-RES-3 (MUST):** `provide` recalculates simKey from modified IR.

### 5.4 learn

Adds entry to Learned Lexicon.

**Input:**

```typescript
type LearnInput = {
  mapping:
    | { kind: 'confirm'; pendingId: string; correctedTargetLemma?: string }
    | { kind: 'direct'; lemma: string; targetLemma: string };
};
```

**Flow:**

```typescript
const learnFlow = flow.seq(
  // Validate targetLemma exists in Lexicon
  flow.when(
    expr.not(expr.call('lexiconHasLemma', [
      expr.computed('compositeLexicon'),
      expr.coalesce(
        expr.input('mapping.correctedTargetLemma'),
        expr.input('mapping.targetLemma')
      ),
    ])),
    ({ patch }) => {
      patch(state.currentRequest.error).set({
        code: 'LEARN_TARGET_NOT_FOUND',
        message: 'Target lemma not found in Lexicon',
      });
    }
  ),

  // Check for conflict
  flow.when(
    expr.has(
      expr.get(state.learnedLexicon),
      expr.call('toUpperCase', [expr.input('mapping.lemma')])
    ),
    ({ patch }) => {
      patch(state.currentRequest.error).set({
        code: 'LEARN_CONFLICT',
        message: 'Lemma already exists in Learned Lexicon',
      });
    }
  ),

  // Add to learnedLexicon
  flow.when(
    expr.not(expr.get(state.currentRequest.error)),
    ({ patch }) => {
      patch(state.learnedLexicon).merge({
        [expr.call('toUpperCase', [expr.input('mapping.lemma')])]: {
          kind: 'alias',
          lemma: expr.call('toUpperCase', [expr.input('mapping.lemma')]),
          targetLemma: expr.coalesce(
            expr.input('mapping.correctedTargetLemma'),
            expr.input('mapping.targetLemma')
          ),
          learnedAt: expr.sys('meta.timestamp'),
          learnedFrom: expr.sys('meta.intentId'),
        },
      });
    }
  ),
);
```

**TAPP-ACT-LEARN-1 (MUST):** targetLemma MUST exist in composite Lexicon.

**TAPP-ACT-LEARN-2 (MUST):** Duplicate lemma returns `LEARN_CONFLICT`.

**TAPP-ACT-LEARN-3 (MUST):** Learned entry is immediately available for next translate.

---

## 6. Effects

### 6.1 Effect Handler Contract

**TAPP-EFF-1 (MUST):** Effect handlers are TypeScript functions registered with Host.

```typescript
type EffectHandler = (
  type: string,
  params: unknown,
  context: EffectContext
) => Promise<Patch[]>;
```

**TAPP-EFF-2 (MUST):** Effect handlers MUST return `Patch[]`, never throw.

**TAPP-EFF-3 (MUST):** Failures MUST be expressed as patches to error state.

### 6.2 Effect Types

| Effect Type | Stage | Deterministic | Description |
|-------------|-------|---------------|-------------|
| `translator.normalize` | S1 | Yes | Text normalization |
| `translator.propose` | S2 | **No** | LLM-based IR generation |
| `translator.canonicalize` | S3 | Yes | IR canonicalization + simKey |
| `translator.featureCheck` | S4 | Yes | Lexicon validation |
| `translator.resolveRefs` | S5 | Yes | Reference resolution |
| `translator.lower` | S6 | Yes | IR → IntentBody |
| `translator.validateActionBody` | S7 | Yes | ActionBody validation |

### 6.3 Effect Handler Implementations

#### 6.3.1 translator.normalize

```typescript
export const normalizeHandler: EffectHandler = async (type, params, ctx) => {
  const { text, lang } = params as { text: string; lang?: string };

  try {
    const result = normalize(text, lang);
    return [
      { op: 'set', path: 'data.currentRequest.normalized', value: result.normalized },
      { op: 'set', path: 'data.currentRequest.currentStage', value: 'proposing' },
    ];
  } catch (error) {
    return [
      { op: 'set', path: 'data.currentRequest.error', value: {
        code: 'NORMALIZE_FAILED',
        message: error.message,
        stage: 'normalize',
      }},
      { op: 'set', path: 'data.currentRequest.currentStage', value: 'failed' },
    ];
  }
};
```

#### 6.3.2 translator.propose (LLM)

```typescript
export const proposeHandler: EffectHandler = async (type, params, ctx) => {
  const { normalizedText, lang, lexicon } = params as ProposeParams;

  try {
    // LLM call - the ONLY non-deterministic operation
    const ir = await llmClient.propose(normalizedText, lang, lexicon);

    return [
      { op: 'set', path: 'data.currentRequest.intentIR', value: ir },
      { op: 'set', path: 'data.currentRequest.currentStage', value: 'canonicalizing' },
    ];
  } catch (error) {
    return [
      { op: 'set', path: 'data.currentRequest.error', value: {
        code: 'IR_PROPOSAL_FAILED',
        message: error.message,
        stage: 'propose',
      }},
      { op: 'set', path: 'data.currentRequest.currentStage', value: 'failed' },
    ];
  }
};
```

#### 6.3.3 translator.canonicalize

```typescript
export const canonicalizeHandler: EffectHandler = async (type, params, ctx) => {
  const { ir } = params as { ir: IntentIR };

  const canonical = canonicalizeSemantic(ir);
  const simKey = deriveSimKey(canonical);
  const simKeyHex = serializeSimKey(simKey);

  return [
    { op: 'set', path: 'data.currentRequest.canonicalIR', value: canonical },
    { op: 'set', path: 'data.currentRequest.simKey', value: simKeyHex },
    { op: 'set', path: 'data.currentRequest.currentStage', value: 'checking' },
  ];
};
```

#### 6.3.4 translator.featureCheck

```typescript
export const featureCheckHandler: EffectHandler = async (type, params, ctx) => {
  const { ir, lexicon, strict } = params as FeatureCheckParams;

  const result = checkFeatures(ir, lexicon);

  if (!result.ok && strict) {
    return [
      { op: 'set', path: 'data.currentRequest.error', value: {
        code: 'FEATURE_CHECK_FAILED',
        message: result.errors.map(e => e.message).join('; '),
        stage: 'feature_check',
      }},
      { op: 'set', path: 'data.currentRequest.currentStage', value: 'failed' },
    ];
  }

  return [
    { op: 'set', path: 'data.currentRequest.featureCheckPassed', value: result.ok },
    { op: 'set', path: 'data.currentRequest.currentStage', value: 'resolving' },
  ];
};
```

#### 6.3.5 translator.resolveRefs

```typescript
export const resolveRefsHandler: EffectHandler = async (type, params, ctx) => {
  const { ir, depth } = params as { ir: IntentIR; depth: number };

  // Get recent proposals from World for context
  const recentProposals = await ctx.world.listProposals({
    limit: depth,
    status: 'completed',
  });

  const context = buildResolutionContext(recentProposals);
  const { ir: resolvedIR, resolutions } = resolveReferences(ir, context);

  return [
    { op: 'set', path: 'data.currentRequest.resolvedIR', value: resolvedIR },
    { op: 'set', path: 'data.currentRequest.resolutions', value: resolutions },
    { op: 'set', path: 'data.currentRequest.currentStage', value: 'lowering' },
  ];
};
```

#### 6.3.6 translator.lower

```typescript
export const lowerHandler: EffectHandler = async (type, params, ctx) => {
  const { ir, lexicon, resolutions } = params as LowerParams;

  const result = lowerIR(ir, lexicon, resolutions);

  return [
    { op: 'set', path: 'data.currentRequest.loweringResult', value: result },
    // Stage transition handled by flow based on result
  ];
};
```

#### 6.3.7 translator.validateActionBody

```typescript
export const validateActionBodyHandler: EffectHandler = async (type, params, ctx) => {
  const { loweringResult } = params as { loweringResult: LoweringResult };

  if (loweringResult.kind !== 'resolved') {
    return [
      { op: 'set', path: 'data.currentRequest.actionBodyValid', value: null },
    ];
  }

  const actionBody = extractActionBody(loweringResult.body.input);
  if (!actionBody) {
    return [
      { op: 'set', path: 'data.currentRequest.actionBodyValid', value: true },
    ];
  }

  const validation = validateActionBody(actionBody);

  if (!validation.ok) {
    return [
      { op: 'set', path: 'data.currentRequest.error', value: {
        code: 'ACTION_BODY_INVALID',
        message: 'Action body validation failed',
        detail: validation.violations,
        stage: 'validate_action_body',
      }},
      { op: 'set', path: 'data.currentRequest.actionBodyValid', value: false },
      { op: 'set', path: 'data.currentRequest.currentStage', value: 'failed' },
    ];
  }

  return [
    { op: 'set', path: 'data.currentRequest.actionBodyValid', value: true },
    { op: 'set', path: 'data.currentRequest.currentStage', value: 'completed' },
  ];
};
```

### 6.4 Effect Registration

**TAPP-EFF-4 (MUST):** Effect handlers are registered during App initialization.

```typescript
import { createApp } from '@manifesto-ai/app';
import { translatorDomain } from '@manifesto-ai/translator/domain';
import * as effects from '@manifesto-ai/translator/effects';

const app = createApp({
  domain: translatorDomain,
  services: {
    'translator.normalize': effects.normalizeHandler,
    'translator.propose': effects.proposeHandler,
    'translator.canonicalize': effects.canonicalizeHandler,
    'translator.featureCheck': effects.featureCheckHandler,
    'translator.resolveRefs': effects.resolveRefsHandler,
    'translator.lower': effects.lowerHandler,
    'translator.validateActionBody': effects.validateActionBodyHandler,
  },
});
```

---

## 7. State Model

### 7.1 Snapshot Structure

**TAPP-STATE-1 (MUST):** All Translator state lives in Snapshot.

```typescript
type TranslatorSnapshot = {
  data: {
    currentRequest: TranslateRequest | null;
    learnedLexicon: Record<string, LearnedEntry>;
    config: TranslatorConfig;
  };
  computed: {
    projectLexicon: Lexicon;
    compositeLexicon: Lexicon;
    lastResult: TranslateResult | null;
  };
  system: SystemState;
  meta: SnapshotMeta;
};
```

### 7.2 No Separate TranslatorState

**TAPP-STATE-2 (MUST):** There is NO separate TranslatorState type.

**v0.1.0 (removed):**
```typescript
// ❌ REMOVED - Do not use
type TranslatorState = {
  schema: DomainSchema | null;      // → app.getDomainSchema()
  schemaHash: string | null;        // → app.getDomainSchema().hash
  requests: TranslateRequest[];     // → World.listProposals()
  lastRequestId: string | null;     // → World.listProposals()[0]
  pendingMappings: PendingMapping[];// → Removed (learn handles directly)
  learnedEntries: Record<...>;      // → snapshot.data.learnedLexicon
  config: TranslatorConfig;         // → snapshot.data.config
};
```

### 7.3 Request History via World

**TAPP-STATE-3 (MUST):** Request history is accessed via World Protocol.

```typescript
// ✅ v0.2.0: Use World
const recentRequests = await world.listProposals({
  type: 'translator.translate',
  status: 'completed',
  limit: config.resolverContextDepth,
});

// ❌ v0.1.0: Separate array (removed)
// const recentRequests = state.requests.slice(-depth);
```

### 7.4 Schema Access via App

**TAPP-STATE-4 (MUST):** Schema is accessed via App, not stored.

```typescript
// ✅ v0.2.0: Use App
const schema = app.getDomainSchema();
const schemaHash = schema.hash;

// ❌ v0.1.0: Stored copy (removed)
// const schema = state.schema;
// const schemaHash = state.schemaHash;
```

---

## 8. Lexicon

### 8.1 Composite Lexicon (3 Layers)

**TAPP-LEX-1 (MUST):** Unchanged from v0.1.0.

```
┌─────────────────────────────────┐
│  Learned Lexicon                │  ← From snapshot.data.learnedLexicon
├─────────────────────────────────┤
│  Project Lexicon                │  ← Computed from app.getDomainSchema()
├─────────────────────────────────┤
│  Builtin Operator Lexicon       │  ← Always present
└─────────────────────────────────┘

Lookup order: Learned → Project → Builtin
```

### 8.2 Lexicon as Computed Value

**TAPP-LEX-2 (MUST):** Lexicons are computed values, not stored state.

```typescript
// Computed in domain schema
computed: {
  projectLexicon: expr.call('deriveProjectLexicon', [expr.sys('schema')]),
  compositeLexicon: expr.call('createCompositeLexicon', [
    expr.get(state.learnedLexicon),
    expr.computed('projectLexicon'),
    expr.call('createBuiltinLexicon', []),
  ]),
}
```

### 8.3 Lexicon Interface

Unchanged from v0.1.0. See v0.1.0 SPEC §7.

---

## 9. Key System

### 9.1 Key Hierarchy

**TAPP-KEY-1 (MUST):** Same as v0.1.0, but intentKey computation is delegated.

| Key | Computation | v0.2.0 Change |
|-----|-------------|---------------|
| `simKey` | Effect handler via `deriveSimKey()` | Unchanged |
| `intentKey` | **World Protocol** via `createIntentInstance()` | Delegated to World |

### 9.2 simKey (Semantic Coordinate)

**TAPP-KEY-2 (MUST):** simKey is computed in S3 effect and stored in Snapshot.

```typescript
// In translator.canonicalize effect handler
const simKey = deriveSimKey(canonical);
const simKeyHex = serializeSimKey(simKey);

return [
  { op: 'set', path: 'data.currentRequest.simKey', value: simKeyHex },
];
```

### 9.3 intentKey (Protocol Identity)

**TAPP-KEY-3 (MUST):** intentKey is computed by World, not Translator.

```typescript
// ✅ v0.2.0: World computes intentKey
// Happens automatically in World.submitProposal()
const proposal = await world.submitProposal(actor, {
  body: intentBody,
  // intentKey computed internally by World
});

// ❌ v0.1.0: Translator computed (removed)
// const intentKey = deriveIntentKeySync(body, schemaHash);
```

### 9.4 Accessing intentKey

**TAPP-KEY-4 (MUST):** intentKey is available from World's IntentInstance.

```typescript
// Access via World
const proposal = world.getProposal(proposalId);
const intentKey = proposal.intent.intentKey;
```

---

## 10. Resolver

### 10.1 Purpose

Unchanged from v0.1.0. Transforms discourse references to concrete IDs.

### 10.2 Context Source Change

**TAPP-RES-1 (MUST):** Resolution context comes from World proposals, not separate array.

```typescript
// ✅ v0.2.0: From World
const recentProposals = await world.listProposals({
  type: 'translator.translate',
  status: 'completed',
  limit: depth,
});
const context = buildResolutionContext(recentProposals);

// ❌ v0.1.0: From TranslatorState.requests (removed)
// const context = buildResolutionContext(state.requests, depth);
```

### 10.3 Resolution Algorithm

Unchanged from v0.1.0. See v0.1.0 SPEC §10.

---

## 11. Lowering Result

Unchanged from v0.1.0. See v0.1.0 SPEC §11.

---

## 12. Action Body Structure

Unchanged from v0.1.0. See v0.1.0 SPEC §12.

---

## 13. Error Model

### 13.1 Error as Snapshot Value

**TAPP-ERR-1 (MUST):** Errors are values in Snapshot, not exceptions.

```typescript
// Error stored in Snapshot
snapshot.data.currentRequest.error = {
  code: 'NORMALIZE_FAILED',
  message: 'Invalid input text',
  stage: 'normalize',
  recoverable: true,
};
```

### 13.2 Error Codes

Unchanged from v0.1.0. See v0.1.0 SPEC §13.

---

## 14. Trace

### 14.1 Automatic Trace Generation

**TAPP-TRACE-1 (MUST):** Trace is generated automatically by Core.

```typescript
// ✅ v0.2.0: Core generates trace
const result = await app.act('translator.translate', { text });
const trace = result.trace;  // TraceGraph from Core

// ❌ v0.1.0: Manual trace assembly (removed)
```

### 14.2 Trace Contents

Core trace includes:
- All flow node executions
- All effect invocations and results
- All patch applications
- Timing information
- Expression evaluations

---

## 15. Invariants

### 15.1 Sovereignty Invariants (New)

| ID | Invariant |
|----|-----------|
| INV-SOV-1 | All computation goes through Core.compute() |
| INV-SOV-2 | All effects go through Host effect handlers |
| INV-SOV-3 | All state lives in Snapshot |
| INV-SOV-4 | All requests tracked by World proposals |
| INV-SOV-5 | intentKey computed by World only |

### 15.2 Determinism Invariants

Unchanged from v0.1.0:

| ID | Invariant |
|----|-----------|
| INV-DET-1 | All stages except S2 (propose) are deterministic |
| INV-DET-2 | Same IntentIR + same Lexicon state → same LoweringResult |
| INV-DET-3 | Resolver with same context → same resolution |

### 15.3 Key System Invariants

| ID | Invariant |
|----|-----------|
| INV-KEY-1 | simKey derived via Intent IR's deriveSimKey() |
| INV-KEY-2 | simKey stored in snapshot.data.currentRequest.simKey |
| INV-KEY-3 | intentKey computed by World.createIntentInstance() |
| INV-KEY-4 | intentKey accessed via World proposal |

### 15.4 State Invariants

| ID | Invariant |
|----|-----------|
| INV-STATE-1 | No separate TranslatorState exists |
| INV-STATE-2 | All state in snapshot.data |
| INV-STATE-3 | Request history via World.listProposals() |
| INV-STATE-4 | Schema via app.getDomainSchema() |

### 15.5 Lexicon Invariants

Unchanged from v0.1.0. See v0.1.0 SPEC §15.3.

### 15.6 Action Body Invariants

Unchanged from v0.1.0. See v0.1.0 SPEC §15.6.

---

## 16. Migration from v0.1.0

### 16.1 Breaking Changes

| v0.1.0 | v0.2.0 | Migration |
|--------|--------|-----------|
| `TranslatorState` type | Removed | Use `snapshot.data` |
| `state.requests[]` | Removed | Use `world.listProposals()` |
| `state.schema/schemaHash` | Removed | Use `app.getDomainSchema()` |
| `state.pendingMappings` | Removed | Learn directly |
| `translate()` function | Action | Use `app.act('translator.translate')` |
| `lower()` function | Action | Use `app.act('translator.lower')` |
| `resolve()` function | Action | Use `app.act('translator.resolve')` |
| `learn()` function | Action | Use `app.act('translator.learn')` |
| Direct LLM calls | Effect | Register `translator.propose` handler |

### 16.2 API Changes

**v0.1.0:**
```typescript
import { translate, createInitialState } from '@manifesto-ai/translator';

const state = createInitialState();
const result = await translate({ text: 'Add a task' }, { app, llmClient, state });
```

**v0.2.0:**
```typescript
import { createApp } from '@manifesto-ai/app';
import { translatorDomain, effects } from '@manifesto-ai/translator';

const app = createApp({
  domain: translatorDomain,
  services: effects,
});

await app.ready();
const handle = app.act('translator.translate', { text: 'Add a task' });
await handle.done();

const result = app.getState().data.currentRequest.result;
```

### 16.3 Preserved Functionality

| Functionality | Status |
|---------------|--------|
| 7-stage pipeline semantics | Preserved |
| 4 actions | Preserved (as App actions) |
| 3-layer Lexicon | Preserved |
| simKey derivation | Preserved |
| Cold start support | Preserved |
| ActionBody validation | Preserved |
| Output types | Preserved |
| Error codes | Preserved |

---

## Appendix A: Type Definitions

### A.1 Translator Domain Types

```typescript
// State
export type TranslateRequest = {
  input: TranslateInput;
  normalized: string | null;
  intentIR: IntentIR | null;
  canonicalIR: IntentIR | null;
  simKey: SimKeyHex | null;
  featureCheckPassed: boolean | null;
  resolvedIR: IntentIR | null;
  resolutions: ResolutionRecord[];
  loweringResult: LoweringResult | null;
  actionBodyValid: boolean | null;
  result: TranslateResult | null;
  currentStage: PipelineStage;
  error: TranslatorError | null;
};

export type TranslatorConfig = {
  resolverContextDepth: number;
  defaultLang: string;
  strict: boolean;
};

// Inputs
export type TranslateInput = {
  text: string;
  lang?: string;
  strict?: boolean;
};

export type LowerInput = {
  ir: IntentIR;
};

export type ResolveInput = {
  resolution: Resolution;
};

export type LearnInput = {
  mapping: LearnMapping;
};

// Results
export type TranslateResult =
  | { kind: 'success'; body: IntentBody }
  | { kind: 'ambiguous'; candidates: AmbiguityCandidate[] }
  | { kind: 'unresolved'; partial: Partial<IntentBody>; missing: MissingInfo[] }
  | { kind: 'error'; error: TranslatorError }
  | { kind: 'cancelled' };

// Re-exported from v0.1.0
export type {
  IntentIR,
  IntentBody,
  Lexicon,
  EventEntry,
  LoweringResult,
  LoweringEvidence,
  AmbiguityCandidate,
  MissingInfo,
  ResolutionRecord,
  LearnedEntry,
  TranslatorError,
  TranslatorErrorCode,
  ActionBody,
  SimKeyHex,
} from './types/index.js';
```

---

## Appendix B: Effect Handler Signatures

```typescript
// S1
export type NormalizeParams = {
  text: string;
  lang?: string;
};

// S2
export type ProposeParams = {
  normalizedText: string;
  lang?: string;
  lexicon: Lexicon;
};

// S3
export type CanonicalizeParams = {
  ir: IntentIR;
};

// S4
export type FeatureCheckParams = {
  ir: IntentIR;
  lexicon: Lexicon;
  strict?: boolean;
};

// S5
export type ResolveRefsParams = {
  ir: IntentIR;
  depth: number;
};

// S6
export type LowerParams = {
  ir: IntentIR;
  lexicon: Lexicon;
  resolutions: ResolutionRecord[];
};

// S7
export type ValidateActionBodyParams = {
  loweringResult: LoweringResult;
};
```

---

## Appendix C: Change History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01-13 | Initial draft (TypeScript implementation) |
| 0.2.0 | 2026-01-14 | MEL Domain rewrite (Core/Host/World integration) |

---

*End of Specification v0.2.0*
