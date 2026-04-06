# @manifesto-ai/planner

> Optional strategic runtime layer for governed Manifesto worlds.

## Overview

`@manifesto-ai/planner` adds read-only foresight on top of the current governed decorator path.

Use it when you already have:

- `createManifesto()`
- `withLineage()`
- `withGovernance()`

and you now need:

- `preview()` for a single action outcome
- `plan()` for best-next-action search
- a separate `strategy` seam over a governed runtime

> **Current Contract Note:** The current implemented package contract is [packages/planner/docs/planner-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/planner/docs/planner-SPEC.md). The broader future-phase design remains in the internal [planner draft spec](https://github.com/manifesto-ai/core/blob/main/docs/internals/spec/planner-SPEC-v1.2.0-draft.md).

## Canonical Surface

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
    { bindings, execution },
  ),
  {
    planner,
    strategy: mctsStrategy({ useTerm: "reward", budget: 1000 }),
  },
).activate();
```

## Current First Slice

The current implemented root-package surface is:

- `createPlanner()`
- `withPlanner()`
- `greedyStrategy()`
- `mctsStrategy()`
- `createCoreEnumerator()`

The activated runtime adds:

- `preview(actionRef, ...args)`
- `plan(options?)`

`SelectedAction.intent` values are directly reusable with `proposeAsync()` from the governed runtime.

## Enumerator Boundary

`createCoreEnumerator()` is intentionally conservative:

- it only emits action-name candidates
- it does not synthesize domain-specific inputs

If your action space needs input candidates, pass a custom `enumerator` into `withPlanner(...)`.

## Current Scope

- planning is read-only and uses the SDK provider simulation seam
- public snapshots are projected; internal search uses canonical snapshots
- the bundled strategies are `greedyStrategy()` and `mctsStrategy()`
- `mctsStrategy()` uses deterministic rollouts and treats `pending` rollout states as terminal in the current slice

## Related Docs

- [SDK API](./sdk.md)
- [Lineage API](./lineage.md)
- [Governance API](./governance.md)
- [Specifications](/internals/spec/)
