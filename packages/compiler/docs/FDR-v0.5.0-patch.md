# MEL Foundational Design Rationale v0.5.0 (Patch)

> **Version:** 0.5.0
> **Type:** Patch
> **Status:** Draft
> **Base:** v0.3.3 (REQUIRED - read FDR-v0.3.3.md first)
> **Purpose:** Document the "Why" behind ADR-002 design decisions

---

## FDR-MEL-074: `onceIntent` Sugar

### Decision

**`onceIntent` provides per-intent idempotency as syntactic sugar over `once()`, with guard state stored in `$mel.guards.intent.*` instead of domain state.**

### Context

The existing `once(guard)` pattern requires:
1. Declaring guard field in domain schema
2. Writing `patch guard = $meta.intentId` as first statement
3. Understanding FDR-MEL-044 marker rule

This creates DX friction for the common case of "run this block once per intent."

### Rationale

| Concern | `once(guard)` | `onceIntent` |
|---------|---------------|--------------|
| Schema pollution | Guard field in domain | Guard in `$mel` (hidden) |
| Boilerplate | Manual marker patch | Automatic |
| Mental model | "Why save intentId?" | "Once per intent" |
| Advanced patterns | Full control | Use `once()` instead |

**Key insight:** Most `once()` uses are simple per-intent guards. `onceIntent` optimizes this case while `once()` remains for advanced patterns.

### Consequences

- `onceIntent` desugars to `once($mel.guards.intent.<guardId>)` with auto-generated marker patch
- Guard state is excluded from World hash (WORLD-HASH-4b)
- Existing `once()` behavior is unchanged
- Migration is optional (both syntaxes coexist)

---

## FDR-MEL-075: `$mel` Namespace

### Decision

**Compiler-owned internal state MUST be stored in `data.$mel`, separate from Host-owned `data.$host`.**

### Context

ADR-002 needed a place to store compiler-generated guard state. Options considered:

| Option | Pros | Cons |
|--------|------|------|
| `$host.__compiler.*` | Single namespace | Violates HOST-DATA-1, role confusion |
| `$runtime` | Neutral name | Ambiguous (Host? Compiler? Both?) |
| `$mel` | Clear ownership | New namespace |

### Rationale

**Separation of concerns:**
- `$host` = Host layer owns it (intent slots, errors, execution context)
- `$mel` = MEL Compiler owns it (guards, future compiler internals)

**Naming:** `$mel` is short for "MEL" (Manifesto Expression Language), making ownership explicit.

**Extensibility:** Future compiler features (e.g., `onceExecution`, debug info) have a clear home.

### Consequences

- World SPEC must exclude `$mel` from hash (WORLD-HASH-4b)
- App must inject `$mel` into schemas (APP-NS-1)
- Domain schemas cannot use `$mel` (SCHEMA-RESERVED-1)

---

## FDR-MEL-076: `$mel` Patch Safety

### Decision

**Compiler MUST generate guard patches as `merge` at `$mel.guards.intent` level. Root `$mel` merge is FORBIDDEN.**

### Context

Core's `merge` operation is **shallow**. This creates a critical issue:

```typescript
// Action with two onceIntent blocks
// Block 1 generates:
{ op: "merge", path: "$mel", value: { guards: { intent: { a: "i1" } } } }
// Block 2 generates:
{ op: "merge", path: "$mel", value: { guards: { intent: { b: "i1" } } } }

// Result with shallow merge:
{ guards: { intent: { b: "i1" } } }  // "a" is LOST!
```

Lost guards cause:
1. Block 1 sees no guard → executes again
2. Generates same patches → infinite loop potential

### Rationale

**Solution:** Merge at the map level where keys should accumulate:

```typescript
{ op: "merge", path: "$mel.guards.intent", value: { a: "i1" } }
{ op: "merge", path: "$mel.guards.intent", value: { b: "i1" } }
// Result: { guards: { intent: { a: "i1", b: "i1" } } }  // Both preserved!
```

**Defense in depth:**
1. App provides structured default: `$mel = { guards: { intent: {} } }`
2. Compiler uses map-level merge (COMPILER-MEL-1)

### Consequences

- COMPILER-MEL-1 is a MUST rule
- Violation causes silent guard loss → potential infinite loops
- Implementation must be tested with multiple `onceIntent` blocks

---

## FDR-MEL-077: `onceIntent` Contextual Keyword

### Decision

**`onceIntent` is a contextual keyword: it is recognized as a statement keyword only at statement start when followed by `{` or `when`. In all other contexts, it remains a valid identifier.**

### Context

`onceIntent` introduces a new statement form, but existing code may already use `onceIntent` as an identifier. A contextual keyword keeps the grammar unambiguous at statement start while preserving backward compatibility.

### Rationale

**Contextual keyword parsing:**
- Avoids breaking existing code that uses `onceIntent` as an identifier
- Keeps parsing unambiguous at statement start (`onceIntent {` / `onceIntent when`)
- Preserves the new statement form without forcing global reservation

### Consequences

- Code using `onceIntent` as an identifier continues to work outside the statement-start context
- This is a non-breaking change for existing code
- Parser adds a small, localized lookahead rule
- COMPILER-MEL-3 documents this rule

---

*End of Patch Document*
