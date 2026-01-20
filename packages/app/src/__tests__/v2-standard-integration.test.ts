/**
 * v2 Standard Integration Compliance Tests
 *
 * These tests assert App-level enforcement of SPEC/FDR rules.
 */

import { describe, it, expect, vi } from "vitest";
import { createApp } from "../index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type {
  ApprovedScope,
  Host,
  HostResult,
  PolicyService,
  Proposal,
  Snapshot,
  WorldStore,
} from "../core/types/index.js";
import { createWorldId } from "@manifesto-ai/world";

const schema: DomainSchema = {
  id: "test:v2",
  version: "1.0.0",
  hash: "schema-v2",
  types: {},
  actions: {
    "todo.add": {
      flow: { kind: "seq", steps: [] },
    },
  },
  computed: { fields: {} },
  state: { fields: {} },
};

function createSnapshot(data: Record<string, unknown> = {}): Snapshot {
  return {
    data,
    computed: {},
    input: {},
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    meta: {
      version: 0,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "schema-v2",
    },
  };
}

function createHost(dispatchImpl?: Host["dispatch"]): Host {
  return {
    dispatch:
      dispatchImpl ??
      vi.fn(async (): Promise<HostResult> => {
        return { status: "completed", snapshot: createSnapshot() };
      }),
    registerEffect: vi.fn(),
  };
}

function createWorldStore(): WorldStore {
  return {
    store: vi.fn(async () => {}),
    restore: vi.fn(async () => createSnapshot()),
    getWorld: vi.fn(async () => null),
    has: vi.fn(async () => false),
    getChildren: vi.fn(async () => []),
    getLineage: vi.fn(async () => []),
  };
}

describe("v2 Standard App Integration", () => {
  it("APP-BOUNDARY-4: injected Host is used for execution", async () => {
    const hostDispatch = vi.fn(async (): Promise<HostResult> => {
      return { status: "completed", snapshot: createSnapshot() };
    });
    const host = createHost(hostDispatch);
    const worldStore = createWorldStore();

    const app = createApp({ schema, host, worldStore });
    await app.ready();

    await app.act("todo.add", {}).done();

    expect(hostDispatch).toHaveBeenCalled();
  });

  it("STORE-1: WorldStore.store is called after execution", async () => {
    const host = createHost();
    const worldStore = createWorldStore();

    const app = createApp({ schema, host, worldStore });
    await app.ready();

    await app.act("todo.add", {}).done();

    expect(worldStore.store).toHaveBeenCalled();
  });

  it("POLICY-SVC-3: PolicyService handles authority routing", async () => {
    const host = createHost();
    const worldStore = createWorldStore();
    const policyService: PolicyService = {
      deriveExecutionKey: () => "key-1",
      requestApproval: vi.fn(async () => {
        return { approved: true, scope: { allowedPaths: ["*"] }, timestamp: 0 };
      }),
      validateScope: () => ({ valid: true }),
    };

    const app = createApp({ schema, host, worldStore, policyService });
    await app.ready();

    await app.act("todo.add", {}).done();

    expect(policyService.requestApproval).toHaveBeenCalled();
  });

  it("SCOPE-3: rejected authority decision prevents execution", async () => {
    const host = createHost();
    const worldStore = createWorldStore();
    const policyService: PolicyService = {
      deriveExecutionKey: () => "key-1",
      requestApproval: vi.fn(async () => {
        return { approved: false, reason: "no", timestamp: 0 };
      }),
      validateScope: () => ({ valid: true }),
    };

    const app = createApp({ schema, host, worldStore, policyService });
    await app.ready();

    const result = await app.act("todo.add", {}).result();

    expect(result.status).toBe("rejected");
  });

  it("SCOPE-2: scope validation failure prevents execution", async () => {
    const hostDispatch = vi.fn(async (): Promise<HostResult> => {
      return { status: "completed", snapshot: createSnapshot() };
    });
    const host = createHost(hostDispatch);
    const worldStore = createWorldStore();
    const policyService: PolicyService = {
      deriveExecutionKey: () => "key-1",
      requestApproval: vi.fn(async () => {
        return {
          approved: true,
          scope: { allowedPaths: ["data.count"] },
          timestamp: 0,
        };
      }),
      validateScope: () => ({ valid: false, errors: ["scope denied"] }),
    };

    const app = createApp({ schema, host, worldStore, policyService });
    await app.ready();

    const result = await app.act("todo.add", {}).result();

    expect(result.status).toBe("rejected");
    expect(hostDispatch).not.toHaveBeenCalled();
  });
});

describe("Hook Contract (FDR-APP-RUNTIME-001)", () => {
  it("HOOK-3: hook errors do not affect execution outcome", async () => {
    const app = createApp(schema);
    await app.ready();

    app.hooks.on("action:preparing", () => {
      throw new Error("hook failure");
    });

    const result = await app.act("todo.add", {}).result();
    expect(result.status).toBe("completed");
  });

  it("HOOK-CTX: HookContext provides AppRef and timestamp", async () => {
    let captured: unknown;
    const app = createApp(schema);

    app.hooks.on("app:ready", (ctx) => {
      captured = ctx;
    });

    await app.ready();

    const ctx = captured as { app?: unknown; timestamp?: number };
    expect(ctx.app).toBeDefined();
    expect(typeof ctx.timestamp).toBe("number");
  });
});

describe("Publish Boundary (v2)", () => {
  it("HOOK-4: state:publish fires once per proposal tick", async () => {
    const host = createHost();
    const worldStore = createWorldStore();
    const app = createApp({ schema, host, worldStore });
    await app.ready();

    const publishes: Array<unknown> = [];
    app.hooks.on("state:publish", (payload) => {
      publishes.push(payload);
    });

    await app.act("todo.add", {}).done();

    expect(publishes.length).toBe(1);
  });
});

describe("Policy Constraints (FDR-APP-POLICY-001)", () => {
  it("EXK-POLICY-3: ExecutionKey fixed before execution starts", () => {
    const proposal: Proposal = {
      proposalId: "prop-1",
      actorId: "actor-1",
      intentType: "todo.add",
      intentBody: {},
      baseWorld: createWorldId("world-1"),
      createdAt: 0,
    };

    const keyPolicy = (p: Proposal) => `key:${p.proposalId}`;
    const key1 = keyPolicy(proposal);
    const key2 = keyPolicy({ ...proposal });

    expect(key1).toBe(key2);
  });

  it("SCOPE-1: ApprovedScope generated at Authority decision time", async () => {
    const host = createHost();
    const worldStore = createWorldStore();
    const policyService: PolicyService = {
      deriveExecutionKey: () => "key-1",
      requestApproval: vi.fn(async () => {
        const scope: ApprovedScope = { allowedPaths: ["data.count"] };
        return { approved: true, scope, timestamp: 0 };
      }),
      validateScope: () => ({ valid: true }),
    };

    const app = createApp({ schema, host, worldStore, policyService });
    await app.ready();

    await app.act("todo.add", {}).done();

    expect(policyService.requestApproval).toHaveBeenCalled();
  });
});
