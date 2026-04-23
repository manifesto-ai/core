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
7. [Annotation Errors](#annotation-errors)
8. [Semantic Errors](#semantic-errors)

---

## Hidden Iteration Errors

MEL forbids hidden iteration. All iteration is declarative, not imperative.

### Error: effect-level array.filter in computed

```mel
// ❌ BROKEN
computed activeItems = effect array.filter({
  source: items,
  where: eq($item.active, true),
  into: result
})
```

**Error:** `SemanticError: Effects are not allowed in computed expressions.`

**Rule violated:** `effect array.filter(...)` is an effect statement, not an expression. In computed, use the expression-level `filter()` builtin.

```mel
// ✅ FIXED: Use the expression builtin in computed
computed activeItems = filter(items, eq($item.active, true))
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

**Rule violated:** `sum()`, `min()`, `max()` accept only direct state or computed array references, not inline expressions.

```mel
// ✅ FIXED: Use a computed intermediate, then aggregate
computed positivePrices = filter(prices, gt($item, 0))
computed total = sum(positivePrices)
```

**Why:** MEL expresses facts ("the sum of X"), not procedures ("how to compute sum"). See FDR-MEL-062.

---

### Error: $item outside collection/effect context

```mel
// ❌ BROKEN
computed doubled = mul($item, 2)
```

**Error:** `SemanticError: '$item' is only valid inside a collection predicate/mapper or effect iteration context.`

**Rule violated:** `$item` refers to the current element of a collection traversal. It is valid inside expression-level `filter()` / `map()` / `find()` / `every()` / `some()` predicates or mappers, and inside effect-level iteration payloads. It has no meaning outside those contexts.

```mel
// ✅ FIXED: Use $item inside a collection mapper
computed doubled = map(items, mul($item, 2))
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

### Error: Wrong arity for bounded sugar

```mel
// ❌ BROKEN
computed a = clamp(score, 0)
computed b = idiv(total, buckets, extra)
computed c = streak(previous)
computed d = clamp(score, 10, 0)
```

**Error:** `SemanticError: 'clamp' expects 3 arguments, 'idiv' expects 2, and 'streak' expects 2. Literal clamp bounds must be ordered lo, hi.`

**Rule violated:** These bounded sugar functions have fixed arity. They are ordinary function calls, not variadic helpers. `clamp()` also does not silently swap literal bounds for you.

```mel
// ✅ FIXED
computed a = clamp(score, 0, 100)
computed b = idiv(total, buckets)
computed c = streak(previous, eq(kind, "miss"))
computed d = clamp(score, 0, 10)
```

---

### Error: Malformed match arm or missing default

```mel
// ❌ BROKEN
computed label = match(status, ["open", "Open"], ["closed", "Closed"])
computed code = match(status, "open", 1, 0)
computed mixed = match(status, ["open", 1], ["closed", "Closed"], 0)
computed duplicate = match(status, ["open", 1], ["open", 2], 0)
```

**Error:** `SemanticError: 'match' requires inline [key, value] arms and a final default value.`

**Rule violated:** `match()` is only supported in function form: `match(key, [k1, v1], [k2, v2], ..., defaultValue)`. Arm keys must be literal primitives and duplicates are invalid.

```mel
// ✅ FIXED
computed label = match(status, ["open", "Open"], ["closed", "Closed"], "Unknown")
computed code = match(status, ["open", 1], ["closed", 0], -1)
```

**Additional rule:** All `match` keys must be the same primitive comparable type as the first argument, and all arm values must unify with the default value. Mixing result types such as `number` and `string` is invalid.

---

### Error: Invalid argmax/argmin candidate shape

```mel
// ❌ BROKEN
computed best = argmax(candidates, "first")
computed best = argmax(["a", true, 1], ["b", 2, 3], tieBreak)
computed best = argmax(["a", true, 1], ["b", true, "high"], "last")
```

**Error:** `SemanticError: 'argmax'/'argmin' require inline [label, eligible, score] candidates and a literal tie-break.`

**Rule violated:** `argmax()` and `argmin()` do not accept runtime arrays. Each candidate must be written inline as `[label, eligible, score]`, where `eligible` is boolean and `score` is number. The final argument must be the literal `"first"` or `"last"`.

```mel
// ✅ FIXED
computed best = argmax(
  ["a", candidateA, scoreA],
  ["b", candidateB, scoreB],
  "first"
)
```

**Additional rule:** If all candidates are ineligible, the result is `null`, not an error.

**Tie-break rule:** For equal eligible scores, `"first"` chooses the earliest source-order candidate and `"last"` chooses the latest one.

---

### Note: len() on Record

```mel
// ✅ VALID
computed taskCount = len(tasks)
```

`len()` works on strings, arrays, and records/objects. For records it returns the key count.

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

action loadTaskIds() {
  once(loadingKeys) {
    patch loadingKeys = $meta.intentId
    effect record.keys({ source: tasks, into: taskIds })
  }
}
when eq(len(taskIds), 0) { ... }         // Check key count
```

---

### Error: Invalid spread operand

```mel
// ❌ BROKEN
computed badArray = { ...items }
computed badRecord = { ...tasks }
computed badNumber = { ...count }
```

**Error:** `SemanticError: Object spread operands must be object-shaped or T | null where T is object-shaped.`

**Rule violated:** Current MEL admits object-literal spread only for object operands. Arrays, records, primitives, and unsupported object-only unions are outside the current contract.

```mel
// ✅ FIXED: Spread only objects, or stay in canonical merge()/patch forms
computed fullProfile = { ...profile, status: "active" }

action markDone(id: string) {
  when true {
    patch tasks[id] merge { done: true }
  }
}
```

---

### Error: Nullable or optional spread result used as required target

```mel
// ❌ BROKEN
type Draft = {
  customerId: string,
  appliedCouponId: string | null,
  submissionState: "idle" | "submitted"
}

state { draft: Draft | null = null }

action bad(customerId: string) {
  onceIntent {
    patch draft = {
      ...draft,
      submissionState: "submitted"
    }
  }
}
```

**Error:** `SemanticError: Optional spread contributors cannot satisfy required target fields without an unconditional contribution.`

**Rule violated:** If a field comes only from a nullable spread operand or optional source field, it remains optional until later contributed unconditionally.

```mel
// ✅ FIXED: Contribute required fields explicitly
action good(customerId: string) {
  onceIntent {
    patch draft = {
      ...draft,
      customerId: customerId,
      appliedCouponId: null,
      submissionState: "submitted"
    }
  }
}
```

---

### Error: Optional spread-result field used without normalization

```mel
// ❌ BROKEN
computed partialDraft = { ...draft }
computed label = concat("customer=", partialDraft.customerId)
```

**Error:** `SemanticError: Optional spread-result field reads behave as T | null and must be normalized before a non-null sink.`

**Rule violated:** Optional fields introduced by spread are observed as nullable at the read boundary.

```mel
// ✅ FIXED: Normalize explicitly
computed partialDraft = { ...draft }
computed label = concat("customer=", coalesce(partialDraft.customerId, "unknown"))
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
// ❌ BROKEN
state {
  id: string = $system.uuid
  createdAt: number = $system.timestamp
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
    patch id = $system.uuid
    patch createdAt = $system.timestamp
  }
}
```

---

## Annotation Errors

### Error: @meta inside an action body (`E053`)

```mel
// ❌ BROKEN
action archive(id: string) {
  @meta("ui:button")
  when true {
    patch lastArchivedId = id
  }
}
```

**Error:** `E053 SyntaxError: @meta can attach only to domain, type, type field, state field, computed, or action declarations.`

**Rule violated:** `@meta` attaches to the immediately following declaration or field, not to control-flow statements inside an action body.

```mel
// ✅ FIXED: Move @meta to the action declaration
@meta("ui:button")
action archive(id: string) {
  when true {
    patch lastArchivedId = id
  }
}
```

---

### Error: Non-literal annotation payload (`E055`)

```mel
// ❌ BROKEN
@meta("ui:button", { disabled: eq(len(items), 0) })
action archive() {
  when true {
    patch lastArchivedId = "done"
  }
}
```

**Error:** `E055 SemanticError: Annotation payloads must be JSON-like literals. MEL expressions are not allowed in @meta payloads.`

**Rule violated:** `@meta` payloads are tooling data, not semantic expressions.

```mel
// ✅ FIXED: Use literal metadata only
@meta("ui:button", { variant: "secondary", disabledByDefault: false })
action archive() {
  when true {
    patch lastArchivedId = "done"
  }
}
```

---

### Error: Annotation payload nesting too deep (`E056`)

```mel
// ❌ BROKEN
@meta("ui:card", { config: { pricing: { free: "$0" } } })
computed cardVariant = "free"
```

**Error:** `E056 SemanticError: Annotation payload nesting exceeds the current MEL limit of 2 levels.`

**Rule violated:** Current `@meta` payloads may use JSON-like literals only, with nesting depth capped at 2.

```mel
// ✅ FIXED: Flatten the payload
@meta("ui:card", { tier: "free", priceLabel: "$0" })
computed cardVariant = "free"
```

---

### Error: Annotation on action parameter (`E054`)

```mel
// ❌ BROKEN
action create(
  @meta("ui:date-picker") dueDate: string
) {
  when true {
    patch nextDueDate = dueDate
  }
}
```

**Error:** `E054 SyntaxError: Action-parameter annotations are not part of the current MEL syntax.`

**Rule violated:** `action_param` annotations are deferred from the current v1 MEL contract.

```mel
// ✅ FIXED: Move metadata to the action for now
@meta("ui:date-picker-form")
action create(dueDate: string) {
  when true {
    patch nextDueDate = dueDate
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

// For time, use $system.timestamp (provided by Host)
action timestamp() {
  when true {
    patch createdAt = $system.timestamp
  }
}

// Random is only allowed via $system.random inside actions
action seed() {
  when true {
    patch seed = $system.random
  }
}
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

### Error: Adjacent JavaScript forms around object spread

```mel
// ❌ BROKEN
computed copy = [...items]
computed keyed = { [name]: value }
computed maybeName = profile?.name
```

**Error:** `SyntaxError: Object spread is the only bounded JavaScript-like sugar admitted in current MEL.`

**Rule violated:** MEL admits object-literal spread only. Array spread, computed keys, rest patterns, and optional chaining remain unsupported.

```mel
// ✅ FIXED: Stay inside current MEL surface
computed copied = append([], at(items, 0), at(items, 1))
computed explicit = { name: value }
computed safeName = coalesce(profile.name, "unknown")
```

---

## Summary

| Error Category | Common Cause | Fix |
|----------------|--------------|-----|
| Hidden iteration | Using effect-level `array.filter/map()` in computed | Use expression builtins `filter()` / `map()` |
| Aggregation | Nested calls in sum/min/max | Prepare data with effect first |
| Bounded sugar shape | Wrong arity or malformed `match` / `argmax` / `argmin` | Use the fixed function forms with inline tuple literals |
| Effect in computed | Thinking computed can do IO | Move to action |
| Unguarded statement | Missing when/once | Add guard |
| Non-boolean condition | Truthy coercion assumption | Use explicit comparison |
| Collection comparison | Using eq on arrays/records | Check len() or properties |
| Method call | JavaScript habits | Use function calls |
| $ in identifier | Naming convention | Use regular identifiers |
| stop as waiting | Misunderstanding semantics | Use fail or early-exit style |

---

*End of MEL Error Guide*
