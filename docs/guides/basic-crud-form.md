# Basic CRUD Form Tutorial

This guide walks you through creating a complete CRUD (Create, Read, Update, Delete) form using Manifesto.

## What You'll Build

A product management form with:
- Create and edit modes
- Form validation
- Select dropdowns with options
- Dynamic behavior based on mode

## Prerequisites

- Completed [Getting Started](../getting-started.md) guide
- React or Vue project set up with Manifesto packages installed

---

## Step 1: Define the Entity Schema

The Entity Schema defines your data structure.

Create `schemas/product.entity.ts`:

```typescript
import { field, enumValue } from '@manifesto-ai/schema'

export const productEntity = {
  _type: 'entity' as const,
  id: 'product',
  name: 'Product',
  version: '1.0.0',
  description: 'E-commerce product',

  fields: [
    // Primary key
    field.string('id', 'ID').build(),

    // Required fields
    field.string('name', 'Product Name')
      .required('Product name is required')
      .min(3, 'Name must be at least 3 characters')
      .max(100, 'Name must be at most 100 characters')
      .build(),

    field.string('sku', 'SKU')
      .required('SKU is required')
      .pattern('^[A-Z0-9-]+$', 'SKU must be uppercase letters, numbers, and hyphens')
      .build(),

    field.number('price', 'Price')
      .required('Price is required')
      .min(0, 'Price cannot be negative')
      .build(),

    // Enum field
    field.enum('category', 'Category', [
      enumValue('electronics', 'Electronics'),
      enumValue('clothing', 'Clothing'),
      enumValue('home', 'Home & Garden'),
      enumValue('sports', 'Sports & Outdoors'),
    ])
      .required('Category is required')
      .build(),

    // Optional fields
    field.string('description', 'Description')
      .max(1000, 'Description must be at most 1000 characters')
      .build(),

    field.number('stock', 'Stock Quantity')
      .min(0, 'Stock cannot be negative')
      .defaultValue(0)
      .build(),

    field.boolean('isActive', 'Active')
      .defaultValue(true)
      .build(),
  ],
}
```

---

## Step 2: Define the View Schema

The View Schema defines how the form looks.

Create `schemas/product.view.ts`:

```typescript
import { viewField, on, actions } from '@manifesto-ai/schema'

export const productView = {
  _type: 'view' as const,
  id: 'product-form',
  name: 'Product Form',
  version: '1.0.0',
  entityRef: 'product',
  mode: 'create' as const,
  layout: { type: 'form' as const },

  sections: [
    // Basic Information
    {
      id: 'basic',
      title: 'Basic Information',
      layout: { type: 'grid' as const, columns: 2, gap: '1rem' },
      fields: [
        viewField.textInput('name', 'name')
          .placeholder('Enter product name')
          .span(2)
          .build(),

        viewField.textInput('sku', 'sku')
          .placeholder('e.g., PROD-001')
          .build(),

        viewField.numberInput('price', 'price')
          .placeholder('0.00')
          .props({ min: 0, step: 0.01 })
          .build(),

        viewField.select('category', 'category')
          .placeholder('Select a category')
          .span(2)
          .build(),
      ],
    },

    // Details
    {
      id: 'details',
      title: 'Details',
      layout: { type: 'form' as const },
      fields: [
        viewField.textarea('description', 'description')
          .placeholder('Product description...')
          .props({ rows: 4 })
          .build(),
      ],
    },

    // Inventory
    {
      id: 'inventory',
      title: 'Inventory',
      layout: { type: 'grid' as const, columns: 2 },
      fields: [
        viewField.numberInput('stock', 'stock')
          .props({ min: 0 })
          .build(),

        viewField.toggle('isActive', 'isActive')
          .label('Product Active')
          .build(),
      ],
    },
  ],

  footer: {
    sticky: true,
    actions: [
      {
        id: 'cancel',
        label: 'Cancel',
        variant: 'ghost' as const,
        action: { type: 'cancel' as const },
      },
      {
        id: 'submit',
        label: 'Save Product',
        variant: 'primary' as const,
        disabled: ['NOT', '$form.isValid'],
        action: { type: 'submit' as const },
      },
    ],
  },
}
```

---

## Step 3: Create the Form Component

### React Version

Create `components/ProductForm.tsx`:

```tsx
import { useState } from 'react'
import { FormRenderer } from '@manifesto-ai/react'
import '@manifesto-ai/react/styles'

import { productView, productEntity } from '../schemas/product'

interface Product {
  id?: string
  name: string
  sku: string
  price: number
  category: string
  description?: string
  stock: number
  isActive: boolean
}

interface ProductFormProps {
  product?: Product
  onSave: (product: Product) => Promise<void>
  onCancel: () => void
}

export function ProductForm({ product, onSave, onCancel }: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsSubmitting(true)
    setError(null)

    try {
      await onSave(data as Product)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const navigateHandler = (path: string) => {
    if (path === '/cancel') {
      onCancel()
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        {product ? 'Edit Product' : 'New Product'}
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-4">
          {error}
        </div>
      )}

      <FormRenderer
        schema={productView}
        entitySchema={productEntity}
        initialValues={product}
        navigateHandler={navigateHandler}
        onSubmit={handleSubmit}
        debug={process.env.NODE_ENV === 'development'}
      />

      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            Saving product...
          </div>
        </div>
      )}
    </div>
  )
}
```

### Vue Version

Create `components/ProductForm.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FormRenderer } from '@manifesto-ai/vue'
import '@manifesto-ai/vue/styles'

import { productView, productEntity } from '../schemas/product'

interface Product {
  id?: string
  name: string
  sku: string
  price: number
  category: string
  description?: string
  stock: number
  isActive: boolean
}

const props = defineProps<{
  product?: Product
}>()

const emit = defineEmits<{
  save: [product: Product]
  cancel: []
}>()

const isSubmitting = ref(false)
const error = ref<string | null>(null)

const handleSubmit = async (data: Record<string, unknown>) => {
  isSubmitting.value = true
  error.value = null

  try {
    emit('save', data as Product)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save'
  } finally {
    isSubmitting.value = false
  }
}

const navigateHandler = (path: string) => {
  if (path === '/cancel') {
    emit('cancel')
  }
}

const isDev = import.meta.env.DEV
</script>

<template>
  <div class="max-w-2xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">
      {{ product ? 'Edit Product' : 'New Product' }}
    </h1>

    <div
      v-if="error"
      class="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-4"
    >
      {{ error }}
    </div>

    <FormRenderer
      :schema="productView"
      :entity-schema="productEntity"
      :initial-values="product"
      :navigate-handler="navigateHandler"
      :debug="isDev"
      @submit="handleSubmit"
    />

    <div
      v-if="isSubmitting"
      class="fixed inset-0 bg-black/50 flex items-center justify-center"
    >
      <div class="bg-white p-6 rounded-lg shadow-lg">
        Saving product...
      </div>
    </div>
  </div>
</template>
```

---

## Step 4: Connect to Your API

### Create Page (React)

```tsx
// pages/products/new.tsx
import { useNavigate } from 'react-router-dom'
import { ProductForm } from '../../components/ProductForm'
import { api } from '../../services/api'

export function NewProductPage() {
  const navigate = useNavigate()

  const handleSave = async (product: Product) => {
    const response = await api.post('/products', product)
    navigate(`/products/${response.data.id}`)
  }

  const handleCancel = () => {
    navigate('/products')
  }

  return <ProductForm onSave={handleSave} onCancel={handleCancel} />
}
```

### Edit Page (React)

```tsx
// pages/products/edit.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ProductForm } from '../../components/ProductForm'
import { api } from '../../services/api'

export function EditProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/products/${id}`).then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: (data: Product) => api.put(`/products/${id}`, data),
    onSuccess: () => navigate(`/products/${id}`),
  })

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <ProductForm
      product={product}
      onSave={mutation.mutateAsync}
      onCancel={() => navigate('/products')}
    />
  )
}
```

---

## Step 5: Add Delete Functionality

Update the view schema to include a delete button in edit mode:

```typescript
// In productView
footer: {
  sticky: true,
  actions: [
    {
      id: 'delete',
      label: 'Delete',
      variant: 'danger' as const,
      visible: ['!=', '$params.mode', 'create'],
      action: {
        type: 'custom' as const,
        actionId: 'delete-product',
        confirm: {
          title: 'Delete Product',
          message: 'Are you sure? This action cannot be undone.',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
        },
      },
    },
    {
      id: 'cancel',
      label: 'Cancel',
      variant: 'ghost' as const,
      action: { type: 'cancel' as const },
    },
    {
      id: 'submit',
      label: 'Save Product',
      variant: 'primary' as const,
      disabled: ['NOT', '$form.isValid'],
      action: { type: 'submit' as const },
    },
  ],
}
```

Handle the delete event:

```tsx
const emitHandler = async (event: string, payload?: Record<string, unknown>) => {
  if (event === 'delete-product') {
    await api.delete(`/products/${product.id}`)
    navigate('/products')
  }
}

<FormRenderer
  // ...other props
  emitHandler={emitHandler}
/>
```

---

## Complete Files

### schemas/product.entity.ts

```typescript
import { field, enumValue } from '@manifesto-ai/schema'

export const productEntity = {
  _type: 'entity' as const,
  id: 'product',
  name: 'Product',
  version: '1.0.0',

  fields: [
    field.string('id', 'ID').build(),
    field.string('name', 'Product Name').required().min(3).max(100).build(),
    field.string('sku', 'SKU').required().pattern('^[A-Z0-9-]+$').build(),
    field.number('price', 'Price').required().min(0).build(),
    field.enum('category', 'Category', [
      enumValue('electronics', 'Electronics'),
      enumValue('clothing', 'Clothing'),
      enumValue('home', 'Home & Garden'),
      enumValue('sports', 'Sports & Outdoors'),
    ]).required().build(),
    field.string('description', 'Description').max(1000).build(),
    field.number('stock', 'Stock Quantity').min(0).defaultValue(0).build(),
    field.boolean('isActive', 'Active').defaultValue(true).build(),
  ],
}
```

### schemas/product.view.ts

```typescript
import { viewField } from '@manifesto-ai/schema'

export const productView = {
  _type: 'view' as const,
  id: 'product-form',
  name: 'Product Form',
  version: '1.0.0',
  entityRef: 'product',
  mode: 'create' as const,
  layout: { type: 'form' as const },

  sections: [
    {
      id: 'basic',
      title: 'Basic Information',
      layout: { type: 'grid' as const, columns: 2, gap: '1rem' },
      fields: [
        viewField.textInput('name', 'name').placeholder('Enter product name').span(2).build(),
        viewField.textInput('sku', 'sku').placeholder('e.g., PROD-001').build(),
        viewField.numberInput('price', 'price').props({ min: 0, step: 0.01 }).build(),
        viewField.select('category', 'category').placeholder('Select a category').span(2).build(),
      ],
    },
    {
      id: 'details',
      title: 'Details',
      layout: { type: 'form' as const },
      fields: [
        viewField.textarea('description', 'description').props({ rows: 4 }).build(),
      ],
    },
    {
      id: 'inventory',
      title: 'Inventory',
      layout: { type: 'grid' as const, columns: 2 },
      fields: [
        viewField.numberInput('stock', 'stock').props({ min: 0 }).build(),
        viewField.toggle('isActive', 'isActive').build(),
      ],
    },
  ],

  footer: {
    sticky: true,
    actions: [
      { id: 'cancel', label: 'Cancel', variant: 'ghost' as const, action: { type: 'cancel' as const } },
      { id: 'submit', label: 'Save', variant: 'primary' as const, action: { type: 'submit' as const } },
    ],
  },
}
```

---

## Next Steps

- [Dynamic Conditions](./dynamic-conditions.md) - Show/hide fields based on values
- [Cascade Select](./cascade-select.md) - Dependent dropdown menus
- [Validation Patterns](./validation.md) - Advanced validation techniques

---

[Back to Guides](../README.md)
