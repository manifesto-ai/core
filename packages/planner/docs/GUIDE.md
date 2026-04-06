# Planner Guide

> Practical guide for the first `@manifesto-ai/planner` implementation slice.

`@manifesto-ai/planner` sits on top of the governed composition path:

`createManifesto() -> withLineage() -> withGovernance() -> withPlanner() -> activate()`

## Minimal Example

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

const preview = app.preview(app.MEL.actions.increment);
const plan = await app.plan();
```

## What The Activated Runtime Adds

The planner runtime keeps the governed surface and adds:

- `preview(actionRef, ...args)`
- `plan(options?)`

`preview()` is read-only and synchronous. `plan()` is read-only and asynchronous.

## Current Notes

- `preview()` is synchronous and uses the SDK provider seam for pure simulation.
- `plan()` is asynchronous because strategies may perform many simulation steps.
- `createCoreEnumerator()` is intentionally conservative. It does not invent domain-specific inputs.
- The bundled strategies are `greedyStrategy()` and `mctsStrategy()`.
- `mctsStrategy()` uses deterministic rollouts seeded from the root canonical snapshot.
- In the current slice, `mctsStrategy()` treats `status: "pending"` rollout states as terminal.
- If your action space needs input candidates, provide a custom `enumerator`.
- `setParameter()` affects the next `plan()` or `preview()` call only. In-flight planning keeps its own parameter snapshot.
- `plan({ budgetOverride, depthOverride })` requests are clamped by `hardPolicy`.

## Custom Enumerator Example

```ts
const enumerator = {
  enumerate(snapshot) {
    return snapshot.data.tasks
      .filter((task) => !task.completed)
      .map((task) => ({
        actionName: "completeTask",
        input: { taskId: task.id },
      }));
  },
};

const app = withPlanner(governed, {
  planner,
  strategy: mctsStrategy({ useTerm: "reward", budget: 300 }),
  enumerator,
}).activate();
```

## Current Limits

- `createCoreEnumerator()` only emits action-name candidates; it is not complete for input-bearing action spaces.
- Planner tracing and richer candidate helpers remain future-phase work in the internal draft.
