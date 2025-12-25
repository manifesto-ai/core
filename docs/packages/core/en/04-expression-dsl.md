# Expression DSL

```typescript
import { evaluate, analyzeExpression } from '@manifesto-ai/core';

// Calculate order total
const totalExpr = ['-',
  ['sum', ['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]],
  ['get', 'derived.discount']
];

// Evaluate
const result = evaluate(totalExpr, {
  get: (path) => runtime.get(path)
});

if (result.ok) {
  console.log('Total:', result.value);  // Total: 27000
}

// Analyze
const analysis = analyzeExpression(totalExpr);
console.log(analysis.directDeps);  // ['data.items', 'derived.discount']
console.log(analysis.operators);   // ['-', 'sum', 'map', '*', 'get']
```

## Why JSON-based DSL

### Serializable

Expressions can be serialized as JSON for storage, transmission, and comparison:

```typescript
// Database storage
const saved = JSON.stringify(expr);

// Network transmission
await fetch('/api/rules', { body: JSON.stringify({ rule: expr }) });

// Structure comparison
const isSame = JSON.stringify(expr1) === JSON.stringify(expr2);
```

### AI Friendly

AI can read, write, and modify Expressions:

```typescript
// AI can understand
const rule = ['all',
  ['>', ['get', 'data.age'], 18],
  ['!=', ['get', 'data.email'], null]
];
// "Returns true if data.age is greater than 18 AND data.email is not null"

// AI can generate
// "Create a condition where user is premium OR purchase amount is $50 or more"
const aiGenerated = ['any',
  ['==', ['get', 'data.membership'], 'premium'],
  ['>=', ['get', 'derived.total'], 50000]
];
```

### Static Analysis

Expressions can be analyzed before execution:

```typescript
const analysis = analyzeExpression(expr);

// What paths does it depend on?
analysis.directDeps;  // ['data.items', 'data.couponCode']

// What operators does it use?
analysis.operators;   // ['sum', 'map', '*', 'get']

// How complex is it?
analysis.complexity;  // 12

// Does it use iteration context?
analysis.usesContext; // true (uses $.price etc.)
```

---

## Syntax Format

### Tuple Syntax

All operations are expressed as arrays:

```typescript
['operator', arg1, arg2, ...]
```

The first element is the operator, and the rest are arguments:

```typescript
['>', 5, 3]                    // 5 > 3
['+', 10, 20]                  // 10 + 20
['concat', 'Hello', ' World']  // 'Hello World'
```

### Literal Values

Basic types are used as-is:

```typescript
'hello'  // string
42       // number
true     // boolean
null     // null
```

### Array Literals

Arrays that don't start with a string operator are treated as data literals:

```typescript
[10, 20, 30]              // Array literal → [10, 20, 30]
['a', 'b', 'c']           // String array starts with string, but not an operator
[1, 'mixed', true]        // Mixed types array literal

// Contrast with operator expressions:
['concat', 'a', 'b']      // Operator expression → 'ab'
['+', 1, 2]               // Operator expression → 3
```

This enables direct use of array data in expressions:

```typescript
// Using array literal as default value
['coalesce', ['get', 'data.items'], []]

// Comparing with array literal
['==', ['get', 'data.status'], ['pending', 'draft']]
```

---

## Value Access

### get

Reads a value from a path:

```typescript
['get', 'data.user.name']        // data.user.name value
['get', 'derived.total']         // derived.total value
['get', 'state.isSubmitting']    // state.isSubmitting value
```

### Context Reference

Reference the current item within iteration functions like `map`, `filter`:

```typescript
// $  - entire current item
// $.field - field of current item

// Calculate price * quantity
['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]

// Filter incomplete items
['filter', ['get', 'data.todos'], ['!', '$.completed']]

// Extract product names
['map', ['get', 'data.items'], '$.name']
```

---

## Comparison Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `==` | Equal | `['==', ['get', 'data.status'], 'active']` |
| `!=` | Not equal | `['!=', ['get', 'data.email'], null]` |
| `>` | Greater than | `['>', ['get', 'data.age'], 18]` |
| `>=` | Greater or equal | `['>=', ['get', 'derived.total'], 50000]` |
| `<` | Less than | `['<', ['get', 'data.quantity'], 10]` |
| `<=` | Less or equal | `['<=', ['get', 'data.price'], 100000]` |

```typescript
// Check if adult
['>=', ['get', 'data.age'], 18]

// Check if active status
['==', ['get', 'data.status'], 'active']

// Check if in stock
['>', ['get', 'data.stock'], 0]
```

---

## Logical Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `!` | NOT | `['!', ['get', 'state.isLoading']]` |
| `all` | AND (all true) | `['all', expr1, expr2, expr3]` |
| `any` | OR (any true) | `['any', expr1, expr2, expr3]` |

```typescript
// NOT: not loading
['!', ['get', 'state.isLoading']]

// AND: cart has items AND not submitting
['all',
  ['>', ['length', ['get', 'data.items']], 0],
  ['!', ['get', 'state.isSubmitting']]
]

// OR: admin OR premium member
['any',
  ['==', ['get', 'data.role'], 'admin'],
  ['==', ['get', 'data.membership'], 'premium']
]
```

---

## Arithmetic Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `+` | Addition | `['+', 10, 20]` → `30` |
| `-` | Subtraction | `['-', 100, 30]` → `70` |
| `*` | Multiplication | `['*', 5, 3]` → `15` |
| `/` | Division | `['/', 100, 4]` → `25` |
| `%` | Modulo | `['%', 10, 3]` → `1` |

```typescript
// price * quantity
['*', ['get', '$.price'], ['get', '$.quantity']]

// subtotal - discount
['-', ['get', 'derived.subtotal'], ['get', 'derived.discount']]

// Add 10% tax
['+', ['get', 'derived.subtotal'], ['*', ['get', 'derived.subtotal'], 0.1]]
```

---

## Conditional Operators

### case

An if-else chain. List condition-result pairs and put a default value at the end:

```typescript
['case',
  [condition1, result1],
  [condition2, result2],
  defaultValue
]
```

```typescript
// Calculate grade
['case',
  [['>=', ['get', 'data.score'], 90], 'A'],
  [['>=', ['get', 'data.score'], 80], 'B'],
  [['>=', ['get', 'data.score'], 70], 'C'],
  'F'
]

// Calculate shipping fee
['case',
  [['>=', ['get', 'derived.subtotal'], 50000], 0],     // Free for $50+
  [['>=', ['get', 'derived.subtotal'], 30000], 2000],  // $2 for $30+
  3000                                                   // Default $3
]
```

### match

Value pattern matching:

```typescript
['match', valueToCheck,
  [pattern1, result1],
  [pattern2, result2],
  defaultValue
]
```

```typescript
// Message based on status
['match', ['get', 'data.status'],
  ['pending', 'Pending'],
  ['processing', 'Processing'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
  'Unknown'
]
```

### coalesce

Returns the first non-null value:

```typescript
['coalesce', expr1, expr2, expr3]
```

```typescript
// Use nickname, or name, or 'Anonymous'
['coalesce',
  ['get', 'data.nickname'],
  ['get', 'data.name'],
  'Anonymous'
]
```

---

## Polymorphic Operators

Some operators work on both strings and arrays, automatically detecting the input type. This enables flexible data manipulation without type-specific operators.

| Operator | String | Array | Example |
|----------|--------|-------|---------|
| `concat` | Concatenate strings | Merge arrays | `['concat', [1,2], [3,4]]` → `[1,2,3,4]` |
| `length` | String length | Array length | `['length', 'hello']` → `5` |
| `slice` | Substring | Subarray | `['slice', [1,2,3,4], 1, 3]` → `[2,3]` |
| `includes` | Contains substring | Contains element | `['includes', [1,2,3], 2]` → `true` |
| `indexOf` | Char/substring position | Element position | `['indexOf', [1,2,3], 2]` → `1` |
| `at` | Character at index | Element at index | `['at', 'hello', 1]` → `'e'` |
| `isEmpty` | Empty string check | Empty array check | `['isEmpty', []]` → `true` |

```typescript
// String mode
['concat', 'Hello', ' ', 'World']   // 'Hello World'
['length', 'hello']                  // 5
['slice', 'hello', 1, 4]            // 'ell'
['includes', 'hello', 'ell']        // true
['indexOf', 'hello', 'l']           // 2
['at', 'hello', 1]                  // 'e'
['isEmpty', '']                     // true

// Array mode
['concat', [1, 2], [3, 4]]          // [1, 2, 3, 4]
['concat', [1], [2], [3]]           // [1, 2, 3]
['length', [1, 2, 3]]               // 3
['slice', [1, 2, 3, 4], 1, 3]       // [2, 3]
['includes', [1, 2, 3], 2]          // true
['indexOf', ['a', 'b', 'c'], 'b']   // 1
['at', [10, 20, 30], -1]            // 30 (negative index)
['isEmpty', []]                     // true
```

---

## Array Functions

### Basic Functions

| Function | Description | Example |
|----------|-------------|---------|
| `length` | Length (polymorphic) | `['length', ['get', 'data.items']]` |
| `at` | Index access (polymorphic) | `['at', ['get', 'data.items'], 0]` |
| `first` | First element | `['first', ['get', 'data.items']]` |
| `last` | Last element | `['last', ['get', 'data.items']]` |
| `includes` | Contains (polymorphic) | `['includes', ['get', 'data.tags'], 'sale']` |
| `indexOf` | Find index (polymorphic) | `['indexOf', ['get', 'data.items'], 'A']` |

### Transform Functions

```typescript
// map: Transform each item
['map', ['get', 'data.items'], '$.name']
// ['Product A', 'Product B', 'Product C']

// filter: Only items matching condition
['filter', ['get', 'data.items'], ['>', '$.price', 10000]]
// Items where price > 10000

// flatten: Flatten nested arrays
['flatten', [[1, 2], [3, 4]]]
// [1, 2, 3, 4]

// unique: Remove duplicates
['unique', [1, 2, 2, 3, 3, 3]]
// [1, 2, 3]

// sort: Sort
['sort', ['get', 'data.items'], '$.price']
// Ascending by price

// reverse: Reverse order
['reverse', ['get', 'data.items']]
```

### Validation Functions

```typescript
// every: All items satisfy condition
['every', ['get', 'data.items'], ['>', '$.quantity', 0]]
// Are all item quantities greater than 0?

// some: Any item satisfies condition
['some', ['get', 'data.items'], ['==', '$.category', 'food']]
// Is there any food item?
```

### reduce

Accumulation operation:

```typescript
['reduce', array, accumulationExpr, initialValue]
```

```typescript
// Calculate sum (same as sum)
['reduce', ['get', 'data.prices'], ['+', '$acc', '$'], 0]

// Find maximum (same as max)
['reduce', ['get', 'data.scores'],
  ['case', [['>', '$', '$acc'], '$'], '$acc'],
  0
]
```

### Manipulation Functions

Functions for adding elements to arrays:

| Function | Description | Example |
|----------|-------------|---------|
| `append` | Add to end | `['append', [1, 2], 3]` → `[1, 2, 3]` |
| `prepend` | Add to beginning | `['prepend', [1, 2], 0]` → `[0, 1, 2]` |

```typescript
// Add item to cart
['append', ['get', 'data.cartItems'], newItem]

// Add urgent message to front
['prepend', ['get', 'data.messages'], urgentMessage]

// Build array step by step
['append', ['append', [], 'first'], 'second']
// ['first', 'second']
```

### FP Pattern Functions

Functional programming patterns for array manipulation:

| Function | Description | Example |
|----------|-------------|---------|
| `take` | First n elements | `['take', [1,2,3,4], 2]` → `[1, 2]` |
| `drop` | Skip first n | `['drop', [1,2,3,4], 2]` → `[3, 4]` |
| `find` | First matching element | `['find', arr, ['>', '$', 10]]` |
| `findIndex` | Index of first match | `['findIndex', arr, ['==', '$.id', 'x']]` |
| `isEmpty` | Check if empty (polymorphic) | `['isEmpty', []]` → `true` |
| `range` | Generate number sequence | `['range', 1, 5]` → `[1, 2, 3, 4, 5]` |

```typescript
// Pagination: get first 10 items
['take', ['get', 'data.items'], 10]

// Pagination: page 2 (skip 10, take next 10)
['take', ['drop', ['get', 'data.items'], 10], 10]

// Find first incomplete todo
['find', ['get', 'data.todos'], ['!', '$.completed']]
// Returns the todo object or undefined

// Find index of item by ID
['findIndex', ['get', 'data.items'], ['==', '$.id', 'target-id']]
// Returns index or -1

// Check if cart is empty
['isEmpty', ['get', 'data.cartItems']]

// Generate page numbers
['range', 1, ['get', 'derived.totalPages']]
// [1, 2, 3, 4, 5] for 5 pages
```

### Advanced Transformation Functions

Complex transformations for data processing:

| Function | Description | Example |
|----------|-------------|---------|
| `zip` | Pair elements from two arrays | `['zip', [1,2], ['a','b']]` → `[[1,'a'], [2,'b']]` |
| `partition` | Split by condition | `['partition', arr, pred]` → `[truthy, falsy]` |
| `groupBy` | Group by key expression | `['groupBy', users, '$.role']` → `{admin: [...], user: [...]}` |
| `chunk` | Split into fixed-size chunks | `['chunk', [1,2,3,4], 2]` → `[[1,2], [3,4]]` |
| `compact` | Remove falsy values | `['compact', [0, 1, null, 2, '', 3]]` → `[1, 2, 3]` |

```typescript
// Pair names with scores
['zip', ['get', 'data.names'], ['get', 'data.scores']]
// [['Alice', 95], ['Bob', 87], ['Carol', 92]]

// Separate active/inactive users
['partition', ['get', 'data.users'], '$.isActive']
// [[active users], [inactive users]]

// Group orders by status
['groupBy', ['get', 'data.orders'], '$.status']
// { pending: [...], shipped: [...], delivered: [...] }

// Create paginated chunks
['chunk', ['get', 'data.items'], 10]
// [[first 10], [next 10], ...]

// Clean data by removing nulls and empty strings
['compact', ['get', 'data.optionalValues']]
// Only truthy values remain
```

---

## Number Functions

| Function | Description | Example |
|----------|-------------|---------|
| `sum` | Sum | `['sum', ['get', 'data.prices']]` |
| `min` | Minimum | `['min', ['get', 'data.scores']]` |
| `max` | Maximum | `['max', ['get', 'data.scores']]` |
| `avg` | Average | `['avg', ['get', 'data.ratings']]` |
| `count` | Count | `['count', ['get', 'data.items']]` |
| `round` | Round | `['round', 3.7]` → `4` |
| `floor` | Floor | `['floor', 3.9]` → `3` |
| `ceil` | Ceiling | `['ceil', 3.1]` → `4` |
| `abs` | Absolute | `['abs', -5]` → `5` |
| `clamp` | Clamp range | `['clamp', 15, 0, 10]` → `10` |

```typescript
// Order total
['sum', ['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]]

// Price range
['concat',
  ['toString', ['min', ['map', ['get', 'data.items'], '$.price']]],
  ' ~ ',
  ['toString', ['max', ['map', ['get', 'data.items'], '$.price']]]
]

// Round tax (2 decimal places)
['round', ['*', ['get', 'derived.subtotal'], 0.1], 2]
```

---

## String Functions

| Function | Description | Example |
|----------|-------------|---------|
| `concat` | Concatenate (polymorphic) | `['concat', 'Hello', ' ', 'World']` |
| `upper` | Uppercase | `['upper', 'hello']` → `'HELLO'` |
| `lower` | Lowercase | `['lower', 'HELLO']` → `'hello'` |
| `trim` | Trim whitespace | `['trim', '  hello  ']` → `'hello'` |
| `slice` | Substring (polymorphic) | `['slice', 'hello', 0, 2]` → `'he'` |
| `split` | Split | `['split', 'a,b,c', ',']` → `['a','b','c']` |
| `join` | Join | `['join', ['get', 'data.tags'], ', ']` |
| `matches` | Regex match | `['matches', 'test@email.com', '^.+@.+$']` |
| `replace` | Replace | `['replace', 'hello world', 'world', 'manifesto']` |

```typescript
// Full name
['concat', ['get', 'data.lastName'], ' ', ['get', 'data.firstName']]

// Email format validation
['matches', ['get', 'data.email'], '^[^@]+@[^@]+\\.[^@]+$']

// Product list string
['join', ['map', ['get', 'data.items'], '$.name'], ', ']
// 'Product A, Product B, Product C'
```

---

## Object Functions

| Function | Description | Example |
|----------|-------------|---------|
| `has` | Check key exists | `['has', ['get', 'data.user'], 'email']` |
| `keys` | Key list | `['keys', ['get', 'data.user']]` |
| `values` | Value list | `['values', ['get', 'data.user']]` |
| `entries` | Key-value pairs | `['entries', ['get', 'data.user']]` |
| `pick` | Select specific keys | `['pick', ['get', 'data.user'], 'id', 'name']` |
| `omit` | Exclude specific keys | `['omit', ['get', 'data.user'], 'password']` |
| `assoc` | Add/update key-value (immutable) | `['assoc', obj, 'name', 'John']` |
| `dissoc` | Remove key (immutable) | `['dissoc', obj, 'password']` |
| `merge` | Merge objects (immutable) | `['merge', obj1, obj2]` |

```typescript
// Check if email field exists
['has', ['get', 'data.user'], 'email']

// Extract only needed fields
['pick', ['get', 'data.order'], 'id', 'status', 'total']

// Exclude sensitive info
['omit', ['get', 'data.user'], 'password', 'ssn']

// Immutable object update: add/update a field
['assoc', ['get', 'data.todo'], 'completed', true]

// Immutable object update: remove a field
['dissoc', ['get', 'data.user'], 'temporaryToken']

// Merge defaults with overrides
['merge', ['get', 'data.defaults'], ['get', 'data.userSettings']]
```

---

## Type Functions

| Function | Description | Example |
|----------|-------------|---------|
| `isNull` | Check null | `['isNull', ['get', 'data.email']]` |
| `isNumber` | Check number | `['isNumber', ['get', 'data.age']]` |
| `isString` | Check string | `['isString', ['get', 'data.name']]` |
| `isArray` | Check array | `['isArray', ['get', 'data.items']]` |
| `isObject` | Check object | `['isObject', ['get', 'data.user']]` |
| `toNumber` | Convert to number | `['toNumber', '42']` → `42` |
| `toString` | Convert to string | `['toString', 42]` → `'42'` |

---

## Date Functions

| Function | Description | Example |
|----------|-------------|---------|
| `now` | Current time | `['now']` |
| `date` | Parse date | `['date', '2024-01-15']` |
| `year` | Extract year | `['year', ['get', 'data.createdAt']]` |
| `month` | Extract month | `['month', ['get', 'data.createdAt']]` |
| `day` | Extract day | `['day', ['get', 'data.createdAt']]` |
| `diff` | Date difference | `['diff', date1, date2, 'days']` |

```typescript
// Today's date
['now']

// Days since creation
['diff', ['now'], ['get', 'data.createdAt'], 'days']

// Check if order is from this year
['==', ['year', ['get', 'data.orderDate']], ['year', ['now']]]
```

---

## Utility Functions

| Function | Description | Example |
|----------|-------------|---------|
| `uuid` | Generate UUID v4 | `['uuid']` → `'550e8400-e29b-41d4-a716-446655440000'` |

```typescript
// Generate unique ID for new todo item
['assoc', ['get', 'data.newTodo'], 'id', ['uuid']]

// Create new item with generated ID
['append',
  ['get', 'data.todos'],
  {
    id: ['uuid'],
    text: ['get', 'data.inputText'],
    completed: false
  }
]
```

---

## Expression Evaluation

### evaluate() Function

Evaluates an Expression and returns the result:

```typescript
function evaluate(expr: Expression, ctx: EvaluationContext): EvalResult

type EvalResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };
```

```typescript
import { evaluate } from '@manifesto-ai/core';

const expr = ['+', ['get', 'data.price'], ['get', 'data.tax']];

const result = evaluate(expr, {
  get: (path) => {
    if (path === 'data.price') return 10000;
    if (path === 'data.tax') return 1000;
    return null;
  }
});

if (result.ok) {
  console.log(result.value);  // 11000
} else {
  console.log(result.error);  // Error message
}
```

### EvaluationContext Interface

```typescript
type EvaluationContext = {
  /** Function to get value from path */
  get: (path: SemanticPath) => unknown;

  /** Current iteration item (inside map/filter) */
  current?: unknown;

  /** Current index (inside map/filter) */
  index?: number;

  /** Accumulator (inside reduce) */
  accumulator?: unknown;
};
```

---

## Analysis Tools

### extractPaths()

Extracts all paths referenced in an Expression:

```typescript
import { extractPaths } from '@manifesto-ai/core';

const expr = ['all',
  ['>', ['get', 'data.age'], 18],
  ['!=', ['get', 'data.email'], null]
];

const paths = extractPaths(expr);
// ['data.age', 'data.email']
```

### analyzeExpression()

Returns detailed analysis of an Expression:

```typescript
import { analyzeExpression } from '@manifesto-ai/core';

const analysis = analyzeExpression(expr);
// {
//   directDeps: ['data.items', 'data.discount'],
//   operators: ['sum', 'map', '*', 'get', '-'],
//   complexity: 8,
//   usesContext: true  // uses $ reference
// }
```

### isPureExpression()

Checks if Expression is pure (no side effects):

```typescript
import { isPureExpression } from '@manifesto-ai/core';

isPureExpression(['>', ['get', 'data.age'], 18]);  // true
```

### isConstantExpression()

Checks if Expression is constant (no external dependencies):

```typescript
import { isConstantExpression } from '@manifesto-ai/core';

isConstantExpression(['+', 1, 2]);                    // true
isConstantExpression(['+', 1, ['get', 'data.x']]);   // false
```

### optimizeExpression()

Optimizes an Expression:

```typescript
import { optimizeExpression } from '@manifesto-ai/core';

// Constant folding
optimizeExpression(['+', 1, 2]);  // 3

// Remove unnecessary operations
optimizeExpression(['!', ['!', ['get', 'data.flag']]]);
// ['get', 'data.flag']
```

---

## Practical Example: Order Domain

```typescript
const orderDomain = defineDomain({
  // ...
  paths: {
    derived: {
      // Item count
      itemCount: defineDerived({
        deps: ['data.items'],
        expr: ['length', ['get', 'data.items']],
        semantic: { type: 'count', description: 'Item count' }
      }),

      // Subtotal
      subtotal: defineDerived({
        deps: ['data.items'],
        expr: ['sum', ['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]],
        semantic: { type: 'currency', description: 'Subtotal' }
      }),

      // Discount amount (10% coupon)
      discount: defineDerived({
        deps: ['derived.subtotal', 'data.couponCode'],
        expr: ['case',
          [['==', ['get', 'data.couponCode'], 'SAVE10'],
           ['*', ['get', 'derived.subtotal'], 0.1]],
          0
        ],
        semantic: { type: 'currency', description: 'Discount amount' }
      }),

      // Shipping fee (free over $50)
      shippingFee: defineDerived({
        deps: ['derived.subtotal'],
        expr: ['case',
          [['>=', ['get', 'derived.subtotal'], 50000], 0],
          3000
        ],
        semantic: { type: 'currency', description: 'Shipping fee' }
      }),

      // Total
      total: defineDerived({
        deps: ['derived.subtotal', 'derived.discount', 'derived.shippingFee'],
        expr: ['+',
          ['-', ['get', 'derived.subtotal'], ['get', 'derived.discount']],
          ['get', 'derived.shippingFee']
        ],
        semantic: { type: 'currency', description: 'Total' }
      }),

      // Can checkout
      canCheckout: defineDerived({
        deps: ['data.items', 'state.isSubmitting'],
        expr: ['all',
          ['>', ['length', ['get', 'data.items']], 0],
          ['!', ['get', 'state.isSubmitting']]
        ],
        semantic: { type: 'boolean', description: 'Whether checkout is possible' }
      }),

      // Order summary
      summary: defineDerived({
        deps: ['derived.itemCount', 'derived.total'],
        expr: ['concat',
          ['toString', ['get', 'derived.itemCount']], ' items, ',
          'Total $', ['toString', ['get', 'derived.total']]
        ],
        semantic: { type: 'string', description: 'Order summary' }
      })
    }
  }
});
```

---

## Next Steps

- [Effect System](05-effect-system.md) - Defining side effects
- [DAG & Change Propagation](06-dag-propagation.md) - Dependency tracking
