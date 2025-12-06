# Reaction DSL Reference

The Reaction DSL defines **event-driven interactions** between fields. It allows you to create dynamic, responsive forms where fields react to user input and other events.

## Table of Contents

- [Overview](#overview)
- [Reaction Structure](#reaction-structure)
- [Triggers](#triggers)
- [Conditions](#conditions)
- [Actions](#actions)
- [Data Sources](#data-sources)
- [Timing Control](#timing-control)
- [Builder API](#builder-api)
- [Common Patterns](#common-patterns)
- [Complete Examples](#complete-examples)

---

## Overview

Reactions enable dynamic form behavior without writing imperative code. When a trigger event occurs, the reaction evaluates a condition and executes actions.

```typescript
import { on, actions } from '@manifesto-ai/schema'

// When country changes, clear the city field
const reaction = on.change()
  .when(['!=', '$state.country', null])
  .do(actions.setValue('city', null))
```

**Flow:**
```
Event (trigger) → Condition check → Actions executed
```

---

## Reaction Structure

```typescript
interface Reaction {
  readonly trigger: 'change' | 'blur' | 'focus' | 'mount' | 'unmount'
  readonly condition?: Expression
  readonly actions: readonly ReactionAction[]
  readonly debounce?: number
  readonly throttle?: number
}
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `trigger` | `string` | Yes | Event that triggers the reaction |
| `condition` | `Expression` | No | Condition to check before executing |
| `actions` | `ReactionAction[]` | Yes | Actions to execute |
| `debounce` | `number` | No | Debounce delay in ms |
| `throttle` | `number` | No | Throttle interval in ms |

---

## Triggers

Triggers define when a reaction should fire.

### change

Fires when the field value changes.

```typescript
on.change().do(actions.setValue('total', ['*', '$state.quantity', '$state.price']))
```

### blur

Fires when the field loses focus.

```typescript
on.blur().do(actions.validate(['email'], 'visible'))
```

### focus

Fires when the field receives focus.

```typescript
on.focus().do(actions.emit('field-focused', { field: 'email' }))
```

### mount

Fires when the field is mounted (first rendered).

```typescript
on.mount()
  .when(['==', '$state.country', null])
  .do(actions.setOptions('country', dataSource.api('/api/countries')))
```

### unmount

Fires when the field is unmounted (removed from DOM).

```typescript
on.unmount().do(actions.emit('field-removed', { field: 'dynamicField' }))
```

---

## Conditions

Conditions use the Expression DSL to determine if actions should execute.

### Basic Conditions

```typescript
// Execute only if value is not null
on.change()
  .when(['!=', '$state.country', null])
  .do(...)

// Execute only if value matches
on.change()
  .when(['==', '$state.paymentMethod', 'credit_card'])
  .do(...)
```

### Complex Conditions

```typescript
// Multiple conditions with AND
on.change()
  .when(['AND',
    ['!=', '$state.country', null],
    ['>', '$state.amount', 100]
  ])
  .do(...)

// Nested conditions
on.change()
  .when(['OR',
    ['==', '$state.type', 'premium'],
    ['AND',
      ['==', '$state.type', 'standard'],
      ['>', '$state.years', 5]
    ]
  ])
  .do(...)
```

### Without Condition

If no condition is specified, actions always execute when the trigger fires.

```typescript
// Always recalculate total on quantity change
on.change().do(actions.setValue('total', ['*', '$state.quantity', '$state.price']))
```

---

## Actions

Actions define what happens when a reaction fires.

### setValue

Sets a field's value.

```typescript
import { actions } from '@manifesto-ai/schema'

// Set static value
actions.setValue('city', null)

// Set calculated value
actions.setValue('total', ['*', '$state.quantity', '$state.price'])

// Set from context
actions.setValue('userId', '$context.user.id')
```

### setOptions

Dynamically sets a field's options (for select, multi-select, radio).

```typescript
import { dataSource } from '@manifesto-ai/schema'

// From static values
actions.setOptions('status', dataSource.static([
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]))

// From API
actions.setOptions('cities', dataSource.api('/api/cities', {
  params: { country: '$state.country' }
}))

// From derived expression
actions.setOptions('years', dataSource.derived(
  ['MAP', ['RANGE', 2020, 2030], ['OBJECT', ['value', '$item'], ['label', ['TO_STRING', '$item']]]]
))
```

### updateProp

Updates a field's prop (hidden, disabled, or custom).

```typescript
// Hide a field
actions.updateProp('shippingAddress', 'hidden', true)

// Conditional hide
actions.updateProp('shippingAddress', 'hidden', ['==', '$state.sameAsBilling', true])

// Disable a field
actions.updateProp('city', 'disabled', ['==', '$state.country', null])

// Update custom prop
actions.updateProp('price', 'prefix', ['IF', ['==', '$state.currency', 'USD'], '$', ['IF', ['==', '$state.currency', 'EUR'], '\u20ac', '\u00a5']])
```

### validate

Triggers validation for specific fields or all fields.

```typescript
// Validate specific fields
actions.validate(['email', 'phone'], 'visible')

// Validate all fields silently
actions.validate(undefined, 'silent')

// Validate with visible errors
actions.validate(['username'], 'visible')
```

**Modes:**
- `'visible'`: Shows validation errors to user
- `'silent'`: Validates without showing errors

### navigate

Navigates to a different page/route.

```typescript
// Simple navigation
actions.navigate('/products')

// With parameters
actions.navigate('/products/:id', { id: '$state.productId' })
```

### emit

Emits a custom event for external handling.

```typescript
// Simple event
actions.emit('field-changed')

// Event with payload
actions.emit('product-selected', {
  productId: '$state.productId',
  quantity: '$state.quantity'
})
```

---

## Data Sources

Data sources define where options come from for `setOptions`.

### Static Data Source

Hardcoded options.

```typescript
import { dataSource } from '@manifesto-ai/schema'

dataSource.static([
  { value: 'low', label: 'Low Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'high', label: 'High Priority' },
])
```

### API Data Source

Options fetched from an API.

```typescript
dataSource.api('/api/cities', {
  method: 'GET',  // or 'POST'
  params: {
    country: '$state.country',
    limit: 100
  },
  transform: {
    path: 'data.cities',  // JSON path to array
    map: {
      value: 'id',        // Field for option value
      label: 'name'       // Field for option label
    }
  }
})
```

### Derived Data Source

Options computed from expressions.

```typescript
// Generate year options
dataSource.derived([
  'MAP',
  ['RANGE', 2020, 2030],
  ['OBJECT', ['value', '$item'], ['label', ['TO_STRING', '$item']]]
])

// Filter existing options
dataSource.derived([
  'FILTER',
  '$context.allProducts',
  ['==', ['GET', '$item', 'category'], '$state.category']
])
```

---

## Timing Control

Control when reactions execute with debounce and throttle.

### Debounce

Wait for a pause in events before executing. Good for search/autocomplete.

```typescript
on.change()
  .debounce(300)  // Wait 300ms after last change
  .do(actions.setOptions('suggestions',
    dataSource.api('/api/search', { params: { q: '$state.query' } })
  ))
```

### Throttle

Execute at most once per interval. Good for expensive operations.

```typescript
on.change()
  .throttle(1000)  // At most once per second
  .do(actions.emit('value-changed', { value: '$state.amount' }))
```

---

## Builder API

The `on` builder provides a fluent API for creating reactions.

### ReactionBuilder Interface

```typescript
interface ReactionBuilder {
  when(condition: Expression): ReactionBuilder
  debounce(ms: number): ReactionBuilder
  throttle(ms: number): ReactionBuilder
  do(...actions: ReactionAction[]): Reaction
}
```

### Trigger Constructors

```typescript
import { on } from '@manifesto-ai/schema'

on.change()   // Value change event
on.blur()     // Focus lost event
on.focus()    // Focus gained event
on.mount()    // Component mounted
on.unmount()  // Component unmounted
```

### Chaining Example

```typescript
const reaction = on.change()
  .when(['!=', '$state.country', null])
  .debounce(300)
  .do(
    actions.setValue('city', null),
    actions.setOptions('cities',
      dataSource.api('/api/cities', { params: { country: '$state.country' } })
    )
  )
```

---

## Common Patterns

### Cascade Select (Country → City)

```typescript
// Country field
viewField.select('country', 'country')
  .reaction(
    on.change()
      .do(
        actions.setValue('city', null),
        actions.setValue('district', null)
      )
  )
  .build()

// City field
viewField.select('city', 'city')
  .dependsOn('country')
  .reaction(
    on.mount()
      .when(['!=', '$state.country', null])
      .do(
        actions.setOptions('city',
          dataSource.api('/api/cities', { params: { countryId: '$state.country' } })
        )
      )
  )
  .reaction(
    on.change()
      .do(actions.setValue('district', null))
  )
  .disabled(['==', '$state.country', null])
  .build()
```

### Calculated Field

```typescript
// Quantity field
viewField.numberInput('quantity', 'quantity')
  .reaction(
    on.change()
      .do(
        actions.setValue('subtotal', ['*', '$state.quantity', '$state.unitPrice']),
        actions.setValue('tax', ['*', ['*', '$state.quantity', '$state.unitPrice'], 0.1]),
        actions.setValue('total', ['*', ['*', '$state.quantity', '$state.unitPrice'], 1.1])
      )
  )
  .build()
```

### Conditional Visibility

```typescript
viewField.select('paymentMethod', 'paymentMethod')
  .reaction(
    on.change()
      .do(
        // Show/hide credit card fields
        actions.updateProp('cardNumber', 'hidden',
          ['!=', '$state.paymentMethod', 'credit_card']
        ),
        actions.updateProp('cardExpiry', 'hidden',
          ['!=', '$state.paymentMethod', 'credit_card']
        ),
        actions.updateProp('cardCvv', 'hidden',
          ['!=', '$state.paymentMethod', 'credit_card']
        ),
        // Show/hide bank account fields
        actions.updateProp('bankAccount', 'hidden',
          ['!=', '$state.paymentMethod', 'bank_transfer']
        )
      )
  )
  .build()
```

### Search with Debounce

```typescript
viewField.textInput('search', 'searchQuery')
  .reaction(
    on.change()
      .debounce(300)
      .when(['>=', ['LENGTH', '$state.searchQuery'], 2])
      .do(
        actions.setOptions('searchResults',
          dataSource.api('/api/search', {
            params: { q: '$state.searchQuery' }
          })
        )
      )
  )
  .build()
```

### Cross-Field Validation

```typescript
viewField.textInput('confirmPassword', 'confirmPassword')
  .reaction(
    on.blur()
      .when(['AND',
        ['!=', '$state.password', ''],
        ['!=', '$state.confirmPassword', '']
      ])
      .do(
        actions.updateProp('confirmPassword', 'error',
          ['IF',
            ['!=', '$state.password', '$state.confirmPassword'],
            'Passwords do not match',
            null
          ]
        )
      )
  )
  .build()
```

### Initialize on Mount

```typescript
viewField.select('category', 'category')
  .reaction(
    on.mount()
      .do(
        actions.setOptions('category',
          dataSource.api('/api/categories')
        )
      )
  )
  .build()
```

---

## Complete Examples

### Order Form with Calculations

```typescript
import { viewField, on, actions, dataSource } from '@manifesto-ai/schema'

const orderFormFields = [
  // Product selection
  viewField.select('product', 'productId')
    .reaction(
      on.change()
        .when(['!=', '$state.productId', null])
        .do(
          // Fetch product details and set unit price
          actions.emit('product-selected', { productId: '$state.productId' })
        )
    )
    .build(),

  // Quantity
  viewField.numberInput('quantity', 'quantity')
    .props({ min: 1 })
    .reaction(
      on.change()
        .do(
          actions.setValue('subtotal', ['*', '$state.quantity', '$state.unitPrice']),
          actions.setValue('tax', ['ROUND', ['*', '$state.subtotal', 0.1], 2]),
          actions.setValue('total', ['+', '$state.subtotal', '$state.tax'])
        )
    )
    .build(),

  // Unit price (read-only, set by product selection)
  viewField.numberInput('unitPrice', 'unitPrice')
    .props({ readOnly: true, prefix: '$' })
    .build(),

  // Subtotal
  viewField.numberInput('subtotal', 'subtotal')
    .props({ readOnly: true, prefix: '$' })
    .build(),

  // Tax
  viewField.numberInput('tax', 'tax')
    .props({ readOnly: true, prefix: '$' })
    .build(),

  // Total
  viewField.numberInput('total', 'total')
    .props({ readOnly: true, prefix: '$' })
    .styles({ className: 'total-highlight' })
    .build(),
]
```

### Address Form with Cascade Selects

```typescript
const addressFields = [
  // Country
  viewField.select('country', 'countryId')
    .placeholder('Select country')
    .reaction(
      on.mount()
        .do(
          actions.setOptions('country', dataSource.api('/api/countries'))
        )
    )
    .reaction(
      on.change()
        .do(
          actions.setValue('state', null),
          actions.setValue('city', null),
          actions.updateProp('state', 'disabled', ['==', '$state.countryId', null])
        )
    )
    .build(),

  // State/Province
  viewField.select('state', 'stateId')
    .placeholder('Select state')
    .dependsOn('countryId')
    .reaction(
      on.mount()
        .when(['!=', '$state.countryId', null])
        .do(
          actions.setOptions('state',
            dataSource.api('/api/states', { params: { countryId: '$state.countryId' } })
          )
        )
    )
    .reaction(
      on.change()
        .do(
          actions.setValue('city', null),
          actions.updateProp('city', 'disabled', ['==', '$state.stateId', null])
        )
    )
    .disabled(['==', '$state.countryId', null])
    .build(),

  // City
  viewField.select('city', 'cityId')
    .placeholder('Select city')
    .dependsOn('stateId')
    .reaction(
      on.mount()
        .when(['!=', '$state.stateId', null])
        .do(
          actions.setOptions('city',
            dataSource.api('/api/cities', { params: { stateId: '$state.stateId' } })
          )
        )
    )
    .disabled(['==', '$state.stateId', null])
    .build(),

  // ZIP Code
  viewField.textInput('zipCode', 'zipCode')
    .placeholder('ZIP / Postal code')
    .reaction(
      on.blur()
        .when(['>=', ['LENGTH', '$state.zipCode'], 3])
        .debounce(500)
        .do(
          actions.emit('validate-zip', {
            zipCode: '$state.zipCode',
            countryId: '$state.countryId'
          })
        )
    )
    .build(),
]
```

---

## Best Practices

1. **Declare dependencies**: Always use `dependsOn` when a field's behavior depends on another field's value

2. **Use debounce for API calls**: Prevent excessive API calls during typing

3. **Keep reactions focused**: Each reaction should do one thing well

4. **Order matters**: Actions execute in order, so place dependent actions after their dependencies

5. **Handle null states**: Always check for null values in conditions to prevent errors

6. **Use silent validation**: Use `'silent'` mode when validating during form initialization

7. **Clean up on unmount**: If you set up external listeners, clean them up in unmount reactions

---

[Back to Schema Reference](../README.md) | [Previous: View Schema](./view-schema.md) | [Next: Action Schema](./action-schema.md)
