import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createIntentInstance,
  createLineageService,
  createWorld,
  type Proposal,
  type Snapshot,
  type WorldExecutor,
} from "@manifesto-ai/world";
import { createSqliteWorldStore } from "@manifesto-ai/world/sqlite";

const SCHEMA_HASH = "counter-v1";

function readCount(snapshot: Snapshot): number {
  const data = snapshot.data;
  if (
    typeof data === "object"
    && data !== null
    && "count" in data
    && typeof data.count === "number"
  ) {
    return data.count;
  }
  return 0;
}

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

async function main(): Promise<void> {
  const filename = process.env.MANIFESTO_SQLITE_FILE
    ?? join(tmpdir(), `manifesto-governed-${crypto.randomUUID()}.sqlite`);
  mkdirSync(dirname(filename), { recursive: true });

  const store = createSqliteWorldStore({ filename });
  const lineage = createLineageService(store);
  const governance = createGovernanceService(store, {
    lineageService: lineage,
  });
  const events: string[] = [];
  const executor: WorldExecutor = {
    async execute(_key, baseSnapshot) {
      return {
        outcome: "completed",
        terminalSnapshot: createCounterSnapshot(
          readCount(baseSnapshot) + 1,
          baseSnapshot.meta.version + 1
        ),
      };
    },
  };

  const world = createWorld({
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
      now: () => Date.now(),
    }),
    executor,
  });

  const genesis = await world.coordinator.sealGenesis({
    kind: "standalone",
    sealInput: {
      schemaHash: SCHEMA_HASH,
      terminalSnapshot: createCounterSnapshot(0, 1),
      createdAt: 1,
    },
  });

  const intent = await createIntentInstance({
    body: {
      type: "counter.increment",
      input: { amount: 1 },
    },
    schemaHash: SCHEMA_HASH,
    projectionId: "counter-cli",
    source: { kind: "system", eventId: "evt-1" },
    actor: { actorId: "local-user", kind: "human" },
    intentId: "intent-1",
  });

  const branch = await world.lineage.getActiveBranch();
  const proposal = governance.createProposal({
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

  const approved = await governance.prepareAuthorityResult(
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

  await store.putProposal(executingProposal);
  await store.putDecisionRecord(approved.decisionRecord);

  const completion = await world.runtime.executeApprovedProposal({
    proposal: executingProposal,
    completedAt: 4,
  });
  const restored = await world.lineage.restore(completion.resultWorld);

  console.log(
    JSON.stringify(
      {
        sqliteFile: filename,
        completion: completion.kind,
        proposalStatus: completion.proposal.status,
        worldId: completion.resultWorld,
        count: readCount(restored),
        events,
      },
      null,
      2
    )
  );

  await store.close();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
