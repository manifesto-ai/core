# MEL Compiler Specification v0.7.0

> **Version:** 0.7.0  
> **Status:** Draft  
> **Authors:** Manifesto Team  
> **License:** MIT  
> **Changelog:**
> - v0.2: AI-Native design principles (FDR-MEL-012 ~ 019)
> - v0.2.1: Host Contract alignment (FDR-MEL-020 ~ 026)
> - v0.2.2: Semantic closure (FDR-MEL-027 ~ 033)
> - v0.2.3: Specification completeness (FDR-MEL-034 ~ 039)
> - v0.2.4: Implementation convergence (FDR-MEL-040 ~ 044)
> - v0.2.5: Document consistency (FDR-MEL-045 ~ 048)
> - v0.3.0: System values as effects (FDR-MEL-049 ~ 054)
> - v0.3.1: Implementation safety (FDR-MEL-055 ~ 057)
> - v0.3.3: Core alignment, primitive aggregation, named types (FDR-MEL-058 ~ 063)
> - v0.4.0: Translator Lowering, Expression Evaluation, Host Integration
> - v0.5.0: $mel Namespace, onceIntent Syntax, Guard Compilation
> - v0.6.0: ADR-009 alignment — `IRPatchPath`, `IRPathSegment`, `resolveIRPath()` TOTAL semantics
> - v0.7.0: Statement composition (`flow`/`include` — ADR-013a), Entity collection primitives (`findById`/`existsById`/`updateById`/`removeById` — ADR-013b)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Design Principles](#2-design-principles)
3. [Lexical Grammar](#3-lexical-grammar)
4. [Syntactic Grammar](#4-syntactic-grammar)
5. [Type System](#5-type-system)
6. [Semantic Rules](#6-semantic-rules)
7. [IR Mapping](#7-ir-mapping)
8. [Forbidden Constructs](#8-forbidden-constructs)
9. [Standard Library](#9-standard-library)
10. [System Values (v0.3.0)](#10-system-values-v030)
11. [Compiler Lowering (v0.3.1)](#11-compiler-lowering-v031)
12. [Architecture Review (v0.3.1)](#12-architecture-review-v031)
13. [Flow Control (v0.3.3)](#13-flow-control-v032)
14. [Examples](#14-examples)
15. [Migration Guide](#15-migration-guide)
16. [Architecture Decisions](#16-architecture-decisions)
17. [Translator Lowering](#17-translator-lowering)
18. [Expression Evaluation](#18-expression-evaluation)
19. [MEL Text Ingest](#19-mel-text-ingest)
20. [Host Integration Requirements (Superseded)](#20-host-integration-requirements-superseded)
21. [Compiler Rules for $mel Namespace (v0.5.0)](#21-compiler-rules-for-mel-namespace-v050)

---

## 1. Introduction

### 1.1 What is MEL?

MEL (Manifesto Expression Language) is a **pure, total, deterministic expression language** designed for Manifesto domain definitions. It is an **AI-Native language** — optimized for LLM parsing and generation while remaining readable by humans.

### 1.2 Design Goals

| Goal | Description |
|------|-------------|
| **AI-Native** | Optimized for LLM parsing, generation, and validation |
| **Consistency** | One way to express each concept |
| **Purity by Design** | Impure constructs do not exist in grammar |
| **Minimal Surface** | Smallest grammar that serves the purpose |
| **1:1 IR Mapping** | Every MEL construct maps to exactly one ExprNode |

### 1.3 What MEL is NOT

MEL is NOT:

- A general-purpose programming language
- A Turing-complete language
- A subset or superset of JavaScript
- A language with multiple syntax styles
- A human-ergonomics-first language

### 1.4 Relationship to Manifesto

```
┌─────────────────────────────────────────────────────────────┐
│                  Developer / LLM Agent                      │
│                                                             │
│  domain TaskManager {                                       │
│    state { ... }                                            │
│    computed isComplete = eq(tasks.done, tasks.total)        │
│    action complete(id: string) { ... }                      │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ MEL Compiler
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Manifesto Schema (JSON)                    │
│                                                             │
│  { "computed": { "isComplete": { "kind": "eq", ... } } }    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Core Runtime
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Execution by Host                        │
└─────────────────────────────────────────────────────────────┘
```

### 1.5 Version Changes from v0.1

| Change | v0.1 | v0.2 | v0.2.1 | Rationale |
|--------|------|------|--------|-----------|
| Design priority | Human ergonomics | AI-Native | AI-Native | FDR-MEL-012 |
| Method syntax | Allowed for strings | Removed | Removed | FDR-MEL-013 |
| Array length | `items.length` | `len(items)` | `len(items)` | FDR-MEL-014 |
| Effect predicate | `{ field: value }` | `$item.field == value` | `$item.field == value` | FDR-MEL-015 |
| Re-entry helper | None | `once(marker)` | `once(marker)` (no auto-patch) | FDR-MEL-016, 021 |
| Grammar philosophy | Grow as needed | Minimal surface | Minimal surface | FDR-MEL-017 |
| Nested effects | Undefined | Forbidden | Forbidden | FDR-MEL-018 |
| Composition effects | None | `flatMap`, `groupBy` | `flatMap`, `groupBy` | FDR-MEL-019 |
| Top-level patch/effect | — | Allowed | **Forbidden** | FDR-MEL-020 |
| Patch operations | — | `set` only | `set`, `unset`, `merge` | FDR-MEL-022 |
| Effect `into:` type | — | Expression | **Path** | FDR-MEL-023 |
| Expression form | — | Mixed | **Canonical** | FDR-MEL-024 |
| Condition type | — | Truthy/falsy | **Boolean only** | FDR-MEL-025 |
| `len()` types | — | Any | **Array only** | FDR-MEL-026 |

---

## 2. Design Principles

### 2.1 The MEL Axioms

```
A1. Every expression terminates.
A2. Every expression is deterministic.
A3. Every expression is total (no exceptions).
A4. No expression can observe or cause side effects.
A5. All iteration is declarative, not imperative.
A6. One pattern per concept (AI-Native).
A7. All mutations are guarded (Host Contract). [v0.2.1]
A8. All information flows through Snapshot. [v0.2.1]
A9. Same input produces same output on any host. [v0.2.2]
A10. once() provides per-intent idempotency. [v0.2.2]
A11. neq(a,b) := not(eq(a,b)). [v0.2.3]
A12. Every construct has exactly one IR representation. [v0.2.3]
A13. All operations use {kind:'call'} IR nodes. [v0.2.4]
A14. $ prefix is reserved for system identifiers. [v0.2.4]
A15. eq/neq are primitive-only. [v0.2.4]
A16. System values are deterministic and traceable. [v0.2.4] (Superseded by A20)
A17. $ is completely prohibited in user identifiers. [v0.2.5]
A18. Evaluation order is left-to-right, depth-first. [v0.2.5]
A19. Index access is always call(at), never get with index segment. [v0.2.5]
A20. System values are IO operations executed as Effects. [v0.3.0]
A21. There is exactly one system effect: system.get. [v0.3.0]
A22. Compiler inserts system effects automatically. [v0.3.0]
A23. Same $system.<key> in same action = same value (per intent). [v0.3.0]
A24. System value replay uses Snapshot only, no separate trace. [v0.3.0]
A25. $system.* is forbidden in computed and state init. [v0.3.0]
A26. Compiler-generated system value state lives under $mel.sys.* (platform namespace). [v0.3.1, unified v0.7.0]
A27. Readiness check uses eq(intent_marker, $meta.intentId), not isNotNull(value). [v0.3.1]
A28. available conditions must be pure, state/computed-only expressions (no Effects, no $system.*, no $meta.*, no $input.*, no action parameters). [v0.3.3, clarified v0.7.0]
A29. fail is a FlowNode — errors are Core decisions, not Host effects. [v0.3.3]
A30. stop means "early exit" only — "waiting/pending" semantics forbidden. [v0.3.3]
A31. call FlowNode exists in Core but is not exposed in MEL. [v0.3.3]
A32. Primitive aggregation (sum, min, max) expresses facts; user-defined accumulation is forbidden. len() is a general builtin, not an aggregation. [v0.3.3, clarified v0.7.0]
A33. Complex types must be named; anonymous object types in state are forbidden. [v0.3.3]
A34. Compiler is the single boundary between MEL IR and Core IR. [v0.4.0]
A35. Expression evaluation is total; invalid operations return null, never throw. [v0.4.0]
```

### 2.2 AI-Native Design (v0.2)

MEL prioritizes **LLM parseability and generability** over human ergonomics:

| Aspect | Human-First | AI-Native (MEL v0.2+) |
|--------|-------------|----------------------|
| Operations | Method chaining | Function calls only |
| Patterns | Multiple ways | One canonical way |
| Syntax sugar | Liberal | Minimal |
| Grammar size | Grows with features | Intentionally minimal |

### 2.3 Host Contract Alignment (v0.2.1)

MEL respects Manifesto's **Host Contract**:

```
┌─────────────────────────────────────────────────────────────────┐
│  Manifesto Host Loop                                            │
│                                                                 │
│  1. Host calls compute() with current Snapshot + intentId       │
│  2. Core returns requirements (effects) based on Snapshot       │
│  3. Host executes requirements, applies patches to Snapshot     │
│  4. Host calls compute() again (same intentId)                  │
│  5. Repeat until no requirements                                │
│                                                                 │
│  INVARIANT: All information flows through Snapshot only         │
│  INVARIANT: intentId is stable within one intent execution      │
└─────────────────────────────────────────────────────────────────┘
```

**Guard-mandatory effects** ensure each step is enabled by Snapshot state, not by Host interpretation of effect ordering.

### 2.4 Semantic Closure (v0.2.2)

MEL v0.2.2 closes semantic gaps for **deterministic, implementable** specification:

| Aspect | Requirement |
|--------|-------------|
| Key ordering | Lexicographic (Unicode code point) |
| Sort stability | Stable sort, preserve source order for ties |
| `once()` semantics | Per-intent idempotency via `$meta.intentId` |
| Effect errors | Standard `$error` structure |
| IR completeness | Explicit nodes for `$item`, dynamic paths |

### 2.5 Specification Completeness (v0.2.3)

MEL v0.2.3 completes the specification with **no ambiguity**:

| Aspect | Requirement | FDR |
|--------|-------------|-----|
| Equality | `neq(a,b) := not(eq(a,b))` | FDR-MEL-034 |
| Index access | `at()` works on Array AND Record | FDR-MEL-035 |
| Scope | Params > Computed > State > System (within permitted contexts — §6.1) | FDR-MEL-036 |
| System values | Defined stability per value | FDR-MEL-037 |
| Sort | null last, NaN handling, stable | FDR-MEL-038 |
| IR | Complete node specification | FDR-MEL-039 |

### 2.6 Implementation Convergence (v0.2.4-v0.2.5)

MEL v0.2.4-v0.2.5 ensures **all implementations converge to identical behavior**:

| Aspect | Requirement | FDR |
|--------|-------------|-----|
| IR nodes | All operations use `{kind:'call'}` | FDR-MEL-040 |
| $ prefix | Reserved for system identifiers only | FDR-MEL-041 |
| eq/neq | Primitive types only (compile error for collections) | FDR-MEL-042 |
| once() marker | `patch marker = $meta.intentId` must be first statement | FDR-MEL-044 |
| $ in identifiers | Completely prohibited (not just prefix) | FDR-MEL-045 |
| Evaluation order | Left-to-right, key-sorted for objects | FDR-MEL-046 |
| Index access | Always `call(at)`, no index PathSegment | FDR-MEL-048 |

### 2.7 System Value Semantics (v0.3.0)

MEL v0.3.0 treats **system values as IO operations**:

| Aspect | Requirement | FDR |
|--------|-------------|-----|
| `$system.*` nature | IO operations, not expressions | FDR-MEL-049 |
| System effect | Single effect: `system.get` | FDR-MEL-050 |
| Lowering | Compiler inserts effects automatically | FDR-MEL-051 |
| Deduplication | Same key in same action = same value | FDR-MEL-052 |
| Replay | Snapshot-based, no separate trace | FDR-MEL-053 |
| Scope | Forbidden in computed and state init | FDR-MEL-054 |

```
v0.3.0 CORE PRINCIPLE:

  System values are IO.
  IO is Effect.
  Effects are executed by Host.
  Results enter Core via Snapshot.
  Core remains pure.
```

### 2.8 The Single Pattern Principle

Every concept has exactly one syntactic representation:

```mel
// ✅ One way to call a function
functionName(arg1, arg2)

// ✅ One way to access a property
object.property

// ✅ One way to access an index
array[index]  // Sugar for at(array, index)

// ✅ One way to build strings
concat("Hello, ", name, "!")

// ❌ No alternative syntaxes
object.method()     // Not allowed
object->property    // Not allowed
array.length        // Not allowed (use len(array))
`Hello, ${name}!`   // Not allowed (use concat())  [v0.2.2]
```

### 2.8 The "No Escape Hatch" Principle

> **If it's not in the grammar, you cannot write it.**

Unlike linters that can be disabled, MEL's parser physically cannot parse forbidden constructs.

---

## 3. Lexical Grammar

### 3.1 Source Text

MEL source text MUST be valid UTF-8.

### 3.2 Comments

```ebnf
Comment         = LineComment | BlockComment
LineComment     = "//" { SourceCharacter } LineTerminator
BlockComment    = "/*" { SourceCharacter } "*/"
```

**Example:**
```mel
// This is a line comment
computed x = 5 /* inline comment */ + 3
```

### 3.3 Tokens

#### 3.3.1 Keywords

```
domain    state     computed  action    effect
when      once      patch     unset     merge
type      available fail      stop
true      false     null
as        import    from      export
```

**v0.2.2 additions:** `once`, `unset`, `merge` promoted to keywords.
**v0.3.3 additions:** `type`, `available`, `fail`, `stop` promoted to keywords.

**Reserved for future use:**
```
async     await     yield     class     extends
interface enum      namespace module
```

**Reserved (JS — never to be implemented):**
```
function  var       let       const     if        else
for       while     do        switch    case      break
continue  return    throw     try       catch     finally
new       delete    typeof    instanceof void     with
debugger  this      super     arguments eval
```

#### 3.3.2 Operators and Punctuation

```
Arithmetic:     +   -   *   /   %
Comparison:     ==  !=  <   <=  >   >=
Logical:        &&  ||  !
Nullish:        ??
Ternary:        ?   :
Assignment:     =
Grouping:       (   )   {   }   [   ]
Separators:     ,   ;   .
```

**Explicitly NOT supported:**
```
Method call:    .methodName()   // Use function(arg) instead
Optional chain: ?.              // Use explicit null checks
Increment:      ++  --          // Use add(x, 1)
Compound:       +=  -=  *=      // Use patch x = add(x, y)
Template:       `${...}`        // Use concat() [v0.2.2]
```

#### 3.3.3 Literals

```ebnf
Literal         = NullLiteral | BooleanLiteral | NumericLiteral | StringLiteral

NullLiteral     = "null"
BooleanLiteral  = "true" | "false"

NumericLiteral  = DecimalLiteral | HexLiteral
DecimalLiteral  = DecimalDigits ("." DecimalDigits)? ExponentPart?
HexLiteral      = "0x" HexDigits

(* v0.2.2: Template literals removed. Use concat() instead. *)
StringLiteral   = SingleStringLiteral | DoubleStringLiteral
SingleStringLiteral = "'" { SingleStringChar | EscapeSequence } "'"
DoubleStringLiteral = '"' { DoubleStringChar | EscapeSequence } '"'
```

**Examples:**
```mel
null
true
false
42
3.14159
0xFF
"hello"
'world'
`Hello, ${user.name}!`
```

#### 3.3.4 Identifiers

```ebnf
(* v0.2.4: $ REMOVED from IdentifierStart — reserved for system *)
Identifier      = IdentifierStart { IdentifierPart }
IdentifierStart = Letter | "_"
IdentifierPart  = IdentifierStart | Digit
```

**Valid:** `foo`, `_bar`, `camelCase`, `PascalCase`, `snake_case`  
**Invalid:** `123abc`, `-name`, `class` (keyword), `$myVar` ($ reserved), `my$var` ($ prohibited)

**v0.2.5 RESTRICTION:** `$` is COMPLETELY PROHIBITED in user identifiers — not just at the start, but anywhere. See FDR-MEL-045.

```mel
// ❌ COMPILE ERROR: $ anywhere in identifier
state { $myVar: string = "" }    // Error: $ at start
state { my$var: string = "" }    // Error: $ in middle
state { myVar$: string = "" }    // Error: $ at end
action $doSomething() { }        // Error: $ in identifier
computed $total = 0              // Error: $ in identifier
```

#### 3.3.5 System Identifiers (v0.3.0)

System-provided values are prefixed with `$` and form a **reserved namespace**:

```ebnf
SystemIdent     = "$" Identifier { "." Identifier }
IterationVar    = "$item"
```

**v0.3.3 Note:** `$acc` is removed. `reduce` is forbidden. See FDR-MEL-062.

**Lexer rule:** `$...` patterns are ALWAYS tokenized as `SystemIdent`, never as `Identifier`.

##### System Value Categories

| Category | Syntax | Nature | Allowed In |
|----------|--------|--------|------------|
| **System IO** | `$system.*` | IO (effect) | Action body only |
| **Meta** | `$meta.*` | Pure (from Intent) | Action body only (requires Intent context) |
| **Input** | `$input.*` | Pure (from Intent) | Action body only (requires Intent context) |
| **Iteration** | `$item` | Pure (from Effect context) | Effect sub-expressions |

> **v0.7.0 clarification:** `$meta.*` and `$input.*` require an Intent context. They are forbidden in `computed` (no Intent), `state` initializers (no Intent), and `available` (evaluated pre-Intent by UI/Agent). "Action body" means guards, patch values, and effect args.

##### $system.* — IO Values (v0.3.0 CRITICAL)

**`$system.*` values are IO operations.** They are syntactic sugar that the compiler lowers to `system.get` effects. See §10 for details.

```mel
$system.time.now      // IO: Current timestamp → lowered to effect
$system.uuid          // IO: Fresh UUID → lowered to effect
$system.random        // IO: Random number → lowered to effect
$system.env.NODE_ID   // IO: Environment variable → lowered to effect
```

**Scope Restrictions (Normative):**

| Context | `$system.*` Allowed? | Rationale |
|---------|---------------------|-----------|
| Action body | ✅ Yes | Effects are allowed in actions |
| Computed expression | ❌ **COMPILE ERROR** | Computed must be pure |
| State initializer | ❌ **COMPILE ERROR** | Initializers must be deterministic |
| Effect sub-expression | ✅ Yes | Part of action body |

```mel
// ❌ COMPILE ERROR: $system.* in computed
computed now = $system.time.now  // E001: System values cannot be used in computed

// ❌ COMPILE ERROR: $system.* in state initializer  
state { id: string = $system.uuid }  // E002: System values cannot be used in state init

// ✅ ALLOWED: $system.* in action body
action create() {
  once(creating) {
    patch creating = $meta.intentId
    patch id = $system.uuid  // OK
  }
}
```

##### $meta.* — Intent Metadata (Pure)

```mel
$meta.intentId        // Current intent identifier (stable per intent)
$meta.actor           // Current actor (stable per intent)
$meta.authority       // Current authority (stable per intent)
```

These are pure values from the Intent context, available in action body only (guards, patch values, effect args). Not allowed in computed, state initializers, or `available` conditions — no Intent exists in those contexts.

##### $input.* — Intent Input (Pure)

```mel
$input.fieldName      // Intent input parameter value
```

These are pure values from the Intent input, available in action body only. Same restriction as `$meta.*`.

##### $item — Iteration Variable (Pure)

```mel
$item                 // Current element in effect iteration
```

**v0.3.3:** `$acc` is removed. `reduce` is forbidden. See FDR-MEL-062.

`$item` is only valid within effect sub-expressions (where, select).

---

## 4. Syntactic Grammar

### 4.1 Program Structure

```ebnf
Program         = { ImportDecl } DomainDecl

ImportDecl      = "import" "{" IdentifierList "}" "from" StringLiteral

DomainDecl      = "domain" Identifier "{" { DomainMember } "}"

DomainMember    = TypeDecl
                | StateDecl
                | ComputedDecl
                | ActionDecl
                | FlowDecl                  (* v0.7.0: ADR-013a *)
```

### 4.2 Type Declaration (v0.3.3)

```ebnf
TypeDecl        = "type" Identifier "=" TypeExpr
```

Type declarations define named types that can be referenced in state and computed fields.

**Example:**
```mel
type Location = { lat: number, lng: number }

type Shipment = {
  id: string
  status: "pending" | "shipped" | "delivered"
  location: Location | null
}

type Tracking = {
  shipments: Record<string, Shipment>
  signals: Json | null
}
```

**Within type declarations**, nested object types are allowed:
```mel
// ✅ Nested object in type declaration is OK
type Shipment = {
  id: string
  location: { lat: number, lng: number } | null  // inline OK here
}
```

### 4.3 State Declaration

```ebnf
StateDecl       = "state" "{" { StateField } "}"

StateField      = Identifier ":" StateTypeRef ( "=" Expression )?

StateTypeRef    = Identifier                              (* named type reference *)
                | PrimitiveType                           (* string, number, etc. *)
                | "Record" "<" TypeExpr "," TypeExpr ">"
                | "Array" "<" TypeExpr ">"
                | StateTypeRef "|" StateTypeRef           (* union *)
                | StringLiteral                           (* literal type *)
                (* ❌ NO inline object types: "{" ... "}" *)
```

**v0.3.3 CRITICAL:** Anonymous object types are **forbidden** in state fields. Use named types instead.

```mel
// ❌ FORBIDDEN: Anonymous object type in state
state {
  user: { name: string, age: number } = { name: "", age: 0 }
}

// ✅ REQUIRED: Named type reference
type User = { name: string, age: number }
state {
  user: User = { name: "", age: 0 }
}
```

> **v0.7.0 note:** Named types used in state fields must also be FieldSpec-compatible (§5.6.2). Types containing `Record<string, T>`, `T | null`, non-trivial unions, or recursive refs cannot be used as state field types even when named.

**Example:**
```mel
state {
  count: number = 0
  items: Array<Item> = []
  status: "idle" | "loading" | "done" = "idle"
}
```

#### 4.3.1 State Initializer Evaluation (v0.7.0)

Core's `FieldSpec.default` is a **concrete value** (`unknown`), not an expression. "StateSpec MUST NOT contain any expressions or logic" (Core SPEC §5.4). The compiler MUST therefore evaluate state initializer expressions to concrete values at compile time.

**Evaluation Rules (Normative):**

| Rule ID | Level | Description |
|---------|-------|-------------|
| STATE-INIT-1 | MUST | State initializers MUST be **compile-time constant expressions**: literals, object/array literals composed of literals, or calls to pure builtin functions with constant arguments |
| STATE-INIT-2 | MUST | State initializers MUST NOT reference other state fields. Forward and backward references are both forbidden |
| STATE-INIT-3 | MUST | State initializers MUST NOT reference computed values, `$system.*`, `$meta.*`, `$input.*`, or any runtime-dependent value |
| STATE-INIT-4 | MUST | The compiler MUST evaluate each state initializer expression independently and emit a concrete JSON value for `FieldSpec.default` |
| STATE-INIT-5 | MUST | If a state field has an initializer (`= Expression`), the evaluated value is emitted as `FieldSpec.default`. The `required` flag is independent: a field MAY be both `required: true` and have a `default`. The compiler MUST set `required: false` only when the field is explicitly marked optional. If no initializer is present and the field is not optional, it is `required: true` with no default |

**Examples:**

```mel
// ✅ Constant expressions — compile to concrete values
state {
  count: number = 0                          // default: 0
  name: string = "untitled"                  // default: "untitled"
  tags: Array<string> = []                   // default: []
  config: Config = { theme: "dark", fontSize: 14 }  // default: {"theme":"dark","fontSize":14}
}

// ❌ COMPILE ERROR: References another state field
state {
  a: number = 1
  b: number = add(a, 1)     // E042: State initializer cannot reference state field 'a'
}

// ❌ COMPILE ERROR: References computed
state {
  x: number = total          // E042: State initializer cannot reference computed 'total'
}

// ❌ COMPILE ERROR: Uses runtime value
state {
  id: string = $system.uuid  // E002: System values cannot be used in state initializers
}
```

**Compile Errors:**

```
E042: State initializer references non-constant value.
      State defaults must be compile-time constants.
      Cannot reference state fields, computed values, or runtime values.
```

> **Rationale:** Each state field's default is evaluated in isolation — there is no cross-field evaluation order, no topological sort, no cycle possibility. This is intentionally simpler than computed (which does form a DAG). The initial Snapshot's `data` is deterministic: every conforming compiler produces the same concrete defaults.

### 4.4 Computed Declaration

```ebnf
ComputedDecl    = "computed" Identifier "=" Expression
```

Computed expressions MUST use only pure expressions (no Effects, no `$system.*`, no `$meta.*`, no `$input.*` — see §6.1).

**Example:**
```mel
computed total = len(items)
computed isComplete = and(eq(done, total), gt(total, 0))
computed displayName = coalesce(user.name, "Anonymous")
```

#### 4.4.1 ComputedSpec Emission (v0.7.0)

The compiler MUST emit a `ComputedFieldSpec` for each `computed` declaration, containing both `deps` and `expr` as required by Core SPEC §6.

**Dependency Extraction Rules (Normative):**

| Rule ID | Level | Description |
|---------|-------|-------------|
| COMP-DEP-1 | MUST | The compiler MUST extract `deps` by collecting all state and computed paths referenced in `expr` via `get` nodes |
| COMP-DEP-2 | MUST | `deps` MUST include the **root segment** of each referenced path. E.g., `user.name` → dep on `"user"` for state fields, `"total"` for computed |
| COMP-DEP-3 | MUST | `deps` MUST accurately reflect all paths referenced in `expr` (Core SPEC §6.4 V-001) |
| COMP-DEP-4 | MUST | Computed-to-computed references are permitted (e.g., `computed isComplete` references `computed total`). The resulting dependency graph MUST be acyclic (Core SPEC §6.4 V-002) |
| COMP-DEP-5 | MUST | Cycle detection MUST be performed on the full computed dependency graph. Cycles MUST be rejected with compile error E040 |
| COMP-DEP-6 | MUST | `deps` MUST be topologically sortable. The compiler SHOULD emit `ComputedSpec.fields` in topological order |

**Example:**

```mel
computed total = len(items)
computed isComplete = and(eq(done, total), gt(total, 0))
```

Emits:
```json
{
  "fields": {
    "total": {
      "deps": ["items"],
      "expr": { "kind": "len", "arg": { "kind": "get", "path": "items" } }
    },
    "isComplete": {
      "deps": ["done", "total"],
      "expr": { "kind": "and", "args": [
        { "kind": "eq", "left": { "kind": "get", "path": "done" }, "right": { "kind": "get", "path": "total" } },
        { "kind": "gt", "left": { "kind": "get", "path": "total" }, "right": { "kind": "lit", "value": 0 } }
      ] }
    }
  }
}
```

Note: `isComplete.deps` includes `"total"` (a computed) and `"done"` (a state field). Core evaluates `total` first because topological order requires it.

**Compile Errors:**

```
E040: Circular computed dependency.
      computed a depends on computed b, which depends on computed a.

E041: Computed references undeclared identifier.
      computed x = add(y, 1) — 'y' is not a state field or computed.
```

### 4.5 Action Declaration

```ebnf
ActionDecl      = "action" Identifier "(" ParamList? ")" AvailableClause? ActionBody

AvailableClause = "available" "when" Expression    (* v0.3.3: A28 — state/computed only *)

ParamList       = Param { "," Param }
Param           = Identifier ":" TypeExpr

(* v0.2.1: ActionBody contains ONLY guards, no top-level patch/effect *)
ActionBody      = "{" { GuardedStmt } "}"

GuardedStmt     = WhenStmt
                | OnceStmt
                | OnceIntentStmt
                | IncludeStmt               (* v0.7.0: ADR-013a *)

(* Patch and Effect are ONLY allowed inside guards *)
WhenStmt        = "when" Expression "{" { InnerStmt } "}"

(* v0.2.4: once takes Path, not Identifier *)
OnceStmt        = "once" "(" Path ")" [ "when" Expression ] "{" { InnerStmt } "}"

OnceIntentStmt  = "onceIntent" [ "when" Expression ] "{" { InnerStmt } "}"

InnerStmt       = PatchStmt
                | EffectStmt
                | WhenStmt      (* Nested guards allowed *)
                | OnceStmt
                | OnceIntentStmt
                | FailStmt      (* v0.3.3: Flow control *)
                | StopStmt      (* v0.3.3: Flow control *)
```

**Critical (v0.2.1):** All `patch` and `effect` statements MUST be inside a `when`, `once`, or `onceIntent` guard. This ensures re-entry safety and Host Contract compliance. See FDR-MEL-020.

**v0.3.3:** `FailStmt` and `StopStmt` are flow control statements defined in §13.2 and §13.3. They MUST also appear inside guards.

**Critical (v0.2.4):** `once(marker)` blocks MUST have `patch marker = $meta.intentId` as their FIRST statement. This is enforced at compile time. See FDR-MEL-044.

**Example:**
```mel
action addTask(title: string, priority: number) {
  // ✅ Correct: patch marker is FIRST statement
  once(submitting) when isNotNull(trim(title)) {
    patch submitting = $meta.intentId           // MUST be first!
    effect api.create({ title: title, priority: priority, into: result })
  }
}

// ❌ COMPILE ERROR: No marker patch
action bad1() {
  once(step1) {
    effect api.fetch(...)           // Error: Missing marker patch
  }
}

// ❌ COMPILE ERROR: Marker patch not first
action bad2() {
  once(step1) {
    patch loading = true            // Error: Not marker patch
    patch step1 = $meta.intentId    // Too late!
    effect api.fetch(...)
  }
}
```

#### 4.5.1 Action Input Lowering (v0.7.0)

Core's `ActionSpec.input` is a single `FieldSpec` (Core SPEC §9.2), not an array. The compiler MUST emit action parameters as a `FieldSpec` of type `"object"` whose `fields` correspond to the declared parameters.

**Lowering Rules (Normative):**

| Rule ID | Level | Description |
|---------|-------|-------------|
| ACTION-INPUT-1 | MUST | Action parameters MUST be lowered to `ActionSpec.input: FieldSpec` with `type: "object"` |
| ACTION-INPUT-2 | MUST | Each MEL parameter becomes a field in `input.fields`, with `required: true` |
| ACTION-INPUT-3 | MUST | If the action has no parameters, `ActionSpec.input` MUST be omitted (not an empty object) |

**Example:**

```mel
action addTask(title: string, priority: number) { ... }
```

Compiles to:
```json
{
  "addTask": {
    "input": {
      "type": "object",
      "required": true,
      "fields": {
        "title": { "type": "string", "required": true },
        "priority": { "type": "number", "required": true }
      }
    },
    "flow": { ... }
  }
}
```

Within the action body, parameters are accessed as `$input.<paramName>` after lowering (e.g., `title` → Core `get` path `"input.title"`). See §17.3.1.

### 4.6 Guard Statement (`when`)

```ebnf
WhenStmt        = "when" Expression "{" { InnerStmt } "}"
```

Guards are **re-entry safe**: they prevent re-execution when their condition is false.

**Condition must be boolean (v0.2.1):** The expression must evaluate to `boolean`. Truthy/falsy coercion is not allowed. See FDR-MEL-025.

**Example:**
```mel
action submit() {
  when eq(submittedAt, null) {
    patch submittedAt = $system.time.now
    effect api.submit({ data: formData, into: result })
  }
}

// ❌ FORBIDDEN: Non-boolean condition
when items { ... }           // Error: Array is not boolean
when user.name { ... }       // Error: string is not boolean

// ✅ Correct: Explicit boolean
when gt(len(items), 0) { ... }
when isNotNull(user.name) { ... }
```

### 4.7 Once Statement (Per-Intent Idempotency)

```ebnf
(* v0.2.2: once takes Path, not just Identifier *)
OnceStmt        = "once" "(" Path ")" ( "when" Expression )? "{" { InnerStmt } "}"
```

**v0.2.2 Change:** `once(marker)` provides **per-intent idempotency**. It expands to `when neq(marker, $meta.intentId)`. The body **MUST** contain `patch marker = $meta.intentId`. See FDR-MEL-027.

**Why this matters:**
- **v0.2.1 problem:** `once(marker)` expanded to `when isNull(marker)`, making actions "once ever" (permanently disabled after first use)
- **v0.2.2 solution:** Compare against `$meta.intentId` so actions can run again with new intents

```mel
// once() expansion (v0.2.2):
once(marker) { body }
→
when neq(marker, $meta.intentId) { body }

// Conditional form:
once(marker) when condition { body }
→
when and(neq(marker, $meta.intentId), condition) { body }
```

**Compiler Rule (Mandatory):**
```
once() block body MUST contain: patch <marker> = $meta.intentId
```

**Example (correct usage):**
```mel
action increment() {
  once(lastIncrementIntent) {
    patch lastIncrementIntent = $meta.intentId  // REQUIRED!
    patch count = add(count, 1)
  }
}

// Intent A: lastIncrementIntent(null) != "intent-A" → runs, sets "intent-A"
// Intent A re-entry: lastIncrementIntent("intent-A") == "intent-A" → skips
// Intent B: lastIncrementIntent("intent-A") != "intent-B" → runs again!
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

**Distinguishing "per-intent" vs "once ever":**
```mel
// Per-intent idempotency (action can repeat across intents)
action increment() {
  once(lastIntent) {
    patch lastIntent = $meta.intentId
    patch count = add(count, 1)
  }
}

// True "once ever" — use when isNull(), not once()
action submitOnce() {
  when isNull(submittedAt) {
    patch submittedAt = $system.time.now
    effect api.submit({ data: form, into: result })
  }
}
```

#### 4.7.1 OnceIntent Statement (Per-Intent Idempotency Sugar)

```ebnf
OnceIntentStmt  = "onceIntent" [ "when" Expression ] "{" { InnerStmt } "}"
```

`onceIntent` provides **per-intent idempotency** without requiring manual guard field management. It is syntactic sugar that compiles to `once()` with an auto-generated guard in the `$mel` namespace.

**Semantics:**
- The block executes **at most once per intentId**
- Guard state is stored in `$mel.guards.intent.<guardId>`, not in domain state
- No schema pollution: developers don't need to declare guard fields

**Example:**
```mel
action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}

action submit() {
  onceIntent when isValid(form) {
    effect api.submit({ data: form, into: result })
  }
}
```

**Desugaring (Conceptual):**
```mel
// Source
onceIntent { patch count = add(count, 1) }

// Desugars to
once($mel.guards.intent.<guardId>) {
  patch $mel.guards.intent.<guardId> = $meta.intentId
  patch count = add(count, 1)
}
```

Where `<guardId>` is computed as `hash(actionName + ":" + blockIndex + ":intent")`.

**Critical Rules:**
- COMPILER-MEL-1: Guard patches MUST use `merge` at `$mel.guards.intent` level (not root `$mel`)
- COMPILER-MEL-2: Desugared `once(X)` MUST perform its first guard write to the same **semantic guard path** `X`
- COMPILER-MEL-2a: Lowering MAY implement the guard write as `merge` at `$mel.guards.intent` (map-level) and treat it as semantically equivalent to writing `X`

See FDR-MEL-074 for rationale.

#### 4.7.2 `onceIntent` as Contextual Keyword

`onceIntent` is a **contextual keyword**. It is parsed as a statement keyword **only** at statement start and only when followed by `{` or `when`. In all other contexts, it is treated as a normal identifier.

**Parsing Rules:**

| Context | Token Sequence | Interpretation |
|---------|----------------|----------------|
| Statement start | `onceIntent` `{` | OnceIntentStmt |
| Statement start | `onceIntent` `when` | OnceIntentStmt |
| Elsewhere | `onceIntent` | Identifier |

**Examples:**
```mel
// ✅ Parsed as OnceIntentStmt (keyword)
onceIntent { patch x = 1 }
onceIntent when ready { patch x = 1 }

// ✅ Parsed as identifier (contextual keyword)
once(onceIntent) { patch onceIntent = $meta.intentId }
patch onceIntent = "value"
```

See FDR-MEL-077 for rationale.

#### 4.7.3 Flow Declaration (v0.7.0 — ADR-013a)

```ebnf
FlowDecl        = "flow" Identifier "(" ParamList? ")" FlowBody

FlowBody        = "{" { FlowGuardedStmt } "}"

FlowGuardedStmt = FlowWhenStmt | IncludeStmt
FlowWhenStmt    = "when" Expression "{" { FlowInnerStmt } "}"
FlowInnerStmt   = FailStmt | StopStmt | FlowWhenStmt
```

A `flow` is a **reusable guard statement sequence** — a compile-time composition unit for validation/fail/stop patterns. Flows are declared at domain block top-level and inlined at `include` sites during compilation. Core IR never contains `flow` or `include`; they are fully resolved before lowering.

> **Rationale (ADR-013a):** FDR-MEL-061 hid Core's `call` FlowNode from MEL and identified compile-time inlining as the future path. `flow` + `include` realizes this path. The composition direction follows Core `call` semantics — "continue reading and writing on the same Snapshot" (FDR-008) — but as a compiler-only form that produces no FlowNode `call` in the output IR.

**v1 Restrictions (Normative):** In v0.7.0, `flow` bodies are restricted to guard+fail/stop patterns only. The following constructs are forbidden inside `flow`:

| Construct | Allowed in flow? | Error | Rationale |
|-----------|-----------------|-------|-----------|
| `when` | ✅ | — | Primary content of a flow |
| `fail` (inside when) | ✅ | — | Core of validation |
| `stop` (inside when) | ✅ | — | Early exit reuse |
| `include` | ✅ | — | Flow-to-flow composition (acyclic) |
| `once()` | ❌ | E017 | Requires domain schema marker — conflicts with reuse unit |
| `onceIntent` | ❌ | E018 | Idempotency boundary must be owned by the action |
| `patch` | ❌ | E019 | v1 flows are guard+fail/stop only |
| `effect` | ❌ | E020 | v1 flows are guard+fail/stop only |

**Parameter Semantics — Name Substitution:**

Flow parameters are resolved via **AST-level identifier substitution** at the `include` call site. This is not C-style textual substitution; the compiler replaces each occurrence of the parameter name with the corresponding argument expression, preserving type-checkability.

| Rule ID | Level | Description |
|---------|-------|-------------|
| FLOW-PARAM-1 | MUST | Parameter names MUST NOT collide with domain top-level identifiers (state root keys, computed names, type names) |
| FLOW-PARAM-2 | MUST NOT | Nested field paths (e.g., `Task.id`) are NOT collision targets |
| FLOW-CALL-1 | MUST | `include` argument count MUST exactly match target flow parameter count |
| FLOW-CALL-2 | MUST | Each `include` argument type MUST be assignable to the corresponding parameter type |

**All flow declarations — including unused ones — are subject to type checking.** The compiler SHOULD emit a warning for unused flow declarations.

**Example:**
```mel
flow requirePresent(value: string | null, fieldName: string) {
  when isNull(value) {
    fail "REQUIRED" with concat(fieldName, " is required")
  }
}

flow requireTask(taskId: string) {
  when isNull(at(taskIndex, taskId)) {
    fail "NOT_FOUND" with concat("Task not found: ", taskId)
  }
}

action softDeleteTask(id: string) {
  include requireTask(id)
  onceIntent {
    patch tasks = updateById(tasks, id, { deletedAt: $system.time.now })
  }
}

// After expansion (compiler internal):
action softDeleteTask(id: string) {
  when isNull(at(taskIndex, id)) {        // 'taskId' → 'id'
    fail "NOT_FOUND" with concat("Task not found: ", id)
  }
  onceIntent {
    patch tasks = updateById(tasks, id, { deletedAt: $system.time.now })
  }
}
```

#### 4.7.4 Include Statement (v0.7.0 — ADR-013a)

```ebnf
IncludeStmt     = "include" Identifier "(" ArgList? ")"
```

`include` inlines a flow body at the call site during compilation. It is permitted **only in GuardedStmt position** — at the top level of an action body or a flow body.

| Position | Allowed? | Rationale |
|----------|----------|-----------|
| Action body top-level (GuardedStmt) | ✅ | Validation/fail/stop reuse |
| Flow body top-level (FlowGuardedStmt) | ✅ | Flow-to-flow composition |
| Inside a guard (InnerStmt) | ❌ (E016) | Prevents statement category mixing |
| Computed expression | ❌ | flow is not an expression |

**Compilation Pipeline:**

```
[1] Parse → AST (FlowDecl, IncludeStmt present)
[2] Flow Declaration Validation
    - All flow declarations collected and validated (including unused)
    - Parameter type, guard condition type, include target resolution
    - Include call-site signature validation (FLOW-CALL-1, FLOW-CALL-2)
    - Cycle detection across ALL declared flows
    - Forbidden construct detection (E017–E020)
[3] Flow Expansion
    - Inline flow bodies at include sites
    - Parameter name substitution
    - Expansion depth check (ceiling: 16)
    - Remove FlowDecl and IncludeStmt from AST
[4] Expanded AST (no trace of flow/include)
    → continues to Type Check → System Lowering → IR Generation
```

#### 4.7.5 `flow` and `include` as Contextual Keywords (v0.7.0)

`flow` and `include` are **contextual keywords**, following the same strategy as `onceIntent` (FDR-MEL-077). They are NOT reserved keywords.

| Keyword | Recognition position | Lookahead | Interpretation |
|---------|---------------------|-----------|----------------|
| `flow` | Domain member start | `Identifier` `(` | FlowDecl |
| `include` | GuardedStmt / FlowGuardedStmt start | `Identifier` `(` | IncludeStmt |
| Either | All other contexts | — | Identifier |

```mel
// ✅ Parsed as FlowDecl
flow requireTask(taskId: string) { /* ... */ }

// ✅ Parsed as identifier (existing code compatible)
state { flow: string = "default" }
computed flow = "value"

// ✅ Parsed as IncludeStmt
action test() { include requireTask(id) }

// ✅ Parsed as identifier (existing code compatible)
state { include: boolean = false }
when eq(include, true) { /* ... */ }
```

### 4.8 Patch Statement

```ebnf
PatchStmt       = "patch" Path PatchOp

PatchOp         = "=" Expression          (* set: replace value *)
                | "unset"                 (* unset: remove key *)
                | "merge" Expression      (* merge: shallow merge *)
```

**v0.2.1:** MEL supports three patch operations matching Manifesto Core. See FDR-MEL-022.

| Operation | Syntax | Meaning |
|-----------|--------|---------|
| **set** | `patch path = expr` | Replace value at path |
| **unset** | `patch path unset` | Remove key entirely |
| **merge** | `patch path merge expr` | Shallow merge (objects only) |

**Examples:**
```mel
// Set: Replace value
patch user.name = "Alice"
patch items[$system.uuid] = { id: $system.uuid, title: title }

// Unset: Remove key from Record
patch tasks[completedId] unset

// Merge: Shallow merge object fields
patch user.preferences merge { theme: "dark", fontSize: 14 }
patch settings merge $input.partialSettings
```

**Why three operations:**
- `set` + `null` conflates "set to null" with "delete key"
- `unset` cleanly removes Record entries without type pollution
- `merge` enables partial updates without overwriting entire objects

### 4.9 Effect Statement

```ebnf
EffectStmt      = "effect" EffectType "(" EffectArgs? ")"

EffectType      = Identifier { "." Identifier }

EffectArgs      = "{" { EffectArg } "}"
EffectArg       = Identifier ":" EffectArgValue ","?

(* v0.2.1: Write targets are Path, not Expression *)
EffectArgValue  = Expression              (* for read parameters *)
                | Path                    (* for write parameters: into, pass, fail *)
```

**v0.2.1:** Parameters that specify write destinations (`into:`, `pass:`, `fail:`) are parsed as **Path**, not Expression. See FDR-MEL-023.

Effects declare requirements that Host must fulfill.

**Example:**
```mel
// API Effects
effect api.fetch({ url: "/users", method: "GET", into: users })
effect api.post({ url: "/tasks", body: { title: title }, into: result })

// Array Effects (iteration) — uses $item
effect array.filter({
  source: tasks,
  where: eq($item.completed, false),
  into: activeTasks               // ← Path (write target)
})

effect array.map({
  source: items,
  select: {
    name: upper($item.title),
    done: $item.completed
  },
  into: transformed               // ← Path (write target)
})

// Domain-specific Effects
effect email.send({ to: user.email, template: "welcome", into: sendResult })
```

### 4.10 Expressions

#### 4.9.1 Expression Hierarchy

```ebnf
Expression      = TernaryExpr

TernaryExpr     = NullishExpr ( "?" Expression ":" Expression )?

NullishExpr     = OrExpr ( "??" OrExpr )*

OrExpr          = AndExpr ( "||" AndExpr )*

AndExpr         = EqualityExpr ( "&&" EqualityExpr )*

EqualityExpr    = CompareExpr ( ( "==" | "!=" ) CompareExpr )*

CompareExpr     = AddExpr ( ( "<" | "<=" | ">" | ">=" ) AddExpr )*

AddExpr         = MulExpr ( ( "+" | "-" ) MulExpr )*

MulExpr         = UnaryExpr ( ( "*" | "/" | "%" ) UnaryExpr )*

UnaryExpr       = ( "!" | "-" ) UnaryExpr
                | PostfixExpr

PostfixExpr     = PrimaryExpr { PostfixOp }

PostfixOp       = "." Identifier                (* Property access only *)
                | "[" Expression "]"            (* Index access *)

PrimaryExpr     = Literal
                | Identifier
                | SystemIdent
                | FunctionCall
                | "(" Expression ")"
                | ObjectLiteral
                | ArrayLiteral

FunctionCall    = Identifier "(" ArgList? ")"

SystemIdent     = "$" Identifier { "." Identifier }

ObjectLiteral   = "{" { ObjectField } "}"
ObjectField     = ( Identifier | StringLiteral ) ":" Expression ","?

ArrayLiteral    = "[" { Expression ","? } "]"

ArgList         = Expression { "," Expression }
```

#### 4.9.2 Critical: No Method Calls

MEL v0.2 does **NOT** support method call syntax:

```mel
// ❌ NOT ALLOWED — SyntaxError
user.name.trim()
items.filter(x => x.active)
str.toLowerCase()

// ✅ ALLOWED — Function calls
trim(user.name)
lower(user.name)
```

The grammar explicitly excludes method calls:

```ebnf
// PostfixOp does NOT include method calls
PostfixOp       = "." Identifier          (* Property only, no () after *)
                | "[" Expression "]"       (* Index only *)

// Function calls are separate
FunctionCall    = Identifier "(" ... ")"  (* Top-level identifier only *)
```

#### 4.9.3 Operator Precedence (Highest to Lowest)

| Precedence | Operators | Associativity |
|------------|-----------|---------------|
| 1 | `()` `[]` `.` | Left |
| 2 | `!` `-` (unary) | Right |
| 3 | `*` `/` `%` | Left |
| 4 | `+` `-` | Left |
| 5 | `<` `<=` `>` `>=` | Left |
| 6 | `==` `!=` | Left |
| 7 | `&&` | Left |
| 8 | `\|\|` | Left |
| 9 | `??` | Left |
| 10 | `? :` | Right |

### 4.11 Type Expressions

```ebnf
TypeExpr        = PrimaryType ( "|" PrimaryType )*

PrimaryType     = "string"
                | "number"
                | "boolean"
                | "null"
                | StringLiteral                        (* literal type *)
                | NumericLiteral                       (* literal type *)
                | Identifier                           (* type reference *)
                | "Record" "<" TypeExpr "," TypeExpr ">"
                | "Array" "<" TypeExpr ">"
                | "{" { TypeField } "}"               (* object type *)

TypeField       = Identifier "?"? ":" TypeExpr ","?
```

**Examples:**
```mel
string
number
boolean
null
"pending" | "active" | "done"
Record<string, Task>
Array<number>
{ name: string, age?: number }
```

---

## 5. Type System

### 5.1 Primitive Types

| Type | Values | MEL Literal |
|------|--------|-------------|
| `null` | `null` | `null` |
| `boolean` | `true`, `false` | `true`, `false` |
| `number` | IEEE 754 double | `42`, `3.14`, `0xFF` |
| `string` | UTF-8 text | `"hello"`, `'world'` |

### 5.2 Compound Types

| Type | Description | Example |
|------|-------------|---------|
| `Array<T>` | Ordered collection | `[1, 2, 3]` |
| `Record<K, V>` | Key-value map | `{ a: 1, b: 2 }` |
| `{ ... }` | Object with known fields | `{ name: "Alice", age: 30 }` |
| `T \| U` | Union type | `"a" \| "b" \| "c"` |

### 5.3 Type Coercion Rules (Normative)

MEL is **strictly typed**. Implicit coercion is NOT allowed.

| Operation | Operand Types | Result | Invalid Cases |
|-----------|--------------|--------|---------------|
| `add(a, b)` | `number`, `number` | `number` | `string + number` → Error |
| `concat(a, b)` | `string`, `string` | `string` | `string + number` → Error |
| `sub`, `mul`, `div`, `mod` | `number`, `number` | `number` | Any non-number → Error |
| `eq`, `neq` | Any, Any | `boolean` | See §5.3.1 |
| `lt`, `lte`, `gt`, `gte` | `number`, `number` | `boolean` | Non-number → Error |
| `and`, `or` | `boolean`, `boolean` | `boolean` | Non-boolean → Error |
| `not` | `boolean` | `boolean` | Non-boolean → Error |
| `coalesce` | `T \| null`, `T` | `T` | |

#### 5.3.1 Equality Semantics (v0.2.4 CRITICAL)

**v0.2.4: `eq`/`neq` are restricted to PRIMITIVE types only.**

```
PRIMITIVE TYPES: null, boolean, number, string

eq(a, b) and neq(a, b) are ONLY valid when:
  typeof(a) ∈ { null, boolean, number, string }
  typeof(b) ∈ { null, boolean, number, string }

Using eq/neq on Array, Object, or Record is a COMPILE ERROR.
```

See FDR-MEL-042 for rationale (determinism, no reference semantics).

**Normative Definition:**
```
eq(a, b) = true   IFF  typeof(a) == typeof(b) AND a === b
eq(a, b) = false  OTHERWISE

neq(a, b) := not(eq(a, b))   ALWAYS
```

**Valid (Primitive Comparisons):**
```mel
eq(count, 0)              // ✅ number == number
eq(status, "active")      // ✅ string == string
eq(isEnabled, true)       // ✅ boolean == boolean
eq(marker, null)          // ✅ null check
neq(name, "")             // ✅ string != string
```

**Invalid (Collection Comparisons):**
```mel
eq(tasks, {})             // ❌ COMPILE ERROR: Cannot compare Record
eq(items, [])             // ❌ COMPILE ERROR: Cannot compare Array
neq(user, { name: "A" })  // ❌ COMPILE ERROR: Cannot compare Object
```

**How to Compare Collections:**
```mel
// Check if array is empty
when eq(len(items), 0) { ... }

// Check if record has specific key
when isNotNull(at(tasks, id)) { ... }

// Check if arrays have same length
when eq(len(a), len(b)) { ... }
```

**This is critical for `once()` to work correctly:**
```mel
state { marker: string = "" }  // v0.7.0: empty string sentinel (nullable banned from state)

action test() {
  once(marker) {  // → when neq(marker, $meta.intentId)
    patch marker = $meta.intentId
  }
}

// First call: marker = "", $meta.intentId = "intent-A"
// neq("", "intent-A") = true ✓ → once() fires
// After: marker = "intent-A"
// Re-entry: neq("intent-A", "intent-A") = false → skips ✓

// Preferred: use onceIntent (no manual marker needed)
action test() {
  onceIntent {
    // guard stored in $mel namespace (platform-owned, not subject to type restrictions)
  }
}
```

**Equality Table (Primitives Only):**
```
┌─────────┬─────────┬──────────────┬───────────────────────────┐
│ a       │ b       │ eq(a, b)     │ neq(a, b) = not(eq(a,b))  │
├─────────┼─────────┼──────────────┼───────────────────────────┤
│ null    │ null    │ true         │ false                     │
│ null    │ string  │ false        │ true                      │
│ null    │ number  │ false        │ true                      │
│ "abc"   │ "abc"   │ true         │ false                     │
│ "abc"   │ "xyz"   │ false        │ true                      │
│ 42      │ 42      │ true         │ false                     │
│ 42      │ 43      │ false        │ true                      │
│ 42      │ "42"    │ false        │ true (different types!)   │
│ true    │ true    │ true         │ false                     │
│ true    │ false   │ false        │ true                      │
└─────────┴─────────┴──────────────┴───────────────────────────┘
```

### 5.4 Boolean-Only Conditions (v0.2.1)

**v0.2.1 removes truthy/falsy coercion.** All conditions in `when`, `once`, and `onceIntent` must be explicitly boolean. See FDR-MEL-025.

```mel
// ❌ FORBIDDEN: Non-boolean conditions
when items { ... }           // Error: Array<T> is not boolean
when user.name { ... }       // Error: string is not boolean
when count { ... }           // Error: number is not boolean

// ✅ REQUIRED: Explicit boolean expressions
when gt(len(items), 0) { ... }
when isNotNull(user.name) { ... }
when neq(count, 0) { ... }
```

**Rationale:**
- Type safety: Compiler can verify condition types
- Explainability: Clear semantics, no "is empty array falsy?" questions
- LLM correctness: No JS-style implicit coercion confusion

### 5.5 Error Handling in Expressions

Expressions do NOT throw. Invalid operations return `null`:

| Operation | Condition | Result |
|-----------|-----------|--------|
| `div(a, b)` | `b == 0` | `null` |
| `at(a, i)` | `i < 0 \|\| i >= len(a)` | `null` |
| `a.b` | `a == null` | `null` |
| `sqrt(x)` | `x < 0` | `null` |

### 5.6 Type Lowering Boundary (v0.7.0)

MEL's `TypeExpr` is richer than Core's runtime validation carrier (`FieldSpec`). The compiler bridges this gap by emitting types into **two distinct slots** in `DomainSchema`:

| Slot | Type carrier | Fidelity | Purpose |
|------|-------------|----------|---------|
| `DomainSchema.types` | `TypeDefinition` | Full — ref, record, union, literal, nullable | Schema metadata, AI reasoning, codegen |
| `StateSpec.fields` / `ActionSpec.input` | `FieldSpec` | Degraded — string, number, boolean, null, object, array, enum | Runtime validation by Core |

> **Rationale:** Core's `FieldSpec` is intentionally simple — its concern is structural validation, not type precision. Full type information is preserved in `DomainSchema.types` (Core SPEC §4.3). Codegen and AI consumers use `types` as the primary source of type truth; `StateSpec`/`ActionSpec.input` are structural validation helpers (Codegen SPEC §10.2–10.3).

#### 5.6.1 TypeExpr → TypeDefinition (Full Fidelity)

The compiler MUST emit all named type declarations into `DomainSchema.types` as `TypeDefinition` nodes. This mapping is 1:1 with no information loss.

| MEL TypeExpr | TypeDefinition |
|-------------|---------------|
| `string` | `{ kind: "primitive", type: "string" }` |
| `number` | `{ kind: "primitive", type: "number" }` |
| `boolean` | `{ kind: "primitive", type: "boolean" }` |
| `null` | `{ kind: "primitive", type: "null" }` |
| `"pending" \| "done"` | `{ kind: "union", types: [{ kind: "literal", value: "pending" }, { kind: "literal", value: "done" }] }` |
| `Array<T>` | `{ kind: "array", element: <lower T> }` |
| `Record<string, T>` | `{ kind: "record", key: { kind: "primitive", type: "string" }, value: <lower T> }` |
| `{ x: T, y?: U }` | `{ kind: "object", fields: { x: { type: <lower T>, optional: false }, y: { type: <lower U>, optional: true } } }` |
| `Task` (named ref) | `{ kind: "ref", name: "Task" }` |
| `T \| null` | `{ kind: "union", types: [<lower T>, { kind: "primitive", type: "null" }] }` |

#### 5.6.2 TypeExpr → FieldSpec (Sound Runtime Boundary)

The compiler MUST lower state field types and action input types to `FieldSpec` for Core's runtime validation. Core's `FieldType` vocabulary is: `string | number | boolean | null | object | array | { enum: [...] }`. FieldSpec has no union, no nullable wrapper, no typed record values, and no ref.

**The soundness principle is absolute:** Every type that appears in a state field or action input position MUST be expressible as a `FieldSpec` that Core can validate without reject-valid or accept-invalid errors. Types that cannot meet this bar are compile errors — not lossy degrades, not warnings.

Full type information is always preserved losslessly in `DomainSchema.types` (§5.6.1) for codegen, AI, and schema consumers.

##### FieldSpec-Compatible Subset (Normative)

| Type pattern | FieldSpec result | Sound? |
|-------------|-----------------|--------|
| `string`, `number`, `boolean` | `{ type: "<primitive>" }` | ✅ |
| `null` | `{ type: "null" }` | ✅ |
| Literal enum: `"a" \| "b" \| "c"` | `{ type: { enum: ["a", "b", "c"] } }` | ✅ |
| `Array<T>` (T in subset) | `{ type: "array", items: <lower T> }` | ✅ |
| Named object type (non-recursive) | `{ type: "object", fields: { ... } }` (inlined) | ✅ |
| `{ x: T, y: U }` (inline object) | `{ type: "object", fields: { ... } }` | ✅ |

##### Forbidden Types in State/Action-Input (Compile Error)

| Type pattern | Error | Rationale |
|-------------|-------|-----------|
| `T \| null` (nullable) | E045 | FieldSpec has no nullable wrapper. `required: true` rejects null; `required: false` means "field may be absent" — neither correctly represents "required but nullable." Core validation (R-001, R-004) would reject valid null values |
| `Record<string, T>` | E046 | FieldSpec loses value type → `{ type: "object" }`. Core validation would accept `{ "a": "not-a-Task" }` for `Record<string, Task>` — accept-invalid. The "structural best-effort" rationalization conflicts with the spec's own soundness claim |
| `string \| number` | E043 | FieldType has no union. Any degrade (e.g., `{ type: "object" }`) rejects valid primitives |
| `Task \| Project` | E043 | Same — non-literal, non-null union |
| Recursive ref (e.g., `Tree`) | E044 | Infinite inline; Core §5.4 forbids circular field references |

> **Why not "lossy with warning"?** Because Core's runtime validation is normative — R-001 ("input MUST match ActionSpec.input"), R-004 ("patch values MUST match field types") are MUST-level rules. A FieldSpec that misrepresents the acceptance set makes Core's validator unsound. A compile error is honest; a broken validator is dangerous. The full type is always available in `DomainSchema.types` for consumers that need it.

##### Workarounds and Migration

**`T | null` → separate fields or separate actions:**

```mel
// ❌ E045: state { selectedTaskId: string | null = null }

// ✅ Workaround 1: Use empty string as sentinel
state { selectedTaskId: string = "" }
computed hasSelection = neq(selectedTaskId, "")

// ✅ Workaround 2: Separate flag + value
state {
  hasSelectedTask: boolean = false
  selectedTaskId: string = ""
}

// ❌ E045: action assign(userId: string | null)
// ✅ Workaround: Separate actions
action assign(userId: string) { ... }
action unassign() { ... }
```

**`Record<string, T>` → `Array<T>` with `.id`:**

```mel
// ❌ E046: state { tasks: Record<string, Task> = {} }

// ✅ Workaround: Array with id field (aligns with entity primitives)
type Task = { id: string, title: string, done: boolean }
state { tasks: Array<Task> = [] }

// Entity primitives (ADR-013b) work directly on Array<T>:
computed task = findById(tasks, selectedTaskId)
action update(id: string) {
  onceIntent {
    patch tasks = updateById(tasks, id, { done: true })
  }
}

// ❌ E046: action import(entries: Record<string, Entry>)
// ✅ Workaround: Array
action import(entries: Array<Entry>) { ... }
```

> **Why Array over Record?** ADR-013b's entity primitives (`findById`, `updateById`, `removeById`) operate on `Array<T>`. The `Array<T>` + `.id` pattern is the recommended model for entity collections in MEL. `Record<string, T>` remains valid in `type` declarations (preserved in `DomainSchema.types`) but cannot be used where Core needs a sound FieldSpec.

**Lowering Rules (Normative):**

| Rule ID | Level | Description |
|---------|-------|-------------|
| TYPE-LOWER-1 | MUST | Primitives lower directly: `string` → `{ type: "string" }` etc. |
| TYPE-LOWER-2 | MUST | Literal unions lower to enum: `"a" \| "b"` → `{ type: { enum: ["a", "b"] } }` |
| TYPE-LOWER-3 | MUST | `Array<T>` → `{ type: "array", items: <lower T> }`. `T` must be in the FieldSpec-compatible subset |
| TYPE-LOWER-4 | MUST | Non-recursive named object types are inlined. Compiler MUST detect cycles before inlining |
| TYPE-LOWER-5 | MUST | Inline object types → `{ type: "object", fields: {...} }` |
| TYPE-LOWER-6 | MUST | `T \| null` → compile error E045 |
| TYPE-LOWER-7 | MUST | `Record<string, T>` → compile error E046 |
| TYPE-LOWER-8 | MUST | Non-trivial unions (not literal enum) → compile error E043 |
| TYPE-LOWER-9 | MUST | Recursive named types → compile error E044 |

**Examples:**

```
MEL: state { count: number = 0 }
FieldSpec: { type: "number", required: true, default: 0 }

MEL: state { status: "pending" | "active" | "done" = "pending" }
FieldSpec: { type: { enum: ["pending", "active", "done"] }, required: true, default: "pending" }

MEL: state { tasks: Array<Task> = [] }
  where type Task = { id: string, title: string, done: boolean }
FieldSpec: { type: "array", required: true, default: [],
             items: { type: "object", required: true,
                      fields: { id: { type: "string", required: true },
                                title: { type: "string", required: true },
                                done: { type: "boolean", required: true } } } }

MEL: action addTask(title: string, priority: number)
ActionSpec.input: { type: "object", required: true,
                    fields: { title: { type: "string", required: true },
                              priority: { type: "number", required: true } } }

// ❌ E045: Nullable
state { selectedTaskId: string | null = null } → compile error
action assign(user: User | null) → compile error

// ❌ E046: Record
state { tasks: Record<string, Task> = {} } → compile error
action import(entries: Record<string, Entry>) → compile error

// ❌ E043: Non-trivial union
action process(value: string | number) → compile error

// ❌ E044: Recursive type
state { root: Tree = ... } → compile error (where type Tree = { children: Array<Tree> })
```

> **Key principle:** The state/action-input type surface is exactly the FieldSpec-compatible subset. Spec promise = runtime guarantee. Full type richness lives in `DomainSchema.types`.

---

## 6. Semantic Rules

### 6.1 Scope Resolution Order (v0.2.3)

MEL has a **strict scope resolution order**:

```
┌─────────────────────────────────────────────────────────────┐
│  Priority 1 (highest): Action Parameters ($input.*)          │
│  ─────────────────────────────────────────────────────────  │
│  Priority 2: Computed Values                                 │
│  ─────────────────────────────────────────────────────────  │
│  Priority 3: Domain State (declared in state { })            │
│  ─────────────────────────────────────────────────────────  │
│  Priority 4 (lowest): System ($system.*, $meta.*)            │
└─────────────────────────────────────────────────────────────┘
```

**Resolution order (within allowed contexts):** Parameters > Computed > State > System

> **v0.7.0 clarification:** This is a *name resolution* order, not an *availability* order. Each context restricts which categories are accessible (see §9.3.2). The resolution order applies only to the categories that are permitted in that context.

**Context-specific visibility:**

```
In Action body:
  Parameters > Computed > State > System ($system.*, $meta.*, $input.*)

In Computed expression:
  Computed > State
  ($system.*, $meta.*, $input.* are FORBIDDEN — no Intent context)

In Available condition:
  Computed > State
  ($system.*, $meta.*, $input.*, action parameters are FORBIDDEN — A28)

In State initializer:
  Compile-time constants only (literals, object/array literals of literals)
  (No state field references, no computed, no $system.*, $meta.*, $input.* — §4.3.1)

In Effect sub-expression (where, select, etc.):
  $item > Parameters > Computed > State > System
```

**Name Collision Rules (Normative):**
```
- Computed name == State name → COMPILE ERROR
- Parameter name shadows Computed/State → ALLOWED (with warning)
- $item shadows everything in effect context → ALLOWED (by design)
```

**Reserved Namespaces (v0.5.0):**

The following paths are reserved for platform use:

| Path Prefix | Owner | Purpose |
|-------------|-------|---------|
| `$host.*` | Host | Execution context, intent slots |
| `$mel.*` | Compiler | Guard state, compiler internals |
| `$meta.*` | Runtime | Intent metadata (action body only) |
| `$input.*` | Runtime | Action parameters (action body only) |
| `$system.*` | Core | System IO values (action body only — lowered to effects) |

**Rule:** Domain identifiers starting with `$` are forbidden (compile error E004).

**Note:** This rule applies to *domain-defined* identifiers. Platform components (Host, Compiler) inject `$host`/`$mel` for their own use. Developers using Host directly may manually add these fields—this is permitted because the fields are *platform-owned*, not domain-owned.

**Example:**
```mel
domain Example {
  state {
    count: number = 0
    items: Array<Item> = []
  }
  
  computed total = len(items)           // items → state.items
  computed hasItems = gt(total, 0)      // total → total ✓
  
  action process(count: number) {       // count shadows state.count
    when gt(count, 0) {                 // count → parameter (shadows state)
      patch items = []                  // items → state.items
    }
  }
  
  // ❌ COMPILE ERROR: Name collision between computed and state
  // state { foo: number = 0 }
  // computed foo = 1
}
```

### 6.2 Path Resolution

All non-parameter, non-system identifiers resolve to Snapshot paths:

```mel
// In domain context:
computed x = user.name

// Resolves to:
{ kind: 'get', path: [{ kind: 'prop', name: 'user' }, { kind: 'prop', name: 'name' }] }
```

### 6.3 Expression Purity Rules

Every expression MUST satisfy:

1. **Determinism**: Same inputs → same output
2. **Totality**: Always returns a value (possibly `null`)
3. **Termination**: Finite computation steps
4. **Isolation**: No observation of external state

### 6.4 Re-entry Safety

Action bodies are evaluated on **every compute cycle**. Guards (`when`) and `once()` prevent unintended re-execution:

```mel
// UNSAFE: Runs every cycle!
action bad() {
  patch count = add(count, 1)  // Infinite increment!
}

// SAFE: Guard prevents re-entry
action good() {
  when eq(triggered, null) {
    patch triggered = true
    patch count = add(count, 1)
  }
}

// SAFE: once() sugar
action better() {
  once(triggered) {
    patch count = add(count, 1)
  }
}
```

### 6.5 Effect Ordering

Effects within an action are ordered:

```mel
action sequential() {
  when ready {
    effect first()   // 1st
    effect second()  // 2nd
    effect third()   // 3rd
  }
}
```

Host SHOULD respect declared ordering but MAY parallelize independent effects.

---

## 7. IR Mapping

### 7.1 Call-Only IR (v0.2.4)

**v0.2.4: All operations use `{kind: 'call'}` nodes.** There are no specialized node kinds for individual operations. See FDR-MEL-040.

MEL uses a **canonical form** where all expressions are normalized to function syntax before IR generation. The parser accepts operator syntax for convenience, but the compiler normalizes to canonical form. See FDR-MEL-024.

**Normalization Table:**

| Input (Operator) | Canonical (Function) | IR |
|------------------|---------------------|-----|
| `a + b` | `add(a, b)` | `{ kind: 'call', fn: 'add', args: [A, B] }` |
| `a - b` | `sub(a, b)` | `{ kind: 'call', fn: 'sub', args: [A, B] }` |
| `a * b` | `mul(a, b)` | `{ kind: 'call', fn: 'mul', args: [A, B] }` |
| `a / b` | `div(a, b)` | `{ kind: 'call', fn: 'div', args: [A, B] }` |
| `a % b` | `mod(a, b)` | `{ kind: 'call', fn: 'mod', args: [A, B] }` |
| `-a` | `neg(a)` | `{ kind: 'call', fn: 'neg', args: [A] }` |
| `a == b` | `eq(a, b)` | `{ kind: 'call', fn: 'eq', args: [A, B] }` |
| `a != b` | `neq(a, b)` | `{ kind: 'call', fn: 'neq', args: [A, B] }` |
| `a < b` | `lt(a, b)` | `{ kind: 'call', fn: 'lt', args: [A, B] }` |
| `a <= b` | `lte(a, b)` | `{ kind: 'call', fn: 'lte', args: [A, B] }` |
| `a > b` | `gt(a, b)` | `{ kind: 'call', fn: 'gt', args: [A, B] }` |
| `a >= b` | `gte(a, b)` | `{ kind: 'call', fn: 'gte', args: [A, B] }` |
| `a && b` | `and(a, b)` | `{ kind: 'call', fn: 'and', args: [A, B] }` |
| `a \|\| b` | `or(a, b)` | `{ kind: 'call', fn: 'or', args: [A, B] }` |
| `!a` | `not(a)` | `{ kind: 'call', fn: 'not', args: [A] }` |
| `a ?? b` | `coalesce(a, b)` | `{ kind: 'call', fn: 'coalesce', args: [A, B] }` |
| `a ? b : c` | `cond(a, b, c)` | `{ kind: 'call', fn: 'cond', args: [A, B, C] }` |
| `x[y]` | `at(x, y)` | `{ kind: 'call', fn: 'at', args: [X, Y] }` |

**Example:**
```mel
// These all produce the same IR:
computed x = a + b * c
computed x = add(a, mul(b, c))

// IR (v0.2.4 call-only):
{ kind: 'call', fn: 'add', args: [
  { kind: 'get', path: [{ kind: 'prop', name: 'a' }] },
  { kind: 'call', fn: 'mul', args: [
    { kind: 'get', path: [{ kind: 'prop', name: 'b' }] },
    { kind: 'get', path: [{ kind: 'prop', name: 'c' }] }
  ]}
]}
```

### 7.2 Expression Node Types (v0.2.4)

> **Cross-reference:** The authoritative type definition for MEL Canonical IR is §17.1.1 `MelExprNode`. This section provides the same type with examples and rationale.

**ONLY 8 node kinds for expressions:**

```typescript
type SysPathSegment = string;

type ExprNode =
  // Literals
  | { kind: 'lit'; value: null | boolean | number | string }

  // Variable (iteration context only)
  | { kind: 'var'; name: 'item' }            // v0.3.3: 'acc' removed (reduce forbidden)

  // System value access
  | { kind: 'sys'; path: readonly SysPathSegment[] }

  // State/Computed access
  | { kind: 'get'; path: PathNode }
  | { kind: 'get'; base: ExprNode; path: PathNode }

  // Static property access on computed expressions
  | { kind: 'field'; object: ExprNode; property: string }

  // Function/operator call (UNIVERSAL)
  | { kind: 'call'; fn: string; args: ExprNode[] }

  // Object literal
  | { kind: 'obj'; fields: { key: string; value: ExprNode }[] }

  // Array literal
  | { kind: 'arr'; elements: ExprNode[] }
```

**Complete Mapping Table:**

| MEL Syntax | ExprNode |
|------------|----------|
| `null` | `{ kind: 'lit', value: null }` |
| `true` | `{ kind: 'lit', value: true }` |
| `42` | `{ kind: 'lit', value: 42 }` |
| `"hello"` | `{ kind: 'lit', value: "hello" }` |
| `$item` | `{ kind: 'var', name: 'item' }` |
| `$system.uuid` | `{ kind: 'sys', path: ['system', 'uuid'] }` |
| `$meta.intentId` | `{ kind: 'sys', path: ['meta', 'intentId'] }` |
| `foo.bar` | `{ kind: 'get', path: [{ kind: 'prop', name: 'foo' }, { kind: 'prop', name: 'bar' }] }` |
| `$item.name` | `{ kind: 'get', base: { kind: 'var', name: 'item' }, path: [{ kind: 'prop', name: 'name' }] }` |
| `add(a, b)` | `{ kind: 'call', fn: 'add', args: [A, B] }` |
| `len(arr)` | `{ kind: 'call', fn: 'len', args: [ARR] }` |
| `at(arr, i)` | `{ kind: 'call', fn: 'at', args: [ARR, I] }` |
| `isNull(x)` | `{ kind: 'call', fn: 'isNull', args: [X] }` |
| `{ a: 1 }` | `{ kind: 'obj', fields: [{ key: 'a', value: { kind: 'lit', value: 1 } }] }` |
| `[1, 2]` | `{ kind: 'arr', elements: [{ kind: 'lit', value: 1 }, { kind: 'lit', value: 2 }] }` |
| `at(items, id).status` | `{ kind: 'field', object: { kind: 'call', fn: 'at', args: [ITEMS, ID] }, property: 'status' }` |
| `coalesce(a, b)` | `{ kind: 'call', fn: 'coalesce', args: [A, B] }` |

### 7.2.1 System Values and Variables (v0.3.3)

| MEL Syntax | ExprNode |
|------------|----------|
| `$system.time.now` | `{ kind: 'sys', path: ['system', 'time', 'now'] }` |
| `$system.uuid` | `{ kind: 'sys', path: ['system', 'uuid'] }` |
| `$meta.intentId` | `{ kind: 'sys', path: ['meta', 'intentId'] }` |
| `$meta.actor` | `{ kind: 'sys', path: ['meta', 'actor'] }` |
| `$input.field` | `{ kind: 'sys', path: ['input', 'field'] }` |
| `$item` | `{ kind: 'var', name: 'item' }` |
| `$item.field` | `{ kind: 'get', base: { kind: 'var', name: 'item' }, path: ['field'] }` |

**v0.3.3 Note:** `$item` uses `var` nodes, not `sys` nodes. `$acc` is removed (reduce forbidden).

### 7.2.2 Path Nodes (v0.2.5)

**v0.2.5: PathSegment is prop-only. Index access uses `call(at)`.**

```typescript
// v0.2.5: PathSegment is prop-only (no index segment)
type PathSegment = { kind: 'prop'; name: string };
type PathNode = PathSegment[];

// Dynamic indexing is handled by at() call, not PathSegment
```

**Access Syntax to IR:**

| Syntax | IR |
|--------|-----|
| `x.y` | `{ kind: 'get', path: [{ kind: 'prop', name: 'x' }, { kind: 'prop', name: 'y' }] }` |
| `$item.x` | `{ kind: 'get', base: { kind: 'var', name: 'item' }, path: [{ kind: 'prop', name: 'x' }] }` |
| `expr.y` (where expr is not a path) | `{ kind: 'field', object: <expr>, property: 'y' }` |
| `x[y]` | `{ kind: 'call', fn: 'at', args: [<x>, <y>] }` |
| `x[0]` | `{ kind: 'call', fn: 'at', args: [<x>, { kind: 'lit', value: 0 }] }` |

**Chained Access Example:**
```mel
// Source
tasks.active[id].title

// IR (v0.5.0)
{
  kind: 'field',
  object: {
    kind: 'call',
    fn: 'at',
    args: [
      { kind: 'get', path: [{ kind: 'prop', name: 'tasks' }, { kind: 'prop', name: 'active' }] },
      { kind: 'get', path: [{ kind: 'prop', name: 'id' }] }
    ]
  },
  property: 'title'
}
```

### 7.2.3 Evaluation Order (v0.2.5 Normative)

**Evaluation order affects `$system.uuid` generation and is therefore semantically meaningful.**

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

5. Effect arguments: DECLARED ORDER in source
```

See FDR-MEL-046 for rationale.

### 7.3 Function to ExprNode (v0.2.4 Call-Only)

**All functions use `{kind: 'call'}` nodes:**

| MEL Function | ExprNode |
|--------------|----------|
| `len(a)` | `{ kind: 'call', fn: 'len', args: [A] }` |
| `first(a)` | `{ kind: 'call', fn: 'first', args: [A] }` |
| `last(a)` | `{ kind: 'call', fn: 'last', args: [A] }` |
| `at(a, i)` | `{ kind: 'call', fn: 'at', args: [A, I] }` |
| `concat(a, b, ...)` | `{ kind: 'call', fn: 'concat', args: [...] }` |
| `trim(s)` | `{ kind: 'call', fn: 'trim', args: [S] }` |
| `lower(s)` | `{ kind: 'call', fn: 'lower', args: [S] }` |
| `upper(s)` | `{ kind: 'call', fn: 'upper', args: [S] }` |
| `substr(s, start, end?)` | `{ kind: 'call', fn: 'substr', args: [S, START, END?] }` |
| `strlen(s)` | `{ kind: 'call', fn: 'strlen', args: [S] }` |
| `abs(n)` | `{ kind: 'call', fn: 'abs', args: [N] }` |
| `min(a, b, ...)` | `{ kind: 'call', fn: 'min', args: [...] }` |
| `max(a, b, ...)` | `{ kind: 'call', fn: 'max', args: [...] }` |
| `floor(n)` | `{ kind: 'call', fn: 'floor', args: [N] }` |
| `ceil(n)` | `{ kind: 'call', fn: 'ceil', args: [N] }` |
| `round(n)` | `{ kind: 'call', fn: 'round', args: [N] }` |
| `sqrt(n)` | `{ kind: 'call', fn: 'sqrt', args: [N] }` |
| `pow(base, exp)` | `{ kind: 'call', fn: 'pow', args: [BASE, EXP] }` |
| `isNull(x)` | `{ kind: 'call', fn: 'isNull', args: [X] }` |
| `isNotNull(x)` | `{ kind: 'call', fn: 'isNotNull', args: [X] }` |
| `coalesce(a, b, ...)` | `{ kind: 'call', fn: 'coalesce', args: [...] }` |
| `toString(x)` | `{ kind: 'call', fn: 'toString', args: [X] }` |

### 7.4 Index Syntax Desugaring (v0.2.3)

Index syntax always desugars to `at()`. This works for both Array and Record:

```mel
// Array access:
items[0]          → at(items, 0)
items[idx]        → at(items, idx)

// Record access:
tasks[id]         → at(tasks, id)
users["admin"]    → at(users, "admin")

// IR (universal):
{ kind: 'call', fn: 'at', args: [<collection>, <index>] }

// Example: tasks[id]
{ kind: 'call', fn: 'at', args: [
  { kind: 'get', path: [{ kind: 'prop', name: 'tasks' }] },
  { kind: 'get', path: [{ kind: 'prop', name: 'id' }] }
]}
```

**v0.5.0 Note:** Property access on non-path expressions uses `field` node, NOT `at()`:
```mel
// Property access on function result:
at(items, id).status  → { kind: 'field', object: at(items, id), property: 'status' }

// NOT: at(at(items, id), "status")  ← This was the v0.2.5 bug (Issue #135)
```

### 7.5 Statement to IR

| MEL Statement | IR Structure |
|---------------|--------------|
| `computed x = E` | `ComputedSpec { name: 'x', expr: E }` |
| `patch p = E` | `PatchOp { op: 'set', path: P, value: E }` |
| `patch p unset` | `PatchOp { op: 'unset', path: P }` |
| `patch p merge E` | `PatchOp { op: 'merge', path: P, value: E }` |
| `when C { ... }` | `Guard { condition: C, body: [...] }` |
| `once(m) { ... }` | `Guard { condition: neq(m, $meta.intentId), body: [...] }` |
| `once(m) when C {...}` | `Guard { condition: and(neq(m, $meta.intentId), C), body: [...] }` |
| `effect T(A)` | `EffectDecl { type: T, params: A }` |

**v0.2.3 once() Expansion (CRITICAL):**

```mel
// MEL source
once(marker) {
  patch marker = $meta.intentId
  effect api.submit({ data: form, into: result })
}

// IR (v0.2.3)
{
  kind: 'when',
  cond: {
    kind: 'call',
    fn: 'neq',
    args: [
      { kind: 'get', path: [{ kind: 'prop', name: 'marker' }] },
      { kind: 'sys', path: ['meta', 'intentId'] }
    ]
  },
  body: [
    { kind: 'patch', op: 'set',
      path: [{ kind: 'prop', name: 'marker' }],
      value: { kind: 'sys', path: ['meta', 'intentId'] }
    },
    { kind: 'effect', type: 'api.submit', args: [...] }
  ]
}
```

**Note (v0.2.3):** `once()` expands to `when neq(marker, $meta.intentId)`, enabling per-intent idempotency. The body MUST contain `patch marker = $meta.intentId`.

---

## 8. Forbidden Constructs

### 8.1 Syntactically Forbidden

The following constructs **do not exist in MEL grammar**:

```mel
// ❌ Variable declaration
let x = 5;          // SyntaxError: unexpected token 'let'
const y = 10;       // SyntaxError: unexpected token 'const'
var z = 15;         // SyntaxError: unexpected token 'var'

// ❌ Function definition
function foo() {}   // SyntaxError: unexpected token 'function'
const fn = () => {} // SyntaxError: unexpected token '=>'

// ❌ Loops
for (let i...) {}   // SyntaxError: unexpected token 'for'
while (cond) {}     // SyntaxError: unexpected token 'while'
do {} while (cond)  // SyntaxError: unexpected token 'do'

// ❌ Method calls (NEW in v0.2)
str.trim()          // SyntaxError: unexpected token '(' after property
items.filter(...)   // SyntaxError: unexpected token '(' after property
obj.method()        // SyntaxError: unexpected token '(' after property

// ❌ Control flow (outside when)
if (cond) {}        // SyntaxError: unexpected token 'if'
switch (x) {}       // SyntaxError: unexpected token 'switch'
throw new Error()   // SyntaxError: unexpected token 'throw'
try {} catch {}     // SyntaxError: unexpected token 'try'

// ❌ Classes
class Foo {}        // SyntaxError: unexpected token 'class'

// ❌ Async
async function f()  // SyntaxError: unexpected token 'async'
await promise       // SyntaxError: unexpected token 'await'
```

### 8.2 Semantically Forbidden

The following are valid syntax but rejected by semantic analysis:

```mel
// ❌ Unknown function
filter(items, ...)
// SemanticError: 'filter' is not a builtin function. Use effect array.filter() instead.

map(items, ...)
// SemanticError: 'map' is not a builtin function. Use effect array.map() instead.

split(str, ',')
// SemanticError: 'split' is not a builtin function.

// ❌ Unknown global
Object.keys(user)
// SemanticError: 'Object' is not defined.

Math.random()
// SemanticError: 'Math' is not defined.

Date.now()
// SemanticError: 'Date' is not defined. Use $system.time.now instead.

// ❌ Assignment outside patch
count = add(count, 1)
// SemanticError: Direct assignment is forbidden. Use 'patch count = ...' instead.
```

### 8.3 Tier Violations

Computed expressions MUST NOT contain Effects:

```mel
// ❌ Effect in computed
computed filtered = effect array.filter(...)
// SemanticError: Effects are not allowed in computed expressions.

// ✅ Effect in action (inside guard — required by FDR-MEL-020)
action filterTasks() {
  onceIntent {
    effect array.filter({
      source: tasks,
      where: eq($item.completed, false),
      into: filteredTasks
    })
  }
}
```

### 8.4 Nested Effects (Normative)

Effects MUST NOT appear inside other Effects:

```mel
// ❌ FORBIDDEN: Nested Effect
effect array.map({
  source: teams,
  select: {
    members: effect array.filter({      // Effect in expression position!
      source: $item.members,
      where: eq($item.active, true)
    })
  },
  into: result
})
// SyntaxError: Effect cannot appear in expression position

// ✅ REQUIRED: Sequential composition (inside guards)
action getActiveMembers() {
  once(step1) {
    patch step1 = $meta.intentId
    effect array.flatMap({
      source: teams,
      select: $item.members,
      into: allMembers
    })
  }
  
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

**Why forbidden:**
1. `$item` scope becomes ambiguous in nested effects
2. Execution order becomes implicit
3. Trace cannot show intermediate states
4. LLM generation accuracy drops significantly

**See FDR-MEL-018 for full rationale.**

---

## 9. Standard Library

### 9.1 Builtin Functions

#### 9.1.1 Arithmetic Functions (Canonical)

**v0.2.1:** These are the canonical forms. Operators (`+`, `-`, etc.) are sugar that normalize to these. See FDR-MEL-024.

| Function | Signature | Description |
|----------|-----------|-------------|
| `add(a, b)` | `(number, number) → number` | Addition |
| `sub(a, b)` | `(number, number) → number` | Subtraction |
| `mul(a, b)` | `(number, number) → number` | Multiplication |
| `div(a, b)` | `(number, number) → number \| null` | Division (null if b=0) |
| `mod(a, b)` | `(number, number) → number` | Modulo |
| `neg(a)` | `number → number` | Negation |

#### 9.1.2 Index Access Functions (v0.2.3)

| Function | Signature | Description |
|----------|-----------|-------------|
| `len(arr)` | `Array<T> → number` | Returns array length |
| `first(arr)` | `Array<T> → T \| null` | Returns first element |
| `last(arr)` | `Array<T> → T \| null` | Returns last element |
| `at(arr, i)` | `(Array<T>, number) → T \| null` | Returns element at index |
| `at(rec, k)` | `(Record<K, V>, K) → V \| null` | **Returns value for key (v0.2.3)** |

**v0.5.0 Type Dispatch Rule (Normative):**
- If base is `Array`: key MUST be `number`. String keys return `null` (arrays are NOT treated as records).
- If base is `Record` (non-array object): key MUST be `string`. Returns value for key or `null`.
- If base is `null`, primitive, or key type mismatches: returns `null`.

**v0.2.3 Universal Index Access:** `at()` is overloaded to work on both Array and Record. The `[]` syntax is ALWAYS sugar for `at()`. See FDR-MEL-035.

```mel
// Array access
items[0]        → at(items, 0)
items[idx]      → at(items, idx)

// Record access
tasks[id]       → at(tasks, id)
users["admin"]  → at(users, "admin")

// Chained access
nested.data[key]  → at(get(nested.data), key)
// Property access on computed result:
at(items, id).status  → field(at(items, id), "status")
```

**v0.5.0 Semantic Distinction:**
- `field(expr, "prop")`: Static property access. The property name is a compile-time constant. Used when `.prop` follows a non-path expression.
- `at(collection, key)`: Dynamic lookup. The key is a runtime value. Used for `[]` syntax and explicit `at()` calls.

The `[]` syntax is ALWAYS sugar for `at()`. The `.prop` syntax uses `get` for paths and `field` for computed expression results. See FDR-MEL-078.

**v0.2.1 RESTRICTION:** `len()` is **Array-only**. Using `len()` on `Record<K,V>` is a semantic error. See FDR-MEL-026.

```mel
// ✅ Allowed
len(items)           // Array<T> → number
at(items, 0)         // Array access
at(tasks, id)        // Record access

// ❌ Forbidden
len(records)         // Error: records is Record<string, Task>
                     // Record is only valid in type declarations, not state fields (E046)
```

#### 9.1.2a Array Append Function (v0.7.0)

| Function | Signature | Description |
|----------|-----------|-------------|
| `append(arr, item)` | `(Array<T>, T) → Array<T>` | Returns new array with item appended |

This is a **pure function** — it returns a new array, not mutates in place. It is the primary way to add items to `Array<T>` collections.

```mel
// Append a single item
patch tasks = append(tasks, {
  id: $system.uuid,
  title: title,
  done: false
})
```

**Lowering:**
```
// MEL: append(arr, item)
// Core: { kind: "append", array: <lowered arr>, items: [<lowered item>] }
```

The MEL `append(arr, item)` always appends exactly one item. Core's `append` node takes an `items` array; the compiler wraps the single argument in a one-element array.

> **Note:** `concat` is a **string** function (`(...string) → string`). For array append, use `append`.

#### 9.1.3 String Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `strlen(s)` | `string → number` | Returns string length |
| `trim(s)` | `string → string` | Removes whitespace |
| `lower(s)` | `string → string` | Converts to lowercase |
| `upper(s)` | `string → string` | Converts to uppercase |
| `concat(a, b, ...)` | `(...string) → string` | Concatenates strings |
| `substr(s, start, end?)` | `(string, number, number?) → string` | Extracts substring |

#### 9.1.4 Math Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `abs(n)` | `number → number` | Absolute value |
| `min(a, b, ...)` | `(...number) → number` | Minimum value |
| `max(a, b, ...)` | `(...number) → number` | Maximum value |
| `floor(n)` | `number → number` | Round down |
| `ceil(n)` | `number → number` | Round up |
| `round(n)` | `number → number` | Round to nearest |
| `sqrt(n)` | `number → number \| null` | Square root (null if negative) |
| `pow(base, exp)` | `(number, number) → number` | Exponentiation |

#### 9.1.5 Null Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `isNull(x)` | `T → boolean` | Returns true if null |
| `isNotNull(x)` | `T → boolean` | Returns true if not null |
| `coalesce(a, b, ...)` | `(...T) → T` | Returns first non-null |

#### 9.1.6 Comparison Functions (Canonical)

| Function | Signature | Description |
|----------|-----------|-------------|
| `eq(a, b)` | `(T, T) → boolean` | Equality |
| `neq(a, b)` | `(T, T) → boolean` | Inequality |
| `gt(a, b)` | `(number, number) → boolean` | Greater than |
| `gte(a, b)` | `(number, number) → boolean` | Greater or equal |
| `lt(a, b)` | `(number, number) → boolean` | Less than |
| `lte(a, b)` | `(number, number) → boolean` | Less or equal |

#### 9.1.7 Logical Functions (Canonical)

**v0.2.1:** Arguments must be `boolean`. Truthy/falsy coercion is removed. See FDR-MEL-025.

| Function | Signature | Description |
|----------|-----------|-------------|
| `and(a, b)` | `(boolean, boolean) → boolean` | Logical AND |
| `or(a, b)` | `(boolean, boolean) → boolean` | Logical OR |
| `not(a)` | `boolean → boolean` | Logical NOT |
| `cond(c, t, e)` | `(boolean, T, T) → T` | **Conditional (v0.2.2: renamed from `if`)** |

**v0.2.2 Note:** `if()` was renamed to `cond()` to avoid conflict with the reserved word `if`.

#### 9.1.8 Conversion Functions (v0.2.2)

| Function | Signature | Description |
|----------|-----------|-------------|
| `toString(x)` | `number \| boolean \| null → string` | Convert to string |

**v0.2.2:** Since template literals are removed, use `toString()` for explicit conversion.

```mel
// Before (v0.2.1)
computed message = `Count: ${count}`

// After (v0.2.2)
computed message = concat("Count: ", toString(count))
```

#### 9.1.9 Primitive Aggregation Functions (v0.3.3)

Primitive Aggregation functions express **known facts** about collections, not user-defined computation.

| Function | Signature | Description |
|----------|-----------|-------------|
| `sum(arr)` | `Array<number> → number` | Sum of numeric array |
| `min(arr)` | `Array<T> → T \| null` | Minimum value (null if empty) |
| `max(arr)` | `Array<T> → T \| null` | Maximum value (null if empty) |

**Note:** `len(arr)` is NOT a primitive aggregation function. It is a general-purpose builtin (§9.1.2) with no context restrictions — usable in computed, guards, action flow, available, and anywhere else expressions are permitted. `min(a, b, ...)` and `max(a, b, ...)` (scalar variadic, §9.1.4) remain separate functions for comparing individual values.

##### Constitutional Constraints (MUST)

These functions are permitted **only** under the following constraints:

**1. Fixed Semantics Only**
```mel
// ✅ ALLOWED
sum(prices)

// ❌ FORBIDDEN — No predicates, no custom logic
sum(prices, where: gt($item, 0))
sum(prices, fn: customAdder)
```

**2. Scalar Result Only**
- No collection results
- No intermediate state exposure
- No accumulator

**3. Computed Only (No Flow)**
```mel
// ✅ ALLOWED
computed total = sum(prices)

// ❌ FORBIDDEN — Not in action flow
action checkout() {
  when gt(sum(prices), 0) { ... }  // Error
}
```

**4. No Composition**
```mel
// ❌ FORBIDDEN — No nested expressions
sum(filter(prices))
min(map(items, $item.price))

// ✅ ALLOWED — Direct reference only
sum(prices)
```

**5. Forbidden Accumulation Functions (Permanent)**

| Function | Why Forbidden |
|----------|---------------|
| `reduce(array, fn, init)` | Exposes `$acc`, user-defined logic |
| `fold(array, fn, init)` | Same as reduce |
| `foldl` / `foldr` | Same as reduce |
| `scan(array, fn, init)` | Returns intermediate states |

> **Any construct that implies hidden state progression is forbidden.**
> See FDR-MEL-062.

#### 9.1.10 Entity Collection Functions (v0.7.0 — ADR-013b)

Entity collection functions express **fixed-semantics, id-based single-item operations** on `Array<Entity>` collections. They are intention-revealing vocabulary — not general collection transforms.

> **Rationale (ADR-013b):** `findById(tasks, id)` is a **fact** ("the task with this id"), not a **procedure** ("how to find that task"). This follows the same principle as FDR-MEL-062: `sum(prices)` is permitted because it expresses a known fact, while `reduce(prices, fn, init)` is forbidden because it expresses a procedure. Entity primitives are NOT replacements for `effect array.map/filter/find`; they handle only `.id`-based single-item operations. Arbitrary predicates, multi-item operations, sorting, and grouping remain in effect pipelines.

##### Query Primitives (013b-1)

| Function | Signature | Description |
|----------|-----------|-------------|
| `findById(coll, id)` | `(Array<T>, T.id \| null) → T \| null` | Returns item where `.id == id`, or `null` |
| `existsById(coll, id)` | `(Array<T>, T.id \| null) → boolean` | Returns `true` if item with `.id == id` exists |

Query primitives are permitted in **all expression contexts**: computed, guard condition, patch RHS, available (with state/computed arguments only — action parameters are not available at availability check time; see §13.1).

```mel
computed selectedTask = findById(tasks, selectedId)

// available with state-only argument
action editAnyTask()
  available when gt(len(tasks), 0) {
  // ...
}

// Input-dependent validation goes in the action body, not available
action editTask(taskId: string, title: string) {
  when not(existsById(tasks, taskId)) {
    fail "NOT_FOUND" with concat("Task not found: ", taskId)
  }
  // ...
}
```

##### Transform Primitives (013b-2)

| Function | Signature | Description |
|----------|-----------|-------------|
| `updateById(coll, id, updates)` | `(Array<T>, T.id \| null, Partial<T>) → Array<T>` | Shallow-merges `updates` into the matching item |
| `removeById(coll, id)` | `(Array<T>, T.id \| null) → Array<T>` | Removes the matching item |

Transform primitives are restricted to **patch RHS only**.

```mel
action softDeleteTask(id: string) {
  onceIntent {
    patch tasks = updateById(tasks, id, {
      deletedAt: $system.time.now,
      updatedAt: $system.time.now
    })
  }
}

action deleteTask(id: string) {
  onceIntent {
    patch tasks = removeById(tasks, id)
  }
}
```

`T.id` is constrained to `string | number` by FDR-MEL-042 (primitive-only equality). `null` id is always accepted (semantics: "no match" — ENTITY-8).

##### Entity Constraints (Normative)

| Rule ID | Level | Description |
|---------|-------|-------------|
| ENTITY-1 | MUST | Key field is fixed to `.id` |
| ENTITY-2 | MUST | Element type MUST have an `.id` field — compile error E030 otherwise |
| ENTITY-2a | MUST | `.id` field MUST be primitive (`string` or `number`) — compile error E030a otherwise |
| ENTITY-2b | MUST | `.id` values MUST be unique within the collection (domain invariant). Compiler MUST reject statically detectable violations in state initializers (E030b). Behavior under duplicate ids is defined but degraded: `findById` returns first match; `updateById`/`removeById` affect all matches |
| ENTITY-3 | MUST | `$item` is NOT exposed to the caller. `.id` matching is fixed semantics |
| ENTITY-4 | MUST | No new ExprNode kinds added to Core IR |
| ENTITY-5 | MUST | Lowering uses existing Core ExprNode kinds (`find`, `filter`, `map`, `if`, `eq`, `merge`, `not`, `isNull`, `get`, `field`) |
| ENTITY-7 | MUST | NOT a general replacement for `effect array.*` |
| ENTITY-8 | MUST | `null` id argument behaves as "no match" |
| ENTITY-9 | MUST | Primitives remain as MEL Canonical IR `call` nodes until the MEL → Core lowering boundary (FDR-MEL-064, A34) |

##### Transform Context Restrictions (Normative)

| Rule ID | Level | Description |
|---------|-------|-------------|
| TRANSFORM-1 | MUST | Patch RHS only: `computed x = updateById(...)` is forbidden (E031) |
| TRANSFORM-2 | MUST | No nesting: `updateById(removeById(...), ...)` is forbidden (E032) |
| TRANSFORM-3 | MUST | State-path collection only: first argument must resolve to a state-declared path. Computed names are forbidden because they can hide arbitrary sub-expressions (E033). Concretely: the path's root segment must exist in `StateSpec.fields`, not `ComputedSpec.fields` |
| TRANSFORM-4 | MUST | Forbidden in guard conditions (E034) |
| TRANSFORM-5 | MUST | Forbidden in available conditions (E035) |

##### Lowering (at MEL → Core Boundary)

Entity primitives remain as MEL `call` nodes through validation and type checking. Lowering to Core IR occurs only at the existing MEL → Core lowering boundary (FDR-MEL-064).

```
// findById(tasks, id)
MEL IR:  { kind: "call", fn: "findById", args: [get("tasks"), get("id")] }
Core IR: { kind: "find", array: get("tasks"),
           predicate: { kind: "eq", left: get("$item.id"), right: get("id") } }

// existsById(tasks, id)
Core IR: { kind: "not", arg: { kind: "isNull", arg: <find as above> } }

// updateById(tasks, id, { status: newStatus })
Core IR: { kind: "map", array: get("tasks"), mapper:
           { kind: "if", cond: eq(get("$item.id"), get("id")),
             then: merge([get("$item"), { status: get("newStatus") }]),
             else: get("$item") } }

// removeById(tasks, id)
Core IR: { kind: "filter", array: get("tasks"),
           predicate: { kind: "not", arg: eq(get("$item.id"), get("id")) } }
```

Note: `$item` is generated only in Core IR — never visible at MEL surface. This preserves FDR-MEL-068.

### 9.2 Standard Effects

#### 9.2.1 Array Effects

**Note:** Array effects work on `Array<T>` types only.

> **v0.7.0 note:** `Record<string, T>` is forbidden in state fields (E046) and action input (E046). The primary entity collection pattern is `Array<T>` with entity primitives (§9.1.10). `record.*` effects are retained for platform-owned namespaces (`$host.*`, `$mel.*`) and for Host-level operations, but domain code should prefer `Array<T>` + `append`/`updateById`/`removeById`.

```mel
effect array.filter({
  source: <Array>,
  where: <Expression using $item>,
  into: <Path>
})

effect array.map({
  source: <Array>,
  select: <Expression or Object using $item>,
  into: <Path>
})

// ❌ array.reduce is FORBIDDEN (v0.3.3)
// Use sum()/min()/max() for primitive aggregation
// See FDR-MEL-062

effect array.find({
  source: <Array>,
  where: <Expression using $item>,
  into: <Path>
})

effect array.sort({
  source: <Array>,
  by: <Expression using $item>,
  order?: "asc" | "desc",
  into: <Path>
})
```

**Sort Determinism (v0.2.3 Normative):**

`array.sort` has fully deterministic semantics. See FDR-MEL-038.

```
SORT RULES:

1. ALGORITHM: Stable sort (equal elements preserve original order)

2. COMPARISON:
   - number: Numeric comparison
   - string: Lexicographic (Unicode code point order)
   - boolean: false < true
   - Mixed types: COMPILE ERROR or RUNTIME ERROR

3. NULL/NaN HANDLING:
   - null values sort LAST (after all non-null values)
   - NaN: Greater than all numbers, less than null
   - Order: -Infinity < ... < 0 < ... < +Infinity < NaN < null

4. ORDER PARAMETER:
   - "asc" (default): Ascending as described above
   - "desc": Reverse (null still last)
```

**Examples:**
```mel
// Numbers with null
[3, null, 1, 2] sorted by $item → [1, 2, 3, null]

// With NaN  
[3, NaN, 1, null] sorted by $item → [1, 3, NaN, null]

// Descending
[3, 1, null, 2] sorted by $item desc → [3, 2, 1, null]

// Stable sort (equal elements)
[{v:1, id:"a"}, {v:1, id:"b"}] sorted by $item.v → [{v:1, id:"a"}, {v:1, id:"b"}]
```

```mel
effect array.every({
  source: <Array>,
  where: <Expression using $item>,
  into: <Path>
})

effect array.some({
  source: <Array>,
  where: <Expression using $item>,
  into: <Path>
})

effect array.flatMap({
  source: <Array>,
  select: <Expression using $item that produces Array>,
  into: <Path>
})

effect array.groupBy({
  source: <Array>,
  by: <Expression using $item>,
  into: <Path>
})

effect array.unique({
  source: <Array>,
  by?: <Expression using $item>,
  into: <Path>
})

effect array.partition({
  source: <Array>,
  where: <Expression using $item>,
  pass: <Path>,    // Elements where condition is true (v0.2.5)
  fail: <Path>     // Elements where condition is false (v0.2.5)
})
```

**v0.2.5 Note:** `partition` uses top-level `pass` and `fail` parameters, not `into: { pass, fail }`. This maintains consistency with the "write targets are Path" rule. See FDR-MEL-047.

#### 9.2.2 Effect Composition Rules (Normative)

**Effects MUST NOT be nested.** Effects are statements, not expressions.

```mel
// ❌ FORBIDDEN: Effect inside Effect
effect array.map({
  source: teams,
  select: {
    filtered: effect array.filter({ ... })  // SyntaxError!
  },
  into: result
})

// ✅ REQUIRED: Sequential Effects
effect array.flatMap({
  source: teams,
  select: $item.members,
  into: allMembers
})

effect array.filter({
  source: allMembers,
  where: gt($item.weight, 80),
  into: heavyMembers
})
```

**Rationale:**
- `$item` scope is always unambiguous (current effect's source)
- Each step appears in Trace independently
- Host can optimize each effect separately

#### 9.2.3 Record Effects (v0.2.2)

**v0.2.2:** Record-specific effects for `Record<K,V>` types. Use these instead of Array effects for Record collections. See FDR-MEL-028.

```mel
// Extract keys/values/entries
effect record.keys({
  source: <Record<K, V>>,
  into: <Path>                    // Array<K>, lexicographically sorted
})

effect record.values({
  source: <Record<K, V>>,
  into: <Path>                    // Array<V>, in key order
})

effect record.entries({
  source: <Record<K, V>>,
  into: <Path>                    // Array<{ key: K, value: V }>, in key order
})

// Filter/map while preserving Record structure
effect record.filter({
  source: <Record<K, V>>,
  where: <Expression using $item>,  // $item is V
  into: <Path>                      // Record<K, V>
})

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

**Deterministic Semantics (v0.2.2):**
- `record.keys`: Returns keys in **lexicographic order** (Unicode code point)
- `record.values` / `record.entries`: Follow key order
- This ensures same input → same output on any host

**Example:**
```mel
action processOrders() {
  // Step 1: Filter high-value orders (keep Record structure)
  once(step1) {
    patch step1 = $meta.intentId
    effect record.filter({
      source: orders,
      where: gt($item.total, 1000),
      into: highValueOrders
    })
  }
  
  // Step 2: Extract for array processing
  once(step2) when isNotNull(highValueOrders) {
    patch step2 = $meta.intentId
    effect record.entries({
      source: highValueOrders,
      into: orderEntries
    })
  }
}
```

#### 9.2.4 I/O Effects

```mel
effect api.fetch({
  url: <string>,
  method?: <string>,
  headers?: <Record>,
  body?: <any>,
  into: <Path>
})

effect db.query({
  collection: <string>,
  query: <Record>,
  into: <Path>
})
```

**Effect Result Contract (v0.2.2):**

Effects write results via `set` patch. Failures are standard error structures:

```mel
// Success: into path receives the result directly
// Failure: into path receives error structure
{
  $error: true,
  code: string,      // "NETWORK_ERROR", "TIMEOUT", "NOT_FOUND", etc.
  message: string,
  details?: any
}

// Checking for errors
when and(isNotNull(result), not(result.$error)) {
  // Success handling
}
when and(isNotNull(result), result.$error) {
  // Error handling: result.code, result.message available
}
```

### 9.3 System Values (v0.3.0)

**v0.3.0 CRITICAL: System values are IO operations, lowered to effects by the compiler.**

See §10 for complete system value semantics.

| Path | Type | Nature | Allowed In |
|------|------|--------|------------|
| `$system.time.now` | `number` | **IO (effect)** | Action body only |
| `$system.uuid` | `string` | **IO (effect)** | Action body only |
| `$system.random` | `number` | **IO (effect)** | Action body only |
| `$system.env.<name>` | `string \| null` | **IO (effect)** | Action body only |
| `$input.<field>` | `any` | Pure | Action body only |
| `$meta.actor` | `string` | Pure | Action body only |
| `$meta.authority` | `string` | Pure | Action body only |
| `$meta.intentId` | `string` | Pure | Action body only |
| `$item` | `T` | Pure (in effect) | Effect sub-expressions |

**v0.3.3:** `$acc` is removed. `reduce` is forbidden. See FDR-MEL-062.

#### 9.3.1 System Values as Effects (v0.3.0)

**Key change from v0.2.x:** `$system.*` values are no longer "magic expressions" but are lowered to `system.get` effects.

```
v0.2.x (BROKEN):
  $system.uuid appears as expression
  → Unclear where value comes from
  → Core purity violated
  → Multiple accesses = different values (confusing)

v0.3.0 (CORRECT):
  $system.uuid in source
  → Compiler inserts: effect system.get({ key: "uuid", into: _slot })
  → Host executes effect, patches Snapshot
  → Core reads from Snapshot (pure!)
  → Multiple accesses = same value (deduplicated)
```

**Developer experience unchanged:**
```mel
// Developer writes (same as v0.2.x):
action create(title: string) {
  once(creating) {
    patch creating = $meta.intentId
    patch tasks[$system.uuid] = {
      id: $system.uuid,        // Same value as key!
      title: title,
      createdAt: $system.time.now
    }
  }
}

// Compiler lowers to:
// 1. Insert system.get effects for uuid and time.now
// 2. Rewrite $system.* → state slot access
// 3. Add dependencies to guards
// See §11 for complete lowering rules
```

#### 9.3.2 Scope Restrictions

| Context | `$system.*` | `$meta.*` | `$input.*` | `$item` |
|---------|-------------|-----------|------------|---------|
| Action body | ✅ | ✅ | ✅ | ❌ |
| Computed | ❌ **ERROR** | ❌ **ERROR** | ❌ **ERROR** | ❌ |
| State init | ❌ **ERROR** | ❌ **ERROR** | ❌ **ERROR** | ❌ |
| Available | ❌ **ERROR** | ❌ **ERROR** | ❌ **ERROR** | ❌ |
| Effect sub-expr | ✅ | ✅ | ✅ | ✅ |

> **v0.7.0 clarification:** `$meta.*` and `$input.*` require an active Intent context. Computed expressions, state initializers, and `available` conditions are evaluated without an Intent (e.g., at UI render time). Only state and computed references are permitted in those contexts.

```mel
// ❌ COMPILE ERROR: $system.* in computed
computed now = $system.time.now
// Error E001: System values cannot be used in computed expressions

// ❌ COMPILE ERROR: $system.* in state init
state { id: string = $system.uuid }
// Error E002: System values cannot be used in state initializers

// ✅ CORRECT: Acquire in action, use elsewhere
state { lastUpdated: number = 0 }       // 0 = not yet updated
computed hasBeenUpdated = gt(lastUpdated, 0)

action update() {
  onceIntent {
    patch lastUpdated = $system.time.now  // Acquired in action
  }
}
```

#### 9.3.3 Deduplication (v0.3.0)

**Same `$system.<key>` in same action = same value.**

```mel
// ✅ v0.3.0: Both $system.uuid references use same value
patch tasks[$system.uuid] = {
  id: $system.uuid,  // Guaranteed same as key
  title: title
}

// Compiler allocates ONE state slot, ONE effect
// Both references → same slot
```

**Comparison with v0.2.x:**

| Pattern | v0.2.x Result | v0.3.0 Result |
|---------|--------------|---------------|
| `key: $system.uuid, id: $system.uuid` | Different UUIDs | Same UUID |
| Intermediate state needed? | Yes (workaround) | No |
| Mental model | "Fresh per access" | "Acquired once, reused" |

#### 9.3.4 Replay Semantics (v0.3.0, corrected v0.7.0)

**System values are in Snapshot. Replay = same Snapshot.**

The gating mechanism for replay is the **intent marker**, not `isNull(value_slot)`. This is critical — using `isNull` creates a stale value bug where a previous intent's non-null slot prevents fresh acquisition on a new intent (see §11.4, FDR-MEL-056).

```
First Execution (Intent "intent-A"):
  1. once guard: neq(marker, $meta.intentId)
     → neq(null, "intent-A") = true → ENTER
  2. patch marker = $meta.intentId  // marker = "intent-A"
  3. effect system.get({ key: "uuid", into: _slot })
  4. Host executes, Snapshot._slot = "abc-123"
  5. Original logic uses _slot = "abc-123"

Replay (same Intent "intent-A"):
  1. Load Snapshot (marker = "intent-A", _slot = "abc-123")
  2. once guard: neq(marker, $meta.intentId)
     → neq("intent-A", "intent-A") = false → SKIP
  3. Original logic uses _slot = "abc-123"
  4. IDENTICAL output ✓

New Intent "intent-B":
  1. Load Snapshot (marker = "intent-A", _slot = "abc-123")
  2. once guard: neq(marker, $meta.intentId)
     → neq("intent-A", "intent-B") = true → ENTER (fresh acquisition!)
  3. patch marker = $meta.intentId  // marker = "intent-B"
  4. effect system.get({ key: "uuid", into: _slot })
  5. Host executes, Snapshot._slot = "xyz-789" (NEW value)
```

**No separate trace mechanism.** System values live in Snapshot. Readiness is always `eq(intent_marker, $meta.intentId)`, never `isNotNull(value_slot)`.

---

## 10. System Values (v0.3.0)

This section provides the complete specification for system value semantics introduced in v0.3.0. See FDR-MEL-049 through FDR-MEL-054.

### 10.1 Core Principle

```
AXIOM: All information flows through Snapshot.
COROLLARY: System values are IO. IO enters Core only via Snapshot.
THEREFORE: $system.* must be Effects, not expressions.

Core remains PURE. All IO is mediated by Host via Effects.
```

### 10.2 The system.get Effect

**Definition:**

```typescript
/**
 * effect system.get
 * 
 * Retrieves a system-provided value and stores it in Snapshot.
 * This is the ONLY way system values enter Core computation.
 */
effect system.get({
  key: StringLiteral,    // Compile-time known, dot-notation
  into: Path             // Snapshot write destination
})
```

**Properties:**

| Property | Requirement |
|----------|-------------|
| Key format | Dot-notation string literal (e.g., `"uuid"`, `"time.now"`) |
| Result type | Depends on key; Host contract defines per key |
| Idempotency | NOT idempotent; each execution may produce new value |
| Guard requirement | MUST be inside `when` or `once` guard |

### 10.3 Standard Keys (Normative)

| Key | Type | Description | Example Value |
|-----|------|-------------|---------------|
| `"uuid"` | `string` | Fresh UUIDv4 | `"550e8400-e29b-41d4-a716-446655440000"` |
| `"time.now"` | `number` | Current timestamp (ms since epoch) | `1704067200000` |
| `"random"` | `number` | Random number in [0, 1) | `0.7234...` |
| `"env.<name>"` | `string \| null` | Environment variable | `"production"` |

**Extensibility:**

- Hosts MAY define additional keys
- Unknown keys result in `null`
- New system values = new keys, not new effects (FDR-MEL-050)

### 10.4 Surface Syntax

Developers write `$system.*` as syntactic sugar:

```mel
$system.uuid        // Sugar for system.get({ key: "uuid", ... })
$system.time.now    // Sugar for system.get({ key: "time.now", ... })
$system.random      // Sugar for system.get({ key: "random", ... })
$system.env.NODE_ID // Sugar for system.get({ key: "env.NODE_ID", ... })
```

**The compiler MUST lower these to `system.get` effects.** See §11.

### 10.5 Deduplication Rules

```
DEDUPLICATION SCOPE:

1. SAME action, SAME key → ONE effect, ONE state slot
   $system.uuid + $system.uuid in action A → one slot

2. SAME action, DIFFERENT keys → SEPARATE effects
   $system.uuid + $system.time.now in action A → two slots

3. DIFFERENT actions → SEPARATE effects
   $system.uuid in action A + $system.uuid in action B → two slots
   (Per-action isolation)

4. SAME action, SAME key, DIFFERENT intents → DIFFERENT values
   (Per-intent fresh, but deduplicated within intent)
```

### 10.6 Host Contract

**Handler Interface:**

```typescript
interface SystemGetHandler {
  /**
   * Resolve a system value request.
   * 
   * @param key - The requested key (e.g., "uuid", "time.now")
   * @returns The resolved value, or null if unknown
   */
  resolve(key: string): SystemValue | null;
}

type SystemValue = string | number | boolean | null;
```

**Host Requirements:**

1. Implement standard keys (uuid, time.now, random)
2. Document additional supported keys
3. Return consistent types per key
4. Patch results into Snapshot via effect resolution

### 10.7 Replay Guarantee (v0.3.1)

```
REPLAY MODEL:

  System values are patched into Snapshot.
  Snapshot IS the complete truth (for system value replay).
  Replay = provide same Snapshot + same Intent → identical output.

GUARANTEE:
  compute(Snapshot₁, Intent₁) at T₁ = compute(Snapshot₁, Intent₁) at T₂
  
  Because:
  - System value intent markers match current intentId
  - Acquisition guards: once(intent_marker) already satisfied
  - Readiness: eq(intent_marker, $meta.intentId) = true
  - Effects are SKIPPED
  - Core reads existing values

NEW INTENT (Intent₂) with same Snapshot:
  - Readiness: eq(intent_marker, $meta.intentId) = false
  - User logic blocked
  - Acquisition effects fire (per-intent fresh)
  - New values patched to Snapshot

Note: This guarantees system value replay via Snapshot,
not elimination of all compute tracing. General tracing
for debugging/observability remains valid.
```

---

## 11. Compiler Lowering (v0.3.1)

This section specifies how the compiler transforms `$system.*` references into `system.get` effects.

**Architecture Review Status: GO** — This transformation is certified safe to implement (FDR-MEL-057).

### 11.1 Lowering Algorithm (v0.3.1, unified v0.7.0)

All compiler-generated system value state lives under the `$mel` platform namespace. This namespace is platform-owned, opaque to Core (SCHEMA-RESERVED-1), excluded from World hash, and automatically managed by the SDK/App layer.

**Canonical path structure:**

```
$mel.guards.intent.<guardId>         — onceIntent guard markers (§4.7.1)
$mel.sys.<action>.<key>.value        — system value slots
$mel.sys.<action>.<key>.intent       — system acquisition intent markers
```

**Algorithm:**

```
FOR each action A in domain:
  
  1. SCAN action body for $system.<key> references
  
  2. FOR each unique key K found:
     a. ALLOCATE value slot:     $mel.sys.<A>.<K-normalized>.value
     b. ALLOCATE intent marker:  $mel.sys.<A>.<K-normalized>.intent
     c. GENERATE acquisition effect (per-intent fresh):
        once($mel.sys.<A>.<K>.intent) {
          patch $mel.sys.<A>.<K>.intent = $meta.intentId
          effect system.get({ key: "<K>", into: $mel.sys.<A>.<K>.value })
        }
  
  3. REWRITE all $system.<K> references → $mel.sys.<A>.<K>.value
  
  4. ADD readiness conditions to original guards:
     - For each $system.<K> used in guard body:
       - Add: eq($mel.sys.<A>.<K>.intent, $meta.intentId)
```

### 11.2 Slot Naming Convention (v0.3.1, unified v0.7.0)

All compiler-generated system slots live under `$mel.sys`. No `__sys__` prefix is used at domain state top-level.

```
CANONICAL PATHS:

Value slot:     $mel.sys.<action>.<key-normalized>.value
Intent marker:  $mel.sys.<action>.<key-normalized>.intent

Key normalization:
  - Dots → underscores
  - "uuid" → "uuid"
  - "time.now" → "time_now"
  - "env.NODE_ID" → "env_NODE_ID"

Examples:
  $system.uuid in addTask:
    - Value:  $mel.sys.addTask.uuid.value
    - Intent: $mel.sys.addTask.uuid.intent
  $system.time.now in addTask:
    - Value:  $mel.sys.addTask.time_now.value
    - Intent: $mel.sys.addTask.time_now.intent
```

> **v0.7.0 note:** The `__sys__` prefix (A26) is superseded. All compiler-generated state now lives under `$mel.*`. E004 is retained for backward compatibility but its scope is expanded: user identifiers MUST NOT start with `$` (existing rule) or `__sys__` (legacy compatibility).

### 11.3 Complete Lowering Example (v0.7.0)

**Source (what developer writes):**

```mel
domain TaskManager {
  type Task = { id: string, title: string, createdAt: number }

  state {
    tasks: Array<Task> = []
  }
  
  action addTask(title: string) {
    onceIntent when neq(trim(title), "") {
      patch tasks = append(tasks, {
        id: $system.uuid,
        title: title,
        createdAt: $system.time.now
      })
    }
  }
}
```

**Lowered (what compiler produces):**

```mel
domain TaskManager {
  type Task = { id: string, title: string, createdAt: number }

  state {
    tasks: Array<Task> = []
    // Domain state only. All compiler-generated slots are in $mel.* (platform-owned).
  }
  
  action addTask(title: string) {
    // Phase 1: Acquire $system.uuid (per-intent fresh)
    // System acquisition slots: $mel.sys.<action>.<key>.*
    once($mel.sys.addTask.uuid.intent) {
      patch $mel.sys.addTask.uuid.intent = $meta.intentId
      effect system.get({ key: "uuid", into: $mel.sys.addTask.uuid.value })
    }
    
    // Phase 2: Acquire $system.time.now (per-intent fresh)
    once($mel.sys.addTask.time_now.intent) {
      patch $mel.sys.addTask.time_now.intent = $meta.intentId
      effect system.get({ key: "time.now", into: $mel.sys.addTask.time_now.value })
    }
    
    // Phase 3: Original logic with READINESS conditions
    // onceIntent guard marker: $mel.guards.intent.<guardId>
    once($mel.guards.intent.addTask_0_intent) 
      when and(
        eq($mel.sys.addTask.uuid.intent, $meta.intentId),
        eq($mel.sys.addTask.time_now.intent, $meta.intentId),
        neq(trim(title), "")
      ) {
      patch $mel.guards.intent.addTask_0_intent = $meta.intentId
      patch tasks = append(tasks, {
        id: $mel.sys.addTask.uuid.value,
        title: title,
        createdAt: $mel.sys.addTask.time_now.value
      })
    }
  }
}
```

**Canonical `$mel` structure after lowering:**

```
$mel
├── guards
│   └── intent
│       └── addTask_0_intent: <intentId>    ← onceIntent guard marker
└── sys
    └── addTask
        ├── uuid
        │   ├── value: "abc-123"             ← acquired system value
        │   └── intent: <intentId>           ← acquisition marker
        └── time_now
            ├── value: 1711234567890
            └── intent: <intentId>
```

> **Note:** All `$mel.*` slots are platform-owned. They are exempt from domain FieldSpec type restrictions (§5.6.2) because Core treats `$`-prefixed namespaces as opaque (SCHEMA-RESERVED-1). Nullable values in `$mel.*` are permitted. Guard markers (`$mel.guards`) and system values (`$mel.sys`) are deliberately separated into distinct subtrees.

### 11.4 Guard Insertion Rules (v0.3.1)

**CRITICAL: Readiness is `eq(intent_marker, $meta.intentId)`, NOT `isNotNull(value_slot)`.**

```
GUARD RULES:

1. Acquisition effects use once(<intent_marker>) with NO extra condition
   - This ensures per-intent fresh acquisition
   - Marker patch is first statement (FDR-MEL-044)

2. User guards get READINESS conditions added:
   - eq(<intent_marker>, $meta.intentId) for each system value used
   - This blocks execution until THIS intent's values are acquired

3. NO isNull/isNotNull on value slots in guards
   - value slots can be null for env.* keys
   - isNotNull would cause stale value bugs (see below)

WHY eq(intent, $meta.intentId) instead of isNotNull(value)?

  PROBLEM with isNotNull(value):
    Intent #1: system.get → value = "abc-123"
    Intent #2: value is still "abc-123" (non-null)
             → isNotNull(value) = true
             → User logic executes with STALE value!

  SOLUTION with eq(intent, $meta.intentId):
    Intent #1: system.get → intent = "intent-1", value = "abc-123"
    Intent #2: eq("intent-1", "intent-2") = false
             → User logic blocked until new acquisition
             → system.get → intent = "intent-2", value = "xyz-789"
             → User logic executes with FRESH value ✓
```

### 11.5 Dependency Ordering

System effects are independent; they don't depend on each other:

```
ORDER: By first occurrence in source (left-to-right, top-to-bottom)

Example:
  patch tasks = append(tasks, { id: $system.uuid, createdAt: $system.time.now })
  
  First:  $system.uuid     → $mel.sys.addTask.uuid.intent/value
  Second: $system.time.now → $mel.sys.addTask.time_now.intent/value
  
  Generated effects (independent, no inter-dependency):
    once($mel.sys.addTask.uuid.intent) { ... }
    once($mel.sys.addTask.time_now.intent) { ... }
  
  Original guard readiness:
    when and(
      eq($mel.sys.addTask.uuid.intent, $meta.intentId),
      eq($mel.sys.addTask.time_now.intent, $meta.intentId),
      <original conditions>
    )
```

### 11.6 Compile Errors

| Code | Condition | Message |
|------|-----------|---------|
| **E001** | `$system.*` in computed | `System values cannot be used in computed expressions. System values are IO operations that must be acquired in actions.` |
| **E002** | `$system.*` in state init | `System values cannot be used in state initializers. State defaults must be pure, deterministic values.` |
| **E003** | `$system` without path | `Invalid system value reference. Use $system.<key> format.` |
| **E004** | User identifier starts with `$` or `__sys__` | `Identifiers starting with $ are reserved for platform namespaces. __sys__ is reserved for backward compatibility.` |

### 11.7 IR Representation

**System values in IR transition through two stages:**

```typescript
// Stage 1: MEL Canonical IR (before system lowering)
// sys node — triggers lowering
{ kind: 'sys', path: ['system', 'uuid'] }

// Stage 2: MEL Canonical IR (after system lowering, before MEL→Core boundary)
// Rewritten to get with MEL PathNode segments — still MEL IR
{ kind: 'get', path: [{ kind: 'prop', name: '$mel' }, { kind: 'prop', name: 'sys' },
  { kind: 'prop', name: 'addTask' }, { kind: 'prop', name: 'uuid' },
  { kind: 'prop', name: 'value' }] }

// Stage 3: Core Runtime IR (after MEL→Core lowering boundary — §17.3)
// Core get uses string path (FDR-MEL-064)
{ kind: 'get', path: '$mel.sys.addTask.uuid.value' }
```

The `sys` node with `path: ['system', ...]` triggers system lowering (Stage 1→2). The MEL→Core lowering boundary (§17.3.3) then converts MEL PathNode segments to Core's dot-joined string path (Stage 2→3).

---

## 12. Architecture Review (v0.3.1)

This section documents the architecture review that certifies MEL v0.3.1 as safe to implement.

### 12.1 Review Questions

The Language & Runtime Architect verified the following:

| Question | Verdict | Evidence |
|----------|---------|----------|
| Is the readiness rule `eq(intent, $meta.intentId)` sufficient? | ✅ YES | All scenarios traced, edge cases verified |
| Any IO leak paths into Core? | ✅ NONE | All paths enumerated and blocked |
| Host Contract preserved? | ✅ YES | Re-entry, determinism, replay verified |
| Simpler correct model exists? | ✅ NO | Alternatives analyzed and rejected |

### 12.2 Readiness Rule Verification

**All execution scenarios:**

| Scenario | `$mel.sys.*.intent` | `$meta.intentId` | Acquisition | Readiness | Result |
|----------|---------------------|------------------|-------------|-----------|--------|
| First compute (i1) | `null` | `"i1"` | fires | N/A | Effect executes |
| Second compute (i1) | `"i1"` | `"i1"` | skip | ✅ true | User logic runs |
| New intent (i2) | `"i1"` | `"i2"` | fires | ❌ false | Fresh acquisition |
| Replay (i1) | `"i1"` | `"i1"` | skip | ✅ true | Deterministic |

**Edge cases verified:**

1. **`env.*` returning `null`**: Handled correctly (readiness depends on intent marker, not value)
2. **Concurrent effects**: Independent execution, Host can parallelize
3. **Intent marker double-duty**: `once(intent_marker)` + readiness check is correct

### 12.3 IO Leak Path Analysis

| Path | Status | Mechanism |
|------|--------|-----------|
| `$system.*` in action | ✅ Safe | Lowered to effect → Snapshot |
| `$system.*` in computed | ✅ Blocked | Compile error E001 |
| `$system.*` in state init | ✅ Blocked | Compile error E002 |
| User defines `$`-prefixed or `__sys__*` | ✅ Blocked | Compile error E004 |
| `$meta.*` / `$input.*` | ✅ Safe | Pure values from Intent (action body only — forbidden in computed/available/state init) |

### 12.4 Host Contract Verification

```
Re-entry Safety: ✅
  - All mutations guarded by once()
  - Acquisition is idempotent per-intent
  - No infinite loops possible

Determinism: ✅
  - Same Snapshot + Same Intent → Same Output
  - All state in Snapshot
  - No external dependencies

Replayability: ✅
  - Snapshot contains all system values
  - Guards prevent re-acquisition
  - No external trace needed
```

### 12.5 Architectural Invariants

```
INVARIANT 1: Core Purity
  System values are IO → IO is Effect → Host executes Effects
  → Results enter Core ONLY via Snapshot → Core remains pure
  STATUS: ✅ VERIFIED

INVARIANT 2: Per-Intent Freshness
  Each intent gets fresh system values
  → Values from previous intents cannot leak
  → Readiness guards enforce this
  STATUS: ✅ VERIFIED

INVARIANT 3: Snapshot Sufficiency
  Snapshot contains all information needed for replay
  → No separate trace mechanism required
  STATUS: ✅ VERIFIED
```

### 12.6 Certification

```
┌─────────────────────────────────────────────────────────────────┐
│                ARCHITECTURE REVIEW CERTIFICATION                 │
│                                                                  │
│  Document:     MEL SPEC v0.3.1                                   │
│  Component:    System Value Semantics & Compiler Lowering        │
│  Date:         2026-01-01                                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │           CERTIFIED: SAFE TO IMPLEMENT                   │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  The architecture is internally consistent.                      │
│  No fatal contradictions exist.                                  │
│  All invariants are verifiable.                                  │
│  Implementation may proceed.                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Flow Control (v0.3.3)

This section specifies new flow control constructs that align MEL with Core's FlowNode and ActionSpec capabilities.

### 13.1 Action Availability (available)

Actions MAY have an availability condition that determines whether the action can be invoked.

#### Syntax

```ebnf
ActionDecl ::= 'action' Identifier '(' Params? ')' AvailableClause? '{' ActionBody '}'

AvailableClause ::= 'available' 'when' Expr
```

#### Examples

```mel
// Action with availability condition
action withdraw(amount: number) available when gt(balance, 0) {
  once(withdrawing) {
    patch withdrawing = $meta.intentId
    patch balance = sub(balance, amount)
  }
}

// Complex availability condition (state/computed only — no action parameters)
action transfer(to: string, amount: number) 
  available when and(gt(balance, 0), not(frozen)) {
  // Input-dependent validation belongs in the action body:
  when gt(amount, balance) {
    fail "INSUFFICIENT" with "Transfer amount exceeds balance"
  }
  // ...
}

// No availability (always available)
action deposit(amount: number) {
  // ...
}
```

#### Constraints (A28)

The `available when` expression MUST be pure and MUST reference **state/computed only**:

```mel
// ❌ COMPILE ERROR: Effects not allowed in available
action process() available when effect.check() { ... }

// ❌ COMPILE ERROR: $system.* not allowed in available
action process() available when gt($system.time.now, deadline) { ... }

// ❌ COMPILE ERROR: $input / action parameters not allowed in available
//    (availability is checked BEFORE input is known — e.g., UI button enable/disable)
action process(x: number) available when gt($input.x, 0) { ... }
action transfer(amount: number) available when gt(balance, amount) { ... }
//    'amount' is an action parameter, which compiles to $input.amount

// ✅ CORRECT: Pure expression referencing state/computed only
action process() available when and(isReady, not(processing)) { ... }
```

**Why no parameters?** `available` is evaluated **synchronously** by Core/UI/Agent to answer "can this action be invoked right now?" At that point, no specific intent input exists yet. The expression can only reference the current Snapshot (state + computed). Input-dependent validation belongs in the action body via `when`/`fail`.

#### Compilation

```mel
// MEL Source
action withdraw() available when gt(balance, 0) { ... }

// Compiles to ActionSpec (Core SPEC §9)
{
  "available": {
    "kind": "gt",
    "left": { "kind": "get", "path": "balance" },
    "right": { "kind": "lit", "value": 0 }
  },
  "flow": { "kind": "seq", "steps": [ ... ] }
  // No "input" field — withdraw() has no parameters
}
```

#### Use Cases

| Use Case | Example |
|----------|---------|
| UI button enable/disable | `available when gt(balance, 0)` |
| Agent action filtering | "What can I do?" → filter by available |
| Business rule enforcement | `available when and(isAdmin, not(locked))` |

---

### 13.2 Fail Statement (fail)

The `fail` statement terminates the flow with an error. Errors are values, not effects (A29).

#### Syntax

```ebnf
FailStmt ::= 'fail' StringLiteral FailMessage?

FailMessage ::= 'with' Expr
```

#### Examples

```mel
action createUser(email: string) {
  // Simple fail
  when isNull(email) {
    fail "MISSING_EMAIL"
  }
  
  // Fail with message
  when not(isValidEmail(email)) {
    fail "INVALID_EMAIL" with "Email format is invalid"
  }
  
  // Fail with dynamic message
  when isNotNull(users[email]) {
    fail "DUPLICATE_EMAIL" with concat("Email already exists: ", email)
  }
  
  once(creating) {
    patch creating = $meta.intentId
    patch users[$system.uuid] = { email: email }
  }
}
```

#### Constraints

1. **Must be guarded**: `fail` must appear inside `when` or `once`

```mel
// ❌ COMPILE ERROR: Unguarded fail
action validate() {
  fail "ALWAYS_FAILS"
}

// ✅ CORRECT: Guarded fail
action validate() {
  when isNull(input) {
    fail "MISSING_INPUT"
  }
}
```

2. **Not an Effect**: `fail` is a FlowNode, not an Effect

```mel
// ❌ WRONG conceptual model (NOT how MEL works)
effect validation.fail({ code: "ERROR" })  // This is NOT fail

// ✅ CORRECT: fail is a flow control statement
when invalid {
  fail "ERROR_CODE" with "message"
}
```

#### Compilation

```mel
// MEL Source
fail "MISSING_EMAIL" with "Email is required"

// Compiles to FlowNode
{
  "kind": "fail",
  "code": "MISSING_EMAIL",
  "message": "Email is required"
}
```

#### Semantics

| Aspect | Behavior |
|--------|----------|
| Flow termination | Immediate — subsequent statements don't execute |
| Snapshot | Error recorded: `{ error: { code, message } }` |
| Core decision | Core decides to fail, Host not involved |
| Trace | "Flow failed" is first-class event |

---

### 13.3 Stop Statement (stop)

The `stop` statement terminates the flow successfully with no action taken. It means "early exit," NOT "waiting" (A30).

#### Syntax

```ebnf
StopStmt ::= 'stop' StringLiteral
```

#### Examples

```mel
action processPayment(orderId: string) {
  // Early exit if already processed
  when isNotNull(orders[orderId].paidAt) {
    stop "Already processed"
  }
  
  // Early exit if nothing to do
  when eq(orders[orderId].total, 0) {
    stop "No payment needed"
  }
  
  once(processing) {
    patch processing = $meta.intentId
    patch orders[orderId].paidAt = $system.time.now
  }
}
```

#### stop vs fail

| Aspect | `stop` | `fail` |
|--------|--------|--------|
| Meaning | "Nothing to do" (success) | "Cannot proceed" (error) |
| Snapshot | No error recorded | Error recorded |
| Use case | Idempotency, skip | Validation failure |
| Example | "Already processed" | "Invalid input" |

```mel
action setTaskCompleted(id: string, completed: boolean) {
  // fail: Task doesn't exist (error)
  when isNull(tasks[id]) {
    fail "NOT_FOUND" with concat("Task not found: ", id)
  }
  
  // stop: Already in desired state (success, no-op)
  when eq(tasks[id].completed, completed) {
    stop "Already in desired state"
  }
  
  once(updating) {
    patch updating = $meta.intentId
    patch tasks[id].completed = completed
  }
}
```

#### Constraints

1. **Must be guarded**: `stop` must appear inside `when` or `once`

```mel
// ❌ COMPILE ERROR: Unguarded stop
action process() {
  stop "Always stops"
}

// ✅ CORRECT: Guarded stop
action process() {
  when alreadyDone {
    stop "Already processed"
  }
}
```

2. **No "waiting" semantics**: Messages suggesting "waiting" are lint errors

```mel
// ❌ LINT ERROR: stop message suggests waiting/pending
stop "Waiting for approval"
stop "Pending review"
stop "Awaiting confirmation"
stop "On hold"

// ✅ CORRECT: Early exit semantics
stop "Already processed"
stop "No action needed"
stop "Skipped: condition not met"
stop "Duplicate request ignored"
```

#### Compilation

```mel
// MEL Source
stop "Already processed"

// Compiles to FlowNode (Core's halt)
{
  "kind": "halt",
  "reason": "Already processed"
}
```

Note: MEL uses `stop`, but compiles to Core's `halt` FlowNode.

---

### 13.4 Call Policy (A31)

Core's `call` FlowNode exists but is **NOT exposed in MEL v0.3.3**.

#### What is call?

In Core, `{ kind: 'call', target: 'flowName' }` invokes another named flow. This enables flow reuse.

#### Why Hidden in MEL?

| Reason | Explanation |
|--------|-------------|
| Simplicity | MEL prioritizes flat, readable flows |
| LLM-friendly | No control flow jumps to trace |
| Predictability | Execution is linear within action |

#### Alternatives in MEL

```mel
// Pattern 1: Use computed for shared conditions
computed isValidUser = and(isNotNull(userId), gt(len(userId), 0))

action createPost() {
  when not(isValidUser) {
    fail "INVALID_USER"
  }
  // ...
}

action createComment() {
  when not(isValidUser) {
    fail "INVALID_USER"
  }
  // ...
}

// Pattern 2: Duplicate validation logic (acceptable for clarity)
action createPost() {
  when isNull(userId) {
    fail "MISSING_USER"
  }
  // ...
}
```

#### Realized: `flow` + `include` (v0.7.0 — ADR-013a)

The future path described above is now realized in v0.7.0. See §4.7.3–4.7.5 for the full specification.

```mel
// v0.7.0: This is now normative syntax
flow requireTask(taskId: string) {
  when isNull(at(taskIndex, taskId)) {
    fail "NOT_FOUND" with concat("Task not found: ", taskId)
  }
}

action softDeleteTask(id: string) {
  include requireTask(id)   // Compile-time inline, no FlowNode call
  onceIntent { /* ... */ }
}
```

`include` follows the same Snapshot composition direction as Core `call` but produces no FlowNode `{ kind: 'call' }` in the output IR. It is a compiler-only form.

---

### 13.5 Flow Control Summary

| Statement | Purpose | FlowNode | Guarded? |
|-----------|---------|----------|----------|
| `available when <Expr>` | Action precondition | N/A (ActionSpec) | N/A |
| `fail "CODE" with "msg"` | Error termination | `{ kind: 'fail' }` | Required |
| `stop "reason"` | Early exit (success) | `{ kind: 'halt' }` | Required |
| `call` | Flow invocation | `{ kind: 'call' }` | **Hidden** (Core only) |
| `flow` / `include` | Statement composition | None (compile-time) | N/A (v0.7.0) |

### 13.6 Compile Errors

```
E005: available expression must be pure (state/computed only).
      Effects, $system.*, $meta.*, $input.*, and action parameters are
      not allowed in available conditions. Available is evaluated pre-Intent
      by UI/Agent — only Snapshot-derived values (state, computed) are accessible.

E006: fail must be inside a guard (when, once, or onceIntent).
      Unconditional fail is likely a mistake.

E007: stop must be inside a guard (when, once, or onceIntent).
      Unconditional stop is likely a mistake.

E008: stop message suggests waiting/pending.
      Use "Already processed" style, not "Waiting for..." style.
      stop is early-exit, not workflow suspension.

E009: Primitive aggregation only allowed in computed.
      sum(), min(), max() cannot be used in action flow.

E010: Primitive aggregation does not allow composition.
      sum(filter(x)) is forbidden. Use intermediate state via Effects.

E011: reduce/fold/scan is forbidden.
      Use sum(), min(), max() for primitive aggregation.
      User-defined accumulation is not allowed.

E012: Anonymous object type in state field.
      Use a named type declaration instead.
      ❌ state { x: { a: number } = { a: 0 } }
      ✅ type X = { a: number }
         state { x: X = { a: 0 } }

// ─── v0.7.0: flow/include (ADR-013a) ───

E013: Circular include detected.
      flow A includes flow B which includes flow A.

E014: Include expansion depth exceeds limit (16).
      Simplify flow composition.

E015: Include target is not a declared flow.
      'include nonExistent()' — 'nonExistent' is not a flow.

E016: Include not allowed in InnerStmt position.
      'include' can only appear at action or flow body top-level (GuardedStmt position).

E017: once() not allowed in flow (v1).
      Flows are guard+fail/stop only. Use once()/onceIntent in the action body.

E018: onceIntent not allowed in flow (v1).
      Same rationale as E017.

E019: patch not allowed in flow (v1).
      Flows are guard+fail/stop only.

E020: effect not allowed in flow (v1).
      Flows are guard+fail/stop only.

E021: Flow parameter name conflicts with top-level identifier.
      Parameter 'tasks' conflicts with state field 'tasks'.

E022: Flow and action share the same name.
      flow 'softDeleteTask' conflicts with action 'softDeleteTask'.

E023: Wrong number of arguments for included flow.
      'include requireTask()' — expected 1 argument, got 0.

E024: Include argument type mismatch.
      'include requireTask(123)' — argument 1: expected string, got number.

// ─── v0.7.0: Entity collection primitives (ADR-013b) ───

E030: Collection element type does not have an 'id' field.
      findById(items, key) — type 'Item' has no field 'id'.

E030a: Collection element 'id' field is not a primitive type.
       findById(items, key) — 'id' is type '{ value: string }', expected string or number.

E030b: Duplicate '.id' values detected in state initializer.
       Entity primitives require unique '.id' values (ENTITY-2b).

E031: updateById/removeById not allowed in this context.
      Transform primitives can only be used in patch RHS.

E032: Nested transform primitive.
      updateById(removeById(tasks, id1), id2, ...) — nesting is forbidden.

E033: Transform primitive collection argument is not a state path.
      updateById(activeTasks, ...) — 'activeTasks' is a computed, not a state field.
      First argument must be a state-declared path (no computed names, function calls,
      index access, or sub-expressions).

E034: Transform primitive in guard condition.
      when eq(updateById(...), ...) — not allowed in guard.

E035: Transform primitive in available condition.
      available when updateById(...) — not allowed in available.

// ─── v0.7.0: Computed deps / State init (Core alignment) ───

E040: Circular computed dependency.
      computed a depends on computed b, which depends on computed a.
      The computed dependency graph must be acyclic (DAG).

E041: Computed references undeclared identifier.
      computed x = add(y, 1) — 'y' is not a state field, computed, or action parameter.

E042: State initializer references non-constant value.
      State defaults must be compile-time constants.
      Cannot reference state fields, computed values, $system.*, $meta.*, or $input.*.

E043: Non-trivial union type in state/action-input position.
      'string | number' cannot be soundly lowered to FieldSpec.
      Only literal enum unions ('a' | 'b') and T | null are supported.
      Use a named wrapper type, separate actions, or restructure the type.

E044: Recursive type in state/action-input position.
      Type 'Tree' contains a circular reference and cannot be lowered to FieldSpec.
      Recursive types are valid in 'type' declarations (preserved in DomainSchema.types)
      but cannot be used as state field types or action input types.

E045: Nullable type in state field or action input parameter.
      'string | null' cannot be soundly represented in FieldSpec.
      FieldSpec has no nullable wrapper — required:true rejects null, required:false means absent.
      Use sentinel values, separate fields, or separate actions.

E046: Record type in state field or action input parameter.
      'Record<string, Task>' loses value type when lowered to FieldSpec.
      Use Array<T> with .id field instead (aligns with entity primitives).
```

---

## 14. Examples

### 14.1 Complete Domain Example

```mel
domain TaskManager {
  type Task = {
    id: string,
    title: string,
    completed: boolean,
    createdAt: number
  }

  state {
    tasks: Array<Task> = []
    filter: "all" | "active" | "completed" = "all"
    editingId: string = ""
  }

  // Computed values (pure expressions only)
  computed taskCount = len(tasks)
  computed hasAnyTasks = gt(taskCount, 0)
  computed selectedTask = findById(tasks, editingId)

  // Actions — using onceIntent (no manual markers) and entity primitives
  action addTask(title: string) {
    onceIntent when neq(trim(title), "") {
      patch tasks = append(tasks, {
        id: $system.uuid,
        title: trim(title),
        completed: false,
        createdAt: $system.time.now
      })
    }
  }

  action toggleTask(id: string) {
    when not(existsById(tasks, id)) {
      fail "NOT_FOUND" with concat("Task not found: ", id)
    }
    onceIntent {
      // Note: findById reads current value, updateById writes new value
      patch tasks = updateById(tasks, id, {
        completed: not(findById(tasks, id).completed)
      })
    }
  }

  action deleteTask(id: string) {
    when not(existsById(tasks, id)) {
      fail "NOT_FOUND" with concat("Task not found: ", id)
    }
    onceIntent {
      patch tasks = removeById(tasks, id)
    }
  }

  action clearCompleted() {
    onceIntent {
      effect array.filter({
        source: tasks,
        where: eq($item.completed, false),
        into: tasks
      })
    }
  }

  action setFilter(newFilter: "all" | "active" | "completed") {
    when neq(filter, newFilter) {
      patch filter = newFilter
    }
  }
}
```

### 14.2 Expression Examples

```mel
// Arithmetic
computed total = mul(price, quantity)
computed average = div(total, count)
computed remainder = mod(index, pageSize)

// Comparison (operator style)
computed isAdult = user.age >= 18
computed isMatch = query == user.name

// Comparison (function style)
computed isAdult = gte(user.age, 18)
computed isMatch = eq(query, user.name)

// Logical
computed canProceed = and(isValid, not(isSubmitting))
computed showWarning = or(eq(count, 0), hasError)

// Null handling
computed displayName = coalesce(user.nickname, user.name, "Anonymous")

// Conditional
computed status = isComplete ? "Done" : (isStarted ? "In Progress" : "Pending")
computed greeting = concat("Hello, ", user.name, "!")

// Array/String (function-only)
computed firstTask = first(tasks)
computed taskCount = len(tasks)
computed shortName = substr(name, 0, 10)
computed normalized = lower(trim(input))
```

### 14.3 Action Examples

```mel
// Simple state update
action setName(newName: string) {
  onceIntent {
    patch user.name = trim(newName)
  }
}

// Using once() sugar
action submit() {
  once(submission.startedAt) when form.isValid {
    patch submission.startedAt = $meta.intentId  // MUST be first (FDR-MEL-044)
    patch submission.status = "pending"
    effect api.post({
      url: "/api/submit",
      body: form.data,
      into: submission.result
    })
  }
}

// Multi-step with guards
action checkout() {
  // Step 1: Validate cart
  once(cart.validatedAt) {
    patch cart.validatedAt = $meta.intentId     // MUST be first
    effect validate.cart({
      items: cart.items,
      into: cart.validation
    })
  }

  // Step 2: Process payment (only after validation)
  once(payment.processedAt) when cart.validation.success {
    patch payment.processedAt = $meta.intentId  // MUST be first
    effect payment.process({
      amount: cart.total,
      method: payment.method,
      into: payment.result
    })
  }

  // Step 3: Create order (only after payment)
  once(order.createdAt) when payment.result.success {
    patch order.createdAt = $meta.intentId      // MUST be first
    effect order.create({
      items: cart.items,
      payment: payment.result.id,
      into: order.result
    })
  }
}
```

### 14.4 Effect Examples with $item

**Note (v0.2.1):** All effects must be inside guards. These examples show effect syntax; in real code, wrap in `when` or `once`.

```mel
action filterHighPriority() {
  // Filter active tasks
  once(filtered) {
    patch filtered = $meta.intentId
    effect array.filter({
      source: tasks,
      where: and(eq($item.completed, false), gt($item.priority, 3)),
      into: highPriorityActive
    })
  }
}

action summarizeUsers() {
  // Map to summary objects
  once(summarized) {
    patch summarized = $meta.intentId
    effect array.map({
      source: users,
      select: {
        displayName: coalesce($item.nickname, $item.name),
        isActive: gt($item.lastSeen, threshold)
      },
      into: userSummaries
    })
  }
}

action sortMessages() {
  // Sort by date descending
  once(sorted) {
    patch sorted = $meta.intentId
    effect array.sort({
      source: messages,
      by: $item.timestamp,
      order: "desc",
      into: sortedMessages
    })
  }
}

// ❌ reduce is FORBIDDEN (v0.3.3)
// Use primitive aggregation instead:

type LineItem = {
  price: number
  quantity: number
}

state {
  lineItems: Array<LineItem> = []
  itemTotals: Array<number> = []
}

// ✅ Use map + sum for total calculation
computed orderTotal = sum(itemTotals)

action calculateTotal() {
  once(calculated) {
    patch calculated = $meta.intentId
    effect array.map({
      source: lineItems,
      select: mul($item.price, $item.quantity),
      into: itemTotals
    })
  }
}

action findProduct(targetSku: string) {
  // Find specific item
  once(searched) {
    patch searched = $meta.intentId
    effect array.find({
      source: products,
      where: eq($item.sku, targetSku),
      into: foundProduct
    })
  }
}
```

### 14.5 Composition Effects (flatMap, groupBy)

**v0.2.1 Pattern:** Multi-step pipelines use sequential guards. Each step waits for the previous step's result via `when isNotNull(...)`.

```mel
// ═══════════════════════════════════════════════════════════
// Scenario: Find heavy members (weight > 80) across all teams,
//           grouped by team
// ═══════════════════════════════════════════════════════════

action findHeavyMembersByTeam() {
  // Step 1: Flatten teams into members with team context
  once(step1) {
    patch step1 = $meta.intentId
    effect array.flatMap({
      source: teams,
      select: {
        teamId: $item.id,
        teamName: $item.name,
        member: $item.members
      },
      into: allMembersWithTeam
    })
  }
  
  // Step 2: Filter heavy members (waits for step 1)
  once(step2) when isNotNull(allMembersWithTeam) {
    patch step2 = $meta.intentId
    effect array.filter({
      source: allMembersWithTeam,
      where: gt($item.member.weight, 80),
      into: heavyMembersWithTeam
    })
  }
  
  // Step 3: Group back by team (waits for step 2)
  once(step3) when isNotNull(heavyMembersWithTeam) {
    patch step3 = $meta.intentId
    effect array.groupBy({
      source: heavyMembersWithTeam,
      by: $item.teamId,
      into: result
    })
  }
}

// ═══════════════════════════════════════════════════════════
// Scenario: Get unique categories from all products
// ═══════════════════════════════════════════════════════════

action getUniqueCategories() {
  once(step1) {
    patch step1 = $meta.intentId
    effect array.map({
      source: products,
      select: $item.category,
      into: allCategories
    })
  }
  
  once(step2) when isNotNull(allCategories) {
    patch step2 = $meta.intentId
    effect array.unique({
      source: allCategories,
      into: uniqueCategories
    })
  }
}

// ═══════════════════════════════════════════════════════════
// Scenario: Partition users into active and inactive
// ═══════════════════════════════════════════════════════════

action partitionUsers() {
  once(partitioned) {
    patch partitioned = $meta.intentId
    effect array.partition({
      source: users,
      where: gt($item.lastLoginAt, thirtyDaysAgo),
      pass: activeUsers,
      fail: inactiveUsers
    })
  }
}

// ═══════════════════════════════════════════════════════════
// Scenario: Complex pipeline - guard-mandatory pattern
// ═══════════════════════════════════════════════════════════

action processOrders() {
  // Step 1: Flatten order items
  once(step1) {
    patch step1 = $meta.intentId
    effect array.flatMap({
      source: orders,
      select: {
        orderId: $item.id,
        customerId: $item.customerId,
        item: $item.items
      },
      into: allOrderItems
    })
  }
  
  // Step 2: Filter high-value items (waits for step 1)
  once(step2) when isNotNull(allOrderItems) {
    patch step2 = $meta.intentId
    effect array.filter({
      source: allOrderItems,
      where: gt($item.item.price, 100),
      into: highValueItems
    })
  }
  
  // Step 3: Group by customer (waits for step 2)
  once(step3) when isNotNull(highValueItems) {
    patch step3 = $meta.intentId
    effect array.groupBy({
      source: highValueItems,
      by: $item.customerId,
      into: highValueByCustomer
    })
  }
  
  // Each step is traced independently!
  // Host loop: compute() → execute step1 → compute() → execute step2 → ...
}
```

---

## 15. Migration Guide

### 15.1 From MEL v0.3.1 to v0.3.3

**Key Changes:**

| Aspect | v0.3.1 | v0.3.3 |
|--------|--------|--------|
| Action availability | Not supported | `available when <Expr>` |
| Error handling | Not supported | `fail "CODE" with "msg"` |
| Early exit | Not supported | `stop "reason"` |
| Flow invocation | N/A | `call` hidden (Core only) |

**New Keywords:**

```mel
// v0.3.3 NEW: available, fail, stop
action withdraw() available when gt(balance, 0) {
  when isNull(account) {
    fail "NO_ACCOUNT" with "Account not found"
  }
  
  when eq(balance, 0) {
    stop "Nothing to withdraw"
  }
  
  once(withdrawing) {
    patch withdrawing = $meta.intentId
    patch balance = sub(balance, amount)
  }
}
```

**New Compile Errors:**

```
E005: available expression must be pure (state/computed only).
E006: fail must be inside a guard (when, once, or onceIntent).
E007: stop must be inside a guard (when, once, or onceIntent).
E008: stop message suggests waiting/pending.
```

**Lint Rules:**

```mel
// ❌ LINT ERROR: stop message suggests waiting/pending
stop "Waiting for approval"
stop "Pending review"

// ✅ CORRECT: Early exit semantics
stop "Already processed"
stop "No action needed"
```

**Non-Breaking:** All v0.3.1 code is valid v0.3.3 code. New features are additive.

---

### 15.2 From MEL v0.2.x to v0.3.0

**Key Changes:**

| Aspect | v0.2.x | v0.3.0 |
|--------|--------|--------|
| `$system.uuid` twice | Different values | **Same value** (deduplicated) |
| `$system.*` in computed | Undefined/risky | **Compile error** |
| `$system.*` in state init | Undefined | **Compile error** |
| Intermediate state for UUID | Required | **Not needed** |
| Replay mechanism | Trace + Snapshot | **Snapshot only** |

**Breaking Changes:**

```mel
// ❌ v0.3.0 COMPILE ERROR: $system.* in computed
computed now = $system.time.now

// ✅ v0.3.0: Move to action
state { lastUpdated: number = 0 }
computed hasBeenUpdated = gt(lastUpdated, 0)

action update() {
  onceIntent {
    patch lastUpdated = $system.time.now
  }
}
```

**Simplification (no longer needed):**

```mel
// ⚠ HISTORICAL (v0.2.x): Intermediate state required for UUID reuse
// This pattern used nullable state and Record — both now forbidden (E045, E046).
// state { pendingId: string | null = null }
// action addTask(title: string) {
//   once(step1) when isNull(pendingId) { ... }
//   once(step2) when isNotNull(pendingId) { ... }
// }

// ✅ v0.7.0 current: Array + append + onceIntent
action addTask(title: string) {
  onceIntent when neq(trim(title), "") {
    patch tasks = append(tasks, {
      id: $system.uuid,      // Deduplicated per action (v0.3.0)
      title: trim(title),
      createdAt: $system.time.now
    })
  }
}
```

### 15.3 From MEL v0.2.1 to v0.2.2

| v0.2.1 Syntax | v0.2.2 Syntax |
|---------------|---------------|
| `patch marker = $system.time.now` | `patch marker = $meta.intentId` |
| `if(cond, a, b)` | `cond(condition, a, b)` |
| `` `Hello ${name}` `` | `concat("Hello ", name)` |
| `effect array.filter({ source: record, ...})` | `effect record.filter({ source: record, ...})` |
| `effect object.keys(...)` | `effect record.keys(...)` |

### 15.4 From MEL v0.1/v0.2

| v0.1/v0.2 Syntax | v0.2.2+ Syntax |
|------------------|---------------|
| `user.name.trim()` | `trim(user.name)` |
| `str.toLowerCase()` | `lower(str)` |
| Top-level `patch x = y` | `when cond { patch x = y }` |
| Top-level `effect ...` | `once(marker) { patch marker = $meta.intentId; effect ... }` |
| `once(m) { effect... }` | `once(m) { patch m = $meta.intentId; effect... }` |
| `when items { ... }` | `when gt(len(items), 0) { ... }` |
| `patch x = null` (to delete) | `patch x unset` |
| `len(record)` | `effect record.keys(...); len(keys)` |

### 15.5 From JavaScript/TypeScript

| JS/TS | MEL v0.2.2 |
|-------|------------|
| `const x = expr` | `computed x = expr` |
| `let x = value` | `state { x: type = value }` |
| `x = newValue` | `when cond { patch x = newValue }` |
| `if (c) { ... }` | `when c { ... }` (c must be boolean) |
| `c ? a : b` | `cond(c, a, b)` |
| `arr.filter(x => ...)` | `once(m) { patch m = $meta.intentId; effect array.filter({...}) }` |
| `arr.map(x => ...)` | `once(m) { patch m = $meta.intentId; effect array.map({...}) }` |
| `arr.length` | `len(arr)` (Array only) |
| `str.trim()` | `trim(str)` |
| `str.toLowerCase()` | `lower(str)` |
| `` `Hello ${name}` `` | `concat("Hello ", name)` |
| `await fetch(...)` | `effect api.fetch({ ... })` |
| `Date.now()` | `$system.time.now` |
| `uuid()` | `$system.uuid` |

### 15.6 Common Patterns

#### Variable → State + Computed

```typescript
// JS/TS
let count = 0;
const doubled = count * 2;
count++;
```

```mel
// ⚠ HISTORICAL (v0.2.1): manual once() marker + nullable state
// state { count: number = 0, incrementedAt: string | null = null }
// action increment() {
//   once(incrementedAt) { patch incrementedAt = $meta.intentId; patch count = add(count, 1) }
// }

// ✅ MEL v0.7.0: onceIntent (no manual marker, no nullable)
state { count: number = 0 }

computed doubled = mul(count, 2)

action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}
```

#### Array Operations

```typescript
// JS/TS
const activeUsers = users.filter(u => u.active);
const names = activeUsers.map(u => u.name.toUpperCase());
```

```mel
// MEL v0.2.1: Guard-mandatory pipeline
action computeActiveNames() {
  once(step1) {
    patch step1 = $meta.intentId
    effect array.filter({
      source: users,
      where: eq($item.active, true),
      into: activeUsers
    })
  }
  
  once(step2) when isNotNull(activeUsers) {
    patch step2 = $meta.intentId
    effect array.map({
      source: activeUsers,
      select: { name: upper($item.name) },
      into: names
    })
  }
}
```

---

---

---

## 16. Architecture Decisions

### AD-COMP-LOW-001: Compiler Owns Lowering Boundary

**Decision:** Compiler MUST be the single owner of all lowering from MEL Canonical IR to Core Runtime IR.

### AD-COMP-LOW-002: Compiler Determines Context Per Op-Field

**Decision:** Compiler MUST determine schema/action context per PatchOp field.

**Context Rules (CRIT-08 + R2-3 Fix, clarified v0.7.0):**

| Op Field | Context | sys.system | sys.meta/input | var($item) |
|----------|---------|------------|----------------|------------|
| `addComputed.expr` | schema | ❌ | ❌ | ❌ |
| `addConstraint.rule` | schema | ❌ | ❌ | ❌ |
| `addActionAvailable.expr` | schema | ❌ | ❌ | ❌ |
| `stateDefault` | schema | ❌ | ❌ | ❌ |
| `ActionGuard.condition` | action | ❌* | ✅ | ❌ |
| `ActionStmt.patch.value` | action | ❌* | ✅ | ❌ |
| `ActionStmt.effect.args.*` | action | ❌* | ✅ | **✅** |

> **v0.7.0 clarification:** `sys.meta/input` is forbidden in all schema-context fields (`addComputed`, `addConstraint`, `addActionAvailable`, `stateDefault`). `$meta.*` and `$input.*` require an active Intent context, which does not exist at schema evaluation time. See A28 and §9.3.2.

**$item Scope (R2-3 Fix):**
> `$item` is ONLY allowed in `effect.args.*` (iteration variable for effect parameters).
> Guards and patch values do NOT have access to $item.

**$system Restriction (R1-3 + R2-5 Fix):**
> `$system.*` is forbidden in Translator-evaluation path.
> System values require Flow execution (core.compute) with system.get effect.

### AD-COMP-LOW-003: Expression Evaluation is Total

**Decision:** Expression evaluation MUST be a total function. Invalid operations return null, never throw.

**Rationale (A35):**
> MEL SPEC §6.5: "Expressions do NOT throw. Invalid operations return null."
> Core expects computed values to always resolve.
> Evaluation follows the same principle.

**Semantic Rules:**
- Division by zero → null
- Path not found → null
- Type mismatch (add string to number) → null
- Null property access → null

**Exception:** Only structural errors (UNKNOWN_NODE_KIND, INVALID_SHAPE) may throw, as these indicate implementation bugs, not runtime conditions.

---

## 17. Translator Lowering

### 17.1 IR Definitions

#### 17.1.1 MEL Canonical IR (Input)

> **Normative:** This is the single authoritative definition of MEL Canonical IR expression nodes. §7.2 provides the same type with examples and rationale; in case of conflict, this definition prevails.

```typescript
type MelPrimitive = null | boolean | number | string;
type MelPathSegment = { kind: "prop"; name: string };
type MelPathNode = MelPathSegment[];
type MelSystemPath = string[]; // ["meta","intentId"], ["input","title"]
type MelObjField = { key: string; value: MelExprNode };

type MelExprNode =
  | { kind: "lit"; value: MelPrimitive }
  | { kind: "var"; name: "item" }
  | { kind: "sys"; path: MelSystemPath }
  | { kind: "get"; base?: MelExprNode; path: MelPathNode }
  | { kind: "field"; object: MelExprNode; property: string }
  | { kind: "call"; fn: string; args: MelExprNode[] }
  | { kind: "obj"; fields: MelObjField[] }
  | { kind: "arr"; elements: MelExprNode[] };
```

**Node count:** 8 kinds — `lit`, `var`, `sys`, `get`, `field`, `call`, `obj`, `arr`.

**v0.7.0 alignment notes:**
- `field` is required for `.prop` access on non-path expressions (e.g., `at(items, id).status`). See §7.2.2 and §9.1.2 for examples.
- `var` supports only `"item"`. `"acc"` was removed in v0.3.3 when reduce/fold was forbidden (FDR-MEL-062).

#### 17.1.2 Core Runtime IR (Output)

```typescript
import type { ExprNode as CoreExprNode } from "@manifesto-ai/core";
// Core get uses string path: { kind: "get", path: "user.name" }
// Core get does NOT have base field
```

### 17.2 Lowering Context

```typescript
type ExprLoweringContext = {
  mode: "schema" | "action";
  /** meta/input allowed in action mode only. MUST be undefined or empty in schema mode. */
  allowSysPaths?: { prefixes: Array<"meta" | "input"> };
  fnTableVersion: string;
  actionName?: string;
};

type PatchLoweringContext = {
  // NO mode — Compiler determines per op-field (AD-COMP-LOW-002)
  /** meta/input allowed per op-field context. Schema fields: empty. Action fields: ["meta","input"]. */
  allowSysPaths?: { prefixes: Array<"meta" | "input"> };
  fnTableVersion: string;
  actionName?: string;
};
```

**NORMATIVE:**
- `system` prefix is NEVER allowed in Translator path.
- In schema mode (`addComputed.expr`, `addConstraint.rule`, `addActionAvailable.expr`, `stateDefault`): `allowSysPaths` MUST be `undefined` or `{ prefixes: [] }`. Any `sys` node is a lowering error.
- In action mode (`ActionGuard.condition`, `ActionStmt.patch.value`, `ActionStmt.effect.args.*`): `allowSysPaths = { prefixes: ["meta", "input"] }`.

### 17.3 Lowering Semantics

#### 17.3.1 sys Lowering (R2-2 Fix)

**CRITICAL: Use Core path conventions (no $ prefix).**

```typescript
// MEL: { kind: 'sys', path: ['meta', 'intentId'] }
// Core: { kind: 'get', path: 'meta.intentId' }
//                       ↑ NO $ prefix (Core convention)

// MEL: { kind: 'sys', path: ['input', 'title'] }
// Core: { kind: 'get', path: 'input.title' }

// MEL: { kind: 'sys', path: ['system', 'uuid'] }
// Translator path: LoweringError(INVALID_SYS_PATH)
// Flow path only: lowered per §11 → $mel.sys.* slot
```

**Normative:**
> In Translator-evaluation path, `sys.system` MUST be rejected with INVALID_SYS_PATH.
> `sys.meta` and `sys.input` are lowered to Core `get` with paths `meta.*` and `input.*`.

#### 17.3.2 var Lowering (R2-3 Fix)

**CRITICAL: $item only allowed in effect.args context.**

```typescript
// In effect.args context:
// MEL: { kind: 'var', name: 'item' }
// Core: { kind: 'get', path: '$item' }

// MEL: { kind: 'get', base: { kind: 'var', name: 'item' }, path: [{prop:'name'}] }
// Core: { kind: 'get', path: '$item.name' }

// In guard/patch.value context:
// MEL: { kind: 'var', name: 'item' }
// Result: LoweringError(INVALID_KIND_FOR_CONTEXT)
```

#### 17.3.3 get Lowering

**PathNode[] → string path:**

```typescript
// MEL: { kind: 'get', path: [{prop:'user'}, {prop:'name'}] }
// Core: { kind: 'get', path: 'user.name' }
```

#### 17.3.4 get.base Handling (R2-1 Fix)

**CRITICAL: Core `get` has NO base field. Only var(item) base is supported.**

```typescript
// Supported: base is var(item)
// MEL: { kind: 'get', base: { kind: 'var', name: 'item' }, path: [{prop:'x'}] }
// Core: { kind: 'get', path: '$item.x' }

// NOT Supported: base is any other expression
// MEL: { kind: 'get', base: { kind: 'call', fn: 'at', args: [...] }, path: [...] }
// Result: LoweringError(UNSUPPORTED_BASE)
```

**Normative:**
> `get.base` MUST be either:
> - `undefined` → lower path directly
> - `{ kind: 'var', name: 'item' }` → prefix path with `$item.`
> - Any other expression → LoweringError(UNSUPPORTED_BASE)

#### 17.3.5 call Lowering

MEL's call-based IR uses `{ kind: 'call', fn: '<name>', args: [...] }`. Core IR uses named-head nodes with specific field names. The compiler MUST map each MEL function name to its Core ExprNode kind using the table below.

**MEL Public Builtin → Core Node Lowering Table (Normative):**

Only functions listed in §9.1 Standard Library are available on the MEL surface. This table maps each public builtin to its Core ExprNode kind.

| MEL `fn` (§9.1) | Core `kind` | Core fields | Notes |
|----------|-------------|-------------|-------|
| **Comparison** | | | |
| `eq` | `eq` | `left, right` | |
| `neq` | `neq` | `left, right` | |
| `gt` | `gt` | `left, right` | |
| `gte` | `gte` | `left, right` | |
| `lt` | `lt` | `left, right` | |
| `lte` | `lte` | `left, right` | |
| **Logical** | | | |
| `and` | `and` | `args: [...]` | Variadic |
| `or` | `or` | `args: [...]` | Variadic |
| `not` | `not` | `arg` | |
| **Conditional** | | | |
| `cond` | `if` | `cond, then, else` | **Name differs** |
| **Arithmetic** | | | |
| `add` | `add` | `left, right` | |
| `sub` | `sub` | `left, right` | |
| `mul` | `mul` | `left, right` | |
| `div` | `div` | `left, right` | |
| `mod` | `mod` | `left, right` | |
| `neg` | `neg` | `arg` | |
| `abs` | `abs` | `arg` | |
| `min` (scalar) | `min` | `args: [...]` | Variadic |
| `max` (scalar) | `max` | `args: [...]` | Variadic |
| `floor` | `floor` | `arg` | |
| `ceil` | `ceil` | `arg` | |
| `round` | `round` | `arg` | |
| `sqrt` | `sqrt` | `arg` | |
| `pow` | `pow` | `base, exponent` | |
| **String** | | | |
| `concat` | `concat` | `args: [...]` | Variadic |
| `substr` | `substring` | `str, start, end?` | **Name differs** |
| `trim` | `trim` | `str` | |
| `lower` | `toLowerCase` | `str` | **Name differs** |
| `upper` | `toUpperCase` | `str` | **Name differs** |
| `strlen` | `strLen` | `str` | **Name differs** |
| **Collection** | | | |
| `len` | `len` | `arg` | |
| `at` | `at` | `array, index` | |
| `first` | `first` | `array` | |
| `last` | `last` | `array` | |
| `append` | `append` | `array, items: [item]` | Single item wrapped in items array |
| `isNull` | `isNull` | `arg` | |
| `isNotNull` | `isNotNull` | `arg` | |
| `coalesce` | `coalesce` | `args: [...]` | Variadic |
| `toString` | `toString` | `arg` | |
| **Aggregation (computed only, §9.1.9)** | | | |
| `sum` | `sumArray` | `array` | **Name differs** |
| `min` (array) | `minArray` | `array` | **Name differs**; dispatch by arg type |
| `max` (array) | `maxArray` | `array` | **Name differs**; dispatch by arg type |
| **Entity Primitives (§9.1.10)** | | | |
| `findById` | see §9.1.10 | Lowered at MEL→Core boundary | Multi-node expansion |
| `existsById` | see §9.1.10 | Lowered at MEL→Core boundary | Multi-node expansion |
| `updateById` | see §9.1.10 | Lowered at MEL→Core boundary | Multi-node expansion |
| `removeById` | see §9.1.10 | Lowered at MEL→Core boundary | Multi-node expansion |

**Core ExprNode Kinds Used by Compiler Internally (NOT MEL public builtins):**

The following Core ExprNode kinds exist in Core SPEC §7.2 but are NOT exposed as MEL surface functions. They are generated only by compiler lowering (entity primitives, effect lowering, etc.). MEL source code MUST NOT use these as function names — they are semantic errors per §8.2.

| Core `kind` | Generated by | Notes |
|-------------|-------------|-------|
| `find` | Entity primitive lowering (`findById`) | |
| `filter` | Entity/effect lowering (`removeById`, `effect array.filter`) | |
| `map` | Entity/effect lowering (`updateById`, `effect array.map`) | |
| `merge` | Entity lowering (`updateById` → merge item with updates) | |
| `field` | Property access lowering (§17.3.6) | |
| `startsWith` | Reserved for future MEL builtin | Core node exists |
| `endsWith` | Reserved for future MEL builtin | Core node exists |
| `strIncludes` | Reserved for future MEL builtin | Core node exists |
| `indexOf` | Reserved for future MEL builtin | Core node exists |
| `replace` | Reserved for future MEL builtin | Core node exists |
| `split` | Reserved for future MEL builtin | Core node exists |
| `slice` | Reserved for future MEL builtin | Core node exists |
| `includes` | Reserved for future MEL builtin | Core node exists |
| `join` | Reserved for future MEL builtin | Core node exists |
| `flat` | Reserved for future MEL builtin | Core node exists |
| `toNumber` | Reserved for future MEL builtin | Core node exists |
| `toBoolean` | Reserved for future MEL builtin | Core node exists |

**Name-differs entries are the most common source of implementation bugs.** The compiler MUST use the Core name, not the MEL name.

```typescript
// Example: cond → if
// MEL: { kind: 'call', fn: 'cond', args: [COND, THEN, ELSE] }
// Core: { kind: 'if', cond: <lowered COND>, then: <lowered THEN>, else: <lowered ELSE> }

// Example: lower → toLowerCase
// MEL: { kind: 'call', fn: 'lower', args: [STR] }
// Core: { kind: 'toLowerCase', str: <lowered STR> }

// Example: sum(arr) → sumArray
// MEL: { kind: 'call', fn: 'sum', args: [ARR] }
// Core: { kind: 'sumArray', array: <lowered ARR> }
```

#### 17.3.6 field Lowering (v0.7.0)

**`field` represents static property access on a computed expression result** (e.g., `at(items, id).status`). Core IR has a corresponding `field` node (Core SPEC §7.2, FDR-MEL-078). The lowering is a direct 1:1 mapping.

**Rule 1 — Simple get flattening:** If `field.object` is a `get` without `base`, the property is appended to the path string.

```typescript
// MEL: { kind: 'field', object: { kind: 'get', path: [{prop:'user'}] }, property: 'name' }
// Core: { kind: 'get', path: 'user.name' }
```

**Rule 2 — All other cases:** If `field.object` is any expression other than a simple `get` (i.e., `call`, `var`+`get`, nested `field`, etc.), the lowering produces a Core `field` node.

```typescript
// MEL: { kind: 'field', object: { kind: 'call', fn: 'at', args: [ITEMS, ID] }, property: 'status' }
// Core: { kind: 'field', object: { kind: 'at', array: <lowered ITEMS>, index: <lowered ID> }, property: 'status' }

// MEL: { kind: 'field', object: { kind: 'get', base: {kind:'var',name:'item'}, path: [{prop:'address'}] }, property: 'city' }
// Core: { kind: 'field', object: { kind: 'get', path: '$item.address' }, property: 'city' }
```

**Normative:**
> - `field.property` is always a compile-time string constant.
> - Rule 1 (flattening) is an optimization; Rule 2 is the general case. Both produce semantically identical results.
> - There is no ambiguity: the compiler checks whether `field.object.kind === 'get' && field.object.base === undefined`. If yes, Rule 1. Otherwise, Rule 2.

### 17.4 Lowering API

```typescript
function lowerExprNode(
  input: MelExprNode,
  ctx: ExprLoweringContext
): CoreExprNode;

function lowerPatchOps(
  ops: MelPatchOp[], 
  ctx: PatchLoweringContext
): ConditionalPatchOp[];

function lowerPatchFragments(
  fragments: TranslatorPatchFragment[], 
  ctx: PatchLoweringContext
): ConditionalPatchOp[];
```

### 17.5 ConditionalPatchOp Type (R2-6 Fix)

**CRITICAL: Preserve condition from PatchFragment.**

```typescript
type IRPathSegment =
  | { kind: "prop"; name: string }
  | { kind: "expr"; expr: CoreExprNode };

type IRPatchPath = readonly IRPathSegment[];

type ConditionalPatchOp = {
  /** 
   * Optional condition (from PatchFragment.condition).
   * MUST evaluate to boolean (true applies, false/null/non-boolean skips).
   * See §18.6 for boolean-only evaluation semantics.
   */
  condition?: CoreExprNode;
  
  /** The patch operation */
  op: "set" | "unset" | "merge";
  path: IRPatchPath;
  value?: CoreExprNode;
};

// lowerPatchFragments preserves fragment.condition
// Host MUST use evaluateConditionalPatchOps()
```

### 17.6 Lowering Errors

```typescript
type LoweringErrorCode =
  | "INVALID_KIND_FOR_CONTEXT"  // var in non-effect context, sys in schema
  | "UNKNOWN_CALL_FN"
  | "INVALID_SYS_PATH"          // sys.system in Translator path
  | "UNSUPPORTED_BASE"          // get.base is not var(item)
  | "INVALID_SHAPE";            // malformed node structure

class LoweringError extends Error {
  readonly code: LoweringErrorCode;
  readonly path?: string[];
  readonly details?: Record<string, unknown>;
}
```

---

## 18. Expression Evaluation

**STATUS: NORMATIVE** — This section defines mandatory evaluation semantics.

### 18.1 Purpose

Core.apply() expects concrete `Patch[]`. Compiler MUST provide evaluation that resolves Core IR expressions to concrete values.

### 18.2 Total Function Principle (R2-4 Fix)

**CRITICAL: Evaluation is TOTAL. Invalid operations return null, never throw.**

```typescript
// A35: "Expression evaluation is total; invalid operations return null, never throw."

// Examples:
// div(10, 0) → null (not throw)
// get("nonexistent.path") → null (not throw)
// add("string", 5) → null (not throw)
// at(arr, -1) → null (not throw)
```

**Exception:** Only structural errors (UNKNOWN_NODE_KIND, INVALID_SHAPE) may throw.

### 18.3 Evaluation Context

```typescript
type EvaluationContext = {
  /** Current snapshot for state lookups */
  snapshot: Snapshot;
  
  /** Intent metadata */
  meta: {
    intentId: string;
    actor?: ActorRef;
    timestamp?: number;
  };
  
  /** Intent input */
  input: Record<string, unknown>;
  
  /** Current $item value (for effect.args evaluation) */
  item?: unknown;
};
```

**NORMATIVE: No `system` field.** System values are not available in Translator-evaluation path.

### 18.4 Evaluation API

```typescript
/**
 * Evaluate a single Core expression to a concrete value.
 * TOTAL: Returns null on invalid operations, never throws (except structural errors).
 */
function evaluateExpr(
  expr: CoreExprNode,
  ctx: EvaluationContext
): unknown;

/**
 * Evaluate conditional patch ops to concrete patches.
 * Applies conditions, evaluates values, returns only applicable patches.
 * 
 * NORMATIVE (Output Order Stability):
 * - Output Patch[] maintains input ops[] order
 * - Patches where condition is false are filtered out
 * - Remaining patches preserve their relative order
 */
function evaluateConditionalPatchOps(
  ops: ConditionalPatchOp[],
  ctx: EvaluationContext
): Patch[];
```

### 18.5 Sequential Evaluation Semantics (R1-4 Fix)

**CRITICAL: Multi-patch evaluation uses working snapshot.**

```typescript
/**
 * Resolve IRPatchPath to concrete PatchPath.
 * TOTAL rule: invalid segment result => return null (skip op), never throw.
 */
function resolveIRPath(path: IRPatchPath, ctx: EvaluationContext): PatchPath | null;

/**
 * NORMATIVE: Sequential evaluation with working snapshot.
 * 
 * Given ops: [op1, op2, op3]
 * 
 * 1. Resolve op1.path via resolveIRPath()
 *    - null => skip op1 and emit warning
 * 2. Evaluate op1.condition against ctx.snapshot.data
 *    If true, evaluate op1.value against ctx.snapshot.data
 *    Apply patch1 to working snapshot
 * 
 * 3. Resolve op2.path via resolveIRPath()
 *    - null => skip op2 and emit warning
 * 4. Evaluate op2.condition against WORKING snapshot.data
 *    If true, evaluate op2.value against WORKING snapshot.data
 *    Apply patch2 to working snapshot
 * 
 * 3. ... and so on
 * 
 * Return: All applicable Patch[] (concrete values, in input order)
 */

// Example:
// ops: [
//   { op: "set", path: [{kind:"prop",name:"a"}], value: { kind: "lit", value: 1 } },
//   { op: "set", path: [{kind:"prop",name:"b"}], value: { kind: "add", left: { kind: "get", path: "a" }, right: { kind: "lit", value: 1 } } }
// ]
// Initial snapshot.data: { a: 0, b: 0 }
// 
// Step 1: Evaluate a = 1, working snapshot.data becomes { a: 1, b: 0 }
// Step 2: Evaluate b = a + 1 = 1 + 1 = 2 (uses working snapshot where a=1)
// 
// Result patches: [
//   { op: "set", path: [{kind:"prop",name:"a"}], value: 1 },
//   { op: "set", path: [{kind:"prop",name:"b"}], value: 2 }
// ]
```

### 18.6 Condition Evaluation (R3-2 Fix: Boolean-Only)

**NORMATIVE: Condition MUST be boolean. Truthy/falsy coercion is forbidden.**

```typescript
// If condition is present:
// 1. Evaluate condition expression
// 2. Check result type:
//    - If result === true  → evaluate value and include patch
//    - If result === false → skip this patch
//    - If result is null or non-boolean → treat as false (skip), emit warning
// 
// This follows MEL's boolean-only principle for guards/conditions.

// If condition is absent:
// Always evaluate and include patch

// Example implementation:
function shouldApplyPatch(condition: CoreExprNode | undefined, ctx: EvaluationContext): boolean {
  if (condition === undefined) return true;
  
  const result = evaluateExpr(condition, ctx);
  
  // Boolean-only (MEL rule)
  if (result === true) return true;
  if (result === false) return false;
  
  // Non-boolean or null → false (TOTAL principle: no throw)
  // Compiler MAY emit warning for non-boolean condition result
  return false;
}
```

**Rationale:**
> MEL SPEC: "Guard conditions must evaluate to boolean."
> This prevents JS-style truthy coercion that could cause inconsistent behavior.

### 18.7 Path Resolution (R3-1 Fix: snapshot.data)

**Core convention paths:**

| Path prefix | Resolves to |
|-------------|-------------|
| `meta.*` | `ctx.meta.*` |
| `input.*` | `ctx.input.*` |
| `$item.*` | `ctx.item.*` |
| (computed) | `ctx.snapshot.computed.*` |
| (other) | `ctx.snapshot.data.*` |

```typescript
// get(path: "meta.intentId") → ctx.meta.intentId
// get(path: "input.title") → ctx.input.title
// get(path: "$item.name") → ctx.item?.name
// get(path: "total") → ctx.snapshot.computed?.total
// get(path: "user.name") → ctx.snapshot.data.user?.name
```

### 18.8 Operator Semantics (Total)

| Operation | Invalid condition | Result |
|-----------|-------------------|--------|
| `add(a, b)` | Non-numeric operand | null |
| `div(a, b)` | b = 0 | null |
| `get(path)` | Path not found | null |
| `at(arr, i)` | Out of bounds | null |
| `first(arr)` | Empty array | null |
| `eq(a, b)` | (always valid) | boolean |

### 18.9 Complete Flow Example

```typescript
// 1. Translator output
const fragment: TranslatorPatchFragment = {
  fragmentId: "abc",
  sourceIntentId: "intent-123",
  condition: { kind: 'call', fn: 'gt', args: [
    { kind: 'get', path: [{ kind: 'prop', name: 'count' }] },
    { kind: 'lit', value: 0 }
  ]},
  op: {
    op: "set",
    path: [{ kind: "prop", name: "count" }],
    value: { kind: 'call', fn: 'add', args: [
      { kind: 'get', path: [{ kind: 'prop', name: 'count' }] },
      { kind: 'lit', value: 1 }
    ]}
  },
  confidence: 0.95,
  evidence: [],
  createdAt: Date.now()
};

// 2. Lower (MEL IR → Core IR + condition)
const lowered: ConditionalPatchOp[] = lowerPatchFragments([fragment], {
  fnTableVersion: "1.0",
  actionName: "increment"
});
// Result: [{
//   condition: { kind: 'gt', left: { kind: 'get', path: 'count' }, right: { kind: 'lit', value: 0 } },
//   op: "set", path: [{ kind: "prop", name: "count" }], value: { kind: 'add', left: {...}, right: {...} }
// }]

// 3. Evaluate (Core IR → concrete values, with boolean condition check)
const patches: Patch[] = evaluateConditionalPatchOps(lowered, {
  snapshot: { data: { count: 5 }, computed: {} },
  meta: { intentId: "intent-123" },
  input: {}
});
// Condition: count(5) > 0 = true (boolean) → include
// Value: count(5) + 1 = 6
// Result: [{ op: "set", path: [{ kind: "prop", name: "count" }], value: 6 }]

// 4. Apply
const newSnapshot = core.apply(schema, currentSnapshot, patches);
```

---

## 19. MEL Text Ingest

### 19.1 Domain Compilation

```typescript
function compileMelDomain(
  melText: string,
  opts: { mode: "domain"; fnTableVersion?: string }
): { schema: DomainSchema; trace: CompileTrace; warnings: CompileWarning[] };
```

### 19.2 Patch Compilation

**Returns `ConditionalPatchOp[]` (not evaluated).**

```typescript
function compileMelPatch(
  melText: string,
  opts: { 
    mode: "patch"; 
    actionName: string;
    fnTableVersion?: string;
    /** Only meta/input (system forbidden) */
    allowSysPaths?: { prefixes: Array<"meta" | "input"> };
  }
): { ops: ConditionalPatchOp[]; trace: CompileTrace; warnings: CompileWarning[] };
```

**Bridge Note:**
> `compileMelPatch()` returns `ConditionalPatchOp[]` where `condition` is `undefined` for all ops
> (MEL patch text does not include inline conditions).
> Host MUST still call `evaluateConditionalPatchOps()` to evaluate expressions to concrete values.

---

## 20. Host Integration Requirements (SUPERSEDED)

### 20.1 Complete Data Flow

---

## 21. Compiler Rules for $mel Namespace (v0.5.0, extended v0.7.0)

| Rule ID | Description |
|---------|-------------|
| COMPILER-MEL-1 | Guard patches for `onceIntent` MUST use `merge` operation at `$mel.guards.intent` path. Root `$mel` merge is FORBIDDEN (shallow merge would overwrite sibling guards). |
| COMPILER-MEL-2 | Desugared `once(X)` MUST perform its first guard write to the same **semantic guard path** `X`. |
| COMPILER-MEL-2a | Lowering MAY implement the guard write as `merge` at `$mel.guards.intent` (map-level) and treat it as semantically equivalent to writing `X`. |
| COMPILER-MEL-3 | `onceIntent` MUST be parsed as a **contextual keyword** (statement start + `{`/`when` only). |
| COMPILER-MEL-4 | System value patches MUST use **deep `set`** at individual leaf paths (e.g., `{ op: "set", path: "$mel.sys.addTask.uuid.intent", value: "i1" }`). Map-level `merge` at `$mel.sys.<action>.<key>` is NOT required — unlike guards, `intent` and `value` have different lifecycles (intent is written immediately, value arrives after Host fulfills the effect). Root `$mel` merge is FORBIDDEN (COMPILER-MEL-1 applies). |

**COMPILER-MEL-1 Rationale:**

Core's `merge` is shallow. If compiler generates:
```typescript
// ❌ WRONG: Root merge overwrites guards
{ op: "merge", path: "$mel", value: { guards: { intent: { a: "i1" } } } }
{ op: "merge", path: "$mel", value: { guards: { intent: { b: "i1" } } } }
// Result: { guards: { intent: { b: "i1" } } } — "a" is lost!
```

Correct approach:
```typescript
// ✅ CORRECT: Map-level merge preserves siblings
{ op: "merge", path: "$mel.guards.intent", value: { a: "i1" } }
{ op: "merge", path: "$mel.guards.intent", value: { b: "i1" } }
// Result: { guards: { intent: { a: "i1", b: "i1" } } }
```

**COMPILER-MEL-4 Rationale:**

Guards use map-level `merge` because multiple guards coexist as siblings under `$mel.guards.intent` and are all written in the same lifecycle phase (guard evaluation). System value slots are different: `.intent` is written immediately when the acquisition guard fires, but `.value` is written later by Host after fulfilling the `system.get` effect. These are **different lifecycle phases**, so a single merge at `$mel.sys.<action>.<key>` would risk overwriting one with the other. Deep `set` at individual leaf paths avoids this:

```typescript
// ✅ CORRECT: Deep set — intent and value written at different times
// Phase 1 (guard fires): compiler writes intent marker
{ op: "set", path: "$mel.sys.addTask.uuid.intent", value: "intent-1" }

// Phase 2 (Host fulfills effect): Host writes acquired value
{ op: "set", path: "$mel.sys.addTask.uuid.value", value: "abc-123" }
```

---

## 22. Cross-Spec Alignment: `$mel` Namespace (v0.7.0 Companion Patch)

This section documents the canonical `$mel` namespace shape as it relates to Core, Host, World, and SDK contracts. It serves as a normative bridge between this Compiler SPEC and the surrounding specs.

**Canonical `$mel` shape:**

```
snapshot.data.$mel
├── guards
│   └── intent
│       └── <guardId>: string              // intentId or null
└── sys
    └── <actionName>
        └── <normalizedKey>
            ├── intent: string | null       // intentId of last acquisition
            └── value: <varies> | null      // acquired system value
```

**Cross-spec contract summary:**

| Layer | Contract | Reference |
|-------|----------|-----------|
| **Core** | `data.$*` namespaces are platform-owned and opaque. Core MUST NOT require them in `StateSpec`. Core validates only namespace roots as objects, no nested validation under `$*`. Platform layers MAY add or patch `data.$*` via `core.apply()`. | Core SPEC §5.5, SCHEMA-RESERVED-1/2 |
| **World** | `data.$mel` is excluded from the semantic snapshot hash. Changes to `$mel.*` do not alter the domain's identity. | World SPEC §hash-exclusion |
| **SDK** | `withPlatformNamespaces()` injects `$host` and `$mel` into initial snapshot. `normalizeSnapshot()` ensures `$mel` structure is present. | SDK SPEC §withPlatformNamespaces, ADR-002 |
| **Compiler** | `$mel.guards.intent.*` stores onceIntent guard markers. `$mel.sys.*` stores compiler-generated system value acquisition slots. Both are created by compiler-generated patches/effects. | This spec §4.7.1, §11, §21 |

**Normative statements:**

1. `$mel` is a compiler-owned opaque platform namespace.
2. `$mel.guards.intent.*` is eagerly normalized by SDK at snapshot creation.
3. `$mel.sys.*` is lazily created by compiler-generated patches and Host-fulfilled effects.
4. All `$mel.*` values are exempt from domain FieldSpec type restrictions (§5.6.2).
5. Surrounding specs (SDK, World, Host) SHOULD recognize `$mel.sys.*` as a valid subtree under the existing `$mel` platform namespace policy. No new ADR is required — `$mel.sys.*` is a specialization of the already-approved `$mel` namespace.

## Appendix A: Grammar Summary (EBNF)

```ebnf
(* ═══════════════════════════════════════════════════════════ *)
(* MEL Grammar - Manifesto Expression Language v0.7.0          *)
(* AI-Native + Host Contract + System Values as Effects        *)
(* + Core Alignment + Primitive Aggregation + Named Types      *)
(* + onceIntent + $mel Namespace                               *)
(* + flow/include (ADR-013a) + Entity Primitives (ADR-013b)    *)
(* ═══════════════════════════════════════════════════════════ *)

Program         = { ImportDecl } DomainDecl ;
ImportDecl      = "import" "{" IdentifierList "}" "from" StringLiteral ;
DomainDecl      = "domain" Identifier "{" { DomainMember } "}" ;
DomainMember    = TypeDecl | StateDecl | ComputedDecl | ActionDecl | FlowDecl ;

(* ─── Type Declaration (v0.3.3) ─── *)
TypeDecl        = "type" Identifier "=" TypeExpr ;

(* ─── State ─── *)
StateDecl       = "state" "{" { StateField } "}" ;
StateField      = Identifier ":" StateTypeRef ( "=" Expression )? ;

(* v0.3.3: StateTypeRef excludes inline object types *)
StateTypeRef    = Identifier                              (* named type reference *)
                | PrimitiveType                           (* string, number, etc. *)
                | "Record" "<" TypeExpr "," TypeExpr ">"
                | "Array" "<" TypeExpr ">"
                | StateTypeRef "|" StateTypeRef           (* union *)
                | StringLiteral                           (* literal type *)
                ;
                (* ❌ NO inline object types: "{" ... "}" *)

(* ─── Computed ─── *)
ComputedDecl    = "computed" Identifier "=" Expression ;

(* ─── Action (v0.3.3: available, fail, stop; v0.7.0: include) ─── *)
ActionDecl      = "action" Identifier "(" [ ParamList ] ")" [ AvailableClause ] ActionBody ;
AvailableClause = "available" "when" Expression ;
ParamList       = Param { "," Param } ;
Param           = Identifier ":" TypeExpr ;

(* v0.2.1: ActionBody contains ONLY guards, no top-level patch/effect *)
ActionBody      = "{" { GuardedStmt } "}" ;
GuardedStmt     = WhenStmt | OnceStmt | OnceIntentStmt | IncludeStmt ;

(* Guards contain inner statements *)
WhenStmt        = "when" Expression "{" { InnerStmt } "}" ;

(* v0.2.2: once takes Path, not Identifier *)
OnceStmt        = "once" "(" Path ")" [ "when" Expression ] "{" { InnerStmt } "}" ;
OnceIntentStmt  = "onceIntent" [ "when" Expression ] "{" { InnerStmt } "}" ;

(* Inner statements (only allowed inside guards) *)
InnerStmt       = PatchStmt | EffectStmt | WhenStmt | OnceStmt | OnceIntentStmt | FailStmt | StopStmt ;

(* ─── Flow (v0.7.0: ADR-013a) — contextual keyword ─── *)
FlowDecl        = "flow" Identifier "(" [ ParamList ] ")" FlowBody ;
FlowBody        = "{" { FlowGuardedStmt } "}" ;
FlowGuardedStmt = FlowWhenStmt | IncludeStmt ;
FlowWhenStmt    = "when" Expression "{" { FlowInnerStmt } "}" ;
FlowInnerStmt   = FailStmt | StopStmt | FlowWhenStmt ;

(* ─── Include (v0.7.0: ADR-013a) — contextual keyword ─── *)
IncludeStmt     = "include" Identifier "(" [ ArgList ] ")" ;

(* v0.3.3: Flow control statements *)
FailStmt        = "fail" StringLiteral [ "with" Expression ] ;
StopStmt        = "stop" StringLiteral ;

(* v0.2.1: Patch has three operations *)
PatchStmt       = "patch" Path PatchOp ;
PatchOp         = "=" Expression        (* set *)
                | "unset"               (* unset *)
                | "merge" Expression ;  (* merge *)

(* v0.2.2: Effect args with explicit WriteArg/ReadArg *)
EffectStmt      = "effect" EffectType "(" [ EffectArgs ] ")" ;
EffectType      = Identifier { "." Identifier } ;
EffectArgs      = "{" { EffectArg } "}" ;
EffectArg       = WriteArg | ReadArg ;
WriteArg        = ( "into" | "pass" | "fail" ) ":" Path ","? ;
ReadArg         = Identifier ":" Expression ","? ;

(* ─── Expressions ─── *)
Expression      = TernaryExpr ;
TernaryExpr     = NullishExpr [ "?" Expression ":" Expression ] ;
NullishExpr     = OrExpr { "??" OrExpr } ;
OrExpr          = AndExpr { "||" AndExpr } ;
AndExpr         = EqualityExpr { "&&" EqualityExpr } ;
EqualityExpr    = CompareExpr { ( "==" | "!=" ) CompareExpr } ;
CompareExpr     = AddExpr { ( "<" | "<=" | ">" | ">=" ) AddExpr } ;
AddExpr         = MulExpr { ( "+" | "-" ) MulExpr } ;
MulExpr         = UnaryExpr { ( "*" | "/" | "%" ) UnaryExpr } ;
UnaryExpr       = ( "!" | "-" ) UnaryExpr | PostfixExpr ;
PostfixExpr     = PrimaryExpr { PostfixOp } ;
PostfixOp       = "." Identifier | "[" Expression "]" ;
PrimaryExpr     = Literal | Identifier | SystemIdent | FunctionCall
                | "(" Expression ")" | ObjectLiteral | ArrayLiteral ;
FunctionCall    = Identifier "(" [ ArgList ] ")" ;

(* ─── Literals (v0.2.2: no template literals) ─── *)
Literal         = NullLiteral | BooleanLiteral | NumericLiteral | StringLiteral ;
ObjectLiteral   = "{" { ObjectField } "}" ;
ObjectField     = ( Identifier | StringLiteral ) ":" Expression ","? ;
ArrayLiteral    = "[" { Expression ","? } "]" ;

(* ─── Types ─── *)
TypeExpr        = PrimaryType { "|" PrimaryType } ;
PrimaryType     = "string" | "number" | "boolean" | "null"
                | StringLiteral | NumericLiteral | Identifier
                | "Record" "<" TypeExpr "," TypeExpr ">"
                | "Array" "<" TypeExpr ">"
                | "{" { TypeField } "}" ;
TypeField       = Identifier "?"? ":" TypeExpr ","? ;

(* ─── Identifiers ─── *)
Identifier      = IdentifierStart { IdentifierPart } ;
QualifiedIdent  = Identifier { "." Identifier } ;
SystemIdent     = "$" Identifier { "." Identifier } ;
Path            = Identifier { "." Identifier | "[" Expression "]" } ;
IdentifierList  = Identifier { "," Identifier } ;
ArgList         = Expression { "," Expression } ;
```

---

## Appendix B: Reserved Words

```
// Keywords (MEL v0.7.0)
domain state computed action effect when once patch
unset merge type available fail stop
true false null as import from export

// Reserved (future use)
async await yield class extends interface enum
namespace module private public protected static
implements abstract final override readonly

// Reserved (JS — never to be implemented)
function var let const if else for while do switch
case break continue return throw try catch finally
new delete typeof instanceof void with debugger
this super arguments eval
```

**Note (v0.3.3):** `type` is now a keyword for type declarations. `available`, `fail`, `stop` are flow control keywords.

**Note (v0.5.0):** `onceIntent` is a contextual keyword, not a reserved word. It is recognized only at statement start when followed by `{` or `when`.

**Note (v0.7.0):** `flow` and `include` are contextual keywords, not reserved words. `flow` is recognized only at domain member start when followed by `Identifier` `(`. `include` is recognized only at GuardedStmt/FlowGuardedStmt start when followed by `Identifier` `(`. In all other contexts, both are treated as normal identifiers. See §4.7.5 and ADR-013a.

---

## Appendix C: AI-Native Design Summary

MEL v0.7.0 is designed with the following AI-Native principles:

| Principle | Implementation |
|-----------|----------------|
| **One pattern per concept** | Function calls only, no methods |
| **Explicit bindings** | `$item` for iteration variables |
| **Minimal grammar** | 22 keywords, ~35 constructs total |
| **No escape hatches** | Forbidden constructs don't parse |
| **Predictable structure** | `domain { state, computed, action }` |
| **Consistent syntax** | Every operation is `function(args)` |
| **No nested effects** | Effects are sequential, not nested |
| **Composition over nesting** | `flatMap`, `groupBy` for complex transforms |
| **Guard-mandatory mutations** | All patch/effect inside when/once/onceIntent (v0.2.1, v0.5.0) |
| **Boolean-only conditions** | No truthy/falsy coercion (v0.2.1) |
| **Canonical form** | Operators normalize to functions (v0.2.1) |
| **Per-intent idempotency** | `once()` compares against `$meta.intentId`; `onceIntent` stores guards in `$mel` (v0.2.2, v0.5.0) |
| **Deterministic semantics** | Same input → same output on any host (v0.2.2) |
| **Type-distinct effects** | `array.*` for Array, `record.*` for Record (v0.2.2) |
| **No template literals** | Use `concat()` for string building (v0.2.2) |
| **Strict equality** | `neq(a,b) := not(eq(a,b))` always (v0.2.3) |
| **Universal index access** | `at()` works on Array AND Record (v0.2.3) |
| **Explicit scopes** | Params > Computed > State > System, within permitted contexts (v0.2.3, v0.7.0) |
| **Complete IR** | Every construct has one IR representation (v0.2.3) |
| **Call-only IR** | All operations use `{kind:'call'}` nodes (v0.2.4) |
| **Primitive-only eq/neq** | Collection comparison is compile error (v0.2.4) |
| **Enforced once() marker** | `patch marker = $meta.intentId` must be first (v0.2.4) |
| **$ completely prohibited** | $ cannot appear anywhere in user identifiers (v0.2.5) |
| **Specified evaluation order** | Left-to-right, key-sorted for objects (v0.2.5) |
| **Index-as-call IR** | `x[y]` is always `call(at)`, not `get` with index (v0.2.5) |
| **System values as effects** | `$system.*` lowered to `system.get` effects (v0.3.0) |
| **Compiler-inserted lowering** | DX preserved, semantics fixed by compiler (v0.3.0) |
| **System value deduplication** | Same key in same action = same value (v0.3.0) |
| **Snapshot-based replay** | System values in Snapshot, no separate trace (v0.3.0) |
| **Pure Core guarantee** | No IO in Core, all via Effects (v0.3.0) |
| **$mel.sys namespace** | Compiler-generated system slots live under `$mel.sys.*`, platform-owned (v0.3.1, v0.7.0) |
| **Intent-based readiness** | `eq(intent_marker, $meta.intentId)` not `isNotNull(value)` (v0.3.1) |
| **Architecture reviewed** | System value semantics certified safe to implement (v0.3.1) |
| **Action availability** | `available when <Expr>` for declarative preconditions (v0.3.3) |
| **Errors are values** | `fail` is FlowNode, not Effect — Core decides (v0.3.3) |
| **Early exit vs pending** | `stop` is early-exit, "waiting" forbidden (v0.3.3) |
| **call hidden** | Core retains call, MEL hides it for simplicity (v0.3.3) |
| **Named types required** | Anonymous object types in state forbidden (v0.3.3) |
| **Schema-as-metadata** | Type declarations are AI-readable domain concepts (v0.3.3) |
| **Compile-time statement reuse** | `flow`/`include` for guard/fail/stop patterns; no runtime FlowNode `call` (v0.7.0) |
| **Intention-revealing primitives** | `findById`/`updateById` express entity identity semantics; `$item` stays hidden (v0.7.0) |
| **Contextual keywords** | `onceIntent`, `flow`, `include` — keyword only in specific positions, identifier elsewhere (v0.5.0, v0.7.0) |

**For LLM implementers**: MEL code can be generated by following these patterns:

1. All operations use `functionName(arg1, arg2)` syntax
2. Property access uses `object.property` (no method calls)
3. Index access uses `array[index]` or `record[key]` — both desugar to `at()` (v0.2.3)
4. Effects use `effect type.name({ param: value, into: path })`
5. Guards use `when condition { body }`, `once(marker) { body }`, or `onceIntent { body }`
6. Iteration variable is always `$item` (current element). `$acc` removed in v0.3.3.
7. **Effects are never nested** — use sequential effects with intermediate `into:` paths
8. For nested data, use `flatMap` to flatten, then `filter`/`map`, then `groupBy` to restructure
9. **All patch/effect must be inside guards** (v0.2.1)
10. **Conditions must be boolean expressions** — no `when items`, use `when gt(len(items), 0)` (v0.2.1)
11. **Markers use intentId** — `once(m) { patch m = $meta.intentId; ... }` (v0.2.2)
12. **Use correct effect family** — `array.*` for `Array<T>`, `record.*` for `Record<K,V>` (v0.2.2)
13. **Use concat() for strings** — no template literals, use `concat("Hello ", name)` (v0.2.2)
14. **Use cond() not if()** — `cond(condition, thenValue, elseValue)` (v0.2.2)
15. **Computed can reference computed** — scope is Computed > State (no $system.*, $meta.*, $input.* — v0.2.3, clarified v0.7.0)
16. **$system.* is deduplicated per action** — same key = same value, no intermediate state needed (v0.3.0)
17. **neq(null, string) = true** — different types are never equal (v0.2.3)
18. **eq/neq are primitive-only** — cannot compare Array/Object/Record (v0.2.4)
19. **$ is completely prohibited in identifiers** — not just at start, anywhere (v0.2.5)
20. **once() marker must be first** — `patch marker = $meta.intentId` as first statement (v0.2.4)
21. **Index access is call(at)** — `x[y]` is always `{ kind: 'call', fn: 'at' }` (v0.2.5)
22. **Evaluation is left-to-right** — object fields are key-sorted first, then left-to-right (v0.2.5)
23. **partition uses pass/fail** — not `into: { pass, fail }`, use top-level `pass:` and `fail:` (v0.2.5)
24. **$system.* only in actions** — forbidden in computed and state initializers (v0.3.0)
25. **System values are IO** — compiler handles lowering, developer writes surface syntax (v0.3.0)
26. **$mel.sys namespace** — compiler-generated system value slots live under `$mel.sys.*`, not domain state (v0.3.1, v0.7.0)
27. **Readiness uses eq(intent, intentId)** — NOT `isNotNull(value)`, prevents stale value bugs (v0.3.1)
28. **Architecture reviewed** — system value semantics certified safe to implement (v0.3.1)
29. **available is state/computed only** — no Effects, no $system.*, no $meta.*, no $input.*, no action parameters (v0.3.3, v0.7.0)
30. **fail must be guarded** — unconditional fail is compile error (v0.3.3)
31. **stop must be guarded** — unconditional stop is compile error (v0.3.3)
32. **stop ≠ waiting** — "Waiting for..." messages are lint errors (v0.3.3)
33. **Named types required** — anonymous object types in state are forbidden (v0.3.3)
34. **Types are metadata** — type declarations are AI-readable domain concepts (v0.3.3)
35. **`flow` for guard reuse** — `flow requireX(...) { when ... { fail } }` + `include requireX(...)` for validation DRY (v0.7.0)
36. **Entity primitives for id-based ops** — `findById`/`existsById` in any expression; `updateById`/`removeById` in patch RHS only (v0.7.0)
37. **Transform primitives are restricted** — patch RHS only, no nesting, state-path collection only, no computed names (v0.7.0)
38. **`flow`/`include` are contextual** — keyword only at specific positions, identifier elsewhere (v0.7.0)

---

*End of MEL SPEC v0.7.0*
