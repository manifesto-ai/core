# React API Reference

The `@manifesto-ai/react` package provides React hooks and components for rendering schema-driven forms and lists.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [FormRenderer Component](#formrenderer-component)
- [useFormRuntime Hook](#useformruntime-hook)
- [ListRenderer Component](#listrenderer-component)
- [useListRuntime Hook](#uselistruntime-hook)
- [CellRegistry](#cellregistry)
- [Field Components](#field-components)
- [DebugPanel Component](#debugpanel-component)
- [Styling](#styling)
- [TypeScript Support](#typescript-support)

---

## Installation

```bash
# Using pnpm
pnpm add @manifesto-ai/react @manifesto-ai/engine @manifesto-ai/schema

# Using npm
npm install @manifesto-ai/react @manifesto-ai/engine @manifesto-ai/schema

# Using yarn
yarn add @manifesto-ai/react @manifesto-ai/engine @manifesto-ai/schema
```

---

## Quick Start

```tsx
import { FormRenderer } from '@manifesto-ai/react'
import '@manifesto-ai/react/styles'  // Import default styles

import { contactView, contactEntity } from './schemas'

function ContactForm() {
  const handleSubmit = (data: Record<string, unknown>) => {
    console.log('Submitted:', data)
  }

  return (
    <FormRenderer
      schema={contactView}
      entitySchema={contactEntity}
      onSubmit={handleSubmit}
    />
  )
}
```

---

## FormRenderer Component

The main component for rendering schema-driven forms.

### Props

```typescript
interface FormRendererProps {
  schema: ViewSchema
  entitySchema?: EntitySchema
  initialValues?: Record<string, unknown>
  context?: Partial<EvaluationContext>
  onSubmit?: (data: Record<string, unknown>) => void | Promise<void>
  onError?: (error: FormRuntimeError) => void
  onChange?: (values: Record<string, unknown>) => void
  fetchHandler?: FetchHandler
  navigateHandler?: NavigateHandler
  emitHandler?: EmitHandler
  debug?: boolean
  className?: string
  style?: React.CSSProperties
}
```

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `schema` | `ViewSchema` | Yes | View schema to render |
| `entitySchema` | `EntitySchema` | No | Entity schema for validation |
| `initialValues` | `object` | No | Initial form values |
| `context` | `EvaluationContext` | No | External context for expressions |
| `onSubmit` | `function` | No | Called on form submission |
| `onError` | `function` | No | Called on errors |
| `onChange` | `function` | No | Called on any value change |
| `fetchHandler` | `function` | No | Handler for API calls |
| `navigateHandler` | `function` | No | Handler for navigation |
| `emitHandler` | `function` | No | Handler for custom events |
| `debug` | `boolean` | No | Show debug panel |
| `className` | `string` | No | CSS class name |
| `style` | `object` | No | Inline styles |

### Basic Example

```tsx
<FormRenderer
  schema={productView}
  entitySchema={productEntity}
  onSubmit={async (data) => {
    await saveProduct(data)
  }}
  onError={(error) => {
    if (error.type === 'VALIDATION_ERROR') {
      toast.error('Please fix validation errors')
    }
  }}
/>
```

### With Initial Values

```tsx
<FormRenderer
  schema={productView}
  entitySchema={productEntity}
  initialValues={{
    name: 'Existing Product',
    price: 99.99,
    category: 'electronics',
  }}
  onSubmit={handleSubmit}
/>
```

### With Context

```tsx
<FormRenderer
  schema={productView}
  entitySchema={productEntity}
  context={{
    user: { id: userId, role: userRole },
    params: { mode: 'edit', productId: id },
  }}
  onSubmit={handleSubmit}
/>
```

### With API Integration

```tsx
<FormRenderer
  schema={productView}
  entitySchema={productEntity}
  fetchHandler={async (endpoint, options) => {
    const response = await api.request(endpoint, options)
    return response.data
  }}
  navigateHandler={(path) => {
    router.push(path)
  }}
  emitHandler={(event, payload) => {
    analytics.track(event, payload)
  }}
  onSubmit={handleSubmit}
/>
```

### With Debug Panel

```tsx
<FormRenderer
  schema={productView}
  entitySchema={productEntity}
  debug={process.env.NODE_ENV === 'development'}
  onSubmit={handleSubmit}
/>
```

---

## useFormRuntime Hook

For more control, use the hook directly.

### Basic Usage

```tsx
import { useFormRuntime } from '@manifesto-ai/react'

function CustomForm() {
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
    if (state.isValid) {
      const data = runtime.getSubmitData()
      saveData(data)
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
      <input
        value={state.values.name as string || ''}
        onChange={(e) => handleChange('name', e.target.value)}
        disabled={getFieldMeta('name')?.disabled}
      />
      {getFieldMeta('name')?.errors.map((err, i) => (
        <span key={i} className="error">{err}</span>
      ))}
      <button type="submit" disabled={!state.isValid}>
        Submit
      </button>
    </form>
  )
}
```

### Return Value

```typescript
interface UseFormRuntimeReturn {
  state: FormState
  dispatch: (event: FormEvent) => Result<void, FormRuntimeError>
  getFieldMeta: (fieldId: string) => FieldMeta | undefined
  getFieldOptions: (fieldId: string) => EnumValue[] | undefined
  runtime: FormRuntime
  error: FormRuntimeError | null
}
```

| Property | Type | Description |
|----------|------|-------------|
| `state` | `FormState` | Current form state |
| `dispatch` | `function` | Dispatch form events |
| `getFieldMeta` | `function` | Get field metadata |
| `getFieldOptions` | `function` | Get field options |
| `runtime` | `FormRuntime` | Underlying runtime instance |
| `error` | `FormRuntimeError` | Initialization error if any |

### FormState

```typescript
interface FormState {
  values: Record<string, unknown>
  fields: Map<string, FieldMeta>
  fieldOptions: Map<string, EnumValue[]>
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
}
```

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

```typescript
interface ListRendererProps {
  schema: ListViewSchema
  context?: Partial<EvaluationContext>
  idField?: string
  readonly?: boolean
  initialData?: Record<string, unknown>[]
  debug?: boolean
  cellRegistry?: ICellRegistry
  fetchHandler?: FetchHandler
  onRowClick?: (rowId: string, row: Record<string, unknown>) => void
  onRowAction?: (rowId: string, actionId: string, row: Record<string, unknown>) => void
  onBulkAction?: (actionId: string, selectedIds: string[]) => void
  onSelectionChange?: (selectedIds: string[]) => void
  onPageChange?: (page: number, pageSize: number) => void
  onError?: (error: ListRuntimeError) => void
  className?: string
  style?: React.CSSProperties
}
```

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
| `onRowClick` | `function` | No | Called when row is clicked |
| `onRowAction` | `function` | No | Called when row action is triggered |
| `onBulkAction` | `function` | No | Called when bulk action is triggered |
| `onSelectionChange` | `function` | No | Called when selection changes |
| `onPageChange` | `function` | No | Called when page changes |
| `onError` | `function` | No | Called on errors |

### Basic Example

```tsx
import { ListRenderer } from '@manifesto-ai/react'
import '@manifesto-ai/react/styles'

import { productsListView } from './schemas'

function ProductsList() {
  const handleRowClick = (rowId: string, row: Record<string, unknown>) => {
    console.log('Clicked:', rowId, row)
  }

  return (
    <ListRenderer
      schema={productsListView}
      onRowClick={handleRowClick}
    />
  )
}
```

### With Data Fetching

```tsx
import { ListRenderer } from '@manifesto-ai/react'

function ProductsList() {
  const fetchHandler = async (endpoint: string, options: RequestInit) => {
    const response = await fetch(endpoint, options)
    return response.json()
  }

  return (
    <ListRenderer
      schema={productsListView}
      fetchHandler={fetchHandler}
      onPageChange={(page, pageSize) => {
        console.log('Page changed:', page, pageSize)
      }}
    />
  )
}
```

### With Context and Actions

```tsx
import { ListRenderer } from '@manifesto-ai/react'
import { useNavigate } from 'react-router-dom'

function ProductsList() {
  const navigate = useNavigate()
  const [userRole] = useState('admin')

  const context = useMemo(() => ({
    user: { role: userRole },
  }), [userRole])

  const handleRowAction = (rowId: string, actionId: string) => {
    if (actionId === 'edit') {
      navigate(`/products/${rowId}/edit`)
    } else if (actionId === 'delete') {
      deleteProduct(rowId)
    }
  }

  const handleBulkAction = (actionId: string, selectedIds: string[]) => {
    if (actionId === 'bulk-delete') {
      deleteProducts(selectedIds)
    }
  }

  return (
    <ListRenderer
      schema={productsListView}
      context={context}
      onRowAction={handleRowAction}
      onBulkAction={handleBulkAction}
      debug={process.env.NODE_ENV === 'development'}
    />
  )
}
```

---

## useListRuntime Hook

For more control over list rendering, use the hook directly.

### Basic Usage

```tsx
import { useListRuntime } from '@manifesto-ai/react'

function CustomList() {
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

  return (
    <div>
      <input
        type="search"
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
      />

      <table>
        <thead>
          <tr>
            {Array.from(columns.entries()).map(([id, col]) => (
              <th key={id} onClick={() => toggleSort(id)}>
                {col.label}
                {sortField === id && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id as string}
              className={selectedIds.has(row.id as string) ? 'selected' : ''}
              onClick={() => selectRow(row.id as string)}
            >
              {Array.from(columns.keys()).map((id) => (
                <td key={id}>{String(row[id] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        <button onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>
          Previous
        </button>
        <span>Page {currentPage} of {Math.ceil(totalCount / pageSize)}</span>
        <button onClick={() => setPage(currentPage + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
```

### Return Value

```typescript
interface UseListRuntimeReturn {
  // State
  rows: Record<string, unknown>[]
  totalCount: number
  currentPage: number
  pageSize: number
  totalPages: number
  sortField: string | null
  sortDirection: 'asc' | 'desc' | null
  searchTerm: string
  filters: Record<string, unknown>
  selectedIds: Set<string>
  isAllSelected: boolean
  isIndeterminate: boolean
  isLoading: boolean
  error: ListRuntimeError | null
  columns: Map<string, ColumnMeta>

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

```tsx
import { ListRenderer } from '@manifesto-ai/react'

// Default registry is used automatically
function ProductsList() {
  return <ListRenderer schema={productsListView} />
}
```

### Creating Custom Registry

```tsx
import { CellRegistry, createDefaultCellRegistry } from '@manifesto-ai/react'
import { CustomBadgeCell } from './CustomBadgeCell'

// Start with defaults and add/override
const registry = createDefaultCellRegistry()
registry.register('badge', CustomBadgeCell)
registry.register('currency', React.lazy(() => import('./CurrencyCell')))

function ProductsList() {
  return (
    <ListRenderer
      schema={productsListView}
      cellRegistry={registry}
    />
  )
}
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

```tsx
// CurrencyCell.tsx
import type { CellRendererProps } from '@manifesto-ai/react'

export function CurrencyCell({ value, column }: CellRendererProps) {
  const formatted = useMemo(() => {
    const num = Number(value) || 0
    const currency = column.format?.currency ?? 'USD'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(num)
  }, [value, column.format?.currency])

  return <span className="currency-cell">{formatted}</span>
}
```

---

## Field Components

The package provides pre-built field components.

### TextInput

```tsx
import { TextInput } from '@manifesto-ai/react'

<TextInput
  fieldId="name"
  value={values.name}
  onChange={(value) => handleChange('name', value)}
  onBlur={() => handleBlur('name')}
  meta={getFieldMeta('name')}
  placeholder="Enter name"
/>
```

### NumberInput

```tsx
import { NumberInput } from '@manifesto-ai/react'

<NumberInput
  fieldId="price"
  value={values.price}
  onChange={(value) => handleChange('price', value)}
  meta={getFieldMeta('price')}
  min={0}
  step={0.01}
/>
```

### Select

```tsx
import { Select } from '@manifesto-ai/react'

<Select
  fieldId="category"
  value={values.category}
  onChange={(value) => handleChange('category', value)}
  options={getFieldOptions('category')}
  meta={getFieldMeta('category')}
  placeholder="Select category"
/>
```

### Textarea

```tsx
import { Textarea } from '@manifesto-ai/react'

<Textarea
  fieldId="description"
  value={values.description}
  onChange={(value) => handleChange('description', value)}
  meta={getFieldMeta('description')}
  rows={5}
/>
```

### Checkbox

```tsx
import { Checkbox } from '@manifesto-ai/react'

<Checkbox
  fieldId="agree"
  checked={values.agree}
  onChange={(value) => handleChange('agree', value)}
  meta={getFieldMeta('agree')}
  label="I agree to the terms"
/>
```

### Common Props

All field components share these props:

```typescript
interface BaseFieldProps {
  fieldId: string
  value: unknown
  onChange: (value: unknown) => void
  onBlur?: () => void
  onFocus?: () => void
  meta?: FieldMeta
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}
```

---

## DebugPanel Component

Shows real-time form state for debugging.

```tsx
import { DebugPanel } from '@manifesto-ai/react'

<DebugPanel
  state={state}
  schema={viewSchema}
  expanded={true}
/>
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `state` | `FormState` | Current form state |
| `schema` | `ViewSchema` | View schema |
| `expanded` | `boolean` | Initially expanded |
| `position` | `'bottom-right' \| 'bottom-left'` | Panel position |

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

```tsx
import '@manifesto-ai/react/styles'
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

Use className and style props:

```tsx
<FormRenderer
  schema={viewSchema}
  className="my-custom-form"
  style={{ maxWidth: '600px' }}
  onSubmit={handleSubmit}
/>
```

### Tailwind CSS

Works with Tailwind CSS:

```tsx
<FormRenderer
  schema={viewSchema}
  className="max-w-2xl mx-auto p-4 bg-white rounded-lg shadow"
  onSubmit={handleSubmit}
/>
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
} from '@manifesto-ai/react'
```

### Generic Props

```typescript
interface ProductFormProps {
  initialData?: Product
  onSave: (data: Product) => Promise<void>
}

function ProductForm({ initialData, onSave }: ProductFormProps) {
  const handleSubmit = async (data: Record<string, unknown>) => {
    await onSave(data as Product)
  }

  return (
    <FormRenderer
      schema={productView}
      entitySchema={productEntity}
      initialValues={initialData}
      onSubmit={handleSubmit}
    />
  )
}
```

### Type Guards

```typescript
import { isValidationError, isSchemaError } from '@manifesto-ai/react'

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

```tsx
import { useState } from 'react'
import { FormRenderer } from '@manifesto-ai/react'
import '@manifesto-ai/react/styles'

import { productView, productEntity } from './schemas/product'

interface Product {
  id?: string
  name: string
  price: number
  category: string
}

interface ProductFormProps {
  product?: Product
  onSuccess: (product: Product) => void
}

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        product ? `/api/products/${product.id}` : '/api/products',
        {
          method: product ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to save product')
      }

      const savedProduct = await response.json()
      onSuccess(savedProduct)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleError = (err: FormRuntimeError) => {
    if (err.type === 'VALIDATION_ERROR') {
      // Validation errors are shown inline
      return
    }
    setError(err.message)
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        {product ? 'Edit Product' : 'New Product'}
      </h1>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded mb-4">
          {error}
        </div>
      )}

      <FormRenderer
        schema={productView}
        entitySchema={productEntity}
        initialValues={product}
        context={{
          params: { mode: product ? 'edit' : 'create' },
        }}
        fetchHandler={async (endpoint, options) => {
          const res = await fetch(endpoint, {
            method: options.method,
            body: options.body ? JSON.stringify(options.body) : undefined,
          })
          return res.json()
        }}
        onSubmit={handleSubmit}
        onError={handleError}
        debug={process.env.NODE_ENV === 'development'}
      />

      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-4 rounded">Saving...</div>
        </div>
      )}
    </div>
  )
}
```

---

[Back to API Reference](../README.md) | [Previous: Engine API](./engine.md) | [Next: Vue API](./vue.md)
