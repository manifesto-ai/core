# @manifesto-ai/projection-ui

> UI Projection layer for Manifesto AI - Convert domain policies to framework-agnostic UI states

Transform your domain logic into UI states automatically. The domain decides **what** (relevant, editable, required), and the UI decides **how** (visible, enabled, focused).

## Installation

```bash
pnpm add @manifesto-ai/projection-ui @manifesto-ai/core
```

## Quick Start

```typescript
import { createRuntime, defineDomain, fieldPolicy, condition, z } from '@manifesto-ai/core';
import { createProjectionManager } from '@manifesto-ai/projection-ui';

// Define domain with field policies
const userDomain = defineDomain('user', {
  dataSchema: z.object({
    name: z.string(),
    email: z.string().email(),
    role: z.enum(['user', 'admin']),
    adminCode: z.string().optional()
  }),

  // Field policies define relevance, editability, requirements
  fieldPolicies: {
    'data.adminCode': fieldPolicy({
      relevance: condition({ $eq: [{ $get: 'data.role' }, 'admin'] }),
      requirement: condition({ $eq: [{ $get: 'data.role' }, 'admin'] })
    })
  }
});

// Create runtime and projection manager
const runtime = createRuntime(userDomain);
const manager = createProjectionManager({
  runtime,
  domain: userDomain,
  fields: {
    paths: ['data.name', 'data.email', 'data.role', 'data.adminCode']
  }
});

// Get UI state for a field
const adminCodeState = manager.getFieldState('data.adminCode');
console.log(adminCodeState);
// { visible: false, enabled: false, required: false, ... }

// When role changes to 'admin', the state updates
runtime.set('data.role', 'admin');
const updatedState = manager.getFieldState('data.adminCode');
console.log(updatedState);
// { visible: true, enabled: true, required: true, ... }

// Subscribe to field state changes
manager.subscribeFields((states, changedPaths) => {
  console.log('Changed fields:', changedPaths);
  // Re-render UI based on new states
});
```

## Concepts

### Field Projection

Domain policies are projected to UI states:

| Domain Policy | UI State |
|--------------|----------|
| `relevance` → | `visible` |
| `editability` → | `enabled` |
| `requirement` → | `required` |

```typescript
// Domain defines the business rules
const policy = fieldPolicy({
  relevance: condition({ $gt: [{ $get: 'data.age' }, 18] }),
  editability: condition({ $not: { $get: 'state.isSubmitting' } }),
  requirement: true
});

// Projection converts to UI state
const uiState = projectFieldPolicy(policy, runtime);
// {
//   visible: true,
//   enabled: true,
//   required: true,
//   relevance: 'always',
//   editability: 'always',
//   requirement: 'always',
//   validation: { valid: true, issues: [] },
//   meta: { path: 'data.name', label: 'Name' }
// }
```

### Action Projection

Action availability is projected to UI state:

```typescript
const actionState = projectActionState('submit', runtime);
// {
//   actionId: 'submit',
//   available: true,
//   unavailableReason: null,
//   executing: false,
//   preconditions: [
//     { conditionId: 'hasItems', satisfied: true },
//     { conditionId: 'notSubmitting', satisfied: true }
//   ]
// }
```

### Event Projection

Domain events are projected to UI events (toasts, notifications):

```typescript
const uiEvent = projectEvent({
  type: 'order:created',
  payload: { orderId: '123' }
}, {
  transformer: (event) => ({
    title: 'Order Created',
    message: `Order ${event.payload.orderId} was created`,
    severity: 'success'
  })
});
```

## API Reference

### `createProjectionManager(options)`

Creates a projection manager that manages field, action, and event projections.

```typescript
interface CreateProjectionManagerOptions {
  runtime: DomainRuntime;
  domain: ManifestoDomain;

  // Field projection config
  fields?: {
    paths: SemanticPath[];
    visibilityResolver?: (relevance: boolean) => boolean;
    enabledResolver?: (editability: boolean) => boolean;
  };

  // Action projection config
  actions?: {
    actionIds: string[];
  };

  // Event projection config
  events?: {
    eventTypes?: string[];
    transformer?: EventTransformer;
    defaultChannel?: string;
  };
}
```

**Returns:** `ProjectionManager`

```typescript
interface ProjectionManager {
  // Field methods
  getFieldState(path: SemanticPath): UIFieldState | undefined;
  getAllFieldStates(): UIFieldStateMap;
  subscribeFields(listener: FieldStateListener): () => void;

  // Action methods
  getActionState(actionId: string): UIActionState | undefined;
  getAllActionStates(): UIActionStateMap;
  subscribeActions(listener: ActionStateListener): () => void;
  setActionExecuting(actionId: string, executing: boolean): void;

  // Event methods
  emitEvent(event: UIEvent): void;
  getPendingEvents(): UIEvent[];
  dismissEvent(eventId: string): void;
  dismissAllEvents(): void;
  subscribeEvents(listener: UIEventListener): () => void;

  // Cleanup
  dispose(): void;
}
```

### Field Projection Functions

#### `projectFieldPolicy(policy, runtime, path?)`

Projects a single field policy to UI state.

```typescript
const state = projectFieldPolicy(
  fieldPolicy({
    relevance: condition({ $eq: [{ $get: 'data.type' }, 'premium'] }),
    editability: true,
    requirement: false
  }),
  runtime,
  'data.premiumFeature'
);
```

#### `projectFieldPolicies(policies, runtime)`

Projects multiple field policies at once.

```typescript
const states = projectFieldPolicies({
  'data.name': namePolicy,
  'data.email': emailPolicy,
  'data.phone': phonePolicy
}, runtime);
// Map<SemanticPath, UIFieldState>
```

#### `filterVisibleFields(states)`

Filters to only visible fields.

```typescript
const visibleFields = filterVisibleFields(allFieldStates);
```

#### `filterEnabledFields(states)`

Filters to only enabled fields.

```typescript
const editableFields = filterEnabledFields(allFieldStates);
```

#### `getRequiredFields(states)`

Gets all required fields.

```typescript
const requiredFields = getRequiredFields(allFieldStates);
```

### Action Projection Functions

#### `projectActionState(actionId, runtime)`

Projects a single action to UI state.

```typescript
const state = projectActionState('submit', runtime);
// {
//   actionId: 'submit',
//   available: true,
//   unavailableReason: null,
//   executing: false,
//   preconditions: [...]
// }
```

#### `projectActionStates(actionIds, runtime)`

Projects multiple actions.

```typescript
const states = projectActionStates(['submit', 'save', 'cancel'], runtime);
// Map<string, UIActionState>
```

#### `getAvailableActions(states)`

Gets all available actions.

```typescript
const available = getAvailableActions(actionStates);
// ['save', 'cancel']
```

#### `getUnavailableActions(states)`

Gets all unavailable actions with reasons.

```typescript
const unavailable = getUnavailableActions(actionStates);
// [{ actionId: 'submit', reason: 'Cart is empty' }]
```

#### `setExecuting(state, executing)`

Updates the executing state of an action.

```typescript
const updatedState = setExecuting(actionState, true);
```

### Event Projection Functions

#### `createSuccessToast(title, message?)`

Creates a success toast event.

```typescript
const toast = createSuccessToast('Order Created', 'Your order has been placed');
manager.emitEvent(toast);
```

#### `createErrorToast(title, message?)`

Creates an error toast event.

```typescript
const toast = createErrorToast('Failed', 'Could not save changes');
manager.emitEvent(toast);
```

#### `createWarningToast(title, message?)`

Creates a warning toast event.

```typescript
const toast = createWarningToast('Warning', 'This action cannot be undone');
manager.emitEvent(toast);
```

#### `createInfoToast(title, message?)`

Creates an info toast event.

```typescript
const toast = createInfoToast('Info', 'New features available');
manager.emitEvent(toast);
```

## React Integration

```tsx
import { useEffect, useState, useMemo } from 'react';
import { createRuntime } from '@manifesto-ai/core';
import { createProjectionManager, UIFieldState } from '@manifesto-ai/projection-ui';

function useFieldState(manager: ProjectionManager, path: string) {
  const [state, setState] = useState<UIFieldState | undefined>(
    () => manager.getFieldState(path)
  );

  useEffect(() => {
    return manager.subscribeFields((states, changedPaths) => {
      if (changedPaths.includes(path)) {
        setState(states.get(path));
      }
    });
  }, [manager, path]);

  return state;
}

function FormField({ path, label }: { path: string; label: string }) {
  const manager = useProjectionManager(); // From context
  const state = useFieldState(manager, path);

  if (!state?.visible) {
    return null;
  }

  return (
    <div>
      <label>
        {label}
        {state.required && <span>*</span>}
      </label>
      <input
        disabled={!state.enabled}
        aria-required={state.required}
      />
      {!state.validation.valid && (
        <span className="error">
          {state.validation.issues[0]?.message}
        </span>
      )}
    </div>
  );
}
```

## Full Example: Dynamic Form

```typescript
import { createRuntime, defineDomain, fieldPolicy, condition, defineAction, z } from '@manifesto-ai/core';
import { createProjectionManager } from '@manifesto-ai/projection-ui';

const orderDomain = defineDomain('order', {
  dataSchema: z.object({
    type: z.enum(['standard', 'express', 'overnight']),
    items: z.array(z.object({
      id: z.string(),
      quantity: z.number()
    })),
    deliveryDate: z.string().optional(),
    specialInstructions: z.string().optional()
  }),

  stateSchema: z.object({
    isSubmitting: z.boolean().default(false)
  }),

  fieldPolicies: {
    // Delivery date only relevant for express/overnight
    'data.deliveryDate': fieldPolicy({
      relevance: condition({
        $or: [
          { $eq: [{ $get: 'data.type' }, 'express'] },
          { $eq: [{ $get: 'data.type' }, 'overnight'] }
        ]
      }),
      requirement: condition({
        $eq: [{ $get: 'data.type' }, 'overnight']
      })
    }),
    // Special instructions always optional
    'data.specialInstructions': fieldPolicy({
      relevance: true,
      editability: condition({ $not: { $get: 'state.isSubmitting' } }),
      requirement: false
    })
  },

  actions: {
    submit: defineAction({
      precondition: {
        $and: [
          { $gt: [{ $size: { $get: 'data.items' } }, 0] },
          { $not: { $get: 'state.isSubmitting' } }
        ]
      },
      effect: sequence([
        setState('state.isSubmitting', true),
        apiCall({ method: 'POST', url: '/api/orders', body: { $get: 'data' } }),
        setState('state.isSubmitting', false)
      ])
    })
  }
});

// Create manager
const runtime = createRuntime(orderDomain);
const manager = createProjectionManager({
  runtime,
  domain: orderDomain,
  fields: {
    paths: ['data.type', 'data.deliveryDate', 'data.specialInstructions']
  },
  actions: {
    actionIds: ['submit']
  }
});

// Get initial states
console.log(manager.getFieldState('data.deliveryDate'));
// { visible: false, enabled: true, required: false, ... }

// Change to overnight shipping
runtime.set('data.type', 'overnight');

console.log(manager.getFieldState('data.deliveryDate'));
// { visible: true, enabled: true, required: true, ... }

// Check submit action
console.log(manager.getActionState('submit'));
// { available: false, unavailableReason: 'No items in cart', ... }

// Add items
runtime.set('data.items', [{ id: 'prod-1', quantity: 1 }]);

console.log(manager.getActionState('submit'));
// { available: true, unavailableReason: null, ... }

// Cleanup
manager.dispose();
```

## Type Guards

```typescript
import {
  isUIFieldState,
  isUIActionState,
  isUIEvent,
  isUIEventSeverity
} from '@manifesto-ai/projection-ui';

// Type-safe checking
if (isUIFieldState(maybeFieldState)) {
  console.log(maybeFieldState.visible);
}

if (isUIActionState(maybeActionState)) {
  console.log(maybeActionState.available);
}
```

## Related Packages

- [@manifesto-ai/core](../core) - Core runtime and domain definitions
- [@manifesto-ai/projection-agent](../projection-agent) - AI agent context projection
- [@manifesto-ai/projection-graphql](../projection-graphql) - GraphQL schema projection

## License

MIT
