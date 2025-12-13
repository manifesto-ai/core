# @manifesto-ai/bridge-zustand

> Zustand integration for Manifesto AI Bridge

Connect your Zustand stores to Manifesto runtime with type-safe adapters and actuators.

## Installation

```bash
pnpm add @manifesto-ai/bridge-zustand @manifesto-ai/bridge @manifesto-ai/core zustand
```

## Quick Start

```typescript
import { create } from 'zustand';
import { createRuntime, defineDomain, defineDerived, z } from '@manifesto-ai/core';
import {
  createZustandAdapter,
  createZustandActuator,
  createBridge,
  setValue
} from '@manifesto-ai/bridge-zustand';

// 1. Define your Zustand store
interface FormStore {
  name: string;
  email: string;
  setName: (name: string) => void;
  setEmail: (email: string) => void;
}

const useFormStore = create<FormStore>((set) => ({
  name: '',
  email: '',
  setName: (name) => set({ name }),
  setEmail: (email) => set({ email }),
}));

// 2. Define your Manifesto domain
const formDomain = defineDomain({
  id: 'form',
  name: 'Form',
  description: 'User form domain',
  dataSchema: z.object({
    name: z.string(),
    email: z.string().email()
  }),
  stateSchema: z.object({
    isSubmitting: z.boolean().default(false)
  }),
  initialState: {
    isSubmitting: false
  }
});

// 3. Create runtime
const runtime = createRuntime(formDomain);

// 4. Create adapter (reads from Zustand → Manifesto)
const adapter = createZustandAdapter(useFormStore, {
  dataSelector: (state) => ({
    name: state.name,
    email: state.email
  })
});

// 5. Create actuator (writes from Manifesto → Zustand)
const actuator = createZustandActuator(useFormStore, {
  setData: (path, value, store) => {
    const field = path.replace('data.', '');
    store.setState({ [field]: value });
  }
});

// 6. Create bridge
const bridge = createBridge({ runtime, adapter, actuator });

// 7. Use the bridge
await bridge.execute(setValue('data.name', 'John'));
console.log(useFormStore.getState().name); // 'John'
```

## API Reference

### `createZustandAdapter(store, options)`

Creates an adapter that reads from a Zustand store and syncs to Manifesto runtime.

```typescript
interface ZustandAdapterOptions<TStore, TData, TState> {
  // Map Zustand state to Manifesto data namespace
  dataSelector: (state: TStore) => TData;

  // Map Zustand state to Manifesto state namespace (optional)
  stateSelector?: (state: TStore) => TState;

  // Validity map for field validation (optional)
  validity?: Map<SemanticPath, ValidationResult>;
}
```

**Example:**

```typescript
const adapter = createZustandAdapter(useStore, {
  dataSelector: (state) => ({
    user: {
      name: state.userName,
      email: state.userEmail
    }
  }),
  stateSelector: (state) => ({
    isLoading: state.loading,
    error: state.errorMessage
  })
});
```

### `createZustandActuator(store, options)`

Creates an actuator that writes to a Zustand store when Manifesto state changes.

```typescript
interface ZustandActuatorOptions<TStore, TData, TState> {
  // Handler to set data values
  setData: (path: SemanticPath, value: unknown, store: StoreApi<TStore>) => void;

  // Handler to set state values (optional)
  setState?: (path: SemanticPath, value: unknown, store: StoreApi<TStore>) => void;

  // Focus handler (optional)
  onFocus?: (path: SemanticPath) => void;

  // Navigation handler (optional)
  onNavigate?: (to: string, mode?: 'push' | 'replace') => void;

  // API call handler (optional)
  onApiCall?: (request: ApiRequest) => Promise<unknown>;
}
```

**Example:**

```typescript
const actuator = createZustandActuator(useStore, {
  setData: (path, value, store) => {
    // Handle nested paths
    if (path === 'data.user.name') {
      store.setState({ userName: value as string });
    } else if (path === 'data.user.email') {
      store.setState({ userEmail: value as string });
    }
  },
  setState: (path, value, store) => {
    if (path === 'state.isLoading') {
      store.setState({ loading: value as boolean });
    }
  },
  onNavigate: (to) => {
    window.location.href = to;
  },
  onApiCall: async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body)
    });
    return response.json();
  }
});
```

### `createZustandBridgeSetup(store, options)`

Convenience function to create both adapter and actuator at once.

```typescript
const { adapter, actuator } = createZustandBridgeSetup(useStore, {
  dataSelector: (state) => ({ name: state.name, email: state.email }),
  setData: (path, value, store) => {
    const field = path.replace('data.', '');
    store.setState({ [field]: value });
  }
});

const bridge = createBridge({ runtime, adapter, actuator });
```

## Full Example with React

```typescript
import { create } from 'zustand';
import { useEffect, useState } from 'react';
import { createRuntime, defineDomain, defineDerived, z } from '@manifesto-ai/core';
import {
  createZustandAdapter,
  createZustandActuator,
  createBridge,
  setValue,
  executeAction
} from '@manifesto-ai/bridge-zustand';

// Zustand store
interface TodoStore {
  items: Array<{ id: string; text: string; done: boolean }>;
  addItem: (text: string) => void;
  toggleItem: (id: string) => void;
  removeItem: (id: string) => void;
}

const useTodoStore = create<TodoStore>((set) => ({
  items: [],
  addItem: (text) =>
    set((state) => ({
      items: [...state.items, { id: Date.now().toString(), text, done: false }]
    })),
  toggleItem: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id)
    }))
}));

// Manifesto domain with derived state
const todoDomain = defineDomain({
  id: 'todos',
  name: 'Todos',
  description: 'Todo list domain',
  dataSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      text: z.string(),
      done: z.boolean()
    }))
  }),
  stateSchema: z.object({}),
  initialState: {},
  paths: {
    derived: {
      totalCount: defineDerived({
        deps: ['data.items'],
        expr: ['length', ['get', 'data.items']],
        semantic: { type: 'count', description: 'Total number of items' }
      }),
      doneCount: defineDerived({
        deps: ['data.items'],
        expr: ['length', ['filter', ['get', 'data.items'], '$.done']],
        semantic: { type: 'count', description: 'Number of completed items' }
      })
    }
  }
});

// Setup bridge
const runtime = createRuntime(todoDomain);

const adapter = createZustandAdapter(useTodoStore, {
  dataSelector: (state) => ({ items: state.items })
});

const actuator = createZustandActuator(useTodoStore, {
  setData: (path, value, store) => {
    if (path === 'data.items') {
      store.setState({ items: value as TodoStore['items'] });
    }
  }
});

const bridge = createBridge({ runtime, adapter, actuator });

// React component
function TodoApp() {
  const items = useTodoStore((state) => state.items);
  const [totalCount, setTotalCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    // Subscribe to derived values
    const unsub1 = runtime.subscribe('derived.totalCount', setTotalCount);
    const unsub2 = runtime.subscribe('derived.doneCount', setDoneCount);
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  return (
    <div>
      <h1>Todos ({doneCount}/{totalCount})</h1>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => useTodoStore.getState().toggleItem(item.id)}
            />
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Path Mapping Strategies

### Simple Flat Store

```typescript
// Zustand store matches Manifesto structure
const adapter = createZustandAdapter(useStore, {
  dataSelector: (state) => state  // Direct mapping
});

const actuator = createZustandActuator(useStore, {
  setData: (path, value, store) => {
    const field = path.replace('data.', '');
    store.setState({ [field]: value });
  }
});
```

### Nested Object Mapping

```typescript
// Map nested Zustand state to flat Manifesto paths
const adapter = createZustandAdapter(useStore, {
  dataSelector: (state) => ({
    firstName: state.user.profile.firstName,
    lastName: state.user.profile.lastName,
    email: state.user.contact.email
  })
});

const actuator = createZustandActuator(useStore, {
  setData: (path, value, store) => {
    const state = store.getState();
    switch (path) {
      case 'data.firstName':
        store.setState({
          user: {
            ...state.user,
            profile: { ...state.user.profile, firstName: value }
          }
        });
        break;
      case 'data.lastName':
        store.setState({
          user: {
            ...state.user,
            profile: { ...state.user.profile, lastName: value }
          }
        });
        break;
      // ... etc
    }
  }
});
```

### Using Immer

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const useStore = create(
  immer<FormStore>((set) => ({
    user: { name: '', email: '' },
    setField: (path, value) =>
      set((state) => {
        // Immer allows direct mutation
        const segments = path.split('.');
        let obj = state as any;
        for (let i = 0; i < segments.length - 1; i++) {
          obj = obj[segments[i]];
        }
        obj[segments[segments.length - 1]] = value;
      })
  }))
);

const actuator = createZustandActuator(useStore, {
  setData: (path, value, store) => {
    const fieldPath = path.replace('data.', '');
    store.getState().setField(fieldPath, value);
  }
});
```

## Re-exports

This package re-exports commonly used items from `@manifesto-ai/bridge`:

```typescript
export { createBridge, setValue, setMany, executeAction } from '@manifesto-ai/bridge';
export type { Adapter, Actuator, Bridge, Command, BridgeError } from '@manifesto-ai/bridge';
```

## Related Packages

- [@manifesto-ai/core](../core) - Core runtime and domain definitions
- [@manifesto-ai/bridge](../bridge) - Base bridge interfaces
- [@manifesto-ai/bridge-react-hook-form](../bridge-react-hook-form) - React Hook Form integration

## License

MIT
