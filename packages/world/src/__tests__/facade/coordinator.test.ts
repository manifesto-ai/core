import { describe, expect, it, vi } from "vitest";
import {
  createGovernanceEventDispatcher,
  createWorld,
  type GovernanceEventDispatcher as FacadeDispatcher,
  type GovernanceEvent,
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

    vi.spyOn(harness.lineage, "prepareSealNext").mockImplementation((input: Parameters<typeof originalPrepare>[0]) => {
      order.push("prepare");
      return originalPrepare(input);
    });
    vi.spyOn(harness.governance, "finalize").mockImplementation((...args: Parameters<typeof originalFinalize>) => {
      order.push("finalize");
      return originalFinalize(...args);
    });
    vi.spyOn(harness.store, "commitSeal").mockImplementation((writeSet: Parameters<typeof originalCommit>[0]) => {
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
      "execution:completed",
    ]);
  });

  it("does not use governance-only fallback during the current typed sealNext path", () => {
    const harness = createFacadeHarness();
    const { world } = sealStandaloneGenesis(harness);
    const { proposal, decisionRecord } = createExecutingProposal(harness);
    const originalCommit = harness.store.commitSeal.bind(harness.store);
    let committedWriteSet: {
      kind?: string;
      lineage?: unknown;
      governance?: unknown;
    } | null = null;
    const dispatcher: FacadeDispatcher = {
      emitSealCompleted(): void {},
    };

    vi.spyOn(harness.store, "commitSeal").mockImplementation((writeSet) => {
      committedWriteSet = writeSet as {
        kind?: string;
        lineage?: unknown;
        governance?: unknown;
      };
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
        terminalSnapshot: createSnapshot({ count: 3 }),
        createdAt: 19,
        proposalRef: proposal.proposalId,
        decisionRef: decisionRecord.decisionId,
      },
    });
    const hasLineagePayload = committedWriteSet != null
      && typeof committedWriteSet === "object"
      && "lineage" in committedWriteSet
      && (committedWriteSet as { lineage?: unknown }).lineage !== undefined;
    const usesGovOnlyVariant = committedWriteSet != null
      && typeof committedWriteSet === "object"
      && "kind" in committedWriteSet
      && (committedWriteSet as { kind?: string }).kind === "govOnly";

    expect(result.kind).toBe("sealed");
    expect(committedWriteSet).not.toBeNull();
    expect(hasLineagePayload).toBe(true);
    expect(usesGovOnlyVariant).toBe(false);
  });

  it("bypasses commitSeal and event dispatch during standalone genesis", () => {
    const harness = createFacadeHarness();
    const commitSpy = vi.spyOn(harness.store, "commitSeal");
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
    if (result.kind !== "sealed") {
      throw new Error("expected sealed genesis result");
    }
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
          emit(event: GovernanceEvent): void {
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
      "execution:completed",
    ]);
  });
});
