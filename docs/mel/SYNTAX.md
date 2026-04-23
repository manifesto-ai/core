# MEL Syntax Cookbook

> **Purpose:** Hands-on syntax reference for writing correct MEL code.
> **Audience:** Developers learning MEL syntax.
> **Not covered here:** Philosophy, rationale, or design decisions — see SPEC.md and FDR.md.

---

## Table of Contents

1. [Domain Structure](#domain-structure)
2. [State](#state)
3. [Computed](#computed)
4. [Action](#action)
5. [Control Flow](#control-flow)
6. [Effects](#effects)
7. [Quick Reference](#quick-reference)

---

## Domain Structure

Every MEL file defines exactly one domain:

```mel
domain Counter {
  state {
    count: number = 0
  }

  computed doubled = mul(count, 2)

  action increment() {
    when true {
      patch count = add(count, 1)
    }
  }
}
```

### Structural Annotations (`@meta`)

Use `@meta` to attach tooling-only metadata to the next declaration or field.

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

  @meta("ui:primary-list")
  computed hasArchivedTask = isNotNull(lastArchivedId)

  @meta("ui:button", { variant: "secondary" })
  action archive(id: string) {
    when true {
      patch lastArchivedId = id
    }
  }
}
```

Rules:
- `@meta` attaches to the immediately following construct.
- Current targets are `domain`, `type`, `type field`, `state field`, `computed`, and `action`.
- Multiple annotations may stack on the same target, and their source order is preserved.
- Repeated tags on the same target are preserved; the compiler does not deduplicate them.
- Payload must be JSON-like literal data only.
- Payload nesting depth is capped at 2 levels.
- Annotations do not change `compute()`, `available when`, or `dispatchable when`.
- Unsupported attachment sites emit `E053`.
- `action_param` annotations are not part of current MEL syntax.

---

## State

State declares the domain's mutable fields with types and default values.

### Named Types

Complex object types in state must be declared via `type`.

```mel
type User = { name: string, age: number }
type Task = { id: string, done: boolean }
```

### Basic State

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
}
```

### Arrays

```mel
state {
  items: Array<string> = []
  prices: Array<number> = []
}
```

### Records (Key-Value Maps)

```mel
state {
  tasks: Record<string, Task> = {}
  users: Record<string, User> = {}
  taskIds: Array<string> | null = null
}
```

### Nullable Types

```mel
state {
  lastIntent: string | null = null
  selectedId: string | null = null
}
```

### Object Types (Named)

```mel
state {
  user: User = { name: "", age: 0 }
}
```

### Forbidden State Examples

```mel
// ❌ COMPILE ERROR: No default value
state {
  count: number    // Error: Default value required
}

// ❌ COMPILE ERROR: $ in identifier
state {
  $myVar: number = 0     // Error: $ is reserved
  my$count: number = 0   // Error: $ prohibited anywhere
}

// ❌ COMPILE ERROR: System value in initializer
state {
  id: string = $system.uuid          // Error: Must be deterministic
  createdAt: number = $system.timestamp // Error: Must be deterministic
}
```

---

## Computed

Computed values are pure expressions derived from state. They are recalculated on every access, never stored.

### Basic Computed

```mel
computed doubled = mul(count, 2)
computed isPositive = gt(count, 0)
computed greeting = concat("Hello, ", name, "!")
```

### Boolean Conditions

```mel
computed isEmpty = eq(len(items), 0)
computed hasItems = gt(len(items), 0)
computed isActive = and(eq(status, "active"), gt(count, 0))
computed canSubmit = and(isNotNull(email), neq(trim(email), ""))
```

### Null Handling

```mel
computed displayName = coalesce(user.name, "Anonymous")
computed safeValue = coalesce(selectedId, "none")
```

### Ternary Expressions

```mel
computed label = gt(count, 0) ? "Positive" : "Non-positive"
computed display = eq(status, "loading") ? "Please wait..." : result
```

### Object Functions

Object expression functions operate on objects and return new values — they do NOT modify state.

```mel
// Spread-first composition (later contributors win)
computed withDefaults = { theme: "light", lang: "en", ...config }
computed fullProfile = { ...baseProfile, ...userOverrides, lastSeen: $meta.timestamp }

// Decompose objects
computed taskIds = keys(tasks)
computed taskList = values(tasks)
computed taskPairs = entries(tasks)

// Key use case: override fields without enumerating all
// Without object composition — must list EVERY field:
//   effect array.map({ source: items, select: { id: $item.id, name: $item.name, ... }, into: result })
// With spread — only specify overrides:
effect array.map({
  source: items,
  select: { ...$item, status: "active" },
  into: processedItems
})
```

Object spread is also part of the current MEL surface, but only inside object literals:

```mel
computed effectiveConfig = {
  theme: "light",
  locale: "en",
  ...userPrefs
}

computed shippedOrder = { ...order, status: "shipped" }
```

Compatibility note: keep using `merge(...)` and `patch path merge expr` only when you need syntax that compiles across older pre-v1.2 compiler branches.

Rules:
- `{ ...expr, key: value }` is the sole parser-level shorthand admitted in MEL.
- It lowers through `merge(...)`; it does not add a new runtime IR kind.
- It is only valid inside object literals.
- Array spread, rest destructuring, computed keys, and optional chaining are not part of MEL.
- Spread operands must be object-shaped or `T | null` where `T` is object-shaped.
- Direct reads from optional spread-result fields behave like nullable values and usually need `coalesce(...)` before a non-null sink.

### Aggregation Functions

MEL supports primitive aggregation over arrays:

```mel
// Sum: Array<number> → number
computed total = sum(prices)
computed orderTotal = sum(lineItems)

// Min: Array<T> → T | null (null if empty)
computed cheapest = min(prices)
computed earliest = min(timestamps)

// Max: Array<T> → T | null (null if empty)
computed mostExpensive = max(prices)
computed latest = max(timestamps)

// Len: string | Array<T> | object -> number
computed itemCount = len(items)
computed taskCount = len(tasks)
```

### Value Comparison (Multiple Args)

```mel
// min/max with multiple args compares values directly
computed smaller = min(a, b)
computed largest = max(x, y, z)
```

### Bounded Sugar and Finite Selection

These forms are ordinary function calls in MEL source. They remain explicit through validation and lower only at the MEL → Core boundary.

```mel
// Arithmetic sugar
computed error = absDiff(observed, predicted)
computed boundedScore = clamp(score, 0, 100)
computed bucket = idiv(total, bucketSize)
computed missStreak = streak(previousMissStreak, eq(kind, "miss"))

// Finite branch sugar
computed label = match(status, ["open", "Open"], ["closed", "Closed"], "Unknown")

// Fixed candidate selection sugar
computed bestKind = argmax(
  ["coarse", coarseOk, coarseDelta],
  ["repair", repairOk, repairDelta],
  "first"
)

computed cheapestKind = argmin(
  ["coarse", coarseOk, coarseCost],
  ["repair", repairOk, repairCost],
  "last"
)
```

Rules:
- `match()` is function-form only. Each arm must be an inline `[key, value]` pair and the last argument is the default value.
- `argmax()` / `argmin()` only accept inline `[label, eligible, score]` candidates.
- `argmax()` / `argmin()` require a literal `"first"` or `"last"` tie-break as the final argument.
- Runtime-array forms such as `argmax(candidates, "first")` are not supported.

### Forbidden Computed Examples

```mel
// ❌ COMPILE ERROR: Effect in computed
computed filtered = effect array.filter({ source: items, into: result })
// Error: Effects not allowed in computed

// ✅ VALID: expression-level collection builtins
computed filtered = filter(items, eq($item.active, true))
computed names = map(items, $item.name)

// ❌ COMPILE ERROR: nested aggregation
computed total = sum(filter(prices))     // Error: No nested calls
computed avg = div(sum(prices), len(prices))  // ✅ This IS allowed

// ❌ COMPILE ERROR: Arrow-arm match syntax is not supported
computed label = match(status, "open" => "Open", _ => "Unknown")

// ❌ COMPILE ERROR: Runtime-array selection is not supported
computed best = argmax(candidates, "first")

// ❌ COMPILE ERROR: reduce/fold/scan (not in MEL)
computed total = reduce(prices, add, 0)  // Error: reduce doesn't exist

// ❌ COMPILE ERROR: Collection comparison
computed sameArray = eq(items, [])       // Error: Cannot compare Array
computed sameRecord = eq(tasks, {})      // Error: Cannot compare Record

// ✅ CORRECT: Check emptiness
computed isEmpty = eq(len(items), 0)
computed hasNoTasks = eq(len(tasks), 0)

// ❌ COMPILE ERROR: Method calls
computed trimmed = email.trim()          // Error: No method calls
computed lower = name.toLowerCase()      // Error: No method calls

// ✅ CORRECT: Function calls
computed trimmed = trim(email)
computed lower = lower(name)

// ❌ COMPILE ERROR: System values in computed
computed now = $system.timestamp          // Error: System values are IO
```

---

## Action

Actions define state transitions. All mutations must be inside guards (`when` or `once`).

### Basic Action

```mel
action increment() {
  when true {
    patch count = add(count, 1)
  }
}

action reset() {
  when gt(count, 0) {
    patch count = 0
  }
}
```

### Action with Parameters

```mel
action addAmount(amount: number) {
  when gt(amount, 0) {
    patch count = add(count, amount)
  }
}

action setName(name: string) {
  when neq(trim(name), "") {
    patch userName = trim(name)
  }
}
```

### Using $input (Action Parameters)

```mel
action updateUser(name: string, age: number) {
  when true {
    patch user = { name: $input.name, age: $input.age }
  }
}

// Alternative: direct parameter reference
action updateUser(name: string, age: number) {
  when true {
    patch user = { name: name, age: age }
  }
}
```

### Available When (Precondition)

```mel
action decrement() available when gt(count, 0) {
  when true {
    patch count = sub(count, 1)
  }
}

action submit() available when and(isNotNull(email), eq(submittedAt, null)) {
  once(submitIntent) {
    patch submitIntent = $meta.intentId
    effect api.submit({ data: formData, into: result })
  }
}
```

**Note:** `available when` cannot reference `$input.*` or bare action parameter names.

```mel
// ❌ COMPILE ERROR: $input not allowed in available
action process(x: number) available when gt($input.x, 0) {
  when true { patch count = add(count, 1) }
}
```

### Dispatchable When (Bound Intent Gate)

```mel
action shoot(cellIndex: number)
  available when canShoot
  dispatchable when eq(at(cells, cellIndex), "unknown") {
  when true {
    patch cells = updateAt(cells, cellIndex, "pending")
  }
}
```

**Notes:**
- `dispatchable when` may reference action parameters by bare name, but not by direct `$input.*` syntax.
- If both clauses are present, order is fixed: `available when` first, then `dispatchable when`.
- Each clause may appear at most once per action. Wrong ordering and duplicate clauses are compile errors.

```mel
// ❌ COMPILE ERROR: direct $input not allowed in dispatchable
action process(x: number) dispatchable when gt($input.x, 0) {
  when true { patch count = add(count, 1) }
}
```

### Patch Operations

```mel
// Set: Replace value
patch count = add(count, 1)
patch user.name = "Alice"
patch items[$input.id] = newItem

// Unset: Remove key from Record
patch tasks[completedId] unset

// Merge: Shallow merge into state at path
patch user merge { name: "Bob" }
patch settings merge $input.partialSettings

// Set patch with object spread sugar
patch draft = {
  ...draft,
  customerId: customerId,
  appliedCouponId: null,
  submissionState: "submitted"
}
```

> **`patch merge` vs `merge()` expression vs `patch = { ...spread }`:** `patch path merge expr` is a flow-level state operation that shallow-merges into state at `path`. `merge(a, b)` is a pure expression function that returns a new merged object. `patch path = { ...spread }` is still a set patch whose value is the lowered `merge(...)`. See [Object Functions](#object-functions) above.

### System Values

System values are IO and only allowed inside action bodies.

```mel
action create() {
  when true {
    patch id = $system.uuid
    patch createdAt = $system.timestamp
  }
}
```

**Forbidden:**
```mel
computed now = $system.timestamp   // System values not allowed in computed
state { id: string = $system.uuid } // Not allowed in state defaults
```

### Forbidden Action Examples

```mel
// ❌ COMPILE ERROR: Unguarded patch
action bad() {
  patch count = 1    // Error: Must be inside when or once
}

// ❌ COMPILE ERROR: Unguarded effect
action bad() {
  effect api.fetch({ into: data })  // Error: Must be inside guard
}

// ❌ COMPILE ERROR: Direct assignment
action bad() {
  when true {
    count = 5        // Error: Use 'patch count = 5'
  }
}

// ❌ COMPILE ERROR: @meta payload cannot contain MEL expressions
@meta("ui:button", { disabled: eq(len(items), 0) })
action archive() {
  when true {
    patch lastArchivedId = "done"
  }
}

// ❌ COMPILE ERROR: @meta cannot annotate action parameters in current MEL
action create(
  @meta("ui:date-picker") dueDate: string
) {
  when true { }
}

// ❌ COMPILE ERROR: @meta cannot appear inside an action body
action archive() {
  @meta("ui:button")
  when true {
    patch lastArchivedId = "done"
  }
}
```

---

## Control Flow

### when (Conditional Guard)

Guards execute their body only when the condition is true. Re-entry safe.

```mel
action submit() {
  // Only runs when not already submitted
  when eq(submittedAt, null) {
    patch submittedAt = $system.timestamp
    effect api.submit({ data: form, into: result })
  }
}
```

**Condition must be boolean:**

```mel
// ❌ COMPILE ERROR: Non-boolean condition
when items { ... }           // Error: Array is not boolean
when user.name { ... }       // Error: String is not boolean
when count { ... }           // Error: Number is not boolean

// ✅ CORRECT: Explicit boolean expressions
when gt(len(items), 0) { ... }
when isNotNull(user.name) { ... }
when neq(count, 0) { ... }
```

### once (Per-Intent Idempotency)

`once(marker)` ensures a block runs only once per intent. Must include marker patch as first statement.

```mel
action increment() {
  once(lastIntent) {
    patch lastIntent = $meta.intentId    // MUST be first!
    patch count = add(count, 1)
  }
}
```

**With additional condition:**

```mel
action addTask(title: string) {
  once(addingTask) when neq(trim(title), "") {
    patch addingTask = $meta.intentId
    patch tasks[$system.uuid] = { id: $system.uuid, title: title, done: false }
  }
}
```

**Multi-step pipeline:**

```mel
action processData() {
  once(step1) {
    patch step1 = $meta.intentId
    effect array.map({ source: items, select: $item.value, into: mapped })
  }

  once(step2) when isNotNull(mapped) {
    patch step2 = $meta.intentId
    effect array.filter({ source: mapped, where: gt($item, 0), into: filtered })
  }
}
```

### onceIntent (Per-Intent Idempotency, No Guard Fields)

`onceIntent` is a **contextual keyword** that provides per-intent idempotency without requiring a guard field in domain state. The guard state is stored in the platform `$mel` namespace.

```mel
action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}
```

**With additional condition:**

```mel
action addTask(title: string) {
  onceIntent when neq(trim(title), "") {
    patch tasks[$system.uuid] = { id: $system.uuid, title: title, done: false }
  }
}
```

**Contextual keyword rule:**
- `onceIntent` is parsed as a statement **only** at statement start and only when followed by `{` or `when`.
- In all other positions, `onceIntent` is treated as a normal identifier.

### fail (Error Termination)

`fail` terminates the action with an error. Errors are values, not exceptions.

```mel
action createUser(email: string) {
  // Validation failure
  when eq(trim(email), "") {
    fail "MISSING_EMAIL"
  }

  // With message
  when not(isValidEmail(email)) {
    fail "INVALID_EMAIL" with "Email format is invalid"
  }

  // Dynamic message
  when isNotNull(at(users, email)) {
    fail "DUPLICATE_EMAIL" with concat("Already exists: ", email)
  }

  // Success path
  once(creating) when eq(at(users, email), null) {
    patch creating = $meta.intentId
    patch users[email] = { email: email, createdAt: $system.timestamp }
  }
}
```

### stop (Early Exit)

`stop` terminates the action successfully with no action taken. Means "early exit," NOT "waiting."

```mel
action complete(id: string) {
  // Error: Task not found
  when eq(at(tasks, id), null) {
    fail "NOT_FOUND" with concat("Task not found: ", id)
  }

  // Early exit: Already done (success, no-op)
  when eq(at(tasks, id).completed, true) {
    stop "already_completed"
  }

  // Normal path: Mark as complete
  when eq(at(tasks, id).completed, false) {
    patch tasks[id].completed = true
  }
}
```

**Forbidden stop messages:**

```mel
// ❌ LINT ERROR: stop implies waiting/pending
stop "Waiting for approval"     // Error: No waiting semantics
stop "Pending review"           // Error: No pending semantics
stop "Awaiting confirmation"    // Error: No awaiting
stop "On hold"                  // Error: No hold semantics

// ✅ CORRECT: Early exit reasons
stop "already_processed"
stop "no_action_needed"
stop "skipped_by_condition"
```

---

## Effects

Effects declare requirements that Host fulfills. They write results into state via `into:`.

### API Effects

```mel
effect api.fetch({ url: "/users", method: "GET", into: users })

effect api.post({
  url: "/tasks",
  body: { title: title, priority: priority },
  into: result
})
```

### Array Effects

Array effects use `$item` for the current element:

```mel
// Filter: Keep matching elements
effect array.filter({
  source: tasks,
  where: eq($item.completed, false),
  into: activeTasks
})

// Map: Transform each element
effect array.map({
  source: items,
  select: { name: upper($item.title), done: $item.completed },
  into: transformed
})

// FlatMap: Flatten nested arrays
effect array.flatMap({
  source: teams,
  select: $item.members,
  into: allMembers
})

// Sort: Order elements
effect array.sort({
  source: items,
  by: $item.createdAt,
  order: "desc",
  into: sorted
})
```

### Record Effects

```mel
// Get keys
effect record.keys({ source: tasks, into: taskIds })

// Get values
effect record.values({ source: tasks, into: taskList })

// Get entries
effect record.entries({ source: tasks, into: taskEntries })
```

### Effect in Action (Complete Example)

```mel
action loadTasks() {
  once(loading) {
    patch loading = $meta.intentId
    patch status = "loading"
    effect api.fetch({ url: "/tasks", into: tasks })
  }

  once(filtering) when isNotNull(tasks) {
    patch filtering = $meta.intentId
    effect array.filter({
      source: tasks,
      where: eq($item.completed, false),
      into: activeTasks
    })
  }

  when and(isNotNull(tasks), isNotNull(activeTasks)) {
    patch status = "done"
  }
}
```

### Forbidden Effect Examples

```mel
// ❌ COMPILE ERROR: Effect in computed
computed filtered = effect array.filter({ source: items, into: result })

// ❌ COMPILE ERROR: Nested effect
effect array.map({
  source: teams,
  select: {
    members: effect array.filter({ source: $item.members, ... })  // Nested!
  },
  into: result
})

// ✅ CORRECT: Sequential composition
action process() {
  once(step1) {
    patch step1 = $meta.intentId
    effect array.flatMap({ source: teams, select: $item.members, into: allMembers })
  }

  once(step2) when isNotNull(allMembers) {
    patch step2 = $meta.intentId
    effect array.filter({ source: allMembers, where: $item.active, into: activeMembers })
  }
}
```

---

## Quick Reference

### Operators

| Operator | MEL Function | Example |
|----------|--------------|---------|
| `+` | `add(a, b)` | `add(1, 2)` |
| `-` | `sub(a, b)` | `sub(5, 3)` |
| `*` | `mul(a, b)` | `mul(2, 3)` |
| `/` | `div(a, b)` | `div(10, 2)` |
| `%` | `mod(a, b)` | `mod(7, 3)` |
| `==` | `eq(a, b)` | `eq(x, 0)` |
| `!=` | `neq(a, b)` | `neq(x, 0)` |
| `<` | `lt(a, b)` | `lt(x, 10)` |
| `<=` | `lte(a, b)` | `lte(x, 10)` |
| `>` | `gt(a, b)` | `gt(x, 0)` |
| `>=` | `gte(a, b)` | `gte(x, 0)` |
| `&&` | `and(a, b)` | `and(x, y)` |
| `\|\|` | `or(a, b)` | `or(x, y)` |
| `!` | `not(a)` | `not(x)` |
| `??` | `coalesce(a, b)` | `coalesce(x, 0)` |
| `? :` | ternary | `x ? a : b` |

### Builtin Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `len(arr)` | `Array<T> → number` | Array length |
| `sum(arr)` | `Array<number> → number` | Sum of array |
| `min(arr)` | `Array<T> → T \| null` | Minimum (single arg) |
| `max(arr)` | `Array<T> → T \| null` | Maximum (single arg) |
| `min(a, b, ...)` | `(...T) → T` | Minimum value |
| `max(a, b, ...)` | `(...T) → T` | Maximum value |
| `at(arr, i)` | `(Array<T>, number) → T \| null` | Element at index |
| `at(rec, k)` | `(Record<K,V>, K) → V \| null` | Value for key |
| `first(arr)` | `Array<T> → T \| null` | First element |
| `last(arr)` | `Array<T> → T \| null` | Last element |
| `isNull(x)` | `T → boolean` | Is null |
| `isNotNull(x)` | `T → boolean` | Is not null |
| `trim(s)` | `string → string` | Remove whitespace |
| `lower(s)` | `string → string` | Lowercase |
| `upper(s)` | `string → string` | Uppercase |
| `strlen(s)` | `string → number` | String length |
| `concat(...)` | `(...string) → string` | Join strings |
| `merge(a, b, ...)` | `(...Object) → Object` | Shallow merge objects (later wins) |
| `keys(obj)` | `Object → Array<string>` | Object keys |
| `values(obj)` | `Object → Array<unknown>` | Object values |
| `entries(obj)` | `Object → Array<[string, unknown]>` | Key-value pairs |

> **Object spread is syntax, not a builtin.** `{ ...base, status: "active" }` is the current bounded object-literal sugar and lowers through `merge(...)`.

**Property Access vs. Dynamic Lookup:**

| Syntax | IR | Use case |
|--------|-----|----------|
| `state.field` | `get(path)` | Access state/computed by path |
| `expr.prop` | `field(expr, "prop")` | Access property on computed result |
| `coll[key]` | `at(coll, key)` | Dynamic lookup by runtime key |
| `at(coll, key)` | `at(coll, key)` | Explicit dynamic lookup |

```mel
// Static property access on function result
at(items, id).status     // → field(at(items, id), "status")

// Dynamic lookup by key
at(items, id)            // → at(items, id)

// State path access
items.count              // → get("data.items.count")
```

**Note:** `at()` works on both arrays (numeric index) and records (string key). Property access with `.` on a non-path expression uses the `field` IR node, which is semantically distinct from `at()`.

### Record Effects (Quick Reference)

| Effect | Purpose | Example |
|--------|---------|---------|
| `record.keys` | Extract keys | `effect record.keys({ source: tasks, into: taskIds })` |
| `record.values` | Extract values | `effect record.values({ source: tasks, into: taskList })` |
| `record.entries` | Extract entries | `effect record.entries({ source: tasks, into: taskEntries })` |

### Statement Summary

| Statement | Context | Purpose |
|-----------|---------|---------|
| `when expr { }` | Action | Conditional guard |
| `once(marker) { }` | Action | Per-intent idempotency |
| `patch path = expr` | Inside guard | Set value |
| `patch path unset` | Inside guard | Remove key |
| `patch path merge expr` | Inside guard | Shallow merge |
| `effect type({ })` | Inside guard | Declare requirement |
| `fail "CODE"` | Inside guard | Error termination |
| `fail "CODE" with expr` | Inside guard | Error with message |
| `stop "reason"` | Inside guard | Early exit (success) |

---

*End of MEL Syntax Cookbook*
