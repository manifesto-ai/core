# Failure Model: Errors as Values

> **Status:** Stable
> **Last Updated:** 2026-01

---

## The Core Principle

In Manifesto, **errors are values, not exceptions**.

> **Errors are values. They live in Snapshot. They never throw.**

This is not a stylistic choice—it is an architectural requirement that follows from determinism and explainability.

---

## Why Errors as Values?

### The Problem with Exceptions

Traditional exception-based error handling:

```typescript
try {
  await doSomething();
} catch (error) {
  handleError(error);
}
```

**Problems:**
- **Control flow is non-local**: Execution jumps unpredictably
- **Hard to trace**: Exception path is not captured in normal flow
- **Difficult to serialize**: Stack traces and exception state are runtime-specific
- **Cannot be inspected without catching**: Errors are invisible until they explode
- **Breaks determinism**: Same input can produce different control paths based on environment

### The Manifesto Approach

Errors are **values in Snapshot**:

```json
{
  "system": {
    "lastError": {
      "code": "VALIDATION_ERROR",
      "message": "Title cannot be empty",
      "source": { "actionId": "addTodo", "nodePath": "flow.steps[0]" },
      "timestamp": 1704067200000
    }
  }
}
```

**Benefits:**

1. **Traceability**: Errors are in Snapshot, visible at any time
2. **Locality**: Error handling is just reading Snapshot
3. **Serializability**: Errors survive serialization
4. **Explainability**: Trace shows when/where error occurred
5. **Determinism**: Same input → same error → same state

---

## Error Structure

### ErrorValue Specification

```typescript
type ErrorValue = {
  /** Error code (machine-readable) */
  readonly code: string;

  /** Human-readable message */
  readonly message: string;

  /** Where the error occurred */
  readonly source: {
    readonly actionId: string;
    readonly nodePath: string;
  };

  /** When the error occurred (Unix timestamp) */
  readonly timestamp: number;

  /** Additional context (optional) */
  readonly context?: Record<string, unknown>;
};
```

### System State

Errors are stored in the system portion of Snapshot:

```typescript
type SystemState = {
  /** Current status */
  readonly status: 'idle' | 'computing' | 'pending' | 'error';

  /** Last error (null if none) */
  readonly lastError: ErrorValue | null;

  /** Error history */
  readonly errors: readonly ErrorValue[];

  /** Pending requirements waiting for Host */
  readonly pendingRequirements: readonly Requirement[];

  /** Current action being processed (if any) */
  readonly currentAction: string | null;
};
```

**Key fields:**

- **`status`**: Current computation state (includes 'error')
- **`lastError`**: Most recent error (quick access)
- **`errors`**: Full error history (audit trail)

---

## How Errors Work

### Flow-Level Errors

In Flow, errors are declared using the `fail` node:

```json
{
  "kind": "if",
  "cond": {
    "kind": "lte",
    "left": { "kind": "len", "arg": { "kind": "get", "path": "input.title" } },
    "right": { "kind": "lit", "value": 0 }
  },
  "then": {
    "kind": "fail",
    "code": "EMPTY_TITLE",
    "message": { "kind": "lit", "value": "Title cannot be empty" }
  }
}
```

**When Core encounters a `fail` node:**

1. Core creates an ErrorValue
2. Core patches Snapshot:
   - `{ op: 'set', path: 'system.lastError', value: errorValue }`
   - `{ op: 'set', path: 'system.errors', value: [...existing, errorValue] }`
   - `{ op: 'set', path: 'system.status', value: 'error' }`
3. Core terminates computation
4. Core returns with `status: 'error'`

**There is no throw. There is no catch. Just patches.**

### Effect-Level Errors

Effect handlers (implemented by Host) must return errors as patches, not throw:

```typescript
// WRONG: Throwing
async function fetchUserHandler(params) {
  const response = await fetch(`/users/${params.id}`);
  if (!response.ok) throw new Error('Not found');  // DON'T DO THIS
  return { ok: true, patches: [] };
}

// RIGHT: Errors as patches
async function fetchUserHandler(params) {
  try {
    const response = await fetch(`/users/${params.id}`);
    if (!response.ok) {
      return [
        { op: 'set', path: 'user', value: null },
        { op: 'set', path: 'fetchError', value: `HTTP ${response.status}` }
      ];
    }
    const user = await response.json();
    return [
      { op: 'set', path: 'user', value: user },
      { op: 'set', path: 'fetchError', value: null }
    ];
  } catch (e) {
    return [
      { op: 'set', path: 'user', value: null },
      { op: 'set', path: 'fetchError', value: e.message }
    ];
  }
}
```

**Effect handler contract:**

1. Accept `(type: string, params: Record<string, unknown>)`
2. Return `Patch[]` (success case) or `Patch[]` with error info (failure case)
3. **Never throw.** Errors are expressed as Patches.

**Why this matters:**

- Host controls the compute loop and can decide what to do with errors
- Errors are visible in Snapshot (no hidden failure state)
- Next compute cycle can check for errors and react
- Deterministic: Same failure → same patches → same resulting state

---

## Error Handling Patterns

### Pattern 1: Validation Errors

**Check before acting:**

```json
{
  "kind": "seq",
  "steps": [
    {
      "kind": "if",
      "cond": {
        "kind": "not",
        "arg": { "kind": "get", "path": "computed.isValid" }
      },
      "then": {
        "kind": "fail",
        "code": "VALIDATION_ERROR",
        "message": { "kind": "get", "path": "computed.validationMessage" }
      }
    },
    {
      "kind": "patch",
      "op": "set",
      "path": "user",
      "value": { "kind": "get", "path": "input.user" }
    }
  ]
}
```

### Pattern 2: Effect Error Recovery

**Check Snapshot after effect execution:**

```json
{
  "kind": "seq",
  "steps": [
    {
      "kind": "effect",
      "type": "api:syncTodo",
      "params": { "id": { "kind": "get", "path": "input.todoId" } }
    }
  ]
}
```

After Host fulfills the effect and calls `compute()` again, Flow can check for errors:

```json
{
  "kind": "if",
  "cond": { "kind": "get", "path": "syncError" },
  "then": {
    "kind": "seq",
    "steps": [
      {
        "kind": "patch",
        "op": "set",
        "path": "syncStatus",
        "value": { "kind": "lit", "value": "error" }
      },
      {
        "kind": "patch",
        "op": "set",
        "path": "ui.showRetryDialog",
        "value": { "kind": "lit", "value": true }
      }
    ]
  },
  "else": {
    "kind": "patch",
    "op": "set",
    "path": "syncStatus",
    "value": { "kind": "lit", "value": "synced" }
  }
}
```

### Pattern 3: Error Clearing

**Explicitly clear errors when resolved:**

```json
{
  "kind": "seq",
  "steps": [
    {
      "kind": "patch",
      "op": "set",
      "path": "system.lastError",
      "value": { "kind": "lit", "value": null }
    },
    {
      "kind": "patch",
      "op": "set",
      "path": "retryCount",
      "value": {
        "kind": "add",
        "left": { "kind": "get", "path": "retryCount" },
        "right": { "kind": "lit", "value": 1 }
      }
    },
    {
      "kind": "effect",
      "type": "api:retry",
      "params": {}
    }
  ]
}
```

### Pattern 4: Error Reporting to User

**Map errors to UI state:**

```json
{
  "kind": "if",
  "cond": { "kind": "get", "path": "system.lastError" },
  "then": {
    "kind": "patch",
    "op": "set",
    "path": "ui.errorModal",
    "value": {
      "kind": "merge",
      "objects": [
        { "kind": "lit", "value": { "visible": true } },
        {
          "kind": "lit",
          "value": {
            "title": { "kind": "get", "path": "system.lastError.code" },
            "message": { "kind": "get", "path": "system.lastError.message" }
          }
        }
      ]
    }
  }
}
```

---

## Forbidden Patterns

### FORBIDDEN: Throwing in Core

```typescript
// NEVER DO THIS
function evaluateExpr(expr: ExprNode, snapshot: Snapshot): unknown {
  if (expr.kind === 'divide' && expr.right === 0) {
    throw new Error('Division by zero');  // ❌ WRONG
  }
}
```

**Correct approach:**

```typescript
// DO THIS
function evaluateExpr(expr: ExprNode, snapshot: Snapshot): unknown {
  if (expr.kind === 'divide' && expr.right === 0) {
    return null;  // ✅ Errors are values, division by zero returns null
  }
}
```

**Rule:** Core MUST be total (always return a value, never throw).

### FORBIDDEN: Boolean Success Flags

```typescript
// NEVER DO THIS
type EffectResult = {
  success: boolean;
  data?: unknown;
  error?: string;
}
```

**Why forbidden:**

- Forces consumers to check `success` flag
- Ambiguous: What if both `data` and `error` are present?
- Not serializable to Snapshot naturally

**Correct approach:**

```typescript
// DO THIS
type EffectHandler = (
  type: string,
  params: Record<string, unknown>
) => Promise<Patch[]>;

// Handler returns patches directly
return [
  { op: 'set', path: 'result', value: result },
  { op: 'set', path: 'error', value: null }
];
// OR
return [
  { op: 'set', path: 'result', value: null },
  { op: 'set', path: 'error', value: errorMessage }
];
```

### FORBIDDEN: Try/Catch for Business Logic

```typescript
// NEVER DO THIS
try {
  const result = await api.call();
  return { ok: true, patches: [] };
} catch (error) {
  // Handle business error with exception ❌
  if (error.code === 'NOT_FOUND') {
    return { ok: false, error: 'Not found' };
  }
  throw error;  // Re-throw system error
}
```

**Why forbidden:**

- Mixes system errors (actual exceptions) with business errors (expected failures)
- Exception-based control flow is non-local
- Breaks serializability

**Correct approach:**

```typescript
// DO THIS
const response = await api.call();
if (response.status === 404) {
  return [
    { op: 'set', path: 'found', value: false },
    { op: 'set', path: 'notFoundReason', value: 'Resource does not exist' }
  ];
}
if (!response.ok) {
  return [
    { op: 'set', path: 'error', value: `HTTP ${response.status}` }
  ];
}
return [
  { op: 'set', path: 'result', value: await response.json() },
  { op: 'set', path: 'found', value: true }
];
```

### FORBIDDEN: Swallowed Errors

```typescript
// NEVER DO THIS
try {
  await someOperation();
} catch (error) {
  console.log('Error occurred, but continuing...');  // ❌ Silent failure
  return { ok: true, patches: [] };
}
```

**Why forbidden:**

- Hides failures from Snapshot
- Breaks accountability
- Makes debugging impossible

**Correct approach:**

```typescript
// DO THIS
async function handler(type, params, context) {
  try {
    await someOperation();
    return [
      { op: 'set', path: 'operationStatus', value: 'success' }
    ];
  } catch (error) {
    return [
      { op: 'set', path: 'operationStatus', value: 'error' },
      { op: 'set', path: 'errorMessage', value: error.message },
      { op: 'set', path: 'errorTimestamp', value: context.requirement.createdAt }
    ];
  }
}
```

---

## Error Categories

### 1. Validation Errors

**When:** User input fails validation

**Where:** Flow-level (using `fail` node)

**Example:**

```json
{
  "kind": "fail",
  "code": "INVALID_EMAIL",
  "message": { "kind": "lit", "value": "Email format is invalid" }
}
```

**Handling:** Display validation message to user, prevent submission

### 2. Effect Execution Errors

**When:** External operation fails (network, database, etc.)

**Where:** Effect handler (returns error patches)

**Example:**

```typescript
return [
  { op: 'set', path: 'syncStatus', value: 'error' },
  { op: 'set', path: 'errorMessage', value: 'Network timeout' }
];
```

**Handling:** Retry logic, fallback behavior, user notification

### 3. System Errors

**When:** Unexpected runtime failures (out of memory, network unreachable, etc.)

**Where:** Host-level (catch-all)

**Example:**

```typescript
try {
  const context = { now: 0, randomSeed: "seed" };
  const result = await core.compute(schema, snapshot, intent, context);
  // ...
} catch (error) {
  // System error - should be rare
  console.error('System error:', error);
  // Apply error patch to snapshot
  snapshot = core.apply(schema, snapshot, [
    { op: 'set', path: 'system.lastError', value: {
      code: 'SYSTEM_ERROR',
      message: error.message,
      source: { actionId: '', nodePath: '' },
      timestamp: context.now
    }}
  ], context);
}
```

**Handling:** Crash recovery, user notification, retry with exponential backoff

### 4. Schema Validation Errors

**When:** Schema is invalid or malformed

**Where:** Schema validation (at domain setup)

**Example:**

```typescript
const validation = core.validate(schema);
if (!validation.valid) {
  console.error('Schema errors:', validation.errors);
  // Cannot proceed with invalid schema
}
```

**Handling:** Developer error, must fix schema

---

## Error Recovery Strategies

### Strategy 1: Automatic Retry

```typescript
async function processIntentWithRetry(
  core: ManifestoCore,
  schema: DomainSchema,
  snapshot: Snapshot,
  intent: Intent,
  context: HostContext,
  maxRetries = 3
): Promise<Snapshot> {
  let current = snapshot;
  let attempts = 0;

  while (attempts < maxRetries) {
    const result = await processIntent(core, schema, current, intent, context);

    if (result.system.status !== 'error') {
      return result;  // Success
    }

    // Check if error is retryable
    const error = result.system.lastError;
    if (error && isRetryable(error.code)) {
      attempts++;
      await sleep(Math.pow(2, attempts) * 1000);  // Exponential backoff
      current = core.apply(schema, result, [
        { op: 'set', path: 'system.lastError', value: null },
        { op: 'set', path: 'retryAttempt', value: attempts }
      ], context);
    } else {
      return result;  // Non-retryable error
    }
  }

  return current;
}

function isRetryable(code: string): boolean {
  return ['NETWORK_TIMEOUT', 'RATE_LIMIT', 'TEMPORARY_FAILURE'].includes(code);
}
```

### Strategy 2: Graceful Degradation

```typescript
async function fetchWithFallback(params: unknown): Promise<Patch[]> {
  try {
    const result = await api.fetchPrimary(params);
    return [
      { op: 'set', path: 'result', value: result },
      { op: 'set', path: 'source', value: 'primary' }
    ];
  } catch (primaryError) {
    try {
      const result = await api.fetchFallback(params);
      return [
        { op: 'set', path: 'result', value: result },
        { op: 'set', path: 'source', value: 'fallback' },
        { op: 'set', path: 'fallbackReason', value: primaryError.message }
      ];
    } catch (fallbackError) {
      return [
        { op: 'set', path: 'result', value: null },
        { op: 'set', path: 'error', value: 'All sources failed' }
      ];
    }
  }
}
```

### Strategy 3: Error Accumulation

```typescript
// Collect multiple errors without stopping
type BatchResult = {
  succeeded: number;
  failed: number;
  errors: ErrorValue[];
};

async function batchProcess(items: unknown[], context: EffectContext): Promise<Patch[]> {
  const results: BatchResult = {
    succeeded: 0,
    failed: 0,
    errors: []
  };

  for (const item of items) {
    try {
      await processItem(item);
      results.succeeded++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        code: 'ITEM_FAILED',
        message: error.message,
        context: { item },
        source: { actionId: 'batchProcess', nodePath: '' },
        timestamp: context.requirement.createdAt
      });
    }
  }

  return [
    { op: 'set', path: 'batchResult', value: results }
  ];
}
```

---

## Testing Error Scenarios

### Testing Flow Errors

```typescript
test('fails when title is empty', () => {
  const schema = buildSchema();
  const context = { now: 0, randomSeed: "seed" };
  const snapshot = createSnapshot({}, schema.hash, context);
  const intent = {
    type: 'addTodo',
    input: { title: '' },
    intentId: 'i_1'
  };

  const result = await core.compute(schema, snapshot, intent, context);

  expect(result.status).toBe('error');
  expect(result.snapshot.system.lastError).toMatchObject({
    code: 'EMPTY_TITLE'
  });
});
```

### Testing Effect Errors

```typescript
test('handles network failure gracefully', async () => {
  const schema = buildSchema();
  const context = { now: 0, randomSeed: "seed" };
  let snapshot = createSnapshot({}, schema.hash, context);

  // Register failing effect handler
  host.registerEffect('api:fetch', async () => {
    return [
      { op: 'set', path: 'fetchError', value: 'Network timeout' }
    ];
  });

  snapshot = await host.execute(schema, snapshot, {
    type: 'fetchData',
    intentId: 'i_1'
  });

  expect(snapshot.data.fetchError).toBe('Network timeout');
});
```

---

## Common Questions

### Q: Should I use error codes or error types?

**A:** Use **string error codes**. They're serializable, human-readable, and easy to check.

Good codes:
- `VALIDATION_ERROR`
- `NETWORK_TIMEOUT`
- `NOT_FOUND`
- `UNAUTHORIZED`

Avoid:
- Exception classes (not serializable)
- Numeric codes (not self-documenting)
- Generic codes like `ERROR` (too vague)

### Q: How do I get stack traces for debugging?

**A:** Stack traces are environment-specific and break serializability.

Instead:
- Use **trace** from ComputeResult (shows computation path)
- Include **source** in ErrorValue (shows where error occurred)
- Log errors with context at Host level if needed

### Q: What if an effect handler throws unexpectedly?

**A:** Wrap all effect handler calls in try/catch at Host level:

```typescript
async function executeEffect(req: Requirement): Promise<Patch[]> {
  const handler = effectHandlers[req.type];
  if (!handler) {
    return [
      { op: 'set', path: 'system.lastError', value: {
        code: 'UNKNOWN_EFFECT',
        message: `No handler for: ${req.type}`,
        source: { actionId: req.actionId, nodePath: '' },
        timestamp: req.createdAt
      }}
    ];
  }

  try {
    return await handler(req.type, req.params, {
      snapshot,
      requirement: req,
    });
  } catch (error) {
    // Handler threw unexpectedly - convert to error patch
    return [
      { op: 'set', path: 'system.lastError', value: {
        code: 'EFFECT_HANDLER_ERROR',
        message: error.message,
        source: { actionId: req.actionId, nodePath: '' },
        timestamp: req.createdAt,
        context: { effectType: req.type }
      }}
    ];
  }
}
```

### Q: How do I distinguish between business errors and system errors?

**A:** Use error codes consistently:

**Business errors** (expected failures):
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `ALREADY_EXISTS`
- `INSUFFICIENT_PERMISSIONS`

**System errors** (unexpected failures):
- `SYSTEM_ERROR`
- `NETWORK_ERROR`
- `DATABASE_ERROR`
- `UNKNOWN_ERROR`

Business errors should be handled in Flow logic. System errors typically trigger retries or escalation.

---

## Related Documents

- [Specifications](/internals/spec/) — Normative specifications including ErrorValue
- [Design Rationale](/internals/fdr/) — FDRs including errors-as-values rationale
- [Effect Handlers Guide](/guides/effect-handlers) — Effect handler implementation patterns
- [Determinism](./determinism) — How error handling preserves determinism

---

## Summary

**Core principle:** Errors are values, not exceptions.

**Key rules:**

1. Core never throws—errors are recorded in Snapshot
2. Effect handlers return patches, not exceptions
3. Errors are serializable and traceable
4. Error handling is just reading Snapshot state

**What you get:**

- Deterministic error behavior
- Full error traceability
- Serializable error state
- Testable without mocks
- Explicit error handling

**The pattern:**

```typescript
// Core declares error
{ kind: 'fail', code: 'ERROR_CODE', message: '...' }

// Or effect handler returns error
return [
  { op: 'set', path: 'error', value: errorMessage }
];

// Flow checks for error
if (snapshot.data.error) {
  // Handle error
}
```

**Errors are first-class values in the system, not exceptional cases.**

---

*End of Failure Model Documentation*
