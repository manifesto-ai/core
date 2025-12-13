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
  defineSource,
  sequence,
  setState,
  setValue,
  z
} from '@manifesto-ai/core';

// Define a domain
const todosDomain = defineDomain({
  id: 'todos',
  name: 'Todos',
  description: 'Todo list management domain',

  dataSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      title: z.string(),
      completed: z.boolean()
    }))
  }),

  stateSchema: z.object({
    filter: z.enum(['all', 'active', 'completed']),
    isLoading: z.boolean()
  }),

  initialState: {
    filter: 'all',
    isLoading: false
  },

  paths: {
    sources: {
      // Auto-prefixed: 'items' becomes 'data.items'
      items: defineSource({
        schema: z.array(z.object({
          id: z.string(),
          title: z.string(),
          completed: z.boolean()
        })),
        defaultValue: [],
        semantic: { type: 'list', description: 'Todo items' }
      })
    },
    derived: {
      // Auto-prefixed: 'activeCount' becomes 'derived.activeCount'
      activeCount: defineDerived({
        deps: ['data.items'],
        expr: ['length', ['filter', ['get', 'data.items'], ['!', '$.completed']]],
        semantic: { type: 'count', description: 'Number of active todos' }
      })
    }
  },

  actions: {
    // Set filter action
    setFilter: defineAction({
      deps: ['state.filter'],
      input: z.object({ filter: z.enum(['all', 'active', 'completed']) }),
      effect: setState('state.filter', ['get', 'input.filter'], 'Set filter'),
      semantic: { type: 'action', verb: 'set', description: 'Set todo filter' }
    }),

    // Clear completed todos
    clearCompleted: defineAction({
      deps: ['data.items'],
      effect: setValue('data.items',
        ['filter', ['get', 'data.items'], ['!', '$.completed']],
        'Clear completed todos'
      ),
      semantic: { type: 'action', verb: 'clear', description: 'Remove completed todos' }
    })
  }
});

// Create runtime
const runtime = createRuntime({ domain: todosDomain });

// Use the runtime
runtime.set('data.items', [
  { id: '1', title: 'Learn Manifesto', completed: false }
]);

console.log(runtime.get('derived.activeCount')); // 1
```

## API Reference

### Domain Definition

> **Note:** Keys in `sources`, `derived`, and `async` are auto-prefixed (`data.`, `derived.`, `async.` respectively). Keys with existing prefixes are preserved for backward compatibility. Both `activeCount` and `'derived.activeCount'` are valid.

#### `defineDomain(options)`

Creates a domain definition.

```typescript
const domain = defineDomain({
  id: 'myDomain',
  name: 'My Domain',
  description: 'Domain description for AI understanding',
  dataSchema: z.object({ ... }),      // Required: Source data schema
  stateSchema: z.object({ ... }),     // Required: UI state schema
  initialState: { ... },               // Required: Initial state values
  paths: {
    sources: { ... },                  // Optional: Source definitions
    derived: { ... },                  // Optional: Computed values
    async: { ... },                    // Optional: Async data sources
  },
  actions: { ... },                    // Optional: Domain actions
  meta: { ... }                        // Optional: Domain metadata
});
```

#### `defineSource(options)`

Defines a source field with semantic metadata.

```typescript
const sources = {
  // Auto-prefixed: 'user' becomes 'data.user'
  user: defineSource({
    schema: z.object({ name: z.string(), email: z.string() }),
    defaultValue: { name: '', email: '' },
    semantic: {
      type: 'entity',
      description: 'Current user information'
    }
  })
};
```

#### `defineDerived(options)`

Defines a computed value with explicit dependencies.

```typescript
const derived = {
  // Auto-prefixed: 'fullName' becomes 'derived.fullName'
  fullName: defineDerived({
    deps: ['data.firstName', 'data.lastName'],
    expr: ['concat', ['get', 'data.firstName'], ' ', ['get', 'data.lastName']],
    semantic: {
      type: 'computed',
      description: 'User full name'
    }
  })
};
```

#### `defineAsync(options)`

Defines an async data source with result paths.

```typescript
const async = {
  // Auto-prefixed: 'userData' becomes 'async.userData'
  userData: defineAsync({
    deps: ['data.userId'],
    condition: ['!=', ['get', 'data.userId'], null],
    debounce: 300,
    effect: {
      _tag: 'ApiCall',
      method: 'GET',
      endpoint: '/api/user',
      description: 'Fetch user data'
    },
    resultPath: 'state.userData',
    loadingPath: 'state.userLoading',
    errorPath: 'state.userError',
    semantic: {
      type: 'async',
      description: 'User data from API'
    }
  })
};
```

#### `defineAction(options)`

Defines a domain action with preconditions and effects.

```typescript
const actions = {
  submit: defineAction({
    deps: ['derived.total', 'state.isSubmitting'],
    preconditions: [
      { path: 'derived.hasItems', expect: 'true', reason: 'Cart must have items' },
      { path: 'state.isSubmitting', expect: 'false', reason: 'Already submitting' }
    ],
    effect: sequence([
      setState('state.isSubmitting', true),
      apiCall({ method: 'POST', url: '/api/submit' }),
      setState('state.isSubmitting', false)
    ]),
    semantic: {
      type: 'action',
      verb: 'submit',
      description: 'Submit the order',
      risk: 'medium'
    }
  })
};
```

### Runtime

#### `createRuntime(options)`

Creates a runtime instance for a domain.

```typescript
const runtime = createRuntime({
  domain: myDomain,
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

Manifesto uses a JSON-based DSL for declarative expressions. All expressions use **array format**: `['operator', ...args]`.

#### Path Reference

```typescript
['get', 'data.user.name']     // Get value at path
['get', 'state.isLoading']    // Get state value
['get', 'derived.total']      // Get derived value

// In predicates (filter, map, etc.)
'$.price'                      // Current item's price field
'$.completed'                  // Current item's completed field
'$'                            // Current item itself
```

#### Comparison Operators

```typescript
['==', a, b]      // a === b
['!=', a, b]      // a !== b
['>', a, b]       // a > b
['>=', a, b]      // a >= b
['<', a, b]       // a < b
['<=', a, b]      // a <= b
```

#### Logical Operators

```typescript
['all', expr1, expr2, ...]    // All expressions must be true (AND)
['any', expr1, expr2, ...]    // Any expression is true (OR)
['!', expr]                    // Negation (NOT)
```

#### Arithmetic Operators

```typescript
['+', a, b]       // a + b
['-', a, b]       // a - b
['*', a, b]       // a * b
```

#### String Functions

```typescript
['concat', str1, str2, ...]     // Concatenate strings
['join', array, delimiter]       // Join array elements
['includes', str, search]        // Contains substring
['slice', str, start, end]       // Substring
```

#### Array Functions

```typescript
['length', array]                // Array length
['at', array, index]             // Element at index (0 = first, -1 = last)
['filter', array, predicate]     // Filter elements
['map', array, transform]        // Transform elements
['some', array, predicate]       // Any element matches
['every', array, predicate]      // All elements match
['concat', array1, array2]       // Concatenate arrays
['includes', array, element]     // Array contains element
['sort', array, key]             // Sort by key
['slice', array, start, end]     // Slice array
['indexOf', array, element]      // Find index of element
```

> **Note:** There is no `find` operator. Use `['at', ['filter', array, predicate], 0]` instead.

#### Conditional

```typescript
// Case expression (if-else chain) - each condition-value pair is a tuple
['case',
  [condition1, value1],
  [condition2, value2],
  defaultValue
]

// Example: return 'large', 'medium', or 'small' based on total
['case',
  [['>', ['get', 'derived.total'], 100], 'large'],
  [['>', ['get', 'derived.total'], 50], 'medium'],
  'small'
]

// Match expression (pattern matching)
['match', value,
  [pattern1, result1],
  [pattern2, result2],
  defaultResult
]

// Coalesce (first non-null value)
['coalesce', value1, value2, value3]
```

#### Object Operations

```typescript
['pick', object, ['key1', 'key2']]   // Pick specific keys
['omit', object, ['key1', 'key2']]   // Omit specific keys
```

#### Examples

```typescript
// Filter active todos
['filter', ['get', 'data.items'], ['!', '$.completed']]

// Count completed items
['length', ['filter', ['get', 'data.items'], '$.completed']]

// Find first item by id (no find operator, use filter + at)
['at', ['filter', ['get', 'data.items'], ['==', '$.id', ['get', 'input.id']]], 0]

// Concatenate first and last name
['concat', ['get', 'data.firstName'], ' ', ['get', 'data.lastName']]

// Conditional value (each condition-value pair is a tuple)
['case',
  [['>', ['get', 'derived.total'], 100], 'large'],
  [['>', ['get', 'derived.total'], 50], 'medium'],
  'small'
]
```

#### Known Limitations

1. **No object literal construction**: You cannot create new objects with dynamic values directly in expressions.
   ```typescript
   // ❌ This does NOT work
   ['concat', ['get', 'data.items'], [{ id: ['get', 'input.id'], name: 'New' }]]

   // ✅ Use pick/omit for existing objects, or handle in effect handlers
   ['pick', '$', ['id', 'name']]
   ```

2. **No empty object literal**: `{}` is not a valid expression. Use `['coalesce']` or handle in application code.

3. **No `find` operator**: Use `['at', ['filter', array, predicate], 0]` instead.

### Effect System

Effects describe side effects as data.

#### Effect Types

```typescript
// Set a value
setValue('data.count', 10)
setValue('data.count', ['+', ['get', 'data.count'], 1])

// Set state
setState('state.isLoading', true)

// API call
apiCall({
  method: 'POST',
  url: '/api/orders',
  body: ['get', 'data.order'],
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
  ['get', 'state.isPremium'],
  apiCall({ method: 'GET', url: '/api/premium' }),
  apiCall({ method: 'GET', url: '/api/basic' })
)

// Error handling
catchEffect(
  apiCall({ method: 'POST', url: '/api/submit' }),
  setState('state.error', ['get', 'error.message'])
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
