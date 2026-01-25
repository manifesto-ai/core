/**
 * Hooks Tests
 *
 * Tests for useBridge, useSnapshot, useValue, useDispatch, useDispatchEvent.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, renderHook } from "@testing-library/react";
import { type ReactNode } from "react";
import type { Bridge, SnapshotView, Unsubscribe, ProjectionResult } from "@manifesto-ai/bridge";
import { BridgeProvider } from "../context/BridgeProvider.js";
import { useBridge } from "../hooks/useBridge.js";
import { useSnapshot } from "../hooks/useSnapshot.js";
import { useValue } from "../hooks/useValue.js";
import { useDispatch } from "../hooks/useDispatch.js";
import { useDispatchEvent } from "../hooks/useDispatchEvent.js";

// ============================================================================
// Mock Bridge
// ============================================================================

interface MockBridgeOptions {
  initialSnapshot?: SnapshotView | null;
}

const createMockBridge = (options: MockBridgeOptions = {}): Bridge & {
  _triggerUpdate: (snapshot: SnapshotView) => void;
  _setSnapshot: (snapshot: SnapshotView | null) => void;
  dispatch: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
} => {
  let currentSnapshot: SnapshotView | null = options.initialSnapshot ?? null;
  const subscribers = new Set<(snapshot: SnapshotView) => void>();

  const dispatch = vi.fn(async () => {});
  const dispatchEvent = vi.fn(async (): Promise<ProjectionResult> => ({ kind: "none" }));

  return {
    getSnapshot: () => currentSnapshot,
    subscribe: (callback: (snapshot: SnapshotView) => void): Unsubscribe => {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
    get: (path: string) => {
      if (!currentSnapshot) return undefined;
      const parts = path.split(".");
      let value: unknown = currentSnapshot;
      for (const part of parts) {
        value = (value as Record<string, unknown>)?.[part];
      }
      return value;
    },
    dispatch,
    dispatchEvent,
    registerProjection: vi.fn(),
    unregisterProjection: vi.fn(),
    dispose: vi.fn(),
    getWorldId: vi.fn(() => "test-world-id"),

    // Test helpers
    _triggerUpdate: (snapshot: SnapshotView) => {
      currentSnapshot = snapshot;
      subscribers.forEach((cb) => cb(snapshot));
    },
    _setSnapshot: (snapshot: SnapshotView | null) => {
      currentSnapshot = snapshot;
    },
  } as unknown as Bridge & {
    _triggerUpdate: (snapshot: SnapshotView) => void;
    _setSnapshot: (snapshot: SnapshotView | null) => void;
    dispatch: ReturnType<typeof vi.fn>;
    dispatchEvent: ReturnType<typeof vi.fn>;
  };
};

const createTestSnapshot = (
  data: Record<string, unknown> = {},
  computed: Record<string, unknown> = {}
): SnapshotView => ({
  data,
  computed,
});

// ============================================================================
// Wrapper
// ============================================================================

const createWrapper = (bridge: Bridge) => {
  return ({ children }: { children: ReactNode }) => (
    <BridgeProvider bridge={bridge}>{children}</BridgeProvider>
  );
};

// ============================================================================
// useBridge Tests
// ============================================================================

describe("useBridge", () => {
  afterEach(() => {
    cleanup();
  });

  it("should return bridge from context", () => {
    const bridge = createMockBridge();
    const { result } = renderHook(() => useBridge(), {
      wrapper: createWrapper(bridge),
    });

    expect(result.current).toBe(bridge);
  });

  it("should throw error when used outside BridgeProvider", () => {
    expect(() => {
      renderHook(() => useBridge());
    }).toThrow("useBridge must be used within a BridgeProvider");
  });

  it("should return same bridge reference across re-renders", () => {
    const bridge = createMockBridge();
    const { result, rerender } = renderHook(() => useBridge(), {
      wrapper: createWrapper(bridge),
    });

    const firstBridge = result.current;
    rerender();
    expect(result.current).toBe(firstBridge);
  });
});

// ============================================================================
// useSnapshot Tests
// ============================================================================

describe("useSnapshot", () => {
  afterEach(() => {
    cleanup();
  });

  it("should return snapshot from context", () => {
    const snapshot = createTestSnapshot({ test: true });
    const bridge = createMockBridge({ initialSnapshot: snapshot });

    const { result } = renderHook(() => useSnapshot(), {
      wrapper: createWrapper(bridge),
    });

    expect(result.current).toEqual(snapshot);
  });

  it("should return null when no snapshot", () => {
    const bridge = createMockBridge();

    const { result } = renderHook(() => useSnapshot(), {
      wrapper: createWrapper(bridge),
    });

    expect(result.current).toBeNull();
  });

  it("should throw error when used outside BridgeProvider", () => {
    expect(() => {
      renderHook(() => useSnapshot());
    }).toThrow("useSnapshot must be used within a BridgeProvider");
  });

  it("should update when snapshot changes", () => {
    const bridge = createMockBridge();

    const { result } = renderHook(() => useSnapshot(), {
      wrapper: createWrapper(bridge),
    });

    expect(result.current).toBeNull();

    act(() => {
      bridge._triggerUpdate(createTestSnapshot({ updated: true }));
    });

    expect(result.current?.data).toEqual({ updated: true });
  });

  it("should re-render component when snapshot changes", () => {
    const bridge = createMockBridge();
    let renderCount = 0;

    const TestComponent = () => {
      renderCount++;
      const snapshot = useSnapshot();
      return <div data-testid="snapshot">{snapshot ? "has-snapshot" : "no-snapshot"}</div>;
    };

    render(
      <BridgeProvider bridge={bridge}>
        <TestComponent />
      </BridgeProvider>
    );

    const initialCount = renderCount;

    act(() => {
      bridge._triggerUpdate(createTestSnapshot({ test: true }));
    });

    expect(renderCount).toBeGreaterThan(initialCount);
  });
});

// ============================================================================
// useValue Tests
// ============================================================================

describe("useValue", () => {
  afterEach(() => {
    cleanup();
  });

  it("should return value at path", () => {
    const bridge = createMockBridge({
      initialSnapshot: createTestSnapshot({ todos: [1, 2, 3] }),
    });

    const { result } = renderHook(() => useValue<number[]>("data.todos"), {
      wrapper: createWrapper(bridge),
    });

    expect(result.current).toEqual([1, 2, 3]);
  });

  it("should return undefined for missing path", () => {
    const bridge = createMockBridge({
      initialSnapshot: createTestSnapshot({}),
    });

    const { result } = renderHook(() => useValue("data.nonexistent"), {
      wrapper: createWrapper(bridge),
    });

    expect(result.current).toBeUndefined();
  });

  it("should return undefined when no snapshot", () => {
    const bridge = createMockBridge();

    const { result } = renderHook(() => useValue("data.test"), {
      wrapper: createWrapper(bridge),
    });

    expect(result.current).toBeUndefined();
  });

  it("should return nested values", () => {
    const bridge = createMockBridge({
      initialSnapshot: createTestSnapshot({
        user: { profile: { name: "Alice" } },
      }),
    });

    const { result } = renderHook(() => useValue<string>("data.user.profile.name"), {
      wrapper: createWrapper(bridge),
    });

    expect(result.current).toBe("Alice");
  });

  it("should return computed values", () => {
    const bridge = createMockBridge({
      initialSnapshot: createTestSnapshot({}, { totalCount: 42 }),
    });

    const { result } = renderHook(() => useValue<number>("computed.totalCount"), {
      wrapper: createWrapper(bridge),
    });

    expect(result.current).toBe(42);
  });

  it("should update when value at path changes", () => {
    const bridge = createMockBridge({
      initialSnapshot: createTestSnapshot({ count: 0 }),
    });

    const { result } = renderHook(() => useValue<number>("data.count"), {
      wrapper: createWrapper(bridge),
    });

    expect(result.current).toBe(0);

    act(() => {
      bridge._triggerUpdate(createTestSnapshot({ count: 10 }));
    });

    expect(result.current).toBe(10);
  });

  it("should preserve type information", () => {
    interface Todo {
      id: string;
      title: string;
    }

    const bridge = createMockBridge({
      initialSnapshot: createTestSnapshot({
        todos: [{ id: "1", title: "Test" }],
      }),
    });

    const { result } = renderHook(() => useValue<Todo[]>("data.todos"), {
      wrapper: createWrapper(bridge),
    });

    expect(result.current?.[0].title).toBe("Test");
  });

  it("should throw when used outside BridgeProvider", () => {
    expect(() => {
      renderHook(() => useValue("data.test"));
    }).toThrow("useBridge must be used within a BridgeProvider");
  });
});

// ============================================================================
// useDispatch Tests
// ============================================================================

describe("useDispatch", () => {
  afterEach(() => {
    cleanup();
  });

  it("should return dispatch function", () => {
    const bridge = createMockBridge();

    const { result } = renderHook(() => useDispatch(), {
      wrapper: createWrapper(bridge),
    });

    expect(typeof result.current).toBe("function");
  });

  it("should call bridge.dispatch when invoked", async () => {
    const bridge = createMockBridge();

    const { result } = renderHook(() => useDispatch(), {
      wrapper: createWrapper(bridge),
    });

    const body = { type: "test.action", input: { value: 1 } };
    await act(async () => {
      await result.current(body);
    });

    expect(bridge.dispatch).toHaveBeenCalledWith(body, undefined);
  });

  it("should pass source event when provided", async () => {
    const bridge = createMockBridge();

    const { result } = renderHook(() => useDispatch(), {
      wrapper: createWrapper(bridge),
    });

    const body = { type: "test.action", input: {} };
    const source = { kind: "ui" as const, eventId: "test-event", payload: {} };

    await act(async () => {
      await result.current(body, source);
    });

    expect(bridge.dispatch).toHaveBeenCalledWith(body, source);
  });

  it("should return stable function reference", () => {
    const bridge = createMockBridge();

    const { result, rerender } = renderHook(() => useDispatch(), {
      wrapper: createWrapper(bridge),
    });

    const firstDispatch = result.current;
    rerender();
    expect(result.current).toBe(firstDispatch);
  });

  it("should throw when used outside BridgeProvider", () => {
    expect(() => {
      renderHook(() => useDispatch());
    }).toThrow("useBridge must be used within a BridgeProvider");
  });
});

// ============================================================================
// useDispatchEvent Tests
// ============================================================================

describe("useDispatchEvent", () => {
  afterEach(() => {
    cleanup();
  });

  it("should return dispatchEvent function", () => {
    const bridge = createMockBridge();

    const { result } = renderHook(() => useDispatchEvent(), {
      wrapper: createWrapper(bridge),
    });

    expect(typeof result.current).toBe("function");
  });

  it("should call bridge.dispatchEvent when invoked", async () => {
    const bridge = createMockBridge();

    const { result } = renderHook(() => useDispatchEvent(), {
      wrapper: createWrapper(bridge),
    });

    const source = { kind: "ui" as const, eventId: "test-event", payload: { action: "click" } };
    await act(async () => {
      await result.current(source);
    });

    expect(bridge.dispatchEvent).toHaveBeenCalledWith(source);
  });

  it("should return projection result", async () => {
    const bridge = createMockBridge();
    const expectedResult: ProjectionResult = {
      kind: "intent",
      body: { type: "test.action", input: {} },
    };
    bridge.dispatchEvent.mockResolvedValueOnce(expectedResult);

    const { result } = renderHook(() => useDispatchEvent(), {
      wrapper: createWrapper(bridge),
    });

    let projectionResult: ProjectionResult | undefined;
    await act(async () => {
      projectionResult = await result.current({
        kind: "ui",
        eventId: "test",
        payload: {},
      });
    });

    expect(projectionResult).toEqual(expectedResult);
  });

  it("should return stable function reference", () => {
    const bridge = createMockBridge();

    const { result, rerender } = renderHook(() => useDispatchEvent(), {
      wrapper: createWrapper(bridge),
    });

    const firstDispatchEvent = result.current;
    rerender();
    expect(result.current).toBe(firstDispatchEvent);
  });

  it("should throw when used outside BridgeProvider", () => {
    expect(() => {
      renderHook(() => useDispatchEvent());
    }).toThrow("useBridge must be used within a BridgeProvider");
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("hooks integration", () => {
  afterEach(() => {
    cleanup();
  });

  it("should work together in a component", async () => {
    const bridge = createMockBridge({
      initialSnapshot: createTestSnapshot({ count: 0 }),
    });

    const CounterComponent = () => {
      const count = useValue<number>("data.count");
      const dispatch = useDispatch();

      const increment = async () => {
        await dispatch({ type: "counter.increment", input: {} });
      };

      return (
        <div>
          <span data-testid="count">{count ?? 0}</span>
          <button data-testid="increment" onClick={increment}>
            +
          </button>
        </div>
      );
    };

    render(
      <BridgeProvider bridge={bridge}>
        <CounterComponent />
      </BridgeProvider>
    );

    expect(screen.getByTestId("count").textContent).toBe("0");

    await act(async () => {
      screen.getByTestId("increment").click();
    });

    expect(bridge.dispatch).toHaveBeenCalledWith(
      { type: "counter.increment", input: {} },
      undefined
    );

    // Simulate state update from bridge
    act(() => {
      bridge._triggerUpdate(createTestSnapshot({ count: 1 }));
    });

    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("should handle dispatchEvent flow", async () => {
    const bridge = createMockBridge({
      initialSnapshot: createTestSnapshot({}),
    });
    bridge.dispatchEvent.mockResolvedValueOnce({
      kind: "intent",
      body: { type: "form.submit", input: { title: "New Item" } },
    });

    const FormComponent = () => {
      const dispatchEvent = useDispatchEvent();

      const handleSubmit = async () => {
        const result = await dispatchEvent({
          kind: "ui",
          eventId: "form-submit",
          payload: { action: "submit", title: "New Item" },
        });
        return result;
      };

      return (
        <button data-testid="submit" onClick={handleSubmit}>
          Submit
        </button>
      );
    };

    render(
      <BridgeProvider bridge={bridge}>
        <FormComponent />
      </BridgeProvider>
    );

    await act(async () => {
      screen.getByTestId("submit").click();
    });

    expect(bridge.dispatchEvent).toHaveBeenCalledWith({
      kind: "ui",
      eventId: "form-submit",
      payload: { action: "submit", title: "New Item" },
    });
  });

  it("should access bridge directly when needed", () => {
    const bridge = createMockBridge();

    const DirectAccessComponent = () => {
      const b = useBridge();
      return <div data-testid="world-id">{b.getWorldId()}</div>;
    };

    render(
      <BridgeProvider bridge={bridge}>
        <DirectAccessComponent />
      </BridgeProvider>
    );

    expect(screen.getByTestId("world-id").textContent).toBe("test-world-id");
  });
});
