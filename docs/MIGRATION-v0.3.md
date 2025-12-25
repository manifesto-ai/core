# Migration Guide: v0.3.x

This guide covers the breaking changes and migration steps for v0.3.x releases.

## Breaking Changes

### 1. EffectHandler.apiCall Return Type (P0-1)

**Before (v0.2.x):**
```typescript
type EffectHandler = {
  apiCall: (request: ApiRequest) => Promise<unknown>;
};
```

**After (v0.3.x):**
```typescript
type EffectHandler = {
  apiCall: (request: ApiRequest) => Promise<Result<unknown, HandlerError>>;
};
```

**Migration:**

Use the provided `resultFrom` or `resultFromFetch` helpers:

```typescript
// Option 1: resultFrom - for wrapping throw-based code
import { resultFrom } from '@manifesto-ai/core';

const handler: EffectHandler = {
  apiCall: (req) => resultFrom(async () => {
    const response = await fetch(req.endpoint);
    if (!response.ok) throw new Error(response.statusText);
    return response.json();
  }),
};

// Option 2: resultFromFetch - recommended for HTTP requests
import { resultFromFetch } from '@manifesto-ai/core';

const handler: EffectHandler = {
  apiCall: async (req) => {
    return resultFromFetch(
      fetch(req.endpoint, {
        method: req.method,
        body: req.body ? JSON.stringify(req.body) : undefined,
        headers: { 'Content-Type': 'application/json', ...req.headers },
        signal: req.timeout ? AbortSignal.timeout(req.timeout) : undefined,
      })
    );
  },
};
```

**Benefits of `resultFromFetch`:**
- Automatically handles HTTP 4xx/5xx as errors
- Proper error codes: `HTTP_CLIENT_ERROR`, `HTTP_SERVER_ERROR`, `NETWORK_ERROR`, `API_CALL_TIMEOUT`, `API_CALL_ABORTED`
- Includes HTTP status and response body in error info

---

### 2. RuntimeProvider domain Prop (P0-2)

**Before (v0.2.x):**
```tsx
<RuntimeProvider runtime={runtime}>
  <App />
</RuntimeProvider>
```

**After (v0.3.x):**
```tsx
<RuntimeProvider runtime={runtime} domain={domain}>
  <App />
</RuntimeProvider>
```

**Why:** This change enables optimized hooks that only subscribe to relevant dependencies, preventing unnecessary re-renders.

**Dev Mode Validation:** In development, a warning will be shown if `runtime.getDomainId()` doesn't match `domain.id`:

```
[manifesto] RuntimeProvider domain/runtime mismatch detected!
  - runtime.getDomainId(): "order-domain"
  - domain.id: "cart-domain"
This may cause unexpected behavior.
```

---

### 3. DomainRuntime.getDomainId() (P0-2)

A new method `getDomainId(): string` has been added to `DomainRuntime` interface.

**Impact:** If you have custom runtime implementations, add this method:

```typescript
getDomainId(): string {
  return this.domain.id;
}
```

---

## Deprecations (Warnings Only)

### 1. Async Base Path Access (P1-1)

**Deprecated:**
```typescript
runtime.get('async.userData');  // Warning + fallback to .result
```

**Use Instead:**
```typescript
runtime.get('async.userData.result');   // The resolved data
runtime.get('async.userData.loading');  // Boolean loading state
runtime.get('async.userData.error');    // Error object if failed
```

**Note:** In v0.3.x, accessing the base path will emit a warning (once per path) and fall back to the `.result` path. In v0.4.0+, this will throw an error.

---

## New Features

### 1. resultFromFetch Helper

A high-level helper for HTTP requests that automatically handles:
- HTTP status code errors (4xx/5xx → `HandlerError`)
- Network errors
- Timeout/abort signals
- Response body parsing (json, text, blob, arrayBuffer)

```typescript
import { resultFromFetch } from '@manifesto-ai/core';

const result = await resultFromFetch<User>(
  fetch('/api/users/123'),
  { parseAs: 'json' }  // default
);

if (result.ok) {
  console.log(result.value);  // User
} else {
  console.error(result.error.code);  // 'HTTP_CLIENT_ERROR' | 'HTTP_SERVER_ERROR' | ...
  console.error(result.error.cause.message);  // 'HTTP 404: Not Found'
}
```

### 2. HttpErrorInfo Type

When using `resultFromFetch`, HTTP error information is attached to the error object:

```typescript
if (!result.ok && result.error.cause instanceof Error) {
  const httpInfo = (result.error.cause as any).httpInfo as HttpErrorInfo;
  if (httpInfo) {
    console.log(httpInfo.status);      // 404
    console.log(httpInfo.statusText);  // 'Not Found'
    console.log(httpInfo.url);         // '/api/users/123'
    console.log(httpInfo.body);        // Error response body
  }
}
```

### 3. Subpath Exports

Tree-shaking friendly imports are now available:

```typescript
// Main exports (unchanged)
import { createRuntime, defineDomain } from '@manifesto-ai/core';

// Projection-only import (smaller bundle)
import { projectAgentContext } from '@manifesto-ai/core/projection';

// Agent types only
import type { AgentDecision } from '@manifesto-ai/core/agent';
```

---

## Behavioral Changes

### Subscription Notify Policy (P1-2)

**Policy Clarification:** `changedPaths` in subscription callbacks represents "set attempt/propagation events", not "value changes".

```typescript
runtime.set('data.count', 10);  // → notify with ['data.count']
runtime.set('data.count', 10);  // → notify with ['data.count'] (same value, still notifies)
```

**Design Intent:**
1. Deterministic behavior: Same set call always produces same notification
2. Debugging: All set attempts are trackable
3. Consistency: Matches DAG propagation semantics

**Performance:** If this causes performance issues, use React's memo or ensure your `useSyncExternalStore` getSnapshot returns stable references.

---

## Async Path Convention (P1-1)

Async paths follow a strict naming convention:

| Path | Type | Description |
|------|------|-------------|
| `async.{name}` | Process identifier | NOT a value path |
| `async.{name}.result` | Value path | The resolved data |
| `async.{name}.loading` | Value path | Boolean loading state |
| `async.{name}.error` | Value path | Error object if failed |

**Important:** Always use the specific subpaths (`.result`, `.loading`, `.error`) when reading values.

---

## Checklist

- [ ] Update `EffectHandler.apiCall` to return `Promise<Result<unknown, HandlerError>>`
- [ ] Use `resultFrom()` or `resultFromFetch()` for migration
- [ ] Add `domain` prop to `RuntimeProvider`
- [ ] Update any custom `DomainRuntime` implementations with `getDomainId()`
- [ ] Replace `runtime.get('async.xyz')` with `runtime.get('async.xyz.result')`
- [ ] Run tests to verify all changes work correctly
