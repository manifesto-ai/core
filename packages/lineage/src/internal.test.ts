import { describe, expect, it, vi } from "vitest";
import {
  createIntent,
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
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
    },
  });
}

describe("@manifesto-ai/lineage internal runtime controller", () => {
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
