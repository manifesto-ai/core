import { describe, expect, it } from "vitest";
import {
  semanticPathToPatchPath,
  hashSchemaSync,
  type DomainSchema,
} from "@manifesto-ai/core";

import {
  createCounterSchema,
  type CounterDomain,
} from "../../../sdk/src/__tests__/helpers/schema.ts";
import { createGovernedManifesto } from "./helpers/runtime.ts";
import {
  createPlanner,
  greedyStrategy,
  mctsStrategy,
  withPlanner,
  type ActionEnumerator,
} from "../index.js";

const pp = semanticPathToPatchPath;

type StrategicDomain = {
  actions: {
    setup: () => void;
    cashOut: () => void;
    safe: () => void;
  };
  state: {
    armed: number;
    score: number;
  };
  computed: {};
};

function createStrategicSchema(): DomainSchema {
  const schema: Omit<DomainSchema, "hash"> = {
    id: "manifesto:planner-mcts-strategic",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        armed: { type: "number", required: false, default: 0 },
        score: { type: "number", required: false, default: 0 },
      },
    },
    computed: {
      fields: {},
    },
    actions: {
      cashOut: {
        available: {
          kind: "eq",
          left: { kind: "get", path: "armed" },
          right: { kind: "lit", value: 1 },
        },
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "patch",
              op: "set",
              path: pp("score"),
              value: { kind: "lit", value: 5 },
            },
            {
              kind: "patch",
              op: "set",
              path: pp("armed"),
              value: { kind: "lit", value: 0 },
            },
          ],
        },
      },
      setup: {
        flow: {
          kind: "patch",
          op: "set",
          path: pp("armed"),
          value: { kind: "lit", value: 1 },
        },
      },
      safe: {
        flow: {
          kind: "patch",
          op: "set",
          path: pp("score"),
          value: { kind: "lit", value: 2 },
        },
      },
    },
  };

  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

function createCounterRewardPlanner() {
  return createPlanner<CounterDomain>()
    .features({
      count: (snapshot) => snapshot.data.count,
    })
    .terms({
      reward: (features) => features.count,
    })
    .build();
}

function createCounterStepEnumerator(): ActionEnumerator<CounterDomain> {
  return {
    enumerate() {
      return Object.freeze([
        { actionName: "increment" },
        { actionName: "incrementIfEven" },
      ]);
    },
  };
}

describe("@manifesto-ai/planner mcts strategy", () => {
  it("finds a better two-step path than greedy when depth matters", async () => {
    const planner = createPlanner<StrategicDomain>()
      .features({
        score: (snapshot) => snapshot.data.score,
      })
      .terms({
        reward: (features) => features.score,
      })
      .build();

    const enumerator = {
      enumerate(snapshot) {
        if (snapshot.data.armed === 1) {
          return Object.freeze([
            { actionName: "cashOut" },
          ]);
        }

        return Object.freeze([
          { actionName: "setup" },
          { actionName: "safe" },
        ]);
      },
    } satisfies ActionEnumerator<StrategicDomain>;

    const greedyApp = withPlanner(
      createGovernedManifesto<StrategicDomain>(createStrategicSchema(), {}),
      {
        planner,
        strategy: greedyStrategy({ useTerm: "reward" }),
        enumerator,
      },
    ).activate();

    const mctsApp = withPlanner(
      createGovernedManifesto<StrategicDomain>(createStrategicSchema(), {}),
      {
        planner,
        strategy: mctsStrategy({ useTerm: "reward", budget: 16 }),
        enumerator,
      },
    ).activate();

    const greedyPlan = await greedyApp.plan();
    const mctsPlan = await mctsApp.plan({ depthOverride: 2 });

    expect(greedyPlan.bestAction?.actionName).toBe("safe");
    expect(mctsPlan.bestAction?.actionName).toBe("setup");
    expect(mctsPlan.bestAction?.evaluation.terms.reward).toBe(5);
    expect(mctsPlan.bestAction?.trajectory).toHaveLength(2);
    expect(mctsPlan.bestAction?.trajectory[1]?.action.actionName).toBe("cashOut");
    expect(mctsPlan.bestAction?.trajectory[1]?.snapshotAfter.data.score).toBe(5);
    expect(mctsPlan.bestAction?.confidence).toBeGreaterThanOrEqual(0);
    expect(mctsPlan.bestAction?.confidence).toBeLessThanOrEqual(1);
  });

  it("treats pending rollout states as terminal and still returns a valid plan", async () => {
    const planner = createPlanner<CounterDomain>()
      .features({
        loading: (snapshot) => snapshot.data.status === "loading" ? 1 : 0,
      })
      .terms({
        reward: (features) => features.loading,
      })
      .build();

    const enumerator = {
      enumerate() {
        return Object.freeze([
          { actionName: "load" },
        ]);
      },
    } satisfies ActionEnumerator<CounterDomain>;

    const app = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {
        "api.fetch": async () => [],
      }),
      {
        planner,
        strategy: mctsStrategy({ useTerm: "reward", budget: 8 }),
        enumerator,
      },
    ).activate();

    const plan = await app.plan();

    expect(plan.bestAction?.actionName).toBe("load");
    expect(plan.bestAction?.trajectory).toHaveLength(1);
    expect(plan.bestAction?.trajectory[0]?.snapshotAfter.data.status).toBe("loading");
    expect(plan.bestAction?.evaluation.terms.reward).toBe(1);
    expect(plan.stats.terminationReason).toBe("completed");
  });

  it("reuses the selected MCTS intent directly through proposeAsync()", async () => {
    const app = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        planner: createCounterRewardPlanner(),
        strategy: mctsStrategy({ useTerm: "reward", budget: 12 }),
        enumerator: createCounterStepEnumerator(),
      },
    ).activate();

    const plan = await app.plan();
    expect(plan.bestAction?.actionName).toBe("incrementIfEven");

    const proposal = await app.proposeAsync(plan.bestAction!.intent);
    expect(proposal.status).toBe("completed");
    expect(app.getSnapshot().data.count).toBe(10);
  });

  it("is deterministic for identical root snapshots and parameters", async () => {
    const app = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        planner: createCounterRewardPlanner(),
        strategy: mctsStrategy({ useTerm: "reward", budget: 12 }),
        enumerator: createCounterStepEnumerator(),
      },
    ).activate();

    const left = await app.plan();
    const right = await app.plan();

    expect(left.bestAction?.actionName).toBe(right.bestAction?.actionName);
    expect(left.bestAction?.evaluation.terms.reward).toBe(right.bestAction?.evaluation.terms.reward);
    expect(left.alternatives.map((candidate) => candidate.actionName)).toEqual(
      right.alternatives.map((candidate) => candidate.actionName),
    );
  });

  it("clamps the iteration budget by hardPolicy.maxExpansions", async () => {
    const app = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        planner: createCounterRewardPlanner(),
        strategy: mctsStrategy({ useTerm: "reward", budget: 99 }),
        hardPolicy: { maxExpansions: 1 },
      },
    ).activate();

    const plan = await app.plan();

    expect(plan.stats.expansions).toBe(1);
    expect(plan.stats.terminationReason).toBe("budget_exhausted");
  });

  it("returns timeout or signal_aborted without mutating runtime state", async () => {
    const planner = createCounterRewardPlanner();

    const timeoutApp = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        planner,
        strategy: mctsStrategy({ useTerm: "reward", budget: 32 }),
        hardPolicy: { timeoutMs: 0, maxExpansions: 10 },
      },
    ).activate();

    const timeoutPlan = await timeoutApp.plan();
    expect(timeoutPlan.bestAction).toBeNull();
    expect(timeoutPlan.stats.terminationReason).toBe("timeout");
    expect(timeoutApp.getSnapshot().data.count).toBe(0);

    const controller = new AbortController();
    controller.abort();

    const abortedApp = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        planner,
        strategy: mctsStrategy({ useTerm: "reward", budget: 32 }),
      },
    ).activate();

    const abortedPlan = await abortedApp.plan({ signal: controller.signal });
    expect(abortedPlan.bestAction).toBeNull();
    expect(abortedPlan.stats.terminationReason).toBe("signal_aborted");
  });
});
