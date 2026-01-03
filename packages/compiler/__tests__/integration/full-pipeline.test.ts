/**
 * Compiler -> World -> Host -> Core Integration
 * Small to complex end-to-end cases, including shipment.mel.
 */

import { describe, it, expect } from "vitest";
import { compile, type DomainSchema as MelDomainSchema } from "../../src/index.js";
import { createCore, type DomainSchema as CoreDomainSchema } from "@manifesto-ai/core";
import { createHost, type ManifestoHost } from "@manifesto-ai/host";
import {
  createManifestoWorld,
  createIntentInstance,
  type ActorRef,
  type AuthorityPolicy,
} from "@manifesto-ai/world";
import { readFile } from "node:fs/promises";

const HOST_CONTEXT = {
  now: () => 0,
  randomSeed: () => "seed",
  initialRandomSeed: "seed",
};

const ACTOR: ActorRef = { actorId: "actor-1", kind: "human" };
const POLICY: AuthorityPolicy = { mode: "auto_approve" };

function adaptSchema(schema: MelDomainSchema): CoreDomainSchema {
  return schema as unknown as CoreDomainSchema;
}

function createHostWithContext(schema: CoreDomainSchema, initialData: unknown): ManifestoHost {
  return createHost(schema, { initialData, context: HOST_CONTEXT });
}

async function createWorldWithGenesis(schema: CoreDomainSchema, host: ManifestoHost) {
  const world = createManifestoWorld({ schemaHash: schema.hash, host });
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
    return [{ op: "set", path: into, value: valueFactory(params) }];
  });
}

describe("Compiler -> World -> Host -> Core", () => {
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
    const result = compile(
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
    `,
      { lowerSystemValues: true }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const schema = adaptSchema(result.schema);
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

  it("executes shipment.mel refreshDashboard", async () => {
    const shipmentPath = new URL("../../../../apps/shipment-app/shipment.mel", import.meta.url);
    const source = await readFile(shipmentPath, "utf-8");
    const result = compile(source, { lowerSystemValues: true });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const schema = adaptSchema(result.schema);
    const host = createHostWithContext(schema, {});

    registerIntoHandler(host, "system.get", (params) => {
      const key = String(params.key ?? "");
      if (key === "timestamp") return 1700000000000;
      if (key === "uuid") return "uuid-1";
      return `value:${key}`;
    });
    registerIntoHandler(host, "api.shipment.listActive", () => ({
      S1: { id: "S1", laneId: "L1", destinationPort: "P1" },
    }));
    registerIntoHandler(host, "api.tracking.aggregateSignals", () => ({
      ais: { positionsByShipment: { S1: { lat: 1, lon: 2 } } },
      weather: { typhoonDelayIndexByLane: { L1: 0 } },
      tos: { portCongestionIndexByPort: { P1: 0 } },
    }));
    registerIntoHandler(host, "record.mapValues", () => ({
      S1: { position: { lat: 1, lon: 2 }, typhoonIndex: 0, portCongestion: 0 },
    }));
    registerIntoHandler(host, "record.keys", () => []);

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
      trackingShipments: { S1: { id: "S1", laneId: "L1", destinationPort: "P1" } },
    });
  });
});
