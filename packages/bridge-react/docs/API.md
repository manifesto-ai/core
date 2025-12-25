# @manifesto-ai/bridge-react API Reference

Complete API documentation for all exports.

## Table of Contents

- [Providers](#providers)
- [Hooks](#hooks)
- [Bridge](#bridge)
- [Adapter](#adapter)
- [Actuator](#actuator)
- [Commands](#commands)
- [Types](#types)

---

## Providers

### RuntimeProvider

Legacy provider for runtime context. Use `BridgeProvider` for new projects.

```tsx
function RuntimeProvider<TData, TState>(props: RuntimeProviderProps<TData, TState>): ReactNode
```

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `runtime` | `DomainRuntime<TData, TState>` | Yes | The domain runtime instance |
| `domain` | `ManifestoDomain<TData, TState>` | Yes | The domain definition |
| `children` | `ReactNode` | Yes | Child components |

#### Example

```tsx
<RuntimeProvider runtime={runtime} domain={domain}>
  <App />
</RuntimeProvider>
```

---

### BridgeProvider

Provider for bridge context with full adapter/actuator pattern.

```tsx
function BridgeProvider<TData, TState>(props: BridgeProviderProps<TData, TState>): ReactNode
```

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `bridge` | `Bridge<TData, TState>` | Yes | The bridge instance |
| `domain` | `ManifestoDomain<TData, TState>` | Yes | The domain definition |
| `children` | `ReactNode` | Yes | Child components |

#### Example

```tsx
const bridge = useManifestoBridge(runtime);

<BridgeProvider bridge={bridge} domain={domain}>
  <App />
</BridgeProvider>
```

---

## Hooks

### useValue

Subscribe to a single value by semantic path.

```tsx
function useValue<T = unknown>(path: SemanticPath): UseValueResult<T>
```

#### Parameters

| Param | Type | Description |
|-------|------|-------------|
| `path` | `SemanticPath` | The semantic path to subscribe to |

#### Returns

```tsx
type UseValueResult<T> = {
  value: T;        // Current value
  path: SemanticPath;  // Path being watched
}
```

#### Example

```tsx
const { value: count } = useValue<number>('data.counter');
const { value: name } = useValue<string>('data.user.name');
```

---

### useValues

Subscribe to multiple values.

```tsx
function useValues(paths: SemanticPath[]): UseValuesResult
```

#### Parameters

| Param | Type | Description |
|-------|------|-------------|
| `paths` | `SemanticPath[]` | Array of paths to subscribe to |

#### Returns

```tsx
type UseValuesResult = {
  values: Record<SemanticPath, unknown>;  // Values by path
  paths: SemanticPath[];                   // Paths being watched
}
```

#### Example

```tsx
const { values } = useValues(['data.firstName', 'data.lastName']);
const firstName = values['data.firstName'] as string;
const lastName = values['data.lastName'] as string;
```

---

### useDerived

Subscribe to a derived value.

```tsx
function useDerived<T = unknown>(path: SemanticPath): UseValueResult<T>
```

Same API as `useValue`, but semantically indicates a derived path.

#### Example

```tsx
const { value: fullName } = useDerived<string>('derived.fullName');
const { value: total } = useDerived<number>('derived.orderTotal');
```

---

### useSetValue

Get functions to update values.

```tsx
function useSetValue(): UseSetValueResult
```

#### Returns

```tsx
type UseSetValueResult = {
  setValue: (path: SemanticPath, value: unknown) => Result<void, SetError>;
  setValues: (updates: Record<SemanticPath, unknown>) => Result<void, SetError>;
  error: SetError | null;
  clearError: () => void;
}
```

#### Example

```tsx
const { setValue, setValues, error, clearError } = useSetValue();

// Update single value
const result = setValue('data.name', 'John');
if (!result.ok) {
  console.error(result.error);
}

// Update multiple values atomically
setValues({
  'data.firstName': 'John',
  'data.lastName': 'Doe',
});

// Handle errors
if (error) {
  showError(error.message);
  clearError();
}
```

---

### useAction

Execute domain actions with full state management.

```tsx
function useAction(actionId: string): UseActionResult
```

#### Parameters

| Param | Type | Description |
|-------|------|-------------|
| `actionId` | `string` | The action identifier |

#### Returns

```tsx
type UseActionResult = {
  execute: (input?: unknown) => Promise<Result<void, EffectError>>;
  isExecuting: boolean;
  error: EffectError | null;
  clearError: () => void;
  isAvailable: boolean;
  preconditions: PreconditionStatus[];
}
```

#### Example

```tsx
const { execute, isExecuting, isAvailable, error } = useAction('submitOrder');

const handleSubmit = async () => {
  const result = await execute({ urgent: true });
  if (result.ok) {
    showSuccess('Order submitted!');
  }
};

<button onClick={handleSubmit} disabled={!isAvailable || isExecuting}>
  {isExecuting ? 'Submitting...' : 'Submit Order'}
</button>
```

---

### useFieldPolicy

Get resolved field policy for conditional rendering.

```tsx
function useFieldPolicy(path: SemanticPath): UseFieldPolicyResult
```

#### Parameters

| Param | Type | Description |
|-------|------|-------------|
| `path` | `SemanticPath` | The field path |

#### Returns

```tsx
type UseFieldPolicyResult = ResolvedFieldPolicy;
// {
//   editable: boolean;
//   required: boolean;
//   relevant: boolean;
// }
```

#### Example

```tsx
const policy = useFieldPolicy('data.discountCode');

if (!policy.relevant) return null;

<input
  disabled={!policy.editable}
  required={policy.required}
  aria-required={policy.required}
/>
```

---

### useActionAvailability

Check action availability without execution capability.

```tsx
function useActionAvailability(actionId: string): UseActionAvailabilityResult
```

#### Returns

```tsx
type UseActionAvailabilityResult = {
  isAvailable: boolean;
  preconditions: PreconditionStatus[];
  blockedReasons: Array<{
    path: SemanticPath;
    expected: 'true' | 'false';
    actual: boolean;
    reason?: string;
  }>;
}
```

#### Example

```tsx
const { isAvailable, blockedReasons } = useActionAvailability('deleteAccount');

{!isAvailable && (
  <ul className="warnings">
    {blockedReasons.map((r, i) => (
      <li key={i}>{r.reason}</li>
    ))}
  </ul>
)}
```

---

### useSnapshot

Subscribe to the full runtime snapshot.

```tsx
function useSnapshot<TData, TState>(): DomainSnapshot<TData, TState>
```

> **Note**: Prefer `useValue` for selective subscriptions to minimize re-renders.

#### Example

```tsx
const snapshot = useSnapshot();
console.log(snapshot.data, snapshot.state);
```

---

### useManifestoBridge

Create a bridge instance with full adapter/actuator pattern.

```tsx
function useManifestoBridge<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  options?: UseManifestoBridgeOptions
): Bridge<TData, TState>
```

#### Options

```tsx
type UseManifestoBridgeOptions = {
  syncMode?: 'push' | 'pull' | 'bidirectional';  // default: 'bidirectional'
  autoSync?: boolean;                             // default: true
  debounceMs?: number;                            // default: 0
  onFocus?: (path: SemanticPath) => void;
  onNavigate?: (to: string, mode?: 'push' | 'replace') => void;
  onApiCall?: (request: ApiRequest) => Promise<unknown>;
}
```

#### Example

```tsx
const bridge = useManifestoBridge(runtime, {
  syncMode: 'bidirectional',
  debounceMs: 100,
  onNavigate: (to) => router.push(to),
});
```

---

### useBridge

Get the bridge instance from context.

```tsx
function useBridge<TData, TState>(): Bridge<TData, TState>
```

Must be used within a `BridgeProvider`.

---

### useRuntime

Get the runtime instance from context (legacy).

```tsx
function useRuntime<TData, TState>(): DomainRuntime<TData, TState>
```

Must be used within a `RuntimeProvider`.

---

## Bridge

### createBridge

Create a bridge instance manually.

```tsx
function createBridge<TData, TState>(config: BridgeConfig<TData, TState>): Bridge<TData, TState>
```

#### Config

```tsx
type BridgeConfig<TData, TState> = {
  runtime: DomainRuntime<TData, TState>;
  adapter: Adapter<TData, TState>;
  actuator: Actuator<TData, TState>;
  syncMode?: 'push' | 'pull' | 'bidirectional';
  autoSync?: boolean;
  debounceMs?: number;
}
```

#### Bridge Interface

```tsx
interface Bridge<TData, TState> {
  readonly runtime: DomainRuntime<TData, TState>;

  capture(): void;
  execute(command: Command): Result<void, SetError | EffectError> | Promise<Result<void, EffectError>>;
  sync(): void;
  dispose(): void;

  get<T>(path: SemanticPath): T;
  getFieldPolicy(path: SemanticPath): ResolvedFieldPolicy;
  isActionAvailable(actionId: string): boolean;

  subscribe(listener: BridgeSnapshotListener<TData, TState>): () => void;
  getSnapshot(): DomainSnapshot<TData, TState>;
}
```

---

## Adapter

### createReactAdapter

Create an adapter for reading from React state.

```tsx
function createReactAdapter<TData, TState>(
  options: ReactAdapterOptions<TData, TState>
): Adapter<TData, TState>
```

#### Options

```tsx
type ReactAdapterOptions<TData, TState> = {
  getData: () => TData;
  getState: () => TState;
  validity?: Map<SemanticPath, ValidationResult>;
  onSubscribe?: (listener: () => void) => () => void;
}
```

#### Adapter Interface

```tsx
interface Adapter<TData, TState> {
  getData(path: SemanticPath): unknown;
  getState(path: SemanticPath): unknown;
  getValidity?(path: SemanticPath): ValidationResult | undefined;
  subscribe?(listener: () => void): () => void;
  captureData(): Record<SemanticPath, unknown>;
  captureState(): Record<SemanticPath, unknown>;
}
```

---

## Actuator

### createReactActuator

Create an actuator for writing to React state.

```tsx
function createReactActuator<TData, TState>(
  options: ReactActuatorOptions<TData, TState>
): Actuator<TData, TState>
```

#### Options

```tsx
type ReactActuatorOptions<TData, TState> = {
  setData: (path: SemanticPath, value: unknown) => void;
  setState?: (path: SemanticPath, value: unknown) => void;
  onFocus?: (path: SemanticPath) => void;
  onNavigate?: (to: string, mode?: 'push' | 'replace') => void;
  onApiCall?: (request: ApiRequest) => Promise<unknown>;
}
```

#### Actuator Interface

```tsx
interface Actuator<TData, TState> {
  setData(path: SemanticPath, value: unknown): void;
  setState(path: SemanticPath, value: unknown): void;
  setManyData?(updates: Record<SemanticPath, unknown>): void;
  setManyState?(updates: Record<SemanticPath, unknown>): void;
  focus?(path: SemanticPath): void;
  navigate?(to: string, mode?: 'push' | 'replace'): void;
  apiCall?(request: ApiRequest): Promise<unknown>;
}
```

---

## Commands

### setValue

Create a command to set a single value.

```tsx
function setValue(path: SemanticPath, value: unknown): SetValueCommand
```

### setMany

Create a command to set multiple values atomically.

```tsx
function setMany(updates: Record<SemanticPath, unknown>): SetManyCommand
```

### executeAction

Create a command to execute an action.

```tsx
function executeAction(actionId: string, input?: unknown): ExecuteActionCommand
```

### Type Guards

```tsx
function isSetValueCommand(cmd: Command): cmd is SetValueCommand
function isSetManyCommand(cmd: Command): cmd is SetManyCommand
function isExecuteActionCommand(cmd: Command): cmd is ExecuteActionCommand
```

---

## Types

### Command Types

```tsx
type SetValueCommand = {
  type: 'SET_VALUE';
  path: SemanticPath;
  value: unknown;
}

type SetManyCommand = {
  type: 'SET_MANY';
  updates: Record<SemanticPath, unknown>;
}

type ExecuteActionCommand = {
  type: 'EXECUTE_ACTION';
  actionId: string;
  input?: unknown;
}

type Command = SetValueCommand | SetManyCommand | ExecuteActionCommand;
```

### Error Types

```tsx
type BridgeErrorCode =
  | 'VALIDATION_ERROR'
  | 'EXECUTION_ERROR'
  | 'SYNC_ERROR'
  | 'ADAPTER_ERROR'
  | 'DISPOSED_ERROR';

type BridgeError = {
  code: BridgeErrorCode;
  message: string;
  path?: SemanticPath;
  cause?: unknown;
}
```

### Sync Mode

```tsx
type SyncMode = 'push' | 'pull' | 'bidirectional';
```

- `push`: Changes in runtime are pushed to external state
- `pull`: Changes in external state are pulled into runtime
- `bidirectional`: Both directions (default)
