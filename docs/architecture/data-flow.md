# Data Flow

> **Extracted from:** docs-original/ARCHITECTURE.md
> **Purpose:** Understanding how data moves through Manifesto's layers

---

## Overview

Manifesto enforces a strict unidirectional data flow through its layers. Understanding this flow is critical to avoiding category errors where developers expect bidirectional communication or hidden state channels.

---

## Primary Flow: Intent Execution

```
User ─────────┐
              │ 1. Click button
              ▼
         ┌─────────┐
         │ React   │ 2. Dispatch action
         └────┬────┘
              │
              ▼
         ┌─────────┐
         │ Bridge  │ 3. Route through projection
         └────┬────┘
              │
              ▼
         ┌─────────┐
         │ World   │ 4. Evaluate authority
         └────┬────┘
              │
              ▼
         ┌─────────┐
         │  Host   │ 5. Run compute loop
         └────┬────┘
              │
              ▼
         ┌─────────┐
         │  Core   │ 6. Compute patches/effects
         └────┬────┘
              │
         New Snapshot
```

### Step-by-step Explanation

1. **User Action**: User clicks a button in the UI
2. **React Dispatch**: Component calls `action({ input })` from useActions()
3. **Bridge Routing**: Bridge wraps as IntentBody and submits to World
4. **Authority Evaluation**: World checks if actor is authorized
5. **Host Execution**: Host runs compute-effect loop until completion
6. **Core Computation**: Core produces patches and effect declarations
7. **Snapshot Update**: New snapshot propagates back to Bridge subscribers

---

## Secondary Flow: Effect Handling

```
Core declares effect
        │
        ▼
┌───────────────┐
│  Requirement  │ (stored in snapshot.system.pendingRequirements)
└───────┬───────┘
        │
        ▼
┌───────────────┐
│    Host       │ Reads requirement, calls handler
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Effect Handler│ Executes IO (API call, etc.)
└───────┬───────┘
        │
        ▼
   EffectResult
  (patches to apply)
        │
        ▼
┌───────────────┐
│    Core       │ Apply patches, recompute
└───────────────┘
```

### Critical Principle

**Effects do NOT return values to Flows.** They return patches that modify Snapshot. The next compute() reads the result from Snapshot.

```typescript
const context = { now: 0, randomSeed: "seed" };

// WRONG: Effect returning value
const result = await executeEffect();
await core.compute(schema, snapshot, { ...intent, result }, context); // Hidden channel!

// RIGHT: Effect returns patches
const patches = await executeEffect(); // [{ op: "set", path: "result", value: ... }]
snapshot = core.apply(schema, snapshot, patches, context);
await core.compute(schema, snapshot, intent, context); // Reads result from Snapshot
```

---

## Component Interactions

```
┌──────────┐     knows     ┌──────────┐
│  Bridge  │──────────────▶│  World   │
└──────────┘               └──────────┘
     │                          │
     │ subscribes               │ uses
     ▼                          ▼
┌──────────┐               ┌──────────┐
│   React  │               │   Host   │
└──────────┘               └──────────┘
                                │
                                │ calls
                                ▼
                           ┌──────────┐
                           │   Core   │
                           └──────────┘
                                ▲
                                │ produces
                           ┌──────────┐
                           │ Builder  │
                           └──────────┘
```

| Component | Knows About | Created By | Consumed By |
|-----------|-------------|------------|-------------|
| DomainSchema | Core types | Builder | Core, Host |
| Snapshot | - | Core | Everyone |
| World | Proposal, Decision | World | Bridge |
| Bridge | SnapshotView | Application | React |
| Requirement | Effect params | Core | Host |

---

## The Snapshot Principle

> **All communication happens through Snapshot. There is no other channel.**

- Effects do NOT "return" values to Flows
- Effects produce Patches that modify Snapshot
- The next computation reads from the modified Snapshot
- **There is no suspended execution context**
- **All continuity is expressed exclusively through Snapshot**

### Example: Correct Pattern

```
WRONG:  result ← effect('api:call')    // Implies value passing
        if result.ok then ...

RIGHT:  effect('api:call')             // Declares requirement
        // Host fulfills requirement by patching snapshot
        // Next compute() reads snapshot.api.result
        if snapshot.api.result.ok then ...
```

---

## Computation Cycle

Each `compute()` call is **complete and independent**:

```
compute(snapshot₀, intent, context) → (snapshot₁, requirements[], trace)
```

- If `requirements` is empty: computation is **complete**
- If `requirements` is non-empty: Host MUST fulfill them, then call `compute()` **again**
- There is no "resume". Each `compute()` is a fresh calculation

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPUTATION CYCLE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Host calls: compute(snapshot, intent, context)                 │
│                     │                                            │
│                     ▼                                            │
│  ┌─────────────────────────────────────┐                        │
│  │ Core evaluates Flow until:          │                        │
│  │   - Flow completes (requirements=[])│                        │
│  │   - Effect encountered (req=[...])  │                        │
│  │   - Error occurs                    │                        │
│  └─────────────────────────────────────┘                        │
│                     │                                            │
│                     ▼                                            │
│  Returns: (snapshot', requirements, trace)                      │
│                     │                                            │
│         ┌──────────┴──────────┐                                 │
│         ▼                     ▼                                 │
│   requirements=[]       requirements=[r1,r2]                    │
│   (DONE)                      │                                 │
│                               ▼                                 │
│                    Host executes effects                        │
│                    Host applies patches                         │
│                               │                                 │
│                               ▼                                 │
│                    Host calls compute() AGAIN                   │
│                    with same intent + context                   │
│                    with new snapshot                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Related Documents

- [Layer Model](/internals/architecture) - Understanding the layered architecture
- [Snapshot](/concepts/snapshot) - The single medium of communication
- [Effect](/concepts/effect) - How effects work
- [Core FDR](/internals/fdr/core-fdr) - Design rationale for Core
