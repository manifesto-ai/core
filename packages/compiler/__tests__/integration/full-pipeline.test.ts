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
  type DomainSchema as CoreDomainSchema,
} from "@manifesto-ai/core";
import { createHost, type ManifestoHost } from "../../../host/src/index.js";
import {
  createManifestoWorld,
  createIntentInstance,
  type HostExecutor,
  type ActorRef,
  type AuthorityPolicy,
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
const POLICY: AuthorityPolicy = { mode: "auto_approve" };

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

function createHostExecutor(host: ManifestoHost): HostExecutor {
  return {
    async execute(_key, baseSnapshot, intent) {
      try {
        host.reset(baseSnapshot);
        const result = await host.dispatch(intent, { key: _key });
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
          outcome: result.status === "complete" ? "completed" : "failed",
          terminalSnapshot: result.snapshot,
          error,
        };
      } catch (error) {
        return {
          outcome: "failed",
          terminalSnapshot: baseSnapshot,
          error: {
            code: "HOST_EXECUTOR_THROW",
            message: error instanceof Error ? error.message : String(error),
            source: {
              actionId: "host.dispatch",
              nodePath: "execute",
            },
            timestamp: Date.now(),
          },
        };
      }
    },
  };
}

async function createWorldWithGenesis(schema: CoreDomainSchema, host: ManifestoHost) {
  const world = createManifestoWorld({ schemaHash: schema.hash, executor: createHostExecutor(host) });
  world.registerActor(ACTOR, POLICY);
  const snapshot = await host.getSnapshot();
  if (!snapshot) {
    throw new Error("Host snapshot missing");
  }
  const genesis = await world.createGenesis(snapshot);
  return { world, genesis };
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
          lastId: string | null = null
          payload: Json | null = null
          fetchIntent: string | null = null
        }
        computed payloadLoaded = isNotNull(payload)
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
      lastId: null,
      payload: null,
      fetchIntent: null,
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
          trackingCustomerId: string | null = null
          trackingStatus: string | null = null
          trackingShipments: object = {}
          refreshCount: number = 0
        }
        computed isTrackingActive = isNotNull(trackingCustomerId)

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
});
