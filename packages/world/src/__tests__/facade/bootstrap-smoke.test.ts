import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createIntentInstance,
  createLineageService,
  createWorld,
  type GovernedWorldStore,
  type Proposal,
  type Snapshot,
  type WorldExecutor,
  type WorldInstance,
} from "../../index.js";
import { createSqliteWorldStore } from "../../sqlite.js";

const SCHEMA_HASH = "counter-v1";

function createCounterSnapshot(count: number, version: number): Snapshot {
  return {
    data: { count },
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      pendingRequirements: [],
      errors: [],
      currentAction: null,
    },
    input: null,
    meta: {
      version,
      timestamp: version,
      randomSeed: `seed-${version}`,
      schemaHash: SCHEMA_HASH,
    },
  };
}

describe("@manifesto-ai/world consumer bootstrap smoke", () => {
  async function createSqliteHarness(
    filename: string,
    executor: WorldExecutor,
    events: string[]
  ): Promise<{
    world: WorldInstance;
    store: GovernedWorldStore & { close(): Promise<void> };
  }> {
    const store = createSqliteWorldStore({ filename });
    const lineage = createLineageService(store);
    const governance = createGovernanceService(store, {
      lineageService: lineage,
    });

    return {
      world: createWorld({
        store,
        lineage,
        governance,
        eventDispatcher: createGovernanceEventDispatcher({
          service: governance,
          sink: {
            emit(event): void {
              events.push(event.type);
            },
          },
          now: () => 1000,
        }),
        executor,
      }),
      store,
    };
  }

  async function createExecutingProposal(world: WorldInstance): Promise<Proposal> {
    const intent = await createIntentInstance({
      body: {
        type: "counter.increment",
        input: { amount: 1 },
      },
      schemaHash: SCHEMA_HASH,
      projectionId: "counter-cli",
      source: { kind: "script", eventId: "evt-1" },
      actor: { actorId: "local-user", kind: "human" },
      intentId: "intent-1",
    });
    const branch = await world.lineage.getActiveBranch();
    const proposal = world.governance.createProposal({
      baseWorld: branch.head,
      branchId: branch.id,
      actorId: intent.meta.origin.actor.actorId,
      authorityId: "auth-local",
      intent: {
        type: intent.body.type,
        intentId: intent.intentId,
        input: intent.body.input,
        scopeProposal: intent.body.scopeProposal,
      },
      executionKey: intent.intentKey,
      submittedAt: 2,
      epoch: branch.epoch,
    });
    const approved = await world.governance.prepareAuthorityResult(
      { ...proposal, status: "evaluating" },
      { kind: "approved", approvedScope: null },
      {
        currentEpoch: branch.epoch,
        currentBranchHead: branch.head,
        decidedAt: 3,
      }
    );

    if (approved.discarded || !approved.decisionRecord) {
      throw new Error("expected approved executing proposal");
    }

    const executingProposal: Proposal = {
      ...approved.proposal,
      status: "executing",
      decisionId: approved.decisionRecord.decisionId,
      decidedAt: approved.decisionRecord.decidedAt,
    };

    await world.store.putProposal(executingProposal);
    await world.store.putDecisionRecord(approved.decisionRecord);

    return executingProposal;
  }

  it("assembles a local sqlite-backed governed runtime and seals an executed proposal", async () => {
    const dir = mkdtempSync(join(tmpdir(), "manifesto-governed-smoke-"));
    const filename = join(dir, "world.sqlite");
    const events: string[] = [];
    const executor: WorldExecutor = {
      async execute(_key, baseSnapshot) {
        const count = typeof baseSnapshot.data.count === "number"
          ? baseSnapshot.data.count
          : 0;
        return {
          outcome: "completed",
          terminalSnapshot: createCounterSnapshot(count + 1, baseSnapshot.meta.version + 1),
        };
      },
    };
    const { world, store } = await createSqliteHarness(filename, executor, events);

    try {
      await world.coordinator.sealGenesis({
        kind: "standalone",
        sealInput: {
          schemaHash: SCHEMA_HASH,
          terminalSnapshot: createCounterSnapshot(0, 1),
          createdAt: 1,
        },
      });
      const executingProposal = await createExecutingProposal(world);

      const completion = await world.runtime.executeApprovedProposal({
        proposal: executingProposal,
        completedAt: 4,
      });
      const restored = await world.lineage.restore(completion.resultWorld);

      expect(completion.kind).toBe("sealed");
      expect(restored.data.count).toBe(1);
      expect(completion.proposal.status).toBe("completed");
      expect(events).toEqual(["world:created", "execution:completed"]);
    } finally {
      await store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reopens a sqlite-backed store and converges replay to recovered without duplicate events", async () => {
    const dir = mkdtempSync(join(tmpdir(), "manifesto-governed-recovery-"));
    const filename = join(dir, "world.sqlite");
    const initialEvents: string[] = [];
    let executorCalls = 0;
    const executor: WorldExecutor = {
      async execute(_key, baseSnapshot) {
        executorCalls += 1;
        const count = typeof baseSnapshot.data.count === "number"
          ? baseSnapshot.data.count
          : 0;
        return {
          outcome: "completed",
          terminalSnapshot: createCounterSnapshot(count + 1, baseSnapshot.meta.version + 1),
        };
      },
    };
    const { world: initialWorld, store: initialStore } = await createSqliteHarness(
      filename,
      executor,
      initialEvents
    );

    try {
      await initialWorld.coordinator.sealGenesis({
        kind: "standalone",
        sealInput: {
          schemaHash: SCHEMA_HASH,
          terminalSnapshot: createCounterSnapshot(0, 1),
          createdAt: 1,
        },
      });
      const executingProposal = await createExecutingProposal(initialWorld);
      const sealed = await initialWorld.runtime.executeApprovedProposal({
        proposal: executingProposal,
        completedAt: 4,
      });

      expect(sealed.kind).toBe("sealed");
      expect(initialEvents).toEqual(["world:created", "execution:completed"]);

      await initialStore.close();

      const replayEvents: string[] = [];
      const { world: reopenedWorld, store: reopenedStore } = await createSqliteHarness(
        filename,
        executor,
        replayEvents
      );

      try {
        const resumeSnapshot = await reopenedWorld.lineage.restore(sealed.resultWorld);
        const recovered = await reopenedWorld.runtime.resumeExecutingProposal({
          proposal: executingProposal,
          resumeSnapshot,
          completedAt: 5,
        });

        expect(recovered.kind).toBe("recovered");
        expect(recovered.proposal.status).toBe("completed");
        expect(recovered.resultWorld).toBe(sealed.resultWorld);
        expect(replayEvents).toEqual([]);
        expect(executorCalls).toBe(1);
      } finally {
        await reopenedStore.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
