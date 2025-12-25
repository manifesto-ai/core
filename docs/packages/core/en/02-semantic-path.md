# SemanticPath

```typescript
import { createRuntime } from '@manifesto-ai/core';

const runtime = createRuntime({ domain: orderDomain });

// Every value has an address via SemanticPath
runtime.get('data.items');           // User input data
runtime.get('state.isSubmitting');   // UI state
runtime.get('derived.subtotal');     // Computed value
runtime.get('async.shippingRates');  // Async data

// AI can precisely reference specific values
const total = runtime.get('derived.total');
const items = runtime.get('data.items');
```

## Core Concept

### "Every Value Has an Address"

In Manifesto, every value in a domain is accessed through a unique address called **SemanticPath**. This is not just a technical choice but a core design principle.

```typescript
// Traditional approach: Unclear where values come from
const total = calculateTotal(cart, discount, shipping);

// Manifesto approach: Clear source for every value
runtime.get('derived.total');           // Total amount
runtime.get('derived.subtotal');        // Subtotal
runtime.get('derived.discount');        // Discount amount
runtime.get('derived.shippingFee');     // Shipping fee
```

### AI Can Reference Values

For an AI Agent to accurately answer "What's the cart total?", it needs to know where that value is located:

```typescript
// Conversation AI can understand
// User: "What's the total?"
// AI: "Let me check derived.total."
const total = runtime.get('derived.total');

// AI can modify values
// User: "Change the quantity to 3"
// AI: "Setting data.items.0.quantity to 3."
runtime.set('data.items.0.quantity', 3);
```

---

## Namespace System

SemanticPath uses namespace prefixes to distinguish the nature of values:

| Namespace | Purpose | Writable | Reactive |
|-----------|---------|----------|----------|
| `data.*` | User input/business data | Yes | Yes |
| `state.*` | UI/system state | Yes | Yes |
| `derived.*` | Computed values | No (auto) | Yes |
| `async.*` | Async external data | No (auto) | Yes |

### data.* (User Input Data)

Contains persistent business data. Values directly input by users or injected externally.

```typescript
// Core order data
'data.items'           // Order items list
'data.couponCode'      // Coupon code
'data.shippingAddress' // Shipping address
'data.paymentMethod'   // Payment method

// Both read and write allowed
runtime.get('data.items');
runtime.set('data.items', [...]);
```

### state.* (UI/System State)

Contains temporary UI state. Values that reset on page refresh.

```typescript
// UI state
'state.isSubmitting'    // Whether submitting
'state.selectedItemId'  // Selected item ID
'state.activeTab'       // Active tab
'state.error'           // Error message

// Both read and write allowed
runtime.get('state.isSubmitting');
runtime.set('state.isSubmitting', true);
```

### derived.* (Computed Values)

Read-only values computed from other paths. Defined via Expression.

```typescript
// Computed values
'derived.subtotal'      // Subtotal = sum(items.price * items.quantity)
'derived.discount'      // Discount = calculated when coupon applied
'derived.total'         // Total = subtotal - discount + shipping
'derived.itemCount'     // Item count = items.length
'derived.hasItems'      // Has items = itemCount > 0
'derived.canCheckout'   // Can checkout = hasItems && !isSubmitting

// Read-only (auto-computed)
runtime.get('derived.total');  // Read value
// runtime.set('derived.total', 100);  // Error! Cannot write
```

### async.* (Async Data)

Data fetched asynchronously from external APIs.

```typescript
// Async data
'async.shippingRates'   // Shipping options list
'async.stockStatus'     // Stock status
'async.recommendations' // Recommended products

// Read-only (auto-refreshed)
runtime.get('async.shippingRates');
// runtime.set('async.shippingRates', [...]);  // Error! Cannot write
```

---

## Path Notation

### Dot Notation

The most basic path notation:

```typescript
'data.user.name'           // data > user > name
'data.items.0.price'       // data > items > [0] > price
'derived.user.fullName'    // derived > user > fullName
```

### Array Indexing

Use numeric indices to access array elements:

```typescript
'data.items.0'            // First item
'data.items.0.name'       // First item's name
'data.items.0.quantity'   // First item's quantity

// Access last item via expression
['at', ['get', 'data.items'], -1]
```

### Bracket Notation

Used for keys containing special characters:

```typescript
'data.options["my-key"]'   // Key with hyphen
'data.settings["ui.theme"]' // Key with dot
```

### Wildcards (For Agents)

Match multiple paths with wildcards when subscribing:

```typescript
// Subscribe to all changes under data.items
runtime.subscribePath('data.items.*', (value, path) => {
  console.log(`${path} changed`);
});

// 'data.items.0' change → callback invoked
// 'data.items.1.quantity' change → callback invoked
// 'data.couponCode' change → callback NOT invoked
```

---

## SemanticMeta

Each path has associated metadata that AI can understand:

```typescript
type SemanticMeta = {
  /** Semantic type (e.g., 'input', 'currency', 'boolean') */
  type: string;

  /** Natural language description */
  description: string;

  /** Importance level */
  importance?: 'critical' | 'high' | 'medium' | 'low';

  /** Whether AI can read the value */
  readable?: boolean;

  /** Whether AI can modify the value */
  writable?: boolean;

  /** Example values */
  examples?: unknown[];

  /** Additional hints */
  hints?: Record<string, unknown>;
};
```

### Usage Example

```typescript
const itemsSource = defineSource({
  schema: z.array(itemSchema),
  semantic: {
    type: 'list',
    description: 'List of items to order. Each item contains ID, name, price, and quantity.',
    importance: 'critical',
    readable: true,
    writable: true,
    examples: [
      { id: '1', name: 'Laptop', price: 1500000, quantity: 1 }
    ],
    hints: {
      maxItems: 99,
      minQuantity: 1
    }
  }
});

const totalDerived = defineDerived({
  deps: ['derived.subtotal', 'derived.discount', 'derived.shippingFee'],
  expr: ['+', ['-', ['get', 'derived.subtotal'], ['get', 'derived.discount']], ['get', 'derived.shippingFee']],
  semantic: {
    type: 'currency',
    description: 'Order total. Subtotal minus discount plus shipping fee.',
    importance: 'critical',
    readable: true,
    writable: false  // derived is always false
  }
});
```

### Query Metadata at Runtime

```typescript
const semantic = runtime.getSemantic('data.items');
// {
//   type: 'list',
//   description: 'List of items to order...',
//   importance: 'critical',
//   readable: true,
//   writable: true
// }
```

---

## SemanticPath from AI Perspective

### Context Generation

Generate SemanticPath-based context when describing current state to AI Agent:

```typescript
// Using projection-agent package
import { projectAgentContext } from '@manifesto-ai/projection-agent';

const context = projectAgentContext(runtime, domain);
// {
//   summary: 'Order in progress. 3 items, $45,000',
//   paths: {
//     'data.items': {
//       value: [...],
//       semantic: { type: 'list', description: '...' },
//       editable: true,
//       formatted: '3 items'
//     },
//     'derived.total': {
//       value: 45000,
//       semantic: { type: 'currency', description: '...' },
//       editable: false,
//       formatted: '$45,000'
//     }
//   },
//   availableActions: ['addItem', 'removeItem', 'checkout'],
//   suggestions: [{ action: 'checkout', confidence: 0.8 }]
// }
```

### Action Availability Analysis

For AI to determine "Can I checkout?", it needs to check precondition paths:

```typescript
// Action preconditions
const checkoutAction = defineAction({
  preconditions: [
    { path: 'derived.hasItems', expect: 'true', reason: 'Cart must have items' },
    { path: 'derived.isNotSubmitting', expect: 'true', reason: 'Must not be already submitting' },
    { path: 'derived.hasShippingAddress', expect: 'true', reason: 'Shipping address must be entered' }
  ],
  // ...
});

// AI checks precondition status
const preconditions = runtime.getPreconditions('checkout');
// [
//   { path: 'derived.hasItems', actual: true, satisfied: true },
//   { path: 'derived.isNotSubmitting', actual: true, satisfied: true },
//   { path: 'derived.hasShippingAddress', actual: false, satisfied: false, reason: 'Shipping address must be entered' }
// ]

// AI response: "You can checkout once you enter a shipping address."
```

### Impact Analysis

For AI to understand "What happens if I change the quantity?", it needs to know the impact scope:

```typescript
// Paths affected by data.items.0.quantity change
const impact = runtime.getImpact('data.items.0.quantity');
// [
//   'derived.subtotal',
//   'derived.discount',
//   'derived.total',
//   'derived.shippingFee',
//   'derived.canCheckout'
// ]

// AI response: "Changing the quantity will recalculate subtotal, discount, total, and shipping fee."
```

### Explanation Tree

When AI explains "Why is the total this amount?":

```typescript
const explanation = runtime.explain('derived.total');
// {
//   path: 'derived.total',
//   value: 45000,
//   expression: ['+', ['-', ['get', 'derived.subtotal'], ['get', 'derived.discount']], ['get', 'derived.shippingFee']],
//   dependencies: [
//     { path: 'derived.subtotal', value: 50000, ... },
//     { path: 'derived.discount', value: 5000, ... },
//     { path: 'derived.shippingFee', value: 0, ... }
//   ],
//   explanation: 'Total $45,000 = Subtotal $50,000 - Discount $5,000 + Shipping $0'
// }
```

---

## Path Validation

### Check Existence

```typescript
const semantic = runtime.getSemantic('data.invalidPath');
// undefined (path does not exist)

const semantic2 = runtime.getSemantic('data.items');
// { type: 'list', ... } (path exists)
```

### Namespace Check

```typescript
function isWritablePath(path: SemanticPath): boolean {
  return path.startsWith('data.') || path.startsWith('state.');
}

function isDerivedPath(path: SemanticPath): boolean {
  return path.startsWith('derived.');
}
```

---

## Next Steps

- [Domain Definition](03-domain-definition.md) - How to define paths
- [Expression DSL](04-expression-dsl.md) - Path reference expressions
- [DAG & Change Propagation](06-dag-propagation.md) - Dependencies between paths
