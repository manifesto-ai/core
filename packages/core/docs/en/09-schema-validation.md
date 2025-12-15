# Zod Integration & Validation

```typescript
import { z } from 'zod';
import { validateValue, CommonSchemas } from '@manifesto-ai/core';

// Define Zod schema
const itemSchema = z.object({
  id: CommonSchemas.id(),
  name: z.string().min(1, 'Please enter product name'),
  price: CommonSchemas.money(),
  quantity: CommonSchemas.positiveInt()
});

// Validate value
const result = validateValue(itemSchema, invalidItem, 'data.items.0');
// {
//   valid: false,
//   issues: [
//     { code: 'too_small', message: 'Please enter product name', path: 'data.items.0.name', ... }
//   ]
// }
```

## Core Concept

### "Schema is the Contract"

Manifesto adopts **Zod** as its schema library. All data is guaranteed both type safety and runtime validation through schemas.

```typescript
// Schema definition = Type definition + Validation rules
const orderSchema = z.object({
  items: z.array(itemSchema).min(1, 'At least 1 item required'),
  couponCode: z.string().optional(),
  shippingAddress: addressSchema,
  termsAgreed: z.boolean().refine(v => v === true, 'Must agree to terms')
});

// Automatic type inference
type Order = z.infer<typeof orderSchema>;
// { items: Item[]; couponCode?: string; shippingAddress: Address; termsAgreed: boolean }

// Runtime validation
const result = orderSchema.safeParse(userInput);
```

---

## CommonSchemas

Pre-defined common schema patterns.

### String Schemas

```typescript
import { CommonSchemas } from '@manifesto-ai/core';

// Email
CommonSchemas.email();
// z.string().email()

// URL
CommonSchemas.url();
// z.string().url()

// Phone number (Korea)
CommonSchemas.phoneKR();
// z.string().regex(/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/)

// Business registration number
CommonSchemas.businessNumber();
// z.string().regex(/^[0-9]{3}-?[0-9]{2}-?[0-9]{5}$/)

// ID string
CommonSchemas.id();
// z.string().min(1)

// ISO date string
CommonSchemas.dateString();
// z.string().datetime()
```

### Number Schemas

```typescript
// Positive integer
CommonSchemas.positiveInt();
// z.number().int().positive()

// Non-negative integer
CommonSchemas.nonNegativeInt();
// z.number().int().nonnegative()

// Money amount
CommonSchemas.money();
// z.number().nonnegative()

// Percentage (0-100)
CommonSchemas.percent();
// z.number().min(0).max(100)
```

### Compound Schemas

```typescript
// Select option
CommonSchemas.selectOption(['standard', 'express', 'overnight'] as const);
// z.enum(['standard', 'express', 'overnight'])

// Nullable wrapper
CommonSchemas.nullable(z.string());
// z.string().nullable()

// Optional wrapper
CommonSchemas.optional(z.string());
// z.string().optional()

// Array
CommonSchemas.array(itemSchema);
// z.array(itemSchema)

// Record
CommonSchemas.record(z.number());
// z.record(z.number())
```

---

## SchemaUtils

### Range Schemas

```typescript
import { SchemaUtils } from '@manifesto-ai/core';

// Number range
SchemaUtils.range(1, 100);
// z.number().min(1).max(100)

// String length range
SchemaUtils.stringLength(2, 50);
// z.string().min(2).max(50)
```

### Enum Union

```typescript
// One of multiple values
SchemaUtils.enumUnion('pending', 'processing', 'completed', 'cancelled');
// z.enum(['pending', 'processing', 'completed', 'cancelled'])
```

### Interdependent Schemas

```typescript
// Either one required
SchemaUtils.eitherRequired(
  z.string(),  // Phone number
  z.string()   // Email
);
// { field1?: string; field2?: string } - At least one must exist
```

---

## schemaToSource

Creates a SourceDefinition from a Zod schema.

```typescript
import { schemaToSource } from '@manifesto-ai/core';

const itemsSource = schemaToSource(
  z.array(itemSchema),
  {
    type: 'list',
    description: 'Order items list',
    importance: 'critical'
  },
  {
    defaultValue: []
  }
);
// SourceDefinition {
//   schema: z.array(itemSchema),
//   defaultValue: [],
//   semantic: {
//     type: 'list',
//     description: 'Order items list',
//     importance: 'critical',
//     readable: true,
//     writable: true
//   }
// }
```

---

## Value Validation

### validateValue

Validates a single value.

```typescript
import { validateValue } from '@manifesto-ai/core';

// Valid value
const validResult = validateValue(itemSchema, {
  id: '1',
  name: 'Laptop',
  price: 1500000,
  quantity: 1
}, 'data.items.0');
// { valid: true, issues: [] }

// Invalid value
const invalidResult = validateValue(itemSchema, {
  id: '',
  name: '',
  price: -100,
  quantity: 0
}, 'data.items.0');
// {
//   valid: false,
//   issues: [
//     { code: 'too_small', message: 'Please enter product name', path: 'data.items.0.name', ... },
//     { code: 'too_small', message: 'Number must be greater than 0', path: 'data.items.0.price', ... },
//     { code: 'too_small', message: 'Number must be greater than 0', path: 'data.items.0.quantity', ... }
//   ]
// }
```

### ValidationResult Type

```typescript
type ValidationResult = {
  /** Overall validity */
  valid: boolean;

  /** Found issues */
  issues: ValidationIssue[];
};
```

### ValidationIssue Type

```typescript
type ValidationIssue = {
  /** Zod error code */
  code: string;

  /** Error message */
  message: string;

  /** SemanticPath */
  path: SemanticPath;

  /** Severity */
  severity: 'error' | 'warning' | 'suggestion';

  /** Auto-fix suggestion */
  suggestedFix?: {
    description: string;
    value: unknown;
  };
};
```

### Partial Validation

```typescript
import { validatePartial } from '@manifesto-ai/core';

// Validate only some fields (ignore others)
const result = validatePartial(
  orderSchema,
  { items: [item1] },  // shippingAddress missing
  'data'
);
// { valid: true, issues: [] }  // Missing fields allowed for partial
```

---

## Domain Data Validation

### validateDomainData

Validates entire domain data.

```typescript
import { validateDomainData } from '@manifesto-ai/core';

const result = validateDomainData(orderDomain, {
  items: [],
  shippingAddress: null,
  termsAgreed: false
});
// {
//   valid: false,
//   issues: [
//     { path: 'data.items', message: 'At least 1 item required', ... },
//     { path: 'data.shippingAddress', message: 'Please enter shipping address', ... }
//   ]
// }
```

### Field-by-Field Validation

```typescript
import { validateFields } from '@manifesto-ai/core';

const results = validateFields(orderDomain, data);
// {
//   'data.items': { valid: true, issues: [] },
//   'data.shippingAddress': { valid: false, issues: [...] },
//   'data.couponCode': { valid: true, issues: [] }
// }
```

---

## Async Validation

Used when server API validation is required.

```typescript
import { validateAsync } from '@manifesto-ai/core';

// Coupon code validation
const result = await validateAsync(
  'SAVE10',
  'data.couponCode',
  async (value) => {
    const response = await fetch(`/api/coupons/validate?code=${value}`);
    const data = await response.json();

    if (data.valid) {
      return true;
    }
    return data.message || 'Invalid coupon';
  }
);
// { valid: false, issues: [{ message: 'Expired coupon', path: 'data.couponCode', ... }] }
```

---

## Validation Result Processing

### Result Merging

```typescript
import { mergeValidationResults } from '@manifesto-ai/core';

const itemsResult = validateValue(itemsSchema, items, 'data.items');
const addressResult = validateValue(addressSchema, address, 'data.shippingAddress');
const couponResult = await validateAsync(couponCode, 'data.couponCode', validateCoupon);

const merged = mergeValidationResults(itemsResult, addressResult, couponResult);
// { valid: false, issues: [...all issues merged...] }
```

### Grouping by Path

```typescript
import { groupValidationByPath } from '@manifesto-ai/core';

const grouped = groupValidationByPath(result);
// {
//   'data.items.0.name': [{ message: 'Please enter product name', ... }],
//   'data.items.0.price': [{ message: 'Price must be greater than 0', ... }],
//   'data.shippingAddress.zipCode': [{ message: 'Please enter zip code', ... }]
// }
```

### Filtering by Severity

```typescript
import { getErrors, getWarnings, getSuggestions, filterBySeverity } from '@manifesto-ai/core';

// Errors only
const errors = getErrors(result);
// [{ severity: 'error', ... }]

// Warnings only
const warnings = getWarnings(result);
// [{ severity: 'warning', ... }]

// Suggestions only
const suggestions = getSuggestions(result);
// [{ severity: 'suggestion', ... }]

// Specific severity
const critical = filterBySeverity(result, 'error');
```

---

## Auto-Fix Suggestions

Automatically suggests fixes when validation fails.

```typescript
// ValidationIssue's suggestedFix
const issue = result.issues[0];
if (issue.suggestedFix) {
  console.log(`Fix: ${issue.suggestedFix.description}`);
  // "Fix: Set to minimum value (1)"

  // Auto-apply
  if (typeof issue.suggestedFix.value === 'number') {
    runtime.set(issue.path, issue.suggestedFix.value);
  }
}
```

### Auto-Fix Rules

```typescript
// Type conversion
// String → Number
{ description: 'Convert to number', value: ['toNumber', ['get', '$input']] }

// Number → String
{ description: 'Convert to string', value: ['toString', ['get', '$input']] }

// Range correction
// Set to minimum value
{ description: 'Set to minimum value (1)', value: 1 }

// Set to maximum value
{ description: 'Set to maximum value (100)', value: 100 }

// Email format
{ description: 'Enter a valid email address', value: null }
```

---

## Schema Metadata

### getSchemaMetadata

```typescript
import { getSchemaMetadata } from '@manifesto-ai/core';

const meta = getSchemaMetadata(z.string().optional().describe('Username'));
// {
//   type: 'ZodString',
//   isOptional: true,
//   isNullable: false,
//   description: 'Username'
// }
```

### getSchemaDefault

```typescript
import { getSchemaDefault } from '@manifesto-ai/core';

const defaultValue = getSchemaDefault(z.number().default(0));
// 0

const noDefault = getSchemaDefault(z.string());
// undefined
```

### toJsonSchema

```typescript
import { toJsonSchema } from '@manifesto-ai/core';

const jsonSchema = toJsonSchema(z.string().nullable().describe('Description'));
// {
//   type: 'string',
//   description: 'Description',
//   nullable: true
// }
```

---

## Practical Example: Order Form Validation

### Schema Definition

```typescript
import { z } from 'zod';
import { CommonSchemas } from '@manifesto-ai/core';

// Item schema
const itemSchema = z.object({
  id: CommonSchemas.id(),
  name: z.string().min(1, 'Please enter product name'),
  price: CommonSchemas.money().refine(p => p > 0, 'Price must be greater than 0'),
  quantity: CommonSchemas.positiveInt().max(99, 'Maximum 99 items can be ordered')
});

// Address schema
const addressSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: CommonSchemas.phoneKR(),
  zipCode: z.string().regex(/^\d{5}$/, 'Please enter 5-digit zip code'),
  address: z.string().min(10, 'Please enter detailed address'),
  detail: z.string().optional()
});

// Order schema
const orderDataSchema = z.object({
  items: z.array(itemSchema).min(1, 'Please add at least 1 item'),
  couponCode: z.string().optional(),
  shippingAddress: addressSchema,
  memo: z.string().max(500, 'Delivery memo must be within 500 characters').optional(),
  termsAgreed: z.literal(true, {
    errorMap: () => ({ message: 'Must agree to terms of service' })
  })
});

type OrderData = z.infer<typeof orderDataSchema>;
```

### Usage in Domain

```typescript
const orderDomain = defineDomain({
  name: 'order',
  dataSchema: orderDataSchema,
  stateSchema: z.object({
    isSubmitting: z.boolean(),
    validationErrors: z.record(z.array(z.string()))
  }),

  paths: {
    sources: {
      items: schemaToSource(
        z.array(itemSchema),
        { type: 'list', description: 'Order items list', importance: 'critical' },
        { defaultValue: [] }
      ),

      shippingAddress: schemaToSource(
        addressSchema,
        { type: 'address', description: 'Shipping address', importance: 'high' }
      ),

      couponCode: schemaToSource(
        z.string().optional(),
        { type: 'string', description: 'Discount coupon code' },
        { defaultValue: '' }
      ),

      termsAgreed: schemaToSource(
        z.boolean(),
        { type: 'boolean', description: 'Terms of service agreement' },
        { defaultValue: false }
      )
    }
    // ...
  }
});
```

### Validation on Form Submit

```typescript
async function submitOrder(runtime: DomainRuntime): Promise<void> {
  // 1. Sync validation
  const data = runtime.getSnapshot().data;
  const syncResult = validateDomainData(orderDomain, data);

  if (!syncResult.valid) {
    runtime.set('state.validationErrors', groupValidationByPath(syncResult));
    return;
  }

  // 2. Async validation (coupon)
  if (data.couponCode) {
    const asyncResult = await validateAsync(
      data.couponCode,
      'data.couponCode',
      validateCouponApi
    );

    if (!asyncResult.valid) {
      runtime.set('state.validationErrors', groupValidationByPath(asyncResult));
      return;
    }
  }

  // 3. Check preconditions
  const availability = runtime.checkPreconditions('submitOrder');
  if (!availability.available) {
    alert(availability.reasons.join('\n'));
    return;
  }

  // 4. Submit order
  await runtime.executeAction('submitOrder');
}
```

### Displaying Errors in React

```typescript
function FormField({ path, label }: { path: SemanticPath; label: string }) {
  const value = useValue(path);
  const errors = useValidationErrors(path);

  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        value={value ?? ''}
        onChange={e => runtime.set(path, e.target.value)}
        className={errors.length > 0 ? 'error' : ''}
      />
      {errors.map((error, i) => (
        <span key={i} className="error-message">{error.message}</span>
      ))}
    </div>
  );
}
```

---

## Next Steps

- [Domain Definition](03-domain-definition.md) - Domain definition with schemas
- [Policy Evaluation](08-policy.md) - Validation and policy integration
- [Runtime API](07-runtime.md) - Validation in runtime
