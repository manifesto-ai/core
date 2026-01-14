# manifesto-ai-translator-app Foundational Design Rationale v0.1.0

> **Status:** Draft  
> **Version:** 0.1.0  
> **Date:** 2026-01-13  
> **Depends on:**
>   - Manifesto App Public API (v0.4.10)
>   - Intent IR (v0.1.0)

---

## 0. Scope of This Document

This FDR serves as the design constitution for **Intent IR-based Translator App redevelopment**.

**Core premises:**
- Legacy Translator (v1.1.1) is deprecated. Redevelopment based on Intent IR.
- Translator App's final output is **IntentBody**. MEL rendering is the responsibility of separate adapters/renderers.
- MVP first. Complex features deferred to future versions.

---

## 1. Non-negotiable Principles

### 1.1 App Contract Only

**FDR-TAPP-001: Translator App depends only on App contract**

Translator App integrates with external systems only through `@manifesto-ai/app` facade API.
Direct import or dependency on World/Host/Core/Memory layers is prohibited.

| Allowed | Prohibited |
|---------|-----------|
| `app.getDomainSchema()` | `world.getSnapshot()` |
| `app.act()` | `host.execute()` |
| `app.getState()` | `core.apply()` |

**Consequences:**
- App mock is sufficient for testing
- Lower stack changes do not propagate to Translator

### 1.2 Determinism Boundary

**FDR-TAPP-002: LLM is used only in translate stage**

| Stage | Determinism | Notes |
|-------|-------------|-------|
| PF → IntentIR | MAY non-deterministic | LLM usage |
| Validation | MUST deterministic | Schema check |
| Canonicalization | MUST deterministic | Structure normalization |
| Feature Checking | MUST deterministic | Lexicon lookup |
| Lowering | MUST deterministic | IntentBody generation |
| Reference Resolution | MUST deterministic | this/that/last → id |

This boundary aligns with Intent IR SPEC A8 Axiom.

---

## 2. Output Model

### 2.1 IntentBody as Final Output

**FDR-TAPP-003: Translator App's canonical output is IntentBody**

```
PF (Natural Language)
    ↓ translate (LLM)
IntentIR (Semantic Structure)
    ↓ lower (deterministic)
IntentBody (Protocol Intent)
    ↓ [Separate Adapter/Renderer]
MEL Text, PatchFragment, etc.
```

**Rationale:**
- IntentBody is the lowering result defined in Intent IR SPEC.
- MEL rendering, PatchFragment conversion are **outside Translator App scope**.
- For MVP, a simple adapter rendering entire schema to MEL is sufficient.

**Consequences:**
- Translator App is responsible only up to IntentBody.
- Downstream transformations are separated into distinct packages/adapters.

### 2.2 Schema Mode Only (v0.1)

**FDR-TAPP-004: v0.1 supports only schema editing**

| Mode | v0.1 | v0.2+ |
|------|------|-------|
| schema (type/field/action definition) | ✅ | ✅ |
| runtime (action invocation) | ❌ | Planned |
| query (data retrieval) | ❌ | Planned |

**Rationale:**
- MVP scope reduction
- Schema editing is the priority use case

### 2.3 IntentBody.type is Resolved Canonical Lemma

**FDR-TAPP-005: In v0.1 schema mode, IntentBody.type is the resolved canonical lemma**

| Lexicon Source | IntentBody.type |
|----------------|-----------------|
| Builtin lemma (`ADD_ACTION`) | `ADD_ACTION` (= ir.event.lemma) |
| Project lemma (`CREATE_TASK`) | `CREATE_TASK` (= ir.event.lemma) |
| Learned alias (`REGISTER` → `ADD_ACTION`) | `ADD_ACTION` (= targetLemma) |

**Rationale:**
- Lexicon's EventEntry lookup is lemma-based (`resolveEvent(lemma)`)
- learn functionality creates aliases: new lemma → existing targetLemma
- `IntentBody.type` is always the **resolved target** (canonical lemma in coordinate space)

**Consequences:**
- For builtin/project entries: `type == ir.event.lemma`
- For learned aliases: `type == targetLemma` (resolved through alias)
- This preserves "hippocampus = coordinate" design: new words map to existing coordinates

---

## 3. Key System (Semantic Coordinate)

### 3.1 Key Hierarchy

**FDR-TAPP-006: v0.1 defines two keys via Intent IR delegation; strictKey is deferred to v0.2+**

| Key | Derivation | Purpose | v0.1 |
|-----|------------|---------|------|
| `simKey` | `deriveSimKey(intentIR)` | Semantic similarity search, clustering (SimHash) | ✅ MUST (when IR exists) |
| `intentKey` | `deriveIntentKey(body, schemaHash)` | Protocol intent identity (JCS preimage hash) | ✅ MUST (on success) |
| `strictKey` | `deriveStrictKey(...)` | Reproduction cache key | ❌ v0.2+ |

**Rationale:**
- `strictKey` per Intent IR SPEC requires footprint, snapshot subsnapshot, and execution context
- v0.1 has no footprint/snapshot/memory, making strictKey computation impossible
- Key derivation MUST follow Intent IR SPEC exactly to ensure cross-implementation compatibility

### 3.2 simKey (Semantic Coordinate via SimHash)

**FDR-TAPP-007: simKey is derived via Intent IR's deriveSimKey()**

```typescript
// MUST: delegate to Intent IR SPEC
const simKey: SimKey = deriveSimKey(intentIR);  // bigint (64-bit)
const simKeyHex: SimKeyHex = serializeSimKey(simKey);  // for storage/transport
```

- Input: IntentIR (resolution not required)
- Algorithm: Intent IR SPEC (tokenization → SimHash)
- Internal type: `SimKey` (64-bit bigint)
- Storage/transport type: `SimKeyHex` (16-char lowercase hex)
- Purpose: Similar meaning search, clustering, transfer learning
- Property: **Preserves proximity** (similar IRs → similar simKeys, Hamming distance)

**Critical distinction:**
- simKey is NOT `SHA256(canonicalize(ir))` (identity hash)
- simKey is SimHash that **preserves semantic proximity**
- This is essential for "hippocampus = coordinate in semantic space"

### 3.3 simKey Serialization Convention

**FDR-TAPP-008: simKey storage uses fixed hex encoding**

```typescript
/** 64-bit unsigned SimHash as lowercase hex, 16 chars (zero-padded) */
type SimKeyHex = string;  // e.g., "0a1b2c3d4e5f6789"

// Serialization (MUST follow this convention)
function serializeSimKey(simKey: SimKey): SimKeyHex {
  return simKey.toString(16).padStart(16, '0');
}

// Deserialization
function deserializeSimKey(hex: SimKeyHex): SimKey {
  return BigInt('0x' + hex);
}
```

**Rationale:**
- BigInt cannot be directly serialized to JSON
- Without fixed encoding, implementations may diverge (decimal, uppercase, varying length)
- Hamming distance comparison requires consistent bit representation

### 3.4 simKey Availability

**FDR-TAPP-009: simKey is available only when IntentIR exists**

| Pipeline Stage | simKey Available |
|----------------|------------------|
| S1 (Normalize) fails | ❌ No IR |
| S2 (Propose) fails | ❌ No IR |
| S3+ (IR exists) | ✅ MUST compute |

**Rationale:**
- `deriveSimKey()` requires IntentIR as input
- Early failures (NORMALIZE_FAILED, IR_PROPOSAL_FAILED, IR_INVALID) have no IR
- "Coordinate emerges when meaning structure exists"

### 3.5 intentKey (Protocol Identity via JCS Preimage)

**FDR-TAPP-010: intentKey is derived via Intent IR's deriveIntentKey()**

```typescript
// MUST: delegate to Intent IR SPEC
intentKey = deriveIntentKey(body, schemaHash)
// Internal: [schemaHash, type, input, scopeProposal] → JCS → SHA-256
```

- Input: IntentBody + current schema hash
- Algorithm: Intent IR SPEC (JCS array preimage → SHA-256)
- Purpose: Stable identification for caching, deduplication, replay
- Storage: LoweringEvidence, TranslateRequest

**Critical distinction:**
- intentKey is NOT `hash(body + ':' + schemaHash)` (delimiter collision risk)
- intentKey uses JCS array serialization as preimage per Intent IR SPEC

### 3.6 schemaHash Acquisition

**FDR-TAPP-011: schemaHash is obtained from App, not computed arbitrarily**

```typescript
// schemaHash source (in priority order)
1. App hook payload (domain/schema events)
2. AppState.schemaHash
3. TranslatorState.schemaHash (cached from above)
```

**SHOULD NOT:** Compute schema hash independently using custom algorithm.

**Rationale:**
- Ensures intentKey consistency across all components
- Avoids hash divergence from different canonicalization implementations

### 3.7 strictKey Deferral

**FDR-TAPP-012: strictKey is deferred to v0.2+**

strictKey requires:
- ResolvedIntentIR (this/that/last → id)
- footprint (reads/writes/depends)
- snapshot subsnapshot
- execution context

These are unavailable in v0.1 scope.

---

## 4. Lexicon Model

### 4.1 Lexicon as Arbiter

**FDR-TAPP-013: Lexicon is the arbiter of "what constitutes valid lowering"**

Aligned with Intent IR SPEC §14.1:
> "Lexicon is the single interface for both feature checking and lowering."

Lexicon structure:
```typescript
type EventEntry = {
  eventClass: EventClass;
  thetaFrame: ThetaFrame;
  footprint?: Footprint;      // v0.2+
  policyHints?: PolicyHints;  // v0.2+
};
```

### 4.2 Composite Lexicon (3 Layers)

**FDR-TAPP-014: Lexicon is a 3-layer composite**

```
┌─────────────────────────────────────┐
│  Learned Lexicon (learned)          │  ← Added via learn action
├─────────────────────────────────────┤
│  Project Lexicon (schema-derived)   │  ← Can be empty
├─────────────────────────────────────┤
│  Builtin Operator Lexicon           │  ← Always present
└─────────────────────────────────────┘
```

**Lookup order:** Learned → Project → Builtin

**Builtin Operator Lexicon minimum lemmas:**
- `DEFINE_TYPE`, `ADD_FIELD`, `ADD_CONSTRAINT`
- `ADD_COMPUTED`
- `ADD_ACTION`, `ADD_ACTION_PARAM`, `ADD_ACTION_GUARD`

**Rationale:**
- Schema editing lowering must be possible even with empty project schema
- Builtin lemma list specified in SPEC, structure delegated to implementation

### 4.3 Cold Start Support

**FDR-TAPP-015: Lowering always produces a result even without Lexicon**

When Project Lexicon is empty:
1. Try Builtin Operator Lexicon
2. On mapping failure → Return **Provisional IntentBody** via `UnresolvedResult`
    - `partial.type = ir.event.lemma` (as-is)
    - `partial.input = { args, cond, ext }`
    - `missing = [{ kind: 'action_type', detail: 'No matching Lexicon entry' }]`

This is "execution feasibility undetermined" but "structurally valid result".

**Note:** Provisional IntentBody is returned as `UnresolvedResult.partial`, not as a separate result kind.

### 4.4 Intent IR Lexicon Interface Compliance

**FDR-TAPP-016: Translator App follows Intent IR Lexicon interface**

Intent IR SPEC Lexicon interface:
- `resolveEvent(lemma)` — Used
- `resolveActionType(lemma)` — Used (returns resolved targetLemma)
- `mapArgsToInput(args, cond)` — Used
- `resolveEntity(entityType)` — Unused in v0.1
- `deriveScopeProposal?(ir)` — Unused in v0.1

**Rationale:**
- Backward compatibility and Intent IR ecosystem alignment
- resolveEntity etc. may be used in v0.2+

---

## 5. Learning Model

### 5.1 Pending Mappings

**FDR-TAPP-017: Temporary lexical candidates are stored in State**

```typescript
type PendingMapping = {
  id: string;
  lemma: string;
  candidateTargetLemma: string;  // Key: lemma-based
  confidence: number;
  source: 'llm' | 'user' | 'inferred';
  requestId: string;
  createdAt: string;
};
```

**Rationale:**
- Maintain pre-learning candidates without Memory system
- `candidateTargetLemma` ensures consistency with Lexicon lookup

### 5.2 Learn Action and resolveEvent Guarantee

**FDR-TAPP-018: learn must guarantee resolveEvent**

```
translate → Store candidate in pendingMappings
    ↓
User confirmation/correction
    ↓
learn → Update Learned Lexicon
    ↓
Next translate:
  - resolveActionType(lemma) → targetLemma ✅
  - resolveEvent(lemma) → target's EventEntry ✅
```

**Rationale:**
- Feature check stage fails if `resolveEvent(lemma)` returns undefined
- If learn only stores actionType, feature check cannot pass

**Implementation strategies (both allowed):**

| Strategy | Storage Format | resolveEvent Behavior |
|----------|---------------|----------------------|
| **Alias** (recommended) | `{ lemma, targetLemma }` | Re-lookup via targetLemma |
| **Clone** | `{ lemma, entry, actionType }` | Return stored entry |

### 5.3 Alias Semantics and Coordinate Mapping

**FDR-TAPP-019: Alias maps new words to existing semantic coordinates**

When learn creates alias `REGISTER → ADD_ACTION`:
- `resolveActionType("REGISTER")` returns `"ADD_ACTION"` (targetLemma)
- `resolveEvent("REGISTER")` returns ADD_ACTION's EventEntry
- `IntentBody.type` becomes `"ADD_ACTION"` (resolved canonical lemma)

**Rationale:**
- Alias is "attaching new vocabulary to existing coordinate in semantic space"
- This aligns with hippocampus design: vocabulary grows, coordinate space is stable

---

## 6. Resolver Model

### 6.1 Discourse Reference Resolution

**FDR-TAPP-020: Resolver references recent N requests**

| Setting | Default | Range |
|---------|---------|-------|
| `resolverContextDepth` | 5 | 1-20 |

### 6.2 Intent IR EntityRef.kind Alignment

**FDR-TAPP-021: Resolver follows Intent IR EntityRef.kind**

Intent IR SPEC EntityRef.kind:
- `"this"` — Current context
- `"that"` — Previous mention
- `"last"` — Most recent
- `"id"` — Concrete ID (no resolution needed)

**Resolution target:** Only when `kind !== 'id'`

### 6.3 Resolution Results Separated from IR

**FDR-TAPP-022: Resolution records are managed separately, not injected into IntentIR**

```typescript
// ❌ Anti-pattern: Inject non-standard fields into IR
type ResolvedIR = IntentIR & { _resolved: true; _resolutions: [...] };

// ✅ Recommended: Separation
type ResolveStageOutput = {
  ir: IntentIR;                    // Pure IR (ref.kind replaced with 'id')
  resolutions: ResolutionRecord[]; // Separate record
};
```

**Rationale:**
- IntentIR is subject to canonicalization/key derivation
- Non-standard fields may violate schema validation
- Intent IR extension rules allow only namespaced `ext`

### 6.4 Full IR Term Traversal

**FDR-TAPP-023: Resolver traverses all Terms in IR, including cond**

Resolution scope:
- `args[role]` — All entity ref terms in arguments
- `cond[].rhs` — All entity ref terms in condition RHS

**Rationale:**
- Intent IR allows entity refs in condition predicates
- Symbolic refs anywhere in IR must be deterministically resolved

---

## 7. Human Escalation

### 7.1 Ambiguity Handling

**FDR-TAPP-024: Ambiguity and Unresolved are first-class results**

Lowering result:
```typescript
type LoweringResult = 
  | { kind: 'resolved'; body: IntentBody }
  | { kind: 'ambiguous'; candidates: [...]; reason: string }
  | { kind: 'unresolved'; partial: Partial<IntentBody>; missing: [...] };
```

### 7.2 HITL Policy

**FDR-TAPP-025: Agent auto-resolve is SHOULD NOT; explicit conflict is MUST NOT**

| Situation | Policy |
|-----------|--------|
| General ambiguity | SHOULD NOT auto-resolve |
| Explicit conflict (security, destructive operation) | MUST NOT auto-resolve |

**"Explicit conflict" definition:**
- `policyHints.destructive = true`
- `policyHints.requiresAuth = true`
- Multiple candidates with different write footprints

### 7.3 Resolve Scope

**FDR-TAPP-026: resolve handles both ambiguous and unresolved**

| result.kind | Allowed resolution |
|-------------|-------------------|
| `ambiguous` | `select`, `cancel` |
| `unresolved` | `provide`, `cancel` |

**Rationale:**
- Single action converges both states
- MVP UX simplification

---

## 8. Trace

### 8.1 Trace is Recommended

**FDR-TAPP-027: Trace is SHOULD**

Each translate request should be able to generate trace:
- raw PF
- proposed IntentIR
- canonical IR + simKey (when available)
- feature-check result
- resolution records (separate)
- lowering result + intentKey

**Rationale:**
- Mandatory enforcement in MVP increases implementation burden
- SHOULD, but essential for debugging/learning

---

## 9. Action Body Rules

### 9.1 AST-based Structure Validation

**FDR-TAPP-028: Action Body is expressed as AST and validated before MEL rendering**

```typescript
type ActionBody = {
  blocks: GuardedBlock[];
};
```

**Rationale:**
- Translator App does not output MEL
- MEL compliance rules can be validated at AST level

### 9.2 Guard Required

**FDR-TAPP-029: patch/effect must be inside guard**

### 9.3 once(marker) Rules

**FDR-TAPP-030: once is per-intent idempotency**

| Rule | Description |
|------|-------------|
| once(marker) interpretation | `when neq(marker, $meta.intentId)` |
| marker patch required | First in body: `patch marker = $meta.intentId` |
| marker patch value | MUST be `{ kind: 'sys', path: ['meta', 'intentId'] }` |

### 9.4 once+when Pattern

**FDR-TAPP-031 (Informative): once(marker) when cond pattern**

`once(marker) when cond` is expressed by **nesting once block inside when block**:

```typescript
{
  guard: { kind: 'when', condition: cond },
  body: [{
    kind: 'nested',
    block: {
      guard: { kind: 'once', marker: 'marker' },
      body: [
        { kind: 'patch', path: ['marker'], value: { kind: 'sys', path: ['meta', 'intentId'] } },
        // ... rest
      ]
    }
  }]
}
```

### 9.5 $system Usage Restriction

**FDR-TAPP-032: $system.* is allowed only in action body**

| Context | $system allowed |
|---------|-----------------|
| action body | ✅ |
| computed expr | ❌ |
| state initializer | ❌ |

---

## 10. Temporal Hinting (Addendum)

### 10.1 Motivation

**FDR-TAPP-035: pathKey is a feature-flagged addendum for temporal trajectory hints**

simKey provides **spatial** coordinate (semantic proximity). However, for hippocampus-style association:
- "What similar things were said" (simKey ✅)
- "How did the user arrive here" (trajectory ❌)

pathKey fills this gap by summarizing the **trajectory** as a rolling hash chain.

### 10.2 Design Constraints

**Why feature-flagged?**
- MVP stability: v0.1 is already GO without temporal hints
- Implementation burden: rolling hash requires state management
- Opt-in complexity: not all use cases benefit from trajectory tracking

**Why rolling hash (not array of simKeys)?**
- Storage efficiency: 64-byte digest vs N × 16 bytes
- Privacy: individual intents cannot be extracted from pathKey
- Determinism: same inputs always produce same pathKey

**Why include resolvedLemma in preimage?**
- Distinguishes same-coordinate arrivals with different outcomes
- Example: two requests with identical simKey but one resolved, one unresolved

### 10.3 Critical Boundaries

pathKey MUST NOT affect:
- simKey (spatial coordinate)
- intentKey (protocol identity)
- Lexicon feature checking
- Lowering results

This ensures the semantic layer remains pure; pathKey is purely for retrieval optimization.

---

## 11. Non-goals (v0.1)

| Item | Status | Notes |
|------|--------|-------|
| Memory integration | ❌ | Replaced by pendingMappings |
| Runtime action intent | ❌ | v0.2 |
| Query intent | ❌ | v0.2+ |
| footprint/policyHints surfacing | ❌ | v0.2 |
| Non-monotonic schema changes | ❌ | delete/rename etc. |
| resolveEntity usage | ❌ | v0.2 |
| deriveScopeProposal usage | ❌ | v0.2 |
| strictKey computation | ❌ | v0.2+ (requires footprint/snapshot/context) |

---

## 12. Decision Log Summary

| ID | Decision | Rationale |
|----|----------|-----------|
| FDR-TAPP-001 | App contract only | Reduce coupling, ease testing |
| FDR-TAPP-002 | LLM only in translate | Intent IR A8 alignment |
| FDR-TAPP-003 | IntentBody is final | MEL conversion is adapter responsibility |
| FDR-TAPP-004 | Schema mode only | MVP scope reduction |
| FDR-TAPP-005 | IntentBody.type = resolved canonical lemma | Alias compatibility, coordinate stability |
| FDR-TAPP-006 | Key derivation via Intent IR delegation | Cross-implementation compatibility |
| FDR-TAPP-007 | simKey via deriveSimKey() (SimHash) | Preserve semantic proximity for similarity search |
| FDR-TAPP-008 | SimKeyHex (16-char lowercase hex) | JSON-safe storage, consistent Hamming distance |
| FDR-TAPP-009 | simKey available only when IR exists | Early failures have no coordinate |
| FDR-TAPP-010 | intentKey via deriveIntentKey() (JCS preimage) | Avoid delimiter collision |
| FDR-TAPP-011 | schemaHash from App | Ensure cross-component consistency |
| FDR-TAPP-012 | strictKey deferred | Requires footprint/snapshot/context |
| FDR-TAPP-013 | Lexicon as arbiter | Intent IR §14.1 alignment |
| FDR-TAPP-014 | 3-layer Composite Lexicon | Cold start support |
| FDR-TAPP-015 | Provisional via UnresolvedResult | Lowering always returns result |
| FDR-TAPP-016 | Intent IR Lexicon interface compliance | Backward compatibility |
| FDR-TAPP-017 | candidateTargetLemma usage | Lexicon lookup consistency |
| FDR-TAPP-018 | learn guarantees resolveEvent | Feature check pass |
| FDR-TAPP-019 | Alias = coordinate mapping | Vocabulary growth with stable coordinates |
| FDR-TAPP-020 | Resolver context 5 default | Adjustable via option |
| FDR-TAPP-021 | EntityRef.kind alignment | Intent IR SPEC compliance |
| FDR-TAPP-022 | Resolution records separated | IR purity |
| FDR-TAPP-023 | Full IR traversal (args + cond) | Complete symbolic resolution |
| FDR-TAPP-024 | Ambiguity is first-class result | Not error but normal branch |
| FDR-TAPP-025 | HITL SHOULD, conflict MUST | Security/destructive operation protection |
| FDR-TAPP-026 | resolve handles both states | UX simplification |
| FDR-TAPP-027 | Trace SHOULD | MVP burden reduction |
| FDR-TAPP-028 | AST-based validation | Validation possible without MEL |
| FDR-TAPP-029 | Guard required | MEL alignment |
| FDR-TAPP-030 | once = per-intent, marker value enforced | Re-entry prevention |
| FDR-TAPP-031 | once+when nesting pattern | Implementation guide |
| FDR-TAPP-032 | $system action only | MEL alignment |
| FDR-TAPP-033 | lower includes S7 validation | Consistent pipeline coverage |
| FDR-TAPP-034 | resolve(provide) recalculates simKey | Coordinate consistency after IR modification |
| FDR-TAPP-035 | pathKey is feature-flagged addendum | Temporal trajectory hint without affecting identity |

---

## Cross-Reference

| Related Document | Referenced Items |
|------------------|-----------------|
| Intent IR SPEC v0.1.0 | §13 Lowering, §14 Feature Checking, A8 Axiom, EntityRef.kind, Key System (deriveSimKey, deriveIntentKey), SimKey type |
| Intent IR FDR v0.1.0 | FAD-INT-001, FDR-INT-010 |
| App SPEC v0.4.10 | §6 getDomainSchema, READY-1a, schemaHash |
| MEL Compiler FDR | FDR-MEL-027 (once), FDR-MEL-044 (marker) |

---

*End of FDR v0.1.0*
