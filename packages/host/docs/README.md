# @manifesto-ai/host

> **Host** is the effect execution runtime of Manifesto. It executes effects, applies patches, and manages the compute-effect loop.

---

## What is Host?

Host is responsible for orchestrating Manifesto intent execution. It calls Core to compute, executes any resulting effects, applies patches, and repeats until the intent is complete.

In the Manifesto architecture:

```
World -> HOST -> Core
            |
   Executes effects, applies patches
   Runs the compute-effect-resume cycle
```

---

## What Host Does

| Responsibility | Description |
|----------------|-------------|
| Execute effects | Run effect handlers (API calls, timers, etc.) |
| Apply patches | Update snapshot with patches from Core |
| Run compute loop | Iterate compute -> effect -> apply until done |

---

## What Host Does NOT Do

| NOT Responsible For | Who Is |
|--------------------|--------|
| Compute state transitions | Core |
| Define domain semantics/schema | App |
| Govern authority/proposals | World |
| Handle UI/event bindings | App |

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
import { createIntent } from "@manifesto-ai/core";
import type { DomainSchema } from "@manifesto-ai/core";

// Create host
const host = createHost(schema, {
  initialData: { user: null },
});

// Register effect handler
host.registerEffect("api.fetch", async (_type, params) => {
  const response = await fetch(params.url);
  const data = await response.json();
  return [{ op: "set", path: params.targetPath, value: data }];
});

// Dispatch intent
const intent = createIntent("loadUser", { userId: "123" }, "intent-1");
const result = await host.dispatch(intent);

console.log(result.status); // -> "complete"
console.log(result.snapshot.data.user); // -> { id: "123", name: "..." }
```

> See [GUIDE.md](GUIDE.md) for the full tutorial.

---

## Host API

### Main Exports

```typescript
// Factory
function createHost(schema: DomainSchema, options?: HostOptions): ManifestoHost;

// Host class
class ManifestoHost {
  registerEffect(type: string, handler: EffectHandler): void;
  dispatch(intent: Intent): Promise<HostResult>;
  getSnapshot(): Promise<Snapshot | null>;
}

// Effect types
type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
) => Promise<Patch[]>;
```

> See [SPEC.md](SPEC.md) for complete API reference.

---

## Core Concepts

### Effect Handler Registry

Effects are handled by registered handlers. Each handler is keyed by effect type:

```typescript
host.registerEffect("timer.delay", async (_type, params) => {
  await new Promise(resolve => setTimeout(resolve, params.ms));
  return [];
});

host.registerEffect("api.post", async (_type, params) => {
  const res = await fetch(params.url, { method: "POST", body: params.body });
  return [{ op: "set", path: "response", value: await res.json() }];
});
```

### Compute-Effect Loop

Host runs a loop:
1. Call `await core.compute(schema, snapshot, intent, context)`
2. If there are requirements (pending effects), execute them
3. Apply resulting patches
4. Repeat until no more requirements

### Idempotent Handlers

Effect handlers should be idempotent when possible. If the same effect runs twice, the result should be the same.

---

## Relationship with Other Packages

```
World -> HOST -> Core
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
| [GUIDE.md](GUIDE.md) | Step-by-step usage guide |
| [SPEC.md](SPEC.md) | Complete specification |
| [FDR.md](FDR.md) | Design rationale |

---

## License

[MIT](../../LICENSE)
