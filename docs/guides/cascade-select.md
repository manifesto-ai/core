# Cascade Select Guide

This guide shows how to implement cascading (dependent) dropdowns, where selecting a value in one field updates the options in another.

## Overview

Common use cases:
- Country > State > City
- Category > Subcategory
- Make > Model > Year
- Department > Employee

---

## Basic Pattern

When a parent field changes:
1. Clear the child field value
2. Load new options for the child field
3. Disable child until parent has value

---

## Static Options Example

### Entity Schema

```typescript
import { field, enumValue } from '@manifesto-ai/schema'

export const addressEntity = {
  _type: 'entity' as const,
  id: 'address',
  name: 'Address',
  version: '1.0.0',

  fields: [
    field.enum('country', 'Country', [
      enumValue('us', 'United States'),
      enumValue('ca', 'Canada'),
      enumValue('uk', 'United Kingdom'),
    ]).required().build(),

    field.string('state', 'State/Province').required().build(),
    field.string('city', 'City').required().build(),
  ],
}
```

### View Schema with Static Data

```typescript
import { viewField, on, actions, dataSource } from '@manifesto-ai/schema'

// Static data for states
const statesByCountry = {
  us: [
    { value: 'CA', label: 'California' },
    { value: 'NY', label: 'New York' },
    { value: 'TX', label: 'Texas' },
  ],
  ca: [
    { value: 'ON', label: 'Ontario' },
    { value: 'QC', label: 'Quebec' },
    { value: 'BC', label: 'British Columbia' },
  ],
  uk: [
    { value: 'ENG', label: 'England' },
    { value: 'SCT', label: 'Scotland' },
    { value: 'WLS', label: 'Wales' },
  ],
}

export const addressView = {
  _type: 'view' as const,
  id: 'address-form',
  name: 'Address Form',
  version: '1.0.0',
  entityRef: 'address',
  mode: 'create' as const,
  layout: { type: 'form' as const },

  sections: [{
    id: 'location',
    title: 'Location',
    layout: { type: 'form' as const },
    fields: [
      // Country (parent)
      viewField.select('country', 'country')
        .placeholder('Select country')
        .reaction(
          on.change()
            .do(
              // Clear dependent fields
              actions.setValue('state', null),
              actions.setValue('city', null),
              // Update state options based on country
              actions.setOptions('state',
                dataSource.derived([
                  'GET', statesByCountry, '$state.country'
                ])
              )
            )
        )
        .build(),

      // State (child of country)
      viewField.select('state', 'state')
        .placeholder('Select state')
        .dependsOn('country')
        .disabled(['==', '$state.country', null])
        .reaction(
          on.change()
            .do(
              // Clear city when state changes
              actions.setValue('city', null)
            )
        )
        .build(),

      // City (child of state)
      viewField.textInput('city', 'city')
        .placeholder('Enter city')
        .dependsOn('state')
        .disabled(['==', '$state.state', null])
        .build(),
    ],
  }],
}
```

---

## API-Based Options

Load options from an API when parent changes.

### View Schema with API

```typescript
import { viewField, on, actions, dataSource } from '@manifesto-ai/schema'

export const addressView = {
  _type: 'view' as const,
  id: 'address-form',
  name: 'Address Form',
  version: '1.0.0',
  entityRef: 'address',
  mode: 'create' as const,
  layout: { type: 'form' as const },

  sections: [{
    id: 'location',
    title: 'Location',
    layout: { type: 'form' as const },
    fields: [
      // Country
      viewField.select('country', 'country')
        .placeholder('Select country')
        .reaction(
          // Load countries on mount
          on.mount()
            .do(
              actions.setOptions('country',
                dataSource.api('/api/countries', {
                  transform: {
                    path: 'data',
                    map: { value: 'code', label: 'name' }
                  }
                })
              )
            )
        )
        .reaction(
          // Clear children on change
          on.change()
            .do(
              actions.setValue('state', null),
              actions.setValue('city', null)
            )
        )
        .build(),

      // State
      viewField.select('state', 'state')
        .placeholder('Select state')
        .dependsOn('country')
        .disabled(['==', '$state.country', null])
        .reaction(
          // Load states when country is selected
          on.mount()
            .when(['!=', '$state.country', null])
            .do(
              actions.setOptions('state',
                dataSource.api('/api/states', {
                  params: { countryCode: '$state.country' },
                  transform: {
                    path: 'data',
                    map: { value: 'code', label: 'name' }
                  }
                })
              )
            )
        )
        .reaction(
          on.change()
            .do(actions.setValue('city', null))
        )
        .build(),

      // City
      viewField.select('city', 'city')
        .placeholder('Select city')
        .dependsOn('state')
        .disabled(['==', '$state.state', null])
        .reaction(
          on.mount()
            .when(['!=', '$state.state', null])
            .do(
              actions.setOptions('city',
                dataSource.api('/api/cities', {
                  params: {
                    countryCode: '$state.country',
                    stateCode: '$state.state'
                  },
                  transform: {
                    path: 'data',
                    map: { value: 'id', label: 'name' }
                  }
                })
              )
            )
        )
        .build(),
    ],
  }],
}
```

### Fetch Handler Setup

```tsx
// React
<FormRenderer
  schema={addressView}
  entitySchema={addressEntity}
  fetchHandler={async (endpoint, options) => {
    const response = await fetch(endpoint, {
      method: options.method || 'GET',
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: { 'Content-Type': 'application/json' },
    })
    return response.json()
  }}
  onSubmit={handleSubmit}
/>
```

---

## Three-Level Cascade Example

Category > Subcategory > Product cascade:

```typescript
import { viewField, on, actions, dataSource } from '@manifesto-ai/schema'

export const productSelectorView = {
  _type: 'view' as const,
  id: 'product-selector',
  name: 'Product Selector',
  version: '1.0.0',
  entityRef: 'order',
  mode: 'create' as const,
  layout: { type: 'form' as const },

  sections: [{
    id: 'product',
    title: 'Select Product',
    layout: { type: 'grid' as const, columns: 3 },
    fields: [
      // Level 1: Category
      viewField.select('category', 'categoryId')
        .placeholder('Select category')
        .reaction(
          on.mount().do(
            actions.setOptions('category',
              dataSource.api('/api/categories')
            )
          )
        )
        .reaction(
          on.change().do(
            actions.setValue('subcategory', null),
            actions.setValue('product', null)
          )
        )
        .build(),

      // Level 2: Subcategory
      viewField.select('subcategory', 'subcategoryId')
        .placeholder('Select subcategory')
        .dependsOn('category')
        .disabled(['==', '$state.category', null])
        .reaction(
          on.mount()
            .when(['!=', '$state.category', null])
            .do(
              actions.setOptions('subcategory',
                dataSource.api('/api/subcategories', {
                  params: { categoryId: '$state.category' }
                })
              )
            )
        )
        .reaction(
          on.change().do(
            actions.setValue('product', null)
          )
        )
        .build(),

      // Level 3: Product
      viewField.select('product', 'productId')
        .placeholder('Select product')
        .dependsOn('subcategory')
        .disabled(['==', '$state.subcategory', null])
        .reaction(
          on.mount()
            .when(['!=', '$state.subcategory', null])
            .do(
              actions.setOptions('product',
                dataSource.api('/api/products', {
                  params: { subcategoryId: '$state.subcategory' }
                })
              )
            )
        )
        .build(),
    ],
  }],
}
```

---

## With Search/Autocomplete

For large datasets, use autocomplete with debounce:

```typescript
viewField.autocomplete('city', 'cityId')
  .placeholder('Search city...')
  .dependsOn('state')
  .disabled(['==', '$state.state', null])
  .reaction(
    on.change()
      .debounce(300)  // Wait 300ms after typing
      .when(['>=', ['LENGTH', '$state.citySearch'], 2])
      .do(
        actions.setOptions('city',
          dataSource.api('/api/cities/search', {
            params: {
              stateId: '$state.state',
              query: '$state.citySearch'
            }
          })
        )
      )
  )
  .build()
```

---

## Edit Mode: Pre-populating Cascades

When editing existing data, load options for all levels:

```typescript
const addressView = {
  // ...
  sections: [{
    id: 'location',
    fields: [
      viewField.select('country', 'country')
        .reaction(
          on.mount().do(
            actions.setOptions('country', dataSource.api('/api/countries'))
          )
        )
        .reaction(
          on.change().do(
            actions.setValue('state', null),
            actions.setValue('city', null)
          )
        )
        .build(),

      viewField.select('state', 'state')
        .dependsOn('country')
        .disabled(['==', '$state.country', null])
        .reaction(
          // Load states on mount if country has value (edit mode)
          on.mount()
            .when(['!=', '$state.country', null])
            .do(
              actions.setOptions('state',
                dataSource.api('/api/states', {
                  params: { countryCode: '$state.country' }
                })
              )
            )
        )
        .reaction(
          on.change().do(actions.setValue('city', null))
        )
        .build(),

      viewField.select('city', 'city')
        .dependsOn('state')
        .disabled(['==', '$state.state', null])
        .reaction(
          // Load cities on mount if state has value (edit mode)
          on.mount()
            .when(['!=', '$state.state', null])
            .do(
              actions.setOptions('city',
                dataSource.api('/api/cities', {
                  params: { stateCode: '$state.state' }
                })
              )
            )
        )
        .build(),
    ],
  }],
}
```

---

## Best Practices

1. **Clear child values**: Always reset child fields when parent changes

2. **Use dependsOn**: Declare dependencies for proper re-evaluation

3. **Disable when empty**: Disable children until parent has a value

4. **Handle loading states**: Show loading indicator during API calls

5. **Debounce searches**: For autocomplete fields, debounce API calls

6. **Cache API responses**: Consider caching frequently-used options

7. **Show placeholders**: Use meaningful placeholders to guide users

8. **Handle edit mode**: Pre-load all cascade levels when editing

---

## Complete Component Example (React)

```tsx
import { useState } from 'react'
import { FormRenderer } from '@manifesto-ai/react'
import { addressView, addressEntity } from './schemas/address'

export function AddressForm() {
  const [isLoading, setIsLoading] = useState(false)

  const fetchHandler = async (endpoint: string, options: any) => {
    setIsLoading(true)
    try {
      const url = new URL(endpoint, window.location.origin)
      if (options.params) {
        Object.entries(options.params).forEach(([key, value]) => {
          if (value) url.searchParams.append(key, String(value))
        })
      }

      const response = await fetch(url.toString())
      return response.json()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative">
      <FormRenderer
        schema={addressView}
        entitySchema={addressEntity}
        fetchHandler={fetchHandler}
        onSubmit={console.log}
      />

      {isLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          Loading...
        </div>
      )}
    </div>
  )
}
```

---

[Back to Guides](../README.md) | [Previous: Dynamic Conditions](./dynamic-conditions.md) | [Next: Validation](./validation.md)
