# Antipatterns

> Source: CLAUDE.md §10, Core FDR v2.0.0, Compiler SPEC v0.5.0 §8
> Last synced: 2026-02-09

If you see these patterns in code, REJECT the change.

## Constitutional Violations

### AP-001: Intelligent Host

Host making policy decisions about effect execution.

```typescript
// FORBIDDEN
async function executeEffect(req) {
  if (shouldSkipEffect(req)) {  // Host deciding!
    return [];
  }
}

// Host MUST execute or report failure, never decide.
```

Why: Host executes, Core computes. Decision-making is Core's job. [FDR-001]

### AP-002: Value Passing Outside Snapshot

Returning values from effects for direct use, bypassing Snapshot.

```typescript
// FORBIDDEN
const result = await executeEffect();
core.compute(schema, snapshot, { ...intent, result });

// CORRECT
// Effect returns patches → Host applies → Next compute() reads from Snapshot
```

Why: Snapshot is the sole communication medium. [FDR-002]

### AP-003: Execution-Aware Core

Core branching on execution state it shouldn't know about.

```typescript
// FORBIDDEN
if (effectExecutionSucceeded) { ... }

// CORRECT
if (snapshot.data.syncStatus === 'success') { ... }
```

Why: Core is pure. It reads Snapshot, nothing else. [FDR-001]

### AP-004: Hidden Continuation State

Storing execution context outside Snapshot.

```typescript
// FORBIDDEN
const pendingCallbacks = new Map();  // Hidden state!

// CORRECT — All execution state in snapshot.system.pendingRequirements
```

Why: There is no suspended execution context. [FDR-003]

## Flow Violations

### AP-005: Re-Entry Unsafe Flow

Flow that runs every compute cycle without state guard.

```mel
// FORBIDDEN — runs every cycle!
action increment() {
  patch count = add(count, 1)       // Increments forever!
  effect api.submit({ })            // Called every cycle!
}

// CORRECT
action increment() {
  onceIntent {
    patch count = add(count, 1)
    effect api.submit({ })
  }
}
```

Why: Flows are re-evaluated on every `compute()` call. Guards prevent re-execution. [FDR-006]

### AP-006: Unbounded Loop in Flow

Attempting Turing-complete loops in Flow.

```mel
// DOES NOT EXIST — no while/for in MEL
while eq(pending, true) { ... }
```

Why: Flow must terminate in finite steps. Host controls iteration. [FDR-006]

### AP-007: Nested Effects

Effects inside other effects.

```mel
// FORBIDDEN
effect array.map({
  source: teams,
  select: {
    members: effect array.filter({   // Nested!
      source: $item.members,
      where: eq($item.active, true)
    })
  },
  into: result
})

// CORRECT — Sequential composition
effect array.flatMap({ source: teams, select: $item.members, into: allMembers })
effect array.filter({ source: allMembers, where: eq($item.active, true), into: activeMembers })
```

Why: Effects are sequential declarations, not expressions. [Compiler SPEC §8.4]

## State Violations

### AP-008: Direct Snapshot Mutation

```typescript
// FORBIDDEN
snapshot.data.count = 5;

// CORRECT
core.apply(schema, snapshot, [{ op: 'set', path: 'data.count', value: 5 }]);
```

Why: Snapshots are immutable. All mutations via patches. [FDR-002]

### AP-009: Throwing in Effect Handler

```typescript
// FORBIDDEN
async function handler(params) {
  throw new Error('Something failed');
}

// CORRECT
async function handler(params) {
  return [{ op: 'set', path: 'data.error', value: 'Something failed' }];
}
```

Why: Errors are values in Snapshot, never thrown. [FDR-005]

## Type Violations

### AP-010: String Paths in User API

```typescript
// FORBIDDEN
{ path: '/data/todos/0/completed' }

// CORRECT
state.todos[0].completed  // TypeScript-checked FieldRef
```

Why: User-facing APIs must be type-safe with zero string paths.

## Governance Violations

### AP-011: Authority Bypass

Executing intents without World Protocol.

```typescript
// FORBIDDEN
host.execute(snapshot, intent);  // Skips governance!

// CORRECT
world.submitProposal(actor, intentInstance);
// Authority evaluates → approved intents go to Host
```

Why: All intents must pass through World Protocol for governance and auditability.

## MEL-Specific Mistakes

### AP-012: Truthy/Falsy in Guards

```mel
// FORBIDDEN — items is not boolean
when items { ... }

// CORRECT
when gt(len(items), 0) { ... }
```

### AP-013: Template Literals

```mel
// FORBIDDEN
patch greeting = `Hello ${name}`

// CORRECT
patch greeting = concat("Hello ", name)
```

### AP-014: Using `$` in Domain Identifiers

```mel
// FORBIDDEN
state { $myField: string = "" }

// CORRECT
state { myField: string = "" }
```

`$host`, `$mel`, `$system` are platform-reserved. Domain code must not use `$`.

## Computed Violations

### AP-015: Circular Computed Dependencies

```mel
// FORBIDDEN — cycle: a depends on b, b depends on a
computed a = b
computed b = a
```

Computed dependencies MUST form a DAG. Cycles are rejected at validation time. [Core SPEC §14 V-002]

## Quick Checklist

Before submitting code, verify NONE of these exist:

- [ ] Host making decisions (not just executing)
- [ ] Values passed outside Snapshot
- [ ] Core knowing about execution state
- [ ] Flow without state guard (patch/effect outside when/once/onceIntent)
- [ ] Direct snapshot mutation
- [ ] Throwing in effect handlers
- [ ] String paths in user-facing API
- [ ] Intent executed without governance
- [ ] Nested effects
- [ ] Truthy/falsy conditions in guards
- [ ] Circular computed dependencies

## Cross-References

- Architecture rules: @knowledge/architecture.md
- Correct MEL patterns: @knowledge/mel-patterns.md
- Effect handler contract: @knowledge/effect-patterns.md
- Patch rules: @knowledge/patch-rules.md
