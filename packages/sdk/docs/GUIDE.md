# SDK Guide

> Practical guide for the activation-first `@manifesto-ai/sdk` path.

> **Current Contract Note:** This guide follows the current SDK v3 activation model. `createManifesto()` now returns a composable manifesto, and runtime verbs appear only after `activate()`.

## 1. Build The Activation Lifecycle

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto<CounterDomain>(domainSchema, {});
const world = manifesto.activate();

const intent = world.createIntent(world.MEL.actions.increment);
await world.dispatchAsync(intent);

const canIncrement = world.isActionAvailable("increment");
const available = world.getAvailableActions();
const snapshot = world.getSnapshot();
```

This is the normal SDK lifecycle:

1. create one composable manifesto
2. activate it once
3. create a typed intent from `MEL.actions.*`
4. dispatch it through the activated instance
5. optionally query action availability
6. read the next terminal Snapshot

`createManifesto()` no longer returns a ready-to-run runtime instance. The activated instance is the canonical public surface.

---

## 2. Create Typed Intents

```typescript
const increment = world.createIntent(world.MEL.actions.increment);
const add = world.createIntent(world.MEL.actions.add, 3);
```

`createIntent()` is instance-owned and typed from the activated runtime's MEL surface.

The canonical path is:

```typescript
const intent = world.createIntent(world.MEL.actions.someAction, ...args);
await world.dispatchAsync(intent);
```

String-name intent creation is no longer the SDK's canonical public story.

---

## 3. Dispatch, Observe, And Read

```typescript
const off = world.subscribe(
  (snapshot) => snapshot.data.count,
  (count) => {
    console.log("Count changed:", count);
  },
);

const offCompleted = world.on("dispatch:completed", (event) => {
  console.log("Completed intent:", event.intentId);
});
```

Subscriptions are the main render path. Telemetry events are the main lifecycle path. Together they cover most direct-dispatch integrations.

If you need effect-level instrumentation, keep the effect handlers small and let them return patches that describe the visible result.

---

## 4. Activation Is One-Shot

```typescript
const manifesto = createManifesto<CounterDomain>(domainSchema, {});
const world = manifesto.activate();
```

After activation:

- runtime verbs exist on `world`
- the composable manifesto cannot be activated again
- there is no path back to the pre-activation phase

---

## 5. Governed Composition Direction

Stay on the SDK when:

- you need the present-only base runtime
- Snapshot reads, subscriptions, and availability queries are enough
- you do not need lineage or governance semantics

The public direction for governed composition is:

`createManifesto() -> withLineage() -> withGovernance() -> activate()`

Those runtime contracts belong to the owning Lineage and Governance packages. This guide intentionally focuses on the landed base SDK contract.

---

## 6. Related Docs

- [SDK README](../README.md)
- [SDK Specification v3](sdk-SPEC-v3.0.0-draft.md)
- [SDK Specification v2](sdk-SPEC-v2.0.0.md)
- [SDK Version Index](VERSION-INDEX.md)
- [SDK API](../../../docs/api/sdk.md)
- [API Index](../../../docs/api/index.md)
- [World](../../../docs/api/world.md)
- [Tutorial](../../../docs/tutorial/)
