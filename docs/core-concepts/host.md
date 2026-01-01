# Host

> **Sources:** packages/host/README.md, packages/host/docs/FDR.md, packages/host/docs/SPEC.md
> **Status:** Core Concept

---

## What is Host?

**Definition:** The execution layer of Manifesto. Host is responsible for running the compute-effect loop, applying patches, executing effects, and managing snapshot persistence.

**Canonical Principle:**

> **Core computes. Host executes. These concerns never mix.**

---

## Responsibilities

| Host DOES | Host DOES NOT |
|-----------|----------------|
| Execute effects | Define business logic |
| Apply patches to Snapshot | Make policy decisions |
| Run the compute loop | Interpret domain semantics |
| Manage effect handlers | Know about World governance |
| Persist snapshots | Compute state transitions |

---

## Architecture Position

```
┌─────────────────────────────────────────┐
│                 World                    │
│  (Governance & Authority)                │
└────────────────┬────────────────────────┘
                 │ Submits approved intents
                 ▼
┌─────────────────────────────────────────┐
│                 HOST                     │
│  • Run compute loop                      │
│  • Execute effects                       │
│  • Apply patches                         │
│  • Report results                        │
└────────────────┬────────────────────────┘
                 │ Calls compute/apply
                 ▼
┌─────────────────────────────────────────┐
│                 Core                     │
│  (Pure Computation)                      │
└─────────────────────────────────────────┘
```

---

## The Compute Loop

The heart of Host is the compute-effect loop:

```typescript
async function runHostLoop(
  schema: DomainSchema,
  snapshot: Snapshot,
  intent: IntentInstance,
  effectHandlers: EffectRegistry
): Promise<ComputeResult> {
  let currentSnapshot = snapshot;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    // Step 1: Compute
    const result = core.compute(schema, currentSnapshot, intent);

    // Step 2: Check status
    if (result.status === 'completed' || result.status === 'failed') {
      return result; // Done
    }

    if (result.status === 'pending') {
      // Step 3: Execute effects
      for (const req of result.snapshot.system.pendingRequirements) {
        const handler = effectHandlers.get(req.type);
        const patches = await handler(req.type, req.params, currentSnapshot);

        // Step 4: Apply effect result patches
        currentSnapshot = core.apply(schema, currentSnapshot, patches);
      }

      // Step 5: Clear requirements
      currentSnapshot = core.apply(schema, currentSnapshot, [
        { op: 'set', path: 'system.pendingRequirements', value: [] }
      ]);

      // Step 6: Loop (re-compute with new snapshot)
      iterations++;
      continue;
    }
  }

  throw new Error('Max iterations exceeded');
}
```

### Why This Loop?

From FDR-H003:

**There is no pause/resume in Core.** Every `compute()` call is complete and independent.

So how does execution continue after an effect?

1. **Core declares effect** → returns `pending`
2. **Host executes effect** → gets patches
3. **Host applies patches** → updates Snapshot
4. **Host calls compute() again** → Flow continues

**All continuity is expressed exclusively through Snapshot.**

---

## Effect Execution

### Effect Registry

Host maintains a registry of effect handlers:

```typescript
type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  snapshot: Snapshot
) => Promise<Patch[]>;

const registry = new Map<string, EffectHandler>();

registry.set('api:fetch', async (type, params, snapshot) => {
  const response = await fetch(params.url);
  const data = await response.json();

  return [
    { op: 'set', path: params.target, value: data }
  ];
});
```

### Handler Contract

Effect handlers MUST:

1. **Accept** `(type, params, snapshot)`
2. **Return** `Patch[]` (never throw)
3. **Express errors as patches**, not exceptions

```typescript
// WRONG: Throwing
async function handler(type, params, snapshot) {
  const result = await api.call(params);
  if (!result.ok) throw new Error('Failed'); // WRONG!
  return [{ op: 'set', path: 'result', value: result }];
}

// RIGHT: Error as patch
async function handler(type, params, snapshot) {
  try {
    const result = await api.call(params);
    if (!result.ok) {
      return [
        { op: 'set', path: 'error', value: `API error: ${result.status}` }
      ];
    }
    return [{ op: 'set', path: 'result', value: result }];
  } catch (error) {
    return [
      { op: 'set', path: 'error', value: error.message }
    ];
  }
}
```

---

## Patch Application

Host delegates patch application to Core via `apply()`:

```typescript
const newSnapshot = core.apply(schema, snapshot, patches);
```

**Host does NOT modify snapshots directly.** All mutation goes through Core's `apply()`.

From FDR-H004:

> Host MUST NOT implement its own patch application logic. Core owns the semantics of `set`, `unset`, and `merge`.

---

## Snapshot Persistence

Host is responsible for persisting snapshots:

```typescript
interface SnapshotStore {
  get(key: string): Snapshot | undefined;
  set(key: string, snapshot: Snapshot): void;
}

const host = createHost({
  schema,
  snapshot: initialSnapshot,
  store: {
    get: (key) => JSON.parse(localStorage.getItem(key) || 'null'),
    set: (key, snapshot) => localStorage.setItem(key, JSON.stringify(snapshot))
  }
});
```

**Core does NOT persist.** It's pure computation.

---

## What Host Does NOT Do

### 1. Does NOT Make Decisions

```typescript
// WRONG: Host deciding
async function executeEffect(req: Requirement) {
  if (shouldSkipEffect(req)) { // Host deciding!
    return [];
  }
  // ...
}
```

**Host executes or reports failure. It does NOT decide whether to execute.**

### 2. Does NOT Suppress Effects

```typescript
// WRONG: Host filtering
async function runHostLoop(...) {
  const result = core.compute(schema, snapshot, intent);

  const safeRequirements = result.snapshot.system.pendingRequirements
    .filter(req => req.type !== 'dangerous'); // WRONG!

  for (const req of safeRequirements) {
    // ...
  }
}
```

**Host MUST execute all requirements faithfully.**

### 3. Does NOT Define Domain Logic

```typescript
// WRONG: Business logic in effect handler
async function createTodoHandler(type, params, snapshot) {
  // Business rule in handler!
  if (snapshot.data.todos.length >= 100) {
    return [{ op: 'set', path: 'error', value: 'Too many todos' }];
  }
  // ...
}
```

**Domain logic belongs in Flow, not handlers.**

```typescript
// RIGHT: Business logic in Flow
{
  kind: 'if',
  cond: { kind: 'gte', left: { kind: 'len', arg: { kind: 'get', path: 'todos' } }, right: 100 },
  then: { kind: 'fail', code: 'TOO_MANY_TODOS' },
  else: { kind: 'effect', type: 'api:createTodo', params: {...} }
}
```

---

## Host API

### createHost

```typescript
function createHost(config: HostConfig): Host;

type HostConfig = {
  schema: DomainSchema;
  snapshot: Snapshot;
  store?: SnapshotStore;
  maxIterations?: number;
  timeout?: number;
};
```

### Host Interface

```typescript
interface Host {
  /** Execute an intent */
  dispatch(intent: IntentBody): Promise<ComputeResult>;

  /** Register an effect handler */
  registerEffect(type: string, handler: EffectHandler): void;

  /** Get current snapshot */
  getSnapshot(): Snapshot;

  /** Subscribe to snapshot changes */
  subscribe(listener: (snapshot: Snapshot) => void): () => void;
}
```

---

## Complete Example

```typescript
import { createHost } from "@manifesto-ai/host";
import { createCore } from "@manifesto-ai/core";

// 1. Create host
const host = createHost({
  schema: TodoSchema,
  snapshot: initialSnapshot,
  maxIterations: 10,
  timeout: 30000
});

// 2. Register effect handlers
host.registerEffect('api:createTodo', async (type, params, snapshot) => {
  const response = await fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify({
      title: params.title,
      localId: params.localId
    })
  });

  const todo = await response.json();

  return [
    { op: 'set', path: `data.todos.${params.localId}.serverId`, value: todo.id },
    { op: 'set', path: `data.todos.${params.localId}.syncStatus`, value: 'synced' }
  ];
});

// 3. Dispatch intent
const result = await host.dispatch({
  type: 'addTodo',
  input: {
    title: 'Buy milk',
    localId: 'local-123'
  }
});

console.log(result.status); // 'completed'
console.log(host.getSnapshot().data.todos);
```

---

## Common Pitfalls

### Pitfall 1: Forgetting to Register Handlers

```typescript
// WRONG: No handler registered
const host = createHost({ schema, snapshot });
await host.dispatch({ type: 'fetchUser', input: { id: '123' } });
// Error: No handler for effect type "api:fetchUser"
```

**Fix:** Register handler before dispatch.

### Pitfall 2: Throwing in Handlers

```typescript
// WRONG: Throwing
host.registerEffect('api:fetch', async (type, params) => {
  const response = await fetch(params.url);
  if (!response.ok) throw new Error('Failed'); // WRONG!
});
```

**Fix:** Return error patches.

### Pitfall 3: Mutating Snapshot

```typescript
// WRONG: Direct mutation
host.registerEffect('increment', async (type, params, snapshot) => {
  snapshot.data.count++; // WRONG!
  return [];
});
```

**Fix:** Return patches.

---

## Design Rationale

From Host FDR:

### FDR-H001: Core-Host Boundary

**Decision:** Core is pure; Host executes effects.

**Rationale:** Separation enables testing, determinism, and replay.

### FDR-H003: No Pause/Resume

**Decision:** There is no suspended execution context.

**Rationale:** Simplicity, serialization, no hidden state.

### FDR-H006: Intent Identity

**Decision:** intentId must be stable across re-invocations.

**Rationale:** Idempotency, deduplication, audit trail.

---

## Related Concepts

- **Core** - Pure computation engine used by Host
- **Effect** - External operation executed by Host
- **World** - Governance layer above Host
- **Requirement** - Effect declaration that Host executes

---

## See Also

- [Host Contract](/specifications/host-contract) - Normative specification
- [Host FDR](/rationale/host-fdr) - Why decisions were made
- [Getting Started Guide](/guides/getting-started) - Practical guide
- [Effect Handlers Guide](/guides/effect-handlers) - Writing effect handlers
