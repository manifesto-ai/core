import { describe, expect, it, vi } from "vitest";
import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";
import { AlreadyActivatedError, ManifestoError, createManifesto } from "@manifesto-ai/sdk";
import { getExtensionKernel } from "../../sdk/src/extensions.js";

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

type DispatchabilityDomain = {
  actions: {
    spend: (amount: number) => void;
    frozenSpend: (amount: number) => void;
  };
  state: {
    balance: number;
    enabled: boolean;
  };
  computed: {};
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

function createDispatchabilitySchema(): DomainSchema {
  return withHash({
    id: "manifesto:lineage-v3-dispatchability",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        balance: { type: "number", required: true, default: 10 },
        enabled: { type: "boolean", required: true, default: true },
      },
    },
    computed: { fields: {} },
    actions: {
      spend: {
        input: {
          type: "object",
          required: true,
          fields: {
            amount: { type: "number", required: true },
          },
        },
        available: { kind: "get", path: "enabled" },
        dispatchable: {
          kind: "gte",
          left: { kind: "get", path: "balance" },
          right: { kind: "get", path: "input.amount" },
        },
        description: "Spend only when balance covers amount",
        flow: { kind: "halt", reason: "spend" },
      },
      frozenSpend: {
        input: {
          type: "object",
          required: true,
          fields: {
            amount: { type: "number", required: true },
          },
        },
        available: { kind: "lit", value: false },
        dispatchable: { kind: "lit", value: "not-a-boolean" },
        description: "Frozen while disabled",
        flow: { kind: "halt", reason: "frozenSpend" },
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
    const mainSnapshot = await world.getWorldSnapshot(mainHead!.worldId);

    expect(mainSnapshot?.data.count).toBe(2);
    expect(await world.getWorldSnapshot("world:missing")).toBeNull();

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

  it("attaches the sdk extension kernel to the activated lineage runtime", () => {
    const world = withLineage(
      createManifesto<CounterDomain>(createCounterSchema(), {}),
      { store: createInMemoryLineageStore() },
    ).activate();
    const ext = getExtensionKernel(world);

    expect(ext.projectSnapshot(ext.getCanonicalSnapshot())).toEqual(world.getSnapshot());

    world.dispose();
  });

  it("inherits dispatchability queries from the base sdk runtime surface", () => {
    const world = withLineage(
      createManifesto<CounterDomain>(createCounterSchema(), {}),
      { store: createInMemoryLineageStore() },
    ).activate();
    const ext = getExtensionKernel(world);
    const canonical = ext.getCanonicalSnapshot();
    const intent = world.createIntent(world.MEL.actions.increment);

    expect(world.isIntentDispatchable(world.MEL.actions.increment)).toBe(
      ext.isIntentDispatchableFor(canonical, intent),
    );
    expect(world.getIntentBlockers(world.MEL.actions.increment)).toEqual([]);

    world.dispose();
  });

  it("preserves coarse and fine legality semantics on the activated lineage runtime", () => {
    const schema = createDispatchabilitySchema();
    const world = withLineage(
      createManifesto<DispatchabilityDomain>(schema, {}),
      { store: createInMemoryLineageStore() },
    ).activate();
    const ext = getExtensionKernel(world);
    const canonical = ext.getCanonicalSnapshot();
    const blockedSpend = world.createIntent(world.MEL.actions.spend, 15);
    const frozenSpend = world.createIntent(world.MEL.actions.frozenSpend, 1);

    expect(world.isIntentDispatchable(world.MEL.actions.spend, 15)).toBe(
      ext.isIntentDispatchableFor(canonical, blockedSpend),
    );
    expect(world.getIntentBlockers(world.MEL.actions.spend, 15)).toEqual([
      {
        layer: "dispatchable",
        expression: schema.actions.spend.dispatchable,
        evaluatedResult: false,
        description: "Spend only when balance covers amount",
      },
    ]);

    expect(world.isIntentDispatchable(world.MEL.actions.frozenSpend, 1)).toBe(false);
    expect(world.getIntentBlockers(world.MEL.actions.frozenSpend, 1)).toEqual([
      {
        layer: "available",
        expression: schema.actions.frozenSpend.available,
        evaluatedResult: false,
        description: "Frozen while disabled",
      },
    ]);

    world.dispose();
  });

  it("rejects non-dispatchable commits before sealing and emits dispatch:rejected", async () => {
    const world = withLineage(
      createManifesto<DispatchabilityDomain>(createDispatchabilitySchema(), {}),
      { store: createInMemoryLineageStore() },
    ).activate();
    const rejected = vi.fn();
    const failed = vi.fn();

    world.on("dispatch:rejected", rejected);
    world.on("dispatch:failed", failed);

    await expect(
      world.commitAsync(world.createIntent(world.MEL.actions.spend, 15)),
    ).rejects.toMatchObject<Partial<ManifestoError>>({
      code: "INTENT_NOT_DISPATCHABLE",
    });

    expect(world.getSnapshot().data.balance).toBe(10);
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(rejected.mock.calls[0]?.[0]).toMatchObject({
      code: "INTENT_NOT_DISPATCHABLE",
    });
    expect(failed).not.toHaveBeenCalled();

    world.dispose();
  });

  it("rejects invalid commit input before sealing and emits dispatch:rejected", async () => {
    const world = withLineage(
      createManifesto<DispatchabilityDomain>(createDispatchabilitySchema(), {}),
      { store: createInMemoryLineageStore() },
    ).activate();
    const rejected = vi.fn();
    const failed = vi.fn();

    world.on("dispatch:rejected", rejected);
    world.on("dispatch:failed", failed);

    const invalidIntent = {
      ...world.createIntent(world.MEL.actions.spend, 1),
      input: { amount: "oops" },
    } as unknown as Parameters<typeof world.commitAsync>[0];

    await expect(world.commitAsync(invalidIntent)).rejects.toMatchObject<Partial<ManifestoError>>({
      code: "INVALID_INPUT",
    });

    expect(world.getSnapshot().data.balance).toBe(10);
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(rejected.mock.calls[0]?.[0]).toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(failed).not.toHaveBeenCalled();

    world.dispose();
  });
});
