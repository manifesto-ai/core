# Getting Started with Manifesto AI

This guide will walk you through creating your first Manifesto domain in about 5 minutes.

## Prerequisites

- Node.js 22 or later
- pnpm, npm, or yarn

## Installation

```bash
# Using pnpm (recommended)
pnpm add @manifesto-ai/core

# Using npm
npm install @manifesto-ai/core

# Using yarn
yarn add @manifesto-ai/core
```

## Step 1: Define Your First Domain

A domain is the central concept in Manifesto. It describes your business logic declaratively.

```typescript
import { defineDomain, defineDerived, z } from '@manifesto-ai/core';

// Define a simple counter domain
const counterDomain = defineDomain({
  id: 'counter',
  name: 'Counter',
  description: 'Simple counter domain',

  // Source data schema - the "truth" your domain operates on
  dataSchema: z.object({
    count: z.number().default(0)
  }),

  // UI state schema - transient state for the UI
  stateSchema: z.object({
    step: z.number().default(1)
  }),

  // Initial state values
  initialState: {
    step: 1
  },

  // Derived values - computed from source data
  // Keys are auto-prefixed: 'doubled' becomes 'derived.doubled'
  paths: {
    derived: {
      doubled: defineDerived({
        deps: ['data.count'],
        expr: ['*', ['get', 'data.count'], 2],
        semantic: { type: 'computed', description: 'Double of count' }
      }),
      isPositive: defineDerived({
        deps: ['data.count'],
        expr: ['>', ['get', 'data.count'], 0],
        semantic: { type: 'computed', description: 'Whether count is positive' }
      })
    }
  }
});
```

## Step 2: Create a Runtime

The runtime is your interface to read, write, and observe the domain.

```typescript
import { createRuntime } from '@manifesto-ai/core';

const runtime = createRuntime(counterDomain);
```

## Step 3: Read and Write Values

Use semantic paths to access any value in your domain:

```typescript
// Read values
console.log(runtime.get('data.count'));        // 0
console.log(runtime.get('derived.doubled'));   // 0
console.log(runtime.get('derived.isPositive')); // false

// Write values
runtime.set('data.count', 5);

// Derived values update automatically
console.log(runtime.get('derived.doubled'));   // 10
console.log(runtime.get('derived.isPositive')); // true
```

## Step 4: Subscribe to Changes

React to changes anywhere in your domain:

```typescript
// Subscribe to a specific path
const unsubscribe = runtime.subscribe('data.count', (newValue) => {
  console.log('Count changed to:', newValue);
});

// Make a change
runtime.set('data.count', 10);
// Output: "Count changed to: 10"

// Clean up when done
unsubscribe();
```

## Step 5: Add Actions

Actions encapsulate domain operations with preconditions and effects:

```typescript
import {
  defineDomain,
  defineDerived,
  defineAction,
  setValue,
  sequence,
  setState,
  z
} from '@manifesto-ai/core';

const counterDomain = defineDomain({
  id: 'counter',
  name: 'Counter',
  description: 'Counter with actions',

  dataSchema: z.object({
    count: z.number().default(0)
  }),

  stateSchema: z.object({
    step: z.number().default(1)
  }),

  initialState: {
    step: 1
  },

  paths: {
    derived: {
      doubled: defineDerived({
        deps: ['data.count'],
        expr: ['*', ['get', 'data.count'], 2],
        semantic: { type: 'computed', description: 'Double of count' }
      }),
      isPositive: defineDerived({
        deps: ['data.count'],
        expr: ['>', ['get', 'data.count'], 0],
        semantic: { type: 'computed', description: 'Whether count is positive' }
      })
    }
  },

  actions: {
    increment: defineAction({
      deps: ['data.count', 'state.step'],
      effect: setValue('data.count',
        ['+', ['get', 'data.count'], ['get', 'state.step']],
        'Increment counter'
      ),
      semantic: { type: 'action', verb: 'increment', description: 'Increment counter by step' }
    }),

    decrement: defineAction({
      deps: ['data.count', 'state.step'],
      // Only available when count > 0
      preconditions: [
        { path: 'derived.isPositive', expect: 'true', reason: 'Count must be positive' }
      ],
      effect: setValue('data.count',
        ['-', ['get', 'data.count'], ['get', 'state.step']],
        'Decrement counter'
      ),
      semantic: { type: 'action', verb: 'decrement', description: 'Decrement counter by step' }
    }),

    reset: defineAction({
      deps: ['data.count', 'state.step'],
      effect: sequence([
        setValue('data.count', 0, 'Reset count'),
        setState('state.step', 1, 'Reset step')
      ]),
      semantic: { type: 'action', verb: 'reset', description: 'Reset counter to zero' }
    })
  }
});
```

## Step 6: Execute Actions

```typescript
const runtime = createRuntime(counterDomain);

// Check if action is available
const canDecrement = runtime.checkAction('decrement');
console.log(canDecrement);
// { available: false, reason: 'Precondition not met' }

// Execute increment
await runtime.executeAction('increment');
console.log(runtime.get('data.count')); // 1

// Now decrement is available
console.log(runtime.checkAction('decrement'));
// { available: true, reason: null }

// Execute decrement
await runtime.executeAction('decrement');
console.log(runtime.get('data.count')); // 0
```

## Real-World Example: Shopping Cart

Here's a more complete example showing a shopping cart domain:

```typescript
import {
  defineDomain,
  defineDerived,
  defineAction,
  setValue,
  sequence,
  setState,
  apiCall,
  z
} from '@manifesto-ai/core';

const cartDomain = defineDomain({
  id: 'cart',
  name: 'Shopping Cart',
  description: 'Shopping cart domain with checkout',

  dataSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      quantity: z.number()
    })).default([]),
    couponCode: z.string().optional()
  }),

  stateSchema: z.object({
    isSubmitting: z.boolean().default(false),
    error: z.string().nullable().default(null)
  }),

  initialState: {
    isSubmitting: false,
    error: null
  },

  paths: {
    derived: {
      itemCount: defineDerived({
        deps: ['data.items'],
        expr: ['length', ['get', 'data.items']],
        semantic: { type: 'count', description: 'Number of items in cart' }
      }),

      subtotal: defineDerived({
        deps: ['data.items'],
        expr: ['sum', ['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]],
        semantic: { type: 'currency', description: 'Cart subtotal' }
      }),

      isEmpty: defineDerived({
        deps: ['derived.itemCount'],
        expr: ['==', ['get', 'derived.itemCount'], 0],
        semantic: { type: 'boolean', description: 'Whether cart is empty' }
      }),

      canCheckout: defineDerived({
        deps: ['derived.isEmpty', 'state.isSubmitting'],
        expr: ['and', ['!', ['get', 'derived.isEmpty']], ['!', ['get', 'state.isSubmitting']]],
        semantic: { type: 'boolean', description: 'Whether checkout is available' }
      })
    }
  },

  actions: {
    addItem: defineAction({
      deps: ['data.items'],
      input: z.object({ id: z.string(), name: z.string(), price: z.number() }),
      effect: setValue('data.items',
        ['concat', ['get', 'data.items'], [{ id: ['get', 'input.id'], name: ['get', 'input.name'], price: ['get', 'input.price'], quantity: 1 }]],
        'Add item to cart'
      ),
      semantic: { type: 'action', verb: 'add', description: 'Add item to cart' }
    }),

    removeItem: defineAction({
      deps: ['data.items'],
      input: z.object({ itemId: z.string() }),
      effect: setValue('data.items',
        ['filter', ['get', 'data.items'], ['!=', '$.id', ['get', 'input.itemId']]],
        'Remove item from cart'
      ),
      semantic: { type: 'action', verb: 'remove', description: 'Remove item from cart' }
    }),

    updateQuantity: defineAction({
      deps: ['data.items'],
      input: z.object({ itemId: z.string(), quantity: z.number().positive() }),
      effect: setValue('data.items',
        ['map', ['get', 'data.items'],
          ['if', ['==', '$.id', ['get', 'input.itemId']],
            { id: '$.id', name: '$.name', price: '$.price', quantity: ['get', 'input.quantity'] },
            '$']],
        'Update item quantity'
      ),
      semantic: { type: 'action', verb: 'update', description: 'Update item quantity' }
    }),

    checkout: defineAction({
      deps: ['data.items', 'data.couponCode', 'state.isSubmitting'],
      preconditions: [
        { path: 'derived.canCheckout', expect: 'true', reason: 'Checkout must be available' }
      ],
      effect: sequence([
        setState('state.isSubmitting', true, 'Set submitting'),
        setState('state.error', null, 'Clear error'),
        apiCall({
          method: 'POST',
          url: '/api/checkout',
          body: { items: ['get', 'data.items'], couponCode: ['get', 'data.couponCode'] },
          description: 'Submit checkout'
        }),
        setValue('data.items', [], 'Clear cart'),
        setState('state.isSubmitting', false, 'Clear submitting')
      ]),
      semantic: { type: 'action', verb: 'checkout', description: 'Submit order', risk: 'high' }
    }),

    clearCart: defineAction({
      deps: ['data.items'],
      preconditions: [
        { path: 'derived.isEmpty', expect: 'false', reason: 'Cart must have items' }
      ],
      effect: setValue('data.items', [], 'Clear all items'),
      semantic: { type: 'action', verb: 'clear', description: 'Clear cart' }
    })
  }
});

// Usage
const runtime = createRuntime(cartDomain);

// Add items
await runtime.executeAction('addItem', {
  id: 'prod-1',
  name: 'Laptop',
  price: 999
});

await runtime.executeAction('addItem', {
  id: 'prod-2',
  name: 'Mouse',
  price: 29
});

console.log(runtime.get('derived.itemCount'));  // 2
console.log(runtime.get('derived.subtotal'));   // 1028
console.log(runtime.get('derived.canCheckout')); // true

// Update quantity
await runtime.executeAction('updateQuantity', {
  itemId: 'prod-2',
  quantity: 2
});

console.log(runtime.get('derived.subtotal'));   // 1057
```

## Next Steps

Now that you understand the basics, explore:

- [Core Concepts](./concepts.md) - Deep dive into SemanticPath, Expression DSL, and Effects
- [Architecture](./architecture.md) - Understand the 3-layer architecture
- [Bridge Integration](../packages/bridge/README.md) - Connect to React, Zustand, etc.
- [UI Projection](../packages/projection-ui/README.md) - Generate UI states automatically
- [Agent Projection](../packages/projection-agent/README.md) - Make your domain AI-readable

## Common Patterns

### Field Validation

```typescript
const userDomain = defineDomain({
  id: 'user',
  name: 'User',
  description: 'User registration domain',

  dataSchema: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  }),

  stateSchema: z.object({}),
  initialState: {},

  paths: {
    derived: {
      isEmailValid: defineDerived({
        deps: ['data.email'],
        expr: ['test', ['get', 'data.email'], '^[^@]+@[^@]+\\.[^@]+$'],
        semantic: { type: 'validation', description: 'Whether email is valid' }
      }),
      isPasswordStrong: defineDerived({
        deps: ['data.password'],
        expr: ['>=', ['length', ['get', 'data.password']], 8],
        semantic: { type: 'validation', description: 'Whether password is strong enough' }
      }),
      canSubmit: defineDerived({
        deps: ['derived.isEmailValid', 'derived.isPasswordStrong'],
        expr: ['and', ['get', 'derived.isEmailValid'], ['get', 'derived.isPasswordStrong']],
        semantic: { type: 'boolean', description: 'Whether form can be submitted' }
      })
    }
  }
});
```

### Loading States

```typescript
const dataDomain = defineDomain({
  id: 'data',
  name: 'Data',
  description: 'Data fetching domain',

  dataSchema: z.object({
    items: z.array(z.string()).default([])
  }),

  stateSchema: z.object({
    isLoading: z.boolean().default(false),
    error: z.string().nullable().default(null)
  }),

  initialState: {
    isLoading: false,
    error: null
  },

  paths: {
    derived: {
      isNotLoading: defineDerived({
        deps: ['state.isLoading'],
        expr: ['!', ['get', 'state.isLoading']],
        semantic: { type: 'boolean', description: 'Whether not loading' }
      })
    }
  },

  actions: {
    fetch: defineAction({
      deps: ['state.isLoading'],
      preconditions: [
        { path: 'derived.isNotLoading', expect: 'true', reason: 'Already loading' }
      ],
      effect: sequence([
        setState('state.isLoading', true, 'Set loading'),
        setState('state.error', null, 'Clear error'),
        apiCall({ method: 'GET', url: '/api/items', description: 'Fetch items' }),
        setState('state.isLoading', false, 'Clear loading')
      ]),
      semantic: { type: 'action', verb: 'fetch', description: 'Fetch data from API' }
    })
  }
});
```

### Conditional Logic

```typescript
const pricingDomain = defineDomain({
  id: 'pricing',
  name: 'Pricing',
  description: 'Pricing calculation domain',

  dataSchema: z.object({
    basePrice: z.number(),
    isPremium: z.boolean().default(false),
    quantity: z.number().default(1)
  }),

  stateSchema: z.object({}),
  initialState: {},

  paths: {
    derived: {
      discount: defineDerived({
        deps: ['data.isPremium', 'data.quantity'],
        expr: ['if', ['get', 'data.isPremium'],
          0.2,  // 20% discount for premium
          ['if', ['>=', ['get', 'data.quantity'], 10],
            0.1,  // 10% bulk discount
            0     // No discount
          ]
        ],
        semantic: { type: 'percentage', description: 'Applicable discount rate' }
      }),
      finalPrice: defineDerived({
        deps: ['data.basePrice', 'data.quantity', 'derived.discount'],
        expr: ['*', ['get', 'data.basePrice'], ['get', 'data.quantity'], ['-', 1, ['get', 'derived.discount']]],
        semantic: { type: 'currency', description: 'Final price after discount' }
      })
    }
  }
});
```
