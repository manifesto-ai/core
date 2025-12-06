# Getting Started

This guide will help you create your first schema-driven form with Manifesto.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Step 1: Define Entity Schema](#step-1-define-entity-schema)
- [Step 2: Define View Schema](#step-2-define-view-schema)
- [Step 3: Render the Form](#step-3-render-the-form)
- [Step 4: Handle Submission](#step-4-handle-submission)
- [Next Steps](#next-steps)

---

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0 (recommended) or npm/yarn
- React 18+ or Vue 3+

---

## Installation

### Core Packages

```bash
# Using pnpm (recommended)
pnpm add @manifesto-ai/schema @manifesto-ai/engine

# Using npm
npm install @manifesto-ai/schema @manifesto-ai/engine

# Using yarn
yarn add @manifesto-ai/schema @manifesto-ai/engine
```

### Framework Binding

Choose one based on your framework:

```bash
# For React
pnpm add @manifesto-ai/react

# For Vue
pnpm add @manifesto-ai/vue
```

### AI Interoperability (optional)

Install when you want AI agents to read and act on your forms:

```bash
pnpm add @manifesto-ai/ai-util
```

---

## Step 1: Define Entity Schema

The Entity Schema defines your data structure and validation rules.

Create `schemas/contact.entity.ts`:

```typescript
import { entity, field } from '@manifesto-ai/schema'

export const contactEntity = entity('contact', 'Contact', '1.0.0')
  .description('Contact information form')

  // String field with validation
  .field(
    field.string('name')
      .label('Full Name')
      .required()
      .min(2)
      .max(100)
  )

  // Email field with pattern validation
  .field(
    field.string('email')
      .label('Email Address')
      .required()
      .pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')
  )

  // Optional phone field
  .field(
    field.string('phone')
      .label('Phone Number')
  )

  // Enum field
  .field(
    field.enum('subject', [
      { value: 'general', label: 'General Inquiry' },
      { value: 'support', label: 'Technical Support' },
      { value: 'sales', label: 'Sales Question' },
      { value: 'feedback', label: 'Feedback' },
    ])
      .label('Subject')
      .required()
  )

  // Multiline text field
  .field(
    field.string('message')
      .label('Message')
      .required()
      .min(10)
      .max(1000)
  )

  .build()
```

---

## Step 2: Define View Schema

The View Schema defines how the form looks and behaves.

Create `schemas/contact.view.ts`:

```typescript
import { view, section, viewField, layout } from '@manifesto-ai/schema'

export const contactView = view('contact-form', 'Contact Form', '1.0.0')
  .entityRef('contact')
  .mode('create')
  .layout(layout.form())

  .section(
    section('personal')
      .title('Your Information')
      .field(
        viewField.textInput('name', 'name')
          .placeholder('Enter your full name')
      )
      .field(
        viewField.textInput('email', 'email')
          .placeholder('your.email@example.com')
      )
      .field(
        viewField.textInput('phone', 'phone')
          .placeholder('(Optional) Your phone number')
      )
  )

  .section(
    section('inquiry')
      .title('Your Message')
      .field(
        viewField.select('subject', 'subject')
          .placeholder('Select a subject')
      )
      .field(
        viewField.textarea('message', 'message')
          .placeholder('How can we help you?')
          .props({ rows: 5 })
      )
  )

  .build()
```

---

## Step 3: Render the Form

### React

Create `ContactForm.tsx`:

```tsx
import { FormRenderer } from '@manifesto-ai/react'
import '@manifesto-ai/react/styles'  // Import default styles

import { contactView } from './schemas/contact.view'
import { contactEntity } from './schemas/contact.entity'

export function ContactForm() {
  const handleSubmit = (data: Record<string, unknown>) => {
    console.log('Form submitted:', data)
    // Send to your API
  }

  const handleError = (error: unknown) => {
    console.error('Form error:', error)
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Contact Us</h1>

      <FormRenderer
        schema={contactView}
        entitySchema={contactEntity}
        onSubmit={handleSubmit}
        onError={handleError}
        debug={process.env.NODE_ENV === 'development'}
      />
    </div>
  )
}
```

### Vue

Create `ContactForm.vue`:

```vue
<script setup lang="ts">
import { FormRenderer } from '@manifesto-ai/vue'
import '@manifesto-ai/vue/styles'  // Import default styles

import { contactView } from './schemas/contact.view'
import { contactEntity } from './schemas/contact.entity'

const handleSubmit = (data: Record<string, unknown>) => {
  console.log('Form submitted:', data)
  // Send to your API
}

const handleError = (error: unknown) => {
  console.error('Form error:', error)
}
</script>

<template>
  <div class="max-w-2xl mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Contact Us</h1>

    <FormRenderer
      :schema="contactView"
      :entity-schema="contactEntity"
      @submit="handleSubmit"
      @error="handleError"
      debug
    />
  </div>
</template>
```

---

## Step 4: Handle Submission

The `onSubmit` handler receives validated form data. Here's how to send it to an API:

### React

```tsx
import { useState } from 'react'
import { FormRenderer } from '@manifesto-ai/react'

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to submit')
      }

      setSuccess(true)
    } catch (error) {
      console.error('Submit failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return <div>Thank you! We'll be in touch soon.</div>
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

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FormRenderer } from '@manifesto-ai/vue'

const isSubmitting = ref(false)
const success = ref(false)

const handleSubmit = async (data: Record<string, unknown>) => {
  isSubmitting.value = true

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Failed to submit')
    }

    success.value = true
  } catch (error) {
    console.error('Submit failed:', error)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="success">Thank you! We'll be in touch soon.</div>

  <FormRenderer
    v-else
    :schema="contactView"
    :entity-schema="contactEntity"
    @submit="handleSubmit"
  />
</template>
```

---

## Adding Dynamic Behavior

Let's add a conditional field. Show a "Company" field only for sales inquiries:

### Update Entity Schema

```typescript
// Add to contactEntity
.field(
  field.string('company')
    .label('Company Name')
)
```

### Update View Schema

```typescript
// Add to the 'personal' section
.field(
  viewField.textInput('company', 'company')
    .placeholder('Your company name')
    .hidden(['!=', '$state.subject', 'sales'])  // Only show for sales
)
```

Now the "Company" field only appears when "Sales Question" is selected.

---

## Using Initial Values

Pre-populate the form with existing data:

### React

```tsx
<FormRenderer
  schema={contactView}
  entitySchema={contactEntity}
  initialValues={{
    name: 'John Doe',
    email: 'john@example.com',
    subject: 'support'
  }}
  onSubmit={handleSubmit}
/>
```

### Vue

```vue
<FormRenderer
  :schema="contactView"
  :entity-schema="contactEntity"
  :initial-values="{
    name: 'John Doe',
    email: 'john@example.com',
    subject: 'support'
  }"
  @submit="handleSubmit"
/>
```

---

## Using the Debug Panel

Enable the debug panel to see real-time form state:

```tsx
<FormRenderer
  schema={contactView}
  entitySchema={contactEntity}
  debug={true}  // Shows debug panel
  onSubmit={handleSubmit}
/>
```

The debug panel shows:
- Current form values
- Field states (hidden, disabled, errors)
- Expression evaluation results
- Field dependencies
- Value change history

---

## Expose the Form to AI Agents (optional)

Turn the running form into an AI-facing session for safe automation:

```ts
import { createFormRuntime } from '@manifesto-ai/engine'
import { createInteroperabilitySession, toToolDefinitions } from '@manifesto-ai/ai-util'

const runtime = createFormRuntime(contactView, { entitySchema: contactEntity })
const session = createInteroperabilitySession({
  runtime,
  viewSchema: contactView,
  entitySchema: contactEntity,
})

const snapshot = session.snapshot() // semantic state for reasoning
const tools = toToolDefinitions(snapshot, { omitUnavailable: true }) // OpenAI/Claude tool schemas
```

---

## Next Steps

Now that you have a basic form working, explore these topics:

1. **[Dynamic Conditions](./guides/dynamic-conditions.md)** - Show/hide fields based on values
2. **[Cascade Select](./guides/cascade-select.md)** - Dependent dropdown menus
3. **[Validation Patterns](./guides/validation.md)** - Advanced validation techniques
4. **[Expression DSL](./schema-reference/expression-dsl.md)** - Learn the expression syntax
5. **[Reaction DSL](./schema-reference/reaction-dsl.md)** - Event-driven interactions

---

## Complete Example Files

Here's the complete code for reference:

### `schemas/contact.entity.ts`

```typescript
import { entity, field } from '@manifesto-ai/schema'

export const contactEntity = entity('contact', 'Contact', '1.0.0')
  .description('Contact information form')
  .field(field.string('name').label('Full Name').required().min(2).max(100))
  .field(field.string('email').label('Email Address').required()
    .pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'))
  .field(field.string('phone').label('Phone Number'))
  .field(field.string('company').label('Company Name'))
  .field(field.enum('subject', [
    { value: 'general', label: 'General Inquiry' },
    { value: 'support', label: 'Technical Support' },
    { value: 'sales', label: 'Sales Question' },
    { value: 'feedback', label: 'Feedback' },
  ]).label('Subject').required())
  .field(field.string('message').label('Message').required().min(10).max(1000))
  .build()
```

### `schemas/contact.view.ts`

```typescript
import { view, section, viewField, layout } from '@manifesto-ai/schema'

export const contactView = view('contact-form', 'Contact Form', '1.0.0')
  .entityRef('contact')
  .mode('create')
  .layout(layout.form())
  .section(
    section('personal')
      .title('Your Information')
      .field(viewField.textInput('name', 'name').placeholder('Enter your full name'))
      .field(viewField.textInput('email', 'email').placeholder('your.email@example.com'))
      .field(viewField.textInput('phone', 'phone').placeholder('(Optional) Your phone number'))
      .field(viewField.textInput('company', 'company')
        .placeholder('Your company name')
        .hidden(['!=', '$state.subject', 'sales']))
  )
  .section(
    section('inquiry')
      .title('Your Message')
      .field(viewField.select('subject', 'subject').placeholder('Select a subject'))
      .field(viewField.textarea('message', 'message')
        .placeholder('How can we help you?')
        .props({ rows: 5 }))
  )
  .build()
```

---

[Back to Documentation](./README.md)
