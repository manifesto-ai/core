# @manifesto-ai/host

> Effect execution runtime and compute loop orchestrator

---

## Overview

`@manifesto-ai/host` executes intents against Core and fulfills effect requirements.

- Runtime orchestration (Mailbox + Runner + Jobs)
- Applies domain patches and system transitions in interlocked order
- Produces terminal snapshot/status per dispatch

> **Current Contract Note:** This page describes the current Host v4.0.0 surface. Host-facing Snapshot references now follow the current Core v4.1.0 canonical contract and no longer include accumulated `system.errors`. This is the full Core/Host substrate, not the projected SDK `getSnapshot()` read model.

---

## Architecture

Host runs the compute-fulfill loop around Core.

```mermaid
flowchart TD
  IN["Intent"] --> MB["Mailbox"]
  MB --> RN["Runner"]
  RN --> CC["core.compute"]
  CC --> P["patches"]
  CC --> SD["systemDelta"]
  P --> AP["core.apply"]
  SD --> ASD["core.applySystemDelta"]
  ASD --> REQ["snapshot.system.pendingRequirements"]
  REQ --> FX["EffectExecutor"]
  FX --> EP["effect patches"]
  EP --> RN
```

---

## Main Exports

### createHost()

```typescript
import { createHost } from "@manifesto-ai/host";

const host = createHost(schema, {
  maxIterations: 100,
});
```

### ManifestoHost (primary methods)

```typescript
class ManifestoHost {
  registerEffect(type: string, handler: EffectHandler, options?: EffectHandlerOptions): void;
  unregisterEffect(type: string): boolean;
  hasEffect(type: string): boolean;
  getEffectTypes(): string[];

  dispatch(intent: Intent): Promise<HostResult>;
  getSnapshot(): Snapshot | null;
  reset(initialData: unknown): void;
}
```

`ManifestoHost.getSnapshot()` returns the Host's canonical snapshot substrate. If you are working at the SDK layer, `instance.getSnapshot()` means the projected application-facing read instead.

### HostResult

```typescript
interface HostResult {
  status: "complete" | "pending" | "error";
  snapshot: Snapshot;
  traces: TraceGraph[];
  error?: HostError;
}
```

`HostResult.snapshot` is likewise canonical Host/Core state, not the SDK projection.

---

## Effect Handlers

```typescript
import { createEffectRegistry, createEffectExecutor } from "@manifesto-ai/host";

const registry = createEffectRegistry();

registry.register("api.fetch", async (_type, params, ctx) => {
  const response = await fetch(String(params.url));
  const data = await response.json();
  return [
    {
      op: "set",
      path: [{ kind: "prop", name: "result" }],
      value: data,
    },
  ];
});

const executor = createEffectExecutor(registry);
```

### EffectHandler

```typescript
type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: {
    snapshot: Readonly<Snapshot>;
    requirement: Requirement;
  }
) => Promise<Patch[]>;
```

The Host effect-handler context carries the canonical snapshot substrate. The SDK wraps this separately and presents a projected `EffectContext.snapshot` to application effect handlers.

---

## Interlock Requirements

- Apply order MUST be: `core.apply(patches)` then `core.applySystemDelta(systemDelta)`.
- Effect dispatch list SHOULD be read from `snapshot.system.pendingRequirements` after both applies.
- Fulfillment clear MUST use `applySystemDelta({ removeRequirementIds })`.
- Error patches MUST NOT target `system.*`.

---

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/core](./core) | Pure semantic computation |
| [@manifesto-ai/sdk](./sdk) | Activation-first app runtime over Host |
| [@manifesto-ai/lineage](./lineage) | Seal-aware continuity decorator layered over SDK + Host |
| [@manifesto-ai/governance](./governance) | Proposal/approval decorator layered over Lineage + SDK + Host |
