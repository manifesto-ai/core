import { describe, expect, it, vi } from "vitest";
import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";
import { AlreadyActivatedError, ManifestoError, createManifesto } from "@manifesto-ai/sdk";

import {
  type LineageService,
} from "./types.js";
import { createInMemoryLineageStore } from "./store/in-memory-lineage-store.js";
import { createLineageService } from "./service/lineage-service.js";
import { withLineage } from "./with-lineage.js";

const pp = semanticPathToPatchPath;

type CounterDomain = {
  actions: {
    increment: () => void;
    add: (amount: number) => void;
    load: () => void;
  };
  state: {
    count: number;
    status: string;
  };
  computed: {
    doubled: number;
  };
};

function withHash(schema: Omit<DomainSchema, "hash">): DomainSchema {
  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

function createCounterSchema(): DomainSchema {
  return withHash({
    id: "manifesto:lineage-v3-counter",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
        status: { type: "string", required: false, default: "idle" },
      },
    },
    computed: {
      fields: {
        doubled: {
          deps: ["count"],
          expr: {
            kind: "mul",
            left: { kind: "get", path: "count" },
            right: { kind: "lit", value: 2 },
          },
        },
      },
    },
    actions: {
      increment: {
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: {
            kind: "add",
            left: { kind: "get", path: "count" },
            right: { kind: "lit", value: 1 },
          },
        },
      },
      add: {
        input: {
          type: "object",
          required: true,
          fields: {
            amount: { type: "number", required: true },
          },
        },
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: {
            kind: "add",
            left: { kind: "get", path: "count" },
            right: { kind: "get", path: "input.amount" },
          },
        },
      },
      load: {
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "patch",
              op: "set",
              path: pp("status"),
              value: { kind: "lit", value: "loading" },
            },
            {
              kind: "effect",
              type: "api.fetch",
              params: {},
            },
          ],
        },
      },
    },
  });
}

describe("@manifesto-ai/lineage decorator runtime", () => {
  it("seals successful commits before publishing the visible snapshot", async () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const world = withLineage(
      createManifesto<CounterDomain>(createCounterSchema(), {}),
      { service },
    ).activate();

    const subscriber = vi.fn();
    const completed = vi.fn();

    world.subscribe((snapshot) => snapshot.data.count, subscriber);
    world.on("dispatch:completed", completed);

    const snapshot = await world.commitAsync(
      world.createIntent(world.MEL.actions.increment),
    );

    expect(snapshot.data.count).toBe(1);
    expect(world.getSnapshot().data.count).toBe(1);
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenCalledTimes(1);

    const head = await world.getLatestHead();
    const lineage = await world.getLineage();
    expect(head).not.toBeNull();
    expect(head?.worldId).toBe((await service.getActiveBranch()).head);
    expect((await service.restore(head!.worldId)).data.count).toBe(1);
    expect(lineage.worlds.size).toBeGreaterThan(0);
  });

  it("rejects seal failures without publishing a new visible snapshot", async () => {
    const store = createInMemoryLineageStore();
    const realService = createLineageService(store);
    let commitCount = 0;
    const service: LineageService = {
      prepareSealGenesis: realService.prepareSealGenesis.bind(realService),
      prepareSealNext: realService.prepareSealNext.bind(realService),
      async commitPrepared(prepared) {
        commitCount += 1;
        if (commitCount > 1) {
          throw new Error("seal commit failed");
        }
        return realService.commitPrepared(prepared);
      },
      createBranch: realService.createBranch.bind(realService),
      getBranch: realService.getBranch.bind(realService),
      getBranches: realService.getBranches.bind(realService),
      getActiveBranch: realService.getActiveBranch.bind(realService),
      switchActiveBranch: realService.switchActiveBranch.bind(realService),
      getWorld: realService.getWorld.bind(realService),
      getSnapshot: realService.getSnapshot.bind(realService),
      getAttempts: realService.getAttempts.bind(realService),
      getAttemptsByBranch: realService.getAttemptsByBranch.bind(realService),
      getLineage: realService.getLineage.bind(realService),
      getHeads: realService.getHeads.bind(realService),
      getLatestHead: realService.getLatestHead.bind(realService),
      restore: realService.restore.bind(realService),
    };

    const world = withLineage(
      createManifesto<CounterDomain>(createCounterSchema(), {}),
      { service },
    ).activate();

    const subscriber = vi.fn();
    const failed = vi.fn();

    world.subscribe((snapshot) => snapshot.data.count, subscriber);
    world.on("dispatch:failed", failed);

    await expect(
      world.commitAsync(world.createIntent(world.MEL.actions.increment)),
    ).rejects.toThrow("seal commit failed");

    expect(world.getSnapshot().data.count).toBe(0);
    expect(subscriber).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it("seals failed terminal snapshots without advancing the visible head snapshot", async () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const world = withLineage(
      createManifesto<CounterDomain>(createCounterSchema(), {
        "api.fetch": async () => {
          throw new Error("boom");
        },
      }),
      { service },
    ).activate();

    await expect(
      world.commitAsync(world.createIntent(world.MEL.actions.load)),
    ).rejects.toBeInstanceOf(Error);

    expect(world.getSnapshot().data.status).toBe("idle");

    const activeBranch = await service.getActiveBranch();
    const attempts = await service.getAttemptsByBranch(activeBranch.id);
    expect(attempts).toHaveLength(2);
    expect(activeBranch.head).not.toBe(attempts[1]?.worldId);

    const failedWorld = await service.getWorld(attempts[1]!.worldId);
    expect(failedWorld?.terminalStatus).toBe("failed");
  });

  it("hydrates from an existing active branch on the first async lineage operation", async () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const first = withLineage(
      createManifesto<CounterDomain>(createCounterSchema(), {}),
      { service },
    ).activate();

    await first.commitAsync(first.createIntent(first.MEL.actions.add, 3));
    first.dispose();

    const reopened = withLineage(
      createManifesto<CounterDomain>(createCounterSchema(), {}),
      { service },
    ).activate();

    expect(reopened.getSnapshot().data.count).toBe(0);
    const head = await reopened.getLatestHead();

    expect(head).not.toBeNull();
    expect(reopened.getSnapshot().data.count).toBe(3);
  });

  it("rejects missing runtime config with a ManifestoError instead of a raw TypeError", () => {
    const base = createManifesto<CounterDomain>(createCounterSchema(), {});

    expect(() => withLineage(base, undefined as never)).toThrow(ManifestoError);
    expect(() => withLineage(base, undefined as never)).toThrow(
      "withLineage() requires a config object with either service or store",
    );
  });

  it("supports restore, branch creation, and branch switching on the activated runtime", async () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const world = withLineage(
      createManifesto<CounterDomain>(createCounterSchema(), {}),
      { service },
    ).activate();

    await world.commitAsync(world.createIntent(world.MEL.actions.add, 2));
    const mainHead = await world.getLatestHead();

    const featureBranchId = await world.createBranch("feature");
    const switchResult = await world.switchActiveBranch(featureBranchId);
    expect(switchResult.targetBranchId).toBe(featureBranchId);
    expect((await world.getActiveBranch()).id).toBe(featureBranchId);

    await world.commitAsync(world.createIntent(world.MEL.actions.increment));
    expect(world.getSnapshot().data.count).toBe(3);

    await world.restore(mainHead!.worldId);
    expect(world.getSnapshot().data.count).toBe(2);
  });

  it("shares activation ownership with the base composable", () => {
    const base = createManifesto<CounterDomain>(createCounterSchema(), {});
    const lineage = withLineage(base, { store: createInMemoryLineageStore() });

    const world = lineage.activate();

    expect(() => base.activate()).toThrow(AlreadyActivatedError);

    world.dispose();
  });
});
