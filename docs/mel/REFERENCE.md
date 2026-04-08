# MEL Reference

> **Purpose:** The single document a user reads to learn and use MEL. Covers every function, construct, and pattern with examples.
> **Audience:** Developers writing MEL domains. Both beginners and experienced users.
> **Normative sources:** SPEC-v1.0.0.md (current full compiler contract), validator.ts (function signatures), lower-expr.ts (supported functions).

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

  computed taskCount = len(keys(tasks))
  computed hasUndone = gt(taskCount, 0)

  action addTask(title: string) {
    when eq(trim(title), "") {
      fail "MISSING_TITLE"
    }
    onceIntent when neq(trim(title), "") {
      patch tasks[$system.uuid] = {
        id: $system.uuid,
        title: trim(title),
        done: false
      }
    }
  }

  action completeTask(id: string) {
    when eq(at(tasks, id), null) {
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
computed label = gt(count, 0) ? "Positive" : "Non-positive"
computed display = eq(status, "loading") ? "Loading..." : result

// Aggregation (array only, no composition)
computed total = sum(prices)
computed lowestPrice = min(prices)
computed highestPrice = max(prices)
computed itemCount = len(items)

// Object decomposition
computed taskIds = keys(tasks)
computed taskList = values(tasks)
computed taskPairs = entries(tasks)

// Merge with defaults
computed withDefaults = merge(config, { theme: "light", lang: "en" })
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
| `floor(n)` | `number → number` | Round down to nearest integer. |
| `ceil(n)` | `number → number` | Round up to nearest integer. |
| `round(n)` | `number → number` | Round to nearest integer. |
| `sqrt(n)` | `number → number \| null` | Square root. Returns `null` if `n` is negative. |
| `pow(base, exp)` | `(number, number) → number` | Exponentiation. `pow(2, 10)` = 1024. |
| `min(a, b, ...)` | `(...number) → number` | Minimum of two or more values. See also: `min(arr)` in §5.8. |
| `max(a, b, ...)` | `(...number) → number` | Maximum of two or more values. See also: `max(arr)` in §5.8. |

**Examples:**

```mel
computed subtotal = mul(price, quantity)
computed withTax = mul(subtotal, 1.1)
computed average = div(sum(scores), len(scores))
computed remainder = mod(count, 10)
computed magnitude = abs(neg(value))
computed rounded = round(div(total, 3))
computed hypotenuse = sqrt(add(pow(a, 2), pow(b, 2)))
computed smaller = min(priceA, priceB)
computed largest = max(x, y, z)
```

> **`div` returns null on zero divisor.** If the divisor may be zero, guard with `when neq(divisor, 0)` before using the result, or use `coalesce(div(a, b), 0)`.

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
computed isComplete = eq(status, "done")
computed isNotStarted = eq(status, "idle")
computed hasItems = gt(len(items), 0)
computed isOverBudget = gt(total, budget)
computed inRange = and(gte(value, min), lte(value, max))
```

> **`eq` and `neq` compare primitives only.** You cannot compare arrays or objects. To check if an array is empty, use `eq(len(items), 0)`. To check if a record key exists, use `isNotNull(at(tasks, id))`.

---

### 5.3 Logic

| Function | Signature | Description |
|----------|-----------|-------------|
| `and(a, b, ...)` | `(...boolean) → boolean` | Logical AND. All arguments must be boolean. Variadic. |
| `or(a, b, ...)` | `(...boolean) → boolean` | Logical OR. All arguments must be boolean. Variadic. |
| `not(a)` | `boolean → boolean` | Logical NOT. |
| `cond(c, t, e)` | `(boolean, T, T) → T` | Conditional. Returns `t` if `c` is true, otherwise `e`. Alias: `if`. |

**Examples:**

```mel
computed canSubmit = and(isNotNull(email), neq(trim(email), ""))
computed isInactive = or(eq(status, "idle"), eq(status, "error"))
computed isActive = not(isInactive)
computed label = cond(gt(count, 0), "Has items", "Empty")
```

> **Ternary syntax is sugar for `cond`.** `x ? a : b` compiles to `cond(x, a, b)`.

> **Truthy/falsy coercion does not exist.** `when items` (using an array as a boolean) is a compile error. Always write an explicit boolean expression: `when gt(len(items), 0)`.

> **`and` and `or` are variadic.** `and(a, b, c)` is valid MEL. There is no `&&` operator between more than two expressions; use `and(a, and(b, c))` or the variadic form.

---

### 5.4 String

| Function | Signature | Description |
|----------|-----------|-------------|
| `concat(a, b, ...)` | `(...string) → string` | Join strings. Variadic. |
| `trim(s)` | `string → string` | Remove leading and trailing whitespace. |
| `lower(s)` | `string → string` | Convert to lowercase. |
| `upper(s)` | `string → string` | Convert to uppercase. |
| `strlen(s)` | `string → number` | String length in characters. |
| `startsWith(s, prefix)` | `(string, string) → boolean` | Returns true if `s` starts with `prefix`. |
| `endsWith(s, suffix)` | `(string, string) → boolean` | Returns true if `s` ends with `suffix`. |
| `strIncludes(s, sub)` | `(string, string) → boolean` | Returns true if `s` contains `sub`. |
| `indexOf(s, sub)` | `(string, string) → number` | Index of first occurrence of `sub` in `s`. Returns -1 if not found. |
| `replace(s, from, to)` | `(string, string, string) → string` | Replace first occurrence of `from` with `to`. |
| `split(s, delimiter)` | `(string, string) → Array<string>` | Split `s` by `delimiter`. Returns an array of strings. |
| `substring(s, start, end?)` | `(string, number, number?) → string` | Extract substring from `start` to `end` (exclusive). |
| `substr(s, start, end?)` | `(string, number, number?) → string` | Alias for `substring`. |

**Examples:**

```mel
computed fullName = concat(firstName, " ", lastName)
computed urlWithParam = concat("/users/", userId)
computed labelCount = concat("Items: ", toString(count))
computed normalized = lower(trim(input))
computed initials = concat(upper(substr(first, 0, 1)), upper(substr(last, 0, 1)))
computed isEmail = strIncludes(email, "@")
computed isAdmin = startsWith(role, "admin_")
computed domain = split(email, "@")
```

> **No method calls.** `email.trim()` does not exist in MEL. Write `trim(email)`.

> **No template literals.** `\`Hello, ${name}\`` does not exist. Write `concat("Hello, ", name)`.

> **Use `toString()` to embed numbers in strings.** `concat("Count: ", count)` may behave unexpectedly — use `concat("Count: ", toString(count))` to make the conversion explicit.

---

### 5.5 Null and Type

| Function | Signature | Description |
|----------|-----------|-------------|
| `isNull(x)` | `T → boolean` | Returns `true` if `x` is `null`. |
| `isNotNull(x)` | `T → boolean` | Returns `true` if `x` is not `null`. |
| `coalesce(a, b, ...)` | `(...T) → T` | Returns the first non-null argument. Variadic. |
| `toString(x)` | `number \| boolean \| null → string` | Convert to string. |
| `toNumber(x)` | `string \| boolean \| null → number` | Convert to number. |
| `toBoolean(x)` | `any → boolean` | Convert to boolean. |

**Examples:**

```mel
computed isSelected = isNotNull(selectedId)
computed displayName = coalesce(user.displayName, user.name, "Anonymous")
computed priceLabel = concat("$", toString(price))
computed safeCount = coalesce(count, 0)

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
| `len(arr)` | `Array<T> → number` | Array length. **Array-only** — use `record.keys` effect for records. |
| `first(arr)` | `Array<T> → T \| null` | First element. Returns `null` if empty. |
| `last(arr)` | `Array<T> → T \| null` | Last element. Returns `null` if empty. |
| `at(arr, i)` | `(Array<T>, number) → T \| null` | Element at numeric index. Returns `null` if out of bounds. |
| `at(rec, k)` | `(Record<K,V>, K) → V \| null` | Value for string key. Returns `null` if key absent. |
| `slice(arr, start, end?)` | `(Array<T>, number, number?) → Array<T>` | Subarray from `start` to `end` (exclusive). |
| `append(arr, item, ...)` | `(Array<T>, ...T) → Array<T>` | Returns new array with items appended. Does not mutate. |
| `includes(arr, item)` | `(Array<T>, T) → boolean` | Returns `true` if `arr` contains `item`. |
| `reverse(arr)` | `Array<T> → Array<T>` | Returns reversed array. Does not mutate. |
| `unique(arr)` | `Array<T> → Array<T>` | Returns array with duplicates removed. |
| `flat(arr)` | `Array<Array<T>> → Array<T>` | Flattens one level of nesting. |
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

**Property access on a computed result uses `field`, not `at`:**

```mel
at(tasks, id).title   // Compiles to: field(at(tasks, id), "title")
first(items).name     // Compiles to: field(first(items), "name")
```

**Examples:**

```mel
computed firstItem = first(items)
computed lastItem = last(items)
computed thirdItem = at(items, 2)
computed taskById = at(tasks, selectedId)
computed page = slice(items, mul(page, 10), mul(add(page, 1), 10))
computed withNew = append(items, newItem)
computed isSelected = includes(selectedIds, id)
computed activeCount = len(filter(items, eq($item.active, true)))
computed names = map(users, $item.name)
computed firstActive = find(items, eq($item.active, true))
computed allDone = every(tasks, eq($item.done, true))
computed anyFailed = some(tasks, eq($item.status, "error"))
computed uniqueIds = unique(allIds)
computed allMembers = flat(teamMemberArrays)
```

> **`len()` works on records and objects.** For records/objects it returns the key count:
> ```mel
> computed taskCount = len(tasks)
> ```

> **`filter`, `map`, `find`, `every`, `some` in computed use `$item` inline.** These are expression-level functions that take a predicate or mapper expression where `$item` refers to the current element. They differ from the effect-level `array.filter` etc. (see §8.1).

---

### 5.7 Object

| Function | Signature | Description |
|----------|-----------|-------------|
| `merge(a, b, ...)` | `(...Object) → Object` | Shallow merge. Later objects override earlier keys. Non-object arguments are skipped. Variadic. |
| `keys(obj)` | `Object → Array<string>` | Object keys. Returns `[]` for null or non-objects. |
| `values(obj)` | `Object → Array<unknown>` | Object values in key order. Returns `[]` for null or non-objects. |
| `entries(obj)` | `Object → Array<[string, unknown]>` | Key-value pairs in key order. Returns `[]` for null or non-objects. |

**Examples:**

```mel
// Merge with defaults (later wins)
computed withDefaults = merge(defaults, config)
computed withOverride = merge(config, { theme: "light" })
computed fullProfile = merge(base, userPrefs, { lastSeen: $meta.timestamp })

// Decompose objects
computed taskIds = keys(tasks)
computed taskList = values(tasks)
computed taskPairs = entries(tasks)

// In actions: update a field without enumerating all fields
action markDone(id: string) {
  when isNotNull(at(tasks, id)) {
    patch tasks[id] = merge(at(tasks, id), { done: true })
  }
}
```

> **`merge()` expression vs `patch merge` operation — these are different constructs.**
>
> | Construct | Level | What it does |
> |-----------|-------|-------------|
> | `merge(a, b)` | Expression | Returns a new merged object. Pure, does not modify state. |
> | `patch path merge expr` | Patch operation | Shallow-merges `expr` into existing state at `path`. |
>
> Both perform shallow merge. `merge()` computes a value; `patch merge` changes state.

> **`field(obj, "prop")` is compiler-internal.** You do not call `field()` directly. When you write `at(tasks, id).title`, the compiler generates `field(at(tasks, id), "title")` automatically. See §5.6.

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
  when gt(count, 0) {
    patch count = 0
  }
}

action submit(email: string) {
  when eq(trim(email), "") {
    fail "MISSING_EMAIL"
  }
  when isNotNull(at(users, email)) {
    fail "DUPLICATE"
  }
  when neq(trim(email), "") {
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
    patch count = add(count, 1)
  }
}
```

**With an additional condition:**

```mel
action addTask(title: string) {
  onceIntent when neq(trim(title), "") {
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
action decrement() available when gt(count, 0) {
  when true {
    patch count = sub(count, 1)
  }
}

action submit() available when and(isNotNull(email), isNull(submittedAt)) {
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
action process(x: number) available when gt($input.x, 0) {  // Error E005
  when true { ... }
}
```

---

### 6.5 `dispatchable when`

Declares the **fine bound-intent gate**. The action may be available in general, but a specific bound intent can still be rejected by `dispatchable when`.

```mel
action shoot(cellIndex: number)
  available when canShoot
  dispatchable when eq(at(cells, cellIndex), "unknown") {
  onceIntent {
    patch cells = updateAt(cells, cellIndex, "pending")
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
  when eq(trim(email), "") {
    fail "MISSING_EMAIL"
  }

  // With message
  when not(strIncludes(email, "@")) {
    fail "INVALID_EMAIL" with "Email must contain @"
  }

  // Dynamic message
  when isNotNull(at(users, email)) {
    fail "DUPLICATE_EMAIL" with concat("Already exists: ", email)
  }

  // Success path
  onceIntent when neq(trim(email), "") {
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
  computed hasAny = gt(count, 0)

  action add(title: string) {
    when eq(trim(title), "") {
      fail "MISSING_TITLE"
    }
    onceIntent when neq(trim(title), "") {
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

  computed emailValid = and(
    gt(strlen(email), 0),
    strIncludes(email, "@")
  )
  computed passwordValid = gte(strlen(password), 8)
  computed canSubmit = and(emailValid, passwordValid)

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

  computed productCount = isNotNull(sortedProducts) ? len(sortedProducts) : 0
  computed hasProducts = gt(productCount, 0)
  computed priceRange = isNotNull(sortedProducts) ?
    sub(max(map(sortedProducts, $item.price)), min(map(sortedProducts, $item.price))) :
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
| String | `concat`, `trim`, `lower`, `upper`, `strlen`, `startsWith`, `endsWith`, `strIncludes`, `indexOf`, `replace`, `split`, `substring`, `substr` |
| Null/Type | `isNull`, `isNotNull`, `coalesce`, `toString`, `toNumber`, `toBoolean` |
| Array | `len`, `first`, `last`, `at`, `slice`, `append`, `includes`, `reverse`, `unique`, `flat`, `filter`, `map`, `find`, `every`, `some` |
| Numeric comparison | `min(a,b,...)`, `max(a,b,...)` |
| Object | `merge`, `keys`, `values`, `entries` |
| Aggregation (computed only) | `sum(arr)`, `min(arr)`, `max(arr)` |

### Common Mistakes

| Mistake | Correct Form |
|---------|-------------|
| `email.trim()` | `trim(email)` |
| `\`Hello ${name}\`` | `concat("Hello ", name)` |
| `when items { }` | `when gt(len(items), 0) { }` |
| `eq(items, [])` | `eq(len(items), 0)` |
| `len(tasks)` (record) | `len(tasks)` |
| `sum(filter(prices))` | Two computed: `computed active = filter(prices, ...)` then `sum(active)` |
| Unguarded `patch count = 1` | `when true { patch count = 1 }` |
| `once` block without marker first | `patch marker = $meta.intentId` must be first statement |
| `$system.uuid` in computed | Only in action body |
| Nested effects | Sequential `once` blocks with `when isNotNull(prev)` |

---

*Authoritative sources: SPEC-v1.0.0.md, packages/compiler/src/analyzer/validator.ts, packages/compiler/src/lowering/lower-expr.ts.*
