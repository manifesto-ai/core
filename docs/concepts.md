# Core Concepts

This document explains the fundamental concepts of Manifesto AI.

## Table of Contents

1. [Semantic Paths](#semantic-paths)
2. [Domain Definition](#domain-definition)
3. [Expression DSL](#expression-dsl)
4. [Effect System](#effect-system)
5. [Field Policies](#field-policies)
6. [Actions](#actions)
7. [Result Type](#result-type)

---

## Semantic Paths

Every value in Manifesto has a unique address called a **Semantic Path**.

### Path Namespaces

```typescript
'data.user.name'          // Source data (persistent)
'state.form.isSubmitting' // UI state (transient)
'derived.user.fullName'   // Computed value (reactive)
'async.user.permissions'  // Async data (cached)
```

| Namespace | Description | Writable | Reactive |
|-----------|-------------|----------|----------|
| `data.*` | Business data | Yes | Yes |
| `state.*` | UI state | Yes | Yes |
| `derived.*` | Computed | No (auto) | Yes |
| `async.*` | External data | No (auto) | Yes |

### Path Navigation

```typescript
// Read any path
runtime.get('data.user.name');
runtime.get('data.items.0.price');  // Array index
runtime.get('derived.totalPrice');

// Write data/state paths
runtime.set('data.user.name', 'John');
runtime.set('state.isLoading', true);

// Subscribe to specific paths
runtime.subscribe('data.user', (user) => { ... });
runtime.subscribe('derived.totalPrice', (price) => { ... });
```

### Why Semantic Paths?

1. **AI Addressability**: AI can reference specific values unambiguously
2. **Debugging**: Easy to trace where values come from
3. **Granular Subscriptions**: Only re-render what changed
4. **Policy Targeting**: Apply rules to specific paths

---

## Domain Definition

A **Domain** declares your business logic structure.

### Basic Structure

```typescript
import { defineDomain, z } from '@manifesto-ai/core';

const orderDomain = defineDomain('order', {
  // Required: Source data structure
  dataSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      quantity: z.number()
    })),
    couponCode: z.string().optional()
  }),

  // Optional: UI state structure
  stateSchema: z.object({
    isSubmitting: z.boolean().default(false),
    selectedItemId: z.string().nullable().default(null)
  }),

  // Optional: Computed values
  // Keys are auto-prefixed: 'itemCount' becomes 'derived.itemCount'
  derived: {
    itemCount: defineDerived(
      { $size: { $get: 'data.items' } },
      z.number()
    ),
    subtotal: defineDerived(
      { $sum: { $map: ['data.items', { $multiply: ['$item.price', '$item.quantity'] }] } },
      z.number()
    )
  },

  // Optional: Async data sources
  // Keys are auto-prefixed: 'shippingRates' becomes 'async.shippingRates'
  async: {
    shippingRates: defineAsync({
      fetch: { method: 'GET', url: '/api/shipping-rates' },
      dependencies: ['data.items']
    }, z.array(z.object({ carrier: z.string(), price: z.number() })))
  },

  // Optional: Domain actions
  actions: {
    addItem: defineAction({ ... }),
    removeItem: defineAction({ ... }),
    checkout: defineAction({ ... })
  },

  // Optional: Field-level policies
  fieldPolicies: {
    'data.couponCode': fieldPolicy({
      relevance: condition({ $gt: [{ $get: 'derived.subtotal' }, 50] }),
      editability: condition({ $not: { $get: 'state.isSubmitting' } })
    })
  }
});
```

### Schema Types

Manifesto uses [Zod](https://zod.dev) for schema definitions:

```typescript
import { z } from '@manifesto-ai/core';

// Primitives
z.string()
z.number()
z.boolean()
z.date()

// Modifiers
z.string().optional()
z.string().nullable()
z.string().default('hello')

// Complex types
z.array(z.string())
z.object({ name: z.string(), age: z.number() })
z.enum(['draft', 'published', 'archived'])
z.union([z.string(), z.number()])

// Validation
z.string().email()
z.string().min(1).max(100)
z.number().positive()
z.number().int().min(0).max(100)
```

---

## Expression DSL

Expressions are JSON structures that describe computations declaratively.

### Why Expressions?

```typescript
// Traditional code - opaque to AI
const isValid = (data) =>
  data.email.includes('@') &&
  data.age >= 18 &&
  data.items.length > 0;

// Manifesto expressions - transparent to AI
const isValid = {
  $and: [
    { $includes: [{ $get: 'data.email' }, '@'] },
    { $gte: [{ $get: 'data.age' }, 18] },
    { $gt: [{ $size: { $get: 'data.items' } }, 0] }
  ]
};
```

**Benefits:**
- Serializable as JSON
- Dependencies extracted automatically
- AI can read, write, and modify
- Can be analyzed and optimized

### Path Reference (`$get`)

```typescript
{ $get: 'data.user.name' }       // Get value at path
{ $get: 'derived.totalPrice' }   // Get computed value
{ $get: 'state.selectedId' }     // Get UI state
```

### Comparison Operators

```typescript
{ $eq: [{ $get: 'data.status' }, 'active'] }  // ===
{ $ne: [{ $get: 'data.status' }, 'deleted'] } // !==
{ $gt: [{ $get: 'data.age' }, 18] }           // >
{ $gte: [{ $get: 'data.age' }, 18] }          // >=
{ $lt: [{ $get: 'data.count' }, 100] }        // <
{ $lte: [{ $get: 'data.count' }, 100] }       // <=
```

### Logical Operators

```typescript
{ $and: [expr1, expr2, expr3] }  // All must be true
{ $or: [expr1, expr2, expr3] }   // At least one true
{ $not: expr }                    // Negation
```

### Arithmetic Operators

```typescript
{ $add: [{ $get: 'data.price' }, { $get: 'data.tax' }] }
{ $subtract: [{ $get: 'data.total' }, { $get: 'data.discount' }] }
{ $multiply: [{ $get: 'data.price' }, { $get: 'data.quantity' }] }
{ $divide: [{ $get: 'data.total' }, { $get: 'data.count' }] }
{ $modulo: [{ $get: 'data.index' }, 2] }
```

### String Functions

```typescript
{ $concat: [{ $get: 'data.firstName' }, ' ', { $get: 'data.lastName' }] }
{ $upper: { $get: 'data.code' } }
{ $lower: { $get: 'data.email' } }
{ $trim: { $get: 'data.input' } }
{ $split: [{ $get: 'data.tags' }, ','] }
{ $includes: [{ $get: 'data.email' }, '@'] }
{ $startsWith: [{ $get: 'data.phone' }, '+1'] }
{ $replace: [{ $get: 'data.text' }, 'old', 'new'] }
```

### Array Functions

```typescript
// Size
{ $size: { $get: 'data.items' } }

// Access
{ $first: { $get: 'data.items' } }
{ $last: { $get: 'data.items' } }
{ $at: [{ $get: 'data.items' }, 2] }

// Transform
{ $map: [{ $get: 'data.items' }, { $get: '$item.name' }] }
{ $filter: [{ $get: 'data.items' }, { $gt: ['$item.price', 100] }] }

// Search
{ $find: [{ $get: 'data.items' }, { $eq: ['$item.id', '123'] }] }
{ $findIndex: [{ $get: 'data.items' }, { $eq: ['$item.id', '123'] }] }
{ $includes: [{ $get: 'data.ids' }, '123'] }

// Aggregation
{ $sum: { $get: 'data.prices' } }
{ $sum: { $map: [{ $get: 'data.items' }, '$item.price'] } }
{ $every: [{ $get: 'data.items' }, { $gt: ['$item.quantity', 0] }] }
{ $some: [{ $get: 'data.items' }, { $eq: ['$item.selected', true] }] }

// Reduce
{ $reduce: [
  { $get: 'data.items' },
  { $add: ['$acc', '$item.price'] },
  0  // initial value
] }
```

### Conditional

```typescript
{ $if: [
  { $gt: [{ $get: 'data.quantity' }, 10] },  // condition
  0.1,                                         // then (10% discount)
  0                                            // else (no discount)
] }

// Nested conditions
{ $if: [
  { $eq: [{ $get: 'data.tier' }, 'gold'] },
  0.2,
  { $if: [
    { $eq: [{ $get: 'data.tier' }, 'silver'] },
    0.1,
    0
  ] }
] }
```

### Iteration Context

When iterating over arrays, special variables are available:

```typescript
// $item - current element
{ $map: [{ $get: 'data.items' }, '$item.name'] }
{ $map: [{ $get: 'data.items' }, { $multiply: ['$item.price', '$item.qty'] }] }

// $index - current index
{ $map: [{ $get: 'data.items' }, { $concat: ['#', '$index', ': ', '$item.name'] }] }

// Nested access
{ $map: [{ $get: 'data.orders' }, { $sum: { $map: ['$item.items', '$item.price'] } }] }
```

---

## Effect System

Effects describe side effects as data structures rather than executing them immediately.

### Why Effects?

```typescript
// Traditional - side effect happens immediately
async function submit() {
  setLoading(true);              // Side effect
  await fetch('/api/orders');    // Side effect
  setLoading(false);             // Side effect
}

// Manifesto - effects are described
const submitEffect = sequence([
  setState('state.isLoading', true),
  apiCall({ method: 'POST', url: '/api/orders' }),
  setState('state.isLoading', false)
]);

// Effects only execute when explicitly run
await runEffect(submitEffect, runtime);
```

**Benefits:**
- Testable without mocking
- Composable and predictable
- AI can understand what will happen
- Execution can be traced

### Effect Types

#### State Effects

```typescript
// Set a data value
setValue('data.count', 10)
setValue('data.count', { $add: [{ $get: 'data.count' }, 1] })

// Set a state value
setState('state.isLoading', true)
setState('state.error', null)
```

#### API Effects

```typescript
apiCall({
  method: 'POST',
  url: '/api/orders',
  body: { $get: 'data.order' },
  headers: {
    'Content-Type': 'application/json',
    'Authorization': { $concat: ['Bearer ', { $get: 'state.token' }] }
  }
})
```

#### Navigation Effects

```typescript
navigate('/success')
navigate({ $concat: ['/orders/', { $get: 'data.orderId' }] })
```

#### Timing Effects

```typescript
delay(1000)  // Wait 1 second
```

#### Event Effects

```typescript
emitEvent('order:created', { orderId: { $get: 'data.orderId' } })
```

### Effect Composition

#### Sequential

```typescript
sequence([
  setState('state.step', 1),
  delay(500),
  setState('state.step', 2),
  delay(500),
  setState('state.step', 3)
])
```

#### Parallel

```typescript
parallel([
  apiCall({ method: 'GET', url: '/api/user' }),
  apiCall({ method: 'GET', url: '/api/preferences' }),
  apiCall({ method: 'GET', url: '/api/notifications' })
])
```

#### Conditional

```typescript
conditional(
  { $gt: [{ $get: 'derived.total' }, 100] },
  apiCall({ method: 'POST', url: '/api/premium-checkout' }),
  apiCall({ method: 'POST', url: '/api/standard-checkout' })
)
```

#### Error Handling

```typescript
catchEffect(
  apiCall({ method: 'POST', url: '/api/orders' }),
  sequence([
    setState('state.error', { $get: 'error.message' }),
    emitEvent('order:failed', { error: { $get: 'error' } })
  ])
)
```

### Running Effects

```typescript
import { runEffect, isOk, isErr } from '@manifesto-ai/core';

const result = await runEffect(effect, runtime, {
  apiHandler: async (config) => {
    const response = await fetch(config.url, {
      method: config.method,
      headers: config.headers,
      body: config.body ? JSON.stringify(config.body) : undefined
    });
    if (!response.ok) throw new Error(response.statusText);
    return response.json();
  },
  navigationHandler: (path) => {
    window.location.href = path;
  }
});

if (isOk(result)) {
  console.log('Success:', result.value);
} else {
  console.log('Error:', result.error);
}
```

---

## Field Policies

Field policies define dynamic rules for field behavior.

### Policy Types

| Policy | Meaning | Default |
|--------|---------|---------|
| `relevance` | Should field be shown? | `true` |
| `editability` | Can field be edited? | `true` |
| `requirement` | Is field required? | `false` |

### Defining Policies

```typescript
import { fieldPolicy, condition } from '@manifesto-ai/core';

const domain = defineDomain('form', {
  dataSchema: z.object({
    accountType: z.enum(['personal', 'business']),
    companyName: z.string().optional(),
    taxId: z.string().optional()
  }),

  fieldPolicies: {
    // Company name only relevant for business accounts
    'data.companyName': fieldPolicy({
      relevance: condition({ $eq: [{ $get: 'data.accountType' }, 'business'] }),
      requirement: condition({ $eq: [{ $get: 'data.accountType' }, 'business'] })
    }),

    // Tax ID required for business accounts
    'data.taxId': fieldPolicy({
      relevance: condition({ $eq: [{ $get: 'data.accountType' }, 'business'] }),
      requirement: condition({ $eq: [{ $get: 'data.accountType' }, 'business'] }),
      editability: condition({ $not: { $get: 'state.isVerified' } })
    })
  }
});
```

### Evaluating Policies

```typescript
import { evaluateFieldPolicy } from '@manifesto-ai/core';

const result = evaluateFieldPolicy('data.companyName', domain, runtime);
// {
//   relevance: true,
//   editability: true,
//   requirement: true
// }
```

### UI Projection

```typescript
import { createProjectionManager } from '@manifesto-ai/projection-ui';

const manager = createProjectionManager({ runtime, domain });

const state = manager.getFieldState('data.companyName');
// {
//   visible: true,      // from relevance
//   enabled: true,      // from editability
//   required: true,     // from requirement
//   validation: { valid: false, issues: [...] }
// }
```

---

## Actions

Actions are domain operations with preconditions and effects.

### Defining Actions

```typescript
import { defineAction, sequence, setState, apiCall, setValue } from '@manifesto-ai/core';

const domain = defineDomain('order', {
  // ... schemas ...

  actions: {
    // Simple action
    clearCart: defineAction({
      effect: setValue('data.items', [])
    }),

    // Action with precondition
    checkout: defineAction({
      precondition: {
        $and: [
          { $gt: [{ $size: { $get: 'data.items' } }, 0] },
          { $not: { $get: 'state.isSubmitting' } }
        ]
      },
      effect: sequence([
        setState('state.isSubmitting', true),
        apiCall({ method: 'POST', url: '/api/checkout', body: { $get: 'data' } }),
        setValue('data.items', []),
        setState('state.isSubmitting', false)
      ])
    }),

    // Action with input
    addItem: defineAction({
      precondition: { $not: { $get: 'state.isSubmitting' } },
      effect: setValue('data.items', {
        $concat: [{ $get: 'data.items' }, [{ $get: 'input' }]]
      })
    }),

    // Action with semantic metadata
    deleteOrder: defineAction({
      meta: {
        description: 'Permanently delete the order',
        importance: 'critical',
        confirmationRequired: true
      },
      precondition: { $eq: [{ $get: 'data.status' }, 'draft'] },
      effect: apiCall({ method: 'DELETE', url: '/api/orders/{id}' })
    })
  }
});
```

### Checking Availability

```typescript
const runtime = createRuntime(domain);

// Check single action
const result = runtime.checkAction('checkout');
// { available: true, reason: null }
// or
// { available: false, reason: 'Cart is empty' }

// Check all actions
const allActions = runtime.checkAllActions();
// {
//   checkout: { available: true, reason: null },
//   clearCart: { available: true, reason: null },
//   addItem: { available: true, reason: null }
// }
```

### Executing Actions

```typescript
// Execute without input
await runtime.executeAction('clearCart');

// Execute with input
await runtime.executeAction('addItem', {
  id: 'prod-123',
  name: 'Widget',
  price: 29.99,
  quantity: 1
});

// Handle result
try {
  const result = await runtime.executeAction('checkout');
  if (isOk(result)) {
    console.log('Order placed:', result.value);
  } else {
    console.log('Failed:', result.error);
  }
} catch (e) {
  console.log('Precondition not met');
}
```

---

## Result Type

Manifesto uses a functional `Result` type for error handling.

### Creating Results

```typescript
import { ok, err, effectError } from '@manifesto-ai/core';

// Success
const success = ok(42);
const successWithData = ok({ orderId: '123', status: 'confirmed' });

// Failure
const failure = err({
  code: 'VALIDATION_ERROR',
  message: 'Email is invalid'
});

// Effect error
const effectFailure = effectError('api', 'Network request failed', {
  url: '/api/orders',
  status: 500
});
```

### Checking Results

```typescript
import { isOk, isErr } from '@manifesto-ai/core';

const result = await someOperation();

if (isOk(result)) {
  console.log('Value:', result.value);
} else {
  console.log('Error:', result.error.code, result.error.message);
}
```

### Extracting Values

```typescript
import { unwrap, unwrapOr, unwrapErr } from '@manifesto-ai/core';

// Throws if Err
const value = unwrap(result);

// Returns default if Err
const valueOrDefault = unwrapOr(result, 0);

// Get error (throws if Ok)
const error = unwrapErr(result);
```

### Transforming Results

```typescript
import { map, mapErr, flatMap } from '@manifesto-ai/core';

// Transform success value
const doubled = map(result, (x) => x * 2);
// ok(42) -> ok(84)
// err(...) -> err(...)

// Transform error
const formatted = mapErr(result, (e) => ({
  ...e,
  message: `Error: ${e.message}`
}));

// Chain operations
const chained = flatMap(result, (value) =>
  value > 0
    ? ok(value)
    : err({ code: 'INVALID', message: 'Must be positive' })
);
```

### Combining Results

```typescript
import { all, any } from '@manifesto-ai/core';

// All must succeed
const allResults = all([result1, result2, result3]);
// ok([val1, val2, val3]) or first err

// Any must succeed
const anyResult = any([result1, result2, result3]);
// First ok or last err
```

### Converting Promises

```typescript
import { fromPromise, tryCatch } from '@manifesto-ai/core';

// Wrap a promise
const result = await fromPromise(
  fetch('/api/data').then(r => r.json())
);

// Wrap a function that might throw
const result = await tryCatch(
  () => JSON.parse(userInput),
  (e) => ({ code: 'PARSE_ERROR', message: e.message })
);
```

---

## Summary

| Concept | Purpose | Key Benefit |
|---------|---------|-------------|
| Semantic Paths | Address any value | AI can reference precisely |
| Domain Definition | Declare structure | Single source of truth |
| Expression DSL | Describe logic | Analyzable and serializable |
| Effect System | Describe side effects | Testable and composable |
| Field Policies | Dynamic field rules | Automatic UI derivation |
| Actions | Domain operations | Precondition enforcement |
| Result Type | Error handling | Forced error consideration |

These concepts work together to create a system where:

1. **Everything is addressable** via semantic paths
2. **Logic is declarative** via expressions
3. **Side effects are controlled** via effects
4. **Rules are dynamic** via policies
5. **Operations are safe** via actions
6. **Errors are explicit** via Result type

This makes the system transparent to both humans and AI, enabling true collaboration on business logic.
