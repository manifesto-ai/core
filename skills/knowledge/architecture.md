# Manifesto Architecture

> Source: Core SPEC v2.0.1, Core FDR v2.0.0, Host SPEC v2.0.2, World SPEC v2.0.3
> Last synced: 2026-02-09

## Rules

> **R1**: Core computes, Host executes. These concerns never mix. [FDR-001]
> **R2**: Snapshot is the only medium of communication. If it's not in Snapshot, it doesn't exist. [FDR-002]
> **R3**: There is no suspended execution context. All continuity is expressed through Snapshot. [FDR-003]
> **R4**: Effects are declarations, not executions. Core declares; Host fulfills. [FDR-004]
> **R5**: If you need a value, read it from Snapshot. There is no other place. [FDR-007]

## The Constitution (7 Principles)

```
1. Core is a calculator, not an executor.
2. Schema is the single source of truth.
3. Snapshot is the only medium of communication.
4. Effects are declarations, not executions.
5. Errors are values, not exceptions.
6. Everything is explainable.
7. There is no suspended execution context.
```

## The Fundamental Equation

```
compute(schema, snapshot, intent, context) → (snapshot', requirements[], trace)
```

- **Pure**: Same input MUST always produce same output
- **Total**: MUST always return a result (never throws)
- **Traceable**: Every step MUST be recorded
- If `requirements` is empty → computation complete
- If `requirements` is non-empty → Host fulfills them, then calls `compute()` again

## Data Flow

```
Actor submits Intent
      ↓
World Protocol (Proposal + Authority)
      ↓
Host (compute loop + effect execution)
      ↓
Core (pure computation)
      ↓
New Snapshot (via patches)
      ↓
New World (immutable)
```

Information flows ONLY through Snapshot. No other channels exist.

## Package Sovereignty

| Package | Responsibility | MUST NOT |
|---------|---------------|----------|
| **Core** | Pure computation, expression evaluation, flow interpretation, patch generation, trace | IO, time, execution, know about Host/World |
| **Host** | Effect execution, patch application, compute loop, requirement fulfillment | Make decisions, interpret semantics, suppress effects |
| **World** | Proposal management, authority evaluation, decision recording, lineage | Execute effects, apply patches, compute transitions |
| **App** | Composition root — wires Core + Host + World together | Contain domain logic |

## Forbidden Import Matrix

| Package | MUST NOT Import |
|---------|----------------|
| core | host, world |
| host | world governance |
| world | host internals, core compute |
| app | core internals, host internals, world internals |

## Snapshot Structure

```typescript
type Snapshot = {
  data: TData;                    // Domain state (+ platform namespaces $host, $mel)
  computed: Record<string, unknown>; // Derived values (always recalculated)
  system: {
    status: 'idle' | 'computing' | 'pending' | 'error';
    lastError: ErrorValue | null;
    errors: readonly ErrorValue[];
    pendingRequirements: readonly Requirement[];
    currentAction: string | null;
  };
  input: unknown;                 // Transient action input
  meta: {
    version: number;              // Monotonically increasing
    timestamp: number;
    randomSeed: string;
    schemaHash: string;
  };
};
```

## Platform Namespaces

- `$host` — Host-owned internal state (intent slots, execution context). Excluded from hash.
- `$mel` — Compiler-owned guard state (`$mel.guards.*`). Excluded from hash.
- `$system.*` — System values (uuid, time.now). Lowered to effects by compiler.
- Domain schemas MUST NOT define `$`-prefixed fields.

## Computation Cycle

```
Host calls compute(schema, snapshot, intent, context)
  → Core evaluates Flow until:
    - Flow completes (requirements=[]) → DONE
    - Effect encountered (requirements=[...]) → Host executes effects, applies patches, calls compute() AGAIN
    - Error occurs → error recorded in Snapshot
```

Each `compute()` is complete and independent. There is no "resume".

## Antipatterns

### Intelligent Host
```typescript
// FORBIDDEN — Host making decisions
if (shouldSkipEffect(req)) { return []; }

// Host MUST execute or report failure, never decide
```

### Value Passing Outside Snapshot
```typescript
// FORBIDDEN
const result = await executeEffect();
core.compute(schema, snapshot, { ...intent, result });

// CORRECT — Effect returns patches → Host applies → Core reads from Snapshot
```

### Execution-Aware Core
```typescript
// FORBIDDEN — Core cannot know about execution
if (effectExecutionSucceeded) { ... }

// CORRECT — Core reads state
if (snapshot.data.syncStatus === 'success') { ... }
```

## Why

Separation of concerns enables:
- **Determinism**: Core testable without mocks (same input → same output)
- **Auditability**: World tracks all governance decisions with lineage
- **Portability**: Host swappable per environment (browser/server/edge/WASM)
- **Reproducibility**: Snapshot serialization enables time-travel debugging

## Cross-References

- MEL syntax: @knowledge/mel-patterns.md
- Effect handlers: @knowledge/effect-patterns.md
- Patch operations: @knowledge/patch-rules.md
