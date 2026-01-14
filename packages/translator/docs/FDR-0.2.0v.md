# manifesto-ai-translator-app Foundational Design Rationale v0.2.0

> **Status:** Draft
> **Version:** 0.2.0
> **Date:** 2026-01-14
> **Depends on:**
>   - Manifesto App Public API (v0.4.10)
>   - Intent IR (v0.1.0)
>   - Manifesto Core (v0.8.x)
>   - World Protocol (v1.x)

---

## 0. Changelog

| Version | Date | Changes |
|---------|------|---------|
| **v0.2.0** | 2026-01-14 | **ARCHITECTURE PIVOT**: Translator as MEL Domain + State Duplication Elimination |
| v0.1.0 | 2026-01-13 | Initial release: Intent IR-based Translator App |

### v0.2.0 Critical Architecture Decision

**FAD-002: Translator Implementation Must Be MEL-Based Domain, Not TypeScript Pipeline**

v0.1.0 implementation analysis revealed fundamental architecture violations:

1. ❌ **40-50% World Protocol responsibility duplication** (request history, intentKey storage, simKey storage)
2. ❌ **Domain logic in TypeScript** (7-stage pipeline hardcoded)
3. ❌ **Separate state management** (TranslatorState bypasses World)
4. ❌ **FDR-TAPP-001 violation** (does not use App facade exclusively)

**Resolution**: Complete architecture redesign required.

**This document supersedes v0.1.0 implementation decisions.**

---

## 1. Foundational Architecture Decision (FAD-002)

### Translator MUST Be Implemented as Manifesto Domain

> **FAD-002: Translator = MEL Domain Schema + TypeScript Effects (not TypeScript Pipeline)**

This is the **foundational architectural correction** for Translator v0.2+.

#### The Crisis

v0.1.0 implementation created a **parallel state management system** that duplicates World Protocol:

```
┌─────────────────────────────────────────────────┐
│  Translator (v0.1.0 - WRONG)                    │
│  ┌───────────────────────────────────────────┐  │
│  │  TranslatorState (TypeScript)             │  │
│  │  - requests[]      ← Duplicates World     │  │
│  │  - schema/hash     ← Duplicates App       │  │
│  │  - learnedEntries  ← Should be Domain     │  │
│  │  - intentKey/simKey ← Duplicates World    │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  7-Stage Pipeline (TypeScript)                   │
│  - normalize() → propose() → canonicalize()      │
│  - All business logic in code                    │
│  - Bypasses Core/Host/World entirely            │
└─────────────────────────────────────────────────┘

❌ Two sources of truth
❌ State synchronization required
❌ No Authority governance
❌ No automatic trace
❌ FDR-TAPP-001 violation
```

#### The Resolution

```
┌─────────────────────────────────────────────────┐
│  Translator (v0.2.0 - CORRECT)                  │
│  ┌───────────────────────────────────────────┐  │
│  │  translator.mel (Domain Schema)           │  │
│  │                                            │  │
│  │  state {                                   │  │
│  │    config: TranslatorConfig               │  │
│  │  }                                         │  │
│  │                                            │  │
│  │  computed {                                │  │
│  │    recentProposals: // via World          │  │
│  │    projectLexicon: // from schema         │  │
│  │  }                                         │  │
│  │                                            │  │
│  │  action translate { ... }                  │  │
│  │  action learn { ... }                      │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  Effects (TypeScript - External Only)            │
│  - translator.llm.propose                        │
│  - translator.normalize                          │
└─────────────────────────────────────────────────┘
          │
          ▼
    App Facade
    ├─ app.getDomainSchema()
    ├─ app.getState()
    ├─ app.act("translate", ...)
    └─ World Protocol manages all state

✅ Single source of truth (World)
✅ Authority governs all actions
✅ Automatic trace generation
✅ FDR-TAPP-001 compliance
```

#### Why TypeScript Pipeline Violates Manifesto Principles

| Principle | TypeScript Implementation | MEL Implementation |
|-----------|--------------------------|-------------------|
| **"Core computes"** | ❌ Bypassed | ✅ Core computes all flows |
| **"Host executes"** | ❌ Direct execution | ✅ Host executes effects |
| **"World governs"** | ❌ No governance | ✅ Authority validates all |
| **State = Snapshot** | ❌ Separate state | ✅ Domain state in Snapshot |
| **Trace everything** | ❌ Manual trace | ✅ Automatic trace |
| **Determinism** | ❌ Hidden state | ✅ Snapshot-based |

**Conclusion**: TypeScript pipeline is **architecturally incompatible** with Manifesto.

---

## 2. Core Duplication Problems (v0.1.0 Analysis)

### 🔴 Duplication 1: Request History

**Problem**: `TranslatorState.requests[]` duplicates `WorldStore.getProposalById()` / `listProposals()`.

**v0.1.0 Code**:
```typescript
// types/state.ts:231-245
export type TranslateRequest = {
  readonly requestId: string;      // ← Same as proposalId
  readonly input: TranslateInput;
  readonly result: TranslateResult;
  readonly intentIR: IntentIR;
  readonly simKey: SimKeyHex;      // ← World's concern
  readonly intentKey: string;      // ← World's concern
  readonly createdAt: string;      // ← Same as Proposal.createdAt
  readonly completedAt: string;
};

// State stores array
readonly requests: readonly TranslateRequest[];
```

**What World Already Provides**:
```typescript
// World Protocol
export const ProposalRecord = z.object({
  proposalId: z.string(),
  intentInstance: IntentInstance,  // includes intentKey
  actor: ActorRef,
  createdAt: z.number(),
  // ...
});

interface WorldStore {
  getProposalById(proposalId: string): Promise<ProposalRecord | null>;
  listProposals(query?: ProposalQuery): Promise<ProposalRecord[]>;
}
```

**Impact**:
- **Two sources of truth** for intent history
- **Synchronization burden**: requests[] must stay in sync with World
- **Data duplication**: Same information stored twice
- **Inconsistency risk**: World and Translator can diverge

**Resolution (v0.2)**:
- ❌ Remove `TranslatorState.requests`
- ✅ Use `computed recentProposals` that reads from World via App

---

### 🔴 Duplication 2: intentKey Computation

**Problem**: intentKey computed **twice** (Translator S6 + World createIntentInstance).

**v0.1.0 Code**:
```typescript
// pipeline/lower.ts:110
const intentKey = deriveIntentKeySync(body, schemaHash);

// Stored in TranslateRequest
return {
  loweringResult: result,
  intentKey,  // ← Translator stores this
};
```

**What World Does**:
```typescript
// World factories.ts
export async function createIntentInstance(opts): Promise<IntentInstance> {
  const intentKey = await computeIntentKey(opts.schemaHash, opts.body);
  return {
    body: opts.body,
    intentId: generateIntentId(),
    intentKey,  // ← World ALSO computes this
    meta: opts.meta,
  };
}
```

**Impact**:
- **intentKey computed twice** for same IntentBody
- **Algorithm divergence risk**: If implementations differ, inconsistent keys
- **Performance waste**: Redundant SHA-256 computation
- **Ownership confusion**: Is intentKey Translator's or World's?

**World Protocol Spec**:
> "intentKey: Semantic identity (derived from body + schemaHash)"

intentKey is **World's identity system**, not Translator concern.

**Resolution (v0.2)**:
- ❌ Remove intentKey computation from Translator
- ✅ Let World compute intentKey when Actor submits IntentBody

---

### 🔴 Duplication 3: simKey Storage

**Problem**: simKey stored in ephemeral TranslatorState, not persistent World.

**v0.1.0 Code**:
```typescript
// types/state.ts:239
readonly simKey: SimKeyHex | null;

// pipeline/canonicalize.ts:96
const simKey = deriveSimKey(canonical);
const simKeyHex = serializeSimKey(simKey);
return {
  canonical,
  simKey,
  simKeyHex,  // ← Stored in TranslatorState
};
```

**Problem Analysis**:
- simKey = **semantic coordinate** for clustering/similarity
- Used by Memory for retrieval: "find similar past intents"
- Should be **persistent**, indexed, queryable
- Translator restart = all simKeys lost!

**Where simKey Should Live**:
1. **Computed by Intent IR** (already correct)
2. **Stored in World** as IntentInstance metadata or separate index
3. **NOT in Translator ephemeral state**

**Resolution (v0.2)**:
- ❌ Remove simKey storage from TranslatorState
- ✅ Store simKey in World alongside IntentInstance
- ✅ Memory queries World for simKey-based retrieval

---

### 🟡 Duplication 4: Schema & SchemaHash

**Problem**: Redundant storage when App already provides.

**v0.1.0 Code**:
```typescript
// types/state.ts:257-259
export type TranslatorState = {
  readonly schema: unknown | null;
  readonly schemaHash: string | null;
  // ...
};
```

**What App Provides**:
```typescript
// App.getDomainSchema()
getDomainSchema(): DomainSchema {
  return this._schemaCache.get(currentSchemaHash);
}

// DomainSchema includes hash
type DomainSchema = {
  hash: string;  // ← Already has schemaHash
  // ...
};
```

**Resolution (v0.2)**:
- ❌ Remove `schema` and `schemaHash` from TranslatorState
- ✅ Always call `app.getDomainSchema()` and use `.hash`

---

### 🟡 Duplication 5: Learned Lexicon State

**Problem**: Domain knowledge stored in ephemeral app state.

**v0.1.0 Code**:
```typescript
// types/state.ts:267
readonly learnedEntries: Readonly<Record<string, LearnedEntry>>;

export type LearnedAliasEntry = {
  kind: "alias";
  lemma: string;
  targetLemma: string;
  learnedAt: string;
  learnedFrom: string;
};
```

**Problem Analysis**:
- Learned lexicon = **domain knowledge**, not transient state
- Should persist across restarts
- Should be part of Domain State (managed by World)

**Where It Should Live**:
1. **Domain State**: `snapshot.data.translatorLexicon`
2. **Schema Extension**: Part of DomainSchema metadata
3. **Separate World Store**: If cross-domain shared

**Resolution (v0.2)**:
- ❌ Remove `learnedEntries` from TranslatorState
- ✅ Define in MEL schema: `state { learnedLexicon: Record<string, LearnedEntry> }`
- ✅ Use `app.getState().data.learnedLexicon` to read
- ✅ Use `app.act("translator.learn", ...)` to write (patches domain state)

---

## 3. New Architecture Decisions (v0.2)

### FDR-TAPP-039: Translator as Manifesto Domain

#### Decision

Translator MUST be implemented as a **Manifesto Domain** defined in MEL schema.

```mel
// translator.mel
domain Translator {
  state {
    config: TranslatorConfig
  }

  computed recentProposals {
    // World.listProposals() via Core compute
  }

  action translate {
    params { text: string }
    guards {
      once validated {
        effect translator.normalize($input.text)
        patch input.normalized = $effect.result

        effect translator.llm.propose(input.normalized)
        patch input.ir = $effect.result

        patch result = call lowerPipeline(input.ir)
      }
    }
  }
}
```

#### Rationale

**Why MEL, not TypeScript:**

1. **Manifesto Principle Alignment**
   - Core computes all logic
   - Host executes effects
   - World governs all actions
   - TypeScript pipeline bypasses all three!

2. **Automatic Governance**
   - Every `action` goes through World Protocol
   - Authority can approve/reject/modify
   - No way to bypass governance

3. **Automatic Trace**
   - Core generates trace for every compute
   - No manual trace instrumentation needed
   - Complete audit trail by design

4. **State Management Correctness**
   - State lives in Snapshot (World-managed)
   - No separate state synchronization
   - Single source of truth

5. **Determinism Guarantees**
   - Snapshot = complete truth
   - Same Snapshot → same compute result
   - No hidden state

6. **Testing Benefits**
   - Test domain schema, not code
   - Pure functions (Core) easy to test
   - Effects mocked at Host level

#### What Changes

| Aspect | v0.1.0 (TypeScript) | v0.2.0 (MEL) |
|--------|---------------------|--------------|
| **Domain logic** | TypeScript functions | MEL actions/computed |
| **State** | TranslatorState (separate) | Domain state (Snapshot) |
| **History** | requests[] array | World ProposalRecords |
| **Governance** | None | Authority validates all |
| **Trace** | Manual instrumentation | Automatic |
| **Learned data** | In-memory map | Domain state (persisted) |

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Patch v0.1.0 implementation | Does not address fundamental architecture mismatch |
| Hybrid (some MEL, some TypeScript) | Unclear boundaries, still bypasses governance |
| Keep TypeScript, add adapters | Still two sources of truth |

#### Consequences

- ✅ ~1,761 lines of TypeScript removed (70-80% of v0.1.0)
- ✅ FDR-TAPP-001 compliance: only uses App facade
- ✅ Single source of truth: World stores all state
- ✅ Automatic trace, governance, determinism
- ❌ Requires complete rewrite of v0.1.0 implementation
- ❌ ~5-7 days implementation effort (vs ~2-3 days for patch)

---

### FDR-TAPP-040: State Duplication Elimination

#### Decision

Translator MUST NOT maintain separate state. All persistent data MUST live in:
1. **Domain State** (via World Snapshot)
2. **World Stores** (ProposalRecords, etc.)
3. **Schema** (derived data like projectLexicon)

#### Rationale

**Single Source of Truth Principle**:
- Multiple sources of truth → synchronization bugs
- Distributed state → consistency problems
- Separate storage → data loss risk

**World Protocol is THE Store**:
> "World Protocol governs legitimacy, authority, and lineage"

Lineage = history. Translator maintaining separate history violates this.

#### What Gets Removed

| v0.1.0 State | Replacement (v0.2) |
|--------------|-------------------|
| `requests[]` | `World.listProposals()` via computed |
| `schema/schemaHash` | `app.getDomainSchema()` |
| `learnedEntries{}` | `snapshot.data.learnedLexicon` |
| `intentKey` storage | World computes on submission |
| `simKey` storage | World stores in IntentInstance meta |

#### Consequences

- ✅ No synchronization logic needed
- ✅ No data loss on restart (World persists)
- ✅ Consistent state across system
- ✅ ~450 lines removed
- ❌ Requires migration for existing users

---

### FDR-TAPP-041: MEL-First Implementation

#### Decision

All domain logic MUST be in MEL schema. TypeScript ONLY for:
1. **External effects** (LLM API, language detection, etc.)
2. **Effect handlers** (registered with `app.registerEffect()`)
3. **Pure utilities** (if not expressible in MEL)

#### Rationale

**MEL = Data, TypeScript = Execution**:
- Domain logic as data → inspectable, analyzable, transformable
- Domain logic as code → opaque, hard to analyze

**Core Computes**:
- MEL flow → Core interprets → generates trace
- TypeScript function → Core cannot see inside

**Change Management**:
- MEL change → reload schema (hot swap possible)
- TypeScript change → rebuild, redeploy, restart

#### What Goes Where

| Logic | v0.1.0 (TypeScript) | v0.2.0 (MEL + TypeScript) |
|-------|---------------------|---------------------------|
| Normalize | `normalize.ts` function | `effect translator.normalize` + handler |
| Propose (LLM) | `propose.ts` function | `effect translator.llm.propose` + handler |
| Canonicalize | `canonicalize.ts` function | `computed` or `call canonicalize()` |
| Feature check | `feature-check.ts` function | `call featureCheck()` |
| Lower | `lower.ts` function | `call lowerIR()` |
| Validate | `validate-action-body.ts` | `call validateActionBody()` |

**TypeScript Effect Handlers Only**:
```typescript
// effects/llm-propose.ts
export async function llmProposeHandler(
  params: { text: string }
): Promise<IntentIR> {
  const response = await openai.chat.completions.create({...});
  return parseToIntentIR(response);
}

// Register with App
app.registerEffect("translator.llm.propose", llmProposeHandler);
```

**MEL Action Uses Effect**:
```mel
action translate {
  params { text: string }
  guards {
    once translated {
      effect translator.llm.propose($input.text)
      patch input.ir = $effect.result
      // ... rest of pipeline
    }
  }
}
```

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| All TypeScript | Violates Manifesto principles |
| Some pipeline in TypeScript | Unclear boundary, partial bypass |
| Pure functions in TypeScript | Core should compute, not TypeScript |

#### Consequences

- ✅ Domain logic visible to Core (trace, analysis)
- ✅ Change schema without code changes
- ✅ Authority can see/validate all logic
- ❌ MEL expressiveness limitations (workaround with `call`)
- ❌ Learning curve for MEL authoring

---

### FDR-TAPP-042: Effects-Only TypeScript

#### Decision

TypeScript in Translator v0.2 MUST be limited to:
1. **Effect handlers** for external APIs (LLM, language detection)
2. **Pure utility functions** for data transformation
3. **Type definitions** for effect inputs/outputs

TypeScript MUST NOT:
- ❌ Maintain state
- ❌ Implement domain logic
- ❌ Call World/Host/Core directly

#### Rationale

**Separation of Concerns**:
- External world = TypeScript effects
- Internal domain = MEL schema
- Coordination = Core/Host/World

**Effect Handler Contract**:
```typescript
type EffectHandler = (params: unknown) => Promise<unknown>;
```

- Input: JSON-serializable params
- Output: JSON-serializable result
- Side effects: Allowed (that's the point)
- State: None (stateless function)

#### Examples

**✅ CORRECT: Effect Handler**:
```typescript
// effects/normalize.ts
export async function normalizeText(params: {
  text: string;
  lang?: string
}): Promise<{ normalized: string; detectedLang: string }> {
  const detected = await detectLanguage(params.text);
  const normalized = applyNormalizationRules(params.text, detected);
  return { normalized, detectedLang: detected };
}
```

**✅ CORRECT: Pure Utility**:
```typescript
// utils/lexicon-utils.ts
export function buildProjectLexicon(schema: DomainSchema): Lexicon {
  // Pure transformation: schema → lexicon
  return {
    resolveEvent: (lemma) => schema.actions[lemma]?.eventEntry,
    // ...
  };
}
```

**❌ WRONG: Business Logic**:
```typescript
// ❌ DO NOT DO THIS
export async function translatePipeline(input: TranslateInput): Promise<TranslateOutput> {
  const norm = await normalize(input.text);
  const proposed = await propose(norm);
  const canonical = canonicalize(proposed);
  // ... business logic in TypeScript
}
```

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Allow business logic in TypeScript | Bypasses Core/Host/World |
| Allow state in effect handlers | Breaks determinism |
| Allow direct World/Core calls | Violates App facade principle |

#### Consequences

- ✅ Clear boundary: Effects vs Domain
- ✅ Testable: Mock effect handlers
- ✅ Composable: Effects reusable across domains
- ❌ Cannot express everything in MEL v1 (workaround: `call` to TypeScript)

---

### FDR-TAPP-043: Stateless Translator Pipeline

#### Decision

Translator translate() function MUST be stateless. Input → Output, no side effects, no state storage.

```typescript
// v0.2 translate signature
export async function translate(
  text: string,
  app: App
): Promise<IntentBody | AmbiguityReport | TranslatorError> {
  // Just calls app.act("translator.translate", { text })
  // NO state storage
}
```

#### Rationale

**Manifesto Principles**:
- State lives in Snapshot
- State changes via Patches
- State managed by World

**Stateless Pipeline Benefits**:
1. **Determinism**: Same input → same output
2. **Testability**: Pure function (mostly)
3. **Concurrency**: No shared state
4. **Simplicity**: No state management code

**State Management Delegation**:
- **Domain State**: World manages via Snapshot
- **Request History**: World manages via ProposalRecords
- **Learned Data**: Domain state (Snapshot.data.learnedLexicon)

#### What Changes

| Aspect | v0.1.0 (Stateful) | v0.2.0 (Stateless) |
|--------|-------------------|-------------------|
| **Function signature** | `translate(input, context: { state })` | `translate(text, app)` |
| **State mutation** | Updates TranslatorState | None (delegates to World) |
| **Return value** | `{ requestId, result, simKey, intentKey }` | `IntentBody` |
| **History storage** | Stores in `state.requests[]` | None (World stores) |

#### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Keep TranslatorState | Two sources of truth |
| Pass state as context | Still mutating external state |
| Return state updates | Better, but still managing state |

#### Consequences

- ✅ ~80 lines removed (state management)
- ✅ No synchronization bugs
- ✅ Easier to test
- ✅ FDR-TAPP-001 compliance
- ❌ Requires World query for history (computed)

---

## 4. Removed Decisions (Obsoleted by v0.2)

The following v0.1.0 decisions are **superseded** by v0.2 architecture:

| FDR | Decision | v0.2 Status |
|-----|----------|-------------|
| FDR-TAPP-017 | pendingMappings in State | ❌ Removed: Use Domain State |
| FDR-TAPP-027 | Trace SHOULD | ❌ Obsolete: Automatic trace in MEL |
| FDR-TAPP-033 | lower includes S7 validation | ❌ Obsolete: MEL action flow |

---

## 5. Migration Path (v0.1 → v0.2)

### Phase 1: Architecture Design (Complete)
✅ Identify duplication problems
✅ Design MEL-based architecture
✅ Document FDR decisions

### Phase 2: SPEC Rewrite (Next)
- [ ] Write SPEC v0.2.0 as "Translator = MEL Domain"
- [ ] Define translator.mel schema structure
- [ ] Specify effect contracts
- [ ] Update API to `translate(text, app)`

### Phase 3: Proof of Concept
- [ ] Implement `action translate` in translator.mel
- [ ] Implement 2-3 effects (normalize, llm.propose)
- [ ] Test with simple input
- [ ] Validate trace generation

### Phase 4: Full Implementation
- [ ] Complete all actions (translate, resolve, learn)
- [ ] All effects
- [ ] Lexicon as computed
- [ ] Integration tests

### Phase 5: Migration Support
- [ ] Data migration from TranslatorState → Domain State
- [ ] Deprecation warnings
- [ ] Migration guide for users

---

## 6. Impact Assessment

### Code Reduction

| Component | v0.1.0 Lines | v0.2.0 Lines | Removed |
|-----------|-------------|--------------|---------|
| State types | ~320 | ~50 | ~270 |
| Actions (translate/resolve/learn) | ~641 | ~100 | ~541 |
| Pipeline stages | ~800 | ~200 | ~600 |
| Lexicon management | ~400 | ~250 | ~150 |
| **Total** | **~2,161** | **~600** | **~1,561 (72%)** |

### Effort Estimate

| Phase | Duration | Description |
|-------|----------|-------------|
| SPEC v0.2 | 1-2 days | Rewrite SPEC with MEL focus |
| Proof of Concept | 1-2 days | translator.mel + 2-3 effects |
| Full Implementation | 3-4 days | All actions + effects + tests |
| Migration Support | 1 day | Data migration + guide |
| **Total** | **6-9 days** | Complete rewrite |

### Benefits vs v0.1 Patch

| Approach | Effort | Code Removed | Architecture Fix |
|----------|--------|--------------|-----------------|
| **Patch v0.1** | 2-3 days | ~450 lines | ❌ Partial |
| **Rewrite v0.2** | 6-9 days | ~1,561 lines | ✅ Complete |

**Recommendation**: Rewrite v0.2 despite higher upfront cost.
- Long-term maintenance: v0.2 much simpler
- Architectural alignment: v0.2 correct, v0.1 fundamentally flawed
- Cognitive load: v0.2 clean, v0.1 accumulates patches

---

## 7. Updated Decision Log

### New Decisions (v0.2)

| ID | Decision | Rationale |
|----|----------|-----------|
| **FDR-TAPP-039** | Translator as Manifesto Domain | Alignment with Core/Host/World principles |
| **FDR-TAPP-040** | State Duplication Elimination | Single source of truth in World |
| **FDR-TAPP-041** | MEL-First Implementation | Domain logic as data, not code |
| **FDR-TAPP-042** | Effects-Only TypeScript | Clear boundary: external = TypeScript, internal = MEL |
| **FDR-TAPP-043** | Stateless Translator Pipeline | Determinism, testability, simplicity |

### Retained Decisions (Still Valid)

| ID | Decision | Notes |
|----|----------|-------|
| FDR-TAPP-001 | App contract only | **Now enforced** (was violated in v0.1) |
| FDR-TAPP-002 | LLM only in translate | Still valid (effect handler) |
| FDR-TAPP-003 | IntentBody is final | Still valid |
| FDR-TAPP-004 | Schema mode only | Still valid for v0.2 |
| FDR-TAPP-005 | IntentBody.type = resolved lemma | Still valid |
| FDR-TAPP-006~012 | Key system | Still valid (World computes) |
| FDR-TAPP-013~016 | Lexicon | Still valid (as computed) |
| FDR-TAPP-018~019 | Alias semantics | Still valid |
| FDR-TAPP-020~026 | Resolution/Learning | Still valid (as MEL actions) |
| FDR-TAPP-028~032 | ActionBody rules | Still valid |
| FDR-TAPP-035~038 | Type system, semantic space | Still valid |

---

## 8. Conclusion

**v0.1.0 Implementation Verdict**: Architecturally incompatible with Manifesto principles.

**Root Causes**:
1. TypeScript pipeline bypasses Core/Host/World
2. Separate state management bypasses World Protocol
3. FDR-TAPP-001 violated (not using App facade exclusively)

**v0.2.0 Resolution**: Complete architecture redesign.
- Translator = MEL Domain
- TypeScript = Effects only
- State = World-managed
- Governance = Authority-validated

**Trade-off**: Higher upfront cost (6-9 days) for correct architecture vs quick patch (2-3 days) that leaves fundamental problems.

**Decision**: Proceed with v0.2.0 rewrite.

---

**Prepared by**: Claude (Sonnet 4.5)
**Approved by**: [Pending architectural review]
**Status**: Draft (v0.2.0)

