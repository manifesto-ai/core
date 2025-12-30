# @manifesto-ai/host

> **Host** is the effect execution runtime of Manifesto. It executes effects, applies patches, and manages the compute-effect loop.

---

## What is Host?

Host is responsible for orchestrating Manifesto intent execution. It calls Core to compute, executes any resulting effects, applies patches, and repeats until the intent is complete.

In the Manifesto architecture:

```
World ──→ HOST ──→ Core
            │
   Executes effects, applies patches
   Runs the compute-effect-resume cycle
```

---

## What Host Does

| Responsibility | Description |
|----------------|-------------|
| Execute effects | Run effect handlers (API calls, timers, etc.) |
| Apply patches | Update snapshot with patches from Core |
| Run compute loop | Iterate compute → effect → apply until done |
| Manage persistence | Store and retrieve snapshots |

---

## What Host Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Compute state transitions | Core |
| Define domain logic | Builder |
| Govern authority/proposals | World |
| Handle UI bindings | Bridge / React |

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
import { createHost } from "@manifesto-ai/host";
import { createCore, createSnapshot } from "@manifesto-ai/core";
import type { DomainSchema } from "@manifesto-ai/core";

// Create host
const host = createHost({
  schema,
  snapshot: createSnapshot(schema),
});

// Register effect handler
host.registerEffect("api.fetch", async ({ params }) => {
  const response = await fetch(params.url);
  const data = await response.json();
  return {
    ok: true,
    patches: [{ op: "set", path: params.targetPath, value: data }],
  };
});

// Dispatch intent
const result = await host.dispatch({
  type: "loadUser",
  input: { userId: "123" },
});

console.log(result.status); // → "completed"
console.log(result.snapshot.data.user); // → { id: "123", name: "..." }
```

> See [GUIDE.md](../../docs/packages/host/GUIDE.md) for the full tutorial.

---

## Host API

### Main Exports

```typescript
// Factory
function createHost(options: HostOptions): ManifestoHost;

// Host class
class ManifestoHost {
  registerEffect(type: string, handler: EffectHandler): void;
  dispatch(intent: Intent): Promise<HostResult>;
  getSnapshot(): Snapshot;
}

// Host loop (low-level)
function runHostLoop(options: HostLoopOptions): Promise<HostLoopResult>;

// Effect types
type EffectHandler = (context: EffectContext) => Promise<EffectResult>;
type EffectResult = { ok: boolean; patches?: Patch[]; error?: string };

// Persistence
interface SnapshotStore {
  get(): Snapshot | undefined;
  set(snapshot: Snapshot): void;
}
class MemorySnapshotStore implements SnapshotStore;
```

> See [SPEC.md](../../docs/packages/host/SPEC.md) for complete API reference.

---

## Core Concepts

### Effect Handler Registry

Effects are handled by registered handlers. Each handler is keyed by effect type:

```typescript
host.registerEffect("timer.delay", async ({ params }) => {
  await new Promise(resolve => setTimeout(resolve, params.ms));
  return { ok: true };
});

host.registerEffect("api.post", async ({ params }) => {
  const res = await fetch(params.url, { method: "POST", body: params.body });
  return { ok: res.ok, patches: [{ op: "set", path: "/response", value: await res.json() }] };
});
```

### Compute-Effect Loop

Host runs a loop:
1. Call `core.compute(snapshot, intent)`
2. If there are requirements (pending effects), execute them
3. Apply resulting patches
4. Repeat until no more requirements

### Idempotent Handlers

Effect handlers should be idempotent when possible. If the same effect runs twice, the result should be the same.

---

## Relationship with Other Packages

```
┌─────────────┐
│    World    │ ← Uses Host to execute proposals
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    HOST     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Core     │ ← Host calls Core to compute
└─────────────┘
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

For typical usage with governance, see [`@manifesto-ai/world`](../world/).

---

## Documentation

| Document | Purpose |
|----------|---------|
| [GUIDE.md](../../docs/packages/host/GUIDE.md) | Step-by-step usage guide |
| [SPEC.md](../../docs/packages/host/SPEC.md) | Complete specification |
| [FDR.md](../../docs/packages/host/FDR.md) | Design rationale |

---

## License

[MIT](../../LICENSE)
