# Intent IR Design Rationale (FDR)

> **Version:** 0.1.0

## Why Chomskyan LF?

### Problem Statement

Natural language interfaces face a fundamental challenge: the same meaning can be expressed in countless surface forms across languages and styles. Traditional approaches:

1. **String matching** — Brittle, doesn't generalize
2. **Token classification** — Loses semantic structure
3. **Direct LLM generation** — Non-deterministic, uncacheable

### Solution: Logical Form

Chomsky's Minimalist Program provides the answer: **Logical Form (LF)** captures meaning independent of surface representation.

```
PF (Surface Form)     LF (Logical Form)
─────────────────     ─────────────────
"Cancel my order"  →  DO:CANCEL(TARGET:Order[last])
"주문 취소해"       →  DO:CANCEL(TARGET:Order[last])
"Delete the order" →  DO:CANCEL(TARGET:Order[this])
```

## Key Design Decisions

### FDR-INT-001: Fixed Head Hierarchy

**Decision:** Functional heads are finite and ordered.

**Alternatives Rejected:**
- Open-ended feature sets (leads to schema explosion)
- Flat key-value pairs (loses linguistic structure)

**Rationale:** Linguistic theory shows that natural language uses a fixed, universal hierarchy. Our IR mirrors this.

### FDR-INT-002: Three-Key Architecture

**Decision:** Three distinct keys for different use cases.

| Key | Use Case | Why Not One Key? |
|-----|----------|------------------|
| intentKey | Protocol identity | Needs schema binding |
| strictKey | Exact reproduction | Needs context + state |
| simKey | Similarity search | Needs semantic normalization |

### FDR-INT-003: AND-only Conditions (v0.1)

**Decision:** v0.1 supports only AND-conjoined conditions.

**Rationale:**
- Simpler canonicalization (no DNF conversion)
- Covers 90%+ of real-world use cases
- OR/NOT deferred to v0.2 with proper planning

### FDR-INT-004: Term as Closed Union

**Decision:** Term is a discriminated union with `kind` as discriminator.

```typescript
type Term =
  | EntityRefTerm
  | PathRefTerm
  | ArtifactRefTerm
  | ValueTerm
  | ExprTerm;
```

**Alternatives Rejected:**
- Open interface with type field (loses exhaustiveness checking)
- Class hierarchy (not JSON-serializable)

### FDR-INT-005: Shape vs Raw Separation

**Decision:** `ValueTerm` separates `shape` (semantic features) from `raw` (execution value).

```typescript
{
  kind: "value",
  valueType: "number",
  shape: { range: "1-100", sign: "positive" },  // For caching
  raw: 42                                        // For execution
}
```

**Rationale:**
- `shape` enables semantic caching (42 and 43 both "small positive integers")
- `raw` preserved for exact execution
- Canonicalization can remove raw for similarity search

### FDR-INT-006: ListTerm Deferred

**Decision:** Array/set values deferred to v0.2.

**Rationale:**
- Requires `in` operator for conditions
- Requires element-wise canonicalization rules
- v0.1 uses JSON-serialized strings in artifacts as workaround

### FDR-INT-007: Deterministic Reference Resolution

**Decision:** `this`/`that`/`last` resolution is deterministic, not LLM-based.

**Algorithm:**
```
this → focus (type must match)
that → most recent in discourse, excluding focus
last → most recent of same entityType
```

**Rationale:**
- Reproducibility (same context → same resolution)
- Testability (no mocking needed)
- Speed (no LLM call)

## Canonicalization Decisions

### FDR-INT-CAN-001: RFC 8785 JCS

**Decision:** Use JSON Canonicalization Scheme for serialization.

**Why:**
- Deterministic key ordering
- Standard specification
- Cross-language compatibility

### FDR-INT-CAN-002: Semantic vs Strict Modes

**Decision:** Two canonicalization modes for different purposes.

| Mode | raw Field | Use Case |
|------|-----------|----------|
| Semantic | Removed | simKey, similarity search |
| Strict | Normalized | strictKey, exact caching |

### FDR-INT-CAN-003: Predicate Ordering

**Decision:** Predicates sorted by `(lhs, op, rhs.kind, rhs)` tuple.

**Why:**
- Deterministic regardless of input order
- Preserves semantic equivalence: `a>1 AND b<2` ≡ `b<2 AND a>1`

## Lexicon Decisions

### FDR-INT-LEX-001: Lexicon as Interface

**Decision:** Lexicon is an interface, not a concrete implementation.

**Rationale:**
- Domains can customize vocabulary
- Testing doesn't require full lexicon
- Composable (can merge lexicons)

### FDR-INT-LEX-002: ThetaFrame Structure

**Decision:** Each event has a ThetaFrame specifying required/optional roles.

```typescript
type ThetaFrame = {
  required: Role[];                    // MUST be present
  optional: Role[];                    // MAY be present
  restrictions: Record<Role, SelectionalRestriction>;
};
```

**Linguistic Basis:** Theta-theory from Government and Binding.

## Key Invariants

1. **Canonicalization is idempotent:** `can(can(ir)) ≡ can(ir)`
2. **Same meaning, same simKey:** Semantic equivalence produces identical keys
3. **Resolution is deterministic:** Given same context, same IR → same resolved IR
4. **Feature checking is pure:** No side effects, always returns CheckResult
5. **Lowering never fails silently:** Returns `LowerError` on any issue

## Migration Path

### v0.1 → v0.2

Planned additions:
- `ListTerm` type
- `in` operator
- OR/NOT conditions
- Multi-value per role

**Breaking changes** (requiring MAJOR bump):
- New enum values in Force, EventClass, etc.
- ListTerm addition to Term union

## Related Documents

- [SPEC Document](/internals/spec/intent-ir-spec)
