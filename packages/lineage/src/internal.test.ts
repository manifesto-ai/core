import { describe, expect, it, vi } from "vitest";
import {
  createIntent,
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
  type Snapshot,
} from "@manifesto-ai/core";
import { createManifesto } from "@manifesto-ai/sdk";
import {
  getRuntimeKernelFactory,
  type LineageRuntimeKernel,
} from "@manifesto-ai/sdk/provider";

import { createLineageRuntimeController } from "./internal.js";
import { createLineageService } from "./service/lineage-service.js";
import { createInMemoryLineageStore } from "./store/in-memory-lineage-store.js";

const pp = semanticPathToPatchPath;

type CounterDomain = {
  actions: {
    increment: () => void;
    requiresPositive: () => void;
  };
  state: {
    count: number;
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
    id: "manifesto:lineage-internal-counter",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
      },
    },
    computed: {
      fields: {},
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
      requiresPositive: {
        available: {
          kind: "gt",
          left: { kind: "get", path: "count" },
          right: { kind: "lit", value: 0 },
        },
        flow: {
          kind: "halt",
          reason: "noop",
        },
      },
    },
  });
}

describe("@manifesto-ai/lineage internal runtime controller", () => {
  it("migrates legacy stored snapshots for canonical lookup and normalizes restore", async () => {
    const store = createInMemoryLineageStore();
    await store.putWorld({
      worldId: "world-legacy",
      schemaHash: "schema-legacy",
      snapshotHash: "hash-legacy",
      parentWorldId: null,
      terminalStatus: "completed",
    });
    await store.putSnapshot("world-legacy", {
      data: {
        count: 1,
        $host: { lastError: { code: "OLD" } },
      },
      computed: { doubled: 2 },
      system: {
        status: "error",
        lastError: {
          code: "DOMAIN_FAIL",
          message: "failed",
          source: { actionId: "fail", nodePath: "actions.fail.flow" },
          timestamp: 10,
        },
        pendingRequirements: [],
        currentAction: "fail",
      },
      input: { stale: true },
      meta: {
        version: 3,
        timestamp: 10,
        randomSeed: "old-seed",
        schemaHash: "schema-legacy",
      },
    } as unknown as Snapshot);

    const service = createLineageService(store);
    const canonical = await service.getSnapshot("world-legacy");
    const restored = await service.restore("world-legacy");

    expect(canonical?.state).toEqual({ count: 1 });
    expect(canonical?.namespaces).toEqual({
      host: { lastError: { code: "OLD" } },
    });
    expect(restored.state).toEqual({ count: 1 });
    expect(restored.input).toBeNull();
    expect(restored.meta.timestamp).toBe(0);
    expect(restored.meta.randomSeed).toBe("");
    expect(restored.system.currentAction).toBeNull();
    expect(restored.namespaces).toEqual({ host: {} });
  });

  it("forwards explicit execution keys into host dispatch", async () => {
    const base = createManifesto<CounterDomain>(createCounterSchema(), {});
    const kernel = getRuntimeKernelFactory(base)();
    let receivedOptions: Parameters<LineageRuntimeKernel<CounterDomain>["executeHost"]>[1];

    const trackingKernel: LineageRuntimeKernel<CounterDomain> = {
      ...kernel,
      executeHost: vi.fn(async (intent, options) => {
        receivedOptions = options;
        return kernel.executeHost(intent, options);
      }),
    };

    const service = createLineageService(createInMemoryLineageStore());
    const lineage = createLineageRuntimeController(trackingKernel, service, { service });

    await lineage.sealIntent(createIntent("increment", "intent-1"), {
      executionKey: "branch:serialized",
      publishOnCompleted: false,
    });

    expect(receivedOptions?.key).toBe("branch:serialized");
  });

  it("restores the visible snapshot when scoped sealing rejects before dispatch", async () => {
    const base = createManifesto<CounterDomain>(createCounterSchema(), {});
    const kernel = getRuntimeKernelFactory(base)();
    const service = createLineageService(createInMemoryLineageStore());
    const lineage = createLineageRuntimeController(kernel, service, { service });

    const genesisWorldId = await lineage.getCurrentCompletedWorldId();
    await lineage.sealIntent(createIntent("increment", "intent-1"));
    const forkBranchId = await lineage.createBranch("fork", genesisWorldId);

    expect(kernel.getVisibleCoreSnapshot().state.count).toBe(1);

    await expect(lineage.sealIntent(
      createIntent("requiresPositive", "intent-blocked"),
      {
        branchId: forkBranchId,
        baseWorldId: genesisWorldId,
      },
    )).rejects.toThrow();

    expect(kernel.getVisibleCoreSnapshot().state.count).toBe(1);
  });

  it("rejects pending host results before preparing or committing a next seal", async () => {
    const base = createManifesto<CounterDomain>(createCounterSchema(), {});
    const kernel = getRuntimeKernelFactory(base)();
    const pendingSnapshot = {
      ...kernel.getCanonicalSnapshot(),
      system: {
        ...kernel.getCanonicalSnapshot().system,
        status: "pending" as const,
        pendingRequirements: [{
          id: "req-1",
          type: "external",
          params: {},
          actionId: "increment",
          flowPosition: {
            nodePath: "actions.increment.flow",
            snapshotVersion: kernel.getCanonicalSnapshot().meta.version,
          },
          createdAt: kernel.getCanonicalSnapshot().meta.timestamp,
        }],
      },
    };
    const pendingKernel: LineageRuntimeKernel<CounterDomain> = {
      ...kernel,
      executeHost: vi.fn(async () => ({
        status: "pending" as const,
        snapshot: pendingSnapshot,
        traces: [],
      })),
    };
    const realService = createLineageService(createInMemoryLineageStore());
    const service = {
      prepareSealGenesis: realService.prepareSealGenesis.bind(realService),
      prepareSealNext: vi.fn(realService.prepareSealNext.bind(realService)),
      commitPrepared: vi.fn(realService.commitPrepared.bind(realService)),
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
    const lineage = createLineageRuntimeController(pendingKernel, service, { service });

    await expect(lineage.sealIntent(createIntent("increment", "intent-1"), {
      rejectPendingBeforeSeal: true,
    })).rejects.toThrow("host dispatch remained pending");
    expect(service.prepareSealNext).not.toHaveBeenCalled();
    expect(service.commitPrepared).toHaveBeenCalledTimes(1);
  });
});
