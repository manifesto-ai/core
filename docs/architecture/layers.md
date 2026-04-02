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
| **Primary API** | `createHost()`, `dispatch()`, `registerEffect()` |
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

### Governed Composition

> **One-liner:** Governed composition layer that determines what becomes legitimate history.

| Aspect | Definition |
|--------|------------|
| **Role** | Decorator-owned legitimacy + continuity over the same SDK runtime |
| **Primary API** | `withLineage()` and `withGovernance()` before `activate()` |
| **Owns** | Proposal legitimacy, seal-aware publication, restore, branch/head state, decision visibility |
| **Does NOT Know** | Host internal API, TraceEvent structure, execution micro-steps |

```typescript
// Governed composition is explicit.
// No top-level facade package owns runtime assembly anymore.
```

**Constitutional Rules:**
1. Governance and Lineage compose over SDK; they do not replace Host/Core boundaries
2. Governed composition seals results; it does not interpret Host micro-steps
3. The governed path owns legitimacy and continuity, not a facade-owned execution backdoor
4. Governed decorators do not own execution telemetry (`execution:compute`, `execution:patches`, etc.)

---

### SDK (Composition Layer)

> **One-liner:** Assembly layer that makes execution viable.

| Aspect | Definition |
|--------|------------|
| **Role** | Compose the direct-dispatch runtime, implement policies, present public APIs |
| **Primary API** | `createManifesto()`, `activate()`, `createIntent()`, `dispatchAsync()` |
| **Owns** | Host integration, execution telemetry, direct-dispatch application runtime |
| **Does NOT Know** | Core computation internals, governed composition internals |

```typescript
// SDK responsibilities
host.onTrace((trace) => {
  // Transform TraceEvent → SDK telemetry events
  sdkEmitter.emit('execution:compute', ...);
});
```

**Constitutional Rules:**
1. SDK is the canonical direct-dispatch application entry
2. SDK owns **execution telemetry events** (derived from Host's TraceEvent)
3. SDK may re-export selected governed world factories and types, but it is not the full governed protocol surface
4. SDK is the **evolution absorption layer** for Host changes in the direct-dispatch path

---

## Boundaries

### The "Does NOT Know" Matrix

| Layer | Does NOT Know |
|-------|---------------|
| **Core** | IO, execution loops, approval, governance, World, Host |
| **Host** | World, Proposal, Authority, governance, approval decisions |
| **World** | Host internal API, TraceEvent, dispatch options, execution micro-steps |
| **SDK** | Core computation internals, governed composition internals |

### Dependency Direction

```
Application → SDK → Host
Application → World → Governance + Lineage + Host
SDK → Host
World → Core
Host → Core
```

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
@manifesto-ai/governance
  └── @manifesto-ai/lineage
        └── @manifesto-ai/sdk
              ├── @manifesto-ai/host
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
