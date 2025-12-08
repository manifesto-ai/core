# Architecture

Manifesto uses a 3-layer schema architecture with a framework-agnostic engine core. This document explains the system design in detail.

## Table of Contents

- [Overview](#overview)
- [3-Layer Schema Architecture](#3-layer-schema-architecture)
- [Engine Components](#engine-components)
- [Data Flow](#data-flow)
- [Framework Bindings](#framework-bindings)
- [Package Structure](#package-structure)

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Schema Definition                           │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│   │   Entity    │   │    View     │   │   Action    │          │
│   │   Schema    │   │   Schema    │   │   Schema    │          │
│   │ (Data Model)│   │ (UI Layout) │   │ (Workflows) │          │
│   └─────────────┘   └─────────────┘   └─────────────┘          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      @manifesto-ai/engine                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │ Expression │  │ Dependency │  │    Form    │  │  Schema   │ │
│  │ Evaluator  │  │  Tracker   │  │  Runtime   │  │  Loader   │ │
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Legacy Adapter                           │ │
│  │           Transform heterogeneous API formats               │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┬───────────────┐
           ▼               ▼               ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│ @manifesto-ai/react │   │  @manifesto-ai/vue  │   │@manifesto-ai/view-snapshot│
│  ┌───────────────┐  │   │  ┌───────────────┐  │   │ ViewSnapshot Engine │
│  │ useFormRuntime│  │   │  │ useFormRuntime│  │   │ Page/Form/Table     │
│  │ FormRenderer  │  │   │  │ FormRenderer  │  │   │ Snapshots           │
│  │ Field Inputs  │  │   │  │ Field Inputs  │  │   │ Intent Dispatch     │
│  └───────────────┘  │   │  └───────────────┘  │   └─────────────────────┘
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

---

## 3-Layer Schema Architecture

Manifesto separates concerns into three distinct schema layers:

### Entity Layer

**Purpose**: Define data structure and validation constraints

**Responsibilities**:
- Field data types (string, number, boolean, date, enum, etc.)
- Validation constraints (required, min, max, pattern)
- Relationships between entities
- Default values

```typescript
import { entity, field } from '@manifesto-ai/schema'

const productEntity = entity('product', 'Product', '1.0.0')
  .field(
    field.string('name')
      .label('Product Name')
      .required()
      .max(100)
  )
  .field(
    field.number('price')
      .label('Price')
      .min(0)
  )
  .field(
    field.enum('category', [
      { value: 'electronics', label: 'Electronics' },
      { value: 'clothing', label: 'Clothing' },
    ])
      .label('Category')
      .required()
  )
  .build()
```

**Key Interfaces**:

| Interface | Purpose |
|-----------|---------|
| `EntitySchema` | Complete entity definition |
| `EntityField` | Individual field definition |
| `Constraint` | Validation rule (required, min, max, pattern, custom) |
| `DataType` | Field data type |
| `Relation` | Entity relationships |

### View Layer

**Purpose**: Define UI layout, components, and reactive behavior

**Responsibilities**:
- Component mapping (which UI component for each field)
- Layout structure (sections, grids, tabs)
- Conditional visibility/disabled states
- Reactive interactions (reactions)
- Styling configuration

```typescript
import { view, section, viewField, layout, on, actions } from '@manifesto-ai/schema'

const productView = view('product-form', 'Product Form', '1.0.0')
  .entityRef('product')
  .mode('create')
  .layout(layout.form())
  .section(
    section('basic')
      .title('Basic Information')
      .field(viewField.textInput('name', 'name'))
      .field(viewField.numberInput('price', 'price'))
      .field(
        viewField.select('category', 'category')
          .reaction(
            on.change()
              .do(actions.setValue('shipping', null))
          )
      )
  )
  .section(
    section('shipping')
      .title('Shipping')
      .visible(['!=', '$state.category', 'DIGITAL'])
      .field(viewField.select('shipping', 'shippingMethod'))
  )
  .build()
```

**Key Interfaces**:

| Interface | Purpose |
|-----------|---------|
| `ViewSchema` | Complete view definition |
| `ViewSection` | Logical field grouping |
| `ViewField` | Field-to-component mapping |
| `Reaction` | Event-driven behavior |
| `LayoutConfig` | Layout type and options |
| `ComponentType` | UI component type |

### Action Layer

**Purpose**: Define workflows, API calls, and side effects

**Responsibilities**:
- API endpoint configuration
- Data transformation pipelines
- Conditional workflow steps
- Parallel/sequential execution
- State mutations
- Navigation

```typescript
import { action, trigger, api, transform, navigate } from '@manifesto-ai/schema'

const saveProductAction = action('save-product', 'Save Product', '1.0.0')
  .trigger(trigger.manual())
  .step(
    api.post('/api/products')
      .body('$state')
      .adapter({
        type: 'legacy',
        requestTransform: {
          steps: [
            transform.rename({ name: 'product_name', price: 'product_price' })
          ]
        }
      })
  )
  .step(navigate('/products'))
  .rollback(
    api.delete('/api/products/:id')
  )
  .build()
```

**Key Interfaces**:

| Interface | Purpose |
|-----------|---------|
| `ActionSchema` | Complete action definition |
| `ActionStep` | Individual workflow step |
| `ActionTrigger` | When action executes |
| `AdapterConfig` | Legacy API transformation |

---

## Engine Components

### Expression Evaluator
- Evaluates the Mapbox-style expression DSL with whitelisted operators, context references (`$state`, `$context`, `$user`, `$params`, `$result`, `$env`), depth limits, timeouts, and optional debug logging.【F:packages/engine/src/evaluator/context.ts†L8-L74】【F:packages/engine/src/evaluator/evaluator.ts†L15-L168】
- Operator registry covers comparison, logical, collection, string, numeric, conditional, type, access, and date helpers such as `IN`, `CONTAINS`, `CASE`, and `FORMAT_DATE`. All operators are implemented in TypeScript without `eval`.【F:packages/engine/src/evaluator/operators.ts†L9-L165】【F:packages/engine/src/evaluator/operators.ts†L241-L311】

### Dependency Tracker
- Uses a DAG to model field relationships, merging explicit `dependsOn` with dependencies discovered inside reactions and `$state.*` references.【F:packages/engine/src/tracker/reactive.ts†L46-L130】
- Detects cycles before adding edges and caches topological sorts to determine evaluation order and impacted fields after a change.【F:packages/engine/src/tracker/dag.ts†L75-L205】【F:packages/engine/src/tracker/dag.ts†L207-L279】

### Form Runtime
- Initializes form state from schemas and `initialValues`, loads enum options from the `EntitySchema`, evaluates all expressions, and executes `mount` reactions.【F:packages/engine/src/runtime/form-runtime.ts†L59-L152】【F:packages/engine/src/runtime/form-runtime.ts†L179-L232】
- Handles events (`FIELD_CHANGE`, `FIELD_BLUR`, `FIELD_FOCUS`, `SUBMIT`, `RESET`, `VALIDATE`) with typed `Result` responses, coercing inputs to the target `DataType` and validating against entity constraints.【F:packages/engine/src/runtime/form-runtime.ts†L154-L224】【F:packages/engine/src/runtime/form-runtime.ts†L232-L369】【F:packages/engine/src/runtime/form-runtime.ts†L370-L461】
- Delegates reactions to the evaluator/dependency tracker so only affected fields are recomputed, and routes side effects such as dynamic `setOptions` fetches, navigation, and custom emits via injected handlers.【F:packages/engine/src/tracker/reactive.ts†L132-L205】【F:packages/engine/src/runtime/form-runtime.ts†L520-L642】【F:packages/engine/src/runtime/form-runtime.ts†L663-L732】

### List Runtime
- Shares the evaluator with forms to drive expression-based column metadata and list behaviors. Initializes pagination/sorting defaults and supports static or API data sources with transform pipelines.【F:packages/engine/src/runtime/list-runtime.ts†L13-L82】【F:packages/engine/src/runtime/list-runtime.ts†L96-L122】【F:packages/engine/src/runtime/list-runtime.ts†L187-L267】

### Schema Loader
- Fetches JSON schemas, validates them, and caches results with TTL and base-path controls. Provides helpers to guarantee schema type (`loadEntity`, `loadView`, `loadAction`) plus cache management utilities.【F:packages/engine/src/loader/schema-loader.ts†L12-L207】【F:packages/engine/src/loader/schema-loader.ts†L209-L248】

### Legacy Adapter
- Implements an anti-corruption layer for SOAP/XML/legacy APIs with configurable transform pipelines for both requests and responses, XML parsing hooks, timeout options, and debug-friendly metadata.【F:packages/engine/src/adapter/legacy-adapter.ts†L25-L171】【F:packages/engine/src/adapter/legacy-adapter.ts†L173-L252】

---

## Data Flow

### Initialization Flow

```
1. Load Schemas
   ViewSchema + EntitySchema
         │
         ▼
2. Build Dependency Graph
   Analyze dependsOn declarations
         │
         ▼
3. Initialize Field State
   Apply default values + initial values
         │
         ▼
4. Evaluate Initial Expressions
   hidden, disabled, computed values
         │
         ▼
5. Subscribe to State Changes
   Connect UI renderer
```

### Field Change Flow

```
1. User Input
   onChange event
         │
         ▼
2. Dispatch FIELD_CHANGE
   { type: 'FIELD_CHANGE', fieldId: 'country', value: 'US' }
         │
         ▼
3. Update Value
   state.values.country = 'US'
         │
         ▼
4. Get Affected Fields
   tracker.getAffectedFields('country') → ['city', 'region']
         │
         ▼
5. Execute Reactions
   For each field with change reaction on 'country'
         │
         ├─► setValue actions
         ├─► setOptions actions (API calls)
         └─► updateProp actions
         │
         ▼
6. Re-evaluate Expressions
   hidden, disabled for affected fields
         │
         ▼
7. Validate Field
   Apply entity constraints
         │
         ▼
8. Notify Subscribers
   UI re-renders with new state
```

### Submit Flow

```
1. Dispatch SUBMIT
         │
         ▼
2. Validate All Fields
   Apply all entity constraints
         │
         ├── Invalid ──► Return validation errors
         │
         ▼ Valid
3. Prepare Submit Data
   Map field IDs to entity field IDs
         │
         ▼
4. Execute Action (if configured)
   API calls, transformations
         │
         ▼
5. Return Result
   Success or error
```

---

## Framework Bindings

### React Binding (`@manifesto-ai/react`)

```tsx
import { FormRenderer, useFormRuntime } from '@manifesto-ai/react'
import '@manifesto-ai/react/styles'

// Option 1: FormRenderer component (recommended)
function ProductForm() {
  return (
    <FormRenderer
      schema={productView}
      entitySchema={productEntity}
      initialValues={{ name: '' }}
      fetchHandler={fetchHandler}
      onSubmit={(data) => console.log(data)}
      onError={(error) => console.error(error)}
      debug={true}
    />
  )
}

// Option 2: useFormRuntime hook (custom rendering)
function CustomForm() {
  const runtime = useFormRuntime(productView, {
    entitySchema: productEntity,
    initialValues: { name: '' }
  })

  return (
    <form onSubmit={() => runtime.submit()}>
      {runtime.fields.map(field => (
        <input
          key={field.id}
          value={runtime.values[field.id]}
          onChange={(e) => runtime.setFieldValue(field.id, e.target.value)}
          disabled={field.disabled}
          hidden={field.hidden}
        />
      ))}
    </form>
  )
}
```

### Vue Binding (`@manifesto-ai/vue`)

```vue
<script setup lang="ts">
import { FormRenderer, useFormRuntime } from '@manifesto-ai/vue'
import '@manifesto-ai/vue/styles'

// Option 1: FormRenderer component (recommended)
const handleSubmit = (data: Record<string, unknown>) => {
  console.log('Submitted:', data)
}
</script>

<template>
  <FormRenderer
    :schema="productView"
    :entity-schema="productEntity"
    :initial-values="{ name: '' }"
    :fetch-handler="fetchHandler"
    @submit="handleSubmit"
    debug
  />
</template>
```

```vue
<script setup lang="ts">
// Option 2: useFormRuntime composable (custom rendering)
import { useFormRuntime } from '@manifesto-ai/vue'

const runtime = useFormRuntime(productView, {
  entitySchema: productEntity,
  initialValues: { name: '' }
})
</script>

<template>
  <form @submit.prevent="runtime.submit()">
    <input
      v-for="field in runtime.fields"
      :key="field.id"
      v-model="runtime.values[field.id]"
      :disabled="field.disabled"
      :hidden="field.hidden"
    />
  </form>
</template>
```

---

## Package Structure

```
manifesto-ai/
├── packages/
│   ├── schema/                 # @manifesto-ai/schema
│   │   ├── src/
│   │   │   ├── types/          # Type definitions
│   │   │   │   ├── schema.ts   # Entity, View, Action schemas
│   │   │   │   ├── expression.ts # Expression DSL types
│   │   │   │   └── result.ts   # Result monad
│   │   │   ├── primitives/     # Atomic builders
│   │   │   │   ├── field.ts    # Entity field builders
│   │   │   │   ├── view.ts     # View field builders
│   │   │   │   ├── expression.ts # Expression builders
│   │   │   │   └── action.ts   # Action step builders
│   │   │   ├── combinators/    # Schema composers
│   │   │   │   ├── entity.ts   # EntityBuilder
│   │   │   │   ├── view.ts     # ViewBuilder
│   │   │   │   └── action.ts   # ActionBuilder
│   │   │   └── validators/     # Zod-based validation
│   │   └── package.json
│   │
│   ├── engine/                 # @manifesto-ai/engine
│   │   ├── src/
│   │   │   ├── evaluator/      # Expression evaluation
│   │   │   │   ├── evaluator.ts
│   │   │   │   ├── operators.ts
│   │   │   │   └── context.ts
│   │   │   ├── tracker/        # Dependency tracking
│   │   │   │   ├── dag.ts
│   │   │   │   └── reactive.ts
│   │   │   ├── runtime/        # Form state management
│   │   │   │   └── form-runtime.ts
│   │   │   ├── loader/         # Schema loading
│   │   │   │   └── schema-loader.ts
│   │   │   └── adapter/        # Legacy API transformation
│   │   │       ├── legacy-adapter.ts
│   │   │       └── transform-operations.ts
│   │   └── package.json
│   │
│   ├── view-snapshot/               # @manifesto-ai/view-snapshot (NEW)
│   │   ├── src/
│   │   │   ├── types/          # Type definitions
│   │   │   │   ├── nodes.ts    # ViewSnapshotNode, PageSnapshot, FormSnapshot, etc.
│   │   │   │   ├── intents.ts  # ViewIntent union types
│   │   │   │   ├── fields.ts   # FieldSnapshot, ColumnDefinition, TableRow
│   │   │   │   └── overlays.ts # OverlayInstance, OverlayConfig, OverlayTemplate
│   │   │   ├── engine/         # Core engine
│   │   │   │   ├── ViewSnapshotEngine.ts
│   │   │   │   ├── IntentDispatcher.ts
│   │   │   │   ├── OverlayManager.ts
│   │   │   │   └── NodeRegistry.ts
│   │   │   ├── builders/       # Snapshot builders
│   │   │   │   ├── FormSnapshotBuilder.ts
│   │   │   │   └── TableSnapshotBuilder.ts
│   │   │   └── guards/         # Type guards
│   │   └── package.json
│   │
│   ├── ai-util/                     # @manifesto-ai/ai-util (deprecated)
│   │   ├── src/
│   │   │   ├── session.ts      # Agent-facing session (use view-snapshot instead)
│   │   │   ├── tools.ts        # LLM tool definitions from snapshots
│   │   │   └── types.ts        # AI contracts (deprecated, use view-snapshot)
│   │   └── package.json
│   │
│   ├── react/                  # @manifesto-ai/react
│   │   ├── src/
│   │   │   ├── hooks/          # React hooks
│   │   │   │   ├── useFormRuntime.ts
│   │   │   │   └── useListRuntime.ts
│   │   │   ├── components/     # React components
│   │   │   │   ├── form/
│   │   │   │   │   ├── FormRenderer.tsx
│   │   │   │   │   └── DebugPanel.tsx
│   │   │   │   ├── list/       # List components
│   │   │   │   │   ├── ListRenderer.tsx
│   │   │   │   │   ├── ListTable.tsx
│   │   │   │   │   ├── ListRow.tsx
│   │   │   │   │   ├── DataCell.tsx
│   │   │   │   │   ├── CellRegistry.ts
│   │   │   │   │   └── cells/  # Cell renderers
│   │   │   │   └── inputs/     # Field components
│   │   │   └── styles/         # CSS
│   │   └── package.json
│   │
│   ├── vue/                    # @manifesto-ai/vue
│   │   ├── src/
│   │   │   ├── composables/    # Vue composables
│   │   │   │   ├── useFormRuntime.ts
│   │   │   │   └── useListRuntime.ts
│   │   │   ├── components/     # Vue components
│   │   │   │   ├── form/
│   │   │   │   │   ├── FormRenderer.vue
│   │   │   │   │   └── DebugPanel.vue
│   │   │   │   ├── list/       # List components
│   │   │   │   │   ├── ListRenderer.vue
│   │   │   │   │   ├── ListTable.vue
│   │   │   │   │   ├── ListRow.vue
│   │   │   │   │   ├── DataCell.vue
│   │   │   │   │   ├── CellRegistry.ts
│   │   │   │   │   └── cells/  # Cell renderers
│   │   │   │   └── inputs/     # Field components
│   │   │   └── styles/         # CSS
│   │   └── package.json
│   │
│   └── example-schemas/        # @manifesto-ai/example-schemas
│       └── src/
│           ├── product.entity.ts
│           ├── product-create.view.ts
│           └── storybook/      # Test utilities
│
└── apps/
    ├── storybook-react/        # React Storybook
    ├── storybook-vue/          # Vue Storybook
    ├── react-example/          # React example app
    └── vue-example/            # Vue example app
```

`@manifesto-ai/view-snapshot` provides the ViewSnapshot architecture for AI agents - a normalized representation of UI state (Page, Form, Table, Overlay snapshots) with Intent-based mutations. See [ViewSnapshot Architecture](architectures/view-snapshot.md) for details.

`@manifesto-ai/ai-util` (deprecated) wraps a `FormRuntime` into an AI-facing session (semantic snapshots + guard rails) and exports JSON-Schema tool definitions for LLM providers. Use `@manifesto-ai/view-snapshot` for new projects.

---

## Dependency Graph

```
@manifesto-ai/schema ◄─────────────────┐
      │                                │
      ▼                                │
@manifesto-ai/engine ◄─────────────────┤
      │                                │
      ├──────────┬────────────┬────────┴───────┐
      │          │            │                │
      ▼          ▼            ▼                ▼
@manifesto-ai  @manifesto-ai  @manifesto-ai   @manifesto-ai
   /react         /vue       /view-snapshot     /ai-util
                                   │           (deprecated)
                                   │
                                   ▼
                              AI Agents
                           (MCP/REST/SDK)
```

All packages depend on `@manifesto-ai/schema`. The engine depends on schema types; UI bindings and the ViewSnapshot package depend on both schema and engine. `@manifesto-ai/ai-util` is deprecated in favor of `@manifesto-ai/view-snapshot`.

---

[Back to Documentation](./README.md)
