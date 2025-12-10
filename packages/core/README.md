# @manifesto-ai/core

> AI Native Semantic Layer for SaaS Business Logic

The core package provides domain definition, runtime execution, expression evaluation, and effect system for Manifesto AI.

## Installation

```bash
pnpm add @manifesto-ai/core
# or
npm install @manifesto-ai/core
```

## Quick Start

```typescript
import {
  defineDomain,
  createRuntime,
  defineDerived,
  defineAction,
  sequence,
  setState,
  apiCall,
  z
} from '@manifesto-ai/core';

// Define a domain
const todosDomain = defineDomain('todos', {
  dataSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      title: z.string(),
      completed: z.boolean()
    }))
  }),

  stateSchema: z.object({
    filter: z.enum(['all', 'active', 'completed']).default('all'),
    isLoading: z.boolean().default(false)
  }),

  derived: {
    'derived.activeCount': defineDerived(
      { $size: { $filter: ['data.items', { $eq: ['$item.completed', false] }] } },
      z.number()
    ),
    'derived.filteredItems': defineDerived(
      {
        $if: [
          { $eq: [{ $get: 'state.filter' }, 'all'] },
          { $get: 'data.items' },
          { $filter: ['data.items', {
            $eq: ['$item.completed', { $eq: [{ $get: 'state.filter' }, 'completed'] }]
          }] }
        ]
      },
      z.array(z.object({ id: z.string(), title: z.string(), completed: z.boolean() }))
    )
  },

  actions: {
    addTodo: defineAction({
      precondition: { $gt: [{ $size: { $get: 'input.title' } }, 0] },
      effect: setValue('data.items', {
        $concat: [
          { $get: 'data.items' },
          [{ id: { $get: 'input.id' }, title: { $get: 'input.title' }, completed: false }]
        ]
      })
    })
  }
});

// Create runtime
const runtime = createRuntime(todosDomain);

// Use the runtime
runtime.set('data.items', [
  { id: '1', title: 'Learn Manifesto', completed: false }
]);

console.log(runtime.get('derived.activeCount')); // 1
```

## API Reference

### Domain Definition

#### `defineDomain(name, config)`

Creates a domain definition.

```typescript
const domain = defineDomain('myDomain', {
  dataSchema: z.object({ ... }),      // Required: Source data schema
  stateSchema: z.object({ ... }),     // Optional: UI state schema
  derived: { ... },                    // Optional: Computed values
  async: { ... },                      // Optional: Async data sources
  actions: { ... }                     // Optional: Domain actions
});
```

#### `defineSource(schema, meta?)`

Defines a source field with optional metadata.

```typescript
const sources = {
  'data.user': defineSource(
    z.object({ name: z.string(), email: z.string() }),
    { description: 'Current user information' }
  )
};
```

#### `defineDerived(expression, schema, meta?)`

Defines a computed value.

```typescript
const derived = {
  'derived.fullName': defineDerived(
    { $concat: [{ $get: 'data.firstName' }, ' ', { $get: 'data.lastName' }] },
    z.string(),
    { description: 'User full name' }
  )
};
```

#### `defineAsync(config, schema, meta?)`

Defines an async data source.

```typescript
const async = {
  'async.userData': defineAsync(
    {
      fetch: { method: 'GET', url: '/api/user' },
      dependencies: ['data.userId']
    },
    z.object({ name: z.string() })
  )
};
```

#### `defineAction(config)`

Defines a domain action with preconditions and effects.

```typescript
const actions = {
  submit: defineAction({
    precondition: { $and: [
      { $gt: [{ $get: 'derived.total' }, 0] },
      { $not: { $get: 'state.isSubmitting' } }
    ]},
    effect: sequence([
      setState('state.isSubmitting', true),
      apiCall({ method: 'POST', url: '/api/submit' }),
      setState('state.isSubmitting', false)
    ])
  })
};
```

### Runtime

#### `createRuntime(domain, options?)`

Creates a runtime instance for a domain.

```typescript
const runtime = createRuntime(domain, {
  initialData: { count: 0 },
  initialState: { isLoading: false }
});
```

#### Runtime Methods

```typescript
// Get a value by path
runtime.get('data.user.name');        // Returns the value
runtime.get('derived.fullName');      // Computes and returns

// Set a value
runtime.set('data.count', 10);
runtime.set('state.isLoading', true);

// Subscribe to changes
const unsubscribe = runtime.subscribe('data.count', (value) => {
  console.log('Count:', value);
});

// Subscribe to all changes
runtime.subscribeAll((snapshot) => {
  console.log('Snapshot changed:', snapshot);
});

// Get current snapshot
const snapshot = runtime.getSnapshot();

// Check action availability
const canSubmit = runtime.checkAction('submit');
// { available: true, reason: null }

// Execute an action
await runtime.executeAction('submit', { orderId: '123' });

// Explain why a value is what it is
const explanation = runtime.explain('derived.total');
```

### Expression DSL

Manifesto uses a JSON-based DSL for declarative expressions.

#### Comparison Operators

```typescript
{ $eq: [a, b] }       // a === b
{ $ne: [a, b] }       // a !== b
{ $gt: [a, b] }       // a > b
{ $gte: [a, b] }      // a >= b
{ $lt: [a, b] }       // a < b
{ $lte: [a, b] }      // a <= b
```

#### Logical Operators

```typescript
{ $and: [expr1, expr2, ...] }   // All true
{ $or: [expr1, expr2, ...] }    // Any true
{ $not: expr }                   // Negation
```

#### Arithmetic Operators

```typescript
{ $add: [a, b] }        // a + b
{ $subtract: [a, b] }   // a - b
{ $multiply: [a, b] }   // a * b
{ $divide: [a, b] }     // a / b
{ $modulo: [a, b] }     // a % b
```

#### String Functions

```typescript
{ $concat: [str1, str2, ...] }  // Concatenate strings
{ $upper: str }                  // Uppercase
{ $lower: str }                  // Lowercase
{ $trim: str }                   // Trim whitespace
{ $split: [str, delimiter] }     // Split string
{ $includes: [str, search] }     // Contains substring
```

#### Array Functions

```typescript
{ $size: array }                            // Array length
{ $first: array }                           // First element
{ $last: array }                            // Last element
{ $filter: [array, predicate] }             // Filter elements
{ $map: [array, transform] }                // Transform elements
{ $find: [array, predicate] }               // Find first match
{ $some: [array, predicate] }               // Any match
{ $every: [array, predicate] }              // All match
{ $sum: array }                             // Sum numbers
{ $reduce: [array, reducer, initial] }      // Reduce array
```

#### Conditional

```typescript
{ $if: [condition, thenValue, elseValue] }
```

#### Path Reference

```typescript
{ $get: 'data.user.name' }    // Get value at path
'$item.price'                  // Current item in iteration
'$index'                       // Current index in iteration
```

### Effect System

Effects describe side effects as data.

#### Effect Types

```typescript
// Set a value
setValue('data.count', 10)
setValue('data.count', { $add: [{ $get: 'data.count' }, 1] })

// Set state
setState('state.isLoading', true)

// API call
apiCall({
  method: 'POST',
  url: '/api/orders',
  body: { $get: 'data.order' },
  headers: { 'Content-Type': 'application/json' }
})

// Navigation
navigate('/success')

// Delay
delay(1000)  // milliseconds

// Emit event
emitEvent('orderCreated', { orderId: '123' })
```

#### Effect Composition

```typescript
// Sequential execution
sequence([
  setState('state.isLoading', true),
  apiCall({ method: 'GET', url: '/api/data' }),
  setState('state.isLoading', false)
])

// Parallel execution
parallel([
  apiCall({ method: 'GET', url: '/api/user' }),
  apiCall({ method: 'GET', url: '/api/settings' })
])

// Conditional execution
conditional(
  { $get: 'state.isPremium' },
  apiCall({ method: 'GET', url: '/api/premium' }),
  apiCall({ method: 'GET', url: '/api/basic' })
)

// Error handling
catchEffect(
  apiCall({ method: 'POST', url: '/api/submit' }),
  setState('state.error', { $get: 'error.message' })
)
```

#### Running Effects

```typescript
import { runEffect } from '@manifesto-ai/core';

const result = await runEffect(effect, runtime, {
  apiHandler: async (config) => {
    const response = await fetch(config.url, {
      method: config.method,
      body: JSON.stringify(config.body)
    });
    return response.json();
  }
});

if (isOk(result)) {
  console.log('Success:', result.value);
} else {
  console.log('Error:', result.error);
}
```

### Result Type

A functional error handling type.

```typescript
import { ok, err, isOk, isErr, map, flatMap, unwrapOr } from '@manifesto-ai/core';

// Create results
const success = ok(42);
const failure = err({ code: 'NOT_FOUND', message: 'Item not found' });

// Check type
if (isOk(success)) {
  console.log(success.value);  // 42
}

// Transform
const doubled = map(success, (x) => x * 2);  // ok(84)

// Chain operations
const result = flatMap(success, (x) =>
  x > 0 ? ok(x) : err({ code: 'INVALID', message: 'Must be positive' })
);

// Get with default
const value = unwrapOr(failure, 0);  // 0
```

### Schema Utilities

```typescript
import {
  schemaToSource,
  validateValue,
  zodErrorToValidationResult,
  CommonSchemas
} from '@manifesto-ai/core';

// Common schemas
CommonSchemas.email    // z.string().email()
CommonSchemas.phone    // Phone number pattern
CommonSchemas.money    // Positive number with 2 decimals

// Validate values
const result = validateValue(userSchema, inputData);
if (!result.valid) {
  console.log(result.issues);
}
```

## Related Packages

- [@manifesto-ai/bridge](../bridge) - Framework adapters
- [@manifesto-ai/bridge-zustand](../bridge-zustand) - Zustand integration
- [@manifesto-ai/bridge-react-hook-form](../bridge-react-hook-form) - React Hook Form integration
- [@manifesto-ai/projection-ui](../projection-ui) - UI state projection
- [@manifesto-ai/projection-agent](../projection-agent) - AI agent context
- [@manifesto-ai/projection-graphql](../projection-graphql) - GraphQL schema generation

## License

MIT
