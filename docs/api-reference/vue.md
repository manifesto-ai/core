# Vue API Reference

The `@manifesto-ai/vue` package provides Vue 3 composables and components for rendering schema-driven forms and lists.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [FormRenderer Component](#formrenderer-component)
- [useFormRuntime Composable](#useformruntime-composable)
- [ListRenderer Component](#listrenderer-component)
- [useListRuntime Composable](#uselistruntime-composable)
- [CellRegistry](#cellregistry)
- [Field Components](#field-components)
- [DebugPanel Component](#debugpanel-component)
- [Styling](#styling)
- [TypeScript Support](#typescript-support)

---

## Installation

```bash
# Using pnpm
pnpm add @manifesto-ai/vue @manifesto-ai/engine @manifesto-ai/schema

# Using npm
npm install @manifesto-ai/vue @manifesto-ai/engine @manifesto-ai/schema

# Using yarn
yarn add @manifesto-ai/vue @manifesto-ai/engine @manifesto-ai/schema
```

**Requirements:**
- Vue 3.3+
- TypeScript 5.0+ (recommended)

---

## Quick Start

```vue
<script setup lang="ts">
import { FormRenderer } from '@manifesto-ai/vue'
import '@manifesto-ai/vue/styles'  // Import default styles

import { contactView, contactEntity } from './schemas'

const handleSubmit = (data: Record<string, unknown>) => {
  console.log('Submitted:', data)
}
</script>

<template>
  <FormRenderer
    :schema="contactView"
    :entity-schema="contactEntity"
    @submit="handleSubmit"
  />
</template>
```

---

## FormRenderer Component

The main component for rendering schema-driven forms.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `schema` | `ViewSchema` | Yes | View schema to render |
| `entitySchema` | `EntitySchema` | No | Entity schema for validation |
| `initialValues` | `object` | No | Initial form values |
| `context` | `EvaluationContext` | No | External context for expressions |
| `fetchHandler` | `function` | No | Handler for API calls |
| `navigateHandler` | `function` | No | Handler for navigation |
| `emitHandler` | `function` | No | Handler for custom events |
| `debug` | `boolean` | No | Show debug panel |
| `class` | `string` | No | CSS class name |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `submit` | `Record<string, unknown>` | Emitted on form submission |
| `error` | `FormRuntimeError` | Emitted on errors |
| `change` | `Record<string, unknown>` | Emitted on value changes |

### Basic Example

```vue
<script setup lang="ts">
import { FormRenderer } from '@manifesto-ai/vue'
import type { FormRuntimeError } from '@manifesto-ai/vue'

const handleSubmit = async (data: Record<string, unknown>) => {
  await saveProduct(data)
}

const handleError = (error: FormRuntimeError) => {
  if (error.type === 'VALIDATION_ERROR') {
    showToast('Please fix validation errors')
  }
}
</script>

<template>
  <FormRenderer
    :schema="productView"
    :entity-schema="productEntity"
    @submit="handleSubmit"
    @error="handleError"
  />
</template>
```

### With Initial Values

```vue
<script setup lang="ts">
import { ref } from 'vue'

const initialData = ref({
  name: 'Existing Product',
  price: 99.99,
  category: 'electronics',
})
</script>

<template>
  <FormRenderer
    :schema="productView"
    :entity-schema="productEntity"
    :initial-values="initialData"
    @submit="handleSubmit"
  />
</template>
```

### With Context

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUser } from '@/composables/user'

const route = useRoute()
const { user } = useUser()

const formContext = computed(() => ({
  user: { id: user.value.id, role: user.value.role },
  params: { mode: route.params.mode, productId: route.params.id },
}))
</script>

<template>
  <FormRenderer
    :schema="productView"
    :entity-schema="productEntity"
    :context="formContext"
    @submit="handleSubmit"
  />
</template>
```

### With API Integration

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { api } from '@/services/api'
import { analytics } from '@/services/analytics'

const router = useRouter()

const fetchHandler = async (endpoint: string, options: any) => {
  const response = await api.request(endpoint, options)
  return response.data
}

const navigateHandler = (path: string) => {
  router.push(path)
}

const emitHandler = (event: string, payload?: Record<string, unknown>) => {
  analytics.track(event, payload)
}
</script>

<template>
  <FormRenderer
    :schema="productView"
    :entity-schema="productEntity"
    :fetch-handler="fetchHandler"
    :navigate-handler="navigateHandler"
    :emit-handler="emitHandler"
    @submit="handleSubmit"
  />
</template>
```

### With Debug Panel

```vue
<template>
  <FormRenderer
    :schema="productView"
    :entity-schema="productEntity"
    :debug="isDev"
    @submit="handleSubmit"
  />
</template>

<script setup lang="ts">
const isDev = import.meta.env.DEV
</script>
```

---

## useFormRuntime Composable

For more control, use the composable directly.

### Basic Usage

```vue
<script setup lang="ts">
import { useFormRuntime } from '@manifesto-ai/vue'

const {
  state,
  dispatch,
  getFieldMeta,
  getFieldOptions,
  runtime,
} = useFormRuntime(viewSchema, {
  entitySchema,
  initialValues: { name: '' },
})

const handleChange = (fieldId: string, value: unknown) => {
  dispatch({ type: 'FIELD_CHANGE', fieldId, value })
}

const handleSubmit = () => {
  dispatch({ type: 'SUBMIT' })
  if (state.value.isValid) {
    const data = runtime.getSubmitData()
    saveData(data)
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input
      :value="state.values.name"
      :disabled="getFieldMeta('name')?.disabled"
      @input="(e) => handleChange('name', (e.target as HTMLInputElement).value)"
    />
    <span
      v-for="(err, i) in getFieldMeta('name')?.errors"
      :key="i"
      class="error"
    >
      {{ err }}
    </span>
    <button type="submit" :disabled="!state.isValid">
      Submit
    </button>
  </form>
</template>
```

### Return Value

```typescript
interface UseFormRuntimeReturn {
  state: Ref<FormState>
  dispatch: (event: FormEvent) => Result<void, FormRuntimeError>
  getFieldMeta: (fieldId: string) => FieldMeta | undefined
  getFieldOptions: (fieldId: string) => EnumValue[] | undefined
  runtime: FormRuntime
  error: Ref<FormRuntimeError | null>
}
```

| Property | Type | Description |
|----------|------|-------------|
| `state` | `Ref<FormState>` | Reactive form state |
| `dispatch` | `function` | Dispatch form events |
| `getFieldMeta` | `function` | Get field metadata |
| `getFieldOptions` | `function` | Get field options |
| `runtime` | `FormRuntime` | Underlying runtime instance |
| `error` | `Ref<FormRuntimeError>` | Initialization error if any |

### Options

```typescript
interface UseFormRuntimeOptions {
  initialValues?: Record<string, unknown>
  context?: Partial<EvaluationContext>
  entitySchema?: EntitySchema
  fetchHandler?: FetchHandler
  navigateHandler?: NavigateHandler
  emitHandler?: EmitHandler
  debug?: boolean
}
```

---

## ListRenderer Component

The main component for rendering schema-driven data lists and tables.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `schema` | `ListViewSchema` | Yes | List view schema to render |
| `context` | `EvaluationContext` | No | External context for expressions |
| `idField` | `string` | No | Field to use as row ID (default: 'id') |
| `readonly` | `boolean` | No | Disable all interactions |
| `initialData` | `array` | No | Initial data to display |
| `debug` | `boolean` | No | Show debug panel |
| `cellRegistry` | `ICellRegistry` | No | Custom cell registry |
| `fetchHandler` | `function` | No | Handler for API calls |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `row-click` | `(rowId, row)` | Emitted when row is clicked |
| `row-action` | `(rowId, actionId, row)` | Emitted when row action is triggered |
| `bulk-action` | `(actionId, selectedIds)` | Emitted when bulk action is triggered |
| `selection-change` | `selectedIds[]` | Emitted when selection changes |
| `page-change` | `(page, pageSize)` | Emitted when page changes |
| `error` | `ListRuntimeError` | Emitted on errors |

### Basic Example

```vue
<script setup lang="ts">
import { ListRenderer } from '@manifesto-ai/vue'
import '@manifesto-ai/vue/styles'

import { productsListView } from './schemas'

const handleRowClick = (rowId: string, row: Record<string, unknown>) => {
  console.log('Clicked:', rowId, row)
}
</script>

<template>
  <ListRenderer
    :schema="productsListView"
    @row-click="handleRowClick"
  />
</template>
```

### With Data Fetching

```vue
<script setup lang="ts">
import { ListRenderer } from '@manifesto-ai/vue'
import { api } from '@/services/api'

const fetchHandler = async (endpoint: string, options: any) => {
  const response = await api.request(endpoint, options)
  return response.data
}

const handlePageChange = (page: number, pageSize: number) => {
  console.log('Page changed:', page, pageSize)
}
</script>

<template>
  <ListRenderer
    :schema="productsListView"
    :fetch-handler="fetchHandler"
    @page-change="handlePageChange"
  />
</template>
```

### With Context and Actions

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { ListRenderer } from '@manifesto-ai/vue'

const userRole = ref('admin')

const context = computed(() => ({
  user: { role: userRole.value },
}))

const handleRowAction = (rowId: string, actionId: string, row: Record<string, unknown>) => {
  if (actionId === 'edit') {
    router.push(`/products/${rowId}/edit`)
  } else if (actionId === 'delete') {
    deleteProduct(rowId)
  }
}

const handleBulkAction = (actionId: string, selectedIds: string[]) => {
  if (actionId === 'bulk-delete') {
    deleteProducts(selectedIds)
  }
}
</script>

<template>
  <ListRenderer
    :schema="productsListView"
    :context="context"
    @row-action="handleRowAction"
    @bulk-action="handleBulkAction"
    debug
  />
</template>
```

---

## useListRuntime Composable

For more control over list rendering, use the composable directly.

### Basic Usage

```vue
<script setup lang="ts">
import { useListRuntime } from '@manifesto-ai/vue'

const {
  // State
  rows,
  totalCount,
  currentPage,
  pageSize,
  sortField,
  sortDirection,
  selectedIds,
  isLoading,
  error,
  columns,

  // Actions
  setPage,
  setPageSize,
  toggleSort,
  setSearch,
  selectRow,
  deselectRow,
  selectAll,
  deselectAll,
  refresh,
} = useListRuntime({
  schema: productsListView,
  initialData: products,
})
</script>

<template>
  <div>
    <input
      type="search"
      @input="(e) => setSearch(e.target.value)"
      placeholder="Search..."
    />

    <table>
      <thead>
        <tr>
          <th v-for="[id, col] in columns" :key="id" @click="toggleSort(id)">
            {{ col.label }}
            <span v-if="sortField === id">
              {{ sortDirection === 'asc' ? '↑' : '↓' }}
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.id"
          :class="{ selected: selectedIds.has(row.id) }"
          @click="selectRow(row.id)"
        >
          <td v-for="[id] in columns" :key="id">{{ row[id] }}</td>
        </tr>
      </tbody>
    </table>

    <div class="pagination">
      <button @click="setPage(currentPage - 1)" :disabled="currentPage <= 1">
        Previous
      </button>
      <span>Page {{ currentPage }} of {{ Math.ceil(totalCount / pageSize) }}</span>
      <button @click="setPage(currentPage + 1)">
        Next
      </button>
    </div>
  </div>
</template>
```

### Return Value

```typescript
interface UseListRuntimeReturn {
  // State (reactive refs)
  rows: Ref<Record<string, unknown>[]>
  totalCount: Ref<number>
  currentPage: Ref<number>
  pageSize: Ref<number>
  totalPages: Ref<number>
  sortField: Ref<string | null>
  sortDirection: Ref<'asc' | 'desc' | null>
  searchTerm: Ref<string>
  filters: Ref<Record<string, unknown>>
  selectedIds: Ref<Set<string>>
  isAllSelected: Ref<boolean>
  isIndeterminate: Ref<boolean>
  isLoading: Ref<boolean>
  error: Ref<ListRuntimeError | null>
  columns: Ref<Map<string, ColumnMeta>>

  // Actions
  dispatch: (event: ListEvent) => Promise<void>
  setPage: (page: number) => Promise<void>
  setPageSize: (size: number) => Promise<void>
  setSort: (field: string, direction: 'asc' | 'desc') => Promise<void>
  toggleSort: (field: string) => Promise<void>
  setSearch: (term: string) => Promise<void>
  setFilter: (key: string, value: unknown) => Promise<void>
  resetFilters: () => Promise<void>
  selectRow: (id: string) => void
  deselectRow: (id: string) => void
  toggleRow: (id: string) => void
  selectAll: () => void
  deselectAll: () => void
  refresh: () => Promise<void>
  setContext: (context: Partial<EvaluationContext>) => void
}
```

### Options

```typescript
interface UseListRuntimeOptions {
  schema: ListViewSchema
  context?: Partial<EvaluationContext>
  fetchHandler?: FetchHandler
  initialData?: Record<string, unknown>[]
  idField?: string
}
```

---

## CellRegistry

CellRegistry allows you to customize how different data types are rendered in list cells.

### Default Cell Types

| Type | Component | Description |
|------|-----------|-------------|
| `text` | TextCell | Plain text display |
| `number` | NumberCell | Formatted numbers |
| `date` | DateCell | Date formatting |
| `datetime` | DateTimeCell | Date and time formatting |
| `boolean` | BooleanCell | Checkmark/X icon |
| `badge` | BadgeCell | Status badges with variants |
| `link` | LinkCell | Clickable links |
| `image` | ImageCell | Image thumbnails |
| `enum` | EnumCell | Enum label mapping |

### Using Default Registry

```vue
<script setup lang="ts">
import { ListRenderer } from '@manifesto-ai/vue'

// Default registry is used automatically
</script>

<template>
  <ListRenderer :schema="productsListView" />
</template>
```

### Creating Custom Registry

```typescript
import { CellRegistry, createDefaultCellRegistry } from '@manifesto-ai/vue'
import CustomBadgeCell from './CustomBadgeCell.vue'

// Start with defaults and add/override
const registry = createDefaultCellRegistry()
registry.register('badge', CustomBadgeCell)
registry.register('currency', () => import('./CurrencyCell.vue'))
```

```vue
<template>
  <ListRenderer
    :schema="productsListView"
    :cell-registry="registry"
  />
</template>
```

### Custom Cell Component

Custom cell components receive these props:

```typescript
interface CellRendererProps {
  column: ListColumn        // Column schema definition
  columnMeta: ColumnMeta    // Runtime column metadata
  value: unknown            // Cell value
  row: Record<string, unknown>  // Full row data
  rowId: string             // Row identifier
  rowIndex: number          // Row index in current page
}
```

Example custom cell:

```vue
<!-- CurrencyCell.vue -->
<script setup lang="ts">
import type { CellRendererProps } from '@manifesto-ai/vue'

const props = defineProps<CellRendererProps>()

const formatted = computed(() => {
  const num = Number(props.value) || 0
  const currency = props.column.format?.currency ?? 'USD'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(num)
})
</script>

<template>
  <span class="currency-cell">{{ formatted }}</span>
</template>
```

### Injection Keys

For advanced use cases, you can access list context via injection:

```typescript
import { inject } from 'vue'
import {
  LIST_RUNTIME_KEY,
  CELL_REGISTRY_KEY,
  LIST_SCHEMA_KEY,
  LIST_READONLY_KEY,
  LIST_ID_FIELD_KEY,
} from '@manifesto-ai/vue'

// Inside a child component
const runtime = inject(LIST_RUNTIME_KEY)
const cellRegistry = inject(CELL_REGISTRY_KEY)
const schema = inject(LIST_SCHEMA_KEY)
const readonly = inject(LIST_READONLY_KEY)
const idField = inject(LIST_ID_FIELD_KEY)
```

---

## Field Components

The package provides pre-built field components.

### TextInput

```vue
<script setup lang="ts">
import { TextInput } from '@manifesto-ai/vue'
</script>

<template>
  <TextInput
    field-id="name"
    :value="values.name"
    :meta="getFieldMeta('name')"
    placeholder="Enter name"
    @update:value="(v) => handleChange('name', v)"
    @blur="() => handleBlur('name')"
  />
</template>
```

### NumberInput

```vue
<script setup lang="ts">
import { NumberInput } from '@manifesto-ai/vue'
</script>

<template>
  <NumberInput
    field-id="price"
    :value="values.price"
    :meta="getFieldMeta('price')"
    :min="0"
    :step="0.01"
    @update:value="(v) => handleChange('price', v)"
  />
</template>
```

### Select

```vue
<script setup lang="ts">
import { Select } from '@manifesto-ai/vue'
</script>

<template>
  <Select
    field-id="category"
    :value="values.category"
    :options="getFieldOptions('category')"
    :meta="getFieldMeta('category')"
    placeholder="Select category"
    @update:value="(v) => handleChange('category', v)"
  />
</template>
```

### Textarea

```vue
<script setup lang="ts">
import { Textarea } from '@manifesto-ai/vue'
</script>

<template>
  <Textarea
    field-id="description"
    :value="values.description"
    :meta="getFieldMeta('description')"
    :rows="5"
    @update:value="(v) => handleChange('description', v)"
  />
</template>
```

### Checkbox

```vue
<script setup lang="ts">
import { Checkbox } from '@manifesto-ai/vue'
</script>

<template>
  <Checkbox
    field-id="agree"
    :checked="values.agree"
    :meta="getFieldMeta('agree')"
    label="I agree to the terms"
    @update:checked="(v) => handleChange('agree', v)"
  />
</template>
```

### Common Props

All field components share these props:

```typescript
interface BaseFieldProps {
  fieldId: string
  value?: unknown
  meta?: FieldMeta
  label?: string
  placeholder?: string
  disabled?: boolean
  class?: string
}
```

---

## DebugPanel Component

Shows real-time form state for debugging.

```vue
<script setup lang="ts">
import { DebugPanel } from '@manifesto-ai/vue'
</script>

<template>
  <DebugPanel
    :state="state"
    :schema="viewSchema"
    :expanded="true"
  />
</template>
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `state` | `FormState` | Current form state |
| `schema` | `ViewSchema` | View schema |
| `expanded` | `boolean` | Initially expanded |
| `position` | `string` | Panel position |

### Features

The debug panel shows:
- Current field values
- Field metadata (hidden, disabled, errors)
- Field options for selects
- Expression evaluation results
- Dependency graph
- Value change history

---

## Styling

### Default Styles

Import the default stylesheet:

```typescript
import '@manifesto-ai/vue/styles'
```

### CSS Variables

Customize with CSS variables:

```css
:root {
  --manifesto-ai-primary: #3b82f6;
  --manifesto-ai-error: #ef4444;
  --manifesto-ai-border: #d1d5db;
  --manifesto-ai-bg: #ffffff;
  --manifesto-ai-text: #1f2937;
  --manifesto-ai-radius: 0.375rem;
  --manifesto-ai-spacing: 1rem;
}
```

### Custom Styling

Use the class prop:

```vue
<template>
  <FormRenderer
    :schema="viewSchema"
    class="my-custom-form"
    @submit="handleSubmit"
  />
</template>

<style scoped>
.my-custom-form {
  max-width: 600px;
  margin: 0 auto;
}
</style>
```

### Tailwind CSS

Works with Tailwind CSS:

```vue
<template>
  <FormRenderer
    :schema="viewSchema"
    class="max-w-2xl mx-auto p-4 bg-white rounded-lg shadow"
    @submit="handleSubmit"
  />
</template>
```

---

## TypeScript Support

Full TypeScript support is included.

### Type Imports

```typescript
import type {
  ViewSchema,
  EntitySchema,
  FormState,
  FieldMeta,
  FormRuntimeError,
  EnumValue,
} from '@manifesto-ai/vue'
```

### Typed Component Props

```vue
<script setup lang="ts">
import type { ViewSchema, EntitySchema } from '@manifesto-ai/vue'

interface Props {
  schema: ViewSchema
  entitySchema: EntitySchema
  initialData?: Record<string, unknown>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  save: [data: Record<string, unknown>]
}>()
</script>
```

### Type Guards

```typescript
import { isValidationError, isSchemaError } from '@manifesto-ai/vue'

const handleError = (error: FormRuntimeError) => {
  if (isValidationError(error)) {
    console.log('Validation errors:', error.errors)
  } else if (isSchemaError(error)) {
    console.log('Schema error:', error.message)
  }
}
```

---

## Complete Example

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { FormRenderer } from '@manifesto-ai/vue'
import type { FormRuntimeError } from '@manifesto-ai/vue'
import '@manifesto-ai/vue/styles'

import { productView, productEntity } from '@/schemas/product'
import { api } from '@/services/api'
import { useToast } from '@/composables/toast'

interface Product {
  id?: string
  name: string
  price: number
  category: string
}

const props = defineProps<{
  product?: Product
}>()

const emit = defineEmits<{
  success: [product: Product]
}>()

const router = useRouter()
const route = useRoute()
const toast = useToast()

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

const formContext = computed(() => ({
  params: {
    mode: props.product ? 'edit' : 'create',
    productId: route.params.id,
  },
}))

const fetchHandler = async (endpoint: string, options: any) => {
  const response = await api.request(endpoint, options)
  return response.data
}

const navigateHandler = (path: string) => {
  router.push(path)
}

const handleSubmit = async (data: Record<string, unknown>) => {
  isSubmitting.value = true
  submitError.value = null

  try {
    const endpoint = props.product
      ? `/api/products/${props.product.id}`
      : '/api/products'

    const response = await api.request(endpoint, {
      method: props.product ? 'PUT' : 'POST',
      body: data,
    })

    toast.success('Product saved successfully')
    emit('success', response.data)
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : 'Unknown error'
    toast.error(submitError.value)
  } finally {
    isSubmitting.value = false
  }
}

const handleError = (error: FormRuntimeError) => {
  if (error.type === 'VALIDATION_ERROR') {
    toast.warning('Please fix validation errors')
    return
  }
  submitError.value = error.message
}

const isDev = import.meta.env.DEV
</script>

<template>
  <div class="max-w-2xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-4">
      {{ product ? 'Edit Product' : 'New Product' }}
    </h1>

    <div v-if="submitError" class="bg-red-50 text-red-700 p-4 rounded mb-4">
      {{ submitError }}
    </div>

    <FormRenderer
      :schema="productView"
      :entity-schema="productEntity"
      :initial-values="product"
      :context="formContext"
      :fetch-handler="fetchHandler"
      :navigate-handler="navigateHandler"
      :debug="isDev"
      @submit="handleSubmit"
      @error="handleError"
    />

    <div
      v-if="isSubmitting"
      class="fixed inset-0 bg-black/50 flex items-center justify-center"
    >
      <div class="bg-white p-4 rounded">Saving...</div>
    </div>
  </div>
</template>
```

---

## Vue Router Integration

### Route-Based Forms

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FormRenderer } from '@manifesto-ai/vue'

const route = useRoute()
const router = useRouter()

const mode = computed(() => route.params.id ? 'edit' : 'create')

const navigateHandler = (path: string) => {
  router.push(path)
}

const handleSubmit = async (data: Record<string, unknown>) => {
  await saveProduct(data)
  router.push('/products')
}
</script>

<template>
  <FormRenderer
    :schema="productView"
    :entity-schema="productEntity"
    :context="{ params: { mode: mode } }"
    :navigate-handler="navigateHandler"
    @submit="handleSubmit"
  />
</template>
```

### Navigation Guards

```typescript
// router/index.ts
router.beforeEach((to, from) => {
  // Check for unsaved changes
  if (from.meta.hasForm && store.isDirty) {
    const confirmed = window.confirm('You have unsaved changes. Continue?')
    if (!confirmed) return false
  }
})
```

---

[Back to API Reference](../README.md) | [Previous: React API](./react.md)
