# Domain Definition

```typescript
import {
  defineDomain,
  defineSource,
  defineDerived,
  defineAsync,
  defineAction,
  fieldPolicy,
  condition,
  sequence,
  setState,
  setValue,
  apiCall,
  z
} from '@manifesto-ai/core';

// Complete order domain definition
const orderDomain = defineDomain({
  id: 'order',
  name: 'Order',
  description: 'E-commerce order management domain',

  dataSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      quantity: z.number()
    })),
    couponCode: z.string().optional(),
    shippingAddress: z.string().optional()
  }),

  stateSchema: z.object({
    isSubmitting: z.boolean(),
    selectedItemId: z.string().nullable()
  }),

  initialState: {
    isSubmitting: false,
    selectedItemId: null
  },

  paths: {
    sources: {
      // 'items' automatically becomes 'data.items'
      items: defineSource({
        schema: z.array(z.object({
          id: z.string(),
          name: z.string(),
          price: z.number(),
          quantity: z.number()
        })),
        defaultValue: [],
        semantic: { type: 'list', description: 'Order items list' }
      }),
      couponCode: defineSource({
        schema: z.string().optional(),
        policy: fieldPolicy({
          relevantWhen: [condition('derived.hasItems')],
          editableWhen: [condition('derived.isNotSubmitting')]
        }),
        semantic: { type: 'input', description: 'Coupon code' }
      })
    },
    derived: {
      // 'subtotal' automatically becomes 'derived.subtotal'
      subtotal: defineDerived({
        deps: ['data.items'],
        expr: ['sum', ['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]],
        semantic: { type: 'currency', description: 'Order subtotal' }
      }),
      hasItems: defineDerived({
        deps: ['data.items'],
        expr: ['>', ['length', ['get', 'data.items']], 0],
        semantic: { type: 'boolean', description: 'Whether cart has items' }
      }),
      isNotSubmitting: defineDerived({
        deps: ['state.isSubmitting'],
        expr: ['!', ['get', 'state.isSubmitting']],
        semantic: { type: 'boolean', description: 'Whether not submitting' }
      })
    }
  },

  actions: {
    checkout: defineAction({
      deps: ['data.items', 'state.isSubmitting'],
      preconditions: [
        condition('derived.hasItems', { reason: 'Cart must have items' }),
        condition('derived.isNotSubmitting', { reason: 'Already submitting' })
      ],
      effect: sequence([
        setState('state.isSubmitting', true, 'Start submission'),
        apiCall({ method: 'POST', endpoint: '/api/orders', description: 'Create order' }),
        setState('state.isSubmitting', false, 'Complete submission')
      ]),
      semantic: {
        type: 'action',
        verb: 'checkout',
        description: 'Process checkout',
        risk: 'high'
      }
    })
  }
});
```

## defineDomain()

Creates a complete domain definition. A domain is the single source of truth for business logic.

### DefineDomainOptions Type

```typescript
type DefineDomainOptions<TData, TState> = {
  /** Unique domain identifier */
  id: string;

  /** Human-readable domain name */
  name: string;

  /** Domain description (for AI understanding) */
  description: string;

  /** Data schema (Zod) - persistent business data */
  dataSchema: ZodType<TData>;

  /** State schema (Zod) - temporary UI state */
  stateSchema: ZodType<TState>;

  /** Initial state value */
  initialState: TState;

  /** Path definitions (optional) */
  paths?: Partial<PathDefinitions<TData, TState>>;

  /** Action definitions (optional) */
  actions?: Record<string, ActionDefinition>;

  /** Domain metadata (optional) */
  meta?: DomainMeta;
};
```

### ManifestoDomain Return Type

```typescript
type ManifestoDomain<TData, TState> = {
  id: string;
  name: string;
  description: string;
  paths: PathDefinitions<TData, TState>;
  actions: Record<string, ActionDefinition>;
  dataSchema: ZodType<TData>;
  stateSchema: ZodType<TState>;
  initialState: TState;
  meta?: DomainMeta;
};
```

### Auto-prefixing Rules

Keys within `paths` automatically get namespace prefixes:

| Section | Input Key | Result |
|---------|-----------|--------|
| `sources` | `items` | `data.items` |
| `sources` | `user.name` | `data.user.name` |
| `derived` | `total` | `derived.total` |
| `async` | `shippingRates` | `async.shippingRates` |

If a prefix already exists, it's preserved:

```typescript
paths: {
  sources: {
    'data.items': defineSource({...}),  // stays 'data.items'
    'items': defineSource({...})        // becomes 'data.items'
  }
}
```

### Type Inference

TypeScript automatically infers `TData` and `TState` types from `dataSchema` and `stateSchema`:

```typescript
const domain = defineDomain({
  dataSchema: z.object({
    items: z.array(z.object({ id: z.string(), price: z.number() }))
  }),
  stateSchema: z.object({
    isLoading: z.boolean()
  }),
  // ...
});

// Type inferred:
// domain: ManifestoDomain<{ items: Array<{ id: string; price: number }> }, { isLoading: boolean }>
```

---

## defineSource()

Defines user input or externally injected data fields. Located in `data.*` namespace.

### DefineSourceOptions Type

```typescript
type DefineSourceOptions = {
  /** Zod schema - value type and validation rules */
  schema: ZodType;

  /** Default value (optional) */
  defaultValue?: unknown;

  /** Field policy (optional) - dynamic relevance/editability/required */
  policy?: FieldPolicy;

  /** Semantic metadata - for AI understanding */
  semantic: SemanticMeta;
};
```

### SourceDefinition Return Type

```typescript
type SourceDefinition = {
  schema: ZodType;
  defaultValue?: unknown;
  policy?: FieldPolicy;
  semantic: SemanticMeta;  // default: readable: true, writable: true
};
```

### FieldPolicy Integration

Conditionally control field's dynamic state:

```typescript
const couponCodeSource = defineSource({
  schema: z.string().optional(),
  policy: fieldPolicy({
    // Only show when cart has items
    relevantWhen: [condition('derived.hasItems')],
    // Only editable when not submitting
    editableWhen: [condition('derived.isNotSubmitting')],
    // Required when total is over $100
    requiredWhen: [condition('derived.isHighValue')]
  }),
  semantic: {
    type: 'input',
    description: 'Discount coupon code'
  }
});
```

### Examples

```typescript
// Basic input field
const nameSource = defineSource({
  schema: z.string().min(1),
  defaultValue: '',
  semantic: { type: 'input', description: 'Product name' }
});

// Array field
const itemsSource = defineSource({
  schema: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number().positive(),
    quantity: z.number().int().min(1)
  })),
  defaultValue: [],
  semantic: {
    type: 'list',
    description: 'Order items list',
    importance: 'critical'
  }
});

// Conditional field
const businessTaxIdSource = defineSource({
  schema: z.string().optional(),
  policy: fieldPolicy({
    relevantWhen: [condition('derived.isBusinessAccount')],
    requiredWhen: [condition('derived.isBusinessAccount')]
  }),
  semantic: { type: 'input', description: 'Business tax ID' }
});
```

---

## defineDerived()

Defines values computed synchronously from other paths. Located in `derived.*` namespace.

### DefineDerivedOptions Type

```typescript
type DefineDerivedOptions = {
  /** Dependent paths */
  deps: SemanticPath[];

  /** Computation expression (Expression DSL) */
  expr: Expression;

  /** Semantic metadata */
  semantic: SemanticMeta;
};
```

### DerivedDefinition Return Type

```typescript
type DerivedDefinition = {
  deps: SemanticPath[];
  expr: Expression;
  semantic: SemanticMeta;  // default: readable: true, writable: false
};
```

### Relationship between deps and expr

`deps` is for change tracking, `expr` is the actual computation logic:

```typescript
// expr is re-evaluated when paths in deps change
const subtotal = defineDerived({
  deps: ['data.items'],  // recalculate on data.items change
  expr: ['sum', ['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]],
  semantic: { type: 'currency', description: 'Subtotal' }
});
```

**Note**: All paths referenced in `expr` should be included in `deps`. Otherwise, recalculation won't be triggered when those paths change.

### Circular Dependency Prevention

Derived values can reference other derived values, but circular references are not allowed:

```typescript
// Allowed: Chain dependency
const subtotal = defineDerived({
  deps: ['data.items'],
  expr: ['sum', ['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]],
  semantic: { type: 'currency', description: 'Subtotal' }
});

const discount = defineDerived({
  deps: ['derived.subtotal', 'data.couponCode'],
  expr: ['if',
    ['!=', ['get', 'data.couponCode'], null],
    ['*', ['get', 'derived.subtotal'], 0.1],
    0
  ],
  semantic: { type: 'currency', description: 'Discount amount' }
});

const total = defineDerived({
  deps: ['derived.subtotal', 'derived.discount'],
  expr: ['-', ['get', 'derived.subtotal'], ['get', 'derived.discount']],
  semantic: { type: 'currency', description: 'Total' }
});

// Forbidden: Circular reference (build error)
// A depends on B, B depends on A
```

### Examples

```typescript
// Numeric calculation
const itemCount = defineDerived({
  deps: ['data.items'],
  expr: ['length', ['get', 'data.items']],
  semantic: { type: 'count', description: 'Item count' }
});

// Boolean condition
const canCheckout = defineDerived({
  deps: ['data.items', 'state.isSubmitting'],
  expr: ['all',
    ['>', ['length', ['get', 'data.items']], 0],
    ['!', ['get', 'state.isSubmitting']]
  ],
  semantic: { type: 'boolean', description: 'Whether checkout is possible' }
});

// String composition
const orderSummary = defineDerived({
  deps: ['derived.itemCount', 'derived.total'],
  expr: ['concat',
    ['toString', ['get', 'derived.itemCount']], ' items, ',
    'Total $', ['toString', ['get', 'derived.total']]
  ],
  semantic: { type: 'string', description: 'Order summary' }
});

// Conditional value
const shippingFee = defineDerived({
  deps: ['derived.subtotal'],
  expr: ['case',
    [['>=', ['get', 'derived.subtotal'], 50000], 0],
    3000
  ],
  semantic: { type: 'currency', description: 'Shipping fee (free over $50)' }
});
```

---

## defineAsync()

Defines async data sources like external API calls. Located in `async.*` namespace.

### DefineAsyncOptions Type

```typescript
type DefineAsyncOptions = {
  /** Trigger paths - async call when these paths change */
  deps: SemanticPath[];

  /** Execution condition (optional) - only call when true */
  condition?: Expression;

  /** Debounce time in ms (optional) */
  debounce?: number;

  /** Effect to execute */
  effect: Effect;

  /** Result storage path */
  resultPath: SemanticPath;

  /** Loading state path */
  loadingPath: SemanticPath;

  /** Error state path */
  errorPath: SemanticPath;

  /** Semantic metadata */
  semantic: SemanticMeta;
};
```

### AsyncDefinition Return Type

```typescript
type AsyncDefinition = {
  deps: SemanticPath[];
  condition?: Expression;
  debounce?: number;
  effect: Effect;
  resultPath: SemanticPath;
  loadingPath: SemanticPath;
  errorPath: SemanticPath;
  semantic: SemanticMeta;  // default: readable: true, writable: false
};
```

### condition and debounce

```typescript
const shippingRatesAsync = defineAsync({
  deps: ['data.items', 'data.shippingAddress'],
  // Only call when address exists and items exist
  condition: ['all',
    ['>', ['length', ['get', 'data.items']], 0],
    ['!=', ['get', 'data.shippingAddress'], null]
  ],
  // 300ms debounce - only last change executes on rapid consecutive changes
  debounce: 300,
  effect: apiCall({
    method: 'GET',
    endpoint: '/api/shipping-rates',
    query: {
      address: ['get', 'data.shippingAddress'],
      itemCount: ['length', ['get', 'data.items']]
    },
    description: 'Fetch shipping rates'
  }),
  resultPath: 'async.shippingRates',
  loadingPath: 'state.shippingLoading',
  errorPath: 'state.shippingError',
  semantic: { type: 'async', description: 'Shipping rate options' }
});
```

### resultPath/loadingPath/errorPath

Store three states of async operation in separate paths:

| Path | Value | Description |
|------|-------|-------------|
| `resultPath` | API response data | Stored on success |
| `loadingPath` | `true`/`false` | Whether loading |
| `errorPath` | Error object or `null` | Error info on failure |

### Examples

```typescript
// User search
const userSearchAsync = defineAsync({
  deps: ['data.searchQuery'],
  condition: ['>=', ['length', ['get', 'data.searchQuery']], 2],  // 2+ characters
  debounce: 500,
  effect: apiCall({
    method: 'GET',
    endpoint: '/api/users',
    query: { q: ['get', 'data.searchQuery'] },
    description: 'Search users'
  }),
  resultPath: 'async.searchResults',
  loadingPath: 'state.searchLoading',
  errorPath: 'state.searchError',
  semantic: { type: 'async', description: 'Search results' }
});

// Product detail
const productDetailAsync = defineAsync({
  deps: ['state.selectedProductId'],
  condition: ['!=', ['get', 'state.selectedProductId'], null],
  effect: apiCall({
    method: 'GET',
    endpoint: ['concat', '/api/products/', ['get', 'state.selectedProductId']],
    description: 'Fetch product detail'
  }),
  resultPath: 'async.productDetail',
  loadingPath: 'state.productLoading',
  errorPath: 'state.productError',
  semantic: { type: 'async', description: 'Selected product detail' }
});
```

---

## defineAction()

Defines operations users can execute. Only executable when preconditions are satisfied.

### DefineActionOptions Type

```typescript
type DefineActionOptions = {
  /** Dependent paths */
  deps: SemanticPath[];

  /** Input parameter schema (optional) */
  input?: ZodType;

  /** Effect to execute */
  effect: Effect;

  /** Execution preconditions (optional) */
  preconditions?: ConditionRef[];

  /** Semantic metadata (ActionSemanticMeta) */
  semantic: ActionSemanticMeta;
};
```

### ActionDefinition Return Type

```typescript
type ActionDefinition = {
  deps: SemanticPath[];
  input?: ZodType;
  effect: Effect;
  preconditions?: ConditionRef[];
  semantic: ActionSemanticMeta;
};
```

### preconditions

Conditions checked before action execution. All conditions must be satisfied for action to execute:

```typescript
const checkoutAction = defineAction({
  deps: ['data.items', 'state.isSubmitting'],
  preconditions: [
    // Cart must have items
    {
      path: 'derived.hasItems',
      expect: 'true',
      reason: 'Cart must have items to checkout'
    },
    // Must not be already submitting
    {
      path: 'state.isSubmitting',
      expect: 'false',
      reason: 'Already processing checkout'
    },
    // Required info must be entered
    {
      path: 'derived.hasShippingAddress',
      expect: 'true',
      reason: 'Shipping address is required'
    }
  ],
  effect: sequence([...]),
  semantic: { type: 'action', verb: 'checkout', description: 'Checkout' }
});
```

### effect

Defines the Effect the action will execute. See [Effect System](05-effect-system.md) for details.

### ActionSemanticMeta

Action-specific metadata with additional fields beyond basic `SemanticMeta`:

```typescript
type ActionSemanticMeta = SemanticMeta & {
  /** Verb - the action AI understands */
  verb: string;

  /** Risk level - affects AI's auto-execution decisions */
  risk?: 'none' | 'low' | 'medium' | 'high' | 'critical';

  /** Expected outcome */
  expectedOutcome?: string;

  /** Whether reversible */
  reversible?: boolean;
};
```

### Examples

```typescript
// Simple action (no input)
const clearCartAction = defineAction({
  deps: ['data.items'],
  effect: setValue('data.items', [], 'Clear cart'),
  semantic: {
    type: 'action',
    verb: 'clear',
    description: 'Clear the cart',
    risk: 'medium',
    reversible: false
  }
});

// Action with input
const addItemAction = defineAction({
  deps: ['data.items'],
  input: z.object({
    id: z.string(),
    name: z.string(),
    price: z.number().positive(),
    quantity: z.number().int().min(1)
  }),
  preconditions: [
    condition('derived.isNotSubmitting', { reason: 'Cannot add items during checkout' })
  ],
  effect: setValue('data.items',
    ['concat', ['get', 'data.items'], [['get', 'input']]],
    'Add item'
  ),
  semantic: {
    type: 'action',
    verb: 'add',
    description: 'Add item to cart',
    risk: 'low',
    reversible: true
  }
});

// Dangerous action
const deleteOrderAction = defineAction({
  deps: ['data.orderId', 'data.status'],
  preconditions: [
    condition('derived.isDraft', { reason: 'Only draft orders can be deleted' })
  ],
  effect: apiCall({
    method: 'DELETE',
    endpoint: ['concat', '/api/orders/', ['get', 'data.orderId']],
    description: 'Delete order'
  }),
  semantic: {
    type: 'action',
    verb: 'delete',
    description: 'Permanently delete order',
    risk: 'critical',
    reversible: false,
    expectedOutcome: 'Order will be permanently deleted and cannot be recovered'
  }
});
```

---

## Helper Functions

### fieldPolicy()

Creates a FieldPolicy object:

```typescript
function fieldPolicy(options: {
  relevantWhen?: ConditionRef[];
  editableWhen?: ConditionRef[];
  requiredWhen?: ConditionRef[];
}): FieldPolicy;

// Usage
const policy = fieldPolicy({
  relevantWhen: [condition('derived.showAdvanced')],
  editableWhen: [condition('derived.isNotSubmitting')],
  requiredWhen: [condition('derived.needsAddress')]
});
```

### condition()

Creates a ConditionRef object:

```typescript
function condition(
  path: SemanticPath,
  options?: { expect?: 'true' | 'false'; reason?: string }
): ConditionRef;

// Usage
condition('derived.hasItems');
// → { path: 'derived.hasItems', expect: 'true' }

condition('state.isSubmitting', { expect: 'false', reason: 'Must not be submitting' });
// → { path: 'state.isSubmitting', expect: 'false', reason: 'Must not be submitting' }
```

---

## Domain Validation

### validateDomain()

Validates the domain definition:

```typescript
import { validateDomain } from '@manifesto-ai/core';

const result = validateDomain(orderDomain);
// { valid: boolean, issues: ValidationIssue[] }

if (!result.valid) {
  result.issues.forEach(issue => {
    console.log(`[${issue.severity}] ${issue.path}: ${issue.message}`);
  });
}
```

### ValidationResult Type

```typescript
type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

type ValidationIssue = {
  code: string;
  message: string;
  path: SemanticPath;
  severity: 'error' | 'warning' | 'info' | 'suggestion';
  suggestedFix?: {
    description: string;
    value: Expression;
  };
};
```

### Common Validation Errors

| Code | Cause | Solution |
|------|-------|----------|
| `CIRCULAR_DEPENDENCY` | Circular reference between derived | Redesign dependency chain |
| `MISSING_DEPENDENCY` | Referenced in expr but not in deps | Add path to deps |
| `INVALID_PATH` | Reference to non-existent path | Check path name |
| `SCHEMA_MISMATCH` | source schema doesn't match dataSchema | Sync schemas |

---

## Next Steps

- [Expression DSL](04-expression-dsl.md) - How to write expr
- [Effect System](05-effect-system.md) - How to define effect
- [Policy Evaluation](08-policy.md) - FieldPolicy and preconditions evaluation
