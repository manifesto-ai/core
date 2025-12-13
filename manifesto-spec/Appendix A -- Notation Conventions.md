# Appendix A -- Notation Conventions

This appendix defines the notation conventions used throughout this specification.

---

## A.1 RFC 2119 Keywords

This specification uses keywords from [RFC 2119](https://tools.ietf.org/html/rfc2119) to indicate requirement levels. These keywords are always displayed in **bold uppercase**.

| Keyword | Meaning |
|---------|---------|
| **MUST** | This word, or the terms "REQUIRED" or "SHALL", means that the definition is an absolute requirement of the specification. |
| **MUST NOT** | This phrase, or the phrase "SHALL NOT", means that the definition is an absolute prohibition of the specification. |
| **SHOULD** | This word, or the adjective "RECOMMENDED", means that there may exist valid reasons in particular circumstances to ignore a particular item, but the full implications must be understood and carefully weighed before choosing a different course. |
| **SHOULD NOT** | This phrase, or the phrase "NOT RECOMMENDED", means that there may exist valid reasons in particular circumstances when the particular behavior is acceptable or even useful, but the full implications should be understood and the case carefully weighed before implementing any behavior described with this label. |
| **MAY** | This word, or the adjective "OPTIONAL", means that an item is truly optional. |

---

## A.2 Normative and Non-normative Content

### Normative Content

Normative content defines requirements that conforming implementations MUST follow. Normative statements use RFC 2119 keywords.

Example of normative content:

> A DomainSnapshot **MUST** contain exactly four top-level fields: `data`, `state`, `derived`, and `validity`.

### Non-normative Content

Non-normative content provides explanatory information, examples, and notes. Non-normative content does not impose implementation requirements.

Non-normative content is indicated by:

1. Sections explicitly marked as *Non-normative*
2. Examples prefixed with "Example №"
3. Notes prefixed with "Note:"
4. Paragraphs beginning with "For example," or "Consider..."

---

## A.3 Grammar Notation

This specification uses a modified BNF (Backus-Naur Form) notation for defining grammar rules.

### Basic Syntax

```
RuleName : Definition
```

A rule definition may contain:

| Notation | Meaning |
|----------|---------|
| `RuleName` | Reference to another rule |
| `"literal"` | Literal string (exact match) |
| `A B` | Sequence (A followed by B) |
| `A \| B` | Alternative (A or B) |
| `A?` | Optional (zero or one A) |
| `A*` | Zero or more A |
| `A+` | One or more A |
| `(A B)` | Grouping |
| `[a-z]` | Character class |

### Example

```
SemanticPath : Namespace "." PathSegment+

Namespace : "data" | "state" | "derived" | "actions"

PathSegment : Identifier | IndexAccess

Identifier : [a-zA-Z_] [a-zA-Z0-9_]*

IndexAccess : "[" Integer "]"

Integer : [0-9]+
```

---

## A.4 Algorithm Notation

Algorithms are presented in numbered-step format. Steps may contain sub-steps indicated by letters and roman numerals.

### Format

```
AlgorithmName(parameter1, parameter2):
1. Let {variable} be {value or expression}.
2. If {condition}:
   a. {action}
   b. {action}
3. For each {item} in {collection}:
   a. {action}
4. Return {result}.
```

### Conventions

| Notation | Meaning |
|----------|---------|
| `{variable}` | Reference to a variable or concept |
| `Let {x} be {y}` | Assignment |
| `Set {x} to {y}` | Mutation |
| `If {cond}:` | Conditional branch |
| `For each {x} in {y}:` | Iteration |
| `Return {x}` | Algorithm result |
| `Throw {error}` | Error condition |

### Example

```
GetValueByPath(snapshot, path):
1. Let {namespace} be the first segment of {path} before ".".
2. Let {subPath} be {path} with the namespace prefix removed.
3. If {namespace} is "data":
   a. Return GetNestedValue({snapshot}.data, {subPath}).
4. If {namespace} is "state":
   a. Return GetNestedValue({snapshot}.state, {subPath}).
5. If {namespace} is "derived":
   a. If {subPath} exists in {snapshot}.derived:
      i. Return {snapshot}.derived[{subPath}].
   b. Return undefined.
6. Return undefined.
```

---

## A.5 Type Notation

Types are presented using TypeScript-like syntax for familiarity. This notation is used for explanatory purposes and does not mandate TypeScript as an implementation language.

### Basic Types

| Notation | Description |
|----------|-------------|
| `string` | Unicode string |
| `number` | IEEE 754 double-precision floating-point |
| `boolean` | `true` or `false` |
| `null` | Null value |
| `unknown` | Any value |
| `void` | No value |

### Compound Types

| Notation | Description |
|----------|-------------|
| `T[]` | Array of T |
| `Record<K, V>` | Object with keys of type K and values of type V |
| `T \| U` | Union (T or U) |
| `T & U` | Intersection (T and U) |
| `T?` | Optional T (T or undefined) |

### Type Definitions

```typescript
type TypeName = {
  field1: Type1;
  field2?: Type2;  // optional field
};
```

---

## A.6 Example Notation

Examples are presented in code blocks with language annotations.

### Valid Examples

Valid examples demonstrate correct usage:

**Example № 1** *Creating a snapshot*

```typescript
const snapshot = createSnapshot(
  { count: 0 },      // initial data
  { loading: false } // initial state
);
```

### Counter-examples

Counter-examples demonstrate invalid usage and are marked explicitly:

**Counter-example № 1** *Invalid: Writing to derived namespace*

```typescript
// Error: derived paths are read-only
runtime.set('derived.total', 100);
```

### Notes

Notes provide additional context or clarification:

> **Note:** This behavior differs from previous versions of the specification.

---

## A.7 Semantic Path Notation

Semantic paths are displayed in monospace font and follow dot notation:

- `data.user.name` - Path to user name in data namespace
- `state.isLoading` - Path to loading state
- `derived.cartTotal` - Path to computed cart total
- `actions.checkout` - Reference to checkout action

Path patterns may include special characters:

| Pattern | Meaning |
|---------|---------|
| `*` | Single segment wildcard |
| `[n]` | Array index access |
| `["key"]` | String key access |

---

## A.8 Diagram Conventions

Diagrams use the following conventions:

```
┌─────────────┐
│   Box       │  Rectangle: Component or concept
└─────────────┘

────────────►  Arrow: Data flow or dependency

- - - - - - ►  Dashed arrow: Optional or conditional flow

┌─────────────┐
│   [Label]   │  Bracketed label: Type or category
└─────────────┘
```

---

## A.9 Cross-references

Cross-references to other sections use the format:

- "See Section 2.3" - Reference to section
- "See Algorithm GetValueByPath" - Reference to algorithm
- "See Type DomainSnapshot" - Reference to type definition

---

## A.10 Document Conventions

### Section Numbering

Sections are numbered hierarchically:

- `1` - Top-level section
- `1.1` - Subsection
- `1.1.1` - Sub-subsection

### Definition Lists

Terms being defined are displayed in **bold** on first use:

> A **DomainSnapshot** represents the complete state of a domain at a specific point in time.
