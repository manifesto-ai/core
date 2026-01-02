# MEL: Manifesto Expression Language

> **Version:** 0.2.5  
> **Status:** Normative  
> **Authors:** Manifesto Team  
> **License:** MIT  
> **Changelog:**
> - v0.2: AI-Native design principles (FDR-MEL-012 ~ 019)
> - v0.2.1: Host Contract alignment (FDR-MEL-020 ~ 026)
> - v0.2.2: Semantic closure (FDR-MEL-027 ~ 033)
> - v0.2.3: Specification completeness (FDR-MEL-034 ~ 039)
> - v0.2.4: Implementation convergence (FDR-MEL-040 ~ 044)
> - v0.2.5: Document consistency (FDR-MEL-045 ~ 048)

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
10. [Examples](#10-examples)
11. [Migration Guide](#11-migration-guide)

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
A16. System values are deterministic and traceable. [v0.2.4]
A17. $ is completely prohibited in user identifiers. [v0.2.5]
A18. Evaluation order is left-to-right, depth-first. [v0.2.5]
A19. Index access is always call(at), never get with index segment. [v0.2.5]
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
| IR completeness | Explicit nodes for `$item`, `$acc`, dynamic paths |

### 2.5 Specification Completeness (v0.2.3)

MEL v0.2.3 completes the specification with **no ambiguity**:

| Aspect | Requirement | FDR |
|--------|-------------|-----|
| Equality | `neq(a,b) := not(eq(a,b))` | FDR-MEL-034 |
| Index access | `at()` works on Array AND Record | FDR-MEL-035 |
| Scope | Params > Computed > State > System | FDR-MEL-036 |
| System values | Defined stability per value | FDR-MEL-037 |
| Sort | null last, NaN handling, stable | FDR-MEL-038 |
| IR | Complete node specification | FDR-MEL-039 |

### 2.6 Implementation Convergence (v0.2.4)

MEL v0.2.4 ensures **all implementations converge to identical behavior**:

| Aspect | Requirement | FDR |
|--------|-------------|-----|
| IR nodes | All operations use `{kind:'call'}` | FDR-MEL-040 |
| $ prefix | Reserved for system identifiers only | FDR-MEL-041 |
| eq/neq | Primitive types only (compile error for collections) | FDR-MEL-042 |
| $system.uuid | Deterministic (UUIDv5 with intent context) | FDR-MEL-043 |
| $system.time.now | Host-provided, recorded in Trace | FDR-MEL-043 |
| once() marker | `patch marker = $meta.intentId` must be first statement | FDR-MEL-044 |

### 2.7 The Single Pattern Principle

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
true      false     null
as        import    from      export
```

**v0.2.2 additions:** `once`, `unset`, `merge` promoted to keywords.

**Reserved for future use:**
```
async     await     yield     class     extends
interface type      enum      namespace module
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

#### 3.3.5 System Identifiers (v0.2.5)

System-provided values are prefixed with `$` and form a **reserved namespace**:

```ebnf
SystemIdent     = "$" Identifier { "." Identifier }
IterationVar    = "$item" | "$acc"
```

**Lexer rule:** `$...` patterns are ALWAYS tokenized as `SystemIdent`, never as `Identifier`.

```mel
$system.time.now      // Current timestamp (Host-provided)
$system.uuid          // Deterministic UUID (Host-provided)
$input.fieldName      // Intent input value
$meta.intentId        // Current intent identifier
$meta.actor           // Current actor
$meta.authority       // Current authority
$item                 // Current element in effect iteration
$acc                  // Accumulator in reduce effect
```

---

## 4. Syntactic Grammar

### 4.1 Program Structure

```ebnf
Program         = { ImportDecl } DomainDecl

ImportDecl      = "import" "{" IdentifierList "}" "from" StringLiteral

DomainDecl      = "domain" Identifier "{" { DomainMember } "}"

DomainMember    = StateDecl
                | ComputedDecl
                | ActionDecl
```

### 4.2 State Declaration

```ebnf
StateDecl       = "state" "{" { StateField } "}"

StateField      = Identifier ":" TypeExpr ( "=" Expression )?
```

**Example:**
```mel
state {
  count: number = 0
  items: Record<string, Item> = {}
  status: "idle" | "loading" | "done" = "idle"
}
```

### 4.3 Computed Declaration

```ebnf
ComputedDecl    = "computed" Identifier "=" Expression
```

Computed expressions MUST use only pure expressions (no Effects).

**Example:**
```mel
computed total = len(items)
computed isComplete = and(eq(done, total), gt(total, 0))
computed displayName = coalesce(user.name, "Anonymous")
```

### 4.4 Action Declaration

```ebnf
ActionDecl      = "action" Identifier "(" ParamList? ")" ActionBody

ParamList       = Param { "," Param }
Param           = Identifier ":" TypeExpr

(* v0.2.1: ActionBody contains ONLY guards, no top-level patch/effect *)
ActionBody      = "{" { GuardedStmt } "}"

GuardedStmt     = WhenStmt
                | OnceStmt

(* Patch and Effect are ONLY allowed inside guards *)
WhenStmt        = "when" Expression "{" { InnerStmt } "}"

(* v0.2.4: once takes Path, not Identifier *)
OnceStmt        = "once" "(" Path ")" [ "when" Expression ] "{" { InnerStmt } "}"

InnerStmt       = PatchStmt
                | EffectStmt
                | WhenStmt      (* Nested guards allowed *)
                | OnceStmt
```

**Critical (v0.2.1):** All `patch` and `effect` statements MUST be inside a `when` or `once` guard. This ensures re-entry safety and Host Contract compliance. See FDR-MEL-020.

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

### 4.5 Guard Statement (`when`)

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

### 4.6 Once Statement (Per-Intent Idempotency)

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

### 4.7 Patch Statement

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

### 4.8 Effect Statement

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

### 4.9 Expressions

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

### 4.10 Type Expressions

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
state { marker: string | null = null }

action test() {
  once(marker) {  // → when neq(marker, $meta.intentId)
    patch marker = $meta.intentId
  }
}

// First call: marker = null, $meta.intentId = "intent-A"
// eq(null, "intent-A") = false (different types → not equal)
// neq(null, "intent-A") = not(false) = true ✓
// → once() fires correctly!
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

**v0.2.1 removes truthy/falsy coercion.** All conditions in `when` and `once` must be explicitly boolean. See FDR-MEL-025.

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

---

## 6. Semantic Rules

### 6.1 Scope Resolution Order (v0.2.3)

MEL has a **strict scope resolution order**:

```
┌─────────────────────────────────────────────────────────────┐
│  Priority 1 (highest): Action Parameters                     │
│  ─────────────────────────────────────────────────────────  │
│  Priority 2: Computed Values                                 │
│  ─────────────────────────────────────────────────────────  │
│  Priority 3: Domain State (declared in state { })            │
│  ─────────────────────────────────────────────────────────  │
│  Priority 4 (lowest): System ($system, $meta, $item, $acc)   │
└─────────────────────────────────────────────────────────────┘
```

**Resolution order:** Parameters > Computed > State > System

**Context-specific rules:**

```
In Action body:
  Parameters > Computed > State > System

In Computed expression:
  Computed > State > System
  (No parameters — computed is not inside action)

In Effect sub-expression (where, select, etc.):
  $item/$acc > Parameters > Computed > State > System
```

**Name Collision Rules (Normative):**
```
- Computed name == State name → COMPILE ERROR
- Parameter name shadows Computed/State → ALLOWED (with warning)
- $item/$acc shadow everything in effect context → ALLOWED (by design)
```

**Example:**
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

**ONLY 7 node kinds for expressions:**

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
  | { kind: 'get'; base: ExprNode; path: PathNode }
  
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
| `$acc` | `{ kind: 'var', name: 'acc' }` |
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
| `coalesce(a, b)` | `{ kind: 'call', fn: 'coalesce', args: [A, B] }` |

### 7.2.1 System Values and Variables (v0.2.3)

| MEL Syntax | ExprNode |
|------------|----------|
| `$system.time.now` | `{ kind: 'sys', path: ['system', 'time', 'now'] }` |
| `$system.uuid` | `{ kind: 'sys', path: ['system', 'uuid'] }` |
| `$meta.intentId` | `{ kind: 'sys', path: ['meta', 'intentId'] }` |
| `$meta.actor` | `{ kind: 'sys', path: ['meta', 'actor'] }` |
| `$input.field` | `{ kind: 'sys', path: ['input', 'field'] }` |
| `$item` | `{ kind: 'var', name: 'item' }` |
| `$acc` | `{ kind: 'var', name: 'acc' }` |
| `$item.field` | `{ kind: 'get', base: { kind: 'var', name: 'item' }, path: ['field'] }` |

**v0.2.3 Note:** `$item` and `$acc` use `var` nodes, not `sys` nodes. They are only valid within effect sub-expressions.

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
| `x[y]` | `{ kind: 'call', fn: 'at', args: [<x>, <y>] }` |
| `x[0]` | `{ kind: 'call', fn: 'at', args: [<x>, { kind: 'lit', value: 0 }] }` |

**Chained Access Example:**
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

// ✅ Effect in action
action filterTasks() {
  effect array.filter({
    source: tasks,
    where: eq($item.completed, false),
    into: filteredTasks
  })
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

// ✅ REQUIRED: Sequential composition
action getActiveMembers() {
  effect array.flatMap({
    source: teams,
    select: $item.members,
    into: allMembers
  })
  
  effect array.filter({
    source: allMembers,
    where: eq($item.active, true),
    into: activeMembers
  })
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

**v0.2.3 Universal Index Access:** `at()` is overloaded to work on both Array and Record. The `[]` syntax is ALWAYS sugar for `at()`. See FDR-MEL-035.

```mel
// Array access
items[0]        → at(items, 0)
items[idx]      → at(items, idx)

// Record access  
tasks[id]       → at(tasks, id)
users["admin"]  → at(users, "admin")

// Chained access
nested.data[key]  → at(at(nested, "data"), key)
```

**v0.2.1 RESTRICTION:** `len()` is **Array-only**. Using `len()` on `Record<K,V>` is a semantic error. See FDR-MEL-026.

```mel
// ✅ Allowed
len(items)           // Array<T> → number
at(items, 0)         // Array access
at(tasks, id)        // Record access

// ❌ Forbidden
len(tasks)           // Error: tasks is Record<string, Task>
                     // Use: effect record.keys({ source: tasks, into: keys })
                     //      then: len(keys)
```

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

### 9.2 Standard Effects

#### 9.2.1 Array Effects

**Note:** Array effects work on `Array<T>` types only. For `Record<K,V>`, use Record effects (§9.2.2).

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

effect array.reduce({
  source: <Array>,
  initial: <Expression>,
  accumulate: <Expression using $acc and $item>,
  into: <Path>
})

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

### 9.3 System Values

| Path | Type | Description | Stability | Determinism (v0.2.4) |
|------|------|-------------|-----------|---------------------|
| `$system.time.now` | `number` | Current timestamp (ms) | Per compute() | Host-provided, traced |
| `$system.uuid` | `string` | Deterministic UUID | Per access | UUIDv5(intent+location) |
| `$input.<field>` | `any` | Intent input field | Per intent | From intent |
| `$meta.actor` | `string` | Current actor ID | Per intent | From intent |
| `$meta.authority` | `string` | Current authority | Per intent | From intent |
| `$meta.intentId` | `string` | Stable intent identifier | Per intent | From intent |
| `$item` | `T` | Current element in iteration | Per iteration | From source |
| `$acc` | `T` | Accumulator in reduce | Per iteration | From accumulate |

#### 9.3.1 Deterministic System Values (v0.2.4 CRITICAL)

**v0.2.4: System values are DETERMINISTIC and TRACEABLE.** See FDR-MEL-043.

**$system.uuid - Deterministic Generation:**
```
$system.uuid = UUIDv5(namespace, intentId + accessPath + accessIndex)

Where:
- namespace: Fixed UUID namespace for MEL
- intentId: Current $meta.intentId  
- accessPath: JSON path to code location accessing $system.uuid
- accessIndex: 0-indexed counter of uuid accesses within this compute()

Properties:
- Same intent + same code location + same index → SAME UUID
- Different access locations → different UUIDs
- Deterministic and reproducible
- Recorded in Trace for replay
```

**$system.time.now - Host-Provided, Traced:**
```
$system.time.now is provided by Host in ComputeContext
Recorded in Trace for replay

Properties:
- Same value for entire compute() call
- Replay uses recorded value, not current time
```

**Trace Recording:**
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

**Replay Semantics:**
```
On replay:
1. Load ComputeTrace for the intent
2. Provide trace.systemValues.time as $system.time.now
3. Return trace.systemValues.uuids[i] for i-th uuid access
4. compute() produces IDENTICAL output
```

**Stability Scope Definitions:**

| Scope | Meaning |
|-------|---------|
| **Per access** | Fresh (but deterministic) value on EACH access |
| **Per compute()** | Same value within one `compute()` call |
| **Per intent** | Same value for entire intent execution (all compute() calls) |
| **Per iteration** | Bound for current iteration element |

**Critical: `$system.uuid` is deterministic but fresh per access!**

```mel
// ❌ STILL WRONG: Gets different (deterministic) UUIDs!
patch tasks[$system.uuid] = {
  id: $system.uuid,  // Different UUID than key!
  title: title
}

// ✅ CORRECT: Capture UUID first
state { pendingId: string | null = null }

action addTask(title: string) {
  // Step 1: Capture UUID
  once(step1) when isNull(pendingId) {
    patch step1 = $meta.intentId
    patch pendingId = $system.uuid  // UUID #0 for this intent
  }
  
  // Step 2: Use captured UUID
  once(step2) when isNotNull(pendingId) {
    patch step2 = $meta.intentId
    patch tasks[pendingId] = {
      id: pendingId,  // Reuses captured value
      title: title
    }
    patch pendingId = null
  }
}
```

**`$system.time.now` is stable per compute():**
```mel
// All accesses within one compute() return the same timestamp
patch item.createdAt = $system.time.now
patch item.updatedAt = $system.time.now  // Same value as above ✓
```

**`$meta.intentId` is stable per intent:**
```mel
// Same value across all compute() calls within one intent
// Used for per-intent idempotency with once()
once(marker) {
  patch marker = $meta.intentId  // Stable identifier
}
```

---

## 10. Examples

### 10.1 Complete Domain Example

```mel
domain TaskManager {
  state {
    tasks: Record<string, Task> = {}
    taskIds: Array<string> | null = null
    filter: "all" | "active" | "completed" = "all"
    editingId: string | null = null
    
    // Markers for per-intent idempotency (store intentId, not timestamp)
    addingTask: string | null = null
    togglingTask: string | null = null
    deletingTask: string | null = null
    clearingCompleted: string | null = null
    loadingTaskIds: string | null = null
  }

  // Computed values (pure expressions only)
  // Note: len() only works on Array, not Record (FDR-MEL-026)
  // Note: cond() instead of if() (FDR-MEL v0.2.2)
  computed taskCount = cond(isNotNull(taskIds), len(taskIds), 0)
  computed hasAnyTasks = gt(taskCount, 0)

  // Actions (all patch/effect must be inside guards)
  action addTask(title: string) {
    // Per-intent idempotency: can add multiple tasks across different intents
    once(addingTask) when neq(trim(title), "") {
      patch addingTask = $meta.intentId  // v0.2.2: use intentId, not timestamp
      patch tasks[$system.uuid] = {
        id: $system.uuid,
        title: trim(title),
        completed: false,
        createdAt: $system.time.now
      }
    }
  }

  action toggleTask(id: string) {
    once(togglingTask) when isNotNull(tasks[id]) {
      patch togglingTask = $meta.intentId
      patch tasks[id].completed = not(tasks[id].completed)
    }
  }

  action deleteTask(id: string) {
    once(deletingTask) when isNotNull(tasks[id]) {
      patch deletingTask = $meta.intentId
      patch tasks[id] unset    // v0.2.1: unset removes key entirely
    }
  }

  action clearCompleted() {
    // v0.2.2: Use record.filter for Record types
    once(clearingCompleted) {
      patch clearingCompleted = $meta.intentId
      effect record.filter({
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
  
  action loadTaskIds() {
    once(loadingTaskIds) {
      patch loadingTaskIds = $meta.intentId
      effect record.keys({
        source: tasks,
        into: taskIds
      })
    }
  }
}
```
      patch tasks[$system.uuid] = {
        id: $system.uuid,
        title: trim(title),
        completed: false,
        createdAt: $system.time.now
      }
    }
}

action toggleTask(id: string) {
once(togglingTask) when isNotNull(tasks[id]) {
patch togglingTask = id
patch tasks[id].completed = not(tasks[id].completed)
}
}

action deleteTask(id: string) {
once(deletingTask) when isNotNull(tasks[id]) {
patch deletingTask = id
patch tasks[id] unset    // v0.2.1: unset removes key entirely
}
}

action clearCompleted() {
once(clearingCompleted) {
patch clearingCompleted = $system.time.now
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

action refreshTaskIds() {
once(taskIds) {
effect object.keys({
source: tasks,
into: taskIds
})
}
}
}
```

### 10.2 Expression Examples

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

### 10.3 Action Examples

```mel
// Simple state update
action setName(newName: string) {
  patch user.name = trim(newName)
}

// Using once() sugar
action submit() {
  once(submission.startedAt) when form.isValid {
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
    effect validate.cart({
      items: cart.items,
      into: cart.validation
    })
  }

  // Step 2: Process payment (only after validation)
  once(payment.processedAt) when cart.validation.success {
    effect payment.process({
      amount: cart.total,
      method: payment.method,
      into: payment.result
    })
  }

  // Step 3: Create order (only after payment)
  once(order.createdAt) when payment.result.success {
    effect order.create({
      items: cart.items,
      payment: payment.result.id,
      into: order.result
    })
  }
}
```

### 10.4 Effect Examples with $item

**Note (v0.2.1):** All effects must be inside guards. These examples show effect syntax; in real code, wrap in `when` or `once`.

```mel
action filterHighPriority() {
  // Filter active tasks
  once(filtered) {
    patch filtered = $system.time.now
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
    patch summarized = $system.time.now
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
    patch sorted = $system.time.now
    effect array.sort({
      source: messages,
      by: $item.timestamp,
      order: "desc",
      into: sortedMessages
    })
  }
}

action calculateTotal() {
  // Reduce to total
  once(calculated) {
    patch calculated = $system.time.now
    effect array.reduce({
      source: lineItems,
      initial: 0,
      accumulate: add($acc, mul($item.price, $item.quantity)),
      into: orderTotal
    })
  }
}

action findProduct(targetSku: string) {
  // Find specific item
  once(searched) {
    patch searched = $system.time.now
    effect array.find({
      source: products,
      where: eq($item.sku, targetSku),
      into: foundProduct
    })
  }
}
```

### 10.5 Composition Effects (flatMap, groupBy)

**v0.2.1 Pattern:** Multi-step pipelines use sequential guards. Each step waits for the previous step's result via `when isNotNull(...)`.

```mel
// ═══════════════════════════════════════════════════════════
// Scenario: Find heavy members (weight > 80) across all teams,
//           grouped by team
// ═══════════════════════════════════════════════════════════

action findHeavyMembersByTeam() {
  // Step 1: Flatten teams into members with team context
  once(step1) {
    patch step1 = $system.time.now
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
    patch step2 = $system.time.now
    effect array.filter({
      source: allMembersWithTeam,
      where: gt($item.member.weight, 80),
      into: heavyMembersWithTeam
    })
  }
  
  // Step 3: Group back by team (waits for step 2)
  once(step3) when isNotNull(heavyMembersWithTeam) {
    patch step3 = $system.time.now
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
    patch step1 = $system.time.now
    effect array.map({
      source: products,
      select: $item.category,
      into: allCategories
    })
  }
  
  once(step2) when isNotNull(allCategories) {
    patch step2 = $system.time.now
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

## 11. Migration Guide

### 11.1 From MEL v0.2.1

| v0.2.1 Syntax | v0.2.2 Syntax |
|---------------|---------------|
| `patch marker = $system.time.now` | `patch marker = $meta.intentId` |
| `if(cond, a, b)` | `cond(condition, a, b)` |
| `` `Hello ${name}` `` | `concat("Hello ", name)` |
| `effect array.filter({ source: record, ...})` | `effect record.filter({ source: record, ...})` |
| `effect object.keys(...)` | `effect record.keys(...)` |

### 11.2 From MEL v0.1/v0.2

| v0.1/v0.2 Syntax | v0.2.2 Syntax |
|------------------|---------------|
| `user.name.trim()` | `trim(user.name)` |
| `str.toLowerCase()` | `lower(str)` |
| Top-level `patch x = y` | `when cond { patch x = y }` |
| Top-level `effect ...` | `once(marker) { patch marker = $meta.intentId; effect ... }` |
| `once(m) { effect... }` | `once(m) { patch m = $meta.intentId; effect... }` |
| `when items { ... }` | `when gt(len(items), 0) { ... }` |
| `patch x = null` (to delete) | `patch x unset` |
| `len(record)` | `effect record.keys(...); len(keys)` |

### 11.3 From JavaScript/TypeScript

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

### 11.4 Common Patterns

#### Variable → State + Computed

```typescript
// JS/TS
let count = 0;
const doubled = count * 2;
count++;
```

```mel
// MEL v0.2.1
state {
  count: number = 0
  incrementedAt: number | null = null
}

computed doubled = mul(count, 2)

action increment() {
  once(incrementedAt) {
    patch incrementedAt = $system.time.now  // Explicit marker patch!
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
    patch step1 = $system.time.now
    effect array.filter({
      source: users,
      where: eq($item.active, true),
      into: activeUsers
    })
  }
  
  once(step2) when isNotNull(activeUsers) {
    patch step2 = $system.time.now
    effect array.map({
      source: activeUsers,
      select: { name: upper($item.name) },
      into: names
    })
  }
}
```

---

## Appendix A: Grammar Summary (EBNF)

```ebnf
(* ═══════════════════════════════════════════════════════════ *)
(* MEL Grammar - Manifesto Expression Language v0.2.1          *)
(* AI-Native Edition + Host Contract Alignment                 *)
(* ═══════════════════════════════════════════════════════════ *)

Program         = { ImportDecl } DomainDecl ;
ImportDecl      = "import" "{" IdentifierList "}" "from" StringLiteral ;
DomainDecl      = "domain" Identifier "{" { DomainMember } "}" ;
DomainMember    = StateDecl | ComputedDecl | ActionDecl ;

(* ─── State ─── *)
StateDecl       = "state" "{" { StateField } "}" ;
StateField      = Identifier ":" TypeExpr ( "=" Expression )? ;

(* ─── Computed ─── *)
ComputedDecl    = "computed" Identifier "=" Expression ;

(* ─── Action (v0.2.1: Guard-mandatory) ─── *)
ActionDecl      = "action" Identifier "(" [ ParamList ] ")" ActionBody ;
ParamList       = Param { "," Param } ;
Param           = Identifier ":" TypeExpr ;

(* v0.2.1: ActionBody contains ONLY guards, no top-level patch/effect *)
ActionBody      = "{" { GuardedStmt } "}" ;
GuardedStmt     = WhenStmt | OnceStmt ;

(* Guards contain inner statements *)
WhenStmt        = "when" Expression "{" { InnerStmt } "}" ;

(* v0.2.2: once takes Path, not Identifier *)
OnceStmt        = "once" "(" Path ")" [ "when" Expression ] "{" { InnerStmt } "}" ;

(* Inner statements (only allowed inside guards) *)
InnerStmt       = PatchStmt | EffectStmt | WhenStmt | OnceStmt ;

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
// Keywords (MEL v0.2.2)
domain state computed action effect when once patch
unset merge
true false null as import from export

// Reserved (future use)
async await yield class extends interface type enum
namespace module private public protected static
implements abstract final override readonly

// Reserved (JS — never to be implemented)
function var let const if else for while do switch
case break continue return throw try catch finally
new delete typeof instanceof void with debugger
this super arguments eval
```

**Note (v0.2.2):** `if` remains reserved. Use `cond(c, t, e)` for conditionals.

---

## Appendix C: AI-Native Design Summary

MEL v0.2.5 is designed with the following AI-Native principles:

| Principle | Implementation |
|-----------|----------------|
| **One pattern per concept** | Function calls only, no methods |
| **Explicit bindings** | `$item`, `$acc` for iteration variables |
| **Minimal grammar** | 19 keywords, ~30 constructs total |
| **No escape hatches** | Forbidden constructs don't parse |
| **Predictable structure** | `domain { state, computed, action }` |
| **Consistent syntax** | Every operation is `function(args)` |
| **No nested effects** | Effects are sequential, not nested |
| **Composition over nesting** | `flatMap`, `groupBy` for complex transforms |
| **Guard-mandatory mutations** | All patch/effect inside when/once (v0.2.1) |
| **Boolean-only conditions** | No truthy/falsy coercion (v0.2.1) |
| **Canonical form** | Operators normalize to functions (v0.2.1) |
| **Per-intent idempotency** | `once()` compares against `$meta.intentId` (v0.2.2) |
| **Deterministic semantics** | Same input → same output on any host (v0.2.2) |
| **Type-distinct effects** | `array.*` for Array, `record.*` for Record (v0.2.2) |
| **No template literals** | Use `concat()` for string building (v0.2.2) |
| **Strict equality** | `neq(a,b) := not(eq(a,b))` always (v0.2.3) |
| **Universal index access** | `at()` works on Array AND Record (v0.2.3) |
| **Explicit scopes** | Params > Computed > State > System (v0.2.3) |
| **Defined stability** | Each system value has defined stability scope (v0.2.3) |
| **Complete IR** | Every construct has one IR representation (v0.2.3) |
| **Call-only IR** | All operations use `{kind:'call'}` nodes (v0.2.4) |
| **Primitive-only eq/neq** | Collection comparison is compile error (v0.2.4) |
| **Deterministic system values** | UUIDs use UUIDv5, time is traced (v0.2.4) |
| **Enforced once() marker** | `patch marker = $meta.intentId` must be first (v0.2.4) |
| **$ completely prohibited** | $ cannot appear anywhere in user identifiers (v0.2.5) |
| **Specified evaluation order** | Left-to-right, key-sorted for objects (v0.2.5) |
| **Index-as-call IR** | `x[y]` is always `call(at)`, not `get` with index (v0.2.5) |
| **Normalized effect signatures** | `partition` uses `pass`/`fail`, not `into: {}` (v0.2.5) |

**For LLM implementers**: MEL code can be generated by following these patterns:

1. All operations use `functionName(arg1, arg2)` syntax
2. Property access uses `object.property` (no method calls)
3. Index access uses `array[index]` or `record[key]` — both desugar to `at()` (v0.2.3)
4. Effects use `effect type.name({ param: value, into: path })`
5. Guards use `when condition { body }` or `once(marker) { body }`
6. Iteration variables are always `$item` (current) and `$acc` (accumulator)
7. **Effects are never nested** — use sequential effects with intermediate `into:` paths
8. For nested data, use `flatMap` to flatten, then `filter`/`map`, then `groupBy` to restructure
9. **All patch/effect must be inside guards** (v0.2.1)
10. **Conditions must be boolean expressions** — no `when items`, use `when gt(len(items), 0)` (v0.2.1)
11. **Markers use intentId** — `once(m) { patch m = $meta.intentId; ... }` (v0.2.2)
12. **Use correct effect family** — `array.*` for `Array<T>`, `record.*` for `Record<K,V>` (v0.2.2)
13. **Use concat() for strings** — no template literals, use `concat("Hello ", name)` (v0.2.2)
14. **Use cond() not if()** — `cond(condition, thenValue, elseValue)` (v0.2.2)
15. **Computed can reference computed** — scope is Params > Computed > State > System (v0.2.3)
16. **$system.uuid is deterministic but fresh per access** — capture to state first if reuse needed (v0.2.4)
17. **neq(null, string) = true** — different types are never equal (v0.2.3)
18. **eq/neq are primitive-only** — cannot compare Array/Object/Record (v0.2.4)
19. **$ is completely prohibited in identifiers** — not just at start, anywhere (v0.2.5)
20. **once() marker must be first** — `patch marker = $meta.intentId` as first statement (v0.2.4)
21. **Index access is call(at)** — `x[y]` is always `{ kind: 'call', fn: 'at' }`, not get with index segment (v0.2.5)
22. **Evaluation is left-to-right** — object fields are key-sorted first, then left-to-right (v0.2.5)
23. **partition uses pass/fail** — not `into: { pass, fail }`, use top-level `pass:` and `fail:` (v0.2.5)

---

*End of MEL SPEC v0.2.5*
