# @manifesto-ai/bridge

> Framework-agnostic bridge interfaces for connecting Manifesto Runtime with external state management

The bridge package provides the **Adapter/Actuator pattern** to sync Manifesto runtime with any external state management system.

## Installation

```bash
pnpm add @manifesto-ai/bridge @manifesto-ai/core
```

## Concepts

### The Bridge Pattern

Manifesto uses a two-way binding pattern:

```
┌─────────────────┐         ┌─────────────────┐
│  External Store │◄───────►│ Manifesto       │
│  (Zustand,      │ Adapter │ Runtime         │
│   Redux, etc.)  │         │                 │
│                 │◄───────►│                 │
│                 │ Actuator│                 │
└─────────────────┘         └─────────────────┘
```

- **Adapter**: Reads from external store → writes to Manifesto runtime
- **Actuator**: Reads from Manifesto runtime → writes to external store

### Components

| Component | Direction | Purpose |
|-----------|-----------|---------|
| Adapter | External → Runtime | Sync external state to runtime |
| Actuator | Runtime → External | Execute commands on external store |
| Bridge | Bidirectional | Combines adapter + actuator |

## Quick Start

```typescript
import { createRuntime, defineDomain, z } from '@manifesto-ai/core';
import {
  createBridge,
  createVanillaAdapter,
  createVanillaActuator,
  setValue,
  executeAction
} from '@manifesto-ai/bridge';

// 1. Define domain
const domain = defineDomain('counter', {
  dataSchema: z.object({ count: z.number().default(0) })
});

// 2. Create runtime
const runtime = createRuntime(domain);

// 3. Create external store
const store = { data: { count: 0 }, state: {} };

// 4. Create adapter and actuator
const adapter = createVanillaAdapter({ store });
const actuator = createVanillaActuator({ store });

// 5. Create bridge
const bridge = createBridge({ runtime, adapter, actuator });

// 6. Execute commands
await bridge.execute(setValue('data.count', 5));
console.log(store.data.count);  // 5

// 7. Cleanup
bridge.dispose();
```

## API Reference

### `createBridge(config)`

Creates a bridge connecting runtime with adapter and actuator.

```typescript
interface BridgeConfig {
  runtime: DomainRuntime;
  adapter: Adapter;
  actuator: Actuator;
  syncMode?: 'immediate' | 'batched';
}

const bridge = createBridge({
  runtime,
  adapter,
  actuator,
  syncMode: 'immediate'  // default
});
```

### Bridge Methods

```typescript
// Execute a command
await bridge.execute(setValue('data.name', 'John'));

// Execute action
await bridge.execute(executeAction('submit', { id: '123' }));

// Set multiple values at once
await bridge.execute(setMany({
  'data.firstName': 'John',
  'data.lastName': 'Doe'
}));

// Subscribe to state changes
const unsubscribe = bridge.subscribe((snapshot) => {
  console.log('State changed:', snapshot);
});

// Cleanup
bridge.dispose();
```

### Commands

```typescript
import { setValue, setMany, executeAction } from '@manifesto-ai/bridge';

// Set single value
setValue('data.count', 10)
setValue('data.name', 'John')

// Set multiple values
setMany({
  'data.firstName': 'John',
  'data.lastName': 'Doe',
  'state.isLoading': false
})

// Execute action
executeAction('submit')
executeAction('addItem', { id: '123', name: 'Product' })
```

## Vanilla Implementation

The package includes a vanilla (plain JavaScript object) implementation:

### `createVanillaAdapter(options)`

Creates an adapter for plain JavaScript objects.

```typescript
interface VanillaAdapterOptions {
  store: VanillaStore;
  onChange?: (path: string, value: unknown) => void;
}

const store = {
  data: { name: '', email: '' },
  state: { isLoading: false }
};

const adapter = createVanillaAdapter({
  store,
  onChange: (path, value) => {
    console.log(`${path} changed to:`, value);
  }
});
```

### `createVanillaActuator(options)`

Creates an actuator for plain JavaScript objects.

```typescript
interface VanillaActuatorOptions {
  store: VanillaStore;
  apiHandler?: (request: ApiRequest) => Promise<unknown>;
  navigationHandler?: (path: string) => void;
}

const actuator = createVanillaActuator({
  store,
  apiHandler: async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body)
    });
    return response.json();
  },
  navigationHandler: (path) => {
    window.location.href = path;
  }
});
```

### `createVanillaBridgeSetup(options)`

Convenience function to create a complete bridge setup.

```typescript
const setup = createVanillaBridgeSetup({
  runtime,
  initialData: { count: 0 },
  initialState: { isLoading: false }
});

// Use the bridge
await setup.bridge.execute(setValue('data.count', 5));

// Access the store
console.log(setup.store.data.count);  // 5

// Cleanup
setup.dispose();
```

## Path Utilities

The package exports utilities for working with nested paths:

```typescript
import {
  parsePath,
  getNestedValue,
  setNestedValue,
  getValueByPath,
  setValueByPath,
  flattenObject
} from '@manifesto-ai/bridge';

// Parse a path string
parsePath('data.user.name');  // ['data', 'user', 'name']

// Get nested value
const obj = { user: { name: 'John' } };
getNestedValue(obj, ['user', 'name']);  // 'John'

// Set nested value (immutably)
const newObj = setNestedValue(obj, ['user', 'name'], 'Jane');
// { user: { name: 'Jane' } }

// Flatten object to paths
flattenObject({ user: { name: 'John', age: 30 } });
// { 'user.name': 'John', 'user.age': 30 }
```

## Creating Custom Adapters

Implement the `Adapter` interface for custom integrations:

```typescript
import type { Adapter } from '@manifesto-ai/bridge';

interface Adapter {
  // Get current state
  getSnapshot(): { data: unknown; state: unknown };

  // Subscribe to changes
  subscribe(listener: (snapshot: { data: unknown; state: unknown }) => void): () => void;

  // Optional: Initial sync
  initialize?(): void;
}

// Example: LocalStorage adapter
const createLocalStorageAdapter = (key: string): Adapter => {
  const listeners = new Set<Function>();

  const getSnapshot = () => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : { data: {}, state: {} };
  };

  return {
    getSnapshot,
    subscribe: (listener) => {
      listeners.add(listener);

      const handleStorage = (e: StorageEvent) => {
        if (e.key === key) {
          listener(getSnapshot());
        }
      };
      window.addEventListener('storage', handleStorage);

      return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', handleStorage);
      };
    }
  };
};
```

## Creating Custom Actuators

Implement the `Actuator` interface:

```typescript
import type { Actuator, Command, Result } from '@manifesto-ai/bridge';

interface Actuator {
  // Execute a command
  execute(command: Command): Promise<Result<void>>;
}

// Example: API-only actuator
const createApiActuator = (baseUrl: string): Actuator => ({
  async execute(command) {
    if (command.type === 'setValue') {
      await fetch(`${baseUrl}/state`, {
        method: 'PATCH',
        body: JSON.stringify({ path: command.path, value: command.value })
      });
      return { ok: true, value: undefined };
    }

    if (command.type === 'executeAction') {
      await fetch(`${baseUrl}/actions/${command.action}`, {
        method: 'POST',
        body: JSON.stringify(command.input)
      });
      return { ok: true, value: undefined };
    }

    return { ok: false, error: { code: 'UNKNOWN_COMMAND', message: 'Unknown command' } };
  }
});
```

## Error Handling

```typescript
import { BridgeError, BridgeErrorCode } from '@manifesto-ai/bridge';

try {
  const result = await bridge.execute(setValue('data.count', 'invalid'));

  if (!result.ok) {
    const error = result.error as BridgeError;
    switch (error.code) {
      case 'VALIDATION_ERROR':
        console.log('Invalid value:', error.message);
        break;
      case 'ACTION_UNAVAILABLE':
        console.log('Action not available:', error.message);
        break;
      case 'NETWORK_ERROR':
        console.log('Network error:', error.message);
        break;
    }
  }
} catch (e) {
  console.error('Unexpected error:', e);
}
```

## Related Packages

- [@manifesto-ai/core](../core) - Core runtime and domain definitions
- [@manifesto-ai/bridge-zustand](../bridge-zustand) - Zustand integration
- [@manifesto-ai/bridge-react-hook-form](../bridge-react-hook-form) - React Hook Form integration

## License

MIT
