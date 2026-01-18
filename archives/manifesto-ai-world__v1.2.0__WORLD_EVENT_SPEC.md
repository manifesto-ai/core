# World Protocol Event System Extension

> **Version:** 1.1 Extension  
> **Status:** Draft  
> **Purpose:** Define observable event stream for World Protocol

---

## Overview

This extension adds an **Event System** to World Protocol, enabling external observers to monitor all internal state transitions without modifying execution.

**Primary Consumer:** Lab (Necessity & Lab Spec)

---

## Event System

### Event Subscription Interface

```typescript
interface ManifestoWorld {
  // ... existing API ...
  
  /**
   * Subscribe to world events.
   * 
   * @param handler - Callback invoked for each event
   * @returns Unsubscribe function
   * 
   * Events are delivered synchronously in causal order.
   * Handler MUST NOT throw; exceptions are logged and ignored.
   * Handler MUST NOT modify world state.
   */
  subscribe(handler: WorldEventHandler): Unsubscribe;
  
  /**
   * Subscribe to specific event types.
   * 
   * @param types - Event types to subscribe to
   * @param handler - Callback invoked for matching events
   * @returns Unsubscribe function
   */
  subscribe(types: WorldEventType[], handler: WorldEventHandler): Unsubscribe;
}

type WorldEventHandler = (event: WorldEvent) => void;
type Unsubscribe = () => void;
```

### Event Types

```typescript
type WorldEventType =
  // Proposal lifecycle
  | 'proposal:submitted'
  | 'proposal:evaluating'
  | 'proposal:decided'
  
  // Execution lifecycle  
  | 'execution:started'
  | 'execution:computing'
  | 'execution:patches'
  | 'execution:effect'
  | 'execution:effect_result'
  | 'execution:completed'
  | 'execution:failed'
  
  // State lifecycle
  | 'snapshot:changed'
  
  // World lifecycle
  | 'world:created'
  | 'world:forked';

type WorldEvent =
  | ProposalSubmittedEvent
  | ProposalEvaluatingEvent
  | ProposalDecidedEvent
  | ExecutionStartedEvent
  | ExecutionComputingEvent
  | ExecutionPatchesEvent
  | ExecutionEffectEvent
  | ExecutionEffectResultEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | SnapshotChangedEvent
  | WorldCreatedEvent
  | WorldForkedEvent;
```

### Event Definitions

#### Proposal Lifecycle Events

```typescript
/**
 * Emitted when a proposal is submitted to the world.
 * This is the entry point for all state changes.
 */
type ProposalSubmittedEvent = {
  readonly type: 'proposal:submitted';
  readonly timestamp: number;
  readonly proposal: Proposal;
  readonly actor: ActorRef;
};

/**
 * Emitted when authority begins evaluating a proposal.
 * May not be emitted if authority decides synchronously.
 */
type ProposalEvaluatingEvent = {
  readonly type: 'proposal:evaluating';
  readonly timestamp: number;
  readonly proposalId: ProposalId;
  readonly authorityId: AuthorityId;
};

/**
 * Emitted when authority makes a decision.
 * This is a terminal event for the proposal's authority phase.
 */
type ProposalDecidedEvent = {
  readonly type: 'proposal:decided';
  readonly timestamp: number;
  readonly proposalId: ProposalId;
  readonly authorityId: AuthorityId;
  readonly decision: AuthorityDecision;
  readonly decisionRecord?: DecisionRecord; // Present for terminal decisions
};
```

#### Execution Lifecycle Events

```typescript
/**
 * Emitted when host begins executing an approved proposal.
 */
type ExecutionStartedEvent = {
  readonly type: 'execution:started';
  readonly timestamp: number;
  readonly proposalId: ProposalId;
  readonly intentId: string;
  readonly baseSnapshot: Snapshot;
};

/**
 * Emitted when await core.compute() is called.
 * May be emitted multiple times per execution (for effect continuations).
 */
type ExecutionComputingEvent = {
  readonly type: 'execution:computing';
  readonly timestamp: number;
  readonly intentId: string;
  readonly iteration: number; // 0 for initial, 1+ for effect continuations
};

/**
 * Emitted when patches are applied to snapshot.
 */
type ExecutionPatchesEvent = {
  readonly type: 'execution:patches';
  readonly timestamp: number;
  readonly intentId: string;
  readonly patches: Patch[];
  readonly source: 'compute' | 'effect';
};

/**
 * Emitted when an effect is about to be executed.
 */
type ExecutionEffectEvent = {
  readonly type: 'execution:effect';
  readonly timestamp: number;
  readonly intentId: string;
  readonly effectType: string;
  readonly effectParams: unknown;
};

/**
 * Emitted when an effect completes and returns patches.
 */
type ExecutionEffectResultEvent = {
  readonly type: 'execution:effect_result';
  readonly timestamp: number;
  readonly intentId: string;
  readonly effectType: string;
  readonly resultPatches: Patch[];
  readonly success: boolean;
  readonly error?: ErrorInfo;
};

/**
 * Emitted when execution completes successfully.
 */
type ExecutionCompletedEvent = {
  readonly type: 'execution:completed';
  readonly timestamp: number;
  readonly proposalId: ProposalId;
  readonly intentId: string;
  readonly finalSnapshot: Snapshot;
  readonly totalPatches: number;
  readonly totalEffects: number;
};

/**
 * Emitted when execution fails.
 */
type ExecutionFailedEvent = {
  readonly type: 'execution:failed';
  readonly timestamp: number;
  readonly proposalId: ProposalId;
  readonly intentId: string;
  readonly error: ErrorInfo;
  readonly partialSnapshot: Snapshot;
};
```

#### State Lifecycle Events

```typescript
/**
 * Emitted when snapshot transitions to a new state.
 * This is the canonical state change event.
 */
type SnapshotChangedEvent = {
  readonly type: 'snapshot:changed';
  readonly timestamp: number;
  readonly intentId: string;
  readonly before: {
    readonly snapshotHash: string;
    readonly snapshot?: Snapshot; // Optional, may be omitted for memory efficiency
  };
  readonly after: {
    readonly snapshotHash: string;
    readonly snapshot: Snapshot;
  };
  readonly cause: 'patches' | 'effect_result';
};
```

#### World Lifecycle Events

```typescript
/**
 * Emitted when a new world is created.
 */
type WorldCreatedEvent = {
  readonly type: 'world:created';
  readonly timestamp: number;
  readonly world: World;
  readonly proposalId: ProposalId;
  readonly parentWorldId: WorldId | null; // null for genesis
};

/**
 * Emitted when a world is forked (branching).
 */
type WorldForkedEvent = {
  readonly type: 'world:forked';
  readonly timestamp: number;
  readonly parentWorldId: WorldId;
  readonly childWorldId: WorldId;
  readonly proposalId: ProposalId;
};
```

### Event Ordering Guarantees

| Guarantee | Description |
|-----------|-------------|
| **Causal Order** | Events are delivered in causal order within a single proposal lifecycle |
| **Synchronous Delivery** | Events are delivered synchronously before the operation completes |
| **No Duplication** | Each event is delivered exactly once per subscriber |
| **No Loss** | Events are never silently dropped (unless handler throws) |

### Event Sequence per Proposal

```
proposal:submitted
       │
       ▼
proposal:evaluating (optional, if async)
       │
       ▼
proposal:decided
       │
       ├── decision: rejected ──► (end)
       │
       └── decision: approved
                │
                ▼
         execution:started
                │
                ▼
         execution:computing (iteration: 0)
                │
                ▼
         execution:patches
                │
                ├── (if has effects) ───────────────┐
                │                                    │
                │                          execution:effect
                │                                    │
                │                                    ▼
                │                          execution:effect_result
                │                                    │
                │                          execution:patches
                │                                    │
                │                          execution:computing (iteration: n)
                │                                    │
                │   ◄────────────────────────────────┘
                │
                ▼
         snapshot:changed
                │
                ├── (success) ──► execution:completed ──► world:created
                │
                └── (failure) ──► execution:failed ──► world:created
```

### Implementation Requirements

| Requirement | Description |
|-------------|-------------|
| EVT-R1 | World MUST emit all events defined in this spec |
| EVT-R2 | World MUST emit events in the specified order |
| EVT-R3 | World MUST support multiple simultaneous subscribers |
| EVT-R4 | World MUST NOT block on slow subscribers |
| EVT-R5 | World MUST handle subscriber exceptions gracefully |
| EVT-R6 | Unsubscribe MUST take effect immediately |
| EVT-R7 | Events MUST be emitted synchronously (before operation returns) |

### Subscriber Constraints

| Constraint | Description |
|------------|-------------|
| EVT-C1 | Handler MUST NOT modify world state |
| EVT-C2 | Handler MUST NOT call world methods that modify state |
| EVT-C3 | Handler SHOULD complete quickly (< 10ms) |
| EVT-C4 | Handler MAY perform async operations but MUST NOT await them |
| EVT-C5 | Handler exceptions are logged and do not affect world operation |

### Usage Example

```typescript
const world = createManifestoWorld({ schemaHash, host });

// Subscribe to all events
const unsubscribe = world.subscribe((event) => {
  console.log(`[${event.type}]`, event.timestamp);
});

// Subscribe to specific events
const unsubProposals = world.subscribe(
  ['proposal:submitted', 'proposal:decided'],
  (event) => {
    if (event.type === 'proposal:decided') {
      console.log(`Decision: ${event.decision.decision}`);
    }
  }
);

// Submit proposal - events are emitted synchronously
await world.submitProposal({ ... });
// By this point, all events for this proposal have been emitted

// Cleanup
unsubscribe();
unsubProposals();
```

### Lab Integration Example

```typescript
// Lab wraps world and subscribes to events
function createLab(options: LabOptions) {
  return {
    wrap(world: ManifestoWorld): LabWorld {
      const trace: LabTraceEvent[] = [];
      
      // Subscribe to all events for tracing
      world.subscribe((event) => {
        trace.push(mapWorldEventToTraceEvent(event));
        
        // Update projection if enabled
        if (options.projection?.enabled) {
          updateProjection(event);
        }
        
        // Check for HITL requirement
        if (event.type === 'proposal:decided' && event.decision.decision === 'pending') {
          handleHITLRequired(event);
        }
      });
      
      return createLabWorld(world, trace, options);
    }
  };
}
```

---

## Appendix: Event Type Reference

| Event | When Emitted | Key Data |
|-------|-------------|----------|
| `proposal:submitted` | Proposal enters system | Full Proposal |
| `proposal:evaluating` | Authority begins evaluation | proposalId, authorityId |
| `proposal:decided` | Authority makes decision | decision, decisionRecord |
| `execution:started` | Host begins execution | intentId, baseSnapshot |
| `execution:computing` | Core.compute() called | iteration number |
| `execution:patches` | Patches applied | patches array, source |
| `execution:effect` | Effect about to execute | effectType, params |
| `execution:effect_result` | Effect completed | resultPatches, success |
| `execution:completed` | Execution succeeded | finalSnapshot, stats |
| `execution:failed` | Execution failed | error, partialSnapshot |
| `snapshot:changed` | State transitioned | before/after snapshots |
| `world:created` | New world created | World, parentId |
| `world:forked` | World branched | parent/child ids |

---

*End of World Protocol Event System Extension v1.1*
