# @manifesto-ai/runtime v0.1.2

> Internal orchestration engine. Not for direct consumption — use `@manifesto-ai/sdk`.

## Role

Runtime sits between SDK and the protocol layers (Core + Host + World).
It executes the action lifecycle through a 5-stage pipeline and manages all shared types, errors, policies, memory, branches, and subscriptions.

## Dependencies

- `@manifesto-ai/core`, `@manifesto-ai/host`, `@manifesto-ai/world`, `@manifesto-ai/compiler`

## Execution Pipeline

Every action passes through five stages:

| Stage | Responsibility |
|-------|---------------|
| **Prepare** | Validate action type, create Proposal |
| **Authorize** | Derive ExecutionKey, get Authority approval, validate scope |
| **Execute** | Restore snapshot, recall memory, freeze context, execute via Host |
| **Persist** | Seal World, store delta, advance branch head, notify subscribers |
| **Finalize** | Create ActionResult, emit hooks, clean up |

## Key Subsystems

### Policy Service

| Policy | ExecutionKey | Behavior |
|--------|-------------|----------|
| `defaultPolicy` | `proposal:{id}` | Maximum parallelism |
| `actorSerialPolicy` | `actor:{actorId}` | Per-actor serialization |
| `globalSerialPolicy` | `global` | Full serialization |
| `branchSerialPolicy` | `branch:{branchId}` | Per-branch serialization |

### Memory Hub

- Provider fan-out for ingest and recall
- Context freezing (RT-MEM-1) for deterministic replay
- Graceful degradation on memory failure

### Branch Manager

- Branch creation and switching
- Schema-changing fork with compatibility validation
- Head advancement only on completed execution

### System Runtime

Separate runtime for `system.*` meta-operations with independent World lineage.

## Exported Types

Runtime defines all shared types used across the stack:

```typescript
// Core types
AppStatus, RuntimeKind, ActionPhase, ActionResult, AppState

// Action types
ActionHandle, ActionUpdate, ExecutionStats

// Configuration
AppConfig, Effects, AppEffectContext, EffectHandler

// Storage
WorldStore, WorldDelta, Branch, WorldId

// Policy
PolicyService, ExecutionKey, ApprovedScope, AuthorityDecision

// Memory
MemoryProvider, MemoryStore, RecallRequest, RecallResult

// Hooks
AppHooks, AppRef, HookContext
```

## Error Types

25 error classes extending `ManifestoAppError`:

| Category | Errors |
|----------|--------|
| Lifecycle | `AppNotReadyError`, `AppDisposedError` |
| Action | `ActionRejectedError`, `ActionFailedError`, `ActionTimeoutError`, `ActionNotFoundError` |
| Hook | `HookMutationError` |
| Effects | `ReservedEffectTypeError` |
| System | `SystemActionDisabledError`, `SystemActionRoutingError` |
| Memory | `MemoryDisabledError` |
| Branch/World | `BranchNotFoundError`, `WorldNotFoundError`, `WorldSchemaHashMismatchError` |

## WorldStore

```typescript
import { createInMemoryWorldStore } from '@manifesto-ai/runtime';
const store = createInMemoryWorldStore();
```

Custom implementations must satisfy the `WorldStore` interface.
