import { describe, expect, it, vi } from "vitest";
import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";
import { createManifesto } from "@manifesto-ai/sdk";
import {
  createInMemoryLineageStore,
  createLineageService,
  withLineage,
} from "@manifesto-ai/lineage";

import {
  createInMemoryGovernanceStore,
  withGovernance,
  type ActorAuthorityBinding,
  type GovernanceEvent,
} from "./index.js";

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
    id: "manifesto:governance-v3-counter",
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

function createAutoBinding(): ActorAuthorityBinding {
  return {
    actorId: "actor:auto",
    authorityId: "authority:auto",
    policy: {
      mode: "auto_approve",
    },
  };
}

function createHitlBinding(): ActorAuthorityBinding {
  return {
    actorId: "actor:human",
    authorityId: "authority:human",
    policy: {
      mode: "hitl",
      delegate: {
        actorId: "delegate:human",
        kind: "human",
        name: "Human Reviewer",
      },
    },
  };
}

describe("@manifesto-ai/governance decorator runtime", () => {
  it("auto-ensures lineage from config and removes the dispatchAsync backdoor", async () => {
    const governed = withGovernance(
      createManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        lineage: { store: createInMemoryLineageStore() },
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:auto",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:auto",
          }),
        },
      },
    ).activate();

    expect("dispatchAsync" in governed).toBe(false);

    const proposal = await governed.proposeAsync(
      governed.createIntent(governed.MEL.actions.increment),
    );

    expect(proposal.status).toBe("completed");
    expect(governed.getSnapshot().data.count).toBe(1);

    const head = await governed.getLatestHead();
    expect(head).not.toBeNull();
  });

  it("returns evaluating proposals for HITL and resolves them through approve/reject", async () => {
    const governed = withGovernance(
      createManifesto<CounterDomain>(createCounterSchema(), {}),
      {
        lineage: { store: createInMemoryLineageStore() },
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createHitlBinding()],
        execution: {
          projectionId: "proj:hitl",
          deriveActor: () => ({
            actorId: "actor:human",
            kind: "human",
          }),
          deriveSource: () => ({
            kind: "ui",
            eventId: "evt:hitl",
          }),
        },
      },
    ).activate();

    const pending = await governed.proposeAsync(
      governed.createIntent(governed.MEL.actions.increment),
    );

    expect(pending.status).toBe("evaluating");
    expect(governed.getSnapshot().data.count).toBe(0);

    const approved = await governed.approve(pending.proposalId);
    expect(approved.status).toBe("completed");
    expect(governed.getSnapshot().data.count).toBe(1);

    const secondPending = await governed.proposeAsync(
      governed.createIntent(governed.MEL.actions.add, 2),
    );
    const rejected = await governed.reject(secondPending.proposalId, "manual stop");

    expect(rejected.status).toBe("rejected");
    expect(governed.getSnapshot().data.count).toBe(1);
  });

  it("uses explicitly composed lineage instead of governance config lineage overrides", async () => {
    const explicitStore = createInMemoryLineageStore();
    const ignoredStore = createInMemoryLineageStore();
    const explicitService = createLineageService(explicitStore);

    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { service: explicitService },
      ),
      {
        lineage: { store: ignoredStore },
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:explicit",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:explicit",
          }),
        },
      },
    ).activate();

    await governed.proposeAsync(
      governed.createIntent(governed.MEL.actions.increment),
    );

    expect((await explicitService.getBranches()).length).toBeGreaterThan(0);
    expect((await ignoredStore.getBranches()).length).toBe(0);
  });

  it("records failed governed executions without publishing the failed snapshot", async () => {
    const events: GovernanceEvent[] = [];
    const governed = withGovernance(
      createManifesto<CounterDomain>(createCounterSchema(), {
        "api.fetch": async () => {
          throw new Error("boom");
        },
      }),
      {
        lineage: { store: createInMemoryLineageStore() },
        bindings: [createAutoBinding()],
        eventSink: {
          emit(event) {
            events.push(event);
          },
        },
        execution: {
          projectionId: "proj:failed",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:failed",
          }),
        },
      },
    ).activate();

    const failed = vi.fn();
    governed.on("dispatch:failed", failed);

    const proposal = await governed.proposeAsync(
      governed.createIntent(governed.MEL.actions.load),
    );

    expect(proposal.status).toBe("failed");
    expect(proposal.resultWorld).toBeDefined();
    expect(governed.getSnapshot().data.status).toBe("idle");
    expect(failed).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.type === "execution:failed")).toBe(true);

    const decision = await governed.getDecisionRecord(proposal.decisionId!);
    expect(decision?.decision.kind).toBe("approved");
  });
});
