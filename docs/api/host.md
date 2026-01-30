# @manifesto-ai/host

> Effect execution runtime for Manifesto

---

## Overview

`@manifesto-ai/host` is the **execution layer** that realizes state transitions computed by Core. It handles effect execution, patch application, and the compute-effect loop.

**Core determines "where should we be?" Host handles "how do we get there?"**

---

## Architecture

Host uses a **Mailbox + Runner + Job** execution model:

```
Intent arrives
      |
      v
  ┌─────────┐
  │ Mailbox │  <-- Job queue (FIFO)
  └─────────┘
      |
      v
  ┌─────────┐
  │ Runner  │  <-- Processes jobs sequentially
  └─────────┘
      |
      +---> compute() ---> patches/requirements
      |
      +---> fulfill()  ---> effect execution
      |
      +---> apply()    ---> state update
```

---

## Main Exports

### createHost()

Creates a ManifestoHost instance.

```typescript
import { createHost } from "@manifesto-ai/host";

const host = createHost({
  schema,
  effectRegistry,
  contextProvider,
});
```

### ManifestoHost Interface

```typescript
interface ManifestoHost {
  /** Execute an intent to completion */
  execute(
    snapshot: Snapshot,
    intent: Intent,
    opts?: HostOptions
  ): Promise<HostResult>;
}
```

### HostResult

```typescript
interface HostResult {
  snapshot: Snapshot;
  trace: TraceEvent[];
  stats: ExecutionStats;
}
```

---

## Effect Handlers

Effects are handled by registered handlers:

```typescript
import { createEffectRegistry, createEffectExecutor } from "@manifesto-ai/host";

const registry = createEffectRegistry();

registry.register("api.fetch", async (params, ctx) => {
  const response = await fetch(params.url);
  const data = await response.json();
  return [{ op: "set", path: params.target, value: data }];
});

const executor = createEffectExecutor(registry);
```

### EffectHandler

```typescript
type EffectHandler = (
  params: Record<string, unknown>,
  ctx: EffectContext
) => Promise<Patch[]>;

interface EffectContext {
  snapshot: Readonly<Snapshot>;
  intentId: string;
  effectId: string;
  signal: AbortSignal;
}
```

---

## Key Types

### Job Types

```typescript
type JobType =
  | "start_intent"     // Begin processing an intent
  | "continue_compute" // Continue after effect fulfillment
  | "fulfill_effect"   // Execute an effect
  | "apply_patches";   // Apply patches to snapshot
```

### ExecutionContext

```typescript
interface ExecutionContext {
  readonly key: ExecutionKey;
  readonly schema: DomainSchema;
  snapshot: Snapshot;
  readonly runtime: Runtime;
}
```

---

## When to Use Directly

Most applications should use `@manifesto-ai/app` instead. Use Host directly when:

- Building custom execution infrastructure
- Implementing specialized effect handlers
- Creating custom compute loops
- Building Manifesto tooling

---

## Specification

For the complete normative specification, see:

- [Specifications Hub](/internals/spec/) - Links to all package specs
- [Host SPEC v2.0.2](https://github.com/manifesto-ai/core/blob/main/workspaces/core/packages/host/docs/host-SPEC-v2.0.2.md) - Latest package spec with Mailbox + Runner + Job model

---

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/core](./core) | Provides pure computation |
| [@manifesto-ai/world](./world) | Governs intent authorization |
| [@manifesto-ai/app](./app) | High-level facade using Host |
