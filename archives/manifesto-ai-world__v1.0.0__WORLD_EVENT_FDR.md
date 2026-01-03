# World Protocol Event System — Foundational Design Rationale (FDR)

> **Version:** 1.0  
> **Status:** Normative  
> **Purpose:** Document the "Why" behind every constitutional decision in the World Event System Extension

---

## Overview

This document records the foundational design decisions that shape the World Protocol Event System.

Each FDR entry follows the format:

- **Decision**: What was decided
- **Context**: Why this decision was needed
- **Rationale**: The reasoning behind the choice
- **Alternatives Rejected**: Other options considered and why they were rejected
- **Consequences**: What this decision enables and constrains

---

## Table of Contents

1. [FDR-E001: Event System as First-Class Protocol Feature](#fdr-e001-event-system-as-first-class-protocol-feature)
2. [FDR-E002: Synchronous Event Delivery](#fdr-e002-synchronous-event-delivery)
3. [FDR-E003: Subscribe Pattern over Plugin Pattern](#fdr-e003-subscribe-pattern-over-plugin-pattern)
4. [FDR-E004: Granular Event Types](#fdr-e004-granular-event-types)
5. [FDR-E005: Causal Ordering Guarantee](#fdr-e005-causal-ordering-guarantee)
6. [FDR-E006: Handler Non-Interference Constraint](#fdr-e006-handler-non-interference-constraint)
7. [FDR-E007: Snapshot Inclusion Strategy](#fdr-e007-snapshot-inclusion-strategy)
8. [FDR-E008: No Event Filtering at Source](#fdr-e008-no-event-filtering-at-source)
9. [FDR-E009: Exception Isolation](#fdr-e009-exception-isolation)
10. [FDR-E010: Single Subscribe Method with Overloads](#fdr-e010-single-subscribe-method-with-overloads)
11. [Summary Table](#summary-table)
12. [Cross-Reference: Related FDRs](#cross-reference-related-fdrs)

---

## FDR-E001: Event System as First-Class Protocol Feature

### Decision

Event System is a **first-class feature** of World Protocol, not an optional extension or separate package.

```typescript
interface ManifestoWorld {
  // Core API
  registerActor(...): void;
  submitProposal(...): Promise<ProposalResult>;
  
  // Event API - same level as core API
  subscribe(handler: WorldEventHandler): Unsubscribe;
}
```

### Context

When designing observability for World Protocol, two approaches emerged:

| Approach | Description |
|----------|-------------|
| **Separate Package** | `@manifesto-ai/world-events` wraps World |
| **Built-in** | Events are part of World Protocol itself |

### Rationale

**Observation is not optional. It's constitutional.**

World Protocol's core promises include:

- **Auditability**: Who intended what, when
- **Reproducibility**: Replay from recorded history
- **Accountability**: Trace decisions to actors

Without events, these are **aspirational claims**. With events, they become **verifiable guarantees**.

```
World Protocol without Events:
┌──────────────────────────────┐
│         World                │
│                              │
│   submitProposal() ──► ???   │  ← Black box
│                              │
└──────────────────────────────┘

World Protocol with Events:
┌──────────────────────────────┐
│         World                │
│                              │
│   submitProposal()           │
│        │                     │
│        ├──► proposal:submitted
│        ├──► proposal:decided │  ← Observable
│        ├──► execution:started│
│        └──► world:created    │
│                              │
└──────────────────────────────┘
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Separate `@manifesto-ai/world-events` | Creates artificial separation; observation is core |
| Optional feature flag | Leads to untestable code paths |
| Logging-only (no subscribe) | Not programmable; can't build Lab |

### Consequences

- Every World implementation MUST support events
- Events are part of compliance testing
- Lab can wrap any compliant World
- No "World without events" variant

---

## FDR-E002: Synchronous Event Delivery

### Decision

Events are delivered **synchronously**, before the triggering operation returns.

```typescript
await world.submitProposal({ ... });
// By this line, ALL events for this proposal have been delivered
```

### Context

Event delivery timing has two options:

| Timing | Description |
|--------|-------------|
| **Synchronous** | Event delivered before operation returns |
| **Asynchronous** | Event queued, delivered later |

### Rationale

**Synchronous delivery enables deterministic observation.**

Consider Lab's trace recording:

```typescript
// Synchronous: trace is complete immediately
await labWorld.submitProposal({ ... });
const trace = labWorld.trace(); // Complete trace available

// Asynchronous: race condition
await labWorld.submitProposal({ ... });
const trace = labWorld.trace(); // May be incomplete!
```

**Causal reasoning requires synchronous events:**

```
Operation A causes Event E
Event E observed by Observer O
Observer O reacts with Operation B

Synchronous:
  A → E → O → B  (deterministic order)

Asynchronous:
  A → (queue E) → B → ... → E → O  (B may happen before E observed!)
```

For debugging and testing, synchronous is essential:

```typescript
// Test: verify event emission
world.subscribe((e) => events.push(e));
await world.submitProposal({ type: 'test' });
expect(events).toContainEqual({ type: 'proposal:submitted', ... });
// This assertion works because delivery is synchronous
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Async queue | Race conditions, non-deterministic traces |
| `nextTick` delivery | Still async, same problems |
| Batched delivery | Loses causal granularity |

### Consequences

- Events are delivered inline with operation
- Slow handlers can slow operations (see EVT-C3)
- Handlers MUST NOT await async operations
- Deterministic trace recording is possible

---

## FDR-E003: Subscribe Pattern over Plugin Pattern

### Decision

World uses **subscribe pattern** (external observation) rather than **plugin pattern** (internal hooks).

```typescript
// Subscribe pattern (chosen)
const unsubscribe = world.subscribe((event) => { ... });

// Plugin pattern (rejected)
const world = createManifestoWorld({
  plugins: [myObserver],  // ← Not this
});
```

### Context

Lab's initial design assumed plugins:

```typescript
// Initial (problematic) design
const lab = createLabPlugin({ ... });
const world = createManifestoWorld({ plugins: [lab] });
const labWorld = lab.wrap(world);
```

This required mentioning Lab twice and couldn't observe existing worlds.

### Rationale

**Subscribe pattern enables composition without construction-time coupling.**

| Concern | Plugin Pattern | Subscribe Pattern |
|---------|---------------|-------------------|
| When to attach | Construction only | Anytime |
| Attach to existing World | ❌ Impossible | ✅ Possible |
| Multiple observers | Complex registration | Simple multiple subscribe |
| Removal | Hard (reconstruction?) | Easy (unsubscribe) |

**Lab use case proves the point:**

```typescript
// With subscribe pattern
const world = createManifestoWorld({ ... }); // World doesn't know about Lab
const labWorld = createLab({ ... }).wrap(world); // Lab subscribes internally

// Lab can wrap ANY World, even one it didn't create
const existingWorld = getWorldFromSomewhere();
const labWorld = createLab({ ... }).wrap(existingWorld); // Works!
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Plugin system | Construction-time coupling |
| Mixin pattern | Requires inheritance, not composition |
| Middleware pattern | Wrong abstraction (transforms, not observes) |

### Consequences

- World has simple subscribe API
- Observers can attach/detach dynamically
- No plugin registration system needed
- Lab wrapper pattern works cleanly

---

## FDR-E004: Granular Event Types

### Decision

Events are **granular** (12 types), covering distinct lifecycle points rather than coarse categories.

```typescript
type WorldEventType =
  // Proposal: 3 events
  | 'proposal:submitted'
  | 'proposal:evaluating'
  | 'proposal:decided'
  
  // Execution: 7 events
  | 'execution:started'
  | 'execution:computing'
  | 'execution:patches'
  | 'execution:effect'
  | 'execution:effect_result'
  | 'execution:completed'
  | 'execution:failed'
  
  // State: 1 event
  | 'snapshot:changed'
  
  // World: 2 events (including genesis distinction)
  | 'world:created'
  | 'world:forked';
```

### Context

Event granularity spans a spectrum:

| Granularity | Events | Example |
|-------------|--------|---------|
| **Coarse** | 2-3 | `change`, `error` |
| **Medium** | 5-8 | `proposal`, `execution`, `world` |
| **Granular** | 10-15 | Current design |
| **Fine** | 20+ | Every internal state change |

### Rationale

**Different consumers need different granularity. Provide atomic events; consumers aggregate.**

Lab's trace needs:
- When each effect executed
- Which patches came from compute vs. effect
- Exactly when snapshot changed

A coarse `execution:done` event loses this:

```typescript
// Coarse: can't reconstruct what happened
{ type: 'execution:done', patches: [...] }
// Were these patches from compute or effect? Unknown.

// Granular: full reconstruction possible
{ type: 'execution:patches', source: 'compute', patches: [...] }
{ type: 'execution:effect', effectType: 'api:call', ... }
{ type: 'execution:effect_result', resultPatches: [...] }
{ type: 'execution:patches', source: 'effect', patches: [...] }
```

**Consumers can filter; they can't add granularity:**

```typescript
// Consumer wants only decisions? Easy to filter.
world.subscribe(['proposal:decided'], handler);

// Consumer wants compute vs. effect distinction?
// With coarse events: impossible
// With granular events: already there
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Coarse (3 events) | Loses information needed for Lab |
| Very fine (20+) | Noise, performance overhead |
| Hierarchical events | Complexity; flat is simpler |

### Consequences

- 12 distinct event types
- Full lifecycle reconstruction from events
- Selective subscription supported
- Events are atomic (no nesting)

---

## FDR-E005: Causal Ordering Guarantee

### Decision

Events are delivered in **causal order** within a proposal lifecycle.

```
proposal:submitted BEFORE proposal:decided
proposal:decided BEFORE execution:started
execution:started BEFORE execution:patches
execution:patches BEFORE snapshot:changed
snapshot:changed BEFORE execution:completed
execution:completed BEFORE world:created
```

### Context

Without ordering guarantees, observers face race conditions:

```typescript
// Without ordering guarantee
world.subscribe((e) => {
  if (e.type === 'execution:completed') {
    // Did snapshot:changed already happen?
    // Is world:created coming?
    // Unknown!
  }
});
```

### Rationale

**Causal order enables state machine reasoning in observers.**

Lab's projection can show progress because it knows:

```
After proposal:submitted → Proposal is in system
After proposal:decided (approved) → Execution will start
After execution:completed → World will be created
```

This is a **state machine**, and state machines require ordered transitions.

```
┌─────────────────────────────────────────────────────────┐
│                  CAUSAL ORDER GRAPH                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  proposal:submitted                                     │
│         │                                               │
│         ▼                                               │
│  proposal:evaluating (optional)                         │
│         │                                               │
│         ▼                                               │
│  proposal:decided ────────┐                             │
│         │                 │                             │
│         │ (approved)      │ (rejected)                  │
│         ▼                 ▼                             │
│  execution:started       (end)                          │
│         │                                               │
│         ▼                                               │
│  execution:computing                                    │
│         │                                               │
│         ▼                                               │
│  execution:patches ◄────────────┐                       │
│         │                       │                       │
│         ├── (has effect) ───────┤                       │
│         │         │             │                       │
│         │         ▼             │                       │
│         │  execution:effect     │                       │
│         │         │             │                       │
│         │         ▼             │                       │
│         │  execution:effect_result                      │
│         │         │             │                       │
│         │         └─────────────┘                       │
│         │                                               │
│         ▼                                               │
│  snapshot:changed                                       │
│         │                                               │
│         ├── (success) ──► execution:completed           │
│         │                        │                      │
│         └── (failure) ──► execution:failed              │
│                                  │                      │
│                                  ▼                      │
│                           world:created                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| No ordering guarantee | Observers can't reason about state |
| Partial ordering | Confusing; which pairs are ordered? |
| Logical timestamps | Overkill for single-World case |

### Consequences

- Observers can build state machines
- Lab's projection is reliable
- Trace replay is deterministic
- Implementation must ensure order (no concurrent emission)

---

## FDR-E006: Handler Non-Interference Constraint

### Decision

Event handlers **MUST NOT** modify world state or call state-modifying methods.

```typescript
// FORBIDDEN
world.subscribe((event) => {
  if (event.type === 'proposal:decided') {
    world.submitProposal({ ... }); // ❌ MUST NOT
  }
});

// ALLOWED
world.subscribe((event) => {
  trace.push(event);           // ✅ OK: external state
  updateUI(event);             // ✅ OK: side effect outside world
  logToConsole(event);         // ✅ OK: observation only
});
```

### Context

If handlers could modify state:

```typescript
world.subscribe((e) => {
  if (e.type === 'proposal:submitted') {
    world.submitProposal({ type: 'reaction' }); // Creates new proposal
    // Which creates new event
    // Which triggers handler
    // Which creates new proposal
    // ...infinite loop
  }
});
```

### Rationale

**Events are for observation, not reaction.**

| Pattern | Purpose | Allowed |
|---------|---------|---------|
| Observation | Record, log, display | ✅ Yes |
| Reaction | Trigger new actions | ❌ No (use different mechanism) |

**Separation of concerns:**

```
Event Handler = Pure Observer
  Input: Event
  Output: None (side effects to external systems only)
  
  May: log, record, update UI, notify external system
  Must Not: modify World, submit proposals, change state
```

**If reaction is needed, use a different pattern:**

```typescript
// Don't react in handler
world.subscribe((e) => {
  reactionQueue.push(e); // Queue for later processing
});

// Process reactions separately
async function processReactions() {
  for (const e of reactionQueue.drain()) {
    await world.submitProposal({ ... }); // Safe: not in handler
  }
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Allow reactions | Infinite loops, reentrant complexity |
| "Safe" reaction subset | Hard to define, still complex |
| Async reaction queue built-in | Application concern, not protocol |

### Consequences

- Handlers are pure observers
- No reentrant calls during event delivery
- Reaction patterns are application responsibility
- Event delivery is predictable

---

## FDR-E007: Snapshot Inclusion Strategy

### Decision

`snapshot:changed` event includes **full snapshot in `after`**, with **optional snapshot in `before`**.

```typescript
type SnapshotChangedEvent = {
  readonly type: 'snapshot:changed';
  readonly before: {
    readonly snapshotHash: string;
    readonly snapshot?: Snapshot; // Optional
  };
  readonly after: {
    readonly snapshotHash: string;
    readonly snapshot: Snapshot;  // Always present
  };
  // ...
};
```

### Context

Three options for snapshot inclusion:

| Option | Memory | Convenience |
|--------|--------|-------------|
| Hash only | Low | Must fetch separately |
| Full both | High | Maximum convenience |
| **After full, before optional** | Medium | Practical balance |

### Rationale

**The common case is "what is the current state?" not "what was the previous state?"**

Lab's projection shows current state:
```typescript
world.subscribe((e) => {
  if (e.type === 'snapshot:changed') {
    updateProjection(e.after.snapshot); // Need current state
    // Rarely need: e.before.snapshot
  }
});
```

**Before snapshot is needed for:**
- Diff computation
- Undo functionality
- Audit comparison

These are **specialized** use cases. Default to efficient; allow opt-in for expensive.

```typescript
// Implementation can provide before snapshot on request
const world = createManifestoWorld({
  events: {
    includeBeforeSnapshot: true, // Opt-in
  },
});
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Hash only | Too inconvenient for common case |
| Full both always | Memory overhead for large snapshots |
| Configurable per-subscriber | Complex, overkill |

### Consequences

- `after.snapshot` always available
- `before.snapshot` may be undefined (check before use)
- Low memory overhead for typical use
- Diff use cases require opt-in configuration

---

## FDR-E008: No Event Filtering at Source

### Decision

World emits **all events**. Filtering is subscriber's responsibility.

```typescript
// World emits all events
world.subscribe((event) => {
  // Subscriber filters
  if (event.type !== 'proposal:decided') return;
  // Handle
});

// Convenience overload does filtering
world.subscribe(['proposal:decided'], handler);
// But internally: World emits all, overload filters
```

### Context

Two filtering strategies:

| Strategy | Where Filtering Happens |
|----------|------------------------|
| **Source filtering** | World skips events not subscribed to |
| **Subscriber filtering** | World emits all, subscriber ignores |

### Rationale

**Source filtering creates coupling between emission and subscription.**

Problem with source filtering:

```typescript
// Subscriber A wants: proposal:submitted
// Subscriber B wants: proposal:decided

// With source filtering:
// World must track: "A wants X, B wants Y"
// When emitting: check all subscribers' filters
// When subscriber added/removed: update filter set

// With subscriber filtering:
// World just emits
// Each subscriber checks locally
```

**Performance is comparable:**

```
Source filtering:
  emit(): for each type, check if any subscriber wants it
  
Subscriber filtering:
  emit(): call all handlers
  handler: check type (one comparison)
```

The difference is negligible, but subscriber filtering is simpler.

**Convenience overload provides good DX without complicating World:**

```typescript
// This is syntactic sugar
world.subscribe(['proposal:decided'], handler);

// Equivalent to:
world.subscribe((event) => {
  if (event.type === 'proposal:decided') handler(event);
});
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Source filtering | Complexity, state in World |
| No filtering support | Poor DX for selective subscription |
| Event bus abstraction | Overkill; simple subscribe is enough |

### Consequences

- World's emit logic is simple
- Multiple subscribers don't affect each other
- Type-filtered subscribe is convenience, not core
- Slight overhead for uninterested events (negligible)

---

## FDR-E009: Exception Isolation

### Decision

Handler exceptions are **isolated** and do not affect World operation or other handlers.

```typescript
world.subscribe((event) => {
  throw new Error('Handler failed'); // This doesn't break World
});

world.subscribe((event) => {
  console.log(event); // This still gets called
});

await world.submitProposal({ ... }); // This still completes
```

### Context

Handler exceptions could be handled three ways:

| Strategy | Behavior |
|----------|----------|
| **Propagate** | Exception stops World operation |
| **Isolate** | Exception logged, operation continues |
| **Silent** | Exception swallowed without logging |

### Rationale

**Observer failures should not compromise observed system.**

```
World Protocol (Core System)
    │
    └── submitting proposal is CRITICAL
        │
        ├── must complete for system integrity
        └── must not fail due to observer bug
        
Event Handler (External Observer)
    │
    └── logging/tracing is IMPORTANT but not CRITICAL
        │
        └── failure should not compromise system
```

**Analogy: Logging framework failure**

```java
// In logging frameworks, this is standard:
try {
    appender.append(event);
} catch (Exception e) {
    // Log to stderr, continue
    System.err.println("Appender failed: " + e);
}
// Application continues regardless
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Propagate exceptions | Observer bug breaks system |
| Silent swallow | Debugging impossible |
| Retry mechanism | Complexity; observer should be robust |

### Consequences

- Handler bugs don't break World
- Exceptions are logged (not silent)
- All handlers receive events (one failure doesn't stop others)
- Robust system behavior

---

## FDR-E010: Single Subscribe Method with Overloads

### Decision

One method name `subscribe` with **overloaded signatures**.

```typescript
interface ManifestoWorld {
  // Overload 1: All events
  subscribe(handler: WorldEventHandler): Unsubscribe;
  
  // Overload 2: Filtered events
  subscribe(types: WorldEventType[], handler: WorldEventHandler): Unsubscribe;
}
```

### Context

Multiple method names were considered:

```typescript
// Alternative A: Different names
world.subscribe(handler);          // All events
world.subscribeToTypes(types, h);  // Filtered

// Alternative B: Options object
world.subscribe({ types?, handler });

// Alternative C: Builder pattern
world.subscribe().to(types).handle(handler);
```

### Rationale

**Overloads are idiomatic TypeScript and minimize API surface.**

```typescript
// Clear and discoverable
world.subscribe(handler);                    // "I want everything"
world.subscribe(['proposal:decided'], handler); // "I want these"

// IDE shows both signatures
// No new method names to learn
// No options object ceremony
```

**TypeScript handles overloads well:**

```typescript
// Implementation
function subscribe(
  typesOrHandler: WorldEventType[] | WorldEventHandler,
  maybeHandler?: WorldEventHandler
): Unsubscribe {
  if (typeof typesOrHandler === 'function') {
    return subscribeAll(typesOrHandler);
  }
  return subscribeFiltered(typesOrHandler, maybeHandler!);
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Multiple method names | Larger API surface, less discoverable |
| Options object | Verbose for simple case |
| Builder pattern | Overkill; not idiomatic |

### Consequences

- Single method name: `subscribe`
- Two call signatures
- Clear intent from arguments
- Minimal API surface

---

## Summary Table

| FDR | Decision | Key Principle |
|-----|----------|---------------|
| E001 | Events are first-class | Observation is constitutional |
| E002 | Synchronous delivery | Deterministic traces |
| E003 | Subscribe over plugin | Composition without coupling |
| E004 | Granular event types | Consumers filter; can't add granularity |
| E005 | Causal ordering | State machine reasoning |
| E006 | Non-interference | Events observe, don't react |
| E007 | After snapshot required | Common case optimization |
| E008 | No source filtering | Simplicity over micro-optimization |
| E009 | Exception isolation | Observer failure ≠ system failure |
| E010 | Subscribe overloads | Minimal API surface |

---

## Cross-Reference: Related FDRs

### From World Protocol FDR

| World FDR | Relevance to Events |
|-----------|---------------------|
| FDR-W001 (Intent-level governance) | Events track Intent lifecycle |
| FDR-W008 (World immutability) | `world:created` event on immutable creation |
| FDR-W011 (Rejected → no World) | `proposal:decided` + rejected = no world event |
| FDR-W012 (Failure creates World) | `execution:failed` still triggers `world:created` |

### From Host Contract FDR

| Host FDR | Relevance to Events |
|----------|---------------------|
| FDR-H001 (Core-Host boundary) | Events reveal Host execution phases |
| FDR-H002 (Snapshot as sole channel) | `snapshot:changed` is the state event |
| FDR-H005 (Handlers never throw) | Same isolation principle for event handlers |

### From Necessity & Lab FDR

| Necessity FDR | Relevance to Events |
|---------------|---------------------|
| FDR-N010 (Pattern, not framework) | Events enable Lab without plugin system |

---

*End of World Protocol Event System FDR v1.0*
