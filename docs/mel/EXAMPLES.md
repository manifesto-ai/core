# MEL Examples Directory Structure

> **Purpose:** Guide for organizing and exploring MEL example files.

---

## Directory Layout

```
examples/
├── computed/
│   ├── basic.mel          # Basic computed expressions
│   ├── aggregation.mel    # sum, min, max, len
│   ├── boolean.mel        # Boolean conditions
│   └── null-handling.mel  # coalesce, isNull patterns
│
├── action/
│   ├── basic.mel          # Simple actions with when
│   ├── parameters.mel     # Actions with input parameters
│   ├── available.mel      # available when preconditions
│   └── multi-step.mel     # Multi-step pipelines with once
│
├── control/
│   ├── when.mel           # Conditional guards
│   ├── once.mel           # Per-intent idempotency
│   ├── fail.mel           # Error termination
│   └── stop.mel           # Early exit patterns
│
└── effects/
    ├── api.mel            # API fetch/post effects
    ├── array.mel          # filter, map, sort, flatMap
    ├── record.mel         # keys, values, entries
    └── partition.mel      # Splitting arrays
```

---

## How to Explore

### Start Here

1. **New to MEL?** Start with `computed/basic.mel` and `action/basic.mel`
2. **Understanding guards?** Read `control/when.mel` then `control/once.mel`
3. **Working with arrays?** See `effects/array.mel` for iteration patterns
4. **Handling errors?** Check `control/fail.mel` and `control/stop.mel`

### Reading Order for Beginners

```
1. computed/basic.mel       → Pure expressions
2. action/basic.mel         → State mutations with guards
3. control/when.mel         → Conditional execution
4. effects/array.mel        → Declarative iteration
5. control/once.mel         → Idempotency patterns
6. computed/aggregation.mel → sum/min/max
7. control/fail.mel         → Error handling
8. action/multi-step.mel    → Complex flows
```

---

## Folder Descriptions

### `computed/`

Pure expressions that derive values from state. No effects, no mutations.

| File | Contents |
|------|----------|
| `basic.mel` | Arithmetic, string concatenation, property access |
| `aggregation.mel` | `sum(arr)`, `min(arr)`, `max(arr)`, `len(arr)` |
| `boolean.mel` | `and`, `or`, `not`, comparison operators |
| `null-handling.mel` | `coalesce`, `isNull`, `isNotNull`, ternary |

### `action/`

State transitions with guards, patches, and effects.

| File | Contents |
|------|----------|
| `basic.mel` | Simple `when` guards with `patch` |
| `parameters.mel` | Using `$input` and parameter references |
| `available.mel` | `available when` preconditions |
| `multi-step.mel` | Sequential `once` blocks for pipelines |

### `control/`

Flow control statements.

| File | Contents |
|------|----------|
| `when.mel` | Conditional guards, boolean conditions |
| `once.mel` | Per-intent idempotency, marker patterns |
| `fail.mel` | Error termination with codes and messages |
| `stop.mel` | Early exit (no-op success) |

### `effects/`

Host-executed requirements.

| File | Contents |
|------|----------|
| `api.mel` | `effect api.fetch`, `effect api.post` |
| `array.mel` | `filter`, `map`, `sort`, `flatMap` with `$item` |
| `record.mel` | `keys`, `values`, `entries` |
| `partition.mel` | Splitting with `pass` and `fail` targets |

---

## Example File Format

Each example file follows this structure:

```mel
// ============================================
// Title: Basic Computed Expressions
// Description: Shows fundamental computed patterns
// Prerequisites: None
// ============================================

domain Example {
  // --- State ---
  state {
    count: number = 0
    name: string = ""
  }

  // --- Example 1: Arithmetic ---
  // Description of what this shows
  computed doubled = mul(count, 2)

  // --- Example 2: String ---
  computed greeting = concat("Hello, ", name)

  // --- Anti-pattern (what NOT to do) ---
  // ❌ computed wrong = count + 1    // Use mul(count, 2)
}
```

---

## Quick Reference by Task

| I want to... | Look at |
|--------------|---------|
| Add two numbers | `computed/basic.mel` |
| Check if array is empty | `computed/boolean.mel` |
| Sum an array | `computed/aggregation.mel` |
| Update state conditionally | `action/basic.mel` |
| Prevent double execution | `control/once.mel` |
| Filter an array | `effects/array.mel` |
| Handle errors | `control/fail.mel` |
| Skip if already done | `control/stop.mel` |
| Multi-step data processing | `action/multi-step.mel` |

---

*End of Examples Guide*
