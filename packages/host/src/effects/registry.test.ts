import { describe, it, expect, beforeEach } from "vitest";
import { EffectHandlerRegistry, createEffectRegistry } from "./registry.js";
import type { EffectHandler, EffectHandlerOptions } from "./types.js";
import { isHostError } from "../errors.js";

describe("EffectHandlerRegistry", () => {
  let registry: EffectHandlerRegistry;

  const mockHandler: EffectHandler = async () => [];

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
  });

  describe("register", () => {
    it("should register a handler", () => {
      registry.register("http", mockHandler);
      expect(registry.has("http")).toBe(true);
    });

    it("should register with custom options", () => {
      const options: EffectHandlerOptions = {
        timeout: 5000,
        retries: 3,
        retryDelay: 500,
      };
      registry.register("http", mockHandler, options);

      const registered = registry.get("http");
      expect(registered?.options.timeout).toBe(5000);
      expect(registered?.options.retries).toBe(3);
      expect(registered?.options.retryDelay).toBe(500);
    });

    it("should apply default options when not specified", () => {
      registry.register("http", mockHandler);

      const registered = registry.get("http");
      expect(registered?.options.timeout).toBe(30000);
      expect(registered?.options.retries).toBe(0);
      expect(registered?.options.retryDelay).toBe(1000);
    });

    it("should merge partial options with defaults", () => {
      registry.register("http", mockHandler, { timeout: 5000 });

      const registered = registry.get("http");
      expect(registered?.options.timeout).toBe(5000);
      expect(registered?.options.retries).toBe(0);
      expect(registered?.options.retryDelay).toBe(1000);
    });

    it("should throw when registering duplicate type", () => {
      registry.register("http", mockHandler);

      expect(() => registry.register("http", mockHandler)).toThrow();
    });

    it("should throw HostError for duplicate registration", () => {
      registry.register("http", mockHandler);

      try {
        registry.register("http", mockHandler);
      } catch (error) {
        expect(isHostError(error)).toBe(true);
        if (isHostError(error)) {
          expect(error.code).toBe("INVALID_STATE");
          expect(error.details?.type).toBe("http");
        }
      }
    });

    it("should allow different handler types", () => {
      const httpHandler: EffectHandler = async () => [];
      const storageHandler: EffectHandler = async () => [];

      registry.register("http", httpHandler);
      registry.register("storage", storageHandler);

      expect(registry.has("http")).toBe(true);
      expect(registry.has("storage")).toBe(true);
      expect(registry.size).toBe(2);
    });
  });

  describe("unregister", () => {
    it("should remove a registered handler", () => {
      registry.register("http", mockHandler);
      expect(registry.unregister("http")).toBe(true);
      expect(registry.has("http")).toBe(false);
    });

    it("should return false for non-existent handler", () => {
      expect(registry.unregister("unknown")).toBe(false);
    });

    it("should decrement size after unregister", () => {
      registry.register("http", mockHandler);
      registry.register("storage", mockHandler);
      expect(registry.size).toBe(2);

      registry.unregister("http");
      expect(registry.size).toBe(1);
    });
  });

  describe("get", () => {
    it("should return registered handler", () => {
      registry.register("http", mockHandler);

      const registered = registry.get("http");
      expect(registered).toBeDefined();
      expect(registered?.handler).toBe(mockHandler);
    });

    it("should return undefined for non-existent type", () => {
      expect(registry.get("unknown")).toBeUndefined();
    });
  });

  describe("has", () => {
    it("should return true for registered type", () => {
      registry.register("http", mockHandler);
      expect(registry.has("http")).toBe(true);
    });

    it("should return false for non-existent type", () => {
      expect(registry.has("unknown")).toBe(false);
    });
  });

  describe("getTypes", () => {
    it("should return empty array when no handlers registered", () => {
      expect(registry.getTypes()).toEqual([]);
    });

    it("should return all registered types", () => {
      registry.register("http", mockHandler);
      registry.register("storage", mockHandler);
      registry.register("email", mockHandler);

      const types = registry.getTypes();
      expect(types).toHaveLength(3);
      expect(types).toContain("http");
      expect(types).toContain("storage");
      expect(types).toContain("email");
    });
  });

  describe("clear", () => {
    it("should remove all handlers", () => {
      registry.register("http", mockHandler);
      registry.register("storage", mockHandler);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.has("http")).toBe(false);
      expect(registry.has("storage")).toBe(false);
    });
  });

  describe("size", () => {
    it("should return 0 for empty registry", () => {
      expect(registry.size).toBe(0);
    });

    it("should return correct count", () => {
      registry.register("a", mockHandler);
      registry.register("b", mockHandler);
      registry.register("c", mockHandler);

      expect(registry.size).toBe(3);
    });
  });
});

describe("createEffectRegistry", () => {
  it("should create a new registry instance", () => {
    const registry = createEffectRegistry();
    expect(registry).toBeInstanceOf(EffectHandlerRegistry);
    expect(registry.size).toBe(0);
  });

  it("should create independent instances", () => {
    const registry1 = createEffectRegistry();
    const registry2 = createEffectRegistry();

    registry1.register("http", async () => []);

    expect(registry1.has("http")).toBe(true);
    expect(registry2.has("http")).toBe(false);
  });
});
