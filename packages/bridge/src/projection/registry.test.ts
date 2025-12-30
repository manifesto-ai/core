/**
 * Projection Registry Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryProjectionRegistry,
  createProjectionRegistry,
} from "./registry.js";
import type { Projection, ProjectionRequest } from "../schema/projection.js";
import { noneResult, intentResult } from "../schema/projection.js";

describe("ProjectionRegistry", () => {
  let registry: InMemoryProjectionRegistry;

  const createMockRequest = (): ProjectionRequest => ({
    schemaHash: "schema-hash",
    snapshot: { data: {}, computed: {} },
    actor: { actorId: "user-1", kind: "human" },
    source: { kind: "ui", eventId: "event-1", payload: {} },
  });

  beforeEach(() => {
    registry = new InMemoryProjectionRegistry();
  });

  describe("register", () => {
    it("should register a projection", () => {
      const projection: Projection = {
        projectionId: "test-projection",
        project: () => noneResult(),
      };

      registry.register(projection);

      expect(registry.get("test-projection")).toBe(projection);
    });

    it("should throw when registering duplicate projection", () => {
      const projection: Projection = {
        projectionId: "test-projection",
        project: () => noneResult(),
      };

      registry.register(projection);

      expect(() => registry.register(projection)).toThrow("already registered");
    });

    it("should maintain registration order", () => {
      const p1: Projection = { projectionId: "p1", project: () => noneResult() };
      const p2: Projection = { projectionId: "p2", project: () => noneResult() };
      const p3: Projection = { projectionId: "p3", project: () => noneResult() };

      registry.register(p1);
      registry.register(p2);
      registry.register(p3);

      const list = registry.list();
      expect(list).toHaveLength(3);
      expect(list[0]).toBe(p1);
      expect(list[1]).toBe(p2);
      expect(list[2]).toBe(p3);
    });
  });

  describe("unregister", () => {
    it("should unregister a projection", () => {
      const projection: Projection = {
        projectionId: "test-projection",
        project: () => noneResult(),
      };

      registry.register(projection);
      const result = registry.unregister("test-projection");

      expect(result).toBe(true);
      expect(registry.get("test-projection")).toBeUndefined();
    });

    it("should return false for non-existent projection", () => {
      const result = registry.unregister("non-existent");
      expect(result).toBe(false);
    });

    it("should maintain order after unregistration", () => {
      const p1: Projection = { projectionId: "p1", project: () => noneResult() };
      const p2: Projection = { projectionId: "p2", project: () => noneResult() };
      const p3: Projection = { projectionId: "p3", project: () => noneResult() };

      registry.register(p1);
      registry.register(p2);
      registry.register(p3);
      registry.unregister("p2");

      const list = registry.list();
      expect(list).toHaveLength(2);
      expect(list[0]).toBe(p1);
      expect(list[1]).toBe(p3);
    });
  });

  describe("route", () => {
    it("should return first matching intent", () => {
      const p1: Projection = {
        projectionId: "p1",
        project: () => noneResult("no match"),
      };
      const p2: Projection = {
        projectionId: "p2",
        project: () => intentResult({ type: "test.action", input: {} }),
      };
      const p3: Projection = {
        projectionId: "p3",
        project: () => intentResult({ type: "another.action", input: {} }),
      };

      registry.register(p1);
      registry.register(p2);
      registry.register(p3);

      const result = registry.route(createMockRequest());

      expect(result.kind).toBe("intent");
      if (result.kind === "intent") {
        expect(result.body.type).toBe("test.action");
      }
    });

    it("should return none if no projection matches", () => {
      const p1: Projection = {
        projectionId: "p1",
        project: () => noneResult("no match"),
      };
      const p2: Projection = {
        projectionId: "p2",
        project: () => noneResult("also no match"),
      };

      registry.register(p1);
      registry.register(p2);

      const result = registry.route(createMockRequest());

      expect(result.kind).toBe("none");
    });

    it("should return none for empty registry", () => {
      const result = registry.route(createMockRequest());

      expect(result.kind).toBe("none");
      if (result.kind === "none") {
        expect(result.reason).toBe("No projection matched");
      }
    });
  });

  describe("routeAll", () => {
    it("should return all matching intents", () => {
      const p1: Projection = {
        projectionId: "p1",
        project: () => noneResult("no match"),
      };
      const p2: Projection = {
        projectionId: "p2",
        project: () => intentResult({ type: "test.action", input: {} }),
      };
      const p3: Projection = {
        projectionId: "p3",
        project: () => intentResult({ type: "another.action", input: {} }),
      };

      registry.register(p1);
      registry.register(p2);
      registry.register(p3);

      const results = registry.routeAll(createMockRequest());

      expect(results).toHaveLength(2);
      expect(results[0].kind).toBe("intent");
      expect(results[1].kind).toBe("intent");
    });

    it("should return empty array if no projection matches", () => {
      const p1: Projection = {
        projectionId: "p1",
        project: () => noneResult("no match"),
      };

      registry.register(p1);

      const results = registry.routeAll(createMockRequest());

      expect(results).toHaveLength(0);
    });
  });

  describe("list", () => {
    it("should return all registered projections", () => {
      const p1: Projection = { projectionId: "p1", project: () => noneResult() };
      const p2: Projection = { projectionId: "p2", project: () => noneResult() };

      registry.register(p1);
      registry.register(p2);

      const list = registry.list();

      expect(list).toHaveLength(2);
      expect(list).toContain(p1);
      expect(list).toContain(p2);
    });
  });

  describe("clear", () => {
    it("should remove all projections", () => {
      const p1: Projection = { projectionId: "p1", project: () => noneResult() };
      const p2: Projection = { projectionId: "p2", project: () => noneResult() };

      registry.register(p1);
      registry.register(p2);
      registry.clear();

      expect(registry.list()).toHaveLength(0);
      expect(registry.size).toBe(0);
    });
  });

  describe("size", () => {
    it("should return correct count", () => {
      expect(registry.size).toBe(0);

      registry.register({ projectionId: "p1", project: () => noneResult() });
      expect(registry.size).toBe(1);

      registry.register({ projectionId: "p2", project: () => noneResult() });
      expect(registry.size).toBe(2);

      registry.unregister("p1");
      expect(registry.size).toBe(1);
    });
  });

  describe("createProjectionRegistry factory", () => {
    it("should create a new registry", () => {
      const registry = createProjectionRegistry();

      expect(registry).toBeDefined();
      expect(registry.list()).toHaveLength(0);
    });
  });
});
