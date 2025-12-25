import { describe, it, expect } from "vitest";
import {
  createMockRegistry,
  addMockHandler,
  removeMockHandlers,
  clearMockRegistry,
  applyMock,
  applyMockAsync,
  mockApiCall,
  mockNavigate,
  mockCustom,
  mockApiCallFailure,
  mockEndpoint,
  createMockRegistryWithPresets,
} from "./effect-mocker";

// ============================================================================
// Mock Registry Tests
// ============================================================================

describe("createMockRegistry", () => {
  it("should create an empty registry", () => {
    const registry = createMockRegistry();
    expect(registry.handlers).toEqual([]);
  });
});

describe("addMockHandler", () => {
  it("should add a handler to the registry", () => {
    const registry = createMockRegistry();
    const handler = mockApiCall({ data: "test" });

    const updated = addMockHandler(registry, handler);

    expect(updated.handlers.length).toBe(1);
    expect(updated.handlers[0]).toBe(handler);
  });

  it("should not mutate the original registry", () => {
    const registry = createMockRegistry();
    const handler = mockApiCall({ data: "test" });

    addMockHandler(registry, handler);

    expect(registry.handlers.length).toBe(0);
  });
});

describe("removeMockHandlers", () => {
  it("should remove handlers matching predicate", () => {
    let registry = createMockRegistry();
    registry = addMockHandler(registry, mockApiCall({ id: 1 }));
    registry = addMockHandler(registry, mockNavigate());
    registry = addMockHandler(registry, mockApiCall({ id: 2 }));

    const updated = removeMockHandlers(
      registry,
      (h) => h.effectType === "apiCall"
    );

    expect(updated.handlers.length).toBe(1);
    expect(updated.handlers[0].effectType).toBe("navigate");
  });
});

describe("clearMockRegistry", () => {
  it("should remove all handlers", () => {
    let registry = createMockRegistry();
    registry = addMockHandler(registry, mockApiCall({}));
    registry = addMockHandler(registry, mockNavigate());

    const cleared = clearMockRegistry(registry);

    expect(cleared.handlers.length).toBe(0);
  });
});

// ============================================================================
// applyMock Tests
// ============================================================================

describe("applyMock", () => {
  it("should return matched: false when no handler matches", () => {
    const registry = createMockRegistry();

    const result = applyMock("apiCall", {}, registry);

    expect(result.matched).toBe(false);
    expect(result.failed).toBe(false);
  });

  it("should return response when handler matches", () => {
    const registry = addMockHandler(
      createMockRegistry(),
      mockApiCall({ success: true, data: [1, 2, 3] })
    );

    const result = applyMock("apiCall", {}, registry);

    expect(result.matched).toBe(true);
    expect(result.failed).toBe(false);
    expect(result.response).toEqual({ success: true, data: [1, 2, 3] });
  });

  it("should skip handler when match function returns false", () => {
    const registry = addMockHandler(
      createMockRegistry(),
      mockApiCall({ data: "matched" }, {
        match: (config) => (config as { endpoint?: string }).endpoint === "/api/users",
      })
    );

    const result = applyMock("apiCall", { endpoint: "/api/posts" }, registry);

    expect(result.matched).toBe(false);
  });

  it("should match handler when match function returns true", () => {
    const registry = addMockHandler(
      createMockRegistry(),
      mockApiCall({ data: "users" }, {
        match: (config) => (config as { endpoint?: string }).endpoint === "/api/users",
      })
    );

    const result = applyMock("apiCall", { endpoint: "/api/users" }, registry);

    expect(result.matched).toBe(true);
    expect(result.response).toEqual({ data: "users" });
  });

  it("should call response function if provided", () => {
    const registry = addMockHandler(
      createMockRegistry(),
      mockApiCall((config: unknown) => ({
        echo: (config as { message?: string }).message,
      }))
    );

    const result = applyMock("apiCall", { message: "hello" }, registry);

    expect(result.response).toEqual({ echo: "hello" });
  });

  it("should return failure when shouldFail is true", () => {
    const registry = addMockHandler(
      createMockRegistry(),
      mockApiCallFailure("Network error")
    );

    const result = applyMock("apiCall", {}, registry);

    expect(result.matched).toBe(true);
    expect(result.failed).toBe(true);
    expect(result.error).toBe("Network error");
  });

  it("should match correct effect type", () => {
    let registry = createMockRegistry();
    registry = addMockHandler(registry, mockApiCall({ type: "api" }));
    registry = addMockHandler(registry, mockNavigate({ type: "nav" }));

    const apiResult = applyMock("apiCall", {}, registry);
    const navResult = applyMock("navigate", {}, registry);

    expect(apiResult.response).toEqual({ type: "api" });
    expect(navResult.response).toEqual({ type: "nav" });
  });
});

// ============================================================================
// applyMockAsync Tests
// ============================================================================

describe("applyMockAsync", () => {
  it("should resolve with response", async () => {
    const registry = addMockHandler(
      createMockRegistry(),
      mockApiCall({ async: true })
    );

    const result = await applyMockAsync("apiCall", {}, registry);

    expect(result.matched).toBe(true);
    expect(result.response).toEqual({ async: true });
  });

  it("should respect delay option", async () => {
    const registry = addMockHandler(
      createMockRegistry(),
      mockApiCall({ delayed: true }, { delay: 50 })
    );

    const start = Date.now();
    await applyMockAsync("apiCall", {}, registry);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some margin
  });

  it("should handle failure after delay", async () => {
    const registry = addMockHandler(
      createMockRegistry(),
      mockApiCallFailure("Timeout", { delay: 10 })
    );

    const result = await applyMockAsync("apiCall", {}, registry);

    expect(result.failed).toBe(true);
    expect(result.error).toBe("Timeout");
  });
});

// ============================================================================
// Convenience Builder Tests
// ============================================================================

describe("mockApiCall", () => {
  it("should create apiCall handler with response", () => {
    const handler = mockApiCall({ users: [] });

    expect(handler.effectType).toBe("apiCall");
    expect(handler.response).toEqual({ users: [] });
  });

  it("should accept options", () => {
    const matchFn = () => true;
    const handler = mockApiCall({ data: true }, {
      match: matchFn,
      delay: 100,
    });

    expect(handler.match).toBe(matchFn);
    expect(handler.delay).toBe(100);
  });
});

describe("mockNavigate", () => {
  it("should create navigate handler", () => {
    const handler = mockNavigate();

    expect(handler.effectType).toBe("navigate");
    expect(handler.response).toEqual({ navigated: true });
  });

  it("should accept custom response", () => {
    const handler = mockNavigate({ path: "/home" });

    expect(handler.response).toEqual({ path: "/home" });
  });
});

describe("mockCustom", () => {
  it("should create custom handler", () => {
    const handler = mockCustom({ custom: true });

    expect(handler.effectType).toBe("custom");
    expect(handler.response).toEqual({ custom: true });
  });
});

describe("mockApiCallFailure", () => {
  it("should create failing handler", () => {
    const handler = mockApiCallFailure("Server error");

    expect(handler.shouldFail).toBe(true);
    expect(handler.errorMessage).toBe("Server error");
  });
});

describe("mockEndpoint", () => {
  it("should match specific endpoint", () => {
    const handler = mockEndpoint("/api/users", { users: [1, 2] });
    const registry = addMockHandler(createMockRegistry(), handler);

    const match = applyMock("apiCall", { endpoint: "/api/users" }, registry);
    const noMatch = applyMock("apiCall", { endpoint: "/api/posts" }, registry);

    expect(match.matched).toBe(true);
    expect(match.response).toEqual({ users: [1, 2] });
    expect(noMatch.matched).toBe(false);
  });

  it("should match method when specified", () => {
    const handler = mockEndpoint("/api/users", { created: true }, {
      method: "POST",
    });
    const registry = addMockHandler(createMockRegistry(), handler);

    const postMatch = applyMock(
      "apiCall",
      { endpoint: "/api/users", method: "POST" },
      registry
    );
    const getNoMatch = applyMock(
      "apiCall",
      { endpoint: "/api/users", method: "GET" },
      registry
    );

    expect(postMatch.matched).toBe(true);
    expect(getNoMatch.matched).toBe(false);
  });
});

// ============================================================================
// Preset Tests
// ============================================================================

describe("createMockRegistryWithPresets", () => {
  it("should include default API and navigate mocks", () => {
    const registry = createMockRegistryWithPresets();

    expect(registry.handlers.length).toBe(2);

    const apiResult = applyMock("apiCall", {}, registry);
    const navResult = applyMock("navigate", {}, registry);

    expect(apiResult.response).toEqual({ success: true });
    expect(navResult.response).toEqual({ navigated: true });
  });
});
