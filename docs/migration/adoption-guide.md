# Adoption Guide

This guide helps you understand when and how to adopt Manifesto for your projects.

## Table of Contents

- [When to Use Manifesto](#when-to-use-manifesto-ai)
- [When Not to Use Manifesto](#when-not-to-use-manifesto-ai)
- [Adoption Strategies](#adoption-strategies)
- [Migration from Traditional Forms](#migration-from-traditional-forms)
- [Integration with Existing Projects](#integration-with-existing-projects)
- [Common Challenges](#common-challenges)

---

## When to Use Manifesto

### Ideal Use Cases

**1. Multi-Brand/Multi-Tenant Applications**

When you need the same form logic across different brands:

```
Brand A: Standard checkout form
Brand B: Same form + extra loyalty fields
Brand C: Same form + regional tax fields
```

With Manifesto, one engine powers all brands. You only change the schemas.

**2. Dynamic Forms**

Forms where fields show/hide based on user input:

- Conditional sections based on selections
- Role-based field visibility
- Progressive disclosure patterns

**3. Enterprise Applications**

Large-scale applications with:

- Many similar forms
- Strict validation requirements
- Complex business rules
- Multiple teams working on forms

**4. AI-Assisted Form Generation**

When you want to:

- Generate forms from natural language
- Have AI modify form structures
- Build form builders or low-code tools

**5. Legacy API Integration**

Forms connecting to APIs with:

- Non-standard field names
- Complex response structures
- Different request formats

---

## When Not to Use Manifesto

### Consider Alternatives For

**1. Simple Static Forms**

If you have a single, unchanging form:

```tsx
// This is fine without Manifesto
function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit">Send</button>
    </form>
  )
}
```

**2. Highly Custom UX**

Forms with unique interactions that don't fit standard patterns:

- Drag-and-drop interfaces
- Canvas-based editors
- Real-time collaboration features

**3. Performance-Critical Forms**

Forms requiring sub-millisecond response times:

- High-frequency trading interfaces
- Real-time gaming inputs

**4. Small Projects**

Projects where the overhead of schemas outweighs benefits:

- Personal projects
- Proof of concepts
- One-off prototypes

---

## Adoption Strategies

### Strategy 1: New Project

For new projects, start with Manifesto from day one.

```
1. Install packages
2. Define entity schemas for your data model
3. Create view schemas for each form
4. Build once, scale infinitely
```

### Strategy 2: Feature-Based Adoption

Add Manifesto for new features while keeping existing forms:

```
Phase 1: Use Manifesto for new feature (e.g., onboarding wizard)
Phase 2: Migrate high-maintenance forms
Phase 3: Gradually convert remaining forms
Phase 4: Full Manifesto adoption
```

### Strategy 3: Module-Based Adoption

Adopt by application module:

```
Phase 1: User management forms
Phase 2: Product management forms
Phase 3: Order management forms
...
```

### Strategy 4: Shadow Migration

Run both systems in parallel:

```
1. Create Manifesto version alongside existing form
2. A/B test with small percentage of users
3. Validate behavior matches
4. Gradually increase traffic to Manifesto version
5. Retire old implementation
```

---

## Migration from Traditional Forms

### Step 1: Analyze Existing Form

Document your current form:

```typescript
// Before: Traditional React form
function ProductForm({ product, onSave }) {
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product?.price ?? 0)
  const [category, setCategory] = useState(product?.category ?? '')
  const [errors, setErrors] = useState({})

  const validate = () => {
    const newErrors = {}
    if (!name) newErrors.name = 'Required'
    if (name.length < 3) newErrors.name = 'Too short'
    if (price < 0) newErrors.price = 'Invalid'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      onSave({ name, price, category })
    }
  }

  // ... render
}
```

Extract:
- Fields: name, price, category
- Validations: required, min length, min value
- Behavior: any conditional logic

### Step 2: Create Entity Schema

```typescript
import { field, enumValue } from '@manifesto-ai/schema'

export const productEntity = {
  _type: 'entity' as const,
  id: 'product',
  name: 'Product',
  version: '1.0.0',
  fields: [
    field.string('name', 'Name').required().min(3).build(),
    field.number('price', 'Price').min(0).build(),
    field.enum('category', 'Category', [
      enumValue('electronics', 'Electronics'),
      enumValue('clothing', 'Clothing'),
    ]).build(),
  ],
}
```

### Step 3: Create View Schema

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
  sections: [{
    id: 'main',
    layout: { type: 'form' as const },
    fields: [
      viewField.textInput('name', 'name').placeholder('Product name').build(),
      viewField.numberInput('price', 'price').build(),
      viewField.select('category', 'category').build(),
    ],
  }],
}
```

### Step 4: Replace Component

```tsx
// After: Manifesto-powered form
import { FormRenderer } from '@manifesto-ai/react'
import { productView, productEntity } from './schemas/product'

function ProductForm({ product, onSave }) {
  return (
    <FormRenderer
      schema={productView}
      entitySchema={productEntity}
      initialValues={product}
      onSubmit={onSave}
    />
  )
}
```

### Step 5: Verify Behavior

Test that:
- All fields render correctly
- Validation works identically
- Submit data matches expected format
- Any conditional logic works

---

## Integration with Existing Projects

### With Redux/Zustand

```tsx
import { useFormRuntime } from '@manifesto-ai/react'
import { useDispatch } from 'react-redux'

function ProductForm() {
  const dispatch = useDispatch()
  const { state, dispatch: formDispatch } = useFormRuntime(schema, options)

  const handleSubmit = (data) => {
    dispatch(saveProduct(data))
  }

  return <FormRenderer schema={schema} onSubmit={handleSubmit} />
}
```

### With React Query

```tsx
import { FormRenderer } from '@manifesto-ai/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

function ProductForm() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: saveProduct,
    onSuccess: () => {
      queryClient.invalidateQueries(['products'])
    },
  })

  return (
    <FormRenderer
      schema={schema}
      fetchHandler={fetchHandler}
      onSubmit={mutation.mutate}
    />
  )
}
```

### With React Router

```tsx
import { useNavigate, useParams } from 'react-router-dom'
import { FormRenderer } from '@manifesto-ai/react'

function ProductForm() {
  const navigate = useNavigate()
  const { id } = useParams()

  const navigateHandler = (path) => navigate(path)

  return (
    <FormRenderer
      schema={schema}
      context={{ params: { id, mode: id ? 'edit' : 'create' } }}
      navigateHandler={navigateHandler}
      onSubmit={handleSubmit}
    />
  )
}
```

### With Vue Router

```vue
<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { FormRenderer } from '@manifesto-ai/vue'

const router = useRouter()
const route = useRoute()

const navigateHandler = (path: string) => router.push(path)
</script>

<template>
  <FormRenderer
    :schema="schema"
    :context="{ params: { id: route.params.id } }"
    :navigate-handler="navigateHandler"
    @submit="handleSubmit"
  />
</template>
```

---

## Common Challenges

### Challenge 1: Learning Curve

**Problem**: Team unfamiliar with schema-driven approach.

**Solutions**:
- Start with simple forms
- Pair programming sessions
- Create internal cheat sheets
- Use debug mode extensively

### Challenge 2: Custom Components

**Problem**: Need components not provided by Manifesto.

**Solution**: Use custom component type:

```typescript
viewField.custom('specialInput', 'fieldId', 'MyCustomComponent')
  .props({ customProp: 'value' })
  .build()
```

Register in your renderer:

```tsx
const customComponents = {
  MyCustomComponent: ({ value, onChange, ...props }) => (
    <MyInput value={value} onChange={onChange} {...props} />
  ),
}

<FormRenderer
  schema={schema}
  customComponents={customComponents}
/>
```

### Challenge 3: Complex Business Logic

**Problem**: Logic that doesn't fit expression DSL.

**Solution**: Use emit events for complex logic:

```typescript
viewField.select('product', 'productId')
  .reaction(
    on.change()
      .do(actions.emit('product-selected', { productId: '$state.productId' }))
  )
  .build()
```

```tsx
const emitHandler = async (event, payload) => {
  if (event === 'product-selected') {
    const details = await fetchProductDetails(payload.productId)
    // Complex business logic here
    runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: 'price', value: details.price })
  }
}
```

### Challenge 4: Performance with Large Forms

**Problem**: Large forms feel slow.

**Solutions**:
- Use dependsOn to minimize re-evaluations
- Debounce expensive operations
- Split into multiple sections/tabs
- Use virtualization for long lists

### Challenge 5: Testing

**Problem**: How to test schema-driven forms.

**Solution**: Test at multiple levels:

```typescript
// 1. Schema validation tests
import { validateSchema } from '@manifesto-ai/schema'

test('product schema is valid', () => {
  const result = validateSchema(productEntity)
  expect(result.success).toBe(true)
})

// 2. Expression tests
import { createEvaluator } from '@manifesto-ai/engine'

test('price calculation', () => {
  const evaluator = createEvaluator()
  const result = evaluator.evaluate(
    ['*', '$state.quantity', '$state.unitPrice'],
    { state: { quantity: 5, unitPrice: 10 } }
  )
  expect(result.value).toBe(50)
})

// 3. Integration tests
import { render, fireEvent } from '@testing-library/react'

test('form submission', async () => {
  const onSubmit = jest.fn()
  const { getByLabelText, getByText } = render(
    <FormRenderer schema={schema} onSubmit={onSubmit} />
  )

  fireEvent.change(getByLabelText('Name'), { target: { value: 'Test' } })
  fireEvent.click(getByText('Submit'))

  expect(onSubmit).toHaveBeenCalledWith({ name: 'Test' })
})
```

---

## Checklist for Adoption

- [ ] Evaluated use case fit
- [ ] Chosen adoption strategy
- [ ] Set up development environment
- [ ] Created first entity schema
- [ ] Created first view schema
- [ ] Integrated with existing routing
- [ ] Set up fetch handlers for APIs
- [ ] Configured validation rules
- [ ] Added debug panel for development
- [ ] Written tests for schemas
- [ ] Documented team conventions
- [ ] Trained team on Expression DSL

---

[Back to Documentation](../README.md)
