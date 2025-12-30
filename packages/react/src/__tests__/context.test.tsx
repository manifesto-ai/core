/**
 * Context Tests
 *
 * Tests for BridgeContext and BridgeProvider.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { useContext, type ReactNode } from "react";
import type { Bridge, SnapshotView, Unsubscribe } from "@manifesto-ai/bridge";
import { BridgeContext, type BridgeContextValue } from "../context/BridgeContext.js";
import { BridgeProvider } from "../context/BridgeProvider.js";

// ============================================================================
// Mock Bridge
// ============================================================================

interface MockBridgeOptions {
  initialSnapshot?: SnapshotView | null;
}

const createMockBridge = (options: MockBridgeOptions = {}): Bridge & {
  _triggerUpdate: (snapshot: SnapshotView) => void;
  _getSubscribers: () => Set<(snapshot: SnapshotView) => void>;
} => {
  let currentSnapshot: SnapshotView | null = options.initialSnapshot ?? null;
  const subscribers = new Set<(snapshot: SnapshotView) => void>();

  return {
    getSnapshot: () => currentSnapshot,
    subscribe: (callback: (snapshot: SnapshotView) => void): Unsubscribe => {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
    get: vi.fn((path: string) => {
      if (!currentSnapshot) return undefined;
      const parts = path.split(".");
      let value: unknown = currentSnapshot;
      for (const part of parts) {
        value = (value as Record<string, unknown>)?.[part];
      }
      return value;
    }),
    dispatch: vi.fn(async () => {}),
    dispatchEvent: vi.fn(async () => ({ kind: "none" as const })),
    registerProjection: vi.fn(),
    unregisterProjection: vi.fn(),
    dispose: vi.fn(),
    getWorldId: vi.fn(() => "test-world-id"),

    // Test helpers
    _triggerUpdate: (snapshot: SnapshotView) => {
      currentSnapshot = snapshot;
      subscribers.forEach((cb) => cb(snapshot));
    },
    _getSubscribers: () => subscribers,
  } as unknown as Bridge & {
    _triggerUpdate: (snapshot: SnapshotView) => void;
    _getSubscribers: () => Set<(snapshot: SnapshotView) => void>;
  };
};

const createTestSnapshot = (data: Record<string, unknown> = {}): SnapshotView => ({
  data,
  computed: {},
});

// ============================================================================
// Test Components
// ============================================================================

const ContextReader = () => {
  const context = useContext(BridgeContext);
  return (
    <div data-testid="context-reader">
      {context ? "context-available" : "context-null"}
    </div>
  );
};

const SnapshotReader = () => {
  const context = useContext(BridgeContext);
  return (
    <div data-testid="snapshot-reader">
      {context?.snapshot ? JSON.stringify(context.snapshot.data) : "no-snapshot"}
    </div>
  );
};

// ============================================================================
// Tests
// ============================================================================

describe("BridgeContext", () => {
  afterEach(() => {
    cleanup();
  });

  it("should have displayName", () => {
    expect(BridgeContext.displayName).toBe("BridgeContext");
  });

  it("should provide null by default", () => {
    render(<ContextReader />);
    expect(screen.getByTestId("context-reader").textContent).toBe("context-null");
  });
});

describe("BridgeProvider", () => {
  let mockBridge: ReturnType<typeof createMockBridge>;

  beforeEach(() => {
    mockBridge = createMockBridge();
  });

  afterEach(() => {
    cleanup();
  });

  it("should provide bridge through context", () => {
    render(
      <BridgeProvider bridge={mockBridge}>
        <ContextReader />
      </BridgeProvider>
    );

    expect(screen.getByTestId("context-reader").textContent).toBe("context-available");
  });

  it("should provide initial snapshot from bridge", () => {
    const initialSnapshot = createTestSnapshot({ foo: "bar" });
    mockBridge = createMockBridge({ initialSnapshot });

    render(
      <BridgeProvider bridge={mockBridge}>
        <SnapshotReader />
      </BridgeProvider>
    );

    expect(screen.getByTestId("snapshot-reader").textContent).toBe('{"foo":"bar"}');
  });

  it("should provide null snapshot when bridge has no snapshot", () => {
    render(
      <BridgeProvider bridge={mockBridge}>
        <SnapshotReader />
      </BridgeProvider>
    );

    expect(screen.getByTestId("snapshot-reader").textContent).toBe("no-snapshot");
  });

  it("should subscribe to bridge on mount", () => {
    render(
      <BridgeProvider bridge={mockBridge}>
        <div>child</div>
      </BridgeProvider>
    );

    expect(mockBridge._getSubscribers().size).toBe(1);
  });

  it("should unsubscribe from bridge on unmount", () => {
    const { unmount } = render(
      <BridgeProvider bridge={mockBridge}>
        <div>child</div>
      </BridgeProvider>
    );

    expect(mockBridge._getSubscribers().size).toBe(1);
    unmount();
    expect(mockBridge._getSubscribers().size).toBe(0);
  });

  it("should update snapshot when bridge notifies", () => {
    render(
      <BridgeProvider bridge={mockBridge}>
        <SnapshotReader />
      </BridgeProvider>
    );

    expect(screen.getByTestId("snapshot-reader").textContent).toBe("no-snapshot");

    act(() => {
      mockBridge._triggerUpdate(createTestSnapshot({ updated: true }));
    });

    expect(screen.getByTestId("snapshot-reader").textContent).toBe('{"updated":true}');
  });

  it("should handle multiple snapshot updates", () => {
    let renderCount = 0;
    const Counter = () => {
      renderCount++;
      const context = useContext(BridgeContext);
      return <div data-testid="counter">{(context?.snapshot?.data as Record<string, unknown>)?.count as number ?? 0}</div>;
    };

    render(
      <BridgeProvider bridge={mockBridge}>
        <Counter />
      </BridgeProvider>
    );

    expect(screen.getByTestId("counter").textContent).toBe("0");
    const initialRenderCount = renderCount;

    act(() => {
      mockBridge._triggerUpdate(createTestSnapshot({ count: 1 }));
    });
    expect(screen.getByTestId("counter").textContent).toBe("1");

    act(() => {
      mockBridge._triggerUpdate(createTestSnapshot({ count: 2 }));
    });
    expect(screen.getByTestId("counter").textContent).toBe("2");

    // Should have re-rendered for each update
    expect(renderCount).toBeGreaterThan(initialRenderCount);
  });

  it("should resubscribe when bridge changes", () => {
    const { rerender } = render(
      <BridgeProvider bridge={mockBridge}>
        <SnapshotReader />
      </BridgeProvider>
    );

    const newBridge = createMockBridge({
      initialSnapshot: createTestSnapshot({ newBridge: true }),
    });

    rerender(
      <BridgeProvider bridge={newBridge}>
        <SnapshotReader />
      </BridgeProvider>
    );

    // Old bridge should be unsubscribed
    expect(mockBridge._getSubscribers().size).toBe(0);
    // New bridge should be subscribed
    expect(newBridge._getSubscribers().size).toBe(1);
    // Should show new snapshot
    expect(screen.getByTestId("snapshot-reader").textContent).toBe('{"newBridge":true}');
  });

  it("should render children correctly", () => {
    render(
      <BridgeProvider bridge={mockBridge}>
        <div data-testid="child1">Child 1</div>
        <div data-testid="child2">Child 2</div>
      </BridgeProvider>
    );

    expect(screen.getByTestId("child1")).toBeDefined();
    expect(screen.getByTestId("child2")).toBeDefined();
  });

  it("should support nested providers", () => {
    const outerBridge = createMockBridge({
      initialSnapshot: createTestSnapshot({ location: "outer" }),
    });
    const innerBridge = createMockBridge({
      initialSnapshot: createTestSnapshot({ location: "inner" }),
    });

    render(
      <BridgeProvider bridge={outerBridge}>
        <div data-testid="outer">
          <SnapshotReader />
        </div>
        <BridgeProvider bridge={innerBridge}>
          <div data-testid="inner">
            <SnapshotReader />
          </div>
        </BridgeProvider>
      </BridgeProvider>
    );

    // Inner provider should shadow outer
    const readers = screen.getAllByTestId("snapshot-reader");
    expect(readers[0].textContent).toBe('{"location":"outer"}');
    expect(readers[1].textContent).toBe('{"location":"inner"}');
  });
});

describe("BridgeContextValue", () => {
  it("should have correct shape", () => {
    const bridge = createMockBridge();
    const snapshot = createTestSnapshot({ test: true });

    const value: BridgeContextValue = {
      bridge,
      snapshot,
    };

    expect(value.bridge).toBe(bridge);
    expect(value.snapshot).toBe(snapshot);
  });
});
