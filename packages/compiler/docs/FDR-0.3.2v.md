# MEL (Manifesto Expression Language) — Foundational Design Rationale (FDR)

> **Version:** 0.3.2  
> **Status:** Normative  
> **Purpose:** Document the "Why" behind every major design decision in MEL  
> **Changelog:**
> - v0.2: AI-Native design principles and reviewer feedback integration
> - v0.2.1: Manifesto Host Contract alignment, Guard-mandatory effects, Canonical form
> - v0.2.2: Per-intent idempotency, Record effects, Deterministic semantics, Template literal removal
> - v0.2.3: Semantic closure completion, eq/neq normative rules, IR completeness, Scope rules
> - v0.2.4: IR unification (call-only), $ prefix reservation, eq/neq primitive-only, deterministic system values
> - v0.2.5: Document consistency fixes, evaluation order specification, effect signature normalization
> - v0.3.0: System values as effects, compiler-inserted lowering, snapshot-based replay
> - v0.3.1: Stable release — __sys__ namespace, intent-based readiness, architecture review passed
> - **v0.3.2: Core alignment — available, fail, stop (halt renamed), call policy**

---

## Table of Contents

### Part I: Foundation
1. [FDR-MEL-001: Why Not Use SWC/Babel](#fdr-mel-001-why-not-use-swcbabel)
2. [FDR-MEL-002: 80% JavaScript Compatibility](#fdr-mel-002-80-javascript-compatibility)
3. [FDR-MEL-003: Explicit Keywords](#fdr-mel-003-explicit-keywords)

### Part II: Control Flow & Effects
4. [FDR-MEL-004: when Keyword](#fdr-mel-004-when-keyword)
5. [FDR-MEL-005: patch Keyword](#fdr-mel-005-patch-keyword)
6. [FDR-MEL-006: effect Keyword](#fdr-mel-006-effect-keyword)

### Part III: Expressions & Types
7. [FDR-MEL-007: Expression Syntax](#fdr-mel-007-expression-syntax)
8. [FDR-MEL-008: Type System](#fdr-mel-008-type-system)
9. [FDR-MEL-009: Literal Types](#fdr-mel-009-literal-types)
10. [FDR-MEL-010: Collection Types](#fdr-mel-010-collection-types)
11. [FDR-MEL-011: Error Handling](#fdr-mel-011-error-handling)

### Part IV: AI-Native Design (v0.2)
12. [FDR-MEL-012: AI-Native Philosophy](#fdr-mel-012-ai-native-philosophy)
13. [FDR-MEL-013: No Methods Principle](#fdr-mel-013-no-methods-principle)
14. [FDR-MEL-014: len() Function](#fdr-mel-014-len-function)
15. [FDR-MEL-015: Explicit Effect Variables](#fdr-mel-015-explicit-effect-variables)
16. [FDR-MEL-016: once() Syntactic Sugar](#fdr-mel-016-once-syntactic-sugar)
17. [FDR-MEL-017: Minimal Grammar Surface](#fdr-mel-017-minimal-grammar-surface)
18. [FDR-MEL-018: No Nested Effects](#fdr-mel-018-no-nested-effects)
19. [FDR-MEL-019: Effect Composition](#fdr-mel-019-effect-composition)

### Part V: Host Contract Alignment (v0.2.1)
20. [FDR-MEL-020: Guard-Mandatory Effects](#fdr-mel-020-guard-mandatory-effects)
21. [FDR-MEL-021: Explicit once() Marker](#fdr-mel-021-explicit-once-marker)
22. [FDR-MEL-022: Patch Operations](#fdr-mel-022-patch-operations)
23. [FDR-MEL-023: Effect into: Path](#fdr-mel-023-effect-into-path)
24. [FDR-MEL-024: Canonical Expression Form](#fdr-mel-024-canonical-expression-form)
25. [FDR-MEL-025: Boolean-Only Conditions](#fdr-mel-025-boolean-only-conditions)
26. [FDR-MEL-026: len() Array-Only](#fdr-mel-026-len-array-only)

### Part VI: Semantic Closure (v0.2.2)
27. [FDR-MEL-027: Per-Intent Idempotency](#fdr-mel-027-per-intent-idempotency)
28. [FDR-MEL-028: Record Effects](#fdr-mel-028-record-effects)
29. [FDR-MEL-029: Deterministic Semantics](#fdr-mel-029-deterministic-semantics)
30. [FDR-MEL-030: No Template Literals](#fdr-mel-030-no-template-literals)
31. [FDR-MEL-031: Iteration Variable IR](#fdr-mel-031-iteration-variable-ir)
32. [FDR-MEL-032: Dynamic Path Segments](#fdr-mel-032-dynamic-path-segments)
33. [FDR-MEL-033: Effect Result Contract](#fdr-mel-033-effect-result-contract)

### Part VII: Specification Completeness (v0.2.3)
34. [FDR-MEL-034: Equality Semantics](#fdr-mel-034-equality-semantics)
35. [FDR-MEL-035: Universal Index Access](#fdr-mel-035-universal-index-access)
36. [FDR-MEL-036: Scope Resolution Order](#fdr-mel-036-scope-resolution-order)
37. [FDR-MEL-037: System Value Stability](#fdr-mel-037-system-value-stability) *(Superseded by v0.3.0)*
38. [FDR-MEL-038: Sort Determinism](#fdr-mel-038-sort-determinism)
39. [FDR-MEL-039: Complete IR Specification](#fdr-mel-039-complete-ir-specification)

### Part VIII: Implementation Convergence (v0.2.4-v0.2.5)
40. [FDR-MEL-040: Call-Only IR](#fdr-mel-040-call-only-ir)
41. [FDR-MEL-041: Dollar Prefix Reservation](#fdr-mel-041-dollar-prefix-reservation)
42. [FDR-MEL-042: Primitive-Only Equality](#fdr-mel-042-primitive-only-equality)
43. [FDR-MEL-043: Deterministic System Values](#fdr-mel-043-deterministic-system-values) *(Superseded by v0.3.0)*
44. [FDR-MEL-044: Once Marker Enforcement](#fdr-mel-044-once-marker-enforcement)
45. [FDR-MEL-045: Dollar Complete Prohibition](#fdr-mel-045-dollar-complete-prohibition)
46. [FDR-MEL-046: Evaluation Order Specification](#fdr-mel-046-evaluation-order-specification)
47. [FDR-MEL-047: Effect Write Target Normalization](#fdr-mel-047-effect-write-target-normalization)
48. [FDR-MEL-048: Index Access IR Normalization](#fdr-mel-048-index-access-ir-normalization)

### Part IX: System Value Semantics (v0.3.0)
49. [FDR-MEL-049: System Values as Effects](#fdr-mel-049-system-values-as-effects)
50. [FDR-MEL-050: Single System Effect](#fdr-mel-050-single-system-effect)
51. [FDR-MEL-051: Compiler-Inserted Lowering](#fdr-mel-051-compiler-inserted-lowering)
52. [FDR-MEL-052: System Value Deduplication](#fdr-mel-052-system-value-deduplication)
53. [FDR-MEL-053: Snapshot-Based Replay](#fdr-mel-053-snapshot-based-replay)
54. [FDR-MEL-054: System Value Scope Restrictions](#fdr-mel-054-system-value-scope-restrictions)

### Part X: Implementation Safety (v0.3.1)
55. [FDR-MEL-055: Reserved __sys__ Namespace](#fdr-mel-055-reserved-__sys__-namespace)
56. [FDR-MEL-056: Intent-Based Readiness Guards](#fdr-mel-056-intent-based-readiness-guards)
57. [FDR-MEL-057: Architecture Review Certification](#fdr-mel-057-architecture-review-certification)

### Part XI: Core Alignment (v0.3.2)
58. [FDR-MEL-058: Action Availability Conditions](#fdr-mel-058-action-availability-conditions)
59. [FDR-MEL-059: Fail as FlowNode](#fdr-mel-059-fail-as-flownode)
60. [FDR-MEL-060: Stop Semantics (halt renamed)](#fdr-mel-060-stop-semantics-halt-renamed)
61. [FDR-MEL-061: Call Exposure Policy](#fdr-mel-061-call-exposure-policy)
62. [FDR-MEL-062: Primitive Aggregation Functions](#fdr-mel-062-primitive-aggregation-functions)

### Summary
63. [Summary: The MEL Identity](#summary-the-mel-identity)
64. [Appendix: Decision Dependency Graph](#appendix-decision-dependency-graph)
65. [Appendix: v0.3.1 to v0.3.2 Changes](#appendix-v031-to-v032-changes)

---

# Part IX: System Value Semantics (v0.3.0)

This part documents the fundamental redesign of system values in MEL v0.3.0. The core insight is that **system values are IO operations**, and treating them as "special expressions" violated MEL's foundational principle that **all information flows through Snapshot**.

---

## FDR-MEL-049: System Values as Effects

### Decision

**System values (`$system.*`) are conceptually IO operations and MUST be treated as Effects, not expressions.**

### Context

v0.2.x treated `$system.uuid`, `$system.time.now`, etc. as "special expressions" that magically produced values:

```mel
// v0.2.x: Looks like an expression, but is actually IO
patch tasks[$system.uuid] = {
  id: $system.uuid,  // Different value? Same value? Unclear.
  createdAt: $system.time.now
}
```

This design had fundamental problems:

1. **Semantic Inconsistency**: Core was supposed to be pure, but `$system.*` injected non-determinism
2. **Unclear Semantics**: What happens when `$system.uuid` is used twice?
3. **Replay Complexity**: Required separate "trace" mechanism for system values
4. **Hidden Execution**: IO happened invisibly, violating "no hidden execution paths"

### The Manifesto Principle

```
"Core는 순수해야 해" — The Core MUST be pure.

All information enters Core via Snapshot.
All IO is executed by Host via Effects.
There are no exceptions.
```

### v0.3.0 Model

```
┌─────────────────────────────────────────────────────────────┐
│  v0.2.x Model (BROKEN)                                      │
│                                                             │
│  Core Expression Evaluation                                 │
│       │                                                     │
│       ├── $system.uuid ──► ??? (magic value appears)        │
│       └── $system.time.now ──► ??? (where from?)            │
│                                                             │
│  Problem: IO inside Core. Purity violated.                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  v0.3.0 Model (CORRECT)                                     │
│                                                             │
│  1. Compiler sees $system.uuid                              │
│       │                                                     │
│       ▼                                                     │
│  2. Compiler inserts: effect system.get({ key: "uuid" })    │
│       │                                                     │
│       ▼                                                     │
│  3. Host executes effect, patches result into Snapshot      │
│       │                                                     │
│       ▼                                                     │
│  4. Core reads from Snapshot (pure!)                        │
│                                                             │
│  All IO flows through Effects. Core remains pure.           │
└─────────────────────────────────────────────────────────────┘
```

### Why This Matters

| Aspect | v0.2.x | v0.3.0 |
|--------|--------|--------|
| Core purity | ❌ Violated | ✅ Preserved |
| IO visibility | Hidden | Explicit (effect) |
| Replay | Trace + Snapshot | Snapshot only |
| Multiple access | Ambiguous | Deduplicated |
| Semantic consistency | Exception-based | Uniform |

### Consequences

| Enables | Constrains |
|---------|------------|
| True Core purity | Compiler must transform $system.* |
| Natural deduplication | Cannot use $system.* in computed |
| Snapshot-only replay | Slightly more complex lowering |
| Uniform IO model | |

### Canonical Statement

> **System values are IO. IO is Effect. Effects are executed by Host. Results enter Core via Snapshot. Core remains pure.**

---

## FDR-MEL-050: Single System Effect

### Decision

**There is exactly ONE effect for all system values: `system.get`.**

### Context

The naive approach would be to create separate effects for each system value:

```mel
// ❌ REJECTED: Effect explosion
effect system.uuid({ into: id })
effect system.time({ into: now })
effect system.random({ into: r })
effect system.env({ name: "NODE_ID", into: nodeId })
// ... endless growth
```

This violates MEL's "minimal surface" principle and creates maintenance burden.

### The Single Effect Design

```mel
// ✅ v0.3.0: One effect, extensible keys
effect system.get({
  key: <StringLiteral>,    // "uuid", "time.now", "env.NODE_ID", etc.
  into: <Path>             // Snapshot destination
})
```

### Signature Definition

```typescript
/**
 * Effect: system.get
 * 
 * Retrieves a system-provided value and stores it in Snapshot.
 * This is the ONLY way system values enter Core computation.
 */
effect system.get({
  key: StringLiteral,      // Compile-time known, dot-notation
  into: Path               // Must be valid Snapshot write path
})
```

### Standard Keys (Normative)

| Key | Type | Description | Example |
|-----|------|-------------|---------|
| `"uuid"` | `string` | Fresh UUIDv4 | `"550e8400-..."` |
| `"time.now"` | `number` | Current timestamp (ms) | `1704067200000` |
| `"random"` | `number` | Random number [0, 1) | `0.7234...` |
| `"env.<NAME>"` | `string \| null` | Environment variable | `"production"` |

### Extensibility

```
EXTENSION MODEL:

1. New system values = new keys, not new effects
2. Host defines which keys are supported
3. Unknown key → null result
4. No language changes required for extensions

Example: Adding a new "session.id" system value
  - Host implements: system.get("session.id") → session ID
  - Developer writes: $system.session.id
  - Compiler lowers: effect system.get({ key: "session.id", into: ... })
  - No MEL spec changes needed!
```

### Why Single Effect?

1. **Minimal Grammar**: One effect instead of N
2. **Open-Ended**: New system values without language changes
3. **Uniform Handling**: Same lowering logic for all
4. **Host Flexibility**: Host decides what to support
5. **Future-Proof**: System value space is unbounded

### Consequences

| Enables | Constrains |
|---------|------------|
| Unbounded system values | Key must be compile-time literal |
| No language changes for new values | Host must document supported keys |
| Uniform compiler logic | |

### Canonical Statement

> **`system.get` is the single, uniform effect for all system values. New system values = new keys, not new effects.**

---

## FDR-MEL-051: Compiler-Inserted Lowering

### Decision

**The compiler MUST automatically insert `system.get` effects for every `$system.*` reference. Developers never manually write system effects.**

### Context

Making developers manually write system effects would be verbose and error-prone. The compiler handles all lowering automatically while preserving developer experience.

### The Lowering Model

```
COMPILER RESPONSIBILITY:

Surface Syntax (what developer writes):
  $system.uuid, $system.time.now, etc.

Lowered Form (what compiler produces):
  1. Allocate internal state slots (value + intent marker)
  2. Insert guarded system.get effect (per-intent fresh)
  3. Rewrite $system.* → state access
  4. Add readiness conditions to original guards

Developer experience is UNCHANGED from v0.2.x.
Semantic model is FIXED.
```

### State Slot Naming Convention (v0.3.0-rc1)

**CRITICAL: Compiler-generated identifiers MUST NOT contain `$`** (violates A17).

```
NAMING: __sys__<action>_<key-normalized>_<suffix>

Reserved prefix: __sys__
  - User code CANNOT use identifiers starting with __sys__
  - Compile error if user attempts this

Key normalization:
  - Dots → underscores
  - "uuid" → "uuid"
  - "time.now" → "time_now"
  - "env.NODE_ID" → "env_NODE_ID"

Suffixes:
  - _value: The acquired system value
  - _intent: Intent marker for readiness check

Full examples:
  - $system.uuid in addTask:
    - Value slot: __sys__addTask_uuid_value
    - Intent marker: __sys__addTask_uuid_intent
  - $system.time.now in addTask:
    - Value slot: __sys__addTask_time_now_value
    - Intent marker: __sys__addTask_time_now_intent
```

### Lowering Algorithm (v0.3.0-rc1)

```
FOR each action A in domain:
  1. SCAN action body for $system.<key> references
  
  2. FOR each unique key K found:
     a. ALLOCATE value slot: __sys__<A>_<K-normalized>_value
     b. ALLOCATE intent marker: __sys__<A>_<K-normalized>_intent
     c. GENERATE acquisition effect (per-intent fresh):
        once(__sys__<A>_<K>_intent) {
          patch __sys__<A>_<K>_intent = $meta.intentId
          effect system.get({ key: "<K>", into: __sys__<A>_<K>_value })
        }
  
  3. REWRITE all $system.<K> → __sys__<A>_<K>_value
  
  4. ADD readiness conditions to original guards:
     - For each $system.<K> used in guard body:
       - Add: eq(__sys__<A>_<K>_intent, $meta.intentId)
```

### Critical: Per-Intent Fresh Guarantee

**The readiness condition MUST be `eq(intent_marker, $meta.intentId)`, NOT `isNotNull(value_slot)`.**

Why this matters:

```
PROBLEM with isNotNull(value):
  
  Intent #1: system.get executes, value = "abc-123"
  Intent #2: value is still "abc-123" (non-null)
           → isNotNull(value) = true
           → User logic executes with STALE value!
           → Bug: uuid from intent #1 used in intent #2

SOLUTION with eq(intent, $meta.intentId):
  
  Intent #1: system.get executes, intent = "intent-1", value = "abc-123"
  Intent #2: eq("intent-1", "intent-2") = false
           → User logic blocked until new acquisition
           → system.get executes, intent = "intent-2", value = "xyz-789"
           → eq("intent-2", "intent-2") = true
           → User logic executes with FRESH value ✓
```

### Complete Example (v0.3.0-rc1)

```mel
// ═══════════════════════════════════════════════════════════════
// SOURCE (what developer writes)
// ═══════════════════════════════════════════════════════════════

action addTask(title: string) {
  once(creating) when neq(trim(title), "") {
    patch creating = $meta.intentId
    patch tasks[$system.uuid] = {
      id: $system.uuid,
      title: title,
      createdAt: $system.time.now
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// LOWERED (what compiler produces)
// ═══════════════════════════════════════════════════════════════

// Compiler-generated state (hidden from developer)
state {
  // ... user state ...
  
  // System value slots (no $ in names!)
  __sys__addTask_uuid_value: string | null = null
  __sys__addTask_uuid_intent: string | null = null
  __sys__addTask_time_now_value: number | null = null
  __sys__addTask_time_now_intent: string | null = null
}

action addTask(title: string) {
  // Phase 1: Acquire $system.uuid (per-intent fresh)
  once(__sys__addTask_uuid_intent) {
    patch __sys__addTask_uuid_intent = $meta.intentId
    effect system.get({ key: "uuid", into: __sys__addTask_uuid_value })
  }
  
  // Phase 2: Acquire $system.time.now (per-intent fresh)
  once(__sys__addTask_time_now_intent) {
    patch __sys__addTask_time_now_intent = $meta.intentId
    effect system.get({ key: "time.now", into: __sys__addTask_time_now_value })
  }
  
  // Phase 3: Original logic with READINESS conditions
  // Note: eq(intent, $meta.intentId) ensures fresh values for THIS intent
  once(creating) 
    when and(
      eq(__sys__addTask_uuid_intent, $meta.intentId),
      eq(__sys__addTask_time_now_intent, $meta.intentId),
      neq(trim(title), "")
    ) {
    patch creating = $meta.intentId
    patch tasks[__sys__addTask_uuid_value] = {
      id: __sys__addTask_uuid_value,
      title: title,
      createdAt: __sys__addTask_time_now_value
    }
  }
}
```

### Guard Insertion Rules (v0.3.0-rc1)

```
GUARD RULES:

1. Acquisition effects use once(<intent_marker>) with NO extra condition
   - This ensures per-intent fresh acquisition
   - Marker patch is first statement (FDR-MEL-044)

2. User guards get READINESS conditions added:
   - eq(<intent_marker>, $meta.intentId) for each system value used
   - This blocks execution until THIS intent's values are acquired

3. NO isNull/isNotNull on value slots in guards
   - value slots can be null for env.* keys
   - isNotNull would cause stale value bugs
```

### Why Compiler-Inserted?

1. **DX Preserved**: Developer writes same surface syntax as v0.2.x
2. **Correctness Guaranteed**: Compiler always gets lowering right
3. **Semantic Fix**: v0.3.0 fixes purity without breaking DX
4. **Single Responsibility**: Compiler handles complexity, developer focuses on logic

### Consequences

| Enables | Constrains |
|---------|------------|
| Clean surface syntax | Compiler must implement lowering |
| Guaranteed correctness | Generated state is "hidden" |
| Backward-compatible DX | Lowered form is more verbose |
| Per-intent fresh values | `__sys__` prefix reserved |

### Canonical Statement

> **The compiler automatically inserts `system.get` effects with per-intent readiness checks. Developers write `$system.*` as before. Lowering is mandatory and invisible.**

---

## FDR-MEL-052: System Value Deduplication

### Decision

**Multiple references to the same `$system.<key>` within one action MUST be deduplicated to a single effect and single state slot.**

### Context

v0.2.x had ambiguous semantics for multiple `$system.uuid` uses:

```mel
// v0.2.x: AMBIGUOUS
patch tasks[$system.uuid] = {
  id: $system.uuid,  // Same as key? Different? Unclear!
}
```

v0.2.4 specified "fresh per access" but this was:
1. Counterintuitive (most developers expect same value)
2. Error-prone (key/id mismatch bugs)
3. Difficult to work around (required intermediate state)

### v0.3.0 Deduplication

```mel
// v0.3.0: DEDUPLICATED
// Both references → same __sys__addTask_uuid_value slot
patch tasks[$system.uuid] = {
  id: $system.uuid,  // Guaranteed same value ✓
}
```

### Deduplication Rules

```
DEDUPLICATION SCOPE:

1. SAME action, SAME key → ONE effect, ONE slot
   $system.uuid (first) + $system.uuid (second) → one _sys$action$uuid

2. SAME action, DIFFERENT key → SEPARATE effects, SEPARATE slots
   $system.uuid + $system.time.now → two slots

3. DIFFERENT actions, SAME key → SEPARATE effects, SEPARATE slots
   addTask uses $system.uuid, deleteTask uses $system.uuid → two slots
   (Per-action isolation)

4. SAME action, SAME key, DIFFERENT intents → DIFFERENT values
   (Per-intent, not per-action lifetime)
```

### Why Per-Action Scope?

```
Action scope is the natural boundary because:

1. Actions are independent execution units
2. State is per-domain, but system values are per-action-invocation
3. Cross-action sharing would create hidden coupling
4. Per-action is predictable and debuggable
```

### Implementation Detail

```typescript
// Compiler tracks unique keys per action
type SystemValueUsage = {
  action: string;
  key: string;         // "uuid", "time.now", etc.
  valueSlot: string;   // "__sys__addTask_uuid_value"
  intentSlot: string;  // "__sys__addTask_uuid_intent"
  references: SourceLocation[];  // All places it's used
};

// Deduplication: Map<action+key, SystemValueUsage>
```

### Comparison with v0.2.x

| Scenario | v0.2.x | v0.3.0 |
|----------|--------|--------|
| `$system.uuid` twice | Different values (per-access) | Same value (deduplicated) |
| Key/ID pattern | Bug-prone, needs workaround | Just works |
| Intermediate state | Required for reuse | Unnecessary |
| Mental model | "Fresh each time" | "Acquired once, reused" |

### Consequences

| Enables | Constrains |
|---------|------------|
| Natural key/id pattern | Cannot get two different UUIDs easily |
| Less error-prone | For multiple UUIDs, use effect directly |
| Simpler mental model | |

### Canonical Statement

> **Same `$system.<key>` in same action = same value. One effect, one slot, deduplicated automatically.**

---

## FDR-MEL-053: Snapshot-Based Replay

### Decision

**System values are replayed via Snapshot, not via a separate trace mechanism.**

### Context

v0.2.4 proposed two replay options:
- **Option A**: Snapshot-based (system values in Snapshot)
- **Option B**: Trace-based (separate system value recording)

v0.3.0 chooses **Option A: Snapshot-based**.

### Why Snapshot-Based?

```
MANIFESTO AXIOM: "Snapshot is the complete truth."

If system values are in Snapshot:
  - Replay = provide same Snapshot
  - No additional mechanism needed
  - Single source of truth maintained
  - Debugging is straightforward (inspect Snapshot)

If system values are in Trace:
  - Replay = Snapshot + Trace injection
  - Two sources of truth
  - Trace/Snapshot sync issues possible
  - More complex implementation
```

### Replay Model

```
REPLAY GUARANTEE:

compute(Snapshot, Intent) at time T₁
  → produces Snapshot' with system values populated

compute(Snapshot', Intent) at time T₂
  → produces IDENTICAL result
  → system effects are SKIPPED (guards see populated state)
  → Core sees SAME values from Snapshot'

Therefore:
  SAME Snapshot + SAME Intent → SAME Output
  (Regardless of wall-clock time)
```

### Execution Flow (v0.3.0-rc1)

```
First Execution (Intent "intent-1"):
  1. compute(Snapshot₀, Intent)
  2. Acquisition guard: once(__sys__uuid_intent) 
     → __sys__uuid_intent != "intent-1", so guard fires
  3. patch __sys__uuid_intent = "intent-1"
  4. effect system.get({ key: "uuid", into: __sys__uuid_value })
  5. Host executes, patches: __sys__uuid_value = "abc-123"
  6. compute(Snapshot₁, Intent) — re-entry
  7. Acquisition guard: __sys__uuid_intent == "intent-1" — SKIP
  8. User readiness: eq("intent-1", "intent-1") = true
  9. Original logic executes with value = "abc-123"

Second Execution (Intent "intent-2"):
  1. compute(Snapshot₁, Intent) — slot has "abc-123" from before
  2. Acquisition guard: once(__sys__uuid_intent)
     → __sys__uuid_intent != "intent-2", so guard fires
  3. patch __sys__uuid_intent = "intent-2"
  4. effect system.get({ key: "uuid", into: __sys__uuid_value })
  5. Host executes, patches: __sys__uuid_value = "xyz-789" (FRESH!)
  6. User readiness: eq("intent-2", "intent-2") = true
  7. Original logic executes with value = "xyz-789" (not stale!)

Replay (later, Intent "intent-1"):
  1. Load Snapshot₁ (contains intent = "intent-1", value = "abc-123")
  2. compute(Snapshot₁, Intent)
  3. Acquisition guard: __sys__uuid_intent == "intent-1" — SKIP
  4. User readiness: eq("intent-1", "intent-1") = true
  5. Original logic executes with value = "abc-123"
  6. IDENTICAL output ✓
```

### No Separate Trace Needed

```
v0.2.4 proposed recording:
  { key: "uuid", value: "abc-123", timestamp: 1234567890 }

v0.3.0 eliminates this:
  System values are IN Snapshot.
  Snapshot IS the trace (for system value replay).
  Nothing extra to record or replay.

Note: This does NOT eliminate general compute tracing for
debugging/observability. A24 refers specifically to system
value replay, not all traceability.
```

### Debugging Benefit

```
// Snapshot is inspectable, contains everything:
{
  // User state
  tasks: { ... },
  creating: "intent-xyz",
  
  // System values (visible! no $ in names)
  __sys__addTask_uuid_value: "abc-123",
  __sys__addTask_uuid_intent: "intent-xyz",
  __sys__addTask_time_now_value: 1704067200000,
  __sys__addTask_time_now_intent: "intent-xyz"
}

No hidden state. No separate trace file. Complete visibility.
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Single source of truth | System slots visible in Snapshot |
| Simple replay | Slightly larger Snapshot |
| No trace sync issues | |
| Complete debuggability | |

### Canonical Statement

> **Snapshot contains system values. Replay = same Snapshot. No separate trace mechanism.**

---

## FDR-MEL-054: System Value Scope Restrictions

### Decision

**`$system.*` references are ONLY allowed in action bodies. Usage in `computed` or `state` initializers is a compile error.**

### Context

System values are IO. IO cannot be in pure expressions.

```mel
// ❌ FORBIDDEN: $system.* in computed
computed now = $system.time.now  // Where does this value come from?
                                  // When is it evaluated?
                                  // computed is supposed to be pure!

// ❌ FORBIDDEN: $system.* in state initializer
state {
  id: string = $system.uuid      // State init must be deterministic
}
```

### Scope Rules (Normative)

| Context | `$system.*` Allowed? | Rationale |
|---------|---------------------|-----------|
| Action body | ✅ Yes | Effects are allowed in actions |
| Computed expression | ❌ No | Computed must be pure |
| State initializer | ❌ No | Initializers must be deterministic |
| Effect sub-expression | ✅ Yes | Part of action body |
| Condition in when/once | ✅ Yes | Part of action body |

### Error Messages

```
E001: System values cannot be used in computed expressions.
      $system.* values are IO operations that must be acquired in actions.
      
      Suggestion: Acquire the value in an action, store in state, 
      then reference the state in computed.

E002: System values cannot be used in state initializers.
      State defaults must be pure, deterministic values.
      
      Suggestion: Initialize to null, then set in an action.

E003: Invalid system value reference format.
      Use $system.<key> format (e.g., $system.uuid, $system.time.now).
```

### Workaround Pattern

```mel
// ✅ CORRECT: Acquire in action, use in computed

state {
  lastUpdated: number | null = null  // Not $system.time.now!
}

computed hasBeenUpdated = isNotNull(lastUpdated)

action update() {
  once(updating) {
    patch updating = $meta.intentId
    patch lastUpdated = $system.time.now  // Acquired here
  }
}
```

### Why These Restrictions?

1. **Purity**: Computed expressions are pure functions of state
2. **Determinism**: State initializers run once, must be deterministic
3. **Clarity**: IO is visible (in actions), not hidden (in computed)
4. **Testability**: Computed can be tested without mocking IO

### Consequences

| Enables | Constrains |
|---------|------------|
| Pure computed | Cannot have "live" computed values |
| Deterministic init | Must acquire system values explicitly |
| Clear IO boundary | Slightly more verbose for some patterns |

### Canonical Statement

> **`$system.*` is only allowed in actions. Computed and state init must be pure.**

---

# Part X: Implementation Safety (v0.3.1)

This part documents the design decisions that ensure MEL v0.3.0's system value semantics are **safe to implement** without introducing stale values, namespace collisions, or semantic bugs.

---

## FDR-MEL-055: Reserved __sys__ Namespace

### Decision

**Compiler-generated identifiers MUST use the `__sys__` prefix. User code MUST NOT define identifiers starting with `__sys__`.**

### Context

v0.3.0 initially proposed using `$` in compiler-generated slot names (e.g., `_sys$addTask$uuid`). This directly violated A17 ($ completely prohibited in user identifiers) and would have made the lexer unable to parse the lowered output.

### The Problem

```mel
// ❌ v0.3.0 initial proposal (BROKEN)
_sys$addTask$uuid  // Contains $ — violates A17!

// The lexer sees this as:
_sys   // Identifier
$addTask$uuid  // SystemIdent token (starts with $)

// Parse error! Grammar inconsistency!
```

### The Solution: __sys__ Prefix

```mel
// ✅ v0.3.1 (CORRECT)
__sys__addTask_uuid_value  // No $ — pure identifier
__sys__addTask_uuid_intent // Lexer happy, parser happy
```

### Naming Convention (Normative)

```
PATTERN: __sys__<action>_<key-normalized>_<suffix>

Components:
  __sys__     : Reserved prefix (double underscore + sys + double underscore)
  <action>    : Action name
  <key>       : System key with dots → underscores
  <suffix>    : _value or _intent

Examples:
  $system.uuid in addTask     → __sys__addTask_uuid_value
                              → __sys__addTask_uuid_intent
  $system.time.now in create  → __sys__create_time_now_value
                              → __sys__create_time_now_intent
  $system.env.NODE_ID in init → __sys__init_env_NODE_ID_value
                              → __sys__init_env_NODE_ID_intent
```

### User Restriction

```mel
// ❌ COMPILE ERROR E004
state {
  __sys__myData: string = ""  // Error: Reserved prefix
}

// ❌ COMPILE ERROR E004
action __sys__doSomething() {  // Error: Reserved prefix
  // ...
}
```

### Why Double Underscore?

| Alternative | Problem |
|-------------|---------|
| `_sys_` | Too easy to accidentally collide |
| `$sys$` | Contains $, violates A17 |
| `___sys` | Unusual, hard to read |
| `__sys__` | Clear, unlikely to collide, follows C/Python conventions |

The double underscore prefix is a well-established convention for "implementation reserved" identifiers in many languages (C, Python, etc.).

### Consequences

| Enables | Constrains |
|---------|------------|
| Grammar consistency | `__sys__` is reserved |
| Lexer/parser compatibility | User cannot use prefix |
| Clear separation | Compiler output is valid MEL |
| Implementation safety | No namespace collision possible |

### Canonical Statement

> **`__sys__` is the reserved namespace for compiler-generated system value slots. User identifiers starting with `__sys__` are compile errors.**

---

## FDR-MEL-056: Intent-Based Readiness Guards

### Decision

**Readiness conditions for system values MUST use `eq(intent_marker, $meta.intentId)`, NOT `isNotNull(value_slot)`.**

### Context

v0.3.0 initially proposed using `isNotNull(value)` as the readiness condition:

```mel
// ❌ v0.3.0 initial proposal (BROKEN)
once(creating) when and(
  isNotNull(__sys__addTask_uuid_value),  // WRONG!
  neq(trim(title), "")
) { ... }
```

This caused a **critical semantic bug**: stale values from previous intents would satisfy the condition.

### The Stale Value Bug

```
SCENARIO: Two consecutive intents

Intent #1 (addTask "First"):
  1. system.get executes → uuid_value = "abc-123"
  2. User logic creates task with id "abc-123" ✓

Intent #2 (addTask "Second"):
  1. uuid_value is still "abc-123" (non-null)
  2. isNotNull(uuid_value) = true
  3. User logic EXECUTES IMMEDIATELY with stale uuid!
  4. Creates task with id "abc-123" AGAIN ← BUG!

Expected: Intent #2 should get a FRESH uuid.
Actual: Intent #2 reused Intent #1's uuid.
```

### The Fix: Intent-Based Readiness

```mel
// ✅ v0.3.1 (CORRECT)
once(creating) when and(
  eq(__sys__addTask_uuid_intent, $meta.intentId),  // CORRECT!
  neq(trim(title), "")
) { ... }
```

### Why This Works

```
SCENARIO: Two consecutive intents

Intent #1 (addTask "First", intentId = "i1"):
  1. Acquisition: once fires, uuid_intent = "i1", uuid_value = "abc-123"
  2. Readiness: eq("i1", "i1") = true
  3. User logic creates task with id "abc-123" ✓

Intent #2 (addTask "Second", intentId = "i2"):
  1. Readiness: eq("i1", "i2") = false ← BLOCKED!
  2. Acquisition: once fires (marker changed), uuid_intent = "i2", uuid_value = "xyz-789"
  3. Readiness: eq("i2", "i2") = true
  4. User logic creates task with id "xyz-789" ✓

Each intent gets a FRESH value. No stale value bugs.
```

### Additional Benefit: Nullable System Values

```mel
// $system.env.* can return null
effect system.get({ key: "env.OPTIONAL_VAR", into: __sys__init_env_value })

// With isNotNull: Would block FOREVER if env var is not set
// With eq(intent, intentId): Works correctly, null is a valid value
```

### Readiness Condition Rules (Normative)

```
FOR each user guard that references $system.<key>:

1. DO NOT add: isNotNull(__sys__<A>_<K>_value)
2. DO add: eq(__sys__<A>_<K>_intent, $meta.intentId)

The intent marker is the ONLY correct readiness signal.
The value slot content is irrelevant for readiness.
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Per-intent fresh values | Slightly more complex condition |
| Nullable system values work | Must use intent marker |
| No stale value bugs | Cannot simplify to isNotNull |
| Deterministic replay | |

### Canonical Statement

> **Readiness is `eq(intent_marker, $meta.intentId)`. Never use `isNotNull(value)`. This prevents stale value bugs and supports nullable system values.**

---

## FDR-MEL-057: Architecture Review Certification

### Decision

**MEL v0.3.1 has passed Architecture Review and is certified safe to implement.**

### Review Summary

The Language & Runtime Architect reviewed MEL v0.3.0-rc1 (now v0.3.1) and verified:

| Question | Verdict | Evidence |
|----------|---------|----------|
| Is the readiness rule sufficient? | ✅ Yes | All scenarios traced, edge cases verified |
| Any IO leak paths into Core? | ✅ None | All paths enumerated and blocked |
| Host Contract preserved? | ✅ Yes | Re-entry, determinism, replay all verified |
| Simpler correct model exists? | ✅ No | Alternatives analyzed and rejected |

### Key Validations

**1. Readiness Rule Completeness**

| Scenario | Intent Marker | $meta.intentId | Result |
|----------|---------------|----------------|--------|
| First compute (i1) | null | "i1" | Acquisition fires |
| Second compute (i1) | "i1" | "i1" | Readiness ✓, user logic runs |
| New intent (i2) | "i1" | "i2" | Readiness ✗, fresh acquisition |
| Replay (i1) | "i1" | "i1" | Readiness ✓, deterministic |

**2. IO Leak Path Analysis**

| Path | Status |
|------|--------|
| `$system.*` in action | ✅ Safe (lowered to effect) |
| `$system.*` in computed | ✅ Blocked (E001) |
| `$system.*` in state init | ✅ Blocked (E002) |
| User defines `__sys__*` | ✅ Blocked (E004) |
| `$meta.*` / `$input.*` | ✅ Safe (pure, from Intent) |

**3. Host Contract Verification**

```
Re-entry Safety: ✅
  - All mutations guarded by once()
  - Acquisition is idempotent per-intent
  - No infinite loops possible

Determinism: ✅
  - Same Snapshot + Same Intent → Same Output
  - All state in Snapshot
  - No external dependencies

Replayability: ✅
  - Snapshot contains all system values
  - Guards prevent re-acquisition
  - No external trace needed
```

### Architectural Invariants (Certified)

```
INVARIANT 1: Core Purity
  System values are IO.
  IO is Effect.
  Effects are executed by Host.
  Results enter Core ONLY via Snapshot.
  Core remains pure.
  STATUS: ✅ VERIFIED

INVARIANT 2: Per-Intent Freshness
  Each intent gets fresh system values.
  Values from previous intents cannot leak.
  Readiness guards enforce this.
  STATUS: ✅ VERIFIED

INVARIANT 3: Snapshot Sufficiency
  Snapshot contains all information needed for replay.
  No separate trace mechanism required for system values.
  STATUS: ✅ VERIFIED
```

### Certification Statement

```
┌─────────────────────────────────────────────────────────────────┐
│                ARCHITECTURE REVIEW CERTIFICATION                 │
│                                                                  │
│  Document:     MEL v0.3.1 FDR                                    │
│  Component:    System Value Semantics                            │
│  Date:         2026-01-01                                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │           CERTIFIED: SAFE TO IMPLEMENT                   │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  The architecture is internally consistent.                      │
│  No fatal contradictions exist.                                  │
│  All invariants are verifiable.                                  │
│  Implementation may proceed.                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Implementation confidence | Must follow spec exactly |
| Spec stability | No further design changes |
| Test coverage targets | Must verify invariants |

### Canonical Statement

> **MEL v0.3.1 is architecture-reviewed and certified safe to implement. The system value semantics are internally consistent and preserve all Host Contract guarantees.**

---

# Part XI: Core Alignment (v0.3.2)

This part documents decisions that align MEL with Manifesto Core's existing FlowNode and ActionSpec capabilities, ensuring MEL can express the full semantic range of Core while maintaining language purity.

---

## FDR-MEL-058: Action Availability Conditions

### Decision

**MEL actions MAY have an `available when <Expr>` clause. The expression MUST be pure (ExprNode only, no Effects).**

### Context

Core's ActionSpec includes an `available` field that determines whether an action can be invoked given the current state. This is critical for:

1. **UI Binding**: "Should this button be enabled?"
2. **Agent Reasoning**: "What actions are possible now?"
3. **Validation**: Prevent invalid action invocations at the semantic level

Without MEL support, developers must define availability separately from the action, breaking locality.

### The Problem

```mel
// ❌ WITHOUT available: Availability defined elsewhere
computed canWithdraw = gt(balance, 0)

action withdraw() {
  when gt(balance, 0) {  // Duplicated condition!
    patch balance = sub(balance, amount)
  }
}

// Agent/UI must know to check canWithdraw before calling withdraw
// DX: Action and its precondition are separated
```

### The Solution

```mel
// ✅ WITH available: Self-contained action definition
action withdraw() available when gt(balance, 0) {
  once(withdrawing) {
    patch withdrawing = $meta.intentId
    patch balance = sub(balance, amount)
  }
}

// Agent/UI automatically knows: action.available = gt(balance, 0)
// DX: Action carries its own precondition
```

### Compilation

```mel
// MEL Source
action withdraw() available when gt(balance, 0) { ... }

// Compiles to ActionSpec
{
  "name": "withdraw",
  "available": { "kind": "gt", "left": { "kind": "get", "path": ["balance"] }, "right": { "kind": "lit", "value": 0 } },
  "flow": { ... }
}
```

### Constraint: Expr-Only (No Effects)

```mel
// ❌ COMPILE ERROR: Effects not allowed in available
action withdraw() available when effect.someCheck() { ... }

// ❌ COMPILE ERROR: $system.* not allowed in available (it's IO)
action withdraw() available when gt($system.time.now, deadline) { ... }

// ✅ CORRECT: Pure expression only
action withdraw() available when and(gt(balance, 0), not(frozen)) { ... }
```

**Why?** Availability is evaluated **synchronously** by Core/UI/Agent without Host involvement. Effects would require async Host execution, breaking the synchronous availability check model.

### Consequences

| Enables | Constrains |
|---------|------------|
| Self-contained action definitions | available must be pure |
| UI/Agent automatic availability | No Effects in available |
| Reduced duplication | No $system.* in available |
| Better DX locality | |

### Canonical Statement

> **`available when <Expr>` attaches a pure availability condition to an action. The expression must be ExprNode-only — no Effects, no $system.*.**

---

## FDR-MEL-059: Fail as FlowNode

### Decision

**`fail` is a FlowNode, NOT an Effect. It represents Core's decision to reject an operation, with the error state recorded in Snapshot.**

### Context

Manifesto's "Errors are values" principle means failures are first-class semantic events, not exceptions or side effects. Core already has `{ kind: 'fail', code, message }` as a FlowNode.

### The Problem: Why Not Effect?

```mel
// ❌ WRONG: fail as Effect
when isNull(input.email) {
  effect validation.fail({ code: "MISSING_EMAIL", message: "..." })
}
```

**Problems with Effect approach:**

| Issue | Consequence |
|-------|-------------|
| Host executes the "failure" | Core can't decide failure — Host does |
| Error becomes a side effect | Not a first-class semantic event |
| Trace/Explain unclear | "Effect executed" vs "Core decided to fail" |
| Host Contract violation | Errors should be Core decisions in Snapshot |

### The Solution: Fail as FlowNode

```mel
// ✅ CORRECT: fail as FlowNode
action createUser(email: string) {
  when isNull(email) {
    fail "MISSING_EMAIL" with "Email is required"
  }
  
  when not(isValidEmail(email)) {
    fail "INVALID_EMAIL" with "Email format is invalid"
  }
  
  once(creating) {
    patch creating = $meta.intentId
    patch users[$system.uuid] = { email: email }
  }
}
```

### Compilation

```mel
// MEL Source
fail "MISSING_EMAIL" with "Email is required"

// Compiles to FlowNode
{
  "kind": "fail",
  "code": "MISSING_EMAIL",
  "message": "Email is required"
}
```

### Syntax

```
FailStatement ::= 'fail' StringLiteral ('with' StringLiteral)?

Examples:
  fail "NOT_FOUND"
  fail "INVALID_INPUT" with "Expected positive number"
  fail "UNAUTHORIZED" with concat("User ", userId, " lacks permission")
```

### Semantics

1. **Immediate termination**: Flow stops at `fail`, subsequent statements don't execute
2. **Error in Snapshot**: `{ error: { code, message } }` recorded
3. **Core decision**: Host doesn't execute anything — Core decided to fail
4. **Traceable**: Explain shows "Flow failed at fail node" as first-class event

### Guard Requirement

```mel
// ❌ COMPILE ERROR: Unguarded fail
action validate() {
  fail "ALWAYS_FAILS"  // Error: fail must be inside when/once
}

// ✅ CORRECT: Guarded fail
action validate() {
  when isNull(input) {
    fail "MISSING_INPUT"
  }
}
```

**Why?** Unconditional fail is likely a mistake. Guards ensure fail is intentional.

### Consequences

| Enables | Constrains |
|---------|------------|
| "Errors are values" principle | fail must be guarded |
| Core-decided failures | Not available as Effect |
| Clear Trace/Explain | |
| Snapshot-recorded errors | |

### Canonical Statement

> **`fail` is a FlowNode representing Core's decision to reject an operation. Errors are values, not side effects. Host doesn't execute failure — Core decides it.**

---

## FDR-MEL-060: Stop Semantics (halt renamed)

### Decision

**Core's `halt` FlowNode is exposed in MEL as `stop`. It means "early exit" only — NOT "waiting" or "pending".**

### Context

Core has `{ kind: 'halt', reason }` for early termination. However, the name "halt" suggests "pause and resume later," which conflicts with Manifesto's "no resume" principle.

### The Problem: Semantic Confusion

```mel
// ❌ WRONG interpretation of halt
action processOrder() {
  when needsApproval {
    halt "Waiting for approval"  // WRONG: Implies resumption
  }
}
```

"Waiting for approval" is a **World Protocol concern** (Authority deliberation), not a Flow concern. Using `halt` for this conflates two different concepts:

| Concept | Layer | Mechanism |
|---------|-------|-----------|
| Early exit | Flow (MEL) | `stop` |
| Pending approval | World Protocol | Authority `pending` state |

### The Solution: Rename to `stop` with Semantic Restriction

```mel
// ✅ CORRECT: stop for early exit
action processPayment() {
  when alreadyProcessed {
    stop "Already processed"  // Early exit, no-op
  }
  
  when isNull(paymentMethod) {
    fail "NO_PAYMENT_METHOD"  // This is failure, not early exit
  }
  
  once(processing) {
    patch processing = $meta.intentId
    // ... actual processing
  }
}
```

### stop vs fail

| Aspect | `stop` | `fail` |
|--------|--------|--------|
| Meaning | "Nothing to do" (success) | "Cannot proceed" (error) |
| Snapshot | No error recorded | Error recorded |
| Use case | Idempotency, skip | Validation failure |
| Example | "Already processed" | "Invalid input" |

### Compilation

```mel
// MEL Source
stop "Already processed"

// Compiles to FlowNode
{
  "kind": "halt",
  "reason": "Already processed"
}
```

Note: MEL uses `stop`, but compiles to Core's `halt` FlowNode.

### Lint Rules (Normative)

```
LINT ERROR: stop message suggests waiting/pending

❌ stop "Waiting for approval"
❌ stop "Pending review"  
❌ stop "Awaiting confirmation"
❌ stop "On hold"

✅ stop "Already processed"
✅ stop "No action needed"
✅ stop "Skipped: condition not met"
✅ stop "Duplicate request"
```

**Why?** "Waiting" semantics belong to World Protocol, not Flow. This lint prevents architectural confusion.

### Guard Requirement

```mel
// ❌ COMPILE ERROR: Unguarded stop
action process() {
  stop "Always stops"  // Error: stop must be inside when/once
}

// ✅ CORRECT: Guarded stop
action process() {
  when alreadyDone {
    stop "Already processed"
  }
}
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Clear early-exit semantics | "waiting" messages forbidden |
| No confusion with World Protocol | stop must be guarded |
| Idempotency patterns | |
| Clean skip logic | |

### Canonical Statement

> **`stop` is "early exit" — the operation completes successfully with nothing to do. It is NOT "waiting" or "pending." Use World Protocol for approval workflows.**

---

## FDR-MEL-061: Call Exposure Policy

### Decision

**Core's `call` FlowNode is retained in Core but NOT exposed in MEL v0.3.2. MEL uses compile-time inlining instead.**

### Context

Core has `{ kind: 'call', target }` for invoking other named flows. This enables flow reuse and composition. However, exposing it in MEL raises concerns:

| Concern | Risk |
|---------|------|
| Complexity | call introduces control flow jumps |
| Readability | Harder to trace execution |
| Potential cycles | Though spec forbids, harder to enforce |

### The Decision: Core Retains, MEL Hides

```
Core Schema: call FlowNode EXISTS ✓
MEL Syntax:  call NOT EXPOSED ✗
```

**Why retain in Core?**
- Flow reuse for complex domains
- Standard library composition
- Host-level tooling may generate it

**Why not expose in MEL?**
- MEL prioritizes flat, readable flows
- Most use cases covered by compile-time inlining
- Keeps MEL simple for LLM generation

### MEL Alternative: Compile-Time Inlining

```mel
// ✅ MEL v0.3.2: Use macro/include for reuse (future)
// For now, duplicate the logic or use computed

// Pattern 1: Computed for shared expressions
computed isValidUser = and(isNotNull(userId), gt(len(userId), 0))

action createPost() {
  when not(isValidUser) {
    fail "INVALID_USER"
  }
  // ...
}

action createComment() {
  when not(isValidUser) {
    fail "INVALID_USER"
  }
  // ...
}
```

### Future Consideration (v0.4+)

```mel
// POTENTIAL v0.4+ syntax (NOT in v0.3.2)
flow validateUser() {
  when isNull(userId) {
    fail "MISSING_USER"
  }
}

action createPost() {
  include validateUser()  // Compile-time inline
  // ...
}
```

If `include` is added, it would:
- Inline the flow at compile time
- Result in NO `call` node in output
- Keep MEL flat and traceable

### Consequences

| Enables | Constrains |
|---------|------------|
| Simple MEL flows | No flow reuse in MEL (v0.3.2) |
| Easy LLM generation | Some duplication |
| Clear execution trace | |
| Core flexibility preserved | |

### Canonical Statement

> **`call` exists in Core but is not exposed in MEL v0.3.2. MEL uses flat flows with potential compile-time inlining in future versions.**

---

## FDR-MEL-062: Primitive Aggregation Functions

### Decision

**`sum(array)`, `min(array)`, `max(array)` are permitted as Primitive Aggregation functions, subject to strict constitutional constraints. User-defined accumulation (`reduce`, `fold`, `scan`) is permanently forbidden.**

### Context

The question arose: should MEL allow any form of iteration or aggregation?

Two positions:
- **Purist**: Only `len()` allowed, all other aggregation via Effects
- **Pragmatic**: Allow fixed-meaning aggregations that express "known facts"

### The Manifesto Principle

```
Core expresses facts.
Effects execute changes.
Facts are what IS, not how it was computed.
```

`sum(prices)` is a **fact** — "the sum of prices."  
`reduce(prices, (acc, p) => acc + p, 0)` is a **procedure** — "how to compute the sum."

### Why reduce/fold/scan Are Forbidden

| Aspect | reduce/fold/scan |
|--------|------------------|
| Hidden state | `$acc` accumulator exposed |
| User logic | Custom accumulation function |
| Intermediate steps | Implicit, not in Snapshot |
| Explainability | "acc changed from X to Y" — procedural |
| Mental model | Iteration, state machine |

> **Any construct that implies hidden state progression is forbidden.**

### Why sum/min/max(array) Are Permitted

| Aspect | sum/min/max |
|--------|-------------|
| Hidden state | ❌ None |
| User logic | ❌ None |
| Intermediate steps | ❌ None |
| Explainability | "The sum of X is Y" — declarative |
| Mental model | Mathematical fact |

These functions express **what**, not **how**.

### The Five Constitutional Constraints (MUST)

Primitive Aggregation functions are permitted **only if** all five constraints are met:

#### Constraint 1: Fixed Semantics Only

```mel
// ✅ ALLOWED
sum(prices)

// ❌ FORBIDDEN
sum(prices, where: gt($item, 0))
sum(prices, fn: customAdder)
sum(prices, initial: 100)
```

No predicates. No custom logic. No parameters beyond the array.

#### Constraint 2: Scalar Result Only

```mel
sum(array)  → number      // ✅
min(array)  → T (scalar)  // ✅
max(array)  → T (scalar)  // ✅
```

- No collection results
- No structure results
- No accumulator exposure

#### Constraint 3: Computed Only (No Flow)

```mel
// ✅ ALLOWED
computed total = sum(prices)

// ❌ FORBIDDEN
action checkout() {
  when gt(sum(prices), 0) { ... }
}
```

Primitive Aggregations are **facts**, not **operations**.
Facts belong in `computed`, not in flow logic.

#### Constraint 4: No Composition

```mel
// ❌ FORBIDDEN
sum(filter(prices))
min(map(items, $item.price))
sum(take(prices, 5))

// ✅ ALLOWED
sum(prices)  // Direct reference only
```

If transformation is needed, use Effects to create an intermediate array first.

#### Constraint 5: Effect-Substitutable

```text
Any primitive aggregation MAY be implemented as:
- Core evaluation (default)
- Host-provided cached value
- Pre-computed Snapshot field

The domain semantics MUST remain identical regardless of implementation.
```

This ensures Core doesn't depend on "how" the value is computed.

### Permitted Functions (Complete List)

| Function | Signature | Description |
|----------|-----------|-------------|
| `len(array)` | `Array<T> → number` | Array length |
| `sum(array)` | `Array<number> → number` | Sum of numeric array |
| `min(array)` | `Array<T> → T \| null` | Minimum value (null if empty) |
| `max(array)` | `Array<T> → T \| null` | Maximum value (null if empty) |

**Note:** `min(a, b, ...)` and `max(a, b, ...)` (scalar variadic) remain separate functions for comparing individual values.

### Forbidden Functions (Permanent)

| Function | Why Forbidden |
|----------|---------------|
| `reduce(array, fn, init)` | Exposes `$acc`, user-defined logic |
| `fold(array, fn, init)` | Same as reduce |
| `foldl` / `foldr` | Same as reduce |
| `scan(array, fn, init)` | Returns intermediate states |
| `accumulate` | Implies state progression |

### Consequences

| Enables | Constrains |
|---------|------------|
| Express simple facts | No custom aggregation |
| SQL/math alignment | No composition |
| Explainable results | Computed-only |
| Core remains declarative | Strict constraints |

### Canonical Statement

> **Primitive Aggregation functions (`sum`, `min`, `max`, `len`) express known facts, not user-defined computation. They expose no accumulator, accept no custom logic, and produce only scalar results. User-defined accumulation is permanently forbidden.**

---

# Summary: The MEL Identity

These design decisions collectively define what MEL IS:

```
MEL IS:
  ✓ A purpose-built language for Manifesto domain definitions
  ✓ AI-Native: optimized for LLM parsing and generation
  ✓ Pure by grammar: impurity cannot be expressed
  ✓ Consistent: one canonical form for each meaning
  ✓ Minimal: smallest grammar that serves the purpose
  ✓ Explicit: no magic, no implicit behavior, no coercion
  ✓ Function-oriented: function(args) is the canonical form
  ✓ Host-Contract-aligned: guards ensure re-entry safety
  ✓ Snapshot-only: all information flows through Snapshot
  ✓ Per-intent idempotent: once() is safe across intents (v0.2.2)
  ✓ Deterministic: same input → same output on any host (v0.2.2)
  ✓ Type-complete: Record and Array have distinct operations (v0.2.2)
  ✓ Fully specified: complete IR, equality rules, scope rules (v0.2.3)
  ✓ Implementation-convergent: single IR, reserved $, primitive eq (v0.2.4)
  ✓ Document-consistent: no contradictions between rules and examples (v0.2.5)
  ✓ IO-explicit: system values are effects, not magic expressions (v0.3.0)
  ✓ Compiler-assisted: lowering preserves DX while fixing semantics (v0.3.0)
  ✓ Namespace-safe: __sys__ reserved for compiler, no collision (v0.3.1)
  ✓ Per-intent fresh: readiness guards prevent stale values (v0.3.1)
  ✓ Architecture-reviewed: certified safe to implement (v0.3.1)
  ✓ Core-aligned: available, fail, stop match Core semantics (v0.3.2)
  ✓ Errors-are-values: fail is FlowNode, not Effect (v0.3.2)
  ✓ Layered-concerns: stop vs World Protocol pending clearly separated (v0.3.2)
  ✓ Fact-expressing: aggregation expresses facts, not procedures (v0.3.2)

MEL IS NOT:
  ✗ A subset of JavaScript
  ✗ A human-ergonomics-first language
  ✗ A general-purpose programming language
  ✗ A language with multiple syntax styles
  ✗ A language that grows features over time
  ✗ A language with escape hatches
  ✗ A language with implicit type coercion
  ✗ A language where Host interprets execution order
  ✗ A language with template literals (v0.2.2)
  ✗ A language with ambiguous IR mapping (v0.2.3)
  ✗ A language with multiple IR representations (v0.2.4)
  ✗ A language with $ in user identifiers (v0.2.5)
  ✗ A language with magic system expressions (v0.3.0)
  ✗ A language where Core performs IO (v0.3.0)
  ✗ A language with stale value bugs (v0.3.1)
  ✗ A language with namespace collisions (v0.3.1)
  ✗ A language where errors are side effects (v0.3.2)
  ✗ A language with call jumps (v0.3.2 — call hidden)
  ✗ A language with user-defined accumulation (v0.3.2 — reduce/fold/scan forbidden)
```

### The MEL Design Equation (v0.3.2)

```
MEL = (JS Expression Syntax)
    + (Explicit Keywords)
    + (Function-Only Canonical Form)
    + (Explicit Effects with $item)
    + (Guard-Mandatory Mutations)
    + (Boolean-Only Conditions)
    + (Per-Intent Idempotency)
    + (Deterministic Semantics)
    + (Complete IR Specification)
    + (Strict Equality Rules)
    + (Explicit Scope Resolution)
    + (Call-Only IR)
    + (Reserved $ Prefix)
    + (Primitive-Only Equality)
    + (System Values as Effects)         ← v0.3.0
    + (Compiler-Inserted Lowering)       ← v0.3.0
    + (Snapshot-Based Replay)            ← v0.3.0
    + (Reserved __sys__ Namespace)       ← v0.3.1
    + (Intent-Based Readiness)           ← v0.3.1
    + (Action Availability Conditions)   ← v0.3.2
    + (Fail as FlowNode)                 ← v0.3.2
    + (Stop for Early Exit)              ← v0.3.2
    + (Primitive Aggregation Only)       ← v0.3.2 NEW
    + (Specified Evaluation Order)
    + (Normalized Effect Signatures)
    + (Index-as-Call IR)
    - (Methods, Loops, Functions, Mutation)
    - (Truthy/Falsy Coercion)
    - (Implicit Side Effects)
    - (Template Literals)
    - (Ambiguous Semantics)
    - (Specialized IR Nodes)
    - (Non-deterministic Core)           ← v0.3.0 REMOVED
    - (Magic System Expressions)         ← v0.3.0 REMOVED
    - (Stale Value Bugs)                 ← v0.3.1 REMOVED
    - (Errors as Effects)                ← v0.3.2 REJECTED
    - (Exposed call FlowNode)            ← v0.3.2 HIDDEN
    - (User-Defined Accumulation)        ← v0.3.2 FORBIDDEN (reduce/fold/scan)
    - ($ in User Identifiers)
    × (AI-Native Design Filter)
    × (Host Contract Alignment)
    × (Core Purity Guarantee)            ← v0.3.0 STRENGTHENED
    × (Architecture Review)              ← v0.3.1 CERTIFIED
    × (Core Alignment)                   ← v0.3.2 COMPLETED
```

### The One-Sentence Summary

> **MEL is the language an LLM would design for itself: consistent, explicit, minimal, pure, deterministic, Core-aligned — where errors are values, aggregation expresses facts (not procedures), and all state flows through Snapshot.**

---

## Appendix: Decision Dependency Graph

```
═══════════════════════════════════════════════════════════════
                SYSTEM VALUE SEMANTICS (v0.3.0)
═══════════════════════════════════════════════════════════════

Core Purity Principle
    │
    └─► FDR-MEL-049 (System Values as Effects) ← FOUNDATIONAL
            "System values are IO, IO is Effect"
            "Core remains pure"
            │
            ├─► FDR-MEL-050 (Single System Effect)
            │       "system.get is the only system effect"
            │       "Extensible via keys, not new effects"
            │
            ├─► FDR-MEL-051 (Compiler-Inserted Lowering)
            │       "Compiler transforms $system.* automatically"
            │       "DX preserved, semantics fixed"
            │
            ├─► FDR-MEL-052 (System Value Deduplication)
            │       "Same key in same action = same value"
            │       "Natural key/id pattern works"
            │
            ├─► FDR-MEL-053 (Snapshot-Based Replay)
            │       "System values in Snapshot"
            │       "Replay = same Snapshot"
            │       "No separate trace"
            │
            └─► FDR-MEL-054 (System Value Scope Restrictions)
                    "Only in actions, not computed/init"
                    "Enforces IO boundary"

═══════════════════════════════════════════════════════════════
                IMPLEMENTATION SAFETY (v0.3.1)
═══════════════════════════════════════════════════════════════

FDR-MEL-051 (Compiler-Inserted Lowering)
    │
    ├─► FDR-MEL-055 (Reserved __sys__ Namespace)
    │       "No $ in compiler-generated names"
    │       "__sys__ prefix reserved"
    │       "Grammar/lexer consistency"
    │
    ├─► FDR-MEL-056 (Intent-Based Readiness Guards)
    │       "eq(intent, $meta.intentId) not isNotNull(value)"
    │       "Prevents stale value bugs"
    │       "Supports nullable env vars"
    │
    └─► FDR-MEL-057 (Architecture Review Certification)
            "All invariants verified"
            "No fatal contradictions"
            "Safe to implement"

═══════════════════════════════════════════════════════════════
                CORE ALIGNMENT (v0.3.2)
═══════════════════════════════════════════════════════════════

Core Schema (ActionSpec, FlowNode)
    │
    ├─► FDR-MEL-058 (Action Availability Conditions)
    │       "available when <Expr>"
    │       "Expr-only, no Effects"
    │       "UI/Agent automatic availability"
    │
    ├─► FDR-MEL-059 (Fail as FlowNode)
    │       "Errors are values"
    │       "Core decides, not Host"
    │       "Snapshot-recorded errors"
    │
    ├─► FDR-MEL-060 (Stop Semantics)
    │       "halt renamed to stop"
    │       "early exit only"
    │       "'waiting' messages forbidden"
    │
    └─► FDR-MEL-061 (Call Exposure Policy)
            "Core retains call"
            "MEL hides call"
            "Compile-time inlining instead"

Supersedes:
    ├── FDR-MEL-037 (System Value Stability) ← REPLACED
    │       v0.2.3: "Fresh per access"
    │       v0.3.0: "Deduplicated, one effect"
    │
    └── FDR-MEL-043 (Deterministic System Values) ← REPLACED
            v0.2.4: "UUIDv5 with accessPath"
            v0.3.0: "Effect result in Snapshot"
```

---

## Appendix: v0.2.5 to v0.3.0 Changes

### Conceptual Shift

| Aspect | v0.2.5 | v0.3.0 |
|--------|--------|--------|
| `$system.*` nature | Special expression | **Effect (IO)** |
| Core purity | Violated by $system.* | **Absolute** |
| Multiple access | UUIDv5(path+index) | **Deduplicated** |
| Replay mechanism | Trace + Snapshot | **Snapshot only** |
| Computed usage | Risky/undefined | **Compile error** |
| Developer syntax | `$system.uuid` | `$system.uuid` (unchanged) |
| Semantic model | Implicit Host magic | **Explicit Effect** |

### New Axioms

```
A20. System values are IO operations executed as Effects. [v0.3.0]
A21. There is exactly one system effect: system.get. [v0.3.0]
A22. Compiler inserts system effects automatically. [v0.3.0]
A23. Same $system.<key> in same action = same value (per intent). [v0.3.0]
A24. System value replay uses Snapshot only, no separate trace. [v0.3.0]
     (Note: This does not eliminate general compute tracing.)
A25. $system.* is forbidden in computed and state init. [v0.3.0]
A26. __sys__ prefix is reserved for compiler-generated identifiers. [v0.3.1]
A27. Readiness check uses eq(intent_marker, $meta.intentId), not isNotNull(value). [v0.3.1]
A28. available conditions must be pure expressions (no Effects, no $system.*). [v0.3.2]
A29. fail is a FlowNode — errors are Core decisions, not Host effects. [v0.3.2]
A30. stop means "early exit" only — "waiting/pending" semantics forbidden. [v0.3.2]
A31. call FlowNode exists in Core but is not exposed in MEL. [v0.3.2]
A32. Primitive aggregation (sum, min, max, len) expresses facts; user-defined accumulation is forbidden. [v0.3.2]
```

### Superseded Decisions

| FDR | v0.2.x Status | v0.3.0 Status |
|-----|---------------|---------------|
| FDR-MEL-037 | System Value Stability | **Superseded by FDR-MEL-049, 052** |
| FDR-MEL-043 | Deterministic System Values | **Superseded by FDR-MEL-049, 053** |
| FDR-MEL-046 | Evaluation Order (for UUID) | **Simplified** (no accessIndex needed) |

### Compiler Changes Required

```
NEW COMPILER RESPONSIBILITIES:

1. Scan actions for $system.* references
2. Allocate internal state slots per unique key per action
3. Insert guarded system.get effects
4. Rewrite $system.* → state slot access
5. Add dependency conditions to original guards
6. Emit errors for $system.* in computed/init

NEW HOST RESPONSIBILITIES:

1. Implement system.get effect handler
2. Support standard keys (uuid, time.now, random, env.*)
3. Patch results into Snapshot
4. Document supported keys
```

### Migration

```
v0.2.5 → v0.3.0 MIGRATION:

For developers:
  - Surface syntax unchanged ($system.uuid works as before)
  - Computed with $system.* → refactor to action + state
  - Multiple $system.uuid → now same value (likely what you wanted)

For compiler implementers:
  - Implement lowering transformation
  - Generate internal state slots
  - Handle effect insertion and guard modification

For Host implementers:
  - Add system.get effect handler
  - Remove any special $system.* evaluation logic from Core
```

---

## Appendix: v0.3.0 to v0.3.1 Changes

### Critical Fixes

| Issue | v0.3.0 (Broken) | v0.3.1 (Fixed) |
|-------|-----------------|----------------|
| Slot naming | `_sys$action$key` | `__sys__action_key_value` |
| Readiness condition | `isNotNull(value)` | `eq(intent, $meta.intentId)` |
| Stale values | Possible across intents | **Prevented** |
| Grammar violation | $ in generated names | **No $ anywhere** |

### New FDR Entries

| FDR | Title | Purpose |
|-----|-------|---------|
| FDR-MEL-055 | Reserved __sys__ Namespace | Grammar/lexer consistency |
| FDR-MEL-056 | Intent-Based Readiness Guards | Prevent stale value bugs |
| FDR-MEL-057 | Architecture Review Certification | Implementation safety |

### Axiom Updates

```
A26. __sys__ prefix is reserved for compiler-generated identifiers. [v0.3.1]
A27. Readiness check uses eq(intent_marker, $meta.intentId), not isNotNull(value). [v0.3.1]
```

### The Stale Value Bug (Fixed)

```
v0.3.0 PROBLEM:
  Intent #1: uuid_value = "abc-123"
  Intent #2: isNotNull("abc-123") = true
           → User logic executes with STALE value!

v0.3.1 FIX:
  Intent #1: uuid_intent = "i1", uuid_value = "abc-123"
  Intent #2: eq("i1", "i2") = false
           → User logic BLOCKED until fresh acquisition
           → uuid_intent = "i2", uuid_value = "xyz-789"
           → User logic executes with FRESH value ✓
```

### Lowering Example Comparison

```mel
// v0.3.0 (BROKEN - grammar violation, stale values)
state { _sys$addTask$uuid: string | null = null }
once(creating) when isNotNull(_sys$addTask$uuid) { ... }

// v0.3.1 (CORRECT)
state { 
  __sys__addTask_uuid_value: string | null = null
  __sys__addTask_uuid_intent: string | null = null
}
once(creating) when eq(__sys__addTask_uuid_intent, $meta.intentId) { ... }
```

### Architecture Review Result

```
┌─────────────────────────────────────────────────────────────────┐
│                     REVIEW OUTCOME                               │
│                                                                  │
│  Readiness rule sufficient?     ✅ YES                          │
│  IO leak paths?                 ✅ NONE                         │
│  Host Contract preserved?       ✅ YES                          │
│  Simpler correct model?         ✅ NO (this is minimal)         │
│                                                                  │
│  VERDICT: GO — Safe to implement                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix: v0.3.1 to v0.3.2 Changes

### Core Alignment

| Feature | v0.3.1 | v0.3.2 |
|---------|--------|--------|
| `available` | Not in MEL | **MEL syntax added** |
| `fail` | Not in MEL | **FlowNode (not Effect)** |
| `halt` | Not in MEL | **Renamed to `stop`** |
| `call` | Not in MEL | **Hidden (Core only)** |

### New Axioms

```
A28. available conditions must be pure expressions (no Effects, no $system.*). [v0.3.2]
A29. fail is a FlowNode — errors are Core decisions, not Host effects. [v0.3.2]
A30. stop means "early exit" only — "waiting/pending" semantics forbidden. [v0.3.2]
A31. call FlowNode exists in Core but is not exposed in MEL. [v0.3.2]
```

### New FDR Entries

| FDR | Title | Key Decision |
|-----|-------|--------------|
| FDR-MEL-058 | Action Availability | `available when <Expr>`, Expr-only |
| FDR-MEL-059 | Fail as FlowNode | Errors are values, not effects |
| FDR-MEL-060 | Stop Semantics | halt → stop, no "waiting" |
| FDR-MEL-061 | Call Exposure Policy | Core retains, MEL hides |

### Why "Errors are Values" Matters

```
❌ fail as Effect (REJECTED):
   - Host executes "failure"
   - Core can't decide alone
   - Error is side effect
   - Trace unclear

✅ fail as FlowNode (ADOPTED):
   - Core decides to fail
   - Host not involved
   - Error in Snapshot
   - Trace shows "Core failed"
```

### Why stop ≠ halt

```
halt (confusing):
   "halt" implies "pause and resume"
   "Waiting for approval" is wrong use
   Conflicts with "no resume" principle

stop (clear):
   "stop" means "done, nothing to do"
   "Already processed" is correct use
   Aligns with early-exit semantics
```

### Lint Rules Added

```
LINT: stop message suggests waiting

❌ stop "Waiting for approval"
❌ stop "Pending review"
❌ stop "Awaiting confirmation"

✅ stop "Already processed"
✅ stop "No action needed"
✅ stop "Skipped"
```

---

## Appendix: Key Quotes

> "MEL is not a restricted JavaScript. MEL is a purpose-built language where impurity cannot be expressed."
> — FDR-MEL-001

> "System values are IO. IO is Effect. Effects are executed by Host. Results enter Core via Snapshot. Core remains pure."
> — FDR-MEL-049

> "`system.get` is the single, uniform effect for all system values. New system values = new keys, not new effects."
> — FDR-MEL-050

> "The compiler automatically inserts `system.get` effects with per-intent readiness checks. Developers write `$system.*` as before. Lowering is mandatory and invisible."
> — FDR-MEL-051

> "Same `$system.<key>` in same action = same value (per intent). One effect, one slot, deduplicated automatically."
> — FDR-MEL-052

> "Snapshot contains system values. Replay = same Snapshot. No separate trace mechanism (for system values)."
> — FDR-MEL-053

> "`$system.*` is only allowed in actions. Computed and state init must be pure."
> — FDR-MEL-054

> "`__sys__` is the reserved namespace for compiler-generated system value slots. User identifiers starting with `__sys__` are compile errors."
> — FDR-MEL-055

> "Readiness is `eq(intent_marker, $meta.intentId)`, not `isNotNull(value)`. This prevents stale value bugs and supports nullable system values."
> — FDR-MEL-056

> "MEL v0.3.1 is architecture-reviewed and certified safe to implement."
> — FDR-MEL-057

> "`available when <Expr>` attaches a pure availability condition to an action. The expression must be ExprNode-only — no Effects, no $system.*."
> — FDR-MEL-058

> "`fail` is a FlowNode representing Core's decision to reject an operation. Errors are values, not side effects. Host doesn't execute failure — Core decides it."
> — FDR-MEL-059

> "`stop` is 'early exit' — the operation completes successfully with nothing to do. It is NOT 'waiting' or 'pending.' Use World Protocol for approval workflows."
> — FDR-MEL-060

> "`call` exists in Core but is not exposed in MEL v0.3.2. MEL uses flat flows with potential compile-time inlining in future versions."
> — FDR-MEL-061

> "MEL is the language an LLM would design for itself: consistent, explicit, minimal, pure, deterministic, Core-aligned — where errors are values, availability is declarative, and early-exit is distinct from pending."
> — Summary

---

*End of MEL FDR Document v0.3.2*
