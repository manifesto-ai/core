/**
 * Publish Boundary Stress Tests
 *
 * PUB-3: state:publish MUST NOT fire per intermediate apply/computed step.
 * It MUST fire at most once per proposal tick, using terminal snapshot.
 */

import { describe, it, expect } from "vitest";
import { createTestApp } from "../index.js";
import type { DomainSchema, Patch, Snapshot } from "@manifesto-ai/core";

function createStressSchema(): DomainSchema {
  return {
    id: "test:publish-stress",
    version: "1.0.0",
    hash: "schema-publish-stress",
    types: {},
    state: {
      fields: {
        firstDone: { type: "boolean", default: false, required: false },
        secondDone: { type: "boolean", default: false, required: false },
        steps: { type: "array", default: [], required: false },
        finalCount: { type: "number", default: 0, required: false },
      },
    },
    computed: {
      fields: {
        "computed.finalPlusOne": {
          deps: ["data.finalCount"],
          expr: {
            kind: "add",
            left: {
              kind: "coalesce",
              args: [
                { kind: "get", path: "data.finalCount" },
                { kind: "lit", value: 0 },
              ],
            },
            right: { kind: "lit", value: 1 },
          },
        },
      },
    },
    actions: {
      "stress.multiApply": {
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "if",
              cond: { kind: "not", arg: { kind: "get", path: "firstDone" } },
              then: { kind: "effect", type: "effect.first", params: {} },
            },
            { kind: "patch", op: "set", path: "firstDone", value: { kind: "lit", value: true } },
            {
              kind: "if",
              cond: { kind: "not", arg: { kind: "get", path: "secondDone" } },
              then: { kind: "effect", type: "effect.second", params: {} },
            },
            { kind: "patch", op: "set", path: "secondDone", value: { kind: "lit", value: true } },
            {
              kind: "patch",
              op: "set",
              path: "finalCount",
              value: { kind: "lit", value: 2 },
            },
          ],
        },
      },
    },
  };
}

describe("Publish Boundary Stress", () => {
  it("PUB-3: emits state:publish exactly once for multi-apply proposal and uses terminal snapshot", async () => {
    const schema = createStressSchema();

    const effectCallOrder: string[] = [];
    const app = createTestApp(schema, {
      effects: {
        "effect.first": async (_params, ctx) => {
          effectCallOrder.push("first");
          const current = (ctx.snapshot.data.steps as string[] | undefined) ?? [];
          const patches: Patch[] = [
            { op: "set", path: "steps", value: [...current, "first"] },
            { op: "set", path: "firstDone", value: true },
          ];
          return patches;
        },
        "effect.second": async (_params, ctx) => {
          effectCallOrder.push("second");
          const current = (ctx.snapshot.data.steps as string[] | undefined) ?? [];
          const patches: Patch[] = [
            { op: "set", path: "steps", value: [...current, "second"] },
            { op: "set", path: "secondDone", value: true },
          ];
          return patches;
        },
      },
    });

    await app.ready();

    const publishes: Array<{ snapshot: Snapshot; worldId: string }> = [];
    app.hooks.on("state:publish", (payload) => {
      publishes.push(payload);
    });

    const result = await app.act("stress.multiApply", {}).done();

    expect(result.status).toBe("completed");
    expect(effectCallOrder).toEqual(["first", "second"]);

    // PUB-3: no per-apply publish; exactly once at proposal terminal boundary
    expect(publishes).toHaveLength(1);

    const publishedSnapshot = publishes[0].snapshot;
    expect(publishedSnapshot.data).toMatchObject({
      firstDone: true,
      secondDone: true,
      steps: ["first", "second"],
      finalCount: 2,
    });

    // Terminal snapshot fidelity: published snapshot reflects final app state
    const finalState = app.getState<{
      firstDone: boolean;
      secondDone: boolean;
      steps: string[];
      finalCount: number;
    }>();
    expect(publishedSnapshot.data).toEqual(finalState.data);
  });
});
