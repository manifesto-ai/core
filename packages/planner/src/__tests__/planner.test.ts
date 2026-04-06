import { describe, expect, it } from "vitest";
import {
  semanticPathToPatchPath,
  hashSchemaSync,
  type DomainSchema,
} from "@manifesto-ai/core";
import type { ManifestoDomainShape } from "@manifesto-ai/sdk";
import { createCounterSchema, type CounterDomain } from "../../../sdk/src/__tests__/helpers/schema.ts";
import {
  createGovernedManifesto,
} from "./helpers/runtime.ts";
import {
  PlannerActivationError,
  createPlanner,
  greedyStrategy,
  withPlanner,
  type ActionEnumerator,
} from "../index.js";

const pp = semanticPathToPatchPath;

type NoActionDomain = {
  actions: {
    onlyIfEven: () => void;
  };
  state: {
    count: number;
  };
  computed: {};
};

type RiskDomain = {
  actions: {
    safe: () => void;
    risky: () => void;
  };
  state: {
    score: number;
    risk: number;
  };
  computed: {};
};

function createNoActionSchema(): DomainSchema {
  const schema: Omit<DomainSchema, "hash"> = {
    id: "manifesto:planner-no-actions",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 1 },
      },
    },
    computed: {
      fields: {},
    },
    actions: {
      onlyIfEven: {
        available: {
          kind: "eq",
          left: {
            kind: "mod",
            left: { kind: "get", path: "count" },
            right: { kind: "lit", value: 2 },
          },
          right: { kind: "lit", value: 0 },
        },
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
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

function createRiskSchema(): DomainSchema {
  const schema: Omit<DomainSchema, "hash"> = {
    id: "manifesto:planner-risk",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        score: { type: "number", required: false, default: 0 },
        risk: { type: "number", required: false, default: 0 },
      },
    },
    computed: {
      fields: {},
    },
    actions: {
      safe: {
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "patch",
              op: "set",
              path: pp("score"),
              value: { kind: "lit", value: 1 },
            },
            {
              kind: "patch",
              op: "set",
              path: pp("risk"),
              value: { kind: "lit", value: 0 },
            },
          ],
        },
      },
      risky: {
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
              path: pp("risk"),
              value: { kind: "lit", value: 1 },
            },
          ],
        },
      },
    },
  };

  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

describe("@manifesto-ai/planner first slice", () => {
  it("previews a single action without mutating the governed runtime", () => {
    const planner = createPlanner<CounterDomain>()
      .features({
        count: (snapshot) => snapshot.data.count,
      })
      .terms({
        reward: (features) => features.count,
      })
      .build();

    const app = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        planner,
        strategy: greedyStrategy({ useTerm: "reward" }),
      },
    ).activate();

    const preview = app.preview(app.MEL.actions.incrementIfEven);

    expect(preview.snapshotAfter.data.count).toBe(10);
    expect(preview.evaluation.terms.reward).toBe(10);
    expect(preview.status).toBe("complete");
    expect("$host" in (preview.snapshotAfter.data as Record<string, unknown>)).toBe(false);
    expect(app.getSnapshot().data.count).toBe(0);
  });

  it("returns pending requirements from preview() for effectful actions", () => {
    const planner = createPlanner<CounterDomain>()
      .features({
        count: (snapshot) => snapshot.data.count,
      })
      .terms({
        reward: (features) => features.count,
      })
      .build();

    const app = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {
        "api.fetch": async () => [],
      }),
      {
        planner,
        strategy: greedyStrategy({ useTerm: "reward" }),
      },
    ).activate();

    const preview = app.preview(app.MEL.actions.load);

    expect(preview.status).toBe("pending");
    expect(preview.pendingRequirements.length).toBe(1);
    expect(app.getSnapshot().data.status).toBe("idle");
  });

  it("plans greedily over the conservative core enumerator and returns projected trajectories", async () => {
    const planner = createPlanner<CounterDomain>()
      .features({
        count: (snapshot) => snapshot.data.count,
      })
      .terms({
        reward: (features) => features.count,
      })
      .build();

    const app = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        planner,
        strategy: greedyStrategy({ useTerm: "reward" }),
      },
    ).activate();

    const plan = await app.plan();

    expect(plan.bestAction?.actionName).toBe("incrementIfEven");
    expect(plan.bestAction?.evaluation.terms.reward).toBe(10);
    expect(plan.alternatives.map((candidate) => candidate.actionName)).toEqual([
      "increment",
      "add",
      "load",
    ]);
    expect(plan.stats.terminationReason).toBe("completed");
    expect(plan.bestAction?.trajectory[0]?.snapshotAfter.data.count).toBe(10);
    expect("$host" in ((plan.bestAction?.trajectory[0]?.snapshotAfter.data ?? {}) as Record<string, unknown>)).toBe(false);
  });

  it("reuses the selected intent directly through proposeAsync()", async () => {
    type AddOnlyDomain = Pick<CounterDomain, "actions" | "state" | "computed">;

    const planner = createPlanner<CounterDomain>()
      .features({
        count: (snapshot) => snapshot.data.count,
      })
      .terms({
        reward: (features) => features.count,
      })
      .build();

    const enumerator: ActionEnumerator<CounterDomain> = {
      enumerate(snapshot) {
        return Object.freeze([
          { actionName: "increment" },
          { actionName: "add", input: 5 },
          snapshot.data.count % 2 === 0
            ? { actionName: "incrementIfEven" }
            : { actionName: "increment" },
        ]);
      },
    };

    const app = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        planner,
        strategy: greedyStrategy({ useTerm: "reward" }),
        enumerator,
      },
    ).activate();

    const plan = await app.plan();
    expect(plan.bestAction?.actionName).toBe("incrementIfEven");

    const proposal = await app.proposeAsync(plan.bestAction!.intent);
    expect(proposal.status).toBe("completed");
    expect(app.getSnapshot().data.count).toBe(10);
  });

  it("returns no_actions when the enumerated action space is empty", async () => {
    const planner = createPlanner<NoActionDomain>()
      .features({
        count: (snapshot) => snapshot.data.count,
      })
      .terms({
        reward: (features) => features.count,
      })
      .build();

    const app = withPlanner(
      createGovernedManifesto<NoActionDomain>(createNoActionSchema(), {}),
      {
        planner,
        strategy: greedyStrategy({ useTerm: "reward" }),
      },
    ).activate();

    const plan = await app.plan();

    expect(plan.bestAction).toBeNull();
    expect(plan.alternatives).toHaveLength(0);
    expect(plan.stats.terminationReason).toBe("no_actions");
  });

  it("fails activation when the strategy requires undefined terms", () => {
    const planner = createPlanner<CounterDomain>()
      .features({
        count: (snapshot) => snapshot.data.count,
      })
      .terms({
        utility: (features) => features.count,
      })
      .build();

    expect(() => withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        planner,
        strategy: greedyStrategy<CounterDomain, "reward">({ useTerm: "reward" }),
      },
    ).activate()).toThrow(PlannerActivationError);
  });

  it("clamps plan options and returns timeout without mutating runtime state", async () => {
    const planner = createPlanner<CounterDomain>()
      .features({
        count: (snapshot) => snapshot.data.count,
      })
      .terms({
        reward: (features) => features.count,
      })
      .build();

    const app = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        planner,
        strategy: greedyStrategy({ useTerm: "reward" }),
        hardPolicy: { timeoutMs: 0, maxExpansions: 10 },
      },
    ).activate();

    const plan = await app.plan({
      budgetOverride: 1_000,
    });

    expect(plan.bestAction).toBeNull();
    expect(plan.stats.terminationReason).toBe("timeout");
    expect(app.getSnapshot().data.count).toBe(0);
  });

  it("returns signal_aborted when the provided signal is already aborted", async () => {
    const planner = createPlanner<CounterDomain>()
      .features({
        count: (snapshot) => snapshot.data.count,
      })
      .terms({
        reward: (features) => features.count,
      })
      .build();

    const controller = new AbortController();
    controller.abort();

    const app = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        planner,
        strategy: greedyStrategy({ useTerm: "reward" }),
      },
    ).activate();

    const plan = await app.plan({ signal: controller.signal });

    expect(plan.bestAction).toBeNull();
    expect(plan.alternatives).toHaveLength(0);
    expect(plan.stats.terminationReason).toBe("signal_aborted");
  });

  it("applies parameter changes to the next planning call", async () => {
    const planner = createPlanner<RiskDomain>()
      .features({
        score: (snapshot) => snapshot.data.score,
        risk: (snapshot) => snapshot.data.risk,
      })
      .parameters({
        riskWeight: 10,
      })
      .terms({
        reward: (features, parameters) => features.score - (features.risk * parameters.riskWeight),
      })
      .build();

    const app = withPlanner(
      createGovernedManifesto<RiskDomain>(createRiskSchema(), {}),
      {
        planner,
        strategy: greedyStrategy({ useTerm: "reward" }),
      },
    ).activate();

    const conservativePlan = await app.plan();
    expect(conservativePlan.bestAction?.actionName).toBe("safe");

    planner.setParameter("riskWeight", 1);

    const aggressivePlan = await app.plan();
    expect(aggressivePlan.bestAction?.actionName).toBe("risky");
  });

  it("supports concurrent plan() calls on the same activated runtime", async () => {
    const planner = createPlanner<CounterDomain>()
      .features({
        count: (snapshot) => snapshot.data.count,
      })
      .terms({
        reward: (features) => features.count,
      })
      .build();

    const app = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        planner,
        strategy: greedyStrategy({ useTerm: "reward" }),
      },
    ).activate();

    const [left, right] = await Promise.all([app.plan(), app.plan()]);

    expect(left.bestAction?.actionName).toBe("incrementIfEven");
    expect(right.bestAction?.actionName).toBe("incrementIfEven");
    expect(left.bestAction?.intent.intentId).not.toBe(right.bestAction?.intent.intentId);
  });

  it("rejects invalid planner parameter numbers", () => {
    expect(() => createPlanner<RiskDomain>()
      .features({
        score: (snapshot) => snapshot.data.score,
      })
      .parameters({
        riskWeight: Number.NaN,
      })
      .terms({
        reward: (features, parameters) => features.score - parameters.riskWeight,
      })
      .build()).toThrow("finite number");
  });

  it("rejects custom enumerators that invent unknown actions at runtime", async () => {
    const planner = createPlanner<CounterDomain>()
      .features({
        count: (snapshot) => snapshot.data.count,
      })
      .terms({
        reward: (features) => features.count,
      })
      .build();

    const enumerator = {
      enumerate() {
        return Object.freeze([
          { actionName: "missing:action" as keyof CounterDomain["actions"] & string },
        ]);
      },
    } satisfies ActionEnumerator<CounterDomain>;

    const app = withPlanner(
      createGovernedManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        planner,
        strategy: greedyStrategy({ useTerm: "reward" }),
        enumerator,
      },
    ).activate();

    await expect(app.plan()).rejects.toThrow('unknown action "missing:action"');
  });
});
