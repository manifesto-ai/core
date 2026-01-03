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
type TraceGraph = {
  root: TraceNode;
  nodes: Record<string, TraceNode>;
  intent: { type: string; input: unknown };
  baseVersion: number;
  resultVersion: number;
  duration: number;
  terminatedBy: 'complete' | 'effect' | 'halt' | 'error';
};

type TraceNode = {
  id: string;
  kind: 'expr' | 'computed' | 'flow' | 'patch' | 'effect' | 'branch' | 'call' | 'halt' | 'error';
  sourcePath: string;          // Where in Flow/Expr tree
  inputs: Record<string, unknown>;
  output: unknown;
  children: TraceNode[];
  timestamp: number;
};
```

### Accessing Trace

```typescript
// From Host
const result = await host.dispatch(createIntent('addTodo', { title: 'Test' }, 'intent-1'));
const trace = result.traces[result.traces.length - 1];
console.log(trace);

// From Core directly
const context = { now: 0, randomSeed: "seed" };
const intent = createIntent('addTodo', { title: 'Test' }, 'intent-1');
const result = await core.compute(schema, snapshot, intent, context);
console.log(result.trace);
```

### Trace Visualization

```typescript
const printTrace = (node, depth = 0) => {
  const indent = '  '.repeat(depth);
  console.log(`${indent}${node.kind} ${node.sourcePath}`);
  node.children.forEach(child => printTrace(child, depth + 1));
};

printTrace(trace.root);
```

**Output:**

```
TraceGraph summary:
  intent: addTodo
  terminatedBy: complete
  baseVersion: 0 → resultVersion: 1
  root: flow root
```

---

## Common Debugging Patterns

### Pattern 1: State Not Updating

**Symptom:** You dispatch an intent, but state doesn't change.

#### Step 1: Check Trace

```typescript
const before = await host.getSnapshot();
const intent = createIntent('toggleTodo', { id: '123' }, 'intent-1');
const result = await host.dispatch(intent);
console.log('Snapshot changed?', before?.meta.version !== result.snapshot.meta.version);
```

If `false`, the Flow didn't produce any patches.

#### Step 2: Inspect Flow Execution

```typescript
const trace = result.traces[result.traces.length - 1];
console.log('Trace nodes:', Object.values(trace.nodes));
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
console.log('Before:', before?.data.todos);
console.log('After:', result.snapshot.data.todos);

// Is the value what you expect?
console.log('Filter:', snapshot.data.filter);
```

---

### Pattern 2: Effect Not Executing

**Symptom:** Effect handler is registered, but never called.

#### Step 1: Check Requirements

```typescript
const intent = createIntent('fetchUser', { id: '123' }, 'intent-1');
const context = { now: 0, randomSeed: "seed" };
const result = await core.compute(schema, snapshot, intent, context);
console.log('Requirements:', result.requirements);
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
console.log('Registered effects:', host.getEffectTypes());

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
const nodes = Object.values(result.trace.nodes);
const patchSteps = nodes.filter(node => node.kind === 'patch');

console.log('Patches applied:', patchSteps.map(node => node.sourcePath));
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
const before = snapshot;
const after = result.snapshot;

console.log({ before: before.data, after: after.data });
// For deep diffs, use a JSON diff tool on before.data/after.data
```

### 2. Expression Evaluator

Test expressions in isolation:

```typescript
import { evaluateExpr, createContext } from '@manifesto-ai/core';

const expr = {
  kind: 'add',
  left: { kind: 'get', path: 'count' },
  right: { kind: 'lit', value: 1 }
};

const ctx = createContext(snapshot, schema);
const result = evaluateExpr(expr, ctx);
console.log('Result:', result);  // → 6 (if count was 5)
```

### 3. Deterministic Replay

Replay a computation with the same inputs:

```typescript
const context = {
  now: snapshot.meta.timestamp,
  randomSeed: snapshot.meta.randomSeed,
};
const replay = await core.compute(schema, snapshot, intent, context);

expect(replay.snapshot).toEqual(result.snapshot);
```

---

## Common Error Messages

### Error: "Schema validation failed"

**Message:**

```
SchemaValidationError: Snapshot does not match schema
  Path: todos.0.title
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
  return [{ op: 'set', path: 'user', value: user }];
});

// Now dispatch
await host.dispatch(createIntent('fetchUser', { id: '123' }, 'intent-1'));
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
PatchError: Cannot set path: todos.5.completed
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
async function dispatchWithTrace(intent) {
  const before = await host.getSnapshot();
  const result = await host.dispatch(intent);
  const trace = result.traces[result.traces.length - 1];

  if (before) {
    logger.captureTrace({
      userId: currentUser.id,
      intentType: trace.intent.type,
      timestamp: Date.now(),
      record: { intent, before, after: result.snapshot, trace },
    });
  }

  return result;
}
```

#### Step 2: Load Trace Locally

```typescript
// In development
const record = await loadTraceFromLogging('incident-abc-123');

console.log('Intent:', record.intent);
console.log('Snapshot before:', record.before);
console.log('Snapshot after:', record.after);
```

#### Step 3: Replay Exactly

```typescript
// Replay with exact same inputs
const context = {
  now: record.before.meta.timestamp,
  randomSeed: record.before.meta.randomSeed,
};
const result = await core.compute(schema, record.before, record.intent, context);

// Result MUST match production
expect(result.snapshot).toEqual(record.after);
```

#### Step 4: Debug with Breakpoints

```typescript
// Inspect trace nodes and focus on patches
const nodes = Object.values(record.trace.nodes);
const patches = nodes.filter(node => node.kind === 'patch');
console.log('Patch nodes:', patches.map(node => node.sourcePath));
```

#### Step 5: Identify Root Cause

```typescript
// Trace shows:
// Step: Flow.when
//   Condition: expr.gt(expr.len(completed), 0) → false
//   Body: skipped

// Root cause: 'completed' array is empty
console.log('completed:', record.before.data.todos.filter(t => t.completed));
// → [] (no completed todos!)

// Bug: User thought there were completed todos, but there weren't
```

---

## Browser DevTools Integration

### Snapshot Inspector

Install Manifesto DevTools extension (coming soon) or use console:

```typescript
let lastTrace = null;

// Capture last trace on each compute
const host = createHost(schema, {
  loop: {
    onAfterCompute: (_iteration, result) => {
      lastTrace = result.trace;
    },
  },
});

// Add to window for inspection
window.__MANIFESTO__ = {
  core,
  host,
  world,
  getSnapshot: () => host.getSnapshot(),
  getTrace: () => lastTrace,
};

// In console:
await __MANIFESTO__.getSnapshot();
__MANIFESTO__.getTrace();
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
const host = createHost(schema, {
  initialData: {},
  context: { now: () => Date.now() },
  loop: {
    onAfterCompute: (_iteration, result) => {
      // Send state/trace to your DevTools integration
      devtools.send(result.snapshot, result.trace);
    },
  },
});
```

---

## Testing Strategies for Debugging

### Strategy 1: Determinism Tests

Verify same input → same output:

```typescript
it('is deterministic', () => {
  const context = { now: 0, randomSeed: "seed" };
  const result1 = await core.compute(schema, snapshot, intent, context);
  const result2 = await core.compute(schema, snapshot, intent, context);

  expect(result1.snapshot).toEqual(result2.snapshot);
  expect(result1.requirements).toEqual(result2.requirements);
});
```

### Strategy 2: Snapshot Snapshots

Use Jest snapshots for regression testing:

```typescript
it('computes correct state', () => {
  const context = { now: 0, randomSeed: "seed" };
  const result = await core.compute(schema, snapshot, intent, context);
  expect(result.snapshot.data).toMatchSnapshot();
});
```

### Strategy 3: Trace Assertions

Assert on trace structure:

```typescript
it('executes expected steps', () => {
  const context = { now: 0, randomSeed: "seed" };
  const result = await core.compute(schema, snapshot, intent, context);

  const nodes = Object.values(result.trace.nodes);
  expect(nodes.some(node => node.kind === 'patch' && node.sourcePath === 'todos')).toBe(true);
});
```

---

## Performance Debugging

### Identify Slow Computations

```typescript
const host = createHost(schema, {
  loop: {
    onAfterCompute: (_iteration, result) => {
      const trace = result.trace;
      if (trace.duration > 100) {  // More than 100ms
        console.warn('Slow computation:', {
          intent: trace.intent.type,
          duration: trace.duration,
          steps: Object.keys(trace.nodes).length,
        });
      }
    },
  },
});
```

### Profile Expression Evaluation

```typescript
const exprNodes = Object.values(trace.nodes).filter(node => node.kind === 'expr');
console.log('Expression nodes:', exprNodes.map(node => node.sourcePath));
// For per-node timings, wrap compute/evaluateExpr with custom timers.
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
