# Architecture

> **Version:** 2.1
> **Status:** Normative
> **Last Updated:** 2026-03-11

---

## Overview

Manifesto is a semantic layer for deterministic domain state. It separates pure computation from effect execution and governance, enabling full traceability, reproducibility, and accountability for every state transition.

This document defines the **constitutional boundaries** between Manifesto's layers. It is the authoritative reference for architectural decisions.

---

## Design Philosophy

### Core Principles

1. **Separation of Concerns**
   - Each layer has exactly one primary responsibility
   - Layers communicate through well-defined interfaces
   - No layer reaches into another's internals

2. **"Does NOT Know" as Boundary**
   - What a layer **doesn't know** defines its boundary more clearly than what it does
   - Ignorance is a feature, not a bug

3. **Results vs Process**
   - **World** owns results (what becomes history)
   - **SDK** owns process (how execution happens)

4. **Composition over Inheritance**
   - SDK assembles; it doesn't extend
   - Layers are composed, not inherited

---

## Layer Model

```
┌─────────────────────────────────────────────────────────────────┐
│                           SDK                                   │
│                   (Composition Root)                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Host ↔ World Integration                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                   │
│              ┌──────────────┴──────────────┐                    │
│              ▼                              ▼                   │
│  ┌─────────────────────┐      ┌─────────────────────────────┐  │
│  │       World         │      │          Host               │  │
│  │   (Governance)      │      │       (Execution)           │  │
│  │                     │      │                             │  │
│  │  ┌───────────────┐  │      │  ┌───────────────────────┐  │  │
│  │  │     Core      │  │      │  │        Core           │  │  │
│  │  │  (Semantics)  │  │      │  │     (Semantics)       │  │  │
│  │  └───────────────┘  │      │  └───────────────────────┘  │  │
│  └─────────────────────┘      └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer Definitions

### Core

> **One-liner:** Pure semantic computation.

| Aspect | Definition |
|--------|------------|
| **Role** | Compute meaning from state + intent |
| **Primary API** | `compute()`, `apply()` |
| **Owns** | Snapshot structure, semantic truth |
| **Does NOT Know** | IO, execution, approval, governance, World |

```typescript
// Core's world view
type Snapshot = { data, computed, system, meta, input? };
function compute(snapshot: Snapshot, intent: Intent): ComputeResult;
function apply(snapshot: Snapshot, patches: Patch[]): Snapshot;
```

**Constitutional Rule:**
> Core MUST be pure. Given the same input, Core MUST produce the same output, always.

---

### Host

> **One-liner:** Execution engine that converges intents to terminal state.

| Aspect | Definition |
|--------|------------|
| **Role** | Execute effects, apply patches, manage re-entry |
| **Primary API** | `dispatch()`, `onTrace()` |
| **Owns** | ExecutionKey mailbox, job lifecycle, effect execution |
| **Does NOT Know** | World, Proposal, Authority, governance |

```typescript
// Host's world view
// ExecutionKey is derived internally by Host and opaque to callers.
dispatch(intent: Intent): Promise<HostResult>;
onTrace(handler: (event: TraceEvent) => void): Unsubscribe;
```

**Constitutional Rules:**
1. Host treats ExecutionKey as **opaque** (no semantic interpretation)
2. Host guarantees **run-to-completion** per job
3. Host provides **onTrace** for observation (not callbacks for control)

---

### World

> **One-liner:** Governance layer that determines what becomes history.

| Aspect | Definition |
|--------|------------|
| **Role** | Proposal lifecycle, decision records, World sealing, lineage |
| **Primary API** | `submitProposal()`, `decide()`, `createWorld()` |
| **Owns** | Actor/Authority/Proposal, WorldId computation, DecisionRecord, Lineage |
| **Does NOT Know** | Host internal API, TraceEvent structure, execution micro-steps |

```typescript
// World's world view
interface HostExecutor {
  execute(key, baseSnapshot, intent, opts?): Promise<HostExecutionResult>;
}

// World defines interface, does NOT implement
// World receives results, does NOT observe process
```

**Constitutional Rules:**
1. World **declares** HostExecutor interface; SDK **implements** it
2. World **seals results**; it does NOT interpret execution
3. World owns **governance events** (`proposal:*`, `world:*`, `execution:completed/failed`)
4. World does NOT own **telemetry events** (`execution:compute`, `execution:patches`, etc.)

---

### SDK (Composition Layer)

> **One-liner:** Assembly layer that makes execution viable.

| Aspect | Definition |
|--------|------------|
| **Role** | Compose Host + World, implement policies, present public APIs |
| **Primary API** | `createManifesto()`, `dispatch()`, `subscribe()` |
| **Owns** | Host↔World integration, execution telemetry, UI/session |
| **Does NOT Know** | Core computation internals, World constitution changes |

```typescript
// SDK responsibilities
class SdkHostExecutor implements HostExecutor {
  execute(...) { /* integrate Host, transform results */ }
}

host.onTrace((trace) => {
  // Transform TraceEvent → SDK telemetry events
  sdkEmitter.emit('execution:compute', ...);
});
```

**Constitutional Rules:**
1. SDK is the **only layer** that knows both Host and World
2. SDK owns **execution telemetry events** (derived from Host's TraceEvent)
3. SDK implements **HostExecutor** interface for World
4. SDK is the **evolution absorption layer** for Host changes

---

## Boundaries

### The "Does NOT Know" Matrix

| Layer | Does NOT Know |
|-------|---------------|
| **Core** | IO, execution loops, approval, governance, World, Host |
| **Host** | World, Proposal, Authority, governance, approval decisions |
| **World** | Host internal API, TraceEvent, dispatch options, execution micro-steps |
| **SDK** | Core computation internals, World constitutional rules |

### Dependency Direction

```
SDK → World → (HostExecutor interface)
SDK → Host
World → Core
Host → Core
```

**Key Insight:** World depends on HostExecutor **interface**, not Host **implementation**.

---

## Event Ownership

### World-Owned Events (Governance Results)

| Event | Description |
|-------|-------------|
| `proposal:submitted` | Proposal entered system |
| `proposal:evaluating` | Authority deliberating |
| `proposal:decided` | Authority made decision |
| `proposal:superseded` | Proposal dropped (epoch-based) |
| `execution:completed` | Execution succeeded, World created |
| `execution:failed` | Execution failed, World created |
| `world:created` | New World sealed |
| `world:forked` | Branch created |

### SDK-Owned Events (Execution Telemetry)

| Event | Description |
|-------|-------------|
| `execution:started` | Execution began |
| `execution:compute` | Compute iteration |
| `execution:patches` | Patches generated |
| `execution:effect:dispatched` | Effect sent |
| `execution:effect:fulfilled` | Effect completed |

### The Rule

> **Results are World's; Process is SDK's.**

---

## Interface Contracts

### HostExecutor (World → SDK)

```typescript
// Defined by World, implemented by SDK
interface HostExecutor {
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: HostExecutionOptions
  ): Promise<HostExecutionResult>;
}

type HostExecutionResult = {
  readonly outcome: 'completed' | 'failed';
  readonly terminalSnapshot: Snapshot;
  readonly traceRef?: ArtifactRef;
  readonly error?: ExecutionError;
};
```

### TraceEvent (Host → SDK)

```typescript
// Defined by Host, consumed by SDK
type TraceEvent =
  | { type: 'compute:start'; ... }
  | { type: 'compute:end'; ... }
  | { type: 'effect:dispatched'; ... }
  | { type: 'effect:fulfilled'; ... }
  | { type: 'apply:patches'; ... }
  // ...
```

---

## Package Structure

```
packages/
  sdk/         # SDK: Public entrypoint & composition layer
  core/        # Core: Semantic computation
  host/        # Host: Execution engine
  world/       # World: Governance protocol
  compiler/    # MEL → DomainSchema
  codegen/     # DomainSchema → TypeScript/Zod
```

### Dependency Graph

```
@manifesto-ai/sdk
  ├── @manifesto-ai/host
  │     └── @manifesto-ai/core
  ├── @manifesto-ai/world
  │     └── @manifesto-ai/core
  └── @manifesto-ai/compiler
        └── @manifesto-ai/core
```

---

## Evolution Strategy

### When Host Changes

1. SDK absorbs the change
2. HostExecutor implementation adapts
3. World remains unchanged

### When World Constitution Changes

1. World SPEC/FDR updated
2. SDK may need to adjust HostExecutor implementation
3. Host remains unchanged

### When Core Changes

1. Both Host and World may need updates
2. SDK adapts as needed
3. This is rare (Core is stable)

### Adding New Features

| Feature Type | Where to Add |
|--------------|--------------|
| New effect type | Host |
| New governance policy | World |
| New execution strategy | SDK |
| New semantic capability | Core |

---

## Compliance Checklist

An implementation is compliant with this architecture if:

- [ ] Core has no IO, no execution logic, no governance awareness
- [ ] Host has no World/Proposal/Authority awareness
- [ ] World has no Host internal API usage (only HostExecutor interface)
- [ ] World does not emit telemetry events (only governance events)
- [ ] SDK implements HostExecutor for World
- [ ] SDK transforms TraceEvent to telemetry events
- [ ] SDK is the only layer that imports both Host and World

---

## Summary

| Layer | One Word | Owns | Does NOT Know |
|-------|----------|------|---------------|
| Core | Truth | Semantics | Execution |
| Host | Engine | Execution | Governance |
| World | History | Governance | Host internals |
| SDK | Assembly | Integration | Constitutions |

---

## Related Documents

- [ADR-001: Layer Separation](/internals/adr/001-layer-separation) - Design decision rationale
- [ADR-010: Protocol-First SDK Reconstruction](/internals/adr/010-major-hard-cut) - App/Runtime retirement
- [Specifications](/internals/spec/) - Package specifications (Core, Host, World, etc.)

---

*This document is the architectural constitution of Manifesto. Changes require ADR process.*
