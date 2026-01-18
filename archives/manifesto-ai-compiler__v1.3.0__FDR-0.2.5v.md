# MEL (Manifesto Expression Language) — Foundational Design Rationale (FDR)

> **Version:** 0.2.5  
> **Status:** Normative  
> **Purpose:** Document the "Why" behind every major design decision in MEL  
> **Changelog:**
> - v0.2: AI-Native design principles and reviewer feedback integration
> - v0.2.1: Manifesto Host Contract alignment, Guard-mandatory effects, Canonical form
> - v0.2.2: Per-intent idempotency, Record effects, Deterministic semantics, Template literal removal
> - v0.2.3: Semantic closure completion, eq/neq normative rules, IR completeness, Scope rules
> - v0.2.4: IR unification (call-only), $ prefix reservation, eq/neq primitive-only, deterministic system values
> - v0.2.5: Document consistency fixes, evaluation order specification, effect signature normalization

---

## Table of Contents

### Part I: Foundation Decisions (v0.1)
1. [Purpose of This Document](#1-purpose-of-this-document)
2. [FDR-MEL-001: Why Not SWC Transform](#fdr-mel-001-why-not-swc-transform)
3. [FDR-MEL-002: 80% Compatibility Strategy](#fdr-mel-002-80-compatibility-strategy)
4. [FDR-MEL-003: Explicit Keywords Over Familiar Syntax](#fdr-mel-003-explicit-keywords-over-familiar-syntax)
5. [FDR-MEL-004: `when` Instead of `if`](#fdr-mel-004-when-instead-of-if)
6. [FDR-MEL-005: `patch` Instead of Assignment](#fdr-mel-005-patch-instead-of-assignment)
7. [FDR-MEL-006: `computed` Instead of `const`](#fdr-mel-006-computed-instead-of-const)
8. [FDR-MEL-007: Effect as Explicit Statement](#fdr-mel-007-effect-as-explicit-statement)
9. [FDR-MEL-008: No `typeof` Operator](#fdr-mel-008-no-typeof-operator)
10. [FDR-MEL-009: Forbidden Constructs by Grammar](#fdr-mel-009-forbidden-constructs-by-grammar)
11. [FDR-MEL-010: Type System Design](#fdr-mel-010-type-system-design)
12. [FDR-MEL-011: System Identifiers with `$` Prefix](#fdr-mel-011-system-identifiers-with--prefix)

### Part II: AI-Native Evolution (v0.2)
13. [FDR-MEL-012: AI-Native as Primary Design Driver](#fdr-mel-012-ai-native-as-primary-design-driver)
14. [FDR-MEL-013: Function-Only Syntax](#fdr-mel-013-function-only-syntax)
15. [FDR-MEL-014: Consistent Array Access](#fdr-mel-014-consistent-array-access)
16. [FDR-MEL-015: Effect Predicate with `$item`](#fdr-mel-015-effect-predicate-with-item)
17. [FDR-MEL-016: `once()` as Syntactic Sugar Only](#fdr-mel-016-once-as-syntactic-sugar-only)
18. [FDR-MEL-017: Minimal Grammar Surface](#fdr-mel-017-minimal-grammar-surface)
19. [FDR-MEL-018: No Nested Effects](#fdr-mel-018-no-nested-effects)
20. [FDR-MEL-019: Additional Effects for Composition](#fdr-mel-019-additional-effects-for-composition)

### Part III: Host Contract Alignment (v0.2.1)
21. [FDR-MEL-020: Guard-Mandatory Effects](#fdr-mel-020-guard-mandatory-effects)
22. [FDR-MEL-021: Explicit Marker Patch](#fdr-mel-021-explicit-marker-patch)
23. [FDR-MEL-022: Three Patch Operations](#fdr-mel-022-three-patch-operations)
24. [FDR-MEL-023: Path Type for Write Targets](#fdr-mel-023-path-type-for-write-targets)
25. [FDR-MEL-024: Canonical Form](#fdr-mel-024-canonical-form)
26. [FDR-MEL-025: Boolean-Only Conditions](#fdr-mel-025-boolean-only-conditions)
27. [FDR-MEL-026: Array-Only len()](#fdr-mel-026-array-only-len)

### Part IV: Semantic Closure (v0.2.2)
28. [FDR-MEL-027: Per-Intent Idempotency](#fdr-mel-027-per-intent-idempotency)
29. [FDR-MEL-028: Record Collection Effects](#fdr-mel-028-record-collection-effects)
30. [FDR-MEL-029: Deterministic Semantics](#fdr-mel-029-deterministic-semantics)
31. [FDR-MEL-030: No Template Literals](#fdr-mel-030-no-template-literals)
32. [FDR-MEL-031: Iteration Variable IR](#fdr-mel-031-iteration-variable-ir)
33. [FDR-MEL-032: Dynamic Path Segments](#fdr-mel-032-dynamic-path-segments)
34. [FDR-MEL-033: Effect Result Contract](#fdr-mel-033-effect-result-contract)

### Part V: Specification Completeness (v0.2.3)
35. [FDR-MEL-034: Equality Semantics](#fdr-mel-034-equality-semantics)
36. [FDR-MEL-035: Universal Index Access](#fdr-mel-035-universal-index-access)
37. [FDR-MEL-036: Scope Resolution Order](#fdr-mel-036-scope-resolution-order)
38. [FDR-MEL-037: System Value Stability](#fdr-mel-037-system-value-stability)
39. [FDR-MEL-038: Sort Determinism](#fdr-mel-038-sort-determinism)
40. [FDR-MEL-039: Complete IR Specification](#fdr-mel-039-complete-ir-specification)

### Part VI: Implementation Convergence (v0.2.4)
41. [FDR-MEL-040: Call-Only IR](#fdr-mel-040-call-only-ir)
42. [FDR-MEL-041: Dollar Prefix Reservation](#fdr-mel-041-dollar-prefix-reservation)
43. [FDR-MEL-042: Primitive-Only Equality](#fdr-mel-042-primitive-only-equality)
44. [FDR-MEL-043: Deterministic System Values](#fdr-mel-043-deterministic-system-values)
45. [FDR-MEL-044: Once Marker Enforcement](#fdr-mel-044-once-marker-enforcement)

### Part VII: Document Consistency (v0.2.5)
46. [FDR-MEL-045: Dollar Complete Prohibition](#fdr-mel-045-dollar-complete-prohibition)
47. [FDR-MEL-046: Evaluation Order Specification](#fdr-mel-046-evaluation-order-specification)
48. [FDR-MEL-047: Effect Write Target Normalization](#fdr-mel-047-effect-write-target-normalization)
49. [FDR-MEL-048: Index Access IR Normalization](#fdr-mel-048-index-access-ir-normalization)

### Summary
50. [Summary: The MEL Identity](#summary-the-mel-identity)
51. [Appendix: Decision Dependency Graph](#appendix-decision-dependency-graph)
52. [Appendix: v0.1 to v0.2.5 Changes](#appendix-v01-to-v025-changes)

---

## 1. Purpose of This Document

This document records the **foundational design decisions** made during the creation of MEL (Manifesto Expression Language).

For each decision, we document:

| Section | Content |
|---------|---------|
| **Decision** | What we decided |
| **Context** | Why this decision was needed |
| **Alternatives Considered** | What other options existed |
| **Rationale** | Why we chose this option |
| **Consequences** | What this enables and constrains |

These decisions are **constitutional** — they define what MEL IS and IS NOT, and why.

---

# Part I: Foundation Decisions (v0.1)

---

## FDR-MEL-001: Why Not SWC Transform

### Decision

MEL is a **new language** with its own grammar, not a subset of JavaScript/TypeScript enforced by transformation.

### Context

The initial approach considered was using SWC (Speedy Web Compiler) to transform standard JS/TS code into Manifesto Schema IR. This seemed attractive because:

- Developers could write familiar JS/TS syntax
- Existing tooling (VSCode, ESLint, Prettier) would work
- No new language to learn

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **SWC Transform** | Parse JS/TS, reject forbidden patterns, emit IR | Validation happens post-hoc; developers write invalid code then get errors |
| **TypeScript Plugin** | Custom type checker that rejects bad patterns | Complex implementation; still allows writing invalid code |
| **ESLint Rules** | Lint rules that flag violations | Can be ignored (`// eslint-disable`); not enforceable |
| **New Language (MEL)** | Purpose-built grammar where violations are syntax errors | Requires learning; but guarantees purity |

### Rationale

The SWC approach has a fundamental flaw: **it validates after the fact**.

```typescript
// Developer writes this (valid JS):
const filtered = items.filter(x => x.active);

// SWC Transform says:
// Error: 'filter' is not allowed in Core expressions.

// Developer reaction:
// "But it's valid JavaScript! Why doesn't it work?"
// "Let me try another way to do the same thing..."
// "Maybe I can trick the compiler..."
```

This creates a **cat-and-mouse game** between developers and the compiler. Every new JS feature must be explicitly forbidden. Every edge case must be caught.

**The deeper problem**: JavaScript's grammar includes constructs that are fundamentally incompatible with Manifesto's purity requirements. You cannot make JS pure by removing features — the impure patterns are woven into the language's DNA.

MEL takes the opposite approach: **purity by construction**.

```mel
// Developer tries to write:
const filtered = items.filter(x => x.active);

// Parser says:
// SyntaxError: unexpected token 'const'
// SyntaxError: unexpected token '=>'

// Developer reaction:
// "Oh, this isn't JavaScript. Let me learn MEL."
// "How do I do filtering in MEL? Ah, effect array.filter()!"
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Guaranteed purity at parse time | New language to learn |
| No escape hatches or workarounds | New tooling needed (parser, IDE support) |
| Clear mental model ("this is MEL, not JS") | Cannot use arbitrary JS libraries |
| Simpler compiler (no validation phase) | Initial adoption friction |

### Canonical Statement

> **MEL is not a restricted JavaScript. MEL is a purpose-built language where impurity cannot be expressed.**

---

## FDR-MEL-002: 80% Compatibility Strategy

### Decision

MEL maintains **80% syntax compatibility** with JavaScript expressions, while the remaining 20% is **intentionally different**.

### Context

Two extremes were possible:

1. **100% JS syntax** (with restrictions enforced by validation)
2. **Completely new syntax** (like Haskell, Elm, or a custom DSL)

Both extremes have problems:

- 100% JS: Developers expect JS semantics; violations feel arbitrary
- Completely new: High learning curve; resistance to adoption

### Rationale

The 80/20 split creates an optimal learning experience:

**The 80% (Same as JS):**
```mel
// Arithmetic — identical
price * quantity + tax

// Comparison — identical
user.age >= 18 && user.verified

// Null handling — identical
user.name ?? "Anonymous"

// Ternary — identical
isActive ? "Yes" : "No"

// Property access — identical
user.profile.settings.theme
```

**The 20% (Intentionally Different):**
```mel
// Variable declaration — different keyword
computed total = price * quantity    // not: const total = ...

// State mutation — explicit intent
patch user.name = newName            // not: user.name = newName

// Conditional execution — different semantics
when isReady { ... }                 // not: if (isReady) { ... }

// Iteration — declarative effect
effect array.filter({ ... })         // not: items.filter(...)
```

The key insight: **the 20% difference must be obvious**.

If MEL looked 99% like JS, developers would constantly stumble over the 1% that's different. By making the differences **visually distinct** (new keywords), developers immediately recognize they're in a different context.

### The Learning Curve Paradox

Counter-intuitively, **more obvious differences lead to faster learning**:

| Approach | Developer Experience |
|----------|---------------------|
| 99% same, 1% different | "Why doesn't my JS work? This is frustrating!" |
| 80% same, 20% obviously different | "Okay, these are the new concepts I need to learn." |
| 0% same (new language) | "I have to learn everything from scratch..." |

### Consequences

| Enables | Constrains |
|---------|------------|
| Expressions feel familiar immediately | Must maintain keyword distinction |
| New concepts are visually marked | Cannot reuse JS keywords with different meaning |
| 30-minute learning curve for basics | Documentation must explain differences clearly |
| Existing JS mental models transfer | Some "obvious" JS patterns don't work |

### Canonical Statement

> **MEL is familiar where it doesn't matter (expressions) and different where it does (state, effects, control flow).**

---

## FDR-MEL-003: Explicit Keywords Over Familiar Syntax

### Decision

MEL uses **new keywords** (`computed`, `action`, `patch`, `when`, `effect`) instead of repurposing JavaScript keywords with restricted semantics.

### Context

We could have used JS syntax with restrictions:

```javascript
// Option A: JS syntax, restricted semantics
const isValid = user.age >= 18;         // "const" but actually computed
function submit() { ... }               // "function" but actually action
if (ready) { ... }                      // "if" but actually guard
user.name = newName;                    // "=" but actually patch
```

### Rationale

Repurposing keywords creates **semantic confusion**:

```javascript
// JS developer sees this:
const total = items.length;

// JS developer expects:
// - total is evaluated once
// - total is a runtime value
// - total can be used anywhere

// Manifesto reality:
// - total is re-evaluated on every compute()
// - total is a schema declaration
// - total exists in a specific context (Domain)
```

New keywords signal new semantics:

```mel
// Developer sees this:
computed total = items.length

// Developer thinks:
// - "computed" means something specific here
// - This isn't just a variable
// - Let me check what "computed" means in MEL
```

**The principle**: If the semantics are different, the syntax should be different.

| JS Keyword | JS Semantics | Manifesto Semantics | → MEL Keyword |
|------------|--------------|---------------------|---------------|
| `const` | Immutable binding, evaluated once | Reactive derivation, re-evaluated | `computed` |
| `function` | Callable procedure | Intent handler with guards | `action` |
| `if` | Conditional branch | Re-entry safe guard | `when` |
| `=` | Assignment (mutation) | Patch declaration | `patch ... =` |
| `.filter()` | Immediate iteration | Deferred effect | `effect array.filter` |

### Consequences

| Enables | Constrains |
|---------|------------|
| Clear mental model per keyword | Must learn new vocabulary |
| No semantic confusion | Cannot copy-paste JS directly |
| Documentation is unambiguous | IDE needs MEL-specific support |
| Errors reference MEL concepts | |

### Canonical Statement

> **Different semantics deserve different syntax. MEL keywords signal MEL semantics.**

---

## FDR-MEL-004: `when` Instead of `if`

### Decision

MEL uses `when` for conditional execution in actions, not `if`.

### Context

`if` in JavaScript implies:

- Two branches (if/else)
- Immediate execution
- Can be nested arbitrarily
- Evaluated once per call

Manifesto actions have different needs:

- Re-entry safety (guard semantics)
- No "else" branch (either guard passes or doesn't)
- Evaluated on every compute cycle

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| `if` | Implies else, nesting, imperative branching |
| `guard` | Too unfamiliar, sounds like Swift |
| `once` | Implies single execution ever (not per intent) |
| `when` | Familiar from English, implies condition-based activation |

### Rationale

`when` captures the **guard semantics** precisely:

```mel
action submit() {
  when submittedAt == null {
    patch submittedAt = $system.time.now
    effect api.submit({ data: formData })
  }
}
```

Reading this aloud: "When submittedAt is null, patch submittedAt and submit."

Compare with `if`:

```javascript
// If we used "if":
action submit() {
  if (submittedAt == null) {
    // Developer expects: "What about else?"
    // Developer expects: "Can I nest another if?"
    // Developer expects: "This runs once, right?"
  }
}
```

**Critical difference**: `when` blocks are **re-entry safe** by design. The entire action runs on every compute cycle, but `when` blocks only execute if their condition is true. This is fundamentually different from `if`, which implies single-pass evaluation.

### The Re-entry Problem

```mel
// WRONG mental model (if-thinking):
action increment() {
  if (true) {
    patch count = count + 1  // "This runs once"
  }
}

// CORRECT mental model (when-thinking):
action increment() {
  when triggered == null {
    patch triggered = true
    patch count = count + 1  // "This runs when triggered is null"
  }
}
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Re-entry safety is explicit | No else branches |
| Guard semantics are clear | Cannot nest arbitrary logic |
| Forces state-based conditions | Must think in guards, not branches |

### Canonical Statement

> **`when` is a guard, not a branch. It activates when a condition is met, not chooses between paths.**

---

## FDR-MEL-005: `patch` Instead of Assignment

### Decision

State modifications use `patch path = value` syntax, not direct assignment `path = value`.

### Context

In JavaScript, `=` means immediate mutation:

```javascript
user.name = "Alice";  // user.name is now "Alice"
console.log(user.name);  // prints "Alice"
```

In Manifesto, state changes are:

1. **Declared** (not executed)
2. **Collected** into patch operations
3. **Applied** by Host to Snapshot
4. **Visible** in next compute cycle

### Rationale

`patch` makes the **declarative nature** explicit:

```mel
// This is NOT immediate mutation:
patch user.name = "Alice"

// This is a declaration that becomes:
{ op: 'set', path: ['user', 'name'], value: 'Alice' }

// Which Host applies to Snapshot
// Which is visible in next compute()
```

If we used `=`:

```mel
// Developer writes:
user.name = "Alice"
log(user.name)  // Developer expects "Alice"

// Reality:
// - log() doesn't exist
// - user.name is still old value until next cycle
// - Developer is confused
```

`patch` signals: "I am requesting a change, not making one."

### The Temporal Disconnect

```mel
action setName(newName: string) {
  patch user.name = newName
  
  // At this point, user.name is STILL the old value!
  // The patch is queued, not applied.
  
  computed greeting = "Hello, " + user.name  // Old name!
}

// Next compute cycle:
// Now user.name has the new value
```

This temporal disconnect is **intentional** (Manifesto is not imperative), but `=` would hide it.

### Consequences

| Enables | Constrains |
|---------|------------|
| Clear patch semantics | Verbose compared to `=` |
| No confusion about timing | Cannot chain assignments |
| Explicit intent declaration | Must understand compute cycle |
| Traceable state changes | |

### Canonical Statement

> **`patch` declares intent to change. It does not mutate. Mutation is Host's responsibility.**

---

## FDR-MEL-006: `computed` Instead of `const`

### Decision

Derived values use `computed name = expr` syntax, not `const name = expr`.

### Context

In JavaScript, `const` means:

- Evaluated once at declaration time
- Immutable binding (not value)
- Exists in runtime scope

In Manifesto, computed values are:

- Re-evaluated on every compute cycle
- Derived from current Snapshot state
- Part of Schema definition, not runtime

### Rationale

`computed` signals **reactive derivation**:

```mel
computed total = items.length * price

// This means:
// - Every time Snapshot changes
// - Re-calculate: items.length * price
// - Make result available as "total"
```

If we used `const`:

```javascript
const total = items.length * price;

// Developer expects:
// - Evaluated once
// - Stored as fixed value
// - items.length can change, total won't
```

This would lead to bugs where developers expect `const` caching:

```mel
// With "const", developer thinks:
const expensive = heavyCalculation(data)
// "This only runs once, right?"

// Reality:
// Runs on EVERY compute cycle
// No caching (pure computation)
```

`computed` makes reactivity explicit: "This value is computed from other values, always."

### Consequences

| Enables | Constrains |
|---------|------------|
| Clear reactive semantics | New keyword to learn |
| No caching confusion | Cannot declare non-reactive values |
| Explicit dependency tracking | All values are derived |

### Canonical Statement

> **`computed` means derived. It is re-calculated whenever its dependencies change.**

---

## FDR-MEL-007: Effect as Explicit Statement

### Decision

Operations that require iteration or I/O are declared as explicit `effect` statements, not method calls.

### Context

JavaScript iteration is embedded in expressions:

```javascript
const active = items.filter(x => x.active);
const names = items.map(x => x.name);
const total = items.reduce((a, b) => a + b.value, 0);
```

This conflates:

- **What** (filter, map, reduce)
- **How** (iteration)
- **When** (now, immediately)

### Rationale

Effects must be **visible, controllable, and traceable**:

```mel
// Effect is a first-class statement:
effect array.filter({
  source: items,
  where: $item.completed == false,
  into: activeItems
})

// This means:
// 1. "I need filtered items" (declaration)
// 2. Host sees this requirement
// 3. Host decides how/when to execute
// 4. Result goes into Snapshot at "activeItems"
// 5. Trace records the effect
```

**Why this matters:**

| Aspect | Method Call | Effect Statement |
|--------|-------------|------------------|
| Visibility | Hidden in expression | Top-level statement |
| Control | Immediate execution | Host-controlled |
| Tracing | Not recorded | Fully traced |
| Performance | Developer's responsibility | Host can optimize |
| Re-entry | Runs every time | Can be guarded |

### The O(n) Visibility Problem

```javascript
// JS: O(n) operation hidden in innocent-looking code
const result = items.map(x => process(x)).filter(x => x.valid);
// Developer doesn't see: this is O(2n)
```

```mel
// MEL: O(n) operations are explicit
effect array.map({
  source: items,
  select: { processed: process($item) },
  into: mapped
})

effect array.filter({
  source: mapped,
  where: $item.valid == true,
  into: result
})
// Developer sees: two effects, two iterations
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Performance visibility | More verbose |
| Host optimization opportunity | Cannot inline iteration |
| Tracing of all iterations | Must think declaratively |
| Clear separation of pure/impure | |

### Canonical Statement

> **Effects are not hidden in expressions. They are declared, visible, and Host-controlled.**

---

## FDR-MEL-008: No `typeof` Operator

### Decision

MEL does not include the `typeof` operator.

### Context

The initial v1.1 Schema Spec included `typeof` in Tier 5 expressions:

```typescript
| { kind: 'typeof'; arg: ExprNode }
```

### Rationale

`typeof` violates Manifesto's **Schema-first principle**:

1. **Runtime Reflection**: `typeof` inspects values at runtime, which contradicts Schema-driven typing.

2. **Host Dependency**: `typeof` results can vary by Host implementation:
   ```javascript
   typeof null === 'object'  // JavaScript quirk
   // Other hosts might return 'null'
   ```

3. **Non-Determinism Risk**: If Host implementations differ, same expression produces different results.

4. **Schema Redundancy**: In a Schema-first system, types are known at definition time:
   ```mel
   state {
     count: number = 0      // We KNOW this is number
     name: string = ""      // We KNOW this is string
   }
   
   // typeof is redundant — we already know the types!
   ```

### Alternative: Schema-Driven Type Guards

If type checking is needed, use explicit type predicates:

```mel
// Instead of: typeof x === 'string'
// Use: state-based discrimination

state {
  value: { kind: "text", content: string } | { kind: "number", amount: number }
}

computed isText = value.kind == "text"
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Deterministic evaluation | Cannot inspect types at runtime |
| Host-agnostic behavior | Must use discriminated unions |
| Schema is source of truth | |

### Canonical Statement

> **Types are defined in Schema, not discovered at runtime. `typeof` has no place in a Schema-first language.**

---

## FDR-MEL-009: Forbidden Constructs by Grammar

### Decision

Impure constructs are **syntactically forbidden** — they do not exist in MEL's grammar.

### Context

Two enforcement strategies exist:

1. **Semantic Rejection**: Parse everything, reject bad patterns during validation
2. **Syntactic Prevention**: Grammar doesn't include forbidden constructs

### Rationale

**Syntactic prevention is stronger and simpler.**

| Construct | Semantic Rejection | Syntactic Prevention |
|-----------|-------------------|---------------------|
| `function` | Parse, then error | Token not recognized |
| `for` loop | Parse, then error | Token not recognized |
| `async/await` | Parse, then error | Token not recognized |
| `.filter()` | Parse, then error | Method not in whitelist |

With syntactic prevention:

```mel
// Developer writes:
for (let i = 0; i < 10; i++) { }

// Parser says:
// SyntaxError: unexpected token 'for'

// Developer cannot:
// - Disable the check
// - Find a workaround
// - Trick the compiler
```

**The "No Escape Hatch" Principle**:

In JavaScript with ESLint:
```javascript
// eslint-disable-next-line no-loops
for (let i = 0; i < 10; i++) { }  // Bypass!
```

In MEL:
```mel
// There is no directive to enable 'for'
// The grammar doesn't have 'for'
// Period.
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Guaranteed purity | Cannot extend with JS features |
| No escape hatches | Parser must be maintained |
| Simpler validation | Reserved words must be managed |
| Clear error messages | |

### Canonical Statement

> **If it's not in the grammar, you cannot write it. There is no workaround.**

---

## FDR-MEL-010: Type System Design

### Decision

MEL's type system is **TypeScript-compatible in syntax** and **Zod-compatible in semantics**.

### Context

MEL needs types for:

- State field declarations
- Action parameter types
- Computed value inference
- Effect parameter validation

### Rationale

**TypeScript syntax** for familiarity:

```mel
state {
  count: number = 0
  status: "idle" | "loading" | "done" = "idle"
  items: Record<string, Item> = {}
}
```

TypeScript developers read this instantly.

**Zod semantics** for runtime validation:

```mel
// MEL declaration:
status: "idle" | "loading" | "done" = "idle"

// Maps to Zod:
z.enum(["idle", "loading", "done"]).default("idle")

// Which enables:
// - Runtime validation
// - JSON Schema generation
// - Type inference
```

### Type Feature Mapping

| MEL Type | TypeScript | Zod |
|----------|------------|-----|
| `string` | `string` | `z.string()` |
| `number` | `number` | `z.number()` |
| `boolean` | `boolean` | `z.boolean()` |
| `null` | `null` | `z.null()` |
| `"a" \| "b"` | `"a" \| "b"` | `z.enum(["a", "b"])` |
| `T \| null` | `T \| null` | `z.nullable(T)` |
| `Array<T>` | `T[]` | `z.array(T)` |
| `Record<K, V>` | `Record<K, V>` | `z.record(K, V)` |
| `{ a: T }` | `{ a: T }` | `z.object({ a: T })` |

### Consequences

| Enables | Constrains |
|---------|------------|
| Familiar syntax | Cannot use advanced TS features |
| Runtime validation | Must support Zod semantics |
| Schema generation | Type system is simpler than TS |
| Type inference | |

### Canonical Statement

> **MEL types look like TypeScript and work like Zod. Familiar to write, validated at runtime.**

---

## FDR-MEL-011: System Identifiers with `$` Prefix

### Decision

System-provided values use `$` prefix: `$system.time.now`, `$input.field`, `$meta.actor`.

### Context

MEL needs to access:

- Host-injected values (time, UUID)
- Intent inputs (action parameters)
- Execution metadata (actor, authority)

These are not part of domain state but must be accessible in expressions.

### Alternatives Considered

| Alternative | Example | Why Rejected |
|-------------|---------|--------------|
| Magic globals | `NOW`, `UUID` | Conflicts with user identifiers |
| Method calls | `system.now()` | Implies execution, not access |
| Special syntax | `@now`, `#uuid` | Unfamiliar |
| `$` prefix | `$system.time.now` | Familiar (shell, PHP, template languages) |

### Rationale

`$` prefix is **visually distinct and familiar**:

```mel
// Clear distinction:
user.name           // Domain state
$system.time.now    // System value
$input.newName      // Intent input

// Developer instantly knows:
// - user.name comes from Snapshot
// - $system.time.now comes from Host
// - $input.newName comes from Intent
```

**Familiarity sources:**

- Shell scripting: `$HOME`, `$PATH`
- PHP: `$_GET`, `$_POST`
- Template languages: `${variable}`
- jQuery: `$('#id')`

### System Identifier Categories

| Category | Prefix | Examples |
|----------|--------|----------|
| System values | `$system` | `$system.time.now`, `$system.uuid` |
| Intent inputs | `$input` | `$input.title`, `$input.userId` |
| Execution metadata | `$meta` | `$meta.actor`, `$meta.authority` |

### Consequences

| Enables | Constrains |
|---------|------------|
| Clear source indication | `$` is reserved |
| No namespace collision | Cannot use `$` for user identifiers |
| Familiar pattern | |

### Canonical Statement

> **`$` marks Host-provided values. Everything else comes from Snapshot.**

---

# Part II: AI-Native Evolution (v0.2)

The following decisions were made after critical review, recognizing that MEL's primary consumer is not just human developers, but **LLM agents** that will read, write, and reason about MEL code.

---

## FDR-MEL-012: AI-Native as Primary Design Driver

### Decision

MEL prioritizes **LLM parseability and generability** over human ergonomics when the two conflict.

### Context

Manifesto's vision is an **AI-Native Semantic State Engine** — a system where LLM agents can:

1. Read domain schemas and understand their semantics
2. Generate valid MEL code to manipulate state
3. Reason about state transitions and their effects
4. Verify that code satisfies invariants

This shifts the primary optimization target:

| Traditional Language | AI-Native Language |
|---------------------|-------------------|
| Optimize for human reading speed | Optimize for LLM parsing accuracy |
| Ergonomic shortcuts welcome | Consistent patterns preferred |
| Multiple ways to express same thing | One canonical way |
| Syntactic sugar for convenience | Minimal surface area |

### Rationale

**LLMs and humans have different cognitive strengths:**

| Aspect | Human | LLM |
|--------|-------|-----|
| Pattern recognition | Good with familiar patterns | Excellent with consistent patterns |
| Exception handling | Can remember "except when..." | Struggles with exceptions |
| Contextual inference | Good at "obvious" implications | Needs explicit information |
| Syntax variations | Prefers choice | Prefers single pattern |

**Example: Method chaining vs Function calls**

```mel
// Human-friendly (method chaining):
user.name.trim().toLowerCase().substring(0, 10)

// AI-friendly (function calls):
substr(lower(trim(user.name)), 0, 10)
```

For humans, method chaining reads left-to-right like natural language.

For LLMs:
- Method chaining requires knowing which methods exist on which types
- Each `.` could be property access OR method call — contextual
- Function calls are always `name(args)` — single pattern

**The key insight**: Humans can adapt to function-style with IDE support. LLMs cannot easily adapt to inconsistent patterns.

### The Paradigm Shift

```
Before (Human-first):
  "What syntax would developers find most natural?"
  
After (AI-first):
  "What syntax would LLMs generate most reliably?"
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Higher LLM code generation accuracy | Some human ergonomics sacrificed |
| Simpler LLM prompts | Must rely on IDE for human DX |
| More reliable automated reasoning | Less "natural" for humans initially |
| Cross-model consistency | Cannot add "convenient" shortcuts |

### Canonical Statement

> **MEL is designed for machines that think, not just humans that type. When human convenience conflicts with machine consistency, consistency wins.**

---

## FDR-MEL-013: Function-Only Syntax

### Decision

MEL uses **function call syntax exclusively** for all operations. Method syntax (`.method()`) is removed entirely.

### Context

MEL v0.1 allowed method syntax for certain string operations:

```mel
// v0.1: Method syntax allowed
user.name.trim().toLowerCase()

// Desugared to:
lower(trim(user.name))
```

This created inconsistency:

```mel
// v0.1: Inconsistent
user.name.trim()      // ✅ Allowed (whitelisted method)
items.filter(...)     // ❌ Forbidden (not whitelisted)
items.length          // ✅ Allowed (property)
```

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Full method support | Requires type-aware parsing; opens door to `.filter()` confusion |
| Whitelist methods | Inconsistent: "why does `.trim()` work but `.split()` doesn't?" |
| **Function-only** | Consistent: everything is `function(args)` |

### Rationale

#### For LLM Code Generation

```mel
// Method style: LLM must know...
user.name.trim().toLowerCase()
// - Is "trim" a method or property?
// - What type does user.name have?
// - What methods are whitelisted for that type?
// - What's the return type for chaining?

// Function style: LLM must know...
lower(trim(user.name))
// - Is "lower" in the function list? Yes.
// - Is "trim" in the function list? Yes.
// - Done.
```

#### For LLM Code Validation

```mel
// Method style: Complex validation
items.filter(x => x.active)
// LLM: "Is filter a valid method? On what type? 
//       Oh wait, filter is forbidden but trim isn't?
//       Let me check the whitelist... for this type..."

// Function style: Simple validation
filter(items, ...)
// LLM: "Is filter in the function list? No. Invalid."
```

#### Single Pattern Principle

```
Function call: name(arg1, arg2, ...)
Property access: object.property

That's it. No method calls. No confusion.
```

### The Consistency Argument

| Pattern | Count in v0.1 | Count in v0.2 |
|---------|---------------|---------------|
| Function call | 1 pattern | 1 pattern |
| Method call | 1 pattern | 0 patterns |
| Property access | 1 pattern | 1 pattern |
| **Total patterns** | **3** | **2** |

Fewer patterns = easier for LLMs to learn and apply correctly.

### Migration from v0.1

```mel
// v0.1 (method style)
user.name.trim().toLowerCase()
items.length
substr(name, 0, 10)

// v0.2 (function-only)
lower(trim(user.name))
len(items)
substr(name, 0, 10)
```

### Consequences

| Enables | Constrains |
|---------|------------|
| 100% consistent syntax | No method chaining |
| Trivial LLM validation | More parentheses |
| No type-aware parsing needed | Nested calls can be deep |
| No whitelist maintenance | IDE formatting helps readability |

### Canonical Statement

> **One pattern to rule them all: `function(args)`. No methods, no exceptions, no confusion.**

---

## FDR-MEL-014: Consistent Array Access

### Decision

All array/collection operations use **function syntax**, including length and element access.

### Context

JavaScript mixes property access and method calls for arrays:

```javascript
items.length      // Property
items[0]          // Index access
items.filter(...) // Method
```

MEL v0.1 partially preserved this:

```mel
items.length      // Property (allowed)
items[0]          // Index access (allowed)
effect array.filter(...)  // Effect (required)
```

### Rationale

Following FDR-MEL-013 (Function-Only), array operations should also be functions:

```mel
// v0.2: Consistent array access
len(items)        // Function: length
at(items, 0)      // Function: index access
first(items)      // Function: first element
last(items)       // Function: last element

// Index syntax is ONLY for Record/object access
user["name"]      // OK: Record key access
items[0]          // Still allowed as sugar for at(items, 0)
```

### Special Case: Index Syntax

We preserve `items[0]` as **syntactic sugar** for `at(items, 0)` because:

1. It's universally understood
2. It's unambiguous (no method confusion)
3. It desugars trivially

```mel
// These are identical:
items[0]
at(items, 0)

// Both compile to:
{ kind: 'at', array: items, index: 0 }
```

### Consequences

| Enables | Constrains |
|---------|------------|
| No `.length` vs `len()` confusion | Must write `len(items)` |
| Consistent function pattern | Slightly more verbose |
| LLM can validate without type info | |

### Canonical Statement

> **Arrays are accessed through functions. `len()`, `first()`, `last()`, `at()`. Index syntax `[n]` is sugar for `at()`.**

---

## FDR-MEL-015: Effect Predicate with `$item`

### Decision

Effect predicates use **`$item` implicit variable** to reference the current element being processed.

### Context

MEL v0.1 had ambiguous predicate syntax:

```mel
// v0.1: Ambiguous
effect array.filter({
  source: items,
  predicate: { completed: false }  // What does this mean?
})
```

Questions:
- Is `{ completed: false }` a pattern match?
- How do I express `item.completed == false && item.priority > 5`?
- What variable refers to the current item?

### Rationale

Introduce **`$item`** as the implicit loop variable:

```mel
// v0.2: Explicit
effect array.filter({
  source: items,
  where: $item.completed == false && $item.priority > 5,
  into: filtered
})
```

**Why `$item`:**

1. **`$` prefix consistency**: Follows FDR-MEL-011 — system-provided values use `$`
2. **Explicit binding**: No magic "it" or implicit scope
3. **LLM-friendly**: Clear variable name, predictable pattern

### Effect Syntax Update

```mel
// Filter
effect array.filter({
  source: items,
  where: $item.active == true,
  into: activeItems
})

// Map
effect array.map({
  source: items,
  select: {
    name: upper($item.title),
    done: $item.completed
  },
  into: transformed
})

// Sort
effect array.sort({
  source: items,
  by: $item.createdAt,
  order: "desc",
  into: sorted
})

// Find
effect array.find({
  source: items,
  where: $item.id == targetId,
  into: found
})

// Reduce
effect array.reduce({
  source: items,
  initial: 0,
  accumulate: $acc + $item.value,  // $acc for accumulator
  into: total
})
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Complex predicates expressible | Must remember `$item` syntax |
| No ambiguity in effect params | Additional reserved identifier |
| LLM can generate predicates reliably | |

### Canonical Statement

> **`$item` is the current element. `$acc` is the accumulator. No magic scope, explicit bindings.**

---

## FDR-MEL-016: `once()` as Syntactic Sugar Only

### Decision

`once()` is a **syntactic sugar** that expands to a `when` guard with timestamp marker. It is NOT a grammar-level keyword.

### Context

Re-entry safety requires guard patterns:

```mel
// Without sugar: verbose but explicit
action submit() {
  when submittedAt == null {
    patch submittedAt = $system.time.now
    effect api.submit({ data: formData })
  }
}
```

A reviewer suggested `once` as a keyword:

```mel
// Proposed: once as keyword
action submit() once {
  effect api.submit({ data: formData })
}
```

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| `once` as keyword | Semantics unclear: "once per what?" Once per intent? Once ever? How to reset? |
| `once` as modifier | Same ambiguity: `action submit() once { }` |
| **`once(marker)` sugar** | Explicit marker, clear semantics, optional |

### Rationale

**`once` as a keyword creates ambiguity:**

```mel
action submit() once {
  patch count = count + 1
}

// Questions:
// - Once per intent? Once per session? Once ever?
// - How do I reset the "once" state?
// - What if I want "once per condition"?
```

**`once(marker)` as sugar is explicit:**

```mel
action submit() {
  once(submittedAt) {
    effect api.submit({ data: formData })
  }
}

// Clear semantics:
// - submittedAt is the marker
// - When submittedAt is null, execute and set timestamp
// - To reset: patch submittedAt = null
```

### Expansion Rule

```mel
// Sugar:
once(marker) {
  statements...
}

// Expands to:
when marker == null {
  patch marker = $system.time.now
  statements...
}
```

### Conditional Once

```mel
// Sugar:
once(marker) when condition {
  statements...
}

// Expands to:
when marker == null && condition {
  patch marker = $system.time.now
  statements...
}
```

### Why Sugar, Not Grammar

1. **Transparency**: Developers see what `once()` really does
2. **Flexibility**: Can always write explicit `when` for edge cases
3. **Debuggability**: Trace shows the expanded `when` guard
4. **Simplicity**: Grammar stays minimal (per FDR-MEL-017)

### Consequences

| Enables | Constrains |
|---------|------------|
| Convenient re-entry pattern | Must understand underlying `when` |
| Explicit marker management | Slightly more verbose than keyword |
| Clear reset mechanism | |
| No grammar complexity | |

### Canonical Statement

> **`once(marker)` is convenience, not magic. It expands to `when marker == null { patch marker = ... }`.**

---

## FDR-MEL-017: Minimal Grammar Surface

### Decision

MEL's grammar is kept **intentionally minimal**. New syntax is added only when it provides significant value that cannot be achieved through existing constructs.

### Context

Languages tend to grow over time as users request "convenient" features:

```
v1.0: Basic language
v1.1: Add syntactic sugar A
v1.2: Add syntactic sugar B
v1.3: Add edge case handling for A+B interaction
v2.0: Language is now complex, has multiple ways to do everything
```

This is especially problematic for AI-Native languages where LLMs must learn the entire grammar.

### Rationale

**Grammar size directly impacts LLM reliability:**

| Grammar Size | LLM Behavior |
|--------------|--------------|
| Small (10 constructs) | High accuracy, consistent output |
| Medium (50 constructs) | Good accuracy, occasional confusion |
| Large (200+ constructs) | Frequent errors, inconsistent patterns |

**The JavaScript Cautionary Tale:**

```javascript
// How many ways to define a function?
function foo() {}
const foo = function() {}
const foo = () => {}
const foo = function bar() {}
const obj = { foo() {} }
const obj = { foo: function() {} }
const obj = { foo: () => {} }
class C { foo() {} }
// ... and more
```

An LLM asked to "write a function" might generate any of these. Prompts must specify which style. Validation must handle all styles.

**MEL's approach:**

```mel
// One way to declare computed:
computed name = expr

// One way to declare action:
action name(params) { body }

// One way to do conditional execution:
when condition { body }

// That's it.
```

### The "Syntactic Sugar Tax"

Every piece of sugar has costs:

| Cost | Description |
|------|-------------|
| Grammar complexity | Parser must handle more cases |
| Documentation | Must explain what sugar expands to |
| LLM confusion | Must teach LLM when to use sugar vs expansion |
| Edge cases | Sugar + sugar interactions |
| Tooling | Formatter, linter must handle sugar |

**Sugar is only worth it if**: `benefit >> costs`

For `once()`: Clear benefit (common pattern), low cost (simple expansion), worth it.

For method syntax: Marginal benefit (readability), high cost (type-aware parsing, whitelist), not worth it.

### Consequences

| Enables | Constrains |
|---------|------------|
| LLM can learn entire grammar | Feature requests often rejected |
| Consistent code style | Less "expressiveness" |
| Simple tooling | Some patterns more verbose |
| Predictable evolution | |

### Canonical Statement

> **Every grammar addition must justify itself against LLM complexity cost. When in doubt, leave it out.**

---

## FDR-MEL-018: No Nested Effects

### Decision

Effects MUST NOT appear inside other Effects. Effect statements are always **top-level** within an action body or guard body.

### Context

A reviewer identified a critical design gap: What happens when Effects are nested?

```mel
// Problematic scenario
effect array.map({
  source: teams,
  select: {
    teamName: $item.name,
    heavyMembers: effect array.filter({    // ← Effect inside Effect!
      source: $item.members,
      where: gt($item.weight, 80)          // ← Which $item?
    })
  },
  into: result
})
```

This creates multiple problems:

1. **$item Ambiguity**: Does `$item` in the inner effect refer to `Team` or `Member`?
2. **Execution Order**: When does the inner effect execute? Per iteration?
3. **Data Flow**: Where does the inner effect's result go?
4. **Traceability**: How do we trace nested operations?

### The Deeper Problem

Beyond `$item` shadowing, nested effects violate a **fundamental Manifesto principle**:

> "Effects are declarations, not executions."

An Effect is a **statement** that declares a requirement to Host. It is NOT an **expression** that produces a value. In the problematic example:

```mel
select: {
  heavyMembers: effect array.filter({ ... })  // Effect in value position!
}
```

The `effect` appears where a **value** is expected. This is a category error.

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Alias syntax** | `as: $team` to name outer scope | Adds grammar complexity; LLM confusion |
| **Parent accessor** | `$parent.$item` for outer scope | Complex scoping rules; error-prone |
| **Indexed access** | `$item[0]`, `$item[1]` for levels | Unreadable; defeats purpose of naming |
| **Shadowing rules** | Inner `$item` shadows outer | Still doesn't solve "Effect as value" problem |
| **No nested effects** | Flat effect sequences only | Simple; matches Manifesto philosophy |

### Rationale

**1. Effects are Statements, Not Expressions**

```mel
// Statement: stands alone, has no "value"
effect array.filter({ ... })

// Expression: produces a value, can be nested
add(mul(a, b), c)
```

Effects belong in the first category. Allowing them in expression positions breaks the conceptual model.

**2. Traceability Requires Linearity**

Each Effect should appear as a **separate step** in the Trace:

```
Trace:
  Step 1: array.flatMap → 150 items
  Step 2: array.filter → 23 items  
  Step 3: array.groupBy → 5 groups
```

Nested effects would create **hidden sub-traces** that are harder to inspect, replay, and debug.

**3. Host Optimization is Simpler**

With flat effect sequences, Host can:
- See all effects upfront
- Optimize/parallelize independent effects
- Cache intermediate results

Nested effects require **runtime interpretation** of the nesting structure.

**4. LLM Generation is More Reliable**

```mel
// Nested: LLM must track scope depth, $item bindings, nesting rules
effect A({ select: { x: effect B({ where: $item... }) } })

// Flat: LLM generates sequence of simple statements
effect A({ into: temp1 })
effect B({ source: temp1, into: temp2 })
```

The flat pattern has **one consistent structure**. No scope tracking needed.

### The Correct Pattern

Complex nested operations should be **decomposed** into sequential effects:

```mel
// ❌ FORBIDDEN: Nested Effects
action findHeavyMembersByTeam() {
  effect array.map({
    source: teams,
    select: {
      heavyMembers: effect array.filter({
        source: $item.members,
        where: gt($item.weight, 80)
      })
    },
    into: result
  })
}

// ✅ REQUIRED: Sequential Effects
action findHeavyMembersByTeam() {
  // Step 1: Flatten teams into members with team context
  effect array.flatMap({
    source: teams,
    select: {
      teamId: $item.id,
      teamName: $item.name,
      member: $item.members
    },
    into: allMembersWithTeam
  })
  
  // Step 2: Filter heavy members
  effect array.filter({
    source: allMembersWithTeam,
    where: gt($item.member.weight, 80),
    into: heavyMembersWithTeam
  })
  
  // Step 3: Group back by team
  effect array.groupBy({
    source: heavyMembersWithTeam,
    by: $item.teamId,
    into: result
  })
}
```

**Benefits of decomposition:**
- Each step is independently testable
- Trace shows all intermediate states
- `$item` always refers to current effect's source
- Host can optimize each step separately

### Grammar Enforcement

The grammar ensures Effects cannot appear in expression positions:

```ebnf
// Effects are ONLY in ActionStmt
ActionStmt = GuardStmt | OnceStmt | PatchStmt | EffectStmt

// EffectArgs contain Expressions, NOT Effects
EffectArg = Identifier ":" Expression ","?

// Expression does NOT include EffectStmt
Expression = TernaryExpr  // ... no EffectStmt anywhere
```

This is enforced at the **parser level**, not semantic analysis.

### Consequences

| Enables | Constrains |
|---------|------------|
| Clear `$item` scope (always current effect) | Must decompose complex operations |
| Full traceability of every step | More verbose for deeply nested data |
| Host optimization opportunities | Intermediate state in Snapshot |
| Reliable LLM code generation | Cannot express "inline" sub-operations |
| Simple mental model | |

### Canonical Statement

> **Effects are statements, not expressions. You cannot nest what was never meant to be composed.**

---

## FDR-MEL-019: Additional Effects for Composition

### Decision

MEL includes **`flatMap`** and **`groupBy`** effects to enable complex data transformations without nesting.

### Context

When nested effects are forbidden (FDR-MEL-018), developers need alternative patterns for:

1. **Nested array access**: `teams[].members[]` patterns
2. **Re-grouping**: Collecting results back into structured form
3. **Cross-level operations**: Combining data from different nesting levels

### Rationale

Without additional effects, the "no nesting" rule would make common operations impossible or extremely awkward:

```mel
// Goal: Find all active members across all teams

// Without flatMap: Awkward and unclear
effect array.map({
  source: teams,
  select: $item.members,  // This gives Array<Array<Member>>!
  into: nestedMembers
})
// Now what? nestedMembers is [[Member, Member], [Member], ...]
```

**`flatMap`** solves this:

```mel
effect array.flatMap({
  source: teams,
  select: $item.members,  // Automatically flattens
  into: allMembers        // [Member, Member, Member, ...]
})
```

**`groupBy`** enables re-structuring:

```mel
effect array.groupBy({
  source: allMembers,
  by: $item.department,
  into: membersByDepartment  // Record<string, Array<Member>>
})
```

### New Effects Specification

#### `array.flatMap`

Combines `map` and `flatten` in one operation:

```mel
effect array.flatMap({
  source: <Array<T>>,
  select: <Expression that produces Array<U> from $item>,
  into: <Path>  // Result: Array<U> (flattened)
})
```

**Example:**
```mel
// teams: [{ members: [m1, m2] }, { members: [m3] }]
effect array.flatMap({
  source: teams,
  select: $item.members,
  into: allMembers
})
// allMembers: [m1, m2, m3]
```

**With transformation:**
```mel
effect array.flatMap({
  source: teams,
  select: {
    teamId: $item.id,
    member: $item.members  // This "spreads" into multiple records
  },
  into: membersWithTeam
})
// membersWithTeam: [
//   { teamId: "t1", member: m1 },
//   { teamId: "t1", member: m2 },
//   { teamId: "t2", member: m3 }
// ]
```

#### `array.groupBy`

Groups array elements by a key:

```mel
effect array.groupBy({
  source: <Array<T>>,
  by: <Expression using $item that produces key>,
  into: <Path>  // Result: Record<Key, Array<T>>
})
```

**Example:**
```mel
effect array.groupBy({
  source: users,
  by: $item.department,
  into: usersByDepartment
})
// usersByDepartment: {
//   "engineering": [user1, user2],
//   "sales": [user3],
//   "hr": [user4, user5]
// }
```

#### `array.unique`

Removes duplicates:

```mel
effect array.unique({
  source: <Array<T>>,
  by?: <Expression for uniqueness key>,  // Optional, defaults to identity
  into: <Path>
})
```

#### `array.partition`

Splits array into two based on predicate:

```mel
effect array.partition({
  source: <Array<T>>,
  where: <Predicate using $item>,
  into: {
    pass: <Path>,  // Items where predicate is true
    fail: <Path>   // Items where predicate is false
  }
})
```

### Why These Specific Effects?

| Effect | Replaces | Common Use Case |
|--------|----------|-----------------|
| `flatMap` | Nested map + flatten | Access nested arrays |
| `groupBy` | Nested reduce + object building | Categorize/bucket items |
| `unique` | Nested filter + Set | Deduplicate |
| `partition` | Two separate filters | Binary classification |

These effects cover **90%+ of nested iteration patterns** in typical applications.

### Consequences

| Enables | Constrains |
|---------|------------|
| Complex transformations without nesting | More effects to learn |
| Flat, traceable execution | Must think in "steps" not "nesting" |
| Host can optimize each effect | Intermediate Snapshot state |

### Canonical Statement

> **Instead of nesting effects, compose them. `flatMap` and `groupBy` make composition natural.**

---

# Part III: Host Contract Alignment (v0.2.1)

The following decisions were made after critical review from the Manifesto architecture perspective. These changes ensure MEL respects the **Host Contract** and **Snapshot-only information flow** principles.

---

## FDR-MEL-020: Guard-Mandatory Effects

### Decision

All `patch` and `effect` statements MUST appear inside a `when` or `once` guard block. Top-level (unguarded) patches and effects are **syntactically forbidden**.

### Context

A critical architectural flaw was discovered in v0.2:

```mel
// v0.2 allowed this:
action getUniqueCategories() {
  effect array.map({ source: products, select: $item.category, into: allCategories })
  effect array.unique({ source: allCategories, into: uniqueCategories })
}
```

This violates Manifesto's Host Contract:

1. **compute()** is called with current Snapshot
2. Core returns **requirements** (effects to execute)
3. Host executes requirements, applies patches to Snapshot
4. Host calls **compute() again** with updated Snapshot
5. Repeat until no more requirements

The problem: When Core returns both effects in step 2, `allCategories` doesn't exist yet in Snapshot. The second effect has an undefined source.

**Host's impossible choices:**
- Execute both simultaneously? → Second effect fails (undefined source)
- Execute sequentially, pass intermediate values? → **Violates Snapshot-only information flow**
- Execute only first, then re-compute? → Host is now "interpreting" effect order

All choices break Manifesto's architecture.

### Rationale

**Guards make each step Snapshot-dependent:**

```mel
// v0.2.1: Guard-mandatory
action getUniqueCategories() {
  once(step1Done) {
    effect array.map({ source: products, select: $item.category, into: allCategories })
  }
  
  once(step2Done) when isNotNull(allCategories) {
    effect array.unique({ source: allCategories, into: uniqueCategories })
  }
}
```

**How this works with Host loop:**

```
Compute #1:
  Snapshot: { products: [...], allCategories: null, step1Done: null, step2Done: null }
  Guard "step1Done": isNull(step1Done) → TRUE
  Guard "step2Done": isNull(step2Done) && isNotNull(allCategories) → FALSE
  Requirements: [effect array.map(...)]
  
Host executes, applies patches:
  Snapshot: { products: [...], allCategories: [...], step1Done: timestamp, step2Done: null }
  
Compute #2:
  Guard "step1Done": isNull(step1Done) → FALSE (already done)
  Guard "step2Done": isNull(step2Done) && isNotNull(allCategories) → TRUE
  Requirements: [effect array.unique(...)]
  
Host executes, applies patches:
  Snapshot: { ..., uniqueCategories: [...], step2Done: timestamp }
  
Compute #3:
  Both guards → FALSE
  Requirements: []
  Done.
```

**Each step is enabled by Snapshot state, not by Host interpretation.**

### Grammar Change

```ebnf
(* v0.2: patch/effect allowed at top level *)
ActionStmt = GuardStmt | OnceStmt | PatchStmt | EffectStmt

(* v0.2.1: patch/effect ONLY inside guards *)
ActionBody = "{" { GuardedStmt } "}"
GuardedStmt = WhenStmt | OnceStmt

WhenStmt = "when" Expression "{" { InnerStmt } "}"
OnceStmt = "once" "(" Identifier ")" [ "when" Expression ] "{" { InnerStmt } "}"

InnerStmt = PatchStmt | EffectStmt | WhenStmt | OnceStmt
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Host Contract preserved | More verbose for simple cases |
| Snapshot-only information flow | Must think in "steps" |
| Each step is independently verifiable | Every mutation needs a guard |
| Re-entry safety guaranteed | Learning curve for "why guards?" |
| Deterministic execution order | |

### Canonical Statement

> **Every mutation is guarded. No patch or effect escapes the re-entry safety net.**

---

## FDR-MEL-021: Explicit Marker Patch

### Decision

`once(marker)` is a **pure guard** that expands to `when isNull(marker)`. It does NOT automatically patch the marker. Users must explicitly patch markers.

### Context

v0.2 defined `once(marker)` as expanding to:

```mel
// v0.2 expansion (automatic patch)
once(marker) { body }
→
when isNull(marker) {
  patch marker = $system.time.now  // ← Implicit!
  body
}
```

This creates an **implicit side effect** — the marker is automatically set without the user writing it.

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Automatic patch (v0.2)** | Compiler inserts patch | Implicit side effect, "magic" |
| **Explicit patch required** | User writes patch | Verbose but transparent |
| **Marker type enforcement** | Auto-patch but enforce `number \| null` | Still implicit |

### Rationale

Manifesto's Builder philosophy states:

> "Make safe patterns easy, dangerous patterns hard."
> "Implicit auto-set is dangerous because it hides state changes."

An automatic patch is:
1. **Hidden**: Not visible in source code
2. **Surprising**: Developers may not realize marker is being set
3. **Hard to debug**: Trace shows patch that doesn't exist in source
4. **Inconsistent**: Only `once` has this magic, `when` doesn't

**Explicit is better:**

```mel
// v0.2.1: Explicit marker patch
action submit() {
  once(submittedAt) {
    patch submittedAt = $system.time.now  // Explicit!
    effect api.submit({ data: formData, into: result })
  }
}
```

The user sees every state change. No surprises.

### Grammar Change

`once` is now purely a guard:

```mel
// v0.2.1 expansion (pure guard)
once(marker) { body }
→
when isNull(marker) { body }

// Conditional form
once(marker) when condition { body }
→
when and(isNull(marker), condition) { body }
```

### Consequences

| Enables | Constrains |
|---------|------------|
| No implicit side effects | Must write marker patch manually |
| All state changes visible | Slightly more verbose |
| Easier debugging | |
| Consistent with `when` | |

### Canonical Statement

> **`once(marker)` is a guard, not a mutator. All state changes are explicit.**

---

## FDR-MEL-022: Three Patch Operations

### Decision

MEL supports three patch operations: `set`, `unset`, and `merge`, matching Manifesto's patch operation model.

### Context

v0.2 only supported `set`:

```mel
patch user.name = "Alice"  // set
```

This conflates "set to null" with "delete key":

```mel
patch tasks[id] = null  // Is this "set to null" or "delete"?
```

For `Record<string, Task>`, this creates problems:
- Accumulating null entries
- Type pollution (`Task | null` everywhere)
- Ambiguous semantics

### Rationale

Manifesto Core defines exactly three patch operations:

| Operation | Meaning | Use Case |
|-----------|---------|----------|
| `set` | Replace value at path | Update a field |
| `unset` | Remove key entirely | Delete from Record |
| `merge` | Shallow merge object | Partial update |

MEL should reflect this:

```mel
// Set: Replace value
patch user.name = "Alice"

// Unset: Remove key entirely  
patch tasks[id] unset

// Merge: Shallow merge (like Object.assign)
patch user.preferences merge { theme: "dark", fontSize: 14 }
```

### Grammar

```ebnf
PatchStmt = "patch" Path PatchOp

PatchOp = "=" Expression        (* set *)
        | "unset"               (* unset *)
        | "merge" Expression    (* merge, Expression must be object *)
```

### IR Mapping

```mel
patch user.name = "Alice"
→ { op: 'set', path: ['user', 'name'], value: 'Alice' }

patch tasks[id] unset
→ { op: 'unset', path: ['tasks', id] }

patch user.preferences merge { theme: "dark" }
→ { op: 'merge', path: ['user', 'preferences'], value: { theme: 'dark' } }
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Clean Record deletion | Three keywords to learn |
| Partial object updates | merge only for objects |
| Type-safe null handling | |
| Matches Manifesto Core | |

### Canonical Statement

> **Three operations, three meanings: `set` replaces, `unset` removes, `merge` combines.**

---

## FDR-MEL-023: Path Type for Write Targets

### Decision

Effect parameters that specify write destinations (`into:`, `pass:`, `fail:`) are parsed as **Path**, not Expression.

### Context

v0.2 grammar defined:

```ebnf
EffectArg = Identifier ":" Expression
```

This means `into: activeTasks` parses `activeTasks` as an expression, which semantically means "read the value at activeTasks". But `into:` is a **write target** — it specifies where to store results.

### Rationale

Read vs Write distinction:

```mel
effect array.filter({
  source: tasks,           // READ: get value of 'tasks'
  where: eq($item.done, false),
  into: activeTasks        // WRITE: store result at 'activeTasks'
})
```

If `into:` is an Expression, the compiler would generate:
```javascript
{ into: { kind: 'get', path: ['activeTasks'] } }  // Wrong! This reads.
```

It should generate:
```javascript
{ into: ['activeTasks'] }  // Correct! This is a path to write to.
```

### Grammar Change

```ebnf
EffectArg = Identifier ":" EffectArgValue
EffectArgValue = Expression | Path

(* Write-target parameters *)
WriteTargetParam = "into" | "pass" | "fail"

(* Parser knows which params are write targets *)
```

Alternatively, introduce explicit path syntax:

```mel
into: @activeTasks        // @ prefix indicates path
into: @tasks[$system.uuid]  // Dynamic path
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Correct read/write semantics | Parser must know parameter roles |
| Type-safe effect compilation | Slightly more complex grammar |
| Clear IR generation | |

### Canonical Statement

> **`into:` is where you write, not what you read. Paths and expressions are different.**

---

## FDR-MEL-024: Canonical Form

### Decision

MEL defines a **canonical form** where all expressions are normalized to function syntax. The parser accepts operator syntax for convenience, but the compiler normalizes to canonical form before IR generation.

### Context

v0.2 allows multiple ways to express the same computation:

```mel
a + b        // Operator
add(a, b)    // Function (but 'add' wasn't in stdlib!)

a == b       // Operator
eq(a, b)     // Function

a && b       // Operator
and(a, b)    // Function
```

This violates the "one pattern" principle and causes:
- **Hash inconsistency**: Same meaning, different hashes
- **LLM confusion**: Which form to generate?
- **Formatter ambiguity**: Which form to output?

### Rationale

**Single canonical form enables:**

1. **Hash consistency**: Same meaning → same hash
2. **LLM reliability**: One pattern to learn
3. **Deterministic formatting**: One output form
4. **Simpler IR**: Direct mapping

**The canonical form is function-only:**

```mel
// Input (any valid syntax)
computed x = a + b * c == d && e

// Canonical form (after normalization)
computed x = and(eq(add(a, mul(b, c)), d), e)

// IR (direct from canonical)
{ kind: 'and', args: [{ kind: 'eq', ... }, { kind: 'get', path: ['e'] }] }
```

### Normalization Rules

| Input | Canonical | IR kind |
|-------|-----------|---------|
| `a + b` | `add(a, b)` | `add` |
| `a - b` | `sub(a, b)` | `sub` |
| `a * b` | `mul(a, b)` | `mul` |
| `a / b` | `div(a, b)` | `div` |
| `a % b` | `mod(a, b)` | `mod` |
| `-a` | `neg(a)` | `neg` |
| `a == b` | `eq(a, b)` | `eq` |
| `a != b` | `neq(a, b)` | `neq` |
| `a < b` | `lt(a, b)` | `lt` |
| `a <= b` | `lte(a, b)` | `lte` |
| `a > b` | `gt(a, b)` | `gt` |
| `a >= b` | `gte(a, b)` | `gte` |
| `a && b` | `and(a, b)` | `and` |
| `a \|\| b` | `or(a, b)` | `or` |
| `!a` | `not(a)` | `not` |
| `a ?? b` | `coalesce(a, b)` | `coalesce` |
| `a ? b : c` | `if(a, b, c)` | `if` |

### Standard Library Update

Add arithmetic functions to stdlib:

```mel
// Arithmetic (now required)
add(a, b)      // a + b
sub(a, b)      // a - b
mul(a, b)      // a * b
div(a, b)      // a / b
mod(a, b)      // a % b
neg(a)         // -a

// Conditional (rename from ternary)
if(cond, then, else)  // cond ? then : else
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Hash consistency | Must learn function names |
| LLM reliability | Operators still parsed (convenience) |
| Deterministic output | Formatter always outputs canonical |
| Simpler tooling | |

### Canonical Statement

> **One meaning, one form. Operators are sugar; functions are truth.**

---

## FDR-MEL-025: Boolean-Only Conditions

### Decision

Conditions in `when` and `once` guards MUST be boolean expressions. Truthy/falsy coercion is removed.

### Context

v0.2 defined truthy/falsy rules like JavaScript:

```mel
// v0.2: Allowed (truthy/falsy)
when items { ... }           // items is Array
when user.name { ... }       // user.name is string
when count { ... }           // count is number
```

This causes problems:

1. **Type ambiguity**: Is `when items` checking "exists" or "non-empty"?
2. **LLM errors**: LLMs generate JS-style conditions
3. **Explainability**: Hard to explain why `[]` is falsy but `[null]` is truthy

### Rationale

Manifesto Builder requires `Expr<boolean>` for conditions. MEL should match:

```mel
// v0.2.1: Boolean only
when gt(len(items), 0) { ... }    // Explicit: "items has elements"
when isNotNull(user.name) { ... } // Explicit: "name exists"
when neq(count, 0) { ... }        // Explicit: "count is non-zero"
```

**Benefits:**
- Clear semantics
- Type-safe
- LLM generates correct conditions
- Matches Manifesto Core

### Grammar Change

No grammar change needed. This is a **semantic rule**:

```
SemanticRule: WhenStmt.condition must have type boolean
SemanticRule: OnceStmt.condition (if present) must have type boolean
```

Compiler emits error:
```
Error MEL025: Condition must be boolean
  --> domain.mel:5:8
   |
 5 |   when items {
   |        ^^^^^
   |
   = 'items' has type Array<Task>, expected boolean
   = try: when gt(len(items), 0) { ... }
```

### Truthy/Falsy Table Removal

Remove from SPEC:

```
// REMOVED from v0.2.1
| Value | Boolean Coercion |
|-------|-----------------|
| `null` | `false` |
| `false` | `false` |
| `0` | `false` |
| ...
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Type safety | Must write explicit checks |
| Clear semantics | More verbose conditions |
| LLM correctness | No JS-style shortcuts |
| Explainability | |

### Canonical Statement

> **Conditions are boolean. No guessing, no coercion, no surprises.**

---

## FDR-MEL-026: Array-Only len()

### Decision

`len()` function is restricted to `Array<T>` only. Using `len()` on `Record<K,V>` is a semantic error.

### Context

v0.2 examples included:

```mel
state { tasks: Record<string, Task> = {} }
computed taskCount = len(tasks)  // ← Problem!
```

`Record` size cannot be computed in O(1) — it requires iterating all keys. This violates Core purity because it's a hidden O(n) operation inside a `computed`.

### Rationale

Manifesto Core must be predictable:
- `computed` expressions should be O(1) or clearly bounded
- O(n) operations belong in `effect` statements

**Correct pattern for Record size:**

```mel
state {
  tasks: Record<string, Task> = {}
  taskIds: Array<string> | null = null
}

action refreshTaskCount() {
  once(taskIdsLoaded) {
    effect object.keys({ source: tasks, into: taskIds })
  }
}

computed taskCount = if(isNotNull(taskIds), len(taskIds), 0)
```

**The effect makes the O(n) operation visible and traceable.**

### Type Restriction

```
len : Array<T> → number     ✅
len : Record<K,V> → Error   ❌
len : string → Error        ❌ (use strlen)
```

### Error Message

```
Error MEL026: len() requires Array
  --> domain.mel:5:20
   |
 5 |   computed count = len(tasks)
   |                    ^^^^^^^^^^
   |
   = 'tasks' has type Record<string, Task>
   = len() only works on Array<T>
   = for Record size, use: effect object.keys({ source: tasks, into: keys })
                           then: len(keys)
```

### Consequences

| Enables | Constrains |
|---------|------------|
| No hidden O(n) in computed | Must use effect for Record size |
| Predictable Core performance | More verbose |
| Clear separation of O(1) vs O(n) | |

### Canonical Statement

> **`len()` is O(1). Record size is O(n). O(n) belongs in effects, not computed.**

---

# Part IV: Semantic Closure (v0.2.2)

The following decisions close semantic gaps discovered during specification review. These changes ensure MEL is **self-consistent**, **deterministic**, and **implementable**.

---

## FDR-MEL-027: Per-Intent Idempotency

### Decision

`once(marker)` provides **per-intent idempotency**, not "once ever". It expands to:

```mel
once(marker) { body }
→
when neq(marker, $meta.intentId) { body }
```

The `once` block body **MUST** contain `patch marker = $meta.intentId`.

### Context

v0.2.1 defined `once(marker)` as `when isNull(marker)`. This created a critical flaw:

```mel
// v0.2.1 problem: "once ever" instead of "once per intent"
state { incrementedAt: number | null = null }

action increment() {
  once(incrementedAt) {
    patch incrementedAt = $system.time.now  // Set to timestamp
    patch count = add(count, 1)
  }
}

// First call: incrementedAt == null → executes, sets timestamp
// Second call: incrementedAt != null → NEVER executes again!
// This action becomes permanently disabled after first use.
```

**The problem:** Marker stored in domain state becomes permanent. Once set, `isNull(marker)` is forever `false`. The action can never run again.

**What we actually need:**
- **Same Intent execution:** Don't re-execute (prevent re-entry loops)
- **Different Intent:** Execute again (normal behavior)

### Rationale

Manifesto's Host loop has a stable `intentId` per execution:

```
Intent A (intentId = "intent-A-123")
├── compute() #1 → requirements
├── Host executes effects
├── compute() #2 (re-entry) → marker == "intent-A-123" → skip
└── compute() #3 → no requirements → done

Intent B (intentId = "intent-B-456")  
├── compute() #1 → marker == "intent-A-123" != "intent-B-456" → execute!
├── ...
```

**Per-intent idempotency means:**
- Marker stores the `intentId` of the last execution
- Same intent: `marker == $meta.intentId` → skip (re-entry safe)
- Different intent: `marker != $meta.intentId` → execute (normal)

### Grammar Change

```ebnf
(* v0.2.2: once takes Path, not just Identifier *)
OnceStmt = "once" "(" Path ")" [ "when" Expression ] "{" { InnerStmt } "}"
```

### System Value Addition

```mel
$meta.intentId : string   // Stable identifier for current intent execution
```

### Expansion Rules

```mel
// Basic once
once(marker) { body }
→
when neq(marker, $meta.intentId) { body }

// Conditional once
once(marker) when condition { body }
→
when and(neq(marker, $meta.intentId), condition) { body }
```

### Compiler Rule (Mandatory)

```
Rule: once block body MUST contain: patch <marker> = $meta.intentId

Error MEL027: once() block missing marker patch
  --> domain.mel:5:3
   |
 5 |   once(step1) {
   |   ^^^^^^^^^^^^
   |
   = once() blocks must patch the marker to $meta.intentId
   = add: patch step1 = $meta.intentId
```

### Distinguishing "Once Ever" vs "Once Per Intent"

```mel
// Per-intent idempotency (re-entry safe, repeatable across intents)
action increment() {
  once(lastIncrementIntent) {
    patch lastIncrementIntent = $meta.intentId
    patch count = add(count, 1)
  }
}

// True "once ever" (use explicit when, not once)
action submitOnce() {
  when isNull(submittedAt) {
    patch submittedAt = $system.time.now
    effect api.submit({ data: form, into: result })
  }
}
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Re-entry safety within intent | Must patch marker in body |
| Repeatable across intents | Marker stores intentId, not timestamp |
| Matches Host loop semantics | Compiler must enforce patch rule |
| Clear distinction from "once ever" | |

### Canonical Statement

> **`once(marker)` means "once per intent". For "once ever", use `when isNull(...)`.**

---

## FDR-MEL-028: Record Collection Effects

### Decision

MEL provides **Record-specific effects** for working with Record collections, separate from Array effects.

### Context

v0.2.1 had a type contradiction:
- `tasks: Record<string, Task>` in state
- `effect array.filter({ source: tasks, ... })` in examples

Array effects expect `Array<T>`, not `Record<K,V>`. This was a spec inconsistency.

### Rationale

Manifesto philosophy favors **Record-by-id** for mutable collections:
- Stable references (ID-based access)
- O(1) lookup by key
- Patch-friendly (can target specific keys)

But Record iteration is O(n) and belongs in effects. We need Record-specific effects.

### Record Effect Set

```mel
// Convert Record to Array of entries for processing
effect record.entries({
  source: <Record<K, V>>,
  into: <Path>                    // Array<{ key: K, value: V }>
})

effect record.keys({
  source: <Record<K, V>>,
  into: <Path>                    // Array<K>
})

effect record.values({
  source: <Record<K, V>>,
  into: <Path>                    // Array<V>
})

// Filter Record values (keeps structure)
effect record.filter({
  source: <Record<K, V>>,
  where: <Expression using $item>,  // $item is V
  into: <Path>                      // Record<K, V>
})

// Map Record values (keeps keys)
effect record.mapValues({
  source: <Record<K, V>>,
  select: <Expression using $item>, // $item is V
  into: <Path>                      // Record<K, NewV>
})

// Reconstruct Record from entries
effect record.fromEntries({
  source: <Array<{ key: K, value: V }>>,
  into: <Path>                      // Record<K, V>
})
```

### Example: Filter Tasks

```mel
state {
  tasks: Record<string, Task> = {}
  activeTasks: Record<string, Task> | null = null
}

action filterActiveTasks() {
  once(filtered) {
    patch filtered = $meta.intentId
    effect record.filter({
      source: tasks,
      where: eq($item.completed, false),
      into: activeTasks
    })
  }
}
```

### Example: Complex Pipeline with Record

```mel
action processOrders() {
  // Step 1: Get entries from Record
  once(step1) {
    patch step1 = $meta.intentId
    effect record.entries({
      source: orders,
      into: orderEntries     // Array<{ key: string, value: Order }>
    })
  }
  
  // Step 2: Filter high-value orders (as array)
  once(step2) when isNotNull(orderEntries) {
    patch step2 = $meta.intentId
    effect array.filter({
      source: orderEntries,
      where: gt($item.value.total, 1000),
      into: highValueEntries
    })
  }
  
  // Step 3: Convert back to Record
  once(step3) when isNotNull(highValueEntries) {
    patch step3 = $meta.intentId
    effect record.fromEntries({
      source: highValueEntries,
      into: highValueOrders
    })
  }
}
```

### Type Rules

| Effect | Source Type | Result Type |
|--------|-------------|-------------|
| `record.entries` | `Record<K, V>` | `Array<{ key: K, value: V }>` |
| `record.keys` | `Record<K, V>` | `Array<K>` |
| `record.values` | `Record<K, V>` | `Array<V>` |
| `record.filter` | `Record<K, V>` | `Record<K, V>` |
| `record.mapValues` | `Record<K, V>` | `Record<K, NewV>` |
| `record.fromEntries` | `Array<{ key: K, value: V }>` | `Record<K, V>` |

### Consequences

| Enables | Constrains |
|---------|------------|
| Type-safe Record operations | More effects to learn |
| Clear Array vs Record distinction | Must choose correct effect family |
| Manifesto Record-by-id pattern works | |
| Pipeline flexibility | |

### Canonical Statement

> **`array.*` for arrays, `record.*` for records. Choose the right tool for your collection type.**

---

## FDR-MEL-029: Deterministic Semantics

### Decision

MEL specifies **deterministic semantics** for all operations that could vary across implementations.

### Context

Operations like `object.keys`, `array.sort`, and `groupBy` can produce different results on different hosts/runtimes:
- JavaScript: `Object.keys()` order is implementation-defined for some cases
- Sort stability varies by engine
- Unicode handling differs

This breaks **Host agnosticism** — the same Snapshot could produce different results on different hosts.

### Rationale

Manifesto requires **semantic stability**:
- Same Snapshot + Same Domain → Same Result (regardless of Host)
- Replay/migration between hosts must be safe
- Explainability requires predictable behavior

### Deterministic Rules

#### Key Ordering

```
record.keys / record.entries / record.values:
  - Keys are returned in LEXICOGRAPHIC ORDER (Unicode code point)
  - This is stable and reproducible across all hosts
  
groupBy result:
  - Group keys in lexicographic order
  - Items within each group preserve source order
```

#### Sorting

```
array.sort:
  - MUST be stable sort (equal elements keep original order)
  - When `by` values are equal: preserve source order
  - Numeric comparison for numbers
  - Lexicographic comparison for strings
```

#### Uniqueness

```
array.unique:
  - First occurrence wins
  - Result preserves order of first occurrences
```

#### String Operations

```
trim / lower / upper:
  - Unicode-aware (full Unicode case mapping)
  - Locale-independent (no locale-specific rules)
  - trim: removes Unicode whitespace (Zs category + control chars)
```

### Example: Predictable Keys

```mel
state {
  items: Record<string, Item> = {
    "zebra": { name: "Z" },
    "apple": { name: "A" },
    "mango": { name: "M" }
  }
}

action getKeys() {
  once(keysLoaded) {
    patch keysLoaded = $meta.intentId
    effect record.keys({ source: items, into: itemKeys })
  }
}

// itemKeys is ALWAYS ["apple", "mango", "zebra"] (lexicographic)
// Never ["zebra", "apple", "mango"] (insertion order)
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Host-agnostic execution | Can't rely on insertion order |
| Safe replay/migration | Potentially different from JS behavior |
| Predictable testing | Must sort explicitly if specific order needed |
| Explainable results | |

### Canonical Statement

> **Same input, same output, every time, on every host.**

---

## FDR-MEL-030: No Template Literals

### Decision

MEL removes template literals. Use `concat()` for string building.

### Context

v0.2.1 allowed template literals:

```mel
computed greeting = `Hello, ${user.name}!`
```

This violates the "one pattern per concept" principle:
- Template literal AND `concat()` both build strings
- LLM must choose between two equivalent forms
- Coercion rules needed for `${expr}` when expr is not string

### Rationale

**AI-Native principle:** One pattern per concept.

```mel
// ❌ Two ways to do the same thing
`Hello, ${name}!`
concat("Hello, ", name, "!")

// ✅ One way only
concat("Hello, ", name, "!")
```

**Type safety:** Template literals require implicit coercion:
```mel
`Count: ${count}`  // count is number — needs toString
```

MEL is strictly typed. Implicit coercion is forbidden.

### Migration

```mel
// Before (v0.2.1)
computed message = `${user.name} has ${count} items`

// After (v0.2.2)
computed message = concat(user.name, " has ", toString(count), " items")
```

### Standard Library Addition

```mel
toString(x: number | boolean | null) → string
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Single string-building pattern | More verbose for interpolation |
| No implicit coercion | Must use toString() explicitly |
| Simpler grammar | |
| LLM consistency | |

### Canonical Statement

> **One way to build strings: `concat()`. No magic interpolation.**

---

## FDR-MEL-031: Iteration Variable IR

### Decision

`$item` and `$acc` are represented in IR as variable references, not Snapshot paths. They are **only valid within effect sub-expressions**.

### Context

MEL expressions compile to `ExprNode` IR. Most nodes reference Snapshot paths:
```typescript
{ kind: 'get', path: ['user', 'name'] }
```

But `$item` and `$acc` are **not Snapshot paths** — they're loop variables bound by the enclosing effect.

### IR Representation

```typescript
// New ExprNode kind for iteration variables
type ExprNode =
  | { kind: 'lit', value: Primitive }
  | { kind: 'get', path: PathSegment[] }
  | { kind: 'var', name: 'item' | 'acc' }  // NEW
  | { kind: 'add', left: ExprNode, right: ExprNode }
  | // ... other kinds
```

### Scope Rules

```
$item and $acc are ONLY valid in:
  - effect array.* : where, select, by, accumulate parameters
  - effect record.* : where, select parameters

$item and $acc are INVALID in:
  - computed expressions
  - when/once conditions  
  - patch right-hand side (outside effect)
  - top-level expressions
```

### Compiler Validation

```
Error MEL031: $item used outside effect context
  --> domain.mel:5:20
   |
 5 |   computed total = $item.price
   |                    ^^^^^
   |
   = $item is only valid inside effect sub-expressions
   = use a named state field instead
```

### Example: Valid vs Invalid

```mel
// ✅ Valid: $item in effect
effect array.map({
  source: items,
  select: mul($item.price, $item.quantity),  // $item valid here
  into: totals
})

// ❌ Invalid: $item in computed
computed total = $item.price  // Error: $item outside effect

// ❌ Invalid: $item in condition
when gt($item.count, 0) { ... }  // Error: $item outside effect
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Clear variable semantics | Cannot use $item outside effects |
| Type-safe scope checking | Must pass values through Snapshot |
| Unambiguous IR | |
| Host can evaluate correctly | |

### Canonical Statement

> **`$item` and `$acc` exist only within effects. Snapshot is the only way to pass data between steps.**

---

## FDR-MEL-032: Dynamic Path Segments

### Decision

Path segments can be **dynamic** (computed at runtime). IR represents this explicitly.

### Context

MEL allows dynamic indexing:
```mel
patch tasks[$system.uuid] = newTask
patch items[selectedId].completed = true
```

But Manifesto's existing IR uses static paths (`string[]`). Dynamic paths need explicit representation.

### IR Representation

```typescript
type PathSegment =
  | { kind: 'prop', name: string }           // Static: .name
  | { kind: 'index', expr: ExprNode }        // Dynamic: [expr]

type Path = PathSegment[]

// Examples:
// tasks.active → [{ kind: 'prop', name: 'tasks' }, { kind: 'prop', name: 'active' }]
// tasks[id] → [{ kind: 'prop', name: 'tasks' }, { kind: 'index', expr: { kind: 'get', path: ['id'] } }]
// items[$system.uuid] → [{ kind: 'prop', name: 'items' }, { kind: 'index', expr: { kind: 'system', path: ['uuid'] } }]
```

### Type Constraints

Dynamic index expressions must evaluate to `string` or `number`:
- `Record<K, V>` indexing: `K` type (usually `string`)
- `Array<T>` indexing: `number`

### Example: IR Generation

```mel
patch orders[orderId].status = "shipped"
```

Generates:
```typescript
{
  op: 'set',
  path: [
    { kind: 'prop', name: 'orders' },
    { kind: 'index', expr: { kind: 'get', path: ['orderId'] } },
    { kind: 'prop', name: 'status' }
  ],
  value: { kind: 'lit', value: 'shipped' }
}
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Dynamic Record/Array access | Index type must be checked |
| Flexible data structures | IR is more complex |
| Natural MEL syntax | Host must evaluate index expressions |

### Canonical Statement

> **Paths can be dynamic. `[expr]` evaluates at runtime to find the target.**

---

## FDR-MEL-033: Effect Result Contract

### Decision

Effects write results to their `into` path via **set** patch. Failures are written to a **standard error structure**.

### Context

When Host executes an effect like:
```mel
effect api.fetch({ url: "/users", into: users })
```

How does the result get into Snapshot? What happens on failure?

### Result Contract

**Success:**
```typescript
// Host applies:
{ op: 'set', path: <into>, value: <result> }
```

**Failure:**
```typescript
// Host applies:
{ op: 'set', path: <into>, value: {
  $error: true,
  code: string,      // Error code (e.g., "NETWORK_ERROR", "TIMEOUT")
  message: string,   // Human-readable message
  details?: any      // Additional context
}}
```

### Checking for Errors

```mel
state {
  users: Array<User> | { $error: boolean, code: string, message: string } | null = null
}

action loadUsers() {
  once(loadStarted) {
    patch loadStarted = $meta.intentId
    effect api.fetch({ url: "/users", into: users })
  }
}

// In subsequent logic:
when and(isNotNull(users), not(users.$error)) {
  // Success: users is Array<User>
  effect array.map({ source: users, ... })
}

when and(isNotNull(users), users.$error) {
  // Failure: handle error
  patch errorMessage = users.message
}
```

### Standard Error Codes

| Code | Meaning |
|------|---------|
| `NETWORK_ERROR` | Network request failed |
| `TIMEOUT` | Operation timed out |
| `NOT_FOUND` | Resource not found (404) |
| `UNAUTHORIZED` | Authentication required (401) |
| `FORBIDDEN` | Permission denied (403) |
| `VALIDATION_ERROR` | Input validation failed |
| `INTERNAL_ERROR` | Server/system error |

### Idempotency Note

The `into` path is **always overwritten** (set, not merge). This ensures:
- Previous results don't leak into new results
- Error → Success transition is clean
- Retry semantics are clear

### Consequences

| Enables | Constrains |
|---------|------------|
| Errors are values (Manifesto principle) | Must check $error before using result |
| Explicit error handling | Type becomes union with error |
| No exceptions/throws | More verbose success checks |
| Predictable Host behavior | |

### Canonical Statement

> **Effect results arrive via `set`. Errors are values with `$error: true`.**

---

# Part V: Specification Completeness (v0.2.3)

The following decisions complete the MEL specification by closing all remaining semantic gaps identified during implementation review. These changes ensure MEL is **fully implementable** with **no ambiguity**.

---

## FDR-MEL-034: Equality Semantics

### Decision

Equality comparison follows strict rules:
- `eq(a, b)`: Returns `true` if and only if `a` and `b` have the same type AND the same value. Otherwise `false`.
- `neq(a, b)`: Defined as `not(eq(a, b))`. Always.

### Context (CRITICAL)

v0.2.2 introduced per-intent idempotency with:
```mel
once(marker) { ... }
→ when neq(marker, $meta.intentId) { ... }
```

But if `marker` is `null` (initial state) and `$meta.intentId` is `"abc"` (string), what is `neq(null, "abc")`?

If the spec had said "different types → eq returns false, neq returns false" (a logical error), then:
- `eq(null, "abc") = false` ✓
- `neq(null, "abc") = false` ✗ (WRONG!)
- `once()` would NEVER fire on initial state!

This would break the entire per-intent idempotency mechanism.

### Normative Rules

```
EQUALITY RULES (Normative):

1. eq(a, b) = true  IFF  typeof(a) == typeof(b) AND a === b
2. eq(a, b) = false  OTHERWISE

3. neq(a, b) := not(eq(a, b))  ALWAYS

TYPE COMPARISON TABLE:
┌─────────┬─────────┬────────────────────────────────┐
│ a       │ b       │ eq(a, b)                       │
├─────────┼─────────┼────────────────────────────────┤
│ null    │ null    │ true                           │
│ null    │ string  │ false (different types)        │
│ null    │ number  │ false (different types)        │
│ string  │ string  │ true if same chars, else false │
│ number  │ number  │ true if same value, else false │
│ boolean │ boolean │ true if same value, else false │
│ number  │ string  │ false (different types)        │
└─────────┴─────────┴────────────────────────────────┘

DERIVED neq() TABLE:
┌─────────┬─────────┬────────────────────────────────┐
│ a       │ b       │ neq(a, b) = not(eq(a, b))      │
├─────────┼─────────┼────────────────────────────────┤
│ null    │ null    │ false                          │
│ null    │ string  │ true (different types → not eq)│
│ null    │ number  │ true (different types → not eq)│
│ string  │ string  │ false if same, true if diff    │
│ number  │ number  │ false if same, true if diff    │
└─────────┴─────────┴────────────────────────────────┘
```

### Verification: once() Works Correctly

```mel
state { marker: string | null = null }

action test() {
  once(marker) {
    patch marker = $meta.intentId
    // ...
  }
}

// First call: marker = null, $meta.intentId = "intent-A"
// neq(null, "intent-A") = not(eq(null, "intent-A")) = not(false) = true ✓
// → once() fires!

// Re-entry: marker = "intent-A", $meta.intentId = "intent-A"  
// neq("intent-A", "intent-A") = not(eq("intent-A", "intent-A")) = not(true) = false
// → once() skips (re-entry safe) ✓

// New intent: marker = "intent-A", $meta.intentId = "intent-B"
// neq("intent-A", "intent-B") = not(eq("intent-A", "intent-B")) = not(false) = true ✓
// → once() fires again!
```

### Consequences

| Enables | Constrains |
|---------|------------|
| `once()` works with null markers | Must use explicit type checks if needed |
| Predictable equality across types | No implicit coercion (e.g., `"1" != 1`) |
| `neq` is always `not(eq)` | Cannot have special `neq` behavior |

### Canonical Statement

> **`neq(a, b)` is ALWAYS `not(eq(a, b))`. Different types are never equal.**

---

## FDR-MEL-035: Universal Index Access

### Decision

The `at()` function and `[]` syntax support both Array and Record indexing:

```
at(array: Array<T>, index: number) → T | null
at(record: Record<K, V>, key: K) → V | null

x[y] is ALWAYS sugar for at(x, y)
```

### Context

v0.2.2 stated "`array[index]` is sugar for `at(array, index)`" but examples used:
```mel
tasks: Record<string, Task>
patch tasks[id] = newTask
patch tasks[id] unset
```

If `at()` only works on Array, then `tasks[id]` cannot be desugared, breaking the "one canonical form" principle.

### Overloaded Signatures

```
at : (Array<T>, number) → T | null
at : (Record<K, V>, K) → V | null

Out of bounds / missing key → null (no exception)
```

### Canonicalization

```mel
// Surface syntax
tasks[id]
items[0]
nested.data[key]

// Canonical form (always at())
at(tasks, id)
at(items, 0)
at(at(nested, "data"), key)  // Note: nested.data becomes at(nested, "data")
```

### Path Canonicalization

For paths (write targets), the same rule applies:

```mel
// Surface
patch tasks[id].status = "done"

// Canonical path segments
[
  { kind: 'prop', name: 'tasks' },
  { kind: 'index', expr: { kind: 'get', path: ['id'] } },
  { kind: 'prop', name: 'status' }
]
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Single canonicalization rule for `[]` | `at()` must be polymorphic |
| Record and Array use same syntax | Type checker must verify index type |
| Simpler IR (always `at` node) | |

### Canonical Statement

> **`x[y]` is always `at(x, y)`. Works on both Array (by index) and Record (by key).**

---

## FDR-MEL-036: Scope Resolution Order

### Decision

Name resolution follows a strict priority order:

```
1. Action Parameters (highest)
2. Computed Values
3. State Fields
4. System Values ($system.*, $meta.*, $item, $acc)
```

**Name collision between Computed and State is a compile-time error.**

### Context

Example from v0.2.2:
```mel
state { tasks: Record<string, Task> = {} }
computed taskCount = cond(isNotNull(taskIds), len(taskIds), 0)
computed hasAnyTasks = gt(taskCount, 0)  // References computed!
```

Without explicit scope rules, `taskCount` in `hasAnyTasks` could be:
- Interpreted as state (doesn't exist → error)
- Interpreted as computed (correct)
- Ambiguous (implementation-dependent)

### Resolution Rules

```
SCOPE RESOLUTION (Normative):

1. In Action body:
   Parameters > Computed > State > System

2. In Computed expression:
   Computed > State > System
   (No parameters — computed is not inside action)

3. In Effect sub-expression (where, select, etc.):
   $item/$acc > Parameters > Computed > State > System

NAME COLLISION RULES:

- Computed name == State name → COMPILE ERROR
- Parameter name shadows Computed/State → ALLOWED (with warning)
- $item/$acc shadow everything in effect context → ALLOWED (by design)
```

### Example

```mel
domain Example {
  state {
    count: number = 0
    items: Array<Item> = []
  }
  
  computed total = len(items)           // items → state.items
  computed hasItems = gt(total, 0)      // total → computed.total ✓
  
  action process(count: number) {       // count shadows state.count
    when gt(count, 0) {                 // count → parameter (shadows state)
      patch items = []                  // items → state.items
    }
  }
  
  // ❌ COMPILE ERROR: name collision
  // state { foo: number = 0 }
  // computed foo = 1
}
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Computed can reference other computed | No same name in computed & state |
| Clear, predictable resolution | Parameters shadow silently |
| LLM-friendly (no ambiguity) | |

### Canonical Statement

> **Params > Computed > State > System. Computed/State name collision is an error.**

---

## FDR-MEL-037: System Value Stability

### Decision

System values have defined stability scopes:

| Value | Stability Scope |
|-------|-----------------|
| `$system.time.now` | Constant within single `compute()` call |
| `$system.uuid` | Fresh on each ACCESS (not per-compute) |
| `$meta.intentId` | Constant within entire intent execution |
| `$meta.actor` | Constant within entire intent execution |
| `$meta.authority` | Constant within entire intent execution |
| `$item` | Bound per iteration element |
| `$acc` | Bound per iteration accumulator |

### Context

Example code assumes:
```mel
patch tasks[$system.uuid] = {
  id: $system.uuid,  // Same UUID as key?
  ...
}
```

If `$system.uuid` is fresh on every access, the key and `id` field would differ!

### Normative Rules

```
$system.time.now:
  - Same value for all accesses within one compute() call
  - MAY change between compute() calls (even same intent)
  - Rationale: Consistent time reference within atomic computation

$system.uuid:
  - Fresh UUID on EACH ACCESS (not cached)
  - Rationale: Multiple UUIDs often needed in one action
  - Pattern for same UUID: store in intermediate state first

$meta.intentId:
  - Same value for entire intent execution (all compute() calls)
  - Rationale: Enables per-intent idempotency

$meta.actor, $meta.authority:
  - Same value for entire intent execution
  - Rationale: Security context doesn't change mid-intent
```

### Pattern for Same UUID

```mel
// ❌ WRONG: may get different UUIDs
patch tasks[$system.uuid] = { id: $system.uuid, ... }

// ✅ CORRECT: capture UUID first
state { pendingId: string | null = null }

action addTask(title: string) {
  once(step1) when isNull(pendingId) {
    patch step1 = $meta.intentId
    patch pendingId = $system.uuid  // Capture once
  }
  
  once(step2) when isNotNull(pendingId) {
    patch step2 = $meta.intentId
    patch tasks[pendingId] = {      // Use captured value
      id: pendingId,
      title: title
    }
    patch pendingId = null          // Clear for next use
  }
}
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Multiple UUIDs per action | Must capture UUID if reuse needed |
| Consistent time in compute | Time may differ across compute calls |
| Stable intent context | |

### Canonical Statement

> **`$system.uuid` is fresh per access. `$system.time.now` is stable per compute(). `$meta.*` is stable per intent.**

---

## FDR-MEL-038: Sort Determinism

### Decision

`array.sort` has fully deterministic semantics:

```
SORT RULES (Normative):

1. ALGORITHM: Stable sort (equal elements preserve original order)

2. COMPARISON:
   - number: Numeric comparison (ascending by default)
   - string: Lexicographic (Unicode code point order)
   - boolean: false < true
   - Mixed types: NOT ALLOWED (compile error if detected, runtime error otherwise)

3. NULL HANDLING:
   - null values sort LAST (after all non-null values)
   - Multiple nulls preserve original relative order (stable)

4. SPECIAL NUMBERS:
   - NaN: Treated as greater than all numbers, less than null
   - -Infinity < ... < 0 < ... < +Infinity < NaN < null

5. ORDER PARAMETER:
   - "asc" (default): As described above
   - "desc": Reverse of above (null still last)
```

### Examples

```mel
// Numbers
[3, 1, null, 2] → [1, 2, 3, null]

// Strings  
["b", "a", null, "c"] → ["a", "b", "c", null]

// With NaN
[3, NaN, 1, null] → [1, 3, NaN, null]

// Descending
[3, 1, null, 2] with order: "desc" → [3, 2, 1, null]

// Stable (equal elements)
[{v:1, id:"a"}, {v:1, id:"b"}] sorted by v → [{v:1, id:"a"}, {v:1, id:"b"}] (order preserved)
```

### Type Restrictions

```mel
// ✅ Homogeneous by expression
effect array.sort({
  source: items,
  by: $item.createdAt,  // Must be same type for all items
  into: sorted
})

// ❌ COMPILE/RUNTIME ERROR: Mixed types in by expression
// If items[0].value is number and items[1].value is string
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Host-independent results | Must handle null explicitly |
| Predictable null handling | Cannot mix types in sort key |
| Stable sort guaranteed | |

### Canonical Statement

> **Sort is stable. null sorts last. NaN sorts after numbers. Mixed types are errors.**

---

## FDR-MEL-039: Complete IR Specification

### Decision

The IR (Intermediate Representation) is fully specified with all node types required for MEL v0.2.3.

### Expression Nodes

```typescript
type ExprNode =
  // Literals
  | { kind: 'lit'; value: null | boolean | number | string }
  
  // Variable access (iteration context only)
  | { kind: 'var'; name: 'item' | 'acc' }
  
  // State/Computed access
  | { kind: 'get'; path: PathNode }
  
  // System value access
  | { kind: 'sys'; path: string[] }  // e.g., ['system', 'time', 'now']
  
  // Function call
  | { kind: 'call'; fn: string; args: ExprNode[] }
  
  // Object literal
  | { kind: 'obj'; fields: { key: string; value: ExprNode }[] }
  
  // Array literal
  | { kind: 'arr'; elements: ExprNode[] }
```

### Path Nodes (for both read and write)

```typescript
type PathNode = PathSegment[]

type PathSegment =
  // Static property: .foo
  | { kind: 'prop'; name: string }
  
  // Dynamic index: [expr]
  | { kind: 'index'; expr: ExprNode }
```

### Statement Nodes

```typescript
type StmtNode =
  // Guard
  | { kind: 'when'; cond: ExprNode; body: StmtNode[] }
  
  // Patch operations
  | { kind: 'patch'; op: 'set'; path: PathNode; value: ExprNode }
  | { kind: 'patch'; op: 'unset'; path: PathNode }
  | { kind: 'patch'; op: 'merge'; path: PathNode; value: ExprNode }
  
  // Effect
  | { kind: 'effect'; type: string; args: EffectArg[] }

type EffectArg =
  | { kind: 'read'; name: string; value: ExprNode }
  | { kind: 'write'; name: string; path: PathNode }
```

### Canonicalization Rules

```
SURFACE → CANONICAL IR

Operators:
  a + b       → { kind: 'call', fn: 'add', args: [a, b] }
  a - b       → { kind: 'call', fn: 'sub', args: [a, b] }
  a * b       → { kind: 'call', fn: 'mul', args: [a, b] }
  a / b       → { kind: 'call', fn: 'div', args: [a, b] }
  a % b       → { kind: 'call', fn: 'mod', args: [a, b] }
  -a          → { kind: 'call', fn: 'neg', args: [a] }
  
  a == b      → { kind: 'call', fn: 'eq', args: [a, b] }
  a != b      → { kind: 'call', fn: 'neq', args: [a, b] }
  a < b       → { kind: 'call', fn: 'lt', args: [a, b] }
  a <= b      → { kind: 'call', fn: 'lte', args: [a, b] }
  a > b       → { kind: 'call', fn: 'gt', args: [a, b] }
  a >= b      → { kind: 'call', fn: 'gte', args: [a, b] }
  
  a && b      → { kind: 'call', fn: 'and', args: [a, b] }
  a || b      → { kind: 'call', fn: 'or', args: [a, b] }
  !a          → { kind: 'call', fn: 'not', args: [a] }
  
  a ?? b      → { kind: 'call', fn: 'coalesce', args: [a, b] }
  a ? b : c   → { kind: 'call', fn: 'cond', args: [a, b, c] }

Index access:
  x[y]        → { kind: 'call', fn: 'at', args: [x, y] }
  x.y         → { kind: 'get', path: [..., { kind: 'prop', name: 'y' }] }

System values:
  $system.uuid        → { kind: 'sys', path: ['system', 'uuid'] }
  $meta.intentId      → { kind: 'sys', path: ['meta', 'intentId'] }
  $item               → { kind: 'var', name: 'item' }
  $acc                → { kind: 'var', name: 'acc' }

Once expansion (v0.2.3):
  once(marker) { body }
  →
  when neq(marker, $meta.intentId) { body }
  →
  { kind: 'when',
    cond: { kind: 'call', fn: 'neq', args: [
      { kind: 'get', path: [{ kind: 'prop', name: 'marker' }] },
      { kind: 'sys', path: ['meta', 'intentId'] }
    ]},
    body: [...] }
```

### Example: Complete IR

```mel
// MEL source
action addTask(title: string) {
  once(lastIntent) when neq(trim(title), "") {
    patch lastIntent = $meta.intentId
    patch tasks[$system.uuid] = {
      id: $system.uuid,
      title: trim(title)
    }
  }
}
```

```typescript
// IR output
{
  kind: 'action',
  name: 'addTask',
  params: [{ name: 'title', type: 'string' }],
  body: [{
    kind: 'when',
    cond: {
      kind: 'call',
      fn: 'and',
      args: [
        { kind: 'call', fn: 'neq', args: [
          { kind: 'get', path: [{ kind: 'prop', name: 'lastIntent' }] },
          { kind: 'sys', path: ['meta', 'intentId'] }
        ]},
        { kind: 'call', fn: 'neq', args: [
          { kind: 'call', fn: 'trim', args: [
            { kind: 'get', path: [{ kind: 'prop', name: 'title' }] }
          ]},
          { kind: 'lit', value: '' }
        ]}
      ]
    },
    body: [
      { kind: 'patch', op: 'set',
        path: [{ kind: 'prop', name: 'lastIntent' }],
        value: { kind: 'sys', path: ['meta', 'intentId'] }
      },
      { kind: 'patch', op: 'set',
        path: [
          { kind: 'prop', name: 'tasks' },
          { kind: 'index', expr: { kind: 'sys', path: ['system', 'uuid'] } }
        ],
        value: { kind: 'obj', fields: [
          { key: 'id', value: { kind: 'sys', path: ['system', 'uuid'] } },
          { key: 'title', value: { kind: 'call', fn: 'trim', args: [
            { kind: 'get', path: [{ kind: 'prop', name: 'title' }] }
          ]}}
        ]}
      }
    ]
  }]
}
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Unambiguous implementation | All constructs must map to IR |
| Host-independent execution | No implementation-specific nodes |
| Complete specification | Must update IR when grammar changes |

### Canonical Statement

> **Every MEL construct has exactly one IR representation. The IR is the normative specification.**

---

# Part VI: Implementation Convergence (v0.2.4)

The following decisions resolve implementation ambiguities discovered during v0.2.3 review. These changes ensure that **all implementations converge to identical behavior**.

---

## FDR-MEL-040: Call-Only IR

### Decision

**All functions, operators, and built-ins use `{kind: 'call'}` IR nodes.**

There are NO specialized IR node kinds for individual operations.

### Context (CRITICAL)

v0.2.3 had conflicting IR representations:
- §7.2 defined `{kind: 'neq', left, right}` (specialized nodes)
- §7.4 defined `{kind: 'call', fn: 'at', args: [...]}` (call nodes)
- §7.5 once expansion used `{kind: 'call', fn: 'neq', ...}`

This violated Axiom A12 ("Every construct has exactly one IR representation").

### Normative IR Node Types (v0.2.4)

```typescript
type ExprNode =
  // Literals
  | { kind: 'lit'; value: null | boolean | number | string }
  
  // Variable (iteration context only)
  | { kind: 'var'; name: 'item' | 'acc' }
  
  // System value access
  | { kind: 'sys'; path: string[] }
  
  // State/Computed access
  | { kind: 'get'; path: PathNode }
  | { kind: 'get'; base: ExprNode; path: PathNode }  // $item.foo
  
  // Function/operator call (UNIVERSAL)
  | { kind: 'call'; fn: string; args: ExprNode[] }
  
  // Object literal
  | { kind: 'obj'; fields: { key: string; value: ExprNode }[] }
  
  // Array literal
  | { kind: 'arr'; elements: ExprNode[] }
```

**ONLY 7 node kinds for expressions.** No `{kind: 'add'}`, `{kind: 'eq'}`, etc.

### Canonicalization Table (Complete)

| Surface Syntax | IR |
|----------------|-----|
| `a + b` | `{ kind: 'call', fn: 'add', args: [A, B] }` |
| `a - b` | `{ kind: 'call', fn: 'sub', args: [A, B] }` |
| `a * b` | `{ kind: 'call', fn: 'mul', args: [A, B] }` |
| `a / b` | `{ kind: 'call', fn: 'div', args: [A, B] }` |
| `a % b` | `{ kind: 'call', fn: 'mod', args: [A, B] }` |
| `-a` | `{ kind: 'call', fn: 'neg', args: [A] }` |
| `a == b` | `{ kind: 'call', fn: 'eq', args: [A, B] }` |
| `a != b` | `{ kind: 'call', fn: 'neq', args: [A, B] }` |
| `a < b` | `{ kind: 'call', fn: 'lt', args: [A, B] }` |
| `a <= b` | `{ kind: 'call', fn: 'lte', args: [A, B] }` |
| `a > b` | `{ kind: 'call', fn: 'gt', args: [A, B] }` |
| `a >= b` | `{ kind: 'call', fn: 'gte', args: [A, B] }` |
| `a && b` | `{ kind: 'call', fn: 'and', args: [A, B] }` |
| `a \|\| b` | `{ kind: 'call', fn: 'or', args: [A, B] }` |
| `!a` | `{ kind: 'call', fn: 'not', args: [A] }` |
| `a ?? b` | `{ kind: 'call', fn: 'coalesce', args: [A, B] }` |
| `a ? b : c` | `{ kind: 'call', fn: 'cond', args: [A, B, C] }` |
| `x[y]` | `{ kind: 'call', fn: 'at', args: [X, Y] }` |
| `len(arr)` | `{ kind: 'call', fn: 'len', args: [ARR] }` |
| `trim(s)` | `{ kind: 'call', fn: 'trim', args: [S] }` |
| `isNull(x)` | `{ kind: 'call', fn: 'isNull', args: [X] }` |
| ... | All functions follow this pattern |

### Why Call-Only?

1. **Single pattern**: One IR structure for all operations
2. **Extensibility**: Adding new functions doesn't require new node kinds
3. **Simplicity**: Evaluator is a single dispatch on `fn` name
4. **Traceability**: Trace format is uniform
5. **LLM-friendly**: Consistent structure for generation/parsing

### Consequences

| Enables | Constrains |
|---------|------------|
| Single IR parser/evaluator | Cannot optimize specific operations via node kind |
| Uniform trace format | All operations go through call dispatch |
| Easy function addition | |

### Canonical Statement

> **All operations are `{kind: 'call', fn: '...', args: [...]}`. No specialized nodes.**

---

## FDR-MEL-041: Dollar Prefix Reservation

### Decision

**The `$` prefix is RESERVED for system identifiers only.**

- User-defined identifiers (state, computed, action, parameter names) CANNOT start with `$`
- `$` prefix tokens are ALWAYS parsed as system identifiers, not general identifiers

### Context (CRITICAL)

v0.2.3 grammar had:
```ebnf
IdentifierStart = Letter | "_" | "$"
```

This allowed `$item` to be parsed as either:
- A general `Identifier` (resolving to state path `$item`)
- A `SystemIdent` (the iteration variable)

Since `Identifier` appeared before `SystemIdent` in `PrimaryExpr`, implementations could diverge.

### Grammar Fix (v0.2.4)

```ebnf
(* v0.2.4: $ removed from IdentifierStart *)
IdentifierStart = Letter | "_"
IdentifierChar  = IdentifierStart | Digit

Identifier      = IdentifierStart { IdentifierChar }

(* System identifiers are a separate production *)
SystemIdent     = "$" Identifier { "." Identifier }

(* Special iteration variables *)
IterationVar    = "$item" | "$acc"
```

### Reserved `$` Prefixes

| Prefix | Meaning | Example |
|--------|---------|---------|
| `$system` | Host-provided values | `$system.uuid`, `$system.time.now` |
| `$meta` | Intent metadata | `$meta.intentId`, `$meta.actor` |
| `$input` | Intent input fields | `$input.taskId` |
| `$item` | Current iteration element | `$item.name` |
| `$acc` | Iteration accumulator | `$acc` |

### Compile-Time Enforcement

```mel
// ❌ COMPILE ERROR: Identifier cannot start with $
state { $myVar: string = "" }

// ❌ COMPILE ERROR: Identifier cannot start with $
action $doSomething() { }

// ❌ COMPILE ERROR: Identifier cannot start with $
computed $total = 0

// ✅ ALLOWED: $ in middle/end (though discouraged)
state { my$var: string = "" }  // Valid but discouraged
```

### Why Reserve $?

1. **Unambiguous parsing**: `$item` is always the iteration variable
2. **Visual distinction**: System values are immediately recognizable
3. **Future-proof**: New system namespaces can be added without conflict
4. **LLM safety**: No confusion between user and system identifiers

### Consequences

| Enables | Constrains |
|---------|------------|
| Unambiguous `$item`/`$acc` | Users cannot use `$` prefix |
| Clear system namespace | Migration needed for existing `$` identifiers |
| Simpler lexer | |

### Canonical Statement

> **`$` prefix is reserved for system identifiers. User identifiers cannot start with `$`.**

---

## FDR-MEL-042: Primitive-Only Equality

### Decision

**`eq()` and `neq()` are restricted to primitive types only.**

Using `eq`/`neq` on Array, Object, or Record is a **compile-time error**.

### Context (CRITICAL)

v0.2.3 defined `eq(a, b)` as `typeof(a) == typeof(b) AND a === b`.

But what does `===` mean for:
- `eq([1,2], [1,2])` — Reference equality? Deep equality?
- `eq({a:1}, {a:1})` — Same object instance? Same structure?

JavaScript's `===` is reference equality for objects, which:
- Is **non-deterministic** across hosts (object identity varies)
- Is **always false** for literals (`{a:1} === {a:1}` is false)
- Violates MEL's "same input → same output" principle

### Normative Rule (v0.2.4)

```
eq(a, b) and neq(a, b) are ONLY valid when:
  typeof(a) ∈ { null, boolean, number, string }
  typeof(b) ∈ { null, boolean, number, string }

Using eq/neq on Array, Object, or Record is a COMPILE ERROR.
```

### Type Checking

```mel
// ✅ ALLOWED: Primitive comparisons
eq(count, 0)              // number == number
eq(status, "active")      // string == string
eq(isEnabled, true)       // boolean == boolean
eq(marker, null)          // null check
neq(name, "")             // string != string

// ❌ COMPILE ERROR: Non-primitive comparisons
eq(tasks, {})             // Error: Cannot compare Record
eq(items, [])             // Error: Cannot compare Array
neq(user, { name: "A" })  // Error: Cannot compare Object
```

### How to Compare Collections?

For collection comparisons, use explicit patterns:

```mel
// Check if array is empty
when eq(len(items), 0) { ... }

// Check if record has specific key
when isNotNull(at(tasks, id)) { ... }

// Check if arrays have same length
when eq(len(a), len(b)) { ... }

// For deep equality, use effect
effect deep.equals({
  left: arrayA,
  right: arrayB,
  into: areEqual
})
```

### Why Primitive-Only?

1. **Determinism**: Primitive comparison is always deterministic
2. **No reference semantics**: MEL has no object identity concept
3. **Clarity**: Deep equality is expensive and should be explicit
4. **Type safety**: Compiler catches likely bugs early

### Consequences

| Enables | Constrains |
|---------|------------|
| Deterministic comparison | Cannot directly compare collections |
| Compile-time error for bugs | Must use len/at for collection checks |
| No reference semantics | Deep equality requires explicit effect |

### Canonical Statement

> **`eq`/`neq` work on primitives only. Collection comparison is a compile error.**

---

## FDR-MEL-043: Deterministic System Values

### Decision

**System values (`$system.uuid`, `$system.time.now`) are deterministic and traceable.**

The Host provides these values, and they are recorded in the Trace for replay.

### Context (CRITICAL)

v0.2.3 defined stability scopes but not **generation rules**:
- `$system.uuid`: "fresh per access"
- `$system.time.now`: "stable per compute()"

But if `uuid` comes from a random generator, then:
- `compute(snapshot, intent, context)` called twice produces different results
- Replay/audit is impossible
- "Same input → same output" (Axiom A2) is violated

### Deterministic Generation Model (v0.2.4)

```
$system.uuid:
  Generated as: UUIDv5(namespace, intentId + accessPath + accessIndex)
  
  Where:
  - namespace: Fixed UUID namespace for MEL (defined by implementation)
  - intentId: Current $meta.intentId
  - accessPath: JSON path to the code location accessing $system.uuid
  - accessIndex: 0-indexed counter of uuid accesses within this compute()
  
  Properties:
  - Same intent + same code location + same index → same UUID
  - Different access locations → different UUIDs
  - Deterministic and reproducible

$system.time.now:
  Provided by Host in ComputeContext
  Recorded in Trace for replay
  
  Properties:
  - Same value for entire compute() call
  - Replay uses recorded value, not current time
```

### Trace Recording

Every compute() call records system value accesses:

```typescript
type ComputeTrace = {
  intentId: string;
  snapshotHash: string;
  systemValues: {
    time: number;           // $system.time.now value used
    uuids: string[];        // All $system.uuid values generated (in order)
  };
  // ... other trace data
};
```

### Replay Semantics

```
On replay:
1. Load ComputeTrace for the intent
2. Provide trace.systemValues.time as $system.time.now
3. Return trace.systemValues.uuids[i] for i-th uuid access
4. compute() produces identical output
```

### Implementation Pattern

```mel
// Each uuid access gets a deterministic value
action addTask(title: string) {
  once(step1) when isNull(pendingId) {
    patch step1 = $meta.intentId
    // uuid[0] for this intent+location
    patch pendingId = $system.uuid
  }
  
  once(step2) when isNotNull(pendingId) {
    patch step2 = $meta.intentId
    patch tasks[pendingId] = {
      id: pendingId,  // Reuses captured value, not new uuid
      title: title,
      // uuid[1] for this intent+location (if we called $system.uuid here)
      createdAt: $system.time.now
    }
    patch pendingId = null
  }
}
```

### Why Deterministic?

1. **Replay**: Audit and debug by replaying exact computation
2. **Testing**: Unit tests produce consistent results
3. **Manifesto alignment**: Core is pure, Host provides deterministic inputs
4. **No hidden state**: All inputs are explicit and traceable

### Consequences

| Enables | Constrains |
|---------|------------|
| Exact replay | UUIDs are not cryptographically random |
| Deterministic testing | Host must track access order |
| Audit trail | Slightly more complex Host implementation |

### Canonical Statement

> **System values are deterministic. UUIDs use UUIDv5 with intent context. Time is Host-provided and traced.**

---

## FDR-MEL-044: Once Marker Enforcement

### Decision

**`once(marker)` blocks MUST contain `patch marker = $meta.intentId` at the top level.**

This is enforced at compile time.

### Context

v0.2.3 stated that once body "MUST contain" the marker patch, but didn't specify:
- Where in the body?
- Can it be inside a nested guard?
- What if it's conditionally executed?

Without enforcement, once() can re-execute indefinitely:

```mel
// ❌ BUG: Marker never gets patched!
once(step1) {
  // Forgot to patch marker
  effect api.fetch({ url: "/data", into: result })
}
// → Re-executes on every compute() call!
```

### Compile-Time Rules (v0.2.4)

```
ONCE MARKER ENFORCEMENT:

1. once(marker) { body } MUST have as its FIRST statement:
   patch marker = $meta.intentId

2. once(marker) when cond { body } MUST have as its FIRST statement:
   patch marker = $meta.intentId

3. The marker path in patch MUST exactly match the marker in once()

4. Violation is a COMPILE ERROR
```

### Valid Patterns

```mel
// ✅ VALID: Marker patch is first statement
once(step1) {
  patch step1 = $meta.intentId      // First!
  effect api.fetch({ ... })
}

// ✅ VALID: With additional condition
once(step1) when isNotNull(data) {
  patch step1 = $meta.intentId      // First!
  effect array.map({ ... })
}

// ✅ VALID: Multiple statements after marker
once(step1) {
  patch step1 = $meta.intentId      // First!
  patch loading = true
  effect api.fetch({ ... })
}
```

### Invalid Patterns

```mel
// ❌ COMPILE ERROR: No marker patch
once(step1) {
  effect api.fetch({ ... })
}
// Error: once(step1) must have 'patch step1 = $meta.intentId' as first statement

// ❌ COMPILE ERROR: Marker patch not first
once(step1) {
  patch loading = true              // Wrong! Not marker patch
  patch step1 = $meta.intentId      // Too late
  effect api.fetch({ ... })
}
// Error: First statement in once(step1) must be 'patch step1 = $meta.intentId'

// ❌ COMPILE ERROR: Wrong marker
once(step1) {
  patch step2 = $meta.intentId      // Wrong marker!
  effect api.fetch({ ... })
}
// Error: Expected 'patch step1 = $meta.intentId', found 'patch step2 = ...'

// ❌ COMPILE ERROR: Marker inside nested guard
once(step1) {
  when someCondition {
    patch step1 = $meta.intentId    // Conditionally executed!
  }
  effect api.fetch({ ... })
}
// Error: Marker patch must be unconditional first statement
```

### Why Enforce?

1. **Safety**: Impossible to forget marker patch
2. **Predictability**: once() always behaves correctly
3. **LLM guidance**: Clear pattern for code generation
4. **No silent bugs**: Infinite re-execution is compile error

### Intent Semantics Clarification

```
once() provides PER-INTENT (per-attempt) idempotency:

- Same intentId + re-entry → once() skips (marker == intentId)
- New intentId (new attempt) → once() runs again (marker != intentId)

This is BY DESIGN for the Host compute loop.

For "once ever" semantics (across all intents), use:
  when isNull(marker) { ... }
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Guaranteed idempotency | Slightly more verbose syntax |
| No silent infinite loops | Marker must be explicit |
| Clear compile errors | Cannot use alternative patterns |

### Canonical Statement

> **`once(marker)` requires `patch marker = $meta.intentId` as its first statement. Compiler enforces this.**

---

# Part VII: Document Consistency (v0.2.5)

The following decisions resolve document inconsistencies discovered during v0.2.4 review. These ensure the specification is self-consistent and implementable without ambiguity.

---

## FDR-MEL-045: Dollar Complete Prohibition

### Decision

**The `$` character is COMPLETELY PROHIBITED in user identifiers.**

Not just as a prefix, but anywhere in the identifier.

### Context (v0.2.4 Inconsistency)

v0.2.4 had conflicting rules:
- Grammar: `IdentifierStart = Letter | "_"` and `IdentifierPart = IdentifierStart | Digit`
- Example: `state { my$var: string = "" }  // Valid but discouraged`

The grammar forbids `$` entirely, but the example says it's allowed in the middle.

### Normative Rule (v0.2.5)

```ebnf
(* v0.2.5: $ is COMPLETELY PROHIBITED in identifiers *)
IdentifierStart = Letter | "_"
IdentifierPart  = IdentifierStart | Digit

(* $ can ONLY appear in SystemIdent *)
SystemIdent     = "$" Identifier { "." Identifier }
```

**Compile-Time Enforcement:**

```mel
// ❌ COMPILE ERROR: $ anywhere in identifier
state { $myVar: string = "" }    // Error: $ at start
state { my$var: string = "" }    // Error: $ in middle
state { myVar$: string = "" }    // Error: $ at end
action do$Something() { }        // Error: $ in identifier

// ✅ ALLOWED: $ only in system identifiers
$system.uuid
$meta.intentId
$item.name
```

### Why Complete Prohibition?

1. **Grammar consistency**: IdentifierPart doesn't include `$`
2. **Visual clarity**: `$` ALWAYS means "system"
3. **No edge cases**: Lexer has simple rule
4. **AI-Native**: Single pattern, no exceptions

### Canonical Statement

> **`$` is completely prohibited in user identifiers. It can only appear in system identifiers.**

---

## FDR-MEL-046: Evaluation Order Specification

### Decision

**Evaluation order is LEFT-TO-RIGHT, DEPTH-FIRST, and affects `$system.uuid` generation.**

### Context (v0.2.4 Gap)

v0.2.4 defined `$system.uuid = UUIDv5(namespace, intentId + accessPath + accessIndex)` but:
- "accessPath" was vague ("code location")
- "accessIndex" depends on evaluation order, which wasn't specified

Different evaluation orders would produce different UUIDs, breaking determinism.

### Normative Rules (v0.2.5)

#### 1. AccessPath Definition

```
accessPath := Canonical IR JSON Pointer to the $system.uuid node

Example IR:
{
  "actions": [{
    "name": "addTask",
    "body": [{
      "kind": "when",
      "body": [{
        "kind": "patch",
        "value": { "kind": "sys", "path": ["system", "uuid"] }  // ← HERE
      }]
    }]
  }]
}

accessPath = "/actions/0/body/0/body/0/value"
```

**NOT source location** (line/column). Source formatting changes must not affect UUIDs.

#### 2. Evaluation Order

```
EVALUATION ORDER (Normative):

1. Function arguments: LEFT-TO-RIGHT
   add(f(), g())  →  f() evaluated first, then g()

2. Array elements: LEFT-TO-RIGHT
   [f(), g(), h()]  →  f(), g(), h() in order

3. Object fields: KEY-SORTED (lexicographic), then LEFT-TO-RIGHT
   { b: f(), a: g() }  →  g() first (key "a"), then f() (key "b")

4. Operators: Operands LEFT-TO-RIGHT after precedence
   a + b * c  →  a, then b, then c (after parsing to add(a, mul(b, c)))

5. Effect arguments: DECLARED ORDER
   effect api.fetch({ url: f(), into: result })  →  f() evaluated
```

#### 3. AccessIndex Definition

```
accessIndex := 0-based counter of $system.uuid accesses
               within the SAME accessPath during ONE compute() call

Since each $system.uuid access has a unique IR path,
accessIndex is almost always 0.

accessIndex > 0 only if the SAME IR node is evaluated multiple times
(e.g., inside array.map where the expression is reused).
```

### Complete UUID Formula

```
$system.uuid = UUIDv5(
  namespace: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" (standard DNS namespace),
  name: intentId + "|" + accessPath + "|" + accessIndex
)

Example:
  intentId = "intent-abc123"
  accessPath = "/actions/0/body/0/body/0/value"
  accessIndex = 0
  
  name = "intent-abc123|/actions/0/body/0/body/0/value|0"
  uuid = UUIDv5(namespace, name)
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Exact replay | Evaluation order is now semantically meaningful |
| Deterministic UUIDs | Cannot reorder arguments for optimization |
| Implementation convergence | Must track accessIndex per path |

### Canonical Statement

> **Evaluation is left-to-right, depth-first. Object fields are key-sorted first. AccessPath is IR JSON Pointer.**

---

## FDR-MEL-047: Effect Write Target Normalization

### Decision

**Effect write targets (`into`, `pass`, `fail`) are ALWAYS top-level Path parameters.**

No nested objects in write positions.

### Context (v0.2.4 Inconsistency)

v0.2.4 stated "write targets are Path" but `array.partition` used:

```mel
effect array.partition({
  source: users,
  where: gt($item.lastLoginAt, thirtyDaysAgo),
  into: { pass: activeUsers, fail: inactiveUsers }  // ← Object, not Path!
})
```

This violates "single pattern" and complicates type checking.

### Normative Signature (v0.2.5)

**`array.partition` uses top-level `pass` and `fail` parameters:**

```mel
effect array.partition({
  source: <Array<T>>,
  where: <Expression using $item → boolean>,
  pass: <Path>,    // Elements where condition is true
  fail: <Path>     // Elements where condition is false
})
```

**Example:**
```mel
effect array.partition({
  source: users,
  where: gt($item.lastLoginAt, thirtyDaysAgo),
  pass: activeUsers,
  fail: inactiveUsers
})
```

### Effect Parameter Type Rules

```
EFFECT PARAMETER TYPES (Normative):

Read parameters (input):
  - source: Path | ExprNode (collection to process)
  - where/select/by/accumulate: ExprNode (expression using $item/$acc)
  - initial: ExprNode (starting value)

Write parameters (output):
  - into: Path (single output destination)
  - pass: Path (partition true branch)
  - fail: Path (partition false branch)

ALL write parameters are Path. NEVER ExprNode or Object.
```

### Why Top-Level Write Targets?

1. **Type consistency**: Write target is always `Path`
2. **Single pattern**: No special cases for partition
3. **Clear IR**: Effect arguments are uniform
4. **Static analysis**: Write targets are statically known

### Canonical Statement

> **Effect write targets are always top-level Path parameters. `partition` uses `pass` and `fail`, not `into: { pass, fail }`.**

---

## FDR-MEL-048: Index Access IR Normalization

### Decision

**Index access `x[y]` is ALWAYS `{kind: 'call', fn: 'at', args: [x, y]}` in IR.**

Property access `x.y` is `{kind: 'get', path: [...]}`.

### Context (v0.2.4 Ambiguity)

v0.2.4 had two possible IR representations for `x[y]`:
1. `{kind: 'get', path: [{kind: 'index', expr: y}]}`
2. `{kind: 'call', fn: 'at', args: [x, y]}`

Both appeared in different sections, violating "one IR representation" principle.

### Normative Rule (v0.2.5)

```
ACCESS SYNTAX TO IR:

Property access (static):
  x.y     →  { kind: 'get', path: [{ kind: 'prop', name: 'x' }, { kind: 'prop', name: 'y' }] }
  $item.x →  { kind: 'get', base: { kind: 'var', name: 'item' }, path: [{ kind: 'prop', name: 'x' }] }

Index access (dynamic):
  x[y]    →  { kind: 'call', fn: 'at', args: [<x>, <y>] }
  x[0]    →  { kind: 'call', fn: 'at', args: [<x>, { kind: 'lit', value: 0 }] }
```

**PathSegment type is simplified:**

```typescript
// v0.2.5: PathSegment is prop-only
type PathSegment = { kind: 'prop'; name: string };

// Dynamic indexing is handled by at() call, not PathSegment
type PathNode = PathSegment[];
```

### Why at() for Index Access?

1. **Uniform call pattern**: Index access is function call like everything else
2. **Simpler PathNode**: No `{kind: 'index'}` segment needed
3. **Clear semantics**: `at()` is overloaded for Array and Record
4. **LLM-friendly**: One pattern for dynamic access

### Complete Access Examples

```mel
// Source
tasks.active[id].title

// IR (v0.2.5)
{
  kind: 'get',
  base: {
    kind: 'call',
    fn: 'at',
    args: [
      { kind: 'get', path: [{ kind: 'prop', name: 'tasks' }, { kind: 'prop', name: 'active' }] },
      { kind: 'get', path: [{ kind: 'prop', name: 'id' }] }
    ]
  },
  path: [{ kind: 'prop', name: 'title' }]
}
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Single IR pattern | Cannot optimize static index separately |
| Simpler PathNode type | Index access is always a call |
| Clear at() semantics | |

### Canonical Statement

> **Index access `x[y]` is always `call(at, [x, y])`. Property access `x.y` is `get(path)`. PathSegment is prop-only.**

---

# Summary: The MEL Identity

These design decisions collectively define what MEL IS:

```
MEL IS:
  ✓ A purpose-built language for Manifesto domain definitions
  ✓ AI-Native: optimized for LLM parsing and generation
  ✓ Pure by grammar: impurity cannot be expressed
  ✓ Consistent: one canonical form for each meaning
  ✓ Minimal: smallest grammar that serves the purpose
  ✓ Explicit: no magic, no implicit behavior, no coercion
  ✓ Function-oriented: function(args) is the canonical form
  ✓ Host-Contract-aligned: guards ensure re-entry safety
  ✓ Snapshot-only: all information flows through Snapshot
  ✓ Per-intent idempotent: once() is safe across intents (v0.2.2)
  ✓ Deterministic: same input → same output on any host (v0.2.2)
  ✓ Type-complete: Record and Array have distinct operations (v0.2.2)
  ✓ Fully specified: complete IR, equality rules, scope rules (v0.2.3)
  ✓ Implementation-convergent: single IR, reserved $, primitive eq (v0.2.4)
  ✓ Document-consistent: no contradictions between rules and examples (v0.2.5)

MEL IS NOT:
  ✗ A subset of JavaScript
  ✗ A human-ergonomics-first language
  ✗ A general-purpose programming language
  ✗ A language with multiple syntax styles
  ✗ A language that grows features over time
  ✗ A language with escape hatches
  ✗ A language with implicit type coercion
  ✗ A language where Host interprets execution order
  ✗ A language with template literals (v0.2.2)
  ✗ A language with ambiguous IR mapping (v0.2.3)
  ✗ A language with multiple IR representations (v0.2.4)
  ✗ A language with $ in user identifiers (v0.2.5)
```

### The MEL Design Equation (v0.2.5)

```
MEL = (JS Expression Syntax)
    + (Explicit Keywords)
    + (Function-Only Canonical Form)
    + (Explicit Effects with $item)
    + (Guard-Mandatory Mutations)
    + (Boolean-Only Conditions)
    + (Per-Intent Idempotency)
    + (Deterministic Semantics)
    + (Complete IR Specification)
    + (Strict Equality Rules)
    + (Explicit Scope Resolution)
    + (Call-Only IR)
    + (Reserved $ Prefix)
    + (Primitive-Only Equality)
    + (Deterministic System Values)
    + (Specified Evaluation Order)
    + (Normalized Effect Signatures)
    + (Index-as-Call IR)
    - (Methods, Loops, Functions, Mutation)
    - (Truthy/Falsy Coercion)
    - (Implicit Side Effects)
    - (Template Literals)
    - (Ambiguous Semantics)
    - (Specialized IR Nodes)
    - (Non-deterministic Values)
    - ($ in User Identifiers)
    × (AI-Native Design Filter)
    × (Host Contract Alignment)
```

### The One-Sentence Summary

> **MEL is the language an LLM would design for itself: consistent, explicit, minimal, pure, deterministic, fully specified, implementation-convergent, document-consistent, and Host-Contract-aligned.**

---

## Appendix: Decision Dependency Graph

```
FDR-MEL-001 (Why Not SWC)
    │
    └─► FDR-MEL-002 (80% Compatibility)
            │
            ├─► FDR-MEL-003 (Explicit Keywords)
            │       │
            │       ├─► FDR-MEL-004 (when)
            │       ├─► FDR-MEL-005 (patch)
            │       │       │
            │       │       └─► FDR-MEL-022 (Three Patch Ops) ← v0.2.1
            │       │
            │       └─► FDR-MEL-006 (computed)
            │
            └─► FDR-MEL-009 (Forbidden by Grammar)
                    │
                    └─► FDR-MEL-030 (No Template Literals) ← v0.2.2

FDR-MEL-012 (AI-Native) ←────────────── v0.2
    │
    ├─► FDR-MEL-013 (Function-Only)
    │       │
    │       ├─► FDR-MEL-014 (Array Access)
    │       │
    │       └─► FDR-MEL-024 (Canonical Form) ← v0.2.1
    │
    ├─► FDR-MEL-015 ($item Predicate)
    │       │
    │       ├─► FDR-MEL-018 (No Nested Effects)
    │       │       │
    │       │       └─► FDR-MEL-019 (flatMap, groupBy)
    │       │               │
    │       │               └─► FDR-MEL-028 (Record Effects) ← v0.2.2
    │       │
    │       └─► FDR-MEL-031 (Iteration Variable IR) ← v0.2.2
    │
    ├─► FDR-MEL-016 (once() Sugar)
    │       │
    │       ├─► FDR-MEL-021 (Explicit Marker Patch) ← v0.2.1
    │       │
    │       └─► FDR-MEL-027 (Per-Intent Idempotency) ← v0.2.2 CRITICAL
    │
    └─► FDR-MEL-017 (Minimal Grammar)

FDR-MEL-007 (Effect as Statement)
    │
    ├─► Enhanced by FDR-MEL-015 ($item)
    │
    ├─► Reinforced by FDR-MEL-018 (No Nested Effects)
    │
    ├─► FDR-MEL-020 (Guard-Mandatory Effects) ← v0.2.1 CRITICAL
    │
    ├─► FDR-MEL-023 (Path for Write Targets) ← v0.2.1
    │       │
    │       └─► FDR-MEL-032 (Dynamic Path Segments) ← v0.2.2
    │
    └─► FDR-MEL-033 (Effect Result Contract) ← v0.2.2

FDR-MEL-008 (No typeof)
    │
    └─► FDR-MEL-010 (Type System)
            │
            ├─► FDR-MEL-025 (Boolean-Only Conditions) ← v0.2.1
            │
            └─► FDR-MEL-026 (Array-Only len()) ← v0.2.1

FDR-MEL-011 ($ Prefix)
    │
    └─► Extended by FDR-MEL-015 ($item, $acc)

═══════════════════════════════════════════════════════════════
                    HOST CONTRACT ALIGNMENT (v0.2.1)
═══════════════════════════════════════════════════════════════

Manifesto Host Contract
    │
    ├─► FDR-MEL-020 (Guard-Mandatory Effects)
    │       "Every mutation is guarded"
    │
    ├─► FDR-MEL-021 (Explicit Marker Patch)
    │       "No implicit side effects"
    │
    └─► FDR-MEL-026 (Array-Only len)
            "No hidden O(n) in computed"

═══════════════════════════════════════════════════════════════
                    SEMANTIC CLOSURE (v0.2.2)
═══════════════════════════════════════════════════════════════

Per-Intent Idempotency
    │
    └─► FDR-MEL-027 (once = per-intent, not once-ever)
            "once(marker) compares against $meta.intentId"
            │
            └─► FDR-MEL-034 (Equality Semantics) ← v0.2.3 CRITICAL
                    "neq(a,b) := not(eq(a,b)) — fixes null vs string"

Determinism & Type Completeness
    │
    ├─► FDR-MEL-028 (Record Effects)
    │       "record.* for Record, array.* for Array"
    │
    ├─► FDR-MEL-029 (Deterministic Semantics)
    │       "Same input, same output, every host"
    │       │
    │       └─► FDR-MEL-038 (Sort Determinism) ← v0.2.3
    │               "Stable sort, null last, NaN handling"
    │
    └─► FDR-MEL-030 (No Template Literals)
            "One way to build strings: concat()"

IR Completeness
    │
    ├─► FDR-MEL-031 (Iteration Variable IR)
    │       "$item/$acc are var nodes, not paths"
    │
    ├─► FDR-MEL-032 (Dynamic Path Segments)
    │       "Path segments can be computed"
    │
    ├─► FDR-MEL-033 (Effect Result Contract)
    │       "Results via set, errors are values"
    │
    └─► FDR-MEL-039 (Complete IR Specification) ← v0.2.3
            "Every construct has one IR representation"

═══════════════════════════════════════════════════════════════
                SPECIFICATION COMPLETENESS (v0.2.3)
═══════════════════════════════════════════════════════════════

Equality & Comparison
    │
    └─► FDR-MEL-034 (Equality Semantics) ← CRITICAL
            "neq := not(eq), different types → not equal"

Index Access
    │
    └─► FDR-MEL-035 (Universal Index Access)
            "at() works on both Array and Record"
            "x[y] always desugars to at(x, y)"

Scope & Resolution
    │
    └─► FDR-MEL-036 (Scope Resolution Order)
            "Params > Computed > State > System"
            "Computed/State name collision = error"

System Values
    │
    └─► FDR-MEL-037 (System Value Stability)
            "$system.uuid: fresh per access"
            "$system.time.now: stable per compute()"
            "$meta.*: stable per intent"

Determinism
    │
    └─► FDR-MEL-038 (Sort Determinism)
            "Stable, null last, mixed types = error"

IR
    │
    └─► FDR-MEL-039 (Complete IR Specification)
            "Full node types, canonicalization rules"
            │
            └─► FDR-MEL-040 (Call-Only IR) ← v0.2.4 CRITICAL
                    "All operations are {kind:'call'}"

═══════════════════════════════════════════════════════════════
                IMPLEMENTATION CONVERGENCE (v0.2.4)
═══════════════════════════════════════════════════════════════

IR Unification
    │
    └─► FDR-MEL-040 (Call-Only IR) ← CRITICAL
            "No specialized nodes, all operations are call"
            "Single pattern for implementation/trace/test"

Lexical Safety
    │
    └─► FDR-MEL-041 (Dollar Prefix Reservation) ← CRITICAL
            "$ is reserved for system identifiers"
            "User identifiers cannot start with $"
            "Unambiguous $item/$acc parsing"

Type Safety
    │
    └─► FDR-MEL-042 (Primitive-Only Equality) ← CRITICAL
            "eq/neq work on primitives only"
            "Array/Object/Record comparison = compile error"

Determinism
    │
    └─► FDR-MEL-043 (Deterministic System Values) ← CRITICAL
            "$system.uuid = UUIDv5(intent + location)"
            "$system.time.now = Host-provided, traced"
            "Enables exact replay"

Idempotency Safety
    │
    └─► FDR-MEL-044 (Once Marker Enforcement)
            "patch marker = $meta.intentId must be first"
            "Compile-time enforcement"

═══════════════════════════════════════════════════════════════
                DOCUMENT CONSISTENCY (v0.2.5)
═══════════════════════════════════════════════════════════════

Lexical Consistency
    │
    └─► FDR-MEL-045 (Dollar Complete Prohibition) ← CRITICAL
            "$ is completely prohibited in identifiers"
            "Not just at start, but anywhere"
            "Grammar and examples now match"

Evaluation Determinism
    │
    └─► FDR-MEL-046 (Evaluation Order Specification) ← CRITICAL
            "Left-to-right, depth-first"
            "Object fields: key-sorted first"
            "accessPath = IR JSON Pointer"

Effect Consistency
    │
    └─► FDR-MEL-047 (Effect Write Target Normalization)
            "partition uses pass/fail top-level"
            "All write targets are Path"
            "No object in write position"

IR Consistency
    │
    └─► FDR-MEL-048 (Index Access IR Normalization)
            "x[y] is always call(at)"
            "PathSegment is prop-only"
            "No {kind:'index'} segment"
```

---

## Appendix: v0.1 to v0.2.3 Changes

### v0.1 → v0.2 Changes

| Aspect | v0.1 | v0.2 | FDR |
|--------|------|------|-----|
| Design priority | Human ergonomics | AI-Native | FDR-MEL-012 |
| Method syntax | Whitelisted methods | No methods | FDR-MEL-013 |
| Array length | `items.length` | `len(items)` | FDR-MEL-014 |
| Effect predicate | `{ field: value }` | `$item.field == value` | FDR-MEL-015 |
| Re-entry helper | None | `once(marker)` sugar | FDR-MEL-016 |
| Grammar philosophy | Grow as needed | Minimal surface | FDR-MEL-017 |
| Nested effects | Undefined | Forbidden | FDR-MEL-018 |
| Composition effects | None | `flatMap`, `groupBy`, etc. | FDR-MEL-019 |

### v0.2 → v0.2.1 Changes (Host Contract Alignment)

| Aspect | v0.2 | v0.2.1 | FDR |
|--------|------|--------|-----|
| Top-level patch/effect | Allowed | **Forbidden** (must be in guard) | FDR-MEL-020 |
| `once()` auto-patch | Implicit | **Explicit** (user writes patch) | FDR-MEL-021 |
| Patch operations | `set` only | `set`, `unset`, `merge` | FDR-MEL-022 |
| Effect `into:` | Expression | **Path** (write target) | FDR-MEL-023 |
| Expression form | Operators + functions | **Canonical** (functions only in IR) | FDR-MEL-024 |
| Guard conditions | Truthy/falsy | **Boolean only** | FDR-MEL-025 |
| `len()` types | Any | **Array only** | FDR-MEL-026 |

### Breaking Changes from v0.2

```mel
// ❌ No longer valid in v0.2.1

// Top-level patch/effect (now requires guard)
action bad() {
  patch count = 0              // Error: patch must be inside when/once
  effect api.fetch(...)        // Error: effect must be inside when/once
}

// Implicit once() marker patch
once(marker) {
  effect api.submit(...)       // Error: marker never gets set!
}
// Must now write:
once(marker) {
  patch marker = $system.time.now  // Explicit!
  effect api.submit(...)
}

// Truthy/falsy conditions
when items { ... }             // Error: Array is not boolean
when user.name { ... }         // Error: string is not boolean
// Must now write:
when gt(len(items), 0) { ... }
when isNotNull(user.name) { ... }

// len() on Record
computed count = len(tasks)    // Error: tasks is Record, not Array
// Must now use effect:
once(loaded) {
  effect object.keys({ source: tasks, into: taskIds })
}
computed count = len(taskIds)
```

### New Capabilities in v0.2.1

```mel
// ✅ Three patch operations
patch user.name = "Alice"                    // set
patch tasks[id] unset                        // remove key
patch user.preferences merge { theme: "d" } // shallow merge

// ✅ Canonical form (both parse, IR is same)
computed x = a + b      // Parses, normalizes to add(a,b)
computed y = add(a, b)  // Same IR as above

// ✅ Explicit re-entry patterns
action submit() {
  once(submittedAt) {
    patch submittedAt = $system.time.now  // Explicit marker
    effect api.submit({ data: form, into: result })
  }
}

// ✅ Pipeline with guards
action processData() {
  once(step1) {
    patch step1 = $system.time.now
    effect array.map({ source: items, select: $item.x, into: mapped })
  }
  
  once(step2) when isNotNull(mapped) {
    patch step2 = $system.time.now
    effect array.filter({ source: mapped, where: gt($item, 0), into: filtered })
  }
}
```

### v0.2.1 → v0.2.2 Changes (Semantic Closure)

| Aspect | v0.2.1 | v0.2.2 | FDR |
|--------|--------|--------|-----|
| `once()` semantics | Once ever (`isNull`) | **Per-intent** (`neq(marker, $meta.intentId)`) | FDR-MEL-027 |
| `once()` argument | Identifier | **Path** | FDR-MEL-027 |
| Record operations | Use array.* (type mismatch) | **record.* effects** | FDR-MEL-028 |
| Key ordering | Undefined | **Lexicographic** | FDR-MEL-029 |
| Sort stability | Undefined | **Stable** | FDR-MEL-029 |
| Template literals | Allowed | **Removed** | FDR-MEL-030 |
| `$item/$acc` IR | Implicit | **Explicit var node** | FDR-MEL-031 |
| Dynamic paths | Implicit | **Explicit IR segment** | FDR-MEL-032 |
| Effect errors | Undefined | **$error structure** | FDR-MEL-033 |
| `if()` function | `if(c,t,e)` | **`cond(c,t,e)`** | (reserved word conflict) |

### Breaking Changes from v0.2.1

```mel
// ❌ No longer valid in v0.2.2

// once() with timestamp marker (now uses intentId)
once(marker) {
  patch marker = $system.time.now  // Wrong! Use $meta.intentId
  effect api.submit(...)
}
// Must now write:
once(marker) {
  patch marker = $meta.intentId    // Per-intent idempotency
  effect api.submit(...)
}

// Template literals (removed)
computed greeting = `Hello, ${name}!`  // Error: template literals not supported
// Must now write:
computed greeting = concat("Hello, ", name, "!")

// array.* on Record (type error)
effect array.filter({ source: tasks, ... })  // Error if tasks is Record
// Must now write:
effect record.filter({ source: tasks, ... })

// if() function (reserved word)
computed result = if(cond, a, b)   // Error: 'if' is reserved
// Must now write:
computed result = cond(condition, a, b)
```

### New Capabilities in v0.2.2

```mel
// ✅ Per-intent idempotency (action can run again with new intent)
action increment() {
  once(lastIntent) {
    patch lastIntent = $meta.intentId
    patch count = add(count, 1)
  }
}
// Intent A: runs → lastIntent = "intent-A"
// Intent A re-entry: skips (lastIntent == "intent-A")  
// Intent B: runs again! (lastIntent != "intent-B")

// ✅ Record-specific effects
effect record.filter({
  source: tasks,  // Record<string, Task>
  where: eq($item.completed, false),
  into: activeTasks
})

effect record.entries({
  source: orders,
  into: orderEntries  // Array<{ key: string, value: Order }>
})

effect record.fromEntries({
  source: filteredEntries,
  into: newRecord
})

// ✅ Deterministic key ordering
effect record.keys({ source: items, into: keys })
// keys is ALWAYS lexicographically sorted

// ✅ toString() for explicit conversion
computed message = concat("Count: ", toString(count))

// ✅ cond() instead of if()
computed status = cond(isActive, "active", "inactive")

// ✅ $meta.intentId system value
once(lastRun) {
  patch lastRun = $meta.intentId  // Stable ID for this intent execution
  ...
}
```

### v0.2.2 → v0.2.3 Changes (Specification Completeness)

| Aspect | v0.2.2 | v0.2.3 | FDR |
|--------|--------|--------|-----|
| `eq/neq` semantics | Implicit | **Explicit: neq := not(eq)** | FDR-MEL-034 |
| `at()` scope | Array only | **Array + Record** | FDR-MEL-035 |
| `[]` canonicalization | Ambiguous for Record | **Always at()** | FDR-MEL-035 |
| Scope resolution | Implicit | **Params > Computed > State > System** | FDR-MEL-036 |
| Name collision | Undefined | **Computed/State collision = error** | FDR-MEL-036 |
| `$system.uuid` | Undefined stability | **Fresh per access** | FDR-MEL-037 |
| `$system.time.now` | Undefined stability | **Stable per compute()** | FDR-MEL-037 |
| `array.sort` null | Undefined | **null sorts last** | FDR-MEL-038 |
| `array.sort` NaN | Undefined | **NaN after numbers, before null** | FDR-MEL-038 |
| `array.sort` mixed types | Undefined | **Compile/runtime error** | FDR-MEL-038 |
| IR specification | Partial | **Complete with all node types** | FDR-MEL-039 |

### Critical Fix in v0.2.3

```mel
// v0.2.2 had a logic bug: what is neq(null, "intent-A")?
// If the rule was "different types → both eq AND neq are false"
// then once() with null marker would NEVER fire!

// v0.2.3 fixes this:
// eq(null, "intent-A") = false (different types → not equal)
// neq(null, "intent-A") = not(false) = true ✓

state { marker: string | null = null }

action test() {
  once(marker) {  // → when neq(marker, $meta.intentId)
    patch marker = $meta.intentId
    // ...
  }
}
// First call: marker = null
// neq(null, "intent-A") = not(eq(null, "intent-A")) = not(false) = true
// → once() fires correctly! ✓
```

### New Capabilities in v0.2.3

```mel
// ✅ Universal index access: [] works on both Array and Record
tasks[id]           // Record access → at(tasks, id)
items[0]            // Array access → at(items, 0)

// ✅ Computed can reference other computed
computed total = len(items)
computed hasItems = gt(total, 0)  // total → computed.total ✓

// ✅ Clear system value stability
$system.uuid        // Fresh on EACH access (use intermediate state to reuse)
$system.time.now    // Same value within one compute() call
$meta.intentId      // Same value for entire intent execution

// ✅ Deterministic sort with null/NaN handling
[3, null, 1, NaN, 2] sorted → [1, 2, 3, NaN, null]

// ✅ Complete IR specification
// Every MEL construct maps to exactly one IR representation
// See FDR-MEL-039 for full specification
```

### v0.2.3 → v0.2.4 Changes (Implementation Convergence)

| Aspect | v0.2.3 | v0.2.4 | FDR |
|--------|--------|--------|-----|
| IR node types | Mixed (specialized + call) | **Call-only** | FDR-MEL-040 |
| `$` prefix | Allowed in identifiers | **Reserved for system** | FDR-MEL-041 |
| `eq`/`neq` scope | All types | **Primitives only** | FDR-MEL-042 |
| `$system.uuid` | "Fresh per access" | **Deterministic (UUIDv5)** | FDR-MEL-043 |
| `$system.time.now` | "Stable per compute" | **Host-provided, traced** | FDR-MEL-043 |
| `once()` marker patch | "MUST contain" | **MUST be first statement** | FDR-MEL-044 |
| `once(marker)` syntax | Ambiguous (Identifier/Path) | **Path only** | FDR-MEL-044 |

### Critical Fixes in v0.2.4

```mel
// CRITICAL-1: IR is now unified to call-only
// Before (v0.2.3): Mixed representations
{ kind: 'neq', left: A, right: B }  // Specialized node
{ kind: 'call', fn: 'at', args: [...] }  // Call node

// After (v0.2.4): Call-only
{ kind: 'call', fn: 'neq', args: [A, B] }  // Unified!
{ kind: 'call', fn: 'at', args: [...] }    // Same pattern
```

```mel
// CRITICAL-2: $ prefix is now reserved
// Before (v0.2.3): Ambiguous parsing
state { $myVar: string = "" }  // Allowed but confusing

// After (v0.2.4): Compile error
state { $myVar: string = "" }  // ERROR: $ reserved for system
```

```mel
// CRITICAL-3: eq/neq restricted to primitives
// Before (v0.2.3): Undefined behavior
eq([1,2], [1,2])  // Reference or deep equality?

// After (v0.2.4): Compile error
eq([1,2], [1,2])  // ERROR: Cannot compare Array
eq(count, 0)      // OK: Primitive comparison
```

```mel
// CRITICAL-4: System values are deterministic
// Before (v0.2.3): Random/non-deterministic
$system.uuid  // Truly random → replay impossible

// After (v0.2.4): Deterministic
$system.uuid  // UUIDv5(namespace, intentId + location + index)
              // Same intent + location → same UUID
              // Recorded in trace for replay
```

```mel
// CRITICAL-5: once() marker enforcement
// Before (v0.2.3): "MUST contain" was vague
once(step1) {
  effect api.fetch(...)  // Forgot marker patch!
  patch step1 = $meta.intentId  // Not enforced position
}

// After (v0.2.4): Compile-time enforcement
once(step1) {
  patch step1 = $meta.intentId  // MUST be first!
  effect api.fetch(...)
}
```

### New Capabilities in v0.2.4

```mel
// ✅ Single IR representation for all operations
// Simplifies implementation, testing, and tracing
a + b       → { kind: 'call', fn: 'add', args: [A, B] }
eq(a, b)    → { kind: 'call', fn: 'eq', args: [A, B] }
at(arr, i)  → { kind: 'call', fn: 'at', args: [ARR, I] }

// ✅ Unambiguous $item/$acc parsing
// $ prefix is reserved, always parsed as system identifier
$item.name  // Always iteration variable, never user state

// ✅ Deterministic UUIDs for testing and replay
action addTask(title: string) {
  once(step1) {
    patch step1 = $meta.intentId
    patch pendingId = $system.uuid  // Deterministic!
  }
}
// Replay with same intentId produces same UUID

// ✅ Compile-time safety for once() blocks
once(step1) {
  patch step1 = $meta.intentId  // Enforced!
  // ... rest of body
}
```

### v0.2.4 → v0.2.5 Changes (Document Consistency)

| Aspect | v0.2.4 | v0.2.5 | FDR |
|--------|--------|--------|-----|
| `$` in identifiers | Prohibited at start, allowed in middle (example) | **Completely prohibited** | FDR-MEL-045 |
| Evaluation order | Unspecified | **Left-to-right, key-sorted for objects** | FDR-MEL-046 |
| accessPath for UUID | "Code location" (vague) | **IR JSON Pointer** | FDR-MEL-046 |
| `partition` signature | `into: { pass, fail }` (object) | **`pass:` and `fail:` top-level** | FDR-MEL-047 |
| Index access IR | Mixed (get with index / at call) | **Always `call(at)`, no index PathSegment** | FDR-MEL-048 |
| PathSegment type | `prop \| index` | **`prop` only** | FDR-MEL-048 |
| IR tables | Some `{kind:'coalesce'}` remnants | **All `{kind:'call'}` unified** | FDR-MEL-040 (fixed) |

### Critical Fixes in v0.2.5

```mel
// C1: $ is completely prohibited in identifiers
// Before (v0.2.4): Inconsistent - grammar forbids, example allows
state { my$var: string = "" }  // Example said "allowed"

// After (v0.2.5): Consistently prohibited
state { my$var: string = "" }  // ERROR: $ prohibited in identifiers
```

```
// C2: Evaluation order is now specified
// Before (v0.2.4): Unspecified - implementations could differ

// After (v0.2.5): Left-to-right, depth-first
add(f(), g())  →  f() first, then g()
{ b: f(), a: g() }  →  g() first (key "a"), then f() (key "b")
```

```
// C3: accessPath is IR JSON Pointer
// Before (v0.2.4): "code location" was vague

// After (v0.2.5): Precisely defined
accessPath = "/actions/0/body/0/body/0/value"  // IR JSON Pointer
$system.uuid = UUIDv5(namespace, intentId + "|" + accessPath + "|" + accessIndex)
```

```mel
// C4: partition uses top-level pass/fail
// Before (v0.2.4): Violated "write target is Path" rule
effect array.partition({
  source: users,
  where: gt($item.age, 18),
  into: { pass: adults, fail: minors }  // Object in write position!
})

// After (v0.2.5): Consistent with other effects
effect array.partition({
  source: users,
  where: gt($item.age, 18),
  pass: adults,   // Top-level Path
  fail: minors    // Top-level Path
})
```

---

## Appendix: v0.1 to v0.2.5 Changes

(See individual version change sections above.)

## Appendix: Key Quotes

> "MEL is not a restricted JavaScript. MEL is a purpose-built language where impurity cannot be expressed."
> — FDR-MEL-001

> "MEL is designed for machines that think, not just humans that type."
> — FDR-MEL-012

> "One pattern to rule them all: `function(args)`. No methods, no exceptions, no confusion."
> — FDR-MEL-013

> "`$item` is the current element. `$acc` is the accumulator. No magic scope, explicit bindings."
> — FDR-MEL-015

> "Effects are statements, not expressions. You cannot nest what was never meant to be composed."
> — FDR-MEL-018

> "Instead of nesting effects, compose them. `flatMap` and `groupBy` make composition natural."
> — FDR-MEL-019

> "Every mutation is guarded. No patch or effect escapes the re-entry safety net."
> — FDR-MEL-020

> "Three operations, three meanings: `set` replaces, `unset` removes, `merge` combines."
> — FDR-MEL-022

> "One meaning, one form. Operators are sugar; functions are truth."
> — FDR-MEL-024

> "Conditions are boolean. No guessing, no coercion, no surprises."
> — FDR-MEL-025

> "`len()` is O(1). Record size is O(n). O(n) belongs in effects, not computed."
> — FDR-MEL-026

> "`once(marker)` means 'once per intent'. For 'once ever', use `when isNull(...)`."
> — FDR-MEL-027

> "`array.*` for arrays, `record.*` for records. Choose the right tool for your collection type."
> — FDR-MEL-028

> "Same input, same output, every time, on every host."
> — FDR-MEL-029

> "One way to build strings: `concat()`. No magic interpolation."
> — FDR-MEL-030

> "`$item` and `$acc` exist only within effects. Snapshot is the only way to pass data between steps."
> — FDR-MEL-031

> "Effect results arrive via `set`. Errors are values with `$error: true`."
> — FDR-MEL-033

> "`neq(a, b)` is ALWAYS `not(eq(a, b))`. Different types are never equal."
> — FDR-MEL-034

> "`x[y]` is always `at(x, y)`. Works on both Array and Record."
> — FDR-MEL-035

> "Params > Computed > State > System. Name collision is an error."
> — FDR-MEL-036

> "`$system.uuid` is fresh per access. `$system.time.now` is stable per compute()."
> — FDR-MEL-037

> "Sort is stable. null sorts last. Mixed types are errors."
> — FDR-MEL-038

> "Every MEL construct has exactly one IR representation."
> — FDR-MEL-039

> "All operations are `{kind: 'call', fn: '...', args: [...]}`. No specialized nodes."
> — FDR-MEL-040

> "`$` prefix is reserved for system identifiers. User identifiers cannot start with `$`."
> — FDR-MEL-041

> "`eq`/`neq` work on primitives only. Collection comparison is a compile error."
> — FDR-MEL-042

> "System values are deterministic. UUIDs use UUIDv5 with intent context. Time is Host-provided and traced."
> — FDR-MEL-043

> "`once(marker)` requires `patch marker = $meta.intentId` as its first statement. Compiler enforces this."
> — FDR-MEL-044

> "`$` is completely prohibited in user identifiers. It can only appear in system identifiers."
> — FDR-MEL-045

> "Evaluation is left-to-right, depth-first. Object fields are key-sorted first. AccessPath is IR JSON Pointer."
> — FDR-MEL-046

> "Effect write targets are always top-level Path parameters. `partition` uses `pass` and `fail`, not `into: { pass, fail }`."
> — FDR-MEL-047

> "Index access `x[y]` is always `call(at, [x, y])`. Property access `x.y` is `get(path)`. PathSegment is prop-only."
> — FDR-MEL-048

> "MEL is the language an LLM would design for itself: consistent, explicit, minimal, pure, deterministic, fully specified, implementation-convergent, document-consistent, and Host-Contract-aligned."
> — Summary

---

*End of MEL FDR Document v0.2.5*
