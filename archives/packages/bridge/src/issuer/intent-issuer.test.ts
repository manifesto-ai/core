/**
 * Intent Issuer Tests
 */
import { describe, it, expect } from "vitest";
import {
  DefaultIntentIssuer,
  createIntentIssuer,
  toSourceRef,
} from "./intent-issuer.js";
import { sha256 } from "@manifesto-ai/core";
import type { ActorRef, IntentBody } from "@manifesto-ai/world";
import type { SourceEvent } from "../schema/source-event.js";
import type { ProjectionResultIntent } from "../schema/projection.js";

describe("DefaultIntentIssuer", () => {
  const issuer = new DefaultIntentIssuer();

  const createActor = (): ActorRef => ({
    actorId: "user-1",
    kind: "human",
    name: "Test User",
  });

  const createSource = (): SourceEvent => ({
    kind: "ui",
    eventId: "event-123",
    payload: { action: "submit" },
    occurredAt: Date.now(),
  });

  const createBody = (): IntentBody => ({
    type: "todo.create",
    input: { title: "Buy milk" },
  });

  describe("issue", () => {
    it("should create an IntentInstance with body", async () => {
      const body = createBody();
      const instance = await issuer.issue({
        projectionId: "ui:todo-form",
        schemaHash: "schema-hash-123",
        actor: createActor(),
        source: createSource(),
        body,
      });

      expect(instance.body).toEqual(body);
    });

    it("should generate unique intentId", async () => {
      const instance1 = await issuer.issue({
        projectionId: "proj-1",
        schemaHash: "schema-hash",
        actor: createActor(),
        source: createSource(),
        body: createBody(),
      });

      const instance2 = await issuer.issue({
        projectionId: "proj-1",
        schemaHash: "schema-hash",
        actor: createActor(),
        source: createSource(),
        body: createBody(),
      });

      expect(instance1.intentId).not.toBe(instance2.intentId);
    });

    it("should compute intentKey from body and schemaHash", async () => {
      const body = createBody();
      const instance = await issuer.issue({
        projectionId: "proj-1",
        schemaHash: "schema-hash-123",
        actor: createActor(),
        source: createSource(),
        body,
      });

      expect(instance.intentKey).toBeDefined();
      expect(typeof instance.intentKey).toBe("string");
      expect(instance.intentKey.length).toBeGreaterThan(0);
    });

    it("should compute intentKey using JCS canonicalization", async () => {
      const schemaHash = "schema-hash";
      const body: IntentBody = {
        type: "todo.create",
        input: { b: 2, a: 1, c: undefined },
        scopeProposal: {
          note: "create",
          allowedPaths: ["data.todos.*"],
        },
      };

      const instance = await issuer.issue({
        projectionId: "proj-1",
        schemaHash,
        actor: createActor(),
        source: createSource(),
        body,
      });

      const inputJcs = "{\"a\":1,\"b\":2}";
      const scopeJcs = "{\"allowedPaths\":[\"data.todos.*\"],\"note\":\"create\"}";
      const expected = await sha256(`${schemaHash}:${body.type}:${inputJcs}:${scopeJcs}`);

      expect(instance.intentKey).toBe(expected);
    });

    it("should produce same intentKey for same body and schemaHash", async () => {
      const body = createBody();
      const schemaHash = "same-schema-hash";

      const instance1 = await issuer.issue({
        projectionId: "proj-1",
        schemaHash,
        actor: createActor(),
        source: createSource(),
        body,
      });

      const instance2 = await issuer.issue({
        projectionId: "proj-2", // Different projection
        schemaHash,
        actor: { actorId: "user-2", kind: "agent" }, // Different actor
        source: { kind: "api", eventId: "different-event", payload: {} }, // Different source
        body, // Same body
      });

      expect(instance1.intentKey).toBe(instance2.intentKey);
    });

    it("should produce different intentKey for different body", async () => {
      const schemaHash = "schema-hash";

      const instance1 = await issuer.issue({
        projectionId: "proj-1",
        schemaHash,
        actor: createActor(),
        source: createSource(),
        body: { type: "action.a", input: {} },
      });

      const instance2 = await issuer.issue({
        projectionId: "proj-1",
        schemaHash,
        actor: createActor(),
        source: createSource(),
        body: { type: "action.b", input: {} },
      });

      expect(instance1.intentKey).not.toBe(instance2.intentKey);
    });

    it("should produce different intentKey for different schemaHash", async () => {
      const body = createBody();

      const instance1 = await issuer.issue({
        projectionId: "proj-1",
        schemaHash: "schema-v1",
        actor: createActor(),
        source: createSource(),
        body,
      });

      const instance2 = await issuer.issue({
        projectionId: "proj-1",
        schemaHash: "schema-v2",
        actor: createActor(),
        source: createSource(),
        body,
      });

      expect(instance1.intentKey).not.toBe(instance2.intentKey);
    });

    it("should include origin in meta", async () => {
      const actor = createActor();
      const source = createSource();

      const instance = await issuer.issue({
        projectionId: "ui:todo-form",
        schemaHash: "schema-hash",
        actor,
        source,
        body: createBody(),
      });

      expect(instance.meta.origin.projectionId).toBe("ui:todo-form");
      expect(instance.meta.origin.actor).toEqual(actor);
      expect(instance.meta.origin.source).toEqual({
        kind: source.kind,
        eventId: source.eventId,
      });
    });

    it("should include note in origin if provided", async () => {
      const instance = await issuer.issue({
        projectionId: "proj-1",
        schemaHash: "schema-hash",
        actor: createActor(),
        source: createSource(),
        body: createBody(),
        note: "User clicked submit button",
      });

      expect(instance.meta.origin.note).toBe("User clicked submit button");
    });

    it("should handle body with scopeProposal", async () => {
      const body: IntentBody = {
        type: "data.update",
        input: { path: "user.name", value: "Alice" },
        scopeProposal: {
          allowedPaths: ["data.user.*"],
          note: "User profile update",
        },
      };

      const instance = await issuer.issue({
        projectionId: "proj-1",
        schemaHash: "schema-hash",
        actor: createActor(),
        source: createSource(),
        body,
      });

      expect(instance.body.scopeProposal).toEqual(body.scopeProposal);
    });
  });

  describe("issueFromResult", () => {
    it("should extract body from ProjectionResultIntent", async () => {
      const result: ProjectionResultIntent = {
        kind: "intent",
        body: { type: "test.action", input: { value: 42 } },
      };

      const instance = await issuer.issueFromResult(
        result,
        "proj-1",
        "schema-hash",
        createActor(),
        createSource()
      );

      expect(instance.body).toEqual(result.body);
    });

    it("should pass through all parameters", async () => {
      const result: ProjectionResultIntent = {
        kind: "intent",
        body: createBody(),
      };
      const actor = createActor();
      const source = createSource();

      const instance = await issuer.issueFromResult(
        result,
        "test-projection",
        "test-schema-hash",
        actor,
        source,
        "Test note"
      );

      expect(instance.meta.origin.projectionId).toBe("test-projection");
      expect(instance.meta.origin.actor).toEqual(actor);
      expect(instance.meta.origin.note).toBe("Test note");
    });
  });
});

describe("toSourceRef", () => {
  it("should extract kind and eventId from SourceEvent", () => {
    const source: SourceEvent = {
      kind: "ui",
      eventId: "event-123",
      payload: { action: "click", target: "button" },
      occurredAt: Date.now(),
    };

    const ref = toSourceRef(source);

    expect(ref).toEqual({
      kind: "ui",
      eventId: "event-123",
    });
  });

  it("should not include payload or occurredAt", () => {
    const source: SourceEvent = {
      kind: "api",
      eventId: "api-call-456",
      payload: { method: "POST", path: "/users" },
      occurredAt: 1234567890,
    };

    const ref = toSourceRef(source);

    expect((ref as any).payload).toBeUndefined();
    expect((ref as any).occurredAt).toBeUndefined();
  });

  it("should handle all source kinds", () => {
    const kinds: Array<"ui" | "api" | "agent" | "system"> = ["ui", "api", "agent", "system"];

    for (const kind of kinds) {
      const ref = toSourceRef({ kind, eventId: "test", payload: {} });
      expect(ref.kind).toBe(kind);
    }
  });
});

describe("createIntentIssuer factory", () => {
  it("should create a DefaultIntentIssuer", () => {
    const issuer = createIntentIssuer();

    expect(issuer).toBeInstanceOf(DefaultIntentIssuer);
  });

  it("should create working issuer", async () => {
    const issuer = createIntentIssuer();

    const instance = await issuer.issue({
      projectionId: "test",
      schemaHash: "hash",
      actor: { actorId: "u1", kind: "human" },
      source: { kind: "ui", eventId: "e1", payload: {} },
      body: { type: "test.action", input: {} },
    });

    expect(instance).toBeDefined();
    expect(instance.intentId).toBeDefined();
    expect(instance.intentKey).toBeDefined();
  });
});
