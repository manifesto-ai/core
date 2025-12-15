# Effect System

```typescript
import {
  sequence,
  setState,
  apiCall,
  setValue,
  emitEvent,
  catchEffect,
  runEffect,
  isOk,
  isErr
} from '@manifesto-ai/core';

// Define order submission Effect
const submitOrderEffect = sequence([
  setState('state.isSubmitting', true, 'Start submission'),
  apiCall({
    method: 'POST',
    endpoint: '/api/orders',
    body: {
      items: ['get', 'data.items'],
      total: ['get', 'derived.total']
    },
    description: 'Create order'
  }),
  setValue('data.items', [], 'Clear cart'),
  setState('state.isSubmitting', false, 'Complete submission'),
  emitEvent('ui', { type: 'toast', message: 'Order completed', severity: 'success' }, 'Success notification')
]);

// Execute Effect
const result = await runEffect(submitOrderEffect, {
  handler: effectHandler,
  context: { get: (path) => runtime.get(path) }
});

if (isOk(result)) {
  console.log('Order successful');
} else {
  console.log('Order failed:', result.error.cause.message);
}
```

## Core Philosophy

### "Effect is a description, not execution"

Effect expresses "what will be done" as data. Actual execution happens when `runEffect()` is called:

```typescript
// This does NOT call the API - it's just a description saying "will call"
const effect = apiCall({
  method: 'POST',
  endpoint: '/api/orders',
  description: 'Create order'
});

// Now it actually calls the API
await runEffect(effect, config);
```

### Why This Matters

**1. Testable**
```typescript
// Verify just the Effect structure (no actual API calls)
expect(submitAction.effect._tag).toBe('Sequence');
expect(submitAction.effect.effects[0]._tag).toBe('SetState');
```

**2. Composable**
```typescript
const withLogging = sequence([
  emitEvent('analytics', { type: 'action_start' }, 'Start logging'),
  originalEffect,
  emitEvent('analytics', { type: 'action_end' }, 'End logging')
]);
```

**3. AI Understandable**
```typescript
// AI can analyze Effect to understand "what does this action do"
{
  _tag: 'Sequence',
  effects: [
    { _tag: 'SetState', path: 'state.isSubmitting', description: 'Start submission' },
    { _tag: 'ApiCall', endpoint: '/api/orders', description: 'Create order' },
    { _tag: 'SetState', path: 'state.isSubmitting', description: 'Complete submission' }
  ]
}
```

---

## Result<T, E> Pattern

### Why Result Instead of Exceptions

Exceptions make code flow unpredictable:

```typescript
// Exception approach - unclear where error occurs
try {
  await step1();
  await step2();  // Error here?
  await step3();
} catch (e) {
  // Don't know which step failed
}

// Result approach - explicit error handling
const result1 = await step1();
if (!result1.ok) return result1;

const result2 = await step2();
if (!result2.ok) return result2;

const result3 = await step3();
```

### ok(), err() Constructors

```typescript
import { ok, err } from '@manifesto-ai/core';

// Create success Result
const success = ok(42);
// { ok: true, value: 42 }

const successData = ok({ orderId: 'ORD-123', status: 'confirmed' });
// { ok: true, value: { orderId: 'ORD-123', status: 'confirmed' } }

// Create failure Result
const failure = err({ code: 'NOT_FOUND', message: 'Order not found' });
// { ok: false, error: { code: 'NOT_FOUND', message: '...' } }
```

### Type Guards: isOk(), isErr()

```typescript
import { isOk, isErr } from '@manifesto-ai/core';

const result = await runEffect(effect, config);

if (isOk(result)) {
  // TypeScript knows result.value type
  console.log('Success:', result.value);
}

if (isErr(result)) {
  // TypeScript knows result.error type
  console.log('Failed:', result.error.cause.message);
}
```

### Value Extraction: unwrap(), unwrapOr()

```typescript
import { unwrap, unwrapOr, unwrapErr } from '@manifesto-ai/core';

// unwrap: Return value if success, throw if failure
const value = unwrap(result);  // throws on failure

// unwrapOr: Return value if success, default if failure
const valueOrDefault = unwrapOr(result, 0);

// unwrapErr: Extract error (undefined if success)
const error = unwrapErr(result);
```

### Composition: map(), flatMap(), all()

```typescript
import { map, flatMap, all } from '@manifesto-ai/core';

// map: Transform success value
const doubled = map(result, (x) => x * 2);
// ok(21) → ok(42)
// err(...) → err(...)

// flatMap: Chain operations (function returns Result)
const chained = flatMap(result, (value) =>
  value > 0 ? ok(value) : err({ code: 'INVALID', message: 'Must be positive' })
);

// all: Combine multiple Results (all must succeed)
const combined = all([result1, result2, result3]);
// All ok → ok([value1, value2, value3])
// Any err → returns first err
```

---

## Effect Type Hierarchy

```
Effect
├── State Changes
│   ├── SetValueEffect    - Set data.* path value
│   └── SetStateEffect    - Set state.* path value
├── External Interactions
│   ├── ApiCallEffect     - HTTP API call
│   ├── NavigateEffect    - Page navigation
│   └── DelayEffect       - Wait
├── Composition
│   ├── SequenceEffect    - Sequential execution
│   └── ParallelEffect    - Parallel execution
├── Control Flow
│   ├── ConditionalEffect - Conditional execution
│   └── CatchEffect       - Error handling
└── Events
    └── EmitEventEffect   - Emit event
```

---

## State Change Effects

### SetValueEffect

Sets a value in the `data.*` namespace:

```typescript
type SetValueEffect = {
  _tag: 'SetValue';
  path: SemanticPath;      // Target path
  value: Expression;       // Value to set (can be computed via Expression)
  description: string;     // Description
};
```

```typescript
import { setValue } from '@manifesto-ai/core';

// Simple value setting
setValue('data.quantity', 5, 'Set quantity');

// Value computed via Expression
setValue('data.total', ['*', ['get', 'data.price'], ['get', 'data.quantity']], 'Calculate total');

// Array manipulation
setValue('data.items',
  ['concat', ['get', 'data.items'], [['get', 'input']]],
  'Add item'
);
```

### SetStateEffect

Sets a value in the `state.*` namespace:

```typescript
type SetStateEffect = {
  _tag: 'SetState';
  path: SemanticPath;
  value: Expression;
  description: string;
};
```

```typescript
import { setState } from '@manifesto-ai/core';

// Loading state
setState('state.isLoading', true, 'Start loading');

// Selection state
setState('state.selectedId', ['get', 'input.id'], 'Change selection');

// Error state
setState('state.error', null, 'Clear error');
```

---

## External Interaction Effects

### ApiCallEffect

Makes an HTTP API call:

```typescript
type ApiCallEffect = {
  _tag: 'ApiCall';
  endpoint: string | Expression;            // Endpoint (can be dynamic)
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, Expression>;        // Request body
  headers?: Record<string, string>;         // Request headers
  query?: Record<string, Expression>;       // Query parameters
  timeout?: number;                          // Timeout (ms)
  description: string;
};
```

```typescript
import { apiCall } from '@manifesto-ai/core';

// GET request
apiCall({
  method: 'GET',
  endpoint: '/api/products',
  query: {
    category: ['get', 'data.category'],
    limit: 20
  },
  description: 'Fetch product list'
});

// POST request (dynamic endpoint)
apiCall({
  method: 'POST',
  endpoint: ['concat', '/api/orders/', ['get', 'data.orderId'], '/items'],
  body: {
    productId: ['get', 'input.productId'],
    quantity: ['get', 'input.quantity']
  },
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 5000,
  description: 'Add item to order'
});

// DELETE request
apiCall({
  method: 'DELETE',
  endpoint: ['concat', '/api/items/', ['get', 'state.selectedId']],
  description: 'Delete selected item'
});
```

### NavigateEffect

Navigates to a page:

```typescript
type NavigateEffect = {
  _tag: 'Navigate';
  to: string | Expression;        // Path to navigate to
  mode?: 'push' | 'replace';      // History mode
  description: string;
};
```

```typescript
import { navigate } from '@manifesto-ai/core';

// Static path
navigate('/checkout', { description: 'Navigate to checkout page' });

// Dynamic path
navigate(
  ['concat', '/orders/', ['get', 'data.orderId']],
  { description: 'Navigate to order detail page' }
);

// Replace mode (prevent back navigation)
navigate('/login', { mode: 'replace', description: 'Replace with login page' });
```

### DelayEffect

Waits for a specified time:

```typescript
type DelayEffect = {
  _tag: 'Delay';
  ms: number;           // Wait time (ms)
  description: string;
};
```

```typescript
import { delay } from '@manifesto-ai/core';

delay(1000, 'Wait 1 second');
delay(300, 'Debounce');
```

---

## Composition Effects

### SequenceEffect

Executes Effects sequentially. Stops on first failure:

```typescript
type SequenceEffect = {
  _tag: 'Sequence';
  effects: Effect[];
  description: string;
};
```

```typescript
import { sequence, setState, apiCall, setValue } from '@manifesto-ai/core';

const checkoutEffect = sequence([
  setState('state.isSubmitting', true, 'Start submission'),
  apiCall({ method: 'POST', endpoint: '/api/orders', description: 'Create order' }),
  setValue('data.items', [], 'Clear cart'),
  setState('state.isSubmitting', false, 'Complete submission')
], 'Checkout process');
```

### ParallelEffect

Executes Effects in parallel:

```typescript
type ParallelEffect = {
  _tag: 'Parallel';
  effects: Effect[];
  waitAll?: boolean;    // Wait for all (default: true)
  description: string;
};
```

```typescript
import { parallel, apiCall } from '@manifesto-ai/core';

// Wait for all requests
const fetchAllData = parallel([
  apiCall({ method: 'GET', endpoint: '/api/user', description: 'User info' }),
  apiCall({ method: 'GET', endpoint: '/api/cart', description: 'Cart' }),
  apiCall({ method: 'GET', endpoint: '/api/recommendations', description: 'Recommendations' })
], { description: 'Load initial data' });

// Wait for first completion only
const raceRequest = parallel([
  apiCall({ method: 'GET', endpoint: '/api/primary', description: 'Primary server' }),
  apiCall({ method: 'GET', endpoint: '/api/backup', description: 'Backup server' })
], { waitAll: false, description: 'Use fastest response' });
```

---

## Control Flow Effects

### ConditionalEffect

Executes different Effects based on condition:

```typescript
type ConditionalEffect = {
  _tag: 'Conditional';
  condition: Expression;
  then: Effect;
  else?: Effect;
  description: string;
};
```

```typescript
import { conditional, apiCall, navigate } from '@manifesto-ai/core';

const checkoutFlow = conditional({
  condition: ['>', ['get', 'derived.total'], 100000],
  then: apiCall({
    method: 'POST',
    endpoint: '/api/premium-checkout',
    description: 'Premium checkout'
  }),
  else: apiCall({
    method: 'POST',
    endpoint: '/api/standard-checkout',
    description: 'Standard checkout'
  }),
  description: 'Checkout method branch'
});
```

### CatchEffect

Handles errors:

```typescript
type CatchEffect = {
  _tag: 'Catch';
  try: Effect;
  catch: Effect;
  finally?: Effect;
  description: string;
};
```

```typescript
import { catchEffect, apiCall, setState, emitEvent } from '@manifesto-ai/core';

const safeApiCall = catchEffect({
  try: apiCall({
    method: 'POST',
    endpoint: '/api/orders',
    description: 'Create order'
  }),
  catch: sequence([
    setState('state.error', 'Failed to create order', 'Set error message'),
    emitEvent('ui', {
      type: 'toast',
      message: 'Failed to create order',
      severity: 'error'
    }, 'Error notification')
  ]),
  finally: setState('state.isSubmitting', false, 'End loading'),
  description: 'Safe order creation'
});
```

---

## Event Effect

### EmitEventEffect

Emits a one-time event. Not stored in Snapshot, only delivered to subscribers:

```typescript
type EmitEventEffect = {
  _tag: 'EmitEvent';
  channel: 'ui' | 'domain' | 'analytics';
  payload: {
    type: string;
    message?: string;
    data?: unknown;
    severity?: 'success' | 'info' | 'warning' | 'error';
    duration?: number;
  };
  description: string;
};
```

```typescript
import { emitEvent } from '@manifesto-ai/core';

// UI toast
emitEvent('ui', {
  type: 'toast',
  message: 'Saved successfully',
  severity: 'success',
  duration: 3000
}, 'Save success notification');

// Domain event
emitEvent('domain', {
  type: 'orderCreated',
  data: { orderId: ['get', 'data.orderId'] }
}, 'Order created event');

// Analytics event
emitEvent('analytics', {
  type: 'checkout_completed',
  data: {
    total: ['get', 'derived.total'],
    itemCount: ['get', 'derived.itemCount']
  }
}, 'Checkout completed analytics');
```

---

## Effect Builder Functions

| Function | Description | Signature |
|----------|-------------|-----------|
| `setValue` | Set data value | `(path, value, description) => SetValueEffect` |
| `setState` | Set state value | `(path, value, description) => SetStateEffect` |
| `apiCall` | API call | `(options) => ApiCallEffect` |
| `navigate` | Page navigation | `(to, options?) => NavigateEffect` |
| `delay` | Wait | `(ms, description?) => DelayEffect` |
| `sequence` | Sequential execution | `(effects, description?) => SequenceEffect` |
| `parallel` | Parallel execution | `(effects, options?) => ParallelEffect` |
| `conditional` | Conditional execution | `(options) => ConditionalEffect` |
| `catchEffect` | Error handling | `(options) => CatchEffect` |
| `emitEvent` | Emit event | `(channel, payload, description?) => EmitEventEffect` |

---

## runEffect()

Actually executes an Effect:

```typescript
async function runEffect(
  effect: Effect,
  config: EffectRunnerConfig
): Promise<EffectResult>
```

### EffectHandler Interface

Handler for Effect execution:

```typescript
type EffectHandler = {
  setValue: (path: SemanticPath, value: unknown) => void;
  setState: (path: SemanticPath, value: unknown) => void;
  apiCall: (request: {
    endpoint: string;
    method: string;
    body?: unknown;
    headers?: Record<string, string>;
    query?: Record<string, unknown>;
    timeout?: number;
  }) => Promise<unknown>;
  navigate: (to: string, mode?: 'push' | 'replace') => void;
  emitEvent: (channel: string, payload: unknown) => void;
};
```

### EffectRunnerConfig

```typescript
type EffectRunnerConfig = {
  handler: EffectHandler;
  context: EvaluationContext;
};
```

### Usage Example

```typescript
const result = await runEffect(effect, {
  handler: {
    setValue: (path, value) => runtime.set(path, value),
    setState: (path, value) => runtime.set(path, value),
    apiCall: async (request) => {
      const response = await fetch(request.endpoint, {
        method: request.method,
        headers: request.headers,
        body: request.body ? JSON.stringify(request.body) : undefined
      });
      if (!response.ok) throw new Error(response.statusText);
      return response.json();
    },
    navigate: (to, mode) => {
      if (mode === 'replace') window.history.replaceState({}, '', to);
      else window.history.pushState({}, '', to);
    },
    emitEvent: (channel, payload) => {
      eventBus.emit(channel, payload);
    }
  },
  context: {
    get: (path) => runtime.get(path)
  }
});
```

---

## Practical Patterns

### Transaction Style

Process multiple state changes atomically:

```typescript
const submitOrder = sequence([
  // 1. Start loading
  setState('state.isSubmitting', true, 'Start submission'),

  // 2. API call
  apiCall({
    method: 'POST',
    endpoint: '/api/orders',
    body: {
      items: ['get', 'data.items'],
      shippingAddress: ['get', 'data.shippingAddress'],
      paymentMethod: ['get', 'data.paymentMethod']
    },
    description: 'Create order'
  }),

  // 3. Success handling
  setValue('data.items', [], 'Clear cart'),
  emitEvent('ui', { type: 'toast', message: 'Order completed', severity: 'success' }, 'Success notification'),

  // 4. End loading
  setState('state.isSubmitting', false, 'Complete submission')
]);
```

### Error Recovery

```typescript
const safeSubmit = catchEffect({
  try: sequence([
    setState('state.isSubmitting', true, 'Start submission'),
    apiCall({ method: 'POST', endpoint: '/api/orders', description: 'Create order' }),
    setValue('data.items', [], 'Clear cart'),
    navigate('/order/success', { description: 'Navigate to success page' })
  ]),
  catch: sequence([
    setState('state.error', 'Order failed. Please try again.', 'Set error'),
    emitEvent('ui', {
      type: 'toast',
      message: 'Order failed',
      severity: 'error'
    }, 'Error notification'),
    emitEvent('analytics', {
      type: 'order_failed',
      data: { reason: 'api_error' }
    }, 'Failure analytics')
  ]),
  finally: setState('state.isSubmitting', false, 'End loading'),
  description: 'Safe order submission'
});
```

### Optimistic Update

```typescript
const optimisticDelete = sequence([
  // 1. Remove from UI immediately (optimistic)
  setValue('data.items',
    ['filter', ['get', 'data.items'], ['!=', '$.id', ['get', 'input.itemId']]],
    'Remove item (optimistic)'
  ),

  // 2. Send delete request to server
  catchEffect({
    try: apiCall({
      method: 'DELETE',
      endpoint: ['concat', '/api/items/', ['get', 'input.itemId']],
      description: 'Delete item'
    }),
    catch: sequence([
      // Restore on failure
      setValue('data.items',
        ['concat', ['get', 'data.items'], [['get', 'input.deletedItem']]],
        'Restore item'
      ),
      emitEvent('ui', {
        type: 'toast',
        message: 'Failed to delete',
        severity: 'error'
      }, 'Failure notification')
    ]),
    description: 'Delete rollback'
  })
]);
```

---

## Next Steps

- [Runtime API](07-runtime.md) - Effect execution environment
- [DAG & Change Propagation](06-dag-propagation.md) - State change propagation
