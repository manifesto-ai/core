# Effect

> **Sources:** docs-original/GLOSSARY.md, packages/core/docs/FDR.md, packages/core/docs/SPEC.md
> **Status:** Core Concept

---

## What is Effect?

**Definition:** A declaration of an external operation that Host must execute. Effects are not executed by Core; they are declarations of intent to perform IO.

**Canonical Principle:**

> **Core declares requirements. Host fulfills them. Core never executes IO.**

---

## Effect vs Side Effect

**Traditional "side effect":**
```typescript
// Something that "just happens" during execution
function saveUser(user) {
  database.save(user); // Side effect!
  return user;
}
```

**Manifesto Effect:**
```typescript
// Explicit declaration
{
  kind: "effect",
  type: "database:save",
  params: { table: "users", data: user }
}
// Not executed here! Just declared.
```

---

## Structure

### In FlowSpec

```typescript
type EffectNode = {
  readonly kind: 'effect';
  readonly type: string;                        // Handler identifier
  readonly params: Record<string, ExprNode>;    // Parameters (expressions)
};
```

Example:
```json
{
  "kind": "effect",
  "type": "api:createTodo",
  "params": {
    "title": { "kind": "get", "path": "input.title" },
    "localId": { "kind": "get", "path": "input.localId" }
  }
}
```

### As Requirement

When Core encounters an effect node, it creates a Requirement:

```typescript
type Requirement = {
  readonly id: string;                    // Deterministic ID
  readonly type: string;                  // Effect type
  readonly params: Record<string, unknown>; // Resolved parameters
  readonly actionId: string;              // Which action generated this
  readonly flowPosition: FlowPosition;    // Where in the flow
  readonly createdAt: number;             // When
};
```

---

## How Effects Work

### Step 1: Declaration (Core)

```typescript
// In Flow definition
{
  kind: "seq",
  steps: [
    { kind: "patch", op: "set", path: "loading", value: true },
    {
      kind: "effect",
      type: "api:fetch",
      params: {
        url: { kind: "lit", value: "/api/todos" }
      }
    }
  ]
}
```

### Step 2: Recording (Core)

When Core evaluates the effect node:
1. Evaluates `params` expressions
2. Creates Requirement with resolved params
3. Adds to `snapshot.system.pendingRequirements`
4. **Terminates computation** (returns `status: 'pending'`)

**Critical:** Core does NOT execute the effect. It stops here.

### Step 3: Execution (Host)

Host loop:
```typescript
const context = { now: 0, randomSeed: "seed" };
const result = await core.compute(schema, snapshot, intent, context);

if (result.status === 'pending') {
  // Execute effects
  for (const req of result.requirements) {
    const handler = effectHandlers[req.type];
    const patches = await handler(req.type, req.params, {
      snapshot,
      requirement: req,
    });

    // Apply result patches
    snapshot = core.apply(schema, snapshot, patches, context);
  }

  // Clear requirements
  snapshot = core.apply(schema, snapshot, [
    { op: 'set', path: 'system.pendingRequirements', value: [] }
  ], context);

  // Re-compute
  const nextResult = await core.compute(schema, snapshot, intent, context);
  // Flow continues...
}
```

### Step 4: Continuation (Core, again)

```typescript
// Flow continues from where it left off
{
  kind: "seq",
  steps: [
    { kind: "patch", op: "set", path: "loading", value: true },
    { kind: "effect", type: "api:fetch", params: {...} },
    // ↑ Already executed
    // ↓ Continues here
    { kind: "patch", op: "set", path: "loading", value: false }
  ]
}
```

**How does Flow know to continue?** It checks Snapshot state. If `loading = true` and data is loaded, it knows the effect completed.

---

## Effect Handler Contract

Effect handlers (implemented by Host) MUST:

1. Accept `(type: string, params: Record<string, unknown>, context: EffectContext)`
2. Return `Patch[]` (success case) or `Patch[]` with error info (failure case)
3. **Never throw.** Errors are expressed as Patches.

### Example Handler

```typescript
// Host-side effect handler
type EffectContext = {
  snapshot: Readonly<Snapshot>;
  requirement: Requirement;
};

async function apiCreateTodoHandler(
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
): Promise<Patch[]> {
  const { snapshot } = context;
  try {
    const result = await api.createTodo({
      title: params.title as string,
      localId: params.localId as string
    });

    return [
      {
        op: 'set',
        path: `todos.${params.localId}.serverId`,
        value: result.id
      },
      {
        op: 'set',
        path: `todos.${params.localId}.syncStatus`,
        value: 'synced'
      }
    ];
  } catch (error) {
    return [
      {
        op: 'set',
        path: `todos.${params.localId}.syncStatus`,
        value: 'error'
      },
      {
        op: 'set',
        path: `todos.${params.localId}.errorMessage`,
        value: error.message
      }
    ];
  }
}
```

**Key points:**
- No `throw` - all outcomes are patches
- Success writes result to Snapshot
- Failure writes error info to Snapshot
- Next `compute()` sees the result in Snapshot

---

## Effects Do NOT Return Values

This is critical and often misunderstood.

### Wrong Mental Model

```typescript
// WRONG: Effect "returning" a value
const result = await executeEffect('api:fetch');
if (result.ok) {
  // Use result.data...
}
```

### Correct Mental Model

```typescript
// RIGHT: Effect returns patches
const patches = await executeEffect('api:fetch');
// patches = [
//   { op: 'set', path: 'apiResult', value: {...} }
// ]

const context = { now: 0, randomSeed: "seed" };
snapshot = core.apply(schema, snapshot, patches, context);
// Now snapshot.data.apiResult contains the result

// Next compute() reads from Snapshot
const nextResult = await core.compute(schema, snapshot, intent, context);
// Flow can now check snapshot.data.apiResult
```

---

## Why Effects as Declarations?

From FDR-004:

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| **Direct Execution** | Core executes effects | Breaks purity |
| **Effect Handlers in Core** | Core calls injected handlers | Couples Core to execution |
| **Promise-based** | Effects return Promises | Implies async execution in Core |

### Benefits of Declarations

1. **Purity**: Core remains pure; no IO inside
2. **Testability**: Test Flow without executing real effects
3. **Flexibility**: Host decides how/when/whether to execute
4. **Batching**: Host can batch multiple effects
5. **Retry Logic**: Host can implement retry without Core knowing

---

## Effect Handler Best Practices

### 1. No Domain Logic in Handlers

```typescript
// WRONG: Domain logic in handler
async function handler(type, params, context) {
  if (params.amount > 1000) {  // Business rule!
    return [{ op: 'set', path: 'approval.required', value: true }];
  }
  // ...
}
```

**Why wrong:** Domain logic must be traceable. If it's in the handler, Trace doesn't show it.

```typescript
// RIGHT: Domain logic in Flow
{
  kind: "if",
  cond: { kind: "gt", left: { kind: "get", path: "order.amount" }, right: 1000 },
  then: { kind: "patch", op: "set", path: "approval.required", value: true },
  else: { kind: "effect", type: "payment:process", params: {...} }
}

// Handler just does IO
async function handler(type, params, context) {
  await paymentGateway.charge(params.amount);
  return [{ op: 'set', path: 'payment.status', value: 'completed' }];
}
```

### 2. Always Return Patches for Errors

```typescript
// WRONG
async function handler(type, params, context) {
  const response = await fetch(params.url);
  if (!response.ok) throw new Error('Failed'); // WRONG!
}

// RIGHT
async function handler(type, params, context) {
  try {
    const response = await fetch(params.url);
    if (!response.ok) {
      return [
        { op: 'set', path: 'status', value: 'error' },
        { op: 'set', path: 'errorMessage', value: `HTTP ${response.status}` }
      ];
    }
    // ...
  } catch (error) {
    return [
      { op: 'set', path: 'status', value: 'error' },
      { op: 'set', path: 'errorMessage', value: error.message }
    ];
  }
}
```

### 3. Idempotent When Possible

```typescript
// Good: Idempotent handler
async function createUserHandler(type, params) {
  // Check if user already exists
  const existing = await db.users.findOne({ id: params.id });

  if (existing) {
    // Already exists, just return
    return [
      { op: 'set', path: `users.${params.id}`, value: existing }
    ];
  }

  // Create new
  const user = await db.users.create(params);
  return [
    { op: 'set', path: `users.${params.id}`, value: user }
  ];
}
```

---

## Common Pitfalls

### Pitfall 1: Expecting Effect to Execute in Flow

```typescript
// WRONG expectation
{
  kind: "seq",
  steps: [
    { kind: "effect", type: "api:fetch", params: {} },
    // Expecting result to be available immediately
    { kind: "patch", op: "set", path: "processed",
      value: { kind: "get", path: "api.result" } } // Will be undefined!
  ]
}
```

**Fix:** Flow must be re-entry safe. Check if result exists before using it.

```typescript
// RIGHT
{
  kind: "seq",
  steps: [
    { kind: "effect", type: "api:fetch", params: {} },
    // After Host executes effect and re-computes...
    { kind: "if",
      cond: { kind: "isSet", arg: { kind: "get", path: "api.result" } },
      then: {
        kind: "patch", op: "set", path: "processed",
        value: { kind: "get", path: "api.result" }
      }
    }
  ]
}
```

### Pitfall 2: Not Clearing Requirements

```typescript
// WRONG: Host forgets to clear
const context = { now: 0, randomSeed: "seed" };
const result = await core.compute(schema, snapshot, intent, context);
for (const req of result.requirements) {
  const patches = await executeEffect(req);
  snapshot = core.apply(schema, snapshot, patches, context);
}
// Missing: clear pendingRequirements!
await core.compute(schema, snapshot, intent, context); // Infinite loop!
```

**Fix:** Always clear after execution.

```typescript
// RIGHT
const context = { now: 0, randomSeed: "seed" };
const result = await core.compute(schema, snapshot, intent, context);
for (const req of result.requirements) {
  const patches = await executeEffect(req);
  snapshot = core.apply(schema, snapshot, patches, context);
}
// Clear requirements
snapshot = core.apply(schema, snapshot, [
  { op: 'set', path: 'system.pendingRequirements', value: [] }
], context);
await core.compute(schema, snapshot, intent, context);
```

---

## Related Concepts

- **Requirement** - The pending effect stored in Snapshot
- **Host** - The layer that executes effects
- **Patch** - What effects return
- **Flow** - Where effects are declared

---

## See Also

- [Schema Specification](/specifications/core-spec) - Normative specification including EffectNode
- [Core FDR](/rationale/core-fdr) - Design rationale including Effects as Declarations
- [Effect Handlers Guide](/guides/effect-handlers) - Practical guide
- [Host](./host) - The execution layer
