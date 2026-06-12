import { describe, expect, it } from "vitest";
import { hashSchemaSync, semanticPathToPatchPath, type DomainSchema } from "@manifesto-ai/core";
import { createManifesto } from "@manifesto-ai/sdk";

import { createInMemoryLineageStore, withLineage } from "../index.js";

const pp = semanticPathToPatchPath;

type EffectTestDomain = {
  actions: {
    probe: () => void;
    bump: () => void;
  };
  state: {
    counter: number;
  };
  computed: {};
};

/**
 * Regression tests for #490: effect-bearing dispatches must advance the
 * branch head like pure dispatches do. Head advancement used to require
 * every host trace to terminate with "complete", but an effect-bearing
 * dispatch legitimately records an intermediate "pending" trace before the
 * settlement pass — so the head never advanced, and subsequent seals
 * executed from a stale base.
 */
function createEffectTestSchema(): DomainSchema {
  const schema: Omit<DomainSchema, "hash"> = {
    id: "manifesto:lineage-490-effect-head",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        counter: { type: "number", required: false, default: 0 },
      },
    },
    computed: { fields: {} },
    actions: {
      probe: {
        flow: {
          kind: "causalGuard",
          guardId: "probe",
          body: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: pp("counter"),
                value: {
                  kind: "add",
                  left: { kind: "get", path: "counter" },
                  right: { kind: "lit", value: 1 },
                },
              },
              {
                kind: "effect",
                type: "tracer.ping",
                params: { v: { kind: "get", path: "counter" } },
              },
            ],
          },
        },
      },
      bump: {
        flow: {
          kind: "causalGuard",
          guardId: "bump",
          body: {
            kind: "patch",
            op: "set",
            path: pp("counter"),
            value: {
              kind: "add",
              left: { kind: "get", path: "counter" },
              right: { kind: "lit", value: 10 },
            },
          },
        },
      },
    },
  };

  return { ...schema, hash: hashSchemaSync(schema) };
}

function createApp(pings: unknown[]) {
  return withLineage(
    createManifesto<EffectTestDomain>(createEffectTestSchema(), {
      "tracer.ping": async (params) => {
        pings.push(params);
        return [];
      },
    }),
    { store: createInMemoryLineageStore() },
  ).activate();
}

describe("lineage head advancement for effect-bearing dispatches (#490)", () => {
  it("an effect-bearing dispatch advances the visible state", async () => {
    const pings: unknown[] = [];
    const app = createApp(pings);

    const first = await app.action.probe.submit();
    expect(first.ok).toBe(true);
    expect(app.snapshot().state.counter).toBe(1);
    expect(pings).toEqual([{ v: 1 }]);
  });

  it("sequential effect-bearing dispatches chain instead of resealing a stale base", async () => {
    const pings: unknown[] = [];
    const app = createApp(pings);

    const first = await app.action.probe.submit();
    const second = await app.action.probe.submit();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    // The second seal must execute from the first sealed state…
    expect(app.snapshot().state.counter).toBe(2);
    expect(pings).toEqual([{ v: 1 }, { v: 2 }]);

    // …and must chain onto the first world, not share its parent.
    if (first.ok && second.ok) {
      expect(second.world.parentWorldId).toBe(first.world.worldId);
      expect(second.world.worldId).not.toBe(first.world.worldId);
    }
  });

  it("a pure dispatch after an effect-bearing dispatch sees the sealed effect state", async () => {
    const pings: unknown[] = [];
    const app = createApp(pings);

    const probed = await app.action.probe.submit();
    const bumped = await app.action.bump.submit();

    expect(probed.ok).toBe(true);
    expect(bumped.ok).toBe(true);

    // 0 +1 (probe) +10 (bump) — the bump must not execute from a rolled-back
    // pre-probe snapshot.
    expect(app.snapshot().state.counter).toBe(11);

    if (probed.ok && bumped.ok) {
      expect(bumped.world.parentWorldId).toBe(probed.world.worldId);
    }
  });
});
