"use client";

import { useReducer, useCallback, useRef, useEffect } from "react";

interface HistoryState {
  past: unknown[];
  present: unknown;
  future: unknown[];
}

type HistoryAction =
  | { type: "SET"; payload: unknown }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET"; payload: unknown };

const MAX_HISTORY = 50;

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "SET": {
      // Don't add to history if value is the same
      if (JSON.stringify(state.present) === JSON.stringify(action.payload)) {
        return state;
      }
      const newPast = [...state.past, state.present].slice(-MAX_HISTORY);
      return {
        past: newPast,
        present: action.payload,
        future: [],
      };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      return {
        past: newPast,
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        past: [...state.past, state.present],
        present: next,
        future: newFuture,
      };
    }
    case "RESET": {
      return {
        past: [],
        present: action.payload,
        future: [],
      };
    }
    default:
      return state;
  }
}

interface UseExpressionHistoryOptions {
  /** Debounce time for rapid changes (ms) */
  debounceMs?: number;
}

/**
 * useExpressionHistory - Hook for managing expression edit history with undo/redo
 *
 * Features:
 * - Tracks edit history with configurable max size
 * - Debounces rapid changes to avoid flooding history
 * - Provides undo/redo with keyboard shortcut support
 */
export function useExpressionHistory(
  initialValue: unknown,
  options: UseExpressionHistoryOptions = {}
) {
  const { debounceMs = 300 } = options;

  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialValue,
    future: [],
  });

  // Track pending value for debouncing
  const pendingRef = useRef<unknown>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync with external value changes
  const externalValueRef = useRef(initialValue);
  useEffect(() => {
    if (JSON.stringify(externalValueRef.current) !== JSON.stringify(initialValue)) {
      externalValueRef.current = initialValue;
      dispatch({ type: "RESET", payload: initialValue });
    }
  }, [initialValue]);

  // Set value with debouncing
  const set = useCallback(
    (value: unknown) => {
      pendingRef.current = value;

      // Clear existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Set new timer to commit after debounce
      timerRef.current = setTimeout(() => {
        if (pendingRef.current !== null) {
          dispatch({ type: "SET", payload: pendingRef.current });
          pendingRef.current = null;
        }
      }, debounceMs);
    },
    [debounceMs]
  );

  // Immediate set without debouncing (for explicit saves)
  const setImmediate = useCallback((value: unknown) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    dispatch({ type: "SET", payload: value });
  }, []);

  // Undo
  const undo = useCallback(() => {
    // Commit any pending changes first
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current !== null) {
      dispatch({ type: "SET", payload: pendingRef.current });
      pendingRef.current = null;
    }
    dispatch({ type: "UNDO" });
  }, []);

  // Redo
  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  // Get the current value (including pending changes)
  const getValue = useCallback(() => {
    return pendingRef.current !== null ? pendingRef.current : state.present;
  }, [state.present]);

  return {
    value: state.present,
    set,
    setImmediate,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    historyLength: state.past.length,
    getValue,
  };
}
