import { describe, expect, it, vi } from "vitest";
import {
  createGovernanceEventDispatcher,
  createWorld,
  type GovernanceEventDispatcher as FacadeDispatcher,
  type GovernanceEvent,
} from "../../index.js";
import { FacadeCasMismatchError } from "../../facade/internal/errors.js";
import {
  createFacadeHarness,
  createExecutingProposal,
  createSnapshot,
  sealStandaloneGenesis,
} from "./helpers.js";

describe("@manifesto-ai/world facade coordinator", () => {
  it("orders normal seals as prepare -> finalize -> transaction -> dispatch", async () => {
    const harness = createFacadeHarness();
    const { world } = await sealStandaloneGenesis(harness);
    const { proposal, decisionRecord } = await createExecutingProposal(harness);
    const branch = await harness.lineage.getActiveBranch();
    const order: string[] = [];

    const originalPrepare = harness.lineage.prepareSealNext.bind(harness.lineage);
    const originalFinalize = harness.governance.finalize.bind(harness.governance);
    const originalRunInSealTransaction =
      harness.store.runInSealTransaction.bind(harness.store);
    const baseDispatcher = createGovernanceEventDispatcher({
      service: harness.governance,
      sink: {
        emit(event: GovernanceEvent): void {
          harness.events.push(event);
        },
      },
      now: () => 1000,
    });
    const dispatcher: FacadeDispatcher = {
      emitSealCompleted(governanceCommit, lineageCommit): void {
        order.push("dispatch");
        baseDispatcher.emitSealCompleted(governanceCommit, lineageCommit);
      },
    };

    vi.spyOn(harness.lineage, "prepareSealNext").mockImplementation(async (input) => {
      order.push("prepare");
      return await originalPrepare(input);
    });
    vi.spyOn(harness.governance, "finalize").mockImplementation(async (...args) => {
      order.push("finalize");
      return await originalFinalize(...args);
    });
    vi.spyOn(harness.store, "runInSealTransaction").mockImplementation(
      async (work) => {
        order.push("commit");
        return await originalRunInSealTransaction(work);
      }
    );

    const governedWorld = createWorld({
      store: harness.store,
      lineage: harness.lineage,
      governance: harness.governance,
      eventDispatcher: dispatcher,
      executor: harness.executor,
    });

    const result = await governedWorld.coordinator.sealNext({
      executingProposal: proposal,
      completedAt: 20,
      sealInput: {
        schemaHash: "wfcts-schema",
        baseWorldId: world!.worldId,
        branchId: branch.id,
        terminalSnapshot: createSnapshot({ count: 2 }),
        createdAt: 19,
        proposalRef: proposal.proposalId,
        decisionRef: decisionRecord.decisionId,
      },
    });

    expect(result.kind).toBe("sealed");
    expect(order).toEqual(["prepare", "finalize", "commit", "dispatch"]);
    expect(harness.events.map((event) => event.type)).toEqual([
      "world:created",
      "execution:completed",
    ]);
  });

  it("commits both lineage and governance records through the current typed sealNext path", async () => {
    const harness = createFacadeHarness();
    const { world } = await sealStandaloneGenesis(harness);
    const { proposal, decisionRecord } = await createExecutingProposal(harness);
    const branch = await harness.lineage.getActiveBranch();
    const originalRunInSealTransaction =
      harness.store.runInSealTransaction.bind(harness.store);
    let lineageCommitted = false;
    let governancePersisted = false;
    const dispatcher: FacadeDispatcher = {
      emitSealCompleted(): void {},
    };

    vi.spyOn(harness.store, "runInSealTransaction").mockImplementation(
      async (work) =>
        originalRunInSealTransaction(async (tx) =>
          work({
            async commitPrepared(prepared) {
              lineageCommitted = true;
              await tx.commitPrepared(prepared);
            },
            async putProposal(proposalRecord) {
              governancePersisted = true;
              await tx.putProposal(proposalRecord);
            },
            async putDecisionRecord(record) {
              await tx.putDecisionRecord(record);
            },
          })
        )
    );

    const governedWorld = createWorld({
      store: harness.store,
      lineage: harness.lineage,
      governance: harness.governance,
      eventDispatcher: dispatcher,
      executor: harness.executor,
    });

    const result = await governedWorld.coordinator.sealNext({
      executingProposal: proposal,
      completedAt: 20,
      sealInput: {
        schemaHash: "wfcts-schema",
        baseWorldId: world!.worldId,
        branchId: branch.id,
        terminalSnapshot: createSnapshot({ count: 3 }),
        createdAt: 19,
        proposalRef: proposal.proposalId,
        decisionRef: decisionRecord.decisionId,
      },
    });
    expect(result.kind).toBe("sealed");
    expect(lineageCommitted).toBe(true);
    expect(governancePersisted).toBe(true);
  });

  it("bypasses governed transactions and event dispatch during standalone genesis", async () => {
    const harness = createFacadeHarness();
    const commitSpy = vi.spyOn(harness.store, "runInSealTransaction");
    const dispatcher: FacadeDispatcher = {
      emitSealCompleted(): void {
        harness.events.push({ type: "execution:completed" } as never);
      },
    };
    const governedWorld = createWorld({
      store: harness.store,
      lineage: harness.lineage,
      governance: harness.governance,
      eventDispatcher: dispatcher,
      executor: harness.executor,
    });

    const result = await governedWorld.coordinator.sealGenesis({
      kind: "standalone",
      sealInput: {
        schemaHash: "wfcts-schema",
        terminalSnapshot: createSnapshot({ count: 1 }),
        createdAt: 1,
      },
    });

    expect(result.kind).toBe("sealed");
    expect(commitSpy).not.toHaveBeenCalled();
    expect(harness.events).toHaveLength(0);
    if (result.kind !== "sealed") {
      throw new Error("expected sealed genesis result");
    }
    expect((await harness.lineage.getLatestHead())?.worldId).toBe(result.worldId);
  });

  it("retries from prepare on transaction CAS mismatch", async () => {
    const harness = createFacadeHarness();
    const { world } = await sealStandaloneGenesis(harness);
    const { proposal, decisionRecord } = await createExecutingProposal(harness);
    const branch = await harness.lineage.getActiveBranch();

    const prepareSpy = vi.spyOn(harness.lineage, "prepareSealNext");
    const originalRunInSealTransaction =
      harness.store.runInSealTransaction.bind(harness.store);
    const commitSpy = vi.spyOn(harness.store, "runInSealTransaction");
    commitSpy
      .mockImplementationOnce(async () => {
        throw new FacadeCasMismatchError("simulated CAS mismatch");
      })
      .mockImplementation(async (work) => originalRunInSealTransaction(work));

    const governedWorld = createWorld({
      store: harness.store,
      lineage: harness.lineage,
      governance: harness.governance,
      eventDispatcher: createGovernanceEventDispatcher({
        service: harness.governance,
        sink: {
          emit(event: GovernanceEvent): void {
            harness.events.push(event);
          },
        },
        now: () => 1000,
      }) as FacadeDispatcher,
      executor: harness.executor,
    });

    const result = await governedWorld.coordinator.sealNext({
      executingProposal: proposal,
      completedAt: 20,
      sealInput: {
        schemaHash: "wfcts-schema",
        baseWorldId: world!.worldId,
        branchId: branch.id,
        terminalSnapshot: createSnapshot({ count: 2 }),
        createdAt: 19,
        proposalRef: proposal.proposalId,
        decisionRef: decisionRecord.decisionId,
      },
    });

    expect(result.kind).toBe("sealed");
    expect(prepareSpy).toHaveBeenCalledTimes(2);
    expect(commitSpy).toHaveBeenCalledTimes(2);
    expect(harness.events.map((event) => event.type)).toEqual([
      "world:created",
      "execution:completed",
    ]);
  });

  it("wraps first-attempt lineage head mismatch as a facade CAS signal", async () => {
    const harness = createFacadeHarness();
    const { world } = await sealStandaloneGenesis(harness);
    const { proposal, decisionRecord } = await createExecutingProposal(harness);
    const branch = await harness.lineage.getActiveBranch();

    vi.spyOn(harness.lineage, "prepareSealNext").mockImplementationOnce(async () => {
      throw new Error(
        "LIN-BRANCH-SEAL-2 violation: branch head advanced before commit"
      );
    });

    const governedWorld = createWorld({
      store: harness.store,
      lineage: harness.lineage,
      governance: harness.governance,
      eventDispatcher: createGovernanceEventDispatcher({
        service: harness.governance,
        sink: {
          emit(event: GovernanceEvent): void {
            harness.events.push(event);
          },
        },
        now: () => 1000,
      }) as FacadeDispatcher,
      executor: harness.executor,
    });

    await expect(
      governedWorld.coordinator.sealNext({
        executingProposal: proposal,
        completedAt: 20,
        sealInput: {
          schemaHash: "wfcts-schema",
          baseWorldId: world!.worldId,
          branchId: branch.id,
          terminalSnapshot: createSnapshot({ count: 2 }),
          createdAt: 19,
          proposalRef: proposal.proposalId,
          decisionRef: decisionRecord.decisionId,
        },
      })
    ).rejects.toThrow(FacadeCasMismatchError);
  });
});
