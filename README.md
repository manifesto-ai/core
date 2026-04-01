# Manifesto

**Semantic Layer for Deterministic Domain State**

Manifesto gives you one semantic model for deterministic domain state, traceable history, and explicit governance. Use the SDK when you want the shortest path to a running app. Add Lineage and Governance decorators when you need sealing, history, and proposal legitimacy.

[![npm version](https://img.shields.io/npm/v/@manifesto-ai/core.svg)](https://www.npmjs.com/package/@manifesto-ai/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Two Ways In

| Path | Use it when | Start here |
|------|-------------|------------|
| **Base runtime** | You want the shortest onboarding path and present-only execution | [`@manifesto-ai/sdk`](./docs/api/sdk.md) |
| **Governed composition** | You want explicit lineage, authority, and sealing behavior | [`@manifesto-ai/lineage`](./docs/api/lineage.md) + [`@manifesto-ai/governance`](./docs/api/governance.md) |

### 1. Base Runtime

```mel
domain Counter {
  state { count: number = 0 }

  action increment() {
    onceIntent { patch count = add(count, 1) }
  }
}
```

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import CounterMel from "./counter.mel";

const manifesto = createManifesto(CounterMel, {});
const app = manifesto.activate();

await app.dispatchAsync(
  app.createIntent(app.MEL.actions.increment),
);
console.log(app.getSnapshot().data.count); // 1
```

### 2. Governed Composition

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { createInMemoryGovernanceStore, withGovernance } from "@manifesto-ai/governance";

const governed = withGovernance(
  withLineage(createManifesto(CounterMel, {}), {
    store: createInMemoryLineageStore(),
  }),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings: [
      {
        actorId: "actor:auto",
        authorityId: "authority:auto",
        policy: { mode: "auto_approve" },
      },
    ],
    execution: {
      projectionId: "counter-ui",
      deriveActor: () => ({ actorId: "actor:auto", kind: "agent" }),
      deriveSource: () => ({ kind: "ui", eventId: crypto.randomUUID() }),
    },
  },
).activate();

const proposal = await governed.proposeAsync(
  governed.createIntent(governed.MEL.actions.increment),
);
```

The old world facade and its adapter subpaths were removed. There is no Phase 4 drop-in replacement for the old `world/sqlite` style bootstrap.

---

## What Manifesto Is

Manifesto is a semantic layer for deterministic domain state. You declare the meaning of your domain once, and then choose the surface you want to use:

- `@manifesto-ai/sdk` for activation-first base runtime
- `@manifesto-ai/lineage` for continuity, sealing, and history
- `@manifesto-ai/governance` for legitimacy, proposal flow, and approval

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
- [SDK API](./docs/api/sdk.md)
- [Lineage API](./docs/api/lineage.md)
- [Governance API](./docs/api/governance.md)
- [Guides](./docs/guides/index.md)
- [Architecture](./docs/architecture/index.md)
- [Internals](./docs/internals/index.md)
