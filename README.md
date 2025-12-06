# Manifesto

![Manifesto Logo](./docs/assets/manifesto-logo.png)

**AI-Native Semantic UI State Layer**

> Manifesto is not just a schema-driven UI engine. It is a **Semantic UI State Layer** that exposes the full meaning, structure, rules, and context of an application's UI—so that both humans and AI Agents can understand, reason about, and interact with the interface.

<div align="center">

![playground-demo](./docs/assets/playground-demo.gif)

*AI understands your form's semantic context and can fill fields intelligently*

**[🎮 Try the Playground](https://manifesto-ai-playground.vercel.app)** • **[📖 Documentation](#documentation)** • **[🎨 Storybook Demo](https://eggplantiny.github.io/manifesto-ai/)**

</div>

---

## What Makes Manifesto Different

Most form libraries generate UI from schemas. Manifesto does that too—but that's not what makes it special.

**The real innovation**: Manifesto exports the complete semantic context of your UI in a structure that AI can understand and reason about.

```
Traditional UI Libraries          │  Manifesto
──────────────────────────────────┼────────────────────────────────────
Schema → Render → DOM             │  Schema → Engine → DOM
         ↓                        │              ↓
    Internal state                │       Semantic State Export
    (not accessible)              │              ↓
                                  │         AI Agents can:
                                  │         • Read current state
                                  │         • Understand visibility rules
                                  │         • Know validation status
                                  │         • Predict valid transitions
                                  │         • Navigate workflows
```

## Why Manifesto?

- **Semantic State Export**: AI agents get full context—values, rules, dependencies, transitions—not just pixels.
- **Schema-First**: Define forms as data, not code. Perfect for AI agents to generate and modify.
- **Framework Agnostic**: Core engine works with any framework. Official bindings for React and Vue.
- **Type-Safe**: Full TypeScript support with comprehensive type definitions.
- **Reactive**: Automatic dependency tracking and conditional field updates.
- **Secure**: Expression DSL with whitelisted operators - no `eval()`, no code injection.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Schema Definition                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Entity    │  │    View     │  │   Action    │          │
│  │   Schema    │  │   Schema    │  │   Schema    │          │
│  │ (Data Model)│  │ (UI Layout) │  │ (Workflows)  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    @manifesto-ai/engine                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐  │
│  │ Evaluator │  │  Tracker  │  │  Runtime  │  │  Loader  │  │
│  │(Expression│  │(Dependency│  │  (State   │  │ (Schema) │  │
│  │  Parser)  │  │   DAG)    │  │  Manager) │  │          │  │
│  └───────────┘  └───────────┘  └───────────┘  └──────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┬───────────────┐
          ▼               ▼               ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│ @manifesto-ai/react │   │  @manifesto-ai/vue  │   │  @manifesto-ai/ai-util   │
│  ┌───────────────┐  │   │  ┌───────────────┐  │   │ Semantic Snapshot   │
│  │ useFormRuntime│  │   │  │ useFormRuntime│  │   │ Safe Dispatch + LLM │
│  │ FormRenderer  │  │   │  │ FormRenderer  │  │   │ Tool Definitions    │
│  └───────────────┘  │   │  └───────────────┘  │   └─────────────────────┘
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

## Quick Start

### Installation

```bash
# Core packages
pnpm add @manifesto-ai/schema @manifesto-ai/engine

# AI interoperability (optional)
pnpm add @manifesto-ai/ai-util

# Framework binding (choose one)
pnpm add @manifesto-ai/react  # For React
pnpm add @manifesto-ai/vue    # For Vue
```

### Define Your Schema

```typescript
// entity.ts - Define data structure
import { entity, field } from '@manifesto-ai/schema'

export const productEntity = entity('product', 'Product', '1.0.0')
  .field(field.string('name').label('Product Name').required())
  .field(field.number('price').label('Price').min(0))
  .field(field.enum('category', [
    { value: 'electronics', label: 'Electronics' },
    { value: 'clothing', label: 'Clothing' },
  ]).label('Category'))
  .build()
```

```typescript
// view.ts - Define UI layout
import { view, section, viewField, layout } from '@manifesto-ai/schema'

export const productView = view('product-create', 'Create Product', '1.0.0')
  .entityRef('product')
  .mode('create')
  .layout(layout.form())
  .section(
    section('basic')
      .title('Basic Information')
      .field(viewField.textInput('name', 'name'))
      .field(viewField.numberInput('price', 'price'))
      .field(viewField.select('category', 'category'))
  )
  .build()
```

### Render with React

```tsx
import { FormRenderer } from '@manifesto-ai/react'
import '@manifesto-ai/react/styles'
import { productView, productEntity } from './schemas'

function ProductForm() {
  const handleSubmit = (data: Record<string, unknown>) => {
    console.log('Form submitted:', data)
  }

  return (
    <FormRenderer
      schema={productView}
      entitySchema={productEntity}
      onSubmit={handleSubmit}
    />
  )
}
```

### Render with Vue

```vue
<script setup lang="ts">
import { FormRenderer } from '@manifesto-ai/vue'
import '@manifesto-ai/vue/styles'
import { productView, productEntity } from './schemas'

const handleSubmit = (data: Record<string, unknown>) => {
  console.log('Form submitted:', data)
}
</script>

<template>
  <FormRenderer
    :schema="productView"
    :entity-schema="productEntity"
    @submit="handleSubmit"
  />
</template>
```

### Expose Semantic State to AI (optional)

```ts
import { createFormRuntime } from '@manifesto-ai/engine'
import { createInteroperabilitySession, toToolDefinitions } from '@manifesto-ai/ai-util'

const runtime = createFormRuntime(productView, { entitySchema: productEntity })
const session = createInteroperabilitySession({ runtime, viewSchema: productView, entitySchema: productEntity })

const snapshot = session.snapshot() // semantic state for agents
const tools = toToolDefinitions(snapshot, { omitUnavailable: true }) // OpenAI/Claude tool schemas
```

## Key Features

### Expression DSL

Safe, array-based expressions for dynamic behavior:

```typescript
// Hide shipping fields for digital products
{
  hidden: ['==', '$state.productType', 'DIGITAL']
}

// Complex conditions
{
  disabled: ['AND',
    ['==', '$state.status', 'PUBLISHED'],
    ['!=', '$user.role', 'ADMIN']
  ]
}
```

### Reactive Fields

Automatic updates based on field dependencies:

```typescript
viewField.select('city', 'city')
  .dependsOn(['country'])
  .reaction(
    on.change()
      .do(actions.setOptions('city', dataSource.api({
        endpoint: '/api/cities',
        params: { country: '$state.country' }
      })))
  )
```

### Validation

Declarative constraints with custom expressions:

```typescript
field.string('email')
  .required()
  .pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')
  .constraint({
    type: 'custom',
    expression: ['NOT', ['CONTAINS', '$state.email', 'spam']],
    message: 'Invalid email domain'
  })
```

## Packages

| Package | Description |
|---------|-------------|
| [`@manifesto-ai/schema`](./packages/schema) | Schema types, builders, and validators |
| [`@manifesto-ai/engine`](./packages/engine) | Core runtime engine |
| [`@manifesto-ai/ai-util`](./packages/ai-util) | AI interoperability: semantic snapshots, guard-railed dispatch, LLM tool definitions |
| [`@manifesto-ai/react`](./packages/react) | React hooks and components |
| [`@manifesto-ai/vue`](./packages/vue) | Vue composables and components |
| [`@manifesto-ai/example-schemas`](./packages/example-schemas) | Example schemas and test utilities |

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Architecture](./docs/architecture.md)
- [Philosophy](./docs/philosophy.md)
- **Schema Reference**
  - [Entity Schema](./docs/schema-reference/entity-schema.md)
  - [View Schema](./docs/schema-reference/view-schema.md)
  - [Expression DSL](./docs/schema-reference/expression-dsl.md)
  - [Reaction DSL](./docs/schema-reference/reaction-dsl.md)
  - [Action Schema](./docs/schema-reference/action-schema.md)
- **API Reference**
  - [Engine API](./docs/api-reference/engine.md)
  - [React API](./docs/api-reference/react.md)
  - [Vue API](./docs/api-reference/vue.md)
- **Guides**
  - [Basic CRUD Form](./docs/guides/basic-crud-form.md)
  - [Dynamic Conditions](./docs/guides/dynamic-conditions.md)
  - [Cascade Select](./docs/guides/cascade-select.md)
  - [Validation Patterns](./docs/guides/validation.md)
  - [Legacy Integration](./docs/guides/legacy-integration.md)

## Live Examples

**🎮 Interactive Playground:** [https://manifesto-playground.vercel.app](https://manifesto-playground.vercel.app)
- Edit schemas in real-time
- Preview form rendering instantly
- Chat with AI to fill forms

**📚 Storybook Demos:** [https://eggplantiny.github.io/manifesto-ai/](https://eggplantiny.github.io/manifesto-ai/)
- [React Storybook](https://eggplantiny.github.io/manifesto-ai/react/)
- [Vue Storybook](https://eggplantiny.github.io/manifesto-ai/vue/)

**Local Development:**
- `pnpm playground` - Interactive Playground
- `pnpm storybook:react` - React Storybook
- `pnpm storybook:vue` - Vue Storybook

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start Storybook (React)
pnpm storybook:react

# Start Storybook (Vue)
pnpm storybook:vue
```

## Requirements

- Node.js >= 20.0.0
- pnpm >= 9.0.0

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT
