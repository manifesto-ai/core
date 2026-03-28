import type { Snapshot } from "@manifesto-ai/core";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createInMemoryWorldStore,
  createLineageService,
  createWorld,
  type CommitCapableWorldStore,
  type DecisionRecord,
  type GovernanceEvent,
  type Proposal,
  type WorldInstance,
} from "../../index.js";

export function createSnapshot(
  data: Record<string, unknown>,
  overrides?: Partial<Snapshot>
): Snapshot {
  return {
    data,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      pendingRequirements: [],
      errors: [],
      currentAction: null,
    },
    input: {},
    meta: {
      version: 1,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "wfcts-schema",
    },
    ...overrides,
  };
}

export interface FacadeHarness {
  readonly store: CommitCapableWorldStore;
  readonly lineage: WorldInstance["lineage"];
  readonly governance: WorldInstance["governance"];
  readonly world: WorldInstance;
  readonly events: GovernanceEvent[];
}

export function createFacadeHarness(): FacadeHarness {
  const store = createInMemoryWorldStore();
  const lineage = createLineageService(store);
  const governance = createGovernanceService(store, { lineageService: lineage });
  const events: GovernanceEvent[] = [];
  const dispatcher = createGovernanceEventDispatcher({
    service: governance,
    sink: {
      emit(event): void {
        events.push(event);
      },
    },
    now: () => 1000,
  });

  return {
    store,
    lineage,
    governance,
    world: createWorld({
      store,
      lineage,
      governance,
      eventDispatcher: dispatcher,
    }),
    events,
  };
}

export function sealStandaloneGenesis(harness: FacadeHarness) {
  const sealInput = {
    schemaHash: "wfcts-schema",
    terminalSnapshot: createSnapshot({ count: 1 }),
    createdAt: 1,
  } as const;
  const result = harness.world.coordinator.sealGenesis({
    kind: "standalone",
    sealInput,
  });

  return {
    result,
    sealInput,
    branch: harness.lineage.getActiveBranch(),
    world: harness.lineage.getLatestHead(),
  };
}

export function createExecutingProposal(
  harness: FacadeHarness,
  options?: {
    proposalId?: string;
    executionKey?: string;
    submittedAt?: number;
    decidedAt?: number;
  }
): { proposal: Proposal; decisionRecord: DecisionRecord } {
  const branch = harness.lineage.getActiveBranch();
  const baseWorld = branch.head;
  const proposal = harness.governance.createProposal({
    proposalId: options?.proposalId,
    baseWorld,
    branchId: branch.id,
    actorId: "actor-1",
    authorityId: "auth-1",
    intent: {
      type: "demo.intent",
      intentId: "intent-1",
      input: { count: 2 },
    },
    executionKey: options?.executionKey ?? "exec-key-1",
    submittedAt: options?.submittedAt ?? 10,
    epoch: branch.epoch,
  });
  const prepared = harness.governance.prepareAuthorityResult(
    { ...proposal, status: "evaluating" },
    { kind: "approved", approvedScope: null },
    {
      currentEpoch: branch.epoch,
      currentBranchHead: baseWorld,
      decidedAt: options?.decidedAt ?? 11,
    }
  );

  if (!prepared.decisionRecord) {
    throw new Error("expected decision record");
  }

  const executing = {
    ...prepared.proposal,
    status: "executing" as const,
    decisionId: prepared.decisionRecord.decisionId,
    decidedAt: prepared.decisionRecord.decidedAt,
  };

  harness.store.putProposal(executing);
  harness.store.putDecisionRecord(prepared.decisionRecord);

  return {
    proposal: executing,
    decisionRecord: prepared.decisionRecord,
  };
}
