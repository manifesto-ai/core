# MEL Compiler SPEC v0.5.0 (Patch)

> **Version:** 0.5.0
> **Type:** Patch
> **Status:** Merged
> **Date:** 2026-01-27
> **Base:** v0.4.0 (REQUIRED - read SPEC-v0.4.0-patch.md first)
> **Scope:** `$mel` Namespace, `onceIntent` Syntax, Guard Compilation
> **Merged Into:** `SPEC-v0.5.0.md`
> **ADR:** ADR-002 (DX Improvement - MEL Namespace & onceIntent)

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| `onceIntent` syntax | New Grammar | Non-breaking |
| `onceIntent` contextual keyword | Parsing Rule | Non-breaking |
| COMPILER-MEL-1~3 (+2a) | New Rules | Normative |
| Reserved namespaces | Spec Update | Normative |
| FDR-MEL-074/075/076/077 | New FDRs | Rationale |

---

## 1. Changelog Entry

```diff
> **Changelog:**
> ...existing entries...
> - **v0.4.0: Translator Lowering, Expression Evaluation, Host Integration**
+ > - **v0.5.0: $mel Namespace, onceIntent Syntax, Guard Compilation**
```

---

## 2. §4.5 Action Declaration (Grammar Update)

**Before:**
```ebnf
GuardedStmt     = WhenStmt
                | OnceStmt
```

**After:**
```ebnf
GuardedStmt     = WhenStmt
                | OnceStmt
                | OnceIntentStmt

OnceIntentStmt  = "onceIntent" [ "when" Expression ] "{" { InnerStmt } "}"
```

---

## 3. §4.8 Once-Intent Statement (Per-Intent Idempotency Sugar)

```ebnf
OnceIntentStmt  = "onceIntent" [ "when" Expression ] "{" { InnerStmt } "}"
```

`onceIntent` provides **per-intent idempotency** without requiring manual guard field management. It is syntactic sugar that compiles to `once()` with an auto-generated guard in the `$mel` namespace.

**Semantics:**
- The block executes **at most once per intentId**
- Guard state is stored in `$mel.guards.intent.<guardId>`, not in domain state
- No schema pollution: developers don't need to declare guard fields

**Example:**
```mel
action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}

// With condition
action submit() {
  onceIntent when isValid(form) {
    effect api.submit({ data: form, into: result })
  }
}
```

**Desugaring (Conceptual):**
```mel
// Source
onceIntent { patch count = add(count, 1) }

// Desugars to
once($mel.guards.intent.<guardId>) {
  patch $mel.guards.intent.<guardId> = $meta.intentId
  patch count = add(count, 1)
}
```

Where `<guardId>` is computed as `hash(actionName + ":" + blockIndex + ":intent")`.

**Critical Rules:**
- COMPILER-MEL-1: Guard patches MUST use `merge` at `$mel.guards.intent` level (not root `$mel`)
- COMPILER-MEL-2: Desugared `once(X)` MUST perform its first guard write to the same **semantic guard path** `X`
- COMPILER-MEL-2a: Lowering MAY implement the guard write as `merge` at `$mel.guards.intent` (map-level) and treat it as semantically equivalent to writing `X`

See FDR-MEL-074 for rationale.

---

## 4. §4.8.1 `onceIntent` as Contextual Keyword

`onceIntent` is a **contextual keyword**. It is parsed as a statement keyword **only** at statement start and only when followed by `{` or `when`. In all other contexts, it is treated as a normal identifier.

**Parsing Rules:**

| Context | Token Sequence | Interpretation |
|---------|----------------|----------------|
| Statement start | `onceIntent` `{` | OnceIntentStmt |
| Statement start | `onceIntent` `when` | OnceIntentStmt |
| Elsewhere | `onceIntent` | Identifier |

**Examples:**
```mel
// ✅ Parsed as OnceIntentStmt (keyword)
onceIntent { patch x = 1 }
onceIntent when ready { patch x = 1 }

// ✅ Parsed as identifier (contextual keyword)
once(onceIntent) { patch onceIntent = $meta.intentId }
patch onceIntent = "value"
```

See FDR-MEL-077 for rationale.

---

## 5. §6.1 Scope Resolution (Reserved Namespaces)

**Reserved Namespaces (v0.5.0):**

The following paths are reserved for platform use:

| Path Prefix | Owner | Purpose |
|-------------|-------|---------|
| `$host.*` | Host | Execution context, intent slots |
| `$mel.*` | Compiler | Guard state, compiler internals |
| `$meta.*` | Runtime | Intent metadata (read-only) |
| `$input.*` | Runtime | Action parameters (read-only) |
| `$system.*` | Core | System values (read-only in computed) |

**Rule:** Domain identifiers starting with `$` are forbidden (compile error E004).

**Note:** This rule applies to *domain-defined* identifiers. Platform components (Host, Compiler) inject `$host`/`$mel` for their own use. Developers using Host directly may manually add these fields—this is permitted because the fields are *platform-owned*, not domain-owned.

---

## 6. §14 Compiler Rules for `$mel` Namespace (v0.5.0)

| Rule ID | Description |
|---------|-------------|
| COMPILER-MEL-1 | Guard patches for `onceIntent` MUST use `merge` operation at `$mel.guards.intent` path. Root `$mel` merge is FORBIDDEN (shallow merge would overwrite sibling guards). |
| COMPILER-MEL-2 | Desugared `once(X)` MUST perform its first guard write to the same **semantic guard path** `X`. |
| COMPILER-MEL-2a | Lowering MAY implement the guard write as `merge` at `$mel.guards.intent` (map-level) and treat it as semantically equivalent to writing `X`. |
| COMPILER-MEL-3 | `onceIntent` MUST be parsed as a **contextual keyword** (statement start + `{`/`when` only). |

**COMPILER-MEL-1 Rationale:**

Core's `merge` is shallow. If compiler generates:
```typescript
// ❌ WRONG: Root merge overwrites guards
{ op: "merge", path: "$mel", value: { guards: { intent: { a: "i1" } } } }
{ op: "merge", path: "$mel", value: { guards: { intent: { b: "i1" } } } }
// Result: { guards: { intent: { b: "i1" } } } — "a" is lost!
```

Correct approach:
```typescript
// ✅ CORRECT: Map-level merge preserves siblings
{ op: "merge", path: "$mel.guards.intent", value: { a: "i1" } }
{ op: "merge", path: "$mel.guards.intent", value: { b: "i1" } }
// Result: { guards: { intent: { a: "i1", b: "i1" } } }
```

---

## 7. Changelog Entry

```markdown
## v0.5.0 (2026-01-XX)

### Added
- `onceIntent` statement for per-intent idempotency without schema pollution
- `onceIntent when <condition>` variant
- Contextual keyword parsing for `onceIntent`
- COMPILER-MEL-1~3 rules for `$mel` namespace handling
- Reserved namespace documentation (`$mel.*`)

### Unchanged
- `once(guard)` behavior unchanged (low-level primitive)
- Code using `onceIntent` as an identifier remains valid outside the statement-start context
```

---

*End of Patch Document*
