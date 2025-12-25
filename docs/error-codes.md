# Error Code Reference

Complete reference of all error codes used in Manifesto.

## Domain Validation Errors

| Code | Severity | Description |
|------|----------|-------------|
| `DOMAIN_ID_REQUIRED` | Error | Domain definition is missing required `id` field |
| `DOMAIN_NAME_REQUIRED` | Error | Domain definition is missing required `name` field |
| `MISSING_DEPENDENCY` | Error | A path depends on another path that doesn't exist |
| `CYCLIC_DEPENDENCY` | Error | Circular dependency detected between paths |
| `INVALID_PRECONDITION_PATH` | Error | Action precondition references undefined path |
| `ACTION_VERB_REQUIRED` | Warning | Action semantic metadata missing verb |

### DOMAIN_ID_REQUIRED

The domain definition must have a unique identifier.

```typescript
// Error
defineDomain({
  name: 'My Domain',  // id is missing
});

// Fixed
defineDomain({
  id: 'my-domain',
  name: 'My Domain',
});
```

### MISSING_DEPENDENCY

A derived or async path references a path that doesn't exist in the domain.

```typescript
// Error: data.unknown doesn't exist
'derived.computed': {
  deps: ['data.unknown'],
  expr: ['get', 'data.unknown'],
}
```

### CYCLIC_DEPENDENCY

Two or more paths depend on each other in a cycle.

```typescript
// Error: A -> B -> A
'derived.a': { deps: ['derived.b'], ... }
'derived.b': { deps: ['derived.a'], ... }
```

---

## Effect Execution Errors

| Code | Severity | Description |
|------|----------|-------------|
| `EFFECT_ERROR` | Error | General effect execution failure |
| `HANDLER_ERROR` | Error | Effect handler method failed |
| `PROPAGATION_ERROR` | Error | DAG propagation encountered errors |

### Effect Error Types

```typescript
type EffectError = {
  _tag: 'EffectError';
  effect: Effect;
  cause: Error;
  context?: EvaluationContext;
  code?: string;
};
```

---

## HTTP/API Errors

| Code | Severity | Description |
|------|----------|-------------|
| `HTTP_CLIENT_ERROR` | Error | HTTP 4xx response received |
| `HTTP_SERVER_ERROR` | Error | HTTP 5xx response received |
| `API_CALL_FAILED` | Error | General API call failure |
| `API_CALL_TIMEOUT` | Error | API request timed out |
| `API_CALL_ABORTED` | Error | API request was aborted |
| `NETWORK_ERROR` | Error | Network connectivity issue |

### HTTP_CLIENT_ERROR (4xx)

Client-side HTTP error (bad request, unauthorized, not found, etc).

```typescript
if (error.code === 'HTTP_CLIENT_ERROR') {
  const httpInfo = error.cause.httpInfo;
  console.log('Status:', httpInfo.status);  // 404, 401, etc.
  console.log('Body:', httpInfo.body);
}
```

### HTTP_SERVER_ERROR (5xx)

Server-side HTTP error (internal error, service unavailable, etc).

```typescript
if (error.code === 'HTTP_SERVER_ERROR') {
  // Retry logic or fallback
}
```

### API_CALL_TIMEOUT

Request exceeded the configured timeout duration.

```typescript
// Configure timeout in effect
apiCall({
  endpoint: '/api/data',
  timeout: 5000,  // 5 seconds
});
```

### NETWORK_ERROR

Network connectivity or CORS issue.

```typescript
if (error.code === 'NETWORK_ERROR') {
  // Check internet connection
  // Or CORS configuration on server
}
```

---

## Compiler Errors

| Code | Severity | Description |
|------|----------|-------------|
| `PARSE_ERROR` | Error | Failed to parse TypeScript/source |
| `DUPLICATE_PATH` | Error | Same path defined multiple times |
| `TYPE_MISMATCH` | Error | Conflicting type definitions |
| `SEMANTIC_CONFLICT` | Error | Conflicting semantic metadata |
| `LINK_ERROR` | Error | Failed to link fragments |
| `VERIFY_ERROR` | Error | Domain verification failed |

### DUPLICATE_PATH

Multiple fragments define the same path.

```typescript
// Fragment 1
{ path: 'data.count', type: 'number' }

// Fragment 2 (conflict!)
{ path: 'data.count', type: 'string' }
```

### TYPE_MISMATCH

Path has conflicting type definitions.

```typescript
// Conflict: number vs string
{ path: 'data.value', type: 'number' }
{ path: 'data.value', type: 'string' }
```

---

## Runtime Errors

| Code | Severity | Description |
|------|----------|-------------|
| `PATH_NOT_FOUND` | Error | Requested path doesn't exist |
| `VALIDATION_ERROR` | Error | Value doesn't match schema |
| `PRECONDITION_FAILED` | Error | Action precondition not met |
| `SET_ERROR` | Error | Failed to set value |

### PATH_NOT_FOUND

Attempting to access a non-existent path.

```typescript
// Error: path doesn't exist
runtime.get('data.nonexistent');
```

### VALIDATION_ERROR

Value doesn't conform to the path's schema.

```typescript
// Schema expects number
'data.count': { schema: z.number() }

// Error: string provided
runtime.set('data.count', 'not a number');
```

### PRECONDITION_FAILED

Action's preconditions are not satisfied.

```typescript
// Action requires isValid to be true
preconditions: [
  { path: 'derived.isValid', expect: 'true' }
]

// Error: isValid is false
runtime.executeAction('submit');
```

---

## Expression Errors

| Code | Severity | Description |
|------|----------|-------------|
| `INVALID_EXPRESSION` | Error | Expression structure is invalid |
| `UNKNOWN_OPERATOR` | Error | Unrecognized operator in expression |
| `TYPE_ERROR` | Error | Operator received wrong argument types |
| `DIVIDE_BY_ZERO` | Error | Division by zero in expression |

### Expression Examples

```typescript
// Invalid: missing operator
[]

// Invalid: unknown operator
['unknown-op', 1, 2]

// Type error: can't add string and number
['+', 'hello', 1]
```

---

## Error Handling Best Practices

### Using Result Type

```typescript
import { isOk, isErr, unwrap, unwrapOr } from '@manifesto-ai/core';

const result = await runtime.executeAction('submit');

if (isOk(result)) {
  console.log('Success:', result.value);
} else {
  console.log('Error:', result.error.code);
}

// Or with defaults
const value = unwrapOr(result, defaultValue);
```

### Error Recovery

```typescript
import { catchEffect } from '@manifesto-ai/core';

// Catch and recover from errors
const effect = catchEffect(
  apiCall({ endpoint: '/api/data' }),
  (error) => setValue('state.error', error.message)
);
```

### Logging Errors

```typescript
import { isErr, unwrapErr } from '@manifesto-ai/core';

if (isErr(result)) {
  const error = unwrapErr(result);
  console.error({
    code: error.code,
    message: error.cause?.message,
    path: error.path,
  });
}
```
