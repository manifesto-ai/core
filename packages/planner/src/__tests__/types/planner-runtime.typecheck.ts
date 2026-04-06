import type { Intent } from "../../../../sdk/src/index.ts";

import { createManifesto } from "../../../../sdk/src/index.ts";
import {
  createCounterSchema,
  type CounterDomain,
} from "../../../../sdk/src/__tests__/helpers/schema.ts";
import {
  createInMemoryLineageStore,
  withLineage,
} from "../../../../lineage/src/index.ts";
import {
  withGovernance,
} from "../../../../governance/src/index.ts";
import {
  createPlanner,
  greedyStrategy,
  mctsStrategy,
  withPlanner,
} from "../../index.ts";

const planner = createPlanner<CounterDomain>()
  .features({
    count: (snapshot) => snapshot.data.count,
  })
  .parameters({
    bias: 1,
  })
  .terms({
    reward: (features, parameters) => features.count + parameters.bias,
  })
  .build();

planner.setParameter("bias", 2);

// @ts-expect-error planner parameters are key-safe
planner.setParameter("missing", 1);

const base = createManifesto<CounterDomain>(createCounterSchema(), {});

// @ts-expect-error planner requires governance composition
withPlanner(base, {
  planner,
  strategy: greedyStrategy({ useTerm: "reward" }),
});

const lineageOnly = withLineage(base, {
  store: createInMemoryLineageStore(),
});

// @ts-expect-error planner requires governance composition
withPlanner(lineageOnly, {
  planner,
  strategy: greedyStrategy({ useTerm: "reward" }),
});

const governed = withGovernance(
  lineageOnly,
  {
    bindings: [],
    execution: {
      projectionId: "planner:typecheck",
      deriveActor: () => ({ actorId: "actor:auto", kind: "agent" as const }),
      deriveSource: () => ({ kind: "agent" as const, eventId: "evt:planner:typecheck" }),
    },
  },
);

const app = withPlanner(governed, {
  planner,
  strategy: greedyStrategy({ useTerm: "reward" }),
}).activate();

const mctsApp = withPlanner(governed, {
  planner,
  strategy: mctsStrategy({ useTerm: "reward", budget: 8 }),
}).activate();

const preview = app.preview(app.MEL.actions.increment);
const previewReward: number = preview.evaluation.terms.reward;
void previewReward;

void app.plan().then((plan) => {
  if (plan.bestAction) {
    const reward: number = plan.bestAction.evaluation.terms.reward;
    void reward;
    void app.proposeAsync(plan.bestAction.intent);
  }
});

void mctsApp.plan().then((plan) => {
  if (plan.bestAction) {
    const reward: number = plan.bestAction.evaluation.terms.reward;
    void reward;
  }
});

// @ts-expect-error governed planner runtime still removes dispatchAsync
app.dispatchAsync(app.createIntent(app.MEL.actions.increment));

// @ts-expect-error governed planner runtime still removes commitAsync
app.commitAsync(app.createIntent(app.MEL.actions.increment));

const rawIntent: Intent = {
  type: "increment",
  intentId: "raw-intent",
};

// @ts-expect-error proposeAsync only accepts branded intents
void app.proposeAsync(rawIntent);

export {};
