# Legacy Integration Guide

This guide explains how to integrate Manifesto forms with legacy APIs that have non-standard request/response formats.

## Overview

Many enterprise systems have APIs that:
- Use different field names than your modern UI
- Return nested or complex response structures
- Require specific request formats (XML, custom JSON)
- Have unconventional pagination or error handling

Manifesto handles this with **adapters** and **transform pipelines**.

---

## Basic Adapter Usage

### API Call with Adapter

```typescript
import { api, adapter, transform } from '@manifesto-ai/schema'

api.post('save', '/legacy-api/products')
  .body('$state')
  .adapter(adapter.legacy(
    // Request transform
    { steps: [
      transform.rename('request', {
        'name': 'PRODUCT_NAME',
        'price': 'UNIT_PRICE',
        'category': 'CATEGORY_CODE',
      }),
    ]},
    // Response transform
    { steps: [
      transform.rename('response', {
        'PRODUCT_ID': 'id',
        'RESULT_CODE': 'status',
      }),
    ]}
  ))
  .outputAs('result')
  .build()
```

---

## Transform Operations

### Rename Fields

Map field names between formats:

```typescript
transform.rename('map-fields', {
  // modern: legacy
  'firstName': 'FIRST_NAME',
  'lastName': 'LAST_NAME',
  'email': 'EMAIL_ADDRESS',
  'phone': 'PHONE_NUMBER',
})
```

### Pick Fields

Select specific fields from data:

```typescript
transform.pick('select-fields', ['id', 'name', 'price', 'status'])
```

### Omit Fields

Remove specific fields:

```typescript
transform.omit('remove-internal', ['_internal', '_temp', 'password'])
```

### Map Transform

Apply expression to transform data:

```typescript
transform.map('format-products', {
  expression: [
    'MAP', '$data.products',
    ['OBJECT',
      ['id', ['GET', '$item', 'PRODUCT_ID']],
      ['name', ['GET', '$item', 'PRODUCT_NAME']],
      ['price', ['/', ['GET', '$item', 'PRICE_CENTS'], 100]]
    ]
  ]
})
```

### Filter Transform

Filter items based on condition:

```typescript
transform.filter('active-only', {
  expression: ['==', ['GET', '$item', 'STATUS'], 'ACTIVE']
})
```

### Custom Transform

Complex transformations with custom logic:

```typescript
transform.custom('complex', {
  expression: ['OBJECT',
    ['data', ['GET', '$response', 'payload.items']],
    ['total', ['GET', '$response', 'payload.meta.total_count']],
    ['page', ['GET', '$response', 'payload.meta.current_page']],
  ]
})
```

---

## Common Legacy Patterns

### Nested Response Structure

Legacy API returns:
```json
{
  "response": {
    "data": {
      "items": [...],
      "pagination": { "total": 100 }
    },
    "status": "OK"
  }
}
```

Transform to flat structure:
```typescript
adapter.legacy(
  undefined,
  { steps: [
    transform.custom('flatten', {
      expression: ['OBJECT',
        ['items', ['GET_PATH', '$data', 'response.data.items']],
        ['total', ['GET_PATH', '$data', 'response.data.pagination.total']],
        ['success', ['==', ['GET_PATH', '$data', 'response.status'], 'OK']]
      ]
    })
  ]}
)
```

### Different Date Formats

Legacy API uses `DD/MM/YYYY`, your UI uses `YYYY-MM-DD`:

```typescript
adapter.legacy(
  // Request: convert to legacy format
  { steps: [
    transform.custom('date-to-legacy', {
      expression: ['OBJECT',
        ['...', '$data'],  // spread original data
        ['START_DATE', ['DATE_FORMAT', '$data.startDate', 'DD/MM/YYYY']],
        ['END_DATE', ['DATE_FORMAT', '$data.endDate', 'DD/MM/YYYY']],
      ]
    })
  ]},
  // Response: convert from legacy format
  { steps: [
    transform.custom('date-from-legacy', {
      expression: ['OBJECT',
        ['...', '$data'],
        ['startDate', ['DATE_PARSE', '$data.START_DATE', 'DD/MM/YYYY']],
        ['endDate', ['DATE_PARSE', '$data.END_DATE', 'DD/MM/YYYY']],
      ]
    })
  ]}
)
```

### Status Code Mapping

Legacy API returns numeric codes:

```typescript
transform.custom('map-status', {
  expression: ['CASE', ['GET', '$data', 'STATUS_CODE'],
    [0, { status: 'pending' }],
    [1, { status: 'active' }],
    [2, { status: 'completed' }],
    [9, { status: 'error' }],
    { status: 'unknown' }  // default
  ]
})
```

---

## Fetch Handler with Legacy Support

```tsx
const fetchHandler = async (endpoint: string, options: any) => {
  // Add legacy API headers
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Version': '1.0',
    'X-Client-ID': 'modern-ui',
    ...options.headers,
  }

  // Some legacy APIs need session tokens
  const sessionToken = sessionStorage.getItem('legacy-session')
  if (sessionToken) {
    headers['X-Session-Token'] = sessionToken
  }

  const response = await fetch(endpoint, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  // Handle legacy error formats
  const data = await response.json()

  if (data.ERROR_CODE && data.ERROR_CODE !== '0') {
    throw new Error(data.ERROR_MESSAGE || 'Unknown error')
  }

  return data
}
```

---

## Complete Legacy Integration Example

### Scenario

A legacy ERP system with:
- UPPER_CASE field names
- Nested response structure
- Different date format
- Status codes instead of strings

### Entity Schema

```typescript
export const orderEntity = {
  _type: 'entity' as const,
  id: 'order',
  name: 'Order',
  version: '1.0.0',
  fields: [
    field.string('id', 'Order ID').build(),
    field.string('customerId', 'Customer ID').required().build(),
    field.date('orderDate', 'Order Date').required().build(),
    field.enum('status', 'Status', [
      enumValue('pending', 'Pending'),
      enumValue('processing', 'Processing'),
      enumValue('shipped', 'Shipped'),
      enumValue('delivered', 'Delivered'),
    ]).build(),
    field.number('total', 'Total Amount').build(),
  ],
}
```

### Action Schema

```typescript
import { api, adapter, transform, setState, navigate } from '@manifesto-ai/schema'

// Status code mapping
const STATUS_MAP = {
  0: 'pending',
  1: 'processing',
  2: 'shipped',
  3: 'delivered',
}

const REVERSE_STATUS_MAP = {
  pending: 0,
  processing: 1,
  shipped: 2,
  delivered: 3,
}

export const createOrderAction = {
  _type: 'action' as const,
  id: 'create-order',
  name: 'Create Order',
  version: '1.0.0',
  trigger: { type: 'manual' as const },
  steps: [
    api.post('create', '/legacy-erp/orders/create')
      .headers({
        'X-API-Version': '2.0',
        'X-Client-System': 'MODERN_UI',
      })
      .body('$state')
      .adapter(adapter.legacy(
        // Transform request to legacy format
        {
          steps: [
            transform.custom('to-legacy', {
              expression: ['OBJECT',
                ['CUSTOMER_ID', '$data.customerId'],
                ['ORDER_DATE', ['DATE_FORMAT', '$data.orderDate', 'DD/MM/YYYY']],
                ['ORDER_STATUS', ['GET', REVERSE_STATUS_MAP, '$data.status']],
                ['TOTAL_AMOUNT', ['*', '$data.total', 100]],  // Convert to cents
                ['LINE_ITEMS', ['MAP', '$data.items', ['OBJECT',
                  ['PRODUCT_CODE', ['GET', '$item', 'productId']],
                  ['QUANTITY', ['GET', '$item', 'quantity']],
                  ['UNIT_PRICE', ['*', ['GET', '$item', 'price'], 100]],
                ]]],
              ]
            })
          ]
        },
        // Transform response from legacy format
        {
          steps: [
            transform.custom('from-legacy', {
              expression: ['OBJECT',
                ['id', ['GET_PATH', '$data', 'RESPONSE.ORDER.ORDER_ID']],
                ['status', ['GET', STATUS_MAP, ['GET_PATH', '$data', 'RESPONSE.ORDER.STATUS']]],
                ['confirmationNumber', ['GET_PATH', '$data', 'RESPONSE.ORDER.CONFIRM_NUM']],
                ['createdAt', ['DATE_PARSE', ['GET_PATH', '$data', 'RESPONSE.TIMESTAMP'], 'YYYYMMDDHHmmss']],
                ['success', ['==', ['GET_PATH', '$data', 'RESPONSE.RESULT_CODE'], '00']],
                ['errorMessage', ['GET_PATH', '$data', 'RESPONSE.ERROR_MESSAGE']],
              ]
            })
          ]
        }
      ))
      .outputAs('result')
      .build(),

    // Check result and navigate
    condition(
      'check-result',
      ['==', '$result.success', true],
      [
        setState('update', { orderId: '$result.id', confirmation: '$result.confirmationNumber' }),
        navigate('success', '/orders/$result.id'),
      ],
      [
        setState('error', { errorMessage: '$result.errorMessage' }),
      ]
    ),
  ],
}
```

### Fetch Options from Legacy API

```typescript
// View Schema
viewField.select('customer', 'customerId')
  .placeholder('Select customer')
  .reaction(
    on.mount().do(
      actions.setOptions('customer',
        dataSource.api('/legacy-erp/customers/list', {
          transform: {
            path: 'RESPONSE.CUSTOMERS',  // Navigate into nested structure
            map: {
              value: 'CUSTOMER_ID',       // Legacy field for value
              label: 'CUSTOMER_NAME'      // Legacy field for label
            }
          }
        })
      )
    )
  )
  .build()
```

---

## GraphQL Adapter

For GraphQL APIs:

```typescript
api.post('query', '/graphql')
  .body({
    query: `
      mutation CreateProduct($input: ProductInput!) {
        createProduct(input: $input) {
          id
          name
          status
        }
      }
    `,
    variables: {
      input: '$state'
    }
  })
  .adapter(adapter.graphql(
    undefined,
    { steps: [
      transform.custom('extract', {
        expression: ['GET_PATH', '$data', 'data.createProduct']
      })
    ]}
  ))
  .outputAs('product')
  .build()
```

---

## SOAP/XML Adapter

For SOAP services:

```typescript
api.post('save', '/soap/OrderService')
  .headers({
    'Content-Type': 'text/xml',
    'SOAPAction': 'CreateOrder',
  })
  .adapter(adapter.soap(
    // Request: build XML envelope
    { steps: [
      transform.custom('to-xml', {
        template: `
          <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <CreateOrder xmlns="http://erp.company.com/orders">
                <CustomerID>{{customerId}}</CustomerID>
                <OrderDate>{{orderDate}}</OrderDate>
                <Items>
                  {{#each items}}
                  <Item>
                    <ProductCode>{{productId}}</ProductCode>
                    <Quantity>{{quantity}}</Quantity>
                  </Item>
                  {{/each}}
                </Items>
              </CreateOrder>
            </soap:Body>
          </soap:Envelope>
        `
      })
    ]},
    // Response: parse XML
    { steps: [
      transform.custom('from-xml', {
        parser: 'xml',
        path: 'Envelope.Body.CreateOrderResponse'
      })
    ]}
  ))
  .outputAs('result')
  .build()
```

---

## Error Handling

Legacy APIs often have non-standard error responses:

```typescript
const fetchHandler = async (endpoint: string, options: any) => {
  const response = await fetch(endpoint, {
    method: options.method,
    headers: options.headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await response.json()

  // Handle legacy error formats

  // Format 1: Numeric error code
  if (data.ERR_CODE && data.ERR_CODE !== 0) {
    throw new Error(`Error ${data.ERR_CODE}: ${data.ERR_MSG}`)
  }

  // Format 2: Status field
  if (data.status === 'ERROR' || data.status === 'FAIL') {
    throw new Error(data.message || 'Operation failed')
  }

  // Format 3: Nested error object
  if (data.response?.error) {
    throw new Error(data.response.error.description)
  }

  // Format 4: HTTP-like status in body
  if (data.httpStatus >= 400) {
    throw new Error(data.errorDescription)
  }

  return data
}
```

---

## Best Practices

1. **Document transformations**: Comment complex mappings for future maintainers

2. **Version your adapters**: Different API versions may need different transforms

3. **Handle nulls gracefully**: Legacy data often has unexpected nulls

4. **Log transformations**: In debug mode, log before/after for troubleshooting

5. **Test with real data**: Edge cases in production data may surprise you

6. **Create reusable transforms**: Common patterns can be shared across forms

7. **Consider caching**: Cache lookup tables and reference data

8. **Monitor performance**: Complex transforms can impact load times

---

[Back to Guides](../README.md) | [Previous: Validation](./validation.md)
