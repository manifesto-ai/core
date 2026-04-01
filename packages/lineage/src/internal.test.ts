import { describe, expect, it, vi } from "vitest";
import {
  createIntent,
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";
import { createManifesto } from "@manifesto-ai/sdk";
import { getRuntimeKernelFactory, type RuntimeKernel } from "@manifesto-ai/sdk/internal";

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
    let receivedOptions: Parameters<RuntimeKernel<CounterDomain>["executeHost"]>[1];

    const trackingKernel: RuntimeKernel<CounterDomain> = {
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
});
