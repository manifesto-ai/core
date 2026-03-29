/**
 * Compiler -> World -> Host -> Core Integration
 * Small to complex end-to-end cases, including shipment.mel.
 */

import { describe, it, expect } from "vitest";
import {
  compileMelDomain,
  lowerSystemValues,
  type CompileMelDomainResult,
  type DomainSchema as MelDomainSchema,
} from "../../src/index.js";
import {
  createCore,
  semanticPathToPatchPath,
  type Snapshot,
  type DomainSchema as CoreDomainSchema,
} from "@manifesto-ai/core";
import { createHost, type ManifestoHost } from "../../../host/src/index.js";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createInMemoryWorldStore,
  createLineageService,
  createWorld,
  createIntentInstance,
  type ActorRef,
  type IntentInstance,
  type Proposal,
  type DecisionRecord,
} from "@manifesto-ai/world";
import type { ErrorValue } from "@manifesto-ai/core";

const HOST_CONTEXT = {
  now: () => 0,
  randomSeed: () => "seed",
  initialRandomSeed: "seed",
};

const HOST_RUNTIME = {
  now: HOST_CONTEXT.now,
  microtask: (fn: () => void) => queueMicrotask(fn),
  yield: async () => Promise.resolve(),
};

const ACTOR: ActorRef = { actorId: "actor-1", kind: "human" };
function adaptSchema(schema: MelDomainSchema): CoreDomainSchema {
  return schema as unknown as CoreDomainSchema;
}

function compile(source: string): CompileMelDomainResult & { success: boolean } {
  const result = compileMelDomain(source, { mode: "domain" });
  return {
    ...result,
    success: result.errors.length === 0 && result.schema !== null,
  };
}

function compileAndLower(source: string): MelDomainSchema | null {
  const result = compile(source);
  if (!result.success) return null;
  return lowerSystemValues(result.schema);
}

function createHostWithContext(schema: CoreDomainSchema, initialData: unknown): ManifestoHost {
  return createHost(schema, { initialData, runtime: HOST_RUNTIME });
}

function createTerminalSnapshot(
  data: Record<string, unknown>,
  schemaHash: string
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
      schemaHash,
    },
  };
}

type SubmitProposalResult = {
  readonly proposal: Proposal;
  readonly decision?: DecisionRecord;
  readonly resultWorld?: ReturnType<ReturnType<typeof createLineageService>["getWorld"]>;
  readonly error?: ErrorValue;
};

interface CompilerWorldAdapter {
  readonly submitProposal: (
    actorId: string,
    intent: IntentInstance,
    baseWorld: string
  ) => Promise<SubmitProposalResult>;
  readonly getSnapshot: (worldId: string) => Promise<Snapshot | null>;
}

async function executeHostIntent(
  host: ManifestoHost,
  baseSnapshot: Snapshot,
  intent: IntentInstance,
  executionKey: string
) {
  try {
    host.reset(baseSnapshot);
    const result = await host.dispatch(
      {
        type: intent.body.type,
        input: intent.body.input,
        intentId: intent.intentId,
      },
      { key: executionKey },
    );
    const error = result.error
      ? ({
          code: result.error.code,
          message: result.error.message,
          source: {
            actionId: "host.dispatch",
            nodePath: "execute",
          },
          timestamp: Date.now(),
          context: {
            code: result.error.code,
            details: result.error.details,
          },
        } satisfies ErrorValue)
      : undefined;

    return {
      snapshot: result.snapshot as Snapshot,
      error,
    };
  } catch (error) {
    return {
      snapshot: baseSnapshot,
      error: {
        code: "HOST_EXECUTOR_THROW",
        message: error instanceof Error ? error.message : String(error),
        source: {
          actionId: "host.dispatch",
          nodePath: "execute",
        },
        timestamp: Date.now(),
      } satisfies ErrorValue,
    };
  }
}

async function createFacadeWorldWithGenesis(
  schema: CoreDomainSchema,
  initialSnapshot = createTerminalSnapshot({ count: 0 }, schema.hash)
) {
  const store = createInMemoryWorldStore();
  const lineage = createLineageService(store);
  const governance = createGovernanceService(store, {
    lineageService: lineage,
  });
  const eventDispatcher = createGovernanceEventDispatcher({
    service: governance,
    now: () => 1000,
  });
  const world = createWorld({
    store,
    lineage,
    governance,
    eventDispatcher,
  });
  const genesis = world.coordinator.sealGenesis({
    kind: "standalone",
    sealInput: {
      schemaHash: schema.hash,
      terminalSnapshot: initialSnapshot,
      createdAt: 0,
    },
  });

  if (genesis.kind !== "sealed") {
    throw new Error("Genesis seal must succeed");
  }

  return {
    store,
    lineage,
    governance,
    eventDispatcher,
    world,
    genesis,
  };
}

async function createWorldWithGenesis(schema: CoreDomainSchema, host: ManifestoHost) {
  const snapshot = await host.getSnapshot();
  if (!snapshot) {
    throw new Error("Host snapshot missing");
  }

  const harness = await createFacadeWorldWithGenesis(schema, snapshot);
  const world: CompilerWorldAdapter = {
    submitProposal: async (actorId, intent, baseWorld) => {
      const branch = harness.lineage.getActiveBranch();
      const proposal = harness.governance.createProposal({
        baseWorld,
        branchId: branch.id,
        actorId,
        authorityId: "auth-auto-approve",
        intent: {
          type: intent.body.type,
          intentId: intent.intentId,
          input: intent.body.input,
          scopeProposal: intent.body.scopeProposal,
        },
        executionKey: `exec:${intent.intentId}`,
        submittedAt: 1,
        epoch: branch.epoch,
      });
      const prepared = harness.governance.prepareAuthorityResult(
        { ...proposal, status: "evaluating" },
        { kind: "approved", approvedScope: null },
        {
          currentEpoch: branch.epoch,
          currentBranchHead: baseWorld,
          decidedAt: 2,
        }
      );

      if (prepared.discarded || !prepared.decisionRecord) {
        return {
          proposal: prepared.proposal,
        };
      }

      const executingProposal: Proposal = {
        ...prepared.proposal,
        status: "executing",
        decisionId: prepared.decisionRecord.decisionId,
        decidedAt: prepared.decisionRecord.decidedAt,
      };

      harness.store.putProposal(executingProposal);
      harness.store.putDecisionRecord(prepared.decisionRecord);

      const baseSnapshot = harness.lineage.getSnapshot(baseWorld);
      if (!baseSnapshot) {
        throw new Error(`Missing base snapshot for ${baseWorld}`);
      }

      const hostResult = await executeHostIntent(
        host,
        baseSnapshot,
        intent,
        executingProposal.executionKey
      );

      const sealed = harness.world.coordinator.sealNext({
        executingProposal,
        completedAt: 3,
        sealInput: {
          schemaHash: schema.hash,
          baseWorldId: baseWorld,
          branchId: branch.id,
          terminalSnapshot: hostResult.snapshot,
          createdAt: 2,
          proposalRef: executingProposal.proposalId,
          decisionRef: prepared.decisionRecord.decisionId,
        },
      });

      const finalProposal = harness.store.getProposal(executingProposal.proposalId) ?? executingProposal;
      return {
        proposal: finalProposal,
        decision: prepared.decisionRecord,
        resultWorld: sealed.kind === "sealed"
          ? harness.lineage.getWorld(sealed.worldId)
          : undefined,
        error: hostResult.error,
      };
    },
    getSnapshot: async (worldId) => harness.lineage.getSnapshot(worldId),
  };

  return {
    world,
    genesis: harness.lineage.getWorld(harness.genesis.worldId)!,
  };
}

function registerIntoHandler(
  host: ManifestoHost,
  type: string,
  valueFactory: (params: Record<string, unknown>) => unknown
): void {
  host.registerEffect(type, async (_type, params) => {
    const into = params.into;
    if (typeof into !== "string") {
      return [];
    }
    return [{ op: "set", path: semanticPathToPatchPath(into), value: valueFactory(params) }];
  });
}

describe("Compiler -> World -> Host -> Core", () => {
  it("inlines flow/include before IR generation", () => {
    const result = compile(`
      domain FlowExample {
        state {
          count: number = 0
        }

        flow requireCount() {
          when eq(count, 0) {
            fail "EMPTY"
          }
        }

        action test() {
          include requireCount()
          when true {
            stop "ok"
          }
        }
      }
    `);

    expect(result.success).toBe(true);
    expect(JSON.stringify(result.schema?.actions["test"]?.flow)).not.toContain("\"kind\":\"call\"");
  });

  it("executes a simple action end-to-end", async () => {
    const result = compile(`
      domain Counter {
        state { count: number = 0 }
        computed countValue = count
        action increment() {
          when true { patch count = add(count, 1) }
        }
      }
    `);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const schema = adaptSchema(result.schema);
    const host = createHostWithContext(schema, { count: 0 });
    const { world, genesis } = await createWorldWithGenesis(schema, host);

    const intent = await createIntentInstance({
      body: { type: "increment" },
      schemaHash: schema.hash,
      projectionId: "test:projection",
      source: { kind: "ui", eventId: "event-1" },
      actor: ACTOR,
      intentId: "intent-1",
    });

    const resultWorld = await world.submitProposal(ACTOR.actorId, intent, genesis.worldId);
    expect(resultWorld.resultWorld).toBeDefined();
    const snapshot = await world.getSnapshot(resultWorld.resultWorld!.worldId);
    expect(snapshot?.data).toMatchObject({ count: 1 });
  });

  it("handles effects + system value lowering", async () => {
    const lowered = compileAndLower(
      `
      domain SystemExample {
        state {
          lastId: string = ""
          payload: object = {}
          fetchIntent: string = ""
        }
        computed payloadLoaded = gt(len(keys(payload)), 0)
        action fetch(id: string) {
          once(fetchIntent) {
            effect api.get({ id: id, into: payload })
          }
          when true {
            patch lastId = $system.uuid
          }
        }
      }
      `
    );
    expect(lowered).not.toBeNull();
    if (!lowered) return;

    const schema = adaptSchema(lowered);
    const core = createCore();
    const validation = core.validate(schema);
    expect(validation.valid).toBe(true);

    const host = createHostWithContext(schema, {
      lastId: "",
      payload: {},
      fetchIntent: "",
    });
    registerIntoHandler(host, "system.get", (params) => {
      const key = String(params.key ?? "");
      if (key === "uuid") return "uuid-1";
      if (key === "timestamp") return 1700000000000;
      return `value:${key}`;
    });
    registerIntoHandler(host, "api.get", (params) => ({
      id: params.id,
      ok: true,
    }));

    const { world, genesis } = await createWorldWithGenesis(schema, host);
    const intent = await createIntentInstance({
      body: { type: "fetch", input: { id: "abc" } },
      schemaHash: schema.hash,
      projectionId: "test:projection",
      source: { kind: "api", eventId: "event-2" },
      actor: ACTOR,
      intentId: "intent-2",
    });

    const resultWorld = await world.submitProposal(ACTOR.actorId, intent, genesis.worldId);
    expect(resultWorld.proposal.status).toBe("completed");
    expect(resultWorld.resultWorld).toBeDefined();

    const snapshot = await world.getSnapshot(resultWorld.resultWorld!.worldId);
    expect(snapshot?.data).toMatchObject({
      lastId: "uuid-1",
      payload: { id: "abc", ok: true },
    });
  });

  it("fills time.now and uuid in object literal append", async () => {
    const lowered = compileAndLower(
      `
      domain SystemAppend {
        state {
          entries: Array<object> = []
        }
        computed entryCount = len(entries)
        action appendEntry() {
          when true {
            patch entries = append(entries, { id: $system.uuid, createdAt: $system.time.now })
          }
        }
      }
      `
    );
    expect(lowered).not.toBeNull();
    if (!lowered) return;

    const schema = adaptSchema(lowered);
    const core = createCore();
    const validation = core.validate(schema);
    expect(validation.valid).toBe(true);

    const host = createHostWithContext(schema, { entries: [] });
    registerIntoHandler(host, "system.get", (params) => {
      const key = String(params.key ?? "");
      if (key === "uuid") return "uuid-1";
      if (key === "time.now") return 1700000000000;
      return `value:${key}`;
    });

    const { world, genesis } = await createWorldWithGenesis(schema, host);
    const intent = await createIntentInstance({
      body: { type: "appendEntry" },
      schemaHash: schema.hash,
      projectionId: "test:projection",
      source: { kind: "ui", eventId: "event-4" },
      actor: ACTOR,
      intentId: "intent-4",
    });

    const resultWorld = await world.submitProposal(ACTOR.actorId, intent, genesis.worldId);
    expect(resultWorld.proposal.status).toBe("completed");
    expect(resultWorld.resultWorld).toBeDefined();

    const snapshot = await world.getSnapshot(resultWorld.resultWorld!.worldId);
    expect(snapshot?.data.entries).toHaveLength(1);
    expect(snapshot?.data.entries?.[0]).toEqual(
      expect.objectContaining({
        id: "uuid-1",
        createdAt: 1700000000000,
      })
    );
    expect(snapshot?.data.entries?.[0]?.createdAt).not.toBeUndefined();
  });

  it("executes shipment.mel refreshDashboard", async () => {
    const lowered = compileAndLower(
      `
      domain ShipmentDashboard {
        state {
          trackingCustomerId: string = ""
          trackingStatus: string = ""
          trackingShipments: object = {}
          refreshCount: number = 0
        }
        computed isTrackingActive = neq(trackingCustomerId, "")

        action refreshDashboard(customerId: string) {
          when true {
            patch trackingCustomerId = customerId
            patch trackingStatus = "loading"
            patch refreshCount = add(refreshCount, 1)
            patch trackingShipments = { cust1: { id: customerId, refreshedAt: $system.timestamp } }
          }
        }
      }
      `
    );
    expect(lowered).not.toBeNull();
    if (!lowered) return;

    const schema = adaptSchema(lowered);
    const host = createHostWithContext(schema, {});
    registerIntoHandler(host, "system.get", (params) => {
      const key = String(params.key ?? "");
      if (key === "timestamp") return 1700000000000;
      return `value:${key}`;
    });

    const { world, genesis } = await createWorldWithGenesis(schema, host);
    const intent = await createIntentInstance({
      body: { type: "refreshDashboard", input: { customerId: "cust-1" } },
      schemaHash: schema.hash,
      projectionId: "test:projection",
      source: { kind: "ui", eventId: "event-3" },
      actor: ACTOR,
      intentId: "intent-3",
    });

    const resultWorld = await world.submitProposal(ACTOR.actorId, intent, genesis.worldId);
    expect(resultWorld.proposal.status).toBe("completed");
    expect(resultWorld.resultWorld).toBeDefined();

    const snapshot = await world.getSnapshot(resultWorld.resultWorld!.worldId);
    expect(snapshot?.data).toMatchObject({
      trackingCustomerId: "cust-1",
      trackingStatus: "loading",
      refreshCount: 1,
      trackingShipments: {
        cust1: {
          id: "cust-1",
        },
      },
    });
  });

  it("assembles the same compiled schema through the additive facade world surface", async () => {
    const result = compile(`
      domain CounterFacade {
        state { count: number = 0 }
        action increment() {
          when true { patch count = add(count, 1) }
        }
      }
    `);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const schema = adaptSchema(result.schema);
    const host = createHostWithContext(schema, { count: 0 });
    const facade = await createFacadeWorldWithGenesis(schema);

    expect(facade.genesis.kind).toBe("sealed");
    expect(facade.world.lineage).toBe(facade.lineage);
    expect(facade.world.governance).toBe(facade.governance);
    expect(facade.world.store).toBe(facade.store);

    const branch = facade.world.lineage.getActiveBranch();
    const proposal = facade.governance.createProposal({
      baseWorld: facade.genesis.worldId,
      branchId: branch.id,
      actorId: ACTOR.actorId,
      authorityId: "auth-1",
      intent: {
        type: "increment",
        intentId: "intent-facade-1",
      },
      executionKey: "exec-facade-1",
      submittedAt: 1,
      epoch: branch.epoch,
    });
    const evaluatingProposal = {
      ...proposal,
      status: "evaluating" as const,
    };
    const approved = facade.governance.prepareAuthorityResult(
      evaluatingProposal,
      { kind: "approved", approvedScope: null },
      {
        currentEpoch: branch.epoch,
        currentBranchHead: facade.genesis.worldId,
        decidedAt: 2,
      }
    );

    expect(approved.discarded).toBe(false);
    if (approved.discarded) return;

    const executingProposal = {
      ...approved.proposal,
      status: "executing",
      decisionId: approved.decisionRecord.decisionId,
    } as const;
    facade.store.putProposal(executingProposal);
    facade.store.putDecisionRecord(approved.decisionRecord);

    host.reset(createTerminalSnapshot({ count: 0 }, schema.hash));
    const hostResult = await host.dispatch(
      await createIntentInstance({
        body: { type: "increment" },
        schemaHash: schema.hash,
        projectionId: "test:projection",
        source: { kind: "ui", eventId: "event-facade-1" },
        actor: ACTOR,
        intentId: "intent-facade-1",
      }),
      { key: "exec-facade-1" }
    );

    const sealed = facade.world.coordinator.sealNext({
      executingProposal,
      completedAt: 3,
      sealInput: {
        schemaHash: schema.hash,
        baseWorldId: facade.genesis.worldId,
        branchId: branch.id,
        terminalSnapshot: hostResult.snapshot as Snapshot,
        createdAt: 2,
        proposalRef: approved.proposal.proposalId,
        decisionRef: approved.decisionRecord.decisionId,
      },
    });

    expect(sealed.kind).toBe("sealed");
    if (sealed.kind === "sealed") {
      expect(sealed.worldId).toBeDefined();
    }
  });
});
