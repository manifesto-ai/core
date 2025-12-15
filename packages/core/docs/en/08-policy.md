# Policy Evaluation

```typescript
import { createRuntime } from '@manifesto-ai/core';

const runtime = createRuntime({ domain: orderDomain });

// Check action availability
const availability = runtime.checkPreconditions('checkout');
// {
//   available: false,
//   unsatisfiedConditions: [
//     { path: 'derived.hasShippingAddress', actualValue: false, satisfied: false }
//   ],
//   reasons: ['Shipping address must be entered'],
//   explanation: 'Action "checkout" is NOT available...'
// }

// Check field policy
const policy = runtime.getFieldPolicy('data.shippingAddress');
// { relevant: true, editable: true, required: true }
```

## Core Concept

### "Declare Conditions and Policies as Data"

Manifesto **declaratively** defines action preconditions and field visibility/editability/required states. This allows AI to accurately explain "Why is this button disabled?"

```typescript
// Precondition declaration
const checkoutAction = defineAction({
  preconditions: [
    condition('derived.hasItems', 'true', 'Cart must have items'),
    condition('derived.hasShippingAddress', 'true', 'Shipping address must be entered'),
    condition('state.isSubmitting', 'false', 'Must not already be submitting')
  ],
  effect: { type: 'ApiCall', ... },
  semantic: { verb: 'checkout', description: 'Process order payment' }
});

// Field policy declaration
const shippingAddressSource = defineSource({
  schema: addressSchema,
  policy: fieldPolicy({
    relevantWhen: [condition('derived.hasItems', 'true')],
    editableWhen: [condition('state.isSubmitting', 'false')],
    requiredWhen: [condition('derived.hasItems', 'true')]
  }),
  semantic: { type: 'address', description: 'Shipping address' }
});
```

---

## ConditionRef

A condition reference checks the boolean value of a path.

### Type Definition

```typescript
type ConditionRef = {
  /** Path to check */
  path: SemanticPath;

  /** Expected value ('true' or 'false', default: 'true') */
  expect?: 'true' | 'false';

  /** Human-readable reason */
  reason?: string;
};
```

### condition Helper

```typescript
import { condition } from '@manifesto-ai/core';

// Basic usage
condition('derived.hasItems', 'true', 'Cart must have items');
// { path: 'derived.hasItems', expect: 'true', reason: 'Cart must have items' }

// Defaults to 'true' when expect is omitted
condition('derived.isValid');
// { path: 'derived.isValid', expect: 'true' }

// Expecting 'false'
condition('state.isSubmitting', 'false', 'Must not be submitting');
// { path: 'state.isSubmitting', expect: 'false', reason: 'Must not be submitting' }
```

---

## Preconditions

### preconditions in ActionDefinition

```typescript
const submitOrderAction = defineAction({
  preconditions: [
    // Must have items
    condition('derived.hasItems', 'true', 'Cart must have items'),

    // Valid shipping address
    condition('derived.hasValidAddress', 'true', 'Valid shipping address required'),

    // Payment method selected
    condition('derived.hasPaymentMethod', 'true', 'Payment method must be selected'),

    // Terms agreed
    condition('data.termsAgreed', 'true', 'Must agree to terms of service'),

    // Not submitting
    condition('state.isSubmitting', 'false', 'Already processing')
  ],
  effect: apiCall('/api/orders', 'POST', ...),
  semantic: {
    verb: 'submitOrder',
    object: 'order',
    description: 'Submit the final order'
  }
});
```

### Precondition Evaluation

```typescript
import { evaluatePrecondition, evaluateAllPreconditions } from '@manifesto-ai/core';

// Evaluate single condition
const result = evaluatePrecondition(
  condition('derived.hasItems', 'true', 'Cart must have items'),
  { get: (path) => runtime.get(path) }
);
// {
//   condition: { path: 'derived.hasItems', expect: 'true', ... },
//   actualValue: true,
//   satisfied: true,
//   debug: { path: 'derived.hasItems', expectedBoolean: true, actualBoolean: true }
// }

// Evaluate all conditions
const results = evaluateAllPreconditions(
  action.preconditions,
  { get: runtime.get }
);
```

### PreconditionEvaluationResult Type

```typescript
type PreconditionEvaluationResult = {
  /** Condition reference */
  condition: ConditionRef;

  /** Actually evaluated value */
  actualValue: unknown;

  /** Whether condition is satisfied */
  satisfied: boolean;

  /** Debug information */
  debug?: {
    path: SemanticPath;
    expectedBoolean: boolean;
    actualBoolean: boolean;
  };
};
```

---

## Action Availability

### checkActionAvailability

```typescript
import { checkActionAvailability } from '@manifesto-ai/core';

const availability = checkActionAvailability(
  checkoutAction,
  { get: runtime.get }
);

if (availability.available) {
  // Can execute
  runtime.executeAction('checkout');
} else {
  // Cannot execute - show reasons
  console.log('Cannot checkout:', availability.reasons);
  // ['Shipping address must be entered']
}
```

### ActionAvailability Type

```typescript
type ActionAvailability = {
  /** Whether action can be executed */
  available: boolean;

  /** Unsatisfied conditions */
  unsatisfiedConditions: PreconditionEvaluationResult[];

  /** Human-readable reasons */
  reasons: string[];

  /** Detailed explanation for AI */
  explanation: string;
};
```

### AI Explanation Generation

```typescript
// availability.explanation example:
`Action "checkout" is NOT available.

Unsatisfied preconditions:
  - derived.hasShippingAddress
    Expected: true
    Actual: false (raw: false)
    Reason: Shipping address must be entered

To enable this action:
  - Make derived.hasShippingAddress evaluate to true`
```

### Usage in Runtime

```typescript
const runtime = createRuntime({ domain: orderDomain });

// checkPreconditions internally uses checkActionAvailability
const status = runtime.checkPreconditions('checkout');
// {
//   available: false,
//   unsatisfied: [
//     { path: 'derived.hasShippingAddress', actual: false, reason: '...' }
//   ]
// }

// Or get status of all actions
const allActions = runtime.getAvailableActions();
// {
//   addItem: { available: true },
//   removeItem: { available: true },
//   checkout: { available: false, reasons: ['...'] }
// }
```

---

## Field Policy

### FieldPolicy Type

```typescript
type FieldPolicy = {
  /** Conditions when this field is meaningful (should display) */
  relevantWhen?: ConditionRef[];

  /** Conditions when this field is editable */
  editableWhen?: ConditionRef[];

  /** Conditions when this field is required */
  requiredWhen?: ConditionRef[];
};
```

### fieldPolicy Helper

```typescript
import { fieldPolicy, condition } from '@manifesto-ai/core';

const addressPolicy = fieldPolicy({
  // Show only when there are items
  relevantWhen: [
    condition('derived.hasItems', 'true')
  ],

  // Editable only when not submitting
  editableWhen: [
    condition('state.isSubmitting', 'false')
  ],

  // Required when there are items
  requiredWhen: [
    condition('derived.hasItems', 'true')
  ]
});
```

### Conditional Policy Examples

```typescript
// Coupon code field
const couponPolicy = fieldPolicy({
  // Relevant only when subtotal is 10000 or more
  relevantWhen: [
    condition('derived.canUseCoupon', 'true')
  ],

  // Always editable (except during submission)
  editableWhen: [
    condition('state.isSubmitting', 'false')
  ]

  // Not required (requiredWhen omitted)
});

// Business registration number field
const businessNumberPolicy = fieldPolicy({
  // Show only for business type
  relevantWhen: [
    condition('data.customerType', 'true')  // 'business' converted to true
  ],

  // Editable conditions
  editableWhen: [
    condition('state.isSubmitting', 'false')
  ],

  // Required for business type
  requiredWhen: [
    condition('data.customerType', 'true')
  ]
});
```

### Field Policy Evaluation

```typescript
import { evaluateFieldPolicy } from '@manifesto-ai/core';

const evaluation = evaluateFieldPolicy(
  addressPolicy,
  { get: runtime.get }
);
// {
//   relevant: true,
//   relevantReason: undefined,
//   relevantConditions: [{ condition: {...}, actualValue: true, satisfied: true }],
//
//   editable: true,
//   editableReason: undefined,
//   editableConditions: [{ condition: {...}, actualValue: false, satisfied: true }],
//
//   required: true,
//   requiredReason: undefined,
//   requiredConditions: [{ condition: {...}, actualValue: true, satisfied: true }]
// }
```

### FieldPolicyEvaluation Type

```typescript
type FieldPolicyEvaluation = {
  /** Whether this field is currently meaningful (should display) */
  relevant: boolean;
  relevantReason?: string;
  relevantConditions?: ConditionEvaluationDetail[];

  /** Whether this field is currently editable */
  editable: boolean;
  editableReason?: string;
  editableConditions?: ConditionEvaluationDetail[];

  /** Whether this field is currently required */
  required: boolean;
  requiredReason?: string;
  requiredConditions?: ConditionEvaluationDetail[];
};
```

---

## UI State Transformation

### policyToUIState

Transforms field policy evaluation result to a form directly usable in UI.

```typescript
import { policyToUIState } from '@manifesto-ai/core';

const evaluation = evaluateFieldPolicy(policy, ctx);
const uiState = policyToUIState(evaluation);
// {
//   visible: true,      // relevant value
//   enabled: true,      // relevant && editable
//   showRequired: true, // relevant && required
//   disabledReason: undefined,
//   hiddenReason: undefined
// }
```

### FieldUIState Type

```typescript
type FieldUIState = {
  /** Should be visible */
  visible: boolean;

  /** Is enabled */
  enabled: boolean;

  /** Should show required indicator */
  showRequired: boolean;

  /** Reason for being disabled (if any) */
  disabledReason?: string;

  /** Reason for being hidden (if any) */
  hiddenReason?: string;
};
```

### Usage in React

```typescript
// In React Bridge
function FormField({ path }: { path: SemanticPath }) {
  const uiState = useFieldUIState(path);

  if (!uiState.visible) {
    return null;
  }

  return (
    <div>
      <label>
        {getLabel(path)}
        {uiState.showRequired && <span className="required">*</span>}
      </label>
      <input
        disabled={!uiState.enabled}
        title={uiState.disabledReason}
      />
    </div>
  );
}
```

---

## Batch Evaluation

### Multiple Field Policy Evaluation

```typescript
import { evaluateMultipleFieldPolicies } from '@manifesto-ai/core';

const policies = {
  'data.shippingAddress': addressPolicy,
  'data.couponCode': couponPolicy,
  'data.businessNumber': businessNumberPolicy
};

const results = evaluateMultipleFieldPolicies(policies, { get: runtime.get });
// {
//   'data.shippingAddress': { relevant: true, editable: true, required: true },
//   'data.couponCode': { relevant: true, editable: true, required: false },
//   'data.businessNumber': { relevant: false, editable: true, required: false }
// }
```

---

## Dependency Extraction

### Precondition Dependencies

```typescript
import { extractPreconditionDependencies } from '@manifesto-ai/core';

const deps = extractPreconditionDependencies(checkoutAction.preconditions);
// [
//   'derived.hasItems',
//   'derived.hasValidAddress',
//   'derived.hasPaymentMethod',
//   'data.termsAgreed',
//   'state.isSubmitting'
// ]

// Preconditions should be re-evaluated if any of these paths change
```

### Field Policy Dependencies

```typescript
import { extractFieldPolicyDependencies } from '@manifesto-ai/core';

const deps = extractFieldPolicyDependencies(addressPolicy);
// ['derived.hasItems', 'state.isSubmitting']

// Use in subscriptions
for (const dep of deps) {
  runtime.subscribe(dep, () => {
    // Re-evaluate field policy
    const newEvaluation = evaluateFieldPolicy(addressPolicy, { get: runtime.get });
  });
}
```

---

## Required Changes Analysis

### analyzePreconditionRequirements

Analyzes changes needed to satisfy unsatisfied preconditions.

```typescript
import { analyzePreconditionRequirements } from '@manifesto-ai/core';

const availability = checkActionAvailability(checkoutAction, { get: runtime.get });
const requirements = analyzePreconditionRequirements(availability.unsatisfiedConditions);
// [
//   {
//     path: 'derived.hasShippingAddress',
//     currentValue: false,
//     requiredValue: true,
//     reason: 'Shipping address must be entered'
//   }
// ]
```

### AI Suggesting Solutions

```typescript
// Generate AI response
function suggestSolution(requirements: PreconditionRequirement[]): string {
  const suggestions: string[] = [];

  for (const req of requirements) {
    if (req.path.startsWith('derived.')) {
      // Trace derived path to source
      const sourceRequirements = traceToSource(req.path);
      suggestions.push(`${req.reason} (${sourceRequirements})`);
    } else {
      suggestions.push(`Set ${req.path}: ${req.reason}`);
    }
  }

  return suggestions.join('\n');
}
```

---

## AI Integration

### Field Policy Explanation Generation

```typescript
import { explainFieldPolicy } from '@manifesto-ai/core';

const explanation = explainFieldPolicy('data.shippingAddress', evaluation);
// Field: data.shippingAddress
//
// Relevant: Yes
// Editable: Yes
// Required: Yes
//   Because:
//   - derived.hasItems = true
```

### Full Context Generation

```typescript
function generatePolicyContext(runtime: DomainRuntime): PolicyContext {
  const actions: Record<string, ActionAvailability> = {};
  const fields: Record<SemanticPath, FieldPolicyEvaluation> = {};

  // Evaluate preconditions for all actions
  for (const [name, action] of Object.entries(domain.actions)) {
    actions[name] = checkActionAvailability(action, { get: runtime.get });
  }

  // Evaluate policies for all fields
  for (const [path, source] of Object.entries(domain.paths.sources)) {
    if (source.policy) {
      fields[path] = evaluateFieldPolicy(source.policy, { get: runtime.get });
    }
  }

  return { actions, fields };
}
```

---

## Practical Example: Order Form

### Domain Definition

```typescript
const orderDomain = defineDomain({
  name: 'order',
  // ...

  paths: {
    sources: {
      items: defineSource({
        schema: z.array(itemSchema),
        semantic: { type: 'list', description: 'Order items list' }
      }),

      shippingAddress: defineSource({
        schema: addressSchema,
        policy: fieldPolicy({
          relevantWhen: [condition('derived.hasItems', 'true')],
          editableWhen: [condition('state.isSubmitting', 'false')],
          requiredWhen: [condition('derived.hasItems', 'true')]
        }),
        semantic: { type: 'address', description: 'Shipping address' }
      }),

      couponCode: defineSource({
        schema: z.string().optional(),
        policy: fieldPolicy({
          relevantWhen: [condition('derived.subtotal', 'true')],
          editableWhen: [
            condition('state.isSubmitting', 'false'),
            condition('state.couponApplied', 'false')
          ]
        }),
        semantic: { type: 'string', description: 'Discount coupon code' }
      })
    },

    derived: {
      hasItems: defineDerived({
        deps: ['data.items'],
        expr: ['>', ['length', ['get', 'data.items']], 0],
        semantic: { type: 'boolean', description: 'Whether items exist' }
      }),

      hasShippingAddress: defineDerived({
        deps: ['data.shippingAddress'],
        expr: ['and',
          ['get', 'data.shippingAddress'],
          ['get', 'data.shippingAddress.zipCode']
        ],
        semantic: { type: 'boolean', description: 'Whether valid shipping address exists' }
      }),

      canCheckout: defineDerived({
        deps: ['derived.hasItems', 'derived.hasShippingAddress', 'state.isSubmitting'],
        expr: ['and',
          ['get', 'derived.hasItems'],
          ['get', 'derived.hasShippingAddress'],
          ['not', ['get', 'state.isSubmitting']]
        ],
        semantic: { type: 'boolean', description: 'Whether checkout is possible' }
      })
    }
  },

  actions: {
    checkout: defineAction({
      preconditions: [
        condition('derived.hasItems', 'true', 'Cart must have items'),
        condition('derived.hasShippingAddress', 'true', 'Shipping address must be entered'),
        condition('state.isSubmitting', 'false', 'Already processing')
      ],
      effect: sequence([
        setState('state.isSubmitting', true),
        apiCall('/api/orders', 'POST'),
        setState('state.isSubmitting', false)
      ]),
      semantic: { verb: 'checkout', object: 'order', description: 'Process order payment' }
    })
  }
});
```

### Usage Example

```typescript
const runtime = createRuntime({ domain: orderDomain });

// Empty cart state
runtime.checkPreconditions('checkout');
// { available: false, reasons: ['Cart must have items'] }

runtime.getFieldPolicy('data.shippingAddress');
// { relevant: false, editable: true, required: false }

// After adding item
runtime.set('data.items', [{ id: '1', name: 'Laptop', price: 1500000, quantity: 1 }]);

runtime.checkPreconditions('checkout');
// { available: false, reasons: ['Shipping address must be entered'] }

runtime.getFieldPolicy('data.shippingAddress');
// { relevant: true, editable: true, required: true }

// After entering shipping address
runtime.set('data.shippingAddress', {
  address: '123 Main St...',
  zipCode: '12345'
});

runtime.checkPreconditions('checkout');
// { available: true }

// Execute checkout
await runtime.executeAction('checkout');
```

---

## Next Steps

- [Domain Definition](03-domain-definition.md) - Domain definition with policies
- [Runtime API](07-runtime.md) - Using policies in runtime
- [DAG & Change Propagation](06-dag-propagation.md) - Policy dependencies and propagation
