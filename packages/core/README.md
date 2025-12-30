# @manifesto-ai/core

> **Core** is the pure semantic calculator of Manifesto. It computes state transitions deterministically with no side effects.

---

## What is Core?

Core is responsible for evaluating domain semantics. Given a schema, snapshot, and intent, it computes what patches and effects should result—but never executes them.

In the Manifesto architecture:

```
Host ──→ CORE ──→ ComputeResult
           │
    Computes patches & effects
    (pure, no IO, deterministic)
```

---

## What Core Does

| Responsibility | Description |
|----------------|-------------|
| Compute state transitions | Given (schema, snapshot, intent), produce patches and effects |
| Apply patches | Transform snapshots by applying patch operations |
| Validate schemas | Check DomainSchema structure for correctness |
| Explain values | Trace why a computed value has its current result |

---

## What Core Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Execute effects | Host |
| Perform IO (network, filesystem) | Host |
| Persist snapshots | Host |
| Govern authority/proposals | World |
| Handle UI bindings | Bridge / React |

---

## Installation

```bash
npm install @manifesto-ai/core
# or
pnpm add @manifesto-ai/core
```

---

## Quick Example

```typescript
import { createCore, createSnapshot, createIntent } from "@manifesto-ai/core";
import type { DomainSchema } from "@manifesto-ai/core";

// Create core instance
const core = createCore();

// Define a simple schema (usually from @manifesto-ai/builder)
const schema: DomainSchema = {
  version: "1.0.0",
  state: {
    count: { type: "number", default: 0 },
  },
  actions: {
    increment: {
      flow: {
        kind: "patch",
        op: "set",
        path: "/data/count",
        value: { kind: "add", left: { kind: "get", path: "/data/count" }, right: 1 },
      },
    },
  },
};

// Create initial snapshot
const snapshot = createSnapshot(schema);

// Create intent
const intent = createIntent("increment");

// Compute result (pure, deterministic)
const result = await core.compute(schema, snapshot, intent);

console.log(result.status); // → "completed"
console.log(result.snapshot.data.count); // → 1
```

> See [GUIDE.md](../../docs/packages/core/GUIDE.md) for the full tutorial.

---

## Core API

### Main Exports

```typescript
// Factory
function createCore(): ManifestoCore;

// Core interface
interface ManifestoCore {
  compute(schema, snapshot, intent): Promise<ComputeResult>;
  apply(schema, snapshot, patches): Snapshot;
  validate(schema): ValidationResult;
  explain(schema, snapshot, path): ExplainResult;
}

// Key types
type DomainSchema = { version, state, computed?, actions?, flows?, meta? };
type Snapshot = { data, computed, system, input, meta };
type Intent = { type, input?, intentId };
type Patch = { op: "set" | "unset" | "merge", path, value? };
type ComputeResult = { status, snapshot, patches, requirements, trace };
```

> See [SPEC.md](../../docs/packages/core/SPEC.md) for complete API reference.

---

## Core Concepts

### Snapshot as Sole Medium

All communication between Core and Host happens through Snapshot. There is no hidden state, no suspended context, no continuation.

### Deterministic Computation

Given the same (schema, snapshot, intent), Core always produces the same result. This enables:
- Reliable testing without mocks
- Time-travel debugging
- Reproducible bug reports

### Effects as Declarations

When an action needs IO (API call, timer, etc.), Core doesn't execute it. Instead, it records an Effect as a Requirement in the snapshot. Host reads these and executes them.

---

## Relationship with Other Packages

```
┌─────────────┐
│    Host     │ ← Uses Core to compute
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    CORE     │
└─────────────┘
       ▲
       │
┌─────────────┐
│   Builder   │ ← Produces DomainSchema for Core
└─────────────┘
```

| Relationship | Package | How |
|--------------|---------|-----|
| Used by | `@manifesto-ai/host` | Host calls compute() and apply() |
| Schema from | `@manifesto-ai/builder` | Builder produces DomainSchema |

---

## When to Use Core Directly

**Most users don't need to use Core directly.**

Use Core directly when:
- Building a custom Host implementation
- Testing domain logic in isolation
- Building developer tools (debuggers, visualizers)

For typical usage, see [`@manifesto-ai/react`](../react/) or [`@manifesto-ai/host`](../host/).

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](../../docs/packages/core/GUIDE.md) | Step-by-step usage guide |
| [SPEC.md](../../docs/packages/core/SPEC.md) | Complete specification |
| [FDR.md](../../docs/packages/core/FDR.md) | Design rationale |

---

## License

[MIT](../../LICENSE)
