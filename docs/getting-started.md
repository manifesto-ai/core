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
const counterDomain = defineDomain('counter', {
  // Source data schema - the "truth" your domain operates on
  dataSchema: z.object({
    count: z.number().default(0)
  }),

  // UI state schema - transient state for the UI
  stateSchema: z.object({
    step: z.number().default(1)
  }),

  // Derived values - computed from source data
  // Keys are auto-prefixed: 'doubled' becomes 'derived.doubled'
  derived: {
    doubled: defineDerived(
      { $multiply: [{ $get: 'data.count' }, 2] },
      z.number()
    ),
    isPositive: defineDerived(
      { $gt: [{ $get: 'data.count' }, 0] },
      z.boolean()
    )
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

const counterDomain = defineDomain('counter', {
  dataSchema: z.object({
    count: z.number().default(0)
  }),

  stateSchema: z.object({
    step: z.number().default(1)
  }),

  derived: {
    doubled: defineDerived(
      { $multiply: [{ $get: 'data.count' }, 2] },
      z.number()
    )
  },

  actions: {
    increment: defineAction({
      // Action is always available
      effect: setValue('data.count', {
        $add: [{ $get: 'data.count' }, { $get: 'state.step' }]
      })
    }),

    decrement: defineAction({
      // Only available when count > 0
      precondition: { $gt: [{ $get: 'data.count' }, 0] },
      effect: setValue('data.count', {
        $subtract: [{ $get: 'data.count' }, { $get: 'state.step' }]
      })
    }),

    reset: defineAction({
      effect: sequence([
        setValue('data.count', 0),
        setState('state.step', 1)
      ])
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

const cartDomain = defineDomain('cart', {
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

  derived: {
    itemCount: defineDerived(
      { $size: { $get: 'data.items' } },
      z.number()
    ),

    subtotal: defineDerived(
      {
        $sum: {
          $map: [
            { $get: 'data.items' },
            { $multiply: ['$item.price', '$item.quantity'] }
          ]
        }
      },
      z.number()
    ),

    isEmpty: defineDerived(
      { $eq: [{ $get: 'derived.itemCount' }, 0] },
      z.boolean()
    ),

    canCheckout: defineDerived(
      {
        $and: [
          { $not: { $get: 'derived.isEmpty' } },
          { $not: { $get: 'state.isSubmitting' } }
        ]
      },
      z.boolean()
    )
  },

  actions: {
    addItem: defineAction({
      effect: setValue('data.items', {
        $concat: [
          { $get: 'data.items' },
          [{
            id: { $get: 'input.id' },
            name: { $get: 'input.name' },
            price: { $get: 'input.price' },
            quantity: 1
          }]
        ]
      })
    }),

    removeItem: defineAction({
      effect: setValue('data.items', {
        $filter: [
          { $get: 'data.items' },
          { $ne: ['$item.id', { $get: 'input.itemId' }] }
        ]
      })
    }),

    updateQuantity: defineAction({
      precondition: { $gt: [{ $get: 'input.quantity' }, 0] },
      effect: setValue('data.items', {
        $map: [
          { $get: 'data.items' },
          {
            $if: [
              { $eq: ['$item.id', { $get: 'input.itemId' }] },
              {
                id: '$item.id',
                name: '$item.name',
                price: '$item.price',
                quantity: { $get: 'input.quantity' }
              },
              '$item'
            ]
          }
        ]
      })
    }),

    checkout: defineAction({
      precondition: { $get: 'derived.canCheckout' },
      effect: sequence([
        setState('state.isSubmitting', true),
        setState('state.error', null),
        apiCall({
          method: 'POST',
          url: '/api/checkout',
          body: {
            items: { $get: 'data.items' },
            couponCode: { $get: 'data.couponCode' }
          }
        }),
        setValue('data.items', []),
        setState('state.isSubmitting', false)
      ])
    }),

    clearCart: defineAction({
      precondition: { $not: { $get: 'derived.isEmpty' } },
      effect: setValue('data.items', [])
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
const userDomain = defineDomain('user', {
  dataSchema: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  }),

  derived: {
    isEmailValid: defineDerived(
      { $test: [{ $get: 'data.email' }, '^[^@]+@[^@]+\\.[^@]+$'] },
      z.boolean()
    ),
    isPasswordStrong: defineDerived(
      { $gte: [{ $size: { $get: 'data.password' } }, 8] },
      z.boolean()
    ),
    canSubmit: defineDerived(
      {
        $and: [
          { $get: 'derived.isEmailValid' },
          { $get: 'derived.isPasswordStrong' }
        ]
      },
      z.boolean()
    )
  }
});
```

### Loading States

```typescript
const dataDomain = defineDomain('data', {
  dataSchema: z.object({
    items: z.array(z.string()).default([])
  }),

  stateSchema: z.object({
    isLoading: z.boolean().default(false),
    error: z.string().nullable().default(null)
  }),

  actions: {
    fetch: defineAction({
      precondition: { $not: { $get: 'state.isLoading' } },
      effect: sequence([
        setState('state.isLoading', true),
        setState('state.error', null),
        apiCall({ method: 'GET', url: '/api/items' }),
        setState('state.isLoading', false)
      ])
    })
  }
});
```

### Conditional Logic

```typescript
const pricingDomain = defineDomain('pricing', {
  dataSchema: z.object({
    basePrice: z.number(),
    isPremium: z.boolean().default(false),
    quantity: z.number().default(1)
  }),

  derived: {
    discount: defineDerived(
      {
        $if: [
          { $get: 'data.isPremium' },
          0.2,  // 20% discount for premium
          {
            $if: [
              { $gte: [{ $get: 'data.quantity' }, 10] },
              0.1,  // 10% bulk discount
              0     // No discount
            ]
          }
        ]
      },
      z.number()
    ),
    finalPrice: defineDerived(
      {
        $multiply: [
          { $get: 'data.basePrice' },
          { $get: 'data.quantity' },
          { $subtract: [1, { $get: 'derived.discount' }] }
        ]
      },
      z.number()
    )
  }
});
```
