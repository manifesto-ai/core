import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExpressionHistory } from "./useExpressionHistory";

describe("useExpressionHistory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("should initialize with the provided value", () => {
      const { result } = renderHook(() =>
        useExpressionHistory(["get", "data.foo"])
      );
      expect(result.current.value).toEqual(["get", "data.foo"]);
    });

    it("should start with canUndo = false", () => {
      const { result } = renderHook(() =>
        useExpressionHistory(["get", "data.foo"])
      );
      expect(result.current.canUndo).toBe(false);
    });

    it("should start with canRedo = false", () => {
      const { result } = renderHook(() =>
        useExpressionHistory(["get", "data.foo"])
      );
      expect(result.current.canRedo).toBe(false);
    });

    it("should start with historyLength = 0", () => {
      const { result } = renderHook(() =>
        useExpressionHistory(["get", "data.foo"])
      );
      expect(result.current.historyLength).toBe(0);
    });
  });

  describe("setImmediate", () => {
    it("should update value immediately", () => {
      const { result } = renderHook(() => useExpressionHistory(null));

      act(() => {
        result.current.setImmediate(["add", 1, 2]);
      });

      expect(result.current.value).toEqual(["add", 1, 2]);
    });

    it("should enable undo after set", () => {
      const { result } = renderHook(() => useExpressionHistory(null));

      act(() => {
        result.current.setImmediate(["add", 1, 2]);
      });

      expect(result.current.canUndo).toBe(true);
    });

    it("should increase history length", () => {
      const { result } = renderHook(() => useExpressionHistory(null));

      act(() => {
        result.current.setImmediate(["add", 1, 2]);
      });

      expect(result.current.historyLength).toBe(1);
    });

    it("should not add to history if value is the same", () => {
      const { result } = renderHook(() =>
        useExpressionHistory(["get", "data.foo"])
      );

      act(() => {
        result.current.setImmediate(["get", "data.foo"]);
      });

      expect(result.current.historyLength).toBe(0);
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe("undo", () => {
    it("should restore previous value", () => {
      const { result } = renderHook(() => useExpressionHistory("initial"));

      act(() => {
        result.current.setImmediate("second");
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.value).toBe("initial");
    });

    it("should enable redo after undo", () => {
      const { result } = renderHook(() => useExpressionHistory("initial"));

      act(() => {
        result.current.setImmediate("second");
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);
    });

    it("should disable undo when history is empty", () => {
      const { result } = renderHook(() => useExpressionHistory("initial"));

      act(() => {
        result.current.setImmediate("second");
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.canUndo).toBe(false);
    });

    it("should do nothing if canUndo is false", () => {
      const { result } = renderHook(() => useExpressionHistory("initial"));

      act(() => {
        result.current.undo();
      });

      expect(result.current.value).toBe("initial");
    });
  });

  describe("redo", () => {
    it("should restore undone value", () => {
      const { result } = renderHook(() => useExpressionHistory("initial"));

      act(() => {
        result.current.setImmediate("second");
      });

      act(() => {
        result.current.undo();
      });

      act(() => {
        result.current.redo();
      });

      expect(result.current.value).toBe("second");
    });

    it("should disable redo after redo", () => {
      const { result } = renderHook(() => useExpressionHistory("initial"));

      act(() => {
        result.current.setImmediate("second");
      });

      act(() => {
        result.current.undo();
      });

      act(() => {
        result.current.redo();
      });

      expect(result.current.canRedo).toBe(false);
    });

    it("should do nothing if canRedo is false", () => {
      const { result } = renderHook(() => useExpressionHistory("initial"));

      act(() => {
        result.current.redo();
      });

      expect(result.current.value).toBe("initial");
    });
  });

  describe("set (debounced)", () => {
    it("should not immediately update value", () => {
      const { result } = renderHook(() =>
        useExpressionHistory("initial", { debounceMs: 300 })
      );

      act(() => {
        result.current.set("new value");
      });

      // Value should not change immediately
      expect(result.current.value).toBe("initial");
    });

    it("should update value after debounce timeout", () => {
      const { result } = renderHook(() =>
        useExpressionHistory("initial", { debounceMs: 300 })
      );

      act(() => {
        result.current.set("new value");
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.value).toBe("new value");
    });

    it("should debounce multiple rapid calls", () => {
      const { result } = renderHook(() =>
        useExpressionHistory("initial", { debounceMs: 300 })
      );

      act(() => {
        result.current.set("first");
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.set("second");
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.set("third");
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Only the last value should be in history
      expect(result.current.value).toBe("third");
      expect(result.current.historyLength).toBe(1); // Only one history entry
    });
  });

  describe("multiple operations", () => {
    it("should handle a sequence of operations", () => {
      const { result } = renderHook(() => useExpressionHistory("v1"));

      // Add multiple values
      act(() => {
        result.current.setImmediate("v2");
      });
      act(() => {
        result.current.setImmediate("v3");
      });
      act(() => {
        result.current.setImmediate("v4");
      });

      expect(result.current.value).toBe("v4");
      expect(result.current.historyLength).toBe(3);

      // Undo twice
      act(() => {
        result.current.undo();
      });
      act(() => {
        result.current.undo();
      });

      expect(result.current.value).toBe("v2");
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(true);

      // Add new value (should clear redo)
      act(() => {
        result.current.setImmediate("v5");
      });

      expect(result.current.value).toBe("v5");
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe("complex values", () => {
    it("should handle nested expressions", () => {
      const { result } = renderHook(() =>
        useExpressionHistory(["add", ["get", "x"], ["get", "y"]])
      );

      act(() => {
        result.current.setImmediate(["mul", ["get", "x"], 2]);
      });

      expect(result.current.value).toEqual(["mul", ["get", "x"], 2]);

      act(() => {
        result.current.undo();
      });

      expect(result.current.value).toEqual(["add", ["get", "x"], ["get", "y"]]);
    });

    it("should handle null values", () => {
      const { result } = renderHook(() => useExpressionHistory(null));

      act(() => {
        result.current.setImmediate(["get", "data.foo"]);
      });

      expect(result.current.value).toEqual(["get", "data.foo"]);

      act(() => {
        result.current.undo();
      });

      expect(result.current.value).toBe(null);
    });
  });
});
