# SDK Guide

> Practical guide for the direct-dispatch `@manifesto-ai/sdk` path.

## 1. Create a Manifesto Instance

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto({
  schema: domainSchema,
  effects: {},
});
```

`createManifesto()` is the default application runtime. It assembles the direct-dispatch path without requiring governed world wiring.

## 2. Dispatch Intents

```typescript
import { createIntent, dispatchAsync } from "@manifesto-ai/sdk";

await dispatchAsync(manifesto, createIntent("counter.increment", "intent-1"));
const snapshot = manifesto.getSnapshot();
```

Use `createIntent()` for the standard direct-dispatch path. Use `dispatchAsync()` when you want a Promise that resolves after the intent reaches terminal state. Read the terminal state from `getSnapshot()`, or observe changes with `subscribe()` and `on()`.

## 3. Use Thin Governed Re-exports When Needed

```typescript
import {
  createInMemoryWorldStore,
  createWorld,
} from "@manifesto-ai/sdk";
```

These exports are intentionally thin. If you need the full governed surface, including `createGovernanceService()` and `createLineageService()`, import from top-level `@manifesto-ai/world`.

## 4. Related Docs

- [SDK README](../README.md)
- [SDK Specification](sdk-SPEC-v2.0.0.md)
- [SDK Version Index](VERSION-INDEX.md)
- [World API](../../../docs/api/world.md)
