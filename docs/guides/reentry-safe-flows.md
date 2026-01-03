# Re-entry Safe Flows

> **Covers:** Re-entry safety patterns, state guards, common pitfalls
> **Purpose:** Understanding and implementing re-entry safe flows
> **Prerequisites:** Basic understanding of Flows and Effects

---

## The Problem: Unbounded Re-execution

**Critical insight:** Because there's no `resume()` API in Manifesto, the same Flow will be evaluated **multiple times** for a single user action.

This is by design (see FDR-H003: No Pause/Resume), but it creates a challenge: **how do we prevent duplicate effects?**

---

## Timeline: What Actually Happens

### Unsafe Flow (WRONG)

```typescript
// This flow has NO state guards
flow.seq(
  flow.effect('api.init', {}),
  flow.patch(state.initialized).set(expr.lit(true))
)
```

**Timeline of execution:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Compute Cycle 1 (intent submitted)                             │
├─────────────────────────────────────────────────────────────────┤
│ Flow evaluation:                                                │
│   1. flow.effect("api.init", {})  → Requirement declared        │
│   2. flow.patch("initialized", true)  → Skipped (pending)       │
│ Result: status="pending", requirements=[effect:api.init]        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Host executes effect "api.init"                                 │
│ Returns patches: [{ op: "set", path: "initData", ... }]  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Compute Cycle 2 (auto-triggered by Host)                       │
├─────────────────────────────────────────────────────────────────┤
│ Flow evaluation:                                                │
│   1. flow.effect("api.init", {})  → Requirement declared AGAIN! │
│   2. flow.patch("initialized", true)  → Skipped (pending)       │
│ Result: status="pending", requirements=[effect:api.init]        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Host executes effect "api.init" AGAIN                           │
│ (Infinite loop! Effect keeps re-executing)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Happens

1. Flow is **pure computation** — it has no memory of previous executions
2. Each `compute()` call starts from the beginning of the Flow
3. Without a state guard, the effect is **always** declared
4. Host executes effect → triggers re-compute → effect declared again → infinite loop

---

## The Solution: State Guards

### Safe Flow (RIGHT)

```typescript
flow.seq(
  // Guard: only execute if NOT already initialized
  flow.if(
    expr.not(state.initialized),
    flow.seq(
      flow.effect('api.init', {}),
      flow.patch(state.initialized).set(expr.lit(true))
    )
  )
)
```

**Timeline of execution:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Initial State: { initialized: false, initData: null }          │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Compute Cycle 1 (intent submitted)                             │
├─────────────────────────────────────────────────────────────────┤
│ Flow evaluation:                                                │
│   1. if (NOT state.initialized)  → true, enter branch           │
│   2. flow.effect("api.init", {})  → Requirement declared        │
│   3. flow.patch("initialized", true)  → Skipped (pending)       │
│ Result: status="pending", requirements=[effect:api.init]        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Host executes effect "api.init"                                 │
│ Returns patches:                                                │
│   [{ op: "set", path: "initialized", value: true },      │
│    { op: "set", path: "initData", value: {...} }]        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Updated State: { initialized: true, initData: {...} }          │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Compute Cycle 2 (auto-triggered by Host)                       │
├─────────────────────────────────────────────────────────────────┤
│ Flow evaluation:                                                │
│   1. if (NOT state.initialized)  → false, SKIP branch           │
│ Result: status="complete", requirements=[]                      │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                      ✓ Flow completes
                   (Effect runs only once)
```

---

## The Pattern: Feedback Loop

**Every effect MUST be guarded by state that the effect changes.**

```
┌─────────────────────────────────────────────────┐
│  Check state → Effect not run?                  │
│       │              │                           │
│       │ YES          │ NO                        │
│       ▼              ▼                           │
│  Run effect    Skip effect                      │
│       │                                          │
│       ▼                                          │
│  Effect sets state flag                         │
│       │                                          │
│       └──────────────┘                           │
│    Next cycle checks flag → skips               │
└─────────────────────────────────────────────────┘
```

This creates a **feedback loop** that prevents re-execution.

---

## Builder Helpers

The `@manifesto-ai/builder` package provides helpers for common patterns:

### 1. onceNull: Initialize If Null

```typescript
import { onceNull } from "@manifesto-ai/builder";

// Only execute if state.user is null
flow.seq(
  onceNull(state.user, [
    flow.patch(state.loading).set(expr.lit(true)),
    flow.effect('api.fetchUser', { id: expr.input('userId') }),
    // Effect handler will set state.user
    flow.patch(state.loading).set(expr.lit(false))
  ])
)
```

**When to use:**
- Fetching data only if not already loaded
- Initializing state that starts as null/undefined

**How it works:**
```typescript
// onceNull expands to:
flow.if(
  expr.isNull(state.user),
  flow.seq([...steps])
)
```

### 2. guard: Conditional Execution

```typescript
import { guard } from "@manifesto-ai/builder";

// Only execute if condition is true
flow.seq(
  guard(expr.not(state.submitted), [
    flow.patch(state.submitted).set(expr.lit(true)),
    flow.effect('api.submit', { data: state.formData })
  ])
)
```

**When to use:**
- Guarding any operation that shouldn't repeat
- Enforcing preconditions

**How it works:**
```typescript
// guard expands to:
flow.if(condition, flow.seq([...steps]))
```

---

## Common Re-entry Patterns

### Pattern 1: One-Time Initialization

```typescript
// State includes initialized flag
const StateSchema = z.object({
  initialized: z.boolean().default(false),
  userData: z.object({...}).nullable().default(null)
});

// Action with initialization
actions.define({
  init: {
    flow: onceNull(state.userData, [
      flow.effect('api.fetchUserData', {}),
      // Effect handler sets userData
    ])
  }
})
```

### Pattern 2: Submitted/Pending Flag

```typescript
// State includes submission tracking
const StateSchema = z.object({
  formData: z.object({...}),
  submitted: z.boolean().default(false),
  submittedAt: z.number().nullable().default(null)
});

// Action with submission guard
actions.define({
  submit: {
    input: z.object({ timestamp: z.number() }),
    flow: guard(expr.not(state.submitted), [
      flow.patch(state.submitted).set(expr.lit(true)),
      flow.patch(state.submittedAt).set(expr.input('timestamp')),
      flow.effect('api.submit', { data: state.formData })
    ])
  }
})
```

### Pattern 3: Status-Based Guards

```typescript
// State includes explicit status
const StateSchema = z.object({
  status: z.enum(['idle', 'loading', 'loaded', 'error']).default('idle'),
  data: z.any().nullable().default(null)
});

// Action with status guard
actions.define({
  load: {
    flow: flow.seq(
      // Only load if idle or error
      flow.if(
        expr.or(
          expr.eq(state.status, 'idle'),
          expr.eq(state.status, 'error')
        ),
        flow.seq(
          flow.patch(state.status).set(expr.lit('loading')),
          flow.effect('api.load', {}),
          // Effect handler sets status to 'loaded' or 'error'
        )
      )
    )
  }
})
```

### Pattern 4: Timestamp-Based Guards

```typescript
// State includes timestamp
const StateSchema = z.object({
  lastFetchedAt: z.number().nullable().default(null),
  cacheMs: z.number().default(60000) // 1 minute cache
});

// Action with cache check
actions.define({
  fetchWithCache: {
    input: z.object({ now: z.number() }),
    flow: flow.seq(
      // Only fetch if cache expired
      flow.if(
        expr.or(
          expr.isNull(state.lastFetchedAt),
          expr.gt(
            expr.sub(expr.input('now'), state.lastFetchedAt),
            state.cacheMs
          )
        ),
        flow.seq(
          flow.effect('api.fetch', {}),
          flow.patch(state.lastFetchedAt).set(expr.input('now'))
        )
      )
    )
  }
})
```

---

## Anti-Patterns (What NOT to Do)

### Anti-Pattern 1: No Guard

```typescript
// WRONG: No state guard
flow.seq(
  flow.patch(state.count).set(expr.add(state.count, 1)),
  flow.effect('api.submit', {})
)
```

**Problem:** Runs every compute cycle. Count increments forever, API called repeatedly.

**Fix:** Add guard based on state that effect changes.

```typescript
// RIGHT: Guarded by timestamp
flow.onceNull(state.submittedAt, ({ patch, effect }) => {
  patch(state.count).set(expr.add(state.count, 1));
  patch(state.submittedAt).set(expr.input('timestamp'));
  effect('api.submit', {});
})
```

### Anti-Pattern 2: Incrementing Without Guard

```typescript
// WRONG: Unconditional increment
actions.define({
  increment: {
    flow: flow.patch(state.count).set(expr.add(state.count, 1))
  }
})
```

**Problem:** If this action has effects later (or is called as part of a larger flow with effects), the increment will run every compute cycle.

**Fix:** For simple increments with no effects, this is actually safe. But if combined with effects:

```typescript
// If combined with effects, guard it
actions.define({
  incrementAndLog: {
    input: z.object({ requestId: z.string() }),
    flow: guard(
      expr.neq(state.lastRequestId, expr.input('requestId')),
      [
        flow.patch(state.count).set(expr.add(state.count, 1)),
        flow.patch(state.lastRequestId).set(expr.input('requestId')),
        flow.effect('log.increment', { count: state.count })
      ]
    )
  }
})
```

### Anti-Pattern 3: Boolean Toggle Without Guard

```typescript
// WRONG: Toggle without tracking which request
actions.define({
  toggle: {
    flow: flow.patch(state.flag).set(expr.not(state.flag))
  }
})
```

**Problem:** If called multiple times or with effects, the flag oscillates.

**Fix:** Use a target value, not a toggle:

```typescript
// RIGHT: Set to specific value
actions.define({
  setFlag: {
    input: z.object({ value: z.boolean() }),
    flow: flow.patch(state.flag).set(expr.input('value'))
  }
})
```

---

## Effect Handler Responsibilities

Effect handlers also play a role in re-entry safety by **setting the guard state**:

```typescript
// Effect handler MUST set the guard state
host.registerEffect('api.submit', async (type, params, context) => {
  const { requirement } = context;
  try {
    const result = await api.submit(params.data);

    return [
      // Set result
      { op: 'set', path: 'result', value: result },

      // CRITICAL: Set the guard state
      { op: 'set', path: 'submitted', value: true },
      { op: 'set', path: 'submittedAt', value: requirement.createdAt }
    ];
  } catch (error) {
    return [
      { op: 'set', path: 'error', value: error.message },

      // Even on error, mark as attempted
      { op: 'set', path: 'submitted', value: true },
      { op: 'set', path: 'submittedAt', value: requirement.createdAt }
    ];
  }
});
```

**If effect handler forgets to set guard state, infinite loop occurs.**

---

## Testing Re-entry Safety

```typescript
import { describe, it, expect } from "vitest";
import { createCore, createIntent } from "@manifesto-ai/core";
import { createHost } from "@manifesto-ai/host";

describe("Re-entry safety", () => {
  it("effect executes only once per intent", async () => {
    let effectCallCount = 0;

    const host = createHost(MyDomain.schema, {
      snapshot: initialSnapshot,
      context: { now: () => Date.now() },
    });

    host.registerEffect('api.submit', async (_type, _params) => {
      effectCallCount++;
      return [
        { op: 'set', path: 'submitted', value: true }
      ];
    });

    // Dispatch intent
    await host.dispatch(createIntent('submit', {}, 'intent-1'));

    // Effect should have been called exactly once
    expect(effectCallCount).toBe(1);
  });

  it("same intent dispatched twice executes effect once", async () => {
    let effectCallCount = 0;

    const host = createHost(MyDomain.schema, {
      snapshot: initialSnapshot,
      context: { now: () => Date.now() },
    });

    host.registerEffect('api.submit', async (_type, _params) => {
      effectCallCount++;
      return [
        { op: 'set', path: 'submitted', value: true }
      ];
    });

    // Dispatch same intent twice
    const intent = createIntent('submit', {}, 'intent-1');
    await host.dispatch(intent);
    await host.dispatch(intent);

    // Effect should still only have been called once (guarded by submitted flag)
    expect(effectCallCount).toBe(1);
  });
});
```

---

## Checklist: Is My Flow Re-entry Safe?

- [ ] Every effect is guarded by state that the effect changes
- [ ] Guard state is set by the effect handler
- [ ] Guard state is checked before executing the effect
- [ ] No unconditional patches that modify state repeatedly
- [ ] No boolean toggles without request tracking
- [ ] Effect handlers set guard state even on error

---

## Related Concepts

- **Flow** - Declarative computation without memory
- **Effect** - External operation that must be guarded
- **Snapshot** - The only medium of communication
- **Host** - Executes the compute-effect loop

---

## See Also

- [Host FDR](/rationale/host-fdr) - Design rationale including why re-entry happens
- [Effect Handlers Guide](./effect-handlers) - Writing safe effect handlers
- [Getting Started](/guides/getting-started) - Using guard helpers
- [Flow Concept](/core-concepts/flow) - Understanding Flows
