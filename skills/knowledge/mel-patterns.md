# MEL Patterns

> Source: Compiler SPEC v0.5.0, Compiler FDR v0.5.0
> Last synced: 2026-02-09

## Rules

> **R1**: MEL is pure and total. All expressions terminate, are deterministic, and never throw. [A1-A3]
> **R2**: One pattern per concept. Function calls only, no method chaining. [A6]
> **R3**: Every mutation (patch/effect) MUST be inside a guard (when/once/onceIntent). [A7]
> **R4**: Effects are declarations, not executions. Effects are sequential, never nested. [A20]
> **R5**: `$` is completely prohibited in user identifiers — not just at start, anywhere. [A28]

## Domain Structure

```mel
domain MyApp {
  state {
    count: number = 0
    name: string | null = null
    items: Record<string, Item> = {}
    marker: string | null = null     // for once() guard
  }

  computed total = mul(price, quantity)
  computed hasItems = gt(len(items), 0)

  action increment() { ... }
  action addItem(title: string) { ... }
}
```

## Guard Patterns (Re-Entry Safety)

Every compute cycle re-evaluates the entire flow. Without guards, patches and effects run every cycle.

### `onceIntent` — Per-intent idempotency (preferred)

```mel
action submit() {
  onceIntent {
    patch status = "submitting"
    effect api.submit({ data: formData, into: result })
  }
}
```

Compiler desugars to: stores guard in `$mel.guards.intent`, checks `$meta.intentId`.

### `once(marker)` — Explicit marker guard

```mel
action addTask(title: string) {
  once(addingTask) when neq(trim(title), "") {
    patch addingTask = $meta.intentId    // MUST be first statement
    patch tasks[$system.uuid] = {
      id: $system.uuid,
      title: trim(title),
      completed: false
    }
  }
}
```

Rule: `patch marker = $meta.intentId` MUST be the first statement inside `once()`.

### `when` — Conditional guard

```mel
action setFilter(newFilter: string) {
  when neq(filter, newFilter) {
    patch filter = newFilter
  }
}
```

Conditions MUST be boolean expressions — no truthy/falsy coercion. Use `gt(len(items), 0)` not `when items`.

## Expression Syntax

```mel
// Arithmetic
add(a, b)  sub(a, b)  mul(a, b)  div(a, b)  mod(a, b)  neg(a)

// Math
abs(n)  min(a, b)  max(a, b)  floor(n)  ceil(n)  round(n)  sqrt(n)  pow(base, exp)

// Comparison (primitive-only — cannot compare Array/Object/Record)
eq(a, b)  neq(a, b)  gt(a, b)  gte(a, b)  lt(a, b)  lte(a, b)

// Logical
and(a, b)  or(a, b)  not(a)

// Null handling
isNull(x)  isNotNull(x)  coalesce(a, b, c)

// Conditional
cond(condition, thenValue, elseValue)    // NOT if()

// String
concat("Hello ", name)  trim(s)  lower(s)  upper(s)  substr(s, 0, 10)  strlen(s)

// Conversion
toString(x)

// Array/Collection
len(arr)  first(arr)  last(arr)  at(arr, index)

// Aggregation (primitive arrays only)
sum(arr)  min(arr)  max(arr)
```

No method calls: `str.trim()` is a SyntaxError. Use `trim(str)`.
Index access `x[y]` desugars to `at(x, y)` — works for both Array and Record.

## Effect Syntax

```mel
// Basic effect with into path
effect api.fetchUser({ id: userId, into: userData })

// Collection effects use $item for iteration
effect array.filter({
  source: tasks,
  where: eq($item.completed, false),
  into: activeTasks
})

effect array.map({
  source: users,
  select: { name: $item.name, active: $item.isActive },
  into: userSummaries
})

// Record operations
effect record.filter({ source: items, where: ..., into: items })
effect record.keys({ source: items, into: itemIds })
```

## Multi-Step Actions

```mel
action checkout() {
  // Step 1: Validate
  once(cart.validatedAt) {
    patch cart.validatedAt = $meta.intentId
    effect validate.cart({ items: cart.items, into: cart.validation })
  }

  // Step 2: Pay (only after validation)
  once(payment.processedAt) when cart.validation.success {
    patch payment.processedAt = $meta.intentId
    effect payment.process({ amount: cart.total, into: payment.result })
  }

  // Step 3: Create order (only after payment)
  once(order.createdAt) when payment.result.success {
    patch order.createdAt = $meta.intentId
    effect order.create({ items: cart.items, into: order.result })
  }
}
```

Each `once()` guard ensures its block runs exactly once. Effects write results to Snapshot; subsequent guards read from Snapshot.

## Forbidden Constructs

### Syntactically Forbidden
```mel
let x = 5          // No variables
const y = 10       // No constants
function foo() {}  // No function definitions
for (...) {}       // No loops
while (...) {}     // No loops
str.trim()         // No method calls (use trim(str))
if (cond) {}       // No if/else (use when guard or cond() expression)
throw new Error()  // No exceptions
async/await        // No async
class Foo {}       // No classes
```

### Semantically Forbidden
```mel
filter(items, ...)  // Not a builtin — use effect array.filter()
Date.now()          // Not defined — use $system.time.now
Math.random()       // Not defined — determinism required
```

## LLM Generation Checklist

1. All operations use `functionName(arg1, arg2)` syntax
2. Property access uses `object.property` (no method calls)
3. Index access uses `array[index]` or `record[key]` (desugars to `at()`)
4. Effects use `effect type.name({ param: value, into: path })`
5. Guards use `when condition { body }`, `once(marker) { body }`, or `onceIntent { body }`
6. Iteration variable is always `$item` (current element)
7. Effects are never nested — use sequential effects with intermediate `into:` paths
8. For nested data, use `flatMap` to flatten, then `filter`/`map`, then `groupBy` to restructure
9. All patch/effect must be inside guards
10. Conditions must be boolean expressions — no truthy/falsy (`when items` is wrong)
11. Markers use intentId — `once(m) { patch m = $meta.intentId; ... }`
12. Use correct effect family — `array.*` for Array, `record.*` for Record
13. Use `concat()` for strings — no template literals
14. Use `cond()` not `if()` — `cond(condition, thenValue, elseValue)`
15. Computed can reference computed — scope: Params > Computed > State > System
16. `$system.*` is deduplicated per action — same key = same value
17. `neq(null, string)` = true — different types are never equal
18. `eq`/`neq` are primitive-only — cannot compare Array/Object/Record
19. `$` is completely prohibited in identifiers — not just at start, anywhere
20. `once()` marker must be first — `patch marker = $meta.intentId` as first statement
21. Index access `x[y]` is always `call(at)` in IR — not `get` with index
22. Evaluation is left-to-right — object fields are key-sorted first, then left-to-right
23. `partition` uses top-level `pass:` and `fail:` — not `into: { pass, fail }`
24. `$system.*` only in actions — forbidden in computed and state initializers
25. System values are IO — compiler handles lowering, developer writes surface syntax
26. `__sys__` prefix reserved — user identifiers cannot start with `__sys__` (compile error E004)
27. Readiness uses `eq(intent, intentId)` — NOT `isNotNull(value)`, prevents stale value bugs
28. `available when <Expr>` for action preconditions — must be pure (no effects, no `$system.*`)
29. `fail` and `stop` must be guarded — unconditional is compile error
30. `stop` is early-exit, not "waiting" — `"Waiting for..."` messages are lint errors
31. Named types required — anonymous object types in state are forbidden
32. Type declarations are metadata — AI-readable domain concepts

## Why

**Purity by design**: Impossible to express side effects in grammar = impossible to violate purity.

**AI-Native**: Grammar optimized for LLM generation. One pattern per concept reduces hallucination. Forbidden constructs don't parse, preventing common mistakes.

## Cross-References

- Architecture context: @knowledge/architecture.md
- Effect handler implementation: @knowledge/effect-patterns.md
- Common mistakes: @knowledge/antipatterns.md
