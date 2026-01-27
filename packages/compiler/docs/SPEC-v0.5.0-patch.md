# MEL Compiler SPEC v0.5.0 (Patch)

> **Version:** 0.5.0
> **Type:** Patch
> **Status:** Draft
> **Date:** 2026-01-27
> **Base:** v0.4.0 (REQUIRED - read SPEC-v0.4.0-patch.md first)
> **Scope:** `$mel` Namespace, `onceIntent` Syntax, Guard Compilation
> **ADR:** ADR-002 (DX Improvement - MEL Namespace & onceIntent)

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| COMPILER-MEL-1 | New Rule | Normative |
| COMPILER-MEL-2 | New Rule | Normative |
| COMPILER-MEL-3 | New Rule | Normative |
| Section 21: `$mel` Namespace Compilation | New Section | Normative |
| Section 22: `onceIntent` Syntax | New Section | Normative |
| Axiom A36, A37 | New Axioms | Normative |
| FDR-MEL-073 ~ 076 | New FDRs | Rationale |

---

## 1. Changelog Entry

```diff
> **Changelog:**
> ...existing entries...
> - **v0.4.0: Translator Lowering, Expression Evaluation, Host Integration**
+ > - **v0.5.0: $mel Namespace, onceIntent Syntax, Guard Compilation**
```

---

## 2. New Axioms

```
A36. $mel namespace is Compiler-owned; external writes to $mel are forbidden. [v0.5.0]
A37. onceIntent is a contextual keyword, not a reserved keyword. [v0.5.0]
```

---

## 3. `$mel` Namespace Compilation

```markdown
---

## 21. `$mel` Namespace Compilation

### 21.1 Purpose

Compiler requires internal state for guard markers that:
- Must survive compute cycles (re-entry safety)
- Must NOT pollute user's domain state
- Must be invisible to domain logic and World hash

`$mel` is a Compiler-owned reserved namespace in `snapshot.data.$mel`.

### 21.2 `$mel` Structure

```typescript
type MelNamespace = {
  readonly guards?: {
    readonly intent?: Record<string, string>;  // guardId -> intentId
  };
};
```

**Location:** `snapshot.data.$mel`

### 21.3 Normative Rules

#### COMPILER-MEL-1: Safe Map-Level Merge

> **CRITICAL:** Core's `merge` operation is shallow. Compiler MUST use map-level merge to preserve sibling guards.

```typescript
// CORRECT - Map-level merge at $mel.guards.intent
{
  op: 'merge',
  path: 'data.$mel.guards.intent',
  value: { [guardId]: intentId }
}

// FORBIDDEN - Full $mel merge (destroys sibling guards!)
{
  op: 'merge',
  path: 'data.$mel',
  value: { guards: { intent: { [guardId]: intentId } } }
}
```

**Rationale:**
> Core SPEC states `merge` is shallow-only. A merge at `$mel` would replace the entire `guards` object.
> Compiler MUST emit patches at `$mel.guards.intent` level to preserve all sibling guard entries.

#### COMPILER-MEL-2: GuardId Generation

> GuardId MUST be content-addressable: `hash(actionName:blockIndex:guardType)`

```typescript
function generateGuardId(
  actionName: string,
  blockIndex: number,
  guardType: 'intent' | 'state'  // extensible
): string {
  const content = `${actionName}:${blockIndex}:${guardType}`;
  return sha256(content).slice(0, 16);  // 16-char hex
}

// Example:
// generateGuardId('submitOrder', 0, 'intent')
// → 'a3f2b8c1e9d0f7a6'
```

**Properties:**
- Deterministic: Same action/block/type → same guardId
- Collision-resistant: Different inputs → different guardId
- Compact: 16 hex chars (64 bits)

#### COMPILER-MEL-3: Guard Patch Ordering

> Guard check patch MUST be emitted BEFORE guarded operation patches.

```typescript
// For onceIntent block:
// 1. Emit condition check against $mel.guards.intent[guardId]
// 2. Emit guarded operation patches (with condition)
// 3. Emit guard marker write (with condition)

const guardId = generateGuardId(actionName, blockIndex, 'intent');
const intentId = '$meta.intentId';  // From intent context

// Generated patches (in order):
[
  // Guarded operations (only if guard not set for this intent)
  {
    condition: { kind: 'neq',
      left: { kind: 'get', path: `data.$mel.guards.intent.${guardId}` },
      right: { kind: 'get', path: 'meta.intentId' }
    },
    op: 'set',
    path: 'data.submittedAt',
    value: { kind: 'get', path: 'input.timestamp' }
  },
  // Guard marker write (same condition)
  {
    condition: { kind: 'neq',
      left: { kind: 'get', path: `data.$mel.guards.intent.${guardId}` },
      right: { kind: 'get', path: 'meta.intentId' }
    },
    op: 'merge',
    path: 'data.$mel.guards.intent',
    value: { kind: 'obj', fields: [
      { key: guardId, value: { kind: 'get', path: 'meta.intentId' } }
    ]}
  }
]
```

### 21.4 External Write Prohibition

> **NORMATIVE:** Only Compiler-generated patches MAY write to `$mel`.
> User code, Translator, and manual patches MUST NOT write to `$mel`.

| Source | $mel Write | Status |
|--------|------------|--------|
| Compiler-generated patches | ✅ | Allowed |
| User domain code | ❌ | FORBIDDEN |
| Translator output | ❌ | FORBIDDEN |
| Manual/debug patches | ❌ | FORBIDDEN |

**Enforcement:** App layer SHOULD validate that non-Compiler sources do not include `$mel` paths.

### 21.5 Hash Exclusion

> `$mel` is excluded from World hash computation.
> See World SPEC v2.0.3 WORLD-HASH-4b.

```typescript
// World hash computation:
const hashableData = stripPlatformNamespaces(snapshot.data);
// hashableData does not contain $host or $mel
```
```

---

## 4. `onceIntent` Syntax

```markdown
---

## 22. `onceIntent` Syntax

### 22.1 Purpose

`onceIntent` provides per-intent idempotency with minimal syntax.
It is sugar for guard-marker pattern using `$mel.guards.intent`.

### 22.2 Syntax Definition

```
onceIntent:
  onceIntent ( identifier ) block

block:
  { statement* }
```

**`onceIntent` is a CONTEXTUAL KEYWORD:**
- Only recognized at statement position within action body
- MAY be used as identifier in other contexts (variable name, field name)
- NOT a reserved keyword

```mel
// Valid: onceIntent as statement keyword
action submit {
  onceIntent(submitGuard) {
    patch data.submittedAt = $input.timestamp;
  }
}

// Valid: onceIntent as identifier (different context)
const onceIntent = "some value";  // OK, it's just a variable name
data.onceIntent = true;           // OK, it's just a field name
```

### 22.3 Desugaring

`onceIntent(id) { ...body }` desugars to guard-checked block:

```mel
// Source:
onceIntent(submitGuard) {
  patch data.submittedAt = $input.timestamp;
  effect api.submit { payload: $input };
}

// Desugared (conceptual):
if $mel.guards.intent[guardId] != $meta.intentId {
  patch data.submittedAt = $input.timestamp;
  effect api.submit { payload: $input };
  patch $mel.guards.intent[guardId] = $meta.intentId;
}
```

Where `guardId = hash(actionName:blockIndex:intent)`.

### 22.4 Compilation Output

For the source:
```mel
action submitOrder {
  onceIntent(submit) {
    patch data.submittedAt = $input.timestamp;
  }
}
```

Compiler generates `ConditionalPatchOp[]`:

```typescript
const guardId = generateGuardId('submitOrder', 0, 'intent');
// e.g., 'a3f2b8c1e9d0f7a6'

const condition: CoreExprNode = {
  kind: 'neq',
  left: { kind: 'get', path: `data.$mel.guards.intent.${guardId}` },
  right: { kind: 'get', path: 'meta.intentId' }
};

const ops: ConditionalPatchOp[] = [
  // User's patch (guarded)
  {
    condition,
    op: 'set',
    path: 'data.submittedAt',
    value: { kind: 'get', path: 'input.timestamp' }
  },
  // Guard marker (guarded, COMPILER-MEL-1 compliant)
  {
    condition,
    op: 'merge',
    path: 'data.$mel.guards.intent',
    value: {
      kind: 'obj',
      fields: [{ key: guardId, value: { kind: 'get', path: 'meta.intentId' } }]
    }
  }
];
```

### 22.5 Re-entry Behavior

| Compute Cycle | Guard State | Condition Result | Operations |
|---------------|-------------|------------------|------------|
| 1st (intent-A) | undefined | true (≠ A) | Execute body + set guard |
| 2nd (intent-A) | "intent-A" | false (= A) | Skip body |
| 3rd (intent-B) | "intent-A" | true (≠ B) | Execute body + set guard |
| 4th (intent-B) | "intent-B" | false (= B) | Skip body |

### 22.6 Multiple `onceIntent` Blocks

Each `onceIntent` block gets unique guardId based on block index:

```mel
action processOrder {
  onceIntent(validate) {
    // guardId = hash('processOrder:0:intent')
    patch data.validated = true;
  }

  onceIntent(submit) {
    // guardId = hash('processOrder:1:intent')
    patch data.submitted = true;
  }
}
```

### 22.7 Error Handling

| Error | Code | When |
|-------|------|------|
| Duplicate identifier in same action | DUPLICATE_ONCE_ID | `onceIntent(x) {} onceIntent(x) {}` |
| Empty block | EMPTY_ONCE_BLOCK | `onceIntent(x) {}` |
| Nested onceIntent | NESTED_ONCE | `onceIntent(x) { onceIntent(y) {} }` |

### 22.8 Parser Implementation Notes

```typescript
// Contextual keyword detection:
// 1. Check if current token is identifier 'onceIntent'
// 2. Check if next token is '('
// 3. If both true, parse as onceIntent statement
// 4. Otherwise, parse as regular identifier

function parseStatement(): Statement {
  if (isIdentifier('onceIntent') && lookahead(1) === '(') {
    return parseOnceIntentStatement();
  }
  // ... other statement parsing
}
```
```

---

## 5. FDR Summary

| FDR | Title |
|-----|-------|
| FDR-MEL-073 | $mel namespace is Compiler-owned |
| FDR-MEL-074 | Map-level merge for guard preservation |
| FDR-MEL-075 | Content-addressable guardId |
| FDR-MEL-076 | onceIntent is contextual keyword |

---

## 6. Acceptance Criteria

- [ ] `$mel` patches use map-level merge at `$mel.guards.intent`
- [ ] GuardId is deterministic: `hash(actionName:blockIndex:guardType)`
- [ ] `onceIntent` recognized only at statement position
- [ ] `onceIntent` usable as identifier in other contexts
- [ ] Guard condition checks `$mel.guards.intent[guardId] != $meta.intentId`
- [ ] Guard marker write uses same condition as guarded operations
- [ ] Multiple `onceIntent` blocks get unique guardIds via block index
- [ ] Parser error for duplicate/empty/nested onceIntent

---

*End of Patch Document*
