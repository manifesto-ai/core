# Dynamic Conditions Guide

This guide explains how to create forms with fields that show, hide, or change based on other field values.

## Overview

Manifesto supports dynamic conditions using the Expression DSL. You can:

- Hide/show fields based on values
- Disable/enable fields conditionally
- Change field properties dynamically
- Create complex multi-condition logic

---

## Basic Hidden Condition

Show a field only when a condition is met.

### Using ViewField Builder

```typescript
viewField.textInput('company', 'company')
  .hidden(['!=', '$state.subject', 'sales'])
  .build()
```

This shows the "company" field only when the "subject" field equals "sales".

### Using Reaction

```typescript
viewField.textInput('company', 'company')
  .reaction(
    on.change()
      .do(
        actions.updateProp('company', 'hidden',
          ['!=', '$state.subject', 'sales']
        )
      )
  )
  .build()
```

---

## Common Patterns

### Show Field When Value Selected

```typescript
// Show shipping fields for physical products
viewField.textInput('shippingAddress', 'shippingAddress')
  .hidden(['==', '$state.productType', 'digital'])
  .build()
```

### Show Field When Checkbox Checked

```typescript
// Show custom message when "other" is selected
viewField.textarea('customMessage', 'customMessage')
  .hidden(['NOT', '$state.includeCustomMessage'])
  .build()
```

### Show Field When Value Not Empty

```typescript
// Show confirmation field when password entered
viewField.textInput('confirmPassword', 'confirmPassword')
  .hidden(['==', '$state.password', ''])
  .build()
```

---

## Multiple Conditions

### AND Condition

Show field when ALL conditions are true:

```typescript
// Show field when both premium AND annual subscription
viewField.numberInput('discount', 'discount')
  .hidden(['NOT', ['AND',
    ['==', '$state.tier', 'premium'],
    ['==', '$state.billingCycle', 'annual']
  ]])
  .build()
```

### OR Condition

Show field when ANY condition is true:

```typescript
// Show field for either admin or manager role
viewField.select('permissions', 'permissions')
  .hidden(['NOT', ['OR',
    ['==', '$context.user.role', 'admin'],
    ['==', '$context.user.role', 'manager']
  ]])
  .build()
```

### Nested Conditions

```typescript
// Complex business logic
viewField.numberInput('expeditedFee', 'expeditedFee')
  .hidden(['NOT', ['AND',
    ['==', '$state.isExpedited', true],
    ['OR',
      ['>', '$state.weight', 10],
      ['==', '$state.destination', 'international']
    ]
  ]])
  .build()
```

---

## Disable vs Hide

### Hidden

Field is removed from the form (value not submitted):

```typescript
viewField.textInput('taxId', 'taxId')
  .hidden(['!=', '$state.customerType', 'business'])
  .build()
```

### Disabled

Field is visible but not editable:

```typescript
viewField.textInput('email', 'email')
  .disabled(['==', '$context.params.mode', 'view'])
  .build()
```

---

## Section-Level Conditions

Hide entire sections:

```typescript
{
  id: 'shipping',
  title: 'Shipping Information',
  layout: { type: 'grid', columns: 2 },
  visible: ['!=', '$state.deliveryMethod', 'digital'],
  fields: [
    viewField.textInput('address', 'address').build(),
    viewField.textInput('city', 'city').build(),
    viewField.textInput('zipCode', 'zipCode').build(),
  ],
}
```

---

## Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `==` | Equal | `['==', '$state.status', 'active']` |
| `!=` | Not equal | `['!=', '$state.status', 'deleted']` |
| `>` | Greater than | `['>', '$state.amount', 100]` |
| `>=` | Greater or equal | `['>=', '$state.quantity', 1]` |
| `<` | Less than | `['<', '$state.age', 18]` |
| `<=` | Less or equal | `['<=', '$state.stock', 10]` |
| `IN` | In array | `['IN', '$state.role', ['admin', 'manager']]` |
| `NOT_IN` | Not in array | `['NOT_IN', '$state.status', ['deleted', 'archived']]` |

---

## Logical Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `AND` | All true | `['AND', expr1, expr2]` |
| `OR` | Any true | `['OR', expr1, expr2]` |
| `NOT` | Negate | `['NOT', expr]` |

---

## Complete Example: Order Form

```typescript
import { viewField, on, actions } from '@manifesto-ai/schema'

export const orderView = {
  _type: 'view' as const,
  id: 'order-form',
  name: 'Order Form',
  version: '1.0.0',
  entityRef: 'order',
  mode: 'create' as const,
  layout: { type: 'form' as const },

  sections: [
    // Customer Type
    {
      id: 'customer',
      title: 'Customer Information',
      layout: { type: 'form' as const },
      fields: [
        viewField.radio('customerType', 'customerType')
          .props({ direction: 'horizontal' })
          .build(),

        // Personal fields
        viewField.textInput('firstName', 'firstName')
          .hidden(['==', '$state.customerType', 'business'])
          .build(),

        viewField.textInput('lastName', 'lastName')
          .hidden(['==', '$state.customerType', 'business'])
          .build(),

        // Business fields
        viewField.textInput('companyName', 'companyName')
          .hidden(['!=', '$state.customerType', 'business'])
          .build(),

        viewField.textInput('taxId', 'taxId')
          .hidden(['!=', '$state.customerType', 'business'])
          .build(),
      ],
    },

    // Delivery Options
    {
      id: 'delivery',
      title: 'Delivery',
      layout: { type: 'form' as const },
      fields: [
        viewField.radio('deliveryMethod', 'deliveryMethod')
          .build(),

        // Show address fields only for shipping
        viewField.textInput('address', 'address')
          .hidden(['!=', '$state.deliveryMethod', 'shipping'])
          .build(),

        viewField.textInput('city', 'city')
          .hidden(['!=', '$state.deliveryMethod', 'shipping'])
          .build(),

        viewField.textInput('zipCode', 'zipCode')
          .hidden(['!=', '$state.deliveryMethod', 'shipping'])
          .build(),

        // Show pickup location for pickup
        viewField.select('pickupLocation', 'pickupLocation')
          .hidden(['!=', '$state.deliveryMethod', 'pickup'])
          .build(),
      ],
    },

    // Payment
    {
      id: 'payment',
      title: 'Payment',
      layout: { type: 'form' as const },
      fields: [
        viewField.radio('paymentMethod', 'paymentMethod')
          .build(),

        // Credit card fields
        viewField.textInput('cardNumber', 'cardNumber')
          .hidden(['!=', '$state.paymentMethod', 'credit_card'])
          .build(),

        viewField.textInput('cardExpiry', 'cardExpiry')
          .hidden(['!=', '$state.paymentMethod', 'credit_card'])
          .build(),

        viewField.textInput('cardCvv', 'cardCvv')
          .hidden(['!=', '$state.paymentMethod', 'credit_card'])
          .build(),

        // Bank transfer fields
        viewField.textInput('bankAccount', 'bankAccount')
          .hidden(['!=', '$state.paymentMethod', 'bank_transfer'])
          .build(),

        // PO Number for business customers with invoice payment
        viewField.textInput('poNumber', 'poNumber')
          .hidden(['NOT', ['AND',
            ['==', '$state.customerType', 'business'],
            ['==', '$state.paymentMethod', 'invoice']
          ]])
          .build(),
      ],
    },

    // Additional Options
    {
      id: 'options',
      title: 'Additional Options',
      layout: { type: 'form' as const },
      fields: [
        viewField.checkbox('isGift', 'isGift')
          .label('This is a gift')
          .build(),

        // Gift options shown only when isGift is checked
        viewField.textInput('giftMessage', 'giftMessage')
          .placeholder('Enter gift message')
          .hidden(['NOT', '$state.isGift'])
          .build(),

        viewField.checkbox('giftWrap', 'giftWrap')
          .label('Add gift wrapping (+$5)')
          .hidden(['NOT', '$state.isGift'])
          .build(),

        viewField.checkbox('hidePrice', 'hidePrice')
          .label('Hide price on packing slip')
          .hidden(['NOT', '$state.isGift'])
          .build(),
      ],
    },
  ],
}
```

---

## Using Context for Role-Based Visibility

```typescript
// Admin-only field
viewField.numberInput('internalCost', 'internalCost')
  .hidden(['!=', '$context.user.role', 'admin'])
  .build()

// Multiple allowed roles
viewField.select('priority', 'priority')
  .hidden(['NOT_IN', '$context.user.role', ['admin', 'manager', 'supervisor']])
  .build()
```

---

## Dynamic Field Updates

Beyond visibility, update other properties:

```typescript
// Change placeholder based on selection
viewField.textInput('identifier', 'identifier')
  .reaction(
    on.change()
      .do(
        actions.updateProp('identifier', 'placeholder',
          ['IF',
            ['==', '$state.idType', 'email'],
            'Enter email address',
            ['IF',
              ['==', '$state.idType', 'phone'],
              'Enter phone number',
              'Enter ID'
            ]
          ]
        )
      )
  )
  .build()
```

---

## Best Practices

1. **Keep conditions simple**: Complex conditions are hard to maintain

2. **Use meaningful field names**: Makes expressions readable

3. **Declare dependencies**: Always use `dependsOn` for fields that trigger conditions

4. **Test edge cases**: Test when values are null, empty, or unexpected

5. **Consider UX**: Don't hide too many fields - confuses users

6. **Document complex logic**: Add comments in your schema for complex conditions

---

[Back to Guides](../README.md) | [Next: Cascade Select](./cascade-select.md)
