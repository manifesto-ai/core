<p align="center">
  <img src="./docs/assets/manifest-logo.png" alt="Manifesto AI Logo" width="120" />
</p>

<h1 align="center">Manifesto AI</h1>

<p align="center">
  <strong>AI-Native Semantic State Engine</strong><br/>
  A unified world model where UI, Agents, and Humans operate over the same explicit semantics.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@manifesto-ai/core"><img src="https://img.shields.io/npm/v/@manifesto-ai/core?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="https://github.com/anthropics/manifesto-ai/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License" /></a>
  <a href="https://github.com/anthropics/manifesto-ai/actions"><img src="https://img.shields.io/github/actions/workflow/status/anthropics/manifesto-ai/ci.yml?style=flat-square" alt="CI Status" /></a>
  <a href="https://bundlephobia.com/package/@manifesto-ai/core"><img src="https://img.shields.io/bundlephobia/minzip/@manifesto-ai/core?style=flat-square&label=bundle%20size" alt="Bundle Size" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#why-manifesto">Why Manifesto</a> •
  <a href="#core-concepts">Concepts</a> •
  <a href="./docs/getting-started.md">Docs</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## What is Manifesto?

Manifesto is a **semantic operating layer** that turns any application into a fully observable, deterministic, and AI-readable world.

It is **not** a UI toolkit, not a form builder, and not a state management library in the traditional sense.

```typescript
// Define your domain once. Everything else is a projection.
const counter = defineDomain('counter', {
  dataSchema: z.object({ count: z.number().default(0) }),
  
  derived: {
    doubled: defineDerived(
      { $multiply: [{ $get: 'data.count' }, 2] },
      z.number()
    )
  },
  
  actions: {
    increment: defineAction({
      effect: setValue('data.count', { $add: [{ $get: 'data.count' }, 1] })
    })
  }
});

const runtime = createRuntime(counter);
runtime.get('derived.doubled');        // 0
await runtime.executeAction('increment');
runtime.get('derived.doubled');        // 2
```

---

## Why Manifesto?

Traditional applications bury their meaning in UI components, API handlers, validation utilities, and conditionals scattered across files. This creates a **black-box environment** where:

- 🤖 AI agents cannot safely operate (they must *infer* meaning from pixels)
- 🧠 Humans struggle to understand the rules
- 🔮 Behavior is unpredictable and hard to explain
- 📋 Logic is duplicated and inconsistent

**Manifesto inverts this paradigm.** Instead of AI agents *inferring* what your application means, your application *declares* what it means.

| Traditional Approach                       | Manifesto Approach                            |
|--------------------------------------------|-----------------------------------------------|
| AI infers UI semantics via Computer Vision | Application declares semantics explicitly     |
| ~$30 per 200 interactions (GPT-4o + CV)    | ~$0.03 per 200 interactions (GPT-4o-mini)     |
| Fragile selectors, flaky tests             | Stable semantic paths, deterministic behavior |
| Logic scattered across components          | Single source of truth                        |

---

## Core Concepts

### SemanticPath

Every piece of meaning has an addressable path:

```typescript
runtime.get('data.user.email');           // Source data
runtime.get('state.isSubmitting');        // Transient UI state
runtime.get('derived.canCheckout');       // Computed values
```

### Declarative Expressions

Rules are data, not code. They can be analyzed, serialized, and explained:

```typescript
// This expression IS the business rule, not a description of it
{
  $and: [
    { $gt: [{ $get: 'derived.itemCount' }, 0] },
    { $not: { $get: 'state.isSubmitting' } }
  ]
}
```

### Actions with Preconditions

Every domain action has explicit preconditions and described effects:

```typescript
defineAction({
  precondition: { $get: 'derived.canCheckout' },
  effect: sequence([
    setState('state.isSubmitting', true),
    apiCall({ method: 'POST', url: '/api/checkout', body: { $get: 'data' } }),
    setState('state.isSubmitting', false)
  ])
})
```

### Projections

UI, AI agents, and APIs are all **projections** of the same semantic model:

```
                    ┌─────────────────┐
                    │  Domain Model   │
                    │  (Single Truth) │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   ┌──────────┐       ┌──────────┐       ┌──────────┐
   │  UI      │       │  Agent   │       │  GraphQL │
   │Projection│       │Projection│       │Projection│
   └──────────┘       └──────────┘       └──────────┘
```

---

## Quick Start

### Installation

```bash
# pnpm (recommended)
pnpm add @manifesto-ai/core

# npm
npm install @manifesto-ai/core

# yarn
yarn add @manifesto-ai/core
```

### Define a Domain

```typescript
import { defineDomain, defineDerived, defineAction, setValue, z } from '@manifesto-ai/core';

const todosDomain = defineDomain('todos', {
  dataSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      text: z.string(),
      done: z.boolean()
    })).default([])
  }),

  derived: {
    remaining: defineDerived(
      { $size: { $filter: [{ $get: 'data.items' }, { $not: '$item.done' }] } },
      z.number()
    ),
    allDone: defineDerived(
      { $eq: [{ $get: 'derived.remaining' }, 0] },
      z.boolean()
    )
  },

  actions: {
    toggle: defineAction({
      effect: setValue('data.items', {
        $map: [
          { $get: 'data.items' },
          {
            $if: [
              { $eq: ['$item.id', { $get: 'input.id' }] },
              { id: '$item.id', text: '$item.text', done: { $not: '$item.done' } },
              '$item'
            ]
          }
        ]
      })
    })
  }
});
```

### Create Runtime and Operate

```typescript
import { createRuntime } from '@manifesto-ai/core';

const runtime = createRuntime(todosDomain);

// Read values
console.log(runtime.get('derived.remaining'));  // 0

// Subscribe to changes
runtime.subscribe('derived.remaining', (count) => {
  console.log(`${count} items remaining`);
});

// Execute actions
await runtime.executeAction('toggle', { id: 'todo-1' });
```

---

## Packages

| Package | Description |
|---------|-------------|
| [`@manifesto-ai/core`](./packages/core) | Core runtime, domain definition, expression DSL |
| [`@manifesto-ai/bridge`](./packages/bridge) | Framework integrations (React, Zustand, etc.) |
| [`@manifesto-ai/projection-ui`](./packages/projection-ui) | UI state projection for rendering |
| [`@manifesto-ai/projection-agent`](./packages/projection-agent) | AI agent projection for semantic operation |

---

## Documentation

- **[Getting Started](./docs/getting-started.md)** — 5-minute introduction
- **[Core Concepts](./docs/concepts.md)** — SemanticPath, Expressions, Effects
- **[Architecture](./docs/architecture.md)** — 3-layer design philosophy
- **[Expression DSL Reference](./docs/expression-dsl.md)** — Complete operator reference
- **[Examples](./examples)** — Real-world patterns and use cases

---

## Real-World Example: Shopping Cart

```typescript
const cartDomain = defineDomain('cart', {
  dataSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      quantity: z.number()
    })).default([])
  }),

  stateSchema: z.object({
    isSubmitting: z.boolean().default(false)
  }),

  derived: {
    'derived.subtotal': defineDerived(
      { $sum: { $map: [{ $get: 'data.items' }, { $multiply: ['$item.price', '$item.quantity'] }] } },
      z.number()
    ),
    'derived.canCheckout': defineDerived(
      { $and: [
        { $gt: [{ $size: { $get: 'data.items' } }, 0] },
        { $not: { $get: 'state.isSubmitting' } }
      ]},
      z.boolean()
    )
  },

  actions: {
    addItem: defineAction({
      effect: setValue('data.items', {
        $concat: [{ $get: 'data.items' }, [{ $get: 'input' }]]
      })
    }),

    checkout: defineAction({
      precondition: { $get: 'derived.canCheckout' },
      effect: sequence([
        setState('state.isSubmitting', true),
        apiCall({ method: 'POST', url: '/api/checkout', body: { items: { $get: 'data.items' } } }),
        setValue('data.items', []),
        setState('state.isSubmitting', false)
      ])
    })
  }
});
```

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

```bash
# Clone the repository
git clone https://github.com/manifesto-ai/core.git
cd core

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build all packages
pnpm build
```

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Roadmap

- [ ] Schema Marketplace — Share and discover domain schemas
- [ ] Manifesto Studio — Visual domain builder
- [ ] More framework bridges (Vue, Svelte, Solid)
- [ ] Time-travel debugging
- [ ] Formal verification of preconditions

See the [open issues](https://github.com/anthropics/manifesto-ai/issues) for a full list of proposed features.

---

## License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for more information.

---

## Acknowledgments

Manifesto is built on the shoulders of giants:

- [Zod](https://zod.dev/) — TypeScript-first schema validation
- Inspired by CQRS/Event Sourcing patterns
- The broader semantic web and knowledge representation community

---

<p align="center">
  <sub>Built with 🧠 for the AI-native future</sub>
</p>
