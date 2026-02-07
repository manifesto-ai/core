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

```mel
action init() {
  // NO GUARD - This is wrong!
  effect api.init({})
  patch initialized = true
}
```

**Timeline of execution:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Compute Cycle 1 (intent submitted)                             │
├─────────────────────────────────────────────────────────────────┤
│ Flow evaluation:                                                │
│   1. effect api.init({})  → Requirement declared                │
│   2. patch initialized = true  → Skipped (pending)              │
│ Result: status="pending", requirements=[effect:api.init]        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Host executes effect "api.init"                                 │
│ Returns patches: [{ op: "set", path: "initData", ... }]         │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Compute Cycle 2 (auto-triggered by Host)                       │
├─────────────────────────────────────────────────────────────────┤
│ Flow evaluation:                                                │
│   1. effect api.init({})  → Requirement declared AGAIN!         │
│   2. patch initialized = true  → Skipped (pending)              │
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

### Safe Flow with `onceIntent` (RECOMMENDED)

The simplest solution is to use `onceIntent`, which automatically guards the block to run only once per intent:

```mel
domain Example {
  state {
    initialized: boolean = false
    initData: object | null = null
  }

  action init() {
    onceIntent {
      effect api.init({})
      patch initialized = true
    }
  }
}
```

**How `onceIntent` works:**
- Compiler generates a unique guard ID based on the action
- Guard state is stored in `$mel.guards.intent`
- Block executes only once per unique intentId

### Safe Flow with Manual Guard (ALTERNATIVE)

For more control, use explicit `when` guards:

```mel
domain Example {
  state {
    initialized: boolean = false
    initData: object | null = null
  }

  action init() {
    when not(initialized) {
      effect api.init({})
      patch initialized = true
    }
  }
}
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
│   1. when not(initialized)  → true, enter branch                │
│   2. effect api.init({})  → Requirement declared                │
│   3. patch initialized = true  → Skipped (pending)              │
│ Result: status="pending", requirements=[effect:api.init]        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Host executes effect "api.init"                                 │
│ Returns patches:                                                │
│   [{ op: "set", path: "initialized", value: true },             │
│    { op: "set", path: "initData", value: {...} }]               │
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
│   1. when not(initialized)  → false, SKIP branch                │
│ Result: status="complete", requirements=[]                      │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                      ✓ Flow completes
                   (Effect runs only once)
```

---

## Guard Patterns in MEL

### Pattern 1: `onceIntent` (Simplest)

Use when you want the action body to run exactly once per intent:

```mel
action submit() {
  onceIntent {
    patch submitted = true
    effect api.submit({ data: formData })
  }
}
```

### Pattern 2: `when` with Null Check

Use when the action should run only if data hasn't been loaded:

```mel
action loadUser(userId: string) {
  when isNull(user) {
    patch loading = true
    effect api.fetchUser({ id: userId })
  }
}
```

### Pattern 3: `when` with Boolean Flag

Use when you need explicit control over when action runs:

```mel
action submit() {
  when not(submitted) {
    patch submitted = true
    effect api.submit({ data: formData })
  }
}
```

### Pattern 4: `onceIntent when` (Conditional + Once)

Use when you need both automatic deduplication AND a condition:

```mel
action submit() {
  onceIntent when not(alreadySubmitted) {
    patch submitted = true
    effect api.submit({ data: formData })
  }
}
```

### Pattern 5: Status-Based Guards

Use when you have multiple states to track:

```mel
domain Example {
  state {
    status: "idle" | "loading" | "loaded" | "error" = "idle"
    data: object | null = null
  }

  action load() {
    when or(eq(status, "idle"), eq(status, "error")) {
      patch status = "loading"
      effect api.load({})
    }
  }
}
```

### Pattern 6: Timestamp-Based Guards

Use for cache invalidation:

```mel
domain Example {
  state {
    lastFetchedAt: number | null = null
    cacheMs: number = 60000
  }

  action fetchWithCache(now: number) {
    when or(
      isNull(lastFetchedAt),
      gt(sub(now, lastFetchedAt), cacheMs)
    ) {
      effect api.fetch({})
      patch lastFetchedAt = now
    }
  }
}
```

---

## The Pattern: Feedback Loop

**Every effect MUST be guarded by state that the effect changes.**

```
┌─────────────────────────────────────────────────┐
│  Check state → Effect not run?                  │
│       │              │                          │
│       │ YES          │ NO                       │
│       ▼              ▼                          │
│  Run effect    Skip effect                      │
│       │                                         │
│       ▼                                         │
│  Effect sets state flag                         │
│       │                                         │
│       └──────────────┘                          │
│    Next cycle checks flag → skips               │
└─────────────────────────────────────────────────┘
```

This creates a **feedback loop** that prevents re-execution.

---

## Anti-Patterns (What NOT to Do)

### Anti-Pattern 1: No Guard

```mel
// WRONG: No state guard
action submit() {
  patch count = add(count, 1)
  effect api.submit({})
}
```

**Problem:** Runs every compute cycle. Count increments forever, API called repeatedly.

**Fix:** Add `onceIntent` or explicit guard:

```mel
// RIGHT: Guarded
action submit(timestamp: number) {
  onceIntent {
    patch count = add(count, 1)
    patch submittedAt = timestamp
    effect api.submit({})
  }
}
```

### Anti-Pattern 2: Boolean Toggle Without Guard

```mel
// WRONG: Toggle without tracking which request
action toggle() {
  patch flag = not(flag)
}
```

**Problem:** If called multiple times or with effects, the flag oscillates.

**Fix:** Use a target value, not a toggle:

```mel
// RIGHT: Set to specific value
action setFlag(value: boolean) {
  onceIntent {
    patch flag = value
  }
}
```

### Anti-Pattern 3: Increment Without Guard (with Effects)

```mel
// WRONG when combined with effects
action incrementAndLog() {
  patch count = add(count, 1)
  effect log.increment({ count: count })
}
```

**Problem:** Both patch and effect run every cycle.

**Fix:** Guard with request ID:

```mel
action incrementAndLog(requestId: string) {
  when neq(lastRequestId, requestId) {
    patch count = add(count, 1)
    patch lastRequestId = requestId
    effect log.increment({ count: count })
  }
}
```

---

## Effect Handler Responsibilities

Effect handlers also play a role in re-entry safety by **setting the guard state**:

```typescript
// Effect handler MUST set the guard state
// Registered via createApp({ effects: { ... } })
async function apiSubmitHandler(params, ctx) {
  try {
    const result = await api.submit(params.data);

    return [
      // Set result
      { op: 'set', path: 'data.result', value: result },

      // CRITICAL: Set the guard state
      { op: 'set', path: 'data.submitted', value: true },
      { op: 'set', path: 'data.submittedAt', value: Date.now() }
    ];
  } catch (error) {
    return [
      { op: 'set', path: 'data.error', value: error.message },

      // Even on error, mark as attempted
      { op: 'set', path: 'data.submitted', value: true },
      { op: 'set', path: 'data.submittedAt', value: Date.now() }
    ];
  }
}
```

**If effect handler forgets to set guard state, infinite loop occurs.**

---

## Testing Re-entry Safety

```typescript
import { describe, it, expect } from "vitest";
import { createApp } from "@manifesto-ai/app";
import MyDomainMel from "./my-domain.mel";

describe("Re-entry safety", () => {
  it("effect executes only once per intent", async () => {
    let effectCallCount = 0;

    const app = createApp({
      schema: MyDomainMel,
      effects: {
        'api.submit': async (params, ctx) => {
          effectCallCount++;
          return [
            { op: 'set', path: 'data.submitted', value: true }
          ];
        },
      },
    });

    await app.ready();

    // Dispatch intent
    await app.act('submit').done();

    // Effect should have been called exactly once
    expect(effectCallCount).toBe(1);
  });

  it("second dispatch doesn't re-execute guarded effect", async () => {
    let effectCallCount = 0;

    const app = createApp({
      schema: MyDomainMel,
      effects: {
        'api.submit': async (params, ctx) => {
          effectCallCount++;
          return [
            { op: 'set', path: 'data.submitted', value: true }
          ];
        },
      },
    });

    await app.ready();

    // Dispatch twice
    await app.act('submit').done();
    await app.act('submit').done();

    // Effect should still only have been called once (guarded)
    expect(effectCallCount).toBe(1);
  });
});
```

---

## Checklist: Is My Flow Re-entry Safe?

- [ ] Every action body is wrapped in `onceIntent` OR has explicit `when` guard
- [ ] Guard state is set by the effect handler
- [ ] Guard state is checked before executing the effect
- [ ] No unconditional patches that modify state repeatedly
- [ ] No boolean toggles without request tracking
- [ ] Effect handlers set guard state even on error

---

## Quick Reference: Choosing the Right Guard

| Scenario | Pattern |
|----------|---------|
| Simple one-time action | `onceIntent { ... }` |
| Load data if not present | `when isNull(data) { ... }` |
| Submit if not submitted | `when not(submitted) { ... }` |
| Status machine | `when eq(status, "idle") { ... }` |
| Cache with TTL | `when gt(sub(now, lastFetched), ttl) { ... }` |
| Conditional one-time | `onceIntent when condition { ... }` |

---

## Related Concepts

- **Flow** - Declarative computation without memory
- **Effect** - External operation that must be guarded
- **Snapshot** - The only medium of communication
- **Host** - Executes the compute-effect loop

---

## See Also

- [Design Rationale](/internals/fdr/) - FDRs including Host design rationale
- [Effect Handlers Guide](./effect-handlers) - Writing safe effect handlers
- [Getting Started](/guides/getting-started) - Using guard helpers
- [Flow Concept](/concepts/flow) - Understanding Flows
- [MEL Syntax](/mel/SYNTAX) - Complete MEL reference
