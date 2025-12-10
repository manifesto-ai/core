# Manifesto AI

> AI Native Semantic Layer for SaaS Business Logic

Define your business logic **declaratively**. Let AI and humans **reason in the same language**.

## Why Manifesto?

Traditional SaaS applications scatter business logic across UI components, API handlers, and database queries. This creates a **black box** that neither humans nor AI can reason about effectively.

Manifesto introduces a **semantic layer** where:

- **Atomic**: Every piece of state has a unique `SemanticPath` address
- **Monadic**: Side effects are described, not executed, using a safe `Effect` system
- **AI-Native**: Domain definitions are optimized for AI to read, write, and modify

```typescript
// Define your domain once, use it everywhere
const orderDomain = defineDomain('order', {
  dataSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      price: z.number(),
      quantity: z.number()
    })),
    couponCode: z.string().optional()
  }),

  stateSchema: z.object({
    isSubmitting: z.boolean()
  }),

  derived: {
    'derived.totalPrice': defineDerived(
      { $sum: { $map: ['data.items', { $multiply: ['$item.price', '$item.quantity'] }] } },
      z.number()
    )
  },

  actions: {
    submit: defineAction({
      precondition: { $gt: [{ $get: 'derived.totalPrice' }, 0] },
      effect: sequence([
        setState('state.isSubmitting', true),
        apiCall({ method: 'POST', url: '/api/orders', body: { $get: 'data' } }),
        setState('state.isSubmitting', false)
      ])
    })
  }
});

// Create runtime and use it
const runtime = createRuntime(orderDomain);
runtime.set('data.items', [{ id: '1', price: 100, quantity: 2 }]);
console.log(runtime.get('derived.totalPrice')); // 200
```

## Packages

| Package | Description |
|---------|-------------|
| [@manifesto-ai/core](./packages/core) | Domain definition, runtime, expression evaluation |
| [@manifesto-ai/bridge](./packages/bridge) | Framework-agnostic adapters |
| [@manifesto-ai/bridge-zustand](./packages/bridge-zustand) | Zustand state management integration |
| [@manifesto-ai/bridge-react-hook-form](./packages/bridge-react-hook-form) | React Hook Form integration |
| [@manifesto-ai/projection-ui](./packages/projection-ui) | UI state projection |
| [@manifesto-ai/projection-agent](./packages/projection-agent) | AI agent context generation |
| [@manifesto-ai/projection-graphql](./packages/projection-graphql) | GraphQL schema auto-generation |

## Quick Start

### Installation

```bash
# Using pnpm (recommended)
pnpm add @manifesto-ai/core

# Using npm
npm install @manifesto-ai/core

# Using yarn
yarn add @manifesto-ai/core
```

### Basic Usage

```typescript
import { defineDomain, createRuntime, defineSource, defineDerived, z } from '@manifesto-ai/core';

// 1. Define your domain schema
const counterDomain = defineDomain('counter', {
  dataSchema: z.object({
    count: z.number().default(0)
  }),

  derived: {
    'derived.isPositive': defineDerived(
      { $gt: [{ $get: 'data.count' }, 0] },
      z.boolean()
    ),
    'derived.doubled': defineDerived(
      { $multiply: [{ $get: 'data.count' }, 2] },
      z.number()
    )
  }
});

// 2. Create a runtime instance
const runtime = createRuntime(counterDomain);

// 3. Read and write values using semantic paths
console.log(runtime.get('data.count'));      // 0
console.log(runtime.get('derived.doubled')); // 0

runtime.set('data.count', 5);
console.log(runtime.get('derived.doubled')); // 10
console.log(runtime.get('derived.isPositive')); // true

// 4. Subscribe to changes
const unsubscribe = runtime.subscribe('data.count', (newValue) => {
  console.log('Count changed:', newValue);
});
```

## Architecture

Manifesto follows a **3-layer architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Projection Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ projection-ui│  │projection-   │  │projection-graphql│   │
│  │              │  │agent         │  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Bridge Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │    bridge    │  │bridge-zustand│  │bridge-react-     │   │
│  │   (vanilla)  │  │              │  │hook-form         │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Core Layer                             │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌───────┐ │
│  │ Domain │  │Express-│  │ Effect │  │  DAG   │  │Runtime│ │
│  │        │  │  ion   │  │        │  │        │  │       │ │
│  └────────┘  └────────┘  └────────┘  └────────┘  └───────┘ │
└─────────────────────────────────────────────────────────────┘
```

- **Core**: Domain definitions, expression DSL, effect system, dependency graph
- **Bridge**: Connects runtime to UI frameworks (React, Zustand, etc.)
- **Projection**: Transforms domain state for specific consumers (UI, AI, GraphQL)

## Documentation

- [Getting Started](./docs/getting-started.md) - Step-by-step tutorial
- [Core Concepts](./docs/concepts.md) - SemanticPath, Expression DSL, Effects
- [Architecture](./docs/architecture.md) - System design and data flow

## Key Concepts

### SemanticPath

Every value in Manifesto has a unique address:

```typescript
'data.user.name'        // Source data
'state.isLoading'       // UI state
'derived.fullName'      // Computed value
'async.fetchUser'       // Async operation result
```

### Expression DSL

A JSON-based DSL for declarative logic:

```typescript
// Comparison
{ $gt: [{ $get: 'data.price' }, 100] }

// Arithmetic
{ $multiply: [{ $get: 'data.quantity' }, { $get: 'data.price' }] }

// String operations
{ $concat: [{ $get: 'data.firstName' }, ' ', { $get: 'data.lastName' }] }

// Conditional
{ $if: [{ $get: 'state.isPremium' }, 0.9, 1.0] }
```

### Effect System

Describe side effects as data:

```typescript
// Effects are descriptions, not executions
const submitEffect = sequence([
  setState('state.isSubmitting', true),
  apiCall({ method: 'POST', url: '/api/orders', body: { $get: 'data' } }),
  setState('state.isSubmitting', false)
]);

// Execute when ready
await runEffect(submitEffect, runtime);
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## License

MIT
