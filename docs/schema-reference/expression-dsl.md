# Expression DSL Reference

The Expression DSL is a safe, array-based syntax for defining dynamic values, conditions, and calculations in Manifesto schemas. It uses a Mapbox Style Expression-inspired format that avoids `eval()` and prevents code injection.

## Table of Contents

- [Overview](#overview)
- [Context References](#context-references)
- [Comparison Operators](#comparison-operators)
- [Logical Operators](#logical-operators)
- [Collection Operators](#collection-operators)
- [String Operators](#string-operators)
- [Numeric Operators](#numeric-operators)
- [Conditional Operators](#conditional-operators)
- [Type Operators](#type-operators)
- [Object Access Operators](#object-access-operators)
- [Date Operators](#date-operators)
- [Builder Functions](#builder-functions)
- [Common Patterns](#common-patterns)

---

## Overview

### Syntax

Expressions use an array-based format:

```typescript
['OPERATOR', arg1, arg2, ...]
```

### Example

```typescript
// Hide field when category is 'DIGITAL'
{
  hidden: ['==', '$state.category', 'DIGITAL']
}

// Complex condition
{
  disabled: ['AND',
    ['==', '$state.status', 'PUBLISHED'],
    ['!=', '$user.role', 'ADMIN']
  ]
}
```

### Literals

Plain values are also valid expressions:

```typescript
// String literal
'hello'

// Number literal
42

// Boolean literal
true

// Null literal
null
```

---

## Context References

Context references allow access to runtime values using the `$` prefix.

### Available Contexts

| Reference | Description | Example |
|-----------|-------------|---------|
| `$state.{field}` | Current form field values | `$state.category` |
| `$context.{key}` | Application context (brand, env) | `$context.brandId` |
| `$user.{key}` | Current user information | `$user.role` |
| `$params.{key}` | URL/route parameters | `$params.id` |
| `$result.{key}` | Previous action results | `$result.savedId` |
| `$env.{key}` | Environment variables (whitelisted) | `$env.API_URL` |

### Examples

```typescript
// Access form field value
['==', '$state.productType', 'DIGITAL']

// Access user role
['==', '$user.role', 'admin']

// Access URL parameter
['==', '$params.mode', 'edit']

// Access app context
['==', '$context.brand', 'brandA']
```

### Builder Functions

```typescript
import { $ } from '@manifesto-ai/schema'

// Using builders
$.state('category')     // '$state.category'
$.user('role')          // '$user.role'
$.context('brandId')    // '$context.brandId'
$.params('id')          // '$params.id'
$.result('data')        // '$result.data'
$.env('API_URL')        // '$env.API_URL'
```

---

## Comparison Operators

### `==` (Equal)

```typescript
['==', expression, expression]
```

| Left | Right | Result |
|------|-------|--------|
| `'a'` | `'a'` | `true` |
| `1` | `1` | `true` |
| `'1'` | `1` | `false` |
| `null` | `null` | `true` |

```typescript
// Field equals value
['==', '$state.status', 'ACTIVE']

// Builder
eq('$state.status', 'ACTIVE')
```

### `!=` (Not Equal)

```typescript
['!=', expression, expression]
```

```typescript
['!=', '$state.category', 'DIGITAL']

// Builder
neq('$state.category', 'DIGITAL')
```

### `>` (Greater Than)

```typescript
['>', expression, expression]
```

```typescript
['>', '$state.price', 100]

// Builder
gt('$state.price', 100)
```

### `>=` (Greater Than or Equal)

```typescript
['>=', expression, expression]
```

```typescript
['>=', '$state.quantity', 1]

// Builder
gte('$state.quantity', 1)
```

### `<` (Less Than)

```typescript
['<', expression, expression]
```

```typescript
['<', '$state.age', 18]

// Builder
lt('$state.age', 18)
```

### `<=` (Less Than or Equal)

```typescript
['<=', expression, expression]
```

```typescript
['<=', '$state.discount', 50]

// Builder
lte('$state.discount', 50)
```

---

## Logical Operators

### `AND`

Returns `true` if ALL arguments are truthy.

```typescript
['AND', ...expressions]
```

```typescript
['AND',
  ['==', '$state.status', 'ACTIVE'],
  ['>=', '$state.price', 0],
  ['!=', '$state.name', '']
]

// Builder
and(
  eq('$state.status', 'ACTIVE'),
  gte('$state.price', 0),
  neq('$state.name', '')
)
```

### `OR`

Returns `true` if ANY argument is truthy.

```typescript
['OR', ...expressions]
```

```typescript
['OR',
  ['==', '$state.category', 'DIGITAL'],
  ['==', '$state.category', 'SERVICE']
]

// Builder
or(
  eq('$state.category', 'DIGITAL'),
  eq('$state.category', 'SERVICE')
)
```

### `NOT`

Negates the expression.

```typescript
['NOT', expression]
```

```typescript
['NOT', ['==', '$state.status', 'DRAFT']]

// Builder
not(eq('$state.status', 'DRAFT'))
```

---

## Collection Operators

### `IN`

Checks if value is in a list.

```typescript
['IN', value, [array]]
```

```typescript
['IN', '$state.status', ['ACTIVE', 'PENDING', 'REVIEW']]

// Builder
isIn('$state.status', ['ACTIVE', 'PENDING', 'REVIEW'])
```

### `NOT_IN`

Checks if value is NOT in a list.

```typescript
['NOT_IN', value, [array]]
```

```typescript
['NOT_IN', '$state.role', ['guest', 'banned']]

// Builder
notIn('$state.role', ['guest', 'banned'])
```

### `CONTAINS`

Checks if string/array contains a value.

```typescript
['CONTAINS', collection, value]
```

```typescript
// String contains
['CONTAINS', '$state.email', '@company.com']

// Array contains
['CONTAINS', '$state.tags', 'featured']

// Builder
contains('$state.email', '@company.com')
```

### `IS_EMPTY`

Checks if value is empty (null, undefined, '', [], {}).

```typescript
['IS_EMPTY', value]
```

```typescript
['IS_EMPTY', '$state.description']

// Builder
isEmpty('$state.description')
```

### `LENGTH`

Returns the length of string or array.

```typescript
['LENGTH', value]
```

```typescript
// Check minimum length
['>=', ['LENGTH', '$state.password'], 8]

// Builder
length('$state.password')
```

---

## String Operators

### `CONCAT`

Concatenates multiple strings.

```typescript
['CONCAT', ...strings]
```

```typescript
['CONCAT', '$state.firstName', ' ', '$state.lastName']

// Builder
concat('$state.firstName', ' ', '$state.lastName')
```

### `UPPER`

Converts to uppercase.

```typescript
['UPPER', string]
```

```typescript
['UPPER', '$state.code']

// Builder
upper('$state.code')
```

### `LOWER`

Converts to lowercase.

```typescript
['LOWER', string]
```

```typescript
['LOWER', '$state.email']

// Builder
lower('$state.email')
```

### `TRIM`

Removes leading/trailing whitespace.

```typescript
['TRIM', string]
```

```typescript
['TRIM', '$state.input']

// Builder
trim('$state.input')
```

### `STARTS_WITH`

Checks if string starts with prefix.

```typescript
['STARTS_WITH', string, prefix]
```

```typescript
['STARTS_WITH', '$state.phone', '+1']

// Builder
startsWith('$state.phone', '+1')
```

### `ENDS_WITH`

Checks if string ends with suffix.

```typescript
['ENDS_WITH', string, suffix]
```

```typescript
['ENDS_WITH', '$state.email', '.edu']

// Builder
endsWith('$state.email', '.edu')
```

### `MATCH`

Tests string against regex pattern.

```typescript
['MATCH', string, pattern]
```

```typescript
['MATCH', '$state.email', '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$']

// Builder
match('$state.email', '^[a-zA-Z0-9._%+-]+@')
```

---

## Numeric Operators

### `+` (Add)

```typescript
['+', number, number]
```

```typescript
['+', '$state.price', '$state.tax']

// Builder
add('$state.price', '$state.tax')
```

### `-` (Subtract)

```typescript
['-', number, number]
```

```typescript
['-', '$state.total', '$state.discount']

// Builder
sub('$state.total', '$state.discount')
```

### `*` (Multiply)

```typescript
['*', number, number]
```

```typescript
['*', '$state.quantity', '$state.unitPrice']

// Builder
mul('$state.quantity', '$state.unitPrice')
```

### `/` (Divide)

```typescript
['/', number, number]
```

```typescript
['/', '$state.total', '$state.count']

// Builder
div('$state.total', '$state.count')
```

### `%` (Modulo)

```typescript
['%', number, number]
```

```typescript
['%', '$state.index', 2]

// Builder
mod('$state.index', 2)
```

### `ABS`

Returns absolute value.

```typescript
['ABS', number]
```

```typescript
['ABS', '$state.difference']

// Builder
abs('$state.difference')
```

### `ROUND`

Rounds to specified decimal places.

```typescript
['ROUND', number, decimals?]
```

```typescript
['ROUND', '$state.price', 2]

// Builder
round('$state.price', 2)
```

### `FLOOR`

Rounds down to nearest integer.

```typescript
['FLOOR', number]
```

```typescript
['FLOOR', '$state.rating']

// Builder
floor('$state.rating')
```

### `CEIL`

Rounds up to nearest integer.

```typescript
['CEIL', number]
```

```typescript
['CEIL', '$state.quantity']

// Builder
ceil('$state.quantity')
```

### `MIN`

Returns minimum value.

```typescript
['MIN', ...numbers]
```

```typescript
['MIN', '$state.price', '$state.salePrice', 100]

// Builder
min('$state.price', '$state.salePrice', 100)
```

### `MAX`

Returns maximum value.

```typescript
['MAX', ...numbers]
```

```typescript
['MAX', '$state.quantity', 1]

// Builder
max('$state.quantity', 1)
```

---

## Conditional Operators

### `IF`

Ternary conditional.

```typescript
['IF', condition, thenValue, elseValue]
```

```typescript
['IF',
  ['==', '$state.type', 'PREMIUM'],
  0,           // then: no shipping
  '$state.shippingCost'  // else: normal shipping
]

// Builder
when(
  eq('$state.type', 'PREMIUM'),
  0,
  '$state.shippingCost'
)
```

### `CASE`

Multiple conditions (switch-like).

```typescript
['CASE',
  condition1, value1,
  condition2, value2,
  ...,
  defaultValue
]
```

```typescript
['CASE',
  ['==', '$state.tier', 'GOLD'], 0.2,
  ['==', '$state.tier', 'SILVER'], 0.1,
  ['==', '$state.tier', 'BRONZE'], 0.05,
  0  // default
]

// Builder
caseOf(
  [eq('$state.tier', 'GOLD'), 0.2],
  [eq('$state.tier', 'SILVER'), 0.1],
  [eq('$state.tier', 'BRONZE'), 0.05],
  0  // default
)
```

### `COALESCE`

Returns first non-null value.

```typescript
['COALESCE', ...values]
```

```typescript
['COALESCE', '$state.nickname', '$state.firstName', 'Guest']

// Builder
coalesce('$state.nickname', '$state.firstName', 'Guest')
```

---

## Type Operators

### `IS_NULL`

Checks if value is null or undefined.

```typescript
['IS_NULL', value]
```

```typescript
['IS_NULL', '$state.optionalField']

// Builder
isNull('$state.optionalField')
```

### `IS_NOT_NULL`

Checks if value is NOT null or undefined.

```typescript
['IS_NOT_NULL', value]
```

```typescript
['IS_NOT_NULL', '$state.requiredField']

// Builder
isNotNull('$state.requiredField')
```

### `TYPE_OF`

Returns type as string: 'null', 'string', 'number', 'boolean', 'array', 'object'.

```typescript
['TYPE_OF', value]
```

```typescript
['==', ['TYPE_OF', '$state.value'], 'array']

// Builder
typeOf('$state.value')
```

---

## Object Access Operators

### `GET`

Gets property from object.

```typescript
['GET', object, key]
```

```typescript
['GET', '$state.address', 'city']

// Builder
get('$state.address', 'city')
```

### `GET_PATH`

Gets nested value using dot notation.

```typescript
['GET_PATH', object, path]
```

```typescript
['GET_PATH', '$state.user', 'profile.settings.theme']

// Builder
getPath('$state.user', 'profile.settings.theme')
```

---

## Date Operators

### `NOW`

Returns current ISO timestamp.

```typescript
['NOW']
```

```typescript
// Check if date is in the past
['<', '$state.deadline', ['NOW']]

// Builder
now()
```

### `TODAY`

Returns today's date (YYYY-MM-DD).

```typescript
['TODAY']
```

```typescript
['==', '$state.selectedDate', ['TODAY']]

// Builder
today()
```

### `DATE_DIFF`

Calculates difference between dates.

```typescript
['DATE_DIFF', date1, date2, unit]
```

Units: `'days'`, `'hours'`, `'minutes'`

```typescript
// Days until deadline
['DATE_DIFF', '$state.deadline', ['NOW'], 'days']

// Builder
dateDiff('$state.deadline', now(), 'days')
```

### `DATE_ADD`

Adds time to a date.

```typescript
['DATE_ADD', date, amount, unit]
```

```typescript
// Add 7 days
['DATE_ADD', ['TODAY'], 7, 'days']

// Builder
dateAdd(today(), 7, 'days')
```

### `FORMAT_DATE`

Formats date as string.

```typescript
['FORMAT_DATE', date, format]
```

Format tokens: `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`

```typescript
['FORMAT_DATE', '$state.createdAt', 'YYYY-MM-DD']

// Builder
formatDate('$state.createdAt', 'YYYY-MM-DD')
```

---

## Builder Functions

Import builders for cleaner syntax:

```typescript
import {
  // Context
  $,

  // Comparison
  eq, neq, gt, gte, lt, lte,

  // Logical
  and, or, not,

  // Collection
  isIn, notIn, contains, isEmpty, length,

  // String
  concat, upper, lower, trim, startsWith, endsWith, match,

  // Numeric
  add, sub, mul, div, mod, abs, round, floor, ceil, min, max,

  // Conditional
  when, caseOf, coalesce,

  // Type
  isNull, isNotNull, typeOf,

  // Access
  get, getPath,

  // Date
  now, today, dateDiff, dateAdd, formatDate,

  // Convenience
  fieldEquals, fieldIsEmpty, fieldIn,
} from '@manifesto-ai/schema'
```

### Convenience Helpers

```typescript
// fieldEquals - shorthand for field comparison
fieldEquals('status', 'ACTIVE')
// Equivalent to: ['==', '$state.status', 'ACTIVE']

// fieldIsEmpty - shorthand for empty check
fieldIsEmpty('description')
// Equivalent to: ['IS_EMPTY', '$state.description']

// fieldIn - shorthand for in-list check
fieldIn('status', ['ACTIVE', 'PENDING'])
// Equivalent to: ['IN', '$state.status', ['ACTIVE', 'PENDING']]
```

---

## Common Patterns

### Conditional Visibility

```typescript
// Show field only for premium users
{
  hidden: ['!=', '$state.accountType', 'PREMIUM']
}

// Show field only when another has value
{
  hidden: ['IS_EMPTY', '$state.country']
}

// Show based on multiple conditions
{
  hidden: ['OR',
    ['==', '$state.productType', 'DIGITAL'],
    ['!=', '$state.deliveryMethod', 'SHIPPING']
  ]
}
```

### Conditional Disabled

```typescript
// Disable when status is published
{
  disabled: ['==', '$state.status', 'PUBLISHED']
}

// Disable unless user is admin
{
  disabled: ['!=', '$user.role', 'ADMIN']
}
```

### Calculated Values

```typescript
// Total price
['*', '$state.quantity', '$state.unitPrice']

// Discounted price
['*', '$state.price', ['-', 1, ['/', '$state.discountPercent', 100]]]

// Full name
['CONCAT', '$state.firstName', ' ', '$state.lastName']
```

### Validation Expressions

```typescript
// Minimum age
['>=', '$state.age', 18]

// Valid email domain
['ENDS_WITH', '$state.email', '@company.com']

// Password complexity
['AND',
  ['>=', ['LENGTH', '$state.password'], 8],
  ['MATCH', '$state.password', '[A-Z]'],
  ['MATCH', '$state.password', '[0-9]']
]
```

### Date Comparisons

```typescript
// Date must be in the future
['>', '$state.scheduledDate', ['TODAY']]

// Within 30 days
['<=', ['DATE_DIFF', '$state.deadline', ['NOW'], 'days'], 30]

// Expires soon (within 7 days)
['AND',
  ['>', '$state.expiresAt', ['NOW']],
  ['<=', ['DATE_DIFF', '$state.expiresAt', ['NOW'], 'days'], 7]
]
```

---

## Security

The Expression DSL is designed with security in mind:

1. **Whitelisted Operators**: Only approved operators can be used
2. **No Code Execution**: No `eval()`, no `Function()`, no arbitrary code
3. **Sandboxed Context**: Expressions can only access provided context
4. **Recursion Limits**: Maximum depth prevents stack overflow
5. **Timeout Protection**: Evaluation times out after configurable limit

---

[Back to Documentation](../README.md)
