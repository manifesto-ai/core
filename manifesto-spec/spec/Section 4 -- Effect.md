# Section 4 -- Effect

## 4.1 Overview

An **Effect** describes a side effect to be executed by the runtime. Effects are data structures that represent actions to be taken, not the actions themselves. This "effects as data" approach enables:

- Static analysis of what will happen
- AI understanding of action consequences
- Composition and transformation of effects
- Consistent error handling

---

## 4.2 Design Principles

### 4.2.1 Effects as Data

Effects are descriptions, not executions. An effect value describes what **will** happen when executed, not what **has** happened.

**Example № 1** *Effect as description*

```typescript
// This creates a description, not an execution
const effect: Effect = {
  _tag: 'SetValue',
  path: 'data.count',
  value: ['+', ['get', 'data.count'], 1],
  description: 'Increment counter'
};

// The effect is executed by the runtime
runtime.execute(effect);
```

### 4.2.2 Composability

Effects can be composed using control effects:

- `SequenceEffect`: Execute effects in order
- `ParallelEffect`: Execute effects concurrently
- `ConditionalEffect`: Execute based on condition
- `CatchEffect`: Handle errors

### 4.2.3 Tagged Union

All effects use a `_tag` field for discrimination. This enables:

- Type-safe pattern matching
- Serialization/deserialization
- Effect type guards

---

## 4.3 Effect Type

### 4.3.1 Type Definition

```typescript
type Effect =
  | SetValueEffect
  | SetStateEffect
  | ApiCallEffect
  | NavigateEffect
  | DelayEffect
  | SequenceEffect
  | ParallelEffect
  | ConditionalEffect
  | CatchEffect
  | EmitEventEffect;
```

### 4.3.2 Grammar

```
Effect :
  SetValueEffect |
  SetStateEffect |
  ApiCallEffect |
  NavigateEffect |
  DelayEffect |
  SequenceEffect |
  ParallelEffect |
  ConditionalEffect |
  CatchEffect |
  EmitEventEffect

EffectTag :
  "SetValue" | "SetState" | "ApiCall" | "Navigate" | "Delay" |
  "Sequence" | "Parallel" | "Conditional" | "Catch" | "EmitEvent"
```

---

## 4.4 State Effects

State effects modify the snapshot's `data` or `state` namespaces.

### 4.4.1 SetValueEffect

Sets a value in the `data` namespace.

```typescript
type SetValueEffect = {
  _tag: 'SetValue';
  path: SemanticPath;
  value: Expression;
  description: string;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_tag` | `'SetValue'` | Yes | Effect discriminator |
| `path` | SemanticPath | Yes | Target path in data namespace |
| `value` | Expression | Yes | Value to set (evaluated) |
| `description` | string | Yes | Human/AI-readable description |

**Semantics:**

1. The `path` **MUST** start with `data.`
2. The `value` expression is evaluated against the current snapshot
3. A new snapshot is created with the value set at `path`

**Example № 2** *SetValueEffect*

```typescript
{
  _tag: 'SetValue',
  path: 'data.user.name',
  value: 'Alice',
  description: 'Set user name to Alice'
}

// With expression
{
  _tag: 'SetValue',
  path: 'data.count',
  value: ['+', ['get', 'data.count'], 1],
  description: 'Increment count by 1'
}
```

### 4.4.2 SetStateEffect

Sets a value in the `state` namespace.

```typescript
type SetStateEffect = {
  _tag: 'SetState';
  path: SemanticPath;
  value: Expression;
  description: string;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_tag` | `'SetState'` | Yes | Effect discriminator |
| `path` | SemanticPath | Yes | Target path in state namespace |
| `value` | Expression | Yes | Value to set (evaluated) |
| `description` | string | Yes | Human/AI-readable description |

**Semantics:**

1. The `path` **MUST** start with `state.`
2. The `value` expression is evaluated against the current snapshot
3. A new snapshot is created with the value set at `path`

**Example № 3** *SetStateEffect*

```typescript
{
  _tag: 'SetState',
  path: 'state.isLoading',
  value: true,
  description: 'Set loading state to true'
}

{
  _tag: 'SetState',
  path: 'state.error',
  value: null,
  description: 'Clear error state'
}
```

---

## 4.5 IO Effects

IO effects perform external operations.

### 4.5.1 ApiCallEffect

Performs an HTTP request.

```typescript
type ApiCallEffect = {
  _tag: 'ApiCall';
  endpoint: string | Expression;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, Expression>;
  headers?: Record<string, string>;
  query?: Record<string, Expression>;
  timeout?: number;
  description: string;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_tag` | `'ApiCall'` | Yes | Effect discriminator |
| `endpoint` | string \| Expression | Yes | URL endpoint (can be dynamic) |
| `method` | HTTP method | Yes | HTTP request method |
| `body` | Record | No | Request body (values are expressions) |
| `headers` | Record | No | Request headers (static strings) |
| `query` | Record | No | Query parameters (values are expressions) |
| `timeout` | number | No | Timeout in milliseconds |
| `description` | string | Yes | Human/AI-readable description |

**Semantics:**

1. The `endpoint` is evaluated if it's an Expression
2. All Expression values in `body` and `query` are evaluated
3. The request is made with the evaluated values
4. The result is returned for handling

**Example № 4** *ApiCallEffect*

```typescript
{
  _tag: 'ApiCall',
  endpoint: '/api/users',
  method: 'POST',
  body: {
    name: ['get', 'data.user.name'],
    email: ['get', 'data.user.email']
  },
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 5000,
  description: 'Create new user'
}

// Dynamic endpoint
{
  _tag: 'ApiCall',
  endpoint: ['concat', '/api/users/', ['get', 'data.userId']],
  method: 'GET',
  description: 'Fetch user by ID'
}
```

### 4.5.2 NavigateEffect

Performs client-side navigation.

```typescript
type NavigateEffect = {
  _tag: 'Navigate';
  to: string | Expression;
  mode?: 'push' | 'replace';
  description: string;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_tag` | `'Navigate'` | Yes | Effect discriminator |
| `to` | string \| Expression | Yes | Navigation path |
| `mode` | 'push' \| 'replace' | No | History mode (default: 'push') |
| `description` | string | Yes | Human/AI-readable description |

**Example № 5** *NavigateEffect*

```typescript
{
  _tag: 'Navigate',
  to: '/dashboard',
  mode: 'push',
  description: 'Navigate to dashboard'
}

// Dynamic navigation
{
  _tag: 'Navigate',
  to: ['concat', '/orders/', ['get', 'state.orderId']],
  description: 'Navigate to order details'
}
```

---

## 4.6 Temporal Effects

### 4.6.1 DelayEffect

Pauses execution for a specified duration.

```typescript
type DelayEffect = {
  _tag: 'Delay';
  ms: number;
  description: string;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_tag` | `'Delay'` | Yes | Effect discriminator |
| `ms` | number | Yes | Delay in milliseconds |
| `description` | string | Yes | Human/AI-readable description |

**Example № 6** *DelayEffect*

```typescript
{
  _tag: 'Delay',
  ms: 1000,
  description: 'Wait 1 second before next action'
}
```

---

## 4.7 Control Effects

Control effects manage effect execution flow.

### 4.7.1 SequenceEffect

Executes effects in sequential order.

```typescript
type SequenceEffect = {
  _tag: 'Sequence';
  effects: Effect[];
  description: string;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_tag` | `'Sequence'` | Yes | Effect discriminator |
| `effects` | Effect[] | Yes | Effects to execute in order |
| `description` | string | Yes | Human/AI-readable description |

**Semantics:**

1. Effects are executed in array order
2. Each effect waits for the previous to complete
3. Execution stops on first error
4. The result of the last effect is returned

**Example № 7** *SequenceEffect*

```typescript
{
  _tag: 'Sequence',
  effects: [
    { _tag: 'SetState', path: 'state.isLoading', value: true, description: 'Start loading' },
    { _tag: 'ApiCall', endpoint: '/api/data', method: 'GET', description: 'Fetch data' },
    { _tag: 'SetState', path: 'state.isLoading', value: false, description: 'Stop loading' }
  ],
  description: 'Fetch data with loading state'
}
```

### 4.7.2 ParallelEffect

Executes effects concurrently.

```typescript
type ParallelEffect = {
  _tag: 'Parallel';
  effects: Effect[];
  waitAll?: boolean;
  description: string;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_tag` | `'Parallel'` | Yes | Effect discriminator |
| `effects` | Effect[] | Yes | Effects to execute concurrently |
| `waitAll` | boolean | No | Wait for all (true) or first (false) |
| `description` | string | Yes | Human/AI-readable description |

**Semantics:**

- If `waitAll` is true (default): Wait for all effects to complete
- If `waitAll` is false: Return when first effect completes

**Example № 8** *ParallelEffect*

```typescript
// Wait for all
{
  _tag: 'Parallel',
  effects: [
    { _tag: 'ApiCall', endpoint: '/api/users', method: 'GET', description: 'Fetch users' },
    { _tag: 'ApiCall', endpoint: '/api/products', method: 'GET', description: 'Fetch products' }
  ],
  waitAll: true,
  description: 'Fetch users and products concurrently'
}

// Race (first wins)
{
  _tag: 'Parallel',
  effects: [
    { _tag: 'ApiCall', endpoint: '/api/fast', method: 'GET', description: 'Fast endpoint' },
    { _tag: 'ApiCall', endpoint: '/api/slow', method: 'GET', description: 'Slow endpoint' }
  ],
  waitAll: false,
  description: 'Use first responding endpoint'
}
```

### 4.7.3 ConditionalEffect

Executes effects based on a condition.

```typescript
type ConditionalEffect = {
  _tag: 'Conditional';
  condition: Expression;
  then: Effect;
  else?: Effect;
  description: string;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_tag` | `'Conditional'` | Yes | Effect discriminator |
| `condition` | Expression | Yes | Boolean expression |
| `then` | Effect | Yes | Effect if condition is true |
| `else` | Effect | No | Effect if condition is false |
| `description` | string | Yes | Human/AI-readable description |

**Semantics:**

1. The `condition` expression is evaluated
2. If truthy, `then` effect is executed
3. If falsy and `else` is provided, `else` effect is executed
4. If falsy and no `else`, no effect is executed

**Example № 9** *ConditionalEffect*

```typescript
{
  _tag: 'Conditional',
  condition: ['>', ['get', 'data.cart.total'], 100],
  then: {
    _tag: 'SetValue',
    path: 'data.discount',
    value: 10,
    description: 'Apply 10% discount'
  },
  else: {
    _tag: 'SetValue',
    path: 'data.discount',
    value: 0,
    description: 'No discount'
  },
  description: 'Apply discount for orders over $100'
}
```

### 4.7.4 CatchEffect

Handles errors during effect execution.

```typescript
type CatchEffect = {
  _tag: 'Catch';
  try: Effect;
  catch: Effect;
  finally?: Effect;
  description: string;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_tag` | `'Catch'` | Yes | Effect discriminator |
| `try` | Effect | Yes | Effect to attempt |
| `catch` | Effect | Yes | Effect on error |
| `finally` | Effect | No | Effect to always execute |
| `description` | string | Yes | Human/AI-readable description |

**Semantics:**

1. The `try` effect is executed
2. If `try` succeeds, its result is returned
3. If `try` fails, the `catch` effect is executed
4. The `finally` effect is always executed (if provided)

**Example № 10** *CatchEffect*

```typescript
{
  _tag: 'Catch',
  try: {
    _tag: 'ApiCall',
    endpoint: '/api/data',
    method: 'GET',
    description: 'Fetch data'
  },
  catch: {
    _tag: 'SetState',
    path: 'state.error',
    value: 'Failed to fetch data',
    description: 'Set error message'
  },
  finally: {
    _tag: 'SetState',
    path: 'state.isLoading',
    value: false,
    description: 'Clear loading state'
  },
  description: 'Fetch data with error handling'
}
```

---

## 4.8 Event Effects

### 4.8.1 EmitEventEffect

Emits a one-time event to a channel.

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_tag` | `'EmitEvent'` | Yes | Effect discriminator |
| `channel` | enum | Yes | Event channel |
| `payload` | object | Yes | Event payload |
| `description` | string | Yes | Human/AI-readable description |

**Channels:**

| Channel | Purpose |
|---------|---------|
| `ui` | UI notifications (toasts, modals) |
| `domain` | Domain events for internal handling |
| `analytics` | Analytics tracking events |

**Payload Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Event type identifier |
| `message` | string | No | Human-readable message |
| `data` | unknown | No | Additional event data |
| `severity` | enum | No | UI severity level |
| `duration` | number | No | Display duration (ms) |

**Example № 11** *EmitEventEffect*

```typescript
// UI notification
{
  _tag: 'EmitEvent',
  channel: 'ui',
  payload: {
    type: 'notification',
    message: 'Order placed successfully!',
    severity: 'success',
    duration: 3000
  },
  description: 'Show success notification'
}

// Analytics event
{
  _tag: 'EmitEvent',
  channel: 'analytics',
  payload: {
    type: 'checkout_completed',
    data: {
      orderId: '12345',
      total: 99.99
    }
  },
  description: 'Track checkout completion'
}
```

---

## 4.9 Type Guards

### 4.9.1 isEffect

Checks if a value is an Effect.

```
isEffect(value):
1. If {value} is null or undefined, return false.
2. If typeof {value} is not 'object', return false.
3. Let {tag} be {value}._tag.
4. Return {tag} is one of the valid effect tags.
```

### 4.9.2 isEffectOfType

Checks if an effect has a specific tag.

```typescript
function isEffectOfType<T extends EffectTag>(
  effect: Effect,
  tag: T
): effect is Extract<Effect, { _tag: T }>;
```

**Example № 12** *Type guards*

```typescript
const effect: Effect = getEffect();

if (isEffect(effect)) {
  console.log('Valid effect');
}

if (isEffectOfType(effect, 'ApiCall')) {
  // TypeScript knows effect is ApiCallEffect
  console.log(effect.endpoint);
}
```

---

## 4.10 Effect Handler

The runtime requires an EffectHandler to execute IO effects.

### 4.10.1 ApiRequest Type

```typescript
type ApiRequest = {
  endpoint: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  timeout?: number;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `endpoint` | string | Yes | Target URL endpoint |
| `method` | string | Yes | HTTP method (GET, POST, etc.) |
| `body` | unknown | No | Request body (already evaluated) |
| `headers` | Record | No | HTTP headers |
| `query` | Record | No | Query parameters (already evaluated) |
| `timeout` | number | No | Request timeout in milliseconds |

### 4.10.2 EffectHandler Type

```typescript
type EffectHandler = {
  setValue: (path: SemanticPath, value: unknown) => void;
  setState: (path: SemanticPath, value: unknown) => void;
  apiCall: (request: ApiRequest) => Promise<unknown>;
  navigate: (to: string, mode?: 'push' | 'replace') => void;
  emitEvent: (channel: string, payload: unknown) => void;
};
```

A conforming implementation **MUST** provide an EffectHandler with all required methods.

---

## 4.11 Effect Builder Functions

A conforming Level 3 implementation **SHOULD** provide builder functions for creating effects.

### 4.11.1 Builder Function Signatures

```typescript
// State effects
function setValue(path: SemanticPath, value: Expression, description: string): SetValueEffect;
function setState(path: SemanticPath, value: Expression, description: string): SetStateEffect;

// IO effects
function apiCall(options: Omit<ApiCallEffect, '_tag'>): ApiCallEffect;
function navigate(to: string | Expression, options?: { mode?: 'push' | 'replace'; description?: string }): NavigateEffect;

// Temporal effects
function delay(ms: number, description?: string): DelayEffect;

// Control effects
function sequence(effects: Effect[], description?: string): SequenceEffect;
function parallel(effects: Effect[], options?: { waitAll?: boolean; description?: string }): ParallelEffect;
function conditional(options: { condition: Expression; then: Effect; else?: Effect; description?: string }): ConditionalEffect;
function catchEffect(options: { try: Effect; catch: Effect; finally?: Effect; description?: string }): CatchEffect;

// Event effects
function emitEvent(channel: 'ui' | 'domain' | 'analytics', payload: EventPayload, description?: string): EmitEventEffect;
```

### 4.11.2 Builder Usage

**Example № 13** *Using builder functions*

```typescript
import { setValue, setState, sequence, apiCall, catchEffect } from '@manifesto-ai/core';

const effect = sequence([
  setState('state.isLoading', true, 'Start loading'),
  catchEffect({
    try: apiCall({
      endpoint: '/api/users',
      method: 'POST',
      body: { name: ['get', 'data.name'] },
      description: 'Create user'
    }),
    catch: setState('state.error', 'Failed to create user', 'Set error'),
    finally: setState('state.isLoading', false, 'Stop loading'),
    description: 'Create user with error handling'
  })
], 'Complete user creation flow');
```

### 4.11.3 Builder Function Defaults

When the `description` parameter is omitted, builder functions **SHOULD** generate a default description:

| Function | Default Description |
|----------|---------------------|
| `delay(ms)` | `"Wait {ms}ms"` |
| `navigate(to)` | `"Navigate to {to}"` |
| `sequence(effects)` | `"Sequence of {N} effects"` |
| `parallel(effects)` | `"Parallel execution of {N} effects"` |
| `catchEffect(options)` | `"Catch effect"` |
| `emitEvent(channel, payload)` | `"Emit {payload.type} to {channel}"` |

**Example № 14** *Default description generation*

```typescript
const delayEffect = delay(1000);
// delayEffect.description === "Wait 1000ms"

const navEffect = navigate('/dashboard');
// navEffect.description === "Navigate to /dashboard"

const seqEffect = sequence([
  setValue('data.a', 1, 'Set a'),
  setValue('data.b', 2, 'Set b')
]);
// seqEffect.description === "Sequence of 2 effects"
```

---

## 4.12 Result Type

Effect execution returns a Result type for explicit error handling.

```typescript
type Result<T, E = EffectError> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

### 4.12.1 EffectError

```typescript
type EffectError = {
  _tag: 'EffectError';
  effect: Effect;
  cause: Error;
  context?: EvaluationContext;
  code?: string;
};
```

| Field | Type | Description |
|-------|------|-------------|
| `_tag` | 'EffectError' | Type discriminator |
| `effect` | Effect | The effect that failed |
| `cause` | Error | The underlying error |
| `context` | EvaluationContext | Evaluation context at failure |
| `code` | string | Optional error code |

### 4.12.2 Result Constructors

```typescript
function ok<T>(value: T): Result<T, never>;
function err<E>(error: E): Result<never, E>;
function effectError(effect: Effect, cause: Error, options?: { context?: EvaluationContext; code?: string }): EffectError;
```

**Example № 14** *Creating results*

```typescript
const success = ok(42);          // { ok: true, value: 42 }
const failure = err('failed');   // { ok: false, error: 'failed' }
```

### 4.12.3 Type Guards

```typescript
function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T };
function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E };
```

### 4.12.4 Value Extractors

```typescript
function unwrap<T, E>(result: Result<T, E>): T;         // Throws on error
function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T;
function unwrapErr<T, E>(result: Result<T, E>): E | undefined;
```

**Example № 15** *Extracting values*

```typescript
const result = await runEffect(effect, config);

// Safe extraction with default
const value = unwrapOr(result, defaultValue);

// Throw on error
try {
  const value = unwrap(result);
} catch (error) {
  console.error('Effect failed:', error);
}
```

### 4.12.5 Transformers (Monadic Operations)

```typescript
function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>;
function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>;
function flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E>;
function flatten<T, E>(result: Result<Result<T, E>, E>): Result<T, E>;
```

**Example № 16** *Monadic operations*

```typescript
const result = await runEffect(effect, config);

// Transform success value
const doubled = map(result, value => value * 2);

// Chain operations
const chained = flatMap(result, value =>
  value > 0 ? ok(value) : err('Value must be positive')
);
```

### 4.12.6 Combinators

```typescript
function all<T, E>(results: Result<T, E>[]): Result<T[], E>;
function any<T, E>(results: Result<T, E>[]): Result<T, E[]>;
```

**Semantics:**

- `all`: Returns `Ok` with array of values if all succeed, otherwise first `Err`
- `any`: Returns first `Ok`, otherwise `Err` with array of all errors

**Example № 17** *Combining results*

```typescript
const results = await Promise.all([
  runEffect(effect1, config),
  runEffect(effect2, config),
  runEffect(effect3, config)
]);

// All must succeed
const combined = all(results);
if (combined.ok) {
  console.log('All succeeded:', combined.value);
}

// At least one must succeed
const firstSuccess = any(results);
```

### 4.12.7 Async Utilities

```typescript
function fromPromise<T>(promise: Promise<T>, mapError?: (e: unknown) => Error): Promise<Result<T, Error>>;
function tryCatch<T>(fn: () => T, mapError?: (e: unknown) => Error): Result<T, Error>;
```

**Example № 18** *Async result handling*

```typescript
// Convert promise to result
const result = await fromPromise(fetch('/api/data'));

// Wrap throwing function
const parsed = tryCatch(() => JSON.parse(text));
```

---

## 4.13 Effect Execution

### 4.13.1 EffectRunnerConfig

```typescript
type EffectRunnerConfig = {
  handler: EffectHandler;
  context: EvaluationContext;
};
```

### 4.13.2 runEffect

Executes an effect and returns a Result.

```typescript
function runEffect(effect: Effect, config: EffectRunnerConfig): Promise<Result<unknown, EffectError>>;
```

**Example № 19** *Effect execution*

```typescript
const result = await runEffect(effect, {
  handler: myHandler,
  context: createContext(snapshot)
});

if (result.ok) {
  console.log('Success:', result.value);
} else {
  console.error('Error:', result.error.cause.message);
}
```
