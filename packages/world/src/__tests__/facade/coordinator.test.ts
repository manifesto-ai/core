import { describe, expect, it, vi } from "vitest";
import {
  createGovernanceEventDispatcher,
  createWorld,
  type GovernanceEventDispatcher as FacadeDispatcher,
} from "../../index.js";
import { FacadeCasMismatchError } from "../../facade/internal/errors.js";
import { createFacadeHarness, createExecutingProposal, createSnapshot, sealStandaloneGenesis } from "./helpers.js";

describe("@manifesto-ai/world facade coordinator", () => {
  it("orders normal seals as prepare -> finalize -> commit -> dispatch", () => {
    const harness = createFacadeHarness();
    const { world } = sealStandaloneGenesis(harness);
    const { proposal, decisionRecord } = createExecutingProposal(harness);
    const order: string[] = [];

    const originalPrepare = harness.lineage.prepareSealNext.bind(harness.lineage);
    const originalFinalize = harness.governance.finalize.bind(harness.governance);
    const originalCommit = harness.store.commitSeal.bind(harness.store);
    const baseDispatcher = createGovernanceEventDispatcher({
      service: harness.governance,
      sink: {
        emit(event): void {
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
      emitSealRejected(): void {
        order.push("dispatchRejected");
      },
    };

    vi.spyOn(harness.lineage, "prepareSealNext").mockImplementation((input) => {
      order.push("prepare");
      return originalPrepare(input);
    });
    vi.spyOn(harness.governance, "finalize").mockImplementation((...args) => {
      order.push("finalize");
      return originalFinalize(...args);
    });
    vi.spyOn(harness.store, "commitSeal").mockImplementation((writeSet) => {
      order.push("commit");
      return originalCommit(writeSet);
    });

    const governedWorld = createWorld({
      store: harness.store,
      lineage: harness.lineage,
      governance: harness.governance,
      eventDispatcher: dispatcher,
    });

    const result = governedWorld.coordinator.sealNext({
      executingProposal: proposal,
      completedAt: 20,
      sealInput: {
        schemaHash: "wfcts-schema",
        baseWorldId: world!.worldId,
        branchId: harness.lineage.getActiveBranch().id,
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
      "world:forked",
      "execution:completed",
    ]);
  });

  it("routes seal rejection through finalizeOnSealRejection and emits only after commit", () => {
    const harness = createFacadeHarness();
    const { world } = sealStandaloneGenesis(harness);
    const { proposal } = createExecutingProposal(harness);
    const order: string[] = [];

    const originalPrepare = harness.lineage.prepareSealNext.bind(harness.lineage);
    const originalFinalizeOnSealRejection = harness.governance.finalizeOnSealRejection.bind(harness.governance);
    const originalCommit = harness.store.commitSeal.bind(harness.store);
    const baseDispatcher = createGovernanceEventDispatcher({
      service: harness.governance,
      sink: {
        emit(event): void {
          harness.events.push(event);
        },
      },
      now: () => 1000,
    });
    const dispatcher: FacadeDispatcher = {
      emitSealCompleted(): void {
        order.push("dispatchCompleted");
      },
      emitSealRejected(governanceCommit, rejection): void {
        order.push("dispatchRejected");
        baseDispatcher.emitSealRejected(governanceCommit, rejection);
      },
    };

    vi.spyOn(harness.lineage, "prepareSealNext").mockImplementation((input) => {
      order.push("prepare");
      return originalPrepare(input);
    });
    vi.spyOn(harness.governance, "finalizeOnSealRejection").mockImplementation((...args) => {
      order.push("finalizeRejected");
      return originalFinalizeOnSealRejection(...args);
    });
    vi.spyOn(harness.store, "commitSeal").mockImplementation((writeSet) => {
      order.push("commit");
      return originalCommit(writeSet);
    });

    const governedWorld = createWorld({
      store: harness.store,
      lineage: harness.lineage,
      governance: harness.governance,
      eventDispatcher: dispatcher,
    });

    const result = governedWorld.coordinator.sealNext({
      executingProposal: proposal,
      completedAt: 20,
      sealInput: {
        schemaHash: "wfcts-schema",
        baseWorldId: world!.worldId,
        branchId: harness.lineage.getActiveBranch().id,
        terminalSnapshot: createSnapshot({ count: 1 }),
        createdAt: 19,
        proposalRef: proposal.proposalId,
        decisionRef: proposal.decisionId,
      },
    });

    expect(result.kind).toBe("sealRejected");
    expect(result.rejection.kind).toBe("worldId_collision");
    expect(order).toEqual(["prepare", "finalizeRejected", "commit", "dispatchRejected"]);
    expect(harness.events.map((event) => event.type)).toEqual(["execution:seal_rejected"]);
    expect(harness.store.getProposal(proposal.proposalId)?.status).toBe("failed");
  });

  it("bypasses commitSeal and event dispatch during standalone genesis", () => {
    const harness = createFacadeHarness();
    const commitSpy = vi.spyOn(harness.store, "commitSeal");
    const dispatcher: FacadeDispatcher = {
      emitSealCompleted(): void {
        harness.events.push({ type: "execution:completed" } as never);
      },
      emitSealRejected(): void {
        harness.events.push({ type: "execution:seal_rejected" } as never);
      },
    };
    const governedWorld = createWorld({
      store: harness.store,
      lineage: harness.lineage,
      governance: harness.governance,
      eventDispatcher: dispatcher,
    });

    const result = governedWorld.coordinator.sealGenesis({
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
    expect(harness.lineage.getLatestHead()?.worldId).toBe(result.worldId);
  });

  it("retries from prepare on CAS mismatch", () => {
    const harness = createFacadeHarness();
    const { world } = sealStandaloneGenesis(harness);
    const { proposal, decisionRecord } = createExecutingProposal(harness);

    const prepareSpy = vi.spyOn(harness.lineage, "prepareSealNext");
    const originalCommit = harness.store.commitSeal.bind(harness.store);
    const commitSpy = vi.spyOn(harness.store, "commitSeal");
    commitSpy
      .mockImplementationOnce(() => {
        throw new FacadeCasMismatchError("simulated CAS mismatch");
      })
      .mockImplementation((writeSet) => originalCommit(writeSet));

    const governedWorld = createWorld({
      store: harness.store,
      lineage: harness.lineage,
      governance: harness.governance,
      eventDispatcher: createGovernanceEventDispatcher({
        service: harness.governance,
        sink: {
          emit(event): void {
            harness.events.push(event);
          },
        },
        now: () => 1000,
      }) as FacadeDispatcher,
    });

    const result = governedWorld.coordinator.sealNext({
      executingProposal: proposal,
      completedAt: 20,
      sealInput: {
        schemaHash: "wfcts-schema",
        baseWorldId: world!.worldId,
        branchId: harness.lineage.getActiveBranch().id,
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
      "world:forked",
      "execution:completed",
    ]);
  });
});
