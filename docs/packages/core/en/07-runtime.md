# Runtime

```typescript
import { createRuntime, isOk } from '@manifesto-ai/core';

// Create runtime
const runtime = createRuntime({
  domain: orderDomain,
  initialData: { items: [], couponCode: '' },
  effectHandler: {
    apiCall: async (request) => {
      const response = await fetch(request.endpoint, {
        method: request.method,
        headers: request.headers,
        body: request.body ? JSON.stringify(request.body) : undefined
      });
      return response.json();
    }
  }
});

// Read values
console.log(runtime.get('data.items'));        // []
console.log(runtime.get('derived.subtotal'));  // 0

// Write values
runtime.set('data.items', [{ id: '1', name: 'Product A', price: 10000, quantity: 2 }]);
console.log(runtime.get('derived.subtotal'));  // 20000 (auto-calculated)

// Subscribe
const unsubscribe = runtime.subscribePath('derived.total', (value) => {
  console.log('Total changed:', value);
});

// Execute action
const result = await runtime.execute('checkout');
if (isOk(result)) {
  console.log('Payment successful');
}
```

## createRuntime()

Creates a runtime instance from a domain.

### CreateRuntimeOptions

```typescript
type CreateRuntimeOptions<TData, TState> = {
  /** Domain definition */
  domain: ManifestoDomain<TData, TState>;

  /** Initial data (optional) */
  initialData?: Partial<TData>;

  /** Effect handler (optional) */
  effectHandler?: Partial<EffectHandler>;
};
```

### Initialization Process

1. Create snapshot (initialData + domain.initialState)
2. Build dependency graph
3. Initialize subscription manager
4. Configure effect handler
5. Calculate initial derived values

```typescript
const runtime = createRuntime({
  domain: orderDomain,
  initialData: {
    items: [{ id: '1', name: 'Product A', price: 10000, quantity: 1 }]
  },
  effectHandler: {
    apiCall: async (request) => {
      // Custom API call logic
    },
    navigate: (to, mode) => {
      // Custom navigation logic
    }
  }
});
```

---

## DomainRuntime Interface

```typescript
interface DomainRuntime<TData, TState> {
  // Snapshot access
  getSnapshot(): DomainSnapshot<TData, TState>;
  get<T = unknown>(path: SemanticPath): T;
  getMany(paths: SemanticPath[]): Record<SemanticPath, unknown>;

  // Value modification
  set(path: SemanticPath, value: unknown): Result<void, ValidationError>;
  setMany(updates: Record<SemanticPath, unknown>): Result<void, ValidationError>;
  execute(actionId: string, input?: unknown): Promise<Result<void, EffectError>>;

  // Policy & Metadata
  getPreconditions(actionId: string): PreconditionStatus[];
  getFieldPolicy(path: SemanticPath): ResolvedFieldPolicy;
  getSemantic(path: SemanticPath): SemanticMeta | undefined;

  // AI support
  explain(path: SemanticPath): ExplanationTree;
  getImpact(path: SemanticPath): SemanticPath[];

  // Subscriptions
  subscribe(listener: SnapshotListener<TData, TState>): Unsubscribe;
  subscribePath(path: SemanticPath, listener: PathListener): Unsubscribe;
  subscribeEvents(channel: string, listener: EventListener): Unsubscribe;
}
```

---

## Snapshot Access

### getSnapshot()

Returns the entire current snapshot:

```typescript
const snapshot = runtime.getSnapshot();
// {
//   data: { items: [...], couponCode: '' },
//   state: { isSubmitting: false },
//   derived: { subtotal: 20000, hasItems: true, ... },
//   validity: { ... },
//   timestamp: 1704067200000,
//   version: 5
// }
```

### get\<T\>(path)

Returns the value at a specific path:

```typescript
// data namespace
const items = runtime.get<Item[]>('data.items');
const coupon = runtime.get<string>('data.couponCode');

// state namespace
const isSubmitting = runtime.get<boolean>('state.isSubmitting');

// derived namespace
const subtotal = runtime.get<number>('derived.subtotal');
const canCheckout = runtime.get<boolean>('derived.canCheckout');

// Nested path
const firstItemPrice = runtime.get<number>('data.items.0.price');
```

### getMany(paths)

Retrieves multiple path values at once:

```typescript
const values = runtime.getMany([
  'data.items',
  'derived.subtotal',
  'derived.total',
  'state.isSubmitting'
]);
// {
//   'data.items': [...],
//   'derived.subtotal': 20000,
//   'derived.total': 23000,
//   'state.isSubmitting': false
// }
```

---

## Value Modification

### set(path, value)

Sets the value at a single path. Returns success/failure as Result after Zod schema validation:

```typescript
import { isOk, isErr } from '@manifesto-ai/core';

const result = runtime.set('data.quantity', 5);

if (isOk(result)) {
  console.log('Set successful');
  // derived values are automatically recalculated
  console.log(runtime.get('derived.subtotal'));
} else {
  console.log('Validation failed:', result.error.message);
  console.log('Issues:', result.error.issues);
}
```

### setMany(updates)

Sets multiple path values at once. Stops on first validation failure:

```typescript
const result = runtime.setMany({
  'data.items': [{ id: '1', name: 'Product A', price: 10000, quantity: 2 }],
  'data.couponCode': 'SAVE10'
});

if (isOk(result)) {
  // All derived values are recalculated at once
}
```

### ValidationError

Error returned on validation failure:

```typescript
type ValidationError = {
  _tag: 'ValidationError';
  path: SemanticPath;          // Failed path
  message: string;             // Error message
  issues: ValidationIssue[];   // Detailed issues list
};
```

---

## Action Execution

### execute(actionId, input?)

Executes an action. Proceeds in order: precondition check → input validation → Effect execution:

```typescript
// Action without input
const result = await runtime.execute('clearCart');

// Action with input
const result = await runtime.execute('addItem', {
  id: 'prod-123',
  name: 'New Product',
  price: 15000,
  quantity: 1
});

if (isOk(result)) {
  console.log('Action successful');
} else {
  const error = result.error;

  if (error.code === 'PRECONDITION_FAILED') {
    console.log('Precondition failed');
  } else if (error.code === 'INVALID_INPUT') {
    console.log('Input validation failed');
  } else if (error.code === 'API_CALL_FAILED') {
    console.log('API call failed');
  }

  console.log('Cause:', error.cause.message);
}
```

### Precondition Evaluation Process

```typescript
// Action definition
const checkoutAction = defineAction({
  preconditions: [
    { path: 'derived.hasItems', expect: 'true', reason: 'Cart must have items' },
    { path: 'state.isSubmitting', expect: 'false', reason: 'Already submitting' }
  ],
  // ...
});

// Check preconditions at runtime
runtime.getPreconditions('checkout');
// [
//   { path: 'derived.hasItems', expect: 'true', actual: true, satisfied: true, reason: '...' },
//   { path: 'state.isSubmitting', expect: 'false', actual: false, satisfied: true, reason: '...' }
// ]
```

### Effect Execution Flow

```
execute('checkout')
       │
       ▼
┌─────────────────┐
│ Check           │
│ Preconditions   │
└────────┬────────┘
         │ All satisfied?
    ┌────┴────┐
    No        Yes
    │          │
    ▼          ▼
┌────────┐ ┌─────────────────┐
│ Return │ │ Validate Input  │
│ Error  │ └────────┬────────┘
└────────┘          │ Valid?
              ┌─────┴─────┐
              No          Yes
              │            │
              ▼            ▼
         ┌────────┐  ┌─────────────────┐
         │ Return │  │ Execute Effect  │
         │ Error  │  └────────┬────────┘
         └────────┘           │
                              ▼
                    ┌─────────────────┐
                    │ Propagate       │
                    │ Changes         │
                    └────────┬────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Notify          │
                    │ Subscribers     │
                    └─────────────────┘
```

---

## DomainSnapshot

An immutable object representing the domain state at a specific point in time.

### Structure

```typescript
type DomainSnapshot<TData, TState> = {
  /** Business data */
  data: TData;

  /** UI state */
  state: TState;

  /** Computed values */
  derived: Record<SemanticPath, unknown>;

  /** Validation results */
  validity: Record<SemanticPath, ValidationResult>;

  /** Snapshot creation time (milliseconds) */
  timestamp: number;

  /** Snapshot version (increments with each change) */
  version: number;
};
```

### Immutability

Snapshots are immutable. A new snapshot is created when values change:

```typescript
const snapshot1 = runtime.getSnapshot();
runtime.set('data.quantity', 5);
const snapshot2 = runtime.getSnapshot();

console.log(snapshot1 === snapshot2);        // false
console.log(snapshot1.version);              // 0
console.log(snapshot2.version);              // 1
```

### createSnapshot(), cloneSnapshot()

Snapshot creation and cloning:

```typescript
import { createSnapshot, cloneSnapshot } from '@manifesto-ai/core';

// Create empty snapshot
const snapshot = createSnapshot(
  { items: [] },           // initialData
  { isSubmitting: false }  // initialState
);

// Clone snapshot (maintains immutability)
const cloned = cloneSnapshot(snapshot);
```

### diffSnapshots()

Calculates changed paths between two snapshots:

```typescript
import { diffSnapshots } from '@manifesto-ai/core';

const changedPaths = diffSnapshots(oldSnapshot, newSnapshot);
// ['data.items', 'data.items.0.quantity', 'derived.subtotal', 'derived.total']
```

---

## Subscriptions

### subscribe(listener)

Subscribes to all snapshot changes:

```typescript
const unsubscribe = runtime.subscribe((snapshot, changedPaths) => {
  console.log('Changed paths:', changedPaths);
  console.log('New snapshot version:', snapshot.version);
});

// Unsubscribe
unsubscribe();
```

### subscribePath(path, listener)

Subscribes to changes at a specific path:

```typescript
// Subscribe to single path
const unsubscribe = runtime.subscribePath('derived.total', (value, path) => {
  console.log(`${path} changed: ${value}`);
});

// Wildcard subscription
const unsubscribeAll = runtime.subscribePath('data.items.*', (value, path) => {
  console.log(`${path} changed: ${JSON.stringify(value)}`);
});
```

### subscribeEvents(channel, listener)

Subscribes to an event channel:

```typescript
// Subscribe to UI events
const unsubscribe = runtime.subscribeEvents('ui', (event) => {
  if (event.payload.type === 'toast') {
    showToast(event.payload.message, event.payload.severity);
  }
});

// Subscribe to all events
runtime.subscribeEvents('*', (event) => {
  console.log(`[${event.channel}] ${event.payload.type}`);
});
```

---

## SubscriptionManager

Internal class that manages subscriptions:

```typescript
class SubscriptionManager<TData, TState> {
  subscribe(listener: SnapshotListener<TData, TState>): Unsubscribe;
  subscribePath(path: SemanticPath, listener: PathListener): Unsubscribe;
  subscribeEvents(channel: string, listener: EventListener): Unsubscribe;
  notifySnapshotChange(snapshot: DomainSnapshot<TData, TState>, changedPaths: SemanticPath[]): void;
  emitEvent(channel: string, payload: unknown): void;
  clear(): void;
  getSubscriptionCount(): { snapshot: number; path: number; event: number; };
}
```

### createBatchNotifier()

Optimizes notifications by batching multiple changes:

```typescript
import { createBatchNotifier, SubscriptionManager } from '@manifesto-ai/core';

const manager = new SubscriptionManager();
const batcher = createBatchNotifier(manager, 16); // 16ms debounce

// Queue multiple changes
batcher.queue(snapshot1, ['data.items']);
batcher.queue(snapshot2, ['data.quantity']);
batcher.queue(snapshot3, ['derived.total']);

// Notifies all at once after 16ms (or flush immediately)
batcher.flush();
```

---

## AI Support Interfaces

### explain(path): ExplanationTree

Explains how a value was calculated:

```typescript
const explanation = runtime.explain('derived.total');
// {
//   path: 'derived.total',
//   value: 27000,
//   semantic: { type: 'currency', description: 'Order total' },
//   expression: ['-', ['get', 'derived.subtotal'], ['get', 'derived.discount']],
//   dependencies: [
//     {
//       path: 'derived.subtotal',
//       value: 30000,
//       dependencies: [
//         { path: 'data.items', value: [...], dependencies: [] }
//       ]
//     },
//     {
//       path: 'derived.discount',
//       value: 3000,
//       dependencies: [
//         { path: 'data.couponCode', value: 'SAVE10', dependencies: [] }
//       ]
//     }
//   ],
//   explanation: 'derived.total = 27000\nDependencies:\n  - derived.subtotal = 30000\n  - derived.discount = 3000'
// }
```

### getImpact(path): SemanticPath[]

Returns all paths affected when a path changes:

```typescript
const impact = runtime.getImpact('data.items');
// ['derived.subtotal', 'derived.itemCount', 'derived.hasItems', 'derived.total', 'derived.canCheckout']
```

### getFieldPolicy(path): ResolvedFieldPolicy

Evaluates field policy in current state:

```typescript
const policy = runtime.getFieldPolicy('data.couponCode');
// {
//   relevant: true,           // Should display currently
//   relevantReason: undefined,
//   editable: true,           // Currently editable
//   editableReason: undefined,
//   required: false,          // Currently not required
//   requiredReason: undefined
// }

// During submission
runtime.set('state.isSubmitting', true);
const policy2 = runtime.getFieldPolicy('data.couponCode');
// {
//   relevant: true,
//   editable: false,                              // Not editable
//   editableReason: 'Cannot edit during submission',
//   required: false
// }
```

### getSemantic(path): SemanticMeta | undefined

Returns the semantic metadata for a path:

```typescript
const semantic = runtime.getSemantic('data.items');
// { type: 'list', description: 'Order items list', readable: true, writable: true }

const actionSemantic = runtime.getSemantic('derived.subtotal');
// { type: 'currency', description: 'Order subtotal', readable: true, writable: false }
```

---

## Practical Example: React Integration

```typescript
import { useEffect, useState, useCallback } from 'react';
import { createRuntime, isOk } from '@manifesto-ai/core';

function useRuntime(domain) {
  const [runtime] = useState(() => createRuntime({
    domain,
    effectHandler: {
      apiCall: async (request) => {
        const res = await fetch(request.endpoint, {
          method: request.method,
          body: request.body ? JSON.stringify(request.body) : undefined
        });
        return res.json();
      }
    }
  }));

  return runtime;
}

function useValue<T>(runtime, path: string): T {
  const [value, setValue] = useState(() => runtime.get<T>(path));

  useEffect(() => {
    return runtime.subscribePath(path, (newValue) => {
      setValue(newValue as T);
    });
  }, [runtime, path]);

  return value;
}

function OrderSummary() {
  const runtime = useRuntime(orderDomain);

  const items = useValue<Item[]>(runtime, 'data.items');
  const total = useValue<number>(runtime, 'derived.total');
  const canCheckout = useValue<boolean>(runtime, 'derived.canCheckout');
  const isSubmitting = useValue<boolean>(runtime, 'state.isSubmitting');

  const handleCheckout = useCallback(async () => {
    const result = await runtime.execute('checkout');
    if (!isOk(result)) {
      alert('Payment failed: ' + result.error.cause.message);
    }
  }, [runtime]);

  return (
    <div>
      <h2>Order Summary</h2>
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.name} x {item.quantity}</li>
        ))}
      </ul>
      <p>Total: ${total.toLocaleString()}</p>
      <button
        onClick={handleCheckout}
        disabled={!canCheckout || isSubmitting}
      >
        {isSubmitting ? 'Processing...' : 'Checkout'}
      </button>
    </div>
  );
}
```

---

## Next Steps

- [DAG & Change Propagation](06-dag-propagation.md) - Dependency tracking principles
- [Policy Evaluation](08-policy.md) - Preconditions and field policies
