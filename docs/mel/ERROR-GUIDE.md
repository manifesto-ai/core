# MEL Error Guide

> **Purpose:** Learn MEL by understanding common errors.
> **Format:** Each section shows broken code, explains the rule violated, and provides the fix.
> **Reference:** See SPEC.md for full specification, FDR.md for design rationale.

---

## Table of Contents

1. [Hidden Iteration Errors](#hidden-iteration-errors)
2. [Aggregation Errors](#aggregation-errors)
3. [Effect Errors](#effect-errors)
4. [Guard Errors](#guard-errors)
5. [Type Errors](#type-errors)
6. [Identifier Errors](#identifier-errors)
7. [Semantic Errors](#semantic-errors)

---

## Hidden Iteration Errors

MEL forbids hidden iteration. All iteration is declarative, not imperative.

### Error: filter/map in computed

```mel
// ❌ BROKEN
computed activeItems = filter(items, $item.active)
```

**Error:** `SemanticError: 'filter' is not a builtin function. Use effect array.filter() instead.`

**Rule violated:** MEL has no `filter()` or `map()` functions. These are effects.

```mel
// ✅ FIXED: Use effect in action
action loadActive() {
  once(loading) {
    patch loading = $meta.intentId
    effect array.filter({
      source: items,
      where: eq($item.active, true),
      into: activeItems
    })
  }
}

// Then use computed to access the result
computed hasActiveItems = gt(len(activeItems), 0)
```

---

### Error: Nested function in aggregation

```mel
// ❌ BROKEN
computed total = sum(filter(prices))
computed lowest = min(map(items, $item.price))
```

**Error:** `SemanticError: Aggregation accepts only direct array references.`

**Rule violated:** `sum()`, `min()`, `max()` accept only direct state references, not expressions.

```mel
// ✅ FIXED: Prepare data first with effect, then aggregate
action preparePrices() {
  once(filtering) {
    patch filtering = $meta.intentId
    effect array.filter({
      source: prices,
      where: gt($item, 0),
      into: positivePrices
    })
  }
}

// Now aggregate the filtered result
computed total = sum(positivePrices)
```

**Why:** MEL expresses facts ("the sum of X"), not procedures ("how to compute sum"). See FDR-MEL-060.

---

### Error: $item outside effect

```mel
// ❌ BROKEN
computed doubled = mul($item, 2)
```

**Error:** `SemanticError: '$item' is only valid inside effect iteration context.`

**Rule violated:** `$item` refers to the current element during effect iteration. It has no meaning outside effects.

```mel
// ✅ FIXED: Use $item inside effect
action doubleAll() {
  once(doubling) {
    patch doubling = $meta.intentId
    effect array.map({
      source: items,
      select: mul($item, 2),
      into: doubled
    })
  }
}
```

---

## Aggregation Errors

### Error: sum with multiple arguments

```mel
// ❌ BROKEN
computed total = sum(a, b, c)
```

**Error:** `SemanticError: 'sum' expects exactly 1 argument (array), got 3.`

**Rule violated:** `sum()` aggregates an array. Use `add()` for adding values.

```mel
// ✅ FIXED: Use add() for values
computed total = add(add(a, b), c)

// Or if you have an array
computed arrayTotal = sum(prices)
```

---

### Error: min/max with wrong argument count

```mel
// ❌ BROKEN (ambiguous)
computed x = min(arr, 5)
```

**Error:** `SemanticError: 'min' with 2 args expects both to be numbers, not array and number.`

**Rule violated:** `min(array)` aggregates an array. `min(a, b, ...)` compares scalar values. Cannot mix.

```mel
// ✅ FIXED: Separate use cases
computed arrayMin = min(prices)          // Array aggregation
computed smaller = min(a, b)             // Value comparison
computed smallest = min(a, b, c, d)      // Multi-value comparison
```

---

### Error: Aggregation on Record

```mel
// ❌ BROKEN
computed taskCount = len(tasks)   // tasks is Record<string, Task>
```

**Error:** `SemanticError: 'len' expects Array<T>, got Record<string, Task>.`

**Rule violated:** `len()` works only on arrays, not records.

```mel
// ✅ FIXED: Get keys first
action loadKeys() {
  once(loading) {
    patch loading = $meta.intentId
    effect record.keys({ source: tasks, into: taskIds })
  }
}

computed taskCount = len(taskIds)
```

---

## Effect Errors

### Error: Effect in computed

```mel
// ❌ BROKEN
computed filtered = effect array.filter({ source: items, where: $item.active, into: result })
```

**Error:** `SemanticError: Effects are not allowed in computed expressions.`

**Rule violated:** Computed is pure. Effects require Host execution.

```mel
// ✅ FIXED: Move to action
action filterItems() {
  once(filtering) {
    patch filtering = $meta.intentId
    effect array.filter({
      source: items,
      where: eq($item.active, true),
      into: filteredItems
    })
  }
}

// Computed reads the result
computed filteredCount = len(filteredItems)
```

---

### Error: Nested effect

```mel
// ❌ BROKEN
effect array.map({
  source: teams,
  select: {
    name: $item.name,
    activeMembers: effect array.filter({    // Nested effect!
      source: $item.members,
      where: eq($item.active, true)
    })
  },
  into: result
})
```

**Error:** `SyntaxError: Effect cannot appear in expression position.`

**Rule violated:** Effects cannot be nested. `$item` scope becomes ambiguous.

```mel
// ✅ FIXED: Sequential composition
action loadTeamData() {
  // Step 1: Flatten all members
  once(step1) {
    patch step1 = $meta.intentId
    effect array.flatMap({
      source: teams,
      select: $item.members,
      into: allMembers
    })
  }

  // Step 2: Filter active members
  once(step2) when isNotNull(allMembers) {
    patch step2 = $meta.intentId
    effect array.filter({
      source: allMembers,
      where: eq($item.active, true),
      into: activeMembers
    })
  }
}
```

---

### Error: Unguarded effect

```mel
// ❌ BROKEN
action fetchData() {
  effect api.fetch({ url: "/data", into: result })
}
```

**Error:** `SemanticError: Effect must be inside 'when' or 'once' guard.`

**Rule violated:** All effects must be guarded for re-entry safety.

```mel
// ✅ FIXED: Add guard
action fetchData() {
  once(fetching) {
    patch fetching = $meta.intentId
    effect api.fetch({ url: "/data", into: result })
  }
}
```

---

## Guard Errors

### Error: Non-boolean condition

```mel
// ❌ BROKEN
when items { ... }
when user.name { ... }
when count { ... }
```

**Error:** `SemanticError: Condition must be boolean, got Array/string/number.`

**Rule violated:** MEL is strictly typed. No truthy/falsy coercion.

```mel
// ✅ FIXED: Explicit boolean expressions
when gt(len(items), 0) { ... }
when isNotNull(user.name) { ... }
when neq(count, 0) { ... }
```

---

### Error: Missing marker patch in once

```mel
// ❌ BROKEN
action increment() {
  once(lastIntent) {
    patch count = add(count, 1)    // Missing marker patch!
  }
}
```

**Error:** `SemanticError: once() block must have 'patch lastIntent = $meta.intentId' as first statement.`

**Rule violated:** `once(marker)` requires marker patch as first statement.

```mel
// ✅ FIXED: Add marker patch first
action increment() {
  once(lastIntent) {
    patch lastIntent = $meta.intentId    // MUST be first
    patch count = add(count, 1)
  }
}
```

---

### Error: Wrong marker in once

```mel
// ❌ BROKEN
action increment() {
  once(lastIntent) {
    patch differentMarker = $meta.intentId   // Wrong marker!
    patch count = add(count, 1)
  }
}
```

**Error:** `SemanticError: once(lastIntent) block must patch 'lastIntent', not 'differentMarker'.`

**Rule violated:** The patched marker must match the `once()` parameter.

```mel
// ✅ FIXED: Patch the correct marker
action increment() {
  once(lastIntent) {
    patch lastIntent = $meta.intentId    // Same as once() parameter
    patch count = add(count, 1)
  }
}
```

---

### Error: Unguarded patch

```mel
// ❌ BROKEN
action reset() {
  patch count = 0
}
```

**Error:** `SemanticError: Patch must be inside 'when' or 'once' guard.`

**Rule violated:** All mutations must be guarded.

```mel
// ✅ FIXED: Add guard
action reset() {
  when gt(count, 0) {
    patch count = 0
  }
}
```

---

### Error: Unguarded fail

```mel
// ❌ BROKEN
action validate() {
  fail "ALWAYS_FAILS"
}
```

**Error:** `SemanticError: fail must be inside 'when' or 'once' guard.`

**Rule violated:** `fail` and `stop` must be guarded.

```mel
// ✅ FIXED: Add condition
action validate(email: string) {
  when eq(trim(email), "") {
    fail "MISSING_EMAIL"
  }
}
```

---

## Type Errors

### Error: Collection comparison

```mel
// ❌ BROKEN
when eq(items, []) { ... }
when eq(tasks, {}) { ... }
```

**Error:** `SemanticError: eq/neq can only compare primitives (null, boolean, number, string).`

**Rule violated:** Collections have no equality semantics in MEL.

```mel
// ✅ FIXED: Check properties
when eq(len(items), 0) { ... }           // Check length
when eq(len(keys(tasks)), 0) { ... }     // Check key count
```

---

### Error: Method call

```mel
// ❌ BROKEN
computed trimmed = email.trim()
computed lower = name.toLowerCase()
```

**Error:** `SyntaxError: Unexpected token '(' after property access.`

**Rule violated:** MEL has no method calls. Use function calls.

```mel
// ✅ FIXED: Function calls
computed trimmed = trim(email)
computed lower = lower(name)
```

---

### Error: Template literal

```mel
// ❌ BROKEN
computed greeting = `Hello, ${name}!`
```

**Error:** `SyntaxError: Template literals are not supported. Use concat().`

**Rule violated:** Template literals removed in v0.2.2.

```mel
// ✅ FIXED: Use concat()
computed greeting = concat("Hello, ", name, "!")
```

---

## Identifier Errors

### Error: $ in identifier

```mel
// ❌ BROKEN
state {
  $myVar: number = 0
  my$count: number = 0
  count$: number = 0
}
```

**Error:** `SyntaxError: '$' is reserved for system identifiers and cannot appear in user identifiers.`

**Rule violated:** `$` is completely prohibited in user-defined identifiers (anywhere).

```mel
// ✅ FIXED: Remove $
state {
  myVar: number = 0
  myCount: number = 0
  countValue: number = 0
}
```

---

### Error: System value in state initializer

```mel
// ❌ BROKEN (v0.3.0+)
state {
  id: string = $input.id
  createdAt: number = $input.now
}
```

**Error:** `SemanticError: System values cannot be used in state initializers. State defaults must be pure, deterministic values.`

**Rule violated:** State initializers must be deterministic.

```mel
// ✅ FIXED: Initialize with pure values, acquire in action
state {
  id: string | null = null
  createdAt: number | null = null
}

action initialize() {
  once(init) {
    patch init = $meta.intentId
    patch id = $input.id
    patch createdAt = $input.now
  }
}
```

---

## Semantic Errors

### Error: stop used as waiting/pending

```mel
// ❌ BROKEN
action submitForApproval() {
  when neq(status, "approved") {
    stop "Waiting for approval"
  }
}
```

**Error:** `LintError: stop message suggests waiting/pending semantics. Use 'already_processed' style instead.`

**Rule violated:** `stop` means "early exit," not "waiting." MEL has no suspend/resume.

```mel
// ✅ FIXED: Express as completed condition
action submitForApproval() {
  // Fail if not approved
  when neq(status, "approved") {
    fail "NOT_APPROVED" with "Approval required before submission"
  }

  // Or express as early exit (already done)
  when eq(status, "approved") {
    stop "already_approved"
  }
}
```

**Forbidden stop messages:**
- ❌ `"Waiting for approval"`
- ❌ `"Pending review"`
- ❌ `"Awaiting confirmation"`
- ❌ `"On hold"`

**Allowed stop messages:**
- ✅ `"already_processed"`
- ✅ `"no_action_needed"`
- ✅ `"skipped_by_condition"`

---

### Error: Direct assignment

```mel
// ❌ BROKEN
action update() {
  when true {
    count = add(count, 1)
  }
}
```

**Error:** `SemanticError: Direct assignment is forbidden. Use 'patch count = ...' instead.`

**Rule violated:** All state changes must use `patch`.

```mel
// ✅ FIXED: Use patch
action update() {
  when true {
    patch count = add(count, 1)
  }
}
```

---

### Error: Unknown builtin

```mel
// ❌ BROKEN
computed keys = Object.keys(user)
computed random = Math.random()
computed now = Date.now()
```

**Error:** `SemanticError: 'Object'/'Math'/'Date' is not defined.`

**Rule violated:** MEL has no JavaScript globals.

```mel
// ✅ FIXED: Use MEL builtins or effects
action loadKeys() {
  once(loading) {
    patch loading = $meta.intentId
    effect record.keys({ source: user, into: userKeys })
  }
}

// For time, use $input (provided by Host)
action timestamp() {
  when true {
    patch createdAt = $input.now
  }
}

// Random is not supported — MEL is deterministic
```

---

### Error: Variable declaration

```mel
// ❌ BROKEN
action calculate() {
  let temp = add(count, 1)
  when true {
    patch count = temp
  }
}
```

**Error:** `SyntaxError: Unexpected token 'let'.`

**Rule violated:** MEL has no variable declarations (`let`, `const`, `var`).

```mel
// ✅ FIXED: Use expression directly or computed
computed nextCount = add(count, 1)

action calculate() {
  when true {
    patch count = add(count, 1)
  }
}
```

---

### Error: Function definition

```mel
// ❌ BROKEN
function double(x) {
  return mul(x, 2)
}
```

**Error:** `SyntaxError: Unexpected token 'function'.`

**Rule violated:** MEL has no user-defined functions.

```mel
// ✅ FIXED: Use computed for reusable expressions
computed doubled = mul(count, 2)
computed tripled = mul(count, 3)
```

---

### Error: Loop construct

```mel
// ❌ BROKEN
action processAll() {
  for (let item of items) {
    patch processed = add(processed, 1)
  }
}
```

**Error:** `SyntaxError: Unexpected token 'for'.`

**Rule violated:** MEL has no loops. All iteration is via effects.

```mel
// ✅ FIXED: Use effect for iteration
action processAll() {
  once(processing) {
    patch processing = $meta.intentId
    effect array.map({
      source: items,
      select: { processed: true, value: $item },
      into: processedItems
    })
  }
}
```

---

## Summary

| Error Category | Common Cause | Fix |
|----------------|--------------|-----|
| Hidden iteration | Using filter/map as functions | Use `effect array.filter/map()` |
| Aggregation | Nested calls in sum/min/max | Prepare data with effect first |
| Effect in computed | Thinking computed can do IO | Move to action |
| Unguarded statement | Missing when/once | Add guard |
| Non-boolean condition | Truthy coercion assumption | Use explicit comparison |
| Collection comparison | Using eq on arrays/records | Check len() or properties |
| Method call | JavaScript habits | Use function calls |
| $ in identifier | Naming convention | Use regular identifiers |
| stop as waiting | Misunderstanding semantics | Use fail or early-exit style |

---

*End of MEL Error Guide*
