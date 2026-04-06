# @manifesto-ai/planner

> Decorator runtime for foresight, simulation, and strategy over governed Manifesto worlds.

`@manifesto-ai/planner` adds read-only planning on top of the governed composition path. Its canonical public entry is `withPlanner(manifesto, config)`.

> **Current Contract Note:** The current implemented package contract is [docs/planner-SPEC.md](docs/planner-SPEC.md). The broader future-phase design remains in [docs/internals/spec/planner-SPEC-v1.2.0-draft.md](../../docs/internals/spec/planner-SPEC-v1.2.0-draft.md).

## Canonical Runtime Path

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { withGovernance } from "@manifesto-ai/governance";
import { createPlanner, mctsStrategy, withPlanner } from "@manifesto-ai/planner";

const planner = createPlanner<CounterDomain>()
  .features({
    count: (snapshot) => snapshot.data.count,
  })
  .terms({
    reward: (features) => features.count,
  })
  .build();

const app = withPlanner(
  withGovernance(
    withLineage(createManifesto<CounterDomain>(schema, effects), {
      store: createInMemoryLineageStore(),
    }),
    {
      bindings,
      execution,
    },
  ),
  {
    planner,
    strategy: mctsStrategy({ useTerm: "reward", budget: 1000 }),
  },
).activate();
```

## What This Package Owns

- `createPlanner()` builder and runtime evaluator state
- `withPlanner()` and the activated planning runtime
- read-only `preview()` and `plan()` over canonical snapshots
- built-in `greedyStrategy()` for single-step search
- built-in `mctsStrategy()` for multi-step search
- built-in `createCoreEnumerator()` as the conservative default action enumerator

## Current Slice

The current implemented slice includes:

- `createPlanner()`
- `withPlanner()`
- `greedyStrategy()`
- `mctsStrategy()`
- `createCoreEnumerator()`

Planner tracing and richer built-in candidate helpers remain follow-up work.

## Docs

- [Docs Landing](docs/README.md)
- [Planner Guide](docs/GUIDE.md)
- [Planner SPEC](docs/planner-SPEC.md)
- [Version Index](docs/VERSION-INDEX.md)
