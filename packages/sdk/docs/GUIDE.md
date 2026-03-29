# SDK Guide

> Practical guide for the direct-dispatch `@manifesto-ai/sdk` path.

> **Current Contract Note:** This guide follows the current SDK v2.0.0 surface. The projected ADR-015 + ADR-016 rewrite lives in [sdk-SPEC-v3.0.0-draft.md](sdk-SPEC-v3.0.0-draft.md) as draft only.

## 1. Build The Direct-Dispatch Lifecycle

```typescript
import { createIntent, createManifesto, dispatchAsync } from "@manifesto-ai/sdk";

const manifesto = createManifesto({
  schema: domainSchema,
  effects: {},
});

await dispatchAsync(
  manifesto,
  createIntent("counter.increment", { step: 1 }, "intent-1"),
);
const snapshot = manifesto.getSnapshot();
```

This is the normal SDK lifecycle:

1. create one instance
2. create a stable intent
3. dispatch it
4. read the next terminal Snapshot

`createManifesto()` is the default application runtime. It assembles the direct-dispatch path without requiring governed world wiring.

---

## 2. `dispatch()` Versus `dispatchAsync()`

```typescript
const intent = createIntent("counter.increment", "intent-1");

manifesto.dispatch(intent);
const immediate = manifesto.getSnapshot();
```

`dispatch()` returns immediately. Use it when you only need to enqueue work and react later through telemetry or subscription callbacks.

```typescript
const nextSnapshot = await dispatchAsync(manifesto, intent);
```

`dispatchAsync()` is the convenience path when you want a Promise that resolves after the intent reaches a terminal state.

Use `dispatch()` for fire-and-observe flows. Use `dispatchAsync()` for form submissions, tests, and scripts that need the final Snapshot before continuing.

---

## 3. Subscribe, Observe, And Instrument

```typescript
const off = manifesto.subscribe(
  (snapshot) => snapshot.data.count,
  (count) => {
    console.log("Count changed:", count);
  },
);

const offCompleted = manifesto.on("dispatch:completed", (event) => {
  console.log("Completed intent:", event.intentId);
});
```

Subscriptions are the main render path. Telemetry events are the main lifecycle path. Together they cover most direct-dispatch integrations.

If you need effect-level instrumentation, keep the effect handlers small and let them return patches that describe the visible result.

---

## 4. Use Thin Governed Re-exports Only When Needed

```typescript
import {
  createInMemoryWorldStore,
  createWorld,
} from "@manifesto-ai/sdk";
```

These exports are intentionally thin. If you need the full governed surface, including `createGovernanceService()` and `createLineageService()`, import top-level `@manifesto-ai/world` directly.

Move to the governed path when you need proposals, actor identity, branch history, or explicit sealing.

---

## 5. When To Move To `@manifesto-ai/world`

Stay on the SDK when:

- you only need direct intent dispatch
- Snapshot reads are enough
- no approval or branch history is required

Move to `@manifesto-ai/world` when:

- you need proposals and legitimacy checks
- you need actor and authority tracking
- you need sealed history or branch inspection
- the runtime should coordinate governance and lineage explicitly

---

## 6. Related Docs

- [SDK README](../README.md)
- [SDK Specification](sdk-SPEC-v2.0.0.md)
- [SDK Specification v3 Draft](sdk-SPEC-v3.0.0-draft.md)
- [SDK Version Index](VERSION-INDEX.md)
- [World](../../../docs/api/world.md)
- [Tutorial](../../../docs/tutorial/)
