# @manifesto-ai/host

> **v2.0.2** — Event-loop execution runtime for Manifesto with snapshot ownership and deterministic context

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/host.svg)](https://www.npmjs.com/package/@manifesto-ai/host)

---

## What is Host?

Host is the **effect execution runtime** of Manifesto. It orchestrates the compute-effect-apply loop using an event-loop model with Mailbox + Runner + Job architecture.

In the Manifesto architecture:

```
World -> HOST -> Core
            |
   Executes effects, applies patches
   Runs the mailbox-based execution model
```

---

## What's New in v2.0.2

### v2.0.2 New Features

- **Snapshot Ownership Alignment (HOST-SNAP-1~4)**
  - Host uses Core's canonical Snapshot type
  - Host-owned state moves to `data.$host`
  - Snapshot field ownership invariants (INV-SNAP-1~7)

### v2.0.1 New Features

- **Context Determinism (CTX-1~5)**
  - `HostContext` frozen at job start — same `now` value throughout job execution
  - `randomSeed` derived from `intentId` for deterministic randomness

- **Compiler/Translator Decoupling (FDR-H024)**
  - Host no longer depends on `@manifesto-ai/compiler`
  - Host receives only concrete `Patch[]` values
  - Translator processing is now App layer responsibility

### v2.0.0 Breaking Changes

- **Mailbox + Runner + Job Execution Model**
  - `ExecutionMailbox`: Single-writer queue per ExecutionKey
  - Job types: `StartIntent`, `ContinueCompute`, `FulfillEffect`, `ApplyPatches`
  - Run-to-completion semantics (job handlers MUST NOT await)
  - Single-runner invariant with lost-wakeup prevention

---

## Installation

```bash
npm install @manifesto-ai/host @manifesto-ai/core
# or
pnpm add @manifesto-ai/host @manifesto-ai/core
```

---

## Quick Example

```typescript
import { ManifestoHost, createIntent, type DomainSchema } from "@manifesto-ai/host";

// 1. Define schema
const schema: DomainSchema = {
  id: "example:counter",
  version: "1.0.0",
  hash: "example-hash",
  state: {
    count: { type: "number", default: 0 },
  },
  actions: {
    increment: {
      flow: {
        kind: "patch",
        op: "set",
        path: "count",
        value: { kind: "add", left: { kind: "get", path: "count" }, right: 1 },
      },
    },
  },
};

// 2. Create host
const host = new ManifestoHost(schema, {
  initialData: { count: 0 },
});

// 3. Register effect handlers
host.registerEffect("api.fetch", async (_type, params, context) => {
  const response = await fetch(params.url);
  const data = await response.json();
  return [{ op: "set", path: params.targetPath, value: data }];
});

// 4. Dispatch intent
const intent = createIntent("increment", "intent-1");
const result = await host.dispatch(intent);

console.log(result.status);        // -> "complete"
console.log(result.snapshot.data); // -> { count: 1 }
```

---

## Execution Model (v2.0)

Host uses an **event-loop execution model** with three key components:

### 1. Mailbox

Per-`ExecutionKey` queue that serializes all state mutations:

```typescript
interface ExecutionMailbox {
  readonly key: ExecutionKey;
  enqueue(job: Job): void;
  dequeue(): Job | undefined;
  isEmpty(): boolean;
}
```

### 2. Runner

Single-runner processes the mailbox with lost-wakeup prevention:

```typescript
// Only ONE runner per ExecutionKey at any time
// Runner re-checks mailbox before releasing guard
await processMailbox(ctx, runnerState);
```

### 3. Jobs

Four job types for different operations:

| Job Type | Purpose |
|----------|---------|
| `StartIntent` | Begin processing a new intent |
| `ContinueCompute` | Resume after effect fulfillment |
| `FulfillEffect` | Apply effect results and clear requirement |
| `ApplyPatches` | Apply patches from direct submission |

---

## Context Determinism (v2.0.1)

Host guarantees deterministic context per job:

```typescript
// Context is frozen at job start
const frozenContext: HostContext = {
  now: Date.now(),           // Captured ONCE
  randomSeed: job.intentId,  // Deterministic from intentId
  env: {},
};

// All Core operations use the same frozen context
Core.compute(schema, snapshot, intent, frozenContext);
Core.apply(schema, snapshot, patches, frozenContext);
```

**Benefits:**
- Same input -> same output (determinism preserved)
- Trace replay produces identical results
- `f(snapshot) = snapshot'` philosophy maintained

---

## API Reference

### Main Exports

```typescript
// Host class
class ManifestoHost {
  constructor(schema: DomainSchema, options?: HostOptions);

  // Effect handlers
  registerEffect(type: string, handler: EffectHandler, options?: EffectHandlerOptions): void;
  unregisterEffect(type: string): boolean;
  hasEffect(type: string): boolean;
  getEffectTypes(): string[];

  // Dispatch
  dispatch(intent: Intent): Promise<HostResult>;

  // Snapshot access
  getSnapshot(): Snapshot | null;
  getSchema(): DomainSchema;
  reset(initialData: unknown): void;
}

// Factory function
function createHost(schema: DomainSchema, options?: HostOptions): ManifestoHost;
```

### Types

```typescript
interface HostOptions {
  maxIterations?: number;     // Default: 100
  initialData?: unknown;
  runtime?: Runtime;          // For deterministic time/scheduling
  env?: Record<string, unknown>;
  onTrace?: (event: TraceEvent) => void;
  disableAutoEffect?: boolean; // For HCTS testing
}

interface HostResult {
  status: "complete" | "pending" | "error";
  snapshot: Snapshot;
  traces: TraceGraph[];
  error?: HostError;
}

// Effect handler signature
type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
) => Promise<Patch[]>;
```

### Execution Model Types

```typescript
// Opaque execution identifier
type ExecutionKey = string;

// Runtime abstraction for determinism
interface Runtime {
  now(): number;
  randomSeed(): string;
}

// Context provider
interface HostContextProvider {
  createFrozenContext(intentId: string): HostContext;
}
```

---

## Effect Handler Contract

Effect handlers MUST:
1. Return `Patch[]` (never throw)
2. Express failures as patches to error state
3. Be pure IO adapters (no domain logic)

```typescript
// ✅ CORRECT: Errors as patches
host.registerEffect("api.get", async (type, params) => {
  try {
    const response = await fetch(params.url);
    if (!response.ok) {
      return [{ op: "set", path: "error", value: `HTTP ${response.status}` }];
    }
    const data = await response.json();
    return [
      { op: "set", path: params.target, value: data },
      { op: "set", path: "error", value: null },
    ];
  } catch (e) {
    return [{ op: "set", path: "error", value: e.message }];
  }
});

// ❌ WRONG: Throwing exceptions
host.registerEffect("api.get", async (type, params) => {
  const response = await fetch(params.url);
  if (!response.ok) throw new Error("Failed"); // WRONG!
  return [];
});
```

---

## Relationship with Other Packages

```
App -> HOST (v2.0.2) -> Core
```

| Relationship | Package | How |
|--------------|---------|-----|
| Depends on | `@manifesto-ai/core` | Uses compute() and apply() |
| Used by | `@manifesto-ai/world` | World uses Host to execute |

---

## When to Use Host Directly

**Most users don't need to use Host directly.**

Use Host directly when:
- Building a custom runtime without World governance
- Testing effect handlers in isolation
- Building CLI tools or scripts
- Implementing custom execution policies

For typical usage with governance, see [`@manifesto-ai/world`](../world/).

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](./docs/GUIDE.md) | Step-by-step usage guide |
| [MIGRATION.md](./docs/MIGRATION.md) | v1.x -> v2.0.x migration guide |
| [host-SPEC-v2.0.2.md](./docs/host-SPEC-v2.0.2.md) | Complete specification |
| [host-FDR-v2.0.2.md](./docs/host-FDR-v2.0.2.md) | Design rationale |
| [VERSION-INDEX.md](./docs/VERSION-INDEX.md) | Version history |

---

## Examples

See the [`examples/`](./examples/) directory for runnable examples:

- [`basic-counter.ts`](./examples/basic-counter.ts) — Basic ManifestoHost usage
- [`effect-handling.ts`](./examples/effect-handling.ts) — Effect handler registration and execution
- [`determinism.ts`](./examples/determinism.ts) — Context determinism verification

---

## License

[MIT](../../LICENSE)
