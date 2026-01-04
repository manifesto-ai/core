# @manifesto-ai/translator Functional Design Rationale

This document explains the **why** behind Translator's design decisions.

---

## FDR-T001: World as Premise (INV-009)

### Decision

Translator CANNOT operate without World context.

### Context

Early designs allowed Translator to operate with just a schema:

```typescript
// Early design (rejected)
const translator = createTranslator({ schema });
const result = await translator.translate("Add field");
```

### Rationale

**Schema alone is insufficient for safe translation:**

1. **No Actor Identity**: Without World, who is making the request?
2. **No Event History**: Without events, no context for translation
3. **No Authority Check**: Without World, no governance
4. **No Schema Versioning**: Schema could be stale

**World provides the complete context:**

```typescript
World = {
  worldId: "unique-identity",
  schema: { ... },
  actor: { ... },
  events: [ ... ],
  authorities: [ ... ],
}
```

### Consequences

- Translator requires `worldId` parameter
- Cannot be used in isolation for "quick tests"
- Forces integration with World Protocol
- Enables full audit trail

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Optional World | Leads to "works without governance" anti-pattern |
| Implicit World | Magic context is unpredictable |
| Schema + Actor | Missing event history and authority |

---

## FDR-T002: Memory as Default (INV-010)

### Decision

Absence of Memory triggers graceful degradation, NOT failure.

### Context

Memory provides context for better translation:
- Translation examples (few-shot)
- Schema history
- Glossary terms
- Resolution preferences

What happens when Memory is unavailable?

### Rationale

**Memory should enhance, not gate:**

```typescript
// Bad: Memory required
if (!memory) {
  throw new Error("Memory required");  // ❌ Blocks usage
}

// Good: Memory optional with degradation
if (!memory) {
  return {
    content: EMPTY_CONTENT,
    degraded: true,
    degradeReason: "SELECTOR_NOT_CONFIGURED",
  };  // ✅ Works, less optimally
}
```

**Progressive enhancement model:**

| Memory Available | Behavior |
|------------------|----------|
| Full | Best translation quality |
| Partial | Reduced quality, works |
| None | Basic translation, works |

### Consequences

- Translation works without Memory setup
- Quality improves as Memory is added
- Degradation is observable (flags in result)
- No hard dependency on Memory infrastructure

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Required Memory | Blocks basic usage, complex setup |
| Silent fallback | Hides quality issues |
| Hard failure | Poor developer experience |

---

## FDR-T003: Human Escalation is Constitutional (INV-011)

### Decision

Agent auto-resolve is FORBIDDEN. Human escalation is a constitutional right.

### Context

When Translator detects ambiguity, who resolves it?

```typescript
// Ambiguity detected
// "Add field" → Which type? Which field name?
```

### Rationale

**The AI governance problem:**

If AI can auto-resolve ambiguity, it effectively makes decisions on behalf of humans. This violates the core Manifesto principle:

> "LLM is an untrusted proposer. Human is the judge."

**Constitutional protection:**

```typescript
// FORBIDDEN: Agent decides
if (ambiguous) {
  const choice = await llm.decide();  // ❌ Agent is judge
  resolve(choice);
}

// REQUIRED: External decision
if (ambiguous) {
  status = "awaiting_resolution";
  // External system (HITL or governed AITL) decides
}
```

**Who CAN resolve:**
- Human (HITL)
- Governed AI tribunal (AITL with constitutional rules)
- Consensus mechanism

**Who CANNOT resolve:**
- The same LLM that proposed
- Any ungovern AI

### Consequences

- Translator transitions to `awaiting_resolution` state
- External system must call `resolve()`
- Resolution mechanism is pluggable
- Audit trail of all resolutions

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Auto-resolve with high confidence | Still AI making human decisions |
| Retry with different prompt | Doesn't address fundamental ambiguity |
| Pick first option | Random behavior |

---

## FDR-T004: 6-Stage Pipeline

### Decision

Translation uses a fixed 6-stage pipeline.

### Context

How should natural language be transformed to fragments?

### Rationale

**Stages provide clear boundaries:**

```
0. Chunking     → Split input into manageable pieces
1. Normalization → Canonicalize text, detect language
2. Fast Path    → Deterministic pattern matching
3. Retrieval    → Schema anchor lookup
4. Memory       → Context from history
5. Proposer     → LLM-based generation
6. Assembly     → Combine and validate
```

**Each stage has single responsibility:**

| Stage | In | Out | Pure? |
|-------|-----|-----|-------|
| Chunk | text | chunks | Yes |
| Normalize | chunks | canonical | Yes |
| Fast Path | canonical | matches? | Yes |
| Retrieval | canonical | anchors | No (IO) |
| Memory | anchors | content | No (IO) |
| Proposer | content | fragments | No (LLM) |
| Assembly | fragments | validated | Yes |

**Benefits:**
- Debuggable: each stage has observable output
- Skippable: Fast Path can bypass LLM stages
- Testable: pure stages test without mocks
- Traceable: full pipeline trace available

### Consequences

- Fixed pipeline structure (not configurable)
- Each stage as effect handler
- Stage results stored in state
- Fast Path optimization path

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Single LLM call | No observability, no fast path |
| Configurable pipeline | Too complex, unpredictable |
| Streaming pipeline | Harder to debug, trace |

---

## FDR-T005: State Machine Approach

### Decision

Translator is implemented as a Manifesto state machine.

### Context

How should pipeline state be managed?

### Rationale

**Dogfooding Manifesto:**

Translator itself is a Manifesto App:

```mel
domain Translator {
  state {
    status: "idle" | "chunking" | ... | "success" | "error"
    // ... stage results
  }

  action translate(input) available when isIdle { ... }
  action resolve(reportId, optionId) available when hasAmbiguity { ... }
}
```

**Benefits of state machine:**
- Observable: subscribe to state changes
- Resumable: state persisted in Snapshot
- Debuggable: replay entire translation
- Governable: World Protocol applies

**State transitions are explicit:**

```
idle → chunking → normalizing → fast_path
                                   ↓
         ┌─────── (matched) ───────┤
         ↓                         ↓
    assembling           retrieval → memory → proposing
         ↓                                        ↓
      success                              assembling
                                               ↓
                                            success
```

### Consequences

- Translator defined in MEL
- Uses Host effect system
- State stored as JSON in Snapshot
- Subscriptions for UI updates

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Async function | No state persistence, no subscription |
| Stream/Observable | More complex, less debuggable |
| Custom state management | Reinventing Manifesto |

---

## FDR-T006: Fast Path Optimization

### Decision

Deterministic pattern matching before LLM stages.

### Context

LLM calls are expensive (latency, cost). Many translations are simple patterns.

### Rationale

**Common patterns are deterministic:**

```typescript
// Pattern: "add X field to Y"
// Result: addField(Y, X)

// Pattern: "create X action"
// Result: addAction(X)

// Pattern: "set X default to Y"
// Result: setDefaultValue(X, Y)
```

**Fast Path benefits:**
- ~0ms latency (no LLM call)
- $0 cost (no API call)
- Deterministic (same input → same output)
- Works offline

**When Fast Path applies:**

```
Input → Pattern Match → (matched?) → Skip to Assembly
                              ↓
                         (no match)
                              ↓
                    Continue to Retrieval
```

### Consequences

- Pattern library in Translator
- Fast Path stage before Retrieval
- `fastPathOnly` config option
- Fallback to LLM if no match

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Always use LLM | Wasteful for simple patterns |
| Cache LLM results | Stale cache, storage overhead |
| Client-side patterns only | Inconsistent results |

---

## FDR-T007: Confidence Scoring

### Decision

Every fragment has a confidence score (0.0 - 1.0).

### Context

How confident is the Translator in its output?

### Rationale

**Confidence enables policy:**

```typescript
const policy = {
  autoAcceptThreshold: 0.95,  // Accept if >= 95%
  rejectThreshold: 0.3,       // Reject if < 30%
  // 30-95%: Human review
};
```

**Confidence sources:**
- Pattern match: 1.0 (deterministic)
- LLM with examples: 0.7-0.9
- LLM without examples: 0.5-0.7
- Ambiguous: 0.3-0.5

**Benefits:**
- Automated triage
- Risk-based review
- Observable uncertainty
- Governance integration

### Consequences

- `confidence` field on PatchFragment
- Policy-based routing
- Trace includes confidence explanation
- Escalation at low confidence

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Binary pass/fail | No nuance, no triage |
| LLM self-reported | Unreliable calibration |
| No confidence | No automated triage |

---

## FDR-T008: Fragment Immutability

### Decision

PatchFragments are immutable once created.

### Context

Can fragments be modified after generation?

### Rationale

**Immutability enables:**
- Audit trail (fragments never change)
- Safe sharing (no defensive copies)
- Caching (hash-based lookup)
- Replay (deterministic)

**Fragment lifecycle:**

```
Created → Validated → Applied → Archived
          ↓ (invalid)
        Rejected
```

Fragments are never mutated. New fragments are created if changes needed.

### Consequences

- `fragmentId` is content-addressed
- No "update fragment" operation
- Resolution creates new fragments
- Full history preserved

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Mutable fragments | No audit trail |
| Edit-in-place | Race conditions |
| Draft/final states | Complexity |

---

## Summary

| FDR | Decision | Key Rationale |
|-----|----------|---------------|
| T001 | World as Premise | Schema alone insufficient |
| T002 | Memory as Default | Enhance, don't gate |
| T003 | Human Escalation | Constitutional protection |
| T004 | 6-Stage Pipeline | Clear boundaries, debuggable |
| T005 | State Machine | Dogfooding Manifesto |
| T006 | Fast Path | Deterministic optimization |
| T007 | Confidence Scoring | Policy-based triage |
| T008 | Fragment Immutability | Audit trail, replay |

---

*End of @manifesto-ai/translator FDR*
