import { describe, expect, it, vi } from "vitest";
import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";
import {
  AlreadyActivatedError,
  DisposedError,
  ManifestoError,
  createManifesto,
} from "@manifesto-ai/sdk";
import { getExtensionKernel } from "@manifesto-ai/sdk/extensions";
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
  waitForProposal,
  waitForProposalWithReport,
  withGovernance,
  type ActorAuthorityBinding,
  type GovernanceEvent,
  type GovernanceInstance,
  type GovernanceStore,
  type Proposal,
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

function createDispatchabilitySchema(): DomainSchema {
  return withHash({
    id: "manifesto:governance-v3-dispatchability",
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

async function getStoredProposal<T extends CounterDomain | DispatchabilityDomain>(
  governed: GovernanceInstance<T>,
  proposalId: string,
): Promise<Proposal> {
  const proposal = await governed.getProposal(proposalId);
  if (!proposal) {
    throw new Error(`expected stored proposal ${proposalId}`);
  }
  return proposal;
}

async function submitIncrement(
  governed: GovernanceInstance<CounterDomain>,
) {
  const result = await governed.actions.increment.submit();
  if (!result.ok) {
    throw new Error(result.admission.message);
  }
  return result;
}

async function submitAdd(
  governed: GovernanceInstance<CounterDomain>,
  amount: number,
) {
  const result = await governed.actions.add.submit(amount);
  if (!result.ok) {
    throw new Error(result.admission.message);
  }
  return result;
}

async function submitLoad(
  governed: GovernanceInstance<CounterDomain>,
) {
  const result = await governed.actions.load.submit();
  if (!result.ok) {
    throw new Error(result.admission.message);
  }
  return result;
}

async function pendingIncrementProposal(
  governed: GovernanceInstance<CounterDomain>,
): Promise<Proposal> {
  const result = await submitIncrement(governed);
  return getStoredProposal(governed, result.proposal);
}

async function settledIncrementProposal(
  governed: GovernanceInstance<CounterDomain>,
): Promise<Proposal> {
  const result = await submitIncrement(governed);
  await result.waitForSettlement();
  return getStoredProposal(governed, result.proposal);
}

async function settledAddProposal(
  governed: GovernanceInstance<CounterDomain>,
  amount: number,
): Promise<Proposal> {
  const result = await submitAdd(governed, amount);
  await result.waitForSettlement();
  return getStoredProposal(governed, result.proposal);
}

async function settledLoadProposal(
  governed: GovernanceInstance<CounterDomain>,
): Promise<Proposal> {
  const result = await submitLoad(governed);
  await result.waitForSettlement();
  return getStoredProposal(governed, result.proposal);
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
    expect("proposeAsync" in governed).toBe(false);
    expect("createIntent" in governed).toBe(false);
    expect("MEL" in governed).toBe(false);
    expect(typeof governed.actions.increment.submit).toBe("function");
    expect(typeof governed.waitForSettlement).toBe("function");

    expect(governed.actions.increment.check()).toEqual({
      ok: true,
      action: "increment",
    });

    const proposal = await settledIncrementProposal(governed);
    expect(proposal.status).toBe("completed");
    expect(governed.snapshot().state.count).toBe(1);

    const head = await governed.getLatestHead();
    const sealedSnapshot = await governed.getWorldSnapshot(head!.worldId);

    expect(head).not.toBeNull();
    expect(sealedSnapshot?.state.count).toBe(1);
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

    const pending = await pendingIncrementProposal(governed);

    expect(pending.status).toBe("evaluating");
    expect(governed.snapshot().state.count).toBe(0);

    const approved = await governed.approve(pending.proposalId);
    expect(approved.status).toBe("completed");
    expect(governed.snapshot().state.count).toBe(1);

    const secondResult = await submitAdd(governed, 2);
    const secondPending = await getStoredProposal(governed, secondResult.proposal);
    const rejected = await governed.reject(secondPending.proposalId, "manual stop");

    expect(rejected.status).toBe("rejected");
    expect(governed.snapshot().state.count).toBe(1);
  });

  it("settles completed proposals through waitForProposal()", async () => {
    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:wait-completed",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:wait-completed",
          }),
        },
      },
    ).activate();

    const proposal = await settledIncrementProposal(governed);
    const settlement = await waitForProposal(governed, proposal);

    expect(settlement).toMatchObject({
      kind: "completed",
      resultWorld: proposal.resultWorld,
    });
    if (settlement.kind !== "completed") {
      throw new Error("expected completed settlement");
    }
    expect(settlement.snapshot.state.count).toBe(1);
    expect(settlement.snapshot).toEqual(governed.snapshot());
  });

  it("anchors completed settlement reports on stored worlds rather than the current visible head", async () => {
    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:wait-report-completed",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:wait-report-completed",
          }),
        },
      },
    ).activate();

    const proposal = await settledIncrementProposal(governed);
    await settledAddProposal(governed, 2);

    const report = await waitForProposalWithReport(governed, proposal);

    expect(report).toMatchObject({
      kind: "completed",
      baseWorld: proposal.baseWorld,
      resultWorld: proposal.resultWorld,
    });
    if (report.kind !== "completed") {
      throw new Error("expected completed report");
    }

    const ext = getExtensionKernel(governed);
    const beforeWorld = await governed.getWorldSnapshot(report.baseWorld);
    const afterWorld = await governed.getWorldSnapshot(report.resultWorld);
    if (!beforeWorld || !afterWorld) {
      throw new Error("expected stored worlds for completed report");
    }

    expect(report.outcome.canonical.beforeCanonicalSnapshot).toEqual(beforeWorld);
    expect(report.outcome.canonical.afterCanonicalSnapshot).toEqual(afterWorld);
    expect(report.outcome.projected.beforeSnapshot).toEqual(ext.projectSnapshot(beforeWorld));
    expect(report.outcome.projected.afterSnapshot).toEqual(ext.projectSnapshot(afterWorld));
    expect(report.outcome.projected.afterSnapshot.state.count).toBe(1);
    expect(governed.snapshot().state.count).toBe(3);
  });

  it("returns pending immediately for non-terminal proposals when timeoutMs is omitted", async () => {
    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createHitlBinding()],
        execution: {
          projectionId: "proj:wait-pending",
          deriveActor: () => ({
            actorId: "actor:human",
            kind: "human",
          }),
          deriveSource: () => ({
            kind: "ui",
            eventId: "evt:wait-pending",
          }),
        },
      },
    ).activate();

    const proposal = await pendingIncrementProposal(governed);
    const settlement = await waitForProposal(governed, proposal);

    expect(settlement).toMatchObject({
      kind: "pending",
      proposal: {
        proposalId: proposal.proposalId,
        status: "evaluating",
      },
    });
  });

  it("returns timed_out when a proposal does not settle before the observation deadline", async () => {
    vi.useFakeTimers();

    try {
      const governed = withGovernance(
        withLineage(
          createManifesto<CounterDomain>(createCounterSchema(), {}),
          { store: createInMemoryLineageStore() },
        ),
        {
          governanceStore: createInMemoryGovernanceStore(),
          bindings: [createHitlBinding()],
          execution: {
            projectionId: "proj:wait-timeout",
            deriveActor: () => ({
              actorId: "actor:human",
              kind: "human",
            }),
            deriveSource: () => ({
              kind: "ui",
              eventId: "evt:wait-timeout",
            }),
          },
        },
      ).activate();

      const proposal = await pendingIncrementProposal(governed);
      const settlementPromise = waitForProposal(governed, proposal, {
        timeoutMs: 100,
        pollIntervalMs: 25,
      });

      await vi.advanceTimersByTimeAsync(100);

      await expect(settlementPromise).resolves.toMatchObject({
        kind: "timed_out",
        proposal: {
          proposalId: proposal.proposalId,
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("observes later approval through waitForProposal()", async () => {
    vi.useFakeTimers();

    try {
      const governed = withGovernance(
        withLineage(
          createManifesto<CounterDomain>(createCounterSchema(), {}),
          { store: createInMemoryLineageStore() },
        ),
        {
          governanceStore: createInMemoryGovernanceStore(),
          bindings: [createHitlBinding()],
          execution: {
            projectionId: "proj:wait-approve",
            deriveActor: () => ({
              actorId: "actor:human",
              kind: "human",
            }),
            deriveSource: () => ({
              kind: "ui",
              eventId: "evt:wait-approve",
            }),
          },
        },
      ).activate();

      const proposal = await pendingIncrementProposal(governed);
      const settlementPromise = waitForProposal(governed, proposal, {
        timeoutMs: 250,
        pollIntervalMs: 25,
      });

      await governed.approve(proposal.proposalId);
      await vi.advanceTimersByTimeAsync(25);

      await expect(settlementPromise).resolves.toMatchObject({
        kind: "completed",
        resultWorld: expect.any(String),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("observes later rejection through waitForProposal()", async () => {
    vi.useFakeTimers();

    try {
      const governed = withGovernance(
        withLineage(
          createManifesto<CounterDomain>(createCounterSchema(), {}),
          { store: createInMemoryLineageStore() },
        ),
        {
          governanceStore: createInMemoryGovernanceStore(),
          bindings: [createHitlBinding()],
          execution: {
            projectionId: "proj:wait-reject",
            deriveActor: () => ({
              actorId: "actor:human",
              kind: "human",
            }),
            deriveSource: () => ({
              kind: "ui",
              eventId: "evt:wait-reject",
            }),
          },
        },
      ).activate();

      const proposal = await pendingIncrementProposal(governed);
      const settlementPromise = waitForProposal(governed, proposal, {
        timeoutMs: 250,
        pollIntervalMs: 25,
      });

      await governed.reject(proposal.proposalId, "manual stop");
      await vi.advanceTimersByTimeAsync(25);

      await expect(settlementPromise).resolves.toMatchObject({
        kind: "rejected",
        proposal: {
          proposalId: proposal.proposalId,
          status: "rejected",
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("observes superseded proposals through waitForProposal()", async () => {
    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createHitlBinding()],
        execution: {
          projectionId: "proj:wait-superseded",
          deriveActor: () => ({
            actorId: "actor:human",
            kind: "human",
          }),
          deriveSource: () => ({
            kind: "ui",
            eventId: "evt:wait-superseded",
          }),
        },
      },
    ).activate();

    const pending = await pendingIncrementProposal(governed);

    await governed.bindActor(createAutoBindingForHuman());
    await settledAddProposal(governed, 2);
    await settledIncrementProposal(governed);

    await expect(waitForProposal(governed, pending)).resolves.toMatchObject({
      kind: "superseded",
      proposal: {
        proposalId: pending.proposalId,
        status: "superseded",
      },
    });
  });

  it("keeps superseded settlement reports proposal-only", async () => {
    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createHitlBinding()],
        execution: {
          projectionId: "proj:wait-report-superseded",
          deriveActor: () => ({
            actorId: "actor:human",
            kind: "human",
          }),
          deriveSource: () => ({
            kind: "ui",
            eventId: "evt:wait-report-superseded",
          }),
        },
      },
    ).activate();

    const pending = await pendingIncrementProposal(governed);

    await governed.bindActor(createAutoBindingForHuman());
    await settledAddProposal(governed, 2);
    await settledIncrementProposal(governed);

    const report = await waitForProposalWithReport(governed, pending);

    expect(report).toMatchObject({
      kind: "superseded",
      proposal: {
        proposalId: pending.proposalId,
        status: "superseded",
      },
    });
    expect("outcome" in report).toBe(false);
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

    await settledIncrementProposal(governed);

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

    const proposal = await settledLoadProposal(governed);

    expect(proposal.status).toBe("failed");
    expect(proposal.resultWorld).toBeDefined();
    expect(governed.snapshot().state.status).toBe("idle");
    expect(events.some((event) => event.type === "execution:failed")).toBe(true);

    const decision = await governed.getDecisionRecord(proposal.decisionId!);
    expect(decision?.decision.kind).toBe("approved");
  });

  it("returns failed settlements with ErrorInfo and no visible snapshot fabrication", async () => {
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
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:wait-failed",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:wait-failed",
          }),
        },
      },
    ).activate();

    const proposal = await settledLoadProposal(governed);
    const settlement = await waitForProposal(governed, proposal);

    expect(settlement).toMatchObject({
      kind: "failed",
      resultWorld: proposal.resultWorld,
      error: {
        summary: "Execution failed with 1 pending requirement(s)",
        pendingRequirements: [expect.any(String)],
      },
    });
    if (settlement.kind !== "failed") {
      throw new Error("expected failed settlement");
    }
    expect("snapshot" in settlement).toBe(false);
  });

  it("returns sealed failed-world reports without fabricating visible publication", async () => {
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
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:wait-report-failed",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:wait-report-failed",
          }),
        },
      },
    ).activate();

    const proposal = await settledLoadProposal(governed);
    const report = await waitForProposalWithReport(governed, proposal);

    expect(report).toMatchObject({
      kind: "failed",
      baseWorld: proposal.baseWorld,
      resultWorld: proposal.resultWorld,
      published: false,
      error: {
        summary: "Execution failed with 1 pending requirement(s)",
      },
    });
    if (report.kind !== "failed" || !report.resultWorld || !report.sealedOutcome) {
      throw new Error("expected failed report with sealed outcome");
    }

    const ext = getExtensionKernel(governed);
    const beforeWorld = await governed.getWorldSnapshot(report.baseWorld);
    const afterWorld = await governed.getWorldSnapshot(report.resultWorld);
    if (!beforeWorld || !afterWorld) {
      throw new Error("expected stored worlds for failed report");
    }

    expect(report.sealedOutcome.canonical.beforeCanonicalSnapshot).toEqual(beforeWorld);
    expect(report.sealedOutcome.canonical.afterCanonicalSnapshot).toEqual(afterWorld);
    expect(report.sealedOutcome.projected.afterSnapshot).toEqual(ext.projectSnapshot(afterWorld));
    expect(governed.snapshot().state.status).toBe("idle");
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

    const submission = await submitIncrement(governed);
    await expect(submission.waitForSettlement()).resolves.toMatchObject({
      ok: false,
      status: "settlement_failed",
    });

    const activeBranch = await failingService.getActiveBranch();
    const stored = await governanceStore.getProposalsByBranch(activeBranch.id);

    expect(stored).toHaveLength(1);
    expect(stored[0]?.status).toBe("failed");
    expect(stored[0]?.resultWorld).toBeUndefined();
    expect(await governanceStore.getExecutionStageProposal(activeBranch.id)).toBeNull();

    await expect(waitForProposal(governed, stored[0]!.proposalId)).resolves.toMatchObject({
      kind: "failed",
      proposal: {
        proposalId: stored[0]!.proposalId,
        status: "failed",
      },
      error: {
        summary: "Execution failed before a result world was recorded",
      },
    });

    const report = await waitForProposalWithReport(governed, stored[0]!.proposalId);

    expect(report).toMatchObject({
      kind: "failed",
      proposal: {
        proposalId: stored[0]!.proposalId,
        status: "failed",
      },
      baseWorld: stored[0]!.baseWorld,
      published: false,
      error: {
        summary: "Execution failed before a result world was recorded",
      },
    });
    if (report.kind !== "failed") {
      throw new Error("expected failed settlement report");
    }
    expect(report.resultWorld).toBeUndefined();
    expect(report.sealedOutcome).toBeUndefined();
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

    const submission = await submitIncrement(governed);
    await expect(submission.waitForSettlement()).resolves.toMatchObject({
      ok: true,
      status: "settled",
    });

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

    const submission = await submitIncrement(governed);
    await expect(submission.waitForSettlement()).resolves.toMatchObject({
      ok: false,
      status: "settlement_failed",
    });

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

    const submission = await submitIncrement(governed);
    await expect(submission.waitForSettlement()).resolves.toMatchObject({
      ok: false,
      status: "settlement_failed",
    });

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

    const proposal = await settledIncrementProposal(governed);

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

    const pendingProposal = pendingIncrementProposal(governed);

    await getActorBindingStarted.promise;
    const bindingUpdate = governed.bindActor(createAutoBindingForHuman());
    gate.resolve();

    const proposal = await pendingProposal;
    await bindingUpdate;

    expect(proposal.status).toBe("evaluating");
    expect(governed.snapshot().state.count).toBe(0);

    const next = await settledIncrementProposal(governed);
    expect(next.status).toBe("completed");
    expect(governed.snapshot().state.count).toBe(1);
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

  it("attaches the sdk extension kernel to the activated governance runtime", () => {
    const world = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:extension-kernel",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:extension-kernel",
          }),
        },
      },
    ).activate();
    const ext = getExtensionKernel(world);

    expect(ext.projectSnapshot(ext.getCanonicalSnapshot())).toEqual(world.snapshot());

    world.dispose();
  });

  it("preserves coarse and fine legality semantics on the activated governance runtime", () => {
    const schema = createDispatchabilitySchema();
    const governed = withGovernance(
      withLineage(
        createManifesto<DispatchabilityDomain>(schema, {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:dispatchability",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:dispatchability",
          }),
        },
      },
    ).activate();
    const ext = getExtensionKernel(governed);
    const canonical = ext.getCanonicalSnapshot();
    const blockedSpend = ext.createIntent(ext.MEL.actions.spend, 15);

    expect(governed.actions.spend.check(15)).toMatchObject({
      ok: false,
      layer: "dispatchability",
      code: "INTENT_NOT_DISPATCHABLE",
      blockers: [
        {
          code: "INTENT_NOT_DISPATCHABLE",
          message: "Spend only when balance covers amount",
          detail: {
            layer: "dispatchable",
            expression: schema.actions.spend.dispatchable,
          },
        },
      ],
    });
    expect(ext.isIntentDispatchableFor(canonical, blockedSpend)).toBe(false);

    expect(governed.actions.frozenSpend.check(1)).toMatchObject({
      ok: false,
      layer: "availability",
      code: "ACTION_UNAVAILABLE",
      blockers: [],
    });

    governed.dispose();
  });

  it("rejects waitForProposal() for missing proposals", async () => {
    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:wait-missing",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:wait-missing",
          }),
        },
      },
    ).activate();

    await expect(waitForProposal(governed, "proposal:missing")).rejects.toMatchObject<
      Partial<ManifestoError>
    >({
      code: "GOVERNANCE_PROPOSAL_NOT_FOUND",
    });
  });

  it("rejects waitForProposal() after the governed runtime is disposed", async () => {
    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:wait-disposed",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:wait-disposed",
          }),
        },
      },
    ).activate();

    governed.dispose();

    await expect(waitForProposal(governed, "proposal:disposed")).rejects.toBeInstanceOf(
      DisposedError,
    );
  });

  it("rejects waitForProposalWithReport() after the governed runtime is disposed", async () => {
    const governed = withGovernance(
      withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:wait-report-disposed",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:wait-report-disposed",
          }),
        },
      },
    ).activate();

    governed.dispose();

    await expect(
      waitForProposalWithReport(governed, "proposal:disposed"),
    ).rejects.toBeInstanceOf(DisposedError);
  });

  it("emits submission:rejected without submission:failed for non-dispatchable governed execution", async () => {
    const governed = withGovernance(
      withLineage(
        createManifesto<DispatchabilityDomain>(createDispatchabilitySchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:governance-rejected",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:governance-rejected",
          }),
        },
      },
    ).activate();
    const rejected = vi.fn();
    const failed = vi.fn();

    governed.observe.event("submission:rejected", rejected);
    governed.observe.event("submission:failed", failed);

    await expect(governed.actions.spend.submit(15)).resolves.toMatchObject({
      ok: false,
      admission: {
        code: "INTENT_NOT_DISPATCHABLE",
      },
    });

    expect(rejected).toHaveBeenCalledTimes(1);
    expect(rejected.mock.calls[0]?.[0]).toMatchObject({
      admission: {
        code: "INTENT_NOT_DISPATCHABLE",
      },
    });
    expect(failed).not.toHaveBeenCalled();

    governed.dispose();
  });

  it("emits submission:rejected without submission:failed for invalid governed input", async () => {
    const governed = withGovernance(
      withLineage(
        createManifesto<DispatchabilityDomain>(createDispatchabilitySchema(), {}),
        { store: createInMemoryLineageStore() },
      ),
      {
        governanceStore: createInMemoryGovernanceStore(),
        bindings: [createAutoBinding()],
        execution: {
          projectionId: "proj:governance-invalid-input",
          deriveActor: () => ({
            actorId: "actor:auto",
            kind: "agent",
          }),
          deriveSource: () => ({
            kind: "agent",
            eventId: "evt:governance-invalid-input",
          }),
        },
      },
    ).activate();
    const rejected = vi.fn();
    const failed = vi.fn();

    governed.observe.event("submission:rejected", rejected);
    governed.observe.event("submission:failed", failed);

    await expect(
      governed.actions.spend.submit("oops" as unknown as number),
    ).resolves.toMatchObject({
      ok: false,
      admission: {
        code: "INVALID_INPUT",
      },
    });

    expect(rejected).toHaveBeenCalledTimes(1);
    expect(rejected.mock.calls[0]?.[0]).toMatchObject({
      admission: {
        code: "INVALID_INPUT",
      },
    });
    expect(failed).not.toHaveBeenCalled();

    governed.dispose();
  });
});
