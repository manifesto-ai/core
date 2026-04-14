# MEL Examples Directory Structure

> **Purpose:** Guide for organizing and exploring the example `.mel` files under `docs/mel/examples/`.

---

## Directory Layout

```
docs/mel/examples/
├── computed/
│   ├── basic.mel          # Basic computed expressions
│   ├── aggregation.mel    # sum, min, max, len
│   ├── boolean.mel        # Boolean conditions
│   ├── bounded-sugar.mel  # absDiff, clamp, idiv, streak
│   ├── null-handling.mel  # coalesce, isNull patterns
│   ├── object.mel         # merge, keys, values, entries
│   └── selection-sugar.mel # match, argmax, argmin
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
    ├── array.mel          # filter, map, find, every, some
    └── record.mel         # keys, values, entries
```

---

## How to Explore

### Start Here

1. **New to MEL?** Start with `computed/basic.mel` and `action/basic.mel`
2. **Understanding guards?** Read `control/when.mel` then `control/once.mel`
3. **Need bounded numeric helpers?** See `computed/bounded-sugar.mel`
4. **Need finite branch or candidate selection?** See `computed/selection-sugar.mel`
5. **Handling errors?** Check `control/fail.mel` and `control/stop.mel`

### Reading Order for Beginners

```
1. computed/basic.mel       → Pure expressions
2. action/basic.mel         → State mutations with guards
3. control/when.mel         → Conditional execution
4. computed/bounded-sugar.mel → Lowering-only arithmetic sugar
5. computed/selection-sugar.mel → Finite branch and candidate selection
6. effects/array.mel        → Declarative iteration
7. control/once.mel         → Idempotency patterns
8. computed/aggregation.mel → sum/min/max
9. control/fail.mel         → Error handling
10. action/multi-step.mel   → Complex flows
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
| `bounded-sugar.mel` | `absDiff`, `clamp`, `idiv`, `streak` |
| `null-handling.mel` | `coalesce`, `isNull`, `isNotNull`, ternary |
| `object.mel` | `merge`, `keys`, `values`, `entries` |
| `selection-sugar.mel` | `match`, `argmax`, `argmin` |

### `action/`

State transitions with guards, patches, and effects.

| File | Contents |
|------|----------|
| `basic.mel` | Simple `when` guards with `patch` |
| `parameters.mel` | Using `$input` and parameter references |
| `available.mel` | `available when` coarse preconditions |
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
| `array.mel` | `filter`, `map`, `find`, `every`, `some` with `$item` |
| `record.mel` | `keys`, `values`, `entries` |

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
| Clamp a score or compute a streak | `computed/bounded-sugar.mel` |
| Replace nested `cond(eq(...))` chains | `computed/selection-sugar.mel` |
| Update state conditionally | `action/basic.mel` |
| Prevent double execution | `control/once.mel` |
| Filter an array | `effects/array.mel` |
| Handle errors | `control/fail.mel` |
| Skip if already done | `control/stop.mel` |
| Multi-step data processing | `action/multi-step.mel` |

---

*End of Examples Guide*
