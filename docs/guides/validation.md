# Validation Patterns Guide

This guide covers form validation techniques in Manifesto, from basic field constraints to complex cross-field validation.

## Overview

Manifesto supports validation at two levels:

1. **Entity Schema**: Declarative constraints (required, min, max, pattern)
2. **View Schema**: Dynamic validation via reactions

---

## Basic Constraints

### Required Fields

```typescript
field.string('email', 'Email')
  .required('Email is required')
  .build()
```

### Length Constraints

```typescript
// For strings (character count)
field.string('username', 'Username')
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .build()

// For numbers (value)
field.number('age', 'Age')
  .min(0, 'Age cannot be negative')
  .max(150, 'Invalid age')
  .build()

// For arrays (item count)
field.array('tags', 'Tags', 'string')
  .min(1, 'At least one tag is required')
  .max(10, 'Maximum 10 tags allowed')
  .build()
```

### Pattern Validation

```typescript
// Email
field.string('email', 'Email')
  .pattern(
    '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    'Invalid email format'
  )
  .build()

// Phone number
field.string('phone', 'Phone')
  .pattern(
    '^\\+?[1-9]\\d{1,14}$',
    'Invalid phone format'
  )
  .build()

// URL
field.string('website', 'Website')
  .pattern(
    '^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)$',
    'Invalid URL format'
  )
  .build()

// Credit card
field.string('cardNumber', 'Card Number')
  .pattern(
    '^[0-9]{13,19}$',
    'Invalid card number'
  )
  .build()

// ZIP code (US)
field.string('zipCode', 'ZIP Code')
  .pattern(
    '^\\d{5}(-\\d{4})?$',
    'Invalid ZIP code'
  )
  .build()
```

---

## Custom Expression Validation

Use expressions for complex validation logic:

```typescript
field.string('username', 'Username')
  .constraint({
    type: 'custom',
    expression: ['NOT', ['IN', '$value', ['admin', 'root', 'system']]],
    message: 'This username is reserved',
  })
  .build()
```

### Custom Constraint Examples

```typescript
// Must start with letter
field.string('identifier', 'Identifier')
  .constraint({
    type: 'custom',
    expression: ['MATCH', '$value', '^[a-zA-Z]'],
    message: 'Must start with a letter',
  })
  .build()

// No consecutive spaces
field.string('name', 'Name')
  .constraint({
    type: 'custom',
    expression: ['NOT', ['CONTAINS', '$value', '  ']],
    message: 'Cannot contain consecutive spaces',
  })
  .build()

// Future date only
field.date('eventDate', 'Event Date')
  .constraint({
    type: 'custom',
    expression: ['>', '$value', ['TODAY']],
    message: 'Date must be in the future',
  })
  .build()

// Divisible by 5
field.number('quantity', 'Quantity')
  .constraint({
    type: 'custom',
    expression: ['==', ['%', '$value', 5], 0],
    message: 'Quantity must be divisible by 5',
  })
  .build()
```

---

## Cross-Field Validation

Validate based on other field values.

### Password Confirmation

```typescript
// Entity Schema
field.string('password', 'Password')
  .required()
  .min(8)
  .build(),

field.string('confirmPassword', 'Confirm Password')
  .required()
  .constraint({
    type: 'custom',
    expression: ['==', '$value', '$state.password'],
    message: 'Passwords do not match',
  })
  .build()
```

### Date Range Validation

```typescript
field.date('startDate', 'Start Date')
  .required()
  .build(),

field.date('endDate', 'End Date')
  .required()
  .constraint({
    type: 'custom',
    expression: ['>=', '$value', '$state.startDate'],
    message: 'End date must be after start date',
  })
  .build()
```

### Conditional Required

```typescript
// Tax ID required for business customers
field.string('taxId', 'Tax ID')
  .constraint({
    type: 'custom',
    expression: ['OR',
      ['!=', '$state.customerType', 'business'],
      ['AND',
        ['==', '$state.customerType', 'business'],
        ['!=', '$value', ''],
        ['!=', '$value', null]
      ]
    ],
    message: 'Tax ID is required for business customers',
  })
  .build()
```

---

## Real-Time Validation with Reactions

Validate on blur or change:

```typescript
viewField.textInput('email', 'email')
  .reaction(
    on.blur()
      .do(actions.validate(['email'], 'visible'))
  )
  .build()

// Validate related fields together
viewField.textInput('confirmPassword', 'confirmPassword')
  .dependsOn('password')
  .reaction(
    on.blur()
      .do(actions.validate(['password', 'confirmPassword'], 'visible'))
  )
  .build()
```

---

## Async Validation

For validation requiring API calls (e.g., username availability):

```typescript
viewField.textInput('username', 'username')
  .reaction(
    on.blur()
      .debounce(500)
      .when(['>=', ['LENGTH', '$state.username'], 3])
      .do(
        actions.emit('validate-username', {
          username: '$state.username'
        })
      )
  )
  .build()
```

Handle in component:

```tsx
const emitHandler = async (event: string, payload?: Record<string, unknown>) => {
  if (event === 'validate-username') {
    const response = await api.get(`/users/check-username/${payload?.username}`)
    if (!response.data.available) {
      // Set error manually
      setFieldError('username', 'Username is already taken')
    }
  }
}
```

---

## Form-Level Validation

Validate all fields before submission:

```typescript
footer: {
  actions: [
    {
      id: 'submit',
      label: 'Submit',
      variant: 'primary',
      disabled: ['NOT', '$form.isValid'],  // Disable if form invalid
      action: { type: 'submit' },
    },
  ],
}
```

### Custom Submission Validation

```tsx
const handleSubmit = async (data: Record<string, unknown>) => {
  // Additional validation before API call
  if (data.password !== data.confirmPassword) {
    toast.error('Passwords do not match')
    return
  }

  if (data.startDate > data.endDate) {
    toast.error('Invalid date range')
    return
  }

  await api.post('/submit', data)
}
```

---

## Error Display

Errors are automatically tracked in field metadata:

```typescript
interface FieldMeta {
  id: string
  errors: string[]  // Validation errors
  // ...
}
```

### Accessing Errors (React)

```tsx
const { getFieldMeta } = useFormRuntime(schema, options)

const meta = getFieldMeta('email')
if (meta?.errors.length > 0) {
  console.log('Errors:', meta.errors)
}
```

### Custom Error Display

```tsx
function Field({ fieldId, children }) {
  const { getFieldMeta } = useFormRuntime(schema, options)
  const meta = getFieldMeta(fieldId)

  return (
    <div className="field">
      {children}
      {meta?.errors.map((error, i) => (
        <span key={i} className="error text-red-500 text-sm">
          {error}
        </span>
      ))}
    </div>
  )
}
```

---

## Common Validation Patterns

### Email

```typescript
field.string('email', 'Email')
  .required()
  .pattern(
    '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    'Invalid email format'
  )
  .build()
```

### Strong Password

```typescript
field.string('password', 'Password')
  .required()
  .min(8, 'Password must be at least 8 characters')
  .pattern(
    '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]',
    'Password must include uppercase, lowercase, number, and special character'
  )
  .build()
```

### Phone Number

```typescript
field.string('phone', 'Phone')
  .pattern(
    '^(\\+\\d{1,3}[- ]?)?\\(?\\d{3}\\)?[- ]?\\d{3}[- ]?\\d{4}$',
    'Invalid phone number'
  )
  .build()
```

### Credit Card

```typescript
field.string('cardNumber', 'Card Number')
  .required()
  .pattern('^[0-9]{13,19}$', 'Invalid card number')
  .constraint({
    type: 'custom',
    expression: ['LUHN_CHECK', '$value'],  // Custom operator for Luhn algorithm
    message: 'Invalid card number',
  })
  .build()
```

### Age Verification

```typescript
field.date('birthDate', 'Birth Date')
  .required()
  .constraint({
    type: 'custom',
    expression: ['>=', ['DATE_DIFF', ['TODAY'], '$value', 'years'], 18],
    message: 'Must be at least 18 years old',
  })
  .build()
```

---

## Validation Modes

### Silent Validation

Validate without showing errors (for real-time checks):

```typescript
on.change()
  .do(actions.validate(['email'], 'silent'))
```

### Visible Validation

Validate and display errors (for blur/submit):

```typescript
on.blur()
  .do(actions.validate(['email'], 'visible'))
```

---

## Best Practices

1. **Validate early**: Show errors on blur, not just on submit

2. **Use appropriate messages**: Be specific about what's wrong

3. **Match frontend and backend**: Keep validation rules in sync

4. **Prioritize UX**: Don't over-validate trivial inputs

5. **Handle async gracefully**: Show loading states during async validation

6. **Group related validations**: Validate password and confirm together

7. **Debounce expensive validation**: Avoid API calls on every keystroke

8. **Test edge cases**: Empty strings, null values, boundary conditions

---

## Complete Example

```typescript
import { field, enumValue } from '@manifesto-ai/schema'

export const registrationEntity = {
  _type: 'entity' as const,
  id: 'registration',
  name: 'User Registration',
  version: '1.0.0',

  fields: [
    // Username
    field.string('username', 'Username')
      .required('Username is required')
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be at most 20 characters')
      .pattern('^[a-zA-Z][a-zA-Z0-9_]*$', 'Username must start with a letter')
      .constraint({
        type: 'custom',
        expression: ['NOT', ['IN', '$value', ['admin', 'root', 'system']]],
        message: 'This username is reserved',
      })
      .build(),

    // Email
    field.string('email', 'Email')
      .required('Email is required')
      .pattern(
        '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        'Invalid email format'
      )
      .build(),

    // Password
    field.string('password', 'Password')
      .required('Password is required')
      .min(8, 'Password must be at least 8 characters')
      .pattern(
        '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)',
        'Password must include uppercase, lowercase, and number'
      )
      .build(),

    // Confirm Password
    field.string('confirmPassword', 'Confirm Password')
      .required('Please confirm your password')
      .constraint({
        type: 'custom',
        expression: ['==', '$value', '$state.password'],
        message: 'Passwords do not match',
      })
      .build(),

    // Birth Date
    field.date('birthDate', 'Birth Date')
      .required('Birth date is required')
      .constraint({
        type: 'custom',
        expression: ['>=', ['DATE_DIFF', ['TODAY'], '$value', 'years'], 13],
        message: 'You must be at least 13 years old',
      })
      .build(),

    // Terms
    field.boolean('acceptTerms', 'Accept Terms')
      .constraint({
        type: 'custom',
        expression: ['==', '$value', true],
        message: 'You must accept the terms and conditions',
      })
      .build(),
  ],
}
```

---

[Back to Guides](../README.md) | [Previous: Cascade Select](./cascade-select.md) | [Next: Legacy Integration](./legacy-integration.md)
