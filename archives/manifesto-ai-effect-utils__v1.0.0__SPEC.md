# @manifesto-ai/effect-utils Specification v1.0

> **Status:** Draft  
> **Authors:** Manifesto Team  
> **License:** MIT  
> **Dependencies:** zod (required)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Normative Language](#2-normative-language)
3. [Design Principles](#3-design-principles)
4. [Public Exports](#4-public-exports)
5. [Core Types](#5-core-types)
6. [Combinators](#6-combinators)
7. [Transforms](#7-transforms)
8. [Schema and Handler Factory](#8-schema-and-handler-factory)
9. [Standard Patterns](#9-standard-patterns)
10. [Error Handling](#10-error-handling)
11. [Package Boundary](#11-package-boundary)
12. [Compliance](#12-compliance)

---

## 1. Introduction

### 1.1 What is effect-utils?

`@manifesto-ai/effect-utils` is a **DX layer** for building Effect Handlers in Manifesto.

It provides:

- **Combinators** — Stateless functions for timeout, retry, parallel execution
- **Transforms** — Helpers to convert results into `Patch[]`
- **Schema Factory** — Type-safe handler creation with Zod

### 1.2 What effect-utils is NOT

effect-utils is NOT:

- An HTTP client
- A database adapter
- A stream/observable library
- A full resilience framework (no circuit breaker)
- A required dependency (Host works without it)

### 1.3 Design Goals

| Goal | Description |
|------|-------------|
| **Composable** | Small functions that combine |
| **Stateless** | No cross-request memory |
| **Type-safe** | Full TypeScript inference |
| **Host-aligned** | Produces `Patch[]` per Host Contract |

### 1.4 Relationship to Other Packages

```
@manifesto-ai/effect-utils
        │
        ▼ (types only)
@manifesto-ai/core              ← Patch, Snapshot types

@manifesto-ai/host
        │
        └──▶ @manifesto-ai/effect-utils (optional peer)
```

**effect-utils is to Host what Builder is to Core: a DX layer that doesn't execute.**

---

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

---

## 3. Design Principles

### 3.1 Function Composition over Configuration

```typescript
// ✅ Composition — effect-utils pattern
const resilientFetch = withRetry(
  withTimeout(fetchData, 5000),
  { maxRetries: 3 }
);

// ❌ Configuration — NOT effect-utils pattern
const handler = createHandler({
  fetch: fetchData,
  timeout: 5000,
  retry: { max: 3 },
  // ... many more options
});
```

### 3.2 Stateless Combinators

All combinators MUST be stateless. They transform functions without maintaining cross-request memory.

```typescript
// ✅ Stateless — each call is independent
const fn = withTimeout(fetch, 5000);
await fn();  // No memory of previous calls
await fn();  // Completely independent

// ❌ Stateful — NOT in effect-utils
const fn = withCircuitBreaker(fetch, { threshold: 5 });
await fn();  // Remembers failure count ← Requires state
```

### 3.3 Settled Results for Partial Failures

`parallel()` and related combinators return `Settled<T>` to preserve partial successes.

```typescript
// All results preserved, even on partial failure
const results = await parallel({
  a: () => Promise.resolve(1),
  b: () => Promise.reject(new Error('fail')),
  c: () => Promise.resolve(3),
})();

// results = {
//   a: { status: 'fulfilled', value: 1 },
//   b: { status: 'rejected', reason: Error('fail') },
//   c: { status: 'fulfilled', value: 3 },
// }
```

---

## 4. Public Exports

```typescript
// @manifesto-ai/effect-utils

// ═══════════════════════════════════════════════════════════
// Combinators
// ═══════════════════════════════════════════════════════════
export { withTimeout } from './combinators/timeout';
export { withRetry } from './combinators/retry';
export { withFallback } from './combinators/fallback';
export { parallel } from './combinators/parallel';
export { race } from './combinators/race';
export { sequential } from './combinators/sequential';

// ═══════════════════════════════════════════════════════════
// Transforms
// ═══════════════════════════════════════════════════════════
export { toPatch, toPatches } from './transforms/patch';
export { toErrorPatch, toErrorPatches } from './transforms/error';
export { collectErrors, collectFulfilled } from './transforms/collect';

// ═══════════════════════════════════════════════════════════
// Schema & Handler Factory
// ═══════════════════════════════════════════════════════════
export { defineEffectSchema } from './schema/define';
export { createHandler } from './schema/handler';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════
export type {
  // Result types
  Settled,
  Fulfilled,
  Rejected,

  // Combinator options
  RetryOptions,
  TimeoutOptions,
  ParallelOptions,

  // Schema types
  EffectSchema,
  EffectSchemaConfig,
  HandlerImplementation,

  // Re-exports from core (convenience)
  Patch,
  Snapshot,
} from './types';
```

---

## 5. Core Types

### 5.1 Settled

Represents the outcome of an async operation, mirroring `PromiseSettledResult`.

```typescript
type Fulfilled<T> = {
  readonly status: 'fulfilled';
  readonly value: T;
};

type Rejected = {
  readonly status: 'rejected';
  readonly reason: Error;
};

type Settled<T> = Fulfilled<T> | Rejected;
```

### 5.2 AsyncFn

Generic async function type used throughout combinators.

```typescript
type AsyncFn<T> = () => Promise<T>;
type AsyncFnWithArgs<TArgs extends unknown[], TReturn> = (...args: TArgs) => Promise<TReturn>;
```

### 5.3 Patch (re-export from Core)

```typescript
type Patch = {
  readonly op: 'set' | 'unset' | 'merge';
  readonly path: string;
  readonly value?: unknown;
};
```

### 5.4 EffectContext (aligned with Host)

Context provided to effect handlers by Host.

```typescript
type EffectContext = {
  /** Current snapshot (read-only) */
  readonly snapshot: Readonly<Snapshot>;
  
  /** The requirement being fulfilled */
  readonly requirement: Requirement;
};

type Requirement = {
  readonly id: string;
  readonly type: string;
  readonly params: Record<string, unknown>;
};
```

### 5.5 EffectHandler (aligned with Host)

```typescript
type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
) => Promise<Patch[]>;
```

**Note:** This signature matches `@manifesto-ai/host` exactly. effect-utils produces handlers that are directly compatible with Host.

### 5.6 TimeoutError

```typescript
class TimeoutError extends Error {
  readonly name = 'TimeoutError';
  readonly ms: number;
  
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.ms = ms;
  }
}
```

### 5.7 RetryError

```typescript
class RetryError extends Error {
  readonly name = 'RetryError';
  readonly attempts: number;
  readonly lastError: Error;
  
  constructor(attempts: number, lastError: Error) {
    super(`Failed after ${attempts} attempts: ${lastError.message}`);
    this.attempts = attempts;
    this.lastError = lastError;
  }
}
```

---

## 6. Combinators

### 6.1 withTimeout

Wraps a function with a timeout. Returns `TimeoutError` if deadline exceeded.

#### Signature

```typescript
function withTimeout<T>(
  fn: AsyncFn<T>,
  ms: number,
  options?: TimeoutOptions
): AsyncFn<T>;

type TimeoutOptions = {
  /** Custom error message */
  message?: string;
  /** AbortController for cancellation (optional) */
  signal?: AbortSignal;
};
```

#### Behavior

| Condition | Result |
|-----------|--------|
| `fn` resolves before `ms` | Returns resolved value |
| `fn` rejects before `ms` | Throws original error |
| `ms` exceeded | Throws `TimeoutError` |
| `signal` aborted | Throws `AbortError` |

#### Example

```typescript
const fetchWithTimeout = withTimeout(
  () => fetch('/api/data').then(r => r.json()),
  5000
);

try {
  const data = await fetchWithTimeout();
} catch (e) {
  if (e instanceof TimeoutError) {
    console.log('Request timed out');
  }
}
```

#### Implementation Requirements

- MUST use `Promise.race` or equivalent
- MUST clean up timer on resolution/rejection
- SHOULD support `AbortSignal` for cancellation
- MUST NOT leak timers

---

### 6.2 withRetry

Wraps a function with retry logic.

#### Signature

```typescript
function withRetry<T>(
  fn: AsyncFn<T>,
  options: RetryOptions
): AsyncFn<T>;

type RetryOptions = {
  /** Maximum retry attempts (not including initial) */
  maxRetries: number;
  
  /** Backoff strategy */
  backoff?: 'none' | 'linear' | 'exponential';
  
  /** Base delay in ms (default: 1000) */
  baseDelay?: number;
  
  /** Maximum delay in ms (default: 30000) */
  maxDelay?: number;
  
  /** Predicate to determine if error is retryable */
  retryIf?: (error: Error, attempt: number) => boolean;
  
  /** Callback on each retry */
  onRetry?: (error: Error, attempt: number) => void;
};
```

#### Backoff Strategies

| Strategy | Delay Formula |
|----------|---------------|
| `none` | `baseDelay` |
| `linear` | `baseDelay * attempt` |
| `exponential` | `baseDelay * 2^(attempt-1)` |

#### Behavior

| Condition | Result |
|-----------|--------|
| `fn` succeeds | Returns value |
| `fn` fails, retries remaining | Waits, retries |
| `fn` fails, `retryIf` returns false | Throws immediately |
| All retries exhausted | Throws `RetryError` |

#### Example

```typescript
const resilientFetch = withRetry(
  () => fetch('/api/data').then(r => r.json()),
  {
    maxRetries: 3,
    backoff: 'exponential',
    baseDelay: 1000,
    retryIf: (error) => {
      // Only retry network errors, not 4xx
      return error.name === 'TypeError' || error.message.includes('network');
    },
    onRetry: (error, attempt) => {
      console.log(`Retry ${attempt}: ${error.message}`);
    }
  }
);
```

#### Implementation Requirements

- MUST respect `maxRetries` (0 means no retries)
- MUST apply backoff delay between attempts
- MUST cap delay at `maxDelay`
- MUST call `onRetry` before each retry (not initial attempt)
- MUST wrap final error in `RetryError`

---

### 6.3 withFallback

Wraps a function with a fallback value on failure.

#### Signature

```typescript
function withFallback<T>(
  fn: AsyncFn<T>,
  fallback: T | ((error: Error) => T) | ((error: Error) => Promise<T>)
): AsyncFn<T>;
```

#### Behavior

| Condition | Result |
|-----------|--------|
| `fn` succeeds | Returns value |
| `fn` fails, `fallback` is value | Returns fallback |
| `fn` fails, `fallback` is function | Returns `fallback(error)` |

#### Example

```typescript
// Static fallback
const fetchWithDefault = withFallback(
  () => fetch('/api/config').then(r => r.json()),
  { theme: 'light', language: 'en' }
);

// Dynamic fallback
const fetchWithCache = withFallback(
  () => fetch('/api/data').then(r => r.json()),
  (error) => loadFromCache()
);
```

#### Implementation Requirements

- MUST catch all errors from `fn`
- MUST support sync and async fallback functions
- MUST pass error to fallback function
- MUST NOT swallow errors in fallback function

---

### 6.4 parallel

Executes multiple functions concurrently, returning all results.

#### Signature

```typescript
function parallel<T extends Record<string, AsyncFn<unknown>>>(
  fns: T,
  options?: ParallelOptions
): AsyncFn<{ [K in keyof T]: Settled<Awaited<ReturnType<T[K]>>> }>;

type ParallelOptions = {
  /** Stop on first failure (default: false) */
  failFast?: boolean;
};
```

#### Behavior

| Condition | Result |
|-----------|--------|
| All succeed | All `Fulfilled` |
| Some fail, `failFast: false` | Mixed `Fulfilled`/`Rejected` |
| Some fail, `failFast: true` | Throws first error |

#### Example

```typescript
const fetchAll = parallel({
  users: () => fetch('/api/users').then(r => r.json()),
  posts: () => fetch('/api/posts').then(r => r.json()),
  config: () => fetch('/api/config').then(r => r.json()),
});

const results = await fetchAll();

if (results.users.status === 'fulfilled') {
  console.log('Users:', results.users.value);
}

if (results.posts.status === 'rejected') {
  console.log('Posts failed:', results.posts.reason);
}
```

#### Implementation Requirements

- MUST execute all functions concurrently (not sequentially)
- MUST wait for all to complete when `failFast: false`
- MUST return results in same shape as input
- MUST use `Promise.allSettled` semantics by default

---

### 6.5 race

Executes multiple functions concurrently, returning first success.

#### Signature

```typescript
function race<T>(
  fns: AsyncFn<T>[],
  options?: RaceOptions
): AsyncFn<T>;

type RaceOptions = {
  /** Minimum successes required (default: 1) */
  minSuccesses?: number;
};
```

#### Behavior

| Condition | Result |
|-----------|--------|
| First succeeds | Returns first value |
| All fail | Throws `AggregateError` |

#### Example

```typescript
const fetchFromFastest = race([
  () => fetch('https://api1.example.com/data').then(r => r.json()),
  () => fetch('https://api2.example.com/data').then(r => r.json()),
  () => fetch('https://api3.example.com/data').then(r => r.json()),
]);

const data = await fetchFromFastest();
```

#### Implementation Requirements

- MUST return on first success
- MUST attempt to cancel other operations (if supported)
- MUST throw `AggregateError` if all fail
- MUST NOT wait for slower operations after success

---

### 6.6 sequential

Executes functions in order, optionally stopping on failure.

#### Signature

```typescript
function sequential<T extends AsyncFn<unknown>[]>(
  fns: T,
  options?: SequentialOptions
): AsyncFn<{ [K in keyof T]: Settled<Awaited<ReturnType<T[K]>>> }>;

type SequentialOptions = {
  /** Stop on first failure (default: false) */
  stopOnError?: boolean;
};
```

#### Behavior

| Condition | Result |
|-----------|--------|
| All succeed | All `Fulfilled` |
| One fails, `stopOnError: false` | Continue, include `Rejected` |
| One fails, `stopOnError: true` | Stop, remaining are not executed |

#### Example

```typescript
const pipeline = sequential([
  () => validateInput(data),
  () => transformData(data),
  () => saveToDatabase(data),
], { stopOnError: true });

const results = await pipeline();
```

#### Implementation Requirements

- MUST execute in array order
- MUST wait for each to complete before starting next
- MUST respect `stopOnError` option
- MUST return array in same order as input

---

## 7. Transforms

### 7.1 toPatch

Creates a single `set` patch.

#### Signature

```typescript
function toPatch(path: string, value: unknown): Patch;
function toPatch(path: string, value: undefined, op: 'unset'): Patch;
function toPatch(path: string, value: unknown, op: 'merge'): Patch;
```

#### Example

```typescript
toPatch('data.user', { name: 'Alice' });
// → { op: 'set', path: 'data.user', value: { name: 'Alice' } }

toPatch('data.temp', undefined, 'unset');
// → { op: 'unset', path: 'data.temp' }

toPatch('data.settings', { theme: 'dark' }, 'merge');
// → { op: 'merge', path: 'data.settings', value: { theme: 'dark' } }
```

---

### 7.2 toPatches

Creates multiple patches from a path-value mapping.

#### Signature

```typescript
function toPatches(
  mappings: Record<string, unknown>,
  op?: 'set' | 'merge'
): Patch[];
```

#### Example

```typescript
toPatches({
  'data.user': userData,
  'data.loadedAt': Date.now(),
  'data.status': 'ready',
});
// → [
//   { op: 'set', path: 'data.user', value: userData },
//   { op: 'set', path: 'data.loadedAt', value: 1234567890 },
//   { op: 'set', path: 'data.status', value: 'ready' },
// ]
```

---

### 7.3 toErrorPatch

Creates a patch representing an error.

#### Signature

```typescript
function toErrorPatch(path: string, error: Error): Patch;
function toErrorPatch(path: string, error: { code: string; message: string }): Patch;
```

#### Error Value Structure

```typescript
type ErrorValue = {
  readonly $error: true;
  readonly code: string;
  readonly message: string;
  readonly stack?: string;
  readonly timestamp: number;
};
```

#### Example

```typescript
toErrorPatch('data.error', new Error('Network failed'));
// → {
//   op: 'set',
//   path: 'data.error',
//   value: {
//     $error: true,
//     code: 'Error',
//     message: 'Network failed',
//     stack: '...',
//     timestamp: 1234567890
//   }
// }

toErrorPatch('data.error', { code: 'NETWORK_ERROR', message: 'Connection refused' });
// → {
//   op: 'set',
//   path: 'data.error',
//   value: {
//     $error: true,
//     code: 'NETWORK_ERROR',
//     message: 'Connection refused',
//     timestamp: 1234567890
//   }
// }
```

---

### 7.4 toErrorPatches

Creates standard error patches for `system.lastError` and optional custom path.

#### Signature

```typescript
function toErrorPatches(error: Error, customPath?: string): Patch[];
```

#### Example

```typescript
toErrorPatches(new Error('Failed'), 'data.loadError');
// → [
//   { op: 'set', path: 'system.lastError', value: { $error: true, ... } },
//   { op: 'set', path: 'data.loadError', value: { $error: true, ... } },
// ]
```

---

### 7.5 collectErrors

Extracts errors from `Settled` results into a patch.

#### Signature

```typescript
function collectErrors<T extends Record<string, Settled<unknown>>>(
  results: T,
  path: string
): Patch[];
```

#### Example

```typescript
const results = {
  ais: { status: 'fulfilled', value: aisData },
  tos: { status: 'rejected', reason: new Error('Timeout') },
  weather: { status: 'rejected', reason: new Error('Not found') },
};

collectErrors(results, 'signals.errors');
// → [{
//   op: 'set',
//   path: 'signals.errors',
//   value: {
//     tos: { $error: true, code: 'Error', message: 'Timeout', ... },
//     weather: { $error: true, code: 'Error', message: 'Not found', ... }
//   }
// }]
```

---

### 7.6 collectFulfilled

Extracts fulfilled values from `Settled` results.

#### Signature

```typescript
function collectFulfilled<T extends Record<string, Settled<unknown>>>(
  results: T
): { [K in keyof T]?: T[K] extends Fulfilled<infer V> ? V : never };
```

#### Example

```typescript
const results = {
  ais: { status: 'fulfilled', value: aisData },
  tos: { status: 'rejected', reason: new Error('Timeout') },
  weather: { status: 'fulfilled', value: weatherData },
};

collectFulfilled(results);
// → { ais: aisData, weather: weatherData }
```

---

## 8. Schema and Handler Factory

### 8.1 defineEffectSchema

Defines a type-safe effect schema.

#### Signature

```typescript
function defineEffectSchema<
  TType extends string,
  TInput extends z.ZodType,
  TOutput extends z.ZodType
>(config: EffectSchemaConfig<TType, TInput, TOutput>): EffectSchema<TType, TInput, TOutput>;

type EffectSchemaConfig<TType, TInput, TOutput> = {
  /** Effect type identifier (must match MEL effect declaration) */
  readonly type: TType;
  
  /** Input schema (Zod) */
  readonly input: TInput;
  
  /** Output schema (Zod) */
  readonly output: TOutput;
  
  /** Path where output will be written */
  readonly outputPath: string;
  
  /** Optional description */
  readonly description?: string;
};

type EffectSchema<TType, TInput, TOutput> = {
  readonly type: TType;
  readonly inputSchema: TInput;
  readonly outputSchema: TOutput;
  readonly outputPath: string;
  readonly description?: string;
  
  // Type inference helpers (phantom types)
  readonly _input: z.infer<TInput>;
  readonly _output: z.infer<TOutput>;
};
```

#### Example

```typescript
import { z } from 'zod';
import { defineEffectSchema } from '@manifesto-ai/effect-utils';

const fetchUserSchema = defineEffectSchema({
  type: 'api.user.fetch',
  input: z.object({
    userId: z.string(),
    includeProfile: z.boolean().default(false),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    profile: z.object({
      avatar: z.string(),
      bio: z.string(),
    }).optional(),
  }),
  outputPath: 'data.user',
  description: 'Fetches user data by ID',
});
```

---

### 8.2 createHandler

Creates a type-safe Effect Handler from a schema.

#### Signature

```typescript
function createHandler<TInput, TOutput>(
  schema: EffectSchema<string, z.ZodType<TInput>, z.ZodType<TOutput>>,
  implementation: HandlerImplementation<TInput, TOutput>
): EffectHandler;

type HandlerImplementation<TInput, TOutput> = (
  input: TInput,
  context: EffectContext
) => Promise<TOutput>;

// Result conforms to Host Contract exactly
type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
) => Promise<Patch[]>;
```

#### Behavior

1. Validates `params` against `inputSchema`
2. Calls `implementation` with typed input and full context
3. Validates output against `outputSchema`
4. Transforms output to `Patch[]` using `outputPath`
5. On error, returns error patches (never throws)

#### Example

```typescript
const fetchUserHandler = createHandler(fetchUserSchema, async (input, context) => {
  // input is typed: { userId: string, includeProfile: boolean }
  // context.snapshot — current snapshot (read-only)
  // context.requirement — { id, type, params }
  
  console.log(`Handling ${context.requirement.type} (${context.requirement.id})`);
  
  const response = await fetch(`/api/users/${input.userId}`);
  const user = await response.json();
  
  // Return value is validated against outputSchema
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: input.includeProfile ? user.profile : undefined,
  };
});

// Register with Host — handler signature matches exactly
const host = createHost({
  effects: {
    'api.user.fetch': fetchUserHandler,
  }
});
```

#### Context Usage Patterns

```typescript
// Pattern 1: Destructure what you need
const handler = createHandler(schema, async (input, { snapshot, requirement }) => {
  // Use snapshot for read-only context
  const currentUser = snapshot.data.currentUser;
  
  // Use requirement for logging/tracing
  console.log(`[${requirement.id}] Fetching for user ${input.userId}`);
  
  return await fetchData(input);
});

// Pattern 2: Full context for advanced use cases
const handler = createHandler(schema, async (input, context) => {
  // Check snapshot state (read-only, no domain logic!)
  const cacheKey = `${context.requirement.type}:${input.id}`;
  
  return await fetchWithCacheKey(input, cacheKey);
});
```

#### Generated Patches

**On success:**
```typescript
[
  { op: 'set', path: 'data.user', value: { id: '...', name: '...', ... } }
]
```

**On validation error:**
```typescript
[
  { op: 'set', path: 'system.lastError', value: { 
    $error: true,
    code: 'VALIDATION_ERROR',
    message: 'Invalid input: userId is required',
    ...
  }}
]
```

**On implementation error:**
```typescript
[
  { op: 'set', path: 'system.lastError', value: {
    $error: true,
    code: 'EFFECT_ERROR',
    message: 'Network request failed',
    ...
  }},
  { op: 'set', path: 'data.user', value: null }
]
```

#### Implementation Requirements

- MUST validate input against schema
- MUST validate output against schema
- MUST catch all errors and return as patches
- MUST NEVER throw
- MUST pass `snapshot` as read-only
- SHOULD include `outputPath` in error patches (set to `null`)

---

### 8.3 Handler Contract Alignment

`createHandler` MUST align with Host Contract §7:

| Host Contract Rule | createHandler Behavior |
|--------------------|------------------------|
| Return `Patch[]` | ✅ Always returns patches |
| Never throw | ✅ Catches all errors, returns error patches |
| No domain logic | ⚠️ Developer responsibility |
| Deterministic per params | ⚠️ Implementation responsibility |

**⚠️ Warning: Domain Logic Prohibition**

Host Contract §7.3 prohibits domain logic in handlers:

```typescript
// ❌ WRONG: Domain logic in handler
const handler = createHandler(schema, async (input, snapshot) => {
  if (input.amount > 1000) {  // Business rule!
    return { requiresApproval: true };
  }
  // ...
});

// ✅ CORRECT: Pure IO, no decisions
const handler = createHandler(schema, async (input, snapshot) => {
  const result = await api.fetchData(input.id);
  return result;  // Return data, let Flow/Computed decide
});
```

---

## 9. Standard Patterns

### 9.1 Resilient API Call

```typescript
import {
  withTimeout,
  withRetry,
  withFallback,
  createHandler,
  defineEffectSchema,
  toPatches,
} from '@manifesto-ai/effect-utils';

const schema = defineEffectSchema({
  type: 'api.data.fetch',
  input: z.object({ id: z.string() }),
  output: z.object({ data: DataSchema, fromCache: z.boolean() }),
  outputPath: 'data.result',
});

const handler = createHandler(schema, async (input) => {
  const resilientFetch = withFallback(
    withRetry(
      withTimeout(
        () => fetch(`/api/data/${input.id}`).then(r => r.json()),
        5000
      ),
      { maxRetries: 2, backoff: 'exponential' }
    ),
    async () => ({ ...await loadFromCache(input.id), fromCache: true })
  );
  
  const data = await resilientFetch();
  return { data, fromCache: data.fromCache ?? false };
});
```

### 9.2 Parallel Aggregation

```typescript
const aggregateSchema = defineEffectSchema({
  type: 'api.tracking.aggregate',
  input: z.object({ customerId: z.string(), timeout: z.number().default(5000) }),
  output: z.object({
    ais: AisSchema.nullable(),
    tos: TosSchema.nullable(),
    weather: WeatherSchema.nullable(),
    errors: z.record(z.string(), ErrorSchema),
  }),
  outputPath: 'tracking.signals',
});

const aggregateHandler = createHandler(aggregateSchema, async (input) => {
  const { customerId, timeout } = input;
  
  const results = await parallel({
    ais: () => withTimeout(() => aisClient.fetch(customerId), timeout)(),
    tos: () => withTimeout(() => tosClient.fetch(customerId), timeout)(),
    weather: () => withTimeout(() => weatherClient.fetch(customerId), timeout)(),
  })();
  
  return {
    ais: results.ais.status === 'fulfilled' ? results.ais.value : null,
    tos: results.tos.status === 'fulfilled' ? results.tos.value : null,
    weather: results.weather.status === 'fulfilled' ? results.weather.value : null,
    errors: Object.fromEntries(
      Object.entries(results)
        .filter(([_, r]) => r.status === 'rejected')
        .map(([k, r]) => [k, { code: 'FETCH_ERROR', message: (r as Rejected).reason.message }])
    ),
  };
});
```

### 9.3 Sequential Pipeline

```typescript
const processSchema = defineEffectSchema({
  type: 'document.process',
  input: z.object({ orderId: z.string() }),
  output: z.object({
    pdf: z.any(),
    ocrText: z.string(),
    extracted: ExtractedFieldsSchema,
  }),
  outputPath: 'documents.processed',
});

const processHandler = createHandler(processSchema, async (input) => {
  const results = await sequential([
    () => fetchPdf(input.orderId),
    () => runOcr(results[0]),      // Note: Can't access like this
    () => extractFields(results[1]),
  ], { stopOnError: true })();
  
  // Better pattern: explicit chaining
  const pdf = await fetchPdf(input.orderId);
  const ocrText = await runOcr(pdf);
  const extracted = await extractFields(ocrText);
  
  return { pdf, ocrText, extracted };
});
```

---

## 10. Error Handling

### 10.1 Error Categories

| Category | Code | When |
|----------|------|------|
| `VALIDATION_ERROR` | Input/output validation fails |
| `TIMEOUT_ERROR` | Operation exceeds timeout |
| `RETRY_EXHAUSTED` | All retry attempts failed |
| `EFFECT_ERROR` | Implementation threw |
| `UNKNOWN_ERROR` | Unexpected error |

### 10.2 Error Value Structure

All errors are converted to this structure:

```typescript
type ErrorValue = {
  readonly $error: true;            // Marker for error values
  readonly code: string;            // Error category
  readonly message: string;         // Human-readable message
  readonly stack?: string;          // Stack trace (dev only)
  readonly timestamp: number;       // When error occurred
  readonly context?: {              // Additional context
    readonly effectType?: string;
    readonly attempt?: number;
    readonly timeout?: number;
  };
};
```

### 10.3 Error Detection

```typescript
// In Flow/Computed (MEL)
computed hasError = isNotNull(data.error)
computed isErrorValue = eq(data.error.$error, true)

// In TypeScript
function isErrorValue(value: unknown): value is ErrorValue {
  return typeof value === 'object' && value !== null && '$error' in value;
}
```

---

## 11. Package Boundary

### 11.1 Dependencies

```json
{
  "dependencies": {
    "zod": "^3.22.0"
  },
  "peerDependencies": {
    "@manifesto-ai/core": "^1.0.0"
  }
}
```

### 11.2 What effect-utils Imports

From `@manifesto-ai/core`:
- `Patch` type
- `Snapshot` type

### 11.3 What effect-utils MUST NOT Import

- `compute()`, `apply()` functions
- Host loop internals
- World Protocol types
- Bridge types
- React/Vue/framework bindings

### 11.4 What effect-utils MUST NOT Do

| Prohibition | Reason |
|-------------|--------|
| Execute effects | That's Host |
| Maintain state across calls | Stateless principle |
| Provide HTTP/DB adapters | Not in scope |
| Handle streams/observables | Ingress concern |
| Implement circuit breaker | Requires state, Host policy |

---

## 12. Compliance

### 12.1 Compliance Requirements

An implementation claiming to be `@manifesto-ai/effect-utils` compliant MUST:

1. Export all public APIs defined in §4
2. Implement all combinators per §6 specifications
3. Implement all transforms per §7 specifications
4. Implement schema/handler factory per §8 specifications
5. Maintain stateless combinators (no cross-call memory)
6. Return `Settled` from `parallel()` (not throw on partial failure)
7. Use Zod for schema validation
8. Produce `Patch[]` from `createHandler` (never throw)

### 12.2 Compliance Verification

Compliance can be verified by:

1. **Type checking**: All exports match declared types
2. **Unit testing**: Each combinator behaves per specification
3. **Integration testing**: `createHandler` produces valid patches
4. **Contract testing**: Handlers work with Host loop

---

## Appendix A: Quick Reference

### A.1 Combinators

```typescript
withTimeout(fn, ms)                    // Time-bound
withRetry(fn, { maxRetries, backoff }) // Retry with backoff
withFallback(fn, fallback)             // Default on error
parallel({ a: fn1, b: fn2 })           // Concurrent, all results
race([fn1, fn2, fn3])                  // Concurrent, first wins
sequential([fn1, fn2, fn3])            // Ordered
```

### A.2 Transforms

```typescript
toPatch(path, value)                   // Single patch
toPatches({ path1: v1, path2: v2 })    // Multiple patches
toErrorPatch(path, error)              // Error patch
toErrorPatches(error, customPath?)     // System + custom error
collectErrors(settled, path)           // Extract rejected
collectFulfilled(settled)              // Extract fulfilled values
```

### A.3 Schema

```typescript
const schema = defineEffectSchema({
  type: 'api.myEffect',
  input: z.object({ ... }),
  output: z.object({ ... }),
  outputPath: 'data.result',
});

const handler = createHandler(schema, async (input, snapshot) => {
  // input is typed
  // return is validated
  return result;
});
```

---

## Appendix B: Migration from Manual Handlers

### Before (manual)

```typescript
const handler: EffectHandler = async (type, params) => {
  try {
    const { userId } = params as { userId: string };
    
    let attempts = 0;
    let lastError: Error;
    
    while (attempts < 3) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`/api/users/${userId}`, {
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        const data = await response.json();
        
        return [{ op: 'set', path: 'data.user', value: data }];
      } catch (e) {
        lastError = e as Error;
        attempts++;
        await new Promise(r => setTimeout(r, 1000 * attempts));
      }
    }
    
    return [{ op: 'set', path: 'system.lastError', value: { 
      code: 'RETRY_EXHAUSTED', 
      message: lastError!.message 
    }}];
  } catch (e) {
    return [{ op: 'set', path: 'system.lastError', value: {
      code: 'UNKNOWN',
      message: (e as Error).message
    }}];
  }
};
```

### After (with effect-utils)

```typescript
const schema = defineEffectSchema({
  type: 'api.user.fetch',
  input: z.object({ userId: z.string() }),
  output: UserSchema,
  outputPath: 'data.user',
});

const handler = createHandler(schema, async (input) => {
  const fetchUser = withRetry(
    withTimeout(
      () => fetch(`/api/users/${input.userId}`).then(r => r.json()),
      5000
    ),
    { maxRetries: 3, backoff: 'linear' }
  );
  
  return await fetchUser();
});
```

---

*End of @manifesto-ai/effect-utils Specification v1.0*
