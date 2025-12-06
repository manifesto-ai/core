# Manifesto DSL Schema Authoring Guide

This guide explains how to author Entity and View schemas with Manifesto DSL in a type-safe, runtime-safe way.

## Table of Contents

1. [Overview](#overview)
2. [Entity Schema](#entity-schema)
3. [View Schema](#view-schema)
4. [Expressions](#expressions)
5. [Reactions](#reactions)
6. [Component Types](#component-types)
7. [Examples](#examples)

---

## Overview

Manifesto DSL consists of two schemas:

| Schema | Purpose | File naming |
|--------|---------|-------------|
| **Entity Schema** | Define data shape and validation | `*.entity.ts` |
| **View Schema** | Define UI layout and dynamic behavior | `*.view.ts` |

Relationship:

```
Entity Schema (data)          View Schema (UI)
├── Field definitions         ├── Sections
├── Data types                ├── Components
├── Validation rules          ├── Conditional visibility/enabled
└── Defaults                  └── Reactions (dynamic behavior)
```

---

## Entity Schema

Entity Schema defines structure and validation.

### Basic structure

```typescript
import { entity, field, enumValue } from '@manifesto-ai/schema'

export const statusOptions = [
  enumValue('ACTIVE', 'Active'),
  enumValue('INACTIVE', 'Inactive'),
] as const

export const userEntity = entity('user', 'User', '1.0.0')
  .description('User profile entity')
  .tags('user', 'auth')
  .fields(
    // field definitions...
  )
  .build()
```

### Field types

#### string

```typescript
field.string('name', 'Name')
  .required('Name is required')
  .min(2, 'Minimum 2 characters')
  .max(100, 'Maximum 100 characters')
  .pattern(/^[a-zA-Z]+$/, 'Alphabet only')
  .build()
```

#### number

```typescript
field.number('age', 'Age')
  .required('Age is required')
  .min(0)
  .max(150)
  .defaultValue(20)
  .build()
```

#### boolean

```typescript
field.boolean('isActive', 'Active')
  .defaultValue(true)
  .build()
```

#### date / datetime

```typescript
field.date('birthDate', 'Birth Date')
  .required('Select birth date')
  .build()

field.datetime('createdAt', 'Created At').build()
```

#### enum

```typescript
const priorityOptions = [
  enumValue('LOW', 'Low'),
  enumValue('NORMAL', 'Normal'),
  enumValue('HIGH', 'High'),
] as const

field.enum('priority', 'Priority', priorityOptions)
  .required('Select priority')
  .defaultValue('NORMAL')
  .build()
```

#### array

```typescript
field.array('tags', 'Tags', 'string')
  .required('Enter at least one tag')
  .build()
```

### Validation helpers

| Method | Description | Types |
|--------|-------------|-------|
| `required(message)` | Required | all |
| `min(value, message)` | Min value/length | string, number |
| `max(value, message)` | Max value/length | string, number |
| `pattern(regex, message)` | Regex | string |
| `defaultValue(value)` | Default | all |

---

## View Schema

View Schema defines UI and dynamic behavior.

### Basic structure

```typescript
import {
  view,
  section,
  layout,
  header,
  footer,
  viewAction,
  confirm,
  viewField,
} from '@manifesto-ai/schema'

export const userView = view('user-form', 'User Form', '1.0.0')
  .entityRef('user')             // entity reference
  .mode('create')                // create | edit | view
  .description('User signup form')
  .layout(layout.form(2))        // 2-column form
  .header(header('User Signup', {
    subtitle: 'Register a new user',
  }))
  .sections(
    // sections...
  )
  .footer(footer([
    viewAction.cancel('cancel', 'Cancel').build(),
    viewAction.submit('submit', 'Save').build(),
  ]))
  .build()
```

### Section definition

```typescript
section('basic-info')
  .title('Basic Info')
  .description('Enter user basics')
  .layout(layout.grid(2, '1rem'))    // 2-column grid
  .collapsible(true)
  .visible(['!=', $.state('status'), 'DELETED'])
  .fields(
    // fields...
  )
  .build()
```

### Layout helpers

```typescript
layout.form(columns?)          // form layout
layout.grid(columns, gap?)     // grid layout

layout.form(2)                 // 2-column form
layout.grid(3, '1rem')         // 3-column grid
```

### ViewField definition

```typescript
viewField.textInput('name', 'name')     // (view field id, entity field id)
  .label('Name')
  .placeholder('Enter name')
  .helpText('Alphabet only')
  .span(2)
  .disabled(['==', $.state('status'), 'LOCKED'])
  .hidden(['==', $.state('type'), 'HIDDEN'])
  .build()
```

---

## Expressions

Expressions declaratively describe conditional logic.

### Context references

```typescript
import { $ } from '@manifesto-ai/schema'

$.state('fieldId')      // $state.fieldId
$.user('role')          // $user.role
$.context('currentDate')// $context.currentDate
```

### Comparison

```typescript
['==', $.state('status'), 'ACTIVE']
['!=', $.state('type'), 'HIDDEN']
['>', $.state('age'), 18]
['<', $.state('count'), 100]
['>=', $.state('score'), 60]
['<=', $.state('price'), 1000]
```

### Logic

```typescript
['AND',
  ['==', $.state('type'), 'A'],
  ['>', $.state('count'), 0]
]

['OR',
  ['==', $.state('status'), 'ACTIVE'],
  ['==', $.state('status'), 'PENDING']
]

['NOT', ['IS_EMPTY', $.state('name')]]
```

### Presence checks

```typescript
['IS_NULL', $.state('endDate')]
['IS_NOT_NULL', $.state('startDate')]
['IS_EMPTY', $.state('tags')]
['IS_NOT_EMPTY', $.state('name')]
```

### Collection

```typescript
['CONTAINS', $.state('channels'), 'EMAIL']
['IN', $.state('status'), ['ACTIVE', 'PENDING', 'REVIEW']]
```

### Helper

```typescript
import { fieldEquals } from '@manifesto-ai/schema'

fieldEquals('status', 'ACTIVE') // -> ['==', $.state('status'), 'ACTIVE']
```

### Typed expression builder (IDE safety)

```typescript
import { createTypedExpression } from '@manifesto-ai/schema'
import type { Product } from './types/domain'

const exp = createTypedExpression<Product>()

const visibleRule = exp.field('status').is('ACTIVE')
  .and(exp.field('price').gt(0))

// exp.field('prcie')                 // Error: invalid field
// exp.field('status').is('DELETED')  // Error: invalid literal
// exp.field('name').gt(10)           // Error: number-only operator
```

### Typed view/action builder

```typescript
import { createTypedView, createTypedExpression } from '@manifesto-ai/schema'
import type { ProductFormState } from './types'

const v = createTypedView<ProductFormState>()
const x = createTypedExpression<ProductFormState>()

const priceField = v.field('price').numberInput('Price').props({ min: 0 }).build()

const hideShipping = v.actions.updateProp('shippingWeight', 'hidden', true)
const setFinalPrice = v.actions.setValue('finalPrice', x.field('price').build())

// v.field('prcie')                        // Error: unknown field
// v.actions.setValue('price', '1,000')    // Error: string not assignable to number
// v.actions.toggle('price')               // Error: toggle only for boolean fields
```

---

## Reactions

Reactions describe dynamic behavior triggered by events.

### Triggers

```typescript
import { on, actions } from '@manifesto-ai/schema'

on.mount()
on.change()
on.focus()
on.blur()
```

### Conditional execution

```typescript
viewField.select('triggerType', 'triggerType')
  .reaction(
    on.change()
      .when(fieldEquals('triggerType', 'EMERGENCY'))
      .do(
        actions.setValue('priority', 'CRITICAL'),
        actions.updateProp('smsCheckbox', 'disabled', true)
      )
  )
  .build()
```

### Action types

#### setValue

```typescript
actions.setValue('fieldId', value)
actions.setValue('smsCheckbox', true)
actions.setValue('subCategoryId', '')
```

#### updateProp

```typescript
actions.updateProp('fieldId', 'propName', value)
actions.updateProp('name', 'disabled', true)
```

#### setOptions (Select)

```typescript
import { dataSource } from '@manifesto-ai/schema'

actions.setOptions('subCategoryId', dataSource.api('/api/sub-categories', {
  method: 'GET',
  params: { categoryId: $.state('categoryId') },
  transform: {
    path: 'data',
    map: { value: 'id', label: 'name' },
  },
}))

actions.setOptions('status', [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
])
```

### Cascade select pattern

```typescript
viewField.select('categoryId', 'categoryId')
  .label('Category')
  .reaction(
    on.mount()
      .do(
        actions.setOptions('categoryId', dataSource.api('/api/categories', {
          method: 'GET',
          transform: { path: 'data', map: { value: 'id', label: 'name' } },
        }))
      )
  )
  .reaction(
    on.change()
      .do(
        actions.setValue('subCategoryId', ''),
        actions.setOptions('subCategoryId', dataSource.api('/api/sub-categories', {
          method: 'GET',
          params: { categoryId: $.state('categoryId') },
          transform: { path: 'data', map: { value: 'id', label: 'name' } },
        }))
      )
  )
  .build()

viewField.select('subCategoryId', 'subCategoryId')
  .label('Sub Category')
  .disabled(['IS_EMPTY', $.state('categoryId')])
  .dependsOn('categoryId')
  .build()
```

---

## Component Types

### Input components

| Method | Component | Purpose |
|--------|-----------|---------|
| `viewField.textInput()` | TextInput | Single-line text |
| `viewField.textarea()` | Textarea | Multi-line text |
| `viewField.numberInput()` | NumberInput | Numeric input |
| `viewField.select()` | Select | Single select |
| `viewField.checkbox()` | Checkbox | Boolean |
| `viewField.radio()` | Radio | Radio group |
| `viewField.datePicker()` | DatePicker | Date |

### Component props

```typescript
viewField.textarea('description', 'description')
  .props({ rows: 3 })
  .build()

viewField.numberInput('age', 'age')
  .props({ min: 0, max: 150, step: 1 })
  .build()
```

---

## Examples

### 1. Conditional section visibility

```typescript
section('weekly-options')
  .title('Weekdays')
  .visible(fieldEquals('repeatType', 'WEEKLY'))
  .fields(
    viewField.checkbox('monday', 'monday').label('Mon').build(),
    viewField.checkbox('tuesday', 'tuesday').label('Tue').build(),
  )
  .build()
```

### 2. Trigger → actions

```typescript
viewField.select('triggerType', 'triggerType')
  .label('Trigger type')
  .reaction(
    on.change()
      .when(fieldEquals('triggerType', 'EMERGENCY'))
      .do(
        actions.setValue('smsCheckbox', true),
        actions.setValue('priority', 'CRITICAL'),
        actions.updateProp('smsCheckbox', 'disabled', true)
      )
  )
  .reaction(
    on.change()
      .when(['!=', $.state('triggerType'), 'EMERGENCY'])
      .do(actions.updateProp('smsCheckbox', 'disabled', false))
  )
  .build()
```

### 3. Composite conditions

```typescript
viewField.select('role', 'role')
  .disabled(['OR',
    ['!=', $.user('role'), 'ADMIN'],
    ['==', $.state('status'), 'LOCKED'],
  ])
  .build()
```

### 4. Null check banner

```typescript
section('no-end-date-warning')
  .title('No end date')
  .visible(['IS_NULL', $.state('endDate')])
  .fields()
  .build()
```

---

## Recommended file structure

```
src/
└── schemas/
    ├── index.ts
    ├── user-edit.entity.ts
    ├── user-edit.view.ts
    ├── schedule.entity.ts
    ├── schedule.view.ts
    └── ...
```

`index.ts` example:

```typescript
export { userEntity } from './user-edit.entity'
export { scheduleEntity } from './schedule.entity'

export { userEditView } from './user-edit.view'
export { scheduleView } from './schedule.view'
```

---

## Using with FormRenderer

```vue
<script setup lang="ts">
import FormRenderer from '@manifesto-ai/vue/src/components/form/FormRenderer.vue'
import { userEditView } from './schemas/user-edit.view'
import { userEntity } from './schemas/user-edit.entity'

const handleSubmit = (data: Record<string, unknown>) => {
  console.log('Submit:', data)
}
</script>

<template>
  <FormRenderer
    :schema="userEditView"
    :entity-schema="userEntity"
    :initial-values="{ status: 'ACTIVE' }"
    :debug="true"
    @submit="handleSubmit"
  >
    <template #footer="{ isValid, isDirty, isSubmitting }">
      <button type="submit" :disabled="!isValid || isSubmitting">
        {{ isSubmitting ? 'Saving...' : 'Save' }}
      </button>
    </template>
  </FormRenderer>
</template>
```

---

## Debug mode

Enable `debug` prop to surface DebugPanel during development:

- Current form state (values)
- Field meta (hidden, disabled, errors)
- Live state changes

```vue
<FormRenderer :schema="view" :debug="true" />
```
