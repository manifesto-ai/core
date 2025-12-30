/**
 * Projection Recorder Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryProjectionRecorder,
  NoOpProjectionRecorder,
  createProjectionRecorder,
  createNoOpRecorder,
} from "./recorder.js";
import type { ActorRef } from "@manifesto-ai/world";
import type { SourceEvent } from "../schema/source-event.js";
import type { ProjectionResult } from "../schema/projection.js";

describe("InMemoryProjectionRecorder", () => {
  let recorder: InMemoryProjectionRecorder;

  const createActor = (id: string): ActorRef => ({
    actorId: id,
    kind: "human",
    name: `User ${id}`,
  });

  const createSource = (eventId: string): SourceEvent => ({
    kind: "ui",
    eventId,
    payload: { action: "click" },
  });

  const createIntentResult = (): ProjectionResult => ({
    kind: "intent",
    body: { type: "test.action", input: {} },
  });

  const createNoneResult = (): ProjectionResult => ({
    kind: "none",
    reason: "No match",
  });

  beforeEach(() => {
    recorder = new InMemoryProjectionRecorder();
  });

  describe("record", () => {
    it("should create a record with unique ID", () => {
      const record = recorder.record(
        "projection-1",
        createActor("user-1"),
        createSource("event-1"),
        createIntentResult()
      );

      expect(record.recordId).toBeDefined();
      expect(record.recordId).toMatch(/^record-/);
    });

    it("should store projection ID", () => {
      const record = recorder.record(
        "projection-1",
        createActor("user-1"),
        createSource("event-1"),
        createIntentResult()
      );

      expect(record.projectionId).toBe("projection-1");
    });

    it("should store actor", () => {
      const actor = createActor("user-1");
      const record = recorder.record(
        "projection-1",
        actor,
        createSource("event-1"),
        createIntentResult()
      );

      expect(record.actor).toEqual(actor);
    });

    it("should store source event", () => {
      const source = createSource("event-1");
      const record = recorder.record(
        "projection-1",
        createActor("user-1"),
        source,
        createIntentResult()
      );

      expect(record.source).toEqual(source);
    });

    it("should store result", () => {
      const result = createIntentResult();
      const record = recorder.record(
        "projection-1",
        createActor("user-1"),
        createSource("event-1"),
        result
      );

      expect(record.result).toEqual(result);
    });

    it("should store createdAt timestamp", () => {
      const before = Date.now();
      const record = recorder.record(
        "projection-1",
        createActor("user-1"),
        createSource("event-1"),
        createIntentResult()
      );
      const after = Date.now();

      expect(record.createdAt).toBeGreaterThanOrEqual(before);
      expect(record.createdAt).toBeLessThanOrEqual(after);
    });

    it("should store optional fields", () => {
      const record = recorder.record(
        "projection-1",
        createActor("user-1"),
        createSource("event-1"),
        createIntentResult(),
        {
          snapshotVersion: 5,
          intentId: "intent-123",
          intentKey: "key-456",
        }
      );

      expect(record.snapshotVersion).toBe(5);
      expect(record.intentId).toBe("intent-123");
      expect(record.intentKey).toBe("key-456");
    });

    it("should increment size", () => {
      expect(recorder.size).toBe(0);

      recorder.record("p1", createActor("u1"), createSource("e1"), createIntentResult());
      expect(recorder.size).toBe(1);

      recorder.record("p2", createActor("u2"), createSource("e2"), createNoneResult());
      expect(recorder.size).toBe(2);
    });
  });

  describe("getRecords", () => {
    it("should return all records", () => {
      recorder.record("p1", createActor("u1"), createSource("e1"), createIntentResult());
      recorder.record("p2", createActor("u2"), createSource("e2"), createNoneResult());

      const records = recorder.getRecords();

      expect(records).toHaveLength(2);
    });

    it("should return a copy (not the internal array)", () => {
      recorder.record("p1", createActor("u1"), createSource("e1"), createIntentResult());

      const records1 = recorder.getRecords();
      const records2 = recorder.getRecords();

      expect(records1).not.toBe(records2);
      expect(records1).toEqual(records2);
    });
  });

  describe("getByProjectionId", () => {
    it("should return records for specific projection", () => {
      recorder.record("p1", createActor("u1"), createSource("e1"), createIntentResult());
      recorder.record("p1", createActor("u2"), createSource("e2"), createIntentResult());
      recorder.record("p2", createActor("u1"), createSource("e3"), createNoneResult());

      const records = recorder.getByProjectionId("p1");

      expect(records).toHaveLength(2);
      expect(records.every((r) => r.projectionId === "p1")).toBe(true);
    });

    it("should return empty array for unknown projection", () => {
      recorder.record("p1", createActor("u1"), createSource("e1"), createIntentResult());

      const records = recorder.getByProjectionId("unknown");

      expect(records).toHaveLength(0);
    });
  });

  describe("getByActorId", () => {
    it("should return records for specific actor", () => {
      recorder.record("p1", createActor("u1"), createSource("e1"), createIntentResult());
      recorder.record("p2", createActor("u1"), createSource("e2"), createIntentResult());
      recorder.record("p1", createActor("u2"), createSource("e3"), createNoneResult());

      const records = recorder.getByActorId("u1");

      expect(records).toHaveLength(2);
      expect(records.every((r) => r.actor.actorId === "u1")).toBe(true);
    });

    it("should return empty array for unknown actor", () => {
      recorder.record("p1", createActor("u1"), createSource("e1"), createIntentResult());

      const records = recorder.getByActorId("unknown");

      expect(records).toHaveLength(0);
    });
  });

  describe("getByIntentId", () => {
    it("should return records for specific intent", () => {
      recorder.record("p1", createActor("u1"), createSource("e1"), createIntentResult(), {
        intentId: "intent-1",
      });
      recorder.record("p2", createActor("u2"), createSource("e2"), createIntentResult(), {
        intentId: "intent-1",
      });
      recorder.record("p1", createActor("u1"), createSource("e3"), createIntentResult(), {
        intentId: "intent-2",
      });

      const records = recorder.getByIntentId("intent-1");

      expect(records).toHaveLength(2);
      expect(records.every((r) => r.intentId === "intent-1")).toBe(true);
    });

    it("should return empty array for unknown intent", () => {
      recorder.record("p1", createActor("u1"), createSource("e1"), createIntentResult(), {
        intentId: "intent-1",
      });

      const records = recorder.getByIntentId("unknown");

      expect(records).toHaveLength(0);
    });
  });

  describe("getByTimeRange", () => {
    it("should return records within time range", async () => {
      const before = Date.now();
      recorder.record("p1", createActor("u1"), createSource("e1"), createIntentResult());

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
      const middle = Date.now();

      await new Promise((r) => setTimeout(r, 10));
      recorder.record("p2", createActor("u2"), createSource("e2"), createIntentResult());
      const after = Date.now();

      const allRecords = recorder.getByTimeRange(before, after + 1);
      expect(allRecords).toHaveLength(2);

      const firstOnly = recorder.getByTimeRange(before, middle);
      expect(firstOnly).toHaveLength(1);
      expect(firstOnly[0].projectionId).toBe("p1");
    });

    it("should return empty array for range with no records", () => {
      recorder.record("p1", createActor("u1"), createSource("e1"), createIntentResult());

      const records = recorder.getByTimeRange(0, 1);

      expect(records).toHaveLength(0);
    });
  });

  describe("clear", () => {
    it("should remove all records", () => {
      recorder.record("p1", createActor("u1"), createSource("e1"), createIntentResult());
      recorder.record("p2", createActor("u2"), createSource("e2"), createNoneResult());

      recorder.clear();

      expect(recorder.size).toBe(0);
      expect(recorder.getRecords()).toHaveLength(0);
    });

    it("should clear all indexes", () => {
      recorder.record("p1", createActor("u1"), createSource("e1"), createIntentResult(), {
        intentId: "intent-1",
      });

      recorder.clear();

      expect(recorder.getByProjectionId("p1")).toHaveLength(0);
      expect(recorder.getByActorId("u1")).toHaveLength(0);
      expect(recorder.getByIntentId("intent-1")).toHaveLength(0);
    });
  });
});

describe("NoOpProjectionRecorder", () => {
  let recorder: NoOpProjectionRecorder;

  const createActor = (id: string): ActorRef => ({
    actorId: id,
    kind: "human",
  });

  const createSource = (eventId: string): SourceEvent => ({
    kind: "ui",
    eventId,
    payload: {},
  });

  const createResult = (): ProjectionResult => ({
    kind: "intent",
    body: { type: "test", input: {} },
  });

  beforeEach(() => {
    recorder = new NoOpProjectionRecorder();
  });

  it("should return a record but not store it", () => {
    const record = recorder.record("p1", createActor("u1"), createSource("e1"), createResult());

    expect(record).toBeDefined();
    expect(record.projectionId).toBe("p1");
    expect(recorder.getRecords()).toHaveLength(0);
  });

  it("should always return empty arrays", () => {
    recorder.record("p1", createActor("u1"), createSource("e1"), createResult());

    expect(recorder.getRecords()).toHaveLength(0);
    expect(recorder.getByProjectionId("p1")).toHaveLength(0);
    expect(recorder.getByActorId("u1")).toHaveLength(0);
    expect(recorder.getByIntentId("intent-1")).toHaveLength(0);
    expect(recorder.getByTimeRange(0, Date.now())).toHaveLength(0);
  });

  it("should not throw on clear", () => {
    expect(() => recorder.clear()).not.toThrow();
  });
});

describe("Factory functions", () => {
  it("createProjectionRecorder should create InMemoryProjectionRecorder", () => {
    const recorder = createProjectionRecorder();

    expect(recorder).toBeInstanceOf(InMemoryProjectionRecorder);
  });

  it("createNoOpRecorder should create NoOpProjectionRecorder", () => {
    const recorder = createNoOpRecorder();

    expect(recorder).toBeInstanceOf(NoOpProjectionRecorder);
  });
});
