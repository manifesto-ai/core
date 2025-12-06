# Action Schema Reference

The Action Schema defines **workflows** and **side effects**. It represents the "when" layer in Manifesto's 3-layer architecture, orchestrating how data flows between the form and external systems.

## Table of Contents

- [Overview](#overview)
- [ActionSchema Interface](#actionschema-interface)
- [Triggers](#triggers)
- [Action Steps](#action-steps)
- [Transform Pipeline](#transform-pipeline)
- [Adapters](#adapters)
- [Builder API](#builder-api)
- [Complete Examples](#complete-examples)

---

## Overview

The Action Schema defines multi-step workflows that execute in response to triggers. It enables:

- **API Integration**: Make HTTP requests to external services
- **Data Transformation**: Transform data between formats
- **Conditional Logic**: Execute different paths based on conditions
- **Parallel Execution**: Run multiple operations concurrently
- **State Updates**: Update form state from results
- **Navigation**: Navigate to different routes

```typescript
import { api, transform, condition, setState, navigate } from '@manifesto-ai/schema'

const saveProductAction = {
  _type: 'action' as const,
  id: 'save-product',
  name: 'Save Product',
  version: '1.0.0',
  trigger: { type: 'manual' },
  steps: [
    api.post('create', '/api/products').body('$state').outputAs('result').build(),
    setState('update-id', { id: '$result.id' }),
    navigate('redirect', '/products/$result.id'),
  ],
}
```

---

## ActionSchema Interface

```typescript
interface ActionSchema {
  readonly _type: 'action'
  readonly id: string
  readonly name: string
  readonly version: `${number}.${number}.${number}`
  readonly description?: string
  readonly trigger: ActionTrigger
  readonly steps: readonly ActionStep[]
  readonly rollback?: readonly ActionStep[]
  readonly timeout?: number
  readonly retries?: number
}
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `_type` | `'action'` | Yes | Schema type discriminator |
| `id` | `string` | Yes | Unique identifier |
| `name` | `string` | Yes | Human-readable name |
| `version` | `string` | Yes | Semantic version |
| `trigger` | `ActionTrigger` | Yes | What starts the action |
| `steps` | `ActionStep[]` | Yes | Steps to execute |
| `rollback` | `ActionStep[]` | No | Steps to run on failure |
| `timeout` | `number` | No | Max execution time (ms) |
| `retries` | `number` | No | Number of retry attempts |

---

## Triggers

Triggers define what initiates an action.

### ActionTrigger Interface

```typescript
interface ActionTrigger {
  readonly type: 'manual' | 'event' | 'schedule'
  readonly event?: string
  readonly cron?: string
}
```

### Manual Trigger

Triggered by user interaction (button click, form submit).

```typescript
trigger: { type: 'manual' }
```

### Event Trigger

Triggered by a custom event.

```typescript
trigger: { type: 'event', event: 'product-selected' }
```

### Schedule Trigger

Triggered on a schedule (cron expression).

```typescript
trigger: { type: 'schedule', cron: '0 */5 * * * *' }  // Every 5 minutes
```

---

## Action Steps

Steps define the operations in an action workflow.

### ApiCallStep

Makes HTTP requests to external APIs.

```typescript
interface ApiCallStep {
  readonly _step: 'apiCall'
  readonly id: string
  readonly endpoint: string
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  readonly headers?: Record<string, string | Expression>
  readonly body?: Record<string, unknown> | Expression
  readonly adapter?: AdapterConfig
  readonly outputKey?: string
}
```

**Examples:**

```typescript
import { api } from '@manifesto-ai/schema'

// GET request
api.get('fetch-products', '/api/products')
  .headers({ 'Authorization': 'Bearer $context.token' })
  .outputAs('products')
  .build()

// POST request
api.post('create-product', '/api/products')
  .body('$state')
  .outputAs('result')
  .build()

// PUT request with dynamic URL
api.put('update-product', '/api/products/$state.id')
  .body({ name: '$state.name', price: '$state.price' })
  .outputAs('updated')
  .build()

// DELETE request
api.delete('remove-product', '/api/products/$state.id')
  .build()
```

### TransformStep

Transforms data between formats.

```typescript
interface TransformStep {
  readonly _step: 'transform'
  readonly id: string
  readonly operation: 'map' | 'filter' | 'reduce' | 'pick' | 'omit' | 'rename' | 'custom'
  readonly config: Record<string, unknown>
  readonly outputKey?: string
}
```

**Examples:**

```typescript
import { transform } from '@manifesto-ai/schema'

// Pick specific fields
transform.pick('select-fields', ['id', 'name', 'price'])

// Omit fields
transform.omit('remove-internal', ['_internal', '_temp'])

// Rename fields
transform.rename('api-format', {
  'productName': 'name',
  'productPrice': 'price'
})

// Map transformation
transform.map('format-products', {
  expression: [
    'MAP', '$products',
    ['OBJECT',
      ['id', ['GET', '$item', 'id']],
      ['label', ['GET', '$item', 'name']]
    ]
  ]
})

// Filter transformation
transform.filter('active-only', {
  expression: ['==', ['GET', '$item', 'status'], 'active']
})

// Custom transformation
transform.custom('complex-transform', {
  expression: ['OBJECT',
    ['data', '$result.items'],
    ['total', ['LENGTH', '$result.items']],
    ['page', '$params.page']
  ]
})
```

### ConditionStep

Branches execution based on conditions.

```typescript
interface ConditionStep {
  readonly _step: 'condition'
  readonly id: string
  readonly condition: Expression
  readonly then: readonly ActionStep[]
  readonly else?: readonly ActionStep[]
}
```

**Example:**

```typescript
import { condition, api, navigate } from '@manifesto-ai/schema'

condition(
  'check-auth',
  ['!=', '$context.user', null],
  // Then branch
  [
    api.post('save', '/api/save').body('$state').build(),
    navigate('success', '/success'),
  ],
  // Else branch
  [
    navigate('login', '/login', { params: { returnUrl: '$context.currentUrl' } }),
  ]
)
```

### ParallelStep

Executes multiple steps concurrently.

```typescript
interface ParallelStep {
  readonly _step: 'parallel'
  readonly id: string
  readonly steps: readonly ActionStep[]
  readonly mode?: 'all' | 'race' | 'allSettled'
}
```

**Modes:**
- `'all'`: Wait for all to complete, fail if any fails (Promise.all)
- `'race'`: Resolve when first completes (Promise.race)
- `'allSettled'`: Wait for all, continue even if some fail (Promise.allSettled)

**Example:**

```typescript
import { parallel, api } from '@manifesto-ai/schema'

// Fetch multiple resources in parallel
parallel.all('fetch-data', [
  api.get('categories', '/api/categories').outputAs('categories').build(),
  api.get('brands', '/api/brands').outputAs('brands').build(),
  api.get('tags', '/api/tags').outputAs('tags').build(),
])

// Race to fastest response
parallel.race('fastest-cdn', [
  api.get('cdn1', 'https://cdn1.example.com/data').build(),
  api.get('cdn2', 'https://cdn2.example.com/data').build(),
])

// Continue even if some fail
parallel.allSettled('optional-enrichment', [
  api.get('social', '/api/social-data').build(),
  api.get('analytics', '/api/analytics').build(),
])
```

### SetStateStep

Updates form state from action results.

```typescript
interface SetStateStep {
  readonly _step: 'setState'
  readonly id: string
  readonly updates: Record<string, Expression | unknown>
}
```

**Example:**

```typescript
import { setState } from '@manifesto-ai/schema'

// Set single value
setState('set-id', { id: '$result.id' })

// Set multiple values
setState('populate-form', {
  name: '$result.name',
  price: '$result.price',
  category: '$result.categoryId',
  isActive: '$result.status === "active"',
})

// Set computed values
setState('calculate-totals', {
  subtotal: ['*', '$state.quantity', '$state.price'],
  tax: ['*', '$state.subtotal', 0.1],
  total: ['+', '$state.subtotal', '$state.tax'],
})
```

### NavigationStep

Navigates to a different route.

```typescript
interface NavigationStep {
  readonly _step: 'navigation'
  readonly id: string
  readonly path: string
  readonly params?: Record<string, unknown>
  readonly replace?: boolean
}
```

**Example:**

```typescript
import { navigate } from '@manifesto-ai/schema'

// Simple navigation
navigate('go-home', '/')

// With path parameters
navigate('view-product', '/products/$result.id')

// With query parameters
navigate('search', '/search', {
  params: { q: '$state.query', page: 1 }
})

// Replace history (no back button)
navigate('redirect', '/dashboard', { replace: true })
```

---

## Transform Pipeline

Transform pipelines allow chaining multiple transformations.

```typescript
interface TransformPipeline {
  readonly steps: readonly TransformStep[]
}
```

**Example:**

```typescript
const pipeline: TransformPipeline = {
  steps: [
    transform.pick('select', ['data']),
    transform.map('extract', { expression: '$data.items' }),
    transform.filter('active', { expression: ['==', ['GET', '$item', 'active'], true] }),
    transform.rename('format', { 'item_name': 'name', 'item_price': 'price' }),
  ]
}
```

---

## Adapters

Adapters transform requests and responses for different API formats.

### AdapterConfig Interface

```typescript
interface AdapterConfig {
  readonly type: 'legacy' | 'graphql' | 'soap'
  readonly requestTransform?: TransformPipeline
  readonly responseTransform?: TransformPipeline
}
```

### Legacy Adapter

For legacy REST APIs with non-standard formats.

```typescript
import { api, adapter, transform } from '@manifesto-ai/schema'

api.post('save', '/api/legacy/products')
  .body('$state')
  .adapter(adapter.legacy(
    // Request transform
    { steps: [
      transform.rename('req-format', {
        'name': 'ProductName',
        'price': 'UnitPrice',
        'category': 'CategoryCode',
      }),
    ]},
    // Response transform
    { steps: [
      transform.rename('res-format', {
        'Result': 'data',
        'ErrorCode': 'error',
      }),
    ]}
  ))
  .build()
```

### GraphQL Adapter

For GraphQL APIs.

```typescript
api.post('query', '/graphql')
  .body({
    query: `
      mutation CreateProduct($input: ProductInput!) {
        createProduct(input: $input) {
          id
          name
        }
      }
    `,
    variables: { input: '$state' }
  })
  .adapter(adapter.graphql(
    undefined,
    { steps: [transform.map('extract', { expression: '$data.createProduct' })] }
  ))
  .build()
```

### SOAP Adapter

For SOAP/XML APIs.

```typescript
api.post('save', '/soap/products')
  .adapter(adapter.soap(
    { steps: [
      transform.custom('to-xml', {
        template: `
          <soap:Envelope>
            <soap:Body>
              <CreateProduct>
                <Name>{{name}}</Name>
                <Price>{{price}}</Price>
              </CreateProduct>
            </soap:Body>
          </soap:Envelope>
        `
      })
    ]},
    { steps: [
      transform.custom('from-xml', { parser: 'xml' })
    ]}
  ))
  .build()
```

---

## Builder API

### API Call Builder

```typescript
interface ApiCallBuilder {
  headers(headers: Record<string, string | Expression>): ApiCallBuilder
  body(body: Record<string, unknown> | Expression): ApiCallBuilder
  adapter(config: AdapterConfig): ApiCallBuilder
  outputAs(key: string): ApiCallBuilder
  build(): ApiCallStep
}
```

**Constructors:**

| Method | HTTP Method |
|--------|-------------|
| `api.get(id, endpoint)` | GET |
| `api.post(id, endpoint)` | POST |
| `api.put(id, endpoint)` | PUT |
| `api.patch(id, endpoint)` | PATCH |
| `api.delete(id, endpoint)` | DELETE |

### Transform Helpers

| Method | Description |
|--------|-------------|
| `transform.map(id, config)` | Map transformation |
| `transform.filter(id, config)` | Filter transformation |
| `transform.reduce(id, config)` | Reduce transformation |
| `transform.pick(id, fields)` | Pick specific fields |
| `transform.omit(id, fields)` | Omit specific fields |
| `transform.rename(id, mapping)` | Rename fields |
| `transform.custom(id, config)` | Custom transformation |

### Parallel Helpers

| Method | Description |
|--------|-------------|
| `parallel.all(id, steps)` | Wait for all (fail fast) |
| `parallel.race(id, steps)` | First to complete wins |
| `parallel.allSettled(id, steps)` | Wait for all (no fail) |

### Adapter Helpers

| Method | Description |
|--------|-------------|
| `adapter.legacy(req, res)` | Legacy REST adapter |
| `adapter.graphql(req, res)` | GraphQL adapter |
| `adapter.soap(req, res)` | SOAP/XML adapter |

---

## Complete Examples

### CRUD Operations

```typescript
import { api, setState, navigate, condition } from '@manifesto-ai/schema'

// Create Product
export const createProductAction = {
  _type: 'action' as const,
  id: 'create-product',
  name: 'Create Product',
  version: '1.0.0',
  trigger: { type: 'manual' as const },
  timeout: 30000,
  steps: [
    api.post('create', '/api/products')
      .body('$state')
      .outputAs('result')
      .build(),
    setState('set-id', { id: '$result.id' }),
    navigate('view', '/products/$result.id'),
  ],
}

// Update Product
export const updateProductAction = {
  _type: 'action' as const,
  id: 'update-product',
  name: 'Update Product',
  version: '1.0.0',
  trigger: { type: 'manual' as const },
  steps: [
    api.put('update', '/api/products/$state.id')
      .body('$state')
      .outputAs('result')
      .build(),
    navigate('view', '/products/$state.id'),
  ],
}

// Delete Product
export const deleteProductAction = {
  _type: 'action' as const,
  id: 'delete-product',
  name: 'Delete Product',
  version: '1.0.0',
  trigger: { type: 'manual' as const },
  steps: [
    api.delete('delete', '/api/products/$state.id').build(),
    navigate('list', '/products'),
  ],
}
```

### Complex Workflow with Conditions

```typescript
import { api, condition, parallel, setState, navigate } from '@manifesto-ai/schema'

export const checkoutAction = {
  _type: 'action' as const,
  id: 'checkout',
  name: 'Process Checkout',
  version: '1.0.0',
  trigger: { type: 'manual' as const },
  timeout: 60000,
  retries: 2,
  steps: [
    // Validate inventory
    api.post('validate', '/api/inventory/validate')
      .body({ items: '$state.cartItems' })
      .outputAs('validation')
      .build(),

    // Check validation result
    condition(
      'check-inventory',
      ['==', '$validation.valid', true],
      // Inventory valid - proceed with checkout
      [
        // Process payment and create order in parallel
        parallel.all('process', [
          api.post('payment', '/api/payments/process')
            .body({
              amount: '$state.total',
              method: '$state.paymentMethod',
              token: '$state.paymentToken',
            })
            .outputAs('payment')
            .build(),
          api.post('order', '/api/orders')
            .body({
              items: '$state.cartItems',
              shipping: '$state.shippingAddress',
              billing: '$state.billingAddress',
            })
            .outputAs('order')
            .build(),
        ]),

        // Update order with payment reference
        api.patch('link-payment', '/api/orders/$order.id')
          .body({ paymentId: '$payment.id' })
          .build(),

        // Send confirmation email
        api.post('notify', '/api/notifications/order-confirmation')
          .body({ orderId: '$order.id', email: '$state.email' })
          .build(),

        // Navigate to success page
        navigate('success', '/checkout/success/$order.id'),
      ],
      // Inventory invalid - show error
      [
        setState('set-error', {
          error: 'Some items are out of stock',
          outOfStock: '$validation.outOfStockItems',
        }),
      ]
    ),
  ],

  // Rollback on failure
  rollback: [
    condition(
      'check-payment',
      ['!=', '$payment.id', null],
      [
        api.post('refund', '/api/payments/$payment.id/refund').build(),
      ]
    ),
    condition(
      'check-order',
      ['!=', '$order.id', null],
      [
        api.delete('cancel-order', '/api/orders/$order.id').build(),
      ]
    ),
  ],
}
```

### Legacy API Integration

```typescript
import { api, adapter, transform } from '@manifesto-ai/schema'

export const legacyIntegrationAction = {
  _type: 'action' as const,
  id: 'sync-legacy',
  name: 'Sync to Legacy System',
  version: '1.0.0',
  trigger: { type: 'manual' as const },
  steps: [
    // Transform modern format to legacy format
    api.post('sync', '/legacy-api/products/create')
      .headers({
        'X-API-Key': '$env.LEGACY_API_KEY',
        'Content-Type': 'application/xml',
      })
      .body('$state')
      .adapter(adapter.legacy(
        // Request transformation
        {
          steps: [
            transform.rename('to-legacy', {
              'name': 'PRODUCT_NAME',
              'price': 'UNIT_PRICE',
              'category': 'CATEGORY_CODE',
              'sku': 'STOCK_KEEPING_UNIT',
            }),
            transform.custom('add-meta', {
              expression: ['MERGE', '$input', {
                'SYSTEM_ID': 'MODERN_SYSTEM',
                'SYNC_DATE': ['NOW'],
              }]
            }),
          ]
        },
        // Response transformation
        {
          steps: [
            transform.rename('from-legacy', {
              'RESULT_CODE': 'status',
              'PRODUCT_ID': 'legacyId',
              'ERROR_MESSAGE': 'error',
            }),
          ]
        }
      ))
      .outputAs('legacyResult')
      .build(),

    // Update local record with legacy ID
    setState('save-legacy-id', {
      legacyId: '$legacyResult.legacyId',
      syncedAt: ['NOW'],
    }),
  ],
}
```

---

## Best Practices

1. **Use meaningful IDs**: Step IDs should describe what the step does

2. **Output to keys**: Use `outputAs` to store results for later steps

3. **Handle failures**: Provide rollback steps for operations that need cleanup

4. **Set timeouts**: Always set appropriate timeouts for API calls

5. **Use parallel wisely**: Only parallelize independent operations

6. **Transform at boundaries**: Transform data at API boundaries, not in business logic

7. **Log important steps**: Emit events for monitoring and debugging

8. **Validate before saving**: Always validate data before making write operations

---

[Back to Schema Reference](../README.md) | [Previous: Reaction DSL](./reaction-dsl.md) | [Next: Expression DSL](./expression-dsl.md)
