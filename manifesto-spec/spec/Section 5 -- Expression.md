# Section 5 -- Expression

## 5.1 Overview

An **Expression** is a declarative, JSON-serializable structure that computes a value. Expressions are inspired by the MapGL Style Specification and provide:

- **JSON-serializable**: Expressions are data, not code
- **Side-effect free**: Pure functions only
- **Statically analyzable**: Dependencies can be extracted
- **AI-parseable**: Structured format for machine understanding

---

## 5.2 Expression Type

### 5.2.1 Type Definition

```typescript
type Expression = LiteralExpr | GetExpr | OperatorExpr | FunctionExpr;
```

### 5.2.2 Grammar

```
Expression :
  LiteralExpr |
  GetExpr |
  OperatorExpr |
  FunctionExpr

LiteralExpr : string | number | boolean | null

GetExpr : ["get", SemanticPath]

OperatorExpr : ComparisonExpr | LogicalExpr | ArithmeticExpr

FunctionExpr : ConditionalExpr | StringFn | ArrayFn | NumberFn | ObjectFn | TypeFn | DateFn
```

---

## 5.3 Literal Expressions

Literal expressions are primitive values used directly.

```typescript
type LiteralExpr = string | number | boolean | null;
```

**Example № 1** *Literal expressions*

```typescript
// String
"hello world"

// Number
42
3.14

// Boolean
true
false

// Null
null
```

---

## 5.4 Value Access

### 5.4.1 GetExpr

Retrieves a value from the snapshot using a semantic path.

```typescript
type GetExpr = ['get', SemanticPath];
```

**Example № 2** *Get expressions*

```typescript
['get', 'data.user.name']
['get', 'state.isLoading']
['get', 'derived.cartTotal']
```

### 5.4.2 Special Path References

Within array functions (`map`, `filter`, `reduce`), special path references are available:

| Reference | Meaning | Available In |
|-----------|---------|--------------|
| `$` | Current item | map, filter, every, some |
| `$index` | Current index | map, filter |
| `$acc` | Accumulator | reduce |
| `$.property` | Property of current item | map, filter |

**Example № 3** *Special references*

```typescript
// Map: double each number
['map', ['get', 'data.numbers'], ['*', ['get', '$'], 2]]

// Filter: items over $10
['filter', ['get', 'data.items'], ['>', ['get', '$.price'], 10]]

// Reduce: sum all values
['reduce', ['get', 'data.values'], ['+', ['get', '$acc'], ['get', '$']], 0]
```

### 5.4.3 IsBuiltInPath

Built-in paths are system-provided references that begin with `$`. These paths are valid only within specific expression contexts (iteration, reduction) and **MUST NOT** be treated as domain-defined paths during validation.

```
IsBuiltInPath(path):
1. Return path.startsWith('$').
```

**Behavior:**

- Built-in paths **MUST NOT** be included in dependency validation (Section 6.4)
- Built-in paths **MUST NOT** be registered in the DAG (Section 7.3)
- Built-in paths are resolved by the evaluator context, not by snapshot lookup

**Example № 3.1** *Built-in path detection*

```typescript
isBuiltInPath('$');           // true
isBuiltInPath('$.price');     // true
isBuiltInPath('$index');      // true
isBuiltInPath('$acc');        // true
isBuiltInPath('data.items');  // false
isBuiltInPath('derived.total'); // false
```

---

## 5.5 Comparison Operators

### 5.5.1 Equality

```typescript
type EqExpr = ['==', Expression, Expression];
type NeqExpr = ['!=', Expression, Expression];
```

**Semantics:**

- `==` performs deep equality comparison
- `!=` returns the inverse of `==`

**Example № 4** *Equality*

```typescript
['==', ['get', 'data.status'], 'active']
['!=', ['get', 'data.user'], null]
```

### 5.5.2 Ordering

```typescript
type GtExpr = ['>', Expression, Expression];
type GteExpr = ['>=', Expression, Expression];
type LtExpr = ['<', Expression, Expression];
type LteExpr = ['<=', Expression, Expression];
```

**Semantics:**

- Comparison uses JavaScript semantics
- Non-numeric values are coerced or return false

**Example № 5** *Ordering*

```typescript
['>', ['get', 'data.age'], 18]
['<=', ['get', 'data.price'], 100]
```

---

## 5.6 Logical Operators

### 5.6.1 Not

```typescript
type NotExpr = ['!', Expression];
```

Negates a boolean expression.

**Example № 6** *Not*

```typescript
['!', ['get', 'state.isLoading']]
```

### 5.6.2 All (And)

```typescript
type AllExpr = ['all', ...Expression[]];
```

Returns true if all expressions are truthy.

**Example № 7** *All*

```typescript
['all',
  ['get', 'derived.isValid'],
  ['>', ['get', 'data.items.length'], 0],
  ['!', ['get', 'state.isLoading']]
]
```

### 5.6.3 Any (Or)

```typescript
type AnyExpr = ['any', ...Expression[]];
```

Returns true if any expression is truthy.

**Example № 8** *Any*

```typescript
['any',
  ['==', ['get', 'data.role'], 'admin'],
  ['==', ['get', 'data.role'], 'moderator']
]
```

---

## 5.7 Arithmetic Operators

```typescript
type AddExpr = ['+', Expression, Expression];
type SubExpr = ['-', Expression, Expression];
type MulExpr = ['*', Expression, Expression];
type DivExpr = ['/', Expression, Expression];
type ModExpr = ['%', Expression, Expression];
```

**Semantics:**

- Operations follow IEEE 754 double-precision arithmetic
- Division by zero returns `Infinity` or `-Infinity`
- Non-numeric operands are coerced to numbers

**Example № 9** *Arithmetic*

```typescript
['+', ['get', 'data.subtotal'], ['get', 'data.tax']]
['*', ['get', 'data.price'], ['get', 'data.quantity']]
['%', ['get', 'data.index'], 2]  // Check if even
```

---

## 5.8 Conditional Expressions

### 5.8.1 Case

An if-else chain.

```typescript
type CaseExpr = ['case', ...CaseClause[], Expression];
type CaseClause = [Expression, Expression];
```

**Semantics:**

1. Evaluate each clause condition in order
2. Return the result of the first truthy condition
3. If no condition matches, return the default (last expression)

**Example № 10** *Case*

```typescript
['case',
  [['<', ['get', 'data.age'], 13], 'child'],
  [['<', ['get', 'data.age'], 20], 'teenager'],
  [['<', ['get', 'data.age'], 65], 'adult'],
  'senior'
]
```

### 5.8.2 Match

Pattern matching against a value.

```typescript
type MatchExpr = ['match', Expression, ...MatchClause[], Expression];
type MatchClause = [Expression, Expression];
```

**Semantics:**

1. Evaluate the match expression
2. Compare against each pattern using equality
3. Return the result of the first matching pattern
4. If no pattern matches, return the default

**Example № 11** *Match*

```typescript
['match', ['get', 'data.status'],
  ['pending', 'Waiting for approval'],
  ['approved', 'Ready to ship'],
  ['shipped', 'On the way'],
  'Unknown status'
]
```

### 5.8.3 Coalesce

Returns the first non-null value.

```typescript
type CoalesceExpr = ['coalesce', ...Expression[]];
```

**Example № 12** *Coalesce*

```typescript
['coalesce',
  ['get', 'data.nickname'],
  ['get', 'data.firstName'],
  'Anonymous'
]
```

---

## 5.9 String Functions

### 5.9.1 concat

Concatenates strings.

```typescript
type ConcatExpr = ['concat', ...Expression[]];
```

**Example № 13** *Concat*

```typescript
['concat', ['get', 'data.firstName'], ' ', ['get', 'data.lastName']]
```

### 5.9.2 upper / lower

Changes case.

```typescript
type UpperExpr = ['upper', Expression];
type LowerExpr = ['lower', Expression];
```

### 5.9.3 trim

Removes leading/trailing whitespace.

```typescript
type TrimExpr = ['trim', Expression];
```

### 5.9.4 slice

Extracts a substring.

```typescript
type SliceExpr = ['slice', Expression, number, number?];
```

**Parameters:**

- First number: Start index (inclusive)
- Second number: End index (exclusive, optional)

### 5.9.5 split / join

Converts between string and array.

```typescript
type SplitExpr = ['split', Expression, string];
type JoinExpr = ['join', Expression, string];
```

**Example № 14** *Split and join*

```typescript
['split', 'a,b,c', ',']  // ['a', 'b', 'c']
['join', ['get', 'data.tags'], ', ']  // 'tag1, tag2, tag3'
```

### 5.9.6 matches

Tests against a regular expression.

```typescript
type MatchesExpr = ['matches', Expression, string];
```

**Example № 15** *Matches*

```typescript
['matches', ['get', 'data.email'], '^[a-z]+@[a-z]+\\.[a-z]+$']
```

### 5.9.7 replace

Replaces occurrences in a string.

```typescript
type ReplaceExpr = ['replace', Expression, string, string];
```

---

## 5.10 Array Functions

### 5.10.1 length

Returns array or string length.

```typescript
type LengthExpr = ['length', Expression];
```

### 5.10.2 at / first / last

Access array elements.

```typescript
type AtExpr = ['at', Expression, number];
type FirstExpr = ['first', Expression];
type LastExpr = ['last', Expression];
```

### 5.10.3 includes / indexOf

Search array.

```typescript
type IncludesExpr = ['includes', Expression, Expression];
type IndexOfExpr = ['indexOf', Expression, Expression];
```

### 5.10.4 map

Transforms each element.

```typescript
type MapExpr = ['map', Expression, Expression];
```

**Example № 16** *Map*

```typescript
// Extract names from users
['map', ['get', 'data.users'], ['get', '$.name']]

// Double all numbers
['map', ['get', 'data.numbers'], ['*', ['get', '$'], 2]]
```

### 5.10.5 filter

Filters elements by condition.

```typescript
type FilterExpr = ['filter', Expression, Expression];
```

**Example № 17** *Filter*

```typescript
// Filter active users
['filter', ['get', 'data.users'], ['==', ['get', '$.active'], true]]

// Filter items over $10
['filter', ['get', 'data.items'], ['>', ['get', '$.price'], 10]]
```

### 5.10.6 every / some

Test conditions across array.

```typescript
type EveryExpr = ['every', Expression, Expression];
type SomeExpr = ['some', Expression, Expression];
```

**Example № 18** *Every and some*

```typescript
// All items in stock
['every', ['get', 'data.items'], ['>', ['get', '$.stock'], 0]]

// Any item on sale
['some', ['get', 'data.items'], ['get', '$.onSale']]
```

### 5.10.7 reduce

Reduces array to single value.

```typescript
type ReduceExpr = ['reduce', Expression, Expression, Expression];
```

**Parameters:**

1. Array expression
2. Reducer expression (uses `$acc` and `$`)
3. Initial accumulator value

**Example № 19** *Reduce*

```typescript
// Sum all prices
['reduce', ['get', 'data.items'],
  ['+', ['get', '$acc'], ['get', '$.price']],
  0
]

// Calculate total with quantity
['reduce', ['get', 'data.cart.items'],
  ['+', ['get', '$acc'], ['*', ['get', '$.price'], ['get', '$.quantity']]],
  0
]
```

### 5.10.8 flatten

Flattens nested arrays.

```typescript
type FlattenExpr = ['flatten', Expression];
```

### 5.10.9 unique

Removes duplicates.

```typescript
type UniqueExpr = ['unique', Expression];
```

### 5.10.10 sort

Sorts array.

```typescript
type SortExpr = ['sort', Expression, Expression?];
```

**Parameters:**

1. Array expression
2. Optional: Sort key expression (uses `$`)

### 5.10.11 reverse

Reverses array order.

```typescript
type ReverseExpr = ['reverse', Expression];
```

---

## 5.11 Number Functions

### 5.11.1 Aggregation Functions

```typescript
type SumExpr = ['sum', Expression];
type MinExpr = ['min', Expression];
type MaxExpr = ['max', Expression];
type AvgExpr = ['avg', Expression];
type CountExpr = ['count', Expression];
```

**Example № 20** *Aggregation*

```typescript
['sum', ['get', 'data.values']]
['avg', ['map', ['get', 'data.reviews'], ['get', '$.rating']]]
['count', ['filter', ['get', 'data.items'], ['get', '$.active']]]
```

### 5.11.2 Rounding Functions

```typescript
type RoundExpr = ['round', Expression, number?];
type FloorExpr = ['floor', Expression];
type CeilExpr = ['ceil', Expression];
```

### 5.11.3 Other Number Functions

```typescript
type AbsExpr = ['abs', Expression];
type ClampExpr = ['clamp', Expression, number, number];
```

**Example № 21** *Clamp*

```typescript
['clamp', ['get', 'data.quantity'], 1, 99]  // Between 1 and 99
```

---

## 5.12 Object Functions

### 5.12.1 has

Checks if property exists.

```typescript
type HasExpr = ['has', Expression, string];
```

### 5.12.2 keys / values / entries

Get object parts.

```typescript
type KeysExpr = ['keys', Expression];
type ValuesExpr = ['values', Expression];
type EntriesExpr = ['entries', Expression];
```

### 5.12.3 pick / omit

Create subset of object.

```typescript
type PickExpr = ['pick', Expression, ...string[]];
type OmitExpr = ['omit', Expression, ...string[]];
```

**Example № 22** *Pick and omit*

```typescript
['pick', ['get', 'data.user'], 'name', 'email']
['omit', ['get', 'data.user'], 'password', 'ssn']
```

---

## 5.13 Type Functions

### 5.13.1 Type Checking

```typescript
type IsNullExpr = ['isNull', Expression];
type IsNumberExpr = ['isNumber', Expression];
type IsStringExpr = ['isString', Expression];
type IsArrayExpr = ['isArray', Expression];
type IsObjectExpr = ['isObject', Expression];
```

### 5.13.2 Type Conversion

```typescript
type ToNumberExpr = ['toNumber', Expression];
type ToStringExpr = ['toString', Expression];
```

---

## 5.14 Date Functions

### 5.14.1 now

Returns current timestamp.

```typescript
type NowExpr = ['now'];
```

### 5.14.2 date

Parses date string.

```typescript
type DateExpr = ['date', Expression];
```

### 5.14.3 Date Parts

```typescript
type YearExpr = ['year', Expression];
type MonthExpr = ['month', Expression];
type DayExpr = ['day', Expression];
```

### 5.14.4 diff

Calculates date difference.

```typescript
type DiffExpr = ['diff', Expression, Expression, string];
```

**Parameters:**

1. First date
2. Second date
3. Unit: 'days' | 'hours' | 'minutes' | 'seconds'

**Example № 23** *Date diff*

```typescript
['diff', ['now'], ['get', 'data.createdAt'], 'days']
```

---

## 5.15 Evaluation Context

### 5.15.1 Type Definition

```typescript
type EvaluationContext = {
  get: (path: SemanticPath) => unknown;
  current?: unknown;
  index?: number;
  accumulator?: unknown;
};
```

| Field | Type | Description |
|-------|------|-------------|
| `get` | function | Retrieves value by path |
| `current` | unknown | Current item in map/filter |
| `index` | number | Current index in map/filter |
| `accumulator` | unknown | Accumulator in reduce |

### 5.15.2 Context Usage

The evaluation context is created by the runtime and passed to the evaluator:

```
CreateEvaluationContext(snapshot):
1. Return {
     get: (path) => GetValueByPath(snapshot, path)
   }.
```

For array operations, the context is extended:

```
ExtendContextForIteration(context, item, index):
1. Return {
     get: (path) => {
       if path starts with "$.", return GetProperty(item, path.slice(2))
       if path === "$", return item
       if path === "$index", return index
       return context.get(path)
     },
     current: item,
     index: index
   }.
```

---

## 5.16 Evaluation Algorithm

```
Evaluate(expr, context):
1. If {expr} is null, return null.
2. If {expr} is a string, number, or boolean, return {expr}.
3. If {expr} is not an array, throw EvaluationError("Invalid expression").
4. Let [{op}, ...{args}] be {expr}.
5. Match {op}:
   a. "get": return EvalGet({args}[0], {context}).
   b. "==": return Evaluate({args}[0], {context}) === Evaluate({args}[1], {context}).
   c. "!=": return Evaluate({args}[0], {context}) !== Evaluate({args}[1], {context}).
   d. ">": return Evaluate({args}[0], {context}) > Evaluate({args}[1], {context}).
   e. ">=": return Evaluate({args}[0], {context}) >= Evaluate({args}[1], {context}).
   f. "<": return Evaluate({args}[0], {context}) < Evaluate({args}[1], {context}).
   g. "<=": return Evaluate({args}[0], {context}) <= Evaluate({args}[1], {context}).
   h. "!": return !Evaluate({args}[0], {context}).
   i. "all": return All({args}, {context}).
   j. "any": return Any({args}, {context}).
   k. "+": return Evaluate({args}[0], {context}) + Evaluate({args}[1], {context}).
   l. "-": return Evaluate({args}[0], {context}) - Evaluate({args}[1], {context}).
   m. "*": return Evaluate({args}[0], {context}) * Evaluate({args}[1], {context}).
   n. "/": return Evaluate({args}[0], {context}) / Evaluate({args}[1], {context}).
   o. "%": return Evaluate({args}[0], {context}) % Evaluate({args}[1], {context}).
   p. "case": return EvalCase({args}, {context}).
   q. "match": return EvalMatch({args}, {context}).
   r. "coalesce": return EvalCoalesce({args}, {context}).
   s. "map": return EvalMap({args}, {context}).
   t. "filter": return EvalFilter({args}, {context}).
   u. "reduce": return EvalReduce({args}, {context}).
   [... continue for all operators ...]
6. Throw EvaluationError("Unknown operator: " + {op}).
```

---

## 5.17 Dependency Extraction

Expressions can be analyzed to extract path dependencies.

```
ExtractPaths(expr):
1. If {expr} is null or a primitive, return empty set.
2. If {expr} is not an array, return empty set.
3. Let [{op}, ...{args}] be {expr}.
4. If {op} is "get" and {args}[0] is a string:
   a. If {args}[0] does not start with "$":
      i. Return set containing {args}[0].
5. Let {paths} be an empty set.
6. For each {arg} in {args}:
   a. Union {paths} with ExtractPaths({arg}).
7. Return {paths}.
```

**Example № 24** *Dependency extraction*

```typescript
const expr = ['+', ['get', 'data.price'], ['*', ['get', 'data.tax'], 0.1]];
extractPaths(expr);  // Set { 'data.price', 'data.tax' }
```

---

## 5.18 Expression Validation

### 5.18.1 isValidExpression

```
IsValidExpression(expr):
1. If {expr} is null, return true.
2. If {expr} is a string, number, or boolean, return true.
3. If {expr} is not an array, return false.
4. If {expr} is empty, return false.
5. Let [{op}, ...{args}] be {expr}.
6. If {op} is not a known operator, return false.
7. If {args} count does not match operator requirements, return false.
8. For each {arg} in {args}:
   a. If IsValidExpression({arg}) is false, return false.
9. Return true.
```

### 5.18.2 isPureExpression

All expressions in this specification are pure. An expression is pure if:

1. It has no side effects
2. Given the same inputs, it always produces the same output
3. It does not depend on external state beyond the snapshot

A conforming implementation **MUST** ensure all expressions are pure.

---

## 5.19 Evaluation Result Type

### 5.19.1 EvalResult Type

Expression evaluation returns an `EvalResult` type for explicit error handling:

```typescript
type EvalResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };
```

| Variant | Field | Type | Description |
|---------|-------|------|-------------|
| Success | `ok` | `true` | Indicates successful evaluation |
| Success | `value` | `T` | The evaluated result |
| Failure | `ok` | `false` | Indicates evaluation failure |
| Failure | `error` | `string` | Error message describing the failure |

### 5.19.2 evaluate Function

A conforming implementation **MUST** provide an `evaluate` function:

```typescript
function evaluate(expr: Expression, ctx: EvaluationContext): EvalResult;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `expr` | Expression | The expression to evaluate |
| `ctx` | EvaluationContext | Context providing path resolution |

**Returns:** `EvalResult` containing either the evaluated value or an error message.

### 5.19.3 Error Conditions

The `evaluate` function returns an error result for:

| Error Condition | Error Message Pattern |
|-----------------|----------------------|
| Unknown operator | `"Unknown operator: {op}"` |
| Invalid expression structure | `"Invalid expression: expected array"` |
| Path not found | `"Path not found: {path}"` |
| Type mismatch | `"Type error: expected {expected}, got {actual}"` |
| Division by zero | `"Division by zero"` |
| Invalid array operation | `"Cannot perform {op} on non-array"` |

**Example № 25** *Using evaluate with error handling*

```typescript
const expr: Expression = ['+', ['get', 'data.price'], ['get', 'data.tax']];
const result = evaluate(expr, context);

if (result.ok) {
  console.log('Result:', result.value);
} else {
  console.error('Evaluation failed:', result.error);
}
```
