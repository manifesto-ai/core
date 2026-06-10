# @manifesto-ai/host

> Event-loop execution runtime for Manifesto with snapshot ownership and deterministic context

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/host.svg)](https://www.npmjs.com/package/@manifesto-ai/host)

> **Current Contract Note:** The current public package contract is documented in [docs/host-SPEC.md](docs/host-SPEC.md) through the v5-aligned Host surface. Host-facing Snapshot references use `snapshot.state` for domain state and `snapshot.namespaces.host` for Host-owned operational state; accumulated `system.errors` is not part of the current contract.

---

## What is Host?

Host is the **effect execution runtime** of Manifesto. It orchestrates the compute-effect-apply loop using an event-loop model with Mailbox + Runner + Job architecture.

Most app developers should start with `@manifesto-ai/sdk`, not this package.
The direct Host examples below are for custom runtime authors, effect-runtime
tests, and tools that need to own the execution loop.

```typescript
const app = createManifesto<TodoDomain>(TodoMel, effects).activate();
await app.action.addTodo.submit("Review docs");
console.log(app.snapshot().state.todos);
```

If you are deciding where to start:

| Goal | Start Here |
|------|------------|
| Build a web app, backend route, script, or trusted agent | `@manifesto-ai/sdk` and the main Guide |
| Fulfill declared effects from an app runtime | SDK effect handlers |
| Debug why an app action did not settle | Runtime and Debugging guides first |
| Own the compute/effect loop directly | This Host package |

In the Manifesto architecture:

```text
MEL -> Core -> HOST
             |
      Executes effects, applies patches
      Runs the mailbox-based execution model
```

Most applications reach Host through the SDK. Optional approval/history
decorators can wrap the SDK runtime later without changing Host's responsibility.

## Installation

Install Host directly only when you are building a custom runtime, testing Host
behavior, or debugging the execution loop. App code gets Host through
`@manifesto-ai/sdk`.

```bash
npm install @manifesto-ai/host @manifesto-ai/core
# or
pnpm add @manifesto-ai/host @manifesto-ai/core
```

---

## Low-Level Host Fixture

```typescript
import { ManifestoHost, createIntent, type DomainSchema } from "@manifesto-ai/host";

// 1. Define schema
const schema: DomainSchema = {
  id: "example:counter",
  version: "1.0.0",
  hash: "example-hash",
  state: {
    fields: {
      count: { type: "number", required: true, default: 0 },
    },
  },
  actions: {
    increment: {
      flow: {
        kind: "patch",
        op: "set",
        path: [{ kind: "prop", name: "count" }],
        value: { kind: "add", left: { kind: "get", path: "count" }, right: { kind: "lit", value: 1 } },
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
  return [{ op: "set", path: [{ kind: "prop", name: "user" }], value: data }];
});

// 4. Dispatch intent
const intent = createIntent("increment", "intent-1");
const result = await host.dispatch(intent);

console.log(result.status);        // -> "complete"
console.log(result.snapshot.state); // -> { count: 1 }
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

## Context Determinism

Host guarantees one materialized ADR-027 `Context` per transition attempt:

```typescript
// Context is captured once before Core compute.
const context: Context = {
  runtime: {
    time: { timestamp: runtime.now() },
    random: { seed: intent.intentId },
  },
  external: {},
};

// All Core re-entry for the same transition reuses the same context.
Core.compute(schema, snapshot, intent, context);
```

**Benefits:**
- Same input -> same output (determinism preserved)
- Trace replay produces identical results
- `compute(schema, snapshot, intent, context)` remains replayable

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
  reset(snapshotOrData: unknown): void;
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

// Host-owned context materialization helper.
// The HostContextProvider name is retained as a package compatibility type;
// the Core boundary type is owner-neutral Context.
interface HostContextProvider {
  createFrozenContext(intentId: string, external?: Record<string, JsonValue>): Context;
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
      return [{ op: "set", path: [{ kind: "prop", name: "error" }], value: `HTTP ${response.status}` }];
    }
    const data = await response.json();
    return [
      { op: "set", path: [{ kind: "prop", name: "data" }], value: data },
      { op: "set", path: [{ kind: "prop", name: "error" }], value: null },
    ];
  } catch (e) {
    return [{ op: "set", path: [{ kind: "prop", name: "error" }], value: e.message }];
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

```text
SDK runtime -> HOST -> Core
```

| Relationship | Package | How |
|--------------|---------|-----|
| Depends on | `@manifesto-ai/core` | Uses compute() and apply() |
| Used by | `@manifesto-ai/sdk` | SDK creates Host internally via createManifesto() |
| Used by | `@manifesto-ai/lineage` / `@manifesto-ai/governance` | Optional decorators execute through the SDK/Host runtime chain |

---

## When to Use Host Directly

**Most users don't need to use Host directly.**

Use Host directly when:
- Building a custom runtime without approval/history decorators
- Testing effect handlers in isolation
- Building CLI tools or scripts
- Implementing custom execution policies

For typical usage, see [`@manifesto-ai/sdk`](../sdk/) — the recommended entry point. For explicit approval/history workflows, see [`@manifesto-ai/lineage`](../lineage/) and [`@manifesto-ai/governance`](../governance/).

---

## Maintainer Contract Notes

Host-facing Snapshot references use `snapshot.state` for domain state and
`snapshot.namespaces.host` for Host-owned operational state. Accumulated
`system.errors` is not part of the current Host contract; `lastError` remains
the current error surface. Historical changelog details live in
[`VERSION-INDEX.md`](./docs/VERSION-INDEX.md) and the archived FDR/MIGRATION
documents.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](./docs/GUIDE.md) | Low-level Host fixture guide for custom runtimes, tests, and execution-loop debugging |
| [host-SPEC.md](./docs/host-SPEC.md) | Current living specification |
| [VERSION-INDEX.md](./docs/VERSION-INDEX.md) | Current and historical document map |
| [MIGRATION.md](./docs/MIGRATION.md) | Historical v1.x -> v2.0.2 migration guide |
| [host-FDR-v2.0.2.md](./docs/archive/host-FDR-v2.0.2.md) | Historical rationale addendum |

---

## Examples

See the [`examples/`](./examples/) directory for runnable examples:

- [`basic-counter.ts`](./examples/basic-counter.ts) — Basic ManifestoHost usage
- [`effect-handling.ts`](./examples/effect-handling.ts) — Effect handler registration and execution
- [`determinism.ts`](./examples/determinism.ts) — Context determinism verification

---

## License

[MIT](../../LICENSE)
