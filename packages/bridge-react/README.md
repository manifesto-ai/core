# @manifesto-ai/bridge-react

React bridge for Manifesto Domain Runtime. Provides seamless React 18 integration with `useSyncExternalStore` for optimal performance.

## Installation

```bash
npm install @manifesto-ai/bridge-react @manifesto-ai/core react
# or
pnpm add @manifesto-ai/bridge-react @manifesto-ai/core react
```

## Features

- **Bridge Pattern**: Adapter/Actuator pattern for flexible state synchronization
- **React 18 Ready**: Uses `useSyncExternalStore` for concurrent rendering support
- **Type-Safe**: Full TypeScript support with inferred types
- **Optimized Rendering**: Selective path subscriptions to minimize re-renders
- **Command-Based**: Execute state changes and actions via typed commands

## Quick Start

### Basic Setup

```tsx
import { defineDomain, defineSource, createRuntime } from '@manifesto-ai/core';
import {
  RuntimeProvider,
  useValue,
  useSetValue,
  useAction
} from '@manifesto-ai/bridge-react';
import { z } from 'zod';

// 1. Define your domain
const domain = defineDomain({
  id: 'counter-app',
  name: 'Counter',
  dataSchema: z.object({ count: z.number() }),
  stateSchema: z.object({}),
  initialState: {},
  paths: {
    sources: {
      count: defineSource({
        schema: z.number(),
        defaultValue: 0,
        semantic: { type: 'number', description: 'Counter value' },
      }),
    },
  },
});

// 2. Create runtime
const runtime = createRuntime({ domain, initialData: { count: 0 } });

// 3. Wrap your app
function App() {
  return (
    <RuntimeProvider runtime={runtime} domain={domain}>
      <Counter />
    </RuntimeProvider>
  );
}

// 4. Use hooks in components
function Counter() {
  const { value: count } = useValue<number>('data.count');
  const { setValue } = useSetValue();

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setValue('data.count', count + 1)}>
        Increment
      </button>
    </div>
  );
}
```

## API Reference

### Providers

#### `RuntimeProvider`

Provides runtime context to child components (legacy API).

```tsx
<RuntimeProvider runtime={runtime} domain={domain}>
  {children}
</RuntimeProvider>
```

#### `BridgeProvider`

Provides bridge context with full adapter/actuator pattern.

```tsx
const bridge = useManifestoBridge(runtime);

<BridgeProvider bridge={bridge} domain={domain}>
  {children}
</BridgeProvider>
```

### Hooks

#### `useValue<T>(path)`

Subscribe to a single value by semantic path.

```tsx
const { value, path } = useValue<string>('data.user.name');
```

#### `useValues(paths)`

Subscribe to multiple values.

```tsx
const { values } = useValues(['data.user.name', 'data.user.email']);
// values['data.user.name'], values['data.user.email']
```

#### `useDerived(path)`

Subscribe to a derived value.

```tsx
const { value: fullName } = useDerived<string>('derived.fullName');
```

#### `useSetValue()`

Get functions to update values.

```tsx
const { setValue, setValues, error, clearError } = useSetValue();

// Single value
setValue('data.user.name', 'John');

// Multiple values
setValues({
  'data.user.name': 'John',
  'data.user.email': 'john@example.com',
});
```

#### `useAction(actionId)`

Execute domain actions.

```tsx
const {
  execute,
  isExecuting,
  isAvailable,
  preconditions,
  error
} = useAction('submitOrder');

<button
  onClick={() => execute()}
  disabled={!isAvailable || isExecuting}
>
  {isExecuting ? 'Submitting...' : 'Submit'}
</button>
```

#### `useFieldPolicy(path)`

Get field policy (editable, required, relevant).

```tsx
const policy = useFieldPolicy('data.discountCode');

if (!policy.relevant) return null;

<input
  disabled={!policy.editable}
  required={policy.required}
/>
```

#### `useActionAvailability(actionId)`

Check action availability without execution capabilities.

```tsx
const { isAvailable, preconditions, blockedReasons } = useActionAvailability('delete');
```

### Bridge API

#### `useManifestoBridge(runtime, options?)`

Create a bridge instance with full adapter/actuator pattern.

```tsx
const bridge = useManifestoBridge(runtime, {
  syncMode: 'bidirectional', // 'push' | 'pull' | 'bidirectional'
  autoSync: true,
  debounceMs: 0,
  onFocus: (path) => { /* handle focus */ },
  onNavigate: (to, mode) => { /* handle navigation */ },
});
```

#### `useBridge()`

Get the bridge instance from context.

```tsx
const bridge = useBridge();

// Execute commands
bridge.execute(setValue('data.name', 'John'));
bridge.execute(executeAction('submit'));

// Get values
const value = bridge.get('data.name');

// Check policies
const policy = bridge.getFieldPolicy('data.email');
const available = bridge.isActionAvailable('submit');
```

### Commands

Commands are typed objects for state mutations and action execution.

```tsx
import { setValue, setMany, executeAction } from '@manifesto-ai/bridge-react';

// Single value update
bridge.execute(setValue('data.count', 10));

// Multiple values update
bridge.execute(setMany({
  'data.user.name': 'John',
  'data.user.age': 30,
}));

// Execute action
await bridge.execute(executeAction('submitForm', { validate: true }));
```

### Adapter/Actuator Pattern

For advanced use cases, create custom adapters and actuators.

#### `createReactAdapter(options)`

Create an adapter for reading from React state.

```tsx
const adapter = createReactAdapter({
  getData: () => formData,
  getState: () => uiState,
  validity: validationMap,
  onSubscribe: (listener) => {
    // Set up subscription
    return () => { /* cleanup */ };
  },
});
```

#### `createReactActuator(options)`

Create an actuator for writing to React state.

```tsx
const actuator = createReactActuator({
  setData: (path, value) => updateData(path, value),
  setState: (path, value) => updateState(path, value),
  onFocus: (path) => focusField(path),
  onNavigate: (to, mode) => router.navigate(to),
});
```

#### `createBridge(config)`

Create a bridge with custom adapter and actuator.

```tsx
const bridge = createBridge({
  runtime,
  adapter,
  actuator,
  syncMode: 'bidirectional',
  autoSync: true,
  debounceMs: 100,
});
```

## Advanced Patterns

### Optimized Field Subscriptions

Use `useFieldPolicy` for policy-based rendering optimization:

```tsx
function ConditionalField({ path }: { path: string }) {
  const policy = useFieldPolicy(path);
  const { value } = useValue(path);
  const { setValue } = useSetValue();

  // Only renders when policy dependencies change
  if (!policy.relevant) return null;

  return (
    <input
      value={value as string}
      onChange={(e) => setValue(path, e.target.value)}
      disabled={!policy.editable}
      required={policy.required}
    />
  );
}
```

### Action with Preconditions

```tsx
function SubmitButton() {
  const { execute, isAvailable, isExecuting, preconditions } = useAction('submit');

  const blockedReasons = preconditions
    .filter(p => !p.satisfied)
    .map(p => p.reason);

  return (
    <div>
      <button onClick={() => execute()} disabled={!isAvailable || isExecuting}>
        Submit
      </button>
      {blockedReasons.length > 0 && (
        <ul>
          {blockedReasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Form Integration

```tsx
function UserForm() {
  const { value: name } = useValue<string>('data.user.name');
  const { value: email } = useValue<string>('data.user.email');
  const { setValue, error } = useSetValue();
  const { execute, isExecuting } = useAction('saveUser');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await execute();
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={(e) => setValue('data.user.name', e.target.value)}
        placeholder="Name"
      />
      <input
        value={email}
        onChange={(e) => setValue('data.user.email', e.target.value)}
        placeholder="Email"
      />
      {error && <p className="error">{error.message}</p>}
      <button type="submit" disabled={isExecuting}>
        {isExecuting ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
```

## TypeScript

Full type inference is supported:

```tsx
interface UserData {
  user: {
    name: string;
    email: string;
  };
}

// Type-safe value access
const { value } = useValue<string>('data.user.name');

// Type-safe runtime
const runtime = useRuntime<UserData, {}>();
const name = runtime.get<string>('data.user.name');
```

## React Strict Mode

All hooks are compatible with React Strict Mode and concurrent rendering.

## License

MIT
