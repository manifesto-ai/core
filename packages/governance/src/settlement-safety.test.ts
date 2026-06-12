import { describe, expect, it } from "vitest";
import { hashSchemaSync, semanticPathToPatchPath, type DomainSchema } from "@manifesto-ai/core";
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";

import { withGovernance } from "./with-governance.js";
import { createInMemoryGovernanceStore } from "./store/in-memory-governance-store.js";
import type { ActorAuthorityBinding } from "./types.js";

const pp = semanticPathToPatchPath;

type CounterDomain = {
  actions: {
    increment: () => void;
    load: () => void;
  };
  state: {
    count: number;
    status: string;
  };
  computed: {};
};

function withHash(schema: Omit<DomainSchema, "hash">): DomainSchema {
  return { ...schema, hash: hashSchemaSync(schema) };
}

function createCounterSchema(): DomainSchema {
  return withHash({
    id: "manifesto:governance-settlement-safety",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
        status: { type: "string", required: false, default: "idle" },
      },
    },
    computed: { fields: {} },
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
      load: {
        flow: {
          kind: "causalGuard",
          guardId: "load",
          body: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: pp("status"),
                value: { kind: "lit", value: "loading" },
              },
              { kind: "effect", type: "api.fetch", params: {} },
            ],
          },
        },
      },
    },
  });
}

function createHitlBinding(): ActorAuthorityBinding {
  return {
    actorId: "actor:auto",
    authorityId: "authority:hitl",
    policy: {
      mode: "hitl",
      delegate: {
        actorId: "delegate:human",
        kind: "human",
        name: "Reviewer",
      },
    },
  };
}

function createAutoBinding(): ActorAuthorityBinding {
  return {
    actorId: "actor:auto",
    authorityId: "authority:auto",
    policy: { mode: "auto_approve" },
  };
}

const EXECUTION = {
  projectionId: "proj:settlement-safety",
  deriveActor: () => ({ actorId: "actor:auto", kind: "agent" as const }),
  deriveSource: () => ({ kind: "agent" as const, eventId: "evt:safety" }),
};

function activateGoverned(options: {
  bindings: ActorAuthorityBinding[];
  effects?: Record<string, (params: unknown) => Promise<never[]>>;
  lineageStore?: ReturnType<typeof createInMemoryLineageStore>;
  governanceStore?: ReturnType<typeof createInMemoryGovernanceStore>;
}) {
  return withGovernance(
    withLineage(
      createManifesto<CounterDomain>(createCounterSchema(), {
        "api.fetch": async () => [],
        ...options.effects,
      }),
      { store: options.lineageStore ?? createInMemoryLineageStore() },
    ),
    {
      bindings: options.bindings,
      execution: EXECUTION,
      ...(options.governanceStore ? { governanceStore: options.governanceStore } : {}),
    },
  ).activate();
}

describe("approved scope enforcement before settlement (#477)", () => {
  it("fails settlement when changes escape the approved scope", async () => {
    const governed = activateGoverned({ bindings: [createHitlBinding()] });

    const pending = await governed.action.increment.submit();
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;

    // The authority approves only "status"; increment patches "count".
    // The violation surfaces as a governance failure on the approval /
    // settlement observation path.
    let observedError: unknown = null;
    try {
      await governed.approve(pending.proposal, { allowedPaths: ["status"] });
      await pending.waitForSettlement();
    } catch (error) {
      observedError = error;
    }
    expect(String(observedError)).toMatch(/approved scope/);

    const proposal = await governed.getProposal(pending.proposal);
    expect(proposal?.status).toBe("failed");
    // The out-of-scope change must not become the visible state.
    expect(governed.snapshot().state.count).toBe(0);

    governed.dispose();
  });

  it("settles normally when changes stay inside the approved scope", async () => {
    const governed = activateGoverned({ bindings: [createHitlBinding()] });

    const pending = await governed.action.increment.submit();
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;

    await governed.approve(pending.proposal, { allowedPaths: ["count"] });
    await pending.waitForSettlement();

    const proposal = await governed.getProposal(pending.proposal);
    expect(proposal?.status).toBe("completed");
    expect(governed.snapshot().state.count).toBe(1);

    governed.dispose();
  });

  it("wildcard scope allows subtree changes", async () => {
    const governed = activateGoverned({ bindings: [createHitlBinding()] });

    const pending = await governed.action.increment.submit();
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;

    await governed.approve(pending.proposal, { allowedPaths: ["*"] });
    await pending.waitForSettlement();

    const proposal = await governed.getProposal(pending.proposal);
    expect(proposal?.status).toBe("completed");

    governed.dispose();
  });
});

describe("effect-safe activation recovery (#479)", () => {
  it("does not re-execute effects for proposals recovered in executing state", async () => {
    const lineageStore = createInMemoryLineageStore();
    const governanceStore = createInMemoryGovernanceStore();

    let firstRuntimeCalls = 0;
    let recoveredRuntimeCalls = 0;

    // First runtime: the effect starts (external IO happens) and never
    // settles — the crash analog leaves the proposal durably "executing".
    const first = activateGoverned({
      bindings: [createAutoBinding()],
      lineageStore,
      governanceStore,
      effects: {
        "api.fetch": () => {
          firstRuntimeCalls += 1;
          return new Promise<never[]>(() => {});
        },
      },
    });

    const pending = await first.action.load.submit();
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;

    // Wait until the proposal is durably executing (effect in flight).
    await new Promise((resolve) => setTimeout(resolve, 25));
    const executing = await governanceStore.getProposal(pending.proposal);
    expect(executing?.status).toBe("executing");
    expect(firstRuntimeCalls).toBe(1);

    first.dispose();

    // Second runtime shares the durable stores; activation recovery must
    // not re-dispatch the effect.
    const recovered = activateGoverned({
      bindings: [createAutoBinding()],
      lineageStore,
      governanceStore,
      effects: {
        "api.fetch": async () => {
          recoveredRuntimeCalls += 1;
          return [];
        },
      },
    });

    // Recovery is queued on the kernel; a subsequent settled submission
    // guarantees it has drained.
    const probe = await recovered.action.increment.submit();
    expect(probe.ok).toBe(true);
    if (probe.ok) {
      await probe.waitForSettlement();
    }

    expect(recoveredRuntimeCalls).toBe(0);
    const terminal = await governanceStore.getProposal(pending.proposal);
    expect(terminal?.status).toBe("failed");

    recovered.dispose();
  });
});
