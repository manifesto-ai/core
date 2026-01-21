# Manifesto Architecture

> **Version:** 2.0  
> **Status:** Normative  
> **Last Updated:** 2025-01-17

---

## Overview

Manifesto is an AI architecture framework that creates **"minds"** for AI—not just intelligence, but consciousness, memory, relationships, and responsibility.

This document defines the **constitutional boundaries** between Manifesto's layers. It is the authoritative reference for architectural decisions.

---

## Design Philosophy

### Core Principles

1. **Separation of Concerns**
   - Each layer has exactly one primary responsibility
   - Layers communicate through well-defined interfaces
   - No layer reaches into another's internals
# Manifesto Architecture

> **Version:** 2.0  
> **Status:** Normative  
> **Last Updated:** 2025-01-17

---

## Overview

Manifesto is an AI architecture framework that creates **"minds"** for AI—not just intelligence, but consciousness, memory, relationships, and responsibility.

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
   - **App** owns process (how execution happens)

4. **Composition over Inheritance**
   - App assembles; it doesn't extend
   - Layers are composed, not inherited

---

## Layer Model

```
┌─────────────────────────────────────────────────────────────────┐
│                           App                                   │
│                   (Composition Root)                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 runtime/ (internal)                       │  │
│  │         Host ↔ World Integration                          │  │
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
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Translator                             │  │
│  │               (Semantic Bridge)                           │  │
│  │           NL → Intent, Projection                         │  │
│  └───────────────────────────────────────────────────────────┘  │
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
1. World **declares** HostExecutor interface; App **implements** it
2. World **seals results**; it does NOT interpret execution
3. World owns **governance events** (`proposal:*`, `world:*`, `execution:completed/failed`)
4. World does NOT own **telemetry events** (`execution:compute`, `execution:patches`, etc.)

---

### App (Composition Root)

> **One-liner:** Assembly layer that makes execution viable.

| Aspect | Definition |
|--------|------------|
| **Role** | Compose Host + World, implement policies, present to users |
| **Primary API** | Application-specific |
| **Owns** | Host↔World integration, execution telemetry, UI/session |
| **Does NOT Know** | Core computation internals, World constitution changes |

```typescript
// App's responsibilities
class AppHostExecutor implements HostExecutor {
  execute(...) { /* integrate Host, transform results */ }
}

host.onTrace((trace) => {
  // Transform TraceEvent → App telemetry events
  appEmitter.emit('execution:compute', ...);
});
```

**Constitutional Rules:**
1. App is the **only layer** that knows both Host and World
2. App owns **execution telemetry events** (derived from Host's TraceEvent)
3. App implements **HostExecutor** interface for World
4. App is the **evolution absorption layer** for Host changes

#### App Internal Structure (Recommended)

```
app/
  runtime/              # Host ↔ World integration
    host-executor.ts    # HostExecutor implementation
    trace-mapper.ts     # TraceEvent → telemetry events
    execution-key.ts    # ExecutionKey policy
  session/              # Session management
  ui/                   # User interface
  policy/               # Business policies
```

---

### Translator (Semantic Bridge)

> **One-liner:** Natural language to Intent transformation.

| Aspect | Definition |
|--------|------------|
| **Role** | NL → Intent compilation, Projection |
| **Primary API** | `translate()`, `project()` |
| **Owns** | MEL parsing, IR generation, semantic projection |
| **Does NOT Know** | Execution, governance, Host internals |

**Note:** Translator is orthogonal to Host-World integration. It can be added independently.

---

## Boundaries

### The "Does NOT Know" Matrix

| Layer | Does NOT Know |
|-------|---------------|
| **Core** | IO, execution loops, approval, governance, World, Host |
| **Host** | World, Proposal, Authority, governance, approval decisions |
| **World** | Host internal API, TraceEvent, dispatch options, execution micro-steps |
| **App** | Core computation internals, World constitutional rules |
| **Translator** | Execution, governance, Host internals, World internals |

### Dependency Direction

```
App → World → (HostExecutor interface)
App → Host
App → Translator
World → Core
Host → Core
Translator → Core (optional)
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

### App-Owned Events (Execution Telemetry)

| Event | Description |
|-------|-------------|
| `execution:started` | Execution began |
| `execution:compute` | Compute iteration |
| `execution:patches` | Patches generated |
| `execution:effect:dispatched` | Effect sent |
| `execution:effect:fulfilled` | Effect completed |

### The Rule

> **Results are World's; Process is App's.**

---

## Interface Contracts

### HostExecutor (World → App)

```typescript
// Defined by World, implemented by App
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

### TraceEvent (Host → App)

```typescript
// Defined by Host, consumed by App
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
  manifesto-ai-core/        # Core: Semantic computation
  manifesto-ai-host/        # Host: Execution engine
  manifesto-ai-world/       # World: Governance protocol
  manifesto-ai-translator/  # Translator: NL → Intent
  manifesto-ai-app/         # App: Composition root
```

### Dependency Graph

```
manifesto-ai-app
  ├── manifesto-ai-world
  │     └── manifesto-ai-core
  ├── manifesto-ai-host
  │     └── manifesto-ai-core
  └── manifesto-ai-translator
        └── manifesto-ai-core (optional)
```

---

## Evolution Strategy

### When Host Changes

1. App's `runtime/` module absorbs the change
2. HostExecutor implementation adapts
3. World remains unchanged

### When World Constitution Changes

1. World SPEC/FDR updated
2. App may need to adjust HostExecutor implementation
3. Host remains unchanged

### When Core Changes

1. Both Host and World may need updates
2. App adapts as needed
3. This is rare (Core is stable)

### Adding New Features

| Feature Type | Where to Add |
|--------------|--------------|
| New effect type | Host |
| New governance policy | World |
| New execution strategy | App (runtime/) |
| New semantic capability | Core |
| New NL capability | Translator |

---

## Rationale

### Why No Independent Bridge/Runtime Layer?

1. **Avoids artificial boundaries**
   - "Where does Runtime end, App begin?" becomes new debate

2. **Reduces package proliferation**
   - More packages ≠ better architecture

3. **Allows organic extraction**
   - If reuse patterns emerge, extract then

4. **App is natural composition root**
   - Already knows both Host and World
   - Already responsible for assembly

### Why World Doesn't Own Telemetry Events?

1. **World would need to know TraceEvent structure**
   - Couples World to Host internals

2. **Telemetry is operational, not constitutional**
   - "How execution happened" ≠ "what became history"

3. **App can evolve telemetry independently**
   - Add metrics, tracing, logging without touching World

---

## Compliance Checklist

An implementation is compliant with this architecture if:

- [ ] Core has no IO, no execution logic, no governance awareness
- [ ] Host has no World/Proposal/Authority awareness
- [ ] World has no Host internal API usage (only HostExecutor interface)
- [ ] World does not emit telemetry events (only governance events)
- [ ] App implements HostExecutor for World
- [ ] App transforms TraceEvent to telemetry events
- [ ] App is the only layer that imports both Host and World
- [ ] Translator is independent of execution and governance

---

## Summary

| Layer | One Word | Owns | Does NOT Know |
|-------|----------|------|---------------|
| Core | Truth | Semantics | Execution |
| Host | Engine | Execution | Governance |
| World | History | Governance | Host internals |
| App | Assembly | Integration | Constitutions |
| Translator | Language | Semantics | Execution |

---

## References

- [ADR-001: Layer Separation](./ADR-001-layer-separation.md)
- [World Protocol v2.0.0 SPEC](./manifesto-ai-world__v2_0_0__SPEC.md)
- [World Protocol v2.0.0 FDR](./manifesto-ai-world__v2_0_0__FDR.md)
- [Host Contract v2.0.1 SPEC](/mnt/project/host-SPEC-v2_0_1.md)
- [Host Contract v2.0.1 FDR](/mnt/project/host-FDR-v2_0_1.md)
- [Event-Loop Execution Model FDR](/mnt/project/event-loop-excution-model-fdr-v1_0.md)

---

*This document is the architectural constitution of Manifesto. Changes require ADR process.*
2. **"Does NOT Know" as Boundary**
   - What a layer **doesn't know** defines its boundary more clearly than what it does
   - Ignorance is a feature, not a bug

3. **Results vs Process**
   - **World** owns results (what becomes history)
   - **App** owns process (how execution happens)

4. **Composition over Inheritance**
   - App assembles; it doesn't extend
   - Layers are composed, not inherited

---

## Layer Model

```
┌─────────────────────────────────────────────────────────────────┐
│                           App                                   │
│                   (Composition Root)                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 runtime/ (internal)                       │  │
│  │         Host ↔ World Integration                          │  │
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
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Translator                             │  │
│  │               (Semantic Bridge)                           │  │
│  │           NL → Intent, Projection                         │  │
│  └───────────────────────────────────────────────────────────┘  │
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
1. World **declares** HostExecutor interface; App **implements** it
2. World **seals results**; it does NOT interpret execution
3. World owns **governance events** (`proposal:*`, `world:*`, `execution:completed/failed`)
4. World does NOT own **telemetry events** (`execution:compute`, `execution:patches`, etc.)

---

### App (Composition Root)

> **One-liner:** Assembly layer that makes execution viable.

| Aspect | Definition |
|--------|------------|
| **Role** | Compose Host + World, implement policies, present to users |
| **Primary API** | Application-specific |
| **Owns** | Host↔World integration, execution telemetry, UI/session |
| **Does NOT Know** | Core computation internals, World constitution changes |

```typescript
// App's responsibilities
class AppHostExecutor implements HostExecutor {
  execute(...) { /* integrate Host, transform results */ }
}

host.onTrace((trace) => {
  // Transform TraceEvent → App telemetry events
  appEmitter.emit('execution:compute', ...);
});
```

**Constitutional Rules:**
1. App is the **only layer** that knows both Host and World
2. App owns **execution telemetry events** (derived from Host's TraceEvent)
3. App implements **HostExecutor** interface for World
4. App is the **evolution absorption layer** for Host changes

#### App Internal Structure (Recommended)

```
app/
  runtime/              # Host ↔ World integration
    host-executor.ts    # HostExecutor implementation
    trace-mapper.ts     # TraceEvent → telemetry events
    execution-key.ts    # ExecutionKey policy
  session/              # Session management
  ui/                   # User interface
  policy/               # Business policies
```

---

### Translator (Semantic Bridge)

> **One-liner:** Natural language to Intent transformation.

| Aspect | Definition |
|--------|------------|
| **Role** | NL → Intent compilation, Projection |
| **Primary API** | `translate()`, `project()` |
| **Owns** | MEL parsing, IR generation, semantic projection |
| **Does NOT Know** | Execution, governance, Host internals |

**Note:** Translator is orthogonal to Host-World integration. It can be added independently.

---

## Boundaries

### The "Does NOT Know" Matrix

| Layer | Does NOT Know |
|-------|---------------|
| **Core** | IO, execution loops, approval, governance, World, Host |
| **Host** | World, Proposal, Authority, governance, approval decisions |
| **World** | Host internal API, TraceEvent, dispatch options, execution micro-steps |
| **App** | Core computation internals, World constitutional rules |
| **Translator** | Execution, governance, Host internals, World internals |

### Dependency Direction

```
App → World → (HostExecutor interface)
App → Host
App → Translator
World → Core
Host → Core
Translator → Core (optional)
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

### App-Owned Events (Execution Telemetry)

| Event | Description |
|-------|-------------|
| `execution:started` | Execution began |
| `execution:compute` | Compute iteration |
| `execution:patches` | Patches generated |
| `execution:effect:dispatched` | Effect sent |
| `execution:effect:fulfilled` | Effect completed |

### The Rule

> **Results are World's; Process is App's.**

---

## Interface Contracts

### HostExecutor (World → App)

```typescript
// Defined by World, implemented by App
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

### TraceEvent (Host → App)

```typescript
// Defined by Host, consumed by App
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
  manifesto-ai-core/        # Core: Semantic computation
  manifesto-ai-host/        # Host: Execution engine
  manifesto-ai-world/       # World: Governance protocol
  manifesto-ai-translator/  # Translator: NL → Intent
  manifesto-ai-app/         # App: Composition root
```

### Dependency Graph

```
manifesto-ai-app
  ├── manifesto-ai-world
  │     └── manifesto-ai-core
  ├── manifesto-ai-host
  │     └── manifesto-ai-core
  └── manifesto-ai-translator
        └── manifesto-ai-core (optional)
```

---

## Evolution Strategy

### When Host Changes

1. App's `runtime/` module absorbs the change
2. HostExecutor implementation adapts
3. World remains unchanged

### When World Constitution Changes

1. World SPEC/FDR updated
2. App may need to adjust HostExecutor implementation
3. Host remains unchanged

### When Core Changes

1. Both Host and World may need updates
2. App adapts as needed
3. This is rare (Core is stable)

### Adding New Features

| Feature Type | Where to Add |
|--------------|--------------|
| New effect type | Host |
| New governance policy | World |
| New execution strategy | App (runtime/) |
| New semantic capability | Core |
| New NL capability | Translator |

---

## Rationale

### Why No Independent Bridge/Runtime Layer?

1. **Avoids artificial boundaries**
   - "Where does Runtime end, App begin?" becomes new debate

2. **Reduces package proliferation**
   - More packages ≠ better architecture

3. **Allows organic extraction**
   - If reuse patterns emerge, extract then

4. **App is natural composition root**
   - Already knows both Host and World
   - Already responsible for assembly

### Why World Doesn't Own Telemetry Events?

1. **World would need to know TraceEvent structure**
   - Couples World to Host internals

2. **Telemetry is operational, not constitutional**
   - "How execution happened" ≠ "what became history"

3. **App can evolve telemetry independently**
   - Add metrics, tracing, logging without touching World

---

## Compliance Checklist

An implementation is compliant with this architecture if:

- [ ] Core has no IO, no execution logic, no governance awareness
- [ ] Host has no World/Proposal/Authority awareness
- [ ] World has no Host internal API usage (only HostExecutor interface)
- [ ] World does not emit telemetry events (only governance events)
- [ ] App implements HostExecutor for World
- [ ] App transforms TraceEvent to telemetry events
- [ ] App is the only layer that imports both Host and World
- [ ] Translator is independent of execution and governance

---

## Summary

| Layer | One Word | Owns | Does NOT Know |
|-------|----------|------|---------------|
| Core | Truth | Semantics | Execution |
| Host | Engine | Execution | Governance |
| World | History | Governance | Host internals |
| App | Assembly | Integration | Constitutions |
| Translator | Language | Semantics | Execution |

---

## References

- [ADR-001: Layer Separation](./ADR-001-layer-separation.md)
- [World Protocol v2.0.0 SPEC](./manifesto-ai-world__v2_0_0__SPEC.md)
- [World Protocol v2.0.0 FDR](./manifesto-ai-world__v2_0_0__FDR.md)
- [Host Contract v2.0.1 SPEC](/mnt/project/host-SPEC-v2_0_1.md)
- [Host Contract v2.0.1 FDR](/mnt/project/host-FDR-v2_0_1.md)
- [Event-Loop Execution Model FDR](/mnt/project/event-loop-excution-model-fdr-v1_0.md)

---

*This document is the architectural constitution of Manifesto. Changes require ADR process.*
