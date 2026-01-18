/**
 * Bridge Tests
 */

import { describe, it, expect } from "vitest";
import {
  createTranslatorBridge,
  createTranslateSourceEvent,
  createResolveSourceEvent,
  createCLISourceEvent,
  createAgentSourceEvent,
  isTranslatePayload,
  isResolvePayload,
} from "../bridge/index.js";
import type { DomainSchema, AmbiguityResolution, ActorRef } from "../domain/index.js";
import { createConfig } from "../domain/config.js";

describe("TranslatorBridge", () => {
  const testSchema: DomainSchema = {
    id: "test-world",
    version: "1.0.0",
    hash: "test-hash",
    state: {},
    computed: {},
    actions: {},
    types: {},
  };

  const testActor: ActorRef = {
    actorId: "test-user",
    kind: "human",
    name: "Test User",
  };

  it("should create translator bridge", () => {
    const bridge = createTranslatorBridge({
      worldId: "test-world",
      schemaHash: "test-hash",
      schema: testSchema,
      actor: testActor,
    });

    expect(bridge).toBeDefined();
    expect(bridge.translate).toBeDefined();
    expect(bridge.resolve).toBeDefined();
  });

  it("should translate natural language input", async () => {
    const bridge = createTranslatorBridge({
      worldId: "test-world",
      schemaHash: "test-hash",
      schema: testSchema,
      actor: testActor,
      translatorConfig: createConfig({
        retrievalTier: 0,
        slmModel: "gpt-4o-mini",
        escalationThreshold: 0.5,
        fastPathEnabled: true,
        fastPathOnly: true,
      }),
    });

    const result = await bridge.translate("add email field");

    expect(result).toBeDefined();
    expect(result.kind).toBeDefined();
    expect(result.trace).toBeDefined();
  });
});

describe("Source Events", () => {
  it("should create translate source event", () => {
    const event = createTranslateSourceEvent("Add email field to user");

    expect(event).toBeDefined();
    expect(event.kind).toBe("agent"); // Uses createBridgeAgentSourceEvent
    expect(event.eventId).toBeDefined();
    // Note: occurredAt is optional and may not be present
    const payload = event.payload as { type: string; input: string };
    expect(payload.type).toBe("translator:translate");
    expect(payload.input).toBe("Add email field to user");
  });

  it("should create resolve source event", () => {
    const resolution: AmbiguityResolution = {
      reportId: "report-123",
      choice: { kind: "option", optionId: "option-1" },
      resolvedBy: { kind: "human", actorId: "user-1" },
      resolvedAt: new Date().toISOString(),
    };
    const event = createResolveSourceEvent("report-123", resolution);

    expect(event).toBeDefined();
    expect(event.kind).toBe("agent");
    const payload = event.payload as { type: string; reportId: string; resolution: unknown };
    expect(payload.type).toBe("translator:resolve");
    expect(payload.reportId).toBe("report-123");
    expect(payload.resolution).toBeDefined();
  });

  it("should create CLI source event", () => {
    const event = createCLISourceEvent("translate", { verbose: true });

    expect(event).toBeDefined();
    expect(event.kind).toBe("agent");
    const payload = event.payload as { type: string; command: string; args: unknown };
    expect(payload.type).toBe("translator:cli");
    expect(payload.command).toBe("translate");
    expect(payload.args).toEqual({ verbose: true });
  });

  it("should create agent source event", () => {
    const event = createAgentSourceEvent(
      "agent-123",
      "translate",
      { input: "Add email field" }
    );

    expect(event).toBeDefined();
    expect(event.kind).toBe("agent");
    const payload = event.payload as { type: string; agentId: string; action: string };
    expect(payload.type).toBe("translator:agent");
    expect(payload.agentId).toBe("agent-123");
    expect(payload.action).toBe("translate");
  });
});

describe("Payload Type Guards", () => {
  it("should identify translate payload", () => {
    const translatePayload = { type: "translator:translate", input: "test" };
    const resolvePayload = { type: "translator:resolve", reportId: "123", resolution: {} };

    expect(isTranslatePayload(translatePayload)).toBe(true);
    expect(isTranslatePayload(resolvePayload)).toBe(false);
  });

  it("should identify resolve payload", () => {
    const translatePayload = { type: "translator:translate", input: "test" };
    const resolvePayload = { type: "translator:resolve", reportId: "123", resolution: {} };

    expect(isResolvePayload(resolvePayload)).toBe(true);
    expect(isResolvePayload(translatePayload)).toBe(false);
  });

  it("should handle unknown payloads", () => {
    const unknownPayload = { type: "unknown" };

    expect(isTranslatePayload(unknownPayload)).toBe(false);
    expect(isResolvePayload(unknownPayload)).toBe(false);
  });
});
