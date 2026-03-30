# Manifesto

**Semantic Layer for Deterministic Domain State**

Manifesto gives you one semantic model for deterministic domain state, traceable history, and explicit governance. Use the SDK when you want the shortest path to a running app. Use `@manifesto-ai/world` when you want the canonical governed composition surface.

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/core.svg)](https://www.npmjs.com/package/@manifesto-ai/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Two Ways In

| Path | Use it when | Start here |
|------|-------------|------------|
| **Direct-dispatch SDK** | You want the shortest onboarding path and do not need explicit governance composition | [`@manifesto-ai/sdk`](./docs/api/sdk.md) |
| **Governed composition** | You want explicit lineage, authority, and sealing behavior | [`@manifesto-ai/world`](./docs/api/world.md) |

### 1. Direct-Dispatch SDK

```mel
domain Counter {
  state { count: number = 0 }

  action increment() {
    onceIntent { patch count = add(count, 1) }
  }
}
```

```typescript
import { createIntent, createManifesto, dispatchAsync } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

const app = createManifesto({ schema: CounterMel, effects: {} });

await dispatchAsync(app, createIntent("increment", "intent-1"));
console.log(app.getSnapshot().data.count); // 1
```

### 2. Governed Composition

```typescript
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createIntentInstance,
  createLineageService,
  createSqliteWorldStore,
  createWorld,
} from "@manifesto-ai/world";

const store = createSqliteWorldStore({ filename: "./.manifesto/world.sqlite" });
const lineage = createLineageService(store);
const governance = createGovernanceService(store, { lineageService: lineage });
const world = createWorld({
  store,
  lineage,
  governance,
  eventDispatcher: createGovernanceEventDispatcher({ service: governance }),
  executor,
});

const intent = await createIntentInstance({
  body: { type: "counter.increment" },
  schemaHash: "counter-v1",
  projectionId: "counter-ui",
  source: { kind: "ui", eventId: "evt-1" },
  actor: { actorId: "user-1", kind: "human" },
  intentId: "intent-1",
});
```

For the full Node-local bootstrap path, see [examples/governed-minimal-node](./examples/governed-minimal-node/README.md).

---

## What Manifesto Is

Manifesto is a semantic layer for deterministic domain state. You declare the meaning of your domain once, and then choose the surface you want to use:

- `@manifesto-ai/sdk` for direct-dispatch applications
- `@manifesto-ai/world` for governed composition, lineage, and authority

The core equation stays the same:

```text
compute(schema, snapshot, intent) -> (snapshot', requirements, trace)
```

It is pure, total, and traceable.

---

## What Manifesto Is Not

- Not a state management library
- Not an AI framework
- Not a database or ORM
- Not a workflow engine

---

## Where To Go Next

- [Quickstart](./docs/quickstart.md)
- [World API](./docs/api/world.md)
- [SDK API](./docs/api/sdk.md)
- [Guides](./docs/guides/index.md)
- [Architecture](./docs/architecture/index.md)
- [Internals](./docs/internals/index.md)
