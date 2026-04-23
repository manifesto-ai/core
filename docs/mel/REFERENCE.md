# MEL Reference

> **Purpose:** The single document a user reads to learn and use MEL. Covers every function, construct, and pattern with examples.
> **Audience:** Developers writing MEL domains. Both beginners and experienced users.
> **Normative sources:** SPEC-v1.2.0.md (current full compiler contract), validator.ts (function signatures), lower-expr.ts (supported functions).

This reference treats the current MEL surface as the set of source forms that survive the compiler's parse -> validate -> lower -> compile path in this repo. Historical docs may mention broader helper names; when they conflict with this page, prefer the compile-verified surface documented here.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Domain Structure](#2-domain-structure)
3. [State and Types](#3-state-and-types)
4. [Computed](#4-computed)
5. [Functions Reference](#5-functions-reference)
   - 5.1 [Arithmetic](#51-arithmetic)
   - 5.2 [Comparison](#52-comparison)
   - 5.3 [Logic](#53-logic)
   - 5.4 [String](#54-string)
   - 5.5 [Null and Type](#55-null-and-type)
   - 5.6 [Array and Collection](#56-array-and-collection)
   - 5.7 [Object](#57-object)
   - 5.8 [Aggregation](#58-aggregation)
6. [Actions and Guards](#6-actions-and-guards)
   - 6.1 [when](#61-when)
   - 6.2 [once](#62-once)
   - 6.3 [onceIntent](#63-onceintent)
   - 6.4 [available when](#64-available-when)
   - 6.5 [dispatchable when](#65-dispatchable-when)
   - 6.6 [fail](#66-fail)
   - 6.7 [stop](#67-stop)
7. [Patch Operations](#7-patch-operations)
8. [Effects](#8-effects)
   - 8.1 [Array Effects](#81-array-effects)
   - 8.2 [Record Effects](#82-record-effects)
   - 8.3 [I/O Effects](#83-io-effects)
   - 8.4 [Effect Composition](#84-effect-composition)
9. [System Values](#9-system-values)
10. [Common Patterns](#10-common-patterns)

---

## 1. Overview

MEL (Manifesto Expression Language) is a **declarative, typed language for defining Manifesto domains**. It compiles to DomainSchema, which Core evaluates deterministically.

```
MEL source -> @manifesto-ai/compiler -> DomainSchema -> Core -> Host
```

MEL is a **source format**. It does not execute. It produces data that Core computes on.

The builtin meanings documented in this reference are the current MEL surface. If the compiler later admits extra source-level sugar, it must do so explicitly and lower through the existing MEL → Core boundary without silently changing the meaning of the builtins documented here.

Current bounded exception: object-literal spread is part of the current MEL surface, but only inside object literals and only as a sugar that lowers through `merge(...)`.

Compatibility note: if you still need code that compiles on older pre-v1.2 compiler branches, keep using `merge(...)` and `patch path merge expr`. Current v1.2 compilers accept object-literal spread directly.

This reference prefers sugar-first source forms in examples: `count + 1`, `items[id]`, `a ? b : c`, and `{ ...base, status: "done" }`. Equivalent function-form source is still documented here, but it is folded under the sugar-first examples instead of leading every snippet.

### What MEL is NOT

MEL is not a general-purpose programming language. Specifically:

- No loops (`for`, `while`, `do` do not exist)
- No user-defined functions (`function`, arrow functions do not exist)
- No variables (`let`, `const`, `var` do not exist)
- No method calls (`str.trim()` is invalid — use `trim(str)`)
- No template literals (use `concat("Hello, ", name)`)
- No `reduce`, `fold`, or `scan` (use `sum()`, `min()`, `max()` for aggregation)
- `$` is reserved — never use it in user-defined identifiers

### What MEL expresses

- **State** — the mutable fields of a domain, with types and defaults
- **Computed** — pure derived values, recalculated on every access
- **Actions** — state transitions guarded by conditions
- **Effects** — requirements declared to Host (Host executes, results flow back through Snapshot)

### 30-second example

```mel
domain TaskList {
  type Task = { id: string, title: string, done: boolean }

  state {
    tasks: Record<string, Task> = {}
    status: "idle" | "loading" | "done" = "idle"
  }

  computed taskCount = len(tasks)
  computed hasUndone = taskCount > 0

  action addTask(title: string) {
    when trim(title) == "" {
      fail "MISSING_TITLE"
    }
    onceIntent when trim(title) != "" {
      patch tasks[$system.uuid] = {
        id: $system.uuid,
        title: trim(title),
        done: false
      }
    }
  }

  action completeTask(id: string) {
    when at(tasks, id) == null {
      fail "NOT_FOUND"
    }
    onceIntent when isNotNull(at(tasks, id)) {
      patch tasks[id].done = true
    }
  }
}
```

---

## 2. Domain Structure

Every MEL file defines exactly one domain.

```mel
domain DomainName {
  // Named types (required for complex object fields)
  type TypeName = { field: Type, ... }

  // Mutable state with defaults
  state {
    field: Type = defaultValue
  }

  // Pure derived values
  computed name = expression

  // State transitions with guards
  action name(param: Type)
    available when coarseCondition
    dispatchable when fineCondition {
    when condition {
      patch field = expression
      effect type({ args, into: target })
      fail "CODE" with "message"
      stop "reason"
    }
  }
}
```

**Rules:**
- Domain name must not start with `__` (reserved prefix)
- Exactly one `state` block per domain
- Multiple `computed` and `action` declarations are allowed
- Named `type` declarations must appear before their first use

### Structural Annotations (`@meta`)

`@meta` attaches tooling-only structural metadata to the next declaration or field.

```mel
@meta("doc:summary", { area: "tasks" })
domain TaskBoard {
  @meta("doc:entity")
  type Task = {
    id: string,
    @meta("ui:hidden")
    internalNote: string | null
  }

  state {
    @meta("analytics:track")
    lastArchivedId: string | null = null
  }

  @meta("ui:status")
  computed hasArchivedTask = isNotNull(lastArchivedId)

  @meta("ui:button", { variant: "secondary" })
  action archive(id: string) {
    when true {
      patch lastArchivedId = id
    }
  }
}
```

Current rules:
- `@meta` uses prefix syntax and attaches to the immediately following construct.
- Current attachable targets are `domain`, `type`, `type field`, `state field`, `computed`, and `action`.
- Payload is optional, but when present it must be JSON-like literal data only.
- Payload nesting depth is capped at 2 levels.
- Multiple annotations may stack on the same target.
- Stacked annotations preserve source order.
- Repeated tags on the same target are preserved and are not deduplicated by the compiler.
- `action_param` annotations are not part of the current MEL surface.

Annotations are preserved in a tooling-only compiler sidecar. They do not become part of `DomainSchema`, they do not alter `SchemaGraph`, and they do not change runtime legality or execution behavior.

---

## 3. State and Types

State declares the domain's mutable fields with types and default values.

### Named Types

Complex object types used in state fields must be declared with `type`.

```mel
type User = { name: string, age: number }
type Task = { id: string, title: string, done: boolean }
type Address = { street: string, city: string, zip: string }
```

> **This is NOT optional.** Inline object types in state fields produce a W012 warning. Always define named types for objects.

### Primitive Fields

```mel
state {
  count: number = 0
  name: string = ""
  active: boolean = false
  data: null = null
}
```

### Union Types (Enums)

```mel
state {
  status: "idle" | "loading" | "done" | "error" = "idle"
  role: "admin" | "viewer" | "editor" = "viewer"
}
```

### Nullable Fields

```mel
state {
  selectedId: string | null = null
  result: User | null = null
  lastIntent: string | null = null
}
```

### Arrays

```mel
state {
  items: Array<string> = []
  prices: Array<number> = []
  users: Array<User> = []
}
```

### Records (Key-Value Maps)

```mel
state {
  tasks: Record<string, Task> = {}
  cache: Record<string, string> = {}
}
```

### Objects

```mel
state {
  user: User = { name: "", age: 0 }
  config: Config = { theme: "light", lang: "en" }
}
```

### Forbidden State Patterns

```mel
// NOT ALLOWED: No default value
state {
  count: number    // Error: default value required
}

// NOT ALLOWED: $ in identifier
state {
  $myVar: number = 0    // Error: $ is reserved
}

// NOT ALLOWED: System values in initializers
state {
  id: string = $system.uuid          // Error: must be deterministic
  createdAt: number = $system.time.now  // Error: must be deterministic
}

// NOT ALLOWED: Inline object type (use named type)
state {
  user: { name: string, age: number } = { name: "", age: 0 }  // W012 warning
}
```

---

## 4. Computed

Computed values are pure expressions derived from state. They are recalculated on every access and never stored.

**Rules:**
- No effects in computed
- No `$system.*` in computed (non-deterministic)
- Aggregation functions (`sum`, `min(arr)`, `max(arr)`) only in computed, not in action guards
- No composition inside aggregation calls — argument must be a direct reference

```mel
// Arithmetic
computed doubled = mul(count, 2)
computed subtotal = mul(price, quantity)
computed withTax = mul(subtotal, 1.1)

// Boolean conditions
computed isEmpty = eq(len(items), 0)
computed hasItems = gt(len(items), 0)
computed canSubmit = and(isNotNull(email), neq(trim(email), ""))

// String
computed fullName = concat(firstName, " ", lastName)
computed greeting = concat("Hello, ", name, "!")
computed message = concat("Count: ", toString(count))

// Null handling
computed displayName = coalesce(user.name, "Anonymous")
computed safeId = coalesce(selectedId, "none")

// Ternary
computed label = count > 0 ? "Positive" : "Non-positive"
computed display = status == "loading" ? "Loading..." : result

// Aggregation (array only, no composition)
computed total = sum(prices)
computed lowestPrice = min(prices)
computed highestPrice = max(prices)
computed itemCount = len(items)

// Object decomposition
computed taskIds = keys(tasks)
computed taskList = values(tasks)
computed taskPairs = entries(tasks)

// Object composition
computed withDefaults = { theme: "light", lang: "en", ...config }
```

### Forbidden Computed Patterns

```mel
// NOT ALLOWED: Effect in computed
computed filtered = effect array.filter(...)

// NOT ALLOWED: $system.* in computed
computed now = $system.time.now

// NOT ALLOWED: Aggregation in action guard
action checkout() {
  when gt(sum(prices), 0) { ... }  // Error E009
}

// NOT ALLOWED: Nested aggregation (no composition)
computed bad = sum(filter(prices))    // Error E010
computed bad = min(map(items, $item.price))  // Error E010

// NOT ALLOWED: Method calls
computed bad = email.trim()       // Use: trim(email)
computed bad = name.toLowerCase() // Use: lower(name)

// NOT ALLOWED: Collection comparison with eq/neq
computed bad = eq(items, [])      // Use: eq(len(items), 0)
computed bad = eq(tasks, {})      // Use keys/entries effect then check length
```

---

## 5. Functions Reference

All MEL operations are function calls. Operators (`+`, `-`, `==`, etc.) are syntactic sugar that compile to the canonical function form. This section documents all built-in functions by category.

---

### 5.1 Arithmetic

| Function | Signature | Description |
|----------|-----------|-------------|
| `add(a, b)` | `(number, number) → number` | Addition. Equivalent to `a + b`. |
| `sub(a, b)` | `(number, number) → number` | Subtraction. Equivalent to `a - b`. |
| `mul(a, b)` | `(number, number) → number` | Multiplication. Equivalent to `a * b`. |
| `div(a, b)` | `(number, number) → number \| null` | Division. Returns `null` if `b` is 0. |
| `mod(a, b)` | `(number, number) → number` | Modulo remainder. Equivalent to `a % b`. |
| `neg(a)` | `number → number` | Negation. Equivalent to `-a`. |
| `abs(n)` | `number → number` | Absolute value. |
| `absDiff(a, b)` | `(number, number) → number` | Absolute difference. Sugar for `abs(sub(a, b))`. |
| `floor(n)` | `number → number` | Round down to nearest integer. |
| `ceil(n)` | `number → number` | Round up to nearest integer. |
| `round(n)` | `number → number` | Round to nearest integer. |
| `sqrt(n)` | `number → number \| null` | Square root. Returns `null` if `n` is negative. |
| `pow(base, exp)` | `(number, number) → number` | Exponentiation. `pow(2, 10)` = 1024. |
| `clamp(x, lo, hi)` | `(number, number, number) → number` | Clamp `x` into the inclusive range `[lo, hi]`. Sugar for `min(max(x, lo), hi)`. |
| `idiv(a, b)` | `(number, number) → number \| null` | Integer division via `floor(div(a, b))`. Returns `null` when `b` is 0. |
| `streak(prev, cond)` | `(number, boolean) → number` | Counter sugar: returns `add(prev, 1)` when `cond` is true, otherwise `0`. |
| `min(a, b, ...)` | `(...number) → number` | Minimum of two or more values. See also: `min(arr)` in §5.8. |
| `max(a, b, ...)` | `(...number) → number` | Maximum of two or more values. See also: `max(arr)` in §5.8. |

**Examples:**

```mel
computed subtotal = price * quantity
computed withTax = subtotal * 1.1
computed average = sum(scores) / len(scores)
computed remainder = count % 10
computed magnitude = abs(-value)
computed error = absDiff(observed, predicted)
computed rounded = round(total / 3)
computed hypotenuse = sqrt(pow(a, 2) + pow(b, 2))
computed bounded = clamp(score, 0, 100)
computed buckets = idiv(total, bucketSize)
computed missStreak = streak(previousMissStreak, kind == "shoot" && hit == false)
computed smaller = min(priceA, priceB)
computed largest = max(x, y, z)
```

<details>
<summary>동등한 함수형 표기</summary>

```mel
computed subtotal = mul(price, quantity)
computed withTax = mul(subtotal, 1.1)
computed average = div(sum(scores), len(scores))
computed remainder = mod(count, 10)
computed rounded = round(div(total, 3))
computed hypotenuse = sqrt(add(pow(a, 2), pow(b, 2)))
computed missStreak = streak(previousMissStreak, and(eq(kind, "shoot"), eq(hit, false)))
```

</details>

> **`div` returns null on zero divisor.** If the divisor may be zero, guard with `when neq(divisor, 0)` before using the result, or use `coalesce(div(a, b), 0)`.

> **`clamp`, `idiv`, `streak`, and `absDiff` are lowering-only sugar.** They do not change the meanings of existing builtins such as `abs`, `floor`, `ceil`, `min`, or `max`.

> **`clamp` does not reorder bounds.** `clamp(x, 10, 0)` is malformed intent, not a shorthand for swapping the range. When both bounds are literal, write them in `lo, hi` order.

> **`idiv` uses mathematical floor semantics.** `idiv(-3, 2)` behaves like `floor(div(-3, 2))`, not truncation toward zero.

---

### 5.2 Comparison

| Function | Signature | Description |
|----------|-----------|-------------|
| `eq(a, b)` | `(T, T) → boolean` | Equality. Primitives only: `null`, `boolean`, `number`, `string`. |
| `neq(a, b)` | `(T, T) → boolean` | Inequality. Primitives only. |
| `gt(a, b)` | `(number, number) → boolean` | Greater than. |
| `gte(a, b)` | `(number, number) → boolean` | Greater than or equal. |
| `lt(a, b)` | `(number, number) → boolean` | Less than. |
| `lte(a, b)` | `(number, number) → boolean` | Less than or equal. |

**Examples:**

```mel
computed isComplete = status == "done"
computed isNotStarted = status == "idle"
computed hasItems = len(items) > 0
computed isOverBudget = total > budget
computed inRange = value >= min && value <= max
```

<details>
<summary>동등한 함수형 표기</summary>

```mel
computed isComplete = eq(status, "done")
computed isNotStarted = eq(status, "idle")
computed hasItems = gt(len(items), 0)
computed isOverBudget = gt(total, budget)
computed inRange = and(gte(value, min), lte(value, max))
```

</details>

> **`eq` and `neq` compare primitives only.** You cannot compare arrays or objects. To check if an array is empty, use `eq(len(items), 0)`. To check if a record key exists, use `isNotNull(at(tasks, id))`.

---

### 5.3 Logic

| Function | Signature | Description |
|----------|-----------|-------------|
| `and(a, b, ...)` | `(...boolean) → boolean` | Logical AND. All arguments must be boolean. Variadic. |
| `or(a, b, ...)` | `(...boolean) → boolean` | Logical OR. All arguments must be boolean. Variadic. |
| `not(a)` | `boolean → boolean` | Logical NOT. |
| `cond(c, t, e)` | `(boolean, T, T) → T` | Conditional. Returns `t` if `c` is true, otherwise `e`. |
| `match(key, [k, v], ..., default)` | Function-form only | Finite branch sugar. Each arm is an inline `[key, value]` pair and the last argument is the default value. |
| `argmax([label, eligible, score], ..., tieBreak)` | Function-form only | Deterministic fixed-candidate max selection. `tieBreak` must be `"first"` or `"last"`. Returns `null` if no candidate is eligible. |
| `argmin([label, eligible, score], ..., tieBreak)` | Function-form only | Deterministic fixed-candidate min selection. `tieBreak` must be `"first"` or `"last"`. Returns `null` if no candidate is eligible. |

**Examples:**

```mel
computed canSubmit = email != null && trim(email) != ""
computed isInactive = status == "idle" || status == "error"
computed isActive = !isInactive
computed label = count > 0 ? "Has items" : "Empty"
computed modeLabel = match(mode, ["open", "Open"], ["closed", "Closed"], "Unknown")
computed bestKind = argmax(
  ["coarse", coarseEligible, coarseScore],
  ["repair", repairEligible, repairScore],
  "first"
)
computed cheapestKind = argmin(
  ["small", smallEligible, smallCost],
  ["large", largeEligible, largeCost],
  "last"
)
```

<details>
<summary>동등한 함수형 표기</summary>

```mel
computed canSubmit = and(isNotNull(email), neq(trim(email), ""))
computed isInactive = or(eq(status, "idle"), eq(status, "error"))
computed isActive = not(isInactive)
computed label = cond(gt(count, 0), "Has items", "Empty")
```

</details>

> **Ternary syntax is sugar for `cond`.** `x ? a : b` compiles to `cond(x, a, b)`.

> **Truthy/falsy coercion does not exist.** `when items` (using an array as a boolean) is a compile error. Always write an explicit boolean expression: `when gt(len(items), 0)`.

> **`and` and `or` are variadic.** Chained binary `a && b && c` / `a || b || c` is valid MEL, and `and(a, b, c)` / `or(a, b, c)` is the equivalent function-form source.

> **`match` is function-form only.** Write `match(status, ["open", 1], ["closed", 0], -1)`, not `match(status, "open" => 1, _ => -1)`.

> **`match` arms are literal and unique.** Each arm key must be a literal `string`, `number`, or `boolean`, the call must include at least one arm plus a default value, and duplicate keys are invalid.

> **`argmax` and `argmin` require inline candidate tuples.** They do not accept a runtime array of candidates, and the final `tieBreak` argument must be the literal `"first"` or `"last"`.

> **Tie-break follows source order.** For equal eligible scores, `"first"` selects the earliest candidate and `"last"` selects the latest candidate. If no candidate is eligible, the result is `null`.

---

### 5.4 String

| Function | Signature | Description |
|----------|-----------|-------------|
| `concat(a, b, ...)` | `(...string) → string` | Join strings. Variadic. |
| `trim(s)` | `string → string` | Remove leading and trailing whitespace. |
| `lower(s)` | `string → string` | Convert to lowercase. |
| `upper(s)` | `string → string` | Convert to uppercase. |
| `strlen(s)` | `string → number` | String length in characters. |
| `substring(s, start, end?)` | `(string, number, number?) → string` | Extract substring from `start` to `end` (exclusive). |
| `substr(s, start, end?)` | `(string, number, number?) → string` | Alias for `substring`. |

**Examples:**

```mel
computed fullName = concat(firstName, " ", lastName)
computed urlWithParam = concat("/users/", userId)
computed labelCount = concat("Items: ", toString(count))
computed normalized = lower(trim(input))
computed initials = concat(upper(substr(first, 0, 1)), upper(substr(last, 0, 1)))
computed shortName = substring(name, 0, 10)
```

> **No method calls.** `email.trim()` does not exist in MEL. Write `trim(email)`.

> **No template literals.** `\`Hello, ${name}\`` does not exist. Write `concat("Hello, ", name)`.

> **Use `toString()` to embed numbers in strings.** `concat("Count: ", count)` may behave unexpectedly — use `concat("Count: ", toString(count))` to make the conversion explicit.

> **Historical note:** older docs may mention `startsWith`, `endsWith`, `strIncludes`, `indexOf`, `replace`, or `split`. They are not part of the current compile-verified MEL source surface in this repo.

---

### 5.5 Null and Type

| Function | Signature | Description |
|----------|-----------|-------------|
| `isNull(x)` | `T → boolean` | Returns `true` if `x` is `null`. |
| `isNotNull(x)` | `T → boolean` | Returns `true` if `x` is not `null`. |
| `coalesce(a, b, ...)` | `(...T) → T` | Returns the first non-null argument. Variadic. |
| `typeof(x)` | `T → string` | Returns the observed MEL value kind such as `string`, `number`, `boolean`, `object`, `array`, or `null`. |
| `toString(x)` | `number \| boolean \| null → string` | Convert to string. |

**Examples:**

```mel
computed isSelected = isNotNull(selectedId)
computed displayName = coalesce(user.displayName, user.name, "Anonymous")
computed priceLabel = concat("$", toString(price))
computed safeCount = coalesce(count, 0)
computed inputKind = typeof(input)

// Guard with null check before accessing properties
when isNotNull(at(tasks, id)) {
  patch tasks[id].done = true
}
```

> **Prefer `isNotNull()` over truthy checks.** MEL has no truthiness coercion. `when user` is a compile error. Write `when isNotNull(user)`.

> **`coalesce` returns the first non-null argument, not the first truthy one.** `coalesce(0, 1)` returns `0` because `0` is not null.

---

### 5.6 Array and Collection

| Function | Signature | Description |
|----------|-----------|-------------|
| `len(value)` | `string \| Array<T> \| object \| Record<string, T> → number` | Length or key count. |
| `first(arr)` | `Array<T> → T \| null` | First element. Returns `null` if empty. |
| `last(arr)` | `Array<T> → T \| null` | Last element. Returns `null` if empty. |
| `at(arr, i)` | `(Array<T>, number) → T \| null` | Element at numeric index. Returns `null` if out of bounds. |
| `at(rec, k)` | `(Record<K,V>, K) → V \| null` | Value for string key. Returns `null` if key absent. |
| `slice(arr, start, end?)` | `(Array<T>, number, number?) → Array<T>` | Subarray from `start` to `end` (exclusive). |
| `append(arr, item, ...)` | `(Array<T>, ...T) → Array<T>` | Returns new array with items appended. Does not mutate. |
| `includes(arr, item)` | `(Array<T>, T) → boolean` | Returns `true` if `arr` contains `item`. |
| `filter(arr, pred)` | `(Array<T>, boolean expr) → Array<T>` | Filter using `$item`. |
| `map(arr, expr)` | `(Array<T>, expr) → Array<U>` | Transform using `$item`. |
| `find(arr, pred)` | `(Array<T>, boolean expr) → T \| null` | Find first match using `$item`. |
| `every(arr, pred)` | `(Array<T>, boolean expr) → boolean` | True if all elements match `$item` predicate. |
| `some(arr, pred)` | `(Array<T>, boolean expr) → boolean` | True if any element matches `$item` predicate. |

**The `[]` syntax is sugar for `at()`:**

```mel
items[0]        // at(items, 0)
items[idx]      // at(items, idx)
tasks[id]       // at(tasks, id)
users["admin"]  // at(users, "admin")
```

<details>
<summary>동등한 함수형 표기</summary>

```mel
computed firstItem = at(items, 0)
computed selectedTask = at(tasks, selectedId)
```

</details>

**Property access on a computed result uses `field`, not `at`:**

```mel
at(tasks, id).title   // Compiles to: field(at(tasks, id), "title")
first(items).name     // Compiles to: field(first(items), "name")
```

**Examples:**

```mel
computed firstItem = first(items)
computed lastItem = last(items)
computed thirdItem = items[2]
computed taskById = tasks[selectedId]
computed page = slice(items, mul(page, 10), mul(add(page, 1), 10))
computed withNew = append(items, newItem)
computed isSelected = includes(selectedIds, id)
computed activeCount = len(filter(items, eq($item.active, true)))
computed names = map(users, $item.name)
computed firstActive = find(items, eq($item.active, true))
computed allDone = every(tasks, eq($item.done, true))
computed anyFailed = some(tasks, eq($item.status, "error"))
computed itemCount = len(items)
computed taskCount = len(tasks)
```

> **`len()` works on strings, records, and objects too.** For records/objects it returns the key count:
> ```mel
> computed taskCount = len(tasks)
> ```

> **`filter`, `map`, `find`, `every`, `some` in computed use `$item` inline.** These are expression-level functions that take a predicate or mapper expression where `$item` refers to the current element. They differ from the effect-level `array.filter` etc. (see §8.1).

#### Entity Primitives (`Array<T>` with `.id`)

| Function | Signature | Description |
|----------|-----------|-------------|
| `findById(coll, id)` | `(Array<T>, T.id \| null) → T \| null` | Returns the item whose `.id` matches `id`, or `null` |
| `existsById(coll, id)` | `(Array<T>, T.id \| null) → boolean` | Returns `true` if a matching item exists |
| `updateById(coll, id, updates)` | `(Array<T>, T.id \| null, Partial<T>) → Array<T>` | Shallow-merges `updates` into the matching item |
| `removeById(coll, id)` | `(Array<T>, T.id \| null) → Array<T>` | Removes the matching item |

```mel
computed selectedTask = findById(tasks, selectedId)
computed hasSelectedTask = existsById(tasks, selectedId)

action completeTask(id: string) {
  when !existsById(tasks, id) {
    fail "NOT_FOUND"
  }

  onceIntent when existsById(tasks, id) {
    patch tasks = updateById(tasks, id, {
      done: !findById(tasks, id).done
    })
  }
}

action removeTask(id: string) {
  onceIntent when existsById(tasks, id) {
    patch tasks = removeById(tasks, id)
  }
}
```

Rules:
- `findById()` and `existsById()` are allowed in computed expressions and guards.
- `updateById()` and `removeById()` are patch-RHS transforms only.
- `updateById(removeById(...), ...)` style nesting is forbidden.
- The collection's `.id` values must be unique.

---

### 5.7 Object

| Function | Signature | Description |
|----------|-----------|-------------|
| `merge(a, b, ...)` | `(...Object) → Object` | Shallow merge. Later objects override earlier keys. Non-object arguments are skipped. Variadic. |
| `keys(obj)` | `Object → Array<string>` | Object keys. Returns `[]` for null or non-objects. |
| `values(obj)` | `Object → Array<unknown>` | Object values in key order. Returns `[]` for null or non-objects. |
| `entries(obj)` | `Object → Array<[string, unknown]>` | Key-value pairs in key order. Returns `[]` for null or non-objects. |

**Object spread (current surface):**

```mel
computed effectiveConfig = {
  theme: "light",
  locale: "en",
  ...userPrefs
}

computed shippedOrder = { ...order, status: "shipped" }

action submitDraft(customerId: string) {
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

<details>
<summary>동등한 함수형 표기</summary>

```mel
computed shippedOrder = merge(order, { status: "shipped" })
```

</details>

Current rules:

- Object-literal spread `{ ...expr, key: value }` is the sole parser-level shorthand admitted in MEL.
- It is valid only inside object literals.
- It lowers to canonical `merge(...)` with source order preserved.
- Array spread, rest destructuring, computed keys, and optional chaining are not part of MEL.
- Spread operands must be object-shaped or `T | null` where `T` is object-shaped.
- `Record<string, T>`, arrays, primitives, and object-only multi-branch unions are not valid spread operands in the current contract.

**Examples:**

```mel
// Spread-first object composition (later contributors win)
computed withDefaults = { theme: "light", locale: "en", ...defaults }
computed withOverride = { ...config, theme: "light" }
computed fullProfile = { ...base, ...userPrefs, lastSeen: $meta.timestamp }

// Direct merge() remains available and follows the same typing rules
computed mergedSettings = merge(defaults, config)

// Decompose objects
computed taskIds = keys(tasks)
computed taskList = values(tasks)
computed taskPairs = entries(tasks)

// Patch-layer merge remains distinct from spread sugar
action updateTheme() {
  when true {
    patch settings merge { theme: "light" }
  }
}
```

> **`merge()` expression vs `patch merge` operation vs `patch = { ...spread }` — these are different constructs.**
>
> | Construct | Level | What it does |
> |-----------|-------|-------------|
> | `merge(a, b)` | Expression | Returns a new merged object. Pure, does not modify state. |
> | `patch path = { ...expr, key: value }` | Set patch | Computes a new object value, then replaces state at `path`. |
> | `patch path merge expr` | Patch operation | Shallow-merges `expr` into existing state at `path`. |
>
> All three preserve shallow-merge semantics, but they are not the same operation. `merge()` computes a value, `patch = { ...spread }` is still a `set`, and `patch merge` changes state by patch operation.

> **Presence-aware typing applies to spread and direct `merge()`.** If a field comes only from a nullable spread operand or an optional source field, it remains optional in the result until a later unconditional contributor makes it required.

```mel
computed partialDraft = { ...draft }
computed maybeCustomerId = partialDraft.customerId
computed label = concat("customer=", coalesce(partialDraft.customerId, "unknown"))
```

> Reads from optional spread-result fields are observed as `T | null`. Normalize explicitly with `coalesce(...)` or provide a later unconditional object contribution before using the value in a non-null sink.

> **`field(obj, "prop")` is compiler-internal.** You do not call `field()` directly. When you write `at(tasks, id).title`, the compiler generates `field(at(tasks, id), "title")` automatically. Missing fields are observed as `null`, which is why optional spread-result reads behave as `T | null`.

---

### 5.8 Aggregation

Aggregation functions summarize arrays. They are **only allowed in `computed` expressions**, not in action guards or action bodies.

| Function | Signature | Description |
|----------|-----------|-------------|
| `sum(arr)` | `Array<number> → number` | Sum of a numeric array. Returns `0` for empty arrays. |
| `min(arr)` | `Array<T> → T \| null` | Minimum value. Returns `null` for empty arrays. |
| `max(arr)` | `Array<T> → T \| null` | Maximum value. Returns `null` for empty arrays. |

**Single-argument form (aggregation) vs multi-argument form (comparison):**

| Call | Meaning |
|------|---------|
| `sum(prices)` | Sum all elements in the `prices` array |
| `min(prices)` | Minimum element in the `prices` array |
| `max(prices)` | Maximum element in the `prices` array |
| `min(a, b)` | Smaller of the two values `a` and `b` (§5.1) |
| `max(a, b, c)` | Largest of `a`, `b`, `c` (§5.1) |

**Examples:**

```mel
computed total = sum(prices)
computed average = div(sum(scores), len(scores))
computed range = sub(max(temperatures), min(temperatures))
computed lowestPrice = min(prices)    // null if prices is empty
computed highestPrice = max(prices)   // null if prices is empty
computed itemCount = len(items)
```

> **Aggregation functions require a direct reference.** The argument must be a state path or computed reference — no nested calls.
> ```mel
> // NOT ALLOWED: Composition
> computed bad = sum(filter(prices))         // Error E010
> computed bad = min(map(items, $item.price)) // Error E010
>
> // Correct pattern: Use a computed intermediate
> computed activePrices = filter(prices, gt($item, 0))
> computed activeTotal = sum(activePrices)
> ```

> **Forbidden accumulation functions.** `reduce`, `fold`, `foldl`, `foldr`, and `scan` do not exist in MEL. Any construct implying hidden state progression is forbidden. Use `sum()`, `min()`, `max()` for primitive aggregation.

> **`argmax` and `argmin` are not aggregation functions.** They operate only on statically enumerated candidate tuples such as `argmax(["a", okA, scoreA], ["b", okB, scoreB], "first")`.

---

## 6. Actions and Guards

Actions define state transitions. All `patch`, `effect`, `fail`, and `stop` statements must appear inside a guard (`when`, `once`, or `onceIntent`).

```mel
action name(param: Type) available when condition {
  // Guards and their bodies
}
```

### 6.1 `when`

Conditional execution. The body runs only when the condition is `true`. Re-entry safe — running the same action again re-evaluates the condition.

```mel
action reset() {
  when count > 0 {
    patch count = 0
  }
}

action submit(email: string) {
  when trim(email) == "" {
    fail "MISSING_EMAIL"
  }
  when isNotNull(at(users, email)) {
    fail "DUPLICATE"
  }
  when trim(email) != "" {
    patch users[email] = { email: email, createdAt: $system.time.now }
  }
}
```

**Condition must be a boolean expression:**

```mel
// NOT ALLOWED: truthy/falsy
when items { ... }        // Array is not boolean
when count { ... }        // Number is not boolean
when user.name { ... }    // String is not boolean

// Correct: explicit boolean expressions
when gt(len(items), 0) { ... }
when neq(count, 0) { ... }
when isNotNull(user.name) { ... }
```

**`when` blocks can be nested:**

```mel
action process(id: string) {
  when isNotNull(at(tasks, id)) {
    when eq(at(tasks, id).status, "pending") {
      patch tasks[id].status = "done"
    }
  }
}
```

---

### 6.2 `once`

Ensures a block runs only once per intent ID. Prevents duplicate execution on re-entry (when Host re-runs the same action after an effect completes).

**The marker patch must be the first statement in the `once` block.**

```mel
action increment() {
  once(lastIncrement) {
    patch lastIncrement = $meta.intentId    // MUST be first
    patch count = add(count, 1)
  }
}
```

**With an additional condition:**

```mel
action addTask(title: string) {
  once(creating) when neq(trim(title), "") {
    patch creating = $meta.intentId
    patch tasks[$system.uuid] = {
      id: $system.uuid,
      title: trim(title),
      done: false
    }
  }
}
```

**Multi-step pipeline:**

```mel
action processData() {
  once(step1) {
    patch step1 = $meta.intentId
    effect api.fetch({ url: "/items", into: rawItems })
  }

  once(step2) when isNotNull(rawItems) {
    patch step2 = $meta.intentId
    effect array.filter({
      source: rawItems,
      where: eq($item.active, true),
      into: filtered
    })
  }

  when isNotNull(filtered) {
    patch status = "done"
  }
}
```

**How `once` works:**

`once(marker)` compiles to `when neq(marker, $meta.intentId)`. This means:
- First call with intent A: `neq(null, "A")` = true — runs and sets marker to `"A"`
- Re-entry of intent A: `neq("A", "A")` = false — skips
- New intent B: `neq("A", "B")` = true — runs again

**`once` vs `when isNull`:**
- `once(m) { }` — Per-intent idempotency. Can repeat for a different intent.
- `when isNull(m) { }` — Runs exactly once ever. Permanent.

**Marker field requirements:**
- Must be `string | null` type
- Must be initialized to `null`
- Must not be shared between two `once` blocks

---

### 6.3 `onceIntent`

Per-intent idempotency without requiring a guard field in domain state. The guard state is stored in the platform `$mel` namespace, not in your domain state.

Use `onceIntent` when you want idempotency but do not need the marker field visible in your domain schema.

```mel
action increment() {
  onceIntent {
    patch count = count + 1
  }
}
```

**With an additional condition:**

```mel
action addTask(title: string) {
  onceIntent when trim(title) != "" {
    patch tasks[$system.uuid] = {
      id: $system.uuid,
      title: trim(title),
      done: false
    }
  }
}
```

> **Prefer `onceIntent` over `once` when no explicit guard field is needed.** Use `once(marker)` only when you need the marker field in domain state (e.g., multi-step pipelines that use `when isNotNull(step1)` to chain steps).

---

### 6.4 `available when`

Declares the **coarse action-family gate**. The action is available to be considered only when the condition is true.

```mel
action decrement() available when count > 0 {
  when true {
    patch count = count - 1
  }
}

action submit() available when email != null && submittedAt == null {
  onceIntent {
    patch submittedAt = $system.time.now
    effect api.post({ url: "/submit", body: formData, into: result })
  }
}
```

**`available when` restrictions:**
- Cannot use `$input.*` — parameters are not available at availability check time
- Cannot use bare action parameter names — input does not exist yet
- Cannot use `$meta.*` — metadata is not part of the coarse pre-intent gate
- Cannot use `$system.*` — IO is not available at availability check time
- May appear at most once per action
- Must be a pure expression over state/computed only

```mel
// NOT ALLOWED: $input in available when
action process(x: number) available when $input.x > 0 {  // Error E005
  when true { ... }
}
```

---

### 6.5 `dispatchable when`

Declares the **fine bound-intent gate**. The action may be available in general, but a specific bound intent can still be rejected by `dispatchable when`.

```mel
action shoot(cellIndex: number)
  available when canShoot
  dispatchable when at(cells, cellIndex) == "unknown" {
  onceIntent {
    patch status = "pending"
  }
}
```

**`dispatchable when` rules:**
- May reference state and computed values
- May reference action parameters by bare declared name
- Cannot use direct `$input.*` syntax in MEL source
- Cannot use `$meta.*`, `$system.*`, or effects
- May appear at most once per action
- If both clauses are present, `available when` must appear before `dispatchable when`
- Dispatchability is only considered after coarse availability passes; if `available when` is false, the runtime/query returns `false` without evaluating `dispatchable when`
- Must be a pure expression

Use `dispatchable when` for input-dependent legality that should be rejected **before execution**, not for execution-time narrative failures.

---

### 6.6 `fail`

Terminates the action with an error. Errors are values in Snapshot — they do not throw exceptions.

```mel
action createUser(email: string) {
  // Validation
  when trim(email) == "" {
    fail "MISSING_EMAIL"
  }

  // With message
  when strlen(trim(email)) < 3 {
    fail "EMAIL_TOO_SHORT" with "Email must be at least 3 characters"
  }

  // Dynamic message
  when isNotNull(at(users, email)) {
    fail "DUPLICATE_EMAIL" with concat("Already exists: ", email)
  }

  // Success path
  onceIntent when trim(email) != "" {
    patch users[email] = { email: email, createdAt: $system.time.now }
  }
}
```

**Syntax:**

```mel
fail "ERROR_CODE"
fail "ERROR_CODE" with "static message"
fail "ERROR_CODE" with concat("Dynamic: ", value)
```

---

### 6.7 `stop`

Terminates the action successfully with no action taken. Means "nothing to do" — not "waiting" or "suspended".

```mel
action complete(id: string) {
  when eq(at(tasks, id), null) {
    fail "NOT_FOUND"
  }

  // Already done — exit cleanly with no-op
  when eq(at(tasks, id).done, true) {
    stop "already_completed"
  }

  // Normal path
  when eq(at(tasks, id).done, false) {
    patch tasks[id].done = true
  }
}
```

> **`stop` does not mean waiting, pending, or suspended.** These semantics do not exist in MEL. `stop` means "the action completed successfully but no state change was needed."

```mel
// NOT ALLOWED: stop with waiting semantics
stop "Waiting for approval"    // Incorrect
stop "Pending review"          // Incorrect
stop "Awaiting confirmation"   // Incorrect

// Correct: early exit reasons
stop "already_processed"
stop "no_action_needed"
stop "condition_not_met"
```

---

## 7. Patch Operations

Patches declare state changes. There are exactly three operations.

### `set` (assign)

Replaces the value at a path.

```mel
patch count = add(count, 1)
patch user.name = "Alice"
patch status = "loading"
patch tasks[$system.uuid] = { id: $system.uuid, title: title, done: false }
patch tasks[id].done = true
```

### `unset` (remove)

Removes a key from a record.

```mel
patch tasks[id] unset
patch cache[key] unset
```

### `merge` (shallow merge)

Shallow-merges an object into the value at a path.

```mel
patch user merge { name: "Bob" }
patch settings merge $input.partialSettings
patch tasks[id] merge { done: true, completedAt: $system.time.now }
```

> **`patch merge` is not the same as `merge()`.** See §5.7 for the distinction.

---

## 8. Effects

Effects declare requirements that Host fulfills. They do not execute immediately — Host executes them and writes results back into Snapshot via the `into:` path.

**All effects must be inside a guard.** Effects are never at the top level of an action.

---

### 8.1 Array Effects

Array effects operate on `Array<T>` values. Use `$item` to refer to the current element inside `where`, `select`, and `by` parameters.

**`array.filter` — keep elements matching a condition:**

```mel
effect array.filter({
  source: items,
  where: eq($item.active, true),
  into: activeItems
})
```

**`array.map` — transform each element:**

```mel
// Transform to new object shape
effect array.map({
  source: items,
  select: { id: $item.id, name: upper($item.name) },
  into: transformed
})

// Extract a single field
effect array.map({
  source: users,
  select: $item.name,
  into: names
})

// Enrich without enumerating all fields (use merge)
effect array.map({
  source: items,
  select: merge($item, { status: "active", processed: true }),
  into: enriched
})
```

**`array.sort` — order elements:**

```mel
effect array.sort({
  source: items,
  by: $item.createdAt,
  order: "desc",         // "asc" (default) or "desc"
  into: sorted
})
```

Sort order rules: `null` sorts last. Numbers sort numerically. Strings sort lexicographically. Booleans: `false < true`. Sort is stable (equal elements preserve original order).

**`array.find` — first matching element:**

```mel
effect array.find({
  source: items,
  where: eq($item.id, targetId),
  into: foundItem
})
```

**`array.every` — true if all elements match:**

```mel
effect array.every({
  source: tasks,
  where: eq($item.done, true),
  into: allDone
})
```

**`array.some` — true if any element matches:**

```mel
effect array.some({
  source: tasks,
  where: eq($item.done, false),
  into: hasUndone
})
```

**`array.flatMap` — flatten nested arrays:**

```mel
effect array.flatMap({
  source: teams,
  select: $item.members,
  into: allMembers
})
```

**`array.groupBy` — group elements by key:**

```mel
effect array.groupBy({
  source: items,
  by: $item.category,
  into: byCategory
})
```

**`array.unique` — deduplicate:**

```mel
effect array.unique({
  source: allIds,
  into: uniqueIds
})

// With a key expression
effect array.unique({
  source: items,
  by: $item.id,
  into: deduped
})
```

**`array.partition` — split into two groups:**

```mel
effect array.partition({
  source: items,
  where: eq($item.active, true),
  pass: activeItems,     // elements where condition is true
  fail: inactiveItems    // elements where condition is false
})
```

---

### 8.2 Record Effects

Record effects operate on `Record<K,V>` values. Use these for record collections — do not use array effects on records.

**`record.keys` — extract keys as sorted array:**

Keys are returned in lexicographic order.

```mel
effect record.keys({ source: tasks, into: taskIds })
```

**`record.values` — extract values in key order:**

```mel
effect record.values({ source: tasks, into: taskList })
```

**`record.entries` — extract key-value pairs:**

Returns `Array<{ key: K, value: V }>` in key order.

```mel
effect record.entries({ source: tasks, into: taskEntries })
```

**`record.filter` — filter while preserving record structure:**

`$item` refers to the value (`V`). The result is a `Record<K, V>`.

```mel
effect record.filter({
  source: orders,
  where: gt($item.total, 1000),
  into: highValueOrders
})
```

**`record.mapValues` — transform values while preserving keys:**

```mel
effect record.mapValues({
  source: tasks,
  select: merge($item, { updatedAt: $system.time.now }),
  into: updatedTasks
})
```

**`record.fromEntries` — reconstruct record from entries:**

```mel
effect record.fromEntries({
  source: modifiedEntries,    // Array<{ key: K, value: V }>
  into: rebuiltRecord
})
```

---

### 8.3 I/O Effects

I/O effects are declared to Host. Host is responsible for executing them.

**`api.fetch` — HTTP GET (or other methods):**

```mel
effect api.fetch({
  url: "/users",
  method: "GET",        // Optional, defaults to GET
  headers: { "Authorization": token },   // Optional
  into: users
})

// Dynamic URL
effect api.fetch({
  url: concat("/users/", userId),
  into: user
})
```

**`api.post` — HTTP POST:**

```mel
effect api.post({
  url: "/tasks",
  body: { title: title, priority: priority },
  into: createResult
})
```

**`api.put` — HTTP PUT:**

```mel
effect api.put({
  url: concat("/users/", id),
  body: { name: trim(name) },
  into: updateResult
})
```

**`api.remove` — HTTP DELETE:**

```mel
effect api.remove({
  url: concat("/users/", id),
  into: deleteResult
})
```

**Effect result contract:**

On success, the `into` path receives the result directly. On failure, it receives an error object:

```mel
// Error structure written to into: path
{
  $error: true,
  code: "NETWORK_ERROR",    // or "TIMEOUT", "NOT_FOUND", etc.
  message: "...",
  details: { ... }          // optional
}

// Checking for errors
when and(isNotNull(result), not(result.$error)) {
  // success path
}
when and(isNotNull(result), isNotNull(at(result, "$error"))) {
  // error path: result.code and result.message available
}
```

---

### 8.4 Effect Composition

**Effects MUST NOT be nested.** Effects are statements, not expressions. An effect cannot appear inside another effect's arguments.

```mel
// NOT ALLOWED: Nested effects
effect array.map({
  source: teams,
  select: {
    members: effect array.filter({ source: $item.members, ... })  // Syntax error
  },
  into: result
})
```

**Correct pattern: Sequential `once` blocks:**

```mel
action process() {
  once(step1) {
    patch step1 = $meta.intentId
    effect array.flatMap({ source: teams, select: $item.members, into: allMembers })
  }

  once(step2) when isNotNull(allMembers) {
    patch step2 = $meta.intentId
    effect array.filter({ source: allMembers, where: eq($item.active, true), into: activeMembers })
  }

  once(step3) when isNotNull(activeMembers) {
    patch step3 = $meta.intentId
    effect array.sort({ source: activeMembers, by: $item.name, into: sorted })
  }
}
```

Each step in a pipeline:
1. Guards with `when isNotNull(previousResult)` to wait for the prior step
2. Sets its own marker patch first
3. Declares one effect
4. The next step detects completion by checking its source is non-null

---

## 9. System Values

System values provide access to runtime context and IO. They have two categories: pure values (`$meta.*`, `$input.*`) and IO values (`$system.*`).

### Scope Rules

| Value | Available In | Forbidden In |
|-------|-------------|--------------|
| `$system.time.now` | Action body only | Computed, state init |
| `$system.uuid` | Action body only | Computed, state init |
| `$system.random` | Action body only | Computed, state init |
| `$system.env.<name>` | Action body only | Computed, state init |
| `$input.<field>` | Action body, effect sub-expressions | `available when`, `dispatchable when`, state init |
| `$meta.intentId` | Action body, effect sub-expressions | Computed, `available when`, `dispatchable when`, state init |
| `$meta.actor` | Action body, effect sub-expressions | Computed, `available when`, `dispatchable when`, state init |
| `$meta.authority` | Action body, effect sub-expressions | Computed, `available when`, `dispatchable when`, state init |
| `$item` | Effect `where`, `select`, `by` expressions | Computed, outside effect context |

Bare action parameter names are valid source syntax in action bodies and in `dispatchable when`. Direct `$input.*` remains invalid in `dispatchable when` even though the compiled schema lowers parameter reads to input paths.

### `$system.*` — IO Values

IO values are not pure expressions. The compiler lowers them to `system.get` effects. The values are deduplicated: multiple references to the same `$system.<key>` in the same action use the same value.

```mel
action create(title: string) {
  onceIntent {
    // $system.uuid appears twice but refers to the same value
    patch tasks[$system.uuid] = {
      id: $system.uuid,          // Same UUID as the key
      title: title,
      createdAt: $system.time.now
    }
  }
}
```

| Path | Type | Description |
|------|------|-------------|
| `$system.uuid` | `string` | A UUID. Same value throughout the action. |
| `$system.time.now` | `number` | Current Unix timestamp in milliseconds. |
| `$system.random` | `number` | A random number in [0, 1). |
| `$system.env.<name>` | `string \| null` | Environment variable. `null` if not set. |

> **`$system.*` is forbidden in computed.** System values are IO — they cannot be used in pure expressions.

### `$input.*` — Action Parameters

`$input.<field>` is an explicit alias for action parameters. Both forms work identically:

```mel
action updateUser(name: string, age: number) {
  when true {
    patch user = { name: $input.name, age: $input.age }
    // Equivalent to:
    patch user = { name: name, age: age }
  }
}
```

### `$meta.*` — Intent Context

Available anywhere, including computed expressions.

```mel
// In computed
computed actorLabel = concat("Modified by: ", $meta.actor)

// In actions (once marker pattern)
once(creating) {
  patch creating = $meta.intentId    // Standard once marker
  patch tasks[$system.uuid] = { ... }
}
```

| Path | Type | Description |
|------|------|-------------|
| `$meta.intentId` | `string` | Unique ID of the current intent. Used as `once` markers. |
| `$meta.actor` | `string` | ID of the actor submitting the intent. |
| `$meta.authority` | `string` | ID of the authority that approved the intent. |

### `$item` — Iteration Variable

Available only inside `where`, `select`, and `by` expressions within array/record effects.

```mel
effect array.filter({
  source: items,
  where: and(eq($item.active, true), gt($item.priority, 2)),
  into: filtered
})

effect array.map({
  source: users,
  select: { name: upper($item.name), role: $item.role },
  into: displayUsers
})

effect array.sort({
  source: items,
  by: $item.createdAt,
  into: sorted
})
```

> **`$item` is not available in computed expressions.** It is scoped strictly to effect sub-expressions.

---

## 10. Common Patterns

### CRUD Domain

```mel
domain TodoList {
  type Todo = { id: string, title: string, done: boolean, createdAt: number }

  state {
    todos: Record<string, Todo> = {}
  }

  computed todoIds = keys(todos)
  computed count = len(todoIds)
  computed hasAny = count > 0

  action add(title: string) {
    when trim(title) == "" {
      fail "MISSING_TITLE"
    }
    onceIntent when trim(title) != "" {
      patch todos[$system.uuid] = {
        id: $system.uuid,
        title: trim(title),
        done: false,
        createdAt: $system.time.now
      }
    }
  }

  action complete(id: string) {
    when eq(at(todos, id), null) {
      fail "NOT_FOUND" with concat("Todo not found: ", id)
    }
    when eq(at(todos, id).done, true) {
      stop "already_completed"
    }
    onceIntent when isNotNull(at(todos, id)) {
      patch todos[id].done = true
    }
  }

  action remove(id: string) {
    when eq(at(todos, id), null) {
      fail "NOT_FOUND"
    }
    onceIntent when isNotNull(at(todos, id)) {
      patch todos[id] unset
    }
  }
}
```

### Form Validation

```mel
domain SignupForm {
  state {
    email: string = ""
    password: string = ""
    submitResult: null = null
    submitting: string | null = null
    status: "idle" | "loading" | "done" | "error" = "idle"
  }

  computed emailValid = strlen(trim(email)) > 0
  computed passwordValid = strlen(password) >= 8
  computed canSubmit = emailValid && passwordValid

  action setEmail(value: string) {
    when true {
      patch email = trim(value)
    }
  }

  action setPassword(value: string) {
    when true {
      patch password = value
    }
  }

  action submit() available when canSubmit {
    when not(emailValid) {
      fail "INVALID_EMAIL"
    }
    when not(passwordValid) {
      fail "WEAK_PASSWORD" with "Password must be at least 8 characters"
    }
    once(submitting) {
      patch submitting = $meta.intentId
      patch status = "loading"
      effect api.post({
        url: "/auth/signup",
        body: { email: email, password: password },
        into: submitResult
      })
    }
    when isNotNull(submitResult) {
      patch status = "done"
    }
  }
}
```

### Fetch-Process-Display Pipeline

```mel
domain ProductCatalog {
  type Product = {
    id: string,
    name: string,
    price: number,
    category: string,
    active: boolean
  }

  state {
    rawProducts: Array<Product> | null = null
    filteredProducts: Array<Product> | null = null
    sortedProducts: Array<Product> | null = null

    // Pipeline markers
    loading: string | null = null
    filtering: string | null = null
    sorting: string | null = null

    selectedCategory: string | null = null
    status: "idle" | "loading" | "done" | "error" = "idle"
  }

  computed productPrices = isNotNull(sortedProducts) ? map(sortedProducts, $item.price) : []
  computed productCount = len(productPrices)
  computed hasProducts = productCount > 0
  computed priceRange = hasProducts ?
    max(productPrices) - min(productPrices) :
    0

  action load() {
    once(loading) {
      patch loading = $meta.intentId
      patch status = "loading"
      effect api.fetch({ url: "/products", into: rawProducts })
    }

    once(filtering) when isNotNull(rawProducts) {
      patch filtering = $meta.intentId
      effect array.filter({
        source: rawProducts,
        where: eq($item.active, true),
        into: filteredProducts
      })
    }

    once(sorting) when isNotNull(filteredProducts) {
      patch sorting = $meta.intentId
      effect array.sort({
        source: filteredProducts,
        by: $item.price,
        order: "asc",
        into: sortedProducts
      })
    }

    when isNotNull(sortedProducts) {
      patch status = "done"
    }
  }
}
```

### Working with Records

```mel
domain UserRegistry {
  type User = { id: string, name: string, role: string, active: boolean }

  state {
    users: Record<string, User> = {}
    userIds: Array<string> | null = null

    // Pipeline markers
    indexing: string | null = null
  }

  computed userCount = isNotNull(userIds) ? len(userIds) : 0

  action register(id: string, name: string, role: string) {
    when isNotNull(at(users, id)) {
      fail "ALREADY_EXISTS" with concat("User already registered: ", id)
    }
    onceIntent when eq(at(users, id), null) {
      patch users[id] = { id: id, name: name, role: role, active: true }
    }
  }

  action deactivate(id: string) {
    when eq(at(users, id), null) {
      fail "NOT_FOUND"
    }
    onceIntent when isNotNull(at(users, id)) {
      patch users[id] = merge(at(users, id), { active: false })
    }
  }

  // Refresh the index of user IDs
  action refreshIndex() {
    once(indexing) {
      patch indexing = $meta.intentId
      effect record.keys({ source: users, into: userIds })
    }
  }
}
```

### Toggle with Idempotency

```mel
domain Toggles {
  type Item = { id: string, enabled: boolean }

  state {
    items: Record<string, Item> = {}
  }

  action toggle(id: string) {
    when eq(at(items, id), null) {
      fail "NOT_FOUND"
    }
    onceIntent when isNotNull(at(items, id)) {
      patch items[id].enabled = not(at(items, id).enabled)
    }
  }

  action enable(id: string) {
    when eq(at(items, id), null) {
      fail "NOT_FOUND"
    }
    when eq(at(items, id).enabled, true) {
      stop "already_enabled"
    }
    onceIntent {
      patch items[id].enabled = true
    }
  }
}
```

---

## Quick Reference

### Operator Sugar

| Operator | MEL function | Example |
|----------|-------------|---------|
| `a + b` | `add(a, b)` | `add(count, 1)` |
| `a - b` | `sub(a, b)` | `sub(total, discount)` |
| `a * b` | `mul(a, b)` | `mul(price, qty)` |
| `a / b` | `div(a, b)` | `div(total, count)` |
| `a % b` | `mod(a, b)` | `mod(index, 10)` |
| `a == b` | `eq(a, b)` | `eq(status, "done")` |
| `a != b` | `neq(a, b)` | `neq(count, 0)` |
| `a < b` | `lt(a, b)` | `lt(age, 18)` |
| `a <= b` | `lte(a, b)` | `lte(count, max)` |
| `a > b` | `gt(a, b)` | `gt(score, 0)` |
| `a >= b` | `gte(a, b)` | `gte(len(items), 1)` |
| `a && b` | `and(a, b)` | `and(x, y)` |
| `a \|\| b` | `or(a, b)` | `or(x, y)` |
| `!a` | `not(a)` | `not(done)` |
| `a ?? b` | `coalesce(a, b)` | `coalesce(name, "Anon")` |
| `c ? t : e` | `cond(c, t, e)` | `cond(gt(n, 0), "pos", "neg")` |
| `arr[i]` | `at(arr, i)` | `at(items, 0)` |
| `rec[k]` | `at(rec, k)` | `at(tasks, id)` |

### Guard Summary

| Statement | Purpose | Marker required? |
|-----------|---------|-----------------|
| `when expr { }` | Conditional — runs when `expr` is true | No |
| `once(marker) { }` | Per-intent idempotency — runs once per intent ID | Yes — `patch marker = $meta.intentId` must be first |
| `once(marker) when expr { }` | Per-intent idempotency with extra condition | Yes |
| `onceIntent { }` | Per-intent idempotency — no marker in domain state | No |
| `onceIntent when expr { }` | Per-intent idempotency with extra condition | No |

### Patch Summary

| Statement | Operation |
|-----------|-----------|
| `patch path = expr` | Set — replace value at path |
| `patch path unset` | Unset — remove key from record |
| `patch path merge expr` | Merge — shallow merge `expr` into state at path |

### Function Category Index

| Category | Functions |
|----------|-----------|
| Arithmetic | `add`, `sub`, `mul`, `div`, `mod`, `neg`, `abs`, `floor`, `ceil`, `round`, `sqrt`, `pow` |
| Comparison | `eq`, `neq`, `gt`, `gte`, `lt`, `lte` |
| Logic | `and`, `or`, `not`, `cond` / `if` |
| String | `concat`, `trim`, `lower`, `upper`, `strlen`, `substring`, `substr` |
| Null/Type | `isNull`, `isNotNull`, `coalesce`, `typeof`, `toString` |
| Array | `len`, `first`, `last`, `at`, `slice`, `append`, `includes`, `filter`, `map`, `find`, `every`, `some` |
| Numeric comparison | `min(a,b,...)`, `max(a,b,...)` |
| Object | `merge`, `keys`, `values`, `entries` |
| Entity primitives | `findById`, `existsById`, `updateById`, `removeById` |
| Aggregation (computed only) | `sum(arr)`, `min(arr)`, `max(arr)` |

### Common Mistakes

| Mistake | Correct Form |
|---------|-------------|
| `email.trim()` | `trim(email)` |
| `\`Hello ${name}\`` | `concat("Hello ", name)` |
| `when items { }` | `when gt(len(items), 0) { }` |
| `eq(items, [])` | `eq(len(items), 0)` |
| Legacy `len(keys(tasks))` workaround | `len(tasks)` |
| `sum(filter(prices))` | Two computed: `computed active = filter(prices, ...)` then `sum(active)` |
| Unguarded `patch count = 1` | `when true { patch count = 1 }` |
| `once` block without marker first | `patch marker = $meta.intentId` must be first statement |
| `$system.uuid` in computed | Only in action body |
| Nested effects | Sequential `once` blocks with `when isNotNull(prev)` |

---

*Authoritative sources: SPEC-v1.2.0.md, packages/compiler/src/analyzer/validator.ts, packages/compiler/src/lowering/lower-expr.ts.*
