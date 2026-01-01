# Debugging Manifesto Applications

> **Purpose:** Practical guide to debugging Manifesto applications
> **Audience:** Developers building with Manifesto
> **Reading time:** 15-20 minutes

---

## Overview

Manifesto's architecture makes debugging fundamentally different from traditional applications. Because Core is deterministic and all state flows through Snapshot, you get powerful debugging capabilities:

- **Time-travel debugging**: Replay any computation exactly
- **Complete traces**: See every step of execution
- **State inspection**: Full visibility into Snapshot
- **Re-entry detection**: Identify infinite loops before they happen

This guide shows you how to use these tools effectively.

---

## Understanding Trace

Every `compute()` call produces a **Trace** — a complete record of what happened.

### Trace Structure

```typescript
type Trace = {
  // Input
  intent: IntentInstance;
  snapshotBefore: Snapshot;
  schema: DomainSchema;

  // Output
  snapshotAfter: Snapshot;
  requirements: Requirement[];

  // Execution details
  steps: TraceStep[];
  errors: ErrorValue[];
  duration: number;
};

type TraceStep = {
  kind: 'flow' | 'expr' | 'patch' | 'effect';
  path: string;          // Where in Flow/Expr tree
  input: unknown;        // Input to this step
  output: unknown;       // Output from this step
  duration: number;
};
```

### Accessing Trace

```typescript
// From Host
const result = await host.dispatch({ type: 'addTodo', input: { title: 'Test' } });
console.log(result.trace);

// From Core directly
const result = core.compute(schema, snapshot, intent);
console.log(result.trace);
```

### Trace Visualization

```typescript
import { formatTrace } from '@manifesto-ai/core/debug';

const formatted = formatTrace(result.trace);
console.log(formatted);
```

**Output:**

```
Trace for intent: addTodo
─────────────────────────────────────────────────
Input:
  { title: "Test" }

Snapshot before:
  data.todos: []

Steps:
  1. Flow.seq
  2.   Flow.patch (state.todos)
  3.     Expr.concat
  4.       Expr.get (state.todos) → []
  5.       Expr.array → [{ id: "...", title: "Test", completed: false }]
  6.     Result: [{ ... }]
  7.   Patch applied: set data.todos = [{ ... }]

Snapshot after:
  data.todos: [{ id: "...", title: "Test", completed: false }]

Requirements: []
Duration: 2ms
```

---

## Common Debugging Patterns

### Pattern 1: State Not Updating

**Symptom:** You dispatch an intent, but state doesn't change.

#### Step 1: Check Trace

```typescript
const result = await host.dispatch({ type: 'toggleTodo', input: { id: '123' } });
console.log('Snapshot changed?', result.trace.snapshotAfter !== result.trace.snapshotBefore);
```

If `false`, the Flow didn't produce any patches.

#### Step 2: Inspect Flow Execution

```typescript
console.log('Steps:', result.trace.steps);
```

Look for:
- **Conditional that didn't match**: `Flow.when` condition evaluated to false
- **Empty array/object**: Expression returned empty result
- **Path mismatch**: Patch applied to wrong path

#### Example: Debugging Conditional

```typescript
// Flow
flow.when(
  expr.eq(expr.get(state.filter), 'completed'),
  flow.patch(state.showAll).set(expr.lit(true))
)

// Trace shows:
// Step 1: Flow.when
//   Condition: expr.eq(...) → false  ← Condition didn't match!
//   Body: skipped

// Fix: Check why filter isn't 'completed'
console.log(snapshot.data.filter); // → 'all' (not 'completed')
```

#### Step 3: Verify Snapshot Structure

```typescript
// Does the path exist?
console.log('Before:', result.trace.snapshotBefore.data.todos);
console.log('After:', result.trace.snapshotAfter.data.todos);

// Is the value what you expect?
console.log('Filter:', snapshot.data.filter);
```

---

### Pattern 2: Effect Not Executing

**Symptom:** Effect handler is registered, but never called.

#### Step 1: Check Requirements

```typescript
const result = await host.dispatch({ type: 'fetchUser', input: { id: '123' } });
console.log('Requirements:', result.trace.requirements);
```

If empty, the effect wasn't declared.

#### Step 2: Find Why Effect Wasn't Declared

Common causes:

**Cause 1: Flow branch skipped**

```typescript
// Flow
flow.when(
  expr.eq(state.needsSync, true),
  flow.effect('api:sync', {})  // Only runs if needsSync is true
)

// Check:
console.log('needsSync:', snapshot.data.needsSync);  // → false (effect skipped)
```

**Cause 2: Effect inside re-entry guard**

```typescript
// Flow
flow.onceNull(state.synced, ({ effect }) => {
  effect('api:sync', {});  // Only runs once
})

// Check:
console.log('synced:', snapshot.data.synced);  // → true (already ran)
```

**Cause 3: Effect type mismatch**

```typescript
// Flow declares:
flow.effect('api:fetchUser', { id: '123' })

// Handler registered as:
host.registerEffect('api:getUser', ...)  // ← Wrong name!
```

#### Step 3: Verify Handler Registration

```typescript
// Check registered handlers
console.log('Registered effects:', host.getRegisteredEffects());

// Verify name matches
if (!host.hasEffect('api:fetchUser')) {
  console.error('Handler not registered for: api:fetchUser');
}
```

---

### Pattern 3: Re-entry Loop

**Symptom:** Application hangs or runs infinitely.

#### What is Re-entry?

Re-entry happens when a Flow runs **every time** `compute()` is called, instead of only once.

**Example:**

```typescript
// WRONG: Runs every compute cycle
flow.patch(state.count).set(expr.add(state.count, 1))  // Increments forever!
```

Each time `compute()` runs:
1. Read `count` (e.g., 5)
2. Add 1 → 6
3. Patch `count` to 6
4. Next `compute()` reads 6, adds 1 → 7
5. Infinite loop!

#### Step 1: Detect Re-entry

```typescript
let computeCount = 0;
const originalCompute = core.compute;
core.compute = (...args) => {
  computeCount++;
  if (computeCount > 100) {
    throw new Error('Possible re-entry loop detected');
  }
  return originalCompute(...args);
};
```

#### Step 2: Find Unguarded Patches

```typescript
// Check trace for repeated steps
const steps = result.trace.steps;
const patchSteps = steps.filter(s => s.kind === 'patch');

console.log('Patches applied:', patchSteps.map(s => s.path));
// If you see the same path multiple times, it's re-entering
```

#### Step 3: Add State Guards

```typescript
// WRONG (re-enters)
flow.patch(state.initialized).set(expr.lit(true))

// RIGHT (runs once)
flow.onceNull(state.initialized, ({ patch }) => {
  patch(state.initialized).set(expr.lit(true));
})

// WRONG (re-enters)
flow.effect('api:sync', {})

// RIGHT (runs once)
flow.onceNull(state.synced, ({ effect, patch }) => {
  effect('api:sync', {});
  patch(state.synced).set(expr.input('timestamp'));
})
```

See [Re-entry Safe Flows Guide](/guides/reentry-safe-flows) for comprehensive patterns.

---

### Pattern 4: World Rejection

**Symptom:** Intent is rejected by World Protocol.

#### Step 1: Check Proposal Result

```typescript
const proposal = await world.submitProposal(actor, intent);
console.log('Approved?', proposal.decision.approved);
console.log('Reason:', proposal.decision.reason);
```

#### Step 2: Identify Authority

```typescript
// Which authority rejected?
console.log('Authority:', proposal.decision.authorityId);

// Get authority details
const authority = world.getAuthority(proposal.decision.authorityId);
console.log('Authority config:', authority);
```

#### Step 3: Debug Authority Logic

```typescript
// Add logging to authority
world.registerAuthority('todos:delete', async (proposal, context) => {
  console.log('Evaluating proposal:', proposal);
  console.log('Actor:', context.actor);
  console.log('Snapshot:', context.snapshot);

  if (context.actor.role !== 'admin') {
    console.log('Rejected: Not admin');
    return { approved: false, reason: 'Only admins can delete' };
  }

  console.log('Approved');
  return { approved: true };
});
```

#### Step 4: Verify Actor Permissions

```typescript
// Check actor details
const actor = world.getActor(actorId);
console.log('Actor role:', actor.role);
console.log('Actor permissions:', actor.permissions);

// Check if actor has required role
if (actor.role !== 'admin') {
  console.warn('Actor lacks admin role');
}
```

---

## Debugging Tools

### 1. Snapshot Diff

Compare snapshots to see exactly what changed:

```typescript
import { diffSnapshots } from '@manifesto-ai/core/debug';

const before = result.trace.snapshotBefore;
const after = result.trace.snapshotAfter;

const diff = diffSnapshots(before, after);
console.log(diff);
```

**Output:**

```json
{
  "changed": [
    {
      "path": "data.todos",
      "before": [],
      "after": [{ "id": "1", "title": "Test", "completed": false }],
      "op": "set"
    }
  ],
  "added": [],
  "removed": []
}
```

### 2. Expression Evaluator

Test expressions in isolation:

```typescript
import { evaluateExpr } from '@manifesto-ai/core';

const expr = {
  kind: 'add',
  left: { kind: 'get', path: 'data.count' },
  right: { kind: 'lit', value: 1 }
};

const result = evaluateExpr(expr, snapshot);
console.log('Result:', result);  // → 6 (if count was 5)
```

### 3. Flow Stepper

Step through Flow execution:

```typescript
import { stepFlow } from '@manifesto-ai/core/debug';

const stepper = stepFlow(schema, snapshot, flow);

while (!stepper.done) {
  console.log('Current step:', stepper.current);
  stepper.next();
}

console.log('Final result:', stepper.result);
```

### 4. Trace Replay

Replay a trace exactly:

```typescript
import { replayTrace } from '@manifesto-ai/core/debug';

// Load trace from production
const trace = await loadTrace('incident-abc-123');

// Replay locally
const result = replayTrace(trace);

// Compare results
expect(result.snapshotAfter).toEqual(trace.snapshotAfter);  // Should match!
```

---

## Common Error Messages

### Error: "Schema validation failed"

**Message:**

```
SchemaValidationError: Snapshot does not match schema
  Path: data.todos[0].title
  Expected: string
  Received: undefined
```

**Cause:** State doesn't match Zod schema.

**Fix:**

```typescript
// Check initial state
const initialState = {
  todos: [
    { id: "1", completed: false }  // Missing 'title'!
  ]
};

// Fix:
const initialState = {
  todos: [
    { id: "1", title: "Test", completed: false }  // ✓ Matches schema
  ]
};
```

### Error: "No handler for effect type X"

**Message:**

```
EffectHandlerError: No handler registered for effect type: api:fetchUser
```

**Cause:** Effect handler not registered before dispatch.

**Fix:**

```typescript
// Register handler BEFORE dispatching
host.registerEffect('api:fetchUser', async (type, params) => {
  const user = await fetch(`/api/users/${params.id}`).then(r => r.json());
  return [{ op: 'set', path: 'data.user', value: user }];
});

// Now dispatch
await host.dispatch({ type: 'fetchUser', input: { id: '123' } });
```

### Error: "Circular computed dependency"

**Message:**

```
ComputedDependencyError: Circular dependency detected
  Path: computed.a → computed.b → computed.a
```

**Cause:** Computed values depend on each other in a cycle.

**Fix:**

```typescript
// WRONG
computed.define({
  a: expr.get(computed.b),  // a depends on b
  b: expr.get(computed.a),  // b depends on a - CYCLE!
});

// RIGHT
computed.define({
  a: expr.get(state.count),         // a depends on state
  b: expr.add(computed.a, 1),       // b depends on a (no cycle)
});
```

### Error: "Patch path does not exist"

**Message:**

```
PatchError: Cannot set path: data.todos[5].completed
  Reason: Array index out of bounds (length: 2)
```

**Cause:** Trying to patch non-existent path.

**Fix:**

```typescript
// Check if path exists first
flow.when(
  expr.lt(expr.input('index'), expr.len(state.todos)),  // Guard
  flow.patch(state.todos[expr.input('index')].completed).set(expr.lit(true))
)
```

---

## Time-Travel Debugging

### Scenario: Production Bug

**Problem:** User reports that clicking "Clear Completed" didn't work.

#### Step 1: Capture Trace in Production

```typescript
// In production Host
host.subscribe((snapshot, trace) => {
  // Send trace to logging service
  logger.captureTrace({
    userId: currentUser.id,
    intentType: trace.intent.type,
    timestamp: Date.now(),
    trace: trace,
  });
});
```

#### Step 2: Load Trace Locally

```typescript
// In development
const trace = await loadTraceFromLogging('incident-abc-123');

console.log('Intent:', trace.intent);
console.log('Snapshot before:', trace.snapshotBefore);
console.log('Snapshot after:', trace.snapshotAfter);
```

#### Step 3: Replay Exactly

```typescript
// Replay with exact same inputs
const result = core.compute(
  trace.schema,
  trace.snapshotBefore,
  trace.intent
);

// Result MUST match production
expect(result.snapshotAfter).toEqual(trace.snapshotAfter);
expect(result.requirements).toEqual(trace.requirements);
```

#### Step 4: Debug with Breakpoints

```typescript
// Set breakpoints in Flow execution
const stepper = stepFlow(trace.schema, trace.snapshotBefore, flow);

while (!stepper.done) {
  console.log('Step:', stepper.current);

  // Set conditional breakpoint
  if (stepper.current.kind === 'patch' && stepper.current.path.includes('todos')) {
    debugger;  // Pause here
  }

  stepper.next();
}
```

#### Step 5: Identify Root Cause

```typescript
// Trace shows:
// Step: Flow.when
//   Condition: expr.gt(expr.len(completed), 0) → false
//   Body: skipped

// Root cause: 'completed' array is empty
console.log('completed:', trace.snapshotBefore.data.todos.filter(t => t.completed));
// → [] (no completed todos!)

// Bug: User thought there were completed todos, but there weren't
```

---

## Browser DevTools Integration

### Snapshot Inspector

Install Manifesto DevTools extension (coming soon) or use console:

```typescript
// Add to window for inspection
window.__MANIFESTO__ = {
  core,
  host,
  world,
  getSnapshot: () => host.getSnapshot(),
  getTrace: () => host.getLastTrace(),
};

// In console:
__MANIFESTO__.getSnapshot().data.todos
__MANIFESTO__.getTrace().steps
```

### React DevTools

When using `@manifesto-ai/react`:

```typescript
// Add display names for debugging
const TodoApp = createManifestoApp(TodoDomain, {
  displayName: 'TodoApp',  // Shows in React DevTools
});
```

### Redux DevTools

Manifesto can integrate with Redux DevTools:

```typescript
import { createDevToolsMiddleware } from '@manifesto-ai/host/devtools';

const host = createHost({
  schema,
  snapshot,
  middleware: [createDevToolsMiddleware()],
});
```

---

## Testing Strategies for Debugging

### Strategy 1: Determinism Tests

Verify same input → same output:

```typescript
it('is deterministic', () => {
  const result1 = core.compute(schema, snapshot, intent);
  const result2 = core.compute(schema, snapshot, intent);

  expect(result1.snapshotAfter).toEqual(result2.snapshotAfter);
  expect(result1.requirements).toEqual(result2.requirements);
});
```

### Strategy 2: Snapshot Snapshots

Use Jest snapshots for regression testing:

```typescript
it('computes correct state', () => {
  const result = core.compute(schema, snapshot, intent);
  expect(result.snapshotAfter.data).toMatchSnapshot();
});
```

### Strategy 3: Trace Assertions

Assert on trace structure:

```typescript
it('executes expected steps', () => {
  const result = core.compute(schema, snapshot, intent);

  expect(result.trace.steps).toEqual([
    { kind: 'flow', path: 'seq', ... },
    { kind: 'patch', path: 'data.todos', ... },
  ]);
});
```

---

## Performance Debugging

### Identify Slow Computations

```typescript
host.subscribe((snapshot, trace) => {
  if (trace.duration > 100) {  // More than 100ms
    console.warn('Slow computation:', {
      intent: trace.intent.type,
      duration: trace.duration,
      steps: trace.steps.length,
    });
  }
});
```

### Profile Expression Evaluation

```typescript
const steps = trace.steps.filter(s => s.kind === 'expr');
const slowSteps = steps.filter(s => s.duration > 10);

console.log('Slow expressions:', slowSteps);
```

### Optimize Computed Values

```typescript
// Before: Recomputes every time
computed.define({
  filteredTodos: expr.filter(state.todos, t => expr.eq(t.completed, state.filter))
});

// After: Cache in data if expensive
actions.define({
  setFilter: {
    input: z.object({ filter: z.string() }),
    flow: flow.seq([
      flow.patch(state.filter).set(expr.input('filter')),
      flow.patch(state.filteredTodos).set(
        expr.filter(state.todos, t => expr.eq(t.completed, expr.input('filter')))
      ),
    ]),
  },
});
```

---

## Summary

**Debugging in Manifesto is different because:**

1. **Determinism**: Same input → same output enables reliable reproduction
2. **Complete traces**: Every step is recorded and inspectable
3. **Time-travel**: Production bugs are locally reproducible
4. **State visibility**: Snapshot contains all state (no hidden channels)

**Key debugging tools:**

- Trace inspection and replay
- Snapshot diffing
- Expression evaluation
- Flow stepping
- Re-entry detection
- DevTools integration

**Common patterns:**

- State not updating → Check trace for skipped conditionals
- Effect not executing → Verify requirements and handler registration
- Re-entry loop → Add state guards to patches/effects
- World rejection → Debug authority logic

---

## Related Documents

- [Re-entry Safe Flows](/guides/reentry-safe-flows) - Prevent infinite loops
- [Effect Handlers](/guides/effect-handlers) - Debug effect execution
- [Schema Specification](/specifications/schema-spec) - Normative trace format
- [Core FDR](/rationale/core-fdr) - Why determinism matters
