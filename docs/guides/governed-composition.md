# Governed Composition

> Assemble lineage, governance, and the World facade explicitly.

Use governed composition when you need explicit proposal flow, authority evaluation, sealing, or lineage records. The canonical entrypoint is top-level `@manifesto-ai/world`.

---

## When To Use It

Choose governed composition when you need:

- explicit authority decisions before execution
- lineage records for sealing and replay
- a shared governed runtime surface across multiple callers
- direct access to lineage and governance services

If you only need direct dispatch, start with `@manifesto-ai/sdk` and `createManifesto()`.

---

## Assemble The Runtime

```typescript
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createInMemoryWorldStore,
  createIntentInstance,
  createLineageService,
  createWorld,
} from "@manifesto-ai/world";

const store = createInMemoryWorldStore();
const lineage = createLineageService(store);
const governance = createGovernanceService(store, {
  lineageService: lineage,
});

const world = createWorld({
  store,
  lineage,
  governance,
  eventDispatcher: createGovernanceEventDispatcher({
    service: governance,
  }),
});
```

---

## Create An Intent Instance

```typescript
const intent = await createIntentInstance({
  body: {
    type: "counter.increment",
    input: { amount: 1 },
  },
  schemaHash: "counter-v1",
  projectionId: "counter-ui",
  source: { kind: "ui", eventId: "evt-1" },
  actor: { actorId: "user-1", kind: "human" },
  intentId: "intent-1",
});
```

Intent instances capture the actor, source, and projection metadata needed by the governance layer.

---

## Composition Rules

- `createInMemoryWorldStore()` gives you the composite in-memory store.
- `createLineageService()` owns continuity and sealing state.
- `createGovernanceService()` owns proposals, decisions, and events.
- `createWorld()` assembles the canonical facade without wrapping the provided services.

`@manifesto-ai/world/facade` exists only as an alias of the same surface.

---

## See Also

- [World API](/api/world)
- [SDK API](/api/sdk)
- [Concepts: World](/concepts/world)

