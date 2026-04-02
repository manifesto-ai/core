import { describe, expect, it, vi } from "vitest";
import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";
import { AlreadyActivatedError, createManifesto } from "@manifesto-ai/sdk";
import {
  createInMemoryLineageStore,
  withLineage,
} from "@manifesto-ai/lineage";
import {
  createLineageService,
  type LineageService,
} from "@manifesto-ai/lineage/provider";

import {
  createInMemoryGovernanceStore,
  withGovernance,
  type ActorAuthorityBinding,
  type GovernanceEvent,
  type GovernanceStore,
} from "./index.js";

const lineageSealCalls = vi.hoisted(() => [] as Array<{ executionKey?: string }>);

vi.mock("@manifesto-ai/lineage/provider", async () => {
  const actual = await vi.importActual<typeof import("@manifesto-ai/lineage/provider")>(
    "@manifesto-ai/lineage/provider",
  );

  return {
    ...actual,
    createLineageRuntimeController(
      ...args: Parameters<typeof actual.createLineageRuntimeController>
    ) {
      const controller = actual.createLineageRuntimeController(...args);
      return {
        ...controller,
        async sealIntent(
          ...sealArgs: Parameters<typeof controller.sealIntent>
        ) {
          lineageSealCalls.push({
            executionKey: sealArgs[1]?.executionKey,
          });
          return controller.sealIntent(...sealArgs);
        },
      };
    },
  };
});

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

function createAutoBindingForHuman(): ActorAuthorityBinding {
  return {
    actorId: "actor:human",
    authorityId: "authority:human",
    policy: {
      mode: "auto_approve",
    },
  };
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("@manifesto-ai/governance decorator runtime", () => {
  it("requires explicit lineage composition and removes direct execution backdoors", async () => {
    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
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
    expect("commitAsync" in governed).toBe(false);

    const proposal = await governed.proposeAsync(
      governed.createIntent(governed.MEL.actions.increment),
    );

    expect(proposal.status).toBe("completed");
    expect(governed.getSnapshot().data.count).toBe(1);

    const head = await governed.getLatestHead();
    const sealedSnapshot = await governed.getWorldSnapshot(head!.worldId);

    expect(head).not.toBeNull();
    expect(sealedSnapshot?.data.count).toBe(1);
  });

  it("returns evaluating proposals for HITL and resolves them through approve/reject", async () => {
    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
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

  it("uses the explicitly composed lineage service", async () => {
    const explicitStore = createInMemoryLineageStore();
    const explicitService = createLineageService(explicitStore);

    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { service: explicitService },
      ),
      {
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
  });

  it("records failed governed executions without publishing the failed snapshot", async () => {
    const events: GovernanceEvent[] = [];
    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {
          "api.fetch": async () => {
            throw new Error("boom");
          },
        }),
        { store: createInMemoryLineageStore() },
      ),
      {
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

  it("persists terminal failure when lineage seal commit throws after execution begins", async () => {
    const lineageStore = createInMemoryLineageStore();
    const governanceStore = createInMemoryGovernanceStore();
    const realService = createLineageService(lineageStore);
    let commitCount = 0;

    const failingService = new Proxy(realService, {
      get(target, property, receiver) {
        if (property === "commitPrepared") {
          return async (...args: Parameters<LineageService["commitPrepared"]>) => {
            commitCount += 1;
            if (commitCount > 1) {
              throw new Error("seal commit failed");
            }
            return target.commitPrepared(...args);
          };
        }

        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as LineageService;

    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { service: failingService },
      ),
      {
        governanceStore,
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:seal-failure",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:seal-failure",
          }),
        },
      },
    ).activate();

    await expect(
      governed.proposeAsync(
        governed.createIntent(governed.MEL.actions.increment),
      ),
    ).rejects.toThrow("seal commit failed");

    const activeBranch = await failingService.getActiveBranch();
    const stored = await governanceStore.getProposalsByBranch(activeBranch.id);

    expect(stored).toHaveLength(1);
    expect(stored[0]?.status).toBe("failed");
    expect(await governanceStore.getExecutionStageProposal(activeBranch.id)).toBeNull();
  });

  it("preserves the sealed terminal proposal when terminal persistence retries fail", async () => {
    const governanceStore = createInMemoryGovernanceStore();
    let failCompletedPersist = true;

    const flakyStore = new Proxy(governanceStore, {
      get(target, property, receiver) {
        if (property === "putProposal") {
          return async (...args: Parameters<GovernanceStore["putProposal"]>) => {
            const [proposal] = args;
            if (proposal.status === "completed" && failCompletedPersist) {
              failCompletedPersist = false;
              throw new Error("transient terminal persist failure");
            }
            return target.putProposal(...args);
          };
        }

        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as GovernanceStore;

    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: flakyStore,
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:terminal-persist-retry",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:terminal-persist-retry",
          }),
        },
      },
    ).activate();

    await expect(
      governed.proposeAsync(
        governed.createIntent(governed.MEL.actions.increment),
      ),
    ).rejects.toThrow("transient terminal persist failure");

    const activeBranch = await governed.getActiveBranch();
    const stored = await governanceStore.getProposalsByBranch(activeBranch.id);
    const latestHead = await governed.getLatestHead();

    expect(stored).toHaveLength(1);
    expect(stored[0]?.status).toBe("completed");
    expect(stored[0]?.resultWorld).toBe(latestHead?.worldId);
    expect(await governanceStore.getExecutionStageProposal(activeBranch.id)).toBeNull();
  });

  it("persists a failed proposal when finalize throws after the lineage seal succeeds", async () => {
    const lineageStore = createInMemoryLineageStore();
    const governanceStore = createInMemoryGovernanceStore();
    let failDecisionLookup = true;

    const flakyStore = new Proxy(governanceStore, {
      get(target, property, receiver) {
        if (property === "getDecisionRecord") {
          return async (...args: Parameters<GovernanceStore["getDecisionRecord"]>) => {
            if (failDecisionLookup) {
              failDecisionLookup = false;
              throw new Error("decision lookup failed");
            }
            return target.getDecisionRecord(...args);
          };
        }

        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as GovernanceStore;

    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: lineageStore },
      ),
      {
        governanceStore: flakyStore,
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:finalize-throws",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:finalize-throws",
          }),
        },
      },
    ).activate();

    await expect(
      governed.proposeAsync(
        governed.createIntent(governed.MEL.actions.increment),
      ),
    ).rejects.toThrow("decision lookup failed");

    const activeBranch = await governed.getActiveBranch();
    const latestHead = await governed.getLatestHead();
    const stored = await governanceStore.getProposalsByBranch(activeBranch.id);

    expect(stored).toHaveLength(1);
    expect(stored[0]?.status).toBe("failed");
    expect(stored[0]?.resultWorld).toBe(latestHead?.worldId);
    expect(await governanceStore.getExecutionStageProposal(activeBranch.id)).toBeNull();
  });

  it("falls back to a failed proposal when terminal proposal retries keep failing", async () => {
    const governanceStore = createInMemoryGovernanceStore();

    const policyStore = new Proxy(governanceStore, {
      get(target, property, receiver) {
        if (property === "putProposal") {
          return async (...args: Parameters<GovernanceStore["putProposal"]>) => {
            const [proposal] = args;
            if (proposal.status === "completed") {
              throw new Error("completed proposals rejected");
            }
            return target.putProposal(...args);
          };
        }

        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as GovernanceStore;

    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: policyStore,
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:terminal-fallback-failed",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:terminal-fallback-failed",
          }),
        },
      },
    ).activate();

    await expect(
      governed.proposeAsync(
        governed.createIntent(governed.MEL.actions.increment),
      ),
    ).rejects.toThrow("completed proposals rejected");

    const activeBranch = await governed.getActiveBranch();
    const latestHead = await governed.getLatestHead();
    const stored = await governanceStore.getProposalsByBranch(activeBranch.id);

    expect(stored).toHaveLength(1);
    expect(stored[0]?.status).toBe("failed");
    expect(stored[0]?.resultWorld).toBe(latestHead?.worldId);
    expect(await governanceStore.getExecutionStageProposal(activeBranch.id)).toBeNull();
  });

  it("routes governed execution through the proposal execution key", async () => {
    lineageSealCalls.length = 0;

    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:execution-key",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:execution-key",
          }),
        },
      },
    ).activate();

    const proposal = await governed.proposeAsync(
      governed.createIntent(governed.MEL.actions.increment),
    );

    expect(proposal.status).toBe("completed");
    expect(lineageSealCalls).toHaveLength(1);
    expect(lineageSealCalls[0]?.executionKey).toBe(proposal.executionKey);
  });

  it("serializes bindActor updates with proposal execution", async () => {
    const governanceStore = createInMemoryGovernanceStore();
    const gate = createDeferred();
    const getActorBindingStarted = createDeferred();

    const serializedStore = new Proxy(governanceStore, {
      get(target, property, receiver) {
        if (property === "getActorBinding") {
          return async (...args: Parameters<GovernanceStore["getActorBinding"]>) => {
            getActorBindingStarted.resolve();
            await gate.promise;
            return target.getActorBinding(...args);
          };
        }

        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as GovernanceStore;

    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: serializedStore,
        bindings: [createHitlBinding()],
        execution: {
          projectionId: "proj:serialized-bindings",
          deriveActor: () => ({
            actorId: "actor:human",
            kind: "human",
          }),
          deriveSource: () => ({
            kind: "ui",
            eventId: "evt:serialized-bindings",
          }),
        },
      },
    ).activate();

    const pendingProposal = governed.proposeAsync(
      governed.createIntent(governed.MEL.actions.increment),
    );

    await getActorBindingStarted.promise;
    const bindingUpdate = governed.bindActor(createAutoBindingForHuman());
    gate.resolve();

    const proposal = await pendingProposal;
    await bindingUpdate;

    expect(proposal.status).toBe("evaluating");
    expect(governed.getSnapshot().data.count).toBe(0);

    const next = await governed.proposeAsync(
      governed.createIntent(governed.MEL.actions.increment),
    );
    expect(next.status).toBe("completed");
    expect(governed.getSnapshot().data.count).toBe(1);
  });

  it("shares activation ownership with the base and lineage composables", () => {
    const base = createManifesto<CounterDomain>(createCounterSchema(), {});
    const lineage = withLineage(base, { store: createInMemoryLineageStore() });
    const governed = withGovernance(lineage, {
      bindings: [createAutoBinding()],
      execution: {
        projectionId: "proj:activation-ownership",
        deriveActor: () => ({
          actorId: "actor:auto",
          kind: "agent",
        }),
        deriveSource: () => ({
          kind: "agent",
          eventId: "evt:activation-ownership",
        }),
      },
    });

    const world = governed.activate();

    expect(() => lineage.activate()).toThrow(AlreadyActivatedError);
    expect(() => base.activate()).toThrow(AlreadyActivatedError);

    world.dispose();
  });

  it("rejects governance composition without an explicit lineage decorator at runtime", () => {
    const base = createManifesto<CounterDomain>(createCounterSchema(), {});

    expect(() =>
      withGovernance(base as never, {
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:missing-lineage",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:missing-lineage",
          }),
        },
      })
    ).toThrow("withGovernance() requires a manifesto already composed with withLineage()");
  });
});
