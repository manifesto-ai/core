# MEL LLM Context

> **Purpose:** Minimal context for LLMs generating MEL code.
> **Usage:** Include this document in LLM system prompts when generating MEL.

---

## What is MEL?

MEL (Manifesto Expression Language) is a **declarative domain language** for defining state machines.

**MEL is NOT:**
- A programming language
- Turing-complete
- A subset of JavaScript

**MEL expresses:**
- Facts (computed)
- Conditions (when, available when)
- Decisions (fail, stop)
- Declared effects (effect ... into ...)
- Explicit state transitions (patch)

---

## Core Constraints

### Absolute Rules

1. **No loops** — `for`, `while`, `do` do not exist
2. **No user-defined functions** — `function`, arrow functions do not exist
3. **No variables** — `let`, `const`, `var` do not exist
4. **No reduce/fold/scan** — User-defined accumulation forbidden
5. **No method calls** — `str.trim()` is invalid, use `trim(str)`
6. **No template literals** — Use `concat("Hello, ", name)`
7. **$ is reserved** — Never use `$` in user identifiers

### Guard Rules

1. All `patch` must be inside `when` or `once`
2. All `effect` must be inside `when` or `once`
3. All `fail` must be inside `when` or `once`
4. All `stop` must be inside `when` or `once`
5. `once(marker)` must have `patch marker = $meta.intentId` as FIRST statement

### Type Rules

1. `when` condition must be boolean — no truthy/falsy
2. `eq`/`neq` only compare primitives (null, boolean, number, string)
3. `len()` only works on arrays, not records
4. Record iteration uses `record.*` effects (no `keys()` / `values()` builtins)
5. `sum()`/`min()`/`max()` with single arg = array aggregation
6. `min(a,b)`/`max(a,b)` with multiple args = value comparison
7. Complex object types in state must be named (`type X = { ... }`)

---

## Domain Structure

```mel
domain DomainName {
  state {
    field: Type = defaultValue
  }

  computed name = expression

  action name(param: Type) available when condition {
    when condition {
      patch field = expression
      effect type({ args, into: target })
      fail "CODE" with "message"
      stop "reason"
    }
  }
}
```

---

## State Declaration

```mel
type User = { name: string, age: number }
type Task = { id: string, done: boolean }

state {
  // Primitives
  count: number = 0
  name: string = ""
  active: boolean = false

  // Nullable
  selectedId: string | null = null

  // Union (enum)
  status: "idle" | "loading" | "done" = "idle"

  // Collections
  items: Array<string> = []
  tasks: Record<string, Task> = {}

  // Objects
  user: User = { name: "", age: 0 }
}
```

---

## Computed

Pure expressions. No effects. Recalculated on access.

```mel
// Arithmetic
computed doubled = mul(count, 2)
computed total = add(a, b)

// Boolean
computed isEmpty = eq(len(items), 0)
computed canSubmit = and(isNotNull(email), gt(len(items), 0))

// Null handling
computed displayName = coalesce(user.name, "Anonymous")

// Ternary
computed label = gt(count, 0) ? "Positive" : "Zero or negative"

// Aggregation (v0.3.2)
computed sum = sum(prices)           // Array<number> → number
computed min = min(values)           // Array<T> → T | null
computed max = max(values)           // Array<T> → T | null
computed length = len(items)         // Array<T> → number
```

**Forbidden in computed:**
```mel
// ❌ effect in computed
computed filtered = effect array.filter(...)

// ❌ $system in computed
computed now = $system.timestamp

// ❌ Nested aggregation
computed total = sum(filter(prices))
```

---

## Action

State transitions with guards.

```mel
action increment() {
  when true {
    patch count = add(count, 1)
  }
}

action addAmount(amount: number) {
  when gt(amount, 0) {
    patch count = add(count, amount)
  }
}

// With precondition
action decrement() available when gt(count, 0) {
  when true {
    patch count = sub(count, 1)
  }
}
```

**Input access:** `$input.field` is an explicit alias for action parameters.  
**Note:** `$input` is **not** allowed in `available when`.

---

## Guards

### when

Conditional execution. Must have boolean condition.

```mel
// ✅ Correct
when eq(status, "idle") { ... }
when gt(len(items), 0) { ... }
when isNotNull(selectedId) { ... }

// ❌ Wrong - not boolean
when items { ... }        // Array not boolean
when count { ... }        // Number not boolean
when user.name { ... }    // String not boolean
```

### once

Per-intent idempotency. Marker patch MUST be first.

```mel
action submit() {
  once(submitIntent) {
    patch submitIntent = $meta.intentId    // MUST be first
    patch status = "loading"
    effect api.submit({ data: form, into: result })
  }
}

// With condition
once(step2) when isNotNull(step1Result) {
  patch step2 = $meta.intentId
  effect process({ data: step1Result, into: step2Result })
}
```

---

## Patch Operations

```mel
// Set value
patch count = add(count, 1)
patch user.name = "Alice"
patch items[id] = newItem

// Remove key from Record
patch tasks[id] unset

// Shallow merge
patch settings merge { theme: "dark" }
```

---

## Effects

Declare requirements. Host executes. Results go to `into:`.

```mel
// API
effect api.fetch({ url: "/data", method: "GET", into: data })
effect api.post({ url: "/items", body: payload, into: result })

// Array operations - use $item for current element
effect array.filter({
  source: items,
  where: eq($item.active, true),
  into: activeItems
})

effect array.map({
  source: items,
  select: { id: $item.id, name: upper($item.name) },
  into: transformed
})

effect array.sort({
  source: items,
  by: $item.createdAt,
  order: "desc",
  into: sorted
})

effect array.flatMap({
  source: teams,
  select: $item.members,
  into: allMembers
})

// Record operations
effect record.keys({ source: tasks, into: taskIds })
effect record.values({ source: tasks, into: taskList })
```

**Effects must be sequential, not nested:**
```mel
// ❌ Wrong - nested effect
effect array.map({
  source: items,
  select: effect array.filter(...)  // NESTED - forbidden
})

// ✅ Correct - sequential
once(step1) {
  patch step1 = $meta.intentId
  effect array.flatMap({ source: items, select: $item.children, into: allChildren })
}
once(step2) when isNotNull(allChildren) {
  patch step2 = $meta.intentId
  effect array.filter({ source: allChildren, where: $item.active, into: activeChildren })
}
```

---

## Error Handling

### fail — Error termination

```mel
when eq(trim(email), "") {
  fail "MISSING_EMAIL"
}

when not(isValidEmail(email)) {
  fail "INVALID_EMAIL" with "Email format is invalid"
}

when isNotNull(at(users, email)) {
  fail "DUPLICATE" with concat("Already exists: ", email)
}
```

### stop — Early exit (success, no-op)

```mel
// Already in desired state
when eq(task.completed, true) {
  stop "already_completed"
}

// Nothing to do
when eq(len(items), 0) {
  stop "no_items_to_process"
}
```

**stop is NOT waiting:**
```mel
// ❌ Wrong semantics
stop "Waiting for approval"
stop "Pending review"

// ✅ Correct semantics
stop "already_processed"
stop "skipped_no_action_needed"
```

---

## Builtin Functions

### Arithmetic
| Function | Description |
|----------|-------------|
| `add(a, b)` | a + b |
| `sub(a, b)` | a - b |
| `mul(a, b)` | a * b |
| `div(a, b)` | a / b (null if b=0) |
| `mod(a, b)` | a % b |
| `neg(a)` | -a |

### Comparison
| Function | Description |
|----------|-------------|
| `eq(a, b)` | a == b (primitives only) |
| `neq(a, b)` | a != b (primitives only) |
| `lt(a, b)` | a < b |
| `lte(a, b)` | a <= b |
| `gt(a, b)` | a > b |
| `gte(a, b)` | a >= b |

### Logic
| Function | Description |
|----------|-------------|
| `and(a, b)` | a && b |
| `or(a, b)` | a \|\| b |
| `not(a)` | !a |

### Null
| Function | Description |
|----------|-------------|
| `isNull(x)` | x === null |
| `isNotNull(x)` | x !== null |
| `coalesce(a, b)` | a ?? b |

### Array
| Function | Description |
|----------|-------------|
| `len(arr)` | Array length |
| `first(arr)` | First element or null |
| `last(arr)` | Last element or null |
| `at(arr, i)` | Element at index or null |
| `sum(arr)` | Sum of numeric array |
| `min(arr)` | Minimum or null |
| `max(arr)` | Maximum or null |

### Record
| Function | Description |
|----------|-------------|
| `at(rec, k)` | Value for key or null |

### Record Effects
| Effect | Description |
|--------|-------------|
| `effect record.keys({ source, into })` | Extract record keys |
| `effect record.values({ source, into })` | Extract record values |
| `effect record.entries({ source, into })` | Extract record entries |

### String
| Function | Description |
|----------|-------------|
| `strlen(s)` | String length |
| `trim(s)` | Remove whitespace |
| `lower(s)` | Lowercase |
| `upper(s)` | Uppercase |
| `concat(...)` | Join strings |

### Value Comparison
| Function | Description |
|----------|-------------|
| `min(a, b, ...)` | Minimum of values |
| `max(a, b, ...)` | Maximum of values |

---

## Common Patterns

### Fetch and Process

```mel
action loadData() {
  once(loading) {
    patch loading = $meta.intentId
    patch status = "loading"
    effect api.fetch({ url: "/items", into: rawItems })
  }

  once(filtering) when isNotNull(rawItems) {
    patch filtering = $meta.intentId
    effect array.filter({
      source: rawItems,
      where: eq($item.active, true),
      into: items
    })
  }

  when and(isNotNull(rawItems), isNotNull(items)) {
    patch status = "done"
  }
}
```

### System Values (v0.3.0+)

System values are IO and only allowed inside action bodies.

```mel
// Allowed in actions (compiler inserts system.get effects)
patch id = $system.uuid
patch createdAt = $system.timestamp
patch random = $system.random
```

**Forbidden:**
```mel
computed now = $system.timestamp   // System values not allowed in computed
state { id: string = $system.uuid } // Not allowed in state defaults
```

### CRUD with Validation

```mel
action create(title: string) {
  when eq(trim(title), "") {
    fail "MISSING_TITLE"
  }

  once(creating) when neq(trim(title), "") {
    patch creating = $meta.intentId
    patch items[$system.uuid] = {
      id: $system.uuid,
      title: trim(title),
      done: false
    }
  }
}

action delete(id: string) {
  when eq(at(items, id), null) {
    fail "NOT_FOUND" with concat("Item not found: ", id)
  }

  when isNotNull(at(items, id)) {
    patch items[id] unset
  }
}
```

### Toggle with Idempotency

```mel
action toggle(id: string) {
  when eq(at(items, id), null) {
    fail "NOT_FOUND"
  }

  once(toggling) when isNotNull(at(items, id)) {
    patch toggling = $meta.intentId
    patch items[id].done = not(at(items, id).done)
  }
}
```

---

## Generation Checklist

When generating MEL:

1. [ ] All patches inside `when` or `once`?
2. [ ] All effects inside `when` or `once`?
3. [ ] `once()` has marker patch as FIRST statement?
4. [ ] `when` conditions are boolean expressions?
5. [ ] No method calls (use function calls)?
6. [ ] No `$` in user identifiers?
7. [ ] No loops, variables, or function definitions?
8. [ ] Effects are sequential, not nested?
9. [ ] Using `eq(len(arr), 0)` not `eq(arr, [])`?
10. [ ] Using `isNotNull()` not truthy check?
11. [ ] Record keys/values via `record.*` effects (not `keys()` / `values()`)?
12. [ ] $system.* only in action bodies (never in computed/state init)?

---

*End of MEL LLM Context*
